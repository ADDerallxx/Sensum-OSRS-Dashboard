import { parseSkillTrainingGuideDirectLinks } from './skill-training-guide-direct-link-lib.mjs';
import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = revision => revision?.slots?.main?.content;
const wikiUrl = title => 'https://oldschool.runescape.wiki/w/' + encodeURIComponent(String(title || '').replaceAll(' ', '_'));
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceIndependentRepeatabilitySignalScopeEvidenceWorkRoutingContentHash',
  'independentRepeatabilitySignalSubjectPredicateEvidence',
  'independentRepeatabilitySignalSubjectPredicateObservations'
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
      if (/^(?:pageId|pageIds|revision|revisions|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|collectionDisplayLabel|collectionDisplayLabels|canonicalLabel|canonicalLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileIndependentRepeatabilitySignalSubjectPredicateEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'oneOutputRecordPerCompleteRoutingRecord',
    'oneNestedEvidencePacketPerRoutedSignal',
    'everyUniqueSignalSourceRevisionIsFetchedExactly',
    'fetchedPageRevisionTimestampUrlAndContentHashMustMatchTheRetainedSource',
    'exactSourceLineAndPredicateSpanMustRevalidate',
    'exactLineSourceAuthoredLinkSetMustRevalidate',
    'stablePageIdentityMatchesAreStructuralObservationsOnly',
    'sourcePageTitleCanonicalLabelLexicalProximityAndSearchContextCannotBindTheSubject',
    'absenceOfAStableAnchorCannotEstablishOutOfScope',
    'presenceOfAStableAnchorCannotEstablishSemanticSubjectBindingWithoutDisposition',
    'pronounAntecedentImplicitSubjectCrossSentenceCoreferenceAndVariantScopeCannotBeInferred',
    'canonicalActivitySubjectPredicateScopeAndRepeatabilityVerdictsRemainNull',
    'upstreamEvidenceRoutesDispositionsReviewsAndIdentitiesRemainUnchanged',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'missingContradictoryOrConditionMismatchedEvidenceRemainsExplicit',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.evidenceChannel !== 'exact_revision_source_line_predicate_span_and_stable_identity_anchor_observations') {
    invalidRules.push('exact_revision_subject_predicate_evidence_channel_not_configured');
  }
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract) {
    invalidRules.push('subject_predicate_evidence_contract_boundary_missing');
  }
  const supportedRouteKeys = sorted(unique(policy.supportedRouteKeys || []));
  const expectedRouteKeys = sorted([
    'collect_source_bound_subject_predicate_binding_without_exact_line_link',
    'resolve_stable_activity_anchor_then_bind_repeatability_predicate'
  ]);
  if (JSON.stringify(supportedRouteKeys) !== JSON.stringify(expectedRouteKeys)) {
    invalidRules.push('subject_predicate_supported_route_set_mismatch');
  }
  return {
    policyId: policy.policy || null,
    supportedRouteKeys,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function routeMatches(record, policy) {
  const routing = record.independentRepeatabilitySignalScopeEvidenceWorkRouting;
  const review = record.independentRepeatabilitySignalScopeEvidenceWorkReview;
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && routing?.state === 'routed_all_signal_scope_evidence_obligations_downstream_gates_closed'
    && routing?.evidenceWorkComplete === false
    && review?.state === 'reviewed_routed_blocked'
    && review?.evidenceWorkComplete === false
    && record.independentRepeatabilitySignalScopeObservations?.canonicalActivityScopeVerdict === null
    && record.independentRepeatabilitySignalScopeObservations?.repeatabilityVerdict === null
    && record.repeatabilityDisposition?.classification === null
    && record.corroboratingRepeatabilityDisposition?.classification === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false;
}

export function selectIndependentRepeatabilitySignalSubjectPredicateEvidenceRoutes(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

function signalScopePacketByKey(record) {
  return new Map((record.independentRepeatabilitySignalScopeEvidence?.signalScopeEvidencePackets || [])
    .map(packet => [packet.signalEvidenceKey, packet]));
}

function signalRouteByKey(record) {
  return new Map((record.independentRepeatabilitySignalScopeEvidenceWorkRouting?.signalEvidenceWorkRoutes || [])
    .map(route => [route.signalEvidenceKey, route]));
}

export function discoverIndependentRepeatabilitySignalSubjectPredicateRevisionRequests(records = [], policy = {}) {
  const requests = new Map();
  for (const record of selectIndependentRepeatabilitySignalSubjectPredicateEvidenceRoutes(records, policy)) {
    const packets = signalScopePacketByKey(record);
    for (const route of record.independentRepeatabilitySignalScopeEvidenceWorkRouting?.signalEvidenceWorkRoutes || []) {
      const packet = packets.get(route.signalEvidenceKey);
      const source = packet?.sourceCandidate;
      if (!source?.sourceRevision) continue;
      const key = String(source.sourceRevision);
      const current = requests.get(key) || {
        sourceRevision: key,
        sourcePageId: Number(source.sourcePageId || 0) || null,
        resolvedTitle: source.resolvedTitle || null,
        sourceTimestamp: source.sourceTimestamp || null,
        sourceUrl: source.sourceUrl || null,
        sourceContentHash: source.sourceContentHash || null,
        signalContexts: []
      };
      current.signalContexts.push({
        memberCandidateKey: record.memberCandidateKey,
        canonicalActivityKey: record.canonicalActivityIdentity?.canonicalActivityKey || null,
        signalEvidenceKey: route.signalEvidenceKey,
        routeKey: route.routeKey,
        sourceLocator: packet?.sourceLocatedSignal?.sourceLocator || null
      });
      current.signalContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      requests.set(key, current);
    }
  }
  return [...requests.values()].sort((a, b) => Number(a.sourcePageId) - Number(b.sourcePageId)
    || a.sourceRevision.localeCompare(b.sourceRevision));
}

function fetchedByRevision(fetchedPages = []) {
  return new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
}

function exactSourceLine(content, locator = {}) {
  const lines = String(content || '').split(/\r?\n/);
  const start = Number(locator.lineStart || 0);
  const end = Number(locator.lineEnd || 0);
  if (!start || !end || end < start || end > lines.length) return null;
  return {
    lineStart: start,
    lineEnd: end,
    text: lines.slice(start - 1, end).join('\n')
  };
}

function exactPredicateSpan(line, signal = {}) {
  const start = Number(signal.sourceLocator?.columnStart || 0);
  const end = Number(signal.sourceLocator?.columnEnd || 0);
  const singleLine = line && line.lineStart === line.lineEnd;
  const extractedText = singleLine && start > 0 && end >= start
    ? line.text.slice(start - 1, end)
    : null;
  return {
    columnStart: start || null,
    columnEnd: end || null,
    expectedText: signal.matchedText || null,
    extractedText,
    exactMatch: extractedText !== null && extractedText === signal.matchedText
  };
}

function comparableLink(link = {}) {
  return {
    occurrenceKey: link.occurrenceKey || null,
    sourceTarget: link.sourceTarget || null,
    requestedTitle: link.requestedTitle || null,
    requestedFragment: link.requestedFragment ?? null,
    displayText: link.displayText ?? null,
    namespaceClass: link.namespaceClass || null,
    sourceLine: Number(link.sourceLocator?.line || 0) || null,
    sourceExcerpt: link.sourceLocator?.excerpt || null
  };
}

function revalidatedLinksForSource(fetched, source, line) {
  const content = sourceContent(fetched?.revision);
  if (typeof content !== 'string' || !line) return { links: [], audit: null };
  const parsed = parseSkillTrainingGuideDirectLinks({
    content,
    sourcePageId: Number(fetched.page?.pageid || 0),
    title: fetched.page?.title || source.resolvedTitle,
    sourceRevision: String(fetched.revision?.revid || ''),
    sourceTimestamp: fetched.revision?.timestamp || null,
    sourceUrl: wikiUrl(fetched.page?.title || source.resolvedTitle),
    sourceContentHash: source.sourceContentHash,
    skillKeys: [],
    channels: ['independent_repeatability_subject_predicate_evidence']
  });
  return {
    links: parsed.occurrences
      .filter(link => link.namespaceClass === 'main'
        && Number(link.sourceLocator?.line || 0) >= line.lineStart
        && Number(link.sourceLocator?.line || 0) <= line.lineEnd)
      .map(comparableLink),
    audit: parsed.audit
  };
}

function packetForSignal(record, route, scopePacket, fetched, contentHash, supportedRouteKeys) {
  const source = scopePacket?.sourceCandidate || {};
  const signal = scopePacket?.sourceLocatedSignal || {};
  const revision = fetched?.revision || null;
  const page = fetched?.page || null;
  const content = sourceContent(revision);
  const line = exactSourceLine(content, signal.sourceLocator);
  const predicate = exactPredicateSpan(line, signal);
  const expectedLinks = (scopePacket?.exactLineSourceAuthoredMainNamespaceLinks || []).map(comparableLink);
  const reparsed = revalidatedLinksForSource(fetched, source, line);
  const expectedLinkKeys = expectedLinks.map(link => link.occurrenceKey);
  const reparsedLinkKeys = reparsed.links.map(link => link.occurrenceKey);
  const anchor = record.canonicalActivityIdentity?.stableIdentityAnchor || {};
  const sourceMatchesLinkedSubjectAnchor = Number(source.sourcePageId || 0) === Number(anchor.linkedSubjectPageId || 0);
  const sourceMatchesCollectionAnchor = Number(source.sourcePageId || 0) === Number(anchor.collectionPageId || 0);
  const linkedTargetAnchorOccurrenceKeys = scopePacket?.stableIdentityComparisons?.linkedSubjectAnchorTargetOccurrenceKeys || [];
  const collectionTargetAnchorOccurrenceKeys = scopePacket?.stableIdentityComparisons?.collectionAnchorTargetOccurrenceKeys || [];
  const stableAnchorEvidenceKeys = sorted(unique([
    ...(sourceMatchesLinkedSubjectAnchor ? ['source-page-matches-linked-subject-anchor'] : []),
    ...(sourceMatchesCollectionAnchor ? ['source-page-matches-collection-anchor'] : []),
    ...linkedTargetAnchorOccurrenceKeys,
    ...collectionTargetAnchorOccurrenceKeys
  ]));
  const deficiencies = [];
  if (!route || !supportedRouteKeys.includes(route.routeKey)) deficiencies.push('unsupported_or_missing_signal_evidence_work_route');
  if (!scopePacket || scopePacket.signalEvidenceKey !== route?.signalEvidenceKey) deficiencies.push('signal_scope_evidence_packet_missing_or_mismatched');
  if (!page || !revision || typeof content !== 'string') deficiencies.push('exact_signal_source_revision_not_fetched');
  if (Number(page?.pageid || 0) !== Number(source.sourcePageId || 0)) deficiencies.push('fetched_signal_source_page_id_mismatch');
  if ((page?.title || null) !== (source.resolvedTitle || null)) deficiencies.push('fetched_signal_source_resolved_title_mismatch');
  if (String(revision?.revid || '') !== String(source.sourceRevision || '')) deficiencies.push('fetched_signal_source_revision_mismatch');
  if (revision?.timestamp !== source.sourceTimestamp) deficiencies.push('fetched_signal_source_timestamp_mismatch');
  if (page && source.sourceUrl !== wikiUrl(page.title)) deficiencies.push('fetched_signal_source_url_mismatch');
  if (typeof content === 'string' && contentHash(content) !== source.sourceContentHash) deficiencies.push('fetched_signal_source_content_hash_mismatch');
  if (!line) deficiencies.push('exact_signal_source_line_unavailable');
  if (line && line.text !== signal.contextText) deficiencies.push('exact_signal_source_line_context_mismatch');
  if (!predicate.exactMatch) deficiencies.push('exact_repeatability_predicate_span_mismatch');
  if (reparsed.audit?.balancedSourceLinkDelimiters !== true) deficiencies.push('signal_source_wikilink_delimiters_unbalanced');
  if (JSON.stringify(expectedLinkKeys) !== JSON.stringify(reparsedLinkKeys)) deficiencies.push('exact_line_source_authored_link_occurrence_set_mismatch');
  if (expectedLinks.length === reparsed.links.length
    && expectedLinks.some((link, index) => JSON.stringify(link) !== JSON.stringify(reparsed.links[index]))) {
    deficiencies.push('exact_line_source_authored_link_context_mismatch');
  }
  const structuralState = stableAnchorEvidenceKeys.length
    ? 'stable_activity_anchor_observed_semantic_binding_unreviewed'
    : 'no_stable_activity_anchor_observed_semantic_binding_unresolved';
  return {
    signalEvidenceKey: route?.signalEvidenceKey || scopePacket?.signalEvidenceKey || null,
    evidenceWorkRoute: route || null,
    sourceRevisionVerification: {
      expected: source,
      fetched: page && revision ? {
        sourcePageId: Number(page.pageid || 0) || null,
        resolvedTitle: page.title || null,
        sourceRevision: String(revision.revid || '') || null,
        sourceTimestamp: revision.timestamp || null,
        sourceUrl: wikiUrl(page.title),
        sourceContentHash: typeof content === 'string' ? contentHash(content) : null,
        sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null
      } : null,
      exactAlignment: deficiencies.every(deficiency => !deficiency.startsWith('fetched_signal_source_')
        && deficiency !== 'exact_signal_source_revision_not_fetched')
    },
    exactSourceLineEvidence: line ? {
      ...line,
      sourceLineContentHash: contentHash(line.text),
      retainedContextText: signal.contextText || null,
      exactContextMatch: line.text === signal.contextText
    } : null,
    repeatabilityPredicateEvidence: {
      definitionKey: signal.definitionKey || null,
      signalKind: signal.signalKind || null,
      ...predicate,
      semanticMeaningVerdict: null
    },
    exactLineLinkRevalidation: {
      expectedLinks,
      revalidatedLinks: reparsed.links,
      expectedOccurrenceKeys: expectedLinkKeys,
      revalidatedOccurrenceKeys: reparsedLinkKeys,
      exactOccurrenceSetMatch: JSON.stringify(expectedLinkKeys) === JSON.stringify(reparsedLinkKeys),
      exactLinkContextMatch: JSON.stringify(expectedLinks) === JSON.stringify(reparsed.links),
      balancedSourceLinkDelimiters: reparsed.audit?.balancedSourceLinkDelimiters === true
    },
    stableIdentityAnchorObservations: {
      canonicalActivityKey: anchor.canonicalActivityKey || record.canonicalActivityIdentity?.canonicalActivityKey || null,
      linkedSubjectPageId: Number(anchor.linkedSubjectPageId || 0) || null,
      collectionPageId: Number(anchor.collectionPageId || 0) || null,
      relationshipClass: anchor.relationshipClass || null,
      sourceMatchesLinkedSubjectAnchor,
      sourceMatchesCollectionAnchor,
      linkedTargetAnchorOccurrenceKeys,
      collectionTargetAnchorOccurrenceKeys,
      stableAnchorEvidenceKeys,
      structuralState
    },
    semanticBinding: {
      canonicalActivitySubjectVerdict: null,
      repeatabilityPredicateVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      pronounAntecedentReviewed: false,
      implicitSubjectReviewed: false,
      crossSentenceCoreferenceReviewed: false,
      variantOrModeScopeReviewed: false,
      state: 'unreviewed_requires_generic_semantic_disposition'
    },
    limitations: unique([
      ...(scopePacket?.limitations || []),
      ...(stableAnchorEvidenceKeys.length ? [] : ['no_stable_canonical_activity_anchor_on_exact_signal_source_or_link_targets']),
      'exact_source_line_and_predicate_span_do_not_establish_semantic_subject_binding'
    ]),
    deficiencies: unique(deficiencies),
    state: deficiencies.length
      ? 'incomplete_revision_pinned_signal_subject_predicate_evidence'
      : stableAnchorEvidenceKeys.length
        ? 'complete_revision_pinned_signal_subject_predicate_evidence_with_structural_anchor_observation'
        : 'complete_revision_pinned_signal_subject_predicate_evidence_without_structural_anchor'
  };
}

function recordPacket(record, fetchedPages, policy, contentHash) {
  const compiled = compileIndependentRepeatabilitySignalSubjectPredicateEvidencePolicy(policy);
  const fetched = fetchedByRevision(fetchedPages);
  const scopePackets = signalScopePacketByKey(record);
  const routes = record.independentRepeatabilitySignalScopeEvidenceWorkRouting?.signalEvidenceWorkRoutes || [];
  const packets = routes.map(route => packetForSignal(
    record,
    route,
    scopePackets.get(route.signalEvidenceKey),
    fetched.get(String(scopePackets.get(route.signalEvidenceKey)?.sourceCandidate?.sourceRevision || '')),
    contentHash,
    compiled.supportedRouteKeys
  )).sort((a, b) => String(a.signalEvidenceKey).localeCompare(String(b.signalEvidenceKey)));
  const routeKeys = routes.map(route => route.signalEvidenceKey);
  const scopeKeys = [...scopePackets.keys()];
  const deficiencies = [];
  if (!record.contentHash) deficiencies.push('signal_scope_evidence_work_routing_content_hash_missing');
  if (!routeMatches(record, policy)) deficiencies.push('input_does_not_match_complete_signal_scope_evidence_work_routing_state');
  if (!routeKeys.length) deficiencies.push('input_contains_no_routed_signal_evidence_work');
  if (duplicates(routeKeys).length) deficiencies.push('duplicate_input_routed_signal_evidence_key');
  if (sorted(routeKeys).join('|') !== sorted(scopeKeys).join('|')) deficiencies.push('routed_signal_and_scope_packet_sets_do_not_match');
  if (packets.some(packet => packet.deficiencies.length)) deficiencies.push('one_or_more_signal_subject_predicate_evidence_packets_incomplete');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) deficiencies.push('signal_subject_predicate_evidence_policy_invalid_or_incomplete');
  const stableAnchorPackets = packets.filter(packet => packet.stableIdentityAnchorObservations.stableAnchorEvidenceKeys.length);
  const evidence = {
    evidenceState: deficiencies.length
      ? 'incomplete_revision_pinned_independent_repeatability_signal_subject_predicate_evidence_packet'
      : 'complete_revision_pinned_independent_repeatability_signal_subject_predicate_evidence_packet',
    evidenceChannel: policy.evidenceChannel,
    signalSubjectPredicateEvidencePackets: packets
  };
  const observations = {
    routedSignalCount: routes.length,
    evidencePacketCount: packets.length,
    exactRevisionAlignedPacketCount: packets.filter(packet => packet.sourceRevisionVerification.exactAlignment).length,
    exactSourceLineRevalidatedCount: packets.filter(packet => packet.exactSourceLineEvidence?.exactContextMatch).length,
    exactPredicateSpanRevalidatedCount: packets.filter(packet => packet.repeatabilityPredicateEvidence.exactMatch).length,
    exactLineLinkSetRevalidatedCount: packets.filter(packet => packet.exactLineLinkRevalidation.exactOccurrenceSetMatch
      && packet.exactLineLinkRevalidation.exactLinkContextMatch).length,
    stableActivityAnchorObservedPacketCount: stableAnchorPackets.length,
    noStableActivityAnchorObservedPacketCount: packets.length - stableAnchorPackets.length,
    semanticSubjectBindingCount: 0,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    deficiencies: unique(deficiencies)
  };
  return {
    contract: policy.recordContract,
    ...preservedInput(record),
    sourceIndependentRepeatabilitySignalScopeEvidenceWorkRoutingContentHash: record.contentHash,
    independentRepeatabilitySignalSubjectPredicateEvidence: evidence,
    independentRepeatabilitySignalSubjectPredicateObservations: observations,
    accountIndependent: true,
    blockers: unique([
      ...(record.blockers || []),
      ...observations.deficiencies,
      ...(stableAnchorPackets.length < packets.length ? ['one_or_more_signal_lines_lack_a_stable_canonical_activity_anchor'] : []),
      'independent_repeatability_signal_subject_predicate_evidence_requires_semantic_disposition',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: deficiencies.length
      ? 'blocked_incomplete_independent_repeatability_signal_subject_predicate_evidence'
      : 'independent_repeatability_signal_subject_predicate_evidence_ready_for_semantic_disposition'
  };
}

export function buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence({
  routingRecords = [],
  fetchedPages = [],
  policy = {},
  contentHash = value => value
}) {
  const routes = selectIndependentRepeatabilitySignalSubjectPredicateEvidenceRoutes(routingRecords, policy);
  const records = routes.map(record => recordPacket(record, fetchedPages, policy, contentHash));
  return {
    records,
    audit: auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence(records, {
      routingRecords,
      fetchedPages,
      policy,
      contentHash
    })
  };
}

export function auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence(records = [], {
  routingRecords = [],
  fetchedPages = [],
  policy = {},
  contentHash = value => value
} = {}) {
  const inputs = selectIndependentRepeatabilitySignalSubjectPredicateEvidenceRoutes(routingRecords, policy);
  const expected = inputs.map(record => recordPacket(record, fetchedPages, policy, contentHash));
  const expectedKeys = inputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(inputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.sourceIndependentRepeatabilitySignalScopeEvidenceWorkRoutingContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const evidenceMismatches = records.filter(record => {
    const target = expectedByKey.get(record.memberCandidateKey);
    return !target
      || JSON.stringify(record.independentRepeatabilitySignalSubjectPredicateEvidence) !== JSON.stringify(target.independentRepeatabilitySignalSubjectPredicateEvidence)
      || JSON.stringify(record.independentRepeatabilitySignalSubjectPredicateObservations) !== JSON.stringify(target.independentRepeatabilitySignalSubjectPredicateObservations);
  }).map(record => record.memberCandidateKey);
  const packets = records.flatMap(record => record.independentRepeatabilitySignalSubjectPredicateEvidence?.signalSubjectPredicateEvidencePackets || []);
  const inputRoutePairs = inputs.flatMap(record => (record.independentRepeatabilitySignalScopeEvidenceWorkRouting?.signalEvidenceWorkRoutes || [])
    .map(route => record.memberCandidateKey + '|' + route.signalEvidenceKey));
  const outputPacketPairs = records.flatMap(record => (record.independentRepeatabilitySignalSubjectPredicateEvidence?.signalSubjectPredicateEvidencePackets || [])
    .map(packet => record.memberCandidateKey + '|' + packet.signalEvidenceKey));
  const missingSignalPairs = inputRoutePairs.filter(key => !outputPacketPairs.includes(key));
  const unexpectedSignalPairs = outputPacketPairs.filter(key => !inputRoutePairs.includes(key));
  const duplicateSignalPairs = duplicates(outputPacketPairs);
  const revisionRequests = discoverIndependentRepeatabilitySignalSubjectPredicateRevisionRequests(inputs, policy);
  const expectedRevisionIds = revisionRequests.map(request => request.sourceRevision);
  const fetchedRows = fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({ page, revision })));
  const fetchedRevisionIds = fetchedRows.map(({ revision }) => String(revision.revid || '')).filter(Boolean);
  const missingRevisionIds = expectedRevisionIds.filter(revision => !fetchedRevisionIds.includes(revision));
  const unexpectedRevisionIds = fetchedRevisionIds.filter(revision => !expectedRevisionIds.includes(revision));
  const duplicateFetchedRevisionIds = duplicates(fetchedRevisionIds);
  const incompleteRecords = records.filter(record => record.independentRepeatabilitySignalSubjectPredicateEvidence?.evidenceState
    !== 'complete_revision_pinned_independent_repeatability_signal_subject_predicate_evidence_packet').map(record => record.memberCandidateKey);
  const upstreamMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.canonicalActivityIdentity) !== JSON.stringify(input.canonicalActivityIdentity)
      || JSON.stringify(record.independentRepeatabilitySourceEvidence) !== JSON.stringify(input.independentRepeatabilitySourceEvidence)
      || JSON.stringify(record.independentRepeatabilitySignalScopeEvidence) !== JSON.stringify(input.independentRepeatabilitySignalScopeEvidence)
      || JSON.stringify(record.independentRepeatabilitySignalScopeDisposition) !== JSON.stringify(input.independentRepeatabilitySignalScopeDisposition)
      || JSON.stringify(record.independentRepeatabilitySignalScopeEvidenceWorkRouting) !== JSON.stringify(input.independentRepeatabilitySignalScopeEvidenceWorkRouting)
      || JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(input.repeatabilityDisposition)
      || JSON.stringify(record.corroboratingRepeatabilityDisposition) !== JSON.stringify(input.corroboratingRepeatabilityDisposition);
  }).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const localPackets = record.independentRepeatabilitySignalSubjectPredicateEvidence?.signalSubjectPredicateEvidencePackets || [];
    return !input
      || record.independentRepeatabilitySignalSubjectPredicateObservations?.semanticSubjectBindingCount !== 0
      || record.independentRepeatabilitySignalSubjectPredicateObservations?.canonicalActivityScopeVerdict !== null
      || record.independentRepeatabilitySignalSubjectPredicateObservations?.repeatabilityVerdict !== null
      || localPackets.some(packet => Object.entries(packet.semanticBinding || {}).some(([key, value]) => key.endsWith('Verdict') && value !== null))
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const compiled = compileIndependentRepeatabilitySignalSubjectPredicateEvidencePolicy(policy);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_matching_complete_signal_scope_evidence_work_routing_inputs');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_subject_predicate_evidence_record_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_evidence_route_or_context_fields_changed');
  if (evidenceMismatches.length) structuralBlockers.push('one_or_more_subject_predicate_evidence_packets_do_not_match_inputs_and_fetched_revisions');
  if (missingSignalPairs.length || unexpectedSignalPairs.length || duplicateSignalPairs.length) structuralBlockers.push('routed_signal_and_output_evidence_packet_sets_do_not_match_exactly');
  if (missingRevisionIds.length || unexpectedRevisionIds.length || duplicateFetchedRevisionIds.length) structuralBlockers.push('exact_signal_source_revision_fetch_set_mismatch');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) structuralBlockers.push('signal_subject_predicate_evidence_policy_invalid_or_incomplete');
  if (incompleteRecords.length) structuralBlockers.push('one_or_more_signal_subject_predicate_evidence_records_incomplete');
  if (upstreamMutations.length) structuralBlockers.push('subject_predicate_evidence_collection_changed_upstream_evidence_routing_disposition_or_review');
  if (unsupportedPromotions.length) structuralBlockers.push('subject_predicate_evidence_created_unsupported_semantic_binding_scope_repeatability_or_downstream_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_signal_subject_predicate_evidence');
  const subjectPredicateEvidenceAttemptCoverageComplete = expectedKeys.length > 0 && inputRoutePairs.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length
    && !missingSignalPairs.length && !unexpectedSignalPairs.length && !duplicateSignalPairs.length;
  const independentSignalSubjectPredicateEvidenceCoverageComplete = subjectPredicateEvidenceAttemptCoverageComplete
    && structuralBlockers.length === 0;
  const exactRevisionAlignedPackets = packets.filter(packet => packet.sourceRevisionVerification?.exactAlignment).length;
  const stableAnchorPackets = packets.filter(packet => packet.stableIdentityAnchorObservations?.stableAnchorEvidenceKeys?.length).length;
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
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      supportedRouteKeys: compiled.supportedRouteKeys,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths
    },
    revisionCoverage: {
      requestedExactRevisionCount: expectedRevisionIds.length,
      fetchedExactRevisionCount: fetchedRevisionIds.length,
      missingRevisionIds,
      unexpectedRevisionIds,
      duplicateFetchedRevisionIds,
      exactRevisionAlignedPacketCount: exactRevisionAlignedPackets,
      totalFetchedSourceBytes: fetchedRows.reduce((sum, row) => sum + Buffer.byteLength(sourceContent(row.revision) || '', 'utf8'), 0),
      exactRevisionFetchSetMatch: !missingRevisionIds.length && !unexpectedRevisionIds.length && !duplicateFetchedRevisionIds.length
    },
    signalCoverage: {
      routedSignalCount: inputRoutePairs.length,
      evidencePacketCount: outputPacketPairs.length,
      missingSignalPairs,
      unexpectedSignalPairs,
      duplicateSignalPairs,
      sourceBoundSubjectPredicateRouteCount: packets.filter(packet => packet.evidenceWorkRoute?.routeKey === 'collect_source_bound_subject_predicate_binding_without_exact_line_link').length,
      stableAnchorThenSemanticBindingRouteCount: packets.filter(packet => packet.evidenceWorkRoute?.routeKey === 'resolve_stable_activity_anchor_then_bind_repeatability_predicate').length,
      exactSignalSetMatch: !missingSignalPairs.length && !unexpectedSignalPairs.length && !duplicateSignalPairs.length
    },
    sourceLineCoverage: {
      exactSourceLineRevalidatedCount: packets.filter(packet => packet.exactSourceLineEvidence?.exactContextMatch).length,
      exactPredicateSpanRevalidatedCount: packets.filter(packet => packet.repeatabilityPredicateEvidence?.exactMatch).length,
      exactLineLinkSetRevalidatedCount: packets.filter(packet => packet.exactLineLinkRevalidation?.exactOccurrenceSetMatch).length,
      exactLineLinkContextRevalidatedCount: packets.filter(packet => packet.exactLineLinkRevalidation?.exactLinkContextMatch).length,
      expectedExactLineLinkOccurrenceCount: packets.reduce((sum, packet) => sum + (packet.exactLineLinkRevalidation?.expectedOccurrenceKeys?.length || 0), 0),
      revalidatedExactLineLinkOccurrenceCount: packets.reduce((sum, packet) => sum + (packet.exactLineLinkRevalidation?.revalidatedOccurrenceKeys?.length || 0), 0)
    },
    stableIdentityObservationCoverage: {
      stableActivityAnchorObservedPacketCount: stableAnchorPackets,
      noStableActivityAnchorObservedPacketCount: packets.length - stableAnchorPackets,
      signalSourceMatchesLinkedSubjectAnchorCount: packets.filter(packet => packet.stableIdentityAnchorObservations?.sourceMatchesLinkedSubjectAnchor).length,
      signalSourceMatchesCollectionAnchorCount: packets.filter(packet => packet.stableIdentityAnchorObservations?.sourceMatchesCollectionAnchor).length,
      exactLineTargetAnchorOccurrenceCount: packets.reduce((sum, packet) => sum
        + (packet.stableIdentityAnchorObservations?.linkedTargetAnchorOccurrenceKeys?.length || 0)
        + (packet.stableIdentityAnchorObservations?.collectionTargetAnchorOccurrenceKeys?.length || 0), 0),
      semanticSubjectBindingCount: 0,
      canonicalActivityScopeVerdictCount: 0,
      observationsAreNotSemanticVerdicts: true
    },
    semanticPromotionCoverage: {
      upstreamMutationMemberCandidateKeys: upstreamMutations,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions,
      semanticSubjectBindingCount: 0,
      repeatabilityVerdictCount: 0,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length
    },
    evidenceMismatchMemberCandidateKeys: evidenceMismatches,
    incompleteRecordMemberCandidateKeys: incompleteRecords,
    accountStateFindings,
    subjectPredicateEvidenceAttemptCoverageComplete,
    independentSignalSubjectPredicateEvidenceCoverageComplete,
    canonicalActivityScopeReviewComplete: false,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    mechanicsReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'independent_repeatability_signal_subject_predicate_evidence_requires_semantic_disposition',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: independentSignalSubjectPredicateEvidenceCoverageComplete
  };
}
