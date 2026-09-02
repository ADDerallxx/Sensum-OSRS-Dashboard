import fs from 'node:fs/promises';
import path from 'node:path';
import {hash,json} from '../ingestion/lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--root='))?.slice(7)||'.platform-data');
async function latestEvidence(){const dirs=(await fs.readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();for(const dir of dirs){const file=path.join(root,dir,'activity-evidence.ndjson');try{await fs.access(file);return {dir,file,rows:(await fs.readFile(file,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)}}catch{}}throw new Error('No activity evidence snapshot found.');}
const input=await latestEvidence();

const classifiers=[
  {kind:'agility_course',model:'lap',score:1,test:r=>r.family_hint==='agility_course'},
  {kind:'agility_course',model:'lap',score:.96,test:r=>r.skills.includes('Agility')&&/course|agility arena/i.test(r.name)},
  {kind:'woodcutting_node',model:'resource_cycle',score:.9,test:r=>r.skills.includes('Woodcutting')&&/log|tree|root/i.test(r.name)},
  {kind:'mining_node',model:'resource_cycle',score:.9,test:r=>r.skills.includes('Mining')&&/ore|rock|vein|crystal|mine/i.test(r.name)},
  {kind:'fishing_spot',model:'resource_cycle',score:.82,test:r=>r.skills.includes('Fishing')},
  {kind:'thieving_target',model:'success_roll',score:.86,test:r=>r.skills.includes('Thieving')},
  {kind:'hunter_target',model:'success_roll',score:.82,test:r=>r.skills.includes('Hunter')},
  {kind:'firemaking_action',model:'fixed_cycle',score:.78,test:r=>r.skills.includes('Firemaking')&&/log|pyre|remains|ashes/i.test(r.name)},
  {kind:'prayer_action',model:'fixed_cycle',score:.72,test:r=>r.skills.includes('Prayer')&&/bone|ashes|remains|offering|ensouled/i.test(r.name)}
];
const classify=row=>{const matches=classifiers.filter(x=>x.test(row)),unique=new Map();for(const match of matches)if(!unique.has(match.kind)||unique.get(match.kind).score<match.score)unique.set(match.kind,match);return unique.size?[...unique.values()]:[{kind:'unclassified',model:null,score:0,skill:null}]};
const familySkill={agility_course:'Agility',woodcutting_node:'Woodcutting',mining_node:'Mining',fishing_spot:'Fishing',thieving_target:'Thieving',hunter_target:'Hunter',firemaking_action:'Firemaking',prayer_action:'Prayer'};
const number=s=>Number(String(s).replace(/,/g,''));
const contextualSkill=(text,index,skills)=>{let winner=null,position=-1;for(const skill of skills||[]){const at=text.toLowerCase().lastIndexOf(skill.toLowerCase(),index);if(at>position&&index-at<220){winner=skill;position=at}}return winner||(skills||[]).length===1?winner||(skills||[])[0]:null};
const parseFragment=(fragment,row,targetSkill)=>{
  const text=fragment.text||'',facts=[],push=(kind,factClass,value,match)=>{const skill=contextualSkill(text,match?.index??text.length,row.skills);if(['xp_per_success','observed_xp_per_hour'].includes(kind)&&skill&&targetSkill&&skill!==targetSkill)return;const tagged=skill?{...value,skill}:value;facts.push({fact_kind:kind,fact_class:factClass,value:tagged,state:'candidate',source_url:row.source_url,source_revision:row.source_revision,source_locator:{line:fragment.line,excerpt:text},parser_version:'family-regex-v4',content_hash:hash({kind,value:tagged,line:fragment.line,text})})};
  let m;
  if((m=text.match(/(\d+(?:\.\d+)?)\s*ticks?\s*per\s*lap/i)))push('cycle_ticks','mechanical',{ticks:number(m[1])},m);
  if((m=text.match(/(\d+(?:\.\d+)?)\s*\[\[(?:Game tick\|)?ticks?\]\]\s*per\s*lap/i)))push('cycle_ticks','mechanical',{ticks:number(m[1])},m);
  if((m=text.match(/(?:course in|lap time of)\s*(\d+(?:\.\d+)?)\s*seconds?\s*\((\d+(?:\.\d+)?)\s*\[\[(?:Game tick\|)?ticks?\]\]\)/i))){push('lap_seconds','mechanical',{seconds:number(m[1])},m);push('cycle_ticks','mechanical',{ticks:number(m[2])},m)}
  if((m=text.match(/average time of\s*(\d+(?:\.\d+)?)\s*seconds?\s*per\s*lap/i)))push('lap_seconds','mechanical',{seconds:number(m[1])},m);
  if((m=text.match(/lap time of\s*(\d+(?:\.\d+)?)\s*seconds?/i)))push('lap_seconds','mechanical',{seconds:number(m[1])},m);
  if((m=text.match(/(?:rewards?|granting)\s*([\d,.]+)\s*(?:\[\[[^\]]+\]\]\s*)?(?:\[\[experience\]\]|experience)\s*per\s*(?:completed\s*)?lap/i)))push('xp_per_success','mechanical',{xp:number(m[1]),unit:'lap'},m);
  if((m=text.match(/(?:players? get|rewards?)\s*([\d,.]+)\s*(?:\[\[[^\]]+\]\]\s*)?(?:\[\[experience\]\]|experience)\s*from completing (?:the|this) course/i)))push('xp_per_success','mechanical',{xp:number(m[1]),unit:'lap'},m);
  if((m=text.match(/([\d,.]+)\s*(?:\[\[[^\]]+\]\]\s*)?(?:\[\[experience\]\]|experience)\s*(?:each|per\s+(?:log|ore|catch|action))/i)))push('xp_per_success','mechanical',{xp:number(m[1]),unit:'success'},m);
  if((m=text.match(/(?:take|takes)\s*(\d+(?:\.\d+)?)\s*(seconds?|minutes?)\s*(?:until|to)\s*(?:it\s*)?(?:reappear|respawn)/i))){const value=number(m[1])*(m[2].toLowerCase().startsWith('minute')?60:1);push('respawn_seconds','mechanical',{seconds:value},m)}
  if((m=text.match(/(\d+(?:\.\d+)?)\s*laps?\s*per\s*hour/i)))push('observed_actions_per_hour','observational',{actions:number(m[1]),unit:'lap'},m);
  if(!/requirement[^.]{0,30}removed/i.test(text)&&(m=text.match(/(?:requires?\s+(?:(?:an?|a boostable)\s*)?(?:\[\[Agility\]\]\s*)?level(?:\s+of)?|(?:\[\[Agility\]\]|Agility)\s+level(?:\s+of)?|must have an? Agility level(?:\s+of)?)\s*(\d+)\s*(?:or above|or higher|required|to access)?/i)))push('level_requirement','constraint',{minimum:number(m[1])},m);
  if((m=text.match(/only requirement[^.]{0,80}?level\s*(\d+)\s*(?:\[\[Agility\]\]|Agility)/i)))push('level_requirement','constraint',{minimum:number(m[1])},m);
  if((m=text.match(/available to players with an?\s*(?:\[\[Agility\]\]|Agility)\s+level(?:\s+of)?\s*(\d+)/i)))push('level_requirement','constraint',{minimum:number(m[1])},m);
  if((m=text.match(/course requires(?: an?)?\s*(?:boostable\s+)?(?:level\s*)?(\d+)\s*(?:\[\[Agility\]\]|Agility)/i)))push('level_requirement','constraint',{minimum:number(m[1])},m);
  if((m=text.match(/beginning at\s*(\d+)\s*(?:\[\[Agility\]\]|Agility)\s+for the basic course/i)))push('level_requirement','constraint',{minimum:number(m[1])},m);
  if((m=text.match(/level\s*(\d+)\s*(?:\[\[Agility\]\]|Agility)\s+requirement[^.]{0,80}?(?:enter|access)/i)))push('level_requirement','constraint',{minimum:number(m[1])},m);
  if(/(?:lowest level course[^.]{0,100}?has no requirements|course[^.]{0,80}?has no requirements)/i.test(text))push('level_requirement','constraint',{minimum:1},{index:0});
  if((m=text.match(/(?:at least|level)\s*(\d+)[\s\S]{0,180}?never fail/i)))push('failure_probability','mechanical',{probability:0,minimum_level:number(m[1])},m);
  if((m=text.match(/stops? failing[^.]{0,120}?at level\s*(\d+)/i)))push('failure_probability','mechanical',{probability:0,minimum_level:number(m[1])},m);
  if((m=text.match(/at\s+(?:level\s*)?(\d+)\s*(?:\[\[[^\]]+\]\]|Agility)?[^.]{0,100}?stop failing (?:this |the )?course/i)))push('failure_probability','mechanical',{probability:0,minimum_level:number(m[1])},m);
  if((m=text.match(/(?:obstacles|players)\s+(?:will\s+)?stop failing(?: (?:this|the) course)?[^.]{0,60}?at\s+(?:level\s*)?(\d+)/i)))push('failure_probability','mechanical',{probability:0,minimum_level:number(m[1])},m);
  if((m=text.match(/stop failing (?:this |the )course at\s+(\d+)/i)))push('failure_probability','mechanical',{probability:0,minimum_level:number(m[1])},m);
  if((m=text.match(/level\s*(\d+)\s*(?:\[\[Agility\]\]|Agility)?\s+or higher ensures success on all/i)))push('failure_probability','mechanical',{probability:0,minimum_level:number(m[1])},m);
  if((m=text.match(/at level\s*(\d+)\s*(?:\[\[Agility\]\]|Agility)?[^.]{0,80}?(?:impossible to fail|becomes impossible to fail)/i)))push('failure_probability','mechanical',{probability:0,minimum_level:number(m[1])},m);
  if(!/\blevel\s*\d+/i.test(text)&&/(?:no longer possible|cannot|can't|impossible) to fail|never fail obstacles/i.test(text))push('failure_probability','mechanical',{probability:0,minimum_level:1},{index:0});
  const rates=[...text.matchAll(/([\d,.]+)(?:[–-]([\d,.]+))?\s*(?:\[\[[^\]]+\]\]\s*|[A-Za-z]+\s+)?(?:\[\[experience\]\]|experience)\s*per\s*hour/gi)];
  for(const rate of rates){const explicitSkill=rate[0].match(/\[\[([A-Za-z]+)(?:\|[^\]]+)?\]\]\s*(?:\[\[experience\]\]|experience)/i)?.[1]||rate[0].match(/\b([A-Za-z]+)\s+(?:\[\[experience\]\]|experience)\s*per\s*hour/i)?.[1];if(explicitSkill&&targetSkill&&explicitSkill.toLowerCase()!==targetSkill.toLowerCase())continue;push('observed_xp_per_hour','observational',{minimum:number(rate[1]),maximum:number(rate[2]||rate[1])},rate)}
  return facts;
};

const members=[],facts=[];
for(const row of input.rows){
  for(const family of classify(row)){const pageText=(row.evidence_fragments||[]).map(x=>x.text).join('\n'),isComposite=family.kind==='agility_course'&&((/basic course/i.test(pageText)&&/advanced course/i.test(pageText))||/five floors available scaling with the player's Agility level/i.test(pageText)),entityRole=family.kind==='agility_course'&&/^Rooftop Agility Courses$/i.test(row.name)?'reference_collection':isComposite?'composite_method':'trainable_method';members.push({family_key:family.kind,family_kind:family.kind,model_kind:family.model,entity_role:entityRole,external_record_key:row.record_key,name:row.name,skills:row.skills,classification_score:family.score,classification_reasons:family.kind==='unclassified'?['no_family_rule_matched']:[`matched_${family.kind}`],source_url:row.source_url,source_revision:row.source_revision});
    for(const fragment of row.evidence_fragments||[])for(const fact of parseFragment(fragment,row,familySkill[family.kind]))facts.push({...fact,family_key:family.kind,external_record_key:row.record_key,name:row.name});}
}
const families=[...new Set(members.map(x=>x.family_key))].map(key=>{const rows=members.filter(x=>x.family_key===key),model=rows[0].model_kind;return {family_key:key,model_kind:model,members:rows.length,candidate_facts:facts.filter(x=>x.family_key===key).length,mechanical_candidates_present:key!=='unclassified'&&facts.some(x=>x.family_key===key&&x.fact_class==='mechanical'),rankable:false,state:'draft'}});
const classifiedKeys=new Set(members.filter(x=>x.family_key!=='unclassified').map(x=>x.external_record_key)),unclassifiedKeys=new Set(members.filter(x=>x.family_key==='unclassified').map(x=>x.external_record_key));
const report={contract:'sensum.activity-family-build.v1',generatedAt:new Date().toISOString(),input:input.dir,classifierVersion:'family-rules-v4',parserVersion:'family-regex-v6',records:input.rows.length,memberships:members.length,classifications:{classifiedRecords:classifiedKeys.size,unclassifiedRecords:unclassifiedKeys.size,referenceCollections:members.filter(x=>x.entity_role==='reference_collection').length,compositeMethods:members.filter(x=>x.entity_role==='composite_method').length},candidateFacts:facts.length,verifiedFacts:0,absoluteBestActivityGate:'blocked',families,contentHash:hash({members,facts})};
const out=path.join(root,'activity-families',report.generatedAt.replace(/[:.]/g,'-'));await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'members.ndjson'),members.map(json).join('\n')+'\n');await fs.writeFile(path.join(out,'facts.ndjson'),facts.map(json).join('\n')+'\n');await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
