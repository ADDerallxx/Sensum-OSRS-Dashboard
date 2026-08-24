$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

if (!(Test-Path ".\patch-qh-403-fix.py")) { throw "patch-qh-403-fix.py not found." }

if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3 ".\patch-qh-403-fix.py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  & python ".\patch-qh-403-fix.py"
} else {
  throw "Python not found."
}

if ($LASTEXITCODE -ne 0) { throw "Quest Helper 403 fix failed." }

Write-Host ""
Write-Host "Quest Helper GitHub 403 bypass installed." -ForegroundColor Green
Write-Host "Deploy with:"
Write-Host '.\deploy.ps1 -Message "Bypass GitHub API 403 for Quest Helper sync"'
