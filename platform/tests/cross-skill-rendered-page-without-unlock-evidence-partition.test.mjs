import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditRenderedPageWithoutUnlockEvidencePartition,
  buildRenderedPageWithoutUnlockEvidencePartition,
  compileRenderedPageWithoutUnlockEvidencePartitionPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-partition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-partition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-partition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-partition-audit-v1.json', 'utf8'));
const snapshotHash = 'a'.repeat(64);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function observation(ordinal, sourcePresence = 'direct_source_stable_page_id', parserChannel = 'links') {
  return {
    guideContentHash: hash(`guide:${ordinal}`), guidePageId: 1000 + ordinal, guideRevision: String(15000000 + ordinal),
    guideTitle: `Guide ${ordinal}`, namespaceId: parserChannel === 'images' ? 6 : parserChannel === 'categories' ? 14 : 0,
    parserChannel, parserMetadata: null, parserObservedAt: '2026-09-04T01:39:42.492Z', parserReportedExists: parserChannel === 'images' ? null : true,
    requestedTitle: `Target ${ordinal}`, resolutionState: 'current_revision_pinned_page', sourcePresence
  };
}

function candidate(ordinal = 1, shape = 'direct', title = `Target ${ordinal}`) {
  const observations = shape === 'direct' ? [observation(ordinal)] : shape === 'rendered'
    ? [observation(ordinal, 'rendered_only_origin_unattributed')] : [observation(ordinal), observation(ordinal + 100, 'rendered_only_origin_unattributed')];
  const presence = Object.fromEntries(policy.sourcePresenceVocabulary.map(value => [value, observations.filter(row => row.sourcePresence === value).length]));
  const identity = { redirected: false, resolvedTitle: title, sourcePageId: 2000 + ordinal, sourceRevision: String(15100000 + ordinal), sourceTimestamp: '2026-09-03T12:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}` };
  const base = {
    contract: policy.inputContract, renderedTargetKey: `wiki-pageid:${identity.sourcePageId}`, candidateKey: null,
    candidateKind: policy.inputCandidateKind,
    pageIdentity: { sourcePageId: identity.sourcePageId, resolvedTitle: title, renderedSourceRevision: identity.sourceRevision, unlockSourceRevision: null, revisionRelationship: 'no_unlock_page_match' },
    sourceContexts: { renderedEvidence: { requestedTitles: [title], namespaceIds: [...new Set(observations.map(row => row.namespaceId))], guideObservationCount: observations.length, observations, sourcePresenceCounts: presence, targetPageIdentity: identity }, unlockEvidence: null, crossSourcePageIdentityEstablished: false, revisionRelationship: 'no_unlock_page_match', semanticRoutingState: policy.inputSemanticRoutingState },
    skillKeys: [], statementKeys: [], queuedForSemanticReview: false, activityDiscoveryCandidate: false, reviewStatus: 'not_queued',
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null, optimizerEligible: false,
    sourceCrosswalkContentHash: hash(`crosswalk:${ordinal}`), accountIndependent: true,
    blockers: ['exact_cross_source_page_identity_not_established'], state: 'blocked'
  };
  return { ...base, contentHash: hash(base) };
}

function rehash(record) {
  record.contentHash = hash(without(record, 'contentHash'));
  return record;
}

const build = (rows, changedPolicy = policy, changedHash = snapshotHash) => buildRenderedPageWithoutUnlockEvidencePartition({ candidateRecords: rows, policy: changedPolicy, sourceCandidateSnapshotContentHash: changedHash, contentHash: hash });
function atomicFailure(rows, changedPolicy = policy, changedHash = snapshotHash) {
  const result = build(rows, changedPolicy, changedHash);
  assert.equal(result.audit.publishable, false);
  assert.equal(result.records.length, 0);
  return result.audit;
}

test('policy is generic, provenance-only, and fail closed', () => {
  const compiled = compileRenderedPageWithoutUnlockEvidencePartitionPolicy(policy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileRenderedPageWithoutUnlockEvidencePartitionPolicy(automatic, hash).valid, false);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'direct_source_only' };
  assert.equal(compileRenderedPageWithoutUnlockEvidencePartitionPolicy(specific, hash).valid, false);
});

test('partitions direct-only, mixed, and rendered-only provenance exactly once without semantic promotion', () => {
  const rows = [candidate(1, 'direct'), candidate(2, 'mixed'), candidate(3, 'rendered')];
  const result = build(rows);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.partitionComplete, true);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.records.map(row => row.provenancePartition), ['direct_source_only', 'mixed_direct_and_unattributed_rendered', 'rendered_only_origin_unattributed']);
  assert.equal(result.audit.partitionCoverage.directSourceOnlyCount, 1);
  assert.equal(result.audit.partitionCoverage.mixedDirectAndUnattributedRenderedCount, 1);
  assert.equal(result.audit.partitionCoverage.renderedOnlyUnattributedCount, 1);
  assert.equal(result.audit.sourceIntegrityCoverage.renderedGuideObservationCount, 4);
  assert.equal(result.audit.sourceIntegrityCoverage.sourcePresenceCounts.direct_source_stable_page_id, 2);
  assert.equal(result.audit.sourceIntegrityCoverage.sourcePresenceCounts.rendered_only_origin_unattributed, 2);
  assert.equal(result.audit.unlockEvidenceReconciled, false);
  for (const record of result.records) {
    assert.equal(record.semanticDisposition, null);
    assert.equal(record.canonicalGameEntityIdentity, null);
    assert.equal(record.canonicalActivityIdentity, null);
    assert.equal(record.repeatabilityClassification, null);
    assert.equal(record.mechanicsReviewComplete, false);
    assert.equal(record.optimizerEligible, false);
    assert.equal(record.automaticVerificationApplied, false);
    for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing partition field ${field}`);
  }
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('titles, namespaces, page IDs, and parser channels cannot change equal provenance-shape routing', () => {
  const one = candidate(1, 'direct', 'Ordinary page');
  const two = candidate(90, 'direct', 'File:Different page.png');
  two.sourceContexts.renderedEvidence.namespaceIds = [6];
  two.sourceContexts.renderedEvidence.observations[0].parserChannel = 'images';
  two.sourceContexts.renderedEvidence.observations[0].namespaceId = 6;
  two.sourceContexts.renderedEvidence.observations[0].parserReportedExists = null;
  rehash(two);
  const result = build([one, two]);
  assert.equal(result.audit.publishable, true);
  assert.deepEqual(new Set(result.records.map(row => row.provenancePartition)), new Set(['direct_source_only']));
  assert.equal(result.audit.sourceIntegrityCoverage.parserChannelCounts.links, 1);
  assert.equal(result.audit.sourceIntegrityCoverage.parserChannelCounts.images, 1);
  assert.equal(result.audit.sourceIntegrityCoverage.parserExistenceUnreportedImageObservationCount, 1);
});

test('identical inputs create deterministic records and audit', () => {
  const rows = [candidate(1, 'direct'), candidate(2, 'mixed'), candidate(3, 'rendered')];
  assert.equal(hash(build(rows)), hash(build(structuredClone(rows))));
});

test('rejects intrinsic drift, unknown observations, count drift, unlock evidence, identity drift, missing snapshot binding, and account state atomically', () => {
  const original = candidate();
  atomicFailure([{ ...original, contentHash: '0'.repeat(64) }]);
  const presence = structuredClone(original); presence.sourceContexts.renderedEvidence.observations[0].sourcePresence = 'invented_origin'; rehash(presence); atomicFailure([presence]);
  const channel = structuredClone(original); channel.sourceContexts.renderedEvidence.observations[0].parserChannel = 'invented_channel'; rehash(channel); atomicFailure([channel]);
  const unreportedLink = structuredClone(original); unreportedLink.sourceContexts.renderedEvidence.observations[0].parserReportedExists = null; rehash(unreportedLink); atomicFailure([unreportedLink]);
  const count = structuredClone(original); count.sourceContexts.renderedEvidence.guideObservationCount = 99; rehash(count); atomicFailure([count]);
  const unlock = structuredClone(original); unlock.sourceContexts.unlockEvidence = { sourcePageId: 2001 }; rehash(unlock); atomicFailure([unlock]);
  const identity = structuredClone(original); identity.sourceContexts.renderedEvidence.targetPageIdentity.sourceRevision = '999'; rehash(identity); atomicFailure([identity]);
  atomicFailure([original], policy, 'bad');
  const account = structuredClone(original); account.preferences = { afk: true }; rehash(account); atomicFailure([account]);
});

test('audit rejects partition changes and semantic or optimizer promotion', () => {
  const input = candidate(); const result = build([input]);
  const altered = structuredClone(result.records); altered[0].provenancePartition = 'rendered_only_origin_unattributed'; altered[0].canonicalActivityIdentity = { activityId: 'invented' }; altered[0].optimizerEligible = true; altered[0].recordContentHash = hash(without(altered[0], 'recordContentHash'));
  const audit = auditRenderedPageWithoutUnlockEvidencePartition(altered, { candidateRecords: [input], policy, sourceCandidateSnapshotContentHash: snapshotHash, contentHash: hash });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotionTargetKeys.length, 1);
  assert.equal(audit.partitionCoverage.recordMismatchTargetKeys.length, 1);
});

test('CLI rejects a corrupted candidate snapshot without writing partition output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-rendered-without-unlock-partition-'));
  try {
    const directory = path.join(root, '2026-09-05T10-00-00-000Z'); fs.mkdirSync(directory, { recursive: true });
    const rows = [candidate()]; const raw = rows.map(JSON.stringify).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-source-entity-activity-candidate.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ domain: 'cross-source-entity-activity-candidate', records: 1, contentHash: '0'.repeat(64), source: { audit: { candidateInventoryComplete: true, publishable: true, completeActivityUniverse: false, accountIndependent: true, inputCoverage: { exactTargetSetAndContextMatch: true }, candidateCoverage: { duplicateCandidateKeys: [], candidateRoutingMismatchKeys: [], renderedPageWithoutUnlockMatchCount: 1 } } } }, null, 2));
    const command = spawnSync(process.execPath, ['platform/transforms/partition-cross-skill-rendered-pages-without-unlock-evidence.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(command.status, 0);
    assert.match(command.stderr, /No valid cross-source entity\/activity candidate snapshot exists/);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'cross-skill-rendered-page-without-unlock-evidence-partition.ndjson'))).length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill rendered-page/no-unlock provenance partition checks passed.');
