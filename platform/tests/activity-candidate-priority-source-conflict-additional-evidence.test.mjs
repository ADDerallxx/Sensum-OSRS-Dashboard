import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityCandidatePrioritySourceConflictAdditionalEvidence,
  buildActivityCandidatePrioritySourceConflictAdditionalEvidence,
  compileActivityCandidatePrioritySourceConflictAdditionalEvidencePolicy
} from '../ingestion/activity-candidate-priority-source-conflict-additional-evidence-lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionGuidance } from '../transforms/activity-candidate-priority-human-review-decision-guidance-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-source-conflict-additional-evidence-v1.json', 'utf8'));
const packetPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json', 'utf8'));
const guidancePolicy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-decision-guidance-v1.json', 'utf8'));
const decisionPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-decision-import-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-source-conflict-additional-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-source-conflict-additional-evidence-audit-v1.json', 'utf8'));
const createdAt = '2026-09-06T04:06:25.989Z';
const json = value => JSON.stringify(value);
const withContentHash = base => ({ ...base, contentHash: hash(base) });
const candidateContents = new Map([
  ['Activity 1', "{{Infobox Activity\n|type = Minigame\n}}\n'''Activity 1''' is an Agility activity.\n"],
  ['Activity 2', "{{Infobox Activity\n|type = Minigame\n}}\n'''Activity 2''' is a Thieving activity.\n"]
]);

function packetRecord(ordinal) {
  const candidateKey = `osrs-wiki-pageid:${100 + ordinal}`;
  const reviewPacketKey = `${candidateKey}|priority-activity-human-review-packet`;
  const sourceRevision = String(500 + ordinal);
  const sourceTimestamp = '2026-09-01T00:00:00Z';
  const sourceTitle = `Activity ${ordinal}`;
  const sourceContentHash = hash(candidateContents.get(sourceTitle));
  const discoveryEvidence = withContentHash({
    contract: 'sensum.cross-source-entity-activity-candidate.v1', candidateKey,
    sourceContexts: { renderedEvidence: { observations: [{ guideRevision: String(700 + ordinal), parserObservedAt: '2026-09-03T00:00:00Z' }] } },
    activityDiscoveryCandidate: true, accountIndependent: true
  });
  const sourceEvidence = withContentHash({
    contract: 'sensum.activity-candidate-source-evidence.v1', candidateKey, sourcePageId: 100 + ordinal,
    resolvedTitle: sourceTitle, sourceRevision, sourceTimestamp,
    sourceUrl: `https://oldschool.runescape.wiki/w/Activity_${ordinal}`, sourceContentHash,
    sourceCandidateContentHash: discoveryEvidence.contentHash, accountIndependent: true
  });
  const subjectDisposition = { state: 'blocked_conflicting_source_declarations', disposition: null, conflictingDispositions: ['activity_subject', 'minigame_subject'] };
  const dispositionSignals = [
    { signalKey: 'infobox_type:minigame', disposition: 'minigame_subject', matchedText: '', sourceLocator: { lineStart: 2, lineEnd: 2 } },
    { signalKey: 'lead_declares_activity_subject', disposition: 'activity_subject', matchedText: 'is an activity', sourceLocator: { lineStart: 4, lineEnd: 4 } }
  ];
  const subjectAssessment = withContentHash({
    contract: 'sensum.activity-candidate-subject-disposition.v1', candidateKey, sourcePageId: sourceEvidence.sourcePageId,
    sourceRevision, sourceTimestamp, sourceContentHash, sourceEvidenceContentHash: sourceEvidence.contentHash,
    subjectDisposition, dispositionSignals, accountIndependent: true
  });
  const workRoute = withContentHash({
    contract: 'sensum.activity-candidate-evidence-work-routing.v1', candidateKey, sourcePageId: sourceEvidence.sourcePageId,
    sourceRevision, sourceTimestamp, sourceContentHash, sourceDispositionContentHash: subjectAssessment.contentHash,
    sourceDisposition: subjectDisposition,
    routingDecision: {
      routeKey: 'source_declaration_conflict_review', routeState: 'blocked_source_conflict',
      requiredEvidenceDomains: ['field_semantics', 'source_declaration_reconciliation']
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
    batchOrdinal: 1, batchItemOrdinal: ordinal, candidateKey,
    sourcePageIdentity: {
      sourcePageId: sourceEvidence.sourcePageId, resolvedTitle: sourceTitle, sourceRevision,
      sourceTimestamp, sourceUrl: sourceEvidence.sourceUrl, sourceContentHash,
      sourceContentBytes: Buffer.byteLength(candidateContents.get(sourceTitle), 'utf8')
    },
    sourceExactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${sourceRevision}`,
    pipelineBindings: {
      candidateContentHash: discoveryEvidence.contentHash, sourceEvidenceContentHash: sourceEvidence.contentHash,
      subjectDispositionContentHash: subjectAssessment.contentHash, workRoutingContentHash: workRoute.contentHash
    },
    discoveryEvidence, sourceEvidence, subjectAssessment, workRoute,
    reviewPriority: { band: 1, reason: 'source_conflict' },
    reviewObligations: { requiredEvidenceDomains: domains }, decisionTemplate,
    explicitNonClaims: ['optimizer_eligibility_is_not_established'], decisionRecorded: false,
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    atomicityClassification: null, memberExpansionReviewed: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['explicit_human_activity_candidate_review_pending'], state: decisionPolicy.packetStates[0]
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function inputs() {
  const packetRecords = [packetRecord(1), packetRecord(2)];
  const packetRaw = packetRecords.map(json).join('\n') + '\n';
  const packetManifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: policy.inputPacketDomain, createdAt,
    records: packetRecords.length, contentHash: hash(packetRaw), source: {
      policy: { id: packetPolicy.policy, contentHash: hash(packetPolicy) },
      audit: {
        packetConsolidationComplete: true, humanReviewComplete: false,
        requirementsVariantsXpTimingAndMechanicsComplete: false, completeActivityUniverse: false, publishable: true,
        packetCoverage: { packetCount: 2, completePacketCount: 2, packetMismatchCandidateKeys: [] },
        semanticPreservationCoverage: {
          nonBlankDecisionCandidateKeys: [], canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0,
          repeatabilityClassificationCount: 0, atomicityClassificationCount: 0, memberExpansionReviewedCount: 0,
          requirementsVariantsXpTimingAndMechanicsCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0
        }
      }
    }
  };
  const packetSnapshot = { directory: 'packets', contentHash: packetManifest.contentHash, createdAt, explicit: true };
  const guidance = buildActivityCandidatePriorityHumanReviewDecisionGuidance({
    packetRecords, packetRaw, packetManifest, packetSnapshot,
    policy: guidancePolicy, packetPolicy, decisionPolicy, contentHash: hash
  });
  assert.equal(guidance.audit.publishable, true);
  const guidanceRecords = guidance.records.map(record => ({ ...record, contentHash: hash(record) }));
  const guidanceRaw = guidanceRecords.map(json).join('\n') + '\n';
  const guidanceCreatedAt = '2026-09-06T04:52:24.012Z';
  const guidanceManifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: policy.inputGuidanceDomain, createdAt: guidanceCreatedAt,
    records: guidanceRecords.length, contentHash: hash(guidanceRaw),
    source: { policy: { id: guidancePolicy.policy, contentHash: hash(guidancePolicy) } }
  };
  const guidanceSnapshot = { directory: 'guidance', contentHash: guidanceManifest.contentHash, createdAt: guidanceCreatedAt, explicit: true };
  return { packetRecords, packetRaw, packetManifest, packetSnapshot, guidanceRecords, guidanceRaw, guidanceManifest, guidanceSnapshot };
}

function resolution(requestedTitle, pageid, ns, revid, timestamp, content) {
  return {
    requestedTitle, normalizedTitle: requestedTitle, resolvedTitle: requestedTitle, redirected: false,
    page: { pageid, ns, title: requestedTitle, revisions: [{ revid: Number(revid), timestamp, slots: { main: { content } } }] }
  };
}

function fetchedResolutions() {
  const documentation = `==Parameters==\n===type===\nThe type of activity: Minigame, Distraction and Diversion, or Raid. Omit if activity does not fall into one of those groups.\n`;
  const module = `{ name = 'type', func = typearg },\nfunction typearg(arg)\nreturn '[['..arg..']]'\nminigame = 'Minigames',\n`;
  const taxonomy = `Minigames can be repeated, unlike quests.\n==Minigames==\n==Skilling minigames==\n|-\n|[[Activity 1]]\n|An agility course.\n|}\n==Other minigames==\n===Minigame-like activities===\n|-\n|[[Activity 2]]\n|A thieving method.\n|}\n`;
  return [
    resolution('Template:Infobox Activity/doc', 306002, 10, 15206128, '2026-05-05T07:02:29Z', documentation),
    resolution('Module:Infobox Activity', 543803, 828, 15325766, '2026-08-31T00:45:58Z', module),
    resolution('Minigames', 2078, 0, 15327496, '2026-09-01T17:56:27Z', taxonomy),
    resolution('Activity 1', 101, 0, 501, '2026-09-01T00:00:00Z', candidateContents.get('Activity 1')),
    resolution('Activity 2', 102, 0, 502, '2026-09-01T00:00:00Z', candidateContents.get('Activity 2'))
  ];
}

function build(overrides = {}) {
  return buildActivityCandidatePrioritySourceConflictAdditionalEvidence({
    ...inputs(), fetchedResolutions: fetchedResolutions(),
    policy, packetPolicy, guidancePolicy, decisionPolicy, contentHash: hash, ...overrides
  });
}

test('policy is generic, exactly bound, and forbids automatic review', () => {
  const compiled = compileActivityCandidatePrioritySourceConflictAdditionalEvidencePolicy(policy, packetPolicy, guidancePolicy, decisionPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'activity_subject' };
  assert.equal(compileActivityCandidatePrioritySourceConflictAdditionalEvidencePolicy(specific, packetPolicy, guidancePolicy, decisionPolicy, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileActivityCandidatePrioritySourceConflictAdditionalEvidencePolicy(automatic, packetPolicy, guidancePolicy, decisionPolicy, hash).valid, false);
});

test('materializes exact schema and taxonomy evidence while leaving both conflicts unresolved', () => {
  const result = build();
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.additionalEvidenceCoverageComplete, true);
  assert.equal(result.records.length, 2);
  assert.equal(result.audit.sourceCoverage.completeSupportingSourceCount, 3);
  assert.equal(result.audit.sourceCoverage.candidateRevisionExactMatchCount, 2);
  assert.equal(result.audit.evidenceCoverage.reviewEvidenceKeyCount, 16);
  assert.deepEqual(result.records[0].taxonomyMembershipEvidence.candidateMembership.linkOccurrences[0].headingPath.map(row => row.title), ['Skilling minigames']);
  assert.deepEqual(result.records[1].taxonomyMembershipEvidence.candidateMembership.linkOccurrences[0].headingPath.map(row => row.title), ['Other minigames', 'Minigame-like activities']);
  assert.equal(result.records.every(record => record.sourceConflict.conflictResolved === false), true);
  assert.equal(result.records.every(record => record.humanReviewBoundary.selectedSourceDisposition === null), true);
  assert.equal(result.audit.semanticPreservationCoverage.humanDecisionSelectedCount, 0);
  assert.equal(result.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(result.records[0], field), `Missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('identical inputs reproduce identical evidence records and audit', () => {
  const first = build();
  const second = build();
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.audit), hash(second.audit));
});

test('revision drift and missing observations remain explicit evidence blockers', () => {
  const drifted = fetchedResolutions();
  drifted[3].page.revisions[0].revid = 999;
  const driftResult = build({ fetchedResolutions: drifted });
  assert.equal(driftResult.audit.publishable, true);
  assert.equal(driftResult.audit.additionalEvidenceCoverageComplete, false);
  assert.equal(driftResult.records[0].blockers.includes('candidate_current_revision_does_not_match_bound_packet_revision'), true);
  const missing = fetchedResolutions();
  missing[0].page.revisions[0].slots.main.content = '===type===';
  const missingResult = build({ fetchedResolutions: missing });
  assert.equal(missingResult.audit.additionalEvidenceCoverageComplete, false);
  assert.equal(missingResult.records[0].blockers.includes('one_or_more_required_observations_missing'), true);
});

test('fails closed on implicit snapshots, guidance drift, fetched-set drift, or account state', () => {
  const base = inputs();
  assert.equal(build({ packetSnapshot: { ...base.packetSnapshot, explicit: false } }).audit.publishable, false);
  const changedGuidance = structuredClone(base.guidanceRecords); changedGuidance[0].humanDecisionSelected = true;
  assert.equal(build({ guidanceRecords: changedGuidance }).audit.publishable, false);
  assert.equal(build({ fetchedResolutions: fetchedResolutions().slice(0, -1) }).audit.publishable, false);
  const result = build();
  const changedRecords = structuredClone(result.records); changedRecords[0].username = 'forbidden';
  const audit = auditActivityCandidatePrioritySourceConflictAdditionalEvidence(changedRecords, {
    ...base, fetchedResolutions: fetchedResolutions(), policy, packetPolicy, guidancePolicy, decisionPolicy, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.accountStateFindings.length > 0, true);
});

test('independent audit rejects a selected disposition or optimizer promotion', () => {
  const base = inputs();
  const result = build();
  const changed = structuredClone(result.records);
  changed[0].sourceConflict.selectedSourceDisposition = 'minigame_subject';
  changed[0].sourceConflict.conflictResolved = true;
  changed[0].optimizerEligible = true;
  const audit = auditActivityCandidatePrioritySourceConflictAdditionalEvidence(changed, {
    ...base, fetchedResolutions: fetchedResolutions(), policy, packetPolicy, guidancePolicy, decisionPolicy, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI refuses implicit packet or guidance selection before any network or write', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-priority-conflict-evidence-'));
  try {
    const command = spawnSync(process.execPath, [
      'platform/ingestion/ingest-wiki-activity-candidate-priority-source-conflict-additional-evidence.mjs', `--root=${root}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Activity candidate priority source-conflict additional evidence checks passed.');
