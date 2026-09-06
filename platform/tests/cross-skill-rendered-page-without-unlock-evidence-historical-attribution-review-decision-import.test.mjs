import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditHistoricalAttributionReviewDecisionImport,
  buildHistoricalAttributionReviewDecisionImport,
  compileHistoricalAttributionReviewDecisionImportPolicy,
  expectedHistoricalAttributionBlankDecision
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);
const queueSnapshotCreatedAt = '2026-09-06T02:19:44.355Z';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decisions';
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const exactRevisionUrl = revision => `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}`;

function historicalObservation(ordinal, index) {
  const observation = {
    guideContentHash: hash(`guide:${ordinal}:${index}`), guidePageId: 1000 + ordinal * 10 + index,
    guideRevision: String(15300000 + ordinal * 10 + index), guideTitle: `Training guide ${ordinal}-${index}`,
    namespaceId: 0, parserChannel: index % 2 ? 'links' : 'images', parserMetadata: { section: `Section ${index}` },
    parserObservedAt: index === 1 ? '2026-09-04T12:01:00.66Z' : `2026-09-04T12:0${index}:00.000Z`, parserReportedExists: true,
    requestedTitle: `Target ${ordinal}`, resolutionState: 'current_revision_pinned_page',
    sourcePresence: 'rendered_only_origin_unattributed'
  };
  return {
    observationKey: hash({ renderedTargetKey: `wiki-pageid:${2000 + ordinal}`, observation }),
    observationContentHash: hash(observation), exactGuideRevisionUrl: exactRevisionUrl(observation.guideRevision), observation
  };
}

function queueRecord(ordinal = 1, observationCount = 2) {
  const renderedTargetKey = `wiki-pageid:${2000 + ordinal}`;
  const sourceWorkQueueEntryKey = `${renderedTargetKey}|without-unlock-evidence-partition|source-bound-reconciliation-work`;
  const observations = Array.from({ length: observationCount }, (_, index) => historicalObservation(ordinal, index + 1));
  const bindings = observations.map(row => {
    const observation = row.observation;
    const base = {
      guidePageId: observation.guidePageId, guideTitle: observation.guideTitle,
      guideRevision: observation.guideRevision, guideContentHash: observation.guideContentHash,
      exactGuideRevisionUrl: row.exactGuideRevisionUrl, observationKeys: [row.observationKey]
    };
    return { ...base, observationCount: 1, bindingContentHash: hash(base) };
  });
  const base = {
    contract: policy.queueContract,
    historicalAttributionWorkEntryKey: `${sourceWorkQueueEntryKey}|historical-rendered-attribution-work`,
    queueOrdinal: ordinal, sourceWorkQueueOrdinal: 100 + ordinal, sourceWorkQueueEntryKey,
    sourceWorkQueueRecordContentHash: hash(`source-work-record:${ordinal}`),
    sourceWorkQueueIntrinsicRecordContentHash: hash(`source-work-intrinsic:${ordinal}`),
    sourceWorkQueueSnapshotContentHash: hash('source-work-snapshot'),
    sourcePartitionSnapshotContentHash: hash('partition-snapshot'),
    sourceCandidateContentHash: hash(`candidate:${ordinal}`), sourceCandidateSnapshotContentHash: hash('candidate-snapshot'),
    renderedTargetKey,
    stableWikiPageIdentity: {
      redirected: false, resolvedTitle: `Target ${ordinal}`, sourcePageId: 2000 + ordinal,
      sourceRevision: String(15200000 + ordinal), sourceTimestamp: '2026-09-04T10:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`
    },
    provenancePartition: ordinal % 2 ? 'mixed_direct_and_unattributed_rendered' : 'rendered_only_origin_unattributed',
    requiredEvidenceChannel: queuePolicy.requiredEvidenceChannel, guideObservationCount: observationCount + (ordinal % 2 ? 1 : 0),
    historicalRenderedObservationCount: observations.length,
    historicalRenderedObservationSetContentHash: hash(observations), historicalRenderedObservations: observations,
    historicalGuideRevisionBindingCount: bindings.length,
    historicalGuideRevisionBindingsContentHash: hash(bindings), historicalGuideRevisionBindings: bindings,
    requiredAttributionEvidence: queuePolicy.requiredAttributionEvidence, nonClaims: queuePolicy.nonClaims,
    historicalRenderedExpansionDependencyAttribution: null, attributionEvidenceKeys: [], reviewDecision: null,
    requirementOrUnlockApplied: false, semanticDisposition: null, canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null, repeatabilityClassification: null, mechanicsReviewComplete: false,
    optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['historical_rendered_expansion_dependency_attribution_pending'],
    state: policy.queueState
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function attribution(queue, observation, outcome = policy.allowedAttributionOutcomes[0], ordinal = 1) {
  const dependencyRevision = String(15100000 + ordinal);
  const dependencyContentHash = hash(`dependency:${queue.renderedTargetKey}:${ordinal}`);
  return {
    observationKey: observation.observationKey, observationContentHash: observation.observationContentHash,
    attributionOutcome: outcome, dependencyKind: 'template', dependencyPageId: 3000 + ordinal,
    dependencyNamespaceId: 10, dependencyTitle: `Template:Training ${ordinal}`, dependencyRevision,
    dependencyTimestamp: '2026-09-04T09:00:00Z', dependencyContentHash,
    exactDependencyRevisionUrl: exactRevisionUrl(dependencyRevision),
    generativeSourceLocator: { kind: 'template_parameter', value: `method_${ordinal}` },
    evidenceKeys: [observation.observationKey, observation.observationContentHash, observation.observation.guideContentHash, dependencyContentHash]
  };
}

function allQueueEvidence(queue) {
  return [...new Set([
    queueSnapshotContentHash, queue.contentHash, queue.recordContentHash, queue.sourceWorkQueueRecordContentHash,
    queue.sourceWorkQueueIntrinsicRecordContentHash, queue.sourceWorkQueueSnapshotContentHash,
    queue.sourcePartitionSnapshotContentHash, queue.sourceCandidateContentHash, queue.sourceCandidateSnapshotContentHash,
    queue.historicalRenderedObservationSetContentHash, queue.historicalGuideRevisionBindingsContentHash,
    ...queue.historicalRenderedObservations.flatMap(row => [row.observationKey, row.observationContentHash, row.observation.guideContentHash]),
    ...queue.historicalGuideRevisionBindings.flatMap(row => [row.bindingContentHash, row.guideContentHash])
  ])];
}

function completedSubmission(queue, disposition = policy.allowedDecisions[0], reviewer = 'Human Reviewer') {
  let observationAttributions = [];
  if (disposition === policy.allowedDecisions[0]) observationAttributions = queue.historicalRenderedObservations.map((row, index) => attribution(queue, row, policy.allowedAttributionOutcomes[0], index + 1));
  if (disposition === policy.allowedDecisions[1]) observationAttributions = [attribution(queue, queue.historicalRenderedObservations[0], policy.allowedAttributionOutcomes[1], 1)];
  const core = [queueSnapshotContentHash, queue.contentHash, queue.recordContentHash, queue.sourceWorkQueueRecordContentHash,
    queue.sourceCandidateContentHash, queue.historicalRenderedObservationSetContentHash, queue.historicalGuideRevisionBindingsContentHash];
  const evidenceKeys = disposition === policy.allowedDecisions[2]
    ? allQueueEvidence(queue)
    : [...new Set([...core, ...observationAttributions.flatMap(row => [row.dependencyContentHash, ...row.evidenceKeys])])];
  return {
    ...expectedHistoricalAttributionBlankDecision(queue, policy), disposition, observationAttributions, evidenceKeys,
    reviewer, reviewedAt: '2026-09-07T12:00:00.000Z',
    notes: 'Reviewed every cited historical observation against exact revision-pinned dependency evidence.'
  };
}

function build(queueRecords, submissions, changedPolicy = policy, changedQueuePolicy = queuePolicy) {
  return buildHistoricalAttributionReviewDecisionImport({ queueRecords, submissions, policy: changedPolicy,
    queuePolicy: changedQueuePolicy, queueSnapshotContentHash, queueSnapshotCreatedAt, contentHash: hash });
}

function atomicFailure(queueRecords, submissions, changedPolicy = policy, changedQueuePolicy = queuePolicy) {
  const result = build(queueRecords, submissions, changedPolicy, changedQueuePolicy);
  assert.equal(result.audit.publishable, false);
  assert.deepEqual(result.records, []);
  return result.audit;
}

test('policy is generic, fail closed, and pinned to the exact queue policy', () => {
  const compiled = compileHistoricalAttributionReviewDecisionImportPolicy(policy, queuePolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileHistoricalAttributionReviewDecisionImportPolicy(automatic, queuePolicy, hash).valid, false);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'confirm' };
  assert.equal(compileHistoricalAttributionReviewDecisionImportPolicy(specific, queuePolicy, hash).valid, false);
  const changedQueue = structuredClone(queuePolicy); changedQueue.requiredEvidenceChannel = 'changed';
  assert.equal(compileHistoricalAttributionReviewDecisionImportPolicy(policy, changedQueue, hash).valid, false);
});

test('records complete per-observation attribution without applying it downstream', () => {
  const queue = queueRecord();
  const result = build([queue], [completedSubmission(queue)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].submittedObservationAttributions.length, queue.historicalRenderedObservationCount);
  assert.equal(result.records[0].historicalAttributionApplied, false);
  assert.equal(result.records[0].historicalRenderedExpansionDependencyAttribution, null);
  assert.equal(result.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing decision field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('records rejected proposals and evidence-unavailable outcomes without resolving attribution', () => {
  const rejectedQueue = queueRecord(1); const unavailableQueue = queueRecord(2);
  const result = build([rejectedQueue, unavailableQueue], [
    completedSubmission(rejectedQueue, policy.allowedDecisions[1]),
    completedSubmission(unavailableQueue, policy.allowedDecisions[2])
  ]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.recordCoverage.decisionDistribution[policy.allowedDecisions[1]], 1);
  assert.equal(result.audit.recordCoverage.decisionDistribution[policy.allowedDecisions[2]], 1);
  assert.equal(result.records[1].submittedObservationAttributions.length, 0);
  assert.equal(result.audit.historicalAttributionApplicationComplete, false);
});

test('supports a partial human batch while ignoring an exactly bound blank row', () => {
  const one = queueRecord(1); const two = queueRecord(2);
  const result = build([one, two], [completedSubmission(one), expectedHistoricalAttributionBlankDecision(two, policy)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.submissionCoverage.blankSubmissionCount, 1);
  assert.equal(result.audit.reviewDecisionRecordingComplete, false);
});

test('enforces complete confirmation, rejected-proposal, and evidence-unavailable shapes', () => {
  const queue = queueRecord();
  const incomplete = completedSubmission(queue); incomplete.observationAttributions.pop();
  atomicFailure([queue], [incomplete]);
  const wrongOutcome = completedSubmission(queue); wrongOutcome.observationAttributions[0].attributionOutcome = policy.allowedAttributionOutcomes[1];
  atomicFailure([queue], [wrongOutcome]);
  const emptyReject = completedSubmission(queue, policy.allowedDecisions[1]); emptyReject.observationAttributions = [];
  atomicFailure([queue], [emptyReject]);
  const proposedUnavailable = completedSubmission(queue, policy.allowedDecisions[2]); proposedUnavailable.observationAttributions = [attribution(queue, queue.historicalRenderedObservations[0])];
  atomicFailure([queue], [proposedUnavailable]);
  const uncitedUnavailable = completedSubmission(queue, policy.allowedDecisions[2]); uncitedUnavailable.evidenceKeys.pop();
  atomicFailure([queue], [uncitedUnavailable]);
});

test('rejects malformed dependency identity, revision URL, locator, and attribution evidence', () => {
  const queue = queueRecord();
  for (const mutate of [
    row => { row.dependencyNamespaceId = 0; },
    row => { row.exactDependencyRevisionUrl = 'https://example.com/revision/1'; },
    row => { row.generativeSourceLocator = { kind: 'guess', value: 'maybe' }; },
    row => { row.evidenceKeys = row.evidenceKeys.slice(0, -1); },
    row => { row.extraField = true; }
  ]) {
    const submission = completedSubmission(queue); mutate(submission.observationAttributions[0]);
    atomicFailure([queue], [submission]);
  }
});

test('identical explicit submissions produce deterministic records and audit', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  assert.equal(hash(build([queue], [submission])), hash(build([structuredClone(queue)], [structuredClone(submission)])));
});

test('rejects blank-only, partial, automatic, stale, unknown, duplicate, and account-scoped submissions atomically', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  atomicFailure([queue], [expectedHistoricalAttributionBlankDecision(queue, policy)]);
  atomicFailure([queue], []);
  atomicFailure([queue], [{ ...submission, reviewer: null }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'Codex' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: '2026-09-04T11:00:00.000Z' }]);
  atomicFailure([queue], [{ ...submission, disposition: 'approve_everything' }]);
  atomicFailure([queue], [{ ...submission, notes: 'too short' }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [...submission.evidenceKeys, hash('unbound')] }]);
  atomicFailure([queue], [{ ...submission, sourceCandidateContentHash: hash('stale') }]);
  atomicFailure([queue], [{ ...submission, extraField: true }]);
  atomicFailure([queue], [submission, submission]);
  atomicFailure([queue, queue], [submission]);
  atomicFailure([{ ...queue, currentBaseLevel: 34 }], [submission]);
  atomicFailure([queue], [{ ...submission, currentXp: 1000 }]);
});

test('independent audit rejects queue drift and any attempted downstream application', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  const drift = structuredClone(queue); drift.historicalRenderedObservations[0].observation.guideTitle = 'Changed';
  drift.recordContentHash = hash(without(drift, 'contentHash', 'recordContentHash')); drift.contentHash = hash(without(drift, 'contentHash'));
  atomicFailure([drift], [submission]);
  const result = build([queue], [submission]);
  const promoted = structuredClone(result.records);
  promoted[0].historicalAttributionApplied = true;
  promoted[0].historicalRenderedExpansionDependencyAttribution = { applied: true };
  promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(without(promoted[0], 'recordContentHash'));
  const audit = auditHistoricalAttributionReviewDecisionImport(promoted, {
    queueRecords: [queue], submissions: [submission], policy, queuePolicy,
    queueSnapshotContentHash, queueSnapshotCreatedAt, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI rejects a real-shape blank template and writes only an explicit valid partial decision', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-historical-attribution-review-import-'));
  try {
    const directory = path.join(root, '2026-09-06T02-19-44-355Z'); fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2)];
    const raw = queues.map(JSON.stringify).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      contract: 'sensum.ingestion-manifest.v1', domain: 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue',
      createdAt: queueSnapshotCreatedAt, records: queues.length, contentHash: hash(raw),
      source: { policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash }, audit: {
        queueExportComplete: true, historicalAttributionComplete: false, completeActivityUniverse: false, publishable: true,
        queueCoverage: { expectedRecordCount: 2, outputRecordCount: 2, duplicateOutputKeys: [], missingOutputKeys: [], unexpectedOutputKeys: [], recordMismatchKeys: [], orderMatchesFilteredSourceQueue: true },
        observationCoverage: { outputHistoricalRenderedObservationCount: 4, exactHistoricalObservationPopulation: true, duplicateObservationKeys: [], missingObservationKeys: [], unexpectedObservationKeys: [], directObservationLeakKeys: [] },
        reviewCoverage: { blankDecisionTemplateCount: 2, reviewStartedCount: 0, attributionCompletedCount: 0 },
        semanticPreservationCoverage: { requirementOrUnlockApplicationCount: 0, semanticDispositionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassificationCount: 0, mechanicsReviewCompleteCount: 0, optimizerPromotionCount: 0, automaticVerificationCount: 0, unsupportedPromotionKeys: [] }
      } }
    }));
    const decisionFile = path.join(root, 'blank-decisions.ndjson');
    fs.writeFileSync(decisionFile, queues.map(queue => JSON.stringify(expectedHistoricalAttributionBlankDecision(queue, policy))).join('\n') + '\n');
    const command = spawnSync(process.execPath, [
      'platform/transforms/import-cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decisions.mjs',
      `--root=${root}`, `--decisions=${decisionFile}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, false);
    assert.equal(output.outputWritten, false);
    assert.equal(output.audit.submissionCoverage.blankSubmissionCount, 2);
    assert.equal(output.audit.recordCoverage.recordedDecisionCount, 0);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() &&
      fs.existsSync(path.join(root, entry.name, `${outputDomain}.ndjson`))).length, 0);
    const acceptedSubmission = completedSubmission(queues[0]);
    acceptedSubmission.evidenceKeys = acceptedSubmission.evidenceKeys.map(key => key === queueSnapshotContentHash ? hash(raw) : key);
    fs.writeFileSync(decisionFile, [acceptedSubmission, expectedHistoricalAttributionBlankDecision(queues[1], policy)].map(JSON.stringify).join('\n') + '\n');
    const accepted = spawnSync(process.execPath, [
      'platform/transforms/import-cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decisions.mjs',
      `--root=${root}`, `--decisions=${decisionFile}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
    const acceptedOutput = JSON.parse(accepted.stdout);
    assert.equal(acceptedOutput.accepted, true);
    const decisionSnapshots = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() &&
      fs.existsSync(path.join(root, entry.name, `${outputDomain}.ndjson`)));
    assert.equal(decisionSnapshots.length, 1);
    const decisionRows = fs.readFileSync(path.join(root, decisionSnapshots[0].name, `${outputDomain}.ndjson`), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(decisionRows.length, 1);
    assert.equal(decisionRows[0].historicalAttributionApplied, false);
    assert.equal(decisionRows[0].optimizerEligible, false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill rendered-page/no-unlock historical attribution review decision import checks passed.');
