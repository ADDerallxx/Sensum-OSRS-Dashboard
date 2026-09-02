import fs from 'node:fs/promises';
import path from 'node:path';
import {hash} from '../ingestion/lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--root='))?.slice(7)||'.platform-data');
const inputArg=process.argv.find(x=>x.startsWith('--input='))?.slice(8);
async function latest(){const dirs=(await fs.readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();for(const dir of dirs){const file=path.join(root,dir,'activity-evidence.ndjson');try{await fs.access(file);return file}catch{}}throw new Error('No staged activity evidence found.');}
const file=inputArg?path.resolve(inputArg):await latest(),rows=(await fs.readFile(file,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const required={fixed_cycle:['cycle_ticks','xp_per_success'],success_roll:['cycle_ticks','success_model','xp_per_success'],resource_cycle:['cycle_ticks','success_model','xp_per_success','resource_respawn_seconds','resource_count'],lap:['cycle_ticks','xp_per_success','failure_probability','failure_penalty_seconds'],combat:['cycle_ticks','success_model','xp_per_success'],time_gated:['cycle_ticks','xp_per_success']};
const results=rows.map(row=>{
  const reasons=[];if(!row.source_revision)reasons.push('source_revision_missing');if(!row.source_timestamp)reasons.push('source_timestamp_missing');if(!row.content_hash)reasons.push('content_hash_missing');
  if(row.state==='candidate')reasons.push('candidate_not_parsed');
  const facts=new Set((row.facts||[]).filter(x=>x.state==='verified'&&x.source_locator&&x.source_revision===row.source_revision).map(x=>x.kind)),model=row.model_kind;
  if(!model)reasons.push('model_kind_missing');
  else if(!required[model])reasons.push('model_kind_unknown');
  else for(const fact of required[model])if(!facts.has(fact))reasons.push(`verified_${fact}_missing`);
  if(row.formula_version==null&&row.state==='verified')reasons.push('formula_version_missing');
  return {recordKey:row.record_key,name:row.name,modelKind:model||null,state:reasons.length?'blocked':'verified',reasons:[...new Set(reasons)]};
});
const report={contract:'sensum.activity-evidence-validation.v1',generatedAt:new Date().toISOString(),input:file,records:rows.length,verified:results.filter(x=>x.state==='verified').length,blocked:results.filter(x=>x.state==='blocked').length,absoluteBestActivityGate:results.length&&results.every(x=>x.state==='verified')?'open':'blocked',results,contentHash:hash(results)};
console.log(JSON.stringify(report,null,2));if(report.absoluteBestActivityGate==='open')console.error('All supplied activity records passed the evidence gate.');
