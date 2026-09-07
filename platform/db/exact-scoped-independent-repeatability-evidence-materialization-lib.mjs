import fs from 'node:fs';
import {hash,json} from '../ingestion/lib.mjs';
import {compileExactScopedIndependentRepeatabilityEvidencePolicy} from '../ingestion/exact-scoped-independent-repeatability-evidence-lib.mjs';
import {classifyAcceptedEvidenceAccountIndependence} from './account-independence-classification-lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {
  buildCandidateEvidenceExistingSourceCountQuery,
  buildCandidateEvidenceMaterializationSql,
  buildCandidateEvidenceReconciliationQuery,
  verifyCandidateEvidenceReconciliation
} from './candidate-evidence-materialization-lib.mjs';

export const EXACT_SCOPED_INDEPENDENT_REPEATABILITY_MATERIALIZATION_CONTRACT='sensum.exact-scoped-independent-repeatability-evidence-postgresql-materialization.v1';
export const EXACT_SCOPED_INDEPENDENT_REPEATABILITY_INPUT_DOMAIN='exact-scoped-independent-repeatability-evidence';
export const EXACT_SCOPED_INDEPENDENT_REPEATABILITY_FACT_KIND='raw_exact_scoped_independent_repeatability_evidence';

const POLICY_ID='sensum.exact-scoped-independent-repeatability-evidence-policy.v1';
const POLICY_FILE='platform/policies/exact-scoped-independent-repeatability-evidence-v1.json';
const RECORD_CONTRACT='sensum.exact-scoped-independent-repeatability-evidence.v1';
const AUDIT_CONTRACT='sensum.exact-scoped-independent-repeatability-evidence-audit.v1';
const SOURCE_KIND='revision_pinned_exact_same_line_subject_predicate_independent_repeatability_evidence_without_semantic_verdicts';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/exact-scoped-independent-repeatability-evidence-v1.json',import.meta.url),'utf8'));
const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const assert=(condition,message)=>{if(!condition) throw new Error(message);};

function parseRecords(raw,errors) {
  try{return String(raw||'').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);}
  catch{errors.push('snapshot_ndjson_invalid');return[];}
}

function validSnapshot(snapshot) {
  return snapshot&&typeof snapshot.directory==='string'&&snapshot.directory.length>0&&isSha256(snapshot.contentHash)&&Array.isArray(snapshot.rejections)&&snapshot.rejections.length===0;
}

function validSource(source,{titleKey='resolvedTitle'}={}) {
  return Number.isInteger(Number(source?.sourcePageId))&&Number(source.sourcePageId)>0
    &&typeof source?.[titleKey]==='string'&&source[titleKey].length>0
    &&String(source?.sourceRevision||'').length>0&&Number.isFinite(Date.parse(source?.sourceTimestamp))
    &&String(source?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')&&isSha256(source?.sourceContentHash);
}

function normalizedSource(source,{titleKey='resolvedTitle'}={}) {
  return {providerKey:`wiki-pageid:${Number(source.sourcePageId)}`,sourceUrl:source.sourceUrl,title:source[titleKey],sourceRevision:String(source.sourceRevision),sourceTimestamp:source.sourceTimestamp,sourceContentHash:source.sourceContentHash};
}

const sourceIdentity=source=>`${source.sourceUrl}|${source.sourceRevision}`;

function compactStatement(record) {
  const evidence=record.exactScopedIndependentRepeatabilityEvidence;
  const review=record.exactScopedIndependentRepeatabilityEvidenceReview;
  const payload={
    blockers:record.blockers,
    canonicalActivityKey:record.canonicalActivityIdentity.canonicalActivityKey,
    completeIndependentSourceUniverse:false,
    discoveryCandidateTitles:evidence.discovery.distinctCandidateTitleCount,
    exactSameLineSubjectPredicateCandidateSignals:evidence.exactSameLineSubjectPredicateCandidateSignals.length,
    independentRevisionPinnedSources:evidence.independentSources.length,
    memberTaskRepeatabilityVerdict:null,
    optimizerEligible:false,
    parentActivityRepeatabilityVerdict:null,
    repeatabilityVerdict:null,
    resolvedEvidenceDomains:review.resolvedDomainCount,
    state:record.state
  };
  const envelope={recordKey:record.memberCandidateKey,sourceRevision:String(record.sourceRevision),sourceLocator:{memberCandidateKey:record.memberCandidateKey,canonicalActivityKey:record.canonicalActivityIdentity.canonicalActivityKey,sourcePageId:Number(record.sourcePageId)},payload};
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateExactScopedIndependentRepeatabilityMaterializationInput({raw,manifest,audit}) {
  const errors=[],add=message=>errors.push(message),records=parseRecords(raw,errors),compiled=compileExactScopedIndependentRepeatabilityEvidencePolicy(POLICY);
  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==EXACT_SCOPED_INDEPENDENT_REPEATABILITY_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!==SOURCE_KIND) add('manifest_source_channel_mismatch');
  if(manifest?.source?.api!=='https://oldschool.runescape.wiki/api.php') add('manifest_source_api_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(Number(manifest?.records)!==records.length||records.length!==1) add('manifest_record_count_mismatch');
  if(!compiled.valid||POLICY?.policy!==POLICY_ID||POLICY?.recordContract!==RECORD_CONTRACT||POLICY?.auditContract!==AUDIT_CONTRACT) add('evidence_policy_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest.source.policy.file!==POLICY_FILE||manifest.source.policy.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  if(!validSnapshot(manifest?.source?.inputSnapshot)) add('manifest_input_snapshot_invalid');

  if(audit?.contract!==AUDIT_CONTRACT) add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true) add('audit_not_publishable');
  if(audit?.policy?.id!==POLICY_ID||audit?.policy?.file!==POLICY_FILE||audit?.policy?.contentHash!==hash(POLICY)) add('audit_policy_binding_mismatch');
  if(json(audit?.inputSnapshot)!==json(manifest?.source?.inputSnapshot)) add('audit_input_snapshot_mismatch');
  if(!audit?.outputSnapshot?.directory||audit.outputSnapshot.contentHash!==manifest?.contentHash) add('audit_output_snapshot_mismatch');
  for(const key of ['requests','discoveryRecords','fetchedCandidateRevisions']) if(json(audit?.[key])!==json(manifest?.source?.[key])) add(`audit_manifest_${key}_mismatch`);
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','inputSnapshot','requests','discoveryRecords','fetchedCandidateRevisions','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');
  const accountIndependence=classifyAcceptedEvidenceAccountIndependence({audit,manifest,records});
  if(!accountIndependence.proven) add(`account_independence_not_proven:${accountIndependence.blockers.join('|')}`);

  const input=audit?.inputCoverage||{},policyCoverage=audit?.policyCoverage||{},discovery=audit?.discoveryCoverage||{},revision=audit?.revisionCoverage||{},packets=audit?.packetCoverage||{},preservation=audit?.semanticPreservationCoverage||{};
  if(Number(input.inputWorkOrderCount)!==1||Number(input.eligibleWorkOrderCount)!==1||Number(input.outputRecordCount)!==1) add('audit_input_coverage_mismatch');
  for(const key of ['duplicateInputKeys','duplicateOutputKeys','missingOutputKeys','unexpectedOutputKeys']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  if(policyCoverage.valid!==true||Number(policyCoverage.predicateDefinitionCount)!==POLICY.predicateDefinitions.length||Number(policyCoverage.requiredEvidenceDomainCount)!==POLICY.requiredEvidenceDomains.length||Number(policyCoverage.discoveryChannelCount)!==POLICY.discoveryChannels.length) add('audit_policy_coverage_mismatch');
  for(const key of ['invalidDomains','invalidChannels','invalidDefinitions','duplicateDefinitions','invalidPatterns','invalidRules','invalidDiscovery','forbiddenPaths']) if((policyCoverage[key]||[]).length) add(`audit_policy_failure:${key}`);
  if(Number(discovery.discoveryRecordCount)!==1||Number(discovery.distinctCandidateTitleCount)!==126||Number(discovery.backlinkCandidateTitleCount)!==125||Number(discovery.exactSearchCandidateTitleCount)!==122) add('audit_discovery_coverage_mismatch');
  for(const key of ['duplicateDiscoveryKeys','missingDiscoveryKeys','unexpectedDiscoveryKeys','discoveryIncomplete']) if((discovery[key]||[]).length) add(`audit_discovery_set_not_exact:${key}`);
  if(Number(revision.requestedCandidateTitleCount)!==126||Number(revision.fetchedCandidatePageCount)!==126||Number(revision.retainedIndependentSourceCount)!==124||Number(revision.distinctRetainedRevisionCount)!==124) add('audit_revision_coverage_mismatch');
  for(const key of ['missingCandidatePages','unexpectedCandidatePages','duplicateCandidatePages','revisionFailures']) if((revision[key]||[]).length) add(`audit_revision_failure:${key}`);
  if(Number(packets.requiredDomainPacketCount)!==6||Number(packets.domainPacketCount)!==6||Number(packets.exactSameLineSubjectPredicateCandidateCount)!==0||Number(packets.domainsWithCandidateCount)!==0||Number(packets.reviewedMemberSubjectCount)!==0||Number(packets.resolvedDomainCount)!==0) add('audit_packet_coverage_mismatch');
  for(const key of ['packetFailures','signalFailures']) if((packets[key]||[]).length) add(`audit_packet_failure:${key}`);
  if((preservation.mismatchedRecords||[]).length||(preservation.upstreamMismatches||[]).length||(preservation.unsupportedPromotions||[]).length||Number(preservation.parentAndMemberRepeatabilitySeparatedCount)!==1) add('audit_semantic_preservation_mismatch');
  if(audit?.evidencePacketAttemptCoverageComplete!==true||audit?.exactScopedDiscoveryChannelsComplete!==true||audit?.repeatabilityReviewComplete!==false||audit?.memberExpansionComplete!==false||audit?.mechanicsReviewComplete!==false||Number(audit?.optimizerEligibleCount)!==0||audit?.completeIndependentSourceUniverse!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_semantic_gate_weakened');
  for(const blocker of ['exact_scoped_independent_repeatability_evidence_requires_semantic_disposition','all_repeatability_evidence_domains_remain_unresolved','complete_independent_source_universe_not_established','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const requests=manifest?.source?.requests||[],discoveries=manifest?.source?.discoveryRecords||[],fetched=manifest?.source?.fetchedCandidateRevisions||[];
  if(requests.length!==1||discoveries.length!==1||fetched.length!==126) add('manifest_discovery_population_mismatch');
  const request=requests[0],discoveryRecord=discoveries[0];
  if(request?.namespace!==0||request?.maximumDistinctCandidateTitles!==POLICY.sourceDiscovery.maximumDistinctCandidateTitles||json(request?.channels)!==json(POLICY.discoveryChannels)||request?.memberCandidateKey!==discoveryRecord?.memberCandidateKey||discoveryRecord?.backlinkContinuationComplete!==true||discoveryRecord?.searchContinuationComplete!==true||discoveryRecord?.truncated!==false) add('manifest_discovery_boundary_invalid');
  const fetchedMap=new Map();
  for(const page of fetched) {
    const pageKey=`${Number(page?.pageId)}|${String(page?.revision||'')}`;
    if(fetchedMap.has(pageKey)||!Number.isInteger(Number(page?.pageId))||Number(page.pageId)<=0||!page?.title||!page?.revision||!Number.isFinite(Date.parse(page?.timestamp))||!isSha256(page?.contentHash)) add(`manifest_fetched_revision_invalid:${pageKey}`);
    fetchedMap.set(pageKey,page);
  }
  if(fetchedMap.size!==126) add('manifest_fetched_revision_set_mismatch');

  const record=records[0]||{},key=record?.memberCandidateKey||'unknown';
  if(record?.contract!==RECORD_CONTRACT) add(`record_contract_mismatch:${key}`);
  if(!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
  if(record?.accountIndependent!==true||record?.state!=='exact_scoped_independent_repeatability_evidence_collected_gates_closed'||record?.canonicalGameEntityIdentity!==null||!record?.canonicalActivityIdentity?.canonicalActivityKey||record?.optimizerEligible!==false) add(`record_semantic_gate_weakened:${key}`);
  if(!validSource(record)||record.memberCandidateKey!==request?.memberCandidateKey||record.canonicalActivityIdentity.canonicalActivityKey!==request?.canonicalActivityKey) add(`record_primary_source_or_scope_invalid:${key}`);
  const pageEvidence=record?.sourcePageEvidence||{};
  if(!validSource(pageEvidence)||pageEvidence.resolvedTitle!==record.resolvedTitle||Number(pageEvidence.sourcePageId)!==Number(record.sourcePageId)||String(pageEvidence.sourceRevision)!==String(record.sourceRevision)||pageEvidence.sourceTimestamp!==record.sourceTimestamp||pageEvidence.sourceUrl!==record.sourceUrl||pageEvidence.sourceContentHash!==record.sourceContentHash||Object.values(pageEvidence.revisionAlignment||{}).some(value=>value!==true)) add(`record_primary_revision_alignment_invalid:${key}`);
  if(record?.repeatabilityReview?.state!=='reviewed_blocked'||record.repeatabilityReview.classification!==null||record?.memberExpansionReview?.state!=='unreviewed'||record.memberExpansionReview.atomicSubject!==null||(record.memberExpansionReview.memberKeys||[]).length||(record.memberExpansionReview.evidenceKeys||[]).length||record?.mechanicsReview?.state!=='unreviewed'||(record.mechanicsReview.evidenceKeys||[]).length) add(`record_review_gate_weakened:${key}`);
  const evidence=record?.exactScopedIndependentRepeatabilityEvidence||{},review=record?.exactScopedIndependentRepeatabilityEvidenceReview||{};
  if(evidence.evidenceState!=='revision_pinned_exact_scoped_independent_repeatability_evidence_collected_review_required'||evidence.automaticVerificationApplied!==false||evidence.parentActivityRepeatabilityVerdict!==null||evidence.memberTaskRepeatabilityVerdict!==null||evidence.repeatabilityVerdict!==null||(evidence.reviewedMemberSubjects||[]).length||(evidence.exactSameLineSubjectPredicateCandidateSignals||[]).length) add(`record_repeatability_gate_weakened:${key}`);
  if(review.state!=='unreviewed_exact_scoped_independent_repeatability_evidence_semantic_disposition_required'||Number(review.reviewedDomainCount)!==0||Number(review.resolvedDomainCount)!==0||review.evidenceWorkComplete!==false||review.parentActivityRepeatabilityVerdict!==null||review.memberTaskRepeatabilityVerdict!==null||review.repeatabilityVerdict!==null) add(`record_semantic_review_gate_weakened:${key}`);
  const evidenceDiscovery=evidence.discovery||{};
  if(evidenceDiscovery.backlinkContinuationComplete!==true||evidenceDiscovery.searchContinuationComplete!==true||evidenceDiscovery.truncated!==false||evidenceDiscovery.definedDiscoveryChannelsComplete!==true||evidenceDiscovery.completeIndependentSourceUniverse!==false||Number(evidenceDiscovery.distinctCandidateTitleCount)!==126||json(evidenceDiscovery.channels)!==json(POLICY.discoveryChannels)||unique(evidenceDiscovery.requestedCandidateTitles||[]).length!==126) add(`record_discovery_boundary_invalid:${key}`);
  const domainPackets=evidence.evidenceDomainPackets||[];
  if(domainPackets.length!==POLICY.requiredEvidenceDomains.length||POLICY.requiredEvidenceDomains.some((domain,index)=>domainPackets[index]?.domainKey!==domain)||domainPackets.some(packet=>packet.resolved!==false||packet.evidenceWorkComplete!==false||packet.domainVerdict!==null||Number(packet.exactSameLineSubjectPredicateCandidateCount)!==0)) add(`record_domain_packet_gate_weakened:${key}`);
  const independent=evidence.independentSources||[],independentKeys=new Set(),sourceMap=new Map();
  const primarySource=normalizedSource(record);
  sourceMap.set(sourceIdentity(primarySource),primarySource);
  for(const source of independent) {
    const sourceKey=`${Number(source?.sourcePageId)}|${String(source?.sourceRevision||'')}`;
    if(independentKeys.has(sourceKey)||!validSource(source,{titleKey:'sourceTitle'})||source?.completeSourceRetained!==true||!Number.isInteger(Number(source?.sourceContentBytes))||Number(source.sourceContentBytes)!==Buffer.byteLength(String(source?.exactRevisionSourceText||''),'utf8')||source.sourceContentHash!==hash(source.exactRevisionSourceText)) add(`record_independent_source_invalid:${sourceKey}`);
    independentKeys.add(sourceKey);
    const fetchedPage=fetchedMap.get(sourceKey);
    if(!fetchedPage||fetchedPage.title!==source.sourceTitle||String(fetchedPage.revision)!==String(source.sourceRevision)||fetchedPage.timestamp!==source.sourceTimestamp||fetchedPage.contentHash!==source.sourceContentHash) add(`record_independent_source_manifest_mismatch:${sourceKey}`);
    const lines=String(source.exactRevisionSourceText||'').split(/\r?\n/),sourceLines=source.sourceLines||[];
    if(lines.length!==sourceLines.length||sourceLines.some((line,index)=>Number(line.line)!==index+1||line.text!==lines[index]||line.contentHash!==hash(lines[index]))) add(`record_independent_source_line_hash_mismatch:${sourceKey}`);
    const normalized=normalizedSource(source,{titleKey:'sourceTitle'}),identity=sourceIdentity(normalized),prior=sourceMap.get(identity);
    if(prior&&json(prior)!==json(normalized)) add(`conflicting_exact_wiki_source_identity:${sourceKey}`);
    sourceMap.set(identity,normalized);
  }
  if(independent.length!==124||independentKeys.size!==124||sourceMap.size!==125) add(`record_independent_source_count_mismatch:${key}`);
  for(const blocker of ['exact_scoped_independent_repeatability_evidence_requires_semantic_disposition','all_repeatability_evidence_domains_remain_unresolved','complete_independent_source_universe_not_established','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked']) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
  if(errors.length) throw new Error(`Exact-scoped independent-repeatability materialization input rejected: ${unique(errors).join(', ')}`);

  const sources=[...sourceMap.values()].sort((a,b)=>sourceIdentity(a).localeCompare(sourceIdentity(b))),statements=[compactStatement(record)];
  const gates={accountIndependenceProven:true,accountIndependenceBasis:accountIndependence.basis,evidencePacketAttemptCoverageComplete:true,exactScopedDiscoveryChannelsComplete:true,discoveryCandidateTitles:126,retainedIndependentSources:124,exactSameLineSubjectPredicateCandidateSignals:0,resolvedEvidenceDomains:0,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeIndependentSourceUniverse:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true};
  const model={contract:EXACT_SCOPED_INDEPENDENT_REPEATABILITY_MATERIALIZATION_CONTRACT,domain:EXACT_SCOPED_INDEPENDENT_REPEATABILITY_INPUT_DOMAIN,snapshotDirectory:audit.outputSnapshot.directory,snapshotCreatedAt:manifest.createdAt,snapshotContentHash:manifest.contentHash,auditContentHash:audit.contentHash,sourceRevision:sources.map(source=>source.sourceRevision).sort().join(','),sources,records,statements,skillKeys:[],counts:{sources:125,primarySources:1,records:1,statements:1,discoveryCandidateTitles:126,retainedIndependentSources:124,evidenceDomainPackets:6},gates};
  model.recordHashAggregate=hash(records.map(row=>row.contentHash).sort());model.sourceHashAggregate=hash(sources.map(row=>row.sourceContentHash).sort());model.statementHashAggregate=hash(statements.map(row=>row.contentHash).sort());model.materializationHash=hash(model);model.runId=deterministicUuid('sensum-ingestion-run',`${model.domain}:${model.snapshotContentHash}`);model.snapshotId=deterministicUuid('sensum-data-snapshot',model.snapshotContentHash);
  return model;
}

export function buildExactScopedIndependentRepeatabilityMaterializationSql(model) {
  return buildCandidateEvidenceMaterializationSql(model,{contract:EXACT_SCOPED_INDEPENDENT_REPEATABILITY_MATERIALIZATION_CONTRACT,factKind:EXACT_SCOPED_INDEPENDENT_REPEATABILITY_FACT_KIND,label:'Accepted exact-scoped independent repeatability evidence'});
}
export function buildExactScopedIndependentRepeatabilityExistingSourceCountQuery(model) {return buildCandidateEvidenceExistingSourceCountQuery(model);}
export function buildExactScopedIndependentRepeatabilityReconciliationQuery(model) {return buildCandidateEvidenceReconciliationQuery(model,EXACT_SCOPED_INDEPENDENT_REPEATABILITY_FACT_KIND);}
export function verifyExactScopedIndependentRepeatabilityReconciliation(model,actual) {
  return verifyCandidateEvidenceReconciliation(model,actual,{gateVerifier:metrics=>metrics?.accountIndependenceProven===true&&metrics?.accountIndependenceBasis===model.gates.accountIndependenceBasis&&metrics?.evidencePacketAttemptCoverageComplete===true&&metrics?.exactScopedDiscoveryChannelsComplete===true&&Number(metrics?.discoveryCandidateTitles)===126&&Number(metrics?.retainedIndependentSources)===124&&Number(metrics?.exactSameLineSubjectPredicateCandidateSignals)===0&&Number(metrics?.resolvedEvidenceDomains)===0&&metrics?.repeatabilityReviewComplete===false&&metrics?.memberExpansionReviewComplete===false&&metrics?.mechanicsReviewComplete===false&&metrics?.completeIndependentSourceUniverse===false&&metrics?.completeActivityUniverse===false&&Number(metrics?.optimizerEligibleRecords)===0&&metrics?.automaticVerification===false&&metrics?.semanticReviewRequired===true});
}
