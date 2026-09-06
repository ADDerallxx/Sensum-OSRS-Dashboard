import fs from 'node:fs';
import {hash, json} from '../ingestion/lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {
  buildExistingExactWikiSourceCountQuery,
  exactWikiSourceReconciliationPredicate
} from './exact-wiki-source-identity-lib.mjs';

export const ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_MATERIALIZATION_CONTRACT = 'sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-postgresql-materialization.v1';
export const ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_INPUT_DOMAIN = 'activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence';
export const ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND = 'raw_activity_reference_member_canonical_activity_subject_declaration_structural_context_evidence';

const POLICY_ID='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-v1.json';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-v1.json',import.meta.url),'utf8'));
const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const sourceIdentity=source=>`${source.sourceUrl}|${source.sourceRevision}`;
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
function validateSourceBoundHashes(value,errors,path='structural') {
  if(Array.isArray(value)) return value.forEach((child,index)=>validateSourceBoundHashes(child,errors,`${path}[${index}]`));
  if(!value||typeof value!=='object') return;
  if(Object.hasOwn(value,'exactSourceContentHash')) {
    if(typeof value.exactSource!=='string'||value.exactSourceContentHash!==hash(value.exactSource)) errors.push(`structural_exact_source_hash_mismatch:${path}`);
  }
  if(Object.hasOwn(value,'exactSourceLinesContentHash')) {
    if(typeof value.exactSourceLines!=='string'||value.exactSourceLinesContentHash!==hash(value.exactSourceLines)) errors.push(`structural_exact_lines_hash_mismatch:${path}`);
  }
  for(const [key,child] of Object.entries(value)) validateSourceBoundHashes(child,errors,`${path}.${key}`);
}
function compactStatement(record) {
  const evidence=record.canonicalActivitySubjectDeclarationStructuralContextEvidence;
  const observations=record.canonicalActivitySubjectDeclarationStructuralContextObservations;
  const statementSource=evidence.occurrenceStructuralContextPackets[0].sourceRevisionEvidence;
  const payload={
    blockers:record.blockers,
    canonicalActivityIdentity:record.canonicalActivityIdentity,
    canonicalActivityScopeVerdict:null,
    canonicalActivitySubjectDeclarationVerdict:null,
    occurrenceCount:observations.occurrenceCount,
    exactOccurrenceRevalidatedCount:observations.exactOccurrenceRevalidatedCount,
    beforeFirstHeadingCount:observations.beforeFirstHeadingCount,
    headingScopedCount:observations.headingScopedCount,
    templateContainedCount:observations.templateContainedCount,
    linkContainedCount:observations.linkContainedCount,
    tableContainedCount:observations.tableContainedCount,
    listMarkedCount:observations.listMarkedCount,
    redirectDirectiveCount:observations.redirectDirectiveCount,
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
    sourceLocator:{memberCandidateKey:record.memberCandidateKey,identityAnchorPageId:Number(record.sourcePageId),structuralContextSourcePageId:Number(statementSource.sourcePageId),canonicalActivityKey:evidence.canonicalActivityKey},
    payload
  };
  return {...envelope,sourceUrl:statementSource.sourceUrl,sourceTimestamp:statementSource.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityReferenceMemberSubjectStructuralContextMaterializationInput({raw,manifest,audit}) {
  const errors=[];
  const add=message=>errors.push(message);
  const records=parseRecords(raw,errors);

  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_exact_occurrence_structural_parent_inventory_without_semantic_or_downstream_promotion') add('manifest_source_channel_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(manifest?.records!==records.length||records.length===0) add('manifest_record_count_mismatch');

  if(POLICY?.policy!==POLICY_ID||POLICY?.recordContract!=='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence.v1'||POLICY?.auditContract!=='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-audit.v1'||!Object.values(POLICY?.rules||{}).every(value=>value===true)) add('policy_contract_or_rules_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest?.source?.policy?.file!==POLICY_FILE||manifest?.source?.policy?.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  if((manifest?.source?.inputSnapshot?.rejections||[]).length||!isSha256(manifest?.source?.inputSnapshot?.contentHash)||!manifest?.source?.inputSnapshot?.directory) add('manifest_input_snapshot_invalid');

  if(audit?.contract!=='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-audit.v1') add('audit_contract_mismatch');
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
  const occurrenceCoverage=audit?.occurrenceCoverage||{};
  if(occurrenceCoverage.exactOccurrenceSetMatch!==true||(occurrenceCoverage.missingOccurrenceKeys||[]).length||(occurrenceCoverage.unexpectedOccurrenceKeys||[]).length||(occurrenceCoverage.duplicateInputOccurrenceKeys||[]).length||(occurrenceCoverage.duplicateOutputOccurrenceKeys||[]).length||(occurrenceCoverage.exactOccurrenceRevalidationFailureKeys||[]).length||(occurrenceCoverage.structuralEvidenceMismatchMemberCandidateKeys||[]).length) add('audit_occurrence_set_invalid');
  const structuralCoverage=audit?.structuralCoverage||{};
  if((structuralCoverage.unbalancedDelimiterOccurrenceKeys||[]).length) add('audit_structural_delimiters_unbalanced');
  const promotion=audit?.semanticPromotionCoverage||{};
  for(const key of ['semanticSubjectBindingCount','canonicalActivityScopeClassificationCount','repeatabilityClassificationCount','memberExpansionReviewedCount','mechanicsReviewedCount','optimizerEligibleCount']) if(Number(promotion[key])!==0) add(`audit_semantic_gate_weakened:${key}`);
  if((promotion.unsupportedPromotionMemberCandidateKeys||[]).length||(audit?.incompleteRecordMemberCandidateKeys||[]).length||(audit?.accountStateFindings||[]).length) add('audit_unsupported_or_incomplete_records_present');
  if(audit?.structuralContextEvidenceAttemptCoverageComplete!==true||audit?.canonicalActivitySubjectDeclarationStructuralContextEvidenceCoverageComplete!==true||audit?.canonicalActivitySubjectBindingReviewComplete!==false||audit?.repeatabilityReviewComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  for(const blocker of ['canonical_activity_subject_declaration_structural_context_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const requests=manifest?.source?.revisionRequests||[];
  const fetched=manifest?.source?.fetchedRevisions||[];
  const requestMap=new Map(),fetchedMap=new Map(),expectedOccurrences=new Set();
  let fetchedBytes=0;
  for(const request of requests) {
    const key=sourceKey(request.sourcePageId,request.sourceRevision);
    if(requestMap.has(key)) add(`duplicate_manifest_revision_request:${key}`); else requestMap.set(key,request);
    if(!Number.isInteger(Number(request.sourcePageId))||!request.resolvedTitle||!Number.isFinite(Date.parse(request.sourceTimestamp))||!String(request.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')||!isSha256(request.sourceContentHash)) add(`manifest_revision_request_invalid:${key}`);
    for(const context of request.occurrenceContexts||[]) {
      const expectedPair=`${context.memberCandidateKey}|${Number(request.sourcePageId)}|${String(request.sourceRevision)}`;
      if(context.candidateEvidenceKey!==expectedPair||!String(context.occurrenceKey||'').startsWith(`${expectedPair}:`)) add(`manifest_occurrence_context_invalid:${key}`);
      if(expectedOccurrences.has(context.occurrenceKey)) add(`duplicate_manifest_occurrence_context:${context.occurrenceKey}`); else expectedOccurrences.add(context.occurrenceKey);
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
  if(new Set(sources.map(sourceIdentity)).size!==sources.length) add('duplicate_exact_source_identity');
  const occurrenceKeys=new Set(),seenRecords=new Set();
  let occurrences=0,revalidated=0,active=0,protectedCount=0,before=0,headings=0,templates=0,links=0,tables=0,lists=0,redirects=0;
  const requiredRecordBlockers=['canonical_activity_subject_declaration_structural_context_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';
    if(seenRecords.has(key)) add(`duplicate_record_key:${key}`); else seenRecords.add(key);
    if(record?.contract!=='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(record?.canonicalGameEntityIdentity!==null||!record?.canonicalActivityIdentity?.canonicalActivityKey||record?.optimizerEligible!==false) add(`record_semantic_gate_weakened:${key}`);
    if(record?.state!=='canonical_activity_subject_declaration_structural_context_evidence_ready_for_semantic_disposition') add(`record_state_invalid:${key}`);
    for(const blocker of requiredRecordBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    if(record?.canonicalActivityIdentityReview?.state!=='reviewed_source_supported'||json(record.canonicalActivityIdentityReview.identity)!==json(record.canonicalActivityIdentity)) add(`record_upstream_canonical_identity_not_preserved:${key}`);
    const evidence=record?.canonicalActivitySubjectDeclarationStructuralContextEvidence||{};
    const observations=record?.canonicalActivitySubjectDeclarationStructuralContextObservations||{};
    const review=record?.canonicalActivitySubjectDeclarationReview||{};
    if(evidence.evidenceChannel!=='revision_pinned_exact_occurrence_structural_parent_inventory'||evidence.evidenceState!=='complete_revision_pinned_subject_declaration_structural_context_evidence_packet'||evidence.canonicalActivityKey!==record.canonicalActivityIdentity.canonicalActivityKey) add(`record_structural_evidence_identity_invalid:${key}`);
    if(review.state!=='unreviewed_structural_context_evidence_collected_semantic_disposition_required'||review.canonicalActivitySubjectDeclarationVerdict!==null||review.canonicalActivityScopeVerdict!==null||review.repeatabilityVerdict!==null||(review.evidenceKeys||[]).length) add(`record_subject_review_gate_weakened:${key}`);
    if(record?.repeatabilityReview?.state!=='reviewed_blocked'||record?.repeatabilityReview?.classification!==null||!(record?.repeatabilityReview?.evidenceKeys||[]).length) add(`record_repeatability_review_not_preserved:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record?.memberExpansionReview?.atomicSubject!==null||(record?.memberExpansionReview?.memberKeys||[]).length||(record?.memberExpansionReview?.evidenceKeys||[]).length) add(`record_member_expansion_gate_weakened:${key}`);
    if(record?.mechanicsReview?.state!=='unreviewed'||(record?.mechanicsReview?.evidenceKeys||[]).length) add(`record_mechanics_gate_weakened:${key}`);
    if(!isSha256(record?.sourceCanonicalActivitySubjectDeclarationExactLineEvidenceContentHash)||!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    if(!Number.isInteger(Number(record?.sourcePageId))||!record?.resolvedTitle||!Number.isFinite(Date.parse(record?.sourceTimestamp))||!String(record?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')||!isSha256(record?.sourceContentHash)) add(`record_primary_source_invalid:${key}`);
    const recordCounts={occurrenceCount:0,exactOccurrenceRevalidatedCount:0,activeSourceOccurrenceCount:0,beforeFirstHeadingCount:0,headingScopedCount:0,templateContainedCount:0,linkContainedCount:0,tableContainedCount:0,listMarkedCount:0,redirectDirectiveCount:0};
    for(const packet of evidence.occurrenceStructuralContextPackets||[]) {
      const occurrenceKey=packet?.occurrenceKey;
      if(occurrenceKeys.has(occurrenceKey)) add(`duplicate_occurrence_key:${occurrenceKey}`); else occurrenceKeys.add(occurrenceKey);
      const source=packet?.sourceRevisionEvidence||{};
      const pairKey=`${key}|${Number(source.sourcePageId)}|${String(source.sourceRevision)}`;
      if(packet.candidateEvidenceKey!==pairKey||!String(occurrenceKey||'').startsWith(`${pairKey}:`)||packet.structuralContextEvidenceKey!==`${occurrenceKey}:structural-context-v1`) add(`record_structural_packet_key_invalid:${occurrenceKey}`);
      if(packet.state!=='complete_revision_pinned_structural_context_evidence'||(packet.deficiencies||[]).length||packet.canonicalActivitySubjectDeclarationVerdict!==null||packet.canonicalActivityScopeVerdict!==null||packet.repeatabilityVerdict!==null) add(`record_structural_packet_gate_invalid:${occurrenceKey}`);
      const request=requestMap.get(sourceKey(source.sourcePageId,source.sourceRevision));
      if(!request||source.resolvedTitle!==request.resolvedTitle||source.sourceTimestamp!==request.sourceTimestamp||source.sourceUrl!==request.sourceUrl||source.sourceContentHash!==request.sourceContentHash||source.completeRevisionContentScanned!==true) add(`record_structural_source_identity_mismatch:${occurrenceKey}`);
      if(!Object.values(packet.sourceRevisionVerification||{}).length||!Object.values(packet.sourceRevisionVerification).every(Boolean)) add(`record_structural_source_verification_invalid:${occurrenceKey}`);
      const exact=packet.sourceExactLineOccurrence||{},again=packet.exactOccurrenceRevalidation||{},context=packet.structuralContext||{};
      for(const flag of ['absoluteOffsetsMatch','lineAndColumnLocatorMatches','exactSourceLinesMatch','exactSourceLinesHashMatches','sourceRegionStateMatches','exactCaseFlagMatches']) if(again[flag]!==true) add(`record_occurrence_revalidation_failed:${occurrenceKey}:${flag}`);
      if(again.actualMatchedText!==exact.matchedText||again.actualExactSourceLines!==exact.exactSourceLines||again.actualExactSourceLinesContentHash!==exact.exactSourceLinesContentHash||json(again.actualSourceLocator)!==json(exact.sourceLocator)||again.actualSourceRegionState!==exact.sourceRegionState) add(`record_occurrence_revalidation_identity_mismatch:${occurrenceKey}`);
      if(exact.canonicalActivitySubjectDeclarationVerdict!==null||exact.canonicalActivityScopeVerdict!==null||exact.repeatabilityVerdict!==null||context.canonicalActivitySubjectDeclarationVerdict!==null||context.canonicalActivityScopeVerdict!==null||context.repeatabilityVerdict!==null||context.semanticUse!=='revision_pinned_structural_observation_requires_semantic_disposition'||context.sourceRegionState!==exact.sourceRegionState) add(`record_structural_context_semantic_gate_weakened:${occurrenceKey}`);
      if(!context.delimiterAudit||!Object.values(context.delimiterAudit).every(Boolean)) add(`record_structural_delimiters_unbalanced:${occurrenceKey}`);
      validateSourceBoundHashes(packet,errors,`packet:${occurrenceKey}`);
      recordCounts.occurrenceCount++;
      recordCounts.exactOccurrenceRevalidatedCount++;
      if(context.sourceRegionState==='active_source_text') recordCounts.activeSourceOccurrenceCount++; else protectedCount++;
      if(context.pagePosition?.beforeFirstHeading===true) recordCounts.beforeFirstHeadingCount++; else recordCounts.headingScopedCount++;
      if((context.enclosingTemplates||[]).length) recordCounts.templateContainedCount++;
      if((context.enclosingLinks||[]).length) recordCounts.linkContainedCount++;
      if(context.enclosingTable) recordCounts.tableContainedCount++;
      if(context.exactLine?.listMarker) recordCounts.listMarkedCount++;
      if(context.exactLine?.startsWithRedirectDirective===true) recordCounts.redirectDirectiveCount++;
    }
    for(const [name,value] of Object.entries(recordCounts)) if(Number(observations[name])!==value) add(`record_structural_observation_count_mismatch:${key}:${name}`);
    if(observations.canonicalActivitySubjectDeclarationVerdict!==null||observations.canonicalActivityScopeVerdict!==null||observations.repeatabilityVerdict!==null||(observations.deficiencies||[]).length) add(`record_structural_observation_gate_invalid:${key}`);
    occurrences+=recordCounts.occurrenceCount; revalidated+=recordCounts.exactOccurrenceRevalidatedCount; active+=recordCounts.activeSourceOccurrenceCount; before+=recordCounts.beforeFirstHeadingCount; headings+=recordCounts.headingScopedCount; templates+=recordCounts.templateContainedCount; links+=recordCounts.linkContainedCount; tables+=recordCounts.tableContainedCount; lists+=recordCounts.listMarkedCount; redirects+=recordCounts.redirectDirectiveCount;
  }
  if(occurrenceKeys.size!==expectedOccurrences.size||[...occurrenceKeys].some(key=>!expectedOccurrences.has(key))) add('record_occurrence_set_mismatch');
  const measured={inputExactLineOccurrenceCount:occurrences,outputStructuralContextPacketCount:occurrences,exactOccurrenceRevalidatedCount:revalidated,activeSourceOccurrenceCount:active,protectedOrMixedOccurrenceCount:protectedCount,beforeFirstHeadingCount:before,headingScopedCount:headings,templateContainedCount:templates,linkContainedCount:links,tableContainedCount:tables,listMarkedCount:lists,redirectDirectiveCount:redirects};
  for(const key of ['inputExactLineOccurrenceCount','outputStructuralContextPacketCount','exactOccurrenceRevalidatedCount']) if(Number(occurrenceCoverage[key])!==measured[key]) add(`audit_occurrence_count_mismatch:${key}`);
  for(const key of ['activeSourceOccurrenceCount','protectedOrMixedOccurrenceCount','beforeFirstHeadingCount','headingScopedCount','templateContainedCount','linkContainedCount','tableContainedCount','listMarkedCount','redirectDirectiveCount']) if(Number(structuralCoverage[key])!==measured[key]) add(`audit_structural_count_mismatch:${key}`);
  if(errors.length) throw new Error(`Activity reference-member subject structural-context materialization input rejected: ${unique(errors).join(', ')}`);

  const statements=records.map(compactStatement);
  const model={
    contract:ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_MATERIALIZATION_CONTRACT,
    domain:ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_INPUT_DOMAIN,
    snapshotDirectory:audit.outputSnapshot.directory,
    snapshotCreatedAt:manifest.createdAt,
    snapshotContentHash:manifest.contentHash,
    auditContentHash:audit.contentHash,
    sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),
    sources,records,statements,skillKeys:[],
    counts:{sources:sources.length,records:records.length,statements:statements.length,occurrences,revalidatedOccurrences:revalidated,activeOccurrences:active,protectedOccurrences:protectedCount,beforeFirstHeadingOccurrences:before,headingScopedOccurrences:headings,templateContainedOccurrences:templates,linkContainedOccurrences:links,tableContainedOccurrences:tables,listMarkedOccurrences:lists,redirectDirectiveOccurrences:redirects},
    gates:{structuralContextEvidencePacketCoverageComplete:true,canonicalActivitySubjectBindingReviewComplete:false,canonicalActivityScopeReviewComplete:false,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}
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

export function buildActivityReferenceMemberSubjectStructuralContextMaterializationSql(model) {
  assert(model?.contract===ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_MATERIALIZATION_CONTRACT,'materialization_contract_mismatch');
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
    `INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`Accepted canonical-activity subject structural-context review evidence ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson(validationSummary)}) ON CONFLICT (manifest_hash) DO NOTHING;`,
    `INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.sourceRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(materializationMetrics)}) ON CONFLICT (id) DO NOTHING;`,
    "INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,provider_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",
    `INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,
    `INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,
    `INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,
    buildLineageInsertAndReconciliationSql(model,ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND),
    `DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson(validationSummary)}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.sourceRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(materializationMetrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON ${exactWikiSourceReconciliationPredicate()}; IF actual<>${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual<>${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}')<>${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual<>${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}')<>${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual<>${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed'; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '"optimizerEligible"[[:space:]]*:[[:space:]]*true' OR r.payload::text ~* '"canonicalActivitySubjectDeclarationVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"canonicalActivityScopeVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"repeatabilityClassification"[[:space:]]*:[[:space:]]*"') THEN RAISE EXCEPTION 'ingestion structural-context semantic gate weakened'; END IF; END $$;`,
    'COMMIT;'
  ].join('\n')+'\n';
}

export function buildActivityReferenceMemberSubjectStructuralContextExistingSourceCountQuery(model) { return buildExistingExactWikiSourceCountQuery(model.sources); }
export function buildActivityReferenceMemberSubjectStructuralContextReconciliationQuery(model) {
  return `SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM activity_evidence a JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}' WHERE a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND}'),'lineage',(SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE ingestion_run_id='${model.runId}'),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`;
}
export function verifyActivityReferenceMemberSubjectStructuralContextReconciliation(model,actual) {
  assert(actual?.runId===model.runId,'reconciliation_run_id_mismatch');
  assert(actual?.status==='published','reconciliation_run_not_published');
  for(const key of ['records','sources','statements']) assert(Number(actual?.[key])===model.counts[key],`reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage)===model.counts.statements,'reconciliation_lineage_count_mismatch');
  assert(actual?.snapshotComplete===false,'subject_structural_context_evidence_snapshot_must_not_claim_complete_world_knowledge');
  for(const [key,value] of [['recordHashAggregate',model.recordHashAggregate],['sourceHashAggregate',model.sourceHashAggregate],['statementHashAggregate',model.statementHashAggregate],['materializationHash',model.materializationHash]]) assert(actual?.metrics?.[key]===value,`reconciliation_${key}_mismatch`);
  assert(actual?.metrics?.structuralContextEvidencePacketCoverageComplete===true&&actual?.metrics?.canonicalActivitySubjectBindingReviewComplete===false&&actual?.metrics?.canonicalActivityScopeReviewComplete===false&&actual?.metrics?.repeatabilityReviewComplete===false&&actual?.metrics?.memberExpansionReviewComplete===false&&actual?.metrics?.mechanicsReviewComplete===false&&actual?.metrics?.completeActivityUniverse===false&&Number(actual?.metrics?.optimizerEligibleRecords)===0&&actual?.metrics?.automaticVerification===false&&actual?.metrics?.semanticReviewRequired===true,'reconciliation_semantic_gate_weakened');
  return true;
}
