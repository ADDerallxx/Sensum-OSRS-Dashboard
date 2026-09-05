import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport,
  buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport,
  compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImportPolicy
} from '../transforms/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-import-audit-v1.json', 'utf8'));
const queueSnapshotContentHash = 'a'.repeat(64);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function sourceIdentity(ordinal, title) {
  return { namespaceId: 0, resolvedTitle: title, sourceContentBytes: 100, sourceContentHash: hash(`source:${ordinal}`), sourcePageId: 300000 + ordinal, sourceRevision: String(15000000 + ordinal), sourceTimestamp: '2026-08-27T11:25:17Z', sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}` };
}

function blankTemplate(base) {
  const templateBase = {
    contract: policy.submissionContract, queueEntryKey: base.queueEntryKey, sourceDispositionKey: base.sourceDispositionKey,
    sourceDispositionRecordContentHash: base.sourceDispositionRecordContentHash, sourceDispositionSnapshotContentHash: base.sourceDispositionSnapshotContentHash,
    sourceEvidencePacketKey: base.sourceEvidencePacketKey, sourceEvidencePacketRecordContentHash: base.sourceEvidencePacketRecordContentHash,
    sourceEvidencePacketSnapshotContentHash: base.sourceEvidencePacketSnapshotContentHash, evidenceFingerprint: base.evidenceFingerprint,
    renderedTargetKey: base.renderedTargetKey, requestedTitles: base.requestedTitles, classification: base.classification,
    reviewRoute: base.reviewRoute, allowedDecisions: base.allowedDecisions, decision: null, reviewer: null, reviewedAt: null,
    reviewNotes: null, evidenceKeys: [], selectedResolution: null, state: policy.templateState
  };
  return { ...templateBase, templateContentHash: hash(templateBase) };
}

function queueRecord(ordinal = 1, mode = 'redlink') {
  const title = `Category:Example ${ordinal} guides`;
  const identity = sourceIdentity(ordinal, `Example guide ${ordinal}`);
  const currentEvidenceHash = hash(`current:${ordinal}:${mode}`);
  const described = mode === 'described';
  const pageIdentity = described ? { ...sourceIdentity(100 + ordinal, title), namespaceId: 14 } : null;
  const classification = described ? 'described_category_page_resolution_review_ready' : 'active_redlink_category_target_resolution_review_ready';
  const reviewRoute = described ? 'explicit_source_bound_described_category_page_resolution_review' : 'explicit_source_bound_redlink_category_target_resolution_review';
  const allowedDecisions = described
    ? ['confirm_exact_current_category_page_resolution', 'reject_exact_current_category_page_resolution', 'needs_additional_evidence']
    : ['confirm_active_redlink_category_target', 'reject_active_redlink_category_target', 'needs_additional_evidence'];
  const evidenceHashes = [currentEvidenceHash, hash(`namespace:${ordinal}`), hash(`prefix:${ordinal}`), hash(`members:${ordinal}`), hash(`search:${ordinal}`), hash(`history:${ordinal}`), hash(`guide:${ordinal}`)];
  const base = {
    contract: policy.queueContract, queueEntryKey: `category-review:${ordinal}`, queueOrdinal: ordinal,
    sourceDispositionKey: `category-disposition:${ordinal}`, sourceDispositionRecordContentHash: hash(`disposition:${ordinal}`), sourceDispositionSnapshotContentHash: hash('disposition-snapshot'),
    sourceEvidencePacketKey: `category-evidence:${ordinal}`, sourceEvidencePacketRecordContentHash: hash(`evidence:${ordinal}`), sourceEvidencePacketSnapshotContentHash: hash('evidence-snapshot'),
    sourceWorkQueueEntryKey: `category-work:${ordinal}`, evidenceFingerprint: hash(`fingerprint:${ordinal}`), renderedTargetKey: `wiki-title:${title}`, requestedTitles: [title],
    classification, reviewRoute,
    categoryEvidence: {
      namespace: { namespaceId: 14, canonicalName: 'Category', localizedName: 'Category', caseRule: 'first-letter', evidenceContentHash: evidenceHashes[1] },
      currentCategoryState: { requestedTitle: title, pageDescriptionExists: described, redlinkCategoryState: !described, categoryExistsByApiState: true, currentMissingPage: described ? null : { namespaceId: 14, title }, currentPageIdentity: pageIdentity, categoryInfo: { size: 1, pages: 1, files: 0, subcategories: 0 }, evidenceContentHash: currentEvidenceHash },
      prefixInventory: { prefix: title.slice(9), entries: [title.slice(9)], exactBaseTitlePresent: true, evidenceContentHash: evidenceHashes[2] },
      memberInventory: { memberCount: 1, members: [{ namespaceId: 0, pageId: identity.sourcePageId, title: identity.resolvedTitle, sourceIdentity: identity, exactCategoryOccurrences: [{ line: 5, exactSourceText: `[[${title}]]`, exactSourceTextContentHash: hash(`occurrence:${ordinal}`) }] }], categoryInfoReconciliation: { reportedSize: 1, enumeratedSize: 1 }, evidenceContentHash: evidenceHashes[3] },
      pinnedGuideRevalidations: [{ requestedTitle: title, sourceIdentity: { ...identity }, exactCategoryOccurrences: [{ line: 5, exactSourceText: `[[${title}]]`, exactSourceTextContentHash: hash(`occurrence:${ordinal}`) }], evidenceContentHash: evidenceHashes[6] }],
      namespaceSearch: { queries: [], evidenceContentHash: evidenceHashes[4] }, titleHistory: { eventCount: 0, events: [], evidenceContentHash: evidenceHashes[5] },
      evidenceBindings: {
        newEvidenceKeys: evidenceHashes,
        namespaceMetadataEvidenceContentHash: evidenceHashes[1], exactCurrentCategoryEvidenceContentHash: currentEvidenceHash,
        categoryPrefixEvidenceContentHash: evidenceHashes[2], categoryMemberEvidenceContentHash: evidenceHashes[3],
        namespaceSearchEvidenceContentHash: evidenceHashes[4], titleHistoryEvidenceContentHash: evidenceHashes[5],
        pinnedGuideRevalidationContentHashes: [evidenceHashes[6]]
      }
    },
    reviewScope: { decisionScope: 'exact category target only' }, allowedDecisions,
    resolutionReview: { decision: null, reviewer: null, reviewedAt: null, reviewNotes: null, evidenceKeys: [], state: 'unreviewed' },
    selectedResolution: null, canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    mechanicsReviewComplete: false, optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['explicit_source_bound_category_target_resolution_review_pending'], state: policy.queueState
  };
  base.decisionTemplate = blankTemplate(base);
  const record = { ...base, recordContentHash: hash(base) };
  return { ...record, contentHash: hash(record) };
}

function completedSubmission(queue, decision = queue.allowedDecisions[0], reviewer = 'Human Reviewer') {
  const selectedResolution = decision === 'confirm_active_redlink_category_target'
    ? { kind: 'active_redlink_category_target', namespaceId: 14, title: queue.requestedTitles[0] }
    : decision === 'confirm_exact_current_category_page_resolution'
      ? (() => { const page = queue.categoryEvidence.currentCategoryState.currentPageIdentity; return { kind: 'exact_current_category_description_page', sourcePageId: page.sourcePageId, namespaceId: page.namespaceId, resolvedTitle: page.resolvedTitle, sourceRevision: page.sourceRevision, sourceContentHash: page.sourceContentHash }; })()
      : null;
  return { ...queue.decisionTemplate, decision, selectedResolution, evidenceKeys: [queue.categoryEvidence.currentCategoryState.evidenceContentHash], reviewer, reviewedAt: '2026-09-06T10:00:00.000Z', reviewNotes: 'Reviewed the exact bound category evidence.' };
}

const build = (queues, submissions, changedPolicy = policy) => buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport({ queueRecords: queues, submissions, policy: changedPolicy, queueSnapshotContentHash, contentHash: hash });
function atomicFailure(queues, submissions, changedPolicy = policy) {
  const result = build(queues, submissions, changedPolicy);
  assert.equal(result.audit.publishable, false);
  assert.equal(result.records.length, 0);
  return result.audit;
}

test('policy is generic, route-bound, and fail closed', () => {
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImportPolicy(policy, hash).valid, true);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImportPolicy(automatic, hash).valid, false);
  const specific = structuredClone(policy); specific.categoryOverrides = { Example: 'confirm' };
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImportPolicy(specific, hash).valid, false);
});

test('records exact active-redlink and described-page decisions without applying either resolution', () => {
  const queues = [queueRecord(1), queueRecord(2, 'described')];
  const result = build(queues, queues.map(queue => completedSubmission(queue)));
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.reviewDecisionRecordingComplete, true);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records.map(row => row.decision), ['confirm_active_redlink_category_target', 'confirm_exact_current_category_page_resolution']);
  for (const record of result.records) {
    assert.equal(record.resolutionDispositionApplied, false);
    assert.equal(record.canonicalGameEntityIdentity, null);
    assert.equal(record.canonicalActivityIdentity, null);
    assert.equal(record.repeatabilityClassification, null);
    assert.equal(record.mechanicsReviewComplete, false);
    assert.equal(record.optimizerEligible, false);
    assert.equal(record.automaticVerificationApplied, false);
    for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing decision field ${field}`);
  }
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('supports partial human batches and all route-specific non-confirmation decisions', () => {
  const one = queueRecord(1); const two = queueRecord(2, 'described');
  const partial = build([one, two], [completedSubmission(one, 'reject_active_redlink_category_target'), two.decisionTemplate]);
  assert.equal(partial.audit.publishable, true);
  assert.equal(partial.records.length, 1);
  assert.equal(partial.audit.submissionCoverage.blankSubmissionCount, 1);
  const all = build([one, two], [completedSubmission(one, 'needs_additional_evidence'), completedSubmission(two, 'reject_exact_current_category_page_resolution')]);
  assert.equal(all.audit.publishable, true);
  assert.equal(all.records.length, 2);
  assert.equal(all.records.every(row => row.selectedResolution === null), true);
});

test('identical inputs create deterministic decision records and audits', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  assert.equal(hash(build([queue], [submission])), hash(build([structuredClone(queue)], [structuredClone(submission)])));
});

test('rejects blank-only, missing, partial, automated, stale, uncited, unbound, duplicate, cross-route, and account-scoped batches atomically', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  atomicFailure([queue], [queue.decisionTemplate]);
  atomicFailure([queue], []);
  atomicFailure([queue], [{ ...submission, reviewer: null }]);
  atomicFailure([queue], [{ ...submission, reviewer: 'Codex' }]);
  atomicFailure([queue], [{ ...submission, reviewedAt: '2026-08-27T11:25:16.000Z' }]);
  atomicFailure([queue], [{ ...submission, reviewNotes: 'short' }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [] }]);
  atomicFailure([queue], [{ ...submission, evidenceKeys: [hash('unbound')] }]);
  atomicFailure([queue], [{ ...submission, sourceEvidencePacketRecordContentHash: hash('stale') }]);
  atomicFailure([queue], [{ ...submission, extraField: true }]);
  atomicFailure([queue], [submission, submission]);
  atomicFailure([queue], [{ ...submission, decision: 'confirm_exact_current_category_page_resolution' }]);
  atomicFailure([queue], [{ ...submission, selectedResolution: { kind: 'active_redlink_category_target', namespaceId: 14, title: 'Category:Invented' } }]);
  atomicFailure([{ ...queue, currentBaseLevel: 34 }], [submission]);
});

test('audit rejects tampered queue evidence and attempted semantic promotion', () => {
  const queue = queueRecord(); const submission = completedSubmission(queue);
  const tampered = structuredClone(queue);
  tampered.categoryEvidence.memberInventory.members[0].sourceIdentity.sourceRevision = '999';
  tampered.recordContentHash = hash(without(tampered, 'recordContentHash', 'contentHash'));
  tampered.contentHash = hash(without(tampered, 'contentHash'));
  atomicFailure([tampered], [submission]);
  const result = build([queue], [submission]);
  const promoted = structuredClone(result.records);
  promoted[0].resolutionDispositionApplied = true; promoted[0].canonicalActivityIdentity = { activityId: 'invented' }; promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(without(promoted[0], 'recordContentHash'));
  const audit = auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport(promoted, { queueRecords: [queue], submissions: [submission], policy, queueSnapshotContentHash, contentHash: hash });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotionDecisionKeys.length, 1);
});

test('CLI rejects a real-shape blank template without writing a decision snapshot', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-category-resolution-review-import-'));
  try {
    const directory = path.join(root, '2026-09-05T10-00-00-000Z'); fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2)]; const raw = queues.map(JSON.stringify).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'decision-template.ndjson'), queues.map(row => JSON.stringify(row.decisionTemplate)).join('\n') + '\n');
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ domain: 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue', records: 2, contentHash: hash(raw), source: { audit: {
      queueExportComplete: true, categoryResolutionReviewComplete: false, resolutionApplicationComplete: false, completeActivityUniverse: false, publishable: true,
      queueCoverage: { reviewQueueEntryCount: 2, blankDecisionTemplateCount: 2, missingOutputKeys: [], unexpectedOutputKeys: [], duplicateOutputKeys: [], recordMismatches: [], templateMismatches: [] },
      artifactCoverage: { decisionTemplateNdjsonMatches: true },
      semanticPreservationCoverage: { recordedReviewCount: 0, selectedResolutionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, mechanicsReviewCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0 }
    } } }, null, 2));
    const result = spawnSync(process.execPath, ['platform/transforms/import-cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decisions.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.accepted, false); assert.equal(output.outputWritten, false);
    assert.equal(output.audit.submissionCoverage.blankSubmissionCount, 2);
    assert.equal(output.audit.recordCoverage.recordedDecisionCount, 0);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decisions.ndjson'))).length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill unresolved rendered-target category resolution review decision import checks passed.');
