import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
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

const wordCount = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;

export function compileCollectionActivityIdentityDispositionPolicy(policy = {}) {
  const rules = [];
  const invalidRuleKeys = [];
  for (const raw of policy.identityDispositionRules || []) {
    try {
      if (!raw.ruleKey || !raw.identityClass) throw new Error('missing_rule_identity');
      if (!Array.isArray(raw.acceptedSourceRelationshipClasses) || !raw.acceptedSourceRelationshipClasses.length) throw new Error('missing_relationship_classes');
      if (!Number.isInteger(raw.minimumNarrativeWordCount) || raw.minimumNarrativeWordCount < 1) throw new Error('invalid_narrative_word_count');
      if (raw.requiresMemberLinkSourceTitleAlignment !== true || raw.requiresStableSourceIdentityAlignment !== true || raw.requiresMatchedSourceRelationshipDeclaration !== true) throw new Error('missing_independent_evidence_obligation');
      rules.push({
        ruleKey: raw.ruleKey,
        identityClass: raw.identityClass,
        acceptedSourceRelationshipClasses: [...raw.acceptedSourceRelationshipClasses],
        minimumNarrativeWordCount: raw.minimumNarrativeWordCount,
        requiresMemberLinkSourceTitleAlignment: true,
        requiresStableSourceIdentityAlignment: true,
        requiresMatchedSourceRelationshipDeclaration: true
      });
    } catch {
      invalidRuleKeys.push(raw?.ruleKey || `rule_${rules.length + invalidRuleKeys.length + 1}`);
    }
  }
  return {
    policyId: policy.policy || null,
    rules,
    invalidRuleKeys: sorted(unique(invalidRuleKeys)),
    duplicateRuleKeys: sorted(duplicates((policy.identityDispositionRules || []).map(rule => rule.ruleKey).filter(Boolean))),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function candidateSignal(record, rule) {
  const relationshipDisposition = record.sourceRelationshipDisposition || {};
  if (relationshipDisposition.state !== 'source_declaration_supported') return null;
  if (!rule.acceptedSourceRelationshipClasses.includes(relationshipDisposition.relationshipClass)) return null;
  const labelEvidence = record.collectionActivityEvidence?.memberCellEvidence;
  if (!String(labelEvidence?.plainText || '').trim() || !labelEvidence?.sourceLocator) return null;
  const narrativeEvidence = (record.collectionActivityEvidence?.nonEmptyRowCellEvidence || [])
    .filter(cell => wordCount(cell.plainText) >= rule.minimumNarrativeWordCount && cell.sourceLocator);
  if (!narrativeEvidence.length) return null;
  const memberLinkAlignments = record.collectionActivityIdentityCandidateObservations?.memberLinkSourceTitleAlignments || [];
  if (!memberLinkAlignments.length) return null;
  const stableSourceAlignments = record.collectionActivityIdentityCandidateObservations?.stableSourceIdentityAlignments || [];
  if (!stableSourceAlignments.length) return null;
  const sourceRelationshipSignals = (record.sourceRelationshipDispositionSignals || []).filter(signal =>
    signal.relationshipClass === relationshipDisposition.relationshipClass
    && signal.evidenceKey
    && signal.matchedDeclarations?.length
    && signal.matchedDeclarations.every(match => match.sourceLocator && match.rawText && match.plainText && match.matchedText)
  );
  if (!sourceRelationshipSignals.length) return null;
  return {
    evidenceKey: `${record.memberCandidateKey}:collection-activity-identity:${rule.ruleKey}`,
    signalKind: 'dual_source_collection_activity_identity_candidate',
    ruleKey: rule.ruleKey,
    identityClass: rule.identityClass,
    collectionLabelEvidence: labelEvidence,
    collectionNarrativeEvidence: narrativeEvidence,
    linkedSourceRelationshipClass: relationshipDisposition.relationshipClass,
    linkedSourceRelationshipEvidenceKeys: sourceRelationshipSignals.map(signal => signal.evidenceKey),
    linkedSourceMatchedDeclarations: sourceRelationshipSignals.flatMap(signal => signal.matchedDeclarations),
    memberLinkSourceTitleAlignments: memberLinkAlignments,
    stableSourceIdentityAlignments: stableSourceAlignments,
    sharedMainNamespaceLinkTargets: record.collectionActivityIdentityCandidateObservations?.sharedMainNamespaceLinkTargets || [],
    evidenceState: 'dual_source_identity_candidate_signal_not_canonical_identity'
  };
}

function dispositionSignals(record, compiled) {
  return compiled.rules.map(rule => candidateSignal(record, rule)).filter(Boolean);
}

function expectedDisposition(record, compiled) {
  const sourceState = record.sourceRelationshipDisposition?.state;
  if (sourceState === 'blocked_conflicting_source_relationship_declarations') {
    return {
      signals: [],
      disposition: {
        state: 'blocked_source_relationship_conflict',
        identityClass: null,
        conflictingIdentityClasses: [],
        collectionActivityLabel: null,
        linkedSourceRelationshipClass: null,
        evidenceKeys: []
      }
    };
  }
  if (sourceState === 'unresolved_no_supported_source_relationship_declaration') {
    return {
      signals: [],
      disposition: {
        state: 'unresolved_source_relationship',
        identityClass: null,
        conflictingIdentityClasses: [],
        collectionActivityLabel: null,
        linkedSourceRelationshipClass: null,
        evidenceKeys: []
      }
    };
  }
  const signals = dispositionSignals(record, compiled);
  const identityClasses = sorted(unique(signals.map(signal => signal.identityClass)));
  if (identityClasses.length === 1) {
    return {
      signals,
      disposition: {
        state: 'source_supported_collection_activity_candidate',
        identityClass: identityClasses[0],
        conflictingIdentityClasses: [],
        collectionActivityLabel: record.collectionActivityEvidence?.memberCellEvidence?.plainText || null,
        linkedSourceRelationshipClass: record.sourceRelationshipDisposition?.relationshipClass || null,
        evidenceKeys: signals.map(signal => signal.evidenceKey)
      }
    };
  }
  if (identityClasses.length > 1) {
    return {
      signals,
      disposition: {
        state: 'blocked_conflicting_collection_activity_identity_signals',
        identityClass: null,
        conflictingIdentityClasses: identityClasses,
        collectionActivityLabel: null,
        linkedSourceRelationshipClass: record.sourceRelationshipDisposition?.relationshipClass || null,
        evidenceKeys: signals.map(signal => signal.evidenceKey)
      }
    };
  }
  return {
    signals,
    disposition: {
      state: 'unresolved_insufficient_collection_activity_identity_evidence',
      identityClass: null,
      conflictingIdentityClasses: [],
      collectionActivityLabel: null,
      linkedSourceRelationshipClass: record.sourceRelationshipDisposition?.relationshipClass || null,
      evidenceKeys: []
    }
  };
}

function expectedIdentityReview(record, expected) {
  if (expected.disposition.state !== 'source_supported_collection_activity_candidate') {
    return { state: 'reviewed_blocked', identity: null, evidenceKeys: expected.disposition.evidenceKeys };
  }
  return {
    state: 'reviewed_source_supported_candidate',
    identity: {
      identityClass: expected.disposition.identityClass,
      collectionActivityLabel: expected.disposition.collectionActivityLabel,
      collectionLocator: {
        collectionPageId: record.collectionActivityEvidence?.collectionSource?.pageId ?? null,
        collectionRevision: String(record.collectionActivityEvidence?.collectionSource?.revision || ''),
        sectionHeading: record.collectionActivityEvidence?.sectionEvidence?.heading || null,
        sourceTableOrdinal: record.collectionActivityEvidence?.tableEvidence?.sourceTableOrdinal ?? null,
        sourceRowOrdinal: record.collectionActivityEvidence?.rowEvidence?.sourceRowOrdinal ?? null
      },
      linkedSourceRelationshipClass: expected.disposition.linkedSourceRelationshipClass,
      canonicalIdentityEstablished: false
    },
    evidenceKeys: expected.disposition.evidenceKeys
  };
}

function preservedInput(record = {}) {
  return {
    memberCandidateKey: record.memberCandidateKey,
    sourceCollectionActivityIdentityEvidenceContentHash: record.contentHash,
    sourceRelationshipDispositionContentHash: record.sourceRelationshipDispositionContentHash,
    sourceRelationshipEvidenceContentHash: record.sourceRelationshipEvidenceContentHash,
    sourceRelationshipRoutingContentHash: record.sourceRelationshipRoutingContentHash,
    sourceSignatureDispositionContentHash: record.sourceSignatureDispositionContentHash,
    sourceSignatureContentHash: record.sourceSignatureContentHash,
    sourceRoutingContentHash: record.sourceRoutingContentHash,
    sourceMemberDispositionContentHash: record.sourceMemberDispositionContentHash,
    sourceMemberEvidenceContentHash: record.sourceMemberEvidenceContentHash,
    collectionContext: record.collectionContext,
    memberIdentityContexts: record.memberIdentityContexts,
    sourcePageId: record.sourcePageId,
    resolvedTitle: record.resolvedTitle,
    membershipClassification: record.membershipClassification,
    sourceRevision: String(record.sourceRevision || ''),
    sourceTimestamp: record.sourceTimestamp || null,
    sourceUrl: record.sourceUrl || null,
    sourceContentHash: record.sourceContentHash || null,
    sourcePageSubjectDisposition: record.sourcePageSubjectDisposition || null,
    routingDecision: record.routingDecision || null,
    sourceBlockers: record.sourceBlockers || [],
    sourceSignatureBlockers: record.sourceSignatureBlockers || [],
    sourceDispositionBlockers: record.sourceDispositionBlockers || [],
    sourceRelationshipRoutingBlockers: record.sourceRelationshipRoutingBlockers || [],
    sourceRelationshipEvidenceBlockers: record.sourceRelationshipEvidenceBlockers || [],
    sourceRelationshipDispositionBlockers: record.sourceRelationshipDispositionBlockers || [],
    sourceCollectionActivityIdentityEvidenceBlockers: record.blockers || [],
    sourceSignatureJoin: record.sourceSignatureJoin || null,
    collectionMembershipEvidence: record.collectionMembershipEvidence || null,
    sourcePageEvidence: record.sourcePageEvidence || null,
    relationshipCandidateObservations: record.relationshipCandidateObservations || null,
    sourceRelationshipEvidenceSummary: record.sourceRelationshipEvidenceSummary || null,
    sourceRelationshipDispositionSignals: record.sourceRelationshipDispositionSignals || [],
    sourceRelationshipDisposition: record.sourceRelationshipDisposition || null,
    collectionActivityEvidence: record.collectionActivityEvidence || null,
    collectionActivityIdentityCandidateObservations: record.collectionActivityIdentityCandidateObservations || null
  };
}

function outputPreservedInput(record = {}) {
  return {
    memberCandidateKey: record.memberCandidateKey,
    sourceCollectionActivityIdentityEvidenceContentHash: record.sourceCollectionActivityIdentityEvidenceContentHash,
    sourceRelationshipDispositionContentHash: record.sourceRelationshipDispositionContentHash,
    sourceRelationshipEvidenceContentHash: record.sourceRelationshipEvidenceContentHash,
    sourceRelationshipRoutingContentHash: record.sourceRelationshipRoutingContentHash,
    sourceSignatureDispositionContentHash: record.sourceSignatureDispositionContentHash,
    sourceSignatureContentHash: record.sourceSignatureContentHash,
    sourceRoutingContentHash: record.sourceRoutingContentHash,
    sourceMemberDispositionContentHash: record.sourceMemberDispositionContentHash,
    sourceMemberEvidenceContentHash: record.sourceMemberEvidenceContentHash,
    collectionContext: record.collectionContext,
    memberIdentityContexts: record.memberIdentityContexts,
    sourcePageId: record.sourcePageId,
    resolvedTitle: record.resolvedTitle,
    membershipClassification: record.membershipClassification,
    sourceRevision: String(record.sourceRevision || ''),
    sourceTimestamp: record.sourceTimestamp || null,
    sourceUrl: record.sourceUrl || null,
    sourceContentHash: record.sourceContentHash || null,
    sourcePageSubjectDisposition: record.sourcePageSubjectDisposition || null,
    routingDecision: record.routingDecision || null,
    sourceBlockers: record.sourceBlockers || [],
    sourceSignatureBlockers: record.sourceSignatureBlockers || [],
    sourceDispositionBlockers: record.sourceDispositionBlockers || [],
    sourceRelationshipRoutingBlockers: record.sourceRelationshipRoutingBlockers || [],
    sourceRelationshipEvidenceBlockers: record.sourceRelationshipEvidenceBlockers || [],
    sourceRelationshipDispositionBlockers: record.sourceRelationshipDispositionBlockers || [],
    sourceCollectionActivityIdentityEvidenceBlockers: record.sourceCollectionActivityIdentityEvidenceBlockers || [],
    sourceSignatureJoin: record.sourceSignatureJoin || null,
    collectionMembershipEvidence: record.collectionMembershipEvidence || null,
    sourcePageEvidence: record.sourcePageEvidence || null,
    relationshipCandidateObservations: record.relationshipCandidateObservations || null,
    sourceRelationshipEvidenceSummary: record.sourceRelationshipEvidenceSummary || null,
    sourceRelationshipDispositionSignals: record.sourceRelationshipDispositionSignals || [],
    sourceRelationshipDisposition: record.sourceRelationshipDisposition || null,
    collectionActivityEvidence: record.collectionActivityEvidence || null,
    collectionActivityIdentityCandidateObservations: record.collectionActivityIdentityCandidateObservations || null
  };
}

export function buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions({ identityEvidenceRecords = [], policy = {} }) {
  const compiled = compileCollectionActivityIdentityDispositionPolicy(policy);
  const records = identityEvidenceRecords.map(input => {
    const expected = expectedDisposition(input, compiled);
    const identityReview = expectedIdentityReview(input, expected);
    const blockers = [];
    if (expected.disposition.state === 'blocked_source_relationship_conflict') blockers.push('source_relationship_conflict_blocks_collection_activity_identity');
    if (expected.disposition.state === 'unresolved_source_relationship') blockers.push('unresolved_source_relationship_blocks_collection_activity_identity');
    if (expected.disposition.state === 'blocked_conflicting_collection_activity_identity_signals') blockers.push('collection_activity_identity_signal_conflict');
    if (expected.disposition.state === 'unresolved_insufficient_collection_activity_identity_evidence') blockers.push('insufficient_dual_source_collection_activity_identity_evidence');
    blockers.push(
      'collection_defined_activity_candidate_is_not_a_canonical_activity_identity',
      'exact_linked_subject_collection_relationship_review_pending',
      'repeatability_and_member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: policy.recordContract || 'sensum.activity-reference-collection-member-collection-activity-identity-disposition.v1',
      ...preservedInput(input),
      collectionActivityIdentityDispositionSignals: expected.signals,
      collectionActivityIdentityDisposition: expected.disposition,
      collectionActivityIdentityReview: identityReview,
      linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: expected.disposition.state === 'source_supported_collection_activity_candidate'
        ? 'collection_activity_candidate_identity_supported_downstream_gates_closed'
        : 'collection_activity_identity_disposition_blocked'
    };
  });
  return {
    records,
    audit: auditActivityReferenceCollectionMemberCollectionActivityIdentityDispositions(records, { identityEvidenceRecords, policy })
  };
}

export function auditActivityReferenceCollectionMemberCollectionActivityIdentityDispositions(records = [], { identityEvidenceRecords = [], policy = {} } = {}) {
  const compiled = compileCollectionActivityIdentityDispositionPolicy(policy);
  const expectedKeys = identityEvidenceRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(identityEvidenceRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key =>
    !outputByKey.has(key)
    || JSON.stringify(preservedInput(inputByKey.get(key))) !== JSON.stringify(outputPreservedInput(outputByKey.get(key)))
  );
  const inputStructuralFailures = identityEvidenceRecords.filter(record =>
    record.contract !== policy.inputContract
    || !record.contentHash
    || record.accountIndependent !== true
    || record.collectionActivityIdentityCandidateObservations?.collectionActivityIdentityVerdict !== null
    || record.collectionActivityIdentityCandidateObservations?.linkedSubjectRelationshipVerdict !== null
    || record.collectionActivityIdentityReview?.state !== 'unreviewed'
    || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidDispositionRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedDisposition(input, compiled);
    const identityReview = expectedIdentityReview(input, expected);
    return record.contract !== policy.recordContract
      || JSON.stringify(record.collectionActivityIdentityDispositionSignals || []) !== JSON.stringify(expected.signals)
      || JSON.stringify(record.collectionActivityIdentityDisposition || null) !== JSON.stringify(expected.disposition)
      || JSON.stringify(record.collectionActivityIdentityReview || null) !== JSON.stringify(identityReview);
  }).map(record => record.memberCandidateKey);
  const unexpectedSignalKinds = sorted(unique(records.flatMap(record =>
    (record.collectionActivityIdentityDispositionSignals || []).map(signal => signal.signalKind)
  ).filter(kind => kind !== 'dual_source_collection_activity_identity_candidate')));
  const invalidSignalEvidence = records.filter(record =>
    (record.collectionActivityIdentityDispositionSignals || []).some(signal =>
      !signal.evidenceKey
      || !signal.ruleKey
      || !signal.identityClass
      || !signal.collectionLabelEvidence?.sourceLocator
      || !signal.collectionNarrativeEvidence?.length
      || signal.collectionNarrativeEvidence.some(cell => !cell.sourceLocator)
      || !signal.linkedSourceRelationshipClass
      || !signal.linkedSourceRelationshipEvidenceKeys?.length
      || !signal.linkedSourceMatchedDeclarations?.length
      || signal.linkedSourceMatchedDeclarations.some(match => !match.sourceLocator)
      || !signal.memberLinkSourceTitleAlignments?.length
      || !signal.stableSourceIdentityAlignments?.length
    )
  ).map(record => record.memberCandidateKey);
  const headerDerivedSignals = records.filter(record =>
    (record.collectionActivityIdentityDispositionSignals || []).some(signal =>
      signal.collectionNarrativeEvidence.some(cell => cell.selectedByLogicalHeader !== undefined)
    )
  ).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed'
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_collection_activity_identity_evidence_packets');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_collection_activity_identity_disposition_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_relationship_disposition_collection_membership_or_alias_contexts_changed');
  if (inputStructuralFailures.length) structuralBlockers.push('one_or_more_input_collection_activity_identity_evidence_packets_failed_structural_integrity');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_class_identity_disposition_policy_forbidden');
  if (compiled.invalidRuleKeys.length || compiled.duplicateRuleKeys.length) structuralBlockers.push('one_or_more_collection_activity_identity_disposition_rules_invalid_or_duplicate');
  if (invalidDispositionRecords.length || unexpectedSignalKinds.length || invalidSignalEvidence.length) structuralBlockers.push('one_or_more_collection_activity_identity_dispositions_not_supported_by_complete_dual_source_evidence');
  if (headerDerivedSignals.length) structuralBlockers.push('table_header_name_used_to_select_collection_narrative_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_linked_relationship_canonical_identity_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_collection_activity_identity_dispositions');
  const supported = records.filter(record => record.collectionActivityIdentityDisposition?.state === 'source_supported_collection_activity_candidate');
  const conflicts = records.filter(record => ['blocked_source_relationship_conflict', 'blocked_conflicting_collection_activity_identity_signals'].includes(record.collectionActivityIdentityDisposition?.state));
  const unresolved = records.filter(record => ['unresolved_source_relationship', 'unresolved_insufficient_collection_activity_identity_evidence'].includes(record.collectionActivityIdentityDisposition?.state));
  const allowedStates = [
    'source_supported_collection_activity_candidate',
    'blocked_source_relationship_conflict',
    'blocked_conflicting_collection_activity_identity_signals',
    'unresolved_source_relationship',
    'unresolved_insufficient_collection_activity_identity_evidence'
  ];
  const invalidStates = records.filter(record => !allowedStates.includes(record.collectionActivityIdentityDisposition?.state)).map(record => record.memberCandidateKey);
  if (invalidStates.length) structuralBlockers.push('one_or_more_collection_activity_identity_disposition_states_invalid');
  const identityDispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (conflicts.length) blockers.push('one_or_more_collection_activity_identity_dispositions_conflict');
  if (unresolved.length) blockers.push('one_or_more_collection_activity_identities_remain_unresolved');
  blockers.push(
    'collection_defined_activity_candidates_are_not_canonical_activity_identities',
    'exact_linked_subject_collection_relationship_review_pending',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  const identityClassCounts = {};
  for (const record of supported) {
    const identityClass = record.collectionActivityIdentityDisposition.identityClass;
    identityClassCounts[identityClass] = (identityClassCounts[identityClass] || 0) + 1;
  }
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-collection-activity-identity-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedIdentityEvidencePacketCount: expectedKeys.length,
      identityDispositionRecordCount: records.length,
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
      identityDispositionRuleCount: compiled.rules.length,
      invalidRuleKeys: compiled.invalidRuleKeys,
      duplicateRuleKeys: compiled.duplicateRuleKeys,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      unexpectedSignalKinds,
      invalidSignalEvidenceMemberCandidateKeys: invalidSignalEvidence,
      headerDerivedSignalMemberCandidateKeys: headerDerivedSignals
    },
    collectionActivityIdentityDispositionCoverage: {
      attemptedCount: records.length,
      sourceSupportedCount: supported.length,
      conflictingCount: conflicts.length,
      unresolvedCount: unresolved.length,
      identityClassCounts: Object.fromEntries(Object.entries(identityClassCounts).sort((a, b) => a[0].localeCompare(b[0]))),
      dualSourceIdentitySignalCount: records.reduce((sum, record) => sum + (record.collectionActivityIdentityDispositionSignals || []).length, 0),
      collectionNarrativeEvidenceCellCount: records.reduce((sum, record) => sum + (record.collectionActivityIdentityDispositionSignals || []).reduce((inner, signal) => inner + signal.collectionNarrativeEvidence.length, 0), 0),
      retainedSourceRelationshipDeclarationCount: records.reduce((sum, record) => sum + (record.collectionActivityIdentityDispositionSignals || []).reduce((inner, signal) => inner + signal.linkedSourceMatchedDeclarations.length, 0), 0),
      conflictMemberCandidateKeys: conflicts.map(record => record.memberCandidateKey),
      unresolvedMemberCandidateKeys: unresolved.map(record => record.memberCandidateKey),
      invalidStateMemberCandidateKeys: invalidStates,
      invalidDispositionMemberCandidateKeys: invalidDispositionRecords
    },
    semanticPromotionCoverage: {
      collectionActivityIdentityReviewedCount: records.filter(record => record.collectionActivityIdentityReview?.state !== 'unreviewed').length,
      supportedCollectionActivityCandidateCount: records.filter(record => record.collectionActivityIdentityReview?.state === 'reviewed_source_supported_candidate').length,
      linkedSubjectRelationshipReviewedCount: records.filter(record => record.linkedSubjectRelationshipReview?.state !== 'unreviewed').length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    identityDispositionAttemptCoverageComplete,
    collectionActivityIdentityReviewComplete: identityDispositionAttemptCoverageComplete
      && supported.length === records.length
      && conflicts.length === 0
      && unresolved.length === 0,
    linkedSubjectRelationshipReviewComplete: false,
    repeatabilityReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: identityDispositionAttemptCoverageComplete
  };
}
