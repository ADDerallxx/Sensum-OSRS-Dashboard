const REQUIRED_RULES = [
  'everyEvidencePacketMustProduceExactlyOneDisposition',
  'inputManifestIntrinsicRecordAndNestedEvidenceHashesMustRevalidate',
  'sourceSnapshotAndEvidenceFingerprintBindingsMustBePreserved',
  'dispositionDependsOnlyOnExactResolutionAndRevisionPinnedCandidateCoverage',
  'allExactCurrentPagesRouteToExplicitReviewWithoutAutomaticBinding',
  'allMissingTitlesWithCandidatesRouteToExplicitReviewWithoutAutomaticBinding',
  'mixedOrAbsentCandidateCoverageRoutesToAdditionalEvidence',
  'titlesPageIdsRevisionsAndCandidateNamesCannotOverrideRouting',
  'resolutionReviewIdentityRepeatabilityMechanicsAndOptimizerEligibilityRemainClosed',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DISPOSITIONS = [
  'exact_current_resolution_review_ready',
  'source_derived_candidate_resolution_review_ready',
  'mixed_resolution_or_candidate_coverage_requires_additional_evidence',
  'no_resolution_candidate_evidence_requires_additional_evidence'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:title|titles|pageId|pageIds|revision|revisions|candidateName|candidateNames|candidateKey|candidateKeys|override|overrides|exceptions|(?:title|page|revision|candidate).*(?:override|overrides|exceptions))$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  visit(policy);
  return unique(findings).sort();
}

export function compileUnresolvedRenderedTargetResolutionSufficiencyPolicy(policy = {}, contentHash = JSON.stringify) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.policy === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-policy.v1' &&
    policy.inputContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence.v1' &&
    policy.recordContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition.v1' &&
    policy.auditContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-audit.v1';
  const dispositionsValid = contentHash(policy.allowedDispositions || []) === contentHash(EXPECTED_DISPOSITIONS);
  const routesValid = policy.reviewRoutes?.reviewReady === 'explicit_source_bound_resolution_review' &&
    policy.reviewRoutes?.additionalEvidence === 'additional_source_bound_resolution_evidence';
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractValid && dispositionsValid && routesValid && invalidRules.length === 0 && forbidden.length === 0, contractValid, dispositionsValid, routesValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

export function findUnresolvedRenderedTargetResolutionSufficiencyAccountState(records = []) {
  const findings = [];
  const forbidden = /^(?:currentBaseLevel|targetBaseLevel|currentLevel|currentXp|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|bank|bankItems|playerName|username|preferences|currentAccount)$/i;
  const visit = (value, at, recordKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`, recordKey));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push({ recordKey, path: next });
      visit(child, next, recordKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record.resolutionEvidenceKey || record.dispositionKey || `record-${index}`));
  return findings;
}

function sourceIdentityComplete(identity = {}) {
  return Number.isInteger(identity.sourcePageId) && identity.sourcePageId > 0 && Number.isInteger(identity.namespaceId) &&
    typeof identity.resolvedTitle === 'string' && identity.resolvedTitle.length > 0 && typeof identity.sourceRevision === 'string' && identity.sourceRevision.length > 0 &&
    typeof identity.sourceTimestamp === 'string' && Number.isFinite(Date.parse(identity.sourceTimestamp)) && typeof identity.sourceUrl === 'string' && identity.sourceUrl.length > 0 &&
    validHash(identity.sourceContentHash) && Number.isInteger(identity.sourceContentBytes) && identity.sourceContentBytes > 0 &&
    Number.isInteger(identity.sourceLineCount) && identity.sourceLineCount > 0;
}

function nestedEvidenceHashValid(value, contentHash) {
  return validHash(value?.evidenceContentHash) && contentHash(without(value, 'evidenceContentHash')) === value.evidenceContentHash;
}

function evidenceFingerprint(record, contentHash) {
  return contentHash({
    sourceEvidenceRecordContentHash: record.contentHash,
    sourceRenderedTargetRecordContentHash: record.sourceRenderedTargetRecordContentHash,
    sourceRenderedTargetSnapshotContentHash: record.sourceRenderedTargetSnapshotContentHash,
    renderedTargetKey: record.renderedTargetKey,
    requestedTitles: record.requestedTitles,
    namespaceIds: record.namespaceIds,
    pinnedGuideEvidenceHashes: (record.pinnedGuideEvidence || []).map(row => row.evidenceContentHash),
    currentTitleResolutionEvidenceHashes: (record.currentTitleResolutionEvidence || []).map(row => row.evidenceContentHash),
    titleLogEvidenceHashes: (record.titleLogEvidence || []).map(row => row.evidenceContentHash),
    discoveryEvidenceHashes: (record.discoveryEvidence || []).map(row => row.evidenceContentHash)
  });
}

function inputIntegrity(record = {}, contentHash) {
  const current = record.currentTitleResolutionEvidence || [];
  const discovery = record.discoveryEvidence || [];
  const logs = record.titleLogEvidence || [];
  const guides = record.pinnedGuideEvidence || [];
  const requestedTitles = record.requestedTitles || [];
  const currentStatesValid = current.every(row => row.queryComplete === true && row.exactRequestedTitlePreserved === true && row.pageNamespaceMatches === true &&
    row.canonicalIdentityApplied === false && nestedEvidenceHashValid(row, contentHash) &&
    ((row.resolutionState === 'current_revision_pinned_page_evidence' && sourceIdentityComplete(row.currentPageEvidence) && row.currentMissingPage === null) ||
      (row.resolutionState === 'current_missing_wiki_page_evidence' && row.currentPageEvidence === null && row.currentMissingPage !== null)));
  const discoveryValid = discovery.every(row => row.queryComplete === true && row.queryDerivedOnlyFromRequestedTitle === true && row.selectedCandidatePageId === null &&
    row.canonicalIdentityApplied === false && row.candidateCount === row.candidates?.length && nestedEvidenceHashValid(row, contentHash) &&
    row.candidates.every(candidate => sourceIdentityComplete(candidate.sourcePageIdentity) && candidate.candidateIdentityApplied === false));
  const logsValid = logs.every(row => row.queryComplete === true && row.exactRequestedTitlePreserved === true && row.eventCount === row.events?.length &&
    row.canonicalIdentityApplied === false && nestedEvidenceHashValid(row, contentHash));
  const guidesValid = guides.every(row => nestedEvidenceHashValid(row, contentHash) && Object.values(row.alignment || {}).every(Boolean) && row.exactSourceOccurrences?.length > 0);
  const checks = {
    intrinsicHashValid: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    contractValid: typeof record.contract === 'string' && record.contract === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence.v1',
    sourceBindingsPresent: validHash(record.sourceRenderedTargetRecordContentHash) && validHash(record.sourceRenderedTargetSnapshotContentHash),
    keyAndTitlesPresent: typeof record.resolutionEvidenceKey === 'string' && typeof record.renderedTargetKey === 'string' && requestedTitles.length > 0 && duplicates(requestedTitles).length === 0,
    evidenceCardinalityMatches: current.length === requestedTitles.length && discovery.length === requestedTitles.length && logs.length === requestedTitles.length && guides.length === record.guideObservations?.length,
    currentResolutionEvidenceValid: currentStatesValid,
    discoveryEvidenceValid: discoveryValid,
    titleLogEvidenceValid: logsValid,
    pinnedGuideEvidenceValid: guidesValid,
    resolutionUnreviewed: record.resolutionDisposition?.state === 'unreviewed' && record.resolutionDisposition?.selectedPageId === null && record.resolutionDisposition?.selectedTitle === null && record.resolutionDisposition?.evidenceKeys?.length === 0,
    semanticGatesClosed: record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null && record.repeatabilityClassification === null && record.optimizerEligible === false,
    accountIndependent: record.accountIndependent === true,
    expectedState: record.state === 'resolution_evidence_captured_review_pending'
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function expectedDisposition(record, policy) {
  const current = record.currentTitleResolutionEvidence || [];
  const discovery = record.discoveryEvidence || [];
  const titleCount = record.requestedTitles?.length || 0;
  const currentResolvedTitleCount = current.filter(row => row.resolutionState === 'current_revision_pinned_page_evidence').length;
  const currentMissingTitleCount = current.filter(row => row.resolutionState === 'current_missing_wiki_page_evidence').length;
  const titleWithCandidateCount = discovery.filter(row => row.candidateCount > 0).length;
  const revisionPinnedCandidateCount = discovery.reduce((sum, row) => sum + Number(row.candidateCount || 0), 0);
  let evidenceSufficiencyDisposition;
  if (titleCount > 0 && currentResolvedTitleCount === titleCount) evidenceSufficiencyDisposition = policy.allowedDispositions[0];
  else if (titleCount > 0 && currentMissingTitleCount === titleCount && titleWithCandidateCount === titleCount) evidenceSufficiencyDisposition = policy.allowedDispositions[1];
  else if (currentResolvedTitleCount > 0 || titleWithCandidateCount > 0) evidenceSufficiencyDisposition = policy.allowedDispositions[2];
  else evidenceSufficiencyDisposition = policy.allowedDispositions[3];
  const reviewReady = [policy.allowedDispositions[0], policy.allowedDispositions[1]].includes(evidenceSufficiencyDisposition);
  return {
    requestedTitleCount: titleCount,
    currentResolvedTitleCount,
    currentMissingTitleCount,
    titleWithCandidateCount,
    revisionPinnedCandidateCount,
    evidenceSufficiencyDisposition,
    reviewRoute: reviewReady ? policy.reviewRoutes.reviewReady : policy.reviewRoutes.additionalEvidence
  };
}

function dispositionRecord(record, inputSnapshotContentHash, policy, contentHash) {
  const expected = expectedDisposition(record, policy);
  const fingerprint = evidenceFingerprint(record, contentHash);
  const reviewReady = expected.reviewRoute === policy.reviewRoutes.reviewReady;
  return {
    contract: policy.recordContract,
    dispositionKey: `${record.resolutionEvidenceKey}|sufficiency-disposition`,
    resolutionEvidenceKey: record.resolutionEvidenceKey,
    sourceEvidenceRecordContentHash: record.contentHash,
    sourceEvidenceSnapshotContentHash: inputSnapshotContentHash,
    evidenceFingerprint: fingerprint,
    renderedTargetKey: record.renderedTargetKey,
    ...expected,
    resolutionReview: { state: 'unreviewed', decision: null, selectedPageId: null, selectedTitle: null, reviewer: null, reviewedAt: null, reviewNotes: null, evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: unique([
      reviewReady ? 'explicit_source_bound_resolution_review_pending' : 'additional_source_bound_resolution_evidence_required',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ]),
    state: reviewReady ? 'pending_explicit_source_bound_resolution_review' : 'pending_additional_source_bound_resolution_evidence'
  };
}

export function buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({ evidenceRecords = [], inputSnapshotContentHash = '', policy = {}, contentHash = value => value } = {}) {
  const records = evidenceRecords.map(record => dispositionRecord(record, inputSnapshotContentHash, policy, contentHash))
    .sort((a, b) => a.dispositionKey.localeCompare(b.dispositionKey));
  return { records, audit: auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(records, { evidenceRecords, inputSnapshotContentHash, policy, contentHash }) };
}

export function auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(records = [], { evidenceRecords = [], inputSnapshotContentHash = '', policy = {}, contentHash = value => value } = {}) {
  const compiled = compileUnresolvedRenderedTargetResolutionSufficiencyPolicy(policy, contentHash);
  const expectedRecords = evidenceRecords.map(record => dispositionRecord(record, inputSnapshotContentHash, policy, contentHash));
  const expectedKeys = expectedRecords.map(row => row.dispositionKey);
  const actualKeys = records.map(row => row.dispositionKey);
  const invalidInputs = evidenceRecords.filter(record => !inputIntegrity(record, contentHash).complete).map(record => record.resolutionEvidenceKey);
  const expectedByKey = new Map(expectedRecords.map(row => [row.dispositionKey, row]));
  const bindingMismatches = records.filter(record => {
    const expected = expectedByKey.get(record.dispositionKey);
    if (!expected) return true;
    const fields = ['resolutionEvidenceKey', 'sourceEvidenceRecordContentHash', 'sourceEvidenceSnapshotContentHash', 'evidenceFingerprint', 'renderedTargetKey'];
    return fields.some(field => contentHash(record[field]) !== contentHash(expected[field]));
  }).map(row => row.dispositionKey);
  const dispositionMismatches = records.filter(record => {
    const expected = expectedByKey.get(record.dispositionKey);
    if (!expected) return true;
    const fields = ['requestedTitleCount', 'currentResolvedTitleCount', 'currentMissingTitleCount', 'titleWithCandidateCount', 'revisionPinnedCandidateCount', 'evidenceSufficiencyDisposition', 'reviewRoute', 'state'];
    return fields.some(field => contentHash(record[field]) !== contentHash(expected[field]));
  }).map(row => row.dispositionKey);
  const promotions = records.filter(record => record.resolutionReview?.state !== 'unreviewed' || record.resolutionReview?.decision !== null ||
    record.resolutionReview?.selectedPageId !== null || record.resolutionReview?.selectedTitle !== null || record.resolutionReview?.reviewer !== null ||
    record.resolutionReview?.reviewedAt !== null || record.resolutionReview?.reviewNotes !== null || record.resolutionReview?.evidenceKeys?.length ||
    record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null || record.repeatabilityClassification !== null || record.optimizerEligible !== false);
  const accountStateFindings = findUnresolvedRenderedTargetResolutionSufficiencyAccountState([...evidenceRecords, ...records]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('resolution_evidence_sufficiency_policy_invalid');
  if (!validHash(inputSnapshotContentHash)) structuralBlockers.push('resolution_evidence_snapshot_hash_missing');
  if (duplicates(expectedKeys).length || duplicates(actualKeys).length) structuralBlockers.push('duplicate_input_or_output_disposition_keys');
  if (expectedKeys.some(key => !actualKeys.includes(key))) structuralBlockers.push('one_or_more_evidence_packets_missing_disposition');
  if (actualKeys.some(key => !expectedKeys.includes(key))) structuralBlockers.push('unexpected_resolution_evidence_disposition');
  if (invalidInputs.length) structuralBlockers.push('one_or_more_input_resolution_evidence_packets_invalid');
  if (bindingMismatches.length) structuralBlockers.push('one_or_more_source_snapshot_or_evidence_bindings_changed');
  if (dispositionMismatches.length) structuralBlockers.push('one_or_more_evidence_shape_dispositions_or_routes_changed');
  if (promotions.length) structuralBlockers.push('unsupported_resolution_review_identity_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_resolution_sufficiency_disposition');
  const dispositionCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      evidencePacketCount: evidenceRecords.length,
      dispositionRecordCount: records.length,
      duplicateInputKeys: duplicates(expectedKeys),
      duplicateOutputKeys: duplicates(actualKeys),
      missingOutputKeys: expectedKeys.filter(key => !actualKeys.includes(key)),
      unexpectedOutputKeys: actualKeys.filter(key => !expectedKeys.includes(key)),
      invalidInputEvidenceKeys: invalidInputs
    },
    policyCoverage: compiled,
    dispositionCoverage: {
      exactCurrentResolutionReviewReadyCount: records.filter(row => row.evidenceSufficiencyDisposition === policy.allowedDispositions?.[0]).length,
      sourceDerivedCandidateReviewReadyCount: records.filter(row => row.evidenceSufficiencyDisposition === policy.allowedDispositions?.[1]).length,
      mixedCoverageAdditionalEvidenceCount: records.filter(row => row.evidenceSufficiencyDisposition === policy.allowedDispositions?.[2]).length,
      noCandidateAdditionalEvidenceCount: records.filter(row => row.evidenceSufficiencyDisposition === policy.allowedDispositions?.[3]).length,
      explicitResolutionReviewRouteCount: records.filter(row => row.reviewRoute === policy.reviewRoutes?.reviewReady).length,
      additionalEvidenceRouteCount: records.filter(row => row.reviewRoute === policy.reviewRoutes?.additionalEvidence).length,
      dispositionOrRouteMismatchKeys: dispositionMismatches
    },
    bindingCoverage: {
      exactSourceSnapshotAndEvidenceBindingCount: records.length - bindingMismatches.length,
      bindingMismatchKeys: bindingMismatches,
      totalRevisionPinnedCandidateCount: records.reduce((sum, row) => sum + Number(row.revisionPinnedCandidateCount || 0), 0)
    },
    semanticPreservationCoverage: {
      resolutionReviewCompletedCount: records.filter(row => row.resolutionReview?.state !== 'unreviewed').length,
      selectedResolutionCount: records.filter(row => row.resolutionReview?.selectedPageId !== null).length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
      unsupportedPromotionKeys: promotions.map(row => row.dispositionKey)
    },
    accountStateFindings,
    dispositionCoverageComplete,
    resolutionReviewComplete: false,
    canonicalIdentityComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(records.some(row => row.reviewRoute === policy.reviewRoutes?.reviewReady) ? ['explicit_source_bound_resolution_reviews_pending'] : []),
      ...(records.some(row => row.reviewRoute === policy.reviewRoutes?.additionalEvidence) ? ['additional_source_bound_resolution_evidence_pending'] : []),
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: dispositionCoverageComplete
  };
}
