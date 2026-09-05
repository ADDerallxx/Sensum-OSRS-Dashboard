import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';
import {
  compileRepeatabilityEvidencePolicy,
  scanRepeatabilitySource
} from './activity-reference-collection-member-repeatability-evidence-lib.mjs';
import { parseSkillTrainingGuideDirectLinks } from './skill-training-guide-direct-link-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceRevision = resolution => resolution?.page?.revisions?.[0];
const sourceContent = resolution => sourceRevision(resolution)?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceRepeatabilityGapDispositionContentHash',
  'independentRepeatabilitySourceEvidence', 'independentRepeatabilityCandidateObservations'
]);

function preservedInput(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !stageFields.has(key)));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileIndependentRepeatabilitySourceEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'onePacketPerMatchingIndependentDiscoveryRoute',
    'searchPhraseMustComeFromTheRevisionBoundCanonicalActivityLabel',
    'backlinkAnchorMustComeFromTheRevisionBoundLinkedSubjectTitle',
    'searchAndBacklinkEnumerationMustBeCompleteOrExplicitlyBlocked',
    'onlyMainNamespaceCandidatesAreAllowed',
    'allPreviouslyScannedPagesRemainExplicitExclusions',
    'candidatePagesMustResolveThroughTheOfficialWikiApi',
    'candidateRevisionTimestampUrlAndContentHashMustBePinned',
    'redirectsMustDeduplicateByStablePageIdWithoutLosingContexts',
    'completeCandidateRevisionUsesTheExistingRepeatabilitySignalPolicy',
    'candidateSourceAuthoredLinksAreRetainedForLaterExactScopeReview',
    'searchRankSnippetBacklinkStatusTitleAndLexicalSimilarityAreDiscoveryOnly',
    'candidateSignalsDoNotEstablishCanonicalActivityScope',
    'recurrenceSessionAndNoMatchCannotCreateARepeatabilityVerdict',
    'upstreamDispositionsAndReviewsRemainUnchanged',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'namesTitlesPageIdsLabelsAliasesAndCollectionClassesCannotSelectAVerdict',
    'missingContradictoryTruncatedOrConditionMismatchedEvidenceRemainsExplicit',
    'currentAccountStateIsForbidden'
  ];
  const requiredChannels = ['exact_source_phrase_search', 'main_namespace_backlinks_to_stable_linked_subject'];
  const channels = policy.discovery?.channels || [];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.discovery?.namespace !== 0) invalidRules.push('main_namespace_discovery_not_configured');
  if (policy.discovery?.sourceSearchOperator !== 'insource') invalidRules.push('exact_source_search_operator_not_configured');
  if (!Number.isInteger(policy.discovery?.maximumSearchResultsPerActivity) || policy.discovery.maximumSearchResultsPerActivity < 1) invalidRules.push('search_safety_limit_invalid');
  if (!Number.isInteger(policy.discovery?.maximumBacklinkResultsPerActivity) || policy.discovery.maximumBacklinkResultsPerActivity < 1) invalidRules.push('backlink_safety_limit_invalid');
  if (policy.discovery?.requireSearchContinuationExhausted !== true) invalidRules.push('search_continuation_exhaustion_not_required');
  if (policy.discovery?.requireBacklinkContinuationExhausted !== true) invalidRules.push('backlink_continuation_exhaustion_not_required');
  if (policy.discovery?.excludeAllPreviouslyScannedPages !== true) invalidRules.push('prior_source_exclusion_not_configured');
  if (policy.discovery?.deduplicateByResolvedMediaWikiPageId !== true) invalidRules.push('stable_page_deduplication_not_configured');
  if (policy.discovery?.scanCompleteCurrentCandidateRevision !== true) invalidRules.push('complete_revision_scan_not_configured');
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidDiscoveryChannels: channels.filter(channel => !requiredChannels.includes(channel)),
    missingDiscoveryChannels: requiredChannels.filter(channel => !channels.includes(channel))
  };
}

function routeMatches(record, policy) {
  return record.contract === policy.inputContract
    && record.repeatabilityGapNextEvidenceWork?.routeKey === policy.inputRoute
    && record.repeatabilityGapNextEvidenceWork?.state === 'required'
    && record.repeatabilityDisposition?.classification === null
    && record.corroboratingRepeatabilityDisposition?.classification === null;
}

export function selectIndependentRepeatabilitySourceRoutes(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

export function exactSourceSearchQuery(record, policy = {}) {
  const label = String(record.canonicalActivityIdentity?.canonicalLabel || '').trim();
  const escaped = label.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return label ? `${policy.discovery?.sourceSearchOperator || 'insource'}:"${escaped}"` : null;
}

function priorScannedPageIds(record = {}) {
  return new Set([
    Number(record.sourcePageId || 0),
    Number(record.canonicalActivityIdentity?.stableIdentityAnchor?.linkedSubjectPageId || 0),
    Number(record.canonicalActivityIdentityEvidence?.collectionDefinition?.collectionSource?.pageId || 0),
    ...(record.corroboratingRepeatabilityEvidence?.candidatePages || []).map(page => Number(page.sourcePageId || 0))
  ].filter(Boolean));
}

function addRequest(map, result, context) {
  const requestedTitle = String(result?.title || '').trim();
  if (!requestedTitle) return;
  const key = requestedTitle.toLocaleLowerCase('en');
  const current = map.get(key) || { requestedTitle, observedPageIds: [], discoveryContexts: [] };
  if (result.pageid) current.observedPageIds.push(Number(result.pageid));
  current.discoveryContexts.push(context);
  current.observedPageIds = sorted(unique(current.observedPageIds)).map(Number);
  current.discoveryContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  map.set(key, current);
}

export function discoverIndependentRepeatabilityCandidateRequests(record, response = {}, policy = {}) {
  const requests = new Map();
  const search = response.exactSourceSearch || {};
  for (const [index, result] of (search.results || []).entries()) addRequest(requests, result, {
    channel: 'exact_source_phrase_search',
    query: search.query || null,
    rank: result.rank ?? index + 1,
    observedPageId: result.pageid || null,
    resultTimestamp: result.timestamp || null,
    resultSize: result.size ?? null,
    resultWordCount: result.wordcount ?? null,
    resultSnippet: result.snippet ?? null,
    semanticUse: 'discovery_only_not_activity_scope_or_repeatability_evidence'
  });
  const backlinks = response.backlinks || {};
  for (const [index, result] of (backlinks.results || []).entries()) addRequest(requests, result, {
    channel: 'main_namespace_backlinks_to_stable_linked_subject',
    anchorTitle: backlinks.anchorTitle || null,
    ordinal: result.ordinal ?? index + 1,
    observedPageId: result.pageid || null,
    semanticUse: 'discovery_only_not_activity_scope_or_repeatability_evidence'
  });
  return [...requests.values()].sort((a, b) => a.requestedTitle.localeCompare(b.requestedTitle));
}

function responseFor(record, responses = []) {
  return responses.find(response => response.memberCandidateKey === record.memberCandidateKey) || null;
}

function responseDeficiencies(record, response, policy) {
  const deficiencies = [];
  const search = response?.exactSourceSearch || {};
  const backlinks = response?.backlinks || {};
  const expectedQuery = exactSourceSearchQuery(record, policy);
  const expectedAnchor = String(record.resolvedTitle || '').trim() || null;
  if (!response) deficiencies.push('independent_discovery_response_missing');
  if (!expectedQuery) deficiencies.push('canonical_activity_search_label_missing');
  if (!expectedAnchor) deficiencies.push('linked_subject_backlink_anchor_title_missing');
  if (search.query !== expectedQuery || search.namespace !== policy.discovery?.namespace) deficiencies.push('exact_source_search_boundary_mismatch');
  if (backlinks.anchorTitle !== expectedAnchor || backlinks.namespace !== policy.discovery?.namespace) deficiencies.push('backlink_boundary_mismatch');
  if (search.continuationExhausted !== true || search.truncated === true) deficiencies.push('exact_source_search_not_fully_enumerated');
  if (backlinks.continuationExhausted !== true || backlinks.truncated === true) deficiencies.push('backlinks_not_fully_enumerated');
  if (Number(search.returnedCount) !== (search.results || []).length) deficiencies.push('exact_source_search_returned_count_mismatch');
  if (Number(search.totalHits) !== (search.results || []).length) deficiencies.push('exact_source_search_total_hits_not_fully_retained');
  if (Number(backlinks.returnedCount) !== (backlinks.results || []).length) deficiencies.push('backlink_returned_count_mismatch');
  if ((search.results || []).some(result => result.ns !== 0 || !result.pageid || !result.title)) deficiencies.push('invalid_or_non_main_namespace_search_result');
  if ((backlinks.results || []).some(result => result.ns !== 0 || !result.pageid || !result.title)) deficiencies.push('invalid_or_non_main_namespace_backlink_result');
  return unique(deficiencies);
}

function groupCandidates(record, requests, resolutions, repeatabilityPolicy, contentHash) {
  const resolutionByTitle = new Map(resolutions.map(resolution => [resolution.requestedTitle, resolution]));
  const excludedPageIds = priorScannedPageIds(record);
  const assessments = [];
  const groups = new Map();
  for (const request of requests) {
    const resolution = resolutionByTitle.get(request.requestedTitle) || null;
    const page = resolution?.page || null;
    const revision = sourceRevision(resolution);
    const content = sourceContent(resolution);
    const resolvedPageId = Number(page?.pageid || 0);
    const observedExcluded = request.observedPageIds.some(pageId => excludedPageIds.has(Number(pageId)));
    const resolvedExcluded = excludedPageIds.has(resolvedPageId);
    const state = !page || page.missing ? 'missing_official_wiki_page'
      : observedExcluded || resolvedExcluded ? 'excluded_previously_scanned_source'
        : page.ns !== 0 ? 'excluded_non_main_namespace'
          : !revision || typeof content !== 'string' ? 'missing_current_revision_content'
            : 'eligible_revision_pinned_candidate';
    assessments.push({
      requestedTitle: request.requestedTitle,
      observedPageIds: request.observedPageIds,
      normalizedTitle: resolution?.normalizedTitle || request.requestedTitle,
      resolvedTitle: resolution?.resolvedTitle || null,
      redirected: resolution?.redirected === true,
      resolvedPageId: resolvedPageId || null,
      namespace: page?.ns ?? null,
      state,
      discoveryContexts: request.discoveryContexts
    });
    if (state !== 'eligible_revision_pinned_candidate') continue;
    const key = String(resolvedPageId);
    const group = groups.get(key) || { resolution, requestedTitles: [], observedPageIds: [], discoveryContexts: [] };
    group.requestedTitles.push(request.requestedTitle);
    group.observedPageIds.push(...request.observedPageIds);
    group.discoveryContexts.push(...request.discoveryContexts.map(context => ({ requestedTitle: request.requestedTitle, ...context })));
    groups.set(key, group);
  }
  const compiledSignals = compileRepeatabilityEvidencePolicy(repeatabilityPolicy);
  const pages = [...groups.values()].map(group => {
    const page = group.resolution.page;
    const revision = sourceRevision(group.resolution);
    const content = sourceContent(group.resolution);
    const sourcePageId = Number(page.pageid);
    const revisionId = String(revision.revid || '');
    const computedHash = contentHash(content);
    const directLinks = parseSkillTrainingGuideDirectLinks({
      content,
      sourcePageId,
      title: page.title,
      sourceRevision: revisionId,
      sourceTimestamp: revision.timestamp || null,
      sourceUrl: wikiUrl(page.title),
      sourceContentHash: computedHash,
      skillKeys: [],
      channels: ['independent_repeatability_source_discovery']
    });
    return {
      sourcePageId,
      resolvedTitle: page.title,
      requestedTitles: sorted(unique(group.requestedTitles)),
      observedPageIds: sorted(unique(group.observedPageIds)).map(Number),
      sourceRevision: revisionId,
      sourceTimestamp: revision.timestamp || null,
      sourceUrl: wikiUrl(page.title),
      sourceContentHash: computedHash,
      sourceContentBytes: Buffer.byteLength(content, 'utf8'),
      completeRevisionContentScanned: true,
      sourceAuthoredLinks: directLinks.occurrences,
      sourceLinkDelimiterAudit: directLinks.audit,
      discoveryContexts: group.discoveryContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      sourceLocatedSignals: scanRepeatabilitySource({
        text: content,
        sourceScope: `independent_discovery_candidate_pageid_${sourcePageId}`,
        sourcePageId,
        sourceRevision: revisionId,
        sourceContentHash: computedHash,
        scannedTextHash: computedHash,
        memberCandidateKey: record.memberCandidateKey,
        definitions: compiledSignals.definitions
      }),
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      reviewState: 'independent_source_candidate_only_not_activity_scope_or_repeatability_verdict'
    };
  }).sort((a, b) => a.sourcePageId - b.sourcePageId || a.resolvedTitle.localeCompare(b.resolvedTitle));
  return { assessments, pages, compiledSignals, excludedPageIds: sorted([...excludedPageIds]).map(Number) };
}

function packetFor(record, responses, resolutions, policy, repeatabilityPolicy, contentHash) {
  const response = responseFor(record, responses);
  const requests = discoverIndependentRepeatabilityCandidateRequests(record, response || {}, policy);
  const grouped = groupCandidates(record, requests, resolutions, repeatabilityPolicy, contentHash);
  const compiled = compileIndependentRepeatabilitySourceEvidencePolicy(policy);
  const deficiencies = responseDeficiencies(record, response, policy);
  if (!record.contentHash) deficiencies.push('repeatability_gap_disposition_content_hash_missing');
  if (!routeMatches(record, policy)) deficiencies.push('input_does_not_match_independent_discovery_route');
  if (!requests.length) deficiencies.push('independent_discovery_returned_no_candidate_requests');
  if (grouped.assessments.some(item => ['missing_official_wiki_page', 'missing_current_revision_content'].includes(item.state))) deficiencies.push('one_or_more_discovered_pages_lack_current_revision_evidence');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidDiscoveryChannels.length || compiled.missingDiscoveryChannels.length) deficiencies.push('independent_repeatability_source_evidence_policy_invalid_or_incomplete');
  if (grouped.compiledSignals.invalidRules.length || grouped.compiledSignals.forbiddenPolicyPaths.length || grouped.compiledSignals.duplicateDefinitionKeys.length || grouped.compiledSignals.invalidDefinitionKeys.length || grouped.compiledSignals.requiredDefinitionKindsMissing.length) deficiencies.push('repeatability_signal_policy_invalid_or_incomplete');
  const signals = grouped.pages.flatMap(page => page.sourceLocatedSignals || []);
  const count = kind => signals.filter(signal => signal.signalKind === kind).length;
  const evidence = {
    evidenceState: deficiencies.length
      ? 'incomplete_revision_pinned_independent_repeatability_source_evidence_packet'
      : 'complete_revision_pinned_independent_repeatability_source_evidence_packet',
    discoveryBoundary: {
      exactSourceSearch: response?.exactSourceSearch || null,
      backlinks: response?.backlinks || null,
      candidateRequests: requests,
      candidateRequestAssessments: grouped.assessments,
      previouslyScannedPageIdsExcluded: grouped.excludedPageIds
    },
    candidatePages: grouped.pages
  };
  const observations = {
    searchResultCount: response?.exactSourceSearch?.results?.length || 0,
    backlinkResultCount: response?.backlinks?.results?.length || 0,
    candidateRequestCount: requests.length,
    discoveryContextCount: requests.reduce((sum, request) => sum + request.discoveryContexts.length, 0),
    candidatePageCount: grouped.pages.length,
    candidateSourceBytesScanned: grouped.pages.reduce((sum, page) => sum + page.sourceContentBytes, 0),
    sourceLocatedSignalCount: signals.length,
    explicitPositiveDeclarationCandidateCount: count('explicit_positive_repeatability_declaration_candidate'),
    explicitNegativeDeclarationCandidateCount: count('explicit_negative_repeatability_declaration_candidate'),
    recurrenceStructureCandidateCount: count('recurrence_structure_candidate'),
    sessionBoundaryCandidateCount: count('session_boundary_candidate'),
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    deficiencies: unique(deficiencies)
  };
  return {
    contract: policy.recordContract || 'sensum.activity-reference-collection-member-independent-repeatability-source-evidence.v1',
    ...preservedInput(record),
    sourceRepeatabilityGapDispositionContentHash: record.contentHash,
    independentRepeatabilitySourceEvidence: evidence,
    independentRepeatabilityCandidateObservations: observations,
    blockers: unique([
      ...(record.blockers || []),
      ...observations.deficiencies,
      'independent_repeatability_source_evidence_requires_semantic_disposition',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: observations.deficiencies.length
      ? 'blocked_incomplete_independent_repeatability_source_evidence_packet'
      : 'independent_repeatability_source_evidence_ready_for_semantic_disposition'
  };
}

export function buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence({ gapDispositionRecords = [], discoveryResponses = [], fetchedResolutions = [], policy = {}, repeatabilityPolicy = {}, contentHash = value => value }) {
  const routes = selectIndependentRepeatabilitySourceRoutes(gapDispositionRecords, policy);
  const records = routes.map(record => packetFor(record, discoveryResponses, fetchedResolutions, policy, repeatabilityPolicy, contentHash));
  return {
    records,
    audit: auditActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence(records, { gapDispositionRecords, discoveryResponses, fetchedResolutions, policy, repeatabilityPolicy, contentHash })
  };
}

export function auditActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence(records = [], { gapDispositionRecords = [], discoveryResponses = [], fetchedResolutions = [], policy = {}, repeatabilityPolicy = {}, contentHash = value => value } = {}) {
  const routes = selectIndependentRepeatabilitySourceRoutes(gapDispositionRecords, policy);
  const expected = routes.map(record => packetFor(record, discoveryResponses, fetchedResolutions, policy, repeatabilityPolicy, contentHash));
  const expectedKeys = routes.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(routes.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || record.sourceRepeatabilityGapDispositionContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const evidenceMismatches = records.filter(record => {
    const target = expectedByKey.get(record.memberCandidateKey);
    return !target
      || JSON.stringify(record.independentRepeatabilitySourceEvidence) !== JSON.stringify(target.independentRepeatabilitySourceEvidence)
      || JSON.stringify(record.independentRepeatabilityCandidateObservations) !== JSON.stringify(target.independentRepeatabilityCandidateObservations);
  }).map(record => record.memberCandidateKey);
  const compiled = compileIndependentRepeatabilitySourceEvidencePolicy(policy);
  const compiledSignals = compileRepeatabilityEvidencePolicy(repeatabilityPolicy);
  const structurallyInvalidInputs = routes.filter(record =>
    !record.contentHash || record.accountIndependent !== true
    || record.repeatabilityDisposition?.classification !== null
    || record.corroboratingRepeatabilityDisposition?.classification !== null
    || record.repeatabilityReview?.classification !== null
    || record.corroboratingRepeatabilityReview?.classification !== null
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const incompletePackets = records.filter(record => record.independentRepeatabilitySourceEvidence?.evidenceState !== 'complete_revision_pinned_independent_repeatability_source_evidence_packet').map(record => record.memberCandidateKey);
  const upstreamMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(input.repeatabilityDisposition)
      || JSON.stringify(record.repeatabilityReview) !== JSON.stringify(input.repeatabilityReview)
      || JSON.stringify(record.corroboratingRepeatabilityDisposition) !== JSON.stringify(input.corroboratingRepeatabilityDisposition)
      || JSON.stringify(record.corroboratingRepeatabilityReview) !== JSON.stringify(input.corroboratingRepeatabilityReview);
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.independentRepeatabilityCandidateObservations?.canonicalActivityScopeVerdict !== null
      || record.independentRepeatabilityCandidateObservations?.repeatabilityVerdict !== null
      || (record.independentRepeatabilitySourceEvidence?.candidatePages || []).some(page => page.canonicalActivityScopeVerdict !== null || page.repeatabilityVerdict !== null)
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const pages = records.flatMap(record => record.independentRepeatabilitySourceEvidence?.candidatePages || []);
  const assessments = records.flatMap(record => record.independentRepeatabilitySourceEvidence?.discoveryBoundary?.candidateRequestAssessments || []);
  const contexts = records.flatMap(record => record.independentRepeatabilitySourceEvidence?.discoveryBoundary?.candidateRequests || []).flatMap(request => request.discoveryContexts || []);
  const signals = pages.flatMap(page => page.sourceLocatedSignals || []);
  const responses = records.map(record => record.independentRepeatabilitySourceEvidence?.discoveryBoundary).filter(Boolean);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_matching_independent_repeatability_source_discovery_routes');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_independent_evidence_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (evidenceMismatches.length) structuralBlockers.push('one_or_more_independent_evidence_packets_do_not_match_discovery_and_source_inputs');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_independent_discovery_inputs_are_structurally_invalid');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidDiscoveryChannels.length || compiled.missingDiscoveryChannels.length) structuralBlockers.push('independent_repeatability_source_evidence_policy_invalid_or_incomplete');
  if (compiledSignals.invalidRules.length || compiledSignals.forbiddenPolicyPaths.length || compiledSignals.duplicateDefinitionKeys.length || compiledSignals.invalidDefinitionKeys.length || compiledSignals.requiredDefinitionKindsMissing.length) structuralBlockers.push('repeatability_signal_policy_invalid_or_incomplete');
  if (incompletePackets.length) structuralBlockers.push('one_or_more_independent_repeatability_source_evidence_packets_incomplete');
  if (upstreamMutations.length) structuralBlockers.push('evidence_collection_changed_upstream_repeatability_disposition_or_review');
  if (unsupportedPromotions.length) structuralBlockers.push('candidate_evidence_created_unsupported_scope_repeatability_or_downstream_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_independent_repeatability_source_evidence');
  const evidencePacketAttemptCoverageComplete = expectedKeys.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length;
  const independentSourceEvidenceCoverageComplete = evidencePacketAttemptCoverageComplete && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-independent-repeatability-source-evidence-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedRouteCount: expectedKeys.length,
      evidencePacketCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: structurallyInvalidInputs,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      invalidDiscoveryChannels: compiled.invalidDiscoveryChannels,
      missingDiscoveryChannels: compiled.missingDiscoveryChannels,
      repeatabilitySignalPolicyInvalidRules: compiledSignals.invalidRules,
      repeatabilitySignalPolicyForbiddenPaths: compiledSignals.forbiddenPolicyPaths,
      repeatabilitySignalPolicyDuplicateDefinitionKeys: compiledSignals.duplicateDefinitionKeys,
      repeatabilitySignalPolicyInvalidDefinitionKeys: compiledSignals.invalidDefinitionKeys,
      repeatabilitySignalPolicyRequiredDefinitionKindsMissing: compiledSignals.requiredDefinitionKindsMissing
    },
    discoveryCoverage: {
      exactSourceSearchBoundaryCount: responses.filter(boundary => boundary.exactSourceSearch).length,
      fullyEnumeratedExactSourceSearchCount: responses.filter(boundary => boundary.exactSourceSearch?.continuationExhausted === true && boundary.exactSourceSearch?.truncated !== true).length,
      backlinkBoundaryCount: responses.filter(boundary => boundary.backlinks).length,
      fullyEnumeratedBacklinkCount: responses.filter(boundary => boundary.backlinks?.continuationExhausted === true && boundary.backlinks?.truncated !== true).length,
      searchResultCount: responses.reduce((sum, boundary) => sum + (boundary.exactSourceSearch?.results?.length || 0), 0),
      backlinkResultCount: responses.reduce((sum, boundary) => sum + (boundary.backlinks?.results?.length || 0), 0),
      candidateRequestCount: assessments.length,
      discoveryContextCount: contexts.length,
      eligibleRequestCount: assessments.filter(item => item.state === 'eligible_revision_pinned_candidate').length,
      excludedPreviouslyScannedRequestCount: assessments.filter(item => item.state === 'excluded_previously_scanned_source').length,
      missingCandidateRequestCount: assessments.filter(item => ['missing_official_wiki_page', 'missing_current_revision_content'].includes(item.state)).length,
      uniqueResolvedCandidatePageCount: pages.length,
      duplicateResolvedPageContextsPreserved: contexts.length > pages.length,
      evidenceMismatchMemberCandidateKeys: evidenceMismatches
    },
    sourceAlignmentCoverage: {
      revisionPinnedCandidatePageCount: pages.filter(page => page.sourcePageId && page.sourceRevision && page.sourceTimestamp && page.sourceUrl && page.sourceContentHash && page.completeRevisionContentScanned).length,
      candidateSourceBytesScanned: pages.reduce((sum, page) => sum + Number(page.sourceContentBytes || 0), 0),
      sourceAuthoredLinkOccurrenceCount: pages.reduce((sum, page) => sum + (page.sourceAuthoredLinks?.length || 0), 0),
      unbalancedSourceLinkPageCount: pages.filter(page => page.sourceLinkDelimiterAudit?.balancedSourceLinkDelimiters !== true).length,
      incompletePacketMemberCandidateKeys: incompletePackets
    },
    repeatabilitySignalCoverage: {
      sourceLocatedSignalCount: signals.length,
      explicitPositiveDeclarationCandidateCount: signals.filter(signal => signal.signalKind === 'explicit_positive_repeatability_declaration_candidate').length,
      explicitNegativeDeclarationCandidateCount: signals.filter(signal => signal.signalKind === 'explicit_negative_repeatability_declaration_candidate').length,
      recurrenceStructureCandidateCount: signals.filter(signal => signal.signalKind === 'recurrence_structure_candidate').length,
      sessionBoundaryCandidateCount: signals.filter(signal => signal.signalKind === 'session_boundary_candidate').length,
      canonicalActivityScopeVerdictCount: 0,
      repeatabilityVerdictCount: 0
    },
    semanticPromotionCoverage: {
      upstreamMutationMemberCandidateKeys: upstreamMutations,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    evidencePacketAttemptCoverageComplete,
    independentSourceEvidenceCoverageComplete,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'independent_repeatability_source_evidence_requires_semantic_disposition',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: independentSourceEvidenceCoverageComplete
  };
}
