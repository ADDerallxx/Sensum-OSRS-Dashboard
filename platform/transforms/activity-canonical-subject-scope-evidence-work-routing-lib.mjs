import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceActivityInfoboxSchemaSemanticsDispositionContentHash',
  'routingDecision'
]);
const eligibleDispositionState = 'canonical_activity_subject_declaration_source_supported_scope_and_repeatability_unresolved';
const supportedSubjectDispositionState = 'source_supported_canonical_activity_subject_binding';
const supportedSubjectReviewState = 'reviewed_source_supported_canonical_activity_subject_binding';
const supportedSchemaReviewState = 'reviewed_schema_semantics_support_exact_structural_subject_binding';
const resolvedSubjectBlockers = new Set([
  'activity_infobox_schema_evidence_requires_semantic_disposition',
  'schema_evidence_does_not_independently_bind_canonical_activity_subject',
  'activity_infobox_name_schema_semantics_not_revision_pinned',
  'source_subject_disposition_still_unresolved',
  'no_stable_canonical_activity_subject_anchor_observed',
  'canonical_activity_subject_binding_unresolved'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileActivityCanonicalSubjectScopeEvidenceWorkRoutingPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneRoutePerSourceSupportedCanonicalActivitySubjectBinding',
    'everyEligibleBindingMustBeRoutedExactlyOnce',
    'onlySourceSupportedCanonicalActivitySubjectBindingsAreEligible',
    'routeSelectionUsesOnlyTheAuditedSubjectBindingState',
    'routeDescribesEvidenceObligationsNotGameFacts',
    'activityOrMinigamePageTypeDoesNotEstablishActivityScope',
    'subjectBindingDoesNotEstablishTrainingScopeRepeatabilityOrMembership',
    'scopeAndRepeatabilityRemainSeparateEvidenceGates',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesCollectionClassesAndOverridesCannotSelectOrAlterTheRoute',
    'inputEvidenceIdentityRevisionHashesBindingDispositionAndContextMustBePreserved',
    'routingCannotAlterSubjectBindingsOrSubjectDeclarationVerdicts',
    'routingCannotClassifyActivityScopeOrRepeatability',
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
  if (!String(route.routeState || '').startsWith('blocked_')) invalidRoute.push('scope_evidence_work_route_not_blocked');
  if (!Array.isArray(route.requiredEvidenceDomains) || !route.requiredEvidenceDomains.length) invalidRoute.push('required_evidence_domains_missing');
  if (Array.isArray(route.requiredEvidenceDomains) && unique(route.requiredEvidenceDomains).length !== route.requiredEvidenceDomains.length) invalidRoute.push('required_evidence_domains_not_unique');
  if (policy.eligibleInputState !== eligibleDispositionState) invalidRoute.push('eligible_input_state_mismatch');
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

function subjectBindingCoherent(record, policy) {
  const disposition = record.canonicalActivitySubjectDeclarationDisposition || {};
  const binding = record.canonicalActivitySubjectBinding;
  const review = record.canonicalActivitySubjectDeclarationReview || {};
  const schemaReview = record.activityInfoboxSchemaSemanticsReview || {};
  const sourceIdentity = binding?.sourcePageIdentity || {};
  const revisionBoundary = binding?.evidenceRevisionBoundary || {};
  const schemaSources = revisionBoundary.schemaSources || [];
  return record.contract === policy.inputContract
    && record.state === policy.eligibleInputState
    && Boolean(record.contentHash)
    && record.accountIndependent === true
    && disposition.state === supportedSubjectDispositionState
    && disposition.verdict === binding?.verdict
    && disposition.bindingClass === binding?.bindingClass
    && disposition.canonicalActivityScopeVerdict === null
    && disposition.repeatabilityVerdict === null
    && binding?.accountIndependent === true
    && Boolean(binding?.canonicalActivityKey)
    && binding.canonicalActivityKey === record.canonicalActivityIdentity?.canonicalActivityKey
    && Boolean(binding?.structuralEvidenceKey)
    && Array.isArray(binding?.schemaEvidenceKeys)
    && binding.schemaEvidenceKeys.length > 0
    && Boolean(sourceIdentity.sourcePageId)
    && Boolean(sourceIdentity.resolvedTitle)
    && Boolean(sourceIdentity.sourceRevision)
    && Boolean(sourceIdentity.sourceContentHash)
    && revisionBoundary.subjectSourceRevision === sourceIdentity.sourceRevision
    && Array.isArray(schemaSources)
    && schemaSources.length > 0
    && schemaSources.every(source => source.sourcePageId && source.sourceRevision && source.sourceContentHash)
    && review.state === supportedSubjectReviewState
    && review.canonicalActivitySubjectDeclarationVerdict === binding.verdict
    && review.canonicalActivityScopeVerdict === null
    && review.repeatabilityVerdict === null
    && schemaReview.state === supportedSchemaReviewState
    && schemaReview.canonicalActivitySubjectDeclarationVerdict === binding.verdict
    && schemaReview.canonicalActivityScopeVerdict === null
    && schemaReview.repeatabilityVerdict === null
    && JSON.stringify(schemaReview.canonicalActivitySubjectBinding) === JSON.stringify(binding)
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && !(record.blockers || []).some(blocker => resolvedSubjectBlockers.has(blocker));
}

function routingDecision(policy) {
  return {
    policyRuleKind: 'audited_source_supported_canonical_activity_subject_binding_state',
    sourceState: policy.eligibleInputState,
    routeKey: policy.route?.routeKey || null,
    routeState: policy.route?.routeState || 'blocked_invalid_scope_evidence_work_policy',
    requiredEvidenceDomains: policy.route?.requiredEvidenceDomains || []
  };
}

function expectedRecord(input, policy) {
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceActivityInfoboxSchemaSemanticsDispositionContentHash: input.contentHash,
    routingDecision: routingDecision(policy),
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []),
      'routed_canonical_activity_scope_evidence_work_not_completed',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'bound_canonical_activity_subject_scope_evidence_work_routed_gates_closed'
  };
}

export function buildActivityCanonicalSubjectScopeEvidenceWorkRoutes({ dispositionRecords = [], policy = {} }) {
  const eligibleInputs = dispositionRecords.filter(record => record.state === policy.eligibleInputState);
  const records = eligibleInputs.map(input => expectedRecord(input, policy));
  return { records, audit: auditActivityCanonicalSubjectScopeEvidenceWorkRoutes(records, { dispositionRecords, policy }) };
}

function forbiddenRoutingDecisionPaths(records = []) {
  const findings = [];
  const visit = (value, path, memberCandidateKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, memberCandidateKey));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|revision|resolvedTitle|title|activityName|canonicalLabel|candidateKey|memberCandidateKey|collectionClass|membershipClassification|alias)$/i.test(name)) findings.push({ memberCandidateKey, path: childPath });
      visit(child, childPath, memberCandidateKey);
    }
  };
  records.forEach(record => visit(record.routingDecision, 'routingDecision', record.memberCandidateKey));
  return findings;
}

export function auditActivityCanonicalSubjectScopeEvidenceWorkRoutes(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const compiled = compileActivityCanonicalSubjectScopeEvidenceWorkRoutingPolicy(policy);
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
  const invalidInputKeys = eligibleInputs.filter(record => !subjectBindingCoherent(record, policy)).map(record => record.memberCandidateKey);
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.sourceActivityInfoboxSchemaSemanticsDispositionContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const routeMismatches = records.filter(record => {
    const expectedRecordValue = expectedByKey.get(record.memberCandidateKey);
    return !expectedRecordValue || JSON.stringify(record.routingDecision) !== JSON.stringify(expectedRecordValue.routingDecision);
  }).map(record => record.memberCandidateKey);
  const nonBlockedRoutes = records.filter(record => !record.routingDecision?.routeState?.startsWith('blocked_')).map(record => record.memberCandidateKey);
  const invalidRuleKinds = records.filter(record => record.routingDecision?.policyRuleKind !== 'audited_source_supported_canonical_activity_subject_binding_state').map(record => record.memberCandidateKey);
  const routingDecisionIdentityFindings = forbiddenRoutingDecisionPaths(records);
  const subjectMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.canonicalActivityIdentity) !== JSON.stringify(input.canonicalActivityIdentity)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationDisposition) !== JSON.stringify(input.canonicalActivitySubjectDeclarationDisposition)
      || JSON.stringify(record.canonicalActivitySubjectBinding) !== JSON.stringify(input.canonicalActivitySubjectBinding)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationReview) !== JSON.stringify(input.canonicalActivitySubjectDeclarationReview)
      || JSON.stringify(record.activityInfoboxSchemaSemanticsReview) !== JSON.stringify(input.activityInfoboxSchemaSemanticsReview);
  }).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.canonicalActivitySubjectDeclarationDisposition?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationDisposition?.repeatabilityVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null
      || record.activityInfoboxSchemaSemanticsReview?.canonicalActivityScopeVerdict !== null
      || record.activityInfoboxSchemaSemanticsReview?.repeatabilityVerdict !== null
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!dispositionRecords.length) structuralBlockers.push('no_activity_infobox_schema_semantics_disposition_records');
  if (!eligibleInputs.length) structuralBlockers.push('no_source_supported_canonical_activity_subject_bindings');
  if (ineligibleInputs.length) structuralBlockers.push('one_or_more_input_records_lack_a_source_supported_canonical_activity_subject_binding');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('eligible_input_and_output_member_candidate_sets_do_not_match_exactly');
  if (invalidInputKeys.length) structuralBlockers.push('one_or_more_subject_binding_inputs_are_incoherent_or_retain_resolved_blockers');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_upstream_evidence_identity_revision_hash_binding_disposition_or_context_values_changed');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidRoute.length) structuralBlockers.push('canonical_activity_scope_evidence_work_routing_policy_invalid_or_activity_specific');
  if (routeMismatches.length || nonBlockedRoutes.length || invalidRuleKinds.length) structuralBlockers.push('one_or_more_scope_evidence_work_routes_do_not_match_policy');
  if (routingDecisionIdentityFindings.length) structuralBlockers.push('identity_or_collection_context_used_to_select_or_alter_scope_evidence_route');
  if (subjectMutations.length) structuralBlockers.push('routing_changed_subject_binding_identity_disposition_or_review');
  if (downstreamPromotions.length) structuralBlockers.push('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_canonical_activity_scope_evidence_work_routes');
  const routingCoverageComplete = eligibleInputs.length > 0 && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      inputDispositionRecordCount: dispositionRecords.length,
      eligibleBindingRecordCount: eligibleInputs.length,
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
      invalidPolicyRuleKindMemberCandidateKeys: invalidRuleKinds,
      routingDecisionIdentityOrCollectionContextFindings: routingDecisionIdentityFindings
    },
    routingCoverage: {
      routedCount: records.filter(record => record.routingDecision?.routeKey).length,
      blockedRouteCount: records.filter(record => record.routingDecision?.routeState?.startsWith('blocked_')).length,
      nonBlockedMemberCandidateKeys: nonBlockedRoutes,
      routeMismatchMemberCandidateKeys: routeMismatches,
      route: compiled.route
    },
    semanticPromotionCoverage: {
      subjectBindingIdentityDispositionOrReviewMutationMemberCandidateKeys: subjectMutations,
      preservedCanonicalActivitySubjectBindingCount: records.filter(record => record.canonicalActivitySubjectBinding !== null).length,
      preservedCanonicalActivitySubjectDeclarationVerdictCount: records.filter(record => record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== null).length,
      canonicalActivityScopeClassificationCount: records.filter(record => record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedDownstreamPromotionMemberCandidateKeys: downstreamPromotions
    },
    accountStateFindings,
    routingCoverageComplete,
    evidenceWorkComplete: false,
    canonicalActivitySubjectBindingReviewComplete: routingCoverageComplete,
    canonicalActivityScopeReviewComplete: false,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'routed_canonical_activity_scope_evidence_work_not_completed',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: routingCoverageComplete
  };
}
