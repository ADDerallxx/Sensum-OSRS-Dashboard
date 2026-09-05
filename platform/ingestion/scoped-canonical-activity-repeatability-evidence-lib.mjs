import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';
import { maskRepeatabilityIgnoredRegions } from './activity-reference-collection-member-repeatability-evidence-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = revision => revision?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;
const expectedDomains = [
  'parent_activity_post_completion_reassignment_or_restart',
  'member_task_reselection_and_repeatability',
  'cooldown_reset_daily_or_session_limits',
  'finite_exhaustion_one_time_or_completion_lockout',
  'availability_and_assignment_eligibility_across_sessions',
  'independent_source_corroboration_or_conflict'
];
const expectedChannels = [
  'complete_exact_revision_source_text',
  'prior_scope_packet_revision_and_hash_alignment',
  'complete_source_line_inventory',
  'comments_and_protected_regions_masked',
  'generic_source_located_signal_inventory',
  'evidence_domain_partition',
  'parent_and_member_repeatability_separation',
  'repeatability_verdict_separation'
];
const allowedSignalKinds = new Set([
  'explicit_repeatability_declaration_candidate',
  'recurrence_structure_candidate_not_repeatability_proof',
  'member_repeatability_declaration_candidate',
  'cooldown_reset_or_frequency_limit_candidate',
  'finite_exhaustion_or_lockout_candidate',
  'availability_or_assignment_condition_candidate',
  'independent_source_reference_candidate_not_corroboration'
]);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceScopedCanonicalActivityRepeatabilityEvidenceWorkRoutingContentHash',
  'canonicalActivityRepeatabilityEvidenceSources',
  'canonicalActivityRepeatabilityEvidence',
  'canonicalActivityRepeatabilityEvidenceReview'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|scopeClass|scopeClasses|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileScopedCanonicalActivityRepeatabilityEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'oneEvidencePacketPerMatchingRepeatabilityEvidenceRoute',
    'everyScopedSubjectSourceIsFetchedAtItsExactBindingRevision',
    'fetchedPageIdTitleRevisionTimestampUrlAndContentHashMustMatchTheBinding',
    'priorScopePacketMustMatchTheSameExactRevisionHashAndSourceText',
    'completeExactRevisionSourceTextMustBeRetained',
    'everySourceLineMustBeRetainedWithLocationAndHash',
    'commentsAndProtectedRegionsCannotCreateSignals',
    'everySignalRetainsDomainKindExactTextLocationRevisionAndHash',
    'allRequiredDomainsAreCapturedEvenWhenNoSignalIsObserved',
    'absenceOfASignalIsNotEvidenceOfNonRepeatability',
    'recurrenceStructuresDeclaredCountsAndPluralTasksAreNotRepeatabilityProof',
    'citationOrExternalReferencePresenceIsNotIndependentCorroboration',
    'parentAndMemberRepeatabilityRemainSeparate',
    'repeatabilityVerdictsRemainNull',
    'missingChangedContradictoryTruncatedCompositeOrConditionMismatchedEvidenceRemainsBlocked',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesScopeClassesAndOverridesCannotSelectAVerdict',
    'inputEvidenceIdentityRevisionHashesBindingScopeDispositionRoutingAndContextMustBePreserved',
    'memberMechanicsAndOptimizerPromotionAreForbidden',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract || !policy.inputState) invalidRules.push('repeatability_evidence_contract_boundary_missing');
  if (!policy.inputRouteKey || !String(policy.inputRouteState || '').startsWith('blocked_')) invalidRules.push('repeatability_evidence_route_boundary_invalid');
  if (JSON.stringify(policy.requiredEvidenceDomains || []) !== JSON.stringify(expectedDomains)) invalidRules.push('required_evidence_domains_missing_changed_or_out_of_order');
  if (JSON.stringify(policy.requiredCaptureChannels || []) !== JSON.stringify(expectedChannels)) invalidRules.push('required_capture_channels_missing_changed_or_out_of_order');
  const definitions = policy.sourceScan?.signalDefinitions || [];
  const duplicateDefinitionKeys = duplicates(definitions.map(definition => definition.definitionKey));
  const invalidDefinitionKeys = [];
  const compiledDefinitions = [];
  for (const definition of definitions) {
    let expression = null;
    try {
      expression = new RegExp(definition.pattern, `${policy.sourceScan?.caseInsensitive === false ? '' : 'i'}${policy.sourceScan?.unicode === false ? '' : 'u'}g`);
    } catch {
      // Invalid definitions are reported below.
    }
    if (!definition.definitionKey || !expectedDomains.includes(definition.evidenceDomain)
      || !allowedSignalKinds.has(definition.signalKind) || !definition.pattern || !expression || expression.test('')) {
      invalidDefinitionKeys.push(definition.definitionKey || '(missing)');
      continue;
    }
    expression.lastIndex = 0;
    compiledDefinitions.push({ ...definition, expression });
  }
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    duplicateDefinitionKeys,
    invalidDefinitionKeys: unique(invalidDefinitionKeys),
    requiredDomainsMissingDefinitions: expectedDomains.filter(domain => !definitions.some(definition => definition.evidenceDomain === domain)),
    definitions: compiledDefinitions,
    requiredEvidenceDomains: policy.requiredEvidenceDomains || [],
    requiredCaptureChannels: policy.requiredCaptureChannels || []
  };
}

function routeMatches(record, policy) {
  const route = record.canonicalActivityRepeatabilityEvidenceWorkRouting || {};
  const disposition = record.canonicalActivityScopeDisposition || {};
  const review = record.canonicalActivityScopeReview || {};
  const binding = record.canonicalActivitySubjectBinding || {};
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && route.routeKey === policy.inputRouteKey
    && route.routeState === policy.inputRouteState
    && route.parentAndMemberRepeatabilitySeparated === true
    && JSON.stringify(route.requiredEvidenceDomains || []) === JSON.stringify(policy.requiredEvidenceDomains || [])
    && disposition.state === 'source_supported_composite_assigned_task_activity_scope'
    && disposition.canonicalActivityScopeVerdict === route.sourceScopeVerdict
    && disposition.repeatabilityVerdict === null
    && disposition.memberInventoryComplete === false
    && review.state === 'reviewed_source_supported_composite_assigned_task_activity_scope'
    && review.canonicalActivityScopeVerdict === disposition.canonicalActivityScopeVerdict
    && review.repeatabilityVerdict === null
    && binding.canonicalActivityKey === record.canonicalActivityIdentity?.canonicalActivityKey
    && binding.accountIndependent === true
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true;
}

export function selectScopedCanonicalActivityRepeatabilityEvidenceRoutes(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

export function discoverScopedCanonicalActivityRepeatabilityExactRevisionRequests(records = [], policy = {}) {
  const requests = new Map();
  for (const record of selectScopedCanonicalActivityRepeatabilityEvidenceRoutes(records, policy)) {
    const source = record.canonicalActivitySubjectBinding?.sourcePageIdentity || {};
    if (!source.sourceRevision) continue;
    const key = String(source.sourceRevision);
    const request = requests.get(key) || {
      sourceRevision: key,
      sourcePageId: Number(source.sourcePageId || 0) || null,
      resolvedTitle: source.resolvedTitle || null,
      sourceTimestamp: source.sourceTimestamp || null,
      sourceUrl: source.sourceUrl || null,
      sourceContentHash: source.sourceContentHash || null,
      routeContexts: []
    };
    request.routeContexts.push({ memberCandidateKey: record.memberCandidateKey, canonicalActivityKey: record.canonicalActivityIdentity?.canonicalActivityKey || null });
    request.routeContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    requests.set(key, request);
  }
  return [...requests.values()].sort((a, b) => Number(a.sourcePageId) - Number(b.sourcePageId) || a.sourceRevision.localeCompare(b.sourceRevision));
}

function fetchedByRevision(fetchedPages = []) {
  return new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === '\n') starts.push(index + 1);
  return starts;
}

function lineNumberAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= offset) low = middle + 1;
    else high = middle - 1;
  }
  return high + 1;
}

function sourceLocator(text, starts, index, length) {
  const lineStart = lineNumberAt(starts, index);
  const lineEnd = lineNumberAt(starts, Math.max(index, index + length - 1));
  return {
    lineStart,
    lineEnd,
    columnStart: index - starts[lineStart - 1] + 1,
    columnEnd: index + length - starts[lineEnd - 1]
  };
}

function sourceLines(content, contentHash) {
  return String(content).split(/\r?\n/).map((rawText, index) => ({
    ordinal: index + 1,
    sourceLocator: { lineStart: index + 1, lineEnd: index + 1 },
    rawText,
    rawTextContentHash: contentHash(rawText)
  }));
}

export function scanScopedCanonicalActivityRepeatabilitySource({ text, sourcePageIdentity, memberCandidateKey, definitions, contentHash }) {
  const original = String(text || '');
  const masked = maskRepeatabilityIgnoredRegions(original);
  const starts = lineStarts(masked);
  const lines = original.split(/\r?\n/);
  const signals = [];
  for (const definition of definitions) {
    definition.expression.lastIndex = 0;
    let ordinal = 0;
    for (const match of masked.matchAll(definition.expression)) {
      ordinal += 1;
      const locator = sourceLocator(masked, starts, match.index, match[0].length);
      const exactSourceLine = lines[locator.lineStart - 1] || '';
      signals.push({
        evidenceKey: `${memberCandidateKey}:scoped-repeatability:${definition.definitionKey}:${ordinal}`,
        definitionKey: definition.definitionKey,
        evidenceDomain: definition.evidenceDomain,
        signalKind: definition.signalKind,
        sourcePageId: sourcePageIdentity.sourcePageId,
        sourceRevision: String(sourcePageIdentity.sourceRevision || ''),
        sourceContentHash: sourcePageIdentity.sourceContentHash,
        matchedText: original.slice(match.index, match.index + match[0].length),
        exactSourceLine,
        exactSourceLineContentHash: contentHash(exactSourceLine),
        sourceLocator: locator,
        reviewState: 'candidate_only_not_parent_or_member_repeatability_verdict'
      });
    }
  }
  return signals;
}

function packetFor(input, fetched, policy, contentHash) {
  const compiled = compileScopedCanonicalActivityRepeatabilityEvidencePolicy(policy);
  const expected = input.canonicalActivitySubjectBinding?.sourcePageIdentity || {};
  const priorPackets = input.canonicalActivityScopeEvidenceSources || [];
  const prior = priorPackets[0] || {};
  const page = fetched?.page || null;
  const revision = fetched?.revision || null;
  const content = sourceContent(revision);
  const computedHash = typeof content === 'string' ? contentHash(content) : null;
  const actualIdentity = {
    sourcePageId: page?.pageid ? Number(page.pageid) : null,
    resolvedTitle: page?.title || null,
    sourceRevision: revision?.revid ? String(revision.revid) : null,
    sourceTimestamp: revision?.timestamp || null,
    sourceUrl: page?.title ? wikiUrl(page.title) : null,
    sourceContentHash: computedHash,
    sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : 0
  };
  const lines = typeof content === 'string' ? sourceLines(content, contentHash) : [];
  const reconstructed = lines.map(line => line.rawText).join('\n');
  const priorLines = prior.structuralInventory?.sourceLines || [];
  const verification = {
    fetchedPagePresent: Boolean(page),
    fetchedRevisionContentPresent: typeof content === 'string',
    fetchedPageIdMatchesBinding: Boolean(page && Number(page.pageid) === Number(expected.sourcePageId)),
    fetchedTitleMatchesBinding: Boolean(page && page.title === expected.resolvedTitle),
    fetchedRevisionMatchesBinding: Boolean(revision && String(revision.revid) === String(expected.sourceRevision || '')),
    fetchedTimestampMatchesBinding: Boolean(revision && revision.timestamp === expected.sourceTimestamp),
    fetchedUrlMatchesBinding: Boolean(actualIdentity.sourceUrl && actualIdentity.sourceUrl === expected.sourceUrl),
    fetchedContentHashMatchesBinding: Boolean(computedHash && computedHash === expected.sourceContentHash),
    exactlyOnePriorScopeEvidenceSource: priorPackets.length === 1,
    priorScopeSourceIdentityMatchesBinding: ['sourcePageId', 'resolvedTitle', 'sourceRevision', 'sourceTimestamp', 'sourceUrl', 'sourceContentHash'].every(field => prior.sourcePageIdentity?.[field] === expected[field]),
    priorScopeSourceTextMatchesRefetch: typeof content === 'string' && prior.exactRevisionSourceText === content,
    priorScopeLineInventoryMatchesRefetch: priorLines.length === lines.length && priorLines.every((line, index) => line.rawText === lines[index]?.rawText && line.rawTextContentHash === lines[index]?.rawTextContentHash)
  };
  const signals = typeof content === 'string' ? scanScopedCanonicalActivityRepeatabilitySource({
    text: content,
    sourcePageIdentity: actualIdentity,
    memberCandidateKey: input.memberCandidateKey,
    definitions: compiled.definitions,
    contentHash
  }) : [];
  const domainEvidence = (policy.requiredEvidenceDomains || []).map(domainKey => ({
    domainKey,
    captureState: 'captured_for_semantic_disposition_not_a_repeatability_verdict',
    resolutionState: 'unresolved_pending_semantic_disposition_and_possible_independent_evidence',
    sourceEvidenceKeys: signals.filter(signal => signal.evidenceDomain === domainKey).map(signal => signal.evidenceKey),
    noSignalSemantics: signals.some(signal => signal.evidenceDomain === domainKey) ? null : 'no_source_signal_observed_is_not_negative_evidence'
  }));
  const capture = {
    complete_exact_revision_source_text: typeof content === 'string' && content.length > 0,
    prior_scope_packet_revision_and_hash_alignment: Object.values(verification).every(Boolean),
    complete_source_line_inventory: typeof content === 'string' && reconstructed === content && lines.every((line, index) => line.ordinal === index + 1 && line.rawTextContentHash === contentHash(line.rawText)),
    comments_and_protected_regions_masked: policy.sourceScan?.maskCommentsAndProtectedRegions === true,
    generic_source_located_signal_inventory: typeof content === 'string' && signals.every(signal => signal.sourceRevision === actualIdentity.sourceRevision && signal.sourceContentHash === actualIdentity.sourceContentHash && signal.exactSourceLineContentHash === contentHash(signal.exactSourceLine)),
    evidence_domain_partition: domainEvidence.length === expectedDomains.length && domainEvidence.every((domain, index) => domain.domainKey === expectedDomains[index]),
    parent_and_member_repeatability_separation: true,
    repeatability_verdict_separation: true
  };
  const policyInvalid = compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.duplicateDefinitionKeys.length || compiled.invalidDefinitionKeys.length || compiled.requiredDomainsMissingDefinitions.length;
  const deficiencies = [];
  if (!Object.values(verification).every(Boolean)) deficiencies.push('exact_bound_revision_or_prior_scope_packet_alignment_failed');
  if ((policy.requiredCaptureChannels || []).some(channel => capture[channel] !== true)) deficiencies.push('one_or_more_required_repeatability_capture_channels_incomplete');
  if (policyInvalid) deficiencies.push('repeatability_evidence_policy_invalid_or_incomplete');
  const sourceEvidenceKey = `${input.memberCandidateKey}|${expected.sourcePageId}|${expected.sourceRevision}:scoped-canonical-activity-repeatability-source`;
  return {
    sourceEvidenceKey,
    canonicalActivityKey: input.canonicalActivityIdentity?.canonicalActivityKey || null,
    sourcePageIdentity: actualIdentity,
    sourceRevisionVerification: verification,
    exactRevisionSourceText: typeof content === 'string' ? content : null,
    sourceLines: lines,
    sourceLocatedSignals: signals,
    captureChannels: (policy.requiredCaptureChannels || []).map(channelKey => ({ channelKey, complete: capture[channelKey] === true })),
    domainEvidence,
    parentActivityRepeatabilityVerdict: null,
    memberTaskRepeatabilityVerdict: null,
    repeatabilityVerdict: null,
    deficiencies,
    state: deficiencies.length ? 'blocked_incomplete_revision_pinned_scoped_activity_repeatability_source' : 'complete_revision_pinned_scoped_activity_repeatability_source'
  };
}

function expectedRecord(input, fetchedPages, policy, contentHash) {
  const fetched = fetchedByRevision(fetchedPages);
  const source = input.canonicalActivitySubjectBinding?.sourcePageIdentity || {};
  const packet = packetFor(input, fetched.get(String(source.sourceRevision || '')), policy, contentHash);
  const complete = packet.state === 'complete_revision_pinned_scoped_activity_repeatability_source';
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceScopedCanonicalActivityRepeatabilityEvidenceWorkRoutingContentHash: input.contentHash,
    canonicalActivityRepeatabilityEvidenceSources: [packet],
    canonicalActivityRepeatabilityEvidence: {
      evidenceState: complete ? 'complete_revision_pinned_scoped_canonical_activity_repeatability_evidence_packet' : 'blocked_incomplete_scoped_canonical_activity_repeatability_evidence_packet',
      requiredEvidenceDomainCount: policy.requiredEvidenceDomains?.length || 0,
      capturedEvidenceDomainCount: packet.domainEvidence.length,
      resolvedEvidenceDomainCount: 0,
      requiredCaptureChannelCount: policy.requiredCaptureChannels?.length || 0,
      completedCaptureChannelCount: packet.captureChannels.filter(channel => channel.complete).length,
      sourceEvidenceKeys: [packet.sourceEvidenceKey],
      sourceLocatedSignalCount: packet.sourceLocatedSignals.length,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivityRepeatabilityEvidenceReview: {
      state: complete ? 'unreviewed_complete_revision_pinned_repeatability_evidence_semantic_disposition_required' : 'blocked_incomplete_repeatability_evidence',
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: complete ? [packet.sourceEvidenceKey] : []
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => blocker !== 'routed_scoped_canonical_activity_repeatability_evidence_work_not_completed'),
      ...packet.deficiencies.map(deficiency => `scoped_activity_repeatability_evidence:${deficiency}`),
      ...(complete ? ['scoped_canonical_activity_repeatability_evidence_requires_semantic_disposition'] : ['scoped_canonical_activity_repeatability_evidence_incomplete']),
      'parent_activity_repeatability_unresolved',
      'member_task_repeatability_unresolved',
      'cooldown_reset_daily_or_session_limits_unresolved',
      'finite_exhaustion_one_time_or_completion_lockout_unresolved',
      'future_availability_across_sessions_unresolved',
      'independent_repeatability_corroboration_or_conflict_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: complete
      ? 'scoped_canonical_activity_repeatability_evidence_ready_for_semantic_disposition'
      : 'scoped_canonical_activity_repeatability_evidence_blocked_incomplete'
  };
}

export function buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords = [], fetchedPages = [], policy = {}, contentHash }) {
  const inputs = selectScopedCanonicalActivityRepeatabilityEvidenceRoutes(routingRecords, policy);
  const records = inputs.map(input => expectedRecord(input, fetchedPages, policy, contentHash));
  return { records, audit: auditScopedCanonicalActivityRepeatabilityEvidence(records, { routingRecords, fetchedPages, policy, contentHash }) };
}

export function auditScopedCanonicalActivityRepeatabilityEvidence(records = [], { routingRecords = [], fetchedPages = [], policy = {}, contentHash } = {}) {
  const compiled = compileScopedCanonicalActivityRepeatabilityEvidencePolicy(policy);
  const inputs = selectScopedCanonicalActivityRepeatabilityEvidenceRoutes(routingRecords, policy);
  const expected = inputs.map(input => expectedRecord(input, fetchedPages, policy, contentHash));
  const expectedKeys = inputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const inputByKey = new Map(inputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const duplicateInputKeys = duplicates(routingRecords.map(record => record.memberCandidateKey));
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const ineligibleKeys = routingRecords.filter(record => !routeMatches(record, policy)).map(record => record.memberCandidateKey);
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.sourceScopedCanonicalActivityRepeatabilityEvidenceWorkRoutingContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const packetMismatches = records.filter(record => {
    const wanted = expectedByKey.get(record.memberCandidateKey);
    return !wanted
      || JSON.stringify(record.canonicalActivityRepeatabilityEvidenceSources) !== JSON.stringify(wanted.canonicalActivityRepeatabilityEvidenceSources)
      || JSON.stringify(record.canonicalActivityRepeatabilityEvidence) !== JSON.stringify(wanted.canonicalActivityRepeatabilityEvidence)
      || JSON.stringify(record.canonicalActivityRepeatabilityEvidenceReview) !== JSON.stringify(wanted.canonicalActivityRepeatabilityEvidenceReview);
  }).map(record => record.memberCandidateKey);
  const requests = discoverScopedCanonicalActivityRepeatabilityExactRevisionRequests(routingRecords, policy);
  const requestedRevisions = requests.map(request => request.sourceRevision);
  const fetchedRevisions = fetchedPages.flatMap(page => (page.revisions || []).map(revision => String(revision.revid)));
  const missingFetchedRevisions = requestedRevisions.filter(revision => !fetchedRevisions.includes(revision));
  const unexpectedFetchedRevisions = fetchedRevisions.filter(revision => !requestedRevisions.includes(revision));
  const duplicateFetchedRevisions = duplicates(fetchedRevisions);
  const incompletePackets = records.filter(record => record.canonicalActivityRepeatabilityEvidence?.evidenceState !== 'complete_revision_pinned_scoped_canonical_activity_repeatability_evidence_packet').map(record => record.memberCandidateKey);
  const incompleteDomains = records.filter(record => record.canonicalActivityRepeatabilityEvidence?.capturedEvidenceDomainCount !== expectedDomains.length).map(record => record.memberCandidateKey);
  const incompleteChannels = records.filter(record => record.canonicalActivityRepeatabilityEvidence?.completedCaptureChannelCount !== expectedChannels.length).map(record => record.memberCandidateKey);
  const allSignals = records.flatMap(record => record.canonicalActivityRepeatabilityEvidenceSources?.flatMap(source => source.sourceLocatedSignals || []) || []);
  const invalidSignals = allSignals.filter(signal => !expectedDomains.includes(signal.evidenceDomain)
    || !allowedSignalKinds.has(signal.signalKind)
    || !signal.sourceRevision || !signal.sourceContentHash || !signal.exactSourceLineContentHash
    || signal.reviewState !== 'candidate_only_not_parent_or_member_repeatability_verdict');
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.canonicalActivityRepeatabilityEvidence?.parentActivityRepeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityEvidence?.memberTaskRepeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityEvidence?.repeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityEvidenceReview?.parentActivityRepeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityEvidenceReview?.memberTaskRepeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityEvidenceReview?.repeatabilityVerdict !== null
      || record.canonicalActivityRepeatabilityEvidenceSources?.some(source => source.parentActivityRepeatabilityVerdict !== null || source.memberTaskRepeatabilityVerdict !== null || source.repeatabilityVerdict !== null)
      || JSON.stringify(record.canonicalActivityScopeDisposition) !== JSON.stringify(input.canonicalActivityScopeDisposition)
      || JSON.stringify(record.canonicalActivityScopeReview) !== JSON.stringify(input.canonicalActivityScopeReview)
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!routingRecords.length) structuralBlockers.push('no_scoped_activity_repeatability_evidence_routing_records');
  if (!inputs.length) structuralBlockers.push('no_matching_scoped_activity_repeatability_evidence_routes');
  if (ineligibleKeys.length) structuralBlockers.push('one_or_more_input_routes_are_ineligible_or_incoherent');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_route_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('upstream_evidence_identity_revision_hash_binding_scope_disposition_routing_or_context_changed');
  if (packetMismatches.length) structuralBlockers.push('one_or_more_repeatability_evidence_packets_or_signals_do_not_match_exact_revision_sources');
  if (missingFetchedRevisions.length || unexpectedFetchedRevisions.length || duplicateFetchedRevisions.length) structuralBlockers.push('exact_scoped_activity_revision_fetch_set_mismatch');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.duplicateDefinitionKeys.length || compiled.invalidDefinitionKeys.length || compiled.requiredDomainsMissingDefinitions.length) structuralBlockers.push('scoped_activity_repeatability_evidence_policy_invalid_or_activity_specific');
  if (invalidSignals.length) structuralBlockers.push('one_or_more_repeatability_candidate_signals_are_invalid_or_unlocated');
  if (unsupportedPromotions.length) structuralBlockers.push('repeatability_evidence_created_unsupported_parent_member_scope_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_scoped_activity_repeatability_evidence');
  const evidencePacketAttemptCoverageComplete = records.length > 0 && structuralBlockers.length === 0;
  const repeatabilityEvidencePacketCoverageComplete = evidencePacketAttemptCoverageComplete && !incompletePackets.length && !incompleteDomains.length && !incompleteChannels.length;
  const countDomain = domain => allSignals.filter(signal => signal.evidenceDomain === domain).length;
  const countKind = kind => allSignals.filter(signal => signal.signalKind === kind).length;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputRoutingRecordCount: routingRecords.length,
      eligibleRoutingRecordCount: inputs.length,
      evidenceRecordCount: records.length,
      ineligibleMemberCandidateKeys: ineligibleKeys,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      duplicateDefinitionKeys: compiled.duplicateDefinitionKeys,
      invalidDefinitionKeys: compiled.invalidDefinitionKeys,
      requiredDomainsMissingDefinitions: compiled.requiredDomainsMissingDefinitions,
      requiredEvidenceDomainCount: compiled.requiredEvidenceDomains.length,
      requiredCaptureChannelCount: compiled.requiredCaptureChannels.length,
      signalDefinitionCount: compiled.definitions.length
    },
    revisionCoverage: {
      requestedExactRevisionCount: requestedRevisions.length,
      fetchedExactRevisionCount: fetchedRevisions.length,
      missingFetchedRevisions,
      unexpectedFetchedRevisions,
      duplicateFetchedRevisions,
      exactRevisionFetchSetMatch: !missingFetchedRevisions.length && !unexpectedFetchedRevisions.length && !duplicateFetchedRevisions.length
    },
    captureCoverage: {
      completePacketCount: records.length - incompletePackets.length,
      incompletePacketCount: incompletePackets.length,
      incompletePacketMemberCandidateKeys: incompletePackets,
      completeEvidenceDomainSetCount: records.length - incompleteDomains.length,
      completeCaptureChannelSetCount: records.length - incompleteChannels.length,
      retainedExactRevisionSourceCount: records.filter(record => record.canonicalActivityRepeatabilityEvidenceSources?.[0]?.exactRevisionSourceText !== null).length,
      retainedSourceBytes: records.reduce((sum, record) => sum + Number(record.canonicalActivityRepeatabilityEvidenceSources?.[0]?.sourcePageIdentity?.sourceContentBytes || 0), 0),
      retainedSourceLines: records.reduce((sum, record) => sum + Number(record.canonicalActivityRepeatabilityEvidenceSources?.[0]?.sourceLines?.length || 0), 0),
      packetMismatchMemberCandidateKeys: packetMismatches,
      invalidSignalCount: invalidSignals.length
    },
    candidateObservationCoverage: {
      sourceLocatedSignalCount: allSignals.length,
      parentActivityCandidateCount: countDomain('parent_activity_post_completion_reassignment_or_restart'),
      memberTaskCandidateCount: countDomain('member_task_reselection_and_repeatability'),
      cooldownResetLimitCandidateCount: countDomain('cooldown_reset_daily_or_session_limits'),
      finiteExhaustionLockoutCandidateCount: countDomain('finite_exhaustion_one_time_or_completion_lockout'),
      availabilityEligibilityCandidateCount: countDomain('availability_and_assignment_eligibility_across_sessions'),
      independentSourceReferenceCandidateCount: countDomain('independent_source_corroboration_or_conflict'),
      explicitRepeatabilityDeclarationCandidateCount: countKind('explicit_repeatability_declaration_candidate'),
      recurrenceStructureNotProofCount: countKind('recurrence_structure_candidate_not_repeatability_proof'),
      repeatabilityVerdictCount: records.filter(record => record.canonicalActivityRepeatabilityEvidence?.repeatabilityVerdict !== null).length,
      zeroSignalPacketCount: records.filter(record => record.canonicalActivityRepeatabilityEvidence?.sourceLocatedSignalCount === 0).length
    },
    semanticPreservationCoverage: {
      preservedCanonicalActivityScopeClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === 'source_supported_composite_assigned_task_activity_scope').length,
      parentActivityRepeatabilityClassificationCount: records.filter(record => record.canonicalActivityRepeatabilityEvidenceReview?.parentActivityRepeatabilityVerdict !== null).length,
      memberTaskRepeatabilityClassificationCount: records.filter(record => record.canonicalActivityRepeatabilityEvidenceReview?.memberTaskRepeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    evidencePacketAttemptCoverageComplete,
    repeatabilityEvidencePacketCoverageComplete,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(incompletePackets.length ? ['one_or_more_revision_pinned_scoped_activity_repeatability_sources_incomplete'] : []),
      ...(incompleteDomains.length ? ['one_or_more_repeatability_evidence_domain_sets_incomplete'] : []),
      ...(incompleteChannels.length ? ['one_or_more_repeatability_capture_channel_sets_incomplete'] : []),
      'scoped_canonical_activity_repeatability_evidence_requires_semantic_disposition',
      'parent_activity_repeatability_unresolved',
      'member_task_repeatability_unresolved',
      'cooldown_reset_daily_or_session_limits_unresolved',
      'finite_exhaustion_one_time_or_completion_lockout_unresolved',
      'future_availability_across_sessions_unresolved',
      'independent_repeatability_corroboration_or_conflict_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: evidencePacketAttemptCoverageComplete
  };
}
