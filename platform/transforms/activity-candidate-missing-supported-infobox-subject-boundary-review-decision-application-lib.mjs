import { hash } from '../ingestion/lib.mjs';
import {
  buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport,
  compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy,
  expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision
} from './activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-lib.mjs';

const REQUIRED_RULES = [
  'queueAndDecisionSnapshotsMustBeExplicitlySelected',
  'queueManifestPolicyArtifactRawOuterIntrinsicAndEvidenceHashesMustRevalidate',
  'decisionManifestPolicyRawOuterIntrinsicAndQueueBindingsMustRevalidate',
  'everyDecisionMustReplayThroughTheGuardedDecisionImporter',
  'oneApplicationRecordPerDecisionInDecisionOrder',
  'applicationMayCarryOnlyTheReviewedSubjectDispositionCompositeMemberExpansionAdditionalEvidenceAndRejectionFields',
  'rejectionRemainsBoundToTheExactReviewedCandidateAndDoesNotCompleteTheUniverse',
  'additionalEvidenceRemainsAnExplicitBlocker',
  'memberExpansionRequirementDoesNotCreateOrApplyMemberIdentities',
  'applicationCannotEstablishCanonicalIdentityRepeatabilityMembershipRequirementsVariantsXpTimingMechanicsCompleteUniverseOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash({ value: left }) === contentHash({ value: right });
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|route|routes|label|labels|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|route|label|alias).*(?:override|exception)s?$/i;
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

export function compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplicationPolicy(
  policy = {}, decisionPolicy = {}, queuePolicy = {}, routingPolicy = {}, oneHopPolicy = {}, recursivePolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const inputPolicyCoverage = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy(
    decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash
  );
  const stateValues = Object.values(policy.applicationStates || {});
  const contractsValid = policy.policy === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-policy.v1'
    && policy.inputQueuePolicy === queuePolicy.policy
    && policy.inputQueuePolicyContentHash === contentHash(queuePolicy)
    && policy.inputDecisionImportPolicy === decisionPolicy.policy
    && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy)
    && policy.inputQueueDomain === queuePolicy.outputDomain
    && policy.inputDecisionDomain === 'activity-candidate-missing-supported-infobox-subject-boundary-review-decisions'
    && policy.outputDomain === 'activity-candidate-missing-supported-infobox-subject-boundary-review-decision-applications'
    && policy.queueContract === decisionPolicy.queueContract
    && policy.decisionContract === decisionPolicy.recordContract
    && policy.outputContract === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-record.v1'
    && policy.auditContract === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-audit.v1'
    && policy.requiredDecisionState === decisionPolicy.recordState;
  const statesValid = stateValues.length === 3 && unique(stateValues).length === 3
    && stateValues.every(value => typeof value === 'string' && value.length > 0);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && statesValid && inputPolicyCoverage.valid && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid,
    statesValid,
    inputPolicyCoverage,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function queueManifestAssessment(options, contentHash = hash) {
  const { queueRecords = [], queueRaw = '', queueManifest = {}, queueArtifactManifest = {}, blankTemplateRaw = '', queueSnapshot = {}, policy = {}, queuePolicy = {} } = options;
  const audit = queueManifest.source?.audit || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const artifact = (queueArtifactManifest.artifacts || []).find(row => row.file === 'decision-template.ndjson');
  const checks = {
    explicitSelection: queueSnapshot.explicit === true,
    contractAndDomainMatch: queueManifest.contract === 'sensum.ingestion-manifest.v1' && queueManifest.domain === policy.inputQueueDomain,
    snapshotBindingMatches: queueSnapshot.contentHash === queueManifest.contentHash && queueSnapshot.createdAt === queueManifest.createdAt,
    recordCountAndRawHashMatch: queueManifest.records === queueRecords.length && queueManifest.contentHash === contentHash(queueRaw),
    createdAtValid: validIsoTimestamp(queueManifest.createdAt),
    policyBindingMatches: queueManifest.source?.policy?.id === policy.inputQueuePolicy
      && queueManifest.source?.policy?.contentHash === policy.inputQueuePolicyContentHash
      && policy.inputQueuePolicy === queuePolicy.policy,
    artifactManifestValid: queueArtifactManifest.contract === 'sensum.content-addressed-artifact-manifest.v1'
      && artifact?.contentHash === contentHash(blankTemplateRaw)
      && artifact?.bytes === Buffer.byteLength(blankTemplateRaw, 'utf8'),
    queueGatesClosed: audit.contract === queuePolicy.auditContract
      && audit.queueExportComplete === true
      && audit.subjectBoundaryReviewComplete === false
      && audit.completeActivityUniverse === false
      && audit.publishable === true
      && semantic.humanDecisionRecordedCount === 0
      && semantic.optimizerEligibleCount === 0
      && semantic.automaticVerificationCount === 0,
    queueNotEmpty: queueRecords.length > 0
  };
  return { checks, complete: Object.values(checks).every(Boolean), templateArtifact: artifact || null };
}

function decisionRecordIntegrity(record = {}, policy = {}, contentHash = hash) {
  const intrinsic = without(record, 'contentHash');
  const checks = {
    contractMatches: record.contract === policy.decisionContract,
    stateMatches: record.state === policy.requiredDecisionState,
    outerHashMatches: validHash(record.contentHash) && record.contentHash === contentHash(intrinsic),
    intrinsicHashMatches: validHash(record.recordContentHash)
      && record.recordContentHash === contentHash(without(intrinsic, 'recordContentHash')),
    humanDecisionRecorded: record.reviewDecisionRecorded === true,
    semanticGatesClosed: record.semanticApplicationApplied === false
      && record.canonicalGameEntityIdentity === null
      && record.canonicalActivityIdentity === null
      && record.repeatabilityClassification === null
      && record.membershipOrVariantApplication === false
      && record.requirementsVariantsXpTimingAndMechanicsComplete === false
      && record.completeActivityUniverse === false
      && record.optimizerEligible === false
      && record.automaticVerificationApplied === false
      && record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function decisionManifestAssessment(options, contentHash = hash) {
  const {
    decisionRecords = [], decisionRaw = '', decisionManifest = {}, decisionSnapshot = {}, queueSnapshot = {},
    blankTemplateRaw = '', blankTemplates = [], policy = {}, decisionPolicy = {}
  } = options;
  const audit = decisionManifest.source?.audit || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    explicitSelection: decisionSnapshot.explicit === true,
    contractAndDomainMatch: decisionManifest.contract === 'sensum.ingestion-manifest.v1' && decisionManifest.domain === policy.inputDecisionDomain,
    snapshotBindingMatches: decisionSnapshot.contentHash === decisionManifest.contentHash && decisionSnapshot.createdAt === decisionManifest.createdAt,
    recordCountAndRawHashMatch: decisionManifest.records === decisionRecords.length && decisionManifest.contentHash === contentHash(decisionRaw),
    createdAtValid: validIsoTimestamp(decisionManifest.createdAt),
    policyBindingMatches: decisionManifest.source?.policy?.id === policy.inputDecisionImportPolicy
      && decisionManifest.source?.policy?.contentHash === policy.inputDecisionImportPolicyContentHash
      && policy.inputDecisionImportPolicy === decisionPolicy.policy,
    queuePolicyBindingMatches: decisionManifest.source?.queuePolicy?.id === policy.inputQueuePolicy
      && decisionManifest.source?.queuePolicy?.contentHash === policy.inputQueuePolicyContentHash,
    queueSnapshotBindingMatches: decisionManifest.source?.inputSnapshot?.contentHash === queueSnapshot.contentHash
      && decisionManifest.source?.inputSnapshot?.createdAt === queueSnapshot.createdAt,
    templateSnapshotBindingMatches: decisionManifest.source?.templateSnapshot?.contentHash === contentHash(blankTemplateRaw)
      && decisionManifest.source?.templateSnapshot?.rows === blankTemplates.length,
    decisionGatesValid: audit.contract === decisionPolicy.auditContract
      && audit.reviewDecisionRecordingComplete === true
      && audit.subjectBoundaryReviewComplete === false
      && audit.semanticApplicationComplete === false
      && audit.completeActivityUniverse === false
      && audit.publishable === true
      && audit.submissionCoverage?.completedDecisionCount === decisionRecords.length
      && audit.submissionCoverage?.invalidSubmissionRows?.length === 0,
    semanticGatesClosed: semantic.reviewDecisionRecordedCount === decisionRecords.length
      && semantic.semanticApplicationCount === 0
      && semantic.canonicalIdentityCount === 0
      && semantic.repeatabilityClassificationCount === 0
      && semantic.membershipOrVariantApplicationCount === 0
      && semantic.mechanicsCompletionCount === 0
      && semantic.completeActivityUniverseCount === 0
      && semantic.optimizerEligibleCount === 0
      && semantic.automaticVerificationCount === 0,
    decisionsNotEmpty: decisionRecords.length > 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function reconstructedSubmission(decision, blankTemplate) {
  return {
    ...structuredClone(blankTemplate),
    subjectDisposition: decision.subjectDisposition,
    compositeOrContainerVerdict: decision.compositeOrContainerVerdict,
    memberExpansionRequired: decision.memberExpansionRequired,
    additionalEvidenceRequired: decision.additionalEvidenceRequired,
    rejectionReason: decision.rejectionReason,
    selectedEvidenceKeys: structuredClone(decision.selectedEvidenceKeys),
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    notes: decision.notes
  };
}

function applicationFor(queue, decision, snapshots, policy, contentHash = hash) {
  const rejected = decision.subjectDisposition === 'reject_as_activity_subject';
  const unresolved = decision.additionalEvidenceRequired === true || decision.subjectDisposition === 'needs_additional_evidence';
  const applicationOutcome = unresolved
    ? 'additional_evidence_required_remains_blocked'
    : rejected
      ? 'reviewed_candidate_rejection_applied_pending_universe_reconciliation'
      : 'reviewed_subject_boundary_scope_applied_pending_identity_membership_and_mechanics';
  const state = unresolved ? policy.applicationStates.unresolved : rejected ? policy.applicationStates.excluded : policy.applicationStates.resolved;
  const base = {
    contract: policy.outputContract,
    applicationKey: `${decision.decisionKey}|subject-boundary-review-application`,
    decisionKey: decision.decisionKey,
    queueEntryKey: decision.queueEntryKey,
    candidateKey: decision.candidateKey,
    sourceQueueSnapshotContentHash: snapshots.queue.contentHash,
    sourceQueueSnapshotCreatedAt: snapshots.queue.createdAt,
    sourceDecisionSnapshotContentHash: snapshots.decision.contentHash,
    sourceDecisionSnapshotCreatedAt: snapshots.decision.createdAt,
    sourceQueueRecordContentHash: queue.recordContentHash,
    sourceQueueOuterContentHash: queue.contentHash,
    sourceDecisionRecordContentHash: decision.recordContentHash,
    sourceDecisionOuterContentHash: decision.contentHash,
    sourceBlankTemplateContentHash: decision.sourceBlankTemplateContentHash,
    applicationPolicyContentHash: contentHash(policy),
    sourcePageIdentity: structuredClone(decision.sourcePageIdentity),
    sourceBindings: structuredClone(decision.sourceBindings),
    evidenceFingerprint: decision.evidenceFingerprint,
    selectedEvidenceKeys: structuredClone(decision.selectedEvidenceKeys),
    coveredReviewObligationKeys: structuredClone(decision.coveredReviewObligationKeys),
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    notes: decision.notes,
    appliedSubjectDisposition: decision.subjectDisposition,
    appliedCompositeOrContainerVerdict: decision.compositeOrContainerVerdict,
    memberExpansionRequired: decision.memberExpansionRequired,
    additionalEvidenceRequired: decision.additionalEvidenceRequired,
    rejectionReason: decision.rejectionReason,
    subjectBoundaryApplicationApplied: true,
    authoritativeCandidateExclusionApplied: rejected && !unresolved,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    membershipOrVariantApplication: false,
    memberIdentities: [],
    memberExpansionApplied: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    applicationOutcome,
    blockers: unique([
      unresolved ? 'reviewed_subject_boundary_requires_additional_evidence' : null,
      rejected ? 'candidate_scoped_rejection_does_not_establish_complete_activity_universe' : null,
      decision.memberExpansionRequired === true ? 'reviewed_subject_requires_member_expansion_before_membership_can_be_complete' : null,
      'canonical_identity_and_repeatability_unresolved',
      'membership_requirements_variants_xp_timing_and_mechanics_unresolved',
      'independent_complete_activity_universe_not_established',
      'optimizer_eligibility_blocked'
    ].filter(Boolean)),
    state
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function evaluateInputs(options, contentHash = hash) {
  const compiled = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplicationPolicy(
    options.policy, options.decisionPolicy, options.queuePolicy, options.routingPolicy, options.oneHopPolicy, options.recursivePolicy, contentHash
  );
  const queueManifestResult = queueManifestAssessment(options, contentHash);
  const decisionManifestResult = decisionManifestAssessment(options, contentHash);
  const queueMap = new Map((options.queueRecords || []).map(record => [record.queueEntryKey, record]));
  const templateMap = new Map((options.blankTemplates || []).map(record => [record.queueEntryKey, record]));
  const decisionIntegrityFailures = (options.decisionRecords || []).map(record => ({
    decisionKey: record.decisionKey,
    result: decisionRecordIntegrity(record, options.policy, contentHash)
  })).filter(item => !item.result.complete);
  const duplicateDecisionKeys = duplicates((options.decisionRecords || []).map(record => record.decisionKey));
  const duplicateDecisionQueueKeys = duplicates((options.decisionRecords || []).map(record => record.queueEntryKey));
  const unknownDecisionQueueKeys = (options.decisionRecords || []).map(record => record.queueEntryKey).filter(key => !queueMap.has(key));
  const expectedTemplates = (options.queueRecords || []).map(queue =>
    expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(queue, options.queueSnapshot?.contentHash, options.decisionPolicy));
  const templateMismatchQueueKeys = expectedTemplates.map((template, index) =>
    same(template, options.blankTemplates?.[index], contentHash) ? null : options.queueRecords?.[index]?.queueEntryKey || `row:${index + 1}`).filter(Boolean);
  const decisionQueueBindingFailures = (options.decisionRecords || []).filter(decision => {
    const queue = queueMap.get(decision.queueEntryKey);
    const template = templateMap.get(decision.queueEntryKey);
    return !queue || !template
      || decision.candidateKey !== queue.candidateKey
      || decision.sourceQueueSnapshotContentHash !== options.queueSnapshot?.contentHash
      || decision.sourceQueueRecordContentHash !== queue.recordContentHash
      || decision.sourceQueueOuterContentHash !== queue.contentHash
      || decision.sourceBlankTemplateContentHash !== contentHash(template)
      || decision.evidenceFingerprint !== queue.evidenceFingerprint
      || !same(decision.sourcePageIdentity, queue.sourcePageIdentity, contentHash)
      || !same(decision.sourceBindings, queue.sourceBindings, contentHash);
  }).map(record => record.decisionKey || 'unknown');
  const submissions = (options.decisionRecords || []).map(decision =>
    reconstructedSubmission(decision, templateMap.get(decision.queueEntryKey) || {}));
  const replay = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport({
    queueRecords: options.queueRecords || [],
    blankTemplates: options.blankTemplates || [],
    submissions,
    policy: options.decisionPolicy,
    queuePolicy: options.queuePolicy,
    routingPolicy: options.routingPolicy,
    oneHopPolicy: options.oneHopPolicy,
    recursivePolicy: options.recursivePolicy,
    queueSnapshotContentHash: options.queueSnapshot?.contentHash || '',
    queueSnapshotCreatedAt: options.queueSnapshot?.createdAt || '',
    contentHash
  });
  const replayMismatches = (options.decisionRecords || []).filter((record, index) =>
    !replay.records[index] || !same(without(record, 'contentHash'), replay.records[index], contentHash)).map(record => record.decisionKey || 'unknown');
  const accountFindings = accountStateFindings([
    options.queueRecords || [], options.blankTemplates || [], options.decisionRecords || []
  ]);
  const structuralFailures = [];
  if (!compiled.valid) structuralFailures.push('application_policy_or_bound_input_policy_invalid');
  if (!queueManifestResult.complete) structuralFailures.push('queue_manifest_artifact_snapshot_or_gate_revalidation_failed');
  if (!decisionManifestResult.complete) structuralFailures.push('decision_manifest_snapshot_or_gate_revalidation_failed');
  if (templateMismatchQueueKeys.length) structuralFailures.push('blank_template_artifact_does_not_exactly_reproduce_selected_queue');
  if (decisionIntegrityFailures.length) structuralFailures.push('one_or_more_decision_records_failed_outer_intrinsic_or_closed_gate_revalidation');
  if (duplicateDecisionKeys.length) structuralFailures.push('duplicate_decision_keys');
  if (duplicateDecisionQueueKeys.length) structuralFailures.push('multiple_decisions_for_one_queue_entry');
  if (unknownDecisionQueueKeys.length) structuralFailures.push('one_or_more_decisions_do_not_map_to_the_selected_queue');
  if (decisionQueueBindingFailures.length) structuralFailures.push('one_or_more_decisions_do_not_match_the_exact_queue_record_and_blank_template');
  if ((options.decisionRecords || []).length !== (options.queueRecords || []).length) structuralFailures.push('decision_set_does_not_cover_the_entire_selected_queue');
  if (!replay.audit.publishable || replayMismatches.length) structuralFailures.push('guarded_decision_importer_did_not_reproduce_the_selected_decisions_exactly');
  if (!(options.decisionRecords || []).length) structuralFailures.push('no_human_decisions_selected_for_application');
  if (accountFindings.length) structuralFailures.push('current_account_state_present');
  return {
    compiled, queueManifestResult, decisionManifestResult, queueMap,
    decisionIntegrityFailures, duplicateDecisionKeys, duplicateDecisionQueueKeys, unknownDecisionQueueKeys,
    templateMismatchQueueKeys, decisionQueueBindingFailures, replay, replayMismatches, accountFindings,
    structuralFailures: unique(structuralFailures), valid: structuralFailures.length === 0
  };
}

export function auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const checked = evaluateInputs(options, contentHash);
  const expected = checked.valid ? (options.decisionRecords || []).map(decision => applicationFor(
    checked.queueMap.get(decision.queueEntryKey), decision,
    { queue: options.queueSnapshot, decision: options.decisionSnapshot }, options.policy, contentHash
  )) : [];
  const outputKeys = records.map(record => record.applicationKey);
  const expectedKeys = expected.map(record => record.applicationKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = expectedKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !expectedKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !expected[index] || !same(record, expected[index], contentHash))
    .map(record => record.applicationKey || 'unknown');
  const invalidOutcomeKeys = records.filter(record => ![
    'additional_evidence_required_remains_blocked',
    'reviewed_candidate_rejection_applied_pending_universe_reconciliation',
    'reviewed_subject_boundary_scope_applied_pending_identity_membership_and_mechanics'
  ].includes(record.applicationOutcome)).map(record => record.applicationKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.repeatabilityClassification !== null
    || record.membershipOrVariantApplication !== false
    || record.memberIdentities?.length
    || record.memberExpansionApplied !== false
    || record.requirementsVariantsXpTimingAndMechanicsComplete !== false
    || record.completeActivityUniverse !== false
    || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false).map(record => record.applicationKey || 'unknown');
  const structuralBlockers = [...checked.structuralFailures];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('application_and_selected_decision_sets_do_not_match_exactly');
  if (recordMismatches.length) structuralBlockers.push('one_or_more_application_records_do_not_match_the_replayed_review_decisions');
  if (invalidOutcomeKeys.length) structuralBlockers.push('one_or_more_application_outcomes_are_invalid');
  if (unsupportedPromotions.length) structuralBlockers.push('application_created_unsupported_identity_membership_mechanics_universe_or_optimizer_promotion');
  const accountFindings = accountStateFindings([options.queueRecords || [], options.decisionRecords || [], records]);
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = checked.valid && unique(structuralBlockers).length === 0;
  const additionalEvidenceKeys = records.filter(record => record.additionalEvidenceRequired).map(record => record.applicationKey);
  const rejectedKeys = records.filter(record => record.authoritativeCandidateExclusionApplied).map(record => record.applicationKey);
  const memberExpansionKeys = records.filter(record => record.memberExpansionRequired === true).map(record => record.applicationKey);
  const applicationBatchComplete = publishable && records.length > 0 && records.length === (options.decisionRecords || []).length;
  const subjectBoundaryReviewComplete = applicationBatchComplete
    && records.length === (options.queueRecords || []).length && additionalEvidenceKeys.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyCoverage: checked.compiled,
    queueCoverage: {
      queueRecordCount: (options.queueRecords || []).length,
      explicitSnapshotSelected: options.queueSnapshot?.explicit === true,
      snapshotContentHash: options.queueSnapshot?.contentHash || null,
      snapshotCreatedAt: options.queueSnapshot?.createdAt || null,
      manifestAssessment: checked.queueManifestResult,
      blankTemplateRecordCount: (options.blankTemplates || []).length,
      templateMismatchQueueKeys: checked.templateMismatchQueueKeys
    },
    decisionCoverage: {
      decisionRecordCount: (options.decisionRecords || []).length,
      explicitSnapshotSelected: options.decisionSnapshot?.explicit === true,
      snapshotContentHash: options.decisionSnapshot?.contentHash || null,
      snapshotCreatedAt: options.decisionSnapshot?.createdAt || null,
      manifestAssessment: checked.decisionManifestResult,
      failedDecisionRecordKeys: checked.decisionIntegrityFailures.map(item => item.decisionKey),
      duplicateDecisionKeys: checked.duplicateDecisionKeys,
      duplicateDecisionQueueKeys: checked.duplicateDecisionQueueKeys,
      unknownDecisionQueueKeys: checked.unknownDecisionQueueKeys,
      queueBindingFailureDecisionKeys: checked.decisionQueueBindingFailures
    },
    replayCoverage: {
      replayPublishable: checked.replay.audit.publishable,
      replayedDecisionCount: checked.replay.records.length,
      replayMismatchDecisionKeys: checked.replayMismatches
    },
    applicationCoverage: {
      applicationRecordCount: records.length,
      duplicateOutputKeys,
      missingOutputKeys,
      unexpectedOutputKeys,
      recordMismatches,
      invalidOutcomeKeys,
      resolvedScopeCount: records.filter(record => !record.additionalEvidenceRequired && !record.authoritativeCandidateExclusionApplied).length,
      candidateScopedRejectionCount: rejectedKeys.length,
      candidateScopedRejectionApplicationKeys: rejectedKeys,
      additionalEvidenceBlockedCount: additionalEvidenceKeys.length,
      additionalEvidenceApplicationKeys: additionalEvidenceKeys,
      memberExpansionRequiredCount: memberExpansionKeys.length,
      memberExpansionRequiredApplicationKeys: memberExpansionKeys
    },
    semanticPreservationCoverage: {
      subjectBoundaryApplicationCount: records.filter(record => record.subjectBoundaryApplicationApplied).length,
      canonicalIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.repeatabilityClassification !== null).length,
      membershipOrVariantApplicationCount: records.filter(record => record.membershipOrVariantApplication).length,
      memberIdentityCount: records.reduce((sum, record) => sum + (record.memberIdentities?.length || 0), 0),
      memberExpansionAppliedCount: records.filter(record => record.memberExpansionApplied).length,
      mechanicsCompletionCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete).length,
      completeActivityUniverseCount: records.filter(record => record.completeActivityUniverse).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    applicationBatchComplete,
    subjectBoundaryReviewComplete,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      additionalEvidenceKeys.length ? 'one_or_more_subject_boundary_reviews_require_additional_evidence' : null,
      rejectedKeys.length ? 'one_or_more_candidate_scoped_rejections_require_complete_universe_reconciliation' : null,
      memberExpansionKeys.length ? 'one_or_more_reviewed_subjects_require_member_expansion' : null,
      'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved',
      'independent_complete_activity_universe_not_established',
      'optimizer_eligibility_blocked'
    ].filter(Boolean)),
    publishable
  };
}

export function buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications(options = {}) {
  const contentHash = options.contentHash || hash;
  const checked = evaluateInputs(options, contentHash);
  const records = checked.valid ? (options.decisionRecords || []).map(decision => applicationFor(
    checked.queueMap.get(decision.queueEntryKey), decision,
    { queue: options.queueSnapshot, decision: options.decisionSnapshot }, options.policy, contentHash
  )) : [];
  return {
    records,
    audit: auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications(records, { ...options, contentHash })
  };
}
