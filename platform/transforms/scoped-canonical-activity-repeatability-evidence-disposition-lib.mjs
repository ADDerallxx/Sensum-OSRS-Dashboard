import { createHash } from 'node:crypto';
import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const hashText = value => createHash('sha256').update(String(value)).digest('hex');
const expectedDomains = [
  'parent_activity_post_completion_reassignment_or_restart',
  'member_task_reselection_and_repeatability',
  'cooldown_reset_daily_or_session_limits',
  'finite_exhaustion_one_time_or_completion_lockout',
  'availability_and_assignment_eligibility_across_sessions',
  'independent_source_corroboration_or_conflict'
];
const expectedSignalKinds = [
  'explicit_repeatability_declaration_candidate',
  'recurrence_structure_candidate_not_repeatability_proof',
  'member_repeatability_declaration_candidate',
  'cooldown_reset_or_frequency_limit_candidate',
  'finite_exhaustion_or_lockout_candidate',
  'availability_or_assignment_condition_candidate',
  'independent_source_reference_candidate_not_corroboration'
];
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceScopedCanonicalActivityRepeatabilityEvidenceContentHash',
  'canonicalActivityRepeatabilityDispositionSignals',
  'canonicalActivityRepeatabilityDisposition',
  'canonicalActivityRepeatabilityReview',
  'canonicalActivityRepeatabilityNextEvidenceWork'
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

export function compileScopedCanonicalActivityRepeatabilityEvidenceDispositionPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneDispositionPerCompleteRepeatabilityEvidencePacket',
    'everySourceLocatedSignalReceivesExactlyOneGenericEvidenceRole',
    'signalRolesAreSelectedOnlyByTheAuditedSignalKind',
    'recurrenceStructuresDeclaredCountsAndPluralTasksCannotSupportRepeatability',
    'assignmentEligibilityDoesNotSupportCrossSessionAvailability',
    'citationPresenceDoesNotSupportIndependentCorroboration',
    'absenceOfMemberLimitExhaustionOrAvailabilitySignalsIsNotNegativeEvidence',
    'parentAndMemberRepeatabilityRemainSeparate',
    'missingExplicitPostCompletionRecurrenceRemainsBlocked',
    'missingExactMemberReselectionEvidenceRemainsBlocked',
    'everyUnresolvedDomainIsRoutedToIndependentEvidenceWork',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesScopeClassesAndOverridesCannotSelectOrAlterADisposition',
    'inputEvidenceIdentityRevisionHashesBindingScopeDispositionRoutingAndContextMustBePreserved',
    'repeatabilityVerdictsRemainNull',
    'memberMechanicsAndOptimizerPromotionAreForbidden',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract || !policy.inputState || !policy.requiredEvidenceState) invalidRules.push('repeatability_disposition_contract_boundary_missing');
  if (!String(policy.nextEvidenceRoute?.routeState || '').startsWith('blocked_') || !policy.nextEvidenceRoute?.routeKey) invalidRules.push('next_evidence_route_missing_or_not_blocked');
  const roleRules = policy.signalRoleRules || [];
  const duplicateSignalKinds = duplicates(roleRules.map(rule => rule.signalKind));
  const missingSignalKinds = expectedSignalKinds.filter(kind => !roleRules.some(rule => rule.signalKind === kind));
  const unexpectedSignalKinds = roleRules.filter(rule => !expectedSignalKinds.includes(rule.signalKind) || !rule.dispositionClass).map(rule => rule.signalKind || '(missing)');
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    duplicateSignalKinds,
    missingSignalKinds,
    unexpectedSignalKinds: unique(unexpectedSignalKinds),
    roleBySignalKind: new Map(roleRules.map(rule => [rule.signalKind, rule.dispositionClass])),
    roleRules,
    nextEvidenceRoute: policy.nextEvidenceRoute || {}
  };
}

function sourceSignals(record = {}) {
  return (record.canonicalActivityRepeatabilityEvidenceSources || []).flatMap(source => source.sourceLocatedSignals || []);
}

function packetIntegrity(record, policy) {
  const sources = record.canonicalActivityRepeatabilityEvidenceSources || [];
  const source = sources[0] || {};
  const identity = source.sourcePageIdentity || {};
  const binding = record.canonicalActivitySubjectBinding?.sourcePageIdentity || {};
  const lines = source.sourceLines || [];
  const text = source.exactRevisionSourceText;
  const reconstructed = lines.map(line => line.rawText).join('\n');
  const signals = sourceSignals(record);
  const domains = source.domainEvidence || [];
  const channels = source.captureChannels || [];
  const checks = {
    exactSingleCompleteSource: sources.length === 1 && source.state === 'complete_revision_pinned_scoped_activity_repeatability_source' && !(source.deficiencies || []).length,
    completePacketState: record.canonicalActivityRepeatabilityEvidence?.evidenceState === policy.requiredEvidenceState,
    exactIdentityMatchesBinding: ['sourcePageId', 'resolvedTitle', 'sourceRevision', 'sourceTimestamp', 'sourceUrl', 'sourceContentHash'].every(field => identity[field] === binding[field]),
    everyRevisionCheckPasses: Object.values(source.sourceRevisionVerification || {}).length > 0 && Object.values(source.sourceRevisionVerification || {}).every(Boolean),
    exactSourceTextHashMatches: typeof text === 'string' && hashText(text) === identity.sourceContentHash,
    exactLineInventoryReconstructsSource: typeof text === 'string' && reconstructed === text,
    everyLineHashLocatorAndOrdinalMatches: lines.length > 0 && lines.every((line, index) => line.ordinal === index + 1 && line.rawTextContentHash === hashText(line.rawText) && line.sourceLocator?.lineStart === index + 1 && line.sourceLocator?.lineEnd === index + 1),
    exactDomainSetComplete: JSON.stringify(domains.map(domain => domain.domainKey)) === JSON.stringify(expectedDomains) && domains.every(domain => domain.captureState === 'captured_for_semantic_disposition_not_a_repeatability_verdict' && domain.resolutionState === 'unresolved_pending_semantic_disposition_and_possible_independent_evidence'),
    everyCaptureChannelComplete: channels.length === record.canonicalActivityRepeatabilityEvidence?.requiredCaptureChannelCount && channels.every(channel => channel.complete === true),
    everySignalLocatedAndDomainAligned: signals.every(signal => expectedDomains.includes(signal.evidenceDomain) && expectedSignalKinds.includes(signal.signalKind) && signal.sourceRevision === identity.sourceRevision && signal.sourceContentHash === identity.sourceContentHash && signal.exactSourceLineContentHash === hashText(signal.exactSourceLine) && signal.reviewState === 'candidate_only_not_parent_or_member_repeatability_verdict'),
    signalCountMatchesPacket: signals.length === record.canonicalActivityRepeatabilityEvidence?.sourceLocatedSignalCount,
    allRepeatabilityVerdictsRemainNull: record.canonicalActivityRepeatabilityEvidence?.parentActivityRepeatabilityVerdict === null && record.canonicalActivityRepeatabilityEvidence?.memberTaskRepeatabilityVerdict === null && record.canonicalActivityRepeatabilityEvidence?.repeatabilityVerdict === null && record.canonicalActivityRepeatabilityEvidenceReview?.repeatabilityVerdict === null && source.repeatabilityVerdict === null
  };
  return { checks, complete: Object.values(checks).every(Boolean), signals, source };
}

export function selectScopedCanonicalActivityRepeatabilityEvidenceDispositionInputs(records = [], policy = {}) {
  return records.filter(record => record.contract === policy.inputContract
    && record.state === policy.inputState
    && record.canonicalActivityRepeatabilityEvidence?.evidenceState === policy.requiredEvidenceState
    && record.canonicalActivityRepeatabilityEvidenceReview?.state === 'unreviewed_complete_revision_pinned_repeatability_evidence_semantic_disposition_required'
    && record.canonicalActivityRepeatabilityEvidenceReview?.repeatabilityVerdict === null
    && record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === 'source_supported_composite_assigned_task_activity_scope'
    && record.canonicalActivityScopeReview?.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true);
}

function dispositionSignals(input, compiled) {
  return packetIntegrity(input, { requiredEvidenceState: input.canonicalActivityRepeatabilityEvidence?.evidenceState }).signals.map(signal => ({
    evidenceKey: signal.evidenceKey,
    evidenceDomain: signal.evidenceDomain,
    signalKind: signal.signalKind,
    dispositionClass: compiled.roleBySignalKind.get(signal.signalKind) || null,
    canSupportParentRepeatabilityVerdict: false,
    canSupportMemberRepeatabilityVerdict: false,
    exactSourceLocator: signal.sourceLocator,
    exactSourceLineContentHash: signal.exactSourceLineContentHash
  }));
}

function domainAssessment(domainKey, signals) {
  const domainSignals = signals.filter(signal => signal.evidenceDomain === domainKey);
  const count = domainSignals.length;
  const states = {
    parent_activity_post_completion_reassignment_or_restart: count
      ? 'assignment_or_recurrence_candidates_observed_without_post_completion_restart_proof'
      : 'no_parent_recurrence_signal_observed_not_negative_evidence',
    member_task_reselection_and_repeatability: count
      ? 'member_candidates_observed_without_exact_member_reselection_proof'
      : 'no_member_reselection_signal_observed_not_negative_evidence',
    cooldown_reset_daily_or_session_limits: count
      ? 'limit_candidates_observed_without_exact_activity_applicability_proof'
      : 'no_cooldown_reset_or_frequency_signal_observed_not_no_limit_evidence',
    finite_exhaustion_one_time_or_completion_lockout: count
      ? 'exhaustion_candidates_observed_without_exact_activity_applicability_proof'
      : 'no_exhaustion_or_lockout_signal_observed_not_repeatability_evidence',
    availability_and_assignment_eligibility_across_sessions: count
      ? 'assignment_eligibility_candidates_observed_without_cross_session_availability_proof'
      : 'no_cross_session_availability_signal_observed_not_unavailability_evidence',
    independent_source_corroboration_or_conflict: count
      ? 'reference_candidates_observed_without_independent_source_verification'
      : 'no_independent_reference_signal_observed_not_no_source_evidence'
  };
  return {
    domainKey,
    sourceLocatedSignalCount: count,
    signalEvidenceKeys: domainSignals.map(signal => signal.evidenceKey),
    dispositionState: states[domainKey],
    resolved: false,
    parentActivityRepeatabilityVerdict: null,
    memberTaskRepeatabilityVerdict: null
  };
}

function expectedRecord(input, policy) {
  const compiled = compileScopedCanonicalActivityRepeatabilityEvidenceDispositionPolicy(policy);
  const integrity = packetIntegrity(input, policy);
  const signalDispositions = dispositionSignals(input, compiled);
  const assessments = expectedDomains.map(domain => domainAssessment(domain, integrity.signals));
  const explicit = integrity.signals.filter(signal => signal.signalKind === 'explicit_repeatability_declaration_candidate').length;
  const structural = integrity.signals.filter(signal => signal.signalKind === 'recurrence_structure_candidate_not_repeatability_proof').length;
  const complete = integrity.complete && signalDispositions.every(signal => signal.dispositionClass);
  const deficiencies = unique([
    ...(!complete ? ['repeatability_evidence_packet_or_signal_disposition_incomplete'] : []),
    ...(explicit ? ['explicit_declaration_requires_exact_subject_predicate_and_recurrence_boundary_review'] : ['explicit_post_completion_parent_recurrence_declaration_not_observed']),
    'exact_member_task_reselection_or_repeatability_not_proven',
    'cooldown_reset_and_frequency_limits_not_resolved',
    'finite_exhaustion_or_completion_lockout_not_resolved',
    'cross_session_availability_not_resolved',
    'independent_exact_source_corroboration_or_conflict_not_resolved'
  ]);
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceScopedCanonicalActivityRepeatabilityEvidenceContentHash: input.contentHash,
    canonicalActivityRepeatabilityDispositionSignals: signalDispositions,
    canonicalActivityRepeatabilityDisposition: {
      state: complete ? 'blocked_parent_and_member_repeatability_not_proven' : 'blocked_incomplete_or_inconsistent_repeatability_evidence',
      classification: null,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      sourceRevisionKeys: (input.canonicalActivityRepeatabilityEvidenceSources || []).map(source => `${source.sourcePageIdentity?.sourcePageId}:${source.sourcePageIdentity?.sourceRevision}:${source.sourcePageIdentity?.sourceContentHash}`),
      signalEvidenceKeys: integrity.signals.map(signal => signal.evidenceKey),
      explicitRepeatabilityDeclarationCandidateCount: explicit,
      recurrenceStructureNotProofCount: structural,
      evidenceDomainAssessments: assessments,
      unresolvedEvidenceDomains: assessments.filter(assessment => !assessment.resolved).map(assessment => assessment.domainKey),
      sufficiencyChecks: integrity.checks,
      deficiencies
    },
    canonicalActivityRepeatabilityReview: {
      state: complete ? 'reviewed_blocked_insufficient_parent_and_member_repeatability_evidence' : 'reviewed_blocked_incomplete_or_inconsistent_repeatability_evidence',
      classification: null,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: integrity.signals.map(signal => signal.evidenceKey)
    },
    canonicalActivityRepeatabilityNextEvidenceWork: {
      state: 'required',
      routeKey: policy.nextEvidenceRoute?.routeKey || null,
      routeState: policy.nextEvidenceRoute?.routeState || null,
      requiredEvidenceDomains: assessments.filter(assessment => !assessment.resolved).map(assessment => assessment.domainKey),
      mustPreserveParentMemberSeparation: true
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => blocker !== 'scoped_canonical_activity_repeatability_evidence_requires_semantic_disposition'),
      ...deficiencies,
      'repeatability_classification_unresolved',
      'independent_scoped_activity_repeatability_evidence_work_not_completed',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'scoped_canonical_activity_repeatability_disposition_reviewed_unresolved'
  };
}

export function buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords = [], policy = {} }) {
  const inputs = selectScopedCanonicalActivityRepeatabilityEvidenceDispositionInputs(evidenceRecords, policy);
  const records = inputs.map(input => expectedRecord(input, policy));
  return { records, audit: auditScopedCanonicalActivityRepeatabilityEvidenceDispositions(records, { evidenceRecords, policy }) };
}

export function auditScopedCanonicalActivityRepeatabilityEvidenceDispositions(records = [], { evidenceRecords = [], policy = {} } = {}) {
  const compiled = compileScopedCanonicalActivityRepeatabilityEvidenceDispositionPolicy(policy);
  const inputs = selectScopedCanonicalActivityRepeatabilityEvidenceDispositionInputs(evidenceRecords, policy);
  const expected = inputs.map(input => expectedRecord(input, policy));
  const expectedKeys = inputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const inputByKey = new Map(inputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const duplicateInputKeys = duplicates(evidenceRecords.map(record => record.memberCandidateKey));
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const ineligibleKeys = evidenceRecords.filter(record => !inputs.includes(record)).map(record => record.memberCandidateKey);
  const invalidInputs = inputs.filter(input => !packetIntegrity(input, policy).complete).map(record => record.memberCandidateKey);
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || record.sourceScopedCanonicalActivityRepeatabilityEvidenceContentHash !== input.contentHash || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const dispositionMismatches = records.filter(record => {
    const wanted = expectedByKey.get(record.memberCandidateKey);
    return !wanted
      || JSON.stringify(record.canonicalActivityRepeatabilityDispositionSignals) !== JSON.stringify(wanted.canonicalActivityRepeatabilityDispositionSignals)
      || JSON.stringify(record.canonicalActivityRepeatabilityDisposition) !== JSON.stringify(wanted.canonicalActivityRepeatabilityDisposition)
      || JSON.stringify(record.canonicalActivityRepeatabilityReview) !== JSON.stringify(wanted.canonicalActivityRepeatabilityReview)
      || JSON.stringify(record.canonicalActivityRepeatabilityNextEvidenceWork) !== JSON.stringify(wanted.canonicalActivityRepeatabilityNextEvidenceWork)
      || JSON.stringify(record.blockers) !== JSON.stringify(wanted.blockers)
      || record.state !== wanted.state;
  }).map(record => record.memberCandidateKey);
  const inputSignalCount = inputs.reduce((sum, record) => sum + sourceSignals(record).length, 0);
  const outputSignalCount = records.reduce((sum, record) => sum + (record.canonicalActivityRepeatabilityDispositionSignals || []).length, 0);
  const invalidSignalRoles = records.flatMap(record => (record.canonicalActivityRepeatabilityDispositionSignals || []).filter(signal => !compiled.roleBySignalKind.has(signal.signalKind) || signal.dispositionClass !== compiled.roleBySignalKind.get(signal.signalKind) || signal.canSupportParentRepeatabilityVerdict !== false || signal.canSupportMemberRepeatabilityVerdict !== false));
  const invalidDomainAssessments = records.filter(record => {
    const assessments = record.canonicalActivityRepeatabilityDisposition?.evidenceDomainAssessments || [];
    return JSON.stringify(assessments.map(item => item.domainKey)) !== JSON.stringify(expectedDomains) || assessments.some(item => item.resolved !== false || item.parentActivityRepeatabilityVerdict !== null || item.memberTaskRepeatabilityVerdict !== null);
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.canonicalActivityRepeatabilityDisposition?.classification !== null
      || record.canonicalActivityRepeatabilityDisposition?.parentActivityRepeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityDisposition?.memberTaskRepeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityDisposition?.repeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityReview?.classification !== null
      || record.canonicalActivityRepeatabilityReview?.repeatabilityVerdict !== null
      || JSON.stringify(record.canonicalActivityScopeDisposition) !== JSON.stringify(input.canonicalActivityScopeDisposition)
      || JSON.stringify(record.canonicalActivityScopeReview) !== JSON.stringify(input.canonicalActivityScopeReview)
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!evidenceRecords.length) structuralBlockers.push('no_scoped_activity_repeatability_evidence_records');
  if (!inputs.length) structuralBlockers.push('no_complete_scoped_activity_repeatability_evidence_packets');
  if (ineligibleKeys.length) structuralBlockers.push('one_or_more_input_evidence_records_are_ineligible');
  if (invalidInputs.length) structuralBlockers.push('one_or_more_input_evidence_packets_failed_exact_integrity_revalidation');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_repeatability_disposition_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('upstream_repeatability_evidence_identity_revision_hash_scope_or_context_changed');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.duplicateSignalKinds.length || compiled.missingSignalKinds.length || compiled.unexpectedSignalKinds.length) structuralBlockers.push('repeatability_evidence_disposition_policy_invalid_or_activity_specific');
  if (dispositionMismatches.length || inputSignalCount !== outputSignalCount || invalidSignalRoles.length) structuralBlockers.push('one_or_more_signal_or_packet_dispositions_not_reproducible_from_generic_policy');
  if (invalidDomainAssessments.length) structuralBlockers.push('one_or_more_evidence_domains_lack_an_explicit_unresolved_disposition');
  if (unsupportedPromotions.length) structuralBlockers.push('repeatability_disposition_created_unsupported_parent_member_scope_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_scoped_activity_repeatability_dispositions');
  const dispositionAttemptCoverageComplete = records.length > 0 && structuralBlockers.length === 0;
  const repeatabilityClassificationCoverageComplete = dispositionAttemptCoverageComplete && records.every(record => record.canonicalActivityRepeatabilityDisposition?.classification !== null);
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputEvidenceRecordCount: evidenceRecords.length,
      eligibleEvidenceRecordCount: inputs.length,
      dispositionRecordCount: records.length,
      ineligibleMemberCandidateKeys: ineligibleKeys,
      invalidInputMemberCandidateKeys: invalidInputs,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      duplicateSignalKinds: compiled.duplicateSignalKinds,
      missingSignalKinds: compiled.missingSignalKinds,
      unexpectedSignalKinds: compiled.unexpectedSignalKinds,
      genericSignalRoleRuleCount: compiled.roleRules.length
    },
    signalDispositionCoverage: {
      inputSourceLocatedSignalCount: inputSignalCount,
      dispositionSignalCount: outputSignalCount,
      invalidSignalRoleCount: invalidSignalRoles.length,
      everyInputSignalDispositionedExactlyOnce: inputSignalCount === outputSignalCount && !invalidSignalRoles.length,
      dispositionMismatchMemberCandidateKeys: dispositionMismatches
    },
    domainDispositionCoverage: {
      requiredDomainCount: expectedDomains.length * records.length,
      dispositionedDomainCount: records.reduce((sum, record) => sum + Number(record.canonicalActivityRepeatabilityDisposition?.evidenceDomainAssessments?.length || 0), 0),
      resolvedDomainCount: records.reduce((sum, record) => sum + (record.canonicalActivityRepeatabilityDisposition?.evidenceDomainAssessments || []).filter(item => item.resolved).length, 0),
      unresolvedDomainCount: records.reduce((sum, record) => sum + (record.canonicalActivityRepeatabilityDisposition?.evidenceDomainAssessments || []).filter(item => !item.resolved).length, 0),
      invalidDomainAssessmentMemberCandidateKeys: invalidDomainAssessments,
      nextEvidenceWorkRoutedCount: records.filter(record => record.canonicalActivityRepeatabilityNextEvidenceWork?.state === 'required').length
    },
    semanticPreservationCoverage: {
      preservedCanonicalActivityScopeClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === 'source_supported_composite_assigned_task_activity_scope').length,
      parentActivityRepeatabilityClassificationCount: records.filter(record => record.canonicalActivityRepeatabilityReview?.parentActivityRepeatabilityVerdict !== null).length,
      memberTaskRepeatabilityClassificationCount: records.filter(record => record.canonicalActivityRepeatabilityReview?.memberTaskRepeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    dispositionAttemptCoverageComplete,
    repeatabilityClassificationCoverageComplete,
    repeatabilityReviewComplete: repeatabilityClassificationCoverageComplete,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(repeatabilityClassificationCoverageComplete ? [] : ['one_or_more_parent_or_member_repeatability_classifications_remain_unresolved']),
      'independent_scoped_activity_repeatability_evidence_work_not_completed',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: dispositionAttemptCoverageComplete
  };
}
