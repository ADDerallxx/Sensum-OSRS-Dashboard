import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import { buildUnlockCorpusAbsenceReconciliationReviewDecisionImport } from '../transforms/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-lib.mjs';
import {
  auditUnlockCorpusAbsenceReconciliationHumanReviewPackets,
  buildUnlockCorpusAbsenceReconciliationHumanReviewPackets,
  compileUnlockCorpusAbsenceReconciliationHumanReviewPacketPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packet-materialization-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packet-materialization-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-v1.json', 'utf8'));
const packetContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packet-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packet-materialization-audit-v1.json', 'utf8'));
const inputDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packets';
const createdAt = '2026-09-06T01:29:20.075Z';
const corpusEvidenceContentHash = hash('complete-corpus-evidence');
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function queueRecord(ordinal = 1) {
  const renderedTargetKey = `wiki-pageid:${10000 + ordinal}`;
  const sourceWorkQueueEntryKey = `${renderedTargetKey}|without-unlock-evidence-partition|source-bound-reconciliation-work`;
  const corpusEvidence = {
    capturedStatementCount: 4768,
    definition: queuePolicy.corpusDefinition,
    emptyParameterCount: 2111,
    equivalenceSnapshotContentHash: hash('equivalence-snapshot'),
    equivalenceStatementReferenceCount: 6375,
    equivalenceTargetReferenceCount: 3567,
    inventorySnapshotContentHash: hash('inventory-snapshot'),
    levelUpTableSourceSetContentHash: hash('level-up-table-source-set'),
    matchBasis: queuePolicy.matchBasis,
    officialSkillCount: 24,
    parameterCount: 3870,
    skillDomainRevision: '15321845',
    stableWikiPageIdCount: 3474,
    stableWikiPageIdSetContentHash: hash('stable-wiki-page-id-set'),
    statementTargetRelationCount: 6375,
    statementTargetRelationSetContentHash: hash('statement-target-relation-set')
  };
  const base = {
    absenceWorkEntryKey: `${sourceWorkQueueEntryKey}|unlock-corpus-absence-reconciliation-work`,
    accountIndependent: true,
    automaticVerificationApplied: false,
    blockers: ['level_unlock_corpus_absence_reconciliation_review_pending'],
    canonicalActivityIdentity: null,
    canonicalGameEntityIdentity: null,
    contract: policy.queueContract,
    corpusEvidence,
    corpusEvidenceContentHash,
    findingScope: { machineFinding: queuePolicy.machineFinding, nonClaims: [...queuePolicy.nonClaims], statement: 'The target stable page ID is absent from the exact pinned corpus.' },
    matchEvidence: {
      corpusStableWikiPageIdCount: corpusEvidence.stableWikiPageIdCount,
      exactStablePageIdMatchCount: 0,
      machineObservedZeroMatch: true,
      matchBasis: queuePolicy.matchBasis,
      matchingCanonicalWikiPageKeys: [],
      targetSourcePageId: 10000 + ordinal,
      titleAliasFragmentNamespaceOrSemanticMatchingUsed: false
    },
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    queueOrdinal: ordinal,
    renderedTargetKey,
    repeatabilityClassification: null,
    reviewDecision: null,
    reviewEvidenceKeys: [],
    reviewNotes: null,
    reviewedAt: null,
    reviewer: null,
    semanticDisposition: null,
    sourceCrosswalkRecordContentHash: hash(`crosswalk-record:${ordinal}`),
    sourceCrosswalkSnapshotContentHash: hash('crosswalk-snapshot'),
    sourceWorkQueueEntryKey,
    sourceWorkQueueIntrinsicRecordContentHash: hash(`source-work-intrinsic:${ordinal}`),
    sourceWorkQueueRecordContentHash: hash(`source-work-record:${ordinal}`),
    sourceWorkQueueSnapshotContentHash: hash('source-work-snapshot'),
    stableWikiPageIdentity: {
      redirected: false,
      resolvedTitle: `Target ${ordinal}`,
      sourcePageId: 10000 + ordinal,
      sourceRevision: String(15300000 + ordinal),
      sourceTimestamp: '2026-09-05T10:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`
    },
    state: policy.queueState,
    unlockEvidencePresent: false
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function inputBundle(queues) {
  const raw = queues.map(json).join('\n') + '\n';
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1',
    domain: inputDomain,
    createdAt,
    records: queues.length,
    contentHash: hash(raw),
    source: {
      policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash },
      corpusEvidenceContentHash,
      audit: {
        corpusBindingCoverage: { corpusEvidenceContentHash, exactInventoryToEquivalenceStatementTargetRelationSet: true },
        absenceCoverage: { outputRecordCount: queues.length, zeroExactStablePageIdMatchCount: queues.length, duplicateOutputKeys: [], missingOutputKeys: [], unexpectedOutputKeys: [], recordMismatchKeys: [], nonZeroMatchSourceWorkQueueKeys: [], nonZeroMatchOutputKeys: [], orderMatchesSourceQueue: true },
        reviewCoverage: { blankDecisionTemplateCount: queues.length, reviewStartedCount: 0, completedReconciliationCount: 0 },
        semanticPreservationCoverage: { noRequirementClaimCount: 0, semanticDispositionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, mechanicsReviewCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, unsupportedPromotionKeys: [] },
        queueExportComplete: true,
        absenceReconciliationComplete: false,
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
  return buildUnlockCorpusAbsenceReconciliationHumanReviewPackets({
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
  const compiled = compileUnlockCorpusAbsenceReconciliationHumanReviewPacketPolicy(policy, queuePolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'confirm' };
  assert.equal(compileUnlockCorpusAbsenceReconciliationHumanReviewPacketPolicy(specific, queuePolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnlockCorpusAbsenceReconciliationHumanReviewPacketPolicy(automatic, queuePolicy, decisionPolicy, hash).valid, false);
  const changedImporter = structuredClone(decisionPolicy); changedImporter.allowedDecisions = [...changedImporter.allowedDecisions].reverse();
  assert.equal(compileUnlockCorpusAbsenceReconciliationHumanReviewPacketPolicy(policy, queuePolicy, changedImporter, hash).valid, false);
});

test('materializes one exact evidence-keyed packet per queue record without requirement or optimizer promotion', () => {
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3)];
  const result = build(queues);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.packetMaterializationComplete, true);
  assert.equal(result.audit.absenceReconciliationComplete, false);
  assert.equal(result.records.length, 3);
  assert.equal(result.audit.evidenceCoverage.zeroExactStablePageIdMatchCount, 3);
  assert.equal(result.audit.evidenceCoverage.corpusEvidenceBoundCount, 3);
  const packet = result.records[0];
  assert.equal(packet.sourceExactRevisionUrl, 'https://oldschool.runescape.wiki/w/Special:Redirect/revision/15300001');
  assert.equal(packet.decisionTemplate.disposition, null);
  assert.equal(packet.decisionRecorded, false);
  assert.equal(packet.corpusAbsenceReconciliationApplied, false);
  assert.equal(packet.noRequirementClaimApplied, false);
  assert.equal(packet.optimizerEligible, false);
  assert.deepEqual(packet.evidenceRequirements.everyDecisionMustCite.slice(1, 3), [queues[0].contentHash, queues[0].recordContentHash]);
  for (const field of packetContract.required) assert.ok(Object.hasOwn(packet, field), `Missing packet field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('creates contiguous bounded batches with importer-compatible blank decision files', () => {
  const smallBatches = structuredClone(policy); smallBatches.batchSize = 2;
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3), queueRecord(4), queueRecord(5)];
  const result = build(queues, smallBatches);
  assert.equal(result.audit.publishable, true);
  assert.deepEqual(result.batchArtifacts.map(row => row.packetCount), [2, 2, 1]);
  assert.deepEqual(result.batchArtifacts.map(row => [row.firstPacketOrdinal, row.lastPacketOrdinal]), [[1, 2], [3, 4], [5, 5]]);
  assert.equal(result.audit.batchCoverage.partitionExact, true);
  assert.match(result.batchArtifacts[0].markdown, /Explicit non-claims/);
  assert.match(result.batchArtifacts[0].markdown, /Required evidence citations/);
  const submissions = result.batchArtifacts[0].decisionNdjson.trim().split(/\r?\n/).map(JSON.parse);
  const bundle = inputBundle(queues);
  const imported = buildUnlockCorpusAbsenceReconciliationReviewDecisionImport({
    queueRecords: queues, submissions, policy: decisionPolicy, queuePolicy, queueSnapshotContentHash: bundle.snapshotHash,
    queueSnapshotCreatedAt: bundle.manifest.createdAt, queueManifestCorpusEvidenceContentHash: corpusEvidenceContentHash, contentHash: hash
  });
  assert.equal(imported.audit.submissionCoverage.blankSubmissionCount, 2);
  assert.equal(imported.audit.submissionCoverage.invalidSubmissionIndexes.length, 0);
  assert.equal(imported.audit.recordCoverage.recordedDecisionCount, 0);
  assert.equal(imported.audit.publishable, false);
});

test('identical inputs reproduce packets, markdown, decisions, index, and manifest exactly', () => {
  const queues = [queueRecord(1), queueRecord(2), queueRecord(3)];
  const first = build(queues); const second = build(structuredClone(queues));
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.batchArtifacts), hash(second.batchArtifacts));
  assert.equal(first.batchIndexTsv, second.batchIndexTsv);
  assert.equal(first.artifactManifestJson, second.artifactManifestJson);
  assert.equal(hash(first.audit), hash(second.audit));
});

test('fails closed on queue, corpus, manifest, order, policy, source-link, or account-state drift', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const bundle = inputBundle(queues);
  const corpusMismatch = structuredClone(queues); corpusMismatch[0].matchEvidence.corpusStableWikiPageIdCount += 1; corpusMismatch[0] = rehashQueue(corpusMismatch[0]);
  assert.equal(build(corpusMismatch).audit.publishable, false);
  const badManifest = structuredClone(bundle.manifest); badManifest.source.audit.semanticPreservationCoverage.optimizerEligibleCount = 1;
  assert.equal(buildUnlockCorpusAbsenceReconciliationHumanReviewPackets({ queueRecords: queues, queueRaw: bundle.raw, queueManifest: badManifest, queueSnapshotContentHash: bundle.snapshotHash, policy, queuePolicy, decisionPolicy, contentHash: hash }).audit.publishable, false);
  assert.equal(build([queues[1], queues[0]]).audit.publishable, false);
  const accountScoped = structuredClone(queues); accountScoped[0].currentBaseLevel = 34;
  assert.equal(build(accountScoped).audit.publishable, false);
  const nonWiki = structuredClone(queues); nonWiki[0].stableWikiPageIdentity.sourceUrl = 'https://example.com/wiki/Target_1'; nonWiki[0] = rehashQueue(nonWiki[0]);
  const nonWikiResult = build(nonWiki);
  assert.equal(nonWikiResult.audit.publishable, false);
  assert.ok(nonWikiResult.audit.blockers.includes('one_or_more_target_exact_revision_links_invalid') || nonWikiResult.audit.blockers.includes('one_or_more_queue_records_or_blank_templates_failed_guarded_importer_revalidation'));
  const changedPolicy = structuredClone(policy); changedPolicy.inputQueuePolicyContentHash = hash('changed');
  assert.equal(build(queues, changedPolicy).audit.publishable, false);
});

test('independent audit rejects decided templates, requirement promotion, optimizer promotion, or altered artifacts', () => {
  const queues = [queueRecord(1), queueRecord(2)]; const bundle = inputBundle(queues); const result = build(queues);
  const promoted = structuredClone(result.records);
  promoted[0].decisionTemplate.disposition = policy.allowedDispositions[0];
  promoted[0].decisionRecorded = true;
  promoted[0].corpusAbsenceReconciliationApplied = true;
  promoted[0].levelUnlockCorpusAbsenceReconciliation = { disposition: policy.allowedDispositions[0] };
  promoted[0].noRequirementClaimApplied = true;
  promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(without(promoted[0], 'recordContentHash'));
  let audit = auditUnlockCorpusAbsenceReconciliationHumanReviewPackets(promoted, {
    queueRecords: queues, queueRaw: bundle.raw, queueManifest: bundle.manifest, queueSnapshotContentHash: bundle.snapshotHash,
    policy, queuePolicy, decisionPolicy, batchArtifacts: result.batchArtifacts, batchIndexTsv: result.batchIndexTsv,
    artifactManifestJson: result.artifactManifestJson, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
  const changedArtifacts = structuredClone(result.batchArtifacts); changedArtifacts[0].markdown += 'altered\n';
  audit = auditUnlockCorpusAbsenceReconciliationHumanReviewPackets(result.records, {
    queueRecords: queues, queueRaw: bundle.raw, queueManifest: bundle.manifest, queueSnapshotContentHash: bundle.snapshotHash,
    policy, queuePolicy, decisionPolicy, batchArtifacts: changedArtifacts, batchIndexTsv: result.batchIndexTsv,
    artifactManifestJson: result.artifactManifestJson, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.deepEqual(audit.batchCoverage.artifactMismatchBatches, [1]);
});

test('CLI writes the complete packet snapshot and every declared review artifact', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-unlock-corpus-absence-review-packets-'));
  try {
    const directoryName = '2026-09-06T01-29-20-075Z'; const directory = path.join(root, directoryName); fs.mkdirSync(directory, { recursive: true });
    const queues = [queueRecord(1), queueRecord(2), queueRecord(3)]; const bundle = inputBundle(queues);
    fs.writeFileSync(path.join(directory, `${inputDomain}.ndjson`), bundle.raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n');
    const command = spawnSync(process.execPath, ['platform/transforms/materialize-cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packets.mjs', `--root=${root}`, `--queue-snapshot=${directoryName}`], { cwd: process.cwd(), encoding: 'utf8' });
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
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill unlock-corpus absence reconciliation human review packet checks passed.');
