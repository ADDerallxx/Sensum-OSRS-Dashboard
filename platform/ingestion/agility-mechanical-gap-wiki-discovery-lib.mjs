const requiredRules = [
  'coverageAndSourceSufficiencyInputsMustValidate',
  'candidateAndBlockerSetsMustMatchInputsExactly',
  'everyQueryMustBeCandidateAndBlockerBound',
  'everyDeclaredQueryMustRunExactlyOnce',
  'allSearchResultsMustFitTheDeclaredBound',
  'everySearchResultMustResolveToCurrentRevisionAndTitle',
  'diagnosticSignalsRouteManualReauditAndNeverResolveFacts',
  'searchAbsenceIsOnlyQueryBoundedNotWikiOrGameAbsence',
  'blockersClosedAndSemanticFactsCreatedMustAlwaysBeZero',
  'optimizerEligibilityAndAutomaticVerificationAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];

const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const excerpt = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 700);
const accountKey = key => /^(?:currentBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(key);

function contentSignals(pageEntry, predicate, signalKind) {
  const results = [];
  const lines = String(pageEntry.content || '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!predicate(lines[index], pageEntry)) continue;
    results.push({
      signalKind,
      pageId: pageEntry.pageId,
      title: pageEntry.title,
      sourceRevision: pageEntry.sourceRevision,
      sourceUrl: pageEntry.sourceUrl,
      line: index + 1,
      excerpt: excerpt(lines[index])
    });
  }
  return results;
}

function diagnosticSignals(kind, pageEntries) {
  if (kind === 'skullball_typical_cycle') {
    return pageEntries.flatMap(entry => contentSignals(entry, (line, page) => {
      const subject = page.title === 'Werewolf Skullball' || /Werewolf Skullball/i.test(line);
      const typical = /(?:typical|average|expected|normally|usually)/i.test(line);
      const timing = /\b\d+:\d+(?:\.\d+)?(?:\s*(?:-|–|to)\s*\d+:\d+(?:\.\d+)?)?\b/.test(line);
      return subject && typical && timing && /(?:completion|lap|route|game|time)/i.test(line);
    }, kind));
  }
  if (kind === 'barbarian_afk_cycle_with_drop') {
    return pageEntries.flatMap(entry => contentSignals(entry, line => /Barbarian Fishing/i.test(line)
      && /\bAFK\b/i.test(line)
      && /drop(?:ping|ped)?/i.test(line)
      && /\b\d+(?:\.\d+)?\s*(?:game\s*)?(?:ticks?|seconds?)\b/i.test(line)
      && /(?:catch|attempt|cycle|fish)/i.test(line), kind));
  }
  if (kind === 'edgeville_motionless_round_trip_timing') {
    return pageEntries.flatMap(entry => contentSignals(entry, line => /(?:Edgeville Dungeon|Monkeybars \(Edgeville Dungeon\))/i.test(line)
      && /(?:motionless|monkeybars?)/i.test(line)
      && /(?:round[ -]?trip|back\s+and\s+forth|both\s+(?:ways|directions)|there\s+and\s+back|full\s+cycle)/i.test(line)
      && /\b\d+(?:\.\d+)?\s*(?:game\s*)?(?:ticks?|seconds?)\b/i.test(line), kind));
  }
  if (kind === 'edgeville_upper_bound_reconciliation') {
    return pageEntries.flatMap(entry => contentSignals(entry, line => /(?:Edgeville Dungeon|monkeybars?)/i.test(line)
      && /13,?000/.test(line)
      && /13,?200/.test(line)
      && /(?:correct(?:ed|ion)?|revis(?:ed|ion)|replac(?:ed|es)|supersed(?:ed|es)|previous(?:ly)?|instead|reconcil)/i.test(line), kind));
  }
  return [];
}

function contextSignals(pageEntries) {
  const definitions = [
    ['skullball_peak_time', line => /Skullball|1:45/i.test(line) && /1:45/.test(line)],
    ['barbarian_afk_drop_scope', line => /AFK rates include the time spent dropping the fish/i.test(line)],
    ['edgeville_13000_upper_bound', line => /(?:Edgeville Dungeon|monkeybars?)/i.test(line) && /13,?000/.test(line)],
    ['edgeville_13200_upper_bound', line => /(?:Edgeville Dungeon|monkeybars?)/i.test(line) && /13,?200/.test(line)]
  ];
  const found = [];
  for (const [kind, predicate] of definitions) {
    for (const entry of pageEntries) found.push(...contentSignals(entry, predicate, kind));
  }
  return found.slice(0, 30);
}

function inputHashValid(report, contentHash) {
  return Boolean(report?.contentHash) && contentHash({ ...report, contentHash: undefined }) === report.contentHash;
}

function policyErrors(policy = {}) {
  const errors = [];
  if (!Number.isInteger(Number(policy.targetBaseAgility))) errors.push('targetBaseAgility');
  if (!Number.isInteger(Number(policy.searchResultLimitPerQuery)) || Number(policy.searchResultLimitPerQuery) < 1 || Number(policy.searchResultLimitPerQuery) > 500) errors.push('searchResultLimitPerQuery');
  if (!Array.isArray(policy.searchNamespaces) || !policy.searchNamespaces.length || policy.searchNamespaces.some(namespace => !Number.isInteger(Number(namespace)))) errors.push('searchNamespaces');
  if (!Array.isArray(policy.candidates) || !policy.candidates.length) errors.push('candidates');
  if (!Array.isArray(policy.queries) || !policy.queries.length) errors.push('queries');
  if (policy.searchApiOrigin !== 'https://oldschool.runescape.wiki/api.php') errors.push('searchApiOrigin');
  for (const rule of requiredRules) if (policy.rules?.[rule] !== true) errors.push(rule);
  if (policy.rules?.automaticVerificationAllowed !== false) errors.push('automaticVerificationAllowed');
  const candidates = new Map((policy.candidates || []).map(candidate => [candidate.candidateKey, candidate]));
  if (candidates.size !== (policy.candidates || []).length) errors.push('duplicateCandidateKeys');
  const queryKeys = (policy.queries || []).map(query => query.queryKey);
  if (unique(queryKeys).length !== queryKeys.length) errors.push('duplicateQueryKeys');
  for (const candidate of policy.candidates || []) if (!candidate.candidateKey || !candidate.expectedBlockers?.length) errors.push(`invalidCandidate:${candidate.candidateKey || 'unknown'}`);
  for (const query of policy.queries || []) {
    const candidate = candidates.get(query.candidateKey);
    if (!query.queryKey || !query.searchText || !query.diagnosticKind || !candidate || !candidate.expectedBlockers.includes(query.blocker)) errors.push(`invalidQueryBinding:${query.queryKey || 'unknown'}`);
  }
  for (const candidate of policy.candidates || []) {
    for (const blocker of candidate.expectedBlockers || []) {
      if (!(policy.queries || []).some(query => query.candidateKey === candidate.candidateKey && query.blocker === blocker)) errors.push(`blockerWithoutQuery:${candidate.candidateKey}:${blocker}`);
    }
  }
  return unique(errors);
}

function accountFindings(records = []) {
  const findings = [];
  const visit = (value, path, candidateKey) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`, candidateKey)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ candidateKey, path: childPath });
      visit(child, childPath, candidateKey);
    }
  };
  records.forEach(record => visit(record, '', record.candidateKey));
  return findings;
}

function revisionMap(revisionPages = []) {
  return new Map((revisionPages || []).map(page => [String(page.pageid), page]));
}

function pageEntry(pageId, matchedQueryKeys, searchTitles, revisions, contentHash) {
  const page = revisions.get(String(pageId));
  const revision = page?.revisions?.[0];
  const content = revision?.slots?.main?.content;
  const expectedTitles = unique(searchTitles.get(String(pageId)) || []);
  const exactSearchIdentityResolved = expectedTitles.length === 1
    && page?.title === expectedTitles[0]
    && typeof content === 'string'
    && Number(page?.pageid) === Number(pageId)
    && Number(revision?.revid) > 0;
  return {
    pageId: Number(pageId),
    title: page?.title || expectedTitles[0] || null,
    sourceRevision: revision?.revid ? String(revision.revid) : null,
    sourceTimestamp: revision?.timestamp || null,
    sourceUrl: page?.title ? `https://oldschool.runescape.wiki/w/${encodeURIComponent(page.title.replaceAll(' ', '_')).replaceAll('%2F', '/')}` : null,
    matchedQueryKeys: sorted(matchedQueryKeys),
    exactSearchIdentityResolved,
    contentHash: typeof content === 'string' ? contentHash(content) : null,
    contentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null,
    content: typeof content === 'string' ? content : null
  };
}

function constructRecords({ coverageReport = {}, sourceSufficiencyReport = {}, searchResponses = [], revisionPages = [], policy = {}, contentHash = value => value }) {
  const candidates = new Map((coverageReport.details || []).filter(detail => detail.status === 'mechanical_model_gap').map(detail => [detail.candidateKey, detail]));
  const responses = new Map((searchResponses || []).map(response => [response.queryKey, response]));
  const revisions = revisionMap(revisionPages);
  const searchTitles = new Map();
  for (const response of searchResponses || []) {
    for (const page of response.pages || []) {
      const key = String(page.pageId);
      searchTitles.set(key, [...(searchTitles.get(key) || []), page.title]);
    }
  }
  return (policy.candidates || []).map(candidatePolicy => {
    const candidate = candidates.get(candidatePolicy.candidateKey) || {};
    const queryPolicies = (policy.queries || []).filter(query => query.candidateKey === candidatePolicy.candidateKey);
    const searchQueries = queryPolicies.map(query => {
      const response = responses.get(query.queryKey) || {};
      const resultPageIds = sorted((response.pages || []).map(page => Number(page.pageId)));
      return {
        queryKey: query.queryKey,
        blocker: query.blocker,
        diagnosticKind: query.diagnosticKind,
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
    const pageQueries = new Map();
    for (const query of searchQueries) for (const pageId of query.resultPageIds) pageQueries.set(String(pageId), [...(pageQueries.get(String(pageId)) || []), query.queryKey]);
    const entries = sorted(pageQueries.keys()).map(pageId => pageEntry(pageId, pageQueries.get(pageId), searchTitles, revisions, contentHash));
    const discoveredPages = entries.map(({ content, ...entry }) => entry);
    const evidenceDomains = (candidate.blockers || []).map(blocker => {
      const domainQueries = queryPolicies.filter(query => query.blocker === blocker);
      const queryKeys = sorted(domainQueries.map(query => query.queryKey));
      const pageIds = unique(queryKeys.flatMap(queryKey => searchQueries.find(query => query.queryKey === queryKey)?.resultPageIds || []));
      const domainEntries = entries.filter(entry => pageIds.includes(entry.pageId));
      const kinds = unique(domainQueries.map(query => query.diagnosticKind));
      const potentialEvidenceSignals = kinds.flatMap(kind => diagnosticSignals(kind, domainEntries));
      return {
        blocker,
        queryKeys,
        diagnosticKinds: kinds,
        discoveredPageCount: domainEntries.length,
        potentialEvidenceSignals,
        disposition: potentialEvidenceSignals.length
          ? 'potential_evidence_requires_manual_semantic_reaudit'
          : 'unresolved_not_found_by_declared_bounded_queries'
      };
    });
    const manualReauditRequired = evidenceDomains.some(domain => domain.potentialEvidenceSignals.length > 0);
    const base = {
      contract: policy.recordContract,
      candidateKey: candidatePolicy.candidateKey,
      candidateName: candidate.name || null,
      targetBaseAgility: Number(policy.targetBaseAgility),
      coverageAuditContentHash: coverageReport.contentHash || null,
      sourceSufficiencyAuditContentHash: sourceSufficiencyReport.contentHash || null,
      existingBlockers: sorted(candidate.blockers || []),
      searchQueries,
      discoveredPages,
      contextSignals: contextSignals(entries),
      evidenceDomains,
      disposition: manualReauditRequired
        ? 'blocked_pending_manual_semantic_reaudit'
        : 'blocked_no_candidate_matched_evidence_in_declared_bounded_queries',
      manualReauditRequired,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      completeWikiUniverseClaimed: false
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
}

export function buildAgilityMechanicalGapWikiDiscovery(inputs) {
  const records = constructRecords(inputs);
  return { records, audit: auditAgilityMechanicalGapWikiDiscovery(records, inputs) };
}

export function auditAgilityMechanicalGapWikiDiscovery(records = [], { coverageReport = {}, sourceSufficiencyReport = {}, searchResponses = [], revisionPages = [], policy = {}, contentHash = value => value } = {}) {
  const invalidPolicyRules = policyErrors(policy);
  const coverageContractValid = coverageReport.contract === policy.coverageAuditContract;
  const coverageContentHashValid = inputHashValid(coverageReport, contentHash);
  const sourceContractValid = sourceSufficiencyReport.contract === policy.sourceSufficiencyAuditContract;
  const sourceContentHashValid = inputHashValid(sourceSufficiencyReport, contentHash);
  const sourceBoundToCoverage = sourceSufficiencyReport.inputAudit?.contentHash === coverageReport.contentHash;
  const sourceDispositionValid = sourceSufficiencyReport.sourceSufficiencyDispositionStable === true
    && Number(sourceSufficiencyReport.evidenceDomainCoverage?.resolutionSignalCount) === 0
    && Number(sourceSufficiencyReport.blockerPreservation?.blockersClosed) === 0
    && Number(sourceSufficiencyReport.blockerPreservation?.semanticFactsCreated) === 0;
  const inputCandidates = (coverageReport.details || []).filter(detail => detail.status === 'mechanical_model_gap');
  const inputKeys = sorted(inputCandidates.map(candidate => candidate.candidateKey));
  const policyKeys = sorted((policy.candidates || []).map(candidate => candidate.candidateKey));
  const outputKeys = records.map(record => record.candidateKey);
  const candidateSetMatches = same(inputKeys, policyKeys) && same(sorted(outputKeys), policyKeys) && unique(outputKeys).length === outputKeys.length;
  const policyCandidates = new Map((policy.candidates || []).map(candidate => [candidate.candidateKey, candidate]));
  const inputByCandidate = new Map(inputCandidates.map(candidate => [candidate.candidateKey, candidate]));
  const blockerSetsMatch = policyKeys.every(key => same(sorted(policyCandidates.get(key)?.expectedBlockers || []), sorted(inputByCandidate.get(key)?.blockers || [])));
  const responseKeys = (searchResponses || []).map(response => response.queryKey);
  const policyQueryKeys = sorted((policy.queries || []).map(query => query.queryKey));
  const querySetMatches = same(sorted(responseKeys), policyQueryKeys) && unique(responseKeys).length === responseKeys.length;
  const responseByKey = new Map((searchResponses || []).map(response => [response.queryKey, response]));
  const queryDefinitionsMatch = (policy.queries || []).every(query => {
    const response = responseByKey.get(query.queryKey);
    return response?.searchText === query.searchText
      && same(response?.namespaces, policy.searchNamespaces)
      && Number(response?.maxResults) === Number(policy.searchResultLimitPerQuery);
  });
  const queriesCompleteWithinBound = (policy.queries || []).every(query => {
    const response = responseByKey.get(query.queryKey);
    const pages = response?.pages || [];
    return Number(response?.reportedTotalHits) === pages.length
      && pages.length <= Number(policy.searchResultLimitPerQuery)
      && response?.paginationComplete === true
      && response?.truncated === false
      && unique(pages.map(page => String(page.pageId))).length === pages.length
      && pages.every(page => Number(page.pageId) > 0 && typeof page.title === 'string' && page.title.length > 0);
  });
  const expectedPageIds = sorted(unique((searchResponses || []).flatMap(response => (response.pages || []).map(page => String(page.pageId)))));
  const revisions = revisionMap(revisionPages);
  const revisionPageIds = sorted(revisions.keys());
  const revisionSetMatches = same(expectedPageIds, revisionPageIds);
  const allResultRevisionsResolved = revisionSetMatches && expectedPageIds.every(pageId => {
    const page = revisions.get(pageId);
    const searchTitles = unique((searchResponses || []).flatMap(response => (response.pages || []).filter(result => String(result.pageId) === pageId).map(result => result.title)));
    const revision = page?.revisions?.[0];
    return searchTitles.length === 1 && page?.title === searchTitles[0] && String(page?.pageid) === pageId && Number(revision?.revid) > 0 && typeof revision?.slots?.main?.content === 'string';
  });
  const expectedRecords = constructRecords({ coverageReport, sourceSufficiencyReport, searchResponses, revisionPages, policy, contentHash });
  const recordsMatchExpected = same(records, expectedRecords);
  const recordHashesValid = records.every(record => record.recordContentHash === contentHash(without(record, ['recordContentHash', 'contentHash']))
    && record.contentHash === contentHash(without(record, ['contentHash'])));
  const evidenceDomains = records.flatMap(record => record.evidenceDomains || []);
  const potentialEvidenceSignalCount = evidenceDomains.reduce((sum, domain) => sum + (domain.potentialEvidenceSignals?.length || 0), 0);
  const preservedBlockers = records.every(record => same(sorted(record.existingBlockers || []), sorted(inputByCandidate.get(record.candidateKey)?.blockers || [])));
  const forbiddenPromotionCount = records.filter(record => record.blockersClosed !== 0 || record.semanticFactsCreated !== 0 || record.optimizerEligible !== false || record.automaticVerificationApplied !== false || record.accountIndependent !== true || record.completeWikiUniverseClaimed !== false).length;
  const foundAccountState = accountFindings(records);
  const blockers = [];
  if (invalidPolicyRules.length) blockers.push('policy_rules_invalid');
  if (!coverageContractValid) blockers.push('coverage_audit_contract_invalid');
  if (!coverageContentHashValid) blockers.push('coverage_audit_content_hash_invalid');
  if (!sourceContractValid) blockers.push('source_sufficiency_audit_contract_invalid');
  if (!sourceContentHashValid) blockers.push('source_sufficiency_audit_content_hash_invalid');
  if (!sourceBoundToCoverage) blockers.push('source_sufficiency_audit_not_bound_to_coverage_input');
  if (!sourceDispositionValid) blockers.push('source_sufficiency_input_not_stably_unresolved');
  if (!candidateSetMatches) blockers.push('mechanical_gap_candidate_set_mismatch');
  if (!blockerSetsMatch) blockers.push('mechanical_gap_blocker_set_mismatch');
  if (!querySetMatches) blockers.push('declared_query_set_mismatch');
  if (!queryDefinitionsMatch) blockers.push('one_or_more_query_definitions_mismatch');
  if (!queriesCompleteWithinBound) blockers.push('one_or_more_queries_incomplete_or_exceeded_bound');
  if (!revisionSetMatches) blockers.push('search_result_revision_set_mismatch');
  if (!allResultRevisionsResolved) blockers.push('one_or_more_search_results_lack_exact_current_revision_binding');
  if (!recordsMatchExpected) blockers.push('output_records_do_not_match_query_bound_reconstruction');
  if (!recordHashesValid) blockers.push('one_or_more_record_hashes_invalid');
  if (!preservedBlockers) blockers.push('input_blockers_not_preserved_exactly');
  if (forbiddenPromotionCount) blockers.push('unsupported_fact_resolution_or_optimizer_promotion_detected');
  if (foundAccountState.length) blockers.push('account_query_state_baked_into_source_discovery');
  const publishable = blockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverageAudit: { contract: coverageReport.contract || null, contentHash: coverageReport.contentHash || null, contractValid: coverageContractValid, contentHashValid: coverageContentHashValid },
    inputSourceSufficiencyAudit: { contract: sourceSufficiencyReport.contract || null, contentHash: sourceSufficiencyReport.contentHash || null, contractValid: sourceContractValid, contentHashValid: sourceContentHashValid, boundToCoverage: sourceBoundToCoverage, stablyUnresolved: sourceDispositionValid },
    candidateCoverage: { inputMechanicalGapCount: inputCandidates.length, policyCandidateCount: policyKeys.length, outputRecordCount: records.length, candidateSetMatches, blockerSetsMatch },
    queryCoverage: { declaredQueryCount: policyQueryKeys.length, responseCount: searchResponses.length, querySetMatches, queryDefinitionsMatch, queriesCompleteWithinBound, totalSearchResultOccurrences: (searchResponses || []).reduce((sum, response) => sum + (response.pages || []).length, 0) },
    revisionCoverage: { distinctSearchResultPageCount: expectedPageIds.length, revisionPageCount: revisionPageIds.length, revisionSetMatches, allResultRevisionsResolved },
    evidenceDomainCoverage: { blockerCount: evidenceDomains.length, potentialEvidenceSignalCount, manualReauditCandidateCount: records.filter(record => record.manualReauditRequired).length, unresolvedDomainCount: evidenceDomains.filter(domain => domain.disposition === 'unresolved_not_found_by_declared_bounded_queries').length },
    blockerPreservation: { preserved: preservedBlockers, blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0), semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0), optimizerEligibleCount: records.filter(record => record.optimizerEligible).length, automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length, accountStateFindingCount: foundAccountState.length, completeWikiUniverseClaimCount: records.filter(record => record.completeWikiUniverseClaimed).length },
    invalidPolicyRules,
    recordsMatchExpected,
    recordHashesValid,
    queryBoundedDiscoveryComplete: publishable,
    sourceDiscoveryDispositionStable: publishable && potentialEvidenceSignalCount === 0,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable,
    blockers
  };
}
