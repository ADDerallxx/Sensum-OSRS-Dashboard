const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const withoutContentHash = record => {
  const { contentHash: _contentHash, ...rest } = record || {};
  return rest;
};
const nonemptyString = value => typeof value === 'string' && value.trim().length > 0;
const hashString = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

export function compileCrossSkillUntypedPageSufficiencyPolicy(policy = {}) {
  const forbiddenPolicyPaths = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|title|titles|candidateKey|candidateKeys|template|templates|category|categories|candidateOverride|candidateOverrides)$/i.test(name)) forbiddenPolicyPaths.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  const requiredTrue = [
    'policyContainsNoPageIdsTitlesCandidateKeysTemplatesCategoriesOrCandidateOverrides',
    'everyCompleteInputProducesExactlyOneDisposition',
    'inputSnapshotAndIntrinsicRecordHashesMustRevalidate',
    'everySourceAlignmentFlagMustRemainTrue',
    'sourceIdentityStructuralCountsAndEvidenceFingerprintMustBePreserved',
    'onlyTheExactMediaWikiNamespaceMaySelectTheReviewRoute',
    'namespaceZeroRoutesToMainNamespaceReview',
    'everyOtherIntegerNamespaceRoutesToNonMainNamespaceReview',
    'titlesTemplatesCategoriesLeadAndHeadingsCannotSelectDispositionOrRoute',
    'sufficiencyDispositionDoesNotClassifyPageTypeOrCanonicalIdentity',
    'repeatabilityRequirementsVariantsXpTimingMechanicsAndOptimizerEligibilityRemainClosed',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrue.filter(key => policy.rules?.[key] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const valid = policy.policy === 'sensum.cross-skill-untyped-page-source-evidence-sufficiency-disposition-policy.v1' &&
    policy.inputContract === 'sensum.cross-skill-untyped-page-source-evidence.v1' &&
    policy.recordContract === 'sensum.cross-skill-untyped-page-source-evidence-sufficiency-disposition.v1' &&
    policy.auditContract === 'sensum.cross-skill-untyped-page-source-evidence-sufficiency-disposition-audit.v1' &&
    policy.disposition === 'source_evidence_sufficient_for_explicit_page_type_review' &&
    policy.reviewRoutes?.mainNamespace === 'explicit_main_namespace_page_type_review' &&
    policy.reviewRoutes?.nonMainNamespace === 'explicit_non_main_namespace_scope_review' &&
    invalidRules.length === 0 && forbiddenPolicyPaths.length === 0;
  return { valid, invalidRules, forbiddenPolicyPaths };
}

export function findCrossSkillUntypedPageSufficiencyAccountState(records = []) {
  const findings = [];
  const visit = (value, path, recordKey) => {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`, recordKey));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ recordKey, path: childPath, value: child });
      visit(child, childPath, recordKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record?.candidateKey || `record-${index}`));
  return findings;
}

export function crossSkillUntypedPageEvidenceFingerprint(record, contentHash = value => value) {
  return contentHash({
    candidateKey: record.candidateKey,
    sourceCandidateContentHash: record.sourceCandidateContentHash,
    sourceSignatureContexts: record.sourceSignatureContexts || [],
    sourcePageId: record.sourcePageId,
    resolvedTitle: record.resolvedTitle,
    sourceNamespaceId: record.sourceNamespaceId,
    skillKeys: sorted(record.skillKeys || []),
    statementKeys: sorted(record.statementKeys || []),
    sourceRevision: String(record.sourceRevision || ''),
    sourceTimestamp: record.sourceTimestamp || null,
    sourceUrl: record.sourceUrl || null,
    sourceContentHash: record.sourceContentHash || null,
    sourceContentBytes: record.sourceContentBytes,
    sourceLineCount: record.sourceLineCount,
    revisionAlignment: record.revisionAlignment || {},
    rootTemplateEvidence: record.rootTemplateEvidence || [],
    directCategoryEvidence: record.directCategoryEvidence || [],
    leadParagraphEvidence: record.leadParagraphEvidence || [],
    headingEvidence: record.headingEvidence || []
  });
}

const preservedIdentity = record => JSON.stringify({
  candidateKey: record.candidateKey,
  sourcePageId: record.sourcePageId,
  resolvedTitle: record.resolvedTitle,
  sourceNamespaceId: record.sourceNamespaceId,
  skillKeys: sorted(record.skillKeys || []),
  statementKeys: sorted(record.statementKeys || []),
  sourceRevision: String(record.sourceRevision || ''),
  sourceTimestamp: record.sourceTimestamp || null,
  sourceUrl: record.sourceUrl || null,
  sourceContentHash: record.sourceContentHash || null,
  sourceEvidenceContentHash: record.sourceEvidenceContentHash || record.contentHash || null,
  sourceSignatureContexts: record.sourceSignatureContexts || []
});

function evidenceInputValid(record, contentHash) {
  return record?.contract === 'sensum.cross-skill-untyped-page-source-evidence.v1' &&
    Boolean(record.contentHash) && record.contentHash === contentHash(withoutContentHash(record)) &&
    nonemptyString(record.candidateKey) && hashString(record.sourceCandidateContentHash) &&
    Number.isInteger(record.sourcePageId) && record.sourcePageId > 0 && nonemptyString(record.resolvedTitle) &&
    nonemptyString(String(record.sourceRevision || '')) && nonemptyString(record.sourceTimestamp) &&
    nonemptyString(record.sourceUrl) && hashString(record.sourceContentHash) &&
    Number.isInteger(record.sourceContentBytes) && record.sourceContentBytes > 0 &&
    Number.isInteger(record.sourceLineCount) && record.sourceLineCount > 0 &&
    Array.isArray(record.skillKeys) && record.skillKeys.length > 0 &&
    Array.isArray(record.statementKeys) && record.statementKeys.length > 0 &&
    Array.isArray(record.sourceSignatureContexts) && record.sourceSignatureContexts.length > 0 &&
    record.sourceSignatureContexts.every(context => nonemptyString(context?.targetKey) && hashString(context?.sourceSignatureContentHash)) &&
    Array.isArray(record.rootTemplateEvidence) && Array.isArray(record.directCategoryEvidence) &&
    Array.isArray(record.leadParagraphEvidence) && Array.isArray(record.headingEvidence) &&
    Array.isArray(record.blockers) &&
    record.state === 'review_ready' &&
    record.accountIndependent === true &&
    Number.isInteger(record.sourceNamespaceId) &&
    record.pageTypeReview?.state === 'unreviewed' && record.pageTypeReview?.disposition === null &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.optimizerEligible === false &&
    Object.values(record.revisionAlignment || {}).length > 0 && Object.values(record.revisionAlignment || {}).every(Boolean);
}

export function buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords = [], inputSnapshotContentHash = '', policy = {}, contentHash = value => value }) {
  const compiled = compileCrossSkillUntypedPageSufficiencyPolicy(policy);
  const records = evidenceRecords.map(evidence => {
    const validInput = evidenceInputValid(evidence, contentHash);
    const route = Number.isInteger(evidence.sourceNamespaceId)
      ? evidence.sourceNamespaceId === 0 ? policy.reviewRoutes?.mainNamespace : policy.reviewRoutes?.nonMainNamespace
      : null;
    const ready = compiled.valid && Boolean(inputSnapshotContentHash) && validInput && Boolean(route);
    const blockers = [];
    if (!compiled.valid) blockers.push('untyped_page_sufficiency_policy_invalid');
    if (!inputSnapshotContentHash) blockers.push('source_evidence_snapshot_hash_missing');
    if (!validInput) blockers.push('source_evidence_packet_not_complete_or_aligned');
    if (!route) blockers.push('namespace_scoped_review_route_unavailable');
    blockers.push(
      'explicit_page_type_review_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: 'sensum.cross-skill-untyped-page-source-evidence-sufficiency-disposition.v1',
      candidateKey: evidence.candidateKey,
      sourcePageId: evidence.sourcePageId,
      resolvedTitle: evidence.resolvedTitle,
      sourceNamespaceId: evidence.sourceNamespaceId,
      skillKeys: sorted(evidence.skillKeys || []),
      statementKeys: sorted(evidence.statementKeys || []),
      sourceRevision: evidence.sourceRevision,
      sourceTimestamp: evidence.sourceTimestamp,
      sourceUrl: evidence.sourceUrl,
      sourceContentHash: evidence.sourceContentHash,
      sourceEvidenceContentHash: evidence.contentHash,
      sourceEvidenceSnapshotContentHash: inputSnapshotContentHash,
      sourceSignatureContexts: evidence.sourceSignatureContexts || [],
      evidenceFingerprint: crossSkillUntypedPageEvidenceFingerprint(evidence, contentHash),
      evidenceSummary: {
        namespaceId: evidence.sourceNamespaceId,
        sourceContentBytes: evidence.sourceContentBytes,
        sourceLineCount: evidence.sourceLineCount,
        sourceSignatureContextCount: evidence.sourceSignatureContexts?.length || 0,
        rootTemplateCount: evidence.rootTemplateEvidence?.length || 0,
        directCategoryCount: evidence.directCategoryEvidence?.length || 0,
        leadParagraphCount: evidence.leadParagraphEvidence?.length || 0,
        headingCount: evidence.headingEvidence?.length || 0
      },
      evidenceSufficiencyDisposition: ready ? policy.disposition : null,
      reviewRoute: ready ? route : null,
      pageTypeReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityClassification: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: ready ? 'review_routed' : 'blocked_source_or_policy'
    };
  });
  return { records, audit: auditCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions(records, { evidenceRecords, inputSnapshotContentHash, policy, contentHash }) };
}

export function auditCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions(records = [], { evidenceRecords = [], inputSnapshotContentHash = '', policy = {}, contentHash = value => value } = {}) {
  const compiled = compileCrossSkillUntypedPageSufficiencyPolicy(policy);
  const expectedKeys = evidenceRecords.map(row => row.candidateKey);
  const actualKeys = records.map(row => row.candidateKey);
  const evidenceByKey = new Map(evidenceRecords.map(row => [row.candidateKey, row]));
  const invalidEvidenceKeys = evidenceRecords.filter(row => !evidenceInputValid(row, contentHash)).map(row => row.candidateKey);
  const bindingMismatches = records.filter(record => {
    const evidence = evidenceByKey.get(record.candidateKey);
    return !evidence || preservedIdentity(record) !== preservedIdentity(evidence) ||
      record.sourceEvidenceSnapshotContentHash !== inputSnapshotContentHash ||
      record.evidenceFingerprint !== crossSkillUntypedPageEvidenceFingerprint(evidence, contentHash);
  }).map(row => row.candidateKey);
  const invalidRoutes = records.filter(record => {
    const expectedRoute = record.sourceNamespaceId === 0 ? policy.reviewRoutes?.mainNamespace : policy.reviewRoutes?.nonMainNamespace;
    return record.reviewRoute !== expectedRoute || record.evidenceSufficiencyDisposition !== policy.disposition || record.state !== 'review_routed';
  }).map(row => row.candidateKey);
  const summaryMismatches = records.filter(record => {
    const evidence = evidenceByKey.get(record.candidateKey);
    return !evidence || JSON.stringify(record.evidenceSummary) !== JSON.stringify({
      namespaceId: evidence.sourceNamespaceId,
      sourceContentBytes: evidence.sourceContentBytes,
      sourceLineCount: evidence.sourceLineCount,
      sourceSignatureContextCount: evidence.sourceSignatureContexts?.length || 0,
      rootTemplateCount: evidence.rootTemplateEvidence?.length || 0,
      directCategoryCount: evidence.directCategoryEvidence?.length || 0,
      leadParagraphCount: evidence.leadParagraphEvidence?.length || 0,
      headingCount: evidence.headingEvidence?.length || 0
    });
  }).map(row => row.candidateKey);
  const promotions = records.filter(record => record.pageTypeReview?.state !== 'unreviewed' || record.pageTypeReview?.disposition !== null || record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null || record.repeatabilityClassification !== null || record.optimizerEligible !== false).map(row => row.candidateKey);
  const accountStateFindings = findCrossSkillUntypedPageSufficiencyAccountState(records);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('untyped_page_sufficiency_policy_invalid');
  if (!inputSnapshotContentHash) structuralBlockers.push('source_evidence_snapshot_hash_missing');
  if (duplicates(expectedKeys).length) structuralBlockers.push('duplicate_untyped_source_evidence_candidate_keys');
  if (duplicates(actualKeys).length) structuralBlockers.push('duplicate_untyped_sufficiency_disposition_candidate_keys');
  if (expectedKeys.some(key => !actualKeys.includes(key))) structuralBlockers.push('one_or_more_untyped_source_evidence_records_missing_disposition');
  if (actualKeys.some(key => !expectedKeys.includes(key))) structuralBlockers.push('unexpected_untyped_sufficiency_disposition_record');
  if (invalidEvidenceKeys.length) structuralBlockers.push('one_or_more_input_evidence_records_invalid_or_unaligned');
  if (bindingMismatches.length) structuralBlockers.push('one_or_more_input_snapshot_identity_or_evidence_bindings_changed');
  if (invalidRoutes.length) structuralBlockers.push('one_or_more_namespace_scoped_review_routes_invalid');
  if (summaryMismatches.length) structuralBlockers.push('one_or_more_structural_evidence_summaries_changed');
  if (promotions.length) structuralBlockers.push('unsupported_page_type_identity_repeatability_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_untyped_page_sufficiency_dispositions');
  const dispositionCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  return {
    contract: 'sensum.cross-skill-untyped-page-source-evidence-sufficiency-disposition-audit.v1',
    inputCoverage: {
      inputEvidenceRecordCount: expectedKeys.length,
      dispositionRecordCount: records.length,
      duplicateInputCandidateKeys: duplicates(expectedKeys),
      duplicateOutputCandidateKeys: duplicates(actualKeys),
      missingCandidateKeys: expectedKeys.filter(key => !actualKeys.includes(key)),
      unexpectedCandidateKeys: actualKeys.filter(key => !expectedKeys.includes(key)),
      invalidOrUnalignedInputCandidateKeys: invalidEvidenceKeys,
      snapshotIdentityOrEvidenceBindingMismatchCandidateKeys: bindingMismatches,
      exactInputOutputSetAndBindingsMatch: !duplicates(expectedKeys).length && !duplicates(actualKeys).length && !expectedKeys.some(key => !actualKeys.includes(key)) && !actualKeys.some(key => !expectedKeys.includes(key)) && !invalidEvidenceKeys.length && !bindingMismatches.length
    },
    policyCoverage: {
      valid: compiled.valid,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      disposition: policy.disposition || null,
      mainNamespaceReviewRoute: policy.reviewRoutes?.mainNamespace || null,
      nonMainNamespaceReviewRoute: policy.reviewRoutes?.nonMainNamespace || null
    },
    dispositionCoverage: {
      sourceEvidenceSufficientForReviewCount: records.filter(row => row.evidenceSufficiencyDisposition === policy.disposition).length,
      mainNamespaceReviewRouteCount: records.filter(row => row.reviewRoute === policy.reviewRoutes?.mainNamespace).length,
      nonMainNamespaceReviewRouteCount: records.filter(row => row.reviewRoute === policy.reviewRoutes?.nonMainNamespace).length,
      invalidRouteCandidateKeys: invalidRoutes,
      structuralEvidenceSummaryMismatchCandidateKeys: summaryMismatches
    },
    semanticPreservationCoverage: {
      pageTypeReviewedCount: records.filter(row => row.pageTypeReview?.state !== 'unreviewed').length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
      unsupportedPromotionCandidateKeys: promotions
    },
    accountStateFindings,
    dispositionCoverageComplete,
    pageTypeReviewComplete: false,
    canonicalIdentityComplete: false,
    repeatabilityAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'explicit_untyped_page_type_reviews_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: dispositionCoverageComplete
  };
}
