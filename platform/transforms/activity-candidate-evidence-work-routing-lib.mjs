const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

function forbiddenPolicyKey(name) {
  return /^(?:pageId|pageIds|title|titles|candidateKey|candidateKeys|override|overrides)$/i.test(name);
}

export function compileActivityCandidateEvidenceWorkRoutingPolicy(policy = {}) {
  const pageSpecificPolicyPaths = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (forbiddenPolicyKey(name)) pageSpecificPolicyPaths.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return {
    policy: policy.policy || null,
    stateRoutes: new Map(Object.entries(policy.stateRoutes || {})),
    dispositionRoutes: new Map(Object.entries(policy.dispositionRoutes || {})),
    pageSpecificPolicyPaths
  };
}

export function findActivityCandidateEvidenceWorkRoutingAccountState(records = []) {
  const findings = [];
  const visit = (value, path, recordKey) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, recordKey));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ recordKey, path: childPath, value: child });
      visit(child, childPath, recordKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record?.candidateKey || `record-${index}`));
  return findings;
}

function selectRoute(record, compiledPolicy) {
  const sourceState = record.subjectDisposition?.state || null;
  const sourceDisposition = record.subjectDisposition?.disposition || null;
  if (sourceState !== 'source_supported') {
    const route = compiledPolicy.stateRoutes.get(sourceState) || null;
    return { route, policyRuleKind: 'source_state', policyRuleKey: sourceState };
  }
  const route = compiledPolicy.dispositionRoutes.get(sourceDisposition) || null;
  return { route, policyRuleKind: 'subject_disposition', policyRuleKey: sourceDisposition };
}

function routingDecision(record, compiledPolicy) {
  const selected = selectRoute(record, compiledPolicy);
  const route = selected.route;
  return {
    sourceState: record.subjectDisposition?.state || null,
    sourceDisposition: record.subjectDisposition?.disposition || null,
    conflictingSourceDispositions: record.subjectDisposition?.conflictingDispositions || [],
    policyRuleKind: selected.policyRuleKind,
    policyRuleKey: selected.policyRuleKey,
    routeState: route?.routeState || 'unrouted',
    routeKey: route?.routeKey || null,
    requiredEvidenceDomains: route?.requiredEvidenceDomains || [],
    expansionAxes: route?.expansionAxes || []
  };
}

export function buildActivityCandidateEvidenceWorkRoutes({ dispositionRecords = [], policy = {} }) {
  const compiled = compileActivityCandidateEvidenceWorkRoutingPolicy(policy);
  const records = dispositionRecords.map(dispositionRecord => {
    const decision = routingDecision(dispositionRecord, compiled);
    const blockers = [...(dispositionRecord.blockers || [])];
    blockers.push(decision.routeKey ? 'evidence_work_route_pending' : 'no_generic_evidence_work_route');
    if (decision.routeState.startsWith('blocked_')) blockers.push('evidence_work_route_blocked_by_source_state');
    return {
      contract: 'sensum.activity-candidate-evidence-work-routing.v1',
      candidateKey: dispositionRecord.candidateKey,
      sourcePageId: dispositionRecord.sourcePageId,
      resolvedTitle: dispositionRecord.resolvedTitle,
      skillKeys: sorted(dispositionRecord.skillKeys || []),
      statementKeys: sorted(dispositionRecord.statementKeys || []),
      sourceRevision: dispositionRecord.sourceRevision,
      sourceTimestamp: dispositionRecord.sourceTimestamp,
      sourceUrl: dispositionRecord.sourceUrl,
      sourceContentHash: dispositionRecord.sourceContentHash,
      sourceDispositionContentHash: dispositionRecord.contentHash,
      sourceSignatureContexts: dispositionRecord.sourceSignatureContexts || [],
      sourceDisposition: dispositionRecord.subjectDisposition,
      dispositionSignals: dispositionRecord.dispositionSignals || [],
      sourceBlockers: dispositionRecord.blockers || [],
      routingDecision: decision,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: decision.routeState === 'queued' ? 'evidence_work_routed' : 'blocked'
    };
  });
  return { records, audit: auditActivityCandidateEvidenceWorkRoutes(records, { dispositionRecords, policy }) };
}

const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const inputProjection = record => JSON.stringify({
  candidateKey: record.candidateKey,
  sourcePageId: record.sourcePageId,
  resolvedTitle: record.resolvedTitle,
  skillKeys: sorted(record.skillKeys || []),
  statementKeys: sorted(record.statementKeys || []),
  sourceRevision: String(record.sourceRevision || ''),
  sourceTimestamp: record.sourceTimestamp || null,
  sourceUrl: record.sourceUrl || null,
  sourceContentHash: record.sourceContentHash || null,
  sourceDispositionContentHash: record.contentHash || null,
  sourceSignatureContexts: record.sourceSignatureContexts || [],
  sourceDisposition: record.subjectDisposition || null,
  dispositionSignals: record.dispositionSignals || [],
  sourceBlockers: record.blockers || []
});
const outputProjection = record => JSON.stringify({
  candidateKey: record.candidateKey,
  sourcePageId: record.sourcePageId,
  resolvedTitle: record.resolvedTitle,
  skillKeys: sorted(record.skillKeys || []),
  statementKeys: sorted(record.statementKeys || []),
  sourceRevision: String(record.sourceRevision || ''),
  sourceTimestamp: record.sourceTimestamp || null,
  sourceUrl: record.sourceUrl || null,
  sourceContentHash: record.sourceContentHash || null,
  sourceDispositionContentHash: record.sourceDispositionContentHash || null,
  sourceSignatureContexts: record.sourceSignatureContexts || [],
  sourceDisposition: record.sourceDisposition || null,
  dispositionSignals: record.dispositionSignals || [],
  sourceBlockers: record.sourceBlockers || []
});

export function auditActivityCandidateEvidenceWorkRoutes(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const compiled = compileActivityCandidateEvidenceWorkRoutingPolicy(policy);
  const expectedKeys = dispositionRecords.map(record => record.candidateKey);
  const actualKeys = records.map(record => record.candidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(dispositionRecords.map(record => [record.candidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.candidateKey, record]));
  const identityRevisionHashSignalOrContextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || inputProjection(input) !== outputProjection(output);
  });
  const unmappedSourceStates = sorted(unique(dispositionRecords
    .filter(record => record.subjectDisposition?.state !== 'source_supported' && !compiled.stateRoutes.has(record.subjectDisposition?.state))
    .map(record => record.subjectDisposition?.state || 'missing')));
  const unmappedSubjectDispositions = sorted(unique(dispositionRecords
    .filter(record => record.subjectDisposition?.state === 'source_supported' && !compiled.dispositionRoutes.has(record.subjectDisposition?.disposition))
    .map(record => record.subjectDisposition?.disposition || 'missing')));
  const routeMismatches = records.filter(record => {
    const input = inputByKey.get(record.candidateKey);
    if (!input) return false;
    return JSON.stringify(record.routingDecision) !== JSON.stringify(routingDecision(input, compiled));
  }).map(record => record.candidateKey);
  const conflictRouteMismatches = records.filter(record => {
    const input = inputByKey.get(record.candidateKey);
    return input?.subjectDisposition?.state === 'blocked_conflicting_source_declarations'
      && (record.routingDecision?.routeState !== 'blocked_source_conflict' || record.routingDecision?.routeKey !== 'source_declaration_conflict_review');
  }).map(record => record.candidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed'
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.optimizerEligible === true
  ).map(record => record.candidateKey);
  const accountStateFindings = findActivityCandidateEvidenceWorkRoutingAccountState(records);
  const routeCounts = {};
  const routeStateCounts = {};
  const sourceStateCounts = {};
  const dispositionCounts = {};
  for (const record of records) {
    const routeKey = record.routingDecision?.routeKey || 'unrouted';
    const routeState = record.routingDecision?.routeState || 'missing';
    routeCounts[routeKey] = (routeCounts[routeKey] || 0) + 1;
    routeStateCounts[routeState] = (routeStateCounts[routeState] || 0) + 1;
  }
  for (const record of dispositionRecords) {
    const sourceState = record.subjectDisposition?.state || 'missing';
    sourceStateCounts[sourceState] = (sourceStateCounts[sourceState] || 0) + 1;
    const disposition = record.subjectDisposition?.disposition;
    if (disposition) dispositionCounts[disposition] = (dispositionCounts[disposition] || 0) + 1;
  }
  const structuralBlockers = [];
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_candidate_sets_do_not_match_exactly');
  if (identityRevisionHashSignalOrContextMismatches.length) structuralBlockers.push('one_or_more_input_identity_revision_hash_signal_or_context_values_changed');
  if (compiled.pageSpecificPolicyPaths.length) structuralBlockers.push('page_specific_or_override_evidence_work_routing_policy_forbidden');
  if (unmappedSourceStates.length || unmappedSubjectDispositions.length) structuralBlockers.push('one_or_more_source_states_or_dispositions_have_no_generic_route');
  if (routeMismatches.length || conflictRouteMismatches.length) structuralBlockers.push('one_or_more_routing_decisions_do_not_match_policy');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_canonical_repeatability_member_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_evidence_work_routes');
  const routingCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const sourceConflictCount = dispositionRecords.filter(record => record.subjectDisposition?.state === 'blocked_conflicting_source_declarations').length;
  const blockers = [...structuralBlockers];
  if (sourceConflictCount) blockers.push('one_or_more_source_declaration_conflicts_remain');
  blockers.push(
    'routed_evidence_work_not_completed',
    'canonical_game_entity_and_activity_identities_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: 'sensum.activity-candidate-evidence-work-routing-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedDispositionRecordCount: expectedKeys.length,
      routingRecordCount: records.length,
      duplicateInputCandidateKeys: duplicateInputKeys,
      duplicateOutputCandidateKeys: duplicateOutputKeys,
      missingCandidateKeys: missingKeys,
      unexpectedCandidateKeys: unexpectedKeys,
      identityRevisionHashSignalOrContextMismatchCandidateKeys: identityRevisionHashSignalOrContextMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !identityRevisionHashSignalOrContextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policy,
      stateRouteCount: compiled.stateRoutes.size,
      dispositionRouteCount: compiled.dispositionRoutes.size,
      pageSpecificPolicyPaths: compiled.pageSpecificPolicyPaths,
      observedSourceStateCounts: sourceStateCounts,
      observedSupportedDispositionCounts: dispositionCounts,
      unmappedSourceStates,
      unmappedSubjectDispositions
    },
    routingCoverage: {
      routedCount: records.filter(record => record.routingDecision?.routeKey).length,
      queuedCount: records.filter(record => record.routingDecision?.routeState === 'queued').length,
      blockedRouteCount: records.filter(record => record.routingDecision?.routeState?.startsWith('blocked_')).length,
      sourceConflictCount,
      routeCounts,
      routeStateCounts,
      routeMismatchCandidateKeys: routeMismatches,
      conflictRouteMismatchCandidateKeys: conflictRouteMismatches
    },
    semanticPromotionCoverage: {
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    routingCoverageComplete,
    evidenceWorkComplete: false,
    subjectDispositionComplete: false,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: routingCoverageComplete
  };
}
