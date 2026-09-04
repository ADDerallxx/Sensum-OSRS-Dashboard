import fs from 'node:fs/promises';
import path from 'node:path';
import {hash,writeSnapshot} from '../ingestion/lib.mjs';
import {buildCrossSourceEntityActivityCandidates} from './cross-source-entity-activity-candidate-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||'.platform-data');

async function latestCrosswalk(){
  const directories=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry=>entry.name).sort().reverse(),rejections=[];
  for(const directory of directories){
    try{
      const file=path.join(root,directory,'skill-training-guide-unlock-page-crosswalk.ndjson'),raw=await fs.readFile(file,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8')),reasons=[];
      if(manifest.domain!=='skill-training-guide-unlock-page-crosswalk')reasons.push('manifest_domain_mismatch');
      if(manifest.records!==rows.length)reasons.push('record_count_mismatch');
      if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');
      if(manifest.source?.audit?.crosswalkCoverageComplete!==true||manifest.source.audit.publishable!==true)reasons.push('crosswalk_scope_not_complete');
      if(rows.some(record=>record.contract!=='sensum.skill-training-guide-unlock-page-crosswalk.v1'))reasons.push('unexpected_crosswalk_record_contract');
      if(reasons.length){rejections.push({directory,reasons});continue}
      return {directory,rows,manifest,rejections};
    }catch(error){if(error.code!=='ENOENT')rejections.push({directory,reasons:['snapshot_validation_error'],message:error.message})}
  }
  throw new Error('No valid skill-training-guide/unlock-page crosswalk snapshot exists.');
}

const crosswalk=await latestCrosswalk(),built=buildCrossSourceEntityActivityCandidates({crosswalkRecords:crosswalk.rows}),inputSnapshot={directory:crosswalk.directory,contentHash:crosswalk.manifest.contentHash,rejections:crosswalk.rejections},source={kind:'cross_source_entity_and_activity_identity_semantic_review_candidate_inventory',inputSnapshot,audit:built.audit},snapshot=await writeSnapshot(root,'cross-source-entity-activity-candidate',built.records.map(record=>({...record,contentHash:hash(record)})),source),generatedAt=new Date().toISOString(),report={...built.audit,generatedAt,inputSnapshot,outputSnapshot:{directory:path.basename(snapshot.dir),contentHash:snapshot.manifest.contentHash}};
report.contentHash=hash({...report,contentHash:undefined});
const output=path.join(root,'cross-source-entity-activity-candidate-audits',generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({contract:report.contract,generatedAt:report.generatedAt,inputSnapshot:report.inputSnapshot,outputSnapshot:report.outputSnapshot,coverage:{inputCoverage:report.inputCoverage,candidateCoverage:report.candidateCoverage,revisionCoverage:report.revisionCoverage,semanticReviewCoverage:report.semanticReviewCoverage,candidateInventoryComplete:report.candidateInventoryComplete,completeActivityUniverse:report.completeActivityUniverse,absoluteBestGate:report.absoluteBestGate,blockers:report.blockers,publishable:report.publishable}},null,2));
if(!report.publishable)process.exitCode=2;
