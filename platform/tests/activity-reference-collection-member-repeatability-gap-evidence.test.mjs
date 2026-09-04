import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberRepeatabilityGapEvidence,
  buildActivityReferenceCollectionMemberRepeatabilityGapEvidence,
  discoverRepeatabilityGapCandidateRequests
} from '../ingestion/activity-reference-collection-member-repeatability-gap-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-repeatability-gap-evidence-v1.json', 'utf8'));
const repeatabilityPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-repeatability-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-gap-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-gap-evidence-audit-v1.json', 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

const route = ({ label = 'Example activity' } = {}) => ({
  contract: 'sensum.activity-reference-collection-member-repeatability-evidence-work-routing.v1',
  memberCandidateKey: 'member:1',
  sourcePageId: 100,
  resolvedTitle: 'Already scanned',
  sourceRevision: '1000',
  sourceTimestamp: '2026-09-04T00:00:00Z',
  sourceUrl: 'https://oldschool.runescape.wiki/w/Already_scanned',
  sourceContentHash: 'upstream-source-hash',
  canonicalActivityIdentity: { canonicalActivityKey: 'activity:1', canonicalLabel: label },
  canonicalActivityIdentityEvidence: {
    collectionDefinition: {
      collectionSource: { pageId: 50, revision: '500', contentHash: 'collection-hash' },
      rowEvidence: { sourceRowOrdinal: 3, sourceLocator: { lineStart: 20, lineEnd: 22 } },
      directRowWikilinkEvidence: [
        { namespaceClass: 'main', requestedTitle: 'Collection rules', cellLogicalHeader: 'Description', cellIndex: 5, sourceLocator: { lineStart: 21, lineEnd: 21 } },
        { namespaceClass: 'main', requestedTitle: 'Already scanned', cellLogicalHeader: 'Activity', cellIndex: 2, sourceLocator: { lineStart: 20, lineEnd: 20 } },
        { namespaceClass: 'non_main', requestedTitle: 'File:Ignored.png', cellLogicalHeader: 'Activity', cellIndex: 1, sourceLocator: { lineStart: 20, lineEnd: 20 } }
      ]
    }
  },
  sourcePageEvidence: {
    sourceAuthoredLinks: [
      { occurrenceKey: 'link:1', namespaceClass: 'main', requestedTitle: 'Rules page', requestedFragment: null, displayText: null, sourceLocator: { line: 10, excerpt: 'Rules' } },
      { occurrenceKey: 'link:2', namespaceClass: 'main', requestedTitle: 'Shared redirect', requestedFragment: null, displayText: null, sourceLocator: { line: 10, excerpt: 'Shared' } },
      { occurrenceKey: 'link:3', namespaceClass: 'main', requestedTitle: 'Off-line page', requestedFragment: null, displayText: null, sourceLocator: { line: 11, excerpt: 'Off line' } },
      { occurrenceKey: 'link:4', namespaceClass: 'non_main', requestedTitle: 'File:Ignored.png', requestedFragment: null, displayText: null, sourceLocator: { line: 10, excerpt: 'Image' } }
    ]
  },
  repeatabilityEvidence: {
    sourceLocatedSignals: [{
      evidenceKey: 'structural:1',
      signalKind: 'session_boundary_candidate',
      sourceScope: 'complete_linked_source_revision',
      sourceLocator: { lineStart: 10, lineEnd: 10 }
    }]
  },
  repeatabilityDisposition: {
    state: 'unresolved_recurrence_or_session_structure_without_explicit_declaration',
    classification: null,
    evidenceKeys: ['structural:1'],
    deficiencies: ['recurrence_or_session_structure_is_not_explicit_repeatability_evidence']
  },
  repeatabilityReview: { state: 'reviewed_blocked', classification: null, evidenceKeys: ['structural:1'] },
  routingDecision: {
    policyRuleKind: 'repeatability_disposition_state',
    sourceState: 'unresolved_recurrence_or_session_structure_without_explicit_declaration',
    sourceClassification: null,
    routeKey: 'broader_repeatability_evidence_discovery_from_structural_signals',
    routeState: 'blocked_repeatability_evidence_gap',
    requiredEvidenceDomains: ['activity_rules_or_instructions'],
    expansionAxes: []
  },
  memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
  mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
  optimizerEligible: false,
  accountIndependent: true,
  blockers: ['repeatability_evidence_gap_or_conflict_remains_blocked'],
  state: 'repeatability_evidence_work_routed_but_source_gap_remains_blocked',
  contentHash: 'route-hash'
});

const resolution = ({ requestedTitle, pageId, title, content, redirected = false }) => ({
  requestedTitle,
  normalizedTitle: requestedTitle,
  resolvedTitle: title,
  redirected,
  page: {
    pageid: pageId,
    ns: 0,
    title,
    revisions: [{
      revid: pageId * 10,
      timestamp: '2026-09-04T01:00:00Z',
      slots: { main: { content } }
    }]
  }
});

const fetchedResolutions = [
  resolution({ requestedTitle: 'Rules page', pageId: 200, title: 'Rules page', content: 'The activity can be repeated.' }),
  resolution({ requestedTitle: 'Shared redirect', pageId: 200, title: 'Rules page', content: 'The activity can be repeated.', redirected: true }),
  resolution({ requestedTitle: 'Collection rules', pageId: 201, title: 'Collection rules', content: '<!-- The activity can be repeated. --> At the end of the game.' }),
  resolution({ requestedTitle: 'Already scanned', pageId: 100, title: 'Already scanned', content: 'Previously scanned.' })
];

const requests = discoverRepeatabilityGapCandidateRequests(route(), policy);
assert.deepEqual(requests.map(request => request.requestedTitle), ['Already scanned', 'Collection rules', 'Rules page', 'Shared redirect']);
assert.ok(!requests.some(request => request.requestedTitle === 'Off-line page'));

const built = buildActivityReferenceCollectionMemberRepeatabilityGapEvidence({
  routingRecords: [route()], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.repeatabilityGapEvidencePacketCoverageComplete, true);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.candidateDiscoveryCoverage.candidateRequestCount, 4);
assert.equal(built.audit.candidateDiscoveryCoverage.eligibleRequestCount, 3);
assert.equal(built.audit.candidateDiscoveryCoverage.excludedAlreadyScannedRequestCount, 1);
assert.equal(built.audit.candidateDiscoveryCoverage.uniqueResolvedCandidatePageCount, 2);
assert.equal(built.audit.repeatabilitySignalCoverage.explicitPositiveDeclarationCandidateCount, 1);
assert.equal(built.audit.repeatabilitySignalCoverage.sessionBoundaryCandidateCount, 1);
assert.equal(built.audit.repeatabilitySignalCoverage.repeatabilityVerdictCount, 0);
assert.equal(built.records[0].repeatabilityDisposition.classification, null);
assert.equal(built.records[0].repeatabilityReview.state, 'reviewed_blocked');
assert.equal(built.records[0].memberExpansionReview.state, 'unreviewed');
assert.equal(built.records[0].mechanicsReview.state, 'unreviewed');
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = buildActivityReferenceCollectionMemberRepeatabilityGapEvidence({
  routingRecords: [route({ label: 'Renamed without changing evidence' })], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.deepEqual(
  renamed.records[0].corroboratingRepeatabilityEvidence.discoveryBoundary.candidateRequests,
  built.records[0].corroboratingRepeatabilityEvidence.discoveryBoundary.candidateRequests
);

const missing = buildActivityReferenceCollectionMemberRepeatabilityGapEvidence({
  routingRecords: [route()], fetchedResolutions: [], policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(missing.audit.publishable, false);
assert.ok(missing.audit.blockers.includes('one_or_more_corroborating_repeatability_evidence_packets_incomplete'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.pageIds = [200];
const forbidden = buildActivityReferenceCollectionMemberRepeatabilityGapEvidence({
  routingRecords: [route()], fetchedResolutions, policy: forbiddenPolicy, repeatabilityPolicy, contentHash: hash
});
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('repeatability_gap_evidence_policy_invalid_or_incomplete'));

const tamperedRecords = structuredClone(built.records);
tamperedRecords[0].corroboratingRepeatabilityEvidence.candidatePages[0].sourceRevision = '999';
const tampered = auditActivityReferenceCollectionMemberRepeatabilityGapEvidence(tamperedRecords, {
  routingRecords: [route()], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(tampered.publishable, false);
assert.ok(tampered.blockers.includes('one_or_more_corroborating_evidence_packets_do_not_match_source_inputs'));

const mutatedRecords = structuredClone(built.records);
mutatedRecords[0].repeatabilityDisposition.classification = 'repeatable';
const mutated = auditActivityReferenceCollectionMemberRepeatabilityGapEvidence(mutatedRecords, {
  routingRecords: [route()], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(mutated.publishable, false);
assert.ok(mutated.blockers.includes('evidence_collection_changed_repeatability_disposition_or_review'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].memberExpansionReview.state = 'reviewed';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberRepeatabilityGapEvidence(promotedRecords, {
  routingRecords: [route()], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].preferences = { intensity: 'afk' };
const accountInjected = auditActivityReferenceCollectionMemberRepeatabilityGapEvidence(accountRecords, {
  routingRecords: [route()], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(accountInjected.publishable, false);
assert.ok(accountInjected.blockers.includes('account_query_state_baked_into_repeatability_gap_evidence'));

const unsupportedVerdictRecords = structuredClone(built.records);
unsupportedVerdictRecords[0].corroboratingRepeatabilityCandidateObservations.repeatabilityVerdict = 'repeatable';
const unsupportedVerdict = auditActivityReferenceCollectionMemberRepeatabilityGapEvidence(unsupportedVerdictRecords, {
  routingRecords: [route()], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(unsupportedVerdict.publishable, false);
assert.ok(unsupportedVerdict.blockers.includes('candidate_evidence_created_an_unsupported_repeatability_verdict'));

console.log('Revision-pinned repeatability-gap evidence checks passed.');
