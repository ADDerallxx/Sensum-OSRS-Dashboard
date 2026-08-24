from pathlib import Path

p = Path("DashboardV1.js")
s = p.read_text(encoding="utf-8-sig")

# Normalize the Wiki torch variant to the Quest Helper player-facing label.
old_alias = '    "rope, multiple in case you fail an agility check": "Rope"'
new_alias = '    "rope, multiple in case you fail an agility check": "Rope",\n    "torch": "Lit torch or candle"'
if old_alias in s:
    s = s.replace(old_alias, new_alias, 1)

start = s.find("function readV1Shopping_(")
if start < 0:
    raise SystemExit("Could not find readV1Shopping_.")

reader = '''function readV1Shopping_(wikiSheet, reconciledSheet) {
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

    if (row.source && String(prev.source || '').indexOf(row.source) < 0) {
      prev.source = [prev.source, row.source].filter(Boolean).join(' + ');
    }
    if (!prev.notes && row.notes) prev.notes = row.notes;

    if (/obtain/i.test(String(row.acquisition || '')) &&
        /created/i.test(String(prev.acquisition || ''))) {
      prev.acquisition = 'Obtain During Quest';
      prev.prepClass = 'Obtain During Quest';
    }
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
      const wikiAcquisition = r[9];
      const sourceAgreement = r[11];
      const notes = r[12];

      if (!quest || !item) return;

      const wikiConfirmedMidQuest =
        prepClass === 'Created / Obtained During Quest' &&
        sourceAgreement !== 'QH only';

      if (!(mandatory || qhStatus === 'RECOMMENDED' || wikiConfirmedMidQuest)) return;

      let acquisition = 'Bring / Buy';
      if (/obtain/i.test(wikiAcquisition) && /Created \/ Obtained/i.test(prepClass)) {
        acquisition = 'Obtain During Quest';
      } else if (/Created/i.test(prepClass)) {
        acquisition = 'Created During Quest';
      } else if (/Obtain/i.test(prepClass)) {
        acquisition = 'Obtain During Quest';
      } else if (/Recommended/i.test(prepClass)) {
        acquisition = prepClass;
      }

      addOrMerge_({
        item, qty, quests: quest, acquisition,
        type: qhStatus === 'RECOMMENDED' ? 'Recommended' :
              (wikiConfirmedMidQuest ? 'Quest Progress Item' : 'Direct'),
        notes, source: sourceAgreement || 'Quest Helper',
        prepClass, mandatory, reusable, qhStatus
      });
    });
  }

  if (wikiSheet && wikiSheet.getLastRow() >= 5) {
    const lastRow = Math.min(wikiSheet.getLastRow(), 500);
    const detail = wikiSheet.getRange(5, 8, lastRow - 4, 8).getDisplayValues();

    detail.forEach(r => {
      const quest = String(r[1] || '').trim();
      const depth = Number(r[3] || 0);
      const item = normalizeV1PrepItem_(r[4]);
      const qty = r[5] || '1';
      const acquisition = r[6] || 'Bring / Buy';
      const type = r[7] || 'Direct';

      if (!quest || !item) return;
      if (depth !== 1) return;
      if (/choice|alternative|component/i.test(type)) return;

      addOrMerge_({
        item, qty, quests: quest,
        acquisition: /obtain/i.test(acquisition) ? 'Obtain During Quest' : acquisition,
        type: 'Direct', source: 'Wiki direct fallback',
        prepClass: /obtain/i.test(acquisition) ? 'Obtain During Quest' : 'Bring / Buy',
        mandatory: true, reusable: false, qhStatus: 'WIKI'
      });
    });
  }

  return out;
}
'''

s = s[:start] + reader + "\n"
p.write_text(s, encoding="utf-8", newline="\n")

p = Path("V1.html")
h = p.read_text(encoding="utf-8-sig")
h = h.replace("V1.14.3", "V1.14.4")

marker = "function prepForQuest(s,quest){"
func_start = h.find(marker)
func_end = h.find("function chipHtml", func_start)
if func_start < 0 or func_end < 0:
    raise SystemExit("Could not isolate prepForQuest.")

prep_func = '''function prepForQuest(s,quest){
  const rows=(s.shopping||[]).filter(i=>String(i.quests||'').toLowerCase().split(',').map(x=>x.trim()).includes(String(quest||'').toLowerCase()));
  const groups={buy:[],obtain:[],alt:[]};
  const choiceModel=(typeof prepChoiceModelV1143==='function') ? prepChoiceModelV1143(quest,rows) : {used:new Set(),choices:[]};

  rows.forEach(i=>{
    if(choiceModel.used && choiceModel.used.has(i)) return;
    const c=(typeof classifyPrepItemV1142==='function') ? classifyPrepItemV1142(i) : null;
    const item={name:i.item,qty:i.qty};

    if(c){
      if(c.recommended) return;
      if(c.obtain||c.created) groups.obtain.push(item);
      else groups.buy.push(item);
      return;
    }

    const acq=String(i.acquisition||'').toLowerCase();
    if(acq.includes('obtain')||acq.includes('created'))groups.obtain.push(item);
    else groups.buy.push(item);
  });

  if(choiceModel.choices){
    choiceModel.choices.forEach(ch=>{
      groups.alt.push({
        name:ch.finished.item+' OR '+ch.components.map(x=>x.item).join(' + '),
        qty:1
      });
    });
  }

  return groups;
}
'''

h = h[:func_start] + prep_func + h[func_end:]
p.write_text(h, encoding="utf-8", newline="\n")
print("V1.14.4 final Route Prep integrity patch applied.")