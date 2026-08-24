from pathlib import Path

p = Path("V1.html")
s = p.read_text(encoding="utf-8-sig")
s = s.replace("V1.13", "V1.13.2")

old = """  const rows=s.shopping||[], steps=routeStepMap(s), groups=new Map(), seen=new Map(), alt=[];
  rows.forEach(i=>{
    const a=String(i.acquisition||'').toLowerCase(),t=String(i.type||'').toLowerCase();
    if(t.includes('choice')||t.includes('alternative')){alt.push(i);return}
    const quests=splitQuests(i.quests);"""

new = """  const rows=s.shopping||[], steps=routeStepMap(s), groups=new Map(), seen=new Map(), altGroups=new Map();
  rows.forEach(i=>{
    const a=String(i.acquisition||'').toLowerCase(),t=String(i.type||'').toLowerCase();
    if(t.includes('choice')||t.includes('alternative')){
      const altQuests=splitQuests(i.quests);
      const altOrdered=(altQuests.length?altQuests:['Other']).sort((a,b)=>(steps.get(a.toLowerCase())||999)-(steps.get(b.toLowerCase())||999));
      const altPrimary=altOrdered[0]||'Other';
      if(!altGroups.has(altPrimary))altGroups.set(altPrimary,[]);
      altGroups.get(altPrimary).push({...i,quest:altPrimary});
      if(!groups.has(altPrimary))groups.set(altPrimary,[]);
      return;
    }
    const quests=splitQuests(i.quests);"""

if old not in s:
    raise SystemExit("Could not find V1.13 shopping parser block. No changes made.")
s = s.replace(old, new, 1)

old2 = """    html+='</div></div>';
  });

  if(alt.length){
    html+=`<div class="shopGroup"><div class="shopGroupTitle"><span>↔ Choice / Alternative</span><span class="shopCount">${alt.length}</span></div><div class="obtainList">${alt.map(i=>chipHtml({name:altDisplayName(i),qty:i.qty},'alt')).join('')}</div></div>`;
  }
  return html;"""

new2 = """    const questAlt=altGroups.get(quest)||[];
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

  return html;"""

if old2 not in s:
    raise SystemExit("Could not find V1.13 alternative display block. No changes made.")
s = s.replace(old2, new2, 1)

marker = "    .prepBadge.obtain{background:#dcebd9;color:#285b30;border-color:#65936b}"
styles = marker + """
    .prepBadge.altBadge{background:#dce7ed;color:#2f596e;border-color:#96afbd}
    .questAltBlock{border-top:1px dashed #c7b496;background:#f7f1e8}
    .questAltTitle{padding:8px 10px 5px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:#607989}
    .checkRow.altRow{background:#edf3f6}
    .checkRow.altRow .itemName{color:#294e61}"""
if marker not in s:
    raise SystemExit("Could not find V1.html style marker. No changes made.")
s = s.replace(marker, styles, 1)

p.write_text(s, encoding="utf-8", newline="\n")
print("V1.13.2 patch applied successfully.")
