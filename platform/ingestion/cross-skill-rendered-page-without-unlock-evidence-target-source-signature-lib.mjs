import { parseDirectCategorySignatures, parseRootTemplateSignatures } from './unlock-linked-page-source-signature-lib.mjs';
import { parseLeadParagraphEvidence, parseSourceHeadings } from './activity-candidate-source-evidence-lib.mjs';
import { findAccountState } from './skill-training-guide-source-dependency-lib.mjs';

const REQUIRED_RULES = [
  'queueShardMustBeContiguousInQueueOrder', 'queueSnapshotAndEntryIntrinsicHashesMustRevalidate',
  'everySelectedQueueEntryMustProduceExactlyOneSignature', 'fetchedContentMustUseTheQueueBoundExactRevisionId',
  'pageIdRevisionTimestampTitleNamespaceUrlHashAndBytesMustReconcile', 'sourceStructureRemainsEvidenceNotSemanticVerdict',
  'shardCompletionCannotClaimPopulationCompletion', 'canonicalIdentityRepeatabilityMechanicsAndOptimizerEligibilityRemainClosed',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash) => (left === undefined || right === undefined) ? left === right : contentHash(left) === contentHash(right);
const sourceContent = page => page?.revisions?.[0]?.slots?.main?.content;

export function compileRenderedPageWithoutUnlockTargetSourceSignaturePolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const valid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature-policy.v1' &&
    policy.inputQueueContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-entry.v1' &&
    policy.recordContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard-audit.v1' &&
    Number.isInteger(policy.maximumShardSize) && policy.maximumShardSize > 0 && invalidRules.length === 0;
  return { valid, invalidRules: unique(invalidRules) };
}

export function selectRenderedPageWithoutUnlockSourceSignatureShard(queueRecords = [], { startOrdinal = 1, limit = 250, maximumShardSize = 250 } = {}) {
  if (!Number.isInteger(startOrdinal) || startOrdinal < 1) throw new Error('startOrdinal must be a positive integer.');
  if (!Number.isInteger(limit) || limit < 1 || limit > maximumShardSize) throw new Error(`limit must be between 1 and ${maximumShardSize}.`);
  const ordered = [...queueRecords].sort((left, right) => left.queueOrdinal - right.queueOrdinal);
  if (ordered.some((row, index) => row.queueOrdinal !== index + 1)) throw new Error('Queue ordinals are not contiguous from 1.');
  return ordered.filter(row => row.queueOrdinal >= startOrdinal && row.queueOrdinal < startOrdinal + limit);
}

function queueEntryValid(record, queueSnapshotContentHash, policy, contentHash) {
  return record?.contract === policy.inputQueueContract && validHash(queueSnapshotContentHash) &&
    validHash(record.contentHash) && record.contentHash === contentHash(without(record, 'contentHash')) &&
    validHash(record.recordContentHash) && record.recordContentHash === contentHash(without(record, 'contentHash', 'recordContentHash')) &&
    Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0 &&
    Number.isInteger(record.stableWikiPageIdentity?.sourcePageId) && record.stableWikiPageIdentity.sourcePageId > 0 &&
    /^\d+$/.test(String(record.stableWikiPageIdentity?.sourceRevision || '')) && record.accountIndependent === true &&
    record.unlockEvidencePresent === false && record.semanticDisposition === null && record.canonicalGameEntityIdentity === null &&
    record.canonicalActivityIdentity === null && record.repeatabilityClassification === null && record.mechanicsReviewComplete === false &&
    record.optimizerEligible === false && record.automaticVerificationApplied === false;
}

function fetchedByRevision(pages = []) {
  const map = new Map();
  for (const page of pages) for (const revision of page.revisions || []) {
    const key = String(revision.revid || '');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ page, revision });
  }
  return map;
}

function expectedSignature(queue, fetched, policy, queueSnapshotContentHash, contentHash) {
  const page = fetched?.page || null;
  const revision = fetched?.revision || null;
  const content = sourceContent(page);
  const identity = queue.stableWikiPageIdentity || {};
  const computedHash = typeof content === 'string' ? contentHash(content) : null;
  const alignment = {
    queueEntryOuterHashValid: validHash(queue.contentHash) && queue.contentHash === contentHash(without(queue, 'contentHash')),
    queueEntryIntrinsicHashValid: validHash(queue.recordContentHash) && queue.recordContentHash === contentHash(without(queue, 'contentHash', 'recordContentHash')),
    fetchedPageIdMatches: Number(page?.pageid) === Number(identity.sourcePageId),
    fetchedRevisionMatches: String(revision?.revid || '') === String(identity.sourceRevision || ''),
    fetchedTimestampMatches: revision?.timestamp === identity.sourceTimestamp,
    fetchedTitleMatches: page?.title === identity.resolvedTitle,
    fetchedNamespaceObserved: Number.isInteger(page?.ns) && queue.namespaceIds?.includes(page.ns),
    fetchedContentPresent: typeof content === 'string',
    sourceUrlRetained: typeof identity.sourceUrl === 'string' && identity.sourceUrl.startsWith('https://oldschool.runescape.wiki/')
  };
  const blockers = [];
  if (!Object.values(alignment).every(Boolean)) blockers.push('queue_or_exact_revision_source_alignment_failed');
  blockers.push('source_scoped_semantic_relevance_disposition_pending', 'level_unlock_corpus_absence_reconciliation_pending');
  if (queue.historicalRenderedAttributionRequired) blockers.push('historical_rendered_expansion_dependency_attribution_pending');
  blockers.push('canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'optimizer_eligibility_blocked');
  const base = {
    contract: policy.recordContract,
    signatureKey: `${queue.workQueueEntryKey}|target-source-signature`,
    sourceWorkQueueEntryKey: queue.workQueueEntryKey,
    sourceWorkQueueEntryContentHash: queue.contentHash,
    sourceWorkQueueEntryIntrinsicContentHash: queue.recordContentHash,
    sourceWorkQueueSnapshotContentHash: queueSnapshotContentHash,
    queueOrdinal: queue.queueOrdinal,
    partitionOrdinal: queue.partitionOrdinal,
    provenancePartition: queue.provenancePartition,
    renderedTargetKey: queue.renderedTargetKey,
    requestedTitles: queue.requestedTitles,
    observedNamespaceIds: queue.namespaceIds,
    sourcePageId: Number.isInteger(page?.pageid) ? page.pageid : null,
    sourceNamespaceId: Number.isInteger(page?.ns) ? page.ns : null,
    resolvedTitle: page?.title || identity.resolvedTitle || null,
    sourceRevision: revision?.revid ? String(revision.revid) : null,
    sourceTimestamp: revision?.timestamp || null,
    sourceUrl: identity.sourceUrl || null,
    sourceContentHash: computedHash,
    sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null,
    sourceLineCount: typeof content === 'string' ? content.split(/\r?\n/).length : null,
    revisionAlignment: alignment,
    rootTemplateEvidence: typeof content === 'string' ? parseRootTemplateSignatures(content) : [],
    directCategoryEvidence: typeof content === 'string' ? parseDirectCategorySignatures(content) : [],
    leadParagraphEvidence: typeof content === 'string' ? parseLeadParagraphEvidence(content, null) : [],
    headingEvidence: typeof content === 'string' ? parseSourceHeadings(content) : [],
    sourceScopedSemanticRelevanceReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
    unlockEvidencePresent: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique(blockers),
    state: Object.values(alignment).every(Boolean) ? 'source_signature_captured_semantic_relevance_pending' : 'blocked_source_alignment'
  };
  return { ...base, recordContentHash: contentHash(base) };
}

export function buildRenderedPageWithoutUnlockTargetSourceSignatureShard({ queueRecords = [], fetchedPages = [], policy = {}, queueSnapshotContentHash = '', startOrdinal = 1, limit = 250, contentHash = value => value } = {}) {
  let selected = [];
  try { selected = selectRenderedPageWithoutUnlockSourceSignatureShard(queueRecords, { startOrdinal, limit, maximumShardSize: policy.maximumShardSize }); } catch {}
  const compiled = compileRenderedPageWithoutUnlockTargetSourceSignaturePolicy(policy);
  const byRevision = fetchedByRevision(fetchedPages);
  const inputsValid = compiled.valid && selected.length > 0 && validHash(queueSnapshotContentHash) && selected.every(row => queueEntryValid(row, queueSnapshotContentHash, policy, contentHash));
  const records = inputsValid ? selected.map(queue => {
    const matches = byRevision.get(String(queue.stableWikiPageIdentity.sourceRevision)) || [];
    return expectedSignature(queue, matches.length === 1 ? matches[0] : null, policy, queueSnapshotContentHash, contentHash);
  }) : [];
  const firstAudit = auditRenderedPageWithoutUnlockTargetSourceSignatureShard(records, { queueRecords, fetchedPages, policy, queueSnapshotContentHash, startOrdinal, limit, contentHash });
  if (firstAudit.publishable) return { records, audit: firstAudit };
  return { records: [], audit: auditRenderedPageWithoutUnlockTargetSourceSignatureShard([], { queueRecords, fetchedPages, policy, queueSnapshotContentHash, startOrdinal, limit, contentHash }) };
}

export function auditRenderedPageWithoutUnlockTargetSourceSignatureShard(records = [], { queueRecords = [], fetchedPages = [], policy = {}, queueSnapshotContentHash = '', startOrdinal = 1, limit = 250, contentHash = value => value } = {}) {
  const compiled = compileRenderedPageWithoutUnlockTargetSourceSignaturePolicy(policy);
  let selected = []; let selectionValid = true;
  try { selected = selectRenderedPageWithoutUnlockSourceSignatureShard(queueRecords, { startOrdinal, limit, maximumShardSize: policy.maximumShardSize }); } catch { selectionValid = false; }
  const byRevision = fetchedByRevision(fetchedPages);
  const queueFailures = selected.filter(row => !queueEntryValid(row, queueSnapshotContentHash, policy, contentHash)).map(row => row.workQueueEntryKey);
  const duplicateFetchedRevisions = [...byRevision.entries()].filter(([, values]) => values.length > 1).map(([revision]) => revision);
  const expected = compiled.valid && selectionValid && validHash(queueSnapshotContentHash) && queueFailures.length === 0
    ? selected.map(queue => { const matches = byRevision.get(String(queue.stableWikiPageIdentity.sourceRevision)) || []; return expectedSignature(queue, matches.length === 1 ? matches[0] : null, policy, queueSnapshotContentHash, contentHash); }) : [];
  const expectedByKey = new Map(expected.map(row => [row.sourceWorkQueueEntryKey, row]));
  const inputKeys = selected.map(row => row.workQueueEntryKey);
  const outputKeys = records.map(row => row.sourceWorkQueueEntryKey);
  const missingKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const duplicateOutputKeys = duplicates(outputKeys);
  const mismatchKeys = records.filter(row => !same(row, expectedByKey.get(row.sourceWorkQueueEntryKey), contentHash) || !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'))).map(row => row.sourceWorkQueueEntryKey);
  const alignmentFailures = records.filter(row => !Object.values(row.revisionAlignment || {}).every(Boolean)).map(row => row.sourceWorkQueueEntryKey);
  const semanticPromotions = records.filter(row => row.sourceScopedSemanticRelevanceReview?.state !== 'unreviewed' || row.sourceScopedSemanticRelevanceReview?.disposition !== null || row.sourceScopedSemanticRelevanceReview?.evidenceKeys?.length || row.unlockEvidencePresent !== false || row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null || row.mechanicsReviewComplete !== false || row.optimizerEligible !== false || row.automaticVerificationApplied !== false).map(row => row.sourceWorkQueueEntryKey);
  const accountStateFindings = findAccountState([...queueRecords, ...records]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('target_source_signature_policy_invalid');
  if (!selectionValid || !selected.length) structuralBlockers.push('queue_shard_selection_invalid_or_empty');
  if (!validHash(queueSnapshotContentHash) || queueFailures.length) structuralBlockers.push('queue_snapshot_or_entry_hash_revalidation_failed');
  if (duplicateFetchedRevisions.length) structuralBlockers.push('duplicate_exact_revision_api_results');
  if (duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('selected_queue_and_signature_sets_do_not_match');
  if (mismatchKeys.length || alignmentFailures.length) structuralBlockers.push('one_or_more_source_signatures_failed_exact_alignment');
  if (semanticPromotions.length) structuralBlockers.push('source_signature_applied_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('current_account_state_present');
  const sourceSignatureShardComplete = selected.length > 0 && structuralBlockers.length === 0;
  const remaining = Math.max(0, queueRecords.length - (startOrdinal - 1 + selected.length));
  const sourceSignaturePopulationComplete = sourceSignatureShardComplete && startOrdinal === 1 && selected.length === queueRecords.length;
  const namespaceCounts = {};
  for (const row of records) namespaceCounts[String(row.sourceNamespaceId)] = (namespaceCounts[String(row.sourceNamespaceId)] || 0) + 1;
  return {
    contract: policy.auditContract,
    inputCoverage: { queuePopulationCount: queueRecords.length, requestedStartOrdinal: startOrdinal, requestedLimit: limit, selectedQueueEntryCount: selected.length, selectedFirstOrdinal: selected[0]?.queueOrdinal || null, selectedLastOrdinal: selected.at(-1)?.queueOrdinal || null, remainingQueueEntryCount: remaining, queueEntryHashFailureKeys: queueFailures },
    policyCoverage: { policyValid: compiled.valid, invalidRules: compiled.invalidRules, maximumShardSize: policy.maximumShardSize },
    fetchCoverage: { requestedExactRevisionCount: selected.length, fetchedExactRevisionCount: records.filter(row => row.sourceRevision).length, duplicateFetchedRevisions, missingExactRevisionIds: selected.filter(row => !byRevision.has(String(row.stableWikiPageIdentity?.sourceRevision))).map(row => String(row.stableWikiPageIdentity?.sourceRevision || '')) },
    sourceAlignment: { fullyAlignedCount: records.length - alignmentFailures.length, failedQueueEntryKeys: alignmentFailures, allPageIdsRevisionsTimestampsTitlesNamespacesUrlsHashesAndBytesAligned: alignmentFailures.length === 0 },
    structuralEvidenceCoverage: { namespaceCounts: Object.fromEntries(Object.entries(namespaceCounts).sort(([a], [b]) => Number(a) - Number(b))), pagesWithRootTemplates: records.filter(row => row.rootTemplateEvidence?.length).length, pagesWithDirectCategories: records.filter(row => row.directCategoryEvidence?.length).length, totalRootTemplates: records.reduce((sum, row) => sum + row.rootTemplateEvidence.length, 0), totalDirectCategories: records.reduce((sum, row) => sum + row.directCategoryEvidence.length, 0), totalLeadParagraphs: records.reduce((sum, row) => sum + row.leadParagraphEvidence.length, 0), totalHeadings: records.reduce((sum, row) => sum + row.headingEvidence.length, 0), totalSourceContentBytes: records.reduce((sum, row) => sum + Number(row.sourceContentBytes || 0), 0) },
    semanticPreservationCoverage: { semanticReviewCompletedCount: records.filter(row => row.sourceScopedSemanticRelevanceReview?.state !== 'unreviewed').length, unlockEvidenceAppliedCount: records.filter(row => row.unlockEvidencePresent === true).length, canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length, canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length, repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length, mechanicsReviewCompleteCount: records.filter(row => row.mechanicsReviewComplete === true).length, optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length, automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length, unsupportedPromotionQueueEntryKeys: semanticPromotions },
    accountStateFindings,
    sourceSignatureShardComplete,
    sourceSignaturePopulationComplete,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers, ...(sourceSignaturePopulationComplete ? [] : ['target_source_signature_population_incomplete']), 'source_scoped_semantic_relevance_disposition_pending', 'level_unlock_corpus_absence_reconciliation_pending', 'historical_rendered_expansion_dependency_attribution_incomplete', 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'independent_complete_activity_universe_not_established']),
    publishable: sourceSignatureShardComplete
  };
}
