import { hash } from '../ingestion/lib.mjs';
import {
  crossSkillUntypedPageEvidenceFingerprint,
  findCrossSkillUntypedPageSufficiencyAccountState
} from './cross-skill-untyped-page-source-evidence-sufficiency-disposition-lib.mjs';

const REQUIRED_RULES = [
  'everyDispositionAndEvidenceRecordMustRevalidate',
  'inputDispositionAndEvidenceSetsMustMatchExactly',
  'everyEligibleDispositionExportsExactlyOnceInSourceOrder',
  'queueEntriesBindBothInputSnapshotsAndIntrinsicRecords',
  'queueEntriesPreserveAllSourceContextsAndStructuralEvidence',
  'readableArtifactMustRenderOnlyBoundEvidence',
  'decisionTemplatesMustStartBlank',
  'pageTypesMustComeOnlyFromTheExistingGenericPageTypeVocabulary',
  'exportDoesNotRecordAReviewDecisionOrSemanticDisposition',
  'pageTypeWouldNotProveCanonicalIdentityRepeatabilityRequirementsVariantsXpTimingMechanicsOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsTemplatesCategoriesAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DECISIONS = [
  'assign_one_or_more_existing_page_types',
  'confirm_non_entity_support_reference_or_file_page',
  'needs_additional_evidence'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|title|titles|candidateKey|candidateKeys|template|templates|category|categories|alias|aliases|override|overrides)$/i;
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
  return unique(findings).sort();
}

export function compileCrossSkillUntypedPageReviewQueueExportPolicy(policy = {}, pageTypePolicy = {}) {
  const expectedPageTypes = sorted(Object.keys(pageTypePolicy.types || {}));
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.policy === 'sensum.cross-skill-untyped-page-source-bound-review-queue-export-policy.v1' &&
    policy.evidenceContract === 'sensum.cross-skill-untyped-page-source-evidence.v1' &&
    policy.inputContract === 'sensum.cross-skill-untyped-page-source-evidence-sufficiency-disposition.v1' &&
    policy.queueContract === 'sensum.cross-skill-untyped-page-source-bound-review-queue-entry.v1' &&
    policy.decisionTemplateContract === 'sensum.cross-skill-untyped-page-source-bound-review-decision-template.v1' &&
    policy.auditContract === 'sensum.cross-skill-untyped-page-source-bound-review-queue-export-audit.v1' &&
    policy.inputDisposition === 'source_evidence_sufficient_for_explicit_page_type_review' &&
    policy.reviewRoutes?.mainNamespace === 'explicit_main_namespace_page_type_review' &&
    policy.reviewRoutes?.nonMainNamespace === 'explicit_non_main_namespace_scope_review' &&
    policy.queueState === 'pending_explicit_source_bound_untyped_page_review';
  const decisionsValid = same(policy.allowedDecisions || [], EXPECTED_DECISIONS);
  const pageTypesValid = pageTypePolicy.policy === 'sensum.unlock-linked-page-entity-type-policy.v1' && expectedPageTypes.length > 0 && same(sorted(policy.allowedPageTypes || []), expectedPageTypes);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && decisionsValid && pageTypesValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    decisionsValid,
    pageTypesValid,
    allowedPageTypeCount: expectedPageTypes.length,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function intrinsicRecordValid(record, contract, contentHash = hash) {
  return record?.contract === contract && validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash;
}

function evidenceRecordValid(record, contentHash = hash) {
  return intrinsicRecordValid(record, 'sensum.cross-skill-untyped-page-source-evidence.v1', contentHash) &&
    record.state === 'review_ready' && record.accountIndependent === true && Number.isInteger(record.sourcePageId) &&
    Number.isInteger(record.sourceNamespaceId) && validHash(record.sourceCandidateContentHash) && validHash(record.sourceContentHash) &&
    Array.isArray(record.sourceSignatureContexts) && record.sourceSignatureContexts.length > 0 &&
    Array.isArray(record.rootTemplateEvidence) && Array.isArray(record.directCategoryEvidence) &&
    Array.isArray(record.leadParagraphEvidence) && Array.isArray(record.headingEvidence) &&
    record.pageTypeReview?.state === 'unreviewed' && record.pageTypeReview?.disposition === null &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.optimizerEligible === false &&
    Object.values(record.revisionAlignment || {}).length > 0 && Object.values(record.revisionAlignment || {}).every(Boolean);
}

function dispositionRecordValid(record, evidence, policy, evidenceSnapshotContentHash, contentHash = hash) {
  if (!intrinsicRecordValid(record, policy.inputContract, contentHash) || !evidence) return false;
  const expectedRoute = record.sourceNamespaceId === 0 ? policy.reviewRoutes.mainNamespace : policy.reviewRoutes.nonMainNamespace;
  return record.state === 'review_routed' && record.accountIndependent === true &&
    record.evidenceSufficiencyDisposition === policy.inputDisposition && record.reviewRoute === expectedRoute &&
    record.candidateKey === evidence.candidateKey && record.sourcePageId === evidence.sourcePageId &&
    record.resolvedTitle === evidence.resolvedTitle && record.sourceNamespaceId === evidence.sourceNamespaceId &&
    String(record.sourceRevision) === String(evidence.sourceRevision) && record.sourceTimestamp === evidence.sourceTimestamp &&
    record.sourceUrl === evidence.sourceUrl && record.sourceContentHash === evidence.sourceContentHash &&
    record.sourceEvidenceContentHash === evidence.contentHash && record.sourceEvidenceSnapshotContentHash === evidenceSnapshotContentHash &&
    record.evidenceFingerprint === crossSkillUntypedPageEvidenceFingerprint(evidence, contentHash) &&
    same(record.sourceSignatureContexts, evidence.sourceSignatureContexts, contentHash) &&
    record.pageTypeReview?.state === 'unreviewed' && record.pageTypeReview?.disposition === null &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.optimizerEligible === false;
}

function sourcePageIdentity(evidence) {
  return {
    sourcePageId: evidence.sourcePageId,
    resolvedTitle: evidence.resolvedTitle,
    sourceNamespaceId: evidence.sourceNamespaceId,
    sourceRevision: evidence.sourceRevision,
    sourceTimestamp: evidence.sourceTimestamp,
    sourceUrl: evidence.sourceUrl,
    sourceContentHash: evidence.sourceContentHash,
    sourceContentBytes: evidence.sourceContentBytes,
    sourceLineCount: evidence.sourceLineCount
  };
}

function structuralEvidence(evidence) {
  return {
    rootTemplates: evidence.rootTemplateEvidence,
    directCategories: evidence.directCategoryEvidence,
    leadParagraphs: evidence.leadParagraphEvidence,
    headings: evidence.headingEvidence,
    summary: {
      sourceSignatureContextCount: evidence.sourceSignatureContexts.length,
      rootTemplateCount: evidence.rootTemplateEvidence.length,
      directCategoryCount: evidence.directCategoryEvidence.length,
      leadParagraphCount: evidence.leadParagraphEvidence.length,
      headingCount: evidence.headingEvidence.length
    }
  };
}

function queueEvidenceFingerprint(disposition, evidence, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash = hash) {
  return contentHash({
    candidateKey: disposition.candidateKey,
    sourceDispositionRecordContentHash: disposition.contentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: evidence.contentHash,
    sourceEvidenceSnapshotContentHash: evidenceSnapshotContentHash,
    evidenceFingerprint: disposition.evidenceFingerprint,
    sourcePageIdentity: sourcePageIdentity(evidence),
    skillKeys: sorted(evidence.skillKeys || []),
    statementKeys: sorted(evidence.statementKeys || []),
    sourceSignatureContexts: evidence.sourceSignatureContexts,
    structuralEvidence: structuralEvidence(evidence),
    reviewRoute: disposition.reviewRoute
  });
}

function expectedQueueEntry(disposition, evidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash = hash) {
  return {
    contract: policy.queueContract,
    queueEntryKey: `${disposition.candidateKey}|source-bound-untyped-page-review`,
    candidateKey: disposition.candidateKey,
    sourceDispositionRecordContentHash: disposition.contentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: evidence.contentHash,
    sourceEvidenceSnapshotContentHash: evidenceSnapshotContentHash,
    evidenceFingerprint: disposition.evidenceFingerprint,
    queueEntryEvidenceFingerprint: queueEvidenceFingerprint(disposition, evidence, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash),
    sourcePageIdentity: sourcePageIdentity(evidence),
    skillKeys: sorted(evidence.skillKeys || []),
    statementKeys: sorted(evidence.statementKeys || []),
    sourceSignatureContexts: evidence.sourceSignatureContexts,
    structuralEvidence: structuralEvidence(evidence),
    reviewRoute: disposition.reviewRoute,
    allowedDecisions: policy.allowedDecisions,
    allowedPageTypes: policy.allowedPageTypes,
    reviewDecision: null,
    reviewedPageTypes: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    reviewEvidenceKeys: [],
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: [
      'explicit_untyped_page_review_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ],
    state: policy.queueState
  };
}

function expectedDecisionTemplate(entry, policy, contentHash = hash) {
  const base = {
    contract: policy.decisionTemplateContract,
    queueEntryKey: entry.queueEntryKey,
    queueEntryEvidenceFingerprint: entry.queueEntryEvidenceFingerprint,
    candidateKey: entry.candidateKey,
    sourceDispositionRecordContentHash: entry.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: entry.sourceDispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: entry.sourceEvidenceRecordContentHash,
    sourceEvidenceSnapshotContentHash: entry.sourceEvidenceSnapshotContentHash,
    sourcePageId: entry.sourcePageIdentity.sourcePageId,
    sourceRevision: entry.sourcePageIdentity.sourceRevision,
    sourceContentHash: entry.sourcePageIdentity.sourceContentHash,
    reviewRoute: entry.reviewRoute,
    allowedDecisions: policy.allowedDecisions,
    allowedPageTypes: policy.allowedPageTypes,
    decision: null,
    selectedPageTypes: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    evidenceKeys: [],
    state: 'blank_explicit_human_review_template'
  };
  return { ...base, templateContentHash: contentHash(base) };
}

const markdownText = value => String(value ?? '').replaceAll('`', '\\`').replaceAll('\r', ' ').replaceAll('\n', ' ');

export function renderCrossSkillUntypedPageReviewQueueMarkdown(records = []) {
  const lines = [
    '# Cross-skill untyped-page source-bound review queue',
    '',
    'Every entry is blank and requires explicit human review. Structural evidence is not a page-type verdict. A page-type decision does not establish canonical identity, repeatability, requirements, XP, timing, mechanics, or optimizer eligibility.',
    ''
  ];
  records.forEach((record, index) => {
    const identity = record.sourcePageIdentity;
    lines.push(`## ${index + 1}. ${markdownText(identity.resolvedTitle)}`);
    lines.push('');
    lines.push(`- Queue key: \`${markdownText(record.queueEntryKey)}\``);
    lines.push(`- Candidate: \`${markdownText(record.candidateKey)}\``);
    lines.push(`- Review route: \`${markdownText(record.reviewRoute)}\``);
    lines.push(`- Exact source: [page ${identity.sourcePageId}, revision ${markdownText(identity.sourceRevision)}](${identity.sourceUrl}?oldid=${encodeURIComponent(identity.sourceRevision)})`);
    lines.push(`- Source hash: \`${identity.sourceContentHash}\``);
    lines.push(`- Skills: ${record.skillKeys.map(markdownText).join(', ') || 'none recorded'}`);
    lines.push(`- Allowed decisions: ${record.allowedDecisions.map(value => `\`${markdownText(value)}\``).join(', ')}`);
    lines.push(`- Existing page-type vocabulary: ${record.allowedPageTypes.map(value => `\`${markdownText(value)}\``).join(', ')}`);
    lines.push('');
    lines.push('### Retained source contexts');
    lines.push('');
    record.sourceSignatureContexts.forEach(context => lines.push(`- \`${markdownText(context.targetKey)}\` — requested “${markdownText(context.requestedTitle)}”${context.requestedFragment ? `, fragment “${markdownText(context.requestedFragment)}”` : ''}`));
    lines.push('');
    lines.push('### Structural evidence');
    lines.push('');
    lines.push(`- Root templates: ${record.structuralEvidence.rootTemplates.map(item => `\`${markdownText(item.template)}\` (line ${item.line})`).join(', ') || 'none'}`);
    lines.push(`- Direct categories: ${record.structuralEvidence.directCategories.map(item => `\`${markdownText(item.category)}\` (line ${item.line})`).join(', ') || 'none'}`);
    lines.push(`- Headings: ${record.structuralEvidence.headings.map(item => `“${markdownText(item.rawTitle)}” (line ${item.line})`).join(', ') || 'none'}`);
    lines.push('');
    lines.push('Lead paragraphs:');
    lines.push('');
    if (record.structuralEvidence.leadParagraphs.length) record.structuralEvidence.leadParagraphs.forEach(item => lines.push(`> ${markdownText(item.rawText)}`));
    else lines.push('> None retained.');
    lines.push('');
    lines.push('Decision, selected page types, reviewer, timestamp, notes, and evidence keys remain blank in the paired decision template.');
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
}

export function serializeCrossSkillUntypedPageReviewDecisionTemplates(templates = []) {
  return templates.map(template => JSON.stringify(template)).join('\n') + (templates.length ? '\n' : '');
}

function reviewOrPromotion(record) {
  return record.reviewDecision !== null || record.reviewedPageTypes?.length !== 0 || record.reviewer !== null ||
    record.reviewedAt !== null || record.reviewNotes !== null || record.reviewEvidenceKeys?.length !== 0 ||
    record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null ||
    record.repeatabilityClassification !== null || record.optimizerEligible !== false;
}

function templateDecided(template) {
  return template.decision !== null || template.selectedPageTypes?.length !== 0 || template.reviewer !== null ||
    template.reviewedAt !== null || template.reviewNotes !== null || template.evidenceKeys?.length !== 0 ||
    template.state !== 'blank_explicit_human_review_template';
}

export function buildCrossSkillUntypedPageSourceBoundReviewQueueExport({ dispositionRecords = [], evidenceRecords = [], policy = {}, pageTypePolicy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '', contentHash = hash }) {
  const compiled = compileCrossSkillUntypedPageReviewQueueExportPolicy(policy, pageTypePolicy);
  const evidenceByKey = new Map(evidenceRecords.map(row => [row.candidateKey, row]));
  const inputComplete = compiled.valid && validHash(dispositionSnapshotContentHash) && validHash(evidenceSnapshotContentHash) &&
    dispositionRecords.length > 0 && dispositionRecords.length === evidenceRecords.length &&
    !duplicates(dispositionRecords.map(row => row.candidateKey)).length && !duplicates(evidenceRecords.map(row => row.candidateKey)).length &&
    dispositionRecords.every(row => evidenceRecordValid(evidenceByKey.get(row.candidateKey), contentHash) && dispositionRecordValid(row, evidenceByKey.get(row.candidateKey), policy, evidenceSnapshotContentHash, contentHash)) &&
    evidenceRecords.every(row => dispositionRecords.some(item => item.candidateKey === row.candidateKey));
  const records = inputComplete ? dispositionRecords.map(disposition => expectedQueueEntry(disposition, evidenceByKey.get(disposition.candidateKey), policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash)) : [];
  const decisionTemplates = records.map(record => expectedDecisionTemplate(record, policy, contentHash));
  const reviewMarkdown = renderCrossSkillUntypedPageReviewQueueMarkdown(records);
  const decisionTemplateNdjson = serializeCrossSkillUntypedPageReviewDecisionTemplates(decisionTemplates);
  const audit = auditCrossSkillUntypedPageSourceBoundReviewQueueExport(records, { dispositionRecords, evidenceRecords, policy, pageTypePolicy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, decisionTemplates, reviewMarkdown, decisionTemplateNdjson, contentHash });
  return { records, decisionTemplates, reviewMarkdown, decisionTemplateNdjson, audit };
}

export function auditCrossSkillUntypedPageSourceBoundReviewQueueExport(records = [], { dispositionRecords = [], evidenceRecords = [], policy = {}, pageTypePolicy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '', decisionTemplates = [], reviewMarkdown = '', decisionTemplateNdjson = '', contentHash = hash } = {}) {
  const compiled = compileCrossSkillUntypedPageReviewQueueExportPolicy(policy, pageTypePolicy);
  const dispositionKeys = dispositionRecords.map(row => row.candidateKey);
  const evidenceKeys = evidenceRecords.map(row => row.candidateKey);
  const outputKeys = records.map(row => row.candidateKey);
  const evidenceByKey = new Map(evidenceRecords.map(row => [row.candidateKey, row]));
  const invalidEvidenceKeys = evidenceRecords.filter(row => !evidenceRecordValid(row, contentHash)).map(row => row.candidateKey);
  const invalidDispositionKeys = dispositionRecords.filter(row => !dispositionRecordValid(row, evidenceByKey.get(row.candidateKey), policy, evidenceSnapshotContentHash, contentHash)).map(row => row.candidateKey);
  const expectedRecords = compiled.valid && validHash(dispositionSnapshotContentHash) && validHash(evidenceSnapshotContentHash)
    ? dispositionRecords.map(row => evidenceByKey.has(row.candidateKey) ? expectedQueueEntry(row, evidenceByKey.get(row.candidateKey), policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash) : null).filter(Boolean) : [];
  const expectedByKey = new Map(expectedRecords.map(row => [row.candidateKey, row]));
  const recordMismatches = records.filter(row => !expectedByKey.has(row.candidateKey) || !same(row, expectedByKey.get(row.candidateKey), contentHash)).map(row => row.candidateKey);
  const orderMatches = same(outputKeys, dispositionKeys, contentHash);
  const expectedTemplates = records.map(row => expectedDecisionTemplate(row, policy, contentHash));
  const templateMismatches = decisionTemplates.filter((row, index) => !expectedTemplates[index] || !same(row, expectedTemplates[index], contentHash)).map(row => row.queueEntryKey);
  if (decisionTemplates.length !== expectedTemplates.length) templateMismatches.push('decision_template_count_mismatch');
  const markdownMatches = reviewMarkdown === renderCrossSkillUntypedPageReviewQueueMarkdown(records);
  const ndjsonMatches = decisionTemplateNdjson === serializeCrossSkillUntypedPageReviewDecisionTemplates(decisionTemplates);
  const promotions = records.filter(reviewOrPromotion).map(row => row.candidateKey);
  const decidedTemplates = decisionTemplates.filter(templateDecided).map(row => row.queueEntryKey);
  const accountStateFindings = [
    ...findCrossSkillUntypedPageSufficiencyAccountState(records),
    ...findCrossSkillUntypedPageSufficiencyAccountState(decisionTemplates)
  ];
  const blockers = [];
  if (!compiled.valid) blockers.push('untyped_page_review_queue_export_policy_invalid_or_page_specific');
  if (!validHash(dispositionSnapshotContentHash) || !validHash(evidenceSnapshotContentHash)) blockers.push('one_or_more_upstream_snapshot_hashes_missing_or_invalid');
  if (duplicates(dispositionKeys).length || duplicates(evidenceKeys).length) blockers.push('duplicate_input_candidate_keys');
  if (!same(sorted(dispositionKeys), sorted(evidenceKeys), contentHash)) blockers.push('disposition_and_evidence_candidate_sets_do_not_match');
  if (invalidEvidenceKeys.length) blockers.push('one_or_more_source_evidence_records_failed_revalidation');
  if (invalidDispositionKeys.length) blockers.push('one_or_more_sufficiency_dispositions_failed_revalidation');
  if (duplicates(outputKeys).length || !same(sorted(outputKeys), sorted(dispositionKeys), contentHash)) blockers.push('review_queue_candidate_set_incomplete_or_mismatched');
  if (!orderMatches) blockers.push('review_queue_order_does_not_match_disposition_order');
  if (recordMismatches.length) blockers.push('one_or_more_review_queue_records_do_not_match_bound_inputs');
  if (templateMismatches.length || !ndjsonMatches) blockers.push('one_or_more_blank_decision_templates_do_not_match_queue');
  if (!markdownMatches) blockers.push('readable_review_artifact_does_not_match_queue');
  if (promotions.length || decidedTemplates.length) blockers.push('queue_export_created_review_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  const queueExportComplete = dispositionKeys.length > 0 && blockers.length === 0;
  return {
    contract: policy.auditContract || 'sensum.cross-skill-untyped-page-source-bound-review-queue-export-audit.v1',
    inputCoverage: {
      dispositionRecordCount: dispositionRecords.length,
      evidenceRecordCount: evidenceRecords.length,
      revalidatedDispositionCount: dispositionRecords.length - invalidDispositionKeys.length,
      revalidatedEvidenceRecordCount: evidenceRecords.length - invalidEvidenceKeys.length,
      duplicateDispositionCandidateKeys: duplicates(dispositionKeys),
      duplicateEvidenceCandidateKeys: duplicates(evidenceKeys),
      dispositionEvidenceCandidateSetsMatch: same(sorted(dispositionKeys), sorted(evidenceKeys), contentHash),
      invalidDispositionCandidateKeys: invalidDispositionKeys,
      invalidEvidenceCandidateKeys: invalidEvidenceKeys
    },
    policyCoverage: compiled,
    sourceIntegrityCoverage: {
      exactRevisionSourceCount: evidenceRecords.length,
      retainedSourceSignatureContextCount: evidenceRecords.reduce((sum, row) => sum + (row.sourceSignatureContexts?.length || 0), 0),
      retainedRootTemplateCount: evidenceRecords.reduce((sum, row) => sum + (row.rootTemplateEvidence?.length || 0), 0),
      retainedDirectCategoryCount: evidenceRecords.reduce((sum, row) => sum + (row.directCategoryEvidence?.length || 0), 0),
      retainedLeadParagraphCount: evidenceRecords.reduce((sum, row) => sum + (row.leadParagraphEvidence?.length || 0), 0),
      retainedHeadingCount: evidenceRecords.reduce((sum, row) => sum + (row.headingEvidence?.length || 0), 0),
      allEvidenceRevalidated: invalidEvidenceKeys.length === 0 && invalidDispositionKeys.length === 0
    },
    queueCoverage: {
      reviewQueueEntryCount: records.length,
      mainNamespaceReviewEntryCount: records.filter(row => row.reviewRoute === policy.reviewRoutes?.mainNamespace).length,
      nonMainNamespaceReviewEntryCount: records.filter(row => row.reviewRoute === policy.reviewRoutes?.nonMainNamespace).length,
      blankDecisionTemplateCount: decisionTemplates.length,
      duplicateOutputCandidateKeys: duplicates(outputKeys),
      missingOutputCandidateKeys: dispositionKeys.filter(key => !outputKeys.includes(key)),
      unexpectedOutputCandidateKeys: outputKeys.filter(key => !dispositionKeys.includes(key)),
      recordMismatchCandidateKeys: recordMismatches,
      orderMatchesDispositionOrder: orderMatches
    },
    artifactCoverage: {
      reviewMarkdownMatchesQueue: markdownMatches,
      decisionTemplateNdjsonMatchesTemplates: ndjsonMatches,
      decisionTemplateMismatchKeys: unique(templateMismatches),
      reviewMarkdownBytes: Buffer.byteLength(reviewMarkdown, 'utf8'),
      decisionTemplateNdjsonBytes: Buffer.byteLength(decisionTemplateNdjson, 'utf8')
    },
    semanticPreservationCoverage: {
      recordedReviewCount: records.filter(row => row.reviewDecision !== null).length,
      reviewedPageTypeCount: records.reduce((sum, row) => sum + (row.reviewedPageTypes?.length || 0), 0),
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
      decidedTemplateCount: decidedTemplates.length,
      unsupportedPromotionCandidateKeys: promotions
    },
    accountStateFindings,
    queueExportComplete,
    pageTypeReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers,
      'explicit_untyped_page_reviews_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: queueExportComplete
  };
}
