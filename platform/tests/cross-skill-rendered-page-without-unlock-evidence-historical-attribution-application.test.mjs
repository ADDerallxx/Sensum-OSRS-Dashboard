import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  buildHistoricalAttributionReviewDecisionImport,
  expectedHistoricalAttributionBlankDecision
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-lib.mjs';
import {
  auditHistoricalAttributionApplications,
  buildHistoricalAttributionApplications,
  compileHistoricalAttributionApplicationPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-application-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-application-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-application-record-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-application-audit-v1.json', 'utf8'));
const queueDomain = 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue';
const decisionDomain = 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decisions';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-applications';
const queueCreatedAt = '2026-09-06T02:19:44.355Z';
const decisionCreatedAt = '2026-09-07T12:05:00.000Z';
const exactRevisionUrl = revision => `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}`;
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function observation(ordinal, index) {
  const value = {
    guideContentHash: hash(`guide:${ordinal}:${index}`), guidePageId: 1000 + ordinal * 10 + index,
    guideRevision: String(15300000 + ordinal * 10 + index), guideTitle: `Training guide ${ordinal}-${index}`,
    namespaceId: 0, parserChannel: index % 2 ? 'links' : 'images', parserMetadata: { section: `Section ${index}` },
    parserObservedAt: index === 1 ? '2026-09-04T12:01:00.66Z' : '2026-09-04T12:02:00.000Z', parserReportedExists: true,
    requestedTitle: `Target ${ordinal}`, resolutionState: 'current_revision_pinned_page', sourcePresence: 'rendered_only_origin_unattributed'
  };
  return {
    observationKey: hash({ renderedTargetKey: `wiki-pageid:${2000 + ordinal}`, observation: value }),
    observationContentHash: hash(value), exactGuideRevisionUrl: exactRevisionUrl(value.guideRevision), observation: value
  };
}

function queueRecord(ordinal = 1) {
  const renderedTargetKey = `wiki-pageid:${2000 + ordinal}`;
  const sourceWorkQueueEntryKey = `${renderedTargetKey}|without-unlock-evidence-partition|source-bound-reconciliation-work`;
  const observations = [observation(ordinal, 1), observation(ordinal, 2)];
  const bindings = observations.map(row => {
    const base = {
      guidePageId: row.observation.guidePageId, guideTitle: row.observation.guideTitle,
      guideRevision: row.observation.guideRevision, guideContentHash: row.observation.guideContentHash,
      exactGuideRevisionUrl: row.exactGuideRevisionUrl, observationKeys: [row.observationKey]
    };
    return { ...base, observationCount: 1, bindingContentHash: hash(base) };
  });
  const base = {
    contract: policy.queueContract,
    historicalAttributionWorkEntryKey: `${sourceWorkQueueEntryKey}|historical-rendered-attribution-work`,
    queueOrdinal: ordinal, sourceWorkQueueOrdinal: 100 + ordinal, sourceWorkQueueEntryKey,
    sourceWorkQueueRecordContentHash: hash(`source-work-record:${ordinal}`), sourceWorkQueueIntrinsicRecordContentHash: hash(`source-work-intrinsic:${ordinal}`),
    sourceWorkQueueSnapshotContentHash: hash('source-work-snapshot'), sourcePartitionSnapshotContentHash: hash('partition-snapshot'),
    sourceCandidateContentHash: hash(`candidate:${ordinal}`), sourceCandidateSnapshotContentHash: hash('candidate-snapshot'), renderedTargetKey,
    stableWikiPageIdentity: {
      redirected: false, resolvedTitle: `Target ${ordinal}`, sourcePageId: 2000 + ordinal,
      sourceRevision: String(15200000 + ordinal), sourceTimestamp: '2026-09-04T10:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`
    },
    provenancePartition: ordinal % 2 ? 'mixed_direct_and_unattributed_rendered' : 'rendered_only_origin_unattributed',
    requiredEvidenceChannel: queuePolicy.requiredEvidenceChannel, guideObservationCount: 2,
    historicalRenderedObservationCount: observations.length, historicalRenderedObservationSetContentHash: hash(observations), historicalRenderedObservations: observations,
    historicalGuideRevisionBindingCount: bindings.length, historicalGuideRevisionBindingsContentHash: hash(bindings), historicalGuideRevisionBindings: bindings,
    requiredAttributionEvidence: queuePolicy.requiredAttributionEvidence, nonClaims: queuePolicy.nonClaims,
    historicalRenderedExpansionDependencyAttribution: null, attributionEvidenceKeys: [], reviewDecision: null, requirementOrUnlockApplied: false,
    semanticDisposition: null, canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    mechanicsReviewComplete: false, optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['historical_rendered_expansion_dependency_attribution_pending'], state: policy.requiredQueueState
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function queueBundle(queues) {
  const raw = queues.map(json).join('\n') + '\n';
  const observations = queues.reduce((sum, row) => sum + row.historicalRenderedObservationCount, 0);
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: queueDomain, createdAt: queueCreatedAt, records: queues.length, contentHash: hash(raw),
    source: { policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash }, audit: {
      queueExportComplete: true, historicalAttributionComplete: false, completeActivityUniverse: false, publishable: true,
      queueCoverage: { outputRecordCount: queues.length, duplicateOutputKeys: [], missingOutputKeys: [], unexpectedOutputKeys: [], recordMismatchKeys: [], orderMatchesFilteredSourceQueue: true },
      observationCoverage: { outputHistoricalRenderedObservationCount: observations, exactHistoricalObservationPopulation: true, duplicateObservationKeys: [], missingObservationKeys: [], unexpectedObservationKeys: [], directObservationLeakKeys: [] },
      reviewCoverage: { blankDecisionTemplateCount: queues.length, reviewStartedCount: 0, attributionCompletedCount: 0 },
      semanticPreservationCoverage: { requirementOrUnlockApplicationCount: 0, semanticDispositionCount: 0, canonicalGameEntityIdentityCount: 0,
        canonicalActivityIdentityCount: 0, repeatabilityClassificationCount: 0, mechanicsReviewCompleteCount: 0,
        optimizerPromotionCount: 0, automaticVerificationCount: 0, unsupportedPromotionKeys: [] }
    } }
  };
  return { raw, manifest, snapshot: { directory: 'queue-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function attribution(queue, row, outcome, index) {
  const dependencyRevision = String(15100000 + queue.queueOrdinal * 10 + index);
  const dependencyContentHash = hash(`dependency:${queue.renderedTargetKey}:${index}`);
  return {
    observationKey: row.observationKey, observationContentHash: row.observationContentHash, attributionOutcome: outcome,
    dependencyKind: 'template', dependencyPageId: 3000 + queue.queueOrdinal * 10 + index, dependencyNamespaceId: 10,
    dependencyTitle: `Template:Training ${queue.queueOrdinal}-${index}`, dependencyRevision,
    dependencyTimestamp: '2026-09-04T09:00:00Z', dependencyContentHash, exactDependencyRevisionUrl: exactRevisionUrl(dependencyRevision),
    generativeSourceLocator: { kind: 'template_parameter', value: `method_${index}` },
    evidenceKeys: [row.observationKey, row.observationContentHash, row.observation.guideContentHash, dependencyContentHash]
  };
}

function allQueueEvidence(queue, queueHash) {
  return [...new Set([
    queueHash, queue.contentHash, queue.recordContentHash, queue.sourceWorkQueueRecordContentHash, queue.sourceWorkQueueIntrinsicRecordContentHash,
    queue.sourceWorkQueueSnapshotContentHash, queue.sourcePartitionSnapshotContentHash, queue.sourceCandidateContentHash,
    queue.sourceCandidateSnapshotContentHash, queue.historicalRenderedObservationSetContentHash, queue.historicalGuideRevisionBindingsContentHash,
    ...queue.historicalRenderedObservations.flatMap(row => [row.observationKey, row.observationContentHash, row.observation.guideContentHash]),
    ...queue.historicalGuideRevisionBindings.flatMap(row => [row.bindingContentHash, row.guideContentHash])
  ])];
}

function submission(queue, queueHash, disposition) {
  let attributions = [];
  if (disposition === policy.confirmedDecision) attributions = queue.historicalRenderedObservations.map((row, index) => attribution(queue, row, decisionPolicy.allowedAttributionOutcomes[0], index + 1));
  if (disposition === policy.rejectedDecision) attributions = [attribution(queue, queue.historicalRenderedObservations[0], decisionPolicy.allowedAttributionOutcomes[1], 1)];
  const core = [queueHash, queue.contentHash, queue.recordContentHash, queue.sourceWorkQueueRecordContentHash, queue.sourceCandidateContentHash,
    queue.historicalRenderedObservationSetContentHash, queue.historicalGuideRevisionBindingsContentHash];
  const evidenceKeys = disposition === policy.evidenceUnavailableDecision ? allQueueEvidence(queue, queueHash) :
    [...new Set([...core, ...attributions.flatMap(row => [row.dependencyContentHash, ...row.evidenceKeys])])];
  return {
    ...expectedHistoricalAttributionBlankDecision(queue, decisionPolicy), disposition, observationAttributions: attributions, evidenceKeys,
    reviewer: 'Human Reviewer', reviewedAt: '2026-09-07T12:00:00.000Z',
    notes: 'Reviewed every cited historical observation against exact revision-pinned dependency evidence.'
  };
}

function decisionBundle(queues, queue, dispositions) {
  const submissions = dispositions.map((disposition, index) => submission(queues[index], queue.snapshot.contentHash, disposition));
  const imported = buildHistoricalAttributionReviewDecisionImport({
    queueRecords: queues, submissions, policy: decisionPolicy, queuePolicy,
    queueSnapshotContentHash: queue.snapshot.contentHash, queueSnapshotCreatedAt: queue.snapshot.createdAt, contentHash: hash
  });
  assert.equal(imported.audit.publishable, true);
  const records = imported.records.map(record => ({ ...record, contentHash: hash(record) }));
  const raw = records.map(json).join('\n') + '\n';
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: decisionDomain, createdAt: decisionCreatedAt, records: records.length, contentHash: hash(raw),
    source: {
      policy: { id: policy.inputDecisionImportPolicy, contentHash: policy.inputDecisionImportPolicyContentHash },
      inputQueuePolicy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash },
      inputSnapshot: { directory: queue.snapshot.directory, contentHash: queue.snapshot.contentHash, createdAt: queue.snapshot.createdAt },
      audit: imported.audit
    }
  };
  return { records, raw, manifest, snapshot: { directory: 'decision-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function fixture(dispositions) {
  const queues = dispositions.map((_, index) => queueRecord(index + 1));
  const queue = queueBundle(queues);
  const decisions = decisionBundle(queues, queue, dispositions);
  return { queues, queue, decisions };
}

function build(bundle, overrides = {}) {
  return buildHistoricalAttributionApplications({
    queueRecords: bundle.queues, queueRaw: bundle.queue.raw, queueManifest: bundle.queue.manifest, queueSnapshot: bundle.queue.snapshot,
    decisionRecords: bundle.decisions.records, decisionRaw: bundle.decisions.raw, decisionManifest: bundle.decisions.manifest, decisionSnapshot: bundle.decisions.snapshot,
    policy, queuePolicy, decisionPolicy, contentHash: hash, ...overrides
  });
}

test('policy is generic, decision-bound, and cannot automatically verify', () => {
  const compiled = compileHistoricalAttributionApplicationPolicy(policy, queuePolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'apply' };
  assert.equal(compileHistoricalAttributionApplicationPolicy(specific, queuePolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileHistoricalAttributionApplicationPolicy(automatic, queuePolicy, decisionPolicy, hash).valid, false);
});

test('applies only a complete confirmed attribution and keeps downstream gates closed', () => {
  const bundle = fixture([policy.confirmedDecision]);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.applicationBatchComplete, true);
  assert.equal(result.audit.historicalAttributionApplicationComplete, true);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assert.equal(record.historicalAttributionApplied, true);
  assert.equal(record.appliedObservationAttributions.length, 2);
  assert.deepEqual(record.appliedObservationAttributions, bundle.decisions.records[0].submittedObservationAttributions);
  assert.equal(record.requirementOrUnlockApplied, false);
  assert.equal(record.optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing application field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('keeps rejected and evidence-unavailable decisions unapplied and explicitly blocked', () => {
  const bundle = fixture([policy.rejectedDecision, policy.evidenceUnavailableDecision]);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.historicalAttributionApplicationComplete, false);
  assert.equal(result.audit.applicationCoverage.confirmedApplicationCount, 0);
  assert.equal(result.audit.applicationCoverage.rejectedUnappliedCount, 1);
  assert.equal(result.audit.applicationCoverage.evidenceUnavailableUnappliedCount, 1);
  assert.ok(result.records.every(row => row.historicalAttributionApplied === false && row.appliedObservationAttributions.length === 0));
});

test('allows an exact partial decision snapshot but never calls attribution complete', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const queue = queueBundle(queues);
  const decisions = decisionBundle(queues, queue, [policy.confirmedDecision]);
  const bundle = { queues, queue, decisions };
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.decisionCoverage.missingDecisionCount, 1);
  assert.equal(result.audit.historicalAttributionApplicationComplete, false);
  assert.ok(result.audit.blockers.includes('one_or_more_historical_attribution_decisions_missing'));
});

test('identical selected snapshots reproduce the same applications and audit', () => {
  const bundle = fixture([policy.confirmedDecision, policy.rejectedDecision, policy.evidenceUnavailableDecision]);
  const first = build(bundle); const second = build(structuredClone(bundle));
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.audit), hash(second.audit));
});

test('fails closed on implicit selection, decision drift, manifest drift, queue mismatch, or account state', () => {
  const bundle = fixture([policy.confirmedDecision]);
  assert.equal(build(bundle, { decisionSnapshot: { ...bundle.decisions.snapshot, explicit: false } }).audit.publishable, false);
  const changedDecisions = structuredClone(bundle.decisions.records); changedDecisions[0].reviewNotes = 'Changed after import';
  assert.equal(build(bundle, { decisionRecords: changedDecisions }).audit.publishable, false);
  const changedManifest = structuredClone(bundle.decisions.manifest); changedManifest.source.inputSnapshot.contentHash = hash('other queue');
  assert.equal(build(bundle, { decisionManifest: changedManifest }).audit.publishable, false);
  const accountDecisions = structuredClone(bundle.decisions.records); accountDecisions[0].currentBaseLevel = 34;
  assert.equal(build(bundle, { decisionRecords: accountDecisions }).audit.publishable, false);
  const queueMismatch = structuredClone(bundle.queues); queueMismatch[0].stableWikiPageIdentity.resolvedTitle = 'Changed';
  assert.equal(build(bundle, { queueRecords: queueMismatch }).audit.publishable, false);
});

test('independent audit rejects attribution changes and downstream promotion', () => {
  const bundle = fixture([policy.confirmedDecision]); const result = build(bundle);
  const changed = structuredClone(result.records);
  changed[0].appliedObservationAttributions.pop();
  changed[0].requirementOrUnlockApplied = true;
  changed[0].optimizerEligible = true;
  changed[0].recordContentHash = hash(without(changed[0], 'recordContentHash'));
  const audit = auditHistoricalAttributionApplications(changed, {
    queueRecords: bundle.queues, queueRaw: bundle.queue.raw, queueManifest: bundle.queue.manifest, queueSnapshot: bundle.queue.snapshot,
    decisionRecords: bundle.decisions.records, decisionRaw: bundle.decisions.raw, decisionManifest: bundle.decisions.manifest, decisionSnapshot: bundle.decisions.snapshot,
    policy, queuePolicy, decisionPolicy, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.applicationCoverage.invalidOutcomeKeys.length, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI requires both explicit snapshots and writes only a valid selected application', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-historical-attribution-application-'));
  try {
    let command = spawnSync(process.execPath, ['platform/transforms/apply-cross-skill-rendered-page-without-unlock-evidence-historical-attribution-decisions.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    const bundle = fixture([policy.confirmedDecision]);
    for (const [directory, domain, raw, manifest] of [
      [bundle.queue.snapshot.directory, queueDomain, bundle.queue.raw, bundle.queue.manifest],
      [bundle.decisions.snapshot.directory, decisionDomain, bundle.decisions.raw, bundle.decisions.manifest]
    ]) {
      const target = path.join(root, directory); fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, `${domain}.ndjson`), raw);
      fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    command = spawnSync(process.execPath, [
      'platform/transforms/apply-cross-skill-rendered-page-without-unlock-evidence-historical-attribution-decisions.mjs',
      `--root=${root}`, `--queue-snapshot=${bundle.queue.snapshot.directory}`, `--decision-snapshot=${bundle.decisions.snapshot.directory}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, true);
    assert.equal(output.coverage.confirmedApplicationCount, 1);
    const rows = fs.readFileSync(path.join(root, output.outputSnapshot.directory, `${outputDomain}.ndjson`), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].historicalAttributionApplied, true);
    assert.equal(rows[0].optimizerEligible, false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill historical attribution application checks passed.');
