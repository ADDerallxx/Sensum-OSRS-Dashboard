import fs from 'node:fs';
import {hash,json} from '../ingestion/lib.mjs';
import {compileRepeatabilityGapEvidencePolicy} from '../ingestion/activity-reference-collection-member-repeatability-gap-evidence-lib.mjs';
import {compileRepeatabilityEvidencePolicy} from '../ingestion/activity-reference-collection-member-repeatability-evidence-lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {
  buildCandidateEvidenceExistingSourceCountQuery,
  buildCandidateEvidenceMaterializationSql,
  buildCandidateEvidenceReconciliationQuery,
  verifyCandidateEvidenceReconciliation
} from './candidate-evidence-materialization-lib.mjs';

export const ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_MATERIALIZATION_CONTRACT='sensum.activity-reference-collection-member-repeatability-gap-evidence-postgresql-materialization.v1';
export const ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_INPUT_DOMAIN='activity-reference-collection-member-repeatability-gap-evidence';
export const ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_FACT_KIND='raw_activity_reference_member_repeatability_gap_evidence';

const POLICY_ID='sensum.activity-reference-collection-member-repeatability-gap-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-repeatability-gap-evidence-v1.json';
const SIGNAL_POLICY_ID='sensum.activity-reference-collection-member-repeatability-evidence-policy.v1';
const SIGNAL_POLICY_FILE='platform/policies/activity-reference-collection-member-repeatability-evidence-v1.json';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-reference-collection-member-repeatability-gap-evidence-v1.json',import.meta.url),'utf8'));
const SIGNAL_POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-reference-collection-member-repeatability-evidence-v1.json',import.meta.url),'utf8'));
const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const sourceIdentity=source=>`${source.sourceUrl}|${source.sourceRevision}`;
const pageRevisionKey=source=>`${Number(source.sourcePageId)}|${String(source.sourceRevision)}`;
const wikiUrl=title=>`https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title||'').replaceAll(' ','_'))}`;
const assert=(condition,message)=>{if(!condition) throw new Error(message);};

function containsAccountState(value) {
  if(Array.isArray(value)) return value.some(containsAccountState);
  if(!value||typeof value!=='object') return false;
  return Object.entries(value).some(([key,child])=>accountKey(key)||containsAccountState(child));
}
function parseRecords(raw,errors) {
  try{return String(raw||'').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);}
  catch{errors.push('snapshot_ndjson_invalid');return[];}
}
function validWikiSource(source) {
  return Number.isInteger(Number(source?.sourcePageId))&&Number(source.sourcePageId)>0
    &&typeof source?.resolvedTitle==='string'&&source.resolvedTitle.length>0
    &&typeof source?.sourceRevision==='string'&&source.sourceRevision.length>0
    &&Number.isFinite(Date.parse(source?.sourceTimestamp))
    &&String(source?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')
    &&isSha256(source?.sourceContentHash);
}
function wikiSource(source) {
  return {providerKey:`wiki-pageid:${Number(source.sourcePageId)}`,sourceUrl:source.sourceUrl,title:source.resolvedTitle,sourceRevision:String(source.sourceRevision),sourceTimestamp:source.sourceTimestamp,sourceContentHash:source.sourceContentHash};
}
function addSource(sourceMap,pageMap,source,errors,context) {
  if(!validWikiSource(source)){errors.push(`invalid_exact_wiki_source:${context}`);return;}
  const normalized=wikiSource(source),identity=sourceIdentity(normalized),pageKey=pageRevisionKey(source),prior=sourceMap.get(identity),priorPage=pageMap.get(pageKey);
  if(prior&&json(prior)!==json(normalized)) errors.push(`conflicting_exact_wiki_source_identity:${context}`);
  if(priorPage&&sourceIdentity(priorPage)!==identity) errors.push(`conflicting_wiki_page_revision_identity:${context}`);
  sourceMap.set(identity,normalized);pageMap.set(pageKey,normalized);
}
function compactStatement(record) {
  const observations=record.corroboratingRepeatabilityCandidateObservations;
  const payload={
    blockers:record.blockers,
    candidatePageCount:observations.candidatePageCount,
    candidateRequestCount:observations.candidateRequestCount,
    candidateScopeVerdict:null,
    canonicalActivityIdentity:record.canonicalActivityIdentity,
    mechanicsState:record.mechanicsReview.state,
    memberExpansionState:record.memberExpansionReview.state,
    optimizerEligible:false,
    repeatabilityClassification:null,
    repeatabilityReviewState:record.repeatabilityReview.state,
    repeatabilityVerdict:null,
    sourceLocatedSignalCount:observations.sourceLocatedSignalCount,
    state:record.state
  };
  const envelope={recordKey:record.memberCandidateKey,sourceRevision:String(record.sourceRevision),sourceLocator:{memberCandidateKey:record.memberCandidateKey,canonicalActivityKey:record.canonicalActivityIdentity.canonicalActivityKey,sourcePageId:Number(record.sourcePageId)},payload};
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityReferenceMemberRepeatabilityGapMaterializationInput({raw,manifest,audit}) {
  const errors=[],add=message=>errors.push(message),records=parseRecords(raw,errors);
  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_source_authored_link_corroborating_repeatability_evidence_without_semantic_promotion') add('manifest_source_channel_mismatch');
  if(manifest?.source?.api!=='https://oldschool.runescape.wiki/api.php') add('manifest_source_api_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(Number(manifest?.records)!==records.length||records.length===0) add('manifest_record_count_mismatch');

  const compiled=compileRepeatabilityGapEvidencePolicy(POLICY),compiledSignals=compileRepeatabilityEvidencePolicy(SIGNAL_POLICY);
  if(POLICY?.policy!==POLICY_ID||POLICY?.recordContract!=='sensum.activity-reference-collection-member-repeatability-gap-evidence.v1'||POLICY?.auditContract!=='sensum.activity-reference-collection-member-repeatability-gap-evidence-audit.v1'||compiled.invalidRules.length||compiled.forbiddenPolicyPaths.length||compiled.invalidStructuralSignalKinds.length||compiled.missingStructuralSignalKinds.length||compiled.invalidDiscoveryChannels.length||compiled.missingDiscoveryChannels.length) add('gap_policy_invalid');
  if(SIGNAL_POLICY?.policy!==SIGNAL_POLICY_ID||compiledSignals.invalidRules.length||compiledSignals.forbiddenPolicyPaths.length||compiledSignals.duplicateDefinitionKeys.length||compiledSignals.invalidDefinitionKeys.length||compiledSignals.requiredDefinitionKindsMissing.length) add('repeatability_signal_policy_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest.source.policy.file!==POLICY_FILE||manifest.source.policy.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  if(manifest?.source?.repeatabilitySignalPolicy?.id!==SIGNAL_POLICY_ID||manifest.source.repeatabilitySignalPolicy.file!==SIGNAL_POLICY_FILE||manifest.source.repeatabilitySignalPolicy.contentHash!==hash(SIGNAL_POLICY)) add('manifest_signal_policy_binding_mismatch');
  if((manifest?.source?.inputSnapshot?.rejections||[]).length||!isSha256(manifest?.source?.inputSnapshot?.contentHash)||!manifest?.source?.inputSnapshot?.directory) add('manifest_input_snapshot_invalid');

  if(audit?.contract!=='sensum.activity-reference-collection-member-repeatability-gap-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(audit?.policy?.id!==POLICY_ID||audit.policy.file!==POLICY_FILE||audit.policy.contentHash!==hash(POLICY)) add('audit_policy_binding_mismatch');
  if(audit?.repeatabilitySignalPolicy?.id!==SIGNAL_POLICY_ID||audit.repeatabilitySignalPolicy.file!==SIGNAL_POLICY_FILE||audit.repeatabilitySignalPolicy.contentHash!==hash(SIGNAL_POLICY)) add('audit_signal_policy_binding_mismatch');
  if(json(audit?.inputSnapshot)!==json(manifest?.source?.inputSnapshot)) add('audit_input_snapshot_mismatch');
  if(!audit?.outputSnapshot?.directory||audit.outputSnapshot.contentHash!==manifest?.contentHash||(manifest?.snapshotDirectory&&audit.outputSnapshot.directory!==manifest.snapshotDirectory)) add('audit_output_snapshot_mismatch');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','repeatabilitySignalPolicy','inputSnapshot','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{},policyAudit=audit?.policyCoverage||{},discovery=audit?.candidateDiscoveryCoverage||{},alignment=audit?.sourceAlignmentCoverage||{},signalAudit=audit?.repeatabilitySignalCoverage||{},promotion=audit?.semanticPromotionCoverage||{};
  if(Number(input.expectedGapRouteCount)!==records.length||Number(input.evidencePacketCount)!==records.length||input.exactInputOutputSetAndContextMatch!==true) add('audit_input_coverage_mismatch');
  for(const key of ['duplicateInputMemberCandidateKeys','duplicateOutputMemberCandidateKeys','missingMemberCandidateKeys','unexpectedMemberCandidateKeys','contextMismatchMemberCandidateKeys','structurallyInvalidInputMemberCandidateKeys']) if((input[key]||[]).length) add(`audit_input_set_invalid:${key}`);
  for(const key of ['invalidRules','forbiddenPolicyPaths','invalidStructuralSignalKinds','missingStructuralSignalKinds','invalidDiscoveryChannels','missingDiscoveryChannels','repeatabilitySignalPolicyInvalidRules','repeatabilitySignalPolicyForbiddenPaths','repeatabilitySignalPolicyDuplicateDefinitionKeys','repeatabilitySignalPolicyInvalidDefinitionKeys','repeatabilitySignalPolicyRequiredDefinitionKindsMissing']) if((policyAudit[key]||[]).length) add(`audit_policy_gate_invalid:${key}`);
  if(policyAudit.policy!==POLICY_ID||policyAudit.repeatabilitySignalPolicy!==SIGNAL_POLICY_ID) add('audit_policy_identity_mismatch');
  for(const key of ['evidenceMismatchMemberCandidateKeys','incompletePacketMemberCandidateKeys','unsupportedVerdictMemberCandidateKeys','repeatabilityDispositionMutationMemberCandidateKeys','unsupportedDownstreamPromotionMemberCandidateKeys']) {
    const owner=key==='evidenceMismatchMemberCandidateKeys'?discovery:key==='incompletePacketMemberCandidateKeys'?alignment:key==='unsupportedVerdictMemberCandidateKeys'?signalAudit:promotion;
    if((owner?.[key]||[]).length) add(`audit_semantic_or_evidence_drift:${key}`);
  }
  for(const key of ['memberExpansionReviewedCount','mechanicsReviewedCount','optimizerEligibleCount']) if(Number(promotion[key])!==0) add(`audit_semantic_gate_weakened:${key}`);
  if((audit?.accountStateFindings||[]).length||audit?.evidencePacketAttemptCoverageComplete!==true||audit?.repeatabilityGapEvidencePacketCoverageComplete!==true||audit?.repeatabilityReviewComplete!==false||audit?.memberExpansionReviewComplete!==false||audit?.mechanicsReviewComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  for(const blocker of ['corroborating_repeatability_evidence_requires_semantic_disposition','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const fetched=manifest?.source?.fetchedRevisions||[],requestedTitles=manifest?.source?.requestedTitles||[],fetchedByTitle=new Map();
  for(const source of fetched) {
    if(fetchedByTitle.has(source.requestedTitle)) add(`manifest_duplicate_requested_title:${source.requestedTitle}`);
    fetchedByTitle.set(source.requestedTitle,source);
    if(Number(source.namespace)!==0||!Number.isInteger(Number(source.pageId))||!source.resolvedTitle||!source.revision||!Number.isFinite(Date.parse(source.timestamp))||!isSha256(source.contentHash)) add(`manifest_fetched_revision_invalid:${source.requestedTitle}`);
  }
  if(fetched.length!==requestedTitles.length||fetchedByTitle.size!==fetched.length||json(sorted(fetchedByTitle.keys()))!==json(sorted(requestedTitles))) add('manifest_requested_title_set_mismatch');

  const definitions=new Map(compiledSignals.definitions.map(definition=>[definition.definitionKey,definition])),sourceMap=new Map(),pageMap=new Map(),seenRecordKeys=[],seenActivityKeys=[],globalAssessments=[],globalContexts=[],globalPages=[],globalSignals=[];
  const requiredRecordBlockers=['recurrence_or_session_structure_is_not_explicit_repeatability_evidence','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked','repeatability_evidence_gap_or_conflict_remains_blocked','corroborating_repeatability_evidence_requires_semantic_disposition'];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';seenRecordKeys.push(key);seenActivityKeys.push(record?.canonicalActivityIdentity?.canonicalActivityKey);
    if(record?.contract!=='sensum.activity-reference-collection-member-repeatability-gap-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    if(record?.state!=='corroborating_repeatability_evidence_packet_ready_for_semantic_disposition'||record?.optimizerEligible!==false||record?.canonicalGameEntityIdentity!==null) add(`record_semantic_gate_weakened:${key}`);
    if(!record?.canonicalActivityIdentity?.canonicalActivityKey||record?.canonicalActivityIdentity?.linkedSubjectIsCanonicalActivity!==false||record?.canonicalActivityIdentityReview?.state!=='reviewed_source_supported'||json(record.canonicalActivityIdentityReview.identity)!==json(record.canonicalActivityIdentity)) add(`record_canonical_activity_identity_invalid:${key}`);
    if(record?.repeatabilityDisposition?.state!=='unresolved_recurrence_or_session_structure_without_explicit_declaration'||record.repeatabilityDisposition.classification!==null||record?.repeatabilityReview?.state!=='reviewed_blocked'||record.repeatabilityReview.classification!==null) add(`record_repeatability_gate_weakened:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record.memberExpansionReview.atomicSubject!==null||(record.memberExpansionReview.memberKeys||[]).length||(record.memberExpansionReview.evidenceKeys||[]).length) add(`record_member_expansion_gate_weakened:${key}`);
    if(record?.mechanicsReview?.state!=='unreviewed'||(record.mechanicsReview.evidenceKeys||[]).length) add(`record_mechanics_gate_weakened:${key}`);
    for(const blocker of requiredRecordBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    for(const [name,value] of Object.entries(record||{})) if(name.endsWith('ContentHash')&&!isSha256(value)) add(`record_provenance_hash_invalid:${key}:${name}`);
    addSource(sourceMap,pageMap,record,errors,`primary:${key}`);

    const evidence=record?.corroboratingRepeatabilityEvidence||{},observations=record?.corroboratingRepeatabilityCandidateObservations||{},boundary=evidence.discoveryBoundary||{},requests=boundary.candidateRequests||[],assessments=boundary.candidateRequestAssessments||[],pages=evidence.candidatePages||[],assessmentByTitle=new Map(assessments.map(item=>[item.requestedTitle,item]));
    if(evidence.evidenceState!=='complete_revision_pinned_corroborating_repeatability_evidence_packet'||boundary.routeKey!==POLICY.inputRoute.routeKey||boundary.routeState!==POLICY.inputRoute.routeState) add(`record_evidence_state_or_route_invalid:${key}`);
    if(requests.length!==assessments.length||assessmentByTitle.size!==assessments.length) add(`record_candidate_request_set_invalid:${key}`);
    for(const request of requests) {
      const assessment=assessmentByTitle.get(request.requestedTitle),fetchedSource=fetchedByTitle.get(request.requestedTitle);
      if(!assessment||json(request.discoveryContexts)!==json(assessment.discoveryContexts)) add(`record_candidate_request_assessment_mismatch:${key}:${request.requestedTitle}`);
      if(!fetchedSource||Number(fetchedSource.pageId)!==Number(assessment?.sourcePageId)||fetchedSource.resolvedTitle!==assessment?.resolvedTitle||Boolean(fetchedSource.redirected)!==Boolean(assessment?.redirected)||Number(fetchedSource.namespace)!==Number(assessment?.namespace)) add(`record_manifest_resolution_mismatch:${key}:${request.requestedTitle}`);
      for(const context of request.discoveryContexts||[]) if(!POLICY.discovery.channels.includes(context.channel)) add(`record_discovery_channel_invalid:${key}:${request.requestedTitle}`);
    }
    const eligible=assessments.filter(item=>item.state==='eligible_revision_pinned_candidate'),excluded=assessments.filter(item=>item.state==='excluded_already_scanned_source'),excludedIds=new Set((boundary.previouslyScannedPageIdsExcluded||[]).map(Number));
    if(eligible.length!==requests.filter(request=>assessmentByTitle.get(request.requestedTitle)?.state==='eligible_revision_pinned_candidate').length||excluded.some(item=>!excludedIds.has(Number(item.sourcePageId)))||assessments.some(item=>!['eligible_revision_pinned_candidate','excluded_already_scanned_source'].includes(item.state))) add(`record_candidate_assessment_state_invalid:${key}`);
    const expectedPageIds=new Set(eligible.map(item=>Number(item.sourcePageId))),actualPageIds=new Set(pages.map(page=>Number(page.sourcePageId)));
    if(expectedPageIds.size!==pages.length||actualPageIds.size!==pages.length||[...expectedPageIds].some(id=>!actualPageIds.has(id))) add(`record_candidate_page_set_invalid:${key}`);
    const primaryAssessment=excluded.find(item=>Number(item.sourcePageId)===Number(record.sourcePageId)),primaryFetch=primaryAssessment&&fetchedByTitle.get(primaryAssessment.requestedTitle);
    if(!primaryAssessment||!primaryFetch||String(primaryFetch.revision)!==String(record.sourceRevision)||primaryFetch.timestamp!==record.sourceTimestamp||primaryFetch.contentHash!==record.sourceContentHash) add(`record_primary_manifest_revision_mismatch:${key}`);
    for(const page of pages) {
      addSource(sourceMap,pageMap,page,errors,`candidate:${key}:${pageRevisionKey(page)}`);
      if(page.completeRevisionContentScanned!==true||page.reviewState!=='corroborating_source_candidate_only_not_a_repeatability_verdict'||page.repeatabilityVerdict!==null||!Number.isInteger(Number(page.sourceContentBytes))||Number(page.sourceContentBytes)<=0||(page.requestedTitles||[]).length===0) add(`candidate_page_gate_invalid:${key}:${page.sourcePageId}`);
      for(const title of page.requestedTitles||[]) {
        const fetchedSource=fetchedByTitle.get(title),assessment=assessmentByTitle.get(title);
        if(!fetchedSource||!assessment||assessment.state!=='eligible_revision_pinned_candidate'||Number(fetchedSource.pageId)!==Number(page.sourcePageId)||fetchedSource.resolvedTitle!==page.resolvedTitle||String(fetchedSource.revision)!==String(page.sourceRevision)||fetchedSource.timestamp!==page.sourceTimestamp||fetchedSource.contentHash!==page.sourceContentHash) add(`candidate_page_manifest_revision_mismatch:${key}:${title}`);
      }
      const expectedRedirects=(page.requestedTitles||[]).filter(title=>fetchedByTitle.get(title)?.redirected===true).sort(),actualRedirects=sorted(page.redirectedRequestedTitles||[]);
      if(json(expectedRedirects)!==json(actualRedirects)) add(`candidate_page_redirect_set_mismatch:${key}:${page.sourcePageId}`);
      const signalKeys=new Set();
      for(const signal of page.sourceLocatedSignals||[]) {
        const definition=definitions.get(signal.definitionKey);
        if(!signal.evidenceKey||signalKeys.has(signal.evidenceKey)) add(`candidate_signal_identity_invalid:${key}:${signal.evidenceKey}`);else signalKeys.add(signal.evidenceKey);
        if(!definition||definition.signalKind!==signal.signalKind||signal.reviewState!=='candidate_only_not_a_repeatability_verdict'||signal.scannedTextHash!==page.sourceContentHash||signal.sourceContentHash!==page.sourceContentHash||Number(signal.sourcePageId)!==Number(page.sourcePageId)||String(signal.sourceRevision)!==String(page.sourceRevision)||!signal.contextText||!signal.matchedText||!Number.isInteger(Number(signal.sourceLocator?.lineStart))||!Number.isInteger(Number(signal.sourceLocator?.lineEnd))) add(`candidate_signal_source_or_policy_mismatch:${key}:${signal.evidenceKey}`);
      }
      globalPages.push(page);globalSignals.push(...(page.sourceLocatedSignals||[]));
    }
    const count=kind=>pages.flatMap(page=>page.sourceLocatedSignals||[]).filter(signal=>signal.signalKind===kind).length;
    const derived={candidateRequestCount:requests.length,discoveryContextCount:requests.reduce((sum,item)=>sum+(item.discoveryContexts||[]).length,0),candidatePageCount:pages.length,candidateSourceBytesScanned:pages.reduce((sum,page)=>sum+Number(page.sourceContentBytes),0),sourceLocatedSignalCount:pages.reduce((sum,page)=>sum+(page.sourceLocatedSignals||[]).length,0),explicitPositiveDeclarationCandidateCount:count('explicit_positive_repeatability_declaration_candidate'),explicitNegativeDeclarationCandidateCount:count('explicit_negative_repeatability_declaration_candidate'),recurrenceStructureCandidateCount:count('recurrence_structure_candidate'),sessionBoundaryCandidateCount:count('session_boundary_candidate'),repeatabilityVerdict:null,candidateScopeVerdict:null,deficiencies:[]};
    if(json(derived)!==json(observations)) add(`record_observation_reconciliation_failed:${key}`);
    globalAssessments.push(...assessments);globalContexts.push(...requests.flatMap(request=>request.discoveryContexts||[]));
  }
  if(unique(seenRecordKeys).length!==seenRecordKeys.length||unique(seenActivityKeys).length!==seenActivityKeys.length) add('record_or_activity_identity_not_unique');
  const channelCounts=Object.fromEntries(POLICY.discovery.channels.map(channel=>[channel,globalContexts.filter(context=>context.channel===channel).length]));
  if(Number(discovery.candidateRequestCount)!==globalAssessments.length||Number(discovery.discoveryContextCount)!==globalContexts.length||json(discovery.discoveryChannelCounts)!==json(channelCounts)||Number(discovery.eligibleRequestCount)!==globalAssessments.filter(item=>item.state==='eligible_revision_pinned_candidate').length||Number(discovery.excludedAlreadyScannedRequestCount)!==globalAssessments.filter(item=>item.state==='excluded_already_scanned_source').length||Number(discovery.excludedNonMainNamespaceRequestCount)!==0||Number(discovery.missingCandidateRequestCount)!==0||Number(discovery.uniqueResolvedCandidatePageCount)!==globalPages.length||discovery.duplicateResolvedPageContextsPreserved!==(globalContexts.length>globalPages.length)) add('audit_discovery_counts_do_not_reconcile');
  if(Number(alignment.revisionPinnedCandidatePageCount)!==globalPages.length||Number(alignment.candidateSourceBytesScanned)!==globalPages.reduce((sum,page)=>sum+Number(page.sourceContentBytes),0)) add('audit_source_alignment_counts_do_not_reconcile');
  const signalCount=kind=>globalSignals.filter(signal=>signal.signalKind===kind).length;
  if(Number(signalAudit.sourceLocatedSignalCount)!==globalSignals.length||Number(signalAudit.explicitPositiveDeclarationCandidateCount)!==signalCount('explicit_positive_repeatability_declaration_candidate')||Number(signalAudit.explicitNegativeDeclarationCandidateCount)!==signalCount('explicit_negative_repeatability_declaration_candidate')||Number(signalAudit.recurrenceStructureCandidateCount)!==signalCount('recurrence_structure_candidate')||Number(signalAudit.sessionBoundaryCandidateCount)!==signalCount('session_boundary_candidate')||Number(signalAudit.repeatabilityVerdictCount)!==0) add('audit_signal_counts_do_not_reconcile');
  const expectedSourcePageKeys=new Set(fetched.map(source=>`${Number(source.pageId)}|${String(source.revision)}`));
  if(expectedSourcePageKeys.size!==sourceMap.size||[...pageMap.keys()].some(key=>!expectedSourcePageKeys.has(key))||[...expectedSourcePageKeys].some(key=>!pageMap.has(key))) add('manifest_source_identity_set_mismatch');
  if(errors.length) throw new Error(`Activity reference-member repeatability-gap materialization input rejected: ${unique(errors).join(', ')}`);

  const sources=[...sourceMap.values()].sort((a,b)=>sourceIdentity(a).localeCompare(sourceIdentity(b))),statements=records.map(compactStatement);
  const gates={repeatabilityGapEvidencePacketCoverageComplete:true,candidatePages:globalPages.length,candidateRequests:globalAssessments.length,discoveryContexts:globalContexts.length,sourceLocatedSignals:globalSignals.length,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true};
  const model={contract:ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_MATERIALIZATION_CONTRACT,domain:ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_INPUT_DOMAIN,snapshotDirectory:manifest.snapshotDirectory||audit.outputSnapshot.directory,snapshotCreatedAt:manifest.createdAt,snapshotContentHash:manifest.contentHash,auditContentHash:audit.contentHash,sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),sources,records,statements,skillKeys:[],counts:{sources:sources.length,records:records.length,statements:statements.length,candidatePages:globalPages.length,candidateRequests:globalAssessments.length,discoveryContexts:globalContexts.length,sourceLocatedSignals:globalSignals.length},gates};
  model.recordHashAggregate=hash(records.map(row=>row.contentHash).sort());model.sourceHashAggregate=hash(sources.map(row=>row.sourceContentHash).sort());model.statementHashAggregate=hash(statements.map(row=>row.contentHash).sort());model.materializationHash=hash(model);model.runId=deterministicUuid('sensum-ingestion-run',`${model.domain}:${model.snapshotContentHash}`);model.snapshotId=deterministicUuid('sensum-data-snapshot',model.snapshotContentHash);
  return model;
}

export function buildActivityReferenceMemberRepeatabilityGapMaterializationSql(model) {
  return buildCandidateEvidenceMaterializationSql(model,{contract:ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_MATERIALIZATION_CONTRACT,factKind:ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_FACT_KIND,label:'Accepted repeatability-gap evidence'});
}
export function buildActivityReferenceMemberRepeatabilityGapExistingSourceCountQuery(model) {return buildCandidateEvidenceExistingSourceCountQuery(model);}
export function buildActivityReferenceMemberRepeatabilityGapReconciliationQuery(model) {return buildCandidateEvidenceReconciliationQuery(model,ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_FACT_KIND);}
export function verifyActivityReferenceMemberRepeatabilityGapReconciliation(model,actual) {
  return verifyCandidateEvidenceReconciliation(model,actual,{gateVerifier:metrics=>metrics?.repeatabilityGapEvidencePacketCoverageComplete===true&&Number(metrics?.candidatePages)===model.counts.candidatePages&&Number(metrics?.candidateRequests)===model.counts.candidateRequests&&Number(metrics?.discoveryContexts)===model.counts.discoveryContexts&&Number(metrics?.sourceLocatedSignals)===model.counts.sourceLocatedSignals&&metrics?.repeatabilityReviewComplete===false&&metrics?.memberExpansionReviewComplete===false&&metrics?.mechanicsReviewComplete===false&&metrics?.completeActivityUniverse===false&&Number(metrics?.optimizerEligibleRecords)===0&&metrics?.automaticVerification===false&&metrics?.semanticReviewRequired===true});
}
