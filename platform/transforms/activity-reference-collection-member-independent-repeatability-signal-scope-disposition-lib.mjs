import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const completePacketStates = new Set([
  'complete_revision_pinned_exact_line_link_scope_evidence',
  'complete_no_source_authored_main_namespace_link_on_exact_signal_line'
]);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceIndependentRepeatabilitySignalScopeEvidenceContentHash',
  'independentRepeatabilitySignalScopeDisposition',
  'independentRepeatabilitySignalScopeReview'
]);

function preservedInput(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !stageFields.has(key)));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, path + '[' + index + ']'));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? path + '.' + name : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileIndependentRepeatabilitySignalScopeDispositionPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneDispositionPerCompleteSignalScopeEvidenceRecord',
    'oneNestedDispositionPerExactSignalScopeEvidencePacket',
    'allUpstreamIdentityRevisionHashEvidenceAndContextRemainExact',
    'incompleteScopeEvidenceRemainsBlocked',
    'absenceOfAnExactLineLinkCannotEstablishOutOfScope',
    'exactLineLinksWithoutAStableAnchorCannotEstablishScope',
    'stableAnchorObservationWithoutSemanticSubjectBindingCannotEstablishScope',
    'sourcePageTitleLinkTextTargetTitlePageIdAndLexicalSimilarityCannotSelectADisposition',
    'noScopeDispositionCanCreateARepeatabilityClassification',
    'allUnresolvedScopeStatesRemainExplicitAndPublishable',
    'upstreamDispositionsReviewsAndEvidenceRemainUnchanged',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract) {
    invalidRules.push('signal_scope_disposition_contract_boundary_missing');
  }
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function signalPackets(record = {}) {
  return record.independentRepeatabilitySignalScopeEvidence?.signalScopeEvidencePackets || [];
}

function anchorEvidenceKeys(packet = {}) {
  const comparisons = packet.stableIdentityComparisons || {};
  const keys = [];
  if (comparisons.signalSourcePageMatchesLinkedSubjectAnchor) keys.push(packet.signalEvidenceKey + ':source_page_matches_linked_subject_anchor');
  if (comparisons.signalSourcePageMatchesCollectionAnchor) keys.push(packet.signalEvidenceKey + ':source_page_matches_collection_anchor');
  for (const key of comparisons.linkedSubjectAnchorTargetOccurrenceKeys || []) keys.push(packet.signalEvidenceKey + ':target_matches_linked_subject_anchor:' + key);
  for (const key of comparisons.collectionAnchorTargetOccurrenceKeys || []) keys.push(packet.signalEvidenceKey + ':target_matches_collection_anchor:' + key);
  return sorted(unique(keys));
}

function dispositionForSignal(packet = {}) {
  const links = packet.exactLineSourceAuthoredMainNamespaceLinks || [];
  const assessments = packet.linkResolutionAssessments || [];
  const anchors = anchorEvidenceKeys(packet);
  const complete = completePacketStates.has(packet.state)
    && !(packet.deficiencies || []).length
    && links.length === assessments.length
    && assessments.every(item => item.resolutionState === 'revision_pinned_official_wiki_main_namespace_page')
    && packet.canonicalActivityScopeVerdict === null
    && packet.repeatabilityVerdict === null;
  let state;
  let deficiencies;
  let requiredEvidence;
  if (!complete) {
    state = 'blocked_incomplete_signal_scope_evidence';
    deficiencies = unique([
      ...(packet.deficiencies || []),
      ...(!complete && !(packet.deficiencies || []).length ? ['signal_scope_evidence_packet_not_structurally_complete'] : [])
    ]);
    requiredEvidence = ['complete_revision_pinned_exact_signal_scope_evidence_packet'];
  } else if (!links.length) {
    state = 'blocked_no_exact_line_main_namespace_link_for_scope';
    deficiencies = ['absence_of_exact_line_link_does_not_establish_canonical_activity_scope'];
    requiredEvidence = ['source_bound_semantic_subject_and_predicate_evidence_for_exact_canonical_activity'];
  } else if (!anchors.length) {
    state = 'blocked_exact_line_links_without_stable_identity_anchor';
    deficiencies = ['exact_line_links_do_not_reference_a_reviewed_stable_activity_identity_anchor'];
    requiredEvidence = ['stable_canonical_activity_reference_and_semantic_predicate_binding_on_exact_source_line'];
  } else {
    state = 'blocked_stable_identity_anchor_observation_without_semantic_subject_binding';
    deficiencies = ['stable_identity_anchor_observation_does_not_prove_the_repeatability_predicate_applies_to_the_canonical_activity'];
    requiredEvidence = ['exact_source_grammar_or_equivalent_authoritative_semantic_binding_between_activity_subject_and_repeatability_predicate'];
  }
  return {
    signalEvidenceKey: packet.signalEvidenceKey || null,
    state,
    canonicalActivityScopeClassification: null,
    repeatabilityClassification: null,
    semanticSubjectBinding: null,
    exactLineLinkOccurrenceKeys: links.map(link => link.occurrenceKey).filter(Boolean),
    stableIdentityAnchorEvidenceKeys: anchors,
    sourceRevisionKey: packet.sourceCandidate?.sourcePageId + ':' + packet.sourceCandidate?.sourceRevision + ':' + packet.sourceCandidate?.sourceContentHash,
    evidenceKeys: unique([
      packet.signalEvidenceKey,
      ...links.map(link => link.occurrenceKey),
      ...anchors
    ].filter(Boolean)),
    deficiencies,
    requiredEvidence
  };
}

function expectedRecord(input, policy) {
  const dispositions = signalPackets(input).map(dispositionForSignal)
    .sort((a, b) => String(a.signalEvidenceKey).localeCompare(String(b.signalEvidenceKey)));
  const incompleteCount = dispositions.filter(item => item.state === 'blocked_incomplete_signal_scope_evidence').length;
  const noLinkCount = dispositions.filter(item => item.state === 'blocked_no_exact_line_main_namespace_link_for_scope').length;
  const noAnchorCount = dispositions.filter(item => item.state === 'blocked_exact_line_links_without_stable_identity_anchor').length;
  const unboundAnchorCount = dispositions.filter(item => item.state === 'blocked_stable_identity_anchor_observation_without_semantic_subject_binding').length;
  const evidenceKeys = dispositions.flatMap(item => item.evidenceKeys);
  const inheritedBlockers = (input.blockers || []).filter(blocker =>
    blocker !== 'independent_repeatability_signal_scope_evidence_requires_semantic_disposition'
    && blocker !== 'canonical_activity_scope_review_incomplete'
  );
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceIndependentRepeatabilitySignalScopeEvidenceContentHash: input.contentHash,
    independentRepeatabilitySignalScopeDisposition: {
      state: incompleteCount ? 'blocked_incomplete_scope_evidence' : 'reviewed_all_signal_scope_states_unresolved',
      canonicalActivityScopeClassification: null,
      repeatabilityClassification: null,
      signalDispositionCount: dispositions.length,
      incompleteScopeEvidenceCount: incompleteCount,
      noExactLineLinkCount: noLinkCount,
      exactLineLinksWithoutStableAnchorCount: noAnchorCount,
      unboundStableAnchorObservationCount: unboundAnchorCount,
      signalDispositions: dispositions,
      deficiencies: unique(dispositions.flatMap(item => item.deficiencies))
    },
    independentRepeatabilitySignalScopeReview: {
      state: 'reviewed_blocked',
      canonicalActivityScopeClassification: null,
      repeatabilityClassification: null,
      evidenceKeys: sorted(unique(evidenceKeys)),
      requiredEvidence: sorted(unique(dispositions.flatMap(item => item.requiredEvidence)))
    },
    accountIndependent: true,
    blockers: unique([
      ...inheritedBlockers,
      ...dispositions.flatMap(item => item.deficiencies),
      'canonical_activity_scope_unresolved',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: incompleteCount
      ? 'independent_repeatability_signal_scope_disposition_input_blocked'
      : 'independent_repeatability_signal_scope_disposition_reviewed_unresolved'
  };
}

export function buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions({
  signalScopeEvidenceRecords = [],
  policy = {}
}) {
  const records = signalScopeEvidenceRecords.map(input => expectedRecord(input, policy));
  return {
    records,
    audit: auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions(records, {
      signalScopeEvidenceRecords,
      policy
    })
  };
}

export function auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeDispositions(records = [], {
  signalScopeEvidenceRecords = [],
  policy = {}
} = {}) {
  const compiled = compileIndependentRepeatabilitySignalScopeDispositionPolicy(policy);
  const expectedKeys = signalScopeEvidenceRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(signalScopeEvidenceRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output
      || output.sourceIndependentRepeatabilitySignalScopeEvidenceContentHash !== input.contentHash
      || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const structurallyInvalidInputs = signalScopeEvidenceRecords.filter(record => {
    const packets = signalPackets(record);
    return record.contract !== policy.inputContract
      || !record.contentHash
      || record.accountIndependent !== true
      || record.state !== 'independent_repeatability_signal_scope_evidence_ready_for_semantic_disposition'
      || record.independentRepeatabilitySignalScopeEvidence?.evidenceState !== 'complete_revision_pinned_independent_repeatability_signal_scope_evidence_packet'
      || record.independentRepeatabilitySignalScopeObservations?.canonicalActivityScopeVerdict !== null
      || record.independentRepeatabilitySignalScopeObservations?.repeatabilityVerdict !== null
      || record.independentRepeatabilitySignalScopeObservations?.signalScopeEvidencePacketCount !== packets.length
      || !packets.length
      || packets.some(packet => !completePacketStates.has(packet.state) || (packet.deficiencies || []).length)
      || record.repeatabilityDisposition?.classification !== null
      || record.corroboratingRepeatabilityDisposition?.classification !== null
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const invalidDispositionRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedRecord(input, policy);
    return record.contract !== expected.contract
      || JSON.stringify(record.independentRepeatabilitySignalScopeDisposition) !== JSON.stringify(expected.independentRepeatabilitySignalScopeDisposition)
      || JSON.stringify(record.independentRepeatabilitySignalScopeReview) !== JSON.stringify(expected.independentRepeatabilitySignalScopeReview)
      || JSON.stringify(record.blockers) !== JSON.stringify(expected.blockers)
      || record.state !== expected.state;
  }).map(record => record.memberCandidateKey);
  const upstreamMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return input && (
      JSON.stringify(record.independentRepeatabilitySignalScopeEvidence) !== JSON.stringify(input.independentRepeatabilitySignalScopeEvidence)
      || JSON.stringify(record.independentRepeatabilitySignalScopeObservations) !== JSON.stringify(input.independentRepeatabilitySignalScopeObservations)
      || JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(input.repeatabilityDisposition)
      || JSON.stringify(record.repeatabilityReview) !== JSON.stringify(input.repeatabilityReview)
      || JSON.stringify(record.corroboratingRepeatabilityDisposition) !== JSON.stringify(input.corroboratingRepeatabilityDisposition)
      || JSON.stringify(record.corroboratingRepeatabilityReview) !== JSON.stringify(input.corroboratingRepeatabilityReview)
    );
  }).map(record => record.memberCandidateKey);
  const dispositions = records.flatMap(record =>
    record.independentRepeatabilitySignalScopeDisposition?.signalDispositions || []
  );
  const expectedSignalKeys = signalScopeEvidenceRecords.flatMap(record =>
    signalPackets(record).map(packet => packet.signalEvidenceKey)
  );
  const actualSignalKeys = dispositions.map(item => item.signalEvidenceKey);
  const missingSignalKeys = expectedSignalKeys.filter(key => !actualSignalKeys.includes(key));
  const unexpectedSignalKeys = actualSignalKeys.filter(key => !expectedSignalKeys.includes(key));
  const duplicateSignalKeys = duplicates(actualSignalKeys);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const nested = record.independentRepeatabilitySignalScopeDisposition?.signalDispositions || [];
    return record.independentRepeatabilitySignalScopeDisposition?.canonicalActivityScopeClassification !== null
      || record.independentRepeatabilitySignalScopeDisposition?.repeatabilityClassification !== null
      || record.independentRepeatabilitySignalScopeReview?.canonicalActivityScopeClassification !== null
      || record.independentRepeatabilitySignalScopeReview?.repeatabilityClassification !== null
      || nested.some(item => item.canonicalActivityScopeClassification !== null
        || item.repeatabilityClassification !== null
        || item.semanticSubjectBinding !== null)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false
      || (input && (
        JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
        || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
        || record.optimizerEligible !== input.optimizerEligible
      ));
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_independent_repeatability_signal_scope_evidence_records');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) {
    structuralBlockers.push('input_and_output_signal_scope_disposition_record_sets_do_not_match_exactly');
  }
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_signal_scope_evidence_records_failed_structural_integrity');
  if (compiled.invalidRules.length) structuralBlockers.push('one_or_more_signal_scope_disposition_rules_missing_or_disabled');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_activity_specific_signal_scope_disposition_policy_forbidden');
  if (invalidDispositionRecords.length) structuralBlockers.push('one_or_more_signal_scope_dispositions_not_reproducible_from_generic_rules');
  if (missingSignalKeys.length || unexpectedSignalKeys.length || duplicateSignalKeys.length) {
    structuralBlockers.push('input_and_output_signal_scope_disposition_sets_do_not_match_exactly');
  }
  if (upstreamMutations.length) structuralBlockers.push('upstream_signal_scope_evidence_or_repeatability_state_mutated');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_signal_scope_dispositions');
  const stateCount = state => dispositions.filter(item => item.state === state).length;
  const signalScopeDispositionAttemptCoverageComplete = expectedKeys.length > 0
    && expectedSignalKeys.length > 0
    && structuralBlockers.length === 0;
  const canonicalActivityScopeClassificationCoverageComplete = signalScopeDispositionAttemptCoverageComplete
    && dispositions.every(item => item.canonicalActivityScopeClassification !== null);
  const blockers = [...structuralBlockers];
  if (!canonicalActivityScopeClassificationCoverageComplete) blockers.push('one_or_more_canonical_activity_scope_classifications_remain_unresolved');
  blockers.push(
    'repeatability_classification_unresolved',
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract,
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedSignalScopeEvidenceRecordCount: expectedKeys.length,
      signalScopeDispositionRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: structurallyInvalidInputs,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length
        && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths
    },
    dispositionCoverage: {
      inputSignalScopeEvidencePacketCount: expectedSignalKeys.length,
      signalScopeDispositionCount: dispositions.length,
      missingSignalEvidenceKeys: missingSignalKeys,
      unexpectedSignalEvidenceKeys: unexpectedSignalKeys,
      duplicateSignalEvidenceKeys: duplicateSignalKeys,
      incompleteScopeEvidenceCount: stateCount('blocked_incomplete_signal_scope_evidence'),
      noExactLineLinkCount: stateCount('blocked_no_exact_line_main_namespace_link_for_scope'),
      exactLineLinksWithoutStableAnchorCount: stateCount('blocked_exact_line_links_without_stable_identity_anchor'),
      unboundStableAnchorObservationCount: stateCount('blocked_stable_identity_anchor_observation_without_semantic_subject_binding'),
      resolvedCanonicalActivityScopeClassificationCount: dispositions.filter(item => item.canonicalActivityScopeClassification !== null).length,
      invalidDispositionMemberCandidateKeys: invalidDispositionRecords,
      upstreamMutationMemberCandidateKeys: upstreamMutations,
      exactSignalDispositionSetMatch: !missingSignalKeys.length && !unexpectedSignalKeys.length && !duplicateSignalKeys.length
    },
    semanticPromotionCoverage: {
      canonicalActivityScopeClassificationCount: 0,
      repeatabilityClassificationCount: 0,
      semanticSubjectBindingCount: 0,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    signalScopeDispositionAttemptCoverageComplete,
    canonicalActivityScopeClassificationCoverageComplete,
    canonicalActivityScopeReviewComplete: canonicalActivityScopeClassificationCoverageComplete,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: signalScopeDispositionAttemptCoverageComplete
  };
}
