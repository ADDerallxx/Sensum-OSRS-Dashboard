import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';
import { plainTextFromWiki } from './activity-candidate-subject-disposition-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) { value.forEach((child, index) => visit(child, `${path}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|collectionDisplayLabel|collectionDisplayLabels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileRelationshipDispositionPolicy(policy = {}) {
  const rules = [];
  const invalidRuleKeys = [];
  for (const raw of policy.relationshipDeclarationRules || []) {
    try {
      if (!raw.ruleKey || !raw.relationshipClass || !Array.isArray(raw.sourcePageSubjectClasses) || !raw.sourcePageSubjectClasses.length || !Array.isArray(raw.requiredLeadPatterns) || !raw.requiredLeadPatterns.length) throw new Error('invalid_rule_shape');
      const requiredLeadPatterns = raw.requiredLeadPatterns.map((entry, index) => {
        if (!entry?.pattern) throw new Error(`missing_pattern_${index}`);
        return { ...entry, regex: new RegExp(entry.pattern, entry.flags || '') };
      });
      rules.push({
        ruleKey: raw.ruleKey,
        relationshipClass: raw.relationshipClass,
        sourcePageSubjectClasses: [...raw.sourcePageSubjectClasses],
        requiredLeadPatterns
      });
    } catch {
      invalidRuleKeys.push(raw?.ruleKey || `rule_${rules.length + invalidRuleKeys.length + 1}`);
    }
  }
  return {
    policyId: policy.policy || null,
    rules,
    invalidRuleKeys: sorted(unique(invalidRuleKeys)),
    duplicateRuleKeys: sorted(duplicates((policy.relationshipDeclarationRules || []).map(rule => rule.ruleKey).filter(Boolean))),
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy)
  };
}

function firstLeadMatch(leads, pattern) {
  for (const lead of leads) {
    const plainText = plainTextFromWiki(lead.rawText || '');
    pattern.regex.lastIndex = 0;
    const match = pattern.regex.exec(plainText);
    if (!match) continue;
    return {
      leadOrdinal: lead.ordinal,
      sourceLocator: lead.sourceLocator || null,
      rawText: lead.rawText || '',
      plainText,
      matchedText: match[0],
      matchIndex: match.index,
      pattern: pattern.pattern,
      flags: pattern.flags || ''
    };
  }
  return null;
}

function dispositionSignals(record, compiled) {
  const subjectClass = record.sourcePageSubjectDisposition?.disposition || null;
  const leads = record.sourcePageEvidence?.leadParagraphEvidence || [];
  const signals = [];
  for (const rule of compiled.rules) {
    if (!rule.sourcePageSubjectClasses.includes(subjectClass)) continue;
    const matches = rule.requiredLeadPatterns.map(pattern => firstLeadMatch(leads, pattern));
    if (matches.some(match => !match)) continue;
    signals.push({
      evidenceKey: `${record.memberCandidateKey}:source-relationship-declaration:${rule.ruleKey}`,
      signalKind: 'exact_lead_relationship_declaration_rule',
      ruleKey: rule.ruleKey,
      sourcePageSubjectClass: subjectClass,
      relationshipClass: rule.relationshipClass,
      matchedDeclarations: matches,
      sourcePageId: record.sourcePageId,
      sourceRevision: String(record.sourceRevision || ''),
      sourceTimestamp: record.sourceTimestamp || null,
      sourceUrl: record.sourceUrl || null,
      sourceContentHash: record.sourceContentHash || null
    });
  }
  return signals;
}

function expectedDisposition(record, compiled) {
  const signals = dispositionSignals(record, compiled);
  const classes = sorted(unique(signals.map(signal => signal.relationshipClass)));
  if (classes.length === 1) return {
    signals,
    disposition: { state: 'source_declaration_supported', relationshipClass: classes[0], conflictingRelationshipClasses: [], evidenceKeys: signals.map(signal => signal.evidenceKey) }
  };
  if (classes.length > 1) return {
    signals,
    disposition: { state: 'blocked_conflicting_source_relationship_declarations', relationshipClass: null, conflictingRelationshipClasses: classes, evidenceKeys: signals.map(signal => signal.evidenceKey) }
  };
  return {
    signals,
    disposition: { state: 'unresolved_no_supported_source_relationship_declaration', relationshipClass: null, conflictingRelationshipClasses: [], evidenceKeys: [] }
  };
}

function evidenceSummary(record = {}) {
  const observations = record.relationshipCandidateObservations || {};
  return {
    collectionMembershipEvidencePresent: Boolean(record.collectionMembershipEvidence?.rowEvidence),
    linkedSourceRevisionPinned: Boolean(record.sourcePageEvidence?.sourceRevision && record.sourcePageEvidence?.sourceContentHash),
    leadParagraphCount: (record.sourcePageEvidence?.leadParagraphEvidence || []).length,
    headingCount: (record.sourcePageEvidence?.headingEvidence || []).length,
    sourceAuthoredLinkOccurrenceCount: (record.sourcePageEvidence?.sourceAuthoredLinks || []).length,
    mainNamespaceLinkCandidateCount: (observations.sourcePageMainNamespaceLinkCandidates || []).length,
    collectionRowLinkCandidateCount: (observations.collectionRowLinkCandidates || []).length,
    exactMemberLabelCandidateCount:
      (observations.exactMemberLabelSourceLinkMatches || []).length
      + (observations.exactMemberLabelLeadMentions || []).length
      + (observations.exactMemberLabelHeadingMentions || []).length,
    inputRelationshipVerdict: observations.relationshipVerdict ?? null
  };
}

const inputProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceRelationshipEvidenceContentHash: record.contentHash,
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
  sourceRelationshipEvidenceBlockers: record.blockers || [],
  sourceSignatureJoin: record.sourceSignatureJoin || null,
  collectionMembershipEvidence: record.collectionMembershipEvidence || null,
  sourcePageEvidence: record.sourcePageEvidence || null,
  relationshipCandidateObservations: record.relationshipCandidateObservations || null,
  sourceRelationshipEvidenceSummary: evidenceSummary(record)
});

const outputProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
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
  sourceSignatureJoin: record.sourceSignatureJoin || null,
  collectionMembershipEvidence: record.collectionMembershipEvidence || null,
  sourcePageEvidence: record.sourcePageEvidence || null,
  relationshipCandidateObservations: record.relationshipCandidateObservations || null,
  sourceRelationshipEvidenceSummary: record.sourceRelationshipEvidenceSummary || null
});

export function buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions({ relationshipEvidenceRecords = [], policy = {} }) {
  const compiled = compileRelationshipDispositionPolicy(policy);
  const records = relationshipEvidenceRecords.map(evidence => {
    const expected = expectedDisposition(evidence, compiled);
    const blockers = [];
    if (expected.disposition.state === 'unresolved_no_supported_source_relationship_declaration') blockers.push('source_relationship_class_unresolved_no_supported_lead_declaration');
    if (expected.disposition.state === 'blocked_conflicting_source_relationship_declarations') blockers.push('source_relationship_class_conflict');
    blockers.push(
      'source_relationship_class_does_not_establish_collection_activity_identity',
      'exact_linked_subject_collection_relationship_review_pending',
      'canonical_game_entity_and_activity_identities_not_established',
      'repeatability_and_member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: policy.recordContract || 'sensum.activity-reference-collection-member-unresolved-subject-relationship-disposition.v1',
      memberCandidateKey: evidence.memberCandidateKey,
      sourceRelationshipEvidenceContentHash: evidence.contentHash,
      sourceRelationshipRoutingContentHash: evidence.sourceRelationshipRoutingContentHash,
      sourceSignatureDispositionContentHash: evidence.sourceSignatureDispositionContentHash,
      sourceSignatureContentHash: evidence.sourceSignatureContentHash,
      sourceRoutingContentHash: evidence.sourceRoutingContentHash,
      sourceMemberDispositionContentHash: evidence.sourceMemberDispositionContentHash,
      sourceMemberEvidenceContentHash: evidence.sourceMemberEvidenceContentHash,
      collectionContext: evidence.collectionContext,
      memberIdentityContexts: evidence.memberIdentityContexts,
      sourcePageId: evidence.sourcePageId,
      resolvedTitle: evidence.resolvedTitle,
      membershipClassification: evidence.membershipClassification,
      sourceRevision: evidence.sourceRevision,
      sourceTimestamp: evidence.sourceTimestamp,
      sourceUrl: evidence.sourceUrl,
      sourceContentHash: evidence.sourceContentHash,
      sourcePageSubjectDisposition: evidence.sourcePageSubjectDisposition,
      routingDecision: evidence.routingDecision,
      sourceBlockers: evidence.sourceBlockers || [],
      sourceSignatureBlockers: evidence.sourceSignatureBlockers || [],
      sourceDispositionBlockers: evidence.sourceDispositionBlockers || [],
      sourceRelationshipRoutingBlockers: evidence.sourceRelationshipRoutingBlockers || [],
      sourceRelationshipEvidenceBlockers: evidence.blockers || [],
      sourceSignatureJoin: evidence.sourceSignatureJoin || null,
      collectionMembershipEvidence: evidence.collectionMembershipEvidence,
      sourcePageEvidence: evidence.sourcePageEvidence,
      relationshipCandidateObservations: evidence.relationshipCandidateObservations,
      sourceRelationshipEvidenceSummary: evidenceSummary(evidence),
      sourceRelationshipDispositionSignals: expected.signals,
      sourceRelationshipDisposition: expected.disposition,
      collectionActivityIdentityReview: { state: 'unreviewed', identity: null, evidenceKeys: [] },
      linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: expected.disposition.state === 'source_declaration_supported' ? 'source_relationship_disposed_collection_relationship_unresolved' : 'source_relationship_disposition_blocked'
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions(records, { relationshipEvidenceRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions(records = [], { relationshipEvidenceRecords = [], policy = {} } = {}) {
  const compiled = compileRelationshipDispositionPolicy(policy);
  const expectedKeys = relationshipEvidenceRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(relationshipEvidenceRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => !outputByKey.has(key) || inputProjection(inputByKey.get(key)) !== outputProjection(outputByKey.get(key)));
  const inputStructuralFailures = relationshipEvidenceRecords.filter(record =>
    record.contract !== policy.inputContract
    || !record.contentHash
    || record.accountIndependent !== true
    || record.sourceSignatureJoin?.exactHashIdentityRevisionAndContextMatch !== true
    || record.relationshipCandidateObservations?.relationshipVerdict !== null
    || record.collectionActivityIdentityReview?.state !== 'unreviewed'
    || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidDispositionRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedDisposition(input, compiled);
    return record.contract !== policy.recordContract
      || JSON.stringify(record.sourceRelationshipDispositionSignals || []) !== JSON.stringify(expected.signals)
      || JSON.stringify(record.sourceRelationshipDisposition || null) !== JSON.stringify(expected.disposition)
      || record.collectionActivityIdentityReview?.state !== 'unreviewed'
      || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
      || record.canonicalGameEntityIdentity !== null
      || record.canonicalActivityIdentity !== null
      || record.repeatabilityReview?.state !== 'unreviewed'
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const supported = records.filter(record => record.sourceRelationshipDisposition?.state === 'source_declaration_supported');
  const conflicts = records.filter(record => record.sourceRelationshipDisposition?.state === 'blocked_conflicting_source_relationship_declarations');
  const unresolved = records.filter(record => record.sourceRelationshipDisposition?.state === 'unresolved_no_supported_source_relationship_declaration');
  const invalidStates = records.filter(record => !['source_declaration_supported', 'blocked_conflicting_source_relationship_declarations', 'unresolved_no_supported_source_relationship_declaration'].includes(record.sourceRelationshipDisposition?.state)).map(record => record.memberCandidateKey);
  const relationshipClassCounts = {};
  for (const record of supported) {
    const relationshipClass = record.sourceRelationshipDisposition.relationshipClass;
    relationshipClassCounts[relationshipClass] = (relationshipClassCounts[relationshipClass] || 0) + 1;
  }
  const unexpectedSignalKinds = sorted(unique(records.flatMap(record => (record.sourceRelationshipDispositionSignals || []).map(signal => signal.signalKind)).filter(kind => kind !== 'exact_lead_relationship_declaration_rule')));
  const invalidSignalEvidence = records.filter(record => (record.sourceRelationshipDispositionSignals || []).some(signal =>
    !signal.evidenceKey
    || !signal.ruleKey
    || !signal.relationshipClass
    || !signal.sourcePageSubjectClass
    || !signal.matchedDeclarations?.length
    || signal.matchedDeclarations.some(match => !match.rawText || !match.plainText || !match.matchedText || !match.sourceLocator)
  )).map(record => record.memberCandidateKey);
  const collectionDerivedSignals = records.filter(record => (record.sourceRelationshipDispositionSignals || []).some(signal =>
    signal.collectionContext !== undefined
    || signal.collectionDisplayLabel !== undefined
    || signal.membershipClassification !== undefined
    || signal.resolvedTitle !== undefined
    || signal.collectionRowLink !== undefined
  )).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.collectionActivityIdentityReview?.state !== 'unreviewed'
    || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed'
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_relationship_evidence_packets');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_relationship_disposition_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_disposition_collection_membership_or_alias_contexts_changed');
  if (inputStructuralFailures.length) structuralBlockers.push('one_or_more_input_relationship_evidence_packets_failed_structural_integrity');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_class_relationship_disposition_policy_forbidden');
  if (compiled.invalidRuleKeys.length || compiled.duplicateRuleKeys.length) structuralBlockers.push('one_or_more_relationship_declaration_rules_invalid_or_duplicate');
  if (invalidDispositionRecords.length || invalidStates.length || unexpectedSignalKinds.length || invalidSignalEvidence.length) structuralBlockers.push('one_or_more_source_relationship_dispositions_not_supported_by_exact_lead_declarations');
  if (collectionDerivedSignals.length) structuralBlockers.push('collection_context_link_label_alias_or_page_identity_used_as_source_relationship_disposition_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_source_relationship_dispositions');
  const dispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (conflicts.length) blockers.push('one_or_more_source_relationship_declarations_conflict');
  if (unresolved.length) blockers.push('one_or_more_source_relationship_dispositions_remain_unresolved');
  blockers.push(
    'source_relationship_class_does_not_establish_collection_activity_identity',
    'exact_linked_subject_collection_relationship_review_pending',
    'canonical_game_entity_and_activity_identities_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-unresolved-subject-relationship-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedRelationshipEvidencePacketCount: expectedKeys.length,
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
      relationshipDeclarationRuleCount: compiled.rules.length,
      invalidRuleKeys: compiled.invalidRuleKeys,
      duplicateRuleKeys: compiled.duplicateRuleKeys,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      unexpectedSignalKinds,
      invalidSignalEvidenceMemberCandidateKeys: invalidSignalEvidence,
      collectionDerivedSignalMemberCandidateKeys: collectionDerivedSignals
    },
    sourceRelationshipDispositionCoverage: {
      attemptedCount: records.length,
      sourceSupportedCount: supported.length,
      conflictingCount: conflicts.length,
      unresolvedCount: unresolved.length,
      relationshipClassCounts: Object.fromEntries(Object.entries(relationshipClassCounts).sort((a, b) => a[0].localeCompare(b[0]))),
      exactLeadDeclarationSignalCount: records.reduce((sum, record) => sum + (record.sourceRelationshipDispositionSignals || []).length, 0),
      matchedLeadDeclarationCount: records.reduce((sum, record) => sum + (record.sourceRelationshipDispositionSignals || []).reduce((inner, signal) => inner + (signal.matchedDeclarations || []).length, 0), 0),
      conflictMemberCandidateKeys: conflicts.map(record => record.memberCandidateKey),
      unresolvedMemberCandidateKeys: unresolved.map(record => record.memberCandidateKey),
      invalidStateMemberCandidateKeys: invalidStates,
      invalidDispositionMemberCandidateKeys: invalidDispositionRecords
    },
    semanticPromotionCoverage: {
      collectionActivityIdentityReviewedCount: records.filter(record => record.collectionActivityIdentityReview?.state !== 'unreviewed').length,
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
    dispositionAttemptCoverageComplete,
    sourceRelationshipDispositionComplete: dispositionAttemptCoverageComplete && conflicts.length === 0 && unresolved.length === 0,
    collectionActivityIdentityReviewComplete: false,
    linkedSubjectRelationshipReviewComplete: false,
    repeatabilityReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: dispositionAttemptCoverageComplete
  };
}
