import fs from 'node:fs';
import {hash, json} from '../ingestion/lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {
  buildExistingExactWikiSourceCountQuery,
  exactWikiSourceReconciliationPredicate
} from './exact-wiki-source-identity-lib.mjs';

export const ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_MATERIALIZATION_CONTRACT = 'sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-postgresql-materialization.v1';
export const ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_INPUT_DOMAIN = 'activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence';
export const ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND = 'raw_activity_reference_member_canonical_activity_subject_declaration_exact_line_evidence';

const POLICY_ID='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-v1.json';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-v1.json',import.meta.url),'utf8'));
const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const sourceIdentity=source=>`${source.sourceUrl}|${source.sourceRevision}`;
const contextKey=context=>`${context.memberCandidateKey}|${context.canonicalActivityKey}|${context.exactPhrase}|${context.candidatePairKey}`;
const sourceKey=(pageId,revision)=>`${Number(pageId)}|${String(revision)}`;

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
function wikiSource(request) {
  return {
    providerKey:`wiki-pageid:${Number(request.sourcePageId)}`,
    sourceUrl:request.sourceUrl,
    title:request.resolvedTitle,
    sourceRevision:String(request.sourceRevision),
    sourceTimestamp:request.sourceTimestamp,
    sourceContentHash:request.sourceContentHash
  };
}
function compactStatement(record) {
  const evidence=record.canonicalActivitySubjectDeclarationExactLineEvidence;
  const observations=record.canonicalActivitySubjectDeclarationExactLineObservations;
  const statementSource=evidence.candidateEvidencePackets[0].discoveryCandidate.revisionEvidence;
  const payload={
    blockers:record.blockers,
    canonicalActivityIdentity:record.canonicalActivityIdentity,
    canonicalActivityScopeVerdict:null,
    canonicalActivitySubjectDeclarationVerdict:null,
    exactCaseOccurrenceCount:evidence.candidateEvidencePackets.flatMap(packet=>packet.exactPhraseOccurrences).filter(row=>row.canonicalActivityLabelExactCaseMatch===true).length,
    exactPhrase:evidence.exactPhrase,
    exactPhraseOccurrenceCount:observations.rawOccurrenceCount,
    exactRevisionCandidatePacketCount:evidence.candidateEvidencePackets.length,
    mechanicsState:record.mechanicsReview.state,
    memberExpansionState:record.memberExpansionReview.state,
    optimizerEligible:false,
    repeatabilityClassification:null,
    repeatabilityState:record.repeatabilityReview.state,
    reviewState:record.canonicalActivitySubjectDeclarationReview.state,
    state:record.state
  };
  const envelope={
    recordKey:record.memberCandidateKey,
    sourceRevision:String(statementSource.sourceRevision),
    sourceLocator:{memberCandidateKey:record.memberCandidateKey,identityAnchorPageId:Number(record.sourcePageId),exactLineSourcePageId:Number(statementSource.sourcePageId),canonicalActivityKey:evidence.canonicalActivityKey,exactPhrase:evidence.exactPhrase},
    payload
  };
  return {...envelope,sourceUrl:statementSource.sourceUrl,sourceTimestamp:statementSource.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityReferenceMemberSubjectExactLineMaterializationInput({raw,manifest,audit}) {
  const errors=[];
  const add=message=>errors.push(message);
  const records=parseRecords(raw,errors);

  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_complete_source_exact_canonical_activity_phrase_occurrence_inventory_without_semantic_or_downstream_promotion') add('manifest_source_channel_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(manifest?.records!==records.length||records.length===0) add('manifest_record_count_mismatch');

  if(POLICY?.policy!==POLICY_ID||POLICY?.recordContract!=='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence.v1'||POLICY?.auditContract!=='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-audit.v1'||!Object.values(POLICY?.rules||{}).every(value=>value===true)) add('policy_contract_or_rules_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest?.source?.policy?.file!==POLICY_FILE||manifest?.source?.policy?.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  if((manifest?.source?.inputSnapshot?.rejections||[]).length||!isSha256(manifest?.source?.inputSnapshot?.contentHash)||!manifest?.source?.inputSnapshot?.directory) add('manifest_input_snapshot_invalid');

  if(audit?.contract!=='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(audit?.policy?.id!==POLICY_ID||audit?.policy?.file!==POLICY_FILE||audit?.policy?.contentHash!==hash(POLICY)) add('audit_policy_binding_mismatch');
  if(json(audit?.inputSnapshot)!==json(manifest?.source?.inputSnapshot)) add('audit_input_snapshot_mismatch');
  if(!audit?.outputSnapshot?.directory||audit?.outputSnapshot?.contentHash!==manifest?.contentHash||(manifest?.snapshotDirectory&&audit.outputSnapshot.directory!==manifest.snapshotDirectory)) add('audit_output_snapshot_mismatch');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','inputSnapshot','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{};
  if(Number(input.expectedRecordCount)!==records.length||Number(input.outputRecordCount)!==records.length) add('audit_record_coverage_mismatch');
  for(const key of ['duplicateInputMemberCandidateKeys','duplicateOutputMemberCandidateKeys','missingMemberCandidateKeys','unexpectedMemberCandidateKeys','contextMismatchMemberCandidateKeys']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  const policyCoverage=audit?.policyCoverage||{};
  if(policyCoverage.policyId!==POLICY_ID||(policyCoverage.invalidRules||[]).length||(policyCoverage.forbiddenPolicyPaths||[]).length) add('audit_policy_gate_invalid');
  const revisionCoverage=audit?.revisionCoverage||{};
  if(revisionCoverage.exactRevisionFetchSetMatch!==true||(revisionCoverage.missingRevisionIds||[]).length||(revisionCoverage.unexpectedRevisionIds||[]).length||(revisionCoverage.duplicateFetchedRevisionIds||[]).length) add('audit_revision_set_not_exact');
  const candidateCoverage=audit?.candidateCoverage||{};
  if(candidateCoverage.exactCandidatePairSetMatch!==true||Number(candidateCoverage.incompleteCandidatePacketCount)!==0) add('audit_candidate_packet_gate_invalid');
  for(const key of ['missingCandidatePairs','unexpectedCandidatePairs','duplicateInputCandidatePairs','duplicateOutputCandidatePairs']) if((candidateCoverage[key]||[]).length) add(`audit_candidate_set_not_exact:${key}`);
  const occurrenceCoverage=audit?.occurrenceCoverage||{};
  if((occurrenceCoverage.duplicateOccurrenceKeys||[]).length||(occurrenceCoverage.evidenceMismatchMemberCandidateKeys||[]).length) add('audit_occurrence_set_invalid');
  const promotion=audit?.semanticPromotionCoverage||{};
  for(const key of ['semanticSubjectBindingCount','canonicalActivityScopeClassificationCount','repeatabilityClassificationCount','memberExpansionReviewedCount','mechanicsReviewedCount','optimizerEligibleCount']) if(Number(promotion[key])!==0) add(`audit_semantic_gate_weakened:${key}`);
  if((promotion.unsupportedPromotionMemberCandidateKeys||[]).length||(audit?.incompleteRecordMemberCandidateKeys||[]).length||(audit?.accountStateFindings||[]).length) add('audit_unsupported_or_incomplete_records_present');
  if(audit?.exactLineEvidenceAttemptCoverageComplete!==true||audit?.canonicalActivitySubjectDeclarationExactLineEvidenceCoverageComplete!==true||audit?.canonicalActivitySubjectBindingReviewComplete!==false||audit?.repeatabilityReviewComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  for(const blocker of ['canonical_activity_subject_declaration_exact_line_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const requests=manifest?.source?.revisionRequests||[];
  const fetched=manifest?.source?.fetchedRevisions||[];
  const requestMap=new Map(),fetchedMap=new Map(),expectedContexts=new Set();
  let fetchedBytes=0;
  for(const request of requests) {
    const key=sourceKey(request.sourcePageId,request.sourceRevision);
    if(requestMap.has(key)) add(`duplicate_manifest_revision_request:${key}`); else requestMap.set(key,request);
    if(!Number.isInteger(Number(request.sourcePageId))||!request.resolvedTitle||!Number.isFinite(Date.parse(request.sourceTimestamp))||!String(request.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')||!isSha256(request.sourceContentHash)) add(`manifest_revision_request_invalid:${key}`);
    for(const context of request.candidateContexts||[]) {
      if(context.candidatePairKey!==`${context.memberCandidateKey}|${Number(request.sourcePageId)}|${String(request.sourceRevision)}`||!context.canonicalActivityKey||!context.exactPhrase) add(`manifest_candidate_context_invalid:${key}`);
      const normalized=contextKey(context);
      if(expectedContexts.has(normalized)) add(`duplicate_manifest_candidate_context:${context.candidatePairKey}`); else expectedContexts.add(normalized);
    }
  }
  for(const source of fetched) {
    const key=sourceKey(source.pageId,source.revision);
    if(fetchedMap.has(key)) add(`duplicate_manifest_fetched_revision:${key}`); else fetchedMap.set(key,source);
    if(!Number.isInteger(Number(source.sourceContentBytes))||Number(source.sourceContentBytes)<=0) add(`manifest_fetched_revision_bytes_invalid:${key}`);
    fetchedBytes+=Number(source.sourceContentBytes||0);
  }
  if(requestMap.size!==fetchedMap.size||requestMap.size!==Number(revisionCoverage.requestedExactRevisionCount)||fetchedMap.size!==Number(revisionCoverage.fetchedExactRevisionCount)||fetchedBytes!==Number(revisionCoverage.totalFetchedSourceBytes)) add('manifest_revision_coverage_count_mismatch');
  for(const [key,request] of requestMap) {
    const source=fetchedMap.get(key);
    if(!source||Number(source.pageId)!==Number(request.sourcePageId)||source.title!==request.resolvedTitle||String(source.revision)!==String(request.sourceRevision)||source.timestamp!==request.sourceTimestamp||source.contentHash!==request.sourceContentHash) add(`manifest_fetched_revision_mismatch:${key}`);
  }

  const sources=requests.map(wikiSource).sort((a,b)=>sourceIdentity(a).localeCompare(sourceIdentity(b)));
  const sourceIdentitySet=new Set(sources.map(sourceIdentity));
  if(sourceIdentitySet.size!==sources.length) add('duplicate_exact_source_identity');
  const packetContexts=new Set(),occurrenceKeys=new Set(),seenRecords=new Set();
  let packets=0,alignedPackets=0,rawOccurrences=0,activeOccurrences=0,protectedOccurrences=0,exactCaseOccurrences=0;
  const requiredRecordBlockers=['canonical_activity_subject_declaration_exact_line_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';
    if(seenRecords.has(key)) add(`duplicate_record_key:${key}`); else seenRecords.add(key);
    if(record?.contract!=='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(record?.canonicalGameEntityIdentity!==null||!record?.canonicalActivityIdentity?.canonicalActivityKey||record?.optimizerEligible!==false) add(`record_semantic_gate_weakened:${key}`);
    if(record?.state!=='canonical_activity_subject_declaration_exact_line_evidence_ready_for_semantic_disposition') add(`record_state_invalid:${key}`);
    for(const blocker of requiredRecordBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    if(record?.canonicalActivityIdentityReview?.state!=='reviewed_source_supported'||json(record.canonicalActivityIdentityReview.identity)!==json(record.canonicalActivityIdentity)) add(`record_upstream_canonical_identity_not_preserved:${key}`);
    const evidence=record?.canonicalActivitySubjectDeclarationExactLineEvidence||{};
    const observations=record?.canonicalActivitySubjectDeclarationExactLineObservations||{};
    const review=record?.canonicalActivitySubjectDeclarationReview||{};
    if(evidence.evidenceChannel!=='complete_exact_revision_source_phrase_occurrence_inventory'||evidence.evidenceState!=='complete_revision_pinned_subject_declaration_exact_line_evidence_packet'||evidence.canonicalActivityKey!==record.canonicalActivityIdentity.canonicalActivityKey||evidence.exactPhrase!==record.canonicalActivityIdentity.canonicalLabel) add(`record_exact_evidence_identity_invalid:${key}`);
    if(review.state!=='unreviewed_exact_line_evidence_collected_semantic_disposition_required'||review.canonicalActivitySubjectDeclarationVerdict!==null||review.canonicalActivityScopeVerdict!==null||review.repeatabilityVerdict!==null||(review.evidenceKeys||[]).length) add(`record_subject_review_gate_weakened:${key}`);
    if(record?.repeatabilityReview?.state!=='reviewed_blocked'||record?.repeatabilityReview?.classification!==null||!(record?.repeatabilityReview?.evidenceKeys||[]).length) add(`record_repeatability_review_not_preserved:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record?.memberExpansionReview?.atomicSubject!==null||(record?.memberExpansionReview?.memberKeys||[]).length||(record?.memberExpansionReview?.evidenceKeys||[]).length) add(`record_member_expansion_gate_weakened:${key}`);
    if(record?.mechanicsReview?.state!=='unreviewed'||(record?.mechanicsReview?.evidenceKeys||[]).length) add(`record_mechanics_gate_weakened:${key}`);
    if(!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    for(const [name,value] of Object.entries(record||{})) if(name.endsWith('ContentHash')&&!isSha256(value)) add(`record_provenance_hash_invalid:${key}:${name}`);
    if(!Number.isInteger(Number(record?.sourcePageId))||!record?.resolvedTitle||!Number.isFinite(Date.parse(record?.sourceTimestamp))||!String(record?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')||!isSha256(record?.sourceContentHash)) add(`record_primary_source_invalid:${key}`);
    let recordRaw=0,recordActive=0,recordProtected=0,recordExactCase=0;
    for(const packet of evidence.candidateEvidencePackets||[]) {
      packets++;
      const revisionEvidence=packet?.discoveryCandidate?.revisionEvidence||{};
      const pairKey=`${key}|${Number(revisionEvidence.sourcePageId)}|${String(revisionEvidence.sourceRevision)}`;
      const context={memberCandidateKey:key,canonicalActivityKey:evidence.canonicalActivityKey,exactPhrase:evidence.exactPhrase,candidatePairKey:pairKey};
      if(packet.candidateEvidenceKey!==pairKey) add(`record_candidate_packet_key_invalid:${pairKey}`);
      const normalized=contextKey(context);
      if(packetContexts.has(normalized)) add(`duplicate_record_candidate_packet:${pairKey}`); else packetContexts.add(normalized);
      if(packet.state!=='complete_revision_pinned_exact_phrase_occurrence_inventory'||packet.matchMode!=='unicode_case_insensitive_literal_phrase'||(packet.deficiencies||[]).length||packet.exactPhrase!==evidence.exactPhrase||packet.canonicalActivitySubjectDeclarationVerdict!==null||packet.canonicalActivityScopeVerdict!==null||packet.repeatabilityVerdict!==null) add(`record_candidate_packet_gate_invalid:${pairKey}`);
      if(!Object.values(packet.sourceRevisionVerification||{}).length||!Object.values(packet.sourceRevisionVerification).every(Boolean)||packet?.sourceLinkDelimiterAudit?.balancedSourceLinkDelimiters!==true) add(`record_candidate_revision_verification_invalid:${pairKey}`); else alignedPackets++;
      const request=requestMap.get(sourceKey(revisionEvidence.sourcePageId,revisionEvidence.sourceRevision));
      if(!request||revisionEvidence.resolvedTitle!==request.resolvedTitle||revisionEvidence.sourceTimestamp!==request.sourceTimestamp||revisionEvidence.sourceUrl!==request.sourceUrl||revisionEvidence.sourceContentHash!==request.sourceContentHash||revisionEvidence.completeRevisionContentScanned!==true) add(`record_candidate_revision_identity_mismatch:${pairKey}`);
      const occurrences=packet.exactPhraseOccurrences||[];
      let packetActive=0,packetProtected=0;
      for(const occurrence of occurrences) {
        if(occurrenceKeys.has(occurrence.occurrenceKey)) add(`duplicate_occurrence_key:${occurrence.occurrenceKey}`); else occurrenceKeys.add(occurrence.occurrenceKey);
        if(occurrence.canonicalActivitySubjectDeclarationVerdict!==null||occurrence.canonicalActivityScopeVerdict!==null||occurrence.repeatabilityVerdict!==null||occurrence.semanticUse!=='active_exact_phrase_occurrence_requires_semantic_subject_and_scope_review') add(`occurrence_semantic_gate_weakened:${occurrence.occurrenceKey}`);
        if(!occurrence.matchedText||occurrence.matchedText.toLocaleLowerCase('en-US')!==evidence.exactPhrase.toLocaleLowerCase('en-US')||occurrence.exactSourceLinesContentHash!==hash(occurrence.exactSourceLines)) add(`occurrence_text_or_hash_invalid:${occurrence.occurrenceKey}`);
        const locator=occurrence.sourceLocator||{};
        if(!Number.isInteger(locator.lineStart)||!Number.isInteger(locator.lineEnd)||!Number.isInteger(locator.columnStart)||!Number.isInteger(locator.columnEnd)||!Number.isInteger(locator.absoluteOffsetStart)||!Number.isInteger(locator.absoluteOffsetEnd)||locator.lineStart<1||locator.lineEnd<locator.lineStart||locator.columnStart<1||locator.columnEnd<locator.columnStart||locator.absoluteOffsetStart<0||locator.absoluteOffsetEnd<locator.absoluteOffsetStart||locator.absoluteOffsetEnd-locator.absoluteOffsetStart+1!==occurrence.matchedText.length) add(`occurrence_locator_invalid:${occurrence.occurrenceKey}`);
        if(occurrence.sourceRegionState==='active_source_text') packetActive++; else packetProtected++;
        if(occurrence.canonicalActivityLabelExactCaseMatch===true) recordExactCase++;
      }
      if(Number(packet.rawOccurrenceCount)!==occurrences.length||Number(packet.activeSourceOccurrenceCount)!==packetActive||Number(packet.protectedOrMixedOccurrenceCount)!==packetProtected) add(`record_candidate_occurrence_counts_invalid:${pairKey}`);
      recordRaw+=occurrences.length; recordActive+=packetActive; recordProtected+=packetProtected;
    }
    if(Number(observations.candidateSourceCount)!==(evidence.candidateEvidencePackets||[]).length||Number(observations.exactRevisionAlignedCandidateCount)!==(evidence.candidateEvidencePackets||[]).length||Number(observations.rawOccurrenceCount)!==recordRaw||Number(observations.activeSourceOccurrenceCount)!==recordActive||Number(observations.protectedOrMixedOccurrenceCount)!==recordProtected||observations.canonicalActivitySubjectDeclarationVerdict!==null||observations.canonicalActivityScopeVerdict!==null||observations.repeatabilityVerdict!==null||(observations.deficiencies||[]).length) add(`record_exact_line_observations_invalid:${key}`);
    rawOccurrences+=recordRaw; activeOccurrences+=recordActive; protectedOccurrences+=recordProtected; exactCaseOccurrences+=recordExactCase;
  }
  if(packetContexts.size!==expectedContexts.size||[...packetContexts].some(key=>!expectedContexts.has(key))) add('record_candidate_packet_set_mismatch');
  const measured={
    inputCandidatePairCount:expectedContexts.size,
    outputCandidatePacketCount:packets,
    exactRevisionAlignedCandidateCount:alignedPackets,
    rawExactPhraseOccurrenceCount:rawOccurrences,
    activeSourceOccurrenceCount:activeOccurrences,
    protectedOrMixedOccurrenceCount:protectedOccurrences,
    exactCaseOccurrenceCount:exactCaseOccurrences
  };
  for(const key of ['inputCandidatePairCount','outputCandidatePacketCount','exactRevisionAlignedCandidateCount']) if(Number(candidateCoverage[key])!==measured[key]) add(`audit_candidate_count_mismatch:${key}`);
  for(const key of ['rawExactPhraseOccurrenceCount','activeSourceOccurrenceCount','protectedOrMixedOccurrenceCount','exactCaseOccurrenceCount']) if(Number(occurrenceCoverage[key])!==measured[key]) add(`audit_occurrence_count_mismatch:${key}`);
  if(errors.length) throw new Error(`Activity reference-member subject exact-line materialization input rejected: ${unique(errors).join(', ')}`);

  const statements=records.map(compactStatement);
  const model={
    contract:ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_MATERIALIZATION_CONTRACT,
    domain:ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_INPUT_DOMAIN,
    snapshotDirectory:audit.outputSnapshot.directory,
    snapshotCreatedAt:manifest.createdAt,
    snapshotContentHash:manifest.contentHash,
    auditContentHash:audit.contentHash,
    sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),
    sources,records,statements,skillKeys:[],
    counts:{sources:sources.length,records:records.length,statements:statements.length,candidatePackets:packets,rawOccurrences,activeOccurrences,protectedOccurrences,exactCaseOccurrences},
    gates:{exactLineEvidencePacketCoverageComplete:true,canonicalActivitySubjectBindingReviewComplete:false,canonicalActivityScopeReviewComplete:false,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}
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

export function buildActivityReferenceMemberSubjectExactLineMaterializationSql(model) {
  assert(model?.contract===ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_MATERIALIZATION_CONTRACT,'materialization_contract_mismatch');
  const expectedSources=model.sources.map(source=>`(${sqlText(source.providerKey)},${sqlText(source.sourceUrl)},${sqlText(source.title)},${sqlText(source.sourceRevision)},${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(source.sourceTimestamp)},${sqlText(source.sourceContentHash)})`).join(',\n');
  const expectedRecords=model.records.map(record=>`(${sqlText(record.memberCandidateKey)},${sqlJson(record)},${sqlText(record.sourceUrl)},${sqlText(String(record.sourceRevision))},${sqlText(record.contentHash)},${sqlJson(record.blockers)})`).join(',\n');
  const expectedStatements=model.statements.map(statement=>`(${sqlText(statement.recordKey)},${sqlText(statement.sourceUrl)},${sqlText(statement.sourceRevision)},${sqlTimestamp(statement.sourceTimestamp)},${sqlText(statement.contentHash)},${sqlJson(statement.sourceLocator)},${sqlJson(statement.payload)})`).join(',\n');
  const validationSummary={contract:model.contract,auditContentHash:model.auditContentHash,...model.gates};
  const materializationMetrics=metrics(model);
  return [
    '\\set ON_ERROR_STOP on','BEGIN;',
    `SELECT pg_advisory_xact_lock(hashtextextended(${sqlText(`${model.domain}:${model.snapshotContentHash}`)},0));`,
    'CREATE TEMP TABLE expected_sources(provider_key text,source_url text,title text,source_revision text,fetched_at timestamptz,published_at timestamptz,content_hash text) ON COMMIT DROP;',`INSERT INTO expected_sources VALUES ${expectedSources};`,
    'CREATE TEMP TABLE expected_records(record_key text,payload jsonb,source_url text,source_revision text,content_hash text,findings jsonb) ON COMMIT DROP;',`INSERT INTO expected_records VALUES ${expectedRecords};`,
    'CREATE TEMP TABLE expected_statements(record_key text,source_url text,source_revision text,source_timestamp timestamptz,content_hash text,raw_locator jsonb,parsed_value jsonb) ON COMMIT DROP;',`INSERT INTO expected_statements VALUES ${expectedStatements};`,
    `INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`Accepted canonical-activity subject exact-line review evidence ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson(validationSummary)}) ON CONFLICT (manifest_hash) DO NOTHING;`,
    `INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.sourceRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(materializationMetrics)}) ON CONFLICT (id) DO NOTHING;`,
    "INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,provider_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",
    `INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,
    `INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,
    `INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,
    buildLineageInsertAndReconciliationSql(model,ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND),
    `DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson(validationSummary)}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.sourceRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(materializationMetrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON ${exactWikiSourceReconciliationPredicate()}; IF actual<>${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual<>${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}')<>${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual<>${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}')<>${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual<>${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed'; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '\"optimizerEligible\"[[:space:]]*:[[:space:]]*true' OR r.payload::text ~* '\"canonicalActivitySubjectDeclarationVerdict\"[[:space:]]*:[[:space:]]*\"' OR r.payload::text ~* '\"canonicalActivityScopeVerdict\"[[:space:]]*:[[:space:]]*\"' OR r.payload::text ~* '\"repeatabilityClassification\"[[:space:]]*:[[:space:]]*\"') THEN RAISE EXCEPTION 'ingestion exact-line semantic gate weakened'; END IF; END $$;`,
    'COMMIT;'
  ].join('\n')+'\n';
}

export function buildActivityReferenceMemberSubjectExactLineExistingSourceCountQuery(model) { return buildExistingExactWikiSourceCountQuery(model.sources); }
export function buildActivityReferenceMemberSubjectExactLineReconciliationQuery(model) {
  return `SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM activity_evidence a JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}' WHERE a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND}'),'lineage',(SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE ingestion_run_id='${model.runId}'),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`;
}
export function verifyActivityReferenceMemberSubjectExactLineReconciliation(model,actual) {
  assert(actual?.runId===model.runId,'reconciliation_run_id_mismatch');
  assert(actual?.status==='published','reconciliation_run_not_published');
  for(const key of ['records','sources','statements']) assert(Number(actual?.[key])===model.counts[key],`reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage)===model.counts.statements,'reconciliation_lineage_count_mismatch');
  assert(actual?.snapshotComplete===false,'subject_exact_line_evidence_snapshot_must_not_claim_complete_world_knowledge');
  for(const [key,value] of [['recordHashAggregate',model.recordHashAggregate],['sourceHashAggregate',model.sourceHashAggregate],['statementHashAggregate',model.statementHashAggregate],['materializationHash',model.materializationHash]]) assert(actual?.metrics?.[key]===value,`reconciliation_${key}_mismatch`);
  assert(actual?.metrics?.exactLineEvidencePacketCoverageComplete===true&&actual?.metrics?.canonicalActivitySubjectBindingReviewComplete===false&&actual?.metrics?.canonicalActivityScopeReviewComplete===false&&actual?.metrics?.repeatabilityReviewComplete===false&&actual?.metrics?.memberExpansionReviewComplete===false&&actual?.metrics?.mechanicsReviewComplete===false&&actual?.metrics?.completeActivityUniverse===false&&Number(actual?.metrics?.optimizerEligibleRecords)===0&&actual?.metrics?.automaticVerification===false&&actual?.metrics?.semanticReviewRequired===true,'reconciliation_semantic_gate_weakened');
  return true;
}
