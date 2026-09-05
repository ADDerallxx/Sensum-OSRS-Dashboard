import fs from 'node:fs/promises';
import path from 'node:path';
import { hash,writeSnapshot } from '../ingestion/lib.mjs';
import { buildStructuralMemberCandidateSemanticGapEvidenceWorkRoutes } from './structural-member-candidate-semantic-gap-evidence-work-routing-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||'.platform-data');
const policyFile='platform/policies/structural-member-candidate-semantic-gap-evidence-work-routing-v1.json';
const policy=JSON.parse(await fs.readFile(path.resolve(policyFile),'utf8'));
const inputDomain='structural-member-candidate-identity-evidence-disposition',outputDomain='structural-member-candidate-semantic-gap-evidence-work-routing';

async function latestInputSnapshot(){
  const directories=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry=>entry.name).sort().reverse(),rejections=[];
  for(const directory of directories){
    try{
      const raw=await fs.readFile(path.join(root,directory,`${inputDomain}.ndjson`),'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8')),reasons=[];
      if(manifest.domain!==inputDomain)reasons.push('manifest_domain_mismatch');
      if(manifest.records!==rows.length)reasons.push('record_count_mismatch');
      if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');
      if(manifest.source?.audit?.semanticDispositionAttemptCoverageComplete!==true||manifest.source?.audit?.stableSubjectIdentityDispositionComplete!==true||manifest.source?.audit?.structuralParentRelationshipDispositionComplete!==true||manifest.source?.audit?.memberIdentityReviewComplete!==false||manifest.source?.audit?.publishable!==true)reasons.push('candidate_identity_semantic_disposition_not_publishable');
      if(!rows.length||rows.some(row=>row.contract!==policy.inputContract||row.state!==policy.inputState))reasons.push('unexpected_or_empty_input_contract_or_state');
      if(reasons.length){rejections.push({directory,reasons});continue;}
      return {directory,rows,manifest,rejections};
    }catch(error){if(error.code!=='ENOENT')rejections.push({directory,reasons:['snapshot_validation_error'],message:error.message});}
  }
  throw new Error('No valid structural member candidate identity semantic-disposition snapshot exists.');
}

const input=await latestInputSnapshot();
const built=buildStructuralMemberCandidateSemanticGapEvidenceWorkRoutes({dispositionRecords:input.rows,policy});
const inputSnapshot={directory:input.directory,contentHash:input.manifest.contentHash,rejections:input.rejections};
const source={kind:'generic_split_candidate_identity_page_type_structural_relationship_weighted_membership_parent_mapping_and_complete_universe_evidence_work_routing_without_evidence_or_verdict',policy:{id:policy.policy,file:policyFile,contentHash:hash(policy)},inputSnapshot,audit:built.audit};
const snapshot=await writeSnapshot(root,outputDomain,built.records.map(record=>({...record,contentHash:hash(record)})),source),generatedAt=new Date().toISOString(),report={...built.audit,generatedAt,policy:source.policy,inputSnapshot,outputSnapshot:{directory:path.basename(snapshot.dir),contentHash:snapshot.manifest.contentHash}};
report.contentHash=hash({...report,contentHash:undefined});
const output=path.join(root,`${outputDomain}-audits`,generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({contract:report.contract,generatedAt,inputSnapshot,outputSnapshot:report.outputSnapshot,coverage:{inputCoverage:report.inputCoverage,routingCoverage:report.routingCoverage,branchSeparationCoverage:report.branchSeparationCoverage,semanticPreservationCoverage:report.semanticPreservationCoverage,routingCoverageComplete:report.routingCoverageComplete,evidenceWorkComplete:report.evidenceWorkComplete,memberIdentityReviewComplete:report.memberIdentityReviewComplete,completeActivityUniverse:report.completeActivityUniverse,absoluteBestGate:report.absoluteBestGate,blockers:report.blockers,publishable:report.publishable}},null,2));
if(!report.publishable)process.exitCode=2;
