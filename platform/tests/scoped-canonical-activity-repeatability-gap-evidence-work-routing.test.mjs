import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes,
  buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes,
  compileScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutingPolicy
} from '../transforms/scoped-canonical-activity-repeatability-gap-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/scoped-canonical-activity-repeatability-gap-evidence-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/scoped-canonical-activity-repeatability-gap-evidence-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/scoped-canonical-activity-repeatability-gap-evidence-work-routing-audit-v1.json', 'utf8'));
const domains = policy.route.requiredEvidenceDomains;

function input({ key = '1', label = `Activity ${key}` } = {}) {
  const assessments = domains.map(domainKey => ({
    domainKey,
    sourceLocatedSignalCount: 0,
    signalEvidenceKeys: [],
    dispositionState: `unresolved_${domainKey}`,
    resolved: false,
    parentActivityRepeatabilityVerdict: null,
    memberTaskRepeatabilityVerdict: null
  }));
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivityScopeDisposition: { state: 'source_supported_composite_assigned_task_activity_scope', repeatabilityVerdict: null },
    canonicalActivityScopeReview: { state: 'reviewed_source_supported_composite_assigned_task_activity_scope', canonicalActivityScopeVerdict: 'source_supported_composite_assigned_task_activity_scope', repeatabilityVerdict: null },
    canonicalActivityRepeatabilityDispositionSignals: [],
    canonicalActivityRepeatabilityDisposition: {
      state: policy.eligibleDispositionState,
      classification: null,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceDomainAssessments: assessments,
      unresolvedEvidenceDomains: domains
    },
    canonicalActivityRepeatabilityReview: {
      state: 'reviewed_blocked_insufficient_parent_and_member_repeatability_evidence',
      classification: null,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivityRepeatabilityNextEvidenceWork: {
      state: 'required',
      routeKey: policy.requiredSourceRoute.routeKey,
      routeState: policy.requiredSourceRoute.routeState,
      requiredEvidenceDomains: domains,
      mustPreserveParentMemberSeparation: true
    },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['repeatability_classification_unresolved', 'independent_scoped_activity_repeatability_evidence_work_not_completed'],
    state: policy.eligibleInputState,
    contentHash: `disposition-${key}`
  };
}

const source = input();
const built = buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [source], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.canonicalActivityScopeReviewComplete, true);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.inputCoverage.exactEligibleInputOutputSetAndContextMatch, true);
assert.equal(built.audit.routingCoverage.routedCount, 1);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 1);
assert.equal(built.audit.routingCoverage.requiredDomainWorkItemCount, 6);
assert.equal(built.audit.routingCoverage.domainWorkItemCount, 6);
assert.equal(built.audit.routingCoverage.blockedDomainWorkItemCount, 6);
assert.equal(built.audit.routingCoverage.completedDomainWorkItemCount, 0);
const output = built.records[0];
assert.equal(output.canonicalActivityRepeatabilityGapEvidenceWorkRouting.routeKey, policy.route.routeKey);
assert.equal(output.canonicalActivityRepeatabilityGapEvidenceWorkRouting.routeState, policy.route.routeState);
assert.deepEqual(output.canonicalActivityRepeatabilityGapEvidenceWorkRouting.domainEvidenceWorkItems.map(item => item.domainKey), domains);
assert.ok(output.canonicalActivityRepeatabilityGapEvidenceWorkRouting.domainEvidenceWorkItems.every(item => item.workState.startsWith('blocked_') && item.evidenceWorkComplete === false));
assert.equal(output.canonicalActivityRepeatabilityGapEvidenceWorkReview.repeatabilityVerdict, null);
assert.deepEqual(output.canonicalActivityRepeatabilityDisposition, source.canonicalActivityRepeatabilityDisposition);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const multiple = buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [source, input({ key: '2' })], policy });
assert.equal(multiple.audit.publishable, true);
assert.equal(multiple.audit.routingCoverage.requiredDomainWorkItemCount, 12);
assert.equal(multiple.audit.routingCoverage.domainWorkItemCount, 12);

const renamed = buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [input({ key: '3', label: 'Renamed display label' })], policy });
assert.deepEqual(renamed.records[0].canonicalActivityRepeatabilityGapEvidenceWorkRouting, output.canonicalActivityRepeatabilityGapEvidenceWorkRouting);

const unsupported = input({ key: '4' });
unsupported.state = 'future_state';
const unsupportedBuilt = buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [unsupported], policy });
assert.equal(unsupportedBuilt.records.length, 0);
assert.equal(unsupportedBuilt.audit.publishable, false);

const incoherent = input({ key: '5' });
incoherent.canonicalActivityRepeatabilityDisposition.unresolvedEvidenceDomains = domains.slice(1);
assert.equal(buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [incoherent], policy }).audit.publishable, false);

assert.equal(buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [source, structuredClone(source)], policy }).audit.publishable, false);

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'member:1': 'special_route' };
assert.equal(buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [source], policy: specificPolicy }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [source], policy: automaticPolicy }).audit.publishable, false);

const missingDomainPolicy = structuredClone(policy);
missingDomainPolicy.domainWorkDefinitions = missingDomainPolicy.domainWorkDefinitions.slice(0, 5);
assert.equal(buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [source], policy: missingDomainPolicy }).audit.publishable, false);

const nonBlockedPolicy = structuredClone(policy);
nonBlockedPolicy.route.routeState = 'queued';
assert.equal(buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [source], policy: nonBlockedPolicy }).audit.publishable, false);

const altered = structuredClone(built.records);
altered[0].canonicalActivityRepeatabilityGapEvidenceWorkRouting.domainEvidenceWorkItems[0].evidenceObjective = 'activity-specific shortcut';
assert.equal(auditScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes(altered, { dispositionRecords: [source], policy }).publishable, false);

const mutated = structuredClone(built.records);
mutated[0].canonicalActivityRepeatabilityReview.state = 'mutated';
const mutatedAudit = auditScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes(mutated, { dispositionRecords: [source], policy });
assert.equal(mutatedAudit.publishable, false);
assert.ok(mutatedAudit.blockers.includes('routing_changed_upstream_scope_or_repeatability_disposition'));

const promoted = structuredClone(built.records);
promoted[0].canonicalActivityRepeatabilityGapEvidenceWorkRouting.domainEvidenceWorkItems[0].evidenceWorkComplete = true;
promoted[0].canonicalActivityRepeatabilityGapEvidenceWorkReview.repeatabilityVerdict = 'repeatable';
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes(promoted, { dispositionRecords: [source], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('unsupported_repeatability_evidence_member_mechanics_or_optimizer_promotion'));

const selectivelyPromoted = structuredClone(multiple.records);
selectivelyPromoted[0].canonicalActivityRepeatabilityGapEvidenceWorkRouting.domainEvidenceWorkItems[0].evidenceWorkComplete = true;
const selectiveAudit = auditScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes(selectivelyPromoted, {
  dispositionRecords: [source, input({ key: '2' })],
  policy
});
assert.deepEqual(selectiveAudit.semanticPreservationCoverage.unsupportedPromotionMemberCandidateKeys, ['member:1']);

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(auditScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes(accountScoped, { dispositionRecords: [source], policy }).publishable, false);

const deterministicA = buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [source], policy });
const deterministicB = buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords: [structuredClone(source)], policy: structuredClone(policy) });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutingPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidRoute, []);

console.log('Generic scoped canonical-activity repeatability-gap evidence-work routing checks passed.');
