import { parseDirectCategorySignatures, parseRootTemplateSignatures } from './unlock-linked-page-source-signature-lib.mjs';
import { parseLeadParagraphEvidence, parseSourceHeadings } from './activity-candidate-source-evidence-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const stable = value => JSON.stringify(value);
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const sourceContent = page => page?.revisions?.[0]?.slots?.main?.content;
const withoutContentHash = record => {
  if (!record || typeof record !== 'object') return record;
  const { contentHash: _contentHash, ...rest } = record;
  return rest;
};
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const templateShape = rows => (rows || []).map(({ template, templateKey, line }) => ({ template, templateKey, line }));
const categoryShape = rows => (rows || []).map(({ category, categoryKey, line }) => ({ category, categoryKey, line }));
const contextShape = (pageId, row = {}) => ({
  pageId: Number(pageId),
  targetKey: row.targetKey || null,
  requestedTitle: row.requestedTitle || null,
  requestedFragment: row.requestedFragment || null,
  redirected: Boolean(row.redirected),
  identitySourceRevision: String(row.identitySourceRevision || ''),
  referencedBy: {
    skillKeys: sorted(row.referencedBy?.skillKeys || []),
    statementKeys: sorted(row.referencedBy?.statementKeys || [])
  }
});

export function compileCrossSkillUntypedPageEvidencePolicy(policy = {}) {
  const requiredTrue = [
    'everyUntypedCandidateMustProduceExactlyOnePacket',
    'candidateAndSignatureJoinOnlyByStableOfficialWikiPageId',
    'allSamePageAliasAndFragmentSignatureContextsMustBePreserved',
    'candidateSignatureAndSnapshotIntrinsicHashesMustRevalidate',
    'fetchedContentMustUseTheRetainedExactRevision',
    'pageIdRevisionTimestampTitleUrlContentHashAndBytesMustReconcile',
    'fetchedRootTemplatesAndDirectCategoriesMustMatchRetainedSignatures',
    'namespaceTemplatesCategoriesLeadAndHeadingsRemainEvidenceNotVerdicts',
    'fileTemplateCategoryRedirectOrTitleShapeCannotAutomaticallyClassifyPageType',
    'canonicalIdentityRepeatabilityMechanicsAndOptimizerEligibilityRemainClosed',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrue.filter(key => policy.rules?.[key] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const valid = policy.policy === 'sensum.cross-skill-untyped-page-source-evidence-policy.v1' &&
    policy.inputCandidateContract === 'sensum.cross-source-entity-activity-candidate.v1' &&
    policy.inputSignatureContract === 'sensum.unlock-linked-page-source-signature.v1' &&
    policy.recordContract === 'sensum.cross-skill-untyped-page-source-evidence.v1' &&
    policy.auditContract === 'sensum.cross-skill-untyped-page-source-evidence-audit.v1' &&
    policy.candidateKind === 'untyped_page_identity_candidate' && invalidRules.length === 0;
  return { valid, invalidRules };
}

export function findCrossSkillUntypedPageEvidenceAccountState(records = []) {
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

function allSignatureContextsEquivalent(group = []) {
  if (!group.length) return false;
  const first = group[0];
  return group.every(row =>
    Number(row.sourcePageId) === Number(first.sourcePageId) &&
    String(row.sourceRevision || '') === String(first.sourceRevision || '') &&
    row.sourceTimestamp === first.sourceTimestamp &&
    row.sourceUrl === first.sourceUrl &&
    row.resolvedTitle === first.resolvedTitle &&
    row.sourceContentHash === first.sourceContentHash &&
    row.sourceContentBytes === first.sourceContentBytes &&
    stable(templateShape(row.rootTemplates)) === stable(templateShape(first.rootTemplates)) &&
    stable(categoryShape(row.directCategories)) === stable(categoryShape(first.directCategories))
  );
}

export function buildCrossSkillUntypedPageSourceEvidence({ candidates = [], signatures = [], fetchedPages = [], policy = {}, contentHash = value => value }) {
  const compiledPolicy = compileCrossSkillUntypedPageEvidencePolicy(policy);
  const expected = candidates.filter(row => row.candidateKind === 'untyped_page_identity_candidate');
  const signaturesByPageId = new Map();
  for (const signature of signatures) {
    const key = String(signature.sourcePageId);
    if (!signaturesByPageId.has(key)) signaturesByPageId.set(key, []);
    signaturesByPageId.get(key).push(signature);
  }
  const fetchedByRevision = new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
  const records = expected.map(candidate => {
    const pageId = candidate.pageIdentity?.sourcePageId;
    const signatureGroup = [...(signaturesByPageId.get(String(pageId)) || [])].sort((a, b) => String(a.targetKey).localeCompare(String(b.targetKey)));
    const signature = signatureGroup[0] || null;
    const fetched = fetchedByRevision.get(String(signature?.sourceRevision || candidate.pageIdentity?.unlockSourceRevision || ''));
    const page = fetched?.page || null;
    const revision = fetched?.revision || null;
    const content = sourceContent(page);
    const computedHash = typeof content === 'string' ? contentHash(content) : null;
    const parsedTemplates = typeof content === 'string' ? parseRootTemplateSignatures(content) : [];
    const parsedCategories = typeof content === 'string' ? parseDirectCategorySignatures(content) : [];
    const candidateHashValid = Boolean(candidate.contentHash && candidate.contentHash === contentHash(withoutContentHash(candidate)));
    const signatureHashesValid = signatureGroup.length > 0 && signatureGroup.every(row => row.contentHash && row.contentHash === contentHash(withoutContentHash(row)));
    const alignment = {
      policyValid: compiledPolicy.valid,
      candidateIntrinsicHashValid: candidateHashValid,
      signatureIntrinsicHashesValid: signatureHashesValid,
      candidateAndSignaturePageIdMatch: Boolean(signature && Number(signature.sourcePageId) === Number(pageId)),
      candidateAndSignatureRevisionMatch: Boolean(signature && String(candidate.pageIdentity?.unlockSourceRevision || '') === String(signature.sourceRevision || '')),
      candidateAndSignatureContentHashMatch: Boolean(signature && candidate.sourceContexts?.unlockEvidence?.source?.sourceContentHash === signature.sourceContentHash),
      allSignatureContextsEquivalent: allSignatureContextsEquivalent(signatureGroup),
      fetchedAndSignaturePageIdMatch: Boolean(signature && Number(page?.pageid) === Number(signature.sourcePageId)),
      fetchedAndSignatureRevisionMatch: Boolean(signature && String(revision?.revid || '') === String(signature.sourceRevision || '')),
      fetchedAndSignatureTimestampMatch: Boolean(signature && revision?.timestamp === signature.sourceTimestamp),
      fetchedAndSignatureTitleMatch: Boolean(signature && page?.title === signature.resolvedTitle),
      fetchedAndSignatureContentHashMatch: Boolean(signature && computedHash && computedHash === signature.sourceContentHash),
      fetchedAndSignatureContentBytesMatch: Boolean(signature && typeof content === 'string' && Buffer.byteLength(content, 'utf8') === signature.sourceContentBytes),
      fetchedRootTemplatesMatchSignatures: Boolean(signature && stable(templateShape(parsedTemplates)) === stable(templateShape(signature.rootTemplates))),
      fetchedDirectCategoriesMatchSignatures: Boolean(signature && stable(categoryShape(parsedCategories)) === stable(categoryShape(signature.directCategories)))
    };
    const blockers = [];
    if (!compiledPolicy.valid) blockers.push('untyped_page_source_evidence_policy_invalid');
    if (!signature) blockers.push('retained_source_signature_missing');
    if (!page || !revision || typeof content !== 'string') blockers.push('exact_revision_source_content_missing');
    if (!Object.values(alignment).every(Boolean)) blockers.push('candidate_signature_or_fetched_source_alignment_failed');
    blockers.push(
      'page_type_semantic_review_pending',
      'canonical_game_entity_identity_not_established',
      'canonical_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: 'sensum.cross-skill-untyped-page-source-evidence.v1',
      candidateKey: candidate.candidateKey,
      sourceCandidateContentHash: candidate.contentHash,
      sourceSignatureContexts: signatureGroup.map(row => ({
        ...contextShape(pageId, row),
        sourceSignatureContentHash: row.contentHash
      })),
      sourcePageId: Number.isInteger(pageId) ? pageId : null,
      resolvedTitle: signature?.resolvedTitle || candidate.pageIdentity?.resolvedTitle || null,
      sourceNamespaceId: Number.isInteger(page?.ns) ? page.ns : null,
      skillKeys: sorted(candidate.skillKeys || []),
      statementKeys: sorted(candidate.statementKeys || []),
      sourceRevision: signature?.sourceRevision || null,
      sourceTimestamp: signature?.sourceTimestamp || null,
      sourceUrl: signature?.sourceUrl || null,
      sourceContentHash: computedHash,
      sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null,
      sourceLineCount: typeof content === 'string' ? content.split(/\r?\n/).length : null,
      revisionAlignment: alignment,
      rootTemplateEvidence: parsedTemplates,
      directCategoryEvidence: parsedCategories,
      leadParagraphEvidence: typeof content === 'string' ? parseLeadParagraphEvidence(content, null) : [],
      headingEvidence: typeof content === 'string' ? parseSourceHeadings(content) : [],
      pageTypeReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityClassification: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: blockers.some(blocker => ['untyped_page_source_evidence_policy_invalid', 'retained_source_signature_missing', 'exact_revision_source_content_missing', 'candidate_signature_or_fetched_source_alignment_failed'].includes(blocker)) ? 'blocked_source' : 'review_ready'
    };
  });
  return { records, audit: auditCrossSkillUntypedPageSourceEvidence(records, { candidates, signatures, fetchedPages, policy, contentHash }) };
}

export function auditCrossSkillUntypedPageSourceEvidence(records = [], { candidates = [], signatures = [], fetchedPages = [], policy = {}, contentHash = value => value } = {}) {
  const compiledPolicy = compileCrossSkillUntypedPageEvidencePolicy(policy);
  const expected = candidates.filter(row => row.candidateKind === 'untyped_page_identity_candidate');
  const expectedKeys = expected.map(row => row.candidateKey);
  const actualKeys = records.map(row => row.candidateKey);
  const expectedPageIds = new Set(expected.map(row => String(row.pageIdentity?.sourcePageId)));
  const relevantSignatures = signatures.filter(row => expectedPageIds.has(String(row.sourcePageId)));
  const signaturePageIds = unique(relevantSignatures.map(row => String(row.sourcePageId)));
  const relevantRevisions = unique(relevantSignatures.map(row => String(row.sourceRevision)));
  const fetchedRevisions = fetchedPages.flatMap(page => (page.revisions || []).map(revision => String(revision.revid))).filter(revision => relevantRevisions.includes(revision));
  const expectedContexts = relevantSignatures.map(row => stable(contextShape(row.sourcePageId, row)));
  const actualContexts = records.flatMap(record => (record.sourceSignatureContexts || []).map(row => stable(contextShape(record.sourcePageId, row))));
  const alignmentFailures = records.filter(row => !Object.values(row.revisionAlignment || {}).every(Boolean)).map(row => row.candidateKey);
  const missingNamespace = records.filter(row => !Number.isInteger(row.sourceNamespaceId)).map(row => row.candidateKey);
  const promotions = records.filter(row => row.pageTypeReview?.state !== 'unreviewed' || row.pageTypeReview?.disposition !== null || row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null || row.optimizerEligible !== false).map(row => row.candidateKey);
  const accountStateFindings = findCrossSkillUntypedPageEvidenceAccountState(records);
  const structuralBlockers = [];
  if (!compiledPolicy.valid) structuralBlockers.push('untyped_page_source_evidence_policy_invalid');
  if (duplicates(expectedKeys).length) structuralBlockers.push('duplicate_untyped_candidate_keys');
  if (duplicates(actualKeys).length) structuralBlockers.push('duplicate_untyped_source_evidence_keys');
  if (expectedKeys.some(key => !actualKeys.includes(key))) structuralBlockers.push('one_or_more_untyped_candidates_missing_source_evidence');
  if (actualKeys.some(key => !expectedKeys.includes(key))) structuralBlockers.push('unexpected_untyped_source_evidence_record');
  if (expectedPageIds.size !== signaturePageIds.length || [...expectedPageIds].some(key => !signaturePageIds.includes(key))) structuralBlockers.push('untyped_candidate_source_signature_join_incomplete');
  if (duplicates(expectedContexts).length || duplicates(actualContexts).length || expectedContexts.some(key => !actualContexts.includes(key)) || actualContexts.some(key => !expectedContexts.includes(key))) structuralBlockers.push('untyped_source_signature_context_preservation_failed');
  if (duplicates(fetchedRevisions).length || relevantRevisions.some(key => !fetchedRevisions.includes(key))) structuralBlockers.push('untyped_exact_revision_fetch_set_incomplete');
  if (alignmentFailures.length) structuralBlockers.push('one_or_more_untyped_sources_failed_exact_alignment');
  if (missingNamespace.length) structuralBlockers.push('one_or_more_untyped_sources_missing_namespace');
  if (promotions.length) structuralBlockers.push('unsupported_page_type_identity_repeatability_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_untyped_page_evidence');
  const templateCounts = {};
  const categoryCounts = {};
  const namespaceCounts = {};
  for (const record of records) {
    namespaceCounts[String(record.sourceNamespaceId)] = (namespaceCounts[String(record.sourceNamespaceId)] || 0) + 1;
    for (const row of record.rootTemplateEvidence || []) templateCounts[row.template] = (templateCounts[row.template] || 0) + 1;
    for (const row of record.directCategoryEvidence || []) categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
  }
  const sourceEvidenceCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  return {
    contract: 'sensum.cross-skill-untyped-page-source-evidence-audit.v1',
    inputCoverage: {
      expectedUntypedCandidateCount: expectedKeys.length,
      sourceEvidenceRecordCount: records.length,
      relevantSourceSignatureCount: relevantSignatures.length,
      relevantSourceSignaturePageCount: signaturePageIds.length,
      preservedSourceSignatureContextCount: actualContexts.length,
      fetchedExactRevisionCount: fetchedRevisions.length,
      duplicateInputCandidateKeys: duplicates(expectedKeys),
      duplicateOutputCandidateKeys: duplicates(actualKeys),
      missingCandidateKeys: expectedKeys.filter(key => !actualKeys.includes(key)),
      unexpectedCandidateKeys: actualKeys.filter(key => !expectedKeys.includes(key)),
      missingSignaturePageIds: [...expectedPageIds].filter(key => !signaturePageIds.includes(key)),
      duplicateInputSignatureContextKeys: duplicates(expectedContexts),
      duplicateOutputSignatureContextKeys: duplicates(actualContexts),
      missingSignatureContextKeys: expectedContexts.filter(key => !actualContexts.includes(key)),
      unexpectedSignatureContextKeys: actualContexts.filter(key => !expectedContexts.includes(key)),
      duplicateFetchedRevisions: duplicates(fetchedRevisions),
      missingFetchedRevisions: relevantRevisions.filter(key => !fetchedRevisions.includes(key))
    },
    sourceAlignment: {
      fullyAlignedCount: records.length - alignmentFailures.length,
      failedCandidateKeys: alignmentFailures,
      allPageIdsRevisionsTimestampsTitlesHashesBytesTemplatesAndCategoriesAligned: alignmentFailures.length === 0
    },
    structuralEvidenceCoverage: {
      namespaceCounts: Object.fromEntries(Object.entries(namespaceCounts).sort(([a], [b]) => Number(a) - Number(b))),
      pagesWithRootTemplates: records.filter(row => row.rootTemplateEvidence?.length).length,
      pagesWithDirectCategories: records.filter(row => row.directCategoryEvidence?.length).length,
      uniqueRootTemplateCount: Object.keys(templateCounts).length,
      uniqueDirectCategoryCount: Object.keys(categoryCounts).length,
      rootTemplateCounts: Object.fromEntries(Object.entries(templateCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      directCategoryCounts: Object.fromEntries(Object.entries(categoryCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      totalLeadParagraphs: records.reduce((sum, row) => sum + (row.leadParagraphEvidence?.length || 0), 0),
      totalHeadings: records.reduce((sum, row) => sum + (row.headingEvidence?.length || 0), 0),
      totalSourceContentBytes: records.reduce((sum, row) => sum + Number(row.sourceContentBytes || 0), 0),
      missingNamespaceCandidateKeys: missingNamespace
    },
    semanticPromotionCoverage: {
      reviewReadyCount: records.filter(row => row.state === 'review_ready').length,
      pageTypeReviewedCount: records.filter(row => row.pageTypeReview?.state !== 'unreviewed').length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
      unsupportedPromotionCandidateKeys: promotions
    },
    accountStateFindings,
    sourceEvidenceCoverageComplete,
    pageTypeReviewComplete: false,
    canonicalIdentityComplete: false,
    repeatabilityAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'untyped_page_type_semantic_review_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: sourceEvidenceCoverageComplete
  };
}
