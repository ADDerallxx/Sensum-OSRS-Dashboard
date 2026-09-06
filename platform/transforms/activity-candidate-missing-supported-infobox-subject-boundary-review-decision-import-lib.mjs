import { hash } from '../ingestion/lib.mjs';
import { compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy } from './activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-lib.mjs';

const REQUIRED_RULES = [
  'queueSnapshotBlankTemplateSnapshotAndDecisionFileMustBeExplicitlySelected',
  'queueManifestPolicyArtifactRawOuterIntrinsicAndEvidenceHashesMustRevalidate',
  'blankTemplateSnapshotMustExactlyMatchTheQueueGeneratedTemplates',
  'decisionSubmissionFieldSetAndImmutableBindingsMustExactlyMatchItsBlankTemplate',
  'everyQueueEntryMustHaveExactlyOneCompletedDecision',
  'blankPartialDuplicateUnknownOrExtraSubmissionRowsRejectTheEntireBatch',
  'decisionMustUseAnAllowedDisposition',
  'everySelectedEvidenceKeyMustExistInTheBoundQueueEntry',
  'everyRequiredReviewObligationMustHaveSelectedEvidenceCoverage',
  'reviewerReviewedAtMeaningfulNotesAndEvidenceSelectionAreRequired',
  'reviewedAtMustNotPrecedeTheQueueOrAnyBoundSourceObservation',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'dispositionDependentFieldsMustBeExplicitAndCoherent',
  'recordingDoesNotEstablishCanonicalIdentityRepeatabilityMembershipRequirementsVariantsXpTimingMechanicsCompleteUniverseOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const EXPECTED_DISPOSITIONS = [
  'confirm_single_activity_subject',
  'confirm_composite_or_container_subject',
  'confirm_reference_collection_subject',
  'reject_as_activity_subject',
  'needs_additional_evidence'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash({ value: left }) === contentHash({ value: right });
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|route|routes|label|labels|alias|aliases|override|overrides|exception|exceptions)$/i;
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

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests|currentBaseLevel|currentLevel|currentXp)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  values.forEach((value, index) => visit(value, `[${index}]`));
  return sorted(unique(findings));
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === (value.includes('.') ? value : value.replace(/Z$/, '.000Z'));
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|ai)$/.test(value)
    || /\b(?:bot|automated reviewer|language model|ai reviewer|codex|chatgpt|openai|sensum|gpt(?:[- ]?\d[^ ]*)?)\b/.test(value);
}

export function compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy(
  policy = {}, queuePolicy = {}, routingPolicy = {}, oneHopPolicy = {}, recursivePolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-policy.v1'
    && policy.inputQueuePolicy === queuePolicy.policy
    && policy.inputQueuePolicyContentHash === contentHash(queuePolicy)
    && policy.inputQueueDomain === queuePolicy.outputDomain
    && policy.queueContract === queuePolicy.queueContract
    && policy.submissionContract === queuePolicy.decisionTemplateContract
    && policy.recordContract === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-decision.v1'
    && policy.auditContract === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-audit.v1'
    && policy.queueState === queuePolicy.queueState
    && policy.recordState === 'recorded_source_bound_subject_boundary_human_review_decision_pending_separate_semantic_application';
  const queuePolicyCoverage = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy(
    queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash
  );
  const dispositionsValid = same(policy.allowedSubjectDispositions || [], EXPECTED_DISPOSITIONS, contentHash)
    && same(policy.allowedSubjectDispositions || [], queuePolicy.allowedSubjectDispositions || [], contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && queuePolicyCoverage.valid && dispositionsValid && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid,
    queuePolicyCoverage,
    dispositionsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function blankDecision() {
  return {
    subjectDisposition: null,
    compositeOrContainerVerdict: null,
    memberExpansionRequired: null,
    additionalEvidenceRequired: null,
    rejectionReason: null,
    selectedEvidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    notes: null
  };
}

export function expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(
  queue = {}, queueSnapshotContentHash = '', policy = {}
) {
  return {
    contract: policy.submissionContract,
    queueEntryKey: queue.queueEntryKey,
    queueEntryRecordContentHash: queue.recordContentHash,
    queueSnapshotContentHash,
    candidateKey: queue.candidateKey,
    sourcePageId: queue.sourcePageIdentity?.sourcePageId,
    sourceRevision: queue.sourcePageIdentity?.sourceRevision,
    evidenceFingerprint: queue.evidenceFingerprint,
    allowedSubjectDispositions: structuredClone(queue.allowedSubjectDispositions || []),
    ...blankDecision()
  };
}

function sourceIdentityValid(source = {}) {
  return Number.isInteger(source.sourcePageId) && source.sourcePageId > 0
    && typeof source.resolvedTitle === 'string' && source.resolvedTitle.length > 0
    && typeof source.sourceRevision === 'string' && /^\d+$/.test(source.sourceRevision)
    && validIsoTimestamp(source.sourceTimestamp)
    && typeof source.sourceUrl === 'string' && source.sourceUrl.length > 0
    && validHash(source.sourceContentHash)
    && Number.isInteger(source.sourceContentBytes) && source.sourceContentBytes > 0;
}

function evidenceFingerprint(queue = {}, contentHash = hash) {
  return contentHash({
    candidateKey: queue.candidateKey,
    sourcePageIdentity: queue.sourcePageIdentity,
    sourceBindings: queue.sourceBindings,
    structuralSourceEvidence: queue.structuralSourceEvidence,
    rootInvocationEvidence: queue.rootInvocationEvidence,
    recursiveGraphEvidence: queue.recursiveGraphEvidence
  });
}

function evidenceKeys(queue = {}) {
  return unique([
    queue.structuralSourceEvidence?.evidenceKey,
    ...(queue.rootInvocationEvidence || []).map(row => row.evidenceKey),
    ...(queue.recursiveGraphEvidence?.nodes || []).map(row => row.evidenceKey),
    ...(queue.recursiveGraphEvidence?.edges || []).map(row => row.evidenceKey),
    ...(queue.recursiveGraphEvidence?.cycles || []).map(row => row.evidenceKey),
    ...(queue.recursiveGraphEvidence?.wrappers || []).map(row => row.evidenceKey),
    ...(queue.recursiveGraphEvidence?.dynamicBoundaries || []).map(row => row.evidenceKey)
  ].filter(value => typeof value === 'string' && value.length > 0));
}

function latestBoundTimestamp(queue = {}, queueSnapshotCreatedAt = '') {
  const timestamps = [];
  const visit = (value, key = '') => {
    if (Array.isArray(value)) return value.forEach(child => visit(child, key));
    if (!value || typeof value !== 'object') return;
    for (const [childKey, child] of Object.entries(value)) {
      if (/(?:timestamp|observedAt|createdAt|generatedAt)$/i.test(childKey) && validIsoTimestamp(child)) timestamps.push(child);
      else visit(child, childKey);
    }
  };
  visit(queue);
  if (validIsoTimestamp(queueSnapshotCreatedAt)) timestamps.push(queueSnapshotCreatedAt);
  return timestamps.length ? new Date(Math.max(...timestamps.map(Date.parse))).toISOString() : null;
}

function queueRecordIntegrity(queue = {}, policy = {}, contentHash = hash) {
  const blankTemplate = blankDecision();
  const obligations = queue.reviewObligations || [];
  const allEvidence = new Set(evidenceKeys(queue));
  const checks = {
    contractMatches: queue.contract === policy.queueContract,
    stateMatches: queue.state === policy.queueState,
    outerHashMatches: validHash(queue.contentHash) && queue.contentHash === contentHash(without(queue, 'contentHash')),
    intrinsicHashMatches: validHash(queue.recordContentHash) && queue.recordContentHash === contentHash(without(queue, 'recordContentHash', 'contentHash')),
    keyAndOrdinalValid: typeof queue.queueEntryKey === 'string' && queue.queueEntryKey.length > 0
      && typeof queue.candidateKey === 'string' && queue.candidateKey.length > 0
      && Number.isInteger(queue.queueOrdinal) && queue.queueOrdinal > 0,
    sourceIdentityValid: sourceIdentityValid(queue.sourcePageIdentity),
    sourceBindingHashesValid: Object.values(queue.sourceBindings || {}).every(validHash)
      && Object.keys(queue.sourceBindings || {}).length === 10
      && queue.sourceBindings?.candidateSourceContentHash === queue.sourcePageIdentity?.sourceContentHash,
    evidenceFingerprintMatches: validHash(queue.evidenceFingerprint) && queue.evidenceFingerprint === evidenceFingerprint(queue, contentHash),
    evidenceCollectionsPresent: queue.structuralSourceEvidence && Array.isArray(queue.rootInvocationEvidence)
      && queue.recursiveGraphEvidence && ['nodes', 'edges', 'cycles', 'wrappers', 'dynamicBoundaries'].every(key => Array.isArray(queue.recursiveGraphEvidence[key])),
    obligationsValid: obligations.length > 0 && obligations.every(obligation => typeof obligation.obligationKey === 'string'
      && obligation.required === true && Array.isArray(obligation.evidenceKeys) && obligation.evidenceKeys.length > 0
      && duplicates(obligation.evidenceKeys).length === 0),
    obligationEvidenceBound: obligations.every(obligation => obligation.evidenceKeys.every(key => allEvidence.has(key))),
    allowedDispositionsMatch: same(queue.allowedSubjectDispositions || [], policy.allowedSubjectDispositions || [], contentHash),
    embeddedDecisionBlank: same(queue.decisionTemplate, blankTemplate, contentHash),
    semanticGatesClosed: queue.humanDecisionRecorded === false && queue.subjectDisposition === null
      && queue.compositeOrContainerVerdict === null && queue.memberExpansionRequired === null
      && queue.canonicalGameEntityIdentity === null && queue.canonicalActivityIdentity === null
      && queue.repeatabilityClassification === null && queue.requirementsVariantsXpTimingAndMechanicsComplete === false
      && queue.optimizerEligible === false && queue.automaticVerificationApplied === false,
    accountIndependent: queue.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function submissionShape(submission = {}) {
  const keys = Array.isArray(submission.selectedEvidenceKeys) ? submission.selectedEvidenceKeys : [];
  const decisionFields = [
    submission.subjectDisposition, submission.compositeOrContainerVerdict, submission.memberExpansionRequired,
    submission.additionalEvidenceRequired, submission.rejectionReason, submission.reviewer, submission.reviewedAt, submission.notes
  ];
  const allBlank = decisionFields.every(blank) && keys.length === 0;
  const anyReviewField = decisionFields.some(value => !blank(value)) || keys.length > 0;
  return { allBlank, anyReviewField, selectedEvidenceKeys: keys };
}

function dispositionCoherent(submission = {}) {
  switch (submission.subjectDisposition) {
    case 'confirm_single_activity_subject':
      return submission.compositeOrContainerVerdict === false && submission.memberExpansionRequired === false
        && submission.additionalEvidenceRequired === false && submission.rejectionReason === null;
    case 'confirm_composite_or_container_subject':
    case 'confirm_reference_collection_subject':
      return submission.compositeOrContainerVerdict === true && submission.memberExpansionRequired === true
        && submission.additionalEvidenceRequired === false && submission.rejectionReason === null;
    case 'reject_as_activity_subject':
      return submission.compositeOrContainerVerdict === false && submission.memberExpansionRequired === false
        && submission.additionalEvidenceRequired === false && typeof submission.rejectionReason === 'string'
        && submission.rejectionReason.trim().length >= 20;
    case 'needs_additional_evidence':
      return submission.compositeOrContainerVerdict === null && submission.memberExpansionRequired === null
        && submission.additionalEvidenceRequired === true && submission.rejectionReason === null;
    default:
      return false;
  }
}

function submissionAssessment(submission = {}, queue, blankTemplate, policy = {}, queueSnapshotCreatedAt = '', contentHash = hash) {
  const shape = submissionShape(submission);
  const allowedKeys = new Set(evidenceKeys(queue || {}));
  const submittedKeys = new Set(shape.selectedEvidenceKeys);
  const obligations = queue?.reviewObligations || [];
  const latestTimestamp = queue ? latestBoundTimestamp(queue, queueSnapshotCreatedAt) : null;
  const bindingChecks = {
    queueEntryExists: Boolean(queue),
    blankTemplateExists: Boolean(blankTemplate),
    fieldSetExact: same(sorted(Object.keys(submission)), sorted(Object.keys(blankTemplate || {})), contentHash),
    immutableBindingsMatch: Boolean(queue && blankTemplate) && [
      'contract', 'queueEntryKey', 'queueEntryRecordContentHash', 'queueSnapshotContentHash', 'candidateKey',
      'sourcePageId', 'sourceRevision', 'evidenceFingerprint', 'allowedSubjectDispositions'
    ].every(key => same(submission[key], blankTemplate[key], contentHash))
  };
  const contentChecks = shape.allBlank ? {} : {
    dispositionAllowed: policy.allowedSubjectDispositions?.includes(submission.subjectDisposition) === true,
    dispositionFieldsCoherent: dispositionCoherent(submission),
    evidenceKeysPresentUniqueAndBound: shape.selectedEvidenceKeys.length > 0
      && duplicates(shape.selectedEvidenceKeys).length === 0
      && shape.selectedEvidenceKeys.every(key => allowedKeys.has(key)),
    everyRequiredObligationCovered: obligations.filter(row => row.required === true).every(obligation =>
      obligation.evidenceKeys.some(key => submittedKeys.has(key))),
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforeQueueOrEvidence: validIsoTimestamp(submission.reviewedAt) && latestTimestamp !== null
      && Date.parse(submission.reviewedAt) >= Date.parse(latestTimestamp),
    notesMeaningful: typeof submission.notes === 'string' && submission.notes.trim().length >= 20
  };
  const bindingComplete = Object.values(bindingChecks).every(Boolean);
  const contentComplete = !shape.allBlank && Object.values(contentChecks).every(Boolean);
  return {
    shape,
    bindingChecks,
    contentChecks,
    latestBoundTimestamp: latestTimestamp,
    blank: shape.allBlank && bindingComplete,
    complete: shape.anyReviewField && bindingComplete && contentComplete,
    invalid: !bindingComplete || shape.allBlank || !shape.anyReviewField || !contentComplete
  };
}

function decisionRecord(submission, queue, blankTemplate, queueSnapshotContentHash, policy, contentHash = hash) {
  const decisionFacts = {
    subjectDisposition: submission.subjectDisposition,
    compositeOrContainerVerdict: submission.compositeOrContainerVerdict,
    memberExpansionRequired: submission.memberExpansionRequired,
    additionalEvidenceRequired: submission.additionalEvidenceRequired,
    rejectionReason: submission.rejectionReason === null ? null : submission.rejectionReason.trim(),
    selectedEvidenceKeys: sorted(submission.selectedEvidenceKeys),
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    notes: submission.notes.trim()
  };
  const coveredReviewObligationKeys = sorted((queue.reviewObligations || [])
    .filter(obligation => obligation.evidenceKeys.some(key => decisionFacts.selectedEvidenceKeys.includes(key)))
    .map(obligation => obligation.obligationKey));
  const base = {
    contract: policy.recordContract,
    decisionKey: `${queue.queueEntryKey}|subject-boundary-review-decision|${contentHash(decisionFacts)}`,
    queueEntryKey: queue.queueEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queue.recordContentHash,
    sourceQueueOuterContentHash: queue.contentHash,
    sourceBlankTemplateContentHash: contentHash(blankTemplate),
    candidateKey: queue.candidateKey,
    sourcePageIdentity: structuredClone(queue.sourcePageIdentity),
    sourceBindings: structuredClone(queue.sourceBindings),
    evidenceFingerprint: queue.evidenceFingerprint,
    ...decisionFacts,
    coveredReviewObligationKeys,
    reviewDecisionRecorded: true,
    semanticApplicationApplied: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    membershipOrVariantApplication: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: [
      'subject_boundary_review_decision_recorded_but_not_semantically_applied',
      'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved',
      'independent_complete_activity_universe_not_established'
    ],
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

export function auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport(records = [], context = {}) {
  const {
    queueRecords = [], blankTemplates = [], submissions = [], policy = {}, compiled = {}, queueAssessments = [],
    submissionAssessments = [], queueSnapshotContentHash = '', queueSnapshotCreatedAt = '', contentHash = hash
  } = context;
  const queueKeys = queueRecords.map(row => row.queueEntryKey);
  const templateKeys = blankTemplates.map(row => row.queueEntryKey);
  const submissionKeys = submissions.map(row => row.queueEntryKey);
  const invalidQueueRows = queueAssessments.filter(row => !row.complete).map((row, index) => queueRecords[index]?.candidateKey || index);
  const expectedTemplates = queueRecords.map(row => expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(row, queueSnapshotContentHash, policy));
  const invalidTemplateRows = blankTemplates.map((row, index) => same(row, expectedTemplates[index], contentHash) ? null : row?.queueEntryKey || index).filter(value => value !== null);
  const invalidSubmissionRows = submissionAssessments.map((row, index) => row.complete ? null : {
    row: index + 1,
    queueEntryKey: submissions[index]?.queueEntryKey || null,
    bindingChecks: row.bindingChecks,
    contentChecks: row.contentChecks,
    blank: row.blank
  }).filter(Boolean);
  const accountFindings = accountStateFindings([queueRecords, blankTemplates, submissions, records]);
  const recordIntegrity = records.every(record => validHash(record.recordContentHash)
    && record.recordContentHash === contentHash(without(record, 'recordContentHash', 'contentHash')));
  const queueByKey = new Map(queueRecords.map(row => [row.queueEntryKey, row]));
  const templateByKey = new Map(blankTemplates.map(row => [row.queueEntryKey, row]));
  const expectedRecords = submissions.map((submission, index) => {
    const queue = queueByKey.get(submission.queueEntryKey);
    const template = templateByKey.get(submission.queueEntryKey);
    return submissionAssessments[index]?.complete && queue && template
      ? decisionRecord(submission, queue, template, queueSnapshotContentHash, policy, contentHash)
      : null;
  }).filter(Boolean);
  const recordsMatchExactSubmissions = records.length === expectedRecords.length
    && records.every((record, index) => same(record, expectedRecords[index], contentHash));
  const semanticPreservationCoverage = {
    reviewDecisionRecordedCount: records.filter(row => row.reviewDecisionRecorded === true).length,
    semanticApplicationCount: records.filter(row => row.semanticApplicationApplied === true).length,
    canonicalIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length,
    repeatabilityClassificationCount: records.filter(row => row.repeatabilityClassification !== null).length,
    membershipOrVariantApplicationCount: records.filter(row => row.membershipOrVariantApplication === true).length,
    mechanicsCompletionCount: records.filter(row => row.requirementsVariantsXpTimingAndMechanicsComplete === true).length,
    completeActivityUniverseCount: records.filter(row => row.completeActivityUniverse === true).length,
    optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
    automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length
  };
  const semanticBoundaryIntact = semanticPreservationCoverage.semanticApplicationCount === 0
    && semanticPreservationCoverage.canonicalIdentityCount === 0
    && semanticPreservationCoverage.repeatabilityClassificationCount === 0
    && semanticPreservationCoverage.membershipOrVariantApplicationCount === 0
    && semanticPreservationCoverage.mechanicsCompletionCount === 0
    && semanticPreservationCoverage.completeActivityUniverseCount === 0
    && semanticPreservationCoverage.optimizerEligibleCount === 0
    && semanticPreservationCoverage.automaticVerificationCount === 0;
  const blockers = [];
  if (!compiled.valid) blockers.push('decision_import_policy_invalid');
  if (!validHash(queueSnapshotContentHash) || !validIsoTimestamp(queueSnapshotCreatedAt)) blockers.push('queue_snapshot_binding_invalid');
  if (!queueRecords.length) blockers.push('queue_snapshot_empty');
  if (duplicates(queueKeys).length) blockers.push('duplicate_queue_entry_keys');
  if (invalidQueueRows.length) blockers.push('one_or_more_queue_records_failed_integrity_revalidation');
  if (blankTemplates.length !== queueRecords.length || !same(templateKeys, queueKeys, contentHash) || invalidTemplateRows.length) blockers.push('blank_template_snapshot_does_not_exactly_match_queue');
  if (submissions.length !== queueRecords.length || !same(sorted(submissionKeys), sorted(queueKeys), contentHash)) blockers.push('decision_submission_does_not_cover_exact_queue');
  if (duplicates(submissionKeys).length) blockers.push('duplicate_submission_queue_entry_keys');
  if (invalidSubmissionRows.length) blockers.push('one_or_more_decision_rows_blank_partial_stale_unsupported_or_incoherent');
  if (records.length !== queueRecords.length) blockers.push('one_recorded_decision_per_queue_entry_not_satisfied');
  if (!recordIntegrity) blockers.push('decision_record_integrity_failed');
  if (!recordsMatchExactSubmissions) blockers.push('decision_records_do_not_exactly_reproduce_validated_submissions');
  if (!semanticBoundaryIntact) blockers.push('decision_import_created_unsupported_semantic_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const reviewDecisionRecordingComplete = blockers.length === 0 && records.length === queueRecords.length && records.length > 0;
  return {
    contract: policy.auditContract,
    policyCoverage: compiled,
    inputCoverage: {
      explicitQueueSnapshotSelected: validHash(queueSnapshotContentHash) && validIsoTimestamp(queueSnapshotCreatedAt),
      queueRecordCount: queueRecords.length,
      blankTemplateRecordCount: blankTemplates.length,
      submissionRecordCount: submissions.length
    },
    queueCoverage: { queueEntryCount: queueRecords.length, duplicateQueueEntryKeys: duplicates(queueKeys), invalidQueueRows },
    templateCoverage: { expectedTemplateCount: expectedTemplates.length, actualTemplateCount: blankTemplates.length, invalidTemplateRows, exactTemplateOrder: same(templateKeys, queueKeys, contentHash) },
    submissionCoverage: { expectedDecisionCount: queueRecords.length, completedDecisionCount: submissionAssessments.filter(row => row.complete).length, invalidSubmissionRows, duplicateSubmissionQueueEntryKeys: duplicates(submissionKeys) },
    bindingCoverage: {
      exactImmutableBindingCount: submissionAssessments.filter(row => Object.values(row.bindingChecks || {}).every(Boolean)).length,
      exactEvidenceObligationCoverageCount: submissionAssessments.filter(row => row.contentChecks?.everyRequiredObligationCovered === true).length,
      exactDecisionRecordReproductionCount: recordsMatchExactSubmissions ? records.length : 0,
      sourceRevisionCount: unique(queueRecords.map(row => row.sourcePageIdentity?.sourceRevision).filter(Boolean)).length,
      evidenceFingerprintCount: unique(queueRecords.map(row => row.evidenceFingerprint).filter(validHash)).length
    },
    semanticPreservationCoverage,
    accountStateFindings: accountFindings,
    reviewDecisionRecordingComplete,
    subjectBoundaryReviewComplete: false,
    semanticApplicationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: reviewDecisionRecordingComplete ? [
      'subject_boundary_decisions_recorded_but_separate_semantic_application_pending',
      'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved',
      'independent_complete_activity_universe_not_established'
    ] : unique(blockers),
    publishable: reviewDecisionRecordingComplete
  };
}

export function buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport(input = {}) {
  const {
    queueRecords = [], blankTemplates = [], submissions = [], policy = {}, queuePolicy = {}, routingPolicy = {},
    oneHopPolicy = {}, recursivePolicy = {}, queueSnapshotContentHash = '', queueSnapshotCreatedAt = '', contentHash = hash
  } = input;
  const compiled = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy(
    policy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash
  );
  const queueAssessments = queueRecords.map(queue => queueRecordIntegrity(queue, policy, contentHash));
  const queueByKey = new Map(queueRecords.map(row => [row.queueEntryKey, row]));
  const templateByKey = new Map(blankTemplates.map(row => [row.queueEntryKey, row]));
  const submissionAssessments = submissions.map(submission => submissionAssessment(
    submission, queueByKey.get(submission.queueEntryKey), templateByKey.get(submission.queueEntryKey), policy, queueSnapshotCreatedAt, contentHash
  ));
  const preflightClean = compiled.valid && queueRecords.length > 0
    && queueAssessments.every(row => row.complete)
    && blankTemplates.length === queueRecords.length
    && submissions.length === queueRecords.length
    && duplicates(queueRecords.map(row => row.queueEntryKey)).length === 0
    && duplicates(blankTemplates.map(row => row.queueEntryKey)).length === 0
    && duplicates(submissions.map(row => row.queueEntryKey)).length === 0
    && same(blankTemplates.map(row => row.queueEntryKey), queueRecords.map(row => row.queueEntryKey), contentHash)
    && same(sorted(submissions.map(row => row.queueEntryKey)), sorted(queueRecords.map(row => row.queueEntryKey)), contentHash)
    && blankTemplates.every((template, index) => same(template,
      expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(queueRecords[index], queueSnapshotContentHash, policy), contentHash))
    && submissionAssessments.every(row => row.complete)
    && accountStateFindings([queueRecords, blankTemplates, submissions]).length === 0;
  const records = preflightClean ? submissions.map(submission => {
    const queue = queueByKey.get(submission.queueEntryKey);
    return decisionRecord(submission, queue, templateByKey.get(submission.queueEntryKey), queueSnapshotContentHash, policy, contentHash);
  }) : [];
  const audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport(records, {
    queueRecords, blankTemplates, submissions, policy, compiled, queueAssessments, submissionAssessments,
    queueSnapshotContentHash, queueSnapshotCreatedAt, contentHash
  });
  return { records: audit.publishable ? records : [], audit };
}
