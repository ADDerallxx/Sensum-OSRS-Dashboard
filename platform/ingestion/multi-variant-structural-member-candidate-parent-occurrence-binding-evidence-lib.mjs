import { hash } from './lib.mjs';

const REQUIRED_RULES = [
  'oneEvidencePacketPerRoutedMultiVariantWorkItem',
  'everyDistinctPinnedSubjectAndParentRevisionMustBeRefetchedFromTheOfficialWikiApi',
  'exactRevisionIdentityHashBytesTimestampAndTextMustRevalidate',
  'oneExpectedRootInfoboxMustBeParsedAtItsExactLine',
  'everyNumberedVariantIndexAndTopLevelFieldMustBePreserved',
  'parentOccurrenceHashLocatorAndExactTextMustRevalidate',
  'parentSubjectLinkTargetsAndLabelsMustBeParsedFromExactSourceText',
  'onlyAUniqueExactNumberedNameMatchMayBecomeReviewReadyBindingEvidence',
  'sharedUnnumberedNamesCannotSelectANumberedVariant',
  'pageTitleWithoutAnExactNumberedNameMatchCannotSelectAVariant',
  'bindingEvidenceDoesNotRecordAReviewDecisionOrBoundVariant',
  'identityMembershipRepeatabilityMechanicsMappingCompletenessAndOptimizerVerdictsRemainClosed',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => !keys.includes(name)));
const sourceKey = identity => `wiki-pageid:${identity.sourcePageId}|revision:${identity.sourceRevision}`;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|title|titles|label|labels|alias|aliases|override|overrides)$/i;
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
  return findings.sort();
}

export function compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidencePolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.structural-member-candidate-review-ready-identity-and-remaining-gap-work-routing.v1'
    && policy.recordContract === 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence.v1'
    && policy.auditContract === 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-audit.v1'
    && policy.inputState === 'structural_member_candidate_review_ready_identity_and_remaining_gap_work_routed_gates_closed'
    && policy.routeKey === 'exact_parent_variant_binding_evidence';
  const capture = policy.sourceCapture || {};
  const invalidSourceCapture = [];
  if (capture.apiNamespace !== 0) invalidSourceCapture.push('apiNamespace');
  if (!Number.isInteger(capture.revisionBatchSize) || capture.revisionBatchSize < 1 || capture.revisionBatchSize > 50) invalidSourceCapture.push('revisionBatchSize');
  for (const field of ['retainCompleteExactRevisionSourceText', 'requirePageIdRevisionTimestampTitleUrlHashAndBytes', 'deduplicateExactPageRevisionSources']) if (capture[field] !== true) invalidSourceCapture.push(field);
  const parameterBasesValid = Array.isArray(policy.variantIdentityParameterBases)
    && policy.variantIdentityParameterBases.length > 0
    && policy.variantIdentityParameterBases.every(value => typeof value === 'string' && /^[a-z][a-z0-9_]*$/.test(value))
    && new Set(policy.variantIdentityParameterBases).size === policy.variantIdentityParameterBases.length;
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && parameterBasesValid && invalidRules.length === 0 && invalidSourceCapture.length === 0 && forbidden.length === 0,
    contractValid,
    parameterBasesValid,
    invalidRules: unique(invalidRules),
    invalidSourceCapture: unique(invalidSourceCapture),
    forbiddenPolicyPaths: forbidden
  };
}

function multiVariantItems(record = {}, policy = {}) {
  return (record.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting?.multiVariantIdentityWorkItems || [])
    .filter(item => item.routeKey === policy.routeKey);
}

function workItemValid(item = {}, policy = {}) {
  const readiness = item.identityAndVariantScopeReviewReadiness || {};
  return item.routeKey === policy.routeKey
    && item.workKind === 'exact_parent_occurrence_to_numbered_source_variant_binding_evidence'
    && item.workState === 'blocked_pending_exact_parent_variant_binding_evidence'
    && item.reviewReady === false
    && item.reviewDecision === null
    && item.sourceDispositionKeys?.length === 1
    && item.sourceEvidenceKeys?.length >= 2
    && item.requiredChannels?.length === 4
    && readiness.multiVariantSeries === true
    && readiness.reviewReady === false
    && readiness.numberedVariantIndices?.length >= 2
    && readiness.identityBearingRootTemplates?.length === 1
    && readiness.sourceIntegrity?.complete === true
    && readiness.blockers?.includes('multiple_numbered_entity_variants_require_exact_parent_variant_binding')
    && item.newEvidenceKeys?.length === 0
    && item.candidateMemberIdentityVerdict === null
    && item.sourcePageEntityTypeVerdict === null
    && item.structuralParentRelationshipVerdict === null
    && item.weightedTaskEntryMembershipVerdict === null
    && item.mappingVerdict === null
    && item.inventoryCompletenessVerdict === null
    && item.canonicalGameEntityIdentity === null
    && item.memberUniverseComplete === false
    && item.evidenceWorkComplete === false
    && item.automaticVerificationApplied === false;
}

function eligibleInput(record = {}, policy = {}) {
  const route = record.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting || {};
  const items = multiVariantItems(record, policy);
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && record.accountIndependent === true
    && route.routeState === 'review_ready_identities_and_remaining_semantic_gaps_routed_all_verdicts_closed'
    && route.multiVariantIdentityWorkItemCount === items.length
    && items.length > 0
    && items.every(item => workItemValid(item, policy))
    && route.identityReviewComplete === false
    && route.memberUniverseComplete === false
    && route.evidenceWorkComplete === false
    && route.automaticVerificationApplied === false
    && Array.isArray(record.structuralMemberCandidateSemanticGapEvidenceSources)
    && record.structuralMemberCandidateSemanticGapEvidenceSources.length > 0
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false;
}

export function selectMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceInputs(records = [], policy = {}) {
  return records.filter(record => eligibleInput(record, policy));
}

function relevantSourceDescriptors(record, policy) {
  const items = multiVariantItems(record, policy);
  const requiredKeys = new Set(items.flatMap(item => item.sourceEvidenceKeys || []));
  const sources = (record.structuralMemberCandidateSemanticGapEvidenceSources || []).filter(source => requiredKeys.has(source.sourceKey));
  const groups = new Map();
  for (const source of sources) {
    const identity = source.sourcePageIdentity || {};
    const descriptor = {
      sourceKey: source.sourceKey,
      sourcePageId: Number(identity.sourcePageId),
      resolvedTitle: identity.resolvedTitle,
      sourceRevision: String(identity.sourceRevision || ''),
      sourceTimestamp: identity.sourceTimestamp,
      sourceUrl: identity.sourceUrl,
      sourceContentHash: identity.sourceContentHash,
      sourceContentBytes: Number(identity.sourceContentBytes),
      expectedExactRevisionSourceText: source.exactRevisionSourceText,
      contexts: items.filter(item => item.sourceEvidenceKeys?.includes(source.sourceKey)).map(item => ({ workItemKey: item.workItemKey, structuralCandidateKey: item.structuralCandidateKey }))
    };
    const existing = groups.get(descriptor.sourceKey);
    if (!existing) groups.set(descriptor.sourceKey, descriptor);
    else if (hash(without(existing, 'contexts')) !== hash(without(descriptor, 'contexts'))) existing.sourceConflict = true;
  }
  return [...groups.values()].map(descriptor => ({ ...descriptor, contexts: descriptor.contexts.sort((left, right) => hash(left).localeCompare(hash(right))) }))
    .sort((left, right) => left.sourcePageId - right.sourcePageId || Number(left.sourceRevision) - Number(right.sourceRevision));
}

export function discoverMultiVariantStructuralMemberCandidateParentOccurrenceBindingExactRevisionRequests(records = [], policy = {}) {
  const descriptors = selectMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceInputs(records, policy).flatMap(record => relevantSourceDescriptors(record, policy));
  const groups = new Map();
  for (const descriptor of descriptors) {
    const existing = groups.get(descriptor.sourceKey);
    if (!existing) groups.set(descriptor.sourceKey, { sourceKey: descriptor.sourceKey, sourcePageId: descriptor.sourcePageId, sourceRevision: descriptor.sourceRevision, contexts: [...descriptor.contexts] });
    else existing.contexts.push(...descriptor.contexts);
  }
  return [...groups.values()]
    .map(value => ({ ...value, contexts: value.contexts.sort((left, right) => hash(left).localeCompare(hash(right))) }))
    .sort((left, right) => Number(left.sourceRevision) - Number(right.sourceRevision));
}

function responseRevisionMap(batches = []) {
  const map = new Map();
  for (const batch of batches) for (const page of batch.response?.query?.pages || []) for (const revision of page.revisions || []) map.set(String(revision.revid), { page, revision });
  return map;
}

function exactSourcePacket(expected, resolution, contentHash = hash) {
  const page = resolution?.page;
  const revision = resolution?.revision;
  const text = revision?.slots?.main?.content;
  const checks = {
    responseRevisionPresent: Boolean(page && revision),
    mainNamespace: page?.ns === 0,
    pageIdMatches: Number(page?.pageid) === expected.sourcePageId,
    revisionMatches: String(revision?.revid || '') === expected.sourceRevision,
    titleMatches: page?.title === expected.resolvedTitle,
    timestampMatches: revision?.timestamp === expected.sourceTimestamp,
    exactTextPresent: typeof text === 'string',
    contentHashMatches: typeof text === 'string' && contentHash(text) === expected.sourceContentHash,
    contentBytesMatch: typeof text === 'string' && Buffer.byteLength(text, 'utf8') === expected.sourceContentBytes,
    inputExactTextMatches: typeof text === 'string' && text === expected.expectedExactRevisionSourceText,
    noSourceConflict: expected.sourceConflict !== true
  };
  const captureComplete = Object.values(checks).every(Boolean);
  return {
    sourceKey: expected.sourceKey,
    contexts: expected.contexts,
    sourcePageIdentity: {
      sourcePageId: expected.sourcePageId,
      resolvedTitle: expected.resolvedTitle,
      sourceRevision: expected.sourceRevision,
      sourceTimestamp: expected.sourceTimestamp,
      sourceUrl: expected.sourceUrl,
      sourceContentHash: expected.sourceContentHash,
      sourceContentBytes: expected.sourceContentBytes
    },
    exactRevisionSourceText: typeof text === 'string' ? text : null,
    integrityChecks: checks,
    captureComplete,
    deficiencies: Object.entries(checks).filter(([, valid]) => !valid).map(([name]) => name),
    semanticVerdict: null,
    state: captureComplete ? 'complete_exact_revision_source_capture_non_verdict' : 'blocked_exact_revision_source_capture_incomplete'
  };
}

function topLevelParameters(block = '') {
  const source = String(block);
  const segments = [];
  let depth = 0;
  let linkDepth = 0;
  let start = null;
  for (let index = 0; index < source.length - 1; index++) {
    const pair = source.slice(index, index + 2);
    if (pair === '{{') { depth++; index++; continue; }
    if (pair === '}}') {
      if (depth === 1 && start !== null) { segments.push(source.slice(start, index)); start = null; }
      depth = Math.max(0, depth - 1); index++; continue;
    }
    if (pair === '[[') { linkDepth++; index++; continue; }
    if (pair === ']]' && linkDepth > 0) { linkDepth--; index++; continue; }
    if (source[index] === '|' && depth === 1 && linkDepth === 0) {
      if (start !== null) segments.push(source.slice(start, index));
      start = index + 1;
    }
  }
  return segments.map(segment => {
    const equals = segment.indexOf('=');
    return equals < 0 ? null : { name: segment.slice(0, equals).trim(), nameKey: normalize(segment.slice(0, equals)), value: segment.slice(equals + 1).trim() };
  }).filter(Boolean);
}

function rootTemplateBlocks(source = '') {
  const text = String(source);
  const blocks = [];
  let depth = 0;
  let start = -1;
  let name = '';
  for (let index = 0; index < text.length - 1; index++) {
    const pair = text.slice(index, index + 2);
    if (pair === '{{') {
      if (depth === 0) {
        start = index;
        let end = index + 2;
        while (end < text.length && !/[|}\r\n]/.test(text[end])) end++;
        name = text.slice(index + 2, end).replace(/^subst\s*:/i, '').trim();
      }
      depth++; index++; continue;
    }
    if (pair === '}}' && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        const exactSourceText = text.slice(start, index + 2);
        const lineStart = text.slice(0, start).split(/\r?\n/).length;
        blocks.push({ template: name, templateKey: normalize(name), lineStart, lineEnd: lineStart + exactSourceText.split(/\r?\n/).length - 1, exactSourceText, parameters: topLevelParameters(exactSourceText) });
        start = -1; name = '';
      }
      index++;
    }
  }
  return blocks;
}

function parseParentLinks(exactSourceText = '') {
  const text = String(exactSourceText);
  const links = [];
  const direct = /\[\[([^\]|]+?)(?:#([^\]|]*))?(?:\|([^\]]+))?\]\]/g;
  let match;
  while ((match = direct.exec(text))) links.push({ syntax: 'direct_wikilink', raw: match[0], target: match[1].trim(), fragment: (match[2] || '').trim() || null, displayText: (match[3] || match[1]).trim() });
  const plink = /\{\{\s*plink\s*\|\s*([^|}]+)(?:\|([^}]+))?\}\}/gi;
  while ((match = plink.exec(text))) links.push({ syntax: 'plink_template', raw: match[0], target: match[1].trim(), fragment: null, displayText: match[1].trim() });
  return links;
}

function candidateDisposition(record, item) {
  return (record.structuralMemberCandidateIdentityDispositions || []).find(candidate => candidate.structuralCandidateKey === item.structuralCandidateKey) || null;
}

function parentOccurrenceEvidence(record, item, sourcesByKey, contentHash = hash) {
  const candidate = candidateDisposition(record, item);
  const evidence = candidate?.structuralParentRelationship?.evidence?.sourceCandidateEvidence || {};
  const parent = [...sourcesByKey.values()].find(source => Number(source.sourcePageIdentity?.sourcePageId) === Number(evidence.sourcePageId) && String(source.sourcePageIdentity?.sourceRevision || '') === String(evidence.sourceRevision || ''));
  const lines = String(parent?.exactRevisionSourceText || '').split(/\r?\n/);
  const lineStart = Number(evidence.sourceLocator?.lineStart || 0);
  const lineEnd = Number(evidence.sourceLocator?.lineEnd || 0);
  const locatedSourceText = lineStart > 0 && lineEnd >= lineStart ? lines.slice(lineStart - 1, lineEnd).join('\n') : '';
  const columnStart = Number(evidence.sourceLocator?.columnStart || 0);
  const exactAtColumn = columnStart > 0 ? locatedSourceText.slice(columnStart - 1, columnStart - 1 + String(evidence.exactSourceText || '').length) === evidence.exactSourceText : locatedSourceText.includes(evidence.exactSourceText || '');
  const checks = {
    candidateDispositionFound: Boolean(candidate),
    parentSourceFoundAndComplete: parent?.captureComplete === true,
    parentPageIdMatches: Number(parent?.sourcePageIdentity?.sourcePageId) === Number(evidence.sourcePageId),
    parentRevisionMatches: String(parent?.sourcePageIdentity?.sourceRevision || '') === String(evidence.sourceRevision || ''),
    parentContentHashMatches: parent?.sourcePageIdentity?.sourceContentHash === evidence.sourceContentHash,
    exactSourceTextPresent: typeof evidence.exactSourceText === 'string' && evidence.exactSourceText.length > 0,
    exactSourceTextHashMatches: typeof evidence.exactSourceText === 'string' && contentHash(evidence.exactSourceText) === evidence.exactSourceTextContentHash,
    locatorValid: lineStart > 0 && lineEnd >= lineStart && lineEnd <= lines.length,
    exactSourceTextOccursAtLocator: exactAtColumn,
    relationshipStructurallySupported: candidate?.structuralParentRelationship?.supported === true,
    parentMembershipVerdictNull: candidate?.structuralParentRelationship?.parentMembershipVerdict === null,
    weightedMembershipVerdictNull: candidate?.structuralParentRelationship?.weightedTaskEntryMembershipVerdict === null
  };
  return { candidate, parent, evidence, locatedSourceText, checks, complete: Object.values(checks).every(Boolean) };
}

function variantInventory(parameters, expectedIndices, policy) {
  const identityBases = new Set(policy.variantIdentityParameterBases.map(normalize));
  const rows = expectedIndices.map(index => {
    const fields = parameters.filter(parameter => parameter.nameKey.match(/^(.*?)(\d+)$/)?.[2] === String(index)).map(parameter => {
      const match = parameter.nameKey.match(/^(.*?)(\d+)$/);
      return { parameterName: parameter.name, parameterBase: match[1], variantIndex: index, value: parameter.value, identityBearing: identityBases.has(match[1]) };
    });
    return { variantIndex: index, fields, identityFields: fields.filter(field => field.identityBearing) };
  });
  const unnumberedIdentityFields = parameters.filter(parameter => identityBases.has(parameter.nameKey)).map(parameter => ({ parameterName: parameter.name, parameterBase: parameter.nameKey, value: parameter.value }));
  const discoveredIndices = unique(parameters.flatMap(parameter => {
    const match = parameter.nameKey.match(/^(.*?)(\d+)$/);
    return match && identityBases.has(match[1]) ? [Number(match[2])] : [];
  })).sort((left, right) => left - right);
  return { rows, unnumberedIdentityFields, discoveredIndices };
}

function bindingPacket(record, item, sourcesByKey, policy, contentHash = hash) {
  const readiness = item.identityAndVariantScopeReviewReadiness || {};
  const subject = sourcesByKey.get(readiness.sourceEvidenceKey);
  const expectedTemplate = readiness.identityBearingRootTemplates?.[0] || {};
  const blocks = subject ? rootTemplateBlocks(subject.exactRevisionSourceText) : [];
  const matches = blocks.filter(block => block.templateKey === normalize(expectedTemplate.template) && block.lineStart === Number(expectedTemplate.line));
  const root = matches.length === 1 ? matches[0] : null;
  const expectedIndices = (readiness.numberedVariantIndices || []).map(Number);
  const inventory = variantInventory(root?.parameters || [], expectedIndices, policy);
  const parent = parentOccurrenceEvidence(record, item, sourcesByKey, contentHash);
  const links = parseParentLinks(parent.evidence.exactSourceText || '');
  const subjectLinks = links.filter(link => normalize(link.target) === normalize(readiness.sourcePageIdentity?.resolvedTitle));
  const numberedNames = inventory.rows.flatMap(row => row.fields.filter(field => field.parameterBase === 'name').map(field => ({ variantIndex: row.variantIndex, parameterName: field.parameterName, value: field.value })));
  const displayValues = subjectLinks.map(link => normalize(link.displayText));
  const matchingVariantIndices = sorted(unique(numberedNames.filter(field => displayValues.includes(normalize(field.value))).map(field => field.variantIndex))).map(Number);
  const sharedNameFields = inventory.unnumberedIdentityFields.filter(field => field.parameterBase === 'name');
  const sharedNameMatches = sharedNameFields.some(field => displayValues.includes(normalize(field.value)));
  let bindingEvidenceState = 'no_unique_parent_occurrence_to_numbered_variant_signal';
  if (matchingVariantIndices.length === 1) bindingEvidenceState = 'unique_exact_parent_display_to_numbered_name_match_review_pending';
  else if (matchingVariantIndices.length > 1) bindingEvidenceState = 'ambiguous_multiple_numbered_variant_name_matches_review_blocked';
  else if (sharedNameMatches && expectedIndices.length > 1) bindingEvidenceState = 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked';
  const sourceNameFields = (root?.parameters || []).filter(parameter => /^name\d*$/.test(parameter.nameKey)).map(parameter => ({ name: parameter.name, value: parameter.value }));
  const checks = {
    workItemValid: workItemValid(item, policy),
    subjectSourceFoundAndComplete: subject?.captureComplete === true,
    subjectIdentityMatches: Number(subject?.sourcePageIdentity?.sourcePageId) === Number(readiness.sourcePageIdentity?.sourcePageId) && String(subject?.sourcePageIdentity?.sourceRevision || '') === String(readiness.sourcePageIdentity?.sourceRevision || ''),
    oneExpectedRootInfobox: matches.length === 1,
    rootInfoboxTemplateMatches: root?.template === expectedTemplate.template,
    rootInfoboxLineMatches: root?.lineStart === Number(expectedTemplate.line),
    expectedVariantIndicesMatchSource: hash(inventory.discoveredIndices) === hash(expectedIndices),
    allExpectedVariantsHaveIdentityFields: inventory.rows.every(row => row.identityFields.length > 0),
    readinessNameFieldsMatchSource: hash(sourceNameFields) === hash(readiness.infoboxNameFields || []),
    parentOccurrenceComplete: parent.complete,
    exactlyOneParentSubjectLink: subjectLinks.length === 1
  };
  const captureComplete = Object.values(checks).every(Boolean);
  const base = {
    contract: 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-packet.v1',
    packetKey: `${item.workItemKey}|revision-pinned-parent-occurrence-variant-binding-evidence`,
    sourceWorkItemKey: item.workItemKey,
    sourceDispositionKey: item.sourceDispositionKeys[0],
    structuralCandidateKey: item.structuralCandidateKey,
    candidateRole: item.candidateRole,
    subjectEvidence: {
      sourceKey: subject?.sourceKey || null,
      sourcePageIdentity: subject?.sourcePageIdentity || readiness.sourcePageIdentity || null,
      sourcePageEntityTypes: readiness.sourcePageEntityTypes || [],
      rootInfobox: root ? { template: root.template, lineStart: root.lineStart, lineEnd: root.lineEnd, exactSourceText: root.exactSourceText, exactSourceTextContentHash: contentHash(root.exactSourceText) } : null,
      numberedVariantIndices: expectedIndices,
      numberedVariantInventory: inventory.rows,
      unnumberedIdentityFields: inventory.unnumberedIdentityFields
    },
    parentOccurrenceEvidence: {
      sourceKey: parent.parent?.sourceKey || null,
      sourcePageIdentity: parent.parent?.sourcePageIdentity || null,
      exactSourceText: parent.evidence.exactSourceText || null,
      exactSourceTextContentHash: parent.evidence.exactSourceTextContentHash || null,
      sourceLocator: parent.evidence.sourceLocator || null,
      locatedSourceText: parent.locatedSourceText,
      parsedLinks: links,
      subjectPageLinks: subjectLinks
    },
    bindingEvidence: {
      state: bindingEvidenceState,
      numberedNameFields: numberedNames,
      parentSubjectLinkDisplayValues: subjectLinks.map(link => link.displayText),
      matchingVariantIndices,
      sharedUnnumberedNameFields: sharedNameFields,
      sharedUnnumberedNameMatchesParentDisplay: sharedNameMatches,
      uniqueExactNumberedNameMatch: matchingVariantIndices.length === 1,
      reviewReadyForVariantBinding: captureComplete && matchingVariantIndices.length === 1,
      bindingReviewDecision: null,
      boundVariantIndex: null,
      confirmationWouldNotProve: ['candidate_member_identity', 'weighted_parent_membership', 'repeatability', 'requirements', 'xp', 'timing', 'mechanics', 'declared_total_mapping', 'member_universe_completeness', 'optimizer_eligibility']
    },
    integrityChecks: checks,
    captureComplete,
    variantBindingReviewComplete: false,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    state: captureComplete ? 'revision_pinned_parent_occurrence_variant_binding_evidence_captured_review_pending' : 'blocked_incomplete_parent_occurrence_variant_binding_evidence_capture'
  };
  return { ...base, packetContentHash: contentHash(base) };
}

function expectedRecord(input, revisionBatches, policy, contentHash = hash) {
  const descriptors = relevantSourceDescriptors(input, policy);
  const responses = responseRevisionMap(revisionBatches);
  const sources = descriptors.map(descriptor => exactSourcePacket(descriptor, responses.get(descriptor.sourceRevision), contentHash));
  const sourcesByKey = new Map(sources.map(source => [source.sourceKey, source]));
  const packets = multiVariantItems(input, policy).map(item => bindingPacket(input, item, sourcesByKey, policy, contentHash));
  const captureComplete = sources.length > 0 && sources.every(source => source.captureComplete) && packets.length > 0 && packets.every(packet => packet.captureComplete);
  return {
    contract: policy.recordContract,
    memberCandidateKey: input.memberCandidateKey,
    sourceRoutingRecordContentHash: input.contentHash,
    exactRevisionSources: sources,
    variantBindingEvidencePackets: packets,
    variantBindingEvidenceSummary: {
      sourceCount: sources.length,
      completeSourceCount: sources.filter(source => source.captureComplete).length,
      routedWorkItemCount: multiVariantItems(input, policy).length,
      evidencePacketCount: packets.length,
      completeCapturePacketCount: packets.filter(packet => packet.captureComplete).length,
      uniqueNumberedNameMatchCount: packets.filter(packet => packet.bindingEvidence.uniqueExactNumberedNameMatch).length,
      reviewReadyBindingEvidenceCount: packets.filter(packet => packet.bindingEvidence.reviewReadyForVariantBinding).length,
      sharedUnnumberedNameAmbiguityCount: packets.filter(packet => packet.bindingEvidence.state === 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked').length,
      otherUnresolvedBindingEvidenceCount: packets.filter(packet => !packet.bindingEvidence.reviewReadyForVariantBinding && packet.bindingEvidence.state !== 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked').length,
      evidenceCaptureComplete: captureComplete,
      variantBindingReviewComplete: false,
      bindingDecisionCount: 0,
      boundVariantCount: 0,
      automaticVerificationApplied: false
    },
    accountIndependent: true,
    blockers: unique([
      captureComplete ? 'revision_pinned_parent_occurrence_variant_binding_evidence_captured_reviews_pending' : 'one_or_more_parent_occurrence_variant_binding_evidence_packets_incomplete',
      ...(packets.some(packet => !packet.bindingEvidence.reviewReadyForVariantBinding) ? ['one_or_more_parent_occurrences_do_not_uniquely_discriminate_a_numbered_variant'] : []),
      'candidate_member_identity_and_variant_binding_reviews_pending',
      'weighted_parent_task_entry_membership_not_proven',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'all_repeatability_evidence_domains_remain_unresolved',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    state: captureComplete ? 'multi_variant_structural_member_candidate_parent_occurrence_binding_evidence_captured_reviews_pending_gates_closed' : 'multi_variant_structural_member_candidate_parent_occurrence_binding_evidence_capture_incomplete_gates_closed'
  };
}

function revisionRequestCoverage(inputs, batches, policy) {
  const expected = discoverMultiVariantStructuralMemberCandidateParentOccurrenceBindingExactRevisionRequests(inputs, policy).map(item => item.sourceRevision);
  const submitted = batches.flatMap(batch => batch.requestedRevisions || []).map(String);
  const duplicateSubmittedRevisions = duplicates(submitted);
  const missingSubmittedRevisions = expected.filter(revision => !submitted.includes(revision));
  const unexpectedSubmittedRevisions = submitted.filter(revision => !expected.includes(revision));
  const invalidBatches = batches.flatMap((batch, index) => !Array.isArray(batch.requestedRevisions) || !batch.requestedRevisions.length || batch.requestedRevisions.length > policy.sourceCapture.revisionBatchSize || !Array.isArray(batch.response?.query?.pages) ? [`batch_${index + 1}_invalid`] : []);
  return { distinctPinnedRevisionCount: expected.length, submittedRevisionCount: submitted.length, revisionBatchCount: batches.length, duplicateSubmittedRevisions, missingSubmittedRevisions, unexpectedSubmittedRevisions, invalidBatches, requestCoverageComplete: expected.length > 0 && !duplicateSubmittedRevisions.length && !missingSubmittedRevisions.length && !unexpectedSubmittedRevisions.length && !invalidBatches.length };
}

function accountStateFindings(records = []) {
  const forbidden = /^(?:currentBaseLevel|targetBaseLevel|currentLevel|currentXp|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|bank|bankItems|playerName|username|preferences|currentAccount)$/i;
  const findings = [];
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
  return findings;
}

export function auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence(records = [], { routingRecords = [], revisionBatches = [], policy = {}, contentHash = hash } = {}) {
  const compiled = compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidencePolicy(policy);
  const inputs = selectMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceInputs(routingRecords, policy);
  const expected = compiled.valid ? inputs.map(input => expectedRecord(input, revisionBatches, policy, contentHash)) : [];
  const inputKeys = inputs.map(record => record.memberCandidateKey);
  const outputKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const inputHashFailures = inputs.filter(record => typeof record.contentHash !== 'string' || contentHash(without(record, 'contentHash')) !== record.contentHash).map(record => record.memberCandidateKey || 'unknown');
  const requestCoverage = revisionRequestCoverage(inputs, revisionBatches, policy);
  const sources = records.flatMap(record => record.exactRevisionSources || []);
  const packets = records.flatMap(record => record.variantBindingEvidencePackets || []);
  const expectedWorkKeys = inputs.flatMap(input => multiVariantItems(input, policy).map(item => item.workItemKey));
  const packetWorkKeys = packets.map(packet => packet.sourceWorkItemKey);
  const duplicatePacketKeys = duplicates(packetWorkKeys);
  const missingPacketKeys = expectedWorkKeys.filter(key => !packetWorkKeys.includes(key));
  const unexpectedPacketKeys = packetWorkKeys.filter(key => !expectedWorkKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !expected[index] || contentHash(record) !== contentHash(expected[index])).map(record => record.memberCandidateKey || 'unknown');
  const packetIntegrityFailures = packets.filter(packet => packet.captureComplete !== true || contentHash(without(packet, 'packetContentHash')) !== packet.packetContentHash).map(packet => packet.packetKey);
  const unsupportedPromotions = packets.filter(packet => packet.bindingEvidence?.bindingReviewDecision !== null
    || packet.bindingEvidence?.boundVariantIndex !== null
    || packet.variantBindingReviewComplete !== false
    || packet.candidateMemberIdentityVerdict !== null
    || packet.parentMembershipVerdict !== null
    || packet.weightedTaskEntryMembershipVerdict !== null
    || packet.mappingVerdict !== null
    || packet.inventoryCompletenessVerdict !== null
    || packet.memberUniverseComplete !== false
    || packet.optimizerEligible !== false
    || packet.automaticVerificationApplied !== false).map(packet => packet.packetKey);
  const accountFindings = accountStateFindings(records);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('multi_variant_binding_evidence_policy_invalid_or_candidate_specific');
  if (routingRecords.length !== inputs.length || duplicateInputKeys.length) structuralBlockers.push('input_routing_record_set_not_exactly_eligible_and_unique');
  if (inputHashFailures.length) structuralBlockers.push('one_or_more_input_routing_record_hashes_failed_revalidation');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('input_output_binding_evidence_record_set_mismatch');
  if (!requestCoverage.requestCoverageComplete) structuralBlockers.push('exact_revision_request_set_incomplete_or_mismatched');
  if (!sources.length || sources.some(source => !source.captureComplete)) structuralBlockers.push('one_or_more_exact_revision_sources_failed_revalidation');
  if (duplicatePacketKeys.length || missingPacketKeys.length || unexpectedPacketKeys.length) structuralBlockers.push('multi_variant_binding_evidence_packet_set_incomplete_or_mismatched');
  if (packetIntegrityFailures.length) structuralBlockers.push('one_or_more_multi_variant_binding_evidence_packets_invalid');
  if (recordMismatches.length) structuralBlockers.push('one_or_more_binding_evidence_records_do_not_match_exact_sources_and_generic_policy');
  if (unsupportedPromotions.length) structuralBlockers.push('binding_evidence_capture_created_unsupported_decision_or_semantic_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: { inputRoutingRecordCount: routingRecords.length, eligibleRoutingRecordCount: inputs.length, evidenceRecordCount: records.length, inputMultiVariantWorkItemCount: expectedWorkKeys.length, duplicateInputKeys, duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys, inputHashFailures },
    policyCoverage: compiled,
    revisionRequestCoverage: requestCoverage,
    sourceCoverage: { distinctRevisionPinnedSourceCount: sources.length, completeExactRevisionSourceCount: sources.filter(source => source.captureComplete).length, incompleteExactRevisionSourceCount: sources.filter(source => !source.captureComplete).length, duplicateSourceKeys: duplicates(sources.map(source => source.sourceKey)) },
    packetCoverage: { routedWorkItemCount: expectedWorkKeys.length, evidencePacketCount: packets.length, completeCapturePacketCount: packets.filter(packet => packet.captureComplete).length, duplicatePacketKeys, missingPacketKeys, unexpectedPacketKeys, packetIntegrityFailures },
    bindingEvidenceCoverage: {
      uniqueExactNumberedNameMatchCount: packets.filter(packet => packet.bindingEvidence?.uniqueExactNumberedNameMatch).length,
      reviewReadyBindingEvidenceCount: packets.filter(packet => packet.bindingEvidence?.reviewReadyForVariantBinding).length,
      sharedUnnumberedNameAmbiguityCount: packets.filter(packet => packet.bindingEvidence?.state === 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked').length,
      ambiguousMultipleMatchCount: packets.filter(packet => packet.bindingEvidence?.state === 'ambiguous_multiple_numbered_variant_name_matches_review_blocked').length,
      noUniqueSignalCount: packets.filter(packet => packet.bindingEvidence?.state === 'no_unique_parent_occurrence_to_numbered_variant_signal').length,
      bindingDecisionCount: packets.filter(packet => packet.bindingEvidence?.bindingReviewDecision !== null).length,
      boundVariantCount: packets.filter(packet => packet.bindingEvidence?.boundVariantIndex !== null).length
    },
    semanticPreservationCoverage: { recordMismatches, unsupportedPromotions },
    accountStateFindings: accountFindings,
    evidenceCaptureComplete: publishable && packets.length === expectedWorkKeys.length && packets.every(packet => packet.captureComplete),
    variantBindingReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'multi_variant_parent_occurrence_binding_evidence_captured_reviews_pending',
      ...(packets.some(packet => !packet.bindingEvidence?.reviewReadyForVariantBinding) ? ['one_or_more_parent_occurrences_do_not_uniquely_discriminate_a_numbered_variant'] : []),
      'candidate_member_identity_and_variant_binding_reviews_pending',
      'weighted_parent_task_entry_membership_not_proven',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'all_repeatability_evidence_domains_remain_unresolved',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence({ routingRecords = [], revisionBatches = [], policy = {}, contentHash = hash } = {}) {
  const compiled = compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidencePolicy(policy);
  const records = compiled.valid ? selectMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceInputs(routingRecords, policy).map(input => expectedRecord(input, revisionBatches, policy, contentHash)) : [];
  return { records, audit: auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence(records, { routingRecords, revisionBatches, policy, contentHash }) };
}
