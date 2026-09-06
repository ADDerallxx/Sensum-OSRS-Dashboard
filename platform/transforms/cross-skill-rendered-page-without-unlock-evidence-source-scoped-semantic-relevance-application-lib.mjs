import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import { compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy } from './cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-lib.mjs';
import {
  auditRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport,
  compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy,
  expectedRenderedPageWithoutUnlockSemanticRelevanceBlankDecision
} from './cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-lib.mjs';

const QUEUE_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue';
const DECISION_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decisions';
const REQUIRED_RULES = [
  'queueAndDecisionSnapshotsMustBeExplicitlySelected',
  'queueManifestPolicySnapshotOuterIntrinsicContextAndEvidenceBindingsMustRevalidate',
  'decisionManifestPolicySnapshotOuterIntrinsicAndQueueBindingsMustRevalidate',
  'everyDecisionMustReconstructAnExactlyValidGuardedImporterSubmission',
  'oneApplicationRecordPerDecisionInDecisionOrder',
  'everyAllowedRecordedHumanDecisionMayApplyOnlyItsExactSemanticDisposition',
  'relevantAndNotRelevantDecisionsResolveOnlySourceScopedSemanticRelevance',
  'ambiguousDecisionMustRemainAnUnresolvedAdditionalEvidenceBlocker',
  'partialDecisionSetsMayProducePartialApplicationSnapshotsButCannotCompleteReview',
  'notRelevantDecisionCannotCreateAnAuthoritativeGameUniverseExclusion',
  'applicationCannotEstablishRequirementUnlockCanonicalIdentityRepeatabilityVariantsXpTimingMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsTemplatesCategoriesAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => left !== undefined && right !== undefined && contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const normalized = value.includes('.') ? value.replace(/\.(\d{1,3})Z$/, (_, digits) => `.${digits.padEnd(3, '0')}Z`) : value.replace(/Z$/, '.000Z');
  return new Date(parsed).toISOString() === normalized;
}

function parseRawRecords(raw) {
  try { return String(raw).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse); } catch { return null; }
}

function rawRecordsMatch(raw, records, contentHash = hash) {
  const parsed = typeof raw === 'string' ? parseRawRecords(raw) : null;
  return Array.isArray(parsed) && same(parsed, records, contentHash);
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|signatureKey|signatureKeys|template|templates|category|categories|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|signaturekey|template|category|alias).*(?:override|exception)s?$/i;
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

export function compileRenderedPageWithoutUnlockSemanticRelevanceApplicationPolicy(policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const queuePolicyCoverage = compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy(queuePolicy, contentHash);
  const decisionPolicyCoverage = compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy(decisionPolicy, queuePolicy, contentHash);
  const decisions = [policy.relevantDecision, policy.notRelevantDecision, policy.ambiguousDecision];
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-application-policy.v1' &&
    policy.queueContract === decisionPolicy.queueContract && policy.decisionContract === decisionPolicy.recordContract &&
    policy.outputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-application-record.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-application-audit.v1' &&
    policy.inputQueuePolicy === queuePolicy.policy && policy.inputQueuePolicyContentHash === contentHash(queuePolicy) &&
    policy.inputDecisionImportPolicy === decisionPolicy.policy && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy) &&
    policy.requiredQueueState === decisionPolicy.queueState && policy.requiredDecisionState === decisionPolicy.recordState;
  const vocabularyValid = same(decisions, decisionPolicy.allowedDecisions || [], contentHash) &&
    typeof policy.resolvedApplicationState === 'string' && typeof policy.ambiguousApplicationState === 'string';
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && vocabularyValid && queuePolicyCoverage.valid && decisionPolicyCoverage.valid && !invalidRules.length && !forbidden.length,
    contractsValid, vocabularyValid, queuePolicyCoverage, decisionPolicyCoverage,
    invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden
  };
}

function queueManifestAssessment(queueRecords, queueRaw, manifest, snapshotHash, policy, contentHash = hash) {
  const audit = manifest?.source?.audit || {};
  const queue = audit.queueCoverage || {};
  const bindings = audit.bindingCoverage || {};
  const contexts = audit.contextPreservationCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const observedGuideContextCount = queueRecords.reduce((sum, row) => sum + (row.retainedGuideContexts?.guideObservationCount || 0), 0);
  const checks = {
    contractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === QUEUE_DOMAIN,
    recordCountRawHashAndRowsMatch: manifest?.records === queueRecords.length && typeof queueRaw === 'string' &&
      contentHash(queueRaw) === snapshotHash && manifest?.contentHash === snapshotHash && rawRecordsMatch(queueRaw, queueRecords, contentHash),
    createdAtValid: validIsoTimestamp(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policy.inputQueuePolicy && manifest?.source?.policy?.contentHash === policy.inputQueuePolicyContentHash,
    queueGateAndCoverageMatch: audit.queueExportComplete === true && audit.semanticRelevanceReviewComplete === false &&
      audit.reconciliationComplete === false && audit.completeActivityUniverse === false && audit.publishable === true &&
      queue.reviewQueueEntryCount === queueRecords.length && queue.blankDecisionTemplateCount === queueRecords.length &&
      queue.duplicateOutputKeys?.length === 0 && queue.missingOutputKeys?.length === 0 && queue.unexpectedOutputKeys?.length === 0 &&
      queue.mismatchKeys?.length === 0 && queue.priorityOrderMatches === true,
    allUpstreamBindingsDeclaredComplete: bindings.fullyBoundSignatureCount === queueRecords.length && bindings.allThreeSnapshotsAndRecordsBound === true,
    sourceContextPopulationPreserved: observedGuideContextCount > 0 && contexts.retainedGuideObservationCount === observedGuideContextCount &&
      contexts.exactContextPreservation === true,
    reviewAndDownstreamGatesClosed: semantic.semanticDispositionCount === 0 && semantic.canonicalGameEntityIdentityCount === 0 &&
      semantic.canonicalActivityIdentityCount === 0 && semantic.repeatabilityClassifiedCount === 0 && semantic.mechanicsReviewCompleteCount === 0 &&
      semantic.optimizerEligibleCount === 0 && semantic.automaticVerificationCount === 0 && semantic.decidedTemplateCount === 0 &&
      (semantic.unsupportedPromotionKeys?.length || 0) === 0 && (audit.accountStateFindings?.length || 0) === 0
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
    decisionRecordedButUnapplied: record.reviewDecisionRecorded === true && record.semanticDispositionApplied === false &&
      record.sourceScopedSemanticRelevanceReview === null,
    downstreamGatesClosed: record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
      record.repeatabilityClassification === null && record.mechanicsReviewComplete === false && record.optimizerEligible === false &&
      record.automaticVerificationApplied === false && record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean), intrinsic };
}

function decisionManifestAssessment(decisionRecords, decisionRaw, manifest, snapshotHash, queueSnapshot, policy, contentHash = hash) {
  const audit = manifest?.source?.audit || {};
  const record = audit.recordCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    contractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === DECISION_DOMAIN,
    recordCountRawHashAndRowsMatch: manifest?.records === decisionRecords.length && typeof decisionRaw === 'string' &&
      contentHash(decisionRaw) === snapshotHash && manifest?.contentHash === snapshotHash && rawRecordsMatch(decisionRaw, decisionRecords, contentHash),
    createdAtValid: validIsoTimestamp(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policy.inputDecisionImportPolicy && manifest?.source?.policy?.contentHash === policy.inputDecisionImportPolicyContentHash,
    queuePolicyBindingMatches: manifest?.source?.inputQueuePolicy?.id === policy.inputQueuePolicy && manifest?.source?.inputQueuePolicy?.contentHash === policy.inputQueuePolicyContentHash,
    selectedQueueSnapshotMatches: manifest?.source?.inputSnapshot?.directory === queueSnapshot.directory &&
      manifest?.source?.inputSnapshot?.contentHash === queueSnapshot.contentHash,
    decisionGateAndCoverageMatch: audit.publishable === true && audit.semanticRelevanceReviewComplete === false && audit.reconciliationComplete === false &&
      audit.completeActivityUniverse === false && record.recordedDecisionCount === decisionRecords.length &&
      record.duplicateRecordKeys?.length === 0 && record.missingRecordKeys?.length === 0 && record.unexpectedRecordKeys?.length === 0 &&
      record.recordMismatches?.length === 0 && record.recordHashFailures?.length === 0,
    downstreamGatesClosed: semantic.semanticDispositionAppliedCount === 0 && semantic.semanticReviewAppliedCount === 0 &&
      semantic.canonicalGameEntityIdentityCount === 0 && semantic.canonicalActivityIdentityCount === 0 &&
      semantic.repeatabilityClassifiedCount === 0 && semantic.mechanicsReviewCompleteCount === 0 && semantic.optimizerEligibleCount === 0 &&
      semantic.automaticVerificationCount === 0 && semantic.unsupportedPromotions?.length === 0 && (audit.accountStateFindings?.length || 0) === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function reconstructedSubmission(decision, queue, decisionPolicy) {
  return {
    ...expectedRenderedPageWithoutUnlockSemanticRelevanceBlankDecision(queue, decisionPolicy),
    decision: decision.decision,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes,
    evidenceKeys: decision.evidenceKeys
  };
}

function applicationFor(queue, decision, snapshots, policy, contentHash = hash) {
  const ambiguous = decision.decision === policy.ambiguousDecision;
  const relevant = decision.decision === policy.relevantDecision;
  const review = {
    decisionKey: decision.decisionKey,
    decision: decision.decision,
    evidenceKeys: decision.evidenceKeys,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes
  };
  const base = {
    contract: policy.outputContract,
    applicationKey: `${decision.decisionKey}|source-scoped-semantic-relevance-application`,
    decisionKey: decision.decisionKey,
    workQueueEntryKey: queue.workQueueEntryKey,
    sourceQueueSnapshotContentHash: snapshots.queue.contentHash,
    sourceDecisionSnapshotContentHash: snapshots.decision.contentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceQueueIntrinsicRecordContentHash: queue.recordContentHash,
    sourceDecisionRecordContentHash: decision.contentHash,
    sourceDecisionIntrinsicRecordContentHash: decision.recordContentHash,
    applicationPolicyContentHash: contentHash(policy),
    sourceSignatureKey: queue.sourceSignatureKey,
    queueEntryEvidenceFingerprint: queue.evidenceFingerprint,
    sourceQueueOrdinal: queue.sourceQueueOrdinal,
    provenancePartition: queue.provenancePartition,
    sourcePageIdentity: queue.sourcePageIdentity,
    reviewRoute: queue.reviewRoute,
    decision: decision.decision,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes,
    decisionEvidenceKeys: decision.evidenceKeys,
    semanticDisposition: decision.decision,
    semanticDispositionApplied: true,
    semanticRelevanceResolved: !ambiguous,
    sourceScopedSemanticRelevanceReview: review,
    authoritativeGameUniverseExclusion: false,
    requirementOrUnlockApplied: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    requirementsReviewComplete: false,
    variantsReviewComplete: false,
    xpTimingReviewComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      ambiguous ? 'source_scoped_semantic_relevance_ambiguous_additional_evidence_required' :
        relevant ? 'source_scoped_semantic_relevance_confirmed_pending_downstream_reconciliation' :
          'source_not_relevant_to_retained_training_guide_contexts_not_an_authoritative_game_universe_exclusion',
      'level_unlock_corpus_absence_reconciliation_pending',
      ...(queue.provenancePartition === 'direct_source_only' ? [] : ['historical_rendered_expansion_dependency_attribution_pending']),
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ]),
    state: ambiguous ? policy.ambiguousApplicationState : policy.resolvedApplicationState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function inputAssessment(options) {
  const {
    queueRecords = [], queueRaw = '', queueManifest = {}, queueSnapshot = {},
    decisionRecords = [], decisionRaw = '', decisionManifest = {}, decisionSnapshot = {},
    policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash
  } = options;
  const compiled = compileRenderedPageWithoutUnlockSemanticRelevanceApplicationPolicy(policy, queuePolicy, decisionPolicy, contentHash);
  const queueManifestAudit = queueManifestAssessment(queueRecords, queueRaw, queueManifest, queueSnapshot.contentHash, policy, contentHash);
  const decisionManifestAudit = decisionManifestAssessment(decisionRecords, decisionRaw, decisionManifest, decisionSnapshot.contentHash, queueSnapshot, policy, contentHash);
  const decisionIntegrityRows = decisionRecords.map(row => decisionIntegrity(row, policy, contentHash));
  const invalidDecisionKeys = decisionRecords.filter((_, index) => !decisionIntegrityRows[index].complete).map(row => row.decisionKey || 'unknown');
  const queueByWorkKey = new Map(queueRecords.map(row => [row.workQueueEntryKey, row]));
  const decisionWorkKeys = decisionRecords.map(row => row.workQueueEntryKey);
  const duplicateDecisionKeys = duplicates(decisionRecords.map(row => row.decisionKey));
  const duplicateDecisionWorkKeys = duplicates(decisionWorkKeys);
  const missingQueueBindingKeys = unique(decisionWorkKeys.filter(key => !queueByWorkKey.has(key)));
  const reconstructedSubmissions = decisionRecords.map(row => reconstructedSubmission(row, queueByWorkKey.get(row.workQueueEntryKey) || {}, decisionPolicy));
  const intrinsicDecisions = decisionIntegrityRows.map(row => row.intrinsic);
  const accountStateFindings = findAccountState([queueRecords, decisionRecords, reconstructedSubmissions]);
  const snapshotsExplicitAndBound = queueSnapshot.explicit === true && decisionSnapshot.explicit === true &&
    validHash(queueSnapshot.contentHash) && validHash(decisionSnapshot.contentHash) &&
    validIsoTimestamp(queueSnapshot.createdAt) && validIsoTimestamp(decisionSnapshot.createdAt);
  const importerPreconditionsComplete = compiled.valid && snapshotsExplicitAndBound && queueManifestAudit.complete && decisionManifestAudit.complete &&
    !invalidDecisionKeys.length && !duplicateDecisionKeys.length && !duplicateDecisionWorkKeys.length && !missingQueueBindingKeys.length && !accountStateFindings.length;
  let importer = { publishable: false, blockers: ['semantic_relevance_application_prevalidation_failed'] };
  if (importerPreconditionsComplete) {
    try {
      importer = auditRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport(intrinsicDecisions, {
        queueRecords, submissions: reconstructedSubmissions, policy: decisionPolicy, queuePolicy,
        queueSnapshotContentHash: queueSnapshot.contentHash, contentHash
      });
    } catch {
      importer = { publishable: false, blockers: ['guarded_decision_importer_rejected_or_failed'] };
    }
  }
  const importerComplete = importer.publishable === true && importer.queueCoverage?.completeQueueRecordCount === queueRecords.length &&
    importer.submissionCoverage?.completedSubmissionCount === decisionRecords.length && importer.submissionCoverage?.invalidSubmissionCount === 0 &&
    importer.recordCoverage?.recordedDecisionCount === decisionRecords.length && importer.recordCoverage?.recordMismatches?.length === 0 &&
    importer.recordCoverage?.recordHashFailures?.length === 0 && importer.semanticPreservationCoverage?.unsupportedPromotions?.length === 0 &&
    importer.accountStateFindings?.length === 0;
  const complete = compiled.valid && snapshotsExplicitAndBound && queueRecords.length > 0 && decisionRecords.length > 0 &&
    queueManifestAudit.complete && decisionManifestAudit.complete && !invalidDecisionKeys.length && !duplicateDecisionKeys.length &&
    !duplicateDecisionWorkKeys.length && !missingQueueBindingKeys.length && importerComplete && !accountStateFindings.length;
  return {
    compiled, queueManifestAudit, decisionManifestAudit, invalidDecisionKeys, duplicateDecisionKeys, duplicateDecisionWorkKeys,
    missingQueueBindingKeys, reconstructedSubmissions, importer, importerComplete, queueByWorkKey, accountStateFindings,
    snapshotsExplicitAndBound, complete
  };
}

function expectedApplication(options) {
  const input = inputAssessment(options);
  const records = input.complete ? options.decisionRecords.map(decision => applicationFor(
    input.queueByWorkKey.get(decision.workQueueEntryKey), decision,
    { queue: options.queueSnapshot, decision: options.decisionSnapshot }, options.policy, options.contentHash
  )) : [];
  return { input, records };
}

function auditFromExpected(records, expected, options) {
  const { queueRecords = [], decisionRecords = [], policy, contentHash } = options;
  const recordKeys = records.map(row => row.applicationKey);
  const expectedKeys = expected.records.map(row => row.applicationKey);
  const duplicateRecordKeys = duplicates(recordKeys);
  const missingRecordKeys = expectedKeys.filter(key => !recordKeys.includes(key));
  const unexpectedRecordKeys = recordKeys.filter(key => !expectedKeys.includes(key));
  const recordMismatchKeys = records.filter(row => {
    const match = expected.records.find(item => item.applicationKey === row.applicationKey);
    return !match || !same(row, match, contentHash) || !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'));
  }).map(row => row.applicationKey || 'unknown');
  const unsupportedPromotions = records.filter(row => row.semanticDispositionApplied !== true || row.semanticDisposition !== row.decision ||
    row.sourceScopedSemanticRelevanceReview === null || row.authoritativeGameUniverseExclusion !== false || row.requirementOrUnlockApplied !== false ||
    row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null ||
    row.requirementsReviewComplete !== false || row.variantsReviewComplete !== false || row.xpTimingReviewComplete !== false ||
    row.mechanicsReviewComplete !== false || row.optimizerEligible !== false || row.automaticVerificationApplied !== false || row.accountIndependent !== true
  ).map(row => row.applicationKey || 'unknown');
  const invalidOutcomeKeys = records.filter(row => {
    const ambiguous = row.decision === policy.ambiguousDecision;
    return ![policy.relevantDecision, policy.notRelevantDecision, policy.ambiguousDecision].includes(row.decision) ||
      row.semanticRelevanceResolved !== !ambiguous || row.state !== (ambiguous ? policy.ambiguousApplicationState : policy.resolvedApplicationState);
  }).map(row => row.applicationKey || 'unknown');
  const accountStateFindings = unique([...expected.input.accountStateFindings, ...findAccountState(records)]);
  const recordSetExact = records.length === expected.records.length && !duplicateRecordKeys.length && !missingRecordKeys.length &&
    !unexpectedRecordKeys.length && !recordMismatchKeys.length;
  const orderMatchesDecisionSet = same(records.map(row => row.decisionKey), decisionRecords.map(row => row.decisionKey), contentHash);
  const relevantAppliedCount = records.filter(row => row.decision === policy.relevantDecision && row.semanticDispositionApplied === true).length;
  const notRelevantAppliedCount = records.filter(row => row.decision === policy.notRelevantDecision && row.semanticDispositionApplied === true).length;
  const ambiguousAppliedCount = records.filter(row => row.decision === policy.ambiguousDecision && row.semanticDispositionApplied === true).length;
  const missingDecisionCount = Math.max(0, queueRecords.length - decisionRecords.length);
  const applicationComplete = recordSetExact && orderMatchesDecisionSet && !invalidOutcomeKeys.length && !unsupportedPromotions.length && !accountStateFindings.length;
  const semanticRelevanceReviewComplete = applicationComplete && records.length === queueRecords.length && !missingDecisionCount && ambiguousAppliedCount === 0;
  const blockers = [];
  if (!expected.input.compiled.valid) blockers.push('source_scoped_semantic_relevance_application_policy_invalid_or_specific');
  if (!expected.input.snapshotsExplicitAndBound) blockers.push('queue_and_decision_snapshots_not_explicit_valid_and_bound');
  if (!expected.input.queueManifestAudit.complete) blockers.push('selected_queue_snapshot_manifest_context_or_coverage_invalid');
  if (!expected.input.decisionManifestAudit.complete) blockers.push('selected_decision_snapshot_manifest_or_queue_binding_invalid');
  if (expected.input.invalidDecisionKeys.length || expected.input.duplicateDecisionKeys.length ||
      expected.input.duplicateDecisionWorkKeys.length || expected.input.missingQueueBindingKeys.length) {
    blockers.push('one_or_more_decision_records_not_exact_unique_or_queue_bound');
  }
  if (!expected.input.importerComplete) blockers.push('guarded_decision_importer_did_not_reproduce_selected_decision_set');
  if (!recordSetExact || !orderMatchesDecisionSet) blockers.push('application_record_set_does_not_exactly_match_selected_decisions');
  if (invalidOutcomeKeys.length) blockers.push('one_or_more_semantic_application_outcomes_violate_decision_specific_rules');
  if (unsupportedPromotions.length) blockers.push('semantic_relevance_application_created_unsupported_downstream_promotion');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  if (missingDecisionCount) blockers.push('one_or_more_source_scoped_semantic_relevance_decisions_missing');
  if (ambiguousAppliedCount) blockers.push('one_or_more_source_scoped_semantic_relevance_decisions_require_additional_evidence');
  const publishable = expected.input.complete && applicationComplete;
  return {
    contract: policy.auditContract,
    policyCoverage: expected.input.compiled,
    queueCoverage: {
      queueRecordCount: queueRecords.length,
      queueSnapshotContentHash: options.queueSnapshot?.contentHash,
      queueSnapshotCreatedAt: options.queueSnapshot?.createdAt,
      manifestChecks: expected.input.queueManifestAudit.checks
    },
    decisionCoverage: {
      decisionRecordCount: decisionRecords.length,
      decisionSnapshotContentHash: options.decisionSnapshot?.contentHash,
      decisionSnapshotCreatedAt: options.decisionSnapshot?.createdAt,
      manifestChecks: expected.input.decisionManifestAudit.checks,
      invalidDecisionKeys: expected.input.invalidDecisionKeys,
      duplicateDecisionKeys: expected.input.duplicateDecisionKeys,
      duplicateDecisionWorkKeys: expected.input.duplicateDecisionWorkKeys,
      missingQueueBindingKeys: expected.input.missingQueueBindingKeys,
      guardedImporterReproducedDecisionSet: expected.input.importerComplete,
      missingDecisionCount
    },
    bindingCoverage: {
      selectedSnapshotsExplicit: options.queueSnapshot?.explicit === true && options.decisionSnapshot?.explicit === true,
      orderMatchesDecisionSet,
      decisionQueueBindingExact: expected.input.decisionManifestAudit.checks.selectedQueueSnapshotMatches === true
    },
    applicationCoverage: {
      expectedApplicationRecordCount: expected.records.length,
      applicationRecordCount: records.length,
      relevantAppliedCount,
      notRelevantAppliedCount,
      ambiguousAppliedCount,
      resolvedAppliedCount: relevantAppliedCount + notRelevantAppliedCount,
      missingDecisionCount,
      duplicateRecordKeys, missingRecordKeys, unexpectedRecordKeys, recordMismatchKeys, invalidOutcomeKeys,
      applicationPolicyContentHash: contentHash(policy)
    },
    semanticPreservationCoverage: {
      unsupportedPromotions,
      semanticDispositionAppliedCount: records.filter(row => row.semanticDispositionApplied === true).length,
      semanticReviewAppliedCount: records.filter(row => row.sourceScopedSemanticRelevanceReview !== null).length,
      authoritativeGameUniverseExclusionCount: records.filter(row => row.authoritativeGameUniverseExclusion === true).length,
      requirementOrUnlockApplicationCount: records.filter(row => row.requirementOrUnlockApplied === true).length,
      canonicalIdentityPromotionCount: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length,
      repeatabilityPromotionCount: records.filter(row => row.repeatabilityClassification !== null).length,
      requirementsReviewPromotionCount: records.filter(row => row.requirementsReviewComplete === true).length,
      variantsReviewPromotionCount: records.filter(row => row.variantsReviewComplete === true).length,
      xpTimingReviewPromotionCount: records.filter(row => row.xpTimingReviewComplete === true).length,
      mechanicsPromotionCount: records.filter(row => row.mechanicsReviewComplete === true).length,
      optimizerPromotionCount: records.filter(row => row.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length
    },
    accountStateFindings,
    applicationBatchComplete: publishable,
    semanticRelevanceReviewComplete,
    reconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      'level_unlock_corpus_absence_reconciliation_pending',
      'historical_rendered_expansion_dependency_attribution_incomplete',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildRenderedPageWithoutUnlockSemanticRelevanceApplications(options = {}) {
  const normalized = { contentHash: hash, ...options };
  const expected = expectedApplication(normalized);
  const records = expected.input.complete ? expected.records : [];
  return { records, audit: auditFromExpected(records, expected, normalized) };
}

export function auditRenderedPageWithoutUnlockSemanticRelevanceApplications(records = [], options = {}) {
  const normalized = { contentHash: hash, ...options };
  const expected = expectedApplication(normalized);
  return auditFromExpected(records, expected, normalized);
}
