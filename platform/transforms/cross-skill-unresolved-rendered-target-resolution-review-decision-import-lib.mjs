import { hash } from '../ingestion/lib.mjs';
import { findUnresolvedRenderedTargetResolutionSufficiencyAccountState } from './cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-lib.mjs';

const REQUIRED_RULES = [
  'oneRecordedDecisionPerCompletedSubmission',
  'partialReviewBatchesAreAllowed',
  'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected',
  'anyInvalidRowRejectsTheEntireBatch',
  'queueManifestIntrinsicRecordNestedEvidenceAndSnapshotHashesMustRevalidate',
  'submissionMustMatchEveryImmutableQueueBinding',
  'submissionFieldSetMustExactlyMatchTheBlankTemplate',
  'decisionMustBeExplicitlyAllowedByTheBoundQueueEntry',
  'confirmedResolutionMustSelectExactlyOnePresentedPageIdentity',
  'nonConfirmationDecisionsMustNotSelectAPageIdentity',
  'reviewerReviewedAtNotesAndBoundEvidenceKeysAreRequired',
  'reviewedAtMustNotPrecedeTheNewestBoundSourceTimestamp',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingADecisionDoesNotApplyResolutionCanonicalIdentityRepeatabilityRequirementsVariantsXpTimingMechanicsOrOptimizerState',
  'titlesPageIdsRevisionsCandidateNamesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DECISIONS = [
  'confirm_exact_current_resolution',
  'confirm_revision_pinned_candidate_resolution',
  'reject_all_presented_resolution_candidates',
  'needs_additional_evidence'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => (left === undefined || right === undefined) ? left === right : contentHash(left) === contentHash(right);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:titleOverrides|pageIdOverrides|revisionOverrides|candidateNameOverrides|candidateKeyOverrides|overrides|exceptions)$/i;
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

export function compileUnresolvedRenderedTargetResolutionReviewDecisionImportPolicy(policy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-decision-import-policy.v1' &&
    policy.queueContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-queue-entry.v1' &&
    policy.submissionContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-decision-template.v1' &&
    policy.recordContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-decision.v1' &&
    policy.auditContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-decision-import-audit.v1' &&
    policy.queueState === 'pending_explicit_source_bound_resolution_review' &&
    policy.recordState === 'recorded_source_bound_resolution_review_decision_pending_resolution_application';
  const decisionsValid = same(policy.allowedDecisions || [], EXPECTED_DECISIONS, contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractsValid && decisionsValid && invalidRules.length === 0 && forbidden.length === 0, contractsValid, decisionsValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
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
  return /^(?:automatic|automation|system|ai)$/.test(value) || /\b(?:bot|automated reviewer|language model|ai reviewer|codex|chatgpt|openai|sensum|gpt(?:[- ]?\d[^ ]*)?)\b/.test(value);
}

function nestedEvidenceHashValid(value = {}, contentHash = hash) {
  return validHash(value.evidenceContentHash) && contentHash(without(value, 'evidenceContentHash')) === value.evidenceContentHash;
}

function currentPageIdentities(queue = {}) {
  return (queue.resolutionEvidence?.currentTitleResolutionEvidence || []).map(row => row.currentPageEvidence).filter(Boolean);
}

function candidatePageIdentities(queue = {}) {
  return (queue.resolutionEvidence?.discoveryEvidence || []).flatMap(row => row.candidates || []).map(row => row.sourcePageIdentity).filter(Boolean);
}

function expectedAllowedDecisions(queue = {}, policy = {}) {
  const decisions = [];
  if (currentPageIdentities(queue).length) decisions.push(policy.allowedDecisions?.[0]);
  if (candidatePageIdentities(queue).length) decisions.push(policy.allowedDecisions?.[1], policy.allowedDecisions?.[2]);
  decisions.push(policy.allowedDecisions?.[3]);
  return unique(decisions.filter(Boolean));
}

function queueEvidenceValid(queue = {}, contentHash = hash) {
  const evidence = queue.resolutionEvidence || {};
  const arraysPresent = ['guideObservations', 'pinnedGuideEvidence', 'currentTitleResolutionEvidence', 'titleLogEvidence', 'discoveryEvidence'].every(key => Array.isArray(evidence[key]));
  return arraysPresent && evidence.pinnedGuideEvidence.length > 0 && evidence.currentTitleResolutionEvidence.length > 0 && evidence.titleLogEvidence.length > 0 && evidence.discoveryEvidence.length > 0 &&
    evidence.pinnedGuideEvidence.every(row => nestedEvidenceHashValid(row, contentHash)) &&
    evidence.currentTitleResolutionEvidence.every(row => nestedEvidenceHashValid(row, contentHash)) &&
    evidence.titleLogEvidence.every(row => nestedEvidenceHashValid(row, contentHash)) &&
    evidence.discoveryEvidence.every(row => nestedEvidenceHashValid(row, contentHash));
}

function expectedBlankTemplate(queue = {}, policy = {}, contentHash = hash) {
  return {
    contract: policy.submissionContract,
    queueEntryKey: queue.queueEntryKey,
    queueEntryContentHash: queue.contentHash,
    sourceDispositionKey: queue.sourceDispositionKey,
    sourceDispositionRecordContentHash: queue.sourceDispositionRecordContentHash,
    sourceEvidenceRecordContentHash: queue.sourceEvidenceRecordContentHash,
    sourceDispositionSnapshotContentHash: queue.sourceDispositionSnapshotContentHash,
    sourceEvidenceSnapshotContentHash: queue.sourceEvidenceSnapshotContentHash,
    evidenceFingerprint: queue.evidenceFingerprint,
    allowedDecisions: queue.allowedDecisions,
    decision: null,
    selectedPageId: null,
    selectedTitle: null,
    evidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_explicit_human_resolution_review_template'
  };
}

function queueRecordIntegrity(queue = {}, policy = {}, contentHash = hash) {
  const compiled = compileUnresolvedRenderedTargetResolutionReviewDecisionImportPolicy(policy, contentHash);
  const decision = queue.decisionTemplate || {};
  const checks = {
    contractMatches: queue.contract === policy.queueContract,
    stateMatches: queue.state === policy.queueState,
    intrinsicRecordHashMatches: validHash(queue.contentHash) && contentHash(without(queue, 'contentHash')) === queue.contentHash,
    immutableBindingsPresent: [queue.sourceDispositionRecordContentHash, queue.sourceEvidenceRecordContentHash, queue.sourceDispositionSnapshotContentHash, queue.sourceEvidenceSnapshotContentHash, queue.evidenceFingerprint].every(validHash),
    keysPresent: typeof queue.queueEntryKey === 'string' && queue.queueEntryKey.length > 0 && typeof queue.sourceDispositionKey === 'string' && queue.sourceDispositionKey.length > 0,
    titlesPresent: Array.isArray(queue.requestedTitles) && queue.requestedTitles.length > 0 && duplicates(queue.requestedTitles).length === 0,
    nestedEvidenceHashesValid: queueEvidenceValid(queue, contentHash),
    atLeastOnePresentedResolution: currentPageIdentities(queue).length + candidatePageIdentities(queue).length > 0,
    allowedDecisionsMatchEvidenceShape: same(queue.allowedDecisions || [], expectedAllowedDecisions(queue, policy), contentHash),
    embeddedTemplateBlank: decision.decision === null && decision.selectedPageId === null && decision.selectedTitle === null && Array.isArray(decision.evidenceKeys) && decision.evidenceKeys.length === 0 && decision.reviewer === null && decision.reviewedAt === null && decision.reviewNotes === null,
    semanticGatesClosed: queue.canonicalGameEntityIdentity === null && queue.canonicalActivityIdentity === null && queue.repeatabilityClassification === null && queue.optimizerEligible === false,
    accountIndependent: queue.accountIndependent === true,
    externalTemplateReconstructable: expectedBlankTemplate(queue, policy, contentHash).queueEntryContentHash === queue.contentHash
  };
  return { checks, complete: compiled.valid && Object.values(checks).every(Boolean), expectedTemplate: expectedBlankTemplate(queue, policy, contentHash) };
}

function sourceTimestamps(queue = {}) {
  const evidence = queue.resolutionEvidence || {};
  return [
    ...(evidence.pinnedGuideEvidence || []).map(row => row.pinnedGuideSourceIdentity?.sourceTimestamp),
    ...currentPageIdentities(queue).map(row => row.sourceTimestamp),
    ...candidatePageIdentities(queue).map(row => row.sourceTimestamp),
    ...(evidence.titleLogEvidence || []).flatMap(row => (row.events || []).map(event => event.timestamp))
  ].filter(validIsoTimestamp);
}

function allowedEvidenceKeys(queue = {}, contentHash = hash) {
  const evidence = queue.resolutionEvidence || {};
  const values = [
    queue.contentHash,
    queue.sourceDispositionRecordContentHash,
    queue.sourceEvidenceRecordContentHash,
    queue.sourceDispositionSnapshotContentHash,
    queue.sourceEvidenceSnapshotContentHash,
    queue.evidenceFingerprint,
    ...(evidence.pinnedGuideEvidence || []).flatMap(row => [row.evidenceContentHash, row.pinnedGuideSourceIdentity?.sourceContentHash, ...(row.exactSourceOccurrences || []).map(contentHash)]),
    ...(evidence.currentTitleResolutionEvidence || []).flatMap(row => [row.evidenceContentHash, row.currentPageEvidence?.sourceContentHash]),
    ...(evidence.discoveryEvidence || []).flatMap(row => [row.evidenceContentHash, ...(row.candidates || []).map(candidate => candidate.sourcePageIdentity?.sourceContentHash)]),
    ...(evidence.titleLogEvidence || []).map(row => row.evidenceContentHash),
    ...(evidence.guideObservations || []).map(contentHash)
  ];
  return new Set(values.filter(validHash));
}

function submissionShape(submission = {}) {
  const evidenceKeys = Array.isArray(submission.evidenceKeys) ? submission.evidenceKeys : [];
  const allBlank = blank(submission.decision) && submission.selectedPageId === null && submission.selectedTitle === null && evidenceKeys.length === 0 &&
    blank(submission.reviewer) && blank(submission.reviewedAt) && blank(submission.reviewNotes);
  return { allBlank, evidenceKeys };
}

function selectedIdentity(queue, submission) {
  const pool = submission.decision === 'confirm_exact_current_resolution' ? currentPageIdentities(queue) :
    submission.decision === 'confirm_revision_pinned_candidate_resolution' ? candidatePageIdentities(queue) : [];
  const matches = pool.filter(identity => identity.sourcePageId === submission.selectedPageId && identity.resolvedTitle === submission.selectedTitle);
  return { pool, matches, selected: matches.length === 1 ? matches[0] : null };
}

function submissionAssessment(submission = {}, queue, policy = {}, contentHash = hash) {
  const shape = submissionShape(submission);
  const expected = queue ? expectedBlankTemplate(queue, policy, contentHash) : {};
  const bindingChecks = {
    fieldSetExact: same(sorted(Object.keys(submission)), sorted(Object.keys(expected)), contentHash),
    contractMatches: submission.contract === policy.submissionContract,
    templateStateMatches: submission.state === 'blank_explicit_human_resolution_review_template',
    queueEntryMatches: submission.queueEntryKey === queue?.queueEntryKey,
    queueEntryContentHashMatches: submission.queueEntryContentHash === queue?.contentHash,
    sourceDispositionKeyMatches: submission.sourceDispositionKey === queue?.sourceDispositionKey,
    sourceDispositionRecordHashMatches: submission.sourceDispositionRecordContentHash === queue?.sourceDispositionRecordContentHash,
    sourceEvidenceRecordHashMatches: submission.sourceEvidenceRecordContentHash === queue?.sourceEvidenceRecordContentHash,
    sourceDispositionSnapshotHashMatches: submission.sourceDispositionSnapshotContentHash === queue?.sourceDispositionSnapshotContentHash,
    sourceEvidenceSnapshotHashMatches: submission.sourceEvidenceSnapshotContentHash === queue?.sourceEvidenceSnapshotContentHash,
    evidenceFingerprintMatches: submission.evidenceFingerprint === queue?.evidenceFingerprint,
    allowedDecisionsMatch: same(submission.allowedDecisions || [], queue?.allowedDecisions || [], contentHash)
  };
  const selection = selectedIdentity(queue || {}, submission);
  const confirming = ['confirm_exact_current_resolution', 'confirm_revision_pinned_candidate_resolution'].includes(submission.decision);
  const cited = allowedEvidenceKeys(queue || {}, contentHash);
  const newestSourceTime = Math.max(...sourceTimestamps(queue || {}).map(Date.parse));
  const contentChecks = shape.allBlank ? {} : {
    decisionAllowed: queue?.allowedDecisions?.includes(submission.decision) === true && policy.allowedDecisions?.includes(submission.decision) === true,
    selectedIdentityMatchesDecision: confirming ? selection.matches.length === 1 : submission.selectedPageId === null && submission.selectedTitle === null,
    selectedIdentityEvidenceCited: !confirming || (selection.selected && shape.evidenceKeys.includes(selection.selected.sourceContentHash)),
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforeNewestSource: validIsoTimestamp(submission.reviewedAt) && Number.isFinite(newestSourceTime) && Date.parse(submission.reviewedAt) >= newestSourceTime,
    reviewNotesPresent: typeof submission.reviewNotes === 'string' && submission.reviewNotes.trim().length >= 12,
    evidenceKeysPresentUniqueAndBound: shape.evidenceKeys.length > 0 && duplicates(shape.evidenceKeys).length === 0 && shape.evidenceKeys.every(key => cited.has(key))
  };
  const bindingsValid = Object.values(bindingChecks).every(Boolean);
  const contentValid = shape.allBlank || Object.values(contentChecks).every(Boolean);
  return { submission, queue, shape, bindingChecks, contentChecks, bindingsValid, contentValid, valid: Boolean(queue) && bindingsValid && contentValid, completed: !shape.allBlank && Boolean(queue) && bindingsValid && contentValid };
}

function expectedDecisionRecord(assessment, queueSnapshotContentHash, policy, contentHash = hash) {
  const { submission, queue } = assessment;
  const base = {
    contract: policy.recordContract,
    decisionKey: `${queue.queueEntryKey}|recorded-resolution-review-decision`,
    queueEntryKey: queue.queueEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceDispositionKey: queue.sourceDispositionKey,
    sourceDispositionRecordContentHash: queue.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: queue.sourceDispositionSnapshotContentHash,
    sourceEvidenceRecordContentHash: queue.sourceEvidenceRecordContentHash,
    sourceEvidenceSnapshotContentHash: queue.sourceEvidenceSnapshotContentHash,
    evidenceFingerprint: queue.evidenceFingerprint,
    renderedTargetKey: queue.renderedTargetKey,
    requestedTitles: queue.requestedTitles,
    decision: submission.decision,
    selectedPageId: submission.selectedPageId,
    selectedTitle: submission.selectedTitle,
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    reviewNotes: submission.reviewNotes.trim(),
    evidenceKeys: submission.evidenceKeys,
    reviewDecisionRecorded: true,
    resolutionDispositionApplied: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: [
      'recorded_resolution_review_decision_not_applied',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ],
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

export function buildUnresolvedRenderedTargetResolutionReviewDecisionImport({ queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const queueByKey = new Map(queueRecords.map(row => [row.queueEntryKey, row]));
  const assessments = submissions.map(row => submissionAssessment(row, queueByKey.get(row.queueEntryKey), policy, contentHash));
  const queueIntegrity = queueRecords.map(row => ({ key: row.queueEntryKey, ...queueRecordIntegrity(row, policy, contentHash) }));
  const invalid = !compileUnresolvedRenderedTargetResolutionReviewDecisionImportPolicy(policy, contentHash).valid || !validHash(queueSnapshotContentHash) ||
    queueRecords.length === 0 || duplicates(queueRecords.map(row => row.queueEntryKey)).length > 0 || queueIntegrity.some(row => !row.complete) ||
    duplicates(submissions.map(row => row.queueEntryKey)).length > 0 || assessments.some(row => !row.valid) || assessments.filter(row => row.completed).length === 0;
  const records = invalid ? [] : assessments.filter(row => row.completed).map(row => expectedDecisionRecord(row, queueSnapshotContentHash, policy, contentHash));
  const audit = auditUnresolvedRenderedTargetResolutionReviewDecisionImport(records, { queueRecords, submissions, policy, queueSnapshotContentHash, contentHash });
  return { records, audit };
}

export function auditUnresolvedRenderedTargetResolutionReviewDecisionImport(records = [], { queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const compiled = compileUnresolvedRenderedTargetResolutionReviewDecisionImportPolicy(policy, contentHash);
  const queueByKey = new Map(queueRecords.map(row => [row.queueEntryKey, row]));
  const queueIntegrity = queueRecords.map(row => ({ key: row.queueEntryKey, ...queueRecordIntegrity(row, policy, contentHash) }));
  const assessments = submissions.map(row => submissionAssessment(row, queueByKey.get(row.queueEntryKey), policy, contentHash));
  const completed = assessments.filter(row => row.completed);
  const blankSubmissions = assessments.filter(row => row.shape.allBlank);
  const invalidSubmissions = assessments.filter(row => !row.valid);
  const expectedRecords = completed.map(row => expectedDecisionRecord(row, queueSnapshotContentHash, policy, contentHash));
  const expectedByKey = new Map(expectedRecords.map(row => [row.decisionKey, row]));
  const recordKeys = records.map(row => row.decisionKey);
  const expectedKeys = expectedRecords.map(row => row.decisionKey);
  const recordMismatches = records.filter(row => !same(row, expectedByKey.get(row.decisionKey), contentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'))).map(row => row.decisionKey);
  const promotions = records.filter(row => row.resolutionDispositionApplied !== false || row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null || row.optimizerEligible !== false).map(row => row.decisionKey);
  const accountStateFindings = findUnresolvedRenderedTargetResolutionSufficiencyAccountState([...queueRecords, ...submissions, ...records]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('resolution_review_decision_import_policy_invalid_or_specific');
  if (!validHash(queueSnapshotContentHash)) structuralBlockers.push('queue_snapshot_content_hash_missing_or_invalid');
  if (!queueRecords.length || duplicates(queueRecords.map(row => row.queueEntryKey)).length || queueIntegrity.some(row => !row.complete)) structuralBlockers.push('one_or_more_queue_records_failed_revalidation');
  if (duplicates(submissions.map(row => row.queueEntryKey)).length) structuralBlockers.push('duplicate_submission_queue_entry_keys');
  if (invalidSubmissions.length) structuralBlockers.push('one_or_more_submissions_invalid_or_partially_completed');
  if (!completed.length) structuralBlockers.push('no_completed_resolution_review_submissions');
  if (duplicates(recordKeys).length || !same(sorted(recordKeys), sorted(expectedKeys), contentHash) || recordMismatches.length) structuralBlockers.push('recorded_decision_set_does_not_match_completed_submission_set');
  if (promotions.length) structuralBlockers.push('decision_import_applied_resolution_identity_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    queueCoverage: {
      queueEntryCount: queueRecords.length,
      validQueueEntryCount: queueIntegrity.filter(row => row.complete).length,
      invalidQueueEntryKeys: queueIntegrity.filter(row => !row.complete).map(row => row.key),
      duplicateQueueEntryKeys: duplicates(queueRecords.map(row => row.queueEntryKey)),
      queueSnapshotContentHashValid: validHash(queueSnapshotContentHash)
    },
    submissionCoverage: {
      submissionRowCount: submissions.length,
      completedSubmissionCount: completed.length,
      blankSubmissionCount: blankSubmissions.length,
      invalidSubmissionCount: invalidSubmissions.length,
      duplicateSubmissionQueueEntryKeys: duplicates(submissions.map(row => row.queueEntryKey)),
      unknownQueueEntryKeys: submissions.filter(row => !queueByKey.has(row.queueEntryKey)).map(row => row.queueEntryKey),
      invalidSubmissionQueueEntryKeys: invalidSubmissions.map(row => row.submission.queueEntryKey)
    },
    policyCoverage: compiled,
    bindingCoverage: {
      completedSubmissionsWithExactQueueBindings: completed.filter(row => Object.values(row.bindingChecks).every(Boolean)).length,
      completedSubmissionsWithValidContent: completed.filter(row => Object.values(row.contentChecks).every(Boolean)).length,
      boundEvidenceCitationCount: completed.reduce((sum, row) => sum + row.shape.evidenceKeys.length, 0)
    },
    recordCoverage: {
      recordedDecisionCount: records.length,
      expectedDecisionCount: expectedRecords.length,
      duplicateDecisionKeys: duplicates(recordKeys),
      missingDecisionKeys: expectedKeys.filter(key => !recordKeys.includes(key)),
      unexpectedDecisionKeys: recordKeys.filter(key => !expectedKeys.includes(key)),
      recordMismatchKeys: recordMismatches,
      decisionDistribution: Object.fromEntries((policy.allowedDecisions || []).map(decision => [decision, records.filter(row => row.decision === decision).length]))
    },
    semanticPreservationCoverage: {
      reviewDecisionRecordedCount: records.filter(row => row.reviewDecisionRecorded === true).length,
      resolutionDispositionAppliedCount: records.filter(row => row.resolutionDispositionApplied === true).length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
      unsupportedPromotionDecisionKeys: promotions
    },
    accountStateFindings,
    reviewDecisionRecordingComplete: publishable && records.length === queueRecords.length,
    resolutionApplicationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers,
      'recorded_resolution_review_decisions_require_separate_application',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}
