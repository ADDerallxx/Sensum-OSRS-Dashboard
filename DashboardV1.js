const V1_TRACKER_ID = '18cUN2RTytdinH9kpgqQhz9OZsKRpHrVAB2hiUotznKU';

function getV1DashboardState() {
  if (typeof qhMaybeSyncRoute_ === 'function') qhMaybeSyncRoute_();
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const dash = ss.getSheetByName('Dashboard');
  const statsSheet = ss.getSheetByName('Your Stats');
  const goalsSheet = ss.getSheetByName('Goal Registry');
  const shoppingSheet = ss.getSheetByName('Route Shopping');

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
    shopping: readV1Shopping_(shoppingSheet),
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
