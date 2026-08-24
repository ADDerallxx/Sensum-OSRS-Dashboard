$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

if (!(Test-Path ".\patch-qh-runtime-diagnostic.py")) {
    throw "patch-qh-runtime-diagnostic.py not found."
}

if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 ".\patch-qh-runtime-diagnostic.py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python ".\patch-qh-runtime-diagnostic.py"
} else {
    throw "Python not found."
}

if ($LASTEXITCODE -ne 0) {
    throw "Runtime diagnostic patch failed."
}

Write-Host ""
Write-Host "Quest Helper runtime diagnostic installed." -ForegroundColor Green
Write-Host "Now deploy with:"
Write-Host '.\deploy.ps1 -Message "Add Quest Helper runtime diagnostic logging"'
