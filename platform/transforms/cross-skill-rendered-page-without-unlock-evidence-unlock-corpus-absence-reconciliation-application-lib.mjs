import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import { compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy } from './cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-lib.mjs';
import {
  auditUnlockCorpusAbsenceReconciliationReviewDecisionImport,
  compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy,
  expectedUnlockCorpusAbsenceBlankDecision
} from './cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-lib.mjs';

const QUEUE_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue';
const DECISION_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decisions';
const REQUIRED_RULES = [
  'queueAndDecisionSnapshotsMustBeExplicitlySelected',
  'queueManifestPolicySnapshotOuterIntrinsicCrosswalkAndCompleteCorpusBindingsMustRevalidate',
  'decisionManifestPolicySnapshotOuterIntrinsicQueueAndCorpusBindingsMustRevalidate',
  'everyDecisionMustReconstructAnExactlyValidGuardedImporterSubmission',
  'oneApplicationRecordPerDecisionInDecisionOrder',
  'everyAllowedRecordedHumanDecisionMayApplyOnlyItsExactReviewOutcome',
  'onlyConfirmedDecisionResolvesTheExactCorpusAbsenceFinding',
  'rejectedAndAdditionalEvidenceDecisionsRemainUnresolvedBlockers',
  'partialDecisionSetsMayProducePartialApplicationSnapshotsButCannotCompleteReview',
  'confirmedCorpusAbsenceCannotCreateANoRequirementClaim',
  'applicationCannotEstablishUnlockRequirementSemanticIdentityRepeatabilityVariantsXpTimingMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsSkillsAliasesFragmentsNamespacesAndOverridesCannotAlterPolicyBehavior',
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
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|alias|aliases|fragment|fragments|namespace|namespaces|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|alias|fragment|namespace).*(?:override|exception)s?$/i;
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

export function compileUnlockCorpusAbsenceReconciliationApplicationPolicy(policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const queuePolicyCoverage = compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy(queuePolicy, contentHash);
  const decisionPolicyCoverage = compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy(decisionPolicy, queuePolicy, contentHash);
  const decisions = [policy.confirmDecision, policy.rejectDecision, policy.additionalEvidenceDecision];
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-policy.v1' &&
    policy.queueContract === decisionPolicy.queueContract && policy.decisionContract === decisionPolicy.recordContract &&
    policy.outputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-record.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-audit.v1' &&
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

function queueManifestAssessment(queueRecords, queueRaw, manifest, snapshotHash, policy, queuePolicy, contentHash = hash) {
  const audit = manifest?.source?.audit || {};
  const inputs = audit.inputCoverage || {};
  const snapshots = audit.snapshotCoverage || {};
  const corpus = audit.corpusBindingCoverage || {};
  const absence = audit.absenceCoverage || {};
  const review = audit.reviewCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const inputSnapshots = manifest?.source?.inputSnapshots || {};
  const firstCorpus = queueRecords[0]?.corpusEvidence || {};
  const inputSnapshotBindingsComplete = ['workQueue', 'crosswalk', 'inventory', 'equivalence'].every(key =>
    typeof inputSnapshots[key]?.directory === 'string' && inputSnapshots[key].directory.length > 0 && validHash(inputSnapshots[key]?.contentHash));
  const checks = {
    contractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === QUEUE_DOMAIN,
    recordCountRawHashAndRowsMatch: manifest?.records === queueRecords.length && typeof queueRaw === 'string' &&
      contentHash(queueRaw) === snapshotHash && manifest?.contentHash === snapshotHash && rawRecordsMatch(queueRaw, queueRecords, contentHash),
    createdAtValid: validIsoTimestamp(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policy.inputQueuePolicy && manifest?.source?.policy?.contentHash === policy.inputQueuePolicyContentHash,
    inputSnapshotBindingsComplete,
    sourceSnapshotAuditsComplete: ['workQueue', 'crosswalk', 'inventory', 'equivalence'].every(key =>
      snapshots.snapshotContentHashValid?.[key] === true && snapshots.sourceAuditGatesValid?.[key] === true),
    sourceAndCorpusCountsConsistent: queueRecords.length > 0 && inputs.sourceWorkQueueRecordCount === queueRecords.length &&
      inputs.stableNoMatchCrosswalkRecordCount === queueRecords.length && inputs.inventorySkillRecordCount === firstCorpus.officialSkillCount &&
      inputs.equivalenceRecordCount === firstCorpus.stableWikiPageIdCount,
    queueGateAndAbsenceCoverageExact: audit.queueExportComplete === true && audit.absenceReconciliationComplete === false &&
      audit.completeActivityUniverse === false && audit.publishable === true && absence.outputRecordCount === queueRecords.length &&
      absence.zeroExactStablePageIdMatchCount === queueRecords.length && absence.duplicateOutputKeys?.length === 0 &&
      absence.missingOutputKeys?.length === 0 && absence.unexpectedOutputKeys?.length === 0 && absence.recordMismatchKeys?.length === 0 &&
      absence.nonZeroMatchSourceWorkQueueKeys?.length === 0 && absence.nonZeroMatchOutputKeys?.length === 0 && absence.orderMatchesSourceQueue === true,
    corpusRelationBindingExact: validHash(manifest?.source?.corpusEvidenceContentHash) &&
      corpus.corpusEvidenceContentHash === manifest.source.corpusEvidenceContentHash &&
      corpus.exactInventoryToEquivalenceStatementTargetRelationSet === true && corpus.duplicateInventoryRelationKeys?.length === 0 &&
      corpus.duplicateEquivalenceRelationKeys?.length === 0 && corpus.missingEquivalenceRelations?.length === 0 &&
      corpus.unexpectedEquivalenceRelations?.length === 0 && corpus.invalidStatementReferenceKeys?.length === 0 &&
      corpus.equivalenceSkillReferenceMismatchKeys?.length === 0,
    everyRecordBindsTheSameExactCorpusAndSourceSnapshots: queueRecords.every((row, index) =>
      row.queueOrdinal === index + 1 && row.corpusEvidenceContentHash === manifest?.source?.corpusEvidenceContentHash &&
      row.sourceWorkQueueSnapshotContentHash === inputSnapshots.workQueue?.contentHash &&
      row.sourceCrosswalkSnapshotContentHash === inputSnapshots.crosswalk?.contentHash &&
      row.corpusEvidence?.inventorySnapshotContentHash === inputSnapshots.inventory?.contentHash &&
      row.corpusEvidence?.equivalenceSnapshotContentHash === inputSnapshots.equivalence?.contentHash &&
      row.corpusEvidence?.officialSkillCount === firstCorpus.officialSkillCount &&
      row.corpusEvidence?.stableWikiPageIdCount === firstCorpus.stableWikiPageIdCount &&
      row.corpusEvidence?.capturedStatementCount === firstCorpus.capturedStatementCount &&
      row.matchEvidence?.exactStablePageIdMatchCount === 0 && row.matchEvidence?.machineObservedZeroMatch === true &&
      row.matchEvidence?.matchBasis === queuePolicy.matchBasis && row.corpusEvidence?.matchBasis === queuePolicy.matchBasis &&
      row.findingScope?.machineFinding === queuePolicy.machineFinding),
    reviewAndDownstreamGatesClosed: review.blankDecisionTemplateCount === queueRecords.length && review.reviewStartedCount === 0 &&
      review.completedReconciliationCount === 0 && semantic.noRequirementClaimCount === 0 && semantic.semanticDispositionCount === 0 &&
      semantic.canonicalGameEntityIdentityCount === 0 && semantic.canonicalActivityIdentityCount === 0 &&
      semantic.repeatabilityClassifiedCount === 0 && semantic.mechanicsReviewCompleteCount === 0 && semantic.optimizerEligibleCount === 0 &&
      semantic.automaticVerificationCount === 0 && (semantic.unsupportedPromotionKeys?.length || 0) === 0 &&
      (audit.accountStateFindings?.length || 0) === 0
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
    decisionRecordedButUnapplied: record.reviewDecisionRecorded === true && record.corpusAbsenceReconciliationApplied === false &&
      record.levelUnlockCorpusAbsenceReconciliation === null && record.noRequirementClaimApplied === false,
    downstreamGatesClosed: record.unlockEvidencePresent === false && record.semanticDisposition === null &&
      record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
      record.repeatabilityClassification === null && record.mechanicsReviewComplete === false && record.optimizerEligible === false &&
      record.automaticVerificationApplied === false && record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean), intrinsic };
}

function decisionManifestAssessment(decisionRecords, decisionRaw, manifest, snapshotHash, queueSnapshot, queueRecordCount, corpusEvidenceContentHash, policy, contentHash = hash) {
  const audit = manifest?.source?.audit || {};
  const queue = audit.queueCoverage || {};
  const submission = audit.submissionCoverage || {};
  const record = audit.recordCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    contractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === DECISION_DOMAIN,
    recordCountRawHashAndRowsMatch: manifest?.records === decisionRecords.length && typeof decisionRaw === 'string' &&
      contentHash(decisionRaw) === snapshotHash && manifest?.contentHash === snapshotHash && rawRecordsMatch(decisionRaw, decisionRecords, contentHash),
    createdAtValid: validIsoTimestamp(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policy.inputDecisionImportPolicy && manifest?.source?.policy?.contentHash === policy.inputDecisionImportPolicyContentHash,
    queuePolicyBindingMatches: manifest?.source?.inputQueuePolicy?.id === policy.inputQueuePolicy && manifest?.source?.inputQueuePolicy?.contentHash === policy.inputQueuePolicyContentHash,
    selectedQueueAndCorpusMatch: manifest?.source?.inputSnapshot?.directory === queueSnapshot.directory &&
      manifest?.source?.inputSnapshot?.contentHash === queueSnapshot.contentHash &&
      manifest?.source?.inputSnapshot?.corpusEvidenceContentHash === corpusEvidenceContentHash,
    queueAndSubmissionCoverageExact: queue.queueRecordCount === queueRecordCount && queue.validQueueRecordCount === queueRecordCount &&
      queue.duplicateQueueKeys?.length === 0 && queue.invalidQueueKeys?.length === 0 &&
      submission.completedSubmissionCount === decisionRecords.length && submission.invalidSubmissionIndexes?.length === 0,
    decisionGateAndCoverageMatch: audit.publishable === true && audit.absenceReconciliationComplete === false &&
      audit.completeActivityUniverse === false && record.recordedDecisionCount === decisionRecords.length &&
      record.duplicateRecordKeys?.length === 0 && record.missingRecordKeys?.length === 0 && record.unexpectedRecordKeys?.length === 0 &&
      record.recordMismatchKeys?.length === 0 && record.orderMatchesCompletedSubmissions === true,
    downstreamGatesClosed: semantic.corpusAbsenceApplications === 0 && semantic.noRequirementClaims === 0 &&
      semantic.unlockEvidenceApplications === 0 && semantic.semanticDispositionApplications === 0 &&
      semantic.canonicalIdentityPromotions === 0 && semantic.repeatabilityPromotions === 0 && semantic.mechanicsPromotions === 0 &&
      semantic.optimizerPromotions === 0 && semantic.automaticVerifications === 0 && semantic.unsupportedPromotions?.length === 0 &&
      (audit.accountStateFindings?.length || 0) === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function reconstructedSubmission(decision, queue, decisionPolicy) {
  return {
    ...expectedUnlockCorpusAbsenceBlankDecision(queue, decisionPolicy),
    disposition: decision.decision,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    evidenceKeys: decision.evidenceKeys,
    notes: decision.reviewNotes
  };
}

function applicationFor(queue, decision, snapshots, policy, contentHash = hash) {
  const confirmed = decision.decision === policy.confirmDecision;
  const rejected = decision.decision === policy.rejectDecision;
  const additional = decision.decision === policy.additionalEvidenceDecision;
  const reconciliation = {
    decisionKey: decision.decisionKey,
    decision: decision.decision,
    machineFinding: queue.findingScope.machineFinding,
    matchBasis: queue.matchEvidence.matchBasis,
    exactStablePageIdMatchCount: queue.matchEvidence.exactStablePageIdMatchCount,
    targetSourcePageId: queue.matchEvidence.targetSourcePageId,
    corpusEvidenceContentHash: queue.corpusEvidenceContentHash,
    evidenceKeys: decision.evidenceKeys,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes
  };
  const base = {
    contract: policy.outputContract,
    applicationKey: `${decision.decisionKey}|unlock-corpus-absence-reconciliation-application`,
    decisionKey: decision.decisionKey,
    absenceWorkEntryKey: queue.absenceWorkEntryKey,
    sourceQueueSnapshotContentHash: snapshots.queue.contentHash,
    sourceDecisionSnapshotContentHash: snapshots.decision.contentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceQueueIntrinsicRecordContentHash: queue.recordContentHash,
    sourceDecisionRecordContentHash: decision.contentHash,
    sourceDecisionIntrinsicRecordContentHash: decision.recordContentHash,
    applicationPolicyContentHash: contentHash(policy),
    sourceWorkQueueEntryKey: queue.sourceWorkQueueEntryKey,
    sourceWorkQueueRecordContentHash: queue.sourceWorkQueueRecordContentHash,
    sourceCrosswalkRecordContentHash: queue.sourceCrosswalkRecordContentHash,
    renderedTargetKey: queue.renderedTargetKey,
    stableWikiPageIdentity: queue.stableWikiPageIdentity,
    corpusEvidenceContentHash: queue.corpusEvidenceContentHash,
    corpusEvidence: queue.corpusEvidence,
    matchEvidence: queue.matchEvidence,
    findingScope: queue.findingScope,
    decision: decision.decision,
    reviewer: decision.reviewer,
    reviewedAt: decision.reviewedAt,
    reviewNotes: decision.reviewNotes,
    decisionEvidenceKeys: decision.evidenceKeys,
    corpusAbsenceReconciliationApplied: true,
    levelUnlockCorpusAbsenceReconciliation: reconciliation,
    corpusAbsenceFindingConfirmed: confirmed,
    corpusAbsenceFindingRejected: rejected,
    additionalLevelRequirementSourceReconciliationRequired: additional,
    corpusAbsenceFindingResolved: confirmed,
    noRequirementClaimApplied: false,
    unlockEvidencePresent: false,
    requirementOrUnlockApplied: false,
    semanticDisposition: null,
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
      confirmed ? 'exact_level_unlock_corpus_absence_confirmed_without_no_requirement_claim' :
        rejected ? 'level_unlock_corpus_absence_finding_rejected_pending_corpus_reaudit' :
          'additional_level_requirement_source_reconciliation_required',
      'absence_from_level_up_table_link_corpus_does_not_prove_no_requirement',
      'source_scoped_semantic_relevance_disposition_pending',
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
  const compiled = compileUnlockCorpusAbsenceReconciliationApplicationPolicy(policy, queuePolicy, decisionPolicy, contentHash);
  const corpusEvidenceContentHash = queueManifest?.source?.corpusEvidenceContentHash || '';
  const queueManifestAudit = queueManifestAssessment(queueRecords, queueRaw, queueManifest, queueSnapshot.contentHash, policy, queuePolicy, contentHash);
  const decisionManifestAudit = decisionManifestAssessment(
    decisionRecords, decisionRaw, decisionManifest, decisionSnapshot.contentHash, queueSnapshot,
    queueRecords.length, corpusEvidenceContentHash, policy, contentHash
  );
  const decisionIntegrityRows = decisionRecords.map(row => decisionIntegrity(row, policy, contentHash));
  const invalidDecisionKeys = decisionRecords.filter((_, index) => !decisionIntegrityRows[index].complete).map(row => row.decisionKey || 'unknown');
  const queueByKey = new Map(queueRecords.map(row => [row.absenceWorkEntryKey, row]));
  const decisionQueueKeys = decisionRecords.map(row => row.absenceWorkEntryKey);
  const duplicateDecisionKeys = duplicates(decisionRecords.map(row => row.decisionKey));
  const duplicateDecisionQueueKeys = duplicates(decisionQueueKeys);
  const missingQueueBindingKeys = unique(decisionQueueKeys.filter(key => !queueByKey.has(key)));
  const reconstructedSubmissions = decisionRecords.map(row => reconstructedSubmission(row, queueByKey.get(row.absenceWorkEntryKey) || {}, decisionPolicy));
  const intrinsicDecisions = decisionIntegrityRows.map(row => row.intrinsic);
  const accountStateFindings = findAccountState([queueRecords, decisionRecords, reconstructedSubmissions]);
  const snapshotsExplicitAndBound = queueSnapshot.explicit === true && decisionSnapshot.explicit === true &&
    validHash(queueSnapshot.contentHash) && validHash(decisionSnapshot.contentHash) &&
    validIsoTimestamp(queueSnapshot.createdAt) && validIsoTimestamp(decisionSnapshot.createdAt);
  const importerPreconditionsComplete = compiled.valid && snapshotsExplicitAndBound && queueManifestAudit.complete && decisionManifestAudit.complete &&
    !invalidDecisionKeys.length && !duplicateDecisionKeys.length && !duplicateDecisionQueueKeys.length && !missingQueueBindingKeys.length && !accountStateFindings.length;
  let importer = { publishable: false, blockers: ['unlock_corpus_absence_application_prevalidation_failed'] };
  if (importerPreconditionsComplete) {
    try {
      importer = auditUnlockCorpusAbsenceReconciliationReviewDecisionImport(intrinsicDecisions, {
        queueRecords, submissions: reconstructedSubmissions, policy: decisionPolicy, queuePolicy,
        queueSnapshotContentHash: queueSnapshot.contentHash, queueSnapshotCreatedAt: queueSnapshot.createdAt,
        queueManifestCorpusEvidenceContentHash: corpusEvidenceContentHash, contentHash
      });
    } catch {
      importer = { publishable: false, blockers: ['guarded_decision_importer_rejected_or_failed'] };
    }
  }
  const importerComplete = importer.publishable === true && importer.queueCoverage?.validQueueRecordCount === queueRecords.length &&
    importer.submissionCoverage?.completedSubmissionCount === decisionRecords.length && importer.submissionCoverage?.invalidSubmissionIndexes?.length === 0 &&
    importer.recordCoverage?.recordedDecisionCount === decisionRecords.length && importer.recordCoverage?.recordMismatchKeys?.length === 0 &&
    importer.semanticPreservationCoverage?.unsupportedPromotions?.length === 0 && importer.accountStateFindings?.length === 0;
  const complete = compiled.valid && snapshotsExplicitAndBound && queueRecords.length > 0 && decisionRecords.length > 0 &&
    queueManifestAudit.complete && decisionManifestAudit.complete && !invalidDecisionKeys.length && !duplicateDecisionKeys.length &&
    !duplicateDecisionQueueKeys.length && !missingQueueBindingKeys.length && importerComplete && !accountStateFindings.length;
  return {
    compiled, queueManifestAudit, decisionManifestAudit, invalidDecisionKeys, duplicateDecisionKeys, duplicateDecisionQueueKeys,
    missingQueueBindingKeys, reconstructedSubmissions, importer, importerComplete, queueByKey, accountStateFindings,
    snapshotsExplicitAndBound, corpusEvidenceContentHash, complete
  };
}

function expectedApplication(options) {
  const input = inputAssessment(options);
  const records = input.complete ? options.decisionRecords.map(decision => applicationFor(
    input.queueByKey.get(decision.absenceWorkEntryKey), decision,
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
  const unsupportedPromotions = records.filter(row => row.corpusAbsenceReconciliationApplied !== true ||
    row.levelUnlockCorpusAbsenceReconciliation === null || row.noRequirementClaimApplied !== false ||
    row.unlockEvidencePresent !== false || row.requirementOrUnlockApplied !== false || row.semanticDisposition !== null ||
    row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null ||
    row.requirementsReviewComplete !== false || row.variantsReviewComplete !== false || row.xpTimingReviewComplete !== false ||
    row.mechanicsReviewComplete !== false || row.optimizerEligible !== false || row.automaticVerificationApplied !== false || row.accountIndependent !== true
  ).map(row => row.applicationKey || 'unknown');
  const invalidOutcomeKeys = records.filter(row => {
    const confirmed = row.decision === policy.confirmDecision;
    const rejected = row.decision === policy.rejectDecision;
    const additional = row.decision === policy.additionalEvidenceDecision;
    return ![policy.confirmDecision, policy.rejectDecision, policy.additionalEvidenceDecision].includes(row.decision) ||
      row.corpusAbsenceFindingConfirmed !== confirmed || row.corpusAbsenceFindingRejected !== rejected ||
      row.additionalLevelRequirementSourceReconciliationRequired !== additional || row.corpusAbsenceFindingResolved !== confirmed ||
      row.state !== (confirmed ? policy.confirmedApplicationState : policy.unresolvedApplicationState) ||
      row.levelUnlockCorpusAbsenceReconciliation?.decision !== row.decision;
  }).map(row => row.applicationKey || 'unknown');
  const accountStateFindings = unique([...expected.input.accountStateFindings, ...findAccountState(records)]);
  const recordSetExact = records.length === expected.records.length && !duplicateRecordKeys.length && !missingRecordKeys.length &&
    !unexpectedRecordKeys.length && !recordMismatchKeys.length;
  const orderMatchesDecisionSet = same(records.map(row => row.decisionKey), decisionRecords.map(row => row.decisionKey), contentHash);
  const confirmedAppliedCount = records.filter(row => row.decision === policy.confirmDecision && row.corpusAbsenceFindingConfirmed === true).length;
  const rejectedAppliedCount = records.filter(row => row.decision === policy.rejectDecision && row.corpusAbsenceFindingRejected === true).length;
  const additionalEvidenceAppliedCount = records.filter(row => row.decision === policy.additionalEvidenceDecision && row.additionalLevelRequirementSourceReconciliationRequired === true).length;
  const unresolvedAppliedCount = rejectedAppliedCount + additionalEvidenceAppliedCount;
  const missingDecisionCount = Math.max(0, queueRecords.length - decisionRecords.length);
  const applicationComplete = recordSetExact && orderMatchesDecisionSet && !invalidOutcomeKeys.length && !unsupportedPromotions.length && !accountStateFindings.length;
  const unlockCorpusAbsenceReviewComplete = applicationComplete && records.length === queueRecords.length && !missingDecisionCount && !unresolvedAppliedCount;
  const blockers = [];
  if (!expected.input.compiled.valid) blockers.push('unlock_corpus_absence_reconciliation_application_policy_invalid_or_specific');
  if (!expected.input.snapshotsExplicitAndBound) blockers.push('queue_and_decision_snapshots_not_explicit_valid_and_bound');
  if (!expected.input.queueManifestAudit.complete) blockers.push('selected_absence_queue_snapshot_manifest_corpus_or_coverage_invalid');
  if (!expected.input.decisionManifestAudit.complete) blockers.push('selected_absence_decision_snapshot_manifest_or_queue_binding_invalid');
  if (expected.input.invalidDecisionKeys.length || expected.input.duplicateDecisionKeys.length ||
      expected.input.duplicateDecisionQueueKeys.length || expected.input.missingQueueBindingKeys.length) {
    blockers.push('one_or_more_absence_decision_records_not_exact_unique_or_queue_bound');
  }
  if (!expected.input.importerComplete) blockers.push('guarded_absence_decision_importer_did_not_reproduce_selected_decision_set');
  if (!recordSetExact || !orderMatchesDecisionSet) blockers.push('absence_application_record_set_does_not_exactly_match_selected_decisions');
  if (invalidOutcomeKeys.length) blockers.push('one_or_more_absence_application_outcomes_violate_decision_specific_rules');
  if (unsupportedPromotions.length) blockers.push('absence_application_created_unsupported_requirement_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  if (missingDecisionCount) blockers.push('one_or_more_unlock_corpus_absence_reconciliation_decisions_missing');
  if (rejectedAppliedCount) blockers.push('one_or_more_corpus_absence_findings_rejected_pending_corpus_reaudit');
  if (additionalEvidenceAppliedCount) blockers.push('one_or_more_level_requirement_source_reconciliations_require_additional_evidence');
  const publishable = expected.input.complete && applicationComplete;
  return {
    contract: policy.auditContract,
    policyCoverage: expected.input.compiled,
    queueCoverage: {
      queueRecordCount: queueRecords.length,
      queueSnapshotContentHash: options.queueSnapshot?.contentHash,
      queueSnapshotCreatedAt: options.queueSnapshot?.createdAt,
      corpusEvidenceContentHash: expected.input.corpusEvidenceContentHash,
      manifestChecks: expected.input.queueManifestAudit.checks
    },
    decisionCoverage: {
      decisionRecordCount: decisionRecords.length,
      decisionSnapshotContentHash: options.decisionSnapshot?.contentHash,
      decisionSnapshotCreatedAt: options.decisionSnapshot?.createdAt,
      manifestChecks: expected.input.decisionManifestAudit.checks,
      invalidDecisionKeys: expected.input.invalidDecisionKeys,
      duplicateDecisionKeys: expected.input.duplicateDecisionKeys,
      duplicateDecisionQueueKeys: expected.input.duplicateDecisionQueueKeys,
      missingQueueBindingKeys: expected.input.missingQueueBindingKeys,
      guardedImporterReproducedDecisionSet: expected.input.importerComplete,
      missingDecisionCount
    },
    bindingCoverage: {
      selectedSnapshotsExplicit: options.queueSnapshot?.explicit === true && options.decisionSnapshot?.explicit === true,
      orderMatchesDecisionSet,
      decisionQueueBindingExact: expected.input.decisionManifestAudit.checks.selectedQueueAndCorpusMatch === true
    },
    applicationCoverage: {
      expectedApplicationRecordCount: expected.records.length,
      applicationRecordCount: records.length,
      confirmedAppliedCount,
      rejectedAppliedCount,
      additionalEvidenceAppliedCount,
      unresolvedAppliedCount,
      missingDecisionCount,
      duplicateRecordKeys, missingRecordKeys, unexpectedRecordKeys, recordMismatchKeys, invalidOutcomeKeys,
      applicationPolicyContentHash: contentHash(policy)
    },
    semanticPreservationCoverage: {
      unsupportedPromotions,
      corpusAbsenceReconciliationAppliedCount: records.filter(row => row.corpusAbsenceReconciliationApplied === true).length,
      noRequirementClaimCount: records.filter(row => row.noRequirementClaimApplied === true).length,
      unlockEvidenceApplicationCount: records.filter(row => row.unlockEvidencePresent === true).length,
      requirementOrUnlockApplicationCount: records.filter(row => row.requirementOrUnlockApplied === true).length,
      semanticDispositionApplicationCount: records.filter(row => row.semanticDisposition !== null).length,
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
    unlockCorpusAbsenceReviewComplete,
    absenceReconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      'absence_from_level_up_table_link_corpus_does_not_prove_no_requirement',
      'source_scoped_semantic_relevance_disposition_pending',
      'historical_rendered_expansion_dependency_attribution_incomplete',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildUnlockCorpusAbsenceReconciliationApplications(options = {}) {
  const normalized = { contentHash: hash, ...options };
  const expected = expectedApplication(normalized);
  const records = expected.input.complete ? expected.records : [];
  return { records, audit: auditFromExpected(records, expected, normalized) };
}

export function auditUnlockCorpusAbsenceReconciliationApplications(records = [], options = {}) {
  const normalized = { contentHash: hash, ...options };
  const expected = expectedApplication(normalized);
  return auditFromExpected(records, expected, normalized);
}
