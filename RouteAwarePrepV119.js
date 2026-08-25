// V1.19 Route-Aware Quest Prep

function qhV119RouteStep_(ss, quest) {
  const dash = ss.getSheetByName('Dashboard');
  if (!dash) return 999;
  const vals = dash.getRange('B60:B69').getDisplayValues().flat();
  const target = String(quest || '').trim().toLowerCase();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i] || '').trim().toLowerCase() === target) return i + 1;
  }
  return 999;
}

function qhV119ApplyRoutePolicies_(ss, now, commit) {
  ss = ss || SpreadsheetApp.openById(QH_TRACKER_ID);
  now = now || new Date();
  commit = commit || 'route-policy-v1.19';

  const sh = ss.getSheetByName(QH_RECON_SHEET);
  if (!sh || sh.getLastRow() < 1) return {ok:false, reason:'Quest Prep Reconciled sheet not found'};

  const values = sh.getDataRange().getValues();
  if (!values.length) return {ok:false, reason:'Quest Prep Reconciled is empty'};

  const h = values[0].map(x => String(x || '').trim());
  const col = name => h.findIndex(x => x.toLowerCase() === name.toLowerCase());

  const cRoute = col('Route Step');
  const cQuest = col('Quest');
  const cItem = col('Item');
  const cQty = col('Qty');
  const cClass = col('Prep Class');
  const cMandatory = col('Mandatory');
  const cReusable = col('Reusable');
  const cStatus = col('QH Status');
  const cVar = col('QH Variable');
  const cWikiAcq = col('Wiki Acquisition');
  const cWikiType = col('Wiki Requirement Type');
  const cAgreement = col('Source Agreement');
  const cNotes = col('Notes / Tooltip');
  const cCommit = col('QH Commit');
  const cWhen = col('Last Reconciled');

  if ([cQuest,cItem,cClass,cMandatory].some(i => i < 0)) {
    throw new Error('V1.19 could not locate required Quest Prep Reconciled columns.');
  }

  const targetQuest = 'The Fremennik Trials';
  const targetNorm = targetQuest.toLowerCase();

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][cQuest] || '').trim().toLowerCase() !== targetNorm) continue;

    const variable = cVar >= 0 ? String(values[r][cVar] || '').trim().toLowerCase() : '';
    const item = String(values[r][cItem] || '').trim().toLowerCase();
    const isCraftBranchTool =
      variable === 'knife' || variable === 'axe' ||
      item === 'knife' || item === 'axe' || item === 'woodcutting axe';

    if (isCraftBranchTool) {
      values[r][cClass] = 'Alternative / Optional';
      values[r][cMandatory] = false;
      if (cAgreement >= 0) values[r][cAgreement] = 'Conditional route - Wiki';
      if (cNotes >= 0) {
        values[r][cNotes] = 'Only needed if crafting the lyre. Preferred no-skill route: obtain a lyre drop in Rellekka.';
      }
    }
  }

  const routeStep = qhV119RouteStep_(ss, targetQuest);

  function ensureRouteItem(item, qty, prepClass, mandatory, wikiAcq, wikiType, notes, variable) {
    const exists = values.slice(1).some(r =>
      String(r[cQuest] || '').trim().toLowerCase() === targetNorm &&
      String(r[cItem] || '').trim().toLowerCase() === String(item).toLowerCase() &&
      String(r[cClass] || '').trim() === prepClass
    );
    if (exists) return;

    const row = new Array(h.length).fill('');
    if (cRoute >= 0) row[cRoute] = routeStep;
    row[cQuest] = targetQuest;
    row[cItem] = item;
    if (cQty >= 0) row[cQty] = qty;
    row[cClass] = prepClass;
    row[cMandatory] = !!mandatory;
    if (cReusable >= 0) row[cReusable] = false;
    if (cStatus >= 0) row[cStatus] = 'ROUTE';
    if (cVar >= 0) row[cVar] = variable || '';
    if (cWikiAcq >= 0) row[cWikiAcq] = wikiAcq;
    if (cWikiType >= 0) row[cWikiType] = wikiType;
    if (cAgreement >= 0) row[cAgreement] = 'Wiki route policy';
    if (cNotes >= 0) row[cNotes] = notes;
    if (cCommit >= 0) row[cCommit] = commit;
    if (cWhen >= 0) row[cWhen] = now;
    values.push(row);
  }

  ensureRouteItem(
    'Lyre', 1, 'Obtain During Quest', true,
    'Obtain as a drop from Lanzig, Borrokar, Lensa, or Freidir',
    'Choice / Alternative',
    'Preferred route avoids 25 Fletching, 40 Woodcutting, 40 Crafting, axe, and knife.',
    'lyre'
  );

  ensureRouteItem(
    'Beer', 1, 'Obtain During Quest', true,
    'Obtainable during the quest',
    'Direct',
    'Pick up/obtain during the Manni trial; do not buy before starting.',
    'beer'
  );

  sh.clearContents();
  sh.getRange(1,1,values.length,h.length).setValues(values);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1,h.length);
  SpreadsheetApp.flush();

  return {ok:true, quest:targetQuest, rows:values.length-1};
}

function qhV119ContinueAudit_() {
  const ss = SpreadsheetApp.openById(QH_TRACKER_ID);
  let sh = ss.getSheetByName('Quest Data Audit');
  let cursor = sh ? Math.max(0, sh.getLastRow() - 1) : 0;

  if (cursor === 0) {
    const seed = qhInstallV118TrustLayer_();
    cursor = Number(seed.next || 0);
    if (cursor === 0) {
      return {ok:true, complete:true, batchesProcessed:1, next:0, lastResult:seed};
    }
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
    auditedRows:(ss.getSheetByName('Quest Data Audit') || sh).getLastRow() - 1,
    lastResult:result
  };
}

function qhV119ContinueAudit() {
  return qhV119ContinueAudit_();
}

function qhInstallV119() {
  const sync = syncQuestHelperRouteRequirements();
  const ss = SpreadsheetApp.openById(QH_TRACKER_ID);
  const policy = qhV119ApplyRoutePolicies_(ss, new Date(), 'v1.19');
  const audit = qhV119ContinueAudit_();
  return {ok:true, sync:sync, policy:policy, audit:audit};
}