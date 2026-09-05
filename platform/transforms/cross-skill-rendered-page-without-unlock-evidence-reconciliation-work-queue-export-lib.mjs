import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import { auditRenderedPageWithoutUnlockEvidencePartition } from './cross-skill-rendered-page-without-unlock-evidence-partition-lib.mjs';

const PARTITIONS = ['direct_source_only', 'mixed_direct_and_unattributed_rendered', 'rendered_only_origin_unattributed'];
const CHANNELS = ['revision_pinned_target_source_signature', 'source_scoped_semantic_relevance_disposition', 'level_unlock_corpus_absence_reconciliation', 'historical_rendered_expansion_dependency_attribution'];
const REQUIRED_RULES = [
  'everyValidPartitionRecordMustEnterTheQueueExactlyOnce', 'partitionCandidateAndBothSnapshotHashesMustRevalidate',
  'queueOrderMustBePartitionThenRenderedTargetKey', 'requiredEvidenceChannelsMustExactlyPreserveThePartitionRoute',
  'everyEntryMustRetainStableWikiIdentityAndSourcePopulationBindings', 'evidenceCollectionMustStartEmpty',
  'historicalAttributionIsRequiredOnlyWhenThePartitionRequiresIt',
  'titlesNamespacesPageIdsParserChannelsAndOverridesCannotAlterWorkRouting',
  'queueExportCannotEstablishUnlockSemanticIdentityRepeatabilityMechanicsOrOptimizerState', 'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => (left === undefined || right === undefined) ? left === right : contentHash(left) === contentHash(right);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:titleOverrides|namespaceOverrides|pageIdOverrides|parserChannelOverrides|partitionOverrides|overrides|exceptions)$/i;
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

export function compileRenderedPageWithoutUnlockReconciliationWorkQueuePolicy(policy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-policy.v1' &&
    policy.inputPartitionContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-partition.v1' &&
    policy.inputCandidateContract === 'sensum.cross-source-entity-activity-candidate.v1' &&
    policy.outputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-entry.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-audit.v1';
  const vocabularyValid = same(policy.partitionOrder || [], PARTITIONS, contentHash) && same(policy.evidenceChannels || [], CHANNELS, contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractsValid && vocabularyValid && invalidRules.length === 0 && forbidden.length === 0, contractsValid, vocabularyValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function emptyEvidenceCollection() {
  return {
    evidenceKeys: [], revisionPinnedTargetSourceSignature: null, sourceScopedSemanticRelevanceDisposition: null,
    levelUnlockCorpusAbsenceReconciliation: null, historicalRenderedExpansionDependencyAttribution: null
  };
}

function expectedWorkRecord(partition, policy, partitionSnapshotContentHash, contentHash = hash) {
  const base = {
    contract: policy.outputContract,
    workQueueEntryKey: `${partition.partitionKey}|source-bound-reconciliation-work`,
    queueOrdinal: 0,
    partitionOrdinal: 0,
    sourcePartitionKey: partition.partitionKey,
    sourcePartitionRecordContentHash: partition.contentHash,
    sourcePartitionIntrinsicRecordContentHash: partition.recordContentHash,
    sourcePartitionSnapshotContentHash: partitionSnapshotContentHash,
    sourceCandidateContentHash: partition.sourceCandidateContentHash,
    sourceCandidateSnapshotContentHash: partition.sourceCandidateSnapshotContentHash,
    renderedTargetKey: partition.renderedTargetKey,
    stableWikiPageIdentity: partition.stableWikiPageIdentity,
    requestedTitles: partition.requestedTitles,
    namespaceIds: partition.namespaceIds,
    guideObservationCount: partition.guideObservationCount,
    guideSourceBindingCount: partition.guideSourceBindingCount,
    guideSourceBindingsContentHash: partition.guideSourceBindingsContentHash,
    renderedObservationSetContentHash: partition.renderedObservationSetContentHash,
    parserChannelCounts: partition.parserChannelCounts,
    sourcePresenceCounts: partition.sourcePresenceCounts,
    provenancePartition: partition.provenancePartition,
    requiredEvidenceChannels: partition.requiredNextEvidenceChannels,
    historicalRenderedAttributionRequired: partition.requiredNextEvidenceChannels.includes('historical_rendered_expansion_dependency_attribution'),
    evidenceCollection: emptyEvidenceCollection(),
    unlockEvidencePresent: false,
    semanticDisposition: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([...partition.requiredNextEvidenceChannels.map(channel => `${channel}_pending`), 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'optimizer_eligibility_blocked']),
    state: 'blocked_pending_source_bound_no_unlock_evidence_reconciliation'
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function orderedExpected(partitionRecords, policy, partitionSnapshotContentHash, contentHash = hash) {
  const order = new Map(policy.partitionOrder.map((value, index) => [value, index]));
  const records = partitionRecords.map(row => expectedWorkRecord(row, policy, partitionSnapshotContentHash, contentHash)).sort((left, right) =>
    order.get(left.provenancePartition) - order.get(right.provenancePartition) || left.renderedTargetKey.localeCompare(right.renderedTargetKey));
  const counters = new Map();
  records.forEach((record, index) => {
    record.queueOrdinal = index + 1;
    const next = (counters.get(record.provenancePartition) || 0) + 1;
    counters.set(record.provenancePartition, next);
    record.partitionOrdinal = next;
    record.recordContentHash = contentHash(without(record, 'recordContentHash'));
  });
  return records;
}

function partitionOuterHashValid(record, contentHash = hash) {
  return validHash(record?.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash;
}

function evidenceCollectionEmpty(record = {}) {
  const evidence = record.evidenceCollection || {};
  return Array.isArray(evidence.evidenceKeys) && evidence.evidenceKeys.length === 0 &&
    evidence.revisionPinnedTargetSourceSignature === null && evidence.sourceScopedSemanticRelevanceDisposition === null &&
    evidence.levelUnlockCorpusAbsenceReconciliation === null && evidence.historicalRenderedExpansionDependencyAttribution === null;
}

function semanticGatesClosed(record = {}) {
  return record.unlockEvidencePresent === false && record.semanticDisposition === null && record.canonicalGameEntityIdentity === null &&
    record.canonicalActivityIdentity === null && record.repeatabilityClassification === null && record.mechanicsReviewComplete === false &&
    record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true;
}

export function renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown(records = []) {
  const lines = ['# Rendered pages without unlock evidence — reconciliation work queue', '', 'This queue binds provenance and evidence obligations only. It does not establish an unlock, semantic identity, activity, repeatability result, mechanics verdict, or optimizer candidate.', ''];
  for (const partition of PARTITIONS) {
    const rows = records.filter(row => row.provenancePartition === partition);
    lines.push(`## ${partition} (${rows.length})`, '');
    for (const row of rows) {
      const title = String(row.stableWikiPageIdentity?.resolvedTitle || row.renderedTargetKey).replaceAll('|', '\\|');
      lines.push(`${row.queueOrdinal}. ${title} — page ${row.stableWikiPageIdentity?.sourcePageId}, revision ${row.stableWikiPageIdentity?.sourceRevision}; ${row.guideObservationCount} observations; evidence: ${row.requiredEvidenceChannels.join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function buildRenderedPageWithoutUnlockReconciliationWorkQueue({ partitionRecords = [], candidateRecords = [], policy = {}, partitionPolicy = {}, partitionSnapshotContentHash = '', candidateSnapshotContentHash = '', contentHash = hash } = {}) {
  const compiled = compileRenderedPageWithoutUnlockReconciliationWorkQueuePolicy(policy, contentHash);
  const barePartitions = partitionRecords.map(row => without(row, 'contentHash'));
  const upstream = auditRenderedPageWithoutUnlockEvidencePartition(barePartitions, { candidateRecords, policy: partitionPolicy, sourceCandidateSnapshotContentHash: candidateSnapshotContentHash, contentHash });
  const outerHashesValid = partitionRecords.every(row => partitionOuterHashValid(row, contentHash));
  const inputsValid = compiled.valid && upstream.publishable === true && outerHashesValid && validHash(partitionSnapshotContentHash) && validHash(candidateSnapshotContentHash) &&
    partitionRecords.length > 0 && !duplicates(partitionRecords.map(row => row.partitionKey)).length && partitionRecords.every(row => row.sourceCandidateSnapshotContentHash === candidateSnapshotContentHash);
  const proposed = inputsValid ? orderedExpected(partitionRecords, policy, partitionSnapshotContentHash, contentHash) : [];
  const markdown = renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown(proposed);
  const firstAudit = auditRenderedPageWithoutUnlockReconciliationWorkQueue(proposed, { partitionRecords, candidateRecords, policy, partitionPolicy, partitionSnapshotContentHash, candidateSnapshotContentHash, markdown, contentHash });
  if (firstAudit.publishable) return { records: proposed, markdown, audit: firstAudit };
  const emptyMarkdown = renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown([]);
  return { records: [], markdown: emptyMarkdown, audit: auditRenderedPageWithoutUnlockReconciliationWorkQueue([], { partitionRecords, candidateRecords, policy, partitionPolicy, partitionSnapshotContentHash, candidateSnapshotContentHash, markdown: emptyMarkdown, contentHash }) };
}

export function auditRenderedPageWithoutUnlockReconciliationWorkQueue(records = [], { partitionRecords = [], candidateRecords = [], policy = {}, partitionPolicy = {}, partitionSnapshotContentHash = '', candidateSnapshotContentHash = '', markdown = '', contentHash = hash } = {}) {
  const compiled = compileRenderedPageWithoutUnlockReconciliationWorkQueuePolicy(policy, contentHash);
  const barePartitions = partitionRecords.map(row => without(row, 'contentHash'));
  const upstream = auditRenderedPageWithoutUnlockEvidencePartition(barePartitions, { candidateRecords, policy: partitionPolicy, sourceCandidateSnapshotContentHash: candidateSnapshotContentHash, contentHash });
  const invalidPartitionKeys = partitionRecords.filter(row => !partitionOuterHashValid(row, contentHash)).map(row => row.partitionKey);
  const bindingMismatchKeys = partitionRecords.filter(row => row.sourceCandidateSnapshotContentHash !== candidateSnapshotContentHash || !candidateRecords.some(candidate => candidate.contentHash === row.sourceCandidateContentHash && candidate.renderedTargetKey === row.renderedTargetKey)).map(row => row.partitionKey);
  const canDerive = compiled.valid && upstream.publishable === true && invalidPartitionKeys.length === 0 && bindingMismatchKeys.length === 0 && validHash(partitionSnapshotContentHash) && validHash(candidateSnapshotContentHash);
  const expected = canDerive ? orderedExpected(partitionRecords, policy, partitionSnapshotContentHash, contentHash) : [];
  const expectedByKey = new Map(expected.map(row => [row.sourcePartitionKey, row]));
  const inputKeys = partitionRecords.map(row => row.partitionKey);
  const outputKeys = records.map(row => row.sourcePartitionKey);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const mismatchKeys = records.filter(row => !same(row, expectedByKey.get(row.sourcePartitionKey), contentHash) || !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'))).map(row => row.sourcePartitionKey);
  const evidenceStartedKeys = records.filter(row => !evidenceCollectionEmpty(row)).map(row => row.sourcePartitionKey);
  const promotionKeys = records.filter(row => !semanticGatesClosed(row)).map(row => row.sourcePartitionKey);
  const expectedMarkdown = renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown(records);
  const accountStateFindings = findAccountState([...partitionRecords, ...candidateRecords, ...records]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('reconciliation_work_queue_policy_invalid_or_specific');
  if (upstream.publishable !== true) structuralBlockers.push('source_partition_did_not_revalidate');
  if (!validHash(partitionSnapshotContentHash) || !validHash(candidateSnapshotContentHash)) structuralBlockers.push('input_snapshot_hash_missing_or_invalid');
  if (duplicateInputKeys.length || invalidPartitionKeys.length || bindingMismatchKeys.length) structuralBlockers.push('partition_candidate_or_snapshot_binding_invalid');
  if (duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('queue_target_set_not_exact');
  if (mismatchKeys.length) structuralBlockers.push('one_or_more_queue_records_mismatch_generic_policy_output');
  if (markdown !== expectedMarkdown) structuralBlockers.push('readable_queue_artifact_mismatch');
  if (evidenceStartedKeys.length) structuralBlockers.push('evidence_collection_not_empty_at_export');
  if (promotionKeys.length) structuralBlockers.push('queue_applied_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('current_account_state_present');
  const queueExportComplete = partitionRecords.length > 0 && structuralBlockers.length === 0;
  const countByPartition = Object.fromEntries(PARTITIONS.map(value => [value, records.filter(row => row.provenancePartition === value).length]));
  const countByChannel = Object.fromEntries(CHANNELS.map(value => [value, records.filter(row => row.requiredEvidenceChannels?.includes(value)).length]));
  return {
    contract: policy.auditContract,
    inputCoverage: { partitionRecordCount: partitionRecords.length, candidateRecordCount: candidateRecords.length, upstreamValidPartitionRecordCount: upstream.inputCoverage?.validEligibleRenderedPageCount || 0, invalidPartitionKeys, duplicatePartitionKeys: duplicateInputKeys },
    policyCoverage: { policyValid: compiled.valid, contractsValid: compiled.contractsValid, vocabularyValid: compiled.vocabularyValid, invalidRules: compiled.invalidRules, forbiddenPolicyPaths: compiled.forbiddenPolicyPaths },
    bindingCoverage: { partitionSnapshotContentHashValid: validHash(partitionSnapshotContentHash), candidateSnapshotContentHashValid: validHash(candidateSnapshotContentHash), partitionCandidateOrSnapshotBindingMismatchKeys: bindingMismatchKeys },
    queueCoverage: { outputRecordCount: records.length, partitionCounts: countByPartition, duplicateOutputPartitionKeys: duplicateOutputKeys, missingOutputPartitionKeys: missingKeys, unexpectedOutputPartitionKeys: unexpectedKeys, recordMismatchPartitionKeys: mismatchKeys, orderMatchesPolicy: same(records.map(row => row.sourcePartitionKey), expected.map(row => row.sourcePartitionKey), contentHash) },
    sourceBoundCoverage: { stableWikiIdentityCount: records.filter(row => row.stableWikiPageIdentity).length, guideObservationCount: records.reduce((sum, row) => sum + row.guideObservationCount, 0), guideSourceBindingCount: records.reduce((sum, row) => sum + row.guideSourceBindingCount, 0), distinctGuideRevisionBindingCount: upstream.sourceIntegrityCoverage?.distinctGuideRevisionBindingCount || 0, guideRevisionBindingsContentHash: upstream.sourceIntegrityCoverage?.guideRevisionBindingsContentHash || null, partitionSnapshotBoundCount: records.filter(row => row.sourcePartitionSnapshotContentHash === partitionSnapshotContentHash).length, candidateSnapshotBoundCount: records.filter(row => row.sourceCandidateSnapshotContentHash === candidateSnapshotContentHash).length },
    evidenceWorkCoverage: { requiredChannelCounts: countByChannel, historicalRenderedAttributionRequiredCount: records.filter(row => row.historicalRenderedAttributionRequired).length, evidenceCollectionStartedCount: evidenceStartedKeys.length, evidenceCollectionStartedPartitionKeys: evidenceStartedKeys, sourceBoundReconciliationCompletedCount: 0 },
    artifactCoverage: { readableQueueContentHash: contentHash(markdown), expectedReadableQueueContentHash: contentHash(expectedMarkdown), readableQueueMatches: markdown === expectedMarkdown },
    semanticPreservationCoverage: { unlockEvidenceAppliedCount: records.filter(row => row.unlockEvidencePresent === true).length, semanticDispositionCount: records.filter(row => row.semanticDisposition !== null).length, canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length, canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length, repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length, mechanicsReviewCompleteCount: records.filter(row => row.mechanicsReviewComplete === true).length, optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length, automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length, unsupportedPromotionPartitionKeys: promotionKeys },
    accountStateFindings,
    queueExportComplete,
    reconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers, 'source_bound_target_signature_collection_pending', 'source_scoped_semantic_relevance_disposition_pending', 'level_unlock_corpus_absence_reconciliation_pending', 'historical_rendered_expansion_dependency_attribution_incomplete', 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'independent_complete_activity_universe_not_established']),
    publishable: queueExportComplete
  };
}
