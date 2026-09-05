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
  'oneDispositionPerCompleteIndependentEvidencePacket',
  'everyCandidateSignalReceivesExactlyOneStructuralEvidenceRole',
  'sameLineExactSubjectAndPredicateAreRequiredForAUsableClaimCandidate',
  'collectionClassClaimsCannotBeJoinedToASeparateCollectionMemberRow',
  'reciprocalPageBacklinksCannotScopeOtherLinesToTheActivity',
  'crossLineCrossSectionCrossPageAndCrossSourceJoinsAreForbidden',
  'unrelatedCollectionMembersAndExamplesCannotSupplyActivityLimits',
  'absenceOfCandidateOrScopedClaimsIsNotNegativeEvidence',
  'lexicalCandidateKindsDoNotCreateSemanticVerdicts',
  'allSixDomainsRemainIndependentlyAssessed',
  'parentAndMemberRepeatabilityRemainSeparate',
  'everyUnresolvedDomainRoutesToExactScopedEvidenceWork',
  'namesTitlesPageIdsCandidateKeysLabelsAliasesAndOverridesCannotSelectOrAlterADisposition',
  'inputEvidenceRevisionHashesDiscoveryAndPriorDispositionsMustBePreserved',
  'repeatabilityVerdictsRemainNull',
  'memberMechanicsAndOptimizerPromotionAreForbidden',
  'currentAccountStateIsForbidden'
];

const STAGE_FIELDS = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceIndependentScopedActivityRepeatabilityEvidenceContentHash',
  'independentScopedActivityRepeatabilityDispositionSignals',
  'independentScopedActivityRepeatabilityDisposition',
  'independentScopedActivityRepeatabilityReview',
  'independentScopedActivityRepeatabilityNextEvidenceWork'
]);

const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !STAGE_FIELDS.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const walk = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|label|labels|alias|aliases|override|overrides)$/i.test(key)) findings.push(childPath);
      walk(child, childPath);
    }
  };
  walk(policy);
  return findings.sort();
}

export function compileIndependentScopedActivityRepeatabilityEvidenceDispositionPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const classes = policy.dispositionClasses || {};
  const requiredClasses = ['exactScopedCandidate', 'unscopedCollectionCandidate', 'unscopedReciprocalCandidate', 'unknownSourceCandidate'];
  const invalidClasses = requiredClasses.filter(key => !classes[key]);
  const invalidDomains = JSON.stringify(policy.requiredEvidenceDomains || []) === JSON.stringify(DOMAINS) ? [] : ['requiredEvidenceDomains'];
  const invalidRoute = !String(policy.nextEvidenceRoute?.routeState || '').startsWith('blocked_') || !policy.nextEvidenceRoute?.routeKey ? ['nextEvidenceRoute'] : [];
  const forbidden = forbiddenPolicyPaths(policy);
  return { invalidRules, invalidClasses, invalidDomains, invalidRoute, forbiddenPolicyPaths: forbidden, valid: !(invalidRules.length || invalidClasses.length || invalidDomains.length || invalidRoute.length || forbidden.length) };
}

function selectorMatches(record, policy) {
  const evidence = record?.independentScopedActivityRepeatabilityEvidence;
  const review = record?.independentScopedActivityRepeatabilityEvidenceReview;
  return record?.contract === policy.inputContract
    && record?.state === policy.inputState
    && record?.accountIndependent === true
    && evidence?.evidenceState === policy.requiredEvidenceState
    && evidence?.sourceDiscovery?.definedDiscoveryScopeComplete === true
    && evidence?.sourceDiscovery?.completeIndependentSourceUniverse === false
    && review?.state === policy.requiredReviewState
    && review?.evidenceWorkComplete === false
    && evidence?.parentActivityRepeatabilityVerdict === null
    && evidence?.memberTaskRepeatabilityVerdict === null
    && evidence?.repeatabilityVerdict === null
    && record?.memberExpansionReview?.state === 'unreviewed'
    && record?.mechanicsReview?.state === 'unreviewed'
    && record?.optimizerEligible === false;
}

export function selectIndependentScopedActivityRepeatabilityEvidenceDispositionInputs(records = [], policy = {}) {
  return records.filter(record => selectorMatches(record, policy));
}

function packetIntegrity(record, policy) {
  const evidence = record?.independentScopedActivityRepeatabilityEvidence || {};
  const sources = evidence.independentSources || [];
  const signals = evidence.sourceLocatedCandidateSignals || [];
  const packets = evidence.evidenceDomainPackets || [];
  const sourceKeys = new Set(sources.map(source => `${source.sourcePageId}:${source.sourceRevision}:${source.sourceContentHash}`));
  const sourceByIdentity = new Map(sources.map(source => [`${source.sourcePageId}:${source.sourceRevision}:${source.sourceContentHash}`, source]));
  const sourceChecks = sources.map(source => {
    const lines = String(source.exactRevisionSourceText || '').split(/\r?\n/);
    return {
      sourceKey: source.sourceKey,
      complete: Boolean(source.sourcePageId && source.sourceTitle && source.sourceRevision && source.sourceTimestamp && source.sourceUrl && source.sourceContentHash
        && source.completeSourceRetained === true
        && typeof source.exactRevisionSourceText === 'string'
        && source.exactRevisionSourceText.length > 0
        && hash(source.exactRevisionSourceText) === source.sourceContentHash
        && source.sourceLines?.length === lines.length
        && source.sourceLines.every((line, index) => line.line === index + 1 && line.text === lines[index] && line.lineContentHash === hash({ sourceContentHash: source.sourceContentHash, line: index + 1, text: lines[index] }))
        && (source.discoveryChannel !== 'source_authored_reciprocal_main_namespace_link' || source.sourceAuthoredPrimaryBacklinks?.length > 0))
    };
  });
  const signalChecks = signals.map(signal => {
    const identity = `${signal.sourcePageId}:${signal.sourceRevision}:${signal.sourceContentHash}`;
    const source = sourceByIdentity.get(identity);
    const line = source?.sourceLines?.[Number(signal.sourceLocator?.lineStart) - 1];
    const subjectComplete = Boolean(signal.exactSubjectEvidence?.subjectBoundaryComplete);
    const predicateComplete = signal.exactPredicateEvidence?.predicateBoundaryComplete === true;
    return {
      evidenceKey: signal.evidenceKey,
      complete: Boolean(sourceKeys.has(identity)
        && DOMAINS.includes(signal.evidenceDomain)
        && line?.text === signal.exactLine
        && hash(signal.exactLine) === signal.exactLineContentHash
        && signal.exactSubjectPredicateScopeComplete === (subjectComplete && predicateComplete)
        && signal.semanticVerdict === null)
    };
  });
  const packetChecks = {
    evidenceAndReviewStateMatch: evidence.evidenceState === policy.requiredEvidenceState && record.independentScopedActivityRepeatabilityEvidenceReview?.state === policy.requiredReviewState,
    definedDiscoveryScopeCompleteButUniverseOpen: evidence.sourceDiscovery?.definedDiscoveryScopeComplete === true && evidence.sourceDiscovery?.completeIndependentSourceUniverse === false,
    sourcesComplete: sources.length > 0 && sourceChecks.every(check => check.complete),
    signalsComplete: signalChecks.every(check => check.complete),
    signalCountMatches: signals.length === signals.filter(signal => signal.evidenceKey).length && unique(signals.map(signal => signal.evidenceKey)).length === signals.length,
    domainsCompleteAndUnresolved: packets.length === DOMAINS.length && packets.every((packet, index) => packet.domainKey === DOMAINS[index] && packet.resolved === false && packet.evidenceWorkComplete === false && packet.domainVerdict === null),
    packetSignalReferencesExact: packets.every(packet => JSON.stringify(packet.candidateSignalEvidenceKeys || []) === JSON.stringify(signals.filter(signal => signal.evidenceDomain === packet.domainKey).map(signal => signal.evidenceKey))),
    allVerdictsNull: evidence.parentActivityRepeatabilityVerdict === null && evidence.memberTaskRepeatabilityVerdict === null && evidence.repeatabilityVerdict === null && record.independentScopedActivityRepeatabilityEvidenceReview?.repeatabilityVerdict === null,
    automaticVerificationAbsent: evidence.automaticVerificationApplied === false
  };
  return { complete: Object.values(packetChecks).every(Boolean), packetChecks, sourceChecks, signalChecks, sources, signals, packets };
}

function dispositionClass(signal, source, policy) {
  if (signal.exactSubjectPredicateScopeComplete === true) return policy.dispositionClasses.exactScopedCandidate;
  if (source?.discoveryChannel === 'exact_revision_canonical_collection_anchor') return policy.dispositionClasses.unscopedCollectionCandidate;
  if (source?.discoveryChannel === 'source_authored_reciprocal_main_namespace_link') return policy.dispositionClasses.unscopedReciprocalCandidate;
  return policy.dispositionClasses.unknownSourceCandidate;
}

function dispositionSignals(input, policy) {
  const evidence = input.independentScopedActivityRepeatabilityEvidence;
  const sourceByIdentity = new Map((evidence.independentSources || []).map(source => [`${source.sourcePageId}:${source.sourceRevision}:${source.sourceContentHash}`, source]));
  return (evidence.sourceLocatedCandidateSignals || []).map(signal => {
    const source = sourceByIdentity.get(`${signal.sourcePageId}:${signal.sourceRevision}:${signal.sourceContentHash}`);
    const exact = signal.exactSubjectPredicateScopeComplete === true;
    return {
      evidenceKey: signal.evidenceKey,
      evidenceDomain: signal.evidenceDomain,
      signalKind: signal.signalKind,
      sourceKey: source?.sourceKey || null,
      sourceDiscoveryChannel: source?.discoveryChannel || null,
      exactSubjectBoundaryComplete: signal.exactSubjectEvidence?.subjectBoundaryComplete === true,
      exactPredicateBoundaryComplete: signal.exactPredicateEvidence?.predicateBoundaryComplete === true,
      exactSubjectPredicateScopeComplete: exact,
      dispositionClass: dispositionClass(signal, source, policy),
      usableClaimCandidate: exact,
      canResolveDomainAutomatically: false,
      canSupportParentRepeatabilityVerdict: false,
      canSupportMemberRepeatabilityVerdict: false,
      exactSourceLocator: signal.sourceLocator,
      exactLineContentHash: signal.exactLineContentHash
    };
  });
}

function domainAssessment(domainKey, signals) {
  const candidates = signals.filter(signal => signal.evidenceDomain === domainKey);
  const exact = candidates.filter(signal => signal.exactSubjectPredicateScopeComplete);
  const collection = candidates.filter(signal => signal.sourceDiscoveryChannel === 'exact_revision_canonical_collection_anchor' && !signal.exactSubjectPredicateScopeComplete);
  const reciprocal = candidates.filter(signal => signal.sourceDiscoveryChannel === 'source_authored_reciprocal_main_namespace_link' && !signal.exactSubjectPredicateScopeComplete);
  const state = exact.length
    ? 'exact_scoped_claim_candidates_require_manual_semantic_claim_review'
    : candidates.length
      ? 'only_unscoped_or_contextual_candidates_observed_not_applicable_to_canonical_activity'
      : 'no_candidate_observed_in_defined_channels_not_negative_evidence';
  return {
    domainKey,
    candidateSignalCount: candidates.length,
    exactScopedClaimCandidateCount: exact.length,
    unscopedCollectionCandidateCount: collection.length,
    unscopedReciprocalCandidateCount: reciprocal.length,
    signalEvidenceKeys: candidates.map(signal => signal.evidenceKey),
    dispositionState: state,
    resolved: false,
    domainVerdict: null,
    parentActivityRepeatabilityVerdict: null,
    memberTaskRepeatabilityVerdict: null
  };
}

function expectedRecord(input, policy) {
  const integrity = packetIntegrity(input, policy);
  const signalDispositions = dispositionSignals(input, policy);
  const assessments = DOMAINS.map(domain => domainAssessment(domain, signalDispositions));
  const exactCount = signalDispositions.filter(signal => signal.exactSubjectPredicateScopeComplete).length;
  const unscopedCount = signalDispositions.length - exactCount;
  const { contentHash: inputHash, blockers: inputBlockers = [], ...rest } = input;
  return {
    contract: policy.recordContract,
    ...preservedInput(rest),
    sourceIndependentScopedActivityRepeatabilityEvidenceContentHash: inputHash,
    independentScopedActivityRepeatabilityDispositionSignals: signalDispositions,
    independentScopedActivityRepeatabilityDisposition: {
      state: integrity.complete ? 'blocked_no_resolved_exact_scoped_independent_repeatability_claim' : 'blocked_incomplete_or_inconsistent_independent_repeatability_packet',
      classification: null,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      sourceRevisionKeys: integrity.sources.map(source => `${source.sourcePageId}:${source.sourceRevision}:${source.sourceContentHash}`),
      candidateSignalCount: signalDispositions.length,
      exactScopedClaimCandidateCount: exactCount,
      unscopedOrContextualCandidateCount: unscopedCount,
      evidenceDomainAssessments: assessments,
      unresolvedEvidenceDomains: assessments.map(assessment => assessment.domainKey),
      packetIntegrityChecks: integrity.packetChecks,
      deficiencies: unique([
        ...(!integrity.complete ? ['independent_repeatability_evidence_packet_integrity_failed'] : []),
        ...(exactCount ? ['exact_scoped_candidates_require_manual_semantic_claim_review'] : ['no_exact_same_line_canonical_activity_subject_predicate_claim_observed']),
        'parent_activity_post_completion_reassignment_or_restart_unresolved',
        'exact_member_task_reselection_and_repeatability_unresolved',
        'cooldown_reset_daily_or_session_limits_unresolved',
        'finite_exhaustion_one_time_or_completion_lockout_unresolved',
        'availability_across_sessions_unresolved',
        'independent_corroboration_or_conflict_unresolved'
      ])
    },
    independentScopedActivityRepeatabilityReview: {
      state: integrity.complete ? 'reviewed_blocked_no_resolved_exact_scoped_independent_claim' : 'reviewed_blocked_incomplete_or_inconsistent_independent_packet',
      reviewedSignalCount: signalDispositions.length,
      reviewedDomainCount: DOMAINS.length,
      resolvedDomainCount: 0,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceWorkComplete: false
    },
    independentScopedActivityRepeatabilityNextEvidenceWork: {
      state: 'required',
      routeKey: policy.nextEvidenceRoute.routeKey,
      routeState: policy.nextEvidenceRoute.routeState,
      requiredEvidenceDomains: DOMAINS,
      requireExactSameLineSubjectPredicateScope: true,
      crossLineCrossPageAndCrossSourceJoinAllowed: false,
      mustPreserveParentMemberSeparation: true
    },
    accountIndependent: true,
    blockers: unique([
      ...inputBlockers.filter(blocker => blocker !== 'independent_scoped_activity_repeatability_evidence_requires_semantic_disposition'),
      'no_resolved_exact_scoped_independent_repeatability_claim',
      'all_repeatability_evidence_domains_remain_unresolved',
      'exact_subject_predicate_independent_evidence_work_not_completed',
      'complete_independent_source_universe_not_established',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'independent_scoped_activity_repeatability_disposition_reviewed_unresolved'
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

export function auditIndependentScopedActivityRepeatabilityEvidenceDispositions(records = [], { evidenceRecords = [], policy = {} } = {}) {
  const compiled = compileIndependentScopedActivityRepeatabilityEvidenceDispositionPolicy(policy);
  const inputs = selectIndependentScopedActivityRepeatabilityEvidenceDispositionInputs(evidenceRecords, policy);
  const expected = compiled.valid ? inputs.map(input => expectedRecord(input, policy)) : [];
  const inputKeys = inputs.map(record => record.memberCandidateKey);
  const outputKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const packetIntegrityFailures = inputs.filter(input => !packetIntegrity(input, policy).complete).map(input => input.memberCandidateKey);
  const recordMismatches = records.filter(record => {
    const match = expected.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !match || hash(record) !== hash(match);
  }).map(record => record.memberCandidateKey);
  const signalDispositionFailures = records.filter(record => {
    const input = inputs.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !input || JSON.stringify(record.independentScopedActivityRepeatabilityDispositionSignals) !== JSON.stringify(dispositionSignals(input, policy));
  }).map(record => record.memberCandidateKey);
  const domainDispositionFailures = records.filter(record => {
    const assessments = record.independentScopedActivityRepeatabilityDisposition?.evidenceDomainAssessments || [];
    const next = record.independentScopedActivityRepeatabilityNextEvidenceWork || {};
    return assessments.length !== DOMAINS.length
      || assessments.some((assessment, index) => assessment.domainKey !== DOMAINS[index] || assessment.resolved !== false || assessment.domainVerdict !== null)
      || JSON.stringify(next.requiredEvidenceDomains || []) !== JSON.stringify(DOMAINS)
      || next.requireExactSameLineSubjectPredicateScope !== true
      || next.crossLineCrossPageAndCrossSourceJoinAllowed !== false;
  }).map(record => record.memberCandidateKey);
  const upstreamMismatches = records.filter(record => {
    const input = inputs.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !input || hash(preservedInput(record)) !== hash(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.optimizerEligible !== false
    || record.memberExpansionReview?.state === 'reviewed'
    || record.mechanicsReview?.state === 'reviewed'
    || record.independentScopedActivityRepeatabilityDisposition?.repeatabilityVerdict !== null
    || record.independentScopedActivityRepeatabilityReview?.evidenceWorkComplete !== false
  ).map(record => record.memberCandidateKey);
  const accountFindings = accountStateFindings(records);
  const blockers = [];
  if (!compiled.valid) blockers.push('independent_repeatability_disposition_policy_invalid_or_activity_specific');
  if (evidenceRecords.length !== inputs.length || duplicateInputKeys.length) blockers.push('input_evidence_set_not_exactly_eligible_and_unique');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) blockers.push('input_output_disposition_set_mismatch');
  if (packetIntegrityFailures.length) blockers.push('one_or_more_input_evidence_packets_fail_revision_or_locator_integrity');
  if (recordMismatches.length) blockers.push('one_or_more_dispositions_do_not_match_generic_policy');
  if (signalDispositionFailures.length) blockers.push('one_or_more_candidate_signals_lack_the_exact_policy_role');
  if (domainDispositionFailures.length) blockers.push('one_or_more_domains_are_not_unresolved_and_exactly_routed');
  if (upstreamMismatches.length) blockers.push('input_evidence_revision_hash_discovery_or_prior_disposition_changed');
  if (unsupportedPromotions.length) blockers.push('unsupported_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = blockers.length === 0;
  const signals = records.flatMap(record => record.independentScopedActivityRepeatabilityDispositionSignals || []);
  const assessments = records.flatMap(record => record.independentScopedActivityRepeatabilityDisposition?.evidenceDomainAssessments || []);
  return {
    contract: policy.auditContract,
    inputCoverage: { inputEvidenceRecordCount: evidenceRecords.length, eligibleEvidenceRecordCount: inputs.length, dispositionRecordCount: records.length, duplicateInputKeys, duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys },
    policyCoverage: compiled,
    packetIntegrityCoverage: { checkedPacketCount: inputs.length, completePacketCount: inputs.length - packetIntegrityFailures.length, packetIntegrityFailures },
    signalDispositionCoverage: { inputCandidateSignalCount: inputs.flatMap(input => input.independentScopedActivityRepeatabilityEvidence?.sourceLocatedCandidateSignals || []).length, dispositionSignalCount: signals.length, exactScopedClaimCandidateCount: signals.filter(signal => signal.exactSubjectPredicateScopeComplete).length, unscopedCollectionCandidateCount: signals.filter(signal => signal.dispositionClass === policy.dispositionClasses?.unscopedCollectionCandidate).length, unscopedReciprocalCandidateCount: signals.filter(signal => signal.dispositionClass === policy.dispositionClasses?.unscopedReciprocalCandidate).length, signalDispositionFailures },
    domainDispositionCoverage: { requiredDomainCount: records.length * DOMAINS.length, dispositionedDomainCount: assessments.length, resolvedDomainCount: assessments.filter(assessment => assessment.resolved).length, unresolvedDomainCount: assessments.filter(assessment => !assessment.resolved).length, domainDispositionFailures },
    semanticPreservationCoverage: { recordMismatches, upstreamMismatches, unsupportedPromotions, parentAndMemberRepeatabilitySeparatedCount: records.filter(record => record.independentScopedActivityRepeatabilityDisposition?.parentActivityRepeatabilityVerdict === null && record.independentScopedActivityRepeatabilityDisposition?.memberTaskRepeatabilityVerdict === null).length },
    accountStateFindings: accountFindings,
    dispositionAttemptCoverageComplete: publishable && records.length === inputs.length,
    repeatabilityClassificationCoverageComplete: false,
    repeatabilityReviewComplete: false,
    memberExpansionComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      'no_resolved_exact_scoped_independent_repeatability_claim',
      'all_repeatability_evidence_domains_remain_unresolved',
      'exact_subject_predicate_independent_evidence_work_not_completed',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords = [], policy = {} }) {
  const compiled = compileIndependentScopedActivityRepeatabilityEvidenceDispositionPolicy(policy);
  const records = compiled.valid ? selectIndependentScopedActivityRepeatabilityEvidenceDispositionInputs(evidenceRecords, policy).map(input => expectedRecord(input, policy)) : [];
  return { records, audit: auditIndependentScopedActivityRepeatabilityEvidenceDispositions(records, { evidenceRecords, policy }) };
}
