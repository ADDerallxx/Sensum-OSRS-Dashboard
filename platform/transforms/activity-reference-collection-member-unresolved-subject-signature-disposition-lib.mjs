import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';
import { compileUnlockLinkedPageEntityTypePolicy } from './unlock-linked-page-entity-type-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();

function policyForbiddenPaths(policy = {}) {
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

function sourceSummary(record = {}) {
  return {
    rootTemplateCount: (record.rootTemplates || []).length,
    directCategoryCount: (record.directCategories || []).length,
    leadParagraphCount: (record.leadParagraphEvidence || []).length,
    headingCount: (record.headingEvidence || []).length,
    sourceAuthoredLinkOccurrenceCount: (record.sourceAuthoredLinks || []).length,
    mainNamespaceLinkOccurrenceCount: (record.sourceAuthoredLinks || []).filter(link => link.namespaceClass === 'main').length,
    rootTemplateDelimiterAudit: record.rootTemplateDelimiterAudit || null,
    sourceLinkDelimiterAudit: record.sourceLinkDelimiterAudit || null
  };
}

function exactMappedRootTemplateSignals(record, compiledEntityPolicy) {
  return (record.rootTemplates || []).flatMap((template, index) => {
    const templateKey = normalize(template.templateKey || template.template);
    const entityType = compiledEntityPolicy.templateToType.get(templateKey);
    if (!entityType) return [];
    return [{
      evidenceKey: `${record.memberCandidateKey}:root-template:${index + 1}`,
      signalKind: 'exact_mapped_root_template',
      template: template.template,
      templateKey,
      sourceLocator: { line: template.line },
      sourcePageSubjectClass: entityType,
      sourceEntityTypePolicy: compiledEntityPolicy.policyId,
      sourcePageId: record.sourcePageId,
      sourceRevision: String(record.sourceRevision || ''),
      sourceTimestamp: record.sourceTimestamp || null,
      sourceUrl: record.sourceUrl || null,
      sourceContentHash: record.sourceContentHash || null
    }];
  });
}

function expectedDisposition(record, compiledEntityPolicy) {
  const signals = exactMappedRootTemplateSignals(record, compiledEntityPolicy);
  const classes = sorted(unique(signals.map(signal => signal.sourcePageSubjectClass)));
  if (classes.length === 1) return {
    signals,
    disposition: { state: 'source_signature_supported', disposition: classes[0], conflictingDispositions: [], evidenceKeys: signals.map(signal => signal.evidenceKey) }
  };
  if (classes.length > 1) return {
    signals,
    disposition: { state: 'blocked_conflicting_mapped_root_template_classes', disposition: null, conflictingDispositions: classes, evidenceKeys: signals.map(signal => signal.evidenceKey) }
  };
  return {
    signals,
    disposition: { state: 'unresolved_no_mapped_root_template_class', disposition: null, conflictingDispositions: [], evidenceKeys: [] }
  };
}

const inputContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceSignatureContentHash: record.contentHash,
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
  sourceDisposition: record.sourceDisposition || null,
  routingDecision: record.routingDecision || null,
  sourceBlockers: record.sourceBlockers || [],
  sourceSignatureBlockers: record.blockers || [],
  sourceSignatureEvidenceSummary: sourceSummary(record)
});

const outputContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
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
  sourceDisposition: record.sourceDisposition || null,
  routingDecision: record.routingDecision || null,
  sourceBlockers: record.sourceBlockers || [],
  sourceSignatureBlockers: record.sourceSignatureBlockers || [],
  sourceSignatureEvidenceSummary: record.sourceSignatureEvidenceSummary || null
});

export function buildActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions({ sourceSignatureRecords = [], policy = {}, entityTypePolicy = {} }) {
  const compiledEntityPolicy = compileUnlockLinkedPageEntityTypePolicy(entityTypePolicy);
  const records = sourceSignatureRecords.map(signature => {
    const expected = expectedDisposition(signature, compiledEntityPolicy);
    const blockers = [];
    if (expected.disposition.state === 'unresolved_no_mapped_root_template_class') blockers.push('source_page_subject_class_unresolved_no_mapped_root_template');
    if (expected.disposition.state === 'blocked_conflicting_mapped_root_template_classes') blockers.push('source_page_subject_class_conflict');
    blockers.push(
      'source_page_subject_class_does_not_establish_collection_activity_identity',
      'linked_subject_relationship_review_pending',
      'canonical_game_entity_and_activity_identities_not_established',
      'repeatability_and_member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    if (expected.disposition.disposition === 'activity_page') blockers.push('activity_page_type_does_not_prove_repeatability');
    return {
      contract: policy.recordContract || 'sensum.activity-reference-collection-member-unresolved-subject-signature-disposition.v1',
      memberCandidateKey: signature.memberCandidateKey,
      sourceSignatureContentHash: signature.contentHash,
      sourceRoutingContentHash: signature.sourceRoutingContentHash,
      sourceMemberDispositionContentHash: signature.sourceMemberDispositionContentHash,
      sourceMemberEvidenceContentHash: signature.sourceMemberEvidenceContentHash,
      collectionContext: signature.collectionContext,
      memberIdentityContexts: signature.memberIdentityContexts,
      sourcePageId: signature.sourcePageId,
      resolvedTitle: signature.resolvedTitle,
      membershipClassification: signature.membershipClassification,
      sourceRevision: signature.sourceRevision,
      sourceTimestamp: signature.sourceTimestamp,
      sourceUrl: signature.sourceUrl,
      sourceContentHash: signature.sourceContentHash,
      sourceDisposition: signature.sourceDisposition,
      routingDecision: signature.routingDecision,
      sourceBlockers: signature.sourceBlockers || [],
      sourceSignatureBlockers: signature.blockers || [],
      sourceSignatureEvidenceSummary: sourceSummary(signature),
      dispositionSignals: expected.signals,
      sourcePageSubjectDisposition: expected.disposition,
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
      state: expected.disposition.state === 'source_signature_supported' ? 'source_page_subject_disposed_collection_activity_unresolved' : 'source_page_subject_disposition_blocked'
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions(records, { sourceSignatureRecords, policy, entityTypePolicy }) };
}

export function auditActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions(records = [], { sourceSignatureRecords = [], policy = {}, entityTypePolicy = {} } = {}) {
  const compiledEntityPolicy = compileUnlockLinkedPageEntityTypePolicy(entityTypePolicy);
  const expectedKeys = sourceSignatureRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(sourceSignatureRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => !outputByKey.has(key) || inputContextProjection(inputByKey.get(key)) !== outputContextProjection(outputByKey.get(key)));
  const inputStructuralFailures = sourceSignatureRecords.filter(record =>
    record.contract !== policy.inputContract
    || !record.contentHash
    || record.accountIndependent !== true
    || record.rootTemplateDelimiterAudit?.balanced !== true
    || record.sourceLinkDelimiterAudit?.balanced !== true
  ).map(record => record.memberCandidateKey);
  const invalidDispositionRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedDisposition(input, compiledEntityPolicy);
    return record.contract !== policy.recordContract
      || JSON.stringify(record.dispositionSignals || []) !== JSON.stringify(expected.signals)
      || JSON.stringify(record.sourcePageSubjectDisposition || null) !== JSON.stringify(expected.disposition)
      || record.optimizerEligible !== false
      || record.canonicalGameEntityIdentity !== null
      || record.canonicalActivityIdentity !== null
      || record.collectionActivityIdentityReview?.state !== 'unreviewed'
      || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
      || record.repeatabilityReview?.state !== 'unreviewed'
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed';
  }).map(record => record.memberCandidateKey);
  const forbiddenPolicyPaths = policyForbiddenPaths(policy);
  const entityPolicyReferenceAligned = policy.sourceEntityTypePolicy?.id === compiledEntityPolicy.policyId;
  const unsupportedSignalKinds = sorted(unique(records.flatMap(record => (record.dispositionSignals || []).map(signal => signal.signalKind)).filter(kind => kind !== 'exact_mapped_root_template')));
  const collectionDerivedSignals = records.filter(record => (record.dispositionSignals || []).some(signal =>
    signal.collectionContext !== undefined
    || signal.collectionDisplayLabel !== undefined
    || signal.membershipClassification !== undefined
    || signal.resolvedTitle !== undefined
    || signal.linkedSubject !== undefined
  )).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const supported = records.filter(record => record.sourcePageSubjectDisposition?.state === 'source_signature_supported');
  const conflicts = records.filter(record => record.sourcePageSubjectDisposition?.state === 'blocked_conflicting_mapped_root_template_classes');
  const unresolved = records.filter(record => record.sourcePageSubjectDisposition?.state === 'unresolved_no_mapped_root_template_class');
  const invalidStates = records.filter(record => !['source_signature_supported', 'blocked_conflicting_mapped_root_template_classes', 'unresolved_no_mapped_root_template_class'].includes(record.sourcePageSubjectDisposition?.state)).map(record => record.memberCandidateKey);
  const subjectClassCounts = {};
  for (const record of supported) {
    const subjectClass = record.sourcePageSubjectDisposition.disposition;
    subjectClassCounts[subjectClass] = (subjectClassCounts[subjectClass] || 0) + 1;
  }
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
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_unresolved_subject_source_signature_records');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_subject_signature_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_collection_membership_or_alias_contexts_changed');
  if (inputStructuralFailures.length) structuralBlockers.push('one_or_more_input_source_signature_records_failed_structural_integrity');
  if (forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_class_signature_disposition_policy_forbidden');
  if (!entityPolicyReferenceAligned || compiledEntityPolicy.duplicateTemplateSignals.length) structuralBlockers.push('source_entity_type_policy_reference_or_root_template_map_invalid');
  if (invalidDispositionRecords.length || invalidStates.length || unsupportedSignalKinds.length) structuralBlockers.push('one_or_more_source_page_subject_dispositions_not_supported_by_exact_mapped_root_templates');
  if (collectionDerivedSignals.length) structuralBlockers.push('collection_context_or_link_used_as_source_page_subject_disposition_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_source_page_subject_dispositions');
  const dispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (conflicts.length) blockers.push('one_or_more_source_pages_have_conflicting_mapped_root_template_classes');
  if (unresolved.length) blockers.push('one_or_more_source_page_subject_dispositions_remain_unresolved');
  blockers.push(
    'collection_activity_identity_not_established_by_source_page_subject_class',
    'linked_subject_relationship_review_pending',
    'canonical_game_entity_and_activity_identities_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-unresolved-subject-signature-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedSourceSignatureCount: expectedKeys.length,
      dispositionRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: inputStructuralFailures,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: policy.policy || null,
      sourceEntityTypePolicy: compiledEntityPolicy.policyId,
      sourceEntityTypePolicyReferenceAligned: entityPolicyReferenceAligned,
      mappedRootTemplateCount: compiledEntityPolicy.templateToType.size,
      duplicateRootTemplateSignals: compiledEntityPolicy.duplicateTemplateSignals,
      forbiddenPolicyPaths,
      unsupportedSignalKinds,
      collectionContextOrLinkDerivedSignalMemberCandidateKeys: collectionDerivedSignals
    },
    sourcePageSubjectDispositionCoverage: {
      attemptedCount: records.length,
      sourceSupportedCount: supported.length,
      conflictingCount: conflicts.length,
      unresolvedCount: unresolved.length,
      subjectClassCounts: Object.fromEntries(Object.entries(subjectClassCounts).sort((a, b) => a[0].localeCompare(b[0]))),
      exactMappedRootTemplateSignalCount: records.reduce((sum, record) => sum + (record.dispositionSignals || []).length, 0),
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
    sourcePageSubjectDispositionComplete: dispositionAttemptCoverageComplete && conflicts.length === 0 && unresolved.length === 0,
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
