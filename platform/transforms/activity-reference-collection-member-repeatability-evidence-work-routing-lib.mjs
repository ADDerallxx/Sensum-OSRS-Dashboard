import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const emittableStates = new Set([
  'source_supported_repeatable_activity',
  'source_supported_non_repeatable_activity',
  'blocked_conflicting_explicit_repeatability_declarations',
  'unresolved_explicit_repeatability_declaration_scope_not_established',
  'unresolved_recurrence_or_session_structure_without_explicit_declaration',
  'unresolved_no_explicit_repeatability_evidence',
  'unresolved_incomplete_repeatability_evidence'
]);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceRepeatabilityDispositionContentHash', 'routingDecision'
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
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

function invalidRouteDefinitions(policy = {}) {
  const findings = [];
  const routeKeyOwners = new Map();
  for (const [sourceState, route] of Object.entries(policy.stateRoutes || {})) {
    const path = `stateRoutes.${sourceState}`;
    if (!emittableStates.has(sourceState)) findings.push({ path, reason: 'unsupported_disposition_state' });
    if (!route || typeof route !== 'object') { findings.push({ path, reason: 'route_not_object' }); continue; }
    if (!route.routeKey || typeof route.routeKey !== 'string') findings.push({ path, reason: 'route_key_missing' });
    if (!route.routeState || typeof route.routeState !== 'string') findings.push({ path, reason: 'route_state_missing' });
    if (!Array.isArray(route.requiredEvidenceDomains) || !route.requiredEvidenceDomains.length) findings.push({ path, reason: 'required_evidence_domains_missing' });
    if (!Array.isArray(route.expansionAxes)) findings.push({ path, reason: 'expansion_axes_not_array' });
    const supported = sourceState.startsWith('source_supported_');
    if (supported && route.routeState !== 'queued') findings.push({ path, reason: 'supported_disposition_route_not_queued' });
    if (!supported && !String(route.routeState || '').startsWith('blocked_')) findings.push({ path, reason: 'unresolved_conflicting_or_incomplete_route_not_blocked' });
    if (route.routeKey) {
      if (routeKeyOwners.has(route.routeKey)) findings.push({ path, reason: 'route_key_reused', otherPath: routeKeyOwners.get(route.routeKey) });
      else routeKeyOwners.set(route.routeKey, path);
    }
  }
  return findings;
}

export function compileRepeatabilityEvidenceWorkRoutingPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneRoutePerRepeatabilityDisposition',
    'everyEmittableDispositionStateMustHaveExactlyOneRoute',
    'supportedRepeatableRoutesToMemberAndMechanicsEvidence',
    'supportedNonRepeatableRoutesToExclusionScopeReviewNotAutomaticExclusion',
    'conflictingUnresolvedAndIncompleteStatesRemainBlocked',
    'recurrenceAndSessionStructureCannotBePromotedToRepeatability',
    'absenceOfEvidenceCannotBePromotedToNonRepeatability',
    'routesDescribeEvidenceObligationsNotGameFacts',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesAndCollectionClassesCannotSelectOrAlterRoutes',
    'inputEvidenceIdentityRevisionHashesAndContextMustBePreserved',
    'routingCannotChangeRepeatabilityDispositionOrReview',
    'routingCannotCompleteMemberExpansionOrMechanics',
    'routingCannotCreateOptimizerCandidates',
    'currentAccountStateIsForbidden'
  ];
  const stateRoutes = policy.stateRoutes || {};
  return {
    policyId: policy.policy || null,
    invalidRules: requiredTrueRules.filter(rule => policy.rules?.[rule] !== true),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidRouteDefinitions: invalidRouteDefinitions(policy),
    missingEmittableStates: sorted([...emittableStates].filter(state => !Object.hasOwn(stateRoutes, state))),
    stateRoutes
  };
}

function expectedClassificationForState(state) {
  if (state === 'source_supported_repeatable_activity') return 'repeatable';
  if (state === 'source_supported_non_repeatable_activity') return 'non_repeatable';
  return null;
}

function routingDecision(input, compiled) {
  const sourceState = input.repeatabilityDisposition?.state || null;
  const route = compiled.stateRoutes[sourceState];
  if (!route) return {
    policyRuleKind: 'repeatability_disposition_state',
    sourceState,
    sourceClassification: input.repeatabilityDisposition?.classification ?? null,
    routeKey: null,
    routeState: 'blocked_unmapped_repeatability_disposition_state',
    requiredEvidenceDomains: [],
    expansionAxes: []
  };
  return {
    policyRuleKind: 'repeatability_disposition_state',
    sourceState,
    sourceClassification: input.repeatabilityDisposition?.classification ?? null,
    routeKey: route.routeKey,
    routeState: route.routeState,
    requiredEvidenceDomains: route.requiredEvidenceDomains,
    expansionAxes: route.expansionAxes
  };
}

function expectedRecord(input, policy) {
  const compiled = compileRepeatabilityEvidenceWorkRoutingPolicy(policy);
  const decision = routingDecision(input, compiled);
  const supported = decision.sourceState?.startsWith('source_supported_');
  return {
    contract: policy.recordContract || 'sensum.activity-reference-collection-member-repeatability-evidence-work-routing.v1',
    ...preservedInput(input),
    sourceRepeatabilityDispositionContentHash: input.contentHash,
    routingDecision: decision,
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []),
      supported ? 'routed_downstream_evidence_work_not_completed' : 'repeatability_evidence_gap_or_conflict_remains_blocked',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: supported
      ? 'repeatability_evidence_work_queued_downstream_gates_closed'
      : 'repeatability_evidence_work_routed_but_source_gap_remains_blocked'
  };
}

export function buildActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes({ dispositionRecords = [], policy = {} }) {
  const records = dispositionRecords.map(input => expectedRecord(input, policy));
  return { records, audit: auditActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes(records, { dispositionRecords, policy }) };
}

function forbiddenRoutingDecisionPaths(records = []) {
  const findings = [];
  const visit = (value, path, memberCandidateKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, memberCandidateKey));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|resolvedTitle|title|candidateKey|memberCandidateKey|collectionClass|membershipClassification|collectionDisplayLabel|label|alias)$/i.test(name)) findings.push({ memberCandidateKey, path: childPath });
      visit(child, childPath, memberCandidateKey);
    }
  };
  records.forEach(record => visit(record.routingDecision, 'routingDecision', record.memberCandidateKey));
  return findings;
}

export function auditActivityReferenceCollectionMemberRepeatabilityEvidenceWorkRoutes(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const compiled = compileRepeatabilityEvidenceWorkRoutingPolicy(policy);
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
    return !output || output.sourceRepeatabilityDispositionContentHash !== input.contentHash
      || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const expectedRouteByKey = new Map(dispositionRecords.map(input => [input.memberCandidateKey, routingDecision(input, compiled)]));
  const routeMismatches = records.filter(record => JSON.stringify(record.routingDecision) !== JSON.stringify(expectedRouteByKey.get(record.memberCandidateKey))).map(record => record.memberCandidateKey);
  const structurallyInvalidInputs = dispositionRecords.filter(record => {
    const state = record.repeatabilityDisposition?.state;
    const expectedClassification = expectedClassificationForState(state);
    const supported = state?.startsWith('source_supported_');
    return record.contract !== policy.inputContract || !record.contentHash || record.accountIndependent !== true
      || !emittableStates.has(state)
      || (record.repeatabilityDisposition?.classification ?? null) !== expectedClassification
      || record.repeatabilityReview?.state !== (supported ? 'reviewed_source_supported' : 'reviewed_blocked')
      || (record.repeatabilityReview?.classification ?? null) !== expectedClassification
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const unmappedStates = sorted(unique(dispositionRecords.map(record => record.repeatabilityDisposition?.state || 'missing').filter(state => !compiled.stateRoutes[state])));
  const invalidRuleKinds = records.filter(record => record.routingDecision?.policyRuleKind !== 'repeatability_disposition_state').map(record => record.memberCandidateKey);
  const supportedRouteMismatches = records.filter(record => record.repeatabilityDisposition?.state?.startsWith('source_supported_') && record.routingDecision?.routeState !== 'queued').map(record => record.memberCandidateKey);
  const blockedRouteMismatches = records.filter(record => !record.repeatabilityDisposition?.state?.startsWith('source_supported_') && !record.routingDecision?.routeState?.startsWith('blocked_')).map(record => record.memberCandidateKey);
  const repeatabilityMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(input.repeatabilityDisposition)
      || JSON.stringify(record.repeatabilityReview) !== JSON.stringify(input.repeatabilityReview);
  }).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const routingDecisionIdentityFindings = forbiddenRoutingDecisionPaths(records);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const observedStateCounts = {};
  const routeCounts = {};
  const routeStateCounts = {};
  for (const input of dispositionRecords) {
    const state = input.repeatabilityDisposition?.state || 'missing';
    observedStateCounts[state] = (observedStateCounts[state] || 0) + 1;
  }
  for (const record of records) {
    const routeKey = record.routingDecision?.routeKey || 'unrouted';
    const routeState = record.routingDecision?.routeState || 'missing';
    routeCounts[routeKey] = (routeCounts[routeKey] || 0) + 1;
    routeStateCounts[routeState] = (routeStateCounts[routeState] || 0) + 1;
  }
  const routeDetails = records.map(record => ({
    memberCandidateKey: record.memberCandidateKey,
    canonicalActivityKey: record.canonicalActivityIdentity?.canonicalActivityKey || null,
    canonicalLabel: record.canonicalActivityIdentity?.canonicalLabel || null,
    sourceRevision: record.sourceRevision,
    repeatabilityState: record.repeatabilityDisposition?.state || null,
    repeatabilityClassification: record.repeatabilityDisposition?.classification ?? null,
    routeKey: record.routingDecision?.routeKey || null,
    routeState: record.routingDecision?.routeState || null
  }));
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_repeatability_disposition_records');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_member_candidate_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_upstream_evidence_identity_revision_hash_or_context_values_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_repeatability_disposition_inputs_are_structurally_invalid');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidRouteDefinitions.length || compiled.missingEmittableStates.length) structuralBlockers.push('repeatability_evidence_work_routing_policy_invalid_or_incomplete');
  if (unmappedStates.length) structuralBlockers.push('one_or_more_repeatability_disposition_states_have_no_generic_route');
  if (routeMismatches.length || invalidRuleKinds.length || supportedRouteMismatches.length || blockedRouteMismatches.length) structuralBlockers.push('one_or_more_repeatability_evidence_work_routes_do_not_match_policy');
  if (routingDecisionIdentityFindings.length) structuralBlockers.push('identity_or_collection_context_used_to_select_or_alter_route');
  if (repeatabilityMutations.length) structuralBlockers.push('routing_changed_repeatability_disposition_or_review');
  if (downstreamPromotions.length) structuralBlockers.push('unsupported_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_repeatability_evidence_work_routes');
  const routingCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const supportedRepeatableCount = dispositionRecords.filter(record => record.repeatabilityDisposition?.state === 'source_supported_repeatable_activity').length;
  const supportedNonRepeatableCount = dispositionRecords.filter(record => record.repeatabilityDisposition?.state === 'source_supported_non_repeatable_activity').length;
  const conflictCount = dispositionRecords.filter(record => record.repeatabilityDisposition?.state === 'blocked_conflicting_explicit_repeatability_declarations').length;
  const unresolvedCount = dispositionRecords.filter(record => record.repeatabilityDisposition?.state?.startsWith('unresolved_')).length;
  const blockers = [...structuralBlockers];
  if (conflictCount) blockers.push('one_or_more_repeatability_declaration_conflicts_remain');
  if (unresolvedCount) blockers.push('one_or_more_repeatability_classifications_remain_unresolved');
  blockers.push(
    'routed_repeatability_evidence_work_not_completed',
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-repeatability-evidence-work-routing-audit.v1',
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
      policy: policy.policy || null,
      stateRouteCount: Object.keys(policy.stateRoutes || {}).length,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      invalidRouteDefinitions: compiled.invalidRouteDefinitions,
      missingEmittableStates: compiled.missingEmittableStates,
      observedDispositionStateCounts: observedStateCounts,
      unmappedDispositionStates: unmappedStates,
      invalidPolicyRuleKindMemberCandidateKeys: invalidRuleKinds,
      routingDecisionIdentityOrCollectionContextFindings: routingDecisionIdentityFindings
    },
    routingCoverage: {
      routedCount: records.filter(record => record.routingDecision?.routeKey).length,
      queuedCount: records.filter(record => record.routingDecision?.routeState === 'queued').length,
      blockedRouteCount: records.filter(record => record.routingDecision?.routeState?.startsWith('blocked_')).length,
      supportedRepeatableCount,
      supportedNonRepeatableCount,
      conflictCount,
      unresolvedCount,
      routeCounts,
      routeStateCounts,
      routeDetails,
      routeMismatchMemberCandidateKeys: routeMismatches,
      supportedRouteMismatchMemberCandidateKeys: supportedRouteMismatches,
      blockedRouteMismatchMemberCandidateKeys: blockedRouteMismatches
    },
    semanticPromotionCoverage: {
      repeatabilityDispositionMutationMemberCandidateKeys: repeatabilityMutations,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedDownstreamPromotionMemberCandidateKeys: downstreamPromotions
    },
    accountStateFindings,
    routingCoverageComplete,
    evidenceWorkComplete: false,
    repeatabilityReviewComplete: conflictCount === 0 && unresolvedCount === 0 && structurallyInvalidInputs.length === 0,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: routingCoverageComplete
  };
}
