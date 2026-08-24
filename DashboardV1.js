const V1_TRACKER_ID = '18cUN2RTytdinH9kpgqQhz9OZsKRpHrVAB2hiUotznKU';

function getV1DashboardState() {
  if (typeof qhMaybeSyncRoute_ === 'function') {
    const props = PropertiesService.getScriptProperties();
    const lastQh = Number(props.getProperty('QH_ROUTE_SYNC_MS_V2') || 0);
    if (Date.now() - lastQh > 6 * 60 * 60 * 1000) qhMaybeSyncRoute_();
  }
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const dash = ss.getSheetByName('Dashboard');
  const statsSheet = ss.getSheetByName('Your Stats');
  const goalsSheet = ss.getSheetByName('Goal Registry');
  const shoppingSheet = ss.getSheetByName('Route Shopping');
  const reconciledSheet = ss.getSheetByName('Quest Prep Reconciled');

  const topRows = dash.getRange('A5:F10').getDisplayValues().slice(1).filter(r => r[1]);
  const blockedRows = dash.getRange('A13:F21').getDisplayValues().slice(1).filter(r => r[0]);
  const grindRows = dash.getRange('A36:I44').getDisplayValues().slice(1).filter(r => r[0]);
  const routeRows = dash.getRange('A60:H69').getDisplayValues().filter(r => r[1]);
  const nextRows = dash.getRange('A73:B80').getDisplayValues();

  const statsRows = statsSheet.getRange('A3:H26').getDisplayValues().filter(r => r[0]);
  const accountRows = statsSheet.getRange('A30:D35').getDisplayValues().filter(r => r[0]);
  const account = {};
  accountRows.forEach(r => account[r[0]] = r[1]);

  const goalRows = goalsSheet.getRange('A5:O200').getDisplayValues().filter(r => r[0]);
  const goals = goalRows.map(r => ({name:r[0], type:r[1], anchor:r[2], line:r[3], notes:r[14]}));

  const summary = {
    objective: dash.getRange('J3').getDisplayValue() || dash.getRange('B3').getDisplayValue(),
    status: dash.getRange('J4').getDisplayValue(),
    missingSkills: dash.getRange('J5').getDisplayValue(),
    prerequisites: dash.getRange('J6').getDisplayValue(),
    effect: dash.getRange('J7').getDisplayValue()
  };

  const nextSession = {};
  nextRows.forEach(r => { if (r[0]) nextSession[r[0]] = r[1]; });

  return {
    username: account.Username || 'Sensum',
    combatLevel: account['Combat Level'] || '',
    questPoints: account['Quest Points'] || '',
    lastWomSnapshot: account['Last WOM Snapshot'] || '',
    lastSheetSync: account['Last Sheet Sync'] || '',
    goal: dash.getRange('B3').getDisplayValue(),
    routeDepth: Number(getRouteDepthValue_(dash) || 10),
    goals,
    goalSummary: summary,
    topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5]})),
    blockedQuests: blockedRows.map(r => ({quest:r[0],score:r[1],downstream:r[2],blockedBy:r[3],missingSkills:r[4],hours:r[5]})),
    skillGrinds: grindRows.map(r => ({quest:r[0],missingSkills:r[1],xp:r[2],fast:r[3],value:r[4],afk:r[5],downstream:r[6],score:r[7],efficiency:r[8]})),
    route: routeRows.map(r => ({step:r[0],quest:r[1],score:r[2],blocker:r[3],currentHours:r[4],xpCredit:r[5],afterHours:r[6],projectedQp:r[7]})),
    nextSession,
    stats: statsRows.map(r => ({skill:r[0],level:r[1],xp:r[7],nextXp:r[5]})),
    shopping: readV1Shopping_(shoppingSheet, reconciledSheet),
    wikiHealth: readV1WikiHealth_(dash)
  };
}

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
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const names = ss.getSheetByName('Goal Registry').getRange('A5:A200').getDisplayValues().flat().filter(Boolean);
  if (names.indexOf(goalName) === -1) throw new Error('Unknown goal: ' + goalName);
  ss.getSheetByName('Dashboard').getRange('B3').setValue(goalName);
  SpreadsheetApp.flush();
  Utilities.sleep(150);
  return getV1DashboardState();
}

function setV1RouteDepth(depth) {
  depth = Number(depth);
  if ([3,5,10].indexOf(depth) === -1) throw new Error('Route depth must be 3, 5, or 10.');
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const dash = ss.getSheetByName('Dashboard');
  const found = dash.createTextFinder('Route Depth').matchEntireCell(true).findNext();
  if (!found) throw new Error('Route Depth control not found.');
  found.offset(0,1).setValue(depth);
  SpreadsheetApp.flush();
  Utilities.sleep(150);
  return getV1DashboardState();
}

function getRouteDepthValue_(dash) {
  const found = dash.createTextFinder('Route Depth').matchEntireCell(true).findNext();
  return found ? found.offset(0,1).getValue() : 10;
}

function normalizeV1PrepItem_(name) {
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

