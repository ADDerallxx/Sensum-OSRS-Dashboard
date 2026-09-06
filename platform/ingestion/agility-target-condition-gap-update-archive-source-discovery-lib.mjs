import { hash } from './lib.mjs';
import { buildAgilityGapWikiDiscovery } from './agility-mechanical-gap-wiki-discovery-lib.mjs';

const REQUIRED_RULES = [
  'basePolicyCandidatesQueriesBlockersAndDiagnosticsMustBeInheritedExactly',
  'basePolicyHashMustMatchExactly',
  'currentWikiNamespaceRegistryMustResolveUpdateExactly',
  'onlyUpdateNamespaceMayBeSearched',
  'everyReturnedPageMustResolveToItsCurrentRevisionAndExactTitle',
  'everySignalMustBeMarkedHistoricalAndRequireCurrentHeadReconciliation',
  'explicitOldToNewLanguageStillCannotEstablishCurrentStateAlone',
  'historicalSignalsOnlyRouteManualSemanticReaudit',
  'archiveSilenceIsNotWikiOrGameFactAbsence',
  'blockersFactsRatesMechanicsAndOptimizerStateCannotChange',
  'currentAccountStateIsForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];
const EXPECTED_CHANNELS = [{ namespaceId: 112, canonicalName: 'Update' }];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right, contentHash = hash) => contentHash({ value: left }) === contentHash({ value: right });
const withoutHashes = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:candidate|candidates|query|queries|blocker|blockers|diagnostic|diagnostics|name|names|title|titles|pageId|pageIds|revision|revisions|alias|aliases|override|overrides|exception|exceptions)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|accountSnapshot|player|playerState|username|profile|currentBaseLevel|currentLevel|currentXp|bank|owned|ownedItems|ownedEquipment|inventory|budget|preferences|completedQuests)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  values.forEach((value, index) => visit(value, `[${index}]`));
  return sorted(unique(findings));
}

function namespaceMap(registry = {}) {
  const namespaces = registry.query?.namespaces || registry.namespaces || {};
  return new Map(Object.values(namespaces).map(entry => [Number(entry.id), entry]));
}

export function compileAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy(
  policy = {}, basePolicy = {}, namespaceRegistry = {}, contentHash = hash
) {
  const expectedBindings = {
    policy: 'sensum.agility-target-condition-gap-update-archive-source-discovery-policy.v1',
    basePolicy: 'sensum.agility-target-condition-gap-wiki-discovery-policy.v1',
    basePolicyFile: 'platform/policies/agility-target-condition-gap-wiki-discovery-v1.json',
    recordContract: 'sensum.agility-target-condition-gap-update-archive-source-discovery.v1',
    auditContract: 'sensum.agility-target-condition-gap-update-archive-source-discovery-audit.v1',
    outputDomain: 'agility-target-condition-gap-update-archive-source-discovery',
    searchApiOrigin: 'https://oldschool.runescape.wiki/api.php',
    searchResultLimitPerQuery: 50,
    sourceTemporalClass: 'historical_update_archive',
    signalTemporalDisposition: 'historical_signal_requires_current_head_reconciliation'
  };
  const invalidBindings = Object.entries(expectedBindings).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const basePolicyBindingValid = basePolicy.policy === policy.basePolicy
    && policy.basePolicyContentHash === contentHash(basePolicy);
  const channelExact = same(policy.sourceChannels, EXPECTED_CHANNELS, contentHash)
    && same(policy.searchNamespaces, [112], contentHash);
  const registry = namespaceMap(namespaceRegistry);
  const update = registry.get(112);
  const namespaceRegistryExact = update?.id === 112 && (update.canonical || update.name) === 'Update';
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidBindings.length && !invalidRules.length && basePolicyBindingValid
      && channelExact && namespaceRegistryExact && !forbidden.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    basePolicyBindingValid,
    channelExact,
    namespaceRegistryExact,
    forbiddenPolicyPaths: forbidden
  };
}

export function resolveAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy(policy = {}, basePolicy = {}) {
  return {
    ...structuredClone(basePolicy),
    policy: policy.policy,
    recordContract: policy.recordContract,
    auditContract: policy.auditContract,
    searchApiOrigin: policy.searchApiOrigin,
    searchResultLimitPerQuery: policy.searchResultLimitPerQuery,
    searchNamespaces: structuredClone(policy.searchNamespaces),
    sourceChannels: structuredClone(policy.sourceChannels),
    basePolicy: policy.basePolicy,
    basePolicyFile: policy.basePolicyFile,
    basePolicyContentHash: policy.basePolicyContentHash,
    outputDomain: policy.outputDomain
  };
}

function historicalRecord(record, policy, contentHash = hash) {
  const evidenceDomains = (record.evidenceDomains || []).map(domain => ({
    ...structuredClone(domain),
    potentialEvidenceSignals: (domain.potentialEvidenceSignals || []).map(signal => ({
      ...structuredClone(signal),
      sourceTemporalClass: policy.sourceTemporalClass,
      temporalDisposition: policy.signalTemporalDisposition,
      currentStateAuthority: false,
      currentHeadReconciliationRequired: true,
      mayApplyCurrentFact: false
    }))
  }));
  const historicalSignalCount = evidenceDomains.reduce((sum, domain) => sum + domain.potentialEvidenceSignals.length, 0);
  const base = {
    ...withoutHashes(record),
    evidenceDomains,
    sourceTemporalClass: policy.sourceTemporalClass,
    currentStateAuthority: false,
    historicalSignalsRequireCurrentHeadReconciliation: true,
    historicalSignalCount,
    currentHeadReconciliationRequiredCount: historicalSignalCount,
    currentFactApplications: 0
  };
  const withRecordHash = { ...base, recordContentHash: contentHash(base) };
  return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
}

function expectedRecords(options = {}, contentHash = hash) {
  const resolvedPolicy = resolveAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy(options.policy, options.basePolicy);
  const generic = buildAgilityGapWikiDiscovery({ ...options, policy: resolvedPolicy, contentHash });
  return { generic, records: generic.records.map(record => historicalRecord(record, options.policy || {}, contentHash)) };
}

function updateArchiveCoverage(searchResponses = [], revisionPages = [], policy = {}, namespaceRegistry = {}) {
  const registry = namespaceMap(namespaceRegistry);
  const update = registry.get(112);
  const searchPages = searchResponses.flatMap(response => response.pages || []);
  return {
    declaredChannel: structuredClone(policy.sourceChannels?.[0] || null),
    currentNamespaceRegistryMatches: update?.id === 112 && (update.canonical || update.name) === 'Update',
    onlyUpdateNamespaceDeclared: same(policy.searchNamespaces, [112]),
    searchResponseNamespaceScopesExact: searchResponses.every(response => same(response.namespaces, [112])),
    returnedSearchPageCount: searchPages.length,
    returnedSearchPagesUseUpdateNamespace: searchPages.every(page => Number(page.namespaceId) === 112),
    returnedRevisionPageCount: revisionPages.length,
    returnedRevisionPagesUseUpdateNamespace: revisionPages.every(page => Number(page.ns) === 112),
    returnedRevisionTitlesUseUpdatePrefix: revisionPages.every(page => String(page.title || '').startsWith('Update:'))
  };
}

function temporalAuthorityCoverage(records = [], policy = {}) {
  const signals = records.flatMap(record => (record.evidenceDomains || []).flatMap(domain => domain.potentialEvidenceSignals || []));
  return {
    historicalSignalCount: signals.length,
    currentStateAuthoritySignalCount: signals.filter(signal => signal.currentStateAuthority === true).length,
    currentHeadReconciliationRequiredCount: signals.filter(signal => signal.currentHeadReconciliationRequired === true).length,
    currentFactApplicationCount: records.reduce((sum, record) => sum + Number(record.currentFactApplications || 0), 0),
    everySignalMarkedHistorical: signals.every(signal => signal.sourceTemporalClass === policy.sourceTemporalClass
      && signal.temporalDisposition === policy.signalTemporalDisposition),
    everySignalWithholdsCurrentAuthority: signals.every(signal => signal.currentStateAuthority === false
      && signal.currentHeadReconciliationRequired === true && signal.mayApplyCurrentFact === false),
    everyRecordWithholdsCurrentAuthority: records.every(record => record.sourceTemporalClass === policy.sourceTemporalClass
      && record.currentStateAuthority === false
      && record.historicalSignalsRequireCurrentHeadReconciliation === true
      && record.historicalSignalCount === record.currentHeadReconciliationRequiredCount
      && record.currentFactApplications === 0)
  };
}

export function auditAgilityTargetConditionGapUpdateArchiveSourceDiscovery(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyCoverage = compileAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy(
    options.policy, options.basePolicy, options.namespaceRegistry, contentHash
  );
  const expected = expectedRecords(options, contentHash);
  const genericAudit = expected.generic.audit;
  const archive = updateArchiveCoverage(options.searchResponses || [], options.revisionPages || [], options.policy || {}, options.namespaceRegistry || {});
  const temporal = temporalAuthorityCoverage(records, options.policy || {});
  const accountFindings = accountStateFindings([options.coverageReport || {}, options.sourceSufficiencyReport || {}, ...records]);
  const recordsMatchExpected = same(records, expected.records, contentHash);
  const recordHashesValid = records.every(record => record.recordContentHash === contentHash(withoutHashes(record))
    && record.contentHash === contentHash(Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'contentHash'))));
  const archiveValid = archive.currentNamespaceRegistryMatches && archive.onlyUpdateNamespaceDeclared
    && archive.searchResponseNamespaceScopesExact && archive.returnedSearchPagesUseUpdateNamespace
    && archive.returnedRevisionPagesUseUpdateNamespace && archive.returnedRevisionTitlesUseUpdatePrefix;
  const temporalValid = temporal.currentStateAuthoritySignalCount === 0
    && temporal.currentHeadReconciliationRequiredCount === temporal.historicalSignalCount
    && temporal.currentFactApplicationCount === 0 && temporal.everySignalMarkedHistorical
    && temporal.everySignalWithholdsCurrentAuthority && temporal.everyRecordWithholdsCurrentAuthority;
  const unsupportedPromotions = records.filter(record => record.blockersClosed !== 0 || record.semanticFactsCreated !== 0
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false
    || record.accountIndependent !== true || record.completeWikiUniverseClaimed !== false
    || record.currentStateAuthority !== false || record.currentFactApplications !== 0);
  const blockers = [...genericAudit.blockers];
  if (!policyCoverage.valid) blockers.push('update_archive_source_discovery_policy_invalid');
  if (!archiveValid) blockers.push('one_or_more_search_or_revision_pages_outside_verified_update_namespace');
  if (!recordsMatchExpected || !recordHashesValid) blockers.push('historical_update_records_do_not_match_exact_reconstruction');
  if (!temporalValid) blockers.push('historical_signal_missing_current_state_non_authority_or_reconciliation_gate');
  if (accountFindings.length) blockers.push('account_query_state_baked_into_update_archive_discovery');
  if (unsupportedPromotions.length) blockers.push('historical_update_discovery_created_unsupported_fact_or_optimizer_promotion');
  const publishable = genericAudit.publishable && policyCoverage.valid && archiveValid && recordsMatchExpected
    && recordHashesValid && temporalValid && accountFindings.length === 0 && unsupportedPromotions.length === 0;
  return {
    ...genericAudit,
    contract: options.policy?.auditContract,
    policyCoverage,
    updateArchiveCoverage: archive,
    temporalAuthorityCoverage: temporal,
    recordsMatchExpected,
    recordHashesValid,
    accountStateFindings: accountFindings,
    unsupportedPromotionRecords: unsupportedPromotions.map(record => record.candidateKey || 'unknown'),
    queryBoundedDiscoveryComplete: publishable,
    sourceDiscoveryDispositionStable: publishable && genericAudit.evidenceDomainCoverage.potentialEvidenceSignalCount === 0,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable,
    blockers: unique(blockers)
  };
}

export function buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(options = {}) {
  const contentHash = options.contentHash || hash;
  const expected = expectedRecords(options, contentHash);
  const audit = auditAgilityTargetConditionGapUpdateArchiveSourceDiscovery(expected.records, { ...options, contentHash });
  return { records: audit.publishable ? expected.records : [], audit };
}
