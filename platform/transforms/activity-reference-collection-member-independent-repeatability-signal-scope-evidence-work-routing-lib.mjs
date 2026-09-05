import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const emittableStates = new Set([
  'blocked_incomplete_signal_scope_evidence',
  'blocked_no_exact_line_main_namespace_link_for_scope',
  'blocked_exact_line_links_without_stable_identity_anchor',
  'blocked_stable_identity_anchor_observation_without_semantic_subject_binding'
]);
const validInputStates = new Set([
  'independent_repeatability_signal_scope_disposition_reviewed_unresolved',
  'independent_repeatability_signal_scope_disposition_input_blocked'
]);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceIndependentRepeatabilitySignalScopeDispositionContentHash',
  'independentRepeatabilitySignalScopeEvidenceWorkRouting',
  'independentRepeatabilitySignalScopeEvidenceWorkReview'
]);

function preservedInput(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !stageFields.has(key)));
}

function signalDispositions(record = {}) {
  return record.independentRepeatabilitySignalScopeDisposition?.signalDispositions || [];
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

function invalidRouteDefinitions(policy = {}) {
  const findings = [];
  const owners = new Map();
  for (const [sourceState, route] of Object.entries(policy.stateRoutes || {})) {
    const path = `stateRoutes.${sourceState}`;
    if (!emittableStates.has(sourceState)) findings.push({ path, reason: 'unsupported_signal_scope_disposition_state' });
    if (!route || typeof route !== 'object') {
      findings.push({ path, reason: 'route_not_object' });
      continue;
    }
    if (!route.routeKey || typeof route.routeKey !== 'string') findings.push({ path, reason: 'route_key_missing' });
    if (!String(route.routeState || '').startsWith('blocked_')) findings.push({ path, reason: 'route_state_must_remain_blocked' });
    if (!Array.isArray(route.requiredEvidenceDomains) || !route.requiredEvidenceDomains.length) {
      findings.push({ path, reason: 'required_evidence_domains_missing' });
    }
    if (route.routeKey) {
      if (owners.has(route.routeKey)) findings.push({ path, reason: 'route_key_reused', otherPath: owners.get(route.routeKey) });
      else owners.set(route.routeKey, path);
    }
  }
  return findings;
}

export function compileIndependentRepeatabilitySignalScopeEvidenceWorkRoutingPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneRoutingRecordPerSignalScopeDispositionRecord',
    'oneNestedRoutePerSignalScopeDisposition',
    'everyEmittableDispositionStateMustHaveExactlyOneRoute',
    'incompleteEvidenceRoutesOnlyToRepair',
    'absenceOfExactLineLinkRoutesToSubjectPredicateEvidenceNotOutOfScope',
    'linksWithoutStableAnchorRouteToIdentityAndSemanticEvidence',
    'stableAnchorWithoutSemanticBindingRoutesToSubjectPredicateBinding',
    'routesDescribeEvidenceObligationsNotGameFacts',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesAndOverridesCannotSelectOrAlterRoutes',
    'inputEvidenceDispositionsIdentityRevisionsHashesAndContextMustBePreserved',
    'routingCannotCreateScopeOrRepeatabilityClassifications',
    'routingCannotCompleteMemberExpansionOrMechanics',
    'routingCannotCreateOptimizerCandidates',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed_must_be_false');
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract) {
    invalidRules.push('signal_scope_evidence_work_routing_contract_boundary_missing');
  }
  const routes = policy.stateRoutes || {};
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidRouteDefinitions: invalidRouteDefinitions(policy),
    missingEmittableStates: sorted([...emittableStates].filter(state => !Object.hasOwn(routes, state))),
    stateRoutes: routes
  };
}

function routeDecision(disposition = {}, compiled = {}) {
  const sourceState = disposition.state || null;
  const route = compiled.stateRoutes?.[sourceState];
  if (!route) return {
    policyRuleKind: 'signal_scope_disposition_state',
    signalEvidenceKey: disposition.signalEvidenceKey || null,
    sourceState,
    routeKey: null,
    routeState: 'blocked_unmapped_signal_scope_disposition_state',
    requiredEvidenceDomains: [],
    evidenceWorkComplete: false
  };
  return {
    policyRuleKind: 'signal_scope_disposition_state',
    signalEvidenceKey: disposition.signalEvidenceKey || null,
    sourceState,
    routeKey: route.routeKey,
    routeState: route.routeState,
    requiredEvidenceDomains: [...route.requiredEvidenceDomains],
    evidenceWorkComplete: false
  };
}

function countBy(values = []) {
  const result = {};
  for (const value of values) result[value || 'missing'] = (result[value || 'missing'] || 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function expectedRecord(input, policy) {
  const compiled = compileIndependentRepeatabilitySignalScopeEvidenceWorkRoutingPolicy(policy);
  const routes = signalDispositions(input)
    .map(disposition => routeDecision(disposition, compiled))
    .sort((a, b) => String(a.signalEvidenceKey).localeCompare(String(b.signalEvidenceKey)));
  const routeKeys = routes.map(route => route.routeKey).filter(Boolean);
  const routeStates = routes.map(route => route.routeState);
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceIndependentRepeatabilitySignalScopeDispositionContentHash: input.contentHash,
    independentRepeatabilitySignalScopeEvidenceWorkRouting: {
      state: 'routed_all_signal_scope_evidence_obligations_downstream_gates_closed',
      signalDispositionCount: signalDispositions(input).length,
      signalEvidenceWorkRouteCount: routes.length,
      queuedRouteCount: routes.filter(route => route.routeState === 'queued').length,
      blockedRouteCount: routes.filter(route => route.routeState?.startsWith('blocked_')).length,
      routeCounts: countBy(routeKeys),
      routeStateCounts: countBy(routeStates),
      signalEvidenceWorkRoutes: routes,
      evidenceWorkComplete: false
    },
    independentRepeatabilitySignalScopeEvidenceWorkReview: {
      state: 'reviewed_routed_blocked',
      routeKeys: sorted(unique(routeKeys)),
      requiredEvidenceDomains: sorted(unique(routes.flatMap(route => route.requiredEvidenceDomains))),
      evidenceWorkComplete: false,
      canonicalActivityScopeClassification: null,
      repeatabilityClassification: null
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []),
      'routed_signal_scope_evidence_work_not_completed',
      'canonical_activity_scope_unresolved',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'independent_repeatability_signal_scope_evidence_work_routed_but_scope_unresolved'
  };
}

export function buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes({
  dispositionRecords = [],
  policy = {}
}) {
  const records = dispositionRecords.map(input => expectedRecord(input, policy));
  return {
    records,
    audit: auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes(records, {
      dispositionRecords,
      policy
    })
  };
}

function compositeSignalKey(memberCandidateKey, signalEvidenceKey) {
  return `${memberCandidateKey || 'missing-member'}::${signalEvidenceKey || 'missing-signal'}`;
}

export function auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidenceWorkRoutes(records = [], {
  dispositionRecords = [],
  policy = {}
} = {}) {
  const compiled = compileIndependentRepeatabilitySignalScopeEvidenceWorkRoutingPolicy(policy);
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
    return !output
      || output.sourceIndependentRepeatabilitySignalScopeDispositionContentHash !== input.contentHash
      || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const structurallyInvalidInputs = dispositionRecords.filter(record => {
    const dispositions = signalDispositions(record);
    const packets = record.independentRepeatabilitySignalScopeEvidence?.signalScopeEvidencePackets || [];
    const incomplete = dispositions.some(item => item.state === 'blocked_incomplete_signal_scope_evidence');
    return record.contract !== policy.inputContract
      || !record.contentHash
      || record.accountIndependent !== true
      || !validInputStates.has(record.state)
      || !dispositions.length
      || packets.length !== dispositions.length
      || record.independentRepeatabilitySignalScopeObservations?.signalScopeEvidencePacketCount !== packets.length
      || sorted(packets.map(item => item.signalEvidenceKey)).join('\n') !== sorted(dispositions.map(item => item.signalEvidenceKey)).join('\n')
      || duplicates(packets.map(item => item.signalEvidenceKey)).length > 0
      || record.independentRepeatabilitySignalScopeDisposition?.signalDispositionCount !== dispositions.length
      || record.independentRepeatabilitySignalScopeDisposition?.canonicalActivityScopeClassification !== null
      || record.independentRepeatabilitySignalScopeDisposition?.repeatabilityClassification !== null
      || record.independentRepeatabilitySignalScopeReview?.canonicalActivityScopeClassification !== null
      || record.independentRepeatabilitySignalScopeReview?.repeatabilityClassification !== null
      || record.independentRepeatabilitySignalScopeReview?.state !== 'reviewed_blocked'
      || dispositions.some(item => !item.signalEvidenceKey
        || !emittableStates.has(item.state)
        || item.canonicalActivityScopeClassification !== null
        || item.repeatabilityClassification !== null
        || item.semanticSubjectBinding !== null)
      || duplicates(dispositions.map(item => item.signalEvidenceKey)).length > 0
      || (incomplete && record.state !== 'independent_repeatability_signal_scope_disposition_input_blocked')
      || (!incomplete && record.state !== 'independent_repeatability_signal_scope_disposition_reviewed_unresolved')
      || record.repeatabilityDisposition?.classification !== null
      || record.repeatabilityReview?.classification !== null
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const expectedRecordByKey = new Map(dispositionRecords.map(input => [input.memberCandidateKey, expectedRecord(input, policy)]));
  const routeMismatches = records.filter(record => {
    const expected = expectedRecordByKey.get(record.memberCandidateKey);
    return !expected
      || JSON.stringify(record.independentRepeatabilitySignalScopeEvidenceWorkRouting) !== JSON.stringify(expected.independentRepeatabilitySignalScopeEvidenceWorkRouting)
      || JSON.stringify(record.independentRepeatabilitySignalScopeEvidenceWorkReview) !== JSON.stringify(expected.independentRepeatabilitySignalScopeEvidenceWorkReview)
      || JSON.stringify(record.blockers) !== JSON.stringify(expected.blockers)
      || record.state !== expected.state;
  }).map(record => record.memberCandidateKey);
  const expectedRouteKeys = dispositionRecords.flatMap(record => signalDispositions(record)
    .map(item => compositeSignalKey(record.memberCandidateKey, item.signalEvidenceKey)));
  const actualRouteEntries = records.flatMap(record =>
    (record.independentRepeatabilitySignalScopeEvidenceWorkRouting?.signalEvidenceWorkRoutes || [])
      .map(route => ({ memberCandidateKey: record.memberCandidateKey, route }))
  );
  const actualRouteKeys = actualRouteEntries.map(({ memberCandidateKey, route }) =>
    compositeSignalKey(memberCandidateKey, route.signalEvidenceKey));
  const missingRouteKeys = expectedRouteKeys.filter(key => !actualRouteKeys.includes(key));
  const unexpectedRouteKeys = actualRouteKeys.filter(key => !expectedRouteKeys.includes(key));
  const duplicateRouteKeys = duplicates(actualRouteKeys);
  const unmappedStates = sorted(unique(dispositionRecords.flatMap(record => signalDispositions(record))
    .map(item => item.state || 'missing')
    .filter(state => !compiled.stateRoutes[state])));
  const invalidRuleKinds = actualRouteEntries
    .filter(({ route }) => route.policyRuleKind !== 'signal_scope_disposition_state')
    .map(({ memberCandidateKey, route }) => compositeSignalKey(memberCandidateKey, route.signalEvidenceKey));
  const nonBlockedRoutes = actualRouteEntries
    .filter(({ route }) => !String(route.routeState || '').startsWith('blocked_'))
    .map(({ memberCandidateKey, route }) => compositeSignalKey(memberCandidateKey, route.signalEvidenceKey));
  const upstreamMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.independentRepeatabilitySignalScopeEvidence) !== JSON.stringify(input.independentRepeatabilitySignalScopeEvidence)
      || JSON.stringify(record.independentRepeatabilitySignalScopeDisposition) !== JSON.stringify(input.independentRepeatabilitySignalScopeDisposition)
      || JSON.stringify(record.independentRepeatabilitySignalScopeReview) !== JSON.stringify(input.independentRepeatabilitySignalScopeReview)
      || JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(input.repeatabilityDisposition)
      || JSON.stringify(record.repeatabilityReview) !== JSON.stringify(input.repeatabilityReview);
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const routes = record.independentRepeatabilitySignalScopeEvidenceWorkRouting?.signalEvidenceWorkRoutes || [];
    return record.independentRepeatabilitySignalScopeEvidenceWorkReview?.canonicalActivityScopeClassification !== null
      || record.independentRepeatabilitySignalScopeEvidenceWorkReview?.repeatabilityClassification !== null
      || routes.some(route => route.evidenceWorkComplete !== false)
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
  if (!expectedKeys.length) structuralBlockers.push('no_independent_repeatability_signal_scope_disposition_records');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) {
    structuralBlockers.push('input_and_output_signal_scope_routing_record_sets_do_not_match_exactly');
  }
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_evidence_disposition_identity_revision_or_context_fields_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_signal_scope_disposition_inputs_are_structurally_invalid');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidRouteDefinitions.length || compiled.missingEmittableStates.length) {
    structuralBlockers.push('signal_scope_evidence_work_routing_policy_invalid_or_incomplete');
  }
  if (unmappedStates.length) structuralBlockers.push('one_or_more_signal_scope_disposition_states_have_no_generic_route');
  if (routeMismatches.length || invalidRuleKinds.length || nonBlockedRoutes.length) {
    structuralBlockers.push('one_or_more_signal_scope_evidence_work_routes_do_not_match_policy');
  }
  if (missingRouteKeys.length || unexpectedRouteKeys.length || duplicateRouteKeys.length) {
    structuralBlockers.push('input_and_output_nested_signal_scope_route_sets_do_not_match_exactly');
  }
  if (upstreamMutations.length) structuralBlockers.push('routing_changed_upstream_signal_scope_or_repeatability_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_signal_scope_evidence_work_routes');
  const routes = actualRouteEntries.map(entry => entry.route);
  const canonicalActivityScopeClassificationCount = records.filter(record =>
    record.independentRepeatabilitySignalScopeEvidenceWorkReview?.canonicalActivityScopeClassification !== null
  ).length;
  const repeatabilityClassificationCount = records.filter(record =>
    record.independentRepeatabilitySignalScopeEvidenceWorkReview?.repeatabilityClassification !== null
  ).length;
  const routeDetails = Object.entries(compiled.stateRoutes).map(([sourceState, route]) => ({
    sourceState,
    routeKey: route.routeKey,
    routeState: route.routeState,
    requiredEvidenceDomains: route.requiredEvidenceDomains
  }));
  const routingCoverageComplete = expectedKeys.length > 0
    && expectedRouteKeys.length > 0
    && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  blockers.push(
    'routed_signal_scope_evidence_work_not_completed',
    'canonical_activity_scope_unresolved',
    'repeatability_classification_unresolved',
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
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
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length
        && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      stateRouteCount: Object.keys(compiled.stateRoutes).length,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      invalidRouteDefinitions: compiled.invalidRouteDefinitions,
      missingEmittableStates: compiled.missingEmittableStates,
      observedDispositionStateCounts: countBy(dispositionRecords.flatMap(record => signalDispositions(record)).map(item => item.state)),
      unmappedDispositionStates: unmappedStates,
      invalidPolicyRuleKindCompositeSignalKeys: invalidRuleKinds
    },
    routingCoverage: {
      inputSignalScopeDispositionCount: expectedRouteKeys.length,
      signalEvidenceWorkRouteCount: routes.length,
      missingCompositeSignalKeys: missingRouteKeys,
      unexpectedCompositeSignalKeys: unexpectedRouteKeys,
      duplicateCompositeSignalKeys: duplicateRouteKeys,
      exactNestedRouteSetMatch: !missingRouteKeys.length && !unexpectedRouteKeys.length && !duplicateRouteKeys.length,
      routedCount: routes.filter(route => route.routeKey).length,
      queuedCount: routes.filter(route => route.routeState === 'queued').length,
      blockedRouteCount: routes.filter(route => route.routeState?.startsWith('blocked_')).length,
      routeCounts: countBy(routes.map(route => route.routeKey)),
      routeStateCounts: countBy(routes.map(route => route.routeState)),
      routeDetails,
      routeMismatchMemberCandidateKeys: routeMismatches,
      nonBlockedCompositeSignalKeys: nonBlockedRoutes
    },
    semanticPromotionCoverage: {
      canonicalActivityScopeClassificationCount,
      repeatabilityClassificationCount,
      evidenceWorkCompletedCount: routes.filter(route => route.evidenceWorkComplete === true).length,
      upstreamMutationMemberCandidateKeys: upstreamMutations,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    routingCoverageComplete,
    evidenceWorkComplete: false,
    canonicalActivityScopeReviewComplete: false,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: routingCoverageComplete
  };
}
