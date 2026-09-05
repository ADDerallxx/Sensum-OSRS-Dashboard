import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import { buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions } from '../transforms/cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-lib.mjs';
import {
  auditUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport,
  buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport,
  compileUnresolvedRenderedTargetResolutionQueueExportPolicy,
  renderUnresolvedRenderedTargetAdditionalEvidenceQueueMarkdown,
  renderUnresolvedRenderedTargetResolutionReviewQueueMarkdown,
  serializeUnresolvedRenderedTargetResolutionDecisionTemplates
} from '../transforms/cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queue-export-v1.json', 'utf8'));
const sufficiencyPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-v1.json', 'utf8'));
const reviewContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-review-queue-entry-v1.json', 'utf8'));
const decisionContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-review-decision-template-v1.json', 'utf8'));
const additionalContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-additional-evidence-work-queue-entry-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queue-export-audit-v1.json', 'utf8'));
const evidenceSnapshotContentHash = 'a'.repeat(64);
const dispositionSnapshotContentHash = 'b'.repeat(64);
const withHash = base => ({ ...base, contentHash: hash(base) });
const withEvidenceHash = base => ({ ...base, evidenceContentHash: hash(base) });

function identity(pageId, title, revision) {
  return {
    sourcePageId: pageId,
    namespaceId: 0,
    resolvedTitle: title,
    sourceRevision: String(revision),
    sourceTimestamp: '2026-09-05T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
    sourceContentHash: hash(`source:${pageId}:${revision}`),
    sourceContentBytes: 100,
    sourceLineCount: 5
  };
}

function evidence(title, mode, ordinal) {
  const guideObservation = { guidePageId: 100, guideTitle: 'Guide', guideRevision: '500', guideContentHash: hash('guide'), parserChannel: 'links', namespaceId: 0, requestedTitle: title, resolutionState: mode === 'resolved' ? 'resolved_wiki_page' : 'missing_wiki_page' };
  const guideBase = {
    guidePageId: 100, guideTitle: 'Guide', guideRevision: '500', guideContentHash: hash('guide'), parserChannel: 'links', requestedTitle: title,
    pinnedGuideSourceIdentity: identity(100, 'Guide', 500),
    exactSourceOccurrences: [{ occurrenceKey: `guide-pageid:100:link:${ordinal}`, sourceTarget: title, requestedTitle: title, requestedFragment: null, displayText: null, sourceLocator: { line: 2, excerpt: `[[${title}]]` } }],
    alignment: { fetchedGuidePresent: true, guidePageIdMatches: true, guideTitleMatches: true, guideRevisionMatches: true, guideContentHashMatches: true, sourceLinkDelimitersBalanced: true, mediaWikiNormalizedRequestedTitleOccurrencePresent: true }
  };
  const resolved = mode === 'resolved';
  const currentBase = {
    requestedTitle: title, requestedNamespaceIds: [0], queryTitle: title, exactRequestedTitlePreserved: true, pageNamespaceMatches: true, normalizedMappings: [], redirectMappings: [], queryComplete: true,
    resolutionState: resolved ? 'current_revision_pinned_page_evidence' : 'current_missing_wiki_page_evidence',
    currentPageEvidence: resolved ? identity(200 + ordinal, title, 700 + ordinal) : null,
    currentMissingPage: resolved ? null : { namespaceId: 0, title }, canonicalIdentityApplied: false
  };
  const candidates = mode === 'candidate' ? [{ searchRank: 1, sourcePageIdentity: identity(300 + ordinal, `Candidate ${ordinal}`, 800 + ordinal), leadParagraphEvidence: [], headingEvidence: [], candidateIdentityApplied: false }] : [];
  const discoveryBase = { requestedTitle: title, requestedNamespaceIds: [0], query: `intitle:${title}`, queryDerivedOnlyFromRequestedTitle: true, queryComplete: true, candidateCount: candidates.length, candidates, selectedCandidatePageId: null, canonicalIdentityApplied: false };
  const logBase = { requestedTitle: title, queryTitle: title, exactRequestedTitlePreserved: true, queryComplete: true, eventCount: 0, events: [], canonicalIdentityApplied: false };
  return withHash({
    contract: sufficiencyPolicy.inputContract,
    resolutionEvidenceKey: `wiki-title:${title}|resolution-evidence`,
    sourceRenderedTargetRecordContentHash: hash(`rendered:${ordinal}`),
    sourceRenderedTargetSnapshotContentHash: hash('rendered-snapshot'),
    renderedTargetKey: `wiki-title:${title}`,
    requestedTitles: [title], namespaceIds: [0], guideObservations: [guideObservation], pinnedGuideEvidence: [withEvidenceHash(guideBase)],
    currentTitleResolutionEvidence: [withEvidenceHash(currentBase)], titleLogEvidence: [withEvidenceHash(logBase)], discoveryEvidence: [withEvidenceHash(discoveryBase)],
    resolutionDisposition: { state: 'unreviewed', selectedPageId: null, selectedTitle: null, evidenceKeys: [] },
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null, optimizerEligible: false, accountIndependent: true,
    blockers: ['resolution_review_pending'], state: 'resolution_evidence_captured_review_pending'
  });
}

const evidenceRecords = [evidence('Candidate-backed title', 'candidate', 1), evidence('No-candidate title', 'none', 2), evidence('Current exact title', 'resolved', 3)];
const dispositionBuild = buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({ evidenceRecords, inputSnapshotContentHash: evidenceSnapshotContentHash, policy: sufficiencyPolicy, contentHash: hash });
const dispositionRecords = dispositionBuild.records.map(withHash);
const source = { dispositionRecords, evidenceRecords, policy, sufficiencyPolicy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash: hash };
const clonedSource = () => ({
  dispositionRecords: structuredClone(dispositionRecords),
  evidenceRecords: structuredClone(evidenceRecords),
  policy: structuredClone(policy),
  sufficiencyPolicy: structuredClone(sufficiencyPolicy),
  dispositionSnapshotContentHash,
  evidenceSnapshotContentHash,
  contentHash: hash
});

test('policy and contracts are generic, fail closed, and complete', () => {
  const compiled = compileUnresolvedRenderedTargetResolutionQueueExportPolicy(policy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy);
  specific.titleOverrides = { Example: 'review' };
  assert.equal(compileUnresolvedRenderedTargetResolutionQueueExportPolicy(specific, hash).valid, false);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnresolvedRenderedTargetResolutionQueueExportPolicy(automatic, hash).valid, false);
});

test('exports an exact disjoint review and additional-evidence queue partition', () => {
  const built = buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(source);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.queueExportComplete, true);
  assert.equal(built.reviewRecords.length, 2);
  assert.equal(built.additionalEvidenceRecords.length, 1);
  assert.equal(built.decisionTemplates.length, 2);
  assert.deepEqual(built.audit.queuePartitionCoverage.crossQueueDispositionKeys, []);
  assert.deepEqual(built.audit.queuePartitionCoverage.missingQueueDispositionKeys, []);
  assert.equal(built.audit.bindingCoverage.retainedDiscoveryCandidateCount, 1);
  assert.equal(built.audit.semanticPreservationCoverage.selectedResolutionCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
  for (const field of reviewContract.required) assert.ok(Object.hasOwn(built.reviewRecords[0], field), `Missing review field ${field}`);
  for (const field of decisionContract.required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing decision field ${field}`);
  for (const field of additionalContract.required) assert.ok(Object.hasOwn(built.additionalEvidenceRecords[0], field), `Missing additional-evidence field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('retains all source-bound evidence and only shape-applicable decisions', () => {
  const built = buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(source);
  const candidate = built.reviewRecords.find(row => row.renderedTargetKey.includes('Candidate-backed'));
  const current = built.reviewRecords.find(row => row.renderedTargetKey.includes('Current exact'));
  assert.deepEqual(candidate.resolutionEvidence, {
    guideObservations: evidenceRecords[0].guideObservations,
    pinnedGuideEvidence: evidenceRecords[0].pinnedGuideEvidence,
    currentTitleResolutionEvidence: evidenceRecords[0].currentTitleResolutionEvidence,
    titleLogEvidence: evidenceRecords[0].titleLogEvidence,
    discoveryEvidence: evidenceRecords[0].discoveryEvidence
  });
  assert.ok(candidate.allowedDecisions.includes('confirm_revision_pinned_candidate_resolution'));
  assert.ok(!candidate.allowedDecisions.includes('confirm_exact_current_resolution'));
  assert.ok(current.allowedDecisions.includes('confirm_exact_current_resolution'));
  assert.ok(!current.allowedDecisions.includes('confirm_revision_pinned_candidate_resolution'));
});

test('readable artifacts and blank templates are deterministic', () => {
  const first = buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(source);
  const second = buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(clonedSource());
  assert.deepEqual(second, first);
  assert.equal(renderUnresolvedRenderedTargetResolutionReviewQueueMarkdown(first.reviewRecords), first.reviewMarkdown);
  assert.equal(renderUnresolvedRenderedTargetAdditionalEvidenceQueueMarkdown(first.additionalEvidenceRecords), first.additionalEvidenceMarkdown);
  assert.equal(serializeUnresolvedRenderedTargetResolutionDecisionTemplates(first.decisionTemplates), first.decisionTemplateNdjson);
  assert.match(first.reviewMarkdown, /Selected resolution: none/);
  assert.match(first.additionalEvidenceMarkdown, /New evidence recorded: none/);
});

for (const [name, mutate] of [
  ['disposition intrinsic hash drift', value => { value.dispositionRecords[0].contentHash = '0'.repeat(64); }],
  ['evidence record drift', value => { value.evidenceRecords[0].discoveryEvidence[0].queryComplete = false; }],
  ['snapshot binding drift', value => { value.dispositionRecords[0].sourceEvidenceSnapshotContentHash = 'c'.repeat(64); value.dispositionRecords[0] = withHash(Object.fromEntries(Object.entries(value.dispositionRecords[0]).filter(([key]) => key !== 'contentHash'))); }]
]) test(`fails closed on ${name}`, () => {
  const changed = clonedSource();
  mutate(changed);
  const built = buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(changed);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.reviewRecords.length, 0);
  assert.equal(built.additionalEvidenceRecords.length, 0);
});

test('audit rejects queue crossing, review decisions, identity promotion, and account state', () => {
  const built = buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(source);
  const crossed = structuredClone(built.additionalEvidenceRecords);
  crossed.push({ ...structuredClone(crossed[0]), sourceDispositionKey: built.reviewRecords[0].sourceDispositionKey });
  let audit = auditUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(built.reviewRecords, { ...source, additionalEvidenceRecords: crossed, decisionTemplates: built.decisionTemplates, reviewMarkdown: built.reviewMarkdown, additionalEvidenceMarkdown: renderUnresolvedRenderedTargetAdditionalEvidenceQueueMarkdown(crossed), decisionTemplateNdjson: built.decisionTemplateNdjson });
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('queue_partition_not_exact_complete_and_disjoint'));
  const decided = structuredClone(built.decisionTemplates);
  decided[0].decision = decided[0].allowedDecisions[0];
  audit = auditUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(built.reviewRecords, { ...source, additionalEvidenceRecords: built.additionalEvidenceRecords, decisionTemplates: decided, reviewMarkdown: built.reviewMarkdown, additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: serializeUnresolvedRenderedTargetResolutionDecisionTemplates(decided) });
  assert.equal(audit.publishable, false);
  const promoted = structuredClone(built.reviewRecords);
  promoted[0].canonicalGameEntityIdentity = { pageId: 1 };
  promoted[0].optimizerEligible = true;
  audit = auditUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(promoted, { ...source, additionalEvidenceRecords: built.additionalEvidenceRecords, decisionTemplates: built.decisionTemplates, reviewMarkdown: renderUnresolvedRenderedTargetResolutionReviewQueueMarkdown(promoted), additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: built.decisionTemplateNdjson });
  assert.equal(audit.publishable, false);
  const account = structuredClone(built.reviewRecords);
  account[0].currentLevel = 34;
  audit = auditUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(account, { ...source, additionalEvidenceRecords: built.additionalEvidenceRecords, decisionTemplates: built.decisionTemplates, reviewMarkdown: renderUnresolvedRenderedTargetResolutionReviewQueueMarkdown(account), additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: built.decisionTemplateNdjson });
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('current_account_state_present'));
});

test('CLI rejects a tampered disposition manifest before writing either queue', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-rendered-resolution-queue-export-'));
  try {
    const directory = path.join(root, '2026-09-05T00-00-00-000Z');
    fs.mkdirSync(directory, { recursive: true });
    const raw = `${JSON.stringify(dispositionRecords[0])}\n`;
    fs.writeFileSync(path.join(directory, 'cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      contract: 'sensum.ingestion-manifest.v1', domain: 'cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition', records: 1, contentHash: 'tampered',
      source: { audit: { dispositionCoverageComplete: true, resolutionReviewComplete: false, canonicalIdentityComplete: false, completeActivityUniverse: false, publishable: true, semanticPreservationCoverage: { resolutionReviewCompletedCount: 0, selectedResolutionCount: 0, optimizerEligibleCount: 0 } } }
    }));
    const result = spawnSync(process.execPath, ['platform/transforms/export-cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queues.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(root).filter(name => name.includes('resolution-review') || name.includes('additional-evidence')).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill unresolved rendered-target resolution review and additional-evidence queue export checks passed.');
