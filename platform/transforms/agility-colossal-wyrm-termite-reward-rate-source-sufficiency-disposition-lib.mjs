import { hash, json } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'inputAuditSnapshotAndPolicyMustBeExplicitAndRevalidated',
  'everyInputBlockerMustMapToExactlyOneEvidenceObjective',
  'everyInputSignalMustReceiveExactlyOneSemanticAndAuthorityDisposition',
  'resolutionCandidatesRequireBothDeclaredSignalKindAndCurrentAuthorityClass',
  'sourceTitlesPageIdsSearchRanksAndQueryCountsCannotDetermineSufficiency',
  'explicitUnknownStatementsConfirmRatherThanResolveBlockers',
  'experimentalDiscussionCannotResolveMechanics',
  'historicalUpdateEvidenceCannotEstablishCurrentStateAlone',
  'sourceCodeEvidenceRequiresIndependentCurrentSemanticValidation',
  'currentContextAndRepeatedClaimsAreInsufficientWithoutTheRequiredShape',
  'potentialResolutionEvidenceStillRequiresManualSemanticReview',
  'searchAbsenceIsOnlyBoundedDiscoveryAbsence',
  'allUnresolvedDomainsMustRouteToAdditionalEvidenceAndRevisionMonitoring',
  'blockersFactsMechanicsAndOptimizerStateCannotChange',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];
const EXPECTED_SIGNAL_SEMANTICS = {
  potential_exact_spawn_rate: 'potential_exact_mechanic',
  potential_reward_reconciliation: 'potential_current_reconciliation',
  explicit_unknown_spawn_rate: 'explicit_blocker_confirmation',
  experimental_per_completion_average: 'experimental_context',
  current_scoop_range: 'current_context_not_resolution',
  hourly_reward_claim: 'current_conflicting_claim_context',
  course_duration_or_lap_context: 'current_condition_context',
  official_relative_reward_adjustment: 'historical_relative_change_context'
};
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const recordsHash = records => hash(`${records.map(record => json(record)).join('\n')}\n`);
const accountKey = key => /^(?:account|accountState|accountSnapshot|player|playerState|username|profile|currentBaseLevel|currentLevel|currentXp|bank|owned|ownedItems|ownedEquipment|inventory|budget|preferences|completedQuests)$/i.test(key);

function accountFindings(values = []) {
  const findings = [];
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (accountKey(key)) findings.push(next);
      visit(child, next);
    }
  };
  values.forEach((value, index) => visit(value, `[${index}]`));
  return sorted(unique(findings));
}

function recordHashesValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && validHash(record?.contentHash)
    && record.recordContentHash === contentHash(without(record, ['recordContentHash', 'contentHash']))
    && record.contentHash === contentHash(without(record, ['contentHash']));
}

function policyCoverage(policy = {}, inputPolicy = {}, contentHash = hash) {
  const expectedBindings = {
    policy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-policy.v1',
    inputAuditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-audit.v1',
    inputSnapshotDomain: 'agility-colossal-wyrm-termite-reward-rate-source-discovery',
    inputRecordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery.v1',
    inputPolicy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-policy.v1',
    recordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition.v1',
    auditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-audit.v1',
    outputDomain: 'agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition'
  };
  const invalidBindings = Object.entries(expectedBindings).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const inputPolicyBindingValid = inputPolicy.policy === policy.inputPolicy
    && validHash(policy.inputPolicyContentHash)
    && contentHash(inputPolicy) === policy.inputPolicyContentHash;
  const signalSemanticsExact = same(policy.signalSemantics, EXPECTED_SIGNAL_SEMANTICS);
  const blockerRules = policy.blockerRules || [];
  const blockerRulesValid = blockerRules.length === 3 && blockerRules.every(rule => {
    try { new RegExp(rule.pattern); } catch { return false; }
    return Boolean(rule.evidenceObjective && rule.requiredEvidenceShape && rule.requiredSignalKinds?.length
      && rule.acceptedCurrentAuthorityClasses?.length
      && rule.requiredSignalKinds.every(kind => Object.hasOwn(EXPECTED_SIGNAL_SEMANTICS, kind)));
  });
  const forbiddenSelectors = [];
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (/^(?:title|titles|pageId|pageIds|revision|revisions|sourceKey|sourceKeys|queryKey|queryKeys|searchRank|searchRanks)$/i.test(key)) forbiddenSelectors.push(next);
      visit(child, next);
    }
  };
  visit({ blockerRules: policy.blockerRules, signalSemantics: policy.signalSemantics });
  return {
    valid: !invalidBindings.length && !invalidRules.length && inputPolicyBindingValid
      && signalSemanticsExact && blockerRulesValid && !forbiddenSelectors.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    inputPolicyBindingValid,
    signalSemanticsExact,
    blockerRulesValid,
    forbiddenSelectors: sorted(unique(forbiddenSelectors))
  };
}

function inputCoverage(discoveryAudit = {}, discoveryManifest = {}, discoveryRecords = [], inputPolicy = {}, policy = {}, contentHash = hash) {
  const auditHashValid = validHash(discoveryAudit.contentHash)
    && contentHash(without(discoveryAudit, ['contentHash'])) === discoveryAudit.contentHash;
  const manifestHashValid = validHash(discoveryManifest.contentHash)
    && discoveryManifest.contentHash === recordsHash(discoveryRecords);
  const outputBindingValid = discoveryAudit.outputSnapshot?.directory === discoveryManifest.snapshotDirectory
    && discoveryAudit.outputSnapshot?.contentHash === discoveryManifest.contentHash
    && Number(discoveryAudit.outputSnapshot?.records) === Number(discoveryManifest.records);
  const auditPolicyBindingValid = discoveryAudit.policy?.id === policy.inputPolicy
    && discoveryAudit.policy?.contentHash === policy.inputPolicyContentHash;
  const manifestPolicyBindingValid = discoveryManifest.source?.policy?.id === policy.inputPolicy
    && discoveryManifest.source?.policy?.contentHash === policy.inputPolicyContentHash;
  const recordsValid = discoveryRecords.length === 6
    && discoveryRecords.every(record => record.contract === policy.inputRecordContract && recordHashesValid(record, contentHash));
  const blockers = discoveryRecords.map(record => record.blocker);
  const blockerSetUnique = unique(blockers).length === blockers.length;
  const signalCount = discoveryRecords.reduce((sum, record) => sum + (record.potentialEvidenceSignals || []).length, 0);
  const discoveryAuditClaimsValid = discoveryAudit.queryBoundedDiscoveryComplete === true
    && discoveryAudit.authorityBoundary?.mechanicallyResolvedBlockers === 0
    && discoveryAudit.authorityBoundary?.blockersClosed === 0
    && discoveryAudit.authorityBoundary?.semanticFactsCreated === 0
    && discoveryAudit.authorityBoundary?.optimizerEligibleRecords === 0
    && discoveryAudit.authorityBoundary?.verifiedBestAuthorizations === 0
    && discoveryAudit.authorityBoundary?.automaticVerifications === 0
    && discoveryAudit.signalCoverage?.totalSignals === signalCount;
  const valid = discoveryAudit.contract === policy.inputAuditContract && discoveryAudit.publishable === true
    && auditHashValid && discoveryManifest.contract === 'sensum.ingestion-manifest.v1'
    && discoveryManifest.domain === policy.inputSnapshotDomain
    && Number(discoveryManifest.records) === discoveryRecords.length && manifestHashValid
    && outputBindingValid && auditPolicyBindingValid && manifestPolicyBindingValid
    && inputPolicy.policy === policy.inputPolicy && contentHash(inputPolicy) === policy.inputPolicyContentHash
    && recordsValid && blockerSetUnique && discoveryAuditClaimsValid;
  return {
    valid,
    auditContractValid: discoveryAudit.contract === policy.inputAuditContract,
    auditPublishable: discoveryAudit.publishable === true,
    auditContentHashValid: auditHashValid,
    manifestContractValid: discoveryManifest.contract === 'sensum.ingestion-manifest.v1',
    manifestDomainValid: discoveryManifest.domain === policy.inputSnapshotDomain,
    manifestRecordCountValid: Number(discoveryManifest.records) === discoveryRecords.length,
    manifestContentHashValid: manifestHashValid,
    outputSnapshotBindingValid: outputBindingValid,
    auditPolicyBindingValid,
    manifestPolicyBindingValid,
    inputPolicyBindingValid: inputPolicy.policy === policy.inputPolicy && contentHash(inputPolicy) === policy.inputPolicyContentHash,
    discoveryRecordCount: discoveryRecords.length,
    discoveryRecordHashesValid: recordsValid,
    blockerSetUnique,
    inputSignalCount: signalCount,
    discoveryAuditClaimsValid
  };
}

function ruleFor(blocker, policy = {}) {
  const matches = (policy.blockerRules || []).filter(rule => new RegExp(rule.pattern).test(blocker));
  return { matches, rule: matches.length === 1 ? matches[0] : null };
}

function authorityDisposition(signal = {}) {
  if (signal.authorityClass === 'experimental_discussion') return 'experimental_non_authoritative';
  if (signal.authorityClass === 'historical_update_archive') return 'historical_requires_current_head_reconciliation';
  if (signal.authorityClass === 'implementation_or_template_source') return 'source_code_requires_independent_current_semantic_validation';
  if (signal.authorityClass === 'current_article') return 'current_article_subject_to_required_shape_review';
  return 'unknown_authority_class';
}

function assessSignal(signal, rule, policy = {}) {
  const semanticDisposition = policy.signalSemantics?.[signal.signalKind] || 'unknown_signal_semantics';
  const authority = authorityDisposition(signal);
  const requiredShapeKind = Boolean(rule?.requiredSignalKinds?.includes(signal.signalKind));
  const acceptedCurrentAuthority = Boolean(rule?.acceptedCurrentAuthorityClasses?.includes(signal.authorityClass));
  const resolutionCandidate = requiredShapeKind && acceptedCurrentAuthority;
  let disposition = 'corroborating_context_not_resolution';
  if (resolutionCandidate) disposition = 'potential_resolution_evidence_requires_manual_semantic_review';
  else if (semanticDisposition === 'explicit_blocker_confirmation') disposition = 'current_source_confirms_blocker_remains_open';
  else if (authority === 'experimental_non_authoritative') disposition = 'experimental_context_not_mechanical_authority';
  else if (authority === 'historical_requires_current_head_reconciliation') disposition = 'historical_context_not_current_state_authority';
  else if (authority === 'source_code_requires_independent_current_semantic_validation') disposition = 'source_code_context_requires_independent_current_validation';
  return {
    signalKind: signal.signalKind,
    semanticDisposition,
    authorityDisposition: authority,
    requiredShapeKind,
    acceptedCurrentAuthority,
    resolutionCandidate,
    disposition,
    source: {
      pageId: signal.pageId,
      title: signal.title,
      sourceRevision: signal.sourceRevision,
      sourceTimestamp: signal.sourceTimestamp,
      sourceUrl: signal.sourceUrl,
      line: signal.line,
      excerpt: signal.excerpt,
      sourceChannel: signal.sourceChannel,
      authorityClass: signal.authorityClass
    }
  };
}

function evidenceWork(rule, hasResolutionCandidate) {
  const work = hasResolutionCandidate
    ? ['manual_semantic_review_of_exact_revision_bound_candidate', 'independent_current_authoritative_corroboration']
    : [`collect_revision_pinned_${rule?.evidenceObjective || 'unmapped'}_evidence`];
  return [...work, 'monitor_all_discovered_source_revisions', 'rerun_the_same_policy_bound_queries_on_relevant_source_change'];
}

function constructRecords({ discoveryAudit = {}, discoveryManifest = {}, discoveryRecords = [], policy = {}, contentHash = hash }) {
  return discoveryRecords.map(input => {
    const mapping = ruleFor(input.blocker, policy);
    const rule = mapping.rule;
    const signalAssessments = (input.potentialEvidenceSignals || []).map(signal => assessSignal(signal, rule, policy));
    const resolutionCandidateSignals = signalAssessments.filter(assessment => assessment.resolutionCandidate);
    const corroboratingOrBlockingSignals = signalAssessments.filter(assessment => !assessment.resolutionCandidate);
    const explicitBlockerConfirmations = signalAssessments.filter(assessment => assessment.semanticDisposition === 'explicit_blocker_confirmation').length;
    const manualSemanticReviewRequired = resolutionCandidateSignals.length > 0;
    let sufficiencyDisposition = 'blocked_required_evidence_shape_not_found_in_declared_bounded_discovery';
    if (manualSemanticReviewRequired) sufficiencyDisposition = 'blocked_potential_resolution_evidence_requires_manual_semantic_review';
    else if (explicitBlockerConfirmations > 0) sufficiencyDisposition = 'blocked_current_source_explicitly_confirms_missing_mechanic';
    const base = {
      contract: policy.recordContract,
      field: input.field,
      route: input.route,
      blocker: input.blocker,
      evidenceObjective: rule?.evidenceObjective || null,
      requiredEvidenceShape: rule?.requiredEvidenceShape || null,
      inputDiscoveryContentHash: discoveryAudit.contentHash,
      inputSnapshot: { directory: discoveryManifest.snapshotDirectory, contentHash: discoveryManifest.contentHash, records: discoveryManifest.records },
      signalAssessments,
      resolutionCandidateSignals,
      corroboratingOrBlockingSignals,
      sufficiencyDisposition,
      manualSemanticReviewRequired,
      nextEvidenceWork: evidenceWork(rule, manualSemanticReviewRequired),
      existingBlockerPreserved: true,
      mechanicallyResolved: false,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligible: false,
      verifiedBestAuthorized: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      completeWikiUniverseClaimed: false
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
}

export function auditAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policy = options.policy || {};
  const policyValidation = policyCoverage(policy, options.inputPolicy, contentHash);
  const inputLineage = inputCoverage(options.discoveryAudit, options.discoveryManifest, options.discoveryRecords, options.inputPolicy, policy, contentHash);
  const expected = constructRecords({ ...options, contentHash });
  const recordsMatchExpected = same(records, expected);
  const recordHashesAreValid = records.every(record => recordHashesValid(record, contentHash));
  const inputBlockers = sorted((options.discoveryRecords || []).map(record => record.blocker));
  const outputBlockers = sorted(records.map(record => record.blocker));
  const blockerSetExact = same(inputBlockers, outputBlockers) && unique(outputBlockers).length === outputBlockers.length;
  const mappings = (options.discoveryRecords || []).map(record => ({ blocker: record.blocker, count: ruleFor(record.blocker, policy).matches.length }));
  const everyBlockerMappedOnce = mappings.length === 6 && mappings.every(mapping => mapping.count === 1);
  const inputSignals = (options.discoveryRecords || []).reduce((sum, record) => sum + (record.potentialEvidenceSignals || []).length, 0);
  const assessments = records.flatMap(record => record.signalAssessments || []);
  const everySignalClassifiedOnce = assessments.length === inputSignals
    && assessments.every(assessment => assessment.semanticDisposition !== 'unknown_signal_semantics'
      && assessment.authorityDisposition !== 'unknown_authority_class');
  const resolutionCandidates = assessments.filter(assessment => assessment.resolutionCandidate);
  const resolutionCandidateRuleValid = resolutionCandidates.every(assessment => assessment.requiredShapeKind === true
    && assessment.acceptedCurrentAuthority === true
    && assessment.authorityDisposition === 'current_article_subject_to_required_shape_review'
    && assessment.disposition === 'potential_resolution_evidence_requires_manual_semantic_review');
  const unsafeNonCurrentResolutionCandidates = resolutionCandidates.filter(assessment => assessment.source.authorityClass !== 'current_article');
  const sufficiencyDispositionsComplete = records.length === 6 && records.every(record => record.sufficiencyDisposition?.startsWith('blocked_')
    && record.nextEvidenceWork?.includes('monitor_all_discovered_source_revisions')
    && record.nextEvidenceWork?.includes('rerun_the_same_policy_bound_queries_on_relevant_source_change'));
  const forbiddenPromotions = records.filter(record => record.existingBlockerPreserved !== true
    || record.mechanicallyResolved !== false || record.blockersClosed !== 0 || record.semanticFactsCreated !== 0
    || record.optimizerEligible !== false || record.verifiedBestAuthorized !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false);
  const accountStateFindings = accountFindings([options.discoveryAudit, options.discoveryManifest, options.discoveryRecords, records]);
  const blockers = [];
  if (!policyValidation.valid) blockers.push('source_sufficiency_disposition_policy_invalid');
  if (!inputLineage.valid) blockers.push('source_discovery_input_lineage_invalid');
  if (!blockerSetExact) blockers.push('input_output_blocker_set_mismatch');
  if (!everyBlockerMappedOnce) blockers.push('one_or_more_blockers_unmapped_or_ambiguously_mapped');
  if (!everySignalClassifiedOnce) blockers.push('one_or_more_input_signals_unclassified_or_duplicated');
  if (!resolutionCandidateRuleValid || unsafeNonCurrentResolutionCandidates.length) blockers.push('resolution_candidate_semantic_or_authority_rule_violated');
  if (!sufficiencyDispositionsComplete) blockers.push('one_or_more_domains_missing_blocked_disposition_or_evidence_route');
  if (!recordsMatchExpected) blockers.push('records_do_not_match_exact_source_bound_reconstruction');
  if (!recordHashesAreValid) blockers.push('one_or_more_record_hashes_invalid');
  if (forbiddenPromotions.length) blockers.push('source_sufficiency_disposition_created_unsupported_fact_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('account_query_state_baked_into_source_sufficiency_disposition');
  const publishable = blockers.length === 0;
  return {
    contract: policy.auditContract,
    policyValidation,
    inputLineage,
    blockerCoverage: { input: inputBlockers, output: outputBlockers, exact: blockerSetExact, mappings, everyBlockerMappedOnce },
    signalClassification: {
      inputSignalCount: inputSignals,
      assessmentCount: assessments.length,
      everySignalClassifiedOnce,
      semanticDispositions: Object.fromEntries(sorted(unique(assessments.map(assessment => assessment.semanticDisposition))).map(kind => [kind, assessments.filter(assessment => assessment.semanticDisposition === kind).length])),
      authorityDispositions: Object.fromEntries(sorted(unique(assessments.map(assessment => assessment.authorityDisposition))).map(kind => [kind, assessments.filter(assessment => assessment.authorityDisposition === kind).length])),
      resolutionCandidateCount: resolutionCandidates.length,
      resolutionCandidateRuleValid,
      unsafeNonCurrentResolutionCandidateCount: unsafeNonCurrentResolutionCandidates.length
    },
    sufficiencyCoverage: {
      recordCount: records.length,
      blockedDispositionCount: records.filter(record => record.sufficiencyDisposition?.startsWith('blocked_')).length,
      explicitBlockerConfirmationDomains: records.filter(record => record.sufficiencyDisposition === 'blocked_current_source_explicitly_confirms_missing_mechanic').length,
      requiredShapeNotFoundDomains: records.filter(record => record.sufficiencyDisposition === 'blocked_required_evidence_shape_not_found_in_declared_bounded_discovery').length,
      manualReviewDomains: records.filter(record => record.manualSemanticReviewRequired).length,
      sufficiencyDispositionsComplete
    },
    authorityBoundary: {
      mechanicallyResolvedBlockers: records.filter(record => record.mechanicallyResolved).length,
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      optimizerEligibleRecords: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizations: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerifications: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: accountStateFindings.length,
      completeWikiUniverseClaims: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    recordsMatchExpected,
    recordHashesValid: recordHashesAreValid,
    sourceSufficiencyDispositionComplete: publishable,
    sourceSufficiencyDispositionStable: publishable && resolutionCandidates.length === 0,
    mechanicalCompletenessProven: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_colossal_wyrm_reward_mechanics_not_authoritative',
    publishable,
    blockers
  };
}

export function buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(options = {}) {
  const contentHash = options.contentHash || hash;
  const records = constructRecords({ ...options, contentHash });
  const audit = auditAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(records, { ...options, contentHash });
  return { records: audit.publishable ? records : [], audit };
}

