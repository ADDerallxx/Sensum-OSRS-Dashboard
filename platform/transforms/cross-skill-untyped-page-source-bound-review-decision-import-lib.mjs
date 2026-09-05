import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'oneRecordedDecisionPerCompletedSubmission',
  'partialReviewBatchesAreAllowed',
  'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected',
  'anyInvalidRowRejectsTheEntireBatch',
  'queueManifestIntrinsicRecordTemplateSnapshotAndEvidenceHashesMustRevalidate',
  'submissionMustMatchEveryImmutableQueueBinding',
  'submissionFieldSetMustExactlyMatchTheBlankTemplate',
  'decisionMustBeExplicitlyAllowed',
  'assignedPageTypesMustBeNonemptyUniqueAndFromTheBoundVocabulary',
  'nonAssignmentDecisionsMustHaveNoSelectedPageTypes',
  'reviewerReviewedAtNotesAndBoundEvidenceKeysAreRequired',
  'reviewedAtMustNotPrecedeTheBoundSourceTimestamp',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingADecisionDoesNotApplyPageTypeCanonicalIdentityRepeatabilityRequirementsVariantsXpTimingMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsTemplatesCategoriesAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DECISIONS = [
  'assign_one_or_more_existing_page_types',
  'confirm_non_entity_support_reference_or_file_page',
  'needs_additional_evidence'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
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

export function compileCrossSkillUntypedPageReviewDecisionImportPolicy(policy = {}, pageTypePolicy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.policy === 'sensum.cross-skill-untyped-page-source-bound-review-decision-import-policy.v1' &&
    policy.queueContract === 'sensum.cross-skill-untyped-page-source-bound-review-queue-entry.v1' &&
    policy.submissionContract === 'sensum.cross-skill-untyped-page-source-bound-review-decision-template.v1' &&
    policy.recordContract === 'sensum.cross-skill-untyped-page-source-bound-review-decision.v1' &&
    policy.auditContract === 'sensum.cross-skill-untyped-page-source-bound-review-decision-import-audit.v1' &&
    policy.queueState === 'pending_explicit_source_bound_untyped_page_review' &&
    policy.recordState === 'recorded_source_bound_untyped_page_review_decision_pending_semantic_application';
  const decisionsValid = same(policy.allowedDecisions || [], EXPECTED_DECISIONS);
  const allowedPageTypes = sorted(Object.keys(pageTypePolicy.types || {}));
  const pageTypePolicyValid = pageTypePolicy.policy === 'sensum.unlock-linked-page-entity-type-policy.v1' && allowedPageTypes.length > 0;
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && decisionsValid && pageTypePolicyValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    decisionsValid,
    pageTypePolicyValid,
    allowedPageTypes,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const normalized = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return new Date(parsed).toISOString() === normalized;
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|ai)$/.test(value) ||
    /\b(?:bot|automated reviewer|language model|ai reviewer|codex|chatgpt|openai|sensum|gpt(?:[- ]?\d[^ ]*)?)\b/.test(value);
}

function sourceIdentityComplete(source = {}) {
  return Number.isInteger(source.sourcePageId) && source.sourcePageId > 0 && typeof source.resolvedTitle === 'string' && source.resolvedTitle.length > 0 &&
    Number.isInteger(source.sourceNamespaceId) && typeof source.sourceRevision === 'string' && source.sourceRevision.length > 0 &&
    validIsoTimestamp(source.sourceTimestamp) && typeof source.sourceUrl === 'string' && source.sourceUrl.length > 0 &&
    validHash(source.sourceContentHash) && Number.isInteger(source.sourceContentBytes) && source.sourceContentBytes > 0 &&
    Number.isInteger(source.sourceLineCount) && source.sourceLineCount > 0;
}

function structuralEvidenceComplete(value = {}) {
  const arrays = ['rootTemplates', 'directCategories', 'leadParagraphs', 'headings'];
  if (!arrays.every(key => Array.isArray(value[key]))) return false;
  return value.summary?.sourceSignatureContextCount >= 1 &&
    value.summary.rootTemplateCount === value.rootTemplates.length &&
    value.summary.directCategoryCount === value.directCategories.length &&
    value.summary.leadParagraphCount === value.leadParagraphs.length &&
    value.summary.headingCount === value.headings.length;
}

function queueEvidenceFingerprint(record, contentHash = hash) {
  return contentHash({
    candidateKey: record.candidateKey,
    sourceDispositionRecordContentHash: record.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: record.sourceDispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: record.sourceEvidenceRecordContentHash,
    sourceEvidenceSnapshotContentHash: record.sourceEvidenceSnapshotContentHash,
    evidenceFingerprint: record.evidenceFingerprint,
    sourcePageIdentity: record.sourcePageIdentity,
    skillKeys: sorted(record.skillKeys || []),
    statementKeys: sorted(record.statementKeys || []),
    sourceSignatureContexts: record.sourceSignatureContexts,
    structuralEvidence: record.structuralEvidence,
    reviewRoute: record.reviewRoute
  });
}

function expectedBlankTemplate(queue, policy, contentHash = hash) {
  const base = {
    contract: policy.submissionContract,
    queueEntryKey: queue.queueEntryKey,
    queueEntryEvidenceFingerprint: queue.queueEntryEvidenceFingerprint,
    candidateKey: queue.candidateKey,
    sourceDispositionRecordContentHash: queue.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: queue.sourceDispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: queue.sourceEvidenceRecordContentHash,
    sourceEvidenceSnapshotContentHash: queue.sourceEvidenceSnapshotContentHash,
    sourcePageId: queue.sourcePageIdentity?.sourcePageId,
    sourceRevision: queue.sourcePageIdentity?.sourceRevision,
    sourceContentHash: queue.sourcePageIdentity?.sourceContentHash,
    reviewRoute: queue.reviewRoute,
    allowedDecisions: queue.allowedDecisions,
    allowedPageTypes: queue.allowedPageTypes,
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

function allowedEvidenceKeys(queue, contentHash = hash) {
  return new Set([
    queue.queueEntryEvidenceFingerprint,
    queue.evidenceFingerprint,
    queue.sourceDispositionRecordContentHash,
    queue.sourceEvidenceRecordContentHash,
    queue.sourcePageIdentity?.sourceContentHash,
    ...(queue.sourceSignatureContexts || []).map(context => context.sourceSignatureContentHash),
    ...(queue.structuralEvidence?.rootTemplates || []).map(item => contentHash(item)),
    ...(queue.structuralEvidence?.directCategories || []).map(item => contentHash(item)),
    ...(queue.structuralEvidence?.leadParagraphs || []).map(item => contentHash(item)),
    ...(queue.structuralEvidence?.headings || []).map(item => contentHash(item))
  ].filter(validHash));
}

function queueRecordIntegrity(record = {}, policy = {}, pageTypePolicy = {}, contentHash = hash) {
  const compiled = compileCrossSkillUntypedPageReviewDecisionImportPolicy(policy, pageTypePolicy);
  const expectedRoute = record.sourcePageIdentity?.sourceNamespaceId === 0 ? 'explicit_main_namespace_page_type_review' : 'explicit_non_main_namespace_scope_review';
  const checks = {
    contractMatches: record.contract === policy.queueContract,
    stateMatches: record.state === policy.queueState,
    intrinsicRecordHashMatches: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    keysAndHashesPresent: typeof record.queueEntryKey === 'string' && typeof record.candidateKey === 'string' &&
      [record.sourceDispositionRecordContentHash, record.sourceDispositionSnapshotContentHash, record.sourceEvidenceRecordContentHash,
        record.sourceEvidenceSnapshotContentHash, record.evidenceFingerprint, record.queueEntryEvidenceFingerprint].every(validHash),
    queueEvidenceFingerprintMatches: record.queueEntryEvidenceFingerprint === queueEvidenceFingerprint(record, contentHash),
    sourceIdentityComplete: sourceIdentityComplete(record.sourcePageIdentity),
    exactRouteMatchesNamespace: record.reviewRoute === expectedRoute,
    sourceContextsPresent: Array.isArray(record.sourceSignatureContexts) && record.sourceSignatureContexts.length > 0,
    structuralEvidenceComplete: structuralEvidenceComplete(record.structuralEvidence) && record.structuralEvidence.summary.sourceSignatureContextCount === record.sourceSignatureContexts.length,
    allowedDecisionsMatch: same(record.allowedDecisions || [], policy.allowedDecisions || [], contentHash),
    allowedPageTypesMatch: same(sorted(record.allowedPageTypes || []), compiled.allowedPageTypes, contentHash),
    reviewFieldsBlank: record.reviewDecision === null && Array.isArray(record.reviewedPageTypes) && record.reviewedPageTypes.length === 0 &&
      record.reviewer === null && record.reviewedAt === null && record.reviewNotes === null &&
      Array.isArray(record.reviewEvidenceKeys) && record.reviewEvidenceKeys.length === 0,
    semanticGatesClosed: record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
      record.repeatabilityClassification === null && record.optimizerEligible === false,
    accountIndependent: record.accountIndependent === true,
    blankTemplateReconstructable: validHash(expectedBlankTemplate(record, policy, contentHash).templateContentHash)
  };
  return { checks, complete: compiled.valid && Object.values(checks).every(Boolean), expectedTemplate: expectedBlankTemplate(record, policy, contentHash) };
}

function submissionShape(submission = {}) {
  const pageTypes = Array.isArray(submission.selectedPageTypes) ? submission.selectedPageTypes : [];
  const evidenceKeys = Array.isArray(submission.evidenceKeys) ? submission.evidenceKeys : [];
  const allBlank = blank(submission.decision) && pageTypes.length === 0 && blank(submission.reviewer) && blank(submission.reviewedAt) && blank(submission.reviewNotes) && evidenceKeys.length === 0;
  const anyReviewField = !blank(submission.decision) || pageTypes.length > 0 || !blank(submission.reviewer) || !blank(submission.reviewedAt) || !blank(submission.reviewNotes) || evidenceKeys.length > 0;
  return { allBlank, anyReviewField, pageTypes, evidenceKeys };
}

function submissionAssessment(submission = {}, queue, policy = {}, pageTypePolicy = {}, contentHash = hash) {
  const shape = submissionShape(submission);
  const expected = queue ? expectedBlankTemplate(queue, policy, contentHash) : {};
  const compiled = compileCrossSkillUntypedPageReviewDecisionImportPolicy(policy, pageTypePolicy);
  const bindingChecks = {
    fieldSetExact: same(sorted(Object.keys(submission)), sorted(Object.keys(expected)), contentHash),
    contractMatches: submission.contract === policy.submissionContract,
    templateStateMatches: submission.state === 'blank_explicit_human_review_template',
    queueEntryMatches: submission.queueEntryKey === queue?.queueEntryKey,
    queueEntryEvidenceFingerprintMatches: submission.queueEntryEvidenceFingerprint === queue?.queueEntryEvidenceFingerprint,
    candidateKeyMatches: submission.candidateKey === queue?.candidateKey,
    sourceDispositionRecordHashMatches: submission.sourceDispositionRecordContentHash === queue?.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotHashMatches: submission.sourceDispositionSnapshotContentHash === queue?.sourceDispositionSnapshotContentHash,
    sourceEvidenceRecordHashMatches: submission.sourceEvidenceRecordContentHash === queue?.sourceEvidenceRecordContentHash,
    sourceEvidenceSnapshotHashMatches: submission.sourceEvidenceSnapshotContentHash === queue?.sourceEvidenceSnapshotContentHash,
    sourcePageIdMatches: submission.sourcePageId === queue?.sourcePageIdentity?.sourcePageId,
    sourceRevisionMatches: String(submission.sourceRevision) === String(queue?.sourcePageIdentity?.sourceRevision),
    sourceContentHashMatches: submission.sourceContentHash === queue?.sourcePageIdentity?.sourceContentHash,
    reviewRouteMatches: submission.reviewRoute === queue?.reviewRoute,
    allowedDecisionsMatch: same(submission.allowedDecisions || [], queue?.allowedDecisions || [], contentHash),
    allowedPageTypesMatch: same(submission.allowedPageTypes || [], queue?.allowedPageTypes || [], contentHash),
    templateContentHashMatches: submission.templateContentHash === expected.templateContentHash
  };
  const citedKeys = allowedEvidenceKeys(queue || {}, contentHash);
  const assigning = submission.decision === 'assign_one_or_more_existing_page_types';
  const contentChecks = shape.allBlank ? {} : {
    decisionAllowed: policy.allowedDecisions?.includes(submission.decision) === true,
    selectedPageTypesFitDecision: assigning
      ? shape.pageTypes.length > 0 && duplicates(shape.pageTypes).length === 0 && shape.pageTypes.every(type => compiled.allowedPageTypes.includes(type))
      : shape.pageTypes.length === 0,
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforeSource: validIsoTimestamp(submission.reviewedAt) && validIsoTimestamp(queue?.sourcePageIdentity?.sourceTimestamp) &&
      Date.parse(submission.reviewedAt) >= Date.parse(queue.sourcePageIdentity.sourceTimestamp),
    reviewNotesPresent: typeof submission.reviewNotes === 'string' && submission.reviewNotes.trim().length > 0,
    evidenceKeysPresentUniqueAndBound: shape.evidenceKeys.length > 0 && duplicates(shape.evidenceKeys).length === 0 && shape.evidenceKeys.every(key => citedKeys.has(key))
  };
  const bindingComplete = Object.values(bindingChecks).every(Boolean);
  const contentComplete = shape.allBlank || Object.values(contentChecks).every(Boolean);
  return {
    shape,
    bindingChecks,
    contentChecks,
    blank: shape.allBlank && bindingComplete,
    complete: shape.anyReviewField && !shape.allBlank && bindingComplete && contentComplete,
    partialOrInvalid: !bindingComplete || (shape.anyReviewField && !shape.allBlank && !contentComplete)
  };
}

function decisionRecord(submission, queue, queueSnapshotContentHash, policy, contentHash = hash) {
  const decisionFacts = {
    decision: submission.decision,
    selectedPageTypes: sorted(submission.selectedPageTypes || []),
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    reviewNotes: submission.reviewNotes.trim(),
    evidenceKeys: sorted(submission.evidenceKeys || [])
  };
  const base = {
    contract: policy.recordContract,
    decisionKey: `${queue.queueEntryKey}|untyped-page-review-decision|${contentHash(decisionFacts)}`,
    queueEntryKey: queue.queueEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceDispositionRecordContentHash: queue.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: queue.sourceDispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: queue.sourceEvidenceRecordContentHash,
    sourceEvidenceSnapshotContentHash: queue.sourceEvidenceSnapshotContentHash,
    queueEntryEvidenceFingerprint: queue.queueEntryEvidenceFingerprint,
    evidenceFingerprint: queue.evidenceFingerprint,
    candidateKey: queue.candidateKey,
    sourcePageIdentity: queue.sourcePageIdentity,
    reviewRoute: queue.reviewRoute,
    ...decisionFacts,
    reviewDecisionRecorded: true,
    pageTypeDispositionApplied: false,
    pageTypeReview: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: [
      'review_decision_recorded_page_type_disposition_not_applied',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ],
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
  return unique(findings).sort();
}

function flight(queueRecords = [], submissions = [], policy = {}, pageTypePolicy = {}, queueSnapshotContentHash = '', contentHash = hash) {
  const compiled = compileCrossSkillUntypedPageReviewDecisionImportPolicy(policy, pageTypePolicy);
  const queueAssessments = queueRecords.map(record => ({ queueEntryKey: record.queueEntryKey, ...queueRecordIntegrity(record, policy, pageTypePolicy, contentHash) }));
  const queueKeys = queueRecords.map(record => record.queueEntryKey);
  const submissionKeys = submissions.map(record => record.queueEntryKey);
  const queueByKey = new Map(queueRecords.map(record => [record.queueEntryKey, record]));
  const submissionAssessments = submissions.map((submission, index) => ({ index, queueEntryKey: submission.queueEntryKey, ...submissionAssessment(submission, queueByKey.get(submission.queueEntryKey), policy, pageTypePolicy, contentHash) }));
  const completed = submissionAssessments.filter(item => item.complete);
  const blanks = submissionAssessments.filter(item => item.blank);
  const invalid = submissionAssessments.filter(item => item.partialOrInvalid);
  const expectedRecords = completed.map(item => decisionRecord(submissions[item.index], queueByKey.get(item.queueEntryKey), queueSnapshotContentHash, policy, contentHash));
  const accountFindings = accountStateFindings([queueRecords, submissions]);
  const duplicateQueueKeys = duplicates(queueKeys);
  const duplicateSubmissionKeys = duplicates(submissionKeys);
  const queueIntegrityFailures = queueAssessments.filter(item => !item.complete).map(item => item.queueEntryKey);
  const atomicAcceptable = compiled.valid && validHash(queueSnapshotContentHash) && queueRecords.length > 0 &&
    !duplicateQueueKeys.length && !duplicateSubmissionKeys.length && !queueIntegrityFailures.length &&
    !invalid.length && completed.length > 0 && !accountFindings.length;
  return { compiled, queueAssessments, submissionAssessments, expectedRecords, accountFindings, duplicateQueueKeys, duplicateSubmissionKeys, queueIntegrityFailures, completed, blanks, invalid, atomicAcceptable };
}

export function buildCrossSkillUntypedPageReviewDecisionImport({ queueRecords = [], submissions = [], policy = {}, pageTypePolicy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const result = flight(queueRecords, submissions, policy, pageTypePolicy, queueSnapshotContentHash, contentHash);
  const records = result.atomicAcceptable ? result.expectedRecords : [];
  return { records, audit: auditCrossSkillUntypedPageReviewDecisionImport(records, { queueRecords, submissions, policy, pageTypePolicy, queueSnapshotContentHash, contentHash }) };
}

export function auditCrossSkillUntypedPageReviewDecisionImport(records = [], { queueRecords = [], submissions = [], policy = {}, pageTypePolicy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const result = flight(queueRecords, submissions, policy, pageTypePolicy, queueSnapshotContentHash, contentHash);
  const expectedKeys = result.expectedRecords.map(row => row.decisionKey);
  const recordKeys = records.map(row => row.decisionKey);
  const recordMismatches = records.filter(record => {
    const expected = result.expectedRecords.find(row => row.decisionKey === record.decisionKey);
    return !expected || !same(record, expected, contentHash);
  }).map(row => row.decisionKey || 'unknown');
  const recordHashFailures = records.filter(record => !validHash(record.recordContentHash) || contentHash(without(record, 'recordContentHash')) !== record.recordContentHash).map(row => row.decisionKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.reviewDecisionRecorded !== true || record.pageTypeDispositionApplied !== false ||
    record.pageTypeReview !== null || record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null ||
    record.repeatabilityClassification !== null || record.optimizerEligible !== false || record.accountIndependent !== true).map(row => row.decisionKey || 'unknown');
  const duplicateRecordKeys = duplicates(recordKeys);
  const missingRecordKeys = expectedKeys.filter(key => !recordKeys.includes(key));
  const unexpectedRecordKeys = recordKeys.filter(key => !expectedKeys.includes(key));
  const accountFindings = unique([...result.accountFindings, ...accountStateFindings([records])]);
  const blockers = [];
  if (!result.compiled.valid) blockers.push('untyped_page_review_decision_import_policy_invalid_or_specific');
  if (!validHash(queueSnapshotContentHash) || result.duplicateQueueKeys.length || result.queueIntegrityFailures.length) blockers.push('one_or_more_queue_records_failed_manifest_intrinsic_template_or_binding_revalidation');
  if (result.duplicateSubmissionKeys.length) blockers.push('duplicate_submission_queue_entry_keys');
  if (result.invalid.length) blockers.push('one_or_more_submission_rows_partial_stale_unknown_or_invalid');
  if (!result.completed.length) blockers.push('no_completed_review_decisions_submitted');
  if (recordMismatches.length || duplicateRecordKeys.length || missingRecordKeys.length || unexpectedRecordKeys.length || recordHashFailures.length) blockers.push('recorded_decision_set_does_not_exactly_match_completed_submissions');
  if (unsupportedPromotions.length) blockers.push('decision_import_created_unsupported_page_type_semantic_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = result.atomicAcceptable && records.length === result.expectedRecords.length && !recordMismatches.length &&
    !duplicateRecordKeys.length && !missingRecordKeys.length && !unexpectedRecordKeys.length && !recordHashFailures.length &&
    !unsupportedPromotions.length && !accountFindings.length;
  const decisionDistribution = Object.fromEntries((policy.allowedDecisions || []).map(decision => [decision, records.filter(row => row.decision === decision).length]));
  const reviewDecisionRecordingComplete = publishable && records.length === queueRecords.length && records.length > 0;
  return {
    contract: policy.auditContract || 'sensum.cross-skill-untyped-page-source-bound-review-decision-import-audit.v1',
    queueCoverage: {
      queueRecordCount: queueRecords.length,
      completeQueueRecordCount: queueRecords.length - result.queueIntegrityFailures.length,
      duplicateQueueKeys: result.duplicateQueueKeys,
      queueIntegrityFailures: result.queueIntegrityFailures,
      queueSnapshotContentHash
    },
    submissionCoverage: {
      submissionRowCount: submissions.length,
      completedSubmissionCount: result.completed.length,
      blankSubmissionCount: result.blanks.length,
      invalidSubmissionCount: result.invalid.length,
      duplicateSubmissionKeys: result.duplicateSubmissionKeys,
      completedQueueEntryKeys: result.completed.map(row => row.queueEntryKey),
      blankQueueEntryKeys: result.blanks.map(row => row.queueEntryKey),
      invalidQueueEntryKeys: result.invalid.map(row => row.queueEntryKey)
    },
    policyCoverage: result.compiled,
    bindingCoverage: {
      exactImmutableQueueBindingCount: result.completed.filter(row => Object.values(row.bindingChecks).every(Boolean)).length,
      boundEvidenceCitationCount: result.completed.reduce((sum, row) => sum + row.shape.evidenceKeys.length, 0),
      completedSubmissionAssessments: result.completed
    },
    recordCoverage: {
      recordedDecisionCount: records.length,
      expectedDecisionCount: result.expectedRecords.length,
      assignedPageTypeCount: records.reduce((sum, row) => sum + row.selectedPageTypes.length, 0),
      duplicateRecordKeys,
      missingRecordKeys,
      unexpectedRecordKeys,
      recordMismatches,
      recordHashFailures,
      decisionDistribution
    },
    semanticPreservationCoverage: {
      unsupportedPromotions,
      pageTypeDispositionAppliedCount: records.filter(row => row.pageTypeDispositionApplied === true).length,
      pageTypeReviewAppliedCount: records.filter(row => row.pageTypeReview !== null).length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length
    },
    accountStateFindings: accountFindings,
    reviewDecisionRecordingComplete,
    pageTypeReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      ...(!reviewDecisionRecordingComplete ? ['one_or_more_untyped_page_review_decisions_unrecorded'] : []),
      'review_decision_recording_does_not_apply_page_type_disposition',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}
