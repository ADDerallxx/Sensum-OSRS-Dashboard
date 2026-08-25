param()
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$patch = Join-Path $root "patch-v1.22a.py"
$deploy = Join-Path $root "deploy.ps1"

$files = @(
  "QuestRequirementsTrust.js",
  "V1.html",
  "deploy.ps1"
)

foreach ($name in $files) {
  if (!(Test-Path -LiteralPath (Join-Path $root $name))) {
    throw "Missing $name. Extract both V1.22a files into the Sensum-OSRS-Dashboard folder."
  }
}

if (!(Test-Path -LiteralPath $patch)) {
  throw "Missing patch-v1.22a.py."
}

$backupDir = Join-Path $env:TEMP ("Sensum-V122a-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $backupDir | Out-Null

foreach ($name in $files) {
  Copy-Item (Join-Path $root $name) (Join-Path $backupDir $name) -Force
}

try {
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    & py -3 $patch
  }
  else {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (!$python) {
      throw "Python was not found in PATH."
    }
    & python $patch
  }

  if ($LASTEXITCODE -ne 0) {
    throw "V1.22a patch script failed."
  }

  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    & node --check (Join-Path $root "QuestRequirementsTrust.js")
    if ($LASTEXITCODE -ne 0) {
      throw "JavaScript syntax check failed for QuestRequirementsTrust.js."
    }
  }

  Write-Host ""
  Write-Host "V1.22a installed locally." -ForegroundColor Green
  Write-Host "Deploying source AND live web app..." -ForegroundColor Cyan
  Write-Host ""

  & $deploy -Message "V1.22a Fairytale II trust fix and automatic live redeploy"
  if ($LASTEXITCODE -ne 0) {
    throw "deploy.ps1 reported a failure."
  }

  Write-Host ""
  Write-Host "======================================================" -ForegroundColor Green
  Write-Host " V1.22a DEPLOYED LIVE" -ForegroundColor Green
  Write-Host " Run in Apps Script: qhInstallV122a" -ForegroundColor Yellow
  Write-Host "======================================================" -ForegroundColor Green
  Write-Host ""

  if (Get-Command clasp -ErrorAction SilentlyContinue) {
    & clasp open-script
  }
}
catch {
  Write-Host ""
  Write-Host "V1.22a failed. Restoring the pre-install files..." -ForegroundColor Red

  foreach ($name in $files) {
    $src = Join-Path $backupDir $name
    if (Test-Path -LiteralPath $src) {
      Copy-Item $src (Join-Path $root $name) -Force
    }
  }

  throw
}
finally {
  Remove-Item $backupDir -Recurse -Force -ErrorAction SilentlyContinue
}
