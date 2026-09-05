import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions,
  buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions,
  compileIndependentRepeatabilitySignalSubjectPredicateDispositionPolicy
} from '../transforms/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync(
  'platform/policies/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-disposition-v1.json',
  'utf8'
));
const recordContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-disposition-v1.json',
  'utf8'
));
const auditContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-disposition-audit-v1.json',
  'utf8'
));

function packet({ key, anchored = false }) {
  return {
    signalEvidenceKey: 'signal:' + key,
    evidenceWorkRoute: {
      signalEvidenceKey: 'signal:' + key,
      routeKey: anchored
        ? 'resolve_stable_activity_anchor_then_bind_repeatability_predicate'
        : 'collect_source_bound_subject_predicate_binding_without_exact_line_link',
      routeState: 'blocked_semantic_scope_evidence_gap',
      evidenceWorkComplete: false
    },
    sourceRevisionVerification: {
      expected: {
        sourcePageId: 200,
        resolvedTitle: 'Observed source title',
        sourceRevision: '2000',
        sourceTimestamp: '2026-09-04T00:00:00Z',
        sourceUrl: 'https://oldschool.runescape.wiki/w/Observed_source_title',
        sourceContentHash: 'source-hash'
      },
      fetched: {
        sourcePageId: 200,
        resolvedTitle: 'Observed source title',
        sourceRevision: '2000',
        sourceTimestamp: '2026-09-04T00:00:00Z',
        sourceUrl: 'https://oldschool.runescape.wiki/w/Observed_source_title',
        sourceContentHash: 'source-hash',
        sourceContentBytes: 100
      },
      exactAlignment: true
    },
    exactSourceLineEvidence: {
      lineStart: 10,
      lineEnd: 10,
      text: 'This action can be repeated.',
      sourceLineContentHash: 'line-hash-' + key,
      retainedContextText: 'This action can be repeated.',
      exactContextMatch: true
    },
    repeatabilityPredicateEvidence: {
      definitionKey: 'positive-repeatability',
      signalKind: 'explicit_positive_repeatability_declaration_candidate',
      columnStart: 20,
      columnEnd: 27,
      expectedText: 'repeated',
      extractedText: 'repeated',
      exactMatch: true,
      semanticMeaningVerdict: null
    },
    exactLineLinkRevalidation: {
      expectedLinks: [],
      revalidatedLinks: [],
      expectedOccurrenceKeys: [],
      revalidatedOccurrenceKeys: [],
      exactOccurrenceSetMatch: true,
      exactLinkContextMatch: true,
      balancedSourceLinkDelimiters: true
    },
    stableIdentityAnchorObservations: {
      canonicalActivityKey: 'activity:stable',
      linkedSubjectPageId: 777,
      collectionPageId: 50,
      relationshipClass: 'describes',
      sourceMatchesLinkedSubjectAnchor: anchored,
      sourceMatchesCollectionAnchor: false,
      linkedTargetAnchorOccurrenceKeys: [],
      collectionTargetAnchorOccurrenceKeys: [],
      stableAnchorEvidenceKeys: anchored ? ['source-page-matches-linked-subject-anchor'] : [],
      structuralState: anchored
        ? 'stable_activity_anchor_observed_semantic_binding_unreviewed'
        : 'no_stable_activity_anchor_observed_semantic_binding_unresolved'
    },
    semanticBinding: {
      state: 'unreviewed_requires_generic_semantic_disposition',
      canonicalActivitySubjectVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityPredicateVerdict: null,
      repeatabilityVerdict: null,
      pronounAntecedentReviewed: false,
      implicitSubjectReviewed: false,
      crossSentenceCoreferenceReviewed: false,
      variantOrModeScopeReviewed: false
    },
    limitations: anchored
      ? ['exact_source_line_and_predicate_span_do_not_establish_semantic_subject_binding']
      : [
          'no_stable_canonical_activity_anchor_on_exact_signal_source_or_link_targets',
          'exact_source_line_and_predicate_span_do_not_establish_semantic_subject_binding'
        ],
    deficiencies: [],
    state: anchored
      ? 'complete_revision_pinned_signal_subject_predicate_evidence_with_structural_anchor_observation'
      : 'complete_revision_pinned_signal_subject_predicate_evidence_without_structural_anchor'
  };
}

function input(memberCandidateKey = 'member:example') {
  const packets = [
    packet({ key: 'no-anchor' }),
    packet({ key: 'anchor', anchored: true })
  ];
  return {
    contract: 'sensum.activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence.v1',
    memberCandidateKey,
    canonicalActivityIdentity: {
      canonicalActivityKey: 'activity:stable',
      canonicalLabel: 'Example activity',
      stableIdentityAnchor: {
        linkedSubjectPageId: 777,
        collectionPageId: 50,
        relationshipClass: 'describes'
      }
    },
    independentRepeatabilitySignalScopeEvidenceWorkRouting: {
      state: 'routed_all_signal_scope_evidence_obligations_downstream_gates_closed'
    },
    independentRepeatabilitySignalSubjectPredicateEvidence: {
      evidenceState: 'complete_revision_pinned_independent_repeatability_signal_subject_predicate_evidence_packet',
      evidenceChannel: 'exact_revision_source_line_predicate_span_and_stable_identity_anchor_observations',
      signalSubjectPredicateEvidencePackets: packets
    },
    independentRepeatabilitySignalSubjectPredicateObservations: {
      routedSignalCount: 2,
      evidencePacketCount: 2,
      exactRevisionAlignedPacketCount: 2,
      exactSourceLineRevalidatedCount: 2,
      exactPredicateSpanRevalidatedCount: 2,
      exactLineLinkSetRevalidatedCount: 2,
      stableActivityAnchorObservedPacketCount: 1,
      noStableActivityAnchorObservedPacketCount: 1,
      semanticSubjectBindingCount: 0,
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
      'independent_repeatability_signal_subject_predicate_evidence_requires_semantic_disposition',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'optimizer_eligibility_blocked'
    ],
    state: 'independent_repeatability_signal_subject_predicate_evidence_ready_for_semantic_disposition',
    contentHash: 'subject-predicate-evidence-hash-' + memberCandidateKey
  };
}

const source = input();
const built = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions({
  subjectPredicateEvidenceRecords: [source],
  policy
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.subjectPredicateDispositionAttemptCoverageComplete, true);
assert.equal(built.audit.signalSubjectPredicateDispositionCoverageComplete, true);
assert.equal(built.audit.semanticSubjectBindingReviewComplete, false);
assert.equal(built.audit.canonicalActivityScopeReviewComplete, false);
assert.equal(built.audit.dispositionCoverage.inputSubjectPredicateEvidencePacketCount, 2);
assert.equal(built.audit.dispositionCoverage.signalSubjectPredicateDispositionCount, 2);
assert.equal(built.audit.dispositionCoverage.noStableActivitySubjectAnchorCount, 1);
assert.equal(built.audit.dispositionCoverage.stableActivityAnchorPendingSemanticBindingReviewCount, 1);
const output = built.records[0];
const bySignal = new Map(output.independentRepeatabilitySignalSubjectPredicateDisposition.signalDispositions
  .map(disposition => [disposition.signalEvidenceKey, disposition]));
assert.equal(bySignal.get('signal:no-anchor').state, 'blocked_no_stable_activity_subject_anchor');
assert.equal(bySignal.get('signal:anchor').state, 'queued_stable_activity_anchor_semantic_binding_review');
assert.ok([...bySignal.values()].every(item =>
  item.semanticSubjectBinding === null
  && item.canonicalActivitySubjectClassification === null
  && item.canonicalActivityScopeClassification === null
  && item.repeatabilityPredicateClassification === null
  && item.repeatabilityClassification === null
));
assert.ok(output.blockers.includes('no_stable_canonical_activity_subject_anchor_observed'));
assert.ok(!output.blockers.includes('independent_repeatability_signal_subject_predicate_evidence_requires_semantic_disposition'));
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), 'Missing required record field: ' + field);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), 'Missing required audit field: ' + field);

const renamed = input();
renamed.canonicalActivityIdentity.canonicalLabel = 'Renamed display label';
renamed.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[0]
  .sourceRevisionVerification.expected.resolvedTitle = 'Renamed source title';
renamed.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[0]
  .sourceRevisionVerification.fetched.resolvedTitle = 'Renamed source title';
renamed.contentHash = 'renamed-subject-predicate-evidence-hash';
const renamedBuilt = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions({
  subjectPredicateEvidenceRecords: [renamed],
  policy
});
assert.deepEqual(
  renamedBuilt.records[0].independentRepeatabilitySignalSubjectPredicateDisposition,
  output.independentRepeatabilitySignalSubjectPredicateDisposition
);

const incompleteInput = input();
incompleteInput.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[0].state
  = 'incomplete_revision_pinned_signal_subject_predicate_evidence';
incompleteInput.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[0].deficiencies
  = ['exact_repeatability_predicate_span_mismatch'];
incompleteInput.contentHash = 'incomplete-subject-predicate-evidence-hash';
const incomplete = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions({
  subjectPredicateEvidenceRecords: [incompleteInput],
  policy
});
assert.equal(incomplete.audit.publishable, false);
assert.ok(incomplete.audit.blockers.includes('one_or_more_subject_predicate_evidence_inputs_failed_structural_integrity'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { 'signal:no-anchor': 'out_of_scope' };
const forbidden = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions({
  subjectPredicateEvidenceRecords: [source],
  policy: forbiddenPolicy
});
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('subject_predicate_disposition_policy_invalid_or_activity_specific'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].independentRepeatabilitySignalSubjectPredicateDisposition.signalDispositions[0].state = 'supported_out_of_scope';
alteredRecords[0].independentRepeatabilitySignalSubjectPredicateDisposition.signalDispositions[0].canonicalActivityScopeClassification = 'out_of_scope';
const altered = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions(alteredRecords, {
  subjectPredicateEvidenceRecords: [source],
  policy
});
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_subject_predicate_dispositions_not_reproducible_from_generic_rules'));
assert.ok(altered.blockers.includes('unsupported_subject_binding_scope_repeatability_member_mechanics_or_optimizer_promotion'));

const upstreamMutatedRecords = structuredClone(built.records);
upstreamMutatedRecords[0].independentRepeatabilitySignalSubjectPredicateEvidence
  .signalSubjectPredicateEvidencePackets[0].repeatabilityPredicateEvidence.semanticMeaningVerdict = 'repeatable';
const upstreamMutated = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions(upstreamMutatedRecords, {
  subjectPredicateEvidenceRecords: [source],
  policy
});
assert.equal(upstreamMutated.publishable, false);
assert.ok(upstreamMutated.blockers.includes('subject_predicate_disposition_changed_upstream_evidence_routing_disposition_review_or_identity'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].independentRepeatabilitySignalSubjectPredicateReview.repeatabilityClassification = 'repeatable';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions(promotedRecords, {
  subjectPredicateEvidenceRecords: [source],
  policy
});
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_subject_binding_scope_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions(accountRecords, {
  subjectPredicateEvidenceRecords: [source],
  policy
});
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_subject_predicate_dispositions'));

const duplicateSignalInput = input();
duplicateSignalInput.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[1].signalEvidenceKey
  = duplicateSignalInput.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[0].signalEvidenceKey;
const duplicateSignal = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions({
  subjectPredicateEvidenceRecords: [duplicateSignalInput],
  policy
});
assert.equal(duplicateSignal.audit.publishable, false);
assert.ok(duplicateSignal.audit.blockers.includes('input_evidence_packet_and_output_disposition_sets_do_not_match_exactly'));

const sharedSignalA = input('member:a');
const sharedSignalB = input('member:b');
const sharedSignals = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions({
  subjectPredicateEvidenceRecords: [sharedSignalA, sharedSignalB],
  policy
});
assert.equal(sharedSignals.audit.publishable, true);
assert.equal(sharedSignals.audit.dispositionCoverage.signalSubjectPredicateDispositionCount, 4);
assert.deepEqual(sharedSignals.audit.dispositionCoverage.duplicateOutputPacketPairs, []);

const compiled = compileIndependentRepeatabilitySignalSubjectPredicateDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Generic independent repeatability signal subject-predicate disposition checks passed.');
