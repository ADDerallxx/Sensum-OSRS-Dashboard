$ErrorActionPreference="Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

if (!(Test-Path ".\patch-v1.15.2b.py")) { throw "patch-v1.15.2b.py not found." }

if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3 ".\patch-v1.15.2b.py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  & python ".\patch-v1.15.2b.py"
} else {
  throw "Python not found."
}

if ($LASTEXITCODE -ne 0) { throw "V1.15.2b patch failed." }

Write-Host ""
Write-Host "V1.15.2b installed successfully." -ForegroundColor Green
Write-Host "Deploy with:"
Write-Host '.\deploy.ps1 -Message "V1.15.2b fix Report Quest button quoting"'
