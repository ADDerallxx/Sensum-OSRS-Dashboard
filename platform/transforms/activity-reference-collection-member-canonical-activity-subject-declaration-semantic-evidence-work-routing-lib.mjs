import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const emittableStates = new Set([
  'structurally_qualified_subject_candidate_requires_revision_pinned_schema_semantics',
  'unresolved_no_structurally_qualified_subject_declaration_candidate',
  'blocked_multiple_structurally_qualified_subject_pages'
]);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceCanonicalActivitySubjectDeclarationStructuralContextDispositionContentHash',
  'routingDecision'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

function invalidRouteDefinitions(policy = {}) {
  const findings = [];
  const owners = new Map();
  for (const [sourceState, route] of Object.entries(policy.stateRoutes || {})) {
    const path = `stateRoutes.${sourceState}`;
    if (!emittableStates.has(sourceState)) findings.push({ path, reason: 'unsupported_structural_disposition_state' });
    if (!route || typeof route !== 'object') { findings.push({ path, reason: 'route_not_object' }); continue; }
    if (!route.routeKey || typeof route.routeKey !== 'string') findings.push({ path, reason: 'route_key_missing' });
    if (!String(route.routeState || '').startsWith('blocked_')) findings.push({ path, reason: 'semantic_evidence_work_route_not_blocked' });
    if (!Array.isArray(route.requiredEvidenceDomains) || !route.requiredEvidenceDomains.length) findings.push({ path, reason: 'required_evidence_domains_missing' });
    if (route.routeKey) {
      if (owners.has(route.routeKey)) findings.push({ path, reason: 'route_key_reused', otherPath: owners.get(route.routeKey) });
      else owners.set(route.routeKey, path);
    }
  }
  return findings;
}

export function compileCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutingPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneRoutePerCompleteStructuralDispositionRecord',
    'everyEmittableStructuralDispositionStateMustHaveExactlyOneRoute',
    'structurallyQualifiedCandidatesRequireRevisionPinnedSchemaSemantics',
    'absenceOfAStructurallyQualifiedCandidateRoutesToDiscoveryNotANegativeVerdict',
    'multipleQualifiedSubjectPagesRemainAConflict',
    'routesDescribeEvidenceObligationsNotGameFacts',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesCollectionClassesAndOverridesCannotSelectOrAlterRoutes',
    'inputEvidenceIdentityRevisionHashesStructuralSignalsDispositionAndContextMustBePreserved',
    'routingCannotCreateOrAlterSubjectBindingsOrSemanticVerdicts',
    'routingCannotClassifyActivityScopeOrRepeatability',
    'routingCannotCompleteMemberExpansionOrMechanics',
    'routingCannotCreateOptimizerCandidates',
    'currentAccountStateIsForbidden'
  ];
  const stateRoutes = policy.stateRoutes || {};
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return {
    policyId: policy.policy || null,
    invalidRules,
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidRouteDefinitions: invalidRouteDefinitions(policy),
    missingEmittableStates: sorted([...emittableStates].filter(state => !Object.hasOwn(stateRoutes, state))),
    stateRoutes
  };
}

function routingDecision(input, compiled) {
  const sourceState = input.canonicalActivitySubjectDeclarationStructuralDisposition?.state || null;
  const route = compiled.stateRoutes[sourceState];
  if (!route) return {
    policyRuleKind: 'canonical_activity_subject_declaration_structural_disposition_state',
    sourceState,
    routeKey: null,
    routeState: 'blocked_unmapped_structural_disposition_state',
    requiredEvidenceDomains: []
  };
  return {
    policyRuleKind: 'canonical_activity_subject_declaration_structural_disposition_state',
    sourceState,
    routeKey: route.routeKey,
    routeState: route.routeState,
    requiredEvidenceDomains: route.requiredEvidenceDomains
  };
}

function candidateCardinalityConsistent(record) {
  const disposition = record.canonicalActivitySubjectDeclarationStructuralDisposition || {};
  const count = disposition.structurallyQualifiedCandidateCount;
  const pages = disposition.candidatePageKeys || [];
  if (disposition.state === 'structurally_qualified_subject_candidate_requires_revision_pinned_schema_semantics') return count > 0 && pages.length === 1;
  if (disposition.state === 'unresolved_no_structurally_qualified_subject_declaration_candidate') return count === 0 && pages.length === 0;
  if (disposition.state === 'blocked_multiple_structurally_qualified_subject_pages') return count > 1 && pages.length > 1;
  return false;
}

function validInput(record, policy) {
  const disposition = record.canonicalActivitySubjectDeclarationStructuralDisposition || {};
  const review = record.canonicalActivitySubjectDeclarationReview || {};
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && Boolean(record.contentHash)
    && emittableStates.has(disposition.state)
    && candidateCardinalityConsistent(record)
    && disposition.canonicalActivitySubjectDeclarationVerdict === null
    && disposition.canonicalActivityScopeVerdict === null
    && disposition.repeatabilityVerdict === null
    && record.canonicalActivitySubjectBinding === null
    && review.state === 'structural_context_disposed_additional_evidence_required'
    && review.canonicalActivitySubjectDeclarationVerdict === null
    && review.canonicalActivityScopeVerdict === null
    && review.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true;
}

function expectedRecord(input, policy) {
  const compiled = compileCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutingPolicy(policy);
  const decision = routingDecision(input, compiled);
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceCanonicalActivitySubjectDeclarationStructuralContextDispositionContentHash: input.contentHash,
    routingDecision: decision,
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []),
      'routed_canonical_activity_subject_declaration_semantic_evidence_work_not_completed',
      'canonical_activity_subject_binding_unresolved',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'canonical_activity_subject_declaration_semantic_evidence_work_routed_gates_closed'
  };
}

export function buildCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes({ dispositionRecords = [], policy = {} }) {
  const records = dispositionRecords.map(input => expectedRecord(input, policy));
  return { records, audit: auditCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes(records, { dispositionRecords, policy }) };
}

function forbiddenRoutingDecisionPaths(records = []) {
  const findings = [];
  const visit = (value, path, memberCandidateKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, memberCandidateKey));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|resolvedTitle|title|candidateKey|memberCandidateKey|collectionClass|membershipClassification|label|alias)$/i.test(name)) findings.push({ memberCandidateKey, path: childPath });
      visit(child, childPath, memberCandidateKey);
    }
  };
  records.forEach(record => visit(record.routingDecision, 'routingDecision', record.memberCandidateKey));
  return findings;
}

const countBy = values => values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] || 0) + 1 }), {});

export function auditCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutes(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const compiled = compileCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutingPolicy(policy);
  const expectedKeys = dispositionRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(dispositionRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || output.sourceCanonicalActivitySubjectDeclarationStructuralContextDispositionContentHash !== input.contentHash
      || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const expectedRouteByKey = new Map(dispositionRecords.map(input => [input.memberCandidateKey, routingDecision(input, compiled)]));
  const routeMismatches = records.filter(record => JSON.stringify(record.routingDecision) !== JSON.stringify(expectedRouteByKey.get(record.memberCandidateKey))).map(record => record.memberCandidateKey);
  const structurallyInvalidInputs = dispositionRecords.filter(record => !validInput(record, policy)).map(record => record.memberCandidateKey);
  const unmappedStates = sorted(unique(dispositionRecords.map(record => record.canonicalActivitySubjectDeclarationStructuralDisposition?.state || 'missing').filter(state => !compiled.stateRoutes[state])));
  const invalidRuleKinds = records.filter(record => record.routingDecision?.policyRuleKind !== 'canonical_activity_subject_declaration_structural_disposition_state').map(record => record.memberCandidateKey);
  const nonBlockedRoutes = records.filter(record => !record.routingDecision?.routeState?.startsWith('blocked_')).map(record => record.memberCandidateKey);
  const subjectOrReviewMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.canonicalActivitySubjectDeclarationStructuralDisposition) !== JSON.stringify(input.canonicalActivitySubjectDeclarationStructuralDisposition)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationStructuralDispositionSignals) !== JSON.stringify(input.canonicalActivitySubjectDeclarationStructuralDispositionSignals)
      || JSON.stringify(record.canonicalActivitySubjectBinding) !== JSON.stringify(input.canonicalActivitySubjectBinding)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationReview) !== JSON.stringify(input.canonicalActivitySubjectDeclarationReview);
  }).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const routingDecisionIdentityFindings = forbiddenRoutingDecisionPaths(records);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const sourceStates = dispositionRecords.map(record => record.canonicalActivitySubjectDeclarationStructuralDisposition?.state || 'missing');
  const routes = records.map(record => record.routingDecision || {});
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_canonical_activity_subject_declaration_structural_disposition_records');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_member_candidate_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_evidence_identity_revision_hash_structural_signal_disposition_or_context_values_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_structural_disposition_inputs_are_structurally_invalid');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidRouteDefinitions.length || compiled.missingEmittableStates.length) structuralBlockers.push('canonical_activity_subject_declaration_semantic_evidence_work_routing_policy_invalid_or_incomplete');
  if (unmappedStates.length) structuralBlockers.push('one_or_more_structural_disposition_states_have_no_generic_route');
  if (routeMismatches.length || invalidRuleKinds.length || nonBlockedRoutes.length) structuralBlockers.push('one_or_more_semantic_evidence_work_routes_do_not_match_policy');
  if (routingDecisionIdentityFindings.length) structuralBlockers.push('identity_or_collection_context_used_to_select_or_alter_route');
  if (subjectOrReviewMutations.length) structuralBlockers.push('routing_changed_subject_disposition_binding_review_or_structural_signals');
  if (downstreamPromotions.length) structuralBlockers.push('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_subject_declaration_semantic_evidence_work_routes');
  const routingCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedDispositionRecordCount: expectedKeys.length,
      routingRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: structurallyInvalidInputs,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      stateRouteCount: Object.keys(compiled.stateRoutes).length,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      invalidRouteDefinitions: compiled.invalidRouteDefinitions,
      missingEmittableStates: compiled.missingEmittableStates,
      observedDispositionStateCounts: countBy(sourceStates),
      unmappedDispositionStates: unmappedStates,
      invalidPolicyRuleKindMemberCandidateKeys: invalidRuleKinds,
      routingDecisionIdentityOrCollectionContextFindings: routingDecisionIdentityFindings
    },
    routingCoverage: {
      routedCount: routes.filter(route => route.routeKey).length,
      blockedRouteCount: routes.filter(route => route.routeState?.startsWith('blocked_')).length,
      nonBlockedMemberCandidateKeys: nonBlockedRoutes,
      routeCounts: countBy(routes.map(route => route.routeKey || 'unrouted')),
      routeStateCounts: countBy(routes.map(route => route.routeState || 'missing')),
      routeDetails: Object.entries(compiled.stateRoutes).map(([sourceState, route]) => ({ sourceState, ...route })),
      routeMismatchMemberCandidateKeys: routeMismatches
    },
    semanticPromotionCoverage: {
      subjectDispositionBindingOrReviewMutationMemberCandidateKeys: subjectOrReviewMutations,
      canonicalActivitySubjectBindingCount: records.filter(record => record.canonicalActivitySubjectBinding !== null).length,
      canonicalActivitySubjectDeclarationVerdictCount: records.filter(record => record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== null).length,
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
    canonicalActivitySubjectBindingReviewComplete: false,
    canonicalActivityScopeReviewComplete: false,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'routed_canonical_activity_subject_declaration_semantic_evidence_work_not_completed',
      'canonical_activity_subject_binding_unresolved',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: routingCoverageComplete
  };
}
