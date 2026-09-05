import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityCanonicalSubjectScopeEvidenceWorkRoutes,
  buildActivityCanonicalSubjectScopeEvidenceWorkRoutes,
  compileActivityCanonicalSubjectScopeEvidenceWorkRoutingPolicy
} from '../transforms/activity-canonical-subject-scope-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-canonical-subject-scope-evidence-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-canonical-subject-scope-evidence-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-canonical-subject-scope-evidence-work-routing-audit-v1.json', 'utf8'));

function dispositionRecord({ key = '1', label = `Activity ${key}`, pageId = Number(key) + 100 } = {}) {
  const verdict = 'source_supported_canonical_activity_subject_declaration';
  const binding = {
    ruleKey: 'generic_subject_binding_rule',
    canonicalActivityKey: `activity:${key}`,
    canonicalActivityLabel: label,
    sourcePageIdentity: {
      sourcePageId: pageId,
      resolvedTitle: label,
      sourceRevision: `20${key}`,
      sourceContentHash: `source-${key}`,
      sourceTimestamp: '2026-01-01T00:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Activity_${key}`
    },
    sourceOccurrenceEvidence: { matchedText: label, exactSourceLines: `|name = ${label}` },
    structuralEvidenceKey: `structural:${key}`,
    schemaEvidenceKeys: [`schema:${key}:1`, `schema:${key}:2`],
    evidenceRevisionBoundary: {
      subjectSourceRevision: `20${key}`,
      schemaSources: [{ sourcePageId: 900, sourceRevision: '300', sourceContentHash: 'schema-source' }]
    },
    bindingClass: 'generic_revision_pinned_subject_binding',
    verdict,
    accountIndependent: true
  };
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    sourceActivityInfoboxSchemaSemanticsEvidenceContentHash: `schema-evidence-${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivitySubjectDeclarationDisposition: {
      state: 'source_supported_canonical_activity_subject_binding',
      verdict,
      bindingClass: binding.bindingClass,
      evidenceKeys: [binding.structuralEvidenceKey, ...binding.schemaEvidenceKeys],
      sufficiencyChecks: { complete: true },
      requiredCandidateChecks: ['candidate-check'],
      requiredSchemaObservations: ['schema-observation'],
      deficiencies: [],
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivitySubjectBinding: binding,
    canonicalActivitySubjectDeclarationReview: {
      state: 'reviewed_source_supported_canonical_activity_subject_binding',
      canonicalActivitySubjectDeclarationVerdict: verdict,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: [binding.structuralEvidenceKey, ...binding.schemaEvidenceKeys]
    },
    activityInfoboxSchemaSemanticsReview: {
      state: 'reviewed_schema_semantics_support_exact_structural_subject_binding',
      canonicalActivitySubjectDeclarationVerdict: verdict,
      canonicalActivitySubjectBinding: binding,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: binding.schemaEvidenceKeys
    },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: [
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ],
    state: policy.eligibleInputState,
    contentHash: `subject-binding-disposition-${key}`
  };
}

const input = dispositionRecord();
const built = buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.canonicalActivitySubjectBindingReviewComplete, true);
assert.equal(built.audit.canonicalActivityScopeReviewComplete, false);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.inputCoverage.exactEligibleInputOutputSetAndContextMatch, true);
assert.equal(built.audit.routingCoverage.routedCount, 1);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 1);
assert.equal(built.audit.semanticPromotionCoverage.preservedCanonicalActivitySubjectBindingCount, 1);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivityScopeClassificationCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.repeatabilityClassificationCount, 0);
assert.equal(built.records[0].routingDecision.routeKey, 'collect_revision_pinned_canonical_activity_scope_evidence');
assert.equal(built.records[0].routingDecision.routeState, 'blocked_canonical_activity_scope_evidence_gap');
assert.deepEqual(built.records[0].canonicalActivitySubjectBinding, input.canonicalActivitySubjectBinding);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = dispositionRecord({ key: '2', label: 'Completely renamed activity', pageId: 999999 });
const renamedBuilt = buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [renamed], policy });
assert.deepEqual(renamedBuilt.records[0].routingDecision, built.records[0].routingDecision);

const blocked = dispositionRecord({ key: '3' });
blocked.state = 'canonical_activity_subject_declaration_disposition_blocked_incomplete_or_inconsistent_evidence';
blocked.canonicalActivitySubjectDeclarationDisposition.state = 'blocked_incomplete_or_inconsistent_subject_binding_evidence';
blocked.canonicalActivitySubjectDeclarationDisposition.verdict = null;
blocked.canonicalActivitySubjectBinding = null;
blocked.canonicalActivitySubjectDeclarationReview.state = 'reviewed_blocked_incomplete_or_inconsistent_evidence';
blocked.canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict = null;
blocked.activityInfoboxSchemaSemanticsReview.state = 'reviewed_blocked_incomplete_or_inconsistent_evidence';
blocked.activityInfoboxSchemaSemanticsReview.canonicalActivitySubjectDeclarationVerdict = null;
blocked.activityInfoboxSchemaSemanticsReview.canonicalActivitySubjectBinding = null;
const blockedBuilt = buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [blocked], policy });
assert.equal(blockedBuilt.records.length, 0);
assert.equal(blockedBuilt.audit.publishable, false);
assert.ok(blockedBuilt.audit.blockers.includes('no_source_supported_canonical_activity_subject_bindings'));

const incoherent = dispositionRecord({ key: '4' });
incoherent.canonicalActivitySubjectBinding.canonicalActivityKey = 'activity:different';
const incoherentBuilt = buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [incoherent], policy });
assert.equal(incoherentBuilt.audit.publishable, false);
assert.ok(incoherentBuilt.audit.blockers.includes('one_or_more_subject_binding_inputs_are_incoherent_or_retain_resolved_blockers'));

const stale = dispositionRecord({ key: '5' });
stale.blockers.push('activity_infobox_name_schema_semantics_not_revision_pinned');
const staleBuilt = buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [stale], policy });
assert.equal(staleBuilt.audit.publishable, false);

const duplicateBuilt = buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [input, structuredClone(input)], policy });
assert.equal(duplicateBuilt.audit.publishable, false);

const activitySpecificPolicy = structuredClone(policy);
activitySpecificPolicy.overrides = { 'member:1': 'special_route' };
assert.equal(buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [input], policy: activitySpecificPolicy }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [input], policy: automaticPolicy }).audit.publishable, false);

const nonBlockedPolicy = structuredClone(policy);
nonBlockedPolicy.route.routeState = 'queued';
assert.equal(buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [input], policy: nonBlockedPolicy }).audit.publishable, false);

const alteredRoute = structuredClone(built.records);
alteredRoute[0].routingDecision.routeKey = 'activity_specific_route';
const alteredRouteAudit = auditActivityCanonicalSubjectScopeEvidenceWorkRoutes(alteredRoute, { dispositionRecords: [input], policy });
assert.equal(alteredRouteAudit.publishable, false);

const mutatedSubject = structuredClone(built.records);
mutatedSubject[0].canonicalActivitySubjectBinding.canonicalActivityLabel = 'Mutated';
const mutatedSubjectAudit = auditActivityCanonicalSubjectScopeEvidenceWorkRoutes(mutatedSubject, { dispositionRecords: [input], policy });
assert.equal(mutatedSubjectAudit.publishable, false);
assert.ok(mutatedSubjectAudit.blockers.includes('routing_changed_subject_binding_identity_disposition_or_review'));

const promoted = structuredClone(built.records);
promoted[0].canonicalActivitySubjectDeclarationReview.canonicalActivityScopeVerdict = 'training_activity';
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].mechanicsReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditActivityCanonicalSubjectScopeEvidenceWorkRoutes(promoted, { dispositionRecords: [input], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditActivityCanonicalSubjectScopeEvidenceWorkRoutes(accountScoped, { dispositionRecords: [input], policy });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_canonical_activity_scope_evidence_work_routes'));

const deterministicA = buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [input], policy });
const deterministicB = buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileActivityCanonicalSubjectScopeEvidenceWorkRoutingPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidRoute, []);

console.log('Generic bound canonical-activity subject scope evidence-work routing checks passed.');
