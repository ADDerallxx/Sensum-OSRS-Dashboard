import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditIndependentScopedActivityRepeatabilityEvidence,
  buildIndependentScopedActivityRepeatabilityEvidence,
  compileIndependentScopedActivityRepeatabilityEvidencePolicy,
  discoverIndependentScopedActivityRepeatabilityCandidateTitles,
  discoverIndependentScopedActivityRepeatabilitySeedRequests,
  extractSourceAuthoredMainNamespaceLinks
} from '../ingestion/independent-scoped-activity-repeatability-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/independent-scoped-activity-repeatability-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/independent-scoped-activity-repeatability-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/independent-scoped-activity-repeatability-evidence-audit-v1.json', 'utf8'));
const domains = policy.requiredEvidenceDomains;

const primaryText = `{{Infobox Activity\n|name = Activity Alpha\n}}\nThe guide links to [[Independent guide]].\n<!-- [[Hidden source]] repeat again -->\n<ref>[[Citation page]] can be repeated</ref>\n`;
const collectionText = `Activities can be repeated, unlike quests.\n{| class="wikitable"\n| [[Activity Alpha]] || Players complete assigned tasks.\n|}`;
const reciprocalText = `The [[Activity Alpha]] may offer another task. These were called seemingly never-ending tasks.\nTry again later for work.\n`;

function revisionPage({ pageid, title, revid, timestamp, text }) {
  return { pageid, title, revisions: [{ revid, timestamp, slots: { main: { content: text } } }] };
}

function workOrder({ key = 'alpha', label = 'Activity Alpha' } = {}) {
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: {
      canonicalActivityKey: `activity:${key}`,
      canonicalLabel: label,
      evidenceRevisionBoundary: { collectionRevision: '2000', linkedSourceRevision: '1000' },
      stableIdentityAnchor: { canonicalActivityKey: `activity:${key}`, collectionPageId: 200, linkedSubjectPageId: 100, relationshipClass: 'source_page_describes_collection_defined_activity_candidate' }
    },
    canonicalActivitySubjectBinding: {
      sourcePageIdentity: {
        resolvedTitle: 'Activity Alpha',
        sourceContentHash: hash(primaryText),
        sourcePageId: 100,
        sourceRevision: '1000',
        sourceTimestamp: '2026-01-01T00:00:00Z',
        sourceUrl: 'https://oldschool.runescape.wiki/w/Activity_Alpha'
      }
    },
    canonicalActivityScopeDisposition: { state: 'source_supported_composite_assigned_task_activity_scope', repeatabilityVerdict: null },
    canonicalActivityRepeatabilityDisposition: { state: 'blocked_parent_and_member_repeatability_not_proven', repeatabilityVerdict: null },
    canonicalActivityRepeatabilityGapEvidenceWorkRouting: {
      routeKey: policy.inputRouteKey,
      routeState: policy.inputRouteState,
      evidenceWorkComplete: false,
      requiredEvidenceDomains: domains,
      domainEvidenceWorkItems: domains.map((domainKey, index) => ({
        domainKey,
        evidenceObjective: `Collect ${domainKey}`,
        requiredChannels: ['independent_revision_pinned_source', 'exact_subject_predicate_scope'],
        workItemOrdinal: index + 1,
        workState: 'blocked_pending_revision_pinned_independent_evidence',
        evidenceWorkComplete: false,
        evidenceKeys: []
      }))
    },
    memberExpansionReview: { state: 'unreviewed', evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['independent_scoped_activity_repeatability_gap_evidence_work_routed_not_completed'],
    state: policy.inputState,
    contentHash: `work-${key}`
  };
}

const seedPages = [
  revisionPage({ pageid: 100, title: 'Activity Alpha', revid: 1000, timestamp: '2026-01-01T00:00:00Z', text: primaryText }),
  revisionPage({ pageid: 200, title: 'Activity collection', revid: 2000, timestamp: '2026-01-02T00:00:00Z', text: collectionText })
];
const candidatePages = [
  revisionPage({ pageid: 300, title: 'Independent guide', revid: 3000, timestamp: '2026-01-03T00:00:00Z', text: reciprocalText })
];
const input = workOrder();

const links = extractSourceAuthoredMainNamespaceLinks(primaryText);
assert.deepEqual(links.map(link => link.requestedTitle), ['Independent guide']);

const seedRequests = discoverIndependentScopedActivityRepeatabilitySeedRequests([input], policy);
assert.deepEqual(seedRequests.map(request => request.revision), ['1000', '2000']);
const candidates = discoverIndependentScopedActivityRepeatabilityCandidateTitles({ workOrders: [input], seedPages, policy });
assert.deepEqual(candidates[0].requestedTitles, ['Independent guide']);
assert.equal(candidates[0].truncated, false);

const built = buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [input], seedPages, candidatePages, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.independentEvidenceDiscoveryScopeComplete, true);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.revisionCoverage.retainedIndependentSourceCount, 2);
assert.equal(built.audit.discoveryCoverage.exactCollectionAnchorSourceCount, 1);
assert.equal(built.audit.discoveryCoverage.reciprocalSourceCount, 1);
assert.equal(built.audit.packetCoverage.domainPacketCount, 6);
assert.equal(built.audit.packetCoverage.resolvedDomainCount, 0);
assert.ok(built.audit.packetCoverage.candidateSignalCount > 0);
const output = built.records[0];
assert.equal(output.independentScopedActivityRepeatabilityEvidence.independentSources.length, 2);
assert.equal(output.independentScopedActivityRepeatabilityEvidence.repeatabilityVerdict, null);
assert.equal(output.independentScopedActivityRepeatabilityEvidenceReview.evidenceWorkComplete, false);
assert.equal(output.optimizerEligible, false);
assert.deepEqual(output.independentScopedActivityRepeatabilityEvidence.evidenceDomainPackets.map(packet => packet.domainKey), domains);
assert.ok(output.independentScopedActivityRepeatabilityEvidence.evidenceDomainPackets.every(packet => packet.resolved === false && packet.domainVerdict === null));
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const unrelatedCandidate = revisionPage({ pageid: 301, title: 'Independent guide', revid: 3001, timestamp: '2026-01-03T00:00:00Z', text: 'This page offers another task but has no source-authored link back.' });
const unrelated = buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [input], seedPages, candidatePages: [unrelatedCandidate], policy, contentHash: hash });
assert.equal(unrelated.audit.publishable, true);
assert.equal(unrelated.audit.discoveryCoverage.reciprocalSourceCount, 0);
assert.equal(unrelated.records[0].independentScopedActivityRepeatabilityEvidence.independentSources.length, 1);

const missingSeed = buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [input], seedPages: seedPages.slice(1), candidatePages, policy, contentHash: hash });
assert.equal(missingSeed.audit.publishable, false);
assert.ok(missingSeed.audit.blockers.includes('defined_independent_source_discovery_scope_incomplete'));

const alteredPrimary = structuredClone(seedPages);
alteredPrimary[0].revisions[0].slots.main.content += 'changed';
assert.equal(buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [input], seedPages: alteredPrimary, candidatePages, policy, contentHash: hash }).audit.publishable, false);

const extraSeed = [...seedPages, revisionPage({ pageid: 999, title: 'Unexpected', revid: 9999, timestamp: '2026-01-04T00:00:00Z', text: 'unexpected' })];
const extraSeedAudit = buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [input], seedPages: extraSeed, candidatePages, policy, contentHash: hash }).audit;
assert.equal(extraSeedAudit.publishable, false);
assert.ok(extraSeedAudit.blockers.includes('exact_pinned_anchor_revision_fetch_set_mismatch'));

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'member:alpha': 'accept' };
assert.equal(buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [input], seedPages, candidatePages, policy: specificPolicy, contentHash: hash }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [input], seedPages, candidatePages, policy: automaticPolicy, contentHash: hash }).audit.publishable, false);

const truncatedPolicy = structuredClone(policy);
truncatedPolicy.sourceDiscovery.maximumDirectMainNamespaceLinks = 0;
assert.equal(compileIndependentScopedActivityRepeatabilityEvidencePolicy(truncatedPolicy).valid, false);

const mutated = structuredClone(built.records);
mutated[0].canonicalActivityIdentity.canonicalLabel = 'Changed';
assert.equal(auditIndependentScopedActivityRepeatabilityEvidence(mutated, { workOrders: [input], seedPages, candidatePages, policy, contentHash: hash }).publishable, false);

const promoted = structuredClone(built.records);
promoted[0].independentScopedActivityRepeatabilityEvidence.evidenceDomainPackets[0].resolved = true;
promoted[0].independentScopedActivityRepeatabilityEvidence.evidenceDomainPackets[0].domainVerdict = 'repeatable';
promoted[0].independentScopedActivityRepeatabilityEvidence.repeatabilityVerdict = 'repeatable';
promoted[0].independentScopedActivityRepeatabilityEvidenceReview.evidenceWorkComplete = true;
promoted[0].optimizerEligible = true;
const promotedAudit = auditIndependentScopedActivityRepeatabilityEvidence(promoted, { workOrders: [input], seedPages, candidatePages, policy, contentHash: hash });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('domain_packet_or_repeatability_verdict_invariant_failed'));
assert.ok(promotedAudit.blockers.includes('unsupported_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(auditIndependentScopedActivityRepeatabilityEvidence(accountScoped, { workOrders: [input], seedPages, candidatePages, policy, contentHash: hash }).publishable, false);

const duplicateInput = buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [input, structuredClone(input)], seedPages, candidatePages, policy, contentHash: hash });
assert.equal(duplicateInput.audit.publishable, false);

const deterministic = buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: [structuredClone(input)], seedPages: structuredClone(seedPages), candidatePages: structuredClone(candidatePages), policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministic, built);

console.log('Revision-pinned independent scoped-activity repeatability evidence checks passed.');
