import { hash } from '../ingestion/lib.mjs';

const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => !keys.includes(name)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);

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

export function compileWeightedMembershipAdditionalEvidenceSufficiencyDispositionPolicy(policy = {}) {
  const requiredRules = [
    'oneDispositionPerSourceDiscoveryPacket',
    'sourcePacketRecordSnapshotAndUpstreamBindingsMustRevalidate',
    'allPinnedAndDiscoveredSourceIntegrityMustRemainComplete',
    'allObservationTextHashesAndSourceBindingsMustRevalidate',
    'exactParentSectionReviewRequiresExactStructuredCandidateReferenceOnPinnedParentSource',
    'candidateRelationshipContextWithoutExactParentSectionRoutesToSeparateReview',
    'missingCandidateRelationshipEvidenceRoutesToAdditionalEvidence',
    'sourceSilenceIsNotNegativeEvidence',
    'searchResultsAndLexicalContextCannotCreateMembership',
    'reviewReadinessDoesNotRecordAReviewDecision',
    'identityMembershipRepeatabilityMechanicsMappingCompletenessAndOptimizerVerdictsRemainClosed',
    'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterClassification',
    'currentAccountStateIsForbidden'
  ];
  const expectedClassifications = [
    'exact_candidate_reference_in_pinned_parent_relationship_section_review_required',
    'candidate_relationship_context_observed_review_required',
    'candidate_relationship_evidence_not_observed_additional_evidence_required'
  ];
  const expectedRoutes = ['exact_parent_section_membership_review', 'candidate_relationship_context_review', 'additional_candidate_membership_evidence'];
  const expectedExactDecisions = ['confirm_parent_section_declares_candidate_as_task_member', 'reject_parent_section_declares_candidate_as_task_member', 'needs_additional_evidence'];
  const expectedContextDecisions = ['confirm_candidate_relationship_evidence_supports_membership', 'reject_candidate_relationship_evidence_supports_membership', 'needs_additional_evidence'];
  const invalidRules = requiredRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-source-discovery.v1'
    && policy.recordContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition.v1'
    && policy.auditContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition-audit.v1'
    && policy.inputState === 'revision_pinned_weighted_membership_additional_source_discovery_gates_closed'
    && policy.recordState === 'weighted_membership_additional_evidence_sufficiency_disposition_gates_closed';
  const classificationValid = same(policy.classifications || [], expectedClassifications);
  const routesValid = same(policy.reviewRoutes || [], expectedRoutes);
  const decisionsValid = same(policy.exactParentSectionReviewDecisions || [], expectedExactDecisions)
    && same(policy.candidateRelationshipReviewDecisions || [], expectedContextDecisions);
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

function pageIntegrity(page = {}, contentHash = hash) {
  const checks = {
    markedComplete: page.complete === true,
    identityPresent: Boolean(page.sourceKey && page.sourcePageId && page.sourceRevision && page.sourceTimestamp && page.sourceUrl),
    completeSourcePresent: typeof page.sourceText === 'string',
    sourceHashMatches: typeof page.sourceText === 'string' && contentHash(page.sourceText) === page.sourceContentHash,
    sourceBytesMatch: typeof page.sourceText === 'string' && new TextEncoder().encode(page.sourceText).length === Number(page.sourceContentBytes)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function observationIntegrity(observation = {}, pagesByKey = new Map(), textField, hashField, contentHash = hash) {
  const page = pagesByKey.get(observation.sourceKey);
  const text = observation[textField];
  const checks = {
    sourceRetained: Boolean(page),
    exactTextPresent: typeof text === 'string' && text.length > 0,
    exactTextHashMatches: typeof text === 'string' && contentHash(text) === observation[hashField],
    exactTextOccursInSource: typeof text === 'string' && typeof page?.sourceText === 'string' && page.sourceText.includes(text)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function parentSources(record = {}) {
  return (record.pinnedSourceRevalidations || []).filter(source => source.sourceRoles?.includes('parent_inventory_source'));
}

export function exactPinnedParentSectionEvidence(record = {}, contentHash = hash) {
  const parentPageIds = new Set(parentSources(record).map(source => Number(source.sourcePageId)));
  const pagesByKey = new Map((record.candidateSourcePages || []).map(page => [page.sourceKey, page]));
  return (record.candidateScopedMembershipSignalObservations || []).filter(observation => {
    if (!parentPageIds.has(Number(pagesByKey.get(observation.sourceKey)?.sourcePageId))) return false;
    if (observation.candidateMentionBasis !== 'exact_structured_source_reference') return false;
    if (typeof observation.exactSectionText !== 'string' || contentHash(observation.exactSectionText) !== observation.exactSectionTextContentHash) return false;
    if (record.parentSectionContext?.heading && observation.heading !== record.parentSectionContext.heading) return false;
    return true;
  });
}

function sourcePacketIntegrity(record = {}, policy = {}, contentHash = hash) {
  const base = without(record, 'recordContentHash', 'contentHash');
  const withRecordHash = without(record, 'contentHash');
  const pages = record.candidateSourcePages || [];
  const pagesByKey = new Map(pages.map(page => [page.sourceKey, page]));
  const pageFailures = pages.filter(page => !pageIntegrity(page, contentHash).complete).map(page => page.sourceKey || page.resolvedTitle || 'unknown');
  const contextFailures = (record.candidateParentContextObservations || []).filter(observation => !observationIntegrity(observation, pagesByKey, 'exactSectionText', 'exactSectionTextContentHash', contentHash).complete);
  const membershipFailures = (record.candidateScopedMembershipSignalObservations || []).filter(observation => !observationIntegrity(observation, pagesByKey, 'exactSectionText', 'exactSectionTextContentHash', contentHash).complete
    || !['exact_structured_source_reference', 'exact_candidate_subject_page'].includes(observation.candidateMentionBasis));
  const weightFailures = (record.candidateScopedWeightSignalObservations || []).filter(observation => !observationIntegrity(observation, pagesByKey, 'exactSourceText', 'exactSourceTextContentHash', contentHash).complete);
  const sourceKeys = [...pagesByKey.keys()].sort();
  const relationshipObserved = (record.candidateScopedMembershipSignalObservations || []).length > 0;
  const weightOrMembershipObserved = relationshipObserved || (record.candidateScopedWeightSignalObservations || []).length > 0;
  const statusByChannel = new Map((record.requiredChannelStatus || []).map(status => [status.channel, status]));
  const checks = {
    contractMatches: record.contract === policy.inputContract,
    stateMatches: record.state === policy.inputState,
    recordContentHashMatches: typeof record.recordContentHash === 'string' && contentHash(base) === record.recordContentHash,
    snapshotRecordContentHashMatches: typeof record.contentHash === 'string' && contentHash(withRecordHash) === record.contentHash,
    upstreamBindingsPresent: [record.evidencePacketKey, record.workQueueEntryKey, record.sourceWorkQueueRecordContentHash, record.sourceQueueSnapshotContentHash, record.sourceDispositionKey, record.sourceEvidencePacketContentHash, record.evidenceFingerprint, record.structuralCandidateKey].every(value => typeof value === 'string' && value.length > 0),
    pinnedSourcesComplete: Array.isArray(record.pinnedSourceRevalidations) && record.pinnedSourceRevalidations.length > 0 && record.pinnedSourceRevalidations.every(source => source.complete === true && Object.values(source.checks || {}).every(Boolean)),
    pinnedParentSourcePresent: parentSources(record).length === 1,
    discoveryQueriesComplete: Array.isArray(record.discoveryQueries) && record.discoveryQueries.length > 0 && record.discoveryQueries.every(query => query.continuationExhausted === true && query.truncated === false && query.returnedCount === query.results?.length && query.totalHits === query.results?.length),
    candidateSourcesComplete: pages.length > 0 && pageFailures.length === 0,
    newEvidenceKeysMatchRetainedSources: same([...(record.newEvidenceKeys || [])].sort(), sourceKeys, contentHash),
    contextObservationsComplete: contextFailures.length === 0,
    membershipObservationsComplete: membershipFailures.length === 0,
    weightObservationsComplete: weightFailures.length === 0,
    relationshipChannelMatches: statusByChannel.get('candidate_subject_parent_task_relationship_statement')?.satisfiedByCapturedEvidence === relationshipObserved,
    membershipOrWeightChannelMatches: statusByChannel.get('candidate_scoped_weight_or_membership_statement')?.satisfiedByCapturedEvidence === weightOrMembershipObserved,
    humanReviewStatusUnmet: statusByChannel.get('explicit_source_bound_human_review')?.satisfiedByCapturedEvidence === false && statusByChannel.get('explicit_source_bound_human_review')?.humanReviewRequired === true,
    sourceSilenceNotNegative: record.sourceSilenceIsNotNegativeEvidence === true,
    noReviewRecorded: record.evidenceReviewer === null && record.evidenceReviewedAt === null && record.evidenceNotes === null,
    semanticGatesClosed: record.candidateMemberIdentityVerdict === null && record.parentMembershipVerdict === null && record.weightedTaskEntryMembershipVerdict === null
      && record.repeatabilityVerdict === null && record.mechanicsReviewComplete === false && record.mappingVerdict === null
      && record.inventoryCompletenessVerdict === null && record.memberUniverseComplete === false && record.optimizerEligible === false
      && record.automaticVerificationApplied === false,
    accountIndependent: record.accountIndependent === true
  };
  return {
    checks,
    pageFailures,
    contextObservationFailureCount: contextFailures.length,
    membershipObservationFailureCount: membershipFailures.length,
    weightObservationFailureCount: weightFailures.length,
    complete: Object.values(checks).every(Boolean)
  };
}

function classify(record, policy, contentHash = hash) {
  const parentEvidence = exactPinnedParentSectionEvidence(record, contentHash);
  const relationshipEvidence = record.candidateScopedMembershipSignalObservations || [];
  if (parentEvidence.length > 0) return {
    classification: policy.classifications[0],
    parentSectionMembershipEvidenceState: 'exact_structured_candidate_reference_observed_on_pinned_parent_source_for_explicit_review',
    candidateRelationshipContextEvidenceState: 'observed_for_explicit_review',
    reviewRoute: policy.reviewRoutes[0],
    allowedReviewDecisions: [...policy.exactParentSectionReviewDecisions],
    parentEvidence,
    relationshipEvidence,
    blockers: ['exact_parent_section_membership_review_pending']
  };
  if (relationshipEvidence.length > 0) return {
    classification: policy.classifications[1],
    parentSectionMembershipEvidenceState: 'not_observed',
    candidateRelationshipContextEvidenceState: 'observed_outside_exact_pinned_parent_section_for_explicit_review',
    reviewRoute: policy.reviewRoutes[1],
    allowedReviewDecisions: [...policy.candidateRelationshipReviewDecisions],
    parentEvidence: [],
    relationshipEvidence,
    blockers: ['exact_structured_candidate_reference_on_pinned_parent_source_not_observed', 'candidate_relationship_context_review_pending']
  };
  return {
    classification: policy.classifications[2],
    parentSectionMembershipEvidenceState: 'not_observed',
    candidateRelationshipContextEvidenceState: 'not_observed',
    reviewRoute: policy.reviewRoutes[2],
    allowedReviewDecisions: [],
    parentEvidence: [],
    relationshipEvidence: [],
    blockers: ['candidate_relationship_evidence_not_observed', 'source_silence_is_not_negative_evidence', 'additional_candidate_membership_evidence_required']
  };
}

function evidenceBinding(observation = {}, pagesByKey = new Map(), contentHash = hash) {
  const page = pagesByKey.get(observation.sourceKey);
  return {
    sourceKey: observation.sourceKey,
    sourceRevision: page?.sourceRevision || null,
    sourceContentHash: page?.sourceContentHash || null,
    heading: observation.heading ?? null,
    headingLine: observation.headingLine ?? null,
    lineStart: observation.lineStart ?? observation.line ?? null,
    lineEnd: observation.lineEnd ?? observation.line ?? null,
    exactEvidenceTextContentHash: observation.exactSectionTextContentHash || observation.exactSourceTextContentHash || null,
    observationContentHash: contentHash(observation)
  };
}

function dispositionRecord(record, policy, sourceSnapshotContentHash, contentHash = hash) {
  const result = classify(record, policy, contentHash);
  const pagesByKey = new Map((record.candidateSourcePages || []).map(page => [page.sourceKey, page]));
  const parentSectionEvidenceBindings = result.parentEvidence.map(observation => evidenceBinding(observation, pagesByKey, contentHash));
  const candidateRelationshipEvidenceBindings = result.relationshipEvidence.map(observation => evidenceBinding(observation, pagesByKey, contentHash));
  const base = {
    contract: policy.recordContract,
    dispositionKey: `${record.evidencePacketKey}|sufficiency-disposition|${contentHash({ classification: result.classification, reviewRoute: result.reviewRoute, parentSectionEvidenceBindings, candidateRelationshipEvidenceBindings })}`,
    sourceEvidencePacketKey: record.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: record.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: sourceSnapshotContentHash,
    sourceWorkQueueEntryKey: record.workQueueEntryKey,
    sourceDispositionKey: record.sourceDispositionKey,
    structuralCandidateKey: record.structuralCandidateKey,
    candidateRole: record.candidateRole,
    candidateDisplay: record.candidateDisplay,
    classification: result.classification,
    parentSectionMembershipEvidenceState: result.parentSectionMembershipEvidenceState,
    candidateRelationshipContextEvidenceState: result.candidateRelationshipContextEvidenceState,
    reviewRoute: result.reviewRoute,
    allowedReviewDecisions: result.allowedReviewDecisions,
    parentSectionEvidenceBindings,
    candidateRelationshipEvidenceBindings,
    reviewDecision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
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

function preflight(evidencePackets = [], policy = {}, sourceSnapshotContentHash = '', contentHash = hash) {
  const compiled = compileWeightedMembershipAdditionalEvidenceSufficiencyDispositionPolicy(policy);
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

export function auditWeightedMembershipAdditionalEvidenceSufficiencyDisposition(records = [], {
  evidencePackets = [], policy = {}, sourceSnapshotContentHash = '', contentHash = hash
} = {}) {
  const flight = preflight(evidencePackets, policy, sourceSnapshotContentHash, contentHash);
  const inputKeys = evidencePackets.map(record => record.evidencePacketKey);
  const outputKeys = records.map(record => record.sourceEvidencePacketKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !flight.records[index] || !same(record, flight.records[index], contentHash)).map(record => record.dispositionKey || 'unknown');
  const routeCounts = Object.fromEntries((policy.reviewRoutes || []).map(route => [route, records.filter(record => record.reviewRoute === route).length]));
  const invalidRoutes = records.filter(record => !(policy.reviewRoutes || []).includes(record.reviewRoute)).map(record => record.dispositionKey);
  const classificationMismatches = records.filter(record => {
    const source = evidencePackets.find(packet => packet.evidencePacketKey === record.sourceEvidencePacketKey);
    if (!source) return true;
    const expected = classify(source, policy, contentHash);
    return record.classification !== expected.classification || record.reviewRoute !== expected.reviewRoute
      || !same(record.allowedReviewDecisions, expected.allowedReviewDecisions, contentHash);
  }).map(record => record.dispositionKey);
  const unsupportedPromotions = records.filter(record => record.reviewDecision !== null || record.reviewer !== null || record.reviewedAt !== null || record.reviewNotes !== null
    || record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null || record.weightedTaskEntryMembershipVerdict !== null
    || record.repeatabilityVerdict !== null || record.mechanicsReviewComplete !== false || record.mappingVerdict !== null
    || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete !== false || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false).map(record => record.dispositionKey || 'unknown');
  const accountFindings = accountStateFindings([...evidencePackets, ...records]);
  const failures = [...flight.failures];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) failures.push('input_and_output_disposition_sets_do_not_match_exactly');
  if (recordMismatches.length) failures.push('one_or_more_dispositions_do_not_match_policy_bound_evidence');
  if (invalidRoutes.length || classificationMismatches.length) failures.push('one_or_more_disposition_classifications_or_routes_invalid');
  if (unsupportedPromotions.length) failures.push('sufficiency_disposition_created_unsupported_review_semantic_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const publishable = failures.length === 0;
  const exactReviewCount = routeCounts.exact_parent_section_membership_review || 0;
  const contextReviewCount = routeCounts.candidate_relationship_context_review || 0;
  const additionalCount = routeCounts.additional_candidate_membership_evidence || 0;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputEvidencePacketCount: evidencePackets.length,
      completeEvidencePacketCount: flight.inputAssessments.filter(item => item.integrity.complete).length,
      failedEvidencePacketKeys: flight.inputAssessments.filter(item => !item.integrity.complete).map(item => item.evidencePacketKey),
      duplicateInputKeys: flight.duplicateInputKeys,
      duplicateOutputKeys,
      missingOutputKeys,
      unexpectedOutputKeys,
      sourceSnapshotContentHash
    },
    policyCoverage: flight.compiled,
    sourceIntegrityCoverage: {
      retainedCurrentSourceCount: unique(evidencePackets.flatMap(record => (record.candidateSourcePages || []).map(page => page.sourceKey))).length,
      revalidatedPinnedSourceCount: unique(evidencePackets.flatMap(record => (record.pinnedSourceRevalidations || []).filter(source => source.complete).map(source => source.sourceKey))).length,
      failedPacketIntegrityCount: flight.inputAssessments.filter(item => !item.integrity.complete).length
    },
    dispositionCoverage: {
      dispositionCount: records.length,
      recordMismatches,
      invalidRoutes,
      classificationMismatches
    },
    reviewRoutingCoverage: {
      ...routeCounts,
      exactParentSectionEvidenceBindingCount: records.reduce((total, record) => total + record.parentSectionEvidenceBindings.length, 0),
      candidateRelationshipEvidenceBindingCount: records.reduce((total, record) => total + record.candidateRelationshipEvidenceBindings.length, 0),
      reviewReadyCount: exactReviewCount + contextReviewCount,
      additionalEvidenceRequiredCount: additionalCount
    },
    semanticPreservationCoverage: {
      reviewDecisionCount: records.filter(record => record.reviewDecision !== null).length,
      membershipVerdictCount: records.filter(record => record.parentMembershipVerdict !== null || record.weightedTaskEntryMembershipVerdict !== null).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    dispositionCoverageComplete: publishable && records.length === evidencePackets.length,
    weightedMembershipReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(exactReviewCount ? ['exact_parent_section_membership_reviews_pending'] : []),
      ...(contextReviewCount ? ['candidate_relationship_context_reviews_pending'] : []),
      ...(additionalCount ? ['additional_candidate_membership_evidence_pending'] : []),
      'weighted_parent_task_entry_membership_not_proven',
      'member_universe_completeness_not_proven',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({
  evidencePackets = [], policy = {}, sourceSnapshotContentHash = '', contentHash = hash
} = {}) {
  const flight = preflight(evidencePackets, policy, sourceSnapshotContentHash, contentHash);
  const records = flight.failures.length ? [] : flight.records;
  return { records, audit: auditWeightedMembershipAdditionalEvidenceSufficiencyDisposition(records, { evidencePackets, policy, sourceSnapshotContentHash, contentHash }) };
}
