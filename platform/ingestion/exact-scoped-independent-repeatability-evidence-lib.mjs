const DOMAINS = [
  'parent_activity_post_completion_reassignment_or_restart',
  'member_task_reselection_and_repeatability',
  'cooldown_reset_daily_or_session_limits',
  'finite_exhaustion_one_time_or_completion_lockout',
  'availability_and_assignment_eligibility_across_sessions',
  'independent_source_corroboration_or_conflict'
];

const CHANNELS = [
  'complete_main_namespace_backlinks_to_exact_parent_title',
  'complete_exact_parent_label_wiki_search'
];

const REQUIRED_RULES = [
  'oneEvidenceRecordPerEligibleWorkOrder',
  'allSixDomainPacketsAlwaysExist',
  'bothDiscoveryChannelsMustRunToCompletion',
  'everyCandidateSourceMustBeRevisionPinnedWithCompleteTextAndLineHashes',
  'exactSourceAuthoredSubjectLinkAndPredicateMustShareOneSourceLine',
  'searchSnippetsAndBacklinkMetadataAreDiscoveryOnly',
  'parentAndMemberEvidenceObligationsRemainSeparate',
  'unreviewedMemberSubjectsCannotSatisfyMemberDomains',
  'candidateSignalsDoNotResolveDomainsOrCreateVerdicts',
  'absenceOfCandidateSignalsIsNotNegativeEvidence',
  'discoveryScopeCompletenessDoesNotProveCompleteIndependentSourceUniverse',
  'inputEvidenceAndAllPriorDispositionsMustBePreserved',
  'memberMechanicsAndOptimizerPromotionAreForbidden',
  'currentAccountStateIsForbidden'
];

const normalizeTitle = value => String(value || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replace(/ /g, '_')).replace(/%2F/gi, '/')}`;
const unique = values => [...new Set(values)];
const duplicates = values => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
const sourceContent = page => page?.revisions?.[0]?.slots?.main?.content;
const sourceRevision = page => page?.revisions?.[0];

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbiddenKey = /(?:override|exception|allowlist|denylist|memberCandidateKey|canonicalActivityKey|pageId|sourceTitle|activityName)/i;
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbiddenKey.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  walk(policy);
  return findings;
}

export function compileExactScopedIndependentRepeatabilityEvidencePolicy(policy = {}) {
  const definitions = policy.predicateDefinitions || [];
  const invalidDomains = DOMAINS.filter((domain, index) => policy.requiredEvidenceDomains?.[index] !== domain);
  const invalidChannels = CHANNELS.filter((channel, index) => policy.discoveryChannels?.[index] !== channel);
  const duplicateDefinitions = duplicates(definitions.map(definition => definition.definitionKey));
  const invalidDefinitions = [
    ...(definitions.length === DOMAINS.length ? [] : ['definition_count']),
    ...DOMAINS.filter((domain, index) => definitions[index]?.evidenceDomain !== domain).map(domain => `domain_order:${domain}`),
    ...definitions.filter(definition => !definition.definitionKey || !DOMAINS.includes(definition.evidenceDomain)
      || !['canonical_parent', 'reviewed_member', 'canonical_parent_or_reviewed_member'].includes(definition.subjectKind)
      || !definition.pattern).map(definition => definition.definitionKey || 'unnamed')
  ];
  const invalidPatterns = definitions.filter(definition => {
    try { new RegExp(definition.pattern, 'giu'); return false; } catch { return true; }
  }).map(definition => definition.definitionKey);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidDiscovery = [];
  if (policy.sourceDiscovery?.namespace !== 0) invalidDiscovery.push('namespace');
  if (!Number.isInteger(policy.sourceDiscovery?.maximumDistinctCandidateTitles) || policy.sourceDiscovery.maximumDistinctCandidateTitles < 1) invalidDiscovery.push('maximumDistinctCandidateTitles');
  for (const key of ['requireCompleteApiContinuation', 'excludePrimarySubjectPage', 'excludeCanonicalCollectionPage', 'redirectPagesAreExcluded', 'candidatePagesMustRetainCurrentObservedRevision', 'candidateSourcesMustBeIndependentOfPrimaryAndCollectionSources']) {
    if (policy.sourceDiscovery?.[key] !== true) invalidDiscovery.push(key);
  }
  const forbiddenPaths = forbiddenPolicyPaths(policy);
  const valid = policy.inputContract === 'sensum.exact-scoped-independent-repeatability-evidence-work-routing.v1'
    && policy.recordContract === 'sensum.exact-scoped-independent-repeatability-evidence.v1'
    && policy.auditContract === 'sensum.exact-scoped-independent-repeatability-evidence-audit.v1'
    && policy.inputState === 'exact_scoped_independent_repeatability_evidence_work_routed_gates_closed'
    && policy.inputRouteKey === 'collect_revision_pinned_exact_subject_predicate_independent_scoped_activity_repeatability_evidence'
    && policy.inputRouteState === 'blocked_exact_subject_predicate_independent_evidence_gap'
    && !invalidDomains.length && policy.requiredEvidenceDomains?.length === DOMAINS.length
    && !invalidChannels.length && policy.discoveryChannels?.length === CHANNELS.length
    && !invalidDefinitions.length && !duplicateDefinitions.length && !invalidPatterns.length
    && !invalidRules.length && !invalidDiscovery.length && !forbiddenPaths.length;
  return { invalidDomains, invalidChannels, invalidDefinitions, duplicateDefinitions, invalidPatterns, invalidRules, invalidDiscovery, forbiddenPaths, valid };
}

function eligible(record, policy) {
  const route = record.exactScopedIndependentRepeatabilityEvidenceWorkRouting;
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && route?.routeKey === policy.inputRouteKey
    && route?.routeState === policy.inputRouteState
    && route?.sameLineExactSubjectPredicateRequired === true
    && route?.crossLineCrossSectionCrossPageAndCrossSourceJoinsAllowed === false
    && route?.evidenceWorkComplete === false
    && DOMAINS.every((domain, index) => route.requiredEvidenceDomains?.[index] === domain
      && route.domainEvidenceWorkItems?.[index]?.domainKey === domain
      && route.domainEvidenceWorkItems[index].requireExactSameLineSubjectPredicateScope === true
      && route.domainEvidenceWorkItems[index].crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed === false
      && route.domainEvidenceWorkItems[index].evidenceWorkComplete === false);
}

export function selectExactScopedIndependentRepeatabilityEvidenceWorkOrders(records = [], policy = {}) {
  return records.filter(record => eligible(record, policy));
}

function parentIdentity(record) {
  const binding = record.canonicalActivitySubjectBinding?.sourcePageIdentity || {};
  return {
    canonicalActivityKey: record.canonicalActivityIdentity?.canonicalActivityKey || null,
    canonicalLabel: record.canonicalActivityIdentity?.canonicalLabel || null,
    sourceTitle: binding.resolvedTitle || record.sourceTitle || null,
    sourcePageId: Number(binding.sourcePageId || record.sourcePageId || 0) || null,
    collectionPageId: Number(record.canonicalActivityIdentity?.stableIdentityAnchor?.collectionPageId || 0) || null
  };
}

export function discoverExactScopedIndependentRepeatabilityEvidenceRequests(workOrders = [], policy = {}) {
  return selectExactScopedIndependentRepeatabilityEvidenceWorkOrders(workOrders, policy).map(record => {
    const parent = parentIdentity(record);
    return {
      memberCandidateKey: record.memberCandidateKey,
      canonicalActivityKey: parent.canonicalActivityKey,
      exactParentTitle: parent.sourceTitle,
      exactParentLabel: parent.canonicalLabel,
      namespace: policy.sourceDiscovery.namespace,
      maximumDistinctCandidateTitles: policy.sourceDiscovery.maximumDistinctCandidateTitles,
      channels: policy.discoveryChannels
    };
  });
}

function reviewedMembers(record) {
  const review = record.memberExpansionReview;
  if (review?.state !== 'reviewed') return [];
  const members = review.reviewedMembers || review.members || review.memberIdentities || [];
  return members.filter(member => member?.reviewed === true || member?.state === 'reviewed' || member?.state === 'source_supported')
    .map(member => ({
      subjectKey: member.canonicalMemberKey || member.memberKey || member.canonicalActivityKey || null,
      label: member.canonicalLabel || member.label || member.name || null,
      title: member.sourceTitle || member.resolvedTitle || member.canonicalLabel || member.label || member.name || null
    }))
    .filter(member => member.subjectKey && member.label && member.title)
    .sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
}

function exactLinks(line) {
  const links = [];
  const expression = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/giu;
  for (const match of line.matchAll(expression)) {
    links.push({
      rawLink: match[0],
      requestedTitle: match[1].trim(),
      displayText: match[2]?.trim() || null,
      columnStart: match.index + 1,
      columnEnd: match.index + match[0].length
    });
  }
  return links;
}

function subjectLinks(line, subjects) {
  return exactLinks(line).flatMap(link => subjects.filter(subject => normalizeTitle(link.requestedTitle) === normalizeTitle(subject.title)).map(subject => ({ ...subject, link })));
}

function linesOf(text, contentHash) {
  return text.split(/\r?\n/).map((line, index) => ({ line: index + 1, text: line, contentHash: contentHash(line) }));
}

function retainedSource(page, channels, contentHash) {
  const revision = sourceRevision(page);
  const text = sourceContent(page);
  return {
    sourceKey: `wiki:${page.pageid}:${revision.revid}`,
    discoveryChannels: [...channels].sort(),
    sourcePageId: page.pageid,
    sourceTitle: page.title,
    sourceRevision: String(revision.revid),
    sourceTimestamp: revision.timestamp,
    sourceUrl: wikiUrl(page.title),
    sourceContentHash: contentHash(text),
    sourceContentBytes: Buffer.byteLength(text, 'utf8'),
    exactRevisionSourceText: text,
    sourceLines: linesOf(text, contentHash),
    completeSourceRetained: true
  };
}

function scanSource(source, definitions, parent, members, contentHash) {
  const signals = [];
  for (const definition of definitions) {
    const subjects = definition.subjectKind === 'canonical_parent' ? [parent]
      : definition.subjectKind === 'reviewed_member' ? members
        : [parent, ...members];
    if (!subjects.length) continue;
    const expression = new RegExp(definition.pattern, 'giu');
    for (const line of source.sourceLines) {
      const clean = line.text.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/giu, '').replace(/<ref\b[^/>]*\/>/giu, '');
      const exactSubjects = subjectLinks(clean, subjects);
      if (!exactSubjects.length) continue;
      expression.lastIndex = 0;
      for (const match of clean.matchAll(expression)) {
        for (const subject of exactSubjects) {
          signals.push({
            evidenceKey: `${source.sourceKey}:line-${line.line}:${definition.evidenceDomain}:${definition.definitionKey}:${subject.subjectKey}`,
            evidenceDomain: definition.evidenceDomain,
            definitionKey: definition.definitionKey,
            subjectKind: definition.subjectKind,
            exactSubject: { subjectKey: subject.subjectKey, label: subject.label, title: subject.title, sourceAuthoredLink: subject.link },
            exactPredicate: { matchedText: match[0], columnStart: match.index + 1, columnEnd: match.index + match[0].length },
            sourceLocator: { lineStart: line.line, lineEnd: line.line },
            exactLine: line.text,
            exactLineContentHash: contentHash(line.text),
            exactSubjectPredicateScopeComplete: true,
            semanticVerdict: null,
            sourcePageId: source.sourcePageId,
            sourceTitle: source.sourceTitle,
            sourceRevision: source.sourceRevision,
            sourceTimestamp: source.sourceTimestamp,
            sourceUrl: source.sourceUrl,
            sourceContentHash: source.sourceContentHash
          });
        }
      }
    }
  }
  return signals.sort((a, b) => a.evidenceKey.localeCompare(b.evidenceKey));
}

function discoveryFor(record, discoveryRecords) {
  return discoveryRecords.find(discovery => discovery.memberCandidateKey === record.memberCandidateKey);
}

function candidateTitles(discovery) {
  return unique([...(discovery?.backlinkTitles || []), ...(discovery?.searchTitles || [])]).sort((a, b) => normalizeTitle(a).localeCompare(normalizeTitle(b)));
}

function buildRecord(input, discoveryRecords, candidatePages, policy, contentHash) {
  const discovery = discoveryFor(input, discoveryRecords);
  const parentBase = parentIdentity(input);
  const parent = { subjectKey: parentBase.canonicalActivityKey, label: parentBase.canonicalLabel, title: parentBase.sourceTitle };
  const members = reviewedMembers(input);
  const requestedTitles = candidateTitles(discovery);
  const requested = new Set(requestedTitles.map(normalizeTitle));
  const primaryAndCollection = new Set([parentBase.sourcePageId, parentBase.collectionPageId].filter(Boolean));
  const channelByTitle = new Map(requestedTitles.map(title => [normalizeTitle(title), [
    ...(discovery?.backlinkTitles?.some(value => normalizeTitle(value) === normalizeTitle(title)) ? [CHANNELS[0]] : []),
    ...(discovery?.searchTitles?.some(value => normalizeTitle(value) === normalizeTitle(title)) ? [CHANNELS[1]] : [])
  ]]));
  const retainedSources = candidatePages
    .filter(page => requested.has(normalizeTitle(page.title)) && !page.missing && !primaryAndCollection.has(Number(page.pageid)))
    .filter(page => typeof sourceContent(page) === 'string' && sourceContent(page).length > 0 && !/^\s*#redirect\b/iu.test(sourceContent(page)))
    .map(page => retainedSource(page, channelByTitle.get(normalizeTitle(page.title)) || [], contentHash))
    .sort((a, b) => a.sourcePageId - b.sourcePageId || a.sourceRevision.localeCompare(b.sourceRevision));
  const signals = retainedSources.flatMap(source => scanSource(source, policy.predicateDefinitions, parent, members, contentHash));
  const discoveryComplete = discovery?.backlinkContinuationComplete === true && discovery?.searchContinuationComplete === true && discovery?.truncated !== true;
  const workItems = input.exactScopedIndependentRepeatabilityEvidenceWorkRouting.domainEvidenceWorkItems;
  const packets = DOMAINS.map(domainKey => {
    const work = workItems.find(item => item.domainKey === domainKey);
    const candidates = signals.filter(signal => signal.evidenceDomain === domainKey);
    const needsMember = policy.predicateDefinitions.find(definition => definition.evidenceDomain === domainKey)?.subjectKind === 'reviewed_member';
    return {
      domainKey,
      evidenceObjective: work?.evidenceObjective || null,
      requiredChannels: work?.requiredChannels || [],
      reviewedMemberSubjectCount: members.length,
      candidateSignalEvidenceKeys: candidates.map(signal => signal.evidenceKey),
      exactSameLineSubjectPredicateCandidateCount: candidates.length,
      retainedIndependentSourceKeys: retainedSources.map(source => source.sourceKey),
      sourceDiscoveryCompleteForDefinedChannels: discoveryComplete,
      evidenceWorkComplete: false,
      resolved: false,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      domainVerdict: null,
      state: needsMember && !members.length ? 'blocked_no_reviewed_member_subject'
        : candidates.length ? 'unreviewed_exact_same_line_subject_predicate_candidates_require_semantic_disposition'
          : 'blocked_no_exact_same_line_subject_predicate_candidate_in_defined_channels'
    };
  });
  const { contentHash: inputContentHash, contract: _contract, blockers: inputBlockers = [], state: _state, ...upstream } = input;
  return {
    ...upstream,
    contract: policy.recordContract,
    sourceExactScopedIndependentRepeatabilityEvidenceWorkRoutingContentHash: inputContentHash,
    exactScopedIndependentRepeatabilityEvidence: {
      evidenceState: 'revision_pinned_exact_scoped_independent_repeatability_evidence_collected_review_required',
      parentSubject: parent,
      reviewedMemberSubjects: members,
      discovery: {
        channels: policy.discoveryChannels,
        backlinkTitleCount: discovery?.backlinkTitles?.length || 0,
        searchTitleCount: discovery?.searchTitles?.length || 0,
        distinctCandidateTitleCount: requestedTitles.length,
        requestedCandidateTitles: requestedTitles,
        backlinkContinuationComplete: discovery?.backlinkContinuationComplete === true,
        searchContinuationComplete: discovery?.searchContinuationComplete === true,
        truncated: discovery?.truncated === true,
        definedDiscoveryChannelsComplete: discoveryComplete,
        completeIndependentSourceUniverse: false
      },
      independentSources: retainedSources,
      exactSameLineSubjectPredicateCandidateSignals: signals,
      evidenceDomainPackets: packets,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      automaticVerificationApplied: false
    },
    exactScopedIndependentRepeatabilityEvidenceReview: {
      state: 'unreviewed_exact_scoped_independent_repeatability_evidence_semantic_disposition_required',
      reviewedDomainCount: 0,
      resolvedDomainCount: 0,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceWorkComplete: false
    },
    blockers: unique([
      ...inputBlockers,
      'exact_scoped_independent_repeatability_evidence_requires_semantic_disposition',
      'all_repeatability_evidence_domains_remain_unresolved',
      'complete_independent_source_universe_not_established',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: 'exact_scoped_independent_repeatability_evidence_collected_gates_closed'
  };
}

function accountStateFindings(records) {
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i;
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

export function auditExactScopedIndependentRepeatabilityEvidence(records = [], { workOrders = [], discoveryRecords = [], candidatePages = [], policy = {}, contentHash } = {}) {
  const compiled = compileExactScopedIndependentRepeatabilityEvidencePolicy(policy);
  const eligibleRecords = selectExactScopedIndependentRepeatabilityEvidenceWorkOrders(workOrders, policy);
  const expected = compiled.valid ? eligibleRecords.map(input => buildRecord(input, discoveryRecords, candidatePages, policy, contentHash)) : [];
  const inputKeys = eligibleRecords.map(record => record.memberCandidateKey);
  const outputKeys = records.map(record => record.memberCandidateKey);
  const discoveryKeys = discoveryRecords.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const duplicateDiscoveryKeys = duplicates(discoveryKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const missingDiscoveryKeys = inputKeys.filter(key => !discoveryKeys.includes(key));
  const unexpectedDiscoveryKeys = discoveryKeys.filter(key => !inputKeys.includes(key));
  const discoveryIncomplete = discoveryRecords.filter(record => record.backlinkContinuationComplete !== true || record.searchContinuationComplete !== true || record.truncated === true).map(record => record.memberCandidateKey);
  const requestedTitles = unique(discoveryRecords.flatMap(candidateTitles));
  const fetchedTitles = candidatePages.map(page => page.title);
  const missingCandidatePages = requestedTitles.filter(title => !fetchedTitles.some(fetched => normalizeTitle(fetched) === normalizeTitle(title)));
  const unexpectedCandidatePages = fetchedTitles.filter(title => !requestedTitles.some(requested => normalizeTitle(requested) === normalizeTitle(title)));
  const duplicateCandidatePages = duplicates(fetchedTitles.map(normalizeTitle));
  const revisionFailures = candidatePages.filter(page => page.missing || !page.pageid || !sourceRevision(page)?.revid || !sourceRevision(page)?.timestamp || typeof sourceContent(page) !== 'string').map(page => page.title);
  const mismatchedRecords = records.filter(record => {
    const match = expected.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !match || contentHash(record) !== contentHash(match);
  }).map(record => record.memberCandidateKey);
  const upstreamMismatches = records.filter(record => {
    const input = eligibleRecords.find(item => item.memberCandidateKey === record.memberCandidateKey);
    return !input || contentHash(comparableUpstream(record, input)) !== contentHash(expectedUpstream(input));
  }).map(record => record.memberCandidateKey);
  const packetFailures = records.filter(record => {
    const evidence = record.exactScopedIndependentRepeatabilityEvidence;
    const packets = evidence?.evidenceDomainPackets || [];
    return packets.length !== DOMAINS.length
      || packets.some((packet, index) => packet.domainKey !== DOMAINS[index] || packet.resolved !== false || packet.evidenceWorkComplete !== false || packet.domainVerdict !== null)
      || evidence?.parentActivityRepeatabilityVerdict !== null || evidence?.memberTaskRepeatabilityVerdict !== null
      || evidence?.repeatabilityVerdict !== null || evidence?.automaticVerificationApplied !== false;
  }).map(record => record.memberCandidateKey);
  const sourceFailures = records.filter(record => (record.exactScopedIndependentRepeatabilityEvidence?.independentSources || []).some(source =>
    !source.sourcePageId || !source.sourceTitle || !source.sourceRevision || !source.sourceTimestamp || !source.sourceUrl || !source.sourceContentHash
    || source.completeSourceRetained !== true || typeof source.exactRevisionSourceText !== 'string' || !source.sourceLines?.length
    || source.sourceLines.length !== source.exactRevisionSourceText.split(/\r?\n/).length
  )).map(record => record.memberCandidateKey);
  const signalFailures = records.filter(record => (record.exactScopedIndependentRepeatabilityEvidence?.exactSameLineSubjectPredicateCandidateSignals || []).some(signal =>
    signal.exactSubjectPredicateScopeComplete !== true || !signal.exactSubject?.sourceAuthoredLink?.rawLink
    || !signal.exactPredicate?.matchedText || signal.sourceLocator?.lineStart !== signal.sourceLocator?.lineEnd
    || !signal.exactLine || !signal.exactLineContentHash || signal.semanticVerdict !== null
  )).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => record.optimizerEligible !== false
    || record.mechanicsReview?.state === 'reviewed'
    || record.exactScopedIndependentRepeatabilityEvidenceReview?.evidenceWorkComplete !== false).map(record => record.memberCandidateKey);
  const accountFindings = accountStateFindings(records);
  const blockers = [];
  if (!compiled.valid) blockers.push('exact_scoped_independent_evidence_policy_invalid_or_activity_specific');
  if (workOrders.length !== eligibleRecords.length || duplicateInputKeys.length) blockers.push('input_work_order_set_is_not_exactly_eligible_and_unique');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) blockers.push('input_output_work_order_set_mismatch');
  if (duplicateDiscoveryKeys.length || missingDiscoveryKeys.length || unexpectedDiscoveryKeys.length || discoveryIncomplete.length) blockers.push('exact_scoped_discovery_channels_incomplete_or_mismatched');
  if (missingCandidatePages.length || unexpectedCandidatePages.length || duplicateCandidatePages.length || revisionFailures.length) blockers.push('candidate_revision_fetch_set_incomplete_or_mismatched');
  if (mismatchedRecords.length) blockers.push('one_or_more_records_do_not_match_revision_pinned_sources_and_policy');
  if (upstreamMismatches.length) blockers.push('input_evidence_or_prior_disposition_context_changed');
  if (packetFailures.length) blockers.push('domain_packet_or_repeatability_verdict_invariant_failed');
  if (sourceFailures.length) blockers.push('one_or_more_retained_sources_are_not_complete_and_revision_pinned');
  if (signalFailures.length) blockers.push('one_or_more_candidate_signals_lack_exact_same_line_subject_predicate_scope');
  if (unsupportedPromotions.length) blockers.push('unsupported_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = blockers.length === 0;
  const sources = records.flatMap(record => record.exactScopedIndependentRepeatabilityEvidence?.independentSources || []);
  const signals = records.flatMap(record => record.exactScopedIndependentRepeatabilityEvidence?.exactSameLineSubjectPredicateCandidateSignals || []);
  const packets = records.flatMap(record => record.exactScopedIndependentRepeatabilityEvidence?.evidenceDomainPackets || []);
  return {
    contract: policy.auditContract,
    inputCoverage: { inputWorkOrderCount: workOrders.length, eligibleWorkOrderCount: eligibleRecords.length, outputRecordCount: records.length, duplicateInputKeys, duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys },
    policyCoverage: { ...compiled, predicateDefinitionCount: policy.predicateDefinitions?.length || 0, requiredEvidenceDomainCount: policy.requiredEvidenceDomains?.length || 0, discoveryChannelCount: policy.discoveryChannels?.length || 0 },
    discoveryCoverage: { discoveryRecordCount: discoveryRecords.length, duplicateDiscoveryKeys, missingDiscoveryKeys, unexpectedDiscoveryKeys, discoveryIncomplete, backlinkCandidateTitleCount: unique(discoveryRecords.flatMap(record => record.backlinkTitles || [])).length, exactSearchCandidateTitleCount: unique(discoveryRecords.flatMap(record => record.searchTitles || [])).length, distinctCandidateTitleCount: requestedTitles.length },
    revisionCoverage: { requestedCandidateTitleCount: requestedTitles.length, fetchedCandidatePageCount: candidatePages.length, missingCandidatePages, unexpectedCandidatePages, duplicateCandidatePages, revisionFailures, retainedIndependentSourceCount: sources.length, distinctRetainedRevisionCount: unique(sources.map(source => `${source.sourcePageId}:${source.sourceRevision}`)).length },
    packetCoverage: { requiredDomainPacketCount: records.length * DOMAINS.length, domainPacketCount: packets.length, exactSameLineSubjectPredicateCandidateCount: signals.length, domainsWithCandidateCount: unique(signals.map(signal => signal.evidenceDomain)).length, reviewedMemberSubjectCount: records.reduce((sum, record) => sum + (record.exactScopedIndependentRepeatabilityEvidence?.reviewedMemberSubjects?.length || 0), 0), resolvedDomainCount: packets.filter(packet => packet.resolved).length, packetFailures, signalFailures },
    semanticPreservationCoverage: { mismatchedRecords, upstreamMismatches, unsupportedPromotions, parentAndMemberRepeatabilitySeparatedCount: records.filter(record => record.exactScopedIndependentRepeatabilityEvidence?.parentActivityRepeatabilityVerdict === null && record.exactScopedIndependentRepeatabilityEvidence?.memberTaskRepeatabilityVerdict === null).length },
    accountStateFindings: accountFindings,
    evidencePacketAttemptCoverageComplete: publishable && records.length === eligibleRecords.length,
    exactScopedDiscoveryChannelsComplete: publishable && !discoveryIncomplete.length,
    repeatabilityReviewComplete: false,
    memberExpansionComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligibleCount: 0,
    completeIndependentSourceUniverse: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers, 'exact_scoped_independent_repeatability_evidence_requires_semantic_disposition', 'all_repeatability_evidence_domains_remain_unresolved', 'complete_independent_source_universe_not_established', 'member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable
  };
}

export function buildExactScopedIndependentRepeatabilityEvidence({ workOrders = [], discoveryRecords = [], candidatePages = [], policy = {}, contentHash }) {
  const compiled = compileExactScopedIndependentRepeatabilityEvidencePolicy(policy);
  const records = compiled.valid ? selectExactScopedIndependentRepeatabilityEvidenceWorkOrders(workOrders, policy).map(input => buildRecord(input, discoveryRecords, candidatePages, policy, contentHash)) : [];
  return { records, audit: auditExactScopedIndependentRepeatabilityEvidence(records, { workOrders, discoveryRecords, candidatePages, policy, contentHash }) };
}
