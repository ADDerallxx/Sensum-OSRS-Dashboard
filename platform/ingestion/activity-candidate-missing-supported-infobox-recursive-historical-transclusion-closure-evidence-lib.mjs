import { hash } from './lib.mjs';
import { collectSkillTrainingGuideTemplateDependencies } from './skill-training-guide-source-dependency-lib.mjs';
import { historicalRedirectTarget } from './activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-lib.mjs';

const REQUIRED_RULES = [
  'oneHopSnapshotMustBeExplicitlySelectedAndRevalidated',
  'oneRecursiveClosurePacketMustPreserveEachOneHopPacketInOrder',
  'allHistoricalSourcesMustUseTheLatestRevisionAtOrBeforeTheCandidateTimestamp',
  'onlyTransclusionEffectiveWikitextMayCreateRecursiveTemplateEdges',
  'NoincludeContentMustRemainObservableButCannotCreateTransclusionEdges',
  'OnlyincludeOverridesTheOrdinaryOuterTransclusionView',
  'RelativeSubpagesMustResolveAgainstTheExactHistoricalSourcePage',
  'HistoricalRedirectsMustRemainExplicitEdgesAndCannotUseCurrentHeadResolution',
  'StaticLuaRequireLoadDataAndExpandTemplateTargetsMustBePreservedSeparately',
  'DynamicNamesParserFunctionsMagicWordsAndUnresolvedLuaCallsMustRemainExplicitBoundaries',
  'EveryStaticPageBackedEdgeMustHaveAnAsOfAssessmentOrExplicitAbsence',
  'CyclesMustBeRecordedAndCannotBeExpandedIndefinitely',
  'DepthLimitsMissingObservationsAndTimestampMismatchesMustFailClosed',
  'StaticDependencyClosureCannotClaimCompleteRenderedOutputAttribution',
  'TemplateStructureCannotEstablishSubjectIdentityRepeatabilityMembershipRequirementsMechanicsOrEligibility',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
const titleKey = value => normalize(value).toLocaleLowerCase('en');
const sourceKey = (title, timestamp) => `${timestamp}|${titleKey(title)}`;
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);

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

export function compileActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidencePolicy(policy = {}, oneHopPolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidBindings = [];
  if (policy.policy !== 'sensum.activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-policy.v1') invalidBindings.push('policy');
  if (policy.inputOneHopPolicy !== oneHopPolicy.policy || policy.inputOneHopPolicyContentHash !== contentHash(oneHopPolicy)) invalidBindings.push('inputOneHopPolicy');
  if (policy.inputOneHopDomain !== oneHopPolicy.outputDomain) invalidBindings.push('inputOneHopDomain');
  if (policy.recordContract !== 'sensum.activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence.v1'
    || policy.auditContract !== 'sensum.activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-audit.v1') invalidBindings.push('contracts');
  if (!Number.isInteger(policy.maximumRedirectDepth) || policy.maximumRedirectDepth < 1 || !Number.isInteger(policy.maximumGraphDepth) || policy.maximumGraphDepth < 1) invalidBindings.push('depthLimits');
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: !invalidRules.length && !invalidBindings.length && !forbidden.length, invalidRules: unique(invalidRules), invalidBindings, forbiddenPolicyPaths: forbidden };
}

function validIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function withoutOuterHash(record = {}) { const { contentHash, ...value } = record; return value; }
function withoutRecordHash(record = {}) { const { recordContentHash, ...value } = record; return value; }

function oneHopSnapshotAssessment(raw, records, manifest, snapshot, policy, contentHash = hash) {
  const audit = manifest?.source?.audit || {};
  const checks = {
    explicitSnapshotSelected: snapshot?.explicit === true && Boolean(snapshot?.directory),
    manifestContractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === policy.outputDomain,
    recordCountAndRawHashMatch: manifest?.records === records.length && manifest?.contentHash === contentHash(raw),
    snapshotBindingMatchesManifest: snapshot?.contentHash === manifest?.contentHash && snapshot?.createdAt === manifest?.createdAt,
    createdAtValid: validIso(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policy.policy && manifest?.source?.policy?.contentHash === contentHash(policy),
    recordHashesMatch: records.every(record => record.recordContentHash === contentHash(withoutRecordHash(withoutOuterHash(record))) && record.contentHash === contentHash(withoutOuterHash(record))),
    upstreamAuditContractAndGateMatch: audit.contract === policy.auditContract && audit.publishable === true && audit.evidencePacketCoverageComplete === true
      && audit.recursiveHistoricalExpansionClosureComplete === false && audit.humanReviewComplete === false && audit.completeActivityUniverse === false,
    upstreamSemanticBoundaryIntact: audit.semanticPreservationCoverage?.humanDecisionRecordedCount === 0
      && audit.semanticPreservationCoverage?.canonicalIdentityCount === 0 && audit.semanticPreservationCoverage?.repeatabilityClassificationCount === 0
      && audit.semanticPreservationCoverage?.membershipOrVariantApplicationCount === 0 && audit.semanticPreservationCoverage?.mechanicsCompletionCount === 0
      && audit.semanticPreservationCoverage?.optimizerEligibleCount === 0 && audit.semanticPreservationCoverage?.automaticVerificationCount === 0
      && (audit.accountStateFindings || []).length === 0
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

function maskHtmlComments(text) {
  return String(text || '').replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\r\n]/g, ' '));
}

function wrapperStructure(source = '') {
  const text = String(source || '');
  const masked = maskHtmlComments(text);
  const rows = ['onlyinclude', 'includeonly', 'noinclude'].map(wrapper => {
    const opens = [...masked.matchAll(new RegExp(`<${wrapper}\\b[^>]*>`, 'gi'))];
    const closes = [...masked.matchAll(new RegExp(`</${wrapper}\\s*>`, 'gi'))];
    const selfClosing = opens.filter(match => /\/\s*>$/.test(match[0]));
    return { wrapper, openCount: opens.length, closeCount: closes.length, selfClosingCount: selfClosing.length, balanced: opens.length === closes.length + selfClosing.length };
  });
  return { wrappers: rows, hasOnlyinclude: rows[0].openCount > 0, hasIncludeonly: rows[1].openCount > 0, hasNoinclude: rows[2].openCount > 0, balanced: rows.every(row => row.balanced) };
}

function blankPreservingNewlines(value) { return String(value).replace(/[^\r\n]/g, ' '); }

export function transclusionEffectiveWikitext(source = '') {
  const text = String(source || '');
  const masked = maskHtmlComments(text);
  const wrappers = wrapperStructure(text);
  if (!wrappers.balanced) return { text: blankPreservingNewlines(text), wrappers, complete: false, state: 'blocked_unbalanced_transclusion_wrapper_structure' };
  const onlyPattern = /<onlyinclude\b[^>]*>([\s\S]*?)<\/onlyinclude\s*>/gi;
  const onlyMatches = [...masked.matchAll(onlyPattern)];
  let effective;
  if (onlyMatches.length) {
    const chars = blankPreservingNewlines(text).split('');
    for (const match of onlyMatches) {
      const openLength = match[0].indexOf('>') + 1;
      const start = match.index + openLength;
      const end = start + match[1].length;
      for (let index = start; index < end; index += 1) chars[index] = text[index];
    }
    effective = chars.join('');
  } else {
    effective = text;
    effective = effective.replace(/<noinclude\b[^>]*>[\s\S]*?<\/noinclude\s*>/gi, blankPreservingNewlines);
    effective = effective.replace(/<noinclude\b[^>]*\/\s*>/gi, blankPreservingNewlines);
    effective = effective.replace(/<\/?(?:includeonly|onlyinclude)\b[^>]*>/gi, blankPreservingNewlines);
  }
  return { text: effective, wrappers, complete: true, state: onlyMatches.length ? 'complete_onlyinclude_transclusion_view' : 'complete_standard_transclusion_view' };
}

function relativePageTitle(baseTitle, sourceName, pageTitle) {
  const name = normalize(sourceName);
  if (!/^(?:\.\.\/|\/)/.test(name)) return pageTitle;
  const base = normalize(baseTitle);
  if (name.startsWith('/')) return `${base}${name}`;
  const colon = base.indexOf(':');
  const namespace = colon >= 0 ? base.slice(0, colon + 1) : '';
  const segments = (colon >= 0 ? base.slice(colon + 1) : base).split('/');
  let suffix = name;
  while (suffix.startsWith('../')) { if (segments.length > 1) segments.pop(); suffix = suffix.slice(3); }
  return `${namespace}${[...segments, suffix].filter(Boolean).join('/')}`;
}

function lineAt(source, offset) { return String(source || '').slice(0, offset).split(/\r?\n/).length; }

function maskLuaComments(source = '') {
  const text = String(source || '');
  const chars = text.split('');
  const mask = (start, end) => { for (let index = start; index < end; index += 1) if (!/[\r\n]/.test(chars[index])) chars[index] = ' '; };
  let index = 0;
  while (index < text.length) {
    if (text[index] === '"' || text[index] === "'") {
      const quote = text[index++];
      while (index < text.length) { if (text[index] === '\\') { index += 2; continue; } if (text[index++] === quote) break; }
      continue;
    }
    const longString = text.slice(index).match(/^\[(=*)\[/);
    if (longString) { const close = `]${longString[1]}]`; const end = text.indexOf(close, index + longString[0].length); index = end < 0 ? text.length : end + close.length; continue; }
    if (text.startsWith('--', index)) {
      const block = text.slice(index + 2).match(/^\[(=*)\[/);
      if (block) { const close = `]${block[1]}]`; const end = text.indexOf(close, index + 2 + block[0].length); const stop = end < 0 ? text.length : end + close.length; mask(index, stop); index = stop; continue; }
      const end = text.indexOf('\n', index + 2); const stop = end < 0 ? text.length : end; mask(index, stop); index = stop; continue;
    }
    index += 1;
  }
  return chars.join('');
}

function maskLuaStringsAndComments(source = '') {
  const text = String(source || '');
  const chars = text.split('');
  const mask = (start, end) => { for (let index = start; index < end; index += 1) if (!/[\r\n]/.test(chars[index])) chars[index] = ' '; };
  let index = 0;
  while (index < text.length) {
    if (text.startsWith('--', index)) {
      const block = text.slice(index + 2).match(/^\[(=*)\[/);
      if (block) { const close = `]${block[1]}]`; const end = text.indexOf(close, index + 2 + block[0].length); const stop = end < 0 ? text.length : end + close.length; mask(index, stop); index = stop; continue; }
      const end = text.indexOf('\n', index + 2); const stop = end < 0 ? text.length : end; mask(index, stop); index = stop; continue;
    }
    if (text[index] === '"' || text[index] === "'") {
      const start = index;
      const quote = text[index++];
      while (index < text.length) { if (text[index] === '\\') { index += 2; continue; } if (text[index++] === quote) break; }
      mask(start, index);
      continue;
    }
    const longString = text.slice(index).match(/^\[(=*)\[/);
    if (longString) { const close = `]${longString[1]}]`; const end = text.indexOf(close, index + longString[0].length); const stop = end < 0 ? text.length : end + close.length; mask(index, stop); index = stop; continue; }
    index += 1;
  }
  return chars.join('');
}

function luaDependencies(sourceIdentity) {
  const source = String(sourceIdentity.exactRevisionSourceText || '');
  const masked = maskLuaComments(source);
  const codeOnly = maskLuaStringsAndComments(source);
  const rows = [];
  const addStatic = (dependencyClass, match, rawTitle) => {
    const title = normalize(rawTitle);
    const pageTitle = dependencyClass === 'lua_expand_template' && !title.includes(':') ? `Template:${title}` : title;
    rows.push({ occurrenceKey: `${sourceIdentity.sourcePageId}:${dependencyClass}:${rows.length + 1}`, sourceName: title, pageTitle: /^(?:Module|Template):/i.test(pageTitle) ? pageTitle : null, dependencyClass, argumentCount: null, rawSource: match[0], sourceLocator: { line: lineAt(source, match.index) }, staticTarget: /^(?:Module|Template):/i.test(pageTitle) });
  };
  const patterns = [
    ['lua_require', /\brequire\s*(?:\(\s*)?(["'])([^"']+)\1\s*\)?/gi],
    ['lua_load_data', /\bmw\.load(?:Json)?Data\s*\(\s*(["'])([^"']+)\1\s*\)/gi],
    ['lua_expand_template', /\bexpandTemplate\s*\(?\s*\{[\s\S]{0,600}?\btitle\s*=\s*(["'])([^"']+)\1/gi]
  ];
  for (const [kind, pattern] of patterns) for (const match of masked.matchAll(pattern)) {
    if (/\S/.test(codeOnly.slice(match.index, match.index + match[0].match(/^\w+/)?.[0]?.length))) addStatic(kind, match, match[2]);
  }
  const callCounts = {
    require: [...codeOnly.matchAll(/\brequire\b\s*\(/g)].length
      + rows.filter(row => row.dependencyClass === 'lua_require' && !/\brequire\s*\(/.test(row.rawSource || '')).length,
    loadData: [...codeOnly.matchAll(/\bmw\.load(?:Json)?Data\s*\(/g)].length,
    expandTemplate: [...codeOnly.matchAll(/\bexpandTemplate\s*\(/g)].length + [...codeOnly.matchAll(/\bexpandTemplate\s*\{/g)].length,
    preprocess: [...codeOnly.matchAll(/\bpreprocess\s*\(/g)].length,
    callParserFunction: [...codeOnly.matchAll(/\bcallParserFunction\s*\(/g)].length
  };
  const staticCounts = {
    require: rows.filter(row => row.dependencyClass === 'lua_require').length,
    loadData: rows.filter(row => row.dependencyClass === 'lua_load_data').length,
    expandTemplate: rows.filter(row => row.dependencyClass === 'lua_expand_template').length
  };
  const dynamic = [];
  for (const kind of ['require', 'loadData', 'expandTemplate']) for (let ordinal = staticCounts[kind]; ordinal < callCounts[kind]; ordinal += 1) dynamic.push({ occurrenceKey: `${sourceIdentity.sourcePageId}:lua_dynamic_${kind}:${ordinal + 1}`, sourceName: kind, pageTitle: null, dependencyClass: `lua_dynamic_${kind}`, argumentCount: null, rawSource: null, sourceLocator: null, staticTarget: false });
  for (const kind of ['preprocess', 'callParserFunction']) for (let ordinal = 0; ordinal < callCounts[kind]; ordinal += 1) dynamic.push({ occurrenceKey: `${sourceIdentity.sourcePageId}:lua_${kind}:${ordinal + 1}`, sourceName: kind, pageTitle: null, dependencyClass: `lua_${kind}_boundary`, argumentCount: null, rawSource: null, sourceLocator: null, staticTarget: false });
  return [...rows, ...dynamic].sort((a, b) => a.occurrenceKey.localeCompare(b.occurrenceKey));
}

function wikitextDependencies(sourceIdentity, magicWordAliases = []) {
  const effective = transclusionEffectiveWikitext(sourceIdentity.exactRevisionSourceText);
  if (!effective.complete) return { effective, dependencies: [] };
  const collected = collectSkillTrainingGuideTemplateDependencies([{
    title: sourceIdentity.resolvedTitle, sourcePageId: sourceIdentity.sourcePageId, sourceRevision: sourceIdentity.sourceRevision,
    sourceTimestamp: sourceIdentity.sourceTimestamp, sourceUrl: sourceIdentity.sourceUrl, sourceContentHash: sourceIdentity.sourceContentHash,
    content: effective.text, skillKeys: [], channels: ['historical_transclusion_effective_source']
  }], magicWordAliases);
  const dependencies = collected.records.flatMap(group => group.references.map(reference => ({
    occurrenceKey: reference.occurrenceKey,
    sourceName: reference.sourceName,
    pageTitle: relativePageTitle(sourceIdentity.resolvedTitle, reference.sourceName, reference.pageTitle),
    dependencyClass: reference.dependencyClass,
    argumentCount: reference.argumentCount,
    rawSource: reference.rawSource,
    sourceLocator: reference.sourceLocator,
    staticTarget: Boolean(reference.pageTitle)
  }))).sort((a, b) => Number(a.occurrenceKey.split(':').at(-1)) - Number(b.occurrenceKey.split(':').at(-1)));
  return { effective, dependencies };
}

export function discoverRecursiveSourceDependencies(sourceIdentity, magicWordAliases = []) {
  if (Number(sourceIdentity?.namespace) === 828 || /^Module:/i.test(sourceIdentity?.resolvedTitle || '')) {
    return { effectiveSource: { kind: 'lua_module_source', contentHash: sourceIdentity.sourceContentHash, contentBytes: sourceIdentity.sourceContentBytes, wrapperState: null }, dependencies: luaDependencies(sourceIdentity) };
  }
  const { effective, dependencies } = wikitextDependencies(sourceIdentity, magicWordAliases);
  return { effectiveSource: { kind: 'wikitext_transclusion_view', contentHash: hash(effective.text), contentBytes: Buffer.byteLength(effective.text, 'utf8'), wrapperState: effective.state, wrapperStructure: effective.wrappers, complete: effective.complete }, dependencies };
}

export function extractHistoricalSourcesFromOneHopPackets(records = [], contentHash = hash) {
  const byKey = new Map();
  const conflicts = [];
  const add = source => {
    if (!source?.requestedTitle || !source?.asOfTimestamp) return;
    const key = sourceKey(source.requestedTitle, source.asOfTimestamp);
    if (byKey.has(key) && !same(byKey.get(key), source, contentHash)) conflicts.push(key);
    else byKey.set(key, structuredClone(source));
  };
  for (const record of records) for (const root of record.rootTemplateInvocationEvidence || []) {
    (root.historicalResolution?.chain || []).forEach(add);
    for (const dependency of root.pageBackedOneHopDependencyAssessments || []) (dependency.historicalResolution?.chain || []).forEach(add);
  }
  return { historicalSources: [...byKey.values()].sort((a, b) => sourceKey(a.requestedTitle, a.asOfTimestamp).localeCompare(sourceKey(b.requestedTitle, b.asOfTimestamp))), conflicts: unique(conflicts) };
}

function sourceMap(historicalSources = []) { return new Map(historicalSources.map(source => [sourceKey(source.requestedTitle, source.asOfTimestamp), source])); }

function qualifiedRedirectTarget(target, sourceTitle) {
  const normalized = normalize(target);
  if (normalized.includes(':')) return normalized;
  const base = normalize(sourceTitle);
  const colon = base.indexOf(':');
  return colon >= 0 ? `${base.slice(0, colon + 1)}${normalized}` : normalized;
}

function resolveHistoricalChain(requestedTitle, asOfTimestamp, sources, maxDepth = 8) {
  const chain = [];
  const visited = new Set();
  let current = normalize(requestedTitle);
  let state = 'blocked_missing_historical_source_observation';
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const key = sourceKey(current, asOfTimestamp);
    if (visited.has(key)) { state = 'blocked_historical_redirect_loop'; break; }
    visited.add(key);
    const source = sources.get(key);
    if (!source) break;
    const redirectTarget = typeof source.exactRevisionSourceText === 'string' ? historicalRedirectTarget(source.exactRevisionSourceText) : null;
    const step = { ...structuredClone(source), redirectTarget: redirectTarget ? qualifiedRedirectTarget(redirectTarget, source.resolvedTitle || current) : null };
    chain.push(step);
    if (source.explicitMissing) { state = 'complete_explicit_historical_absence'; break; }
    if (!source.sourceRevision || !source.sourceContentHash || !source.timestampAtOrBeforeBoundary) { state = 'blocked_incomplete_or_misaligned_historical_revision'; break; }
    if (!step.redirectTarget) { state = 'complete_historical_terminal_source'; break; }
    current = step.redirectTarget;
    if (depth === maxDepth - 1) state = 'blocked_historical_redirect_depth_limit';
  }
  return { requestedTitle: normalize(requestedTitle), asOfTimestamp, chain, redirectCount: chain.filter(step => step.redirectTarget).length, terminalSource: state === 'complete_historical_terminal_source' ? chain.at(-1) : null, state, completeAssessment: ['complete_historical_terminal_source', 'complete_explicit_historical_absence'].includes(state) };
}

function rootEntryPoints(packet) {
  return (packet.rootTemplateInvocationEvidence || []).map(root => ({
    invocationOrdinal: root.invocationOrdinal,
    retainedInvocation: structuredClone(root.retainedInvocation),
    requestedTemplateTitle: root.requestedTemplateTitle,
    historicalResolution: structuredClone(root.historicalResolution)
  }));
}

function nodeKey(source) { return `wiki-pageid:${source.sourcePageId}|revision:${source.sourceRevision}`; }

function buildCandidateGraph(packet, historicalSources, magicWordAliases, policy) {
  const sources = sourceMap(historicalSources);
  const asOfTimestamp = packet.candidateRevisionRevalidation.boundSource.sourceTimestamp;
  const entryPoints = rootEntryPoints(packet).map(entry => ({ ...entry, historicalResolution: resolveHistoricalChain(entry.requestedTemplateTitle, asOfTimestamp, sources, policy.maximumRedirectDepth) }));
  const queue = entryPoints.filter(entry => entry.historicalResolution.terminalSource).map(entry => ({ source: entry.historicalResolution.terminalSource, depth: 0 }));
  const nodes = new Map();
  const edges = [];
  const depthLimitSources = [];
  while (queue.length) {
    const current = queue.shift();
    const key = nodeKey(current.source);
    const existing = nodes.get(key);
    if (existing) { existing.minimumDepth = Math.min(existing.minimumDepth, current.depth); continue; }
    if (current.depth > policy.maximumGraphDepth) { depthLimitSources.push(key); continue; }
    const discovered = discoverRecursiveSourceDependencies(current.source, magicWordAliases);
    const node = {
      nodeKey: key,
      minimumDepth: current.depth,
      sourceIdentity: structuredClone(current.source),
      effectiveSource: discovered.effectiveSource,
      dependencyObservations: discovered.dependencies,
      staticPageBackedDependencyCount: discovered.dependencies.filter(item => item.pageTitle).length,
      dynamicOrEngineBoundaryCount: discovered.dependencies.filter(item => !item.pageTitle).length
    };
    nodes.set(key, node);
    for (const dependency of discovered.dependencies.filter(item => item.pageTitle)) {
      const resolution = resolveHistoricalChain(dependency.pageTitle, asOfTimestamp, sources, policy.maximumRedirectDepth);
      const targetNodeKey = resolution.terminalSource ? nodeKey(resolution.terminalSource) : null;
      edges.push({
        edgeKey: `${key}|${dependency.occurrenceKey}|${edges.length + 1}`,
        fromNodeKey: key,
        sourceDepth: current.depth,
        dependency: structuredClone(dependency),
        historicalResolution: resolution,
        targetNodeKey,
        staticPageBacked: true,
        cycleEdge: false
      });
      if (resolution.terminalSource && !nodes.has(targetNodeKey)) queue.push({ source: resolution.terminalSource, depth: current.depth + 1 });
    }
  }
  const graphNodes = [...nodes.values()].sort((a, b) => a.nodeKey.localeCompare(b.nodeKey));
  const graphEdges = edges.sort((a, b) => a.edgeKey.localeCompare(b.edgeKey));
  const cycles = stronglyConnectedComponents(graphNodes, graphEdges);
  const componentByNode = new Map(cycles.flatMap(component => component.nodeKeys.map(key => [key, component.cycleKey])));
  for (const edge of graphEdges) edge.cycleEdge = Boolean(edge.targetNodeKey && componentByNode.get(edge.fromNodeKey) === componentByNode.get(edge.targetNodeKey));
  const unresolvedStaticEdges = graphEdges.filter(edge => !edge.historicalResolution.completeAssessment || (edge.targetNodeKey && !nodes.has(edge.targetNodeKey)));
  const unbalancedWrappers = graphNodes.filter(node => node.effectiveSource.kind === 'wikitext_transclusion_view' && node.effectiveSource.complete !== true);
  return {
    entryPoints,
    nodes: graphNodes,
    edges: graphEdges,
    cycles,
    depthLimitSources: unique(depthLimitSources),
    unresolvedStaticEdgeKeys: unresolvedStaticEdges.map(edge => edge.edgeKey),
    unbalancedWrapperNodeKeys: unbalancedWrappers.map(node => node.nodeKey),
    staticClosureComplete: entryPoints.every(entry => entry.historicalResolution.completeAssessment) && !unresolvedStaticEdges.length && !depthLimitSources.length && !unbalancedWrappers.length
  };
}

function stronglyConnectedComponents(nodes, edges) {
  const adjacency = new Map(nodes.map(node => [node.nodeKey, []]));
  for (const edge of edges) if (edge.targetNodeKey && adjacency.has(edge.fromNodeKey) && adjacency.has(edge.targetNodeKey)) adjacency.get(edge.fromNodeKey).push(edge.targetNodeKey);
  let cursor = 0;
  const stack = [], onStack = new Set(), index = new Map(), low = new Map(), components = [];
  const visit = key => {
    index.set(key, cursor); low.set(key, cursor); cursor += 1; stack.push(key); onStack.add(key);
    for (const target of adjacency.get(key) || []) {
      if (!index.has(target)) { visit(target); low.set(key, Math.min(low.get(key), low.get(target))); }
      else if (onStack.has(target)) low.set(key, Math.min(low.get(key), index.get(target)));
    }
    if (low.get(key) !== index.get(key)) return;
    const members = [];
    while (stack.length) { const member = stack.pop(); onStack.delete(member); members.push(member); if (member === key) break; }
    const selfLoop = members.length === 1 && (adjacency.get(members[0]) || []).includes(members[0]);
    if (members.length > 1 || selfLoop) components.push({ cycleKey: `cycle:${components.length + 1}`, nodeKeys: members.sort(), selfLoop });
  };
  for (const node of nodes) if (!index.has(node.nodeKey)) visit(node.nodeKey);
  return components;
}

export function requiredRecursiveHistoricalSourceRequests(oneHopRecords = [], historicalSources = [], magicWordAliases = [], policy = {}) {
  const sources = sourceMap(historicalSources);
  const requests = new Map();
  const requireChain = (title, timestamp) => {
    let current = normalize(title);
    const visited = new Set();
    for (let depth = 0; depth < (policy.maximumRedirectDepth || 8); depth += 1) {
      const key = sourceKey(current, timestamp);
      if (visited.has(key)) return;
      visited.add(key);
      const source = sources.get(key);
      if (!source) { requests.set(key, { requestedTitle: current, asOfTimestamp: timestamp }); return; }
      if (source.explicitMissing || !source.exactRevisionSourceText) return;
      const redirect = historicalRedirectTarget(source.exactRevisionSourceText);
      if (!redirect) return;
      current = qualifiedRedirectTarget(redirect, source.resolvedTitle || current);
    }
  };
  for (const packet of oneHopRecords) {
    const timestamp = packet.candidateRevisionRevalidation.boundSource.sourceTimestamp;
    const queue = [];
    const visited = new Set();
    for (const entry of rootEntryPoints(packet)) {
      requireChain(entry.requestedTemplateTitle, timestamp);
      const resolution = resolveHistoricalChain(entry.requestedTemplateTitle, timestamp, sources, policy.maximumRedirectDepth || 8);
      if (resolution.terminalSource) queue.push({ source: resolution.terminalSource, depth: 0 });
    }
    while (queue.length) {
      const current = queue.shift();
      const key = nodeKey(current.source);
      if (visited.has(key) || current.depth > (policy.maximumGraphDepth || 64)) continue;
      visited.add(key);
      for (const dependency of discoverRecursiveSourceDependencies(current.source, magicWordAliases).dependencies.filter(item => item.pageTitle)) {
        requireChain(dependency.pageTitle, timestamp);
        const resolution = resolveHistoricalChain(dependency.pageTitle, timestamp, sources, policy.maximumRedirectDepth || 8);
        if (resolution.terminalSource && !visited.has(nodeKey(resolution.terminalSource))) queue.push({ source: resolution.terminalSource, depth: current.depth + 1 });
      }
    }
  }
  return [...requests.values()].sort((a, b) => a.asOfTimestamp.localeCompare(b.asOfTimestamp) || a.requestedTitle.localeCompare(b.requestedTitle));
}

function expectedRecord(packet, ordinal, historicalSources, magicWordAliases, policy, oneHopSnapshot, contentHash = hash) {
  const graph = buildCandidateGraph(packet, historicalSources, magicWordAliases, policy);
  const boundaries = graph.nodes.flatMap(node => node.dependencyObservations.filter(item => !item.pageTitle).map(item => ({ nodeKey: node.nodeKey, dependency: item })));
  const explicitAbsences = graph.edges.filter(edge => edge.historicalResolution.state === 'complete_explicit_historical_absence');
  const blockers = unique([
    ...(graph.staticClosureComplete ? [] : ['static_recursive_historical_transclusion_closure_incomplete']),
    ...(boundaries.length ? ['dynamic_or_engine_expansion_boundaries_require_separate_evidence'] : []),
    ...(explicitAbsences.length ? ['one_or_more_static_dependencies_historically_absent'] : []),
    'complete_rendered_output_attribution_not_established',
    'composite_or_container_subject_boundary_human_review_pending',
    'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved',
    'optimizer_eligibility_and_verified_best_blocked'
  ]);
  const base = {
    contract: policy.recordContract,
    closurePacketKey: `${packet.evidencePacketKey}|recursive-historical-transclusion-closure`,
    closurePacketOrdinal: ordinal,
    candidateKey: packet.candidateKey,
    sourceBindings: {
      oneHopSnapshotContentHash: oneHopSnapshot.contentHash,
      oneHopRecordContentHash: packet.recordContentHash,
      oneHopOuterContentHash: packet.contentHash,
      routingSnapshotContentHash: packet.sourceBindings.routingSnapshotContentHash,
      candidateSourceContentHash: packet.sourceBindings.candidateSourceContentHash
    },
    entryPoints: graph.entryPoints,
    historicalDependencyGraph: { nodes: graph.nodes, edges: graph.edges, cycles: graph.cycles, depthLimitSources: graph.depthLimitSources, unresolvedStaticEdgeKeys: graph.unresolvedStaticEdgeKeys, unbalancedWrapperNodeKeys: graph.unbalancedWrapperNodeKeys },
    coverage: {
      entryPointCount: graph.entryPoints.length,
      historicalNodeCount: graph.nodes.length,
      staticPageBackedEdgeCount: graph.edges.length,
      completeStaticEdgeAssessmentCount: graph.edges.filter(edge => edge.historicalResolution.completeAssessment).length,
      explicitHistoricalAbsenceEdgeCount: explicitAbsences.length,
      redirectHopCount: graph.entryPoints.reduce((sum, entry) => sum + entry.historicalResolution.redirectCount, 0) + graph.edges.reduce((sum, edge) => sum + edge.historicalResolution.redirectCount, 0),
      maximumObservedDepth: graph.nodes.reduce((maximum, node) => Math.max(maximum, node.minimumDepth), 0),
      cycleCount: graph.cycles.length,
      cycleEdgeCount: graph.edges.filter(edge => edge.cycleEdge).length,
      wikitextNodeCount: graph.nodes.filter(node => node.effectiveSource.kind === 'wikitext_transclusion_view').length,
      luaModuleNodeCount: graph.nodes.filter(node => node.effectiveSource.kind === 'lua_module_source').length,
      onlyincludeNodeCount: graph.nodes.filter(node => node.effectiveSource.wrapperStructure?.hasOnlyinclude).length,
      noincludeNodeCount: graph.nodes.filter(node => node.effectiveSource.wrapperStructure?.hasNoinclude).length,
      dynamicOrEngineBoundaryCount: boundaries.length,
      staticRecursiveHistoricalTransclusionClosureComplete: graph.staticClosureComplete,
      completeRenderedOutputAttribution: false
    },
    explicitNonClaims: [
      'static_dependency_closure_does_not_establish_complete_rendered_output_attribution',
      'dynamic_template_names_parser_functions_magic_words_and_lua_runtime_calls_are_not_silently_resolved',
      'historical_template_or_module_structure_does_not_establish_candidate_subject_identity',
      'dependency_graph_cycles_or_shared_nodes_do_not_establish_activity_membership',
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

function buildArtifacts(records, contentHash = hash) {
  const lines = ['# Recursive historical transclusion closure evidence', '', 'These graphs close only statically named historical dependencies. They are not activity classifications, rendered-output proofs, or optimizer candidates.', ''];
  for (const record of records) {
    lines.push(`## ${record.entryPoints[0]?.historicalResolution?.chain?.[0]?.asOfTimestamp || record.candidateKey} — ${record.candidateKey}`);
    lines.push(`- Root entry points: ${record.coverage.entryPointCount}`);
    lines.push(`- Historical nodes: ${record.coverage.historicalNodeCount}`);
    lines.push(`- Static edges assessed: ${record.coverage.completeStaticEdgeAssessmentCount}/${record.coverage.staticPageBackedEdgeCount}`);
    lines.push(`- Maximum depth: ${record.coverage.maximumObservedDepth}`);
    lines.push(`- Cycles: ${record.coverage.cycleCount}`);
    lines.push(`- Dynamic or engine boundaries: ${record.coverage.dynamicOrEngineBoundaryCount}`);
    lines.push(`- Static closure complete: ${record.coverage.staticRecursiveHistoricalTransclusionClosureComplete}`);
    lines.push('- Complete rendered-output attribution: false', '');
  }
  const markdown = `${lines.join('\n')}\n`;
  const graphIndex = `${JSON.stringify(records.map(record => ({ closurePacketKey: record.closurePacketKey, candidateKey: record.candidateKey, coverage: record.coverage, blockers: record.blockers })), null, 2)}\n`;
  const manifest = { contract: 'sensum.content-addressed-artifact-manifest.v1', artifacts: [
    { file: 'recursive-historical-transclusion-closure.md', kind: 'human_readable_recursive_closure_summary', contentHash: contentHash(markdown), bytes: Buffer.byteLength(markdown, 'utf8') },
    { file: 'recursive-historical-transclusion-closure-index.json', kind: 'machine_readable_recursive_closure_index', contentHash: contentHash(graphIndex), bytes: Buffer.byteLength(graphIndex, 'utf8') }
  ] };
  const artifactManifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  return { markdown, graphIndex, artifactManifest: manifest, artifactManifestJson };
}

export function buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(input = {}) {
  const { oneHopRecords = [], oneHopRaw = '', oneHopManifest = {}, oneHopSnapshot = {}, historicalSources = [], magicWordAliases = [], policy = {}, oneHopPolicy = {}, contentHash = hash } = input;
  const compiled = compileActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidencePolicy(policy, oneHopPolicy, contentHash);
  const snapshotAssessment = oneHopSnapshotAssessment(oneHopRaw, oneHopRecords, oneHopManifest, oneHopSnapshot, oneHopPolicy, contentHash);
  const extracted = extractHistoricalSourcesFromOneHopPackets(oneHopRecords, contentHash);
  const suppliedMap = sourceMap(historicalSources);
  const missingInitial = extracted.historicalSources.filter(source => !suppliedMap.has(sourceKey(source.requestedTitle, source.asOfTimestamp)));
  const initialMismatches = extracted.historicalSources.filter(source => suppliedMap.has(sourceKey(source.requestedTitle, source.asOfTimestamp)) && !same(source, suppliedMap.get(sourceKey(source.requestedTitle, source.asOfTimestamp)), contentHash));
  const records = oneHopRecords.map((packet, index) => expectedRecord(packet, index + 1, historicalSources, magicWordAliases, policy, oneHopSnapshot, contentHash));
  const artifacts = buildArtifacts(records, contentHash);
  const audit = auditActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(records, { ...input, compiled, snapshotAssessment, extracted, missingInitial, initialMismatches, artifacts, contentHash });
  return { records, artifacts, audit };
}

export function auditActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(records = [], context = {}) {
  const { oneHopRecords = [], historicalSources = [], compiled = {}, snapshotAssessment = {}, extracted = { conflicts: [] }, missingInitial = [], initialMismatches = [], artifacts = {}, contentHash = hash } = context;
  const expectedKeys = oneHopRecords.map(row => row.candidateKey);
  const actualKeys = records.map(row => row.candidateKey);
  const duplicates = unique(actualKeys.filter((value, index) => actualKeys.indexOf(value) !== index));
  const missing = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpected = actualKeys.filter(key => !expectedKeys.includes(key));
  const nodes = records.flatMap(row => row.historicalDependencyGraph.nodes.map(node => ({ candidateKey: row.candidateKey, node })));
  const edges = records.flatMap(row => row.historicalDependencyGraph.edges.map(edge => ({ candidateKey: row.candidateKey, edge })));
  const incompleteStaticEdges = edges.filter(item => !item.edge.historicalResolution.completeAssessment).map(item => `${item.candidateKey}:${item.edge.edgeKey}`);
  const depthLimits = records.flatMap(row => row.historicalDependencyGraph.depthLimitSources.map(key => `${row.candidateKey}:${key}`));
  const unbalanced = records.flatMap(row => row.historicalDependencyGraph.unbalancedWrapperNodeKeys.map(key => `${row.candidateKey}:${key}`));
  const dynamicBoundaries = nodes.flatMap(item => item.node.dependencyObservations.filter(dep => !dep.pageTitle).map(dep => ({ candidateKey: item.candidateKey, nodeKey: item.node.nodeKey, dependencyClass: dep.dependencyClass })));
  const accountState = accountStateFindings(records);
  const promotions = records.filter(row => row.humanDecisionRecorded !== false || row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null || row.repeatabilityClassification !== null
    || row.membershipOrVariantApplication !== false || row.requirementsVariantsXpTimingAndMechanicsComplete !== false || row.optimizerEligible !== false || row.automaticVerificationApplied !== false || row.accountIndependent !== true).map(row => row.candidateKey);
  const artifactChecks = {
    markdownHashMatches: artifacts.artifactManifest?.artifacts?.[0]?.contentHash === contentHash(artifacts.markdown || ''),
    indexHashMatches: artifacts.artifactManifest?.artifacts?.[1]?.contentHash === contentHash(artifacts.graphIndex || ''),
    manifestStable: Boolean(artifacts.artifactManifestJson && contentHash(artifacts.artifactManifestJson))
  };
  const closureComplete = compiled.valid && snapshotAssessment.complete && !extracted.conflicts.length && !missingInitial.length && !initialMismatches.length
    && !duplicates.length && !missing.length && !unexpected.length && records.length > 0 && records.every(row => row.coverage.staticRecursiveHistoricalTransclusionClosureComplete)
    && !incompleteStaticEdges.length && !depthLimits.length && !unbalanced.length && !promotions.length && !accountState.length && Object.values(artifactChecks).every(Boolean);
  const blockers = [];
  if (!compiled.valid) blockers.push('recursive_closure_policy_invalid');
  if (!snapshotAssessment.complete) blockers.push('explicit_one_hop_snapshot_revalidation_failed');
  if (extracted.conflicts.length || missingInitial.length || initialMismatches.length) blockers.push('one_hop_historical_source_preservation_failed');
  if (duplicates.length || missing.length || unexpected.length) blockers.push('recursive_closure_candidate_set_mismatch');
  if (incompleteStaticEdges.length) blockers.push('one_or_more_static_historical_dependency_edges_unresolved');
  if (depthLimits.length) blockers.push('recursive_graph_depth_limit_reached');
  if (unbalanced.length) blockers.push('one_or_more_transclusion_wrapper_structures_unbalanced');
  if (promotions.length) blockers.push('unsupported_semantic_or_optimizer_promotion');
  if (accountState.length) blockers.push('account_query_state_baked_into_recursive_closure');
  if (!Object.values(artifactChecks).every(Boolean)) blockers.push('recursive_closure_artifact_hash_validation_failed');
  if (dynamicBoundaries.length) blockers.push('dynamic_or_engine_expansion_boundaries_unresolved');
  blockers.push('complete_rendered_output_attribution_not_established', 'composite_or_container_subject_boundary_human_review_pending', 'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved', 'independent_complete_activity_universe_not_established');
  return {
    contract: context.policy.auditContract,
    policyCoverage: compiled,
    inputCoverage: { oneHopSnapshot: snapshotAssessment, extractedHistoricalSourceCount: extracted.historicalSources?.length || 0, suppliedHistoricalSourceCount: historicalSources.length, conflictingExtractedSourceKeys: extracted.conflicts, missingInitialSourceKeys: missingInitial.map(row => sourceKey(row.requestedTitle, row.asOfTimestamp)), mismatchedInitialSourceKeys: initialMismatches.map(row => sourceKey(row.requestedTitle, row.asOfTimestamp)) },
    candidateCoverage: { oneHopPacketCount: oneHopRecords.length, closurePacketCount: records.length, duplicateCandidateKeys: duplicates, missingCandidateKeys: missing, unexpectedCandidateKeys: unexpected, exactCandidateOrder: same(expectedKeys, actualKeys, contentHash) },
    graphCoverage: { historicalNodeCount: nodes.length, uniqueCandidateScopedNodeCount: unique(nodes.map(item => `${item.candidateKey}:${item.node.nodeKey}`)).length, staticPageBackedEdgeCount: edges.length, completeStaticEdgeAssessmentCount: edges.length - incompleteStaticEdges.length, explicitHistoricalAbsenceEdgeCount: edges.filter(item => item.edge.historicalResolution.state === 'complete_explicit_historical_absence').length, redirectHopCount: records.reduce((sum, row) => sum + row.coverage.redirectHopCount, 0), maximumObservedDepth: records.reduce((maximum, row) => Math.max(maximum, row.coverage.maximumObservedDepth), 0), cycleCount: records.reduce((sum, row) => sum + row.coverage.cycleCount, 0), cycleEdgeCount: records.reduce((sum, row) => sum + row.coverage.cycleEdgeCount, 0), incompleteStaticEdgeKeys: incompleteStaticEdges, depthLimitSourceKeys: depthLimits },
    wrapperCoverage: { wikitextNodeCount: records.reduce((sum, row) => sum + row.coverage.wikitextNodeCount, 0), onlyincludeNodeCount: records.reduce((sum, row) => sum + row.coverage.onlyincludeNodeCount, 0), noincludeNodeCount: records.reduce((sum, row) => sum + row.coverage.noincludeNodeCount, 0), unbalancedWrapperNodeKeys: unbalanced },
    dependencyBoundaryCoverage: { luaModuleNodeCount: records.reduce((sum, row) => sum + row.coverage.luaModuleNodeCount, 0), dynamicOrEngineBoundaryCount: dynamicBoundaries.length, boundaryClassCounts: Object.fromEntries(sorted(unique(dynamicBoundaries.map(row => row.dependencyClass))).map(kind => [kind, dynamicBoundaries.filter(row => row.dependencyClass === kind).length])), completeRenderedOutputAttributionCount: 0 },
    semanticPreservationCoverage: { humanDecisionRecordedCount: records.filter(row => row.humanDecisionRecorded).length, canonicalIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length, repeatabilityClassificationCount: records.filter(row => row.repeatabilityClassification !== null).length, membershipOrVariantApplicationCount: records.filter(row => row.membershipOrVariantApplication).length, mechanicsCompletionCount: records.filter(row => row.requirementsVariantsXpTimingAndMechanicsComplete).length, optimizerEligibleCount: records.filter(row => row.optimizerEligible).length, automaticVerificationCount: records.filter(row => row.automaticVerificationApplied).length, unsupportedPromotionCandidateKeys: promotions },
    accountStateFindings: accountState,
    artifactCoverage: artifactChecks,
    staticRecursiveHistoricalTransclusionClosureComplete: closureComplete,
    completeRenderedOutputAttribution: false,
    humanReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: closureComplete
  };
}
