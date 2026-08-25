param()
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$source = Join-Path $root "QuestRequirementsTrust.js"
$deploy = Join-Path $root "deploy.ps1"

if (!(Test-Path $source)) {
    throw "QuestRequirementsTrust.js was not found. Extract this ZIP into the Sensum-OSRS-Dashboard folder."
}
if (!(Test-Path $deploy)) {
    throw "deploy.ps1 was not found. Extract this ZIP into the Sensum-OSRS-Dashboard folder."
}

$backup = Join-Path $env:TEMP ("QuestRequirementsTrust-" + [guid]::NewGuid().ToString("N") + ".bak")
Copy-Item $source $backup -Force

try {
    $content = [IO.File]::ReadAllText($source)

    if (-not $content.Contains("function qhV118AuditRemaining()")) {
        $wrapper = @'

function qhV118AuditRemaining() {
  const p = PropertiesService.getScriptProperties();
  let cursor = Number(p.getProperty('QH_V118_AUDIT_CURSOR') || 0);

  if (cursor === 0) {
    return {ok:true, complete:true, message:'No remaining audit batches.'};
  }

  const started = Date.now();
  let batches = 0;
  let result = null;

  while (cursor !== 0 && batches < 6 && (Date.now() - started) < 240000) {
    result = qhV118AuditBatch_(cursor, 20);
    cursor = Number(result.next || 0);
    batches++;
  }

  return {
    ok:true,
    batchesProcessed:batches,
    next:cursor,
    complete:cursor === 0,
    lastResult:result
  };
}
'@
        $content = $content.TrimEnd() + "`r`n" + $wrapper + "`r`n"
        [IO.File]::WriteAllText($source, $content, (New-Object System.Text.UTF8Encoding($false)))
    }

    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        & node --check $source
        if ($LASTEXITCODE -ne 0) {
            throw "JavaScript syntax check failed."
        }
    }

    Write-Host ""
    Write-Host "V1.18c remaining-audit runner installed locally." -ForegroundColor Green
    Write-Host "Deploying to GitHub and Apps Script..." -ForegroundColor Cyan
    Write-Host ""

    & $deploy -Message "V1.18c one-click remaining audit runner"
    if ($LASTEXITCODE -ne 0) {
        throw "deploy.ps1 reported a failure."
    }

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host " V1.18c READY" -ForegroundColor Green
    Write-Host " In Apps Script, run: qhV118AuditRemaining" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Green
}
catch {
    Copy-Item $backup $source -Force
    throw
}
finally {
    Remove-Item $backup -Force -ErrorAction SilentlyContinue
}
