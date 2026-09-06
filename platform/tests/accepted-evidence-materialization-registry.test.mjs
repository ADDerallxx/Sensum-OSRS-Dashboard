import assert from 'node:assert/strict';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  acceptedEvidenceDomains,
  getAcceptedEvidenceAdapter
} from '../db/accepted-evidence-materialization-registry-lib.mjs';
import {
  buildActivitySubjectScopeExistingSourceCountQuery,
  buildActivitySubjectScopeMaterializationSql,
  validateActivitySubjectScopeMaterializationInput,
  verifyActivitySubjectScopeReconciliation
} from '../db/activity-subject-scope-materialization-lib.mjs';
import {
  buildWeightedParentTaskMembershipExistingSourceCountQuery,
  buildWeightedParentTaskMembershipMaterializationSql,
  validateWeightedParentTaskMembershipMaterializationInput,
  verifyWeightedParentTaskMembershipReconciliation
} from '../db/weighted-parent-task-membership-materialization-lib.mjs';

function fixture() {
  const record = {
    contract:'sensum.activity-canonical-subject-scope-evidence.v1',
    accountIndependent:true,
    memberCandidateKey:'collection-row:1:2:activities:1:1',
    resolvedTitle:'Example activity',
    sourcePageId:42,
    sourceRevision:'123',
    sourceTimestamp:'2026-09-01T00:00:00Z',
    sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',
    sourceContentHash:'a'.repeat(64),
    canonicalActivityIdentity:{canonicalActivityKey:'activity:example'},
    optimizerEligible:false,
    state:'canonical_activity_scope_evidence_ready_for_semantic_disposition',
    blockers:['canonical_activity_scope_evidence_requires_semantic_disposition']
  };
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n';
  const directory='2026-09-01T00-00-00-000Z';
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'activity-canonical-subject-scope-evidence',createdAt:'2026-09-01T00:00:00Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_complete_canonical_activity_subject_source_and_structural_scope_observations_without_scope_or_repeatability_verdict',api:'https://oldschool.runescape.wiki/api.php',revisionRequests:[{sourceRevision:'123',sourcePageId:42,resolvedTitle:'Example activity',sourceTimestamp:'2026-09-01T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:'a'.repeat(64)}],fetchedRevisions:[{pageId:42,title:'Example activity',revision:'123',timestamp:'2026-09-01T00:00:00Z',contentHash:'a'.repeat(64)}]}};
  const audit={contract:'sensum.activity-canonical-subject-scope-evidence-audit.v1',accountIndependent:true,inputSnapshot:{directory:'upstream',contentHash:'b'.repeat(64),rejections:[]},outputSnapshot:{directory,contentHash:manifest.contentHash},inputCoverage:{evidenceRecordCount:1,exactInputOutputSetAndContextMatch:true},revisionCoverage:{exactRevisionFetchSetMatch:true,incompleteSources:[]},semanticPromotionCoverage:{optimizerEligibleCount:0},evidencePacketAttemptCoverageComplete:true,canonicalActivityScopeEvidenceCoverageComplete:true,canonicalActivityScopeReviewComplete:false,repeatabilityReviewComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',publishable:true,contentHash:'c'.repeat(64)};
  audit.contentHash=hash(Object.fromEntries(Object.entries(audit).filter(([name])=>name!=='contentHash')));
  return {raw,manifest,audit,record};
}

test('registry exposes all accepted evidence adapters and rejects unknown domains',()=>{
  assert.deepEqual(acceptedEvidenceDomains(),['activity-candidate-source-evidence','activity-canonical-subject-scope-evidence','activity-reference-collection-member-canonical-activity-identity-evidence','activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence','activity-reference-collection-member-collection-activity-identity-evidence','activity-reference-collection-member-repeatability-evidence','activity-reference-collection-member-source-evidence','activity-reference-collection-member-unresolved-subject-relationship-evidence','skill-level-unlock-inventory','weighted-parent-task-entry-membership-evidence']);
  assert.equal(getAcceptedEvidenceAdapter('activity-candidate-source-evidence').dataFile,'activity-candidate-source-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('activity-candidate-source-evidence').factKind,'raw_activity_candidate_source_evidence');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-source-evidence').dataFile,'activity-reference-collection-member-source-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-source-evidence').factKind,'raw_activity_reference_collection_member_source_evidence');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-canonical-activity-identity-evidence').dataFile,'activity-reference-collection-member-canonical-activity-identity-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-canonical-activity-identity-evidence').factKind,'raw_activity_reference_member_canonical_activity_identity_evidence');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-collection-activity-identity-evidence').dataFile,'activity-reference-collection-member-collection-activity-identity-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-collection-activity-identity-evidence').factKind,'raw_activity_reference_member_collection_activity_identity_evidence');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-repeatability-evidence').dataFile,'activity-reference-collection-member-repeatability-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-repeatability-evidence').factKind,'raw_activity_reference_member_repeatability_evidence');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-unresolved-subject-relationship-evidence').dataFile,'activity-reference-collection-member-unresolved-subject-relationship-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-unresolved-subject-relationship-evidence').factKind,'raw_activity_reference_member_unresolved_subject_relationship_evidence');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence').dataFile,'activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence').factKind,'raw_activity_reference_member_canonical_activity_subject_declaration_exact_line_evidence');
  assert.equal(getAcceptedEvidenceAdapter('activity-canonical-subject-scope-evidence').dataFile,'activity-canonical-subject-scope-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('activity-canonical-subject-scope-evidence').factKind,'raw_activity_canonical_subject_scope_evidence');
  assert.equal(getAcceptedEvidenceAdapter('weighted-parent-task-entry-membership-evidence').dataFile,'weighted-parent-task-entry-membership-evidence.ndjson');
  assert.equal(getAcceptedEvidenceAdapter('skill-level-unlock-inventory').factKind,'raw_skill_level_unlock_statement');
  assert.throws(()=>getAcceptedEvidenceAdapter('made-up-domain'),/unsupported_accepted_evidence_domain/);
});

test('second-domain evidence remains lossless, candidate-only, and deterministic',()=>{
  const input=fixture(),first=validateActivitySubjectScopeMaterializationInput(input),second=validateActivitySubjectScopeMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:1,records:1,statements:1});
  assert.equal(first.records[0].contentHash,input.record.contentHash);
  assert.deepEqual(first.gates,{completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true});
  assert.equal(first.statements[0].payload.optimizerEligible,false);
});

test('second-domain tampering, account state, and optimizer promotion fail closed',()=>{
  const tampered=fixture(); tampered.raw=tampered.raw.replace('Example activity','Changed activity');
  assert.throws(()=>validateActivitySubjectScopeMaterializationInput(tampered),/snapshot_content_hash_mismatch/);
  const accountBound=fixture(); accountBound.record.currentBaseLevel=34; accountBound.record.contentHash=hash(Object.fromEntries(Object.entries(accountBound.record).filter(([name])=>name!=='contentHash'))); accountBound.raw=JSON.stringify(accountBound.record)+'\n'; accountBound.manifest.contentHash=hash(accountBound.raw); accountBound.audit.outputSnapshot.contentHash=accountBound.manifest.contentHash; accountBound.audit.contentHash=hash(Object.fromEntries(Object.entries(accountBound.audit).filter(([name])=>name!=='contentHash')));
  assert.throws(()=>validateActivitySubjectScopeMaterializationInput(accountBound),/record_account_state_present/);
  const promoted=fixture(); promoted.audit.semanticPromotionCoverage.optimizerEligibleCount=1; promoted.audit.contentHash=hash(Object.fromEntries(Object.entries(promoted.audit).filter(([name])=>name!=='contentHash')));
  assert.throws(()=>validateActivitySubjectScopeMaterializationInput(promoted),/audit_optimizer_gate_weakened/);
});

test('second-domain SQL is transactional, insert-only, candidate-preserving, and idempotent by conflict keys',()=>{
  const model=validateActivitySubjectScopeMaterializationInput(fixture()),sql=buildActivitySubjectScopeMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/raw_activity_canonical_subject_scope_evidence/);
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/COMMIT;\n$/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);
  assert.match(sql,/d\.fetched_at IS NOT NULL/);
  assert.match(buildActivitySubjectScopeExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('second-domain reconciliation rejects count, hash, state, and completeness drift',()=>{
  const model=validateActivitySubjectScopeMaterializationInput(fixture()),actual={runId:model.runId,status:'published',records:1,sources:1,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}};
  assert.equal(verifyActivitySubjectScopeReconciliation(model,actual),true);
  assert.throws(()=>verifyActivitySubjectScopeReconciliation(model,{...actual,statements:0}),/statements_count_mismatch/);
  assert.throws(()=>verifyActivitySubjectScopeReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyActivitySubjectScopeReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivitySubjectScopeReconciliation(model,{...actual,metrics:{...actual.metrics,optimizerEligibleRecords:1}}),/semantic_gate_weakened/);
});

function weightedFixture() {
  const sources=Array.from({length:60},(_,index)=>{
    const main=index===59;
    const pageId=main?240934:10000+index;
    const revision=main?'14997080':String(15000000+index);
    const title=main?'Wise Old Man tasks':`Candidate ${index+1}`;
    const sourceUrl=`https://oldschool.runescape.wiki/w/${title.replaceAll(' ','_')}`;
    const sourceTimestamp=main?'2025-09-30T14:52:55Z':`2026-08-${String((index%28)+1).padStart(2,'0')}T00:00:00Z`;
    const sourceContentHash=(index.toString(16).padStart(2,'0')).repeat(32);
    return {sourceKey:`wiki-pageid:${pageId}|revision:${revision}`,sourceRevision:revision,sourcePageId:pageId,resolvedTitle:title,sourceTimestamp,sourceUrl,sourceContentHash,sourceContentBytes:1000+index,workItemKeys:[`work:${index}`]};
  });
  const main=sources[59];
  const evidenceSources=sources.map(source=>({checks:{contentHashMatches:true,revisionMatches:true,semanticVerdictAbsent:true},complete:true,roles:['candidate_subject_source'],sourceKey:source.sourceKey,sourcePageIdentity:{resolvedTitle:source.resolvedTitle,sourceContentBytes:source.sourceContentBytes,sourceContentHash:source.sourceContentHash,sourcePageId:source.sourcePageId,sourceRevision:source.sourceRevision,sourceTimestamp:source.sourceTimestamp,sourceUrl:source.sourceUrl}}));
  const record={contract:'sensum.weighted-parent-task-entry-membership-evidence.v1',accountIndependent:true,automaticVerificationApplied:false,optimizerEligible:false,memberUniverseComplete:false,weightedTaskEntryMembershipVerdict:null,memberCandidateKey:'collection-row:1:2:minigame-like-activities:1:1',resolvedTitle:main.resolvedTitle,sourcePageId:main.sourcePageId,sourceRevision:main.sourceRevision,sourceTimestamp:main.sourceTimestamp,sourceUrl:main.sourceUrl,sourceContentHash:main.sourceContentHash,state:'revision_pinned_weighted_parent_task_entry_membership_evidence_captured_verdicts_closed',weightedParentTaskEntryMembershipEvidenceReview:{reviewNotes:null,reviewedAt:null,reviewedPacketKeys:[],reviewer:null,state:'unreviewed_source_bound_weighted_membership_evidence'},weightedParentTaskEntryMembershipEvidenceSources:evidenceSources,weightedParentTaskEntryMembershipEvidencePackets:Array.from({length:59},(_,index)=>({packetKey:`packet:${index}`,captureComplete:true,optimizerEligible:false,weightedTaskEntryMembershipVerdict:null})),blockers:['weighted_parent_task_entry_membership_evidence_captured_review_pending']};
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n',directory='2026-09-05T17-37-35-832Z';
  const fetchedRevisions=sources.map(source=>({pageId:source.sourcePageId,title:source.resolvedTitle,revision:source.sourceRevision,timestamp:source.sourceTimestamp,contentHash:source.sourceContentHash,sourceContentBytes:source.sourceContentBytes}));
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'weighted-parent-task-entry-membership-evidence',createdAt:'2026-09-05T17:37:35.832Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_weighted_parent_task_entry_membership_evidence_capture_without_semantic_membership_or_optimizer_promotion',api:'https://oldschool.runescape.wiki/api.php',inputSnapshot:{directory:'upstream',contentHash:'f'.repeat(64),rejections:[]},revisionRequests:sources,fetchedRevisions}};
  const audit={contract:'sensum.weighted-parent-task-entry-membership-evidence-audit.v1',inputCoverage:{inputRecordCount:1,eligibleInputRecordCount:1,weightedMembershipWorkItemCount:59,duplicateWorkItemKeys:[]},revisionCoverage:{exactRevisionRequestCount:60,fetchedRevisionCount:60,duplicateFetchedRevisions:[],exactRevisionRequestSetMatches:true,completeSourceRevalidationCount:60,failedSourceKeys:[]},packetCoverage:{evidencePacketCount:59,completeEvidencePacketCount:59,duplicatePacketKeys:[],missingPacketKeys:[],unexpectedPacketKeys:[],channelFailures:[],recordMismatches:[]},semanticPreservationCoverage:{weightedMembershipVerdictCount:0,identityMappingOrCompletenessVerdictCount:0,optimizerEligibleCount:0,unsupportedPromotions:[]},accountStateFindings:[],evidencePacketCaptureComplete:true,weightedMembershipReviewComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:['weighted_parent_task_entry_membership_review_pending'],publishable:true,inputSnapshot:manifest.source.inputSnapshot,outputSnapshot:{directory,contentHash:manifest.contentHash}};
  audit.contentHash=hash(audit);
  return {raw,manifest,audit,record};
}

test('third-domain multi-source evidence remains lossless, review-pending, and deterministic',()=>{
  const input=weightedFixture(),first=validateWeightedParentTaskMembershipMaterializationInput(input),second=validateWeightedParentTaskMembershipMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:60,records:1,statements:1,evidencePackets:59});
  assert.equal(first.records[0].contentHash,input.record.contentHash);
  assert.equal(first.statements[0].payload.weightedTaskEntryMembershipVerdict,null);
  assert.deepEqual(first.gates,{evidencePacketCaptureComplete:true,weightedMembershipReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true});
});

test('third-domain source or semantic tampering fails closed',()=>{
  const sourceTamper=weightedFixture(); sourceTamper.manifest.source.fetchedRevisions[0].contentHash='e'.repeat(64);
  assert.throws(()=>validateWeightedParentTaskMembershipMaterializationInput(sourceTamper),/manifest_fetched_revision_mismatch/);
  const promotion=weightedFixture(); promotion.record.optimizerEligible=true; promotion.record.contentHash=hash(Object.fromEntries(Object.entries(promotion.record).filter(([name])=>name!=='contentHash'))); promotion.raw=JSON.stringify(promotion.record)+'\n'; promotion.manifest.contentHash=hash(promotion.raw); promotion.audit.outputSnapshot.contentHash=promotion.manifest.contentHash; promotion.audit.contentHash=hash(Object.fromEntries(Object.entries(promotion.audit).filter(([name])=>name!=='contentHash')));
  assert.throws(()=>validateWeightedParentTaskMembershipMaterializationInput(promotion),/record_semantic_gate_weakened/);
  const incompleteSet=weightedFixture(); incompleteSet.record.weightedParentTaskEntryMembershipEvidenceSources[1]=incompleteSet.record.weightedParentTaskEntryMembershipEvidenceSources[0]; incompleteSet.record.contentHash=hash(Object.fromEntries(Object.entries(incompleteSet.record).filter(([name])=>name!=='contentHash'))); incompleteSet.raw=JSON.stringify(incompleteSet.record)+'\n'; incompleteSet.manifest.contentHash=hash(incompleteSet.raw); incompleteSet.audit.outputSnapshot.contentHash=incompleteSet.manifest.contentHash; incompleteSet.audit.contentHash=hash(Object.fromEntries(Object.entries(incompleteSet.audit).filter(([name])=>name!=='contentHash')));
  assert.throws(()=>validateWeightedParentTaskMembershipMaterializationInput(incompleteSet),/record_source_evidence_set_mismatch/);
  const incompletePacket=weightedFixture(); incompletePacket.record.weightedParentTaskEntryMembershipEvidencePackets[0].captureComplete=false; incompletePacket.record.contentHash=hash(Object.fromEntries(Object.entries(incompletePacket.record).filter(([name])=>name!=='contentHash'))); incompletePacket.raw=JSON.stringify(incompletePacket.record)+'\n'; incompletePacket.manifest.contentHash=hash(incompletePacket.raw); incompletePacket.audit.outputSnapshot.contentHash=incompletePacket.manifest.contentHash; incompletePacket.audit.contentHash=hash(Object.fromEntries(Object.entries(incompletePacket.audit).filter(([name])=>name!=='contentHash')));
  assert.throws(()=>validateWeightedParentTaskMembershipMaterializationInput(incompletePacket),/record_evidence_packet_gate_weakened/);
});

test('third-domain SQL reuses exact identities without overwriting acquisition time',()=>{
  const model=validateWeightedParentTaskMembershipMaterializationInput(weightedFixture()),sql=buildWeightedParentTaskMembershipMaterializationSql(model),reuse=buildWeightedParentTaskMembershipExistingSourceCountQuery(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/raw_weighted_parent_task_entry_membership_evidence/);
  assert.match(sql,/'candidate'/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);
  assert.match(sql,/d\.fetched_at IS NOT NULL/);
  assert.match(reuse,/d\.published_at=e\.published_at/);
  assert.match(reuse,/d\.content_hash=e\.content_hash/);
});

test('third-domain reconciliation rejects count, hash, state, and completeness drift',()=>{
  const model=validateWeightedParentTaskMembershipMaterializationInput(weightedFixture()),actual={runId:model.runId,status:'published',records:1,sources:60,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,exactSourceIdentityReuseSupported:true,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}};
  assert.equal(verifyWeightedParentTaskMembershipReconciliation(model,actual),true);
  assert.throws(()=>verifyWeightedParentTaskMembershipReconciliation(model,{...actual,sources:59}),/sources_count_mismatch/);
  assert.throws(()=>verifyWeightedParentTaskMembershipReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyWeightedParentTaskMembershipReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyWeightedParentTaskMembershipReconciliation(model,{...actual,metrics:{...actual.metrics,optimizerEligibleRecords:1}}),/semantic_gate_weakened/);
});
