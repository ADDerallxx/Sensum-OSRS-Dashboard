import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceActivityInfoboxSchemaSemanticsEvidenceContentHash',
  'canonicalActivitySubjectDeclarationDisposition',
  'canonicalActivitySubjectBinding',
  'canonicalActivitySubjectDeclarationReview',
  'activityInfoboxSchemaSemanticsReview'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileActivityInfoboxSchemaSemanticsDispositionPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneDispositionPerCompleteSchemaEvidencePacket',
    'subjectBindingRequiresTheCompleteStructuralAndSchemaEvidenceChain',
    'subjectBindingRequiresExactlyOneQualifiedCandidatePage',
    'subjectBindingRequiresEveryStructuralCheckAndSchemaObservation',
    'candidatePageIdentityRevisionTitleAndOccurrenceMustRemainAligned',
    'schemaEvidenceMeaningIsAppliedOnlyToTheExactQualifiedInfoboxOccurrence',
    'subjectBindingIsAnExplicitAuditableSemanticDisposition',
    'subjectBindingDoesNotClassifyActivityScopeOrRepeatability',
    'subjectBindingDoesNotCompleteMemberExpansionOrMechanics',
    'subjectBindingDoesNotCreateOptimizerCandidates',
    'missingChangedDuplicateContradictoryOrConditionMismatchedEvidenceRemainsBlocked',
    'activityNamesLabelsPageIdsCandidateKeysAliasesCollectionClassesAndOverridesAreForbidden',
    'upstreamEvidenceIdentityRevisionHashesStructuralSignalsAndContextMustBePreserved',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const rule = policy.subjectBindingRule || {};
  const invalidBindingRule = [];
  if (!rule.ruleKey || !rule.requiredStructuralDispositionState || rule.requiredCandidateCount !== 1 || !rule.bindingClass || !rule.verdict) invalidBindingRule.push('binding_rule_identity_or_cardinality_invalid');
  if (!Array.isArray(rule.requiredCandidateChecks) || !rule.requiredCandidateChecks.length || duplicates(rule.requiredCandidateChecks).length) invalidBindingRule.push('required_candidate_checks_invalid');
  if (!Array.isArray(rule.requiredSchemaObservations) || !rule.requiredSchemaObservations.length || duplicates(rule.requiredSchemaObservations).length) invalidBindingRule.push('required_schema_observations_invalid');
  return {
    policyId: policy.policy || null,
    invalidRules,
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidBindingRule,
    bindingRule: rule
  };
}

export function selectActivityInfoboxSchemaSemanticsDispositionInputs(records = [], policy = {}) {
  return records.filter(record => record.contract === policy.inputContract
    && record.state === policy.inputState
    && record.activityInfoboxSchemaSemanticsEvidence?.evidenceState === policy.requiredEvidenceState
    && record.activityInfoboxSchemaSemanticsReview?.state === 'unreviewed_complete_schema_evidence_semantic_disposition_required'
    && record.canonicalActivitySubjectBinding === null
    && record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict === null
    && record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict === null
    && record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true);
}

function bindingBasis(input, compiled) {
  const rule = compiled.bindingRule;
  const disposition = input.canonicalActivitySubjectDeclarationStructuralDisposition || {};
  const candidates = (input.canonicalActivitySubjectDeclarationStructuralDispositionSignals || []).filter(signal => signal.subjectCandidate === true);
  const candidate = candidates[0] || null;
  const observations = input.activityInfoboxSchemaSemanticsEvidence?.observations || [];
  const observationByKey = new Map(observations.map(observation => [observation.observationKey, observation]));
  const requiredCandidateChecks = Object.fromEntries((rule.requiredCandidateChecks || []).map(check => [check, candidate?.candidateChecks?.[check] === true]));
  const requiredSchemaObservations = Object.fromEntries((rule.requiredSchemaObservations || []).map(key => [key, observationByKey.get(key)?.exactSingleOccurrence === true]));
  const pageIdentity = candidate?.sourcePageIdentity || {};
  const occurrence = candidate?.sourceOccurrenceEvidence || {};
  const canonicalLabel = input.canonicalActivityIdentity?.canonicalLabel || null;
  const candidatePageKey = `${pageIdentity.sourcePageId || ''}|${pageIdentity.sourceRevision || ''}`;
  const sourceRows = input.schemaEvidenceSources || [];
  const checks = {
    structuralDispositionStateMatches: disposition.state === rule.requiredStructuralDispositionState,
    exactlyOneQualifiedCandidateSignal: candidates.length === rule.requiredCandidateCount,
    exactlyOneCandidatePageKey: disposition.candidatePageKeys?.length === rule.requiredCandidateCount,
    candidatePageIdentityMatchesDisposition: disposition.candidatePageKeys?.[0] === candidatePageKey,
    candidateEvidenceKeyMatchesDisposition: disposition.candidateEvidenceKeys?.length === 1 && disposition.candidateEvidenceKeys[0] === candidate?.evidenceKey,
    canonicalLabelPresent: Boolean(canonicalLabel),
    candidateTitleMatchesCanonicalLabel: Boolean(canonicalLabel && pageIdentity.resolvedTitle && normalize(canonicalLabel) === normalize(pageIdentity.resolvedTitle)),
    candidateOccurrenceMatchesCanonicalLabel: Boolean(canonicalLabel && occurrence.matchedText === canonicalLabel),
    candidatePageRevisionProvenanceComplete: Boolean(pageIdentity.sourcePageId && pageIdentity.sourceRevision && pageIdentity.sourceTimestamp && pageIdentity.sourceUrl && pageIdentity.sourceContentHash),
    schemaEvidenceStateComplete: input.activityInfoboxSchemaSemanticsEvidence?.evidenceState === 'complete_revision_pinned_activity_infobox_schema_semantics_evidence_packet',
    schemaSourcesComplete: sourceRows.length > 0 && sourceRows.every(source => source.state === 'complete_revision_pinned_schema_source_evidence'
      && source.sourcePageId && source.sourceRevision && source.sourceTimestamp && source.sourceUrl && source.sourceContentHash),
    allRequiredCandidateChecksTrue: Object.values(requiredCandidateChecks).every(Boolean),
    allRequiredSchemaObservationsExactOnce: Object.values(requiredSchemaObservations).every(Boolean),
    exactRequiredSchemaObservationSet: observations.length === (rule.requiredSchemaObservations || []).length
      && observations.every(observation => (rule.requiredSchemaObservations || []).includes(observation.observationKey))
  };
  return {
    sufficient: Object.values(checks).every(Boolean),
    checks,
    requiredCandidateChecks,
    requiredSchemaObservations,
    candidate,
    canonicalLabel,
    sourceRows,
    deficiencies: Object.entries(checks).filter(([, passed]) => !passed).map(([check]) => check)
  };
}

function subjectBinding(input, basis, compiled) {
  if (!basis.sufficient) return null;
  const candidate = basis.candidate;
  return {
    bindingClass: compiled.bindingRule.bindingClass,
    ruleKey: compiled.bindingRule.ruleKey,
    canonicalActivityKey: input.canonicalActivityIdentity.canonicalActivityKey,
    canonicalActivityLabel: basis.canonicalLabel,
    sourcePageIdentity: candidate.sourcePageIdentity,
    sourceOccurrenceEvidence: candidate.sourceOccurrenceEvidence,
    structuralEvidenceKey: candidate.evidenceKey,
    schemaEvidenceKeys: input.activityInfoboxSchemaSemanticsReview.evidenceKeys,
    evidenceRevisionBoundary: {
      subjectSourceRevision: candidate.sourcePageIdentity.sourceRevision,
      schemaSources: basis.sourceRows.map(source => ({ sourceKey: source.sourceKey, sourcePageId: source.sourcePageId, sourceRevision: source.sourceRevision, sourceContentHash: source.sourceContentHash }))
    },
    verdict: compiled.bindingRule.verdict,
    accountIndependent: true
  };
}

function expectedRecord(input, policy) {
  const compiled = compileActivityInfoboxSchemaSemanticsDispositionPolicy(policy);
  const basis = bindingBasis(input, compiled);
  const binding = subjectBinding(input, basis, compiled);
  const evidenceKeys = binding ? [binding.structuralEvidenceKey, ...binding.schemaEvidenceKeys] : [];
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceActivityInfoboxSchemaSemanticsEvidenceContentHash: input.contentHash,
    canonicalActivitySubjectDeclarationDisposition: {
      state: binding ? 'source_supported_canonical_activity_subject_binding' : 'blocked_incomplete_or_inconsistent_subject_binding_evidence',
      verdict: binding ? compiled.bindingRule.verdict : null,
      bindingClass: binding ? compiled.bindingRule.bindingClass : null,
      evidenceKeys,
      sufficiencyChecks: basis.checks,
      requiredCandidateChecks: basis.requiredCandidateChecks,
      requiredSchemaObservations: basis.requiredSchemaObservations,
      deficiencies: basis.deficiencies,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivitySubjectBinding: binding,
    canonicalActivitySubjectDeclarationReview: {
      state: binding ? 'reviewed_source_supported_canonical_activity_subject_binding' : 'reviewed_blocked_incomplete_or_inconsistent_evidence',
      canonicalActivitySubjectDeclarationVerdict: binding ? compiled.bindingRule.verdict : null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys
    },
    activityInfoboxSchemaSemanticsReview: {
      state: binding ? 'reviewed_schema_semantics_support_exact_structural_subject_binding' : 'reviewed_blocked_incomplete_or_inconsistent_evidence',
      canonicalActivitySubjectDeclarationVerdict: binding ? compiled.bindingRule.verdict : null,
      canonicalActivitySubjectBinding: binding,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => ![
        'activity_infobox_schema_evidence_requires_semantic_disposition',
        'schema_evidence_does_not_independently_bind_canonical_activity_subject',
        'canonical_activity_subject_binding_unresolved'
      ].includes(blocker)),
      ...basis.deficiencies.map(deficiency => `subject_binding_sufficiency_failed:${deficiency}`),
      ...(binding ? [] : ['canonical_activity_subject_binding_unresolved']),
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: binding
      ? 'canonical_activity_subject_declaration_source_supported_scope_and_repeatability_unresolved'
      : 'canonical_activity_subject_declaration_disposition_blocked_incomplete_or_inconsistent_evidence'
  };
}

export function buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords = [], policy = {} }) {
  const inputs = selectActivityInfoboxSchemaSemanticsDispositionInputs(evidenceRecords, policy);
  const records = inputs.map(input => expectedRecord(input, policy));
  return { records, audit: auditActivityInfoboxSchemaSemanticsDispositions(records, { evidenceRecords, policy }) };
}

export function auditActivityInfoboxSchemaSemanticsDispositions(records = [], { evidenceRecords = [], policy = {} } = {}) {
  const compiled = compileActivityInfoboxSchemaSemanticsDispositionPolicy(policy);
  const inputs = selectActivityInfoboxSchemaSemanticsDispositionInputs(evidenceRecords, policy);
  const expected = inputs.map(input => expectedRecord(input, policy));
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
    return !input || record.sourceActivityInfoboxSchemaSemanticsEvidenceContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const dispositionMismatches = records.filter(record => {
    const expectedRecordValue = expectedByKey.get(record.memberCandidateKey);
    return !expectedRecordValue
      || JSON.stringify(record.canonicalActivitySubjectDeclarationDisposition) !== JSON.stringify(expectedRecordValue.canonicalActivitySubjectDeclarationDisposition)
      || JSON.stringify(record.canonicalActivitySubjectBinding) !== JSON.stringify(expectedRecordValue.canonicalActivitySubjectBinding)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationReview) !== JSON.stringify(expectedRecordValue.canonicalActivitySubjectDeclarationReview)
      || JSON.stringify(record.activityInfoboxSchemaSemanticsReview) !== JSON.stringify(expectedRecordValue.activityInfoboxSchemaSemanticsReview);
  }).map(record => record.memberCandidateKey);
  const invalidInputs = inputs.filter(input => !bindingBasis(input, compiled).sufficient).map(input => input.memberCandidateKey);
  const supportedBindings = records.filter(record => record.canonicalActivitySubjectDeclarationDisposition?.state === 'source_supported_canonical_activity_subject_binding');
  const invalidBindings = supportedBindings.filter(record => !record.canonicalActivitySubjectBinding
    || record.canonicalActivitySubjectDeclarationDisposition?.verdict !== compiled.bindingRule.verdict
    || record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== compiled.bindingRule.verdict
    || record.activityInfoboxSchemaSemanticsReview?.canonicalActivitySubjectDeclarationVerdict !== compiled.bindingRule.verdict).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || record.canonicalActivitySubjectDeclarationDisposition?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationDisposition?.repeatabilityVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null
      || record.activityInfoboxSchemaSemanticsReview?.canonicalActivityScopeVerdict !== null
      || record.activityInfoboxSchemaSemanticsReview?.repeatabilityVerdict !== null
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_complete_activity_infobox_schema_semantics_evidence_packets');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_schema_evidence_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_upstream_evidence_identity_revision_hash_structural_signal_or_context_values_changed');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.invalidBindingRule.length) structuralBlockers.push('activity_infobox_schema_semantics_disposition_policy_invalid_or_activity_specific');
  if (invalidInputs.length) structuralBlockers.push('one_or_more_schema_evidence_inputs_fail_subject_binding_sufficiency');
  if (dispositionMismatches.length || invalidBindings.length) structuralBlockers.push('one_or_more_subject_binding_dispositions_do_not_match_policy');
  if (downstreamPromotions.length) structuralBlockers.push('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_activity_infobox_schema_semantics_disposition');
  const dispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const bindingReviewComplete = dispositionAttemptCoverageComplete && supportedBindings.length === expectedKeys.length;
  return {
    contract: policy.auditContract,
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedEvidenceRecordCount: expectedKeys.length,
      dispositionRecordCount: records.length,
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
      invalidBindingRule: compiled.invalidBindingRule,
      requiredCandidateCheckCount: compiled.bindingRule.requiredCandidateChecks?.length || 0,
      requiredSchemaObservationCount: compiled.bindingRule.requiredSchemaObservations?.length || 0
    },
    bindingCoverage: {
      structurallyAndSemanticallySufficientInputCount: expectedKeys.length - invalidInputs.length,
      insufficientInputMemberCandidateKeys: invalidInputs,
      sourceSupportedBindingCount: supportedBindings.length,
      blockedBindingCount: records.length - supportedBindings.length,
      invalidBindingMemberCandidateKeys: invalidBindings,
      dispositionMismatchMemberCandidateKeys: dispositionMismatches,
      bindingClasses: Object.fromEntries(supportedBindings.map(record => [record.memberCandidateKey, record.canonicalActivitySubjectBinding.bindingClass]))
    },
    semanticPromotionCoverage: {
      canonicalActivitySubjectBindingCount: records.filter(record => record.canonicalActivitySubjectBinding !== null).length,
      canonicalActivitySubjectDeclarationVerdictCount: records.filter(record => record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== null).length,
      canonicalActivityScopeClassificationCount: records.filter(record => record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedDownstreamPromotionMemberCandidateKeys: downstreamPromotions
    },
    accountStateFindings,
    dispositionAttemptCoverageComplete,
    canonicalActivitySubjectBindingReviewComplete: bindingReviewComplete,
    canonicalActivityScopeReviewComplete: false,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(bindingReviewComplete ? [] : ['canonical_activity_subject_binding_review_incomplete']),
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: dispositionAttemptCoverageComplete
  };
}
