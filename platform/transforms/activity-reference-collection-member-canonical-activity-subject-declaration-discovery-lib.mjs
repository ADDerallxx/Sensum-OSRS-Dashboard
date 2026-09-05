import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const stageFields = new Set(['contract', 'contentHash', 'blockers', 'state', 'sourceSignalSubjectPredicateDispositionContentHash', 'canonicalActivitySubjectDeclarationDiscovery', 'canonicalActivitySubjectDeclarationReview']);
const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|canonicalLabel|canonicalLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileCanonicalActivitySubjectDeclarationDiscoveryPolicy(policy = {}) {
  const required = ['oneCandidateLevelPacketPerCompleteUnresolvedActivityRecord', 'allUnboundSignalDispositionsAreConsolidatedWithoutLoss', 'exactSourcePhraseSearchBoundaryMustBeFullyEnumerated', 'everyExactSearchResultMustHaveAStableResolutionAssessment', 'everyResolvedSearchCandidateMustHaveRevisionPinnedSourceEvidence', 'collectionAndLinkedSubjectAnchorsMustRetainExactRevisionsAndHashes', 'redirectAliasesRemainStructuralObservationsOnly', 'searchRankSnippetTitleLabelRedirectAndLexicalSimilarityAreDiscoveryOnly', 'discoveryCannotCreateASubjectBindingScopeOrRepeatabilityVerdict', 'missingTruncatedContradictoryOrUnpinnedEvidenceRemainsExplicit', 'upstreamEvidenceRoutingDispositionsReviewsAndIdentitiesRemainUnchanged', 'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed', 'activitySpecificNamesTitlesPageIdsLabelsAliasesAndOverridesCannotSelectAVerdict', 'currentAccountStateIsForbidden'];
  const invalidRules = required.filter(rule => policy.rules?.[rule] !== true);
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract || !policy.inputState) invalidRules.push('canonical_activity_subject_declaration_discovery_contract_boundary_missing');
  return { policyId: policy.policy || null, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbiddenPolicyPaths(policy) };
}

const dispositions = record => record.independentRepeatabilitySignalSubjectPredicateDisposition?.signalDispositions || [];
const sourceEvidence = record => record.independentRepeatabilitySourceEvidence || {};

function anchorEvidence(record) {
  const collection = record.collectionContext?.collectionSource || {};
  const linked = {
    pageId: record.sourcePageId,
    title: record.resolvedTitle,
    revision: record.sourceRevision,
    timestamp: record.sourceTimestamp,
    url: record.sourceUrl,
    contentHash: record.sourceContentHash
  };
  return [
    { role: 'collection_definition_anchor', pageId: collection.pageId, title: collection.title, revision: collection.revision, timestamp: collection.timestamp, url: collection.url, contentHash: collection.contentHash },
    { role: 'linked_subject_anchor', ...linked }
  ];
}

function revisionEvidence(record, pageId) {
  const page = [
    ...(sourceEvidence(record).candidatePages || []),
    ...(record.corroboratingRepeatabilityEvidence?.candidatePages || [])
  ].find(item => Number(item.sourcePageId) === Number(pageId));
  if (page) return { sourcePageId: page.sourcePageId, resolvedTitle: page.resolvedTitle, sourceRevision: page.sourceRevision, sourceTimestamp: page.sourceTimestamp, sourceUrl: page.sourceUrl, sourceContentHash: page.sourceContentHash, sourceContentBytes: page.sourceContentBytes, completeRevisionContentScanned: page.completeRevisionContentScanned === true };
  const anchor = anchorEvidence(record).find(item => Number(item.pageId) === Number(pageId));
  if (!anchor) return null;
  return { sourcePageId: anchor.pageId, resolvedTitle: anchor.title, sourceRevision: anchor.revision, sourceTimestamp: anchor.timestamp, sourceUrl: anchor.url, sourceContentHash: anchor.contentHash, sourceContentBytes: null, completeRevisionContentScanned: true };
}

function searchCandidate(record, result, assessments) {
  const assessment = assessments.find(item => (item.observedPageIds || []).map(Number).includes(Number(result.pageid))) || null;
  const resolvedPageId = Number(assessment?.resolvedPageId || result.pageid || 0) || null;
  const revision = resolvedPageId ? revisionEvidence(record, resolvedPageId) : null;
  const deficiencies = [];
  if (!assessment) deficiencies.push('exact_search_result_resolution_assessment_missing');
  if (!resolvedPageId) deficiencies.push('exact_search_result_stable_page_identity_missing');
  if (!revision?.sourceRevision || !revision?.sourceTimestamp || !revision?.sourceUrl || !revision?.sourceContentHash || revision.completeRevisionContentScanned !== true) deficiencies.push('exact_search_result_revision_pinned_source_evidence_missing');
  return {
    observedPageId: Number(result.pageid || 0) || null,
    observedTitle: result.title || null,
    rank: result.rank ?? null,
    resultTimestamp: result.timestamp || null,
    resultSize: result.size ?? null,
    resultWordCount: result.wordcount ?? null,
    resultSnippet: result.snippet ?? null,
    resolution: assessment ? { requestedTitle: assessment.requestedTitle, resolvedPageId, resolvedTitle: assessment.resolvedTitle, redirected: assessment.redirected === true, state: assessment.state } : null,
    revisionEvidence: revision,
    subjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    semanticUse: 'candidate_source_discovery_only_requires_exact_declaration_extraction_and_review',
    deficiencies,
    state: deficiencies.length ? 'blocked_missing_revision_pinned_candidate_source' : 'revision_pinned_subject_declaration_candidate_source'
  };
}

function expectedRecord(input, policy) {
  const signalDispositions = dispositions(input);
  const boundary = sourceEvidence(input).discoveryBoundary || {};
  const search = boundary.exactSourceSearch || {};
  const assessments = boundary.candidateRequestAssessments || [];
  const candidates = (search.results || []).map(result => searchCandidate(input, result, assessments));
  const linkedAnchorId = Number(input.canonicalActivityIdentity?.stableIdentityAnchor?.linkedSubjectPageId || 0);
  const redirectAliases = assessments.filter(item => item.redirected === true && Number(item.resolvedPageId || 0) === linkedAnchorId)
    .map(item => ({ requestedTitle: item.requestedTitle, observedPageIds: item.observedPageIds || [], resolvedPageId: item.resolvedPageId, resolvedTitle: item.resolvedTitle, targetAnchorRevisionEvidence: revisionEvidence(input, linkedAnchorId), semanticUse: 'redirect_alias_observation_only_not_canonical_activity_identity_or_subject_proof', subjectDeclarationVerdict: null }))
    .sort((a, b) => String(a.requestedTitle).localeCompare(String(b.requestedTitle)));
  const anchors = anchorEvidence(input);
  const deficiencies = [];
  if (input.contract !== policy.inputContract || input.state !== policy.inputState) deficiencies.push('input_contract_or_state_mismatch');
  if (!signalDispositions.length || signalDispositions.some(item => item.state !== 'blocked_no_stable_activity_subject_anchor')) deficiencies.push('input_contains_non_unbound_or_missing_signal_dispositions');
  if (search.continuationExhausted !== true || search.truncated === true || Number(search.returnedCount) !== (search.results || []).length || Number(search.totalHits) !== (search.results || []).length) deficiencies.push('exact_source_phrase_search_boundary_not_fully_enumerated');
  if (!search.query) deficiencies.push('exact_source_phrase_search_query_missing');
  if (candidates.some(item => item.deficiencies.length)) deficiencies.push('one_or_more_search_candidates_lack_revision_pinned_source_evidence');
  if (anchors.some(item => !item.pageId || !item.revision || !item.timestamp || !item.url || !item.contentHash)) deficiencies.push('collection_or_linked_subject_anchor_revision_evidence_incomplete');
  const inherited = (input.blockers || []).filter(blocker => blocker !== 'canonical_activity_subject_binding_unresolved');
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceSignalSubjectPredicateDispositionContentHash: input.contentHash,
    canonicalActivitySubjectDeclarationDiscovery: {
      evidenceState: deficiencies.length ? 'incomplete_revision_pinned_canonical_activity_subject_declaration_discovery_packet' : 'complete_revision_pinned_canonical_activity_subject_declaration_discovery_packet',
      canonicalActivityKey: input.canonicalActivityIdentity?.canonicalActivityKey || null,
      stableIdentityAnchor: input.canonicalActivityIdentity?.stableIdentityAnchor || null,
      consolidatedUnboundSignalCount: signalDispositions.length,
      consolidatedSignalEvidenceKeys: sorted(signalDispositions.map(item => item.signalEvidenceKey)),
      anchorRevisionEvidence: anchors,
      exactSourcePhraseSearch: { query: search.query || null, namespace: search.namespace ?? null, totalHits: search.totalHits ?? null, returnedCount: search.returnedCount ?? null, continuationExhausted: search.continuationExhausted === true, truncated: search.truncated === true },
      revisionPinnedCandidateSourceCount: candidates.filter(item => !item.deficiencies.length).length,
      candidateSourceCount: candidates.length,
      candidateSources: candidates,
      redirectAliasObservationCount: redirectAliases.length,
      redirectAliasObservations: redirectAliases,
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      deficiencies
    },
    canonicalActivitySubjectDeclarationReview: { state: 'unreviewed_exact_declaration_extraction_required', canonicalActivitySubjectDeclarationVerdict: null, canonicalActivityScopeVerdict: null, repeatabilityVerdict: null, requiredEvidence: ['exact_revision_source_line_canonical_activity_subject_declaration', 'semantic_binding_of_declared_subject_to_canonical_activity_identity', 'variant_or_mode_scope_if_applicable'] },
    accountIndependent: true,
    blockers: unique([...inherited, ...deficiencies, 'canonical_activity_subject_declaration_requires_exact_line_extraction_and_semantic_review', 'canonical_activity_subject_binding_unresolved', 'canonical_activity_scope_review_incomplete', 'repeatability_classification_unresolved', 'member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'optimizer_eligibility_blocked']),
    state: deficiencies.length ? 'canonical_activity_subject_declaration_discovery_blocked_incomplete_evidence' : 'canonical_activity_subject_declaration_discovery_ready_for_exact_line_review'
  };
}

export function buildCanonicalActivitySubjectDeclarationDiscovery({ dispositionRecords = [], policy = {} }) {
  const records = dispositionRecords.map(record => expectedRecord(record, policy));
  return { records, audit: auditCanonicalActivitySubjectDeclarationDiscovery(records, { dispositionRecords, policy }) };
}

export function auditCanonicalActivitySubjectDeclarationDiscovery(records = [], { dispositionRecords = [], policy = {} } = {}) {
  const compiled = compileCanonicalActivitySubjectDeclarationDiscoveryPolicy(policy);
  const expectedKeys = dispositionRecords.map(x => x.memberCandidateKey), actualKeys = records.map(x => x.memberCandidateKey);
  const inputByKey = new Map(dispositionRecords.map(x => [x.memberCandidateKey, x]));
  const duplicateInputKeys = duplicates(expectedKeys), duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(x => !actualKeys.includes(x)), unexpectedKeys = actualKeys.filter(x => !expectedKeys.includes(x));
  const contextMismatches = records.filter(output => { const input = inputByKey.get(output.memberCandidateKey); return !input || output.sourceSignalSubjectPredicateDispositionContentHash !== input.contentHash || JSON.stringify(preservedInput(output)) !== JSON.stringify(preservedInput(input)); }).map(x => x.memberCandidateKey);
  const invalidRecords = records.filter(output => { const input = inputByKey.get(output.memberCandidateKey); return !input || JSON.stringify(output) !== JSON.stringify(expectedRecord(input, policy)); }).map(x => x.memberCandidateKey);
  const inputPairs = dispositionRecords.flatMap(record => dispositions(record).map(item => `${record.memberCandidateKey}|${item.signalEvidenceKey}`));
  const outputPairs = records.flatMap(record => (record.canonicalActivitySubjectDeclarationDiscovery?.consolidatedSignalEvidenceKeys || []).map(key => `${record.memberCandidateKey}|${key}`));
  const missingPairs = inputPairs.filter(x => !outputPairs.includes(x)), unexpectedPairs = outputPairs.filter(x => !inputPairs.includes(x));
  const candidates = records.flatMap(record => record.canonicalActivitySubjectDeclarationDiscovery?.candidateSources || []);
  const incompleteRecords = records.filter(record => record.canonicalActivitySubjectDeclarationDiscovery?.evidenceState !== 'complete_revision_pinned_canonical_activity_subject_declaration_discovery_packet').map(x => x.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => record.canonicalActivitySubjectDeclarationDiscovery?.canonicalActivitySubjectDeclarationVerdict !== null || record.canonicalActivitySubjectDeclarationDiscovery?.canonicalActivityScopeVerdict !== null || record.canonicalActivitySubjectDeclarationDiscovery?.repeatabilityVerdict !== null || record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== null || record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict !== null || record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null || record.memberExpansionReview?.state !== 'unreviewed' || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible !== false).map(x => x.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structural = [];
  if (!expectedKeys.length) structural.push('no_subject_predicate_disposition_inputs');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structural.push('input_and_output_discovery_record_sets_do_not_match_exactly');
  if (contextMismatches.length) structural.push('upstream_evidence_routing_disposition_review_or_identity_changed');
  if (invalidRecords.length) structural.push('one_or_more_discovery_packets_not_reproducible');
  if (missingPairs.length || unexpectedPairs.length || duplicates(inputPairs).length || duplicates(outputPairs).length) structural.push('unbound_signal_consolidation_set_mismatch');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) structural.push('canonical_activity_subject_declaration_discovery_policy_invalid_or_activity_specific');
  if (incompleteRecords.length) structural.push('one_or_more_subject_declaration_discovery_packets_incomplete');
  if (unsupportedPromotions.length) structural.push('unsupported_subject_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structural.push('account_query_state_baked_into_subject_declaration_discovery');
  const attemptComplete = expectedKeys.length > 0 && inputPairs.length > 0 && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !missingPairs.length && !unexpectedPairs.length && !duplicates(inputPairs).length && !duplicates(outputPairs).length;
  const complete = attemptComplete && !structural.length;
  return {
    contract: policy.auditContract,
    accountIndependent: !accountStateFindings.length,
    inputCoverage: { expectedRecordCount: expectedKeys.length, outputRecordCount: records.length, duplicateInputMemberCandidateKeys: duplicateInputKeys, duplicateOutputMemberCandidateKeys: duplicateOutputKeys, missingMemberCandidateKeys: missingKeys, unexpectedMemberCandidateKeys: unexpectedKeys, contextMismatchMemberCandidateKeys: contextMismatches },
    policyCoverage: compiled,
    signalConsolidationCoverage: { inputUnboundSignalCount: inputPairs.length, consolidatedUnboundSignalCount: outputPairs.length, missingSignalPairs: missingPairs, unexpectedSignalPairs: unexpectedPairs, duplicateInputSignalPairs: duplicates(inputPairs), duplicateOutputSignalPairs: duplicates(outputPairs), exactSignalConsolidationSetMatch: !missingPairs.length && !unexpectedPairs.length && !duplicates(inputPairs).length && !duplicates(outputPairs).length },
    searchBoundaryCoverage: { exactSourcePhraseSearchCount: records.length, fullyEnumeratedSearchCount: records.filter(x => x.canonicalActivitySubjectDeclarationDiscovery?.exactSourcePhraseSearch?.continuationExhausted && !x.canonicalActivitySubjectDeclarationDiscovery?.exactSourcePhraseSearch?.truncated).length, exactSearchResultCount: candidates.length },
    revisionCoverage: { candidateSourceCount: candidates.length, revisionPinnedCandidateSourceCount: candidates.filter(x => !x.deficiencies?.length).length, missingRevisionCandidateCount: candidates.filter(x => x.deficiencies?.length).length, anchorRevisionEvidenceCount: records.reduce((sum, x) => sum + (x.canonicalActivitySubjectDeclarationDiscovery?.anchorRevisionEvidence?.length || 0), 0) },
    semanticPromotionCoverage: { invalidPacketMemberCandidateKeys: invalidRecords, unsupportedPromotionMemberCandidateKeys: unsupportedPromotions, semanticSubjectBindingCount: 0, canonicalActivityScopeClassificationCount: 0, repeatabilityClassificationCount: 0, memberExpansionReviewedCount: records.filter(x => x.memberExpansionReview?.state !== 'unreviewed').length, mechanicsReviewedCount: records.filter(x => x.mechanicsReview?.state !== 'unreviewed').length, optimizerEligibleCount: records.filter(x => x.optimizerEligible === true).length },
    accountStateFindings,
    subjectDeclarationDiscoveryAttemptCoverageComplete: attemptComplete,
    canonicalActivitySubjectDeclarationDiscoveryCoverageComplete: complete,
    canonicalActivitySubjectBindingReviewComplete: false,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structural, 'canonical_activity_subject_declaration_exact_line_and_semantic_review_pending', 'canonical_activity_scope_review_incomplete', 'repeatability_classification_unresolved', 'member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable: complete
  };
}
