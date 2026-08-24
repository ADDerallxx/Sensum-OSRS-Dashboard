from pathlib import Path

main=Path("Sensum - OSRS Dashboard.js")
qh=Path("QuestHelperSync.js")

m=main.read_text(encoding="utf-8-sig")
old='''function doGet(e) {
  const useV1 = e && e.parameter && String(e.parameter.v || '') === '1';
  const template = useV1 ? 'V1' : 'Index';

  return HtmlService.createTemplateFromFile(template)
    .evaluate()
    .setTitle(useV1 ? 'Sensum OSRS Progression Dashboard' : 'Sensum OSRS Dashboard');
}'''
new='''function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};

  if (String(params.qhdiag || '') === '1') {
    const result = qhRunDiagnosticSync_();
    return ContentService
      .createTextOutput(JSON.stringify(result, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const useV1 = String(params.v || '') === '1';
  const template = useV1 ? 'V1' : 'Index';

  return HtmlService.createTemplateFromFile(template)
    .evaluate()
    .setTitle(useV1 ? 'Sensum OSRS Progression Dashboard' : 'Sensum OSRS Dashboard');
}'''
if old not in m:
    raise SystemExit("Could not find current doGet block; no files changed.")
m=m.replace(old,new,1)
main.write_text(m,encoding="utf-8",newline="\\n")

s=qh.read_text(encoding="utf-8-sig")
marker="function syncQuestHelperRouteRequirements() {"
diag='''function qhRunDiagnosticSync_() {
  const ss = SpreadsheetApp.openById(QH_TRACKER_ID);
  let log = ss.getSheetByName('Quest Helper Diagnostics');
  if (!log) log = ss.insertSheet('Quest Helper Diagnostics');
  log.clearContents();
  log.getRange('A1:B1').setValues([['Stage','Result']]);

  const result = {ok:false, startedAt:new Date().toISOString(), stages:[]};
  function stage_(name, value) {
    result.stages.push({stage:name, result:String(value)});
    log.appendRow([name, String(value)]);
    SpreadsheetApp.flush();
  }

  try {
    stage_('1 - Apps Script entry point', 'OK');

    const dash = ss.getSheetByName('Dashboard');
    if (!dash) throw new Error('Dashboard sheet not found');
    const quests = dash.getRange('B60:B69').getDisplayValues().flat()
      .map(String).map(x=>x.trim()).filter(Boolean);
    stage_('2 - Route quests', quests.length + ' found: ' + quests.join(' | '));

    const tree = qhGetTree_();
    stage_('3 - Quest Helper tree', (tree.paths || []).length + ' Java quest files; commit ' + (tree.sha || ''));

    const syncResult = syncQuestHelperRouteRequirements();
    stage_('4 - Full sync', JSON.stringify(syncResult));

    const recon = ss.getSheetByName(QH_RECON_SHEET);
    if (!recon) throw new Error('Full sync returned but Quest Prep Reconciled was not created');
    stage_('5 - Reconciled sheet', Math.max(0,recon.getLastRow()-1) + ' data rows');

    result.ok = true;
    result.sync = syncResult;
    result.reconciledRows = Math.max(0,recon.getLastRow()-1);
    result.finishedAt = new Date().toISOString();
    return result;
  } catch (e) {
    const message = e && e.stack ? e.stack : String(e);
    stage_('ERROR', message);
    result.error = message;
    result.finishedAt = new Date().toISOString();
    return result;
  }
}

'''
if "function qhRunDiagnosticSync_()" not in s:
    if marker not in s:
        raise SystemExit("Could not find sync function in QuestHelperSync.js; no files changed.")
    s=s.replace(marker,diag+marker,1)
qh.write_text(s,encoding="utf-8",newline="\\n")
print("Quest Helper diagnostic endpoint installed.")
