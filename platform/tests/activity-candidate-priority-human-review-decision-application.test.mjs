import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityCandidatePriorityHumanReviewDecisionApplications,
  buildActivityCandidatePriorityHumanReviewDecisionApplications,
  compileActivityCandidatePriorityHumanReviewDecisionApplicationPolicy
} from '../transforms/activity-candidate-priority-human-review-decision-application-lib.mjs';
import {
  boundSourceRevisionsForActivityCandidatePriorityPacket,
  buildActivityCandidatePriorityHumanReviewDecisionImport,
  canonicalActivityIdentityProposalForActivityCandidatePriorityPacket,
  canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket,
  requiredReviewEvidenceKeysForActivityCandidatePriorityPacket
} from '../transforms/activity-candidate-priority-human-review-decision-import-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-decision-application-v1.json', 'utf8'));
const packetPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-human-review-decision-application-record-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-human-review-decision-application-audit-v1.json', 'utf8'));
const packetCreatedAt = '2026-09-06T04:06:25.989Z';
const decisionCreatedAt = '2026-09-06T06:00:00.000Z';
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
    contract: 'sensum.activity-candidate-subject-disposition.v1', candidateKey,
    sourcePageId: sourceEvidence.sourcePageId, sourceRevision, sourceTimestamp, sourceContentHash,
    sourceEvidenceContentHash: sourceEvidence.contentHash, subjectDisposition, accountIndependent: true
  });
  const workRoute = withContentHash({
    contract: 'sensum.activity-candidate-evidence-work-routing.v1', candidateKey,
    sourcePageId: sourceEvidence.sourcePageId, sourceRevision, sourceTimestamp, sourceContentHash,
    sourceDispositionContentHash: subjectAssessment.contentHash, sourceDisposition: subjectDisposition,
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
      sourcePageId: sourceEvidence.sourcePageId, resolvedTitle: sourceEvidence.resolvedTitle,
      sourceRevision, sourceTimestamp, sourceUrl: sourceEvidence.sourceUrl, sourceContentHash, sourceContentBytes: 1000
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

function packetBundle(packets) {
  const raw = packets.map(json).join('\n') + '\n';
  const conflicts = packets.filter(row => row.state === decisionPolicy.packetStates[0]).length;
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: 'activity-candidate-priority-human-review-packet',
    createdAt: packetCreatedAt, records: packets.length, contentHash: hash(raw),
    source: { policy: { id: policy.inputPacketPolicy, contentHash: policy.inputPacketPolicyContentHash }, audit: {
      packetConsolidationComplete: true, humanReviewComplete: false,
      requirementsVariantsXpTimingAndMechanicsComplete: false, completeActivityUniverse: false, publishable: true,
      packetCoverage: { packetCount: packets.length, completePacketCount: packets.length, packetMismatchCandidateKeys: [], sourceConflictPacketCount: conflicts },
      semanticPreservationCoverage: {
        nonBlankDecisionCandidateKeys: [], canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0,
        repeatabilityClassificationCount: 0, atomicityClassificationCount: 0, memberExpansionReviewedCount: 0,
        requirementsVariantsXpTimingAndMechanicsCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0
      }
    } }
  };
  return { raw, manifest, snapshot: { directory: 'packet-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function submission(packet, mode = 'confirmed') {
  const evidenceKeys = requiredReviewEvidenceKeysForActivityCandidatePriorityPacket(packet);
  const confirmed = mode === 'confirmed' || mode === 'composite';
  const rejected = mode === 'rejected';
  const status = mode === 'additional' ? 'additional_evidence_required'
    : rejected ? 'not_supported_by_bound_evidence' : 'supported_by_bound_evidence';
  return {
    ...structuredClone(packet.decisionTemplate),
    subjectDispositionDecision: confirmed ? 'confirm_one_bound_source_disposition' : rejected ? 'reject_all_bound_source_dispositions' : 'additional_evidence_required',
    selectedSourceDisposition: confirmed
      ? (packet.subjectAssessment.subjectDisposition.disposition || packet.subjectAssessment.subjectDisposition.conflictingDispositions[0]) : null,
    canonicalGameEntityIdentityDecision: confirmed ? 'confirm_bound_source_page_subject_identity' : rejected ? 'reject_bound_source_page_subject_identity' : 'additional_evidence_required',
    canonicalGameEntityIdentity: confirmed ? canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket(packet) : null,
    canonicalActivityIdentityDecision: confirmed ? 'confirm_bound_source_subject_as_activity_container' : rejected ? 'reject_bound_source_subject_as_activity_container' : 'additional_evidence_required',
    canonicalActivityIdentity: confirmed ? canonicalActivityIdentityProposalForActivityCandidatePriorityPacket(packet) : null,
    repeatabilityDecision: mode === 'composite' ? 'composite_or_collection_requires_expansion' : confirmed ? 'repeatable_activity' : rejected ? 'non_repeatable_subject' : 'additional_evidence_required',
    atomicityDecision: mode === 'composite' ? 'composite_activity_subject' : confirmed ? 'atomic_activity_subject' : rejected ? 'not_applicable_non_repeatable_subject' : 'additional_evidence_required',
    memberExpansionDecision: mode === 'composite' ? 'required_for_composite_subject' : confirmed ? 'not_required_atomic_subject' : rejected ? 'not_applicable_non_repeatable_subject' : 'additional_evidence_required',
    evidenceDomainAssessments: packet.decisionTemplate.evidenceDomainAssessments.map(item => ({
      domain: item.domain, status, evidenceKeys: [evidenceKeys[0]], notes: `Reviewed ${item.domain} against the exact packet evidence.`
    })),
    reviewEvidenceKeys: evidenceKeys,
    reviewedSourceRevisions: boundSourceRevisionsForActivityCandidatePriorityPacket(packet),
    reviewer: 'Human Reviewer', reviewedAt: '2026-09-06T05:00:00.000Z',
    reviewNotes: `Completed explicit ${mode} review against every packet binding and required evidence domain.`
  };
}

function decisionBundle(packets, packet, modes) {
  const submissions = modes.map((mode, index) => submission(packets[index], mode));
  const imported = buildActivityCandidatePriorityHumanReviewDecisionImport({
    packetRecords: packets, submissions, policy: decisionPolicy,
    packetSnapshotContentHash: packet.snapshot.contentHash, packetSnapshotCreatedAt: packet.snapshot.createdAt
  });
  assert.equal(imported.audit.publishable, true);
  const records = imported.records.map(record => ({ ...record, contentHash: hash(record) }));
  const raw = records.map(json).join('\n') + '\n';
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: 'activity-candidate-priority-human-review-decisions',
    createdAt: decisionCreatedAt, records: records.length, contentHash: hash(raw),
    source: {
      policy: { id: policy.inputDecisionImportPolicy, contentHash: policy.inputDecisionImportPolicyContentHash },
      packetPolicy: { id: policy.inputPacketPolicy, contentHash: policy.inputPacketPolicyContentHash },
      inputSnapshot: { directory: packet.snapshot.directory, contentHash: packet.snapshot.contentHash, createdAt: packet.snapshot.createdAt },
      audit: imported.audit
    }
  };
  return { records, raw, manifest, snapshot: { directory: 'decision-snapshot', contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function fixture(modes, conflicts = []) {
  const packets = modes.map((_, index) => packetRecord(index + 1, conflicts.includes(index + 1)));
  const packet = packetBundle(packets);
  const decisions = decisionBundle(packets, packet, modes);
  return { packets, packet, decisions };
}

function build(bundle, overrides = {}) {
  return buildActivityCandidatePriorityHumanReviewDecisionApplications({
    packetRecords: bundle.packets, packetRaw: bundle.packet.raw, packetManifest: bundle.packet.manifest,
    packetSnapshot: bundle.packet.snapshot, decisionRecords: bundle.decisions.records,
    decisionRaw: bundle.decisions.raw, decisionManifest: bundle.decisions.manifest,
    decisionSnapshot: bundle.decisions.snapshot, policy, packetPolicy, decisionPolicy, contentHash: hash, ...overrides
  });
}

test('application policy is generic, policy-bound, and cannot automatically verify', () => {
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionApplicationPolicy(policy, packetPolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'apply' };
  assert.equal(compileActivityCandidatePriorityHumanReviewDecisionApplicationPolicy(specific, packetPolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileActivityCandidatePriorityHumanReviewDecisionApplicationPolicy(automatic, packetPolicy, decisionPolicy, hash).valid, false);
});

test('applies only exact confirmed review conclusions and keeps downstream gates closed', () => {
  const bundle = fixture(['confirmed'], [1]);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.applicationBatchComplete, true);
  assert.equal(result.audit.priorityActivityHumanReviewApplicationComplete, true);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assert.equal(record.appliedSubjectDisposition, 'activity_subject');
  assert.deepEqual(record.canonicalGameEntityIdentity, bundle.decisions.records[0].reviewedCanonicalGameEntityIdentityProposal);
  assert.deepEqual(record.canonicalActivityIdentity, bundle.decisions.records[0].reviewedCanonicalActivityIdentityProposal);
  assert.equal(record.repeatabilityClassification, 'repeatable_activity');
  assert.equal(record.atomicityClassification, 'atomic_activity_subject');
  assert.equal(record.sourceConflictResolved, true);
  assert.equal(record.memberExpansionApplied, false);
  assert.equal(record.requirementsVariantsXpTimingAndMechanicsComplete, false);
  assert.equal(record.optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing application field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('applies a narrow rejection and leaves additional-evidence review unresolved', () => {
  const bundle = fixture(['rejected', 'additional'], [2]);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.priorityActivityHumanReviewApplicationComplete, false);
  assert.equal(result.records[0].authoritativeExclusionApplied, true);
  assert.equal(result.records[0].canonicalActivityIdentity, null);
  assert.equal(result.records[1].candidateSemanticReviewComplete, false);
  assert.equal(result.records[1].sourceConflictResolved, false);
  assert.equal(result.audit.applicationCoverage.authoritativeExclusionCount, 1);
  assert.equal(result.audit.applicationCoverage.additionalEvidenceBlockedCount, 1);
});

test('records that composite expansion is required without creating member identities', () => {
  const bundle = fixture(['composite']);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records[0].memberExpansionRequired, true);
  assert.deepEqual(result.records[0].memberKeys, []);
  assert.equal(result.records[0].memberExpansionApplied, false);
  assert.equal(result.records[0].memberUniverseComplete, false);
  assert.ok(result.audit.blockers.includes('one_or_more_priority_activity_member_expansions_remain_pending'));
});

test('allows a valid partial decision set but never calls all priority review complete', () => {
  const packets = [packetRecord(1), packetRecord(2)];
  const packet = packetBundle(packets);
  const decisions = decisionBundle(packets, packet, ['confirmed']);
  const result = build({ packets, packet, decisions });
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.decisionCoverage.missingDecisionCount, 1);
  assert.equal(result.audit.priorityActivityHumanReviewApplicationComplete, false);
});

test('identical selected snapshots reproduce identical applications and audit', () => {
  const bundle = fixture(['confirmed', 'rejected', 'additional', 'composite'], [3]);
  const first = build(bundle);
  const second = build(structuredClone(bundle));
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.audit), hash(second.audit));
});

test('fails closed on implicit selection, record drift, manifest drift, packet mismatch, or account state', () => {
  const bundle = fixture(['confirmed']);
  assert.equal(build(bundle, { decisionSnapshot: { ...bundle.decisions.snapshot, explicit: false } }).audit.publishable, false);
  const changedDecisions = structuredClone(bundle.decisions.records); changedDecisions[0].reviewNotes = 'Changed after import';
  assert.equal(build(bundle, { decisionRecords: changedDecisions }).audit.publishable, false);
  const changedManifest = structuredClone(bundle.decisions.manifest); changedManifest.source.inputSnapshot.contentHash = hash('other packet');
  assert.equal(build(bundle, { decisionManifest: changedManifest }).audit.publishable, false);
  const changedPackets = structuredClone(bundle.packets); changedPackets[0].sourcePageIdentity.resolvedTitle = 'Changed';
  assert.equal(build(bundle, { packetRecords: changedPackets }).audit.publishable, false);
  const accountDecisions = structuredClone(bundle.decisions.records); accountDecisions[0].currentBaseLevel = 34;
  assert.equal(build(bundle, { decisionRecords: accountDecisions }).audit.publishable, false);
});

test('independent audit rejects changed conclusions and forbidden downstream promotion', () => {
  const bundle = fixture(['confirmed']);
  const result = build(bundle);
  const changed = structuredClone(result.records);
  changed[0].canonicalActivityIdentity.sourceRevision = '999';
  changed[0].memberKeys = ['invented-member'];
  changed[0].memberExpansionApplied = true;
  changed[0].optimizerEligible = true;
  changed[0].recordContentHash = hash(Object.fromEntries(Object.entries(changed[0]).filter(([key]) => key !== 'recordContentHash')));
  const audit = auditActivityCandidatePriorityHumanReviewDecisionApplications(changed, {
    packetRecords: bundle.packets, packetRaw: bundle.packet.raw, packetManifest: bundle.packet.manifest,
    packetSnapshot: bundle.packet.snapshot, decisionRecords: bundle.decisions.records,
    decisionRaw: bundle.decisions.raw, decisionManifest: bundle.decisions.manifest,
    decisionSnapshot: bundle.decisions.snapshot, policy, packetPolicy, decisionPolicy, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.applicationCoverage.recordMismatches.length, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI requires both explicit snapshots and writes only a valid selected application', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-priority-activity-application-'));
  try {
    let command = spawnSync(process.execPath, ['platform/transforms/apply-activity-candidate-priority-human-review-decisions.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    const bundle = fixture(['confirmed']);
    for (const [directory, domain, raw, manifest] of [
      [bundle.packet.snapshot.directory, 'activity-candidate-priority-human-review-packet', bundle.packet.raw, bundle.packet.manifest],
      [bundle.decisions.snapshot.directory, 'activity-candidate-priority-human-review-decisions', bundle.decisions.raw, bundle.decisions.manifest]
    ]) {
      const target = path.join(root, directory); fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, `${domain}.ndjson`), raw);
      fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    command = spawnSync(process.execPath, [
      'platform/transforms/apply-activity-candidate-priority-human-review-decisions.mjs', `--root=${root}`,
      `--packet-snapshot=${bundle.packet.snapshot.directory}`, `--decision-snapshot=${bundle.decisions.snapshot.directory}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const output = JSON.parse(command.stdout);
    assert.equal(output.accepted, true);
    assert.equal(output.coverage.appliedCandidateScopeCount, 1);
    const rows = fs.readFileSync(path.join(root, output.outputSnapshot.directory, 'activity-candidate-priority-human-review-decision-applications.ndjson'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].semanticReviewApplicationApplied, true);
    assert.equal(rows[0].optimizerEligible, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Activity candidate priority human review decision application checks passed.');
