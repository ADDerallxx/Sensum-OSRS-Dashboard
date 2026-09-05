import { hash } from '../ingestion/lib.mjs';

const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => !keys.includes(name)));
const same = (left, right) => hash(left) === hash(right);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|title|titles|candidateKey|candidateKeys|structuralCandidateKey|structuralCandidateKeys|label|labels|alias|aliases|override|overrides)$/i;
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

export function compileMultiVariantBindingAdditionalEvidenceSufficiencyDispositionPolicy(policy = {}) {
  const requiredRules = [
    'oneDispositionPerSourceDiscoveryPacket',
    'sourcePacketRecordAndSnapshotBindingsMustRevalidate',
    'allPinnedAndDiscoveredSourceIntegrityMustRemainComplete',
    'canonicalContextRequiresCandidateScopedParentContextEvidence',
    'exactVariantReviewRequiresSourceAuthoredNumberedVariantAlignmentEvidence',
    'canonicalContextWithoutExactAlignmentRoutesToCanonicalSubjectScopeReview',
    'missingCanonicalContextRoutesToAdditionalEvidence',
    'normalVariantCannotBeSelectedFromCanonicalContextOrDisplayOrder',
    'reviewReadinessDoesNotRecordAReviewDecision',
    'identityMembershipRepeatabilityMechanicsMappingCompletenessAndOptimizerVerdictsRemainClosed',
    'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterClassification',
    'currentAccountStateIsForbidden'
  ];
  const expectedClassifications = [
    'canonical_subject_context_observed_exact_numbered_variant_alignment_absent',
    'exact_numbered_variant_alignment_observed_review_required',
    'candidate_context_not_observed_additional_evidence_required'
  ];
  const expectedRoutes = ['canonical_subject_scope_review', 'exact_numbered_variant_binding_review', 'additional_binding_evidence'];
  const expectedCanonicalDecisions = [
    'confirm_parent_occurrence_refers_to_canonical_subject_across_numbered_variants',
    'require_exact_numbered_variant_binding',
    'reject_parent_occurrence_subject_relation',
    'needs_additional_evidence'
  ];
  const expectedExactDecisions = [
    'confirm_exact_parent_occurrence_to_numbered_variant_binding',
    'reject_exact_parent_occurrence_to_numbered_variant_binding',
    'needs_additional_evidence'
  ];
  const invalidRules = requiredRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.multi-variant-binding-additional-evidence-source-discovery.v1'
    && policy.recordContract === 'sensum.multi-variant-binding-additional-evidence-sufficiency-disposition.v1'
    && policy.auditContract === 'sensum.multi-variant-binding-additional-evidence-sufficiency-disposition-audit.v1'
    && policy.inputState === 'revision_pinned_additional_variant_binding_source_discovery_gates_closed'
    && policy.recordState === 'additional_variant_binding_evidence_sufficiency_disposition_gates_closed';
  const classificationValid = same(policy.classifications || [], expectedClassifications);
  const routesValid = same(policy.reviewRoutes || [], expectedRoutes);
  const decisionsValid = same(policy.canonicalSubjectScopeReviewDecisions || [], expectedCanonicalDecisions)
    && same(policy.exactNumberedVariantReviewDecisions || [], expectedExactDecisions);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && classificationValid && routesValid && decisionsValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    classificationValid,
    routesValid,
    decisionsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function sourcePacketIntegrity(record = {}, policy = {}, contentHash = hash) {
  const base = without(record, 'recordContentHash', 'contentHash');
  const withRecordHash = without(record, 'contentHash');
  const sourceKeys = new Set((record.candidateSourcePages || []).map(page => page.sourceKey));
  const pageFailures = (record.candidateSourcePages || []).filter(page => !page.complete
    || !page.sourceKey || !page.sourceRevision || !page.sourceTimestamp || !page.sourceUrl
    || typeof page.sourceText !== 'string'
    || contentHash(page.sourceText) !== page.sourceContentHash
    || new TextEncoder().encode(page.sourceText).length !== Number(page.sourceContentBytes));
  const observationSourceKeys = [
    ...(record.candidateScopedParentContextObservations || []),
    ...(record.numberedVariantIdentityObservations || []),
    ...(record.exactTaskToNumberedVariantAlignmentObservations || [])
  ].map(observation => observation.sourceKey);
  const contextObserved = (record.candidateScopedParentContextObservations || []).length > 0;
  const alignmentObserved = (record.exactTaskToNumberedVariantAlignmentObservations || []).length > 0;
  const statusByChannel = new Map((record.requiredChannelStatus || []).map(status => [status.channel, status]));
  const checks = {
    contractMatches: record.contract === policy.inputContract,
    stateMatches: record.state === policy.inputState,
    recordContentHashMatches: typeof record.recordContentHash === 'string' && contentHash(base) === record.recordContentHash,
    snapshotRecordContentHashMatches: typeof record.contentHash === 'string' && contentHash(withRecordHash) === record.contentHash,
    sourceQueueSnapshotHashPresent: typeof record.sourceQueueSnapshotContentHash === 'string' && record.sourceQueueSnapshotContentHash.length === 64,
    evidenceBindingsPresent: typeof record.evidencePacketKey === 'string' && typeof record.workQueueEntryKey === 'string'
      && typeof record.sourceDispositionKey === 'string' && typeof record.sourceEvidencePacketContentHash === 'string'
      && typeof record.evidenceFingerprint === 'string',
    pinnedSourcesComplete: Array.isArray(record.pinnedSourceRevalidations) && record.pinnedSourceRevalidations.length > 0 && record.pinnedSourceRevalidations.every(source => source.complete === true && Object.values(source.checks || {}).every(Boolean)),
    discoveryQueriesComplete: Array.isArray(record.discoveryQueries) && record.discoveryQueries.length > 0 && record.discoveryQueries.every(query => query.continuationExhausted === true && query.truncated === false && query.returnedCount === query.results?.length && query.totalHits === query.results?.length),
    candidateSourcesComplete: Array.isArray(record.candidateSourcePages) && record.candidateSourcePages.length > 0 && pageFailures.length === 0,
    observationSourcesRetained: observationSourceKeys.every(key => sourceKeys.has(key)),
    candidateContextStatusMatches: statusByChannel.get('candidate_scoped_parent_occurrence_context')?.satisfiedByCapturedEvidence === contextObserved,
    numberedAlignmentStatusMatches: statusByChannel.get('source_authored_numbered_variant_identity_alignment')?.satisfiedByCapturedEvidence === alignmentObserved,
    humanReviewStatusUnmet: statusByChannel.get('explicit_human_binding_review')?.satisfiedByCapturedEvidence === false && statusByChannel.get('explicit_human_binding_review')?.humanReviewRequired === true,
    noReviewOrVariantSelected: record.reviewCandidateVariantIndex === null && record.bindingReviewDecision === null && record.boundVariantIndex === null && record.evidenceReviewer === null && record.evidenceReviewedAt === null && record.evidenceNotes === null,
    semanticGatesClosed: record.candidateMemberIdentityVerdict === null && record.parentMembershipVerdict === null
      && record.weightedTaskEntryMembershipVerdict === null && record.repeatabilityVerdict === null
      && record.mechanicsReviewComplete === false && record.mappingVerdict === null
      && record.inventoryCompletenessVerdict === null && record.memberUniverseComplete === false
      && record.optimizerEligible === false && record.automaticVerificationApplied === false,
    accountIndependent: record.accountIndependent === true
  };
  return { checks, pageFailures: pageFailures.map(page => page.sourceKey || page.resolvedTitle || 'unknown'), complete: Object.values(checks).every(Boolean) };
}

function classify(record, policy) {
  const contextObserved = (record.candidateScopedParentContextObservations || []).length > 0;
  const alignmentObserved = (record.exactTaskToNumberedVariantAlignmentObservations || []).length > 0;
  if (!contextObserved) return {
    classification: policy.classifications[2],
    canonicalSubjectContextEvidenceState: 'not_observed',
    exactNumberedVariantAlignmentEvidenceState: alignmentObserved ? 'observed_without_candidate_parent_context_not_review_ready' : 'not_observed',
    reviewRoute: policy.reviewRoutes[2],
    allowedReviewDecisions: [],
    blockers: ['candidate_scoped_parent_occurrence_context_not_observed', 'additional_variant_binding_evidence_required']
  };
  if (alignmentObserved) return {
    classification: policy.classifications[1],
    canonicalSubjectContextEvidenceState: 'observed_for_explicit_scope_review',
    exactNumberedVariantAlignmentEvidenceState: 'observed_for_explicit_binding_review',
    reviewRoute: policy.reviewRoutes[1],
    allowedReviewDecisions: [...policy.exactNumberedVariantReviewDecisions],
    blockers: ['exact_numbered_variant_binding_review_pending']
  };
  return {
    classification: policy.classifications[0],
    canonicalSubjectContextEvidenceState: 'observed_for_explicit_scope_review',
    exactNumberedVariantAlignmentEvidenceState: 'not_observed',
    reviewRoute: policy.reviewRoutes[0],
    allowedReviewDecisions: [...policy.canonicalSubjectScopeReviewDecisions],
    blockers: ['exact_numbered_variant_alignment_not_observed', 'canonical_subject_scope_review_pending']
  };
}

function dispositionRecord(record, policy, sourceSnapshotContentHash, contentHash = hash) {
  const result = classify(record, policy);
  const base = {
    contract: policy.recordContract,
    dispositionKey: `${record.evidencePacketKey}|sufficiency-disposition|${contentHash({ classification: result.classification, reviewRoute: result.reviewRoute, evidencePacket: record.recordContentHash })}`,
    sourceEvidencePacketKey: record.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: record.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: sourceSnapshotContentHash,
    sourceDispositionKey: record.sourceDispositionKey,
    structuralCandidateKey: record.structuralCandidateKey,
    candidateRole: record.candidateRole,
    candidateDisplayName: record.candidateDisplayName,
    classification: result.classification,
    canonicalSubjectContextEvidenceState: result.canonicalSubjectContextEvidenceState,
    exactNumberedVariantAlignmentEvidenceState: result.exactNumberedVariantAlignmentEvidenceState,
    reviewRoute: result.reviewRoute,
    allowedReviewDecisions: result.allowedReviewDecisions,
    reviewDecision: null,
    reviewCandidateVariantIndex: null,
    bindingReviewDecision: null,
    boundVariantIndex: null,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mechanicsReviewComplete: false,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: result.blockers,
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function accountStateFindings(values = []) {
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
  values.forEach((value, index) => walk(value, `[${index}]`));
  return findings;
}

function preflight(evidencePackets, policy, sourceSnapshotContentHash, contentHash = hash) {
  const compiled = compileMultiVariantBindingAdditionalEvidenceSufficiencyDispositionPolicy(policy);
  const inputAssessments = evidencePackets.map(record => ({ evidencePacketKey: record.evidencePacketKey, integrity: sourcePacketIntegrity(record, policy, contentHash) }));
  const duplicateInputKeys = duplicates(evidencePackets.map(record => record.evidencePacketKey));
  const failures = [];
  if (!compiled.valid) failures.push('sufficiency_disposition_policy_invalid_or_candidate_specific');
  if (!evidencePackets.length) failures.push('no_source_discovery_packets');
  if (duplicateInputKeys.length) failures.push('duplicate_source_discovery_packet_keys');
  if (typeof sourceSnapshotContentHash !== 'string' || sourceSnapshotContentHash.length !== 64) failures.push('source_snapshot_content_hash_missing_or_invalid');
  if (inputAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_source_discovery_packets_failed_revalidation');
  if (accountStateFindings(evidencePackets).length) failures.push('current_account_state_present');
  const records = failures.length ? [] : evidencePackets.map(record => dispositionRecord(record, policy, sourceSnapshotContentHash, contentHash));
  return { compiled, inputAssessments, duplicateInputKeys, failures, records };
}

export function auditMultiVariantBindingAdditionalEvidenceSufficiencyDisposition(records = [], { evidencePackets = [], policy = {}, sourceSnapshotContentHash = '', contentHash = hash } = {}) {
  const flight = preflight(evidencePackets, policy, sourceSnapshotContentHash, contentHash);
  const inputKeys = evidencePackets.map(record => record.evidencePacketKey);
  const outputKeys = records.map(record => record.sourceEvidencePacketKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !flight.records[index] || !same(record, flight.records[index])).map(record => record.dispositionKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.reviewDecision !== null || record.reviewCandidateVariantIndex !== null || record.bindingReviewDecision !== null || record.boundVariantIndex !== null
    || record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null
    || record.weightedTaskEntryMembershipVerdict !== null || record.repeatabilityVerdict !== null
    || record.mechanicsReviewComplete !== false || record.mappingVerdict !== null
    || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).map(record => record.dispositionKey || 'unknown');
  const accountFindings = accountStateFindings([...evidencePackets, ...records]);
  const failures = [...flight.failures];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) failures.push('input_and_output_disposition_sets_do_not_match_exactly');
  if (recordMismatches.length) failures.push('one_or_more_dispositions_do_not_match_generic_evidence_sufficiency_rules');
  if (unsupportedPromotions.length) failures.push('disposition_created_unsupported_review_binding_semantic_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const publishable = failures.length === 0;
  const count = classification => records.filter(record => record.classification === classification).length;
  const routeCount = route => records.filter(record => record.reviewRoute === route).length;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputEvidencePacketCount: evidencePackets.length,
      completeEvidencePacketCount: flight.inputAssessments.filter(item => item.integrity.complete).length,
      failedEvidencePacketKeys: flight.inputAssessments.filter(item => !item.integrity.complete).map(item => item.evidencePacketKey),
      duplicateInputKeys: flight.duplicateInputKeys,
      sourceSnapshotContentHash
    },
    policyCoverage: flight.compiled,
    sourceIntegrityCoverage: {
      retainedCurrentSourceCount: unique(evidencePackets.flatMap(record => record.candidateSourcePages || []).map(page => page.sourceKey)).length,
      completeCurrentSourceCount: unique(evidencePackets.flatMap(record => record.candidateSourcePages || []).filter(page => page.complete).map(page => page.sourceKey)).length,
      retainedPinnedSourceCount: unique(evidencePackets.flatMap(record => record.pinnedSourceRevalidations || []).map(source => source.sourceKey)).length,
      completePinnedSourceCount: unique(evidencePackets.flatMap(record => record.pinnedSourceRevalidations || []).filter(source => source.complete).map(source => source.sourceKey)).length
    },
    dispositionCoverage: {
      outputDispositionCount: records.length,
      duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys, recordMismatches,
      classificationDistribution: Object.fromEntries((policy.classifications || []).map(classification => [classification, count(classification)]))
    },
    reviewRoutingCoverage: {
      routeDistribution: Object.fromEntries((policy.reviewRoutes || []).map(route => [route, routeCount(route)])),
      canonicalSubjectScopeReviewCount: routeCount('canonical_subject_scope_review'),
      exactNumberedVariantBindingReviewCount: routeCount('exact_numbered_variant_binding_review'),
      additionalBindingEvidenceCount: routeCount('additional_binding_evidence'),
      recordedReviewDecisionCount: records.filter(record => record.reviewDecision !== null).length
    },
    semanticPreservationCoverage: {
      reviewCandidateVariantIndexCount: records.filter(record => record.reviewCandidateVariantIndex !== null).length,
      boundVariantCount: records.filter(record => record.boundVariantIndex !== null).length,
      semanticVerdictCount: records.filter(record => record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null
        || record.weightedTaskEntryMembershipVerdict !== null || record.repeatabilityVerdict !== null
        || record.mechanicsReviewComplete || record.mappingVerdict !== null
        || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    dispositionCoverageComplete: publishable,
    variantBindingReviewComplete: false,
    optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(routeCount('canonical_subject_scope_review') ? ['one_or_more_canonical_subject_scope_reviews_pending'] : []),
      ...(routeCount('exact_numbered_variant_binding_review') ? ['one_or_more_exact_numbered_variant_binding_reviews_pending'] : []),
      ...(routeCount('additional_binding_evidence') ? ['one_or_more_variant_bindings_require_additional_evidence'] : []),
      'candidate_member_identity_and_variant_binding_reviews_not_completed',
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

export function buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition({ evidencePackets = [], policy = {}, sourceSnapshotContentHash = '', contentHash = hash } = {}) {
  const flight = preflight(evidencePackets, policy, sourceSnapshotContentHash, contentHash);
  const records = flight.failures.length ? [] : flight.records;
  return { records, audit: auditMultiVariantBindingAdditionalEvidenceSufficiencyDisposition(records, { evidencePackets, policy, sourceSnapshotContentHash, contentHash }) };
}
