// V1.18 Requirements Trust Layer
function qhV118Norm_(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();}
function qhV118SkillSet_(s){
  const out=[],re=/\b(?:([a-z]+)\s+(\d+)|(\d+)\s+([a-z]+))\b/g; let m;
  s=String(s||'').toLowerCase().replace(/\*/g,' ');
  while((m=re.exec(s))!==null){
    const skill=m[1]||m[4],level=m[2]||m[3];
    out.push(skill+':'+level);
  }
  return out.sort().join('|');
}
function qhV118Path_(quest){
  const overrides={
    'merlinscrystal':'src/main/java/com/questhelper/helpers/quests/merlinscrystal/MerlinsCrystal.java',
    'dragonslayeri':'src/main/java/com/questhelper/helpers/quests/dragonslayer/DragonSlayer.java',
    'enakhraslament':'src/main/java/com/questhelper/helpers/quests/enakhraslament/EnakhrasLament.java'
  };
  return overrides[qhV118Norm_(quest)]||qhDirectQuestPath_(quest);
}
function qhV118Method_(src,name){
  const re=new RegExp('(?:public|protected)\\s+[^{;]+\\s+'+name+'\\s*\\([^)]*\\)\\s*\\{','m'),m=re.exec(src);
  if(!m)return ''; let i=m.index+m[0].length,d=1,a=i;
  for(;i<src.length;i++){if(src[i]==='{')d++;else if(src[i]==='}'&&--d===0)return src.slice(a,i)} return '';
}
function qhV118Skills_(src){
  const b=qhV118Method_(src,'getGeneralRequirements'),o=[]; let m;
  const re=/new\s+SkillRequirement\s*\(\s*Skill\.([A-Z_]+)\s*,\s*(\d+)/g;
  while((m=re.exec(b))!==null)o.push(m[2]+' '+m[1].replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()));
  return o.join('; ');
}
function qhV118Combat_(src){
  const b=qhV118Method_(src,'getCombatRequirements'),o=[];let m,re=/"((?:\\.|[^"\\])*)"/g;
  while((m=re.exec(b))!==null)o.push(m[1].replace(/\"/g,'"'));return o.join('; ');
}
function qhV118Header_(h,res){for(let i=0;i<h.length;i++)if(res.some(r=>r.test(String(h[i]||'').trim())))return i;return -1;}
function qhV118FixFremennik_(){
  const ss=SpreadsheetApp.openById(QH_TRACKER_ID),sh=ss.getSheetByName('Quest Dependency'),v=sh.getDataRange().getDisplayValues();
  let hr=-1,h=[];for(let i=0;i<Math.min(v.length,15);i++){let r=v[i].map(String);if(r.some(x=>/^quest name$/i.test(x.trim()))){hr=i;h=r;break}}
  const q=qhV118Header_(h,[/^quest name$/i]),sk=qhV118Header_(h,[/^skill level requirements?$/i,/^skill requirements?$/i]),oth=qhV118Header_(h,[/^other requirements?$/i]);
  let alt=qhV118Header_(h,[/^conditional \/ alternative requirements$/i]);if(alt<0){alt=h.length;sh.getRange(hr+1,alt+1).setValue('Conditional / Alternative Requirements')}
  let row=-1;for(let i=hr+1;i<v.length;i++)if(qhV118Norm_(v[i][q])==='thefremenniktrials'){row=i+1;break}
  if(row<0)throw new Error('The Fremennik Trials not found');
  if(sk>=0)sh.getRange(row,sk+1).setValue('None');
  if(oth>=0)sh.getRange(row,oth+1).setValue('Defeat the Draugen (level 69); complete Koschei trial without normal weapons/armour/spells.');
  sh.getRange(row,alt+1).setValue('Optional lyre-making path: 25 Fletching; 40 Woodcutting; 40 Crafting. Not hard quest requirements; avoidable by obtaining a lyre instead.');
}
function qhV118AuditBatch_(start,size){
  start=Number(start||0);size=Math.min(25,Number(size||20));
  const ss=SpreadsheetApp.openById(QH_TRACKER_ID),dep=ss.getSheetByName('Quest Dependency'),v=dep.getDataRange().getDisplayValues();
  let hr=-1,h=[];for(let i=0;i<Math.min(v.length,15);i++){let r=v[i].map(String);if(r.some(x=>/^quest name$/i.test(x.trim()))){hr=i;h=r;break}}
  const q=qhV118Header_(h,[/^quest name$/i]),sk=qhV118Header_(h,[/^skill level requirements?$/i,/^skill requirements?$/i]);
  const rows=v.slice(hr+1).filter(r=>String(r[q]||'').trim()), sh=ss.getSheetByName('Quest Data Audit')||ss.insertSheet('Quest Data Audit');
  if(start===0){sh.clearContents();sh.getRange(1,1,1,9).setValues([['Quest','Dataset Mandatory Skills','QH Mandatory Skills','Conditional / Alternative Skills','Combat / Capability Requirements','Status','Reason','QH Source','Checked At']]);sh.setFrozenRows(1)}
  const out=[],end=Math.min(rows.length,start+size);
  for(let i=start;i<end;i++){
    const quest=String(rows[i][q]||'').trim(),dataset=sk>=0?String(rows[i][sk]||'').trim():'',slug=qhV118Norm_(quest);
    let path='',qs='',alt='',combat='',status='REVIEW',reason='';
    try{
      path=qhV118Path_(quest);
      const src=qhFetchText_('https://raw.githubusercontent.com/'+QH_REPO+'/'+QH_BRANCH+'/'+path);
      qs=qhV118Skills_(src);combat=qhV118Combat_(src);
      const norm=x=>String(x||'').toLowerCase().replace(/\bnone\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
      status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
      reason=status==='VERIFIED'?'Dataset agrees with Quest Helper hard requirements.':'Dataset and Quest Helper hard requirements differ.';
      if(slug==='thefremenniktrials'){qs='None';alt='25 Fletching; 40 Woodcutting; 40 Crafting';combat='Defeat Draugen (level 69); Koschei trial';status='VERIFIED';reason='Hard skills are none; lyre-making skills are conditional, not mandatory.'}
    }catch(e){status='NO SOURCE';reason=String(e&&e.message?e.message:e)}
    out.push([quest,dataset,qs,alt,combat,status,reason,path,new Date()]);
  }
  if(out.length)sh.getRange(sh.getLastRow()+1,1,out.length,9).setValues(out);sh.autoResizeColumns(1,9);
  const p=PropertiesService.getScriptProperties(),next=end>=rows.length?0:end;p.setProperty('QH_V118_AUDIT_CURSOR',String(next));
  return {ok:true,start,end,total:rows.length,next,complete:end>=rows.length};
}
function qhV118ContinueAudit_(){const p=PropertiesService.getScriptProperties();return qhV118AuditBatch_(Number(p.getProperty('QH_V118_AUDIT_CURSOR')||0),20)}
function qhInstallV118TrustLayer_(){qhV118FixFremennik_();return qhV118AuditBatch_(0,20);}

function qhInstallV118TrustLayer() {
  return qhInstallV118TrustLayer_();
}

function qhV118AuditRemaining() {
  const p = PropertiesService.getScriptProperties();
  let cursor = Number(p.getProperty('QH_V118_AUDIT_CURSOR') || 0);

  if (cursor === 0) {
    return {ok:true, complete:true, message:'No remaining audit batches.'};
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
    lastResult:result
  };
}
