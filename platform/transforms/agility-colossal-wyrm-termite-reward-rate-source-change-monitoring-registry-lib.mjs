import { hash, json } from '../ingestion/lib.mjs';
import { buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition } from './agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-lib.mjs';

const REQUIRED_RULES = [
  'discoveryAndSufficiencyReportsSnapshotsRecordsAndPoliciesMustBeExplicitAndRevalidated',
  'sufficiencyMustRebuildExactlyFromTheSelectedDiscoverySnapshot',
  'oneRegistryRecordPerOpenBlockerDomain',
  'everyBoundQueryDefinitionAndResultSetMustBeMonitored',
  'everyDiscoveredSourceRevisionAndContentHashMustBeMonitored',
  'everyClassifiedSignalAndSufficiencyDispositionMustBeMonitored',
  'queryDefinitionResultSourceSignalAndDispositionFingerprintsMustRemainDistinct',
  'baselineRegistryCreationCannotReportAChange',
  'artifactProvenanceChurnWithoutEvidenceChangeCannotTriggerWork',
  'onlyChangedBlockerDomainsMayRouteTargetedEvidenceWork',
  'registryPopulationDriftMustFailClosedWithoutGuessingAffectedDomains',
  'changeEventsAreEvidenceWorkSignalsAndNeverGameFacts',
  'allExistingBlockersRemainOpenPendingSeparateEvidenceBoundReviewAndApplication',
  'registryCannotCreateFactsResolveMechanicsOrPromoteOptimizerState',
  'optimizerEligibilityVerifiedBestAndAutomaticVerificationAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
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

function reportHashValid(report = {}, contentHash = hash) {
  return validHash(report.contentHash) && report.contentHash === contentHash(without(report, ['contentHash']));
}

function reportAudit(report = {}) {
  return without(report, ['generatedAt', 'policy', 'input', 'outputSnapshot', 'contentHash']);
}

export function compileAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistryPolicy(policy = {}, discoveryPolicy = {}, sufficiencyPolicy = {}, contentHash = hash) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-policy.v1',
    inputManifestContract: 'sensum.ingestion-manifest.v1',
    discoveryDomain: 'agility-colossal-wyrm-termite-reward-rate-source-discovery',
    discoveryRecordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery.v1',
    discoveryAuditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-audit.v1',
    discoveryPolicy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-policy.v1',
    sufficiencyDomain: 'agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition',
    sufficiencyRecordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition.v1',
    sufficiencyAuditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-audit.v1',
    sufficiencyPolicy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-policy.v1',
    recordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry.v1',
    auditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-audit.v1',
    outputDomain: 'agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry',
    expectedBlockerCount: 6,
    expectedQueryBindingCount: 47,
    expectedSourceBindingOccurrenceCount: 353,
    expectedDistinctSourceRevisionCount: 71,
    expectedSignalBindingCount: 30,
    changeRoute: 'rerun_exact_policy_bound_source_discovery_and_source_sufficiency_disposition',
    structuralChangeRoute: 'fail_closed_monitor_registry_structure_reconciliation_required'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const discoveryPolicyBindingValid = discoveryPolicy.policy === policy.discoveryPolicy
    && validHash(policy.discoveryPolicyContentHash)
    && contentHash(discoveryPolicy) === policy.discoveryPolicyContentHash;
  const sufficiencyPolicyBindingValid = sufficiencyPolicy.policy === policy.sufficiencyPolicy
    && validHash(policy.sufficiencyPolicyContentHash)
    && contentHash(sufficiencyPolicy) === policy.sufficiencyPolicyContentHash;
  const forbiddenSelectors = [];
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (/^(?:blocker|blockers|field|fields|route|routes|title|titles|pageId|pageIds|revision|revisions|queryKey|queryKeys|override|overrides)$/i.test(key)) forbiddenSelectors.push(next);
      visit(child, next);
    }
  };
  visit(policy.rules);
  return {
    valid: !invalidBindings.length && !invalidRules.length && discoveryPolicyBindingValid
      && sufficiencyPolicyBindingValid && !forbiddenSelectors.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    discoveryPolicyBindingValid,
    sufficiencyPolicyBindingValid,
    forbiddenSelectors: sorted(unique(forbiddenSelectors))
  };
}

function inputLineage(options = {}, contentHash = hash) {
  const {
    discoveryAudit = {}, discoveryManifest = {}, discoveryRecords = [], discoveryPolicy = {},
    sufficiencyAudit = {}, sufficiencyManifest = {}, sufficiencyRecords = [], sufficiencyPolicy = {}, policy = {}
  } = options;
  const rebuilt = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition({
    discoveryAudit, discoveryManifest, discoveryRecords, inputPolicy: discoveryPolicy,
    policy: sufficiencyPolicy, contentHash
  });
  const checks = {
    discoveryAuditHashValid: reportHashValid(discoveryAudit, contentHash),
    discoveryAuditContractValid: discoveryAudit.contract === policy.discoveryAuditContract,
    discoveryAuditPublishable: discoveryAudit.publishable === true,
    discoveryManifestContractValid: discoveryManifest.contract === policy.inputManifestContract,
    discoveryManifestDomainValid: discoveryManifest.domain === policy.discoveryDomain,
    discoveryManifestHashValid: discoveryManifest.contentHash === recordsHash(discoveryRecords),
    discoveryManifestCountValid: Number(discoveryManifest.records) === discoveryRecords.length,
    discoveryOutputBindingValid: discoveryAudit.outputSnapshot?.directory === discoveryManifest.snapshotDirectory
      && discoveryAudit.outputSnapshot?.contentHash === discoveryManifest.contentHash
      && Number(discoveryAudit.outputSnapshot?.records) === discoveryRecords.length,
    discoveryRecordsValid: discoveryRecords.length === policy.expectedBlockerCount
      && discoveryRecords.every(record => record.contract === policy.discoveryRecordContract && recordHashesValid(record, contentHash)),
    discoveryPolicyValid: discoveryPolicy.policy === policy.discoveryPolicy
      && contentHash(discoveryPolicy) === policy.discoveryPolicyContentHash,
    sufficiencyAuditHashValid: reportHashValid(sufficiencyAudit, contentHash),
    sufficiencyAuditContractValid: sufficiencyAudit.contract === policy.sufficiencyAuditContract,
    sufficiencyAuditPublishable: sufficiencyAudit.publishable === true && sufficiencyAudit.sourceSufficiencyDispositionComplete === true,
    sufficiencyManifestContractValid: sufficiencyManifest.contract === policy.inputManifestContract,
    sufficiencyManifestDomainValid: sufficiencyManifest.domain === policy.sufficiencyDomain,
    sufficiencyManifestHashValid: sufficiencyManifest.contentHash === recordsHash(sufficiencyRecords),
    sufficiencyManifestCountValid: Number(sufficiencyManifest.records) === sufficiencyRecords.length,
    sufficiencyOutputBindingValid: sufficiencyAudit.outputSnapshot?.directory === sufficiencyManifest.snapshotDirectory
      && sufficiencyAudit.outputSnapshot?.contentHash === sufficiencyManifest.contentHash
      && Number(sufficiencyAudit.outputSnapshot?.records) === sufficiencyRecords.length,
    sufficiencyRecordsValid: sufficiencyRecords.length === policy.expectedBlockerCount
      && sufficiencyRecords.every(record => record.contract === policy.sufficiencyRecordContract && recordHashesValid(record, contentHash)),
    sufficiencyPolicyValid: sufficiencyPolicy.policy === policy.sufficiencyPolicy
      && contentHash(sufficiencyPolicy) === policy.sufficiencyPolicyContentHash,
    sufficiencyAuditDiscoveryBindingValid: sufficiencyAudit.input?.audit?.contentHash === discoveryAudit.contentHash
      && sufficiencyAudit.input?.snapshot?.directory === discoveryManifest.snapshotDirectory
      && sufficiencyAudit.input?.snapshot?.contentHash === discoveryManifest.contentHash,
    sufficiencyManifestDiscoveryBindingValid: sufficiencyManifest.source?.input?.audit?.contentHash === discoveryAudit.contentHash
      && sufficiencyManifest.source?.input?.snapshot?.directory === discoveryManifest.snapshotDirectory
      && sufficiencyManifest.source?.input?.snapshot?.contentHash === discoveryManifest.contentHash,
    sufficiencyPolicyBindingsValid: sufficiencyAudit.policy?.id === policy.sufficiencyPolicy
      && sufficiencyAudit.policy?.contentHash === policy.sufficiencyPolicyContentHash
      && sufficiencyManifest.source?.policy?.id === policy.sufficiencyPolicy
      && sufficiencyManifest.source?.policy?.contentHash === policy.sufficiencyPolicyContentHash,
    sufficiencyRebuildPublishable: rebuilt.audit.publishable === true,
    sufficiencyRebuildRecordsExact: same(rebuilt.records, sufficiencyRecords),
    sufficiencyRebuildAuditExact: same(rebuilt.audit, reportAudit(sufficiencyAudit)),
    sufficiencyManifestAuditExact: same(rebuilt.audit, sufficiencyManifest.source?.audit)
  };
  return { valid: Object.values(checks).every(Boolean), checks, rebuilt };
}

function queryMonitor(query = {}, contentHash = hash) {
  const definition = {
    queryKey: query.queryKey,
    channelKey: query.channelKey,
    searchText: query.searchText,
    maxResults: Number(query.maxResults),
    namespaces: [...(query.namespaces || [])]
  };
  const result = {
    queryKey: query.queryKey,
    reportedTotalHits: Number(query.reportedTotalHits),
    fetchedResultCount: Number(query.fetchedResultCount),
    resultPageIds: [...(query.resultPageIds || [])],
    resultSetHash: query.resultSetHash,
    paginationComplete: query.paginationComplete === true,
    truncated: query.truncated === true
  };
  return {
    monitorKey: `${query.channelKey}|${query.queryKey}`,
    definition,
    result,
    queryDefinitionFingerprint: contentHash(definition),
    queryResultFingerprint: contentHash(result)
  };
}

function sourceMonitor(page = {}, contentHash = hash) {
  const source = {
    pageId: Number(page.pageId),
    namespaceId: Number(page.namespaceId),
    title: page.title,
    sourceRevision: String(page.sourceRevision),
    sourceTimestamp: page.sourceTimestamp,
    sourceUrl: page.sourceUrl,
    contentHash: page.contentHash,
    contentBytes: Number(page.contentBytes),
    matchedChannelKeys: sorted(page.matchedChannelKeys || []),
    matchedQueryKeys: sorted(page.matchedQueryKeys || []),
    exactSearchIdentityResolved: page.exactSearchIdentityResolved === true,
    excludedFromEvidence: page.excludedFromEvidence === true
  };
  return {
    monitorKey: `${source.pageId}|${source.sourceRevision}`,
    source,
    sourceRevisionContentFingerprint: contentHash(source)
  };
}

function signalMonitor(assessment = {}, contentHash = hash) {
  return {
    monitorKey: contentHash(assessment),
    assessment,
    signalFingerprint: contentHash(assessment)
  };
}

function aggregateFingerprints(queryMonitors, sourceMonitors, signalMonitors, sufficiency, contentHash = hash) {
  const queryDefinitionFingerprint = contentHash(queryMonitors.map(monitor => ({ monitorKey: monitor.monitorKey, fingerprint: monitor.queryDefinitionFingerprint })));
  const queryResultFingerprint = contentHash(queryMonitors.map(monitor => ({ monitorKey: monitor.monitorKey, fingerprint: monitor.queryResultFingerprint })));
  const sourceRevisionContentFingerprint = contentHash(sourceMonitors.map(monitor => ({ monitorKey: monitor.monitorKey, fingerprint: monitor.sourceRevisionContentFingerprint })));
  const signalFingerprint = contentHash(signalMonitors.map(monitor => ({ monitorKey: monitor.monitorKey, fingerprint: monitor.signalFingerprint })));
  const sufficiencyDispositionFingerprint = contentHash(sufficiency);
  return {
    queryDefinitionFingerprint,
    queryResultFingerprint,
    sourceRevisionContentFingerprint,
    signalFingerprint,
    sufficiencyDispositionFingerprint,
    evidenceFingerprint: contentHash({
      queryDefinitionFingerprint, queryResultFingerprint, sourceRevisionContentFingerprint,
      signalFingerprint, sufficiencyDispositionFingerprint
    })
  };
}

function constructRecords(options = {}, contentHash = hash) {
  const discoveryByBlocker = new Map((options.discoveryRecords || []).map(record => [record.blocker, record]));
  return [...(options.sufficiencyRecords || [])].sort((left, right) => left.blocker.localeCompare(right.blocker)).map(sufficiency => {
    const discovery = discoveryByBlocker.get(sufficiency.blocker) || {};
    const queryMonitors = (discovery.searchQueries || []).map(query => queryMonitor(query, contentHash))
      .sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
    const sourceMonitors = (discovery.discoveredPages || []).map(page => sourceMonitor(page, contentHash))
      .sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
    const signalMonitors = (sufficiency.signalAssessments || []).map(signal => signalMonitor(signal, contentHash))
      .sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
    const disposition = {
      evidenceObjective: sufficiency.evidenceObjective,
      requiredEvidenceShape: sufficiency.requiredEvidenceShape,
      sufficiencyDisposition: sufficiency.sufficiencyDisposition,
      manualSemanticReviewRequired: sufficiency.manualSemanticReviewRequired,
      nextEvidenceWork: [...(sufficiency.nextEvidenceWork || [])]
    };
    const fingerprints = aggregateFingerprints(queryMonitors, sourceMonitors, signalMonitors, disposition, contentHash);
    const base = {
      contract: options.policy.recordContract,
      monitorKey: contentHash({ blocker: sufficiency.blocker, evidenceObjective: sufficiency.evidenceObjective }),
      field: sufficiency.field,
      route: sufficiency.route,
      blocker: sufficiency.blocker,
      evidenceObjective: sufficiency.evidenceObjective,
      requiredEvidenceShape: sufficiency.requiredEvidenceShape,
      sufficiencyDisposition: sufficiency.sufficiencyDisposition,
      manualSemanticReviewRequired: sufficiency.manualSemanticReviewRequired,
      existingBlockerStatus: 'open',
      inputLineage: {
        discovery: {
          auditContentHash: options.discoveryAudit?.contentHash,
          snapshotDirectory: options.discoveryManifest?.snapshotDirectory,
          snapshotContentHash: options.discoveryManifest?.contentHash
        },
        sufficiency: {
          auditContentHash: options.sufficiencyAudit?.contentHash,
          snapshotDirectory: options.sufficiencyManifest?.snapshotDirectory,
          snapshotContentHash: options.sufficiencyManifest?.contentHash
        }
      },
      queryMonitors,
      sourceMonitors,
      signalMonitors,
      fingerprints,
      monitoringState: 'baseline_registered_no_change',
      changeDetected: false,
      changeEvents: [],
      nextEvidenceWork: [...(sufficiency.nextEvidenceWork || [])],
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

function recordInternalsValid(record = {}, contentHash = hash) {
  const queriesValid = (record.queryMonitors || []).every(monitor => monitor.queryDefinitionFingerprint === contentHash(monitor.definition)
    && monitor.queryResultFingerprint === contentHash(monitor.result)
    && monitor.monitorKey === `${monitor.definition?.channelKey}|${monitor.definition?.queryKey}`);
  const sourcesValid = (record.sourceMonitors || []).every(monitor => monitor.sourceRevisionContentFingerprint === contentHash(monitor.source)
    && monitor.monitorKey === `${Number(monitor.source?.pageId)}|${String(monitor.source?.sourceRevision)}`);
  const signalsValid = (record.signalMonitors || []).every(monitor => monitor.signalFingerprint === contentHash(monitor.assessment)
    && monitor.monitorKey === monitor.signalFingerprint);
  const expected = aggregateFingerprints(record.queryMonitors || [], record.sourceMonitors || [], record.signalMonitors || [], {
    evidenceObjective: record.evidenceObjective,
    requiredEvidenceShape: record.requiredEvidenceShape,
    sufficiencyDisposition: record.sufficiencyDisposition,
    manualSemanticReviewRequired: record.manualSemanticReviewRequired,
    nextEvidenceWork: [...(record.nextEvidenceWork || [])]
  }, contentHash);
  return queriesValid && sourcesValid && signalsValid
    && validHash(record.fingerprints?.queryDefinitionFingerprint)
    && validHash(record.fingerprints?.queryResultFingerprint)
    && validHash(record.fingerprints?.sourceRevisionContentFingerprint)
    && validHash(record.fingerprints?.signalFingerprint)
    && validHash(record.fingerprints?.sufficiencyDispositionFingerprint)
    && validHash(record.fingerprints?.evidenceFingerprint)
    && record.fingerprints.queryDefinitionFingerprint === expected.queryDefinitionFingerprint
    && record.fingerprints.queryResultFingerprint === expected.queryResultFingerprint
    && record.fingerprints.sourceRevisionContentFingerprint === expected.sourceRevisionContentFingerprint
    && record.fingerprints.signalFingerprint === expected.signalFingerprint
    && record.fingerprints.sufficiencyDispositionFingerprint === expected.sufficiencyDispositionFingerprint
    && record.fingerprints.evidenceFingerprint === expected.evidenceFingerprint;
}

function structuralEvent(policy, reason) {
  return {
    monitorKey: null,
    blocker: null,
    changedDimensions: ['registry_structure'],
    reason,
    route: policy.structuralChangeRoute,
    blockerRemainsOpen: true,
    semanticFactCreated: false,
    mechanicallyResolved: false,
    optimizerEligible: false,
    verifiedBestAuthorized: false,
    automaticVerificationApplied: false
  };
}

export function detectAgilityColossalWyrmTermiteRewardRateSourceChanges(baselineRecords = [], currentRecords = [], policy = {}, contentHash = hash) {
  const baselineKeys = sorted(baselineRecords.map(record => record.monitorKey));
  const currentKeys = sorted(currentRecords.map(record => record.monitorKey));
  const policyShapeValid = policy.changeRoute && policy.structuralChangeRoute;
  const recordsValid = [...baselineRecords, ...currentRecords].every(record => record.contract === policy.recordContract
    && recordHashesValid(record, contentHash) && recordInternalsValid(record, contentHash));
  if (!policyShapeValid || !same(baselineKeys, currentKeys) || unique(baselineKeys).length !== baselineKeys.length || !recordsValid) {
    return {
      events: [structuralEvent(policy, !policyShapeValid ? 'monitoring_policy_invalid' : !recordsValid ? 'registry_record_integrity_failed' : 'blocker_monitor_population_changed')],
      affectedMonitorCount: 0,
      provenanceOnlyChangeCount: 0,
      semanticFactsCreated: 0,
      blockersClosed: 0,
      optimizerPromotions: 0,
      verifiedBestAuthorizations: 0,
      automaticVerifications: 0
    };
  }
  const currentByKey = new Map(currentRecords.map(record => [record.monitorKey, record]));
  const events = [];
  let provenanceOnlyChangeCount = 0;
  for (const baseline of baselineRecords) {
    const current = currentByKey.get(baseline.monitorKey);
    const changedDimensions = [];
    if (baseline.fingerprints.queryDefinitionFingerprint !== current.fingerprints.queryDefinitionFingerprint) changedDimensions.push('query_definition');
    if (baseline.fingerprints.queryResultFingerprint !== current.fingerprints.queryResultFingerprint) changedDimensions.push('query_result_set');
    if (baseline.fingerprints.sourceRevisionContentFingerprint !== current.fingerprints.sourceRevisionContentFingerprint) changedDimensions.push('source_revision_or_content');
    if (baseline.fingerprints.signalFingerprint !== current.fingerprints.signalFingerprint) changedDimensions.push('classified_signal');
    if (baseline.fingerprints.sufficiencyDispositionFingerprint !== current.fingerprints.sufficiencyDispositionFingerprint) changedDimensions.push('sufficiency_disposition');
    if (changedDimensions.length) {
      events.push({
        monitorKey: baseline.monitorKey,
        blocker: baseline.blocker,
        changedDimensions,
        route: policy.changeRoute,
        blockerRemainsOpen: true,
        semanticFactCreated: false,
        mechanicallyResolved: false,
        optimizerEligible: false,
        verifiedBestAuthorized: false,
        automaticVerificationApplied: false
      });
    } else if (!same(baseline.inputLineage, current.inputLineage)) provenanceOnlyChangeCount += 1;
  }
  return {
    events,
    affectedMonitorCount: events.length,
    provenanceOnlyChangeCount,
    semanticFactsCreated: 0,
    blockersClosed: 0,
    optimizerPromotions: 0,
    verifiedBestAuthorizations: 0,
    automaticVerifications: 0
  };
}

export function auditAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistryPolicy(
    options.policy, options.discoveryPolicy, options.sufficiencyPolicy, contentHash
  );
  const lineage = inputLineage(options, contentHash);
  const expected = constructRecords(options, contentHash);
  const recordsMatchExpected = same(records, expected);
  const recordHashesAreValid = records.length > 0 && records.every(record => recordHashesValid(record, contentHash) && recordInternalsValid(record, contentHash));
  const queryBindingCount = records.reduce((sum, record) => sum + (record.queryMonitors || []).length, 0);
  const sourceBindingOccurrenceCount = records.reduce((sum, record) => sum + (record.sourceMonitors || []).length, 0);
  const distinctSourceRevisionCount = unique(records.flatMap(record => (record.sourceMonitors || []).map(monitor => monitor.monitorKey))).length;
  const signalBindingCount = records.reduce((sum, record) => sum + (record.signalMonitors || []).length, 0);
  const blockerCount = records.length;
  const blockerSetExact = same(sorted(records.map(record => record.blocker)), sorted((options.discoveryRecords || []).map(record => record.blocker)))
    && unique(records.map(record => record.blocker)).length === records.length;
  const everySignalSourceBoundToDiscoveredRevision = records.every(record => (record.signalMonitors || []).every(signal => {
    const source = signal.assessment?.source || {};
    return (record.sourceMonitors || []).some(monitor => monitor.source.pageId === Number(source.pageId)
      && monitor.source.sourceRevision === String(source.sourceRevision));
  }));
  const registryCoverage = {
    blockerMonitorCount: blockerCount,
    queryBindingCount,
    sourceBindingOccurrenceCount,
    distinctSourceRevisionCount,
    signalBindingCount,
    blockerSetExact,
    everySignalSourceBoundToDiscoveredRevision,
    everyDiscoveredSourceOccurrenceMonitored: sourceBindingOccurrenceCount === (options.discoveryRecords || []).reduce((sum, record) => sum + (record.discoveredPages || []).length, 0),
    expectedCountsMatch: blockerCount === options.policy?.expectedBlockerCount
      && queryBindingCount === options.policy?.expectedQueryBindingCount
      && sourceBindingOccurrenceCount === options.policy?.expectedSourceBindingOccurrenceCount
      && distinctSourceRevisionCount === options.policy?.expectedDistinctSourceRevisionCount
      && signalBindingCount === options.policy?.expectedSignalBindingCount
  };
  const allFingerprintsValid = records.every(record => recordInternalsValid(record, contentHash));
  const evidenceDimensionsSeparated = records.every(record => unique([
    record.fingerprints?.queryDefinitionFingerprint,
    record.fingerprints?.queryResultFingerprint,
    record.fingerprints?.sourceRevisionContentFingerprint,
    record.fingerprints?.signalFingerprint,
    record.fingerprints?.sufficiencyDispositionFingerprint
  ]).length === 5);
  const fingerprintCoverage = {
    queryDefinitionFingerprints: queryBindingCount,
    queryResultFingerprints: queryBindingCount,
    sourceRevisionContentFingerprints: sourceBindingOccurrenceCount,
    signalFingerprints: signalBindingCount,
    sufficiencyDispositionFingerprints: blockerCount,
    blockerEvidenceFingerprints: blockerCount,
    allFingerprintsValid,
    evidenceDimensionsSeparated
  };
  const baselineChangeCount = records.filter(record => record.changeDetected !== false || (record.changeEvents || []).length !== 0).length;
  const routingSafety = {
    baselineChangeCount,
    targetedBlockerRoutingSupported: records.every(record => record.monitorKey && record.blocker && record.nextEvidenceWork?.includes('rerun_the_same_policy_bound_queries_on_relevant_source_change')),
    artifactProvenanceExcludedFromEvidenceFingerprints: records.every(record => [
      ...Object.values(record.inputLineage?.discovery || {}),
      ...Object.values(record.inputLineage?.sufficiency || {})
    ].filter(value => typeof value === 'string').every(value => !json(record.fingerprints).includes(value))),
    structuralDriftFailsClosed: options.policy?.structuralChangeRoute === 'fail_closed_monitor_registry_structure_reconciliation_required'
  };
  const forbiddenPromotions = records.filter(record => record.existingBlockerStatus !== 'open'
    || record.existingBlockerPreserved !== true || record.mechanicallyResolved !== false
    || record.blockersClosed !== 0 || record.semanticFactsCreated !== 0 || record.optimizerEligible !== false
    || record.verifiedBestAuthorized !== false || record.automaticVerificationApplied !== false
    || record.accountIndependent !== true || record.completeWikiUniverseClaimed !== false);
  const accountStateFindings = accountFindings([
    options.discoveryAudit, options.discoveryManifest, options.discoveryRecords,
    options.sufficiencyAudit, options.sufficiencyManifest, options.sufficiencyRecords, records
  ]);
  const authorityBoundary = {
    openBlockers: records.filter(record => record.existingBlockerStatus === 'open').length,
    mechanicallyResolvedBlockers: records.filter(record => record.mechanicallyResolved).length,
    blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
    semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
    optimizerEligibleRecords: records.filter(record => record.optimizerEligible).length,
    verifiedBestAuthorizations: records.filter(record => record.verifiedBestAuthorized).length,
    automaticVerifications: records.filter(record => record.automaticVerificationApplied).length,
    accountStateFindingCount: accountStateFindings.length,
    completeWikiUniverseClaims: records.filter(record => record.completeWikiUniverseClaimed).length
  };
  const blockers = [];
  if (!policyValidation.valid) blockers.push('source_change_monitoring_registry_policy_invalid');
  if (!lineage.valid) blockers.push('source_change_monitoring_input_lineage_invalid');
  if (!registryCoverage.expectedCountsMatch || !registryCoverage.blockerSetExact
    || !registryCoverage.everyDiscoveredSourceOccurrenceMonitored || !registryCoverage.everySignalSourceBoundToDiscoveredRevision) blockers.push('source_change_monitoring_registry_coverage_incomplete');
  if (!allFingerprintsValid || !evidenceDimensionsSeparated) blockers.push('source_change_monitoring_fingerprint_integrity_failed');
  if (!routingSafety.targetedBlockerRoutingSupported || baselineChangeCount !== 0 || !routingSafety.artifactProvenanceExcludedFromEvidenceFingerprints || !routingSafety.structuralDriftFailsClosed) blockers.push('source_change_monitoring_routing_safety_failed');
  if (!recordsMatchExpected) blockers.push('registry_records_do_not_match_exact_source_bound_reconstruction');
  if (!recordHashesAreValid) blockers.push('one_or_more_registry_record_hashes_invalid');
  if (forbiddenPromotions.length) blockers.push('registry_created_unsupported_fact_mechanic_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('account_state_baked_into_source_change_monitoring_registry');
  const publishable = blockers.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyValidation,
    inputLineage: { valid: lineage.valid, checks: lineage.checks },
    registryCoverage,
    fingerprintCoverage,
    routingSafety,
    authorityBoundary,
    recordsMatchExpected,
    recordHashesValid: recordHashesAreValid,
    registryComplete: publishable,
    mechanicalCompletenessProven: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_colossal_wyrm_reward_mechanics_not_authoritative',
    publishable,
    blockers
  };
}

export function buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(options = {}) {
  const contentHash = options.contentHash || hash;
  const records = constructRecords(options, contentHash);
  const audit = auditAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(records, { ...options, contentHash });
  return { records: audit.publishable ? records : [], audit };
}
