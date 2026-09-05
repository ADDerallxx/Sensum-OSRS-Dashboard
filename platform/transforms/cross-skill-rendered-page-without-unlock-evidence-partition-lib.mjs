import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';

const REQUIRED_RULES = [
  'onePartitionRecordPerEligibleInput', 'inputSnapshotAndIntrinsicRecordHashesMustRevalidate',
  'stableCurrentWikiPageIdentityAndRevisionAreRequired', 'unlockEvidenceMustBeAbsent',
  'allRenderedObservationsAndCountsMustReconcile', 'partitionUsesOnlyDirectVersusUnattributedObservationPresence',
  'imageChannelExistenceMayBeUnreportedButResolvedIdentityMustRemainPinned',
  'titlesNamespacesParserChannelsAndPageIdsCannotSelectSemanticMeaning',
  'directObservationDoesNotProveUnlockSemanticIdentityOrActivity',
  'renderedObservationDoesNotProveHistoricalDependencyOrigin',
  'partitionCannotCreateSemanticIdentityRepeatabilityMechanicsOrOptimizerState', 'currentAccountStateIsForbidden'
];
const EXPECTED_PRESENCE = ['direct_source_exact_mediawiki_title', 'direct_source_stable_page_id', 'rendered_only_origin_unattributed'];
const EXPECTED_CHANNELS = ['links', 'categories', 'images'];
const EXPECTED_PARTITIONS = {
  direct_source_only: ['revision_pinned_target_source_signature', 'source_scoped_semantic_relevance_disposition', 'level_unlock_corpus_absence_reconciliation'],
  mixed_direct_and_unattributed_rendered: ['revision_pinned_target_source_signature', 'source_scoped_semantic_relevance_disposition', 'level_unlock_corpus_absence_reconciliation', 'historical_rendered_expansion_dependency_attribution'],
  rendered_only_origin_unattributed: ['historical_rendered_expansion_dependency_attribution', 'revision_pinned_target_source_signature', 'source_scoped_semantic_relevance_disposition', 'level_unlock_corpus_absence_reconciliation']
};
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => (left === undefined || right === undefined) ? left === right : contentHash(left) === contentHash(right);
const validIsoTimestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:titleOverrides|pageIdOverrides|revisionOverrides|namespaceOverrides|parserChannelOverrides|overrides|exceptions)$/i;
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

export function compileRenderedPageWithoutUnlockEvidencePartitionPolicy(policy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-partition-policy.v1' &&
    policy.inputContract === 'sensum.cross-source-entity-activity-candidate.v1' &&
    policy.outputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-partition.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-partition-audit.v1' &&
    policy.inputCandidateKind === 'rendered_page_without_unlock_match' && policy.inputSemanticRoutingState === 'rendered_stable_page_without_unlock_evidence';
  const vocabularyValid = same(policy.sourcePresenceVocabulary || [], EXPECTED_PRESENCE, contentHash) && same(policy.parserChannelVocabulary || [], EXPECTED_CHANNELS, contentHash);
  const partitionsValid = same(Object.fromEntries(Object.entries(policy.partitions || {}).map(([key, value]) => [key, value.requiredNextEvidenceChannels])), EXPECTED_PARTITIONS, contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractsValid && vocabularyValid && partitionsValid && invalidRules.length === 0 && forbidden.length === 0, contractsValid, vocabularyValid, partitionsValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function countBy(values, vocabulary) {
  return Object.fromEntries(vocabulary.map(value => [value, values.filter(item => item === value).length]));
}

function guideBindings(observations = []) {
  const seen = new Map();
  for (const row of observations) {
    const binding = { guidePageId: row.guidePageId, guideTitle: row.guideTitle, guideRevision: row.guideRevision, guideContentHash: row.guideContentHash };
    seen.set(hash(binding), binding);
  }
  return sorted([...seen.entries()]).map(([, value]) => value);
}

function partitionFor(sourcePresenceCounts = {}) {
  const direct = (sourcePresenceCounts.direct_source_exact_mediawiki_title || 0) + (sourcePresenceCounts.direct_source_stable_page_id || 0);
  const rendered = sourcePresenceCounts.rendered_only_origin_unattributed || 0;
  if (direct > 0 && rendered === 0) return 'direct_source_only';
  if (direct > 0 && rendered > 0) return 'mixed_direct_and_unattributed_rendered';
  if (direct === 0 && rendered > 0) return 'rendered_only_origin_unattributed';
  return null;
}

function candidateIntegrity(record = {}, policy = {}, contentHash = hash) {
  const rendered = record.sourceContexts?.renderedEvidence || {};
  const observations = Array.isArray(rendered.observations) ? rendered.observations : [];
  const actualPresence = countBy(observations.map(row => row.sourcePresence), policy.sourcePresenceVocabulary || []);
  const actualChannels = countBy(observations.map(row => row.parserChannel), policy.parserChannelVocabulary || []);
  const identity = rendered.targetPageIdentity;
  const unknownPresence = unique(observations.map(row => row.sourcePresence).filter(value => !policy.sourcePresenceVocabulary?.includes(value)));
  const unknownChannels = unique(observations.map(row => row.parserChannel).filter(value => !policy.parserChannelVocabulary?.includes(value)));
  const observationIntegrity = observations.every(row => Number.isInteger(row.guidePageId) && row.guidePageId > 0 && typeof row.guideTitle === 'string' && row.guideTitle.length > 0 && /^\d+$/.test(String(row.guideRevision || '')) && validHash(row.guideContentHash) && validIsoTimestamp(row.parserObservedAt) && (row.parserReportedExists === true || (row.parserChannel === 'images' && row.parserReportedExists === null)) && row.resolutionState === 'current_revision_pinned_page' && typeof row.requestedTitle === 'string' && row.requestedTitle.length > 0);
  const semanticClosed = record.candidateKey === null && record.queuedForSemanticReview === false && record.activityDiscoveryCandidate === false && record.reviewStatus === 'not_queued' && record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null && record.repeatabilityClassification === null && record.optimizerEligible === false;
  const checks = {
    contractMatches: record.contract === policy.inputContract,
    intrinsicContentHashMatches: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    candidateKindMatches: record.candidateKind === policy.inputCandidateKind,
    stableIdentityPresent: Number.isInteger(record.pageIdentity?.sourcePageId) && record.pageIdentity.sourcePageId > 0 && typeof record.pageIdentity?.resolvedTitle === 'string' && record.pageIdentity.resolvedTitle.length > 0 && /^\d+$/.test(String(record.pageIdentity?.renderedSourceRevision || '')),
    currentIdentityAligned: identity?.sourcePageId === record.pageIdentity?.sourcePageId && identity?.resolvedTitle === record.pageIdentity?.resolvedTitle && String(identity?.sourceRevision || '') === String(record.pageIdentity?.renderedSourceRevision || '') && validIsoTimestamp(identity?.sourceTimestamp) && typeof identity?.sourceUrl === 'string' && identity.sourceUrl.startsWith('https://oldschool.runescape.wiki/'),
    unlockEvidenceAbsent: record.pageIdentity?.unlockSourceRevision === null && record.pageIdentity?.revisionRelationship === 'no_unlock_page_match' && record.sourceContexts?.unlockEvidence === null && record.sourceContexts?.crossSourcePageIdentityEstablished === false && record.sourceContexts?.revisionRelationship === 'no_unlock_page_match' && record.sourceContexts?.semanticRoutingState === policy.inputSemanticRoutingState,
    observationSetPresent: observations.length > 0 && rendered.guideObservationCount === observations.length,
    observationIntegrity,
    sourcePresenceCountsReconcile: same(rendered.sourcePresenceCounts || {}, actualPresence, contentHash),
    parserChannelsKnown: unknownChannels.length === 0,
    sourcePresenceKnown: unknownPresence.length === 0,
    namespaceIdsPresent: Array.isArray(rendered.namespaceIds) && rendered.namespaceIds.length > 0 && rendered.namespaceIds.every(Number.isInteger),
    requestedTitlesPresent: Array.isArray(rendered.requestedTitles) && rendered.requestedTitles.length > 0,
    partitionDerivable: partitionFor(actualPresence) !== null,
    sourceCrosswalkHashPresent: validHash(record.sourceCrosswalkContentHash),
    semanticGatesClosed: semanticClosed,
    accountIndependent: record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean), observations, actualPresence, actualChannels, unknownPresence, unknownChannels, identity, partition: partitionFor(actualPresence) };
}

function expectedPartitionRecord(record, sourceCandidateSnapshotContentHash, policy, contentHash = hash) {
  const integrity = candidateIntegrity(record, policy, contentHash);
  const bindings = guideBindings(integrity.observations);
  const partition = integrity.partition;
  const direct = integrity.actualPresence.direct_source_exact_mediawiki_title + integrity.actualPresence.direct_source_stable_page_id;
  const base = {
    contract: policy.outputContract,
    partitionKey: `${record.renderedTargetKey}|without-unlock-evidence-partition`,
    sourceCandidateContentHash: record.contentHash,
    sourceCandidateSnapshotContentHash,
    renderedTargetKey: record.renderedTargetKey,
    stableWikiPageIdentity: integrity.identity,
    requestedTitles: record.sourceContexts.renderedEvidence.requestedTitles,
    namespaceIds: record.sourceContexts.renderedEvidence.namespaceIds,
    guideObservationCount: integrity.observations.length,
    guideSourceBindingCount: bindings.length,
    guideSourceBindingsContentHash: contentHash(bindings),
    renderedObservationSetContentHash: contentHash(integrity.observations),
    parserChannelCounts: integrity.actualChannels,
    sourcePresenceCounts: integrity.actualPresence,
    directSourceObservationCount: direct,
    renderedOnlyUnattributedObservationCount: integrity.actualPresence.rendered_only_origin_unattributed,
    provenancePartition: partition,
    requiredNextEvidenceChannels: policy.partitions?.[partition]?.requiredNextEvidenceChannels || [],
    unlockEvidencePresent: false,
    semanticDisposition: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      'level_unlock_corpus_has_no_exact_page_id_match',
      ...(partition === 'mixed_direct_and_unattributed_rendered' || partition === 'rendered_only_origin_unattributed' ? ['historical_rendered_expansion_dependency_attribution_missing'] : []),
      'source_scoped_semantic_relevance_not_classified', 'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'optimizer_eligibility_blocked'
    ]),
    state: 'partitioned_pending_source_bound_unlock_absence_reconciliation'
  };
  return { ...base, recordContentHash: contentHash(base) };
}

export function buildRenderedPageWithoutUnlockEvidencePartition({ candidateRecords = [], policy = {}, sourceCandidateSnapshotContentHash = '', contentHash = hash } = {}) {
  const eligible = candidateRecords.filter(row => row.candidateKind === policy.inputCandidateKind);
  const proposed = eligible.map(row => expectedPartitionRecord(row, sourceCandidateSnapshotContentHash, policy, contentHash)).sort((a, b) => a.renderedTargetKey.localeCompare(b.renderedTargetKey));
  const firstAudit = auditRenderedPageWithoutUnlockEvidencePartition(proposed, { candidateRecords, policy, sourceCandidateSnapshotContentHash, contentHash });
  if (firstAudit.publishable) return { records: proposed, audit: firstAudit };
  return { records: [], audit: auditRenderedPageWithoutUnlockEvidencePartition([], { candidateRecords, policy, sourceCandidateSnapshotContentHash, contentHash }) };
}

export function auditRenderedPageWithoutUnlockEvidencePartition(records = [], { candidateRecords = [], policy = {}, sourceCandidateSnapshotContentHash = '', contentHash = hash } = {}) {
  const compiled = compileRenderedPageWithoutUnlockEvidencePartitionPolicy(policy, contentHash);
  const eligible = candidateRecords.filter(row => row.candidateKind === policy.inputCandidateKind);
  const inputKeys = eligible.map(row => row.renderedTargetKey);
  const outputKeys = records.map(row => row.renderedTargetKey);
  const candidateIntegrityRows = eligible.map(row => ({ key: row.renderedTargetKey, ...candidateIntegrity(row, policy, contentHash) }));
  const expected = candidateIntegrityRows.every(row => row.complete) && validHash(sourceCandidateSnapshotContentHash)
    ? eligible.map(row => expectedPartitionRecord(row, sourceCandidateSnapshotContentHash, policy, contentHash)).sort((a, b) => a.renderedTargetKey.localeCompare(b.renderedTargetKey)) : [];
  const expectedByKey = new Map(expected.map(row => [row.renderedTargetKey, row]));
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const recordMismatches = records.filter(row => !same(row, expectedByKey.get(row.renderedTargetKey), contentHash) || !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'))).map(row => row.renderedTargetKey);
  const promotions = records.filter(row => row.unlockEvidencePresent !== false || row.semanticDisposition !== null || row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null || row.mechanicsReviewComplete !== false || row.optimizerEligible !== false || row.automaticVerificationApplied !== false).map(row => row.renderedTargetKey);
  const accountStateFindings = findAccountState([...candidateRecords, ...records]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('rendered_page_without_unlock_partition_policy_invalid_or_specific');
  if (!validHash(sourceCandidateSnapshotContentHash)) structuralBlockers.push('source_candidate_snapshot_content_hash_missing_or_invalid');
  if (duplicateInputKeys.length) structuralBlockers.push('duplicate_eligible_input_target_keys');
  if (candidateIntegrityRows.some(row => !row.complete)) structuralBlockers.push('one_or_more_eligible_input_records_failed_revalidation');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('partition_output_target_set_not_exact');
  if (recordMismatches.length) structuralBlockers.push('one_or_more_partition_records_mismatch_source_derived_result');
  if (promotions.length) structuralBlockers.push('partition_applied_unlock_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('current_account_state_present');
  const partitionComplete = eligible.length > 0 && structuralBlockers.length === 0;
  const aggregateCounts = key => Object.fromEntries((policy[key] || []).map(value => [value, candidateIntegrityRows.reduce((sum, row) => sum + (row[key === 'parserChannelVocabulary' ? 'actualChannels' : 'actualPresence']?.[value] || 0), 0)]));
  const namespaceTargetCounts = {};
  for (const row of eligible) for (const namespaceId of row.sourceContexts?.renderedEvidence?.namespaceIds || []) namespaceTargetCounts[namespaceId] = (namespaceTargetCounts[namespaceId] || 0) + 1;
  const guideBindingsAcrossPopulation = guideBindings(candidateIntegrityRows.flatMap(row => row.observations));
  return {
    contract: policy.auditContract,
    inputCoverage: { candidateInventoryRecordCount: candidateRecords.length, eligibleRenderedPageCount: eligible.length, validEligibleRenderedPageCount: candidateIntegrityRows.filter(row => row.complete).length, invalidEligibleRenderedTargetKeys: candidateIntegrityRows.filter(row => !row.complete).map(row => row.key), duplicateEligibleInputTargetKeys: duplicateInputKeys, sourceCandidateSnapshotContentHashValid: validHash(sourceCandidateSnapshotContentHash) },
    sourceIntegrityCoverage: { stableRevisionPinnedPageIdentityCount: candidateIntegrityRows.filter(row => row.checks.stableIdentityPresent && row.checks.currentIdentityAligned).length, renderedGuideObservationCount: candidateIntegrityRows.reduce((sum, row) => sum + row.observations.length, 0), parserExistenceUnreportedImageObservationCount: candidateIntegrityRows.reduce((sum, row) => sum + row.observations.filter(observation => observation.parserChannel === 'images' && observation.parserReportedExists === null).length, 0), distinctGuideRevisionBindingCount: guideBindingsAcrossPopulation.length, guideRevisionBindingsContentHash: contentHash(guideBindingsAcrossPopulation), parserChannelCounts: aggregateCounts('parserChannelVocabulary'), sourcePresenceCounts: aggregateCounts('sourcePresenceVocabulary'), namespaceTargetCounts: Object.fromEntries(Object.entries(namespaceTargetCounts).sort(([a], [b]) => Number(a) - Number(b))), unknownParserChannels: unique(candidateIntegrityRows.flatMap(row => row.unknownChannels)), unknownSourcePresenceValues: unique(candidateIntegrityRows.flatMap(row => row.unknownPresence)), sourceRecordsWithUnlockEvidence: eligible.filter(row => row.sourceContexts?.unlockEvidence !== null).length },
    partitionCoverage: { outputRecordCount: records.length, directSourceOnlyCount: records.filter(row => row.provenancePartition === 'direct_source_only').length, mixedDirectAndUnattributedRenderedCount: records.filter(row => row.provenancePartition === 'mixed_direct_and_unattributed_rendered').length, renderedOnlyUnattributedCount: records.filter(row => row.provenancePartition === 'rendered_only_origin_unattributed').length, duplicateOutputTargetKeys: duplicateOutputKeys, missingOutputTargetKeys: missingOutputKeys, unexpectedOutputTargetKeys: unexpectedOutputKeys, recordMismatchTargetKeys: recordMismatches, exactDisjointPartition: records.length === eligible.length && records.every(row => Object.hasOwn(EXPECTED_PARTITIONS, row.provenancePartition)) },
    semanticPreservationCoverage: { unlockEvidenceAppliedCount: records.filter(row => row.unlockEvidencePresent === true).length, semanticDispositionCount: records.filter(row => row.semanticDisposition !== null).length, canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length, canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length, repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length, mechanicsReviewCompleteCount: records.filter(row => row.mechanicsReviewComplete === true).length, optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length, automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length, unsupportedPromotionTargetKeys: promotions },
    accountStateFindings,
    partitionComplete,
    unlockEvidenceReconciled: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers, 'rendered_pages_without_unlock_evidence_require_source_bound_reconciliation', 'historical_rendered_expansion_dependency_attribution_incomplete', 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'independent_complete_activity_universe_not_established']),
    publishable: partitionComplete
  };
}
