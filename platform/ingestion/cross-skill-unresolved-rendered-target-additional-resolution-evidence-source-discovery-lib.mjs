import { hash } from './lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const revisionFor = page => page?.revisions?.[0];
const contentFor = page => revisionFor(page)?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|title|titles|requestedTitle|requestedTitles|renderedTargetKey|renderedTargetKeys|alias|aliases|override|overrides)$/i;
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

export function compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscoveryPolicy(policy = {}) {
  const requiredRules = [
    'onePacketPerAdditionalEvidenceWorkEntry',
    'inputQueueRecordAndSnapshotHashesMustRevalidate',
    'onlyCategoryNamespaceTargetsUseThisCollector',
    'namespaceMetadataMustComeFromTheOfficialWikiApi',
    'exactCurrentCategoryInfoMustPreserveMissingPageAndCategoryInfoSeparately',
    'categoryMembershipMustBeFullyEnumerated',
    'everyCategoryMemberMustRetainItsCurrentRevisionAndExactCategoryOccurrence',
    'categoryPrefixEnumerationMustBeFullyEnumerated',
    'namespaceSearchesMustRemoveOnlyTheVerifiedNamespacePrefix',
    'namespaceSearchCandidatesMustRetainTheirCurrentRevisions',
    'exactTitleLogHistoryMustBeFullyEnumerated',
    'everyPinnedGuideRevisionAndOccurrenceMustRefetchAndRevalidate',
    'redlinkCategoryEvidenceIsNotMissingCategoryIdentityEvidence',
    'discoveryEvidenceCannotSelectAResolutionOrCanonicalIdentity',
    'sourceSilenceIsNotNegativeEvidence',
    'explicitSourceBoundDispositionRemainsSeparateAndRequired',
    'canonicalIdentityRepeatabilityMechanicsAndOptimizerEligibilityRemainClosed',
    'namesTitlesPageIdsRevisionsAliasesAndOverridesCannotSelectAVerdict',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const discovery = policy.discovery || {};
  if (discovery.categoryNamespaceId !== 14) invalidRules.push('category_namespace_id_invalid');
  if (discovery.categoryNamespaceCanonicalName !== 'Category') invalidRules.push('category_namespace_name_invalid');
  if (!Number.isInteger(discovery.maximumResultsPerQuery) || discovery.maximumResultsPerQuery < 1) invalidRules.push('maximum_results_invalid');
  if (discovery.requireContinuationExhausted !== true) invalidRules.push('continuation_exhaustion_not_required');
  if (discovery.retainCompleteCurrentRevisionSource !== true) invalidRules.push('complete_current_revision_source_not_required');
  const expectedChannels = [
    'independent_revision_pinned_official_wiki_source_discovery',
    'exact_title_redirect_move_and_deletion_history',
    'pinned_guide_context_resolution'
  ];
  const expectedQueries = [
    'exact_current_category_info',
    'complete_category_member_inventory',
    'exact_category_prefix_inventory',
    'namespace_title_phrase_search_without_prefix',
    'namespace_text_phrase_search_without_prefix',
    'complete_exact_title_log_history',
    'exact_pinned_guide_revision_revalidation'
  ];
  const contractValid = policy.inputContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-additional-evidence-work-queue-entry.v1'
    && policy.recordContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery.v1'
    && policy.auditContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-audit.v1'
    && policy.inputState === 'blocked_pending_additional_source_bound_resolution_evidence'
    && policy.recordState === 'revision_pinned_unresolved_rendered_target_additional_resolution_evidence_gates_closed';
  const configurationValid = same(discovery.requiredAdditionalEvidenceChannels || [], expectedChannels)
    && same(discovery.queryKinds || [], expectedQueries);
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
  const findings = [];
  const forbidden = /^(?:username|accountName|currentLevel|currentXp|questPoints|combatLevel|bank|ownedEquipment|activeGoal|playerState)$/i;
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

function categoryBaseTitle(requestedTitle, policy) {
  const prefix = `${policy.discovery.categoryNamespaceCanonicalName}:`;
  return String(requestedTitle || '').startsWith(prefix) ? String(requestedTitle).slice(prefix.length) : null;
}

export function deriveUnresolvedRenderedTargetCategorySearchQueries(requestedTitle, policy = {}) {
  const baseTitle = categoryBaseTitle(requestedTitle, policy);
  if (!baseTitle) return [];
  const escaped = baseTitle.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return [
    {
      queryKind: 'namespace_title_phrase_search_without_prefix',
      query: `intitle:"${escaped}"`,
      terms: [baseTitle],
      namespaceId: policy.discovery.categoryNamespaceId
    },
    {
      queryKind: 'namespace_text_phrase_search_without_prefix',
      query: `"${escaped}"`,
      terms: [baseTitle],
      namespaceId: policy.discovery.categoryNamespaceId
    }
  ];
}

function inputIntegrity(record = {}, policy = {}, contentHash = hash) {
  const review = record.resolutionReview || {};
  const currentEvidence = record.resolutionEvidence?.currentTitleResolutionEvidence || [];
  const checks = {
    contractMatches: record.contract === policy.inputContract,
    stateMatches: record.state === policy.inputState,
    ordinalValid: Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0,
    keyPresent: typeof record.workQueueEntryKey === 'string' && record.workQueueEntryKey.length > 0,
    intrinsicHashMatches: typeof record.contentHash === 'string' && contentHash(without(record, 'contentHash')) === record.contentHash,
    exactOneCategoryTitle: Array.isArray(record.requestedTitles) && record.requestedTitles.length === 1 && categoryBaseTitle(record.requestedTitles[0], policy) !== null,
    currentResolutionEvidencePresent: currentEvidence.length === 1 && currentEvidence[0]?.requestedTitle === record.requestedTitles?.[0]
      && currentEvidence[0]?.queryComplete !== false,
    namespaceMatches: currentEvidence.every(item =>
      Number(item.currentMissingPage?.namespaceId ?? item.currentPageEvidence?.sourcePageIdentity?.namespaceId) === policy.discovery.categoryNamespaceId) === true,
    upstreamBindingsPresent: [
      record.sourceDispositionRecordContentHash, record.sourceEvidenceRecordContentHash,
      record.sourceDispositionSnapshotContentHash, record.sourceEvidenceSnapshotContentHash,
      record.evidenceFingerprint
    ].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)),
    expectedAdditionalEvidenceRoute: record.insufficiencyDisposition === 'no_resolution_candidate_evidence_requires_additional_evidence',
    requiredChannelsMatch: same(record.requiredAdditionalEvidenceChannels || [], policy.discovery.requiredAdditionalEvidenceChannels || [], contentHash),
    newEvidenceStartsEmpty: Array.isArray(record.newEvidenceKeys) && record.newEvidenceKeys.length === 0,
    pinnedGuideEvidencePresent: Array.isArray(record.resolutionEvidence?.pinnedGuideEvidence) && record.resolutionEvidence.pinnedGuideEvidence.length > 0,
    resolutionReviewBlank: [review.decision, review.reviewer, review.reviewedAt, review.reviewNotes, review.selectedPageId, review.selectedTitle].every(value => value === null)
      && Array.isArray(review.evidenceKeys) && review.evidenceKeys.length === 0,
    semanticGatesClosed: record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null
      && record.repeatabilityClassification === null && record.optimizerEligible === false,
    accountIndependent: record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function pinnedGuideExpectations(records = []) {
  return records.flatMap(record => (record.resolutionEvidence?.pinnedGuideEvidence || []).map(evidence => ({
    workQueueEntryKey: record.workQueueEntryKey,
    requestedTitle: evidence.requestedTitle,
    evidence,
    identity: evidence.pinnedGuideSourceIdentity
  })));
}

function revisionPage(revision, pages = []) {
  return pages.find(page => (page.revisions || []).some(item => String(item.revid) === String(revision)));
}

function titleKey(value) {
  const title = String(value || '').replaceAll('_', ' ').trim();
  const colon = title.indexOf(':');
  const prefix = colon >= 0 ? title.slice(0, colon).toLocaleLowerCase('en') : '';
  const rest = colon >= 0 ? title.slice(colon + 1) : title;
  const normalized = rest ? `${rest[0].toLocaleUpperCase('en')}${rest.slice(1)}` : rest;
  return `${prefix}:${normalized}`;
}

function categoryOccurrences(source, requestedTitle) {
  const target = titleKey(requestedTitle);
  const occurrences = [];
  for (const [index, line] of String(source || '').split(/\r?\n/).entries()) {
    const pattern = /\[\[\s*([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
    for (const match of line.matchAll(pattern)) {
      if (titleKey(match[1]) !== target) continue;
      occurrences.push({
        line: index + 1,
        sourceText: match[0],
        sourceTextContentHash: hash(match[0])
      });
    }
  }
  return occurrences;
}

function revalidatePinnedGuides(records, pages, contentHash = hash) {
  return pinnedGuideExpectations(records).map(expectation => {
    const identity = expectation.identity || {};
    const page = revisionPage(identity.sourceRevision, pages);
    const revision = (page?.revisions || []).find(item => String(item.revid) === String(identity.sourceRevision));
    const content = revision?.slots?.main?.content;
    const occurrences = typeof content === 'string' ? categoryOccurrences(content, expectation.requestedTitle) : [];
    const expectedOccurrences = expectation.evidence.exactSourceOccurrences || [];
    const checks = {
      pagePresent: Boolean(page && revision),
      pageIdMatches: Number(page?.pageid) === Number(identity.sourcePageId),
      titleMatches: page?.title === identity.resolvedTitle,
      revisionMatches: String(revision?.revid || '') === String(identity.sourceRevision || ''),
      timestampMatches: revision?.timestamp === identity.sourceTimestamp,
      sourceComplete: typeof content === 'string',
      sourceHashMatches: typeof content === 'string' && contentHash(content) === identity.sourceContentHash,
      sourceBytesMatch: typeof content === 'string' && new TextEncoder().encode(content).length === Number(identity.sourceContentBytes),
      exactCategoryOccurrencePresent: occurrences.length > 0,
      retainedOccurrenceLinesMatch: expectedOccurrences.every(item => occurrences.some(found => found.line === Number(item.sourceLocator?.line)))
    };
    return {
      workQueueEntryKey: expectation.workQueueEntryKey,
      requestedTitle: expectation.requestedTitle,
      sourceIdentity: identity,
      exactCategoryOccurrences: occurrences,
      checks,
      complete: Object.values(checks).every(Boolean)
    };
  });
}

function sourceIdentity(page, contentHash = hash) {
  const revision = revisionFor(page);
  const content = contentFor(page);
  if (!page || page.missing === true || !page.pageid || !revision?.revid || !revision.timestamp || typeof content !== 'string') return null;
  return {
    namespaceId: Number(page.ns),
    resolvedTitle: page.title,
    sourcePageId: Number(page.pageid),
    sourceRevision: String(revision.revid),
    sourceTimestamp: revision.timestamp,
    sourceUrl: wikiUrl(page.title),
    sourceContentHash: contentHash(content),
    sourceContentBytes: new TextEncoder().encode(content).length,
    sourceText: content
  };
}

function exactCurrentEvidence(requestedTitle, result, policy, contentHash = hash) {
  const response = result?.response || {};
  const page = response.query?.pages?.[0] || null;
  const currentPageIdentity = sourceIdentity(page, contentHash);
  const categoryInfo = page?.categoryinfo ? {
    size: Number(page.categoryinfo.size || 0),
    pages: Number(page.categoryinfo.pages || 0),
    files: Number(page.categoryinfo.files || 0),
    subcategories: Number(page.categoryinfo.subcats || 0),
    hidden: page.categoryinfo.hidden === true
  } : null;
  const evidence = {
    requestedTitle,
    namespaceId: Number(page?.ns),
    normalizedMappings: response.query?.normalized || [],
    redirectMappings: response.query?.redirects || [],
    pageDescriptionExists: Boolean(page && page.missing !== true),
    currentMissingPage: page?.missing === true ? { namespaceId: Number(page.ns), title: page.title } : null,
    currentPageIdentity,
    categoryInfo,
    categoryExistsByApiState: categoryInfo !== null,
    redlinkCategoryState: page?.missing === true && categoryInfo !== null,
    queryComplete: result?.complete === true && response.batchcomplete === true,
    semanticResolutionApplied: false
  };
  evidence.checks = {
    exactTitlePreserved: requestedTitle === result?.requestedTitle,
    namespaceMatches: Number(page?.ns) === policy.discovery.categoryNamespaceId,
    pageStatePresent: Boolean(page),
    missingAndCategoryStateSeparated: !(evidence.currentMissingPage === null && evidence.currentPageIdentity === null),
    categoryInfoPresent: categoryInfo !== null,
    complete: evidence.queryComplete,
    noSemanticResolution: evidence.semanticResolutionApplied === false
  };
  evidence.complete = Object.values(evidence.checks).every(Boolean);
  evidence.evidenceContentHash = contentHash(without(evidence, 'evidenceContentHash'));
  return evidence;
}

function prefixEvidence(requestedTitle, result, policy, contentHash = hash) {
  const baseTitle = categoryBaseTitle(requestedTitle, policy);
  const entries = sorted(unique((result?.entries || []).map(item => typeof item === 'string' ? item : item.category).filter(Boolean)));
  const evidence = {
    requestedTitle,
    prefix: result?.prefix,
    entries,
    exactBaseTitlePresent: entries.includes(baseTitle),
    continuationExhausted: result?.continuationExhausted === true,
    complete: result?.complete === true && result?.continuationExhausted === true && result?.prefix === baseTitle && entries.includes(baseTitle)
  };
  evidence.evidenceContentHash = contentHash(without(evidence, 'evidenceContentHash'));
  return evidence;
}

function memberEvidence(requestedTitle, result, sourceResolutions, categoryInfo, contentHash = hash) {
  const members = [...(result?.members || [])].sort((left, right) => Number(left.pageid) - Number(right.pageid) || String(left.title).localeCompare(String(right.title))).map(member => {
    const resolution = sourceResolutions.find(item => item.requestedTitle === member.title);
    const identity = sourceIdentity(resolution?.page, contentHash);
    const occurrences = identity ? categoryOccurrences(identity.sourceText, requestedTitle) : [];
    return {
      pageId: Number(member.pageid),
      namespaceId: Number(member.ns),
      title: member.title,
      sortKey: member.sortkey || null,
      sortKeyPrefix: member.sortkeyprefix || null,
      memberTimestamp: member.timestamp || null,
      currentSourceIdentity: identity,
      exactCategoryOccurrences: occurrences,
      checks: {
        currentRevisionCaptured: identity !== null,
        stablePageIdMatches: Number(identity?.sourcePageId) === Number(member.pageid),
        titleMatches: identity?.resolvedTitle === member.title,
        exactCategoryOccurrencePresent: occurrences.length > 0
      }
    };
  });
  for (const member of members) member.complete = Object.values(member.checks).every(Boolean);
  const evidence = {
    requestedTitle,
    memberCount: members.length,
    members,
    categoryInfoReconciliation: {
      reportedSize: Number(categoryInfo?.size),
      reportedPages: Number(categoryInfo?.pages),
      reportedFiles: Number(categoryInfo?.files),
      reportedSubcategories: Number(categoryInfo?.subcategories),
      enumeratedSize: members.length,
      enumeratedPages: members.filter(item => item.namespaceId === 0).length,
      enumeratedFiles: members.filter(item => item.namespaceId === 6).length,
      enumeratedSubcategories: members.filter(item => item.namespaceId === 14).length
    },
    continuationExhausted: result?.continuationExhausted === true,
    complete: false,
    semanticResolutionApplied: false
  };
  const reconciliation = evidence.categoryInfoReconciliation;
  evidence.complete = result?.complete === true && result?.continuationExhausted === true && members.every(member => member.complete)
    && reconciliation.reportedSize === reconciliation.enumeratedSize
    && reconciliation.reportedPages === reconciliation.enumeratedPages
    && reconciliation.reportedFiles === reconciliation.enumeratedFiles
    && reconciliation.reportedSubcategories === reconciliation.enumeratedSubcategories;
  evidence.evidenceContentHash = contentHash(without(evidence, 'evidenceContentHash'));
  return evidence;
}

function searchEvidence(requestedTitle, responses, expectedQueries, policy, contentHash = hash) {
  const queries = (responses?.queries || []).map(response => {
    const pages = [...(response.pages || [])].sort((left, right) => Number(left.index || 0) - Number(right.index || 0) || String(left.title).localeCompare(String(right.title))).map(page => ({
      searchRank: Number(page.index || 0),
      sourceIdentity: sourceIdentity(page, contentHash)
    }));
    return {
      queryKind: response.queryKind,
      query: response.query,
      terms: response.terms,
      namespaceId: Number(response.namespaceId),
      candidateCount: pages.length,
      candidates: pages,
      continuationExhausted: response.continuationExhausted === true,
      complete: response.complete === true && response.continuationExhausted === true
        && Number(response.namespaceId) === policy.discovery.categoryNamespaceId
        && pages.every(item => item.sourceIdentity !== null)
    };
  });
  const evidence = {
    requestedTitle,
    queries,
    allExpectedQueriesPresent: same(queries.map(item => ({ queryKind: item.queryKind, query: item.query, terms: item.terms, namespaceId: item.namespaceId })), expectedQueries, contentHash),
    selectedCandidatePageId: null,
    complete: queries.length === expectedQueries.length && queries.every(item => item.complete)
  };
  evidence.complete = evidence.complete && evidence.allExpectedQueriesPresent;
  evidence.evidenceContentHash = contentHash(without(evidence, 'evidenceContentHash'));
  return evidence;
}

function historyEvidence(requestedTitle, result, contentHash = hash) {
  const events = [...(result?.events || [])].sort((left, right) => Number(left.logid || 0) - Number(right.logid || 0)).map(event => ({
    logId: Number(event.logid),
    pageId: event.pageid ? Number(event.pageid) : null,
    namespaceId: Number(event.ns),
    title: event.title,
    type: event.type,
    action: event.action || null,
    timestamp: event.timestamp || null,
    comment: event.comment || null,
    params: event.params || null
  }));
  const evidence = {
    requestedTitle,
    events,
    eventCount: events.length,
    continuationExhausted: result?.continuationExhausted === true,
    complete: result?.complete === true && result?.continuationExhausted === true && result?.requestedTitle === requestedTitle,
    semanticResolutionApplied: false
  };
  evidence.evidenceContentHash = contentHash(without(evidence, 'evidenceContentHash'));
  return evidence;
}

function namespaceEvidence(namespaceMetadata, policy, contentHash = hash) {
  const namespace = namespaceMetadata?.namespace || null;
  const evidence = {
    namespaceId: Number(namespace?.id),
    canonicalName: namespace?.canonicalName || null,
    localizedName: namespace?.localizedName || null,
    caseRule: namespace?.caseRule || null,
    aliases: sorted(unique(namespaceMetadata?.aliases || [])),
    queryComplete: namespaceMetadata?.complete === true,
    complete: namespaceMetadata?.complete === true
      && Number(namespace?.id) === policy.discovery.categoryNamespaceId
      && namespace?.canonicalName === policy.discovery.categoryNamespaceCanonicalName
  };
  evidence.evidenceContentHash = contentHash(without(evidence, 'evidenceContentHash'));
  return evidence;
}

export function buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery({
  workQueueRecords = [], pinnedRevisionPages = [], namespaceMetadata = null,
  exactCurrentCategoryResults = [], categoryPrefixResults = [], categoryMemberResults = [],
  categoryMemberSourceResolutions = [], namespaceSearchResults = [], titleHistoryResults = [],
  policy = {}, sourceQueueSnapshotContentHash = '', contentHash = hash
} = {}) {
  const compiledPolicy = compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscoveryPolicy(policy);
  const inputChecks = workQueueRecords.map(record => ({ workQueueEntryKey: record.workQueueEntryKey, ...inputIntegrity(record, policy, contentHash) }));
  const pinned = revalidatePinnedGuides(workQueueRecords, pinnedRevisionPages, contentHash);
  const namespace = namespaceEvidence(namespaceMetadata, policy, contentHash);
  const structuralReady = compiledPolicy.valid && workQueueRecords.length > 0 && inputChecks.every(item => item.complete)
    && pinned.length > 0 && pinned.every(item => item.complete) && namespace.complete
    && typeof sourceQueueSnapshotContentHash === 'string' && sourceQueueSnapshotContentHash.length === 64;
  const records = structuralReady ? workQueueRecords.map(record => {
    const requestedTitle = record.requestedTitles[0];
    const exact = exactCurrentEvidence(requestedTitle, exactCurrentCategoryResults.find(item => item.workQueueEntryKey === record.workQueueEntryKey), policy, contentHash);
    const prefix = prefixEvidence(requestedTitle, categoryPrefixResults.find(item => item.workQueueEntryKey === record.workQueueEntryKey), policy, contentHash);
    const sourceGroup = categoryMemberSourceResolutions.find(item => item.workQueueEntryKey === record.workQueueEntryKey)?.resolutions || [];
    const members = memberEvidence(requestedTitle, categoryMemberResults.find(item => item.workQueueEntryKey === record.workQueueEntryKey), sourceGroup, exact.categoryInfo, contentHash);
    const expectedQueries = deriveUnresolvedRenderedTargetCategorySearchQueries(requestedTitle, policy);
    const searches = searchEvidence(requestedTitle, namespaceSearchResults.find(item => item.workQueueEntryKey === record.workQueueEntryKey), expectedQueries, policy, contentHash);
    const history = historyEvidence(requestedTitle, titleHistoryResults.find(item => item.workQueueEntryKey === record.workQueueEntryKey), contentHash);
    const pinnedForRecord = pinned.filter(item => item.workQueueEntryKey === record.workQueueEntryKey);
    const evidenceObjects = [namespace, exact, prefix, members, searches, history, ...pinnedForRecord];
    const newEvidenceKeys = evidenceObjects.map(item => item.evidenceContentHash || contentHash(item));
    const requiredChannelStatus = [
      {
        channel: 'independent_revision_pinned_official_wiki_source_discovery',
        observed: prefix.complete && members.complete && searches.complete,
        evidenceKeys: [prefix.evidenceContentHash, members.evidenceContentHash, searches.evidenceContentHash]
      },
      {
        channel: 'exact_title_redirect_move_and_deletion_history',
        observed: exact.complete && history.complete,
        evidenceKeys: [exact.evidenceContentHash, history.evidenceContentHash]
      },
      {
        channel: 'pinned_guide_context_resolution',
        observed: pinnedForRecord.length > 0 && pinnedForRecord.every(item => item.complete) && members.complete,
        evidenceKeys: [...pinnedForRecord.map(item => contentHash(item)), members.evidenceContentHash]
      }
    ];
    const base = {
      contract: policy.recordContract,
      evidencePacketKey: `${record.workQueueEntryKey}|additional-resolution-evidence-source-discovery`,
      workQueueEntryKey: record.workQueueEntryKey,
      sourceWorkQueueRecordContentHash: record.contentHash,
      sourceQueueSnapshotContentHash,
      sourceDispositionKey: record.sourceDispositionKey,
      sourceDispositionRecordContentHash: record.sourceDispositionRecordContentHash,
      sourceEvidenceRecordContentHash: record.sourceEvidenceRecordContentHash,
      sourceDispositionSnapshotContentHash: record.sourceDispositionSnapshotContentHash,
      sourceEvidenceSnapshotContentHash: record.sourceEvidenceSnapshotContentHash,
      evidenceFingerprint: record.evidenceFingerprint,
      renderedTargetKey: record.renderedTargetKey,
      requestedTitles: [...record.requestedTitles],
      pinnedGuideRevalidations: pinnedForRecord,
      namespaceMetadataEvidence: namespace,
      exactCurrentCategoryEvidence: exact,
      categoryPrefixEvidence: prefix,
      categoryMemberEvidence: members,
      namespaceSearchEvidence: searches,
      titleHistoryEvidence: history,
      requiredChannelStatus,
      newEvidenceKeys: sorted(unique(newEvidenceKeys)),
      sourceSilenceIsNotNegativeEvidence: true,
      resolutionReview: { decision: null, reviewer: null, reviewedAt: null, reviewNotes: null, evidenceKeys: [] },
      selectedResolution: null,
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityClassification: null,
      mechanicsReviewComplete: false,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      blockers: [
        'source_bound_category_target_resolution_disposition_pending',
        'canonical_game_entity_and_activity_identity_not_established',
        'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
        'independent_complete_activity_universe_not_established'
      ],
      state: policy.recordState
    };
    return { ...base, recordContentHash: contentHash(base) };
  }) : [];
  const args = {
    workQueueRecords, pinnedRevisionPages, namespaceMetadata, exactCurrentCategoryResults,
    categoryPrefixResults, categoryMemberResults, categoryMemberSourceResolutions,
    namespaceSearchResults, titleHistoryResults, policy, sourceQueueSnapshotContentHash, contentHash,
    compiledPolicy, inputChecks, pinned, namespace
  };
  return { records, audit: auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(records, args) };
}

export function auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(records = [], {
  workQueueRecords = [], policy = {}, sourceQueueSnapshotContentHash = '', contentHash = hash,
  compiledPolicy = compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscoveryPolicy(policy),
  inputChecks = workQueueRecords.map(record => ({ workQueueEntryKey: record.workQueueEntryKey, ...inputIntegrity(record, policy, contentHash) })),
  pinned = [], namespace = { complete: false }
} = {}) {
  const expectedKeys = workQueueRecords.map(record => record.workQueueEntryKey);
  const actualKeys = records.map(record => record.workQueueEntryKey);
  const completeRecords = records.filter(record => {
    const input = workQueueRecords.find(item => item.workQueueEntryKey === record.workQueueEntryKey);
    const exactBindingsMatch = Boolean(input)
      && record.sourceWorkQueueRecordContentHash === input.contentHash
      && record.sourceQueueSnapshotContentHash === sourceQueueSnapshotContentHash
      && record.sourceDispositionKey === input.sourceDispositionKey
      && record.sourceDispositionRecordContentHash === input.sourceDispositionRecordContentHash
      && record.sourceEvidenceRecordContentHash === input.sourceEvidenceRecordContentHash
      && record.sourceDispositionSnapshotContentHash === input.sourceDispositionSnapshotContentHash
      && record.sourceEvidenceSnapshotContentHash === input.sourceEvidenceSnapshotContentHash
      && record.evidenceFingerprint === input.evidenceFingerprint
      && record.renderedTargetKey === input.renderedTargetKey
      && same(record.requestedTitles, input.requestedTitles, contentHash);
    return exactBindingsMatch && record.recordContentHash === contentHash(without(record, 'recordContentHash', 'contentHash'))
    && record.exactCurrentCategoryEvidence?.complete === true
    && record.categoryPrefixEvidence?.complete === true
    && record.categoryMemberEvidence?.complete === true
    && record.namespaceSearchEvidence?.complete === true
    && record.titleHistoryEvidence?.complete === true
    && record.requiredChannelStatus?.every(item => item.observed === true);
  });
  const semanticViolations = records.filter(record => record.selectedResolution !== null || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null || record.repeatabilityClassification !== null || record.mechanicsReviewComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false || record.resolutionReview?.decision !== null);
  const accountFindings = accountStateFindings([...workQueueRecords, ...records]);
  const blockers = [];
  if (!workQueueRecords.length) blockers.push('additional_resolution_evidence_work_queue_empty');
  if (inputChecks.some(item => !item.complete)) blockers.push('one_or_more_input_work_queue_entries_failed_revalidation');
  if (!compiledPolicy.valid) blockers.push('additional_resolution_evidence_source_discovery_policy_invalid');
  if (!sourceQueueSnapshotContentHash || sourceQueueSnapshotContentHash.length !== 64) blockers.push('source_queue_snapshot_hash_missing_or_invalid');
  if (!pinned.length || pinned.some(item => !item.complete)) blockers.push('one_or_more_pinned_guide_sources_failed_exact_revision_revalidation');
  if (!namespace.complete) blockers.push('official_category_namespace_metadata_missing_or_invalid');
  if (!same(expectedKeys, actualKeys, contentHash) || records.length !== workQueueRecords.length) blockers.push('evidence_packet_coverage_incomplete_or_out_of_order');
  if (completeRecords.length !== records.length) blockers.push('one_or_more_additional_resolution_evidence_packets_incomplete');
  if (semanticViolations.length) blockers.push('source_discovery_created_unsupported_resolution_identity_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const structuralBlockers = new Set(blockers);
  const publishable = structuralBlockers.size === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputWorkQueueEntryCount: workQueueRecords.length,
      completeInputWorkQueueEntryCount: inputChecks.filter(item => item.complete).length,
      outputEvidencePacketCount: records.length,
      completeOutputEvidencePacketCount: completeRecords.length,
      inputOutputOrderMatches: same(expectedKeys, actualKeys, contentHash)
    },
    policyCoverage: compiledPolicy,
    pinnedGuideIntegrityCoverage: {
      expectedPinnedGuideCount: pinnedGuideExpectations(workQueueRecords).length,
      revalidatedPinnedGuideCount: pinned.filter(item => item.complete).length
    },
    namespaceMetadataCoverage: {
      namespaceId: namespace.namespaceId ?? null,
      canonicalName: namespace.canonicalName ?? null,
      complete: namespace.complete === true
    },
    categoryIdentityCoverage: {
      exactCurrentQueryCount: records.length,
      redlinkCategoryCount: records.filter(record => record.exactCurrentCategoryEvidence?.redlinkCategoryState === true).length,
      describedCategoryPageCount: records.filter(record => record.exactCurrentCategoryEvidence?.currentPageIdentity !== null).length,
      categoryApiStateCount: records.filter(record => record.exactCurrentCategoryEvidence?.categoryExistsByApiState === true).length
    },
    categoryMemberCoverage: {
      inventoryCount: records.length,
      totalMemberCount: records.reduce((sum, record) => sum + Number(record.categoryMemberEvidence?.memberCount || 0), 0),
      membersWithRevisionPinnedExactCategoryOccurrence: records.reduce((sum, record) => sum + (record.categoryMemberEvidence?.members || []).filter(item => item.complete).length, 0),
      completeInventoryCount: records.filter(record => record.categoryMemberEvidence?.complete === true).length
    },
    categoryPrefixCoverage: {
      prefixInventoryCount: records.length,
      exactCategoryNamePresentCount: records.filter(record => record.categoryPrefixEvidence?.exactBaseTitlePresent === true).length,
      completePrefixInventoryCount: records.filter(record => record.categoryPrefixEvidence?.complete === true).length
    },
    namespaceSearchCoverage: {
      queryCount: records.reduce((sum, record) => sum + (record.namespaceSearchEvidence?.queries || []).length, 0),
      completeQueryCount: records.reduce((sum, record) => sum + (record.namespaceSearchEvidence?.queries || []).filter(item => item.complete).length, 0),
      revisionPinnedCandidateCount: records.reduce((sum, record) => sum + (record.namespaceSearchEvidence?.queries || []).flatMap(item => item.candidates || []).filter(item => item.sourceIdentity !== null).length, 0)
    },
    titleHistoryCoverage: {
      exactTitleHistoryCount: records.length,
      completeExactTitleHistoryCount: records.filter(record => record.titleHistoryEvidence?.complete === true).length,
      eventCount: records.reduce((sum, record) => sum + Number(record.titleHistoryEvidence?.eventCount || 0), 0)
    },
    requiredChannelCoverage: {
      requiredChannelCount: policy.discovery?.requiredAdditionalEvidenceChannels?.length || 0,
      packetChannelCount: records.reduce((sum, record) => sum + (record.requiredChannelStatus || []).length, 0),
      allEvidenceChannelsObserved: records.length === workQueueRecords.length && records.every(record => record.requiredChannelStatus?.every(item => item.observed === true))
    },
    semanticPreservationCoverage: {
      selectedResolutionCount: records.filter(record => record.selectedResolution !== null).length,
      recordedReviewCount: records.filter(record => record.resolutionReview?.decision !== null).length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(record => record.repeatabilityClassification !== null).length,
      mechanicsReviewCompleteCount: records.filter(record => record.mechanicsReviewComplete === true).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied === true).length
    },
    accountStateFindings: accountFindings,
    evidencePacketCaptureComplete: publishable,
    resolutionEvidenceSufficiencyDispositionComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: publishable ? [
      'source_bound_category_target_resolution_disposition_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ] : blockers,
    publishable
  };
}
