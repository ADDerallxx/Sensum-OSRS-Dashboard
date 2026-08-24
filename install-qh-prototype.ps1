$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

if (!(Test-Path ".\QuestHelperSync.js")) { throw "QuestHelperSync.js not found. Extract the entire ZIP into the dashboard folder." }
if (!(Test-Path ".\patch-qh-prototype.py")) { throw "patch-qh-prototype.py not found. Extract the entire ZIP into the dashboard folder." }
if (!(Test-Path ".\DashboardV1.js")) { throw "DashboardV1.js not found." }

$py = Get-Command py -ErrorAction SilentlyContinue
if ($py) {
  & py -3 ".\patch-qh-prototype.py"
} else {
  $python = Get-Command python -ErrorAction SilentlyContinue
  if (!$python) { throw "Python was not found on PATH." }
  & python ".\patch-qh-prototype.py"
}
if ($LASTEXITCODE -ne 0) { throw "Quest Helper prototype patch failed." }

Write-Host ""
Write-Host "Quest Helper prototype installed." -ForegroundColor Green
Write-Host "It will populate the new Quest Helper Cache sheet when V1 is loaded."
Write-Host "The cache refreshes at most once every 6 hours."
Write-Host "Route Prep still uses the current Wiki pipeline until we validate the cache."
Write-Host ""
Write-Host "Deploy with:"
Write-Host '.\deploy.ps1 -Message "Add Quest Helper requirement audit prototype"'
