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
  'oneDispositionPerCompleteEvidencePacket',
  'everyExactCandidateReceivesManualReviewStatus',
  'zeroCandidatesInCompletedChannelsIsNotNegativeEvidence',
  'missingReviewedMemberSubjectRemainsASeparatePrerequisite',
  'allSixDomainsRemainIndependentlyAssessed',
  'parentAndMemberRepeatabilityRemainSeparate',
  'sameLineExactSubjectPredicateRequirementCannotBeRelaxed',
  'crossLineCrossSectionCrossPageAndCrossSourceJoinsRemainForbidden',
  'nextWorkSeparatesMemberIdentityFromSourceChannelExpansion',
  'namesTitlesPageIdsCandidateKeysLabelsAliasesAndOverridesCannotSelectOrAlterADisposition',
  'inputEvidenceRevisionsDiscoveryAndPriorDispositionsMustBePreserved',
  'repeatabilityVerdictsRemainNull',
  'memberMechanicsAndOptimizerPromotionAreForbidden',
  'currentAccountStateIsForbidden'
];

const STAGE_FIELDS = new Set(['contract', 'contentHash', 'blockers', 'state', 'sourceExactScopedIndependentRepeatabilityEvidenceContentHash', 'exactScopedIndependentRepeatabilityDisposition', 'exactScopedIndependentRepeatabilityReview', 'exactScopedIndependentRepeatabilityNextEvidenceWork']);
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !STAGE_FIELDS.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|label|labels|alias|aliases|override|overrides)$/i;
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  walk(policy);
  return findings.sort();
}

export function compileExactScopedIndependentRepeatabilityEvidenceDispositionPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidDomains = JSON.stringify(policy.requiredEvidenceDomains || []) === JSON.stringify(DOMAINS) ? [] : ['requiredEvidenceDomains'];
  const requiredClasses = ['exactCandidate', 'noCandidateInCompleteChannels', 'missingReviewedMemberSubject', 'incompletePacket'];
  const invalidClasses = requiredClasses.filter(key => !policy.dispositionClasses?.[key]);
  const invalidRoute = !policy.nextEvidenceRoute?.routeKey || !String(policy.nextEvidenceRoute?.routeState || '').startsWith('blocked_') ? ['nextEvidenceRoute'] : [];
  const forbidden = forbiddenPolicyPaths(policy);
  const valid = policy.inputContract === 'sensum.exact-scoped-independent-repeatability-evidence.v1'
    && policy.recordContract === 'sensum.exact-scoped-independent-repeatability-evidence-disposition.v1'
    && policy.auditContract === 'sensum.exact-scoped-independent-repeatability-evidence-disposition-audit.v1'
    && policy.inputState === 'exact_scoped_independent_repeatability_evidence_collected_gates_closed'
    && policy.requiredEvidenceState === 'revision_pinned_exact_scoped_independent_repeatability_evidence_collected_review_required'
    && policy.requiredReviewState === 'unreviewed_exact_scoped_independent_repeatability_evidence_semantic_disposition_required'
    && !invalidRules.length && !invalidDomains.length && !invalidClasses.length && !invalidRoute.length && !forbidden.length;
  return { invalidRules, invalidDomains, invalidClasses, invalidRoute, forbiddenPolicyPaths: forbidden, valid };
}

function selectorMatches(record, policy) {
  const evidence = record?.exactScopedIndependentRepeatabilityEvidence;
  const review = record?.exactScopedIndependentRepeatabilityEvidenceReview;
  return record?.contract === policy.inputContract
    && record?.state === policy.inputState
    && record?.accountIndependent === true
    && evidence?.evidenceState === policy.requiredEvidenceState
    && evidence?.discovery?.definedDiscoveryChannelsComplete === true
    && evidence?.discovery?.completeIndependentSourceUniverse === false
    && review?.state === policy.requiredReviewState
    && review?.evidenceWorkComplete === false
    && evidence?.parentActivityRepeatabilityVerdict === null
    && evidence?.memberTaskRepeatabilityVerdict === null
    && evidence?.repeatabilityVerdict === null
    && record?.mechanicsReview?.state === 'unreviewed'
    && record?.optimizerEligible === false;
}

export function selectExactScopedIndependentRepeatabilityEvidenceDispositionInputs(records = [], policy = {}) {
  return records.filter(record => selectorMatches(record, policy));
}

function packetIntegrity(record, policy) {
  const evidence = record.exactScopedIndependentRepeatabilityEvidence || {};
  const sources = evidence.independentSources || [];
  const signals = evidence.exactSameLineSubjectPredicateCandidateSignals || [];
  const packets = evidence.evidenceDomainPackets || [];
  const sourceByKey = new Map(sources.map(source => [source.sourceKey, source]));
  const sourceChecks = sources.map(source => {
    const lines = String(source.exactRevisionSourceText || '').split(/\r?\n/);
    return {
      sourceKey: source.sourceKey,
      complete: Boolean(source.sourceKey && source.sourcePageId && source.sourceTitle && source.sourceRevision && source.sourceTimestamp && source.sourceUrl && source.sourceContentHash
        && source.completeSourceRetained === true && typeof source.exactRevisionSourceText === 'string' && source.exactRevisionSourceText.length > 0
        && hash(source.exactRevisionSourceText) === source.sourceContentHash && source.sourceLines?.length === lines.length
        && source.sourceLines.every((line, index) => line.line === index + 1 && line.text === lines[index] && line.contentHash === hash(lines[index])))
    };
  });
  const signalChecks = signals.map(signal => {
    const source = [...sourceByKey.values()].find(candidate => candidate.sourcePageId === signal.sourcePageId && candidate.sourceRevision === signal.sourceRevision && candidate.sourceContentHash === signal.sourceContentHash);
    const line = source?.sourceLines?.[Number(signal.sourceLocator?.lineStart) - 1];
    return {
      evidenceKey: signal.evidenceKey,
      complete: Boolean(source && DOMAINS.includes(signal.evidenceDomain) && signal.exactSubject?.subjectKey && signal.exactSubject?.sourceAuthoredLink?.rawLink
        && signal.exactPredicate?.matchedText && signal.exactSubjectPredicateScopeComplete === true && signal.semanticVerdict === null
        && signal.sourceLocator?.lineStart === signal.sourceLocator?.lineEnd && line?.text === signal.exactLine
        && hash(signal.exactLine) === signal.exactLineContentHash)
    };
  });
  const packetChecks = {
    evidenceAndReviewStateMatch: evidence.evidenceState === policy.requiredEvidenceState && record.exactScopedIndependentRepeatabilityEvidenceReview?.state === policy.requiredReviewState,
    definedChannelsCompleteButUniverseOpen: evidence.discovery?.definedDiscoveryChannelsComplete === true && evidence.discovery?.completeIndependentSourceUniverse === false,
    sourcesComplete: sources.length > 0 && sourceChecks.every(check => check.complete),
    signalsComplete: signalChecks.every(check => check.complete) && unique(signals.map(signal => signal.evidenceKey)).length === signals.length,
    domainsCompleteAndUnresolved: packets.length === DOMAINS.length && packets.every((packet, index) => packet.domainKey === DOMAINS[index] && packet.resolved === false && packet.evidenceWorkComplete === false && packet.domainVerdict === null),
    packetSignalReferencesExact: packets.every(packet => JSON.stringify(packet.candidateSignalEvidenceKeys || []) === JSON.stringify(signals.filter(signal => signal.evidenceDomain === packet.domainKey).map(signal => signal.evidenceKey))),
    allVerdictsNull: evidence.parentActivityRepeatabilityVerdict === null && evidence.memberTaskRepeatabilityVerdict === null && evidence.repeatabilityVerdict === null,
    automaticVerificationAbsent: evidence.automaticVerificationApplied === false
  };
  return { complete: Object.values(packetChecks).every(Boolean), packetChecks, sourceChecks, signalChecks, sources, signals, packets };
}

function domainAssessment(packet, integrity, policy) {
  const signals = integrity.signals.filter(signal => signal.evidenceDomain === packet.domainKey);
  const memberPrerequisiteMissing = packet.domainKey === 'member_task_reselection_and_repeatability' && packet.reviewedMemberSubjectCount === 0;
  const dispositionClass = !integrity.complete ? policy.dispositionClasses.incompletePacket
    : memberPrerequisiteMissing ? policy.dispositionClasses.missingReviewedMemberSubject
      : signals.length ? policy.dispositionClasses.exactCandidate
        : policy.dispositionClasses.noCandidateInCompleteChannels;
  return {
    domainKey: packet.domainKey,
    exactCandidateCount: signals.length,
    candidateEvidenceKeys: signals.map(signal => signal.evidenceKey),
    reviewedMemberSubjectCount: packet.reviewedMemberSubjectCount,
    definedChannelsComplete: packet.sourceDiscoveryCompleteForDefinedChannels === true,
    dispositionClass,
    negativeGameFactEstablished: false,
    resolved: false,
    domainVerdict: null,
    parentActivityRepeatabilityVerdict: null,
    memberTaskRepeatabilityVerdict: null
  };
}

function nextWorkItem(assessment) {
  const workKind = assessment.exactCandidateCount > 0 ? 'manual_exact_candidate_semantic_review'
    : assessment.domainKey === 'member_task_reselection_and_repeatability' && assessment.reviewedMemberSubjectCount === 0 ? 'reviewed_member_identity_expansion'
      : 'additional_authoritative_exact_scoped_source_channel_discovery';
  return {
    domainKey: assessment.domainKey,
    workKind,
    requireExactSameLineSubjectPredicateScope: true,
    crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed: false,
    evidenceWorkComplete: false,
    workState: `blocked_pending_${workKind}`
  };
}

function expectedRecord(input, policy) {
  const integrity = packetIntegrity(input, policy);
  const assessments = integrity.packets.map(packet => domainAssessment(packet, integrity, policy));
  const { contentHash: inputHash, blockers: inputBlockers = [], ...rest } = input;
  return {
    contract: policy.recordContract,
    ...preservedInput(rest),
    sourceExactScopedIndependentRepeatabilityEvidenceContentHash: inputHash,
    exactScopedIndependentRepeatabilityDisposition: {
      state: integrity.complete ? 'blocked_no_resolved_exact_scoped_independent_repeatability_claim' : 'blocked_incomplete_or_inconsistent_exact_scoped_evidence_packet',
      classification: null,
      candidateSignalCount: integrity.signals.length,
      evidenceDomainAssessments: assessments,
      unresolvedEvidenceDomains: assessments.map(assessment => assessment.domainKey),
      packetIntegrityChecks: integrity.packetChecks,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null
    },
    exactScopedIndependentRepeatabilityReview: {
      state: integrity.complete ? 'reviewed_blocked_no_resolved_exact_scoped_independent_claim' : 'reviewed_blocked_incomplete_or_inconsistent_exact_scoped_packet',
      reviewedCandidateCount: integrity.signals.length,
      reviewedDomainCount: DOMAINS.length,
      resolvedDomainCount: 0,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceWorkComplete: false
    },
    exactScopedIndependentRepeatabilityNextEvidenceWork: {
      state: 'required',
      routeKey: policy.nextEvidenceRoute.routeKey,
      routeState: policy.nextEvidenceRoute.routeState,
      requiredEvidenceDomains: DOMAINS,
      domainWorkItems: assessments.map(nextWorkItem),
      sameLineExactSubjectPredicateRequired: true,
      crossLineCrossSectionCrossPageAndCrossSourceJoinsAllowed: false,
      parentAndMemberEvidenceObligationsSeparated: true,
      evidenceWorkComplete: false
    },
    accountIndependent: true,
    blockers: unique([
      ...inputBlockers.filter(blocker => blocker !== 'exact_scoped_independent_repeatability_evidence_requires_semantic_disposition'),
      'no_resolved_exact_scoped_independent_repeatability_claim',
      'all_repeatability_evidence_domains_remain_unresolved',
      'reviewed_member_identity_and_authoritative_source_channel_work_not_completed',
      'complete_independent_source_universe_not_established',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'exact_scoped_independent_repeatability_disposition_reviewed_unresolved'
  };
}

function accountStateFindings(records) {
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i;
  const findings = [];
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  records.forEach((record, index) => walk(record, `[${index}]`));
  return findings;
}

export function auditExactScopedIndependentRepeatabilityEvidenceDispositions(records = [], { evidenceRecords = [], policy = {} } = {}) {
  const compiled = compileExactScopedIndependentRepeatabilityEvidenceDispositionPolicy(policy);
  const inputs = selectExactScopedIndependentRepeatabilityEvidenceDispositionInputs(evidenceRecords, policy);
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
  const upstreamMismatches = records.filter(record => {
    const input = inputs.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !input || hash(preservedInput(record)) !== hash(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const domainDispositionFailures = records.filter(record => {
    const assessments = record.exactScopedIndependentRepeatabilityDisposition?.evidenceDomainAssessments || [];
    const next = record.exactScopedIndependentRepeatabilityNextEvidenceWork || {};
    return assessments.length !== DOMAINS.length || assessments.some((assessment, index) => assessment.domainKey !== DOMAINS[index] || assessment.resolved !== false || assessment.domainVerdict !== null || assessment.negativeGameFactEstablished !== false)
      || next.domainWorkItems?.length !== DOMAINS.length || next.sameLineExactSubjectPredicateRequired !== true
      || next.crossLineCrossSectionCrossPageAndCrossSourceJoinsAllowed !== false || next.evidenceWorkComplete !== false;
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => record.optimizerEligible !== false || record.mechanicsReview?.state === 'reviewed'
    || record.exactScopedIndependentRepeatabilityDisposition?.repeatabilityVerdict !== null
    || record.exactScopedIndependentRepeatabilityReview?.evidenceWorkComplete !== false).map(record => record.memberCandidateKey);
  const accountFindings = accountStateFindings(records);
  const blockers = [];
  if (!compiled.valid) blockers.push('exact_scoped_repeatability_disposition_policy_invalid_or_activity_specific');
  if (evidenceRecords.length !== inputs.length || duplicateInputKeys.length) blockers.push('input_evidence_set_not_exactly_eligible_and_unique');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) blockers.push('input_output_disposition_set_mismatch');
  if (packetIntegrityFailures.length) blockers.push('one_or_more_input_evidence_packets_fail_revision_or_locator_integrity');
  if (recordMismatches.length) blockers.push('one_or_more_dispositions_do_not_match_generic_policy');
  if (upstreamMismatches.length) blockers.push('input_evidence_revisions_discovery_or_prior_dispositions_changed');
  if (domainDispositionFailures.length) blockers.push('one_or_more_domains_are_not_unresolved_and_exactly_routed');
  if (unsupportedPromotions.length) blockers.push('unsupported_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = blockers.length === 0;
  const assessments = records.flatMap(record => record.exactScopedIndependentRepeatabilityDisposition?.evidenceDomainAssessments || []);
  const workItems = records.flatMap(record => record.exactScopedIndependentRepeatabilityNextEvidenceWork?.domainWorkItems || []);
  return {
    contract: policy.auditContract,
    inputCoverage: { inputEvidenceRecordCount: evidenceRecords.length, eligibleEvidenceRecordCount: inputs.length, dispositionRecordCount: records.length, duplicateInputKeys, duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys },
    policyCoverage: compiled,
    packetIntegrityCoverage: { checkedPacketCount: inputs.length, completePacketCount: inputs.length - packetIntegrityFailures.length, packetIntegrityFailures },
    domainDispositionCoverage: { requiredDomainCount: records.length * DOMAINS.length, dispositionedDomainCount: assessments.length, domainsWithCandidatesCount: assessments.filter(assessment => assessment.exactCandidateCount > 0).length, noCandidateInCompletedChannelsCount: assessments.filter(assessment => assessment.dispositionClass === policy.dispositionClasses?.noCandidateInCompleteChannels).length, missingReviewedMemberSubjectCount: assessments.filter(assessment => assessment.dispositionClass === policy.dispositionClasses?.missingReviewedMemberSubject).length, resolvedDomainCount: assessments.filter(assessment => assessment.resolved).length, negativeGameFactsEstablishedCount: assessments.filter(assessment => assessment.negativeGameFactEstablished).length, memberIdentityExpansionWorkItemCount: workItems.filter(item => item.workKind === 'reviewed_member_identity_expansion').length, sourceChannelExpansionWorkItemCount: workItems.filter(item => item.workKind === 'additional_authoritative_exact_scoped_source_channel_discovery').length, manualCandidateReviewWorkItemCount: workItems.filter(item => item.workKind === 'manual_exact_candidate_semantic_review').length, domainDispositionFailures },
    semanticPreservationCoverage: { recordMismatches, upstreamMismatches, unsupportedPromotions, parentAndMemberRepeatabilitySeparatedCount: records.filter(record => record.exactScopedIndependentRepeatabilityDisposition?.parentActivityRepeatabilityVerdict === null && record.exactScopedIndependentRepeatabilityDisposition?.memberTaskRepeatabilityVerdict === null).length },
    accountStateFindings: accountFindings,
    dispositionAttemptCoverageComplete: publishable && records.length === inputs.length,
    repeatabilityClassificationCoverageComplete: false,
    repeatabilityReviewComplete: false,
    memberExpansionComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers, 'no_resolved_exact_scoped_independent_repeatability_claim', 'all_repeatability_evidence_domains_remain_unresolved', 'reviewed_member_identity_and_authoritative_source_channel_work_not_completed', 'member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable
  };
}

export function buildExactScopedIndependentRepeatabilityEvidenceDispositions({ evidenceRecords = [], policy = {} }) {
  const compiled = compileExactScopedIndependentRepeatabilityEvidenceDispositionPolicy(policy);
  const records = compiled.valid ? selectExactScopedIndependentRepeatabilityEvidenceDispositionInputs(evidenceRecords, policy).map(input => expectedRecord(input, policy)) : [];
  return { records, audit: auditExactScopedIndependentRepeatabilityEvidenceDispositions(records, { evidenceRecords, policy }) };
}
