import { hash } from '../ingestion/lib.mjs';
import {
  buildAgilityTargetConditionGapDiscoveryReviewDecisionImport,
  compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy,
  expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision
} from './agility-target-condition-gap-discovery-review-decision-import-lib.mjs';

const REQUIRED_RULES = [
  'packetAndDecisionSnapshotsMustBeExplicitlySelected',
  'packetManifestRawRecordAuditAndArtifactHashesMustRevalidate',
  'decisionManifestRawRecordsPolicyAndPacketBindingsMustRevalidate',
  'everyDecisionMustReplayThroughGuardedImporter',
  'oneApplicationRecordPerDecisionInDecisionOrder',
  'confirmationMayCloseOnlyTheExactNamedBlocker',
  'rejectionAndAdditionalEvidenceKeepTheNamedBlockerOpen',
  'applicationCannotCreateExpectedRateFailureMechanicsOrOtherGameFacts',
  'otherCandidateBlockersAndCompleteUniverseRemainOpen',
  'applicationCannotPromoteOptimizerEligibilityOrVerifiedBest',
  'namesTitlesPageIdsRevisionsCandidatesBlockersLinesAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
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
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|candidate|candidates|candidateKey|candidateKeys|blocker|blockers|line|lines|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|candidate|blocker|line|alias).*(?:override|exception)s?$/i;
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

export function compileAgilityTargetConditionGapDiscoveryReviewDecisionApplicationPolicy(
  policy = {}, decisionPolicy = {}, packetPolicy = {}, contentHash = hash
) {
  const expected = {
    inputManifestContract: 'sensum.ingestion-manifest.v1',
    inputPacketDomain: 'agility-target-condition-gap-discovery-review-packet',
    inputPacketContract: 'sensum.agility-target-condition-gap-discovery-review-packet.v1',
    inputPacketPolicy: 'sensum.agility-target-condition-gap-discovery-review-packet-policy.v1',
    inputPacketPolicyFile: 'platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json',
    inputDecisionDomain: 'agility-target-condition-gap-discovery-review-decisions',
    inputDecisionContract: 'sensum.agility-target-condition-gap-discovery-review-decision.v1',
    inputDecisionPolicy: 'sensum.agility-target-condition-gap-discovery-review-decision-import-policy.v1',
    inputDecisionPolicyFile: 'platform/policies/agility-target-condition-gap-discovery-review-decision-import-v1.json',
    outputDomain: 'agility-target-condition-gap-discovery-review-decision-applications',
    outputContract: 'sensum.agility-target-condition-gap-discovery-review-decision-application.v1',
    auditContract: 'sensum.agility-target-condition-gap-discovery-review-decision-application-audit.v1',
    requiredDecisionState: 'recorded_source_bound_target_condition_human_review_decision_pending_separate_semantic_application'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const decisionPolicyCoverage = compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy(decisionPolicy, packetPolicy, contentHash);
  const policyHashesMatch = policy.inputPacketPolicyContentHash === contentHash(packetPolicy)
    && policy.inputDecisionPolicyContentHash === contentHash(decisionPolicy);
  const decisionBindingsMatch = decisionPolicy.policy === policy.inputDecisionPolicy
    && decisionPolicy.inputPacketPolicy === policy.inputPacketPolicy
    && decisionPolicy.inputPacketDomain === policy.inputPacketDomain
    && decisionPolicy.inputPacketContract === policy.inputPacketContract
    && decisionPolicy.outputDomain === policy.inputDecisionDomain
    && decisionPolicy.recordContract === policy.inputDecisionContract
    && decisionPolicy.recordState === policy.requiredDecisionState;
  const states = Object.values(policy.applicationStates || {});
  const statesValid = states.length === 3 && unique(states).length === 3 && states.every(value => typeof value === 'string' && value.length > 0);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidBindings.length && !invalidRules.length && decisionPolicyCoverage.valid && policyHashesMatch
      && decisionBindingsMatch && statesValid && !forbidden.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    decisionPolicyCoverage,
    policyHashesMatch,
    decisionBindingsMatch,
    statesValid,
    forbiddenPolicyPaths: forbidden
  };
}

function decisionRecordIntegrity(record = {}, policy = {}, contentHash = hash) {
  const checks = {
    contractMatches: record.contract === policy.inputDecisionContract,
    stateMatches: record.state === policy.requiredDecisionState,
    outerHashMatches: validHash(record.contentHash) && record.contentHash === contentHash(without(record, 'contentHash')),
    recordHashMatches: validHash(record.recordContentHash)
      && record.recordContentHash === contentHash(without(record, 'recordContentHash', 'contentHash')),
    reviewRecorded: record.reviewDecisionRecorded === true,
    semanticGatesClosed: record.semanticApplicationApplied === false && record.blockersClosed === 0
      && record.semanticFactsCreated === 0 && record.optimizerEligible === false
      && record.automaticVerificationApplied === false && record.accountIndependent === true
      && record.completeWikiUniverseClaimed === false
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function decisionSnapshotAssessment(options = {}, contentHash = hash) {
  const { decisionRecords = [], decisionRaw = '', decisionManifest = {}, decisionSnapshot = {}, packetManifest = {}, blankTemplates = [], blankTemplateRaw = '', policy = {}, decisionPolicy = {}, packetPolicy = {} } = options;
  const audit = decisionManifest.source?.audit || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const integrity = decisionRecords.map(record => decisionRecordIntegrity(record, policy, contentHash));
  const checks = {
    explicitSelection: decisionSnapshot.explicit === true,
    contractAndDomainMatch: decisionManifest.contract === policy.inputManifestContract && decisionManifest.domain === policy.inputDecisionDomain,
    snapshotBindingMatches: decisionSnapshot.contentHash === decisionManifest.contentHash && decisionSnapshot.createdAt === decisionManifest.createdAt,
    recordCountAndRawHashMatch: Number(decisionManifest.records) === decisionRecords.length
      && decisionRecords.length > 0 && decisionManifest.contentHash === contentHash(decisionRaw),
    createdAtValid: validIsoTimestamp(decisionManifest.createdAt) && Date.parse(decisionManifest.createdAt) >= Date.parse(packetManifest.createdAt),
    decisionPolicyBindingMatches: decisionManifest.source?.policy?.id === decisionPolicy.policy
      && decisionManifest.source?.policy?.contentHash === contentHash(decisionPolicy),
    packetPolicyBindingMatches: decisionManifest.source?.packetPolicy?.id === packetPolicy.policy
      && decisionManifest.source?.packetPolicy?.contentHash === contentHash(packetPolicy),
    packetSnapshotBindingMatches: decisionManifest.source?.inputSnapshot?.domain === packetManifest.domain
      && decisionManifest.source?.inputSnapshot?.contentHash === packetManifest.contentHash
      && decisionManifest.source?.inputSnapshot?.createdAt === packetManifest.createdAt
      && Number(decisionManifest.source?.inputSnapshot?.records) === Number(packetManifest.records),
    templateSnapshotBindingMatches: decisionManifest.source?.templateSnapshot?.contentHash === contentHash(blankTemplateRaw)
      && Number(decisionManifest.source?.templateSnapshot?.rows) === blankTemplates.length,
    decisionAuditValid: audit.contract === decisionPolicy.auditContract && audit.publishable === true
      && audit.reviewDecisionRecordingComplete === true && audit.humanReviewComplete === true
      && audit.semanticApplicationComplete === false && audit.conditionOrMechanicsCoverageComplete === false
      && audit.completeWikiUniverse === false,
    decisionAuditFailClosed: Number(semantic.semanticApplicationCount) === 0 && Number(semantic.blockersClosed) === 0
      && Number(semantic.semanticFactsCreated) === 0 && Number(semantic.optimizerEligibleCount) === 0
      && Number(semantic.automaticVerificationCount) === 0 && Number(semantic.completeWikiUniverseClaimCount) === 0,
    allDecisionRecordsValid: integrity.every(row => row.complete),
    decisionKeysUnique: duplicates(decisionRecords.map(row => row.decisionKey)).length === 0,
    reviewPacketKeysUnique: duplicates(decisionRecords.map(row => row.reviewPacketKey)).length === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean), integrity };
}

function reconstructedSubmission(decision = {}, template = {}, contentHash = hash) {
  const base = {
    ...structuredClone(template),
    decision: decision.decision,
    selectedEvidenceKeys: structuredClone(decision.selectedEvidenceKeys || []),
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes
  };
  return { ...base, contentHash: contentHash(without(base, 'contentHash')) };
}

function evaluateInputs(options = {}, contentHash = hash) {
  const compiled = compileAgilityTargetConditionGapDiscoveryReviewDecisionApplicationPolicy(
    options.policy, options.decisionPolicy, options.packetPolicy, contentHash
  );
  const decisionSnapshotCoverage = decisionSnapshotAssessment(options, contentHash);
  const packetMap = new Map((options.packetRecords || []).map(record => [record.reviewPacketKey, record]));
  const templateMap = new Map((options.blankTemplates || []).map(record => [record.reviewPacketKey, record]));
  const submissions = (options.decisionRecords || []).map(decision => reconstructedSubmission(
    decision, templateMap.get(decision.reviewPacketKey) || {}, contentHash
  ));
  const replay = buildAgilityTargetConditionGapDiscoveryReviewDecisionImport({
    packetRecords: options.packetRecords || [],
    packetManifest: options.packetManifest || {},
    packetRaw: options.packetRaw || '',
    artifactManifest: options.artifactManifest || {},
    artifactManifestRaw: options.artifactManifestRaw || '',
    reviewMarkdownRaw: options.reviewMarkdownRaw || '',
    blankTemplates: options.blankTemplates || [],
    blankTemplateRaw: options.blankTemplateRaw || '',
    submissions,
    policy: options.decisionPolicy || {},
    packetPolicy: options.packetPolicy || {},
    contentHash
  });
  const replayRecordByKey = new Map(replay.records.map(record => [record.decisionKey, record]));
  const replayMismatches = (options.decisionRecords || []).filter(record => !same(record, replayRecordByKey.get(record.decisionKey), contentHash)).map(record => record.decisionKey || 'unknown');
  const decisionPacketBindingFailures = (options.decisionRecords || []).filter(decision => {
    const packet = packetMap.get(decision.reviewPacketKey);
    const template = templateMap.get(decision.reviewPacketKey);
    return !packet || !template
      || decision.sourcePacketSnapshot?.domain !== options.packetManifest?.domain
      || decision.sourcePacketSnapshot?.createdAt !== options.packetManifest?.createdAt
      || decision.sourcePacketSnapshot?.contentHash !== options.packetManifest?.contentHash
      || decision.sourcePacketContentHash !== packet.packetContentHash
      || decision.sourcePacketOuterContentHash !== packet.contentHash
      || decision.sourceBlankTemplateContentHash !== template.contentHash
      || decision.candidateKey !== packet.candidateKey
      || decision.targetBaseAgility !== packet.targetBaseAgility
      || decision.namedBlocker !== packet.namedBlocker
      || !same(decision.sourceEvidence?.evidenceKey, packet.sourceEvidence?.evidenceKey, contentHash);
  }).map(record => record.decisionKey || 'unknown');
  const packetSnapshotCoverage = {
    explicitSelection: options.packetSnapshot?.explicit === true,
    manifestBindingMatches: options.packetSnapshot?.contentHash === options.packetManifest?.contentHash
      && options.packetSnapshot?.createdAt === options.packetManifest?.createdAt,
    guardedImporterRevalidatedPacket: replay.audit?.inputCoverage?.complete === true
  };
  const exactSet = (options.decisionRecords || []).length === (options.packetRecords || []).length
    && same(sorted((options.decisionRecords || []).map(row => row.reviewPacketKey)), sorted((options.packetRecords || []).map(row => row.reviewPacketKey)), contentHash);
  return {
    compiled,
    decisionSnapshotCoverage,
    packetSnapshotCoverage,
    submissions,
    replay,
    replayMismatches,
    decisionPacketBindingFailures,
    exactSet,
    accountStateFindings: accountStateFindings([options.packetRecords || [], options.decisionRecords || []]),
    complete: compiled.valid && Object.values(packetSnapshotCoverage).every(Boolean) && decisionSnapshotCoverage.complete
      && replay.audit?.publishable === true && replayMismatches.length === 0
      && decisionPacketBindingFailures.length === 0 && exactSet
      && accountStateFindings([options.packetRecords || [], options.decisionRecords || []]).length === 0
  };
}

function applicationFor(packet, decision, snapshots, policy, contentHash = hash) {
  const confirmed = decision.decision === 'confirm_source_resolves_named_blocker_only';
  const rejected = decision.decision === 'reject_source_as_insufficient_or_condition_mismatched';
  const additional = decision.decision === 'needs_additional_revision_pinned_evidence';
  const sourceSignalDisposition = confirmed
    ? 'accepted_for_named_blocker_only'
    : rejected
      ? 'rejected_as_insufficient_or_condition_mismatched'
      : 'additional_revision_pinned_evidence_required';
  const applicationOutcome = confirmed
    ? 'named_blocker_resolution_recorded_other_candidate_and_optimizer_gates_remain_closed'
    : rejected
      ? 'source_signal_rejection_recorded_named_blocker_remains_open'
      : 'additional_evidence_requirement_recorded_named_blocker_remains_open';
  const state = confirmed ? policy.applicationStates.confirmed : rejected ? policy.applicationStates.rejected : policy.applicationStates.additionalEvidence;
  const remainingBlockers = sorted(unique([
    ...(packet.relatedOpenBlockers || []),
    confirmed ? null : packet.namedBlocker,
    'expected_rate_and_failure_mechanics_not_created_by_review_application',
    'complete_activity_universe_not_established',
    'optimizer_eligibility_blocked'
  ].filter(Boolean)));
  const base = {
    contract: policy.outputContract,
    applicationKey: `${decision.decisionKey}|target-condition-review-application`,
    decisionKey: decision.decisionKey,
    reviewPacketKey: packet.reviewPacketKey,
    sourcePacketSnapshotContentHash: snapshots.packet.contentHash,
    sourcePacketSnapshotCreatedAt: snapshots.packet.createdAt,
    sourceDecisionSnapshotContentHash: snapshots.decision.contentHash,
    sourceDecisionSnapshotCreatedAt: snapshots.decision.createdAt,
    sourcePacketContentHash: packet.packetContentHash,
    sourcePacketOuterContentHash: packet.contentHash,
    sourceDecisionRecordContentHash: decision.recordContentHash,
    sourceDecisionOuterContentHash: decision.contentHash,
    sourceBlankTemplateContentHash: decision.sourceBlankTemplateContentHash,
    applicationPolicyContentHash: contentHash(policy),
    candidateKey: decision.candidateKey,
    targetBaseAgility: decision.targetBaseAgility,
    namedBlocker: decision.namedBlocker,
    sourceEvidence: structuredClone(decision.sourceEvidence),
    selectedEvidenceKeys: structuredClone(decision.selectedEvidenceKeys),
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes,
    appliedDecision: decision.decision,
    sourceSignalDisposition,
    namedBlockerResolutionApplied: confirmed,
    namedBlockerClosed: confirmed,
    additionalEvidenceRequired: additional,
    semanticApplicationApplied: true,
    blockersClosed: confirmed ? 1 : 0,
    gamePerformanceFactsCreated: 0,
    expectedRateCreated: false,
    failureMechanicsCreated: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false,
    applicationOutcome,
    remainingBlockers,
    explicitNonClaims: [
      'application_does_not_create_an_expected_rate',
      'application_does_not_create_failure_probability_failed_xp_or_recovery_mechanics',
      'application_does_not_resolve_related_open_blockers',
      'application_does_not_establish_candidate_universe_completeness',
      'application_does_not_authorize_optimizer_eligibility_or_verified_best'
    ],
    state
  };
  const withRecordHash = { ...base, recordContentHash: contentHash(base) };
  return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
}

export function auditAgilityTargetConditionGapDiscoveryReviewDecisionApplications(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const evaluated = options.evaluated || evaluateInputs(options, contentHash);
  const packetMap = new Map((options.packetRecords || []).map(record => [record.reviewPacketKey, record]));
  const expectedRecords = evaluated.complete ? (options.decisionRecords || []).map(decision => applicationFor(
    packetMap.get(decision.reviewPacketKey),
    decision,
    { packet: options.packetSnapshot, decision: options.decisionSnapshot },
    options.policy,
    contentHash
  )) : [];
  const recordMismatches = records.map((record, index) => same(record, expectedRecords[index], contentHash) ? null : record.applicationKey || `row:${index + 1}`).filter(Boolean);
  if (records.length !== expectedRecords.length) recordMismatches.push('application_record_count_mismatch');
  const applicationCoverage = {
    applicationRecordCount: records.length,
    confirmedNamedBlockerResolutionCount: records.filter(row => row.namedBlockerResolutionApplied === true).length,
    sourceSignalRejectionCount: records.filter(row => row.sourceSignalDisposition === 'rejected_as_insufficient_or_condition_mismatched').length,
    additionalEvidenceBlockedCount: records.filter(row => row.additionalEvidenceRequired === true).length,
    recordMismatches: unique(recordMismatches)
  };
  const unsupportedPromotions = records.filter(row => row.gamePerformanceFactsCreated !== 0
    || row.expectedRateCreated !== false || row.failureMechanicsCreated !== false
    || row.optimizerEligible !== false || row.automaticVerificationApplied !== false
    || row.accountIndependent !== true || row.completeWikiUniverseClaimed !== false
    || (row.namedBlockerClosed === true && row.appliedDecision !== 'confirm_source_resolves_named_blocker_only')
    || row.blockersClosed !== (row.appliedDecision === 'confirm_source_resolves_named_blocker_only' ? 1 : 0));
  const semanticPreservationCoverage = {
    semanticApplicationCount: records.filter(row => row.semanticApplicationApplied === true).length,
    namedBlockersClosed: records.reduce((sum, row) => sum + Number(row.blockersClosed || 0), 0),
    gamePerformanceFactsCreated: records.reduce((sum, row) => sum + Number(row.gamePerformanceFactsCreated || 0), 0),
    expectedRatesCreated: records.filter(row => row.expectedRateCreated === true).length,
    failureMechanicsCreated: records.filter(row => row.failureMechanicsCreated === true).length,
    optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
    automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length,
    completeWikiUniverseClaimCount: records.filter(row => row.completeWikiUniverseClaimed === true).length,
    unsupportedPromotions: unsupportedPromotions.map(row => row.applicationKey || 'unknown')
  };
  const bindingCoverage = {
    exactDecisionPacketSet: evaluated.exactSet,
    decisionPacketBindingFailures: evaluated.decisionPacketBindingFailures,
    replayMismatches: evaluated.replayMismatches,
    applicationRecordsExactlyMatchValidatedDecisions: recordMismatches.length === 0
  };
  const blockers = [];
  if (!evaluated.compiled.valid) blockers.push('application_policy_invalid');
  if (!Object.values(evaluated.packetSnapshotCoverage).every(Boolean)) blockers.push('packet_snapshot_failed_revalidation');
  if (!evaluated.decisionSnapshotCoverage.complete) blockers.push('decision_snapshot_failed_revalidation');
  if (evaluated.replay.audit?.publishable !== true || evaluated.replayMismatches.length) blockers.push('decisions_failed_guarded_importer_replay');
  if (!evaluated.exactSet || evaluated.decisionPacketBindingFailures.length) blockers.push('decision_packet_bindings_incomplete_or_mismatched');
  if (evaluated.accountStateFindings.length) blockers.push('current_account_state_present');
  if (recordMismatches.length) blockers.push('application_records_do_not_exactly_reproduce_validated_decisions');
  if (unsupportedPromotions.length) blockers.push('application_created_unsupported_fact_mechanics_optimizer_or_universe_promotion');
  const publishable = blockers.length === 0 && records.length > 0;
  return {
    contract: options.policy?.auditContract,
    policyCoverage: evaluated.compiled,
    packetSnapshotCoverage: evaluated.packetSnapshotCoverage,
    decisionSnapshotCoverage: evaluated.decisionSnapshotCoverage,
    decisionReplayCoverage: {
      replayPublishable: evaluated.replay.audit?.publishable === true,
      replayDecisionCount: evaluated.replay.records?.length || 0,
      replayMismatches: evaluated.replayMismatches
    },
    bindingCoverage,
    applicationCoverage,
    semanticPreservationCoverage,
    accountStateFindings: evaluated.accountStateFindings,
    applicationBatchComplete: publishable,
    humanReviewComplete: publishable,
    semanticApplicationComplete: publishable,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_condition_mechanics_and_activity_universe_coverage',
    blockers: publishable ? unique([
      applicationCoverage.confirmedNamedBlockerResolutionCount ? 'related_candidate_condition_and_mechanics_blockers_remain_open' : 'named_target_condition_blocker_remains_open',
      'expected_rate_and_failure_mechanics_remain_unresolved',
      'complete_activity_universe_not_established',
      'optimizer_eligibility_blocked'
    ]) : unique(blockers),
    publishable
  };
}

export function buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications(options = {}) {
  const contentHash = options.contentHash || hash;
  const evaluated = evaluateInputs(options, contentHash);
  const packetMap = new Map((options.packetRecords || []).map(record => [record.reviewPacketKey, record]));
  const records = evaluated.complete ? (options.decisionRecords || []).map(decision => applicationFor(
    packetMap.get(decision.reviewPacketKey),
    decision,
    { packet: options.packetSnapshot, decision: options.decisionSnapshot },
    options.policy,
    contentHash
  )) : [];
  const audit = auditAgilityTargetConditionGapDiscoveryReviewDecisionApplications(records, { ...options, evaluated, contentHash });
  return { records: audit.publishable ? records : [], audit };
}
