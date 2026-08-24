const QH_TRACKER_ID = '18cUN2RTytdinH9kpgqQhz9OZsKRpHrVAB2hiUotznKU';
const QH_REPO = 'Zoinkwiz/quest-helper';
const QH_BRANCH = 'master';
const QH_CACHE_SHEET = 'Quest Helper Cache';
const QH_RECON_SHEET = 'Quest Prep Reconciled';

function qhMaybeSyncRoute_() {
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
}

function syncQuestHelperRouteRequirements() {
  const ss = SpreadsheetApp.openById(QH_TRACKER_ID);
  const dash = ss.getSheetByName('Dashboard');
  const cache = ss.getSheetByName(QH_CACHE_SHEET) || ss.insertSheet(QH_CACHE_SHEET);

  const routeQuests = dash.getRange('B60:B69').getDisplayValues()
    .flat().map(String).map(s => s.trim()).filter(Boolean);

  const treeInfo = qhGetTree_();
  const commit = treeInfo.sha || '';
  const paths = treeInfo.paths || [];
  const now = new Date();
  const rows = [];

  routeQuests.forEach(quest => {
    const resolved = qhResolveQuestSource_(quest, paths);
    if (!resolved) {
      rows.push([quest,'','','','',false,false,'','',commit,now,'','NO SOURCE','No matching Quest Helper source file found']);
      return;
    }

    try {
      const source = qhFetchText_('https://raw.githubusercontent.com/' + QH_REPO + '/' + QH_BRANCH + '/' + resolved);
      const parsed = qhParseQuestSource_(quest, resolved, source);
      if (!parsed.length) {
        rows.push([quest,'','','','',false,false,'',resolved,commit,now,'','PARSE EMPTY','Source found, but no ItemRequirement assignments were parsed']);
        return;
      }
      parsed.forEach(x => rows.push([
        quest,
        x.variable || '',
        x.item || '',
        x.qty === '' ? '' : (x.qty || 1),
        x.section || '',
        !!x.obtainDuringQuest,
        !!x.reusable,
        x.tooltip || '',
        resolved,
        commit,
        now,
        x.raw || '',
        x.status || '',
        x.notes || ''
      ]));
    } catch (e) {
      rows.push([quest,'','','','',false,false,'',resolved,commit,now,'','ERROR',String(e && e.message ? e.message : e)]);
    }
  });

  cache.clearContents();
  cache.getRange(1,1,1,14).setValues([[
    'Quest','Variable','Item','Qty','Section','Obtain During Quest','Reusable',
    'Tooltip','Source Path','Source Commit','Last Sync','Raw Assignment','Status','Notes'
  ]]);
  if (rows.length) cache.getRange(2,1,rows.length,14).setValues(rows);
  cache.setFrozenRows(1);
  cache.autoResizeColumns(1,14);

  qhBuildReconciledPrep_(ss, rows, now, commit);

  PropertiesService.getScriptProperties().setProperty('QH_ROUTE_SYNC_MS_V2', String(Date.now()));
  return {ok:true, quests:routeQuests.length, rows:rows.length, commit:commit, syncedAt:now.toISOString()};
}

function qhBuildReconciledPrep_(ss, cacheRows, now, commit) {
  let sh = ss.getSheetByName(QH_RECON_SHEET);
  if (!sh) sh = ss.insertSheet(QH_RECON_SHEET);

  const wiki = qhReadWikiRouteItems_(ss);
  const routeOrder = {};
  const dash = ss.getSheetByName('Dashboard');
  dash.getRange('B60:B69').getDisplayValues().flat().forEach((q,i) => {
    if (q) routeOrder[String(q).trim().toLowerCase()] = i + 1;
  });

  const out = [];
  cacheRows.forEach(r => {
    const quest = String(r[0] || '');
    const variable = String(r[1] || '');
    const item = String(r[2] || '');
    const qtyRaw = r[3];
    const status = String(r[12] || '').toUpperCase();
    const obtain = r[5] === true;
    const reusable = r[6] === true;
    const tooltip = String(r[7] || '');
    if (!quest || !item || !status || /^(ERROR|NO SOURCE|PARSE EMPTY)$/.test(status)) return;

    const key = qhItemKey_(quest, item);
    const wikiRow = wiki[key] || null;
    const wikiAcq = wikiRow ? wikiRow.acquisition : '';
    const wikiType = wikiRow ? wikiRow.type : '';

    let prepClass = 'Internal / State';
    let mandatory = false;

    if (status === 'REQUIRED') {
      mandatory = true;
      prepClass = obtain ? 'Obtain During Quest' : 'Bring / Buy';
    } else if (status === 'RECOMMENDED') {
      prepClass = obtain ? 'Recommended - Obtain' : 'Recommended';
    } else if (status === 'MID-QUEST') {
      prepClass = 'Created / Obtained During Quest';
    }

    // Wiki can improve acquisition context without overriding QH's start-vs-midquest authority.
    if (mandatory && /obtain/i.test(wikiAcq)) prepClass = 'Obtain During Quest';

    let agreement = 'QH only';
    if (wikiRow) {
      if (status === 'REQUIRED') agreement = 'Both sources';
      else if (status === 'MID-QUEST') agreement = 'QH state + Wiki mention';
      else agreement = 'Both mention';
    }

    let qty = Number(qtyRaw);
    if (!isFinite(qty) || qty <= 0) qty = '';
    out.push([
      routeOrder[quest.toLowerCase()] || 999,
      quest,
      item,
      qty,
      prepClass,
      mandatory,
      reusable,
      status,
      variable,
      wikiAcq,
      wikiType,
      agreement,
      tooltip,
      commit,
      now
    ]);
  });

  // Deduplicate only the user-facing prep rows. Preserve the raw cache separately.
  const merged = new Map();
  out.forEach(r => {
    const quest = r[1], item = r[2], cls = r[4], mandatory = r[5], reusable = r[6];
    if (cls === 'Internal / State') return;
    const key = qhNorm_(quest) + '|' + qhNormDisplayItem_(item) + '|' + cls;
    if (!merged.has(key)) {
      merged.set(key, r.slice());
      return;
    }
    const prev = merged.get(key);
    const a = Number(prev[3] || 0), b = Number(r[3] || 0);
    if (reusable) prev[3] = Math.max(a,b) || '';
    else prev[3] = Math.max(a,b) || ''; // aliases/state variants should not sum inside one quest
    if (!prev[12] && r[12]) prev[12] = r[12];
    if (prev[11] === 'QH only' && r[11] !== 'QH only') prev[11] = r[11];
  });

  const finalRows = [...merged.values()].sort((a,b) =>
    a[0]-b[0] ||
    qhPrepSort_(a[4])-qhPrepSort_(b[4]) ||
    String(a[2]).localeCompare(String(b[2]))
  );

  sh.clearContents();
  sh.getRange(1,1,1,15).setValues([[
    'Route Step','Quest','Item','Qty','Prep Class','Mandatory','Reusable','QH Status',
    'QH Variable','Wiki Acquisition','Wiki Requirement Type','Source Agreement',
    'Notes / Tooltip','QH Commit','Last Reconciled'
  ]]);
  if (finalRows.length) sh.getRange(2,1,finalRows.length,15).setValues(finalRows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1,15);
}

function qhReadWikiRouteItems_(ss) {
  const sh = ss.getSheetByName('Route Shopping');
  if (!sh) return {};
  const last = Math.min(sh.getLastRow(), 600);
  if (last < 5) return {};
  const vals = sh.getRange(5,8,last-4,8).getDisplayValues(); // H:O detail parser
  const out = {};
  vals.forEach(r => {
    const quest = String(r[1] || '').trim();
    const item = String(r[4] || '').trim();
    if (!quest || !item) return;
    const key = qhItemKey_(quest,item);
    if (!out[key]) out[key] = {
      acquisition: String(r[6] || ''),
      type: String(r[7] || ''),
      raw: String(r[2] || '')
    };
  });
  return out;
}

function qhPrepSort_(s) {
  s = String(s || '');
  if (s === 'Bring / Buy') return 1;
  if (s === 'Obtain During Quest') return 2;
  if (s.indexOf('Recommended') === 0) return 3;
  if (s === 'Created / Obtained During Quest') return 4;
  return 9;
}

function qhGetTree_() {
  const cache = CacheService.getScriptCache();
  const key = 'QH_TREE_V2';
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const commitResp = qhFetchJson_('https://api.github.com/repos/' + QH_REPO + '/commits/' + QH_BRANCH);
  const sha = commitResp && commitResp.sha ? commitResp.sha : QH_BRANCH;
  const tree = qhFetchJson_('https://api.github.com/repos/' + QH_REPO + '/git/trees/' + sha + '?recursive=1');
  const paths = (tree.tree || [])
    .filter(x => x && x.type === 'blob' && /\.java$/i.test(x.path || ''))
    .map(x => x.path)
    .filter(p => p.indexOf('src/main/java/com/questhelper/helpers/quests/') === 0);

  const result = {sha:sha, paths:paths};
  const serialized = JSON.stringify(result);
  if (serialized.length < 95000) cache.put(key, serialized, 21600);
  return result;
}

function qhResolveQuestSource_(quest, paths) {
  const slug = qhNorm_(quest);
  const prefix = 'src/main/java/com/questhelper/helpers/quests/' + slug + '/';
  const candidates = paths.filter(p => p.toLowerCase().indexOf(prefix.toLowerCase()) === 0);
  if (!candidates.length) return '';

  const exact = candidates.find(p => {
    const file = p.split('/').pop().replace(/\.java$/i,'');
    return qhNorm_(file) === slug;
  });
  if (exact) return exact;

  for (let i=0;i<Math.min(candidates.length,8);i++) {
    try {
      const source = qhFetchText_('https://raw.githubusercontent.com/' + QH_REPO + '/' + QH_BRANCH + '/' + candidates[i]);
      if (/extends\s+(BasicQuestHelper|ComplexStateQuestHelper|PlayerMadeQuestHelper)/.test(source)) return candidates[i];
    } catch(e) {}
  }
  return candidates[0];
}

function qhParseQuestSource_(quest, path, source) {
  const sectionByVar = qhVariableSections_(source);
  const requiredInfo = qhMethodVars_(source, 'getItemRequirements');
  const recommendedInfo = qhMethodVars_(source, 'getItemRecommended');
  const requiredVars = requiredInfo.vars;
  const recommendedVars = recommendedInfo.vars;
  const hasExplicitLists = requiredInfo.found || recommendedInfo.found;

  const byVar = {};
  const re = /([A-Za-z_]\w*)\s*=\s*new\s+ItemRequirement\s*\(\s*"((?:\\.|[^"\\])*)"\s*,\s*ItemID\.[A-Z0-9_]+(?:\s*,\s*(-?[0-9]+))?[\s\S]*?\)\s*((?:\.[A-Za-z_]\w*\([^;]*?\))*)\s*;/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const variable = m[1];
    const item = qhUnescapeJava_(m[2]);
    const parsedQty = m[3] == null ? 1 : Number(m[3]);
    const chain = m[4] || '';
    byVar[variable] = {
      variable:variable,
      item:item,
      qty:parsedQty > 0 ? parsedQty : '',
      section:sectionByVar[variable] || '',
      obtainDuringQuest:false,
      reusable:/\.isNotConsumed\s*\(/.test(chain),
      tooltip:'',
      raw:m[0].replace(/\s+/g,' ').trim(),
      status:'',
      notes:parsedQty <= 0 ? 'Quest Helper uses a non-positive/special quantity; quantity intentionally left blank.' : ''
    };
  }

  const qtyAlias = /([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\.quantity\s*\(\s*(-?[0-9]+)\s*\)\s*;/g;
  while ((m = qtyAlias.exec(source)) !== null) {
    const variable=m[1], base=m[2], parsedQty=Number(m[3]);
    if (byVar[base]) byVar[variable] = Object.assign({}, byVar[base], {
      variable:variable,
      qty:parsedQty > 0 ? parsedQty : '',
      section:sectionByVar[variable] || byVar[base].section || '',
      raw:m[0].replace(/\s+/g,' ').trim(),
      notes:parsedQty <= 0 ? 'Quest Helper uses a non-positive/special quantity; quantity intentionally left blank.' : ''
    });
  }

  Object.keys(byVar).forEach(v => {
    const escV = qhRegexEscape_(v);
    if (new RegExp('\\b'+escV+'\\.canBeObtainedDuringQuest\\s*\\(\\s*\\)').test(source)) byVar[v].obtainDuringQuest = true;
    if (new RegExp('\\b'+escV+'\\.isNotConsumed\\s*\\(\\s*\\)').test(source)) byVar[v].reusable = true;
    const tip = new RegExp('\\b'+escV+'\\.setTooltip\\s*\\(\\s*"((?:\\\\.|[^"\\\\])*)"\\s*\\)').exec(source);
    if (tip) byVar[v].tooltip = qhUnescapeJava_(tip[1]);

    if (requiredVars.indexOf(v) >= 0) {
      byVar[v].status='REQUIRED'; byVar[v].section='Required';
    } else if (recommendedVars.indexOf(v) >= 0) {
      byVar[v].status='RECOMMENDED'; byVar[v].section='Recommended';
    } else if (hasExplicitLists) {
      const sec=String(byVar[v].section||'').toLowerCase();
      byVar[v].status=sec.indexOf('mid')>=0 ? 'MID-QUEST' : 'INTERNAL';
    } else {
      const sec=String(byVar[v].section||'').toLowerCase();
      byVar[v].status=sec.indexOf('mid')>=0 ? 'MID-QUEST' : (sec.indexOf('recommend')>=0 ? 'RECOMMENDED' : (sec.indexOf('required')>=0 ? 'REQUIRED' : 'UNCLASSIFIED'));
    }
  });

  return Object.keys(byVar).map(k=>byVar[k]);
}

function qhVariableSections_(source) {
  const lines=source.split(/\r?\n/), out={};
  let section='', decl='';
  lines.forEach(line => {
    const t=line.trim();
    if (/^\/\/.*recommended/i.test(t)) section='Recommended';
    else if (/^\/\/.*mid[\s-]*quest/i.test(t)) section='Mid-quest';
    else if (/^\/\/.*required/i.test(t) && /item/i.test(t)) section='Required';

    if (decl) {
      decl += ' ' + t;
      if (t.indexOf(';')>=0) { qhRecordDeclaration_(decl,section,out); decl=''; }
      return;
    }
    if (/\bItemRequirement\b/.test(t) && !/=/.test(t)) {
      decl=t;
      if (t.indexOf(';')>=0) { qhRecordDeclaration_(decl,section,out); decl=''; }
    }
  });
  return out;
}

function qhRecordDeclaration_(decl, section, out) {
  let body=decl.replace(/.*?\bItemRequirement\b/,'').replace(/;.*/,'');
  body.split(',').map(s=>s.trim()).forEach(v=>{
    const m=/([A-Za-z_]\w*)$/.exec(v);
    if(m) out[m[1]]=section;
  });
}

function qhMethodVars_(source, methodName) {
  const at=source.indexOf(methodName+'(');
  if(at<0) return {found:false,vars:[]};
  const body=qhExtractBraceBody_(source,at);
  if(!body) return {found:true,vars:[]};

  const vars=[];
  let m;

  // reqs.add(foo), list.add(foo), etc.
  const addRe=/\.\s*add\s*\(\s*([A-Za-z_]\w*)\s*(?:\.[A-Za-z_]\w*\([^)]*\))?\s*\)\s*;/g;
  while((m=addRe.exec(body))!==null) vars.push(m[1]);

  // addAll(Arrays.asList(foo, bar)) / addAll(List.of(...))
  const addAllRe=/\.addAll\s*\(\s*(?:Arrays\.asList|List\.of)\s*\(([\s\S]*?)\)\s*\)\s*;/g;
  while((m=addAllRe.exec(body))!==null) qhIdentifiersFromList_(m[1]).forEach(v=>vars.push(v));

  // direct return Arrays.asList(...) / List.of(...)
  const retRe=/return\s+(?:Arrays\.asList|List\.of)\s*\(([\s\S]*?)\)\s*;/g;
  while((m=retRe.exec(body))!==null) qhIdentifiersFromList_(m[1]).forEach(v=>vars.push(v));

  // Collections.singletonList(foo)
  const singleRe=/return\s+Collections\.singletonList\s*\(\s*([A-Za-z_]\w*)/g;
  while((m=singleRe.exec(body))!==null) vars.push(m[1]);

  return {found:true, vars:[...new Set(vars)]};
}

function qhIdentifiersFromList_(s) {
  return String(s||'').split(',')
    .map(x=>x.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/g,'').trim())
    .map(x=>{ const m=/^([A-Za-z_]\w*)/.exec(x); return m?m[1]:''; })
    .filter(Boolean);
}

function qhExtractBraceBody_(source,startAt) {
  const open=source.indexOf('{',startAt);
  if(open<0)return '';
  let depth=0;
  for(let i=open;i<source.length;i++){
    const c=source.charAt(i);
    if(c==='{')depth++;
    else if(c==='}'){depth--;if(depth===0)return source.substring(open+1,i);}
  }
  return '';
}

function qhFetchJson_(url){return JSON.parse(qhFetchText_(url));}

function qhFetchText_(url) {
  const r=UrlFetchApp.fetch(url,{
    muteHttpExceptions:true,followRedirects:true,
    headers:{'Accept':'application/vnd.github+json,text/plain,*/*','User-Agent':'Sensum-OSRS-Dashboard-QuestHelper-Audit/1.1'}
  });
  const code=r.getResponseCode();
  if(code<200||code>=300)throw new Error('HTTP '+code+' for '+url);
  return r.getContentText();
}

function qhNorm_(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function qhNormDisplayItem_(s){
  return String(s||'').toLowerCase()
    .replace(/\([^)]*\)/g,'')
    .replace(/\b(unnoted|highlighted|equipped)\b/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}
function qhItemKey_(quest,item){return qhNorm_(quest)+'|'+qhNormDisplayItem_(item);}
function qhRegexEscape_(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function qhUnescapeJava_(s){
  return String(s||'').replace(/\\"/g,'"').replace(/\\n/g,' ').replace(/\\t/g,' ').replace(/\\\\/g,'\\');
}

