import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockEvidencePartition } from '../transforms/cross-skill-rendered-page-without-unlock-evidence-partition-lib.mjs';
import { buildRenderedPageWithoutUnlockReconciliationWorkQueue } from '../transforms/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-lib.mjs';
import {
  auditRenderedPageWithoutUnlockTargetSourceSignatureShard,
  buildRenderedPageWithoutUnlockTargetSourceSignatureShard,
  compileRenderedPageWithoutUnlockTargetSourceSignaturePolicy,
  selectRenderedPageWithoutUnlockSourceSignatureShard
} from '../ingestion/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-v1.json', 'utf8'));
const partitionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-partition-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard-audit-v1.json', 'utf8'));
const candidateSnapshotHash = 'a'.repeat(64);
const partitionSnapshotHash = 'b'.repeat(64);
const queueSnapshotHash = 'c'.repeat(64);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function observation(ordinal, sourcePresence) {
  return { guideContentHash: hash(`guide:${ordinal}`), guidePageId: 1000 + ordinal, guideRevision: String(15000000 + ordinal), guideTitle: `Guide ${ordinal}`, namespaceId: 0, parserChannel: 'links', parserMetadata: null, parserObservedAt: '2026-09-04T01:39:42.492Z', parserReportedExists: true, requestedTitle: `Target ${ordinal}`, resolutionState: 'current_revision_pinned_page', sourcePresence };
}

function candidate(ordinal, shape) {
  const observations = shape === 'direct' ? [observation(ordinal, 'direct_source_stable_page_id')] : shape === 'rendered'
    ? [observation(ordinal, 'rendered_only_origin_unattributed')]
    : [observation(ordinal, 'direct_source_stable_page_id'), observation(ordinal + 100, 'rendered_only_origin_unattributed')];
  const counts = Object.fromEntries(partitionPolicy.sourcePresenceVocabulary.map(value => [value, observations.filter(row => row.sourcePresence === value).length]));
  const identity = { redirected: false, resolvedTitle: `Target ${ordinal}`, sourcePageId: 2000 + ordinal, sourceRevision: String(15100000 + ordinal), sourceTimestamp: `2026-09-0${ordinal}T12:00:00Z`, sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}` };
  const base = {
    contract: partitionPolicy.inputContract, renderedTargetKey: `wiki-pageid:${identity.sourcePageId}`, candidateKey: null, candidateKind: partitionPolicy.inputCandidateKind,
    pageIdentity: { sourcePageId: identity.sourcePageId, resolvedTitle: identity.resolvedTitle, renderedSourceRevision: identity.sourceRevision, unlockSourceRevision: null, revisionRelationship: 'no_unlock_page_match' },
    sourceContexts: { renderedEvidence: { requestedTitles: [identity.resolvedTitle], namespaceIds: [0], guideObservationCount: observations.length, observations, sourcePresenceCounts: counts, targetPageIdentity: identity }, unlockEvidence: null, crossSourcePageIdentityEstablished: false, revisionRelationship: 'no_unlock_page_match', semanticRoutingState: partitionPolicy.inputSemanticRoutingState },
    skillKeys: [], statementKeys: [], queuedForSemanticReview: false, activityDiscoveryCandidate: false, reviewStatus: 'not_queued', canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null, optimizerEligible: false,
    sourceCrosswalkContentHash: hash(`crosswalk:${ordinal}`), accountIndependent: true, blockers: ['exact_cross_source_page_identity_not_established'], state: 'blocked'
  };
  return { ...base, contentHash: hash(base) };
}

const candidates = [candidate(1, 'direct'), candidate(2, 'mixed'), candidate(3, 'rendered')];
const partition = buildRenderedPageWithoutUnlockEvidencePartition({ candidateRecords: candidates, policy: partitionPolicy, sourceCandidateSnapshotContentHash: candidateSnapshotHash, contentHash: hash });
const partitionRecords = partition.records.map(record => ({ ...record, contentHash: hash(record) }));
const queue = buildRenderedPageWithoutUnlockReconciliationWorkQueue({ partitionRecords, candidateRecords: candidates, policy: queuePolicy, partitionPolicy, partitionSnapshotContentHash: partitionSnapshotHash, candidateSnapshotContentHash: candidateSnapshotHash, contentHash: hash });
const queueRecords = queue.records.map(record => ({ ...record, contentHash: hash(record) }));
const contents = {
  '15100001': "{{Infobox Item\n|name=Target 1\n}}\n'''Target 1''' is source evidence.\n==Use==\nEvidence.\n[[Category:Examples]]",
  '15100002': "'''Target 2''' is another page.\n\nSecond lead.\n==Method==\nEvidence.",
  '15100003': "{{Information|description=Target 3}}\n'''Target 3''' source.\n==History==\nEvidence."
};
const fetchedPages = queueRecords.map(row => ({ pageid: row.stableWikiPageIdentity.sourcePageId, ns: 0, title: row.stableWikiPageIdentity.resolvedTitle, revisions: [{ revid: Number(row.stableWikiPageIdentity.sourceRevision), timestamp: row.stableWikiPageIdentity.sourceTimestamp, slots: { main: { content: contents[row.stableWikiPageIdentity.sourceRevision] } } }] }));
const source = { queueRecords, fetchedPages, policy, queueSnapshotContentHash: queueSnapshotHash, startOrdinal: 1, limit: 2, contentHash: hash };
const cloneSource = () => ({ queueRecords: structuredClone(queueRecords), fetchedPages: structuredClone(fetchedPages), policy: structuredClone(policy), queueSnapshotContentHash: queueSnapshotHash, startOrdinal: 1, limit: 2, contentHash: hash });
const rehashQueueRecord = row => {
  row.recordContentHash = hash(without(row, 'contentHash', 'recordContentHash'));
  row.contentHash = hash(without(row, 'contentHash'));
};

test('policy and contracts are fail closed and shard bounded', () => {
  assert.deepEqual(compileRenderedPageWithoutUnlockTargetSourceSignaturePolicy(policy), { valid: true, invalidRules: [] });
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileRenderedPageWithoutUnlockTargetSourceSignaturePolicy(automatic).valid, false);
  const oversized = structuredClone(policy); oversized.maximumShardSize = 0;
  assert.equal(compileRenderedPageWithoutUnlockTargetSourceSignaturePolicy(oversized).valid, false);
});

test('selects only a contiguous bounded queue shard', () => {
  assert.deepEqual(selectRenderedPageWithoutUnlockSourceSignatureShard(queueRecords, { startOrdinal: 2, limit: 2, maximumShardSize: 250 }).map(row => row.queueOrdinal), [2, 3]);
  assert.throws(() => selectRenderedPageWithoutUnlockSourceSignatureShard(queueRecords, { startOrdinal: 1, limit: 251, maximumShardSize: 250 }));
  const broken = structuredClone(queueRecords); broken[1].queueOrdinal = 9;
  assert.throws(() => selectRenderedPageWithoutUnlockSourceSignatureShard(broken, { startOrdinal: 1, limit: 2, maximumShardSize: 250 }));
});

test('captures exact-revision source signatures without semantic promotion', () => {
  const built = buildRenderedPageWithoutUnlockTargetSourceSignatureShard(source);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.sourceSignatureShardComplete, true);
  assert.equal(built.audit.sourceSignaturePopulationComplete, false);
  assert.equal(built.records.length, 2);
  assert.equal(built.audit.inputCoverage.remainingQueueEntryCount, 1);
  assert.equal(built.audit.sourceAlignment.fullyAlignedCount, 2);
  assert.equal(built.records[0].sourceContentHash, hash(contents['15100001']));
  assert.equal(built.records[0].rootTemplateEvidence[0].template, 'Infobox Item');
  assert.equal(built.records[0].directCategoryEvidence[0].category, 'Examples');
  assert.equal(built.records[0].headingEvidence[0].normalizedTitle, 'Use');
  assert.deepEqual(built.records[0].sourceScopedSemanticRelevanceReview, { state: 'unreviewed', disposition: null, evidenceKeys: [] });
  assert.equal(built.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing signature field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('identical exact-revision inputs produce deterministic signatures and audit', () => {
  assert.deepEqual(buildRenderedPageWithoutUnlockTargetSourceSignatureShard(source), buildRenderedPageWithoutUnlockTargetSourceSignatureShard(cloneSource()));
});

test('accepts an exact redirected identity across namespaces while retaining both namespaces', () => {
  const changed = cloneSource();
  changed.queueRecords[0].stableWikiPageIdentity.redirected = true;
  changed.queueRecords[0].stableWikiPageIdentity.resolvedTitle = 'Guide:Target 1';
  changed.queueRecords[0].stableWikiPageIdentity.sourceUrl = 'https://oldschool.runescape.wiki/w/Guide%3ATarget_1';
  rehashQueueRecord(changed.queueRecords[0]);
  changed.fetchedPages[0].ns = 3002;
  changed.fetchedPages[0].title = 'Guide:Target 1';
  const built = buildRenderedPageWithoutUnlockTargetSourceSignatureShard(changed);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records[0].sourceNamespaceId, 3002);
  assert.deepEqual(built.records[0].observedNamespaceIds, [0]);
  assert.equal(built.records[0].revisionAlignment.fetchedNamespaceObserved, true);
});

test('rejects an unredirected namespace mismatch and reports the failed queue entry', () => {
  const changed = cloneSource();
  changed.fetchedPages[0].ns = 3002;
  const built = buildRenderedPageWithoutUnlockTargetSourceSignatureShard(changed);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.fetchCoverage.fetchedExactRevisionCount, 2);
  assert.deepEqual(built.audit.sourceAlignment.failedQueueEntryKeys, [changed.queueRecords[0].workQueueEntryKey]);
});

for (const [name, mutate] of [
  ['queue outer hash drift', value => { value.queueRecords[0].contentHash = '0'.repeat(64); }],
  ['queue intrinsic hash drift', value => { value.queueRecords[0].recordContentHash = '0'.repeat(64); value.queueRecords[0].contentHash = hash(without(value.queueRecords[0], 'contentHash')); }],
  ['fetched revision drift', value => { value.fetchedPages[0].revisions[0].revid = 999; }],
  ['fetched timestamp drift', value => { value.fetchedPages[0].revisions[0].timestamp = '2026-09-09T00:00:00Z'; }],
  ['fetched title drift', value => { value.fetchedPages[0].title = 'Wrong title'; }],
  ['missing exact revision', value => { value.fetchedPages.splice(0, 1); }]
]) test(`fails atomically on ${name}`, () => {
  const changed = cloneSource(); mutate(changed);
  const built = buildRenderedPageWithoutUnlockTargetSourceSignatureShard(changed);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
});

test('audit rejects semantic review, optimizer promotion, and account state', () => {
  const built = buildRenderedPageWithoutUnlockTargetSourceSignatureShard(source);
  const changed = structuredClone(built.records);
  changed[0].sourceScopedSemanticRelevanceReview = { state: 'reviewed', disposition: 'activity', evidenceKeys: ['invented'] };
  changed[0].canonicalActivityIdentity = { id: 'invented' };
  changed[0].optimizerEligible = true;
  changed[0].accountLevel = 34;
  changed[0].recordContentHash = hash(without(changed[0], 'recordContentHash'));
  const audit = auditRenderedPageWithoutUnlockTargetSourceSignatureShard(changed, source);
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotionQueueEntryKeys.length, 1);
  assert.ok(audit.blockers.includes('current_account_state_present'));
});

test('CLI rejects a corrupt queue manifest before network fetch or output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-target-source-signature-'));
  try {
    const directory = path.join(root, '2026-09-05T10-00-00-000Z'); fs.mkdirSync(directory, { recursive: true });
    const raw = queueRecords.map(JSON.stringify).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ domain: 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue', records: queueRecords.length, contentHash: 'bad', source: { audit: { queueExportComplete: true, publishable: true, reconciliationComplete: false, completeActivityUniverse: false, queueCoverage: { outputRecordCount: queueRecords.length, missingOutputPartitionKeys: [], unexpectedOutputPartitionKeys: [] }, semanticPreservationCoverage: { unsupportedPromotionPartitionKeys: [] } } } }));
    const command = spawnSync(process.execPath, ['platform/ingestion/ingest-wiki-cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard.mjs', `--root=${root}`, '--start=1', '--limit=2'], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(command.status, 0);
    assert.match(command.stderr, /No valid rendered-page\/no-unlock reconciliation work-queue snapshot exists/);
    assert.equal(fs.readdirSync(root).filter(name => name.includes('target-source-signature')).length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill rendered-page/no-unlock target source-signature shard checks passed.');
