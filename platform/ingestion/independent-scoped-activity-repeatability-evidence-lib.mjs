const REQUIRED_DOMAINS = [
  'parent_activity_post_completion_reassignment_or_restart',
  'member_task_reselection_and_repeatability',
  'cooldown_reset_daily_or_session_limits',
  'finite_exhaustion_one_time_or_completion_lockout',
  'availability_and_assignment_eligibility_across_sessions',
  'independent_source_corroboration_or_conflict'
];

const REQUIRED_CHANNELS = [
  'exact_revision_canonical_collection_anchor',
  'source_authored_reciprocal_main_namespace_link'
];

const REQUIRED_RULES = [
  'oneEvidenceRecordPerEligibleWorkOrder',
  'allSixDomainPacketsAlwaysExist',
  'primaryAndCollectionAnchorsMustMatchExactPinnedRevisions',
  'reciprocalSourcesMustBeSourceAuthoredAndPinnedAtObservedRevision',
  'completeRetainedSourceTextAndLineHashesAreRequired',
  'signalsMustRetainExactSourceAndLocator',
  'subjectAndPredicateBoundariesAreRecordedSeparately',
  'candidateSignalsDoNotResolveEvidenceDomains',
  'absenceOfCandidateSignalsIsNotNegativeEvidence',
  'parentAndMemberRepeatabilityRemainSeparate',
  'allRepeatabilityVerdictsRemainNull',
  'discoveryScopeCompletenessDoesNotProveCompleteIndependentSourceUniverse',
  'inputEvidenceAndAllPriorDispositionsMustBePreserved',
  'memberMechanicsAndOptimizerPromotionAreForbidden',
  'currentAccountStateIsForbidden'
];

const sourceContent = revision => revision?.slots?.main?.content;
const normalizeTitle = value => String(value || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replace(/ /g, '_')).replace(/%2F/gi, '/')}`;
const unique = values => [...new Set(values)];
const duplicates = values => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = at ? `${at}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      walk(child, childPath);
    }
  };
  walk(policy);
  return findings;
}

export function compileIndependentScopedActivityRepeatabilityEvidencePolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(key => policy.rules?.[key] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidDomains = JSON.stringify(policy.requiredEvidenceDomains || []) === JSON.stringify(REQUIRED_DOMAINS) ? [] : ['requiredEvidenceDomains'];
  const invalidChannels = JSON.stringify(policy.discoveryChannels || []) === JSON.stringify(REQUIRED_CHANNELS) ? [] : ['discoveryChannels'];
  const definitions = policy.signalDefinitions || [];
  const invalidDefinitions = definitions
    .filter(definition => !definition.definitionKey || !REQUIRED_DOMAINS.includes(definition.evidenceDomain) || !definition.signalKind || !definition.pattern)
    .map(definition => definition.definitionKey || 'unnamed');
  const duplicateDefinitions = duplicates(definitions.map(definition => definition.definitionKey));
  const invalidDiscovery = [];
  if (!Number.isInteger(policy.sourceDiscovery?.maximumDirectMainNamespaceLinks) || policy.sourceDiscovery.maximumDirectMainNamespaceLinks < 1) invalidDiscovery.push('maximumDirectMainNamespaceLinks');
  for (const key of ['requireExactPrimaryRevisionForLinkDiscovery', 'requireExactCollectionRevision', 'requireReciprocalSourceAuthoredLinkToPrimary', 'excludePrimarySubjectAsIndependentSource', 'renderedLinksAreNotSourceAuthoredLinks']) {
    if (policy.sourceDiscovery?.[key] !== true) invalidDiscovery.push(key);
  }
  return {
    invalidRules,
    invalidDomains,
    invalidChannels,
    invalidDefinitions,
    duplicateDefinitions,
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    valid: !(invalidRules.length || invalidDomains.length || invalidChannels.length || invalidDefinitions.length || duplicateDefinitions.length || forbiddenPolicyPaths(policy).length || invalidDiscovery.length),
    invalidDiscovery
  };
}

function routeMatches(record, policy) {
  const route = record?.canonicalActivityRepeatabilityGapEvidenceWorkRouting;
  return record?.contract === policy.inputContract
    && record?.state === policy.inputState
    && record?.accountIndependent === true
    && route?.routeKey === policy.inputRouteKey
    && route?.routeState === policy.inputRouteState
    && route?.evidenceWorkComplete === false
    && JSON.stringify(route?.requiredEvidenceDomains || []) === JSON.stringify(policy.requiredEvidenceDomains || [])
    && (route?.domainEvidenceWorkItems || []).length === REQUIRED_DOMAINS.length
    && (route?.domainEvidenceWorkItems || []).every((item, index) => item.domainKey === REQUIRED_DOMAINS[index] && item.evidenceWorkComplete === false && String(item.workState || '').startsWith('blocked_'));
}

export function selectIndependentScopedActivityRepeatabilityEvidenceWorkOrders(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

function anchorsFor(record) {
  const identity = record?.canonicalActivityIdentity || {};
  const stable = identity.stableIdentityAnchor || {};
  const boundary = identity.evidenceRevisionBoundary || {};
  const primary = record?.canonicalActivitySubjectBinding?.sourcePageIdentity
    || record?.activityInfoboxSchemaSemanticsReview?.canonicalActivitySubjectBinding?.sourcePageIdentity
    || {};
  return {
    primary: {
      pageId: Number(primary.sourcePageId),
      title: primary.resolvedTitle,
      revision: String(primary.sourceRevision || boundary.linkedSourceRevision || ''),
      timestamp: primary.sourceTimestamp,
      contentHash: primary.sourceContentHash,
      sourceUrl: primary.sourceUrl
    },
    collection: {
      pageId: Number(stable.collectionPageId),
      revision: String(boundary.collectionRevision || '')
    }
  };
}

export function discoverIndependentScopedActivityRepeatabilitySeedRequests(records = [], policy = {}) {
  const requests = [];
  for (const record of selectIndependentScopedActivityRepeatabilityEvidenceWorkOrders(records, policy)) {
    const anchors = anchorsFor(record);
    requests.push({ memberCandidateKey: record.memberCandidateKey, role: 'primary_link_discovery_anchor', ...anchors.primary });
    requests.push({ memberCandidateKey: record.memberCandidateKey, role: 'canonical_collection_anchor', ...anchors.collection });
  }
  return requests;
}

function maskProtected(text) {
  const mask = match => match.replace(/[^\r\n]/g, ' ');
  return String(text || '')
    .replace(/<!--[\s\S]*?-->/g, mask)
    .replace(/<(nowiki|pre|syntaxhighlight|source|code|math|ref)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, mask)
    .replace(/<ref\b[^>]*\/\s*>/gi, mask);
}

export function extractSourceAuthoredMainNamespaceLinks(text = '') {
  const masked = maskProtected(text);
  const links = [];
  const expression = /\[\[\s*([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/gu;
  let match;
  while ((match = expression.exec(masked))) {
    const requestedTitle = match[1].trim().replace(/^:/, '').replace(/_/g, ' ');
    if (!requestedTitle || requestedTitle.includes(':')) continue;
    links.push({ requestedTitle, normalizedTitle: normalizeTitle(requestedTitle), absoluteOffsetStart: match.index, absoluteOffsetEnd: match.index + match[0].length, rawLink: text.slice(match.index, match.index + match[0].length) });
  }
  return links;
}

export function discoverIndependentScopedActivityRepeatabilityCandidateTitles({ workOrders = [], seedPages = [], policy = {} }) {
  const selected = selectIndependentScopedActivityRepeatabilityEvidenceWorkOrders(workOrders, policy);
  const byRevision = new Map(seedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
  const records = [];
  for (const record of selected) {
    const anchors = anchorsFor(record);
    const fetched = byRevision.get(anchors.primary.revision);
    const text = sourceContent(fetched?.revision);
    const links = typeof text === 'string' ? extractSourceAuthoredMainNamespaceLinks(text) : [];
    const distinct = [];
    const seen = new Set();
    for (const link of links) {
      if (seen.has(link.normalizedTitle)) continue;
      seen.add(link.normalizedTitle);
      distinct.push(link.requestedTitle);
    }
    const maximum = policy.sourceDiscovery?.maximumDirectMainNamespaceLinks || 0;
    records.push({
      memberCandidateKey: record.memberCandidateKey,
      primaryRevision: anchors.primary.revision,
      discoveredDistinctTitleCount: distinct.length,
      truncated: distinct.length > maximum,
      requestedTitles: distinct.slice(0, maximum)
    });
  }
  return records;
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === '\n') starts.push(index + 1);
  return starts;
}

function lineNumberAt(starts, offset) {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= offset) low = middle;
    else high = middle;
  }
  return low + 1;
}

function sourceLocator(text, starts, index, length) {
  const lineStart = lineNumberAt(starts, index);
  const lineEnd = lineNumberAt(starts, Math.max(index, index + length - 1));
  const startOffset = starts[lineStart - 1];
  const endOffset = starts[lineEnd - 1];
  return {
    absoluteOffsetStart: index,
    absoluteOffsetEnd: index + length,
    lineStart,
    lineEnd,
    columnStart: index - startOffset + 1,
    columnEnd: index + length - endOffset + 1
  };
}

function sourceLines(text, sourceHash, contentHash) {
  return String(text).split(/\r?\n/).map((line, index) => ({
    line: index + 1,
    text: line,
    lineContentHash: contentHash({ sourceContentHash: sourceHash, line: index + 1, text: line })
  }));
}

function pageRevision(page) {
  const revision = page?.revisions?.[0];
  return { page, revision, text: sourceContent(revision) };
}

function revisionIdentity(page, revision, text, contentHash) {
  return {
    sourcePageId: Number(page?.pageid),
    sourceTitle: page?.title || null,
    sourceRevision: revision?.revid ? String(revision.revid) : null,
    sourceTimestamp: revision?.timestamp || null,
    sourceUrl: page?.title ? wikiUrl(page.title) : null,
    sourceContentHash: typeof text === 'string' ? contentHash(text) : null,
    sourceContentBytes: typeof text === 'string' ? Buffer.byteLength(text, 'utf8') : 0
  };
}

function directBacklinks(text, primaryTitle) {
  return extractSourceAuthoredMainNamespaceLinks(text).filter(link => link.normalizedTitle === normalizeTitle(primaryTitle));
}

function retainedSource({ page, revision, text, channel, primaryTitle, contentHash }) {
  const identity = revisionIdentity(page, revision, text, contentHash);
  const starts = lineStarts(text);
  const backlinks = directBacklinks(text, primaryTitle).map((link, index) => ({
    occurrence: index + 1,
    requestedTitle: link.requestedTitle,
    rawLink: link.rawLink,
    sourceLocator: sourceLocator(text, starts, link.absoluteOffsetStart, link.absoluteOffsetEnd - link.absoluteOffsetStart)
  }));
  const key = `${channel}:${identity.sourcePageId}:${identity.sourceRevision}`;
  return {
    sourceKey: key,
    discoveryChannel: channel,
    ...identity,
    sourceAuthoredPrimaryBacklinks: backlinks,
    exactRevisionSourceText: text,
    sourceLines: sourceLines(text, identity.sourceContentHash, contentHash),
    completeSourceRetained: typeof text === 'string' && text.length > 0
  };
}

function sameLineSubjectEvidence(text, starts, locator, primaryTitle, canonicalLabel) {
  const lineStartOffset = starts[locator.lineStart - 1];
  const nextLineOffset = starts[locator.lineStart] ?? text.length;
  const exactLine = text.slice(lineStartOffset, nextLineOffset).replace(/\r?\n$/, '');
  const links = extractSourceAuthoredMainNamespaceLinks(exactLine).filter(link => link.normalizedTitle === normalizeTitle(primaryTitle));
  const labelIndex = canonicalLabel ? exactLine.toLocaleLowerCase('en-US').indexOf(String(canonicalLabel).toLocaleLowerCase('en-US')) : -1;
  return {
    exactLine,
    exactPrimaryLinkOccurrences: links.map(link => ({ requestedTitle: link.requestedTitle, rawLink: link.rawLink })),
    exactCanonicalLabelOccurrence: labelIndex >= 0,
    subjectBoundaryComplete: links.length > 0 || labelIndex >= 0
  };
}

function scanSource(source, definitions, primaryTitle, canonicalLabel, contentHash) {
  const text = source.exactRevisionSourceText;
  const masked = maskProtected(text);
  const starts = lineStarts(text);
  const signals = [];
  for (const definition of definitions) {
    const expression = new RegExp(definition.pattern, 'giu');
    let match;
    let occurrence = 0;
    while ((match = expression.exec(masked))) {
      occurrence += 1;
      const locator = sourceLocator(text, starts, match.index, match[0].length);
      const matchedText = text.slice(match.index, match.index + match[0].length);
      const subjectEvidence = sameLineSubjectEvidence(text, starts, locator, primaryTitle, canonicalLabel);
      const evidenceKey = `${source.sourceKey}:${definition.definitionKey}:${locator.absoluteOffsetStart}:${locator.absoluteOffsetEnd}`;
      signals.push({
        evidenceKey,
        definitionKey: definition.definitionKey,
        evidenceDomain: definition.evidenceDomain,
        signalKind: definition.signalKind,
        occurrence,
        matchedText,
        sourceLocator: locator,
        exactLine: subjectEvidence.exactLine,
        exactLineContentHash: contentHash(subjectEvidence.exactLine),
        exactSubjectEvidence: {
          exactPrimaryLinkOccurrences: subjectEvidence.exactPrimaryLinkOccurrences,
          exactCanonicalLabelOccurrence: subjectEvidence.exactCanonicalLabelOccurrence,
          subjectBoundaryComplete: subjectEvidence.subjectBoundaryComplete
        },
        exactPredicateEvidence: { matchedText, predicateBoundaryComplete: true },
        exactSubjectPredicateScopeComplete: subjectEvidence.subjectBoundaryComplete,
        semanticVerdict: null,
        sourcePageId: source.sourcePageId,
        sourceTitle: source.sourceTitle,
        sourceRevision: source.sourceRevision,
        sourceTimestamp: source.sourceTimestamp,
        sourceUrl: source.sourceUrl,
        sourceContentHash: source.sourceContentHash
      });
      if (match[0].length === 0) expression.lastIndex += 1;
    }
  }
  return signals;
}

function buildRecord(input, seedPages, candidatePages, policy, contentHash) {
  const anchors = anchorsFor(input);
  const seedByRevision = new Map(seedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision, text: sourceContent(revision) }])));
  const primaryFetched = seedByRevision.get(anchors.primary.revision);
  const collectionFetched = seedByRevision.get(anchors.collection.revision);
  const primaryHash = typeof primaryFetched?.text === 'string' ? contentHash(primaryFetched.text) : null;
  const primaryVerification = {
    pageId: Number(primaryFetched?.page?.pageid) === anchors.primary.pageId,
    title: normalizeTitle(primaryFetched?.page?.title) === normalizeTitle(anchors.primary.title),
    revision: String(primaryFetched?.revision?.revid || '') === anchors.primary.revision,
    timestamp: primaryFetched?.revision?.timestamp === anchors.primary.timestamp,
    contentHash: primaryHash === anchors.primary.contentHash,
    sourceTextPresent: typeof primaryFetched?.text === 'string' && primaryFetched.text.length > 0
  };
  const collectionVerification = {
    pageId: Number(collectionFetched?.page?.pageid) === anchors.collection.pageId,
    revision: String(collectionFetched?.revision?.revid || '') === anchors.collection.revision,
    sourceTextPresent: typeof collectionFetched?.text === 'string' && collectionFetched.text.length > 0
  };
  const discovered = typeof primaryFetched?.text === 'string' ? extractSourceAuthoredMainNamespaceLinks(primaryFetched.text) : [];
  const discoveredTitles = unique(discovered.map(link => link.normalizedTitle));
  const maximum = policy.sourceDiscovery.maximumDirectMainNamespaceLinks;
  const truncated = discoveredTitles.length > maximum;
  const requested = new Set(discoveredTitles.slice(0, maximum));
  const fetchedCandidateTitles = candidatePages.map(page => normalizeTitle(page.title));
  const missingCandidateFetches = [...requested].filter(title => !fetchedCandidateTitles.includes(title));
  const unexpectedCandidateFetches = fetchedCandidateTitles.filter(title => !requested.has(title));
  const acceptedReciprocal = [];
  for (const page of candidatePages) {
    const { revision, text } = pageRevision(page);
    if (!requested.has(normalizeTitle(page.title)) || Number(page.pageid) === anchors.primary.pageId || typeof text !== 'string' || !revision?.revid) continue;
    if (!directBacklinks(text, anchors.primary.title).length) continue;
    acceptedReciprocal.push(retainedSource({ page, revision, text, channel: 'source_authored_reciprocal_main_namespace_link', primaryTitle: anchors.primary.title, contentHash }));
  }
  const independentSources = [];
  if (collectionFetched?.revision && typeof collectionFetched.text === 'string') {
    independentSources.push(retainedSource({ ...collectionFetched, channel: 'exact_revision_canonical_collection_anchor', primaryTitle: anchors.primary.title, contentHash }));
  }
  independentSources.push(...acceptedReciprocal.sort((a, b) => a.sourcePageId - b.sourcePageId || a.sourceRevision.localeCompare(b.sourceRevision)));
  const signals = independentSources.flatMap(source => scanSource(source, policy.signalDefinitions, anchors.primary.title, input.canonicalActivityIdentity?.canonicalLabel, contentHash));
  const workItems = input.canonicalActivityRepeatabilityGapEvidenceWorkRouting.domainEvidenceWorkItems;
  const domainPackets = policy.requiredEvidenceDomains.map(domainKey => {
    const work = workItems.find(item => item.domainKey === domainKey);
    const candidates = signals.filter(signal => signal.evidenceDomain === domainKey);
    return {
      domainKey,
      evidenceObjective: work?.evidenceObjective || null,
      requiredChannels: work?.requiredChannels || [],
      candidateSignalEvidenceKeys: candidates.map(signal => signal.evidenceKey),
      candidateSignalCount: candidates.length,
      exactSubjectPredicateCandidateCount: candidates.filter(signal => signal.exactSubjectPredicateScopeComplete).length,
      retainedIndependentSourceKeys: independentSources.map(source => source.sourceKey),
      sourceCollectionCompleteForDefinedChannels: !truncated && !missingCandidateFetches.length && !unexpectedCandidateFetches.length && Object.values(primaryVerification).every(Boolean) && Object.values(collectionVerification).every(Boolean),
      evidenceWorkComplete: false,
      resolved: false,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      domainVerdict: null,
      state: candidates.length ? 'unreviewed_revision_pinned_independent_evidence_candidates_require_semantic_disposition' : 'blocked_no_source_located_candidate_in_defined_discovery_channels'
    };
  });
  const { contentHash: sourceRecordHash, contract: _sourceContract, blockers: sourceBlockers = [], state: _sourceState, ...upstream } = input;
  return {
    ...upstream,
    contract: policy.recordContract,
    sourceRepeatabilityGapEvidenceWorkRoutingContentHash: sourceRecordHash,
    independentScopedActivityRepeatabilityEvidence: {
      evidenceState: 'revision_pinned_independent_scoped_activity_repeatability_evidence_collected_review_required',
      primaryLinkDiscoveryAnchor: { ...anchors.primary, verification: primaryVerification },
      canonicalCollectionAnchor: { ...anchors.collection, verification: collectionVerification },
      sourceDiscovery: {
        channels: policy.discoveryChannels,
        discoveredDistinctMainNamespaceLinkCount: discoveredTitles.length,
        requestedCandidateTitleCount: requested.size,
        fetchedCandidatePageCount: candidatePages.length,
        missingCandidateFetches,
        unexpectedCandidateFetches,
        truncated,
        acceptedReciprocalSourceCount: acceptedReciprocal.length,
        acceptedIndependentSourceCount: independentSources.length,
        definedDiscoveryScopeComplete: !truncated && !missingCandidateFetches.length && !unexpectedCandidateFetches.length && Object.values(primaryVerification).every(Boolean) && Object.values(collectionVerification).every(Boolean),
        completeIndependentSourceUniverse: false
      },
      independentSources,
      sourceLocatedCandidateSignals: signals,
      evidenceDomainPackets: domainPackets,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      automaticVerificationApplied: false
    },
    independentScopedActivityRepeatabilityEvidenceReview: {
      state: 'unreviewed_independent_scoped_activity_repeatability_evidence_semantic_disposition_required',
      reviewedDomainCount: 0,
      resolvedDomainCount: 0,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceWorkComplete: false
    },
    blockers: unique([
      ...sourceBlockers,
      'independent_scoped_activity_repeatability_evidence_requires_semantic_disposition',
      'all_repeatability_evidence_domains_remain_unresolved',
      'complete_independent_source_universe_not_established',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'independent_scoped_activity_repeatability_evidence_collected_gates_closed'
  };
}

function accountStateFindings(records) {
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i;
  const findings = [];
  const walk = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push(childPath);
      walk(child, childPath);
    }
  };
  records.forEach((record, index) => walk(record, `[${index}]`));
  return findings;
}

function comparableUpstream(record, input) {
  const ignored = new Set(['contract', 'contentHash', 'blockers', 'state']);
  return Object.fromEntries(Object.keys(input).filter(key => !ignored.has(key)).sort().map(key => [key, record[key]]));
}

function expectedUpstream(input) {
  const ignored = new Set(['contract', 'contentHash', 'blockers', 'state']);
  return Object.fromEntries(Object.keys(input).filter(key => !ignored.has(key)).sort().map(key => [key, input[key]]));
}

export function auditIndependentScopedActivityRepeatabilityEvidence(records = [], { workOrders = [], seedPages = [], candidatePages = [], policy = {}, contentHash } = {}) {
  const compiled = compileIndependentScopedActivityRepeatabilityEvidencePolicy(policy);
  const eligible = selectIndependentScopedActivityRepeatabilityEvidenceWorkOrders(workOrders, policy);
  const requestedSeedRevisions = discoverIndependentScopedActivityRepeatabilitySeedRequests(workOrders, policy).map(request => request.revision);
  const fetchedSeedRevisions = seedPages.flatMap(page => (page.revisions || []).map(revision => String(revision.revid)));
  const missingSeedRevisions = unique(requestedSeedRevisions).filter(revision => !fetchedSeedRevisions.includes(revision));
  const unexpectedSeedRevisions = unique(fetchedSeedRevisions).filter(revision => !requestedSeedRevisions.includes(revision));
  const duplicateFetchedSeedRevisions = duplicates(fetchedSeedRevisions);
  const expected = compiled.valid ? eligible.map(input => buildRecord(input, seedPages, candidatePages, policy, contentHash)) : [];
  const inputKeys = eligible.map(record => record.memberCandidateKey);
  const outputKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const mismatchedRecords = records.filter(record => {
    const match = expected.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !match || contentHash(record) !== contentHash(match);
  }).map(record => record.memberCandidateKey);
  const upstreamMismatches = records.filter(record => {
    const input = eligible.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !input || contentHash(comparableUpstream(record, input)) !== contentHash(expectedUpstream(input));
  }).map(record => record.memberCandidateKey);
  const packetFailures = records.filter(record => {
    const evidence = record.independentScopedActivityRepeatabilityEvidence;
    const packets = evidence?.evidenceDomainPackets || [];
    return packets.length !== REQUIRED_DOMAINS.length
      || packets.some((packet, index) => packet.domainKey !== REQUIRED_DOMAINS[index] || packet.resolved !== false || packet.evidenceWorkComplete !== false || packet.domainVerdict !== null)
      || evidence?.parentActivityRepeatabilityVerdict !== null
      || evidence?.memberTaskRepeatabilityVerdict !== null
      || evidence?.repeatabilityVerdict !== null
      || evidence?.automaticVerificationApplied !== false;
  }).map(record => record.memberCandidateKey);
  const sourceFailures = records.filter(record => (record.independentScopedActivityRepeatabilityEvidence?.independentSources || []).some(source =>
    !source.sourcePageId || !source.sourceTitle || !source.sourceRevision || !source.sourceTimestamp || !source.sourceUrl || !source.sourceContentHash
    || !source.completeSourceRetained || typeof source.exactRevisionSourceText !== 'string' || !source.sourceLines?.length
    || source.sourceLines.length !== source.exactRevisionSourceText.split(/\r?\n/).length
    || (source.discoveryChannel === 'source_authored_reciprocal_main_namespace_link' && !source.sourceAuthoredPrimaryBacklinks?.length)
  )).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.optimizerEligible !== false
    || record.memberExpansionReview?.state === 'reviewed'
    || record.mechanicsReview?.state === 'reviewed'
    || record.independentScopedActivityRepeatabilityEvidenceReview?.evidenceWorkComplete !== false
  ).map(record => record.memberCandidateKey);
  const accountFindings = accountStateFindings(records);
  const discoveryIncomplete = records.filter(record => record.independentScopedActivityRepeatabilityEvidence?.sourceDiscovery?.definedDiscoveryScopeComplete !== true).map(record => record.memberCandidateKey);
  const blockers = [];
  if (!compiled.valid) blockers.push('independent_repeatability_evidence_policy_invalid_or_activity_specific');
  if (workOrders.length !== eligible.length || duplicateInputKeys.length) blockers.push('input_work_order_set_is_not_exactly_eligible_and_unique');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) blockers.push('input_output_work_order_set_mismatch');
  if (mismatchedRecords.length) blockers.push('one_or_more_records_do_not_match_revision_pinned_sources_and_policy');
  if (upstreamMismatches.length) blockers.push('input_evidence_or_prior_disposition_context_changed');
  if (packetFailures.length) blockers.push('domain_packet_or_repeatability_verdict_invariant_failed');
  if (sourceFailures.length) blockers.push('one_or_more_retained_independent_sources_are_not_complete_and_revision_pinned');
  if (missingSeedRevisions.length || unexpectedSeedRevisions.length || duplicateFetchedSeedRevisions.length) blockers.push('exact_pinned_anchor_revision_fetch_set_mismatch');
  if (unsupportedPromotions.length) blockers.push('unsupported_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  if (discoveryIncomplete.length) blockers.push('defined_independent_source_discovery_scope_incomplete');
  const publishable = blockers.length === 0;
  const allSources = records.flatMap(record => record.independentScopedActivityRepeatabilityEvidence?.independentSources || []);
  const allSignals = records.flatMap(record => record.independentScopedActivityRepeatabilityEvidence?.sourceLocatedCandidateSignals || []);
  const allPackets = records.flatMap(record => record.independentScopedActivityRepeatabilityEvidence?.evidenceDomainPackets || []);
  return {
    contract: policy.auditContract,
    inputCoverage: { inputWorkOrderCount: workOrders.length, eligibleWorkOrderCount: eligible.length, outputRecordCount: records.length, duplicateInputKeys, duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys },
    policyCoverage: { ...compiled, signalDefinitionCount: policy.signalDefinitions?.length || 0, requiredEvidenceDomainCount: policy.requiredEvidenceDomains?.length || 0, discoveryChannelCount: policy.discoveryChannels?.length || 0 },
    revisionCoverage: { requestedSeedRevisions, fetchedSeedRevisions, missingSeedRevisions, unexpectedSeedRevisions, duplicateFetchedSeedRevisions, retainedIndependentSourceCount: allSources.length, distinctRetainedRevisionCount: unique(allSources.map(source => `${source.sourcePageId}:${source.sourceRevision}`)).length, completeRevisionPinnedSourceCount: allSources.filter(source => source.completeSourceRetained).length, sourceFailures },
    discoveryCoverage: { exactCollectionAnchorSourceCount: allSources.filter(source => source.discoveryChannel === 'exact_revision_canonical_collection_anchor').length, reciprocalSourceCount: allSources.filter(source => source.discoveryChannel === 'source_authored_reciprocal_main_namespace_link').length, discoveryIncomplete },
    packetCoverage: { requiredDomainPacketCount: records.length * REQUIRED_DOMAINS.length, domainPacketCount: allPackets.length, candidateSignalCount: allSignals.length, exactSubjectPredicateCandidateCount: allSignals.filter(signal => signal.exactSubjectPredicateScopeComplete).length, resolvedDomainCount: allPackets.filter(packet => packet.resolved).length, packetFailures },
    semanticPreservationCoverage: { mismatchedRecords, upstreamMismatches, unsupportedPromotions, parentAndMemberRepeatabilitySeparatedCount: records.filter(record => record.independentScopedActivityRepeatabilityEvidence?.parentActivityRepeatabilityVerdict === null && record.independentScopedActivityRepeatabilityEvidence?.memberTaskRepeatabilityVerdict === null).length },
    accountStateFindings: accountFindings,
    evidencePacketAttemptCoverageComplete: publishable && records.length === eligible.length,
    independentEvidenceDiscoveryScopeComplete: publishable && !discoveryIncomplete.length,
    repeatabilityReviewComplete: false,
    memberExpansionComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligibleCount: 0,
    completeIndependentSourceUniverse: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      'independent_scoped_activity_repeatability_evidence_requires_semantic_disposition',
      'all_repeatability_evidence_domains_remain_unresolved',
      'complete_independent_source_universe_not_established',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildIndependentScopedActivityRepeatabilityEvidence({ workOrders = [], seedPages = [], candidatePages = [], policy = {}, contentHash }) {
  const compiled = compileIndependentScopedActivityRepeatabilityEvidencePolicy(policy);
  const records = compiled.valid
    ? selectIndependentScopedActivityRepeatabilityEvidenceWorkOrders(workOrders, policy).map(input => buildRecord(input, seedPages, candidatePages, policy, contentHash))
    : [];
  return { records, audit: auditIndependentScopedActivityRepeatabilityEvidence(records, { workOrders, seedPages, candidatePages, policy, contentHash }) };
}
