import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence,
  buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence,
  compileIndependentRepeatabilitySourceEvidencePolicy,
  discoverIndependentRepeatabilityCandidateRequests,
  exactSourceSearchQuery,
  selectIndependentRepeatabilitySourceRoutes
} from '../ingestion/activity-reference-collection-member-independent-repeatability-source-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-independent-repeatability-source-evidence-v1.json', 'utf8'));
const repeatabilityPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-repeatability-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-independent-repeatability-source-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-independent-repeatability-source-evidence-audit-v1.json', 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

const input = ({ label = 'Example activity' } = {}) => ({
  contract: 'sensum.activity-reference-collection-member-repeatability-gap-disposition.v1',
  memberCandidateKey: 'member:example',
  sourcePageId: 100,
  resolvedTitle: 'Linked source',
  sourceRepeatabilityGapEvidenceContentHash: 'gap-source-hash',
  canonicalActivityIdentity: {
    canonicalActivityKey: 'activity:example',
    canonicalLabel: label,
    linkedSubjectIsCanonicalActivity: false,
    stableIdentityAnchor: { linkedSubjectPageId: 100, collectionPageId: 50, relationshipClass: 'describes' }
  },
  canonicalActivityIdentityEvidence: {
    collectionDefinition: { collectionSource: { pageId: 50, revision: '500', contentHash: 'collection-hash' } }
  },
  repeatabilityDisposition: { state: 'unresolved_recurrence_or_session_structure_without_explicit_declaration', classification: null, evidenceKeys: ['upstream:1'], deficiencies: ['unresolved'] },
  repeatabilityReview: { state: 'reviewed_blocked', classification: null, evidenceKeys: ['upstream:1'] },
  corroboratingRepeatabilityEvidence: {
    evidenceState: 'complete_revision_pinned_corroborating_repeatability_evidence_packet',
    candidatePages: [{ sourcePageId: 150, sourceRevision: '1500', sourceContentHash: 'prior-source-hash' }]
  },
  corroboratingRepeatabilityCandidateObservations: { repeatabilityVerdict: null, deficiencies: [] },
  corroboratingRepeatabilityDisposition: { state: 'blocked_no_explicit_declaration_in_bounded_corroborating_sources', classification: null, deficiencies: ['unresolved'] },
  corroboratingRepeatabilityReview: { state: 'reviewed_blocked', classification: null, evidenceKeys: [] },
  repeatabilityGapNextEvidenceWork: {
    state: 'required',
    routeKey: 'independent_authoritative_repeatability_source_discovery',
    requiredEvidence: ['explicit_revision_pinned_repeatability_declaration_or_authoritative_exclusion']
  },
  memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
  mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
  optimizerEligible: false,
  accountIndependent: true,
  blockers: ['repeatability_classification_unresolved', 'member_expansion_not_reviewed', 'optimizer_eligibility_blocked'],
  state: 'corroborating_repeatability_disposition_reviewed_unresolved',
  contentHash: 'gap-disposition-hash'
});

const discovery = record => ({
  memberCandidateKey: record.memberCandidateKey,
  exactSourceSearch: {
    query: exactSourceSearchQuery(record, policy),
    namespace: 0,
    totalHits: 3,
    returnedCount: 3,
    continuationExhausted: true,
    truncated: false,
    results: [
      { pageid: 100, ns: 0, title: 'Linked source', size: 10, wordcount: 2, timestamp: '2026-09-04T00:00:00Z', snippet: 'prior', rank: 1 },
      { pageid: 200, ns: 0, title: 'Rules page', size: 20, wordcount: 4, timestamp: '2026-09-04T00:00:00Z', snippet: 'repeat', rank: 2 },
      { pageid: 201, ns: 0, title: 'Shared redirect', size: 5, wordcount: 1, timestamp: '2026-09-04T00:00:00Z', snippet: 'redirect', rank: 3 }
    ]
  },
  backlinks: {
    anchorTitle: record.resolvedTitle,
    namespace: 0,
    returnedCount: 3,
    continuationExhausted: true,
    truncated: false,
    results: [
      { pageid: 200, ns: 0, title: 'Rules page', ordinal: 1 },
      { pageid: 202, ns: 0, title: 'Other page', ordinal: 2 },
      { pageid: 150, ns: 0, title: 'Prior candidate', ordinal: 3 }
    ]
  }
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

const record = input();
const response = discovery(record);
const fetchedResolutions = [
  resolution({ requestedTitle: 'Linked source', pageId: 100, title: 'Linked source', content: 'Prior source.' }),
  resolution({ requestedTitle: 'Rules page', pageId: 200, title: 'Rules page', content: 'The [[Linked source]] activity can be repeated.' }),
  resolution({ requestedTitle: 'Shared redirect', pageId: 200, title: 'Rules page', content: 'The [[Linked source]] activity can be repeated.', redirected: true }),
  resolution({ requestedTitle: 'Other page', pageId: 202, title: 'Other page', content: '<!-- can be repeated --> The guide assigns various tasks.' }),
  resolution({ requestedTitle: 'Prior candidate', pageId: 150, title: 'Prior candidate', content: 'Prior candidate.' })
];

assert.equal(selectIndependentRepeatabilitySourceRoutes([record], policy).length, 1);
assert.equal(exactSourceSearchQuery(record, policy), 'insource:"Example activity"');
const requests = discoverIndependentRepeatabilityCandidateRequests(record, response, policy);
assert.deepEqual(requests.map(item => item.requestedTitle), ['Linked source', 'Other page', 'Prior candidate', 'Rules page', 'Shared redirect']);
assert.equal(requests.find(item => item.requestedTitle === 'Rules page').discoveryContexts.length, 2);

const built = buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence({
  gapDispositionRecords: [record], discoveryResponses: [response], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.independentSourceEvidenceCoverageComplete, true);
assert.equal(built.audit.discoveryCoverage.searchResultCount, 3);
assert.equal(built.audit.discoveryCoverage.backlinkResultCount, 3);
assert.equal(built.audit.discoveryCoverage.candidateRequestCount, 5);
assert.equal(built.audit.discoveryCoverage.excludedPreviouslyScannedRequestCount, 2);
assert.equal(built.audit.discoveryCoverage.uniqueResolvedCandidatePageCount, 2);
assert.equal(built.audit.sourceAlignmentCoverage.sourceAuthoredLinkOccurrenceCount, 1);
assert.equal(built.audit.sourceAlignmentCoverage.unbalancedSourceLinkPageCount, 0);
assert.equal(built.audit.repeatabilitySignalCoverage.explicitPositiveDeclarationCandidateCount, 1);
assert.equal(built.audit.repeatabilitySignalCoverage.recurrenceStructureCandidateCount, 1);
assert.equal(built.audit.repeatabilitySignalCoverage.canonicalActivityScopeVerdictCount, 0);
assert.equal(built.audit.repeatabilitySignalCoverage.repeatabilityVerdictCount, 0);
assert.equal(built.records[0].repeatabilityDisposition.classification, null);
assert.equal(built.records[0].corroboratingRepeatabilityDisposition.classification, null);
assert.equal(built.records[0].independentRepeatabilityCandidateObservations.canonicalActivityScopeVerdict, null);
assert.equal(built.records[0].independentRepeatabilityCandidateObservations.repeatabilityVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const truncatedResponse = structuredClone(response);
truncatedResponse.exactSourceSearch.continuationExhausted = false;
truncatedResponse.exactSourceSearch.truncated = true;
const truncated = buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence({
  gapDispositionRecords: [record], discoveryResponses: [truncatedResponse], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(truncated.audit.publishable, false);
assert.ok(truncated.audit.blockers.includes('one_or_more_independent_repeatability_source_evidence_packets_incomplete'));

const renamed = input({ label: 'Renamed activity' });
const staleResponse = discovery(record);
const renamedBuilt = buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence({
  gapDispositionRecords: [renamed], discoveryResponses: [staleResponse], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(renamedBuilt.audit.publishable, false);
assert.ok(renamedBuilt.records[0].independentRepeatabilityCandidateObservations.deficiencies.includes('exact_source_search_boundary_mismatch'));

const missingFetched = buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence({
  gapDispositionRecords: [record], discoveryResponses: [response], fetchedResolutions: [], policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(missingFetched.audit.publishable, false);

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.pageIds = [200];
const forbidden = buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence({
  gapDispositionRecords: [record], discoveryResponses: [response], fetchedResolutions, policy: forbiddenPolicy, repeatabilityPolicy, contentHash: hash
});
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('independent_repeatability_source_evidence_policy_invalid_or_incomplete'));

const tamperedRecords = structuredClone(built.records);
tamperedRecords[0].independentRepeatabilitySourceEvidence.candidatePages[0].sourceRevision = '999';
const tampered = auditActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence(tamperedRecords, {
  gapDispositionRecords: [record], discoveryResponses: [response], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(tampered.publishable, false);
assert.ok(tampered.blockers.includes('one_or_more_independent_evidence_packets_do_not_match_discovery_and_source_inputs'));

const mutatedRecords = structuredClone(built.records);
mutatedRecords[0].repeatabilityDisposition.classification = 'repeatable';
const mutated = auditActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence(mutatedRecords, {
  gapDispositionRecords: [record], discoveryResponses: [response], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(mutated.publishable, false);
assert.ok(mutated.blockers.includes('evidence_collection_changed_upstream_repeatability_disposition_or_review'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].independentRepeatabilityCandidateObservations.repeatabilityVerdict = 'repeatable';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence(promotedRecords, {
  gapDispositionRecords: [record], discoveryResponses: [response], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('candidate_evidence_created_unsupported_scope_repeatability_or_downstream_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].preferences = { afk: true };
const accountScoped = auditActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence(accountRecords, {
  gapDispositionRecords: [record], discoveryResponses: [response], fetchedResolutions, policy, repeatabilityPolicy, contentHash: hash
});
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_independent_repeatability_source_evidence'));

const compiled = compileIndependentRepeatabilitySourceEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidDiscoveryChannels, []);
assert.deepEqual(compiled.missingDiscoveryChannels, []);

console.log('Independent revision-pinned repeatability-source evidence checks passed.');
