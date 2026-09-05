import { hash } from '../ingestion/lib.mjs';
import { findUnresolvedRenderedTargetResolutionSufficiencyAccountState } from './cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-lib.mjs';

const REQUIRED_RULES = [
  'oneRecordedDecisionPerCompletedSubmission', 'partialReviewBatchesAreAllowed', 'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected', 'anyInvalidRowRejectsTheEntireBatch',
  'queueManifestIntrinsicRecordTemplateEvidenceAndSnapshotHashesMustRevalidate',
  'submissionMustMatchEveryImmutableQueueBinding', 'submissionFieldSetMustExactlyMatchTheBlankTemplate',
  'decisionMustBeExplicitlyAllowedByTheBoundQueueEntryAndReviewRoute',
  'confirmedResolutionMustMatchTheExactBoundCategoryIdentity', 'nonConfirmationDecisionsMustNotSelectAResolution',
  'reviewerReviewedAtNotesAndBoundEvidenceKeysAreRequired', 'reviewedAtMustNotPrecedeTheNewestBoundSourceTimestamp',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingADecisionDoesNotApplyResolutionCanonicalIdentityRepeatabilityRequirementsVariantsXpTimingMechanicsOrOptimizerState',
  'titlesPageIdsRevisionsCategoryNamesAndOverridesCannotAlterPolicyBehavior', 'currentAccountStateIsForbidden'
];
const EXPECTED_DECISIONS = [
  'confirm_exact_current_category_page_resolution', 'confirm_active_redlink_category_target',
  'reject_exact_current_category_page_resolution', 'reject_active_redlink_category_target', 'needs_additional_evidence'
];
const ROUTES = {
  described_category_page_resolution_review_ready: {
    reviewRoute: 'explicit_source_bound_described_category_page_resolution_review',
    decisions: ['confirm_exact_current_category_page_resolution', 'reject_exact_current_category_page_resolution', 'needs_additional_evidence']
  },
  active_redlink_category_target_resolution_review_ready: {
    reviewRoute: 'explicit_source_bound_redlink_category_target_resolution_review',
    decisions: ['confirm_active_redlink_category_target', 'reject_active_redlink_category_target', 'needs_additional_evidence']
  }
};
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:titleOverrides|pageIdOverrides|revisionOverrides|categoryOverrides|candidateNameOverrides|overrides|exceptions)$/i;
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

export function compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImportPolicy(policy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-import-policy.v1' &&
    policy.queueContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-entry.v1' &&
    policy.submissionContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-template.v1' &&
    policy.recordContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision.v1' &&
    policy.auditContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-import-audit.v1' &&
    policy.queueState === 'pending_explicit_source_bound_category_target_resolution_review' &&
    policy.templateState === 'blank_source_bound_category_target_resolution_review_decision' &&
    policy.recordState === 'recorded_source_bound_category_target_resolution_review_decision_pending_resolution_application';
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

function expectedResolution(queue = {}) {
  const state = queue.categoryEvidence?.currentCategoryState || {};
  if (queue.classification === 'active_redlink_category_target_resolution_review_ready') {
    return { kind: 'active_redlink_category_target', namespaceId: queue.categoryEvidence?.namespace?.namespaceId, title: queue.requestedTitles?.[0] };
  }
  const page = state.currentPageIdentity;
  if (queue.classification === 'described_category_page_resolution_review_ready' && page) {
    return { kind: 'exact_current_category_description_page', sourcePageId: page.sourcePageId, namespaceId: page.namespaceId, resolvedTitle: page.resolvedTitle, sourceRevision: page.sourceRevision, sourceContentHash: page.sourceContentHash };
  }
  return null;
}

function expectedBlankTemplate(queue = {}) {
  return queue.decisionTemplate || {};
}

function categoryEvidenceValid(queue = {}, contentHash = hash) {
  const evidence = queue.categoryEvidence || {};
  const state = evidence.currentCategoryState || {};
  const bindings = evidence.evidenceBindings || {};
  const route = ROUTES[queue.classification];
  const routeValid = route && queue.reviewRoute === route.reviewRoute && same(queue.allowedDecisions || [], route.decisions, contentHash);
  const hashes = [
    evidence.namespace?.evidenceContentHash, state.evidenceContentHash, evidence.prefixInventory?.evidenceContentHash,
    evidence.memberInventory?.evidenceContentHash, evidence.namespaceSearch?.evidenceContentHash, evidence.titleHistory?.evidenceContentHash,
    ...(evidence.pinnedGuideRevalidations || []).map(row => row.evidenceContentHash), ...(bindings.newEvidenceKeys || [])
  ];
  const shapeValid = queue.classification === 'active_redlink_category_target_resolution_review_ready'
    ? state.categoryExistsByApiState === true && state.pageDescriptionExists === false && state.redlinkCategoryState === true && state.currentPageIdentity === null &&
      state.currentMissingPage?.namespaceId === 14 && state.currentMissingPage?.title === queue.requestedTitles?.[0] &&
      evidence.prefixInventory?.exactBaseTitlePresent === true && evidence.memberInventory?.memberCount > 0
    : queue.classification === 'described_category_page_resolution_review_ready' && state.pageDescriptionExists === true && state.redlinkCategoryState === false &&
      Number.isInteger(state.currentPageIdentity?.sourcePageId) && state.currentPageIdentity.sourcePageId > 0 && validHash(state.currentPageIdentity?.sourceContentHash) &&
      validIsoTimestamp(state.currentPageIdentity?.sourceTimestamp) && state.currentPageIdentity?.resolvedTitle === queue.requestedTitles?.[0];
  const membersValid = Array.isArray(evidence.memberInventory?.members) && evidence.memberInventory.memberCount === evidence.memberInventory.members.length &&
    evidence.memberInventory.members.every(member => validHash(member.sourceIdentity?.sourceContentHash) && validIsoTimestamp(member.sourceIdentity?.sourceTimestamp) && Array.isArray(member.exactCategoryOccurrences) && member.exactCategoryOccurrences.length > 0);
  const memberGuideBindingsValid = membersValid && evidence.memberInventory.members.every(member => {
    const matches = (evidence.pinnedGuideRevalidations || []).filter(guide => guide.sourceIdentity?.sourcePageId === member.sourceIdentity?.sourcePageId && guide.sourceIdentity?.resolvedTitle === member.sourceIdentity?.resolvedTitle);
    return matches.length === 1 && same(matches[0].sourceIdentity, member.sourceIdentity, contentHash) && same(matches[0].exactCategoryOccurrences, member.exactCategoryOccurrences, contentHash);
  });
  const evidenceBindingMapValid = bindings.namespaceMetadataEvidenceContentHash === evidence.namespace?.evidenceContentHash &&
    bindings.exactCurrentCategoryEvidenceContentHash === state.evidenceContentHash &&
    bindings.categoryPrefixEvidenceContentHash === evidence.prefixInventory?.evidenceContentHash &&
    bindings.categoryMemberEvidenceContentHash === evidence.memberInventory?.evidenceContentHash &&
    bindings.namespaceSearchEvidenceContentHash === evidence.namespaceSearch?.evidenceContentHash &&
    bindings.titleHistoryEvidenceContentHash === evidence.titleHistory?.evidenceContentHash &&
    same(bindings.pinnedGuideRevalidationContentHashes || [], (evidence.pinnedGuideRevalidations || []).map(row => row.evidenceContentHash), contentHash);
  const template = expectedBlankTemplate(queue);
  return routeValid && shapeValid && evidence.namespace?.namespaceId === 14 && membersValid && memberGuideBindingsValid && evidenceBindingMapValid && hashes.length > 0 && hashes.every(validHash) &&
    validHash(template.templateContentHash) && contentHash(without(template, 'templateContentHash')) === template.templateContentHash &&
    template.contract === queue.decisionTemplate?.contract && template.queueEntryKey === queue.queueEntryKey && template.evidenceFingerprint === queue.evidenceFingerprint &&
    template.state === 'blank_source_bound_category_target_resolution_review_decision' && template.decision === null && template.selectedResolution === null &&
    template.reviewer === null && template.reviewedAt === null && template.reviewNotes === null && Array.isArray(template.evidenceKeys) && template.evidenceKeys.length === 0;
}

function queueRecordIntegrity(queue = {}, policy = {}, contentHash = hash) {
  const checks = {
    contractMatches: queue.contract === policy.queueContract,
    stateMatches: queue.state === policy.queueState,
    intrinsicRecordHashMatches: validHash(queue.recordContentHash) && contentHash(without(queue, 'recordContentHash', 'contentHash')) === queue.recordContentHash,
    snapshotContentHashMatches: validHash(queue.contentHash) && contentHash(without(queue, 'contentHash')) === queue.contentHash,
    immutableBindingsPresent: [queue.sourceDispositionRecordContentHash, queue.sourceDispositionSnapshotContentHash, queue.sourceEvidencePacketRecordContentHash, queue.sourceEvidencePacketSnapshotContentHash, queue.evidenceFingerprint].every(validHash),
    keysPresent: [queue.queueEntryKey, queue.sourceDispositionKey, queue.sourceEvidencePacketKey, queue.renderedTargetKey].every(value => typeof value === 'string' && value.length > 0),
    titlesPresent: Array.isArray(queue.requestedTitles) && queue.requestedTitles.length === 1,
    categoryEvidenceValid: categoryEvidenceValid(queue, contentHash),
    semanticGatesClosed: queue.selectedResolution === null && queue.canonicalGameEntityIdentity === null && queue.canonicalActivityIdentity === null && queue.repeatabilityClassification === null && queue.mechanicsReviewComplete === false && queue.optimizerEligible === false && queue.automaticVerificationApplied === false,
    accountIndependent: queue.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function sourceTimestamps(queue = {}) {
  const evidence = queue.categoryEvidence || {};
  return [
    evidence.currentCategoryState?.currentPageIdentity?.sourceTimestamp,
    ...(evidence.memberInventory?.members || []).map(row => row.sourceIdentity?.sourceTimestamp),
    ...(evidence.pinnedGuideRevalidations || []).map(row => row.sourceIdentity?.sourceTimestamp),
    ...(evidence.titleHistory?.events || []).map(row => row.timestamp)
  ].filter(validIsoTimestamp);
}

function allowedEvidenceKeys(queue = {}) {
  const evidence = queue.categoryEvidence || {};
  const values = [
    queue.contentHash, queue.recordContentHash, queue.sourceDispositionRecordContentHash, queue.sourceDispositionSnapshotContentHash,
    queue.sourceEvidencePacketRecordContentHash, queue.sourceEvidencePacketSnapshotContentHash, queue.evidenceFingerprint,
    queue.decisionTemplate?.templateContentHash, ...(evidence.evidenceBindings?.newEvidenceKeys || []),
    evidence.currentCategoryState?.currentPageIdentity?.sourceContentHash,
    ...(evidence.memberInventory?.members || []).flatMap(row => [row.sourceIdentity?.sourceContentHash, ...(row.exactCategoryOccurrences || []).map(item => item.exactSourceTextContentHash)]),
    ...(evidence.pinnedGuideRevalidations || []).flatMap(row => [row.evidenceContentHash, row.sourceIdentity?.sourceContentHash, ...(row.exactCategoryOccurrences || []).map(item => item.exactSourceTextContentHash)])
  ];
  return new Set(values.filter(validHash));
}

function submissionShape(submission = {}) {
  const evidenceKeys = Array.isArray(submission.evidenceKeys) ? submission.evidenceKeys : [];
  const allBlank = blank(submission.decision) && submission.selectedResolution === null && evidenceKeys.length === 0 && blank(submission.reviewer) && blank(submission.reviewedAt) && blank(submission.reviewNotes);
  return { allBlank, evidenceKeys };
}

function submissionAssessment(submission = {}, queue, policy = {}, contentHash = hash) {
  const shape = submissionShape(submission);
  const template = expectedBlankTemplate(queue || {});
  const editable = new Set(['decision', 'selectedResolution', 'evidenceKeys', 'reviewer', 'reviewedAt', 'reviewNotes']);
  const immutableKeys = Object.keys(template).filter(key => !editable.has(key));
  const bindingChecks = {
    fieldSetExact: same(sorted(Object.keys(submission)), sorted(Object.keys(template)), contentHash),
    immutableTemplateFieldsMatch: immutableKeys.every(key => same(submission[key], template[key], contentHash)),
    contractMatches: submission.contract === policy.submissionContract,
    templateStateMatches: submission.state === policy.templateState,
    templateHashMatches: submission.templateContentHash === template.templateContentHash,
    queueEntryMatches: submission.queueEntryKey === queue?.queueEntryKey,
    routeAndClassificationMatch: submission.reviewRoute === queue?.reviewRoute && submission.classification === queue?.classification,
    allowedDecisionsMatch: same(submission.allowedDecisions || [], queue?.allowedDecisions || [], contentHash)
  };
  const route = ROUTES[queue?.classification];
  const confirming = String(submission.decision || '').startsWith('confirm_');
  const expected = expectedResolution(queue || {});
  const cited = allowedEvidenceKeys(queue || {});
  const newestSourceTime = Math.max(...sourceTimestamps(queue || {}).map(Date.parse));
  const requiredResolutionEvidenceHash = queue?.categoryEvidence?.currentCategoryState?.evidenceContentHash;
  const contentChecks = shape.allBlank ? {} : {
    decisionAllowed: route?.decisions.includes(submission.decision) === true && queue?.allowedDecisions?.includes(submission.decision) === true && policy.allowedDecisions?.includes(submission.decision) === true,
    selectedResolutionMatchesDecision: confirming ? expected !== null && same(submission.selectedResolution, expected, contentHash) : submission.selectedResolution === null,
    selectedResolutionEvidenceCited: !confirming || (validHash(requiredResolutionEvidenceHash) && shape.evidenceKeys.includes(requiredResolutionEvidenceHash)),
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforeNewestSource: validIsoTimestamp(submission.reviewedAt) && Number.isFinite(newestSourceTime) && Date.parse(submission.reviewedAt) >= newestSourceTime,
    reviewNotesPresent: typeof submission.reviewNotes === 'string' && submission.reviewNotes.trim().length >= 12,
    evidenceKeysPresentUniqueAndBound: shape.evidenceKeys.length > 0 && duplicates(shape.evidenceKeys).length === 0 && shape.evidenceKeys.every(key => cited.has(key))
  };
  const bindingsValid = Object.values(bindingChecks).every(Boolean);
  const contentValid = shape.allBlank || Object.values(contentChecks).every(Boolean);
  return { submission, queue, shape, bindingChecks, contentChecks, valid: Boolean(queue) && bindingsValid && contentValid, completed: !shape.allBlank && Boolean(queue) && bindingsValid && contentValid };
}

function expectedDecisionRecord(assessment, queueSnapshotContentHash, policy, contentHash = hash) {
  const { submission, queue } = assessment;
  const base = {
    contract: policy.recordContract,
    decisionKey: `${queue.queueEntryKey}|recorded-category-target-resolution-review-decision`,
    queueEntryKey: queue.queueEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceTemplateContentHash: queue.decisionTemplate.templateContentHash,
    sourceDispositionKey: queue.sourceDispositionKey,
    sourceDispositionRecordContentHash: queue.sourceDispositionRecordContentHash,
    sourceDispositionSnapshotContentHash: queue.sourceDispositionSnapshotContentHash,
    sourceEvidencePacketKey: queue.sourceEvidencePacketKey,
    sourceEvidencePacketRecordContentHash: queue.sourceEvidencePacketRecordContentHash,
    sourceEvidencePacketSnapshotContentHash: queue.sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprint: queue.evidenceFingerprint,
    renderedTargetKey: queue.renderedTargetKey,
    requestedTitles: queue.requestedTitles,
    classification: queue.classification,
    reviewRoute: queue.reviewRoute,
    decision: submission.decision,
    selectedResolution: submission.selectedResolution,
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    reviewNotes: submission.reviewNotes.trim(),
    evidenceKeys: submission.evidenceKeys,
    reviewDecisionRecorded: true,
    resolutionDispositionApplied: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: ['recorded_category_target_resolution_review_decision_not_applied', 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'optimizer_eligibility_blocked'],
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

export function buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport({ queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const queueByKey = new Map(queueRecords.map(row => [row.queueEntryKey, row]));
  const assessments = submissions.map(row => submissionAssessment(row, queueByKey.get(row.queueEntryKey), policy, contentHash));
  const queueIntegrity = queueRecords.map(row => ({ key: row.queueEntryKey, ...queueRecordIntegrity(row, policy, contentHash) }));
  const invalid = !compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImportPolicy(policy, contentHash).valid || !validHash(queueSnapshotContentHash) ||
    queueRecords.length === 0 || duplicates(queueRecords.map(row => row.queueEntryKey)).length > 0 || queueIntegrity.some(row => !row.complete) ||
    duplicates(submissions.map(row => row.queueEntryKey)).length > 0 || assessments.some(row => !row.valid) || assessments.filter(row => row.completed).length === 0;
  const records = invalid ? [] : assessments.filter(row => row.completed).map(row => expectedDecisionRecord(row, queueSnapshotContentHash, policy, contentHash));
  return { records, audit: auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport(records, { queueRecords, submissions, policy, queueSnapshotContentHash, contentHash }) };
}

export function auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport(records = [], { queueRecords = [], submissions = [], policy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const compiled = compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImportPolicy(policy, contentHash);
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
  const promotions = records.filter(row => row.resolutionDispositionApplied !== false || row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null || row.mechanicsReviewComplete !== false || row.optimizerEligible !== false || row.automaticVerificationApplied !== false).map(row => row.decisionKey);
  const accountStateFindings = findUnresolvedRenderedTargetResolutionSufficiencyAccountState([...queueRecords, ...submissions, ...records]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('category_resolution_review_decision_import_policy_invalid_or_specific');
  if (!validHash(queueSnapshotContentHash)) structuralBlockers.push('queue_snapshot_content_hash_missing_or_invalid');
  if (!queueRecords.length || duplicates(queueRecords.map(row => row.queueEntryKey)).length || queueIntegrity.some(row => !row.complete)) structuralBlockers.push('one_or_more_queue_records_failed_revalidation');
  if (duplicates(submissions.map(row => row.queueEntryKey)).length) structuralBlockers.push('duplicate_submission_queue_entry_keys');
  if (invalidSubmissions.length) structuralBlockers.push('one_or_more_submissions_invalid_or_partially_completed');
  if (!completed.length) structuralBlockers.push('no_completed_category_resolution_review_submissions');
  if (duplicates(recordKeys).length || !same(sorted(recordKeys), sorted(expectedKeys), contentHash) || recordMismatches.length) structuralBlockers.push('recorded_decision_set_does_not_match_completed_submission_set');
  if (promotions.length) structuralBlockers.push('decision_import_applied_resolution_identity_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    queueCoverage: { queueEntryCount: queueRecords.length, validQueueEntryCount: queueIntegrity.filter(row => row.complete).length, invalidQueueEntryKeys: queueIntegrity.filter(row => !row.complete).map(row => row.key), duplicateQueueEntryKeys: duplicates(queueRecords.map(row => row.queueEntryKey)), queueSnapshotContentHashValid: validHash(queueSnapshotContentHash) },
    submissionCoverage: { submissionRowCount: submissions.length, completedSubmissionCount: completed.length, blankSubmissionCount: blankSubmissions.length, invalidSubmissionCount: invalidSubmissions.length, duplicateSubmissionQueueEntryKeys: duplicates(submissions.map(row => row.queueEntryKey)), unknownQueueEntryKeys: submissions.filter(row => !queueByKey.has(row.queueEntryKey)).map(row => row.queueEntryKey), invalidSubmissionQueueEntryKeys: invalidSubmissions.map(row => row.submission.queueEntryKey) },
    policyCoverage: compiled,
    bindingCoverage: { completedSubmissionsWithExactQueueBindings: completed.filter(row => Object.values(row.bindingChecks).every(Boolean)).length, completedSubmissionsWithValidContent: completed.filter(row => Object.values(row.contentChecks).every(Boolean)).length, boundEvidenceCitationCount: completed.reduce((sum, row) => sum + row.shape.evidenceKeys.length, 0) },
    recordCoverage: { recordedDecisionCount: records.length, expectedDecisionCount: expectedRecords.length, duplicateDecisionKeys: duplicates(recordKeys), missingDecisionKeys: expectedKeys.filter(key => !recordKeys.includes(key)), unexpectedDecisionKeys: recordKeys.filter(key => !expectedKeys.includes(key)), recordMismatchKeys: recordMismatches, decisionDistribution: Object.fromEntries((policy.allowedDecisions || []).map(decision => [decision, records.filter(row => row.decision === decision).length])) },
    semanticPreservationCoverage: { reviewDecisionRecordedCount: records.filter(row => row.reviewDecisionRecorded === true).length, resolutionDispositionAppliedCount: records.filter(row => row.resolutionDispositionApplied === true).length, selectedResolutionRecordedCount: records.filter(row => row.selectedResolution !== null).length, canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length, canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length, repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length, mechanicsReviewCompleteCount: records.filter(row => row.mechanicsReviewComplete === true).length, optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length, automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length, unsupportedPromotionDecisionKeys: promotions },
    accountStateFindings,
    reviewDecisionRecordingComplete: publishable && records.length === queueRecords.length,
    resolutionApplicationComplete: false,
    canonicalIdentityComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers, 'recorded_category_resolution_review_decisions_require_separate_application', 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'independent_complete_activity_universe_not_established']),
    publishable
  };
}
