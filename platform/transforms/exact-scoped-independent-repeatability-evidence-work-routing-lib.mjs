import { hash } from '../ingestion/lib.mjs';

const DOMAINS = [
  'parent_activity_post_completion_reassignment_or_restart',
  'member_task_reselection_and_repeatability',
  'cooldown_reset_daily_or_session_limits',
  'finite_exhaustion_one_time_or_completion_lockout',
  'availability_and_assignment_eligibility_across_sessions',
  'independent_source_corroboration_or_conflict'
];

const REQUIRED_RULES = [
  'oneWorkOrderPerEligibleDisposition',
  'everyUnresolvedDomainReceivesExactlyOneBlockedWorkItem',
  'routeSelectionUsesOnlyAuditedStateAndRequiredSourceRoute',
  'sameLineExactSubjectAndPredicateAreMandatory',
  'parentAndMemberEvidenceObligationsRemainSeparate',
  'crossLineCrossSectionCrossPageAndCrossSourceJoinsAreForbidden',
  'workItemsDescribeEvidenceObligationsNotGameFacts',
  'routingCannotCompleteEvidenceOrCreateAVerdict',
  'inputEvidenceRevisionHashesDiscoveryAndDispositionsMustBePreserved',
  'namesTitlesPageIdsCandidateKeysLabelsAliasesAndOverridesCannotSelectOrAlterTheRoute',
  'memberMechanicsAndOptimizerPromotionAreForbidden',
  'currentAccountStateIsForbidden'
];

const STAGE_FIELDS = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceIndependentScopedActivityRepeatabilityEvidenceDispositionContentHash',
  'exactScopedIndependentRepeatabilityEvidenceWorkRouting',
  'exactScopedIndependentRepeatabilityEvidenceWorkReview'
]);

const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const preserved = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !STAGE_FIELDS.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const walk = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|label|labels|alias|aliases|override|overrides)$/i.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  walk(policy);
  return findings.sort();
}

export function compileExactScopedIndependentRepeatabilityEvidenceWorkRoutingPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidDomains = JSON.stringify(policy.requiredEvidenceDomains || []) === JSON.stringify(DOMAINS) ? [] : ['requiredEvidenceDomains'];
  const definitions = policy.domainWorkDefinitions || [];
  const duplicateDefinitions = duplicates(definitions.map(item => item.domainKey));
  const invalidDefinitions = [
    ...(definitions.length === DOMAINS.length ? [] : ['definition_count']),
    ...DOMAINS.filter((domain, index) => definitions[index]?.domainKey !== domain).map(domain => `missing_or_out_of_order:${domain}`),
    ...definitions.filter(item => !DOMAINS.includes(item.domainKey) || !item.evidenceObjective || !item.requiredChannels?.length).map(item => item.domainKey || 'missing')
  ];
  const invalidRoute = !policy.requiredSourceRoute?.routeKey || !String(policy.requiredSourceRoute?.routeState || '').startsWith('blocked_') ? ['requiredSourceRoute'] : [];
  const forbidden = forbiddenPolicyPaths(policy);
  return { invalidRules, invalidDomains, invalidDefinitions, duplicateDefinitions, invalidRoute, forbiddenPolicyPaths: forbidden, valid: !(invalidRules.length || invalidDomains.length || invalidDefinitions.length || duplicateDefinitions.length || invalidRoute.length || forbidden.length) };
}

function eligible(record, policy) {
  const disposition = record?.independentScopedActivityRepeatabilityDisposition;
  const next = record?.independentScopedActivityRepeatabilityNextEvidenceWork;
  const assessments = disposition?.evidenceDomainAssessments || [];
  return record?.contract === policy.inputContract
    && record?.state === policy.inputState
    && record?.accountIndependent === true
    && disposition?.state === policy.inputDispositionState
    && disposition?.repeatabilityVerdict === null
    && disposition?.parentActivityRepeatabilityVerdict === null
    && disposition?.memberTaskRepeatabilityVerdict === null
    && assessments.length === DOMAINS.length
    && assessments.every((assessment, index) => assessment.domainKey === DOMAINS[index] && assessment.resolved === false && assessment.domainVerdict === null)
    && next?.routeKey === policy.requiredSourceRoute.routeKey
    && next?.routeState === policy.requiredSourceRoute.routeState
    && next?.requireExactSameLineSubjectPredicateScope === true
    && next?.crossLineCrossPageAndCrossSourceJoinAllowed === false
    && JSON.stringify(next?.requiredEvidenceDomains || []) === JSON.stringify(DOMAINS)
    && record?.independentScopedActivityRepeatabilityReview?.evidenceWorkComplete === false
    && record?.memberExpansionReview?.state === 'unreviewed'
    && record?.mechanicsReview?.state === 'unreviewed'
    && record?.optimizerEligible === false;
}

export function selectExactScopedIndependentRepeatabilityEvidenceWorkRoutingInputs(records = [], policy = {}) {
  return records.filter(record => eligible(record, policy));
}

function expectedRecord(input, policy) {
  const definitions = policy.domainWorkDefinitions;
  const { contentHash: inputHash, blockers: inputBlockers = [], ...rest } = input;
  const items = definitions.map((definition, index) => ({
    workItemOrdinal: index + 1,
    domainKey: definition.domainKey,
    evidenceObjective: definition.evidenceObjective,
    requiredChannels: definition.requiredChannels,
    requireExactSameLineSubjectPredicateScope: true,
    crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed: false,
    evidenceKeys: [],
    evidenceWorkComplete: false,
    workState: 'blocked_pending_revision_pinned_exact_scoped_independent_evidence'
  }));
  return {
    contract: policy.recordContract,
    ...preserved(rest),
    sourceIndependentScopedActivityRepeatabilityEvidenceDispositionContentHash: inputHash,
    exactScopedIndependentRepeatabilityEvidenceWorkRouting: {
      routeKey: policy.requiredSourceRoute.routeKey,
      routeState: policy.requiredSourceRoute.routeState,
      policyRuleKind: 'audited_unresolved_independent_disposition_and_required_exact_scoped_source_route',
      requiredEvidenceDomains: DOMAINS,
      domainEvidenceWorkItems: items,
      sameLineExactSubjectPredicateRequired: true,
      parentAndMemberEvidenceObligationsSeparated: true,
      crossLineCrossSectionCrossPageAndCrossSourceJoinsAllowed: false,
      forbiddenSubstitutions: policy.forbiddenSubstitutions,
      evidenceWorkComplete: false
    },
    exactScopedIndependentRepeatabilityEvidenceWorkReview: {
      state: 'routed_blocked_exact_scoped_independent_evidence_not_collected',
      reviewedWorkItemCount: items.length,
      completedWorkItemCount: 0,
      unresolvedWorkItemCount: items.length,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceWorkComplete: false
    },
    accountIndependent: true,
    blockers: unique([
      ...inputBlockers,
      'exact_scoped_independent_repeatability_evidence_work_routed_not_completed',
      'all_repeatability_evidence_domains_remain_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'exact_scoped_independent_repeatability_evidence_work_routed_gates_closed'
  };
}

function accountStateFindings(records) {
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i;
  const findings = [];
  const walk = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  records.forEach((record, index) => walk(record, `[${index}]`));
  return findings;
}

export function auditExactScopedIndependentRepeatabilityEvidenceWorkRoutes(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const compiled = compileExactScopedIndependentRepeatabilityEvidenceWorkRoutingPolicy(policy);
  const inputs = selectExactScopedIndependentRepeatabilityEvidenceWorkRoutingInputs(dispositionRecords, policy);
  const expected = compiled.valid ? inputs.map(input => expectedRecord(input, policy)) : [];
  const inputKeys = inputs.map(record => record.memberCandidateKey);
  const outputKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const recordMismatches = records.filter(record => {
    const match = expected.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !match || hash(record) !== hash(match);
  }).map(record => record.memberCandidateKey);
  const upstreamMismatches = records.filter(record => {
    const input = inputs.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !input || hash(preserved(record)) !== hash(preserved(input));
  }).map(record => record.memberCandidateKey);
  const routeFailures = records.filter(record => {
    const route = record.exactScopedIndependentRepeatabilityEvidenceWorkRouting || {};
    const review = record.exactScopedIndependentRepeatabilityEvidenceWorkReview || {};
    const items = route.domainEvidenceWorkItems || [];
    return route.routeKey !== policy.requiredSourceRoute?.routeKey
      || route.routeState !== policy.requiredSourceRoute?.routeState
      || route.sameLineExactSubjectPredicateRequired !== true
      || route.parentAndMemberEvidenceObligationsSeparated !== true
      || route.crossLineCrossSectionCrossPageAndCrossSourceJoinsAllowed !== false
      || route.evidenceWorkComplete !== false
      || items.length !== DOMAINS.length
      || items.some((item, index) => item.domainKey !== DOMAINS[index] || item.evidenceWorkComplete !== false || !String(item.workState).startsWith('blocked_') || item.requireExactSameLineSubjectPredicateScope !== true || item.crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed !== false)
      || review.evidenceWorkComplete !== false
      || review.repeatabilityVerdict !== null;
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.optimizerEligible !== false
    || record.memberExpansionReview?.state === 'reviewed'
    || record.mechanicsReview?.state === 'reviewed'
    || record.exactScopedIndependentRepeatabilityEvidenceWorkReview?.completedWorkItemCount !== 0
    || record.independentScopedActivityRepeatabilityDisposition?.repeatabilityVerdict !== null
  ).map(record => record.memberCandidateKey);
  const accountFindings = accountStateFindings(records);
  const blockers = [];
  if (!compiled.valid) blockers.push('exact_scoped_evidence_work_routing_policy_invalid_or_activity_specific');
  if (dispositionRecords.length !== inputs.length || duplicateInputKeys.length) blockers.push('input_disposition_set_not_exactly_eligible_and_unique');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) blockers.push('input_output_route_set_mismatch');
  if (recordMismatches.length) blockers.push('one_or_more_routes_do_not_match_generic_policy');
  if (upstreamMismatches.length) blockers.push('input_evidence_revision_hash_discovery_or_disposition_changed');
  if (routeFailures.length) blockers.push('one_or_more_exact_scoped_routes_or_work_items_are_invalid');
  if (unsupportedPromotions.length) blockers.push('unsupported_evidence_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = blockers.length === 0;
  const items = records.flatMap(record => record.exactScopedIndependentRepeatabilityEvidenceWorkRouting?.domainEvidenceWorkItems || []);
  return {
    contract: policy.auditContract,
    inputCoverage: { inputDispositionRecordCount: dispositionRecords.length, eligibleDispositionRecordCount: inputs.length, routingRecordCount: records.length, duplicateInputKeys, duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys },
    policyCoverage: compiled,
    routingCoverage: { requiredWorkItemCount: records.length * DOMAINS.length, domainWorkItemCount: items.length, blockedWorkItemCount: items.filter(item => String(item.workState).startsWith('blocked_')).length, completedWorkItemCount: items.filter(item => item.evidenceWorkComplete).length, routeFailures, sameLineRequiredWorkItemCount: items.filter(item => item.requireExactSameLineSubjectPredicateScope).length, crossJoinAllowedWorkItemCount: items.filter(item => item.crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed).length },
    semanticPreservationCoverage: { recordMismatches, upstreamMismatches, unsupportedPromotions, parentAndMemberSeparatedCount: records.filter(record => record.exactScopedIndependentRepeatabilityEvidenceWorkRouting?.parentAndMemberEvidenceObligationsSeparated).length },
    accountStateFindings: accountFindings,
    routingCoverageComplete: publishable && records.length === inputs.length,
    evidenceWorkComplete: false,
    repeatabilityReviewComplete: false,
    memberExpansionComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers, 'exact_scoped_independent_repeatability_evidence_work_routed_not_completed', 'all_repeatability_evidence_domains_remain_unresolved', 'member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable
  };
}

export function buildExactScopedIndependentRepeatabilityEvidenceWorkRoutes({ dispositionRecords = [], policy = {} }) {
  const compiled = compileExactScopedIndependentRepeatabilityEvidenceWorkRoutingPolicy(policy);
  const records = compiled.valid ? selectExactScopedIndependentRepeatabilityEvidenceWorkRoutingInputs(dispositionRecords, policy).map(input => expectedRecord(input, policy)) : [];
  return { records, audit: auditExactScopedIndependentRepeatabilityEvidenceWorkRoutes(records, { dispositionRecords, policy }) };
}
