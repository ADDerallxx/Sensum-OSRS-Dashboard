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
  const questDependencySheet = ss.getSheetByName('Quest Dependency');
  const rewardMap = readV1QuestRewards_(questDependencySheet);

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
    topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5],rewards:rewardMap[String(r[1]||'').trim().toLowerCase()]||null})),
    blockedQuests: blockedRows.map(r => ({quest:r[0],score:r[1],downstream:r[2],blockedBy:r[3],missingSkills:r[4],hours:r[5]})),
    skillGrinds: grindRows.map(r => ({quest:r[0],missingSkills:r[1],xp:r[2],fast:r[3],value:r[4],afk:r[5],downstream:r[6],score:r[7],efficiency:r[8]})),
    route: routeRows.map(r => ({step:r[0],quest:r[1],score:r[2],blocker:r[3],currentHours:r[4],xpCredit:r[5],afterHours:r[6],projectedQp:r[7]})),
    nextSession,
    stats: statsRows.map(r => ({skill:r[0],level:r[1],xp:r[7],nextXp:r[5]})),
    shopping: readV1Shopping_(shoppingSheet, reconciledSheet),
    wikiHealth: readV1WikiHealth_(dash)
  };
}

function readV1QuestRewards_(sh) {
  const out={}; if(!sh||sh.getLastRow()<1)return out;
  const v=sh.getDataRange().getDisplayValues(); let hr=-1,h=[];
  for(let i=0;i<Math.min(v.length,15);i++){const r=v[i].map(x=>String(x||'').trim());if(r.some(x=>/^quest name$/i.test(x))&&r.some(x=>/quest points reward/i.test(x))){hr=i;h=r;break}}
  if(hr<0)return out; const c=n=>h.findIndex(x=>String(x||'').trim().toLowerCase()===n);
  const q=c('quest name'),qp=c('quest points reward'),xp=c('xp rewards'),it=c('item / coin rewards'),un=c('unlocks / other rewards');
  v.slice(hr+1).forEach(r=>{const n=q>=0?String(r[q]||'').trim():'';if(n)out[n.toLowerCase()]={qp:qp>=0?String(r[qp]||'').trim():'',xp:xp>=0?String(r[xp]||'').trim():'',items:it>=0?String(r[it]||'').trim():'',unlocks:un>=0?String(r[un]||'').trim():''}});
  return out;
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
    "rope, multiple in case you fail an agility check": "Rope",
    "torch": "Lit torch or candle"
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



// V1.15.1 quest completion reporting
function v115QuestTable_(ss) {
  const sh=ss.getSheetByName('Quest Dependency');
  if(!sh) throw new Error('Quest Dependency sheet not found.');

  const vals=sh.getDataRange().getDisplayValues();
  let headerRow=-1, headers=null;

  for(let i=0;i<Math.min(vals.length,12);i++){
    const row=vals[i].map(x=>String(x||'').trim());
    const hasCompleted=row.some(x=>/^completed$/i.test(x));
    const hasQuest=row.some(x=>/^quest name$/i.test(x));
    if(hasCompleted && hasQuest){
      headerRow=i;
      headers=row;
      break;
    }
  }

  if(headerRow<0) throw new Error('Could not locate Quest Dependency header row.');

  const qCol=headers.findIndex(x=>/^quest name$/i.test(x));
  const cCol=headers.findIndex(x=>/^completed$/i.test(x));
  const qpCol=headers.findIndex(x=>/quest points reward|quest points|qp reward/i.test(x));

  if(qCol<0||cCol<0) throw new Error('Quest Dependency needs Quest Name and Completed columns.');

  return {sh, vals, headerRow, headers, qCol, cCol, qpCol};
}

function v115CurrentTrackerQp_(ss) {
  const sh=ss.getSheetByName('Your Stats');
  if(!sh) return 0;
  const found=sh.createTextFinder('Quest Points').matchEntireCell(true).findNext();
  return found ? Number(found.offset(0,1).getValue()||0) : 0;
}

function getV115QuestCompletionState_() {
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);
  const t=v115QuestTable_(ss);

  const incomplete=[];
  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    if(!quest)return;
    const done=/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'').trim());
    if(!done){
      incomplete.push({
        quest,
        qp:t.qpCol>=0 ? Number(r[t.qpCol]||0) : 0,
        row:t.headerRow+2+idx
      });
    }
  });
  incomplete.sort((a,b)=>a.quest.localeCompare(b.quest));

  const props=PropertiesService.getScriptProperties();
  const current=v115CurrentTrackerQp_(ss);
  let previous=Number(props.getProperty('V115_LAST_RECONCILED_QP')||current);
  if(!props.getProperty('V115_LAST_RECONCILED_QP')){
    props.setProperty('V115_LAST_RECONCILED_QP',String(current));
    previous=current;
  }
  const gain=Math.max(0,current-previous);

  const dash=ss.getSheetByName('Dashboard');
  const route=dash.getRange('A60:B69').getDisplayValues().map(r=>r[1]).filter(Boolean);
  const next=dash.getRange('A73:B80').getDisplayValues();
  const nextObj={}; next.forEach(r=>{if(r[0])nextObj[r[0]]=r[1]});
  const nextQuest=nextObj['Quest']||nextObj['Next Quest']||'';

  const likely=incomplete.map(q=>{
    let score=0,reasons=[];
    if(String(q.quest).toLowerCase()===String(nextQuest).toLowerCase()){
      score+=100; reasons.push('Next Session');
    }
    const ri=route.findIndex(x=>String(x).toLowerCase()===q.quest.toLowerCase());
    if(ri>=0){
      score+=50-ri; reasons.push('Current route');
    }
    if(gain>0&&q.qp===gain){
      score+=80; reasons.push('Exact QP match');
    }else if(gain>0&&q.qp>0&&q.qp<=gain){
      score+=20; reasons.push('Fits QP gain');
    }
    return {...q,score,reasons};
  }).filter(q=>q.score>0).sort((a,b)=>b.score-a.score||a.quest.localeCompare(b.quest));

  return {
    currentQp:current,
    previousQp:previous,
    detectedGain:gain,
    incomplete,
    likely,
    qpDetectionSource:'tracker'
  };
}

function getV115QuestCompletionState(){return getV115QuestCompletionState_();}

function completeV115Quests(quests,source){
  if(!Array.isArray(quests)||!quests.length)throw new Error('Select at least one quest.');

  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);
  const t=v115QuestTable_(ss);
  const wanted=new Set(quests.map(x=>String(x).toLowerCase()));
  const changed=[];

  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    if(wanted.has(quest.toLowerCase())&&!/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||''))){
      t.sh.getRange(t.headerRow+2+idx,t.cCol+1).setValue('Yes');
      changed.push(quest);
    }
  });

  if(!changed.length)throw new Error('No incomplete quests matched the selection.');

  let log=ss.getSheetByName('Quest Completion Log');
  if(!log){
    log=ss.insertSheet('Quest Completion Log');
    log.appendRow(['Timestamp','Quest','Previous Status','New Status','Source','Transaction ID']);
  }

  const tx=Utilities.getUuid(),now=new Date(),src=source||'Dashboard Manual';
  changed.forEach(q=>log.appendRow([now,q,'No','Yes',src,tx]));

  SpreadsheetApp.flush();
  Utilities.sleep(200);

  PropertiesService.getScriptProperties().setProperty(
    'V115_LAST_RECONCILED_QP',
    String(v115CurrentTrackerQp_(ss))
  );

  return {ok:true,changed,transactionId:tx,state:getV115QuestCompletionState_()};
}

function undoV115QuestCompletion(transactionId){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),log=ss.getSheetByName('Quest Completion Log');
  if(!log)throw new Error('No quest completion log exists.');

  const lv=log.getDataRange().getDisplayValues();
  const quests=lv.slice(1).filter(r=>r[5]===transactionId).map(r=>r[1]);
  if(!quests.length)throw new Error('Transaction not found.');

  const t=v115QuestTable_(ss);
  const set=new Set(quests.map(x=>x.toLowerCase()));
  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    if(set.has(String(r[t.qCol]||'').trim().toLowerCase())){
      t.sh.getRange(t.headerRow+2+idx,t.cCol+1).setValue('No');
    }
  });

  const tx=Utilities.getUuid(),now=new Date();
  quests.forEach(q=>log.appendRow([now,q,'Yes','No','Dashboard Undo',tx]));
  SpreadsheetApp.flush();
  return {ok:true,changed:quests,state:getV115QuestCompletionState_()};
}

