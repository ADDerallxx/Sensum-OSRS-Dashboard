import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceCanonicalActivitySubjectDeclarationStructuralContextEvidenceContentHash',
  'canonicalActivitySubjectDeclarationStructuralDispositionSignals',
  'canonicalActivitySubjectDeclarationStructuralDisposition',
  'canonicalActivitySubjectBinding',
  'canonicalActivitySubjectDeclarationReview'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|canonicalLabel|canonicalLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileCanonicalActivitySubjectDeclarationStructuralContextDispositionPolicy(policy = {}) {
  const required = [
    'oneDispositionPerCompleteStructuralContextEvidenceRecord',
    'everyInputOccurrenceReceivesExactlyOneSemanticEvidenceUseClass',
    'subjectCandidateRequiresTheCompleteRevisionPinnedStructuralEvidenceChain',
    'subjectCandidateRequiresDynamicCanonicalLabelAndSourceTitleEquality',
    'subjectCandidateRequiresExactCaseActiveLeadActivityInfoboxNameValue',
    'titleAlignedNonCandidateOccurrencesRemainSupportingOnly',
    'crossPageLinksAndMentionsRemainReferenceOnly',
    'protectedOrMixedOccurrencesCannotSupportSubjectBinding',
    'activityInfoboxSchemaMeaningRequiresSeparateRevisionPinnedEvidence',
    'absenceOfAStructurallyQualifiedCandidateDoesNotProveNonexistence',
    'structuralDispositionCannotCreateSubjectScopeOrRepeatabilityVerdicts',
    'upstreamEvidenceIdentityOccurrencesAndReviewsRemainUnchangedExceptDispositionReviewState',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'missingContradictoryOrConditionMismatchedEvidenceRemainsExplicit',
    'activitySpecificNamesTitlesPageIdsLabelsAliasesAndOverridesAreForbidden',
    'currentAccountStateIsForbidden'
  ];
  const candidate = policy.subjectCandidateRule || {};
  const candidateRuleValid = Boolean(
    candidate.ruleKey
    && candidate.requiredSourceRegionState === 'active_source_text'
    && candidate.requiresCanonicalLabelSourceTitleEquality === true
    && candidate.requiresExactCanonicalLabelCase === true
    && candidate.requiresBeforeFirstHeading === true
    && candidate.requiredOutermostTemplate
    && candidate.requiredTemplateOccurrenceRole === 'named_parameter_value'
    && candidate.requiredTemplateParameter
    && candidate.semanticClass === 'structurally_qualified_page_subject_declaration_candidate'
  );
  return {
    policyId: policy.policy || null,
    candidateRuleValid,
    invalidRules: required.filter(rule => policy.rules?.[rule] !== true),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function routeMatches(record, policy) {
  const evidence = record.canonicalActivitySubjectDeclarationStructuralContextEvidence || {};
  const observations = record.canonicalActivitySubjectDeclarationStructuralContextObservations || {};
  const review = record.canonicalActivitySubjectDeclarationReview || {};
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && evidence.evidenceState === 'complete_revision_pinned_subject_declaration_structural_context_evidence_packet'
    && observations.deficiencies?.length === 0
    && observations.canonicalActivitySubjectDeclarationVerdict === null
    && observations.canonicalActivityScopeVerdict === null
    && observations.repeatabilityVerdict === null
    && review.state === 'unreviewed_structural_context_evidence_collected_semantic_disposition_required'
    && review.canonicalActivitySubjectDeclarationVerdict === null
    && review.canonicalActivityScopeVerdict === null
    && review.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true;
}

export function selectCanonicalActivitySubjectDeclarationStructuralContextDispositionRoutes(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

function contextPackets(record = {}) {
  return record.canonicalActivitySubjectDeclarationStructuralContextEvidence?.occurrenceStructuralContextPackets || [];
}

function candidateBasis(record, packet, policy) {
  const rule = policy.subjectCandidateRule || {};
  const source = packet.sourceRevisionEvidence || {};
  const occurrence = packet.sourceExactLineOccurrence || {};
  const context = packet.structuralContext || {};
  const outermost = context.enclosingTemplates?.[0] || null;
  const role = outermost?.occurrenceRole || {};
  const label = record.canonicalActivityIdentity?.canonicalLabel || null;
  const checks = {
    completeStructuralPacket: packet.state === 'complete_revision_pinned_structural_context_evidence' && packet.deficiencies?.length === 0,
    activeSourceText: context.sourceRegionState === rule.requiredSourceRegionState,
    canonicalLabelSourceTitleEqual: Boolean(label && source.resolvedTitle && normalize(label) === normalize(source.resolvedTitle)),
    exactCanonicalLabelCase: occurrence.canonicalActivityLabelExactCaseMatch === true,
    beforeFirstHeading: context.pagePosition?.beforeFirstHeading === true,
    outermostTemplateMatches: outermost?.templateName === rule.requiredOutermostTemplate,
    occurrenceRoleMatches: role.role === rule.requiredTemplateOccurrenceRole,
    templateParameterMatches: normalize(role.parameterName) === normalize(rule.requiredTemplateParameter),
    revisionIdentityComplete: Boolean(source.sourcePageId && source.sourceRevision && source.sourceTimestamp && source.sourceUrl && source.sourceContentHash),
    exactOccurrenceRevalidated: packet.exactOccurrenceRevalidation
      && Object.entries(packet.exactOccurrenceRevalidation).filter(([key]) => key.endsWith('Match') || key.endsWith('Matches')).every(([, value]) => value === true)
  };
  return { checks, qualifies: Object.values(checks).every(Boolean), label, source, occurrence, context, outermost };
}

function evidenceUseClass(record, packet, policy) {
  const basis = candidateBasis(record, packet, policy);
  const sourceTitleAligned = basis.checks.canonicalLabelSourceTitleEqual;
  const active = basis.context.sourceRegionState === 'active_source_text';
  const linkContained = Boolean(basis.context.enclosingLinks?.length);
  if (!active) return { evidenceUseClass: 'protected_or_mixed_occurrence_non_supporting', basis };
  if (basis.qualifies) return { evidenceUseClass: policy.subjectCandidateRule.semanticClass, basis };
  if (sourceTitleAligned) return { evidenceUseClass: 'title_aligned_supporting_occurrence_not_subject_binding_evidence', basis };
  if (linkContained) return { evidenceUseClass: 'cross_page_link_reference_not_subject_binding_evidence', basis };
  return { evidenceUseClass: 'cross_page_unlinked_mention_not_subject_binding_evidence', basis };
}

function signal(record, packet, policy) {
  const classified = evidenceUseClass(record, packet, policy);
  const candidate = classified.basis.qualifies;
  return {
    evidenceKey: `${packet.occurrenceKey}:structural-semantic-disposition-v1`,
    occurrenceKey: packet.occurrenceKey,
    structuralContextEvidenceKey: packet.structuralContextEvidenceKey,
    evidenceUseClass: classified.evidenceUseClass,
    subjectCandidateRuleKey: candidate ? policy.subjectCandidateRule.ruleKey : null,
    subjectCandidate: candidate,
    sourcePageIdentity: {
      sourcePageId: Number(classified.basis.source.sourcePageId || 0) || null,
      resolvedTitle: classified.basis.source.resolvedTitle || null,
      sourceRevision: String(classified.basis.source.sourceRevision || ''),
      sourceTimestamp: classified.basis.source.sourceTimestamp || null,
      sourceUrl: classified.basis.source.sourceUrl || null,
      sourceContentHash: classified.basis.source.sourceContentHash || null
    },
    sourceOccurrenceEvidence: {
      matchedText: classified.basis.occurrence.matchedText || null,
      sourceLocator: classified.basis.occurrence.sourceLocator || null,
      exactSourceLines: classified.basis.occurrence.exactSourceLines || null,
      exactSourceLinesContentHash: classified.basis.occurrence.exactSourceLinesContentHash || null
    },
    candidateChecks: classified.basis.checks,
    canonicalActivitySubjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    semanticUse: candidate
      ? 'candidate_requires_revision_pinned_activity_infobox_schema_semantics_before_subject_binding'
      : 'context_disposition_cannot_independently_bind_canonical_activity_subject'
  };
}

function aggregateDisposition(signals) {
  const candidates = signals.filter(item => item.subjectCandidate);
  const pageKeys = sorted(unique(candidates.map(item => `${item.sourcePageIdentity.sourcePageId}|${item.sourcePageIdentity.sourceRevision}`)));
  if (pageKeys.length > 1) return {
    state: 'blocked_multiple_structurally_qualified_subject_pages',
    structurallyQualifiedCandidateCount: candidates.length,
    candidatePageKeys: pageKeys,
    candidateEvidenceKeys: candidates.map(item => item.evidenceKey),
    canonicalActivitySubjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null
  };
  if (candidates.length) return {
    state: 'structurally_qualified_subject_candidate_requires_revision_pinned_schema_semantics',
    structurallyQualifiedCandidateCount: candidates.length,
    candidatePageKeys: pageKeys,
    candidateEvidenceKeys: candidates.map(item => item.evidenceKey),
    canonicalActivitySubjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null
  };
  return {
    state: 'unresolved_no_structurally_qualified_subject_declaration_candidate',
    structurallyQualifiedCandidateCount: 0,
    candidatePageKeys: [],
    candidateEvidenceKeys: [],
    canonicalActivitySubjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null
  };
}

function expectedRecord(input, policy) {
  const compiled = compileCanonicalActivitySubjectDeclarationStructuralContextDispositionPolicy(policy);
  const signals = contextPackets(input).map(packet => signal(input, packet, policy)).sort((a, b) => a.occurrenceKey.localeCompare(b.occurrenceKey));
  const disposition = aggregateDisposition(signals);
  const deficiencies = [];
  if (!input.contentHash) deficiencies.push('structural_context_evidence_content_hash_missing');
  if (!routeMatches(input, policy)) deficiencies.push('input_does_not_match_complete_structural_context_evidence_state');
  if (!signals.length) deficiencies.push('structural_context_evidence_contains_no_occurrences');
  if (duplicates(signals.map(item => item.occurrenceKey)).length) deficiencies.push('duplicate_structural_context_disposition_occurrence_key');
  if (!compiled.candidateRuleValid || compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) deficiencies.push('canonical_activity_subject_declaration_structural_context_disposition_policy_invalid_or_activity_specific');
  const blockers = [];
  if (disposition.state === 'unresolved_no_structurally_qualified_subject_declaration_candidate') blockers.push('canonical_activity_subject_page_not_identified');
  if (disposition.state === 'blocked_multiple_structurally_qualified_subject_pages') blockers.push('multiple_structurally_qualified_subject_pages_require_reconciliation');
  if (disposition.state === 'structurally_qualified_subject_candidate_requires_revision_pinned_schema_semantics') blockers.push('activity_infobox_name_schema_semantics_not_revision_pinned');
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceCanonicalActivitySubjectDeclarationStructuralContextEvidenceContentHash: input.contentHash,
    canonicalActivitySubjectDeclarationStructuralDispositionSignals: signals,
    canonicalActivitySubjectDeclarationStructuralDisposition: { ...disposition, deficiencies },
    canonicalActivitySubjectBinding: null,
    canonicalActivitySubjectDeclarationReview: {
      state: deficiencies.length ? 'structural_context_disposition_blocked_incomplete' : 'structural_context_disposed_additional_evidence_required',
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: disposition.candidateEvidenceKeys
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => blocker !== 'canonical_activity_subject_declaration_structural_context_requires_semantic_disposition'),
      ...deficiencies,
      ...blockers,
      'canonical_activity_subject_binding_unresolved',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: deficiencies.length ? 'canonical_activity_subject_declaration_structural_context_disposition_blocked_incomplete' : 'canonical_activity_subject_declaration_structural_context_disposed_evidence_work_required'
  };
}

export function buildCanonicalActivitySubjectDeclarationStructuralContextDispositions({ structuralContextRecords = [], policy = {} }) {
  const inputs = selectCanonicalActivitySubjectDeclarationStructuralContextDispositionRoutes(structuralContextRecords, policy);
  const records = inputs.map(record => expectedRecord(record, policy));
  return { records, audit: auditCanonicalActivitySubjectDeclarationStructuralContextDispositions(records, { structuralContextRecords, policy }) };
}

export function auditCanonicalActivitySubjectDeclarationStructuralContextDispositions(records = [], { structuralContextRecords = [], policy = {} } = {}) {
  const inputs = selectCanonicalActivitySubjectDeclarationStructuralContextDispositionRoutes(structuralContextRecords, policy);
  const expected = inputs.map(record => expectedRecord(record, policy));
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
    return !input || record.sourceCanonicalActivitySubjectDeclarationStructuralContextEvidenceContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const dispositionMismatches = records.filter(record => {
    const target = expectedByKey.get(record.memberCandidateKey);
    return !target
      || JSON.stringify(record.canonicalActivitySubjectDeclarationStructuralDispositionSignals) !== JSON.stringify(target.canonicalActivitySubjectDeclarationStructuralDispositionSignals)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationStructuralDisposition) !== JSON.stringify(target.canonicalActivitySubjectDeclarationStructuralDisposition);
  }).map(record => record.memberCandidateKey);
  const inputOccurrenceKeys = inputs.flatMap(record => contextPackets(record).map(packet => packet.occurrenceKey));
  const outputSignals = records.flatMap(record => record.canonicalActivitySubjectDeclarationStructuralDispositionSignals || []);
  const outputOccurrenceKeys = outputSignals.map(item => item.occurrenceKey);
  const missingOccurrenceKeys = inputOccurrenceKeys.filter(key => !outputOccurrenceKeys.includes(key));
  const unexpectedOccurrenceKeys = outputOccurrenceKeys.filter(key => !inputOccurrenceKeys.includes(key));
  const invalidEvidenceUseClasses = outputSignals.filter(item => ![
    'structurally_qualified_page_subject_declaration_candidate',
    'title_aligned_supporting_occurrence_not_subject_binding_evidence',
    'cross_page_link_reference_not_subject_binding_evidence',
    'cross_page_unlinked_mention_not_subject_binding_evidence',
    'protected_or_mixed_occurrence_non_supporting'
  ].includes(item.evidenceUseClass)).map(item => item.occurrenceKey);
  const compiled = compileCanonicalActivitySubjectDeclarationStructuralContextDispositionPolicy(policy);
  const incompleteRecords = records.filter(record => record.canonicalActivitySubjectDeclarationStructuralDisposition?.deficiencies?.length).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const signals = record.canonicalActivitySubjectDeclarationStructuralDispositionSignals || [];
    return !input
      || record.canonicalActivitySubjectBinding !== null
      || record.canonicalActivitySubjectDeclarationStructuralDisposition?.canonicalActivitySubjectDeclarationVerdict !== null
      || record.canonicalActivitySubjectDeclarationStructuralDisposition?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationStructuralDisposition?.repeatabilityVerdict !== null
      || signals.some(item => item.canonicalActivitySubjectDeclarationVerdict !== null || item.canonicalActivityScopeVerdict !== null || item.repeatabilityVerdict !== null)
      || record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structural = [];
  if (!expectedKeys.length) structural.push('no_complete_structural_context_evidence_inputs');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structural.push('input_and_output_structural_context_disposition_record_sets_do_not_match_exactly');
  if (contextMismatches.length) structural.push('upstream_evidence_identity_occurrences_or_reviews_changed');
  if (dispositionMismatches.length) structural.push('one_or_more_structural_context_dispositions_not_reproducible');
  if (missingOccurrenceKeys.length || unexpectedOccurrenceKeys.length || duplicates(inputOccurrenceKeys).length || duplicates(outputOccurrenceKeys).length) structural.push('structural_context_and_disposition_occurrence_sets_do_not_match');
  if (invalidEvidenceUseClasses.length) structural.push('one_or_more_structural_context_dispositions_have_invalid_evidence_use_class');
  if (!compiled.candidateRuleValid || compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) structural.push('canonical_activity_subject_declaration_structural_context_disposition_policy_invalid_or_activity_specific');
  if (incompleteRecords.length) structural.push('one_or_more_structural_context_disposition_records_incomplete');
  if (unsupportedPromotions.length) structural.push('structural_context_disposition_created_unsupported_semantic_or_downstream_promotion');
  if (accountStateFindings.length) structural.push('account_query_state_baked_into_subject_declaration_structural_context_disposition');
  const attemptComplete = expectedKeys.length > 0 && inputOccurrenceKeys.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length
    && !missingOccurrenceKeys.length && !unexpectedOccurrenceKeys.length && !duplicates(inputOccurrenceKeys).length && !duplicates(outputOccurrenceKeys).length;
  const complete = attemptComplete && !structural.length;
  const classCounts = {};
  for (const item of outputSignals) classCounts[item.evidenceUseClass] = (classCounts[item.evidenceUseClass] || 0) + 1;
  const candidates = outputSignals.filter(item => item.subjectCandidate);
  const candidateRecords = records.filter(record => record.canonicalActivitySubjectDeclarationStructuralDisposition?.structurallyQualifiedCandidateCount > 0);
  const noCandidateRecords = records.filter(record => record.canonicalActivitySubjectDeclarationStructuralDisposition?.state === 'unresolved_no_structurally_qualified_subject_declaration_candidate');
  const conflictRecords = records.filter(record => record.canonicalActivitySubjectDeclarationStructuralDisposition?.state === 'blocked_multiple_structurally_qualified_subject_pages');
  return {
    contract: policy.auditContract,
    accountIndependent: !accountStateFindings.length,
    inputCoverage: { expectedRecordCount: expectedKeys.length, outputRecordCount: records.length, duplicateInputMemberCandidateKeys: duplicateInputKeys, duplicateOutputMemberCandidateKeys: duplicateOutputKeys, missingMemberCandidateKeys: missingKeys, unexpectedMemberCandidateKeys: unexpectedKeys, contextMismatchMemberCandidateKeys: contextMismatches },
    policyCoverage: compiled,
    occurrenceDispositionCoverage: { inputStructuralContextOccurrenceCount: inputOccurrenceKeys.length, outputOccurrenceDispositionCount: outputOccurrenceKeys.length, missingOccurrenceKeys, unexpectedOccurrenceKeys, duplicateInputOccurrenceKeys: duplicates(inputOccurrenceKeys), duplicateOutputOccurrenceKeys: duplicates(outputOccurrenceKeys), invalidEvidenceUseClassOccurrenceKeys: invalidEvidenceUseClasses, dispositionMismatchMemberCandidateKeys: dispositionMismatches, evidenceUseClassCounts: classCounts },
    subjectCandidateCoverage: { structurallyQualifiedCandidateCount: candidates.length, recordsWithStructurallyQualifiedCandidateCount: candidateRecords.length, recordsWithoutStructurallyQualifiedCandidateCount: noCandidateRecords.length, conflictingCandidateRecordCount: conflictRecords.length, candidateEvidenceKeys: candidates.map(item => item.evidenceKey), canonicalActivitySubjectBindingCount: records.filter(record => record.canonicalActivitySubjectBinding !== null).length, schemaSemanticsRevisionPinned: false },
    semanticPromotionCoverage: { unsupportedPromotionMemberCandidateKeys: unsupportedPromotions, canonicalActivitySubjectDeclarationVerdictCount: 0, canonicalActivityScopeClassificationCount: 0, repeatabilityClassificationCount: 0, memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length, mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length, optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length },
    incompleteRecordMemberCandidateKeys: incompleteRecords,
    accountStateFindings,
    structuralContextDispositionAttemptCoverageComplete: attemptComplete,
    canonicalActivitySubjectDeclarationStructuralContextDispositionCoverageComplete: complete,
    canonicalActivitySubjectBindingReviewComplete: false,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structural, 'canonical_activity_subject_declaration_semantic_evidence_work_required', 'canonical_activity_subject_binding_unresolved', 'canonical_activity_scope_review_incomplete', 'repeatability_classification_unresolved', 'member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable: complete
  };
}
