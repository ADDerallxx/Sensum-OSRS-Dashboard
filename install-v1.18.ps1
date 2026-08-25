$ErrorActionPreference="Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"
Write-Host "V1.18 Requirements Trust Layer files are ready." -ForegroundColor Green
Write-Host '.\deploy.ps1 -Message "V1.18 quest requirements trust layer"'
Write-Host "After deploy, run qhInstallV118TrustLayer_ once in Apps Script." -ForegroundColor Yellow
