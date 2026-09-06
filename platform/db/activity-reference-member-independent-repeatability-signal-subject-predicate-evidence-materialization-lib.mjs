import fs from 'node:fs';
import {hash, json} from '../ingestion/lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {
  buildExistingExactWikiSourceCountQuery,
  exactWikiSourceReconciliationPredicate
} from './exact-wiki-source-identity-lib.mjs';

export const ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_MATERIALIZATION_CONTRACT = 'sensum.activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-postgresql-materialization.v1';
export const ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_INPUT_DOMAIN = 'activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence';
export const ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND = 'raw_activity_reference_member_independent_repeatability_signal_subject_predicate_evidence';

const POLICY_ID='sensum.activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-v1.json';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-v1.json',import.meta.url),'utf8'));
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
  return Number.isInteger(Number(source?.sourcePageId)) && Number(source.sourcePageId)>0
    && typeof source?.resolvedTitle==='string' && source.resolvedTitle.length>0
    && typeof source?.sourceRevision==='string' && source.sourceRevision.length>0
    && Number.isFinite(Date.parse(source?.sourceTimestamp))
    && String(source?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')
    && isSha256(source?.sourceContentHash);
}
function addSource(sourceMap,pageRevisionMap,source,errors,context) {
  if(!validWikiSource(source)) { errors.push(`invalid_exact_wiki_source:${context}`); return; }
  const normalized=wikiSource(source),identity=sourceIdentity(normalized),pageRevision=sourcePageRevisionKey(source);
  const previous=sourceMap.get(identity),priorPage=pageRevisionMap.get(pageRevision);
  if(previous&&json(previous)!==json(normalized)) errors.push(`conflicting_exact_wiki_source_identity:${context}`);
  if(priorPage&&sourceIdentity(priorPage)!==identity) errors.push(`conflicting_wiki_page_revision_identity:${context}`);
  sourceMap.set(identity,normalized); pageRevisionMap.set(pageRevision,normalized);
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
  const observations=record.independentRepeatabilitySignalSubjectPredicateObservations;
  const payload={
    blockers:record.blockers,
    canonicalActivityIdentity:record.canonicalActivityIdentity,
    canonicalActivityScopeVerdict:null,
    repeatabilityVerdict:null,
    evidencePacketCount:observations.evidencePacketCount,
    routedSignalCount:observations.routedSignalCount,
    exactRevisionAlignedPacketCount:observations.exactRevisionAlignedPacketCount,
    exactSourceLineRevalidatedCount:observations.exactSourceLineRevalidatedCount,
    exactPredicateSpanRevalidatedCount:observations.exactPredicateSpanRevalidatedCount,
    exactLineLinkSetRevalidatedCount:observations.exactLineLinkSetRevalidatedCount,
    stableActivityAnchorObservedPacketCount:observations.stableActivityAnchorObservedPacketCount,
    noStableActivityAnchorObservedPacketCount:observations.noStableActivityAnchorObservedPacketCount,
    semanticSubjectBindingCount:0,
    mechanicsState:record.mechanicsReview.state,
    memberExpansionState:record.memberExpansionReview.state,
    optimizerEligible:false,
    repeatabilityClassification:null,
    repeatabilityState:record.repeatabilityReview.state,
    state:record.state
  };
  const envelope={recordKey:record.memberCandidateKey,sourceRevision:String(record.sourceRevision),sourceLocator:{memberCandidateKey:record.memberCandidateKey,canonicalActivityKey:record.canonicalActivityIdentity.canonicalActivityKey,sourcePageId:Number(record.sourcePageId)},payload};
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput({raw,manifest,audit}) {
  const errors=[],add=message=>errors.push(message),records=parseRecords(raw,errors);
  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_exact_signal_source_line_predicate_span_and_stable_identity_anchor_observations_without_semantic_binding_or_repeatability_verdict') add('manifest_source_channel_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(Number(manifest?.records)!==records.length||records.length===0) add('manifest_record_count_mismatch');

  if(POLICY?.policy!==POLICY_ID||POLICY?.evidenceChannel!=='exact_revision_source_line_predicate_span_and_stable_identity_anchor_observations'||POLICY?.recordContract!=='sensum.activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence.v1'||POLICY?.auditContract!=='sensum.activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-audit.v1'||!Object.values(POLICY?.rules||{}).every(value=>value===true)) add('policy_contract_or_rules_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest?.source?.policy?.file!==POLICY_FILE||manifest?.source?.policy?.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  if((manifest?.source?.inputSnapshot?.rejections||[]).length||!isSha256(manifest?.source?.inputSnapshot?.contentHash)||!manifest?.source?.inputSnapshot?.directory) add('manifest_input_snapshot_invalid');

  if(audit?.contract!=='sensum.activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(audit?.policy?.id!==POLICY_ID||audit?.policy?.file!==POLICY_FILE||audit?.policy?.contentHash!==hash(POLICY)) add('audit_policy_binding_mismatch');
  if(json(audit?.inputSnapshot)!==json(manifest?.source?.inputSnapshot)) add('audit_input_snapshot_mismatch');
  if(!audit?.outputSnapshot?.directory||audit.outputSnapshot.contentHash!==manifest.contentHash) add('audit_output_snapshot_mismatch');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','inputSnapshot','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{},revisionAudit=audit?.revisionCoverage||{},signalAudit=audit?.signalCoverage||{},lineAudit=audit?.sourceLineCoverage||{},identityAudit=audit?.stableIdentityObservationCoverage||{},promotion=audit?.semanticPromotionCoverage||{};
  if(Number(input.expectedRecordCount)!==records.length||Number(input.outputRecordCount)!==records.length||input.exactInputOutputSetAndContextMatch!==true) add('audit_record_coverage_mismatch');
  for(const key of ['duplicateInputMemberCandidateKeys','duplicateOutputMemberCandidateKeys','missingMemberCandidateKeys','unexpectedMemberCandidateKeys','contextMismatchMemberCandidateKeys']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  if(audit?.policyCoverage?.policy!==POLICY_ID||(audit?.policyCoverage?.invalidRules||[]).length||(audit?.policyCoverage?.forbiddenPolicyPaths||[]).length) add('audit_policy_gate_invalid');
  if(revisionAudit.exactRevisionFetchSetMatch!==true||signalAudit.exactSignalSetMatch!==true||identityAudit.observationsAreNotSemanticVerdicts!==true) add('audit_evidence_set_not_exact');
  for(const key of ['missingRevisionIds','unexpectedRevisionIds','duplicateFetchedRevisionIds']) if((revisionAudit[key]||[]).length) add(`audit_revision_set_invalid:${key}`);
  for(const key of ['missingSignalPairs','unexpectedSignalPairs','duplicateSignalPairs']) if((signalAudit[key]||[]).length) add(`audit_signal_set_invalid:${key}`);
  for(const key of ['stableActivityAnchorObservedPacketCount','signalSourceMatchesLinkedSubjectAnchorCount','signalSourceMatchesCollectionAnchorCount','exactLineTargetAnchorOccurrenceCount','semanticSubjectBindingCount','canonicalActivityScopeVerdictCount']) if(Number(identityAudit[key])!==0) add(`audit_identity_or_semantic_observation_promoted:${key}`);
  if((promotion.upstreamMutationMemberCandidateKeys||[]).length||(promotion.unsupportedPromotionMemberCandidateKeys||[]).length) add('audit_upstream_or_semantic_promotion_present');
  for(const key of ['semanticSubjectBindingCount','repeatabilityVerdictCount','memberExpansionReviewedCount','mechanicsReviewedCount','optimizerEligibleCount']) if(Number(promotion[key])!==0) add(`audit_semantic_gate_weakened:${key}`);
  if((audit?.evidenceMismatchMemberCandidateKeys||[]).length||(audit?.incompleteRecordMemberCandidateKeys||[]).length||(audit?.accountStateFindings||[]).length) add('audit_unsupported_or_incomplete_records_present');
  if(audit?.subjectPredicateEvidenceAttemptCoverageComplete!==true||audit?.independentSignalSubjectPredicateEvidenceCoverageComplete!==true||audit?.canonicalActivityScopeReviewComplete!==false||audit?.repeatabilityReviewComplete!==false||audit?.memberExpansionReviewComplete!==false||audit?.mechanicsReviewComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  const requiredAuditBlockers=['independent_repeatability_signal_subject_predicate_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'];
  for(const blocker of requiredAuditBlockers) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const revisionRequests=manifest?.source?.revisionRequests||[],fetchedRevisions=manifest?.source?.fetchedRevisions||[],requestMap=new Map(),fetchedMap=new Map();
  for(const request of revisionRequests) {
    const key=sourcePageRevisionKey(request); if(requestMap.has(key)||!validWikiSource(request)||(request.signalContexts||[]).length===0) add(`manifest_revision_request_invalid:${key}`); requestMap.set(key,request);
  }
  for(const fetched of fetchedRevisions) {
    const normalized={sourcePageId:fetched.pageId,resolvedTitle:fetched.title,sourceRevision:String(fetched.revision),sourceTimestamp:fetched.timestamp,sourceUrl:requestMap.get(`${Number(fetched.pageId)}|${String(fetched.revision)}`)?.sourceUrl,sourceContentHash:fetched.contentHash};
    const key=sourcePageRevisionKey(normalized); if(fetchedMap.has(key)||!validWikiSource(normalized)) add(`manifest_fetched_revision_invalid:${key}`); fetchedMap.set(key,normalized);
    const request=requestMap.get(key); if(!request||request.resolvedTitle!==fetched.title||request.sourceTimestamp!==fetched.timestamp||request.sourceContentHash!==fetched.contentHash) add(`manifest_fetched_revision_mismatch:${key}`);
  }
  if(json(sorted(requestMap.keys()))!==json(sorted(fetchedMap.keys()))||Number(revisionAudit.requestedExactRevisionCount)!==requestMap.size||Number(revisionAudit.fetchedExactRevisionCount)!==fetchedMap.size) add('manifest_revision_set_mismatch');

  const sourceMap=new Map(),pageRevisionMap=new Map(),recordKeys=new Set(),signalPairs=new Set(),contextPairs=new Set();
  let packetCount=0,sourceLineCount=0,predicateCount=0,linkSetCount=0,linkOccurrenceCount=0,routeWithoutLink=0,routeWithLink=0,noAnchorCount=0;
  const requiredRecordBlockers=['independent_repeatability_signal_subject_predicate_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';
    if(recordKeys.has(key)) add(`duplicate_record_key:${key}`); else recordKeys.add(key);
    if(record?.contract!=='sensum.activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(record?.canonicalGameEntityIdentity!==null||!record?.canonicalActivityIdentity?.canonicalActivityKey||record?.optimizerEligible!==false) add(`record_semantic_gate_weakened:${key}`);
    if(record?.state!=='independent_repeatability_signal_subject_predicate_evidence_ready_for_semantic_disposition') add(`record_state_invalid:${key}`);
    for(const blocker of requiredRecordBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    if(record?.repeatabilityReview?.state!=='reviewed_blocked'||record.repeatabilityReview.classification!==null||!(record.repeatabilityReview.evidenceKeys||[]).length) add(`record_repeatability_review_not_preserved:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record.memberExpansionReview.atomicSubject!==null||(record.memberExpansionReview.memberKeys||[]).length||(record.memberExpansionReview.evidenceKeys||[]).length) add(`record_member_expansion_gate_weakened:${key}`);
    if(record?.mechanicsReview?.state!=='unreviewed'||(record.mechanicsReview.evidenceKeys||[]).length) add(`record_mechanics_gate_weakened:${key}`);
    if(!isSha256(record?.sourceIndependentRepeatabilitySignalScopeEvidenceContentHash)||!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    addSource(sourceMap,pageRevisionMap,{sourcePageId:record.sourcePageId,resolvedTitle:record.resolvedTitle,sourceRevision:String(record.sourceRevision),sourceTimestamp:record.sourceTimestamp,sourceUrl:record.sourceUrl,sourceContentHash:record.sourceContentHash},errors,`primary:${key}`);
    validateSourceBoundHashes(record,errors,`record:${key}`);
    const evidence=record?.independentRepeatabilitySignalSubjectPredicateEvidence||{},observations=record?.independentRepeatabilitySignalSubjectPredicateObservations||{};
    const upstreamPages=new Map((record?.independentRepeatabilitySourceEvidence?.candidatePages||[]).map(page=>[sourcePageRevisionKey(page),page]));
    if(evidence.evidenceState!=='complete_revision_pinned_independent_repeatability_signal_subject_predicate_evidence_packet'||evidence.evidenceChannel!==POLICY.evidenceChannel) add(`record_subject_predicate_evidence_state_invalid:${key}`);
    if(observations.canonicalActivityScopeVerdict!==null||observations.repeatabilityVerdict!==null||(observations.deficiencies||[]).length||Number(observations.semanticSubjectBindingCount)!==0||Number(observations.stableActivityAnchorObservedPacketCount)!==0) add(`record_subject_predicate_observation_gate_invalid:${key}`);
    const packets=evidence.signalSubjectPredicateEvidencePackets||[];
    for(const packet of packets) {
      const signalKey=packet?.signalEvidenceKey,pair=`${key}|${signalKey}`; packetCount++;
      if(!signalKey||signalPairs.has(pair)) add(`duplicate_or_invalid_signal_pair:${pair}`); else signalPairs.add(pair);
      const expected=packet?.sourceRevisionVerification?.expected||{},fetched=packet?.sourceRevisionVerification?.fetched||{},revisionKey=sourcePageRevisionKey(expected),request=requestMap.get(revisionKey),upstream=upstreamPages.get(revisionKey);
      addSource(sourceMap,pageRevisionMap,expected,errors,`signal:${pair}`);
      if(packet?.sourceRevisionVerification?.exactAlignment!==true||json(expected)!==json(withoutKeys(fetched,['sourceContentBytes']))||!request||request.resolvedTitle!==expected.resolvedTitle||request.sourceTimestamp!==expected.sourceTimestamp||request.sourceUrl!==expected.sourceUrl||request.sourceContentHash!==expected.sourceContentHash||!upstream||upstream.completeRevisionContentScanned!==true||upstream.resolvedTitle!==expected.resolvedTitle||String(upstream.sourceRevision)!==String(expected.sourceRevision)||upstream.sourceTimestamp!==expected.sourceTimestamp||upstream.sourceUrl!==expected.sourceUrl||upstream.sourceContentHash!==expected.sourceContentHash||Number(upstream.sourceContentBytes)!==Number(fetched.sourceContentBytes)) add(`signal_source_revision_alignment_mismatch:${pair}`);
      const route=packet?.evidenceWorkRoute||{},requestContext=(request?.signalContexts||[]).find(item=>item.memberCandidateKey===key&&item.signalEvidenceKey===signalKey);
      if(!POLICY.supportedRouteKeys.includes(route.routeKey)||route.evidenceWorkComplete!==false||route.signalEvidenceKey!==signalKey||!requestContext||requestContext.canonicalActivityKey!==record.canonicalActivityIdentity.canonicalActivityKey||requestContext.routeKey!==route.routeKey||json(requestContext.sourceLocator)!==json(packet.repeatabilityPredicateEvidence&&{columnEnd:packet.repeatabilityPredicateEvidence.columnEnd,columnStart:packet.repeatabilityPredicateEvidence.columnStart,lineEnd:packet.exactSourceLineEvidence.lineEnd,lineStart:packet.exactSourceLineEvidence.lineStart})) add(`signal_route_or_manifest_context_mismatch:${pair}`);
      contextPairs.add(pair);
      const line=packet?.exactSourceLineEvidence||{},predicate=packet?.repeatabilityPredicateEvidence||{},links=packet?.exactLineLinkRevalidation||{},semantic=packet?.semanticBinding||{},anchor=packet?.stableIdentityAnchorObservations||{};
      const upstreamSignal=(upstream?.sourceLocatedSignals||[]).find(signal=>signal.evidenceKey===signalKey);
      if(line.exactContextMatch===true&&line.text===line.retainedContextText&&line.sourceLineContentHash===hash(line.text)&&upstreamSignal?.contextText===line.text&&upstreamSignal?.matchedText===predicate.extractedText&&upstreamSignal?.definitionKey===predicate.definitionKey&&upstreamSignal?.sourceContentHash===expected.sourceContentHash&&upstreamSignal?.scannedTextHash===expected.sourceContentHash&&json(upstreamSignal?.sourceLocator)===json({columnEnd:predicate.columnEnd,columnStart:predicate.columnStart,lineEnd:line.lineEnd,lineStart:line.lineStart})) sourceLineCount++; else add(`exact_source_line_not_revalidated:${pair}`);
      if(predicate.exactMatch===true&&predicate.extractedText===predicate.expectedText&&predicate.semanticMeaningVerdict===null&&Number(predicate.columnStart)>=1&&Number(predicate.columnEnd)>=Number(predicate.columnStart)&&line.text.slice(Number(predicate.columnStart)-1,Number(predicate.columnEnd))===predicate.extractedText) predicateCount++; else add(`predicate_span_not_revalidated:${pair}`);
      if(links.balancedSourceLinkDelimiters===true&&links.exactLinkContextMatch===true&&links.exactOccurrenceSetMatch===true&&json(links.expectedOccurrenceKeys||[])===json(links.revalidatedOccurrenceKeys||[])&&json(links.expectedLinks||[])===json(links.revalidatedLinks||[])) { linkSetCount++; linkOccurrenceCount+=(links.revalidatedLinks||[]).length; } else add(`exact_line_link_set_not_revalidated:${pair}`);
      if(semantic.canonicalActivityScopeVerdict!==null||semantic.canonicalActivitySubjectVerdict!==null||semantic.repeatabilityPredicateVerdict!==null||semantic.repeatabilityVerdict!==null||semantic.crossSentenceCoreferenceReviewed!==false||semantic.implicitSubjectReviewed!==false||semantic.pronounAntecedentReviewed!==false||semantic.variantOrModeScopeReviewed!==false||semantic.state!=='unreviewed_requires_generic_semantic_disposition') add(`semantic_binding_gate_weakened:${pair}`);
      if(anchor.sourceMatchesCollectionAnchor!==false||anchor.sourceMatchesLinkedSubjectAnchor!==false||(anchor.collectionTargetAnchorOccurrenceKeys||[]).length||(anchor.linkedTargetAnchorOccurrenceKeys||[]).length||(anchor.stableAnchorEvidenceKeys||[]).length||anchor.structuralState!=='no_stable_activity_anchor_observed_semantic_binding_unresolved') add(`stable_identity_anchor_promoted:${pair}`); else noAnchorCount++;
      if(packet.state!=='complete_revision_pinned_signal_subject_predicate_evidence_without_structural_anchor'||(packet.deficiencies||[]).length||!(packet.limitations||[]).includes('exact_source_line_and_predicate_span_do_not_establish_semantic_subject_binding')) add(`signal_packet_state_invalid:${pair}`);
      if(route.routeKey==='collect_source_bound_subject_predicate_binding_without_exact_line_link') routeWithoutLink++; else if(route.routeKey==='resolve_stable_activity_anchor_then_bind_repeatability_predicate') routeWithLink++;
    }
    const measured={evidencePacketCount:packets.length,routedSignalCount:packets.length,exactRevisionAlignedPacketCount:packets.length,exactSourceLineRevalidatedCount:packets.length,exactPredicateSpanRevalidatedCount:packets.length,exactLineLinkSetRevalidatedCount:packets.length,stableActivityAnchorObservedPacketCount:0,noStableActivityAnchorObservedPacketCount:packets.length,semanticSubjectBindingCount:0};
    for(const [name,value] of Object.entries(measured)) if(Number(observations[name])!==value) add(`record_observation_count_mismatch:${key}:${name}`);
  }
  const manifestPairs=[];
  for(const request of revisionRequests) for(const context of request.signalContexts||[]) manifestPairs.push(`${context.memberCandidateKey}|${context.signalEvidenceKey}`);
  if(new Set(manifestPairs).size!==manifestPairs.length||json(sorted(manifestPairs))!==json(sorted(signalPairs))) add('manifest_and_record_signal_context_sets_differ');
  if(packetCount!==Number(signalAudit.routedSignalCount)||packetCount!==Number(signalAudit.evidencePacketCount)||routeWithoutLink!==Number(signalAudit.sourceBoundSubjectPredicateRouteCount)||routeWithLink!==Number(signalAudit.stableAnchorThenSemanticBindingRouteCount)||sourceLineCount!==Number(lineAudit.exactSourceLineRevalidatedCount)||predicateCount!==Number(lineAudit.exactPredicateSpanRevalidatedCount)||linkSetCount!==Number(lineAudit.exactLineLinkSetRevalidatedCount)||linkOccurrenceCount!==Number(lineAudit.revalidatedExactLineLinkOccurrenceCount)||noAnchorCount!==Number(identityAudit.noStableActivityAnchorObservedPacketCount)) add('measured_audit_counts_mismatch');
  if(errors.length) throw new Error(`Activity reference-member signal subject-predicate materialization input rejected: ${unique(errors).join(', ')}`);

  const sources=sorted(sourceMap.keys()).map(key=>sourceMap.get(key)),statements=records.map(compactStatement),model={
    contract:ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_MATERIALIZATION_CONTRACT,domain:ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_INPUT_DOMAIN,
    snapshotDirectory:audit.outputSnapshot.directory,snapshotCreatedAt:manifest.createdAt,snapshotContentHash:manifest.contentHash,auditContentHash:audit.contentHash,
    sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),sources,records,statements,skillKeys:[],
    counts:{sources:sources.length,records:records.length,statements:statements.length,signals:packetCount,exactSourceLines:sourceLineCount,exactPredicateSpans:predicateCount,exactLineLinkSets:linkSetCount,exactLineLinkOccurrences:linkOccurrenceCount,stableActivityAnchors:0,noStableActivityAnchors:noAnchorCount,semanticSubjectBindings:0,requestedRevisions:requestMap.size},
    gates:{subjectPredicateEvidencePacketCoverageComplete:true,canonicalActivityScopeReviewComplete:false,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}
  };
  model.recordHashAggregate=hash(records.map(row=>row.contentHash).sort()); model.sourceHashAggregate=hash(sources.map(row=>row.sourceContentHash).sort()); model.statementHashAggregate=hash(statements.map(row=>row.contentHash).sort()); model.materializationHash=hash(model);
  model.runId=deterministicUuid('sensum-ingestion-run',`${model.domain}:${model.snapshotContentHash}`); model.snapshotId=deterministicUuid('sensum-data-snapshot',model.snapshotContentHash); return model;
}

const hex=value=>Buffer.from(String(value),'utf8').toString('hex');
const sqlText=value=>`convert_from(decode('${hex(value)}','hex'),'UTF8')`;
const sqlJson=value=>`${sqlText(json(value))}::jsonb`;
const sqlTimestamp=value=>`${sqlText(value)}::timestamptz`;
function metrics(model) { return {contract:model.contract,...model.counts,skillCoverage:0,skillKeys:[],recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}; }

export function buildActivityReferenceMemberSignalSubjectPredicateMaterializationSql(model) {
  assert(model?.contract===ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_MATERIALIZATION_CONTRACT,'materialization_contract_mismatch');
  const expectedSources=model.sources.map(source=>`(${sqlText(source.providerKey)},${sqlText(source.sourceUrl)},${sqlText(source.title)},${sqlText(source.sourceRevision)},${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(source.sourceTimestamp)},${sqlText(source.sourceContentHash)})`).join(',\n');
  const expectedRecords=model.records.map(record=>`(${sqlText(record.memberCandidateKey)},${sqlJson(record)},${sqlText(record.sourceUrl)},${sqlText(String(record.sourceRevision))},${sqlText(record.contentHash)},${sqlJson(record.blockers)})`).join(',\n');
  const expectedStatements=model.statements.map(statement=>`(${sqlText(statement.recordKey)},${sqlText(statement.sourceUrl)},${sqlText(statement.sourceRevision)},${sqlTimestamp(statement.sourceTimestamp)},${sqlText(statement.contentHash)},${sqlJson(statement.sourceLocator)},${sqlJson(statement.payload)})`).join(',\n');
  const validationSummary={contract:model.contract,auditContentHash:model.auditContentHash,...model.gates},materializationMetrics=metrics(model);
  return ['\\set ON_ERROR_STOP on','BEGIN;',`SELECT pg_advisory_xact_lock(hashtextextended(${sqlText(`${model.domain}:${model.snapshotContentHash}`)},0));`,'CREATE TEMP TABLE expected_sources(provider_key text,source_url text,title text,source_revision text,fetched_at timestamptz,published_at timestamptz,content_hash text) ON COMMIT DROP;',`INSERT INTO expected_sources VALUES ${expectedSources};`,'CREATE TEMP TABLE expected_records(record_key text,payload jsonb,source_url text,source_revision text,content_hash text,findings jsonb) ON COMMIT DROP;',`INSERT INTO expected_records VALUES ${expectedRecords};`,'CREATE TEMP TABLE expected_statements(record_key text,source_url text,source_revision text,source_timestamp timestamptz,content_hash text,raw_locator jsonb,parsed_value jsonb) ON COMMIT DROP;',`INSERT INTO expected_statements VALUES ${expectedStatements};`,`INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`Accepted independent repeatability signal subject-predicate evidence ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson(validationSummary)}) ON CONFLICT (manifest_hash) DO NOTHING;`,`INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.sourceRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(materializationMetrics)}) ON CONFLICT (id) DO NOTHING;`,"INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,provider_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",`INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,`INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,`INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,buildLineageInsertAndReconciliationSql(model,ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND),`DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson(validationSummary)}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.sourceRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(materializationMetrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON ${exactWikiSourceReconciliationPredicate()}; IF actual<>${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual<>${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}')<>${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual<>${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}')<>${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual<>${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed'; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '"optimizerEligible"[[:space:]]*:[[:space:]]*true' OR r.payload::text ~* '"canonicalActivityScopeVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"canonicalActivitySubjectVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"repeatabilityPredicateVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"repeatabilityVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"repeatabilityClassification"[[:space:]]*:[[:space:]]*"') THEN RAISE EXCEPTION 'ingestion signal subject-predicate semantic gate weakened'; END IF; END $$;`,'COMMIT;'].join('\n')+'\n';
}

export function buildActivityReferenceMemberSignalSubjectPredicateExistingSourceCountQuery(model) { return buildExistingExactWikiSourceCountQuery(model.sources); }
export function buildActivityReferenceMemberSignalSubjectPredicateReconciliationQuery(model) { return `SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM activity_evidence a JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}' WHERE a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND}'),'lineage',(SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE ingestion_run_id='${model.runId}'),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`; }
export function verifyActivityReferenceMemberSignalSubjectPredicateReconciliation(model,actual) {
  assert(actual?.runId===model.runId,'reconciliation_run_id_mismatch'); assert(actual?.status==='published','reconciliation_run_not_published');
  for(const key of ['records','sources','statements']) assert(Number(actual?.[key])===model.counts[key],`reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage)===model.counts.statements,'reconciliation_lineage_count_mismatch'); assert(actual?.snapshotComplete===false,'signal_subject_predicate_evidence_snapshot_must_not_claim_complete_world_knowledge');
  for(const [key,value] of [['recordHashAggregate',model.recordHashAggregate],['sourceHashAggregate',model.sourceHashAggregate],['statementHashAggregate',model.statementHashAggregate],['materializationHash',model.materializationHash]]) assert(actual?.metrics?.[key]===value,`reconciliation_${key}_mismatch`);
  assert(actual?.metrics?.subjectPredicateEvidencePacketCoverageComplete===true&&actual?.metrics?.canonicalActivityScopeReviewComplete===false&&actual?.metrics?.repeatabilityReviewComplete===false&&actual?.metrics?.memberExpansionReviewComplete===false&&actual?.metrics?.mechanicsReviewComplete===false&&actual?.metrics?.completeActivityUniverse===false&&Number(actual?.metrics?.optimizerEligibleRecords)===0&&actual?.metrics?.automaticVerification===false&&actual?.metrics?.semanticReviewRequired===true,'reconciliation_semantic_gate_weakened'); return true;
}
