import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'oneDispositionPerCompleteEvidencePacket',
  'inputSnapshotRecordPacketAndSourceIntegrityMustRevalidate',
  'numberedAliasOrVariantSignalsTakeRoutingPrecedence',
  'candidateScopedWeightLanguageMayRouteToReviewButCannotCreateMembership',
  'candidateSubjectCorroborationMayRouteToReviewButCannotCreateMembership',
  'parentGlobalWeightLanguageCannotBecomeCandidateScopedMembership',
  'parentDistributionPercentagesCannotBecomeCandidateWeights',
  'sourceSilenceRoutesToAdditionalEvidenceAndIsNotNegativeEvidence',
  'allRoutesRetainExactPacketSourceAndObservationBindings',
  'membershipIdentityMappingCompletenessRepeatabilityMechanicsAndOptimizerVerdictsRemainClosed',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_CHANNELS = [
  'exact_revision_source_revalidation',
  'exact_parent_occurrence_binding',
  'candidate_scoped_same_line_weight_statement',
  'parent_global_weight_statement',
  'candidate_subject_corroboration',
  'duplicate_alias_and_variant_signals',
  'weighted_membership_verdict_separation'
];
const EXPECTED_ROUTES = [
  'numbered_alias_or_variant_scope_evidence_required',
  'candidate_scoped_weight_review_ready',
  'candidate_subject_corroboration_review_ready',
  'additional_candidate_membership_evidence_required'
];
const STAGE_FIELDS = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceWeightedParentTaskEntryMembershipEvidenceContentHash',
  'weightedParentTaskEntryMembershipEvidenceDispositions',
  'weightedParentTaskEntryMembershipEvidenceDisposition',
  'weightedParentTaskEntryMembershipEvidenceDispositionReview'
]);
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const same = (left, right, contentHash = hash) => contentHash(sorted(left)) === contentHash(sorted(right));
const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !STAGE_FIELDS.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|title|titles|label|labels|alias|aliases|override|overrides)$/i;
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
  return sorted(unique(findings));
}

export function compileWeightedParentTaskEntryMembershipEvidenceDispositionPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.weighted-parent-task-entry-membership-evidence.v1'
    && policy.recordContract === 'sensum.weighted-parent-task-entry-membership-evidence-disposition.v1'
    && policy.auditContract === 'sensum.weighted-parent-task-entry-membership-evidence-disposition-audit.v1'
    && policy.inputState === 'revision_pinned_weighted_parent_task_entry_membership_evidence_captured_verdicts_closed'
    && policy.outputState === 'weighted_parent_task_entry_membership_evidence_disposition_recorded_all_verdicts_closed';
  const invalidChannels = same(policy.requiredInputChannels || [], EXPECTED_CHANNELS) ? [] : ['requiredInputChannels'];
  const invalidRoutes = same(policy.routes || [], EXPECTED_ROUTES) ? [] : ['routes'];
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && !invalidRules.length && !invalidChannels.length && !invalidRoutes.length && !forbidden.length,
    contractValid,
    invalidRules: unique(invalidRules),
    invalidChannels,
    invalidRoutes,
    forbiddenPolicyPaths: forbidden,
    requiredInputChannels: [...(policy.requiredInputChannels || [])],
    routes: [...(policy.routes || [])]
  };
}

function sourceIntegrity(source = {}) {
  const identity = source.sourcePageIdentity || {};
  const checks = {
    complete: source.complete === true,
    sourceKeyPresent: typeof source.sourceKey === 'string' && source.sourceKey.length > 0,
    rolesPresent: Array.isArray(source.roles) && source.roles.length > 0,
    pageIdPresent: Number(identity.sourcePageId) > 0,
    titlePresent: typeof identity.resolvedTitle === 'string' && identity.resolvedTitle.length > 0,
    revisionPresent: typeof identity.sourceRevision === 'string' && identity.sourceRevision.length > 0,
    timestampPresent: typeof identity.sourceTimestamp === 'string' && identity.sourceTimestamp.length > 0,
    urlPresent: typeof identity.sourceUrl === 'string' && identity.sourceUrl.length > 0,
    hashPresent: typeof identity.sourceContentHash === 'string' && identity.sourceContentHash.length > 0,
    byteCountPresent: Number.isInteger(identity.sourceContentBytes) && identity.sourceContentBytes > 0,
    upstreamChecksComplete: Object.keys(source.checks || {}).length > 0 && Object.values(source.checks || {}).every(value => value === true)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function channel(packet = {}, name) {
  return (packet.channelObservations || []).find(item => item.channel === name);
}

function packetIntegrity(packet = {}, sourceKeys = new Set(), policy = {}, contentHash = hash) {
  const withoutHash = Object.fromEntries(Object.entries(packet).filter(([key]) => key !== 'recordContentHash'));
  const channels = packet.channelObservations || [];
  const revision = channel(packet, 'exact_revision_source_revalidation');
  const occurrence = channel(packet, 'exact_parent_occurrence_binding');
  const verdict = channel(packet, 'weighted_membership_verdict_separation');
  const checks = {
    captureComplete: packet.captureComplete === true && packet.state === 'revision_pinned_weighted_parent_task_entry_membership_evidence_captured_review_pending',
    recordContentHashMatches: packet.recordContentHash === contentHash(withoutHash),
    requiredChannelsExact: same(packet.requiredChannels || [], policy.requiredInputChannels || [], contentHash),
    channelSetExact: channels.length === (policy.requiredInputChannels || []).length && (policy.requiredInputChannels || []).every(name => channels.filter(item => item.channel === name).length === 1),
    allSourceEvidenceKeysResolve: Array.isArray(packet.sourceEvidenceKeys) && packet.sourceEvidenceKeys.length > 0 && packet.sourceEvidenceKeys.every(key => sourceKeys.has(key)),
    sourceEvidenceKeysUnique: duplicates(packet.sourceEvidenceKeys || []).length === 0,
    exactRevisionChannelComplete: Array.isArray(revision?.observations) && revision.observations.length === packet.sourceEvidenceKeys?.length && revision.observations.every(item => item.complete === true && Object.values(item.checks || {}).every(value => value === true)),
    exactOccurrenceChannelComplete: occurrence?.captureState === 'exact_parent_occurrence_revalidated' && occurrence.observations?.length === 1 && occurrence.observations[0]?.integrity?.complete === true && Object.values(occurrence.observations[0]?.integrity?.checks || {}).every(value => value === true),
    observationArraysPresent: ['candidate_scoped_same_line_weight_statement', 'parent_global_weight_statement', 'candidate_subject_corroboration', 'duplicate_alias_and_variant_signals'].every(name => Array.isArray(channel(packet, name)?.observations)),
    distributionArrayPresent: Array.isArray(channel(packet, 'parent_global_weight_statement')?.distributionObservations),
    channelSemanticVerdictsNull: channels.every(item => item.semanticVerdict === null),
    verdictSeparationIntact: verdict?.weightedTaskEntryMembershipVerdict === null && verdict?.automaticReviewForbidden === true,
    semanticEvidenceIncomplete: packet.weightedMembershipSemanticEvidenceComplete === false,
    semanticVerdictsNull: ['weightedTaskEntryMembershipVerdict', 'candidateMemberIdentityVerdict', 'mappingVerdict', 'inventoryCompletenessVerdict'].every(field => packet[field] === null),
    universeAndOptimizerClosed: packet.memberUniverseComplete === false && packet.optimizerEligible === false,
    automaticVerificationNotApplied: packet.automaticVerificationApplied === false,
    accountIndependent: packet.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function inputEligible(record = {}, policy = {}) {
  const sources = record.weightedParentTaskEntryMembershipEvidenceSources || [];
  const packets = record.weightedParentTaskEntryMembershipEvidencePackets || [];
  const review = record.weightedParentTaskEntryMembershipEvidenceReview || {};
  return record.contract === policy.inputContract && record.state === policy.inputState
    && record.accountIndependent === true && record.automaticVerificationApplied === false
    && record.weightedTaskEntryMembershipVerdict === null && record.memberUniverseComplete === false
    && record.optimizerEligible === false && sources.length > 0 && packets.length > 0
    && review.state === 'unreviewed_source_bound_weighted_membership_evidence'
    && review.reviewedPacketKeys?.length === 0 && review.reviewer === null
    && review.reviewedAt === null && review.reviewNotes === null;
}

export function selectWeightedParentTaskEntryMembershipEvidenceDispositionInputs(records = [], policy = {}) {
  return records.filter(record => inputEligible(record, policy));
}

function evidenceCounts(packet = {}) {
  return {
    candidateScopedWeightStatementCount: channel(packet, 'candidate_scoped_same_line_weight_statement')?.observations?.length || 0,
    parentGlobalWeightStatementCount: channel(packet, 'parent_global_weight_statement')?.observations?.length || 0,
    parentDistributionStatementCount: channel(packet, 'parent_global_weight_statement')?.distributionObservations?.length || 0,
    candidateSubjectCorroborationCount: channel(packet, 'candidate_subject_corroboration')?.observations?.length || 0,
    numberedAliasOrVariantSignalCount: channel(packet, 'duplicate_alias_and_variant_signals')?.observations?.length || 0
  };
}

function routeFor(counts = {}) {
  if (counts.numberedAliasOrVariantSignalCount > 0) return 'numbered_alias_or_variant_scope_evidence_required';
  if (counts.candidateScopedWeightStatementCount > 0) return 'candidate_scoped_weight_review_ready';
  if (counts.candidateSubjectCorroborationCount > 0) return 'candidate_subject_corroboration_review_ready';
  return 'additional_candidate_membership_evidence_required';
}

function dispositionFor(packet = {}, contentHash = hash) {
  const counts = evidenceCounts(packet);
  const route = routeFor(counts);
  const reviewReady = route === 'candidate_scoped_weight_review_ready' || route === 'candidate_subject_corroboration_review_ready';
  const routeBlockers = {
    numbered_alias_or_variant_scope_evidence_required: ['numbered_alias_or_variant_scope_must_be_resolved_before_membership_review', 'candidate_scope_cannot_be_selected_from_page_order_or_alias_count'],
    candidate_scoped_weight_review_ready: ['candidate_scoped_weight_evidence_requires_explicit_source_bound_review'],
    candidate_subject_corroboration_review_ready: ['candidate_subject_corroboration_requires_explicit_source_bound_membership_review', 'corroboration_is_not_a_weight_statement'],
    additional_candidate_membership_evidence_required: ['candidate_specific_membership_evidence_not_observed', 'source_silence_is_not_negative_evidence']
  };
  return {
    dispositionKey: `${packet.packetKey}|evidence-disposition`,
    packetKey: packet.packetKey,
    packetRecordContentHash: packet.recordContentHash,
    workItemKey: packet.workItemKey,
    structuralCandidateKey: packet.structuralCandidateKey,
    candidateRole: packet.candidateRole,
    sourceDispositionKeys: [...(packet.sourceDispositionKeys || [])],
    sourceEvidenceKeys: [...(packet.sourceEvidenceKeys || [])],
    channelEvidenceBindings: (packet.channelObservations || []).map(item => ({ channel: item.channel, contentHash: contentHash(item) })),
    evidenceCounts: counts,
    route,
    reviewReady,
    weightedTaskEntryMembershipVerdict: null,
    candidateMemberIdentityVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      ...routeBlockers[route],
      'parent_global_weight_language_is_not_candidate_scoped_membership_proof',
      'parent_distribution_percentages_are_not_candidate_weights',
      'weighted_parent_task_entry_membership_verdict_not_recorded'
    ]),
    state: reviewReady ? 'weighted_membership_evidence_review_ready_no_verdict' : 'weighted_membership_evidence_gap_routed_no_verdict'
  };
}

function expectedRecord(input = {}, policy = {}, contentHash = hash) {
  const dispositions = (input.weightedParentTaskEntryMembershipEvidencePackets || []).map(packet => dispositionFor(packet, contentHash));
  const routeCounts = Object.fromEntries(EXPECTED_ROUTES.map(route => [route, dispositions.filter(item => item.route === route).length]));
  const reviewReady = dispositions.filter(item => item.reviewReady);
  const sourceSilent = dispositions.filter(item => item.route === 'additional_candidate_membership_evidence_required');
  const variantBlocked = dispositions.filter(item => item.route === 'numbered_alias_or_variant_scope_evidence_required');
  const candidateWeight = dispositions.filter(item => item.route === 'candidate_scoped_weight_review_ready');
  const corroborated = dispositions.filter(item => item.route === 'candidate_subject_corroboration_review_ready');
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceWeightedParentTaskEntryMembershipEvidenceContentHash: input.contentHash,
    weightedParentTaskEntryMembershipEvidenceDispositions: dispositions,
    weightedParentTaskEntryMembershipEvidenceDisposition: {
      state: 'generic_fail_closed_weighted_membership_evidence_disposition_complete_all_verdicts_closed',
      dispositionCount: dispositions.length,
      routeCounts,
      reviewReadyCount: reviewReady.length,
      candidateScopedWeightReviewReadyCount: candidateWeight.length,
      candidateSubjectCorroborationReviewReadyCount: corroborated.length,
      numberedAliasOrVariantScopeEvidenceRequiredCount: variantBlocked.length,
      additionalCandidateMembershipEvidenceRequiredCount: sourceSilent.length,
      weightedTaskEntryMembershipVerdictCount: 0,
      candidateMemberIdentityVerdictCount: 0,
      mappingVerdictCount: 0,
      inventoryCompletenessVerdictCount: 0,
      memberUniverseComplete: false,
      optimizerEligibleCount: 0,
      automaticVerificationApplied: false
    },
    weightedParentTaskEntryMembershipEvidenceDispositionReview: {
      state: 'evidence_sufficiency_routes_recorded_explicit_reviews_and_additional_evidence_pending',
      reviewReadyDispositionKeys: reviewReady.map(item => item.dispositionKey),
      candidateScopedWeightReviewReadyDispositionKeys: candidateWeight.map(item => item.dispositionKey),
      candidateSubjectCorroborationReviewReadyDispositionKeys: corroborated.map(item => item.dispositionKey),
      numberedAliasOrVariantScopeEvidenceRequiredDispositionKeys: variantBlocked.map(item => item.dispositionKey),
      additionalCandidateMembershipEvidenceRequiredDispositionKeys: sourceSilent.map(item => item.dispositionKey),
      reviewedDispositionKeys: [],
      reviewer: null,
      reviewedAt: null,
      reviewNotes: null,
      weightedTaskEntryMembershipVerdict: null,
      automaticVerificationApplied: false
    },
    weightedTaskEntryMembershipVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []),
      'weighted_parent_task_entry_membership_evidence_disposition_recorded_final_reviews_not_completed',
      ...(reviewReady.length ? ['one_or_more_weighted_membership_evidence_packets_ready_for_source_bound_review'] : []),
      ...(variantBlocked.length ? ['one_or_more_numbered_alias_or_variant_scopes_require_resolution'] : []),
      ...(sourceSilent.length ? ['one_or_more_candidates_require_additional_membership_evidence'] : []),
      'weighted_parent_task_entry_membership_not_proven',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'all_repeatability_evidence_domains_remain_unresolved',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    state: policy.outputState
  };
}

function accountStateFindings(records = []) {
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

export function auditWeightedParentTaskEntryMembershipEvidenceDispositions(records = [], {
  evidenceRecords = [], policy = {}, contentHash = hash
} = {}) {
  const compiled = compileWeightedParentTaskEntryMembershipEvidenceDispositionPolicy(policy);
  const inputs = selectWeightedParentTaskEntryMembershipEvidenceDispositionInputs(evidenceRecords, policy);
  const expected = compiled.valid ? inputs.map(input => expectedRecord(input, policy, contentHash)) : [];
  const inputKeys = inputs.map(item => item.sourceRoutingRecordContentHash);
  const outputKeys = records.map(item => item.sourceRoutingRecordContentHash);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const sourceFailures = [];
  const packetFailures = [];
  const inputRecordHashFailures = [];
  for (const input of inputs) {
    const { contentHash: storedHash, ...withoutHash } = input;
    if (!storedHash || contentHash(withoutHash) !== storedHash) inputRecordHashFailures.push(input.sourceRoutingRecordContentHash || storedHash || 'unknown');
    const sources = input.weightedParentTaskEntryMembershipEvidenceSources || [];
    const sourceKeys = new Set(sources.map(source => source.sourceKey));
    for (const source of sources) if (!sourceIntegrity(source).complete) sourceFailures.push(source.sourceKey || 'unknown');
    for (const packet of input.weightedParentTaskEntryMembershipEvidencePackets || []) {
      if (!packetIntegrity(packet, sourceKeys, policy, contentHash).complete) packetFailures.push(packet.packetKey || 'unknown');
    }
  }
  const dispositions = records.flatMap(record => record.weightedParentTaskEntryMembershipEvidenceDispositions || []);
  const expectedPacketKeys = inputs.flatMap(input => input.weightedParentTaskEntryMembershipEvidencePackets || []).map(packet => packet.packetKey);
  const dispositionPacketKeys = dispositions.map(item => item.packetKey);
  const duplicateDispositionKeys = duplicates(dispositions.map(item => item.dispositionKey));
  const missingDispositionPacketKeys = expectedPacketKeys.filter(key => !dispositionPacketKeys.includes(key));
  const unexpectedDispositionPacketKeys = dispositionPacketKeys.filter(key => !expectedPacketKeys.includes(key));
  const recordMismatches = records.filter(record => {
    const match = expected.find(item => item.sourceRoutingRecordContentHash === record.sourceRoutingRecordContentHash);
    return !match || contentHash(record) !== contentHash(match);
  }).map(item => item.sourceRoutingRecordContentHash || 'unknown');
  const upstreamMismatches = records.filter(record => {
    const input = inputs.find(item => item.sourceRoutingRecordContentHash === record.sourceRoutingRecordContentHash);
    return !input || contentHash(preservedInput(record)) !== contentHash(preservedInput(input));
  }).map(item => item.sourceRoutingRecordContentHash || 'unknown');
  const routeCounts = Object.fromEntries(EXPECTED_ROUTES.map(route => [route, dispositions.filter(item => item.route === route).length]));
  const invalidRouteDispositions = dispositions.filter(item => !EXPECTED_ROUTES.includes(item.route)).map(item => item.dispositionKey);
  const routePriorityViolations = dispositions.filter(item => {
    const expectedRoute = routeFor(item.evidenceCounts || {});
    return item.route !== expectedRoute;
  }).map(item => item.dispositionKey);
  const unsupportedPromotions = records.filter(record => {
    const summary = record.weightedParentTaskEntryMembershipEvidenceDisposition || {};
    const review = record.weightedParentTaskEntryMembershipEvidenceDispositionReview || {};
    return summary.weightedTaskEntryMembershipVerdictCount !== 0 || summary.candidateMemberIdentityVerdictCount !== 0
      || summary.mappingVerdictCount !== 0 || summary.inventoryCompletenessVerdictCount !== 0
      || summary.memberUniverseComplete !== false || summary.optimizerEligibleCount !== 0
      || summary.automaticVerificationApplied !== false || review.weightedTaskEntryMembershipVerdict !== null
      || review.reviewedDispositionKeys?.length !== 0 || review.reviewer !== null || review.reviewedAt !== null
      || review.reviewNotes !== null || review.automaticVerificationApplied !== false
      || record.weightedTaskEntryMembershipVerdict !== null || record.memberUniverseComplete !== false
      || record.optimizerEligible !== false || record.automaticVerificationApplied !== false
      || (record.weightedParentTaskEntryMembershipEvidenceDispositions || []).some(item => item.weightedTaskEntryMembershipVerdict !== null
        || item.candidateMemberIdentityVerdict !== null || item.mappingVerdict !== null || item.inventoryCompletenessVerdict !== null
        || item.memberUniverseComplete !== false || item.optimizerEligible !== false || item.automaticVerificationApplied !== false);
  }).map(item => item.sourceRoutingRecordContentHash || 'unknown');
  const accountFindings = accountStateFindings(records);
  const blockers = [];
  if (!compiled.valid) blockers.push('weighted_membership_evidence_disposition_policy_invalid_or_specific');
  if (evidenceRecords.length !== inputs.length || duplicateInputKeys.length || inputRecordHashFailures.length) blockers.push('input_evidence_snapshot_records_not_exactly_eligible_unique_and_hash_valid');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) blockers.push('input_output_disposition_record_set_mismatch');
  if (sourceFailures.length) blockers.push('one_or_more_retained_exact_revision_sources_failed_revalidation');
  if (packetFailures.length) blockers.push('one_or_more_weighted_membership_evidence_packets_failed_revalidation');
  if (duplicateDispositionKeys.length || missingDispositionPacketKeys.length || unexpectedDispositionPacketKeys.length || invalidRouteDispositions.length || routePriorityViolations.length) blockers.push('packet_disposition_set_or_route_classification_invalid');
  if (recordMismatches.length) blockers.push('one_or_more_disposition_records_do_not_match_policy_bound_evidence');
  if (upstreamMismatches.length) blockers.push('input_evidence_sources_packets_or_prior_state_changed');
  if (unsupportedPromotions.length) blockers.push('evidence_disposition_created_unsupported_review_or_semantic_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = compiled.valid && evidenceRecords.length === inputs.length && !duplicateInputKeys.length
    && !inputRecordHashFailures.length && !duplicateOutputKeys.length && !missingOutputKeys.length && !unexpectedOutputKeys.length
    && !sourceFailures.length && !packetFailures.length && !duplicateDispositionKeys.length && !missingDispositionPacketKeys.length
    && !unexpectedDispositionPacketKeys.length && !invalidRouteDispositions.length && !routePriorityViolations.length
    && !recordMismatches.length && !upstreamMismatches.length && !unsupportedPromotions.length && !accountFindings.length;
  return {
    contract: policy.auditContract,
    inputCoverage: { inputEvidenceRecordCount: evidenceRecords.length, eligibleEvidenceRecordCount: inputs.length, dispositionRecordCount: records.length, duplicateInputKeys, duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys, inputRecordHashFailures },
    policyCoverage: compiled,
    sourceIntegrityCoverage: { sourceCount: inputs.flatMap(input => input.weightedParentTaskEntryMembershipEvidenceSources || []).length, failedSourceCount: sourceFailures.length, failedSourceKeys: sourceFailures },
    packetIntegrityCoverage: { evidencePacketCount: expectedPacketKeys.length, failedPacketCount: packetFailures.length, failedPacketKeys: packetFailures },
    dispositionCoverage: { dispositionCount: dispositions.length, duplicateDispositionKeys, missingDispositionPacketKeys, unexpectedDispositionPacketKeys, invalidRouteDispositions, routePriorityViolations },
    routeCoverage: routeCounts,
    semanticPreservationCoverage: { recordMismatches, upstreamMismatches, unsupportedPromotions },
    accountStateFindings: accountFindings,
    dispositionCoverageComplete: publishable && dispositions.length === expectedPacketKeys.length,
    weightedMembershipReviewComplete: false,
    memberExpansionComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      'weighted_parent_task_entry_membership_evidence_disposition_recorded_final_reviews_not_completed',
      ...(routeCounts.candidate_scoped_weight_review_ready || routeCounts.candidate_subject_corroboration_review_ready ? ['one_or_more_weighted_membership_evidence_packets_ready_for_source_bound_review'] : []),
      ...(routeCounts.numbered_alias_or_variant_scope_evidence_required ? ['one_or_more_numbered_alias_or_variant_scopes_require_resolution'] : []),
      ...(routeCounts.additional_candidate_membership_evidence_required ? ['one_or_more_candidates_require_additional_membership_evidence'] : []),
      'weighted_parent_task_entry_membership_not_proven',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'all_repeatability_evidence_domains_remain_unresolved',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildWeightedParentTaskEntryMembershipEvidenceDispositions({
  evidenceRecords = [], policy = {}, contentHash = hash
} = {}) {
  const compiled = compileWeightedParentTaskEntryMembershipEvidenceDispositionPolicy(policy);
  const records = compiled.valid
    ? selectWeightedParentTaskEntryMembershipEvidenceDispositionInputs(evidenceRecords, policy).map(input => expectedRecord(input, policy, contentHash))
    : [];
  return { records, audit: auditWeightedParentTaskEntryMembershipEvidenceDispositions(records, { evidenceRecords, policy, contentHash }) };
}
