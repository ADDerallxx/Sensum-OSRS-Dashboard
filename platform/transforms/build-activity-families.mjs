import fs from 'node:fs/promises';
import path from 'node:path';
import {hash,json} from '../ingestion/lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--root='))?.slice(7)||'.platform-data');
async function latestEvidence(){const dirs=(await fs.readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();for(const dir of dirs){const file=path.join(root,dir,'activity-evidence.ndjson');try{await fs.access(file);return {dir,file,rows:(await fs.readFile(file,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)}}catch{}}throw new Error('No activity evidence snapshot found.');}
const input=await latestEvidence();

const classifiers=[
  {kind:'agility_course',model:'lap',score:.96,test:r=>r.skills.includes('Agility')&&/course|agility arena/i.test(r.name)},
  {kind:'woodcutting_node',model:'resource_cycle',score:.9,test:r=>r.skills.includes('Woodcutting')&&/log|tree|root/i.test(r.name)},
  {kind:'mining_node',model:'resource_cycle',score:.9,test:r=>r.skills.includes('Mining')&&/ore|rock|vein|crystal|mine/i.test(r.name)},
  {kind:'fishing_spot',model:'resource_cycle',score:.82,test:r=>r.skills.includes('Fishing')},
  {kind:'thieving_target',model:'success_roll',score:.86,test:r=>r.skills.includes('Thieving')},
  {kind:'hunter_target',model:'success_roll',score:.82,test:r=>r.skills.includes('Hunter')},
  {kind:'firemaking_action',model:'fixed_cycle',score:.78,test:r=>r.skills.includes('Firemaking')&&/log|pyre|remains|ashes/i.test(r.name)},
  {kind:'prayer_action',model:'fixed_cycle',score:.72,test:r=>r.skills.includes('Prayer')&&/bone|ashes|remains|offering|ensouled/i.test(r.name)}
];
const classify=row=>{const matches=classifiers.filter(x=>x.test(row));return matches.length?matches:[{kind:'unclassified',model:null,score:0,skill:null}]};
const familySkill={agility_course:'Agility',woodcutting_node:'Woodcutting',mining_node:'Mining',fishing_spot:'Fishing',thieving_target:'Thieving',hunter_target:'Hunter',firemaking_action:'Firemaking',prayer_action:'Prayer'};
const number=s=>Number(String(s).replace(/,/g,''));
const contextualSkill=(text,index,skills)=>{let winner=null,position=-1;for(const skill of skills||[]){const at=text.toLowerCase().lastIndexOf(skill.toLowerCase(),index);if(at>position&&index-at<220){winner=skill;position=at}}return winner||(skills||[]).length===1?winner||(skills||[])[0]:null};
const parseFragment=(fragment,row,targetSkill)=>{
  const text=fragment.text||'',facts=[],push=(kind,factClass,value,match)=>{const skill=contextualSkill(text,match?.index??text.length,row.skills);if(['xp_per_success','observed_xp_per_hour'].includes(kind)&&skill&&targetSkill&&skill!==targetSkill)return;const tagged=skill?{...value,skill}:value;facts.push({fact_kind:kind,fact_class:factClass,value:tagged,state:'candidate',source_url:row.source_url,source_revision:row.source_revision,source_locator:{line:fragment.line,excerpt:text},parser_version:'family-regex-v2',content_hash:hash({kind,value:tagged,line:fragment.line,text})})};
  let m;
  if((m=text.match(/(\d+(?:\.\d+)?)\s*ticks?\s*per\s*lap/i)))push('cycle_ticks','mechanical',{ticks:number(m[1])},m);
  if((m=text.match(/average time of\s*(\d+(?:\.\d+)?)\s*seconds?\s*per\s*lap/i)))push('lap_seconds','mechanical',{seconds:number(m[1])},m);
  if((m=text.match(/(?:rewards?|granting)\s*([\d,.]+)\s*(?:\[\[[^\]]+\]\]\s*)?(?:\[\[experience\]\]|experience)\s*per\s*(?:completed\s*)?lap/i)))push('xp_per_success','mechanical',{xp:number(m[1]),unit:'lap'},m);
  if((m=text.match(/([\d,.]+)\s*(?:\[\[[^\]]+\]\]\s*)?(?:\[\[experience\]\]|experience)\s*(?:each|per\s+(?:log|ore|catch|action))/i)))push('xp_per_success','mechanical',{xp:number(m[1]),unit:'success'},m);
  if((m=text.match(/(?:take|takes)\s*(\d+(?:\.\d+)?)\s*(seconds?|minutes?)\s*(?:until|to)\s*(?:it\s*)?(?:reappear|respawn)/i))){const value=number(m[1])*(m[2].toLowerCase().startsWith('minute')?60:1);push('respawn_seconds','mechanical',{seconds:value},m)}
  if((m=text.match(/(\d+(?:\.\d+)?)\s*laps?\s*per\s*hour/i)))push('observed_actions_per_hour','observational',{actions:number(m[1]),unit:'lap'},m);
  const rates=[...text.matchAll(/([\d,.]+)(?:[–-]([\d,.]+))?\s*(?:\[\[[^\]]+\]\]\s*)?(?:\[\[experience\]\]|experience)\s*per\s*hour/gi)];
  for(const rate of rates)push('observed_xp_per_hour','observational',{minimum:number(rate[1]),maximum:number(rate[2]||rate[1])},rate);
  return facts;
};

const members=[],facts=[];
for(const row of input.rows){
  for(const family of classify(row)){members.push({family_key:family.kind,family_kind:family.kind,model_kind:family.model,external_record_key:row.record_key,name:row.name,skills:row.skills,classification_score:family.score,classification_reasons:family.kind==='unclassified'?['no_family_rule_matched']:[`matched_${family.kind}`],source_url:row.source_url,source_revision:row.source_revision});
    for(const fragment of row.evidence_fragments||[])for(const fact of parseFragment(fragment,row,familySkill[family.kind]))facts.push({...fact,family_key:family.kind,external_record_key:row.record_key,name:row.name});}
}
const families=[...new Set(members.map(x=>x.family_key))].map(key=>{const rows=members.filter(x=>x.family_key===key),model=rows[0].model_kind;return {family_key:key,model_kind:model,members:rows.length,candidate_facts:facts.filter(x=>x.family_key===key).length,mechanical_candidates_present:key!=='unclassified'&&facts.some(x=>x.family_key===key&&x.fact_class==='mechanical'),rankable:false,state:'draft'}});
const classifiedKeys=new Set(members.filter(x=>x.family_key!=='unclassified').map(x=>x.external_record_key)),unclassifiedKeys=new Set(members.filter(x=>x.family_key==='unclassified').map(x=>x.external_record_key));
const report={contract:'sensum.activity-family-build.v1',generatedAt:new Date().toISOString(),input:input.dir,classifierVersion:'family-rules-v1',parserVersion:'family-regex-v2',records:input.rows.length,memberships:members.length,classifications:{classifiedRecords:classifiedKeys.size,unclassifiedRecords:unclassifiedKeys.size},candidateFacts:facts.length,verifiedFacts:0,absoluteBestActivityGate:'blocked',families,contentHash:hash({members,facts})};
const out=path.join(root,'activity-families',report.generatedAt.replace(/[:.]/g,'-'));await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'members.ndjson'),members.map(json).join('\n')+'\n');await fs.writeFile(path.join(out,'facts.ndjson'),facts.map(json).join('\n')+'\n');await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
