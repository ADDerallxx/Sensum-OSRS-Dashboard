import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import { buildActivityCandidatePrioritySourceConflictAdditionalEvidence } from '../ingestion/activity-candidate-priority-source-conflict-additional-evidence-lib.mjs';
import {
  boundSourceRevisionsForActivityCandidatePriorityPacket,
  canonicalActivityIdentityProposalForActivityCandidatePriorityPacket,
  canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket,
  requiredReviewEvidenceKeysForActivityCandidatePriorityPacket
} from '../transforms/activity-candidate-priority-human-review-decision-import-lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionGuidance } from '../transforms/activity-candidate-priority-human-review-decision-guidance-lib.mjs';
import { buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance } from '../transforms/activity-candidate-priority-source-conflict-augmented-human-review-guidance-lib.mjs';
import {
  auditActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence,
  buildActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence,
  buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplate,
  compileActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidencePolicy,
  requiredSupplementalReviewRevisionsForActivityCandidatePriorityConflict
} from '../transforms/activity-candidate-priority-human-review-decision-import-supplemental-evidence-lib.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = read('platform/policies/activity-candidate-priority-human-review-decision-import-supplemental-evidence-v1.json');
const packetPolicy = read('platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json');
const guidancePolicy = read('platform/policies/activity-candidate-priority-human-review-decision-guidance-v1.json');
const evidencePolicy = read('platform/policies/activity-candidate-priority-source-conflict-additional-evidence-v1.json');
const augmentedPolicy = read('platform/policies/activity-candidate-priority-source-conflict-augmented-human-review-guidance-v1.json');
const decisionPolicy = read('platform/policies/activity-candidate-priority-human-review-decision-import-v1.json');
const recordContract = read('platform/contracts/activity-candidate-priority-human-review-decision-supplemental-evidence-bound-v1.json');
const auditContract = read('platform/contracts/activity-candidate-priority-human-review-decision-import-supplemental-evidence-audit-v1.json');
const times = {
  packet: '2026-09-06T04:06:25.989Z', guidance: '2026-09-06T04:52:24.012Z',
  evidence: '2026-09-06T05:09:09.828Z', augmented: '2026-09-06T05:26:04.562Z', reviewed: '2026-09-06T06:00:00Z'
};
const json = value => JSON.stringify(value);
const outer = record => ({ ...record, contentHash: hash(record) });
const candidateContents = new Map([
  ['Activity 1', "{{Infobox Activity\n|type = Minigame\n}}\n'''Activity 1''' is an Agility activity.\n"],
  ['Activity 2', "{{Infobox Activity\n|type = Minigame\n}}\n'''Activity 2''' is a Thieving activity.\n"]
]);

function packetRecord(ordinal) {
  const candidateKey = `osrs-wiki-pageid:${100 + ordinal}`;
  const reviewPacketKey = `${candidateKey}|priority-activity-human-review-packet`;
  const sourceRevision = String(500 + ordinal);
  const sourceTimestamp = '2026-09-01T00:00:00Z';
  const resolvedTitle = `Activity ${ordinal}`;
  const sourceContentHash = hash(candidateContents.get(resolvedTitle));
  const discoveryEvidence = outer({
    contract: 'sensum.cross-source-entity-activity-candidate.v1', candidateKey,
    sourceContexts: { renderedEvidence: { observations: [{ guideRevision: String(700 + ordinal), parserObservedAt: '2026-09-03T00:00:00Z' }] } },
    activityDiscoveryCandidate: true, accountIndependent: true
  });
  const sourceEvidence = outer({
    contract: 'sensum.activity-candidate-source-evidence.v1', candidateKey, sourcePageId: 100 + ordinal,
    resolvedTitle, sourceRevision, sourceTimestamp, sourceUrl: `https://oldschool.runescape.wiki/w/Activity_${ordinal}`,
    sourceContentHash, sourceCandidateContentHash: discoveryEvidence.contentHash, accountIndependent: true
  });
  const subjectDisposition = { state: 'blocked_conflicting_source_declarations', disposition: null, conflictingDispositions: ['activity_subject', 'minigame_subject'] };
  const subjectAssessment = outer({
    contract: 'sensum.activity-candidate-subject-disposition.v1', candidateKey, sourcePageId: 100 + ordinal,
    sourceRevision, sourceTimestamp, sourceContentHash, sourceEvidenceContentHash: sourceEvidence.contentHash,
    subjectDisposition,
    dispositionSignals: [
      { signalKey: 'infobox_type:minigame', disposition: 'minigame_subject', matchedText: 'Minigame', sourceLocator: { lineStart: 2, lineEnd: 2 } },
      { signalKey: 'lead_declares_activity_subject', disposition: 'activity_subject', matchedText: 'is an activity', sourceLocator: { lineStart: 4, lineEnd: 4 } }
    ], accountIndependent: true
  });
  const workRoute = outer({
    contract: 'sensum.activity-candidate-evidence-work-routing.v1', candidateKey, sourcePageId: 100 + ordinal,
    sourceRevision, sourceTimestamp, sourceContentHash, sourceDispositionContentHash: subjectAssessment.contentHash,
    sourceDisposition: subjectDisposition,
    routingDecision: { routeKey: 'source_declaration_conflict_review', routeState: 'blocked_source_conflict', requiredEvidenceDomains: ['field_semantics', 'source_declaration_reconciliation'] },
    accountIndependent: true
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
    contract: packetPolicy.packetContract, reviewPacketKey, packetOrdinal: ordinal, batchOrdinal: 1, batchItemOrdinal: ordinal, candidateKey,
    sourcePageIdentity: { sourcePageId: 100 + ordinal, resolvedTitle, sourceRevision, sourceTimestamp, sourceUrl: sourceEvidence.sourceUrl, sourceContentHash, sourceContentBytes: Buffer.byteLength(candidateContents.get(resolvedTitle)) },
    sourceExactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${sourceRevision}`,
    pipelineBindings: { candidateContentHash: discoveryEvidence.contentHash, sourceEvidenceContentHash: sourceEvidence.contentHash, subjectDispositionContentHash: subjectAssessment.contentHash, workRoutingContentHash: workRoute.contentHash },
    discoveryEvidence, sourceEvidence, subjectAssessment, workRoute,
    reviewPriority: { band: 1, reason: 'source_conflict' }, reviewObligations: { requiredEvidenceDomains: domains }, decisionTemplate,
    explicitNonClaims: ['optimizer_eligibility_is_not_established'], decisionRecorded: false,
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null, atomicityClassification: null,
    memberExpansionReviewed: false, requirementsVariantsXpTimingAndMechanicsComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true, blockers: ['explicit_human_activity_candidate_review_pending'], state: decisionPolicy.packetStates[0]
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return outer(intrinsic);
}

function resolution(requestedTitle, pageid, ns, revid, timestamp, content) {
  return { requestedTitle, normalizedTitle: requestedTitle, resolvedTitle: requestedTitle, redirected: false, page: { pageid, ns, title: requestedTitle, revisions: [{ revid: Number(revid), timestamp, slots: { main: { content } } }] } };
}

function fetchedResolutions() {
  return [
    resolution('Template:Infobox Activity/doc', 306002, 10, 15206128, '2026-05-05T07:02:29Z', '==Parameters==\n===type===\nThe type of activity: Minigame, Distraction and Diversion, or Raid. Omit if activity does not fall into one of those groups.\n'),
    resolution('Module:Infobox Activity', 543803, 828, 15325766, '2026-08-31T00:45:58Z', "{ name = 'type', func = typearg },\nfunction typearg(arg)\nreturn '[['..arg..']]'\nminigame = 'Minigames',\n"),
    resolution('Minigames', 2078, 0, 15327496, '2026-09-01T17:56:27Z', 'Minigames can be repeated, unlike quests.\n==Minigames==\n==Skilling minigames==\n|-\n|[[Activity 1]]\n|An agility course.\n|}\n==Other minigames==\n===Minigame-like activities===\n|-\n|[[Activity 2]]\n|A thieving method.\n|}\n'),
    resolution('Activity 1', 101, 0, 501, '2026-09-01T00:00:00Z', candidateContents.get('Activity 1')),
    resolution('Activity 2', 102, 0, 502, '2026-09-01T00:00:00Z', candidateContents.get('Activity 2'))
  ];
}

function manifest(domain, createdAt, records, source) {
  const raw = records.map(json).join('\n') + '\n';
  return { raw, manifest: { contract: 'sensum.ingestion-manifest.v1', domain, createdAt, records: records.length, contentHash: hash(raw), source } };
}

function context() {
  const packetRecords = [packetRecord(1), packetRecord(2)];
  const packet = manifest(policy.inputPacketDomain, times.packet, packetRecords, {
    policy: { id: packetPolicy.policy, contentHash: hash(packetPolicy) },
    audit: {
      packetConsolidationComplete: true, humanReviewComplete: false, requirementsVariantsXpTimingAndMechanicsComplete: false,
      completeActivityUniverse: false, publishable: true,
      packetCoverage: { packetCount: 2, completePacketCount: 2, packetMismatchCandidateKeys: [] },
      semanticPreservationCoverage: { nonBlankDecisionCandidateKeys: [], canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassificationCount: 0, atomicityClassificationCount: 0, memberExpansionReviewedCount: 0, requirementsVariantsXpTimingAndMechanicsCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0 }
    }
  });
  const packetSnapshot = { directory: 'packets', contentHash: packet.manifest.contentHash, createdAt: times.packet, explicit: true };
  const guidanceBuilt = buildActivityCandidatePriorityHumanReviewDecisionGuidance({
    packetRecords, packetRaw: packet.raw, packetManifest: packet.manifest, packetSnapshot,
    policy: guidancePolicy, packetPolicy, decisionPolicy, contentHash: hash
  });
  const guidanceRecords = guidanceBuilt.records.map(outer);
  const guidance = manifest(policy.inputGuidanceDomain, times.guidance, guidanceRecords, { policy: { id: guidancePolicy.policy, contentHash: hash(guidancePolicy) } });
  const guidanceSnapshot = { directory: 'guidance', contentHash: guidance.manifest.contentHash, createdAt: times.guidance, explicit: true };
  const evidenceBuilt = buildActivityCandidatePrioritySourceConflictAdditionalEvidence({
    packetRecords, packetRaw: packet.raw, packetManifest: packet.manifest, packetSnapshot,
    guidanceRecords, guidanceRaw: guidance.raw, guidanceManifest: guidance.manifest, guidanceSnapshot,
    fetchedResolutions: fetchedResolutions(), policy: evidencePolicy, packetPolicy, guidancePolicy, decisionPolicy, contentHash: hash
  });
  const additionalEvidenceRecords = evidenceBuilt.records.map(outer);
  const evidence = manifest(policy.inputAdditionalEvidenceDomain, times.evidence, additionalEvidenceRecords, {
    policy: { id: evidencePolicy.policy, contentHash: hash(evidencePolicy) }, audit: evidenceBuilt.audit
  });
  const additionalEvidenceSnapshot = { directory: 'evidence', contentHash: evidence.manifest.contentHash, createdAt: times.evidence, explicit: true };
  const augmentedBuilt = buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance({
    packetRecords, packetRaw: packet.raw, packetManifest: packet.manifest, packetSnapshot,
    guidanceRecords, guidanceRaw: guidance.raw, guidanceManifest: guidance.manifest, guidanceSnapshot,
    additionalEvidenceRecords, additionalEvidenceRaw: evidence.raw, additionalEvidenceManifest: evidence.manifest, additionalEvidenceSnapshot,
    policy: augmentedPolicy, packetPolicy, guidancePolicy, additionalEvidencePolicy: evidencePolicy, decisionPolicy, contentHash: hash
  });
  const augmentedGuidanceRecords = augmentedBuilt.records.map(outer);
  const augmented = manifest(policy.inputAugmentedGuidanceDomain, times.augmented, augmentedGuidanceRecords, {
    policy: { id: augmentedPolicy.policy, contentHash: hash(augmentedPolicy) }, audit: augmentedBuilt.audit
  });
  const augmentedGuidanceSnapshot = { directory: 'augmented', contentHash: augmented.manifest.contentHash, createdAt: times.augmented, explicit: true };
  return {
    packetRecords, packetRaw: packet.raw, packetManifest: packet.manifest, packetSnapshot,
    guidanceRecords, guidanceRaw: guidance.raw, guidanceManifest: guidance.manifest, guidanceSnapshot,
    additionalEvidenceRecords, additionalEvidenceRaw: evidence.raw, additionalEvidenceManifest: evidence.manifest, additionalEvidenceSnapshot,
    augmentedGuidanceRecords, augmentedGuidanceRaw: augmented.raw, augmentedGuidanceManifest: augmented.manifest, augmentedGuidanceSnapshot,
    policy, packetPolicy, guidancePolicy, additionalEvidencePolicy: evidencePolicy, augmentedGuidancePolicy: augmentedPolicy, decisionPolicy, contentHash: hash
  };
}

function completedSubmission(ctx, index = 0) {
  const augmented = ctx.augmentedGuidanceRecords[index];
  const evidence = ctx.additionalEvidenceRecords.find(record => record.reviewPacketKey === augmented.reviewPacketKey);
  const packet = ctx.packetRecords.find(record => record.reviewPacketKey === augmented.reviewPacketKey);
  const submission = buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplate(augmented, evidence, ctx.augmentedGuidanceSnapshot.contentHash);
  const originalKeys = requiredReviewEvidenceKeysForActivityCandidatePriorityPacket(packet);
  submission.baseDecision.subjectDispositionDecision = 'confirm_one_bound_source_disposition';
  submission.baseDecision.selectedSourceDisposition = 'activity_subject';
  submission.baseDecision.canonicalGameEntityIdentityDecision = 'confirm_bound_source_page_subject_identity';
  submission.baseDecision.canonicalGameEntityIdentity = canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket(packet);
  submission.baseDecision.canonicalActivityIdentityDecision = 'confirm_bound_source_subject_as_activity_container';
  submission.baseDecision.canonicalActivityIdentity = canonicalActivityIdentityProposalForActivityCandidatePriorityPacket(packet);
  submission.baseDecision.repeatabilityDecision = 'repeatable_activity';
  submission.baseDecision.atomicityDecision = 'atomic_activity_subject';
  submission.baseDecision.memberExpansionDecision = 'not_required_atomic_subject';
  submission.baseDecision.evidenceDomainAssessments = submission.baseDecision.evidenceDomainAssessments.map(item => ({ ...item, status: 'supported_by_bound_evidence', evidenceKeys: [originalKeys[0]], notes: `Human review of ${item.domain}.` }));
  submission.baseDecision.reviewEvidenceKeys = originalKeys;
  submission.baseDecision.reviewedSourceRevisions = boundSourceRevisionsForActivityCandidatePriorityPacket(packet);
  submission.baseDecision.reviewer = 'Nicholas human reviewer';
  submission.baseDecision.reviewedAt = times.reviewed;
  submission.baseDecision.reviewNotes = 'Human source-bound decision after reviewing original and supplemental evidence.';
  submission.supplementalEvidenceReview.evidenceKeys = [...augmented.supplementalEvidence.supplementalReviewEvidenceKeys];
  submission.supplementalEvidenceReview.reviewedSourceRevisions = requiredSupplementalReviewRevisionsForActivityCandidatePriorityConflict(evidence);
  submission.supplementalEvidenceReview.notes = 'Reviewed field semantics and exact taxonomy membership separately from candidate repeatability.';
  return submission;
}

function build(ctx, submissions) {
  const raw = submissions.map(json).join('\n') + (submissions.length ? '\n' : '');
  return buildActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence({
    ...ctx, submissions, decisionFile: { explicit: true, file: 'decisions.ndjson', contentHash: hash(raw), rows: submissions.length }
  });
}

test('policy is generic, exactly bound to all five upstream policies, and fail closed', () => {
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidencePolicy(policy, packetPolicy, guidancePolicy, evidencePolicy, augmentedPolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'activity_subject' };
  assert.equal(compileActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidencePolicy(specific, packetPolicy, guidancePolicy, evidencePolicy, augmentedPolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidencePolicy(automatic, packetPolicy, guidancePolicy, evidencePolicy, augmentedPolicy, decisionPolicy, hash).valid, false);
});

test('records one supplemental-bound human decision by replaying the original importer unchanged', () => {
  const ctx = context();
  const blank = buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplate(
    ctx.augmentedGuidanceRecords[1], ctx.additionalEvidenceRecords[1], ctx.augmentedGuidanceSnapshot.contentHash
  );
  const result = build(ctx, [completedSubmission(ctx), blank]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.supplementalEvidenceBoundDecisionRecordingComplete, true);
  assert.equal(result.audit.allSourceConflictDecisionsRecorded, false);
  assert.equal(result.records.length, 1);
  assert.equal(result.audit.baseImporterCoverage.publishable, true);
  assert.equal(result.audit.supplementalBindingCoverage.exactSupplementalEvidenceKeySetCount, 1);
  assert.equal(result.records[0].baseDecisionRecord.reviewDecisionRecorded, true);
  assert.equal(result.records[0].semanticApplicationApplied, false);
  assert.equal(result.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('records both conflict decisions without claiming the full priority review is complete', () => {
  const ctx = context();
  const result = build(ctx, [completedSubmission(ctx, 0), completedSubmission(ctx, 1)]);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.allSourceConflictDecisionsRecorded, true);
  assert.equal(result.records.length, 2);
  assert.equal(result.audit.humanReviewComplete, false);
  assert.equal(result.audit.completeActivityUniverse, false);
});

test('identical explicit inputs and human submissions produce deterministic records and audit', () => {
  const firstContext = context();
  const secondContext = context();
  const first = build(firstContext, [completedSubmission(firstContext)]);
  const second = build(secondContext, [completedSubmission(secondContext)]);
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.audit), hash(second.audit));
});

test('rejects legacy rows, incomplete supplemental keys, stale review time, and mixed evidence channels atomically', () => {
  const ctx = context();
  assert.equal(build(ctx, [ctx.augmentedGuidanceRecords[0].blankDecisionTemplate]).audit.publishable, false);
  const missingKey = completedSubmission(ctx); missingKey.supplementalEvidenceReview.evidenceKeys.pop();
  assert.equal(build(ctx, [missingKey]).audit.publishable, false);
  const stale = completedSubmission(ctx); stale.baseDecision.reviewedAt = '2026-09-06T05:00:00Z';
  assert.equal(build(ctx, [stale]).audit.publishable, false);
  const mixed = completedSubmission(ctx); mixed.baseDecision.reviewEvidenceKeys.push(mixed.supplementalEvidenceReview.evidenceKeys[0]);
  assert.equal(build(ctx, [mixed]).audit.publishable, false);
  const oneValidOneInvalid = [completedSubmission(ctx, 0), completedSubmission(ctx, 1)]; oneValidOneInvalid[1].supplementalEvidenceReview.notes = null;
  assert.equal(build(ctx, oneValidOneInvalid).records.length, 0);
});

test('fails closed on any snapshot, manifest, record, policy, reviewer, or account-state drift', () => {
  const ctx = context();
  const validSubmission = completedSubmission(ctx);
  assert.equal(buildActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence({
    ...ctx, submissions: [validSubmission], decisionFile: { explicit: false, file: 'decisions.ndjson', contentHash: hash(json(validSubmission) + '\n'), rows: 1 }
  }).audit.publishable, false);
  assert.equal(build({ ...ctx, packetSnapshot: { ...ctx.packetSnapshot, explicit: false } }, [completedSubmission(ctx)]).audit.publishable, false);
  const changedAugmented = structuredClone(ctx.augmentedGuidanceRecords); changedAugmented[0].humanDecisionSelected = true;
  assert.equal(build({ ...ctx, augmentedGuidanceRecords: changedAugmented }, [completedSubmission(ctx)]).audit.publishable, false);
  const automatic = completedSubmission(ctx); automatic.baseDecision.reviewer = 'Codex';
  assert.equal(build(ctx, [automatic]).audit.publishable, false);
  const account = completedSubmission(ctx); account.username = 'forbidden';
  assert.equal(build(ctx, [account]).audit.publishable, false);
});

test('independent audit rejects record mutation, semantic application, and optimizer promotion', () => {
  const ctx = context();
  const submissions = [completedSubmission(ctx)];
  const result = build(ctx, submissions);
  const changed = structuredClone(result.records);
  changed[0].semanticApplicationApplied = true;
  changed[0].canonicalActivityIdentity = { forbidden: true };
  changed[0].optimizerEligible = true;
  const raw = submissions.map(json).join('\n') + '\n';
  const audit = auditActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence(changed, {
    ...ctx, submissions, decisionFile: { explicit: true, file: 'decisions.ndjson', contentHash: hash(raw), rows: submissions.length }
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI refuses implicit inputs before reading or writing any snapshot', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-supplemental-import-'));
  try {
    const command = spawnSync(process.execPath, ['platform/transforms/import-activity-candidate-priority-human-review-decisions-supplemental-evidence.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Activity candidate priority supplemental-evidence decision import checks passed.');
