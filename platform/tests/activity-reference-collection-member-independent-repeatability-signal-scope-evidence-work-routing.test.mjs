import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes,
  buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes,
  compileIndependentRepeatabilitySignalScopeEvidenceWorkRoutingPolicy
} from '../transforms/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync(
  'platform/policies/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-work-routing-v1.json',
  'utf8'
));
const recordContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-work-routing-v1.json',
  'utf8'
));
const auditContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-work-routing-audit-v1.json',
  'utf8'
));

const states = [
  'blocked_incomplete_signal_scope_evidence',
  'blocked_no_exact_line_main_namespace_link_for_scope',
  'blocked_exact_line_links_without_stable_identity_anchor',
  'blocked_stable_identity_anchor_observation_without_semantic_subject_binding'
];

function signalDisposition(state, key) {
  return {
    signalEvidenceKey: `signal:${key}`,
    state,
    canonicalActivityScopeClassification: null,
    repeatabilityClassification: null,
    semanticSubjectBinding: null,
    exactLineLinkOccurrenceKeys: state.includes('no_exact_line') || state.includes('incomplete') ? [] : [`link:${key}`],
    stableIdentityAnchorEvidenceKeys: state.includes('stable_identity_anchor_observation') ? [`anchor:${key}`] : [],
    sourceRevisionKey: `100:200:hash-${key}`,
    evidenceKeys: [`signal:${key}`],
    deficiencies: [`deficiency:${key}`],
    requiredEvidence: [`required:${key}`]
  };
}

function input({ key = 'example', dispositionStates = states, signalKeyPrefix = key } = {}) {
  const dispositions = dispositionStates.map((state, index) => signalDisposition(state, `${signalKeyPrefix}-${index}`));
  const incomplete = dispositions.some(item => item.state === 'blocked_incomplete_signal_scope_evidence');
  return {
    contract: 'sensum.activity-reference-collection-member-independent-repeatability-signal-scope-disposition.v1',
    memberCandidateKey: `member:${key}`,
    sourceIndependentRepeatabilitySignalScopeEvidenceContentHash: `scope-evidence-${key}`,
    canonicalActivityIdentity: {
      canonicalActivityKey: `activity:${key}`,
      canonicalLabel: `Activity ${key}`,
      stableIdentityAnchor: { linkedSubjectPageId: 777, collectionPageId: 50, relationshipClass: 'describes' }
    },
    independentRepeatabilitySignalScopeEvidence: {
      evidenceState: 'complete_revision_pinned_independent_repeatability_signal_scope_evidence_packet',
      signalScopeEvidencePackets: dispositions.map(item => ({
        signalEvidenceKey: item.signalEvidenceKey,
        sourceCandidate: { sourcePageId: 100, resolvedTitle: 'Observed source', sourceRevision: '200' }
      }))
    },
    independentRepeatabilitySignalScopeObservations: {
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      signalScopeEvidencePacketCount: dispositions.length
    },
    independentRepeatabilitySignalScopeDisposition: {
      state: incomplete ? 'blocked_incomplete_scope_evidence' : 'reviewed_all_signal_scope_states_unresolved',
      canonicalActivityScopeClassification: null,
      repeatabilityClassification: null,
      signalDispositionCount: dispositions.length,
      signalDispositions: dispositions
    },
    independentRepeatabilitySignalScopeReview: {
      state: 'reviewed_blocked',
      canonicalActivityScopeClassification: null,
      repeatabilityClassification: null
    },
    repeatabilityDisposition: { state: 'unresolved', classification: null },
    repeatabilityReview: { state: 'reviewed_blocked', classification: null },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical_activity_scope_unresolved', 'optimizer_eligibility_blocked'],
    state: incomplete
      ? 'independent_repeatability_signal_scope_disposition_input_blocked'
      : 'independent_repeatability_signal_scope_disposition_reviewed_unresolved',
    contentHash: `scope-disposition-${key}`
  };
}

const source = input();
const built = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [source],
  policy
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.canonicalActivityScopeReviewComplete, false);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.routingCoverage.inputSignalScopeDispositionCount, 4);
assert.equal(built.audit.routingCoverage.signalEvidenceWorkRouteCount, 4);
assert.equal(built.audit.routingCoverage.routedCount, 4);
assert.equal(built.audit.routingCoverage.queuedCount, 0);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 4);
assert.equal(built.audit.routingCoverage.exactNestedRouteSetMatch, true);
assert.equal(built.audit.semanticPromotionCoverage.evidenceWorkCompletedCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
const output = built.records[0];
const routes = output.independentRepeatabilitySignalScopeEvidenceWorkRouting.signalEvidenceWorkRoutes;
assert.equal(routes[0].routeKey, 'repair_incomplete_revision_pinned_signal_scope_evidence');
assert.equal(routes[1].routeKey, 'collect_source_bound_subject_predicate_binding_without_exact_line_link');
assert.equal(routes[2].routeKey, 'resolve_stable_activity_anchor_then_bind_repeatability_predicate');
assert.equal(routes[3].routeKey, 'bind_repeatability_predicate_to_stable_activity_subject');
assert.ok(routes.every(route => route.routeState.startsWith('blocked_') && route.evidenceWorkComplete === false));
assert.equal(output.independentRepeatabilitySignalScopeEvidenceWorkReview.canonicalActivityScopeClassification, null);
assert.equal(output.independentRepeatabilitySignalScopeEvidenceWorkReview.repeatabilityClassification, null);
assert.equal(output.memberExpansionReview.state, 'unreviewed');
assert.equal(output.mechanicsReview.state, 'unreviewed');
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = input();
renamed.canonicalActivityIdentity.canonicalLabel = 'Completely renamed display label';
renamed.canonicalActivityIdentity.stableIdentityAnchor.linkedSubjectPageId = 999999;
renamed.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0].sourceCandidate.resolvedTitle = 'Renamed source title';
renamed.contentHash = 'renamed-input-hash';
const renamedBuilt = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [renamed],
  policy
});
assert.deepEqual(
  renamedBuilt.records[0].independentRepeatabilitySignalScopeEvidenceWorkRouting,
  output.independentRepeatabilitySignalScopeEvidenceWorkRouting
);

const repeatedSignalKeyInputs = [
  input({ key: 'left', dispositionStates: [states[1]], signalKeyPrefix: 'shared' }),
  input({ key: 'right', dispositionStates: [states[1]], signalKeyPrefix: 'shared' })
];
const repeatedSignalKeys = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: repeatedSignalKeyInputs,
  policy
});
assert.equal(repeatedSignalKeys.audit.publishable, true);
assert.equal(repeatedSignalKeys.audit.routingCoverage.signalEvidenceWorkRouteCount, 2);
assert.deepEqual(repeatedSignalKeys.audit.routingCoverage.duplicateCompositeSignalKeys, []);

const unknownInput = input({ key: 'unknown', dispositionStates: [states[1]] });
unknownInput.independentRepeatabilitySignalScopeDisposition.signalDispositions[0].state = 'future_unmapped_state';
const unknown = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [unknownInput],
  policy
});
assert.equal(unknown.audit.publishable, false);
assert.deepEqual(unknown.audit.policyCoverage.unmappedDispositionStates, ['future_unmapped_state']);

const incompletePolicy = structuredClone(policy);
delete incompletePolicy.stateRoutes.blocked_no_exact_line_main_namespace_link_for_scope;
const missingRoute = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [input({ key: 'missing-route', dispositionStates: [states[1]] })],
  policy: incompletePolicy
});
assert.equal(missingRoute.audit.publishable, false);
assert.ok(missingRoute.audit.blockers.includes('signal_scope_evidence_work_routing_policy_invalid_or_incomplete'));

const identitySpecificPolicy = structuredClone(policy);
identitySpecificPolicy.overrides = { 'member:example': 'special_route' };
const identitySpecific = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [source],
  policy: identitySpecificPolicy
});
assert.equal(identitySpecific.audit.publishable, false);
assert.ok(identitySpecific.audit.blockers.includes('signal_scope_evidence_work_routing_policy_invalid_or_incomplete'));

const autoVerificationPolicy = structuredClone(policy);
autoVerificationPolicy.rules.automaticVerificationAllowed = true;
const autoVerification = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [source],
  policy: autoVerificationPolicy
});
assert.equal(autoVerification.audit.publishable, false);
assert.ok(autoVerification.audit.blockers.includes('signal_scope_evidence_work_routing_policy_invalid_or_incomplete'));

const queuedRoutePolicy = structuredClone(policy);
queuedRoutePolicy.stateRoutes.blocked_no_exact_line_main_namespace_link_for_scope.routeState = 'queued';
const queuedRoute = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [input({ key: 'queued', dispositionStates: [states[1]] })],
  policy: queuedRoutePolicy
});
assert.equal(queuedRoute.audit.publishable, false);
assert.ok(queuedRoute.audit.blockers.includes('signal_scope_evidence_work_routing_policy_invalid_or_incomplete'));

const alteredRouteRecords = structuredClone(built.records);
alteredRouteRecords[0].independentRepeatabilitySignalScopeEvidenceWorkRouting.signalEvidenceWorkRoutes[0].routeKey = 'activity_specific_route';
const alteredRoute = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes(alteredRouteRecords, {
  dispositionRecords: [source],
  policy
});
assert.equal(alteredRoute.publishable, false);
assert.ok(alteredRoute.blockers.includes('one_or_more_signal_scope_evidence_work_routes_do_not_match_policy'));

const upstreamMutatedRecords = structuredClone(built.records);
upstreamMutatedRecords[0].independentRepeatabilitySignalScopeDisposition.signalDispositions[0].state = states[1];
const upstreamMutated = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes(upstreamMutatedRecords, {
  dispositionRecords: [source],
  policy
});
assert.equal(upstreamMutated.publishable, false);
assert.ok(upstreamMutated.blockers.includes('routing_changed_upstream_signal_scope_or_repeatability_evidence'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].independentRepeatabilitySignalScopeEvidenceWorkReview.canonicalActivityScopeClassification = 'in_scope';
promotedRecords[0].independentRepeatabilitySignalScopeEvidenceWorkRouting.signalEvidenceWorkRoutes[0].evidenceWorkComplete = true;
promotedRecords[0].memberExpansionReview.state = 'reviewed';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes(promotedRecords, {
  dispositionRecords: [source],
  policy
});
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes(accountRecords, {
  dispositionRecords: [source],
  policy
});
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_signal_scope_evidence_work_routes'));

const inconsistentInput = input({ key: 'inconsistent', dispositionStates: [states[1]] });
inconsistentInput.state = 'independent_repeatability_signal_scope_disposition_input_blocked';
const inconsistent = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [inconsistentInput],
  policy
});
assert.equal(inconsistent.audit.publishable, false);
assert.ok(inconsistent.audit.blockers.includes('one_or_more_signal_scope_disposition_inputs_are_structurally_invalid'));

const duplicateSignalInput = input({ key: 'duplicates', dispositionStates: [states[1], states[2]] });
duplicateSignalInput.independentRepeatabilitySignalScopeDisposition.signalDispositions[1].signalEvidenceKey =
  duplicateSignalInput.independentRepeatabilitySignalScopeDisposition.signalDispositions[0].signalEvidenceKey;
const duplicateSignal = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords: [duplicateSignalInput],
  policy
});
assert.equal(duplicateSignal.audit.publishable, false);
assert.ok(duplicateSignal.audit.blockers.includes('one_or_more_signal_scope_disposition_inputs_are_structurally_invalid'));

const compiled = compileIndependentRepeatabilitySignalScopeEvidenceWorkRoutingPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidRouteDefinitions, []);
assert.deepEqual(compiled.missingEmittableStates, []);

console.log('Generic independent repeatability signal-scope evidence-work routing checks passed.');
