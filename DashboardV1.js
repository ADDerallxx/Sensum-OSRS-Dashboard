const V1_TRACKER_ID = '18cUN2RTytdinH9kpgqQhz9OZsKRpHrVAB2hiUotznKU';

function saveV133ManualAchievement(title,note){return addV133ManualAchievement(title,note)}
function deleteV133ManualAchievement(id){return removeV133ManualAchievement(id)}

function forceV134WiseOldManUpdate() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('A Wise Old Man update is already running.');
  try {
    const ss = SpreadsheetApp.openById(V1_TRACKER_ID), sh = ss.getSheetByName('Your Stats');
    if (!sh) throw new Error('Your Stats sheet was not found.');
    const values = sh.getDataRange().getDisplayValues();
    let username = 'Sensum';
    values.forEach(r => { if (/^username$/i.test(String(r[0] || '').trim()) && r[1]) username = String(r[1]).trim(); });
    const url = 'https://api.wiseoldman.net/v2/players/' + encodeURIComponent(username);
    const response = UrlFetchApp.fetch(url, {method:'post',contentType:'application/json',muteHttpExceptions:true,headers:{'User-Agent':'SensumOSRSDashboard/1.34'}});
    const code = response.getResponseCode(), body = response.getContentText();
    if (code < 200 || code >= 300) {
      let message = 'Wise Old Man returned HTTP ' + code;
      try { const parsed = JSON.parse(body); message = parsed.message || parsed.error || message; } catch (e) {}
      if (code === 429) message = 'Wise Old Man update cooldown is active. Wait about a minute and try again.';
      throw new Error(message);
    }
    const player = JSON.parse(body), snapshot = player.latestSnapshot;
    if (!snapshot || !snapshot.data || !snapshot.data.skills) throw new Error('Wise Old Man did not return a current skill snapshot.');
    const skills = snapshot.data.skills;
    const aliases = {runecraft:'runecrafting',runecrafting:'runecrafting'};
    const skillRows = sh.getRange(3,1,24,8).getDisplayValues();
    skillRows.forEach((r,i) => {
      const display = String(r[0] || '').trim(), key = aliases[display.toLowerCase()] || display.toLowerCase().replace(/\s+/g,'_');
      const stat = skills[key];
      if (!stat) return;
      sh.getRange(i+3,2).setValue(Number(stat.level || 1));
      sh.getRange(i+3,8).setValue(Math.max(0,Number(stat.experience || 0)));
    });
    const account = sh.getRange(30,1,Math.max(1,sh.getLastRow()-29),2).getDisplayValues();
    let snapshotRow = -1, syncRow = -1;
    account.forEach((r,i) => { if (/^last wom snapshot$/i.test(String(r[0] || '').trim())) snapshotRow=i+30; if (/^last sheet sync$/i.test(String(r[0] || '').trim())) syncRow=i+30; });
    if (snapshotRow > 0) sh.getRange(snapshotRow,2).setValue(new Date(snapshot.createdAt || new Date()));
    if (syncRow > 0) sh.getRange(syncRow,2).setValue(new Date());
    SpreadsheetApp.flush();
    return {ok:true,message:'Wise Old Man updated for '+username+'.',snapshotAt:snapshot.createdAt||'',state:getV1DashboardState({allowQuestHelperSync:false})};
  } finally { lock.releaseLock(); }
}

function v22XpFloorForLevel_(level) {
  level = Math.max(1, Math.min(99, Number(level) || 1));
  let points = 0;
  for (let current = 1; current < level; current++) points += Math.floor(current + 300 * Math.pow(2, current / 7));
  return Math.floor(points / 4);
}

function v22WikiSyncMeta_() {
  const p = PropertiesService.getScriptProperties();
  return {
    lastSync: p.getProperty('V22_WIKISYNC_LAST_SYNC') || '',
    sourceTimestamp: p.getProperty('V22_WIKISYNC_SOURCE_TIMESTAMP') || '',
    lastError: p.getProperty('V22_WIKISYNC_LAST_ERROR') || '',
    updatedLevels: Number(p.getProperty('V22_WIKISYNC_UPDATED_LEVELS') || 0),
    completedQuests: Number(p.getProperty('V22_WIKISYNC_COMPLETED_QUESTS') || 0)
  };
}

function refreshV22WikiSync(clientPayload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {ok:true, skipped:true, message:'Live sync is already running.', state:getV1DashboardState({allowQuestHelperSync:false})};
  const props = PropertiesService.getScriptProperties();
  try {
    const lastAttempt = Number(props.getProperty('V22_WIKISYNC_LAST_ATTEMPT_MS') || 0);
    if (Date.now() - lastAttempt < 20000) return {ok:true, skipped:true, message:'Live data is already current.', state:getV1DashboardState({allowQuestHelperSync:false})};
    props.setProperty('V22_WIKISYNC_LAST_ATTEMPT_MS', String(Date.now()));
    const ss = SpreadsheetApp.openById(V1_TRACKER_ID), statsSheet = ss.getSheetByName('Your Stats');
    if (!statsSheet) throw new Error('Your Stats sheet was not found.');
    const allStats = statsSheet.getDataRange().getDisplayValues();
    let username = 'Sensum';
    allStats.forEach(r => { if (/^username$/i.test(String(r[0] || '').trim()) && r[1]) username = String(r[1]).trim(); });
    let payload = clientPayload;
    if (!payload) {
      const url = 'https://sync.runescape.wiki/runelite/player/' + encodeURIComponent(username) + '/STANDARD';
      let response = UrlFetchApp.fetch(url, {muteHttpExceptions:true,headers:{'User-Agent':'SensumOSRSDashboard/2.2'}});
      if (response.getResponseCode() !== 200) {
        const relay = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        response = UrlFetchApp.fetch(relay, {muteHttpExceptions:true,headers:{'User-Agent':'SensumOSRSDashboard/2.2'}});
      }
      if (response.getResponseCode() !== 200) throw new Error('WikiSync relay returned HTTP ' + response.getResponseCode() + '.');
      payload = JSON.parse(response.getContentText());
    }
    if (String(payload.username || '').trim().toLowerCase() !== username.toLowerCase()) throw new Error('WikiSync username did not match this dashboard.');
    if (!payload.levels || !payload.quests) throw new Error('WikiSync did not return levels and quests.');

    const levelMap = {};
    Object.keys(payload.levels).forEach(k => levelMap[String(k).toLowerCase()] = Number(payload.levels[k]));
    const rows = statsSheet.getRange(3,1,24,8).getValues(), liveLevelValues = [];
    let changedLevels = 0;
    rows.forEach(r => {
      const key = String(r[0] || '').trim().toLowerCase().replace(/^runecrafting$/,'runecraft');
      if (!Object.prototype.hasOwnProperty.call(levelMap,key)) return;
      const liveLevel = Math.max(1, levelMap[key] || 1);
      if (Number(r[1]) !== liveLevel) changedLevels++;
      r[1] = liveLevel;
    });
    rows.forEach(r => liveLevelValues.push([r[1]]));
    statsSheet.getRange(3,2,24,1).setValues(liveLevelValues);

    let newlyCompleted = 0;
    const table = v115QuestTable_(ss), questRows = table.vals.slice(table.headerRow + 1), firstDataRow = table.headerRow + 2;
    const liveQuests = {};
    Object.keys(payload.quests).forEach(k => liveQuests[String(k).trim().toLowerCase()] = Number(payload.quests[k]));
    questRows.forEach(r => {
      const name = String(r[table.qCol] || '').trim(), status = String(r[table.cCol] || '').trim();
      if (name && liveQuests[name.toLowerCase()] === 2 && !/^(yes|true|complete|completed)$/i.test(status)) {
        r[table.cCol] = 'Yes'; newlyCompleted++;
      }
    });
    if (newlyCompleted) table.sh.getRange(firstDataRow,table.cCol+1,questRows.length,1).setValues(questRows.map(r => [r[table.cCol]]));
    const now = new Date().toISOString();
    props.setProperties({
      V22_WIKISYNC_LAST_SYNC: now,
      V22_WIKISYNC_SOURCE_TIMESTAMP: String(payload.timestamp || now),
      V22_WIKISYNC_LAST_ERROR: '',
      V22_WIKISYNC_UPDATED_LEVELS: String(changedLevels),
      V22_WIKISYNC_COMPLETED_QUESTS: String(newlyCompleted)
    });
    SpreadsheetApp.flush();
    return {ok:true,message:'Live levels and quest states updated.',updatedLevels:changedLevels,completedQuests:newlyCompleted,state:getV1DashboardState({allowQuestHelperSync:false})};
  } catch (e) {
    props.setProperty('V22_WIKISYNC_LAST_ERROR', String(e && e.message ? e.message : e));
    return {ok:false,message:String(e && e.message ? e.message : e),state:getV1DashboardState({allowQuestHelperSync:false})};
  } finally { lock.releaseLock(); }
}

function getV1DashboardState(options) {
  options = options || {};
  // V1.22: interactive reads never block on a Quest Helper network sync.
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const dash = ss.getSheetByName('Dashboard');
  const statsSheet = ss.getSheetByName('Your Stats');
  const goalsSheet = ss.getSheetByName('Goal Registry');
  const shoppingSheet = ss.getSheetByName('Route Shopping');
  const reconciledSheet = ss.getSheetByName('Quest Prep Reconciled');
  const questDependencySheet = ss.getSheetByName('Quest Dependency');
  const questDisplayMeta = readV129QuestDisplayMeta_(ss.getSheetByName('Wiki Cache'));
  const questMeta = readV122QuestMeta_(questDependencySheet);
  const rewardMap = questMeta.rewards;
  const requirementIntel = questMeta.requirements;

  const topRows = dash.getRange('A5:F10').getDisplayValues().slice(1).filter(r => r[1]);
  const blockedRows = dash.getRange('A13:F21').getDisplayValues().slice(1).filter(r => r[0]);
  const orderedBlockedQuests = readV134OrderedBlockedQuests_(blockedRows, questDependencySheet);
  const grindRows = dash.getRange('A36:I44').getDisplayValues().slice(1).filter(r => r[0]);
  const routeRows = dash.getRange('A60:H69').getDisplayValues().filter(r => r[1]);
  const nextRows = dash.getRange('A73:B80').getDisplayValues();

  const statsRows = statsSheet.getRange('A3:H26').getDisplayValues().filter(r => r[0]);
  const accountRows = statsSheet.getRange('A30:D35').getDisplayValues().filter(r => r[0]);
  const blockerSkillTargets = readV134BlockerSkillTargets_(orderedBlockedQuests, requirementIntel, statsRows);
  const questLibrary = readV134QuestLibrary_(questDependencySheet, questDisplayMeta);
  const relevantHealthQuests = new Set([].concat(
    topRows.map(r=>String(r[1]||'').toLowerCase()),
    orderedBlockedQuests.map(r=>String(r.quest||'').toLowerCase()),
    routeRows.map(r=>String(r[1]||'').toLowerCase())
  ));
  const wikiReviewQueue = (questLibrary.quests||[]).filter(q=>q.needsReview).map(q=>({name:q.name,status:q.wikiStatus,reason:q.reconciliation,lastVerified:q.lastVerified,wikiUrl:q.wikiUrl,relevant:relevantHealthQuests.has(q.name.toLowerCase())}));
  const account = {};
  accountRows.forEach(r => account[r[0]] = r[1]);

  const goalRows = goalsSheet.getRange('A5:P200').getDisplayValues().filter(r => r[0]);
  const allGoals = goalRows.map(r => ({name:r[0], type:r[1], anchor:r[2], line:r[3], notes:r[14], status:r[15]||'ACTIVE'}));
  const goals = allGoals.filter(g => g.name === 'Balanced' || !/^accomplished$/i.test(g.status));
  const accomplishedGoals = allGoals.filter(g => g.name !== 'Balanced' && /^accomplished$/i.test(g.status));

  const summary = {
    objective: dash.getRange('J3').getDisplayValue() || dash.getRange('B3').getDisplayValue(),
    status: dash.getRange('J4').getDisplayValue(),
    missingSkills: dash.getRange('J5').getDisplayValue(),
    prerequisites: dash.getRange('J6').getDisplayValue(),
    effect: dash.getRange('J7').getDisplayValue()
  };

  const nextSession = {};
  nextRows.forEach(r => { if (r[0]) nextSession[r[0]] = r[1]; });
  const bosses=readV128BossPlanner_(ss,statsRows),bossProgress=readV132BossProgress_();

  const wikiSync = v22WikiSyncMeta_();
  return {
    username: account.Username || 'Sensum',
    combatLevel: account['Combat Level'] || '',
    questPoints: account['Quest Points'] || '',
    lastWomSnapshot: account['Last WOM Snapshot'] || '',
    lastSheetSync: account['Last Sheet Sync'] || '',
    goal: dash.getRange('B3').getDisplayValue(),
    routeDepth: Number(getRouteDepthValue_(dash) || 10),
    goals,
    accomplishedGoals,
    goalProgress: readV131GoalProgress_(ss, allGoals, statsRows, account, requirementIntel, routeRows),
    bosses: bosses,
    bossGuides: v132BossGuides_(),
    bossLoadouts: V132B_WIKI_LOADOUTS,
    bossItemImages: V132B_ITEM_IMAGES,
    bossProgress: bossProgress,
    achievements: readV133Achievements_(ss,statsRows,account,allGoals,bosses,bossProgress),
    goalSummary: summary,
    topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5],rewards:rewardMap[String(r[1]||'').trim().toLowerCase()]||null})),
    blockedQuests: orderedBlockedQuests,
    blockerSkillTargets: blockerSkillTargets,
    questLibrary: questLibrary,
    dataHealthContext:{reviewQueue:wikiReviewQueue,relevantReviews:wikiReviewQueue.filter(q=>q.relevant).length,totalReviews:wikiReviewQueue.length},
    skillGrinds: grindRows.map(r => ({quest:r[0],missingSkills:r[1],xp:r[2],fast:r[3],value:r[4],afk:r[5],downstream:r[6],score:r[7],efficiency:r[8]})),
    route: routeRows.map(r => ({step:r[0],quest:r[1],score:r[2],blocker:r[3],currentHours:r[4],xpCredit:r[5],afterHours:r[6],projectedQp:r[7]})),
    nextSession,
    stats: statsRows.map(r => {
      const level = Number(r[1] || 1), womXp = Math.max(0, Number(String(r[7] || 0).replace(/,/g,'')) || 0), floorXp = v22XpFloorForLevel_(level);
      const floorActive = floorXp > womXp;
      return {skill:r[0],level:r[1],xp:floorActive?floorXp:womXp,womXp:womXp,nextXp:r[5],xpExact:!floorActive,xpSource:floorActive?'Level floor':'WOM verified'};
    }),
    shopping: readV1Shopping_(shoppingSheet, reconciledSheet),
    requirementIntel,
    questDisplayMeta,
    planningMode:'Base levels only',
    wikiHealth: readV1WikiHealth_(dash),
    wikiSync: wikiSync
  };
}

// V1.34: preserve the dashboard ranking wherever possible, but never place a
// blocked quest before one of its displayed prerequisites. The Blocked By
// value also names the actual unfinished prerequisite quests.
function readV134OrderedBlockedQuests_(blockedRows, dependencySheet) {
  const base = (blockedRows || []).map((r, index) => ({
    quest:r[0], score:r[1], downstream:r[2], blockedBy:r[3],
    missingSkills:r[4], hours:r[5], _index:index
  }));
  if (!dependencySheet || !base.length) return base.map(v134PublicBlocker_);

  const values = dependencySheet.getDataRange().getDisplayValues();
  let headerRow = -1, headers = [];
  for (let i = 0; i < Math.min(values.length, 12); i++) {
    const row = values[i].map(x => String(x || '').trim());
    if (row.some(x => /^quest name$/i.test(x)) && row.some(x => /^direct prior quest requirement\(s\)$/i.test(x))) {
      headerRow = i; headers = row; break;
    }
  }
  if (headerRow < 0) return base.map(v134PublicBlocker_);

  const column = rx => headers.findIndex(x => rx.test(x));
  const questCol = column(/^quest name$/i);
  const prereqCol = column(/^direct prior quest requirement\(s\)$/i);
  const completedCol = column(/^completed$/i);
  const downstreamCol = column(/^total downstream unlocks$/i);
  const balancedScoreCol = column(/^balanced priority score$/i);
  const goalScoreCol = column(/^goal profile score$/i);
  const gapCol = column(/^skill gap summary$/i);
  const hoursCol = column(/^best value hours$/i);
  if (questCol < 0 || prereqCol < 0) return base.map(v134PublicBlocker_);

  const records = values.slice(headerRow + 1).filter(r => String(r[questCol] || '').trim());
  const names = records.map(r => String(r[questCol] || '').trim()).sort((a,b) => b.length - a.length);
  const byName = {};
  records.forEach(r => {
    const quest = String(r[questCol] || '').trim();
    const source = String(r[prereqCol] || '').trim();
    const prereqs = names.filter(name => name.toLowerCase() !== quest.toLowerCase() &&
      source.toLowerCase().indexOf(name.toLowerCase()) >= 0);
    byName[quest.toLowerCase()] = {
      quest:quest,
      prereqs:prereqs,
      complete:completedCol >= 0 && /^(yes|true|complete|completed)$/i.test(String(r[completedCol] || '').trim()),
      score:String(r[goalScoreCol >= 0 ? goalScoreCol : balancedScoreCol] || '').trim(),
      downstream:String(r[downstreamCol] || '').trim(),
      missingSkills:String(r[gapCol] || '').trim() || 'None',
      hours:String(r[hoursCol] || '').trim()
    };
  });

  // The Dashboard sheet only supplies its eight highest-ranked blockers. Add
  // every unfinished ancestor needed by those quests so the table can show a
  // complete, actionable quest chain instead of merely naming hidden rows.
  const included = {};
  base.forEach(item => included[String(item.quest || '').toLowerCase()] = true);
  let nextIndex = base.length;
  function includeMissingAncestors(questKey, visiting) {
    const rec = byName[questKey];
    if (!rec || visiting[questKey]) return;
    const path = Object.assign({}, visiting); path[questKey] = true;
    rec.prereqs.forEach(name => {
      const key = name.toLowerCase(), prereq = byName[key];
      if (!prereq || prereq.complete) return;
      includeMissingAncestors(key, path);
      if (!included[key]) {
        base.push({
          quest:prereq.quest, score:prereq.score, downstream:prereq.downstream,
          blockedBy:'Quest prerequisite', missingSkills:prereq.missingSkills,
          hours:prereq.hours, _index:nextIndex++
        });
        included[key] = true;
      }
    });
  }
  base.slice().forEach(item => includeMissingAncestors(String(item.quest || '').toLowerCase(), {}));

  base.forEach(item => {
    const rec = byName[String(item.quest || '').toLowerCase()];
    if (!rec) return;
    const missing = rec.prereqs.filter(name => !(byName[name.toLowerCase()] || {}).complete);
    if (missing.length) item.blockedBy = missing.join('; ');
    else if (item.missingSkills && !/^none$/i.test(item.missingSkills)) item.blockedBy = 'Skills';
    else item.blockedBy = 'Ready now';
  });

  // Stable topological sort: dependency constraints win; unrelated quests
  // retain their existing score-based dashboard order.
  const displayed = {};
  base.forEach((item, i) => displayed[String(item.quest || '').toLowerCase()] = i);
  const indegree = base.map(() => 0), outgoing = base.map(() => []);
  base.forEach((item, i) => {
    const rec = byName[String(item.quest || '').toLowerCase()];
    (rec ? rec.prereqs : []).forEach(name => {
      const parent = displayed[name.toLowerCase()];
      if (parent === undefined || parent === i) return;
      indegree[i]++;
      outgoing[parent].push(i);
    });
  });
  const ready = base.map((_, i) => i).filter(i => indegree[i] === 0).sort((a,b) => base[a]._index - base[b]._index);
  const ordered = [];
  while (ready.length) {
    const current = ready.shift();
    ordered.push(base[current]);
    outgoing[current].forEach(next => {
      indegree[next]--;
      if (indegree[next] === 0) {
        ready.push(next);
        ready.sort((a,b) => base[a]._index - base[b]._index);
      }
    });
  }
  if (ordered.length !== base.length) return base.map(v134PublicBlocker_);
  return ordered.map(v134PublicBlocker_);
}

function v134PublicBlocker_(item) {
  return {quest:item.quest,score:item.score,downstream:item.downstream,blockedBy:item.blockedBy,missingSkills:item.missingSkills,hours:item.hours};
}

function readV134BlockerSkillTargets_(blockedQuests, requirementIntel, statsRows) {
  const levels = {};
  (statsRows || []).forEach(r => levels[String(r[0] || '').trim().toLowerCase()] = Number(r[1] || 0));
  const targets = {};
  (blockedQuests || []).forEach(q => {
    const quest = String(q.quest || '').trim();
    const req = (requirementIntel || {})[quest.toLowerCase()];
    (req && req.requiredSkills ? req.requiredSkills : []).forEach(skillReq => {
      const skill = String(skillReq.skill || '').trim(), key = skill.toLowerCase(), target = Number(skillReq.level || 0);
      if (!skill || !target) return;
      if (!targets[key] || target > targets[key].target) targets[key] = {skill:skill,target:target,quests:[quest]};
      else if (target === targets[key].target && targets[key].quests.indexOf(quest) < 0) targets[key].quests.push(quest);
    });
  });
  const all = Object.keys(targets).map(key => {
    const item = targets[key], current = Number(levels[key] || 0);
    return {skill:item.skill,current:current,target:item.target,gap:Math.max(0,item.target-current),quests:item.quests};
  });
  all.sort((a,b) => (b.gap-a.gap) || (b.target-a.target) || a.skill.localeCompare(b.skill));
  const unmet = all.filter(x => x.gap > 0), met = all.filter(x => x.gap <= 0);
  return {
    unmet:unmet,
    met:met,
    totalSkills:all.length,
    unmetCount:unmet.length,
    largestGap:unmet.length ? {skill:unmet[0].skill,gap:unmet[0].gap,target:unmet[0].target} : null,
    planningMode:'Base levels only'
  };
}

function readV134QuestLibrary_(sh, displayMeta) {
  if (!sh || sh.getLastRow() < 2) return {quests:[],audit:{current:0,review:0,total:0}};
  const values = sh.getDataRange().getDisplayValues();
  let hr = -1, headers = [];
  for (let i=0;i<Math.min(values.length,12);i++) {
    const row=values[i].map(x=>String(x||'').trim());
    if (row.some(x=>/^quest name$/i.test(x))) {hr=i;headers=row;break;}
  }
  if (hr < 0) return {quests:[],audit:{current:0,review:0,total:0}};
  const col = rx => headers.findIndex(x => rx.test(x));
  const q=col(/^quest name$/i),completed=col(/^completed$/i),qp=col(/^quest points reward$/i),xp=col(/^xp rewards$/i),items=col(/^item \/ coin rewards$/i),unlocks=col(/^unlocks \/ other rewards$/i);
  const ready=col(/^ready now\?$/i),downstream=col(/^total downstream unlocks$/i),score=col(/^goal profile score$/i),why=col(/^goal profile why$/i),gap=col(/^skill gap summary$/i);
  const url=col(/^wiki url$/i),stored=col(/^wiki stored revision$/i),latest=col(/^wiki latest revision$/i),checked=col(/^wiki last checked$/i),status=col(/^wiki status$/i),recon=col(/^wiki reconciliation$/i);
  const clean = v => { const s=String(v||'').trim(); return (!s||/^none listed$/i.test(s))?'':s; };
  const quests = [];
  values.slice(hr+1).forEach(r => {
    const name=q>=0?String(r[q]||'').trim():''; if(!name)return;
    const xpText=clean(r[xp]), itemText=clean(r[items]), unlockText=clean(r[unlocks]), combined=(xpText+' '+itemText+' '+unlockText).toLowerCase();
    const xpParts=xpText?xpText.split(/\s*;\s*/).filter(Boolean):[],rewardXp={guaranteed:[],selectable:[],during:[],postQuest:[]};
    xpParts.forEach(part=>{
      if(/during (?:the )?quest|additional .* during/i.test(part))rewardXp.during.push(part);
      else if(/claim from|historian|minas|first chromium|after (?:the )?quest|post[- ]quest/i.test(part))rewardXp.postQuest.push(part);
      else if(/selectable|choice|choosing|any skill|random combat/i.test(part))rewardXp.selectable.push(part);
      else rewardXp.guaranteed.push(part);
    });
    const categories=[];
    if(xpText)categories.push('xp');
    if(rewardXp.selectable.length||/\blamp\b|\btome\b/i.test(itemText))categories.push('selectable');
    if(/teleport|transport|boat|glider|fairy ring|spirit tree|minecart|passage|shortcut|travel/i.test(unlockText))categories.push('transport');
    if(/spellbook|spell|magick|magic/i.test(unlockText))categories.push('spellbooks');
    if(itemText||/armour|armor|weapon|staff|sword|shield|helm|glove|cape|bow/i.test(unlockText))categories.push('equipment');
    if(/access|area|guild|dungeon|island|city|camp|mine|zone/i.test(unlockText))categories.push('areas');
    if(/nightmare zone|boss|vorkath|zulrah|barrelchest|fight/i.test(unlockText))categories.push('bosses');
    const wikiStatus=status>=0?String(r[status]||'').trim():'';
    const reconciliation=recon>=0?String(r[recon]||'').trim():'';
    const needsReview=!!((stored>=0&&latest>=0&&String(r[stored]||'')!==String(r[latest]||''))||!/^current$/i.test(wikiStatus)||!/^ok$/i.test(reconciliation));
    if(needsReview)categories.push('audit');
    const meta=(displayMeta||{})[name.toLowerCase()]||{};
    quests.push({
      name:name,completed:completed>=0&&/^(yes|true|complete|completed)$/i.test(String(r[completed]||'')),ready:ready>=0&&/^true$/i.test(String(r[ready]||'')),
      qp:Number(r[qp]||0),xp:xpText,items:itemText,unlocks:unlockText,rewardXp:rewardXp,categories:categories,
      difficulty:meta.difficulty||'',length:meta.length||'',downstream:Number(r[downstream]||0),accountScore:Number(r[score]||0),why:String(r[why]||''),missingSkills:clean(r[gap]),
      wikiUrl:url>=0?String(r[url]||''):'',lastVerified:checked>=0?String(r[checked]||''):'',wikiStatus:wikiStatus||'UNKNOWN',reconciliation:reconciliation||'UNKNOWN',needsReview:needsReview
    });
  });
  quests.sort((a,b)=>b.accountScore-a.accountScore||a.name.localeCompare(b.name));
  const review=quests.filter(x=>x.needsReview).length;
  return {quests:quests,audit:{current:quests.length-review,review:review,total:quests.length},generatedAt:new Date().toISOString()};
}

function readV131GoalProgress_(ss, goals, statsRows, account, requirementIntel, routeRows) {
  const out = {}, stats = {}, completed = new Set();
  (statsRows || []).forEach(r => stats[String(r[0] || '').trim().toLowerCase()] = Number(r[1] || 0));
  let table = null;
  try {
    table = v115QuestTable_(ss);
    table.vals.slice(table.headerRow + 1).forEach(r => {
      if (/^(yes|true|complete|completed)$/i.test(String(r[table.cCol] || ''))) completed.add(String(r[table.qCol] || '').trim().toLowerCase());
    });
  } catch (e) {}

  const depSheet = ss.getSheetByName('Quest Dependency'), depRows = depSheet ? depSheet.getDataRange().getDisplayValues() : [];
  let headerRow = -1, headers = [];
  for (let i = 0; i < Math.min(depRows.length, 10); i++) {
    if (depRows[i].some(x => /^quest name$/i.test(String(x || '').trim()))) { headerRow = i; headers = depRows[i]; break; }
  }
  const col = name => headers.findIndex(x => String(x || '').trim().toLowerCase() === name);
  const qCol = col('quest name'), prereqCol = col('direct prior quest requirement(s)'), otherCol = col('other requirements');
  const questInfo = {}, questNames = [];
  if (headerRow >= 0 && qCol >= 0) depRows.slice(headerRow + 1).forEach(r => {
    const name = String(r[qCol] || '').trim();
    if (name) { questNames.push(name); questInfo[name.toLowerCase()] = {prereq:String(r[prereqCol] || ''), other:String(r[otherCol] || '')}; }
  });
  const currentQp = Number(account['Quest Points'] || 0), totalQuests = questNames.length || 1;
  const routeReady = (routeRows || []).filter(r => Number(r[6] || 0) <= 0).length, routeTotal = (routeRows || []).length || 1;
  const dim = (label,current,target,detail) => ({label:label,current:current,target:target,percent:target ? Math.min(100,Math.round(current/target*100)) : 100,detail:detail});

  (goals || []).forEach(goal => {
    const dimensions = [], weighted = [];
    if (/^accomplished$/i.test(goal.status || '')) {
      out[goal.name.toLowerCase()] = {percent:100,status:'Accomplished',dimensions:[dim('Goal status',1,1,'Marked accomplished')]};
      return;
    }
    const anchor = String(goal.anchor || '').trim(), anchorKey = anchor.toLowerCase(), info = questInfo[anchorKey];
    if (anchor && info) {
      const anchorDone = completed.has(anchorKey) ? 1 : 0;
      dimensions.push(dim('Anchor quest',anchorDone,1,anchorDone ? `${anchor} complete` : `${anchor} incomplete`)); weighted.push({value:anchorDone*100,weight:40});
      const prereqs = questNames.filter(name => info.prereq.toLowerCase().indexOf(name.toLowerCase()) >= 0);
      if (prereqs.length) {
        const done = prereqs.filter(name => completed.has(name.toLowerCase())).length;
        dimensions.push(dim('Direct prerequisites',done,prereqs.length,`${done} of ${prereqs.length} complete`)); weighted.push({value:done/prereqs.length*100,weight:25});
      }
      const req = (requirementIntel || {})[anchorKey], skills = req && req.requiredSkills ? req.requiredSkills : [];
      if (skills.length) {
        const met = skills.filter(x => Number(stats[String(x.skill || '').toLowerCase()] || 0) >= Number(x.level || 0)).length;
        dimensions.push(dim('Base skill requirements',met,skills.length,`${met} of ${skills.length} met`)); weighted.push({value:met/skills.length*100,weight:25});
      }
      const qpMatch = /quest points?\s+(\d+)/i.exec(info.other || '');
      if (qpMatch) {
        const targetQp = Number(qpMatch[1]);
        dimensions.push(dim('Quest-point gate',Math.min(currentQp,targetQp),targetQp,`${currentQp} of ${targetQp} QP`)); weighted.push({value:Math.min(100,currentQp/targetQp*100),weight:10});
      }
    } else {
      dimensions.push(dim('Account quest completion',completed.size,totalQuests,`${completed.size} of ${totalQuests} quests complete`));
      dimensions.push(dim('Displayed route ready',routeReady,routeTotal,`${routeReady} of ${routeTotal} steps ready now`));
      weighted.push({value:completed.size/totalQuests*100,weight:70},{value:routeReady/routeTotal*100,weight:30});
    }
    const weightTotal = weighted.reduce((s,x) => s+x.weight,0) || 1;
    const percent = Math.round(weighted.reduce((s,x) => s+x.value*x.weight,0)/weightTotal);
    out[goal.name.toLowerCase()] = {percent:Math.max(0,Math.min(100,percent)),status:percent>=100?'Ready to complete':percent>=70?'Close':percent>=35?'In progress':'Early progress',dimensions:dimensions};
  });
  return out;
}

function readV129QuestDisplayMeta_(sh) {
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, Math.min(199, sh.getLastRow() - 1), 6).getDisplayValues().forEach(r => {
    const quest = String(r[0] || '').trim();
    if (quest) out[quest.toLowerCase()] = {difficulty:String(r[4] || '').trim(), length:String(r[5] || '').trim()};
  });
  return out;
}

function readV128BossPlanner_(ss, statsRows) {
  const stats = {};
  (statsRows || []).forEach(r => stats[String(r[0] || '').trim().toLowerCase()] = Number(r[1] || 0));
  const completed = new Set();
  try {
    const t = v115QuestTable_(ss);
    t.vals.slice(t.headerRow + 1).forEach(r => {
      if (/^(yes|true|complete|completed)$/i.test(String(r[t.cCol] || ''))) completed.add(String(r[t.qCol] || '').trim().toLowerCase());
    });
  } catch (e) {}

  const definitions = [
    {name:'Scurrius',stage:'Beginning',access:'None',goal:'Combat Growth',stats:{Attack:45,Strength:45,Defence:40,Hitpoints:50,Prayer:43},style:'Melee',gear:'Rune weapon and armour or better',prep:'Protection prayers, food, combat potion',notes:'Excellent mechanics practice with forgiving deaths and strong combat XP.'},
    {name:'Barrows',stage:'Beginning',access:'Priest in Peril',goal:'Combat Growth',stats:{Magic:50,Prayer:43,Defence:50,Hitpoints:60},style:'Magic',gear:'Iban\'s staff or a powered staff; tank armour',prep:'Prayer potions, food, emergency teleport',notes:'Prayer management and efficient brother routing matter more than perfect gear.'},
    {name:'Giant Mole',stage:'Beginning',access:'None',goal:'Combat Growth',stats:{Attack:60,Strength:60,Defence:50,Hitpoints:60,Prayer:43},style:'Melee',gear:'Dragon weapon or better; Falador shield helps track it',prep:'Protection prayers, stamina and food',notes:'A straightforward introduction to repeatable boss trips.'},
    {name:'Moons of Peril',stage:'Mid-game',access:'Children of the Sun',goal:'Combat Growth',stats:{Attack:65,Strength:65,Defence:65,Hitpoints:65,Prayer:43},style:'Melee',gear:'Three melee setups that cover stab, slash and crush',prep:'Supplies can be gathered inside the dungeon',notes:'Defence and weapon-style coverage are especially valuable here.'},
    {name:'Sarachnis',stage:'Mid-game',access:'Priest in Peril',goal:'Combat Growth',stats:{Attack:65,Strength:65,Defence:60,Hitpoints:65,Prayer:43},style:'Crush',gear:'Dragon mace or stronger crush weapon',prep:'Prayer potions, food, antipoison',notes:'Good practice for prayer switching, add control and movement.'},
    {name:'Zulrah',stage:'Mid-game',access:'Regicide',goal:'Combat Growth',stats:{Ranged:75,Magic:75,Defence:70,Hitpoints:75,Prayer:45},style:'Ranged + Magic',gear:'Two compact combat switches; anti-venom protection',prep:'Food, prayer, recoil effect and emergency teleport',notes:'Rotation learning is a separate skill from stat readiness.'},
    {name:'Vorkath',stage:'Advanced',access:'Dragon Slayer II',goal:'Dragon Slayer II',stats:{Ranged:80,Defence:75,Hitpoints:80,Prayer:74},style:'Ranged',gear:'Dragon hunter or strong crossbow setup; salve amulet',prep:'Antifire, anti-venom, prayer and crumble undead',notes:'Access is a hard quest gate; movement and special-attack handling still require practice.'},
    {name:'Phantom Muspah',stage:'Advanced',access:'Secrets of the North',goal:'Combat Growth',stats:{Ranged:85,Magic:80,Defence:75,Hitpoints:80,Prayer:70},style:'Ranged + Magic',gear:'Strong ranged setup with an optional magic switch',prep:'Prayer, stamina, food and emergency teleport',notes:'Consistent movement and prayer switching are core readiness factors.'},
    {name:'Corrupted Gauntlet',stage:'Advanced',access:'Song of the Elves',goal:'Prifddinas',stats:{Attack:80,Strength:80,Defence:80,Ranged:80,Magic:80,Hitpoints:80,Prayer:70},style:'All combat styles',gear:'No bank gear required; prep occurs inside',prep:'Learn resource routing, Hunllef prayers and floor patterns',notes:'Stats help, but preparation speed and mechanics determine success.'},
    {name:'Tombs of Amascut (Entry)',stage:'Raids',access:'Beneath Cursed Sands',goal:'Tombs of Amascut Access',stats:{Attack:75,Strength:75,Defence:70,Ranged:75,Magic:75,Hitpoints:75,Prayer:70},style:'All combat styles',gear:'Melee, ranged and magic setups with modest switches',prep:'Food, prayer, potions and an invocation level suited to practice',notes:'Entry Mode scales down well; raise invocations as mechanics become consistent.'}
  ];

  return definitions.map(b => {
    const skillRows = Object.keys(b.stats).map(skill => ({skill:skill,current:Number(stats[skill.toLowerCase()] || 0),recommended:b.stats[skill]}));
    const statsReady = skillRows.every(x => x.current >= x.recommended);
    const accessReady = b.access === 'None' || completed.has(b.access.toLowerCase());
    return Object.assign({}, b, {skillRows:skillRows,statsReady:statsReady,accessReady:accessReady,status:accessReady?(statsReady?'Recommended stats met':'Stat preparation'):'Access quest needed'});
  });
}

function v122SkillPairs_(text) {
  const skills=[
    'Attack','Strength','Defence','Ranged','Prayer','Magic','Runecraft',
    'Construction','Hitpoints','Agility','Herblore','Thieving','Crafting',
    'Fletching','Slayer','Hunter','Mining','Smithing','Fishing','Cooking',
    'Firemaking','Woodcutting','Farming','Sailing'
  ];
  const s=String(text||'');
  const out=[];
  skills.forEach(skill=>{
    const escSkill=skill.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    let m=new RegExp('\\b'+escSkill+'\\s+(\\d+)\\*?','i').exec(s);
    if(!m) m=new RegExp('\\b(\\d+)\\s+'+escSkill+'\\b','i').exec(s);
    if(m) out.push({skill:skill,level:Number(m[1])});
  });
  return out;
}

function v122OptionalKind_(text) {
  const s=String(text||'').toLowerCase();
  if(s.indexOf('recommended')>=0) return 'Recommended';
  if(/alternative|avoidable|avoid|route|only needed|if you|if mining|if crafting|if making/.test(s)) return 'Alternative route';
  return 'Optional';
}

function readV122QuestMeta_(sh) {
  const result={rewards:{},requirements:{}};
  if(!sh||sh.getLastRow()<1)return result;

  const v=sh.getDataRange().getDisplayValues();
  let hr=-1,h=[];
  for(let i=0;i<Math.min(v.length,15);i++){
    const r=v[i].map(x=>String(x||'').trim());
    if(r.some(x=>/^quest name$/i.test(x))){hr=i;h=r;break}
  }
  if(hr<0)return result;

  const first=res=>{for(let i=0;i<h.length;i++)if(res.some(r=>r.test(String(h[i]||'').trim())))return i;return -1};
  const q=first([/^quest name$/i]);
  const qp=first([/^quest points reward$/i,/^quest points$/i]);
  const xp=first([/^xp rewards?$/i]);
  const it=first([/^item \/ coin rewards?$/i]);
  const un=first([/^unlocks \/ other rewards?$/i]);
  const hard=first([/^skill level requirements?$/i,/^skill requirements?$/i]);
  const boost=first([/^boostable skill requirements?$/i]);
  const optional=first([/^conditional \/ alternative requirements$/i]);

  v.slice(hr+1).forEach(r=>{
    const name=q>=0?String(r[q]||'').trim():'';
    if(!name)return;
    const key=name.toLowerCase();

    result.rewards[key]={
      qp:qp>=0?String(r[qp]||'').trim():'',
      xp:xp>=0?String(r[xp]||'').trim():'',
      items:it>=0?String(r[it]||'').trim():'',
      unlocks:un>=0?String(r[un]||'').trim():''
    };

    const hardText=hard>=0?String(r[hard]||'').trim():'';
    const boostText=boost>=0?String(r[boost]||'').trim():'';
    const optionalText=optional>=0?String(r[optional]||'').trim():'';
    const boostPairs=v122SkillPairs_(boostText);
    const boostSkills=new Set(boostPairs.map(x=>x.skill.toLowerCase()));

    result.requirements[key]={
      quest:name,
      hardText:hardText,
      boostableText:boostText,
      optionalText:optionalText,
      requiredSkills:v122SkillPairs_(hardText).map(x=>({
        skill:x.skill,
        level:x.level,
        boostable:boostSkills.has(x.skill.toLowerCase()),
        planning:'Base level'
      })),
      optionalSkills:v122SkillPairs_(optionalText).map(x=>({
        skill:x.skill,
        level:x.level,
        kind:v122OptionalKind_(optionalText),
        why:optionalText
      })),
      planningMode:'Base levels only'
    };
  });

  return result;
}

function refreshQuestHelperIfStaleV122() {
  if(typeof syncQuestHelperRouteRequirements!=='function')return {ok:true,refreshed:false,reason:'Quest Helper sync unavailable'};
  const props=PropertiesService.getScriptProperties();
  const last=Number(props.getProperty('QH_ROUTE_SYNC_MS_V2')||0);
  if(last && Date.now()-last<=6*60*60*1000)return {ok:true,refreshed:false,reason:'Quest Helper cache is fresh'};
  const result=syncQuestHelperRouteRequirements();
  return {ok:true,refreshed:true,result:result};
}

function v122ColLetter_(n) {
  let s='';
  while(n>0){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26);}
  return s;
}

function completeV122QuestsFast(quests,source) {
  if(!Array.isArray(quests)||!quests.length)throw new Error('Select at least one quest.');

  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);
  const t=v115QuestTable_(ss);
  const wanted=new Set(quests.map(x=>String(x).toLowerCase()));
  const changed=[],addresses=[];
  const col=v122ColLetter_(t.cCol+1);

  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    if(wanted.has(quest.toLowerCase())&&!/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||''))){
      changed.push(quest);
      addresses.push(col+String(t.headerRow+2+idx));
    }
  });

  if(!changed.length)throw new Error('No incomplete quests matched the selection.');
  t.sh.getRangeList(addresses).setValue('Yes');

  let log=ss.getSheetByName('Quest Completion Log');
  if(!log){
    log=ss.insertSheet('Quest Completion Log');
    log.getRange(1,1,1,6).setValues([['Timestamp','Quest','Previous Status','New Status','Source','Transaction ID']]);
  }

  const tx=Utilities.getUuid(),now=new Date(),src=source||'Dashboard Manual';
  const logRows=changed.map(q=>[now,q,'No','Yes',src,tx]);
  log.getRange(log.getLastRow()+1,1,logRows.length,6).setValues(logRows);

  SpreadsheetApp.flush();

  PropertiesService.getScriptProperties().setProperty(
    'V115_LAST_RECONCILED_QP',
    String(v115CurrentTrackerQp_(ss))
  );

  const dashboard=getV1DashboardState({allowQuestHelperSync:false});
  return {ok:true,changed:changed,transactionId:tx,dashboard:dashboard};
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

function setV127GoalStatus_(goalName, newStatus) {
  goalName = String(goalName || '').trim();
  newStatus = String(newStatus || '').toUpperCase();
  if (!goalName) throw new Error('Choose a goal first.');
  if (goalName === 'Balanced') throw new Error('Balanced is the permanent fallback goal and cannot be completed.');
  if (['ACTIVE','ACCOMPLISHED'].indexOf(newStatus) === -1) throw new Error('Unknown goal status.');

  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const sh = ss.getSheetByName('Goal Registry');
  const rows = sh.getRange('A5:P200').getDisplayValues();
  const index = rows.findIndex(r => String(r[0] || '').trim() === goalName);
  if (index < 0) throw new Error('Unknown goal: ' + goalName);

  const row = index + 5;
  const previous = String(rows[index][15] || 'ACTIVE').toUpperCase();
  if (previous === newStatus) return getV1DashboardState({allowQuestHelperSync:false});
  sh.getRange(row, 16).setValue(newStatus);

  let log = ss.getSheetByName('Goal Completion Log');
  if (!log) {
    log = ss.insertSheet('Goal Completion Log');
    log.getRange(1,1,1,6).setValues([['Timestamp','Goal','Previous Status','New Status','Source','Transaction ID']]);
  }
  log.appendRow([new Date(), goalName, previous, newStatus, 'Dashboard Goal Manager', Utilities.getUuid()]);

  const dash = ss.getSheetByName('Dashboard');
  if (newStatus === 'ACCOMPLISHED' && dash.getRange('B3').getDisplayValue() === goalName) {
    dash.getRange('B3').setValue('Balanced');
  }
  SpreadsheetApp.flush();
  Utilities.sleep(150);
  return getV1DashboardState({allowQuestHelperSync:false});
}

function completeV127Goal(goalName) {
  return setV127GoalStatus_(goalName, 'ACCOMPLISHED');
}

function restoreV127Goal(goalName) {
  return setV127GoalStatus_(goalName, 'ACTIVE');
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

  const incomplete=[],completed=[];
  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    if(!quest)return;
    const done=/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'').trim());
    const item={
      quest,
      qp:t.qpCol>=0 ? Number(r[t.qpCol]||0) : 0,
      row:t.headerRow+2+idx
    };
    (done?completed:incomplete).push(item);
  });
  incomplete.sort((a,b)=>a.quest.localeCompare(b.quest));
  completed.sort((a,b)=>a.quest.localeCompare(b.quest));

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
    completed,
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

function uncompleteV124QuestsFast(quests,source){
  if(!Array.isArray(quests)||!quests.length)throw new Error('Select at least one completed quest.');

  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);
  const t=v115QuestTable_(ss);
  const wanted=new Set(quests.map(x=>String(x).trim().toLowerCase()).filter(Boolean));
  const changed=[],addresses=[];
  const col=v122ColLetter_(t.cCol+1);

  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    const done=/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'').trim());
    if(wanted.has(quest.toLowerCase())&&done){
      changed.push(quest);
      addresses.push(col+String(t.headerRow+2+idx));
    }
  });

  if(!changed.length)throw new Error('No completed quests matched the selection.');
  t.sh.getRangeList(addresses).setValue('No');

  let log=ss.getSheetByName('Quest Completion Log');
  if(!log){
    log=ss.insertSheet('Quest Completion Log');
    log.getRange(1,1,1,6).setValues([['Timestamp','Quest','Previous Status','New Status','Source','Transaction ID']]);
  }

  const tx=Utilities.getUuid(),now=new Date(),src=source||'Dashboard Correction';
  const logRows=changed.map(q=>[now,q,'Yes','No',src,tx]);
  log.getRange(log.getLastRow()+1,1,logRows.length,6).setValues(logRows);
  SpreadsheetApp.flush();

  PropertiesService.getScriptProperties().setProperty(
    'V115_LAST_RECONCILED_QP',
    String(v115CurrentTrackerQp_(ss))
  );

  const dashboard=getV1DashboardState({allowQuestHelperSync:false});
  return {ok:true,changed,transactionId:tx,state:getV115QuestCompletionState_(),dashboard};
}

function undoV115QuestCompletion(transactionId){
  if(!transactionId)throw new Error('Undo transaction ID is required.');
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),log=ss.getSheetByName('Quest Completion Log');
  if(!log)throw new Error('No quest completion log exists.');

  const lv=log.getDataRange().getDisplayValues();
  const quests=lv.slice(1).filter(r=>r[5]===transactionId&&String(r[3]).toLowerCase()==='yes').map(r=>r[1]);
  if(!quests.length)throw new Error('Completion transaction not found.');
  return uncompleteV124QuestsFast(quests,'Dashboard Immediate Undo');
}
