from pathlib import Path

# ---------- DashboardV1.js ----------
p = Path("DashboardV1.js")
s = p.read_text(encoding="utf-8-sig")

start = s.find("function readV1Shopping_(")
if start < 0:
    raise SystemExit("Could not find readV1Shopping_ in DashboardV1.js")

new_reader = '''function readV1Shopping_(wikiSheet, reconciledSheet) {
  const out = [];
  const byKey = new Map();

  function addOrMerge_(row) {
    const key = v1PrepKey_(row.quests, row.item);
    if (!byKey.has(key)) {
      byKey.set(key, row);
      out.push(row);
      return;
    }

    const prev = byKey.get(key);
    const a = Number(prev.qty || 0);
    const b = Number(row.qty || 0);
    if (b > a) prev.qty = row.qty;

    if (/obtain/i.test(String(row.acquisition || '')) &&
        !/obtain/i.test(String(prev.acquisition || ''))) {
      if (!prev.mandatory || prev.qhStatus !== 'REQUIRED') {
        prev.acquisition = row.acquisition;
      }
    }

    if (row.source && String(prev.source || '').indexOf(row.source) < 0) {
      prev.source = [prev.source, row.source].filter(Boolean).join(' + ');
    }
    if (!prev.notes && row.notes) prev.notes = row.notes;
  }

  if (reconciledSheet && reconciledSheet.getLastRow() > 1) {
    const rows = reconciledSheet
      .getRange(2, 1, Math.min(reconciledSheet.getLastRow() - 1, 500), 15)
      .getDisplayValues();

    rows.forEach(r => {
      const quest = r[1];
      const item = normalizeV1PrepItem_(r[2]);
      const qty = r[3] || '1';
      const prepClass = r[4];
      const mandatory = String(r[5]).toUpperCase() === 'TRUE';
      const reusable = String(r[6]).toUpperCase() === 'TRUE';
      const qhStatus = r[7];
      const wikiType = r[10];
      const sourceAgreement = r[11];
      const notes = r[12];

      if (!quest || !item) return;

      const wikiConfirmedMidQuest =
        prepClass === 'Created / Obtained During Quest' &&
        sourceAgreement !== 'QH only';

      if (!(mandatory || qhStatus === 'RECOMMENDED' || wikiConfirmedMidQuest)) return;

      let acquisition = 'Bring / Buy';
      if (/Created/i.test(prepClass)) acquisition = 'Created During Quest';
      else if (/Obtain/i.test(prepClass)) acquisition = 'Obtain During Quest';
      else if (/Recommended/i.test(prepClass)) acquisition = prepClass;

      let type = mandatory ? 'Direct' : (wikiType || qhStatus || 'Direct');
      if (qhStatus === 'RECOMMENDED') type = 'Recommended';
      if (wikiConfirmedMidQuest) type = 'Quest Progress Item';

      addOrMerge_({
        item,
        qty,
        quests: quest,
        acquisition,
        type,
        notes,
        source: sourceAgreement || 'Quest Helper',
        prepClass,
        mandatory,
        reusable,
        qhStatus
      });
    });
  }

  if (wikiSheet) {
    const lastRow = Math.min(wikiSheet.getLastRow(), 500);
    const values = wikiSheet.getRange(1, 1, Math.min(lastRow, 250), 6).getDisplayValues();
    const headerIndex = values.findIndex(r => r[0] === 'Item' && r[1] === 'Min Qty');

    if (headerIndex >= 0) {
      for (let i = headerIndex + 1; i < values.length; i++) {
        const r = values[i];
        if (!r[0]) break;

        const item = normalizeV1PrepItem_(r[0]);
        const quests = String(r[2] || '').split(',').map(x => x.trim()).filter(Boolean);
        const acquisition = r[3] || 'Bring / Buy';
        const type = r[4] || 'Direct';

        if (/choice|alternative|component/i.test(type)) continue;

        quests.forEach(quest => {
          addOrMerge_({
            item,
            qty: r[1] || '1',
            quests: quest,
            acquisition: /obtain/i.test(acquisition) ? 'Obtain During Quest' : acquisition,
            type: 'Direct',
            source: 'Wiki direct fallback',
            prepClass: /obtain/i.test(acquisition) ? 'Obtain During Quest' : 'Bring / Buy',
            mandatory: true,
            reusable: false,
            qhStatus: 'WIKI'
          });
        });
      }
    }
  }

  return out;
}
'''

s = s[:start] + new_reader + "\n"
p.write_text(s, encoding="utf-8", newline="\n")

# ---------- V1.html ----------
p = Path("V1.html")
h = p.read_text(encoding="utf-8-sig")

style_marker = "    .prepBadge.altBadge{background:#dce7ed;color:#2f596e;border-color:#96afbd}"
style_add = '''    .prepBadge.altBadge{background:#dce7ed;color:#2f596e;border-color:#96afbd}
    .prepBadge.createBadge{background:#e6def0;color:#563b6d;border-color:#9f88b4}
    .prepBadge.recommendBadge{background:#e9e3d5;color:#67573d;border-color:#afa086}
    .checkRow.createRow{background:#f3eef7}
    .checkRow.recommendRow{background:#f5f2ea}
    .nonBlockingMeta{display:block;margin-top:4px;font-size:9px;color:#796b58;font-weight:800}'''
if style_marker not in h:
    raise SystemExit("Could not find prep badge style marker in V1.html")
h = h.replace(style_marker, style_add, 1)

start = h.find("function routeShoppingHtml(s){")
end = h.find("function toggleShopV18", start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate routeShoppingHtml in V1.html")

new_route = '''function routeShoppingHtml(s){
  const rows=s.shopping||[], steps=routeStepMap(s), groups=new Map();

  const itemQuestMap=new Map();
  rows.forEach(i=>{
    const n=normalizedItemName(i.item);
    if(!itemQuestMap.has(n))itemQuestMap.set(n,[]);
    splitQuests(i.quests).forEach(q=>itemQuestMap.get(n).push(q));
  });

  rows.forEach(i=>{
    const quests=splitQuests(i.quests);
    const ordered=(quests.length?quests:['Other']).sort((a,b)=>(steps.get(a.toLowerCase())||999)-(steps.get(b.toLowerCase())||999));
    ordered.forEach(quest=>{
      if(!groups.has(quest))groups.set(quest,[]);
      const acq=String(i.acquisition||'').toLowerCase();
      const prep=String(i.prepClass||'').toLowerCase();
      const status=String(i.qhStatus||'').toUpperCase();
      const mandatory=i.mandatory===true || String(i.mandatory).toUpperCase()==='TRUE';

      const created=acq.includes('created');
      const obtain=!created && acq.includes('obtain');
      const recommended=status==='RECOMMENDED' || prep.includes('recommended') || String(i.type||'').toLowerCase()==='recommended';
      const blocksReady=mandatory && !obtain && !created && !recommended;

      const allUses=[...new Set(itemQuestMap.get(normalizedItemName(i.item))||[])];
      const also=allUses.filter(q=>q.toLowerCase()!==quest.toLowerCase());

      groups.get(quest).push({...i,quest,also,obtain,created,recommended,blocksReady,mandatory});
    });
  });

  const orderedGroups=[...groups.entries()].sort((a,b)=>{
    const sa=steps.get(a[0].toLowerCase())||999,sb=steps.get(b[0].toLowerCase())||999;
    return sa-sb || a[0].localeCompare(b[0]);
  });

  const blockingRows=[];
  orderedGroups.forEach(([,items])=>items.forEach(i=>{if(i.blocksReady)blockingRows.push(i)}));
  const total=blockingRows.length;
  const done=blockingRows.filter(isChecked).length;
  const pct=total?Math.round(done/total*100):100;
  $('shopProgress').textContent=`${done} / ${total} pre-quest items · ${pct}%`;

  let html=`<div class="shopProgressBar"><div class="shopProgressFill" style="width:${pct}%"></div></div>
    <div class="obtainNote">Bring/Buy items determine readiness. Obtain, create, and recommended items remain in the checklist for quest tracking.</div>`;

  orderedGroups.forEach(([quest,items])=>{
    items.sort((a,b)=>{
      const rank=x=>x.blocksReady?1:x.obtain?2:x.created?3:x.recommended?4:5;
      return rank(a)-rank(b) || String(a.item).localeCompare(String(b.item));
    });

    const required=items.filter(i=>i.blocksReady);
    const qDone=required.filter(isChecked).length;
    const complete=!required.length || qDone===required.length;
    const step=steps.get(quest.toLowerCase());

    html+=`<div class="questShopGroup ${complete?'complete':''}"><div class="questShopHead">${step?`<span class="questStep">Step ${step}</span>`:''}<span class="questShopTitle">${esc(quest)}</span><span class="questDone">${complete?'✓ Prep ready':`${qDone}/${required.length} prep`}</span></div><div class="questShopRows">`;

    items.forEach(i=>{
      const key=checklistKey(i),checked=isChecked(i);
      let rowCls='',badge='',meta='';
      if(i.created){
        rowCls='createRow';
        badge='<span class="prepBadge createBadge">Create</span>';
        meta='<span class="nonBlockingMeta">Created during quest · does not block starting prep</span>';
      }else if(i.obtain){
        rowCls='obtainRow';
        badge='<span class="prepBadge obtain">Obtain</span>';
        meta='<span class="nonBlockingMeta">Obtain during quest · does not block starting prep</span>';
      }else if(i.recommended){
        rowCls='recommendRow';
        badge='<span class="prepBadge recommendBadge">Recommended</span>';
        meta='<span class="nonBlockingMeta">Optional/recommended · does not block starting prep</span>';
      }else{
        badge='<span class="prepBadge bring">Bring</span>';
      }

      if(checked)badge='<span class="prepBadge obtain">✓ Done</span>';

      html+=`<label class="checkRow ${rowCls} ${checked?'done':''}">
        <input type="checkbox" ${checked?'checked':''} onchange="toggleShopV18(this,'${esc(key)}')">
        <span class="itemName">${esc(i.item)}${i.also&&i.also.length?`<span class="alsoNeeded">Also used: ${esc(i.also.join(', '))}</span>`:''}${meta}</span>
        <span>×${esc(i.qty||1)}</span>
        <span>${badge}</span>
      </label>`;
    });

    html+='</div></div>';
  });

  return html;
}
'''

h = h[:start] + new_route + h[end:]

for old in ["V1.14", "V1.13.2", "V1.13.1", "V1.13", "V1.12"]:
    if old in h:
        h = h.replace(old, "V1.14.1", 1)
        break

p.write_text(h, encoding="utf-8", newline="\n")
print("V1.14.1 accuracy/UI pass applied successfully.")
