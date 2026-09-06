import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport } from '../transforms/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-lib.mjs';
import {
  auditRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets,
  buildRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets,
  compileRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPacketPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet-materialization-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet-materialization-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-v1.json', 'utf8'));
const packetContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet-materialization-audit-v1.json', 'utf8'));
const inputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packets';
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function observation(ordinal, index) {
  return {
    guideContentHash: hash(`guide:${ordinal}:${index}`), guidePageId: 1000 + ordinal * 10 + index,
    guideRevision: String(15000000 + ordinal * 10 + index), guideTitle: `Guide ${ordinal}-${index}`,
    namespaceId: 0, parserChannel: 'links', parserMetadata: { section: `Section ${index}` },
    parserObservedAt: `2026-09-04T11:0${index}:00.000Z`, parserReportedExists: true,
    requestedTitle: `Target ${ordinal}`, resolutionState: 'current_revision_pinned_page',
    sourcePresence: ordinal % 2 ? 'direct_source_stable_page_id' : 'rendered_only_origin_unattributed'
  };
}

function queueRecord(ordinal = 1, namespaceId = 0, observationCount = 2) {
  const sourceSignatureKey = `wiki-pageid:${2000 + ordinal}|target-source-signature`;
  const sourcePageIdentity = {
    sourcePageId: 2000 + ordinal, sourceNamespaceId: namespaceId, resolvedTitle: `Target ${ordinal}`,
    sourceRevision: String(15100000 + ordinal), sourceTimestamp: '2026-09-04T10:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`, sourceContentHash: hash(`source:${ordinal}`),
    sourceContentBytes: 1000 + ordinal, sourceLineCount: 20 + ordinal
  };
  const observations = Array.from({ length: observationCount }, (_, index) => observation(ordinal, index + 1));
  const targetPageIdentity = {
    redirected: false, resolvedTitle: sourcePageIdentity.resolvedTitle, sourcePageId: sourcePageIdentity.sourcePageId,
    sourceRevision: sourcePageIdentity.sourceRevision, sourceTimestamp: sourcePageIdentity.sourceTimestamp, sourceUrl: sourcePageIdentity.sourceUrl
  };
  const provenancePartition = ordinal % 2 ? 'direct_source_only' : 'rendered_only_origin_unattributed';
  const provenanceRank = queuePolicy.priorityByProvenancePartition[provenancePartition];
  const namespaceRank = namespaceId === 0 ? 0 : 1;
  const base = {
    contract: policy.queueContract, reviewQueueOrdinal: ordinal, sourceQueueOrdinal: ordinal,
    workQueueEntryKey: `${sourceSignatureKey}|source-scoped-semantic-relevance-review`, sourceSignatureKey,
    sourceSignatureRecordContentHash: hash(`signature-record:${ordinal}`), sourceSignatureSnapshotContentHash: hash('signature-snapshot'),
    sourceWorkQueueRecordContentHash: hash(`work-record:${ordinal}`), sourceWorkQueueSnapshotContentHash: hash('work-snapshot'),
    sourceCandidateRecordContentHash: hash(`candidate-record:${ordinal}`), sourceCandidateSnapshotContentHash: hash('candidate-snapshot'),
    sourcePageIdentity, provenancePartition, requestedTitles: [sourcePageIdentity.resolvedTitle],
    retainedGuideContexts: { requestedTitles: [sourcePageIdentity.resolvedTitle], namespaceIds: [namespaceId], guideObservationCount: observations.length, observations, sourcePresenceCounts: {}, targetPageIdentity },
    structuralEvidence: {
      rootTemplates: [{ template: 'Example', line: 1 }], directCategories: [{ category: 'Examples', line: 20 }],
      leadParagraphs: [{ ordinal: 1, rawText: 'Exact source evidence.', sourceLocator: { lineStart: 2, lineEnd: 2 } }],
      headings: [{ ordinal: 1, level: 2, rawTitle: 'Uses', normalizedTitle: 'Uses', line: 5 }]
    },
    evidenceFingerprint: null,
    reviewPriority: { band: provenanceRank + namespaceRank * 3, provenanceRank, namespaceRank },
    reviewRoute: namespaceId === 0 ? queuePolicy.reviewRoutes.mainNamespace : queuePolicy.reviewRoutes.nonMainNamespace,
    allowedDispositions: [...policy.allowedDispositions],
    reviewQuestion: 'Does this exact revision-pinned source have a material semantic relationship to one or more retained training-guide observations?',
    semanticDisposition: null, reviewer: null, reviewedAt: null, reviewNotes: null, reviewEvidenceKeys: [],
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    mechanicsReviewComplete: false, optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['source_scoped_semantic_relevance_review_pending'], state: policy.queueState
  };
  base.evidenceFingerprint = hash({
    sourceSignatureSnapshotContentHash: base.sourceSignatureSnapshotContentHash, sourceSignatureRecordContentHash: base.sourceSignatureRecordContentHash,
    sourceWorkQueueSnapshotContentHash: base.sourceWorkQueueSnapshotContentHash, sourceWorkQueueRecordContentHash: base.sourceWorkQueueRecordContentHash,
    sourceCandidateSnapshotContentHash: base.sourceCandidateSnapshotContentHash, sourceCandidateRecordContentHash: base.sourceCandidateRecordContentHash,
    sourcePageIdentity: base.sourcePageIdentity, requestedTitles: base.requestedTitles, retainedGuideContexts: base.retainedGuideContexts, structuralEvidence: base.structuralEvidence
  });
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function inputBundle(queues) {
  const raw = queues.map(json).join('\n') + '\n';
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: inputDomain, records: queues.length, contentHash: hash(raw),
    source: { policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash }, audit: {
      queueExportComplete: true, semanticRelevanceReviewComplete: false, reconciliationComplete: false, completeActivityUniverse: false, publishable: true,
      queueCoverage: { reviewQueueEntryCount: queues.length, blankDecisionTemplateCount: queues.length, duplicateOutputKeys: [], missingOutputKeys: [], unexpectedOutputKeys: [], mismatchKeys: [], priorityOrderMatches: true },
      semanticPreservationCoverage: { semanticDispositionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, mechanicsReviewCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, decidedTemplateCount: 0 }
    } }
  };
  return { raw, manifest, snapshotHash: manifest.contentHash };
}

function rehashQueue(queue) {
  const copy = without(queue, 'contentHash', 'recordContentHash');
  copy.evidenceFingerprint = hash({
    sourceSignatureSnapshotContentHash: copy.sourceSignatureSnapshotContentHash, sourceSignatureRecordContentHash: copy.sourceSignatureRecordContentHash,
    sourceWorkQueueSnapshotContentHash: copy.sourceWorkQueueSnapshotContentHash, sourceWorkQueueRecordContentHash: copy.sourceWorkQueueRecordContentHash,
    sourceCandidateSnapshotContentHash: copy.sourceCandidateSnapshotContentHash, sourceCandidateRecordContentHash: copy.sourceCandidateRecordContentHash,
    sourcePageIdentity: copy.sourcePageIdentity, requestedTitles: copy.requestedTitles, retainedGuideContexts: copy.retainedGuideContexts, structuralEvidence: copy.structuralEvidence
  });
  const intrinsic = { ...copy, recordContentHash: hash(copy) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function build(queues, changedPolicy = policy, overrides = {}) {
  const bundle = inputBundle(queues);
  return buildRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets({ queueRecords: queues, queueRaw: bundle.raw, queueManifest: bundle.manifest, queueSnapshotContentHash: bundle.snapshotHash, policy: changedPolicy, queuePolicy, decisionPolicy, contentHash: hash, ...overrides });
}

test('policy is generic, revision-bound, importer-bound, and cannot automatically verify', () => {
  const compiled = compileRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPacketPolicy(policy, queuePolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'relevant' };
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPacketPolicy(specific, queuePolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPacketPolicy(automatic, queuePolicy, decisionPolicy, hash).valid, false);
  const changedImporter = structuredClone(decisionPolicy); changedImporter.allowedDecisions = [...changedImporter.allowedDecisions].reverse();
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPacketPolicy(policy, queuePolicy, changedImporter, hash).valid, false);
});

test('materializes one exact evidence-keyed packet per queue record without semantic promotion', () => {
  const queues = [queueRecord(1), queueRecord(2, 6, 3), queueRecord(3)];
  const result = build(queues);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.packetMaterializationComplete, true);
  assert.equal(result.audit.semanticRelevanceReviewComplete, false);
  assert.equal(result.records.length, 3);
  assert.equal(result.audit.evidenceCoverage.retainedGuideObservationCount, 7);
  assert.equal(result.audit.evidenceCoverage.packetGuideEvidenceCount, 7);
  const packet = result.records[0];
  assert.equal(packet.sourceExactRevisionUrl, 'https://oldschool.runescape.wiki/w/Special:Redirect/revision/15100001');
  assert.equal(packet.guideEvidence[0].exactRevisionUrl, 'https://oldschool.runescape.wiki/w/Special:Redirect/revision/15000011');
  assert.equal(packet.guideEvidence[0].evidenceKey, hash(queues[0].retainedGuideContexts.observations[0]));
  assert.deepEqual(packet.structuralEvidenceCatalog.rootTemplates[0].evidence, queues[0].structuralEvidence.rootTemplates[0]);
  assert.equal(packet.decisionTemplate.decision, null);
  assert.equal(packet.decisionRecorded, false);
  assert.equal(packet.semanticDispositionApplied, false);
  assert.equal(packet.optimizerEligible, false);
  for (const field of packetContract.required) assert.ok(Object.hasOwn(packet, field), `Missing packet field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('creates contiguous bounded batches and importer-compatible blank decision files', () => {
  const smallBatches = structuredClone(policy); smallBatches.batchSize = 2;
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3), queueRecord(4), queueRecord(5)];
  const result = build(queues, smallBatches);
  assert.equal(result.audit.publishable, true);
  assert.deepEqual(result.batchArtifacts.map(row => row.packetCount), [2, 2, 1]);
  assert.deepEqual(result.batchArtifacts.map(row => [row.firstPacketOrdinal, row.lastPacketOrdinal]), [[1, 2], [3, 4], [5, 5]]);
  assert.equal(result.audit.batchCoverage.partitionExact, true);
  assert.match(result.batchArtifacts[0].markdown, /Exact source:/);
  assert.match(result.batchArtifacts[0].markdown, /Required evidence citations/);
  const submissions = result.batchArtifacts[0].decisionNdjson.trim().split(/\r?\n/).map(JSON.parse);
  const bundle = inputBundle(queues);
  const imported = buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport({ queueRecords: queues, submissions, policy: decisionPolicy, queuePolicy, queueSnapshotContentHash: bundle.snapshotHash, contentHash: hash });
  assert.equal(imported.audit.submissionCoverage.blankSubmissionCount, 2);
  assert.equal(imported.audit.submissionCoverage.invalidSubmissionCount, 0);
  assert.equal(imported.audit.recordCoverage.recordedDecisionCount, 0);
  assert.equal(imported.audit.publishable, false);
});

test('identical inputs reproduce packets, markdown, decisions, index, and manifest exactly', () => {
  const queues = [queueRecord(1), queueRecord(2, 6, 3), queueRecord(3)];
  const first = build(queues); const second = build(structuredClone(queues));
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.batchArtifacts), hash(second.batchArtifacts));
  assert.equal(first.batchIndexTsv, second.batchIndexTsv);
  assert.equal(first.artifactManifestJson, second.artifactManifestJson);
  assert.equal(hash(first.audit), hash(second.audit));
});

test('fails closed on queue, manifest, ordering, policy, or account-state drift', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const bundle = inputBundle(queues);
  const tampered = structuredClone(queues); tampered[0].retainedGuideContexts.observations[0].guideTitle = 'Changed';
  assert.equal(build(tampered).audit.publishable, false);
  const badManifest = structuredClone(bundle.manifest); badManifest.source.audit.semanticPreservationCoverage.optimizerEligibleCount = 1;
  assert.equal(buildRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets({ queueRecords: queues, queueRaw: bundle.raw, queueManifest: badManifest, queueSnapshotContentHash: bundle.snapshotHash, policy, queuePolicy, decisionPolicy, contentHash: hash }).audit.publishable, false);
  assert.equal(build([queues[1], queues[0]]).audit.publishable, false);
  const accountScoped = structuredClone(queues); accountScoped[0].currentBaseLevel = 34;
  assert.equal(build(accountScoped).audit.publishable, false);
  const nonWiki = structuredClone(queues); nonWiki[0].sourcePageIdentity.sourceUrl = 'https://example.com/wiki/Target_1';
  nonWiki[0].retainedGuideContexts.targetPageIdentity.sourceUrl = nonWiki[0].sourcePageIdentity.sourceUrl;
  nonWiki[0] = rehashQueue(nonWiki[0]);
  const nonWikiResult = build(nonWiki);
  assert.equal(nonWikiResult.audit.publishable, false);
  assert.ok(nonWikiResult.audit.blockers.includes('one_or_more_source_or_guide_exact_revision_links_invalid'));
  const changedPolicy = structuredClone(policy); changedPolicy.inputQueuePolicyContentHash = hash('changed');
  assert.equal(build(queues, changedPolicy).audit.publishable, false);
});

test('independent audit rejects decided templates, optimizer promotion, or altered artifacts', () => {
  const queues = [queueRecord(1), queueRecord(2)]; const bundle = inputBundle(queues); const result = build(queues);
  const promoted = structuredClone(result.records); promoted[0].decisionTemplate.decision = policy.allowedDispositions[0]; promoted[0].decisionRecorded = true; promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(without(promoted[0], 'recordContentHash'));
  let audit = auditRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets(promoted, { queueRecords: queues, queueRaw: bundle.raw, queueManifest: bundle.manifest, queueSnapshotContentHash: bundle.snapshotHash, policy, queuePolicy, decisionPolicy, batchArtifacts: result.batchArtifacts, batchIndexTsv: result.batchIndexTsv, artifactManifestJson: result.artifactManifestJson, contentHash: hash });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
  const changedArtifacts = structuredClone(result.batchArtifacts); changedArtifacts[0].markdown += 'altered\n';
  audit = auditRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets(result.records, { queueRecords: queues, queueRaw: bundle.raw, queueManifest: bundle.manifest, queueSnapshotContentHash: bundle.snapshotHash, policy, queuePolicy, decisionPolicy, batchArtifacts: changedArtifacts, batchIndexTsv: result.batchIndexTsv, artifactManifestJson: result.artifactManifestJson, contentHash: hash });
  assert.equal(audit.publishable, false);
  assert.deepEqual(audit.batchCoverage.artifactMismatchBatches, [1]);
});

test('CLI writes the complete packet snapshot and every declared review artifact', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-semantic-review-packets-'));
  try {
    const directoryName = '2026-09-06T04-00-00-000Z'; const directory = path.join(root, directoryName); fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2, 6, 3), queueRecord(3)]; const bundle = inputBundle(queues);
    fs.writeFileSync(path.join(directory, `${inputDomain}.ndjson`), bundle.raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n');
    const command = spawnSync(process.execPath, ['platform/transforms/materialize-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packets.mjs', `--root=${root}`, `--queue-snapshot=${directoryName}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, true);
    assert.equal(output.coverage.packetCount, 3);
    const outputDirectory = path.join(root, output.outputSnapshot.directory);
    assert.equal(fs.existsSync(path.join(outputDirectory, `${outputDomain}.ndjson`)), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'batch-index.tsv')), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'artifact-manifest.json')), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'batches', 'batch-0001-review.md')), true);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'batches', 'batch-0001-decisions.ndjson')), true);
    const artifactManifest = JSON.parse(fs.readFileSync(path.join(outputDirectory, 'artifact-manifest.json'), 'utf8'));
    assert.equal(artifactManifest.packetCount, 3);
    assert.equal(artifactManifest.batchCount, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill source-scoped semantic-relevance human review packet materialization checks passed.');
