import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditRenderedPageWithoutUnlockSemanticRelevanceWorkQueue,
  buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue,
  compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy,
  renderRenderedPageWithoutUnlockSemanticRelevanceReviewIndex,
  serializeRenderedPageWithoutUnlockSemanticRelevanceDecisionTemplates
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-v1.json', 'utf8'));
const entryContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-entry-v1.json', 'utf8'));
const templateContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-decision-template-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-audit-v1.json', 'utf8'));
const signatureSnapshotContentHash = 'a'.repeat(64);
const queueSnapshotContentHash = 'b'.repeat(64);
const candidateSnapshotContentHash = 'c'.repeat(64);
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue';
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function withOuterHash(base) { return { ...base, contentHash: hash(base) }; }
function withBothHashes(base) {
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function observation(ordinal, occurrence, sourcePresence) {
  return {
    guidePageId: 1000 + occurrence,
    guideTitle: `Training guide ${occurrence}`,
    guideRevision: String(15000000 + occurrence),
    guideContentHash: hash(`guide:${occurrence}`),
    requestedTitle: `Target ${ordinal}`,
    namespaceId: 0,
    parserChannel: 'links',
    parserMetadata: { section: `Section ${occurrence}` },
    parserObservedAt: '2026-09-04T01:39:42.492Z',
    parserReportedExists: true,
    sourcePresence
  };
}

function guideBindings(observations) {
  const unique = new Map();
  for (const row of observations) {
    const binding = { guidePageId: row.guidePageId, guideTitle: row.guideTitle, guideRevision: row.guideRevision, guideContentHash: row.guideContentHash };
    unique.set(hash(binding), binding);
  }
  return [...unique.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

function candidate(ordinal, provenancePartition, namespaceId) {
  const presences = provenancePartition === 'direct_source_only'
    ? ['direct_source_stable_page_id', 'direct_source_stable_page_id']
    : provenancePartition === 'rendered_only_origin_unattributed'
      ? ['rendered_only_origin_unattributed']
      : ['direct_source_stable_page_id', 'rendered_only_origin_unattributed'];
  const observations = presences.map((presence, index) => observation(ordinal, ordinal * 10 + index, presence));
  const identity = {
    redirected: false,
    resolvedTitle: `Target ${ordinal}`,
    sourcePageId: 2000 + ordinal,
    sourceRevision: String(15100000 + ordinal),
    sourceTimestamp: `2026-09-0${ordinal}T12:00:00Z`,
    sourceUrl: `https://oldschool.runescape.wiki/w/Target_${ordinal}`
  };
  return withOuterHash({
    contract: policy.candidateContract,
    renderedTargetKey: `wiki-pageid:${identity.sourcePageId}`,
    candidateKey: null,
    candidateKind: 'rendered_page_without_unlock_match',
    pageIdentity: { sourcePageId: identity.sourcePageId, resolvedTitle: identity.resolvedTitle, renderedSourceRevision: identity.sourceRevision, unlockSourceRevision: null, revisionRelationship: 'no_unlock_page_match' },
    sourceContexts: {
      renderedEvidence: { requestedTitles: [identity.resolvedTitle], namespaceIds: [namespaceId], guideObservationCount: observations.length, observations, sourcePresenceCounts: {}, targetPageIdentity: identity },
      unlockEvidence: null,
      crossSourcePageIdentityEstablished: false,
      revisionRelationship: 'no_unlock_page_match',
      semanticRoutingState: 'rendered_stable_page_without_unlock_evidence'
    },
    skillKeys: [], statementKeys: [], queuedForSemanticReview: false, activityDiscoveryCandidate: false,
    reviewStatus: 'not_queued', canonicalGameEntityIdentity: null, canonicalActivityIdentity: null,
    repeatabilityClassification: null, optimizerEligible: false, sourceCrosswalkContentHash: hash(`crosswalk:${ordinal}`),
    accountIndependent: true, blockers: ['exact_cross_source_page_identity_not_established'], state: 'blocked'
  });
}

function queueRecord(ordinal, candidateRecord, provenancePartition, namespaceId) {
  const rendered = candidateRecord.sourceContexts.renderedEvidence;
  const bindings = guideBindings(rendered.observations);
  return withBothHashes({
    contract: policy.queueInputContract,
    workQueueEntryKey: `queue:${ordinal}`,
    queueOrdinal: ordinal,
    partitionOrdinal: ordinal,
    provenancePartition,
    renderedTargetKey: candidateRecord.renderedTargetKey,
    requestedTitles: rendered.requestedTitles,
    namespaceIds: rendered.namespaceIds,
    stableWikiPageIdentity: rendered.targetPageIdentity,
    sourceCandidateContentHash: candidateRecord.contentHash,
    sourceCandidateSnapshotContentHash: candidateSnapshotContentHash,
    guideObservationCount: rendered.observations.length,
    renderedObservationSetContentHash: hash(rendered.observations),
    guideSourceBindingCount: bindings.length,
    guideSourceBindingsContentHash: hash(bindings),
    historicalRenderedAttributionRequired: provenancePartition !== 'direct_source_only',
    semanticDisposition: null, unlockEvidencePresent: false, canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null, repeatabilityClassification: null, mechanicsReviewComplete: false,
    optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['source_scoped_semantic_relevance_disposition_pending'], state: 'evidence_work_pending'
  });
}

function signatureRecord(queue, namespaceId) {
  const identity = queue.stableWikiPageIdentity;
  const base = {
    contract: policy.signatureContract,
    signatureKey: `${queue.workQueueEntryKey}|target-source-signature`,
    sourceWorkQueueEntryKey: queue.workQueueEntryKey,
    sourceWorkQueueEntryContentHash: queue.contentHash,
    sourceWorkQueueEntryIntrinsicContentHash: queue.recordContentHash,
    sourceWorkQueueSnapshotContentHash: queueSnapshotContentHash,
    queueOrdinal: queue.queueOrdinal,
    partitionOrdinal: queue.partitionOrdinal,
    provenancePartition: queue.provenancePartition,
    renderedTargetKey: queue.renderedTargetKey,
    requestedTitles: queue.requestedTitles,
    observedNamespaceIds: queue.namespaceIds,
    sourcePageId: identity.sourcePageId,
    sourceNamespaceId: namespaceId,
    resolvedTitle: identity.resolvedTitle,
    sourceRevision: identity.sourceRevision,
    sourceTimestamp: identity.sourceTimestamp,
    sourceUrl: identity.sourceUrl,
    sourceContentHash: hash(`source:${queue.queueOrdinal}`),
    sourceContentBytes: 1000 + queue.queueOrdinal,
    sourceLineCount: 10 + queue.queueOrdinal,
    revisionAlignment: { queueEntryOuterHashValid: true, queueEntryIntrinsicHashValid: true, fetchedPageIdMatches: true, fetchedRevisionMatches: true, fetchedTimestampMatches: true, fetchedTitleMatches: true, fetchedNamespaceObserved: true, fetchedContentPresent: true, sourceUrlRetained: true },
    rootTemplateEvidence: [{ template: `Infobox ${queue.queueOrdinal}`, line: 1 }],
    directCategoryEvidence: [{ category: `Category ${queue.queueOrdinal}`, line: 2 }],
    leadParagraphEvidence: [{ line: 3, text: `Lead ${queue.queueOrdinal}` }],
    headingEvidence: [{ line: 4, level: 2, text: `Heading ${queue.queueOrdinal}` }],
    sourceScopedSemanticRelevanceReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
    unlockEvidencePresent: false, canonicalGameEntityIdentity: null, canonicalActivityIdentity: null,
    repeatabilityClassification: null, mechanicsReviewComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['source_scoped_semantic_relevance_disposition_pending'], state: 'source_signature_captured_semantic_relevance_pending'
  };
  return withBothHashes(base);
}

const specs = [
  { ordinal: 1, partition: 'direct_source_only', namespace: 0 },
  { ordinal: 2, partition: 'rendered_only_origin_unattributed', namespace: 0 },
  { ordinal: 3, partition: 'mixed_direct_and_unattributed_rendered', namespace: 6 }
];
const matchedCandidates = specs.map(row => candidate(row.ordinal, row.partition, row.namespace));
const queueRecords = specs.map((row, index) => queueRecord(row.ordinal, matchedCandidates[index], row.partition, row.namespace));
const signatureRecords = specs.map((row, index) => signatureRecord(queueRecords[index], row.namespace));
const unrelatedCandidate = withOuterHash({ contract: policy.candidateContract, candidateKind: 'typed_non_activity', accountIndependent: true });
const candidateRecords = [unrelatedCandidate, matchedCandidates[2], matchedCandidates[0], matchedCandidates[1]];
const source = { signatureRecords, queueRecords, candidateRecords, policy, signatureSnapshotContentHash, queueSnapshotContentHash, candidateSnapshotContentHash, contentHash: hash };
const cloneSource = () => ({ ...structuredClone(without(source, 'contentHash')), contentHash: hash });

test('policy and contracts describe a generic fail-closed source-scoped review queue', () => {
  const compiled = compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy(policy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'relevant' };
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy(specific, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy(automatic, hash).valid, false);
  assert.equal(auditContract.rules.signatureAndQueueSetsMustMatchExactlyAndEveryQueueCandidateMustResolveExactlyOnce, true);
});

test('exports every bound signature once in deterministic source-neutral priority order', () => {
  const built = buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(source);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.queueExportComplete, true);
  assert.equal(built.audit.semanticRelevanceReviewComplete, false);
  assert.equal(built.records.length, 3);
  assert.deepEqual(built.records.map(row => row.sourceQueueOrdinal), [1, 2, 3]);
  assert.deepEqual(built.records.map(row => row.reviewPriority.band), [1, 3, 5]);
  assert.equal(built.audit.inputCoverage.candidateInventoryRecordCount, 4);
  assert.equal(built.audit.inputCoverage.matchedCandidateRecordCount, 3);
  for (const field of entryContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing queue entry field ${field}`);
  for (const field of templateContract.required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing decision-template field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('preserves exact guide observations, source structure, and blank review artifacts', () => {
  const built = buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(source);
  const first = built.records[0];
  assert.deepEqual(first.retainedGuideContexts, matchedCandidates[0].sourceContexts.renderedEvidence);
  assert.deepEqual(first.structuralEvidence.rootTemplates, signatureRecords[0].rootTemplateEvidence);
  assert.equal(built.audit.contextPreservationCoverage.retainedGuideObservationCount, 5);
  assert.equal(built.audit.contextPreservationCoverage.exactContextPreservation, true);
  assert.equal(built.audit.semanticPreservationCoverage.semanticDispositionCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.decidedTemplateCount, 0);
  assert.equal(built.reviewIndexTsv, renderRenderedPageWithoutUnlockSemanticRelevanceReviewIndex(built.records));
  assert.equal(built.decisionTemplateNdjson, serializeRenderedPageWithoutUnlockSemanticRelevanceDecisionTemplates(built.decisionTemplates));
  assert.match(built.reviewIndexTsv, /Training guide 10/);
});

test('records and artifacts are deterministic when all three input arrays are reordered', () => {
  const changed = cloneSource();
  changed.signatureRecords.reverse(); changed.queueRecords.reverse(); changed.candidateRecords.reverse();
  assert.deepEqual(buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(changed), buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(source));
});

for (const [name, mutate] of [
  ['signature hash drift', value => { value.signatureRecords[0].contentHash = '0'.repeat(64); }],
  ['queue intrinsic hash drift', value => { value.queueRecords[0].recordContentHash = '0'.repeat(64); }],
  ['candidate identity drift', value => { value.candidateRecords.find(row => row.candidateKind === 'rendered_page_without_unlock_match').contentHash = '0'.repeat(64); }],
  ['unknown provenance partition', value => {
    const queue = value.queueRecords[0]; queue.provenancePartition = 'unknown';
    queue.recordContentHash = hash(without(queue, 'contentHash', 'recordContentHash')); queue.contentHash = hash(without(queue, 'contentHash'));
    const signature = value.signatureRecords[0]; signature.provenancePartition = 'unknown'; signature.sourceWorkQueueEntryContentHash = queue.contentHash; signature.sourceWorkQueueEntryIntrinsicContentHash = queue.recordContentHash;
    signature.recordContentHash = hash(without(signature, 'contentHash', 'recordContentHash')); signature.contentHash = hash(without(signature, 'contentHash'));
  }]
]) test(`fails atomically on ${name}`, () => {
  const changed = cloneSource(); mutate(changed);
  const built = buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(changed);
  assert.equal(built.audit.publishable, false);
  assert.deepEqual(built.records, []);
  assert.equal(built.reviewIndexTsv, '');
});

test('standalone audit rejects lost context, semantic promotion, and account state', () => {
  const built = buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(source);
  const changed = structuredClone(built.records);
  changed[0].retainedGuideContexts.observations.pop();
  changed[0].semanticDisposition = policy.allowedDispositions[0];
  changed[0].optimizerEligible = true;
  changed[0].accountLevel = 34;
  changed[0].recordContentHash = hash(without(changed[0], 'recordContentHash'));
  const audit = auditRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(changed, {
    ...source,
    decisionTemplates: built.decisionTemplates,
    reviewIndexTsv: renderRenderedPageWithoutUnlockSemanticRelevanceReviewIndex(changed),
    decisionTemplateNdjson: built.decisionTemplateNdjson
  });
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('one_or_more_review_queue_records_do_not_match_bound_inputs'));
  assert.ok(audit.blockers.includes('queue_export_created_review_semantic_or_optimizer_promotion'));
  assert.ok(audit.blockers.includes('current_account_state_present'));
});

test('CLI rejects a corrupt population snapshot without writing an output queue', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-semantic-relevance-queue-'));
  try {
    const directory = path.join(root, '2026-09-06T02-00-00-000Z'); fs.mkdirSync(directory, { recursive: true });
    const raw = `${JSON.stringify(signatureRecords[0])}\n`;
    fs.writeFileSync(path.join(directory, 'cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ contract: 'sensum.ingestion-manifest.v1', domain: 'cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population', records: 1, contentHash: '0'.repeat(64), source: {} }));
    const command = spawnSync(process.execPath, ['platform/transforms/export-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(command.status, 0);
    assert.match(command.stderr, /No valid complete rendered-page\/no-unlock target source-signature population exists/);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, `${outputDomain}.ndjson`))).length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill rendered-page/no-unlock source-scoped semantic-relevance work-queue export checks passed.');
