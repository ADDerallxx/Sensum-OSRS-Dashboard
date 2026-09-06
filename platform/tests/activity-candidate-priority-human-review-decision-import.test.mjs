import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityCandidatePriorityHumanReviewDecisionImport,
  boundSourceRevisionsForActivityCandidatePriorityPacket,
  buildActivityCandidatePriorityHumanReviewDecisionImport,
  canonicalActivityIdentityProposalForActivityCandidatePriorityPacket,
  canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket,
  compileActivityCandidatePriorityHumanReviewDecisionImportPolicy,
  requiredReviewEvidenceKeysForActivityCandidatePriorityPacket
} from '../transforms/activity-candidate-priority-human-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-human-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-human-review-decision-import-audit-v1.json', 'utf8'));
const packetSnapshotContentHash = 'a'.repeat(64);
const packetSnapshotCreatedAt = '2026-09-06T04:06:25.989Z';

function withContentHash(base) {
  return { ...base, contentHash: hash(base) };
}

function packetRecord(prefix = '1', conflict = false) {
  const candidateKey = `osrs-wiki-pageid:${100 + Number(prefix)}`;
  const reviewPacketKey = `${candidateKey}|priority-activity-human-review-packet`;
  const sourceRevision = String(500 + Number(prefix));
  const sourceTimestamp = '2026-09-01T00:00:00Z';
  const sourceContentHash = hash(`source:${prefix}`);
  const discoveryEvidence = withContentHash({
    contract: 'sensum.cross-source-entity-activity-candidate.v1',
    candidateKey,
    sourceContexts: {
      renderedEvidence: {
        observations: [{ guideRevision: String(700 + Number(prefix)), parserObservedAt: '2026-09-03T00:00:00Z' }]
      }
    },
    activityDiscoveryCandidate: true,
    accountIndependent: true
  });
  const sourceEvidence = withContentHash({
    contract: 'sensum.activity-candidate-source-evidence.v1',
    candidateKey,
    sourcePageId: 100 + Number(prefix),
    resolvedTitle: `Activity ${prefix}`,
    sourceRevision,
    sourceTimestamp,
    sourceUrl: `https://oldschool.runescape.wiki/w/Activity_${prefix}`,
    sourceContentHash,
    sourceCandidateContentHash: discoveryEvidence.contentHash,
    accountIndependent: true
  });
  const subjectDisposition = conflict
    ? { state: 'blocked_conflicting_source_declarations', disposition: null, conflictingDispositions: ['activity_subject', 'minigame_subject'] }
    : { state: 'source_supported', disposition: 'activity_subject', conflictingDispositions: [] };
  const subjectAssessment = withContentHash({
    contract: 'sensum.activity-candidate-subject-disposition.v1',
    candidateKey,
    sourcePageId: sourceEvidence.sourcePageId,
    sourceRevision,
    sourceTimestamp,
    sourceContentHash,
    sourceEvidenceContentHash: sourceEvidence.contentHash,
    subjectDisposition,
    accountIndependent: true
  });
  const workRoute = withContentHash({
    contract: 'sensum.activity-candidate-evidence-work-routing.v1',
    candidateKey,
    sourcePageId: sourceEvidence.sourcePageId,
    sourceRevision,
    sourceTimestamp,
    sourceContentHash,
    sourceDispositionContentHash: subjectAssessment.contentHash,
    sourceDisposition: subjectDisposition,
    routingDecision: {
      routeKey: conflict ? 'source_declaration_conflict_review' : 'activity_action_and_variant_review',
      routeState: conflict ? 'blocked_source_conflict' : 'queued_evidence_work',
      requiredEvidenceDomains: conflict ? ['field_semantics', 'source_declaration_reconciliation'] : ['mechanics', 'repeatability']
    },
    accountIndependent: true
  });
  const domains = [...workRoute.routingDecision.requiredEvidenceDomains].sort();
  const decisionTemplate = {
    contract: policy.submissionContract,
    reviewPacketKey,
    candidateKey,
    subjectDispositionDecision: null,
    selectedSourceDisposition: null,
    canonicalGameEntityIdentityDecision: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentityDecision: null,
    canonicalActivityIdentity: null,
    repeatabilityDecision: null,
    atomicityDecision: null,
    memberExpansionDecision: null,
    memberKeys: [],
    evidenceDomainAssessments: domains.map(domain => ({ domain, status: null, evidenceKeys: [], notes: null })),
    reviewEvidenceKeys: [],
    reviewedSourceRevisions: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null
  };
  const base = {
    contract: policy.packetContract,
    reviewPacketKey,
    packetOrdinal: Number(prefix),
    batchOrdinal: Math.floor((Number(prefix) - 1) / policy.packetBatchSize) + 1,
    batchItemOrdinal: ((Number(prefix) - 1) % policy.packetBatchSize) + 1,
    candidateKey,
    sourcePageIdentity: {
      sourcePageId: sourceEvidence.sourcePageId,
      resolvedTitle: sourceEvidence.resolvedTitle,
      sourceRevision,
      sourceTimestamp,
      sourceUrl: sourceEvidence.sourceUrl,
      sourceContentHash,
      sourceContentBytes: 1000
    },
    sourceExactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${sourceRevision}`,
    pipelineBindings: {
      candidateContentHash: discoveryEvidence.contentHash,
      sourceEvidenceContentHash: sourceEvidence.contentHash,
      subjectDispositionContentHash: subjectAssessment.contentHash,
      workRoutingContentHash: workRoute.contentHash
    },
    discoveryEvidence,
    sourceEvidence,
    subjectAssessment,
    workRoute,
    reviewPriority: { band: conflict ? 1 : 2, reason: conflict ? 'source_conflict' : 'priority_review' },
    reviewObligations: { requiredEvidenceDomains: domains },
    decisionTemplate,
    explicitNonClaims: ['optimizer_eligibility_is_not_established'],
    decisionRecorded: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    atomicityClassification: null,
    memberExpansionReviewed: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: ['explicit_human_activity_candidate_review_pending'],
    state: conflict ? policy.packetStates[0] : policy.packetStates[1]
  };
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function completedSubmission(packet) {
  const evidenceKeys = requiredReviewEvidenceKeysForActivityCandidatePriorityPacket(packet);
  return {
    ...structuredClone(packet.decisionTemplate),
    subjectDispositionDecision: 'confirm_one_bound_source_disposition',
    selectedSourceDisposition: packet.subjectAssessment.subjectDisposition.disposition
      || packet.subjectAssessment.subjectDisposition.conflictingDispositions[0],
    canonicalGameEntityIdentityDecision: 'confirm_bound_source_page_subject_identity',
    canonicalGameEntityIdentity: canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket(packet),
    canonicalActivityIdentityDecision: 'confirm_bound_source_subject_as_activity_container',
    canonicalActivityIdentity: canonicalActivityIdentityProposalForActivityCandidatePriorityPacket(packet),
    repeatabilityDecision: 'repeatable_activity',
    atomicityDecision: 'atomic_activity_subject',
    memberExpansionDecision: 'not_required_atomic_subject',
    evidenceDomainAssessments: packet.decisionTemplate.evidenceDomainAssessments.map(item => ({
      domain: item.domain,
      status: 'supported_by_bound_evidence',
      evidenceKeys: [evidenceKeys[0]],
      notes: `Reviewed the bound evidence for ${item.domain}.`
    })),
    reviewEvidenceKeys: evidenceKeys,
    reviewedSourceRevisions: boundSourceRevisionsForActivityCandidatePriorityPacket(packet),
    reviewer: 'Human Reviewer',
    reviewedAt: '2026-09-06T05:00:00.000Z',
    reviewNotes: 'Reviewed the exact packet, source revisions, pipeline bindings, and every required evidence domain.'
  };
}

const compiled = compileActivityCandidatePriorityHumanReviewDecisionImportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.enumsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const packet = packetRecord();
const submission = completedSubmission(packet);
const built = buildActivityCandidatePriorityHumanReviewDecisionImport({
  packetRecords: [packet], submissions: [submission], policy, packetSnapshotContentHash, packetSnapshotCreatedAt
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.reviewDecisionRecordingComplete, true);
assert.equal(built.audit.humanReviewComplete, false);
assert.equal(built.audit.packetCoverage.completePacketCount, 1);
assert.equal(built.audit.submissionCoverage.completedSubmissionCount, 1);
assert.equal(built.audit.bindingCoverage.exactEvidenceKeySetCount, 1);
assert.equal(built.audit.bindingCoverage.exactSourceRevisionSetCount, 1);
assert.equal(built.records.length, 1);
assert.equal(built.records[0].semanticApplicationApplied, false);
assert.equal(built.records[0].canonicalGameEntityIdentity, null);
assert.equal(built.records[0].canonicalActivityIdentity, null);
assert.deepEqual(built.records[0].reviewedCanonicalGameEntityIdentityProposal, submission.canonicalGameEntityIdentity);
assert.deepEqual(built.records[0].reviewedCanonicalActivityIdentityProposal, submission.canonicalActivityIdentity);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing decision field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const packetTwo = packetRecord('2', true);
const partialBatch = buildActivityCandidatePriorityHumanReviewDecisionImport({
  packetRecords: [packet, packetTwo],
  submissions: [submission, structuredClone(packetTwo.decisionTemplate)],
  policy,
  packetSnapshotContentHash,
  packetSnapshotCreatedAt
});
assert.equal(partialBatch.audit.publishable, true);
assert.equal(partialBatch.records.length, 1);
assert.equal(partialBatch.audit.submissionCoverage.blankSubmissionCount, 1);

const deterministic = buildActivityCandidatePriorityHumanReviewDecisionImport({
  packetRecords: [structuredClone(packet)], submissions: [structuredClone(submission)], policy: structuredClone(policy), packetSnapshotContentHash, packetSnapshotCreatedAt
});
assert.deepEqual(deterministic, built);

let failed = buildActivityCandidatePriorityHumanReviewDecisionImport({
  packetRecords: [packet], submissions: [structuredClone(packet.decisionTemplate)], policy, packetSnapshotContentHash, packetSnapshotCreatedAt
});
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('no_completed_human_review_decisions_submitted'));

function rejected(mutator) {
  const invalid = structuredClone(submission);
  mutator(invalid);
  const result = buildActivityCandidatePriorityHumanReviewDecisionImport({
    packetRecords: [packet], submissions: [invalid], policy, packetSnapshotContentHash, packetSnapshotCreatedAt
  });
  assert.equal(result.audit.publishable, false);
  assert.equal(result.records.length, 0);
  return result;
}

failed = rejected(value => { value.reviewer = null; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewerPresent, false);
failed = rejected(value => { value.reviewer = 'Codex'; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewerNotObviouslyAutomatic, false);
failed = rejected(value => { value.reviewedAt = '2026-09-05T00:00:00.000Z'; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewedAtNotBeforePacketOrEvidence, false);
failed = rejected(value => { value.reviewedSourceRevisions = ['999']; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewedSourceRevisionsExact, false);
failed = rejected(value => { value.reviewEvidenceKeys.pop(); });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewEvidenceKeysExact, false);
failed = rejected(value => { value.evidenceDomainAssessments[0].notes = ''; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.domainAssessmentsComplete, false);
failed = rejected(value => { value.evidenceDomainAssessments[0].evidenceKeys = ['invented:evidence']; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.domainAssessmentsComplete, false);
failed = rejected(value => { value.canonicalGameEntityIdentity.sourceRevision = '999'; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.canonicalGameEntityProposalCoherent, false);
failed = rejected(value => { value.canonicalGameEntityIdentityDecision = 'additional_evidence_required'; value.canonicalGameEntityIdentity = null; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.canonicalActivityProposalCoherent, false);
failed = rejected(value => { value.memberKeys = ['invented-member']; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.memberKeysRemainEmpty, false);
failed = rejected(value => { value.optimizerEligible = true; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].bindingChecks.submissionKeysExact, false);
failed = rejected(value => { value.reviewPacketKey = 'unknown'; });
assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].bindingChecks.packetExists, false);

failed = buildActivityCandidatePriorityHumanReviewDecisionImport({
  packetRecords: [packet], submissions: [submission, structuredClone(submission)], policy, packetSnapshotContentHash, packetSnapshotCreatedAt
});
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('duplicate_submission_review_packet_keys'));

const tamperedPacket = structuredClone(packet);
tamperedPacket.pipelineBindings.candidateContentHash = '0'.repeat(64);
failed = buildActivityCandidatePriorityHumanReviewDecisionImport({
  packetRecords: [tamperedPacket], submissions: [submission], policy, packetSnapshotContentHash, packetSnapshotCreatedAt
});
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_packet_records_failed_hash_pipeline_or_blank_template_revalidation'));

const specific = structuredClone(policy);
specific.overrides = { [packet.candidateKey]: 'accept' };
assert.equal(compileActivityCandidatePriorityHumanReviewDecisionImportPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileActivityCandidatePriorityHumanReviewDecisionImportPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
let audit = auditActivityCandidatePriorityHumanReviewDecisionImport(promoted, {
  packetRecords: [packet], submissions: [submission], policy, packetSnapshotContentHash, packetSnapshotCreatedAt
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('decision_import_created_unsupported_semantic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
audit = auditActivityCandidatePriorityHumanReviewDecisionImport(accountScoped, {
  packetRecords: [packet], submissions: [submission], policy, packetSnapshotContentHash, packetSnapshotCreatedAt
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Activity candidate priority human review decision import checks passed.');
