import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const explicitKinds = new Set([
  'explicit_positive_repeatability_declaration_candidate',
  'explicit_negative_repeatability_declaration_candidate'
]);
const structuralKinds = new Set(['recurrence_structure_candidate', 'session_boundary_candidate']);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceRepeatabilityGapEvidenceContentHash',
  'corroboratingRepeatabilityDisposition', 'corroboratingRepeatabilityReview',
  'repeatabilityGapNextEvidenceWork'
]);

function preservedInput(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !stageFields.has(key)));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileRepeatabilityGapDispositionPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneDispositionPerCompleteGapEvidencePacket',
    'allUpstreamIdentityRevisionHashAndContextMustBePreserved',
    'onlyExplicitPositiveOrNegativeDeclarationsMaySupportClassification',
    'candidatePageDiscoveryDoesNotEstablishCanonicalActivityScope',
    'unscopedExplicitDeclarationsRemainBlocked',
    'opposingUnscopedDeclarationsRemainBlocked',
    'recurrenceAndSessionSignalsCannotSupportRepeatability',
    'absenceOfDeclarationsCannotSupportNonRepeatability',
    'boundedDiscoveryExhaustionIsNotAnAuthoritativeExclusion',
    'labelsTitlesPageIdsAliasesAndCollectionClassesCannotSelectADisposition',
    'upstreamRepeatabilityDispositionAndReviewMustRemainUnchanged',
    'unresolvedEvidenceRemainsExplicitAndPublishable',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'currentAccountStateIsForbidden'
  ];
  return {
    policyId: policy.policy || null,
    invalidRules: requiredTrueRules.filter(rule => policy.rules?.[rule] !== true),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function candidateSignals(record = {}) {
  return (record.corroboratingRepeatabilityEvidence?.candidatePages || []).flatMap(page =>
    (page.sourceLocatedSignals || []).map(signal => ({
      ...signal,
      candidateSourcePageId: page.sourcePageId,
      candidateSourceRevision: page.sourceRevision,
      candidateSourceContentHash: page.sourceContentHash,
      candidateSourceUrl: page.sourceUrl
    }))
  );
}

function revisionKeys(record = {}) {
  return (record.corroboratingRepeatabilityEvidence?.candidatePages || []).map(page =>
    `${page.sourcePageId}:${page.sourceRevision}:${page.sourceContentHash}`
  );
}

function expectedDisposition(record = {}) {
  const evidence = record.corroboratingRepeatabilityEvidence || {};
  const observations = record.corroboratingRepeatabilityCandidateObservations || {};
  const signals = candidateSignals(record);
  const positives = signals.filter(signal => signal.signalKind === 'explicit_positive_repeatability_declaration_candidate');
  const negatives = signals.filter(signal => signal.signalKind === 'explicit_negative_repeatability_declaration_candidate');
  const structural = signals.filter(signal => structuralKinds.has(signal.signalKind));
  const unsupported = signals.filter(signal => !explicitKinds.has(signal.signalKind) && !structuralKinds.has(signal.signalKind));
  const complete = evidence.evidenceState === 'complete_revision_pinned_corroborating_repeatability_evidence_packet'
    && !(observations.deficiencies || []).length;
  let state;
  let deficiencies;
  let routeKey;
  if (!complete || unsupported.length) {
    state = 'unresolved_incomplete_or_unsupported_corroborating_evidence';
    deficiencies = unique([
      ...(observations.deficiencies || []),
      ...(!complete && !(observations.deficiencies || []).length ? ['corroborating_repeatability_evidence_packet_not_complete'] : []),
      ...(unsupported.length ? ['unsupported_repeatability_signal_kind_observed'] : [])
    ]);
    routeKey = 'repair_repeatability_gap_evidence_packet';
  } else if (positives.length && negatives.length) {
    state = 'blocked_opposing_candidate_declarations_without_canonical_activity_scope';
    deficiencies = ['opposing_candidate_declarations_lack_exact_canonical_activity_scope'];
    routeKey = 'revision_pinned_canonical_activity_scope_evidence_required';
  } else if (positives.length || negatives.length) {
    state = 'blocked_explicit_declaration_candidate_without_canonical_activity_scope';
    deficiencies = ['candidate_page_declaration_not_scoped_to_exact_canonical_activity'];
    routeKey = 'revision_pinned_canonical_activity_scope_evidence_required';
  } else if (structural.length) {
    state = 'blocked_structural_signal_without_explicit_repeatability_declaration';
    deficiencies = ['recurrence_or_session_structure_is_not_explicit_repeatability_evidence'];
    routeKey = 'independent_authoritative_repeatability_source_discovery';
  } else {
    state = 'blocked_no_explicit_declaration_in_bounded_corroborating_sources';
    deficiencies = ['explicit_repeatability_declaration_not_observed_in_bounded_sources'];
    routeKey = 'independent_authoritative_repeatability_source_discovery';
  }
  return {
    state,
    classification: null,
    boundedEvidenceExhausted: complete,
    sourceRevisionKeys: revisionKeys(record),
    signalEvidenceKeys: signals.map(signal => signal.evidenceKey).filter(Boolean),
    positiveDeclarationCandidateCount: positives.length,
    negativeDeclarationCandidateCount: negatives.length,
    structuralSignalCandidateCount: structural.length,
    deficiencies,
    routeKey
  };
}

function expectedRecord(input, policy) {
  const disposition = expectedDisposition(input);
  const inheritedBlockers = (input.blockers || []).filter(blocker =>
    blocker !== 'corroborating_repeatability_evidence_requires_semantic_disposition'
  );
  return {
    contract: policy.recordContract || 'sensum.activity-reference-collection-member-repeatability-gap-disposition.v1',
    ...preservedInput(input),
    sourceRepeatabilityGapEvidenceContentHash: input.contentHash,
    corroboratingRepeatabilityDisposition: {
      state: disposition.state,
      classification: disposition.classification,
      boundedEvidenceExhausted: disposition.boundedEvidenceExhausted,
      sourceRevisionKeys: disposition.sourceRevisionKeys,
      signalEvidenceKeys: disposition.signalEvidenceKeys,
      positiveDeclarationCandidateCount: disposition.positiveDeclarationCandidateCount,
      negativeDeclarationCandidateCount: disposition.negativeDeclarationCandidateCount,
      structuralSignalCandidateCount: disposition.structuralSignalCandidateCount,
      deficiencies: disposition.deficiencies
    },
    corroboratingRepeatabilityReview: {
      state: 'reviewed_blocked',
      classification: null,
      evidenceKeys: disposition.signalEvidenceKeys,
      sourceRevisionKeys: disposition.sourceRevisionKeys
    },
    repeatabilityGapNextEvidenceWork: {
      state: 'required',
      routeKey: disposition.routeKey,
      requiredEvidence: disposition.routeKey === 'revision_pinned_canonical_activity_scope_evidence_required'
        ? ['exact_canonical_activity_scope_for_explicit_declaration']
        : disposition.routeKey === 'repair_repeatability_gap_evidence_packet'
          ? ['complete_supported_revision_pinned_gap_evidence_packet']
          : ['explicit_revision_pinned_repeatability_declaration_or_authoritative_exclusion']
    },
    blockers: unique([
      ...inheritedBlockers,
      ...disposition.deficiencies,
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: disposition.routeKey === 'repair_repeatability_gap_evidence_packet'
      ? 'corroborating_repeatability_disposition_input_blocked'
      : 'corroborating_repeatability_disposition_reviewed_unresolved'
  };
}

export function buildActivityReferenceCollectionMemberRepeatabilityGapDispositions({ gapEvidenceRecords = [], policy = {} }) {
  const records = gapEvidenceRecords.map(input => expectedRecord(input, policy));
  return {
    records,
    audit: auditActivityReferenceCollectionMemberRepeatabilityGapDispositions(records, { gapEvidenceRecords, policy })
  };
}

export function auditActivityReferenceCollectionMemberRepeatabilityGapDispositions(records = [], { gapEvidenceRecords = [], policy = {} } = {}) {
  const compiled = compileRepeatabilityGapDispositionPolicy(policy);
  const expectedKeys = gapEvidenceRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(gapEvidenceRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || output.sourceRepeatabilityGapEvidenceContentHash !== input.contentHash
      || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const structurallyInvalidInputs = gapEvidenceRecords.filter(record =>
    record.contract !== policy.inputContract || !record.contentHash || record.accountIndependent !== true
    || record.corroboratingRepeatabilityEvidence?.evidenceState !== 'complete_revision_pinned_corroborating_repeatability_evidence_packet'
    || record.corroboratingRepeatabilityCandidateObservations?.repeatabilityVerdict !== null
    || candidateSignals(record).some(signal => !explicitKinds.has(signal.signalKind) && !structuralKinds.has(signal.signalKind))
    || record.repeatabilityDisposition?.classification !== null
    || record.repeatabilityReview?.classification !== null
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidDispositionRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedRecord(input, policy);
    return record.contract !== expected.contract
      || JSON.stringify(record.corroboratingRepeatabilityDisposition) !== JSON.stringify(expected.corroboratingRepeatabilityDisposition)
      || JSON.stringify(record.corroboratingRepeatabilityReview) !== JSON.stringify(expected.corroboratingRepeatabilityReview)
      || JSON.stringify(record.repeatabilityGapNextEvidenceWork) !== JSON.stringify(expected.repeatabilityGapNextEvidenceWork)
      || JSON.stringify(record.blockers) !== JSON.stringify(expected.blockers)
      || record.state !== expected.state;
  }).map(record => record.memberCandidateKey);
  const upstreamDispositionMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return input && (JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(input.repeatabilityDisposition)
      || JSON.stringify(record.repeatabilityReview) !== JSON.stringify(input.repeatabilityReview));
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return record.corroboratingRepeatabilityDisposition?.classification !== null
      || record.corroboratingRepeatabilityReview?.classification !== null
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false
      || (input && (JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
        || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
        || record.optimizerEligible !== input.optimizerEligible));
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_repeatability_gap_evidence_packets');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_repeatability_gap_disposition_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_repeatability_gap_evidence_packets_failed_structural_integrity');
  if (compiled.invalidRules.length) structuralBlockers.push('one_or_more_repeatability_gap_disposition_rules_missing_or_disabled');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_specific_repeatability_gap_disposition_policy_forbidden');
  if (invalidDispositionRecords.length) structuralBlockers.push('one_or_more_repeatability_gap_dispositions_not_reproducible_from_generic_rules');
  if (upstreamDispositionMutations.length) structuralBlockers.push('upstream_repeatability_disposition_or_review_mutated');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_repeatability_gap_dispositions');
  const states = records.map(record => record.corroboratingRepeatabilityDisposition?.state);
  const noDeclaration = states.filter(state => state === 'blocked_no_explicit_declaration_in_bounded_corroborating_sources').length;
  const structuralOnly = states.filter(state => state === 'blocked_structural_signal_without_explicit_repeatability_declaration').length;
  const unscopedExplicit = states.filter(state => state === 'blocked_explicit_declaration_candidate_without_canonical_activity_scope').length;
  const opposingUnscoped = states.filter(state => state === 'blocked_opposing_candidate_declarations_without_canonical_activity_scope').length;
  const incomplete = states.filter(state => state === 'unresolved_incomplete_or_unsupported_corroborating_evidence').length;
  const repeatabilityGapDispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const repeatabilityClassificationCoverageComplete = repeatabilityGapDispositionAttemptCoverageComplete
    && records.every(record => record.corroboratingRepeatabilityDisposition?.classification !== null);
  const blockers = [...structuralBlockers];
  if (!repeatabilityClassificationCoverageComplete) blockers.push('one_or_more_repeatability_classifications_remain_unresolved');
  blockers.push(
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-repeatability-gap-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedGapEvidencePacketCount: expectedKeys.length,
      repeatabilityGapDispositionRecordCount: records.length,
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
      noExplicitDeclarationCount: noDeclaration,
      structuralSignalOnlyCount: structuralOnly,
      unscopedExplicitDeclarationCount: unscopedExplicit,
      opposingUnscopedDeclarationCount: opposingUnscoped,
      incompleteOrUnsupportedEvidenceCount: incomplete,
      resolvedClassificationCount: records.filter(record => record.corroboratingRepeatabilityDisposition?.classification !== null).length,
      upstreamDispositionMutationMemberCandidateKeys: upstreamDispositionMutations,
      invalidDispositionMemberCandidateKeys: invalidDispositionRecords
    },
    semanticPromotionCoverage: {
      repeatabilityClassificationCount: 0,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    repeatabilityGapDispositionAttemptCoverageComplete,
    repeatabilityClassificationCoverageComplete,
    repeatabilityReviewComplete: repeatabilityClassificationCoverageComplete,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: repeatabilityGapDispositionAttemptCoverageComplete
  };
}
