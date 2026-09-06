import { hash } from './lib.mjs';
import { collectSkillTrainingGuideTemplateDependencies } from './skill-training-guide-source-dependency-lib.mjs';
import { buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting } from '../transforms/activity-candidate-missing-supported-infobox-evidence-work-routing-lib.mjs';

const REQUIRED_RULES = [
  'routingSourceEvidenceAndPacketSnapshotsMustBeExplicitlySelected',
  'routingSnapshotAndItsCompleteUpstreamRelationMustRevalidate',
  'everyRetainedRootTemplateInvocationMustProduceExactlyOneEvidenceEntry',
  'candidateSourceMustRefetchByExactBoundRevisionAndMatchIdentityTimestampAndHash',
  'templateSourcesMustUseTheLatestRevisionAtOrBeforeTheCandidateTimestamp',
  'redirectsMustBePreservedAndFollowedWithoutCurrentHeadResolution',
  'redirectLoopsMissingTargetsAndDepthLimitsMustRemainExplicitBlockers',
  'wrapperTagsAndSourceLevelTemplateModuleAndPageInvocationsMustBePreserved',
  'everyPageBackedOneHopDependencyMustReceiveAnAsOfRevisionAssessment',
  'oneHopDependencyEvidenceCannotClaimRecursiveHistoricalExpansionClosure',
  'templateStructureCannotEstablishSubjectIdentityRepeatabilityMembershipRequirementsMechanicsOrEligibility',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
const titleKey = value => normalize(value).toLocaleLowerCase('en');
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const wikiUrl = title => title ? `https://oldschool.runescape.wiki/w/${encodeURIComponent(normalize(title).replaceAll(' ', '_'))}` : null;
const revisionUrl = revision => revision ? `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}` : null;
const sourceKey = (title, timestamp) => `${timestamp}|${titleKey(title)}`;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|route|routes|label|labels|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|route|label|alias).*(?:override|exception)s?$/i;
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

export function compileActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidencePolicy(policy = {}, routingPolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidBindings = [];
  if (policy.policy !== 'sensum.activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-policy.v1') invalidBindings.push('policy');
  if (policy.inputRoutingPolicy !== routingPolicy.policy || policy.inputRoutingPolicyContentHash !== contentHash(routingPolicy)) invalidBindings.push('inputRoutingPolicy');
  if (policy.inputRoutingDomain !== routingPolicy.outputDomain) invalidBindings.push('inputRoutingDomain');
  if (policy.recordContract !== 'sensum.activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence.v1'
    || policy.auditContract !== 'sensum.activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-audit.v1') invalidBindings.push('contracts');
  if (!policy.outputDomain || !policy.recordState) invalidBindings.push('stateOrOutput');
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: !invalidRules.length && !invalidBindings.length && !forbidden.length, invalidRules: unique(invalidRules), invalidBindings, forbiddenPolicyPaths: forbidden };
}

function validIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function withoutOuterHash(record = {}) { const { contentHash, ...value } = record; return value; }
function withoutRecordHash(record = {}) { const { recordContentHash, ...value } = record; return value; }

function snapshotAssessment(raw, records, manifest, snapshot, domain, policyId, policyHash, contentHash = hash) {
  const checks = {
    explicitSnapshotSelected: snapshot?.explicit === true && Boolean(snapshot?.directory),
    manifestContractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === domain,
    recordCountAndRawHashMatch: manifest?.records === records.length && manifest?.contentHash === contentHash(raw),
    snapshotBindingMatchesManifest: snapshot?.contentHash === manifest?.contentHash && snapshot?.createdAt === manifest?.createdAt,
    createdAtValid: validIso(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policyId && manifest?.source?.policy?.contentHash === policyHash,
    intrinsicAndOuterHashesMatch: records.every(record => record.recordContentHash === contentHash(withoutRecordHash(withoutOuterHash(record))) && record.contentHash === contentHash(withoutOuterHash(record)))
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests)$/i;
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

export function historicalRedirectTarget(content = '') {
  const match = String(content).match(/^\s*(?:<!--[^]*?-->\s*)*#redirect\s*\[\[\s*([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]*)?\]\]/i);
  return match ? normalize(match[1]) : null;
}

function sourceIdentity(observation, asOfTimestamp, contentHash = hash) {
  const page = observation?.page || null;
  const revision = page?.revisions?.[0] || null;
  const content = revision?.slots?.main?.content;
  const explicitMissing = Boolean(page && Object.hasOwn(page, 'missing'));
  const timestampAtOrBeforeBoundary = Boolean(revision?.timestamp && Date.parse(revision.timestamp) <= Date.parse(asOfTimestamp));
  return {
    requestedTitle: observation?.requestedTitle || null,
    normalizedTitle: observation?.normalizedTitle || observation?.requestedTitle || null,
    resolvedTitle: page?.title || observation?.normalizedTitle || observation?.requestedTitle || null,
    namespace: page?.ns ?? null,
    sourcePageId: page?.pageid ? Number(page.pageid) : null,
    sourceRevision: revision?.revid ? String(revision.revid) : null,
    sourceTimestamp: revision?.timestamp || null,
    asOfTimestamp,
    timestampAtOrBeforeBoundary,
    sourceUrl: wikiUrl(page?.title),
    sourceExactRevisionUrl: revisionUrl(revision?.revid),
    sourceContentHash: typeof content === 'string' ? contentHash(content) : null,
    sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : 0,
    exactRevisionSourceText: typeof content === 'string' ? content : null,
    explicitMissing
  };
}

function sourceMap(historicalSources = []) {
  return new Map(historicalSources.map(source => [sourceKey(source.requestedTitle, source.asOfTimestamp), source]));
}

function resolveHistoricalChain(requestedTitle, asOfTimestamp, sources, contentHash = hash, maxDepth = 8) {
  const chain = [];
  const visited = new Set();
  let current = normalize(requestedTitle);
  let state = 'blocked_missing_historical_source_observation';
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const key = sourceKey(current, asOfTimestamp);
    if (visited.has(key)) { state = 'blocked_historical_redirect_loop'; break; }
    visited.add(key);
    const observation = sources.get(key);
    if (!observation) break;
    const identity = sourceIdentity(observation, asOfTimestamp, contentHash);
    const redirectTarget = typeof identity.exactRevisionSourceText === 'string' ? historicalRedirectTarget(identity.exactRevisionSourceText) : null;
    chain.push({ ...identity, redirectTarget });
    if (identity.explicitMissing) { state = 'complete_explicit_historical_absence'; break; }
    if (!identity.sourceRevision || !identity.sourceContentHash || !identity.timestampAtOrBeforeBoundary) { state = 'blocked_incomplete_or_misaligned_historical_revision'; break; }
    if (!redirectTarget) { state = 'complete_historical_terminal_source'; break; }
    current = redirectTarget.includes(':') ? redirectTarget : `Template:${redirectTarget}`;
    if (depth === maxDepth - 1) state = 'blocked_historical_redirect_depth_limit';
  }
  return {
    requestedTitle: normalize(requestedTitle),
    asOfTimestamp,
    chain,
    redirectCount: chain.filter(item => item.redirectTarget).length,
    terminalSource: state === 'complete_historical_terminal_source' ? chain.at(-1) : null,
    state,
    completeAssessment: ['complete_historical_terminal_source', 'complete_explicit_historical_absence'].includes(state)
  };
}

function wrapperEvidence(content = '') {
  const text = String(content || '');
  const count = pattern => [...text.matchAll(pattern)].length;
  const kinds = ['onlyinclude', 'includeonly', 'noinclude'].map(name => {
    const openCount = count(new RegExp(`<${name}\\b[^>]*>`, 'gi'));
    const closeCount = count(new RegExp(`</${name}\\s*>`, 'gi'));
    const selfClosingCount = count(new RegExp(`<${name}\\b[^>]*/\\s*>`, 'gi'));
    return { wrapper: name, openCount, closeCount, selfClosingCount, balanced: openCount === closeCount + selfClosingCount };
  });
  return { wrappers: kinds, hasWrapperBehavior: kinds.some(item => item.openCount || item.closeCount), balanced: kinds.every(item => item.balanced) };
}

export function discoverTemplateSourceDependencies(sourceIdentityValue, magicWordAliases = []) {
  if (!sourceIdentityValue?.sourcePageId || typeof sourceIdentityValue.exactRevisionSourceText !== 'string') return [];
  const collected = collectSkillTrainingGuideTemplateDependencies([{
    title: sourceIdentityValue.resolvedTitle,
    sourcePageId: sourceIdentityValue.sourcePageId,
    sourceRevision: sourceIdentityValue.sourceRevision,
    sourceTimestamp: sourceIdentityValue.sourceTimestamp,
    sourceUrl: sourceIdentityValue.sourceUrl,
    sourceContentHash: sourceIdentityValue.sourceContentHash,
    content: sourceIdentityValue.exactRevisionSourceText,
    skillKeys: [], channels: ['historical_root_template_source']
  }], magicWordAliases);
  const relativeTitle = reference => {
    const sourceName = normalize(reference.sourceName);
    if (!/^(?:\.\.\/|\/)/.test(sourceName)) return reference.pageTitle;
    const base = normalize(sourceIdentityValue.resolvedTitle);
    const colon = base.indexOf(':');
    const namespace = colon >= 0 ? base.slice(0, colon + 1) : '';
    const segments = (colon >= 0 ? base.slice(colon + 1) : base).split('/');
    let suffix = sourceName;
    if (suffix.startsWith('/')) return `${base}${suffix}`;
    while (suffix.startsWith('../')) { if (segments.length > 1) segments.pop(); suffix = suffix.slice(3); }
    return `${namespace}${[...segments, suffix].filter(Boolean).join('/')}`;
  };
  return collected.records.flatMap(group => group.references.map(reference => ({
    occurrenceKey: reference.occurrenceKey,
    sourceName: reference.sourceName,
    pageTitle: relativeTitle(reference),
    dependencyClass: reference.dependencyClass,
    argumentCount: reference.argumentCount,
    rawSource: reference.rawSource,
    sourceLocator: reference.sourceLocator
  }))).sort((a, b) => {
    const ordinal = value => Number(String(value.occurrenceKey).split(':').at(-1));
    return ordinal(a) - ordinal(b);
  });
}

export function requiredHistoricalSourceRequests(routes = [], historicalSources = [], magicWordAliases = []) {
  const sources = sourceMap(historicalSources);
  const requests = new Map();
  const requireChain = (title, timestamp) => {
    let current = normalize(title);
    const visited = new Set();
    for (let depth = 0; depth < 8; depth += 1) {
      const key = sourceKey(current, timestamp);
      if (visited.has(key)) return;
      visited.add(key);
      const observation = sources.get(key);
      if (!observation) { requests.set(key, { requestedTitle: current, asOfTimestamp: timestamp }); return; }
      const identity = sourceIdentity(observation, timestamp);
      const target = typeof identity.exactRevisionSourceText === 'string' ? historicalRedirectTarget(identity.exactRevisionSourceText) : null;
      if (!target) return;
      current = target.includes(':') ? target : `Template:${target}`;
    }
  };
  for (const route of routes) {
    const timestamp = route.sourcePageIdentity.sourceTimestamp;
    for (const invocation of route.retainedStructuralEvidence.rootTemplates || []) {
      const requestedTitle = invocation.template.includes(':') ? invocation.template : `Template:${invocation.template}`;
      requireChain(requestedTitle, timestamp);
      const root = resolveHistoricalChain(requestedTitle, timestamp, sources);
      if (!root.terminalSource) continue;
      for (const dependency of discoverTemplateSourceDependencies(root.terminalSource, magicWordAliases)) {
        if (dependency.pageTitle) requireChain(dependency.pageTitle, timestamp);
      }
    }
  }
  return [...requests.values()].sort((a, b) => a.asOfTimestamp.localeCompare(b.asOfTimestamp) || a.requestedTitle.localeCompare(b.requestedTitle));
}

function candidateRevisionRevalidation(route, candidatePages = [], contentHash = hash) {
  const expected = route.sourcePageIdentity;
  const match = candidatePages.flatMap(page => (page.revisions || []).map(revision => ({ page, revision }))).find(item => String(item.revision.revid) === String(expected.sourceRevision));
  const content = match?.revision?.slots?.main?.content;
  const observed = {
    sourcePageId: match?.page?.pageid ? Number(match.page.pageid) : null,
    resolvedTitle: match?.page?.title || null,
    sourceRevision: match?.revision?.revid ? String(match.revision.revid) : null,
    sourceTimestamp: match?.revision?.timestamp || null,
    sourceContentHash: typeof content === 'string' ? contentHash(content) : null,
    sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : 0,
    sourceExactRevisionUrl: revisionUrl(match?.revision?.revid)
  };
  const checks = {
    exactRevisionResponsePresent: Boolean(match),
    stablePageIdMatches: observed.sourcePageId === expected.sourcePageId,
    resolvedTitleMatches: observed.resolvedTitle === expected.resolvedTitle,
    revisionMatches: observed.sourceRevision === expected.sourceRevision,
    timestampMatches: observed.sourceTimestamp === expected.sourceTimestamp,
    contentHashMatches: observed.sourceContentHash === expected.sourceContentHash,
    contentBytesMatch: observed.sourceContentBytes === expected.sourceContentBytes
  };
  return { boundSource: structuredClone(expected), observedSource: observed, checks, exactMatch: Object.values(checks).every(Boolean) };
}

function rootEvidence(route, invocation, invocationOrdinal, sources, magicWordAliases, contentHash = hash) {
  const timestamp = route.sourcePageIdentity.sourceTimestamp;
  const requestedTitle = invocation.template.includes(':') ? invocation.template : `Template:${invocation.template}`;
  const resolution = resolveHistoricalChain(requestedTitle, timestamp, sources, contentHash);
  const dependencies = discoverTemplateSourceDependencies(resolution.terminalSource, magicWordAliases);
  const pageBacked = dependencies.filter(dependency => dependency.pageTitle);
  const dependencyAssessments = pageBacked.map(dependency => ({
    occurrenceKey: dependency.occurrenceKey,
    sourceName: dependency.sourceName,
    pageTitle: dependency.pageTitle,
    dependencyClass: dependency.dependencyClass,
    argumentCount: dependency.argumentCount,
    rawSource: dependency.rawSource,
    sourceLocator: dependency.sourceLocator,
    historicalResolution: resolveHistoricalChain(dependency.pageTitle, timestamp, sources, contentHash)
  }));
  const blockers = [];
  if (!resolution.completeAssessment) blockers.push('root_template_historical_resolution_incomplete');
  if (resolution.state === 'complete_explicit_historical_absence') blockers.push('root_template_historically_absent');
  if (resolution.terminalSource && !wrapperEvidence(resolution.terminalSource.exactRevisionSourceText).balanced) blockers.push('root_template_wrapper_tags_unbalanced');
  if (dependencyAssessments.some(item => !item.historicalResolution.completeAssessment)) blockers.push('one_or_more_page_backed_dependencies_lack_complete_as_of_assessment');
  if (dependencyAssessments.some(item => item.historicalResolution.state === 'complete_explicit_historical_absence')) blockers.push('one_or_more_page_backed_dependencies_historically_absent');
  blockers.push('recursive_historical_expansion_closure_not_established', 'template_structure_requires_subject_boundary_human_review');
  return {
    invocationOrdinal,
    retainedInvocation: structuredClone(invocation),
    requestedTemplateTitle: requestedTitle,
    historicalResolution: resolution,
    wrapperBehavior: wrapperEvidence(resolution.terminalSource?.exactRevisionSourceText),
    sourceInvocationInventory: dependencies,
    pageBackedOneHopDependencyAssessments: dependencyAssessments,
    rootTemplateSemanticVerdict: null,
    blockers: unique(blockers),
    state: resolution.completeAssessment && dependencyAssessments.every(item => item.historicalResolution.completeAssessment)
      ? 'complete_revision_pinned_root_alias_and_one_hop_dependency_evidence_non_verdict'
      : 'blocked_incomplete_revision_pinned_root_alias_or_one_hop_dependency_evidence'
  };
}

function expectedRecord(route, ordinal, candidatePages, sources, magicWordAliases, policy, routingSnapshot, contentHash = hash) {
  const candidate = candidateRevisionRevalidation(route, candidatePages, contentHash);
  const rootTemplateInvocationEvidence = (route.retainedStructuralEvidence.rootTemplates || []).map((invocation, index) => rootEvidence(route, invocation, index + 1, sources, magicWordAliases, contentHash));
  const allDependencies = rootTemplateInvocationEvidence.flatMap(item => item.sourceInvocationInventory);
  const dependencyAssessments = rootTemplateInvocationEvidence.flatMap(item => item.pageBackedOneHopDependencyAssessments);
  const completeRoots = rootTemplateInvocationEvidence.filter(item => item.historicalResolution.completeAssessment);
  const completeDependencies = dependencyAssessments.filter(item => item.historicalResolution.completeAssessment);
  const blockers = unique([
    ...(candidate.exactMatch ? [] : ['candidate_exact_revision_revalidation_failed']),
    ...rootTemplateInvocationEvidence.flatMap(item => item.blockers),
    'composite_or_container_subject_boundary_human_review_pending',
    'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved',
    'optimizer_eligibility_and_verified_best_blocked'
  ]);
  const base = {
    contract: policy.recordContract,
    evidencePacketKey: `${route.workRouteKey}|template-alias-and-expansion-evidence`,
    evidencePacketOrdinal: ordinal,
    candidateKey: route.candidateKey,
    workRouteKey: route.workRouteKey,
    sourceBindings: {
      routingSnapshotContentHash: routingSnapshot.contentHash,
      routingRecordContentHash: route.recordContentHash,
      routingOuterContentHash: route.contentHash,
      candidateSourceContentHash: route.sourcePageIdentity.sourceContentHash
    },
    candidateRevisionRevalidation: candidate,
    rootTemplateInvocationEvidence,
    coverage: {
      retainedRootTemplateInvocationCount: rootTemplateInvocationEvidence.length,
      rootTemplateAssessmentCount: rootTemplateInvocationEvidence.length,
      completeRootTemplateHistoricalResolutionCount: completeRoots.length,
      explicitRootTemplateAbsenceCount: rootTemplateInvocationEvidence.filter(item => item.historicalResolution.state === 'complete_explicit_historical_absence').length,
      rootTemplateRedirectHopCount: rootTemplateInvocationEvidence.reduce((sum, item) => sum + item.historicalResolution.redirectCount, 0),
      rootTemplatesWithWrapperBehaviorCount: rootTemplateInvocationEvidence.filter(item => item.wrapperBehavior.hasWrapperBehavior).length,
      sourceInvocationOccurrenceCount: allDependencies.length,
      pageBackedOneHopDependencyOccurrenceCount: dependencyAssessments.length,
      completePageBackedOneHopDependencyAssessmentCount: completeDependencies.length,
      explicitPageBackedOneHopDependencyAbsenceCount: dependencyAssessments.filter(item => item.historicalResolution.state === 'complete_explicit_historical_absence').length,
      recursiveHistoricalExpansionClosureComplete: false
    },
    explicitNonClaims: [
      'template_alias_or_redirect_structure_does_not_establish_candidate_subject_identity',
      'source_level_invocations_do_not_prove_the_complete_recursive_historical_expansion',
      'template_or_module_dependencies_do_not_establish_activity_identity_or_repeatability',
      'wrapper_behavior_does_not_establish_composite_container_or_member_boundaries',
      'requirements_variants_xp_timing_mechanics_and_complete_universe_are_not_established',
      'account_state_is_not_evaluated',
      'optimizer_eligibility_and_verified_best_are_not_authorized'
    ],
    humanDecisionRecorded: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    membershipOrVariantApplication: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers,
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

export function buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(input = {}) {
  const {
    routingRecords = [], routingRaw = '', routingManifest = {}, routingSnapshot = {},
    sourceEvidenceRecords = [], sourceEvidenceRaw = '', sourceEvidenceManifest = {}, sourceEvidenceSnapshot = {},
    packetRecords = [], packetRaw = '', packetManifest = {}, packetSnapshot = {},
    candidatePages = [], historicalSources = [], magicWordAliases = [],
    policy = {}, routingPolicy = {}, sourceEvidencePolicy = {}, packetPolicy = {}, contentHash = hash
  } = input;
  const compiled = compileActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidencePolicy(policy, routingPolicy, contentHash);
  const rebuilt = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting({
    sourceEvidenceRecords, sourceEvidenceRaw, sourceEvidenceManifest, sourceEvidenceSnapshot,
    packetRecords, packetRaw, packetManifest, packetSnapshot,
    policy: routingPolicy, sourceEvidencePolicy, packetPolicy, contentHash
  });
  const routingAssessment = snapshotAssessment(routingRaw, routingRecords, routingManifest, routingSnapshot, policy.inputRoutingDomain, routingPolicy.policy, contentHash(routingPolicy), contentHash);
  const exactRebuild = rebuilt.audit.publishable === true
    && same(routingRecords.map(withoutOuterHash), rebuilt.records, contentHash)
    && same(routingManifest.source?.audit, rebuilt.audit, contentHash);
  const sources = sourceMap(historicalSources);
  const records = routingRecords.map((route, index) => expectedRecord(route, index + 1, candidatePages, sources, magicWordAliases, policy, routingSnapshot, contentHash));
  const artifacts = buildArtifacts(records, contentHash);
  const audit = auditActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(records, {
    ...input, compiled, rebuilt, routingAssessment, exactRebuild, artifacts, contentHash
  });
  return { records, audit, artifacts };
}

function buildArtifacts(records, contentHash = hash) {
  const lines = ['# Missing supported-infobox template alias and expansion evidence', '', 'These are source-provenance packets, not activity classifications or optimizer candidates.', ''];
  for (const record of records) {
    lines.push(`## ${record.candidateRevisionRevalidation.boundSource.resolvedTitle}`);
    lines.push(`- Candidate revision: ${record.candidateRevisionRevalidation.boundSource.sourceRevision}`);
    lines.push(`- Root template invocations: ${record.coverage.retainedRootTemplateInvocationCount}`);
    lines.push(`- Redirect hops: ${record.coverage.rootTemplateRedirectHopCount}`);
    lines.push(`- Source-level invocations: ${record.coverage.sourceInvocationOccurrenceCount}`);
    lines.push(`- Page-backed one-hop assessments: ${record.coverage.completePageBackedOneHopDependencyAssessmentCount}/${record.coverage.pageBackedOneHopDependencyOccurrenceCount}`);
    lines.push('- Recursive historical expansion closure: not established');
    lines.push('- Composite/container subject boundary: human review required', '');
  }
  const markdown = `${lines.join('\n')}\n`;
  const packetIndex = `${JSON.stringify(records.map(record => ({
    evidencePacketKey: record.evidencePacketKey,
    candidateKey: record.candidateKey,
    sourceRevision: record.candidateRevisionRevalidation.boundSource.sourceRevision,
    rootTemplateCount: record.coverage.retainedRootTemplateInvocationCount,
    dependencyOccurrenceCount: record.coverage.sourceInvocationOccurrenceCount,
    blockers: record.blockers
  })), null, 2)}\n`;
  const manifest = {
    contract: 'sensum.content-addressed-artifact-manifest.v1',
    artifacts: [
      { file: 'template-alias-and-expansion-evidence.md', kind: 'human_readable_evidence_summary', contentHash: contentHash(markdown), bytes: Buffer.byteLength(markdown, 'utf8') },
      { file: 'template-alias-and-expansion-evidence-index.json', kind: 'machine_readable_evidence_index', contentHash: contentHash(packetIndex), bytes: Buffer.byteLength(packetIndex, 'utf8') }
    ]
  };
  const artifactManifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  return { markdown, packetIndex, artifactManifest: manifest, artifactManifestJson };
}

export function auditActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(records = [], context = {}) {
  const { routingRecords = [], historicalSources = [], compiled = {}, routingAssessment = {}, exactRebuild = false, artifacts = {}, contentHash = hash } = context;
  const expectedKeys = routingRecords.map(row => row.workRouteKey);
  const actualKeys = records.map(row => row.workRouteKey);
  const duplicates = unique(actualKeys.filter((value, index) => actualKeys.indexOf(value) !== index));
  const missing = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpected = actualKeys.filter(key => !expectedKeys.includes(key));
  const expectedRoots = routingRecords.reduce((sum, row) => sum + (row.retainedStructuralEvidence?.rootTemplates?.length || 0), 0);
  const actualRoots = records.reduce((sum, row) => sum + row.rootTemplateInvocationEvidence.length, 0);
  const incompleteCandidates = records.filter(row => !row.candidateRevisionRevalidation.exactMatch).map(row => row.candidateKey);
  const roots = records.flatMap(row => row.rootTemplateInvocationEvidence.map(root => ({ candidateKey: row.candidateKey, root })));
  const incompleteRoots = roots.filter(item => !item.root.historicalResolution.completeAssessment).map(item => `${item.candidateKey}:${item.root.invocationOrdinal}`);
  const dependencies = roots.flatMap(item => item.root.pageBackedOneHopDependencyAssessments.map(dependency => ({ candidateKey: item.candidateKey, rootOrdinal: item.root.invocationOrdinal, dependency })));
  const incompleteDependencies = dependencies.filter(item => !item.dependency.historicalResolution.completeAssessment).map(item => `${item.candidateKey}:${item.rootOrdinal}:${item.dependency.occurrenceKey}`);
  const accountState = accountStateFindings(records);
  const promotions = records.filter(row => row.humanDecisionRecorded !== false || row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null
    || row.repeatabilityClassification !== null || row.membershipOrVariantApplication !== false || row.requirementsVariantsXpTimingAndMechanicsComplete !== false
    || row.optimizerEligible !== false || row.automaticVerificationApplied !== false || row.accountIndependent !== true).map(row => row.candidateKey);
  const artifactChecks = {
    markdownHashMatches: artifacts.artifactManifest?.artifacts?.[0]?.contentHash === contentHash(artifacts.markdown || ''),
    indexHashMatches: artifacts.artifactManifest?.artifacts?.[1]?.contentHash === contentHash(artifacts.packetIndex || ''),
    manifestStable: Boolean(artifacts.artifactManifestJson && contentHash(artifacts.artifactManifestJson))
  };
  const evidencePacketCoverageComplete = compiled.valid && routingAssessment.complete && exactRebuild
    && !duplicates.length && !missing.length && !unexpected.length && expectedRoots > 0 && actualRoots === expectedRoots
    && !incompleteCandidates.length && !incompleteRoots.length && !incompleteDependencies.length
    && !promotions.length && !accountState.length && Object.values(artifactChecks).every(Boolean);
  const blockers = [];
  if (!compiled.valid) blockers.push('template_alias_and_expansion_policy_invalid');
  if (!routingAssessment.complete) blockers.push('explicit_routing_snapshot_revalidation_failed');
  if (!exactRebuild) blockers.push('routing_complete_upstream_relation_rebuild_mismatch');
  if (duplicates.length || missing.length || unexpected.length) blockers.push('evidence_packet_candidate_set_mismatch');
  if (actualRoots !== expectedRoots) blockers.push('retained_root_template_invocation_coverage_mismatch');
  if (incompleteCandidates.length) blockers.push('candidate_exact_revision_revalidation_failed');
  if (incompleteRoots.length) blockers.push('one_or_more_root_template_historical_assessments_incomplete');
  if (incompleteDependencies.length) blockers.push('one_or_more_page_backed_one_hop_dependency_assessments_incomplete');
  if (promotions.length) blockers.push('unsupported_semantic_or_optimizer_promotion');
  if (accountState.length) blockers.push('account_query_state_baked_into_evidence');
  if (!Object.values(artifactChecks).every(Boolean)) blockers.push('evidence_artifact_hash_validation_failed');
  blockers.push('recursive_historical_expansion_closure_not_established', 'composite_or_container_subject_boundary_human_review_pending', 'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved', 'independent_complete_activity_universe_not_established');
  return {
    contract: context.policy.auditContract,
    policyCoverage: compiled,
    inputCoverage: { routingSnapshot: routingAssessment, completeUpstreamRelationRebuiltExactly: exactRebuild, historicalSourceObservationCount: historicalSources.length },
    candidateCoverage: { routingRecordCount: routingRecords.length, evidencePacketCount: records.length, duplicateWorkRouteKeys: duplicates, missingWorkRouteKeys: missing, unexpectedWorkRouteKeys: unexpected, exactCandidateRevisionMatchCount: records.length - incompleteCandidates.length, incompleteCandidateKeys: incompleteCandidates },
    rootTemplateCoverage: { expectedRetainedInvocationCount: expectedRoots, evidenceInvocationCount: actualRoots, completeHistoricalAssessmentCount: roots.length - incompleteRoots.length, incompleteRootEvidenceKeys: incompleteRoots, explicitHistoricalAbsenceCount: roots.filter(item => item.root.historicalResolution.state === 'complete_explicit_historical_absence').length },
    aliasAndRedirectCoverage: { redirectHopCount: roots.reduce((sum, item) => sum + item.root.historicalResolution.redirectCount, 0), rootsWithRedirectsCount: roots.filter(item => item.root.historicalResolution.redirectCount > 0).length, redirectLoopCount: roots.filter(item => item.root.historicalResolution.state === 'blocked_historical_redirect_loop').length, redirectDepthLimitCount: roots.filter(item => item.root.historicalResolution.state === 'blocked_historical_redirect_depth_limit').length },
    wrapperAndDependencyCoverage: { rootsWithWrapperBehaviorCount: roots.filter(item => item.root.wrapperBehavior.hasWrapperBehavior).length, unbalancedWrapperCount: roots.filter(item => !item.root.wrapperBehavior.balanced).length, sourceInvocationOccurrenceCount: roots.reduce((sum, item) => sum + item.root.sourceInvocationInventory.length, 0), pageBackedOneHopDependencyOccurrenceCount: dependencies.length, completePageBackedOneHopDependencyAssessmentCount: dependencies.length - incompleteDependencies.length, incompletePageBackedOneHopDependencyKeys: incompleteDependencies, explicitHistoricalDependencyAbsenceCount: dependencies.filter(item => item.dependency.historicalResolution.state === 'complete_explicit_historical_absence').length },
    semanticPreservationCoverage: { humanDecisionRecordedCount: records.filter(row => row.humanDecisionRecorded).length, canonicalIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length, repeatabilityClassificationCount: records.filter(row => row.repeatabilityClassification !== null).length, membershipOrVariantApplicationCount: records.filter(row => row.membershipOrVariantApplication).length, mechanicsCompletionCount: records.filter(row => row.requirementsVariantsXpTimingAndMechanicsComplete).length, optimizerEligibleCount: records.filter(row => row.optimizerEligible).length, automaticVerificationCount: records.filter(row => row.automaticVerificationApplied).length, unsupportedPromotionCandidateKeys: promotions },
    accountStateFindings: accountState,
    artifactCoverage: artifactChecks,
    evidencePacketCoverageComplete,
    recursiveHistoricalExpansionClosureComplete: false,
    humanReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: evidencePacketCoverageComplete
  };
}
