import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceActivityCanonicalSubjectScopeDispositionContentHash',
  'canonicalActivityRepeatabilityEvidenceWorkRouting'
]);
const eligibleDispositionState = 'canonical_activity_scope_disposed_composite_assigned_tasks_repeatability_unresolved';
const supportedScopeDispositionState = 'source_supported_composite_assigned_task_activity_scope';
const supportedScopeReviewState = 'reviewed_source_supported_composite_assigned_task_activity_scope';
const expectedEvidenceDomains = [
  'parent_activity_post_completion_reassignment_or_restart',
  'member_task_reselection_and_repeatability',
  'cooldown_reset_daily_or_session_limits',
  'finite_exhaustion_one_time_or_completion_lockout',
  'availability_and_assignment_eligibility_across_sessions',
  'independent_source_corroboration_or_conflict'
];
const staleScopeBlockers = new Set([
  'canonical_activity_scope_unresolved',
  'canonical_activity_scope_review_incomplete',
  'canonical_activity_scope_evidence_requires_semantic_disposition'
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

export function compileScopedCanonicalActivityRepeatabilityEvidenceWorkRoutingPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneRoutePerSourceSupportedScopedCanonicalActivity',
    'everyEligibleScopedActivityMustBeRoutedExactlyOnce',
    'onlyReviewedSourceSupportedScopesAreEligible',
    'routeSelectionUsesOnlyTheAuditedScopeState',
    'routeDescribesEvidenceObligationsNotGameFacts',
    'parentAndMemberRepeatabilityRequireSeparateEvidence',
    'cooldownResetAndSessionLimitsRequireExplicitEvidence',
    'finiteExhaustionAndCompletionLockoutRequireExplicitEvidence',
    'futureAvailabilityAcrossSessionsRequiresExplicitEvidence',
    'pluralTasksDeclaredCountsAndNonExhaustiveListsDoNotProveRepeatability',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesScopeClassesAndOverridesCannotSelectOrAlterTheRoute',
    'inputEvidenceIdentityRevisionHashesBindingScopeDispositionAndContextMustBePreserved',
    'routingCannotAlterSubjectBindingsOrScopeVerdicts',
    'routingCannotClassifyParentOrMemberRepeatability',
    'routingCannotCompleteMemberExpansionOrMechanics',
    'routingCannotCreateOptimizerCandidates',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const route = policy.route || {};
  const invalidRoute = [];
  if (!route || typeof route !== 'object' || Array.isArray(route)) invalidRoute.push('route_not_object');
  if (!route.routeKey || typeof route.routeKey !== 'string') invalidRoute.push('route_key_missing');
  if (!String(route.routeState || '').startsWith('blocked_')) invalidRoute.push('repeatability_evidence_work_route_not_blocked');
  if (!Array.isArray(route.requiredEvidenceDomains)
    || JSON.stringify(route.requiredEvidenceDomains) !== JSON.stringify(expectedEvidenceDomains)) invalidRoute.push('required_evidence_domains_missing_changed_or_out_of_order');
  if (policy.eligibleInputState !== eligibleDispositionState) invalidRoute.push('eligible_input_state_mismatch');
  if (policy.eligibleScopeVerdict !== 'source_supported_composite_assigned_task_activity_scope') invalidRoute.push('eligible_scope_verdict_mismatch');
  return {
    policyId: policy.policy || null,
    inputContract: policy.inputContract || null,
    recordContract: policy.recordContract || null,
    auditContract: policy.auditContract || null,
    invalidRules,
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidRoute,
    route
  };
}

function scopeDispositionCoherent(record, policy) {
  const disposition = record.canonicalActivityScopeDisposition || {};
  const review = record.canonicalActivityScopeReview || {};
  const binding = record.canonicalActivitySubjectBinding || {};
  const evidence = record.canonicalActivityScopeEvidence || {};
  const evidenceSources = record.canonicalActivityScopeEvidenceSources || [];
  return record.contract === policy.inputContract
    && record.state === policy.eligibleInputState
    && Boolean(record.contentHash)
    && record.accountIndependent === true
    && Boolean(record.memberCandidateKey)
    && Boolean(record.canonicalActivityIdentity?.canonicalActivityKey)
    && binding.canonicalActivityKey === record.canonicalActivityIdentity.canonicalActivityKey
    && binding.accountIndependent === true
    && disposition.state === supportedScopeDispositionState
    && disposition.canonicalActivityScopeVerdict === policy.eligibleScopeVerdict
    && disposition.scopeClass === 'composite_assigned_task_activity'
    && disposition.memberUniverseState === 'declared_total_with_non_exhaustive_member_inventory'
    && disposition.assignmentConditionState === 'account_level_and_self_creation_skill_conditioned'
    && Number.isInteger(disposition.declaredTaskCount)
    && disposition.declaredTaskCount > 0
    && disposition.memberInventoryComplete === false
    && disposition.repeatabilityVerdict === null
    && Array.isArray(disposition.evidenceSignals)
    && disposition.evidenceSignals.length > 0
    && Array.isArray(disposition.evidenceKeys)
    && disposition.evidenceKeys.length === disposition.evidenceSignals.length
    && review.state === supportedScopeReviewState
    && review.canonicalActivityScopeVerdict === disposition.canonicalActivityScopeVerdict
    && review.scopeClass === disposition.scopeClass
    && review.declaredTaskCount === disposition.declaredTaskCount
    && review.memberUniverseState === disposition.memberUniverseState
    && review.assignmentConditionState === disposition.assignmentConditionState
    && review.repeatabilityVerdict === null
    && evidence.canonicalActivityScopeVerdict === null
    && evidence.repeatabilityVerdict === null
    && Array.isArray(evidenceSources)
    && evidenceSources.length > 0
    && evidenceSources.every(source => source.canonicalActivityScopeVerdict === null && source.repeatabilityVerdict === null)
    && record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && (record.blockers || []).includes('source_declares_member_inventory_may_not_be_exhaustive')
    && !(record.blockers || []).some(blocker => staleScopeBlockers.has(blocker));
}

function routingDecision(policy) {
  return {
    policyRuleKind: 'audited_source_supported_scoped_canonical_activity_state',
    sourceState: policy.eligibleInputState,
    sourceScopeVerdict: policy.eligibleScopeVerdict,
    routeKey: policy.route?.routeKey || null,
    routeState: policy.route?.routeState || 'blocked_invalid_repeatability_evidence_work_policy',
    requiredEvidenceDomains: policy.route?.requiredEvidenceDomains || [],
    parentAndMemberRepeatabilitySeparated: true
  };
}

function expectedRecord(input, policy) {
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceActivityCanonicalSubjectScopeDispositionContentHash: input.contentHash,
    canonicalActivityRepeatabilityEvidenceWorkRouting: routingDecision(policy),
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []),
      'routed_scoped_canonical_activity_repeatability_evidence_work_not_completed',
      'parent_activity_repeatability_unresolved',
      'member_task_repeatability_unresolved',
      'cooldown_reset_daily_or_session_limits_unresolved',
      'finite_exhaustion_one_time_or_completion_lockout_unresolved',
      'future_availability_across_sessions_unresolved',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'scoped_canonical_activity_repeatability_evidence_work_routed_gates_closed'
  };
}

export function buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords = [], policy = {} }) {
  const eligibleInputs = scopeDispositionRecords.filter(record => record.state === policy.eligibleInputState);
  const records = eligibleInputs.map(input => expectedRecord(input, policy));
  return { records, audit: auditScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes(records, { scopeDispositionRecords, policy }) };
}

function forbiddenRoutingDecisionPaths(records = []) {
  const findings = [];
  const visit = (value, path, memberCandidateKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, memberCandidateKey));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|revision|resolvedTitle|title|activityName|canonicalLabel|candidateKey|memberCandidateKey|scopeClass|membershipClassification|alias|repeatabilityVerdict)$/i.test(name)) findings.push({ memberCandidateKey, path: childPath });
      visit(child, childPath, memberCandidateKey);
    }
  };
  records.forEach(record => visit(record.canonicalActivityRepeatabilityEvidenceWorkRouting, 'canonicalActivityRepeatabilityEvidenceWorkRouting', record.memberCandidateKey));
  return findings;
}

export function auditScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes(records = [], { scopeDispositionRecords = [], policy = {} } = {}) {
  const compiled = compileScopedCanonicalActivityRepeatabilityEvidenceWorkRoutingPolicy(policy);
  const eligibleInputs = scopeDispositionRecords.filter(record => record.state === policy.eligibleInputState);
  const ineligibleInputs = scopeDispositionRecords.filter(record => record.state !== policy.eligibleInputState);
  const expected = eligibleInputs.map(input => expectedRecord(input, policy));
  const expectedKeys = eligibleInputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const inputByKey = new Map(eligibleInputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const duplicateInputKeys = duplicates(scopeDispositionRecords.map(record => record.memberCandidateKey));
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const invalidInputKeys = eligibleInputs.filter(record => !scopeDispositionCoherent(record, policy)).map(record => record.memberCandidateKey);
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.sourceActivityCanonicalSubjectScopeDispositionContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const routeMismatches = records.filter(record => {
    const expectedRecordValue = expectedByKey.get(record.memberCandidateKey);
    return !expectedRecordValue
      || JSON.stringify(record.canonicalActivityRepeatabilityEvidenceWorkRouting)
        !== JSON.stringify(expectedRecordValue.canonicalActivityRepeatabilityEvidenceWorkRouting);
  }).map(record => record.memberCandidateKey);
  const nonBlockedRoutes = records.filter(record => !record.canonicalActivityRepeatabilityEvidenceWorkRouting?.routeState?.startsWith('blocked_')).map(record => record.memberCandidateKey);
  const invalidRuleKinds = records.filter(record => record.canonicalActivityRepeatabilityEvidenceWorkRouting?.policyRuleKind !== 'audited_source_supported_scoped_canonical_activity_state').map(record => record.memberCandidateKey);
  const routingDecisionIdentityFindings = forbiddenRoutingDecisionPaths(records);
  const scopeMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.canonicalActivityIdentity) !== JSON.stringify(input.canonicalActivityIdentity)
      || JSON.stringify(record.canonicalActivitySubjectBinding) !== JSON.stringify(input.canonicalActivitySubjectBinding)
      || JSON.stringify(record.canonicalActivityScopeEvidence) !== JSON.stringify(input.canonicalActivityScopeEvidence)
      || JSON.stringify(record.canonicalActivityScopeEvidenceSources) !== JSON.stringify(input.canonicalActivityScopeEvidenceSources)
      || JSON.stringify(record.canonicalActivityScopeDisposition) !== JSON.stringify(input.canonicalActivityScopeDisposition)
      || JSON.stringify(record.canonicalActivityScopeReview) !== JSON.stringify(input.canonicalActivityScopeReview);
  }).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.canonicalActivityScopeDisposition?.repeatabilityVerdict !== null
      || record.canonicalActivityScopeReview?.repeatabilityVerdict !== null
      || record.canonicalActivityScopeEvidence?.repeatabilityVerdict !== null
      || record.canonicalActivityScopeEvidenceSources?.some(source => source.repeatabilityVerdict !== null)
      || record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!scopeDispositionRecords.length) structuralBlockers.push('no_canonical_activity_scope_disposition_records');
  if (!eligibleInputs.length) structuralBlockers.push('no_source_supported_scoped_canonical_activities');
  if (ineligibleInputs.length) structuralBlockers.push('one_or_more_input_records_lack_a_source_supported_reviewed_scope');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('eligible_input_and_output_member_candidate_sets_do_not_match_exactly');
  if (invalidInputKeys.length) structuralBlockers.push('one_or_more_scoped_activity_inputs_are_incoherent_or_retain_resolved_scope_blockers');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_upstream_evidence_identity_revision_hash_binding_scope_disposition_or_context_values_changed');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidRoute.length) structuralBlockers.push('repeatability_evidence_work_routing_policy_invalid_or_activity_specific');
  if (routeMismatches.length || nonBlockedRoutes.length || invalidRuleKinds.length) structuralBlockers.push('one_or_more_repeatability_evidence_work_routes_do_not_match_policy');
  if (routingDecisionIdentityFindings.length) structuralBlockers.push('repeatability_evidence_work_route_contains_activity_specific_identity_or_a_repeatability_verdict');
  if (scopeMutations.length) structuralBlockers.push('routing_changed_scope_identity_evidence_binding_disposition_or_review');
  if (downstreamPromotions.length) structuralBlockers.push('unsupported_parent_member_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_scoped_activity_repeatability_evidence_work_routes');
  const routingCoverageComplete = records.length > 0 && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputScopeDispositionRecordCount: scopeDispositionRecords.length,
      eligibleScopedActivityRecordCount: eligibleInputs.length,
      routingRecordCount: records.length,
      ineligibleMemberCandidateKeys: ineligibleInputs.map(record => record.memberCandidateKey),
      invalidEligibleInputMemberCandidateKeys: invalidInputKeys,
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
      requiredEvidenceDomainCount: compiled.route.requiredEvidenceDomains?.length || 0,
      requiredEvidenceDomains: compiled.route.requiredEvidenceDomains || [],
      invalidPolicyRuleKindMemberCandidateKeys: invalidRuleKinds,
      routingDecisionIdentityOrVerdictFindings: routingDecisionIdentityFindings
    },
    routingCoverage: {
      routedCount: records.filter(record => record.canonicalActivityRepeatabilityEvidenceWorkRouting?.routeKey).length,
      blockedRouteCount: records.filter(record => record.canonicalActivityRepeatabilityEvidenceWorkRouting?.routeState?.startsWith('blocked_')).length,
      parentAndMemberRepeatabilitySeparatedCount: records.filter(record => record.canonicalActivityRepeatabilityEvidenceWorkRouting?.parentAndMemberRepeatabilitySeparated === true).length,
      nonBlockedMemberCandidateKeys: nonBlockedRoutes,
      routeMismatchMemberCandidateKeys: routeMismatches,
      route: compiled.route
    },
    semanticPreservationCoverage: {
      scopeIdentityEvidenceBindingDispositionOrReviewMutationMemberCandidateKeys: scopeMutations,
      preservedCanonicalActivityScopeClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === policy.eligibleScopeVerdict).length,
      repeatabilityClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.repeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedDownstreamPromotionMemberCandidateKeys: downstreamPromotions
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
      'routed_scoped_canonical_activity_repeatability_evidence_work_not_completed',
      'parent_activity_repeatability_unresolved',
      'member_task_repeatability_unresolved',
      'cooldown_reset_daily_or_session_limits_unresolved',
      'finite_exhaustion_one_time_or_completion_lockout_unresolved',
      'future_availability_across_sessions_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: routingCoverageComplete
  };
}
