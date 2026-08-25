from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
dash_path = ROOT / 'DashboardV1.js'
html_path = ROOT / 'V1.html'
qh_path = ROOT / 'QuestHelperSync.js'
trust_path = ROOT / 'QuestRequirementsTrust.js'

for p in (dash_path, html_path, qh_path, trust_path):
    if not p.exists():
        raise SystemExit(f'Missing required project file: {p.name}')

def read(p):
    return p.read_text(encoding='utf-8-sig')

def write(p, s):
    p.write_text(s, encoding='utf-8', newline='\n')

# ------------------------------------------------------------------
# Quest Helper source resolver: final weird-name exceptions.
# ------------------------------------------------------------------
qh = read(qh_path)
overrides = [
    ('gardenoftranquillity', 'src/main/java/com/questhelper/helpers/quests/gardenoftranquility/GardenOfTranquillity.java'),
    ('perilousmoons', 'src/main/java/com/questhelper/helpers/quests/perilousmoon/PerilousMoon.java'),
    ('ratcatchers', 'src/main/java/com/questhelper/helpers/quests/ratcatchers/RatCatchers.java'),
    ('anothersliceofham', 'src/main/java/com/questhelper/helpers/quests/anothersliceofham/AnotherSliceOfHam.java'),
    ('fairytaleiicureaqueen', 'src/main/java/com/questhelper/helpers/quests/fairytaleii/FairytaleII.java'),
    ('deserttreasureiithefallenempire', 'src/main/java/com/questhelper/helpers/quests/deserttreasureii/DesertTreasureII.java'),
]
if "'gardenoftranquillity'" not in qh:
    marker = '  const overrides = {'
    if marker not in qh:
        raise SystemExit('Could not locate qhDirectQuestPath_ override map.')
    lines = '\n'.join(f"    '{k}': '{v}'," for k, v in overrides)
    qh = qh.replace(marker, marker + '\n' + lines, 1)
write(qh_path, qh)

# ------------------------------------------------------------------
# V1.22 whole-dataset audit. Uses V1.20 policies plus final exceptions.
# ------------------------------------------------------------------
trust = read(trust_path).replace('â€”', '-').replace('â€“', '-')
if 'function qhInstallV122()' not in trust:
    trust += r"""

// V1.22 - Final Whole-Dataset Trust + Requirement Intelligence support
function qhV122Policy_(quest,dataset,qs,combat,path) {
  const base=(typeof qhV120Policy_==='function')
    ? qhV120Policy_(quest,dataset,qs,combat,path)
    : {qs:qs,alt:'',combat:combat,path:path,status:'',reason:''};

  if(base && base.status) return base;

  const slug=qhV118Norm_(quest);
  let alt='',status='',reason='';

  if(slug==='ragandbonemanii'){
    qs='40 SLAYER';
    alt='20 Defence is used by the normal mirror-shield route, but can be avoided by using a safe/freeze method against the basilisk.';
    status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki route policy: 40 Slayer is hard; 20 Defence belongs to an avoidable combat route.'
      :'Dataset differs from the OSRS Wiki hard-requirement interpretation.';
  }
  else if(slug==='throneofmiscellania'){
    qs='None';
    alt='Public support has several routes. Buying flowers can earn the required favour without a skill level, so Woodcutting/Farming/Mining/Fishing methods are alternatives.';
    status=qhV118SkillSet_(dataset)===''?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki route policy: no unavoidable skill requirement.'
      :'Dataset incorrectly treats an optional favour route as mandatory.';
  }
  else if(slug==='thefremennikexiles'){
    qs='65 CRAFTING; 60 SLAYER; 60 SMITHING; 60 FISHING; 55 RUNECRAFT';
    alt='60 Mining is only needed if you mine the lunar ores yourself; bringing the required lunar materials avoids the Mining level.';
    status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki route policy: 60 Mining is an alternative item-acquisition path, not a hard quest requirement.'
      :'Dataset differs from the OSRS Wiki hard-requirement interpretation.';
  }
  else if(slug==='inaidofthemyreque'){
    qs='25 AGILITY; 25 CRAFTING; 15 MINING; 7 MAGIC';
    status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki confirms 25 Agility, 25 Crafting, 15 Mining, and 7 Magic; Quest Helper parsing omitted Agility.'
      :'Dataset differs from current OSRS Wiki hard requirements.';
  }

  return {
    qs:qs || (base ? base.qs : ''),
    alt:alt || (base ? base.alt : ''),
    combat:combat || (base ? base.combat : ''),
    path:path || (base ? base.path : ''),
    status:status,
    reason:reason
  };
}

function qhV122RfdFallback_(dataset) {
  const qs=[
    '48 AGILITY','70 COOKING','40 CRAFTING','50 FIREMAKING','53 FISHING',
    '10 FLETCHING','25 HERBLORE','59 MAGIC','50 MINING','40 RANGED',
    '40 SMITHING','53 THIEVING','36 WOODCUTTING'
  ].join('; ');
  const status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
  return {
    qs:qs,
    alt:'',
    combat:'Ability to defeat multiple high-level monsters; several fights restrict Prayer.',
    status:status,
    reason:status==='VERIFIED'
      ?'Verified against the current OSRS Wiki aggregate requirements. Quest Helper models Recipe for Disaster as separate subquest helpers.'
      :'Dataset differs from the current OSRS Wiki aggregate requirements.',
    path:'OSRS Wiki aggregate; Quest Helper split across recipefordisaster/RFD*.java'
  };
}

function qhV122AuditBatch_(start,size) {
  start=Number(start||0);
  size=Math.min(25,Number(size||20));

  const ss=SpreadsheetApp.openById(QH_TRACKER_ID);
  const dep=ss.getSheetByName('Quest Dependency');
  const v=dep.getDataRange().getDisplayValues();

  let hr=-1,h=[];
  for(let i=0;i<Math.min(v.length,15);i++){
    const r=v[i].map(String);
    if(r.some(x=>/^quest name$/i.test(x.trim()))){hr=i;h=r;break}
  }
  if(hr<0) throw new Error('Quest Dependency header not found');

  const q=qhV118Header_(h,[/^quest name$/i]);
  const sk=qhV118Header_(h,[/^skill level requirements?$/i,/^skill requirements?$/i]);
  const rows=v.slice(hr+1).filter(r=>String(r[q]||'').trim());
  const sh=ss.getSheetByName('Quest Data Audit')||ss.insertSheet('Quest Data Audit');

  if(start===0){
    sh.clearContents();
    sh.getRange(1,1,1,9).setValues([[
      'Quest','Dataset Mandatory Skills','QH Mandatory Skills',
      'Conditional / Alternative Skills','Combat / Capability Requirements',
      'Status','Reason','QH Source','Checked At'
    ]]);
    sh.setFrozenRows(1);
  }

  const out=[];
  const end=Math.min(rows.length,start+size);

  for(let i=start;i<end;i++){
    const quest=String(rows[i][q]||'').trim();
    const dataset=sk>=0?String(rows[i][sk]||'').trim():'';
    const slug=qhV118Norm_(quest);

    let path='',qs='',alt='',combat='',status='REVIEW',reason='';

    try{
      if(slug==='recipefordisaster'){
        const rfd=qhV122RfdFallback_(dataset);
        qs=rfd.qs; alt=rfd.alt; combat=rfd.combat;
        status=rfd.status; reason=rfd.reason; path=rfd.path;
      }else{
        path=qhV118Path_(quest);
        const src=qhFetchText_('https://raw.githubusercontent.com/'+QH_REPO+'/'+QH_BRANCH+'/'+path);
        qs=qhV118Skills_(src);
        combat=qhV118Combat_(src);

        const policy=qhV122Policy_(quest,dataset,qs,combat,path);
        qs=policy.qs; alt=policy.alt; combat=policy.combat; path=policy.path;

        if(policy.status){
          status=policy.status;
          reason=policy.reason;
        }else{
          status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
          reason=status==='VERIFIED'
            ?'Dataset agrees with Quest Helper hard requirements.'
            :'Dataset and Quest Helper hard requirements differ.';
        }
      }
    }catch(e){
      if(slug==='learningtheropes'){
        path='OSRS Wiki fallback';
        qs='None';
        combat='2 Giant rats (level 3)';
        status=qhV118SkillSet_(dataset)===''?'VERIFIED':'REVIEW';
        reason=status==='VERIFIED'
          ?'OSRS Wiki confirms Learning the Ropes has no skill requirements; Quest Helper has no matching helper source.'
          :'Dataset differs from OSRS Wiki fallback.';
      }else{
        status='NO SOURCE';
        reason=String(e&&e.message?e.message:e);
      }
    }

    out.push([quest,dataset,qs,alt,combat,status,reason,path,new Date()]);
  }

  if(out.length) sh.getRange(sh.getLastRow()+1,1,out.length,9).setValues(out);
  sh.autoResizeColumns(1,9);

  const next=end>=rows.length?0:end;
  PropertiesService.getScriptProperties().setProperty('QH_V122_AUDIT_CURSOR',String(next));
  return {ok:true,start:start,end:end,total:rows.length,next:next,complete:end>=rows.length};
}

function qhV122ContinueAudit_() {
  const ss=SpreadsheetApp.openById(QH_TRACKER_ID);
  const sh=ss.getSheetByName('Quest Data Audit');
  let cursor=sh?Math.max(0,sh.getLastRow()-1):0;

  if(cursor===0){
    const seed=qhV122AuditBatch_(0,20);
    cursor=Number(seed.next||0);
    if(cursor===0) return {ok:true,complete:true,next:0,auditedRows:seed.end};
  }

  const started=Date.now();
  let batches=0,result=null;
  while(cursor!==0 && batches<8 && (Date.now()-started)<260000){
    result=qhV122AuditBatch_(cursor,20);
    cursor=Number(result.next||0);
    batches++;
  }

  return {
    ok:true,
    batchesProcessed:batches,
    next:cursor,
    complete:cursor===0,
    auditedRows:ss.getSheetByName('Quest Data Audit').getLastRow()-1,
    lastResult:result
  };
}

function qhV122ContinueAudit(){ return qhV122ContinueAudit_(); }

function qhInstallV122() {
  if(typeof qhV120FixDataset_==='function') qhV120FixDataset_();
  if(typeof qhV118FixFremennik_==='function') qhV118FixFremennik_();

  const first=qhV122AuditBatch_(0,20);
  let cursor=Number(first.next||0);
  const started=Date.now();
  let batches=0,result=first;

  while(cursor!==0 && batches<8 && (Date.now()-started)<260000){
    result=qhV122AuditBatch_(cursor,20);
    cursor=Number(result.next||0);
    batches++;
  }

  return {
    ok:true,
    version:'V1.22',
    first:first,
    additionalBatches:batches,
    next:cursor,
    complete:cursor===0,
    auditedRows:SpreadsheetApp.openById(QH_TRACKER_ID).getSheetByName('Quest Data Audit').getLastRow()-1,
    lastResult:result
  };
}
"""
write(trust_path, trust)

# ------------------------------------------------------------------
# Dashboard server: one Quest Dependency read for rewards + requirements,
# base-level planning, background QH refresh, one-trip manual completion.
# ------------------------------------------------------------------
dash = read(dash_path)

old_start = '''function getV1DashboardState() {
  if (typeof qhMaybeSyncRoute_ === 'function') {
    const props = PropertiesService.getScriptProperties();
    const lastQh = Number(props.getProperty('QH_ROUTE_SYNC_MS_V2') || 0);
    if (Date.now() - lastQh > 6 * 60 * 60 * 1000) qhMaybeSyncRoute_();
  }
'''
new_start = '''function getV1DashboardState(options) {
  options = options || {};
  // V1.22: interactive reads never block on a Quest Helper network sync.
'''
if old_start in dash:
    dash = dash.replace(old_start, new_start, 1)
elif 'function getV1DashboardState(options)' not in dash:
    raise SystemExit('Could not patch getV1DashboardState entry point.')

old_reward = '  const rewardMap = readV1QuestRewards_(questDependencySheet);'
new_reward = '''  const questMeta = readV122QuestMeta_(questDependencySheet);
  const rewardMap = questMeta.rewards;
  const requirementIntel = questMeta.requirements;'''
if old_reward in dash:
    dash = dash.replace(old_reward, new_reward, 1)

old_return = '''    shopping: readV1Shopping_(shoppingSheet, reconciledSheet),
    wikiHealth: readV1WikiHealth_(dash)'''
new_return = '''    shopping: readV1Shopping_(shoppingSheet, reconciledSheet),
    requirementIntel,
    planningMode:'Base levels only',
    wikiHealth: readV1WikiHealth_(dash)'''
if old_return in dash:
    dash = dash.replace(old_return, new_return, 1)
elif "planningMode:'Base levels only'" not in dash:
    raise SystemExit('Could not add V1.22 requirement intelligence to dashboard state.')

if 'function readV122QuestMeta_(' not in dash:
    insertion_point = 'function readV1QuestRewards_(sh) {'
    if insertion_point not in dash:
        raise SystemExit('Could not locate quest rewards parser insertion point.')
    helper = r"""function v122SkillPairs_(text) {
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

"""
    dash = dash.replace(insertion_point, helper + insertion_point, 1)

write(dash_path, dash)

# ------------------------------------------------------------------
# V1.html: requirement intelligence UI + non-blocking save experience.
# ------------------------------------------------------------------
html = read(html_path)
html = re.sub(r'V1\.(?:20|21)\s*·\s*Trust the Numbers', 'V1.22 · Know What Is Optional', html, count=1)

if 'id="v122RequirementStyles"' not in html:
    css = r"""
<style id="v122RequirementStyles">
.reqIntelStep{grid-column:1/-1!important;min-height:auto!important}
.reqIntel{display:grid;gap:8px;margin-top:6px}
.reqMode{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:7px 9px;background:#efe7d7;border:1px solid #d5c2a1;border-radius:8px;font-size:10px;color:#5e4c37}
.reqMode b{color:#3f2a16}.reqModePill{display:inline-flex;padding:4px 7px;border-radius:999px;background:#3d2514;color:#ffe0a0;font-weight:900;text-transform:uppercase;font-size:9px}
.reqSection{display:grid;gap:6px}.reqSectionTitle{font-size:9px;text-transform:uppercase;font-weight:950;letter-spacing:.55px;color:#795c39}
.reqCards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px}
.reqCard{border:1px solid #d8c7a9;border-radius:9px;padding:8px 9px;background:#fffaf1}
.reqCard.optional{background:#edf3f6;border-color:#a9c0cb}.reqCard.recommended{background:#f7f2e7;border-color:#cbbda0}.reqCard.boostable{background:#fff4d9;border-color:#d9b665}
.reqTop{display:flex;align-items:center;justify-content:space-between;gap:8px}.reqSkill{font-weight:950;font-size:12px;color:#332319}
.reqBadge{font-size:8px;font-weight:950;text-transform:uppercase;border-radius:999px;padding:4px 6px;white-space:nowrap;background:#e5d8c0;color:#5c442b}
.reqCard.optional .reqBadge{background:#d7e7ee;color:#31596b}.reqCard.recommended .reqBadge{background:#e8e0cf;color:#65563e}.reqCard.boostable .reqBadge{background:#f0d99e;color:#63420b}
.reqMeta{margin-top:4px;font-size:10px;font-weight:800;color:#665746}.reqWhy{margin-top:5px;font-size:9px;line-height:1.35;color:#6d6256}.reqClear{font-size:10px;color:#37683d;font-weight:900}
.routeReqHint{display:block;margin-top:5px;font-size:9px;line-height:1.3;color:#587181;font-weight:800}
.v115Report:disabled{opacity:.65;cursor:wait}
</style>
"""
    html = html.replace('</head>', css + '\n</head>', 1)

if 'id="nextReqIntel"' not in html:
    marker = '<div class="actionStep rewardBox"><div class="n">Quest rewards</div><div id="nextRewards" class="v rewardLines">—</div></div>'
    replacement = marker + '\n        <div class="actionStep reqIntelStep"><div class="n">Skill requirement intelligence</div><div id="nextReqIntel" class="reqIntel"></div></div>'
    if marker not in html:
        raise SystemExit('Could not locate Next Session reward block.')
    html = html.replace(marker, replacement, 1)

old_load = 'function load(){google.script.run.withSuccessHandler(render).withFailureHandler(fail).getV1DashboardState()}'
new_load = r"""function load(){
  google.script.run
    .withSuccessHandler(s=>{render(s);kickV122BackgroundRefresh();})
    .withFailureHandler(fail)
    .getV1DashboardState({allowQuestHelperSync:false});
}
let v122BackgroundRefreshStarted=false;
function kickV122BackgroundRefresh(){
  if(v122BackgroundRefreshStarted)return;
  v122BackgroundRefreshStarted=true;
  google.script.run
    .withFailureHandler(e=>console.warn('Background Quest Helper refresh failed:',e))
    .withSuccessHandler(r=>{
      if(!r||!r.refreshed)return;
      google.script.run
        .withFailureHandler(e=>console.warn('Background dashboard re-read failed:',e))
        .withSuccessHandler(render)
        .getV1DashboardState({allowQuestHelperSync:false});
    })
    .refreshQuestHelperIfStaleV122();
}"""
if old_load in html:
    html = html.replace(old_load, new_load, 1)

if 'function requirementIntelHtmlV122(' not in html:
    marker = 'function render(s){'
    if marker not in html:
        raise SystemExit('Could not locate dashboard render function.')
    helper = r"""function statLevelV122(s,skill){
  const row=(s.stats||[]).find(x=>String(x.skill||'').toLowerCase()===String(skill||'').toLowerCase());
  return row?Number(row.level||0):0;
}
function requirementIntelForV122(s,quest){
  return (s.requirementIntel||{})[String(quest||'').trim().toLowerCase()]||null;
}
function requirementIntelHtmlV122(s,quest){
  const intel=requirementIntelForV122(s,quest);
  if(!intel)return '<div class="reqClear">No requirement intelligence cached for this quest.</div>';

  const required=intel.requiredSkills||[], optional=intel.optionalSkills||[];
  let html='<div class="reqMode"><span class="reqModePill">Base levels only</span><span><b>Planning rule:</b> boosts are shown as an option, but the dashboard trains to the real level by default.</span></div>';

  if(required.length){
    html+='<div class="reqSection"><div class="reqSectionTitle">Hard skill requirements</div><div class="reqCards">';
    required.forEach(x=>{
      const current=statLevelV122(s,x.skill),met=current>=Number(x.level||0);
      const boost=!!x.boostable;
      html+=`<div class="reqCard ${boost?'boostable':''}"><div class="reqTop"><span class="reqSkill">${esc(x.skill)} ${esc(x.level)}</span><span class="reqBadge">${boost?'Required · Boostable':'Required'}</span></div><div class="reqMeta">Your level: ${esc(current)} · ${met?'Base level met':`Train to ${esc(x.level)}`}</div>${boost?'<div class="reqWhy">A boost can satisfy this requirement, but V1.22 does not assume you want to boost.</div>':''}</div>`;
    });
    html+='</div></div>';
  }else{
    html+='<div class="reqClear">✓ No hard skill-level requirement.</div>';
  }

  if(optional.length){
    html+='<div class="reqSection"><div class="reqSectionTitle">Optional / alternative skills — do not block the quest</div><div class="reqCards">';
    optional.forEach(x=>{
      const rec=/recommended/i.test(String(x.kind||''));
      html+=`<div class="reqCard ${rec?'recommended':'optional'}"><div class="reqTop"><span class="reqSkill">${esc(x.skill)} ${esc(x.level)}</span><span class="reqBadge">${esc(x.kind||'Optional')}</span></div><div class="reqWhy"><b>Why optional:</b> ${esc(x.why||intel.optionalText||'Alternative route; not required to finish the quest.')}</div></div>`;
    });
    html+='</div></div>';
  }else if(String(intel.optionalText||'').trim()){
    html+=`<div class="reqSection"><div class="reqSectionTitle">Optional route note</div><div class="reqCard optional"><div class="reqWhy">${esc(intel.optionalText)}</div></div></div>`;
  }

  return html;
}
function routeRequirementHintV122(s,quest){
  const intel=requirementIntelForV122(s,quest);
  if(!intel)return '';
  const optional=(intel.optionalSkills||[]).map(x=>`${x.skill} ${x.level} (${x.kind||'optional'})`);
  const boost=(intel.requiredSkills||[]).filter(x=>x.boostable).map(x=>`${x.skill} ${x.level} boostable`);
  const parts=[...optional,...boost];
  return parts.length?`<span class="routeReqHint">${esc(parts.join(' · '))}</span>`:'';
}

"""
    html = html.replace(marker, helper + marker, 1)

needle = "  $('nextRewards').innerHTML=rewardLinesHtml(top&&top.rewards?top.rewards:null);"
if needle in html and "$('nextReqIntel').innerHTML" not in html:
    html = html.replace(needle, needle + "\n  $('nextReqIntel').innerHTML=requirementIntelHtmlV122(s,quest);", 1)

old_route = '''<div class="stepMeta">${esc(r.blocker)}<br>${state}</div>${blocked?'<span class="blockedFlag">Training needed</span>':''}<span class="stepScore">Score ${esc(r.score)}</span></div>`;'''
new_route = '''<div class="stepMeta">${esc(r.blocker)}<br>${state}${routeRequirementHintV122(s,r.quest)}</div>${blocked?'<span class="blockedFlag">Training needed</span>':''}<span class="stepScore">Score ${esc(r.score)}</span></div>`;'''
if old_route in html:
    html = html.replace(old_route, new_route, 1)

pattern = re.compile(r"function confirmV115Quests\(\)\{.*?\n\}\ndocument\.addEventListener\('DOMContentLoaded',\(\)=>\{loadV115\(\);\}\);", re.S)
new_confirm = r"""let v122SavingQuest=false;
function setV122Saving(on){
  v122SavingQuest=!!on;
  const b=document.getElementById('v115Report');
  if(!b)return;
  b.disabled=!!on;
  const span=b.querySelector('span');
  if(span)span.textContent=on?'Saving…':'Report Quest';
}
function confirmV115Quests(){
  if(v122SavingQuest)return;
  if(!v115Selected.size)return alert('Select at least one quest.');
  const names=[...v115Selected];
  if(!confirm(`Mark these quests complete?\n\n${names.join('\n')}`))return;

  closeV115QuestModal();
  setV122Saving(true);

  const label=names.length===1?names[0]:`${names.length} quests`;
  showV115Toast(`Saving ${label}… recommendations will refresh automatically.`);

  google.script.run
    .withFailureHandler(e=>{
      setV122Saving(false);
      const msg=(e&&e.message)?e.message:String(e||'Unknown error');
      showV115Toast('Quest update failed: '+msg,true);
    })
    .withSuccessHandler(r=>{
      setV122Saving(false);
      v115LastTx=r.transactionId;
      hideV115Banner();

      if(v115State){
        const changed=new Set((r.changed||[]).map(x=>String(x).toLowerCase()));
        v115State.incomplete=(v115State.incomplete||[]).filter(x=>!changed.has(String(x.quest||'').toLowerCase()));
        v115State.likely=(v115State.likely||[]).filter(x=>!changed.has(String(x.quest||'').toLowerCase()));
      }

      if(r.dashboard){
        render(r.dashboard);
        window.__sensumState=r.dashboard;
      }

      const changed=r.changed||[];
      const doneLabel=changed.length===1?changed[0]:`${changed.length} quests`;
      showV115Toast(`${doneLabel} marked complete. Dashboard updated.`);
    })
    .completeV122QuestsFast(names,v115Source);
}
document.addEventListener('DOMContentLoaded',()=>{loadV115();});"""
if pattern.search(html):
    html = pattern.sub(new_confirm, html, count=1)
elif '.completeV122QuestsFast(names,v115Source)' not in html:
    raise SystemExit('Could not replace manual completion flow.')

write(html_path, html)

print('V1.22 patch applied successfully.')
