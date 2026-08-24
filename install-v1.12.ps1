$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

$v1 = ".\V1.html"
$backend = ".\DashboardV1.js"

if (!(Test-Path $v1)) { throw "V1.html not found." }
if (!(Test-Path $backend)) { throw "DashboardV1.js not found." }

# ---- V1.12: Data Health accuracy ----
$html = Get-Content $v1 -Raw

$html = $html.Replace("V1.11 · Data Health", "V1.12 · Trust the Numbers")

$oldHealth = @'
  if(wom===null || wiki===null || sheet===null || missing>0){
    state='ERROR'; cls='healthError';
  }else if(wom>180 || sheet>180 || wiki>2880){
    state='STALE'; cls='healthStale';
  }else if(wom>90 || sheet>90 || wiki>1440 || reviews>0){
    state='ATTENTION'; cls='healthAttention';
  }
'@

$newHealth = @'
  if(wom===null || wiki===null || sheet===null || missing>0){
    state='ERROR'; cls='healthError';
  }else if(wom>240 || sheet>240 || wiki>2880){
    state='STALE'; cls='healthStale';
  }else if(wom>120 || sheet>120 || wiki>1440 || reviews>0){
    state='ATTENTION'; cls='healthAttention';
  }
'@

if (!$html.Contains($oldHealth)) {
  throw "Could not find V1.11 health threshold block. Nothing was changed."
}
$html = $html.Replace($oldHealth, $newHealth)

# Backend now owns reusable/consumable quantity semantics.
# Remove the frontend quantity re-aggregation so V1 renders tracker truth as-is.
$oldMerge = @'
      prev.qty=mergePrepQty(prev.qty,i.qty,prev.item);
      prev.obtain=prev.obtain && obtain;
'@
$newMerge = @'
      prev.qty=Math.max(Number(prev.qty||1),Number(i.qty||1));
      prev.obtain=prev.obtain && obtain;
'@
if ($html.Contains($oldMerge)) {
  $html = $html.Replace($oldMerge, $newMerge)
}

[IO.File]::WriteAllText((Resolve-Path $v1), $html, (New-Object Text.UTF8Encoding($false)))

# ---- Backend: fix Wiki Health cell mapping ----
$js = Get-Content $backend -Raw

$oldWiki = @'
    wikiHealth: {
      ok: dash.getRange('B50').getDisplayValue(),
      review: dash.getRange('B51').getDisplayValue(),
      missing: dash.getRange('B52').getDisplayValue(),
      lastCheck: dash.getRange('B53').getDisplayValue()
    }
'@

$newWiki = @'
    wikiHealth: {
      ok: dash.getRange('B51').getDisplayValue(),
      review: dash.getRange('B52').getDisplayValue(),
      missing: dash.getRange('B53').getDisplayValue(),
      lastCheck: dash.getRange('B54').getDisplayValue()
    }
'@

if (!$js.Contains($oldWiki)) {
  throw "Could not find the V1 Wiki Health mapping block. Nothing was changed."
}
$js = $js.Replace($oldWiki, $newWiki)
[IO.File]::WriteAllText((Resolve-Path $backend), $js, (New-Object Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "V1.12 patch installed." -ForegroundColor Green
Write-Host "  - Wiki health now reads Dashboard B51:B54 correctly."
Write-Host "  - WOM/Sheet health allows normal Apps Script scheduling jitter."
Write-Host "  - Route item quantities now come from tracker/backend truth."
Write-Host ""
Write-Host "Next run:" -ForegroundColor Cyan
Write-Host '.\deploy.ps1 -Message "V1.12 trust the numbers accuracy pass"'
