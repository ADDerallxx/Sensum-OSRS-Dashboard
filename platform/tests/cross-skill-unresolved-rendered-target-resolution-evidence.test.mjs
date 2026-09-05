import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditUnresolvedRenderedTargetResolutionEvidence,
  buildUnresolvedRenderedTargetResolutionEvidence,
  compileUnresolvedRenderedTargetResolutionEvidencePolicy
} from '../ingestion/cross-skill-unresolved-rendered-target-resolution-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-resolution-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-resolution-evidence-audit-v1.json', 'utf8'));
const snapshotHash = 'a'.repeat(64);
const guideContent = 'Intro.\n\n[[missing target]] and [[Resolved target]].\n';
const guideHash = hash(guideContent);

function withHash(base) { return { ...base, contentHash: hash(base) }; }

function renderedTarget(requestedTitle, ordinal = 1) {
  return withHash({
    contract: policy.inputContract,
    renderedTargetKey: `wiki-title:${requestedTitle}`,
    requestedTitles: [requestedTitle],
    namespaceIds: [0],
    guideObservationCount: 1,
    observations: [{
      guidePageId: 100,
      guideTitle: 'Guide',
      guideRevision: '500',
      guideContentHash: guideHash,
      parserObservedAt: '2026-09-04T00:00:00Z',
      parserChannel: 'links',
      namespaceId: 0,
      requestedTitle,
      parserReportedExists: false,
      parserMetadata: null,
      resolutionState: 'missing_wiki_page',
      sourcePresence: 'direct_source_exact_mediawiki_title'
    }],
    targetPageIdentity: null,
    sourcePresenceCounts: { direct_source_stable_page_id: 0, direct_source_exact_mediawiki_title: 1, rendered_only_origin_unattributed: 0 },
    canonicalActivityIdentity: null,
    repeatableTrainingActivity: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['optimizer_eligibility_blocked'],
    state: 'blocked',
    fixtureOrdinal: ordinal
  });
}

const fetchedGuides = [{
  pageid: 100,
  ns: 0,
  title: 'Guide',
  revisions: [{ revid: 500, timestamp: '2026-09-01T00:00:00Z', slots: { main: { content: guideContent } } }]
}];

function currentMissing(requestedTitle) {
  return { requestedTitle, complete: true, response: { batchcomplete: true, query: { pages: [{ ns: 0, title: requestedTitle, missing: true }] } } };
}

function currentResolved(requestedTitle) {
  const content = 'Resolved page lead.\n';
  return {
    requestedTitle,
    complete: true,
    response: { batchcomplete: true, query: { pages: [{ pageid: 200, ns: 0, title: requestedTitle, revisions: [{ revid: 700, timestamp: '2026-09-05T00:00:00Z', slots: { main: { content } } }] }] } }
  };
}

function discovery(requestedTitle, withCandidate = false) {
  const pages = withCandidate ? [{
    pageid: 300,
    ns: 0,
    title: 'Source-derived candidate',
    index: 1,
    revisions: [{ revid: 800, timestamp: '2026-09-05T01:00:00Z', slots: { main: { content: 'Candidate lead.\n\n==Uses==\nEvidence.' } } }]
  }] : [];
  return { requestedTitle, namespaceIds: [0], query: `intitle:${requestedTitle}`, pages, complete: true };
}

const logs = requestedTitle => ({ requestedTitle, events: [], complete: true });

function inputs() {
  const targets = [renderedTarget('Missing target', 1), renderedTarget('Resolved target', 2)];
  return {
    renderedTargets: targets,
    fetchedGuides,
    currentTitleResolutions: [currentMissing('Missing target'), currentResolved('Resolved target')],
    discoveryResults: [discovery('Missing target', true), discovery('Resolved target')],
    titleLogResults: [logs('Missing target'), logs('Resolved target')],
    inputSnapshotContentHash: snapshotHash,
    policy,
    contentHash: hash
  };
}

test('policy and contracts define a generic fail-closed evidence boundary', () => {
  const compiled = compileUnresolvedRenderedTargetResolutionEvidencePolicy(policy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.equal(JSON.stringify(policy).includes('Missing target'), false);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnresolvedRenderedTargetResolutionEvidencePolicy(automatic).valid, false);
  assert.ok(recordContract.required.includes('resolutionDisposition'));
  assert.ok(auditContract.required.includes('resolutionEvidenceCoverageComplete'));
});

test('captures exact current resolution, pinned guide context, search candidates, and log history without binding identity', () => {
  const built = buildUnresolvedRenderedTargetResolutionEvidence(inputs());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.resolutionEvidenceCoverageComplete, true);
  assert.equal(built.records.length, 2);
  assert.equal(built.audit.sourceGuideCoverage.requiredUniqueGuideRevisionCount, 1);
  assert.equal(built.audit.sourceGuideCoverage.pinnedGuideEvidenceCount, 2);
  assert.equal(built.audit.sourceGuideCoverage.exactSourceOccurrenceCount, 2);
  assert.equal(built.audit.currentResolutionCoverage.currentMissingPageCount, 1);
  assert.equal(built.audit.currentResolutionCoverage.revisionPinnedCurrentPageCount, 1);
  assert.equal(built.audit.discoveryCoverage.revisionPinnedCandidateCount, 1);
  assert.equal(built.audit.discoveryCoverage.selectedCandidateCount, 0);
  assert.equal(built.audit.semanticPromotionCoverage.canonicalGameEntityIdentityCount, 0);
  assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
  assert.equal(built.records.every(row => row.resolutionDisposition.state === 'unreviewed' && row.canonicalGameEntityIdentity === null && row.optimizerEligible === false), true);
  for (const row of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(row, field), `Missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('is deterministic for identical evidence inputs', () => {
  const first = buildUnresolvedRenderedTargetResolutionEvidence(inputs());
  const second = buildUnresolvedRenderedTargetResolutionEvidence(inputs());
  assert.equal(hash(first), hash(second));
});

test('rejects corrupted inputs, missing guide evidence, incomplete queries, unpinned candidates, and account state', () => {
  const scenarios = [];
  const corrupted = inputs();
  corrupted.renderedTargets[0].observations[0].requestedTitle = 'Changed';
  scenarios.push(corrupted);
  const missingGuide = inputs();
  missingGuide.fetchedGuides = [];
  scenarios.push(missingGuide);
  const incompleteResolution = inputs();
  incompleteResolution.currentTitleResolutions[0].complete = false;
  scenarios.push(incompleteResolution);
  const badDiscovery = inputs();
  delete badDiscovery.discoveryResults[0].pages[0].revisions;
  scenarios.push(badDiscovery);
  const incompleteLogs = inputs();
  incompleteLogs.titleLogResults[0].complete = false;
  scenarios.push(incompleteLogs);
  const accountScoped = inputs();
  accountScoped.renderedTargets[0].currentLevel = 34;
  accountScoped.renderedTargets[0].contentHash = hash(Object.fromEntries(Object.entries(accountScoped.renderedTargets[0]).filter(([key]) => key !== 'contentHash')));
  scenarios.push(accountScoped);
  for (const scenario of scenarios) {
    const built = buildUnresolvedRenderedTargetResolutionEvidence(scenario);
    assert.equal(built.audit.publishable, false);
    assert.equal(built.audit.resolutionEvidenceCoverageComplete, false);
  }
});

test('audit rejects attempted resolution, semantic, or optimizer promotion', () => {
  const source = inputs();
  const built = buildUnresolvedRenderedTargetResolutionEvidence(source);
  const promoted = structuredClone(built.records);
  promoted[0].resolutionDisposition = { state: 'reviewed', selectedPageId: 300, selectedTitle: 'Source-derived candidate', evidenceKeys: ['x'] };
  promoted[0].canonicalGameEntityIdentity = { pageId: 300 };
  promoted[0].optimizerEligible = true;
  const audit = auditUnresolvedRenderedTargetResolutionEvidence(promoted, source);
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPromotionCoverage.unsupportedPromotionTargetKeys.length, 1);
});

test('CLI rejects a corrupted upstream snapshot before network access and writes no evidence output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-unresolved-rendered-resolution-'));
  try {
    const directory = path.join(root, '2026-09-05T10-00-00-000Z');
    fs.mkdirSync(directory, { recursive: true });
    const row = renderedTarget('Missing target');
    const raw = `${JSON.stringify(row)}\n`;
    fs.writeFileSync(path.join(directory, 'skill-training-guide-rendered-link.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      domain: 'skill-training-guide-rendered-link',
      records: 1,
      contentHash: hash('tampered'),
      source: { audit: { renderedLinkObservationComplete: true, semanticPromotionCoverage: { optimizerEligibleCount: 0 }, renderedLinkCoverage: { missingPageObservations: 1 } } }
    }));
    const result = spawnSync(process.execPath, ['platform/ingestion/ingest-wiki-cross-skill-unresolved-rendered-target-resolution-evidence.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'cross-skill-unresolved-rendered-target-resolution-evidence.ndjson'))).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill unresolved rendered-target resolution evidence checks passed.');
