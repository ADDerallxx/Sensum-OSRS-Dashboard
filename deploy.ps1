param([string]$Message = "")
$ErrorActionPreference = "Stop"

function Step([string]$Text) {
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Fail([string]$Text) {
  Write-Host ""
  Write-Host "DEPLOY FAILED: $Text" -ForegroundColor Red
  exit 1
}

function Run-Git {
  param([string[]]$GitArgs)

  & git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    Fail ("git " + ($GitArgs -join " ") + " failed.")
  }
}

try {
  Write-Host ""
  Write-Host "Sensum OSRS Dashboard Deploy" -ForegroundColor Yellow
  Write-Host "-----------------------------" -ForegroundColor DarkYellow

  if (-not (Test-Path -LiteralPath ".git")) {
    Fail "Run this from the Sensum-OSRS-Dashboard repository folder."
  }

  if (-not (Test-Path -LiteralPath ".clasp.json")) {
    Fail ".clasp.json was not found. This folder is not linked to the Apps Script project."
  }

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail "git is not available in PATH."
  }

  if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
    Fail "clasp is not available in PATH."
  }

  Step "Checking repository state"

  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0) {
    Fail "Could not determine Git branch."
  }

  if ($branch -ne "main") {
    Fail "Current branch is '$branch'. Switch to main before deploying."
  }

  & git check-ignore -q -- ".clasp.json"
  if ($LASTEXITCODE -ne 0) {
    Fail ".clasp.json is NOT ignored by Git."
  }

  Step "Normalizing source encoding"

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $textExtensions = @(".js",".gs",".html",".json",".css",".txt",".md",".ps1")

  Get-ChildItem -File | Where-Object {
    $textExtensions -contains $_.Extension.ToLowerInvariant()
  } | ForEach-Object {
    $text = [IO.File]::ReadAllText($_.FullName)
    [IO.File]::WriteAllText($_.FullName, $text, $utf8NoBom)
  }

  Step "Checking local changes"

  & git status --short
  if ($LASTEXITCODE -ne 0) {
    Fail "git status failed."
  }

  $changed = @()
  $changed += @(& git diff --name-only --diff-filter=ACDMRTUXB)
  if ($LASTEXITCODE -ne 0) { Fail "Could not list modified files." }

  $changed += @(& git diff --cached --name-only --diff-filter=ACDMRTUXB)
  if ($LASTEXITCODE -ne 0) { Fail "Could not list staged files." }

  $changed += @(& git ls-files --others --exclude-standard)
  if ($LASTEXITCODE -ne 0) { Fail "Could not list untracked files." }

  $changed = @($changed | Where-Object { $_ } | Sort-Object -Unique)

  if ($changed.Count -eq 0) {
    Write-Host ""
    Write-Host "Nothing to deploy." -ForegroundColor Yellow
    exit 0
  }

  Step "Scanning changed files for obvious secrets"

  $secretPattern = '(?i)(password\s*[:=]|api[_-]?key\s*[:=]|secret\s*[:=]|bearer\s+[A-Za-z0-9_\-\.]+|token\s*[:=]\s*[''"][A-Za-z0-9_\-\.]{16,})'
  $scannable = @(".js",".gs",".html",".json",".txt",".md",".ps1",".css")

  foreach ($file in $changed) {
    if ($file -eq ".clasp.json") { continue }
    if (-not (Test-Path -LiteralPath $file)) { continue }

    $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
    if ($scannable -notcontains $ext) { continue }

    $hits = Select-String -LiteralPath $file -Pattern $secretPattern -ErrorAction SilentlyContinue
    if ($hits) {
      Write-Host ""
      Write-Host "Potential secret detected in: $file" -ForegroundColor Red
      $hits | ForEach-Object {
        Write-Host ("  Line " + $_.LineNumber + ": " + $_.Line.Trim()) -ForegroundColor Red
      }
      Fail "Review the potential secret before deployment."
    }
  }

  Step "Staging source changes"
  Run-Git -GitArgs @("add", ".")

  $staged = @(& git diff --cached --name-only)
  if ($LASTEXITCODE -ne 0) {
    Fail "Could not inspect staged files."
  }

  foreach ($blocked in @(
    ".clasp.json",
    ".clasprc.json",
    ".env",
    ".env.local",
    "credentials.json",
    "client_secret.json",
    "secrets.json"
  )) {
    if ($staged -contains $blocked) {
      & git restore --staged -- "$blocked" 2>$null
      Fail "Sensitive file '$blocked' was staged; it has been unstaged."
    }
  }

  if ($staged.Count -eq 0) {
    Write-Host ""
    Write-Host "Nothing remains staged after safety checks." -ForegroundColor Yellow
    exit 0
  }

  Write-Host ""
  Write-Host "Files to commit:" -ForegroundColor DarkCyan
  & git diff --cached --name-status

  if (-not $Message) {
    $Message = "Dashboard update - " + (Get-Date -Format "yyyy-MM-dd HH:mm")
  }

  Step "Creating Git commit"
  Run-Git -GitArgs @("commit", "-m", $Message)

  Step "Pushing commit to GitHub"
  Run-Git -GitArgs @("push", "origin", "main")

  Step "Uploading source to Google Apps Script"

  & clasp push
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "GitHub was updated, but clasp push failed." -ForegroundColor Red
    Write-Host "After fixing clasp, run: clasp push" -ForegroundColor Yellow
    exit 1
  }


  # V122A_AUTO_WEBAPP_REDEPLOY
  Step "Redeploying live Apps Script web app"

  $deploymentOutput = @(& clasp list-deployments)
  if ($LASTEXITCODE -ne 0) {
    Fail "Could not list Apps Script deployments."
  }

  $parsedDeployments = @()
  foreach ($line in $deploymentOutput) {
    if ($line -match '^\-\s+(AKfy\S+)\s+@(\d+)(?:\s+\-\s+(.+))?$') {
      $parsedDeployments += [PSCustomObject]@{
        Id = $Matches[1]
        Version = [int]$Matches[2]
        Description = [string]$Matches[3]
      }
    }
  }

  if ($parsedDeployments.Count -eq 0) {
    Fail "No versioned Apps Script deployments were found."
  }

  $targets = @()

  $named = @($parsedDeployments | Where-Object {
    $_.Description -match 'Sensum\s*-\s*OSRS\s*Dashboard'
  })
  if ($named.Count -gt 0) {
    $targets += $named
  }

  $newest = $parsedDeployments | Sort-Object Version -Descending | Select-Object -First 1
  if ($newest) {
    $targets += $newest
  }

  $targets = @($targets | Group-Object Id | ForEach-Object { $_.Group[0] })

  $claspHelp = (& clasp --help 2>&1 | Out-String)
  foreach ($target in $targets) {
    Write-Host ("Redeploying " + $target.Id + " (currently @" + $target.Version + ")") -ForegroundColor DarkCyan

    if ($claspHelp -match 'update-deployment') {
      & clasp update-deployment $target.Id --description $Message
    } else {
      & clasp deploy -i $target.Id -d $Message
    }

    if ($LASTEXITCODE -ne 0) {
      Fail ("Apps Script live redeployment failed for " + $target.Id)
    }
  }

  Write-Host ""
  Write-Host ("Live deployment(s) updated: " + (($targets | ForEach-Object { $_.Id }) -join ", ")) -ForegroundColor Green

  Write-Host ""
  Write-Host "==========================================" -ForegroundColor Green
  Write-Host " DEPLOY SUCCESSFUL" -ForegroundColor Green
  Write-Host " GitHub: pushed to main" -ForegroundColor Green
  Write-Host " Apps Script: source updated with clasp" -ForegroundColor Green
  Write-Host " Live web app: redeployed automatically" -ForegroundColor Green
  Write-Host "==========================================" -ForegroundColor Green
  Write-Host ""
}
catch {
  Fail $_.Exception.Message
}
