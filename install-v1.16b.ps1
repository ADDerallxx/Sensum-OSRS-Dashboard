$ErrorActionPreference="Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"
if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 ".\patch-v1.16b.py" } elseif (Get-Command python -ErrorAction SilentlyContinue) { & python ".\patch-v1.16b.py" } else { throw "Python not found." }
if ($LASTEXITCODE -ne 0) { throw "V1.16B patch failed." }
Write-Host "V1.16B Quest Rewards installed and verified." -ForegroundColor Green
Write-Host '.\deploy.ps1 -Message "V1.16 quest rewards verified installer"'
