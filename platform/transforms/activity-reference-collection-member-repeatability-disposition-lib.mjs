import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const supportedSignalKinds = new Set([
  'explicit_positive_repeatability_declaration_candidate',
  'explicit_negative_repeatability_declaration_candidate'
]);
const supportedClassifications = new Set(['repeatable', 'non_repeatable']);
const supportedScopeProofKinds = new Set([
  'linked_source_role_declaration_overlap',
  'collection_activity_narrative_cell_overlap'
]);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceRepeatabilityEvidenceContentHash',
  'repeatabilityDispositionSignals', 'repeatabilityDisposition',
  'repeatabilityReview', 'memberExpansionReview', 'mechanicsReview',
  'optimizerEligible', 'accountIndependent'
]);

function preservedInput(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !stageFields.has(key)));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileRepeatabilityDispositionPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneDispositionPerCompleteRepeatabilityEvidencePacket',
    'supportedClassificationRequiresAnExplicitDeclaration',
    'explicitDeclarationMustBeScopedByAReviewedSourceRoleOrCollectionNarrative',
    'sourcePageRevisionHashAndLocatorMustAlign',
    'recurrenceAndSessionSignalsCannotSupportRepeatability',
    'absenceOfSignalsCannotSupportNonRepeatability',
    'unscopedExplicitDeclarationsRemainUnresolved',
    'opposingExplicitDeclarationsRemainAConflict',
    'labelsTitlesPageIdsAliasesAndCollectionClassesCannotSelectADisposition',
    'unresolvedEvidenceRemainsExplicitAndPublishable',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  const dispositionRules = policy.dispositionRules || [];
  const duplicateRuleKeys = duplicates(dispositionRules.map(rule => rule.ruleKey));
  const invalidRuleKeys = dispositionRules.filter(rule =>
    !rule.ruleKey || !supportedSignalKinds.has(rule.requiredSignalKind)
    || !supportedClassifications.has(rule.classification) || !rule.dispositionState
    || !Array.isArray(rule.acceptedScopeProofKinds) || !rule.acceptedScopeProofKinds.length
    || rule.acceptedScopeProofKinds.some(kind => !supportedScopeProofKinds.has(kind))
  ).map(rule => rule.ruleKey || '(missing)');
  const requiredClassificationsMissing = [...supportedClassifications].filter(classification =>
    !dispositionRules.some(rule => rule.classification === classification)
  );
  return {
    policyId: policy.policy || null,
    invalidRules,
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    duplicateRuleKeys,
    invalidRuleKeys: unique(invalidRuleKeys),
    requiredClassificationsMissing,
    dispositionRules
  };
}

const overlaps = (left, right) => Boolean(left && right
  && Number(left.lineStart) <= Number(right.lineEnd)
  && Number(right.lineStart) <= Number(left.lineEnd));
const includesText = (container, fragment) => String(container || '').toLocaleLowerCase('en').includes(String(fragment || '').toLocaleLowerCase('en'));

function linkedSourceScopeProofs(record, signal) {
  if (signal.sourceScope !== 'complete_linked_source_revision') return [];
  const relationship = record.canonicalActivityIdentityEvidence?.linkedSubjectRelationship || {};
  if (relationship.relationshipDisposition?.state !== 'source_supported_linked_subject_relationship'
    || relationship.review?.state !== 'reviewed_source_supported') return [];
  const proofs = [];
  for (const sourceRoleSignal of relationship.sourceRoleDispositionSignals || []) {
    if (Number(sourceRoleSignal.sourcePageId) !== Number(signal.sourcePageId)
      || String(sourceRoleSignal.sourceRevision || '') !== String(signal.sourceRevision || '')
      || sourceRoleSignal.sourceContentHash !== signal.sourceContentHash) continue;
    for (const declaration of sourceRoleSignal.matchedDeclarations || []) {
      if (!overlaps(signal.sourceLocator, declaration.sourceLocator)) continue;
      if (!includesText(declaration.rawText || declaration.plainText, signal.matchedText)) continue;
      proofs.push({
        scopeProofKind: 'linked_source_role_declaration_overlap',
        sourceRoleSignalEvidenceKey: sourceRoleSignal.evidenceKey,
        sourceRoleRuleKey: sourceRoleSignal.ruleKey,
        sourceRoleRelationshipClass: sourceRoleSignal.relationshipClass,
        matchedDeclaration: declaration
      });
    }
  }
  return proofs;
}

function collectionNarrativeScopeProofs(record, signal) {
  if (signal.sourceScope !== 'exact_collection_row') return [];
  const collection = record.canonicalActivityIdentityEvidence?.collectionDefinition || {};
  const source = collection.collectionSource || {};
  if (Number(source.pageId) !== Number(signal.sourcePageId)
    || String(source.revision || '') !== String(signal.sourceRevision || '')
    || source.contentHash !== signal.sourceContentHash) return [];
  const proofs = [];
  for (const [index, cell] of (collection.narrativeCellEvidence || []).entries()) {
    if (!overlaps(signal.sourceLocator, cell.sourceLocator)) continue;
    if (!includesText(cell.rawValue || cell.plainText, signal.matchedText)) continue;
    proofs.push({
      scopeProofKind: 'collection_activity_narrative_cell_overlap',
      collectionNarrativeEvidenceKey: `${record.memberCandidateKey}:collection-narrative:${index + 1}`,
      matchedNarrativeCell: cell
    });
  }
  return proofs;
}

function scopedDispositionSignals(record, compiled) {
  const signals = [];
  for (const candidate of record.repeatabilityEvidence?.sourceLocatedSignals || []) {
    const rules = compiled.dispositionRules.filter(rule => rule.requiredSignalKind === candidate.signalKind);
    const proofs = [...linkedSourceScopeProofs(record, candidate), ...collectionNarrativeScopeProofs(record, candidate)];
    for (const rule of rules) for (const [index, proof] of proofs.entries()) {
      if (!rule.acceptedScopeProofKinds.includes(proof.scopeProofKind)) continue;
      signals.push({
        evidenceKey: `${candidate.evidenceKey}:disposition:${rule.ruleKey}:${index + 1}`,
        ruleKey: rule.ruleKey,
        signalKind: 'exact_source_scoped_repeatability_declaration',
        classification: rule.classification,
        dispositionState: rule.dispositionState,
        canonicalActivityKey: record.canonicalActivityIdentity?.canonicalActivityKey || null,
        sourceRepeatabilityEvidenceKey: candidate.evidenceKey,
        sourceDeclaration: candidate,
        scopeProof: proof
      });
    }
  }
  return signals;
}

function expectedDisposition(record, compiled, signals) {
  const candidates = record.repeatabilityEvidence?.sourceLocatedSignals || [];
  const positives = candidates.filter(signal => signal.signalKind === 'explicit_positive_repeatability_declaration_candidate');
  const negatives = candidates.filter(signal => signal.signalKind === 'explicit_negative_repeatability_declaration_candidate');
  const structural = candidates.filter(signal => ['recurrence_structure_candidate', 'session_boundary_candidate'].includes(signal.signalKind));
  const scopedPositive = signals.filter(signal => signal.classification === 'repeatable');
  const scopedNegative = signals.filter(signal => signal.classification === 'non_repeatable');
  let state;
  let classification = null;
  let deficiencies = [];
  if (record.repeatabilityEvidence?.evidenceState !== 'complete_revision_pinned_repeatability_review_packet'
    || record.repeatabilityCandidateObservations?.deficiencies?.length) {
    state = 'unresolved_incomplete_repeatability_evidence';
    deficiencies = unique(record.repeatabilityCandidateObservations?.deficiencies?.length
      ? record.repeatabilityCandidateObservations.deficiencies
      : ['repeatability_evidence_packet_not_complete']);
  } else if (positives.length && negatives.length) {
    state = 'blocked_conflicting_explicit_repeatability_declarations';
    deficiencies = ['opposing_explicit_repeatability_declarations_require_scope_reconciliation'];
  } else if (scopedPositive.length && !negatives.length) {
    state = 'source_supported_repeatable_activity';
    classification = 'repeatable';
  } else if (scopedNegative.length && !positives.length) {
    state = 'source_supported_non_repeatable_activity';
    classification = 'non_repeatable';
  } else if (positives.length || negatives.length) {
    state = 'unresolved_explicit_repeatability_declaration_scope_not_established';
    deficiencies = ['explicit_repeatability_declaration_not_scoped_to_canonical_activity'];
  } else if (structural.length) {
    state = 'unresolved_recurrence_or_session_structure_without_explicit_declaration';
    deficiencies = ['recurrence_or_session_structure_is_not_explicit_repeatability_evidence'];
  } else {
    state = 'unresolved_no_explicit_repeatability_evidence';
    deficiencies = ['explicit_repeatability_declaration_not_observed'];
  }
  const evidenceKeys = unique((classification ? signals : candidates).flatMap(signal => [
    signal.evidenceKey,
    signal.sourceRepeatabilityEvidenceKey,
    signal.scopeProof?.sourceRoleSignalEvidenceKey,
    signal.scopeProof?.collectionNarrativeEvidenceKey
  ]).filter(Boolean));
  return { state, classification, evidenceKeys, deficiencies };
}

function expectedReview(disposition) {
  return disposition.classification
    ? { state: 'reviewed_source_supported', classification: disposition.classification, evidenceKeys: disposition.evidenceKeys }
    : { state: 'reviewed_blocked', classification: null, evidenceKeys: disposition.evidenceKeys };
}

function expectedRecord(input, policy) {
  const compiled = compileRepeatabilityDispositionPolicy(policy);
  const signals = scopedDispositionSignals(input, compiled);
  const disposition = expectedDisposition(input, compiled, signals);
  const review = expectedReview(disposition);
  const blockers = [...disposition.deficiencies];
  if (!disposition.classification) blockers.push('repeatability_classification_unresolved');
  blockers.push(
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'optimizer_eligibility_blocked'
  );
  return {
    contract: policy.recordContract || 'sensum.activity-reference-collection-member-repeatability-disposition.v1',
    ...preservedInput(input),
    sourceRepeatabilityEvidenceContentHash: input.contentHash,
    repeatabilityDispositionSignals: signals,
    repeatabilityDisposition: disposition,
    repeatabilityReview: review,
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: unique(blockers),
    state: disposition.classification ? 'repeatability_source_supported_downstream_gates_closed' : 'repeatability_disposition_reviewed_unresolved'
  };
}

export function buildActivityReferenceCollectionMemberRepeatabilityDispositions({ repeatabilityEvidenceRecords = [], policy = {} }) {
  const records = repeatabilityEvidenceRecords.map(input => expectedRecord(input, policy));
  return { records, audit: auditActivityReferenceCollectionMemberRepeatabilityDispositions(records, { repeatabilityEvidenceRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberRepeatabilityDispositions(records = [], { repeatabilityEvidenceRecords = [], policy = {} } = {}) {
  const compiled = compileRepeatabilityDispositionPolicy(policy);
  const expectedKeys = repeatabilityEvidenceRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(repeatabilityEvidenceRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || output.sourceRepeatabilityEvidenceContentHash !== input.contentHash || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const structurallyInvalidInputs = repeatabilityEvidenceRecords.filter(record =>
    record.contract !== policy.inputContract || !record.contentHash || record.accountIndependent !== true
    || record.repeatabilityEvidence?.evidenceState !== 'complete_revision_pinned_repeatability_review_packet'
    || record.repeatabilityCandidateObservations?.repeatabilityVerdict !== null
    || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidDispositionRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedRecord(input, policy);
    return record.contract !== expected.contract
      || JSON.stringify(record.repeatabilityDispositionSignals) !== JSON.stringify(expected.repeatabilityDispositionSignals)
      || JSON.stringify(record.repeatabilityDisposition) !== JSON.stringify(expected.repeatabilityDisposition)
      || JSON.stringify(record.repeatabilityReview) !== JSON.stringify(expected.repeatabilityReview);
  }).map(record => record.memberCandidateKey);
  const invalidSignals = records.filter(record => (record.repeatabilityDispositionSignals || []).some(signal =>
    signal.signalKind !== 'exact_source_scoped_repeatability_declaration'
    || !supportedClassifications.has(signal.classification)
    || !signal.evidenceKey || !signal.ruleKey || !signal.canonicalActivityKey
    || !signal.sourceRepeatabilityEvidenceKey || !signal.sourceDeclaration?.sourceRevision
    || !supportedScopeProofKinds.has(signal.scopeProof?.scopeProofKind)
  )).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_repeatability_evidence_packets');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_repeatability_disposition_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_input_repeatability_evidence_packets_failed_structural_integrity');
  if (compiled.invalidRules.length || compiled.duplicateRuleKeys.length || compiled.invalidRuleKeys.length || compiled.requiredClassificationsMissing.length) structuralBlockers.push('one_or_more_repeatability_disposition_rules_invalid_duplicate_or_incomplete');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_specific_repeatability_disposition_policy_forbidden');
  if (invalidDispositionRecords.length || invalidSignals.length) structuralBlockers.push('one_or_more_repeatability_dispositions_not_supported_by_complete_generic_source_scope_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_repeatability_dispositions');
  const supportedRepeatable = records.filter(record => record.repeatabilityDisposition?.state === 'source_supported_repeatable_activity');
  const supportedNonRepeatable = records.filter(record => record.repeatabilityDisposition?.state === 'source_supported_non_repeatable_activity');
  const conflicts = records.filter(record => record.repeatabilityDisposition?.state === 'blocked_conflicting_explicit_repeatability_declarations');
  const unresolved = records.filter(record => record.repeatabilityDisposition?.state?.startsWith('unresolved_'));
  const repeatabilityDispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const repeatabilityClassificationCoverageComplete = repeatabilityDispositionAttemptCoverageComplete && !conflicts.length && !unresolved.length
    && supportedRepeatable.length + supportedNonRepeatable.length === records.length;
  const blockers = [...structuralBlockers];
  if (conflicts.length) blockers.push('one_or_more_repeatability_dispositions_conflict');
  if (unresolved.length) blockers.push('one_or_more_repeatability_classifications_remain_unresolved');
  blockers.push(
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-repeatability-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedEvidencePacketCount: expectedKeys.length,
      repeatabilityDispositionRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: structurallyInvalidInputs,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      dispositionRuleCount: compiled.dispositionRules.length,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      duplicateRuleKeys: compiled.duplicateRuleKeys,
      invalidRuleKeys: compiled.invalidRuleKeys,
      requiredClassificationsMissing: compiled.requiredClassificationsMissing,
      invalidSignalMemberCandidateKeys: invalidSignals
    },
    repeatabilityDispositionCoverage: {
      attemptedCount: records.length,
      sourceSupportedRepeatableCount: supportedRepeatable.length,
      sourceSupportedNonRepeatableCount: supportedNonRepeatable.length,
      conflictingCount: conflicts.length,
      unresolvedCount: unresolved.length,
      sourceScopedDispositionSignalCount: records.reduce((sum, record) => sum + (record.repeatabilityDispositionSignals || []).length, 0),
      linkedSourceRoleScopeProofCount: records.flatMap(record => record.repeatabilityDispositionSignals || []).filter(signal => signal.scopeProof?.scopeProofKind === 'linked_source_role_declaration_overlap').length,
      collectionNarrativeScopeProofCount: records.flatMap(record => record.repeatabilityDispositionSignals || []).filter(signal => signal.scopeProof?.scopeProofKind === 'collection_activity_narrative_cell_overlap').length,
      conflictMemberCandidateKeys: conflicts.map(record => record.memberCandidateKey),
      unresolvedMemberCandidateKeys: unresolved.map(record => record.memberCandidateKey),
      invalidDispositionMemberCandidateKeys: invalidDispositionRecords
    },
    semanticPromotionCoverage: {
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      sourceSupportedRepeatabilityReviewCount: records.filter(record => record.repeatabilityReview?.state === 'reviewed_source_supported').length,
      repeatableClassificationCount: records.filter(record => record.repeatabilityReview?.classification === 'repeatable').length,
      nonRepeatableClassificationCount: records.filter(record => record.repeatabilityReview?.classification === 'non_repeatable').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    repeatabilityDispositionAttemptCoverageComplete,
    repeatabilityClassificationCoverageComplete,
    repeatabilityReviewComplete: repeatabilityClassificationCoverageComplete,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: repeatabilityDispositionAttemptCoverageComplete
  };
}
