import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hash } from '../ingestion/lib.mjs';
import {
  auditWeightedParentTaskEntryMembershipReviewDecisionImport,
  buildWeightedParentTaskEntryMembershipReviewDecisionImport,
  compileWeightedParentTaskEntryMembershipReviewDecisionImportPolicy
} from '../transforms/weighted-parent-task-entry-membership-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);

function queueRecord(ordinal = 1, route = 'candidate_subject_corroboration_review_ready') {
  const structuralCandidateKey = `candidate:${ordinal}`;
  const queueEntryKey = `${structuralCandidateKey}|weighted-review:${ordinal}`;
  const sourceDispositionKey = `${structuralCandidateKey}|disposition`;
  const sourceEvidencePacketKey = `${structuralCandidateKey}|evidence`;
  const sourceDispositionRecordContentHash = hash(`disposition-record:${ordinal}`);
  const sourceEvidenceRecordContentHash = hash(`evidence-record:${ordinal}`);
  const sourceEvidencePacketContentHash = hash(`packet:${ordinal}`);
  const evidenceFingerprint = hash(`fingerprint:${ordinal}`);
  const candidateRole = 'item_delivery_target_candidate';
  const identities = [
    {
      sourceKey: `wiki-pageid:${100 + ordinal}|revision:${200 + ordinal}`,
      roles: ['candidate_subject_source'],
      sourcePageId: 100 + ordinal,
      resolvedTitle: `Candidate ${ordinal}`,
      sourceRevision: String(200 + ordinal),
      sourceTimestamp: '2026-09-04T10:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Candidate_${ordinal}`,
      sourceContentHash: hash(`candidate-source:${ordinal}`),
      sourceContentBytes: 1000 + ordinal
    },
    {
      sourceKey: `wiki-pageid:${300 + ordinal}|revision:${400 + ordinal}`,
      roles: ['parent_inventory_source'],
      sourcePageId: 300 + ordinal,
      resolvedTitle: 'Parent task inventory',
      sourceRevision: String(400 + ordinal),
      sourceTimestamp: '2026-09-05T10:00:00Z',
      sourceUrl: 'https://oldschool.runescape.wiki/w/Parent_task_inventory',
      sourceContentHash: hash(`parent-source:${ordinal}`),
      sourceContentBytes: 2000 + ordinal
    }
  ];
  const sourceRevisions = identities.map(source => source.sourceRevision).sort();
  const templateBase = {
    contract: policy.submissionContract,
    queueEntryKey,
    sourceDispositionRecordContentHash,
    sourceEvidenceRecordContentHash,
    sourceDispositionKey,
    sourceEvidencePacketKey,
    sourceEvidencePacketContentHash,
    evidenceFingerprint,
    structuralCandidateKey,
    candidateRole,
    evidenceSourceIdentityFingerprint: hash(identities),
    allowedDecisions: [...policy.allowedDecisions],
    decisionSourceRevisions: [],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_source_bound_weighted_membership_review_decision'
  };
  const decisionTemplate = { ...templateBase, templateContentHash: hash(templateBase) };
  const base = {
    contract: policy.queueContract,
    queueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionRecordContentHash,
    sourceEvidenceRecordContentHash,
    sourceDispositionKey,
    sourceEvidencePacketKey,
    sourceEvidencePacketContentHash,
    evidenceFingerprint,
    structuralCandidateKey,
    candidateRole,
    candidateDisplay: { value: `Candidate ${ordinal}`, source: { sourcePageId: 100 + ordinal, sourceRevision: String(200 + ordinal) } },
    evidenceSourceIdentities: identities,
    sourceRevisions,
    reviewEvidence: {
      route,
      candidateScopedWeightStatements: route === 'candidate_scoped_weight_review_ready' ? [{ observationOrdinal: 1 }] : [],
      candidateSubjectCorroborations: route === 'candidate_subject_corroboration_review_ready' ? [{ observationOrdinal: 1 }] : [],
      parentOccurrence: { integrity: { complete: true } },
      nonCandidateParentContext: { candidateMembershipProof: false }
    },
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate,
    weightedTaskEntryMembershipVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.queueState
  };
  return { ...base, contentHash: hash(base) };
}

function completedSubmission(queue, decision = policy.allowedDecisions[0], reviewer = 'Human Reviewer') {
  return {
    ...structuredClone(queue.decisionTemplate),
    decision,
    reviewer,
    reviewedAt: '2026-09-05T10:30:00.000Z',
    decisionSourceRevisions: [...queue.sourceRevisions].reverse(),
    reviewNotes: 'Compared the exact pinned candidate evidence with its exact parent occurrence and source scope.'
  };
}

function assertAtomicFailure(queueRecords, submissions, changedPolicy = policy) {
  const built = buildWeightedParentTaskEntryMembershipReviewDecisionImport({
    queueRecords,
    submissions,
    policy: changedPolicy,
    queueSnapshotContentHash
  });
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  return built.audit;
}

const compiled = compileWeightedParentTaskEntryMembershipReviewDecisionImportPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const queue = queueRecord();
const submission = completedSubmission(queue);
const built = buildWeightedParentTaskEntryMembershipReviewDecisionImport({ queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.reviewDecisionRecordingComplete, true);
assert.equal(built.audit.weightedMembershipReviewComplete, false);
assert.equal(built.audit.queueCoverage.completeQueueRecordCount, 1);
assert.equal(built.audit.bindingCoverage.exactImmutableQueueBindingCount, 1);
assert.equal(built.records.length, 1);
assert.equal(built.records[0].decision, policy.allowedDecisions[0]);
assert.equal(built.records[0].semanticDispositionApplied, false);
assert.equal(built.records[0].weightedMembershipReviewDecision, null);
assert.equal(built.records[0].weightedTaskEntryMembershipVerdict, null);
assert.equal(built.records[0].candidateMemberIdentityVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing decision field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const queueTwo = queueRecord(2, 'candidate_scoped_weight_review_ready');
const partialBatch = buildWeightedParentTaskEntryMembershipReviewDecisionImport({
  queueRecords: [queue, queueTwo],
  submissions: [completedSubmission(queue), structuredClone(queueTwo.decisionTemplate)],
  policy,
  queueSnapshotContentHash
});
assert.equal(partialBatch.audit.publishable, true);
assert.equal(partialBatch.records.length, 1);
assert.equal(partialBatch.audit.submissionCoverage.blankSubmissionCount, 1);
assert.equal(partialBatch.audit.reviewDecisionRecordingComplete, false);

const allDecisions = [queue, queueTwo, queueRecord(3)].map((entry, index) => completedSubmission(entry, policy.allowedDecisions[index]));
const allBuilt = buildWeightedParentTaskEntryMembershipReviewDecisionImport({
  queueRecords: [queue, queueTwo, queueRecord(3)], submissions: allDecisions, policy, queueSnapshotContentHash
});
assert.equal(allBuilt.audit.publishable, true);
for (const decision of policy.allowedDecisions) assert.equal(allBuilt.audit.recordCoverage.decisionDistribution[decision], 1);

const deterministic = buildWeightedParentTaskEntryMembershipReviewDecisionImport({
  queueRecords: [structuredClone(queue)], submissions: [structuredClone(submission)], policy: structuredClone(policy), queueSnapshotContentHash
});
assert.equal(hash(deterministic), hash(built));

assertAtomicFailure([queue], [structuredClone(queue.decisionTemplate)]);
assertAtomicFailure([queue], []);
assertAtomicFailure([queue], [{ ...submission, reviewer: null }]);
assertAtomicFailure([queue], [{ ...submission, reviewer: 'Codex' }]);
assertAtomicFailure([queue], [{ ...submission, reviewer: 'Codex Reviewer' }]);
assertAtomicFailure([queue], [{ ...submission, reviewedAt: '2026-09-05T09:59:59.000Z' }]);
assertAtomicFailure([queue], [{ ...submission, reviewedAt: 'not-a-time' }]);
assertAtomicFailure([queue], [{ ...submission, reviewedAt: '2026-02-31T10:30:00.000Z' }]);
assertAtomicFailure([queue], [{ ...submission, decision: 'approve_everything' }]);
assertAtomicFailure([queue], [{ ...submission, decisionSourceRevisions: [queue.sourceRevisions[0]] }]);
assertAtomicFailure([queue], [{ ...submission, reviewNotes: ' ' }]);
assertAtomicFailure([queue], [{ ...submission, evidenceFingerprint: hash('stale') }]);
assertAtomicFailure([queue], [{ ...submission, structuralCandidateKey: 'candidate:wrong' }]);
assertAtomicFailure([queue], [{ ...submission, sourceDispositionRecordContentHash: hash('wrong') }]);
assertAtomicFailure([queue], [{ ...submission, sourceEvidenceRecordContentHash: hash('wrong') }]);
assertAtomicFailure([queue], [{ ...submission, sourceEvidencePacketKey: 'packet:wrong' }]);
assertAtomicFailure([queue], [{ ...submission, sourceEvidencePacketContentHash: hash('wrong') }]);
assertAtomicFailure([queue], [{ ...submission, evidenceSourceIdentityFingerprint: hash('wrong') }]);
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
tamperedTemplateQueue.contentHash = hash(Object.fromEntries(Object.entries(tamperedTemplateQueue).filter(([key]) => key !== 'contentHash')));
assertAtomicFailure([tamperedTemplateQueue], [submission]);
const tamperedSourceQueue = structuredClone(queue);
tamperedSourceQueue.evidenceSourceIdentities[0].sourceTimestamp = '2026-09-06T10:00:00Z';
tamperedSourceQueue.contentHash = hash(Object.fromEntries(Object.entries(tamperedSourceQueue).filter(([key]) => key !== 'contentHash')));
assertAtomicFailure([tamperedSourceQueue], [submission]);

const promoted = structuredClone(built.records);
promoted[0].semanticDispositionApplied = true;
promoted[0].weightedTaskEntryMembershipVerdict = 'member';
promoted[0].optimizerEligible = true;
promoted[0].recordContentHash = hash(Object.fromEntries(Object.entries(promoted[0]).filter(([key]) => key !== 'recordContentHash')));
const promotedAudit = auditWeightedParentTaskEntryMembershipReviewDecisionImport(promoted, {
  queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash
});
assert.equal(promotedAudit.publishable, false);
assert.equal(promotedAudit.semanticPreservationCoverage.unsupportedPromotions.length, 1);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-weighted-review-import-'));
try {
  const snapshotDirectory = path.join(temporaryRoot, '2026-09-05T10-00-00-000Z');
  fs.mkdirSync(snapshotDirectory, { recursive: true });
  const cliQueue = [queueRecord(1), queueRecord(2), queueRecord(3), queueRecord(4)];
  const raw = cliQueue.map(record => JSON.stringify(record)).join('\n') + '\n';
  fs.writeFileSync(path.join(snapshotDirectory, 'weighted-parent-task-entry-membership-review-queue.ndjson'), raw);
  fs.writeFileSync(path.join(snapshotDirectory, 'manifest.json'), JSON.stringify({
    domain: 'weighted-parent-task-entry-membership-review-queue',
    records: cliQueue.length,
    contentHash: hash(raw),
    source: { audit: {
      queueExportComplete: true,
      weightedMembershipReviewComplete: false,
      optimizerEligibleCount: 0,
      completeActivityUniverse: false,
      publishable: true,
      queuePartitionCoverage: {
        reviewQueueEntryCount: 4,
        blankDecisionTemplateCount: 4,
        variantScopeEvidenceQueueEntryCount: 8,
        additionalMembershipEvidenceQueueEntryCount: 47,
        totalQueueEntryCount: 59,
        missingDispositionKeys: [],
        unexpectedDispositionKeys: [],
        duplicateQueueDispositionKeys: [],
        crossQueueKeys: []
      }
    } }
  }, null, 2));
  const decisionFile = path.join(temporaryRoot, 'blank-decisions.ndjson');
  fs.writeFileSync(decisionFile, cliQueue.map(record => JSON.stringify(record.decisionTemplate)).join('\n') + '\n');
  const result = spawnSync(process.execPath, [
    'platform/transforms/import-weighted-parent-task-entry-membership-review-decisions.mjs',
    `--root=${temporaryRoot}`,
    `--decisions=${decisionFile}`
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.accepted, false);
  assert.equal(output.outputWritten, false);
  assert.equal(output.audit.submissionCoverage.blankSubmissionCount, 4);
  assert.equal(output.audit.recordCoverage.recordedDecisionCount, 0);
  const outputSnapshots = fs.readdirSync(temporaryRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => fs.existsSync(path.join(temporaryRoot, entry.name, 'weighted-parent-task-entry-membership-review-decisions.ndjson')));
  assert.equal(outputSnapshots.length, 0);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('Weighted parent-task entry membership review decision import tests passed.');
