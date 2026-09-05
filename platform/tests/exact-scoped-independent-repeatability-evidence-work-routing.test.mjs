import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditExactScopedIndependentRepeatabilityEvidenceWorkRoutes,
  buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes,
  compileExactScopedIndependentRepeatabilityEvidenceWorkRoutingPolicy
} from '../transforms/exact-scoped-independent-repeatability-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/exact-scoped-independent-repeatability-evidence-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/exact-scoped-independent-repeatability-evidence-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/exact-scoped-independent-repeatability-evidence-work-routing-audit-v1.json', 'utf8'));
const domains = policy.requiredEvidenceDomains;

function input({ key = '1', label = `Activity ${key}` } = {}) {
  const assessments = domains.map(domainKey => ({ domainKey, resolved: false, domainVerdict: null, parentActivityRepeatabilityVerdict: null, memberTaskRepeatabilityVerdict: null }));
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    independentScopedActivityRepeatabilityEvidence: { evidenceState: 'complete', repeatabilityVerdict: null },
    independentScopedActivityRepeatabilityDispositionSignals: [],
    independentScopedActivityRepeatabilityDisposition: { state: policy.inputDispositionState, classification: null, parentActivityRepeatabilityVerdict: null, memberTaskRepeatabilityVerdict: null, repeatabilityVerdict: null, evidenceDomainAssessments: assessments, unresolvedEvidenceDomains: domains },
    independentScopedActivityRepeatabilityReview: { state: 'reviewed_blocked_no_resolved_exact_scoped_independent_claim', resolvedDomainCount: 0, parentActivityRepeatabilityVerdict: null, memberTaskRepeatabilityVerdict: null, repeatabilityVerdict: null, evidenceWorkComplete: false },
    independentScopedActivityRepeatabilityNextEvidenceWork: { state: 'required', routeKey: policy.requiredSourceRoute.routeKey, routeState: policy.requiredSourceRoute.routeState, requiredEvidenceDomains: domains, requireExactSameLineSubjectPredicateScope: true, crossLineCrossPageAndCrossSourceJoinAllowed: false, mustPreserveParentMemberSeparation: true },
    memberExpansionReview: { state: 'unreviewed', evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['exact_subject_predicate_independent_evidence_work_not_completed'],
    state: policy.inputState,
    contentHash: `input-${key}`
  };
}

const source = input();
const built = buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [source], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.routingCoverage.domainWorkItemCount, 6);
assert.equal(built.audit.routingCoverage.blockedWorkItemCount, 6);
assert.equal(built.audit.routingCoverage.completedWorkItemCount, 0);
assert.equal(built.audit.routingCoverage.sameLineRequiredWorkItemCount, 6);
assert.equal(built.audit.routingCoverage.crossJoinAllowedWorkItemCount, 0);
const output = built.records[0];
assert.equal(output.exactScopedIndependentRepeatabilityEvidenceWorkRouting.routeKey, policy.requiredSourceRoute.routeKey);
assert.equal(output.exactScopedIndependentRepeatabilityEvidenceWorkRouting.sameLineExactSubjectPredicateRequired, true);
assert.equal(output.exactScopedIndependentRepeatabilityEvidenceWorkRouting.crossLineCrossSectionCrossPageAndCrossSourceJoinsAllowed, false);
assert.deepEqual(output.exactScopedIndependentRepeatabilityEvidenceWorkRouting.domainEvidenceWorkItems.map(item => item.domainKey), domains);
assert.ok(output.exactScopedIndependentRepeatabilityEvidenceWorkRouting.domainEvidenceWorkItems.every(item => item.evidenceWorkComplete === false && item.requireExactSameLineSubjectPredicateScope === true && item.crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed === false));
assert.equal(output.exactScopedIndependentRepeatabilityEvidenceWorkReview.repeatabilityVerdict, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const multiple = buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [source, input({ key: '2' })], policy });
assert.equal(multiple.audit.publishable, true);
assert.equal(multiple.audit.routingCoverage.domainWorkItemCount, 12);

const renamed = buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [input({ key: '3', label: 'Renamed label' })], policy });
assert.deepEqual(renamed.records[0].exactScopedIndependentRepeatabilityEvidenceWorkRouting, output.exactScopedIndependentRepeatabilityEvidenceWorkRouting);

const incomplete = input({ key: '4' });
incomplete.independentScopedActivityRepeatabilityDisposition.evidenceDomainAssessments[0].resolved = true;
assert.equal(buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [incomplete], policy }).audit.publishable, false);

const relaxed = input({ key: '5' });
relaxed.independentScopedActivityRepeatabilityNextEvidenceWork.requireExactSameLineSubjectPredicateScope = false;
assert.equal(buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [relaxed], policy }).audit.publishable, false);

assert.equal(buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [source, structuredClone(source)], policy }).audit.publishable, false);

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'member:1': 'special' };
assert.equal(compileExactScopedIndependentRepeatabilityEvidenceWorkRoutingPolicy(specificPolicy).valid, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(compileExactScopedIndependentRepeatabilityEvidenceWorkRoutingPolicy(automaticPolicy).valid, false);

const missingDefinition = structuredClone(policy);
missingDefinition.domainWorkDefinitions.pop();
assert.equal(compileExactScopedIndependentRepeatabilityEvidenceWorkRoutingPolicy(missingDefinition).valid, false);

const mutated = structuredClone(built.records);
mutated[0].canonicalActivityIdentity.canonicalLabel = 'Changed';
assert.equal(auditExactScopedIndependentRepeatabilityEvidenceWorkRoutes(mutated, { dispositionRecords: [source], policy }).publishable, false);

const relaxedOutput = structuredClone(built.records);
relaxedOutput[0].exactScopedIndependentRepeatabilityEvidenceWorkRouting.domainEvidenceWorkItems[0].crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed = true;
assert.equal(auditExactScopedIndependentRepeatabilityEvidenceWorkRoutes(relaxedOutput, { dispositionRecords: [source], policy }).publishable, false);

const promoted = structuredClone(built.records);
promoted[0].exactScopedIndependentRepeatabilityEvidenceWorkRouting.domainEvidenceWorkItems[0].evidenceWorkComplete = true;
promoted[0].exactScopedIndependentRepeatabilityEvidenceWorkReview.completedWorkItemCount = 1;
promoted[0].independentScopedActivityRepeatabilityDisposition.repeatabilityVerdict = 'repeatable';
promoted[0].optimizerEligible = true;
const promotedAudit = auditExactScopedIndependentRepeatabilityEvidenceWorkRoutes(promoted, { dispositionRecords: [source], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('unsupported_evidence_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(auditExactScopedIndependentRepeatabilityEvidenceWorkRoutes(accountScoped, { dispositionRecords: [source], policy }).publishable, false);

const deterministic = buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes({ dispositionRecords: [structuredClone(source)], policy: structuredClone(policy) });
assert.deepEqual(deterministic, built);

console.log('Generic exact-scoped independent repeatability evidence-work routing checks passed.');
