import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditCrossSkillUntypedPageReviewDecisionImport,
  buildCrossSkillUntypedPageReviewDecisionImport,
  compileCrossSkillUntypedPageReviewDecisionImportPolicy
} from '../transforms/cross-skill-untyped-page-source-bound-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-untyped-page-source-bound-review-decision-import-v1.json', 'utf8'));
const pageTypePolicy = JSON.parse(fs.readFileSync('platform/policies/unlock-linked-page-entity-type-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-untyped-page-source-bound-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-untyped-page-source-bound-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);
const allowedPageTypes = Object.keys(pageTypePolicy.types).sort();

function queueRecord(ordinal = 1, namespaceId = 0) {
  const candidateKey = `osrs-wiki-pageid:${100 + ordinal}`;
  const queueEntryKey = `${candidateKey}|source-bound-untyped-page-review`;
  const sourcePageIdentity = {
    sourcePageId: 100 + ordinal,
    resolvedTitle: namespaceId === 0 ? `Example ${ordinal}` : `File:Example_${ordinal}.png`,
    sourceNamespaceId: namespaceId,
    sourceRevision: String(9000 + ordinal),
    sourceTimestamp: '2026-09-04T10:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Example_${ordinal}`,
    sourceContentHash: hash(`source:${ordinal}`),
    sourceContentBytes: 1000 + ordinal,
    sourceLineCount: 20 + ordinal
  };
  const sourceSignatureContexts = [{
    targetKey: `wiki-title:example-${ordinal}`,
    requestedTitle: `Example ${ordinal}`,
    requestedFragment: null,
    redirected: false,
    pageId: 100 + ordinal,
    identitySourceRevision: String(9000 + ordinal),
    sourceSignatureContentHash: hash(`signature:${ordinal}`),
    referencedBy: { skillKeys: ['smithing'], statementKeys: [`smithing:${ordinal}`] }
  }];
  const structuralEvidence = {
    rootTemplates: [{ template: 'Example', templateKey: 'example', line: 1 }],
    directCategories: [{ category: 'Examples', categoryKey: 'examples', line: 20 }],
    leadParagraphs: [{ ordinal: 1, rawText: 'Example evidence.', sourceLocator: { lineStart: 2, lineEnd: 2 } }],
    headings: [{ ordinal: 1, level: 2, rawTitle: 'Uses', normalizedTitle: 'Uses', line: 5 }],
    summary: { sourceSignatureContextCount: 1, rootTemplateCount: 1, directCategoryCount: 1, leadParagraphCount: 1, headingCount: 1 }
  };
  const base = {
    contract: policy.queueContract,
    queueEntryKey,
    candidateKey,
    sourceDispositionRecordContentHash: hash(`disposition-record:${ordinal}`),
    sourceDispositionSnapshotContentHash: hash(`disposition-snapshot:${ordinal}`),
    sourceEvidenceRecordContentHash: hash(`evidence-record:${ordinal}`),
    sourceEvidenceSnapshotContentHash: hash(`evidence-snapshot:${ordinal}`),
    evidenceFingerprint: hash(`evidence-fingerprint:${ordinal}`),
    queueEntryEvidenceFingerprint: null,
    sourcePageIdentity,
    skillKeys: ['smithing'],
    statementKeys: [`smithing:${ordinal}`],
    sourceSignatureContexts,
    structuralEvidence,
    reviewRoute: namespaceId === 0 ? 'explicit_main_namespace_page_type_review' : 'explicit_non_main_namespace_scope_review',
    allowedDecisions: [...policy.allowedDecisions],
    allowedPageTypes,
    reviewDecision: null,
    reviewedPageTypes: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    reviewEvidenceKeys: [],
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['explicit_untyped_page_review_pending'],
    state: policy.queueState
  };
  const queueEntryEvidenceFingerprint = hash({
    candidateKey: base.candidateKey,
    sourceDispositionRecordContentHash: base.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: base.sourceDispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: base.sourceEvidenceRecordContentHash,
    sourceEvidenceSnapshotContentHash: base.sourceEvidenceSnapshotContentHash,
    evidenceFingerprint: base.evidenceFingerprint,
    sourcePageIdentity: base.sourcePageIdentity,
    skillKeys: [...base.skillKeys].sort(),
    statementKeys: [...base.statementKeys].sort(),
    sourceSignatureContexts: base.sourceSignatureContexts,
    structuralEvidence: base.structuralEvidence,
    reviewRoute: base.reviewRoute
  });
  const bound = { ...base, queueEntryEvidenceFingerprint };
  return { ...bound, contentHash: hash(bound) };
}

function blankTemplate(queue) {
  const base = {
    contract: policy.submissionContract,
    queueEntryKey: queue.queueEntryKey,
    queueEntryEvidenceFingerprint: queue.queueEntryEvidenceFingerprint,
    candidateKey: queue.candidateKey,
    sourceDispositionRecordContentHash: queue.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: queue.sourceDispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: queue.sourceEvidenceRecordContentHash,
    sourceEvidenceSnapshotContentHash: queue.sourceEvidenceSnapshotContentHash,
    sourcePageId: queue.sourcePageIdentity.sourcePageId,
    sourceRevision: queue.sourcePageIdentity.sourceRevision,
    sourceContentHash: queue.sourcePageIdentity.sourceContentHash,
    reviewRoute: queue.reviewRoute,
    allowedDecisions: queue.allowedDecisions,
    allowedPageTypes: queue.allowedPageTypes,
    decision: null,
    selectedPageTypes: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    evidenceKeys: [],
    state: 'blank_explicit_human_review_template'
  };
  return { ...base, templateContentHash: hash(base) };
}

function completedSubmission(queue, decision = policy.allowedDecisions[0], selectedPageTypes = ['item_page'], reviewer = 'Human Reviewer') {
  return {
    ...blankTemplate(queue),
    decision,
    selectedPageTypes,
    reviewer,
    reviewedAt: '2026-09-05T10:30:00.000Z',
    reviewNotes: 'Reviewed the exact pinned source and retained structural evidence.',
    evidenceKeys: [queue.sourcePageIdentity.sourceContentHash]
  };
}

function build(queueRecords, submissions, changedPolicy = policy) {
  return buildCrossSkillUntypedPageReviewDecisionImport({ queueRecords, submissions, policy: changedPolicy, pageTypePolicy, queueSnapshotContentHash, contentHash: hash });
}

function atomicFailure(queueRecords, submissions, changedPolicy = policy) {
  const result = build(queueRecords, submissions, changedPolicy);
  assert.equal(result.audit.publishable, false);
  assert.equal(result.records.length, 0);
  return result.audit;
}

test('policy is generic, fail-closed, and bound to the existing page-type vocabulary', () => {
  const compiled = compileCrossSkillUntypedPageReviewDecisionImportPolicy(policy, pageTypePolicy);
  assert.equal(compiled.valid, true);
  assert.equal(compiled.allowedPageTypes.length, 22);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileCrossSkillUntypedPageReviewDecisionImportPolicy(automatic, pageTypePolicy).valid, false);
  const specific = structuredClone(policy);
  specific.candidateKeys = ['osrs-wiki-pageid:101'];
  assert.equal(compileCrossSkillUntypedPageReviewDecisionImportPolicy(specific, pageTypePolicy).valid, false);
});

test('records an explicit human decision without applying page type or semantic state', () => {
  const queue = queueRecord();
  const result = build([queue], [completedSubmission(queue)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.reviewDecisionRecordingComplete, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].decision, 'assign_one_or_more_existing_page_types');
  assert.deepEqual(result.records[0].selectedPageTypes, ['item_page']);
  assert.equal(result.records[0].pageTypeDispositionApplied, false);
  assert.equal(result.records[0].pageTypeReview, null);
  assert.equal(result.records[0].canonicalGameEntityIdentity, null);
  assert.equal(result.records[0].canonicalActivityIdentity, null);
  assert.equal(result.records[0].repeatabilityClassification, null);
  assert.equal(result.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing decision field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('supports partial human batches while ignoring correctly bound blank rows', () => {
  const one = queueRecord(1);
  const two = queueRecord(2, 6);
  const result = build([one, two], [completedSubmission(one), blankTemplate(two)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.submissionCoverage.blankSubmissionCount, 1);
  assert.equal(result.audit.reviewDecisionRecordingComplete, false);
});

test('enforces decision-specific page-type rules and all three allowed decisions', () => {
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3)];
  const submissions = [
    completedSubmission(queues[0], policy.allowedDecisions[0], ['item_page', 'equipment_page']),
    completedSubmission(queues[1], policy.allowedDecisions[1], []),
    completedSubmission(queues[2], policy.allowedDecisions[2], [])
  ];
  const result = build(queues, submissions);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 3);
  for (const decision of policy.allowedDecisions) assert.equal(result.audit.recordCoverage.decisionDistribution[decision], 1);
  atomicFailure([queues[0]], [completedSubmission(queues[0], policy.allowedDecisions[0], [])]);
  atomicFailure([queues[0]], [completedSubmission(queues[0], policy.allowedDecisions[1], ['item_page'])]);
  atomicFailure([queues[0]], [completedSubmission(queues[0], policy.allowedDecisions[0], ['invented_page_type'])]);
  atomicFailure([queues[0]], [completedSubmission(queues[0], policy.allowedDecisions[0], ['item_page', 'item_page'])]);
});

test('identical completed submissions produce deterministic decision records and audit', () => {
  const queue = queueRecord();
  const submission = completedSubmission(queue);
  assert.equal(hash(build([queue], [submission])), hash(build([structuredClone(queue)], [structuredClone(submission)])));
});

test('rejects blank-only, partial, automated, stale, uncited, unknown, duplicate, and account-scoped submissions atomically', () => {
  const queue = queueRecord();
  const submission = completedSubmission(queue);
  atomicFailure([queue], [blankTemplate(queue)]);
  atomicFailure([queue], []);
  atomicFailure([queue], [{ ...submission, reviewer: null }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'Codex' }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'ChatGPT Reviewer' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: '2026-09-04T09:59:59.000Z' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: 'not-a-time' }]);
  atomicFailure([queue], [{ ...submission, decision: 'approve_everything' }]);
  atomicFailure([queue], [{ ...submission, reviewNotes: ' ' }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [] }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [hash('unbound')] }]);
  atomicFailure([queue], [{ ...submission, sourceEvidenceRecordContentHash: hash('stale') }]);
  atomicFailure([queue], [{ ...submission, templateContentHash: hash('stale') }]);
  atomicFailure([queue], [{ ...submission, extraField: true }]);
  atomicFailure([queue], [submission, submission]);
  atomicFailure([queue, queue], [submission]);
  atomicFailure([{ ...queue, currentBaseLevel: 34 }], [submission]);
  atomicFailure([queue], [{ ...submission, currentXp: 1000 }]);
});

test('rejects tampered queue evidence and attempted semantic promotion', () => {
  const queue = queueRecord();
  const submission = completedSubmission(queue);
  const tampered = structuredClone(queue);
  tampered.structuralEvidence.leadParagraphs[0].rawText = 'Changed';
  tampered.contentHash = hash(Object.fromEntries(Object.entries(tampered).filter(([key]) => key !== 'contentHash')));
  atomicFailure([tampered], [submission]);
  const result = build([queue], [submission]);
  const promoted = structuredClone(result.records);
  promoted[0].pageTypeDispositionApplied = true;
  promoted[0].pageTypeReview = { state: 'reviewed', disposition: 'item_page' };
  promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(Object.fromEntries(Object.entries(promoted[0]).filter(([key]) => key !== 'recordContentHash')));
  const audit = auditCrossSkillUntypedPageReviewDecisionImport(promoted, { queueRecords: [queue], submissions: [submission], policy, pageTypePolicy, queueSnapshotContentHash, contentHash: hash });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI rejects a real-shape blank review template without writing decisions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-untyped-review-import-'));
  try {
    const directory = path.join(root, '2026-09-05T10-00-00-000Z');
    fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2, 6)];
    const raw = queues.map(record => JSON.stringify(record)).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-untyped-page-source-bound-review-queue.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      domain: 'cross-skill-untyped-page-source-bound-review-queue',
      records: queues.length,
      contentHash: hash(raw),
      source: { audit: {
        queueExportComplete: true,
        pageTypeReviewComplete: false,
        completeActivityUniverse: false,
        publishable: true,
        queueCoverage: { reviewQueueEntryCount: 2, blankDecisionTemplateCount: 2, duplicateOutputCandidateKeys: [], missingOutputCandidateKeys: [], unexpectedOutputCandidateKeys: [], recordMismatchCandidateKeys: [], orderMatchesDispositionOrder: true },
        semanticPreservationCoverage: { recordedReviewCount: 0, reviewedPageTypeCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, optimizerEligibleCount: 0, decidedTemplateCount: 0 }
      } }
    }, null, 2));
    const decisionFile = path.join(root, 'blank-decisions.ndjson');
    fs.writeFileSync(decisionFile, queues.map(queue => JSON.stringify(blankTemplate(queue))).join('\n') + '\n');
    const result = spawnSync(process.execPath, ['platform/transforms/import-cross-skill-untyped-page-source-bound-review-decisions.mjs', `--root=${root}`, `--decisions=${decisionFile}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.accepted, false);
    assert.equal(output.outputWritten, false);
    assert.equal(output.audit.submissionCoverage.blankSubmissionCount, 2);
    assert.equal(output.audit.recordCoverage.recordedDecisionCount, 0);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'cross-skill-untyped-page-source-bound-review-decisions.ndjson'))).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill untyped-page source-bound review decision import checks passed.');
