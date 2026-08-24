from pathlib import Path

p = Path("DashboardV1.js")
s = p.read_text(encoding="utf-8-sig")

old = '''function getV1DashboardState() {
  if (typeof qhMaybeSyncRoute_ === 'function') qhMaybeSyncRoute_();
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);'''
new = '''function getV1DashboardState() {
  if (typeof qhMaybeSyncRoute_ === 'function') {
    const props = PropertiesService.getScriptProperties();
    const lastQh = Number(props.getProperty('QH_ROUTE_SYNC_MS_V2') || 0);
    if (Date.now() - lastQh > 6 * 60 * 60 * 1000) qhMaybeSyncRoute_();
  }
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);'''
if old not in s:
    raise SystemExit("Could not find getV1DashboardState entry block.")
s = s.replace(old, new, 1)

old = '''  const goalsSheet = ss.getSheetByName('Goal Registry');
  const shoppingSheet = ss.getSheetByName('Route Shopping');'''
new = '''  const goalsSheet = ss.getSheetByName('Goal Registry');
  const shoppingSheet = ss.getSheetByName('Route Shopping');
  const reconciledSheet = ss.getSheetByName('Quest Prep Reconciled');'''
if old not in s:
    raise SystemExit("Could not find sheet setup block.")
s = s.replace(old, new, 1)

old = "    shopping: readV1Shopping_(shoppingSheet),"
new = "    shopping: readV1Shopping_(shoppingSheet, reconciledSheet),"
if old not in s:
    raise SystemExit("Could not find shopping payload line.")
s = s.replace(old, new, 1)

start = s.find("function readV1Shopping_(")
if start < 0:
    raise SystemExit("Could not find readV1Shopping_.")

replacement = '''function normalizeV1PrepItem_(name) {
  const aliases = {
    "premade blurb' sp.": "Premade blurb' special",
    "bread (unnoted)": "Bread",
    "trout (unnoted)": "Trout",
    "rope, multiple in case you fail an agility check": "Rope"
  };
  const raw = String(name || '').trim();
  return aliases[raw.toLowerCase()] || raw;
}

function v1PrepKey_(quest, item) {
  return String(quest || '').trim().toLowerCase() + '|' +
    normalizeV1PrepItem_(item).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function readV1Shopping_(wikiSheet, reconciledSheet) {
  const out = [];
  const seen = new Set();

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
      if (/Obtain/i.test(prepClass)) acquisition = 'Obtainable';
      if (/Recommended/i.test(prepClass)) acquisition = prepClass;

      let type = mandatory ? 'Direct' : (wikiType || qhStatus || 'Direct');
      if (qhStatus === 'RECOMMENDED') type = 'Recommended';
      if (wikiConfirmedMidQuest) type = 'Obtain During Quest';

      const key = v1PrepKey_(quest, item);
      seen.add(key);
      out.push({
        item,
        qty,
        quests: quest,
        acquisition,
        type,
        notes,
        source: sourceAgreement || 'Quest Helper'
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
          const key = v1PrepKey_(quest, item);
          if (seen.has(key)) return;

          seen.add(key);
          out.push({
            item,
            qty: r[1] || '1',
            quests: quest,
            acquisition,
            type: 'Direct',
            source: 'Wiki fallback'
          });
        });
      }
    }
  }

  return out;
}
'''

s = s[:start] + replacement
p.write_text(s, encoding="utf-8")
print("V1.14 reconciled Route Prep patch applied successfully.")
