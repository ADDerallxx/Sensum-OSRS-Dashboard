import { hash } from './lib.mjs';

const REQUIRED_CHANNELS = [
  'exact_revision_source_revalidation',
  'exact_parent_occurrence_binding',
  'candidate_scoped_same_line_weight_statement',
  'parent_global_weight_statement',
  'candidate_subject_corroboration',
  'duplicate_alias_and_variant_signals',
  'weighted_membership_verdict_separation'
];
const REQUIRED_RULES = [
  'oneEvidencePacketPerWeightedMembershipWorkItem',
  'allReferencedSourceKeysMustResolveExactlyOnce',
  'allReferencedSourcesMustBeRefetchedAtTheirExactRevision',
  'fetchedPageIdTitleRevisionTimestampUrlBytesAndContentHashMustMatch',
  'upstreamExactSourceTextAndHashMustRevalidate',
  'exactParentOccurrenceMustMatchItsPinnedLocatorAndHash',
  'candidateScopedWeightRequiresWeightLanguageOnTheExactCandidateOccurrenceLine',
  'parentGlobalWeightLanguageIsNotCandidateScopedMembershipProof',
  'parentDistributionPercentagesAreScopeObservationsNotPerEntryWeights',
  'candidateSubjectCorroborationRequiresParentTitleAnchorAndRelationshipLanguageOnOneExactLine',
  'sourceSilenceIsNotNegativeEvidence',
  'duplicateAliasAndVariantSignalsAreObservationsNotMembershipVerdicts',
  'captureCompletenessDoesNotEstablishSemanticCompleteness',
  'weightedMembershipIdentityMappingCompletenessRepeatabilityMechanicsAndOptimizerVerdictsRemainClosed',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const STAGE_FIELDS = new Set([
  'contract', 'contentHash', 'blockers', 'state', 'sourceRoutingRecordContentHash',
  'weightedParentTaskEntryMembershipEvidenceSources',
  'weightedParentTaskEntryMembershipEvidencePackets',
  'weightedParentTaskEntryMembershipEvidenceReview',
  'weightedTaskEntryMembershipVerdict', 'memberUniverseComplete',
  'automaticVerificationApplied'
]);
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !STAGE_FIELDS.has(key)));
const sourceContent = revision => revision?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|title|titles|candidateKey|candidateKeys|structuralCandidateKey|structuralCandidateKeys|label|labels|alias|aliases|override|overrides)$/i;
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  walk(policy);
  return sorted(unique(findings));
}

function compileDefinitions(definitions = [], expectedClasses = new Set()) {
  const compiled = [];
  const invalid = [];
  for (const definition of definitions) {
    let expression = null;
    try { expression = new RegExp(definition.pattern, 'giu'); } catch {}
    if (!definition.definitionKey || !expectedClasses.has(definition.observationClass) || !definition.pattern || !expression || expression.test('')) {
      invalid.push(definition.definitionKey || '(missing)');
      continue;
    }
    expression.lastIndex = 0;
    compiled.push({ ...definition, expression });
  }
  return { compiled, invalid: unique(invalid), duplicateKeys: duplicates(definitions.map(item => item.definitionKey)) };
}

export function compileWeightedParentTaskEntryMembershipEvidencePolicy(policy = {}) {
  const weights = compileDefinitions(policy.sourceScan?.weightDefinitions, new Set([
    'source_authored_global_equal_weight_statement', 'source_authored_global_equal_chance_statement'
  ]));
  const distributions = compileDefinitions(policy.sourceScan?.distributionDefinitions, new Set([
    'source_authored_approximate_task_share'
  ]));
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.structural-member-candidate-review-ready-identity-and-remaining-gap-work-routing.v1'
    && policy.recordContract === 'sensum.weighted-parent-task-entry-membership-evidence.v1'
    && policy.auditContract === 'sensum.weighted-parent-task-entry-membership-evidence-audit.v1'
    && policy.inputState === 'structural_member_candidate_review_ready_identity_and_remaining_gap_work_routed_gates_closed'
    && policy.inputRouteState === 'review_ready_identities_and_remaining_semantic_gaps_routed_all_verdicts_closed'
    && policy.inputRouteKey === 'weighted_parent_task_entry_membership_evidence'
    && policy.inputWorkKind === 'candidate_scoped_weight_alias_and_variant_membership_evidence'
    && policy.outputState === 'revision_pinned_weighted_parent_task_entry_membership_evidence_captured_verdicts_closed';
  const invalidChannels = same(policy.requiredChannels || [], REQUIRED_CHANNELS) ? [] : ['requiredChannels'];
  const forbidden = forbiddenPolicyPaths(policy);
  const invalidDefinitions = [...weights.invalid, ...distributions.invalid];
  const duplicateDefinitionKeys = unique([...weights.duplicateKeys, ...distributions.duplicateKeys]);
  const relationshipLexemesValid = Array.isArray(policy.sourceScan?.relationshipLexemes)
    && policy.sourceScan.relationshipLexemes.length > 0
    && policy.sourceScan.relationshipLexemes.every(value => typeof value === 'string' && /^[a-z]+$/i.test(value));
  const stopwordsValid = Array.isArray(policy.sourceScan?.parentTitleAnchorStopwords)
    && policy.sourceScan.parentTitleAnchorStopwords.every(value => typeof value === 'string' && /^[a-z]+$/i.test(value));
  return {
    valid: contractValid && invalidRules.length === 0 && invalidChannels.length === 0 && forbidden.length === 0
      && invalidDefinitions.length === 0 && duplicateDefinitionKeys.length === 0 && weights.compiled.length > 0
      && distributions.compiled.length > 0 && relationshipLexemesValid && stopwordsValid,
    contractValid,
    invalidRules: unique(invalidRules),
    invalidChannels,
    forbiddenPolicyPaths: forbidden,
    invalidDefinitions,
    duplicateDefinitionKeys,
    relationshipLexemesValid,
    stopwordsValid,
    weightDefinitions: weights.compiled,
    distributionDefinitions: distributions.compiled
  };
}

function routing(record = {}) {
  return record.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting || {};
}

function eligibleInput(record = {}, policy = {}) {
  const route = routing(record);
  const items = route.weightedMembershipWorkItems || [];
  return record.contract === policy.inputContract && record.state === policy.inputState && record.accountIndependent === true
    && record.optimizerEligible === false && route.routeState === policy.inputRouteState
    && route.weightedMembershipWorkItemCount === items.length && items.length > 0
    && items.every(item => item.routeKey === policy.inputRouteKey && item.workKind === policy.inputWorkKind
      && item.workState === 'blocked_pending_weighted_parent_task_entry_membership_evidence'
      && item.evidenceWorkComplete === false && item.reviewDecision === null && item.weightedTaskEntryMembershipVerdict === null
      && item.memberUniverseComplete === false && item.automaticVerificationApplied === false
      && same(item.requiredChannels || [], ['candidate_scoped_weight_statement', 'duplicate_alias_treatment', 'variant_membership_treatment', 'weighted_membership_review']));
}

export function selectWeightedParentTaskEntryMembershipEvidenceInputs(records = [], policy = {}) {
  return records.filter(record => eligibleInput(record, policy));
}

function sourceCatalog(record = {}) {
  return record.structuralMemberCandidateSemanticGapEvidenceSources || [];
}

export function discoverWeightedParentTaskEntryMembershipExactRevisionRequests(records = [], policy = {}) {
  const requests = new Map();
  for (const record of selectWeightedParentTaskEntryMembershipEvidenceInputs(records, policy)) {
    const sources = new Map(sourceCatalog(record).map(source => [source.sourceKey, source]));
    for (const item of routing(record).weightedMembershipWorkItems || []) {
      for (const sourceKey of item.sourceEvidenceKeys || []) {
        const source = sources.get(sourceKey);
        if (!source) continue;
        const identity = source.sourcePageIdentity || {};
        const key = String(identity.sourceRevision || '');
        if (!key) continue;
        const request = requests.get(key) || {
          sourceKey,
          sourceRevision: key,
          sourcePageId: Number(identity.sourcePageId || 0) || null,
          resolvedTitle: identity.resolvedTitle || null,
          sourceTimestamp: identity.sourceTimestamp || null,
          sourceUrl: identity.sourceUrl || null,
          sourceContentHash: identity.sourceContentHash || null,
          sourceContentBytes: Number(identity.sourceContentBytes || 0),
          workItemKeys: []
        };
        request.workItemKeys.push(item.workItemKey);
        request.workItemKeys = sorted(unique(request.workItemKeys));
        requests.set(key, request);
      }
    }
  }
  return [...requests.values()].sort((left, right) => Number(left.sourcePageId) - Number(right.sourcePageId)
    || left.sourceRevision.localeCompare(right.sourceRevision));
}

function fetchedByRevision(fetchedPages = []) {
  return new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
}

function revalidateSource(source, fetched, contentHash = hash) {
  const identity = source?.sourcePageIdentity || {};
  const content = sourceContent(fetched?.revision);
  const computedHash = typeof content === 'string' ? contentHash(content) : null;
  const computedBytes = typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null;
  const computedUrl = fetched?.page?.title ? wikiUrl(fetched.page.title) : null;
  const checks = {
    sourceKeyPresent: typeof source?.sourceKey === 'string' && source.sourceKey.length > 0,
    upstreamCaptureComplete: source?.captureComplete === true,
    upstreamIntegrityChecksPassed: Object.values(source?.integrityChecks || {}).length > 0
      && Object.values(source.integrityChecks).every(Boolean),
    exactRevisionSourceTextPresent: typeof source?.exactRevisionSourceText === 'string' && source.exactRevisionSourceText.length > 0,
    upstreamTextHashMatches: typeof source?.exactRevisionSourceText === 'string'
      && contentHash(source.exactRevisionSourceText) === identity.sourceContentHash,
    fetchedPagePresent: Boolean(fetched?.page),
    fetchedRevisionPresent: Boolean(fetched?.revision),
    pageIdMatches: Number(fetched?.page?.pageid) === Number(identity.sourcePageId),
    titleMatches: fetched?.page?.title === identity.resolvedTitle,
    revisionMatches: String(fetched?.revision?.revid || '') === String(identity.sourceRevision || ''),
    timestampMatches: fetched?.revision?.timestamp === identity.sourceTimestamp,
    urlMatches: computedUrl === identity.sourceUrl,
    contentHashMatches: computedHash === identity.sourceContentHash,
    contentBytesMatch: computedBytes === Number(identity.sourceContentBytes),
    fetchedTextMatchesUpstream: content === source?.exactRevisionSourceText,
    semanticVerdictAbsent: source?.semanticVerdict === null
  };
  return {
    sourceKey: source?.sourceKey || null,
    sourcePageIdentity: identity,
    roles: sorted(source?.roles || []),
    checks,
    complete: Object.values(checks).every(Boolean)
  };
}

function lineLocator(text, offset, length) {
  const before = String(text).slice(0, offset);
  const lineStart = before.split(/\r?\n/).length;
  const lastNewline = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  const columnStart = offset - lastNewline;
  const matched = String(text).slice(offset, offset + length);
  const lineEnd = lineStart + (matched.match(/\n/g) || []).length;
  const tail = matched.includes('\n') ? matched.slice(matched.lastIndexOf('\n') + 1) : matched;
  return { lineStart, lineEnd, columnStart, columnEnd: lineEnd === lineStart ? columnStart + length - 1 : tail.length };
}

function scanDefinitions(text, definitions, contentHash = hash) {
  const observations = [];
  const lines = String(text).split(/\r?\n/);
  for (const definition of definitions) {
    definition.expression.lastIndex = 0;
    for (const match of String(text).matchAll(definition.expression)) {
      const locator = lineLocator(text, match.index, match[0].length);
      const exactSourceLine = lines[locator.lineStart - 1] || '';
      observations.push({
        definitionKey: definition.definitionKey,
        observationClass: definition.observationClass,
        observedPercentage: match[1] === undefined ? null : Number(match[1]),
        matchedText: match[0],
        exactSourceLine,
        exactSourceLineContentHash: contentHash(exactSourceLine),
        sourceLocator: locator
      });
    }
  }
  return observations.sort((left, right) => left.sourceLocator.lineStart - right.sourceLocator.lineStart
    || left.sourceLocator.columnStart - right.sourceLocator.columnStart || left.definitionKey.localeCompare(right.definitionKey))
    .map((observation, index) => ({ ...observation, observationOrdinal: index + 1 }));
}

function weightedGapPacket(record, item) {
  return (record.structuralMemberCandidateSemanticGapEvidencePackets || []).find(packet =>
    packet.branchKey === 'weighted_parent_task_entry_membership_evidence'
    && packet.structuralCandidateKey === item.structuralCandidateKey);
}

function candidateOccurrence(packet = {}) {
  return (packet.channelObservations || []).find(channel => channel.channel === 'explicit_weighted_entry_membership')
    ?.evidence?.candidateOccurrence || null;
}

function occurrenceIntegrity(occurrence, parentSource, contentHash = hash) {
  const text = parentSource?.exactRevisionSourceText || '';
  const locator = occurrence?.sourceLocator || {};
  const lines = text.split(/\r?\n/);
  const line = lines[Number(locator.lineStart) - 1] || '';
  const hasColumnLocator = Number.isInteger(Number(locator.columnStart)) && Number(locator.columnStart) > 0
    && Number.isInteger(Number(locator.columnEnd)) && Number(locator.columnEnd) >= Number(locator.columnStart);
  const exactSlice = Number(locator.lineStart) === Number(locator.lineEnd)
    ? (hasColumnLocator ? line.slice(Number(locator.columnStart) - 1, Number(locator.columnEnd)) : line) : null;
  const checks = {
    occurrencePresent: Boolean(occurrence),
    singleLineLocator: Number(locator.lineStart) > 0 && Number(locator.lineStart) === Number(locator.lineEnd),
    columnLocatorValidOrExactWholeLine: hasColumnLocator || line === occurrence?.exactSourceText,
    parentPageIdMatches: Number(occurrence?.sourcePageId) === Number(parentSource?.sourcePageIdentity?.sourcePageId),
    parentRevisionMatches: String(occurrence?.sourceRevision || '') === String(parentSource?.sourcePageIdentity?.sourceRevision || ''),
    parentContentHashMatches: occurrence?.sourceContentHash === parentSource?.sourcePageIdentity?.sourceContentHash,
    exactSourceTextHashMatches: typeof occurrence?.exactSourceText === 'string'
      && contentHash(occurrence.exactSourceText) === occurrence.exactSourceTextContentHash,
    exactTextAtPinnedLocator: exactSlice === occurrence?.exactSourceText
  };
  return { checks, complete: Object.values(checks).every(Boolean), exactSourceLine: line };
}

function sourceRolePair(item, sourcesByKey, occurrence) {
  const sources = (item.sourceEvidenceKeys || []).map(key => sourcesByKey.get(key)).filter(Boolean);
  const parent = sources.find(source => Number(source.sourcePageIdentity?.sourcePageId) === Number(occurrence?.sourcePageId));
  const subject = sources.find(source => source !== parent);
  return { sources, parent, subject };
}

function parentAnchorTokens(parentTitle, policy = {}) {
  const stopwords = new Set((policy.sourceScan?.parentTitleAnchorStopwords || []).map(value => value.toLowerCase()));
  return unique(String(parentTitle || '').toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(token => token.length > 2 && !stopwords.has(token));
}

function candidateSubjectCorroboration(subjectSource, parentSource, policy, contentHash = hash) {
  const anchors = parentAnchorTokens(parentSource?.sourcePageIdentity?.resolvedTitle, policy);
  const lexemes = policy.sourceScan?.relationshipLexemes || [];
  const observations = [];
  const lines = String(subjectSource?.exactRevisionSourceText || '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const normalized = line.toLowerCase();
    const anchorMatched = anchors.length > 0 && anchors.every(token => normalized.includes(token));
    const matchedLexemes = lexemes.filter(token => new RegExp(`\\b${token}\\b`, 'iu').test(line));
    if (anchorMatched && matchedLexemes.length > 0) observations.push({
      sourceLocator: { lineStart: index + 1, lineEnd: index + 1 },
      exactSourceLine: line,
      exactSourceLineContentHash: contentHash(line),
      matchedParentTitleAnchorTokens: anchors,
      matchedRelationshipLexemes: matchedLexemes
    });
  }
  return observations.map((observation, index) => ({ ...observation, observationOrdinal: index + 1 }));
}

function aliasAndVariantSignals(subjectSource, contentHash = hash) {
  const observations = [];
  const pattern = /^\s*\|\s*(name|version)([1-9][0-9]*)\s*=\s*(.*?)\s*$/gimu;
  for (const match of String(subjectSource?.exactRevisionSourceText || '').matchAll(pattern)) {
    observations.push({
      parameterKind: match[1].toLowerCase(),
      variantIndex: Number(match[2]),
      rawValue: match[3],
      exactSourceText: match[0],
      exactSourceTextContentHash: contentHash(match[0]),
      sourceLocator: lineLocator(subjectSource.exactRevisionSourceText, match.index, match[0].length)
    });
  }
  return observations.sort((left, right) => left.sourceLocator.lineStart - right.sourceLocator.lineStart
    || left.parameterKind.localeCompare(right.parameterKind)).map((observation, index) => ({ ...observation, observationOrdinal: index + 1 }));
}

function packetFor(record, item, sourcesByKey, sourceChecksByKey, compiled, policy, contentHash = hash) {
  const upstreamPacket = weightedGapPacket(record, item);
  const occurrence = candidateOccurrence(upstreamPacket);
  const pair = sourceRolePair(item, sourcesByKey, occurrence);
  const occurrenceCheck = occurrenceIntegrity(occurrence, pair.parent, contentHash);
  const parentText = pair.parent?.exactRevisionSourceText || '';
  const allWeightObservations = scanDefinitions(parentText, compiled.weightDefinitions, contentHash);
  const distributionObservations = scanDefinitions(parentText, compiled.distributionDefinitions, contentHash);
  const sameLineWeightObservations = occurrenceCheck.exactSourceLine
    ? scanDefinitions(occurrenceCheck.exactSourceLine, compiled.weightDefinitions, contentHash) : [];
  const corroboration = candidateSubjectCorroboration(pair.subject, pair.parent, policy, contentHash);
  const aliasVariantObservations = aliasAndVariantSignals(pair.subject, contentHash);
  const referencedSourceRevalidations = (item.sourceEvidenceKeys || []).map(key => sourceChecksByKey.get(key)).filter(Boolean);
  const channelObservations = [
    {
      channel: 'exact_revision_source_revalidation',
      captureState: referencedSourceRevalidations.length === (item.sourceEvidenceKeys || []).length
        && referencedSourceRevalidations.every(source => source.complete)
        ? 'all_referenced_exact_revisions_revalidated' : 'one_or_more_referenced_exact_revisions_failed_revalidation',
      observations: referencedSourceRevalidations,
      semanticVerdict: null
    },
    {
      channel: 'exact_parent_occurrence_binding',
      captureState: occurrenceCheck.complete ? 'exact_parent_occurrence_revalidated' : 'exact_parent_occurrence_failed_revalidation',
      observations: occurrence ? [{ occurrence, integrity: occurrenceCheck }] : [],
      semanticVerdict: null
    },
    {
      channel: 'candidate_scoped_same_line_weight_statement',
      captureState: sameLineWeightObservations.length > 0 ? 'candidate_occurrence_line_contains_weight_language_review_required' : 'authoritative_candidate_scoped_weight_statement_not_observed_in_bound_sources',
      observations: sameLineWeightObservations,
      sourceSilenceIsNotNegativeEvidence: sameLineWeightObservations.length === 0,
      semanticVerdict: null
    },
    {
      channel: 'parent_global_weight_statement',
      captureState: allWeightObservations.length > 0 ? 'parent_global_weight_language_observed_not_candidate_scoped_membership_proof' : 'parent_global_weight_language_not_observed',
      observations: allWeightObservations,
      distributionObservations,
      semanticVerdict: null
    },
    {
      channel: 'candidate_subject_corroboration',
      captureState: corroboration.length > 0 ? 'candidate_subject_page_parent_relationship_language_observed_review_required' : 'candidate_subject_page_corroboration_not_observed_in_bound_sources',
      observations: corroboration,
      sourceSilenceIsNotNegativeEvidence: corroboration.length === 0,
      semanticVerdict: null
    },
    {
      channel: 'duplicate_alias_and_variant_signals',
      captureState: aliasVariantObservations.length > 0 ? 'numbered_name_or_version_signals_observed_review_required' : 'numbered_name_or_version_signals_not_observed',
      observations: aliasVariantObservations,
      semanticVerdict: null
    },
    {
      channel: 'weighted_membership_verdict_separation',
      captureState: 'evidence_captured_weighted_membership_review_pending',
      observations: [],
      weightedTaskEntryMembershipVerdict: null,
      automaticReviewForbidden: true,
      semanticVerdict: null
    }
  ];
  const captureComplete = Boolean(upstreamPacket)
    && pair.sources.length === (item.sourceEvidenceKeys || []).length && pair.parent && pair.subject
    && occurrenceCheck.complete && referencedSourceRevalidations.every(source => source.complete)
    && same(channelObservations.map(channel => channel.channel), REQUIRED_CHANNELS, contentHash);
  const base = {
    packetKey: `${item.workItemKey}|revision-pinned-weighted-membership-evidence`,
    workItemKey: item.workItemKey,
    structuralCandidateKey: item.structuralCandidateKey,
    candidateRole: item.candidateRole,
    sourceDispositionKeys: [...(item.sourceDispositionKeys || [])],
    sourceEvidenceKeys: [...(item.sourceEvidenceKeys || [])],
    requiredChannels: [...REQUIRED_CHANNELS],
    channelObservations,
    captureComplete,
    weightedMembershipSemanticEvidenceComplete: false,
    weightedTaskEntryMembershipVerdict: null,
    candidateMemberIdentityVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      'candidate_scoped_weighted_membership_requires_explicit_review',
      ...(sameLineWeightObservations.length ? [] : ['candidate_scoped_weight_statement_not_observed']),
      ...(corroboration.length ? [] : ['candidate_subject_corroboration_not_observed']),
      ...(aliasVariantObservations.length ? ['duplicate_alias_or_numbered_variant_treatment_requires_review'] : []),
      'global_parent_weight_language_is_not_candidate_scoped_membership_proof',
      'weighted_parent_task_entry_membership_verdict_not_recorded'
    ]),
    state: captureComplete ? 'revision_pinned_weighted_parent_task_entry_membership_evidence_captured_review_pending'
      : 'blocked_weighted_parent_task_entry_membership_evidence_capture_incomplete'
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function assembleRecords(routingRecords, fetchedPages, policy, contentHash = hash) {
  const compiled = compileWeightedParentTaskEntryMembershipEvidencePolicy(policy);
  const fetched = fetchedByRevision(fetchedPages);
  return selectWeightedParentTaskEntryMembershipEvidenceInputs(routingRecords, policy).map(input => {
    const sources = sourceCatalog(input);
    const sourcesByKey = new Map(sources.map(source => [source.sourceKey, source]));
    const referencedKeys = sorted(unique((routing(input).weightedMembershipWorkItems || []).flatMap(item => item.sourceEvidenceKeys || [])));
    const sourceRevalidations = referencedKeys.map(key => revalidateSource(sourcesByKey.get(key), fetched.get(String(sourcesByKey.get(key)?.sourcePageIdentity?.sourceRevision || '')), contentHash));
    const sourceChecksByKey = new Map(sourceRevalidations.map(source => [source.sourceKey, source]));
    const packets = (routing(input).weightedMembershipWorkItems || []).map(item => packetFor(input, item, sourcesByKey, sourceChecksByKey, compiled, policy, contentHash));
    return {
      contract: policy.recordContract,
      ...preservedInput(input),
      sourceRoutingRecordContentHash: input.contentHash,
      weightedParentTaskEntryMembershipEvidenceSources: sourceRevalidations,
      weightedParentTaskEntryMembershipEvidencePackets: packets,
      weightedParentTaskEntryMembershipEvidenceReview: {
        state: 'unreviewed_source_bound_weighted_membership_evidence',
        reviewedPacketKeys: [],
        reviewer: null,
        reviewedAt: null,
        reviewNotes: null
      },
      weightedTaskEntryMembershipVerdict: null,
      memberUniverseComplete: false,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      blockers: unique([
        ...(input.blockers || []),
        'weighted_parent_task_entry_membership_evidence_captured_review_pending',
        'weighted_parent_task_entry_membership_not_proven',
        'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
        'member_universe_completeness_not_proven',
        'independent_complete_activity_universe_not_established'
      ]),
      state: policy.outputState
    };
  });
}

function accountStatePaths(records = []) {
  const findings = [];
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountState|ownedEquipment|bankContents)$/i;
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  records.forEach((record, index) => walk(record, `[${index}]`));
  return sorted(unique(findings));
}

export function auditWeightedParentTaskEntryMembershipEvidence(records = [], {
  routingRecords = [], fetchedPages = [], policy = {}, contentHash = hash
} = {}) {
  const compiled = compileWeightedParentTaskEntryMembershipEvidencePolicy(policy);
  const eligible = selectWeightedParentTaskEntryMembershipEvidenceInputs(routingRecords, policy);
  const expected = assembleRecords(routingRecords, fetchedPages, policy, contentHash);
  const workItems = eligible.flatMap(record => routing(record).weightedMembershipWorkItems || []);
  const requests = discoverWeightedParentTaskEntryMembershipExactRevisionRequests(routingRecords, policy);
  const fetchedRevisions = fetchedPages.flatMap(page => (page.revisions || []).map(revision => String(revision.revid)));
  const outputPackets = records.flatMap(record => record.weightedParentTaskEntryMembershipEvidencePackets || []);
  const outputSources = records.flatMap(record => record.weightedParentTaskEntryMembershipEvidenceSources || []);
  const packetKeys = outputPackets.map(packet => packet.packetKey);
  const expectedPacketKeys = expected.flatMap(record => record.weightedParentTaskEntryMembershipEvidencePackets || []).map(packet => packet.packetKey);
  const sourceKeys = outputSources.map(source => source.sourceKey);
  const expectedSourceKeys = expected.flatMap(record => record.weightedParentTaskEntryMembershipEvidenceSources || []).map(source => source.sourceKey);
  const recordMismatches = records.flatMap((record, index) => same(record, expected[index], contentHash) ? [] : [index]);
  const candidateScopedWeightStatementCount = outputPackets.reduce((sum, packet) => sum + ((packet.channelObservations || [])
    .find(channel => channel.channel === 'candidate_scoped_same_line_weight_statement')?.observations?.length || 0), 0);
  const globalWeightObservations = outputPackets.flatMap(packet => (packet.channelObservations || [])
    .find(channel => channel.channel === 'parent_global_weight_statement')?.observations || []);
  const distributionObservations = outputPackets.flatMap(packet => (packet.channelObservations || [])
    .find(channel => channel.channel === 'parent_global_weight_statement')?.distributionObservations || []);
  const globalWeightStatementCount = globalWeightObservations.length;
  const parentDistributionStatementCount = distributionObservations.length;
  const uniqueGlobalWeightStatementCount = unique(globalWeightObservations.map(observation => contentHash({
    definitionKey: observation.definitionKey,
    exactSourceLineContentHash: observation.exactSourceLineContentHash,
    sourceLocator: observation.sourceLocator
  }))).length;
  const uniqueParentDistributionStatementCount = unique(distributionObservations.map(observation => contentHash({
    definitionKey: observation.definitionKey,
    exactSourceLineContentHash: observation.exactSourceLineContentHash,
    sourceLocator: observation.sourceLocator
  }))).length;
  const candidateSubjectCorroborationCount = outputPackets.reduce((sum, packet) => sum + ((packet.channelObservations || [])
    .find(channel => channel.channel === 'candidate_subject_corroboration')?.observations?.length || 0), 0);
  const aliasVariantSignalCount = outputPackets.reduce((sum, packet) => sum + ((packet.channelObservations || [])
    .find(channel => channel.channel === 'duplicate_alias_and_variant_signals')?.observations?.length || 0), 0);
  const channelFailures = outputPackets.filter(packet => !same(packet.requiredChannels || [], REQUIRED_CHANNELS, contentHash)
    || !same((packet.channelObservations || []).map(channel => channel.channel), REQUIRED_CHANNELS, contentHash)).map(packet => packet.packetKey);
  const unsupportedPromotions = outputPackets.filter(packet => packet.weightedTaskEntryMembershipVerdict !== null
    || packet.candidateMemberIdentityVerdict !== null || packet.mappingVerdict !== null
    || packet.inventoryCompletenessVerdict !== null || packet.memberUniverseComplete !== false
    || packet.optimizerEligible !== false || packet.automaticVerificationApplied !== false
    || packet.weightedMembershipSemanticEvidenceComplete !== false).map(packet => packet.packetKey);
  for (const record of records) if (record.weightedTaskEntryMembershipVerdict !== null || record.memberUniverseComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false
    || record.weightedParentTaskEntryMembershipEvidenceReview?.state !== 'unreviewed_source_bound_weighted_membership_evidence') {
    unsupportedPromotions.push(record.sourceRoutingRecordContentHash || '(record)');
  }
  const accountStateFindings = accountStatePaths(records);
  const exactRevisionRequestSetMatches = requests.length > 0 && same(sorted(requests.map(request => request.sourceRevision)), sorted(fetchedRevisions), contentHash)
    && duplicates(fetchedRevisions).length === 0;
  const evidencePacketCaptureComplete = eligible.length > 0 && records.length === eligible.length
    && workItems.length > 0 && outputPackets.length === workItems.length
    && duplicates(packetKeys).length === 0 && same(sorted(packetKeys), sorted(expectedPacketKeys), contentHash)
    && duplicates(sourceKeys).length === 0 && same(sorted(sourceKeys), sorted(expectedSourceKeys), contentHash)
    && outputSources.every(source => source.complete) && outputPackets.every(packet => packet.captureComplete)
    && channelFailures.length === 0 && recordMismatches.length === 0;
  const publishable = compiled.valid && exactRevisionRequestSetMatches && evidencePacketCaptureComplete
    && unsupportedPromotions.length === 0 && accountStateFindings.length === 0;
  const blockers = unique([
    ...(eligible.length ? [] : ['no_eligible_weighted_membership_routing_records']),
    ...(compiled.valid ? [] : ['weighted_membership_evidence_policy_invalid']),
    ...(exactRevisionRequestSetMatches ? [] : ['exact_revision_request_and_response_sets_do_not_match']),
    ...(evidencePacketCaptureComplete ? [] : ['one_or_more_weighted_membership_evidence_packets_incomplete_or_mismatched']),
    ...(unsupportedPromotions.length ? ['weighted_membership_evidence_created_unsupported_semantic_or_optimizer_promotion'] : []),
    ...(accountStateFindings.length ? ['current_account_state_present'] : []),
    'weighted_parent_task_entry_membership_review_pending',
    'candidate_scoped_weight_statement_and_global_parent_weight_statement_require_separate_semantic_disposition',
    'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
    'member_universe_completeness_not_proven',
    'all_repeatability_evidence_domains_remain_unresolved',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  ]);
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputRecordCount: routingRecords.length,
      eligibleInputRecordCount: eligible.length,
      weightedMembershipWorkItemCount: workItems.length,
      duplicateWorkItemKeys: duplicates(workItems.map(item => item.workItemKey))
    },
    policyCoverage: compiled,
    revisionCoverage: {
      exactRevisionRequestCount: requests.length,
      fetchedRevisionCount: fetchedRevisions.length,
      duplicateFetchedRevisions: duplicates(fetchedRevisions),
      exactRevisionRequestSetMatches,
      completeSourceRevalidationCount: outputSources.filter(source => source.complete).length,
      failedSourceKeys: outputSources.filter(source => !source.complete).map(source => source.sourceKey)
    },
    packetCoverage: {
      evidencePacketCount: outputPackets.length,
      completeEvidencePacketCount: outputPackets.filter(packet => packet.captureComplete).length,
      duplicatePacketKeys: duplicates(packetKeys),
      missingPacketKeys: expectedPacketKeys.filter(key => !packetKeys.includes(key)),
      unexpectedPacketKeys: packetKeys.filter(key => !expectedPacketKeys.includes(key)),
      channelFailures,
      recordMismatches
    },
    observationCoverage: {
      candidateScopedWeightStatementCount,
      globalWeightStatementCount,
      uniqueGlobalWeightStatementCount,
      parentDistributionStatementCount,
      uniqueParentDistributionStatementCount,
      candidateSubjectCorroborationCount,
      aliasVariantSignalCount,
      candidateScopedWeightStatementAbsentPacketCount: outputPackets.filter(packet => !(packet.channelObservations || [])
        .find(channel => channel.channel === 'candidate_scoped_same_line_weight_statement')?.observations?.length).length,
      candidateSubjectCorroborationAbsentPacketCount: outputPackets.filter(packet => !(packet.channelObservations || [])
        .find(channel => channel.channel === 'candidate_subject_corroboration')?.observations?.length).length
    },
    semanticPreservationCoverage: {
      weightedMembershipVerdictCount: outputPackets.filter(packet => packet.weightedTaskEntryMembershipVerdict !== null).length,
      identityMappingOrCompletenessVerdictCount: outputPackets.filter(packet => packet.candidateMemberIdentityVerdict !== null
        || packet.mappingVerdict !== null || packet.inventoryCompletenessVerdict !== null || packet.memberUniverseComplete !== false).length,
      optimizerEligibleCount: outputPackets.filter(packet => packet.optimizerEligible === true).length,
      unsupportedPromotions: unique(unsupportedPromotions)
    },
    accountStateFindings,
    evidencePacketCaptureComplete,
    weightedMembershipReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers,
    publishable
  };
}

export function buildWeightedParentTaskEntryMembershipEvidence({
  routingRecords = [], fetchedPages = [], policy = {}, contentHash = hash
} = {}) {
  const records = assembleRecords(routingRecords, fetchedPages, policy, contentHash);
  return { records, audit: auditWeightedParentTaskEntryMembershipEvidence(records, { routingRecords, fetchedPages, policy, contentHash }) };
}
