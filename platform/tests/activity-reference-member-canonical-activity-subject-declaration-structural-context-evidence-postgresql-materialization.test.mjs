import test from 'node:test';
import assert from 'node:assert/strict';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND,
  buildActivityReferenceMemberSubjectStructuralContextExistingSourceCountQuery,
  buildActivityReferenceMemberSubjectStructuralContextMaterializationSql,
  validateActivityReferenceMemberSubjectStructuralContextMaterializationInput,
  verifyActivityReferenceMemberSubjectStructuralContextReconciliation
} from '../db/activity-reference-member-canonical-activity-subject-declaration-structural-context-evidence-materialization-lib.mjs';

const POLICY_ID='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-v1.json';
const POLICY_HASH='3141cacc5cb3823314be85f8c6cd5920f570dad246a18dee8097728a2708bb2c';
const requiredAuditBlockers=['canonical_activity_subject_declaration_structural_context_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'];
const requiredRecordBlockers=['canonical_activity_subject_declaration_structural_context_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));

function fixture() {
  const memberCandidateKey='member:1',canonicalActivityKey='activity:example';
  const source={sourceRevision:'123',sourcePageId:42,resolvedTitle:'Example activity',sourceTimestamp:'2026-09-01T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:'a'.repeat(64)};
  const candidateEvidenceKey=`${memberCandidateKey}|42|123`;
  const occurrenceKey=`${candidateEvidenceKey}:2:16`;
  const exactSourceLines='* [[Example activity]]';
  const sourceLocator={absoluteOffsetEnd:21,absoluteOffsetStart:2,columnEnd:22,columnStart:3,lineEnd:1,lineStart:1};
  const sourceExactLineOccurrence={canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,exactSourceLines,exactSourceLinesContentHash:hash(exactSourceLines),matchedText:'Example activity',repeatabilityVerdict:null,sourceLocator,sourceRegionState:'active_source_text'};
  const structuralContext={canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,delimiterAudit:{linksBalanced:true,templatesBalanced:true},enclosingLinks:[{displayText:'Example activity',target:'Example activity'}],enclosingTable:{sourceTableOrdinal:1},enclosingTemplates:[{templateKey:'example'}],exactLine:{listMarker:'*',startsWithRedirectDirective:false},pagePosition:{beforeFirstHeading:true},repeatabilityVerdict:null,semanticUse:'revision_pinned_structural_observation_requires_semantic_disposition',sourceRegionState:'active_source_text'};
  const packet={candidateEvidenceKey,canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,deficiencies:[],exactOccurrenceRevalidation:{absoluteOffsetsMatch:true,actualExactSourceLines:exactSourceLines,actualExactSourceLinesContentHash:hash(exactSourceLines),actualMatchedText:'Example activity',actualSourceLocator:sourceLocator,actualSourceRegionState:'active_source_text',exactCaseFlagMatches:true,exactSourceLinesHashMatches:true,exactSourceLinesMatch:true,lineAndColumnLocatorMatches:true,sourceRegionStateMatches:true},occurrenceKey,repeatabilityVerdict:null,sourceExactLineOccurrence,sourceRevisionEvidence:{...source,completeRevisionContentScanned:true},sourceRevisionVerification:{contentHashMatches:true,pageIdMatches:true,revisionMatches:true,timestampMatches:true,titleMatches:true,urlMatches:true},state:'complete_revision_pinned_structural_context_evidence',structuralContext,structuralContextEvidenceKey:`${occurrenceKey}:structural-context-v1`};
  const identity={canonicalActivityKey,canonicalLabel:'Example activity',evidenceKeys:['identity:1'],evidenceRevisionBoundary:{collectionRevision:'456',linkedSourceRevision:'123'},identityClass:'fixture_activity',linkedSubjectIsCanonicalActivity:false,stableIdentityAnchor:{canonicalActivityKey,collectionPageId:1,linkedSubjectPageId:42,relationshipClass:'fixture'}};
  const record={accountIndependent:true,blockers:requiredRecordBlockers,canonicalActivityIdentity:identity,canonicalActivityIdentityReview:{evidenceKeys:['identity:1'],identity,state:'reviewed_source_supported'},canonicalActivitySubjectDeclarationReview:{canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,evidenceKeys:[],repeatabilityVerdict:null,state:'unreviewed_structural_context_evidence_collected_semantic_disposition_required'},canonicalActivitySubjectDeclarationStructuralContextEvidence:{canonicalActivityKey,evidenceChannel:'revision_pinned_exact_occurrence_structural_parent_inventory',evidenceState:'complete_revision_pinned_subject_declaration_structural_context_evidence_packet',occurrenceStructuralContextPackets:[packet]},canonicalActivitySubjectDeclarationStructuralContextObservations:{activeSourceOccurrenceCount:1,beforeFirstHeadingCount:1,canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,deficiencies:[],exactOccurrenceRevalidatedCount:1,headingScopedCount:0,linkContainedCount:1,listMarkedCount:1,occurrenceCount:1,redirectDirectiveCount:0,repeatabilityVerdict:null,tableContainedCount:1,templateContainedCount:1},canonicalGameEntityIdentity:null,contract:'sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence.v1',mechanicsReview:{evidenceKeys:[],state:'unreviewed'},memberCandidateKey,memberExpansionReview:{atomicSubject:null,evidenceKeys:[],memberKeys:[],state:'unreviewed'},optimizerEligible:false,repeatabilityReview:{classification:null,evidenceKeys:['repeatability:blocked:1'],state:'reviewed_blocked'},resolvedTitle:source.resolvedTitle,sourceCanonicalActivitySubjectDeclarationExactLineEvidenceContentHash:'c'.repeat(64),sourceContentHash:source.sourceContentHash,sourcePageId:source.sourcePageId,sourceRevision:source.sourceRevision,sourceTimestamp:source.sourceTimestamp,sourceUrl:source.sourceUrl,state:'canonical_activity_subject_declaration_structural_context_evidence_ready_for_semantic_disposition'};
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n',directory='2026-09-05T02-31-01-502Z';
  const inputSnapshot={directory:'upstream',contentHash:'b'.repeat(64),rejections:[]};
  const coreAudit={contract:'sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-audit.v1',accountIndependent:true,inputCoverage:{expectedRecordCount:1,outputRecordCount:1,duplicateInputMemberCandidateKeys:[],duplicateOutputMemberCandidateKeys:[],missingMemberCandidateKeys:[],unexpectedMemberCandidateKeys:[],contextMismatchMemberCandidateKeys:[]},policyCoverage:{policyId:POLICY_ID,invalidRules:[],forbiddenPolicyPaths:[]},revisionCoverage:{requestedExactRevisionCount:1,fetchedExactRevisionCount:1,missingRevisionIds:[],unexpectedRevisionIds:[],duplicateFetchedRevisionIds:[],totalFetchedSourceBytes:100,exactRevisionFetchSetMatch:true},occurrenceCoverage:{inputExactLineOccurrenceCount:1,outputStructuralContextPacketCount:1,missingOccurrenceKeys:[],unexpectedOccurrenceKeys:[],duplicateInputOccurrenceKeys:[],duplicateOutputOccurrenceKeys:[],exactOccurrenceSetMatch:true,exactOccurrenceRevalidatedCount:1,exactOccurrenceRevalidationFailureKeys:[],structuralEvidenceMismatchMemberCandidateKeys:[]},structuralCoverage:{activeSourceOccurrenceCount:1,protectedOrMixedOccurrenceCount:0,beforeFirstHeadingCount:1,headingScopedCount:0,templateContainedCount:1,linkContainedCount:1,tableContainedCount:1,listMarkedCount:1,redirectDirectiveCount:0,unbalancedDelimiterOccurrenceKeys:[]},semanticPromotionCoverage:{unsupportedPromotionMemberCandidateKeys:[],semanticSubjectBindingCount:0,canonicalActivityScopeClassificationCount:0,repeatabilityClassificationCount:0,memberExpansionReviewedCount:0,mechanicsReviewedCount:0,optimizerEligibleCount:0},incompleteRecordMemberCandidateKeys:[],accountStateFindings:[],structuralContextEvidenceAttemptCoverageComplete:true,canonicalActivitySubjectDeclarationStructuralContextEvidenceCoverageComplete:true,canonicalActivitySubjectBindingReviewComplete:false,repeatabilityReviewComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:requiredAuditBlockers,publishable:true};
  const audit={...structuredClone(coreAudit),generatedAt:'2026-09-05T02:31:01.656Z',policy:{id:POLICY_ID,file:POLICY_FILE,contentHash:POLICY_HASH},inputSnapshot,outputSnapshot:{directory,contentHash:hash(raw)}};
  audit.contentHash=hash(audit);
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence',createdAt:'2026-09-05T02:31:01.502Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_exact_occurrence_structural_parent_inventory_without_semantic_or_downstream_promotion',api:'https://oldschool.runescape.wiki/api.php',policy:{id:POLICY_ID,file:POLICY_FILE,contentHash:POLICY_HASH},inputSnapshot,revisionRequests:[{...source,occurrenceContexts:[{memberCandidateKey,candidateEvidenceKey,occurrenceKey}]}],fetchedRevisions:[{pageId:42,title:source.resolvedTitle,revision:source.sourceRevision,timestamp:source.sourceTimestamp,contentHash:source.sourceContentHash,sourceContentBytes:100}],audit:coreAudit}};
  return {raw,manifest,audit,record};
}

function rehash(input) {
  input.record.contentHash=hash(without(input.record,'contentHash'));
  input.raw=JSON.stringify(input.record)+'\n';
  input.manifest.contentHash=hash(input.raw);
  input.audit.outputSnapshot.contentHash=input.manifest.contentHash;
  input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('structural-context review evidence remains lossless, candidate-only, and deterministic',()=>{
  const input=fixture(),first=validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(input),second=validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:1,records:1,statements:1,occurrences:1,revalidatedOccurrences:1,activeOccurrences:1,protectedOccurrences:0,beforeFirstHeadingOccurrences:1,headingScopedOccurrences:0,templateContainedOccurrences:1,linkContainedOccurrences:1,tableContainedOccurrences:1,listMarkedOccurrences:1,redirectDirectiveOccurrences:0});
  assert.equal(first.records[0].contentHash,input.record.contentHash);
  assert.equal(first.statements[0].payload.canonicalActivitySubjectDeclarationVerdict,null);
  assert.equal(first.statements[0].payload.canonicalActivityScopeVerdict,null);
  assert.equal(first.statements[0].payload.repeatabilityClassification,null);
  assert.equal(first.statements[0].payload.optimizerEligible,false);
});

test('structural-context tampering, account state, semantic promotion, and source-line drift fail closed',()=>{
  const rawTamper=fixture(); rawTamper.raw=rawTamper.raw.replace('Example activity','Changed activity');
  assert.throws(()=>validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(rawTamper),/snapshot_content_hash_mismatch/);
  const account=fixture(); account.record.currentBaseLevel=34; rehash(account);
  assert.throws(()=>validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(account),/record_account_state_present/);
  const promoted=fixture(); promoted.record.canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict='activity_subject'; rehash(promoted);
  assert.throws(()=>validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(promoted),/record_subject_review_gate_weakened/);
  const lineTamper=fixture(); lineTamper.record.canonicalActivitySubjectDeclarationStructuralContextEvidence.occurrenceStructuralContextPackets[0].sourceExactLineOccurrence.exactSourceLines='changed'; rehash(lineTamper);
  assert.throws(()=>validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(lineTamper),/structural_exact_lines_hash_mismatch/);
  const revalidation=fixture(); revalidation.record.canonicalActivitySubjectDeclarationStructuralContextEvidence.occurrenceStructuralContextPackets[0].exactOccurrenceRevalidation.actualMatchedText='Changed activity'; rehash(revalidation);
  assert.throws(()=>validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(revalidation),/record_occurrence_revalidation_identity_mismatch/);
});

test('structural-context SQL is transactional, insert-only, lineage-complete, and source-reuse safe',()=>{
  const model=validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(fixture()),sql=buildActivityReferenceMemberSubjectStructuralContextMaterializationSql(model),reuse=buildActivityReferenceMemberSubjectStructuralContextExistingSourceCountQuery(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND));
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);
  assert.match(sql,/d\.fetched_at IS NOT NULL/);
  assert.match(reuse,/d\.published_at=e\.published_at/);
  assert.match(reuse,/d\.content_hash=e\.content_hash/);
});

test('structural-context reconciliation rejects count, hash, state, and semantic drift',()=>{
  const model=validateActivityReferenceMemberSubjectStructuralContextMaterializationInput(fixture());
  const actual={runId:model.runId,status:'published',records:1,sources:1,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyActivityReferenceMemberSubjectStructuralContextReconciliation(model,actual),true);
  assert.throws(()=>verifyActivityReferenceMemberSubjectStructuralContextReconciliation(model,{...actual,sources:0}),/sources_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberSubjectStructuralContextReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberSubjectStructuralContextReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivityReferenceMemberSubjectStructuralContextReconciliation(model,{...actual,metrics:{...actual.metrics,canonicalActivitySubjectBindingReviewComplete:true}}),/semantic_gate_weakened/);
});
