import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityCandidatePriorityHumanReviewDecisionGuidance,
  buildActivityCandidatePriorityHumanReviewDecisionGuidance,
  compileActivityCandidatePriorityHumanReviewDecisionGuidancePolicy
} from '../transforms/activity-candidate-priority-human-review-decision-guidance-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-decision-guidance-v1.json', 'utf8'));
const packetPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-decision-import-v1.json', 'utf8'));
const guidanceContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-human-review-decision-guidance-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-human-review-decision-guidance-audit-v1.json', 'utf8'));
const packetCreatedAt = '2026-09-06T04:06:25.989Z';
const json = value => JSON.stringify(value);
const withContentHash = base => ({ ...base, contentHash: hash(base) });

function packetRecord(ordinal = 1, conflict = false) {
  const candidateKey = `osrs-wiki-pageid:${100 + ordinal}`;
  const reviewPacketKey = `${candidateKey}|priority-activity-human-review-packet`;
  const sourceRevision = String(500 + ordinal);
  const sourceTimestamp = '2026-09-01T00:00:00Z';
  const sourceContentHash = hash(`source:${ordinal}`);
  const discoveryEvidence = withContentHash({
    contract: 'sensum.cross-source-entity-activity-candidate.v1', candidateKey,
    sourceContexts: { renderedEvidence: { observations: [{ guideRevision: String(700 + ordinal), parserObservedAt: '2026-09-03T00:00:00Z' }] } },
    activityDiscoveryCandidate: true, accountIndependent: true
  });
  const sourceEvidence = withContentHash({
    contract: 'sensum.activity-candidate-source-evidence.v1', candidateKey, sourcePageId: 100 + ordinal,
    resolvedTitle: `Activity ${ordinal}`, sourceRevision, sourceTimestamp,
    sourceUrl: `https://oldschool.runescape.wiki/w/Activity_${ordinal}`, sourceContentHash,
    sourceCandidateContentHash: discoveryEvidence.contentHash, accountIndependent: true
  });
  const subjectDisposition = conflict
    ? { state: 'blocked_conflicting_source_declarations', disposition: null, conflictingDispositions: ['activity_subject', 'minigame_subject'] }
    : { state: 'source_supported', disposition: 'activity_subject', conflictingDispositions: [] };
  const subjectAssessment = withContentHash({
    contract: 'sensum.activity-candidate-subject-disposition.v1', candidateKey, sourcePageId: sourceEvidence.sourcePageId,
    sourceRevision, sourceTimestamp, sourceContentHash, sourceEvidenceContentHash: sourceEvidence.contentHash,
    subjectDisposition, accountIndependent: true
  });
  const workRoute = withContentHash({
    contract: 'sensum.activity-candidate-evidence-work-routing.v1', candidateKey, sourcePageId: sourceEvidence.sourcePageId,
    sourceRevision, sourceTimestamp, sourceContentHash, sourceDispositionContentHash: subjectAssessment.contentHash,
    sourceDisposition: subjectDisposition,
    routingDecision: {
      routeKey: conflict ? 'source_declaration_conflict_review' : 'activity_action_and_variant_review',
      routeState: conflict ? 'blocked_source_conflict' : 'queued_evidence_work',
      requiredEvidenceDomains: conflict ? ['field_semantics', 'source_declaration_reconciliation'] : ['mechanics', 'repeatability']
    }, accountIndependent: true
  });
  const domains = [...workRoute.routingDecision.requiredEvidenceDomains].sort();
  const decisionTemplate = {
    contract: decisionPolicy.submissionContract, reviewPacketKey, candidateKey,
    subjectDispositionDecision: null, selectedSourceDisposition: null,
    canonicalGameEntityIdentityDecision: null, canonicalGameEntityIdentity: null,
    canonicalActivityIdentityDecision: null, canonicalActivityIdentity: null,
    repeatabilityDecision: null, atomicityDecision: null, memberExpansionDecision: null, memberKeys: [],
    evidenceDomainAssessments: domains.map(domain => ({ domain, status: null, evidenceKeys: [], notes: null })),
    reviewEvidenceKeys: [], reviewedSourceRevisions: [], reviewer: null, reviewedAt: null, reviewNotes: null
  };
  const base = {
    contract: packetPolicy.packetContract, reviewPacketKey, packetOrdinal: ordinal,
    batchOrdinal: Math.floor((ordinal - 1) / packetPolicy.batchSize) + 1,
    batchItemOrdinal: ((ordinal - 1) % packetPolicy.batchSize) + 1, candidateKey,
    sourcePageIdentity: {
      sourcePageId: sourceEvidence.sourcePageId, resolvedTitle: sourceEvidence.resolvedTitle, sourceRevision,
      sourceTimestamp, sourceUrl: sourceEvidence.sourceUrl, sourceContentHash, sourceContentBytes: 1000
    },
    sourceExactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${sourceRevision}`,
    pipelineBindings: {
      candidateContentHash: discoveryEvidence.contentHash, sourceEvidenceContentHash: sourceEvidence.contentHash,
      subjectDispositionContentHash: subjectAssessment.contentHash, workRoutingContentHash: workRoute.contentHash
    },
    discoveryEvidence, sourceEvidence, subjectAssessment, workRoute,
    reviewPriority: { band: conflict ? 1 : 2, reason: conflict ? 'source_conflict' : 'priority_review' },
    reviewObligations: { requiredEvidenceDomains: domains }, decisionTemplate,
    explicitNonClaims: ['optimizer_eligibility_is_not_established'], decisionRecorded: false,
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    atomicityClassification: null, memberExpansionReviewed: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['explicit_human_activity_candidate_review_pending'],
    state: conflict ? decisionPolicy.packetStates[0] : decisionPolicy.packetStates[1]
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function packetBundle(count = 6) {
  const records = Array.from({ length: count }, (_, index) => packetRecord(index + 1, index === 0));
  const raw = records.map(json).join('\n') + '\n';
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: policy.inputDomain, createdAt: packetCreatedAt,
    records: records.length, contentHash: hash(raw), source: {
      policy: { id: policy.inputPacketPolicy, contentHash: policy.inputPacketPolicyContentHash },
      audit: {
        packetConsolidationComplete: true, humanReviewComplete: false,
        requirementsVariantsXpTimingAndMechanicsComplete: false, completeActivityUniverse: false, publishable: true,
        packetCoverage: { packetCount: records.length, completePacketCount: records.length, packetMismatchCandidateKeys: [] },
        semanticPreservationCoverage: {
          nonBlankDecisionCandidateKeys: [], canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0,
          repeatabilityClassificationCount: 0, atomicityClassificationCount: 0, memberExpansionReviewedCount: 0,
          requirementsVariantsXpTimingAndMechanicsCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0
        }
      }
    }
  };
  return { records, raw, manifest, snapshot: { directory: 'packet-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function build(bundle, overrides = {}) {
  return buildActivityCandidatePriorityHumanReviewDecisionGuidance({
    packetRecords: bundle.records, packetRaw: bundle.raw, packetManifest: bundle.manifest,
    packetSnapshot: bundle.snapshot, policy, packetPolicy, decisionPolicy, contentHash: hash, ...overrides
  });
}

test('guidance policy is generic and exactly bound to packet and importer policies', () => {
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionGuidancePolicy(policy, packetPolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'choose confirmed' };
  assert.equal(compileActivityCandidatePriorityHumanReviewDecisionGuidancePolicy(specific, packetPolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileActivityCandidatePriorityHumanReviewDecisionGuidancePolicy(automatic, packetPolicy, decisionPolicy, hash).valid, false);
});

test('materializes exact fill guidance while leaving every decision field untouched', () => {
  const bundle = packetBundle(6);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.guidanceMaterializationComplete, true);
  assert.equal(result.audit.humanReviewComplete, false);
  assert.equal(result.records.length, 6);
  assert.equal(result.records[0].sourceDispositionOptions.length, 2);
  assert.equal(result.records[0].requiredReviewEvidenceKeys.length, 7);
  assert.deepEqual(result.records[0].requiredReviewedSourceRevisions, ['501', '701']);
  assert.equal(result.records[0].earliestAllowedReviewedAt, packetCreatedAt);
  assert.equal(result.records[0].coherencePaths.every(row => row.selected === false), true);
  assert.deepEqual(result.records[0].blankDecisionTemplate, bundle.records[0].decisionTemplate);
  assert.equal(result.records[0].humanDecisionSelected, false);
  assert.equal(result.records[0].optimizerEligible, false);
  assert.equal(result.audit.artifactCoverage.batchCount, 2);
  assert.equal(result.audit.artifactCoverage.artifactManifestEntryCount, 6);
  assert.equal(result.audit.semanticPreservationCoverage.decisionRecordedCount, 0);
  for (const field of guidanceContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing guidance field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('batch decision artifacts exactly reproduce the packet blank templates', () => {
  const bundle = packetBundle(6);
  const result = build(bundle);
  const artifactRows = result.artifacts.batches.flatMap(batch => batch.decisionNdjson.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse));
  assert.deepEqual(artifactRows, bundle.records.map(row => row.decisionTemplate));
  assert.equal(result.artifacts.batches[0].recordCount, 5);
  assert.equal(result.artifacts.batches[1].recordCount, 1);
});

test('identical packet snapshots reproduce identical records and artifacts', () => {
  const bundle = packetBundle(6);
  const first = build(bundle);
  const second = build(structuredClone(bundle));
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.artifacts), hash(second.artifacts));
  assert.equal(hash(first.audit), hash(second.audit));
});

test('fails closed on packet tamper, manifest drift, implicit selection, or account state', () => {
  const bundle = packetBundle(2);
  const changedRecords = structuredClone(bundle.records); changedRecords[0].pipelineBindings.candidateContentHash = '0'.repeat(64);
  assert.equal(build(bundle, { packetRecords: changedRecords }).audit.publishable, false);
  const changedManifest = structuredClone(bundle.manifest); changedManifest.contentHash = hash('changed');
  assert.equal(build(bundle, { packetManifest: changedManifest }).audit.publishable, false);
  assert.equal(build(bundle, { packetSnapshot: { ...bundle.snapshot, explicit: false } }).audit.publishable, false);
  const accountRecords = structuredClone(bundle.records); accountRecords[0].currentBaseLevel = 34;
  assert.equal(build(bundle, { packetRecords: accountRecords }).audit.publishable, false);
});

test('independent audit rejects selected decisions, projection changes, and artifact drift', () => {
  const bundle = packetBundle(2);
  const result = build(bundle);
  const changed = structuredClone(result.records);
  changed[0].humanDecisionSelected = true;
  changed[0].canonicalActivityIdentityProjection.sourceRevision = '999';
  const artifacts = structuredClone(result.artifacts);
  artifacts.batches[0].markdown += 'changed';
  const audit = auditActivityCandidatePriorityHumanReviewDecisionGuidance(changed, {
    packetRecords: bundle.records, packetRaw: bundle.raw, packetManifest: bundle.manifest,
    packetSnapshot: bundle.snapshot, policy, packetPolicy, decisionPolicy, artifacts, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.bindingCoverage.identityProjectionMismatchGuidanceKeys.length, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
  assert.equal(audit.artifactCoverage.artifactMismatches.length > 0, true);
});

test('CLI requires explicit input and writes the complete synthetic guidance bundle', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-priority-activity-guidance-'));
  try {
    let command = spawnSync(process.execPath, ['platform/transforms/materialize-activity-candidate-priority-human-review-decision-guidance.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    const bundle = packetBundle(6);
    const target = path.join(root, bundle.snapshot.directory); fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, `${policy.inputDomain}.ndjson`), bundle.raw);
    fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n');
    command = spawnSync(process.execPath, [
      'platform/transforms/materialize-activity-candidate-priority-human-review-decision-guidance.mjs',
      `--root=${root}`, `--packet-snapshot=${bundle.snapshot.directory}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, true);
    assert.equal(output.coverage.guidanceRecordCount, 6);
    assert.equal(output.coverage.batchCount, 2);
    const outputDirectory = path.join(root, output.outputSnapshot.directory);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'artifact-manifest.json')), true);
    assert.equal(fs.readdirSync(path.join(outputDirectory, 'batches')).length, 6);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Activity candidate priority human review decision guidance checks passed.');
