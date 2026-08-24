from pathlib import Path

p = Path("QuestHelperSync.js")
s = p.read_text(encoding="utf-8-sig")

old = """function qhMaybeSyncRoute_() {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('QH_ROUTE_SYNC_MS_V2') || 0);
  const maxAgeMs = 6 * 60 * 60 * 1000;
  if (Date.now() - last < maxAgeMs) return;
  try {
    syncQuestHelperRouteRequirements();
  } catch (e) {
    console.error('Quest Helper sync failed: ' + (e && e.message ? e.message : e));
  }
}"""

new = """function qhMaybeSyncRoute_() {
  const ss = SpreadsheetApp.openById(QH_TRACKER_ID);
  let log = ss.getSheetByName('Quest Helper Diagnostics');
  if (!log) log = ss.insertSheet('Quest Helper Diagnostics');

  log.clearContents();
  log.getRange('A1:B1').setValues([['Stage','Result']]);
  log.appendRow(['1 - Entry point','OK']);
  SpreadsheetApp.flush();

  try {
    const dash = ss.getSheetByName('Dashboard');
    const quests = dash ? dash.getRange('B60:B69').getDisplayValues().flat().map(String).map(x => x.trim()).filter(Boolean) : [];
    log.appendRow(['2 - Route quests', quests.length + ' found']);
    SpreadsheetApp.flush();

    const result = syncQuestHelperRouteRequirements();
    log.appendRow(['3 - Full sync', JSON.stringify(result)]);
    SpreadsheetApp.flush();

    const recon = ss.getSheetByName(QH_RECON_SHEET);
    log.appendRow(['4 - Reconciled sheet', recon ? (Math.max(0, recon.getLastRow() - 1) + ' rows') : 'NOT CREATED']);
    SpreadsheetApp.flush();
  } catch (e) {
    const message = e && e.stack ? e.stack : String(e);
    log.appendRow(['ERROR', message]);
    SpreadsheetApp.flush();
    console.error('Quest Helper sync failed: ' + message);
  }
}"""

if old not in s:
    raise SystemExit("Could not find qhMaybeSyncRoute_ block. No changes made.")

s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
print("Quest Helper runtime diagnostic installed.")
