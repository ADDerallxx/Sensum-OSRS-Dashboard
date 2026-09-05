import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockEvidencePartition } from '../transforms/cross-skill-rendered-page-without-unlock-evidence-partition-lib.mjs';
import {
  auditRenderedPageWithoutUnlockReconciliationWorkQueue,
  buildRenderedPageWithoutUnlockReconciliationWorkQueue,
  compileRenderedPageWithoutUnlockReconciliationWorkQueuePolicy,
  renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-v1.json', 'utf8'));
const partitionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-partition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-entry-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-audit-v1.json', 'utf8'));
const candidateSnapshotContentHash = 'a'.repeat(64);
const partitionSnapshotContentHash = 'b'.repeat(64);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function observation(ordinal, sourcePresence) {
  return { guideContentHash: hash(`guide:${ordinal}`), guidePageId: 1000 + ordinal, guideRevision: String(15000000 + ordinal), guideTitle: `Guide ${ordinal}`, namespaceId: 0, parserChannel: 'links', parserMetadata: null, parserObservedAt: '2026-09-04T01:39:42.492Z', parserReportedExists: true, requestedTitle: `Target ${ordinal}`, resolutionState: 'current_revision_pinned_page', sourcePresence };
}

function candidate(ordinal, shape) {
  const observations = shape === 'direct' ? [observation(ordinal, 'direct_source_stable_page_id')] : shape === 'rendered'
    ? [observation(ordinal, 'rendered_only_origin_unattributed')]
    : [observation(ordinal, 'direct_source_stable_page_id'), observation(ordinal + 100, 'rendered_only_origin_unattributed')];
  const presence = Object.fromEntries(partitionPolicy.sourcePresenceVocabulary.map(value => [value, observations.filter(row => row.sourcePresence === value).length]));
  const identity = { redirected: false, resolvedTitle: `Target ${ordinal}`, sourcePageId: 2000 + ordinal, sourceRevision: String(15100000 + ordinal), sourceTimestamp: '2026-09-03T12:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}` };
  const base = {
    contract: partitionPolicy.inputContract, renderedTargetKey: `wiki-pageid:${identity.sourcePageId}`, candidateKey: null, candidateKind: partitionPolicy.inputCandidateKind,
    pageIdentity: { sourcePageId: identity.sourcePageId, resolvedTitle: identity.resolvedTitle, renderedSourceRevision: identity.sourceRevision, unlockSourceRevision: null, revisionRelationship: 'no_unlock_page_match' },
    sourceContexts: { renderedEvidence: { requestedTitles: [identity.resolvedTitle], namespaceIds: [0], guideObservationCount: observations.length, observations, sourcePresenceCounts: presence, targetPageIdentity: identity }, unlockEvidence: null, crossSourcePageIdentityEstablished: false, revisionRelationship: 'no_unlock_page_match', semanticRoutingState: partitionPolicy.inputSemanticRoutingState },
    skillKeys: [], statementKeys: [], queuedForSemanticReview: false, activityDiscoveryCandidate: false, reviewStatus: 'not_queued', canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null, optimizerEligible: false,
    sourceCrosswalkContentHash: hash(`crosswalk:${ordinal}`), accountIndependent: true, blockers: ['exact_cross_source_page_identity_not_established'], state: 'blocked'
  };
  return { ...base, contentHash: hash(base) };
}

const candidateRecords = [candidate(3, 'rendered'), candidate(1, 'direct'), candidate(2, 'mixed')];
const partitionBuild = buildRenderedPageWithoutUnlockEvidencePartition({ candidateRecords, policy: partitionPolicy, sourceCandidateSnapshotContentHash: candidateSnapshotContentHash, contentHash: hash });
const partitionRecords = partitionBuild.records.map(record => ({ ...record, contentHash: hash(record) }));
const source = { partitionRecords, candidateRecords, policy, partitionPolicy, partitionSnapshotContentHash, candidateSnapshotContentHash, contentHash: hash };
const clonedSource = () => ({
  partitionRecords: structuredClone(partitionRecords), candidateRecords: structuredClone(candidateRecords),
  policy: structuredClone(policy), partitionPolicy: structuredClone(partitionPolicy),
  partitionSnapshotContentHash, candidateSnapshotContentHash, contentHash: hash
});

test('policy and contracts are generic, complete, and fail closed', () => {
  const compiled = compileRenderedPageWithoutUnlockReconciliationWorkQueuePolicy(policy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'skip' };
  assert.equal(compileRenderedPageWithoutUnlockReconciliationWorkQueuePolicy(specific, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileRenderedPageWithoutUnlockReconciliationWorkQueuePolicy(automatic, hash).valid, false);
});

test('exports every validated partition exactly once in deterministic partition order', () => {
  const built = buildRenderedPageWithoutUnlockReconciliationWorkQueue(source);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.queueExportComplete, true);
  assert.equal(built.records.length, 3);
  assert.deepEqual(built.records.map(row => row.provenancePartition), policy.partitionOrder);
  assert.deepEqual(built.records.map(row => row.queueOrdinal), [1, 2, 3]);
  assert.deepEqual(built.records.map(row => row.partitionOrdinal), [1, 1, 1]);
  assert.deepEqual(built.audit.queueCoverage.partitionCounts, { direct_source_only: 1, mixed_direct_and_unattributed_rendered: 1, rendered_only_origin_unattributed: 1 });
  for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing queue field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('preserves exact source bindings and route-specific evidence obligations', () => {
  const built = buildRenderedPageWithoutUnlockReconciliationWorkQueue(source);
  const direct = built.records[0]; const mixed = built.records[1]; const rendered = built.records[2];
  assert.deepEqual(direct.requiredEvidenceChannels, partitionRecords.find(row => row.provenancePartition === 'direct_source_only').requiredNextEvidenceChannels);
  assert.equal(direct.historicalRenderedAttributionRequired, false);
  assert.equal(mixed.historicalRenderedAttributionRequired, true);
  assert.equal(rendered.historicalRenderedAttributionRequired, true);
  assert.equal(built.audit.evidenceWorkCoverage.requiredChannelCounts.historical_rendered_expansion_dependency_attribution, 2);
  assert.equal(built.audit.sourceBoundCoverage.guideObservationCount, 4);
  assert.equal(built.audit.sourceBoundCoverage.distinctGuideRevisionBindingCount, 4);
  assert.match(built.audit.sourceBoundCoverage.guideRevisionBindingsContentHash, /^[0-9a-f]{64}$/);
  assert.equal(built.audit.evidenceWorkCoverage.evidenceCollectionStartedCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
});

test('records, ordering, audit, and readable artifact are deterministic', () => {
  const first = buildRenderedPageWithoutUnlockReconciliationWorkQueue(source);
  const second = buildRenderedPageWithoutUnlockReconciliationWorkQueue(clonedSource());
  assert.deepEqual(second, first);
  assert.equal(renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown(first.records), first.markdown);
  assert.match(first.markdown, /direct_source_only \(1\)/);
  assert.match(first.markdown, /does not establish an unlock/);
});

for (const [name, mutate] of [
  ['partition outer hash drift', value => { value.partitionRecords[0].contentHash = '0'.repeat(64); }],
  ['candidate intrinsic drift', value => { value.candidateRecords[0].contentHash = '0'.repeat(64); }],
  ['candidate snapshot drift', value => { value.candidateSnapshotContentHash = 'c'.repeat(64); }],
  ['partition route drift', value => { const row = value.partitionRecords.find(record => record.provenancePartition === 'rendered_only_origin_unattributed'); row.provenancePartition = 'direct_source_only'; row.contentHash = hash(without(row, 'contentHash')); }]
]) test(`fails atomically on ${name}`, () => {
  const changed = clonedSource(); mutate(changed);
  const built = buildRenderedPageWithoutUnlockReconciliationWorkQueue(changed);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
});

test('audit rejects prefilled evidence, semantic promotion, and account state', () => {
  const built = buildRenderedPageWithoutUnlockReconciliationWorkQueue(source);
  const changed = structuredClone(built.records);
  changed[0].evidenceCollection.evidenceKeys.push('invented');
  changed[0].canonicalActivityIdentity = { id: 'invented' };
  changed[0].optimizerEligible = true;
  changed[0].accountLevel = 34;
  changed[0].recordContentHash = hash(without(changed[0], 'recordContentHash'));
  const markdown = renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown(changed);
  const audit = auditRenderedPageWithoutUnlockReconciliationWorkQueue(changed, { ...source, markdown });
  assert.equal(audit.publishable, false);
  assert.equal(audit.evidenceWorkCoverage.evidenceCollectionStartedCount, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotionPartitionKeys.length, 1);
  assert.ok(audit.blockers.includes('current_account_state_present'));
});

test('CLI rejects a corrupt partition manifest without writing a queue', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-rendered-no-unlock-work-queue-'));
  try {
    const directory = path.join(root, '2026-09-05T10-00-00-000Z'); fs.mkdirSync(directory, { recursive: true });
    const raw = partitionRecords.map(JSON.stringify).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-rendered-page-without-unlock-evidence-partition.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ domain: 'cross-skill-rendered-page-without-unlock-evidence-partition', records: partitionRecords.length, contentHash: '0'.repeat(64), source: { audit: { partitionComplete: true, publishable: true, unlockEvidenceReconciled: false, completeActivityUniverse: false, partitionCoverage: { exactDisjointPartition: true }, semanticPreservationCoverage: { unsupportedPromotionTargetKeys: [] } } } }));
    const command = spawnSync(process.execPath, ['platform/transforms/export-cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(command.status, 0);
    assert.match(command.stderr, /No valid rendered-page\/no-unlock partition snapshot exists/);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue.ndjson'))).length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill rendered-page/no-unlock reconciliation work-queue export checks passed.');
