import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditExactScopedIndependentRepeatabilityEvidence,
  buildExactScopedIndependentRepeatabilityEvidence,
  compileExactScopedIndependentRepeatabilityEvidencePolicy,
  discoverExactScopedIndependentRepeatabilityEvidenceRequests
} from '../ingestion/exact-scoped-independent-repeatability-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/exact-scoped-independent-repeatability-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/exact-scoped-independent-repeatability-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/exact-scoped-independent-repeatability-evidence-audit-v1.json', 'utf8'));
const domains = policy.requiredEvidenceDomains;

function page(pageid, title, revid, text) {
  return { pageid, title, revisions: [{ revid, timestamp: `2026-01-${String(pageid).slice(-2).padStart(2, '0')}T00:00:00Z`, slots: { main: { content: text } } }] };
}

function workOrder(key = 'alpha') {
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: {
      canonicalActivityKey: `activity:${key}`,
      canonicalLabel: 'Activity Alpha',
      stableIdentityAnchor: { collectionPageId: 200, linkedSubjectPageId: 100 }
    },
    canonicalActivitySubjectBinding: {
      sourcePageIdentity: { resolvedTitle: 'Activity Alpha', sourcePageId: 100, sourceRevision: '1000' }
    },
    exactScopedIndependentRepeatabilityEvidenceWorkRouting: {
      routeKey: policy.inputRouteKey,
      routeState: policy.inputRouteState,
      requiredEvidenceDomains: domains,
      sameLineExactSubjectPredicateRequired: true,
      crossLineCrossSectionCrossPageAndCrossSourceJoinsAllowed: false,
      evidenceWorkComplete: false,
      domainEvidenceWorkItems: domains.map((domainKey, index) => ({
        domainKey,
        evidenceObjective: `Collect ${domainKey}`,
        requiredChannels: ['revision_pinned_independent_source', 'same_line_exact_subject_predicate_scope'],
        workItemOrdinal: index + 1,
        requireExactSameLineSubjectPredicateScope: true,
        crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed: false,
        evidenceWorkComplete: false,
        evidenceKeys: []
      }))
    },
    memberExpansionReview: { state: 'unreviewed', evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['exact_scoped_independent_repeatability_evidence_work_routed_not_completed'],
    state: policy.inputState,
    contentHash: `route-${key}`
  };
}

const sourceText = [
  'The [[Activity Alpha]] can be repeated after completion and is available again next session.',
  'The [[Activity Alpha]] has a daily reset.',
  'The [[Activity Alpha]] cannot be repeated.',
  'Activity Alpha can be repeated, but this plain label is not acceptable evidence.',
  'The [[Activity Alpha]] is described here.',
  'It can be repeated after completion.',
  '<ref>The [[Activity Alpha]] can be repeated.</ref>'
].join('\n');
const input = workOrder();
const discoveryRecords = [{
  memberCandidateKey: input.memberCandidateKey,
  canonicalActivityKey: input.canonicalActivityIdentity.canonicalActivityKey,
  exactParentTitle: 'Activity Alpha',
  exactParentLabel: 'Activity Alpha',
  backlinkTitles: ['Activity Alpha', 'Independent evidence'],
  searchTitles: ['Activity collection', 'Independent evidence'],
  backlinkContinuationComplete: true,
  searchContinuationComplete: true,
  truncated: false
}];
const candidatePages = [
  page(100, 'Activity Alpha', 1000, 'Primary page.'),
  page(200, 'Activity collection', 2000, 'Collection page.'),
  page(300, 'Independent evidence', 3000, sourceText)
];

const compiled = compileExactScopedIndependentRepeatabilityEvidencePolicy(policy);
assert.equal(compiled.valid, true);
const requests = discoverExactScopedIndependentRepeatabilityEvidenceRequests([input], policy);
assert.deepEqual(requests, [{ memberCandidateKey: 'member:alpha', canonicalActivityKey: 'activity:alpha', exactParentTitle: 'Activity Alpha', exactParentLabel: 'Activity Alpha', namespace: 0, maximumDistinctCandidateTitles: 500, channels: policy.discoveryChannels }]);

const built = buildExactScopedIndependentRepeatabilityEvidence({ workOrders: [input], discoveryRecords, candidatePages, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.exactScopedDiscoveryChannelsComplete, true);
assert.equal(built.audit.discoveryCoverage.distinctCandidateTitleCount, 3);
assert.equal(built.audit.revisionCoverage.fetchedCandidatePageCount, 3);
assert.equal(built.audit.revisionCoverage.retainedIndependentSourceCount, 1);
assert.equal(built.audit.packetCoverage.domainPacketCount, 6);
assert.equal(built.audit.packetCoverage.resolvedDomainCount, 0);
assert.equal(built.audit.packetCoverage.reviewedMemberSubjectCount, 0);
assert.ok(built.audit.packetCoverage.exactSameLineSubjectPredicateCandidateCount >= 4);
const output = built.records[0];
const evidence = output.exactScopedIndependentRepeatabilityEvidence;
assert.equal(evidence.independentSources.length, 1);
assert.equal(evidence.independentSources[0].sourceRevision, '3000');
assert.equal(evidence.independentSources[0].sourceLines.length, sourceText.split('\n').length);
assert.ok(evidence.exactSameLineSubjectPredicateCandidateSignals.every(signal => signal.exactSubjectPredicateScopeComplete && signal.sourceLocator.lineStart === signal.sourceLocator.lineEnd));
assert.ok(evidence.exactSameLineSubjectPredicateCandidateSignals.every(signal => signal.sourceLocator.lineStart <= 3));
assert.equal(evidence.evidenceDomainPackets.find(packet => packet.domainKey === domains[1]).state, 'blocked_no_reviewed_member_subject');
assert.ok(evidence.evidenceDomainPackets.every(packet => packet.resolved === false && packet.evidenceWorkComplete === false && packet.domainVerdict === null));
assert.equal(evidence.parentActivityRepeatabilityVerdict, null);
assert.equal(evidence.memberTaskRepeatabilityVerdict, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const incompleteDiscovery = structuredClone(discoveryRecords);
incompleteDiscovery[0].searchContinuationComplete = false;
const incomplete = buildExactScopedIndependentRepeatabilityEvidence({ workOrders: [input], discoveryRecords: incompleteDiscovery, candidatePages, policy, contentHash: hash });
assert.equal(incomplete.audit.publishable, false);
assert.ok(incomplete.audit.blockers.includes('exact_scoped_discovery_channels_incomplete_or_mismatched'));

const missingPage = buildExactScopedIndependentRepeatabilityEvidence({ workOrders: [input], discoveryRecords, candidatePages: candidatePages.slice(0, 2), policy, contentHash: hash });
assert.equal(missingPage.audit.publishable, false);
assert.ok(missingPage.audit.blockers.includes('candidate_revision_fetch_set_incomplete_or_mismatched'));

const relaxedRoute = structuredClone(input);
relaxedRoute.exactScopedIndependentRepeatabilityEvidenceWorkRouting.crossLineCrossSectionCrossPageAndCrossSourceJoinsAllowed = true;
assert.equal(buildExactScopedIndependentRepeatabilityEvidence({ workOrders: [relaxedRoute], discoveryRecords, candidatePages, policy, contentHash: hash }).audit.publishable, false);

const missingDefinition = structuredClone(policy);
missingDefinition.predicateDefinitions.pop();
assert.equal(compileExactScopedIndependentRepeatabilityEvidencePolicy(missingDefinition).valid, false);

const activitySpecific = structuredClone(policy);
activitySpecific.overrides = { 'member:alpha': true };
assert.equal(compileExactScopedIndependentRepeatabilityEvidencePolicy(activitySpecific).valid, false);

const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileExactScopedIndependentRepeatabilityEvidencePolicy(automatic).valid, false);

const changed = structuredClone(built.records);
changed[0].exactScopedIndependentRepeatabilityEvidence.exactSameLineSubjectPredicateCandidateSignals[0].exactLine += ' changed';
assert.equal(auditExactScopedIndependentRepeatabilityEvidence(changed, { workOrders: [input], discoveryRecords, candidatePages, policy, contentHash: hash }).publishable, false);

const promoted = structuredClone(built.records);
promoted[0].exactScopedIndependentRepeatabilityEvidence.evidenceDomainPackets[0].resolved = true;
promoted[0].exactScopedIndependentRepeatabilityEvidence.evidenceDomainPackets[0].domainVerdict = 'repeatable';
promoted[0].exactScopedIndependentRepeatabilityEvidence.repeatabilityVerdict = 'repeatable';
promoted[0].exactScopedIndependentRepeatabilityEvidenceReview.evidenceWorkComplete = true;
promoted[0].optimizerEligible = true;
const promotedAudit = auditExactScopedIndependentRepeatabilityEvidence(promoted, { workOrders: [input], discoveryRecords, candidatePages, policy, contentHash: hash });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('domain_packet_or_repeatability_verdict_invariant_failed'));
assert.ok(promotedAudit.blockers.includes('unsupported_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(auditExactScopedIndependentRepeatabilityEvidence(accountScoped, { workOrders: [input], discoveryRecords, candidatePages, policy, contentHash: hash }).publishable, false);

const deterministic = buildExactScopedIndependentRepeatabilityEvidence({ workOrders: [structuredClone(input)], discoveryRecords: structuredClone(discoveryRecords), candidatePages: structuredClone(candidatePages), policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministic, built);

console.log('Revision-pinned exact-scoped independent repeatability evidence checks passed.');
