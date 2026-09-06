import { hash, json } from './lib.mjs';

const REQUIRED_RULES = [
  'inputAuditAndSnapshotMustBeExplicitAndRevalidated',
  'onlyTheSixExactRewardBlockersMayBeDiscovered',
  'everyDomainMustHaveBoundQueries',
  'everyDeclaredQueryMustRunExactlyOnce',
  'currentWikiNamespaceRegistryMustMatchDeclaredChannels',
  'queryNamespaceMustMatchItsDeclaredChannel',
  'everyQueryMustCompleteWithinTheDeclaredBound',
  'everyReturnedPageMustResolveToItsCurrentRevisionAndExactTitle',
  'searchSnippetsRanksAndAbsenceAreNotGameFacts',
  'talkAndEditorMaterialAreNeverMechanicalAuthority',
  'updateArchiveEvidenceCannotEstablishCurrentStateAlone',
  'sourceCodeEvidenceRequiresIndependentSemanticReview',
  'signalsOnlyRouteManualReviewOrAdditionalEvidenceWork',
  'blockersFactsMechanicsAndOptimizerStateCannotChange',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];
const EXPECTED_CHANNELS = [
  { channelKey: 'article', namespaces: [0], namespaceNames: ['Main'], authorityClass: 'current_article' },
  { channelKey: 'update', namespaces: [112], namespaceNames: ['Update'], authorityClass: 'historical_update_archive' },
  { channelKey: 'talk', namespaces: [1], namespaceNames: ['Talk'], authorityClass: 'experimental_discussion' },
  { channelKey: 'source_code', namespaces: [10, 116, 828], namespaceNames: ['Template', 'Calculator', 'Module'], authorityClass: 'implementation_or_template_source' }
];
const EXPECTED_FIELDS = ['termites', 'bone_shards'];
const EXPECTED_SIGNAL_KINDS = new Set([
  'potential_exact_spawn_rate', 'explicit_unknown_spawn_rate',
  'experimental_per_completion_average', 'current_scoop_range',
  'hourly_reward_claim', 'course_duration_or_lap_context',
  'potential_reward_reconciliation', 'official_relative_reward_adjustment'
]);
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const excerpt = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 700);
const recordsHash = records => hash(`${records.map(record => json(record)).join('\n')}\n`);
const accountKey = key => /^(?:account|accountState|accountSnapshot|player|playerState|username|profile|currentBaseLevel|currentLevel|currentXp|bank|owned|ownedItems|ownedEquipment|inventory|budget|preferences|completedQuests)$/i.test(key);

function accountFindings(values = []) {
  const findings = [];
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (accountKey(key)) findings.push(next);
      visit(child, next);
    }
  };
  values.forEach((value, index) => visit(value, `[${index}]`));
  return sorted(unique(findings));
}

function recordHashesValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && validHash(record?.contentHash)
    && record.recordContentHash === contentHash(without(record, ['recordContentHash', 'contentHash']))
    && record.contentHash === contentHash(without(record, ['contentHash']));
}

function policyCoverage(policy = {}) {
  const expectedBindings = {
    policy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-policy.v1',
    inputAuditContract: 'sensum.agility-colossal-wyrm-obsolete-notice-field-reconciliation-audit.v1',
    inputSnapshotDomain: 'agility-colossal-wyrm-obsolete-notice-field-reconciliation',
    inputRecordContract: 'sensum.agility-colossal-wyrm-obsolete-notice-field-reconciliation.v1',
    recordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery.v1',
    auditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-audit.v1',
    outputDomain: 'agility-colossal-wyrm-termite-reward-rate-source-discovery',
    searchApiOrigin: 'https://oldschool.runescape.wiki/api.php',
    searchResultLimitPerQuery: 50
  };
  const invalidBindings = Object.entries(expectedBindings).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const channelsExact = same(policy.channels, EXPECTED_CHANNELS);
  const domains = policy.domains || [];
  const domainBlockers = domains.map(domain => domain.blocker);
  const fieldsExact = same(sorted(unique(domains.map(domain => domain.field))), sorted(EXPECTED_FIELDS));
  const routesValid = domains.every(domain => ['basic_route', 'advanced_route'].includes(domain.route));
  const domainsValid = domains.length === 6 && unique(domainBlockers).length === 6 && fieldsExact && routesValid
    && domains.every(domain => domain.blocker && domain.signalKinds?.length && domain.signalKinds.every(kind => EXPECTED_SIGNAL_KINDS.has(kind)));
  const channels = new Map((policy.channels || []).map(channel => [channel.channelKey, channel]));
  const queryKeys = (policy.queries || []).map(query => query.queryKey);
  const queriesValid = policy.queries?.length === 16 && unique(queryKeys).length === queryKeys.length
    && policy.queries.every(query => query.queryKey && query.searchText && channels.has(query.channelKey)
      && query.boundBlockers?.length && query.boundBlockers.every(blocker => domainBlockers.includes(blocker)));
  const everyDomainBound = domainBlockers.every(blocker => policy.queries?.some(query => query.boundBlockers.includes(blocker)));
  const exclusionPatternsValid = (policy.evidenceExclusionTitlePatterns || []).every(pattern => {
    try { new RegExp(pattern); return true; } catch { return false; }
  });
  return {
    valid: !invalidBindings.length && !invalidRules.length && channelsExact && domainsValid
      && queriesValid && everyDomainBound && exclusionPatternsValid,
    invalidBindings,
    invalidRules: unique(invalidRules),
    channelsExact,
    domainsValid,
    queriesValid,
    everyDomainBound,
    exclusionPatternsValid
  };
}

function inputCoverage(fieldAudit = {}, fieldManifest = {}, fieldRecords = [], policy = {}, contentHash = hash) {
  const reportBase = without(fieldAudit, ['contentHash']);
  const reportHashValid = validHash(fieldAudit.contentHash) && contentHash(reportBase) === fieldAudit.contentHash;
  const manifestHashValid = validHash(fieldManifest.contentHash) && fieldManifest.contentHash === recordsHash(fieldRecords);
  const snapshotBindingValid = fieldAudit.outputSnapshot?.directory === fieldManifest.snapshotDirectory
    && fieldAudit.outputSnapshot?.contentHash === fieldManifest.contentHash
    && Number(fieldAudit.outputSnapshot?.records) === Number(fieldManifest.records);
  const recordHashesAreValid = fieldRecords.every(record => recordHashesValid(record, contentHash));
  const relevant = fieldRecords.filter(record => EXPECTED_FIELDS.includes(record.field));
  const inputBlockers = sorted(unique(relevant.flatMap(record => Object.values(record.remainingBlockersByRoute || {}).flat())));
  const policyBlockers = sorted((policy.domains || []).map(domain => domain.blocker));
  const blockerSetExact = same(inputBlockers, policyBlockers);
  const blockerBindingsExact = (policy.domains || []).every(domain => relevant.some(record => record.field === domain.field
    && (record.remainingBlockersByRoute?.[domain.route] || []).includes(domain.blocker)));
  const valid = fieldAudit.contract === policy.inputAuditContract && fieldAudit.publishable === true
    && reportHashValid && fieldManifest.contract === 'sensum.ingestion-manifest.v1'
    && fieldManifest.domain === policy.inputSnapshotDomain && Number(fieldManifest.records) === fieldRecords.length
    && manifestHashValid && snapshotBindingValid && relevant.length === 2
    && relevant.every(record => record.contract === policy.inputRecordContract)
    && recordHashesAreValid && blockerSetExact && blockerBindingsExact;
  return {
    valid,
    auditContractValid: fieldAudit.contract === policy.inputAuditContract,
    auditPublishable: fieldAudit.publishable === true,
    auditContentHashValid: reportHashValid,
    manifestContractValid: fieldManifest.contract === 'sensum.ingestion-manifest.v1',
    manifestDomainValid: fieldManifest.domain === policy.inputSnapshotDomain,
    manifestRecordCountValid: Number(fieldManifest.records) === fieldRecords.length,
    manifestContentHashValid: manifestHashValid,
    auditSnapshotBindingValid: snapshotBindingValid,
    relevantFieldRecordCount: relevant.length,
    relevantFields: sorted(relevant.map(record => record.field)),
    recordHashesValid: recordHashesAreValid,
    blockerSetExact,
    blockerBindingsExact,
    inputBlockers
  };
}

function namespaceRegistryCoverage(namespaceRegistry = {}, policy = {}) {
  const raw = namespaceRegistry.query?.namespaces || namespaceRegistry.namespaces || {};
  const entries = Array.isArray(raw) ? raw : Object.values(raw);
  const byId = new Map(entries.map(entry => [Number(entry.id), entry]));
  const expected = (policy.channels || []).flatMap(channel => channel.namespaces.map((id, index) => ({
    id: Number(id), expectedName: channel.namespaceNames[index], channelKey: channel.channelKey
  })));
  const findings = expected.map(item => {
    const entry = byId.get(item.id);
    const observedName = item.id === 0 ? 'Main' : (entry?.canonical || entry?.name || null);
    return { ...item, observedName, matched: Boolean(entry) && observedName === item.expectedName };
  });
  return { expectedNamespaceCount: expected.length, matchedNamespaceCount: findings.filter(item => item.matched).length, findings, exact: findings.length === expected.length && findings.every(item => item.matched) };
}

function sourceUrl(title) {
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_')).replaceAll('%2F', '/')}`;
}

function lineSignals(page, channel, policy = {}) {
  const excluded = (policy.evidenceExclusionTitlePatterns || []).some(pattern => new RegExp(pattern, 'i').test(page.title || ''));
  if (excluded) return [];
  const content = String(page.content || '');
  const titleSubject = /Colossal Wyrm|Termites|Blessed bone shards/i.test(page.title || '');
  const signals = [];
  const add = (signalKind, line, index) => signals.push({
    signalKind,
    pageId: page.pageId,
    title: page.title,
    sourceRevision: page.sourceRevision,
    sourceTimestamp: page.sourceTimestamp,
    sourceUrl: page.sourceUrl,
    line: index + 1,
    excerpt: excerpt(line),
    sourceChannel: channel.channelKey,
    authorityClass: channel.authorityClass,
    mechanicalAuthority: false,
    requiresManualSemanticReview: true
  });
  content.split(/\r?\n/).forEach((line, index) => {
    const subject = titleSubject || /Colossal Wyrm|termite|bone shards?/i.test(line);
    if (!subject) return;
    if (/exact spawn rate[^\n]{0,80}unknown/i.test(line)) add('explicit_unknown_spawn_rate', line, index);
    if (/(?:spawn rate|chance[^\n]{0,80}spawn|spawn[^\n]{0,80}chance)/i.test(line)
      && /(?:\b\d+(?:\.\d+)?\s*%|\b1\s*(?:in|\/|out of)\s*\d+|every\s+\d+(?:\.\d+)?\s*(?:ticks?|seconds?|laps?))/i.test(line)
      && !/unknown|experimental|discussion/i.test(line)) add('potential_exact_spawn_rate', line, index);
    if (/(?:3\.9|6\.9)/.test(line) && /per completion|on average/i.test(line)
      && /experimental|Talk:|discussion/i.test(line)) add('experimental_per_completion_average', line, index);
    if (/(?:11\s*[-–]\s*14[^\n]{0,220}17\s*[-–]\s*20|80\s*%[^\n]{0,160}22\s*[-–]\s*38)/i.test(line)) add('current_scoop_range', line, index);
    if (/(?:234[^\n]{0,160}414|195[^\n]{0,160}345)/.test(line) && /per hour|laps per hour/i.test(line)) add('hourly_reward_claim', line, index);
    if (/(?:90\s+seconds?|one and a half minutes?|35\s+laps per hour|1:22\.80|1:07\.80)/i.test(line)) add('course_duration_or_lap_context', line, index);
    if (/(?:234|195|414|345|3\.9|6\.9)/.test(line)
      && /correct(?:ed|ion)?|revis(?:ed|ion)|replac(?:ed|es)|supersed(?:ed|es)|reconcil|was wrong|should be/i.test(line)) add('potential_reward_reconciliation', line, index);
    if (/Increased XP[^\n]{0,200}(?:Bone shards|Termites)|(?:Bone shards|Termites)[^\n]{0,200}roughly the same/i.test(line)) add('official_relative_reward_adjustment', line, index);
  });
  const seen = new Set();
  return signals.filter(signal => {
    const key = `${signal.signalKind}:${signal.pageId}:${signal.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function revisionEntries(searchResponses = [], revisionPages = []) {
  const matched = new Map();
  for (const response of searchResponses) for (const page of response.pages || []) {
    const key = String(page.pageId);
    const current = matched.get(key) || { titles: [], queryKeys: [], channelKeys: [] };
    current.titles.push(page.title);
    current.queryKeys.push(response.queryKey);
    current.channelKeys.push(response.channelKey);
    matched.set(key, current);
  }
  const revisions = new Map((revisionPages || []).map(page => [String(page.pageid), page]));
  return new Map([...matched.entries()].map(([pageId, match]) => {
    const page = revisions.get(pageId);
    const revision = page?.revisions?.[0];
    const titles = unique(match.titles);
    const content = revision?.slots?.main?.content;
    const exactSearchIdentityResolved = titles.length === 1 && page?.title === titles[0]
      && Number(page?.pageid) === Number(pageId) && Number(revision?.revid) > 0 && typeof content === 'string';
    return [pageId, {
      pageId: Number(pageId),
      namespaceId: Number(page?.ns),
      title: page?.title || titles[0] || null,
      sourceRevision: revision?.revid ? String(revision.revid) : null,
      sourceTimestamp: revision?.timestamp || null,
      sourceUrl: page?.title ? sourceUrl(page.title) : null,
      matchedQueryKeys: sorted(unique(match.queryKeys)),
      matchedChannelKeys: sorted(unique(match.channelKeys)),
      exactSearchIdentityResolved,
      contentHash: typeof content === 'string' ? hash(content) : null,
      contentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null,
      content: typeof content === 'string' ? content : null
    }];
  }));
}

function constructRecords({ fieldAudit = {}, fieldManifest = {}, fieldRecords = [], searchResponses = [], revisionPages = [], policy = {}, contentHash = hash }) {
  const responses = new Map(searchResponses.map(response => [response.queryKey, response]));
  const entries = revisionEntries(searchResponses, revisionPages);
  const channels = new Map((policy.channels || []).map(channel => [channel.channelKey, channel]));
  return (policy.domains || []).map(domain => {
    const queryPolicies = policy.queries.filter(query => query.boundBlockers.includes(domain.blocker));
    const searchQueries = queryPolicies.map(query => {
      const response = responses.get(query.queryKey) || {};
      const resultPageIds = sorted((response.pages || []).map(page => Number(page.pageId)));
      return {
        queryKey: query.queryKey,
        channelKey: query.channelKey,
        blocker: domain.blocker,
        searchText: query.searchText,
        namespaces: response.namespaces || null,
        maxResults: response.maxResults ?? null,
        reportedTotalHits: response.reportedTotalHits ?? null,
        fetchedResultCount: (response.pages || []).length,
        resultPageIds,
        paginationComplete: response.paginationComplete === true,
        truncated: response.truncated === true,
        resultSetHash: contentHash(resultPageIds)
      };
    });
    const pageIds = sorted(unique(searchQueries.flatMap(query => query.resultPageIds)));
    const pages = pageIds.map(pageId => entries.get(String(pageId))).filter(Boolean);
    const discoveredPages = pages.map(({ content, ...page }) => ({
      ...page,
      excludedFromEvidence: (policy.evidenceExclusionTitlePatterns || []).some(pattern => new RegExp(pattern, 'i').test(page.title || ''))
    }));
    const signals = [];
    for (const page of pages) {
      for (const channelKey of page.matchedChannelKeys) {
        const channel = channels.get(channelKey);
        if (!channel) continue;
        signals.push(...lineSignals(page, channel, policy).filter(signal => domain.signalKinds.includes(signal.signalKind)));
      }
    }
    const uniqueSignals = [];
    const signalKeys = new Set();
    for (const signal of signals) {
      const key = `${signal.signalKind}:${signal.pageId}:${signal.line}:${signal.sourceChannel}`;
      if (!signalKeys.has(key)) { signalKeys.add(key); uniqueSignals.push(signal); }
    }
    const base = {
      contract: policy.recordContract,
      field: domain.field,
      route: domain.route,
      blocker: domain.blocker,
      inputAuditContentHash: fieldAudit.contentHash,
      inputSnapshot: { directory: fieldManifest.snapshotDirectory, contentHash: fieldManifest.contentHash, records: fieldManifest.records },
      searchQueries,
      discoveredPages,
      potentialEvidenceSignals: uniqueSignals,
      disposition: uniqueSignals.length ? 'blocked_pending_manual_semantic_reaudit' : 'blocked_no_signal_in_declared_bounded_queries',
      searchAbsenceScope: 'declared_bounded_queries_only',
      existingBlockerPreserved: true,
      mechanicallyResolved: false,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligible: false,
      verifiedBestAuthorized: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      completeWikiUniverseClaimed: false
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
}

export function auditAgilityColossalWyrmTermiteRewardRateSourceDiscovery(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policy = options.policy || {};
  const policyValidation = policyCoverage(policy);
  const inputLineage = inputCoverage(options.fieldAudit, options.fieldManifest, options.fieldRecords, policy, contentHash);
  const namespaceRegistry = namespaceRegistryCoverage(options.namespaceRegistry, policy);
  const expected = constructRecords({ ...options, contentHash });
  const recordsMatchExpected = same(records, expected);
  const recordHashesAreValid = records.every(record => recordHashesValid(record, contentHash));
  const outputBlockers = sorted(records.map(record => record.blocker));
  const policyBlockers = sorted((policy.domains || []).map(domain => domain.blocker));
  const blockerCoverageExact = same(outputBlockers, policyBlockers) && unique(outputBlockers).length === outputBlockers.length;
  const queryKeys = (policy.queries || []).map(query => query.queryKey);
  const responseKeys = (options.searchResponses || []).map(response => response.queryKey);
  const querySetExact = same(sorted(queryKeys), sorted(responseKeys)) && unique(responseKeys).length === responseKeys.length;
  const channels = new Map((policy.channels || []).map(channel => [channel.channelKey, channel]));
  const responseByKey = new Map((options.searchResponses || []).map(response => [response.queryKey, response]));
  const queryDefinitionsExact = (policy.queries || []).every(query => {
    const response = responseByKey.get(query.queryKey);
    const channel = channels.get(query.channelKey);
    return response?.searchText === query.searchText && response?.channelKey === query.channelKey
      && same(response?.namespaces, channel?.namespaces)
      && Number(response?.maxResults) === Number(policy.searchResultLimitPerQuery);
  });
  const queriesCompleteWithinBound = (policy.queries || []).every(query => {
    const response = responseByKey.get(query.queryKey);
    const channel = channels.get(query.channelKey);
    const pages = response?.pages || [];
    return Number(response?.reportedTotalHits) === pages.length
      && pages.length <= Number(policy.searchResultLimitPerQuery)
      && response?.paginationComplete === true && response?.truncated === false
      && unique(pages.map(page => String(page.pageId))).length === pages.length
      && pages.every(page => Number(page.pageId) > 0 && typeof page.title === 'string'
        && channel.namespaces.includes(Number(page.namespaceId)));
  });
  const expectedPageIds = sorted(unique((options.searchResponses || []).flatMap(response => (response.pages || []).map(page => String(page.pageId)))));
  const revisionMap = new Map((options.revisionPages || []).map(page => [String(page.pageid), page]));
  const revisionSetExact = same(expectedPageIds, sorted(revisionMap.keys()));
  const allRevisionsResolved = revisionSetExact && expectedPageIds.every(pageId => {
    const page = revisionMap.get(pageId);
    const searchMatches = (options.searchResponses || []).flatMap(response => (response.pages || [])
      .filter(result => String(result.pageId) === pageId)
      .map(result => ({ title: result.title, namespaceId: Number(result.namespaceId) })));
    const revision = page?.revisions?.[0];
    return unique(searchMatches.map(match => match.title)).length === 1
      && page?.title === searchMatches[0]?.title && Number(page?.ns) === searchMatches[0]?.namespaceId
      && Number(page?.pageid) === Number(pageId) && Number(revision?.revid) > 0
      && typeof revision?.slots?.main?.content === 'string';
  });
  const signals = records.flatMap(record => record.potentialEvidenceSignals || []);
  const signalAuthoritySafe = signals.every(signal => signal.mechanicalAuthority === false
    && signal.requiresManualSemanticReview === true
    && channels.get(signal.sourceChannel)?.authorityClass === signal.authorityClass
    && (signal.authorityClass !== 'experimental_discussion' || signal.mechanicalAuthority === false));
  const forbiddenPromotions = records.filter(record => record.existingBlockerPreserved !== true
    || record.mechanicallyResolved !== false || record.blockersClosed !== 0 || record.semanticFactsCreated !== 0
    || record.optimizerEligible !== false || record.verifiedBestAuthorized !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false);
  const accountStateFindings = accountFindings([options.fieldAudit, options.fieldManifest, options.fieldRecords, records]);
  const blockers = [];
  if (!policyValidation.valid) blockers.push('source_discovery_policy_invalid');
  if (!inputLineage.valid) blockers.push('field_reconciliation_input_lineage_invalid');
  if (!namespaceRegistry.exact) blockers.push('current_wiki_namespace_registry_does_not_match_declared_channels');
  if (!blockerCoverageExact) blockers.push('six_reward_blocker_output_set_mismatch');
  if (!querySetExact) blockers.push('declared_query_set_mismatch');
  if (!queryDefinitionsExact) blockers.push('one_or_more_query_definitions_or_channels_mismatch');
  if (!queriesCompleteWithinBound) blockers.push('one_or_more_queries_incomplete_or_exceeded_bound');
  if (!revisionSetExact) blockers.push('search_result_revision_set_mismatch');
  if (!allRevisionsResolved) blockers.push('one_or_more_search_results_lack_exact_current_revision_binding');
  if (!recordsMatchExpected) blockers.push('records_do_not_match_query_bound_reconstruction');
  if (!recordHashesAreValid) blockers.push('one_or_more_record_hashes_invalid');
  if (!signalAuthoritySafe) blockers.push('one_or_more_signals_crossed_the_source_authority_boundary');
  if (forbiddenPromotions.length) blockers.push('source_discovery_created_unsupported_fact_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('account_query_state_baked_into_source_discovery');
  const publishable = blockers.length === 0;
  return {
    contract: policy.auditContract,
    policyValidation,
    inputLineage,
    namespaceRegistry,
    blockerCoverage: { expected: policyBlockers, output: outputBlockers, exact: blockerCoverageExact },
    queryCoverage: {
      declaredQueryCount: queryKeys.length,
      responseCount: responseKeys.length,
      querySetExact,
      queryDefinitionsExact,
      queriesCompleteWithinBound,
      totalResultOccurrences: (options.searchResponses || []).reduce((sum, response) => sum + (response.pages || []).length, 0)
    },
    revisionCoverage: { distinctSearchResultPages: expectedPageIds.length, revisionPages: revisionMap.size, revisionSetExact, allRevisionsResolved },
    signalCoverage: {
      totalSignals: signals.length,
      signalKinds: sorted(unique(signals.map(signal => signal.signalKind))),
      currentArticleSignals: signals.filter(signal => signal.authorityClass === 'current_article').length,
      historicalUpdateSignals: signals.filter(signal => signal.authorityClass === 'historical_update_archive').length,
      experimentalDiscussionSignals: signals.filter(signal => signal.authorityClass === 'experimental_discussion').length,
      sourceCodeSignals: signals.filter(signal => signal.authorityClass === 'implementation_or_template_source').length,
      signalAuthoritySafe
    },
    authorityBoundary: {
      mechanicallyResolvedBlockers: records.filter(record => record.mechanicallyResolved).length,
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      optimizerEligibleRecords: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizations: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerifications: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: accountStateFindings.length,
      completeWikiUniverseClaims: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    recordsMatchExpected,
    recordHashesValid: recordHashesAreValid,
    queryBoundedDiscoveryComplete: publishable,
    sourceDiscoveryDispositionStable: publishable && signals.length === 0,
    mechanicalCompletenessProven: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_colossal_wyrm_reward_mechanics_not_authoritative',
    publishable,
    blockers
  };
}

export function buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery(options = {}) {
  const contentHash = options.contentHash || hash;
  const records = constructRecords({ ...options, contentHash });
  const audit = auditAgilityColossalWyrmTermiteRewardRateSourceDiscovery(records, { ...options, contentHash });
  return { records: audit.publishable ? records : [], audit };
}
