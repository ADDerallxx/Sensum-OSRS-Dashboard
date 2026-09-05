import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport,
  buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport,
  compileMultiVariantBindingCanonicalSubjectScopeReviewDecisionImportPolicy
} from '../transforms/multi-variant-binding-canonical-subject-scope-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-binding-canonical-subject-scope-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-canonical-subject-scope-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-canonical-subject-scope-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);

function queueRecord(ordinal = 1) {
  const queueEntryKey = `queue:${ordinal}`;
  const sourceDispositionKey = `disposition:${ordinal}`;
  const sourceDispositionRecordContentHash = hash(`disposition-record:${ordinal}`);
  const sourceDispositionSnapshotContentHash = hash(`disposition-snapshot:${ordinal}`);
  const sourceEvidencePacketKey = `packet:${ordinal}`;
  const sourceEvidencePacketRecordContentHash = hash(`packet-record:${ordinal}`);
  const sourceEvidencePacketSnapshotContentHash = hash(`packet-snapshot:${ordinal}`);
  const evidenceFingerprint = hash(`evidence:${ordinal}`);
  const templateBase = {
    contract: policy.submissionContract,
    queueEntryKey,
    sourceDispositionKey,
    sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash,
    sourceEvidencePacketKey,
    sourceEvidencePacketRecordContentHash,
    sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprint,
    reviewCandidateVariantIndex: null,
    boundVariantIndex: null,
    decisionSourceRevisions: [],
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_source_bound_canonical_subject_scope_review_decision'
  };
  const decisionTemplate = { ...templateBase, templateContentHash: hash(templateBase) };
  const base = {
    contract: policy.queueContract,
    queueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionKey,
    sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash,
    sourceEvidencePacketKey,
    sourceEvidencePacketRecordContentHash,
    sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprint,
    structuralCandidateKey: `candidate:${ordinal}`,
    candidateRole: 'message_delivery_recipient_candidate',
    candidateDisplayName: `NPC ${ordinal}`,
    canonicalSubjectContextEvidenceState: 'observed_for_explicit_scope_review',
    exactNumberedVariantAlignmentEvidenceState: 'not_observed',
    evidenceSourceIdentities: [
      { sourceKey: `source:${ordinal}:1`, sourcePageId: 100 + ordinal, resolvedTitle: `Subject ${ordinal}`, sourceRevision: String(200 + ordinal), sourceTimestamp: '2026-01-01T00:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/Subject_${ordinal}`, sourceContentHash: hash(`subject:${ordinal}`), sourceContentBytes: 10 },
      { sourceKey: `source:${ordinal}:2`, sourcePageId: 300 + ordinal, resolvedTitle: `Parent ${ordinal}`, sourceRevision: String(400 + ordinal), sourceTimestamp: '2026-01-02T00:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/Parent_${ordinal}`, sourceContentHash: hash(`parent:${ordinal}`), sourceContentBytes: 10 }
    ],
    candidateScopedParentContextObservations: [{ sourceKey: `source:${ordinal}:2`, exactSectionTextContentHash: hash(`section:${ordinal}`), exactMatchedLines: [{ lineNumber: 10, exactSourceText: `Parent and NPC ${ordinal}` }] }],
    numberedVariantIdentityObservations: [{ sourceKey: `source:${ordinal}:1`, variantIndex: 1, parameterName: 'version1', exactSourceText: '|version1=Normal' }],
    exactTaskToNumberedVariantAlignmentObservations: [],
    reviewScope: {
      decisionScope: 'whether_the_parent_task_occurrence_refers_to_the_canonical_subject_across_numbered_variants',
      sourceRevisions: [String(200 + ordinal), String(400 + ordinal)],
      canonicalContextObservedDoesNotProveExactNumberedVariant: true,
      confirmationDoesNotProve: ['exact_numbered_variant_binding', 'candidate_member_identity', 'optimizer_eligibility']
    },
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate,
    reviewDecision: null,
    reviewCandidateVariantIndex: null,
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
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: ['explicit_canonical_subject_scope_review_pending', 'exact_numbered_variant_binding_not_proven'],
    state: policy.queueState
  };
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function completedSubmission(queue, decision = policy.allowedDecisions[0], reviewer = 'Human Reviewer') {
  return {
    ...structuredClone(queue.decisionTemplate),
    decision,
    reviewer,
    reviewedAt: '2026-09-05T10:30:00.000Z',
    decisionSourceRevisions: [...queue.reviewScope.sourceRevisions].reverse(),
    reviewNotes: 'Compared the exact pinned task context, subject identity observations, and revision-bound source lines.'
  };
}

const compiled = compileMultiVariantBindingCanonicalSubjectScopeReviewDecisionImportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const queue = queueRecord();
const submission = completedSubmission(queue);
const built = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({ queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.reviewDecisionRecordingComplete, true);
assert.equal(built.audit.canonicalSubjectScopeReviewComplete, false);
assert.equal(built.audit.variantBindingReviewComplete, false);
assert.equal(built.audit.queueCoverage.completeQueueRecordCount, 1);
assert.equal(built.audit.bindingCoverage.exactImmutableQueueBindingCount, 1);
assert.equal(built.audit.bindingCoverage.nonNullReviewCandidateVariantIndexCount, 0);
assert.equal(built.audit.bindingCoverage.nonNullBoundVariantIndexCount, 0);
assert.equal(built.records.length, 1);
assert.equal(built.records[0].decision, policy.allowedDecisions[0]);
assert.equal(built.records[0].canonicalSubjectScopeReviewDecision, null);
assert.equal(built.records[0].reviewCandidateVariantIndex, null);
assert.equal(built.records[0].bindingReviewDecision, null);
assert.equal(built.records[0].boundVariantIndex, null);
assert.equal(built.records[0].semanticDispositionApplied, false);
assert.equal(built.records[0].candidateMemberIdentityVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing decision field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const queueTwo = queueRecord(2);
const partialBatch = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({
  queueRecords: [queue, queueTwo],
  submissions: [completedSubmission(queue), structuredClone(queueTwo.decisionTemplate)],
  policy,
  queueSnapshotContentHash
});
assert.equal(partialBatch.audit.publishable, true);
assert.equal(partialBatch.records.length, 1);
assert.equal(partialBatch.audit.submissionCoverage.blankSubmissionCount, 1);
assert.ok(partialBatch.audit.blockers.includes('one_or_more_canonical_subject_scope_review_decisions_unrecorded'));

const allQueues = policy.allowedDecisions.map((_, index) => queueRecord(index + 1));
const allDecisions = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({
  queueRecords: allQueues,
  submissions: allQueues.map((record, index) => completedSubmission(record, policy.allowedDecisions[index])),
  policy,
  queueSnapshotContentHash
});
assert.equal(allDecisions.audit.publishable, true);
assert.equal(allDecisions.records.length, 4);
for (const decision of policy.allowedDecisions) assert.equal(allDecisions.audit.recordCoverage.decisionDistribution[decision], 1);

const deterministic = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({ queueRecords: [structuredClone(queue)], submissions: [structuredClone(submission)], policy: structuredClone(policy), queueSnapshotContentHash });
assert.deepEqual(deterministic, built);

let failed = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({ queueRecords: [queue], submissions: [structuredClone(queue.decisionTemplate)], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('no_completed_review_decisions_submitted'));

for (const mutate of [
  value => { value.reviewer = null; },
  value => { value.evidenceFingerprint = 'f'.repeat(64); },
  value => { value.sourceDispositionRecordContentHash = '0'.repeat(64); },
  value => { value.sourceDispositionSnapshotContentHash = '0'.repeat(64); },
  value => { value.sourceEvidencePacketKey = 'packet:other'; },
  value => { value.sourceEvidencePacketRecordContentHash = '0'.repeat(64); },
  value => { value.sourceEvidencePacketSnapshotContentHash = '0'.repeat(64); },
  value => { value.templateContentHash = '0'.repeat(64); },
  value => { value.reviewCandidateVariantIndex = 1; },
  value => { value.boundVariantIndex = 1; },
  value => { value.queueEntryKey = 'queue:unknown'; },
  value => { value.decisionSourceRevisions = ['999']; },
  value => { value.reviewer = 'Codex'; },
  value => { value.reviewedAt = 'today'; },
  value => { value.reviewedAt = '2025-12-31T23:59:59.000Z'; },
  value => { value.reviewNotes = '   '; }
]) {
  const invalid = structuredClone(submission);
  mutate(invalid);
  failed = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
  assert.equal(failed.audit.publishable, false);
  assert.equal(failed.records.length, 0);
  assert.ok(failed.audit.blockers.includes('one_or_more_submission_rows_partial_stale_unknown_or_invalid'));
}

failed = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({ queueRecords: [queue], submissions: [submission, structuredClone(submission)], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('duplicate_submission_queue_entry_keys'));

const atomicInvalid = completedSubmission(queueTwo);
atomicInvalid.evidenceFingerprint = '0'.repeat(64);
failed = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({ queueRecords: [queue, queueTwo], submissions: [submission, atomicInvalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);

const staleQueue = structuredClone(queue);
staleQueue.contentHash = '0'.repeat(64);
failed = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({ queueRecords: [staleQueue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_queue_records_failed_manifest_record_template_or_binding_revalidation'));

const accountSubmission = structuredClone(submission);
accountSubmission.currentLevel = 34;
failed = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({ queueRecords: [queue], submissions: [accountSubmission], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('current_account_state_present'));

const specific = structuredClone(policy);
specific.overrides = { 'queue:1': 'accept' };
assert.equal(compileMultiVariantBindingCanonicalSubjectScopeReviewDecisionImportPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileMultiVariantBindingCanonicalSubjectScopeReviewDecisionImportPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].canonicalSubjectScopeReviewDecision = policy.allowedDecisions[0];
promoted[0].boundVariantIndex = 1;
promoted[0].optimizerEligible = true;
const audit = auditMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport(promoted, { queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('decision_import_created_unsupported_canonical_scope_variant_semantic_or_optimizer_promotion'));

console.log('Multi-variant canonical-subject scope review decision import checks passed.');
