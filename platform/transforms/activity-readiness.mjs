import fs from 'node:fs/promises';
import path from 'node:path';
import {hash,json} from '../ingestion/lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--root='))?.slice(7)||'.platform-data');
async function latestCanonical(){
  const base=path.join(root,'canonical');
  const dirs=(await fs.readdir(base,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();
  for(const dir of dirs){
    const file=path.join(base,dir,'recipes.ndjson');
    try{return {dir,file,rows:(await fs.readFile(file,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)}}catch{}
  }
  throw new Error('No canonical recipe snapshot found. Run canonicalize.mjs first.');
}

const input=await latestCanonical();
const candidates=input.rows.filter(row=>row.capabilities?.training_candidate);
const unresolved=candidates.filter(row=>!row.capabilities?.xp_rate_ready);
const buckets={};
for(const row of unresolved){
  for(const skill of (row.skills||[]).filter(x=>Number(x.xp)>0)){
    const bucket=buckets[skill.skill]||(buckets[skill.skill]={candidates:0,missingTicks:0,missingSourceRevision:0,examples:[]});
    bucket.candidates++;
    if(row.reasons?.includes('ticks_missing'))bucket.missingTicks++;
    if(row.reasons?.includes('source_revision_missing'))bucket.missingSourceRevision++;
    if(bucket.examples.length<8)bucket.examples.push({recordKey:row.record_key,name:row.name,xp:Number(skill.xp),sourceUrl:row.source_url,sourceRevision:row.source_revision||null});
  }
}
const skills=Object.entries(buckets).map(([skill,value])=>({skill,...value})).sort((a,b)=>b.candidates-a.candidates||a.skill.localeCompare(b.skill));
const queue=unresolved.map(row=>({recordKey:row.record_key,name:row.name,skills:(row.skills||[]).filter(x=>Number(x.xp)>0).map(x=>x.skill),reasonCodes:[...new Set(row.reasons||[])],recommendedModelKind:row.method_type==='activity'?'activity_model_required':'production_timing_required',sourceUrl:row.source_url,sourceRevision:row.source_revision||null}));
const report={contract:'sensum.activity-readiness-report.v1',generatedAt:new Date().toISOString(),canonicalInput:input.dir,totalTrainingCandidates:candidates.length,xpRateReady:candidates.length-unresolved.length,activityEnrichmentQueue:unresolved.length,absoluteBestActivityGate:'blocked',skills,contentHash:hash({input:input.dir,queue})};
const out=path.join(root,'activity',report.generatedAt.replace(/[:.]/g,'-'));await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'enrichment-queue.ndjson'),queue.map(json).join('\n')+'\n');
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
