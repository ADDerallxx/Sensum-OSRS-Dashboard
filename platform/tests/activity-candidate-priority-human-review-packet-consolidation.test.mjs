import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityCandidatePriorityHumanReviewPackets,
  buildActivityCandidatePriorityHumanReviewPackets,
  compileActivityCandidatePriorityHumanReviewPacketPolicy
} from '../transforms/activity-candidate-priority-human-review-packet-consolidation-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json', 'utf8'));
const packetContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-human-review-packet-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-priority-human-review-packet-consolidation-audit-v1.json', 'utf8'));
const seal = record => ({ ...record, contentHash: hash(record) });

function fixture(prefix = 1, { conflict = false } = {}) {
  const pageId = 1000 + prefix;
  const revision = String(2000 + prefix);
  const candidateKey = `osrs-wiki-pageid:${pageId}`;
  const title = `Activity ${prefix}`;
  const sourceUrl = `https://oldschool.runescape.wiki/w/Activity_${prefix}`;
  const sourceContentHash = hash(`source-${prefix}`);
  const targetReference = {
    activityPageCandidate: true,
    classificationState: 'typed',
    entityTypes: ['activity_page'],
    redirected: false,
    referencedBy: { skillKeys: ['agility'], statementKeys: [`agility:members${prefix}:1`] },
    requestedFragment: null,
    requestedTitle: title,
    targetKey: `wiki-title:activity ${prefix}`
  };
  const candidate = seal({
    accountIndependent: true,
    activityDiscoveryCandidate: true,
    blockers: ['activity_page_type_is_discovery_evidence_only', 'optimizer_eligibility_blocked'],
    candidateKey,
    candidateKind: 'activity_page_identity_candidate',
    canonicalActivityIdentity: null,
    canonicalGameEntityIdentity: null,
    contract: policy.candidateContract,
    optimizerEligible: false,
    pageIdentity: { renderedSourceRevision: revision, resolvedTitle: title, revisionRelationship: 'same_revision', sourcePageId: pageId, unlockSourceRevision: revision },
    queuedForSemanticReview: true,
    renderedTargetKey: `wiki-pageid:${pageId}`,
    repeatabilityClassification: null,
    reviewStatus: 'unreviewed',
    skillKeys: ['agility'],
    sourceContexts: {
      crossSourcePageIdentityEstablished: true,
      renderedEvidence: {
        guideObservationCount: 1,
        namespaceIds: [0],
        observations: [{ guideContentHash: hash(`guide-${prefix}`), guidePageId: 50, guideRevision: '99', guideTitle: 'Guide', namespaceId: 0, parserChannel: 'links', parserMetadata: null, parserObservedAt: '2026-01-01T00:00:00Z', parserReportedExists: true, requestedTitle: title, resolutionState: 'current_revision_pinned_page', sourcePresence: 'direct_source_stable_page_id' }],
        requestedTitles: [title],
        sourcePresenceCounts: { direct_source_exact_mediawiki_title: 0, direct_source_stable_page_id: 1, rendered_only_origin_unattributed: 0 },
        targetPageIdentity: { redirected: false, resolvedTitle: title, sourcePageId: pageId, sourceRevision: revision, sourceTimestamp: '2026-01-01T00:00:00Z', sourceUrl }
      },
      revisionRelationship: 'same_revision',
      semanticRoutingState: 'cross_source_activity_page_candidate',
      unlockEvidence: {
        activityPageCandidate: true,
        canonicalWikiPageKey: candidateKey,
        entityTypes: ['activity_page'],
        pageTypeClassified: true,
        resolvedTitle: title,
        source: { sourceContentHash, sourceRevision: revision, sourceTimestamp: '2026-01-01T00:00:00Z', sourceUrl },
        sourcePageId: pageId,
        targetReferenceCount: 1,
        targetReferences: [targetReference]
      }
    },
    sourceCrosswalkContentHash: hash(`crosswalk-${prefix}`),
    state: 'blocked',
    statementKeys: [`agility:members${prefix}:1`]
  });
  const source = seal({
    accountIndependent: true,
    blockers: ['activity_candidate_semantic_identity_review_pending'],
    candidateKey,
    canonicalActivityIdentity: null,
    canonicalGameEntityIdentity: null,
    contract: policy.sourceEvidenceContract,
    headingEvidence: [{ level: 2, line: 10, rawText: '==Rewards==', title: 'Rewards' }],
    infoboxEvidence: { balanced: true, parameters: [{ lineEnd: 4, lineStart: 3, name: 'type', rawValue: 'Activity' }], sourceLocator: { lineEnd: 5, lineStart: 1 }, template: 'Infobox Activity' },
    leadParagraphEvidence: [{ lineEnd: 8, lineStart: 7, rawText: `${title} is an activity.` }],
    lexicalReviewCandidates: [{ family: 'repeatability', interpretationState: 'review_candidate_only', line: 20, rawText: 'Can be repeated.', signalKey: 'explicit_repeatable_language' }],
    optimizerEligible: false,
    pageTypeEvidence: { directCategories: [], entityTypes: ['activity_page'], rootTemplates: [{ line: 1, template: 'Infobox Activity', templateKey: 'infobox activity' }] },
    repeatabilityReview: { classification: null, evidenceKeys: [], state: 'unreviewed' },
    resolvedTitle: title,
    revisionAlignment: { allSignatureContextsEquivalent: true, candidateAndSignaturePageIdMatch: true, candidateAndSignatureRevisionMatch: true, fetchedAndSignatureContentHashMatch: true, fetchedAndSignaturePageIdMatch: true, fetchedAndSignatureRevisionMatch: true },
    semanticIdentityReview: { disposition: null, evidenceKeys: [], state: 'unreviewed' },
    skillKeys: ['agility'],
    sourceCandidateContentHash: candidate.contentHash,
    sourceContentBytes: 100,
    sourceContentHash,
    sourcePageId: pageId,
    sourceRevision: revision,
    sourceSignatureContexts: [{ identitySourceRevision: revision, redirected: false, referencedBy: targetReference.referencedBy, requestedFragment: null, requestedTitle: title, targetKey: targetReference.targetKey }],
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl,
    state: 'review_ready',
    statementKeys: [`agility:members${prefix}:1`]
  });
  const subjectDisposition = conflict
    ? { state: 'blocked_conflicting_source_declarations', disposition: null, conflictingDispositions: ['activity_subject', 'minigame_subject'] }
    : { state: 'source_supported', disposition: 'activity_subject', conflictingDispositions: [] };
  const dispositionSignals = conflict
    ? [{ disposition: 'activity_subject', signalKey: 'lead_activity' }, { disposition: 'minigame_subject', signalKey: 'infobox_minigame' }]
    : [{ disposition: 'activity_subject', signalKey: 'infobox_activity' }];
  const disposition = seal({
    accountIndependent: true,
    blockers: conflict ? ['source_disposition_conflict'] : ['canonical_game_entity_identity_not_established'],
    candidateKey,
    canonicalActivityIdentity: null,
    canonicalGameEntityIdentity: null,
    contract: policy.subjectDispositionContract,
    dispositionSignals,
    infoboxTypeAssessment: { disposition: conflict ? 'minigame_subject' : 'activity_subject', mapped: true, normalizedValue: conflict ? 'minigame' : 'activity', present: true, rawValue: conflict ? 'Minigame' : 'Activity', sourceLocator: { lineEnd: 4, lineStart: 3 } },
    memberExpansionReview: { atomicSubject: null, evidenceKeys: [], memberKeys: [], state: 'unreviewed' },
    optimizerEligible: false,
    repeatabilityReview: { classification: null, evidenceKeys: [], state: 'unreviewed' },
    resolvedTitle: title,
    skillKeys: ['agility'],
    sourceContentHash,
    sourceEvidenceContentHash: source.contentHash,
    sourcePageId: pageId,
    sourceRevision: revision,
    sourceSignatureContexts: source.sourceSignatureContexts,
    sourceTimestamp: source.sourceTimestamp,
    sourceUrl,
    state: conflict ? 'blocked' : 'subject_disposition_ready',
    statementKeys: source.statementKeys,
    subjectDisposition
  });
  const routingDecision = conflict
    ? { conflictingSourceDispositions: subjectDisposition.conflictingDispositions, expansionAxes: [], policyRuleKey: 'blocked_conflicting_source_declarations', policyRuleKind: 'source_state', requiredEvidenceDomains: ['field_semantics', 'source_declaration_reconciliation'], routeKey: 'source_declaration_conflict_review', routeState: 'blocked_source_conflict', sourceDisposition: null, sourceState: subjectDisposition.state }
    : { conflictingSourceDispositions: [], expansionAxes: ['action_or_route_variants'], policyRuleKey: 'activity_subject', policyRuleKind: 'subject_disposition', requiredEvidenceDomains: ['action_boundary', 'repeatability', 'requirements', 'variants', 'xp_rewards', 'timing_rates', 'mechanics'], routeKey: 'activity_action_and_variant_review', routeState: 'queued', sourceDisposition: 'activity_subject', sourceState: 'source_supported' };
  const routing = seal({
    accountIndependent: true,
    blockers: [...disposition.blockers, conflict ? 'evidence_work_route_blocked_by_source_state' : 'evidence_work_route_pending'],
    candidateKey,
    canonicalActivityIdentity: null,
    canonicalGameEntityIdentity: null,
    contract: policy.workRoutingContract,
    dispositionSignals,
    memberExpansionReview: { atomicSubject: null, evidenceKeys: [], memberKeys: [], state: 'unreviewed' },
    optimizerEligible: false,
    repeatabilityReview: { classification: null, evidenceKeys: [], state: 'unreviewed' },
    resolvedTitle: title,
    routingDecision,
    skillKeys: ['agility'],
    sourceBlockers: disposition.blockers,
    sourceContentHash,
    sourceDisposition: subjectDisposition,
    sourceDispositionContentHash: disposition.contentHash,
    sourcePageId: pageId,
    sourceRevision: revision,
    sourceSignatureContexts: source.sourceSignatureContexts,
    sourceTimestamp: source.sourceTimestamp,
    sourceUrl,
    state: conflict ? 'blocked' : 'evidence_work_routed',
    statementKeys: source.statementKeys
  });
  return { candidate, source, disposition, routing };
}

const ordinary = fixture(1);
const conflict = fixture(2, { conflict: true });
const inputs = {
  candidateRecords: [ordinary.candidate, conflict.candidate],
  sourceEvidenceRecords: [ordinary.source, conflict.source],
  subjectDispositionRecords: [ordinary.disposition, conflict.disposition],
  workRoutingRecords: [ordinary.routing, conflict.routing]
};
const compiled = compileActivityCandidatePriorityHumanReviewPacketPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidBindings, []);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.invalidEnums, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const built = buildActivityCandidatePriorityHumanReviewPackets({ ...inputs, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.packetConsolidationComplete, true);
assert.equal(built.audit.humanReviewComplete, false);
assert.equal(built.records.length, 2);
assert.equal(built.records[0].candidateKey, conflict.candidate.candidateKey);
assert.equal(built.records[0].reviewPriority.band, 1);
assert.equal(built.records[0].state, 'priority_activity_review_packet_materialized_source_conflict_pending');
assert.equal(built.records[1].reviewPriority.band, 2);
assert.equal(built.audit.pipelineBindingCoverage.exactlyBoundCandidateCount, 2);
assert.equal(built.audit.pipelineBindingCoverage.directCrossSourceUnlockEvidenceCandidateCount, 2);
assert.equal(built.audit.pipelineBindingCoverage.renderedPageWithoutUnlockEvidenceCandidateCount, 0);
assert.equal(built.audit.packetCoverage.sourceConflictPacketCount, 1);
assert.equal(built.audit.evidenceCoverage.renderedGuideObservationCount, 2);
assert.equal(built.audit.evidenceCoverage.lexicalReviewCandidateCount, 2);
assert.equal(built.audit.semanticPreservationCoverage.blankDecisionTemplateCount, 2);
assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
assert.equal(built.artifacts.batches.length, 1);
assert.match(built.artifacts.batches[0].markdown, /Exact-revision source evidence/);
assert.match(built.artifacts.batches[0].markdown, /Explicit nonclaims/);
for (const record of built.records) for (const field of packetContract.required) assert.ok(Object.hasOwn(record, field), `Missing packet field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const deterministic = buildActivityCandidatePriorityHumanReviewPackets({
  candidateRecords: structuredClone(inputs.candidateRecords),
  sourceEvidenceRecords: structuredClone(inputs.sourceEvidenceRecords),
  subjectDispositionRecords: structuredClone(inputs.subjectDispositionRecords),
  workRoutingRecords: structuredClone(inputs.workRoutingRecords),
  policy: structuredClone(policy)
});
assert.deepEqual(deterministic, built);

const pageSpecific = structuredClone(policy);
pageSpecific.overrides = { [ordinary.candidate.candidateKey]: 'approved' };
assert.equal(compileActivityCandidatePriorityHumanReviewPacketPolicy(pageSpecific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileActivityCandidatePriorityHumanReviewPacketPolicy(automatic).valid, false);

const badCandidateInputs = structuredClone(inputs);
badCandidateInputs.candidateRecords[0].candidateKind = 'rendered_page_without_unlock_match';
badCandidateInputs.candidateRecords[0] = seal(withoutHash(badCandidateInputs.candidateRecords[0]));
let failed = buildActivityCandidatePriorityHumanReviewPackets({ ...badCandidateInputs, policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_discovery_candidates_invalid_or_not_directly_cross_source_bound'));

const missingSourceInputs = structuredClone(inputs);
missingSourceInputs.sourceEvidenceRecords.pop();
failed = buildActivityCandidatePriorityHumanReviewPackets({ ...missingSourceInputs, policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('four_input_and_packet_candidate_sets_do_not_match_exactly'));

const tamperedHashInputs = structuredClone(inputs);
tamperedHashInputs.sourceEvidenceRecords[0].resolvedTitle = 'Tampered';
failed = buildActivityCandidatePriorityHumanReviewPackets({ ...tamperedHashInputs, policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_input_record_content_hashes_invalid'));

const reboundInputs = structuredClone(inputs);
reboundInputs.subjectDispositionRecords[0].sourceEvidenceContentHash = hash('different');
reboundInputs.subjectDispositionRecords[0] = seal(withoutHash(reboundInputs.subjectDispositionRecords[0]));
failed = buildActivityCandidatePriorityHumanReviewPackets({ ...reboundInputs, policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_candidate_pipeline_bindings_mismatch'));

const decisionTamper = structuredClone(built.records);
decisionTamper[0].decisionTemplate.subjectDispositionDecision = 'confirm_one_bound_source_disposition';
let audit = auditActivityCandidatePriorityHumanReviewPackets(decisionTamper, { ...inputs, policy });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('packet_generation_recorded_a_decision_or_semantic_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
audit = auditActivityCandidatePriorityHumanReviewPackets(accountScoped, { ...inputs, policy });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('account_query_state_baked_into_priority_activity_review_packets'));

const artifactTamper = structuredClone(built.artifacts);
artifactTamper.batches[0].markdown += 'tampered';
audit = auditActivityCandidatePriorityHumanReviewPackets(built.records, { ...inputs, policy, artifacts: artifactTamper });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('one_or_more_human_review_artifacts_do_not_match_deterministic_reconstruction'));

const missingArguments = spawnSync(process.execPath, ['platform/transforms/materialize-activity-candidate-priority-human-review-packets.mjs'], { encoding: 'utf8' });
assert.equal(missingArguments.status, 2);
assert.match(missingArguments.stdout, /implicit snapshot selection is forbidden/);
assert.match(missingArguments.stdout, /"outputWritten": false/);

console.log('Priority activity candidate cross-channel human review packet consolidation checks passed.');

function withoutHash(record) {
  const { contentHash, ...rest } = record;
  return rest;
}
