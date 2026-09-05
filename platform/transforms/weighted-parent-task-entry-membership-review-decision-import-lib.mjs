import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'oneRecordedDecisionPerCompletedSubmission',
  'partialReviewBatchesAreAllowed',
  'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected',
  'anyInvalidRowRejectsTheEntireBatch',
  'queueManifestRecordTemplateAndEvidenceHashesMustRevalidate',
  'submissionMustMatchEveryImmutableQueueDispositionPacketAndEvidenceBinding',
  'submissionFieldSetMustExactlyMatchTheBlankTemplate',
  'decisionMustBeExplicitlyAllowed',
  'reviewerReviewedAtSourceRevisionsAndNotesAreRequired',
  'reviewedAtMustNotPrecedeTheNewestBoundEvidenceTimestamp',
  'decisionSourceRevisionsMustExactlyMatchTheQueueEvidenceScope',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingADecisionDoesNotApplyMembershipIdentityMappingCompletenessRepeatabilityRequirementsXpTimingMechanicsOrOptimizerVerdicts',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_REVIEW_ROUTES = ['candidate_scoped_weight_review_ready', 'candidate_subject_corroboration_review_ready'];
const EXPECTED_DECISIONS = [
  'confirm_source_supports_candidate_membership',
  'reject_source_supports_candidate_membership',
  'needs_additional_evidence'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
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

export function compileWeightedParentTaskEntryMembershipReviewDecisionImportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.queueContract === 'sensum.weighted-parent-task-entry-membership-review-queue-entry.v1'
    && policy.submissionContract === 'sensum.weighted-parent-task-entry-membership-review-decision-template.v1'
    && policy.recordContract === 'sensum.weighted-parent-task-entry-membership-review-decision.v1'
    && policy.auditContract === 'sensum.weighted-parent-task-entry-membership-review-decision-import-audit.v1'
    && policy.queueState === 'pending_explicit_source_bound_weighted_membership_review'
    && policy.recordState === 'recorded_source_bound_weighted_membership_review_decision_pending_semantic_disposition';
  const reviewRoutesValid = same(sorted(policy.allowedReviewRoutes || []), sorted(EXPECTED_REVIEW_ROUTES));
  const decisionsValid = same(policy.allowedDecisions || [], EXPECTED_DECISIONS);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && reviewRoutesValid && decisionsValid && !invalidRules.length && !forbidden.length,
    contractValid,
    reviewRoutesValid,
    decisionsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const normalizedInput = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return new Date(parsed).toISOString() === normalizedInput;
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|ai)$/.test(value)
    || /\b(?:bot|automated reviewer|language model|ai reviewer|codex|chatgpt|openai|sensum|gpt(?:[- ]?\d[^ ]*)?)\b/.test(value);
}

function sourceIdentityComplete(source = {}) {
  return typeof source.sourceKey === 'string' && source.sourceKey.length > 0 && Array.isArray(source.roles) && source.roles.length > 0
    && Number(source.sourcePageId) > 0 && typeof source.resolvedTitle === 'string' && source.resolvedTitle.length > 0
    && typeof source.sourceRevision === 'string' && source.sourceRevision.length > 0
    && validIsoTimestamp(source.sourceTimestamp) && typeof source.sourceUrl === 'string' && source.sourceUrl.length > 0
    && validHash(source.sourceContentHash) && Number.isInteger(source.sourceContentBytes) && source.sourceContentBytes > 0;
}

function queueRecordIntegrity(record = {}, policy = {}, contentHash = hash) {
  const template = record.decisionTemplate || {};
  const templateBase = without(template, 'templateContentHash');
  const identities = record.evidenceSourceIdentities || [];
  const revisions = unique(identities.map(source => String(source.sourceRevision))).sort();
  const reviewRoute = record.reviewEvidence?.route;
  const candidateWeights = record.reviewEvidence?.candidateScopedWeightStatements || [];
  const corroborations = record.reviewEvidence?.candidateSubjectCorroborations || [];
  const immutableTemplateBindingsMatch = template.queueEntryKey === record.queueEntryKey
    && template.sourceDispositionRecordContentHash === record.sourceDispositionRecordContentHash
    && template.sourceEvidenceRecordContentHash === record.sourceEvidenceRecordContentHash
    && template.sourceDispositionKey === record.sourceDispositionKey
    && template.sourceEvidencePacketKey === record.sourceEvidencePacketKey
    && template.sourceEvidencePacketContentHash === record.sourceEvidencePacketContentHash
    && template.evidenceFingerprint === record.evidenceFingerprint
    && template.structuralCandidateKey === record.structuralCandidateKey
    && template.candidateRole === record.candidateRole
    && template.evidenceSourceIdentityFingerprint === contentHash(identities);
  const checks = {
    contractMatches: record.contract === policy.queueContract,
    stateMatches: record.state === policy.queueState,
    ordinalValid: Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0,
    keysPresent: typeof record.queueEntryKey === 'string' && record.queueEntryKey.length > 0
      && typeof record.sourceDispositionKey === 'string' && record.sourceDispositionKey.length > 0
      && typeof record.sourceEvidencePacketKey === 'string' && record.sourceEvidencePacketKey.length > 0,
    hashesPresent: [record.sourceDispositionRecordContentHash, record.sourceEvidenceRecordContentHash,
      record.sourceEvidencePacketContentHash, record.evidenceFingerprint].every(validHash),
    snapshotRecordHashMatches: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    evidenceSourceIdentitiesComplete: identities.length > 0 && identities.every(sourceIdentityComplete),
    sourceRevisionScopeExact: (record.sourceRevisions || []).length > 0
      && same(sorted(record.sourceRevisions || []), revisions, contentHash)
      && unique((record.sourceRevisions || []).map(String)).length === (record.sourceRevisions || []).length,
    reviewRouteAllowed: policy.allowedReviewRoutes?.includes(reviewRoute) === true,
    routeEvidenceCoherent: reviewRoute === 'candidate_scoped_weight_review_ready'
      ? candidateWeights.length > 0
      : reviewRoute === 'candidate_subject_corroboration_review_ready' && corroborations.length > 0,
    parentOccurrenceIntegrityComplete: record.reviewEvidence?.parentOccurrence?.integrity?.complete === true,
    parentContextExplicitlyNonCandidate: record.reviewEvidence?.nonCandidateParentContext?.candidateMembershipProof === false,
    allowedDecisionsMatch: same(record.allowedDecisions || [], policy.allowedDecisions || [], contentHash),
    reviewFieldsOpen: record.weightedTaskEntryMembershipVerdict === null,
    downstreamGatesClosed: record.memberUniverseComplete === false && record.optimizerEligible === false
      && record.automaticVerificationApplied === false && record.accountIndependent === true,
    templateContractAndStateMatch: template.contract === policy.submissionContract
      && template.state === 'blank_source_bound_weighted_membership_review_decision',
    templateHashMatches: validHash(template.templateContentHash) && contentHash(templateBase) === template.templateContentHash,
    templateBindingsMatch: immutableTemplateBindingsMatch,
    templateAllowedDecisionsMatch: same(template.allowedDecisions || [], policy.allowedDecisions || [], contentHash),
    templateFieldsBlank: template.decision === null && template.reviewer === null && template.reviewedAt === null
      && template.reviewNotes === null && Array.isArray(template.decisionSourceRevisions) && template.decisionSourceRevisions.length === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function submissionShape(submission = {}) {
  const revisions = Array.isArray(submission.decisionSourceRevisions) ? submission.decisionSourceRevisions : [];
  const allBlank = blank(submission.decision) && blank(submission.reviewer) && blank(submission.reviewedAt)
    && revisions.length === 0 && blank(submission.reviewNotes);
  const anyReviewField = !blank(submission.decision) || !blank(submission.reviewer) || !blank(submission.reviewedAt)
    || revisions.length > 0 || !blank(submission.reviewNotes);
  return { allBlank, anyReviewField };
}

function submissionAssessment(submission = {}, queueRecord, policy = {}, contentHash = hash) {
  const shape = submissionShape(submission);
  const queueTemplate = queueRecord?.decisionTemplate || {};
  const identities = queueRecord?.evidenceSourceIdentities || [];
  const bindingChecks = {
    fieldSetExact: same(sorted(Object.keys(submission)), sorted(Object.keys(queueTemplate)), contentHash),
    contractMatches: submission.contract === policy.submissionContract,
    templateStateMatches: submission.state === 'blank_source_bound_weighted_membership_review_decision',
    queueEntryMatches: queueRecord?.queueEntryKey === submission.queueEntryKey,
    sourceDispositionRecordHashMatches: queueRecord?.sourceDispositionRecordContentHash === submission.sourceDispositionRecordContentHash,
    sourceEvidenceRecordHashMatches: queueRecord?.sourceEvidenceRecordContentHash === submission.sourceEvidenceRecordContentHash,
    sourceDispositionKeyMatches: queueRecord?.sourceDispositionKey === submission.sourceDispositionKey,
    sourceEvidencePacketKeyMatches: queueRecord?.sourceEvidencePacketKey === submission.sourceEvidencePacketKey,
    sourceEvidencePacketHashMatches: queueRecord?.sourceEvidencePacketContentHash === submission.sourceEvidencePacketContentHash,
    evidenceFingerprintMatches: queueRecord?.evidenceFingerprint === submission.evidenceFingerprint,
    structuralCandidateKeyMatches: queueRecord?.structuralCandidateKey === submission.structuralCandidateKey,
    candidateRoleMatches: queueRecord?.candidateRole === submission.candidateRole,
    evidenceSourceIdentityFingerprintMatches: submission.evidenceSourceIdentityFingerprint === contentHash(identities),
    templateContentHashMatches: submission.templateContentHash === queueTemplate.templateContentHash,
    allowedDecisionsMatch: same(submission.allowedDecisions || [], policy.allowedDecisions || [], contentHash)
  };
  const evidenceTimes = identities.map(source => source.sourceTimestamp).filter(validIsoTimestamp).map(value => Date.parse(value));
  const contentChecks = shape.allBlank ? {} : {
    decisionAllowed: policy.allowedDecisions?.includes(submission.decision) === true,
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforeNewestEvidence: validIsoTimestamp(submission.reviewedAt)
      && evidenceTimes.length === identities.length && evidenceTimes.length > 0
      && Date.parse(submission.reviewedAt) >= Math.max(...evidenceTimes),
    sourceRevisionsExact: same(sorted(submission.decisionSourceRevisions || []), sorted(queueRecord?.sourceRevisions || []), contentHash)
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
    decisionKey: `${queueRecord.queueEntryKey}|weighted-membership-review-decision|${contentHash(decisionFacts)}`,
    queueEntryKey: queueRecord.queueEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queueRecord.contentHash,
    sourceDispositionRecordContentHash: queueRecord.sourceDispositionRecordContentHash,
    sourceEvidenceRecordContentHash: queueRecord.sourceEvidenceRecordContentHash,
    sourceDispositionKey: queueRecord.sourceDispositionKey,
    sourceEvidencePacketKey: queueRecord.sourceEvidencePacketKey,
    sourceEvidencePacketContentHash: queueRecord.sourceEvidencePacketContentHash,
    evidenceFingerprint: queueRecord.evidenceFingerprint,
    structuralCandidateKey: queueRecord.structuralCandidateKey,
    candidateRole: queueRecord.candidateRole,
    candidateDisplay: queueRecord.candidateDisplay,
    ...decisionFacts,
    reviewDecisionRecorded: true,
    semanticDispositionApplied: false,
    weightedMembershipReviewDecision: null,
    weightedTaskEntryMembershipVerdict: null,
    candidateMemberIdentityVerdict: null,
    repeatabilityVerdict: null,
    mechanicsReviewComplete: false,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: [
      'review_decision_recorded_semantic_disposition_not_applied',
      'weighted_parent_task_entry_membership_not_proven',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'all_repeatability_evidence_domains_remain_unresolved',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ],
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function accountStateFindings(values = []) {
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i;
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

function flight(queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash) {
  const compiled = compileWeightedParentTaskEntryMembershipReviewDecisionImportPolicy(policy);
  const queueAssessments = queueRecords.map(record => ({ queueEntryKey: record.queueEntryKey, ...queueRecordIntegrity(record, policy, contentHash) }));
  const queueKeys = queueRecords.map(record => record.queueEntryKey);
  const submissionKeys = submissions.map(record => record.queueEntryKey);
  const queueByKey = new Map(queueRecords.map(record => [record.queueEntryKey, record]));
  const submissionAssessments = submissions.map((submission, index) => ({
    index,
    queueEntryKey: submission.queueEntryKey,
    ...submissionAssessment(submission, queueByKey.get(submission.queueEntryKey), policy, contentHash)
  }));
  const completed = submissionAssessments.filter(item => item.complete);
  const blanks = submissionAssessments.filter(item => item.blank);
  const invalid = submissionAssessments.filter(item => item.partialOrInvalid);
  const expectedRecords = completed.map(item => decisionRecord(submissions[item.index], queueByKey.get(item.queueEntryKey), queueSnapshotContentHash, policy, contentHash));
  const accountFindings = accountStateFindings([queueRecords, submissions]);
  const duplicateQueueKeys = duplicates(queueKeys);
  const duplicateSubmissionKeys = duplicates(submissionKeys);
  const queueIntegrityFailures = queueAssessments.filter(item => !item.complete).map(item => item.queueEntryKey);
  const atomicAcceptable = compiled.valid && validHash(queueSnapshotContentHash) && queueRecords.length > 0
    && !duplicateQueueKeys.length && !duplicateSubmissionKeys.length && !queueIntegrityFailures.length
    && !invalid.length && completed.length > 0 && !accountFindings.length;
  return { compiled, queueAssessments, submissionAssessments, expectedRecords, accountFindings, duplicateQueueKeys, duplicateSubmissionKeys, queueIntegrityFailures, completed, blanks, invalid, atomicAcceptable };
}

export function auditWeightedParentTaskEntryMembershipReviewDecisionImport(records = [], {
  queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash
} = {}) {
  const result = flight(queueRecords, submissions, policy, queueSnapshotContentHash, contentHash);
  const recordMismatches = records.filter(record => {
    const expected = result.expectedRecords.find(item => item.decisionKey === record.decisionKey);
    return !expected || !same(record, expected, contentHash);
  }).map(item => item.decisionKey || 'unknown');
  const expectedKeys = result.expectedRecords.map(item => item.decisionKey);
  const recordKeys = records.map(item => item.decisionKey);
  const duplicateRecordKeys = duplicates(recordKeys);
  const missingRecordKeys = expectedKeys.filter(key => !recordKeys.includes(key));
  const unexpectedRecordKeys = recordKeys.filter(key => !expectedKeys.includes(key));
  const recordHashFailures = records.filter(record => !validHash(record.recordContentHash) || contentHash(without(record, 'recordContentHash')) !== record.recordContentHash).map(item => item.decisionKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.reviewDecisionRecorded !== true || record.semanticDispositionApplied !== false
    || record.weightedMembershipReviewDecision !== null || record.weightedTaskEntryMembershipVerdict !== null
    || record.candidateMemberIdentityVerdict !== null || record.repeatabilityVerdict !== null
    || record.mechanicsReviewComplete !== false || record.mappingVerdict !== null || record.inventoryCompletenessVerdict !== null
    || record.memberUniverseComplete !== false || record.optimizerEligible !== false || record.automaticVerificationApplied !== false
    || record.accountIndependent !== true).map(item => item.decisionKey || 'unknown');
  const outputAccountFindings = accountStateFindings([records]);
  const accountFindings = unique([...result.accountFindings, ...outputAccountFindings]);
  const blockers = [];
  if (!result.compiled.valid) blockers.push('weighted_membership_review_decision_import_policy_invalid_or_specific');
  if (!validHash(queueSnapshotContentHash) || result.duplicateQueueKeys.length || result.queueIntegrityFailures.length) blockers.push('one_or_more_queue_records_failed_manifest_record_template_or_binding_revalidation');
  if (result.duplicateSubmissionKeys.length) blockers.push('duplicate_submission_queue_entry_keys');
  if (result.invalid.length) blockers.push('one_or_more_submission_rows_partial_stale_unknown_or_invalid');
  if (!result.completed.length) blockers.push('no_completed_review_decisions_submitted');
  if (recordMismatches.length || duplicateRecordKeys.length || missingRecordKeys.length || unexpectedRecordKeys.length || recordHashFailures.length) blockers.push('recorded_decision_set_does_not_exactly_match_completed_submissions');
  if (unsupportedPromotions.length) blockers.push('decision_import_created_unsupported_membership_semantic_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = result.atomicAcceptable && records.length === result.expectedRecords.length && !recordMismatches.length
    && !duplicateRecordKeys.length && !missingRecordKeys.length && !unexpectedRecordKeys.length && !recordHashFailures.length
    && !unsupportedPromotions.length && !accountFindings.length;
  const decisionDistribution = Object.fromEntries((policy.allowedDecisions || []).map(decision => [decision, records.filter(record => record.decision === decision).length]));
  const reviewDecisionRecordingComplete = publishable && records.length === queueRecords.length && records.length > 0;
  return {
    contract: policy.auditContract,
    queueCoverage: { queueRecordCount: queueRecords.length, completeQueueRecordCount: queueRecords.length - result.queueIntegrityFailures.length, duplicateQueueKeys: result.duplicateQueueKeys, queueIntegrityFailures: result.queueIntegrityFailures, queueSnapshotContentHash },
    submissionCoverage: { submissionRowCount: submissions.length, completedSubmissionCount: result.completed.length, blankSubmissionCount: result.blanks.length, invalidSubmissionCount: result.invalid.length, duplicateSubmissionKeys: result.duplicateSubmissionKeys, completedQueueEntryKeys: result.completed.map(item => item.queueEntryKey), blankQueueEntryKeys: result.blanks.map(item => item.queueEntryKey), invalidQueueEntryKeys: result.invalid.map(item => item.queueEntryKey) },
    policyCoverage: result.compiled,
    bindingCoverage: { exactImmutableQueueBindingCount: result.completed.filter(item => Object.values(item.bindingChecks).every(Boolean)).length, completedSubmissionAssessments: result.completed },
    recordCoverage: { recordedDecisionCount: records.length, expectedDecisionCount: result.expectedRecords.length, duplicateRecordKeys, missingRecordKeys, unexpectedRecordKeys, recordMismatches, recordHashFailures, decisionDistribution },
    semanticPreservationCoverage: { unsupportedPromotions, semanticDispositionAppliedCount: records.filter(record => record.semanticDispositionApplied === true).length, weightedMembershipVerdictCount: records.filter(record => record.weightedTaskEntryMembershipVerdict !== null).length, optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length },
    accountStateFindings: accountFindings,
    reviewDecisionRecordingComplete,
    weightedMembershipReviewComplete: false,
    memberExpansionComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      ...(!reviewDecisionRecordingComplete ? ['one_or_more_weighted_membership_review_decisions_unrecorded'] : []),
      'review_decision_recording_does_not_apply_weighted_membership_disposition',
      'numbered_alias_or_variant_scope_evidence_pending',
      'additional_candidate_specific_membership_evidence_pending',
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

export function buildWeightedParentTaskEntryMembershipReviewDecisionImport({
  queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash
} = {}) {
  const result = flight(queueRecords, submissions, policy, queueSnapshotContentHash, contentHash);
  const records = result.atomicAcceptable ? result.expectedRecords : [];
  return { records, audit: auditWeightedParentTaskEntryMembershipReviewDecisionImport(records, { queueRecords, submissions, policy, queueSnapshotContentHash, contentHash }) };
}
