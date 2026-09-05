import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions,
  buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions,
  compileIndependentRepeatabilitySignalScopeDispositionPolicy
} from '../transforms/activity-reference-collection-member-independent-repeatability-signal-scope-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync(
  'platform/policies/activity-reference-collection-member-independent-repeatability-signal-scope-disposition-v1.json',
  'utf8'
));
const recordContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-scope-disposition-v1.json',
  'utf8'
));
const auditContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-scope-disposition-audit-v1.json',
  'utf8'
));

function packet({ key, links = [], assessments = [], sourceAnchor = false, targetAnchorKeys = [], state }) {
  return {
    signalEvidenceKey: 'signal:' + key,
    sourceCandidate: {
      sourcePageId: 200,
      resolvedTitle: 'Unrelated source title',
      sourceRevision: '2000',
      sourceTimestamp: '2026-09-04T00:00:00Z',
      sourceUrl: 'https://oldschool.runescape.wiki/w/Unrelated_source_title',
      sourceContentHash: 'source-hash'
    },
    sourceLocatedSignal: {
      evidenceKey: 'signal:' + key,
      signalKind: 'explicit_positive_repeatability_declaration_candidate',
      definitionKey: 'positive',
      matchedText: 'repeatable',
      contextText: 'Exact signal context.',
      sourceLocator: { lineStart: 10, lineEnd: 10 }
    },
    exactLineSourceAuthoredMainNamespaceLinks: links,
    linkResolutionAssessments: assessments,
    resolvedTargetPages: [],
    stableIdentityComparisons: {
      signalSourcePageMatchesLinkedSubjectAnchor: sourceAnchor,
      signalSourcePageMatchesCollectionAnchor: false,
      linkedSubjectAnchorTargetOccurrenceKeys: targetAnchorKeys,
      collectionAnchorTargetOccurrenceKeys: [],
      signalSourceTargetOccurrenceKeys: []
    },
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    limitations: links.length ? [] : ['no_source_authored_main_namespace_link_on_exact_signal_line'],
    deficiencies: [],
    state: state || (links.length
      ? 'complete_revision_pinned_exact_line_link_scope_evidence'
      : 'complete_no_source_authored_main_namespace_link_on_exact_signal_line')
  };
}

function exactLink(key) {
  return {
    occurrenceKey: 'link:' + key,
    requestedTitle: 'Observed link ' + key,
    namespaceClass: 'main',
    sourceLocator: { line: 10 }
  };
}

function assessment(key, anchor = false) {
  return {
    signalEvidenceKey: 'signal:' + key,
    linkOccurrenceKey: 'link:' + key,
    requestedTitle: 'Observed link ' + key,
    resolvedTitle: 'Resolved unrelated title',
    redirected: false,
    resolutionState: 'revision_pinned_official_wiki_main_namespace_page',
    targetPageIdentity: {
      sourcePageId: anchor ? 777 : 888,
      resolvedTitle: anchor ? 'Stable anchor' : 'Other target',
      sourceRevision: anchor ? '7770' : '8880',
      sourceTimestamp: '2026-09-04T01:00:00Z',
      sourceUrl: 'https://oldschool.runescape.wiki/w/Target',
      sourceContentHash: anchor ? 'anchor-hash' : 'other-hash'
    },
    stableIdentityComparisons: {
      targetMatchesLinkedSubjectAnchor: anchor,
      targetMatchesCollectionAnchor: false,
      targetMatchesSignalSourcePage: false
    },
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null
  };
}

function input() {
  const noAnchorLink = exactLink('no-anchor');
  const anchorLink = exactLink('anchor');
  const packets = [
    packet({ key: 'no-link' }),
    packet({
      key: 'no-anchor',
      links: [noAnchorLink],
      assessments: [assessment('no-anchor')]
    }),
    packet({
      key: 'anchor',
      links: [anchorLink],
      assessments: [assessment('anchor', true)],
      targetAnchorKeys: ['link:anchor']
    })
  ];
  return {
    contract: 'sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence.v1',
    memberCandidateKey: 'member:example',
    canonicalActivityIdentity: {
      canonicalActivityKey: 'activity:example',
      canonicalLabel: 'Example activity',
      stableIdentityAnchor: {
        linkedSubjectPageId: 777,
        collectionPageId: 50,
        relationshipClass: 'describes'
      }
    },
    independentRepeatabilitySourceEvidence: { evidenceState: 'complete' },
    independentRepeatabilityCandidateObservations: {
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    independentRepeatabilitySignalScopeEvidence: {
      evidenceState: 'complete_revision_pinned_independent_repeatability_signal_scope_evidence_packet',
      scopeEvidenceChannel: 'source_authored_main_namespace_links_on_exact_signal_lines',
      signalScopeEvidencePackets: packets,
      resolvedTargetPages: []
    },
    independentRepeatabilitySignalScopeObservations: {
      sourceLocatedSignalCount: 3,
      signalScopeEvidencePacketCount: 3,
      signalsWithExactLineMainNamespaceLinks: 2,
      signalsWithoutExactLineMainNamespaceLinks: 1,
      exactLineMainNamespaceLinkOccurrenceCount: 2,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      deficiencies: []
    },
    repeatabilityDisposition: { state: 'unresolved', classification: null },
    repeatabilityReview: { state: 'reviewed_blocked', classification: null },
    corroboratingRepeatabilityDisposition: { state: 'unresolved', classification: null },
    corroboratingRepeatabilityReview: { state: 'reviewed_blocked', classification: null },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: [
      'independent_repeatability_signal_scope_evidence_requires_semantic_disposition',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'optimizer_eligibility_blocked'
    ],
    state: 'independent_repeatability_signal_scope_evidence_ready_for_semantic_disposition',
    contentHash: 'scope-evidence-hash'
  };
}

const source = input();
const built = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions({
  signalScopeEvidenceRecords: [source],
  policy
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.signalScopeDispositionAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivityScopeClassificationCoverageComplete, false);
assert.equal(built.audit.canonicalActivityScopeReviewComplete, false);
assert.equal(built.audit.dispositionCoverage.inputSignalScopeEvidencePacketCount, 3);
assert.equal(built.audit.dispositionCoverage.signalScopeDispositionCount, 3);
assert.equal(built.audit.dispositionCoverage.noExactLineLinkCount, 1);
assert.equal(built.audit.dispositionCoverage.exactLineLinksWithoutStableAnchorCount, 1);
assert.equal(built.audit.dispositionCoverage.unboundStableAnchorObservationCount, 1);
assert.equal(built.audit.dispositionCoverage.resolvedCanonicalActivityScopeClassificationCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.repeatabilityClassificationCount, 0);
const output = built.records[0];
const dispositions = output.independentRepeatabilitySignalScopeDisposition.signalDispositions;
assert.equal(dispositions[0].state, 'blocked_stable_identity_anchor_observation_without_semantic_subject_binding');
assert.equal(dispositions[1].state, 'blocked_exact_line_links_without_stable_identity_anchor');
assert.equal(dispositions[2].state, 'blocked_no_exact_line_main_namespace_link_for_scope');
assert.ok(dispositions.every(item =>
  item.canonicalActivityScopeClassification === null
  && item.repeatabilityClassification === null
  && item.semanticSubjectBinding === null
));
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), 'Missing required record field: ' + field);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), 'Missing required audit field: ' + field);

const renamed = input();
renamed.canonicalActivityIdentity.canonicalLabel = 'Renamed display label';
renamed.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[1].sourceCandidate.resolvedTitle = 'Renamed source page';
renamed.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[1].linkResolutionAssessments[0].resolvedTitle = 'Renamed target';
renamed.contentHash = 'renamed-scope-evidence-hash';
const renamedBuilt = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions({
  signalScopeEvidenceRecords: [renamed],
  policy
});
assert.deepEqual(
  renamedBuilt.records[0].independentRepeatabilitySignalScopeDisposition,
  output.independentRepeatabilitySignalScopeDisposition
);

const incompleteInput = input();
incompleteInput.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0].state = 'incomplete_revision_pinned_signal_scope_evidence';
incompleteInput.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0].deficiencies = ['missing_resolution'];
incompleteInput.contentHash = 'incomplete-scope-evidence-hash';
const incomplete = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions({
  signalScopeEvidenceRecords: [incompleteInput],
  policy
});
assert.equal(incomplete.audit.publishable, false);
assert.ok(incomplete.audit.blockers.includes('one_or_more_signal_scope_evidence_records_failed_structural_integrity'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { 'signal:no-link': 'out_of_scope' };
const forbidden = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions({
  signalScopeEvidenceRecords: [source],
  policy: forbiddenPolicy
});
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_activity_specific_signal_scope_disposition_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].independentRepeatabilitySignalScopeDisposition.signalDispositions[0].state = 'supported_in_scope';
alteredRecords[0].independentRepeatabilitySignalScopeDisposition.signalDispositions[0].canonicalActivityScopeClassification = 'in_scope';
const altered = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions(alteredRecords, {
  signalScopeEvidenceRecords: [source],
  policy
});
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_signal_scope_dispositions_not_reproducible_from_generic_rules'));

const upstreamMutatedRecords = structuredClone(built.records);
upstreamMutatedRecords[0].independentRepeatabilitySignalScopeObservations.canonicalActivityScopeVerdict = 'in_scope';
const upstreamMutated = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions(upstreamMutatedRecords, {
  signalScopeEvidenceRecords: [source],
  policy
});
assert.equal(upstreamMutated.publishable, false);
assert.ok(upstreamMutated.blockers.includes('upstream_signal_scope_evidence_or_repeatability_state_mutated'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].independentRepeatabilitySignalScopeReview.repeatabilityClassification = 'repeatable';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions(promotedRecords, {
  signalScopeEvidenceRecords: [source],
  policy
});
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions(accountRecords, {
  signalScopeEvidenceRecords: [source],
  policy
});
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_signal_scope_dispositions'));

const compiled = compileIndependentRepeatabilitySignalScopeDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Generic independent repeatability signal-scope disposition checks passed.');
