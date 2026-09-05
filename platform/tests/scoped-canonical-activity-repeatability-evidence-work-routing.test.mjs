import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes,
  buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes,
  compileScopedCanonicalActivityRepeatabilityEvidenceWorkRoutingPolicy
} from '../transforms/scoped-canonical-activity-repeatability-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/scoped-canonical-activity-repeatability-evidence-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/scoped-canonical-activity-repeatability-evidence-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/scoped-canonical-activity-repeatability-evidence-work-routing-audit-v1.json', 'utf8'));

function scopeDispositionRecord({ key = '1', label = `Activity ${key}`, pageId = Number(key) + 100 } = {}) {
  const scopeVerdict = policy.eligibleScopeVerdict;
  const canonicalActivityKey = `activity:${key}`;
  const sourcePageIdentity = {
    sourcePageId: pageId,
    resolvedTitle: label,
    sourceRevision: `20${key}`,
    sourceContentHash: `source-${key}`,
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Activity_${key}`
  };
  const evidenceSignal = {
    signalKey: 'multiple_tasks_assigned',
    sourceEvidenceKey: `scope-source:${key}`,
    exactSourceLine: 'An NPC can assign various tasks.',
    exactSourceLineContentHash: `line-${key}`,
    sourceLocator: { lineStart: 1, lineEnd: 1 },
    evidenceKey: `scope-source:${key}:multiple_tasks_assigned:1:0`
  };
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey, canonicalLabel: label },
    canonicalActivitySubjectBinding: {
      bindingClass: 'revision_pinned_title_aligned_activity_infobox_name_subject',
      canonicalActivityKey,
      canonicalActivityLabel: label,
      sourcePageIdentity,
      verdict: 'source_supported_canonical_activity_subject_declaration',
      accountIndependent: true
    },
    canonicalActivitySubjectDeclarationReview: {
      state: 'reviewed_source_supported_canonical_activity_subject_binding',
      canonicalActivitySubjectDeclarationVerdict: 'source_supported_canonical_activity_subject_declaration',
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: []
    },
    canonicalActivityScopeEvidence: {
      evidenceState: 'complete_revision_pinned_canonical_activity_scope_evidence_packet',
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      sourceEvidenceKeys: [`scope-source:${key}`]
    },
    canonicalActivityScopeEvidenceSources: [{
      sourceEvidenceKey: `scope-source:${key}`,
      sourcePageIdentity,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      state: 'complete_revision_pinned_canonical_activity_scope_source'
    }],
    canonicalActivityScopeDisposition: {
      state: 'source_supported_composite_assigned_task_activity_scope',
      ruleKey: 'revision_pinned_composite_assigned_task_activity_scope',
      canonicalActivityScopeVerdict: scopeVerdict,
      scopeClass: 'composite_assigned_task_activity',
      memberUniverseState: 'declared_total_with_non_exhaustive_member_inventory',
      assignmentConditionState: 'account_level_and_self_creation_skill_conditioned',
      declaredTaskCount: 59,
      memberInventoryComplete: false,
      evidenceSignals: [evidenceSignal],
      evidenceKeys: [evidenceSignal.evidenceKey],
      repeatabilityVerdict: null
    },
    canonicalActivityScopeReview: {
      state: 'reviewed_source_supported_composite_assigned_task_activity_scope',
      canonicalActivitySubjectDeclarationVerdict: 'source_supported_canonical_activity_subject_declaration',
      canonicalActivityScopeVerdict: scopeVerdict,
      scopeClass: 'composite_assigned_task_activity',
      declaredTaskCount: 59,
      memberUniverseState: 'declared_total_with_non_exhaustive_member_inventory',
      assignmentConditionState: 'account_level_and_self_creation_skill_conditioned',
      repeatabilityVerdict: null,
      evidenceKeys: [evidenceSignal.evidenceKey]
    },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: [
      'source_declares_member_inventory_may_not_be_exhaustive',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ],
    state: policy.eligibleInputState,
    contentHash: `scope-disposition-${key}`
  };
}

const input = scopeDispositionRecord();
const built = buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.canonicalActivityScopeReviewComplete, true);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.memberExpansionComplete, false);
assert.equal(built.audit.mechanicsReviewComplete, false);
assert.equal(built.audit.inputCoverage.exactEligibleInputOutputSetAndContextMatch, true);
assert.equal(built.audit.routingCoverage.routedCount, 1);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 1);
assert.equal(built.audit.routingCoverage.parentAndMemberRepeatabilitySeparatedCount, 1);
assert.equal(built.audit.semanticPreservationCoverage.preservedCanonicalActivityScopeClassificationCount, 1);
assert.equal(built.audit.semanticPreservationCoverage.repeatabilityClassificationCount, 0);
assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
const output = built.records[0];
assert.equal(output.canonicalActivityRepeatabilityEvidenceWorkRouting.routeKey, 'collect_revision_pinned_scoped_canonical_activity_repeatability_evidence');
assert.equal(output.canonicalActivityRepeatabilityEvidenceWorkRouting.routeState, 'blocked_scoped_canonical_activity_repeatability_evidence_gap');
assert.deepEqual(output.canonicalActivityRepeatabilityEvidenceWorkRouting.requiredEvidenceDomains, policy.route.requiredEvidenceDomains);
assert.equal(output.canonicalActivityRepeatabilityEvidenceWorkRouting.requiredEvidenceDomains.length, 6);
assert.equal(output.canonicalActivityRepeatabilityEvidenceWorkRouting.parentAndMemberRepeatabilitySeparated, true);
assert.deepEqual(output.canonicalActivityScopeDisposition, input.canonicalActivityScopeDisposition);
assert.deepEqual(output.canonicalActivityScopeReview, input.canonicalActivityScopeReview);
assert.equal(output.canonicalActivityScopeReview.repeatabilityVerdict, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = scopeDispositionRecord({ key: '2', label: 'Completely renamed activity', pageId: 999999 });
const renamedBuilt = buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [renamed], policy });
assert.deepEqual(renamedBuilt.records[0].canonicalActivityRepeatabilityEvidenceWorkRouting, output.canonicalActivityRepeatabilityEvidenceWorkRouting);

const unsupported = scopeDispositionRecord({ key: '3' });
unsupported.state = 'canonical_activity_scope_disposition_blocked_incomplete_or_inconsistent_evidence';
unsupported.canonicalActivityScopeDisposition.state = 'blocked_incomplete_or_inconsistent_scope_evidence';
unsupported.canonicalActivityScopeDisposition.canonicalActivityScopeVerdict = null;
unsupported.canonicalActivityScopeReview.state = 'reviewed_blocked_incomplete_or_inconsistent_scope_evidence';
unsupported.canonicalActivityScopeReview.canonicalActivityScopeVerdict = null;
const unsupportedBuilt = buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [unsupported], policy });
assert.equal(unsupportedBuilt.records.length, 0);
assert.equal(unsupportedBuilt.audit.publishable, false);
assert.ok(unsupportedBuilt.audit.blockers.includes('no_source_supported_scoped_canonical_activities'));

const incoherent = scopeDispositionRecord({ key: '4' });
incoherent.canonicalActivityScopeDisposition.memberInventoryComplete = true;
const incoherentBuilt = buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [incoherent], policy });
assert.equal(incoherentBuilt.audit.publishable, false);
assert.ok(incoherentBuilt.audit.blockers.includes('one_or_more_scoped_activity_inputs_are_incoherent_or_retain_resolved_scope_blockers'));

const stale = scopeDispositionRecord({ key: '5' });
stale.blockers.push('canonical_activity_scope_review_incomplete');
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [stale], policy }).audit.publishable, false);

const duplicateBuilt = buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [input, structuredClone(input)], policy });
assert.equal(duplicateBuilt.audit.publishable, false);

const activitySpecificPolicy = structuredClone(policy);
activitySpecificPolicy.overrides = { 'member:1': 'special_route' };
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [input], policy: activitySpecificPolicy }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [input], policy: automaticPolicy }).audit.publishable, false);

const changedDomainsPolicy = structuredClone(policy);
changedDomainsPolicy.route.requiredEvidenceDomains = changedDomainsPolicy.route.requiredEvidenceDomains.slice(0, 5);
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [input], policy: changedDomainsPolicy }).audit.publishable, false);

const nonBlockedPolicy = structuredClone(policy);
nonBlockedPolicy.route.routeState = 'queued';
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [input], policy: nonBlockedPolicy }).audit.publishable, false);

const alteredRoute = structuredClone(built.records);
alteredRoute[0].canonicalActivityRepeatabilityEvidenceWorkRouting.routeKey = 'activity_specific_route';
assert.equal(auditScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes(alteredRoute, { scopeDispositionRecords: [input], policy }).publishable, false);

const mutatedScope = structuredClone(built.records);
mutatedScope[0].canonicalActivityScopeReview.scopeClass = 'mutated';
const mutatedScopeAudit = auditScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes(mutatedScope, { scopeDispositionRecords: [input], policy });
assert.equal(mutatedScopeAudit.publishable, false);
assert.ok(mutatedScopeAudit.blockers.includes('routing_changed_scope_identity_evidence_binding_disposition_or_review'));

const promoted = structuredClone(built.records);
promoted[0].canonicalActivityScopeReview.repeatabilityVerdict = 'repeatable';
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].mechanicsReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes(promoted, { scopeDispositionRecords: [input], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('unsupported_parent_member_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes(accountScoped, { scopeDispositionRecords: [input], policy });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_scoped_activity_repeatability_evidence_work_routes'));

const deterministicA = buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [input], policy });
const deterministicB = buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileScopedCanonicalActivityRepeatabilityEvidenceWorkRoutingPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidRoute, []);

console.log('Generic scoped canonical-activity repeatability evidence-work routing checks passed.');
