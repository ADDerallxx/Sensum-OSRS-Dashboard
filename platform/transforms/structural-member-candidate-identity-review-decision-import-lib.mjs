import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'oneRecordedDecisionPerCompletedSubmission',
  'partialReviewBatchesAreAllowed',
  'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected',
  'anyInvalidRowRejectsTheEntireBatch',
  'queueRecordManifestEntryAndContentHashesMustRevalidate',
  'submissionMustMatchQueuePacketAndEvidenceBindings',
  'decisionMustBeExplicitlyAllowed',
  'reviewerReviewedAtSourceRevisionsAndNotesAreRequired',
  'reviewedAtMustNotPrecedePinnedEvidenceTimestamps',
  'decisionSourceRevisionsMustExactlyMatchTheQueueEvidenceScope',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingADecisionDoesNotApplyAnIdentityMembershipRepeatabilityMechanicsMappingCompletenessOrOptimizerVerdict',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => !keys.includes(name)));
const same = (left, right) => hash(left) === hash(right);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

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
  return findings.sort();
}

export function compileStructuralMemberCandidateIdentityReviewDecisionImportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.queueContract === 'sensum.structural-member-candidate-identity-review-queue-entry.v1'
    && policy.submissionContract === 'sensum.structural-member-candidate-identity-review-decision-template.v1'
    && policy.recordContract === 'sensum.structural-member-candidate-identity-review-decision.v1'
    && policy.auditContract === 'sensum.structural-member-candidate-identity-review-decision-import-audit.v1'
    && policy.queueState === 'pending_explicit_source_bound_candidate_identity_review'
    && policy.recordState === 'recorded_source_bound_candidate_identity_review_decision_pending_semantic_disposition';
  const decisions = policy.allowedDecisions || [];
  const decisionsValid = decisions.length === 3
    && decisions[0] === 'confirm_source_page_subject_identity_for_candidate'
    && decisions[1] === 'reject_source_page_subject_identity_for_candidate'
    && decisions[2] === 'needs_additional_evidence';
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && decisionsValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    decisionsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function queueRecordIntegrity(record = {}, policy = {}, contentHash = hash) {
  const template = record.decisionTemplate || {};
  const base = without(record, 'entryContentHash', 'contentHash');
  const withEntryHash = without(record, 'contentHash');
  const checks = {
    contractMatches: record.contract === policy.queueContract,
    queueStateMatches: record.state === policy.queueState,
    accountIndependent: record.accountIndependent === true,
    ordinalValid: Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0,
    queueEntryKeyPresent: typeof record.queueEntryKey === 'string' && record.queueEntryKey.length > 0,
    reviewPacketKeyPresent: typeof record.reviewPacketKey === 'string' && record.reviewPacketKey.length > 0,
    evidenceFingerprintPresent: typeof record.evidenceFingerprint === 'string' && record.evidenceFingerprint.length === 64,
    packetContentHashPresent: typeof record.sourcePacketContentHash === 'string' && record.sourcePacketContentHash.length === 64,
    packetRecordContentHashPresent: typeof record.sourcePacketRecordContentHash === 'string' && record.sourcePacketRecordContentHash.length === 64,
    entryContentHashMatches: typeof record.entryContentHash === 'string' && contentHash(base) === record.entryContentHash,
    recordContentHashMatches: typeof record.contentHash === 'string' && contentHash(withEntryHash) === record.contentHash,
    sourceRevisionScopePresent: Array.isArray(record.reviewScope?.sourceRevisions) && record.reviewScope.sourceRevisions.length > 0,
    allowedDecisionsMatchPolicy: same(record.allowedDecisions || [], policy.allowedDecisions || []),
    blankTemplateContractMatches: template.contract === policy.submissionContract,
    blankTemplateQueueBindingMatches: template.queueEntryKey === record.queueEntryKey && template.reviewPacketKey === record.reviewPacketKey,
    blankTemplateEvidenceBindingMatches: template.sourcePacketContentHash === record.sourcePacketContentHash && template.evidenceFingerprint === record.evidenceFingerprint,
    blankTemplateAllowedDecisionsMatch: same(template.allowedDecisions || [], policy.allowedDecisions || []),
    blankTemplateFieldsBlank: template.decision === null && template.reviewer === null && template.reviewedAt === null && template.reviewNotes === null && Array.isArray(template.decisionSourceRevisions) && template.decisionSourceRevisions.length === 0,
    blankTemplateStateMatches: template.state === 'blank_source_bound_candidate_identity_review_decision'
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|codex|chatgpt|openai|sensum|ai|gpt(?:[- ]?\d.*)?)$/.test(value)
    || /\b(?:bot|automated reviewer|language model|ai reviewer)\b/.test(value);
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function submissionShape(submission = {}) {
  const sourceRevisions = Array.isArray(submission.decisionSourceRevisions) ? submission.decisionSourceRevisions : [];
  const allBlank = blank(submission.decision)
    && blank(submission.reviewer)
    && blank(submission.reviewedAt)
    && sourceRevisions.length === 0
    && blank(submission.reviewNotes);
  const anyReviewField = !blank(submission.decision)
    || !blank(submission.reviewer)
    || !blank(submission.reviewedAt)
    || sourceRevisions.length > 0
    || !blank(submission.reviewNotes);
  return { allBlank, anyReviewField };
}

function submissionAssessment(submission = {}, queueRecord, policy = {}) {
  const shape = submissionShape(submission);
  const bindingChecks = {
    contractMatches: submission.contract === policy.submissionContract,
    queueEntryMatches: queueRecord?.queueEntryKey === submission.queueEntryKey,
    reviewPacketMatches: queueRecord?.reviewPacketKey === submission.reviewPacketKey,
    packetContentHashMatches: queueRecord?.sourcePacketContentHash === submission.sourcePacketContentHash,
    evidenceFingerprintMatches: queueRecord?.evidenceFingerprint === submission.evidenceFingerprint,
    allowedDecisionsMatch: same(submission.allowedDecisions || [], policy.allowedDecisions || []),
    templateStateMatches: submission.state === 'blank_source_bound_candidate_identity_review_decision'
  };
  const evidenceTimestamps = [queueRecord?.subjectEvidence?.sourcePageIdentity?.sourceTimestamp, queueRecord?.parentOccurrenceEvidence?.sourcePageIdentity?.sourceTimestamp]
    .filter(value => validIsoTimestamp(value))
    .map(value => Date.parse(value));
  const contentChecks = shape.allBlank ? {} : {
    decisionAllowed: policy.allowedDecisions?.includes(submission.decision) === true,
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforeEvidence: validIsoTimestamp(submission.reviewedAt) && evidenceTimestamps.length === 2 && Date.parse(submission.reviewedAt) >= Math.max(...evidenceTimestamps),
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
  const base = {
    contract: policy.recordContract,
    decisionKey: `${queueRecord.queueEntryKey}|review-decision|${contentHash({ decision: submission.decision, reviewer: submission.reviewer.trim(), reviewedAt: submission.reviewedAt, decisionSourceRevisions: sorted(submission.decisionSourceRevisions), reviewNotes: submission.reviewNotes.trim() })}`,
    queueEntryKey: queueRecord.queueEntryKey,
    reviewPacketKey: queueRecord.reviewPacketKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queueRecord.contentHash,
    sourceQueueEntryContentHash: queueRecord.entryContentHash,
    sourcePacketContentHash: queueRecord.sourcePacketContentHash,
    evidenceFingerprint: queueRecord.evidenceFingerprint,
    structuralCandidateKey: queueRecord.structuralCandidateKey,
    candidateRole: queueRecord.candidateRole,
    decision: submission.decision,
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    decisionSourceRevisions: sorted(submission.decisionSourceRevisions),
    reviewNotes: submission.reviewNotes.trim(),
    reviewDecisionRecorded: true,
    semanticDispositionApplied: false,
    candidateMemberIdentityVerdict: null,
    canonicalGameEntityIdentity: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function preflight(queueRecords, submissions, policy, queueSnapshotContentHash, contentHash = hash) {
  const queueMap = new Map(queueRecords.map(record => [record.queueEntryKey, record]));
  const assessments = submissions.map((submission, index) => {
    const queueRecord = queueMap.get(submission.queueEntryKey);
    return { index, submission, queueRecord, assessment: submissionAssessment(submission, queueRecord, policy) };
  });
  const completed = assessments.filter(item => item.assessment.complete);
  const blanks = assessments.filter(item => item.assessment.blank);
  const invalid = assessments.filter(item => item.assessment.partialOrInvalid);
  const duplicateSubmissionKeys = duplicates(submissions.map(item => item.queueEntryKey));
  const queueKeys = queueRecords.map(item => item.queueEntryKey);
  const duplicateQueueKeys = duplicates(queueKeys);
  const queueIntegrityFailures = queueRecords.map(record => ({ queueEntryKey: record.queueEntryKey, integrity: queueRecordIntegrity(record, policy, contentHash) })).filter(item => !item.integrity.complete);
  const queueOrderValid = queueRecords.every((record, index) => record.queueOrdinal === index + 1);
  const queueSnapshotHashValid = typeof queueSnapshotContentHash === 'string' && queueSnapshotContentHash.length === 64;
  const structuralFailures = [];
  if (duplicateQueueKeys.length) structuralFailures.push('duplicate_queue_entry_keys');
  if (queueIntegrityFailures.length) structuralFailures.push('one_or_more_queue_records_failed_hash_or_blank_template_revalidation');
  if (!queueOrderValid) structuralFailures.push('queue_order_invalid');
  if (!queueSnapshotHashValid) structuralFailures.push('queue_snapshot_content_hash_missing_or_invalid');
  if (duplicateSubmissionKeys.length) structuralFailures.push('duplicate_submission_queue_entry_keys');
  if (invalid.length) structuralFailures.push('one_or_more_submission_rows_partial_stale_unknown_or_invalid');
  if (!completed.length) structuralFailures.push('no_completed_review_decisions_submitted');
  const atomicAcceptable = structuralFailures.length === 0;
  const expectedRecords = atomicAcceptable
    ? completed.map(item => decisionRecord(item.submission, item.queueRecord, queueSnapshotContentHash, policy, contentHash))
    : [];
  return {
    queueIntegrityFailures,
    queueOrderValid,
    queueSnapshotHashValid,
    duplicateQueueKeys,
    duplicateSubmissionKeys,
    assessments,
    completed,
    blanks,
    invalid,
    structuralFailures,
    atomicAcceptable,
    expectedRecords
  };
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

export function auditStructuralMemberCandidateIdentityReviewDecisionImport(records = [], { queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const compiled = compileStructuralMemberCandidateIdentityReviewDecisionImportPolicy(policy);
  const flight = preflight(queueRecords, submissions, policy, queueSnapshotContentHash, contentHash);
  const expected = compiled.valid ? flight.expectedRecords : [];
  const completedKeys = flight.completed.map(item => item.submission.queueEntryKey);
  const outputKeys = records.map(record => record.queueEntryKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = completedKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !completedKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !expected[index] || !same(record, expected[index])).map(record => record.decisionKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.semanticDispositionApplied !== false
    || record.candidateMemberIdentityVerdict !== null
    || record.canonicalGameEntityIdentity !== null
    || record.parentMembershipVerdict !== null
    || record.weightedTaskEntryMembershipVerdict !== null
    || record.mappingVerdict !== null
    || record.inventoryCompletenessVerdict !== null
    || record.memberUniverseComplete !== false
    || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false).map(record => record.decisionKey || 'unknown');
  const accountFindings = accountStateFindings([...submissions, ...records]);
  const structuralBlockers = [...flight.structuralFailures];
  if (!compiled.valid) structuralBlockers.push('review_decision_import_policy_invalid_or_candidate_specific');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('completed_submission_and_recorded_decision_sets_do_not_match_exactly');
  if (recordMismatches.length) structuralBlockers.push('one_or_more_recorded_decisions_do_not_match_submission_and_queue_bindings');
  if (unsupportedPromotions.length) structuralBlockers.push('decision_import_created_unsupported_semantic_or_optimizer_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = compiled.valid && flight.atomicAcceptable && structuralBlockers.length === 0;
  const distribution = Object.fromEntries((policy.allowedDecisions || []).map(decision => [decision, records.filter(record => record.decision === decision).length]));
  return {
    contract: policy.auditContract,
    queueCoverage: {
      queueEntryCount: queueRecords.length,
      completeQueueRecordCount: queueRecords.length - flight.queueIntegrityFailures.length,
      failedQueueRecordCount: flight.queueIntegrityFailures.length,
      failedQueueEntryKeys: flight.queueIntegrityFailures.map(item => item.queueEntryKey),
      duplicateQueueKeys: flight.duplicateQueueKeys,
      queueOrderValid: flight.queueOrderValid,
      queueSnapshotContentHash,
      queueSnapshotHashValid: flight.queueSnapshotHashValid
    },
    submissionCoverage: {
      submissionRowCount: submissions.length,
      completedSubmissionCount: flight.completed.length,
      blankSubmissionCount: flight.blanks.length,
      invalidSubmissionCount: flight.invalid.length,
      invalidSubmissionRows: flight.invalid.map(item => ({ index: item.index, queueEntryKey: item.submission.queueEntryKey || null, bindingChecks: item.assessment.bindingChecks, contentChecks: item.assessment.contentChecks })),
      duplicateSubmissionKeys: flight.duplicateSubmissionKeys
    },
    policyCoverage: compiled,
    bindingCoverage: {
      completedSubmissionCount: flight.completed.length,
      exactQueueBindingCount: flight.completed.filter(item => Object.values(item.assessment.bindingChecks).every(Boolean)).length,
      exactSourceRevisionSetCount: flight.completed.filter(item => item.assessment.contentChecks.sourceRevisionsExact).length,
      explicitReviewerCount: flight.completed.filter(item => item.assessment.contentChecks.reviewerPresent && item.assessment.contentChecks.reviewerNotObviouslyAutomatic).length,
      explicitReviewedAtCount: flight.completed.filter(item => item.assessment.contentChecks.reviewedAtValid).length,
      explicitReviewNotesCount: flight.completed.filter(item => item.assessment.contentChecks.reviewNotesPresent).length
    },
    recordCoverage: {
      recordedDecisionCount: records.length,
      duplicateOutputKeys,
      missingOutputKeys,
      unexpectedOutputKeys,
      recordMismatches,
      decisionDistribution: distribution
    },
    semanticPreservationCoverage: {
      semanticDispositionAppliedCount: records.filter(record => record.semanticDispositionApplied).length,
      identityVerdictCount: records.filter(record => record.candidateMemberIdentityVerdict !== null).length,
      membershipVerdictCount: records.filter(record => record.parentMembershipVerdict !== null || record.weightedTaskEntryMembershipVerdict !== null).length,
      mappingOrCompletenessVerdictCount: records.filter(record => record.mappingVerdict !== null || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    reviewDecisionRecordingComplete: publishable,
    identityReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'recorded_review_decisions_require_separate_semantic_disposition',
      'candidate_member_identity_review_not_completed',
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

export function buildStructuralMemberCandidateIdentityReviewDecisionImport({ queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const compiled = compileStructuralMemberCandidateIdentityReviewDecisionImportPolicy(policy);
  const flight = compiled.valid ? preflight(queueRecords, submissions, policy, queueSnapshotContentHash, contentHash) : { atomicAcceptable: false, expectedRecords: [] };
  const records = flight.atomicAcceptable ? flight.expectedRecords : [];
  return {
    records,
    audit: auditStructuralMemberCandidateIdentityReviewDecisionImport(records, { queueRecords, submissions, policy, queueSnapshotContentHash, contentHash })
  };
}
