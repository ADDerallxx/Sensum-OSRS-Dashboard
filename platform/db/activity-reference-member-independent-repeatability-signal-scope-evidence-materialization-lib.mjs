import fs from 'node:fs';
import {hash, json} from '../ingestion/lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {
  buildExistingExactWikiSourceCountQuery,
  exactWikiSourceReconciliationPredicate
} from './exact-wiki-source-identity-lib.mjs';

export const ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_MATERIALIZATION_CONTRACT = 'sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence-postgresql-materialization.v1';
export const ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_INPUT_DOMAIN = 'activity-reference-collection-member-independent-repeatability-signal-scope-evidence';
export const ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND = 'raw_activity_reference_member_independent_repeatability_signal_scope_evidence';

const POLICY_ID='sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-v1.json';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-v1.json',import.meta.url),'utf8'));
const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const sourceIdentity=source=>`${source.sourceUrl}|${source.sourceRevision}`;
const sourcePageRevisionKey=source=>`${Number(source.sourcePageId)}|${String(source.sourceRevision)}`;

function assert(condition,message) { if(!condition) throw new Error(message); }
function containsAccountState(value) {
  if(Array.isArray(value)) return value.some(containsAccountState);
  if(!value||typeof value!=='object') return false;
  return Object.entries(value).some(([key,child])=>accountKey(key)||containsAccountState(child));
}
function parseRecords(raw,errors) {
  try { return String(raw||'').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse); }
  catch { errors.push('snapshot_ndjson_invalid'); return []; }
}
function wikiSource(source) {
  return {
    providerKey:`wiki-pageid:${Number(source.sourcePageId)}`,
    sourceUrl:source.sourceUrl,
    title:source.resolvedTitle,
    sourceRevision:String(source.sourceRevision),
    sourceTimestamp:source.sourceTimestamp,
    sourceContentHash:source.sourceContentHash
  };
}
function validWikiSource(source) {
  return Number.isInteger(Number(source?.sourcePageId))
    && Number(source.sourcePageId)>0
    && typeof source?.resolvedTitle==='string' && source.resolvedTitle.length>0
    && typeof source?.sourceRevision==='string' && source.sourceRevision.length>0
    && Number.isFinite(Date.parse(source?.sourceTimestamp))
    && String(source?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')
    && isSha256(source?.sourceContentHash);
}
function addSource(sourceMap,pageRevisionMap,source,errors,context) {
  if(!validWikiSource(source)) { errors.push(`invalid_exact_wiki_source:${context}`); return; }
  const normalized=wikiSource(source),identity=sourceIdentity(normalized),pageRevision=sourcePageRevisionKey(source);
  const previous=sourceMap.get(identity);
  if(previous&&json(previous)!==json(normalized)) errors.push(`conflicting_exact_wiki_source_identity:${context}`);
  const priorPage=pageRevisionMap.get(pageRevision);
  if(priorPage&&sourceIdentity(priorPage)!==identity) errors.push(`conflicting_wiki_page_revision_identity:${context}`);
  sourceMap.set(identity,normalized);
  pageRevisionMap.set(pageRevision,normalized);
}
function validateSourceBoundHashes(value,errors,path='record') {
  if(Array.isArray(value)) return value.forEach((child,index)=>validateSourceBoundHashes(child,errors,`${path}[${index}]`));
  if(!value||typeof value!=='object') return;
  for(const [textKey,hashKey] of [['sourceContent','sourceContentHash'],['exactSource','exactSourceContentHash'],['exactSourceLines','exactSourceLinesContentHash']]) {
    if(Object.hasOwn(value,textKey)&&Object.hasOwn(value,hashKey)&&typeof value[textKey]==='string'&&value[hashKey]!==hash(value[textKey])) errors.push(`source_bound_hash_mismatch:${path}:${textKey}`);
  }
  for(const [key,child] of Object.entries(value)) validateSourceBoundHashes(child,errors,`${path}.${key}`);
}
function compactStatement(record) {
  const observations=record.independentRepeatabilitySignalScopeObservations;
  const payload={
    blockers:record.blockers,
    canonicalActivityIdentity:record.canonicalActivityIdentity,
    canonicalActivityScopeVerdict:null,
    repeatabilityVerdict:null,
    sourceLocatedSignalCount:observations.sourceLocatedSignalCount,
    signalScopeEvidencePacketCount:observations.signalScopeEvidencePacketCount,
    signalsWithExactLineMainNamespaceLinks:observations.signalsWithExactLineMainNamespaceLinks,
    signalsWithoutExactLineMainNamespaceLinks:observations.signalsWithoutExactLineMainNamespaceLinks,
    exactLineMainNamespaceLinkOccurrenceCount:observations.exactLineMainNamespaceLinkOccurrenceCount,
    distinctRequestedTitleCount:observations.distinctRequestedTitleCount,
    revisionPinnedResolutionAssessmentCount:observations.revisionPinnedResolutionAssessmentCount,
    uniqueResolvedTargetPageCount:observations.uniqueResolvedTargetPageCount,
    mechanicsState:record.mechanicsReview.state,
    memberExpansionState:record.memberExpansionReview.state,
    optimizerEligible:false,
    repeatabilityClassification:null,
    repeatabilityState:record.repeatabilityReview.state,
    state:record.state
  };
  const envelope={
    recordKey:record.memberCandidateKey,
    sourceRevision:String(record.sourceRevision),
    sourceLocator:{memberCandidateKey:record.memberCandidateKey,canonicalActivityKey:record.canonicalActivityIdentity.canonicalActivityKey,sourcePageId:Number(record.sourcePageId)},
    payload
  };
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}
function validateResolvedTargetGroups(groups,assessments,errors,context) {
  const assessmentMap=new Map(assessments.map(item=>[`${item.signalEvidenceKey}|${item.linkOccurrenceKey}`,item]));
  const groupedKeys=[];
  const pageIds=new Set();
  for(const group of groups||[]) {
    const identity=group?.targetPageIdentity||{};
    if(!validWikiSource(identity)||pageIds.has(Number(identity.sourcePageId))) errors.push(`resolved_target_group_identity_invalid:${context}:${identity.sourcePageId}`);
    pageIds.add(Number(identity.sourcePageId));
    const contexts=group?.linkOccurrenceContexts||[],titles=unique(contexts.map(item=>item.requestedTitle));
    if(!contexts.length||json(sorted(group?.requestedTitles||[]))!==json(sorted(titles))) errors.push(`resolved_target_group_title_set_mismatch:${context}:${identity.sourcePageId}`);
    for(const item of contexts) {
      const key=`${item.signalEvidenceKey}|${item.linkOccurrenceKey}`,assessment=assessmentMap.get(key);
      groupedKeys.push(key);
      if(!assessment||json(assessment.targetPageIdentity)!==json(identity)||assessment.requestedTitle!==item.requestedTitle||assessment.requestedFragment!==item.requestedFragment||assessment.displayText!==item.displayText||json(assessment.sourceLocator)!==json(item.sourceLocator)) errors.push(`resolved_target_group_context_mismatch:${context}:${key}`);
    }
  }
  const expected=assessments.map(item=>`${item.signalEvidenceKey}|${item.linkOccurrenceKey}`);
  if(new Set(groupedKeys).size!==groupedKeys.length||json(sorted(groupedKeys))!==json(sorted(expected))) errors.push(`resolved_target_grouping_mismatch:${context}`);
}

export function validateActivityReferenceMemberSignalScopeMaterializationInput({raw,manifest,audit}) {
  const errors=[],add=message=>errors.push(message),records=parseRecords(raw,errors);
  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_exact_signal_line_source_authored_main_namespace_link_scope_evidence_without_scope_or_repeatability_verdict') add('manifest_source_channel_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(Number(manifest?.records)!==records.length||records.length===0) add('manifest_record_count_mismatch');

  if(POLICY?.policy!==POLICY_ID||POLICY?.scopeEvidenceChannel!=='source_authored_main_namespace_links_on_exact_signal_lines'||POLICY?.recordContract!=='sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence.v1'||POLICY?.auditContract!=='sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence-audit.v1'||!Object.values(POLICY?.rules||{}).every(value=>value===true)) add('policy_contract_or_rules_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest?.source?.policy?.file!==POLICY_FILE||manifest?.source?.policy?.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  if((manifest?.source?.inputSnapshot?.rejections||[]).length||!isSha256(manifest?.source?.inputSnapshot?.contentHash)||!manifest?.source?.inputSnapshot?.directory) add('manifest_input_snapshot_invalid');

  if(audit?.contract!=='sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(audit?.policy?.id!==POLICY_ID||audit?.policy?.file!==POLICY_FILE||audit?.policy?.contentHash!==hash(POLICY)) add('audit_policy_binding_mismatch');
  if(json(audit?.inputSnapshot)!==json(manifest?.source?.inputSnapshot)) add('audit_input_snapshot_mismatch');
  if(!audit?.outputSnapshot?.directory||audit.outputSnapshot.contentHash!==manifest.contentHash||(manifest?.snapshotDirectory&&audit.outputSnapshot.directory!==manifest.snapshotDirectory)) add('audit_output_snapshot_mismatch');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','inputSnapshot','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{},signalAudit=audit?.signalCoverage||{},linkAudit=audit?.exactLineLinkCoverage||{},resolutionAudit=audit?.resolutionCoverage||{},comparisonAudit=audit?.stableIdentityComparisonCoverage||{},promotion=audit?.semanticPromotionCoverage||{};
  if(Number(input.expectedRecordCount)!==records.length||Number(input.outputRecordCount)!==records.length||input.exactInputOutputSetAndContextMatch!==true) add('audit_record_coverage_mismatch');
  for(const key of ['duplicateInputMemberCandidateKeys','duplicateOutputMemberCandidateKeys','missingMemberCandidateKeys','unexpectedMemberCandidateKeys','contextMismatchMemberCandidateKeys','structurallyInvalidInputMemberCandidateKeys']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  if(audit?.policyCoverage?.policy!==POLICY_ID||(audit?.policyCoverage?.invalidRules||[]).length||(audit?.policyCoverage?.forbiddenPolicyPaths||[]).length) add('audit_policy_gate_invalid');
  if(signalAudit.exactSignalSetMatch!==true||linkAudit.exactLinkOccurrenceSetMatch!==true||resolutionAudit.allRequestedTitlesAttemptedExactly!==true||comparisonAudit.comparisonsAreObservationsOnly!==true) add('audit_evidence_set_not_exact');
  for(const key of ['missingSignalEvidenceKeys','unexpectedSignalEvidenceKeys','duplicateSignalEvidenceKeys']) if((signalAudit[key]||[]).length) add(`audit_signal_set_invalid:${key}`);
  for(const key of ['missingLinkOccurrenceKeys','unexpectedLinkOccurrenceKeys','duplicateLinkOccurrenceKeys']) if((linkAudit[key]||[]).length) add(`audit_link_set_invalid:${key}`);
  if((resolutionAudit.unattemptedRequestedTitles||[]).length||(resolutionAudit.unexpectedAttemptedRequestedTitles||[]).length||Number(resolutionAudit.unresolvedResolutionAssessmentCount)!==0) add('audit_resolution_set_invalid');
  for(const key of ['signalSourcePageMatchesLinkedSubjectAnchorCount','signalSourcePageMatchesCollectionAnchorCount','targetOccurrenceMatchesLinkedSubjectAnchorCount','targetOccurrenceMatchesCollectionAnchorCount','targetOccurrenceMatchesSignalSourcePageCount','canonicalActivityScopeVerdictCount']) if(Number(comparisonAudit[key])!==0) add(`audit_identity_comparison_promoted:${key}`);
  if((promotion.upstreamMutationMemberCandidateKeys||[]).length||(promotion.unsupportedPromotionMemberCandidateKeys||[]).length) add('audit_upstream_or_semantic_promotion_present');
  for(const key of ['repeatabilityVerdictCount','memberExpansionReviewedCount','mechanicsReviewedCount','optimizerEligibleCount']) if(Number(promotion[key])!==0) add(`audit_semantic_gate_weakened:${key}`);
  if((audit?.evidenceMismatchMemberCandidateKeys||[]).length||(audit?.incompleteRecordMemberCandidateKeys||[]).length||(audit?.accountStateFindings||[]).length) add('audit_unsupported_or_incomplete_records_present');
  if(audit?.signalScopeEvidenceAttemptCoverageComplete!==true||audit?.independentSignalScopeEvidenceCoverageComplete!==true||audit?.canonicalActivityScopeReviewComplete!==false||audit?.repeatabilityReviewComplete!==false||audit?.memberExpansionReviewComplete!==false||audit?.mechanicsReviewComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  const requiredAuditBlockers=['independent_repeatability_signal_scope_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'];
  for(const blocker of requiredAuditBlockers) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const requestedTitles=manifest?.source?.requestedTitles||[],requestContexts=manifest?.source?.requestContexts||[],fetchedTargets=manifest?.source?.fetchedTargetRevisions||[];
  if(!requestedTitles.length||new Set(requestedTitles).size!==requestedTitles.length) add('manifest_requested_titles_invalid');
  const contextMap=new Map(),fetchedMap=new Map();
  for(const request of requestContexts) {
    if(!request?.requestedTitle||contextMap.has(request.requestedTitle)) add(`duplicate_or_invalid_request_context:${request?.requestedTitle}`);
    contextMap.set(request.requestedTitle,request);
    if(!(request.linkOccurrenceContexts||[]).length) add(`request_context_empty:${request.requestedTitle}`);
  }
  if(json(sorted(requestedTitles))!==json(sorted(contextMap.keys()))) add('manifest_request_context_title_set_mismatch');
  for(const fetched of fetchedTargets) {
    if(!fetched?.requestedTitle||fetchedMap.has(fetched.requestedTitle)) add(`duplicate_or_invalid_fetched_target:${fetched?.requestedTitle}`);
    fetchedMap.set(fetched.requestedTitle,fetched);
    if(fetched.namespace!==0||typeof fetched.redirected!=='boolean'||!Number.isInteger(Number(fetched.pageId))||!String(fetched.revision||'')||!Number.isFinite(Date.parse(fetched.timestamp))||!isSha256(fetched.contentHash)) add(`manifest_fetched_target_invalid:${fetched.requestedTitle}`);
  }
  if(json(sorted(requestedTitles))!==json(sorted(fetchedMap.keys()))||Number(resolutionAudit.distinctRequestedTitleCount)!==requestedTitles.length||Number(resolutionAudit.attemptedRequestedTitleCount)!==fetchedTargets.length) add('manifest_fetched_target_title_set_mismatch');

  const sourceMap=new Map(),pageRevisionMap=new Map(),recordKeys=new Set(),signalKeys=new Set(),linkKeys=new Set(),assessmentKeys=new Set(),assessmentContexts=[];
  let signalCount=0,withLinks=0,withoutLinks=0,linkCount=0,resolutionCount=0,redirectCount=0;
  const requiredRecordBlockers=['independent_repeatability_signal_scope_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';
    if(recordKeys.has(key)) add(`duplicate_record_key:${key}`); else recordKeys.add(key);
    if(record?.contract!=='sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(record?.canonicalGameEntityIdentity!==null||!record?.canonicalActivityIdentity?.canonicalActivityKey||record?.optimizerEligible!==false) add(`record_semantic_gate_weakened:${key}`);
    if(record?.state!=='independent_repeatability_signal_scope_evidence_ready_for_semantic_disposition') add(`record_state_invalid:${key}`);
    for(const blocker of requiredRecordBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    if(record?.repeatabilityReview?.state!=='reviewed_blocked'||record.repeatabilityReview.classification!==null||!(record.repeatabilityReview.evidenceKeys||[]).length) add(`record_repeatability_review_not_preserved:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record.memberExpansionReview.atomicSubject!==null||(record.memberExpansionReview.memberKeys||[]).length||(record.memberExpansionReview.evidenceKeys||[]).length) add(`record_member_expansion_gate_weakened:${key}`);
    if(record?.mechanicsReview?.state!=='unreviewed'||(record.mechanicsReview.evidenceKeys||[]).length) add(`record_mechanics_gate_weakened:${key}`);
    if(!isSha256(record?.sourceIndependentRepeatabilitySourceEvidenceContentHash)||!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    addSource(sourceMap,pageRevisionMap,{sourcePageId:record.sourcePageId,resolvedTitle:record.resolvedTitle,sourceRevision:String(record.sourceRevision),sourceTimestamp:record.sourceTimestamp,sourceUrl:record.sourceUrl,sourceContentHash:record.sourceContentHash},errors,`primary:${key}`);
    validateSourceBoundHashes(record,errors,`record:${key}`);
    const upstreamPages=new Map((record?.independentRepeatabilitySourceEvidence?.candidatePages||[]).map(page=>[sourcePageRevisionKey(page),page]));
    const evidence=record?.independentRepeatabilitySignalScopeEvidence||{},observations=record?.independentRepeatabilitySignalScopeObservations||{};
    if(evidence.evidenceState!=='complete_revision_pinned_independent_repeatability_signal_scope_evidence_packet'||evidence.scopeEvidenceChannel!==POLICY.scopeEvidenceChannel) add(`record_scope_evidence_state_invalid:${key}`);
    if(observations.canonicalActivityScopeVerdict!==null||observations.repeatabilityVerdict!==null||(observations.deficiencies||[]).length) add(`record_scope_observation_gate_invalid:${key}`);
    const packets=evidence.signalScopeEvidencePackets||[];
    for(const packet of packets) {
      const signalKey=packet?.signalEvidenceKey;
      if(!signalKey||signalKeys.has(`${key}|${signalKey}`)) add(`duplicate_or_invalid_signal_key:${key}:${signalKey}`); else signalKeys.add(`${key}|${signalKey}`);
      signalCount++;
      const source=packet.sourceCandidate||{},located=packet.sourceLocatedSignal||{},upstream=upstreamPages.get(sourcePageRevisionKey(source));
      addSource(sourceMap,pageRevisionMap,source,errors,`signal:${signalKey}`);
      if(!upstream||upstream.resolvedTitle!==source.resolvedTitle||upstream.sourceTimestamp!==source.sourceTimestamp||upstream.sourceUrl!==source.sourceUrl||upstream.sourceContentHash!==source.sourceContentHash) add(`signal_source_not_preserved_from_upstream:${signalKey}`);
      const upstreamSignal=(upstream?.sourceLocatedSignals||[]).find(item=>item.evidenceKey===signalKey);
      if(!upstreamSignal||json(upstreamSignal)!==json(located)||located.sourcePageId!==source.sourcePageId||String(located.sourceRevision)!==String(source.sourceRevision)||located.sourceContentHash!==source.sourceContentHash||located.scannedTextHash!==source.sourceContentHash||located.reviewState!=='candidate_only_not_a_repeatability_verdict') add(`signal_identity_or_locator_mismatch:${signalKey}`);
      if(packet.canonicalActivityScopeVerdict!==null||packet.repeatabilityVerdict!==null||(packet.deficiencies||[]).length) add(`signal_packet_semantic_gate_weakened:${signalKey}`);
      const links=packet.exactLineSourceAuthoredMainNamespaceLinks||[],assessments=packet.linkResolutionAssessments||[];
      if(links.length){withLinks++;if(packet.state!=='complete_revision_pinned_exact_line_link_scope_evidence'||(packet.limitations||[]).length) add(`linked_signal_packet_state_invalid:${signalKey}`);} else {withoutLinks++;if(packet.state!=='complete_no_source_authored_main_namespace_link_on_exact_signal_line'||json(packet.limitations)!==json(['no_source_authored_main_namespace_link_on_exact_signal_line'])||assessments.length||(packet.resolvedTargetPages||[]).length) add(`unlinked_signal_packet_state_invalid:${signalKey}`);}
      const linkMap=new Map();
      for(const link of links) {
        const composite=`${signalKey}|${link.occurrenceKey}`;
        if(linkKeys.has(composite)) add(`duplicate_link_occurrence:${composite}`); else linkKeys.add(composite);
        linkMap.set(link.occurrenceKey,link); linkCount++;
        if(link.namespaceClass!=='main'||link.guidePageId!==source.sourcePageId||String(link.guideRevision)!==String(source.sourceRevision)||link.guideTimestamp!==source.sourceTimestamp||link.guideTitle!==source.resolvedTitle||link.guideUrl!==source.sourceUrl||link.guideContentHash!==source.sourceContentHash||Number(link.sourceLocator?.line)<Number(located.sourceLocator?.lineStart)||Number(link.sourceLocator?.line)>Number(located.sourceLocator?.lineEnd)) add(`exact_line_link_source_mismatch:${composite}`);
      }
      for(const assessment of assessments) {
        const composite=`${signalKey}|${assessment.linkOccurrenceKey}`;
        if(assessmentKeys.has(composite)) add(`duplicate_resolution_assessment:${composite}`); else assessmentKeys.add(composite);
        resolutionCount++; assessmentContexts.push({memberCandidateKey:key,canonicalActivityKey:record.canonicalActivityIdentity.canonicalActivityKey,signalEvidenceKey:signalKey,assessment,source,located});
        const link=linkMap.get(assessment.linkOccurrenceKey),fetched=fetchedMap.get(assessment.requestedTitle),target=assessment.targetPageIdentity||{};
        if(!link||assessment.signalEvidenceKey!==signalKey||assessment.requestedTitle!==link.requestedTitle||assessment.requestedFragment!==link.requestedFragment||assessment.displayText!==link.displayText||json(assessment.sourceLocator)!==json(link.sourceLocator)||assessment.resolutionState!=='revision_pinned_official_wiki_main_namespace_page'||assessment.canonicalActivityScopeVerdict!==null||assessment.repeatabilityVerdict!==null) add(`resolution_assessment_link_mismatch:${composite}`);
        if(!fetched||fetched.normalizedTitle!==assessment.normalizedTitle||fetched.resolvedTitle!==assessment.resolvedTitle||fetched.redirected!==assessment.redirected||fetched.pageId!==target.sourcePageId||String(fetched.revision)!==String(target.sourceRevision)||fetched.timestamp!==target.sourceTimestamp||fetched.contentHash!==target.sourceContentHash||target.resolvedTitle!==assessment.resolvedTitle) add(`resolution_assessment_target_mismatch:${composite}`);
        if(Object.keys(assessment.stableIdentityComparisons||{}).length!==3||!Object.values(assessment.stableIdentityComparisons).every(value=>value===false)) add(`resolution_assessment_identity_comparison_promoted:${composite}`);
        if(assessment.redirected) redirectCount++;
        addSource(sourceMap,pageRevisionMap,target,errors,`target:${composite}`);
      }
      if(linkMap.size!==assessments.length||[...linkMap.keys()].some(linkKey=>!assessments.some(item=>item.linkOccurrenceKey===linkKey))) add(`signal_link_resolution_set_mismatch:${signalKey}`);
      validateResolvedTargetGroups(packet.resolvedTargetPages||[],assessments,errors,`packet:${signalKey}`);
      if(packet.stableIdentityComparisons?.signalSourcePageMatchesCollectionAnchor!==false||packet.stableIdentityComparisons?.signalSourcePageMatchesLinkedSubjectAnchor!==false||(packet.stableIdentityComparisons?.collectionAnchorTargetOccurrenceKeys||[]).length||(packet.stableIdentityComparisons?.linkedSubjectAnchorTargetOccurrenceKeys||[]).length||(packet.stableIdentityComparisons?.signalSourceTargetOccurrenceKeys||[]).length) add(`signal_stable_identity_gate_weakened:${signalKey}`);
    }
    const recordAssessments=packets.flatMap(packet=>packet.linkResolutionAssessments||[]);
    validateResolvedTargetGroups(evidence.resolvedTargetPages||[],recordAssessments,errors,`record:${key}`);
    const measured={sourceLocatedSignalCount:packets.length,signalScopeEvidencePacketCount:packets.length,signalsWithExactLineMainNamespaceLinks:packets.filter(packet=>(packet.exactLineSourceAuthoredMainNamespaceLinks||[]).length).length,signalsWithoutExactLineMainNamespaceLinks:packets.filter(packet=>!(packet.exactLineSourceAuthoredMainNamespaceLinks||[]).length).length,exactLineMainNamespaceLinkOccurrenceCount:recordAssessments.length,distinctRequestedTitleCount:new Set(recordAssessments.map(item=>item.requestedTitle)).size,revisionPinnedResolutionAssessmentCount:recordAssessments.filter(item=>item.resolutionState==='revision_pinned_official_wiki_main_namespace_page').length,uniqueResolvedTargetPageCount:new Set(recordAssessments.map(item=>item.targetPageIdentity.sourcePageId)).size,signalSourcePageMatchesLinkedSubjectAnchorCount:0,targetOccurrenceMatchesLinkedSubjectAnchorCount:0};
    for(const [name,value] of Object.entries(measured)) if(Number(observations[name])!==value) add(`record_observation_count_mismatch:${key}:${name}`);
  }

  const manifestContextKeys=[];
  for(const request of requestContexts) for(const context of request.linkOccurrenceContexts||[]) {
    const key=`${context.memberCandidateKey}|${context.signalEvidenceKey}|${context.linkOccurrenceKey}`;
    if(manifestContextKeys.includes(key)) add(`duplicate_manifest_link_context:${key}`); else manifestContextKeys.push(key);
    const actual=assessmentContexts.find(item=>item.memberCandidateKey===context.memberCandidateKey&&item.assessment.signalEvidenceKey===context.signalEvidenceKey&&item.assessment.linkOccurrenceKey===context.linkOccurrenceKey);
    if(!actual||actual.canonicalActivityKey!==context.canonicalActivityKey||actual.assessment.requestedTitle!==request.requestedTitle||actual.assessment.requestedFragment!==context.requestedFragment||actual.assessment.displayText!==context.displayText||json(actual.assessment.sourceLocator)!==json(context.linkSourceLocator)||context.signalKind!==actual.located.signalKind||context.definitionKey!==actual.located.definitionKey||context.signalSourcePageId!==actual.source.sourcePageId||String(context.signalSourceRevision)!==String(actual.source.sourceRevision)||context.signalSourceContentHash!==actual.source.sourceContentHash||json(context.signalSourceLocator)!==json(actual.located.sourceLocator)||context.semanticUse!=='stable_page_identity_evidence_only_not_canonical_activity_scope_or_repeatability_verdict') add(`manifest_link_context_mismatch:${key}`);
  }
  const actualContextKeys=assessmentContexts.map(item=>`${item.memberCandidateKey}|${item.assessment.signalEvidenceKey}|${item.assessment.linkOccurrenceKey}`);
  if(json(sorted(manifestContextKeys))!==json(sorted(actualContextKeys))) add('manifest_and_record_link_context_sets_differ');

  const sources=sorted(sourceMap.keys()).map(key=>sourceMap.get(key));
  if(signalCount!==Number(signalAudit.sourceLocatedSignalCount)||signalCount!==Number(signalAudit.signalScopeEvidencePacketCount)||withLinks!==Number(signalAudit.signalsWithExactLineMainNamespaceLinks)||withoutLinks!==Number(signalAudit.signalsWithoutExactLineMainNamespaceLinks)||linkCount!==Number(linkAudit.expectedLinkOccurrenceCount)||linkCount!==Number(linkAudit.preservedLinkOccurrenceCount)||resolutionCount!==Number(resolutionAudit.revisionPinnedResolutionAssessmentCount)||redirectCount!==Number(resolutionAudit.redirectedResolutionAssessmentCount)||new Set(assessmentContexts.map(item=>item.assessment.targetPageIdentity.sourcePageId)).size!==Number(resolutionAudit.uniqueResolvedTargetPageCount)) add('measured_audit_counts_mismatch');
  if(errors.length) throw new Error(`Activity reference-member signal-scope materialization input rejected: ${unique(errors).join(', ')}`);

  const statements=records.map(compactStatement),model={
    contract:ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_MATERIALIZATION_CONTRACT,
    domain:ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_INPUT_DOMAIN,
    snapshotDirectory:audit.outputSnapshot.directory,snapshotCreatedAt:manifest.createdAt,snapshotContentHash:manifest.contentHash,auditContentHash:audit.contentHash,
    sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),sources,records,statements,skillKeys:[],
    counts:{sources:sources.length,records:records.length,statements:statements.length,signals:signalCount,signalsWithLinks:withLinks,signalsWithoutLinks:withoutLinks,linkOccurrences:linkCount,resolutionAssessments:resolutionCount,requestedTitles:requestedTitles.length,resolvedTargetPages:new Set(assessmentContexts.map(item=>item.assessment.targetPageIdentity.sourcePageId)).size,redirectedResolutions:redirectCount},
    gates:{signalScopeEvidencePacketCoverageComplete:true,canonicalActivityScopeReviewComplete:false,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}
  };
  model.recordHashAggregate=hash(records.map(row=>row.contentHash).sort());
  model.sourceHashAggregate=hash(sources.map(row=>row.sourceContentHash).sort());
  model.statementHashAggregate=hash(statements.map(row=>row.contentHash).sort());
  model.materializationHash=hash(model);
  model.runId=deterministicUuid('sensum-ingestion-run',`${model.domain}:${model.snapshotContentHash}`);
  model.snapshotId=deterministicUuid('sensum-data-snapshot',model.snapshotContentHash);
  return model;
}

const hex=value=>Buffer.from(String(value),'utf8').toString('hex');
const sqlText=value=>`convert_from(decode('${hex(value)}','hex'),'UTF8')`;
const sqlJson=value=>`${sqlText(json(value))}::jsonb`;
const sqlTimestamp=value=>`${sqlText(value)}::timestamptz`;
function metrics(model) { return {contract:model.contract,...model.counts,skillCoverage:0,skillKeys:[],recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}; }

export function buildActivityReferenceMemberSignalScopeMaterializationSql(model) {
  assert(model?.contract===ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_MATERIALIZATION_CONTRACT,'materialization_contract_mismatch');
  const expectedSources=model.sources.map(source=>`(${sqlText(source.providerKey)},${sqlText(source.sourceUrl)},${sqlText(source.title)},${sqlText(source.sourceRevision)},${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(source.sourceTimestamp)},${sqlText(source.sourceContentHash)})`).join(',\n');
  const expectedRecords=model.records.map(record=>`(${sqlText(record.memberCandidateKey)},${sqlJson(record)},${sqlText(record.sourceUrl)},${sqlText(String(record.sourceRevision))},${sqlText(record.contentHash)},${sqlJson(record.blockers)})`).join(',\n');
  const expectedStatements=model.statements.map(statement=>`(${sqlText(statement.recordKey)},${sqlText(statement.sourceUrl)},${sqlText(statement.sourceRevision)},${sqlTimestamp(statement.sourceTimestamp)},${sqlText(statement.contentHash)},${sqlJson(statement.sourceLocator)},${sqlJson(statement.payload)})`).join(',\n');
  const validationSummary={contract:model.contract,auditContentHash:model.auditContentHash,...model.gates},materializationMetrics=metrics(model);
  return [
    '\\set ON_ERROR_STOP on','BEGIN;',
    `SELECT pg_advisory_xact_lock(hashtextextended(${sqlText(`${model.domain}:${model.snapshotContentHash}`)},0));`,
    'CREATE TEMP TABLE expected_sources(provider_key text,source_url text,title text,source_revision text,fetched_at timestamptz,published_at timestamptz,content_hash text) ON COMMIT DROP;',`INSERT INTO expected_sources VALUES ${expectedSources};`,
    'CREATE TEMP TABLE expected_records(record_key text,payload jsonb,source_url text,source_revision text,content_hash text,findings jsonb) ON COMMIT DROP;',`INSERT INTO expected_records VALUES ${expectedRecords};`,
    'CREATE TEMP TABLE expected_statements(record_key text,source_url text,source_revision text,source_timestamp timestamptz,content_hash text,raw_locator jsonb,parsed_value jsonb) ON COMMIT DROP;',`INSERT INTO expected_statements VALUES ${expectedStatements};`,
    `INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`Accepted independent repeatability signal-scope evidence ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson(validationSummary)}) ON CONFLICT (manifest_hash) DO NOTHING;`,
    `INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.sourceRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(materializationMetrics)}) ON CONFLICT (id) DO NOTHING;`,
    "INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,provider_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",
    `INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,
    `INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,
    `INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,
    buildLineageInsertAndReconciliationSql(model,ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND),
    `DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson(validationSummary)}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.sourceRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(materializationMetrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON ${exactWikiSourceReconciliationPredicate()}; IF actual<>${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual<>${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}')<>${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual<>${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}')<>${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual<>${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed'; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '"optimizerEligible"[[:space:]]*:[[:space:]]*true' OR r.payload::text ~* '"canonicalActivityScopeVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"repeatabilityVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"repeatabilityClassification"[[:space:]]*:[[:space:]]*"') THEN RAISE EXCEPTION 'ingestion signal-scope semantic gate weakened'; END IF; END $$;`,
    'COMMIT;'
  ].join('\n')+'\n';
}

export function buildActivityReferenceMemberSignalScopeExistingSourceCountQuery(model) { return buildExistingExactWikiSourceCountQuery(model.sources); }
export function buildActivityReferenceMemberSignalScopeReconciliationQuery(model) {
  return `SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM activity_evidence a JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}' WHERE a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND}'),'lineage',(SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE ingestion_run_id='${model.runId}'),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`;
}
export function verifyActivityReferenceMemberSignalScopeReconciliation(model,actual) {
  assert(actual?.runId===model.runId,'reconciliation_run_id_mismatch');
  assert(actual?.status==='published','reconciliation_run_not_published');
  for(const key of ['records','sources','statements']) assert(Number(actual?.[key])===model.counts[key],`reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage)===model.counts.statements,'reconciliation_lineage_count_mismatch');
  assert(actual?.snapshotComplete===false,'signal_scope_evidence_snapshot_must_not_claim_complete_world_knowledge');
  for(const [key,value] of [['recordHashAggregate',model.recordHashAggregate],['sourceHashAggregate',model.sourceHashAggregate],['statementHashAggregate',model.statementHashAggregate],['materializationHash',model.materializationHash]]) assert(actual?.metrics?.[key]===value,`reconciliation_${key}_mismatch`);
  assert(actual?.metrics?.signalScopeEvidencePacketCoverageComplete===true&&actual?.metrics?.canonicalActivityScopeReviewComplete===false&&actual?.metrics?.repeatabilityReviewComplete===false&&actual?.metrics?.memberExpansionReviewComplete===false&&actual?.metrics?.mechanicsReviewComplete===false&&actual?.metrics?.completeActivityUniverse===false&&Number(actual?.metrics?.optimizerEligibleRecords)===0&&actual?.metrics?.automaticVerification===false&&actual?.metrics?.semanticReviewRequired===true,'reconciliation_semantic_gate_weakened');
  return true;
}
