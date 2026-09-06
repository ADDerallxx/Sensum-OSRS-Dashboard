import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport,
  expectedRenderedPageWithoutUnlockSemanticRelevanceBlankDecision
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-lib.mjs';
import {
  auditRenderedPageWithoutUnlockSemanticRelevanceApplications,
  buildRenderedPageWithoutUnlockSemanticRelevanceApplications,
  compileRenderedPageWithoutUnlockSemanticRelevanceApplicationPolicy
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-application-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-application-v1.json', 'utf8'));
const queuePolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-application-record-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-application-audit-v1.json', 'utf8'));
const queueDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue';
const decisionDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decisions';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-applications';
const queueCreatedAt = '2026-09-06T00:39:51.442Z';
const decisionCreatedAt = '2026-09-07T13:05:00.000Z';
const json = value => JSON.stringify(value);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function observation(ordinal, index) {
  return {
    guideContentHash: hash(`guide:${ordinal}:${index}`),
    guidePageId: 1000 + ordinal * 10 + index,
    guideRevision: String(15000000 + ordinal * 10 + index),
    guideTitle: `Guide ${ordinal}-${index}`,
    namespaceId: 0,
    parserChannel: 'links',
    parserMetadata: { section: `Section ${index}` },
    parserObservedAt: `2026-09-04T11:0${index}:00.000Z`,
    parserReportedExists: true,
    requestedTitle: `Target ${ordinal}`,
    resolutionState: 'current_revision_pinned_page',
    sourcePresence: ordinal % 2 ? 'direct_source_stable_page_id' : 'rendered_only_origin_unattributed'
  };
}

function queueRecord(ordinal = 1, namespaceId = 0) {
  const sourceSignatureKey = `wiki-pageid:${2000 + ordinal}|target-source-signature`;
  const sourcePageIdentity = {
    sourcePageId: 2000 + ordinal,
    sourceNamespaceId: namespaceId,
    resolvedTitle: `Target ${ordinal}`,
    sourceRevision: String(15100000 + ordinal),
    sourceTimestamp: '2026-09-04T10:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`,
    sourceContentHash: hash(`source:${ordinal}`),
    sourceContentBytes: 1000 + ordinal,
    sourceLineCount: 20 + ordinal
  };
  const observations = [observation(ordinal, 1), observation(ordinal, 2)];
  const targetPageIdentity = {
    redirected: false,
    resolvedTitle: sourcePageIdentity.resolvedTitle,
    sourcePageId: sourcePageIdentity.sourcePageId,
    sourceRevision: sourcePageIdentity.sourceRevision,
    sourceTimestamp: sourcePageIdentity.sourceTimestamp,
    sourceUrl: sourcePageIdentity.sourceUrl
  };
  const provenancePartition = ordinal % 2 ? 'direct_source_only' : 'rendered_only_origin_unattributed';
  const provenanceRank = queuePolicy.priorityByProvenancePartition[provenancePartition];
  const namespaceRank = namespaceId === 0 ? 0 : 1;
  const base = {
    contract: policy.queueContract,
    reviewQueueOrdinal: ordinal,
    sourceQueueOrdinal: ordinal,
    workQueueEntryKey: `${sourceSignatureKey}|source-scoped-semantic-relevance-review`,
    sourceSignatureKey,
    sourceSignatureRecordContentHash: hash(`signature-record:${ordinal}`),
    sourceSignatureSnapshotContentHash: hash('signature-snapshot'),
    sourceWorkQueueRecordContentHash: hash(`work-record:${ordinal}`),
    sourceWorkQueueSnapshotContentHash: hash('work-snapshot'),
    sourceCandidateRecordContentHash: hash(`candidate-record:${ordinal}`),
    sourceCandidateSnapshotContentHash: hash('candidate-snapshot'),
    sourcePageIdentity,
    provenancePartition,
    requestedTitles: [sourcePageIdentity.resolvedTitle],
    retainedGuideContexts: {
      requestedTitles: [sourcePageIdentity.resolvedTitle],
      namespaceIds: [namespaceId],
      guideObservationCount: observations.length,
      observations,
      sourcePresenceCounts: {},
      targetPageIdentity
    },
    structuralEvidence: {
      rootTemplates: [{ template: 'Example', line: 1 }],
      directCategories: [{ category: 'Examples', line: 20 }],
      leadParagraphs: [{ ordinal: 1, rawText: 'Exact source evidence.', sourceLocator: { lineStart: 2, lineEnd: 2 } }],
      headings: [{ ordinal: 1, level: 2, rawTitle: 'Uses', normalizedTitle: 'Uses', line: 5 }]
    },
    evidenceFingerprint: null,
    reviewPriority: { band: provenanceRank + namespaceRank * 3, provenanceRank, namespaceRank },
    reviewRoute: namespaceId === 0 ? queuePolicy.reviewRoutes.mainNamespace : queuePolicy.reviewRoutes.nonMainNamespace,
    allowedDispositions: [...decisionPolicy.allowedDecisions],
    reviewQuestion: 'Does this exact revision-pinned source have a material semantic relationship to one or more retained training-guide observations?',
    semanticDisposition: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    reviewEvidenceKeys: [],
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: ['source_scoped_semantic_relevance_review_pending'],
    state: policy.requiredQueueState
  };
  base.evidenceFingerprint = hash({
    sourceSignatureSnapshotContentHash: base.sourceSignatureSnapshotContentHash,
    sourceSignatureRecordContentHash: base.sourceSignatureRecordContentHash,
    sourceWorkQueueSnapshotContentHash: base.sourceWorkQueueSnapshotContentHash,
    sourceWorkQueueRecordContentHash: base.sourceWorkQueueRecordContentHash,
    sourceCandidateSnapshotContentHash: base.sourceCandidateSnapshotContentHash,
    sourceCandidateRecordContentHash: base.sourceCandidateRecordContentHash,
    sourcePageIdentity: base.sourcePageIdentity,
    requestedTitles: base.requestedTitles,
    retainedGuideContexts: base.retainedGuideContexts,
    structuralEvidence: base.structuralEvidence
  });
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function queueBundle(records) {
  const raw = records.map(json).join('\n') + '\n';
  const observationCount = records.reduce((sum, row) => sum + row.retainedGuideContexts.guideObservationCount, 0);
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1',
    domain: queueDomain,
    createdAt: queueCreatedAt,
    records: records.length,
    contentHash: hash(raw),
    source: {
      policy: { id: policy.inputQueuePolicy, contentHash: policy.inputQueuePolicyContentHash },
      audit: {
        bindingCoverage: { fullyBoundSignatureCount: records.length, allThreeSnapshotsAndRecordsBound: true },
        contextPreservationCoverage: { retainedGuideObservationCount: observationCount, exactContextPreservation: true },
        queueCoverage: {
          reviewQueueEntryCount: records.length,
          blankDecisionTemplateCount: records.length,
          duplicateOutputKeys: [], missingOutputKeys: [], unexpectedOutputKeys: [], mismatchKeys: [], priorityOrderMatches: true
        },
        semanticPreservationCoverage: {
          semanticDispositionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0,
          repeatabilityClassifiedCount: 0, mechanicsReviewCompleteCount: 0, optimizerEligibleCount: 0,
          automaticVerificationCount: 0, decidedTemplateCount: 0, unsupportedPromotionKeys: []
        },
        accountStateFindings: [],
        queueExportComplete: true,
        semanticRelevanceReviewComplete: false,
        reconciliationComplete: false,
        completeActivityUniverse: false,
        publishable: true
      }
    }
  };
  return { raw, manifest, snapshot: { directory: 'queue-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function observationHashes(queue) { return queue.retainedGuideContexts.observations.map(hash); }

function submission(queue, decision) {
  const requiredObservations = decision === policy.notRelevantDecision ? observationHashes(queue) : observationHashes(queue).slice(0, 1);
  return {
    ...expectedRenderedPageWithoutUnlockSemanticRelevanceBlankDecision(queue, decisionPolicy),
    decision,
    reviewer: 'Human Reviewer',
    reviewedAt: '2026-09-07T13:00:00.000Z',
    reviewNotes: 'Reviewed the exact pinned source against every cited guide context.',
    evidenceKeys: [queue.evidenceFingerprint, queue.sourcePageIdentity.sourceContentHash, ...requiredObservations]
  };
}

function decisionBundle(queues, queue, decisions) {
  const submissions = decisions.map((decision, index) => submission(queues[index], decision));
  const imported = buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport({
    queueRecords: queues,
    submissions,
    policy: decisionPolicy,
    queuePolicy,
    queueSnapshotContentHash: queue.snapshot.contentHash,
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
      inputSnapshot: { directory: queue.snapshot.directory, contentHash: queue.snapshot.contentHash, rejections: [] },
      audit: imported.audit
    }
  };
  return { records, raw, manifest, snapshot: { directory: 'decision-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function fixture(decisions) {
  const queues = decisions.map((_, index) => queueRecord(index + 1, index === 2 ? 6 : 0));
  const queue = queueBundle(queues);
  return { queues, queue, decisions: decisionBundle(queues, queue, decisions) };
}

function build(bundle, overrides = {}) {
  return buildRenderedPageWithoutUnlockSemanticRelevanceApplications({
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

test('policy is generic, decision-bound, and cannot automatically verify', () => {
  const compiled = compileRenderedPageWithoutUnlockSemanticRelevanceApplicationPolicy(policy, queuePolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'apply' };
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceApplicationPolicy(specific, queuePolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceApplicationPolicy(automatic, queuePolicy, decisionPolicy, hash).valid, false);
});

test('applies relevant and not-relevant dispositions without downstream promotion', () => {
  const bundle = fixture([policy.relevantDecision, policy.notRelevantDecision]);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.semanticRelevanceReviewComplete, true);
  assert.equal(result.audit.applicationCoverage.relevantAppliedCount, 1);
  assert.equal(result.audit.applicationCoverage.notRelevantAppliedCount, 1);
  assert.ok(result.records.every(row => row.semanticDispositionApplied === true && row.semanticRelevanceResolved === true));
  assert.ok(result.records.every(row => row.authoritativeGameUniverseExclusion === false && row.optimizerEligible === false));
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing application field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('applies an ambiguous review only as an unresolved additional-evidence blocker', () => {
  const bundle = fixture([policy.ambiguousDecision]);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.semanticRelevanceReviewComplete, false);
  assert.equal(result.audit.applicationCoverage.ambiguousAppliedCount, 1);
  assert.equal(result.records[0].semanticDispositionApplied, true);
  assert.equal(result.records[0].semanticRelevanceResolved, false);
  assert.ok(result.records[0].blockers.includes('source_scoped_semantic_relevance_ambiguous_additional_evidence_required'));
});

test('allows an exact partial decision snapshot but never calls review complete', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const queue = queueBundle(queues);
  const decisions = decisionBundle(queues, queue, [policy.relevantDecision]);
  const result = build({ queues, queue, decisions });
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.decisionCoverage.missingDecisionCount, 1);
  assert.equal(result.audit.semanticRelevanceReviewComplete, false);
});

test('identical selected snapshots reproduce the same applications and audit', () => {
  const bundle = fixture([policy.relevantDecision, policy.notRelevantDecision, policy.ambiguousDecision]);
  assert.equal(hash(build(bundle)), hash(build(structuredClone(bundle))));
});

test('fails closed on implicit selection, decision drift, manifest drift, queue mismatch, or account state', () => {
  const bundle = fixture([policy.relevantDecision]);
  assert.equal(build(bundle, { decisionSnapshot: { ...bundle.decisions.snapshot, explicit: false } }).audit.publishable, false);
  const changedDecisions = structuredClone(bundle.decisions.records); changedDecisions[0].reviewNotes = 'Changed after import';
  assert.equal(build(bundle, { decisionRecords: changedDecisions }).audit.publishable, false);
  const changedManifest = structuredClone(bundle.decisions.manifest); changedManifest.source.inputSnapshot.contentHash = hash('other queue');
  assert.equal(build(bundle, { decisionManifest: changedManifest }).audit.publishable, false);
  const changedContextCount = structuredClone(bundle.queue.manifest); changedContextCount.source.audit.contextPreservationCoverage.retainedGuideObservationCount += 1;
  assert.equal(build(bundle, { queueManifest: changedContextCount }).audit.publishable, false);
  const accountDecisions = structuredClone(bundle.decisions.records); accountDecisions[0].currentBaseLevel = 34;
  assert.equal(build(bundle, { decisionRecords: accountDecisions }).audit.publishable, false);
  const queueMismatch = structuredClone(bundle.queues); queueMismatch[0].sourcePageIdentity.resolvedTitle = 'Changed';
  assert.equal(build(bundle, { queueRecords: queueMismatch }).audit.publishable, false);
});

test('independent audit rejects changed disposition, exclusion, and downstream promotion', () => {
  const bundle = fixture([policy.relevantDecision]);
  const result = build(bundle);
  const changed = structuredClone(result.records);
  changed[0].semanticDisposition = policy.notRelevantDecision;
  changed[0].authoritativeGameUniverseExclusion = true;
  changed[0].canonicalActivityIdentity = { id: 'invented' };
  changed[0].optimizerEligible = true;
  changed[0].recordContentHash = hash(without(changed[0], 'recordContentHash'));
  const audit = auditRenderedPageWithoutUnlockSemanticRelevanceApplications(changed, {
    queueRecords: bundle.queues, queueRaw: bundle.queue.raw, queueManifest: bundle.queue.manifest, queueSnapshot: bundle.queue.snapshot,
    decisionRecords: bundle.decisions.records, decisionRaw: bundle.decisions.raw,
    decisionManifest: bundle.decisions.manifest, decisionSnapshot: bundle.decisions.snapshot,
    policy, queuePolicy, decisionPolicy, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.applicationCoverage.recordMismatchKeys.length, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI requires both explicit snapshots and writes only a valid selected application', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-semantic-relevance-application-'));
  try {
    let command = spawnSync(process.execPath, [
      'platform/transforms/apply-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-decisions.mjs',
      `--root=${root}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    const bundle = fixture([policy.notRelevantDecision]);
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
      'platform/transforms/apply-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-decisions.mjs',
      `--root=${root}`,
      `--queue-snapshot=${bundle.queue.snapshot.directory}`,
      `--decision-snapshot=${bundle.decisions.snapshot.directory}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, true);
    assert.equal(output.coverage.notRelevantAppliedCount, 1);
    assert.equal(output.coverage.semanticRelevanceReviewComplete, true);
    const rows = fs.readFileSync(path.join(root, output.outputSnapshot.directory, `${outputDomain}.ndjson`), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].semanticDisposition, policy.notRelevantDecision);
    assert.equal(rows[0].authoritativeGameUniverseExclusion, false);
    assert.equal(rows[0].optimizerEligible, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill source-scoped semantic-relevance application checks passed.');
