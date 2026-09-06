const REQUIRED_RULES = [
  'allThreeReportsAndSnapshotsMustBeExplicitlySelected',
  'baseDiscoveryPolicyHashAndScopeMustValidate',
  'reportManifestRawPayloadAndRecordHashesMustValidate',
  'inputPoliciesContractsAndNamespacesMustMatchExactly',
  'candidateBlockerAndQueryDefinitionsMustMatchAcrossEveryChannel',
  'everyBlockerMustHaveExactlyOneDomainPerChannel',
  'currentAndHistoricalSignalsMustRemainDistinct',
  'historicalSignalsRequireCurrentHeadReconciliation',
  'allSignalsRequireManualSemanticReview',
  'boundedSearchSilenceCannotProveWikiOrGameFactAbsence',
  'noSignalRoutesToMonitoringAndAdditionalAuthoritativeEvidence',
  'signalsCannotCloseBlockersOrCreateFacts',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];

const EXPECTED_CHANNEL_KEYS = [
  'current_article_search',
  'current_source_code_search',
  'historical_update_archive_search'
];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash) => contentHash({ value: left }) === contentHash({ value: right });
const signalList = domain => domain?.potentialEvidenceSignals || domain?.resolutionSignals || [];
const accountKey = key => /^(?:account|accountState|accountSnapshot|player|playerState|username|profile|currentBaseLevel|currentLevel|currentXp|bank|owned|ownedItems|ownedEquipment|inventory|budget|preferences|completedQuests)$/i.test(key);

function accountStateFindings(values = []) {
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

function policyErrors(policy = {}) {
  const errors = [];
  if (policy.policy !== 'sensum.agility-target-condition-gap-source-channel-coverage-synthesis-policy.v1') errors.push('policy');
  if (policy.recordContract !== 'sensum.agility-target-condition-gap-source-channel-coverage-synthesis.v1') errors.push('recordContract');
  if (policy.auditContract !== 'sensum.agility-target-condition-gap-source-channel-coverage-synthesis-audit.v1') errors.push('auditContract');
  if (policy.outputDomain !== 'agility-target-condition-gap-source-channel-coverage-synthesis') errors.push('outputDomain');
  if (Number(policy.targetBaseAgility) !== 34) errors.push('targetBaseAgility');
  if (Number(policy.expectedCandidateCount) !== 5) errors.push('expectedCandidateCount');
  if (Number(policy.expectedBlockerCount) !== 17) errors.push('expectedBlockerCount');
  if (Number(policy.expectedQueryCountPerChannel) !== 27) errors.push('expectedQueryCountPerChannel');
  const channels = policy.inputChannels || [];
  const keys = channels.map(channel => channel.channelKey);
  if (!same(keys, EXPECTED_CHANNEL_KEYS, value => JSON.stringify(value))) errors.push('inputChannelOrder');
  if (unique(keys).length !== keys.length) errors.push('duplicateInputChannelKeys');
  for (const channel of channels) {
    if (!channel.reportContract || !channel.recordContract || !channel.manifestDomain || !channel.policyId || !/^[a-f0-9]{64}$/.test(channel.policyContentHash || '')) errors.push(`invalidInputChannel:${channel.channelKey || 'unknown'}`);
    if (!Array.isArray(channel.namespaces) || !channel.namespaces.length || channel.namespaces.some(namespace => !Number.isInteger(Number(namespace)))) errors.push(`invalidNamespaces:${channel.channelKey || 'unknown'}`);
  }
  for (const route of ['currentSignal', 'historicalSignalOnly', 'noSignal']) if (!policy.routes?.[route]) errors.push(`missingRoute:${route}`);
  for (const rule of REQUIRED_RULES) if (policy.rules?.[rule] !== true) errors.push(rule);
  if (policy.rules?.automaticVerificationAllowed !== false) errors.push('automaticVerificationAllowed');
  return sorted(unique(errors));
}

function parseRawRecords(rawRecords) {
  if (typeof rawRecords !== 'string' || !rawRecords.trim()) return { records: [], error: 'raw_record_payload_missing_or_empty' };
  try {
    return {
      records: rawRecords.trimEnd().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)),
      error: null
    };
  } catch {
    return { records: [], error: 'raw_record_payload_invalid_ndjson' };
  }
}

function recordHashesValid(records, contentHash) {
  return records.every(record => record.recordContentHash === contentHash(without(record, ['recordContentHash', 'contentHash']))
    && record.contentHash === contentHash(without(record, ['contentHash'])));
}

function queryDefinitions(records = []) {
  return records.flatMap(record => (record.searchQueries || []).map(query => ({
    queryKey: query.queryKey,
    candidateKey: record.candidateKey,
    blocker: query.blocker,
    diagnosticKind: query.diagnosticKind,
    searchText: query.searchText,
    maxResults: Number(query.maxResults)
  }))).sort((left, right) => left.queryKey.localeCompare(right.queryKey));
}

function blockerKeys(records = []) {
  return sorted(records.flatMap(record => (record.evidenceDomains || []).map(domain => `${record.candidateKey}\u0000${domain.blocker}`)));
}

function inputPromotionFindings(records = []) {
  return records.filter(record => record.blockersClosed !== 0
    || record.semanticFactsCreated !== 0
    || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false
    || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false).map(record => record.candidateKey);
}

function validateChannelInput(channel, input = {}, policy = {}, contentHash) {
  const failures = [];
  const report = input.report || {};
  const manifest = input.manifest || {};
  const parsed = parseRawRecords(input.rawRecords);
  const records = parsed.records;
  if (parsed.error) failures.push(parsed.error);
  const reportHashValid = Boolean(report.contentHash)
    && report.contentHash === contentHash({ ...report, contentHash: undefined });
  const manifestHashValid = Boolean(manifest.contentHash)
    && typeof input.rawRecords === 'string' && manifest.contentHash === contentHash(input.rawRecords);
  const hashesValid = recordHashesValid(records, contentHash);
  const definitions = queryDefinitions(records);
  const definitionKeys = definitions.map(query => query.queryKey);
  const namespacesExact = records.every(record => (record.searchQueries || []).every(query => same(query.namespaces, channel.namespaces, contentHash)));
  const evidenceDomains = records.flatMap(record => record.evidenceDomains || []);
  const derivedSignalCount = evidenceDomains.reduce((sum, domain) => sum + signalList(domain).length, 0);
  const historicalSignals = channel.temporalClass === 'historical_update_archive'
    ? evidenceDomains.flatMap(signalList)
    : [];
  const historicalTemporalGatesValid = historicalSignals.every(signal => signal.sourceTemporalClass === 'historical_update_archive'
    && signal.currentStateAuthority === false
    && signal.currentHeadReconciliationRequired === true
    && signal.mayApplyCurrentFact === false)
    && (channel.temporalClass !== 'historical_update_archive' || records.every(record => record.sourceTemporalClass === 'historical_update_archive'
      && record.currentStateAuthority === false && record.currentFactApplications === 0));
  const promotionFindings = inputPromotionFindings(records);
  const accountFindings = accountStateFindings(records);
  if (report.contract !== channel.reportContract) failures.push('report_contract_mismatch');
  if (!reportHashValid) failures.push('report_content_hash_invalid');
  if (report.publishable !== true) failures.push('input_report_not_publishable');
  if (report.policy?.id !== channel.policyId || report.policy?.contentHash !== channel.policyContentHash) failures.push('input_policy_binding_mismatch');
  if (manifest.contract !== 'sensum.ingestion-manifest.v1' || manifest.domain !== channel.manifestDomain) failures.push('manifest_contract_or_domain_mismatch');
  if (!manifestHashValid || report.outputSnapshot?.contentHash !== manifest.contentHash) failures.push('manifest_or_report_snapshot_hash_invalid');
  if (report.outputSnapshot?.directory !== input.snapshotDirectory) failures.push('explicit_snapshot_directory_mismatch');
  if (Number(manifest.records) !== records.length) failures.push('manifest_record_count_mismatch');
  if (!records.length || records.some(record => record.contract !== channel.recordContract)) failures.push('record_contract_mismatch');
  if (!hashesValid) failures.push('record_content_hash_invalid');
  if (records.length !== Number(policy.expectedCandidateCount)) failures.push('candidate_record_count_mismatch');
  if (unique(definitionKeys).length !== Number(policy.expectedQueryCountPerChannel) || definitions.length !== Number(policy.expectedQueryCountPerChannel)) failures.push('query_definition_count_or_identity_mismatch');
  if (!namespacesExact) failures.push('query_namespace_scope_mismatch');
  if (report.queryCoverage?.declaredQueryCount !== Number(policy.expectedQueryCountPerChannel)
    || report.queryCoverage?.responseCount !== Number(policy.expectedQueryCountPerChannel)
    || report.queryCoverage?.querySetMatches !== true
    || report.queryCoverage?.queryDefinitionsMatch !== true
    || report.queryCoverage?.queriesCompleteWithinBound !== true) failures.push('report_query_coverage_incomplete');
  if (evidenceDomains.length !== Number(policy.expectedBlockerCount)
    || report.evidenceDomainCoverage?.blockerCount !== Number(policy.expectedBlockerCount)
    || report.evidenceDomainCoverage?.potentialEvidenceSignalCount !== derivedSignalCount) failures.push('report_evidence_domain_coverage_mismatch');
  if (report.blockerPreservation?.preserved !== true
    || report.blockerPreservation?.blockersClosed !== 0
    || report.blockerPreservation?.semanticFactsCreated !== 0
    || report.blockerPreservation?.optimizerEligibleCount !== 0
    || report.blockerPreservation?.automaticVerificationCount !== 0
    || report.blockerPreservation?.accountStateFindingCount !== 0
    || report.blockerPreservation?.completeWikiUniverseClaimCount !== 0) failures.push('input_report_promoted_or_changed_semantic_state');
  if (promotionFindings.length) failures.push('input_records_promoted_or_changed_semantic_state');
  if (accountFindings.length) failures.push('input_records_contain_account_state');
  if (!historicalTemporalGatesValid) failures.push('historical_input_missing_temporal_non_authority_gate');
  return {
    channelKey: channel.channelKey,
    valid: failures.length === 0,
    failures: sorted(unique(failures)),
    report,
    manifest,
    records,
    reportHashValid,
    manifestHashValid,
    recordHashesValid: hashesValid,
    candidateKeys: sorted(records.map(record => record.candidateKey)),
    blockerKeys: blockerKeys(records),
    queryDefinitions: definitions,
    signalCount: derivedSignalCount,
    historicalSignalCount: historicalSignals.length,
    accountStateFindings: accountFindings,
    promotionFindings
  };
}

function expectedQueryDefinitions(basePolicy = {}) {
  return (basePolicy.queries || []).map(query => ({
    queryKey: query.queryKey,
    candidateKey: query.candidateKey,
    blocker: query.blocker,
    diagnosticKind: query.diagnosticKind,
    searchText: query.searchText,
    maxResults: Number(basePolicy.searchResultLimitPerQuery)
  })).sort((left, right) => left.queryKey.localeCompare(right.queryKey));
}

function evaluateInputs(inputs = {}, policy = {}, basePolicy = {}, contentHash) {
  const invalidPolicyRules = policyErrors(policy);
  const basePolicyBindingValid = basePolicy.policy === policy.basePolicy
    && policy.basePolicyFile === 'platform/policies/agility-target-condition-gap-wiki-discovery-v1.json'
    && policy.basePolicyContentHash === contentHash(basePolicy);
  if (!basePolicyBindingValid) invalidPolicyRules.push('baseDiscoveryPolicyBinding');
  const channels = (policy.inputChannels || []).map(channel => validateChannelInput(channel, inputs[channel.channelKey], policy, contentHash));
  const reference = channels[0] || { candidateKeys: [], blockerKeys: [], queryDefinitions: [] };
  const expectedCandidates = sorted((basePolicy.candidates || []).map(candidate => candidate.candidateKey));
  const expectedBlockers = sorted((basePolicy.candidates || []).flatMap(candidate => candidate.expectedBlockers.map(blocker => `${candidate.candidateKey}\u0000${blocker}`)));
  const expectedQueries = expectedQueryDefinitions(basePolicy);
  const candidateSetsMatch = channels.length === EXPECTED_CHANNEL_KEYS.length
    && channels.every(channel => same(channel.candidateKeys, reference.candidateKeys, contentHash));
  const blockerSetsMatch = channels.length === EXPECTED_CHANNEL_KEYS.length
    && channels.every(channel => same(channel.blockerKeys, reference.blockerKeys, contentHash));
  const queryDefinitionsMatch = channels.length === EXPECTED_CHANNEL_KEYS.length
    && channels.every(channel => same(channel.queryDefinitions, reference.queryDefinitions, contentHash));
  const candidateSetsMatchExpected = channels.every(channel => same(channel.candidateKeys, expectedCandidates, contentHash));
  const blockerSetsMatchExpected = channels.every(channel => same(channel.blockerKeys, expectedBlockers, contentHash));
  const queryDefinitionsMatchExpected = channels.every(channel => same(channel.queryDefinitions, expectedQueries, contentHash));
  const coverageHashes = unique(channels.flatMap(channel => channel.records.map(record => record.coverageAuditContentHash)).filter(Boolean));
  const sufficiencyHashes = unique(channels.flatMap(channel => channel.records.map(record => record.sourceSufficiencyAuditContentHash)).filter(Boolean));
  const upstreamBindingsMatch = coverageHashes.length === 1 && sufficiencyHashes.length === 1;
  return {
    valid: invalidPolicyRules.length === 0 && basePolicyBindingValid && channels.length === EXPECTED_CHANNEL_KEYS.length
      && channels.every(channel => channel.valid) && candidateSetsMatch && blockerSetsMatch
      && queryDefinitionsMatch && candidateSetsMatchExpected && blockerSetsMatchExpected
      && queryDefinitionsMatchExpected && upstreamBindingsMatch,
    invalidPolicyRules,
    basePolicyBindingValid,
    channels,
    candidateSetsMatch,
    blockerSetsMatch,
    queryDefinitionsMatch,
    candidateSetsMatchExpected,
    blockerSetsMatchExpected,
    queryDefinitionsMatchExpected,
    upstreamBindingsMatch,
    coverageAuditContentHash: coverageHashes[0] || null,
    sourceSufficiencyAuditContentHash: sufficiencyHashes[0] || null
  };
}

function domainFor(channel, candidateKey, blocker) {
  const record = channel.records.find(row => row.candidateKey === candidateKey);
  return {
    record,
    domain: (record?.evidenceDomains || []).find(entry => entry.blocker === blocker)
  };
}

function sourceSignal(signal, channel, contentHash) {
  const historical = channel.channelKey === 'historical_update_archive_search';
  return {
    channelKey: channel.channelKey,
    temporalClass: historical ? 'historical_update_archive' : channel.channelKey === 'current_article_search'
      ? 'current_revision_candidate_bound_search'
      : 'current_revision_template_calculator_module_search',
    signalKind: signal.signalKind || null,
    pageId: signal.pageId ?? null,
    title: signal.title || null,
    sourceRevision: signal.sourceRevision || null,
    sourceUrl: signal.sourceUrl || null,
    line: Number.isFinite(Number(signal.line)) ? Number(signal.line) : null,
    excerpt: signal.excerpt || null,
    queryKeys: sorted(signal.queryKeys || []),
    currentStateAuthority: false,
    manualSemanticReviewRequired: true,
    currentHeadReconciliationRequired: historical,
    sourceSignalContentHash: contentHash(signal)
  };
}

function channelDomainSummary(channel, candidateKey, blocker, contentHash) {
  const { record, domain } = domainFor(channel, candidateKey, blocker);
  const queryKeys = sorted(domain?.queryKeys || []);
  const queries = (record?.searchQueries || []).filter(query => queryKeys.includes(query.queryKey));
  const pageIds = unique(queries.flatMap(query => query.resultPageIds || []).map(Number)).sort((left, right) => left - right);
  const signals = signalList(domain).map(signal => sourceSignal(signal, channel, contentHash));
  return {
    channelKey: channel.channelKey,
    reportContract: channel.report.contract,
    reportContentHash: channel.report.contentHash,
    snapshotDirectory: channel.report.outputSnapshot.directory,
    snapshotContentHash: channel.manifest.contentHash,
    queryKeys,
    resultOccurrenceCount: queries.reduce((sum, query) => sum + Number(query.fetchedResultCount || 0), 0),
    distinctResultPageIds: pageIds,
    conditionMatchedSignals: signals,
    searchComplete: queries.length === queryKeys.length && queries.every(query => query.paginationComplete === true && query.truncated === false),
    blockerRemainsOpen: true
  };
}

function constructRecords(evaluation, policy, contentHash) {
  const reference = evaluation.channels[0];
  const records = [];
  for (const candidate of reference.records) {
    for (const domain of candidate.evidenceDomains || []) {
      const channels = evaluation.channels.map(channel => channelDomainSummary(channel, candidate.candidateKey, domain.blocker, contentHash));
      const currentSignals = channels.filter(channel => channel.channelKey !== 'historical_update_archive_search').flatMap(channel => channel.conditionMatchedSignals);
      const historicalSignals = channels.filter(channel => channel.channelKey === 'historical_update_archive_search').flatMap(channel => channel.conditionMatchedSignals);
      const manualReviewRequired = currentSignals.length + historicalSignals.length > 0;
      const channelCoverageDisposition = currentSignals.length
        ? 'bounded_channels_complete_current_signal_pending_manual_review'
        : historicalSignals.length
          ? 'bounded_channels_complete_historical_signal_pending_current_head_reconciliation'
          : 'bounded_channels_complete_no_condition_matched_evidence';
      const nextAction = currentSignals.length
        ? policy.routes.currentSignal
        : historicalSignals.length
          ? policy.routes.historicalSignalOnly
          : policy.routes.noSignal;
      const base = {
        contract: policy.recordContract,
        candidateKey: candidate.candidateKey,
        candidateName: candidate.candidateName,
        targetBaseAgility: Number(policy.targetBaseAgility),
        coverageAuditContentHash: evaluation.coverageAuditContentHash,
        sourceSufficiencyAuditContentHash: evaluation.sourceSufficiencyAuditContentHash,
        blocker: domain.blocker,
        diagnosticKinds: sorted(domain.diagnosticKinds || []),
        queryDefinitions: reference.queryDefinitions.filter(query => query.candidateKey === candidate.candidateKey && query.blocker === domain.blocker),
        channels,
        currentSignals,
        historicalSignals,
        channelCoverageDisposition,
        nextAction,
        boundedSearchAbsenceIsNotFact: true,
        manualReviewRequired,
        evidenceWorkRequired: true,
        existingBlockerStatus: 'open',
        blockersClosed: 0,
        semanticFactsCreated: 0,
        optimizerEligible: false,
        verifiedBestAuthorized: false,
        automaticVerificationApplied: false,
        accountIndependent: true,
        completeWikiUniverseClaimed: false
      };
      const withRecordHash = { ...base, recordContentHash: contentHash(base) };
      records.push({ ...withRecordHash, contentHash: contentHash(withRecordHash) });
    }
  }
  return records;
}

export function auditAgilityTargetConditionGapSourceChannelCoverageSynthesis(records = [], { inputs = {}, policy = {}, basePolicy = {}, contentHash = value => value } = {}) {
  const evaluation = evaluateInputs(inputs, policy, basePolicy, contentHash);
  const expectedRecords = evaluation.valid ? constructRecords(evaluation, policy, contentHash) : [];
  const recordsMatchExpected = same(records, expectedRecords, contentHash);
  const hashesValid = recordHashesValid(records, contentHash);
  const candidateCount = unique(records.map(record => record.candidateKey)).length;
  const blockerCount = records.length;
  const channelCounts = Object.fromEntries(evaluation.channels.map(channel => [channel.channelKey, channel.queryDefinitions.length]));
  const currentSignalCount = records.reduce((sum, record) => sum + (record.currentSignals?.length || 0), 0);
  const historicalSignalCount = records.reduce((sum, record) => sum + (record.historicalSignals?.length || 0), 0);
  const manualReviewDomainCount = records.filter(record => record.manualReviewRequired).length;
  const noSignalDomainCount = records.filter(record => !record.currentSignals?.length && !record.historicalSignals?.length).length;
  const routeCounts = Object.fromEntries(Object.values(policy.routes || {}).map(route => [route, records.filter(record => record.nextAction === route).length]));
  const foundAccountState = accountStateFindings(records);
  const promotionCount = records.filter(record => record.existingBlockerStatus !== 'open'
    || record.blockersClosed !== 0 || record.semanticFactsCreated !== 0
    || record.optimizerEligible !== false || record.verifiedBestAuthorized !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false || record.boundedSearchAbsenceIsNotFact !== true).length;
  const everyBlockerHasAllChannels = records.every(record => same(record.channels?.map(channel => channel.channelKey), EXPECTED_CHANNEL_KEYS, contentHash)
    && record.channels.every(channel => channel.searchComplete === true && channel.blockerRemainsOpen === true));
  const signalsRemainNonAuthoritative = records.every(record => [...(record.currentSignals || []), ...(record.historicalSignals || [])].every(signal => signal.currentStateAuthority === false
    && signal.manualSemanticReviewRequired === true
    && (signal.temporalClass !== 'historical_update_archive' || signal.currentHeadReconciliationRequired === true)));
  const blockers = [];
  if (evaluation.invalidPolicyRules.length) blockers.push('synthesis_policy_invalid');
  for (const channel of evaluation.channels) if (!channel.valid) blockers.push(`input_channel_invalid:${channel.channelKey}`);
  if (!evaluation.candidateSetsMatch) blockers.push('candidate_sets_do_not_match_across_channels');
  if (!evaluation.blockerSetsMatch) blockers.push('blocker_sets_do_not_match_across_channels');
  if (!evaluation.queryDefinitionsMatch) blockers.push('query_definitions_do_not_match_across_channels');
  if (!evaluation.candidateSetsMatchExpected) blockers.push('candidate_sets_do_not_match_bound_base_policy');
  if (!evaluation.blockerSetsMatchExpected) blockers.push('blocker_sets_do_not_match_bound_base_policy');
  if (!evaluation.queryDefinitionsMatchExpected) blockers.push('query_definitions_do_not_match_bound_base_policy');
  if (!evaluation.upstreamBindingsMatch) blockers.push('coverage_or_source_sufficiency_bindings_do_not_match');
  if (candidateCount !== Number(policy.expectedCandidateCount) || blockerCount !== Number(policy.expectedBlockerCount)) blockers.push('synthesis_candidate_or_blocker_count_mismatch');
  if (!everyBlockerHasAllChannels) blockers.push('one_or_more_blockers_missing_complete_channel_coverage');
  if (!recordsMatchExpected) blockers.push('synthesis_records_do_not_match_independent_reconstruction');
  if (!hashesValid) blockers.push('one_or_more_synthesis_record_hashes_invalid');
  if (!signalsRemainNonAuthoritative) blockers.push('one_or_more_signals_claim_current_authority_without_review');
  if (promotionCount) blockers.push('synthesis_changed_blocker_fact_or_optimizer_state');
  if (foundAccountState.length) blockers.push('account_state_present_in_account_independent_synthesis');
  const sourceChannelSynthesisComplete = evaluation.valid && everyBlockerHasAllChannels && recordsMatchExpected && hashesValid
    && signalsRemainNonAuthoritative && promotionCount === 0 && foundAccountState.length === 0;
  return {
    contract: policy.auditContract,
    inputChannelCoverage: evaluation.channels.map(channel => ({
      channelKey: channel.channelKey,
      valid: channel.valid,
      failures: channel.failures,
      reportContentHash: channel.report.contentHash || null,
      snapshotContentHash: channel.manifest.contentHash || null,
      candidateCount: channel.candidateKeys.length,
      blockerCount: channel.blockerKeys.length,
      queryDefinitionCount: channel.queryDefinitions.length,
      signalCount: channel.signalCount,
      historicalSignalCount: channel.historicalSignalCount
    })),
    candidateCoverage: {
      expectedCandidateCount: Number(policy.expectedCandidateCount),
      outputCandidateCount: candidateCount,
      basePolicyBindingValid: evaluation.basePolicyBindingValid,
      candidateSetsMatchAcrossChannels: evaluation.candidateSetsMatch,
      blockerSetsMatchAcrossChannels: evaluation.blockerSetsMatch,
      candidateSetsMatchBoundBasePolicy: evaluation.candidateSetsMatchExpected,
      blockerSetsMatchBoundBasePolicy: evaluation.blockerSetsMatchExpected,
      everyBlockerHasExactlyOneDomainPerChannel: evaluation.channels.every(channel => unique(channel.blockerKeys).length === Number(policy.expectedBlockerCount))
    },
    queryCoverage: {
      expectedQueryCountPerChannel: Number(policy.expectedQueryCountPerChannel),
      queryCountsByChannel: channelCounts,
      queryDefinitionsMatchAcrossChannels: evaluation.queryDefinitionsMatch,
      queryDefinitionsMatchBoundBasePolicy: evaluation.queryDefinitionsMatchExpected,
      totalBoundedQueryExecutions: Object.values(channelCounts).reduce((sum, count) => sum + count, 0)
    },
    evidenceDomainCoverage: {
      blockerCount,
      currentSignalCount,
      historicalSignalCount,
      manualReviewDomainCount,
      noConditionMatchedSignalDomainCount: noSignalDomainCount,
      unresolvedDomainCount: records.filter(record => record.existingBlockerStatus === 'open').length
    },
    routeCoverage: {
      routeCounts,
      currentSignalReviewRoutes: routeCounts[policy.routes?.currentSignal] || 0,
      historicalReconciliationRoutes: routeCounts[policy.routes?.historicalSignalOnly] || 0,
      monitoringAndAdditionalEvidenceRoutes: routeCounts[policy.routes?.noSignal] || 0,
      everyDomainHasOneRoute: records.every(record => Object.values(policy.routes || {}).includes(record.nextAction))
    },
    blockerPreservation: {
      preserved: promotionCount === 0 && records.every(record => record.existingBlockerStatus === 'open'),
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizationCount: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: foundAccountState.length,
      completeWikiUniverseClaimCount: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    invalidPolicyRules: evaluation.invalidPolicyRules,
    recordsMatchExpected,
    recordHashesValid: hashesValid,
    signalsRemainNonAuthoritative,
    sourceChannelSynthesisComplete,
    boundedSearchAbsenceOnly: records.every(record => record.boundedSearchAbsenceIsNotFact === true),
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable: blockers.length === 0,
    blockers
  };
}

export function buildAgilityTargetConditionGapSourceChannelCoverageSynthesis({ inputs = {}, policy = {}, basePolicy = {}, contentHash = value => value } = {}) {
  const evaluation = evaluateInputs(inputs, policy, basePolicy, contentHash);
  const records = evaluation.valid ? constructRecords(evaluation, policy, contentHash) : [];
  return {
    records,
    audit: auditAgilityTargetConditionGapSourceChannelCoverageSynthesis(records, { inputs, policy, basePolicy, contentHash })
  };
}
