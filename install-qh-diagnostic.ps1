$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

if (!(Test-Path ".\patch-qh-diagnostic.py")) { throw "patch-qh-diagnostic.py not found." }

if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3 ".\patch-qh-diagnostic.py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  & python ".\patch-qh-diagnostic.py"
} else {
  throw "Python not found."
}
if ($LASTEXITCODE -ne 0) { throw "Patch failed." }

Write-Host ""
Write-Host "Diagnostic endpoint installed." -ForegroundColor Green
Write-Host "Deploy next with:"
Write-Host '.\deploy.ps1 -Message "Add Quest Helper diagnostic sync endpoint"'
Write-Host ""
Write-Host "After deploy, open your normal /dev URL with ?qhdiag=1 instead of ?v=1."
