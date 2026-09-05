import { hash } from '../ingestion/lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|title|titles|requestedTitle|requestedTitles|renderedTargetKey|renderedTargetKeys|memberName|memberNames|alias|aliases|override|overrides)$/i;
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  walk(policy);
  return sorted(unique(findings));
}

export function compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositionPolicy(policy = {}) {
  const requiredRules = [
    'oneDispositionPerAdditionalResolutionEvidencePacket',
    'sourcePacketRecordSnapshotAndUpstreamBindingsMustRevalidate',
    'allNestedEvidenceHashesAndExactSourceOccurrencesMustRevalidate',
    'classificationDependsOnlyOnCompleteCategoryEvidenceShape',
    'describedCategoryReviewRequiresAnExactCurrentRevisionPinnedCategoryPage',
    'redlinkCategoryReviewRequiresMissingDescriptionActiveCategoryStateExactPrefixAndRevisionPinnedMembership',
    'memberInventoryMustReconcileWithReportedCategoryInfo',
    'incompleteOrInconsistentCategoryEvidenceRequiresAdditionalEvidence',
    'redlinkCategoryEvidenceIsNotMissingCategoryIdentityEvidence',
    'reviewReadinessDoesNotSelectOrApplyAResolution',
    'categoryTargetResolutionDoesNotEstablishCanonicalGameEntityOrActivityIdentity',
    'sourceSilenceIsNotNegativeEvidence',
    'titlesPageIdsRevisionsMemberNamesAliasesAndOverridesCannotAlterClassification',
    'canonicalIdentityRepeatabilityMechanicsAndOptimizerEligibilityRemainClosed',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const expectedClassifications = [
    'described_category_page_resolution_review_ready',
    'active_redlink_category_target_resolution_review_ready',
    'category_target_additional_evidence_required'
  ];
  const expectedRoutes = [
    'explicit_source_bound_described_category_page_resolution_review',
    'explicit_source_bound_redlink_category_target_resolution_review',
    'additional_source_bound_category_resolution_evidence'
  ];
  const expectedDescribedDecisions = [
    'confirm_exact_current_category_page_resolution',
    'reject_exact_current_category_page_resolution',
    'needs_additional_evidence'
  ];
  const expectedRedlinkDecisions = [
    'confirm_active_redlink_category_target',
    'reject_active_redlink_category_target',
    'needs_additional_evidence'
  ];
  const contractValid = policy.inputContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery.v1'
    && policy.recordContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition.v1'
    && policy.auditContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition-audit.v1'
    && policy.inputState === 'revision_pinned_unresolved_rendered_target_additional_resolution_evidence_gates_closed'
    && policy.recordState === 'unresolved_rendered_target_additional_resolution_evidence_sufficiency_disposition_gates_closed';
  const configurationValid = same(policy.classifications || [], expectedClassifications)
    && same(policy.reviewRoutes || [], expectedRoutes)
    && same(policy.describedCategoryReviewDecisions || [], expectedDescribedDecisions)
    && same(policy.redlinkCategoryReviewDecisions || [], expectedRedlinkDecisions);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && configurationValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    configurationValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function accountStateFindings(values = []) {
  const forbidden = /^(?:currentBaseLevel|targetBaseLevel|currentLevel|currentXp|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|bank|bankItems|playerName|username|preferences|currentAccount)$/i;
  const findings = [];
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  values.forEach((value, index) => walk(value, `[${index}]`));
  return sorted(unique(findings));
}

function nestedHashValid(value, contentHash = hash) {
  return validHash(value?.evidenceContentHash) && contentHash(without(value, 'evidenceContentHash')) === value.evidenceContentHash;
}

function sourceIdentityIntegrity(identity = {}, { requireSourceText = true } = {}, contentHash = hash) {
  const sourceText = identity.sourceText;
  const checks = {
    pageId: Number.isInteger(Number(identity.sourcePageId)) && Number(identity.sourcePageId) > 0,
    namespace: Number.isInteger(Number(identity.namespaceId)),
    title: typeof identity.resolvedTitle === 'string' && identity.resolvedTitle.length > 0,
    revision: typeof identity.sourceRevision === 'string' && /^\d+$/.test(identity.sourceRevision),
    timestamp: typeof identity.sourceTimestamp === 'string' && !Number.isNaN(Date.parse(identity.sourceTimestamp)),
    url: typeof identity.sourceUrl === 'string' && identity.sourceUrl.startsWith('https://oldschool.runescape.wiki/w/'),
    hash: validHash(identity.sourceContentHash),
    bytes: Number.isInteger(Number(identity.sourceContentBytes)) && Number(identity.sourceContentBytes) >= 0,
    sourceText: !requireSourceText || typeof sourceText === 'string',
    sourceHash: !requireSourceText || contentHash(sourceText) === identity.sourceContentHash,
    sourceBytes: !requireSourceText || new TextEncoder().encode(sourceText).length === Number(identity.sourceContentBytes)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function occurrenceIntegrity(occurrence = {}, identity = {}, contentHash = hash) {
  const lines = typeof identity.sourceText === 'string' ? identity.sourceText.split(/\r?\n/) : [];
  const line = lines[Number(occurrence.line) - 1];
  const checks = {
    line: Number.isInteger(Number(occurrence.line)) && Number(occurrence.line) > 0,
    sourceText: typeof occurrence.sourceText === 'string' && occurrence.sourceText.length > 0,
    sourceTextHash: validHash(occurrence.sourceTextContentHash) && contentHash(occurrence.sourceText) === occurrence.sourceTextContentHash,
    exactTextOnLine: typeof line === 'string' && line.includes(occurrence.sourceText)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function normalizedWikiTitle(value) {
  const title = String(value || '').replaceAll('_', ' ').trim();
  const colon = title.indexOf(':');
  const prefix = colon >= 0 ? title.slice(0, colon).toLocaleLowerCase('en') : '';
  const rest = colon >= 0 ? title.slice(colon + 1) : title;
  return `${prefix}:${rest ? `${rest[0].toLocaleUpperCase('en')}${rest.slice(1)}` : rest}`;
}

function occurrenceTargetsTitle(occurrence = {}, requestedTitle = '') {
  const match = String(occurrence.sourceText || '').match(/^\[\[\s*([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/);
  return Boolean(match && normalizedWikiTitle(match[1]) === normalizedWikiTitle(requestedTitle));
}

function memberIntegrity(member = {}, requestedTitle = '', contentHash = hash) {
  const identity = member.currentSourceIdentity;
  const source = sourceIdentityIntegrity(identity, { requireSourceText: true }, contentHash);
  const occurrences = member.exactCategoryOccurrences || [];
  const checks = {
    completeFlag: member.complete === true,
    sourceIdentityComplete: source.complete,
    stablePageIdMatches: Number(member.pageId) === Number(identity?.sourcePageId),
    namespaceMatches: Number(member.namespaceId) === Number(identity?.namespaceId),
    titleMatches: member.title === identity?.resolvedTitle,
    exactOccurrencePresent: occurrences.length > 0,
    exactOccurrencesComplete: occurrences.every(item => occurrenceIntegrity(item, identity, contentHash).complete),
    exactOccurrencesTargetRequestedCategory: occurrences.every(item => occurrenceTargetsTitle(item, requestedTitle)),
    upstreamChecksComplete: Object.values(member.checks || {}).every(Boolean)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function categoryMemberIntegrity(evidence = {}, contentHash = hash) {
  const members = evidence.members || [];
  const reconciliation = evidence.categoryInfoReconciliation || {};
  const checks = {
    nestedHash: nestedHashValid(evidence, contentHash),
    completeFlag: evidence.complete === true,
    continuationExhausted: evidence.continuationExhausted === true,
    memberCountMatches: Number(evidence.memberCount) === members.length,
    membersComplete: members.every(member => memberIntegrity(member, evidence.requestedTitle, contentHash).complete),
    reportedSizeMatches: Number(reconciliation.reportedSize) === members.length,
    enumeratedSizeMatches: Number(reconciliation.enumeratedSize) === members.length,
    pageTypeCountsReconcile: Number(reconciliation.reportedPages) === Number(reconciliation.enumeratedPages)
      && Number(reconciliation.reportedFiles) === Number(reconciliation.enumeratedFiles)
      && Number(reconciliation.reportedSubcategories) === Number(reconciliation.enumeratedSubcategories),
    enumeratedTypeCountsMatchMembers: Number(reconciliation.enumeratedPages) === members.filter(member => Number(member.namespaceId) === 0).length
      && Number(reconciliation.enumeratedFiles) === members.filter(member => Number(member.namespaceId) === 6).length
      && Number(reconciliation.enumeratedSubcategories) === members.filter(member => Number(member.namespaceId) === 14).length,
    noSemanticResolution: evidence.semanticResolutionApplied === false
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function searchIntegrity(evidence = {}, contentHash = hash) {
  const queries = evidence.queries || [];
  const candidateFailures = queries.flatMap(query => query.candidates || []).filter(candidate => !sourceIdentityIntegrity(candidate.sourceIdentity, { requireSourceText: true }, contentHash).complete);
  const checks = {
    nestedHash: nestedHashValid(evidence, contentHash),
    completeFlag: evidence.complete === true,
    expectedQueriesPresent: evidence.allExpectedQueriesPresent === true,
    queryCount: queries.length > 0,
    queriesComplete: queries.every(query => query.complete === true && query.continuationExhausted === true
      && Number(query.candidateCount) === (query.candidates || []).length && Number(query.namespaceId) === 14),
    candidatesComplete: candidateFailures.length === 0,
    noCandidateSelected: evidence.selectedCandidatePageId === null
  };
  return { checks, candidateFailureCount: candidateFailures.length, complete: Object.values(checks).every(Boolean) };
}

function pinnedGuideIntegrity(item = {}, contentHash = hash) {
  const identity = sourceIdentityIntegrity(item.sourceIdentity, { requireSourceText: false }, contentHash);
  const occurrences = item.exactCategoryOccurrences || [];
  const checks = {
    completeFlag: item.complete === true,
    sourceIdentityComplete: identity.complete,
    exactOccurrencePresent: occurrences.length > 0,
    occurrenceHashesComplete: occurrences.every(occurrence => typeof occurrence.sourceText === 'string'
      && validHash(occurrence.sourceTextContentHash) && contentHash(occurrence.sourceText) === occurrence.sourceTextContentHash),
    occurrencesTargetRequestedCategory: occurrences.every(occurrence => occurrenceTargetsTitle(occurrence, item.requestedTitle)),
    upstreamChecksComplete: Object.values(item.checks || {}).every(Boolean)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function evidenceShape(record = {}, contentHash = hash) {
  const requestedTitle = record.requestedTitles?.[0];
  const namespace = record.namespaceMetadataEvidence || {};
  const exact = record.exactCurrentCategoryEvidence || {};
  const prefix = record.categoryPrefixEvidence || {};
  const members = record.categoryMemberEvidence || {};
  const search = record.namespaceSearchEvidence || {};
  const history = record.titleHistoryEvidence || {};
  const pinned = record.pinnedGuideRevalidations || [];
  const memberAssessment = categoryMemberIntegrity(members, contentHash);
  const searchAssessment = searchIntegrity(search, contentHash);
  const nestedEvidenceComplete = [namespace, exact, prefix, history].every(item => nestedHashValid(item, contentHash) && item.complete === true)
    && memberAssessment.complete && searchAssessment.complete;
  const categoryInfo = exact.categoryInfo || {};
  const reconciliation = members.categoryInfoReconciliation || {};
  const categoryInfoMatchesMemberReconciliation = Number(categoryInfo.size) === Number(reconciliation.reportedSize)
    && Number(categoryInfo.pages) === Number(reconciliation.reportedPages)
    && Number(categoryInfo.files) === Number(reconciliation.reportedFiles)
    && Number(categoryInfo.subcategories) === Number(reconciliation.reportedSubcategories);
  const commonEvidenceComplete = nestedEvidenceComplete
    && namespace.namespaceId === 14 && namespace.canonicalName === 'Category' && namespace.queryComplete === true
    && prefix.exactBaseTitlePresent === true && prefix.continuationExhausted === true
    && categoryInfoMatchesMemberReconciliation
    && history.continuationExhausted === true && Number(history.eventCount) === (history.events || []).length
    && pinned.length > 0 && pinned.every(item => pinnedGuideIntegrity(item, contentHash).complete)
    && (record.requiredChannelStatus || []).length === 3 && record.requiredChannelStatus.every(item => item.observed === true);
  const currentPageIdentity = exact.currentPageIdentity;
  const describedCategoryPage = commonEvidenceComplete && exact.pageDescriptionExists === true
    && exact.redlinkCategoryState === false && exact.currentMissingPage === null
    && Number(currentPageIdentity?.namespaceId) === 14 && currentPageIdentity?.resolvedTitle === requestedTitle
    && sourceIdentityIntegrity(currentPageIdentity, { requireSourceText: true }, contentHash).complete;
  const redlinkCategory = commonEvidenceComplete && exact.pageDescriptionExists === false
    && exact.redlinkCategoryState === true && exact.categoryExistsByApiState === true
    && Number(exact.currentMissingPage?.namespaceId) === 14 && exact.currentMissingPage?.title === requestedTitle
    && currentPageIdentity === null
    && Number(members.memberCount) > 0 && memberAssessment.complete;
  return {
    commonEvidenceComplete,
    namespaceId: Number(namespace.namespaceId),
    namespaceCanonicalName: namespace.canonicalName || null,
    pageDescriptionExists: exact.pageDescriptionExists === true,
    categoryApiStateExists: exact.categoryExistsByApiState === true,
    redlinkCategoryState: exact.redlinkCategoryState === true,
    currentRevisionPinnedCategoryPagePresent: currentPageIdentity !== null,
    exactCategoryPrefixPresent: prefix.exactBaseTitlePresent === true,
    categoryMemberCount: Number(members.memberCount || 0),
    categoryMemberInventoryReconciled: memberAssessment.complete,
    categoryInfoMatchesMemberInventory: categoryInfoMatchesMemberReconciliation,
    pinnedGuideRevalidationCount: pinned.filter(item => pinnedGuideIntegrity(item, contentHash).complete).length,
    namespaceSearchQueryCount: (search.queries || []).length,
    titleHistoryEventCount: Number(history.eventCount || 0),
    describedCategoryPageReviewEvidenceComplete: describedCategoryPage,
    activeRedlinkCategoryReviewEvidenceComplete: redlinkCategory
  };
}

function sourcePacketIntegrity(record = {}, policy = {}, contentHash = hash) {
  const base = without(record, 'recordContentHash', 'contentHash');
  const withRecordHash = without(record, 'contentHash');
  const nestedEvidence = [
    record.namespaceMetadataEvidence, record.exactCurrentCategoryEvidence, record.categoryPrefixEvidence,
    record.categoryMemberEvidence, record.namespaceSearchEvidence, record.titleHistoryEvidence
  ];
  const expectedEvidenceKeys = sorted(unique([
    ...nestedEvidence.map(item => item?.evidenceContentHash),
    ...(record.pinnedGuideRevalidations || []).map(item => contentHash(item))
  ].filter(Boolean)));
  const statusEvidenceKeys = unique((record.requiredChannelStatus || []).flatMap(item => item.evidenceKeys || []));
  const review = record.resolutionReview || {};
  const shape = evidenceShape(record, contentHash);
  const requestedTitle = record.requestedTitles?.[0];
  const nestedRequestedTitles = [
    record.exactCurrentCategoryEvidence?.requestedTitle,
    record.categoryPrefixEvidence?.requestedTitle,
    record.categoryMemberEvidence?.requestedTitle,
    record.namespaceSearchEvidence?.requestedTitle,
    record.titleHistoryEvidence?.requestedTitle,
    ...(record.pinnedGuideRevalidations || []).map(item => item.requestedTitle)
  ];
  const expectedChannels = [
    'independent_revision_pinned_official_wiki_source_discovery',
    'exact_title_redirect_move_and_deletion_history',
    'pinned_guide_context_resolution'
  ];
  const checks = {
    contractMatches: record.contract === policy.inputContract,
    stateMatches: record.state === policy.inputState,
    recordContentHashMatches: validHash(record.recordContentHash) && contentHash(base) === record.recordContentHash,
    snapshotRecordContentHashMatches: validHash(record.contentHash) && contentHash(withRecordHash) === record.contentHash,
    upstreamBindingsPresent: [
      record.evidencePacketKey, record.workQueueEntryKey, record.sourceWorkQueueRecordContentHash,
      record.sourceQueueSnapshotContentHash, record.sourceDispositionKey, record.sourceDispositionRecordContentHash,
      record.sourceEvidenceRecordContentHash, record.sourceDispositionSnapshotContentHash,
      record.sourceEvidenceSnapshotContentHash, record.evidenceFingerprint, record.renderedTargetKey
    ].every(value => typeof value === 'string' && value.length > 0),
    requestedTitlePresent: Array.isArray(record.requestedTitles) && record.requestedTitles.length === 1,
    nestedRequestedTitlesMatch: nestedRequestedTitles.every(title => title === requestedTitle),
    nestedEvidenceHashesComplete: nestedEvidence.every(item => nestedHashValid(item, contentHash)),
    categoryEvidenceStructurallyComplete: shape.commonEvidenceComplete,
    newEvidenceKeysMatch: same(record.newEvidenceKeys || [], expectedEvidenceKeys, contentHash),
    channelEvidenceKeysBound: statusEvidenceKeys.every(key => expectedEvidenceKeys.includes(key)),
    channelEvidenceKeysPresent: (record.requiredChannelStatus || []).every(item => Array.isArray(item.evidenceKeys) && item.evidenceKeys.length > 0),
    requiredChannelsMatch: same((record.requiredChannelStatus || []).map(item => item.channel), expectedChannels, contentHash),
    sourceSilencePreserved: record.sourceSilenceIsNotNegativeEvidence === true,
    resolutionReviewBlank: [review.decision, review.reviewer, review.reviewedAt, review.reviewNotes].every(value => value === null)
      && Array.isArray(review.evidenceKeys) && review.evidenceKeys.length === 0,
    noResolutionSelected: record.selectedResolution === null,
    semanticGatesClosed: record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null
      && record.repeatabilityClassification === null && record.mechanicsReviewComplete === false
      && record.optimizerEligible === false && record.automaticVerificationApplied === false,
    accountIndependent: record.accountIndependent === true
  };
  return { checks, evidenceShape: shape, complete: Object.values(checks).every(Boolean) };
}

function classify(record, policy, contentHash = hash) {
  const shape = evidenceShape(record, contentHash);
  if (shape.describedCategoryPageReviewEvidenceComplete) return {
    classification: policy.classifications[0], reviewRoute: policy.reviewRoutes[0],
    allowedReviewDecisions: [...policy.describedCategoryReviewDecisions],
    blockers: ['explicit_source_bound_described_category_page_resolution_review_pending']
  };
  if (shape.activeRedlinkCategoryReviewEvidenceComplete) return {
    classification: policy.classifications[1], reviewRoute: policy.reviewRoutes[1],
    allowedReviewDecisions: [...policy.redlinkCategoryReviewDecisions],
    blockers: ['explicit_source_bound_redlink_category_target_resolution_review_pending']
  };
  return {
    classification: policy.classifications[2], reviewRoute: policy.reviewRoutes[2], allowedReviewDecisions: [],
    blockers: ['category_target_resolution_evidence_incomplete_or_inconsistent', 'source_silence_is_not_negative_evidence', 'additional_source_bound_category_resolution_evidence_required']
  };
}

function dispositionRecord(record, policy, sourceSnapshotContentHash, contentHash = hash) {
  const shape = evidenceShape(record, contentHash);
  const result = classify(record, policy, contentHash);
  const evidenceBindings = {
    namespaceMetadataEvidenceContentHash: record.namespaceMetadataEvidence.evidenceContentHash,
    exactCurrentCategoryEvidenceContentHash: record.exactCurrentCategoryEvidence.evidenceContentHash,
    categoryPrefixEvidenceContentHash: record.categoryPrefixEvidence.evidenceContentHash,
    categoryMemberEvidenceContentHash: record.categoryMemberEvidence.evidenceContentHash,
    namespaceSearchEvidenceContentHash: record.namespaceSearchEvidence.evidenceContentHash,
    titleHistoryEvidenceContentHash: record.titleHistoryEvidence.evidenceContentHash,
    pinnedGuideRevalidationContentHashes: sorted((record.pinnedGuideRevalidations || []).map(item => contentHash(item))),
    newEvidenceKeys: [...record.newEvidenceKeys]
  };
  const base = {
    contract: policy.recordContract,
    dispositionKey: `${record.evidencePacketKey}|sufficiency-disposition`,
    sourceEvidencePacketKey: record.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: record.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: sourceSnapshotContentHash,
    sourceWorkQueueEntryKey: record.workQueueEntryKey,
    sourceDispositionKey: record.sourceDispositionKey,
    sourceDispositionRecordContentHash: record.sourceDispositionRecordContentHash,
    sourceEvidenceRecordContentHash: record.sourceEvidenceRecordContentHash,
    evidenceFingerprint: record.evidenceFingerprint,
    renderedTargetKey: record.renderedTargetKey,
    requestedTitles: [...record.requestedTitles],
    evidenceShape: shape,
    classification: result.classification,
    reviewRoute: result.reviewRoute,
    allowedReviewDecisions: result.allowedReviewDecisions,
    evidenceBindings,
    resolutionReview: { state: 'unreviewed', decision: null, reviewer: null, reviewedAt: null, reviewNotes: null, evidenceKeys: [] },
    selectedResolution: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      ...result.blockers,
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ]),
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function preflight(evidencePackets = [], policy = {}, sourceSnapshotContentHash = '', contentHash = hash) {
  const compiled = compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositionPolicy(policy);
  const inputAssessments = evidencePackets.map(record => ({ evidencePacketKey: record.evidencePacketKey, integrity: sourcePacketIntegrity(record, policy, contentHash) }));
  const duplicateInputKeys = duplicates(evidencePackets.map(record => record.evidencePacketKey));
  const failures = [];
  if (!compiled.valid) failures.push('additional_resolution_evidence_sufficiency_policy_invalid_or_target_specific');
  if (!evidencePackets.length) failures.push('no_additional_resolution_evidence_packets');
  if (duplicateInputKeys.length) failures.push('duplicate_additional_resolution_evidence_packet_keys');
  if (!validHash(sourceSnapshotContentHash)) failures.push('source_evidence_snapshot_content_hash_missing_or_invalid');
  if (inputAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_additional_resolution_evidence_packets_failed_revalidation');
  if (accountStateFindings(evidencePackets).length) failures.push('current_account_state_present');
  const records = failures.length ? [] : evidencePackets.map(record => dispositionRecord(record, policy, sourceSnapshotContentHash, contentHash))
    .sort((left, right) => left.dispositionKey.localeCompare(right.dispositionKey));
  return { compiled, inputAssessments, duplicateInputKeys, failures, records };
}

export function auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions(records = [], {
  evidencePackets = [], policy = {}, sourceSnapshotContentHash = '', contentHash = hash
} = {}) {
  const flight = preflight(evidencePackets, policy, sourceSnapshotContentHash, contentHash);
  const inputKeys = evidencePackets.map(record => record.evidencePacketKey);
  const outputKeys = records.map(record => record.sourceEvidencePacketKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const expectedByKey = new Map(flight.records.map(record => [record.dispositionKey, record]));
  const recordMismatches = records.filter(record => !expectedByKey.has(record.dispositionKey) || !same(record, expectedByKey.get(record.dispositionKey), contentHash)).map(record => record.dispositionKey || 'unknown');
  const invalidRoutes = records.filter(record => !(policy.reviewRoutes || []).includes(record.reviewRoute)).map(record => record.dispositionKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.resolutionReview?.state !== 'unreviewed' || record.resolutionReview?.decision !== null
    || record.resolutionReview?.reviewer !== null || record.resolutionReview?.reviewedAt !== null || record.resolutionReview?.reviewNotes !== null
    || record.resolutionReview?.evidenceKeys?.length || record.selectedResolution !== null || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null || record.repeatabilityClassification !== null || record.mechanicsReviewComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).map(record => record.dispositionKey || 'unknown');
  const accountFindings = accountStateFindings([...evidencePackets, ...records]);
  const failures = [...flight.failures];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) failures.push('input_and_output_disposition_sets_do_not_match_exactly');
  if (recordMismatches.length) failures.push('one_or_more_dispositions_do_not_match_policy_bound_evidence');
  if (invalidRoutes.length) failures.push('one_or_more_disposition_routes_invalid');
  if (unsupportedPromotions.length) failures.push('sufficiency_disposition_created_unsupported_review_resolution_identity_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const publishable = failures.length === 0;
  const routeCounts = Object.fromEntries((policy.reviewRoutes || []).map(route => [route, records.filter(record => record.reviewRoute === route).length]));
  const classificationCounts = Object.fromEntries((policy.classifications || []).map(classification => [classification, records.filter(record => record.classification === classification).length]));
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputEvidencePacketCount: evidencePackets.length,
      completeEvidencePacketCount: flight.inputAssessments.filter(item => item.integrity.complete).length,
      failedEvidencePacketKeys: flight.inputAssessments.filter(item => !item.integrity.complete).map(item => item.evidencePacketKey),
      duplicateInputKeys: flight.duplicateInputKeys,
      duplicateOutputKeys,
      missingOutputKeys,
      unexpectedOutputKeys,
      sourceSnapshotContentHash
    },
    policyCoverage: flight.compiled,
    sourceIntegrityCoverage: {
      completeCommonEvidenceShapeCount: flight.inputAssessments.filter(item => item.integrity.evidenceShape.commonEvidenceComplete).length,
      revisionPinnedCategoryMemberCount: evidencePackets.reduce((sum, record) => sum + (record.categoryMemberEvidence?.members || []).filter(member => memberIntegrity(member, record.categoryMemberEvidence?.requestedTitle, contentHash).complete).length, 0),
      revalidatedPinnedGuideCount: evidencePackets.reduce((sum, record) => sum + (record.pinnedGuideRevalidations || []).filter(item => pinnedGuideIntegrity(item, contentHash).complete).length, 0),
      failedPacketIntegrityCount: flight.inputAssessments.filter(item => !item.integrity.complete).length,
      failedPacketIntegrityChecks: flight.inputAssessments.filter(item => !item.integrity.complete).map(item => ({
        evidencePacketKey: item.evidencePacketKey,
        failedChecks: Object.entries(item.integrity.checks).filter(([, passed]) => !passed).map(([check]) => check)
      }))
    },
    dispositionCoverage: {
      dispositionCount: records.length,
      ...classificationCounts,
      recordMismatches,
      invalidRoutes
    },
    reviewRoutingCoverage: {
      ...routeCounts,
      reviewReadyCount: records.filter(record => record.reviewRoute !== policy.reviewRoutes?.[2]).length,
      additionalEvidenceRequiredCount: records.filter(record => record.reviewRoute === policy.reviewRoutes?.[2]).length
    },
    bindingCoverage: {
      exactSourcePacketBindingCount: records.length - recordMismatches.length,
      evidenceBindingCount: records.reduce((sum, record) => sum + 6 + (record.evidenceBindings?.pinnedGuideRevalidationContentHashes || []).length, 0),
      bindingMismatchKeys: recordMismatches
    },
    semanticPreservationCoverage: {
      resolutionReviewCompletedCount: records.filter(record => record.resolutionReview?.state !== 'unreviewed').length,
      selectedResolutionCount: records.filter(record => record.selectedResolution !== null).length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(record => record.repeatabilityClassification !== null).length,
      mechanicsReviewCompleteCount: records.filter(record => record.mechanicsReviewComplete === true).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied === true).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    dispositionCoverageComplete: publishable && records.length === evidencePackets.length,
    resolutionReviewComplete: false,
    canonicalIdentityComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(records.some(record => record.reviewRoute === policy.reviewRoutes?.[0]) ? ['explicit_source_bound_described_category_page_resolution_reviews_pending'] : []),
      ...(records.some(record => record.reviewRoute === policy.reviewRoutes?.[1]) ? ['explicit_source_bound_redlink_category_target_resolution_reviews_pending'] : []),
      ...(records.some(record => record.reviewRoute === policy.reviewRoutes?.[2]) ? ['additional_source_bound_category_resolution_evidence_pending'] : []),
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({
  evidencePackets = [], policy = {}, sourceSnapshotContentHash = '', contentHash = hash
} = {}) {
  const flight = preflight(evidencePackets, policy, sourceSnapshotContentHash, contentHash);
  const records = flight.failures.length ? [] : flight.records;
  return { records, audit: auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions(records, { evidencePackets, policy, sourceSnapshotContentHash, contentHash }) };
}
