import { hash } from './lib.mjs';
import { auditAgilityGapWikiDiscovery, buildAgilityGapWikiDiscovery } from './agility-mechanical-gap-wiki-discovery-lib.mjs';

const REQUIRED_RULES = [
  'basePolicyCandidatesQueriesBlockersAndDiagnosticsMustBeInheritedExactly',
  'basePolicyHashMustMatchExactly',
  'currentWikiNamespaceRegistryMustResolveEveryDeclaredChannelExactly',
  'articleNamespaceMustRemainExcluded',
  'everyReturnedPageMustBelongToADeclaredNonArticleSourceChannel',
  'everyReturnedPageMustResolveToItsCurrentRevisionAndExactTitle',
  'sandboxAndUserWorkspacePagesCannotBecomeEvidenceSignals',
  'sourceCodeSignalsOnlyRouteManualSemanticReaudit',
  'sourceCodeSilenceIsNotWikiOrGameFactAbsence',
  'blockersFactsRatesMechanicsAndOptimizerStateCannotChange',
  'currentAccountStateIsForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];
const EXPECTED_CHANNELS = [
  { namespaceId: 10, canonicalName: 'Template' },
  { namespaceId: 116, canonicalName: 'Calculator' },
  { namespaceId: 828, canonicalName: 'Module' }
];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right, contentHash = hash) => contentHash({ value: left }) === contentHash({ value: right });

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

export function compileAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy(
  policy = {}, basePolicy = {}, namespaceRegistry = {}, contentHash = hash
) {
  const expectedBindings = {
    policy: 'sensum.agility-target-condition-gap-template-module-source-discovery-policy.v1',
    basePolicy: 'sensum.agility-target-condition-gap-wiki-discovery-policy.v1',
    basePolicyFile: 'platform/policies/agility-target-condition-gap-wiki-discovery-v1.json',
    recordContract: 'sensum.agility-target-condition-gap-template-module-source-discovery.v1',
    auditContract: 'sensum.agility-target-condition-gap-template-module-source-discovery-audit.v1',
    outputDomain: 'agility-target-condition-gap-template-module-source-discovery',
    searchApiOrigin: 'https://oldschool.runescape.wiki/api.php',
    searchResultLimitPerQuery: 50
  };
  const invalidBindings = Object.entries(expectedBindings).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const basePolicyBindingValid = basePolicy.policy === policy.basePolicy
    && policy.basePolicyContentHash === contentHash(basePolicy);
  const channelsExact = same(policy.sourceChannels, EXPECTED_CHANNELS, contentHash)
    && same(policy.searchNamespaces, EXPECTED_CHANNELS.map(channel => channel.namespaceId), contentHash)
    && same(policy.evidenceExclusionTitlePatterns, ['(?:^|:)Sandbox(?:/|$)', '(?:^|/)User:[^/]+/'], contentHash)
    && !policy.searchNamespaces?.includes(0);
  const registry = namespaceMap(namespaceRegistry);
  const namespaceRegistryExact = EXPECTED_CHANNELS.every(channel => {
    const actual = registry.get(channel.namespaceId);
    return actual?.id === channel.namespaceId
      && (actual.canonical || actual.name) === channel.canonicalName;
  });
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidBindings.length && !invalidRules.length && basePolicyBindingValid
      && channelsExact && namespaceRegistryExact && !forbidden.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    basePolicyBindingValid,
    channelsExact,
    namespaceRegistryExact,
    forbiddenPolicyPaths: forbidden
  };
}

export function resolveAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy(policy = {}, basePolicy = {}) {
  return {
    ...structuredClone(basePolicy),
    policy: policy.policy,
    recordContract: policy.recordContract,
    auditContract: policy.auditContract,
    searchApiOrigin: policy.searchApiOrigin,
    searchResultLimitPerQuery: policy.searchResultLimitPerQuery,
    searchNamespaces: structuredClone(policy.searchNamespaces),
    evidenceExclusionTitlePatterns: structuredClone(policy.evidenceExclusionTitlePatterns),
    sourceChannels: structuredClone(policy.sourceChannels),
    basePolicy: policy.basePolicy,
    basePolicyFile: policy.basePolicyFile,
    basePolicyContentHash: policy.basePolicyContentHash,
    outputDomain: policy.outputDomain
  };
}

function sourceChannelCoverage(searchResponses = [], revisionPages = [], records = [], policy = {}, namespaceRegistry = {}) {
  const allowed = new Set((policy.searchNamespaces || []).map(Number));
  const declared = new Map((policy.sourceChannels || []).map(channel => [Number(channel.namespaceId), channel.canonicalName]));
  const registry = namespaceMap(namespaceRegistry);
  const searchResultPages = searchResponses.flatMap(response => response.pages || []);
  const returnedNamespaceCounts = Object.fromEntries((policy.sourceChannels || []).map(channel => [channel.canonicalName, 0]));
  const exclusionPatterns = (policy.evidenceExclusionTitlePatterns || []).map(pattern => new RegExp(pattern, 'i'));
  const excludedWorkspacePages = revisionPages.filter(page => exclusionPatterns.some(pattern => pattern.test(page.title || '')));
  for (const page of revisionPages) {
    const name = declared.get(Number(page.ns));
    if (name) returnedNamespaceCounts[name] += 1;
  }
  return {
    declaredChannels: structuredClone(policy.sourceChannels || []),
    declaredNamespaceIds: structuredClone(policy.searchNamespaces || []),
    articleNamespaceExcluded: !allowed.has(0),
    currentNamespaceRegistryMatches: [...declared.entries()].every(([id, name]) => {
      const current = registry.get(id);
      return current?.id === id && (current.canonical || current.name) === name;
    }),
    searchResponseNamespaceScopesExact: searchResponses.every(response => same(response.namespaces, policy.searchNamespaces)),
    returnedSearchPageCount: searchResultPages.length,
    returnedSearchPagesUseDeclaredNamespaces: searchResultPages.every(page => allowed.has(Number(page.namespaceId))),
    returnedRevisionPageCount: revisionPages.length,
    evidenceEligibleRevisionPageCount: revisionPages.length - excludedWorkspacePages.length,
    excludedWorkspacePageCount: excludedWorkspacePages.length,
    excludedWorkspacePageTitles: sorted(excludedWorkspacePages.map(page => page.title)),
    returnedRevisionPagesUseDeclaredNamespaces: revisionPages.every(page => allowed.has(Number(page.ns))),
    returnedRevisionTitlesUseDeclaredPrefixes: revisionPages.every(page => {
      const name = declared.get(Number(page.ns));
      return Boolean(name) && String(page.title || '').startsWith(`${name}:`);
    }),
    recordedDiscoveredPageCount: records.reduce((sum, record) => sum + (record.discoveredPages || []).length, 0),
    recordedPageTitlesUseDeclaredPrefixes: records.every(record => (record.discoveredPages || []).every(page => [...declared.values()].some(name => String(page.title || '').startsWith(`${name}:`)))),
    returnedNamespaceCounts
  };
}

export function auditAgilityTargetConditionGapTemplateModuleSourceDiscovery(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyCoverage = compileAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy(
    options.policy, options.basePolicy, options.namespaceRegistry, contentHash
  );
  const resolvedPolicy = resolveAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy(options.policy, options.basePolicy);
  const genericAudit = auditAgilityGapWikiDiscovery(records, { ...options, policy: resolvedPolicy, contentHash });
  const channels = sourceChannelCoverage(options.searchResponses || [], options.revisionPages || [], records, options.policy || {}, options.namespaceRegistry || {});
  const accountFindings = accountStateFindings([options.coverageReport || {}, options.sourceSufficiencyReport || {}, ...records]);
  const sourceChannelsValid = channels.articleNamespaceExcluded
    && channels.currentNamespaceRegistryMatches
    && channels.searchResponseNamespaceScopesExact
    && channels.returnedSearchPagesUseDeclaredNamespaces
    && channels.returnedRevisionPagesUseDeclaredNamespaces
    && channels.returnedRevisionTitlesUseDeclaredPrefixes
    && channels.recordedPageTitlesUseDeclaredPrefixes;
  const blockers = [...genericAudit.blockers];
  if (!policyCoverage.valid) blockers.push('template_module_source_discovery_policy_invalid');
  if (!sourceChannelsValid) blockers.push('one_or_more_search_or_revision_pages_outside_verified_source_channels');
  if (accountFindings.length) blockers.push('account_query_state_baked_into_source_channel_discovery');
  const publishable = genericAudit.publishable && policyCoverage.valid && sourceChannelsValid && accountFindings.length === 0;
  return {
    ...genericAudit,
    contract: options.policy?.auditContract,
    policyCoverage,
    sourceChannelCoverage: channels,
    accountStateFindings: accountFindings,
    queryBoundedDiscoveryComplete: publishable,
    sourceDiscoveryDispositionStable: publishable && genericAudit.evidenceDomainCoverage.potentialEvidenceSignalCount === 0,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable,
    blockers: unique(blockers)
  };
}

export function buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(options = {}) {
  const contentHash = options.contentHash || hash;
  const resolvedPolicy = resolveAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy(options.policy, options.basePolicy);
  const generic = buildAgilityGapWikiDiscovery({ ...options, policy: resolvedPolicy, contentHash });
  const audit = auditAgilityTargetConditionGapTemplateModuleSourceDiscovery(generic.records, { ...options, contentHash });
  return { records: audit.publishable ? generic.records : [], audit };
}
