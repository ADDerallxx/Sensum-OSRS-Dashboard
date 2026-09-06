import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditRenderedPageWithoutUnlockTargetSourceSignaturePopulation,
  buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation,
  compileRenderedPageWithoutUnlockTargetSourceSignaturePopulationPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population-consolidation-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population-consolidation-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population-audit-v1.json', 'utf8'));
const queueDomain = 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue';
const shardDomain = 'cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard';
const queueHash = 'a'.repeat(64);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function withHashes(base) {
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function queueRecord(ordinal) {
  return withHashes({
    contract: policy.inputQueueContract,
    workQueueEntryKey: `queue:${ordinal}`,
    queueOrdinal: ordinal,
    partitionOrdinal: ordinal + 10,
    provenancePartition: ordinal % 2 ? 'direct_source_only' : 'rendered_only_origin_unattributed',
    renderedTargetKey: `wiki-pageid:${1000 + ordinal}`,
    requestedTitles: [`Target ${ordinal}`],
    namespaceIds: [0],
    stableWikiPageIdentity: { redirected: false, resolvedTitle: `Target ${ordinal}`, sourcePageId: 1000 + ordinal, sourceRevision: String(15000000 + ordinal), sourceTimestamp: `2026-09-0${ordinal}T00:00:00Z`, sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}` },
    accountIndependent: true
  });
}

function signature(queue) {
  const base = {
    contract: policy.inputRecordContract,
    signatureKey: `${queue.workQueueEntryKey}|target-source-signature`,
    sourceWorkQueueEntryKey: queue.workQueueEntryKey,
    sourceWorkQueueEntryContentHash: queue.contentHash,
    sourceWorkQueueEntryIntrinsicContentHash: queue.recordContentHash,
    sourceWorkQueueSnapshotContentHash: queueHash,
    queueOrdinal: queue.queueOrdinal,
    partitionOrdinal: queue.partitionOrdinal,
    provenancePartition: queue.provenancePartition,
    renderedTargetKey: queue.renderedTargetKey,
    requestedTitles: queue.requestedTitles,
    observedNamespaceIds: queue.namespaceIds,
    sourcePageId: queue.stableWikiPageIdentity.sourcePageId,
    sourceNamespaceId: 0,
    resolvedTitle: queue.stableWikiPageIdentity.resolvedTitle,
    sourceRevision: queue.stableWikiPageIdentity.sourceRevision,
    sourceTimestamp: queue.stableWikiPageIdentity.sourceTimestamp,
    sourceUrl: queue.stableWikiPageIdentity.sourceUrl,
    sourceContentHash: hash(`source:${queue.queueOrdinal}`),
    sourceContentBytes: 100 + queue.queueOrdinal,
    sourceLineCount: 3,
    revisionAlignment: { queueEntryOuterHashValid: true, queueEntryIntrinsicHashValid: true, fetchedPageIdMatches: true, fetchedRevisionMatches: true, fetchedTimestampMatches: true, fetchedTitleMatches: true, fetchedNamespaceObserved: true, fetchedContentPresent: true, sourceUrlRetained: true },
    rootTemplateEvidence: [{ template: 'Example', templateKey: 'example', line: 1 }],
    directCategoryEvidence: [], leadParagraphEvidence: [], headingEvidence: [],
    sourceScopedSemanticRelevanceReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
    unlockEvidencePresent: false, canonicalGameEntityIdentity: null, canonicalActivityIdentity: null,
    repeatabilityClassification: null, mechanicsReviewComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['source_scoped_semantic_relevance_disposition_pending'],
    state: 'source_signature_captured_semantic_relevance_pending'
  };
  return withHashes(base);
}

function rawFor(records) { return records.map(json).join('\n') + '\n'; }

function queueSnapshot(records) {
  const raw = rawFor(records);
  return {
    directory: '2026-09-06T01-00-00-000Z', records, rawContentHash: hash(raw),
    manifest: { contract: 'sensum.ingestion-manifest.v1', domain: queueDomain, records: records.length, contentHash: hash(raw), source: { policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash }, audit: { queueExportComplete: true, publishable: true, reconciliationComplete: false, completeActivityUniverse: false } } }
  };
}

function shardSnapshot(directory, records) {
  const raw = rawFor(records);
  const first = records[0].queueOrdinal;
  const last = records.at(-1).queueOrdinal;
  return {
    directory, records, rawContentHash: hash(raw),
    manifest: {
      contract: 'sensum.ingestion-manifest.v1', domain: shardDomain, records: records.length, contentHash: hash(raw),
      source: {
        policy: { id: policy.inputShardPolicy, contentHash: policy.inputShardPolicyContentHash },
        inputQueueSnapshot: { directory: '2026-09-06T01-00-00-000Z', contentHash: queueHash },
        fetchedRevisions: records.map(record => ({ pageId: record.sourcePageId, namespaceId: record.sourceNamespaceId, title: record.resolvedTitle, revision: record.sourceRevision, timestamp: record.sourceTimestamp, contentHash: record.sourceContentHash })),
        audit: { contract: policy.inputShardAuditContract, inputCoverage: { selectedFirstOrdinal: first, selectedLastOrdinal: last, selectedQueueEntryCount: records.length }, sourceSignatureShardComplete: true, sourceSignaturePopulationComplete: false, completeActivityUniverse: false, publishable: true }
      }
    }
  };
}

const queueRecords = [1, 2, 3, 4].map(queueRecord);
const inputQueue = queueSnapshot(queueRecords);
inputQueue.manifest.contentHash = queueHash;
inputQueue.rawContentHash = queueHash;
const signatures = queueRecords.map(signature);
const shards = [shardSnapshot('2026-09-06T01-01-00-000Z', signatures.slice(0, 2)), shardSnapshot('2026-09-06T01-02-00-000Z', signatures.slice(2)), shardSnapshot('2026-09-06T01-03-00-000Z', signatures.slice(0, 2))];
const source = { queueSnapshot: inputQueue, shardSnapshots: shards, policy, contentHash: hash };

test('policy and audit contract require a fail-closed population gate', () => {
  assert.deepEqual(compileRenderedPageWithoutUnlockTargetSourceSignaturePopulationPolicy(policy), { valid: true, invalidRules: [] });
  const changed = structuredClone(policy); changed.rules.automaticVerificationAllowed = true;
  assert.equal(compileRenderedPageWithoutUnlockTargetSourceSignaturePopulationPolicy(changed).valid, false);
  assert.ok(auditContract.required.includes('sourceSignaturePopulationComplete'));
  assert.equal(auditContract.rules.populationCompletionDoesNotCompleteSemanticReconciliationOrActivityCoverage, true);
});

test('consolidates one deterministic representative per identical range and proves exact population coverage', () => {
  const built = buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation(source);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.sourceSignaturePopulationComplete, true);
  assert.equal(built.audit.reconciliationComplete, false);
  assert.equal(built.audit.completeActivityUniverse, false);
  assert.equal(built.records.length, 4);
  assert.equal(built.audit.shardDiscoveryCoverage.candidateShardSnapshotCount, 3);
  assert.equal(built.audit.shardDiscoveryCoverage.selectedShardCount, 2);
  assert.equal(built.audit.shardDiscoveryCoverage.equivalentRerunSnapshotCount, 1);
  assert.deepEqual(built.audit.shardDiscoveryCoverage.selectedShards.map(row => row.directory), ['2026-09-06T01-01-00-000Z', '2026-09-06T01-02-00-000Z']);
  assert.deepEqual(built.audit.populationCoverage.missingOrdinals, []);
  assert.equal(built.audit.sourceAlignment.fullyAlignedAndBoundCount, 4);
  assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing population audit field ${field}`);
});

test('output and audit are deterministic under reordered snapshot inputs', () => {
  const changed = { ...source, shardSnapshots: [shards[2], shards[1], shards[0]] };
  assert.deepEqual(buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation(source), buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation(changed));
});

test('fails atomically when the selected shard ranges leave a queue gap', () => {
  const built = buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation({ ...source, shardSnapshots: [shards[0], shards[2]] });
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.deepEqual(built.audit.populationCoverage.missingOrdinals, [3, 4]);
});

test('fails atomically when equivalent shard reruns conflict', () => {
  const conflicting = structuredClone(shards[2]);
  conflicting.records[0].sourceContentBytes += 1;
  conflicting.records[0].recordContentHash = hash(without(conflicting.records[0], 'contentHash', 'recordContentHash'));
  conflicting.records[0].contentHash = hash(without(conflicting.records[0], 'contentHash'));
  conflicting.manifest.source.fetchedRevisions[0].contentHash = conflicting.records[0].sourceContentHash;
  const raw = rawFor(conflicting.records); conflicting.rawContentHash = hash(raw); conflicting.manifest.contentHash = hash(raw);
  const built = buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation({ ...source, shardSnapshots: [shards[0], shards[1], conflicting] });
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.deepEqual(built.audit.shardDiscoveryCoverage.conflictingEquivalentRanges, ['1-2']);
});

test('fails atomically on a tampered shard manifest or record', () => {
  for (const mutate of [
    snapshot => { snapshot.records[0].contentHash = '0'.repeat(64); },
    snapshot => { snapshot.manifest.source.policy.contentHash = '0'.repeat(64); }
  ]) {
    const tampered = structuredClone(shards[1]); mutate(tampered);
    const built = buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation({ ...source, shardSnapshots: [shards[0], tampered] });
    assert.equal(built.audit.publishable, false);
    assert.equal(built.records.length, 0);
    assert.deepEqual(built.audit.shardDiscoveryCoverage.invalidShardDirectories, [tampered.directory]);
  }
});

test('fails atomically on semantic promotion or account state', () => {
  for (const mutate of [record => { record.optimizerEligible = true; }, record => { record.accountLevel = 34; }]) {
    const changed = structuredClone(signatures);
    mutate(changed[2]);
    changed[2].recordContentHash = hash(without(changed[2], 'contentHash', 'recordContentHash'));
    changed[2].contentHash = hash(without(changed[2], 'contentHash'));
    const promotedShard = shardSnapshot('2026-09-06T01-04-00-000Z', changed.slice(2));
    const built = buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation({ ...source, shardSnapshots: [shards[0], promotedShard] });
    assert.equal(built.audit.publishable, false);
    assert.equal(built.records.length, 0);
  }
});

test('standalone audit detects a record-to-queue binding mismatch', () => {
  const changed = structuredClone(signatures); changed[0].sourceWorkQueueEntryKey = 'wrong';
  changed[0].recordContentHash = hash(without(changed[0], 'contentHash', 'recordContentHash'));
  changed[0].contentHash = hash(without(changed[0], 'contentHash'));
  const audit = auditRenderedPageWithoutUnlockTargetSourceSignaturePopulation(changed, source);
  assert.equal(audit.publishable, false);
  assert.deepEqual(audit.sourceAlignment.bindingMismatchOrdinals, [1]);
});

test('CLI writes no population snapshot when shard coverage is incomplete', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-source-population-'));
  try {
    const write = snapshot => {
      const directory = path.join(root, snapshot.directory); fs.mkdirSync(directory, { recursive: true });
      const domain = snapshot.manifest.domain;
      fs.writeFileSync(path.join(directory, `${domain}.ndjson`), rawFor(snapshot.records));
      const manifest = structuredClone(snapshot.manifest); manifest.contentHash = hash(rawFor(snapshot.records));
      if (domain === queueDomain) manifest.source.audit = { queueExportComplete: true, publishable: true, reconciliationComplete: false, completeActivityUniverse: false };
      if (domain === shardDomain) manifest.source.inputQueueSnapshot.contentHash = manifest.domain === shardDomain ? hash(rawFor(inputQueue.records)) : manifest.source.inputQueueSnapshot.contentHash;
      fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    };
    const queueForDisk = queueSnapshot(queueRecords); write(queueForDisk);
    const oneShard = shardSnapshot('2026-09-06T01-01-00-000Z', signatures.slice(0, 2)); oneShard.manifest.source.inputQueueSnapshot.contentHash = hash(rawFor(queueRecords)); write(oneShard);
    const command = spawnSync(process.execPath, ['platform/transforms/consolidate-cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2);
    assert.match(command.stdout, /queue_and_consolidated_signature_population_do_not_match_exactly/);
    assert.equal(fs.readdirSync(root).filter(name => /^\d/.test(name)).length, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill rendered-page/no-unlock target source-signature population consolidation checks passed.');
