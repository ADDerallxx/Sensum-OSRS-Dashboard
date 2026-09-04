import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceCanonicalActivityIdentityEvidenceContentHash',
  'canonicalActivityIdentityDispositionSignals', 'canonicalActivityIdentityDisposition',
  'canonicalActivityIdentityReview', 'canonicalGameEntityIdentity', 'canonicalActivityIdentity',
  'repeatabilityReview', 'memberExpansionReview', 'mechanicsReview', 'optimizerEligible', 'accountIndependent'
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

export function compileCanonicalActivityIdentityDispositionPolicy(policy = {}) {
  const rules = [];
  const invalidRuleKeys = [];
  for (const raw of policy.identityDispositionRules || []) {
    try {
      if (!raw.ruleKey || !raw.linkedSubjectRelationshipClass || !raw.canonicalIdentityClass) throw new Error('missing_rule_field');
      rules.push({
        ruleKey: raw.ruleKey,
        linkedSubjectRelationshipClass: raw.linkedSubjectRelationshipClass,
        canonicalIdentityClass: raw.canonicalIdentityClass
      });
    } catch {
      invalidRuleKeys.push(raw?.ruleKey || `rule_${rules.length + invalidRuleKeys.length + 1}`);
    }
  }
  const requiredRules = [
    'oneDispositionPerCompleteCanonicalActivityIdentityEvidencePacket',
    'everyDispositionRequiresTheCompleteRevisionPinnedEvidenceChain',
    'stableIdentityAnchorUsesCollectionPageIdLinkedSubjectPageIdAndRelationshipClass',
    'sourceRevisionAndDisplayNamesAreEvidenceMetadataNotIdentitySelectors',
    'policyContainsNoPageIdsTitlesCandidateKeysCollectionClassesLabelsAliasesOrOverrides',
    'duplicateStableIdentityAnchorsRemainAConflict',
    'distinctCanonicalIdentityClassesRemainAConflict',
    'linkedSubjectRemainsDistinctFromCanonicalActivity',
    'canonicalGameEntityProjectionRepeatabilityMembersMechanicsAndOptimizerEligibilityRemainClosed',
    'missingContradictoryOrConditionMismatchedEvidenceRemainsExplicit',
    'currentAccountStateIsForbidden'
  ];
  return {
    policyId: policy.policy || null,
    rules,
    invalidRuleKeys: sorted(unique(invalidRuleKeys)),
    duplicateRuleKeys: sorted(duplicates((policy.identityDispositionRules || []).map(rule => rule.ruleKey).filter(Boolean))),
    missingRequiredPolicyRules: requiredRules.filter(rule => policy.rules?.[rule] !== true),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function evidenceDeficiencies(record) {
  const evidence = record.canonicalActivityIdentityEvidence || {};
  const collection = evidence.collectionDefinition || {};
  const candidate = evidence.collectionActivityCandidate || {};
  const relationship = evidence.linkedSubjectRelationship || {};
  const alignment = evidence.crossSourceAlignment || {};
  const deficiencies = [];
  if (evidence.evidenceState !== 'complete_revision_pinned_canonical_activity_identity_review_packet') deficiencies.push('canonical_activity_identity_evidence_packet_not_complete');
  if (record.canonicalActivityIdentityCandidateObservations?.deficiencies?.length) deficiencies.push('canonical_activity_identity_evidence_packet_has_deficiencies');
  if (record.canonicalActivityIdentityCandidateObservations?.canonicalActivityIdentityVerdict !== null) deficiencies.push('upstream_canonical_activity_identity_verdict_not_null');
  if (!collection.collectionSource?.pageId || !collection.collectionSource?.revision || !collection.collectionSource?.contentHash) deficiencies.push('collection_source_identity_revision_or_hash_missing');
  if (!collection.rowEvidence?.sourceLocator || !collection.memberCellEvidence?.sourceLocator) deficiencies.push('collection_row_or_label_source_locator_missing');
  if (!collection.narrativeCellEvidence?.length || collection.narrativeCellEvidence.some(cell => !cell.sourceLocator)) deficiencies.push('source_selected_collection_narrative_missing');
  if (!collection.allRowCellEvidence?.length || !collection.directRowWikilinkEvidence?.length) deficiencies.push('collection_row_cells_or_links_missing');
  if (candidate.disposition?.state !== 'source_supported_collection_activity_candidate'
    || candidate.review?.state !== 'reviewed_source_supported_candidate'
    || candidate.review?.identity?.canonicalIdentityEstablished !== false
    || !candidate.dispositionSignals?.length) deficiencies.push('collection_activity_candidate_identity_evidence_not_supported');
  if (relationship.relationshipDisposition?.state !== 'source_supported_linked_subject_relationship'
    || relationship.review?.state !== 'reviewed_source_supported'
    || relationship.review?.relationships?.length !== 1
    || relationship.review.relationships[0]?.canonicalIdentityEstablished !== false
    || !relationship.relationshipDispositionSignals?.length) deficiencies.push('linked_subject_relationship_evidence_not_supported');
  if (!relationship.sourcePage?.sourcePageId || !relationship.sourcePage?.sourceRevision || !relationship.sourcePage?.sourceContentHash) deficiencies.push('linked_source_identity_revision_or_hash_missing');
  if (!relationship.sourceRoleDispositionSignals?.length
    || relationship.sourceRoleDispositionSignals.flatMap(signal => signal.matchedDeclarations || []).length === 0) deficiencies.push('linked_source_role_declarations_missing');
  if (!alignment.memberLinkSourceTitleAlignments?.length || !alignment.stableSourceIdentityAlignments?.length) deficiencies.push('cross_source_identity_alignment_missing');
  return unique(deficiencies);
}

function stableAnchor(record) {
  const evidence = record.canonicalActivityIdentityEvidence;
  const collectionPageId = evidence?.collectionDefinition?.collectionSource?.pageId;
  const linkedSubjectPageId = evidence?.linkedSubjectRelationship?.sourcePage?.sourcePageId;
  const relationshipClass = evidence?.linkedSubjectRelationship?.relationshipDisposition?.relationshipClass;
  if (!Number.isInteger(collectionPageId) || !Number.isInteger(linkedSubjectPageId) || !relationshipClass) return null;
  return {
    canonicalActivityKey: `activity:osrs-wiki:collection-${collectionPageId}:linked-subject-${linkedSubjectPageId}:${relationshipClass}`,
    collectionPageId,
    linkedSubjectPageId,
    relationshipClass
  };
}

function candidateSignals(record, compiled) {
  const deficiencies = evidenceDeficiencies(record);
  const anchor = stableAnchor(record);
  if (deficiencies.length || !anchor) return [];
  return compiled.rules.filter(rule => rule.linkedSubjectRelationshipClass === anchor.relationshipClass).map(rule => ({
    evidenceKey: `${record.memberCandidateKey}:canonical-activity-identity:${rule.ruleKey}`,
    signalKind: 'complete_evidence_stable_collection_activity_identity_anchor',
    ruleKey: rule.ruleKey,
    canonicalIdentityClass: rule.canonicalIdentityClass,
    canonicalIdentityAnchor: anchor,
    collectionActivityIdentityEvidenceKeys: (record.canonicalActivityIdentityEvidence.collectionActivityCandidate.dispositionSignals || []).map(signal => signal.evidenceKey),
    linkedSubjectRelationshipEvidenceKeys: (record.canonicalActivityIdentityEvidence.linkedSubjectRelationship.relationshipDispositionSignals || []).map(signal => signal.evidenceKey),
    sourceRoleEvidenceKeys: (record.canonicalActivityIdentityEvidence.linkedSubjectRelationship.sourceRoleDispositionSignals || []).map(signal => signal.evidenceKey),
    evidenceState: 'canonical_activity_identity_signal_from_complete_revision_pinned_evidence'
  }));
}

function buildExpectedContexts(inputs, compiled) {
  const signalsByKey = new Map(inputs.map(record => [record.memberCandidateKey, candidateSignals(record, compiled)]));
  const anchorKeys = inputs.flatMap(record => unique(signalsByKey.get(record.memberCandidateKey).map(signal => signal.canonicalIdentityAnchor.canonicalActivityKey)));
  const duplicateAnchorKeys = new Set(duplicates(anchorKeys));
  return { signalsByKey, duplicateAnchorKeys };
}

function expectedDisposition(record, contexts) {
  const deficiencies = evidenceDeficiencies(record);
  const signals = contexts.signalsByKey.get(record.memberCandidateKey) || [];
  const anchorKeys = sorted(unique(signals.map(signal => signal.canonicalIdentityAnchor.canonicalActivityKey)));
  const identityClasses = sorted(unique(signals.map(signal => signal.canonicalIdentityClass)));
  const duplicateAnchors = anchorKeys.filter(key => contexts.duplicateAnchorKeys.has(key));
  if (deficiencies.length) return {
    signals,
    disposition: { state: 'unresolved_incomplete_canonical_activity_identity_evidence', canonicalActivityKey: null, canonicalIdentityClass: null, conflictingCanonicalIdentityClasses: [], duplicateCanonicalActivityKeys: [], evidenceKeys: [], deficiencies }
  };
  if (duplicateAnchors.length) return {
    signals,
    disposition: { state: 'blocked_duplicate_stable_canonical_activity_identity_anchor', canonicalActivityKey: null, canonicalIdentityClass: null, conflictingCanonicalIdentityClasses: identityClasses, duplicateCanonicalActivityKeys: duplicateAnchors, evidenceKeys: signals.map(signal => signal.evidenceKey), deficiencies: [] }
  };
  if (anchorKeys.length === 1 && identityClasses.length === 1) return {
    signals,
    disposition: { state: 'source_supported_canonical_activity_identity', canonicalActivityKey: anchorKeys[0], canonicalIdentityClass: identityClasses[0], conflictingCanonicalIdentityClasses: [], duplicateCanonicalActivityKeys: [], evidenceKeys: signals.map(signal => signal.evidenceKey), deficiencies: [] }
  };
  if (identityClasses.length > 1 || anchorKeys.length > 1) return {
    signals,
    disposition: { state: 'blocked_conflicting_canonical_activity_identity_signals', canonicalActivityKey: null, canonicalIdentityClass: null, conflictingCanonicalIdentityClasses: identityClasses, duplicateCanonicalActivityKeys: [], evidenceKeys: signals.map(signal => signal.evidenceKey), deficiencies: [] }
  };
  return {
    signals,
    disposition: { state: 'unresolved_no_supported_canonical_activity_identity_rule', canonicalActivityKey: null, canonicalIdentityClass: null, conflictingCanonicalIdentityClasses: [], duplicateCanonicalActivityKeys: [], evidenceKeys: [], deficiencies: [] }
  };
}

function canonicalIdentity(record, expected) {
  if (expected.disposition.state !== 'source_supported_canonical_activity_identity') return null;
  const signal = expected.signals[0];
  const evidence = record.canonicalActivityIdentityEvidence;
  return {
    canonicalActivityKey: expected.disposition.canonicalActivityKey,
    identityClass: expected.disposition.canonicalIdentityClass,
    canonicalLabel: evidence.collectionActivityCandidate.review.identity.collectionActivityLabel,
    stableIdentityAnchor: signal.canonicalIdentityAnchor,
    evidenceRevisionBoundary: {
      collectionRevision: String(evidence.collectionDefinition.collectionSource.revision),
      linkedSourceRevision: String(evidence.linkedSubjectRelationship.sourcePage.sourceRevision)
    },
    linkedSubjectIsCanonicalActivity: false,
    evidenceKeys: expected.disposition.evidenceKeys
  };
}

function expectedReview(record, expected) {
  const identity = canonicalIdentity(record, expected);
  return identity
    ? { state: 'reviewed_source_supported', identity, evidenceKeys: expected.disposition.evidenceKeys }
    : { state: 'reviewed_blocked', identity: null, evidenceKeys: expected.disposition.evidenceKeys };
}

function expectedRecord(input, policy, contexts) {
  const expected = expectedDisposition(input, contexts);
  const identity = canonicalIdentity(input, expected);
  const blockers = [];
  if (expected.disposition.state.includes('duplicate')) blockers.push('duplicate_stable_canonical_activity_identity_anchor');
  if (expected.disposition.state.includes('conflicting')) blockers.push('canonical_activity_identity_signal_conflict');
  if (expected.disposition.state.startsWith('unresolved')) blockers.push(...(expected.disposition.deficiencies.length ? expected.disposition.deficiencies : ['no_supported_canonical_activity_identity_rule']));
  blockers.push(
    'canonical_game_entity_projection_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'optimizer_eligibility_blocked'
  );
  return {
    contract: policy.recordContract || 'sensum.activity-reference-collection-member-canonical-activity-identity-disposition.v1',
    ...preservedInput(input),
    sourceCanonicalActivityIdentityEvidenceContentHash: input.contentHash,
    canonicalActivityIdentityDispositionSignals: expected.signals,
    canonicalActivityIdentityDisposition: expected.disposition,
    canonicalActivityIdentityReview: expectedReview(input, expected),
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: identity,
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: unique(blockers),
    state: identity ? 'canonical_activity_identity_supported_downstream_gates_closed' : 'canonical_activity_identity_disposition_blocked'
  };
}

export function buildActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions({ identityEvidenceRecords = [], policy = {} }) {
  const compiled = compileCanonicalActivityIdentityDispositionPolicy(policy);
  const contexts = buildExpectedContexts(identityEvidenceRecords, compiled);
  const records = identityEvidenceRecords.map(input => expectedRecord(input, policy, contexts));
  return { records, audit: auditActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions(records, { identityEvidenceRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions(records = [], { identityEvidenceRecords = [], policy = {} } = {}) {
  const compiled = compileCanonicalActivityIdentityDispositionPolicy(policy);
  const contexts = buildExpectedContexts(identityEvidenceRecords, compiled);
  const expectedKeys = identityEvidenceRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(identityEvidenceRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || output.sourceCanonicalActivityIdentityEvidenceContentHash !== input.contentHash || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const structurallyInvalidInputs = identityEvidenceRecords.filter(record =>
    record.contract !== policy.inputContract || !record.contentHash || record.accountIndependent !== true
    || record.canonicalActivityIdentityEvidence?.evidenceState !== 'complete_revision_pinned_canonical_activity_identity_review_packet'
    || record.canonicalActivityIdentityCandidateObservations?.canonicalActivityIdentityVerdict !== null
    || record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidDispositionRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedRecord(input, policy, contexts);
    return record.contract !== expected.contract
      || JSON.stringify(record.canonicalActivityIdentityDispositionSignals) !== JSON.stringify(expected.canonicalActivityIdentityDispositionSignals)
      || JSON.stringify(record.canonicalActivityIdentityDisposition) !== JSON.stringify(expected.canonicalActivityIdentityDisposition)
      || JSON.stringify(record.canonicalActivityIdentityReview) !== JSON.stringify(expected.canonicalActivityIdentityReview)
      || JSON.stringify(record.canonicalActivityIdentity) !== JSON.stringify(expected.canonicalActivityIdentity);
  }).map(record => record.memberCandidateKey);
  const invalidSignals = records.filter(record => (record.canonicalActivityIdentityDispositionSignals || []).some(signal =>
    signal.signalKind !== 'complete_evidence_stable_collection_activity_identity_anchor'
    || !signal.evidenceKey || !signal.ruleKey || !signal.canonicalIdentityClass
    || !signal.canonicalIdentityAnchor?.canonicalActivityKey
    || !signal.collectionActivityIdentityEvidenceKeys?.length
    || !signal.linkedSubjectRelationshipEvidenceKeys?.length
    || !signal.sourceRoleEvidenceKeys?.length
  )).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.canonicalGameEntityIdentity !== null
    || (record.canonicalActivityIdentity !== null && record.canonicalActivityIdentity.linkedSubjectIsCanonicalActivity !== false)
    || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_canonical_activity_identity_evidence_packets');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_canonical_activity_identity_disposition_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_input_canonical_activity_identity_evidence_packets_failed_structural_integrity');
  if (compiled.invalidRuleKeys.length || compiled.duplicateRuleKeys.length || compiled.missingRequiredPolicyRules.length) structuralBlockers.push('one_or_more_canonical_activity_identity_disposition_rules_invalid_duplicate_or_incomplete');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_class_canonical_activity_identity_disposition_policy_forbidden');
  if (invalidDispositionRecords.length || invalidSignals.length) structuralBlockers.push('one_or_more_canonical_activity_identity_dispositions_not_supported_by_complete_generic_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_linked_subject_equivalence_game_entity_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_canonical_activity_identity_dispositions');
  const supported = records.filter(record => record.canonicalActivityIdentityDisposition?.state === 'source_supported_canonical_activity_identity');
  const conflicts = records.filter(record => ['blocked_duplicate_stable_canonical_activity_identity_anchor', 'blocked_conflicting_canonical_activity_identity_signals'].includes(record.canonicalActivityIdentityDisposition?.state));
  const unresolved = records.filter(record => ['unresolved_incomplete_canonical_activity_identity_evidence', 'unresolved_no_supported_canonical_activity_identity_rule'].includes(record.canonicalActivityIdentityDisposition?.state));
  const identityClassCounts = {};
  for (const record of supported) identityClassCounts[record.canonicalActivityIdentity.identityClass] = (identityClassCounts[record.canonicalActivityIdentity.identityClass] || 0) + 1;
  const stableKeys = supported.map(record => record.canonicalActivityIdentity.canonicalActivityKey);
  const duplicateSupportedKeys = duplicates(stableKeys);
  if (duplicateSupportedKeys.length) structuralBlockers.push('supported_canonical_activity_identity_keys_not_unique');
  const identityDispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (conflicts.length) blockers.push('one_or_more_canonical_activity_identity_dispositions_conflict');
  if (unresolved.length) blockers.push('one_or_more_canonical_activity_identities_remain_unresolved');
  blockers.push(
    'canonical_game_entity_projection_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-canonical-activity-identity-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedEvidencePacketCount: expectedKeys.length,
      identityDispositionRecordCount: records.length,
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
      identityDispositionRuleCount: compiled.rules.length,
      invalidRuleKeys: compiled.invalidRuleKeys,
      duplicateRuleKeys: compiled.duplicateRuleKeys,
      missingRequiredPolicyRules: compiled.missingRequiredPolicyRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      invalidSignalMemberCandidateKeys: invalidSignals
    },
    canonicalActivityIdentityDispositionCoverage: {
      attemptedCount: records.length,
      sourceSupportedCount: supported.length,
      conflictingCount: conflicts.length,
      unresolvedCount: unresolved.length,
      identityClassCounts: Object.fromEntries(Object.entries(identityClassCounts).sort((a, b) => a[0].localeCompare(b[0]))),
      stableCanonicalActivityKeyCount: unique(stableKeys).length,
      duplicateSupportedCanonicalActivityKeys: duplicateSupportedKeys,
      genericIdentitySignalCount: records.reduce((sum, record) => sum + (record.canonicalActivityIdentityDispositionSignals || []).length, 0),
      conflictMemberCandidateKeys: conflicts.map(record => record.memberCandidateKey),
      unresolvedMemberCandidateKeys: unresolved.map(record => record.memberCandidateKey),
      invalidDispositionMemberCandidateKeys: invalidDispositionRecords
    },
    semanticPromotionCoverage: {
      canonicalActivityIdentityReviewedCount: records.filter(record => record.canonicalActivityIdentityReview?.state === 'reviewed_source_supported').length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      linkedSubjectEquatedWithCanonicalActivityCount: records.filter(record => record.canonicalActivityIdentity?.linkedSubjectIsCanonicalActivity === true).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    identityDispositionAttemptCoverageComplete,
    canonicalActivityIdentityReviewComplete: identityDispositionAttemptCoverageComplete && supported.length === records.length && !conflicts.length && !unresolved.length,
    repeatabilityReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: identityDispositionAttemptCoverageComplete
  };
}
