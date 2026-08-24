$ErrorActionPreference="Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"
if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 ".\patch-v1.15.2a.py" }
elseif (Get-Command python -ErrorAction SilentlyContinue) { & python ".\patch-v1.15.2a.py" }
else { throw "Python not found." }
if ($LASTEXITCODE -ne 0) { throw "V1.15.2a patch failed." }
Write-Host "V1.15.2a installed successfully." -ForegroundColor Green
Write-Host '.\deploy.ps1 -Message "V1.15.2a fix Report Quest against actual markup"'
