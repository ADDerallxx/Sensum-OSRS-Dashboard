import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import { buildHistoricalAttributionReviewDecisionImport } from '../transforms/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-lib.mjs';
import {
  auditHistoricalAttributionHumanReviewPackets,
  buildHistoricalAttributionHumanReviewPackets,
  compileHistoricalAttributionHumanReviewPacketPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-human-review-packet-materialization-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-human-review-packet-materialization-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-v1.json', 'utf8'));
const packetContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-human-review-packet-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-human-review-packet-materialization-audit-v1.json', 'utf8'));
const inputDomain = 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-human-review-packets';
const createdAt = '2026-09-06T02:19:44.355Z';
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const exactRevisionUrl = revision => `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}`;

function observation(ordinal, index) {
  const value = {
    guideContentHash: hash(`guide:${ordinal}:${index}`),
    guidePageId: 20000 + ordinal * 10 + index,
    guideRevision: String(15300000 + ordinal * 10 + index),
    guideTitle: `Guide ${ordinal}-${index}`,
    namespaceId: 0,
    parserChannel: index % 2 ? 'images' : 'links',
    parserMetadata: null,
    parserObservedAt: `2026-09-04T01:39:4${index}.${ordinal}Z`,
    parserReportedExists: true,
    requestedTitle: `Target ${ordinal}`,
    resolutionState: 'current_revision_pinned_page',
    sourcePresence: 'rendered_only_origin_unattributed'
  };
  return {
    exactGuideRevisionUrl: exactRevisionUrl(value.guideRevision),
    observation: value,
    observationContentHash: hash(value),
    observationKey: hash({ renderedTargetKey: `wiki-pageid:${10000 + ordinal}`, observation: value })
  };
}

function queueRecord(ordinal = 1) {
  const renderedTargetKey = `wiki-pageid:${10000 + ordinal}`;
  const sourceWorkQueueEntryKey = `${renderedTargetKey}|without-unlock-evidence-partition|source-bound-reconciliation-work`;
  const observations = [observation(ordinal, 1), observation(ordinal, 2)];
  const bindings = observations.map(row => {
    const base = {
      exactGuideRevisionUrl: row.exactGuideRevisionUrl,
      guideContentHash: row.observation.guideContentHash,
      guidePageId: row.observation.guidePageId,
      guideRevision: row.observation.guideRevision,
      guideTitle: row.observation.guideTitle,
      observationKeys: [row.observationKey]
    };
    return { ...base, bindingContentHash: hash(base), observationCount: 1 };
  });
  const base = {
    accountIndependent: true,
    attributionEvidenceKeys: [],
    automaticVerificationApplied: false,
    blockers: ['historical_rendered_expansion_dependency_attribution_pending'],
    canonicalActivityIdentity: null,
    canonicalGameEntityIdentity: null,
    contract: policy.queueContract,
    guideObservationCount: 2,
    historicalAttributionWorkEntryKey: `${sourceWorkQueueEntryKey}|historical-rendered-attribution-work`,
    historicalGuideRevisionBindingCount: bindings.length,
    historicalGuideRevisionBindings: bindings,
    historicalGuideRevisionBindingsContentHash: hash(bindings),
    historicalRenderedExpansionDependencyAttribution: null,
    historicalRenderedObservationCount: observations.length,
    historicalRenderedObservations: observations,
    historicalRenderedObservationSetContentHash: hash(observations),
    mechanicsReviewComplete: false,
    nonClaims: [...queuePolicy.nonClaims],
    optimizerEligible: false,
    provenancePartition: ordinal % 2 ? 'mixed_direct_and_unattributed_rendered' : 'rendered_only_origin_unattributed',
    queueOrdinal: ordinal,
    renderedTargetKey,
    repeatabilityClassification: null,
    requiredAttributionEvidence: [...queuePolicy.requiredAttributionEvidence],
    requiredEvidenceChannel: queuePolicy.requiredEvidenceChannel,
    requirementOrUnlockApplied: false,
    reviewDecision: null,
    semanticDisposition: null,
    sourceCandidateContentHash: hash(`candidate:${ordinal}`),
    sourceCandidateSnapshotContentHash: hash('candidate-snapshot'),
    sourcePartitionSnapshotContentHash: hash('partition-snapshot'),
    sourceWorkQueueEntryKey,
    sourceWorkQueueIntrinsicRecordContentHash: hash(`source-work-intrinsic:${ordinal}`),
    sourceWorkQueueOrdinal: 2000 + ordinal,
    sourceWorkQueueRecordContentHash: hash(`source-work-record:${ordinal}`),
    sourceWorkQueueSnapshotContentHash: hash('source-work-snapshot'),
    stableWikiPageIdentity: {
      redirected: false,
      resolvedTitle: `Target ${ordinal}`,
      sourcePageId: 10000 + ordinal,
      sourceRevision: String(15200000 + ordinal),
      sourceTimestamp: '2026-08-29T21:55:41Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`
    },
    state: policy.queueState
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function inputBundle(queues) {
  const raw = queues.map(json).join('\n') + '\n';
  const observationCount = queues.reduce((sum, row) => sum + row.historicalRenderedObservationCount, 0);
  const bindingCount = queues.reduce((sum, row) => sum + row.historicalGuideRevisionBindingCount, 0);
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1',
    domain: inputDomain,
    createdAt,
    records: queues.length,
    contentHash: hash(raw),
    source: {
      policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash },
      audit: {
        observationCoverage: {
          expectedHistoricalRenderedObservationCount: observationCount,
          outputHistoricalRenderedObservationCount: observationCount,
          expectedHistoricalGuideRevisionBindingCount: bindingCount,
          invalidObservationSourceKeys: [], emptyObservationSourceKeys: [], countMismatchSourceKeys: [], duplicateObservationKeys: [],
          missingObservationKeys: [], unexpectedObservationKeys: [], directObservationLeakKeys: [], exactHistoricalObservationPopulation: true
        },
        queueCoverage: {
          outputRecordCount: queues.length, duplicateOutputKeys: [], missingOutputKeys: [], unexpectedOutputKeys: [], recordMismatchKeys: [], orderMatchesFilteredSourceQueue: true
        },
        reviewCoverage: { blankDecisionTemplateCount: queues.length, reviewStartedCount: 0, attributionCompletedCount: 0 },
        semanticPreservationCoverage: {
          requirementOrUnlockApplicationCount: 0, semanticDispositionCount: 0, canonicalGameEntityIdentityCount: 0,
          canonicalActivityIdentityCount: 0, repeatabilityClassificationCount: 0, mechanicsReviewCompleteCount: 0,
          optimizerPromotionCount: 0, automaticVerificationCount: 0, unsupportedPromotionKeys: []
        },
        queueExportComplete: true,
        historicalAttributionComplete: false,
        completeActivityUniverse: false,
        publishable: true
      }
    }
  };
  return { raw, manifest, snapshotHash: manifest.contentHash };
}

function rehashQueue(queue) {
  const copy = without(queue, 'contentHash', 'recordContentHash');
  const intrinsic = { ...copy, recordContentHash: hash(copy) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function build(queues, changedPolicy = policy, overrides = {}) {
  const bundle = inputBundle(queues);
  return buildHistoricalAttributionHumanReviewPackets({
    queueRecords: queues,
    queueRaw: bundle.raw,
    queueManifest: bundle.manifest,
    queueSnapshotContentHash: bundle.snapshotHash,
    policy: changedPolicy,
    queuePolicy,
    decisionPolicy,
    contentHash: hash,
    ...overrides
  });
}

test('policy is generic, queue-bound, importer-bound, and cannot automatically verify', () => {
  const compiled = compileHistoricalAttributionHumanReviewPacketPolicy(policy, queuePolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'confirm' };
  assert.equal(compileHistoricalAttributionHumanReviewPacketPolicy(specific, queuePolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileHistoricalAttributionHumanReviewPacketPolicy(automatic, queuePolicy, decisionPolicy, hash).valid, false);
  const changedImporter = structuredClone(decisionPolicy); changedImporter.allowedDecisions = [...changedImporter.allowedDecisions].reverse();
  assert.equal(compileHistoricalAttributionHumanReviewPacketPolicy(policy, queuePolicy, changedImporter, hash).valid, false);
});

test('materializes one exact packet per queue record with every observation and no promotion', () => {
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3)];
  const result = build(queues);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.packetMaterializationComplete, true);
  assert.equal(result.audit.historicalAttributionComplete, false);
  assert.equal(result.records.length, 3);
  assert.equal(result.audit.evidenceCoverage.historicalRenderedObservationCount, 6);
  assert.equal(result.audit.evidenceCoverage.historicalGuideRevisionBindingCount, 6);
  const packet = result.records[0];
  assert.equal(packet.sourceExactRevisionUrl, exactRevisionUrl('15200001'));
  assert.equal(packet.decisionTemplate.disposition, null);
  assert.equal(packet.decisionRecorded, false);
  assert.equal(packet.historicalAttributionApplied, false);
  assert.equal(packet.optimizerEligible, false);
  assert.deepEqual(packet.historicalRenderedObservations, queues[0].historicalRenderedObservations);
  assert.deepEqual(packet.historicalGuideRevisionBindings, queues[0].historicalGuideRevisionBindings);
  for (const field of packetContract.required) assert.ok(Object.hasOwn(packet, field), `Missing packet field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('creates bounded batches with importer-compatible blank decisions', () => {
  const smallBatches = structuredClone(policy); smallBatches.batchSize = 2;
  const queues = [1, 2, 3, 4, 5].map(queueRecord);
  const result = build(queues, smallBatches);
  assert.equal(result.audit.publishable, true);
  assert.deepEqual(result.batchArtifacts.map(row => row.packetCount), [2, 2, 1]);
  assert.deepEqual(result.batchArtifacts.map(row => [row.firstPacketOrdinal, row.lastPacketOrdinal]), [[1, 2], [3, 4], [5, 5]]);
  assert.equal(result.audit.batchCoverage.partitionExact, true);
  assert.match(result.batchArtifacts[0].markdown, /Rendered observations requiring attribution/);
  assert.match(result.batchArtifacts[0].markdown, /Current dependencies cannot be substituted/);
  const submissions = result.batchArtifacts[0].decisionNdjson.trim().split(/\r?\n/).map(JSON.parse);
  const bundle = inputBundle(queues);
  const imported = buildHistoricalAttributionReviewDecisionImport({
    queueRecords: queues, submissions, policy: decisionPolicy, queuePolicy,
    queueSnapshotContentHash: bundle.snapshotHash, queueSnapshotCreatedAt: bundle.manifest.createdAt, contentHash: hash
  });
  assert.equal(imported.audit.submissionCoverage.blankSubmissionCount, 2);
  assert.equal(imported.audit.submissionCoverage.invalidSubmissionIndexes.length, 0);
  assert.equal(imported.audit.recordCoverage.recordedDecisionCount, 0);
  assert.equal(imported.audit.publishable, false);
});

test('identical inputs reproduce packets and all artifacts exactly', () => {
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3)];
  const first = build(queues); const second = build(structuredClone(queues));
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.batchArtifacts), hash(second.batchArtifacts));
  assert.equal(first.batchIndexTsv, second.batchIndexTsv);
  assert.equal(first.artifactManifestJson, second.artifactManifestJson);
  assert.equal(hash(first.audit), hash(second.audit));
});

test('fails closed on observation, manifest, order, policy, link, or account-state drift', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const bundle = inputBundle(queues);
  const changedObservation = structuredClone(queues);
  changedObservation[0].historicalRenderedObservations[0].observation.requestedTitle = 'Changed';
  changedObservation[0] = rehashQueue(changedObservation[0]);
  assert.equal(build(changedObservation).audit.publishable, false);
  const badManifest = structuredClone(bundle.manifest); badManifest.source.audit.semanticPreservationCoverage.optimizerPromotionCount = 1;
  assert.equal(buildHistoricalAttributionHumanReviewPackets({ queueRecords: queues, queueRaw: bundle.raw, queueManifest: badManifest, queueSnapshotContentHash: bundle.snapshotHash, policy, queuePolicy, decisionPolicy, contentHash: hash }).audit.publishable, false);
  assert.equal(build([queues[1], queues[0]]).audit.publishable, false);
  const accountScoped = structuredClone(queues); accountScoped[0].currentBaseLevel = 34;
  assert.equal(build(accountScoped).audit.publishable, false);
  const invalidLink = structuredClone(queues); invalidLink[0].historicalRenderedObservations[0].exactGuideRevisionUrl = 'https://example.com/revision/1'; invalidLink[0] = rehashQueue(invalidLink[0]);
  assert.equal(build(invalidLink).audit.publishable, false);
  const changedPolicy = structuredClone(policy); changedPolicy.inputQueuePolicyContentHash = hash('changed');
  assert.equal(build(queues, changedPolicy).audit.publishable, false);
});

test('independent audit rejects decisions, attribution, optimizer promotion, and changed artifacts', () => {
  const queues = [queueRecord(1), queueRecord(2)]; const bundle = inputBundle(queues); const result = build(queues);
  const promoted = structuredClone(result.records);
  promoted[0].decisionTemplate.disposition = policy.allowedDecisions[0];
  promoted[0].decisionRecorded = true;
  promoted[0].historicalAttributionApplied = true;
  promoted[0].historicalRenderedExpansionDependencyAttribution = { applied: true };
  promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(without(promoted[0], 'recordContentHash'));
  let audit = auditHistoricalAttributionHumanReviewPackets(promoted, {
    queueRecords: queues, queueRaw: bundle.raw, queueManifest: bundle.manifest, queueSnapshotContentHash: bundle.snapshotHash,
    policy, queuePolicy, decisionPolicy, batchArtifacts: result.batchArtifacts, batchIndexTsv: result.batchIndexTsv,
    artifactManifestJson: result.artifactManifestJson, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
  const changedArtifacts = structuredClone(result.batchArtifacts); changedArtifacts[0].markdown += 'altered\n';
  audit = auditHistoricalAttributionHumanReviewPackets(result.records, {
    queueRecords: queues, queueRaw: bundle.raw, queueManifest: bundle.manifest, queueSnapshotContentHash: bundle.snapshotHash,
    policy, queuePolicy, decisionPolicy, batchArtifacts: changedArtifacts, batchIndexTsv: result.batchIndexTsv,
    artifactManifestJson: result.artifactManifestJson, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.deepEqual(audit.batchCoverage.artifactMismatchBatches, [1]);
});

test('CLI writes the complete packet snapshot and every declared artifact', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-historical-attribution-review-packets-'));
  try {
    const directoryName = '2026-09-06T02-19-44-355Z'; const directory = path.join(root, directoryName); fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2), queueRecord(3)]; const bundle = inputBundle(queues);
    fs.writeFileSync(path.join(directory, `${inputDomain}.ndjson`), bundle.raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n');
    const command = spawnSync(process.execPath, ['platform/transforms/materialize-cross-skill-rendered-page-without-unlock-evidence-historical-attribution-human-review-packets.mjs', `--root=${root}`, `--queue-snapshot=${directoryName}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, true);
    assert.equal(output.coverage.packetCount, 3);
    assert.equal(output.coverage.historicalRenderedObservationCount, 6);
    const outputDirectory = path.join(root, output.outputSnapshot.directory);
    assert.equal(fs.existsSync(path.join(outputDirectory, `${outputDomain}.ndjson`)), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'batch-index.tsv')), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'artifact-manifest.json')), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'batches', 'batch-0001-review.md')), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'batches', 'batch-0001-decisions.ndjson')), true);
    const artifactManifest = JSON.parse(fs.readFileSync(path.join(outputDirectory, 'artifact-manifest.json'), 'utf8'));
    assert.equal(artifactManifest.packetCount, 3);
    assert.equal(artifactManifest.batchCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill historical attribution human review packet checks passed.');
