import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildStructuralMemberCandidateIdentityEvidence,
  discoverStructuralMemberCandidateIdentityRequests
} from './structural-member-candidate-identity-evidence-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||'.platform-data');
const policyFile='platform/policies/structural-member-candidate-identity-evidence-v1.json';
const policy=JSON.parse(await fs.readFile(path.resolve(policyFile),'utf8'));
const inputDomain='parent-member-candidate-identity-and-completeness-evidence-work-routing';
const outputDomain='structural-member-candidate-identity-evidence';

async function latestInputSnapshot(){
  const directories=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry=>entry.name).sort().reverse();
  const rejections=[];
  for(const directory of directories){
    try{
      const raw=await fs.readFile(path.join(root,directory,`${inputDomain}.ndjson`),'utf8');
      const rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8'));
      const reasons=[];
      if(manifest.domain!==inputDomain)reasons.push('manifest_domain_mismatch');
      if(manifest.records!==rows.length)reasons.push('record_count_mismatch');
      if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');
      if(manifest.source?.audit?.routingCoverageComplete!==true||manifest.source?.audit?.evidenceWorkComplete!==false||manifest.source?.audit?.memberIdentityReviewComplete!==false||manifest.source?.audit?.publishable!==true)reasons.push('candidate_identity_and_completeness_route_not_publishable');
      if(!rows.length||rows.some(row=>row.contract!==policy.inputContract||row.state!==policy.inputState))reasons.push('unexpected_or_empty_input_contract_or_state');
      if(reasons.length){rejections.push({directory,reasons});continue}
      return {directory,rows,manifest,rejections};
    }catch(error){if(error.code!=='ENOENT')rejections.push({directory,reasons:['snapshot_validation_error'],message:error.message})}
  }
  throw new Error('No valid parent/member candidate-identity and completeness evidence-work routing snapshot exists.');
}

async function fetchSubjectResolutionBatches(requests){
  const batches=[];
  const subjects=requests.map(request=>request.requestedSubject);
  for(let index=0;index<subjects.length;index+=policy.sourceResolution.batchSize){
    const requestedSubjects=subjects.slice(index,index+policy.sourceResolution.batchSize);
    const params=new URLSearchParams({
      action:'query',
      format:'json',
      formatversion:'2',
      redirects:'1',
      prop:'revisions',
      rvprop:'ids|timestamp|content',
      rvslots:'main',
      titles:requestedSubjects.join('|')
    });
    const response=await fetchJson(`${WIKI_API}?${params}`);
    batches.push({requestedSubjects,response});
    if(index+policy.sourceResolution.batchSize<subjects.length)await new Promise(resolve=>setTimeout(resolve,350));
  }
  return batches;
}

const input=await latestInputSnapshot();
const resolutionRequests=discoverStructuralMemberCandidateIdentityRequests(input.rows,policy);
const resolutionBatches=await fetchSubjectResolutionBatches(resolutionRequests);
const built=buildStructuralMemberCandidateIdentityEvidence({routingRecords:input.rows,resolutionBatches,policy,contentHash:hash});
const inputSnapshot={directory:input.directory,contentHash:input.manifest.contentHash,rejections:input.rejections};
const resolvedSubjects=built.records.flatMap(record=>record.structuralMemberCandidateIdentityEvidenceSources||[]).map(packet=>({
  workItemKey:packet.workItemKey,
  requestedSubject:packet.sourceRequestResolution.requestedSubject,
  normalizedSubject:packet.sourceRequestResolution.normalizedSubject,
  resolvedSubject:packet.sourceRequestResolution.resolvedSubject,
  normalizationChain:packet.sourceRequestResolution.normalizationChain,
  redirectChain:packet.sourceRequestResolution.redirectChain,
  pageId:packet.sourcePageIdentity.sourcePageId,
  revision:packet.sourcePageIdentity.sourceRevision,
  timestamp:packet.sourcePageIdentity.sourceTimestamp,
  sourceUrl:packet.sourcePageIdentity.sourceUrl,
  sourceContentHash:packet.sourcePageIdentity.sourceContentHash,
  sourceContentBytes:packet.sourcePageIdentity.sourceContentBytes,
  evidencePacketComplete:packet.evidencePacketComplete,
  deficiencies:packet.deficiencies
}));
const source={
  kind:'revision_pinned_structural_member_candidate_subject_page_identity_evidence_without_member_entity_type_parent_membership_or_completeness_verdict',
  api:WIKI_API,
  fetchMode:'official Wiki title resolution with normalization and redirect chains plus complete current observed revision source text',
  policy:{id:policy.policy,file:policyFile,contentHash:hash(policy)},
  inputSnapshot,
  resolutionRequests,
  resolvedSubjects,
  audit:built.audit
};
const snapshot=await writeSnapshot(root,outputDomain,built.records.map(record=>({...record,contentHash:hash(record)})),source);
const generatedAt=new Date().toISOString();
const report={...built.audit,generatedAt,policy:source.policy,inputSnapshot,resolutionRequests,resolvedSubjects,outputSnapshot:{directory:path.basename(snapshot.dir),contentHash:snapshot.manifest.contentHash}};
report.contentHash=hash({...report,contentHash:undefined});
const output=path.join(root,`${outputDomain}-audits`,generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  contract:report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot:report.outputSnapshot,
  coverage:{
    inputCoverage:report.inputCoverage,
    requestCoverage:report.requestCoverage,
    resolutionCoverage:report.resolutionCoverage,
    parentCandidateAlignmentCoverage:report.parentCandidateAlignmentCoverage,
    evidencePacketAttemptCoverageComplete:report.evidencePacketAttemptCoverageComplete,
    candidateSubjectIdentityEvidencePacketCoverageComplete:report.candidateSubjectIdentityEvidencePacketCoverageComplete,
    memberIdentityReviewComplete:report.memberIdentityReviewComplete,
    completeActivityUniverse:report.completeActivityUniverse,
    absoluteBestGate:report.absoluteBestGate,
    blockers:report.blockers,
    publishable:report.publishable
  }
},null,2));
if(!report.publishable)process.exitCode=2;
