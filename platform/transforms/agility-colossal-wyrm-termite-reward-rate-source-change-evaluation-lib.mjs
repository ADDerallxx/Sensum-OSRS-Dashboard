import { hash, json } from '../ingestion/lib.mjs';
import {
  detectAgilityColossalWyrmTermiteRewardRateSourceChanges,
  validateAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistryRecord
} from './agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-lib.mjs';

const REQUIRED_RULES = [
  'baselineAndCurrentReportsAndSnapshotsMustBeExplicitlySelected',
  'bothRegistryReportsManifestsPayloadsRecordsPoliciesAuditsAndNestedFingerprintsMustRevalidate',
  'currentRegistryMustNotPredateBaselineRegistry',
  'blockerMonitorKeySetsMustMatchExactly',
  'onlyEvidenceFingerprintChangesMayCreateEvents',
  'artifactProvenanceOnlyChangesCannotCreateEvents',
  'oneEventPerChangedBlockerDomain',
  'everyEventMustRetainExactBaselineAndCurrentBindings',
  'changedDimensionsAndRoutesMustBeDerivedRatherThanSupplied',
  'structuralDriftMustFailClosedWithoutCreatingGuessedEvents',
  'eventsOnlyRequeueExactDiscoveryAndSufficiencyEvidenceWork',
  'unchangedEvaluationMayPublishAnEmptyEventSnapshot',
  'allExistingBlockersRemainOpenPendingSeparateEvidenceBoundReviewAndApplication',
  'evaluationCannotCreateFactsResolveMechanicsOrPromoteOptimizerState',
  'optimizerEligibilityVerifiedBestAndAutomaticVerificationAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
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

function parseRaw(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { records: [], error: 'raw_payload_missing_or_empty' };
  try { return { records: raw.trimEnd().split(/\r?\n/).filter(Boolean).map(JSON.parse), error: null }; }
  catch { return { records: [], error: 'raw_payload_invalid_ndjson' }; }
}

function recordHashesValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && validHash(record?.contentHash)
    && record.recordContentHash === contentHash(without(record, ['recordContentHash', 'contentHash']))
    && record.contentHash === contentHash(without(record, ['contentHash']));
}

function reportAudit(report = {}) {
  return without(report, ['generatedAt', 'policy', 'inputs', 'outputSnapshot', 'contentHash']);
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (/^(?:blocker|blockers|field|fields|route|routes|title|titles|pageId|pageIds|revision|revisions|queryKey|queryKeys|override|overrides)$/i.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluationPolicy(policy = {}, registryPolicy = {}, contentHash = hash) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-policy.v1',
    inputManifestContract: 'sensum.ingestion-manifest.v1',
    inputDomain: 'agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry',
    inputRecordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry.v1',
    inputAuditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-audit.v1',
    inputPolicy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-policy.v1',
    recordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-event.v1',
    auditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-audit.v1',
    outputDomain: 'agility-colossal-wyrm-termite-reward-rate-source-change-evaluation',
    expectedBlockerMonitorCount: 6,
    expectedQueryBindingCount: 47,
    expectedSourceBindingOccurrenceCount: 353,
    expectedDistinctSourceRevisionCount: 71,
    expectedSignalBindingCount: 30
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const registryPolicyBindingValid = registryPolicy.policy === policy.inputPolicy
    && validHash(policy.inputPolicyContentHash) && contentHash(registryPolicy) === policy.inputPolicyContentHash;
  const forbiddenSelectors = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidBindings.length && !invalidRules.length && registryPolicyBindingValid && !forbiddenSelectors.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    registryPolicyBindingValid,
    forbiddenSelectors
  };
}

function validateRegistryInput(label, input = {}, policy = {}, registryPolicy = {}, contentHash = hash) {
  const report = input.report || {};
  const manifest = input.manifest || {};
  const parsed = parseRaw(input.raw);
  const records = parsed.records;
  const queryBindingCount = records.reduce((sum, record) => sum + (record.queryMonitors || []).length, 0);
  const sourceBindingOccurrenceCount = records.reduce((sum, record) => sum + (record.sourceMonitors || []).length, 0);
  const distinctSourceRevisionCount = unique(records.flatMap(record => (record.sourceMonitors || []).map(source => source.monitorKey))).length;
  const signalBindingCount = records.reduce((sum, record) => sum + (record.signalMonitors || []).length, 0);
  const monitorKeys = records.map(record => record.monitorKey);
  const accountState = accountFindings([report, manifest, records]);
  const reportGeneratedAt = Date.parse(report.generatedAt || '');
  const manifestCreatedAt = Date.parse(manifest.createdAt || '');
  const checks = {
    rawParses: !parsed.error,
    manifestContractValid: manifest.contract === policy.inputManifestContract,
    manifestDomainValid: manifest.domain === policy.inputDomain,
    manifestRecordCountValid: Number(manifest.records) === records.length,
    manifestContentHashValid: manifest.contentHash === contentHash(input.raw || ''),
    reportHashValid: validHash(report.contentHash) && report.contentHash === contentHash(without(report, ['contentHash'])),
    reportContractValid: report.contract === policy.inputAuditContract,
    reportPublishableAndComplete: report.publishable === true && report.registryComplete === true,
    reportOutputBindingValid: report.outputSnapshot?.directory === input.snapshotDirectory
      && report.outputSnapshot?.contentHash === manifest.contentHash
      && Number(report.outputSnapshot?.records) === records.length,
    reportAndManifestTimeValid: Number.isFinite(reportGeneratedAt) && Number.isFinite(manifestCreatedAt)
      && manifestCreatedAt >= reportGeneratedAt,
    reportPolicyBindingValid: report.policy?.id === policy.inputPolicy
      && report.policy?.contentHash === policy.inputPolicyContentHash,
    manifestPolicyBindingValid: manifest.source?.policy?.id === policy.inputPolicy
      && manifest.source?.policy?.contentHash === policy.inputPolicyContentHash,
    selectedRegistryPolicyValid: registryPolicy.policy === policy.inputPolicy
      && contentHash(registryPolicy) === policy.inputPolicyContentHash,
    reportAuditMatchesManifestAudit: same(reportAudit(report), manifest.source?.audit),
    monitorCountValid: records.length === policy.expectedBlockerMonitorCount,
    monitorKeysUnique: unique(monitorKeys).length === monitorKeys.length,
    recordContractsValid: records.every(record => record.contract === policy.inputRecordContract),
    recordMonitorKeysDerived: records.every(record => record.monitorKey === contentHash({ blocker: record.blocker, evidenceObjective: record.evidenceObjective })),
    recordAndNestedHashesValid: records.length > 0 && records.every(record => recordHashesValid(record, contentHash)
      && validateAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistryRecord(record, contentHash)),
    nestedMonitorKeysUnique: records.every(record => [record.queryMonitors, record.sourceMonitors, record.signalMonitors]
      .every(monitors => unique((monitors || []).map(monitor => monitor.monitorKey)).length === (monitors || []).length)),
    everySignalSourceBoundToDiscoveredRevision: records.every(record => (record.signalMonitors || []).every(signal => {
      const source = signal.assessment?.source || {};
      return (record.sourceMonitors || []).some(monitor => monitor.source.pageId === Number(source.pageId)
        && monitor.source.sourceRevision === String(source.sourceRevision));
    })),
    recordAuthorityGatesClosed: records.every(record => record.existingBlockerStatus === 'open'
      && record.existingBlockerPreserved === true && record.changeDetected === false
      && (record.changeEvents || []).length === 0 && record.blockersClosed === 0
      && record.semanticFactsCreated === 0 && record.mechanicallyResolved === false
      && record.optimizerEligible === false && record.verifiedBestAuthorized === false
      && record.automaticVerificationApplied === false && record.accountIndependent === true
      && record.completeWikiUniverseClaimed === false),
    recordEvidenceRoutesValid: records.every(record => record.nextEvidenceWork?.includes('rerun_the_same_policy_bound_queries_on_relevant_source_change')),
    queryBindingCountValid: queryBindingCount === policy.expectedQueryBindingCount,
    sourceBindingOccurrenceCountValid: sourceBindingOccurrenceCount === policy.expectedSourceBindingOccurrenceCount,
    distinctSourceRevisionCountValid: distinctSourceRevisionCount === policy.expectedDistinctSourceRevisionCount,
    signalBindingCountValid: signalBindingCount === policy.expectedSignalBindingCount,
    reportCoverageMatchesDerived: Number(report.registryCoverage?.blockerMonitorCount) === records.length
      && Number(report.registryCoverage?.queryBindingCount) === queryBindingCount
      && Number(report.registryCoverage?.sourceBindingOccurrenceCount) === sourceBindingOccurrenceCount
      && Number(report.registryCoverage?.distinctSourceRevisionCount) === distinctSourceRevisionCount
      && Number(report.registryCoverage?.signalBindingCount) === signalBindingCount
      && report.registryCoverage?.everyDiscoveredSourceOccurrenceMonitored === true
      && report.registryCoverage?.everySignalSourceBoundToDiscoveredRevision === true,
    reportFingerprintAndRoutingGatesValid: report.fingerprintCoverage?.allFingerprintsValid === true
      && report.fingerprintCoverage?.evidenceDimensionsSeparated === true
      && Number(report.routingSafety?.baselineChangeCount) === 0
      && report.routingSafety?.targetedBlockerRoutingSupported === true
      && report.routingSafety?.artifactProvenanceExcludedFromEvidenceFingerprints === true
      && report.routingSafety?.structuralDriftFailsClosed === true,
    reportAuthorityGatesClosed: Number(report.authorityBoundary?.openBlockers) === policy.expectedBlockerMonitorCount
      && Number(report.authorityBoundary?.mechanicallyResolvedBlockers) === 0
      && Number(report.authorityBoundary?.blockersClosed) === 0
      && Number(report.authorityBoundary?.semanticFactsCreated) === 0
      && Number(report.authorityBoundary?.optimizerEligibleRecords) === 0
      && Number(report.authorityBoundary?.verifiedBestAuthorizations) === 0
      && Number(report.authorityBoundary?.automaticVerifications) === 0
      && Number(report.authorityBoundary?.accountStateFindingCount) === 0
      && Number(report.authorityBoundary?.completeWikiUniverseClaims) === 0,
    noAccountState: accountState.length === 0
  };
  return {
    label,
    valid: Object.values(checks).every(Boolean),
    checks,
    records,
    monitorKeys: sorted(monitorKeys),
    createdAt: manifest.createdAt || null,
    snapshotContentHash: manifest.contentHash || null,
    accountStateFindings: accountState
  };
}

function evaluateInputs(options = {}, contentHash = hash) {
  const policy = options.policy || {};
  const registryPolicy = options.registryPolicy || {};
  const policyValidation = compileAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluationPolicy(policy, registryPolicy, contentHash);
  const baseline = validateRegistryInput('baseline', options.baseline, policy, registryPolicy, contentHash);
  const current = validateRegistryInput('current', options.current, policy, registryPolicy, contentHash);
  const baselineTime = Date.parse(baseline.createdAt || '');
  const currentTime = Date.parse(current.createdAt || '');
  const currentNotBeforeBaseline = Number.isFinite(baselineTime) && Number.isFinite(currentTime) && currentTime >= baselineTime;
  const monitorKeySetsMatch = same(baseline.monitorKeys, current.monitorKeys);
  const valid = policyValidation.valid && baseline.valid && current.valid && currentNotBeforeBaseline && monitorKeySetsMatch;
  return { valid, policyValidation, baseline, current, currentNotBeforeBaseline, monitorKeySetsMatch };
}

function eventRecord(event, baseline, current, policy, contentHash = hash) {
  const baselineRecord = baseline.records.find(record => record.monitorKey === event.monitorKey);
  const currentRecord = current.records.find(record => record.monitorKey === event.monitorKey);
  const binding = (input, record) => ({
    registrySnapshotContentHash: input.snapshotContentHash,
    registryRecordContentHash: record.contentHash,
    inputLineage: record.inputLineage,
    fingerprints: record.fingerprints
  });
  const baselineBinding = binding(baseline, baselineRecord);
  const currentBinding = binding(current, currentRecord);
  const base = {
    contract: policy.recordContract,
    changeKey: `${event.monitorKey}|${contentHash({ baselineBinding, currentBinding, changedDimensions: event.changedDimensions })}`,
    monitorKey: event.monitorKey,
    field: currentRecord.field,
    route: currentRecord.route,
    blocker: event.blocker,
    evidenceObjective: currentRecord.evidenceObjective,
    changedDimensions: [...event.changedDimensions],
    changeRoute: event.route,
    baselineBinding,
    currentBinding,
    evidenceWorkRequeued: true,
    requiresDiscoveryAndSufficiencyRerun: true,
    changeIsNotAGameFact: true,
    existingBlockerStatus: 'open',
    blockersClosed: 0,
    semanticFactsCreated: 0,
    mechanicallyResolved: false,
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

function expectedEvents(evaluation, policy, registryPolicy, contentHash = hash) {
  const empty = {
    records: [],
    detection: { events: [], affectedMonitorCount: 0, provenanceOnlyChangeCount: 0, semanticFactsCreated: 0, blockersClosed: 0, optimizerPromotions: 0, verifiedBestAuthorizations: 0, automaticVerifications: 0 },
    unexpectedStructuralEvent: false
  };
  if (!evaluation.valid) return empty;
  const detection = detectAgilityColossalWyrmTermiteRewardRateSourceChanges(
    evaluation.baseline.records, evaluation.current.records, registryPolicy, contentHash
  );
  const unexpectedStructuralEvent = detection.events.some(event => !event.monitorKey || event.changedDimensions?.includes('registry_structure'));
  if (unexpectedStructuralEvent) return { ...empty, detection, unexpectedStructuralEvent };
  const records = detection.events.map(event => eventRecord(event, evaluation.baseline, evaluation.current, policy, contentHash))
    .sort((left, right) => left.changeKey.localeCompare(right.changeKey));
  return { records, detection, unexpectedStructuralEvent };
}

export function auditAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policy = options.policy || {};
  const registryPolicy = options.registryPolicy || {};
  const evaluation = options.evaluation || evaluateInputs(options, contentHash);
  const expected = expectedEvents(evaluation, policy, registryPolicy, contentHash);
  const recordsMatchExpected = same(records, expected.records);
  const hashesValid = records.every(record => recordHashesValid(record, contentHash));
  const duplicateChangeKeys = records.map(record => record.changeKey).filter((key, index, all) => all.indexOf(key) !== index);
  const accountState = accountFindings([records]);
  const unsafeRecords = records.filter(record => record.changeRoute !== registryPolicy.changeRoute
    || record.evidenceWorkRequeued !== true || record.requiresDiscoveryAndSufficiencyRerun !== true
    || record.changeIsNotAGameFact !== true || record.existingBlockerStatus !== 'open'
    || record.blockersClosed !== 0 || record.semanticFactsCreated !== 0 || record.mechanicallyResolved !== false
    || record.optimizerEligible !== false || record.verifiedBestAuthorized !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false);
  const dimensionCounts = Object.fromEntries(sorted(unique(records.flatMap(record => record.changedDimensions || [])))
    .map(dimension => [dimension, records.filter(record => record.changedDimensions.includes(dimension)).length]));
  const blockers = [];
  if (!evaluation.policyValidation.valid) blockers.push('source_change_evaluation_policy_invalid');
  for (const input of [evaluation.baseline, evaluation.current]) {
    for (const [check, valid] of Object.entries(input.checks)) if (!valid) blockers.push(`${input.label}_registry_integrity_failed:${check}`);
  }
  if (!evaluation.currentNotBeforeBaseline) blockers.push('current_registry_predates_or_lacks_valid_baseline_time');
  if (!evaluation.monitorKeySetsMatch || expected.unexpectedStructuralEvent) blockers.push('registry_monitor_population_changed_fail_closed');
  if (duplicateChangeKeys.length) blockers.push('duplicate_change_event_keys');
  if (!recordsMatchExpected || !hashesValid) blockers.push('change_event_reconstruction_or_hash_validation_failed');
  if (unsafeRecords.length || accountState.length) blockers.push('change_evaluation_created_fact_mechanic_optimizer_account_or_authority_state');
  const publishable = blockers.length === 0;
  return {
    contract: policy.auditContract,
    policyValidation: evaluation.policyValidation,
    inputIntegrity: {
      baseline: { complete: evaluation.baseline.valid, checks: evaluation.baseline.checks, snapshotContentHash: evaluation.baseline.snapshotContentHash },
      current: { complete: evaluation.current.valid, checks: evaluation.current.checks, snapshotContentHash: evaluation.current.snapshotContentHash }
    },
    temporalOrdering: {
      baselineCreatedAt: evaluation.baseline.createdAt,
      currentCreatedAt: evaluation.current.createdAt,
      currentNotBeforeBaseline: evaluation.currentNotBeforeBaseline
    },
    populationContinuity: {
      baselineMonitorCount: evaluation.baseline.records.length,
      currentMonitorCount: evaluation.current.records.length,
      monitorKeySetsMatch: evaluation.monitorKeySetsMatch
    },
    changeCoverage: {
      changeDetected: records.length > 0,
      changeEventCount: records.length,
      affectedMonitorCount: expected.detection.affectedMonitorCount,
      provenanceOnlyChangeCount: expected.detection.provenanceOnlyChangeCount,
      dimensionCounts
    },
    routingCoverage: {
      changeRoute: registryPolicy.changeRoute,
      everyEventRequeuesOnlyExactEvidenceWork: records.every(record => record.changeRoute === registryPolicy.changeRoute
        && record.evidenceWorkRequeued === true && record.requiresDiscoveryAndSufficiencyRerun === true
        && record.changeIsNotAGameFact === true),
      unchangedEvaluationPublishedAsEmptyEventSet: records.length === 0 && evaluation.valid,
      structuralDriftFailsClosed: !expected.unexpectedStructuralEvent
    },
    authorityBoundary: {
      existingBlockersRemainOpen: records.every(record => record.existingBlockerStatus === 'open'),
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      mechanicallyResolvedEvents: records.filter(record => record.mechanicallyResolved).length,
      optimizerEligibleEvents: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizations: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerifications: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: accountState.length,
      completeWikiUniverseClaims: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    recordsMatchExpected,
    recordHashesValid: hashesValid,
    changeEvaluationComplete: publishable,
    mechanicalCompletenessProven: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_colossal_wyrm_reward_mechanics_not_authoritative',
    publishable,
    blockers: unique(blockers)
  };
}

export function buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(options = {}) {
  const contentHash = options.contentHash || hash;
  const evaluation = evaluateInputs(options, contentHash);
  const expected = expectedEvents(evaluation, options.policy || {}, options.registryPolicy || {}, contentHash);
  const records = evaluation.valid && !expected.unexpectedStructuralEvent ? expected.records : [];
  const audit = auditAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(records, { ...options, evaluation, contentHash });
  return { records: audit.publishable ? records : [], audit };
}
