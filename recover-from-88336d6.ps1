$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

Write-Host ""
Write-Host "Sensum OSRS Dashboard Recovery" -ForegroundColor Cyan
Write-Host "-----------------------------"

# Restore the accidentally truncated legacy Apps Script file from the known-good
# commit immediately before the failed diagnostic patch.
git checkout a9ab14e -- "Sensum - OSRS Dashboard.js"

if ($LASTEXITCODE -ne 0) {
    throw "Could not restore Sensum - OSRS Dashboard.js from a9ab14e."
}

# Remove the broken diagnostic helper files that were accidentally committed.
if (Test-Path ".\install-qh-diagnostic.ps1") {
    Remove-Item ".\install-qh-diagnostic.ps1" -Force
}
if (Test-Path ".\patch-qh-diagnostic.py") {
    Remove-Item ".\patch-qh-diagnostic.py" -Force
}

Write-Host ""
Write-Host "Restored the pre-diagnostic Apps Script source." -ForegroundColor Green
Write-Host "Removed broken diagnostic helper files."
Write-Host ""
Write-Host "Now deploy with:"
Write-Host '.\deploy.ps1 -Message "Recover from failed Quest Helper diagnostic patch"'
