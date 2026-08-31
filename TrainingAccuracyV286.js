const V286_ACCURACY_VERSION='V2.86';
const V286_ACCURACY_SHEET='Game Data - Accuracy Audit';
const V286_REQUIRED_MONSTER_FIELDS=['Hitpoints','Defence','Stab Defence','Slash Defence','Crush Defence'];
const V286_SPECIAL_EFFECTS={
  'sulphur blades':{status:'MODELED_BASE',source:'https://oldschool.runescape.wiki/w/Sulphur_blades',note:'Two-hit distribution is represented by its verified aggregate speed and bonuses. The Sulphur Nagua minimum-hit interaction is not applied outside that target.'},
  'rune scimitar':{status:'NONE',source:'https://oldschool.runescape.wiki/w/Rune_scimitar'},
  'adamant scimitar':{status:'NONE',source:'https://oldschool.runescape.wiki/w/Adamant_scimitar'},
  'mithril scimitar':{status:'NONE',source:'https://oldschool.runescape.wiki/w/Mithril_scimitar'},
  'dragon scimitar':{status:'NONE',source:'https://oldschool.runescape.wiki/w/Dragon_scimitar'},
  'granite hammer':{status:'NONE',source:'https://oldschool.runescape.wiki/w/Granite_hammer'},
  'brine sabre':{status:'NONE',source:'https://oldschool.runescape.wiki/w/Brine_sabre'},
  'abyssal dagger':{status:'NONE',source:'https://oldschool.runescape.wiki/w/Abyssal_dagger'}
};

function v286Text_(v){return String(v==null?'':v).trim()}
function v286Finite_(v){const text=String(v==null?'':v).trim();return text!==''&&Number.isFinite(Number(text.replace(/,/g,'')))}
function v286DateAgeHours_(v){const d=new Date(v);return Number.isFinite(d.getTime())?(Date.now()-d.getTime())/3600000:Infinity}
function v286Issue_(severity,code,message,source){return {severity:severity,code:code,message:message,source:source||''}}

function v286Json_(v){try{return JSON.parse(String(v||'{}'))}catch(e){return {}}}
function v286AssessTrainingScenario_(scenario,context){
  const issues=[],loadout=scenario&&scenario.loadout||{},monster=context&&context.monster||{},equipmentIndex=context&&context.equipmentIndex||{},itemIndex=context&&context.itemIndex||{},knowledgeIndex=context&&context.knowledgeIndex||{},stats=context&&context.stats||{};
  if(!scenario)return {eligible:false,grade:'BLOCKED',issues:[v286Issue_('BLOCKER','NO_SCENARIO','No scenario was produced.')]};
  V286_REQUIRED_MONSTER_FIELDS.forEach(field=>{if(!v286Finite_(monster[field]))issues.push(v286Issue_('BLOCKER','MONSTER_FIELD_MISSING','Monster record is missing '+field+'.',monster.Source))});
  if(!v286Text_(monster.Source))issues.push(v286Issue_('BLOCKER','MONSTER_SOURCE_MISSING','Monster record has no source revision.'));
  if(v286DateAgeHours_(monster['Last Checked'])>48)issues.push(v286Issue_('WARNING','MONSTER_STALE','Monster data is more than 48 hours old.',monster.Source));
  const effect=V286_SPECIAL_EFFECTS[String(loadout.weapon||'').toLowerCase()];
  if(!effect)issues.push(v286Issue_('BLOCKER','WEAPON_EFFECT_UNREVIEWED','Weapon special-effect behavior has not been reviewed: '+loadout.weapon+'.'));
  else if(effect.status==='UNMODELED')issues.push(v286Issue_('BLOCKER','WEAPON_EFFECT_UNMODELED',effect.note,effect.source));
  else if(effect.status==='MODELED_BASE'&&effect.note)issues.push(v286Issue_('NOTE','CONDITIONAL_EFFECT_SCOPE',effect.note,effect.source));
  (loadout.items||[]).forEach(item=>{
    const eq=equipmentIndex[String(item.name||'').toLowerCase()];
    if(!eq)issues.push(v286Issue_('BLOCKER','EQUIPMENT_RECORD_MISSING','No Wiki equipment record for '+item.name+'.'));
    else if(!v286Text_(eq.Source))issues.push(v286Issue_('BLOCKER','EQUIPMENT_SOURCE_MISSING','Equipment record has no source revision: '+item.name+'.'));
    const price=itemIndex[String(item.name||'').toLowerCase()];
    if(!price)issues.push(v286Issue_('WARNING','PRICE_RECORD_MISSING','No current market record for '+item.name+'.'));
    else if(v286DateAgeHours_(price['Last Checked'])>2)issues.push(v286Issue_('WARNING','PRICE_STALE','Price is more than two hours old: '+item.name+'.',price.Source));
    const knowledge=knowledgeIndex[String(item.name||'').toLowerCase()];
    if(!knowledge)issues.push(v286Issue_('WARNING','KNOWLEDGE_PENDING','Wiki requirement/effect verification is still queued for '+item.name+'.'));
    else{
      const requirements=v286Json_(knowledge['Requirements JSON']);
      Object.keys(requirements).forEach(skill=>{if(Number(stats[String(skill).toLowerCase()]||0)<Number(requirements[skill]))issues.push(v286Issue_('BLOCKER','EQUIPMENT_REQUIREMENT_UNMET',item.name+' requires '+skill+' '+requirements[skill]+'.',knowledge.Source))});
      if(knowledge['Effect Status']==='REVIEW_REQUIRED'&&String(item.name||'').toLowerCase()!==String(loadout.weapon||'').toLowerCase())issues.push(v286Issue_('BLOCKER','EQUIPMENT_EFFECT_UNMODELED','Passive, set, charge, or degradation behavior needs review: '+item.name+'.',knowledge.Source));
      if(knowledge.Confidence==='BLOCKED')issues.push(v286Issue_('BLOCKER','EQUIPMENT_KNOWLEDGE_BLOCKED','Wiki verification failed for '+item.name+'.',knowledge.Source));
    }
  });
  const blockers=issues.filter(x=>x.severity==='BLOCKER'),warnings=issues.filter(x=>x.severity==='WARNING');
  return {version:V286_ACCURACY_VERSION,eligible:!blockers.length,grade:blockers.length?'BLOCKED':warnings.length?'PROVISIONAL':'VERIFIED',issues:issues,blockers:blockers.length,warnings:warnings.length,checkedAt:new Date().toISOString(),policy:'Fail closed when a required combat fact or special effect is unverified.'};
}

function runV286AccuracyRegressionTests(){
  const tests=[],assert=(name,pass,detail)=>tests.push({name:name,pass:!!pass,detail:detail||''});
  const chance=v281tAccuracy_(60,72,1,0,0).chance;
  assert('Accuracy remains bounded',chance>=0&&chance<=1,'chance='+chance);
  assert('Higher attack bonus improves accuracy',v281tAccuracy_(60,72,40,20,0).chance>v281tAccuracy_(60,45,40,20,0).chance);
  assert('Higher strength bonus does not lower max hit',v281tMaxHit_(60,64,0)>=v281tMaxHit_(60,44,0));
  const stats={attack:60,strength:60};
  assert('Sulphur blades outrank rune scimitar at 60/60',v281tWeaponScore_({name:'Sulphur blades',speed:4,stab:11,slash:72,crush:0,strength:64},stats,'Strength')>v281tWeaponScore_({name:'Rune scimitar',speed:4,stab:7,slash:45,crush:-2,strength:44},stats,'Strength'));
  assert('Weapon Strength bonus is not treated as a level requirement',v281tItemEligible_({name:'Sulphur blades',attack:55,strengthBonus:64},{attack:60,strength:52},{}).eligible);
  assert('Real Strength requirements remain enforced',!v281tItemEligible_({name:'Granite hammer',attack:50,strength:50,strengthBonus:56},{attack:60,strength:49},{}).eligible);
  const mockItems={},mockEquipment={};['Sulphur blades','Rune full helm','Rune chainbody','Rune platelegs','Rune boots','Amulet of strength','Combat bracelet','Ring of wealth'].forEach(name=>{mockItems[name.toLowerCase()]={Name:name};mockEquipment[name.toLowerCase()]={Name:name}});
  assert('Two-handed weapons cannot equip a shield',!v281tLoadout_('budget',{attack:60,strength:60,defence:60},{},mockItems,mockEquipment,'Strength').items.some(x=>x.slot==='shield'));
  const failed=tests.filter(x=>!x.pass);
  return {ok:!failed.length,version:V286_ACCURACY_VERSION,checkedAt:new Date().toISOString(),tests:tests,failed:failed};
}

function refreshV286AccuracyAudit(){
  const result=runV286AccuracyRegressionTests(),ss=SpreadsheetApp.openById(V1_TRACKER_ID),headers=['Checked At','Version','Status','Test','Detail'],sh=v285Sheet_(V286_ACCURACY_SHEET,headers),rows=result.tests.map(t=>[new Date(),result.version,t.pass?'PASS':'FAIL',t.name,t.detail]);
  if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,headers.length).clearContent();
  if(rows.length)sh.getRange(2,1,rows.length,headers.length).setValues(rows);
  PropertiesService.getScriptProperties().setProperty('V286_LAST_ACCURACY_AUDIT',JSON.stringify(result));
  if(!result.ok)throw new Error('Training accuracy regression failed: '+result.failed.map(x=>x.name).join(', '));
  return result;
}

function installV286AccuracyMonitor(){
  const existing=ScriptApp.getProjectTriggers();
  if(!existing.some(t=>t.getHandlerFunction()==='refreshV286AccuracyAudit'))ScriptApp.newTrigger('refreshV286AccuracyAudit').timeBased().everyDays(1).atHour(5).create();
  return refreshV286AccuracyAudit();
}

function ensureV286AccuracyMonitor_(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('V286_ACCURACY_MONITOR_INSTALLED'))return;
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(500))return;
  try{
    if(props.getProperty('V286_ACCURACY_MONITOR_INSTALLED'))return;
    const existing=ScriptApp.getProjectTriggers();
    if(!existing.some(t=>t.getHandlerFunction()==='refreshV286AccuracyAudit'))ScriptApp.newTrigger('refreshV286AccuracyAudit').timeBased().everyDays(1).atHour(5).create();
    ScriptApp.newTrigger('refreshV286AccuracyAudit').timeBased().after(60000).create();
    props.setProperty('V286_ACCURACY_MONITOR_INSTALLED',new Date().toISOString());
  }finally{lock.releaseLock()}
}

function getV286AccuracyStatus(){
  const saved=PropertiesService.getScriptProperties().getProperty('V286_LAST_ACCURACY_AUDIT');
  return saved?JSON.parse(saved):runV286AccuracyRegressionTests();
}
