import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'oneDispositionPerCompleteBindingEvidencePacket',
  'everyRetainedExactRevisionSourceIdentityHashBytesAndTextMustRevalidate',
  'packetHashSourceReferencesInfoboxAndParentOccurrenceMustRevalidate',
  'reviewReadinessRequiresExactlyOneMatchingNumberedVariantIndex',
  'reviewReadinessRequiresAUniqueExactParentDisplayToNumberedNameMatch',
  'sharedUnnumberedNamesCannotBecomeReviewReady',
  'ambiguousMultipleMatchesAndNoUniqueSignalsRequireAdditionalEvidence',
  'reviewCandidateVariantIndexIsNotABindingDecisionOrBoundVariant',
  'reviewReadinessCannotCreateIdentityMembershipRepeatabilityMechanicsMappingCompletenessOrOptimizerVerdicts',
  'inputEvidenceSourcesPacketsAndHashesMustBePreserved',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const STAGE_FIELDS = new Set([
  'contract', 'contentHash', 'blockers', 'state', 'sourceBindingEvidenceContentHash',
  'variantBindingEvidenceDispositions', 'variantBindingEvidenceDispositionSummary',
  'variantBindingEvidenceDispositionReview'
]);
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
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

export function compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence.v1'
    && policy.recordContract === 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-disposition.v1'
    && policy.auditContract === 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-disposition-audit.v1'
    && policy.inputState === 'multi_variant_structural_member_candidate_parent_occurrence_binding_evidence_captured_reviews_pending_gates_closed';
  const routeKeysValid = typeof policy.reviewReadyRouteKey === 'string' && policy.reviewReadyRouteKey.length > 0
    && typeof policy.additionalEvidenceRouteKey === 'string' && policy.additionalEvidenceRouteKey.length > 0
    && policy.reviewReadyRouteKey !== policy.additionalEvidenceRouteKey;
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractValid && routeKeysValid && invalidRules.length === 0 && forbidden.length === 0, contractValid, routeKeysValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function sourceIntegrity(source = {}, contentHash = hash) {
  const identity = source.sourcePageIdentity || {};
  const text = source.exactRevisionSourceText;
  const checks = {
    captureComplete: source.captureComplete === true && source.state === 'complete_exact_revision_source_capture_non_verdict',
    pageIdPresent: Number(identity.sourcePageId) > 0,
    titlePresent: typeof identity.resolvedTitle === 'string' && identity.resolvedTitle.length > 0,
    revisionPresent: typeof identity.sourceRevision === 'string' && identity.sourceRevision.length > 0,
    timestampPresent: typeof identity.sourceTimestamp === 'string' && identity.sourceTimestamp.length > 0,
    urlPresent: typeof identity.sourceUrl === 'string' && identity.sourceUrl.length > 0,
    textPresent: typeof text === 'string',
    hashMatches: typeof text === 'string' && contentHash(text) === identity.sourceContentHash,
    bytesMatch: typeof text === 'string' && Buffer.byteLength(text, 'utf8') === identity.sourceContentBytes,
    upstreamChecksPassed: Object.values(source.integrityChecks || {}).length > 0 && Object.values(source.integrityChecks || {}).every(Boolean),
    semanticVerdictNull: source.semanticVerdict === null
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function packetIntegrity(packet = {}, sourcesByKey = new Map(), contentHash = hash) {
  const subject = sourcesByKey.get(packet.subjectEvidence?.sourceKey);
  const parent = sourcesByKey.get(packet.parentOccurrenceEvidence?.sourceKey);
  const root = packet.subjectEvidence?.rootInfobox;
  const occurrence = packet.parentOccurrenceEvidence;
  const checks = {
    captureComplete: packet.captureComplete === true && packet.state === 'revision_pinned_parent_occurrence_variant_binding_evidence_captured_review_pending',
    packetHashMatches: typeof packet.packetContentHash === 'string' && contentHash(without(packet, 'packetContentHash')) === packet.packetContentHash,
    upstreamChecksPassed: Object.values(packet.integrityChecks || {}).length > 0 && Object.values(packet.integrityChecks || {}).every(Boolean),
    subjectSourceComplete: subject?.captureComplete === true,
    parentSourceComplete: parent?.captureComplete === true,
    subjectIdentityMatches: Boolean(subject && contentHash(subject.sourcePageIdentity) === contentHash(packet.subjectEvidence?.sourcePageIdentity)),
    parentIdentityMatches: Boolean(parent && contentHash(parent.sourcePageIdentity) === contentHash(occurrence?.sourcePageIdentity)),
    rootInfoboxHashMatches: typeof root?.exactSourceText === 'string' && contentHash(root.exactSourceText) === root.exactSourceTextContentHash,
    rootInfoboxOccursInSubject: typeof subject?.exactRevisionSourceText === 'string' && subject.exactRevisionSourceText.includes(root?.exactSourceText || ''),
    parentOccurrenceHashMatches: typeof occurrence?.exactSourceText === 'string' && contentHash(occurrence.exactSourceText) === occurrence.exactSourceTextContentHash,
    parentOccurrenceMatchesLocatedText: typeof occurrence?.locatedSourceText === 'string' && occurrence.locatedSourceText.includes(occurrence.exactSourceText || ''),
    parentOccurrenceOccursInParent: typeof parent?.exactRevisionSourceText === 'string' && parent.exactRevisionSourceText.includes(occurrence?.exactSourceText || ''),
    variantReviewOpen: packet.variantBindingReviewComplete === false && packet.bindingEvidence?.bindingReviewDecision === null && packet.bindingEvidence?.boundVariantIndex === null,
    semanticGatesClosed: packet.candidateMemberIdentityVerdict === null && packet.parentMembershipVerdict === null && packet.weightedTaskEntryMembershipVerdict === null && packet.mappingVerdict === null && packet.inventoryCompletenessVerdict === null && packet.memberUniverseComplete === false && packet.optimizerEligible === false && packet.automaticVerificationApplied === false
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function eligibleInput(record = {}, policy = {}, contentHash = hash) {
  const summary = record.variantBindingEvidenceSummary || {};
  const sources = record.exactRevisionSources || [];
  const packets = record.variantBindingEvidencePackets || [];
  const sourceChecks = sources.map(source => sourceIntegrity(source, contentHash));
  const sourcesByKey = new Map(sources.map(source => [source.sourceKey, source]));
  const packetChecks = packets.map(packet => packetIntegrity(packet, sourcesByKey, contentHash));
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && record.accountIndependent === true
    && typeof record.contentHash === 'string'
    && contentHash(without(record, 'contentHash')) === record.contentHash
    && sources.length > 0 && sourceChecks.every(item => item.complete)
    && packets.length > 0 && packetChecks.every(item => item.complete)
    && summary.sourceCount === sources.length
    && summary.completeSourceCount === sources.length
    && summary.evidencePacketCount === packets.length
    && summary.completeCapturePacketCount === packets.length
    && summary.evidenceCaptureComplete === true
    && summary.variantBindingReviewComplete === false
    && summary.bindingDecisionCount === 0
    && summary.boundVariantCount === 0
    && summary.automaticVerificationApplied === false
    && record.optimizerEligible !== true;
}

export function selectMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionInputs(records = [], policy = {}, contentHash = hash) {
  return records.filter(record => eligibleInput(record, policy, contentHash));
}

function classifyPacket(packet, policy, sourcesByKey, contentHash) {
  const integrity = packetIntegrity(packet, sourcesByKey, contentHash);
  const binding = packet.bindingEvidence || {};
  const matching = Array.isArray(binding.matchingVariantIndices) ? binding.matchingVariantIndices : [];
  const uniqueMatch = integrity.complete
    && binding.state === 'unique_exact_parent_display_to_numbered_name_match_review_pending'
    && binding.uniqueExactNumberedNameMatch === true
    && binding.reviewReadyForVariantBinding === true
    && matching.length === 1
    && Number.isInteger(matching[0])
    && packet.subjectEvidence?.numberedVariantIndices?.includes(matching[0]);
  const routeKey = uniqueMatch ? policy.reviewReadyRouteKey : policy.additionalEvidenceRouteKey;
  const blockers = uniqueMatch ? [] : unique([
    ...(integrity.complete ? [] : ['binding_evidence_packet_integrity_failed']),
    ...(binding.state === 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked' ? ['shared_unnumbered_name_does_not_discriminate_numbered_variant'] : []),
    ...(binding.state === 'ambiguous_multiple_numbered_variant_name_matches_review_blocked' ? ['multiple_numbered_variants_match_parent_display'] : []),
    ...(!matching.length ? ['no_unique_numbered_variant_match'] : []),
    ...(matching.length > 1 ? ['numbered_variant_match_not_unique'] : []),
    ...(!uniqueMatch && !binding.state ? ['binding_evidence_state_missing'] : [])
  ]);
  return {
    dispositionKey: `${packet.packetKey}|binding-evidence-disposition`,
    packetKey: packet.packetKey,
    sourceWorkItemKey: packet.sourceWorkItemKey,
    sourceDispositionKey: packet.sourceDispositionKey,
    structuralCandidateKey: packet.structuralCandidateKey,
    candidateRole: packet.candidateRole,
    evidenceIntegrity: integrity,
    sufficiencyDisposition: {
      routeKey,
      state: uniqueMatch ? 'review_ready_unique_exact_numbered_name_match_no_verdict' : 'blocked_parent_occurrence_variant_binding_evidence_not_sufficient',
      sourceBindingEvidenceState: binding.state || null,
      matchingVariantIndices: matching,
      reviewCandidateVariantIndex: uniqueMatch ? matching[0] : null,
      reviewReady: uniqueMatch,
      requiredAdditionalEvidenceChannels: uniqueMatch ? [] : [
        'candidate_scoped_parent_occurrence_context',
        'source_authored_numbered_variant_identity_alignment',
        'explicit_human_binding_review'
      ],
      bindingReviewDecision: null,
      boundVariantIndex: null
    },
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    canonicalGameEntityIdentity: null,
    memberUniverseComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    blockers,
    state: uniqueMatch ? 'review_ready_for_explicit_source_bound_variant_binding_no_verdict' : 'blocked_additional_variant_disambiguation_evidence_required'
  };
}

function expectedRecord(input, policy, contentHash) {
  const sourcesByKey = new Map(input.exactRevisionSources.map(source => [source.sourceKey, source]));
  const dispositions = input.variantBindingEvidencePackets.map(packet => classifyPacket(packet, policy, sourcesByKey, contentHash));
  const reviewReady = dispositions.filter(item => item.sufficiencyDisposition.reviewReady);
  const additional = dispositions.filter(item => !item.sufficiencyDisposition.reviewReady);
  const shared = dispositions.filter(item => item.sufficiencyDisposition.sourceBindingEvidenceState === 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked');
  const { contentHash: inputHash, blockers: inputBlockers = [], ...rest } = input;
  return {
    contract: policy.recordContract,
    ...preservedInput(rest),
    sourceBindingEvidenceContentHash: inputHash,
    variantBindingEvidenceDispositions: dispositions,
    variantBindingEvidenceDispositionSummary: {
      state: 'generic_fail_closed_binding_evidence_sufficiency_disposition_recorded_all_verdicts_closed',
      dispositionCount: dispositions.length,
      reviewReadyDispositionCount: reviewReady.length,
      additionalEvidenceDispositionCount: additional.length,
      sharedUnnumberedNameBlockedCount: shared.length,
      bindingDecisionCount: 0,
      boundVariantCount: 0,
      candidateMemberIdentityVerdictCount: 0,
      weightedTaskEntryMembershipVerdictCount: 0,
      repeatabilityVerdictCount: 0,
      mechanicsReviewCompleteCount: 0,
      mappingVerdictCount: 0,
      inventoryCompletenessVerdictCount: 0,
      optimizerEligibleCount: 0,
      memberUniverseComplete: false,
      automaticVerificationApplied: false
    },
    variantBindingEvidenceDispositionReview: {
      state: 'binding_review_readiness_classified_explicit_decisions_pending',
      reviewReadyDispositionKeys: reviewReady.map(item => item.dispositionKey),
      additionalEvidenceDispositionKeys: additional.map(item => item.dispositionKey),
      bindingReviewDecision: null,
      boundVariantIndex: null,
      candidateMemberIdentityVerdict: null,
      memberUniverseComplete: false,
      evidenceWorkComplete: false,
      automaticVerificationApplied: false
    },
    accountIndependent: true,
    blockers: unique([
      ...inputBlockers.filter(blocker => blocker !== 'multi_variant_parent_occurrence_binding_evidence_captured_reviews_pending'),
      'multi_variant_binding_evidence_sufficiency_disposition_recorded_explicit_reviews_pending',
      ...(reviewReady.length ? ['one_or_more_variant_bindings_ready_for_explicit_source_bound_review'] : []),
      ...(additional.length ? ['one_or_more_variant_bindings_require_additional_disambiguating_evidence'] : []),
      'candidate_member_identity_and_variant_binding_reviews_pending',
      'weighted_parent_task_entry_membership_not_proven',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'all_repeatability_evidence_domains_remain_unresolved',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    state: 'multi_variant_parent_occurrence_binding_evidence_sufficiency_disposition_recorded_all_verdicts_closed'
  };
}

function accountStateFindings(records = []) {
  const forbidden = /^(?:currentBaseLevel|targetBaseLevel|currentLevel|currentXp|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|bank|bankItems|playerName|username|preferences|currentAccount)$/i;
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
  return sorted(unique(findings));
}

export function auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions(records = [], { evidenceRecords = [], policy = {}, contentHash = hash } = {}) {
  const compiled = compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionPolicy(policy);
  const inputs = selectMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionInputs(evidenceRecords, policy, contentHash);
  const expected = compiled.valid ? inputs.map(input => expectedRecord(input, policy, contentHash)) : [];
  const inputKeys = inputs.map(item => item.memberCandidateKey);
  const outputKeys = records.map(item => item.memberCandidateKey);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const inputHashFailures = evidenceRecords.filter(record => typeof record.contentHash !== 'string' || contentHash(without(record, 'contentHash')) !== record.contentHash).map(record => record.memberCandidateKey || 'unknown');
  const sources = records.flatMap(record => record.exactRevisionSources || []);
  const sourceFailures = sources.filter(source => !sourceIntegrity(source, contentHash).complete).map(source => source.sourceKey);
  const expectedPacketKeys = inputs.flatMap(input => input.variantBindingEvidencePackets.map(packet => packet.packetKey));
  const dispositions = records.flatMap(record => record.variantBindingEvidenceDispositions || []);
  const dispositionPacketKeys = dispositions.map(item => item.packetKey);
  const duplicateDispositionPacketKeys = duplicates(dispositionPacketKeys);
  const missingDispositionPacketKeys = expectedPacketKeys.filter(key => !dispositionPacketKeys.includes(key));
  const unexpectedDispositionPacketKeys = dispositionPacketKeys.filter(key => !expectedPacketKeys.includes(key));
  const packetFailures = records.flatMap(record => {
    const byKey = new Map((record.exactRevisionSources || []).map(source => [source.sourceKey, source]));
    return (record.variantBindingEvidencePackets || []).filter(packet => !packetIntegrity(packet, byKey, contentHash).complete).map(packet => packet.packetKey);
  });
  const recordMismatches = records.filter(record => {
    const match = expected.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !match || contentHash(record) !== contentHash(match);
  }).map(item => item.memberCandidateKey || 'unknown');
  const upstreamMismatches = records.filter(record => {
    const input = inputs.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !input || contentHash(preservedInput(record)) !== contentHash(preservedInput(input));
  }).map(item => item.memberCandidateKey || 'unknown');
  const incorrectlyRouted = dispositions.filter(item => {
    const sourcePacket = records.flatMap(record => record.variantBindingEvidencePackets || []).find(packet => packet.packetKey === item.packetKey);
    if (!sourcePacket) return true;
    const matching = sourcePacket.bindingEvidence?.matchingVariantIndices || [];
    const shouldBeReady = sourcePacket.bindingEvidence?.state === 'unique_exact_parent_display_to_numbered_name_match_review_pending'
      && sourcePacket.bindingEvidence?.uniqueExactNumberedNameMatch === true
      && sourcePacket.bindingEvidence?.reviewReadyForVariantBinding === true
      && matching.length === 1 && Number.isInteger(matching[0])
      && sourcePacket.subjectEvidence?.numberedVariantIndices?.includes(matching[0]);
    return item.sufficiencyDisposition?.reviewReady !== shouldBeReady
      || item.sufficiencyDisposition?.routeKey !== (shouldBeReady ? policy.reviewReadyRouteKey : policy.additionalEvidenceRouteKey)
      || item.sufficiencyDisposition?.reviewCandidateVariantIndex !== (shouldBeReady ? matching[0] : null);
  }).map(item => item.dispositionKey);
  const unsupportedPromotions = records.filter(record => {
    const summary = record.variantBindingEvidenceDispositionSummary || {};
    const review = record.variantBindingEvidenceDispositionReview || {};
    return summary.bindingDecisionCount !== 0 || summary.boundVariantCount !== 0 || summary.candidateMemberIdentityVerdictCount !== 0 || summary.weightedTaskEntryMembershipVerdictCount !== 0 || summary.repeatabilityVerdictCount !== 0 || summary.mechanicsReviewCompleteCount !== 0 || summary.mappingVerdictCount !== 0 || summary.inventoryCompletenessVerdictCount !== 0 || summary.optimizerEligibleCount !== 0 || summary.memberUniverseComplete !== false || summary.automaticVerificationApplied !== false
      || review.bindingReviewDecision !== null || review.boundVariantIndex !== null || review.candidateMemberIdentityVerdict !== null || review.memberUniverseComplete !== false || review.evidenceWorkComplete !== false || review.automaticVerificationApplied !== false
      || (record.variantBindingEvidenceDispositions || []).some(item => item.sufficiencyDisposition?.bindingReviewDecision !== null || item.sufficiencyDisposition?.boundVariantIndex !== null || item.candidateMemberIdentityVerdict !== null || item.parentMembershipVerdict !== null || item.weightedTaskEntryMembershipVerdict !== null || item.repeatabilityVerdict !== null || item.mappingVerdict !== null || item.inventoryCompletenessVerdict !== null || item.canonicalGameEntityIdentity !== null || item.memberUniverseComplete !== false || item.mechanicsReviewComplete !== false || item.optimizerEligible !== false || item.automaticVerificationApplied !== false)
      || record.optimizerEligible === true;
  }).map(item => item.memberCandidateKey || 'unknown');
  const accountFindings = accountStateFindings(records);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('multi_variant_binding_evidence_disposition_policy_invalid_or_candidate_specific');
  if (evidenceRecords.length !== inputs.length || duplicateInputKeys.length || inputHashFailures.length) structuralBlockers.push('input_binding_evidence_record_set_not_exactly_eligible_unique_and_hash_valid');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('input_output_binding_evidence_disposition_record_set_mismatch');
  if (sourceFailures.length) structuralBlockers.push('one_or_more_exact_revision_sources_failed_revalidation');
  if (packetFailures.length) structuralBlockers.push('one_or_more_binding_evidence_packets_failed_revalidation');
  if (duplicateDispositionPacketKeys.length || missingDispositionPacketKeys.length || unexpectedDispositionPacketKeys.length) structuralBlockers.push('binding_evidence_disposition_packet_set_incomplete_or_mismatched');
  if (incorrectlyRouted.length) structuralBlockers.push('one_or_more_binding_evidence_packets_received_an_invalid_sufficiency_route');
  if (recordMismatches.length) structuralBlockers.push('one_or_more_binding_evidence_disposition_records_do_not_match_generic_policy_output');
  if (upstreamMismatches.length) structuralBlockers.push('input_binding_evidence_sources_packets_or_hashes_changed');
  if (unsupportedPromotions.length) structuralBlockers.push('binding_evidence_disposition_created_unsupported_decision_or_semantic_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = structuralBlockers.length === 0;
  const reviewReady = dispositions.filter(item => item.sufficiencyDisposition?.reviewReady === true);
  const additional = dispositions.filter(item => item.sufficiencyDisposition?.reviewReady === false);
  const shared = additional.filter(item => item.sufficiencyDisposition?.sourceBindingEvidenceState === 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked');
  return {
    contract: policy.auditContract,
    inputCoverage: { inputEvidenceRecordCount: evidenceRecords.length, eligibleEvidenceRecordCount: inputs.length, dispositionRecordCount: records.length, duplicateInputKeys, duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys, inputHashFailures },
    policyCoverage: compiled,
    sourceEvidenceIntegrityCoverage: { exactRevisionSourceCount: sources.length, revalidatedSourceCount: sources.length - sourceFailures.length, failedSourceKeys: sourceFailures, bindingEvidencePacketCount: expectedPacketKeys.length, revalidatedBindingEvidencePacketCount: expectedPacketKeys.length - packetFailures.length, failedPacketKeys: packetFailures },
    packetDispositionCoverage: { evidencePacketCount: expectedPacketKeys.length, dispositionCount: dispositions.length, duplicateDispositionPacketKeys, missingDispositionPacketKeys, unexpectedDispositionPacketKeys },
    sufficiencyDispositionCoverage: { reviewReadyCount: reviewReady.length, additionalEvidenceRequiredCount: additional.length, sharedUnnumberedNameBlockedCount: shared.length, incorrectlyRoutedDispositionKeys: incorrectlyRouted, bindingDecisionCount: 0, boundVariantCount: 0 },
    semanticPreservationCoverage: { recordMismatches, upstreamMismatches, unsupportedPromotions },
    accountStateFindings: accountFindings,
    dispositionCoverageComplete: publishable && dispositions.length === expectedPacketKeys.length,
    variantBindingReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'multi_variant_binding_evidence_sufficiency_disposition_recorded_explicit_reviews_pending',
      ...(reviewReady.length ? ['one_or_more_variant_bindings_ready_for_explicit_source_bound_review'] : []),
      ...(additional.length ? ['one_or_more_variant_bindings_require_additional_disambiguating_evidence'] : []),
      'candidate_member_identity_and_variant_binding_reviews_pending',
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

export function buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions({ evidenceRecords = [], policy = {}, contentHash = hash } = {}) {
  const compiled = compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionPolicy(policy);
  const records = compiled.valid ? selectMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionInputs(evidenceRecords, policy, contentHash).map(input => expectedRecord(input, policy, contentHash)) : [];
  return { records, audit: auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions(records, { evidenceRecords, policy, contentHash }) };
}
