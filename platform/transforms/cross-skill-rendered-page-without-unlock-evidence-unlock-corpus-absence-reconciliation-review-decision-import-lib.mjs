import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import { compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy } from './cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-lib.mjs';

const DECISIONS = [
  'confirm_corpus_absence_finding',
  'reject_corpus_absence_finding',
  'additional_level_requirement_source_reconciliation_required'
];
const ROUTES = {
  confirm_corpus_absence_finding: 'confirmed_corpus_absence_pending_separate_application',
  reject_corpus_absence_finding: 'rejected_corpus_absence_pending_corpus_reaudit',
  additional_level_requirement_source_reconciliation_required: 'additional_level_requirement_source_reconciliation_pending'
};
const REQUIRED_RULES = [
  'oneRecordedDecisionPerCompletedSubmission', 'partialReviewBatchesAreAllowed', 'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected', 'anyInvalidRowRejectsTheEntireBatch',
  'queueManifestPolicySnapshotOuterIntrinsicCrosswalkAndCorpusHashesMustRevalidate',
  'submissionMustMatchEveryImmutableBlankTemplateBinding', 'submissionFieldSetMustExactlyMatchTheBlankTemplate',
  'decisionMustBeExplicitlyAllowed', 'reviewerReviewedAtMeaningfulNotesAndBoundEvidenceKeysAreRequired',
  'reviewedAtMustNotPrecedeTheQueueSnapshotOrTargetSource',
  'everyDecisionMustCiteTheQueueRecordTargetCrosswalkAndCompleteCorpusEvidence',
  'rejectAndAdditionalReconciliationDecisionsMustCiteTheStablePageIdAndStatementRelationSets',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingADecisionDoesNotApplyCorpusAbsenceNoRequirementUnlockSemanticIdentityRepeatabilityMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsSkillsAliasesFragmentsNamespacesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|alias|aliases|fragment|fragments|namespace|namespaces|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|alias|fragment|namespace).*(?:override|exception)s?$/i;
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
  return sorted(unique(findings));
}

export function compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy(policy = {}, queuePolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-policy.v1' &&
    policy.queueContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-entry.v1' &&
    policy.submissionContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-decision-template.v1' &&
    policy.recordContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-audit.v1' &&
    policy.inputQueuePolicy === queuePolicy.policy && policy.inputQueuePolicyContentHash === contentHash(queuePolicy) &&
    policy.queueState === 'blocked_pending_human_unlock_corpus_absence_reconciliation' &&
    policy.recordState === 'recorded_unlock_corpus_absence_reconciliation_review_decision_pending_application';
  const queuePolicyCoverage = compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy(queuePolicy, contentHash);
  const decisionsValid = same(policy.allowedDecisions || [], DECISIONS, contentHash) && same(policy.allowedDecisions || [], queuePolicy.allowedReviewDispositions || [], contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractsValid && queuePolicyCoverage.valid && decisionsValid && !invalidRules.length && !forbidden.length, contractsValid, queuePolicyCoverage, decisionsValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === (value.includes('.') ? value : value.replace(/Z$/, '.000Z'));
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|ai)$/.test(value) || /\b(?:bot|automated reviewer|language model|ai reviewer|codex|chatgpt|openai|sensum|gpt(?:[- ]?\d[^ ]*)?)\b/.test(value);
}

export function expectedUnlockCorpusAbsenceBlankDecision(queue = {}, policy = {}) {
  return {
    contract: policy.submissionContract,
    absenceWorkEntryKey: queue.absenceWorkEntryKey,
    sourceWorkQueueEntryKey: queue.sourceWorkQueueEntryKey,
    renderedTargetKey: queue.renderedTargetKey,
    targetSourcePageId: queue.stableWikiPageIdentity?.sourcePageId,
    sourceWorkQueueRecordContentHash: queue.sourceWorkQueueRecordContentHash,
    sourceCrosswalkRecordContentHash: queue.sourceCrosswalkRecordContentHash,
    corpusEvidenceContentHash: queue.corpusEvidenceContentHash,
    disposition: null, reviewer: null, reviewedAt: null, evidenceKeys: [], notes: null
  };
}

function queueRecordIntegrity(record = {}, { policy = {}, queuePolicy = {}, queueSnapshotContentHash = '', queueManifestCorpusEvidenceContentHash = '', contentHash = hash } = {}) {
  const expectedTemplate = expectedUnlockCorpusAbsenceBlankDecision(record, policy);
  const checks = {
    contractMatches: record.contract === policy.queueContract,
    stateMatches: record.state === policy.queueState,
    outerHashMatches: validHash(record.contentHash) && record.contentHash === contentHash(without(record, 'contentHash')),
    intrinsicHashMatches: validHash(record.recordContentHash) && record.recordContentHash === contentHash(without(record, 'contentHash', 'recordContentHash')),
    stableKeyMatches: typeof record.absenceWorkEntryKey === 'string' && record.absenceWorkEntryKey === `${record.sourceWorkQueueEntryKey}|unlock-corpus-absence-reconciliation-work`,
    snapshotAndRecordHashesPresent: [queueSnapshotContentHash, record.sourceWorkQueueRecordContentHash, record.sourceWorkQueueIntrinsicRecordContentHash,
      record.sourceWorkQueueSnapshotContentHash, record.sourceCrosswalkRecordContentHash, record.sourceCrosswalkSnapshotContentHash,
      record.corpusEvidenceContentHash].every(validHash),
    manifestCorpusBindingMatches: validHash(queueManifestCorpusEvidenceContentHash) && record.corpusEvidenceContentHash === queueManifestCorpusEvidenceContentHash,
    targetIdentityComplete: Number.isInteger(record.stableWikiPageIdentity?.sourcePageId) && record.stableWikiPageIdentity.sourcePageId > 0 &&
      typeof record.stableWikiPageIdentity?.sourceRevision === 'string' && record.stableWikiPageIdentity.sourceRevision.length > 0 &&
      validIsoTimestamp(record.stableWikiPageIdentity?.sourceTimestamp) && typeof record.stableWikiPageIdentity?.sourceUrl === 'string' && record.stableWikiPageIdentity.sourceUrl.length > 0,
    exactZeroMatchPreserved: record.matchEvidence?.targetSourcePageId === record.stableWikiPageIdentity?.sourcePageId &&
      record.matchEvidence?.matchBasis === queuePolicy.matchBasis && record.matchEvidence?.exactStablePageIdMatchCount === 0 &&
      record.matchEvidence?.machineObservedZeroMatch === true && record.matchEvidence?.matchingCanonicalWikiPageKeys?.length === 0 &&
      record.matchEvidence?.titleAliasFragmentNamespaceOrSemanticMatchingUsed === false,
    corpusSummaryComplete: record.corpusEvidence?.definition === queuePolicy.corpusDefinition && record.corpusEvidence?.matchBasis === queuePolicy.matchBasis &&
      [record.corpusEvidence?.inventorySnapshotContentHash, record.corpusEvidence?.equivalenceSnapshotContentHash,
        record.corpusEvidence?.levelUpTableSourceSetContentHash, record.corpusEvidence?.statementTargetRelationSetContentHash,
        record.corpusEvidence?.stableWikiPageIdSetContentHash].every(validHash) &&
      Number.isInteger(record.corpusEvidence?.officialSkillCount) && record.corpusEvidence.officialSkillCount > 0 &&
      Number.isInteger(record.corpusEvidence?.capturedStatementCount) && record.corpusEvidence.capturedStatementCount > 0 &&
      Number.isInteger(record.corpusEvidence?.statementTargetRelationCount) && record.corpusEvidence.statementTargetRelationCount > 0 &&
      Number.isInteger(record.corpusEvidence?.stableWikiPageIdCount) && record.corpusEvidence.stableWikiPageIdCount > 0 &&
      record.matchEvidence?.corpusStableWikiPageIdCount === record.corpusEvidence.stableWikiPageIdCount,
    scopePreserved: record.findingScope?.machineFinding === queuePolicy.machineFinding && same(record.findingScope?.nonClaims || [], queuePolicy.nonClaims || [], contentHash),
    reviewFieldsBlank: record.reviewDecision === null && record.reviewer === null && record.reviewedAt === null && record.reviewNotes === null && Array.isArray(record.reviewEvidenceKeys) && record.reviewEvidenceKeys.length === 0,
    semanticGatesClosed: record.unlockEvidencePresent === false && record.semanticDisposition === null && record.canonicalGameEntityIdentity === null &&
      record.canonicalActivityIdentity === null && record.repeatabilityClassification === null && record.mechanicsReviewComplete === false &&
      record.optimizerEligible === false && record.automaticVerificationApplied === false,
    accountIndependent: record.accountIndependent === true,
    blankTemplateComplete: Object.values(without(expectedTemplate, 'disposition', 'reviewer', 'reviewedAt', 'evidenceKeys', 'notes')).every(value => value !== null && value !== undefined && value !== '')
  };
  return { complete: Object.values(checks).every(Boolean), checks, expectedTemplate };
}

function allowedEvidenceKeys(queue = {}, queueSnapshotContentHash = '') {
  return new Set([
    queueSnapshotContentHash, queue.contentHash, queue.recordContentHash,
    queue.sourceWorkQueueRecordContentHash, queue.sourceWorkQueueIntrinsicRecordContentHash,
    queue.sourceWorkQueueSnapshotContentHash, queue.sourceCrosswalkRecordContentHash,
    queue.sourceCrosswalkSnapshotContentHash, queue.corpusEvidenceContentHash,
    queue.corpusEvidence?.inventorySnapshotContentHash, queue.corpusEvidence?.equivalenceSnapshotContentHash,
    queue.corpusEvidence?.levelUpTableSourceSetContentHash, queue.corpusEvidence?.statementTargetRelationSetContentHash,
    queue.corpusEvidence?.stableWikiPageIdSetContentHash
  ].filter(validHash));
}

function submissionShape(submission = {}) {
  const evidenceKeys = Array.isArray(submission.evidenceKeys) ? submission.evidenceKeys : [];
  const allBlank = blank(submission.disposition) && blank(submission.reviewer) && blank(submission.reviewedAt) && blank(submission.notes) && evidenceKeys.length === 0;
  const anyReviewField = !blank(submission.disposition) || !blank(submission.reviewer) || !blank(submission.reviewedAt) || !blank(submission.notes) || evidenceKeys.length > 0;
  return { allBlank, anyReviewField, evidenceKeys };
}

function submissionAssessment(submission = {}, queue, context = {}) {
  const { policy = {}, queueSnapshotContentHash = '', queueSnapshotCreatedAt = '', contentHash = hash } = context;
  const shape = submissionShape(submission);
  const expected = queue ? expectedUnlockCorpusAbsenceBlankDecision(queue, policy) : {};
  const immutableExpected = without(expected, 'disposition', 'reviewer', 'reviewedAt', 'evidenceKeys', 'notes');
  const immutableActual = without(submission, 'disposition', 'reviewer', 'reviewedAt', 'evidenceKeys', 'notes');
  const allowedEvidence = queue ? allowedEvidenceKeys(queue, queueSnapshotContentHash) : new Set();
  const requiredCore = queue ? [queueSnapshotContentHash, queue.contentHash, queue.recordContentHash, queue.sourceWorkQueueRecordContentHash,
    queue.sourceCrosswalkRecordContentHash, queue.corpusEvidenceContentHash] : [];
  const requiredGranular = queue ? [queue.corpusEvidence?.stableWikiPageIdSetContentHash, queue.corpusEvidence?.statementTargetRelationSetContentHash] : [];
  const decisionNeedsGranular = submission.disposition === 'reject_corpus_absence_finding' || submission.disposition === 'additional_level_requirement_source_reconciliation_required';
  const latestRequiredTime = queue && validIsoTimestamp(queueSnapshotCreatedAt) && validIsoTimestamp(queue.stableWikiPageIdentity?.sourceTimestamp)
    ? Math.max(Date.parse(queueSnapshotCreatedAt), Date.parse(queue.stableWikiPageIdentity.sourceTimestamp)) : null;
  const checks = {
    queueKnown: Boolean(queue),
    fieldSetExact: same(sorted(Object.keys(submission)), sorted(Object.keys(expected)), contentHash),
    immutableBindingsExact: same(immutableActual, immutableExpected, contentHash),
    decisionAllowed: policy.allowedDecisions?.includes(submission.disposition),
    reviewerPresentAndHuman: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 2 && !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValidAndCurrent: validIsoTimestamp(submission.reviewedAt) && latestRequiredTime !== null && Date.parse(submission.reviewedAt) >= latestRequiredTime,
    notesMeaningful: typeof submission.notes === 'string' && submission.notes.trim().length >= 20,
    evidenceKeysNonEmptyUniqueAndBound: shape.evidenceKeys.length > 0 && duplicates(shape.evidenceKeys).length === 0 && shape.evidenceKeys.every(key => validHash(key) && allowedEvidence.has(key)),
    coreEvidenceComplete: requiredCore.every(key => shape.evidenceKeys.includes(key)),
    decisionSpecificEvidenceComplete: !decisionNeedsGranular || requiredGranular.every(key => shape.evidenceKeys.includes(key))
  };
  const bindingComplete = checks.queueKnown && checks.fieldSetExact && checks.immutableBindingsExact;
  const completed = !shape.allBlank && Object.values(checks).every(Boolean);
  const partial = shape.anyReviewField && !completed;
  const invalid = !bindingComplete || (shape.anyReviewField && !completed);
  return { shape, checks, bindingComplete, completed, partial, invalid };
}

function expectedDecisionRecord(queue, submission, policy, queueSnapshotContentHash, contentHash = hash) {
  const route = ROUTES[submission.disposition];
  const decisionFacts = {
    decision: submission.disposition,
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    reviewNotes: submission.notes.trim(),
    evidenceKeys: sorted(submission.evidenceKeys)
  };
  const base = {
    contract: policy.recordContract,
    decisionKey: `${queue.absenceWorkEntryKey}|unlock-corpus-absence-reconciliation-review-decision|${contentHash(decisionFacts)}`,
    absenceWorkEntryKey: queue.absenceWorkEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceQueueIntrinsicRecordContentHash: queue.recordContentHash,
    sourceWorkQueueEntryKey: queue.sourceWorkQueueEntryKey,
    sourceWorkQueueRecordContentHash: queue.sourceWorkQueueRecordContentHash,
    sourceCrosswalkRecordContentHash: queue.sourceCrosswalkRecordContentHash,
    renderedTargetKey: queue.renderedTargetKey,
    stableWikiPageIdentity: queue.stableWikiPageIdentity,
    blankTemplateContentHash: contentHash(expectedUnlockCorpusAbsenceBlankDecision(queue, policy)),
    corpusEvidenceContentHash: queue.corpusEvidenceContentHash,
    corpusEvidence: queue.corpusEvidence,
    matchEvidence: queue.matchEvidence,
    findingScope: queue.findingScope,
    decision: submission.disposition,
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    reviewNotes: submission.notes.trim(),
    evidenceKeys: sorted(submission.evidenceKeys),
    reviewDecisionRecorded: true,
    reviewOutcomeRoute: route,
    corpusAbsenceReconciliationApplied: false,
    levelUnlockCorpusAbsenceReconciliation: null,
    noRequirementClaimApplied: false,
    unlockEvidencePresent: false,
    semanticDisposition: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      `${route}`,
      'corpus_absence_reconciliation_application_not_performed',
      'absence_from_level_up_table_link_corpus_does_not_prove_no_requirement',
      'source_scoped_semantic_relevance_disposition_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ]),
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function closedDecisionRecord(record = {}) {
  return record.reviewDecisionRecorded === true && record.corpusAbsenceReconciliationApplied === false &&
    record.levelUnlockCorpusAbsenceReconciliation === null && record.noRequirementClaimApplied === false &&
    record.unlockEvidencePresent === false && record.semanticDisposition === null &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.mechanicsReviewComplete === false &&
    record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true;
}

export function buildUnlockCorpusAbsenceReconciliationReviewDecisionImport(input = {}) {
  const audit = auditUnlockCorpusAbsenceReconciliationReviewDecisionImport([], input, true);
  if (!audit._proposedRecords || !audit.publishable) return { records: [], audit: without(audit, '_proposedRecords') };
  const records = audit._proposedRecords;
  return { records, audit: without(auditUnlockCorpusAbsenceReconciliationReviewDecisionImport(records, input, false), '_proposedRecords') };
}

export function auditUnlockCorpusAbsenceReconciliationReviewDecisionImport(records = [], input = {}, derive = false) {
  const {
    queueRecords = [], submissions = [], policy = {}, queuePolicy = {}, queueSnapshotContentHash = '',
    queueSnapshotCreatedAt = '', queueManifestCorpusEvidenceContentHash = '', contentHash = hash
  } = input;
  const compiled = compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy(policy, queuePolicy, contentHash);
  const queueKeys = queueRecords.map(row => row.absenceWorkEntryKey);
  const duplicateQueueKeys = duplicates(queueKeys);
  const queueByKey = new Map(queueRecords.map(row => [row.absenceWorkEntryKey, row]));
  const queueAssessments = queueRecords.map(row => ({ key: row.absenceWorkEntryKey, ...queueRecordIntegrity(row, { policy, queuePolicy, queueSnapshotContentHash, queueManifestCorpusEvidenceContentHash, contentHash }) }));
  const invalidQueueKeys = queueAssessments.filter(row => !row.complete).map(row => row.key);
  const submissionKeys = submissions.map(row => row.absenceWorkEntryKey);
  const duplicateSubmissionKeys = duplicates(submissionKeys);
  const unknownSubmissionKeys = unique(submissionKeys.filter(key => !queueByKey.has(key)));
  const assessments = submissions.map((submission, index) => ({
    index, key: submission.absenceWorkEntryKey,
    assessment: submissionAssessment(submission, queueByKey.get(submission.absenceWorkEntryKey), { policy, queueSnapshotContentHash, queueSnapshotCreatedAt, contentHash }),
    submission
  }));
  const blankRows = assessments.filter(row => row.assessment.shape.allBlank && row.assessment.bindingComplete);
  const completedRows = assessments.filter(row => row.assessment.completed);
  const partialRows = assessments.filter(row => row.assessment.partial);
  const invalidSubmissionIndexes = unique([
    ...assessments.filter(row => row.assessment.invalid).map(row => row.index),
    ...assessments.filter(row => unknownSubmissionKeys.includes(row.key)).map(row => row.index),
    ...assessments.filter(row => duplicateSubmissionKeys.includes(row.key)).map(row => row.index)
  ]).sort((a, b) => a - b);
  const sourceValid = compiled.valid && validHash(queueSnapshotContentHash) && validIsoTimestamp(queueSnapshotCreatedAt) &&
    validHash(queueManifestCorpusEvidenceContentHash) && queueRecords.length > 0 && !duplicateQueueKeys.length && !invalidQueueKeys.length;
  const batchValid = sourceValid && completedRows.length > 0 && invalidSubmissionIndexes.length === 0;
  const proposed = batchValid ? completedRows.map(row => expectedDecisionRecord(queueByKey.get(row.key), row.submission, policy, queueSnapshotContentHash, contentHash)) : [];
  const expected = derive ? proposed : (batchValid ? completedRows.map(row => expectedDecisionRecord(queueByKey.get(row.key), row.submission, policy, queueSnapshotContentHash, contentHash)) : []);
  const expectedByKey = new Map(expected.map(row => [row.decisionKey, row]));
  const recordKeys = records.map(row => row.decisionKey);
  const expectedKeys = expected.map(row => row.decisionKey);
  const duplicateRecordKeys = duplicates(recordKeys);
  const missingRecordKeys = expectedKeys.filter(key => !recordKeys.includes(key));
  const unexpectedRecordKeys = recordKeys.filter(key => !expectedKeys.includes(key));
  const recordMismatchKeys = records.filter(row => !same(row, expectedByKey.get(row.decisionKey), contentHash) || !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'))).map(row => row.decisionKey);
  const unsupportedPromotions = records.filter(row => !closedDecisionRecord(row)).map(row => row.decisionKey);
  const accountStateFindings = findAccountState([...queueRecords, ...submissions, ...records]);
  const blockers = [];
  if (!compiled.valid) blockers.push('absence_review_decision_import_policy_invalid_or_specific');
  if (!validHash(queueSnapshotContentHash) || !validIsoTimestamp(queueSnapshotCreatedAt) || !validHash(queueManifestCorpusEvidenceContentHash)) blockers.push('queue_manifest_snapshot_or_corpus_binding_invalid');
  if (duplicateQueueKeys.length || invalidQueueKeys.length) blockers.push('one_or_more_queue_records_failed_exact_revalidation');
  if (!submissions.length) blockers.push('no_review_submissions_supplied');
  if (!completedRows.length) blockers.push('no_completed_human_review_decisions_supplied');
  if (invalidSubmissionIndexes.length) blockers.push('one_or_more_review_submissions_invalid');
  if (!derive && (duplicateRecordKeys.length || missingRecordKeys.length || unexpectedRecordKeys.length || recordMismatchKeys.length)) blockers.push('recorded_decision_set_does_not_match_completed_submission_set');
  if (unsupportedPromotions.length) blockers.push('decision_record_applied_unsupported_requirement_semantic_or_optimizer_state');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  const recordSetValid = derive || (!duplicateRecordKeys.length && !missingRecordKeys.length && !unexpectedRecordKeys.length && !recordMismatchKeys.length && !unsupportedPromotions.length);
  const structurallyPublishable = batchValid && recordSetValid && !accountStateFindings.length;
  const decisionDistribution = Object.fromEntries(DECISIONS.map(value => [value, records.filter(row => row.decision === value).length]));
  const audit = {
    contract: policy.auditContract,
    queueCoverage: {
      queueRecordCount: queueRecords.length, validQueueRecordCount: queueRecords.length - invalidQueueKeys.length,
      duplicateQueueKeys, invalidQueueKeys, queueSnapshotContentHashValid: validHash(queueSnapshotContentHash),
      queueSnapshotCreatedAtValid: validIsoTimestamp(queueSnapshotCreatedAt),
      queueManifestCorpusEvidenceContentHashValid: validHash(queueManifestCorpusEvidenceContentHash)
    },
    submissionCoverage: {
      submissionCount: submissions.length, completedSubmissionCount: completedRows.length,
      blankSubmissionCount: blankRows.length, partialSubmissionCount: partialRows.length,
      duplicateSubmissionKeys, unknownSubmissionKeys, invalidSubmissionIndexes
    },
    policyCoverage: {
      policyValid: compiled.valid, contractsValid: compiled.contractsValid,
      queuePolicyValid: compiled.queuePolicyCoverage.valid, decisionsValid: compiled.decisionsValid,
      invalidRules: compiled.invalidRules, forbiddenPolicyPaths: compiled.forbiddenPolicyPaths
    },
    bindingCoverage: {
      completedSubmissionKeys: completedRows.map(row => row.key),
      allCompletedSubmissionsMatchOneQueueEntry: completedRows.every(row => queueByKey.has(row.key)),
      immutableBindingFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank && (!row.assessment.checks.queueKnown || !row.assessment.checks.fieldSetExact || !row.assessment.checks.immutableBindingsExact)).map(row => row.index),
      coreEvidenceFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.coreEvidenceComplete).map(row => row.index),
      decisionSpecificEvidenceFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.decisionSpecificEvidenceComplete).map(row => row.index),
      unboundEvidenceFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.evidenceKeysNonEmptyUniqueAndBound).map(row => row.index),
      staleReviewTimestampIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.reviewedAtValidAndCurrent).map(row => row.index),
      automaticReviewerIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.reviewerPresentAndHuman).map(row => row.index)
    },
    recordCoverage: {
      recordedDecisionCount: records.length, decisionDistribution,
      duplicateRecordKeys, missingRecordKeys, unexpectedRecordKeys, recordMismatchKeys,
      orderMatchesCompletedSubmissions: same(records.map(row => row.absenceWorkEntryKey), completedRows.map(row => row.key), contentHash)
    },
    semanticPreservationCoverage: {
      corpusAbsenceApplications: records.filter(row => row.corpusAbsenceReconciliationApplied === true).length,
      noRequirementClaims: records.filter(row => row.noRequirementClaimApplied === true).length,
      unlockEvidenceApplications: records.filter(row => row.unlockEvidencePresent === true).length,
      semanticDispositionApplications: records.filter(row => row.semanticDisposition !== null).length,
      canonicalIdentityPromotions: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length,
      repeatabilityPromotions: records.filter(row => row.repeatabilityClassification !== null).length,
      mechanicsPromotions: records.filter(row => row.mechanicsReviewComplete === true).length,
      optimizerPromotions: records.filter(row => row.optimizerEligible === true).length,
      automaticVerifications: records.filter(row => row.automaticVerificationApplied === true).length,
      unsupportedPromotions
    },
    accountStateFindings,
    reviewDecisionRecordingComplete: structurallyPublishable && records.length === queueRecords.length,
    absenceReconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers,
      'corpus_absence_reconciliation_application_not_performed',
      'absence_from_level_up_table_link_corpus_does_not_prove_no_requirement',
      'source_scoped_semantic_relevance_disposition_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: structurallyPublishable
  };
  if (derive) audit._proposedRecords = proposed;
  return audit;
}
