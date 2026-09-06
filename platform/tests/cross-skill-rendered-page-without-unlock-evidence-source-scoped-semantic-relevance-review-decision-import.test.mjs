import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport,
  buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport,
  compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decisions';
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function observation(ordinal, index) {
  return {
    guideContentHash: hash(`guide:${ordinal}:${index}`), guidePageId: 1000 + ordinal * 10 + index,
    guideRevision: String(15000000 + ordinal * 10 + index), guideTitle: `Guide ${ordinal}-${index}`,
    namespaceId: 0, parserChannel: 'links', parserMetadata: { section: `Section ${index}` },
    parserObservedAt: `2026-09-04T11:0${index}:00.000Z`, parserReportedExists: true,
    requestedTitle: `Target ${ordinal}`, resolutionState: 'current_revision_pinned_page',
    sourcePresence: ordinal % 2 ? 'direct_source_stable_page_id' : 'rendered_only_origin_unattributed'
  };
}

function queueRecord(ordinal = 1, namespaceId = 0, observationCount = 2) {
  const sourceSignatureKey = `wiki-pageid:${2000 + ordinal}|target-source-signature`;
  const sourcePageIdentity = {
    sourcePageId: 2000 + ordinal, sourceNamespaceId: namespaceId, resolvedTitle: `Target ${ordinal}`,
    sourceRevision: String(15100000 + ordinal), sourceTimestamp: '2026-09-04T10:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`, sourceContentHash: hash(`source:${ordinal}`),
    sourceContentBytes: 1000 + ordinal, sourceLineCount: 20 + ordinal
  };
  const observations = Array.from({ length: observationCount }, (_, index) => observation(ordinal, index + 1));
  const targetPageIdentity = {
    redirected: false, resolvedTitle: sourcePageIdentity.resolvedTitle, sourcePageId: sourcePageIdentity.sourcePageId,
    sourceRevision: sourcePageIdentity.sourceRevision, sourceTimestamp: sourcePageIdentity.sourceTimestamp, sourceUrl: sourcePageIdentity.sourceUrl
  };
  const provenancePartition = ordinal % 2 ? 'direct_source_only' : 'rendered_only_origin_unattributed';
  const provenanceRank = queuePolicy.priorityByProvenancePartition[provenancePartition];
  const namespaceRank = namespaceId === 0 ? 0 : 1;
  const base = {
    contract: policy.queueContract, reviewQueueOrdinal: ordinal, sourceQueueOrdinal: ordinal,
    workQueueEntryKey: `${sourceSignatureKey}|source-scoped-semantic-relevance-review`, sourceSignatureKey,
    sourceSignatureRecordContentHash: hash(`signature-record:${ordinal}`), sourceSignatureSnapshotContentHash: hash('signature-snapshot'),
    sourceWorkQueueRecordContentHash: hash(`work-record:${ordinal}`), sourceWorkQueueSnapshotContentHash: hash('work-snapshot'),
    sourceCandidateRecordContentHash: hash(`candidate-record:${ordinal}`), sourceCandidateSnapshotContentHash: hash('candidate-snapshot'),
    sourcePageIdentity, provenancePartition, requestedTitles: [sourcePageIdentity.resolvedTitle],
    retainedGuideContexts: { requestedTitles: [sourcePageIdentity.resolvedTitle], namespaceIds: [namespaceId], guideObservationCount: observations.length, observations, sourcePresenceCounts: {}, targetPageIdentity },
    structuralEvidence: { rootTemplates: [{ template: 'Example', line: 1 }], directCategories: [{ category: 'Examples', line: 20 }], leadParagraphs: [{ ordinal: 1, rawText: 'Exact source evidence.', sourceLocator: { lineStart: 2, lineEnd: 2 } }], headings: [{ ordinal: 1, level: 2, rawTitle: 'Uses', normalizedTitle: 'Uses', line: 5 }] },
    evidenceFingerprint: null,
    reviewPriority: { band: provenanceRank + namespaceRank * 3, provenanceRank, namespaceRank },
    reviewRoute: namespaceId === 0 ? queuePolicy.reviewRoutes.mainNamespace : queuePolicy.reviewRoutes.nonMainNamespace,
    allowedDispositions: [...policy.allowedDecisions],
    reviewQuestion: 'Does this exact revision-pinned source have a material semantic relationship to one or more retained training-guide observations?',
    semanticDisposition: null, reviewer: null, reviewedAt: null, reviewNotes: null, reviewEvidenceKeys: [],
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    mechanicsReviewComplete: false, optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['source_scoped_semantic_relevance_review_pending'], state: policy.queueState
  };
  base.evidenceFingerprint = hash({
    sourceSignatureSnapshotContentHash: base.sourceSignatureSnapshotContentHash, sourceSignatureRecordContentHash: base.sourceSignatureRecordContentHash,
    sourceWorkQueueSnapshotContentHash: base.sourceWorkQueueSnapshotContentHash, sourceWorkQueueRecordContentHash: base.sourceWorkQueueRecordContentHash,
    sourceCandidateSnapshotContentHash: base.sourceCandidateSnapshotContentHash, sourceCandidateRecordContentHash: base.sourceCandidateRecordContentHash,
    sourcePageIdentity: base.sourcePageIdentity, requestedTitles: base.requestedTitles, retainedGuideContexts: base.retainedGuideContexts, structuralEvidence: base.structuralEvidence
  });
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function blankTemplate(queue) {
  const base = {
    contract: policy.submissionContract, workQueueEntryKey: queue.workQueueEntryKey, evidenceFingerprint: queue.evidenceFingerprint,
    sourcePageId: queue.sourcePageIdentity.sourcePageId, sourceRevision: queue.sourcePageIdentity.sourceRevision,
    sourceContentHash: queue.sourcePageIdentity.sourceContentHash, reviewRoute: queue.reviewRoute,
    allowedDispositions: queue.allowedDispositions, decision: null, reviewer: null, reviewedAt: null,
    reviewNotes: null, evidenceKeys: [], state: 'blank_source_scoped_semantic_relevance_review_decision'
  };
  return { ...base, templateContentHash: hash(base) };
}

function observationHashes(queue) { return queue.retainedGuideContexts.observations.map(hash); }
function completedSubmission(queue, decision = policy.allowedDecisions[0], reviewer = 'Human Reviewer') {
  const requiredObservations = decision === 'not_relevant_to_any_retained_training_guide_context' ? observationHashes(queue) : observationHashes(queue).slice(0, 1);
  return {
    ...blankTemplate(queue), decision, reviewer, reviewedAt: '2026-09-06T12:00:00.000Z',
    reviewNotes: 'Reviewed the exact pinned source against every cited guide context.',
    evidenceKeys: [queue.evidenceFingerprint, queue.sourcePageIdentity.sourceContentHash, ...requiredObservations]
  };
}

function build(queueRecords, submissions, changedPolicy = policy, changedQueuePolicy = queuePolicy) {
  return buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport({ queueRecords, submissions, policy: changedPolicy, queuePolicy: changedQueuePolicy, queueSnapshotContentHash, contentHash: hash });
}
function atomicFailure(queueRecords, submissions, changedPolicy = policy, changedQueuePolicy = queuePolicy) {
  const result = build(queueRecords, submissions, changedPolicy, changedQueuePolicy);
  assert.equal(result.audit.publishable, false);
  assert.deepEqual(result.records, []);
  return result.audit;
}

test('policy is generic, fail closed, and pinned to the exact queue-export policy', () => {
  const compiled = compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy(policy, queuePolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy(automatic, queuePolicy, hash).valid, false);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'relevant' };
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy(specific, queuePolicy, hash).valid, false);
  const changedQueue = structuredClone(queuePolicy); changedQueue.reviewRoutes.mainNamespace = 'changed';
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy(policy, changedQueue, hash).valid, false);
});

test('records an explicit human decision without applying semantic or optimizer state', () => {
  const queue = queueRecord();
  const result = build([queue], [completedSubmission(queue)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.reviewDecisionRecordingComplete, true);
  assert.equal(result.audit.semanticRelevanceReviewComplete, false);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].reviewDecisionRecorded, true);
  assert.equal(result.records[0].semanticDispositionApplied, false);
  assert.equal(result.records[0].sourceScopedSemanticRelevanceReview, null);
  assert.equal(result.records[0].canonicalGameEntityIdentity, null);
  assert.equal(result.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing decision field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('supports partial human batches while ignoring exactly bound blank rows', () => {
  const one = queueRecord(1); const two = queueRecord(2, 6);
  const result = build([one, two], [completedSubmission(one), blankTemplate(two)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.submissionCoverage.blankSubmissionCount, 1);
  assert.equal(result.audit.reviewDecisionRecordingComplete, false);
});

test('enforces decision-specific guide-observation evidence coverage', () => {
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3)];
  const submissions = queues.map((queue, index) => completedSubmission(queue, policy.allowedDecisions[index]));
  const result = build(queues, submissions);
  assert.equal(result.audit.publishable, true);
  for (const decision of policy.allowedDecisions) assert.equal(result.audit.recordCoverage.decisionDistribution[decision], 1);
  const missingOneContext = completedSubmission(queues[1], policy.allowedDecisions[1]); missingOneContext.evidenceKeys.pop();
  atomicFailure([queues[1]], [missingOneContext]);
  const noContext = completedSubmission(queues[0]); noContext.evidenceKeys = [queues[0].evidenceFingerprint, queues[0].sourcePageIdentity.sourceContentHash];
  atomicFailure([queues[0]], [noContext]);
});

test('identical explicit submissions produce deterministic records and audit', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  assert.equal(hash(build([queue], [submission])), hash(build([structuredClone(queue)], [structuredClone(submission)])));
});

test('rejects blank-only, partial, automatic, stale, uncited, unknown, duplicate, and account-scoped submissions atomically', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  atomicFailure([queue], [blankTemplate(queue)]);
  atomicFailure([queue], []);
  atomicFailure([queue], [{ ...submission, reviewer: null }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'Codex' }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'ChatGPT Reviewer' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: '2026-09-04T10:30:00.000Z' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: 'not-a-time' }]);
  atomicFailure([queue], [{ ...submission, decision: 'approve_everything' }]);
  atomicFailure([queue], [{ ...submission, reviewNotes: 'too short' }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [] }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [queue.evidenceFingerprint, queue.sourcePageIdentity.sourceContentHash, hash('unbound')] }]);
  atomicFailure([queue], [{ ...submission, evidenceFingerprint: hash('stale') }]);
  atomicFailure([queue], [{ ...submission, templateContentHash: hash('stale') }]);
  atomicFailure([queue], [{ ...submission, extraField: true }]);
  atomicFailure([queue], [submission, submission]);
  atomicFailure([queue, queue], [submission]);
  atomicFailure([{ ...queue, currentBaseLevel: 34 }], [submission]);
  atomicFailure([queue], [{ ...submission, currentXp: 1000 }]);
});

test('rejects tampered queue context and any attempted downstream promotion', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  const tampered = structuredClone(queue);
  tampered.retainedGuideContexts.observations[0].guideTitle = 'Changed';
  tampered.recordContentHash = hash(without(tampered, 'contentHash', 'recordContentHash'));
  tampered.contentHash = hash(without(tampered, 'contentHash'));
  atomicFailure([tampered], [submission]);
  const result = build([queue], [submission]);
  const promoted = structuredClone(result.records);
  promoted[0].semanticDispositionApplied = true;
  promoted[0].sourceScopedSemanticRelevanceReview = { disposition: promoted[0].decision };
  promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(without(promoted[0], 'recordContentHash'));
  const audit = auditRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport(promoted, { queueRecords: [queue], submissions: [submission], policy, queuePolicy, queueSnapshotContentHash, contentHash: hash });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI rejects a real-shape blank template without writing decisions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-semantic-relevance-review-import-'));
  try {
    const directory = path.join(root, '2026-09-06T03-00-00-000Z'); fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2, 6)];
    const raw = queues.map(JSON.stringify).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      contract: 'sensum.ingestion-manifest.v1', domain: 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue', records: queues.length, contentHash: hash(raw),
      source: { policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash }, audit: {
        queueExportComplete: true, semanticRelevanceReviewComplete: false, reconciliationComplete: false, completeActivityUniverse: false, publishable: true,
        queueCoverage: { reviewQueueEntryCount: 2, blankDecisionTemplateCount: 2, duplicateOutputKeys: [], missingOutputKeys: [], unexpectedOutputKeys: [], mismatchKeys: [], priorityOrderMatches: true },
        semanticPreservationCoverage: { semanticDispositionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, mechanicsReviewCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, decidedTemplateCount: 0 }
      } }
    }));
    const decisionFile = path.join(root, 'blank-decisions.ndjson');
    fs.writeFileSync(decisionFile, queues.map(queue => JSON.stringify(blankTemplate(queue))).join('\n') + '\n');
    const command = spawnSync(process.execPath, ['platform/transforms/import-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decisions.mjs', `--root=${root}`, `--decisions=${decisionFile}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, false);
    assert.equal(output.outputWritten, false);
    assert.equal(output.audit.submissionCoverage.blankSubmissionCount, 2);
    assert.equal(output.audit.recordCoverage.recordedDecisionCount, 0);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, `${outputDomain}.ndjson`))).length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill rendered-page/no-unlock source-scoped semantic-relevance review decision import checks passed.');
