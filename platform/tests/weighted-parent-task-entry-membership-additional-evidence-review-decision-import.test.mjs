import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hash } from '../ingestion/lib.mjs';
import {
  auditWeightedMembershipAdditionalEvidenceReviewDecisionImport,
  buildWeightedMembershipAdditionalEvidenceReviewDecisionImport,
  compileWeightedMembershipAdditionalEvidenceReviewDecisionImportPolicy
} from '../transforms/weighted-parent-task-entry-membership-additional-evidence-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-additional-evidence-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);

function queueRecord(ordinal = 1) {
  const structuralCandidateKey = `candidate:${ordinal}`;
  const queueEntryKey = `${structuralCandidateKey}|parent-review:${ordinal}`;
  const sourceDispositionKey = `${structuralCandidateKey}|disposition`;
  const sourceEvidencePacketKey = `${structuralCandidateKey}|evidence`;
  const sourceDispositionRecordContentHash = hash(`disposition-record:${ordinal}`);
  const sourceDispositionSnapshotContentHash = hash(`disposition-snapshot:${ordinal}`);
  const sourceEvidencePacketRecordContentHash = hash(`evidence-record:${ordinal}`);
  const sourceEvidencePacketSnapshotContentHash = hash(`evidence-snapshot:${ordinal}`);
  const evidenceFingerprint = hash(`fingerprint:${ordinal}`);
  const candidateRole = 'item_delivery_target_candidate';
  const candidateSource = {
    sourceKey: `wiki-pageid:${100 + ordinal}|revision:${200 + ordinal}`,
    sourcePageId: 100 + ordinal,
    resolvedTitle: `Candidate ${ordinal}`,
    sourceRevision: String(200 + ordinal),
    sourceTimestamp: '2026-09-04T10:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Candidate_${ordinal}`,
    sourceContentHash: hash(`candidate-source:${ordinal}`),
    sourceContentBytes: 1000 + ordinal
  };
  const parentSource = {
    sourceKey: `wiki-pageid:${300 + ordinal}|revision:${400 + ordinal}`,
    sourcePageId: 300 + ordinal,
    resolvedTitle: 'Parent task inventory',
    sourceRevision: String(400 + ordinal),
    sourceTimestamp: '2026-09-05T10:00:00Z',
    sourceUrl: 'https://oldschool.runescape.wiki/w/Parent_task_inventory',
    sourceContentHash: hash(`parent-source:${ordinal}`),
    sourceContentBytes: 2000 + ordinal
  };
  const exactSourceText = `|{{plink|Candidate ${ordinal}}}`;
  const exactObservation = {
    sourceKey: parentSource.sourceKey,
    resolvedTitle: parentSource.resolvedTitle,
    sourceRevision: parentSource.sourceRevision,
    sourceUrl: parentSource.sourceUrl,
    sourceContentHash: parentSource.sourceContentHash,
    heading: 'Easy task items',
    headingLine: 10,
    lineStart: 10,
    lineEnd: 12,
    matchedCandidate: `Candidate ${ordinal}`,
    candidateMentionBasis: 'exact_structured_source_reference',
    exactSectionTextContentHash: hash(`section:${ordinal}`),
    observationContentHash: hash(`observation:${ordinal}`),
    exactMatchedLines: [{ lineNumber: 11, exactSourceText, exactSourceTextContentHash: hash(exactSourceText) }],
    exactMatchedLinesRevalidated: true,
    semanticUse: 'exact_structured_candidate_lines_from_retained_pinned_parent_section_for_human_review_not_membership_verdict'
  };
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
    structuralCandidateKey,
    candidateRole,
    decisionSourceRevisions: [],
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_source_bound_parent_section_membership_review_decision'
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
    sourceWorkQueueEntryKey: `${structuralCandidateKey}|work`,
    evidenceFingerprint,
    structuralCandidateKey,
    candidateRole,
    candidateDisplay: { value: `Candidate ${ordinal}`, source: { sourcePageId: candidateSource.sourcePageId, sourceRevision: candidateSource.sourceRevision } },
    classification: 'exact_candidate_reference_in_pinned_parent_relationship_section_review_required',
    parentSectionMembershipEvidenceState: 'exact_structured_candidate_reference_observed_on_pinned_parent_source_for_explicit_review',
    candidateRelationshipContextEvidenceState: 'observed_for_explicit_review',
    evidenceSourceIdentities: [candidateSource, parentSource],
    parentSectionEvidenceBindings: [{ sourceKey: parentSource.sourceKey, sourceRevision: parentSource.sourceRevision, sourceContentHash: parentSource.sourceContentHash }],
    candidateRelationshipEvidenceBindings: [{ sourceKey: parentSource.sourceKey, sourceRevision: parentSource.sourceRevision, sourceContentHash: parentSource.sourceContentHash }],
    exactParentSectionObservations: [exactObservation],
    reviewScope: {
      decisionScope: 'whether_the_exact_pinned_parent_section_declares_the_candidate_as_a_weighted_task_member',
      sourceRevisions: [parentSource.sourceRevision],
      exactStructuredParentReferenceIsEvidenceNotAVerdict: true,
      confirmationDoesNotProve: ['optimizer_eligibility']
    },
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate,
    reviewDecision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
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
    blockers: ['exact_parent_section_membership_reviews_pending'],
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
    reviewNotes: 'Compared the exact candidate-bearing line with the complete pinned parent-section evidence.'
  };
}

function assertAtomicFailure(queueRecords, submissions, changedPolicy = policy) {
  const built = buildWeightedMembershipAdditionalEvidenceReviewDecisionImport({
    queueRecords,
    submissions,
    policy: changedPolicy,
    queueSnapshotContentHash
  });
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  return built.audit;
}

const compiled = compileWeightedMembershipAdditionalEvidenceReviewDecisionImportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const queue = queueRecord();
const submission = completedSubmission(queue);
const built = buildWeightedMembershipAdditionalEvidenceReviewDecisionImport({ queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.reviewDecisionRecordingComplete, true);
assert.equal(built.audit.weightedMembershipReviewComplete, false);
assert.equal(built.audit.queueCoverage.completeQueueRecordCount, 1);
assert.equal(built.audit.bindingCoverage.exactImmutableQueueBindingCount, 1);
assert.equal(built.records.length, 1);
assert.equal(built.records[0].decision, policy.allowedDecisions[0]);
assert.equal(built.records[0].semanticDispositionApplied, false);
assert.equal(built.records[0].parentSectionMembershipReviewDecision, null);
assert.equal(built.records[0].parentMembershipVerdict, null);
assert.equal(built.records[0].weightedTaskEntryMembershipVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing decision field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const queueTwo = queueRecord(2);
const partialBatch = buildWeightedMembershipAdditionalEvidenceReviewDecisionImport({
  queueRecords: [queue, queueTwo],
  submissions: [completedSubmission(queue), structuredClone(queueTwo.decisionTemplate)],
  policy,
  queueSnapshotContentHash
});
assert.equal(partialBatch.audit.publishable, true);
assert.equal(partialBatch.records.length, 1);
assert.equal(partialBatch.audit.submissionCoverage.blankSubmissionCount, 1);
assert.equal(partialBatch.audit.reviewDecisionRecordingComplete, false);

const queueThree = queueRecord(3);
const allQueues = [queue, queueTwo, queueThree];
const allDecisions = allQueues.map((entry, index) => completedSubmission(entry, policy.allowedDecisions[index]));
const allBuilt = buildWeightedMembershipAdditionalEvidenceReviewDecisionImport({ queueRecords: allQueues, submissions: allDecisions, policy, queueSnapshotContentHash });
assert.equal(allBuilt.audit.publishable, true);
for (const decision of policy.allowedDecisions) assert.equal(allBuilt.audit.recordCoverage.decisionDistribution[decision], 1);

const deterministic = buildWeightedMembershipAdditionalEvidenceReviewDecisionImport({
  queueRecords: [structuredClone(queue)], submissions: [structuredClone(submission)], policy: structuredClone(policy), queueSnapshotContentHash
});
assert.equal(hash(deterministic), hash(built));

assertAtomicFailure([queue], [structuredClone(queue.decisionTemplate)]);
assertAtomicFailure([queue], []);
assertAtomicFailure([queue], [{ ...submission, reviewer: null }]);
assertAtomicFailure([queue], [{ ...submission, reviewer: 'Codex' }]);
assertAtomicFailure([queue], [{ ...submission, reviewer: 'ChatGPT Reviewer' }]);
assertAtomicFailure([queue], [{ ...submission, reviewedAt: '2026-09-05T09:59:59.000Z' }]);
assertAtomicFailure([queue], [{ ...submission, reviewedAt: 'not-a-time' }]);
assertAtomicFailure([queue], [{ ...submission, reviewedAt: '2026-02-31T10:30:00.000Z' }]);
assertAtomicFailure([queue], [{ ...submission, decision: 'approve_everything' }]);
assertAtomicFailure([queue], [{ ...submission, decisionSourceRevisions: [] }]);
assertAtomicFailure([queue], [{ ...submission, reviewNotes: ' ' }]);
assertAtomicFailure([queue], [{ ...submission, evidenceFingerprint: hash('stale') }]);
assertAtomicFailure([queue], [{ ...submission, structuralCandidateKey: 'candidate:wrong' }]);
assertAtomicFailure([queue], [{ ...submission, sourceDispositionRecordContentHash: hash('wrong') }]);
assertAtomicFailure([queue], [{ ...submission, sourceDispositionSnapshotContentHash: hash('wrong') }]);
assertAtomicFailure([queue], [{ ...submission, sourceEvidencePacketKey: 'packet:wrong' }]);
assertAtomicFailure([queue], [{ ...submission, sourceEvidencePacketRecordContentHash: hash('wrong') }]);
assertAtomicFailure([queue], [{ ...submission, sourceEvidencePacketSnapshotContentHash: hash('wrong') }]);
assertAtomicFailure([queue], [{ ...submission, templateContentHash: hash('wrong') }]);
assertAtomicFailure([queue], [{ ...submission, extraField: true }]);
assertAtomicFailure([queue], [submission, submission]);
assertAtomicFailure([queue, queue], [submission]);
assertAtomicFailure([{ ...queue, currentBaseLevel: 34 }], [submission]);
assertAtomicFailure([queue], [{ ...submission, currentXp: 1000 }]);
assertAtomicFailure([queue], [submission], { ...structuredClone(policy), rules: { ...policy.rules, automaticVerificationAllowed: true } });
assertAtomicFailure([queue], [submission], { ...structuredClone(policy), candidateKeys: [queue.structuralCandidateKey] });

const tamperedQueue = structuredClone(queue);
tamperedQueue.candidateDisplay.value = 'Altered candidate';
assertAtomicFailure([tamperedQueue], [submission]);
const tamperedTemplateQueue = structuredClone(queue);
tamperedTemplateQueue.decisionTemplate.reviewer = 'Prefilled';
tamperedTemplateQueue.recordContentHash = hash(Object.fromEntries(Object.entries(tamperedTemplateQueue).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))));
tamperedTemplateQueue.contentHash = hash(Object.fromEntries(Object.entries(tamperedTemplateQueue).filter(([key]) => key !== 'contentHash')));
assertAtomicFailure([tamperedTemplateQueue], [submission]);
const tamperedLineQueue = structuredClone(queue);
tamperedLineQueue.exactParentSectionObservations[0].exactMatchedLines[0].exactSourceText += ' altered';
tamperedLineQueue.recordContentHash = hash(Object.fromEntries(Object.entries(tamperedLineQueue).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))));
tamperedLineQueue.contentHash = hash(Object.fromEntries(Object.entries(tamperedLineQueue).filter(([key]) => key !== 'contentHash')));
assertAtomicFailure([tamperedLineQueue], [submission]);

const promoted = structuredClone(built.records);
promoted[0].semanticDispositionApplied = true;
promoted[0].parentMembershipVerdict = 'member';
promoted[0].weightedTaskEntryMembershipVerdict = 'member';
promoted[0].optimizerEligible = true;
promoted[0].recordContentHash = hash(Object.fromEntries(Object.entries(promoted[0]).filter(([key]) => key !== 'recordContentHash')));
const promotedAudit = auditWeightedMembershipAdditionalEvidenceReviewDecisionImport(promoted, {
  queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash
});
assert.equal(promotedAudit.publishable, false);
assert.equal(promotedAudit.semanticPreservationCoverage.unsupportedPromotions.length, 1);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-additional-membership-review-import-'));
try {
  const snapshotDirectory = path.join(temporaryRoot, '2026-09-05T10-00-00-000Z');
  fs.mkdirSync(snapshotDirectory, { recursive: true });
  const cliQueue = Array.from({ length: 47 }, (_, index) => queueRecord(index + 1));
  const raw = cliQueue.map(record => JSON.stringify(record)).join('\n') + '\n';
  fs.writeFileSync(path.join(snapshotDirectory, 'weighted-parent-task-entry-membership-additional-evidence-review-queue.ndjson'), raw);
  fs.writeFileSync(path.join(snapshotDirectory, 'manifest.json'), JSON.stringify({
    domain: 'weighted-parent-task-entry-membership-additional-evidence-review-queue',
    records: cliQueue.length,
    contentHash: hash(raw),
    source: { audit: {
      queueExportComplete: true,
      weightedMembershipReviewComplete: false,
      optimizerEligibleCount: 0,
      completeActivityUniverse: false,
      publishable: true,
      queueCoverage: {
        reviewQueueEntryCount: 47,
        blankDecisionTemplateCount: 47,
        missingOutputKeys: [],
        unexpectedOutputKeys: [],
        duplicateOutputKeys: [],
        recordMismatches: [],
        templateMismatches: []
      }
    } }
  }, null, 2));
  const decisionFile = path.join(temporaryRoot, 'blank-decisions.ndjson');
  fs.writeFileSync(decisionFile, cliQueue.map(record => JSON.stringify(record.decisionTemplate)).join('\n') + '\n');
  const result = spawnSync(process.execPath, [
    'platform/transforms/import-weighted-parent-task-entry-membership-additional-evidence-review-decisions.mjs',
    `--root=${temporaryRoot}`,
    `--decisions=${decisionFile}`
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.accepted, false);
  assert.equal(output.outputWritten, false);
  assert.equal(output.audit.submissionCoverage.blankSubmissionCount, 47);
  assert.equal(output.audit.recordCoverage.recordedDecisionCount, 0);
  const outputSnapshots = fs.readdirSync(temporaryRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => fs.existsSync(path.join(temporaryRoot, entry.name, 'weighted-parent-task-entry-membership-additional-evidence-review-decisions.ndjson')));
  assert.equal(outputSnapshots.length, 0);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('Weighted parent-task additional-evidence review decision import checks passed.');
