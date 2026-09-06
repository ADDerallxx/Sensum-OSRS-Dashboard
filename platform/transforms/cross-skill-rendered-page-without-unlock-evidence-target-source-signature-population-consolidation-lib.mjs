import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';

const QUEUE_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue';
const SHARD_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard';
const REQUIRED_RULES = [
  'queueSnapshotManifestAndRecordsMustRevalidate',
  'shardSnapshotManifestsRecordsAndAuditsMustRevalidate',
  'equivalentRerunsForTheSameOrdinalRangeMustHaveIdenticalContent',
  'oneDeterministicShardRepresentativePerOrdinalRange',
  'selectedShardRangesMustBeDisjointAndCoverTheQueueExactly',
  'everyQueueEntryMustHaveExactlyOneBoundSignature',
  'everySignatureMustRevalidateItsQueueSnapshotEntryAndExactSourceIdentity',
  'sourceStructureRemainsEvidenceNotSemanticVerdict',
  'canonicalIdentityRepeatabilityMechanicsAndOptimizerEligibilityRemainClosed',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash) => contentHash(left) === contentHash(right);
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));

export function compileRenderedPageWithoutUnlockTargetSourceSignaturePopulationPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const valid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population-consolidation-policy.v1' &&
    policy.inputQueueContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-entry.v1' &&
    policy.inputQueuePolicy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-policy.v1' && validHash(policy.inputQueuePolicyContentHash) &&
    policy.inputRecordContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature.v1' &&
    policy.inputShardAuditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard-audit.v1' &&
    policy.inputShardPolicy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature-policy.v1' && validHash(policy.inputShardPolicyContentHash) &&
    policy.outputRecordContract === policy.inputRecordContract &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population-audit.v1' &&
    invalidRules.length === 0;
  return { valid, invalidRules: unique(invalidRules) };
}

function recordHashesValid(record, contentHash) {
  return validHash(record?.contentHash) && record.contentHash === contentHash(without(record, 'contentHash')) &&
    validHash(record?.recordContentHash) && record.recordContentHash === contentHash(without(record, 'contentHash', 'recordContentHash'));
}

function queueSnapshotValid(snapshot, policy, contentHash) {
  const { manifest, records = [], rawContentHash } = snapshot || {};
  return manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest.domain === QUEUE_DOMAIN &&
    manifest.records === records.length && records.length > 0 && validHash(rawContentHash) && manifest.contentHash === rawContentHash &&
    manifest.source?.policy?.id === policy.inputQueuePolicy && manifest.source.policy.contentHash === policy.inputQueuePolicyContentHash &&
    manifest.source?.audit?.queueExportComplete === true && manifest.source.audit.publishable === true &&
    manifest.source.audit.reconciliationComplete === false && manifest.source.audit.completeActivityUniverse === false &&
    records.every((record, index) => record.contract === policy.inputQueueContract && record.queueOrdinal === index + 1 && recordHashesValid(record, contentHash));
}

function shardRange(snapshot) {
  const coverage = snapshot?.manifest?.source?.audit?.inputCoverage || {};
  return {
    first: coverage.selectedFirstOrdinal,
    last: coverage.selectedLastOrdinal,
    count: coverage.selectedQueueEntryCount
  };
}

function shardSnapshotValid(snapshot, policy, queueSnapshot, contentHash) {
  const { manifest, records = [], rawContentHash } = snapshot || {};
  const audit = manifest?.source?.audit || {};
  const range = shardRange(snapshot);
  const fetched = manifest?.source?.fetchedRevisions || [];
  const fetchedByRevision = new Map(fetched.map(row => [String(row.revision), row]));
  return manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest.domain === SHARD_DOMAIN &&
    manifest.records === records.length && records.length > 0 && validHash(rawContentHash) && manifest.contentHash === rawContentHash &&
    manifest.source?.policy?.id === policy.inputShardPolicy && manifest.source.policy.contentHash === policy.inputShardPolicyContentHash &&
    audit.contract === policy.inputShardAuditContract && audit.sourceSignatureShardComplete === true &&
    audit.sourceSignaturePopulationComplete === false && audit.publishable === true && audit.completeActivityUniverse === false &&
    manifest.source?.inputQueueSnapshot?.contentHash === queueSnapshot.manifest?.contentHash &&
    Number.isInteger(range.first) && Number.isInteger(range.last) && Number.isInteger(range.count) &&
    range.count === records.length && range.last - range.first + 1 === records.length &&
    records.every((record, index) => {
      const source = fetchedByRevision.get(String(record.sourceRevision));
      return record.contract === policy.inputRecordContract && record.queueOrdinal === range.first + index &&
        recordHashesValid(record, contentHash) && source?.pageId === record.sourcePageId && source.namespaceId === record.sourceNamespaceId &&
        source.title === record.resolvedTitle && String(source.revision) === String(record.sourceRevision) &&
        source.timestamp === record.sourceTimestamp && source.contentHash === record.sourceContentHash;
    });
}

function selectShardRepresentatives(shardSnapshots, validSnapshots) {
  const groups = new Map();
  for (const snapshot of validSnapshots) {
    const range = shardRange(snapshot);
    const key = `${range.first}-${range.last}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(snapshot);
  }
  const conflictingRanges = [];
  const representatives = [];
  for (const [key, snapshots] of [...groups.entries()].sort((left, right) => shardRange(left[1][0]).first - shardRange(right[1][0]).first)) {
    const hashes = unique(snapshots.map(snapshot => snapshot.manifest.contentHash));
    if (hashes.length !== 1) conflictingRanges.push(key);
    representatives.push([...snapshots].sort((left, right) => String(left.directory).localeCompare(String(right.directory)))[0]);
  }
  return { groups, conflictingRanges, representatives, invalidDirectories: shardSnapshots.filter(snapshot => !validSnapshots.includes(snapshot)).map(snapshot => snapshot.directory) };
}

function signatureBindingMismatch(record, queue, queueSnapshotHash, policy, contentHash) {
  const identity = queue?.stableWikiPageIdentity || {};
  const namespaceAllowed = queue?.namespaceIds?.includes(record.sourceNamespaceId) || identity.redirected === true;
  return !queue || record.contract !== policy.inputRecordContract || !recordHashesValid(record, contentHash) ||
    record.signatureKey !== `${queue.workQueueEntryKey}|target-source-signature` ||
    record.sourceWorkQueueEntryKey !== queue.workQueueEntryKey || record.sourceWorkQueueEntryContentHash !== queue.contentHash ||
    record.sourceWorkQueueEntryIntrinsicContentHash !== queue.recordContentHash || record.sourceWorkQueueSnapshotContentHash !== queueSnapshotHash ||
    record.partitionOrdinal !== queue.partitionOrdinal || record.provenancePartition !== queue.provenancePartition ||
    record.renderedTargetKey !== queue.renderedTargetKey || !same(record.requestedTitles, queue.requestedTitles, contentHash) ||
    !same(record.observedNamespaceIds, queue.namespaceIds, contentHash) || record.sourcePageId !== identity.sourcePageId ||
    String(record.sourceRevision) !== String(identity.sourceRevision) || record.sourceTimestamp !== identity.sourceTimestamp ||
    record.resolvedTitle !== identity.resolvedTitle || record.sourceUrl !== identity.sourceUrl || !namespaceAllowed ||
    !Object.values(record.revisionAlignment || {}).every(Boolean) || record.accountIndependent !== true;
}

function semanticPromotion(record) {
  return record.sourceScopedSemanticRelevanceReview?.state !== 'unreviewed' ||
    record.sourceScopedSemanticRelevanceReview?.disposition !== null || record.sourceScopedSemanticRelevanceReview?.evidenceKeys?.length ||
    record.unlockEvidencePresent !== false || record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null ||
    record.repeatabilityClassification !== null || record.mechanicsReviewComplete !== false || record.optimizerEligible !== false ||
    record.automaticVerificationApplied !== false;
}

export function auditRenderedPageWithoutUnlockTargetSourceSignaturePopulation(records = [], { queueSnapshot = {}, shardSnapshots = [], policy = {}, contentHash = value => value } = {}) {
  const compiled = compileRenderedPageWithoutUnlockTargetSourceSignaturePopulationPolicy(policy);
  const queueValid = compiled.valid && queueSnapshotValid(queueSnapshot, policy, contentHash);
  const validSnapshots = queueValid ? shardSnapshots.filter(snapshot => shardSnapshotValid(snapshot, policy, queueSnapshot, contentHash)) : [];
  const selected = selectShardRepresentatives(shardSnapshots, validSnapshots);
  const queueRecords = queueSnapshot.records || [];
  const queueByOrdinal = new Map(queueRecords.map(record => [record.queueOrdinal, record]));
  const expectedOrdinals = queueRecords.map(record => record.queueOrdinal);
  const actualOrdinals = records.map(record => record.queueOrdinal);
  const expectedKeys = queueRecords.map(record => `${record.workQueueEntryKey}|target-source-signature`);
  const actualKeys = records.map(record => record.signatureKey);
  const missingOrdinals = expectedOrdinals.filter(ordinal => !actualOrdinals.includes(ordinal));
  const unexpectedOrdinals = actualOrdinals.filter(ordinal => !expectedOrdinals.includes(ordinal));
  const duplicateOrdinals = duplicates(actualOrdinals);
  const missingSignatureKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedSignatureKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const duplicateSignatureKeys = duplicates(actualKeys);
  const bindingMismatchOrdinals = records.filter(record => signatureBindingMismatch(record, queueByOrdinal.get(record.queueOrdinal), queueSnapshot.manifest?.contentHash, policy, contentHash)).map(record => record.queueOrdinal);
  const semanticPromotionOrdinals = records.filter(semanticPromotion).map(record => record.queueOrdinal);
  const accountStateFindings = findAccountState([...queueRecords, ...records]);
  const selectedRanges = selected.representatives.map(snapshot => ({ directory: snapshot.directory, contentHash: snapshot.manifest.contentHash, ...shardRange(snapshot) }));
  const overlappingRangePairs = [];
  for (let index = 1; index < selectedRanges.length; index++) if (selectedRanges[index].first <= selectedRanges[index - 1].last) overlappingRangePairs.push(`${selectedRanges[index - 1].first}-${selectedRanges[index - 1].last}|${selectedRanges[index].first}-${selectedRanges[index].last}`);
  const orderMatchesQueue = actualOrdinals.every((ordinal, index) => ordinal === expectedOrdinals[index]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('population_consolidation_policy_invalid');
  if (!queueValid) structuralBlockers.push('input_queue_snapshot_manifest_or_records_invalid');
  if (selected.invalidDirectories.length) structuralBlockers.push('one_or_more_shard_snapshots_invalid');
  if (selected.conflictingRanges.length) structuralBlockers.push('equivalent_shard_reruns_have_conflicting_content');
  if (overlappingRangePairs.length) structuralBlockers.push('selected_shard_ranges_overlap');
  if (missingOrdinals.length || unexpectedOrdinals.length || duplicateOrdinals.length || missingSignatureKeys.length || unexpectedSignatureKeys.length || duplicateSignatureKeys.length || !orderMatchesQueue) structuralBlockers.push('queue_and_consolidated_signature_population_do_not_match_exactly');
  if (bindingMismatchOrdinals.length) structuralBlockers.push('one_or_more_signatures_failed_queue_or_source_identity_binding');
  if (semanticPromotionOrdinals.length) structuralBlockers.push('source_signature_population_applied_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('current_account_state_present');
  const sourceSignaturePopulationComplete = queueRecords.length > 0 && records.length === queueRecords.length && structuralBlockers.length === 0;
  const namespaceCounts = {};
  for (const record of records) namespaceCounts[String(record.sourceNamespaceId)] = (namespaceCounts[String(record.sourceNamespaceId)] || 0) + 1;
  return {
    contract: policy.auditContract,
    policyCoverage: { policyValid: compiled.valid, invalidRules: compiled.invalidRules },
    inputQueueCoverage: { directory: queueSnapshot.directory || null, manifestAndRecordsValid: queueValid, queueRecordCount: queueRecords.length, contentHash: queueSnapshot.manifest?.contentHash || null },
    shardDiscoveryCoverage: { candidateShardSnapshotCount: shardSnapshots.length, validShardSnapshotCount: validSnapshots.length, invalidShardDirectories: sorted(selected.invalidDirectories), equivalentRangeGroupCount: selected.groups.size, equivalentRerunSnapshotCount: validSnapshots.length - selected.groups.size, conflictingEquivalentRanges: sorted(selected.conflictingRanges), selectedShardCount: selectedRanges.length, selectedShards: selectedRanges, overlappingSelectedRangePairs: overlappingRangePairs },
    populationCoverage: { expectedRecordCount: queueRecords.length, consolidatedRecordCount: records.length, firstOrdinal: actualOrdinals[0] || null, lastOrdinal: actualOrdinals.at(-1) || null, missingOrdinals, unexpectedOrdinals, duplicateOrdinals, missingSignatureKeys, unexpectedSignatureKeys, duplicateSignatureKeys, orderMatchesQueue },
    sourceAlignment: { fullyAlignedAndBoundCount: records.length - bindingMismatchOrdinals.length, bindingMismatchOrdinals, allQueueSnapshotEntryAndSourceIdentityBindingsRevalidated: bindingMismatchOrdinals.length === 0 },
    structuralEvidenceCoverage: { namespaceCounts: Object.fromEntries(Object.entries(namespaceCounts).sort(([left], [right]) => Number(left) - Number(right))), pagesWithRootTemplates: records.filter(record => record.rootTemplateEvidence?.length).length, pagesWithDirectCategories: records.filter(record => record.directCategoryEvidence?.length).length, totalRootTemplates: records.reduce((sum, record) => sum + record.rootTemplateEvidence.length, 0), totalDirectCategories: records.reduce((sum, record) => sum + record.directCategoryEvidence.length, 0), totalLeadParagraphs: records.reduce((sum, record) => sum + record.leadParagraphEvidence.length, 0), totalHeadings: records.reduce((sum, record) => sum + record.headingEvidence.length, 0), totalSourceContentBytes: records.reduce((sum, record) => sum + Number(record.sourceContentBytes || 0), 0) },
    semanticPreservationCoverage: { semanticReviewCompletedCount: records.filter(record => record.sourceScopedSemanticRelevanceReview?.state !== 'unreviewed').length, unlockEvidenceAppliedCount: records.filter(record => record.unlockEvidencePresent === true).length, canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length, canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length, repeatabilityClassifiedCount: records.filter(record => record.repeatabilityClassification !== null).length, mechanicsReviewCompleteCount: records.filter(record => record.mechanicsReviewComplete === true).length, optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length, automaticVerificationCount: records.filter(record => record.automaticVerificationApplied === true).length, unsupportedPromotionOrdinals: semanticPromotionOrdinals },
    accountStateFindings,
    sourceSignaturePopulationComplete,
    reconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers, ...(sourceSignaturePopulationComplete ? [] : ['target_source_signature_population_incomplete']), 'source_scoped_semantic_relevance_disposition_pending', 'level_unlock_corpus_absence_reconciliation_pending', 'historical_rendered_expansion_dependency_attribution_incomplete', 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'independent_complete_activity_universe_not_established']),
    publishable: sourceSignaturePopulationComplete
  };
}

export function buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation({ queueSnapshot = {}, shardSnapshots = [], policy = {}, contentHash = value => value } = {}) {
  const compiled = compileRenderedPageWithoutUnlockTargetSourceSignaturePopulationPolicy(policy);
  const queueValid = compiled.valid && queueSnapshotValid(queueSnapshot, policy, contentHash);
  const validSnapshots = queueValid ? shardSnapshots.filter(snapshot => shardSnapshotValid(snapshot, policy, queueSnapshot, contentHash)) : [];
  const selected = selectShardRepresentatives(shardSnapshots, validSnapshots);
  const candidateRecords = selected.representatives.flatMap(snapshot => snapshot.records).sort((left, right) => left.queueOrdinal - right.queueOrdinal);
  const audit = auditRenderedPageWithoutUnlockTargetSourceSignaturePopulation(candidateRecords, { queueSnapshot, shardSnapshots, policy, contentHash });
  return audit.publishable ? { records: candidateRecords, audit } : { records: [], audit };
}
