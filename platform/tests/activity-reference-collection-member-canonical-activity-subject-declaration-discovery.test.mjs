import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditCanonicalActivitySubjectDeclarationDiscovery, buildCanonicalActivitySubjectDeclarationDiscovery, compileCanonicalActivitySubjectDeclarationDiscoveryPolicy } from '../transforms/activity-reference-collection-member-canonical-activity-subject-declaration-discovery-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-discovery-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-discovery-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-discovery-audit-v1.json', 'utf8'));

function input(key = 'member:a') {
  const signal = suffix => ({ signalEvidenceKey: `signal:${suffix}`, state: 'blocked_no_stable_activity_subject_anchor', semanticSubjectBinding: null, canonicalActivityScopeClassification: null, repeatabilityClassification: null });
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    canonicalActivityIdentity: { canonicalActivityKey: 'activity:stable', canonicalLabel: 'Example activity', stableIdentityAnchor: { collectionPageId: 100, linkedSubjectPageId: 200, relationshipClass: 'describes' } },
    collectionContext: { collectionSource: { pageId: 100, title: 'Collection', revision: '1000', timestamp: '2026-01-01T00:00:00Z', url: 'https://oldschool.runescape.wiki/w/Collection', contentHash: 'collection-hash' } },
    sourcePageId: 200,
    resolvedTitle: 'Linked subject',
    sourceRevision: '2000',
    sourceTimestamp: '2026-01-02T00:00:00Z',
    sourceUrl: 'https://oldschool.runescape.wiki/w/Linked_subject',
    sourceContentHash: 'linked-hash',
    independentRepeatabilitySourceEvidence: {
      candidatePages: [{ sourcePageId: 300, resolvedTitle: 'Candidate source', sourceRevision: '3000', sourceTimestamp: '2026-01-03T00:00:00Z', sourceUrl: 'https://oldschool.runescape.wiki/w/Candidate_source', sourceContentHash: 'candidate-hash', sourceContentBytes: 500, completeRevisionContentScanned: true }],
      discoveryBoundary: {
        exactSourceSearch: { query: 'insource:"Example activity"', namespace: 0, totalHits: 1, returnedCount: 1, continuationExhausted: true, truncated: false, results: [{ pageid: 300, ns: 0, title: 'Candidate source', rank: 1, size: 500, wordcount: 50, timestamp: '2026-01-03T00:00:00Z', snippet: 'Example activity' }] },
        candidateRequestAssessments: [
          { requestedTitle: 'Candidate source', observedPageIds: [300], resolvedPageId: 300, resolvedTitle: 'Candidate source', redirected: false, state: 'eligible_revision_pinned_candidate', discoveryContexts: [{ channel: 'exact_source_phrase_search' }] },
          { requestedTitle: 'Example alias', observedPageIds: [301], resolvedPageId: 200, resolvedTitle: 'Linked subject', redirected: true, state: 'excluded_previously_scanned_source', discoveryContexts: [{ channel: 'main_namespace_backlinks_to_stable_linked_subject' }] }
        ]
      }
    },
    independentRepeatabilitySignalSubjectPredicateDisposition: { state: 'reviewed_all_subject_predicate_evidence_states_semantically_unresolved', signalDispositionCount: 2, signalDispositions: [signal('a'), signal('b')] },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical_activity_subject_binding_unresolved', 'repeatability_classification_unresolved'],
    state: policy.inputState,
    contentHash: `input-hash-${key}`
  };
}

const source = input();
const built = buildCanonicalActivitySubjectDeclarationDiscovery({ dispositionRecords: [source], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.subjectDeclarationDiscoveryAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivitySubjectDeclarationDiscoveryCoverageComplete, true);
assert.equal(built.audit.signalConsolidationCoverage.inputUnboundSignalCount, 2);
assert.equal(built.audit.signalConsolidationCoverage.consolidatedUnboundSignalCount, 2);
assert.equal(built.audit.revisionCoverage.candidateSourceCount, 1);
assert.equal(built.audit.revisionCoverage.revisionPinnedCandidateSourceCount, 1);
const output = built.records[0];
assert.equal(output.canonicalActivitySubjectDeclarationDiscovery.redirectAliasObservationCount, 1);
assert.equal(output.canonicalActivitySubjectDeclarationDiscovery.canonicalActivitySubjectDeclarationVerdict, null);
assert.equal(output.canonicalActivitySubjectDeclarationReview.canonicalActivityScopeVerdict, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `missing audit field ${field}`);

const previouslyScanned = input();
previouslyScanned.corroboratingRepeatabilityEvidence = {
  candidatePages: previouslyScanned.independentRepeatabilitySourceEvidence.candidatePages
};
previouslyScanned.independentRepeatabilitySourceEvidence.candidatePages = [];
previouslyScanned.independentRepeatabilitySourceEvidence.discoveryBoundary.candidateRequestAssessments[0].state = 'excluded_previously_scanned_source';
previouslyScanned.contentHash = 'previously-scanned-source-hash';
assert.equal(buildCanonicalActivitySubjectDeclarationDiscovery({ dispositionRecords: [previouslyScanned], policy }).audit.publishable, true);

const missing = input();
missing.independentRepeatabilitySourceEvidence.candidatePages = [];
missing.contentHash = 'missing-revision-hash';
const missingBuilt = buildCanonicalActivitySubjectDeclarationDiscovery({ dispositionRecords: [missing], policy });
assert.equal(missingBuilt.audit.publishable, false);
assert.ok(missingBuilt.audit.blockers.includes('one_or_more_subject_declaration_discovery_packets_incomplete'));

const truncated = input();
truncated.independentRepeatabilitySourceEvidence.discoveryBoundary.exactSourceSearch.continuationExhausted = false;
truncated.independentRepeatabilitySourceEvidence.discoveryBoundary.exactSourceSearch.truncated = true;
truncated.contentHash = 'truncated-hash';
assert.equal(buildCanonicalActivitySubjectDeclarationDiscovery({ dispositionRecords: [truncated], policy }).audit.publishable, false);

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { 'activity:stable': 'supported' };
const forbidden = buildCanonicalActivitySubjectDeclarationDiscovery({ dispositionRecords: [source], policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('canonical_activity_subject_declaration_discovery_policy_invalid_or_activity_specific'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict = 'supported';
promotedRecords[0].optimizerEligible = true;
const promoted = auditCanonicalActivitySubjectDeclarationDiscovery(promotedRecords, { dispositionRecords: [source], policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_subject_scope_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const account = auditCanonicalActivitySubjectDeclarationDiscovery(accountRecords, { dispositionRecords: [source], policy });
assert.equal(account.publishable, false);
assert.ok(account.blockers.includes('account_query_state_baked_into_subject_declaration_discovery'));

const shared = buildCanonicalActivitySubjectDeclarationDiscovery({ dispositionRecords: [input('member:a'), input('member:b')], policy });
assert.equal(shared.audit.publishable, true);
assert.equal(shared.audit.signalConsolidationCoverage.consolidatedUnboundSignalCount, 4);
assert.deepEqual(shared.audit.signalConsolidationCoverage.duplicateOutputSignalPairs, []);

const compiled = compileCanonicalActivitySubjectDeclarationDiscoveryPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
console.log('Canonical activity subject-declaration discovery checks passed.');
