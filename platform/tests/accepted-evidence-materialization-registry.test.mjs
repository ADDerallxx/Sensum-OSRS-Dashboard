import assert from 'node:assert/strict';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  acceptedEvidenceDomains,
  getAcceptedEvidenceAdapter
} from '../db/accepted-evidence-materialization-registry-lib.mjs';
import {
  buildActivitySubjectScopeMaterializationSql,
  validateActivitySubjectScopeMaterializationInput,
  verifyActivitySubjectScopeReconciliation
} from '../db/activity-subject-scope-materialization-lib.mjs';

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

test('registry exposes both accepted evidence adapters and rejects unknown domains',()=>{
  assert.deepEqual(acceptedEvidenceDomains(),['activity-canonical-subject-scope-evidence','skill-level-unlock-inventory']);
  assert.equal(getAcceptedEvidenceAdapter('activity-canonical-subject-scope-evidence').dataFile,'activity-canonical-subject-scope-evidence.ndjson');
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
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
});

test('second-domain reconciliation rejects count, hash, state, and completeness drift',()=>{
  const model=validateActivitySubjectScopeMaterializationInput(fixture()),actual={runId:model.runId,status:'published',records:1,sources:1,statements:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}};
  assert.equal(verifyActivitySubjectScopeReconciliation(model,actual),true);
  assert.throws(()=>verifyActivitySubjectScopeReconciliation(model,{...actual,statements:0}),/statements_count_mismatch/);
  assert.throws(()=>verifyActivitySubjectScopeReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivitySubjectScopeReconciliation(model,{...actual,metrics:{...actual.metrics,optimizerEligibleRecords:1}}),/semantic_gate_weakened/);
});
