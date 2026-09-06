import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND,
  buildActivityReferenceMemberSubjectExactLineExistingSourceCountQuery,
  buildActivityReferenceMemberSubjectExactLineMaterializationSql,
  validateActivityReferenceMemberSubjectExactLineMaterializationInput,
  verifyActivityReferenceMemberSubjectExactLineReconciliation
} from '../db/activity-reference-member-canonical-activity-subject-declaration-exact-line-evidence-materialization-lib.mjs';

const POLICY_ID='sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-v1.json';
const POLICY_HASH='a7d83015f9bfae25bc84fa0b4caed01824bde5e7063a68473e8e30f4881b51a5';
const requiredAuditBlockers=['canonical_activity_subject_declaration_exact_line_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'];
const requiredRecordBlockers=['canonical_activity_subject_declaration_exact_line_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));

function fixture() {
  const memberCandidateKey='member:1',canonicalActivityKey='activity:example',exactPhrase='Example activity';
  const source={sourceRevision:'123',sourcePageId:42,resolvedTitle:'Example activity',sourceTimestamp:'2026-09-01T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:'a'.repeat(64)};
  const candidatePairKey=`${memberCandidateKey}|42|123`;
  const occurrence={canonicalActivityLabelExactCaseMatch:true,canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,exactSourceLines:'[[Example activity]]',matchedText:exactPhrase,occurrenceKey:`${candidatePairKey}:2:16`,repeatabilityVerdict:null,semanticUse:'active_exact_phrase_occurrence_requires_semantic_subject_and_scope_review',sourceLocator:{absoluteOffsetEnd:17,absoluteOffsetStart:2,columnEnd:18,columnStart:3,lineEnd:1,lineStart:1},sourceRegionState:'active_source_text',structuralObservations:{lineStartsWithHeadingMarkup:false,lineStartsWithTableMarkup:false,lineStartsWithTemplateMarkup:false,sourceAuthoredLinkOccurrenceKeysOnExactLines:['source:link:1']}};
  occurrence.exactSourceLinesContentHash=hash(occurrence.exactSourceLines);
  const identity={canonicalActivityKey,canonicalLabel:exactPhrase,evidenceKeys:['identity:1'],evidenceRevisionBoundary:{collectionRevision:'456',linkedSourceRevision:'123'},identityClass:'fixture_activity',linkedSubjectIsCanonicalActivity:false,stableIdentityAnchor:{canonicalActivityKey,collectionPageId:1,linkedSubjectPageId:42,relationshipClass:'fixture'}};
  const packet={activeSourceOccurrenceCount:1,candidateEvidenceKey:candidatePairKey,canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,deficiencies:[],discoveryCandidate:{canonicalActivityScopeVerdict:null,deficiencies:[],observedPageId:42,observedTitle:'Example activity',rank:1,repeatabilityVerdict:null,resolution:{redirected:false,requestedTitle:'Example activity',resolvedPageId:42,resolvedTitle:'Example activity',state:'eligible_revision_pinned_candidate'},resultSize:100,resultSnippet:'Example activity',resultTimestamp:source.sourceTimestamp,resultWordCount:2,revisionEvidence:{completeRevisionContentScanned:true,resolvedTitle:source.resolvedTitle,sourceContentBytes:100,sourceContentHash:source.sourceContentHash,sourcePageId:source.sourcePageId,sourceRevision:source.sourceRevision,sourceTimestamp:source.sourceTimestamp,sourceUrl:source.sourceUrl},semanticUse:'candidate_source_discovery_only_requires_exact_declaration_extraction_and_review',state:'revision_pinned_subject_declaration_candidate_source',subjectDeclarationVerdict:null},exactPhrase,exactPhraseOccurrences:[occurrence],matchMode:'unicode_case_insensitive_literal_phrase',protectedOrMixedOccurrenceCount:0,rawOccurrenceCount:1,repeatabilityVerdict:null,sourceLinkDelimiterAudit:{balancedSourceLinkDelimiters:true,guidePageId:42,guideRevision:'123',parsedOccurrenceCount:1,sourceCloseCount:1,sourceOpenCount:1},sourceRevisionVerification:{fetchedContentHashMatchesCandidate:true,fetchedPageIdMatchesCandidate:true,fetchedPagePresent:true,fetchedRevisionContentPresent:true,fetchedRevisionMatchesCandidate:true,fetchedTimestampMatchesCandidate:true,fetchedTitleMatchesCandidate:true,fetchedUrlMatchesCandidate:true,upstreamCompleteRevisionScanConfirmed:true},state:'complete_revision_pinned_exact_phrase_occurrence_inventory'};
  const record={accountIndependent:true,blockers:requiredRecordBlockers,canonicalActivityIdentity:identity,canonicalActivityIdentityReview:{evidenceKeys:['identity:1'],identity,state:'reviewed_source_supported'},canonicalActivitySubjectDeclarationExactLineEvidence:{candidateEvidencePackets:[packet],canonicalActivityKey,evidenceChannel:'complete_exact_revision_source_phrase_occurrence_inventory',evidenceState:'complete_revision_pinned_subject_declaration_exact_line_evidence_packet',exactPhrase},canonicalActivitySubjectDeclarationExactLineObservations:{activeSourceOccurrenceCount:1,candidateSourceCount:1,canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,deficiencies:[],exactRevisionAlignedCandidateCount:1,protectedOrMixedOccurrenceCount:0,rawOccurrenceCount:1,repeatabilityVerdict:null},canonicalActivitySubjectDeclarationReview:{canonicalActivityScopeVerdict:null,canonicalActivitySubjectDeclarationVerdict:null,evidenceKeys:[],repeatabilityVerdict:null,state:'unreviewed_exact_line_evidence_collected_semantic_disposition_required'},canonicalGameEntityIdentity:null,contract:'sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence.v1',mechanicsReview:{evidenceKeys:[],state:'unreviewed'},memberCandidateKey,memberExpansionReview:{atomicSubject:null,evidenceKeys:[],memberKeys:[],state:'unreviewed'},optimizerEligible:false,repeatabilityReview:{classification:null,evidenceKeys:['repeatability:blocked:1'],state:'reviewed_blocked'},resolvedTitle:source.resolvedTitle,sourceContentHash:source.sourceContentHash,sourcePageId:source.sourcePageId,sourceRevision:source.sourceRevision,sourceTimestamp:source.sourceTimestamp,sourceUrl:source.sourceUrl,state:'canonical_activity_subject_declaration_exact_line_evidence_ready_for_semantic_disposition'};
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n',directory='2026-09-05T02-09-27-348Z';
  const inputSnapshot={directory:'upstream',contentHash:'b'.repeat(64),rejections:[]};
  const coreAudit={contract:'sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-audit.v1',accountIndependent:true,inputCoverage:{expectedRecordCount:1,outputRecordCount:1,duplicateInputMemberCandidateKeys:[],duplicateOutputMemberCandidateKeys:[],missingMemberCandidateKeys:[],unexpectedMemberCandidateKeys:[],contextMismatchMemberCandidateKeys:[]},policyCoverage:{policyId:POLICY_ID,invalidRules:[],forbiddenPolicyPaths:[]},revisionCoverage:{requestedExactRevisionCount:1,fetchedExactRevisionCount:1,missingRevisionIds:[],unexpectedRevisionIds:[],duplicateFetchedRevisionIds:[],totalFetchedSourceBytes:100,exactRevisionFetchSetMatch:true},candidateCoverage:{inputCandidatePairCount:1,outputCandidatePacketCount:1,missingCandidatePairs:[],unexpectedCandidatePairs:[],duplicateInputCandidatePairs:[],duplicateOutputCandidatePairs:[],exactCandidatePairSetMatch:true,exactRevisionAlignedCandidateCount:1,incompleteCandidatePacketCount:0},occurrenceCoverage:{rawExactPhraseOccurrenceCount:1,activeSourceOccurrenceCount:1,protectedOrMixedOccurrenceCount:0,exactCaseOccurrenceCount:1,duplicateOccurrenceKeys:[],evidenceMismatchMemberCandidateKeys:[]},semanticPromotionCoverage:{unsupportedPromotionMemberCandidateKeys:[],semanticSubjectBindingCount:0,canonicalActivityScopeClassificationCount:0,repeatabilityClassificationCount:0,memberExpansionReviewedCount:0,mechanicsReviewedCount:0,optimizerEligibleCount:0},incompleteRecordMemberCandidateKeys:[],accountStateFindings:[],exactLineEvidenceAttemptCoverageComplete:true,canonicalActivitySubjectDeclarationExactLineEvidenceCoverageComplete:true,canonicalActivitySubjectBindingReviewComplete:false,repeatabilityReviewComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:requiredAuditBlockers,publishable:true};
  const audit={...structuredClone(coreAudit),generatedAt:'2026-09-05T02:09:27.481Z',policy:{id:POLICY_ID,file:POLICY_FILE,contentHash:POLICY_HASH},inputSnapshot,outputSnapshot:{directory,contentHash:hash(raw)}};
  audit.contentHash=hash(audit);
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence',createdAt:'2026-09-05T02:09:27.348Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_complete_source_exact_canonical_activity_phrase_occurrence_inventory_without_semantic_or_downstream_promotion',api:'https://oldschool.runescape.wiki/api.php',policy:{id:POLICY_ID,file:POLICY_FILE,contentHash:POLICY_HASH},inputSnapshot,revisionRequests:[{...source,candidateContexts:[{memberCandidateKey,canonicalActivityKey,exactPhrase,candidatePairKey}]}],fetchedRevisions:[{pageId:42,title:source.resolvedTitle,revision:source.sourceRevision,timestamp:source.sourceTimestamp,contentHash:source.sourceContentHash,sourceContentBytes:100}],audit:coreAudit}};
  return {raw,manifest,audit,record};
}

function rehash(input) {
  input.record.contentHash=hash(without(input.record,'contentHash'));
  input.raw=JSON.stringify(input.record)+'\n';
  input.manifest.contentHash=hash(input.raw);
  input.audit.outputSnapshot.contentHash=input.manifest.contentHash;
  input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('exact-line review evidence remains lossless, candidate-only, and deterministic',()=>{
  const input=fixture(),first=validateActivityReferenceMemberSubjectExactLineMaterializationInput(input),second=validateActivityReferenceMemberSubjectExactLineMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:1,records:1,statements:1,candidatePackets:1,rawOccurrences:1,activeOccurrences:1,protectedOccurrences:0,exactCaseOccurrences:1});
  assert.equal(first.records[0].contentHash,input.record.contentHash);
  assert.equal(first.statements[0].payload.canonicalActivitySubjectDeclarationVerdict,null);
  assert.equal(first.statements[0].payload.canonicalActivityScopeVerdict,null);
  assert.equal(first.statements[0].payload.repeatabilityClassification,null);
  assert.equal(first.statements[0].payload.optimizerEligible,false);
});

test('exact-line tampering, account state, semantic promotion, and broken occurrence hashes fail closed',()=>{
  const rawTamper=fixture(); rawTamper.raw=rawTamper.raw.replace('Example activity','Changed activity');
  assert.throws(()=>validateActivityReferenceMemberSubjectExactLineMaterializationInput(rawTamper),/snapshot_content_hash_mismatch/);
  const account=fixture(); account.record.currentBaseLevel=34; rehash(account);
  assert.throws(()=>validateActivityReferenceMemberSubjectExactLineMaterializationInput(account),/record_account_state_present/);
  const promoted=fixture(); promoted.record.canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict='activity_subject'; rehash(promoted);
  assert.throws(()=>validateActivityReferenceMemberSubjectExactLineMaterializationInput(promoted),/record_subject_review_gate_weakened/);
  const lineTamper=fixture(); lineTamper.record.canonicalActivitySubjectDeclarationExactLineEvidence.candidateEvidencePackets[0].exactPhraseOccurrences[0].exactSourceLines='changed'; rehash(lineTamper);
  assert.throws(()=>validateActivityReferenceMemberSubjectExactLineMaterializationInput(lineTamper),/occurrence_text_or_hash_invalid/);
});

test('exact-line SQL is transactional, insert-only, lineage-complete, and source-reuse safe',()=>{
  const model=validateActivityReferenceMemberSubjectExactLineMaterializationInput(fixture()),sql=buildActivityReferenceMemberSubjectExactLineMaterializationSql(model),reuse=buildActivityReferenceMemberSubjectExactLineExistingSourceCountQuery(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND));
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

test('exact-line reconciliation rejects count, hash, state, and semantic drift',()=>{
  const model=validateActivityReferenceMemberSubjectExactLineMaterializationInput(fixture());
  const actual={runId:model.runId,status:'published',records:1,sources:1,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyActivityReferenceMemberSubjectExactLineReconciliation(model,actual),true);
  assert.throws(()=>verifyActivityReferenceMemberSubjectExactLineReconciliation(model,{...actual,sources:0}),/sources_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberSubjectExactLineReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberSubjectExactLineReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivityReferenceMemberSubjectExactLineReconciliation(model,{...actual,metrics:{...actual.metrics,canonicalActivitySubjectBindingReviewComplete:true}}),/semantic_gate_weakened/);
});
