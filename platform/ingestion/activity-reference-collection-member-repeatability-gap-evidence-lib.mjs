import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';
import {
  compileRepeatabilityEvidencePolicy,
  scanRepeatabilitySource
} from './activity-reference-collection-member-repeatability-evidence-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = resolution => resolution?.page?.revisions?.[0]?.slots?.main?.content;
const sourceRevision = resolution => resolution?.page?.revisions?.[0];
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceRepeatabilityEvidenceWorkRoutingContentHash',
  'corroboratingRepeatabilityEvidence', 'corroboratingRepeatabilityCandidateObservations'
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
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileRepeatabilityGapEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'onePacketPerMatchingBlockedRoute',
    'candidateSourcesMustComeFromExactSourceAuthoredLinks',
    'sourceSignalLinkMustShareTheExactSourceLineWithAStructuralSignal',
    'collectionLinkMustComeFromTheExactRetainedCollectionRow',
    'onlyMainNamespaceCandidatePagesAreAllowed',
    'candidatePagesMustResolveThroughTheOfficialWikiApi',
    'candidatePageRevisionTimestampUrlAndContentHashMustBePinned',
    'duplicateRedirectsMustCollapseByStableMediaWikiPageIdWithoutLosingContexts',
    'previouslyScannedLinkedAndCollectionPagesRemainExplicitExclusions',
    'completeCandidateRevisionIsScannedWithTheExistingRepeatabilitySignalPolicy',
    'commentsAndProtectedRegionsCannotCreateSignals',
    'candidateLinksAndLexicalSignalsAreReviewEvidenceOnly',
    'recurrenceAndSessionSignalsCannotBecomeRepeatabilityProof',
    'absenceOfSignalsCannotBecomeNonRepeatabilityProof',
    'repeatabilityDispositionAndReviewRemainUnchanged',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'namesTitlesPageIdsLabelsAliasesAndCollectionClassesCannotSelectARouteOrVerdict',
    'missingContradictoryOrConditionMismatchedEvidenceRemainsExplicit',
    'currentAccountStateIsForbidden'
  ];
  const requiredChannels = [
    'source_signal_line_main_namespace_link',
    'exact_collection_row_main_namespace_link'
  ];
  const allowedKinds = new Set(['recurrence_structure_candidate', 'session_boundary_candidate']);
  const configuredKinds = policy.discovery?.allowedStructuralSignalKinds || [];
  const configuredChannels = policy.discovery?.channels || [];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.discovery?.namespace !== 0) invalidRules.push('main_namespace_discovery_not_configured');
  if (policy.discovery?.excludeAlreadyScannedLinkedAndCollectionPages !== true) invalidRules.push('previous_source_exclusion_not_configured');
  if (policy.discovery?.deduplicateByResolvedMediaWikiPageId !== true) invalidRules.push('stable_page_deduplication_not_configured');
  if (policy.discovery?.scanCompleteCurrentCandidateRevision !== true) invalidRules.push('complete_candidate_revision_scan_not_configured');
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidStructuralSignalKinds: configuredKinds.filter(kind => !allowedKinds.has(kind)),
    missingStructuralSignalKinds: [...allowedKinds].filter(kind => !configuredKinds.includes(kind)),
    invalidDiscoveryChannels: configuredChannels.filter(channel => !requiredChannels.includes(channel)),
    missingDiscoveryChannels: requiredChannels.filter(channel => !configuredChannels.includes(channel))
  };
}

function routeMatchesPolicy(record, policy) {
  return record.contract === policy.inputContract
    && record.routingDecision?.routeKey === policy.inputRoute?.routeKey
    && record.routingDecision?.routeState === policy.inputRoute?.routeState
    && record.repeatabilityDisposition?.state === policy.inputRoute?.repeatabilityDispositionState;
}

export function selectRepeatabilityGapRoutes(routingRecords = [], policy = {}) {
  return routingRecords.filter(record => routeMatchesPolicy(record, policy));
}

const lineOf = locator => Number(locator?.line ?? locator?.lineStart ?? 0);
const locatorContainsLine = (locator, line) => Number(locator?.lineStart || 0) <= line && line <= Number(locator?.lineEnd || 0);

function addDiscoveryContext(map, requestedTitle, context) {
  const title = String(requestedTitle || '').trim();
  if (!title) return;
  const key = title.toLocaleLowerCase('en');
  const current = map.get(key) || { requestedTitle: title, discoveryContexts: [] };
  current.discoveryContexts.push(context);
  current.discoveryContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  map.set(key, current);
}

export function discoverRepeatabilityGapCandidateRequests(route, policy = {}) {
  const requests = new Map();
  const allowedKinds = new Set(policy.discovery?.allowedStructuralSignalKinds || []);
  const structuralSignals = (route.repeatabilityEvidence?.sourceLocatedSignals || []).filter(signal =>
    signal.sourceScope === 'complete_linked_source_revision' && allowedKinds.has(signal.signalKind)
  );
  for (const link of route.sourcePageEvidence?.sourceAuthoredLinks || []) {
    if (link.namespaceClass !== 'main') continue;
    const line = lineOf(link.sourceLocator);
    for (const signal of structuralSignals) {
      if (!locatorContainsLine(signal.sourceLocator, line)) continue;
      addDiscoveryContext(requests, link.requestedTitle, {
        channel: 'source_signal_line_main_namespace_link',
        structuralSignalEvidenceKey: signal.evidenceKey,
        structuralSignalKind: signal.signalKind,
        sourceLinkOccurrenceKey: link.occurrenceKey || null,
        sourceLinkLocator: link.sourceLocator,
        requestedFragment: link.requestedFragment || null,
        displayText: link.displayText || null
      });
    }
  }
  const collection = route.canonicalActivityIdentityEvidence?.collectionDefinition || {};
  const rowLocator = collection.rowEvidence?.sourceLocator || null;
  for (const link of collection.directRowWikilinkEvidence || []) {
    const linkLine = lineOf(link.sourceLocator);
    if (link.namespaceClass !== 'main' || !rowLocator || !locatorContainsLine(rowLocator, linkLine)) continue;
    addDiscoveryContext(requests, link.requestedTitle, {
      channel: 'exact_collection_row_main_namespace_link',
      collectionPageId: collection.collectionSource?.pageId || null,
      collectionRevision: String(collection.collectionSource?.revision || ''),
      sourceRowOrdinal: collection.rowEvidence?.sourceRowOrdinal ?? null,
      cellLogicalHeader: link.cellLogicalHeader || null,
      cellIndex: link.cellIndex ?? null,
      sourceLinkLocator: link.sourceLocator,
      requestedFragment: link.requestedFragment || null,
      displayText: link.displayText || null
    });
  }
  return [...requests.values()].sort((a, b) => a.requestedTitle.localeCompare(b.requestedTitle));
}

function groupResolvedCandidates(route, requests, resolutions, repeatabilityPolicy, contentHash) {
  const resolutionByRequestedTitle = new Map(resolutions.map(resolution => [resolution.requestedTitle, resolution]));
  const collectionPageId = Number(route.canonicalActivityIdentityEvidence?.collectionDefinition?.collectionSource?.pageId || 0);
  const linkedSourcePageId = Number(route.sourcePageId || 0);
  const requestAssessments = [];
  const groups = new Map();
  for (const request of requests) {
    const resolution = resolutionByRequestedTitle.get(request.requestedTitle) || null;
    const page = resolution?.page || null;
    const revision = sourceRevision(resolution);
    const content = sourceContent(resolution);
    const pageId = Number(page?.pageid || 0);
    const excluded = Boolean(pageId && (pageId === linkedSourcePageId || pageId === collectionPageId));
    const assessment = {
      requestedTitle: request.requestedTitle,
      normalizedTitle: resolution?.normalizedTitle || request.requestedTitle,
      resolvedTitle: resolution?.resolvedTitle || null,
      redirected: resolution?.redirected === true,
      sourcePageId: pageId || null,
      namespace: page?.ns ?? null,
      state: !page || page.missing ? 'missing_official_wiki_page'
        : excluded ? 'excluded_already_scanned_source'
          : page.ns !== 0 ? 'excluded_non_main_namespace'
            : !revision || typeof content !== 'string' ? 'missing_current_revision_content'
              : 'eligible_revision_pinned_candidate',
      discoveryContexts: request.discoveryContexts
    };
    requestAssessments.push(assessment);
    if (assessment.state !== 'eligible_revision_pinned_candidate') continue;
    const key = String(pageId);
    const current = groups.get(key) || { resolution, requestedTitles: [], discoveryContexts: [] };
    current.requestedTitles.push(request.requestedTitle);
    current.discoveryContexts.push(...request.discoveryContexts.map(context => ({ requestedTitle: request.requestedTitle, ...context })));
    groups.set(key, current);
  }
  const compiledSignals = compileRepeatabilityEvidencePolicy(repeatabilityPolicy);
  const candidatePages = [...groups.values()].map(group => {
    const { page } = group.resolution;
    const revision = sourceRevision(group.resolution);
    const content = sourceContent(group.resolution);
    const computedHash = contentHash(content);
    const sourcePageId = Number(page.pageid);
    const sourceRevisionId = String(revision.revid || '');
    return {
      sourcePageId,
      resolvedTitle: page.title,
      requestedTitles: sorted(unique(group.requestedTitles)),
      redirectedRequestedTitles: sorted(unique(group.requestedTitles.filter(title => {
        const resolution = resolutionByRequestedTitle.get(title);
        return resolution?.redirected === true;
      }))),
      sourceRevision: sourceRevisionId,
      sourceTimestamp: revision.timestamp || null,
      sourceUrl: wikiUrl(page.title),
      sourceContentHash: computedHash,
      sourceContentBytes: Buffer.byteLength(content, 'utf8'),
      completeRevisionContentScanned: true,
      discoveryContexts: group.discoveryContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      sourceLocatedSignals: scanRepeatabilitySource({
        text: content,
        sourceScope: `corroborating_source_pageid_${sourcePageId}`,
        sourcePageId,
        sourceRevision: sourceRevisionId,
        sourceContentHash: computedHash,
        scannedTextHash: computedHash,
        memberCandidateKey: route.memberCandidateKey,
        definitions: compiledSignals.definitions
      }),
      repeatabilityVerdict: null,
      reviewState: 'corroborating_source_candidate_only_not_a_repeatability_verdict'
    };
  }).sort((a, b) => a.sourcePageId - b.sourcePageId || a.resolvedTitle.localeCompare(b.resolvedTitle));
  return { requestAssessments, candidatePages, compiledSignals };
}

function packetFor(route, resolutions, policy, repeatabilityPolicy, contentHash) {
  const compiled = compileRepeatabilityGapEvidencePolicy(policy);
  const requests = discoverRepeatabilityGapCandidateRequests(route, policy);
  const grouped = groupResolvedCandidates(route, requests, resolutions, repeatabilityPolicy, contentHash);
  const deficiencies = [];
  if (!route.contentHash) deficiencies.push('repeatability_evidence_work_routing_content_hash_missing');
  if (!routeMatchesPolicy(route, policy)) deficiencies.push('input_route_does_not_match_gap_evidence_policy');
  if (!requests.length) deficiencies.push('no_exact_source_authored_candidate_links_discovered');
  if (!grouped.candidatePages.length) deficiencies.push('no_revision_pinned_corroborating_candidate_pages');
  if (grouped.requestAssessments.some(request => request.state === 'missing_official_wiki_page' || request.state === 'missing_current_revision_content')) deficiencies.push('one_or_more_candidate_source_pages_lack_current_revision_evidence');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidStructuralSignalKinds.length || compiled.missingStructuralSignalKinds.length || compiled.invalidDiscoveryChannels.length || compiled.missingDiscoveryChannels.length) deficiencies.push('repeatability_gap_evidence_policy_invalid_or_incomplete');
  if (grouped.compiledSignals.invalidRules.length || grouped.compiledSignals.forbiddenPolicyPaths.length || grouped.compiledSignals.duplicateDefinitionKeys.length || grouped.compiledSignals.invalidDefinitionKeys.length || grouped.compiledSignals.requiredDefinitionKindsMissing.length) deficiencies.push('repeatability_signal_policy_invalid_or_incomplete');
  const signals = grouped.candidatePages.flatMap(page => page.sourceLocatedSignals);
  const signalCount = kind => signals.filter(signal => signal.signalKind === kind).length;
  const evidence = {
    discoveryBoundary: {
      routeKey: route.routingDecision?.routeKey || null,
      routeState: route.routingDecision?.routeState || null,
      structuralSignalEvidenceKeys: sorted(unique((route.repeatabilityEvidence?.sourceLocatedSignals || [])
        .filter(signal => (policy.discovery?.allowedStructuralSignalKinds || []).includes(signal.signalKind))
        .map(signal => signal.evidenceKey))),
      candidateRequests: requests,
      candidateRequestAssessments: grouped.requestAssessments,
      previouslyScannedPageIdsExcluded: sorted(unique(grouped.requestAssessments
        .filter(request => request.state === 'excluded_already_scanned_source')
        .map(request => request.sourcePageId)))
    },
    candidatePages: grouped.candidatePages,
    evidenceState: deficiencies.length
      ? 'incomplete_revision_pinned_corroborating_repeatability_evidence_packet'
      : 'complete_revision_pinned_corroborating_repeatability_evidence_packet'
  };
  const observations = {
    candidateRequestCount: requests.length,
    discoveryContextCount: requests.reduce((sum, request) => sum + request.discoveryContexts.length, 0),
    candidatePageCount: grouped.candidatePages.length,
    candidateSourceBytesScanned: grouped.candidatePages.reduce((sum, page) => sum + page.sourceContentBytes, 0),
    sourceLocatedSignalCount: signals.length,
    explicitPositiveDeclarationCandidateCount: signalCount('explicit_positive_repeatability_declaration_candidate'),
    explicitNegativeDeclarationCandidateCount: signalCount('explicit_negative_repeatability_declaration_candidate'),
    recurrenceStructureCandidateCount: signalCount('recurrence_structure_candidate'),
    sessionBoundaryCandidateCount: signalCount('session_boundary_candidate'),
    repeatabilityVerdict: null,
    candidateScopeVerdict: null,
    deficiencies
  };
  return {
    contract: policy.recordContract || 'sensum.activity-reference-collection-member-repeatability-gap-evidence.v1',
    ...preservedInput(route),
    sourceRepeatabilityEvidenceWorkRoutingContentHash: route.contentHash,
    corroboratingRepeatabilityEvidence: evidence,
    corroboratingRepeatabilityCandidateObservations: observations,
    accountIndependent: true,
    blockers: unique([
      ...(route.blockers || []),
      ...deficiencies,
      'corroborating_repeatability_evidence_requires_semantic_disposition',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: deficiencies.length
      ? 'blocked_incomplete_corroborating_repeatability_evidence_packet'
      : 'corroborating_repeatability_evidence_packet_ready_for_semantic_disposition'
  };
}

export function buildActivityReferenceCollectionMemberRepeatabilityGapEvidence({ routingRecords = [], fetchedResolutions = [], policy = {}, repeatabilityPolicy = {}, contentHash = value => value }) {
  const routes = selectRepeatabilityGapRoutes(routingRecords, policy);
  const records = routes.map(route => packetFor(route, fetchedResolutions, policy, repeatabilityPolicy, contentHash));
  return { records, audit: auditActivityReferenceCollectionMemberRepeatabilityGapEvidence(records, { routingRecords, fetchedResolutions, policy, repeatabilityPolicy, contentHash }) };
}

export function auditActivityReferenceCollectionMemberRepeatabilityGapEvidence(records = [], { routingRecords = [], fetchedResolutions = [], policy = {}, repeatabilityPolicy = {}, contentHash = value => value } = {}) {
  const routes = selectRepeatabilityGapRoutes(routingRecords, policy);
  const expectedRecords = routes.map(route => packetFor(route, fetchedResolutions, policy, repeatabilityPolicy, contentHash));
  const expectedKeys = routes.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(routes.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expectedRecords.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || output.sourceRepeatabilityEvidenceWorkRoutingContentHash !== input.contentHash
      || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const evidenceMismatches = records.filter(record => {
    const expected = expectedByKey.get(record.memberCandidateKey);
    return !expected
      || JSON.stringify(record.corroboratingRepeatabilityEvidence) !== JSON.stringify(expected.corroboratingRepeatabilityEvidence)
      || JSON.stringify(record.corroboratingRepeatabilityCandidateObservations) !== JSON.stringify(expected.corroboratingRepeatabilityCandidateObservations);
  }).map(record => record.memberCandidateKey);
  const compiled = compileRepeatabilityGapEvidencePolicy(policy);
  const compiledSignals = compileRepeatabilityEvidencePolicy(repeatabilityPolicy);
  const structurallyInvalidInputs = routes.filter(record =>
    !record.contentHash || record.accountIndependent !== true
    || record.repeatabilityDisposition?.classification !== null
    || record.repeatabilityReview?.state !== 'reviewed_blocked'
    || record.repeatabilityReview?.classification !== null
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const incompletePackets = records.filter(record => record.corroboratingRepeatabilityEvidence?.evidenceState !== 'complete_revision_pinned_corroborating_repeatability_evidence_packet').map(record => record.memberCandidateKey);
  const repeatabilityMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(input.repeatabilityDisposition)
      || JSON.stringify(record.repeatabilityReview) !== JSON.stringify(input.repeatabilityReview);
  }).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const verdictRecords = records.filter(record =>
    record.corroboratingRepeatabilityCandidateObservations?.repeatabilityVerdict !== null
    || (record.corroboratingRepeatabilityEvidence?.candidatePages || []).some(page => page.repeatabilityVerdict !== null)
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const candidatePages = records.flatMap(record => record.corroboratingRepeatabilityEvidence?.candidatePages || []);
  const requestAssessments = records.flatMap(record => record.corroboratingRepeatabilityEvidence?.discoveryBoundary?.candidateRequestAssessments || []);
  const signals = candidatePages.flatMap(page => page.sourceLocatedSignals || []);
  const contexts = records.flatMap(record => record.corroboratingRepeatabilityEvidence?.discoveryBoundary?.candidateRequests || []).flatMap(request => request.discoveryContexts || []);
  const channelCounts = {};
  for (const context of contexts) channelCounts[context.channel] = (channelCounts[context.channel] || 0) + 1;
  const signalCounts = {};
  for (const signal of signals) signalCounts[signal.signalKind] = (signalCounts[signal.signalKind] || 0) + 1;
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_matching_repeatability_gap_routes');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_member_candidate_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_upstream_evidence_identity_revision_hash_or_context_values_changed');
  if (evidenceMismatches.length) structuralBlockers.push('one_or_more_corroborating_evidence_packets_do_not_match_source_inputs');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_repeatability_gap_route_inputs_are_structurally_invalid');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidStructuralSignalKinds.length || compiled.missingStructuralSignalKinds.length || compiled.invalidDiscoveryChannels.length || compiled.missingDiscoveryChannels.length) structuralBlockers.push('repeatability_gap_evidence_policy_invalid_or_incomplete');
  if (compiledSignals.invalidRules.length || compiledSignals.forbiddenPolicyPaths.length || compiledSignals.duplicateDefinitionKeys.length || compiledSignals.invalidDefinitionKeys.length || compiledSignals.requiredDefinitionKindsMissing.length) structuralBlockers.push('repeatability_signal_policy_invalid_or_incomplete');
  if (incompletePackets.length) structuralBlockers.push('one_or_more_corroborating_repeatability_evidence_packets_incomplete');
  if (repeatabilityMutations.length) structuralBlockers.push('evidence_collection_changed_repeatability_disposition_or_review');
  if (verdictRecords.length) structuralBlockers.push('candidate_evidence_created_an_unsupported_repeatability_verdict');
  if (downstreamPromotions.length) structuralBlockers.push('unsupported_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_repeatability_gap_evidence');
  const evidencePacketAttemptCoverageComplete = expectedKeys.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length;
  const repeatabilityGapEvidencePacketCoverageComplete = evidencePacketAttemptCoverageComplete && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-repeatability-gap-evidence-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedGapRouteCount: expectedKeys.length,
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
      policy: policy.policy || null,
      repeatabilitySignalPolicy: repeatabilityPolicy.policy || null,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      invalidStructuralSignalKinds: compiled.invalidStructuralSignalKinds,
      missingStructuralSignalKinds: compiled.missingStructuralSignalKinds,
      invalidDiscoveryChannels: compiled.invalidDiscoveryChannels,
      missingDiscoveryChannels: compiled.missingDiscoveryChannels,
      repeatabilitySignalPolicyInvalidRules: compiledSignals.invalidRules,
      repeatabilitySignalPolicyForbiddenPaths: compiledSignals.forbiddenPolicyPaths,
      repeatabilitySignalPolicyDuplicateDefinitionKeys: compiledSignals.duplicateDefinitionKeys,
      repeatabilitySignalPolicyInvalidDefinitionKeys: compiledSignals.invalidDefinitionKeys,
      repeatabilitySignalPolicyRequiredDefinitionKindsMissing: compiledSignals.requiredDefinitionKindsMissing
    },
    candidateDiscoveryCoverage: {
      candidateRequestCount: requestAssessments.length,
      discoveryContextCount: contexts.length,
      discoveryChannelCounts: channelCounts,
      eligibleRequestCount: requestAssessments.filter(request => request.state === 'eligible_revision_pinned_candidate').length,
      excludedAlreadyScannedRequestCount: requestAssessments.filter(request => request.state === 'excluded_already_scanned_source').length,
      excludedNonMainNamespaceRequestCount: requestAssessments.filter(request => request.state === 'excluded_non_main_namespace').length,
      missingCandidateRequestCount: requestAssessments.filter(request => request.state === 'missing_official_wiki_page' || request.state === 'missing_current_revision_content').length,
      uniqueResolvedCandidatePageCount: candidatePages.length,
      duplicateResolvedPageContextsPreserved: contexts.length > candidatePages.length,
      evidenceMismatchMemberCandidateKeys: evidenceMismatches
    },
    sourceAlignmentCoverage: {
      revisionPinnedCandidatePageCount: candidatePages.filter(page => page.sourcePageId && page.sourceRevision && page.sourceTimestamp && page.sourceUrl && page.sourceContentHash && page.completeRevisionContentScanned).length,
      candidateSourceBytesScanned: candidatePages.reduce((sum, page) => sum + Number(page.sourceContentBytes || 0), 0),
      incompletePacketMemberCandidateKeys: incompletePackets
    },
    repeatabilitySignalCoverage: {
      sourceLocatedSignalCount: signals.length,
      signalKindCounts: signalCounts,
      explicitPositiveDeclarationCandidateCount: signals.filter(signal => signal.signalKind === 'explicit_positive_repeatability_declaration_candidate').length,
      explicitNegativeDeclarationCandidateCount: signals.filter(signal => signal.signalKind === 'explicit_negative_repeatability_declaration_candidate').length,
      recurrenceStructureCandidateCount: signals.filter(signal => signal.signalKind === 'recurrence_structure_candidate').length,
      sessionBoundaryCandidateCount: signals.filter(signal => signal.signalKind === 'session_boundary_candidate').length,
      repeatabilityVerdictCount: records.length - records.filter(record => record.corroboratingRepeatabilityCandidateObservations?.repeatabilityVerdict === null).length,
      unsupportedVerdictMemberCandidateKeys: verdictRecords
    },
    semanticPromotionCoverage: {
      repeatabilityDispositionMutationMemberCandidateKeys: repeatabilityMutations,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedDownstreamPromotionMemberCandidateKeys: downstreamPromotions
    },
    accountStateFindings,
    evidencePacketAttemptCoverageComplete,
    repeatabilityGapEvidencePacketCoverageComplete,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'corroborating_repeatability_evidence_requires_semantic_disposition',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: repeatabilityGapEvidencePacketCoverageComplete
  };
}
