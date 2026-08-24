const QH_TRACKER_ID = '18cUN2RTytdinH9kpgqQhz9OZsKRpHrVAB2hiUotznKU';
const QH_REPO = 'Zoinkwiz/quest-helper';
const QH_BRANCH = 'master';
const QH_CACHE_SHEET = 'Quest Helper Cache';

function qhMaybeSyncRoute_() {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('QH_ROUTE_SYNC_MS') || 0);
  const maxAgeMs = 6 * 60 * 60 * 1000;
  if (Date.now() - last < maxAgeMs) return;
  try {
    syncQuestHelperRouteRequirements();
  } catch (e) {
    console.error('Quest Helper prototype sync failed: ' + (e && e.message ? e.message : e));
  }
}

function syncQuestHelperRouteRequirements() {
  const ss = SpreadsheetApp.openById(QH_TRACKER_ID);
  const dash = ss.getSheetByName('Dashboard');
  const cache = ss.getSheetByName(QH_CACHE_SHEET) || ss.insertSheet(QH_CACHE_SHEET);

  const routeQuests = dash.getRange('B60:B69').getDisplayValues()
    .flat()
    .map(String)
    .map(s => s.trim())
    .filter(Boolean);

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
      parsed.forEach(x => {
        rows.push([
          quest,
          x.variable || '',
          x.item || '',
          x.qty || 1,
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
        ]);
      });
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

  PropertiesService.getScriptProperties().setProperty('QH_ROUTE_SYNC_MS', String(Date.now()));
  return {
    ok: true,
    quests: routeQuests.length,
    rows: rows.length,
    commit: commit,
    syncedAt: now.toISOString()
  };
}

function qhGetTree_() {
  const cache = CacheService.getScriptCache();
  const key = 'QH_TREE_V1';
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const commitResp = qhFetchJson_('https://api.github.com/repos/' + QH_REPO + '/commits/' + QH_BRANCH);
  const sha = commitResp && commitResp.sha ? commitResp.sha : QH_BRANCH;
  const tree = qhFetchJson_('https://api.github.com/repos/' + QH_REPO + '/git/trees/' + sha + '?recursive=1');

  const paths = (tree.tree || [])
    .filter(x => x && x.type === 'blob' && /\.java$/i.test(x.path || ''))
    .map(x => x.path)
    .filter(p => p.indexOf('src/main/java/com/questhelper/helpers/quests/') === 0);

  const result = {sha: sha, paths: paths};
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

  for (let i = 0; i < Math.min(candidates.length, 8); i++) {
    try {
      const source = qhFetchText_('https://raw.githubusercontent.com/' + QH_REPO + '/' + QH_BRANCH + '/' + candidates[i]);
      if (/extends\s+(BasicQuestHelper|ComplexStateQuestHelper|PlayerMadeQuestHelper)/.test(source)) return candidates[i];
    } catch (e) {}
  }
  return candidates[0];
}

function qhParseQuestSource_(quest, path, source) {
  const sectionByVar = qhVariableSections_(source);
  const requiredVars = qhMethodVars_(source, 'getItemRequirements');
  const recommendedVars = qhMethodVars_(source, 'getItemRecommended');

  const byVar = {};
  const re = /([A-Za-z_]\w*)\s*=\s*new\s+ItemRequirement\s*\(\s*"((?:\\.|[^"\\])*)"\s*,\s*ItemID\.[A-Z0-9_]+(?:\s*,\s*([0-9]+))?[\s\S]*?\)\s*((?:\.[A-Za-z_]\w*\([^;]*?\))*)\s*;/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const variable = m[1];
    const item = qhUnescapeJava_(m[2]);
    const qty = Number(m[3] || 1);
    const chain = m[4] || '';
    byVar[variable] = {
      variable: variable,
      item: item,
      qty: qty,
      section: sectionByVar[variable] || '',
      obtainDuringQuest: false,
      reusable: /\.isNotConsumed\s*\(/.test(chain),
      tooltip: '',
      raw: m[0].replace(/\s+/g,' ').trim(),
      status: '',
      notes: ''
    };
  }

  // quantity aliases: foo = bar.quantity(3);
  const qtyAlias = /([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\.quantity\s*\(\s*([0-9]+)\s*\)\s*;/g;
  while ((m = qtyAlias.exec(source)) !== null) {
    const variable = m[1], base = m[2], qty = Number(m[3]);
    if (byVar[base]) {
      byVar[variable] = Object.assign({}, byVar[base], {
        variable: variable,
        qty: qty,
        section: sectionByVar[variable] || byVar[base].section || '',
        raw: m[0].replace(/\s+/g,' ').trim()
      });
    }
  }

  Object.keys(byVar).forEach(v => {
    const escV = qhRegexEscape_(v);
    if (new RegExp('\\b' + escV + '\\.canBeObtainedDuringQuest\\s*\\(\\s*\\)').test(source)) {
      byVar[v].obtainDuringQuest = true;
    }
    if (new RegExp('\\b' + escV + '\\.isNotConsumed\\s*\\(\\s*\\)').test(source)) {
      byVar[v].reusable = true;
    }
    const tip = new RegExp('\\b' + escV + '\\.setTooltip\\s*\\(\\s*"((?:\\\\.|[^"\\\\])*)"\\s*\\)').exec(source);
    if (tip) byVar[v].tooltip = qhUnescapeJava_(tip[1]);

    if (requiredVars.indexOf(v) >= 0) {
      byVar[v].status = 'REQUIRED';
      byVar[v].section = 'Required';
    } else if (recommendedVars.indexOf(v) >= 0) {
      byVar[v].status = 'RECOMMENDED';
      byVar[v].section = 'Recommended';
    } else {
      const sec = String(byVar[v].section || '').toLowerCase();
      byVar[v].status = sec.indexOf('mid') >= 0 ? 'MID-QUEST' : (sec ? sec.toUpperCase() : 'UNCLASSIFIED');
    }
  });

  return Object.keys(byVar).map(k => byVar[k]);
}

function qhVariableSections_(source) {
  const lines = source.split(/\r?\n/);
  const out = {};
  let section = '';
  let decl = '';

  lines.forEach(line => {
    const t = line.trim();
    if (/^\/\/.*recommended/i.test(t)) section = 'Recommended';
    else if (/^\/\/.*mid[\s-]*quest/i.test(t)) section = 'Mid-quest';
    else if (/^\/\/.*required/i.test(t) && /item/i.test(t)) section = 'Required';

    if (decl) {
      decl += ' ' + t;
      if (t.indexOf(';') >= 0) {
        qhRecordDeclaration_(decl, section, out);
        decl = '';
      }
      return;
    }

    if (/\bItemRequirement\b/.test(t) && !/=/.test(t)) {
      decl = t;
      if (t.indexOf(';') >= 0) {
        qhRecordDeclaration_(decl, section, out);
        decl = '';
      }
    }
  });
  return out;
}

function qhRecordDeclaration_(decl, section, out) {
  let body = decl.replace(/.*?\bItemRequirement\b/, '').replace(/;.*/, '');
  body.split(',').map(s => s.trim()).forEach(v => {
    const m = /([A-Za-z_]\w*)$/.exec(v);
    if (m) out[m[1]] = section;
  });
}

function qhMethodVars_(source, methodName) {
  const at = source.indexOf(methodName + '(');
  if (at < 0) return [];
  const body = qhExtractBraceBody_(source, at);
  if (!body) return [];

  let m = /return\s+(?:Arrays\.asList|List\.of)\s*\(([\s\S]*?)\)\s*;/m.exec(body);
  if (!m) m = /return\s+new\s+ArrayList\s*<[^>]*>\s*\(\s*(?:Arrays\.asList|List\.of)\s*\(([\s\S]*?)\)\s*\)\s*;/m.exec(body);
  if (!m) return [];

  return m[1].split(',')
    .map(x => x.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/g,'').trim())
    .map(x => {
      const mm = /^([A-Za-z_]\w*)/.exec(x);
      return mm ? mm[1] : '';
    })
    .filter(Boolean);
}

function qhExtractBraceBody_(source, startAt) {
  const open = source.indexOf('{', startAt);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source.charAt(i);
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.substring(open + 1, i);
    }
  }
  return '';
}

function qhFetchJson_(url) {
  const text = qhFetchText_(url);
  return JSON.parse(text);
}

function qhFetchText_(url) {
  const r = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'Accept': 'application/vnd.github+json,text/plain,*/*',
      'User-Agent': 'Sensum-OSRS-Dashboard-QuestHelper-Audit/1.0'
    }
  });
  const code = r.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('HTTP ' + code + ' for ' + url);
  return r.getContentText();
}

function qhNorm_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
}

function qhRegexEscape_(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function qhUnescapeJava_(s) {
  return String(s || '')
    .replace(/\\"/g,'"')
    .replace(/\\n/g,' ')
    .replace(/\\t/g,' ')
    .replace(/\\\\/g,'\\');
}
