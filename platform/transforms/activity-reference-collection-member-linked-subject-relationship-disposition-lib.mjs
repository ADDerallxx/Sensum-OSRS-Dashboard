import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));

const preservedFields = [
  'memberCandidateKey', 'sourceRelationshipDispositionContentHash', 'sourceRelationshipEvidenceContentHash',
  'sourceRelationshipRoutingContentHash', 'sourceSignatureDispositionContentHash', 'sourceSignatureContentHash',
  'sourceRoutingContentHash', 'sourceMemberDispositionContentHash', 'sourceMemberEvidenceContentHash',
  'sourceCollectionActivityIdentityEvidenceContentHash', 'collectionContext', 'memberIdentityContexts',
  'sourcePageId', 'resolvedTitle', 'membershipClassification', 'sourceRevision', 'sourceTimestamp', 'sourceUrl',
  'sourceContentHash', 'sourcePageSubjectDisposition', 'routingDecision', 'sourceBlockers',
  'sourceSignatureBlockers', 'sourceDispositionBlockers', 'sourceRelationshipRoutingBlockers',
  'sourceRelationshipEvidenceBlockers', 'sourceRelationshipDispositionBlockers',
  'sourceCollectionActivityIdentityEvidenceBlockers', 'sourceSignatureJoin', 'collectionMembershipEvidence',
  'sourcePageEvidence', 'relationshipCandidateObservations', 'sourceRelationshipEvidenceSummary',
  'sourceRelationshipDispositionSignals', 'sourceRelationshipDisposition', 'collectionActivityEvidence',
  'collectionActivityIdentityCandidateObservations', 'collectionActivityIdentityDispositionSignals',
  'collectionActivityIdentityDisposition', 'collectionActivityIdentityReview'
];

function pick(record, fields = preservedFields) {
  return Object.fromEntries(fields.map(field => [field, record?.[field]]));
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

export function compileLinkedSubjectRelationshipDispositionPolicy(policy = {}) {
  const rules = [];
  const invalidRuleKeys = [];
  for (const raw of policy.relationshipDispositionRules || []) {
    try {
      if (!raw.ruleKey || !raw.sourceRelationshipClass || !raw.linkedSubjectRelationshipClass) throw new Error('missing_rule_identity');
      if (raw.requiresSupportedCollectionActivityIdentity !== true
        || raw.requiresMatchedSourceRelationshipDeclaration !== true
        || raw.requiresDualSourceIdentitySignal !== true
        || raw.requiresStableLinkedSourceAlignment !== true) throw new Error('missing_evidence_obligation');
      rules.push({
        ruleKey: raw.ruleKey,
        sourceRelationshipClass: raw.sourceRelationshipClass,
        linkedSubjectRelationshipClass: raw.linkedSubjectRelationshipClass
      });
    } catch {
      invalidRuleKeys.push(raw?.ruleKey || `rule_${rules.length + invalidRuleKeys.length + 1}`);
    }
  }
  return {
    policyId: policy.policy || null,
    rules,
    invalidRuleKeys: sorted(unique(invalidRuleKeys)),
    duplicateRuleKeys: sorted(duplicates((policy.relationshipDispositionRules || []).map(rule => rule.ruleKey).filter(Boolean))),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function signalForRule(record, rule) {
  const identityDisposition = record.collectionActivityIdentityDisposition || {};
  const identityReview = record.collectionActivityIdentityReview || {};
  const sourceDisposition = record.sourceRelationshipDisposition || {};
  if (identityDisposition.state !== 'source_supported_collection_activity_candidate') return null;
  if (identityReview.state !== 'reviewed_source_supported_candidate' || !identityReview.identity || identityReview.identity.canonicalIdentityEstablished !== false) return null;
  if (sourceDisposition.state !== 'source_declaration_supported' || sourceDisposition.relationshipClass !== rule.sourceRelationshipClass) return null;
  const declarations = (record.sourceRelationshipDispositionSignals || [])
    .filter(signal => signal.relationshipClass === rule.sourceRelationshipClass && signal.evidenceKey)
    .flatMap(signal => signal.matchedDeclarations || []);
  if (!declarations.length || declarations.some(match => !match.sourceLocator || !match.rawText || !match.plainText || !match.matchedText)) return null;
  const identitySignals = (record.collectionActivityIdentityDispositionSignals || []).filter(signal =>
    signal.signalKind === 'dual_source_collection_activity_identity_candidate'
    && signal.identityClass === identityDisposition.identityClass
    && signal.linkedSourceRelationshipClass === rule.sourceRelationshipClass
    && signal.evidenceKey
    && signal.memberLinkSourceTitleAlignments?.length
    && signal.stableSourceIdentityAlignments?.length
    && signal.linkedSourceRelationshipEvidenceKeys?.length
  );
  if (!identitySignals.length) return null;
  return {
    evidenceKey: `${record.memberCandidateKey}:linked-subject-relationship:${rule.ruleKey}`,
    signalKind: 'generic_linked_subject_collection_activity_relationship',
    ruleKey: rule.ruleKey,
    sourceRelationshipClass: rule.sourceRelationshipClass,
    linkedSubjectRelationshipClass: rule.linkedSubjectRelationshipClass,
    sourceRelationshipEvidenceKeys: unique((record.sourceRelationshipDispositionSignals || []).filter(signal => signal.relationshipClass === rule.sourceRelationshipClass).map(signal => signal.evidenceKey)),
    sourceMatchedDeclarations: declarations,
    collectionActivityIdentityEvidenceKeys: identitySignals.map(signal => signal.evidenceKey),
    memberLinkSourceTitleAlignments: identitySignals.flatMap(signal => signal.memberLinkSourceTitleAlignments),
    stableSourceIdentityAlignments: identitySignals.flatMap(signal => signal.stableSourceIdentityAlignments),
    evidenceState: 'source_supported_linked_subject_relationship_not_canonical_identity'
  };
}

function expectedRelationship(record, compiled) {
  if (record.collectionActivityIdentityDisposition?.state !== 'source_supported_collection_activity_candidate'
    || record.collectionActivityIdentityReview?.state !== 'reviewed_source_supported_candidate') {
    return {
      signals: [],
      disposition: { state: 'unresolved_collection_activity_identity_not_supported', relationshipClass: null, conflictingRelationshipClasses: [], evidenceKeys: [] }
    };
  }
  if (record.sourceRelationshipDisposition?.state === 'blocked_conflicting_source_relationship_declarations') {
    return {
      signals: [],
      disposition: { state: 'blocked_source_relationship_conflict', relationshipClass: null, conflictingRelationshipClasses: [], evidenceKeys: [] }
    };
  }
  const signals = compiled.rules.map(rule => signalForRule(record, rule)).filter(Boolean);
  const classes = sorted(unique(signals.map(signal => signal.linkedSubjectRelationshipClass)));
  if (classes.length === 1) return {
    signals,
    disposition: { state: 'source_supported_linked_subject_relationship', relationshipClass: classes[0], conflictingRelationshipClasses: [], evidenceKeys: signals.map(signal => signal.evidenceKey) }
  };
  if (classes.length > 1) return {
    signals,
    disposition: { state: 'blocked_conflicting_linked_subject_relationship_signals', relationshipClass: null, conflictingRelationshipClasses: classes, evidenceKeys: signals.map(signal => signal.evidenceKey) }
  };
  return {
    signals,
    disposition: { state: 'unresolved_insufficient_linked_subject_relationship_evidence', relationshipClass: null, conflictingRelationshipClasses: [], evidenceKeys: [] }
  };
}

function expectedReview(record, expected) {
  if (expected.disposition.state !== 'source_supported_linked_subject_relationship') {
    return { state: 'reviewed_blocked', relationships: [], evidenceKeys: expected.disposition.evidenceKeys };
  }
  return {
    state: 'reviewed_source_supported',
    relationships: [{
      relationshipClass: expected.disposition.relationshipClass,
      subject: {
        sourcePageId: record.sourcePageId,
        resolvedTitle: record.resolvedTitle,
        sourceRevision: String(record.sourceRevision || ''),
        sourceContentHash: record.sourceContentHash
      },
      activityCandidate: record.collectionActivityIdentityReview.identity,
      canonicalIdentityEstablished: false
    }],
    evidenceKeys: expected.disposition.evidenceKeys
  };
}

export function buildActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions({ identityDispositionRecords = [], policy = {} }) {
  const compiled = compileLinkedSubjectRelationshipDispositionPolicy(policy);
  const records = identityDispositionRecords.map(input => {
    const expected = expectedRelationship(input, compiled);
    const review = expectedReview(input, expected);
    const blockers = [];
    if (expected.disposition.state.includes('conflict')) blockers.push('linked_subject_relationship_evidence_conflict');
    if (expected.disposition.state.startsWith('unresolved')) blockers.push('linked_subject_relationship_evidence_insufficient');
    blockers.push(
      'collection_defined_activity_candidate_is_not_a_canonical_activity_identity',
      'canonical_linked_subject_and_activity_identity_review_pending',
      'repeatability_and_member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: policy.recordContract || 'sensum.activity-reference-collection-member-linked-subject-relationship-disposition.v1',
      ...pick(input),
      sourceCollectionActivityIdentityDispositionContentHash: input.contentHash,
      linkedSubjectRelationshipDispositionSignals: expected.signals,
      linkedSubjectRelationshipDisposition: expected.disposition,
      linkedSubjectRelationshipReview: review,
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: expected.disposition.state === 'source_supported_linked_subject_relationship'
        ? 'linked_subject_relationship_supported_downstream_gates_closed'
        : 'linked_subject_relationship_disposition_blocked'
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions(records, { identityDispositionRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions(records = [], { identityDispositionRecords = [], policy = {} } = {}) {
  const compiled = compileLinkedSubjectRelationshipDispositionPolicy(policy);
  const expectedKeys = identityDispositionRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(identityDispositionRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || output.sourceCollectionActivityIdentityDispositionContentHash !== input.contentHash || JSON.stringify(pick(input)) !== JSON.stringify(pick(output));
  });
  const inputStructuralFailures = identityDispositionRecords.filter(record =>
    record.contract !== policy.inputContract
    || !record.contentHash
    || record.accountIndependent !== true
    || record.collectionActivityIdentityDisposition?.state !== 'source_supported_collection_activity_candidate'
    || record.collectionActivityIdentityReview?.state !== 'reviewed_source_supported_candidate'
    || record.collectionActivityIdentityReview?.identity?.canonicalIdentityEstablished !== false
    || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidDispositionRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedRelationship(input, compiled);
    return record.contract !== policy.recordContract
      || JSON.stringify(record.linkedSubjectRelationshipDispositionSignals || []) !== JSON.stringify(expected.signals)
      || JSON.stringify(record.linkedSubjectRelationshipDisposition || null) !== JSON.stringify(expected.disposition)
      || JSON.stringify(record.linkedSubjectRelationshipReview || null) !== JSON.stringify(expectedReview(input, expected));
  }).map(record => record.memberCandidateKey);
  const unexpectedSignalKinds = sorted(unique(records.flatMap(record => (record.linkedSubjectRelationshipDispositionSignals || []).map(signal => signal.signalKind)).filter(kind => kind !== 'generic_linked_subject_collection_activity_relationship')));
  const invalidSignalEvidence = records.filter(record => (record.linkedSubjectRelationshipDispositionSignals || []).some(signal =>
    !signal.evidenceKey || !signal.ruleKey || !signal.sourceRelationshipClass || !signal.linkedSubjectRelationshipClass
    || !signal.sourceRelationshipEvidenceKeys?.length || !signal.sourceMatchedDeclarations?.length
    || signal.sourceMatchedDeclarations.some(match => !match.sourceLocator)
    || !signal.collectionActivityIdentityEvidenceKeys?.length
    || !signal.memberLinkSourceTitleAlignments?.length || !signal.stableSourceIdentityAlignments?.length
  )).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.collectionActivityIdentityReview?.state !== 'reviewed_source_supported_candidate'
    || !['reviewed_source_supported', 'reviewed_blocked'].includes(record.linkedSubjectRelationshipReview?.state)
    || (record.linkedSubjectRelationshipReview?.relationships || []).some(relationship => relationship.canonicalIdentityEstablished !== false)
    || record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_collection_activity_identity_dispositions');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_linked_subject_relationship_disposition_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (inputStructuralFailures.length) structuralBlockers.push('one_or_more_input_collection_activity_identity_dispositions_failed_structural_integrity');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_class_linked_subject_relationship_policy_forbidden');
  if (compiled.invalidRuleKeys.length || compiled.duplicateRuleKeys.length) structuralBlockers.push('one_or_more_linked_subject_relationship_rules_invalid_or_duplicate');
  if (invalidDispositionRecords.length || unexpectedSignalKinds.length || invalidSignalEvidence.length) structuralBlockers.push('one_or_more_linked_subject_relationship_dispositions_not_supported_by_complete_generic_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_canonical_identity_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_linked_subject_relationship_dispositions');
  const supported = records.filter(record => record.linkedSubjectRelationshipDisposition?.state === 'source_supported_linked_subject_relationship');
  const conflicts = records.filter(record => ['blocked_source_relationship_conflict', 'blocked_conflicting_linked_subject_relationship_signals'].includes(record.linkedSubjectRelationshipDisposition?.state));
  const unresolved = records.filter(record => ['unresolved_collection_activity_identity_not_supported', 'unresolved_insufficient_linked_subject_relationship_evidence'].includes(record.linkedSubjectRelationshipDisposition?.state));
  const relationshipCounts = {};
  for (const record of supported) relationshipCounts[record.linkedSubjectRelationshipDisposition.relationshipClass] = (relationshipCounts[record.linkedSubjectRelationshipDisposition.relationshipClass] || 0) + 1;
  const relationshipDispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (conflicts.length) blockers.push('one_or_more_linked_subject_relationship_dispositions_conflict');
  if (unresolved.length) blockers.push('one_or_more_linked_subject_relationships_remain_unresolved');
  blockers.push(
    'collection_defined_activity_candidates_and_linked_subjects_are_not_canonical_activity_identities',
    'canonical_activity_identity_review_pending',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-linked-subject-relationship-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedIdentityDispositionCount: expectedKeys.length,
      relationshipDispositionRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: inputStructuralFailures,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      relationshipDispositionRuleCount: compiled.rules.length,
      invalidRuleKeys: compiled.invalidRuleKeys,
      duplicateRuleKeys: compiled.duplicateRuleKeys,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      unexpectedSignalKinds,
      invalidSignalEvidenceMemberCandidateKeys: invalidSignalEvidence
    },
    linkedSubjectRelationshipDispositionCoverage: {
      attemptedCount: records.length,
      sourceSupportedCount: supported.length,
      conflictingCount: conflicts.length,
      unresolvedCount: unresolved.length,
      relationshipClassCounts: Object.fromEntries(Object.entries(relationshipCounts).sort((a, b) => a[0].localeCompare(b[0]))),
      genericRelationshipSignalCount: records.reduce((sum, record) => sum + (record.linkedSubjectRelationshipDispositionSignals || []).length, 0),
      retainedSourceDeclarationCount: records.reduce((sum, record) => sum + (record.linkedSubjectRelationshipDispositionSignals || []).reduce((inner, signal) => inner + signal.sourceMatchedDeclarations.length, 0), 0),
      conflictMemberCandidateKeys: conflicts.map(record => record.memberCandidateKey),
      unresolvedMemberCandidateKeys: unresolved.map(record => record.memberCandidateKey),
      invalidDispositionMemberCandidateKeys: invalidDispositionRecords
    },
    semanticPromotionCoverage: {
      collectionActivityIdentityReviewedCount: records.filter(record => record.collectionActivityIdentityReview?.state === 'reviewed_source_supported_candidate').length,
      linkedSubjectRelationshipReviewedCount: records.filter(record => record.linkedSubjectRelationshipReview?.state === 'reviewed_source_supported').length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    relationshipDispositionAttemptCoverageComplete,
    collectionActivityIdentityReviewComplete: relationshipDispositionAttemptCoverageComplete && records.every(record => record.collectionActivityIdentityReview?.state === 'reviewed_source_supported_candidate'),
    linkedSubjectRelationshipReviewComplete: relationshipDispositionAttemptCoverageComplete && supported.length === records.length && !conflicts.length && !unresolved.length,
    repeatabilityReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: relationshipDispositionAttemptCoverageComplete
  };
}
