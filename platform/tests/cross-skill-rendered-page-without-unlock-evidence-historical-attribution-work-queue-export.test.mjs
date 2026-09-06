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
  auditHistoricalAttributionWorkQueue,
  buildHistoricalAttributionWorkQueue,
  compileHistoricalAttributionWorkQueuePolicy,
  renderHistoricalAttributionBlankDecisions,
  renderHistoricalAttributionQueueTsv
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-v1.json', 'utf8'));
const sourceWorkQueuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-v1.json', 'utf8'));
const partitionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-partition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-entry-v1.json', 'utf8'));
const decisionContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-decision-template-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-audit-v1.json', 'utf8'));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function observation(guideOrdinal, targetOrdinal, sourcePresence, parserChannel = 'links') {
  return {
    guideContentHash: hash(`guide:${guideOrdinal}`),
    guidePageId: 1000 + guideOrdinal,
    guideRevision: String(15000000 + guideOrdinal),
    guideTitle: `Guide ${guideOrdinal}`,
    namespaceId: 0,
    parserChannel,
    parserMetadata: parserChannel === 'images' ? { exists: null } : null,
    parserObservedAt: '2026-09-04T01:39:42.492Z',
    parserReportedExists: true,
    requestedTitle: `Target ${targetOrdinal}`,
    resolutionState: 'current_revision_pinned_page',
    sourcePresence
  };
}

function candidate(ordinal, shape) {
  const direct = observation(ordinal, ordinal, 'direct_source_stable_page_id');
  const renderedA = observation(ordinal + 20, ordinal, 'rendered_only_origin_unattributed');
  const renderedB = observation(ordinal + 40, ordinal, 'rendered_only_origin_unattributed', 'images');
  const observations = shape === 'direct' ? [direct] : shape === 'rendered' ? [renderedA, renderedB] : [direct, renderedA, renderedB];
  const presence = Object.fromEntries(partitionPolicy.sourcePresenceVocabulary.map(value => [value, observations.filter(row => row.sourcePresence === value).length]));
  const identity = {
    redirected: false,
    resolvedTitle: `Target ${ordinal}`,
    sourcePageId: 2000 + ordinal,
    sourceRevision: String(15100000 + ordinal),
    sourceTimestamp: '2026-09-03T12:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`
  };
  const base = {
    contract: partitionPolicy.inputContract,
    renderedTargetKey: `wiki-pageid:${identity.sourcePageId}`,
    candidateKey: null,
    candidateKind: partitionPolicy.inputCandidateKind,
    pageIdentity: { sourcePageId: identity.sourcePageId, resolvedTitle: identity.resolvedTitle, renderedSourceRevision: identity.sourceRevision, unlockSourceRevision: null, revisionRelationship: 'no_unlock_page_match' },
    sourceContexts: {
      renderedEvidence: { requestedTitles: [identity.resolvedTitle], namespaceIds: [0], guideObservationCount: observations.length, observations, sourcePresenceCounts: presence, targetPageIdentity: identity },
      unlockEvidence: null,
      crossSourcePageIdentityEstablished: false,
      revisionRelationship: 'no_unlock_page_match',
      semanticRoutingState: partitionPolicy.inputSemanticRoutingState
    },
    skillKeys: [],
    statementKeys: [],
    queuedForSemanticReview: false,
    activityDiscoveryCandidate: false,
    reviewStatus: 'not_queued',
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    sourceCrosswalkContentHash: hash(`crosswalk:${ordinal}`),
    accountIndependent: true,
    blockers: ['exact_cross_source_page_identity_not_established'],
    state: 'blocked'
  };
  return { ...base, contentHash: hash(base) };
}

function makeSource(actualSnapshotHashes = false) {
  const candidateRecords = [candidate(3, 'rendered'), candidate(1, 'direct'), candidate(2, 'mixed')];
  const candidateRaw = candidateRecords.map(JSON.stringify).join('\n') + '\n';
  const candidateHash = actualSnapshotHashes ? hash(candidateRaw) : 'a'.repeat(64);
  const partitionBuild = buildRenderedPageWithoutUnlockEvidencePartition({ candidateRecords, policy: partitionPolicy, sourceCandidateSnapshotContentHash: candidateHash, contentHash: hash });
  const partitionRecords = partitionBuild.records.map(record => ({ ...record, contentHash: hash(record) }));
  const partitionRaw = partitionRecords.map(JSON.stringify).join('\n') + '\n';
  const partitionHash = actualSnapshotHashes ? hash(partitionRaw) : 'b'.repeat(64);
  const workBuild = buildRenderedPageWithoutUnlockReconciliationWorkQueue({
    partitionRecords, candidateRecords, policy: sourceWorkQueuePolicy, partitionPolicy,
    partitionSnapshotContentHash: partitionHash, candidateSnapshotContentHash: candidateHash, contentHash: hash
  });
  const workQueueRecords = workBuild.records.map(record => ({ ...record, contentHash: hash(record) }));
  const workRaw = workQueueRecords.map(JSON.stringify).join('\n') + '\n';
  const workHash = actualSnapshotHashes ? hash(workRaw) : 'c'.repeat(64);
  const snapshots = { workQueue: workHash, partition: partitionHash, candidate: candidateHash };
  const sources = {
    candidate: {
      domain: 'cross-source-entity-activity-candidate', records: candidateRecords.length, contentHash: candidateHash,
      source: { audit: { candidateInventoryComplete: true, publishable: true, completeActivityUniverse: false } }
    },
    partition: {
      domain: 'cross-skill-rendered-page-without-unlock-evidence-partition', records: partitionRecords.length, contentHash: partitionHash,
      source: { audit: { partitionComplete: true, publishable: true, completeActivityUniverse: false } }
    },
    workQueue: {
      domain: 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue', records: workQueueRecords.length, contentHash: workHash,
      source: {
        policy: { id: sourceWorkQueuePolicy.policy, contentHash: hash(sourceWorkQueuePolicy) },
        partitionPolicy: { id: partitionPolicy.policy, contentHash: hash(partitionPolicy) },
        inputPartitionSnapshot: { directory: '2026-09-05T10-01-00-000Z', contentHash: partitionHash },
        inputCandidateSnapshot: { directory: '2026-09-05T10-00-00-000Z', contentHash: candidateHash },
        audit: workBuild.audit
      }
    }
  };
  return {
    workQueueRecords, partitionRecords, candidateRecords, policy, sourceWorkQueuePolicy, partitionPolicy,
    snapshots, sources, contentHash: hash,
    raw: { work: workRaw, partition: partitionRaw, candidate: candidateRaw }
  };
}

const source = makeSource();
const cloneSource = () => structuredClone(without(source, 'contentHash', 'raw'));

test('policy and contracts define a generic fail-closed historical attribution boundary', () => {
  const compiled = compileHistoricalAttributionWorkQueuePolicy(policy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.targetOverrides = { Example: 'skip' };
  assert.equal(compileHistoricalAttributionWorkQueuePolicy(specific, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileHistoricalAttributionWorkQueuePolicy(automatic, hash).valid, false);
});

test('exports exactly the mixed and rendered-only historical obligations in source order', () => {
  const built = buildHistoricalAttributionWorkQueue(source);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records.length, 2);
  assert.deepEqual(built.records.map(row => row.provenancePartition), ['mixed_direct_and_unattributed_rendered', 'rendered_only_origin_unattributed']);
  assert.deepEqual(built.records.map(row => row.queueOrdinal), [1, 2]);
  assert.equal(built.audit.sourceQueueCoverage.excludedDirectSourceOnlyCount, 1);
  assert.equal(built.audit.queueCoverage.orderMatchesFilteredSourceQueue, true);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing work-queue field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('preserves every rendered-only observation exactly and excludes direct observations', () => {
  const built = buildHistoricalAttributionWorkQueue(source);
  assert.equal(built.audit.observationCoverage.expectedHistoricalRenderedObservationCount, 4);
  assert.equal(built.audit.observationCoverage.outputHistoricalRenderedObservationCount, 4);
  assert.equal(built.audit.observationCoverage.exactHistoricalObservationPopulation, true);
  assert.equal(built.audit.observationCoverage.directObservationLeakKeys.length, 0);
  assert.equal(built.records[0].historicalRenderedObservationCount, 2);
  assert.ok(built.records.every(row => row.historicalRenderedObservations.every(item => item.observation.sourcePresence === 'rendered_only_origin_unattributed')));
  assert.ok(built.records.every(row => row.historicalRenderedObservations.every(item => item.exactGuideRevisionUrl.endsWith(item.observation.guideRevision))));
});

test('queue, grouped revision bindings, TSV, and blank decisions are deterministic', () => {
  const first = buildHistoricalAttributionWorkQueue(source);
  const secondInput = cloneSource();
  secondInput.candidateRecords.reverse();
  const second = buildHistoricalAttributionWorkQueue({ ...secondInput, contentHash: hash });
  assert.deepEqual(second, first);
  assert.equal(first.artifacts.queueTsv, renderHistoricalAttributionQueueTsv(first.records));
  assert.equal(first.artifacts.blankDecisions, renderHistoricalAttributionBlankDecisions(first.records, policy));
  const decisions = first.artifacts.blankDecisions.trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(decisions.length, 2);
  assert.equal(decisions[0].disposition, null);
  assert.deepEqual(decisions[0].observationAttributions, []);
  for (const field of decisionContract.required) assert.ok(Object.hasOwn(decisions[0], field), `Missing decision field ${field}`);
});

for (const [name, mutate] of [
  ['source work-queue outer hash drift', value => { value.workQueueRecords[0].contentHash = '0'.repeat(64); }],
  ['source work-queue intrinsic hash drift', value => { value.workQueueRecords[0].recordContentHash = '0'.repeat(64); value.workQueueRecords[0].contentHash = hash(without(value.workQueueRecords[0], 'contentHash')); }],
  ['candidate outer hash drift', value => { value.candidateRecords[0].contentHash = '0'.repeat(64); }],
  ['candidate observation drift', value => { value.candidateRecords[0].sourceContexts.renderedEvidence.observations[0].requestedTitle = 'Changed'; value.candidateRecords[0].contentHash = hash(without(value.candidateRecords[0], 'contentHash')); }],
  ['historical route drift', value => { const row = value.workQueueRecords.find(record => record.historicalRenderedAttributionRequired); row.provenancePartition = 'direct_source_only'; row.contentHash = hash(without(row, 'contentHash')); }],
  ['source manifest policy drift', value => { value.sources.workQueue.source.policy.contentHash = 'f'.repeat(64); }],
  ['account state injection', value => { value.candidateRecords[0].accountLevel = 34; value.candidateRecords[0].contentHash = hash(without(value.candidateRecords[0], 'contentHash')); }]
]) test(`fails atomically on ${name}`, () => {
  const changed = cloneSource(); mutate(changed);
  const built = buildHistoricalAttributionWorkQueue({ ...changed, contentHash: hash });
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
});

test('independent audit rejects attribution, semantic promotion, direct-observation leakage, and artifact drift', () => {
  const built = buildHistoricalAttributionWorkQueue(source);
  const changed = structuredClone(built.records);
  changed[0].historicalRenderedExpansionDependencyAttribution = { dependency: 'invented' };
  changed[0].reviewDecision = 'confirm_complete_historical_dependency_attribution';
  changed[0].canonicalActivityIdentity = { id: 'invented' };
  changed[0].optimizerEligible = true;
  changed[0].historicalRenderedObservations[0].observation.sourcePresence = 'direct_source_stable_page_id';
  changed[0].recordContentHash = hash(without(changed[0], 'recordContentHash'));
  const audit = auditHistoricalAttributionWorkQueue(changed, { ...source, artifacts: { ...built.artifacts, queueTsv: 'tampered\n' } });
  assert.equal(audit.publishable, false);
  assert.equal(audit.reviewCoverage.reviewStartedCount, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotionKeys.length, 1);
  assert.equal(audit.observationCoverage.directObservationLeakKeys.length, 1);
  assert.ok(audit.artifactCoverage.artifactMismatchFiles.includes('queue.tsv'));
});

function writeFixture(root, fixture) {
  const directories = {
    candidate: '2026-09-05T10-00-00-000Z',
    partition: '2026-09-05T10-01-00-000Z',
    workQueue: '2026-09-05T10-02-00-000Z'
  };
  const domains = {
    candidate: 'cross-source-entity-activity-candidate',
    partition: 'cross-skill-rendered-page-without-unlock-evidence-partition',
    workQueue: 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue'
  };
  for (const key of Object.keys(directories)) {
    const directory = path.join(root, directories[key]); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `${domains[key]}.ndjson`), fixture.raw[key === 'workQueue' ? 'work' : key]);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(fixture.sources[key]));
  }
  return directories;
}

test('CLI writes a complete snapshot and rejects a corrupt selected source snapshot without partial output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-historical-attribution-'));
  try {
    const fixture = makeSource(true);
    const directories = writeFixture(root, fixture);
    const command = spawnSync(process.execPath, [
      'platform/transforms/export-cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue.mjs',
      `--root=${root}`, `--work-queue-snapshot=${directories.workQueue}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, true);
    assert.equal(output.coverage.queueRecords, 2);
    assert.equal(output.coverage.historicalRenderedObservations, 4);
    const snapshotFile = path.join(root, output.outputSnapshot.directory, 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue.ndjson');
    assert.equal(fs.existsSync(snapshotFile), true);

    fixture.sources.workQueue.source.policy.contentHash = '0'.repeat(64);
    fs.writeFileSync(path.join(root, directories.workQueue, 'manifest.json'), JSON.stringify(fixture.sources.workQueue));
    const failed = spawnSync(process.execPath, [
      'platform/transforms/export-cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue.mjs',
      `--root=${root}`, `--work-queue-snapshot=${directories.workQueue}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /failed source-gate validation/);
    const outputSnapshots = fs.readdirSync(root, { withFileTypes: true }).filter(entry =>
      entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue.ndjson'))
    );
    assert.equal(outputSnapshots.length, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill rendered-page/no-unlock historical attribution work-queue export checks passed.');
