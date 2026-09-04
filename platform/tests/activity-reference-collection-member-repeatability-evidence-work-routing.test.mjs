import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes,
  buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes
} from '../transforms/activity-reference-collection-member-repeatability-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-repeatability-evidence-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-evidence-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-evidence-work-routing-audit-v1.json', 'utf8'));

const stateClassification = state => {
  if (state === 'source_supported_repeatable_activity') return 'repeatable';
  if (state === 'source_supported_non_repeatable_activity') return 'non_repeatable';
  return null;
};

const dispositionRecord = ({ key = '1', state = 'source_supported_repeatable_activity', label = `Activity ${key}` } = {}) => {
  const classification = stateClassification(state);
  const supported = state.startsWith('source_supported_');
  return {
    contract: 'sensum.activity-reference-collection-member-repeatability-disposition.v1',
    memberCandidateKey: `member:${key}`,
    sourceRepeatabilityEvidenceContentHash: `repeatability-evidence-${key}`,
    sourcePageId: Number(key),
    resolvedTitle: `Source ${key}`,
    sourceRevision: `20${key}`,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    collectionContext: { memberCellEvidence: { plainText: label }, membershipClassification: 'example_collection_class' },
    canonicalActivityIdentity: {
      canonicalActivityKey: `activity:${key}`,
      canonicalLabel: label,
      identityClass: 'collection_defined_activity'
    },
    repeatabilityDispositionSignals: supported ? [{ evidenceKey: `signal:${key}`, classification }] : [],
    repeatabilityDisposition: {
      state,
      classification,
      evidenceKeys: supported ? [`signal:${key}`] : [],
      deficiencies: supported ? [] : ['repeatability_evidence_unresolved']
    },
    repeatabilityReview: {
      state: supported ? 'reviewed_source_supported' : 'reviewed_blocked',
      classification,
      evidenceKeys: supported ? [`signal:${key}`] : []
    },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['member_expansion_not_reviewed', 'optimizer_eligibility_blocked'],
    state: supported ? 'repeatability_source_supported_downstream_gates_closed' : 'repeatability_disposition_reviewed_unresolved',
    contentHash: `repeatability-disposition-${key}`
  };
};

const inputs = [
  dispositionRecord({ key: '1' }),
  dispositionRecord({ key: '2', state: 'source_supported_non_repeatable_activity' }),
  dispositionRecord({ key: '3', state: 'blocked_conflicting_explicit_repeatability_declarations' }),
  dispositionRecord({ key: '4', state: 'unresolved_explicit_repeatability_declaration_scope_not_established' }),
  dispositionRecord({ key: '5', state: 'unresolved_recurrence_or_session_structure_without_explicit_declaration' }),
  dispositionRecord({ key: '6', state: 'unresolved_no_explicit_repeatability_evidence' }),
  dispositionRecord({ key: '7', state: 'unresolved_incomplete_repeatability_evidence' })
];

const built = buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes({ dispositionRecords: inputs, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.routingCoverage.routedCount, 7);
assert.equal(built.audit.routingCoverage.queuedCount, 2);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 5);
assert.equal(built.records[0].routingDecision.routeKey, 'repeatable_activity_member_expansion_and_mechanics_review');
assert.equal(built.records[1].routingDecision.routeKey, 'non_repeatable_activity_authoritative_exclusion_scope_review');
assert.equal(built.records[2].routingDecision.routeKey, 'repeatability_declaration_conflict_reconciliation');
assert.equal(built.records[3].routingDecision.routeKey, 'explicit_repeatability_declaration_scope_review');
assert.equal(built.records[4].routingDecision.routeKey, 'broader_repeatability_evidence_discovery_from_structural_signals');
assert.equal(built.records[5].routingDecision.routeKey, 'broader_repeatability_evidence_discovery_without_signals');
assert.equal(built.records[6].routingDecision.routeKey, 'repeatability_evidence_packet_repair');
assert.equal(built.records[0].memberExpansionReview.state, 'unreviewed');
assert.equal(built.records[0].mechanicsReview.state, 'unreviewed');
assert.equal(built.records[0].optimizerEligible, false);
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes({
  dispositionRecords: [dispositionRecord({ key: '99', label: 'Completely renamed activity' })],
  policy
});
assert.deepEqual(renamed.records[0].routingDecision, built.records[0].routingDecision);

const unknownStateInput = dispositionRecord({ key: '8' });
unknownStateInput.repeatabilityDisposition.state = 'future_unmapped_state';
unknownStateInput.repeatabilityDisposition.classification = null;
unknownStateInput.repeatabilityReview = { state: 'reviewed_blocked', classification: null, evidenceKeys: [] };
const unknownState = buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [unknownStateInput], policy });
assert.equal(unknownState.audit.publishable, false);
assert.deepEqual(unknownState.audit.policyCoverage.unmappedDispositionStates, ['future_unmapped_state']);

const incompletePolicy = structuredClone(policy);
delete incompletePolicy.stateRoutes.unresolved_no_explicit_repeatability_evidence;
const incomplete = buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [inputs[5]], policy: incompletePolicy });
assert.equal(incomplete.audit.publishable, false);
assert.ok(incomplete.audit.blockers.includes('repeatability_evidence_work_routing_policy_invalid_or_incomplete'));

const identitySpecificPolicy = structuredClone(policy);
identitySpecificPolicy.membershipClassifications = ['example_collection_class'];
const identitySpecific = buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [inputs[0]], policy: identitySpecificPolicy });
assert.equal(identitySpecific.audit.publishable, false);
assert.ok(identitySpecific.audit.blockers.includes('repeatability_evidence_work_routing_policy_invalid_or_incomplete'));

const invalidRoutePolicy = structuredClone(policy);
invalidRoutePolicy.stateRoutes.unresolved_no_explicit_repeatability_evidence.routeState = 'queued';
const invalidRoute = buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [inputs[5]], policy: invalidRoutePolicy });
assert.equal(invalidRoute.audit.publishable, false);
assert.ok(invalidRoute.audit.blockers.includes('repeatability_evidence_work_routing_policy_invalid_or_incomplete'));

const alteredRouteRecords = structuredClone(built.records);
alteredRouteRecords[0].routingDecision.routeKey = 'name_selected_route';
const alteredRoute = auditActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes(alteredRouteRecords, { dispositionRecords: inputs, policy });
assert.equal(alteredRoute.publishable, false);
assert.ok(alteredRoute.blockers.includes('one_or_more_repeatability_evidence_work_routes_do_not_match_policy'));

const alteredRepeatabilityRecords = structuredClone(built.records);
alteredRepeatabilityRecords[4].repeatabilityDisposition.classification = 'repeatable';
const alteredRepeatability = auditActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes(alteredRepeatabilityRecords, { dispositionRecords: inputs, policy });
assert.equal(alteredRepeatability.publishable, false);
assert.ok(alteredRepeatability.blockers.includes('routing_changed_repeatability_disposition_or_review'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].memberExpansionReview.state = 'reviewed';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes(promotedRecords, { dispositionRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].accountState = { currentBaseLevel: 34 };
const accountInjected = auditActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes(accountRecords, { dispositionRecords: inputs, policy });
assert.equal(accountInjected.publishable, false);
assert.ok(accountInjected.blockers.includes('account_query_state_baked_into_repeatability_evidence_work_routes'));

const inconsistentInput = dispositionRecord({ key: '9' });
inconsistentInput.repeatabilityDisposition.classification = 'non_repeatable';
const inconsistent = buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [inconsistentInput], policy });
assert.equal(inconsistent.audit.publishable, false);
assert.ok(inconsistent.audit.blockers.includes('one_or_more_repeatability_disposition_inputs_are_structurally_invalid'));

console.log('Generic repeatability evidence-work routing checks passed.');
