import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditUnresolvedRenderedTargetResolutionReviewDecisionImport,
  buildUnresolvedRenderedTargetResolutionReviewDecisionImport,
  compileUnresolvedRenderedTargetResolutionReviewDecisionImportPolicy
} from '../transforms/cross-skill-unresolved-rendered-target-resolution-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-resolution-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);
const withEvidenceHash = base => ({ ...base, evidenceContentHash: hash(base) });

function identity(pageId, title, revision) {
  return { sourcePageId: pageId, namespaceId: 0, resolvedTitle: title, sourceRevision: String(revision), sourceTimestamp: '2026-09-05T10:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`, sourceContentHash: hash(`source:${pageId}:${revision}`), sourceContentBytes: 100, sourceLineCount: 5 };
}

function queueRecord(ordinal = 1, mode = 'candidate') {
  const title = `Requested title ${ordinal}`;
  const currentIdentity = mode === 'current' ? identity(200 + ordinal, title, 700 + ordinal) : null;
  const candidateIdentity = mode === 'candidate' ? identity(300 + ordinal, `Candidate ${ordinal}`, 800 + ordinal) : null;
  const pinnedGuide = withEvidenceHash({
    guidePageId: 100, guideTitle: 'Guide', guideRevision: '500', guideContentHash: hash('guide'), parserChannel: 'links', requestedTitle: title,
    pinnedGuideSourceIdentity: identity(100, 'Guide', 500), exactSourceOccurrences: [{ occurrenceKey: `occurrence:${ordinal}`, sourceTarget: title, sourceLocator: { line: 2, excerpt: `[[${title}]]` } }],
    alignment: { fetchedGuidePresent: true, guidePageIdMatches: true, guideTitleMatches: true, guideRevisionMatches: true, guideContentHashMatches: true, sourceLinkDelimitersBalanced: true, mediaWikiNormalizedRequestedTitleOccurrencePresent: true }
  });
  const current = withEvidenceHash({ requestedTitle: title, queryComplete: true, resolutionState: currentIdentity ? 'current_revision_pinned_page_evidence' : 'current_missing_wiki_page_evidence', currentPageEvidence: currentIdentity, currentMissingPage: currentIdentity ? null : { namespaceId: 0, title }, canonicalIdentityApplied: false });
  const discovery = withEvidenceHash({ requestedTitle: title, queryComplete: true, candidateCount: candidateIdentity ? 1 : 0, candidates: candidateIdentity ? [{ searchRank: 1, sourcePageIdentity: candidateIdentity, leadParagraphEvidence: [], headingEvidence: [], candidateIdentityApplied: false }] : [], selectedCandidatePageId: null, canonicalIdentityApplied: false });
  const log = withEvidenceHash({ requestedTitle: title, queryComplete: true, eventCount: 0, events: [], canonicalIdentityApplied: false });
  const allowedDecisions = mode === 'current'
    ? ['confirm_exact_current_resolution', 'needs_additional_evidence']
    : ['confirm_revision_pinned_candidate_resolution', 'reject_all_presented_resolution_candidates', 'needs_additional_evidence'];
  const base = {
    contract: policy.queueContract,
    queueEntryKey: `wiki-title:${title}|resolution-review-queue`,
    queueOrdinal: ordinal,
    sourceDispositionKey: `wiki-title:${title}|disposition`,
    sourceDispositionRecordContentHash: hash(`disposition:${ordinal}`),
    sourceEvidenceRecordContentHash: hash(`evidence:${ordinal}`),
    sourceDispositionSnapshotContentHash: hash('disposition-snapshot'),
    sourceEvidenceSnapshotContentHash: hash('evidence-snapshot'),
    evidenceFingerprint: hash(`fingerprint:${ordinal}`),
    renderedTargetKey: `wiki-title:${title}`,
    requestedTitles: [title],
    resolutionEvidence: {
      guideObservations: [{ guidePageId: 100, guideRevision: '500', requestedTitle: title }],
      pinnedGuideEvidence: [pinnedGuide],
      currentTitleResolutionEvidence: [current],
      titleLogEvidence: [log],
      discoveryEvidence: [discovery]
    },
    allowedDecisions,
    decisionTemplate: { decision: null, selectedPageId: null, selectedTitle: null, evidenceKeys: [], reviewer: null, reviewedAt: null, reviewNotes: null },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    state: policy.queueState
  };
  return { ...base, contentHash: hash(base) };
}

function blankTemplate(queue) {
  return {
    contract: policy.submissionContract,
    queueEntryKey: queue.queueEntryKey,
    queueEntryContentHash: queue.contentHash,
    sourceDispositionKey: queue.sourceDispositionKey,
    sourceDispositionRecordContentHash: queue.sourceDispositionRecordContentHash,
    sourceEvidenceRecordContentHash: queue.sourceEvidenceRecordContentHash,
    sourceDispositionSnapshotContentHash: queue.sourceDispositionSnapshotContentHash,
    sourceEvidenceSnapshotContentHash: queue.sourceEvidenceSnapshotContentHash,
    evidenceFingerprint: queue.evidenceFingerprint,
    allowedDecisions: queue.allowedDecisions,
    decision: null,
    selectedPageId: null,
    selectedTitle: null,
    evidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_explicit_human_resolution_review_template'
  };
}

function completedSubmission(queue, decision = queue.allowedDecisions[0], reviewer = 'Human Reviewer') {
  const current = queue.resolutionEvidence.currentTitleResolutionEvidence[0].currentPageEvidence;
  const candidate = queue.resolutionEvidence.discoveryEvidence[0].candidates[0]?.sourcePageIdentity;
  const selected = decision === 'confirm_exact_current_resolution' ? current : decision === 'confirm_revision_pinned_candidate_resolution' ? candidate : null;
  return {
    ...blankTemplate(queue),
    decision,
    selectedPageId: selected?.sourcePageId ?? null,
    selectedTitle: selected?.resolvedTitle ?? null,
    evidenceKeys: [selected?.sourceContentHash || queue.evidenceFingerprint],
    reviewer,
    reviewedAt: '2026-09-06T10:00:00.000Z',
    reviewNotes: 'Reviewed the exact source-bound resolution evidence.'
  };
}

const build = (queueRecords, submissions, changedPolicy = policy) => buildUnresolvedRenderedTargetResolutionReviewDecisionImport({ queueRecords, submissions, policy: changedPolicy, queueSnapshotContentHash, contentHash: hash });
function atomicFailure(queueRecords, submissions, changedPolicy = policy) {
  const result = build(queueRecords, submissions, changedPolicy);
  assert.equal(result.audit.publishable, false);
  assert.equal(result.records.length, 0);
  return result.audit;
}

test('policy is generic and fail closed', () => {
  const compiled = compileUnresolvedRenderedTargetResolutionReviewDecisionImportPolicy(policy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnresolvedRenderedTargetResolutionReviewDecisionImportPolicy(automatic, hash).valid, false);
  const specific = structuredClone(policy);
  specific.titleOverrides = { Example: 'confirm' };
  assert.equal(compileUnresolvedRenderedTargetResolutionReviewDecisionImportPolicy(specific, hash).valid, false);
});

test('records a source-bound human decision without applying the resolution or semantic state', () => {
  const queue = queueRecord();
  const result = build([queue], [completedSubmission(queue)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.reviewDecisionRecordingComplete, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].decision, 'confirm_revision_pinned_candidate_resolution');
  assert.equal(result.records[0].resolutionDispositionApplied, false);
  assert.equal(result.records[0].canonicalGameEntityIdentity, null);
  assert.equal(result.records[0].canonicalActivityIdentity, null);
  assert.equal(result.records[0].repeatabilityClassification, null);
  assert.equal(result.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing decision field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('supports partial human batches while ignoring exactly bound blank rows', () => {
  const one = queueRecord(1);
  const two = queueRecord(2);
  const result = build([one, two], [completedSubmission(one), blankTemplate(two)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.submissionCoverage.blankSubmissionCount, 1);
  assert.equal(result.audit.reviewDecisionRecordingComplete, false);
});

test('enforces all four decision-specific selection rules', () => {
  const queues = [queueRecord(1, 'current'), queueRecord(2), queueRecord(3), queueRecord(4)];
  const submissions = [
    completedSubmission(queues[0], 'confirm_exact_current_resolution'),
    completedSubmission(queues[1], 'confirm_revision_pinned_candidate_resolution'),
    completedSubmission(queues[2], 'reject_all_presented_resolution_candidates'),
    completedSubmission(queues[3], 'needs_additional_evidence')
  ];
  const result = build(queues, submissions);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 4);
  for (const decision of policy.allowedDecisions) assert.equal(result.audit.recordCoverage.decisionDistribution[decision], 1);
  atomicFailure([queues[0]], [{ ...submissions[0], selectedPageId: 999 }]);
  atomicFailure([queues[1]], [{ ...submissions[1], selectedTitle: 'Wrong candidate' }]);
  atomicFailure([queues[2]], [{ ...submissions[2], selectedPageId: 302, selectedTitle: 'Candidate 2' }]);
  atomicFailure([queues[0]], [{ ...submissions[0], decision: 'confirm_revision_pinned_candidate_resolution' }]);
});

test('identical inputs create deterministic decision records and audit', () => {
  const queue = queueRecord();
  const submission = completedSubmission(queue);
  assert.equal(hash(build([queue], [submission])), hash(build([structuredClone(queue)], [structuredClone(submission)])));
});

test('rejects blank-only, missing, partial, automatic, stale, uncited, unbound, duplicate, and account-scoped submissions atomically', () => {
  const queue = queueRecord();
  const submission = completedSubmission(queue);
  atomicFailure([queue], [blankTemplate(queue)]);
  atomicFailure([queue], []);
  atomicFailure([queue], [{ ...submission, reviewer: null }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'Codex' }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'ChatGPT Reviewer' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: '2026-09-05T09:59:59.000Z' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: 'not-a-time' }]);
  atomicFailure([queue], [{ ...submission, decision: 'approve_everything' }]);
  atomicFailure([queue], [{ ...submission, reviewNotes: 'short' }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [] }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [hash('unbound')] }]);
  atomicFailure([queue], [{ ...submission, sourceEvidenceRecordContentHash: hash('stale') }]);
  atomicFailure([queue], [{ ...submission, extraField: true }]);
  atomicFailure([queue], [submission, submission]);
  atomicFailure([queue, queue], [submission]);
  atomicFailure([{ ...queue, currentBaseLevel: 34 }], [submission]);
  atomicFailure([queue], [{ ...submission, currentXp: 1000 }]);
});

test('rejects tampered nested queue evidence and attempted semantic promotion', () => {
  const queue = queueRecord();
  const submission = completedSubmission(queue);
  const tampered = structuredClone(queue);
  tampered.resolutionEvidence.discoveryEvidence[0].queryComplete = false;
  tampered.contentHash = hash(Object.fromEntries(Object.entries(tampered).filter(([key]) => key !== 'contentHash')));
  atomicFailure([tampered], [submission]);
  const result = build([queue], [submission]);
  const promoted = structuredClone(result.records);
  promoted[0].resolutionDispositionApplied = true;
  promoted[0].canonicalGameEntityIdentity = { pageId: promoted[0].selectedPageId };
  promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(Object.fromEntries(Object.entries(promoted[0]).filter(([key]) => key !== 'recordContentHash')));
  const audit = auditUnresolvedRenderedTargetResolutionReviewDecisionImport(promoted, { queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash, contentHash: hash });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotionDecisionKeys.length, 1);
});

test('CLI rejects a real-shape blank template without writing a decision snapshot', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-rendered-resolution-review-import-'));
  try {
    const directory = path.join(root, '2026-09-05T10-00-00-000Z');
    fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2)];
    const raw = queues.map(record => JSON.stringify(record)).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-unresolved-rendered-target-resolution-review-queue.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      domain: 'cross-skill-unresolved-rendered-target-resolution-review-queue', records: queues.length, contentHash: hash(raw),
      source: { audit: {
        queueExportComplete: true, resolutionReviewComplete: false, completeActivityUniverse: false, publishable: true,
        queuePartitionCoverage: { reviewQueueEntryCount: 2, blankDecisionTemplateCount: 2, duplicateQueueDispositionKeys: [], missingQueueDispositionKeys: [], unexpectedQueueDispositionKeys: [], crossQueueDispositionKeys: [], reviewRecordMismatchKeys: [], reviewOrderMatches: true },
        semanticPreservationCoverage: { recordedReviewCount: 0, selectedResolutionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, optimizerEligibleCount: 0, decidedTemplateCount: 0 }
      } }
    }, null, 2));
    const decisionFile = path.join(root, 'blank-decisions.ndjson');
    fs.writeFileSync(decisionFile, queues.map(queue => JSON.stringify(blankTemplate(queue))).join('\n') + '\n');
    const result = spawnSync(process.execPath, ['platform/transforms/import-cross-skill-unresolved-rendered-target-resolution-review-decisions.mjs', `--root=${root}`, `--decisions=${decisionFile}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.accepted, false);
    assert.equal(output.outputWritten, false);
    assert.equal(output.audit.submissionCoverage.blankSubmissionCount, 2);
    assert.equal(output.audit.recordCoverage.recordedDecisionCount, 0);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'cross-skill-unresolved-rendered-target-resolution-review-decisions.ndjson'))).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill unresolved rendered-target resolution review decision import checks passed.');
