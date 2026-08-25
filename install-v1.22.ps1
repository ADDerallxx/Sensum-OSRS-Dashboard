param()
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$patch = Join-Path $root "patch-v1.22.py"
$deploy = Join-Path $root "deploy.ps1"
$files = @(
    "DashboardV1.js",
    "V1.html",
    "QuestHelperSync.js",
    "QuestRequirementsTrust.js"
)

foreach ($name in $files) {
    if (!(Test-Path (Join-Path $root $name))) {
        throw "Missing $name. Extract both V1.22 files into the Sensum-OSRS-Dashboard folder."
    }
}
if (!(Test-Path $patch)) { throw "Missing patch-v1.22.py." }
if (!(Test-Path $deploy)) { throw "Missing deploy.ps1." }

$backupDir = Join-Path $env:TEMP ("Sensum-V122-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $backupDir | Out-Null

foreach ($name in $files) {
    Copy-Item (Join-Path $root $name) (Join-Path $backupDir $name) -Force
}

try {
    $python = Get-Command py -ErrorAction SilentlyContinue
    if ($python) {
        & py -3 $patch
    } else {
        $python = Get-Command python -ErrorAction SilentlyContinue
        if (!$python) { throw "Python was not found in PATH." }
        & python $patch
    }
    if ($LASTEXITCODE -ne 0) { throw "V1.22 patch script failed." }

    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        foreach ($name in @("DashboardV1.js","QuestHelperSync.js","QuestRequirementsTrust.js")) {
            & node --check (Join-Path $root $name)
            if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed for $name." }
        }
    }

    Write-Host ""
    Write-Host "V1.22 installed locally." -ForegroundColor Green
    Write-Host "Deploying to GitHub and Apps Script..." -ForegroundColor Cyan
    Write-Host ""

    & $deploy -Message "V1.22 requirement intelligence and fast quest completion"
    if ($LASTEXITCODE -ne 0) { throw "deploy.ps1 reported a failure." }

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host " V1.22 DEPLOYED" -ForegroundColor Green
    Write-Host " Run in Apps Script: qhInstallV122" -ForegroundColor Yellow
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host ""

    if (Get-Command clasp -ErrorAction SilentlyContinue) {
        & clasp open-script
    }
}
catch {
    Write-Host ""
    Write-Host "V1.22 failed. Restoring the pre-install files..." -ForegroundColor Red
    foreach ($name in $files) {
        $src = Join-Path $backupDir $name
        if (Test-Path $src) { Copy-Item $src (Join-Path $root $name) -Force }
    }
    throw
}
finally {
    Remove-Item $backupDir -Recurse -Force -ErrorAction SilentlyContinue
}
