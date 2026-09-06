import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  buildUnlockCorpusAbsenceReconciliationReviewDecisionImport,
  expectedUnlockCorpusAbsenceBlankDecision
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-lib.mjs';
import {
  auditUnlockCorpusAbsenceReconciliationApplications,
  buildUnlockCorpusAbsenceReconciliationApplications,
  compileUnlockCorpusAbsenceReconciliationApplicationPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-record-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-audit-v1.json', 'utf8'));
const queueDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue';
const decisionDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decisions';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-applications';
const queueCreatedAt = '2026-09-06T01:29:20.075Z';
const decisionCreatedAt = '2026-09-07T14:00:00.000Z';
const corpusEvidenceContentHash = hash('complete-corpus-evidence');
const snapshotHashes = {
  workQueue: hash('source-work-queue-snapshot'),
  crosswalk: hash('crosswalk-snapshot'),
  inventory: hash('inventory-snapshot'),
  equivalence: hash('equivalence-snapshot')
};
const json = value => JSON.stringify(value);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function queueRecord(ordinal = 1) {
  const renderedTargetKey = `wiki-pageid:${10000 + ordinal}`;
  const sourceWorkQueueEntryKey = `${renderedTargetKey}|without-unlock-evidence-partition|source-bound-reconciliation-work`;
  const corpusEvidence = {
    capturedStatementCount: 4768,
    definition: queuePolicy.corpusDefinition,
    emptyParameterCount: 2111,
    equivalenceSnapshotContentHash: snapshotHashes.equivalence,
    equivalenceStatementReferenceCount: 6375,
    equivalenceTargetReferenceCount: 3567,
    inventorySnapshotContentHash: snapshotHashes.inventory,
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
    findingScope: {
      machineFinding: queuePolicy.machineFinding,
      nonClaims: [...queuePolicy.nonClaims],
      statement: 'The stable page ID is absent from this exact pinned corpus.'
    },
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
    sourceCrosswalkSnapshotContentHash: snapshotHashes.crosswalk,
    sourceWorkQueueEntryKey,
    sourceWorkQueueIntrinsicRecordContentHash: hash(`source-work-queue-intrinsic:${ordinal}`),
    sourceWorkQueueRecordContentHash: hash(`source-work-queue-record:${ordinal}`),
    sourceWorkQueueSnapshotContentHash: snapshotHashes.workQueue,
    stableWikiPageIdentity: {
      redirected: false,
      resolvedTitle: `Target ${ordinal}`,
      sourcePageId: 10000 + ordinal,
      sourceRevision: String(15300000 + ordinal),
      sourceTimestamp: '2026-09-05T10:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`
    },
    state: policy.requiredQueueState,
    unlockEvidencePresent: false
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function queueBundle(records) {
  const raw = records.map(json).join('\n') + '\n';
  const empty = [];
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1',
    domain: queueDomain,
    createdAt: queueCreatedAt,
    records: records.length,
    contentHash: hash(raw),
    source: {
      policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash },
      inputSnapshots: Object.fromEntries(Object.entries(snapshotHashes).map(([key, contentHash]) => [key, { directory: `${key}-snapshot`, contentHash }])),
      corpusEvidenceContentHash,
      audit: {
        inputCoverage: {
          sourceWorkQueueRecordCount: records.length,
          crosswalkRecordCount: records.length + 2,
          stableNoMatchCrosswalkRecordCount: records.length,
          inventorySkillRecordCount: 24,
          equivalenceRecordCount: 3474
        },
        snapshotCoverage: {
          snapshotContentHashValid: { workQueue: true, crosswalk: true, inventory: true, equivalence: true },
          sourceAuditGatesValid: { workQueue: true, crosswalk: true, inventory: true, equivalence: true }
        },
        corpusBindingCoverage: {
          duplicateInventoryRelationKeys: empty,
          duplicateEquivalenceRelationKeys: empty,
          missingEquivalenceRelations: empty,
          unexpectedEquivalenceRelations: empty,
          invalidStatementReferenceKeys: empty,
          equivalenceSkillReferenceMismatchKeys: empty,
          exactInventoryToEquivalenceStatementTargetRelationSet: true,
          corpusEvidenceContentHash
        },
        absenceCoverage: {
          outputRecordCount: records.length,
          duplicateOutputKeys: empty,
          missingOutputKeys: empty,
          unexpectedOutputKeys: empty,
          recordMismatchKeys: empty,
          nonZeroMatchSourceWorkQueueKeys: empty,
          nonZeroMatchOutputKeys: empty,
          zeroExactStablePageIdMatchCount: records.length,
          orderMatchesSourceQueue: true
        },
        reviewCoverage: { blankDecisionTemplateCount: records.length, reviewStartedCount: 0, completedReconciliationCount: 0 },
        semanticPreservationCoverage: {
          noRequirementClaimCount: 0,
          semanticDispositionCount: 0,
          canonicalGameEntityIdentityCount: 0,
          canonicalActivityIdentityCount: 0,
          repeatabilityClassifiedCount: 0,
          mechanicsReviewCompleteCount: 0,
          optimizerEligibleCount: 0,
          automaticVerificationCount: 0,
          unsupportedPromotionKeys: empty
        },
        accountStateFindings: empty,
        queueExportComplete: true,
        absenceReconciliationComplete: false,
        completeActivityUniverse: false,
        publishable: true
      }
    }
  };
  return { raw, manifest, snapshot: { directory: 'queue-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function submission(queue, decision) {
  const evidenceKeys = [
    queue.contentHash,
    queue.recordContentHash,
    queue.sourceWorkQueueRecordContentHash,
    queue.sourceCrosswalkRecordContentHash,
    queue.corpusEvidenceContentHash
  ];
  if (decision !== policy.confirmDecision) {
    evidenceKeys.push(queue.corpusEvidence.stableWikiPageIdSetContentHash, queue.corpusEvidence.statementTargetRelationSetContentHash);
  }
  return {
    ...expectedUnlockCorpusAbsenceBlankDecision(queue, decisionPolicy),
    disposition: decision,
    reviewer: 'Human Reviewer',
    reviewedAt: '2026-09-07T13:00:00.000Z',
    evidenceKeys,
    notes: 'Reviewed the exact pinned target, crosswalk, queue record, and complete corpus evidence.'
  };
}

function decisionBundle(queues, queue, decisions) {
  const submissions = decisions.map((decision, index) => submission(queues[index], decision));
  for (const row of submissions) row.evidenceKeys.push(queue.snapshot.contentHash);
  const imported = buildUnlockCorpusAbsenceReconciliationReviewDecisionImport({
    queueRecords: queues,
    submissions,
    policy: decisionPolicy,
    queuePolicy,
    queueSnapshotContentHash: queue.snapshot.contentHash,
    queueSnapshotCreatedAt: queue.snapshot.createdAt,
    queueManifestCorpusEvidenceContentHash: corpusEvidenceContentHash,
    contentHash: hash
  });
  assert.equal(imported.audit.publishable, true);
  const records = imported.records.map(record => ({ ...record, contentHash: hash(record) }));
  const raw = records.map(json).join('\n') + '\n';
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1',
    domain: decisionDomain,
    createdAt: decisionCreatedAt,
    records: records.length,
    contentHash: hash(raw),
    source: {
      policy: { id: policy.inputDecisionImportPolicy, contentHash: policy.inputDecisionImportPolicyContentHash },
      inputQueuePolicy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash },
      inputSnapshot: {
        directory: queue.snapshot.directory,
        contentHash: queue.snapshot.contentHash,
        createdAt: queue.snapshot.createdAt,
        corpusEvidenceContentHash,
        rejections: []
      },
      audit: imported.audit
    }
  };
  return { records, raw, manifest, snapshot: { directory: 'decision-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function fixture(decisions) {
  const queues = decisions.map((_, index) => queueRecord(index + 1));
  const queue = queueBundle(queues);
  return { queues, queue, decisions: decisionBundle(queues, queue, decisions) };
}

function build(bundle, overrides = {}) {
  return buildUnlockCorpusAbsenceReconciliationApplications({
    queueRecords: bundle.queues,
    queueRaw: bundle.queue.raw,
    queueManifest: bundle.queue.manifest,
    queueSnapshot: bundle.queue.snapshot,
    decisionRecords: bundle.decisions.records,
    decisionRaw: bundle.decisions.raw,
    decisionManifest: bundle.decisions.manifest,
    decisionSnapshot: bundle.decisions.snapshot,
    policy, queuePolicy, decisionPolicy, contentHash: hash,
    ...overrides
  });
}

test('absence application policy is generic, decision-bound, and cannot automatically verify', () => {
  const compiled = compileUnlockCorpusAbsenceReconciliationApplicationPolicy(policy, queuePolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'confirm' };
  assert.equal(compileUnlockCorpusAbsenceReconciliationApplicationPolicy(specific, queuePolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnlockCorpusAbsenceReconciliationApplicationPolicy(automatic, queuePolicy, decisionPolicy, hash).valid, false);
});

test('confirmed corpus absence resolves only the exact corpus finding and never claims no requirement', () => {
  const bundle = fixture([policy.confirmDecision]);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.unlockCorpusAbsenceReviewComplete, true);
  assert.equal(result.audit.applicationCoverage.confirmedAppliedCount, 1);
  assert.equal(result.records[0].corpusAbsenceFindingConfirmed, true);
  assert.equal(result.records[0].corpusAbsenceFindingResolved, true);
  assert.equal(result.records[0].noRequirementClaimApplied, false);
  assert.equal(result.records[0].requirementOrUnlockApplied, false);
  assert.equal(result.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing application field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('rejected and additional-evidence decisions apply only as unresolved blockers', () => {
  const bundle = fixture([policy.rejectDecision, policy.additionalEvidenceDecision]);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.unlockCorpusAbsenceReviewComplete, false);
  assert.equal(result.audit.applicationCoverage.rejectedAppliedCount, 1);
  assert.equal(result.audit.applicationCoverage.additionalEvidenceAppliedCount, 1);
  assert.ok(result.records.every(row => row.corpusAbsenceFindingResolved === false && row.noRequirementClaimApplied === false));
  assert.ok(result.records[0].blockers.includes('level_unlock_corpus_absence_finding_rejected_pending_corpus_reaudit'));
  assert.ok(result.records[1].blockers.includes('additional_level_requirement_source_reconciliation_required'));
});

test('an exact partial absence decision set is publishable but cannot complete review', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const queue = queueBundle(queues);
  const decisions = decisionBundle(queues, queue, [policy.confirmDecision]);
  const result = build({ queues, queue, decisions });
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.decisionCoverage.missingDecisionCount, 1);
  assert.equal(result.audit.unlockCorpusAbsenceReviewComplete, false);
});

test('identical selected absence snapshots reproduce the same applications and audit', () => {
  const bundle = fixture([policy.confirmDecision, policy.rejectDecision, policy.additionalEvidenceDecision]);
  assert.equal(hash(build(bundle)), hash(build(structuredClone(bundle))));
});

test('absence application fails closed on implicit selection, drift, corpus mismatch, queue mismatch, or account state', () => {
  const bundle = fixture([policy.confirmDecision]);
  assert.equal(build(bundle, { decisionSnapshot: { ...bundle.decisions.snapshot, explicit: false } }).audit.publishable, false);
  assert.equal(build(bundle, { queueManifest: {} }).audit.publishable, false);
  const changedDecisions = structuredClone(bundle.decisions.records); changedDecisions[0].reviewNotes = 'Changed after import';
  assert.equal(build(bundle, { decisionRecords: changedDecisions }).audit.publishable, false);
  const changedDecisionManifest = structuredClone(bundle.decisions.manifest); changedDecisionManifest.source.inputSnapshot.corpusEvidenceContentHash = hash('other corpus');
  assert.equal(build(bundle, { decisionManifest: changedDecisionManifest }).audit.publishable, false);
  const changedQueueManifest = structuredClone(bundle.queue.manifest); changedQueueManifest.source.audit.inputCoverage.inventorySkillRecordCount += 1;
  assert.equal(build(bundle, { queueManifest: changedQueueManifest }).audit.publishable, false);
  const accountDecisions = structuredClone(bundle.decisions.records); accountDecisions[0].currentBaseLevel = 34;
  assert.equal(build(bundle, { decisionRecords: accountDecisions }).audit.publishable, false);
  const changedQueue = structuredClone(bundle.queues); changedQueue[0].matchEvidence.exactStablePageIdMatchCount = 1;
  assert.equal(build(bundle, { queueRecords: changedQueue }).audit.publishable, false);
});

test('independent absence audit rejects a no-requirement claim and downstream promotion', () => {
  const bundle = fixture([policy.confirmDecision]);
  const result = build(bundle);
  const changed = structuredClone(result.records);
  changed[0].noRequirementClaimApplied = true;
  changed[0].requirementOrUnlockApplied = true;
  changed[0].canonicalActivityIdentity = { id: 'invented' };
  changed[0].optimizerEligible = true;
  changed[0].recordContentHash = hash(without(changed[0], 'recordContentHash'));
  const audit = auditUnlockCorpusAbsenceReconciliationApplications(changed, {
    queueRecords: bundle.queues, queueRaw: bundle.queue.raw, queueManifest: bundle.queue.manifest, queueSnapshot: bundle.queue.snapshot,
    decisionRecords: bundle.decisions.records, decisionRaw: bundle.decisions.raw,
    decisionManifest: bundle.decisions.manifest, decisionSnapshot: bundle.decisions.snapshot,
    policy, queuePolicy, decisionPolicy, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.applicationCoverage.recordMismatchKeys.length, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('absence application CLI requires explicit snapshots and writes only a valid selected application', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-unlock-corpus-absence-application-'));
  try {
    let command = spawnSync(process.execPath, [
      'platform/transforms/apply-cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-decisions.mjs',
      `--root=${root}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    const bundle = fixture([policy.confirmDecision]);
    for (const [directory, domain, raw, manifest] of [
      [bundle.queue.snapshot.directory, queueDomain, bundle.queue.raw, bundle.queue.manifest],
      [bundle.decisions.snapshot.directory, decisionDomain, bundle.decisions.raw, bundle.decisions.manifest]
    ]) {
      const target = path.join(root, directory);
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, `${domain}.ndjson`), raw);
      fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    command = spawnSync(process.execPath, [
      'platform/transforms/apply-cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-decisions.mjs',
      `--root=${root}`,
      `--queue-snapshot=${bundle.queue.snapshot.directory}`,
      `--decision-snapshot=${bundle.decisions.snapshot.directory}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, true);
    assert.equal(output.coverage.confirmedAppliedCount, 1);
    assert.equal(output.coverage.unlockCorpusAbsenceReviewComplete, true);
    const rows = fs.readFileSync(path.join(root, output.outputSnapshot.directory, `${outputDomain}.ndjson`), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].corpusAbsenceFindingConfirmed, true);
    assert.equal(rows[0].noRequirementClaimApplied, false);
    assert.equal(rows[0].optimizerEligible, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill level-unlock-corpus absence reconciliation application checks passed.');
