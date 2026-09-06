import { hash, json } from '../ingestion/lib.mjs';
import { buildAgilityTargetConditionGapSourceChannelCoverageSynthesis } from './agility-target-condition-gap-source-channel-coverage-synthesis-lib.mjs';

const EXPECTED_CHANNELS = ['current_article_search', 'current_source_code_search', 'historical_update_archive_search'];
const REQUIRED_RULES = [
  'synthesisReportSnapshotAndAllUpstreamInputsMustBeExplicitlySelected',
  'synthesisAndAllUpstreamReportsManifestsRawPayloadsRecordsAndPoliciesMustRevalidate',
  'synthesisMustRebuildExactlyFromSelectedUpstreamInputs',
  'oneRegistryRecordPerOpenCandidateBlockerDomain',
  'everyDomainMustMonitorAllThreeSourceChannels',
  'everyCandidateBlockerBoundQueryMustHaveAnIndependentMonitorBinding',
  'queryDefinitionResultSetSourceRevisionContentAndSignalFingerprintsAreDistinct',
  'artifactHashChangesWithoutDomainEvidenceChangesDoNotTriggerEvidenceWork',
  'onlyChangedDomainChannelPairsMayRouteTargetedEvidenceWork',
  'historicalChangesRequireCurrentHeadReconciliationBeforeReview',
  'monitorChangesAreRoutingSignalsAndNeverVerifiedFacts',
  'baselineRegistryCreationDoesNotReportAChange',
  'blockersRemainOpenUntilSeparateEvidenceBoundHumanReviewAndGuardedApplication',
  'registryCannotCloseBlockersCreateFactsOrPromoteOptimizerState',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));

function parseRaw(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { records: [], error: 'raw_payload_missing_or_empty' };
  try {
    return { records: raw.trimEnd().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)), error: null };
  } catch {
    return { records: [], error: 'raw_payload_invalid_ndjson' };
  }
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:candidateKey|candidateKeys|blocker|blockers|pageId|pageIds|title|titles|revision|revisions|queryKey|queryKeys|override|overrides)$/i;
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileAgilityTargetConditionGapSourceChannelChangeMonitoringRegistryPolicy(policy = {}) {
  const expected = {
    inputManifestContract: 'sensum.ingestion-manifest.v1',
    inputDomain: 'agility-target-condition-gap-source-channel-coverage-synthesis',
    inputRecordContract: 'sensum.agility-target-condition-gap-source-channel-coverage-synthesis.v1',
    inputAuditContract: 'sensum.agility-target-condition-gap-source-channel-coverage-synthesis-audit.v1',
    inputPolicy: 'sensum.agility-target-condition-gap-source-channel-coverage-synthesis-policy.v1',
    inputPolicyFile: 'platform/policies/agility-target-condition-gap-source-channel-coverage-synthesis-v1.json',
    inputPolicyContentHash: '2144353aaddf5988050757e66ee9aef3199a5326f3c16fd587890bebb3b93d67',
    basePolicy: 'sensum.agility-target-condition-gap-wiki-discovery-policy.v1',
    basePolicyFile: 'platform/policies/agility-target-condition-gap-wiki-discovery-v1.json',
    basePolicyContentHash: '086e0a76a201c1ba0c9084a3f9a07e6e0842781a8fd097ef5803430e6f152fa6',
    recordContract: 'sensum.agility-target-condition-gap-source-channel-change-monitoring-registry.v1',
    auditContract: 'sensum.agility-target-condition-gap-source-channel-change-monitoring-registry-audit.v1',
    outputDomain: 'agility-target-condition-gap-source-channel-change-monitoring-registry',
    expectedCandidateCount: 5,
    expectedBlockerCount: 17,
    expectedChannelCountPerBlocker: 3,
    expectedQueryBindingCount: 81,
    structuralChangeRoute: 'fail_closed_registry_structure_reconciliation_required'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const routeKeysValid = same(sorted(Object.keys(policy.channelChangeRoutes || {})), EXPECTED_CHANNELS);
  const routesDistinct = unique(Object.values(policy.channelChangeRoutes || {})).length === EXPECTED_CHANNELS.length;
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidBindings.length && !invalidRules.length && routeKeysValid && routesDistinct && !forbidden.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    routeKeysValid,
    routesDistinct,
    forbiddenPolicyPaths: forbidden
  };
}

function recordHashesValid(record, contentHash = hash) {
  if (!validHash(record?.contentHash) || contentHash(without(record, ['contentHash'])) !== record.contentHash) return false;
  return validHash(record.recordContentHash)
    && contentHash(without(record, ['recordContentHash', 'contentHash'])) === record.recordContentHash;
}

function reportAudit(report = {}) {
  return without(report, ['generatedAt', 'policy', 'basePolicy', 'inputs', 'outputSnapshot', 'contentHash']);
}

function findAccountState(records = []) {
  const findings = [];
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|accountState|accountSnapshot|bank|bankItems|ownedEquipment|preferences)$/i;
  const visit = (value, path, monitorKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, monitorKey));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push({ monitorKey, path: next });
      visit(child, next, monitorKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record.monitorKey || `record-${index}`));
  return findings;
}

function evaluateInputs(options = {}, contentHash = hash) {
  const {
    synthesisReport = {}, synthesisManifest = {}, synthesisRaw = '',
    synthesisSnapshotDirectory = null, sourceInputs = {}, synthesisPolicy = {}, basePolicy = {}, policy = {}
  } = options;
  const compiled = compileAgilityTargetConditionGapSourceChannelChangeMonitoringRegistryPolicy(policy);
  const parsed = parseRaw(synthesisRaw);
  const synthesisRecords = parsed.records;
  const rebuilt = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis({
    inputs: sourceInputs,
    policy: synthesisPolicy,
    basePolicy,
    contentHash
  });
  const sourceRecords = Object.fromEntries(EXPECTED_CHANNELS.map(channelKey => {
    const channel = parseRaw(sourceInputs[channelKey]?.rawRecords || '');
    return [channelKey, channel];
  }));
  const reportHashValid = validHash(synthesisReport.contentHash)
    && contentHash({ ...synthesisReport, contentHash: undefined }) === synthesisReport.contentHash;
  const selectedInputBindings = EXPECTED_CHANNELS.map(channelKey => ({
    channelKey,
    reportContentHash: sourceInputs[channelKey]?.report?.contentHash || null,
    snapshotDirectory: sourceInputs[channelKey]?.snapshotDirectory || null,
    snapshotContentHash: sourceInputs[channelKey]?.manifest?.contentHash || null
  }));
  const normalizeBindings = bindings => (bindings || []).map(binding => ({
    channelKey: binding.channelKey,
    reportContentHash: binding.reportContentHash,
    snapshotDirectory: binding.snapshotDirectory,
    snapshotContentHash: binding.snapshotContentHash
  }));
  const checks = {
    policyValid: compiled.valid,
    synthesisRawParses: !parsed.error,
    synthesisManifestContractMatches: synthesisManifest.contract === policy.inputManifestContract,
    synthesisManifestDomainMatches: synthesisManifest.domain === policy.inputDomain,
    synthesisManifestRecordCountMatches: Number(synthesisManifest.records) === synthesisRecords.length,
    synthesisManifestRawHashMatches: synthesisManifest.contentHash === contentHash(synthesisRaw),
    synthesisReportHashValid: reportHashValid,
    synthesisReportContractMatches: synthesisReport.contract === policy.inputAuditContract,
    synthesisReportPublishable: synthesisReport.publishable === true && synthesisReport.sourceChannelSynthesisComplete === true,
    synthesisReportOutputBindingMatches: synthesisReport.outputSnapshot?.contentHash === synthesisManifest.contentHash,
    synthesisReportOutputDirectoryMatches: typeof synthesisSnapshotDirectory === 'string'
      && synthesisReport.outputSnapshot?.directory === synthesisSnapshotDirectory,
    synthesisReportPolicyBindingMatches: synthesisReport.policy?.id === policy.inputPolicy
      && synthesisReport.policy?.contentHash === policy.inputPolicyContentHash,
    synthesisReportBasePolicyBindingMatches: synthesisReport.basePolicy?.id === policy.basePolicy
      && synthesisReport.basePolicy?.contentHash === policy.basePolicyContentHash,
    synthesisReportInputBindingsMatchSelected: same(normalizeBindings(synthesisReport.inputs), selectedInputBindings),
    synthesisManifestInputBindingsMatchSelected: same(normalizeBindings(synthesisManifest.source?.inputs), selectedInputBindings),
    synthesisPolicyBindingMatches: synthesisPolicy.policy === policy.inputPolicy
      && contentHash(synthesisPolicy) === policy.inputPolicyContentHash
      && synthesisManifest.source?.policy?.id === policy.inputPolicy
      && synthesisManifest.source?.policy?.contentHash === policy.inputPolicyContentHash,
    basePolicyBindingMatches: basePolicy.policy === policy.basePolicy
      && contentHash(basePolicy) === policy.basePolicyContentHash
      && synthesisManifest.source?.basePolicy?.id === policy.basePolicy
      && synthesisManifest.source?.basePolicy?.contentHash === policy.basePolicyContentHash,
    allSynthesisRecordContractsMatch: synthesisRecords.every(record => record.contract === policy.inputRecordContract),
    allSynthesisRecordHashesValid: synthesisRecords.length > 0 && synthesisRecords.every(record => recordHashesValid(record, contentHash)),
    selectedUpstreamInputsRevalidate: rebuilt.audit.publishable === true && rebuilt.audit.sourceChannelSynthesisComplete === true,
    selectedUpstreamSourcesParse: EXPECTED_CHANNELS.every(channelKey => !sourceRecords[channelKey].error),
    synthesisRebuildMatchesRawRecords: same(rebuilt.records, synthesisRecords),
    synthesisRebuildMatchesReportAudit: same(rebuilt.audit, reportAudit(synthesisReport)),
    synthesisRebuildMatchesManifestAudit: same(rebuilt.audit, synthesisManifest.source?.audit)
  };
  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    compiled,
    synthesisRecords,
    sourceRecords: Object.fromEntries(EXPECTED_CHANNELS.map(key => [key, sourceRecords[key].records])),
    rebuilt
  };
}

function queryDefinition(query = {}) {
  return {
    queryKey: query.queryKey,
    blocker: query.blocker,
    diagnosticKind: query.diagnosticKind,
    searchText: query.searchText,
    maxResults: Number(query.maxResults),
    namespaces: [...(query.namespaces || [])]
  };
}

function queryResult(query = {}) {
  return {
    queryKey: query.queryKey,
    reportedTotalHits: Number(query.reportedTotalHits),
    fetchedResultCount: Number(query.fetchedResultCount),
    resultPageIds: [...(query.resultPageIds || [])],
    resultSetHash: query.resultSetHash,
    paginationComplete: query.paginationComplete === true,
    truncated: query.truncated === true
  };
}

function sourceBinding(page = {}, queryKeys = []) {
  const matched = sorted((page.matchedQueryKeys || []).filter(key => queryKeys.includes(key)));
  return {
    pageId: Number(page.pageId),
    title: page.title,
    sourceRevision: String(page.sourceRevision),
    sourceTimestamp: page.sourceTimestamp,
    sourceUrl: page.sourceUrl,
    contentHash: page.contentHash,
    contentBytes: Number(page.contentBytes),
    matchedQueryKeys: matched
  };
}

function channelMonitor(synthesisRecord, channel, sourceRecord, policy, contentHash = hash) {
  const queryKeys = sorted(channel.queryKeys || []);
  const queries = (sourceRecord?.searchQueries || []).filter(query => query.blocker === synthesisRecord.blocker && queryKeys.includes(query.queryKey));
  const queryDefinitions = queries.map(queryDefinition).sort((left, right) => left.queryKey.localeCompare(right.queryKey));
  const queryResults = queries.map(queryResult).sort((left, right) => left.queryKey.localeCompare(right.queryKey));
  const sourceBindings = (sourceRecord?.discoveredPages || [])
    .filter(page => (page.matchedQueryKeys || []).some(key => queryKeys.includes(key)))
    .map(page => sourceBinding(page, queryKeys))
    .sort((left, right) => `${left.pageId}|${left.sourceRevision}`.localeCompare(`${right.pageId}|${right.sourceRevision}`));
  const signalBindings = [...(channel.conditionMatchedSignals || [])]
    .sort((left, right) => json(left).localeCompare(json(right)));
  const queryDefinitionFingerprint = contentHash(queryDefinitions);
  const queryResultFingerprint = contentHash(queryResults);
  const sourceRevisionFingerprint = contentHash(sourceBindings);
  const signalFingerprint = contentHash(signalBindings);
  const evidenceFingerprint = contentHash({ queryDefinitionFingerprint, queryResultFingerprint, sourceRevisionFingerprint, signalFingerprint });
  return {
    channelKey: channel.channelKey,
    temporalClass: channel.channelKey === 'historical_update_archive_search' ? 'historical_update_archive' : 'current_revision_search',
    artifactProvenance: {
      reportContract: channel.reportContract,
      reportContentHash: channel.reportContentHash,
      snapshotDirectory: channel.snapshotDirectory,
      snapshotContentHash: channel.snapshotContentHash
    },
    queryDefinitions,
    queryResults,
    sourceBindings,
    signalBindings,
    queryDefinitionFingerprint,
    queryResultFingerprint,
    sourceRevisionFingerprint,
    signalFingerprint,
    evidenceFingerprint,
    changeRoute: policy.channelChangeRoutes[channel.channelKey],
    currentHeadReconciliationRequiredBeforeReview: channel.channelKey === 'historical_update_archive_search',
    blockerRemainsOpen: true
  };
}

function constructRecords(evaluation, policy, contentHash = hash) {
  const sourceByCandidate = Object.fromEntries(EXPECTED_CHANNELS.map(channelKey => [
    channelKey,
    new Map((evaluation.sourceRecords[channelKey] || []).map(record => [record.candidateKey, record]))
  ]));
  return evaluation.synthesisRecords.map(synthesisRecord => {
    const channelMonitors = synthesisRecord.channels.map(channel => channelMonitor(
      synthesisRecord,
      channel,
      sourceByCandidate[channel.channelKey]?.get(synthesisRecord.candidateKey),
      policy,
      contentHash
    )).sort((left, right) => left.channelKey.localeCompare(right.channelKey));
    const base = {
      contract: policy.recordContract,
      monitorKey: `${synthesisRecord.candidateKey}|${synthesisRecord.blocker}`,
      candidateKey: synthesisRecord.candidateKey,
      candidateName: synthesisRecord.candidateName,
      targetBaseAgility: synthesisRecord.targetBaseAgility,
      blocker: synthesisRecord.blocker,
      existingBlockerStatus: 'open',
      baselineNextAction: synthesisRecord.nextAction,
      synthesisBinding: {
        recordContentHash: synthesisRecord.contentHash,
        coverageAuditContentHash: synthesisRecord.coverageAuditContentHash,
        sourceSufficiencyAuditContentHash: synthesisRecord.sourceSufficiencyAuditContentHash
      },
      channelMonitors,
      monitoringState: 'baseline_registered_no_change_observed',
      changeDetected: false,
      changeEvents: [],
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
  }).sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
}

export function detectAgilityTargetConditionGapSourceChannelChanges(baselineRecords = [], currentRecords = [], policy = {}) {
  const baseline = new Map(baselineRecords.map(record => [record.monitorKey, record]));
  const current = new Map(currentRecords.map(record => [record.monitorKey, record]));
  const events = [];
  let provenanceOnlyChangeCount = 0;
  for (const monitorKey of sorted(unique([...baseline.keys(), ...current.keys()]))) {
    const before = baseline.get(monitorKey);
    const after = current.get(monitorKey);
    if (!before || !after) {
      events.push({
        monitorKey,
        candidateKey: (before || after)?.candidateKey || null,
        blocker: (before || after)?.blocker || null,
        channelKey: null,
        changedDimensions: ['registry_structure'],
        route: policy.structuralChangeRoute,
        evidenceWorkReopened: true,
        blockerRemainsOpen: true,
        semanticFactCreated: false
      });
      continue;
    }
    const beforeChannels = new Map((before.channelMonitors || []).map(channel => [channel.channelKey, channel]));
    const afterChannels = new Map((after.channelMonitors || []).map(channel => [channel.channelKey, channel]));
    for (const channelKey of sorted(unique([...beforeChannels.keys(), ...afterChannels.keys()]))) {
      const previous = beforeChannels.get(channelKey);
      const currentChannel = afterChannels.get(channelKey);
      if (!previous || !currentChannel) {
        events.push({
          monitorKey,
          candidateKey: before.candidateKey,
          blocker: before.blocker,
          channelKey,
          changedDimensions: ['channel_structure'],
          route: policy.structuralChangeRoute,
          evidenceWorkReopened: true,
          blockerRemainsOpen: true,
          semanticFactCreated: false
        });
        continue;
      }
      const dimensions = [
        ['query_definition', 'queryDefinitionFingerprint'],
        ['query_result_set', 'queryResultFingerprint'],
        ['source_revision_or_content', 'sourceRevisionFingerprint'],
        ['condition_matched_signal', 'signalFingerprint']
      ].filter(([, field]) => previous[field] !== currentChannel[field]).map(([name]) => name);
      if (dimensions.length) {
        events.push({
          monitorKey,
          candidateKey: before.candidateKey,
          blocker: before.blocker,
          channelKey,
          changedDimensions: dimensions,
          route: policy.channelChangeRoutes?.[channelKey] || policy.structuralChangeRoute,
          evidenceWorkReopened: true,
          blockerRemainsOpen: true,
          semanticFactCreated: false
        });
      } else if (!same(previous.artifactProvenance, currentChannel.artifactProvenance)) {
        provenanceOnlyChangeCount += 1;
      }
    }
  }
  return {
    events,
    affectedMonitorCount: unique(events.map(event => event.monitorKey)).length,
    affectedDomainChannelCount: events.length,
    provenanceOnlyChangeCount,
    semanticFactsCreated: 0,
    blockersClosed: 0,
    optimizerPromotions: 0,
    automaticVerifications: 0
  };
}

export function auditAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const evaluation = options.evaluation || evaluateInputs(options, contentHash);
  const policy = options.policy || {};
  const expected = evaluation.valid ? constructRecords(evaluation, policy, contentHash) : [];
  const expectedKeys = expected.map(record => record.monitorKey);
  const actualKeys = records.map(record => record.monitorKey);
  const recordHashesAreValid = records.every(record => recordHashesValid(record, contentHash));
  const recordsMatchExpected = same(records, expected);
  const accountFindings = findAccountState(records);
  const allChannels = records.flatMap(record => record.channelMonitors || []);
  const queryBindingCount = allChannels.reduce((sum, channel) => sum + (channel.queryDefinitions || []).length, 0);
  const sourceBindingCount = allChannels.reduce((sum, channel) => sum + (channel.sourceBindings || []).length, 0);
  const distinctSourceRevisionCount = unique(allChannels.flatMap(channel => (channel.sourceBindings || []).map(source => `${source.pageId}|${source.sourceRevision}|${source.contentHash}`))).length;
  const allFingerprintsValid = allChannels.every(channel => ['queryDefinitionFingerprint', 'queryResultFingerprint', 'sourceRevisionFingerprint', 'signalFingerprint', 'evidenceFingerprint'].every(field => validHash(channel[field])));
  const everyDomainHasAllChannels = records.every(record => same(sorted((record.channelMonitors || []).map(channel => channel.channelKey)), EXPECTED_CHANNELS));
  const routeCoverageValid = allChannels.every(channel => channel.changeRoute === policy.channelChangeRoutes?.[channel.channelKey]);
  const baselineChangeCount = records.reduce((sum, record) => sum + Number(record.changeEvents?.length || 0) + Number(record.changeDetected === true), 0);
  const promotionCount = records.filter(record => record.existingBlockerStatus !== 'open' || record.blockersClosed !== 0
    || record.semanticFactsCreated !== 0 || record.optimizerEligible !== false || record.verifiedBestAuthorized !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false).length;
  const duplicateKeys = actualKeys.filter((key, index) => actualKeys.indexOf(key) !== index);
  const blockers = [];
  if (!evaluation.compiled.valid) blockers.push('monitoring_registry_policy_invalid');
  for (const [check, valid] of Object.entries(evaluation.checks)) if (!valid) blockers.push(`input_integrity_failed:${check}`);
  if (records.length !== Number(policy.expectedBlockerCount) || unique(records.map(record => record.candidateKey)).length !== Number(policy.expectedCandidateCount)) blockers.push('registry_candidate_or_blocker_count_mismatch');
  if (duplicateKeys.length || !same(actualKeys, expectedKeys)) blockers.push('registry_monitor_key_set_mismatch');
  if (!everyDomainHasAllChannels || allChannels.length !== Number(policy.expectedBlockerCount) * Number(policy.expectedChannelCountPerBlocker)) blockers.push('registry_channel_coverage_incomplete');
  if (queryBindingCount !== Number(policy.expectedQueryBindingCount)) blockers.push('registry_query_binding_coverage_incomplete');
  if (!allFingerprintsValid) blockers.push('one_or_more_registry_fingerprints_invalid');
  if (!routeCoverageValid) blockers.push('one_or_more_change_routes_invalid');
  if (baselineChangeCount) blockers.push('baseline_registry_incorrectly_reported_change');
  if (!recordHashesAreValid || !recordsMatchExpected) blockers.push('registry_record_integrity_or_reconstruction_failed');
  if (promotionCount || accountFindings.length) blockers.push('registry_changed_fact_optimizer_account_or_authority_state');
  const registryComplete = blockers.length === 0;
  return {
    contract: policy.auditContract,
    inputIntegrity: {
      complete: evaluation.valid,
      checks: evaluation.checks,
      synthesisRecordCount: evaluation.synthesisRecords.length,
      synthesisRebuildPublishable: evaluation.rebuilt.audit.publishable === true
    },
    registryCoverage: {
      expectedCandidateCount: Number(policy.expectedCandidateCount),
      candidateCount: unique(records.map(record => record.candidateKey)).length,
      expectedBlockerCount: Number(policy.expectedBlockerCount),
      blockerMonitorCount: records.length,
      channelMonitorCount: allChannels.length,
      queryBindingCount,
      sourceBindingCount,
      distinctSourceRevisionCount,
      everyDomainHasAllChannels
    },
    fingerprintCoverage: {
      queryDefinitionFingerprintCount: allChannels.filter(channel => validHash(channel.queryDefinitionFingerprint)).length,
      queryResultFingerprintCount: allChannels.filter(channel => validHash(channel.queryResultFingerprint)).length,
      sourceRevisionFingerprintCount: allChannels.filter(channel => validHash(channel.sourceRevisionFingerprint)).length,
      signalFingerprintCount: allChannels.filter(channel => validHash(channel.signalFingerprint)).length,
      evidenceFingerprintCount: allChannels.filter(channel => validHash(channel.evidenceFingerprint)).length,
      allFingerprintsValid
    },
    routingSafety: {
      routeCoverageValid,
      baselineChangeCount,
      targetedDomainChannelRoutingSupported: routeCoverageValid && everyDomainHasAllChannels,
      artifactProvenanceExcludedFromEvidenceFingerprints: true,
      historicalChangesRequireCurrentHeadReconciliation: records.every(record => record.channelMonitors?.filter(channel => channel.channelKey === 'historical_update_archive_search').every(channel => channel.currentHeadReconciliationRequiredBeforeReview === true))
    },
    blockerPreservation: {
      allBlockersRemainOpen: records.every(record => record.existingBlockerStatus === 'open'),
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizationCount: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: accountFindings.length,
      completeWikiUniverseClaimCount: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    policyValidation: evaluation.compiled,
    invalidPolicyRules: unique([
      ...evaluation.compiled.invalidBindings,
      ...evaluation.compiled.invalidRules,
      ...evaluation.compiled.forbiddenPolicyPaths,
      ...(evaluation.compiled.routeKeysValid ? [] : ['channelChangeRouteKeys']),
      ...(evaluation.compiled.routesDistinct ? [] : ['channelChangeRoutesDistinct'])
    ]),
    recordsMatchExpected,
    recordHashesValid: recordHashesAreValid,
    registryComplete,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable: registryComplete,
    blockers: unique(blockers)
  };
}

export function buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(options = {}) {
  const contentHash = options.contentHash || hash;
  const evaluation = evaluateInputs(options, contentHash);
  const records = evaluation.valid ? constructRecords(evaluation, options.policy || {}, contentHash) : [];
  return {
    records,
    audit: auditAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(records, { ...options, evaluation, contentHash })
  };
}
