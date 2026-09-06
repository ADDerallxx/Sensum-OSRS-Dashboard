import { hash } from '../ingestion/lib.mjs';
import { compileActivityCandidatePriorityHumanReviewPacketPolicy } from './activity-candidate-priority-human-review-packet-consolidation-lib.mjs';
import {
  buildActivityCandidatePriorityHumanReviewDecisionImport,
  compileActivityCandidatePriorityHumanReviewDecisionImportPolicy
} from './activity-candidate-priority-human-review-decision-import-lib.mjs';

const PACKET_DOMAIN = 'activity-candidate-priority-human-review-packet';
const DECISION_DOMAIN = 'activity-candidate-priority-human-review-decisions';
const REQUIRED_RULES = [
  'packetAndDecisionSnapshotsMustBeExplicitlySelected',
  'packetManifestPolicyRawOuterIntrinsicAndEmbeddedPipelineBindingsMustRevalidate',
  'decisionManifestPolicyRawOuterIntrinsicAndPacketBindingsMustRevalidate',
  'everyDecisionMustReplayThroughTheGuardedHumanDecisionImporter',
  'oneApplicationRecordPerDecisionInDecisionOrder',
  'partialDecisionSetsMayProducePartialApplicationSnapshotsButCannotCompleteReview',
  'confirmedReviewConclusionsMayApplyOnlyTheirRevisionPinnedPacketProjection',
  'rejectedReviewConclusionsCreateExplicitAuthoritativeExclusions',
  'additionalEvidenceConclusionsRemainExplicitBlockers',
  'memberExpansionRequirementMayApplyButMemberKeysAndMemberUniverseCompletionRemainForbidden',
  'applicationCannotEstablishRequirementsVariantsXpTimingMechanicsCompleteUniverseOrOptimizerState',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
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

export function compileActivityCandidatePriorityHumanReviewDecisionApplicationPolicy(
  policy = {}, packetPolicy = {}, decisionPolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const packetPolicyCoverage = compileActivityCandidatePriorityHumanReviewPacketPolicy(packetPolicy);
  const decisionPolicyCoverage = compileActivityCandidatePriorityHumanReviewDecisionImportPolicy(decisionPolicy);
  const contractsValid = policy.policy === 'sensum.activity-candidate-priority-human-review-decision-application-policy.v1'
    && policy.packetContract === packetPolicy.packetContract
    && policy.decisionContract === decisionPolicy.recordContract
    && policy.outputContract === 'sensum.activity-candidate-priority-human-review-decision-application-record.v1'
    && policy.auditContract === 'sensum.activity-candidate-priority-human-review-decision-application-audit.v1'
    && policy.inputPacketPolicy === packetPolicy.policy
    && policy.inputPacketPolicyContentHash === contentHash(packetPolicy)
    && policy.inputDecisionImportPolicy === decisionPolicy.policy
    && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy)
    && policy.requiredDecisionState === decisionPolicy.recordState;
  const statesValid = [policy.appliedCandidateState, policy.excludedCandidateState, policy.unresolvedCandidateState]
    .every(value => typeof value === 'string' && value.length > 0)
    && unique([policy.appliedCandidateState, policy.excludedCandidateState, policy.unresolvedCandidateState]).length === 3;
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && statesValid && packetPolicyCoverage.valid && decisionPolicyCoverage.valid
      && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid,
    statesValid,
    packetPolicyCoverage,
    decisionPolicyCoverage,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function packetManifestAssessment(records, raw, manifest, snapshot, policy, contentHash = hash) {
  const audit = manifest?.source?.audit || {};
  const packets = audit.packetCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    explicitSelection: snapshot?.explicit === true,
    contractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === PACKET_DOMAIN,
    snapshotBindingMatches: snapshot?.contentHash === manifest?.contentHash && snapshot?.createdAt === manifest?.createdAt,
    recordCountAndRawHashMatch: manifest?.records === records.length && typeof raw === 'string'
      && contentHash(raw) === manifest?.contentHash,
    createdAtValid: validIsoTimestamp(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policy.inputPacketPolicy
      && manifest?.source?.policy?.contentHash === policy.inputPacketPolicyContentHash,
    packetGateAndCoverageMatch: audit.packetConsolidationComplete === true
      && audit.humanReviewComplete === false
      && audit.requirementsVariantsXpTimingAndMechanicsComplete === false
      && audit.completeActivityUniverse === false
      && audit.publishable === true
      && packets.packetCount === records.length
      && packets.completePacketCount === records.length
      && packets.packetMismatchCandidateKeys?.length === 0,
    semanticGatesClosed: semantic.nonBlankDecisionCandidateKeys?.length === 0
      && semantic.canonicalGameEntityIdentityCount === 0
      && semantic.canonicalActivityIdentityCount === 0
      && semantic.repeatabilityClassificationCount === 0
      && semantic.atomicityClassificationCount === 0
      && semantic.memberExpansionReviewedCount === 0
      && semantic.requirementsVariantsXpTimingAndMechanicsCompleteCount === 0
      && semantic.optimizerEligibleCount === 0
      && semantic.automaticVerificationCount === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
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
    semanticGatesStillClosed: record.semanticApplicationApplied === false
      && record.canonicalGameEntityIdentity === null
      && record.canonicalActivityIdentity === null
      && record.repeatabilityClassification === null
      && record.atomicityClassification === null
      && record.memberExpansionApplied === false
      && Array.isArray(record.memberKeys) && record.memberKeys.length === 0
      && record.requirementsVariantsXpTimingAndMechanicsComplete === false
      && record.optimizerEligible === false
      && record.automaticVerificationApplied === false
      && record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean), intrinsic };
}

function decisionManifestAssessment(records, raw, manifest, snapshot, packetSnapshot, policy, contentHash = hash) {
  const audit = manifest?.source?.audit || {};
  const coverage = audit.recordCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    explicitSelection: snapshot?.explicit === true,
    contractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === DECISION_DOMAIN,
    snapshotBindingMatches: snapshot?.contentHash === manifest?.contentHash && snapshot?.createdAt === manifest?.createdAt,
    recordCountAndRawHashMatch: manifest?.records === records.length && typeof raw === 'string'
      && contentHash(raw) === manifest?.contentHash,
    createdAtValid: validIsoTimestamp(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policy.inputDecisionImportPolicy
      && manifest?.source?.policy?.contentHash === policy.inputDecisionImportPolicyContentHash,
    packetPolicyBindingMatches: manifest?.source?.packetPolicy?.id === policy.inputPacketPolicy
      && manifest?.source?.packetPolicy?.contentHash === policy.inputPacketPolicyContentHash,
    selectedPacketSnapshotMatches: manifest?.source?.inputSnapshot?.contentHash === packetSnapshot?.contentHash
      && manifest?.source?.inputSnapshot?.createdAt === packetSnapshot?.createdAt,
    decisionGateAndCoverageMatch: audit.publishable === true
      && audit.reviewDecisionRecordingComplete === true
      && audit.humanReviewComplete === false
      && audit.requirementsVariantsXpTimingAndMechanicsComplete === false
      && audit.completeActivityUniverse === false
      && coverage.recordedDecisionCount === records.length
      && coverage.duplicateOutputKeys?.length === 0
      && coverage.missingOutputKeys?.length === 0
      && coverage.unexpectedOutputKeys?.length === 0
      && coverage.recordMismatches?.length === 0,
    semanticGatesClosed: semantic.semanticApplicationAppliedCount === 0
      && semantic.appliedCanonicalGameEntityIdentityCount === 0
      && semantic.appliedCanonicalActivityIdentityCount === 0
      && semantic.appliedRepeatabilityOrAtomicityCount === 0
      && semantic.appliedMemberExpansionCount === 0
      && semantic.requirementsVariantsXpTimingAndMechanicsCompleteCount === 0
      && semantic.optimizerEligibleCount === 0
      && semantic.automaticVerificationCount === 0
      && semantic.unsupportedPromotions?.length === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function reconstructedSubmission(decision, packet) {
  return {
    ...structuredClone(packet.decisionTemplate),
    subjectDispositionDecision: decision.subjectDispositionDecision,
    selectedSourceDisposition: decision.selectedSourceDisposition,
    canonicalGameEntityIdentityDecision: decision.canonicalGameEntityIdentityDecision,
    canonicalGameEntityIdentity: structuredClone(decision.reviewedCanonicalGameEntityIdentityProposal),
    canonicalActivityIdentityDecision: decision.canonicalActivityIdentityDecision,
    canonicalActivityIdentity: structuredClone(decision.reviewedCanonicalActivityIdentityProposal),
    repeatabilityDecision: decision.repeatabilityDecision,
    atomicityDecision: decision.atomicityDecision,
    memberExpansionDecision: decision.memberExpansionDecision,
    memberKeys: structuredClone(decision.memberKeys),
    evidenceDomainAssessments: structuredClone(decision.evidenceDomainAssessments),
    reviewEvidenceKeys: structuredClone(decision.reviewEvidenceKeys),
    reviewedSourceRevisions: structuredClone(decision.reviewedSourceRevisions),
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes
  };
}

function applicationFor(packet, decision, snapshots, policy, contentHash = hash) {
  const assessments = structuredClone(decision.evidenceDomainAssessments || []);
  const additionalEvidenceDomains = assessments.filter(item => item.status === 'additional_evidence_required').map(item => item.domain).sort();
  const unsupportedEvidenceDomains = assessments.filter(item => item.status === 'not_supported_by_bound_evidence').map(item => item.domain).sort();
  const decisionAdditional = [
    decision.subjectDispositionDecision,
    decision.canonicalGameEntityIdentityDecision,
    decision.canonicalActivityIdentityDecision,
    decision.repeatabilityDecision,
    decision.atomicityDecision,
    decision.memberExpansionDecision
  ].includes('additional_evidence_required');
  const reviewAdditional = decisionAdditional || additionalEvidenceDomains.length > 0;
  const reviewRejected = decision.subjectDispositionDecision === 'reject_all_bound_source_dispositions'
    || decision.canonicalGameEntityIdentityDecision === 'reject_bound_source_page_subject_identity'
    || decision.canonicalActivityIdentityDecision === 'reject_bound_source_subject_as_activity_container'
    || decision.repeatabilityDecision === 'non_repeatable_subject';
  const conflictPresent = packet.subjectAssessment?.subjectDisposition?.state === 'blocked_conflicting_source_declarations';
  const conflictResolved = conflictPresent ? decision.subjectDispositionDecision !== 'additional_evidence_required' : null;
  const memberExpansionRequired = decision.memberExpansionDecision === 'required_for_composite_subject'
    || decision.memberExpansionDecision === 'required_for_reference_collection_subject'
    ? true
    : decision.memberExpansionDecision === 'additional_evidence_required' ? null : false;
  const candidateSemanticReviewComplete = !reviewAdditional;
  const applicationOutcome = reviewAdditional
    ? 'additional_evidence_required_remains_blocked'
    : reviewRejected
      ? 'reviewed_candidate_exclusion_applied_pending_universe_reconciliation'
      : 'reviewed_candidate_scope_applied_pending_member_and_mechanics_modeling';
  const state = reviewAdditional ? policy.unresolvedCandidateState : reviewRejected ? policy.excludedCandidateState : policy.appliedCandidateState;
  const base = {
    contract: policy.outputContract,
    applicationKey: `${decision.decisionKey}|priority-activity-human-review-application`,
    decisionKey: decision.decisionKey,
    reviewPacketKey: packet.reviewPacketKey,
    candidateKey: packet.candidateKey,
    sourcePacketSnapshotContentHash: snapshots.packet.contentHash,
    sourceDecisionSnapshotContentHash: snapshots.decision.contentHash,
    sourcePacketRecordContentHash: packet.recordContentHash,
    sourcePacketOuterContentHash: packet.contentHash,
    sourceDecisionRecordContentHash: decision.recordContentHash,
    sourceDecisionOuterContentHash: decision.contentHash,
    applicationPolicyContentHash: contentHash(policy),
    sourcePageIdentity: structuredClone(packet.sourcePageIdentity),
    pipelineBindings: structuredClone(packet.pipelineBindings),
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes,
    reviewEvidenceKeys: structuredClone(decision.reviewEvidenceKeys),
    reviewedSourceRevisions: structuredClone(decision.reviewedSourceRevisions),
    subjectDispositionDecision: decision.subjectDispositionDecision,
    appliedSubjectDisposition: decision.subjectDispositionDecision === 'confirm_one_bound_source_disposition'
      ? decision.selectedSourceDisposition : null,
    canonicalGameEntityIdentityDecision: decision.canonicalGameEntityIdentityDecision,
    canonicalGameEntityIdentity: decision.canonicalGameEntityIdentityDecision === 'confirm_bound_source_page_subject_identity'
      ? structuredClone(decision.reviewedCanonicalGameEntityIdentityProposal) : null,
    canonicalActivityIdentityDecision: decision.canonicalActivityIdentityDecision,
    canonicalActivityIdentity: decision.canonicalActivityIdentityDecision === 'confirm_bound_source_subject_as_activity_container'
      ? structuredClone(decision.reviewedCanonicalActivityIdentityProposal) : null,
    repeatabilityDecision: decision.repeatabilityDecision,
    repeatabilityClassification: decision.repeatabilityDecision === 'additional_evidence_required' ? null : decision.repeatabilityDecision,
    atomicityDecision: decision.atomicityDecision,
    atomicityClassification: decision.atomicityDecision === 'additional_evidence_required' ? null : decision.atomicityDecision,
    memberExpansionDisposition: decision.memberExpansionDecision,
    memberExpansionRequired,
    memberKeys: [],
    memberExpansionApplied: false,
    memberUniverseComplete: false,
    evidenceDomainReviewAssessments: assessments,
    additionalEvidenceDomains,
    unsupportedEvidenceDomains,
    sourceConflictPresent: conflictPresent,
    sourceConflictResolved: conflictResolved,
    candidateSemanticReviewComplete,
    authoritativeExclusionApplied: reviewRejected && !reviewAdditional,
    applicationOutcome,
    semanticReviewApplicationApplied: true,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      reviewAdditional ? 'one_or_more_review_conclusions_require_additional_evidence' : null,
      additionalEvidenceDomains.length ? 'one_or_more_evidence_domains_require_additional_evidence' : null,
      unsupportedEvidenceDomains.length ? 'one_or_more_required_evidence_domains_not_supported_by_bound_evidence' : null,
      reviewRejected ? 'bound_packet_candidate_excluded_by_explicit_human_review' : null,
      reviewRejected ? 'authoritative_exclusion_applies_only_to_bound_packet_candidate_not_complete_game_universe' : null,
      memberExpansionRequired === true ? 'member_expansion_required_before_activity_member_universe_can_be_complete' : null,
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established',
      'optimizer_eligibility_blocked'
    ].filter(Boolean)),
    state
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function accountStateFindings(values = []) {
  const forbidden = /^(?:currentBaseLevel|targetBaseLevel|currentLevel|currentXp|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|bank|bankItems|playerName|username|preferences|currentAccount)$/i;
  const findings = [];
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
  return findings.sort();
}

function evaluateInputs({
  packetRecords, packetRaw, packetManifest, packetSnapshot,
  decisionRecords, decisionRaw, decisionManifest, decisionSnapshot,
  policy, packetPolicy, decisionPolicy, contentHash
}) {
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionApplicationPolicy(policy, packetPolicy, decisionPolicy, contentHash);
  const packetManifestResult = packetManifestAssessment(packetRecords, packetRaw, packetManifest, packetSnapshot, policy, contentHash);
  const decisionManifestResult = decisionManifestAssessment(decisionRecords, decisionRaw, decisionManifest, decisionSnapshot, packetSnapshot, policy, contentHash);
  const packetMap = new Map(packetRecords.map(record => [record.reviewPacketKey, record]));
  const decisionIntegrityFailures = decisionRecords.map(record => ({ decisionKey: record.decisionKey, result: decisionRecordIntegrity(record, policy, contentHash) }))
    .filter(item => !item.result.complete);
  const duplicateDecisionKeys = duplicates(decisionRecords.map(record => record.decisionKey));
  const duplicateDecisionPacketKeys = duplicates(decisionRecords.map(record => record.reviewPacketKey));
  const unknownDecisionPacketKeys = decisionRecords.map(record => record.reviewPacketKey).filter(key => !packetMap.has(key));
  const decisionPacketBindingFailures = decisionRecords.filter(decision => {
    const packet = packetMap.get(decision.reviewPacketKey);
    return !packet
      || decision.candidateKey !== packet.candidateKey
      || decision.sourcePacketSnapshotContentHash !== packetSnapshot.contentHash
      || decision.sourcePacketSnapshotCreatedAt !== packetSnapshot.createdAt
      || decision.sourcePacketRecordContentHash !== packet.recordContentHash
      || decision.sourcePacketOuterContentHash !== packet.contentHash
      || !same(decision.pipelineBindings, packet.pipelineBindings, contentHash)
      || !same(decision.sourcePageIdentity, packet.sourcePageIdentity, contentHash);
  }).map(record => record.decisionKey);
  const submissions = decisionRecords.map(decision => reconstructedSubmission(decision, packetMap.get(decision.reviewPacketKey) || { decisionTemplate: {} }));
  const replay = buildActivityCandidatePriorityHumanReviewDecisionImport({
    packetRecords,
    submissions,
    policy: decisionPolicy,
    packetSnapshotContentHash: packetSnapshot.contentHash,
    packetSnapshotCreatedAt: packetSnapshot.createdAt,
    contentHash
  });
  const replayRecords = replay.records;
  const replayMismatches = decisionRecords.filter((record, index) => !replayRecords[index]
    || !same(without(record, 'contentHash'), replayRecords[index], contentHash)).map(record => record.decisionKey);
  const structuralFailures = [];
  if (!compiled.valid) structuralFailures.push('application_policy_or_bound_input_policy_invalid');
  if (!packetManifestResult.complete) structuralFailures.push('packet_manifest_snapshot_or_gate_revalidation_failed');
  if (!decisionManifestResult.complete) structuralFailures.push('decision_manifest_snapshot_or_gate_revalidation_failed');
  if (decisionIntegrityFailures.length) structuralFailures.push('one_or_more_decision_records_failed_outer_intrinsic_or_closed_gate_revalidation');
  if (duplicateDecisionKeys.length) structuralFailures.push('duplicate_decision_keys');
  if (duplicateDecisionPacketKeys.length) structuralFailures.push('multiple_decisions_for_one_packet');
  if (unknownDecisionPacketKeys.length) structuralFailures.push('one_or_more_decisions_do_not_map_to_a_selected_packet');
  if (decisionPacketBindingFailures.length) structuralFailures.push('one_or_more_decisions_do_not_match_the_exact_packet_snapshot_and_record');
  if (!replay.audit.publishable || replayMismatches.length) structuralFailures.push('guarded_human_decision_importer_did_not_reproduce_the_selected_decisions_exactly');
  if (!decisionRecords.length) structuralFailures.push('no_human_decisions_selected_for_application');
  return {
    compiled,
    packetManifestResult,
    decisionManifestResult,
    packetMap,
    decisionIntegrityFailures,
    duplicateDecisionKeys,
    duplicateDecisionPacketKeys,
    unknownDecisionPacketKeys,
    decisionPacketBindingFailures,
    submissions,
    replay,
    replayMismatches,
    structuralFailures,
    valid: structuralFailures.length === 0
  };
}

export function auditActivityCandidatePriorityHumanReviewDecisionApplications(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const checked = evaluateInputs({ ...options, contentHash });
  const expected = checked.valid ? options.decisionRecords.map(decision => applicationFor(
    checked.packetMap.get(decision.reviewPacketKey), decision,
    { packet: options.packetSnapshot, decision: options.decisionSnapshot }, options.policy, contentHash
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
    'reviewed_candidate_exclusion_applied_pending_universe_reconciliation',
    'reviewed_candidate_scope_applied_pending_member_and_mechanics_modeling'
  ].includes(record.applicationOutcome)).map(record => record.applicationKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.memberKeys?.length
    || record.memberExpansionApplied !== false
    || record.memberUniverseComplete !== false
    || record.requirementsVariantsXpTimingAndMechanicsComplete !== false
    || record.completeActivityUniverse !== false
    || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false).map(record => record.applicationKey || 'unknown');
  const accountFindings = accountStateFindings([
    ...(options.packetRecords || []), ...(options.decisionRecords || []), ...records
  ]);
  const blockers = [...checked.structuralFailures];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) blockers.push('application_and_selected_decision_sets_do_not_match_exactly');
  if (recordMismatches.length) blockers.push('one_or_more_application_records_do_not_match_the_replayed_review_conclusions');
  if (invalidOutcomeKeys.length) blockers.push('one_or_more_application_outcomes_are_invalid');
  if (unsupportedPromotions.length) blockers.push('application_created_unsupported_member_mechanics_universe_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = checked.valid && blockers.length === 0;
  const packetKeys = (options.packetRecords || []).map(record => record.reviewPacketKey);
  const decisionPacketKeys = (options.decisionRecords || []).map(record => record.reviewPacketKey);
  const missingDecisionPacketKeys = packetKeys.filter(key => !decisionPacketKeys.includes(key));
  const additionalEvidenceApplicationKeys = records.filter(record => !record.candidateSemanticReviewComplete).map(record => record.applicationKey);
  const unresolvedSourceConflictApplicationKeys = records.filter(record => record.sourceConflictPresent && record.sourceConflictResolved !== true).map(record => record.applicationKey);
  const expansionRequiredApplicationKeys = records.filter(record => record.memberExpansionRequired === true).map(record => record.applicationKey);
  const applicationBatchComplete = publishable && records.length === (options.decisionRecords || []).length;
  const priorityActivityHumanReviewApplicationComplete = applicationBatchComplete
    && missingDecisionPacketKeys.length === 0
    && additionalEvidenceApplicationKeys.length === 0
    && unresolvedSourceConflictApplicationKeys.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyCoverage: checked.compiled,
    packetCoverage: {
      packetRecordCount: (options.packetRecords || []).length,
      manifestAssessment: checked.packetManifestResult,
      explicitSnapshotSelected: options.packetSnapshot?.explicit === true,
      snapshotContentHash: options.packetSnapshot?.contentHash || null,
      snapshotCreatedAt: options.packetSnapshot?.createdAt || null
    },
    decisionCoverage: {
      decisionRecordCount: (options.decisionRecords || []).length,
      manifestAssessment: checked.decisionManifestResult,
      explicitSnapshotSelected: options.decisionSnapshot?.explicit === true,
      snapshotContentHash: options.decisionSnapshot?.contentHash || null,
      snapshotCreatedAt: options.decisionSnapshot?.createdAt || null,
      failedDecisionRecordKeys: checked.decisionIntegrityFailures.map(item => item.decisionKey),
      duplicateDecisionKeys: checked.duplicateDecisionKeys,
      duplicateDecisionPacketKeys: checked.duplicateDecisionPacketKeys,
      unknownDecisionPacketKeys: checked.unknownDecisionPacketKeys,
      packetBindingFailureDecisionKeys: checked.decisionPacketBindingFailures,
      missingDecisionCount: missingDecisionPacketKeys.length,
      missingDecisionPacketKeys
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
      appliedCandidateScopeCount: records.filter(record => record.applicationOutcome === 'reviewed_candidate_scope_applied_pending_member_and_mechanics_modeling').length,
      authoritativeExclusionCount: records.filter(record => record.authoritativeExclusionApplied).length,
      additionalEvidenceBlockedCount: additionalEvidenceApplicationKeys.length,
      additionalEvidenceApplicationKeys,
      sourceConflictResolvedCount: records.filter(record => record.sourceConflictPresent && record.sourceConflictResolved).length,
      unresolvedSourceConflictApplicationKeys,
      memberExpansionRequiredCount: expansionRequiredApplicationKeys.length,
      expansionRequiredApplicationKeys,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.repeatabilityClassification !== null).length,
      atomicityClassificationCount: records.filter(record => record.atomicityClassification !== null).length
    },
    semanticPreservationCoverage: {
      memberKeyCount: records.reduce((sum, record) => sum + (record.memberKeys?.length || 0), 0),
      memberExpansionAppliedCount: records.filter(record => record.memberExpansionApplied).length,
      memberUniverseCompleteCount: records.filter(record => record.memberUniverseComplete).length,
      requirementsVariantsXpTimingAndMechanicsCompleteCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete).length,
      completeActivityUniverseCount: records.filter(record => record.completeActivityUniverse).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    applicationBatchComplete,
    priorityActivityHumanReviewApplicationComplete,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      missingDecisionPacketKeys.length ? 'one_or_more_priority_activity_human_decisions_missing' : null,
      additionalEvidenceApplicationKeys.length ? 'one_or_more_priority_activity_reviews_require_additional_evidence' : null,
      unresolvedSourceConflictApplicationKeys.length ? 'one_or_more_priority_activity_source_conflicts_remain_unresolved' : null,
      expansionRequiredApplicationKeys.length ? 'one_or_more_priority_activity_member_expansions_remain_pending' : null,
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established',
      'optimizer_eligibility_blocked'
    ].filter(Boolean)),
    publishable
  };
}

export function buildActivityCandidatePriorityHumanReviewDecisionApplications(options = {}) {
  const contentHash = options.contentHash || hash;
  const checked = evaluateInputs({ ...options, contentHash });
  const records = checked.valid ? options.decisionRecords.map(decision => applicationFor(
    checked.packetMap.get(decision.reviewPacketKey), decision,
    { packet: options.packetSnapshot, decision: options.decisionSnapshot }, options.policy, contentHash
  )) : [];
  return {
    records,
    audit: auditActivityCandidatePriorityHumanReviewDecisionApplications(records, { ...options, contentHash })
  };
}
