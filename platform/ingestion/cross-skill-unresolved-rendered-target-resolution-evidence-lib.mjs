import { parseSkillTrainingGuideDirectLinks } from './skill-training-guide-direct-link-lib.mjs';
import { parseLeadParagraphEvidence, parseSourceHeadings } from './activity-candidate-source-evidence-lib.mjs';

const REQUIRED_RULES = [
  'everyUnresolvedRenderedTargetMustProduceExactlyOneEvidencePacket',
  'inputManifestIntrinsicRecordAndObservationHashesMustRevalidate',
  'onlyNullIdentityTargetsWithMissingWikiPageObservationsAreEligible',
  'everyRequestedTitleMustReceiveAnExactCurrentResolutionQuery',
  'normalizationAndRedirectMappingsMustBePreservedWithoutAutomaticBinding',
  'everySourceGuideMustBeFetchedAtItsExactRetainedRevision',
  'everyRenderedObservationMustMatchAPinnedGuideOccurrenceUnderMediaWikiTitleNormalization',
  'discoveryQueriesMustBeDerivedOnlyFromTheExactRequestedTitleAndNamespace',
  'everyDiscoveryCandidateMustRetainItsExactCurrentRevision',
  'exactTitleLogHistoryMustBeFullyEnumerated',
  'searchCandidatesAndLogHistoryAreEvidenceNotIdentityVerdicts',
  'missingTitlesMustRemainMissingUntilASeparateSourceBoundDecision',
  'canonicalIdentityRepeatabilityMechanicsAndOptimizerEligibilityRemainClosed',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const normalizeTitle = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
const mediaWikiTitleKey = value => {
  const title = normalizeTitle(value);
  const colon = title.indexOf(':');
  const namespace = colon >= 0 ? title.slice(0, colon).toLowerCase() : null;
  const page = colon >= 0 ? title.slice(colon + 1) : title;
  const firstLetterNormalized = page ? `${page[0].toUpperCase()}${page.slice(1)}` : '';
  return namespace === null ? firstLetterNormalized : `${namespace}:${firstLetterNormalized}`;
};
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const validTimestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const contentOf = revision => revision?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(normalizeTitle(title).replaceAll(' ', '_'))}`;
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));

export function compileUnresolvedRenderedTargetResolutionEvidencePolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.policy === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence-policy.v1' &&
    policy.inputContract === 'sensum.skill-training-guide-rendered-link.v1' &&
    policy.recordContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence.v1' &&
    policy.auditContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence-audit.v1';
  return { valid: contractValid && invalidRules.length === 0, contractValid, invalidRules: unique(invalidRules) };
}

export function findUnresolvedRenderedTargetAccountState(records = []) {
  const findings = [];
  const forbidden = /^(?:currentBaseLevel|targetBaseLevel|currentLevel|currentXp|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|bank|bankItems|playerName|username|preferences|currentAccount)$/i;
  const visit = (value, at, recordKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`, recordKey));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push({ recordKey, path: next });
      visit(child, next, recordKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record.renderedTargetKey || `record-${index}`));
  return findings;
}

export function isUnresolvedRenderedTarget(record = {}) {
  return record.contract === 'sensum.skill-training-guide-rendered-link.v1' &&
    record.targetPageIdentity === null &&
    Array.isArray(record.observations) && record.observations.length > 0 &&
    record.observations.every(observation => observation.resolutionState === 'missing_wiki_page');
}

function inputIntegrity(record, contentHash) {
  const checks = {
    intrinsicHashValid: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    unresolvedShapeValid: isUnresolvedRenderedTarget(record),
    requestedTitlesPresent: Array.isArray(record.requestedTitles) && record.requestedTitles.length > 0 && duplicates(record.requestedTitles).length === 0,
    namespacesPresent: Array.isArray(record.namespaceIds) && record.namespaceIds.length > 0,
    observationCountMatches: record.guideObservationCount === record.observations?.length,
    observationBindingsPresent: record.observations?.every(observation => Number.isInteger(observation.guidePageId) && observation.guidePageId > 0 &&
      typeof observation.guideTitle === 'string' && observation.guideTitle.length > 0 && typeof observation.guideRevision === 'string' &&
      validHash(observation.guideContentHash) && typeof observation.requestedTitle === 'string' && Number.isInteger(observation.namespaceId)),
    semanticGatesClosed: record.canonicalActivityIdentity === null && record.repeatableTrainingActivity === null && record.optimizerEligible === false,
    accountIndependent: record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function sourceIdentity(page, revision, contentHash) {
  const content = contentOf(revision);
  if (!Number.isInteger(Number(page?.pageid)) || Number(page.pageid) <= 0 || !revision?.revid || !validTimestamp(revision.timestamp) || typeof content !== 'string') return null;
  return {
    sourcePageId: Number(page.pageid),
    namespaceId: Number(page.ns),
    resolvedTitle: page.title,
    sourceRevision: String(revision.revid),
    sourceTimestamp: revision.timestamp,
    sourceUrl: wikiUrl(page.title),
    sourceContentHash: contentHash(content),
    sourceContentBytes: Buffer.byteLength(content, 'utf8'),
    sourceLineCount: content.split(/\r?\n/).length
  };
}

function exactResolutionEvidence(requestedTitle, namespaceIds, resolution, contentHash) {
  const pages = resolution?.response?.query?.pages || [];
  const page = pages[0] || null;
  const revision = page?.revisions?.[0] || null;
  const identity = sourceIdentity(page, revision, contentHash);
  const missing = Boolean(page && Object.hasOwn(page, 'missing'));
  const pageNamespaceMatches = Boolean(page && namespaceIds.map(Number).includes(Number(page.ns)));
  const queryComplete = resolution?.complete === true && pages.length === 1 && pageNamespaceMatches && (missing || identity !== null);
  const base = {
    requestedTitle,
    requestedNamespaceIds: namespaceIds,
    queryTitle: resolution?.requestedTitle || null,
    exactRequestedTitlePreserved: resolution?.requestedTitle === requestedTitle,
    pageNamespaceMatches,
    normalizedMappings: resolution?.response?.query?.normalized || [],
    redirectMappings: resolution?.response?.query?.redirects || [],
    queryComplete,
    resolutionState: identity ? 'current_revision_pinned_page_evidence' : missing ? 'current_missing_wiki_page_evidence' : 'incomplete_current_resolution_evidence',
    currentPageEvidence: identity,
    currentMissingPage: missing ? { namespaceId: Number(page.ns), title: page.title } : null,
    canonicalIdentityApplied: false
  };
  return { ...base, evidenceContentHash: contentHash(base) };
}

function candidateEvidence(page, contentHash) {
  const revision = page?.revisions?.[0];
  const identity = sourceIdentity(page, revision, contentHash);
  const content = contentOf(revision);
  return {
    searchRank: Number(page?.index),
    sourcePageIdentity: identity,
    leadParagraphEvidence: identity ? parseLeadParagraphEvidence(content, null).slice(0, 3) : [],
    headingEvidence: identity ? parseSourceHeadings(content) : [],
    candidateIdentityApplied: false
  };
}

function discoveryEvidence(requestedTitle, namespaceIds, discovery, contentHash) {
  const candidates = (discovery?.pages || []).map(page => candidateEvidence(page, contentHash))
    .sort((a, b) => a.searchRank - b.searchRank || String(a.sourcePageIdentity?.resolvedTitle).localeCompare(String(b.sourcePageIdentity?.resolvedTitle)));
  const expectedQuery = `intitle:${requestedTitle}`;
  const expectedNamespaces = sorted(namespaceIds);
  const queryComplete = discovery?.complete === true && discovery?.requestedTitle === requestedTitle && discovery?.query === expectedQuery &&
    contentHash(sorted(discovery?.namespaceIds || [])) === contentHash(expectedNamespaces) && candidates.every(candidate =>
      candidate.sourcePageIdentity !== null && expectedNamespaces.includes(String(candidate.sourcePageIdentity.namespaceId)));
  const base = {
    requestedTitle,
    requestedNamespaceIds: expectedNamespaces.map(Number),
    query: discovery?.query || null,
    queryDerivedOnlyFromRequestedTitle: discovery?.query === expectedQuery,
    queryComplete,
    candidateCount: candidates.length,
    candidates,
    selectedCandidatePageId: null,
    canonicalIdentityApplied: false
  };
  return { ...base, evidenceContentHash: contentHash(base) };
}

function logEvidence(requestedTitle, logResult, contentHash) {
  const events = (logResult?.events || []).map(event => ({
    logId: Number(event.logid),
    pageId: Number(event.pageid || 0),
    namespaceId: Number(event.ns),
    title: event.title,
    type: event.type,
    action: event.action,
    timestamp: event.timestamp,
    commentHash: contentHash(String(event.comment || '')),
    parameters: event.params || {}
  })).sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.logId - b.logId);
  const base = {
    requestedTitle,
    queryTitle: logResult?.requestedTitle || null,
    exactRequestedTitlePreserved: logResult?.requestedTitle === requestedTitle,
    queryComplete: logResult?.complete === true,
    eventCount: events.length,
    events,
    canonicalIdentityApplied: false
  };
  return { ...base, evidenceContentHash: contentHash(base) };
}

function pinnedGuideEvidence(record, fetchedGuides, contentHash) {
  const byRevision = new Map(fetchedGuides.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
  return record.observations.map(observation => {
    const fetched = byRevision.get(String(observation.guideRevision));
    const page = fetched?.page;
    const revision = fetched?.revision;
    const content = contentOf(revision);
    const identity = sourceIdentity(page, revision, contentHash);
    const parsed = identity ? parseSkillTrainingGuideDirectLinks({
      sourcePageId: identity.sourcePageId,
      title: identity.resolvedTitle,
      sourceRevision: identity.sourceRevision,
      sourceTimestamp: identity.sourceTimestamp,
      sourceUrl: identity.sourceUrl,
      sourceContentHash: identity.sourceContentHash,
      content
    }) : { occurrences: [], audit: { balancedSourceLinkDelimiters: false } };
    const exactOccurrences = parsed.occurrences.filter(occurrence => mediaWikiTitleKey(occurrence.requestedTitle) === mediaWikiTitleKey(observation.requestedTitle));
    const alignment = {
      fetchedGuidePresent: identity !== null,
      guidePageIdMatches: identity?.sourcePageId === Number(observation.guidePageId),
      guideTitleMatches: identity?.resolvedTitle === observation.guideTitle,
      guideRevisionMatches: identity?.sourceRevision === String(observation.guideRevision),
      guideContentHashMatches: identity?.sourceContentHash === observation.guideContentHash,
      sourceLinkDelimitersBalanced: parsed.audit.balancedSourceLinkDelimiters === true,
      mediaWikiNormalizedRequestedTitleOccurrencePresent: exactOccurrences.length > 0
    };
    const base = {
      guidePageId: Number(observation.guidePageId),
      guideTitle: observation.guideTitle,
      guideRevision: String(observation.guideRevision),
      guideContentHash: observation.guideContentHash,
      parserChannel: observation.parserChannel,
      requestedTitle: observation.requestedTitle,
      pinnedGuideSourceIdentity: identity,
      exactSourceOccurrences: exactOccurrences.map(occurrence => ({
        occurrenceKey: occurrence.occurrenceKey,
        sourceTarget: occurrence.sourceTarget,
        requestedTitle: occurrence.requestedTitle,
        requestedFragment: occurrence.requestedFragment,
        displayText: occurrence.displayText,
        sourceLocator: occurrence.sourceLocator
      })),
      alignment
    };
    return { ...base, evidenceContentHash: contentHash(base) };
  }).sort((a, b) => a.guidePageId - b.guidePageId || a.requestedTitle.localeCompare(b.requestedTitle));
}

export function buildUnresolvedRenderedTargetResolutionEvidence({
  renderedTargets = [], fetchedGuides = [], currentTitleResolutions = [], discoveryResults = [], titleLogResults = [],
  inputSnapshotContentHash = '', policy = {}, contentHash = value => value
} = {}) {
  const eligible = renderedTargets.filter(isUnresolvedRenderedTarget);
  const resolutionByTitle = new Map(currentTitleResolutions.map(row => [row.requestedTitle, row]));
  const discoveryByTitle = new Map(discoveryResults.map(row => [row.requestedTitle, row]));
  const logsByTitle = new Map(titleLogResults.map(row => [row.requestedTitle, row]));
  const records = eligible.map(record => {
    const namespaceMap = new Map(record.requestedTitles.map(title => [title, unique(record.observations.filter(row => row.requestedTitle === title).map(row => Number(row.namespaceId)))]));
    const guideEvidence = pinnedGuideEvidence(record, fetchedGuides, contentHash);
    const currentEvidence = record.requestedTitles.map(title => exactResolutionEvidence(title, namespaceMap.get(title) || record.namespaceIds, resolutionByTitle.get(title), contentHash));
    const discovery = record.requestedTitles.map(title => discoveryEvidence(title, namespaceMap.get(title) || record.namespaceIds, discoveryByTitle.get(title), contentHash));
    const logs = record.requestedTitles.map(title => logEvidence(title, logsByTitle.get(title), contentHash));
    const allResolved = currentEvidence.every(row => row.resolutionState === 'current_revision_pinned_page_evidence');
    const anyIncomplete = currentEvidence.some(row => row.resolutionState === 'incomplete_current_resolution_evidence');
    const blockers = [];
    if (anyIncomplete) blockers.push('one_or_more_exact_current_title_resolution_queries_incomplete');
    if (!allResolved) blockers.push('one_or_more_exact_rendered_titles_currently_missing');
    blockers.push(
      'discovery_candidates_require_separate_source_bound_resolution_decision',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: policy.recordContract,
      resolutionEvidenceKey: `${record.renderedTargetKey}|resolution-evidence`,
      sourceRenderedTargetRecordContentHash: record.contentHash,
      sourceRenderedTargetSnapshotContentHash: inputSnapshotContentHash,
      renderedTargetKey: record.renderedTargetKey,
      requestedTitles: [...record.requestedTitles],
      namespaceIds: [...record.namespaceIds],
      guideObservations: record.observations,
      pinnedGuideEvidence: guideEvidence,
      currentTitleResolutionEvidence: currentEvidence,
      titleLogEvidence: logs,
      discoveryEvidence: discovery,
      resolutionDisposition: { state: 'unreviewed', selectedPageId: null, selectedTitle: null, evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityClassification: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: 'resolution_evidence_captured_review_pending'
    };
  }).sort((a, b) => a.renderedTargetKey.localeCompare(b.renderedTargetKey));
  return { records, audit: auditUnresolvedRenderedTargetResolutionEvidence(records, { renderedTargets, fetchedGuides, currentTitleResolutions, discoveryResults, titleLogResults, inputSnapshotContentHash, policy, contentHash }) };
}

export function auditUnresolvedRenderedTargetResolutionEvidence(records = [], {
  renderedTargets = [], fetchedGuides = [], currentTitleResolutions = [], discoveryResults = [], titleLogResults = [],
  inputSnapshotContentHash = '', policy = {}, contentHash = value => value
} = {}) {
  const compiled = compileUnresolvedRenderedTargetResolutionEvidencePolicy(policy);
  const expected = renderedTargets.filter(isUnresolvedRenderedTarget);
  const expectedKeys = expected.map(row => `${row.renderedTargetKey}|resolution-evidence`);
  const actualKeys = records.map(row => row.resolutionEvidenceKey);
  const inputFailures = expected.filter(row => !inputIntegrity(row, contentHash).complete).map(row => row.renderedTargetKey);
  const expectedObservationCount = expected.reduce((sum, row) => sum + row.guideObservationCount, 0);
  const expectedTitles = expected.flatMap(row => row.requestedTitles);
  const uniqueGuideRevisions = unique(expected.flatMap(row => row.observations.map(observation => String(observation.guideRevision))));
  const fetchedRevisions = fetchedGuides.flatMap(page => (page.revisions || []).map(revision => String(revision.revid)));
  const guideRows = records.flatMap(row => row.pinnedGuideEvidence || []);
  const guideFailures = guideRows.filter(row => !Object.values(row.alignment || {}).every(Boolean)).map(row => `${row.guidePageId}|${row.guideRevision}|${row.requestedTitle}`);
  const currentRows = records.flatMap(row => row.currentTitleResolutionEvidence || []);
  const discoveryRows = records.flatMap(row => row.discoveryEvidence || []);
  const logRows = records.flatMap(row => row.titleLogEvidence || []);
  const invalidLogEvents = logRows.flatMap(row => row.events || []).filter(event => !Number.isInteger(event.logId) || event.logId <= 0 ||
    !Number.isInteger(event.namespaceId) || typeof event.title !== 'string' || !event.title || typeof event.type !== 'string' || !event.type ||
    typeof event.action !== 'string' || !event.action || !validTimestamp(event.timestamp) || !validHash(event.commentHash) ||
    !event.parameters || typeof event.parameters !== 'object' || Array.isArray(event.parameters));
  const unpinnedCandidates = discoveryRows.flatMap(row => row.candidates || []).filter(candidate => candidate.sourcePageIdentity === null);
  const promotions = records.filter(row => row.resolutionDisposition?.state !== 'unreviewed' || row.resolutionDisposition?.selectedPageId !== null ||
    row.resolutionDisposition?.selectedTitle !== null || row.resolutionDisposition?.evidenceKeys?.length || row.canonicalGameEntityIdentity !== null ||
    row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null || row.optimizerEligible !== false).map(row => row.renderedTargetKey);
  const accountStateFindings = findUnresolvedRenderedTargetAccountState([
    ...renderedTargets, ...fetchedGuides, ...currentTitleResolutions, ...discoveryResults, ...titleLogResults, ...records
  ]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('resolution_evidence_policy_invalid');
  if (!validHash(inputSnapshotContentHash)) structuralBlockers.push('input_snapshot_content_hash_missing_or_invalid');
  if (duplicates(expectedKeys).length || duplicates(actualKeys).length) structuralBlockers.push('duplicate_input_or_output_resolution_evidence_keys');
  if (expectedKeys.some(key => !actualKeys.includes(key))) structuralBlockers.push('one_or_more_unresolved_targets_missing_resolution_evidence');
  if (actualKeys.some(key => !expectedKeys.includes(key))) structuralBlockers.push('unexpected_resolution_evidence_record');
  if (inputFailures.length) structuralBlockers.push('one_or_more_input_rendered_targets_failed_integrity_validation');
  if (duplicates(fetchedRevisions).length || uniqueGuideRevisions.some(revision => !fetchedRevisions.includes(revision))) structuralBlockers.push('exact_pinned_guide_revision_fetch_set_incomplete');
  if (guideRows.length !== expectedObservationCount || guideFailures.length) structuralBlockers.push('one_or_more_rendered_observations_lack_mediawiki_normalized_pinned_guide_occurrence_evidence');
  if (currentRows.length !== expectedTitles.length || currentRows.some(row => !row.queryComplete || !row.exactRequestedTitlePreserved)) structuralBlockers.push('exact_current_title_resolution_evidence_incomplete');
  if (discoveryRows.length !== expectedTitles.length || discoveryRows.some(row => !row.queryComplete || !row.queryDerivedOnlyFromRequestedTitle) || unpinnedCandidates.length) structuralBlockers.push('source_derived_discovery_evidence_incomplete_or_unpinned');
  if (logRows.length !== expectedTitles.length || logRows.some(row => !row.queryComplete || !row.exactRequestedTitlePreserved) || invalidLogEvents.length) structuralBlockers.push('exact_title_log_history_incomplete');
  if (promotions.length) structuralBlockers.push('unsupported_resolution_identity_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_resolution_evidence');
  const missingCurrent = currentRows.filter(row => row.resolutionState === 'current_missing_wiki_page_evidence');
  const resolvedCurrent = currentRows.filter(row => row.resolutionState === 'current_revision_pinned_page_evidence');
  const resolutionEvidenceCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputRenderedTargetCount: renderedTargets.length,
      expectedUnresolvedRenderedTargetCount: expected.length,
      evidenceRecordCount: records.length,
      expectedGuideObservationCount: expectedObservationCount,
      requestedTitleCount: expectedTitles.length,
      duplicateInputKeys: duplicates(expectedKeys),
      duplicateOutputKeys: duplicates(actualKeys),
      missingOutputKeys: expectedKeys.filter(key => !actualKeys.includes(key)),
      unexpectedOutputKeys: actualKeys.filter(key => !expectedKeys.includes(key)),
      inputIntegrityFailureKeys: inputFailures
    },
    sourceGuideCoverage: {
      requiredUniqueGuideRevisionCount: uniqueGuideRevisions.length,
      fetchedUniqueGuideRevisionCount: unique(fetchedRevisions).length,
      pinnedGuideEvidenceCount: guideRows.length,
      exactSourceOccurrenceCount: guideRows.reduce((sum, row) => sum + (row.exactSourceOccurrences?.length || 0), 0),
      alignmentFailureKeys: guideFailures
    },
    currentResolutionCoverage: {
      exactTitleQueryCount: currentRows.length,
      revisionPinnedCurrentPageCount: resolvedCurrent.length,
      currentMissingPageCount: missingCurrent.length,
      incompleteQueryCount: currentRows.filter(row => !row.queryComplete).length,
      canonicalIdentityBindingCount: 0
    },
    discoveryCoverage: {
      sourceDerivedQueryCount: discoveryRows.length,
      completeQueryCount: discoveryRows.filter(row => row.queryComplete).length,
      revisionPinnedCandidateCount: discoveryRows.reduce((sum, row) => sum + row.candidateCount, 0),
      unpinnedCandidateCount: unpinnedCandidates.length,
      selectedCandidateCount: discoveryRows.filter(row => row.selectedCandidatePageId !== null).length
    },
    logHistoryCoverage: {
      exactTitleQueryCount: logRows.length,
      completeQueryCount: logRows.filter(row => row.queryComplete).length,
      retainedEventCount: logRows.reduce((sum, row) => sum + row.eventCount, 0),
      invalidEventCount: invalidLogEvents.length
    },
    semanticPromotionCoverage: {
      resolutionDispositionCount: records.filter(row => row.resolutionDisposition?.state !== 'unreviewed').length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
      unsupportedPromotionTargetKeys: promotions
    },
    accountStateFindings,
    resolutionEvidenceCoverageComplete,
    canonicalIdentityComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(missingCurrent.length ? ['one_or_more_exact_rendered_titles_currently_missing'] : []),
      'source_derived_candidates_require_explicit_source_bound_resolution_review',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: resolutionEvidenceCoverageComplete
  };
}
