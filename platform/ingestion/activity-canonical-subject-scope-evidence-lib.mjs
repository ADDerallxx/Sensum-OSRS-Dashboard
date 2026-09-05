import { parseLeadParagraphEvidence, parseSourceHeadings, parseSupportedActivityInfobox } from './activity-candidate-source-evidence-lib.mjs';
import { auditSourceTemplateDelimiters, findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';
import { parseDirectCategorySignatures, parseRootTemplateSignatures } from './unlock-linked-page-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = revision => revision?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceActivityCanonicalSubjectScopeEvidenceWorkRoutingContentHash',
  'canonicalActivityScopeEvidenceSources', 'canonicalActivityScopeEvidence', 'canonicalActivityScopeReview'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileActivityCanonicalSubjectScopeEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'oneEvidencePacketPerMatchingScopeEvidenceRoute',
    'everyBoundSubjectSourceIsFetchedAtItsExactBindingRevision',
    'fetchedPageIdTitleRevisionTimestampUrlAndContentHashMustMatchTheBinding',
    'completeExactRevisionSourceTextMustBeRetained',
    'everySourceLineMustBeRetainedWithLocationAndHash',
    'infoboxLeadHeadingTemplateAndCategoryStructureMustBeInventoried',
    'capturedStructureAndLanguageAreObservationsRequiringSemanticDisposition',
    'activityOrMinigamePageTypeDoesNotEstablishTrainingScope',
    'scopeEvidenceDoesNotEstablishRepeatabilityOrMembership',
    'missingChangedContradictoryTruncatedOrConditionMismatchedEvidenceRemainsBlocked',
    'namesTitlesPageIdsCandidateKeysLabelsAliasesCollectionClassesAndOverridesCannotSelectAVerdict',
    'inputEvidenceIdentityRevisionHashesBindingDispositionRoutingAndContextMustBePreserved',
    'subjectBindingAndSubjectDeclarationVerdictMustRemainUnchanged',
    'scopeRepeatabilityMemberMechanicsAndOptimizerPromotionAreForbidden',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const domains = policy.requiredEvidenceDomains || [];
  const channels = policy.requiredCaptureChannels || [];
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract || !policy.inputState) invalidRules.push('scope_evidence_contract_boundary_missing');
  if (!policy.inputRouteKey || !String(policy.inputRouteState || '').startsWith('blocked_')) invalidRules.push('scope_evidence_route_boundary_invalid');
  if (!domains.length || duplicates(domains).length) invalidRules.push('required_evidence_domains_missing_or_duplicated');
  if (!channels.length || duplicates(channels).length) invalidRules.push('required_capture_channels_missing_or_duplicated');
  return {
    policyId: policy.policy || null,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    requiredEvidenceDomains: domains,
    requiredCaptureChannels: channels
  };
}

function routeMatches(record, policy) {
  const disposition = record.canonicalActivitySubjectDeclarationDisposition || {};
  const binding = record.canonicalActivitySubjectBinding;
  const review = record.canonicalActivitySubjectDeclarationReview || {};
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && record.routingDecision?.routeKey === policy.inputRouteKey
    && record.routingDecision?.routeState === policy.inputRouteState
    && JSON.stringify(record.routingDecision?.requiredEvidenceDomains || []) === JSON.stringify(policy.requiredEvidenceDomains || [])
    && disposition.state === 'source_supported_canonical_activity_subject_binding'
    && disposition.verdict === binding?.verdict
    && disposition.canonicalActivityScopeVerdict === null
    && disposition.repeatabilityVerdict === null
    && Boolean(binding?.canonicalActivityKey)
    && binding.canonicalActivityKey === record.canonicalActivityIdentity?.canonicalActivityKey
    && binding.accountIndependent === true
    && review.state === 'reviewed_source_supported_canonical_activity_subject_binding'
    && review.canonicalActivitySubjectDeclarationVerdict === binding.verdict
    && review.canonicalActivityScopeVerdict === null
    && review.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true;
}

export function selectActivityCanonicalSubjectScopeEvidenceRoutes(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

function bindingSource(record) {
  return record.canonicalActivitySubjectBinding?.sourcePageIdentity || {};
}

export function discoverActivityCanonicalSubjectScopeExactRevisionRequests(records = [], policy = {}) {
  const requests = new Map();
  for (const record of selectActivityCanonicalSubjectScopeEvidenceRoutes(records, policy)) {
    const source = bindingSource(record);
    if (!source.sourceRevision) continue;
    const key = String(source.sourceRevision);
    const current = requests.get(key) || {
      sourceRevision: key,
      sourcePageId: Number(source.sourcePageId || 0) || null,
      resolvedTitle: source.resolvedTitle || null,
      sourceTimestamp: source.sourceTimestamp || null,
      sourceUrl: source.sourceUrl || null,
      sourceContentHash: source.sourceContentHash || null,
      bindingContexts: []
    };
    current.bindingContexts.push({
      memberCandidateKey: record.memberCandidateKey,
      canonicalActivityKey: record.canonicalActivityIdentity?.canonicalActivityKey || null,
      bindingClass: record.canonicalActivitySubjectBinding?.bindingClass || null
    });
    current.bindingContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    requests.set(key, current);
  }
  return [...requests.values()].sort((a, b) => Number(a.sourcePageId) - Number(b.sourcePageId) || a.sourceRevision.localeCompare(b.sourceRevision));
}

function fetchedByRevision(fetchedPages = []) {
  return new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
}

function sourceLineInventory(content, contentHash) {
  return String(content).split(/\r?\n/).map((rawText, index) => ({
    ordinal: index + 1,
    sourceLocator: { lineStart: index + 1, lineEnd: index + 1 },
    rawText,
    rawTextContentHash: contentHash(rawText)
  }));
}

function domainEvidence(policy, evidenceKey) {
  const support = {
    canonical_subject_page_exact_revision: ['complete_exact_revision_source_text'],
    lead_and_infobox_activity_description: ['activity_infobox_structure', 'lead_paragraph_inventory'],
    declared_activity_purpose_and_skill_relationship: ['complete_exact_revision_source_text', 'complete_source_line_inventory'],
    activity_boundary_and_composite_member_relationships: ['heading_inventory', 'root_template_inventory', 'complete_source_line_inventory'],
    scope_exclusions_and_condition_boundaries: ['complete_exact_revision_source_text', 'complete_source_line_inventory', 'direct_category_inventory'],
    separate_repeatability_evidence_obligation: ['repeatability_verdict_separation']
  };
  return (policy.requiredEvidenceDomains || []).map(domainKey => ({
    domainKey,
    captureState: 'captured_for_semantic_disposition_not_a_scope_verdict',
    sourceEvidenceKeys: [evidenceKey],
    supportingCaptureChannels: support[domainKey] || []
  }));
}

function sourcePacket(input, fetched, policy, contentHash) {
  const binding = input.canonicalActivitySubjectBinding;
  const expected = bindingSource(input);
  const page = fetched?.page || null;
  const revision = fetched?.revision || null;
  const content = sourceContent(revision);
  const computedHash = typeof content === 'string' ? contentHash(content) : null;
  const sourceUrl = page?.title ? wikiUrl(page.title) : null;
  const verification = {
    fetchedPagePresent: Boolean(page),
    fetchedRevisionContentPresent: typeof content === 'string',
    fetchedPageIdMatchesBinding: Boolean(page && Number(page.pageid) === Number(expected.sourcePageId)),
    fetchedTitleMatchesBinding: Boolean(page && page.title === expected.resolvedTitle),
    fetchedRevisionMatchesBinding: Boolean(revision && String(revision.revid) === String(expected.sourceRevision || '')),
    fetchedTimestampMatchesBinding: Boolean(revision && revision.timestamp === expected.sourceTimestamp),
    fetchedUrlMatchesBinding: Boolean(sourceUrl && sourceUrl === expected.sourceUrl),
    fetchedContentHashMatchesBinding: Boolean(computedHash && computedHash === expected.sourceContentHash),
    bindingRevisionBoundaryMatchesSource: binding?.evidenceRevisionBoundary?.subjectSourceRevision === expected.sourceRevision
  };
  const infobox = typeof content === 'string' ? parseSupportedActivityInfobox(content) : null;
  const lines = typeof content === 'string' ? sourceLineInventory(content, contentHash) : [];
  const templateAudit = typeof content === 'string' ? auditSourceTemplateDelimiters(content) : null;
  const capture = {
    complete_exact_revision_source_text: typeof content === 'string' && content.length > 0,
    activity_infobox_structure: Boolean(infobox?.balanced),
    lead_paragraph_inventory: typeof content === 'string',
    heading_inventory: typeof content === 'string',
    root_template_inventory: Boolean(templateAudit?.balanced),
    direct_category_inventory: typeof content === 'string',
    complete_source_line_inventory: typeof content === 'string' && lines.length === String(content).split(/\r?\n/).length,
    repeatability_verdict_separation: true
  };
  const deficiencies = [];
  if (!Object.values(verification).every(Boolean)) deficiencies.push('exact_bound_subject_revision_identity_or_hash_alignment_failed');
  if ((policy.requiredCaptureChannels || []).some(channel => capture[channel] !== true)) deficiencies.push('one_or_more_required_scope_evidence_capture_channels_incomplete');
  const evidenceKey = `${input.memberCandidateKey}|${expected.sourcePageId}|${expected.sourceRevision}:canonical-activity-scope-source`;
  return {
    sourceEvidenceKey: evidenceKey,
    canonicalActivityKey: input.canonicalActivityIdentity?.canonicalActivityKey || null,
    sourcePageIdentity: {
      sourcePageId: page?.pageid ? Number(page.pageid) : null,
      resolvedTitle: page?.title || null,
      sourceRevision: revision?.revid ? String(revision.revid) : null,
      sourceTimestamp: revision?.timestamp || null,
      sourceUrl,
      sourceContentHash: computedHash,
      sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : 0
    },
    sourceRevisionVerification: verification,
    exactRevisionSourceText: typeof content === 'string' ? content : null,
    structuralInventory: {
      activityInfobox: infobox,
      leadParagraphs: typeof content === 'string' ? parseLeadParagraphEvidence(content, infobox) : [],
      headings: typeof content === 'string' ? parseSourceHeadings(content) : [],
      rootTemplates: typeof content === 'string' ? parseRootTemplateSignatures(content) : [],
      rootTemplateDelimiterAudit: templateAudit,
      directCategories: typeof content === 'string' ? parseDirectCategorySignatures(content) : [],
      sourceLines: lines
    },
    captureChannels: (policy.requiredCaptureChannels || []).map(channelKey => ({ channelKey, complete: capture[channelKey] === true })),
    domainEvidence: domainEvidence(policy, evidenceKey),
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    deficiencies,
    state: deficiencies.length ? 'blocked_incomplete_revision_pinned_canonical_activity_scope_source' : 'complete_revision_pinned_canonical_activity_scope_source'
  };
}

function expectedRecord(input, fetchedPages, policy, contentHash) {
  const fetched = fetchedByRevision(fetchedPages);
  const source = bindingSource(input);
  const packet = sourcePacket(input, fetched.get(String(source.sourceRevision || '')), policy, contentHash);
  const complete = packet.state === 'complete_revision_pinned_canonical_activity_scope_source';
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceActivityCanonicalSubjectScopeEvidenceWorkRoutingContentHash: input.contentHash,
    canonicalActivityScopeEvidenceSources: [packet],
    canonicalActivityScopeEvidence: {
      evidenceState: complete ? 'complete_revision_pinned_canonical_activity_scope_evidence_packet' : 'blocked_incomplete_canonical_activity_scope_evidence_packet',
      requiredEvidenceDomainCount: policy.requiredEvidenceDomains?.length || 0,
      capturedEvidenceDomainCount: packet.domainEvidence.length,
      requiredCaptureChannelCount: policy.requiredCaptureChannels?.length || 0,
      completedCaptureChannelCount: packet.captureChannels.filter(channel => channel.complete).length,
      sourceEvidenceKeys: [packet.sourceEvidenceKey],
      canonicalActivitySubjectDeclarationVerdict: input.canonicalActivitySubjectBinding?.verdict || null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivityScopeReview: {
      state: complete ? 'unreviewed_complete_revision_pinned_scope_evidence_semantic_disposition_required' : 'blocked_incomplete_scope_evidence',
      canonicalActivitySubjectDeclarationVerdict: input.canonicalActivitySubjectBinding?.verdict || null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: complete ? [packet.sourceEvidenceKey] : []
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => blocker !== 'routed_canonical_activity_scope_evidence_work_not_completed'),
      ...packet.deficiencies,
      complete ? 'canonical_activity_scope_evidence_requires_semantic_disposition' : 'canonical_activity_scope_evidence_incomplete',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: complete ? 'canonical_activity_scope_evidence_ready_for_semantic_disposition' : 'canonical_activity_scope_evidence_blocked_incomplete'
  };
}

export function buildActivityCanonicalSubjectScopeEvidence({ routingRecords = [], fetchedPages = [], policy = {}, contentHash = value => value }) {
  const inputs = selectActivityCanonicalSubjectScopeEvidenceRoutes(routingRecords, policy);
  const records = inputs.map(input => expectedRecord(input, fetchedPages, policy, contentHash));
  return { records, audit: auditActivityCanonicalSubjectScopeEvidence(records, { routingRecords, fetchedPages, policy, contentHash }) };
}

export function auditActivityCanonicalSubjectScopeEvidence(records = [], { routingRecords = [], fetchedPages = [], policy = {}, contentHash = value => value } = {}) {
  const compiled = compileActivityCanonicalSubjectScopeEvidencePolicy(policy);
  const inputs = selectActivityCanonicalSubjectScopeEvidenceRoutes(routingRecords, policy);
  const expected = inputs.map(input => expectedRecord(input, fetchedPages, policy, contentHash));
  const expectedKeys = inputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const inputByKey = new Map(inputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || record.sourceActivityCanonicalSubjectScopeEvidenceWorkRoutingContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const evidenceMismatches = records.filter(record => {
    const target = expectedByKey.get(record.memberCandidateKey);
    return !target
      || JSON.stringify(record.canonicalActivityScopeEvidenceSources) !== JSON.stringify(target.canonicalActivityScopeEvidenceSources)
      || JSON.stringify(record.canonicalActivityScopeEvidence) !== JSON.stringify(target.canonicalActivityScopeEvidence)
      || JSON.stringify(record.canonicalActivityScopeReview) !== JSON.stringify(target.canonicalActivityScopeReview);
  }).map(record => record.memberCandidateKey);
  const requests = discoverActivityCanonicalSubjectScopeExactRevisionRequests(inputs, policy);
  const requestedRevisions = requests.map(request => request.sourceRevision);
  const fetchedRows = fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({ page, revision })));
  const fetchedRevisions = fetchedRows.map(row => String(row.revision.revid || '')).filter(Boolean);
  const missingRevisions = requestedRevisions.filter(revision => !fetchedRevisions.includes(revision));
  const unexpectedRevisions = fetchedRevisions.filter(revision => !requestedRevisions.includes(revision));
  const duplicateFetchedRevisions = duplicates(fetchedRevisions);
  const sourcePackets = records.flatMap(record => record.canonicalActivityScopeEvidenceSources || []);
  const incompleteSources = sourcePackets.filter(packet => packet.state !== 'complete_revision_pinned_canonical_activity_scope_source');
  const incompleteRecords = records.filter(record => record.canonicalActivityScopeEvidence?.evidenceState !== 'complete_revision_pinned_canonical_activity_scope_evidence_packet');
  const sourceLines = sourcePackets.flatMap(packet => packet.structuralInventory?.sourceLines || []);
  const lineCoverageFailures = sourcePackets.filter(packet => {
    const text = packet.exactRevisionSourceText;
    const lines = packet.structuralInventory?.sourceLines || [];
    return typeof text !== 'string' || lines.length !== text.split(/\r?\n/).length
      || lines.some((line, index) => line.ordinal !== index + 1 || line.rawTextContentHash !== contentHash(line.rawText));
  }).map(packet => packet.sourceEvidenceKey);
  const captureChannels = sourcePackets.flatMap(packet => packet.captureChannels || []);
  const incompleteCaptureChannels = captureChannels.filter(channel => channel.complete !== true);
  const subjectMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.canonicalActivityIdentity) !== JSON.stringify(input.canonicalActivityIdentity)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationDisposition) !== JSON.stringify(input.canonicalActivitySubjectDeclarationDisposition)
      || JSON.stringify(record.canonicalActivitySubjectBinding) !== JSON.stringify(input.canonicalActivitySubjectBinding)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationReview) !== JSON.stringify(input.canonicalActivitySubjectDeclarationReview);
  }).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const packets = record.canonicalActivityScopeEvidenceSources || [];
    return !input
      || record.canonicalActivityScopeEvidence?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivityScopeEvidence?.repeatabilityVerdict !== null
      || record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivityScopeReview?.repeatabilityVerdict !== null
      || packets.some(packet => packet.canonicalActivityScopeVerdict !== null || packet.repeatabilityVerdict !== null)
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_matching_canonical_activity_scope_evidence_routes');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_scope_evidence_record_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('upstream_evidence_identity_revision_hash_binding_disposition_routing_or_context_changed');
  if (evidenceMismatches.length) structuralBlockers.push('one_or_more_scope_evidence_packets_do_not_match_inputs_and_fetched_revisions');
  if (missingRevisions.length || unexpectedRevisions.length || duplicateFetchedRevisions.length) structuralBlockers.push('exact_bound_subject_revision_fetch_set_mismatch');
  if (lineCoverageFailures.length) structuralBlockers.push('one_or_more_exact_revision_source_line_inventories_incomplete_or_changed');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) structuralBlockers.push('canonical_activity_scope_evidence_policy_invalid_or_activity_specific');
  if (subjectMutations.length) structuralBlockers.push('scope_evidence_changed_subject_binding_identity_disposition_or_review');
  if (downstreamPromotions.length) structuralBlockers.push('scope_evidence_created_unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_canonical_activity_scope_evidence');
  const attemptComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const evidenceComplete = attemptComplete && !incompleteSources.length && !incompleteRecords.length && !incompleteCaptureChannels.length;
  return {
    contract: policy.auditContract,
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedRouteRecordCount: expectedKeys.length,
      evidenceRecordCount: records.length,
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
      requiredEvidenceDomainCount: compiled.requiredEvidenceDomains.length,
      requiredCaptureChannelCount: compiled.requiredCaptureChannels.length
    },
    revisionCoverage: {
      requestedExactRevisionCount: requestedRevisions.length,
      fetchedExactRevisionCount: fetchedRevisions.length,
      missingRevisionIds: missingRevisions,
      unexpectedRevisionIds: unexpectedRevisions,
      duplicateFetchedRevisionIds: duplicateFetchedRevisions,
      exactRevisionFetchSetMatch: !missingRevisions.length && !unexpectedRevisions.length && !duplicateFetchedRevisions.length,
      completeSourcePacketCount: sourcePackets.length - incompleteSources.length,
      incompleteSources: incompleteSources.map(packet => ({ sourceEvidenceKey: packet.sourceEvidenceKey, deficiencies: packet.deficiencies }))
    },
    captureCoverage: {
      sourcePacketCount: sourcePackets.length,
      retainedExactRevisionSourceCount: sourcePackets.filter(packet => typeof packet.exactRevisionSourceText === 'string').length,
      retainedSourceContentBytes: sourcePackets.reduce((sum, packet) => sum + Number(packet.sourcePageIdentity?.sourceContentBytes || 0), 0),
      retainedSourceLineCount: sourceLines.length,
      lineInventoryFailureSourceEvidenceKeys: lineCoverageFailures,
      requiredEvidenceDomainCountPerRecord: compiled.requiredEvidenceDomains.length,
      capturedEvidenceDomainCount: sourcePackets.reduce((sum, packet) => sum + (packet.domainEvidence?.length || 0), 0),
      requiredCaptureChannelCountPerRecord: compiled.requiredCaptureChannels.length,
      completedCaptureChannelCount: captureChannels.filter(channel => channel.complete).length,
      incompleteCaptureChannels,
      leadParagraphCount: sourcePackets.reduce((sum, packet) => sum + (packet.structuralInventory?.leadParagraphs?.length || 0), 0),
      headingCount: sourcePackets.reduce((sum, packet) => sum + (packet.structuralInventory?.headings?.length || 0), 0),
      rootTemplateCount: sourcePackets.reduce((sum, packet) => sum + (packet.structuralInventory?.rootTemplates?.length || 0), 0),
      directCategoryCount: sourcePackets.reduce((sum, packet) => sum + (packet.structuralInventory?.directCategories?.length || 0), 0),
      evidenceMismatchMemberCandidateKeys: evidenceMismatches,
      incompleteRecordMemberCandidateKeys: incompleteRecords.map(record => record.memberCandidateKey)
    },
    semanticPromotionCoverage: {
      subjectBindingIdentityDispositionOrReviewMutationMemberCandidateKeys: subjectMutations,
      preservedCanonicalActivitySubjectBindingCount: records.filter(record => record.canonicalActivitySubjectBinding !== null).length,
      preservedCanonicalActivitySubjectDeclarationVerdictCount: records.filter(record => record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== null).length,
      canonicalActivityScopeClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.repeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedDownstreamPromotionMemberCandidateKeys: downstreamPromotions
    },
    accountStateFindings,
    evidencePacketAttemptCoverageComplete: attemptComplete,
    canonicalActivityScopeEvidenceCoverageComplete: evidenceComplete,
    canonicalActivitySubjectBindingReviewComplete: attemptComplete,
    canonicalActivityScopeReviewComplete: false,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(incompleteSources.length ? ['one_or_more_revision_pinned_scope_sources_incomplete'] : []),
      ...(incompleteCaptureChannels.length ? ['one_or_more_scope_evidence_capture_channels_incomplete'] : []),
      'canonical_activity_scope_evidence_requires_semantic_disposition',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: attemptComplete
  };
}
