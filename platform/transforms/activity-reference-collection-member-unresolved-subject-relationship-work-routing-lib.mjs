import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) { value.forEach((child, index) => visit(child, `${path}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|collectionDisplayLabel|collectionDisplayLabels|alias|aliases|link|links|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

function invalidRouteDefinitions(policy = {}) {
  const findings = [];
  const owners = new Map();
  for (const [ruleKind, routes] of [['disposition_state', policy.stateRoutes || {}], ['source_page_subject_class', policy.subjectClassRoutes || {}]]) {
    for (const [ruleKey, route] of Object.entries(routes)) {
      const path = `${ruleKind}.${ruleKey}`;
      if (!route || typeof route !== 'object') { findings.push({ path, reason: 'route_not_object' }); continue; }
      if (!route.routeKey || typeof route.routeKey !== 'string') findings.push({ path, reason: 'route_key_missing' });
      if (!route.routeState || typeof route.routeState !== 'string') findings.push({ path, reason: 'route_state_missing' });
      if (!Array.isArray(route.requiredEvidenceDomains) || !route.requiredEvidenceDomains.length) findings.push({ path, reason: 'required_evidence_domains_missing' });
      if (!Array.isArray(route.expansionAxes)) findings.push({ path, reason: 'expansion_axes_not_array' });
      if (ruleKind === 'disposition_state' && !String(route.routeState || '').startsWith('blocked_')) findings.push({ path, reason: 'blocked_state_route_not_blocked' });
      if (ruleKind === 'source_page_subject_class' && route.routeState !== 'queued') findings.push({ path, reason: 'supported_class_route_not_queued' });
      if (route.routeKey) {
        if (owners.has(route.routeKey)) findings.push({ path, reason: 'route_key_reused', otherPath: owners.get(route.routeKey) });
        else owners.set(route.routeKey, path);
      }
    }
  }
  return findings;
}

function expectedRoute(record, policy = {}) {
  const disposition = record.sourcePageSubjectDisposition || {};
  const supported = disposition.state === 'source_signature_supported';
  const policyRuleKind = supported ? 'source_page_subject_class' : 'disposition_state';
  const policyRuleKey = supported ? disposition.disposition : disposition.state;
  const route = supported ? policy.subjectClassRoutes?.[policyRuleKey] : policy.stateRoutes?.[policyRuleKey];
  return {
    policy: policy.policy || null,
    policyRuleKind,
    policyRuleKey: policyRuleKey || null,
    routeKey: route?.routeKey || null,
    routeState: route?.routeState || 'unrouted_policy_gap',
    requiredEvidenceDomains: route?.requiredEvidenceDomains || [],
    expansionAxes: route?.expansionAxes || []
  };
}

const inputContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceSignatureDispositionContentHash: record.contentHash,
  sourceSignatureContentHash: record.sourceSignatureContentHash,
  sourceRoutingContentHash: record.sourceRoutingContentHash,
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
  sourceSignatureEvidenceSummary: record.sourceSignatureEvidenceSummary || null,
  dispositionSignals: record.dispositionSignals || [],
  sourcePageSubjectDisposition: record.sourcePageSubjectDisposition || null,
  sourceBlockers: record.sourceBlockers || [],
  sourceSignatureBlockers: record.sourceSignatureBlockers || [],
  sourceDispositionBlockers: record.blockers || []
});

const outputContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceSignatureDispositionContentHash: record.sourceSignatureDispositionContentHash,
  sourceSignatureContentHash: record.sourceSignatureContentHash,
  sourceRoutingContentHash: record.sourceRoutingContentHash,
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
  sourceSignatureEvidenceSummary: record.sourceSignatureEvidenceSummary || null,
  dispositionSignals: record.dispositionSignals || [],
  sourcePageSubjectDisposition: record.sourcePageSubjectDisposition || null,
  sourceBlockers: record.sourceBlockers || [],
  sourceSignatureBlockers: record.sourceSignatureBlockers || [],
  sourceDispositionBlockers: record.sourceDispositionBlockers || []
});

export function buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes({ dispositionRecords = [], policy = {} }) {
  const records = dispositionRecords.map(input => {
    const routingDecision = expectedRoute(input, policy);
    const blockers = [];
    if (!routingDecision.routeKey) blockers.push('source_page_subject_relationship_work_route_unmapped');
    if (routingDecision.routeState.startsWith('blocked_')) blockers.push('source_page_subject_disposition_state_blocks_relationship_work');
    blockers.push(
      'routed_relationship_and_activity_scope_evidence_work_not_completed',
      'collection_activity_identity_not_established',
      'linked_subject_relationship_review_pending',
      'canonical_game_entity_and_activity_identities_not_established',
      'repeatability_and_member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: policy.recordContract || 'sensum.activity-reference-collection-member-unresolved-subject-relationship-work-routing.v1',
      memberCandidateKey: input.memberCandidateKey,
      sourceSignatureDispositionContentHash: input.contentHash,
      sourceSignatureContentHash: input.sourceSignatureContentHash,
      sourceRoutingContentHash: input.sourceRoutingContentHash,
      sourceMemberDispositionContentHash: input.sourceMemberDispositionContentHash,
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
      sourceSignatureEvidenceSummary: input.sourceSignatureEvidenceSummary,
      dispositionSignals: input.dispositionSignals || [],
      sourcePageSubjectDisposition: input.sourcePageSubjectDisposition,
      sourceBlockers: input.sourceBlockers || [],
      sourceSignatureBlockers: input.sourceSignatureBlockers || [],
      sourceDispositionBlockers: input.blockers || [],
      routingDecision,
      collectionActivityIdentityReview: { state: 'unreviewed', identity: null, evidenceKeys: [] },
      linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: routingDecision.routeKey ? (routingDecision.routeState === 'queued' ? 'relationship_work_queued' : 'relationship_work_blocked') : 'relationship_work_unrouted'
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes(records, { dispositionRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const expectedKeys = dispositionRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(dispositionRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => !outputByKey.has(key) || inputContextProjection(inputByKey.get(key)) !== outputContextProjection(outputByKey.get(key)));
  const invalidInputRecords = dispositionRecords.filter(record =>
    record.contract !== policy.inputContract
    || !record.contentHash
    || !record.sourceSignatureContentHash
    || record.accountIndependent !== true
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const routeMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || JSON.stringify(record.routingDecision) !== JSON.stringify(expectedRoute(input, policy));
  }).map(record => record.memberCandidateKey);
  const forbiddenPaths = forbiddenPolicyPaths(policy);
  const invalidRoutes = invalidRouteDefinitions(policy);
  const observedBlockedStates = sorted(unique(dispositionRecords.filter(record => record.sourcePageSubjectDisposition?.state !== 'source_signature_supported').map(record => record.sourcePageSubjectDisposition?.state || 'missing')));
  const observedSupportedClasses = sorted(unique(dispositionRecords.filter(record => record.sourcePageSubjectDisposition?.state === 'source_signature_supported').map(record => record.sourcePageSubjectDisposition?.disposition || 'missing')));
  const unmappedStates = observedBlockedStates.filter(state => !policy.stateRoutes?.[state]);
  const unmappedSubjectClasses = observedSupportedClasses.filter(subjectClass => !policy.subjectClassRoutes?.[subjectClass]);
  const invalidRuleKinds = records.filter(record => !['disposition_state', 'source_page_subject_class'].includes(record.routingDecision?.policyRuleKind)).map(record => record.memberCandidateKey);
  const collectionOrIdentityDerivedRouting = records.filter(record => {
    const decision = record.routingDecision || {};
    return decision.membershipClassification !== undefined
      || decision.collectionContext !== undefined
      || decision.collectionDisplayLabel !== undefined
      || decision.resolvedTitle !== undefined
      || decision.sourcePageId !== undefined
      || decision.links !== undefined;
  }).map(record => record.memberCandidateKey);
  const blockedStateRouteMismatches = records.filter(record => record.sourcePageSubjectDisposition?.state !== 'source_signature_supported' && !record.routingDecision?.routeState?.startsWith('blocked_')).map(record => record.memberCandidateKey);
  const supportedClassRouteMismatches = records.filter(record => record.sourcePageSubjectDisposition?.state === 'source_signature_supported' && record.routingDecision?.routeState !== 'queued').map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.collectionActivityIdentityReview?.state !== 'unreviewed'
    || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed'
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const routeCounts = {};
  const routeStateCounts = {};
  for (const record of records) {
    const routeKey = record.routingDecision?.routeKey || 'unrouted';
    const routeState = record.routingDecision?.routeState || 'missing';
    routeCounts[routeKey] = (routeCounts[routeKey] || 0) + 1;
    routeStateCounts[routeState] = (routeStateCounts[routeState] || 0) + 1;
  }
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_source_signature_disposition_records');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_relationship_work_route_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_disposition_signal_collection_membership_or_alias_contexts_changed');
  if (invalidInputRecords.length) structuralBlockers.push('one_or_more_input_source_signature_dispositions_failed_structural_integrity');
  if (forbiddenPaths.length) structuralBlockers.push('page_specific_collection_class_or_override_relationship_routing_policy_forbidden');
  if (invalidRoutes.length) structuralBlockers.push('one_or_more_relationship_work_route_definitions_invalid');
  if (unmappedStates.length || unmappedSubjectClasses.length) structuralBlockers.push('one_or_more_disposition_states_or_source_page_subject_classes_have_no_generic_route');
  if (routeMismatches.length || invalidRuleKinds.length || blockedStateRouteMismatches.length || supportedClassRouteMismatches.length) structuralBlockers.push('one_or_more_relationship_work_routing_decisions_do_not_match_policy');
  if (collectionOrIdentityDerivedRouting.length) structuralBlockers.push('collection_context_links_or_page_identity_used_to_select_or_alter_relationship_work_route');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_relationship_work_routes');
  const routingCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers,
    'routed_relationship_and_activity_scope_evidence_work_not_completed',
    'collection_activity_identity_not_established',
    'linked_subject_relationship_review_pending',
    'canonical_game_entity_and_activity_identities_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  ];
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-unresolved-subject-relationship-work-routing-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedDispositionRecordCount: expectedKeys.length,
      routingRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: invalidInputRecords,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: policy.policy || null,
      stateRouteCount: Object.keys(policy.stateRoutes || {}).length,
      subjectClassRouteCount: Object.keys(policy.subjectClassRoutes || {}).length,
      forbiddenPolicyPaths: forbiddenPaths,
      invalidRouteDefinitions: invalidRoutes,
      observedBlockedDispositionStates: observedBlockedStates,
      observedSupportedSourcePageSubjectClasses: observedSupportedClasses,
      unmappedDispositionStates: unmappedStates,
      unmappedSourcePageSubjectClasses: unmappedSubjectClasses,
      invalidPolicyRuleKindMemberCandidateKeys: invalidRuleKinds,
      collectionContextLinkOrPageIdentityDerivedRoutingMemberCandidateKeys: collectionOrIdentityDerivedRouting
    },
    routingCoverage: {
      routedCount: records.filter(record => record.routingDecision?.routeKey).length,
      queuedCount: records.filter(record => record.routingDecision?.routeState === 'queued').length,
      blockedRouteCount: records.filter(record => record.routingDecision?.routeState?.startsWith('blocked_')).length,
      routeCounts: Object.fromEntries(Object.entries(routeCounts).sort((a, b) => a[0].localeCompare(b[0]))),
      routeStateCounts: Object.fromEntries(Object.entries(routeStateCounts).sort((a, b) => a[0].localeCompare(b[0]))),
      routeMismatchMemberCandidateKeys: routeMismatches,
      blockedStateRouteMismatchMemberCandidateKeys: blockedStateRouteMismatches,
      supportedClassRouteMismatchMemberCandidateKeys: supportedClassRouteMismatches
    },
    semanticPromotionCoverage: {
      collectionActivityIdentityReviewedCount: records.filter(record => record.collectionActivityIdentityReview?.state !== 'unreviewed').length,
      linkedSubjectRelationshipReviewedCount: records.filter(record => record.linkedSubjectRelationshipReview?.state !== 'unreviewed').length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    routingCoverageComplete,
    evidenceWorkComplete: false,
    sourcePageSubjectDispositionComplete: dispositionRecords.every(record => record.sourcePageSubjectDisposition?.state === 'source_signature_supported'),
    collectionActivityIdentityReviewComplete: false,
    linkedSubjectRelationshipReviewComplete: false,
    repeatabilityReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: routingCoverageComplete
  };
}
