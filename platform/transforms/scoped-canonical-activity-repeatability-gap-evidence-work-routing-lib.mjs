import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const expectedDomains = [
  'parent_activity_post_completion_reassignment_or_restart',
  'member_task_reselection_and_repeatability',
  'cooldown_reset_daily_or_session_limits',
  'finite_exhaustion_one_time_or_completion_lockout',
  'availability_and_assignment_eligibility_across_sessions',
  'independent_source_corroboration_or_conflict'
];
const expectedInputState = 'scoped_canonical_activity_repeatability_disposition_reviewed_unresolved';
const expectedDispositionState = 'blocked_parent_and_member_repeatability_not_proven';
const expectedRouteKey = 'collect_revision_pinned_independent_scoped_activity_repeatability_evidence';
const expectedRouteState = 'blocked_independent_scoped_activity_repeatability_evidence_gap';
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceScopedCanonicalActivityRepeatabilityEvidenceDispositionContentHash',
  'canonicalActivityRepeatabilityGapEvidenceWorkRouting',
  'canonicalActivityRepeatabilityGapEvidenceWorkReview'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|scopeClass|scopeClasses|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutingPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneWorkOrderPerEligibleDisposition',
    'everyUnresolvedDomainReceivesExactlyOneWorkItem',
    'routeSelectionUsesOnlyTheAuditedDispositionStateAndRequiredSourceRoute',
    'workItemsDescribeEvidenceObligationsNotGameFacts',
    'independentEvidenceMustRetainExactRevisionIdentityAndSubjectPredicateScope',
    'parentAndMemberRepeatabilityRemainSeparate',
    'structuralEligibilityCitationAndSilenceSubstitutionsAreForbidden',
    'allRoutesAndWorkItemsRemainBlockedUntilEvidenceIsCollectedAndReviewed',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesScopeClassesAndOverridesCannotSelectOrAlterTheRoute',
    'inputEvidenceIdentityRevisionHashesScopeDispositionAndContextMustBePreserved',
    'routingCannotAlterScopeOrRepeatabilityDispositionOrReview',
    'routingCannotCreateRepeatabilityVerdicts',
    'routingCannotCompleteMemberExpansionOrMechanics',
    'routingCannotCreateOptimizerCandidates',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const route = policy.route || {};
  const definitions = policy.domainWorkDefinitions || [];
  const definitionDomains = definitions.map(definition => definition.domainKey);
  const invalidRoute = [];
  if (policy.eligibleInputState !== expectedInputState) invalidRoute.push('eligible_input_state_mismatch');
  if (policy.eligibleDispositionState !== expectedDispositionState) invalidRoute.push('eligible_disposition_state_mismatch');
  if (policy.requiredSourceRoute?.routeKey !== expectedRouteKey || policy.requiredSourceRoute?.routeState !== expectedRouteState) invalidRoute.push('required_source_route_mismatch');
  if (route.routeKey !== expectedRouteKey || route.routeState !== expectedRouteState) invalidRoute.push('route_identity_or_state_mismatch');
  if (!String(route.domainWorkState || '').startsWith('blocked_')) invalidRoute.push('domain_work_state_not_blocked');
  if (JSON.stringify(route.requiredEvidenceDomains) !== JSON.stringify(expectedDomains)) invalidRoute.push('required_domains_missing_changed_or_out_of_order');
  if (duplicates(definitionDomains).length || JSON.stringify(definitionDomains) !== JSON.stringify(expectedDomains)) invalidRoute.push('domain_work_definitions_missing_duplicated_or_out_of_order');
  if (definitions.some(definition => !definition.evidenceObjective || !Array.isArray(definition.requiredChannels) || !definition.requiredChannels.length)) invalidRoute.push('domain_work_definition_incomplete');
  if (!Array.isArray(policy.forbiddenSubstitutions) || !policy.forbiddenSubstitutions.length) invalidRoute.push('forbidden_substitutions_missing');
  return {
    policyId: policy.policy || null,
    inputContract: policy.inputContract || null,
    recordContract: policy.recordContract || null,
    auditContract: policy.auditContract || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidRoute: unique(invalidRoute),
    route,
    definitions,
    forbiddenSubstitutions: policy.forbiddenSubstitutions || []
  };
}

function inputCoherent(record, policy) {
  const disposition = record.canonicalActivityRepeatabilityDisposition || {};
  const review = record.canonicalActivityRepeatabilityReview || {};
  const next = record.canonicalActivityRepeatabilityNextEvidenceWork || {};
  const assessments = disposition.evidenceDomainAssessments || [];
  return record.contract === policy.inputContract
    && record.state === policy.eligibleInputState
    && Boolean(record.contentHash)
    && Boolean(record.memberCandidateKey)
    && Boolean(record.canonicalActivityIdentity?.canonicalActivityKey)
    && record.accountIndependent === true
    && record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === 'source_supported_composite_assigned_task_activity_scope'
    && record.canonicalActivityScopeReview?.repeatabilityVerdict === null
    && disposition.state === policy.eligibleDispositionState
    && disposition.classification === null
    && disposition.parentActivityRepeatabilityVerdict === null
    && disposition.memberTaskRepeatabilityVerdict === null
    && disposition.repeatabilityVerdict === null
    && JSON.stringify(assessments.map(item => item.domainKey)) === JSON.stringify(expectedDomains)
    && assessments.every(item => item.resolved === false && item.parentActivityRepeatabilityVerdict === null && item.memberTaskRepeatabilityVerdict === null)
    && JSON.stringify(disposition.unresolvedEvidenceDomains) === JSON.stringify(expectedDomains)
    && review.state === 'reviewed_blocked_insufficient_parent_and_member_repeatability_evidence'
    && review.classification === null
    && review.parentActivityRepeatabilityVerdict === null
    && review.memberTaskRepeatabilityVerdict === null
    && review.repeatabilityVerdict === null
    && next.state === 'required'
    && next.routeKey === policy.requiredSourceRoute?.routeKey
    && next.routeState === policy.requiredSourceRoute?.routeState
    && JSON.stringify(next.requiredEvidenceDomains) === JSON.stringify(expectedDomains)
    && next.mustPreserveParentMemberSeparation === true
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && (record.blockers || []).includes('repeatability_classification_unresolved')
    && (record.blockers || []).includes('independent_scoped_activity_repeatability_evidence_work_not_completed');
}

function routingDecision(policy) {
  const compiled = compileScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutingPolicy(policy);
  return {
    policyRuleKind: 'audited_unresolved_repeatability_disposition_and_required_source_route',
    sourceState: policy.eligibleInputState,
    sourceDispositionState: policy.eligibleDispositionState,
    routeKey: compiled.route.routeKey || null,
    routeState: compiled.route.routeState || 'blocked_invalid_repeatability_gap_evidence_work_policy',
    requiredEvidenceDomains: compiled.route.requiredEvidenceDomains || [],
    forbiddenSubstitutions: compiled.forbiddenSubstitutions,
    domainEvidenceWorkItems: compiled.definitions.map((definition, index) => ({
      workItemOrdinal: index + 1,
      domainKey: definition.domainKey,
      evidenceObjective: definition.evidenceObjective,
      requiredChannels: definition.requiredChannels,
      workState: compiled.route.domainWorkState,
      evidenceWorkComplete: false,
      evidenceKeys: []
    })),
    parentAndMemberRepeatabilitySeparated: true,
    evidenceWorkComplete: false
  };
}

function expectedRecord(input, policy) {
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceScopedCanonicalActivityRepeatabilityEvidenceDispositionContentHash: input.contentHash,
    canonicalActivityRepeatabilityGapEvidenceWorkRouting: routingDecision(policy),
    canonicalActivityRepeatabilityGapEvidenceWorkReview: {
      state: 'routed_blocked_pending_revision_pinned_independent_evidence',
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceWorkComplete: false
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []),
      'independent_scoped_activity_repeatability_gap_evidence_work_routed_not_completed',
      'parent_activity_repeatability_unresolved',
      'member_task_repeatability_unresolved',
      'cooldown_reset_daily_or_session_limits_unresolved',
      'finite_exhaustion_one_time_or_completion_lockout_unresolved',
      'future_availability_across_sessions_unresolved',
      'independent_repeatability_corroboration_or_conflict_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'scoped_canonical_activity_repeatability_gap_evidence_work_routed_gates_closed'
  };
}

export function buildScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes({ dispositionRecords = [], policy = {} }) {
  const eligibleInputs = dispositionRecords.filter(record => record.state === policy.eligibleInputState);
  const records = eligibleInputs.map(input => expectedRecord(input, policy));
  return { records, audit: auditScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes(records, { dispositionRecords, policy }) };
}

export function auditScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutes(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const compiled = compileScopedCanonicalActivityRepeatabilityGapEvidenceWorkRoutingPolicy(policy);
  const eligibleInputs = dispositionRecords.filter(record => record.state === policy.eligibleInputState);
  const ineligibleInputs = dispositionRecords.filter(record => record.state !== policy.eligibleInputState);
  const expected = eligibleInputs.map(input => expectedRecord(input, policy));
  const expectedKeys = eligibleInputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const inputByKey = new Map(eligibleInputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const duplicateInputKeys = duplicates(dispositionRecords.map(record => record.memberCandidateKey));
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const invalidInputKeys = eligibleInputs.filter(record => !inputCoherent(record, policy)).map(record => record.memberCandidateKey);
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.sourceScopedCanonicalActivityRepeatabilityEvidenceDispositionContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const routeMismatches = records.filter(record => {
    const wanted = expectedByKey.get(record.memberCandidateKey);
    return !wanted
      || JSON.stringify(record.canonicalActivityRepeatabilityGapEvidenceWorkRouting) !== JSON.stringify(wanted.canonicalActivityRepeatabilityGapEvidenceWorkRouting)
      || JSON.stringify(record.canonicalActivityRepeatabilityGapEvidenceWorkReview) !== JSON.stringify(wanted.canonicalActivityRepeatabilityGapEvidenceWorkReview);
  }).map(record => record.memberCandidateKey);
  const workItems = records.flatMap(record => record.canonicalActivityRepeatabilityGapEvidenceWorkRouting?.domainEvidenceWorkItems || []);
  const invalidWorkItemRecords = records.filter(record => {
    const items = record.canonicalActivityRepeatabilityGapEvidenceWorkRouting?.domainEvidenceWorkItems || [];
    return JSON.stringify(items.map(item => item.domainKey)) !== JSON.stringify(expectedDomains)
      || items.some((item, index) => item.workItemOrdinal !== index + 1 || !String(item.workState || '').startsWith('blocked_') || item.evidenceWorkComplete !== false || item.evidenceKeys?.length);
  }).map(record => record.memberCandidateKey);
  const nonBlockedRoutes = records.filter(record => !record.canonicalActivityRepeatabilityGapEvidenceWorkRouting?.routeState?.startsWith('blocked_')).map(record => record.memberCandidateKey);
  const upstreamMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.canonicalActivityScopeDisposition) !== JSON.stringify(input.canonicalActivityScopeDisposition)
      || JSON.stringify(record.canonicalActivityScopeReview) !== JSON.stringify(input.canonicalActivityScopeReview)
      || JSON.stringify(record.canonicalActivityRepeatabilityDisposition) !== JSON.stringify(input.canonicalActivityRepeatabilityDisposition)
      || JSON.stringify(record.canonicalActivityRepeatabilityReview) !== JSON.stringify(input.canonicalActivityRepeatabilityReview)
      || JSON.stringify(record.canonicalActivityRepeatabilityNextEvidenceWork) !== JSON.stringify(input.canonicalActivityRepeatabilityNextEvidenceWork);
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const routing = record.canonicalActivityRepeatabilityGapEvidenceWorkRouting || {};
    const review = record.canonicalActivityRepeatabilityGapEvidenceWorkReview || {};
    const recordWorkItems = routing.domainEvidenceWorkItems || [];
    return !input
      || record.canonicalActivityRepeatabilityDisposition?.classification !== null
      || record.canonicalActivityRepeatabilityDisposition?.parentActivityRepeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityDisposition?.memberTaskRepeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityDisposition?.repeatabilityVerdict !== null
      || review.parentActivityRepeatabilityVerdict !== null
      || review.memberTaskRepeatabilityVerdict !== null
      || review.repeatabilityVerdict !== null
      || review.evidenceWorkComplete !== false
      || routing.evidenceWorkComplete !== false
      || recordWorkItems.some(item => item.evidenceWorkComplete !== false)
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!dispositionRecords.length) structuralBlockers.push('no_scoped_repeatability_disposition_records');
  if (!eligibleInputs.length) structuralBlockers.push('no_eligible_unresolved_scoped_repeatability_dispositions');
  if (ineligibleInputs.length) structuralBlockers.push('one_or_more_repeatability_dispositions_are_ineligible');
  if (invalidInputKeys.length) structuralBlockers.push('one_or_more_repeatability_disposition_inputs_are_incoherent');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_repeatability_gap_route_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('routing_changed_upstream_evidence_identity_revision_hash_scope_or_context');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidRoute.length) structuralBlockers.push('repeatability_gap_evidence_work_routing_policy_invalid_or_activity_specific');
  if (routeMismatches.length || invalidWorkItemRecords.length || nonBlockedRoutes.length) structuralBlockers.push('one_or_more_repeatability_gap_routes_or_work_items_do_not_match_policy');
  if (upstreamMutations.length) structuralBlockers.push('routing_changed_upstream_scope_or_repeatability_disposition');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_repeatability_evidence_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_repeatability_gap_evidence_work_routes');
  const routingCoverageComplete = records.length > 0 && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputDispositionRecordCount: dispositionRecords.length,
      eligibleDispositionRecordCount: eligibleInputs.length,
      routingRecordCount: records.length,
      ineligibleMemberCandidateKeys: ineligibleInputs.map(record => record.memberCandidateKey),
      invalidInputMemberCandidateKeys: invalidInputKeys,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      exactEligibleInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      invalidRoute: compiled.invalidRoute,
      domainWorkDefinitionCount: compiled.definitions.length
    },
    routingCoverage: {
      routedCount: records.length,
      blockedRouteCount: records.filter(record => record.canonicalActivityRepeatabilityGapEvidenceWorkRouting?.routeState?.startsWith('blocked_')).length,
      requiredDomainWorkItemCount: expectedDomains.length * records.length,
      domainWorkItemCount: workItems.length,
      blockedDomainWorkItemCount: workItems.filter(item => item.workState?.startsWith('blocked_')).length,
      completedDomainWorkItemCount: workItems.filter(item => item.evidenceWorkComplete === true).length,
      routeMismatchMemberCandidateKeys: routeMismatches,
      invalidDomainWorkItemMemberCandidateKeys: invalidWorkItemRecords,
      nonBlockedRouteMemberCandidateKeys: nonBlockedRoutes
    },
    semanticPreservationCoverage: {
      upstreamMutationMemberCandidateKeys: upstreamMutations,
      preservedCanonicalActivityScopeClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === 'source_supported_composite_assigned_task_activity_scope').length,
      parentActivityRepeatabilityClassificationCount: records.filter(record => record.canonicalActivityRepeatabilityReview?.parentActivityRepeatabilityVerdict !== null).length,
      memberTaskRepeatabilityClassificationCount: records.filter(record => record.canonicalActivityRepeatabilityReview?.memberTaskRepeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    routingCoverageComplete,
    evidenceWorkComplete: false,
    canonicalActivityScopeReviewComplete: routingCoverageComplete,
    repeatabilityReviewComplete: false,
    memberExpansionComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'independent_scoped_activity_repeatability_gap_evidence_work_routed_not_completed',
      'parent_activity_repeatability_unresolved',
      'member_task_repeatability_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: routingCoverageComplete
  };
}
