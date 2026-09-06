import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditUnlockCorpusAbsenceReconciliationReviewDecisionImport,
  buildUnlockCorpusAbsenceReconciliationReviewDecisionImport,
  compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy,
  expectedUnlockCorpusAbsenceBlankDecision
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = hash('queue-snapshot');
const queueSnapshotCreatedAt = '2026-09-06T01:29:20.075Z';
const corpusEvidenceContentHash = hash('complete-corpus-evidence');
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decisions';
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function queueRecord(ordinal = 1) {
  const renderedTargetKey = `wiki-pageid:${10000 + ordinal}`;
  const sourceWorkQueueEntryKey = `${renderedTargetKey}|without-unlock-evidence-partition|source-bound-reconciliation-work`;
  const corpusEvidence = {
    capturedStatementCount: 4768,
    definition: queuePolicy.corpusDefinition,
    emptyParameterCount: 2111,
    equivalenceSnapshotContentHash: hash('equivalence-snapshot'),
    equivalenceStatementReferenceCount: 6375,
    equivalenceTargetReferenceCount: 3567,
    inventorySnapshotContentHash: hash('inventory-snapshot'),
    levelUpTableSourceSetContentHash: hash('level-up-table-source-set'),
    matchBasis: queuePolicy.matchBasis,
    officialSkillCount: 24,
    parameterCount: 3870,
    skillDomainRevision: '15321845',
    stableWikiPageIdCount: 3474,
    stableWikiPageIdSetContentHash: hash('stable-wiki-page-id-set'),
    statementTargetRelationCount: 6375,
    statementTargetRelationSetContentHash: hash('statement-target-relation-set')
  };
  const base = {
    absenceWorkEntryKey: `${sourceWorkQueueEntryKey}|unlock-corpus-absence-reconciliation-work`,
    accountIndependent: true,
    automaticVerificationApplied: false,
    blockers: ['level_unlock_corpus_absence_reconciliation_review_pending'],
    canonicalActivityIdentity: null,
    canonicalGameEntityIdentity: null,
    contract: policy.queueContract,
    corpusEvidence,
    corpusEvidenceContentHash,
    findingScope: {
      machineFinding: queuePolicy.machineFinding,
      nonClaims: [...queuePolicy.nonClaims],
      statement: 'The stable page ID is absent from this exact pinned corpus.'
    },
    matchEvidence: {
      corpusStableWikiPageIdCount: corpusEvidence.stableWikiPageIdCount,
      exactStablePageIdMatchCount: 0,
      machineObservedZeroMatch: true,
      matchBasis: queuePolicy.matchBasis,
      matchingCanonicalWikiPageKeys: [],
      targetSourcePageId: 10000 + ordinal,
      titleAliasFragmentNamespaceOrSemanticMatchingUsed: false
    },
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    queueOrdinal: ordinal,
    renderedTargetKey,
    repeatabilityClassification: null,
    reviewDecision: null,
    reviewEvidenceKeys: [],
    reviewNotes: null,
    reviewedAt: null,
    reviewer: null,
    semanticDisposition: null,
    sourceCrosswalkRecordContentHash: hash(`crosswalk-record:${ordinal}`),
    sourceCrosswalkSnapshotContentHash: hash('crosswalk-snapshot'),
    sourceWorkQueueEntryKey,
    sourceWorkQueueIntrinsicRecordContentHash: hash(`source-work-queue-intrinsic:${ordinal}`),
    sourceWorkQueueRecordContentHash: hash(`source-work-queue-record:${ordinal}`),
    sourceWorkQueueSnapshotContentHash: hash('source-work-queue-snapshot'),
    stableWikiPageIdentity: {
      redirected: false,
      resolvedTitle: `Target ${ordinal}`,
      sourcePageId: 10000 + ordinal,
      sourceRevision: String(15300000 + ordinal),
      sourceTimestamp: '2026-09-05T10:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`
    },
    state: policy.queueState,
    unlockEvidencePresent: false
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function blankTemplate(queue) {
  return expectedUnlockCorpusAbsenceBlankDecision(queue, policy);
}

function completedSubmission(queue, disposition = policy.allowedDecisions[0], reviewer = 'Human Reviewer') {
  const evidenceKeys = [
    queueSnapshotContentHash,
    queue.contentHash,
    queue.recordContentHash,
    queue.sourceWorkQueueRecordContentHash,
    queue.sourceCrosswalkRecordContentHash,
    queue.corpusEvidenceContentHash
  ];
  if (disposition !== 'confirm_corpus_absence_finding') {
    evidenceKeys.push(queue.corpusEvidence.stableWikiPageIdSetContentHash, queue.corpusEvidence.statementTargetRelationSetContentHash);
  }
  return {
    ...blankTemplate(queue),
    disposition,
    reviewer,
    reviewedAt: '2026-09-06T12:00:00.000Z',
    evidenceKeys,
    notes: 'Reviewed the exact pinned target, queue record, crosswalk, and complete corpus evidence.'
  };
}

function build(queueRecords, submissions, changedPolicy = policy, changedQueuePolicy = queuePolicy) {
  return buildUnlockCorpusAbsenceReconciliationReviewDecisionImport({
    queueRecords,
    submissions,
    policy: changedPolicy,
    queuePolicy: changedQueuePolicy,
    queueSnapshotContentHash,
    queueSnapshotCreatedAt,
    queueManifestCorpusEvidenceContentHash: corpusEvidenceContentHash,
    contentHash: hash
  });
}

function atomicFailure(queueRecords, submissions, changedPolicy = policy, changedQueuePolicy = queuePolicy) {
  const result = build(queueRecords, submissions, changedPolicy, changedQueuePolicy);
  assert.equal(result.audit.publishable, false);
  assert.deepEqual(result.records, []);
  return result.audit;
}

test('policy is generic, fail closed, and pinned to the exact absence queue policy', () => {
  const compiled = compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy(policy, queuePolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy(automatic, queuePolicy, hash).valid, false);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'confirm' };
  assert.equal(compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy(specific, queuePolicy, hash).valid, false);
  const changedQueue = structuredClone(queuePolicy); changedQueue.machineFinding = 'changed';
  assert.equal(compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy(policy, changedQueue, hash).valid, false);
});

test('records a human decision while keeping every requirement, semantic, mechanics, and optimizer gate closed', () => {
  const queue = queueRecord();
  const result = build([queue], [completedSubmission(queue)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.reviewDecisionRecordingComplete, true);
  assert.equal(result.audit.absenceReconciliationComplete, false);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].reviewDecisionRecorded, true);
  assert.equal(result.records[0].corpusAbsenceReconciliationApplied, false);
  assert.equal(result.records[0].levelUnlockCorpusAbsenceReconciliation, null);
  assert.equal(result.records[0].noRequirementClaimApplied, false);
  assert.equal(result.records[0].semanticDisposition, null);
  assert.equal(result.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing decision field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('allows partial human batches and ignores only exactly bound blank rows', () => {
  const one = queueRecord(1); const two = queueRecord(2);
  const result = build([one, two], [completedSubmission(one), blankTemplate(two)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.submissionCoverage.blankSubmissionCount, 1);
  assert.equal(result.audit.reviewDecisionRecordingComplete, false);
  const staleBlank = blankTemplate(two); staleBlank.targetSourcePageId += 1;
  atomicFailure([one, two], [completedSubmission(one), staleBlank]);
});

test('supports all three decision routes and enforces granular evidence for reject or additional reconciliation', () => {
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3)];
  const submissions = queues.map((queue, index) => completedSubmission(queue, policy.allowedDecisions[index]));
  const result = build(queues, submissions);
  assert.equal(result.audit.publishable, true);
  for (const decision of policy.allowedDecisions) assert.equal(result.audit.recordCoverage.decisionDistribution[decision], 1);
  assert.equal(result.records[0].reviewOutcomeRoute, 'confirmed_corpus_absence_pending_separate_application');
  assert.equal(result.records[1].reviewOutcomeRoute, 'rejected_corpus_absence_pending_corpus_reaudit');
  assert.equal(result.records[2].reviewOutcomeRoute, 'additional_level_requirement_source_reconciliation_pending');
  for (const index of [1, 2]) {
    const missingGranular = completedSubmission(queues[index], policy.allowedDecisions[index]);
    missingGranular.evidenceKeys = missingGranular.evidenceKeys.filter(key => key !== queues[index].corpusEvidence.statementTargetRelationSetContentHash);
    atomicFailure([queues[index]], [missingGranular]);
  }
});

test('identical explicit decisions produce deterministic records and audits', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  assert.equal(hash(build([queue], [submission])), hash(build([structuredClone(queue)], [structuredClone(submission)])));
});

test('rejects blank-only, partial, automated, stale, uncited, unknown, duplicate, drifted, and account-scoped submissions atomically', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  atomicFailure([queue], [blankTemplate(queue)]);
  atomicFailure([queue], []);
  atomicFailure([queue], [{ ...submission, reviewer: null }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'Codex' }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'ChatGPT Reviewer' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: '2026-09-05T11:00:00.000Z' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: 'not-a-time' }]);
  atomicFailure([queue], [{ ...submission, disposition: 'approve_everything' }]);
  atomicFailure([queue], [{ ...submission, notes: 'too short' }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [] }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [...submission.evidenceKeys, hash('unbound')] }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [...submission.evidenceKeys, submission.evidenceKeys[0]] }]);
  atomicFailure([queue], [{ ...submission, sourceCrosswalkRecordContentHash: hash('stale') }]);
  atomicFailure([queue], [{ ...submission, extraField: true }]);
  atomicFailure([queue], [submission, submission]);
  atomicFailure([queue, queue], [submission]);
  atomicFailure([{ ...queue, currentBaseLevel: 34 }], [submission]);
  atomicFailure([queue], [{ ...submission, currentXp: 1000 }]);
});

test('rejects tampered corpus or zero-match evidence and any attempted downstream promotion', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  const tampered = structuredClone(queue);
  tampered.matchEvidence.exactStablePageIdMatchCount = 1;
  tampered.recordContentHash = hash(without(tampered, 'contentHash', 'recordContentHash'));
  tampered.contentHash = hash(without(tampered, 'contentHash'));
  atomicFailure([tampered], [submission]);
  const countMismatch = structuredClone(queue);
  countMismatch.matchEvidence.corpusStableWikiPageIdCount += 1;
  countMismatch.recordContentHash = hash(without(countMismatch, 'contentHash', 'recordContentHash'));
  countMismatch.contentHash = hash(without(countMismatch, 'contentHash'));
  atomicFailure([countMismatch], [submission]);
  const result = build([queue], [submission]);
  const promoted = structuredClone(result.records);
  promoted[0].corpusAbsenceReconciliationApplied = true;
  promoted[0].levelUnlockCorpusAbsenceReconciliation = { disposition: promoted[0].decision };
  promoted[0].noRequirementClaimApplied = true;
  promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(without(promoted[0], 'recordContentHash'));
  const audit = auditUnlockCorpusAbsenceReconciliationReviewDecisionImport(promoted, {
    queueRecords: [queue], submissions: [submission], policy, queuePolicy, queueSnapshotContentHash,
    queueSnapshotCreatedAt, queueManifestCorpusEvidenceContentHash: corpusEvidenceContentHash, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI rejects a real-shape blank template without writing decision output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-unlock-corpus-absence-review-import-'));
  try {
    const directory = path.join(root, '2026-09-06T01-29-20-075Z');
    fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2)];
    const raw = queues.map(JSON.stringify).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      contract: 'sensum.ingestion-manifest.v1',
      domain: 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue',
      createdAt: queueSnapshotCreatedAt,
      records: queues.length,
      contentHash: hash(raw),
      source: {
        policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash },
        corpusEvidenceContentHash,
        audit: {
          corpusBindingCoverage: { corpusEvidenceContentHash, exactInventoryToEquivalenceStatementTargetRelationSet: true },
          absenceCoverage: { outputRecordCount: queues.length, zeroExactStablePageIdMatchCount: queues.length, duplicateOutputKeys: [], missingOutputKeys: [], unexpectedOutputKeys: [], recordMismatchKeys: [], nonZeroMatchSourceWorkQueueKeys: [], nonZeroMatchOutputKeys: [], orderMatchesSourceQueue: true },
          reviewCoverage: { blankDecisionTemplateCount: queues.length, reviewStartedCount: 0, completedReconciliationCount: 0 },
          semanticPreservationCoverage: { noRequirementClaimCount: 0, semanticDispositionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, mechanicsReviewCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, unsupportedPromotionKeys: [] },
          queueExportComplete: true, absenceReconciliationComplete: false, completeActivityUniverse: false, publishable: true
        }
      }
    }));
    const decisionFile = path.join(root, 'blank-decisions.ndjson');
    fs.writeFileSync(decisionFile, queues.map(queue => JSON.stringify(blankTemplate(queue))).join('\n') + '\n');
    const command = spawnSync(process.execPath, ['platform/transforms/import-cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decisions.mjs', `--root=${root}`, `--decisions=${decisionFile}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, false);
    assert.equal(output.outputWritten, false);
    assert.equal(output.audit.submissionCoverage.blankSubmissionCount, 2);
    assert.equal(output.audit.submissionCoverage.invalidSubmissionIndexes.length, 0);
    assert.equal(output.audit.recordCoverage.recordedDecisionCount, 0);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, `${outputDomain}.ndjson`))).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill unlock-corpus absence reconciliation review decision import checks passed.');
