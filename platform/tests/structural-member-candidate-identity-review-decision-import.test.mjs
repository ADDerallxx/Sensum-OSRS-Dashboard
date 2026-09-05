import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditStructuralMemberCandidateIdentityReviewDecisionImport,
  buildStructuralMemberCandidateIdentityReviewDecisionImport,
  compileStructuralMemberCandidateIdentityReviewDecisionImportPolicy
} from '../transforms/structural-member-candidate-identity-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/structural-member-candidate-identity-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/structural-member-candidate-identity-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/structural-member-candidate-identity-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);

function queueRecord(prefix = '1') {
  const queueEntryKey = `queue:${prefix}`;
  const reviewPacketKey = `packet:${prefix}`;
  const sourcePacketContentHash = hash(`packet-content:${prefix}`);
  const evidenceFingerprint = hash(`evidence:${prefix}`);
  const template = {
    contract: policy.submissionContract,
    queueEntryKey,
    reviewPacketKey,
    sourcePacketContentHash,
    evidenceFingerprint,
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    decisionSourceRevisions: [],
    reviewNotes: null,
    state: 'blank_source_bound_candidate_identity_review_decision'
  };
  const base = {
    contract: policy.queueContract,
    queueEntryKey,
    queueOrdinal: Number(prefix),
    reviewPacketKey,
    sourcePacketRecordContentHash: hash(`packet-record:${prefix}`),
    sourcePacketContentHash,
    evidenceFingerprint,
    structuralCandidateKey: `candidate:${prefix}`,
    candidateRole: 'item_delivery_target_candidate',
    candidateDisplayName: `Subject ${prefix}`,
    candidateDisplayNameSource: { kind: 'revision_pinned_root_infobox_name_field', parameterName: 'name', rootInfoboxContentHash: hash(`infobox:${prefix}`) },
    subjectEvidence: { sourcePageIdentity: { sourcePageId: 100 + Number(prefix), sourceRevision: String(200 + Number(prefix)), sourceTimestamp: '2026-01-01T00:00:00Z' } },
    parentOccurrenceEvidence: { sourcePageIdentity: { sourcePageId: 300 + Number(prefix), sourceRevision: String(400 + Number(prefix)), sourceTimestamp: '2026-01-02T00:00:00Z' } },
    reviewScope: {
      decisionScope: 'exact_candidate_to_revision_pinned_source_page_subject_identity_and_single_infobox_variant',
      confirmationDoesNotProve: ['weighted_parent_membership', 'repeatability', 'requirements', 'xp', 'timing', 'mechanics', 'declared_total_mapping', 'member_universe_completeness', 'optimizer_eligibility'],
      sourceRevisions: [String(200 + Number(prefix)), String(400 + Number(prefix))]
    },
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate: template,
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
    reviewedAt: '2026-09-05T09:30:00.000Z',
    decisionSourceRevisions: [...queue.reviewScope.sourceRevisions].reverse(),
    reviewNotes: 'Compared the exact pinned infobox identity and parent occurrence shown in the review queue.'
  };
}

const compiled = compileStructuralMemberCandidateIdentityReviewDecisionImportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const queue = queueRecord();
const submission = completedSubmission(queue);
const built = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.reviewDecisionRecordingComplete, true);
assert.equal(built.audit.identityReviewComplete, false);
assert.equal(built.audit.queueCoverage.completeQueueRecordCount, 1);
assert.equal(built.audit.submissionCoverage.completedSubmissionCount, 1);
assert.equal(built.audit.submissionCoverage.blankSubmissionCount, 0);
assert.equal(built.audit.bindingCoverage.exactQueueBindingCount, 1);
assert.equal(built.audit.bindingCoverage.exactSourceRevisionSetCount, 1);
assert.equal(built.audit.recordCoverage.recordedDecisionCount, 1);
assert.equal(built.audit.semanticPreservationCoverage.identityVerdictCount, 0);
assert.equal(built.records.length, 1);
assert.equal(built.records[0].decision, policy.allowedDecisions[0]);
assert.deepEqual(built.records[0].decisionSourceRevisions, [...queue.reviewScope.sourceRevisions].sort());
assert.equal(built.records[0].semanticDispositionApplied, false);
assert.equal(built.records[0].candidateMemberIdentityVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing decision field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const queueTwo = queueRecord('2');
const partialBatch = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue, queueTwo], submissions: [completedSubmission(queue), structuredClone(queueTwo.decisionTemplate)], policy, queueSnapshotContentHash });
assert.equal(partialBatch.audit.publishable, true);
assert.equal(partialBatch.records.length, 1);
assert.equal(partialBatch.audit.submissionCoverage.blankSubmissionCount, 1);

const allDecisions = buildStructuralMemberCandidateIdentityReviewDecisionImport({
  queueRecords: [queue, queueTwo],
  submissions: [completedSubmission(queue), completedSubmission(queueTwo, policy.allowedDecisions[1])],
  policy,
  queueSnapshotContentHash
});
assert.equal(allDecisions.audit.publishable, true);
assert.equal(allDecisions.records.length, 2);
assert.equal(allDecisions.audit.identityReviewComplete, false);
assert.equal(allDecisions.audit.recordCoverage.decisionDistribution[policy.allowedDecisions[1]], 1);

const deterministic = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [structuredClone(queue)], submissions: [structuredClone(submission)], policy: structuredClone(policy), queueSnapshotContentHash });
assert.deepEqual(deterministic, built);

let failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [structuredClone(queue.decisionTemplate)], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('no_completed_review_decisions_submitted'));

let invalid = structuredClone(submission);
invalid.reviewer = null;
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_submission_rows_partial_stale_unknown_or_invalid'));

invalid = structuredClone(submission);
invalid.evidenceFingerprint = 'f'.repeat(64);
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].bindingChecks.evidenceFingerprintMatches, false);

invalid = structuredClone(submission);
invalid.queueEntryKey = 'queue:unknown';
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);

failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [submission, structuredClone(submission)], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('duplicate_submission_queue_entry_keys'));

invalid = structuredClone(submission);
invalid.decisionSourceRevisions = ['999'];
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.sourceRevisionsExact, false);

invalid = structuredClone(submission);
invalid.reviewer = 'Codex';
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewerNotObviouslyAutomatic, false);

invalid = structuredClone(submission);
invalid.reviewedAt = 'today';
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewedAtValid, false);

invalid = structuredClone(submission);
invalid.reviewedAt = '2025-12-31T23:59:59.000Z';
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewedAtNotBeforeEvidence, false);

invalid = structuredClone(submission);
invalid.reviewNotes = '   ';
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue], submissions: [invalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewNotesPresent, false);

const atomicInvalid = structuredClone(completedSubmission(queueTwo));
atomicInvalid.sourcePacketContentHash = '0'.repeat(64);
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [queue, queueTwo], submissions: [submission, atomicInvalid], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);

const staleQueue = structuredClone(queue);
staleQueue.contentHash = '0'.repeat(64);
failed = buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords: [staleQueue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_queue_records_failed_hash_or_blank_template_revalidation'));

const specific = structuredClone(policy);
specific.overrides = { 'queue:1': 'accept' };
assert.equal(compileStructuralMemberCandidateIdentityReviewDecisionImportPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileStructuralMemberCandidateIdentityReviewDecisionImportPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].candidateMemberIdentityVerdict = 'confirmed';
let audit = auditStructuralMemberCandidateIdentityReviewDecisionImport(promoted, { queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('decision_import_created_unsupported_semantic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
audit = auditStructuralMemberCandidateIdentityReviewDecisionImport(accountScoped, { queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Structural member candidate identity review decision import checks passed.');
