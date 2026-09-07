import fs from 'node:fs';
import {hash,json} from '../ingestion/lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {
  buildCandidateEvidenceExistingSourceCountQuery,
  buildCandidateEvidenceMaterializationSql,
  buildCandidateEvidenceReconciliationQuery,
  verifyCandidateEvidenceReconciliation
} from './candidate-evidence-materialization-lib.mjs';

export const ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_MATERIALIZATION_CONTRACT='sensum.activity-reference-collection-member-independent-repeatability-source-evidence-postgresql-materialization.v1';
export const ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_INPUT_DOMAIN='activity-reference-collection-member-independent-repeatability-source-evidence';
export const ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_FACT_KIND='raw_activity_reference_member_independent_repeatability_source_evidence';

const POLICY_ID='sensum.activity-reference-collection-member-independent-repeatability-source-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-independent-repeatability-source-evidence-v1.json';
const SIGNAL_POLICY_ID='sensum.activity-reference-collection-member-repeatability-evidence-policy.v1';
const SIGNAL_POLICY_FILE='platform/policies/activity-reference-collection-member-repeatability-evidence-v1.json';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-reference-collection-member-independent-repeatability-source-evidence-v1.json',import.meta.url),'utf8'));
const SIGNAL_POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-reference-collection-member-repeatability-evidence-v1.json',import.meta.url),'utf8'));
const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const sourceIdentity=source=>`${source.sourceUrl}|${source.sourceRevision}`;
const pageRevisionKey=source=>`${Number(source.sourcePageId)}|${String(source.sourceRevision)}`;
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
  const evidence=record.independentRepeatabilitySourceEvidence,observations=record.independentRepeatabilityCandidateObservations;
  const payload={
    blockers:record.blockers,
    candidatePageCount:observations.candidatePageCount,
    candidateRequestCount:observations.candidateRequestCount,
    candidateSourceBytesScanned:observations.candidateSourceBytesScanned,
    canonicalActivityIdentity:record.canonicalActivityIdentity,
    canonicalActivityScopeVerdict:null,
    completeRevisionContentScannedCount:evidence.candidatePages.length,
    optimizerEligible:false,
    repeatabilityClassification:null,
    repeatabilityState:record.repeatabilityReview.state,
    repeatabilityVerdict:null,
    sourceAuthoredLinkOccurrenceCount:evidence.candidatePages.reduce((sum,page)=>sum+page.sourceAuthoredLinks.length,0),
    sourceLocatedSignalCount:observations.sourceLocatedSignalCount,
    state:record.state
  };
  const envelope={recordKey:record.memberCandidateKey,sourceRevision:String(record.sourceRevision),sourceLocator:{memberCandidateKey:record.memberCandidateKey,canonicalActivityKey:record.canonicalActivityIdentity.canonicalActivityKey,sourcePageId:Number(record.sourcePageId)},payload};
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityReferenceMemberIndependentSourceMaterializationInput({raw,manifest,audit}) {
  const errors=[],add=message=>errors.push(message),records=parseRecords(raw,errors);
  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_independent_exact_source_search_and_backlink_repeatability_candidates_without_scope_or_verdict_promotion') add('manifest_source_channel_mismatch');
  if(manifest?.source?.api!=='https://oldschool.runescape.wiki/api.php') add('manifest_source_api_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(Number(manifest?.records)!==records.length||records.length===0) add('manifest_record_count_mismatch');

  if(POLICY?.policy!==POLICY_ID||POLICY?.recordContract!=='sensum.activity-reference-collection-member-independent-repeatability-source-evidence.v1'||POLICY?.auditContract!=='sensum.activity-reference-collection-member-independent-repeatability-source-evidence-audit.v1'||!Object.values(POLICY?.rules||{}).every(value=>value===true)) add('policy_contract_or_rules_invalid');
  if(POLICY?.discovery?.namespace!==0||POLICY.discovery.requireSearchContinuationExhausted!==true||POLICY.discovery.requireBacklinkContinuationExhausted!==true||POLICY.discovery.excludeAllPreviouslyScannedPages!==true||POLICY.discovery.deduplicateByResolvedMediaWikiPageId!==true||POLICY.discovery.scanCompleteCurrentCandidateRevision!==true) add('policy_discovery_boundary_invalid');
  const definitions=SIGNAL_POLICY?.sourceScan?.signalDefinitions||[],definitionMap=new Map(definitions.map(item=>[item.definitionKey,item]));
  if(SIGNAL_POLICY?.policy!==SIGNAL_POLICY_ID||definitionMap.size!==definitions.length||definitions.length===0||Object.entries(SIGNAL_POLICY?.rules||{}).some(([key,value])=>key==='automaticVerificationAllowed'?value!==false:value!==true)) add('repeatability_signal_policy_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest.source.policy.file!==POLICY_FILE||manifest.source.policy.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  if(manifest?.source?.repeatabilitySignalPolicy?.id!==SIGNAL_POLICY_ID||manifest.source.repeatabilitySignalPolicy.file!==SIGNAL_POLICY_FILE||manifest.source.repeatabilitySignalPolicy.contentHash!==hash(SIGNAL_POLICY)) add('manifest_signal_policy_binding_mismatch');
  if((manifest?.source?.inputSnapshot?.rejections||[]).length||!isSha256(manifest?.source?.inputSnapshot?.contentHash)||!manifest?.source?.inputSnapshot?.directory) add('manifest_input_snapshot_invalid');

  if(audit?.contract!=='sensum.activity-reference-collection-member-independent-repeatability-source-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(audit?.policy?.id!==POLICY_ID||audit.policy.file!==POLICY_FILE||audit.policy.contentHash!==hash(POLICY)) add('audit_policy_binding_mismatch');
  if(audit?.repeatabilitySignalPolicy?.id!==SIGNAL_POLICY_ID||audit.repeatabilitySignalPolicy.file!==SIGNAL_POLICY_FILE||audit.repeatabilitySignalPolicy.contentHash!==hash(SIGNAL_POLICY)) add('audit_signal_policy_binding_mismatch');
  if(json(audit?.inputSnapshot)!==json(manifest?.source?.inputSnapshot)) add('audit_input_snapshot_mismatch');
  if(!audit?.outputSnapshot?.directory||audit.outputSnapshot.contentHash!==manifest?.contentHash||(manifest?.snapshotDirectory&&audit.outputSnapshot.directory!==manifest.snapshotDirectory)) add('audit_output_snapshot_mismatch');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','repeatabilitySignalPolicy','inputSnapshot','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{},discovery=audit?.discoveryCoverage||{},alignment=audit?.sourceAlignmentCoverage||{},signalAudit=audit?.repeatabilitySignalCoverage||{},promotion=audit?.semanticPromotionCoverage||{};
  if(Number(input.expectedRouteCount)!==records.length||Number(input.evidencePacketCount)!==records.length||input.exactInputOutputSetAndContextMatch!==true) add('audit_record_coverage_mismatch');
  for(const key of ['duplicateInputMemberCandidateKeys','duplicateOutputMemberCandidateKeys','missingMemberCandidateKeys','unexpectedMemberCandidateKeys','contextMismatchMemberCandidateKeys','structurallyInvalidInputMemberCandidateKeys']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  if((audit?.policyCoverage?.invalidRules||[]).length||(audit?.policyCoverage?.forbiddenPolicyPaths||[]).length||(audit?.policyCoverage?.invalidDiscoveryChannels||[]).length||(audit?.policyCoverage?.missingDiscoveryChannels||[]).length||(audit?.policyCoverage?.repeatabilitySignalPolicyInvalidRules||[]).length||(audit?.policyCoverage?.repeatabilitySignalPolicyForbiddenPaths||[]).length||(audit?.policyCoverage?.repeatabilitySignalPolicyDuplicateDefinitionKeys||[]).length||(audit?.policyCoverage?.repeatabilitySignalPolicyInvalidDefinitionKeys||[]).length||(audit?.policyCoverage?.repeatabilitySignalPolicyRequiredDefinitionKindsMissing||[]).length) add('audit_policy_gate_invalid');
  if((discovery.evidenceMismatchMemberCandidateKeys||[]).length||(alignment.incompletePacketMemberCandidateKeys||[]).length||Number(alignment.unbalancedSourceLinkPageCount)!==0) add('audit_source_or_evidence_mismatch');
  if((promotion.upstreamMutationMemberCandidateKeys||[]).length||(promotion.unsupportedPromotionMemberCandidateKeys||[]).length||Number(promotion.memberExpansionReviewedCount)!==0||Number(promotion.mechanicsReviewedCount)!==0||Number(promotion.optimizerEligibleCount)!==0) add('audit_semantic_gate_weakened');
  if((audit?.accountStateFindings||[]).length||audit?.evidencePacketAttemptCoverageComplete!==true||audit?.independentSourceEvidenceCoverageComplete!==true||audit?.repeatabilityReviewComplete!==false||audit?.memberExpansionReviewComplete!==false||audit?.mechanicsReviewComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  for(const blocker of ['independent_repeatability_source_evidence_requires_semantic_disposition','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const requestedTitles=manifest?.source?.requestedTitles||[],fetchedRevisions=manifest?.source?.fetchedRevisions||[],fetchedByRequest=new Map();
  if(requestedTitles.length===0||unique(requestedTitles).length!==requestedTitles.length||requestedTitles.some(title=>typeof title!=='string'||!title)) add('manifest_requested_title_set_invalid');
  for(const fetched of fetchedRevisions) {
    if(fetchedByRequest.has(fetched?.requestedTitle)||!requestedTitles.includes(fetched?.requestedTitle)||!Number.isInteger(Number(fetched?.pageId))||Number(fetched.pageId)<=0||typeof fetched?.resolvedTitle!=='string'||!fetched.resolvedTitle||String(fetched?.revision||'').length===0||!Number.isFinite(Date.parse(fetched?.timestamp))||!isSha256(fetched?.contentHash)||Number(fetched?.namespace)!==0) add(`manifest_fetched_revision_invalid:${fetched?.requestedTitle||'unknown'}`);
    fetchedByRequest.set(fetched?.requestedTitle,fetched);
  }
  if(fetchedByRequest.size!==requestedTitles.length||fetchedRevisions.length!==requestedTitles.length) add('manifest_fetched_revision_set_mismatch');
  const responseMap=new Map((manifest?.source?.discoveryResponses||[]).map(response=>[response.memberCandidateKey,response]));
  if(responseMap.size!==records.length) add('manifest_discovery_response_set_mismatch');

  const sourceMap=new Map(),pageMap=new Map(),recordKeys=new Set(),globalPageOccurrences=[],globalSignals=[],globalLinks=[],globalAssessments=[],globalContexts=[];
  const requiredRecordBlockers=['independent_repeatability_source_evidence_requires_semantic_disposition','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';
    if(recordKeys.has(key)) add(`duplicate_record_key:${key}`);else recordKeys.add(key);
    if(record?.contract!=='sensum.activity-reference-collection-member-independent-repeatability-source-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(record?.canonicalGameEntityIdentity!==null||!record?.canonicalActivityIdentity?.canonicalActivityKey||record?.optimizerEligible!==false) add(`record_semantic_gate_weakened:${key}`);
    if(record?.state!=='independent_repeatability_source_evidence_ready_for_semantic_disposition') add(`record_state_invalid:${key}`);
    if(!isSha256(record?.sourceRepeatabilityGapDispositionContentHash)||!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    if(record?.repeatabilityReview?.state!=='reviewed_blocked'||record.repeatabilityReview.classification!==null) add(`record_repeatability_review_not_preserved:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record.memberExpansionReview.atomicSubject!==null||(record.memberExpansionReview.memberKeys||[]).length||(record.memberExpansionReview.evidenceKeys||[]).length) add(`record_member_expansion_gate_weakened:${key}`);
    if(record?.mechanicsReview?.state!=='unreviewed'||(record.mechanicsReview.evidenceKeys||[]).length) add(`record_mechanics_gate_weakened:${key}`);
    for(const blocker of requiredRecordBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    addSource(sourceMap,pageMap,record,errors,`primary:${key}`);
    const evidence=record?.independentRepeatabilitySourceEvidence||{},boundary=evidence.discoveryBoundary||{},pages=evidence.candidatePages||[],observations=record?.independentRepeatabilityCandidateObservations||{};
    if(evidence.evidenceState!=='complete_revision_pinned_independent_repeatability_source_evidence_packet') add(`record_evidence_state_invalid:${key}`);
    const response=responseMap.get(key);
    if(!response||json(response.exactSourceSearch)!==json(boundary.exactSourceSearch)||json(response.backlinks)!==json(boundary.backlinks)) add(`record_discovery_response_mismatch:${key}`);
    for(const [name,value] of [['exact_search',boundary.exactSourceSearch],['backlinks',boundary.backlinks]]) if(value?.namespace!==0||value?.continuationExhausted!==true||value?.truncated!==false||Number(value?.returnedCount)!==(value?.results||[]).length) add(`record_${name}_boundary_incomplete:${key}`);
    const requests=boundary.candidateRequests||[],assessments=boundary.candidateRequestAssessments||[],assessmentByTitle=new Map(assessments.map(item=>[item.requestedTitle,item]));
    if(requests.length!==assessments.length||assessmentByTitle.size!==assessments.length) add(`record_candidate_request_set_invalid:${key}`);
    for(const request of requests) {
      const assessment=assessmentByTitle.get(request.requestedTitle);
      if(!assessment||json(request.discoveryContexts)!==json(assessment.discoveryContexts)||json(request.observedPageIds)!==json(assessment.observedPageIds)) add(`record_candidate_request_assessment_mismatch:${key}:${request.requestedTitle}`);
    }
    const eligible=assessments.filter(item=>item.state==='eligible_revision_pinned_candidate'),excluded=assessments.filter(item=>item.state==='excluded_previously_scanned_source');
    const excludedIds=new Set((boundary.previouslyScannedPageIdsExcluded||[]).map(Number));
    if(eligible.length!==pages.length||excludedIds.size!==(boundary.previouslyScannedPageIdsExcluded||[]).length||excluded.some(item=>!excludedIds.has(Number(item.resolvedPageId)))||assessments.some(item=>!['eligible_revision_pinned_candidate','excluded_previously_scanned_source'].includes(item.state))) add(`record_candidate_assessment_state_invalid:${key}`);
    const pageIds=new Set();
    for(const page of pages) {
      const pageKey=pageRevisionKey(page);
      if(pageIds.has(Number(page.sourcePageId))) add(`record_duplicate_resolved_candidate_page:${key}:${page.sourcePageId}`);else pageIds.add(Number(page.sourcePageId));
      addSource(sourceMap,pageMap,page,errors,`candidate:${key}:${pageKey}`);
      if(page.completeRevisionContentScanned!==true||page.reviewState!=='independent_source_candidate_only_not_activity_scope_or_repeatability_verdict'||page.canonicalActivityScopeVerdict!==null||page.repeatabilityVerdict!==null||!Number.isInteger(Number(page.sourceContentBytes))||Number(page.sourceContentBytes)<=0) add(`candidate_page_gate_invalid:${key}:${pageKey}`);
      if(page.sourceLinkDelimiterAudit?.balancedSourceLinkDelimiters!==true||Number(page.sourceLinkDelimiterAudit?.guidePageId)!==Number(page.sourcePageId)||String(page.sourceLinkDelimiterAudit?.guideRevision)!==String(page.sourceRevision)||Number(page.sourceLinkDelimiterAudit?.sourceOpenCount)!==Number(page.sourceLinkDelimiterAudit?.sourceCloseCount)||Number(page.sourceLinkDelimiterAudit?.parsedOccurrenceCount)!==(page.sourceAuthoredLinks||[]).length) add(`candidate_page_link_delimiter_invalid:${key}:${pageKey}`);
      for(const title of page.requestedTitles||[]) {
        const fetched=fetchedByRequest.get(title),assessment=assessmentByTitle.get(title);
        if(!fetched||!assessment||assessment.state!=='eligible_revision_pinned_candidate'||Number(fetched.pageId)!==Number(page.sourcePageId)||fetched.resolvedTitle!==page.resolvedTitle||String(fetched.revision)!==String(page.sourceRevision)||fetched.timestamp!==page.sourceTimestamp||fetched.contentHash!==page.sourceContentHash) add(`candidate_page_manifest_revision_mismatch:${key}:${title}`);
      }
      const signalKeys=new Set(),linkKeys=new Set();
      for(const signal of page.sourceLocatedSignals||[]) {
        const definition=definitionMap.get(signal.definitionKey);
        if(!signal.evidenceKey||signalKeys.has(signal.evidenceKey)) add(`candidate_signal_identity_invalid:${key}:${pageKey}`);else signalKeys.add(signal.evidenceKey);
        if(!definition||definition.signalKind!==signal.signalKind||signal.reviewState!=='candidate_only_not_a_repeatability_verdict'||signal.scannedTextHash!==page.sourceContentHash||signal.sourceContentHash!==page.sourceContentHash||Number(signal.sourcePageId)!==Number(page.sourcePageId)||String(signal.sourceRevision)!==String(page.sourceRevision)||!signal.contextText||!signal.matchedText||!Number.isInteger(Number(signal.sourceLocator?.lineStart))||!Number.isInteger(Number(signal.sourceLocator?.lineEnd))) add(`candidate_signal_source_or_policy_mismatch:${key}:${signal.evidenceKey}`);
      }
      for(const link of page.sourceAuthoredLinks||[]) {
        if(!link.occurrenceKey||linkKeys.has(link.occurrenceKey)) add(`candidate_link_identity_invalid:${key}:${pageKey}`);else linkKeys.add(link.occurrenceKey);
        if(Number(link.guidePageId)!==Number(page.sourcePageId)||String(link.guideRevision)!==String(page.sourceRevision)||link.guideTitle!==page.resolvedTitle||link.guideUrl!==page.sourceUrl||link.guideTimestamp!==page.sourceTimestamp||link.guideContentHash!==page.sourceContentHash||!Array.isArray(link.channels)||!link.channels.includes('independent_repeatability_source_discovery')||!Number.isInteger(Number(link.sourceLocator?.line))) add(`candidate_link_source_mismatch:${key}:${link.occurrenceKey}`);
      }
      globalPageOccurrences.push(page);globalSignals.push(...(page.sourceLocatedSignals||[]));globalLinks.push(...(page.sourceAuthoredLinks||[]));
    }
    globalAssessments.push(...assessments);globalContexts.push(...requests.flatMap(request=>request.discoveryContexts||[]));
    const count=kind=>pages.flatMap(page=>page.sourceLocatedSignals||[]).filter(signal=>signal.signalKind===kind).length;
    const derived={searchResultCount:boundary.exactSourceSearch.results.length,backlinkResultCount:boundary.backlinks.results.length,candidateRequestCount:requests.length,discoveryContextCount:requests.reduce((sum,item)=>sum+(item.discoveryContexts||[]).length,0),candidatePageCount:pages.length,candidateSourceBytesScanned:pages.reduce((sum,page)=>sum+Number(page.sourceContentBytes),0),sourceLocatedSignalCount:pages.reduce((sum,page)=>sum+(page.sourceLocatedSignals||[]).length,0),explicitPositiveDeclarationCandidateCount:count('explicit_positive_repeatability_declaration_candidate'),explicitNegativeDeclarationCandidateCount:count('explicit_negative_repeatability_declaration_candidate'),recurrenceStructureCandidateCount:count('recurrence_structure_candidate'),sessionBoundaryCandidateCount:count('session_boundary_candidate'),canonicalActivityScopeVerdict:null,repeatabilityVerdict:null,deficiencies:[]};
    if(json(derived)!==json(observations)) add(`record_observation_reconciliation_failed:${key}`);
  }
  const kindCount=kind=>globalSignals.filter(signal=>signal.signalKind===kind).length;
  const globalDerived={
    exactSourceSearchBoundaryCount:records.length,fullyEnumeratedExactSourceSearchCount:records.length,backlinkBoundaryCount:records.length,fullyEnumeratedBacklinkCount:records.length,
    searchResultCount:records.reduce((sum,r)=>sum+r.independentRepeatabilityCandidateObservations.searchResultCount,0),backlinkResultCount:records.reduce((sum,r)=>sum+r.independentRepeatabilityCandidateObservations.backlinkResultCount,0),candidateRequestCount:globalAssessments.length,discoveryContextCount:globalContexts.length,eligibleRequestCount:globalAssessments.filter(item=>item.state==='eligible_revision_pinned_candidate').length,excludedPreviouslyScannedRequestCount:globalAssessments.filter(item=>item.state==='excluded_previously_scanned_source').length,missingCandidateRequestCount:0,uniqueResolvedCandidatePageCount:globalPageOccurrences.length,duplicateResolvedPageContextsPreserved:globalContexts.length>globalPageOccurrences.length
  };
  for(const [key,value] of Object.entries(globalDerived)) if(discovery[key]!==value) add(`audit_discovery_count_mismatch:${key}`);
  if(Number(alignment.revisionPinnedCandidatePageCount)!==globalPageOccurrences.length||Number(alignment.candidateSourceBytesScanned)!==globalPageOccurrences.reduce((sum,page)=>sum+Number(page.sourceContentBytes),0)||Number(alignment.sourceAuthoredLinkOccurrenceCount)!==globalLinks.length) add('audit_source_alignment_count_mismatch');
  for(const [key,value] of Object.entries({sourceLocatedSignalCount:globalSignals.length,explicitPositiveDeclarationCandidateCount:kindCount('explicit_positive_repeatability_declaration_candidate'),explicitNegativeDeclarationCandidateCount:kindCount('explicit_negative_repeatability_declaration_candidate'),recurrenceStructureCandidateCount:kindCount('recurrence_structure_candidate'),sessionBoundaryCandidateCount:kindCount('session_boundary_candidate'),canonicalActivityScopeVerdictCount:0,repeatabilityVerdictCount:0})) if(Number(signalAudit[key])!==value) add(`audit_signal_count_mismatch:${key}`);
  if(errors.length) throw new Error(`Activity reference-member independent source materialization input rejected: ${unique(errors).join(', ')}`);

  const sources=[...sourceMap.values()].sort((a,b)=>sourceIdentity(a).localeCompare(sourceIdentity(b))),statements=records.map(compactStatement);
  const gates={independentSourceEvidenceCoverageComplete:true,candidatePageOccurrences:globalPageOccurrences.length,sourceLocatedSignals:globalSignals.length,sourceAuthoredLinkOccurrences:globalLinks.length,canonicalActivityScopeReviewComplete:false,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true};
  const model={contract:ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_MATERIALIZATION_CONTRACT,domain:ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_INPUT_DOMAIN,snapshotDirectory:manifest.snapshotDirectory||audit.outputSnapshot.directory,snapshotCreatedAt:manifest.createdAt,snapshotContentHash:manifest.contentHash,auditContentHash:audit.contentHash,sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),sources,records,statements,skillKeys:[],counts:{sources:sources.length,records:records.length,statements:statements.length,candidatePageOccurrences:globalPageOccurrences.length,candidateRequests:globalAssessments.length,discoveryContexts:globalContexts.length,sourceLocatedSignals:globalSignals.length,sourceAuthoredLinkOccurrences:globalLinks.length,requestedTitles:requestedTitles.length},gates};
  model.recordHashAggregate=hash(records.map(row=>row.contentHash).sort());model.sourceHashAggregate=hash(sources.map(row=>row.sourceContentHash).sort());model.statementHashAggregate=hash(statements.map(row=>row.contentHash).sort());model.materializationHash=hash(model);model.runId=deterministicUuid('sensum-ingestion-run',`${model.domain}:${model.snapshotContentHash}`);model.snapshotId=deterministicUuid('sensum-data-snapshot',model.snapshotContentHash);
  return model;
}

export function buildActivityReferenceMemberIndependentSourceMaterializationSql(model) {
  return buildCandidateEvidenceMaterializationSql(model,{contract:ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_MATERIALIZATION_CONTRACT,factKind:ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_FACT_KIND,label:'Accepted independent repeatability source evidence'});
}
export function buildActivityReferenceMemberIndependentSourceExistingSourceCountQuery(model) {return buildCandidateEvidenceExistingSourceCountQuery(model);}
export function buildActivityReferenceMemberIndependentSourceReconciliationQuery(model) {return buildCandidateEvidenceReconciliationQuery(model,ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_FACT_KIND);}
export function verifyActivityReferenceMemberIndependentSourceReconciliation(model,actual) {
  return verifyCandidateEvidenceReconciliation(model,actual,{gateVerifier:metrics=>metrics?.independentSourceEvidenceCoverageComplete===true&&Number(metrics?.candidatePageOccurrences)===model.counts.candidatePageOccurrences&&Number(metrics?.sourceLocatedSignals)===model.counts.sourceLocatedSignals&&Number(metrics?.sourceAuthoredLinkOccurrences)===model.counts.sourceAuthoredLinkOccurrences&&metrics?.canonicalActivityScopeReviewComplete===false&&metrics?.repeatabilityReviewComplete===false&&metrics?.memberExpansionReviewComplete===false&&metrics?.mechanicsReviewComplete===false&&metrics?.completeActivityUniverse===false&&Number(metrics?.optimizerEligibleRecords)===0&&metrics?.automaticVerification===false&&metrics?.semanticReviewRequired===true});
}
