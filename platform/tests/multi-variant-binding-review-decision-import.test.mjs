import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditMultiVariantBindingReviewDecisionImport,
  buildMultiVariantBindingReviewDecisionImport,
  compileMultiVariantBindingReviewDecisionImportPolicy
} from '../transforms/multi-variant-binding-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-binding-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);

function queueRecord(ordinal = 1) {
  const queueEntryKey = `queue:${ordinal}`;
  const sourceDispositionKey = `disposition:${ordinal}`;
  const sourceEvidencePacketContentHash = hash(`packet:${ordinal}`);
  const evidenceFingerprint = hash(`evidence:${ordinal}`);
  const reviewCandidateVariantIndex = ordinal;
  const template = {
    contract: policy.submissionContract,
    queueEntryKey,
    sourceDispositionKey,
    sourceEvidencePacketContentHash,
    evidenceFingerprint,
    reviewCandidateVariantIndex,
    decisionSourceRevisions: [],
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_source_bound_variant_binding_review_decision'
  };
  const base = {
    contract: policy.queueContract,
    queueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionRecordContentHash: hash(`disposition-record:${ordinal}`),
    sourceEvidencePacketContentHash,
    sourceDispositionKey,
    evidenceFingerprint,
    structuralCandidateKey: `candidate:${ordinal}`,
    candidateRole: 'item_delivery_target_candidate',
    candidateDisplayName: `Item ${ordinal}`,
    candidateDisplayNameSource: { kind: 'revision_pinned_numbered_infobox_name_field', parameterName: `name${ordinal}`, rootInfoboxContentHash: hash(`infobox:${ordinal}`), variantIndex: reviewCandidateVariantIndex },
    subjectEvidence: { sourcePageIdentity: { sourcePageId: 100 + ordinal, sourceRevision: String(200 + ordinal), sourceTimestamp: '2026-01-01T00:00:00Z' } },
    parentOccurrenceEvidence: { sourcePageIdentity: { sourcePageId: 300 + ordinal, sourceRevision: String(400 + ordinal), sourceTimestamp: '2026-01-02T00:00:00Z' } },
    variantBindingReviewEvidence: {
      bindingReviewDecision: null,
      boundVariantIndex: null,
      matchingVariantIndices: [reviewCandidateVariantIndex],
      reviewCandidateVariantIndex,
      sourceBindingEvidenceState: 'unique_exact_parent_display_to_numbered_name_match_review_pending'
    },
    reviewScope: {
      decisionScope: 'exact_parent_occurrence_to_exact_revision_pinned_numbered_infobox_variant',
      confirmationDoesNotProve: ['candidate_member_identity', 'weighted_parent_membership', 'repeatability', 'requirements', 'xp', 'timing', 'mechanics', 'declared_total_mapping', 'member_universe_completeness', 'optimizer_eligibility'],
      sourceRevisions: [String(200 + ordinal), String(400 + ordinal)]
    },
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate: template,
    automaticVerificationApplied: false,
    bindingReviewDecision: null,
    boundVariantIndex: null,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mechanicsReviewComplete: false,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    accountIndependent: true,
    state: policy.queueState
  };
  const withEntryHash = { ...base, entryContentHash: hash(base) };
  return { ...withEntryHash, contentHash: hash(withEntryHash) };
}

function completedSubmission(queue, decision = policy.allowedDecisions[0], reviewer = 'Human Reviewer') {
  return {
    ...structuredClone(queue.decisionTemplate),
    decision,
    reviewer,
    reviewedAt: '2026-09-05T10:30:00.000Z',
    decisionSourceRevisions: [...queue.reviewScope.sourceRevisions].reverse(),
    reviewNotes: 'Compared the exact pinned parent occurrence with the numbered infobox variant shown in the review packet.'
  };
}

const compiled = compileMultiVariantBindingReviewDecisionImportPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const queue = queueRecord();
const submission = completedSubmission(queue);
const built = buildMultiVariantBindingReviewDecisionImport({ queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.reviewDecisionRecordingComplete, true);
assert.equal(built.audit.variantBindingReviewComplete, false);
assert.equal(built.audit.queueCoverage.completeQueueRecordCount, 1);
assert.equal(built.audit.bindingCoverage.exactQueueBindingCount, 1);
assert.equal(built.audit.bindingCoverage.exactReviewCandidateVariantIndexCount, 1);
assert.equal(built.records.length, 1);
assert.equal(built.records[0].decision, policy.allowedDecisions[0]);
assert.equal(built.records[0].reviewCandidateVariantIndex, 1);
assert.equal(built.records[0].bindingReviewDecision, null);
assert.equal(built.records[0].boundVariantIndex, null);
assert.equal(built.records[0].semanticDispositionApplied, false);
assert.equal(built.records[0].candidateMemberIdentityVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing decision field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const queueTwo = queueRecord(2);
const partialBatch = buildMultiVariantBindingReviewDecisionImport({
  queueRecords: [queue, queueTwo],
  submissions: [completedSubmission(queue), structuredClone(queueTwo.decisionTemplate)],
  policy,
  queueSnapshotContentHash
});
assert.equal(partialBatch.audit.publishable, true);
assert.equal(partialBatch.records.length, 1);
assert.equal(partialBatch.audit.submissionCoverage.blankSubmissionCount, 1);

const allDecisions = buildMultiVariantBindingReviewDecisionImport({
  queueRecords: [queue, queueTwo],
  submissions: [completedSubmission(queue), completedSubmission(queueTwo, policy.allowedDecisions[1])],
  policy,
  queueSnapshotContentHash
});
assert.equal(allDecisions.audit.publishable, true);
assert.equal(allDecisions.records.length, 2);
assert.equal(allDecisions.audit.recordCoverage.decisionDistribution[policy.allowedDecisions[1]], 1);

const deterministic = buildMultiVariantBindingReviewDecisionImport({ queueRecords: [structuredClone(queue)], submissions: [structuredClone(submission)], policy: structuredClone(policy), queueSnapshotContentHash });
assert.deepEqual(deterministic, built);

let failed = buildMultiVariantBindingReviewDecisionImport({ queueRecords: [queue], submissions: [structuredClone(queue.decisionTemplate)], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('no_completed_review_decisions_submitted'));

for (const mutate of [
  value => { value.reviewer = null; },
  value => { value.evidenceFingerprint = 'f'.repeat(64); },
  value => { value.sourceEvidencePacketContentHash = '0'.repeat(64); },
  value => { value.sourceDispositionKey = 'disposition:other'; },
  value => { value.reviewCandidateVariantIndex = 99; },
  value => { value.queueEntryKey = 'queue:unknown'; },
  value => { value.decisionSourceRevisions = ['999']; },
  value => { value.reviewer = 'Codex'; },
  value => { value.reviewedAt = 'today'; },
  value => { value.reviewedAt = '2025-12-31T23:59:59.000Z'; },
  value => { value.reviewNotes = '   '; }
]) {
  const invalid = structuredClone(submission);
  mutate(invalid);
  failed = buildMultiVariantBindingReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
  assert.equal(failed.audit.publishable, false);
  assert.equal(failed.records.length, 0);
  assert.ok(failed.audit.blockers.includes('one_or_more_submission_rows_partial_stale_unknown_or_invalid'));
}

failed = buildMultiVariantBindingReviewDecisionImport({ queueRecords: [queue], submissions: [submission, structuredClone(submission)], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('duplicate_submission_queue_entry_keys'));

const atomicInvalid = completedSubmission(queueTwo);
atomicInvalid.sourceEvidencePacketContentHash = '0'.repeat(64);
failed = buildMultiVariantBindingReviewDecisionImport({ queueRecords: [queue, queueTwo], submissions: [submission, atomicInvalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);

const staleQueue = structuredClone(queue);
staleQueue.contentHash = '0'.repeat(64);
failed = buildMultiVariantBindingReviewDecisionImport({ queueRecords: [staleQueue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_queue_records_failed_hash_or_blank_template_revalidation'));

const accountSubmission = structuredClone(submission);
accountSubmission.currentLevel = 34;
failed = buildMultiVariantBindingReviewDecisionImport({ queueRecords: [queue], submissions: [accountSubmission], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('current_account_state_present'));

const specific = structuredClone(policy);
specific.overrides = { 'queue:1': 'accept' };
assert.equal(compileMultiVariantBindingReviewDecisionImportPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileMultiVariantBindingReviewDecisionImportPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].boundVariantIndex = 1;
const audit = auditMultiVariantBindingReviewDecisionImport(promoted, { queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('decision_import_created_unsupported_variant_binding_semantic_or_optimizer_promotion'));

console.log('Multi-variant binding review decision import checks passed.');
