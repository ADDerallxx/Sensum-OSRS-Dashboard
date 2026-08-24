$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

if (!(Test-Path ".\V1.html")) { throw "V1.html not found." }
if (!(Test-Path ".\patch-v1.13.2.py")) { throw "patch-v1.13.2.py not found. Extract BOTH files from the ZIP." }

$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    & py -3 ".\patch-v1.13.2.py"
} else {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (!$python) { throw "Python was not found on PATH." }
    & python ".\patch-v1.13.2.py"
}
if ($LASTEXITCODE -ne 0) { throw "V1.13.2 patch failed." }

Write-Host ""
Write-Host "V1.13.2 installed successfully." -ForegroundColor Green
Write-Host "Now run:"
Write-Host '.\deploy.ps1 -Message "V1.13.2 fix complete quest prep items"'
