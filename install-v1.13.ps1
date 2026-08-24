$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8([string]$path) {
  return [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8)
}
function Write-Utf8([string]$path, [string]$text) {
  [System.IO.File]::WriteAllText((Resolve-Path $path), $text, $utf8)
}

$v1 = ".\V1.html"
$backend = ".\DashboardV1.js"

if (!(Test-Path $v1)) { throw "V1.html not found." }
if (!(Test-Path $backend)) { throw "DashboardV1.js not found." }

# -------------------------
# V1.html
# -------------------------
$html = Read-Utf8 $v1
$html = $html.Replace("V1.12", "V1.13")

$oldPrep = "    const acq=String(i.acquisition||'').toLowerCase(),type=String(i.type||'').toLowerCase(),item={name:i.item,qty:i.qty};"
$newPrep = @"
    const acq=String(i.acquisition||'').toLowerCase(),type=String(i.type||'').toLowerCase();
    const componentLabel=i.componentOf||i.alternativeOf||'';
    const item={name:i.item+(componentLabel?' (for '+componentLabel+')':''),qty:i.qty};
"@.TrimEnd()

if (!$html.Contains($oldPrep)) {
  throw "Could not find prepForQuest item mapping in V1.html."
}
$html = $html.Replace($oldPrep, $newPrep)

$splitMarker = "function splitQuests(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}"
$altHelper = @"
function splitQuests(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
function altDisplayName(i){
  const parent=i.componentOf||i.alternativeOf||'';
  return parent ? i.item+' (for '+parent+')' : i.item;
}
"@.TrimEnd()

if (!$html.Contains($splitMarker)) {
  throw "Could not find splitQuests marker in V1.html."
}
$html = $html.Replace($splitMarker, $altHelper)

$oldAlt = "alt.map(i=>chipHtml({name:i.item,qty:i.qty},'alt')).join('')"
$newAlt = "alt.map(i=>chipHtml({name:altDisplayName(i),qty:i.qty},'alt')).join('')"
if (!$html.Contains($oldAlt)) {
  throw "Could not find alternative-list renderer in V1.html."
}
$html = $html.Replace($oldAlt, $newAlt)

Write-Utf8 $v1 $html

# -------------------------
# DashboardV1.js
# -------------------------
$js = Read-Utf8 $backend

# Replace fragile hard-coded Wiki health block with label-based lookup.
$healthPattern = "wikiHealth:\s*\{\s*ok:\s*dash\.getRange\('B\d+'\)\.getDisplayValue\(\),\s*review:\s*dash\.getRange\('B\d+'\)\.getDisplayValue\(\),\s*missing:\s*dash\.getRange\('B\d+'\)\.getDisplayValue\(\),\s*lastCheck:\s*dash\.getRange\('B\d+'\)\.getDisplayValue\(\)\s*\}"
if ($js -notmatch $healthPattern) {
  throw "Could not find Wiki Health mapping in DashboardV1.js."
}
$js = [regex]::Replace($js, $healthPattern, "wikiHealth: readV1WikiHealth_(dash)", 1)

$goalMarker = "function setV1Goal(goalName) {"
$healthHelper = @'
function readV1WikiHealth_(dash) {
  function valueNextTo_(label) {
    const found = dash.createTextFinder(label).matchEntireCell(true).findNext();
    return found ? found.offset(0, 1).getDisplayValue() : '';
  }
  return {
    ok: valueNextTo_('OK'),
    review: valueNextTo_('Needs Review'),
    missing: valueNextTo_('No Cache / Incomplete'),
    lastCheck: valueNextTo_('Last Wiki Check')
  };
}

function setV1Goal(goalName) {
'@

if (!$js.Contains($goalMarker)) {
  throw "Could not find setV1Goal marker in DashboardV1.js."
}
$js = $js.Replace($goalMarker, $healthHelper)

# readV1Shopping_ is the final function in DashboardV1.js.
$shopStart = $js.IndexOf("function readV1Shopping_(sheet) {")
if ($shopStart -lt 0) {
  throw "Could not find readV1Shopping_ in DashboardV1.js."
}

$newShop = @'
function readV1Shopping_(sheet) {
  const lastRow = Math.min(sheet.getLastRow(), 500);

  // Authoritative top-level, normalized/deduplicated route requirements.
  const values = sheet.getRange(1, 1, Math.min(lastRow, 250), 6).getDisplayValues();
  const headerIndex = values.findIndex(r => r[0] === 'Item' && r[1] === 'Min Qty');
  if (headerIndex < 0) return [];

  const out = [];
  for (let i = headerIndex + 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) break;
    out.push({
      item: r[0],
      qty: r[1],
      quests: r[2],
      acquisition: r[3],
      type: r[4]
    });
  }

  // Preserve nested Wiki hierarchy as alternative/component detail.
  // H:O = combined line, quest, raw line, depth, item, qty, acquisition, type.
  if (lastRow >= 5) {
    const detail = sheet.getRange(5, 8, lastRow - 4, 8).getDisplayValues();
    const stacks = {};

    detail.forEach(r => {
      const quest = r[1];
      const raw = r[2];
      const depth = Number(r[3] || 0);
      const item = r[4];
      const qty = r[5] || '1';
      const acquisition = r[6] || 'Bring / Buy';

      if (!quest || !raw || !depth) return;
      if (!stacks[quest]) stacks[quest] = {};
      const stack = stacks[quest];

      if (depth === 1) {
        if (item) stack[1] = item;
        Object.keys(stack).forEach(k => { if (Number(k) > 1) delete stack[k]; });
        return;
      }

      // Skill-template lines can contain a [[boostable]] link but are not items.
      if (!item || (raw.indexOf('{{SCP') >= 0 && String(item).toLowerCase() === 'boostable')) {
        return;
      }

      const root = stack[1] || '';
      const parent = stack[depth - 1] || root;

      stack[depth] = item;
      Object.keys(stack).forEach(k => { if (Number(k) > depth) delete stack[k]; });

      out.push({
        item: item,
        qty: qty,
        quests: quest,
        acquisition: acquisition,
        type: 'Alternative / Component',
        alternativeOf: root,
        componentOf: parent,
        depth: depth,
        raw: raw
      });
    });
  }

  return out;
}
'@

$js = $js.Substring(0, $shopStart) + $newShop + "`n"
Write-Utf8 $backend $js

Write-Host ""
Write-Host "V1.13 patch installed." -ForegroundColor Green
Write-Host "Backend spreadsheet normalization was already updated."
Write-Host "Wiki Health now uses label lookup instead of row numbers."
Write-Host "Nested Wiki recipe/component items are preserved as alternatives."
Write-Host ""
Write-Host "Deploy with:"
Write-Host ".\deploy.ps1 -Message `"V1.13 hierarchy-aware quest prep and health fix`""
