$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read-Utf8([string]$path) { return [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8) }
function Write-Utf8([string]$path, [string]$text) { [System.IO.File]::WriteAllText((Resolve-Path $path), $text, $utf8) }

$file = ".\V1.html"
if (!(Test-Path $file)) { throw "V1.html not found." }

$html = Read-Utf8 $file
$html = $html.Replace("V1.13", "V1.13.1")

$oldStart = "  const rows=s.shopping||[], steps=routeStepMap(s), groups=new Map(), seen=new Map(), alt=[];"
$newStart = "  const rows=s.shopping||[], steps=routeStepMap(s), groups=new Map(), seen=new Map(), altGroups=new Map();"
if (!$html.Contains($oldStart)) { throw "Could not find route shopping start block." }
$html = $html.Replace($oldStart, $newStart)

$oldAltRoute = @"
    if(t.includes('choice')||t.includes('alternative')){alt.push(i);return}
    const quests=splitQuests(i.quests);
"@.TrimEnd()

$newAltRoute = @"
    if(t.includes('choice')||t.includes('alternative')){
      const altQuests=splitQuests(i.quests);
      const altOrdered=(altQuests.length?altQuests:['Other']).sort((a,b)=>(steps.get(a.toLowerCase())||999)-(steps.get(b.toLowerCase())||999));
      const altPrimary=altOrdered[0]||'Other';
      if(!altGroups.has(altPrimary))altGroups.set(altPrimary,[]);
      altGroups.get(altPrimary).push({...i,quest:altPrimary});
      if(!groups.has(altPrimary))groups.set(altPrimary,[]);
      return;
    }
    const quests=splitQuests(i.quests);
"@.TrimEnd()

if (!$html.Contains($oldAltRoute)) { throw "Could not find alternative routing block." }
$html = $html.Replace($oldAltRoute, $newAltRoute)

$oldGroupEnd = @"
    html+='</div></div>';
  });

  if(alt.length){
    html+=`<div class="shopGroup"><div class="shopGroupTitle"><span>↔ Choice / Alternative</span><span class="shopCount">${alt.length}</span></div><div class="obtainList">${alt.map(i=>chipHtml({name:altDisplayName(i),qty:i.qty},'alt')).join('')}</div></div>`;
  }
  return html;
"@.TrimEnd()

$newGroupEnd = @"
    const questAlt=altGroups.get(quest)||[];
    if(questAlt.length){
      html+=`<div class="questAltBlock"><div class="questAltTitle">Alternative / recipe options</div>`;
      questAlt.forEach(i=>{
        const key=checklistKey(i),checked=isChecked(i);
        html+=`<label class="checkRow altRow ${checked?'done':''}">
          <input type="checkbox" ${checked?'checked':''} onchange="toggleShopV18(this,'${esc(key)}')">
          <span class="itemName">${esc(altDisplayName(i))}<span class="alsoNeeded">Optional path - not counted in route completion</span></span>
          <span>×${esc(i.qty||1)}</span>
          <span>${checked?'<span class="prepBadge obtain">✓ Done</span>':'<span class="prepBadge altBadge">Option</span>'}</span>
        </label>`;
      });
      html+='</div>';
    }
    html+='</div></div>';
  });

  return html;
"@.TrimEnd()

if (!$html.Contains($oldGroupEnd)) { throw "Could not find quest group ending block." }
$html = $html.Replace($oldGroupEnd, $newGroupEnd)

$styleMarker = "    .prepBadge.obtain{background:#dcebd9;color:#285b30;border-color:#65936b}"
$styleAdd = @"
    .prepBadge.obtain{background:#dcebd9;color:#285b30;border-color:#65936b}
    .prepBadge.altBadge{background:#dce7ed;color:#2f596e;border-color:#96afbd}
    .questAltBlock{border-top:1px dashed #c7b496;background:#f7f1e8}
    .questAltTitle{padding:8px 10px 5px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:#607989}
    .checkRow.altRow{background:#edf3f6}
    .checkRow.altRow .itemName{color:#294e61}
"@.TrimEnd()

if (!$html.Contains($styleMarker)) { throw "Could not find prep badge style marker." }
$html = $html.Replace($styleMarker, $styleAdd)

Write-Utf8 $file $html

Write-Host ""
Write-Host "V1.13.1 installed." -ForegroundColor Green
Write-Host "Alternative and recipe-component items now appear inside each quest's Route Prep checklist."
Write-Host "They have checkboxes but do not inflate the required-route completion percentage."
Write-Host ""
Write-Host "Deploy with:"
Write-Host ".\deploy.ps1 -Message `"V1.13.1 show complete quest prep alternatives`""
