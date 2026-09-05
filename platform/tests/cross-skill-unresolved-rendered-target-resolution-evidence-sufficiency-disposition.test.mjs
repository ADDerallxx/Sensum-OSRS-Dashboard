import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions,
  buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions,
  compileUnresolvedRenderedTargetResolutionSufficiencyPolicy,
  findUnresolvedRenderedTargetResolutionSufficiencyAccountState
} from '../transforms/cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-audit-v1.json', 'utf8'));
const inputSnapshotContentHash = 'a'.repeat(64);
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
  const guideObservation = {
    guidePageId: 100,
    guideTitle: 'Guide',
    guideRevision: '500',
    guideContentHash: hash('guide'),
    parserChannel: 'links',
    namespaceId: 0,
    requestedTitle: title,
    resolutionState: 'missing_wiki_page'
  };
  const guideBase = {
    guidePageId: 100,
    guideTitle: 'Guide',
    guideRevision: '500',
    guideContentHash: hash('guide'),
    parserChannel: 'links',
    requestedTitle: title,
    pinnedGuideSourceIdentity: identity(100, 'Guide', 500),
    exactSourceOccurrences: [{ occurrenceKey: 'guide-pageid:100:link:1', sourceTarget: title, requestedTitle: title, requestedFragment: null, displayText: null, sourceLocator: { line: 2, excerpt: `[[${title}]]` } }],
    alignment: {
      fetchedGuidePresent: true,
      guidePageIdMatches: true,
      guideTitleMatches: true,
      guideRevisionMatches: true,
      guideContentHashMatches: true,
      sourceLinkDelimitersBalanced: true,
      mediaWikiNormalizedRequestedTitleOccurrencePresent: true
    }
  };
  const resolved = mode === 'resolved';
  const currentBase = {
    requestedTitle: title,
    requestedNamespaceIds: [0],
    queryTitle: title,
    exactRequestedTitlePreserved: true,
    pageNamespaceMatches: true,
    normalizedMappings: [],
    redirectMappings: [],
    queryComplete: true,
    resolutionState: resolved ? 'current_revision_pinned_page_evidence' : 'current_missing_wiki_page_evidence',
    currentPageEvidence: resolved ? identity(200 + ordinal, title, 700 + ordinal) : null,
    currentMissingPage: resolved ? null : { namespaceId: 0, title },
    canonicalIdentityApplied: false
  };
  const candidates = mode === 'candidate' ? [{
    searchRank: 1,
    sourcePageIdentity: identity(300 + ordinal, `Candidate ${ordinal}`, 800 + ordinal),
    leadParagraphEvidence: [],
    headingEvidence: [],
    candidateIdentityApplied: false
  }] : [];
  const discoveryBase = {
    requestedTitle: title,
    requestedNamespaceIds: [0],
    query: `intitle:${title}`,
    queryDerivedOnlyFromRequestedTitle: true,
    queryComplete: true,
    candidateCount: candidates.length,
    candidates,
    selectedCandidatePageId: null,
    canonicalIdentityApplied: false
  };
  const logBase = {
    requestedTitle: title,
    queryTitle: title,
    exactRequestedTitlePreserved: true,
    queryComplete: true,
    eventCount: 0,
    events: [],
    canonicalIdentityApplied: false
  };
  return withHash({
    contract: policy.inputContract,
    resolutionEvidenceKey: `wiki-title:${title}|resolution-evidence`,
    sourceRenderedTargetRecordContentHash: hash(`rendered:${ordinal}`),
    sourceRenderedTargetSnapshotContentHash: hash('rendered-snapshot'),
    renderedTargetKey: `wiki-title:${title}`,
    requestedTitles: [title],
    namespaceIds: [0],
    guideObservations: [guideObservation],
    pinnedGuideEvidence: [withEvidenceHash(guideBase)],
    currentTitleResolutionEvidence: [withEvidenceHash(currentBase)],
    titleLogEvidence: [withEvidenceHash(logBase)],
    discoveryEvidence: [withEvidenceHash(discoveryBase)],
    resolutionDisposition: { state: 'unreviewed', selectedPageId: null, selectedTitle: null, evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['source_derived_candidates_require_separate_source_bound_resolution_decision'],
    state: 'resolution_evidence_captured_review_pending'
  });
}

const inputs = [
  evidence('Candidate-backed missing title', 'candidate', 1),
  evidence('No-candidate missing title', 'none', 2),
  evidence('Newly resolved title', 'resolved', 3)
];

test('policy and contracts are generic, fail closed, and contain no title overrides', () => {
  const compiled = compileUnresolvedRenderedTargetResolutionSufficiencyPolicy(policy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy);
  specific.titleOverrides = { Example: 'review' };
  assert.equal(compileUnresolvedRenderedTargetResolutionSufficiencyPolicy(specific, hash).valid, false);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnresolvedRenderedTargetResolutionSufficiencyPolicy(automatic, hash).valid, false);
});

test('routes only from exact-resolution and revision-pinned candidate coverage while preserving semantic closure', () => {
  const built = buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({ evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash });
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.dispositionCoverageComplete, true);
  assert.equal(built.records.length, 3);
  assert.equal(built.audit.dispositionCoverage.exactCurrentResolutionReviewReadyCount, 1);
  assert.equal(built.audit.dispositionCoverage.sourceDerivedCandidateReviewReadyCount, 1);
  assert.equal(built.audit.dispositionCoverage.noCandidateAdditionalEvidenceCount, 1);
  assert.equal(built.audit.dispositionCoverage.explicitResolutionReviewRouteCount, 2);
  assert.equal(built.audit.dispositionCoverage.additionalEvidenceRouteCount, 1);
  assert.equal(built.audit.bindingCoverage.totalRevisionPinnedCandidateCount, 1);
  assert.equal(built.audit.semanticPreservationCoverage.resolutionReviewCompletedCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.selectedResolutionCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
  for (const row of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(row, field), `Missing disposition field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('titles and candidate identities cannot change equal evidence-shape routes', () => {
  const first = evidence('Completely different title', 'candidate', 10);
  const second = evidence('Another unrelated title', 'candidate', 20);
  const built = buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({ evidenceRecords: [first, second], inputSnapshotContentHash, policy, contentHash: hash });
  assert.equal(built.records[0].evidenceSufficiencyDisposition, built.records[1].evidenceSufficiencyDisposition);
  assert.equal(built.records[0].reviewRoute, built.records[1].reviewRoute);
  const repeat = buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({ evidenceRecords: structuredClone(inputs), inputSnapshotContentHash, policy: structuredClone(policy), contentHash: hash });
  assert.equal(hash(builtUnchanged()), hash(repeat));
  function builtUnchanged() { return buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({ evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash }); }
});

for (const [name, mutate] of [
  ['intrinsic record hash drift', rows => { rows[0].contentHash = '0'.repeat(64); }],
  ['nested current-resolution evidence drift', rows => { rows[0].currentTitleResolutionEvidence[0].queryComplete = false; rows[0] = withHash({ ...rows[0], contentHash: undefined }); }],
  ['selected discovery candidate', rows => { const discovery = rows[0].discoveryEvidence[0]; discovery.selectedCandidatePageId = 301; rows[0].discoveryEvidence[0] = withEvidenceHash({ ...discovery, evidenceContentHash: undefined }); rows[0] = withHash({ ...rows[0], contentHash: undefined }); }],
  ['failed pinned-guide alignment', rows => { const guide = rows[0].pinnedGuideEvidence[0]; guide.alignment.guideRevisionMatches = false; rows[0].pinnedGuideEvidence[0] = withEvidenceHash({ ...guide, evidenceContentHash: undefined }); rows[0] = withHash({ ...rows[0], contentHash: undefined }); }]
]) test(`fails closed on ${name}`, () => {
  const rows = structuredClone(inputs);
  mutate(rows);
  const built = buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({ evidenceRecords: rows, inputSnapshotContentHash, policy, contentHash: hash });
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('one_or_more_input_resolution_evidence_packets_invalid'));
});

test('fails closed without the exact evidence snapshot binding', () => {
  const built = buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({ evidenceRecords: inputs, inputSnapshotContentHash: '', policy, contentHash: hash });
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('resolution_evidence_snapshot_hash_missing'));
});

test('audit rejects altered routing, completed review, semantic promotion, account state, and incomplete output', () => {
  const source = { evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash };
  const built = buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(source);
  const routed = structuredClone(built.records);
  routed[0].reviewRoute = policy.reviewRoutes.additionalEvidence;
  assert.equal(auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(routed, source).publishable, false);
  const promoted = structuredClone(built.records);
  promoted[0].resolutionReview = { state: 'reviewed', decision: 'bind', selectedPageId: 301, selectedTitle: 'Candidate', reviewer: 'Human', reviewedAt: '2026-09-05T00:00:00Z', reviewNotes: 'Reviewed', evidenceKeys: ['x'] };
  promoted[0].canonicalGameEntityIdentity = { pageId: 301 };
  promoted[0].optimizerEligible = true;
  assert.equal(auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(promoted, source).publishable, false);
  const account = structuredClone(built.records);
  account[0].currentLevel = 34;
  assert.ok(findUnresolvedRenderedTargetResolutionSufficiencyAccountState(account).length > 0);
  assert.equal(auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(account, source).publishable, false);
  assert.equal(auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(built.records.slice(1), source).publishable, false);
});

test('CLI rejects a tampered input manifest before writing a disposition snapshot', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-rendered-resolution-sufficiency-'));
  try {
    const directory = path.join(root, '2026-09-05T00-00-00-000Z');
    fs.mkdirSync(directory, { recursive: true });
    const raw = `${JSON.stringify(inputs[0])}\n`;
    fs.writeFileSync(path.join(directory, 'cross-skill-unresolved-rendered-target-resolution-evidence.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      contract: 'sensum.ingestion-manifest.v1',
      domain: 'cross-skill-unresolved-rendered-target-resolution-evidence',
      records: 1,
      contentHash: 'tampered',
      source: { audit: { resolutionEvidenceCoverageComplete: true, canonicalIdentityComplete: false, completeActivityUniverse: false, publishable: true, inputCoverage: { expectedUnresolvedRenderedTargetCount: 1 } } }
    }));
    const result = spawnSync(process.execPath, ['platform/transforms/build-cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-dispositions.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(root).filter(name => name.includes('sufficiency-disposition')).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill unresolved rendered-target resolution-evidence sufficiency disposition checks passed.');
