import {
  buildActivityCandidateEvidenceWorkRoutes,
  compileActivityCandidateEvidenceWorkRoutingPolicy,
  findActivityCandidateEvidenceWorkRoutingAccountState
} from './activity-candidate-evidence-work-routing-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));

function genericDispositionProjection(record) {
  return {
    contract: 'sensum.activity-candidate-subject-disposition.v1',
    candidateKey: record.memberCandidateKey,
    sourcePageId: record.sourcePageId,
    resolvedTitle: record.resolvedTitle,
    skillKeys: [],
    statementKeys: [],
    sourceRevision: record.sourceRevision,
    sourceTimestamp: record.sourceTimestamp,
    sourceUrl: record.sourceUrl,
    sourceContentHash: record.sourceContentHash,
    sourceSignatureContexts: [{
      sourceMemberDispositionContentHash: record.contentHash,
      sourceMemberEvidenceContentHash: record.sourceMemberEvidenceContentHash,
      collectionContext: record.collectionContext,
      memberIdentityContexts: record.memberIdentityContexts,
      membershipClassification: record.membershipClassification,
      infoboxTypeAssessment: record.infoboxTypeAssessment,
      leadParagraphSelection: record.leadParagraphSelection
    }],
    dispositionSignals: record.dispositionSignals || [],
    subjectDisposition: record.subjectDisposition,
    repeatabilityReview: record.repeatabilityReview,
    memberExpansionReview: record.memberExpansionReview,
    canonicalGameEntityIdentity: record.canonicalGameEntityIdentity,
    canonicalActivityIdentity: record.canonicalActivityIdentity,
    optimizerEligible: record.optimizerEligible,
    accountIndependent: record.accountIndependent,
    blockers: record.blockers || [],
    contentHash: record.contentHash
  };
}

const inputContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceMemberDispositionContentHash: record.contentHash,
  sourceMemberEvidenceContentHash: record.sourceMemberEvidenceContentHash,
  collectionContext: record.collectionContext,
  memberIdentityContexts: record.memberIdentityContexts,
  sourcePageId: record.sourcePageId,
  resolvedTitle: record.resolvedTitle,
  membershipClassification: record.membershipClassification,
  sourceRevision: String(record.sourceRevision || ''),
  sourceTimestamp: record.sourceTimestamp || null,
  sourceUrl: record.sourceUrl || null,
  sourceContentHash: record.sourceContentHash || null,
  sourceDisposition: record.subjectDisposition || null,
  dispositionSignals: record.dispositionSignals || [],
  sourceBlockers: record.blockers || []
});

const outputContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceMemberDispositionContentHash: record.sourceMemberDispositionContentHash,
  sourceMemberEvidenceContentHash: record.sourceMemberEvidenceContentHash,
  collectionContext: record.collectionContext,
  memberIdentityContexts: record.memberIdentityContexts,
  sourcePageId: record.sourcePageId,
  resolvedTitle: record.resolvedTitle,
  membershipClassification: record.membershipClassification,
  sourceRevision: String(record.sourceRevision || ''),
  sourceTimestamp: record.sourceTimestamp || null,
  sourceUrl: record.sourceUrl || null,
  sourceContentHash: record.sourceContentHash || null,
  sourceDisposition: record.sourceDisposition || null,
  dispositionSignals: record.dispositionSignals || [],
  sourceBlockers: record.sourceBlockers || []
});

function forbiddenMemberRoutingPolicyPaths(policy = {}) {
  const paths = [...compileActivityCandidateEvidenceWorkRoutingPolicy(policy).pageSpecificPolicyPaths];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:membershipClassification|membershipClassifications|collectionClass|collectionClasses|collectionDisplayLabel|collectionDisplayLabels|collectionCandidateKey|collectionCandidateKeys)$/i.test(name)) paths.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(paths));
}

function invalidRouteDefinitions(policy = {}) {
  const findings = [];
  const routeKeyOwners = new Map();
  for (const [ruleKind, routes] of [['source_state', policy.stateRoutes || {}], ['subject_disposition', policy.dispositionRoutes || {}]]) {
    for (const [ruleKey, route] of Object.entries(routes)) {
      const path = `${ruleKind}.${ruleKey}`;
      if (!route || typeof route !== 'object') { findings.push({ path, reason: 'route_not_object' }); continue; }
      if (!route.routeKey || typeof route.routeKey !== 'string') findings.push({ path, reason: 'route_key_missing' });
      if (!route.routeState || typeof route.routeState !== 'string') findings.push({ path, reason: 'route_state_missing' });
      if (!Array.isArray(route.requiredEvidenceDomains) || !route.requiredEvidenceDomains.length) findings.push({ path, reason: 'required_evidence_domains_missing' });
      if (!Array.isArray(route.expansionAxes)) findings.push({ path, reason: 'expansion_axes_not_array' });
      if (ruleKind === 'source_state' && !String(route.routeState || '').startsWith('blocked_')) findings.push({ path, reason: 'blocked_source_state_route_not_blocked' });
      if (ruleKind === 'subject_disposition' && route.routeState !== 'queued') findings.push({ path, reason: 'supported_disposition_route_not_queued' });
      if (route.routeKey) {
        if (routeKeyOwners.has(route.routeKey)) findings.push({ path, reason: 'route_key_reused', otherPath: routeKeyOwners.get(route.routeKey) });
        else routeKeyOwners.set(route.routeKey, path);
      }
    }
  }
  return findings;
}

export function buildActivityReferenceCollectionMemberEvidenceWorkRoutes({ dispositionRecords = [], policy = {} }) {
  const projected = dispositionRecords.map(genericDispositionProjection);
  const generic = buildActivityCandidateEvidenceWorkRoutes({ dispositionRecords: projected, policy });
  const inputByKey = new Map(dispositionRecords.map(record => [record.memberCandidateKey, record]));
  const records = generic.records.map(route => {
    const input = inputByKey.get(route.candidateKey);
    return {
      contract: 'sensum.activity-reference-collection-member-evidence-work-routing.v1',
      memberCandidateKey: input.memberCandidateKey,
      sourceMemberDispositionContentHash: input.contentHash,
      sourceMemberEvidenceContentHash: input.sourceMemberEvidenceContentHash,
      collectionContext: input.collectionContext,
      memberIdentityContexts: input.memberIdentityContexts,
      sourcePageId: input.sourcePageId,
      resolvedTitle: input.resolvedTitle,
      membershipClassification: input.membershipClassification,
      sourceRevision: input.sourceRevision,
      sourceTimestamp: input.sourceTimestamp,
      sourceUrl: input.sourceUrl,
      sourceContentHash: input.sourceContentHash,
      sourceDisposition: input.subjectDisposition,
      dispositionSignals: input.dispositionSignals || [],
      sourceBlockers: input.blockers || [],
      routingDecision: route.routingDecision,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique([...(route.blockers || []), 'collection_membership_is_context_not_routing_evidence']),
      state: route.state
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberEvidenceWorkRoutes(records, { dispositionRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberEvidenceWorkRoutes(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const projected = dispositionRecords.map(genericDispositionProjection);
  const expectedGeneric = buildActivityCandidateEvidenceWorkRoutes({ dispositionRecords: projected, policy });
  const expectedRouteByKey = new Map(expectedGeneric.records.map(record => [record.candidateKey, record.routingDecision]));
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
    return !output || inputContextProjection(input) !== outputContextProjection(output);
  });
  const routeMismatches = records.filter(record => JSON.stringify(record.routingDecision) !== JSON.stringify(expectedRouteByKey.get(record.memberCandidateKey))).map(record => record.memberCandidateKey);
  const forbiddenPolicyPaths = forbiddenMemberRoutingPolicyPaths(policy);
  const invalidRoutes = invalidRouteDefinitions(policy);
  const unmappedSourceStates = expectedGeneric.audit.policyCoverage.unmappedSourceStates;
  const unmappedSubjectDispositions = expectedGeneric.audit.policyCoverage.unmappedSubjectDispositions;
  const invalidRuleKinds = records.filter(record => !['source_state', 'subject_disposition'].includes(record.routingDecision?.policyRuleKind)).map(record => record.memberCandidateKey);
  const collectionDerivedRouting = records.filter(record => record.routingDecision?.membershipClassification !== undefined || record.routingDecision?.collectionContext !== undefined || record.routingDecision?.collectionDisplayLabel !== undefined || record.routingDecision?.resolvedTitle !== undefined || record.routingDecision?.sourcePageId !== undefined).map(record => record.memberCandidateKey);
  const blockedSourceRouteMismatches = records.filter(record => record.sourceDisposition?.state !== 'source_supported' && !record.routingDecision?.routeState?.startsWith('blocked_')).map(record => record.memberCandidateKey);
  const supportedDispositionRouteMismatches = records.filter(record => record.sourceDisposition?.state === 'source_supported' && record.routingDecision?.routeState !== 'queued').map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null || record.optimizerEligible !== false || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed').map(record => record.memberCandidateKey);
  const accountStateFindings = findActivityCandidateEvidenceWorkRoutingAccountState(records);
  const routeCounts = {};
  const routeStateCounts = {};
  const sourceStateCounts = {};
  const supportedDispositionCounts = {};
  for (const record of records) {
    const routeKey = record.routingDecision?.routeKey || 'unrouted';
    const routeState = record.routingDecision?.routeState || 'missing';
    routeCounts[routeKey] = (routeCounts[routeKey] || 0) + 1;
    routeStateCounts[routeState] = (routeStateCounts[routeState] || 0) + 1;
  }
  for (const input of dispositionRecords) {
    const sourceState = input.subjectDisposition?.state || 'missing';
    sourceStateCounts[sourceState] = (sourceStateCounts[sourceState] || 0) + 1;
    const disposition = input.subjectDisposition?.disposition;
    if (disposition) supportedDispositionCounts[disposition] = (supportedDispositionCounts[disposition] || 0) + 1;
  }
  const blockedRouteDetails = records.filter(record => record.routingDecision?.routeState?.startsWith('blocked_')).map(record => ({
    memberCandidateKey: record.memberCandidateKey,
    collectionDisplayLabel: record.collectionContext?.memberCellEvidence?.plainText || null,
    resolvedTitle: record.resolvedTitle,
    membershipClassification: record.membershipClassification,
    sourceRevision: record.sourceRevision,
    sourceState: record.sourceDisposition?.state || null,
    conflictingDispositions: record.sourceDisposition?.conflictingDispositions || [],
    routeKey: record.routingDecision?.routeKey || null,
    routeState: record.routingDecision?.routeState || null
  }));
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_collection_member_subject_disposition_records');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_member_candidate_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_identity_revision_hash_disposition_signal_collection_or_alias_context_values_changed');
  if (forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_collection_class_or_override_routing_policy_forbidden');
  if (invalidRoutes.length) structuralBlockers.push('one_or_more_policy_route_definitions_invalid');
  if (unmappedSourceStates.length || unmappedSubjectDispositions.length) structuralBlockers.push('one_or_more_source_states_or_dispositions_have_no_generic_route');
  if (routeMismatches.length || invalidRuleKinds.length || blockedSourceRouteMismatches.length || supportedDispositionRouteMismatches.length) structuralBlockers.push('one_or_more_member_routing_decisions_do_not_match_policy');
  if (collectionDerivedRouting.length) structuralBlockers.push('collection_context_used_to_select_or_alter_evidence_work_route');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_canonical_repeatability_member_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_member_evidence_work_routes');
  const routingCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const sourceConflictCount = dispositionRecords.filter(record => record.subjectDisposition?.state === 'blocked_conflicting_source_declarations').length;
  const unresolvedSubjectCount = dispositionRecords.filter(record => record.subjectDisposition?.state === 'unresolved_no_supported_source_declaration').length;
  const blockers = [...structuralBlockers];
  if (sourceConflictCount) blockers.push('one_or_more_source_declaration_conflicts_remain');
  if (unresolvedSubjectCount) blockers.push('one_or_more_subject_declarations_remain_unresolved');
  blockers.push('routed_evidence_work_not_completed', 'canonical_game_entity_and_activity_identities_not_established', 'repeatability_and_member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established');
  return {
    contract: 'sensum.activity-reference-collection-member-evidence-work-routing-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedDispositionRecordCount: expectedKeys.length,
      routingRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      identityRevisionHashDispositionSignalCollectionOrAliasContextMismatchMemberCandidateKeys: contextMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: policy.policy || null,
      stateRouteCount: Object.keys(policy.stateRoutes || {}).length,
      dispositionRouteCount: Object.keys(policy.dispositionRoutes || {}).length,
      forbiddenPolicyPaths,
      invalidRouteDefinitions: invalidRoutes,
      observedSourceStateCounts: sourceStateCounts,
      observedSupportedDispositionCounts: supportedDispositionCounts,
      unmappedSourceStates,
      unmappedSubjectDispositions,
      invalidPolicyRuleKindMemberCandidateKeys: invalidRuleKinds,
      collectionContextDerivedRoutingMemberCandidateKeys: collectionDerivedRouting
    },
    routingCoverage: {
      routedCount: records.filter(record => record.routingDecision?.routeKey).length,
      queuedCount: records.filter(record => record.routingDecision?.routeState === 'queued').length,
      blockedRouteCount: records.filter(record => record.routingDecision?.routeState?.startsWith('blocked_')).length,
      sourceConflictCount,
      unresolvedSubjectCount,
      routeCounts,
      routeStateCounts,
      blockedRouteDetails,
      routeMismatchMemberCandidateKeys: routeMismatches,
      blockedSourceRouteMismatchMemberCandidateKeys: blockedSourceRouteMismatches,
      supportedDispositionRouteMismatchMemberCandidateKeys: supportedDispositionRouteMismatches
    },
    semanticPromotionCoverage: {
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    routingCoverageComplete,
    evidenceWorkComplete: false,
    subjectDispositionComplete: sourceConflictCount === 0 && unresolvedSubjectCount === 0 && !unmappedSourceStates.length && !unmappedSubjectDispositions.length,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: routingCoverageComplete
  };
}
