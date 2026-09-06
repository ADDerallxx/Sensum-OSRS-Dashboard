import { hash, json } from '../ingestion/lib.mjs';
import { detectAgilityTargetConditionGapSourceChannelChanges } from './agility-target-condition-gap-source-channel-change-monitoring-registry-lib.mjs';

const REQUIRED_RULES = [
  'baselineAndCurrentReportsAndSnapshotsMustBeExplicitlySelected',
  'bothRegistryReportsManifestsRawPayloadsRecordsPoliciesAuditsAndFingerprintsMustRevalidate',
  'currentRegistryMustNotPredateBaselineRegistry',
  'registryMonitorKeyAndChannelSetsMustMatchExactly',
  'onlyFingerprintChangesCreateChangeEvents',
  'artifactProvenanceOnlyChangesDoNotCreateChangeEvents',
  'oneEventPerChangedDomainChannelPair',
  'everyEventMustRetainExactBaselineAndCurrentFingerprintBindings',
  'changedDimensionsAndRoutesMustBeDerivedNotSupplied',
  'historicalEventsRequireCurrentHeadReconciliationBeforeReview',
  'changeEventsOnlyRequeueEvidenceWorkAndNeverApplySemantics',
  'unchangedEvaluationMayPublishAnEmptyEventSnapshot',
  'blockersRemainOpenUntilSeparateEvidenceBoundHumanReviewAndGuardedApplication',
  'evaluationCannotCloseBlockersCreateFactsOrPromoteOptimizerState',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];
const EXPECTED_CHANNELS = ['current_article_search', 'current_source_code_search', 'historical_update_archive_search'];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));

function parseRaw(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { records: [], error: 'raw_payload_missing_or_empty' };
  try { return { records: raw.trimEnd().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)), error: null }; }
  catch { return { records: [], error: 'raw_payload_invalid_ndjson' }; }
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

export function compileAgilityTargetConditionGapSourceChannelChangeEvaluationPolicy(policy = {}) {
  const expected = {
    inputManifestContract: 'sensum.ingestion-manifest.v1',
    inputDomain: 'agility-target-condition-gap-source-channel-change-monitoring-registry',
    inputRecordContract: 'sensum.agility-target-condition-gap-source-channel-change-monitoring-registry.v1',
    inputAuditContract: 'sensum.agility-target-condition-gap-source-channel-change-monitoring-registry-audit.v1',
    inputPolicy: 'sensum.agility-target-condition-gap-source-channel-change-monitoring-registry-policy.v1',
    inputPolicyFile: 'platform/policies/agility-target-condition-gap-source-channel-change-monitoring-registry-v1.json',
    inputPolicyContentHash: '183f6b061d2a16f525f5520ea6b228b439c082c9ebaed2b39ac2831b0943c90e',
    recordContract: 'sensum.agility-target-condition-gap-source-channel-change-event.v1',
    auditContract: 'sensum.agility-target-condition-gap-source-channel-change-evaluation-audit.v1',
    outputDomain: 'agility-target-condition-gap-source-channel-change-evaluation',
    expectedBlockerMonitorCount: 17,
    expectedChannelMonitorCount: 51,
    expectedQueryBindingCount: 81
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: !invalidBindings.length && !invalidRules.length && !forbidden.length, invalidBindings, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function recordHashesValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && validHash(record?.contentHash)
    && contentHash(without(record, ['recordContentHash', 'contentHash'])) === record.recordContentHash
    && contentHash(without(record, ['contentHash'])) === record.contentHash;
}

function channelFingerprintsValid(channel = {}, contentHash = hash) {
  const queryDefinitionFingerprint = contentHash(channel.queryDefinitions || []);
  const queryResultFingerprint = contentHash(channel.queryResults || []);
  const sourceRevisionFingerprint = contentHash(channel.sourceBindings || []);
  const signalFingerprint = contentHash(channel.signalBindings || []);
  const evidenceFingerprint = contentHash({ queryDefinitionFingerprint, queryResultFingerprint, sourceRevisionFingerprint, signalFingerprint });
  return channel.queryDefinitionFingerprint === queryDefinitionFingerprint
    && channel.queryResultFingerprint === queryResultFingerprint
    && channel.sourceRevisionFingerprint === sourceRevisionFingerprint
    && channel.signalFingerprint === signalFingerprint
    && channel.evidenceFingerprint === evidenceFingerprint;
}

function reportAudit(report = {}) {
  return without(report, ['generatedAt', 'policy', 'inputSynthesis', 'upstreamInputs', 'outputSnapshot', 'contentHash']);
}

function findAccountState(records = []) {
  const findings = [];
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|accountState|accountSnapshot|bank|bankItems|ownedEquipment|preferences)$/i;
  const visit = (value, path, changeKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, changeKey));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push({ changeKey, path: next });
      visit(child, next, changeKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record.changeKey || record.monitorKey || `record-${index}`));
  return findings;
}

function validateRegistrySnapshot(label, input = {}, policy = {}, registryPolicy = {}, contentHash = hash) {
  const { report = {}, manifest = {}, raw = '', snapshotDirectory = null } = input;
  const parsed = parseRaw(raw);
  const records = parsed.records;
  const channels = records.flatMap(record => record.channelMonitors || []);
  const reportHashValid = validHash(report.contentHash) && contentHash({ ...report, contentHash: undefined }) === report.contentHash;
  const monitorKeys = records.map(record => record.monitorKey);
  const duplicateMonitorKeys = monitorKeys.filter((key, index) => monitorKeys.indexOf(key) !== index);
  const checks = {
    rawParses: !parsed.error,
    manifestContractMatches: manifest.contract === policy.inputManifestContract,
    manifestDomainMatches: manifest.domain === policy.inputDomain,
    manifestRecordCountMatches: Number(manifest.records) === records.length,
    manifestRawHashMatches: manifest.contentHash === contentHash(raw),
    reportHashValid,
    reportContractMatches: report.contract === policy.inputAuditContract,
    reportPublishableAndComplete: report.publishable === true && report.registryComplete === true,
    reportOutputHashMatches: report.outputSnapshot?.contentHash === manifest.contentHash,
    reportOutputDirectoryMatches: typeof snapshotDirectory === 'string' && report.outputSnapshot?.directory === snapshotDirectory,
    reportPolicyBindingMatches: report.policy?.id === policy.inputPolicy && report.policy?.contentHash === policy.inputPolicyContentHash,
    manifestPolicyBindingMatches: manifest.source?.policy?.id === policy.inputPolicy && manifest.source?.policy?.contentHash === policy.inputPolicyContentHash,
    selectedRegistryPolicyMatches: registryPolicy.policy === policy.inputPolicy && contentHash(registryPolicy) === policy.inputPolicyContentHash,
    reportAuditMatchesManifestAudit: same(reportAudit(report), manifest.source?.audit),
    recordCountMatchesPolicy: records.length === Number(policy.expectedBlockerMonitorCount),
    monitorKeysUnique: duplicateMonitorKeys.length === 0,
    recordContractsMatch: records.every(record => record.contract === policy.inputRecordContract),
    recordHashesValid: records.length > 0 && records.every(record => recordHashesValid(record, contentHash)),
    recordStateFailClosed: records.every(record => record.existingBlockerStatus === 'open' && record.changeDetected === false
      && (record.changeEvents || []).length === 0 && record.blockersClosed === 0 && record.semanticFactsCreated === 0
      && record.optimizerEligible === false && record.verifiedBestAuthorized === false
      && record.automaticVerificationApplied === false && record.accountIndependent === true
      && record.completeWikiUniverseClaimed === false),
    channelCountMatchesPolicy: channels.length === Number(policy.expectedChannelMonitorCount),
    channelSetsComplete: records.every(record => same(sorted((record.channelMonitors || []).map(channel => channel.channelKey)), EXPECTED_CHANNELS)),
    channelFingerprintsValid: channels.every(channel => channelFingerprintsValid(channel, contentHash)),
    queryBindingsMatchPolicy: channels.reduce((sum, channel) => sum + (channel.queryDefinitions || []).length, 0) === Number(policy.expectedQueryBindingCount),
    queryDefinitionsAndResultsAlign: channels.every(channel => same((channel.queryDefinitions || []).map(query => query.queryKey), (channel.queryResults || []).map(query => query.queryKey))),
    channelRoutesMatchPolicy: channels.every(channel => channel.changeRoute === registryPolicy.channelChangeRoutes?.[channel.channelKey]),
    reportCoverageMatchesDerived: Number(report.registryCoverage?.blockerMonitorCount) === records.length
      && Number(report.registryCoverage?.channelMonitorCount) === channels.length
      && Number(report.registryCoverage?.queryBindingCount) === channels.reduce((sum, channel) => sum + (channel.queryDefinitions || []).length, 0),
    reportSafetyGatesRemainClosed: report.blockerPreservation?.allBlockersRemainOpen === true
      && Number(report.blockerPreservation?.blockersClosed) === 0
      && Number(report.blockerPreservation?.semanticFactsCreated) === 0
      && Number(report.blockerPreservation?.optimizerEligibleCount) === 0
      && Number(report.blockerPreservation?.verifiedBestAuthorizationCount) === 0
      && Number(report.blockerPreservation?.automaticVerificationCount) === 0
      && Number(report.blockerPreservation?.accountStateFindingCount) === 0
      && Number(report.blockerPreservation?.completeWikiUniverseClaimCount) === 0
  };
  return {
    label,
    valid: Object.values(checks).every(Boolean),
    checks,
    report,
    manifest,
    records,
    monitorKeys: sorted(monitorKeys),
    createdAt: manifest.createdAt || null,
    contentHash: manifest.contentHash || null,
    accountStateFindings: findAccountState(records)
  };
}

function channelMap(record) {
  return new Map((record?.channelMonitors || []).map(channel => [channel.channelKey, channel]));
}

function eventRecord(event, baseline, current, policy, contentHash = hash) {
  const baselineRecord = baseline.records.find(record => record.monitorKey === event.monitorKey);
  const currentRecord = current.records.find(record => record.monitorKey === event.monitorKey);
  const baselineChannel = channelMap(baselineRecord).get(event.channelKey);
  const currentChannel = channelMap(currentRecord).get(event.channelKey);
  const binding = (snapshot, record, channel) => ({
    registrySnapshotContentHash: snapshot.contentHash,
    registryRecordContentHash: record.contentHash,
    artifactProvenance: channel.artifactProvenance,
    queryDefinitionFingerprint: channel.queryDefinitionFingerprint,
    queryResultFingerprint: channel.queryResultFingerprint,
    sourceRevisionFingerprint: channel.sourceRevisionFingerprint,
    signalFingerprint: channel.signalFingerprint,
    evidenceFingerprint: channel.evidenceFingerprint
  });
  const baselineBinding = binding(baseline, baselineRecord, baselineChannel);
  const currentBinding = binding(current, currentRecord, currentChannel);
  const base = {
    contract: policy.recordContract,
    changeKey: `${event.monitorKey}|${event.channelKey}|${contentHash({ baselineBinding, currentBinding, changedDimensions: event.changedDimensions })}`,
    monitorKey: event.monitorKey,
    candidateKey: event.candidateKey,
    blocker: event.blocker,
    channelKey: event.channelKey,
    temporalClass: currentChannel.temporalClass,
    changedDimensions: [...event.changedDimensions],
    route: event.route,
    baselineBinding,
    currentBinding,
    evidenceWorkRequeued: true,
    currentHeadReconciliationRequiredBeforeReview: currentChannel.currentHeadReconciliationRequiredBeforeReview === true,
    changeIsNotAGameFact: true,
    existingBlockerStatus: 'open',
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
}

function evaluateInputs(options = {}, contentHash = hash) {
  const policy = options.policy || {};
  const registryPolicy = options.registryPolicy || {};
  const policyValidation = compileAgilityTargetConditionGapSourceChannelChangeEvaluationPolicy(policy);
  const baseline = validateRegistrySnapshot('baseline', options.baseline, policy, registryPolicy, contentHash);
  const current = validateRegistrySnapshot('current', options.current, policy, registryPolicy, contentHash);
  const baselineTime = Date.parse(baseline.createdAt || '');
  const currentTime = Date.parse(current.createdAt || '');
  const temporalOrderingValid = Number.isFinite(baselineTime) && Number.isFinite(currentTime) && currentTime >= baselineTime;
  const monitorKeySetsMatch = same(baseline.monitorKeys, current.monitorKeys);
  const channelSetsMatch = monitorKeySetsMatch && baseline.records.every(record => {
    const other = current.records.find(candidate => candidate.monitorKey === record.monitorKey);
    return same(sorted((record.channelMonitors || []).map(channel => channel.channelKey)), sorted((other?.channelMonitors || []).map(channel => channel.channelKey)));
  });
  const valid = policyValidation.valid && baseline.valid && current.valid && temporalOrderingValid && monitorKeySetsMatch && channelSetsMatch;
  return { valid, policyValidation, baseline, current, temporalOrderingValid, monitorKeySetsMatch, channelSetsMatch };
}

function expectedEvents(evaluation, policy, registryPolicy, contentHash = hash) {
  if (!evaluation.valid) return { records: [], detection: { events: [], affectedMonitorCount: 0, affectedDomainChannelCount: 0, provenanceOnlyChangeCount: 0, semanticFactsCreated: 0, blockersClosed: 0, optimizerPromotions: 0, automaticVerifications: 0 } };
  const detection = detectAgilityTargetConditionGapSourceChannelChanges(evaluation.baseline.records, evaluation.current.records, registryPolicy);
  const records = detection.events.map(event => eventRecord(event, evaluation.baseline, evaluation.current, policy, contentHash))
    .sort((left, right) => left.changeKey.localeCompare(right.changeKey));
  return { records, detection };
}

export function auditAgilityTargetConditionGapSourceChannelChangeEvaluation(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policy = options.policy || {};
  const registryPolicy = options.registryPolicy || {};
  const evaluation = options.evaluation || evaluateInputs(options, contentHash);
  const expected = expectedEvents(evaluation, policy, registryPolicy, contentHash);
  const hashesValid = records.every(record => recordHashesValid(record, contentHash));
  const recordsMatchExpected = same(records, expected.records);
  const accountFindings = findAccountState(records);
  const promotionCount = records.filter(record => record.existingBlockerStatus !== 'open' || record.blockersClosed !== 0
    || record.semanticFactsCreated !== 0 || record.optimizerEligible !== false || record.verifiedBestAuthorized !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false || record.changeIsNotAGameFact !== true).length;
  const routeCounts = Object.fromEntries(unique(records.map(record => record.route)).sort().map(route => [route, records.filter(record => record.route === route).length]));
  const dimensionCounts = Object.fromEntries(unique(records.flatMap(record => record.changedDimensions)).sort().map(dimension => [dimension, records.filter(record => record.changedDimensions.includes(dimension)).length]));
  const duplicateEventKeys = records.map(record => record.changeKey).filter((key, index, all) => all.indexOf(key) !== index);
  const historicalRoutesSafe = records.filter(record => record.channelKey === 'historical_update_archive_search')
    .every(record => record.currentHeadReconciliationRequiredBeforeReview === true && record.route === registryPolicy.channelChangeRoutes?.historical_update_archive_search);
  const blockers = [];
  if (!evaluation.policyValidation.valid) blockers.push('change_evaluation_policy_invalid');
  for (const input of [evaluation.baseline, evaluation.current]) for (const [check, valid] of Object.entries(input.checks)) if (!valid) blockers.push(`${input.label}_registry_integrity_failed:${check}`);
  if (!evaluation.temporalOrderingValid) blockers.push('current_registry_predates_or_lacks_valid_baseline_time');
  if (!evaluation.monitorKeySetsMatch || !evaluation.channelSetsMatch) blockers.push('registry_monitor_or_channel_population_changed_fail_closed');
  if (duplicateEventKeys.length) blockers.push('duplicate_change_event_keys');
  if (!recordsMatchExpected || !hashesValid) blockers.push('change_event_reconstruction_or_hash_validation_failed');
  if (!historicalRoutesSafe) blockers.push('historical_change_event_bypassed_current_head_reconciliation');
  if (promotionCount || accountFindings.length) blockers.push('change_evaluation_created_semantic_optimizer_account_or_authority_state');
  const changeEvaluationComplete = blockers.length === 0;
  return {
    contract: policy.auditContract,
    inputIntegrity: {
      baseline: { complete: evaluation.baseline.valid, checks: evaluation.baseline.checks, snapshotContentHash: evaluation.baseline.contentHash },
      current: { complete: evaluation.current.valid, checks: evaluation.current.checks, snapshotContentHash: evaluation.current.contentHash }
    },
    temporalOrdering: {
      baselineCreatedAt: evaluation.baseline.createdAt,
      currentCreatedAt: evaluation.current.createdAt,
      currentNotBeforeBaseline: evaluation.temporalOrderingValid
    },
    populationContinuity: {
      baselineMonitorCount: evaluation.baseline.records.length,
      currentMonitorCount: evaluation.current.records.length,
      monitorKeySetsMatch: evaluation.monitorKeySetsMatch,
      channelSetsMatch: evaluation.channelSetsMatch
    },
    changeCoverage: {
      changeDetected: records.length > 0,
      changeEventCount: records.length,
      affectedMonitorCount: expected.detection.affectedMonitorCount,
      affectedDomainChannelCount: expected.detection.affectedDomainChannelCount,
      provenanceOnlyChangeCount: expected.detection.provenanceOnlyChangeCount,
      dimensionCounts
    },
    routingCoverage: {
      routeCounts,
      everyEventRequeuesOnlyEvidenceWork: records.every(record => record.evidenceWorkRequeued === true && record.changeIsNotAGameFact === true),
      historicalRoutesRequireCurrentHeadReconciliation: historicalRoutesSafe,
      unchangedEvaluationPublishedAsEmptyEventSet: records.length === 0 && evaluation.valid
    },
    blockerPreservation: {
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizationCount: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: accountFindings.length,
      completeWikiUniverseClaimCount: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    policyValidation: evaluation.policyValidation,
    recordsMatchExpected,
    recordHashesValid: hashesValid,
    changeEvaluationComplete,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable: changeEvaluationComplete,
    blockers: unique(blockers)
  };
}

export function buildAgilityTargetConditionGapSourceChannelChangeEvaluation(options = {}) {
  const contentHash = options.contentHash || hash;
  const evaluation = evaluateInputs(options, contentHash);
  const expected = expectedEvents(evaluation, options.policy || {}, options.registryPolicy || {}, contentHash);
  const records = evaluation.valid ? expected.records : [];
  return { records, audit: auditAgilityTargetConditionGapSourceChannelChangeEvaluation(records, { ...options, evaluation, contentHash }) };
}
