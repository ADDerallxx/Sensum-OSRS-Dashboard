import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes,
  buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes,
  compileCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutingPolicy
} from '../transforms/activity-reference-collection-member-canonical-activity-subject-declaration-semantic-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-semantic-evidence-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-semantic-evidence-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-semantic-evidence-work-routing-audit-v1.json', 'utf8'));

const states = [
  'structurally_qualified_subject_candidate_requires_revision_pinned_schema_semantics',
  'unresolved_no_structurally_qualified_subject_declaration_candidate',
  'blocked_multiple_structurally_qualified_subject_pages'
];

function dispositionRecord({ key = '1', state = states[0], label = `Activity ${key}` } = {}) {
  const candidateCount = state === states[0] ? 1 : state === states[1] ? 0 : 2;
  const candidatePageKeys = state === states[0] ? ['100|200'] : state === states[1] ? [] : ['100|200', '101|201'];
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    sourceCanonicalActivitySubjectDeclarationStructuralContextEvidenceContentHash: `structural-evidence-${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivitySubjectDeclarationStructuralDispositionSignals: [{
      evidenceKey: `signal:${key}`,
      evidenceUseClass: candidateCount ? 'structurally_qualified_page_subject_declaration_candidate' : 'cross_page_link_reference_not_subject_binding_evidence',
      subjectCandidate: candidateCount > 0,
      sourcePageIdentity: { sourcePageId: Number(key), resolvedTitle: `Source ${key}`, sourceRevision: `20${key}` },
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    }],
    canonicalActivitySubjectDeclarationStructuralDisposition: {
      state,
      structurallyQualifiedCandidateCount: candidateCount,
      candidatePageKeys,
      candidateEvidenceKeys: candidateCount ? [`signal:${key}`] : [],
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      deficiencies: []
    },
    canonicalActivitySubjectBinding: null,
    canonicalActivitySubjectDeclarationReview: {
      state: 'structural_context_disposed_additional_evidence_required',
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: candidateCount ? [`signal:${key}`] : []
    },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical_activity_subject_binding_unresolved', 'optimizer_eligibility_blocked'],
    state: policy.inputState,
    contentHash: `structural-disposition-${key}`
  };
}

const inputs = [
  dispositionRecord({ key: '1', state: states[0] }),
  dispositionRecord({ key: '2', state: states[1] }),
  dispositionRecord({ key: '3', state: states[2] })
];
const built = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: inputs, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.routingCoverage.routedCount, 3);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 3);
assert.equal(built.records[0].routingDecision.routeKey, 'collect_revision_pinned_activity_infobox_schema_semantics');
assert.equal(built.records[1].routingDecision.routeKey, 'discover_independent_canonical_activity_subject_page');
assert.equal(built.records[2].routingDecision.routeKey, 'reconcile_multiple_canonical_activity_subject_candidates');
assert.ok(built.records.every(record => record.routingDecision.routeState.startsWith('blocked_')));
assert.ok(built.records.every(record => record.canonicalActivitySubjectBinding === null && record.optimizerEligible === false));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = dispositionRecord({ key: '99', state: states[0], label: 'Completely renamed display label' });
renamed.canonicalActivitySubjectDeclarationStructuralDisposition.candidatePageKeys = ['999999|888888'];
const renamedBuilt = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: [renamed], policy });
assert.deepEqual(renamedBuilt.records[0].routingDecision, built.records[0].routingDecision);

const unknownInput = dispositionRecord({ key: '4', state: states[1] });
unknownInput.canonicalActivitySubjectDeclarationStructuralDisposition.state = 'future_unmapped_state';
const unknown = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: [unknownInput], policy });
assert.equal(unknown.audit.publishable, false);
assert.deepEqual(unknown.audit.policyCoverage.unmappedDispositionStates, ['future_unmapped_state']);

const incompletePolicy = structuredClone(policy);
delete incompletePolicy.stateRoutes[states[1]];
const missingRoute = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: [inputs[1]], policy: incompletePolicy });
assert.equal(missingRoute.audit.publishable, false);
assert.ok(missingRoute.audit.blockers.includes('canonical_activity_subject_declaration_semantic_evidence_work_routing_policy_invalid_or_incomplete'));

const identitySpecificPolicy = structuredClone(policy);
identitySpecificPolicy.overrides = { 'member:1': 'special_route' };
const identitySpecific = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: [inputs[0]], policy: identitySpecificPolicy });
assert.equal(identitySpecific.audit.publishable, false);

const autoVerificationPolicy = structuredClone(policy);
autoVerificationPolicy.rules.automaticVerificationAllowed = true;
const autoVerification = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: [inputs[0]], policy: autoVerificationPolicy });
assert.equal(autoVerification.audit.publishable, false);

const nonBlockedPolicy = structuredClone(policy);
nonBlockedPolicy.stateRoutes[states[0]].routeState = 'queued';
const nonBlocked = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: [inputs[0]], policy: nonBlockedPolicy });
assert.equal(nonBlocked.audit.publishable, false);

const alteredRoutes = structuredClone(built.records);
alteredRoutes[0].routingDecision.routeKey = 'activity_specific_route';
const alteredRouteAudit = auditCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes(alteredRoutes, { dispositionRecords: inputs, policy });
assert.equal(alteredRouteAudit.publishable, false);

const upstreamMutation = structuredClone(built.records);
upstreamMutation[0].canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict = 'bound';
const upstreamMutationAudit = auditCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes(upstreamMutation, { dispositionRecords: inputs, policy });
assert.equal(upstreamMutationAudit.publishable, false);
assert.ok(upstreamMutationAudit.blockers.includes('routing_changed_subject_disposition_binding_review_or_structural_signals'));

const promoted = structuredClone(built.records);
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes(promoted, { dispositionRecords: inputs, policy });
assert.equal(promotedAudit.publishable, false);

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes(accountScoped, { dispositionRecords: inputs, policy });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_subject_declaration_semantic_evidence_work_routes'));

const inconsistent = dispositionRecord({ key: '5', state: states[1] });
inconsistent.canonicalActivitySubjectDeclarationStructuralDisposition.structurallyQualifiedCandidateCount = 1;
const inconsistentBuilt = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: [inconsistent], policy });
assert.equal(inconsistentBuilt.audit.publishable, false);
assert.ok(inconsistentBuilt.audit.blockers.includes('one_or_more_structural_disposition_inputs_are_structurally_invalid'));

const deterministicA = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: inputs, policy });
const deterministicB = buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords: structuredClone(inputs), policy: structuredClone(policy) });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutingPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidRouteDefinitions, []);
assert.deepEqual(compiled.missingEmittableStates, []);

console.log('Generic canonical-activity subject-declaration semantic evidence-work routing checks passed.');
