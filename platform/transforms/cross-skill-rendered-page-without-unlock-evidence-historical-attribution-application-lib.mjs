import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import { compileHistoricalAttributionWorkQueuePolicy } from './cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-lib.mjs';
import {
  auditHistoricalAttributionReviewDecisionImport,
  compileHistoricalAttributionReviewDecisionImportPolicy,
  expectedHistoricalAttributionBlankDecision
} from './cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-lib.mjs';

const QUEUE_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue';
const DECISION_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decisions';
const REQUIRED_RULES = [
  'queueAndDecisionSnapshotsMustBeExplicitlySelected',
  'queueManifestPolicySnapshotOuterIntrinsicObservationAndGuideBindingsMustRevalidate',
  'decisionManifestPolicySnapshotOuterIntrinsicAndQueueBindingsMustRevalidate',
  'everyDecisionMustReconstructAnExactlyValidGuardedImporterSubmission',
  'oneApplicationRecordPerDecisionInDecisionOrder',
  'onlyConfirmedCompleteAttributionsMayBeApplied',
  'confirmedApplicationMustPreserveEveryObservationAttributionExactlyOnce',
  'rejectedAndEvidenceUnavailableDecisionsMustRemainUnappliedBlockers',
  'partialDecisionSetsMayProducePartialApplicationSnapshotsButCannotCompleteAttribution',
  'applicationCannotEstablishRequirementUnlockSemanticIdentityRepeatabilityMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsDependencyKindsParserChannelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const normalized = value.includes('.') ? value.replace(/\.(\d{1,3})Z$/, (_, digits) => `.${digits.padEnd(3, '0')}Z`) : value.replace(/Z$/, '.000Z');
  return new Date(parsed).toISOString() === normalized;
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|alias|aliases|fragment|fragments|namespace|namespaces|dependencyKind|dependencyKinds|parserChannel|parserChannels|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|alias|fragment|namespace|dependencykind|parserchannel).*(?:override|exception)s?$/i;
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

export function compileHistoricalAttributionApplicationPolicy(policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const queuePolicyCoverage = compileHistoricalAttributionWorkQueuePolicy(queuePolicy, contentHash);
  const decisionPolicyCoverage = compileHistoricalAttributionReviewDecisionImportPolicy(decisionPolicy, queuePolicy, contentHash);
  const decisions = [policy.confirmedDecision, policy.rejectedDecision, policy.evidenceUnavailableDecision];
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-application-policy.v1' &&
    policy.queueContract === decisionPolicy.queueContract && policy.decisionContract === decisionPolicy.recordContract &&
    policy.outputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-application-record.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-application-audit.v1' &&
    policy.inputQueuePolicy === queuePolicy.policy && policy.inputQueuePolicyContentHash === contentHash(queuePolicy) &&
    policy.inputDecisionImportPolicy === decisionPolicy.policy && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy) &&
    policy.requiredQueueState === decisionPolicy.queueState && policy.requiredDecisionState === decisionPolicy.recordState;
  const vocabularyValid = same(decisions, decisionPolicy.allowedDecisions || [], contentHash) &&
    typeof policy.confirmedApplicationState === 'string' && typeof policy.unresolvedApplicationState === 'string';
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && vocabularyValid && queuePolicyCoverage.valid && decisionPolicyCoverage.valid && !invalidRules.length && !forbidden.length,
    contractsValid, vocabularyValid, queuePolicyCoverage, decisionPolicyCoverage,
    invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden
  };
}

function queueManifestAssessment(queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, contentHash = hash) {
  const audit = queueManifest?.source?.audit || {};
  const queue = audit.queueCoverage || {};
  const observations = audit.observationCoverage || {};
  const review = audit.reviewCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    contractAndDomainMatch: queueManifest?.contract === 'sensum.ingestion-manifest.v1' && queueManifest?.domain === QUEUE_DOMAIN,
    recordCountAndRawHashMatch: queueManifest?.records === queueRecords.length && typeof queueRaw === 'string' && contentHash(queueRaw) === queueSnapshotContentHash && queueManifest?.contentHash === queueSnapshotContentHash,
    createdAtValid: validIsoTimestamp(queueManifest?.createdAt),
    policyBindingMatches: queueManifest?.source?.policy?.id === policy.inputQueuePolicy && queueManifest?.source?.policy?.contentHash === policy.inputQueuePolicyContentHash,
    queueGateAndCoverageMatch: audit.queueExportComplete === true && audit.historicalAttributionComplete === false && audit.completeActivityUniverse === false && audit.publishable === true &&
      queue.outputRecordCount === queueRecords.length && queue.duplicateOutputKeys?.length === 0 && queue.missingOutputKeys?.length === 0 &&
      queue.unexpectedOutputKeys?.length === 0 && queue.recordMismatchKeys?.length === 0 && queue.orderMatchesFilteredSourceQueue === true,
    observationPopulationExact: observations.outputHistoricalRenderedObservationCount > 0 && observations.exactHistoricalObservationPopulation === true &&
      observations.duplicateObservationKeys?.length === 0 && observations.missingObservationKeys?.length === 0 && observations.unexpectedObservationKeys?.length === 0 && observations.directObservationLeakKeys?.length === 0,
    reviewAndSemanticGatesClosed: review.blankDecisionTemplateCount === queueRecords.length && review.reviewStartedCount === 0 && review.attributionCompletedCount === 0 &&
      semantic.requirementOrUnlockApplicationCount === 0 && semantic.semanticDispositionCount === 0 && semantic.canonicalGameEntityIdentityCount === 0 &&
      semantic.canonicalActivityIdentityCount === 0 && semantic.repeatabilityClassificationCount === 0 && semantic.mechanicsReviewCompleteCount === 0 &&
      semantic.optimizerPromotionCount === 0 && semantic.automaticVerificationCount === 0 && semantic.unsupportedPromotionKeys?.length === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function decisionIntegrity(record = {}, policy = {}, contentHash = hash) {
  const intrinsic = without(record, 'contentHash');
  const checks = {
    contractMatches: record.contract === policy.decisionContract,
    stateMatches: record.state === policy.requiredDecisionState,
    outerHashMatches: validHash(record.contentHash) && record.contentHash === contentHash(intrinsic),
    intrinsicHashMatches: validHash(record.recordContentHash) && record.recordContentHash === contentHash(without(intrinsic, 'recordContentHash')),
    decisionRecordedButUnapplied: record.reviewDecisionRecorded === true && record.historicalAttributionApplied === false &&
      record.historicalRenderedExpansionDependencyAttribution === null && record.requirementOrUnlockApplied === false,
    downstreamGatesClosed: record.semanticDisposition === null && record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
      record.repeatabilityClassification === null && record.mechanicsReviewComplete === false && record.optimizerEligible === false &&
      record.automaticVerificationApplied === false && record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean), intrinsic };
}

function decisionManifestAssessment(decisionRecords, decisionRaw, decisionManifest, decisionSnapshotContentHash, queueSnapshot, policy, contentHash = hash) {
  const audit = decisionManifest?.source?.audit || {};
  const recordCoverage = audit.recordCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    contractAndDomainMatch: decisionManifest?.contract === 'sensum.ingestion-manifest.v1' && decisionManifest?.domain === DECISION_DOMAIN,
    recordCountAndRawHashMatch: decisionManifest?.records === decisionRecords.length && typeof decisionRaw === 'string' && contentHash(decisionRaw) === decisionSnapshotContentHash && decisionManifest?.contentHash === decisionSnapshotContentHash,
    createdAtValid: validIsoTimestamp(decisionManifest?.createdAt),
    policyBindingMatches: decisionManifest?.source?.policy?.id === policy.inputDecisionImportPolicy && decisionManifest?.source?.policy?.contentHash === policy.inputDecisionImportPolicyContentHash,
    queuePolicyBindingMatches: decisionManifest?.source?.inputQueuePolicy?.id === policy.inputQueuePolicy && decisionManifest?.source?.inputQueuePolicy?.contentHash === policy.inputQueuePolicyContentHash,
    selectedQueueSnapshotMatches: decisionManifest?.source?.inputSnapshot?.directory === queueSnapshot.directory &&
      decisionManifest?.source?.inputSnapshot?.contentHash === queueSnapshot.contentHash && decisionManifest?.source?.inputSnapshot?.createdAt === queueSnapshot.createdAt,
    decisionGateAndCoverageMatch: audit.publishable === true && audit.historicalAttributionApplicationComplete === false && audit.completeActivityUniverse === false &&
      recordCoverage.recordedDecisionCount === decisionRecords.length && recordCoverage.duplicateRecordKeys?.length === 0 &&
      recordCoverage.missingRecordKeys?.length === 0 && recordCoverage.unexpectedRecordKeys?.length === 0 && recordCoverage.recordMismatchKeys?.length === 0 &&
      recordCoverage.orderMatchesCompletedSubmissions === true,
    semanticGatesClosed: semantic.historicalAttributionApplications === 0 && semantic.requirementOrUnlockApplications === 0 &&
      semantic.semanticDispositionApplications === 0 && semantic.canonicalIdentityPromotions === 0 && semantic.repeatabilityPromotions === 0 &&
      semantic.mechanicsPromotions === 0 && semantic.optimizerPromotions === 0 && semantic.automaticVerifications === 0 && semantic.unsupportedPromotions?.length === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function reconstructedSubmission(decision, queue, decisionPolicy) {
  return {
    ...expectedHistoricalAttributionBlankDecision(queue, decisionPolicy),
    disposition: decision.disposition,
    observationAttributions: decision.submittedObservationAttributions,
    evidenceKeys: decision.evidenceKeys,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    notes: decision.reviewNotes
  };
}

function applicationFor(queue, decision, snapshots, policy, contentHash = hash) {
  const confirmed = decision.disposition === policy.confirmedDecision;
  const rejected = decision.disposition === policy.rejectedDecision;
  const applicationOutcome = confirmed ? 'confirmed_historical_dependency_attribution_applied' :
    rejected ? 'rejected_historical_dependency_attribution_remains_unapplied' : 'historical_dependency_evidence_unavailable_remains_unapplied';
  const appliedObservationAttributions = confirmed ? decision.submittedObservationAttributions : [];
  const attribution = confirmed ? {
    decisionKey: decision.decisionKey,
    disposition: decision.disposition,
    observationCount: queue.historicalRenderedObservationCount,
    observationAttributions: appliedObservationAttributions,
    evidenceKeys: decision.evidenceKeys,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt
  } : null;
  const base = {
    contract: policy.outputContract,
    applicationKey: `${decision.decisionKey}|historical-attribution-application`,
    decisionKey: decision.decisionKey,
    historicalAttributionWorkEntryKey: queue.historicalAttributionWorkEntryKey,
    sourceQueueSnapshotContentHash: snapshots.queue.contentHash,
    sourceDecisionSnapshotContentHash: snapshots.decision.contentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceQueueIntrinsicRecordContentHash: queue.recordContentHash,
    sourceDecisionRecordContentHash: decision.contentHash,
    sourceDecisionIntrinsicRecordContentHash: decision.recordContentHash,
    applicationPolicyContentHash: contentHash(policy),
    renderedTargetKey: queue.renderedTargetKey,
    stableWikiPageIdentity: queue.stableWikiPageIdentity,
    historicalRenderedObservationSetContentHash: queue.historicalRenderedObservationSetContentHash,
    historicalRenderedObservationCount: queue.historicalRenderedObservationCount,
    historicalGuideRevisionBindingsContentHash: queue.historicalGuideRevisionBindingsContentHash,
    historicalGuideRevisionBindingCount: queue.historicalGuideRevisionBindingCount,
    disposition: decision.disposition,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes,
    decisionEvidenceKeys: decision.evidenceKeys,
    submittedObservationAttributions: decision.submittedObservationAttributions,
    appliedObservationAttributions,
    applicationOutcome,
    historicalAttributionApplied: confirmed,
    historicalRenderedExpansionDependencyAttribution: attribution,
    attributionEvidenceKeys: confirmed ? decision.evidenceKeys : [],
    requirementOrUnlockApplied: false,
    semanticDisposition: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      confirmed ? 'historical_attribution_applied_pending_separate_semantic_and_requirement_reconciliation' :
        rejected ? 'proposed_historical_dependency_attribution_rejected_human_reconciliation_required' : 'historical_dependency_evidence_unavailable',
      'source_scoped_semantic_relevance_disposition_pending',
      'level_unlock_corpus_absence_reconciliation_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ]),
    state: confirmed ? policy.confirmedApplicationState : policy.unresolvedApplicationState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function inputAssessment(options) {
  const {
    queueRecords = [], queueRaw = '', queueManifest = {}, queueSnapshot = {},
    decisionRecords = [], decisionRaw = '', decisionManifest = {}, decisionSnapshot = {},
    policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash
  } = options;
  const compiled = compileHistoricalAttributionApplicationPolicy(policy, queuePolicy, decisionPolicy, contentHash);
  const queueManifestAudit = queueManifestAssessment(queueRecords, queueRaw, queueManifest, queueSnapshot.contentHash, policy, contentHash);
  const decisionManifestAudit = decisionManifestAssessment(decisionRecords, decisionRaw, decisionManifest, decisionSnapshot.contentHash, queueSnapshot, policy, contentHash);
  const decisionIntegrityRows = decisionRecords.map(row => decisionIntegrity(row, policy, contentHash));
  const invalidDecisionKeys = decisionRecords.filter((_, index) => !decisionIntegrityRows[index].complete).map(row => row.decisionKey || 'unknown');
  const queueByWorkKey = new Map(queueRecords.map(row => [row.historicalAttributionWorkEntryKey, row]));
  const decisionWorkKeys = decisionRecords.map(row => row.historicalAttributionWorkEntryKey);
  const duplicateDecisionKeys = duplicates(decisionRecords.map(row => row.decisionKey));
  const duplicateDecisionWorkKeys = duplicates(decisionWorkKeys);
  const missingQueueBindingKeys = unique(decisionWorkKeys.filter(key => !queueByWorkKey.has(key)));
  const reconstructedSubmissions = decisionRecords.map(row => reconstructedSubmission(row, queueByWorkKey.get(row.historicalAttributionWorkEntryKey) || {}, decisionPolicy));
  const intrinsicDecisions = decisionIntegrityRows.map(row => row.intrinsic);
  const accountStateFindings = findAccountState([queueRecords, decisionRecords, reconstructedSubmissions]);
  const snapshotsExplicitAndBound = queueSnapshot.explicit === true && decisionSnapshot.explicit === true &&
    validHash(queueSnapshot.contentHash) && validHash(decisionSnapshot.contentHash) &&
    validIsoTimestamp(queueSnapshot.createdAt) && validIsoTimestamp(decisionSnapshot.createdAt);
  const importerPreconditionsComplete = compiled.valid && snapshotsExplicitAndBound && queueManifestAudit.complete && decisionManifestAudit.complete &&
    !invalidDecisionKeys.length && !duplicateDecisionKeys.length && !duplicateDecisionWorkKeys.length && !missingQueueBindingKeys.length && !accountStateFindings.length;
  let importer = { publishable: false, blockers: ['historical_attribution_application_prevalidation_failed'] };
  if (importerPreconditionsComplete) {
    try {
      importer = auditHistoricalAttributionReviewDecisionImport(intrinsicDecisions, {
        queueRecords, submissions: reconstructedSubmissions, policy: decisionPolicy, queuePolicy,
        queueSnapshotContentHash: queueSnapshot.contentHash, queueSnapshotCreatedAt: queueSnapshot.createdAt, contentHash
      });
    } catch {
      importer = { publishable: false, blockers: ['guarded_decision_importer_rejected_or_failed'] };
    }
  }
  const importerComplete = importer.publishable === true && importer.queueCoverage?.validQueueRecordCount === queueRecords.length &&
    importer.submissionCoverage?.completedSubmissionCount === decisionRecords.length && importer.submissionCoverage?.invalidSubmissionIndexes?.length === 0 &&
    importer.recordCoverage?.recordedDecisionCount === decisionRecords.length && importer.recordCoverage?.recordMismatchKeys?.length === 0 &&
    importer.semanticPreservationCoverage?.unsupportedPromotions?.length === 0 && importer.accountStateFindings?.length === 0;
  const complete = compiled.valid && snapshotsExplicitAndBound && queueRecords.length > 0 && decisionRecords.length > 0 && queueManifestAudit.complete && decisionManifestAudit.complete &&
    !invalidDecisionKeys.length && !duplicateDecisionKeys.length && !duplicateDecisionWorkKeys.length && !missingQueueBindingKeys.length && importerComplete && !accountStateFindings.length;
  return {
    compiled, queueManifestAudit, decisionManifestAudit, invalidDecisionKeys, duplicateDecisionKeys, duplicateDecisionWorkKeys,
    missingQueueBindingKeys, reconstructedSubmissions, importer, importerComplete, queueByWorkKey, accountStateFindings,
    snapshotsExplicitAndBound, complete
  };
}

function expectedApplication(options) {
  const input = inputAssessment(options);
  const records = input.complete ? options.decisionRecords.map(decision => applicationFor(
    input.queueByWorkKey.get(decision.historicalAttributionWorkEntryKey), decision,
    { queue: options.queueSnapshot, decision: options.decisionSnapshot }, options.policy, options.contentHash
  )) : [];
  return { input, records };
}

function auditFromExpected(records, expected, options) {
  const { queueRecords, decisionRecords, policy, contentHash } = options;
  const recordKeys = records.map(row => row.applicationKey);
  const expectedKeys = expected.records.map(row => row.applicationKey);
  const duplicateRecordKeys = duplicates(recordKeys);
  const missingRecordKeys = expectedKeys.filter(key => !recordKeys.includes(key));
  const unexpectedRecordKeys = recordKeys.filter(key => !expectedKeys.includes(key));
  const recordMismatchKeys = records.filter(row => {
    const match = expected.records.find(item => item.applicationKey === row.applicationKey);
    return !match || !same(row, match, contentHash) || !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'));
  }).map(row => row.applicationKey || 'unknown');
  const unsupportedPromotions = records.filter(row => row.requirementOrUnlockApplied !== false || row.semanticDisposition !== null ||
    row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null ||
    row.mechanicsReviewComplete !== false || row.optimizerEligible !== false || row.automaticVerificationApplied !== false || row.accountIndependent !== true
  ).map(row => row.applicationKey || 'unknown');
  const invalidOutcomeKeys = records.filter(row => {
    const confirmed = row.disposition === policy.confirmedDecision;
    return confirmed ? !(row.historicalAttributionApplied === true && row.historicalRenderedExpansionDependencyAttribution !== null &&
      row.appliedObservationAttributions?.length === row.historicalRenderedObservationCount && row.attributionEvidenceKeys?.length > 0) :
      !(row.historicalAttributionApplied === false && row.historicalRenderedExpansionDependencyAttribution === null &&
        row.appliedObservationAttributions?.length === 0 && row.attributionEvidenceKeys?.length === 0);
  }).map(row => row.applicationKey || 'unknown');
  const accountStateFindings = unique([...expected.input.accountStateFindings, ...findAccountState(records)]);
  const recordSetExact = records.length === expected.records.length && !duplicateRecordKeys.length && !missingRecordKeys.length && !unexpectedRecordKeys.length && !recordMismatchKeys.length;
  const orderMatchesDecisionSet = same(records.map(row => row.decisionKey), decisionRecords.map(row => row.decisionKey), contentHash);
  const confirmedApplicationCount = records.filter(row => row.historicalAttributionApplied === true).length;
  const rejectedUnappliedCount = records.filter(row => row.disposition === policy.rejectedDecision && row.historicalAttributionApplied === false).length;
  const evidenceUnavailableUnappliedCount = records.filter(row => row.disposition === policy.evidenceUnavailableDecision && row.historicalAttributionApplied === false).length;
  const missingDecisionCount = Math.max(0, queueRecords.length - decisionRecords.length);
  const applicationComplete = recordSetExact && orderMatchesDecisionSet && !invalidOutcomeKeys.length && !unsupportedPromotions.length && !accountStateFindings.length;
  const historicalAttributionApplicationComplete = applicationComplete && records.length === queueRecords.length && confirmedApplicationCount === queueRecords.length;
  const blockers = [];
  if (!expected.input.compiled.valid) blockers.push('historical_attribution_application_policy_invalid_or_specific');
  if (!expected.input.snapshotsExplicitAndBound) blockers.push('queue_and_decision_snapshots_not_explicit_valid_and_bound');
  if (!expected.input.queueManifestAudit.complete) blockers.push('selected_queue_snapshot_manifest_or_coverage_invalid');
  if (!expected.input.decisionManifestAudit.complete) blockers.push('selected_decision_snapshot_manifest_or_queue_binding_invalid');
  if (expected.input.invalidDecisionKeys.length || expected.input.duplicateDecisionKeys.length || expected.input.duplicateDecisionWorkKeys.length || expected.input.missingQueueBindingKeys.length) blockers.push('one_or_more_decision_records_not_exact_unique_or_queue_bound');
  if (!expected.input.importerComplete) blockers.push('guarded_decision_importer_did_not_reproduce_selected_decision_set');
  if (!recordSetExact || !orderMatchesDecisionSet) blockers.push('application_record_set_does_not_exactly_match_selected_decisions');
  if (invalidOutcomeKeys.length) blockers.push('one_or_more_application_outcomes_violate_decision_specific_rules');
  if (unsupportedPromotions.length) blockers.push('historical_attribution_application_created_unsupported_downstream_promotion');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  if (missingDecisionCount) blockers.push('one_or_more_historical_attribution_decisions_missing');
  if (rejectedUnappliedCount) blockers.push('one_or_more_historical_attribution_proposals_rejected');
  if (evidenceUnavailableUnappliedCount) blockers.push('one_or_more_historical_dependency_evidence_sets_unavailable');
  const publishable = expected.input.complete && applicationComplete;
  return {
    contract: policy.auditContract,
    policyCoverage: expected.input.compiled,
    queueCoverage: {
      queueRecordCount: queueRecords.length,
      queueSnapshotContentHash: options.queueSnapshot.contentHash,
      queueSnapshotCreatedAt: options.queueSnapshot.createdAt,
      manifestChecks: expected.input.queueManifestAudit.checks
    },
    decisionCoverage: {
      decisionRecordCount: decisionRecords.length,
      decisionSnapshotContentHash: options.decisionSnapshot.contentHash,
      decisionSnapshotCreatedAt: options.decisionSnapshot.createdAt,
      manifestChecks: expected.input.decisionManifestAudit.checks,
      invalidDecisionKeys: expected.input.invalidDecisionKeys,
      duplicateDecisionKeys: expected.input.duplicateDecisionKeys,
      duplicateDecisionWorkKeys: expected.input.duplicateDecisionWorkKeys,
      missingQueueBindingKeys: expected.input.missingQueueBindingKeys,
      guardedImporterReproducedDecisionSet: expected.input.importerComplete,
      missingDecisionCount
    },
    bindingCoverage: {
      selectedSnapshotsExplicit: options.queueSnapshot.explicit === true && options.decisionSnapshot.explicit === true,
      orderMatchesDecisionSet,
      decisionQueueBindingExact: expected.input.decisionManifestAudit.checks.selectedQueueSnapshotMatches === true
    },
    applicationCoverage: {
      expectedApplicationRecordCount: expected.records.length,
      applicationRecordCount: records.length,
      confirmedApplicationCount,
      rejectedUnappliedCount,
      evidenceUnavailableUnappliedCount,
      duplicateRecordKeys, missingRecordKeys, unexpectedRecordKeys, recordMismatchKeys, invalidOutcomeKeys,
      applicationPolicyContentHash: contentHash(policy)
    },
    semanticPreservationCoverage: {
      unsupportedPromotions,
      requirementOrUnlockApplicationCount: records.filter(row => row.requirementOrUnlockApplied === true).length,
      semanticDispositionApplicationCount: records.filter(row => row.semanticDisposition !== null).length,
      canonicalIdentityPromotionCount: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length,
      repeatabilityPromotionCount: records.filter(row => row.repeatabilityClassification !== null).length,
      mechanicsPromotionCount: records.filter(row => row.mechanicsReviewComplete === true).length,
      optimizerPromotionCount: records.filter(row => row.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length
    },
    accountStateFindings,
    applicationBatchComplete: publishable,
    historicalAttributionApplicationComplete,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers,
      'source_scoped_semantic_relevance_disposition_pending',
      'level_unlock_corpus_absence_reconciliation_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildHistoricalAttributionApplications(options = {}) {
  const normalized = { contentHash: hash, ...options };
  const expected = expectedApplication(normalized);
  const records = expected.input.complete ? expected.records : [];
  const audit = auditFromExpected(records, expected, normalized);
  return { records, audit };
}

export function auditHistoricalAttributionApplications(records = [], options = {}) {
  const normalized = { contentHash: hash, ...options };
  const expected = expectedApplication(normalized);
  return auditFromExpected(records, expected, normalized);
}
