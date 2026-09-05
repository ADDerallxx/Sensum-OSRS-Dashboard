import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const revisionFor = resolution => resolution?.page?.revisions?.[0];
const contentFor = resolution => revisionFor(resolution)?.slots?.main?.content;
const wikiUrl = title => 'https://oldschool.runescape.wiki/w/' + encodeURIComponent(String(title || '').replaceAll(' ', '_'));
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceIndependentRepeatabilitySourceEvidenceContentHash',
  'independentRepeatabilitySignalScopeEvidence',
  'independentRepeatabilitySignalScopeObservations'
]);

function preservedInput(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !stageFields.has(key)));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, path + '[' + index + ']'));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? path + '.' + name : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileIndependentRepeatabilitySignalScopeEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'oneOutputRecordPerCompleteInputEvidencePacket',
    'oneNestedScopePacketPerRetainedSourceLocatedSignal',
    'candidateSourcePageRevisionHashAndSignalLocatorRemainExact',
    'onlySourceAuthoredMainNamespaceLinksOnTheExactSignalLineAreInScope',
    'everySelectedLinkOccurrenceIsPreservedExactlyOnce',
    'everySelectedRequestedTitleIsResolvedThroughTheOfficialWikiApi',
    'resolvedTargetPageRevisionTimestampUrlAndContentHashArePinned',
    'redirectsDeduplicateByStablePageIdWithoutLosingOccurrenceContexts',
    'stableIdentityComparisonsAreObservationsOnly',
    'aLinkedTargetDoesNotEstablishCanonicalActivityScope',
    'absenceOfALinkDoesNotEstablishOutOfScope',
    'sourcePageTitleLinkTextTargetTitlePageIdAndLexicalSimilarityCannotSelectAScopeVerdict',
    'scopeEvidenceCannotCreateARepeatabilityVerdict',
    'upstreamDispositionsReviewsAndEvidenceRemainUnchanged',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'missingContradictoryOrConditionMismatchedEvidenceRemainsExplicit',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.scopeEvidenceChannel !== 'source_authored_main_namespace_links_on_exact_signal_lines') {
    invalidRules.push('exact_signal_line_scope_evidence_channel_not_configured');
  }
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract) {
    invalidRules.push('scope_evidence_contract_boundary_missing');
  }
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function routeMatches(record, policy) {
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && record.independentRepeatabilitySourceEvidence?.evidenceState === 'complete_revision_pinned_independent_repeatability_source_evidence_packet'
    && record.independentRepeatabilityCandidateObservations?.canonicalActivityScopeVerdict === null
    && record.independentRepeatabilityCandidateObservations?.repeatabilityVerdict === null
    && record.repeatabilityDisposition?.classification === null
    && record.corroboratingRepeatabilityDisposition?.classification === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false;
}

export function selectIndependentRepeatabilitySignalScopeRoutes(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

function selectedExactLineLinks(page = {}, signal = {}) {
  const start = Number(signal.sourceLocator?.lineStart || 0);
  const end = Number(signal.sourceLocator?.lineEnd || 0);
  if (!start || !end || end < start) return [];
  return (page.sourceAuthoredLinks || []).filter(link =>
    link.namespaceClass === 'main'
    && Number(link.sourceLocator?.line || 0) >= start
    && Number(link.sourceLocator?.line || 0) <= end
  );
}

function addRequest(map, link, context) {
  const requestedTitle = String(link.requestedTitle || '').trim();
  if (!requestedTitle) return;
  const key = requestedTitle.toLocaleLowerCase('en');
  const current = map.get(key) || { requestedTitle, linkOccurrenceContexts: [] };
  current.linkOccurrenceContexts.push(context);
  current.linkOccurrenceContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  map.set(key, current);
}

export function discoverIndependentRepeatabilitySignalScopeLinkRequests(records = [], policy = {}) {
  const requests = new Map();
  for (const record of selectIndependentRepeatabilitySignalScopeRoutes(records, policy)) {
    for (const page of record.independentRepeatabilitySourceEvidence?.candidatePages || []) {
      for (const signal of page.sourceLocatedSignals || []) {
        for (const link of selectedExactLineLinks(page, signal)) {
          addRequest(requests, link, {
            memberCandidateKey: record.memberCandidateKey,
            canonicalActivityKey: record.canonicalActivityIdentity?.canonicalActivityKey || null,
            signalEvidenceKey: signal.evidenceKey || null,
            signalKind: signal.signalKind || null,
            definitionKey: signal.definitionKey || null,
            signalSourcePageId: page.sourcePageId || null,
            signalSourceRevision: page.sourceRevision || null,
            signalSourceContentHash: page.sourceContentHash || null,
            signalSourceLocator: signal.sourceLocator || null,
            linkOccurrenceKey: link.occurrenceKey || null,
            requestedFragment: link.requestedFragment ?? null,
            displayText: link.displayText ?? null,
            linkSourceLocator: link.sourceLocator || null,
            semanticUse: 'stable_page_identity_evidence_only_not_canonical_activity_scope_or_repeatability_verdict'
          });
        }
      }
    }
  }
  return [...requests.values()].sort((a, b) => a.requestedTitle.localeCompare(b.requestedTitle));
}

function resolutionByRequestedTitle(resolutions = []) {
  return new Map(resolutions.map(resolution => [String(resolution.requestedTitle || '').toLocaleLowerCase('en'), resolution]));
}

function targetIdentityFromResolution(resolution, contentHash) {
  const page = resolution?.page || null;
  const revision = revisionFor(resolution);
  const content = contentFor(resolution);
  if (!page || page.missing || !page.pageid) return { state: 'missing_official_wiki_page', targetPageIdentity: null };
  if (page.ns !== 0) return { state: 'resolved_non_main_namespace_page', targetPageIdentity: null };
  if (!revision || !revision.revid || !revision.timestamp || typeof content !== 'string') {
    return { state: 'missing_current_revision_content', targetPageIdentity: null };
  }
  return {
    state: 'revision_pinned_official_wiki_main_namespace_page',
    targetPageIdentity: {
      sourcePageId: Number(page.pageid),
      resolvedTitle: page.title,
      sourceRevision: String(revision.revid),
      sourceTimestamp: revision.timestamp,
      sourceUrl: wikiUrl(page.title),
      sourceContentHash: contentHash(content)
    }
  };
}

function assessmentForLink(link, signal, record, resolutionsByTitle, contentHash) {
  const resolution = resolutionsByTitle.get(String(link.requestedTitle || '').toLocaleLowerCase('en')) || null;
  const resolved = targetIdentityFromResolution(resolution, contentHash);
  const anchor = record.canonicalActivityIdentity?.stableIdentityAnchor || {};
  const targetPageId = resolved.targetPageIdentity?.sourcePageId || null;
  return {
    signalEvidenceKey: signal.evidenceKey || null,
    linkOccurrenceKey: link.occurrenceKey || null,
    requestedTitle: link.requestedTitle || null,
    requestedFragment: link.requestedFragment ?? null,
    displayText: link.displayText ?? null,
    sourceLocator: link.sourceLocator || null,
    normalizedTitle: resolution?.normalizedTitle || link.requestedTitle || null,
    resolvedTitle: resolution?.resolvedTitle || null,
    redirected: resolution?.redirected === true,
    resolutionState: resolution ? resolved.state : 'missing_official_wiki_api_resolution',
    targetPageIdentity: resolved.targetPageIdentity,
    stableIdentityComparisons: {
      targetMatchesLinkedSubjectAnchor: targetPageId !== null && targetPageId === Number(anchor.linkedSubjectPageId || 0),
      targetMatchesCollectionAnchor: targetPageId !== null && targetPageId === Number(anchor.collectionPageId || 0),
      targetMatchesSignalSourcePage: targetPageId !== null && targetPageId === Number(signal.sourcePageId || 0)
    },
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null
  };
}

function groupedResolvedTargets(assessments = [], contextsByOccurrence = new Map()) {
  const groups = new Map();
  for (const assessment of assessments) {
    const identity = assessment.targetPageIdentity;
    if (!identity?.sourcePageId) continue;
    const key = String(identity.sourcePageId);
    const current = groups.get(key) || {
      targetPageIdentity: identity,
      requestedTitles: [],
      linkOccurrenceContexts: []
    };
    current.requestedTitles.push(assessment.requestedTitle);
    const context = contextsByOccurrence.get(assessment.signalEvidenceKey + '|' + assessment.linkOccurrenceKey);
    if (context) current.linkOccurrenceContexts.push(context);
    groups.set(key, current);
  }
  return [...groups.values()].map(group => ({
    ...group,
    requestedTitles: sorted(unique(group.requestedTitles)),
    linkOccurrenceContexts: group.linkOccurrenceContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  })).sort((a, b) => a.targetPageIdentity.sourcePageId - b.targetPageIdentity.sourcePageId);
}

function sourceAlignmentDeficiencies(page, signal, links) {
  const deficiencies = [];
  if (!page.sourcePageId || !page.sourceRevision || !page.sourceTimestamp || !page.sourceUrl || !page.sourceContentHash) {
    deficiencies.push('signal_candidate_source_revision_provenance_incomplete');
  }
  if (!signal.evidenceKey || !signal.signalKind || !signal.definitionKey || !signal.sourceLocator?.lineStart || !signal.sourceLocator?.lineEnd) {
    deficiencies.push('source_located_signal_identity_or_locator_incomplete');
  }
  if (Number(signal.sourcePageId) !== Number(page.sourcePageId)
    || String(signal.sourceRevision) !== String(page.sourceRevision)
    || signal.sourceContentHash !== page.sourceContentHash
    || signal.scannedTextHash !== page.sourceContentHash) {
    deficiencies.push('signal_source_page_revision_or_hash_mismatch');
  }
  if (duplicates(links.map(link => link.occurrenceKey)).length) deficiencies.push('duplicate_exact_line_link_occurrence_key');
  for (const link of links) {
    if (!link.occurrenceKey || !link.requestedTitle || link.namespaceClass !== 'main') {
      deficiencies.push('invalid_exact_line_main_namespace_link_occurrence');
    }
    if (Number(link.guidePageId) !== Number(page.sourcePageId)
      || String(link.guideRevision) !== String(page.sourceRevision)
      || link.guideContentHash !== page.sourceContentHash) {
      deficiencies.push('exact_line_link_source_page_revision_or_hash_mismatch');
    }
  }
  return unique(deficiencies);
}

function signalPacket(record, page, signal, resolutionsByTitle, contentHash) {
  const links = selectedExactLineLinks(page, signal);
  const assessments = links.map(link => assessmentForLink(link, signal, record, resolutionsByTitle, contentHash));
  const contextsByOccurrence = new Map(links.map(link => [signal.evidenceKey + '|' + link.occurrenceKey, {
    signalEvidenceKey: signal.evidenceKey,
    linkOccurrenceKey: link.occurrenceKey,
    requestedTitle: link.requestedTitle,
    requestedFragment: link.requestedFragment ?? null,
    displayText: link.displayText ?? null,
    sourceLocator: link.sourceLocator
  }]));
  const deficiencies = sourceAlignmentDeficiencies(page, signal, links);
  if (assessments.some(item => item.resolutionState !== 'revision_pinned_official_wiki_main_namespace_page')) {
    deficiencies.push('one_or_more_exact_line_links_lack_revision_pinned_main_namespace_identity');
  }
  const anchor = record.canonicalActivityIdentity?.stableIdentityAnchor || {};
  return {
    signalEvidenceKey: signal.evidenceKey || null,
    sourceCandidate: {
      sourcePageId: page.sourcePageId || null,
      resolvedTitle: page.resolvedTitle || null,
      sourceRevision: page.sourceRevision || null,
      sourceTimestamp: page.sourceTimestamp || null,
      sourceUrl: page.sourceUrl || null,
      sourceContentHash: page.sourceContentHash || null
    },
    sourceLocatedSignal: signal,
    exactLineSourceAuthoredMainNamespaceLinks: links,
    linkResolutionAssessments: assessments,
    resolvedTargetPages: groupedResolvedTargets(assessments, contextsByOccurrence),
    stableIdentityComparisons: {
      signalSourcePageMatchesLinkedSubjectAnchor: Number(page.sourcePageId || 0) === Number(anchor.linkedSubjectPageId || 0),
      signalSourcePageMatchesCollectionAnchor: Number(page.sourcePageId || 0) === Number(anchor.collectionPageId || 0),
      linkedSubjectAnchorTargetOccurrenceKeys: assessments.filter(item => item.stableIdentityComparisons.targetMatchesLinkedSubjectAnchor).map(item => item.linkOccurrenceKey),
      collectionAnchorTargetOccurrenceKeys: assessments.filter(item => item.stableIdentityComparisons.targetMatchesCollectionAnchor).map(item => item.linkOccurrenceKey),
      signalSourceTargetOccurrenceKeys: assessments.filter(item => item.stableIdentityComparisons.targetMatchesSignalSourcePage).map(item => item.linkOccurrenceKey)
    },
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    limitations: links.length ? [] : ['no_source_authored_main_namespace_link_on_exact_signal_line'],
    deficiencies: unique(deficiencies),
    state: deficiencies.length
      ? 'incomplete_revision_pinned_signal_scope_evidence'
      : links.length
        ? 'complete_revision_pinned_exact_line_link_scope_evidence'
        : 'complete_no_source_authored_main_namespace_link_on_exact_signal_line'
  };
}

function allSignalPackets(record, resolutionsByTitle, contentHash) {
  const packets = [];
  for (const page of record.independentRepeatabilitySourceEvidence?.candidatePages || []) {
    for (const signal of page.sourceLocatedSignals || []) packets.push(signalPacket(record, page, signal, resolutionsByTitle, contentHash));
  }
  return packets.sort((a, b) => String(a.signalEvidenceKey).localeCompare(String(b.signalEvidenceKey)));
}

function packetFor(record, resolutions, policy, contentHash) {
  const compiled = compileIndependentRepeatabilitySignalScopeEvidencePolicy(policy);
  const resolutionsByTitle = resolutionByRequestedTitle(resolutions);
  const signalPackets = allSignalPackets(record, resolutionsByTitle, contentHash);
  const signalKeys = (record.independentRepeatabilitySourceEvidence?.candidatePages || [])
    .flatMap(page => (page.sourceLocatedSignals || []).map(signal => signal.evidenceKey));
  const deficiencies = [];
  if (!record.contentHash) deficiencies.push('independent_repeatability_source_evidence_content_hash_missing');
  if (!routeMatches(record, policy)) deficiencies.push('input_does_not_match_complete_independent_source_evidence_route');
  if (!signalKeys.length) deficiencies.push('input_contains_no_source_located_repeatability_signals');
  if (duplicates(signalKeys).length) deficiencies.push('duplicate_input_source_located_signal_evidence_key');
  if (duplicates(signalPackets.map(packet => packet.signalEvidenceKey)).length) deficiencies.push('duplicate_output_signal_scope_packet_key');
  if (signalPackets.length !== signalKeys.length) deficiencies.push('input_and_output_signal_scope_packet_counts_do_not_match');
  if (signalPackets.some(packet => packet.deficiencies.length)) deficiencies.push('one_or_more_signal_scope_evidence_packets_incomplete');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) deficiencies.push('independent_repeatability_signal_scope_evidence_policy_invalid_or_incomplete');
  const assessments = signalPackets.flatMap(packet => packet.linkResolutionAssessments);
  const allContexts = new Map(assessments.map(item => [item.signalEvidenceKey + '|' + item.linkOccurrenceKey, {
    signalEvidenceKey: item.signalEvidenceKey,
    linkOccurrenceKey: item.linkOccurrenceKey,
    requestedTitle: item.requestedTitle,
    requestedFragment: item.requestedFragment,
    displayText: item.displayText,
    sourceLocator: item.sourceLocator
  }]));
  const resolvedTargetPages = groupedResolvedTargets(assessments, allContexts);
  const noLinkCount = signalPackets.filter(packet => packet.exactLineSourceAuthoredMainNamespaceLinks.length === 0).length;
  const evidence = {
    evidenceState: deficiencies.length
      ? 'incomplete_revision_pinned_independent_repeatability_signal_scope_evidence_packet'
      : 'complete_revision_pinned_independent_repeatability_signal_scope_evidence_packet',
    scopeEvidenceChannel: policy.scopeEvidenceChannel,
    signalScopeEvidencePackets: signalPackets,
    resolvedTargetPages
  };
  const observations = {
    sourceLocatedSignalCount: signalKeys.length,
    signalScopeEvidencePacketCount: signalPackets.length,
    signalsWithExactLineMainNamespaceLinks: signalPackets.length - noLinkCount,
    signalsWithoutExactLineMainNamespaceLinks: noLinkCount,
    exactLineMainNamespaceLinkOccurrenceCount: assessments.length,
    distinctRequestedTitleCount: unique(assessments.map(item => item.requestedTitle)).length,
    revisionPinnedResolutionAssessmentCount: assessments.filter(item => item.resolutionState === 'revision_pinned_official_wiki_main_namespace_page').length,
    uniqueResolvedTargetPageCount: resolvedTargetPages.length,
    signalSourcePageMatchesLinkedSubjectAnchorCount: signalPackets.filter(packet => packet.stableIdentityComparisons.signalSourcePageMatchesLinkedSubjectAnchor).length,
    targetOccurrenceMatchesLinkedSubjectAnchorCount: assessments.filter(item => item.stableIdentityComparisons.targetMatchesLinkedSubjectAnchor).length,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    deficiencies: unique(deficiencies)
  };
  return {
    contract: policy.recordContract,
    ...preservedInput(record),
    sourceIndependentRepeatabilitySourceEvidenceContentHash: record.contentHash,
    independentRepeatabilitySignalScopeEvidence: evidence,
    independentRepeatabilitySignalScopeObservations: observations,
    accountIndependent: true,
    blockers: unique([
      ...(record.blockers || []),
      ...observations.deficiencies,
      ...(noLinkCount ? ['one_or_more_signals_have_no_source_authored_main_namespace_link_on_exact_line'] : []),
      'independent_repeatability_signal_scope_evidence_requires_semantic_disposition',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: deficiencies.length
      ? 'blocked_incomplete_independent_repeatability_signal_scope_evidence'
      : 'independent_repeatability_signal_scope_evidence_ready_for_semantic_disposition'
  };
}

export function buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence({
  sourceEvidenceRecords = [],
  targetResolutions = [],
  policy = {},
  contentHash = value => value
}) {
  const routes = selectIndependentRepeatabilitySignalScopeRoutes(sourceEvidenceRecords, policy);
  const records = routes.map(record => packetFor(record, targetResolutions, policy, contentHash));
  return {
    records,
    audit: auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence(records, {
      sourceEvidenceRecords,
      targetResolutions,
      policy,
      contentHash
    })
  };
}

export function auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence(records = [], {
  sourceEvidenceRecords = [],
  targetResolutions = [],
  policy = {},
  contentHash = value => value
} = {}) {
  const routes = selectIndependentRepeatabilitySignalScopeRoutes(sourceEvidenceRecords, policy);
  const expected = routes.map(record => packetFor(record, targetResolutions, policy, contentHash));
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
    return !input
      || record.sourceIndependentRepeatabilitySourceEvidenceContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const evidenceMismatches = records.filter(record => {
    const target = expectedByKey.get(record.memberCandidateKey);
    return !target
      || JSON.stringify(record.independentRepeatabilitySignalScopeEvidence) !== JSON.stringify(target.independentRepeatabilitySignalScopeEvidence)
      || JSON.stringify(record.independentRepeatabilitySignalScopeObservations) !== JSON.stringify(target.independentRepeatabilitySignalScopeObservations);
  }).map(record => record.memberCandidateKey);
  const compiled = compileIndependentRepeatabilitySignalScopeEvidencePolicy(policy);
  const structurallyInvalidInputs = routes.filter(record =>
    !record.contentHash
    || record.accountIndependent !== true
    || record.independentRepeatabilityCandidateObservations?.canonicalActivityScopeVerdict !== null
    || record.independentRepeatabilityCandidateObservations?.repeatabilityVerdict !== null
    || record.repeatabilityDisposition?.classification !== null
    || record.corroboratingRepeatabilityDisposition?.classification !== null
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const incompleteRecords = records.filter(record =>
    record.independentRepeatabilitySignalScopeEvidence?.evidenceState !== 'complete_revision_pinned_independent_repeatability_signal_scope_evidence_packet'
  ).map(record => record.memberCandidateKey);
  const upstreamMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.independentRepeatabilitySourceEvidence) !== JSON.stringify(input.independentRepeatabilitySourceEvidence)
      || JSON.stringify(record.independentRepeatabilityCandidateObservations) !== JSON.stringify(input.independentRepeatabilityCandidateObservations)
      || JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(input.repeatabilityDisposition)
      || JSON.stringify(record.repeatabilityReview) !== JSON.stringify(input.repeatabilityReview)
      || JSON.stringify(record.corroboratingRepeatabilityDisposition) !== JSON.stringify(input.corroboratingRepeatabilityDisposition)
      || JSON.stringify(record.corroboratingRepeatabilityReview) !== JSON.stringify(input.corroboratingRepeatabilityReview);
  }).map(record => record.memberCandidateKey);
  const signalPackets = records.flatMap(record => record.independentRepeatabilitySignalScopeEvidence?.signalScopeEvidencePackets || []);
  const assessments = signalPackets.flatMap(packet => packet.linkResolutionAssessments || []);
  const inputSignals = routes.flatMap(record => (record.independentRepeatabilitySourceEvidence?.candidatePages || [])
    .flatMap(page => page.sourceLocatedSignals || []));
  const expectedSignalKeys = inputSignals.map(signal => signal.evidenceKey);
  const actualSignalKeys = signalPackets.map(packet => packet.signalEvidenceKey);
  const missingSignalKeys = expectedSignalKeys.filter(key => !actualSignalKeys.includes(key));
  const unexpectedSignalKeys = actualSignalKeys.filter(key => !expectedSignalKeys.includes(key));
  const duplicateSignalKeys = duplicates(actualSignalKeys);
  const expectedOccurrenceKeys = routes.flatMap(record => (record.independentRepeatabilitySourceEvidence?.candidatePages || [])
    .flatMap(page => (page.sourceLocatedSignals || []).flatMap(signal =>
      selectedExactLineLinks(page, signal).map(link => signal.evidenceKey + '|' + link.occurrenceKey))));
  const actualOccurrenceKeys = assessments.map(item => item.signalEvidenceKey + '|' + item.linkOccurrenceKey);
  const missingOccurrenceKeys = expectedOccurrenceKeys.filter(key => !actualOccurrenceKeys.includes(key));
  const unexpectedOccurrenceKeys = actualOccurrenceKeys.filter(key => !expectedOccurrenceKeys.includes(key));
  const duplicateOccurrenceKeys = duplicates(actualOccurrenceKeys);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const packets = record.independentRepeatabilitySignalScopeEvidence?.signalScopeEvidencePackets || [];
    return !input
      || record.independentRepeatabilitySignalScopeObservations?.canonicalActivityScopeVerdict !== null
      || record.independentRepeatabilitySignalScopeObservations?.repeatabilityVerdict !== null
      || packets.some(packet => packet.canonicalActivityScopeVerdict !== null || packet.repeatabilityVerdict !== null
        || (packet.linkResolutionAssessments || []).some(item => item.canonicalActivityScopeVerdict !== null || item.repeatabilityVerdict !== null))
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const resolutionRequests = discoverIndependentRepeatabilitySignalScopeLinkRequests(routes, policy);
  const attemptedTitles = unique(targetResolutions.map(resolution => resolution.requestedTitle));
  const requestedTitles = unique(resolutionRequests.map(request => request.requestedTitle));
  const unattemptedTitles = requestedTitles.filter(title => !attemptedTitles.includes(title));
  const unexpectedAttemptedTitles = attemptedTitles.filter(title => !requestedTitles.includes(title));
  const resolvedTargetPages = records.flatMap(record => record.independentRepeatabilitySignalScopeEvidence?.resolvedTargetPages || []);
  const uniqueResolvedPageIds = unique(resolvedTargetPages.map(page => page.targetPageIdentity?.sourcePageId).filter(Boolean));
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_matching_complete_independent_repeatability_source_evidence_inputs');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_scope_evidence_record_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (evidenceMismatches.length) structuralBlockers.push('one_or_more_signal_scope_evidence_packets_do_not_match_inputs_and_resolutions');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_signal_scope_inputs_are_structurally_invalid');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) structuralBlockers.push('independent_repeatability_signal_scope_evidence_policy_invalid_or_incomplete');
  if (incompleteRecords.length) structuralBlockers.push('one_or_more_independent_repeatability_signal_scope_evidence_records_incomplete');
  if (missingSignalKeys.length || unexpectedSignalKeys.length || duplicateSignalKeys.length) structuralBlockers.push('input_and_output_source_located_signal_sets_do_not_match_exactly');
  if (missingOccurrenceKeys.length || unexpectedOccurrenceKeys.length || duplicateOccurrenceKeys.length) structuralBlockers.push('exact_line_link_occurrence_set_not_preserved_exactly_once');
  if (unattemptedTitles.length || unexpectedAttemptedTitles.length) structuralBlockers.push('exact_line_link_resolution_attempt_set_mismatch');
  if (assessments.some(item => item.resolutionState !== 'revision_pinned_official_wiki_main_namespace_page')) structuralBlockers.push('one_or_more_exact_line_link_targets_lack_revision_pinned_main_namespace_identity');
  if (upstreamMutations.length) structuralBlockers.push('scope_evidence_collection_changed_upstream_evidence_disposition_or_review');
  if (unsupportedPromotions.length) structuralBlockers.push('scope_evidence_created_unsupported_scope_repeatability_or_downstream_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_signal_scope_evidence');
  const signalScopeEvidenceAttemptCoverageComplete = expectedKeys.length > 0
    && expectedSignalKeys.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length
    && !missingKeys.length && !unexpectedKeys.length
    && !missingSignalKeys.length && !unexpectedSignalKeys.length && !duplicateSignalKeys.length;
  const independentSignalScopeEvidenceCoverageComplete = signalScopeEvidenceAttemptCoverageComplete && structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedRecordCount: expectedKeys.length,
      outputRecordCount: records.length,
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
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths
    },
    signalCoverage: {
      sourceLocatedSignalCount: inputSignals.length,
      signalScopeEvidencePacketCount: signalPackets.length,
      missingSignalEvidenceKeys: missingSignalKeys,
      unexpectedSignalEvidenceKeys: unexpectedSignalKeys,
      duplicateSignalEvidenceKeys: duplicateSignalKeys,
      signalsWithExactLineMainNamespaceLinks: signalPackets.filter(packet => packet.exactLineSourceAuthoredMainNamespaceLinks?.length).length,
      signalsWithoutExactLineMainNamespaceLinks: signalPackets.filter(packet => !packet.exactLineSourceAuthoredMainNamespaceLinks?.length).length,
      exactSignalSetMatch: !missingSignalKeys.length && !unexpectedSignalKeys.length && !duplicateSignalKeys.length
    },
    exactLineLinkCoverage: {
      expectedLinkOccurrenceCount: expectedOccurrenceKeys.length,
      preservedLinkOccurrenceCount: actualOccurrenceKeys.length,
      missingLinkOccurrenceKeys: missingOccurrenceKeys,
      unexpectedLinkOccurrenceKeys: unexpectedOccurrenceKeys,
      duplicateLinkOccurrenceKeys: duplicateOccurrenceKeys,
      exactLinkOccurrenceSetMatch: !missingOccurrenceKeys.length && !unexpectedOccurrenceKeys.length && !duplicateOccurrenceKeys.length
    },
    resolutionCoverage: {
      distinctRequestedTitleCount: requestedTitles.length,
      attemptedRequestedTitleCount: attemptedTitles.length,
      unattemptedRequestedTitles: sorted(unattemptedTitles),
      unexpectedAttemptedRequestedTitles: sorted(unexpectedAttemptedTitles),
      revisionPinnedResolutionAssessmentCount: assessments.filter(item => item.resolutionState === 'revision_pinned_official_wiki_main_namespace_page').length,
      unresolvedResolutionAssessmentCount: assessments.filter(item => item.resolutionState !== 'revision_pinned_official_wiki_main_namespace_page').length,
      uniqueResolvedTargetPageCount: uniqueResolvedPageIds.length,
      redirectedResolutionAssessmentCount: assessments.filter(item => item.redirected).length,
      allRequestedTitlesAttemptedExactly: !unattemptedTitles.length && !unexpectedAttemptedTitles.length
    },
    stableIdentityComparisonCoverage: {
      signalSourcePageMatchesLinkedSubjectAnchorCount: signalPackets.filter(packet => packet.stableIdentityComparisons?.signalSourcePageMatchesLinkedSubjectAnchor).length,
      signalSourcePageMatchesCollectionAnchorCount: signalPackets.filter(packet => packet.stableIdentityComparisons?.signalSourcePageMatchesCollectionAnchor).length,
      targetOccurrenceMatchesLinkedSubjectAnchorCount: assessments.filter(item => item.stableIdentityComparisons?.targetMatchesLinkedSubjectAnchor).length,
      targetOccurrenceMatchesCollectionAnchorCount: assessments.filter(item => item.stableIdentityComparisons?.targetMatchesCollectionAnchor).length,
      targetOccurrenceMatchesSignalSourcePageCount: assessments.filter(item => item.stableIdentityComparisons?.targetMatchesSignalSourcePage).length,
      canonicalActivityScopeVerdictCount: 0,
      comparisonsAreObservationsOnly: true
    },
    semanticPromotionCoverage: {
      upstreamMutationMemberCandidateKeys: upstreamMutations,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions,
      repeatabilityVerdictCount: 0,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length
    },
    evidenceMismatchMemberCandidateKeys: evidenceMismatches,
    incompleteRecordMemberCandidateKeys: incompleteRecords,
    accountStateFindings,
    signalScopeEvidenceAttemptCoverageComplete,
    independentSignalScopeEvidenceCoverageComplete,
    canonicalActivityScopeReviewComplete: false,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'independent_repeatability_signal_scope_evidence_requires_semantic_disposition',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: independentSignalScopeEvidenceCoverageComplete
  };
}
