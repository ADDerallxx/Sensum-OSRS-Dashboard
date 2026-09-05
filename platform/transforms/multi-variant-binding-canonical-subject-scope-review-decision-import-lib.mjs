import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'oneRecordedDecisionPerCompletedSubmission',
  'partialReviewBatchesAreAllowed',
  'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected',
  'anyInvalidRowRejectsTheEntireBatch',
  'queueManifestRecordAndTemplateHashesMustRevalidate',
  'submissionMustMatchEveryImmutableQueueDispositionPacketAndEvidenceBinding',
  'decisionMustBeExplicitlyAllowed',
  'reviewerReviewedAtSourceRevisionsAndNotesAreRequired',
  'reviewedAtMustNotPrecedeTheNewestBoundEvidenceTimestamp',
  'decisionSourceRevisionsMustExactlyMatchTheQueueEvidenceScope',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'reviewCandidateAndBoundVariantMustRemainNull',
  'canonicalSubjectConfirmationDoesNotBindANumberedVariant',
  'recordingADecisionDoesNotApplyCanonicalScopeIdentityMembershipRepeatabilityRequirementsXpTimingMechanicsMappingCompletenessOrOptimizerVerdicts',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DECISIONS = [
  'confirm_parent_occurrence_refers_to_canonical_subject_across_numbered_variants',
  'require_exact_numbered_variant_binding',
  'reject_parent_occurrence_subject_relation',
  'needs_additional_evidence'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => !keys.includes(name)));
const same = (left, right) => hash(left) === hash(right);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

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
  return unique(findings).sort();
}

export function compileMultiVariantBindingCanonicalSubjectScopeReviewDecisionImportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.queueContract === 'sensum.multi-variant-binding-canonical-subject-scope-review-queue-entry.v1'
    && policy.submissionContract === 'sensum.multi-variant-binding-canonical-subject-scope-review-decision-template.v1'
    && policy.recordContract === 'sensum.multi-variant-binding-canonical-subject-scope-review-decision.v1'
    && policy.auditContract === 'sensum.multi-variant-binding-canonical-subject-scope-review-decision-import-audit.v1'
    && policy.queueState === 'pending_explicit_source_bound_canonical_subject_scope_review'
    && policy.recordState === 'recorded_source_bound_canonical_subject_scope_review_decision_pending_semantic_disposition';
  const decisionsValid = same(policy.allowedDecisions || [], EXPECTED_DECISIONS);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && decisionsValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    decisionsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|codex|chatgpt|openai|sensum|ai|gpt(?:[- ]?\d.*)?)$/.test(value)
    || /\b(?:bot|automated reviewer|language model|ai reviewer)\b/.test(value);
}

function queueRecordIntegrity(record = {}, policy = {}, contentHash = hash) {
  const template = record.decisionTemplate || {};
  const templateBase = without(template, 'templateContentHash');
  const sourceRevisions = record.reviewScope?.sourceRevisions || [];
  const identityRevisions = unique((record.evidenceSourceIdentities || []).map(source => String(source.sourceRevision))).sort();
  const evidenceTimestamps = (record.evidenceSourceIdentities || []).map(source => source.sourceTimestamp);
  const base = without(record, 'recordContentHash', 'contentHash');
  const withRecordHash = without(record, 'contentHash');
  const immutableTemplateBindingsMatch = template.queueEntryKey === record.queueEntryKey
    && template.sourceDispositionKey === record.sourceDispositionKey
    && template.sourceDispositionRecordContentHash === record.sourceDispositionRecordContentHash
    && template.sourceDispositionSnapshotContentHash === record.sourceDispositionSnapshotContentHash
    && template.sourceEvidencePacketKey === record.sourceEvidencePacketKey
    && template.sourceEvidencePacketRecordContentHash === record.sourceEvidencePacketRecordContentHash
    && template.sourceEvidencePacketSnapshotContentHash === record.sourceEvidencePacketSnapshotContentHash
    && template.evidenceFingerprint === record.evidenceFingerprint;
  const checks = {
    contractMatches: record.contract === policy.queueContract,
    queueStateMatches: record.state === policy.queueState,
    ordinalValid: Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0,
    keysPresent: typeof record.queueEntryKey === 'string' && record.queueEntryKey.length > 0
      && typeof record.sourceDispositionKey === 'string' && record.sourceDispositionKey.length > 0
      && typeof record.sourceEvidencePacketKey === 'string' && record.sourceEvidencePacketKey.length > 0,
    hashBindingsPresent: [record.sourceDispositionRecordContentHash, record.sourceDispositionSnapshotContentHash,
      record.sourceEvidencePacketRecordContentHash, record.sourceEvidencePacketSnapshotContentHash,
      record.evidenceFingerprint].every(validHash),
    intrinsicRecordHashMatches: validHash(record.recordContentHash) && contentHash(base) === record.recordContentHash,
    snapshotRecordHashMatches: validHash(record.contentHash) && contentHash(withRecordHash) === record.contentHash,
    sourceIdentitiesComplete: (record.evidenceSourceIdentities || []).length > 0
      && (record.evidenceSourceIdentities || []).every(source => Number(source.sourcePageId) > 0 && validHash(source.sourceContentHash)
        && typeof source.sourceRevision === 'string' && validIsoTimestamp(source.sourceTimestamp) && typeof source.sourceUrl === 'string'),
    exactRevisionScopeMatches: sourceRevisions.length > 0 && same(sorted(sourceRevisions), identityRevisions)
      && unique(sourceRevisions.map(String)).length === sourceRevisions.length,
    exactAlignmentAbsent: Array.isArray(record.exactTaskToNumberedVariantAlignmentObservations)
      && record.exactTaskToNumberedVariantAlignmentObservations.length === 0
      && record.exactNumberedVariantAlignmentEvidenceState === 'not_observed',
    canonicalContextPresent: record.canonicalSubjectContextEvidenceState === 'observed_for_explicit_scope_review'
      && Array.isArray(record.candidateScopedParentContextObservations) && record.candidateScopedParentContextObservations.length > 0,
    allowedDecisionsMatch: same(record.allowedDecisions || [], policy.allowedDecisions || []),
    reviewAndVariantFieldsOpen: record.reviewDecision === null && record.reviewCandidateVariantIndex === null
      && record.bindingReviewDecision === null && record.boundVariantIndex === null,
    semanticGatesClosed: record.candidateMemberIdentityVerdict === null && record.parentMembershipVerdict === null
      && record.weightedTaskEntryMembershipVerdict === null && record.repeatabilityVerdict === null
      && record.mechanicsReviewComplete === false && record.mappingVerdict === null
      && record.inventoryCompletenessVerdict === null && record.memberUniverseComplete === false
      && record.optimizerEligible === false && record.automaticVerificationApplied === false,
    accountIndependent: record.accountIndependent === true,
    templateContractAndStateMatch: template.contract === policy.submissionContract
      && template.state === 'blank_source_bound_canonical_subject_scope_review_decision',
    templateHashMatches: validHash(template.templateContentHash) && contentHash(templateBase) === template.templateContentHash,
    templateBindingsMatch: immutableTemplateBindingsMatch,
    templateVariantFieldsNull: template.reviewCandidateVariantIndex === null && template.boundVariantIndex === null,
    templateAllowedDecisionsMatch: same(template.allowedDecisions || [], policy.allowedDecisions || []),
    templateFieldsBlank: template.decision === null && template.reviewer === null && template.reviewedAt === null
      && template.reviewNotes === null && Array.isArray(template.decisionSourceRevisions) && template.decisionSourceRevisions.length === 0,
    evidenceTimestampsComplete: evidenceTimestamps.length > 0 && evidenceTimestamps.every(validIsoTimestamp)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function submissionShape(submission = {}) {
  const sourceRevisions = Array.isArray(submission.decisionSourceRevisions) ? submission.decisionSourceRevisions : [];
  const allBlank = blank(submission.decision) && blank(submission.reviewer) && blank(submission.reviewedAt)
    && sourceRevisions.length === 0 && blank(submission.reviewNotes);
  const anyReviewField = !blank(submission.decision) || !blank(submission.reviewer) || !blank(submission.reviewedAt)
    || sourceRevisions.length > 0 || !blank(submission.reviewNotes);
  return { allBlank, anyReviewField };
}

function submissionAssessment(submission = {}, queueRecord, policy = {}) {
  const shape = submissionShape(submission);
  const queueTemplate = queueRecord?.decisionTemplate || {};
  const bindingChecks = {
    contractMatches: submission.contract === policy.submissionContract,
    templateStateMatches: submission.state === 'blank_source_bound_canonical_subject_scope_review_decision',
    queueEntryMatches: queueRecord?.queueEntryKey === submission.queueEntryKey,
    sourceDispositionKeyMatches: queueRecord?.sourceDispositionKey === submission.sourceDispositionKey,
    sourceDispositionRecordHashMatches: queueRecord?.sourceDispositionRecordContentHash === submission.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotHashMatches: queueRecord?.sourceDispositionSnapshotContentHash === submission.sourceDispositionSnapshotContentHash,
    sourceEvidencePacketKeyMatches: queueRecord?.sourceEvidencePacketKey === submission.sourceEvidencePacketKey,
    sourceEvidencePacketRecordHashMatches: queueRecord?.sourceEvidencePacketRecordContentHash === submission.sourceEvidencePacketRecordContentHash,
    sourceEvidencePacketSnapshotHashMatches: queueRecord?.sourceEvidencePacketSnapshotContentHash === submission.sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprintMatches: queueRecord?.evidenceFingerprint === submission.evidenceFingerprint,
    templateContentHashMatches: queueTemplate.templateContentHash === submission.templateContentHash,
    reviewCandidateVariantIndexNull: submission.reviewCandidateVariantIndex === null && queueRecord?.reviewCandidateVariantIndex === null,
    boundVariantIndexNull: submission.boundVariantIndex === null && queueRecord?.boundVariantIndex === null,
    allowedDecisionsMatch: same(submission.allowedDecisions || [], policy.allowedDecisions || [])
  };
  const evidenceTimes = (queueRecord?.evidenceSourceIdentities || []).map(source => source.sourceTimestamp)
    .filter(validIsoTimestamp).map(value => Date.parse(value));
  const contentChecks = shape.allBlank ? {} : {
    decisionAllowed: policy.allowedDecisions?.includes(submission.decision) === true,
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforeNewestEvidence: validIsoTimestamp(submission.reviewedAt) && evidenceTimes.length === (queueRecord?.evidenceSourceIdentities || []).length
      && evidenceTimes.length > 0 && Date.parse(submission.reviewedAt) >= Math.max(...evidenceTimes),
    sourceRevisionsExact: same(sorted(submission.decisionSourceRevisions || []), sorted(queueRecord?.reviewScope?.sourceRevisions || []))
      && unique((submission.decisionSourceRevisions || []).map(String)).length === (submission.decisionSourceRevisions || []).length,
    reviewNotesPresent: typeof submission.reviewNotes === 'string' && submission.reviewNotes.trim().length > 0
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

function decisionRecord(submission, queueRecord, queueSnapshotContentHash, policy, contentHash = hash) {
  const decisionFacts = {
    decision: submission.decision,
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    decisionSourceRevisions: sorted(submission.decisionSourceRevisions),
    reviewNotes: submission.reviewNotes.trim()
  };
  const base = {
    contract: policy.recordContract,
    decisionKey: `${queueRecord.queueEntryKey}|canonical-subject-scope-review-decision|${contentHash(decisionFacts)}`,
    queueEntryKey: queueRecord.queueEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queueRecord.contentHash,
    sourceQueueEntryContentHash: queueRecord.recordContentHash,
    sourceDispositionKey: queueRecord.sourceDispositionKey,
    sourceDispositionRecordContentHash: queueRecord.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: queueRecord.sourceDispositionSnapshotContentHash,
    sourceEvidencePacketKey: queueRecord.sourceEvidencePacketKey,
    sourceEvidencePacketRecordContentHash: queueRecord.sourceEvidencePacketRecordContentHash,
    sourceEvidencePacketSnapshotContentHash: queueRecord.sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprint: queueRecord.evidenceFingerprint,
    structuralCandidateKey: queueRecord.structuralCandidateKey,
    candidateRole: queueRecord.candidateRole,
    candidateDisplayName: queueRecord.candidateDisplayName,
    ...decisionFacts,
    reviewDecisionRecorded: true,
    semanticDispositionApplied: false,
    canonicalSubjectScopeReviewDecision: null,
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
    blockers: [
      'recorded_review_requires_separate_canonical_subject_scope_semantic_disposition',
      'exact_numbered_variant_binding_not_proven',
      'candidate_identity_membership_repeatability_mechanics_mapping_completeness_and_optimizer_gates_remain_closed'
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

function preflight(queueRecords, submissions, policy, queueSnapshotContentHash, contentHash = hash) {
  const compiled = compileMultiVariantBindingCanonicalSubjectScopeReviewDecisionImportPolicy(policy);
  const queueMap = new Map(queueRecords.map(record => [record.queueEntryKey, record]));
  const queueAssessments = queueRecords.map(record => ({ queueEntryKey: record.queueEntryKey, integrity: queueRecordIntegrity(record, policy, contentHash) }));
  const submissionAssessments = submissions.map((submission, index) => {
    const queueRecord = queueMap.get(submission.queueEntryKey);
    return { index, submission, queueRecord, assessment: submissionAssessment(submission, queueRecord, policy) };
  });
  const completed = submissionAssessments.filter(item => item.assessment.complete);
  const blanks = submissionAssessments.filter(item => item.assessment.blank);
  const invalid = submissionAssessments.filter(item => item.assessment.partialOrInvalid);
  const duplicateQueueKeys = duplicates(queueRecords.map(record => record.queueEntryKey));
  const duplicateSubmissionKeys = duplicates(submissions.map(submission => submission.queueEntryKey));
  const queueOrderValid = queueRecords.every((record, index) => record.queueOrdinal === index + 1);
  const queueSnapshotHashValid = validHash(queueSnapshotContentHash);
  const failures = [];
  if (!compiled.valid) failures.push('canonical_subject_scope_review_decision_import_policy_invalid_or_candidate_specific');
  if (!queueRecords.length) failures.push('no_canonical_subject_scope_review_queue_records');
  if (duplicateQueueKeys.length) failures.push('duplicate_queue_entry_keys');
  if (queueAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_queue_records_failed_manifest_record_template_or_binding_revalidation');
  if (!queueOrderValid) failures.push('queue_order_invalid');
  if (!queueSnapshotHashValid) failures.push('queue_snapshot_content_hash_missing_or_invalid');
  if (duplicateSubmissionKeys.length) failures.push('duplicate_submission_queue_entry_keys');
  if (invalid.length) failures.push('one_or_more_submission_rows_partial_stale_unknown_or_invalid');
  if (accountStateFindings([...queueRecords, ...submissions]).length) failures.push('current_account_state_present');
  if (!completed.length) failures.push('no_completed_review_decisions_submitted');
  const atomicAcceptable = failures.length === 0;
  return {
    compiled, queueAssessments, submissionAssessments, completed, blanks, invalid,
    duplicateQueueKeys, duplicateSubmissionKeys, queueOrderValid, queueSnapshotHashValid,
    failures, atomicAcceptable,
    expectedRecords: atomicAcceptable ? completed.map(item => decisionRecord(item.submission, item.queueRecord, queueSnapshotContentHash, policy, contentHash)) : []
  };
}

export function auditMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport(records = [], {
  queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash
} = {}) {
  const flight = preflight(queueRecords, submissions, policy, queueSnapshotContentHash, contentHash);
  const expectedKeys = flight.expectedRecords.map(record => record.queueEntryKey);
  const outputKeys = records.map(record => record.queueEntryKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = expectedKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !expectedKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !flight.expectedRecords[index] || !same(record, flight.expectedRecords[index])).map(record => record.decisionKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.semanticDispositionApplied !== false
    || record.canonicalSubjectScopeReviewDecision !== null || record.reviewCandidateVariantIndex !== null
    || record.bindingReviewDecision !== null || record.boundVariantIndex !== null
    || record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null
    || record.weightedTaskEntryMembershipVerdict !== null || record.repeatabilityVerdict !== null
    || record.mechanicsReviewComplete !== false || record.mappingVerdict !== null
    || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).map(record => record.decisionKey || 'unknown');
  const accountFindings = accountStateFindings([...queueRecords, ...submissions, ...records]);
  const failures = [...flight.failures];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length || records.length !== flight.expectedRecords.length) failures.push('completed_submission_and_recorded_decision_sets_do_not_match_exactly');
  if (recordMismatches.length) failures.push('one_or_more_recorded_decisions_do_not_match_source_bound_submission');
  if (unsupportedPromotions.length) failures.push('decision_import_created_unsupported_canonical_scope_variant_semantic_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const publishable = failures.length === 0;
  return {
    contract: policy.auditContract,
    queueCoverage: {
      queueEntryCount: queueRecords.length,
      completeQueueRecordCount: flight.queueAssessments.filter(item => item.integrity.complete).length,
      failedQueueEntryKeys: flight.queueAssessments.filter(item => !item.integrity.complete).map(item => item.queueEntryKey),
      duplicateQueueKeys: flight.duplicateQueueKeys,
      queueOrderValid: flight.queueOrderValid,
      queueSnapshotHashValid: flight.queueSnapshotHashValid,
      queueSnapshotContentHash
    },
    submissionCoverage: {
      submissionRowCount: submissions.length,
      completedSubmissionCount: flight.completed.length,
      blankSubmissionCount: flight.blanks.length,
      invalidSubmissionCount: flight.invalid.length,
      duplicateSubmissionKeys: flight.duplicateSubmissionKeys,
      completedQueueEntryKeys: flight.completed.map(item => item.submission.queueEntryKey),
      blankQueueEntryKeys: flight.blanks.map(item => item.submission.queueEntryKey),
      invalidQueueEntryKeys: flight.invalid.map(item => item.submission.queueEntryKey)
    },
    policyCoverage: flight.compiled,
    bindingCoverage: {
      exactImmutableQueueBindingCount: flight.completed.filter(item => Object.values(item.assessment.bindingChecks).every(Boolean)).length,
      exactDecisionSourceRevisionScopeCount: flight.completed.filter(item => item.assessment.contentChecks.sourceRevisionsExact).length,
      explicitHumanReviewerCount: flight.completed.filter(item => item.assessment.contentChecks.reviewerPresent && item.assessment.contentChecks.reviewerNotObviouslyAutomatic).length,
      validReviewTimestampCount: flight.completed.filter(item => item.assessment.contentChecks.reviewedAtValid && item.assessment.contentChecks.reviewedAtNotBeforeNewestEvidence).length,
      explicitReviewNotesCount: flight.completed.filter(item => item.assessment.contentChecks.reviewNotesPresent).length,
      nonNullReviewCandidateVariantIndexCount: flight.completed.filter(item => item.submission.reviewCandidateVariantIndex !== null).length,
      nonNullBoundVariantIndexCount: flight.completed.filter(item => item.submission.boundVariantIndex !== null).length
    },
    recordCoverage: {
      recordedDecisionCount: records.length,
      duplicateOutputKeys,
      missingOutputKeys,
      unexpectedOutputKeys,
      recordMismatches,
      decisionDistribution: Object.fromEntries((policy.allowedDecisions || []).map(decision => [decision, records.filter(record => record.decision === decision).length]))
    },
    semanticPreservationCoverage: {
      semanticDispositionAppliedCount: records.filter(record => record.semanticDispositionApplied).length,
      canonicalSubjectScopeDecisionAppliedCount: records.filter(record => record.canonicalSubjectScopeReviewDecision !== null).length,
      numberedVariantSelectionOrBindingCount: records.filter(record => record.reviewCandidateVariantIndex !== null || record.bindingReviewDecision !== null || record.boundVariantIndex !== null).length,
      identityOrMembershipVerdictCount: records.filter(record => record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null || record.weightedTaskEntryMembershipVerdict !== null).length,
      repeatabilityOrMechanicsVerdictCount: records.filter(record => record.repeatabilityVerdict !== null || record.mechanicsReviewComplete).length,
      mappingOrCompletenessVerdictCount: records.filter(record => record.mappingVerdict !== null || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    reviewDecisionRecordingComplete: publishable,
    canonicalSubjectScopeReviewComplete: false,
    variantBindingReviewComplete: false,
    optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(flight.blanks.length || flight.completed.length < queueRecords.length ? ['one_or_more_canonical_subject_scope_review_decisions_unrecorded'] : []),
      'recorded_reviews_require_separate_canonical_subject_scope_semantic_disposition',
      'exact_numbered_variant_bindings_not_proven',
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

export function buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({
  queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash
} = {}) {
  const flight = preflight(queueRecords, submissions, policy, queueSnapshotContentHash, contentHash);
  const records = flight.atomicAcceptable ? flight.expectedRecords : [];
  return { records, audit: auditMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport(records, { queueRecords, submissions, policy, queueSnapshotContentHash, contentHash }) };
}
