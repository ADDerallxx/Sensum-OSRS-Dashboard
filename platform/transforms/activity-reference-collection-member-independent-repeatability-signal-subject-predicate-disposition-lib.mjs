import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const completePacketStates = new Set([
  'complete_revision_pinned_signal_subject_predicate_evidence_without_structural_anchor',
  'complete_revision_pinned_signal_subject_predicate_evidence_with_structural_anchor_observation'
]);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceIndependentRepeatabilitySignalSubjectPredicateEvidenceContentHash',
  'independentRepeatabilitySignalSubjectPredicateDisposition',
  'independentRepeatabilitySignalSubjectPredicateReview'
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
      if (/^(?:pageId|pageIds|revision|revisions|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|collectionDisplayLabel|collectionDisplayLabels|canonicalLabel|canonicalLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileIndependentRepeatabilitySignalSubjectPredicateDispositionPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneOutputRecordPerCompleteEvidenceRecord',
    'oneNestedDispositionPerExactSubjectPredicateEvidencePacket',
    'allExactRevisionLinePredicateLinkAndAnchorEvidenceRemainsExact',
    'incompleteSubjectPredicateEvidenceRemainsBlocked',
    'absenceOfAStableActivityAnchorRemainsAnUnresolvedEvidenceGap',
    'absenceOfAStableActivityAnchorCannotEstablishOutOfScope',
    'presenceOfAStableActivityAnchorRequiresSeparateSemanticBindingReview',
    'stableActivityAnchorObservationCannotEstablishSemanticBinding',
    'exactLineAndPredicateEvidenceCannotEstablishSemanticMeaningAlone',
    'sourcePageTitleCanonicalLabelLinkTextTargetTitlePageIdAndLexicalSimilarityCannotSelectADisposition',
    'canonicalActivitySubjectScopeAndRepeatabilityClassificationsRemainNull',
    'allUnresolvedSemanticStatesRemainExplicitAndPublishable',
    'upstreamEvidenceRoutingDispositionsReviewsAndIdentitiesRemainUnchanged',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract || !policy.inputState) {
    invalidRules.push('subject_predicate_disposition_contract_boundary_missing');
  }
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function evidencePackets(record = {}) {
  return record.independentRepeatabilitySignalSubjectPredicateEvidence?.signalSubjectPredicateEvidencePackets || [];
}

function packetStructurallyComplete(packet = {}) {
  const anchorKeys = packet.stableIdentityAnchorObservations?.stableAnchorEvidenceKeys || [];
  const expectsAnchor = packet.state === 'complete_revision_pinned_signal_subject_predicate_evidence_with_structural_anchor_observation';
  const expectsNoAnchor = packet.state === 'complete_revision_pinned_signal_subject_predicate_evidence_without_structural_anchor';
  const semantic = packet.semanticBinding || {};
  return completePacketStates.has(packet.state)
    && !(packet.deficiencies || []).length
    && packet.sourceRevisionVerification?.exactAlignment === true
    && packet.exactSourceLineEvidence?.exactContextMatch === true
    && packet.repeatabilityPredicateEvidence?.exactMatch === true
    && packet.repeatabilityPredicateEvidence?.semanticMeaningVerdict === null
    && packet.exactLineLinkRevalidation?.balancedSourceLinkDelimiters === true
    && packet.exactLineLinkRevalidation?.exactOccurrenceSetMatch === true
    && packet.exactLineLinkRevalidation?.exactLinkContextMatch === true
    && semantic.state === 'unreviewed_requires_generic_semantic_disposition'
    && semantic.canonicalActivitySubjectVerdict === null
    && semantic.canonicalActivityScopeVerdict === null
    && semantic.repeatabilityPredicateVerdict === null
    && semantic.repeatabilityVerdict === null
    && ((expectsAnchor && anchorKeys.length > 0) || (expectsNoAnchor && anchorKeys.length === 0));
}

function dispositionForPacket(packet = {}) {
  const anchorKeys = sorted(unique(packet.stableIdentityAnchorObservations?.stableAnchorEvidenceKeys || []));
  const linkKeys = sorted(unique(packet.exactLineLinkRevalidation?.revalidatedOccurrenceKeys || []));
  const complete = packetStructurallyComplete(packet);
  let state;
  let disposition;
  let deficiencies;
  let requiredEvidence;
  if (!complete) {
    state = 'blocked_incomplete_subject_predicate_evidence';
    disposition = 'repair_exact_revision_subject_predicate_evidence';
    deficiencies = unique([
      ...(packet.deficiencies || []),
      ...(!(packet.deficiencies || []).length ? ['subject_predicate_evidence_packet_not_structurally_complete'] : [])
    ]);
    requiredEvidence = ['complete_revision_pinned_signal_subject_predicate_evidence_packet'];
  } else if (!anchorKeys.length) {
    state = 'blocked_no_stable_activity_subject_anchor';
    disposition = 'semantic_binding_unresolved_missing_stable_activity_subject_anchor';
    deficiencies = ['no_stable_canonical_activity_subject_anchor_observed'];
    requiredEvidence = ['stable_canonical_activity_subject_declaration_or_exact_stable_anchor'];
  } else {
    state = 'queued_stable_activity_anchor_semantic_binding_review';
    disposition = 'semantic_binding_review_required';
    deficiencies = ['stable_activity_anchor_observation_requires_semantic_subject_predicate_binding_review'];
    requiredEvidence = ['source_bound_semantic_subject_predicate_binding_review'];
  }
  return {
    signalEvidenceKey: packet.signalEvidenceKey || null,
    sourceEvidenceState: packet.state || null,
    state,
    disposition,
    structuralAnchorObserved: anchorKeys.length > 0,
    semanticSubjectBinding: null,
    canonicalActivitySubjectClassification: null,
    canonicalActivityScopeClassification: null,
    repeatabilityPredicateClassification: null,
    repeatabilityClassification: null,
    sourceRevisionKey: [
      packet.sourceRevisionVerification?.expected?.sourcePageId,
      packet.sourceRevisionVerification?.expected?.sourceRevision,
      packet.sourceRevisionVerification?.expected?.sourceContentHash
    ].filter(value => value !== null && value !== undefined && value !== '').join(':'),
    exactSourceLineEvidenceKey: packet.exactSourceLineEvidence?.sourceLineContentHash
      ? (packet.signalEvidenceKey + ':line:' + packet.exactSourceLineEvidence.sourceLineContentHash)
      : null,
    exactLineLinkOccurrenceKeys: linkKeys,
    stableActivityAnchorEvidenceKeys: anchorKeys,
    evidenceKeys: sorted(unique([
      packet.signalEvidenceKey,
      packet.exactSourceLineEvidence?.sourceLineContentHash
        ? packet.signalEvidenceKey + ':line:' + packet.exactSourceLineEvidence.sourceLineContentHash
        : null,
      ...linkKeys,
      ...anchorKeys
    ].filter(Boolean))),
    deficiencies,
    requiredEvidence
  };
}

function expectedRecord(input, policy) {
  const dispositions = evidencePackets(input).map(dispositionForPacket)
    .sort((a, b) => String(a.signalEvidenceKey).localeCompare(String(b.signalEvidenceKey)));
  const incompleteCount = dispositions.filter(item => item.state === 'blocked_incomplete_subject_predicate_evidence').length;
  const noAnchorCount = dispositions.filter(item => item.state === 'blocked_no_stable_activity_subject_anchor').length;
  const anchoredPendingCount = dispositions.filter(item => item.state === 'queued_stable_activity_anchor_semantic_binding_review').length;
  const inheritedBlockers = (input.blockers || []).filter(blocker =>
    blocker !== 'independent_repeatability_signal_subject_predicate_evidence_requires_semantic_disposition'
  );
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceIndependentRepeatabilitySignalSubjectPredicateEvidenceContentHash: input.contentHash,
    independentRepeatabilitySignalSubjectPredicateDisposition: {
      state: incompleteCount
        ? 'blocked_incomplete_subject_predicate_evidence'
        : 'reviewed_all_subject_predicate_evidence_states_semantically_unresolved',
      signalDispositionCount: dispositions.length,
      incompleteEvidenceCount: incompleteCount,
      noStableActivitySubjectAnchorCount: noAnchorCount,
      stableActivityAnchorPendingSemanticBindingReviewCount: anchoredPendingCount,
      semanticSubjectBindingCount: 0,
      canonicalActivityScopeClassificationCount: 0,
      repeatabilityClassificationCount: 0,
      signalDispositions: dispositions,
      deficiencies: sorted(unique(dispositions.flatMap(item => item.deficiencies)))
    },
    independentRepeatabilitySignalSubjectPredicateReview: {
      state: 'reviewed_all_subject_predicate_evidence_states_semantically_unresolved',
      semanticSubjectBinding: null,
      canonicalActivitySubjectClassification: null,
      canonicalActivityScopeClassification: null,
      repeatabilityPredicateClassification: null,
      repeatabilityClassification: null,
      evidenceKeys: sorted(unique(dispositions.flatMap(item => item.evidenceKeys))),
      requiredEvidence: sorted(unique(dispositions.flatMap(item => item.requiredEvidence)))
    },
    accountIndependent: true,
    blockers: unique([
      ...inheritedBlockers,
      ...dispositions.flatMap(item => item.deficiencies),
      'canonical_activity_subject_binding_unresolved',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: incompleteCount
      ? 'independent_repeatability_signal_subject_predicate_disposition_input_blocked'
      : 'independent_repeatability_signal_subject_predicate_disposition_reviewed_unresolved'
  };
}

export function buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions({
  subjectPredicateEvidenceRecords = [],
  policy = {}
}) {
  const records = subjectPredicateEvidenceRecords.map(input => expectedRecord(input, policy));
  return {
    records,
    audit: auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions(records, {
      subjectPredicateEvidenceRecords,
      policy
    })
  };
}

export function auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateDispositions(records = [], {
  subjectPredicateEvidenceRecords = [],
  policy = {}
} = {}) {
  const compiled = compileIndependentRepeatabilitySignalSubjectPredicateDispositionPolicy(policy);
  const expectedKeys = subjectPredicateEvidenceRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(subjectPredicateEvidenceRecords.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.sourceIndependentRepeatabilitySignalSubjectPredicateEvidenceContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const structurallyInvalidInputs = subjectPredicateEvidenceRecords.filter(record => {
    const packets = evidencePackets(record);
    return record.contract !== policy.inputContract
      || record.state !== policy.inputState
      || !record.contentHash
      || record.accountIndependent !== true
      || record.independentRepeatabilitySignalSubjectPredicateEvidence?.evidenceState !== 'complete_revision_pinned_independent_repeatability_signal_subject_predicate_evidence_packet'
      || record.independentRepeatabilitySignalSubjectPredicateObservations?.semanticSubjectBindingCount !== 0
      || record.independentRepeatabilitySignalSubjectPredicateObservations?.canonicalActivityScopeVerdict !== null
      || record.independentRepeatabilitySignalSubjectPredicateObservations?.repeatabilityVerdict !== null
      || record.independentRepeatabilitySignalSubjectPredicateObservations?.evidencePacketCount !== packets.length
      || !packets.length
      || packets.some(packet => !packetStructurallyComplete(packet))
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
      || JSON.stringify(record.independentRepeatabilitySignalSubjectPredicateDisposition) !== JSON.stringify(expected.independentRepeatabilitySignalSubjectPredicateDisposition)
      || JSON.stringify(record.independentRepeatabilitySignalSubjectPredicateReview) !== JSON.stringify(expected.independentRepeatabilitySignalSubjectPredicateReview)
      || JSON.stringify(record.blockers) !== JSON.stringify(expected.blockers)
      || record.state !== expected.state;
  }).map(record => record.memberCandidateKey);
  const upstreamMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return input && JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const inputPacketPairs = subjectPredicateEvidenceRecords.flatMap(record => evidencePackets(record)
    .map(packet => record.memberCandidateKey + '|' + packet.signalEvidenceKey));
  const outputDispositions = records.flatMap(record =>
    (record.independentRepeatabilitySignalSubjectPredicateDisposition?.signalDispositions || [])
      .map(disposition => ({ memberCandidateKey: record.memberCandidateKey, disposition }))
  );
  const outputPacketPairs = outputDispositions.map(({ memberCandidateKey, disposition }) =>
    memberCandidateKey + '|' + disposition.signalEvidenceKey
  );
  const missingPacketPairs = inputPacketPairs.filter(key => !outputPacketPairs.includes(key));
  const unexpectedPacketPairs = outputPacketPairs.filter(key => !inputPacketPairs.includes(key));
  const duplicateInputPacketPairs = duplicates(inputPacketPairs);
  const duplicateOutputPacketPairs = duplicates(outputPacketPairs);
  const dispositions = outputDispositions.map(item => item.disposition);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const review = record.independentRepeatabilitySignalSubjectPredicateReview || {};
    const localDispositions = record.independentRepeatabilitySignalSubjectPredicateDisposition?.signalDispositions || [];
    return !input
      || review.semanticSubjectBinding !== null
      || review.canonicalActivitySubjectClassification !== null
      || review.canonicalActivityScopeClassification !== null
      || review.repeatabilityPredicateClassification !== null
      || review.repeatabilityClassification !== null
      || localDispositions.some(item => item.semanticSubjectBinding !== null
        || item.canonicalActivitySubjectClassification !== null
        || item.canonicalActivityScopeClassification !== null
        || item.repeatabilityPredicateClassification !== null
        || item.repeatabilityClassification !== null)
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_subject_predicate_evidence_inputs');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_subject_predicate_disposition_record_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_evidence_route_disposition_review_or_context_fields_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_subject_predicate_evidence_inputs_failed_structural_integrity');
  if (invalidDispositionRecords.length) structuralBlockers.push('one_or_more_subject_predicate_dispositions_not_reproducible_from_generic_rules');
  if (missingPacketPairs.length || unexpectedPacketPairs.length || duplicateInputPacketPairs.length || duplicateOutputPacketPairs.length) structuralBlockers.push('input_evidence_packet_and_output_disposition_sets_do_not_match_exactly');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) structuralBlockers.push('subject_predicate_disposition_policy_invalid_or_activity_specific');
  if (upstreamMutations.length) structuralBlockers.push('subject_predicate_disposition_changed_upstream_evidence_routing_disposition_review_or_identity');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_subject_binding_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_subject_predicate_dispositions');
  const subjectPredicateDispositionAttemptCoverageComplete = expectedKeys.length > 0 && inputPacketPairs.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length
    && !missingPacketPairs.length && !unexpectedPacketPairs.length && !duplicateInputPacketPairs.length && !duplicateOutputPacketPairs.length;
  const signalSubjectPredicateDispositionCoverageComplete = subjectPredicateDispositionAttemptCoverageComplete
    && structuralBlockers.length === 0;
  const stateCount = state => dispositions.filter(item => item.state === state).length;
  const noAnchorCount = stateCount('blocked_no_stable_activity_subject_anchor');
  const anchorPendingCount = stateCount('queued_stable_activity_anchor_semantic_binding_review');
  const blockers = [...structuralBlockers];
  if (noAnchorCount) blockers.push('one_or_more_subject_predicate_packets_lack_a_stable_activity_subject_anchor');
  if (anchorPendingCount) blockers.push('one_or_more_stable_anchor_observations_require_semantic_binding_review');
  blockers.push(
    'canonical_activity_subject_binding_unresolved',
    'canonical_activity_scope_review_incomplete',
    'repeatability_classification_unresolved',
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract,
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedRecordCount: expectedKeys.length,
      outputRecordCount: records.length,
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
      inputSubjectPredicateEvidencePacketCount: inputPacketPairs.length,
      signalSubjectPredicateDispositionCount: dispositions.length,
      missingPacketPairs,
      unexpectedPacketPairs,
      duplicateInputPacketPairs,
      duplicateOutputPacketPairs,
      incompleteEvidenceCount: stateCount('blocked_incomplete_subject_predicate_evidence'),
      noStableActivitySubjectAnchorCount: noAnchorCount,
      stableActivityAnchorPendingSemanticBindingReviewCount: anchorPendingCount,
      semanticSubjectBindingCount: dispositions.filter(item => item.semanticSubjectBinding !== null).length,
      canonicalActivityScopeClassificationCount: dispositions.filter(item => item.canonicalActivityScopeClassification !== null).length,
      repeatabilityClassificationCount: dispositions.filter(item => item.repeatabilityClassification !== null).length,
      invalidDispositionMemberCandidateKeys: invalidDispositionRecords,
      exactEvidenceDispositionSetMatch: !missingPacketPairs.length && !unexpectedPacketPairs.length
        && !duplicateInputPacketPairs.length && !duplicateOutputPacketPairs.length
    },
    semanticPromotionCoverage: {
      upstreamMutationMemberCandidateKeys: upstreamMutations,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions,
      semanticSubjectBindingCount: 0,
      canonicalActivityScopeClassificationCount: 0,
      repeatabilityClassificationCount: 0,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length
    },
    accountStateFindings,
    subjectPredicateDispositionAttemptCoverageComplete,
    signalSubjectPredicateDispositionCoverageComplete,
    semanticSubjectBindingReviewComplete: false,
    canonicalActivityScopeReviewComplete: false,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: signalSubjectPredicateDispositionCoverageComplete
  };
}
