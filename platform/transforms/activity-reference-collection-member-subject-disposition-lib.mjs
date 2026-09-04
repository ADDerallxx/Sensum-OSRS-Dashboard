import {
  buildActivityCandidateSubjectDispositions,
  compileActivityCandidateSubjectDispositionPolicy,
  findActivityCandidateSubjectDispositionAccountState,
  plainTextFromWiki
} from './activity-candidate-subject-disposition-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));

function firstNonEmptyLead(record) {
  const paragraphs = record.leadParagraphEvidence || [];
  const index = paragraphs.findIndex(paragraph => plainTextFromWiki(paragraph?.rawText || '').length > 0);
  if (index < 0) return null;
  const paragraph = paragraphs[index];
  return {
    sourceParagraphIndex: index,
    rawText: paragraph.rawText,
    plainText: plainTextFromWiki(paragraph.rawText),
    sourceLocator: paragraph.sourceLocator
  };
}

function genericEvidenceProjection(evidence) {
  const selectedLead = firstNonEmptyLead(evidence);
  return {
    contract: 'sensum.activity-candidate-source-evidence.v1',
    candidateKey: evidence.memberCandidateKey,
    sourcePageId: evidence.sourcePageId,
    resolvedTitle: evidence.resolvedTitle,
    skillKeys: [],
    statementKeys: [],
    sourceRevision: evidence.sourceRevision,
    sourceTimestamp: evidence.sourceTimestamp,
    sourceUrl: evidence.sourceUrl,
    sourceContentHash: evidence.sourceContentHash,
    contentHash: evidence.contentHash,
    sourceSignatureContexts: [{
      sourceMemberEvidenceContentHash: evidence.contentHash,
      collectionContext: evidence.collectionContext,
      memberIdentityContexts: evidence.memberIdentityContexts,
      membershipClassification: evidence.membershipClassification
    }],
    infoboxEvidence: evidence.infoboxEvidence,
    leadParagraphEvidence: selectedLead ? [{ rawText: selectedLead.rawText, sourceLocator: selectedLead.sourceLocator }] : []
  };
}

const inputContextProjection = evidence => JSON.stringify({
  memberCandidateKey: evidence.memberCandidateKey,
  sourceMemberEvidenceContentHash: evidence.contentHash,
  collectionContext: evidence.collectionContext,
  memberIdentityContexts: evidence.memberIdentityContexts,
  sourcePageId: evidence.sourcePageId,
  resolvedTitle: evidence.resolvedTitle,
  membershipClassification: evidence.membershipClassification,
  sourceRevision: String(evidence.sourceRevision || ''),
  sourceTimestamp: evidence.sourceTimestamp || null,
  sourceUrl: evidence.sourceUrl || null,
  sourceContentHash: evidence.sourceContentHash || null,
  sourceEvidenceBlockers: evidence.blockers || []
});

const outputContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
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
  sourceEvidenceBlockers: record.sourceEvidenceBlockers || []
});

function forbiddenMemberPolicyPaths(policy = {}) {
  const paths = [...compileActivityCandidateSubjectDispositionPolicy(policy).pageSpecificPolicyPaths];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:membershipClassification|membershipClassifications|collectionClass|collectionClasses|collectionDisplayLabel|collectionDisplayLabels|collectionCandidateKey|collectionCandidateKeys)$/i.test(name)) paths.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(paths));
}

export function buildActivityReferenceCollectionMemberSubjectDispositions({ evidenceRecords = [], policy = {} }) {
  const projectedEvidence = evidenceRecords.map(genericEvidenceProjection);
  const generic = buildActivityCandidateSubjectDispositions({ evidenceRecords: projectedEvidence, policy });
  const evidenceByKey = new Map(evidenceRecords.map(record => [record.memberCandidateKey, record]));
  const records = generic.records.map(disposition => {
    const evidence = evidenceByKey.get(disposition.candidateKey);
    const selectedLead = firstNonEmptyLead(evidence);
    return {
      contract: 'sensum.activity-reference-collection-member-subject-disposition.v1',
      memberCandidateKey: evidence.memberCandidateKey,
      sourceMemberEvidenceContentHash: evidence.contentHash,
      collectionContext: evidence.collectionContext,
      memberIdentityContexts: evidence.memberIdentityContexts,
      sourcePageId: evidence.sourcePageId,
      resolvedTitle: evidence.resolvedTitle,
      membershipClassification: evidence.membershipClassification,
      sourceRevision: evidence.sourceRevision,
      sourceTimestamp: evidence.sourceTimestamp,
      sourceUrl: evidence.sourceUrl,
      sourceContentHash: evidence.sourceContentHash,
      sourceEvidenceBlockers: evidence.blockers || [],
      infoboxTypeAssessment: disposition.infoboxTypeAssessment,
      leadParagraphSelection: selectedLead,
      dispositionSignals: disposition.dispositionSignals,
      subjectDisposition: disposition.subjectDisposition,
      repeatabilityReview: disposition.repeatabilityReview,
      memberExpansionReview: disposition.memberExpansionReview,
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique([...(evidence.blockers || []), ...disposition.blockers, 'collection_membership_is_context_not_disposition_evidence']),
      state: disposition.state
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberSubjectDispositions(records, { evidenceRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberSubjectDispositions(records = [], { evidenceRecords = [], policy = {} } = {}) {
  const expectedKeys = evidenceRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const evidenceByKey = new Map(evidenceRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const evidence = evidenceByKey.get(key);
    const output = outputByKey.get(key);
    return !output || inputContextProjection(evidence) !== outputContextProjection(output);
  });
  const leadSelectionMismatches = expectedKeys.filter(key => {
    const expected = firstNonEmptyLead(evidenceByKey.get(key));
    const actual = outputByKey.get(key)?.leadParagraphSelection || null;
    return JSON.stringify(expected) !== JSON.stringify(actual);
  });
  const forbiddenPolicyPaths = forbiddenMemberPolicyPaths(policy);
  const resolved = records.filter(record => record.subjectDisposition?.state === 'source_supported');
  const conflicts = records.filter(record => record.subjectDisposition?.state === 'blocked_conflicting_source_declarations');
  const unresolved = records.filter(record => record.subjectDisposition?.state === 'unresolved_no_supported_source_declaration');
  const unmappedTypes = records.filter(record => record.subjectDisposition?.state === 'blocked_unmapped_infobox_type');
  const allowedStates = new Set(['source_supported', 'blocked_conflicting_source_declarations', 'unresolved_no_supported_source_declaration', 'blocked_unmapped_infobox_type']);
  const invalidStates = records.filter(record => !allowedStates.has(record.subjectDisposition?.state)).map(record => record.memberCandidateKey);
  const resolvedWithoutOneDisposition = resolved.filter(record => !record.subjectDisposition?.disposition || record.subjectDisposition?.conflictingDispositions?.length || !(record.dispositionSignals || []).length || unique(record.dispositionSignals.map(signal => signal.disposition)).length !== 1).map(record => record.memberCandidateKey);
  const conflictWithoutDistinctSignals = conflicts.filter(record => unique((record.dispositionSignals || []).map(signal => signal.disposition)).length < 2 || record.subjectDisposition?.disposition !== null).map(record => record.memberCandidateKey);
  const unsupportedSignalKinds = unique(records.flatMap(record => (record.dispositionSignals || []).map(signal => signal.signalKind)).filter(kind => !['infobox_type_parameter', 'first_lead_paragraph_declaration'].includes(kind)));
  const collectionDerivedSignals = records.filter(record => (record.dispositionSignals || []).some(signal => signal.membershipClassification !== undefined || signal.collectionContext !== undefined || signal.collectionDisplayLabel !== undefined || signal.resolvedTitle !== undefined)).map(record => record.memberCandidateKey);
  const accountStateFindings = findActivityCandidateSubjectDispositionAccountState(records);
  const unsupportedPromotions = records.filter(record => record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null || record.optimizerEligible !== false || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed').map(record => record.memberCandidateKey);
  const missingInfoboxes = evidenceRecords.filter(record => record.infoboxEvidence === null);
  const supportedInfoboxMissingType = evidenceRecords.filter(record => record.infoboxEvidence !== null && !record.infoboxEvidence.parameters?.some(parameter => parameter.parameterKind === 'named' && parameter.parameterKey === 'type'));
  const observedTypeValues = Object.fromEntries(sorted(unique(records.map(record => record.infoboxTypeAssessment?.normalizedValue).filter(Boolean))).map(value => [value, records.filter(record => record.infoboxTypeAssessment?.normalizedValue === value).length]));
  const dispositionCounts = Object.fromEntries(sorted(unique(resolved.map(record => record.subjectDisposition.disposition))).map(disposition => [disposition, resolved.filter(record => record.subjectDisposition.disposition === disposition).length]));
  const recordSummary = record => ({
    memberCandidateKey: record.memberCandidateKey,
    collectionDisplayLabel: record.collectionContext?.memberCellEvidence?.plainText || null,
    resolvedTitle: record.resolvedTitle,
    membershipClassification: record.membershipClassification,
    sourceRevision: record.sourceRevision,
    infoboxType: record.infoboxTypeAssessment?.normalizedValue || null,
    dispositions: unique((record.dispositionSignals || []).map(signal => signal.disposition)),
    signalKeys: (record.dispositionSignals || []).map(signal => signal.signalKey)
  });
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_collection_member_source_evidence_records');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_member_candidate_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_identity_revision_hash_collection_or_alias_context_values_changed');
  if (leadSelectionMismatches.length) structuralBlockers.push('one_or_more_first_non_empty_lead_selections_changed');
  if (forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_class_subject_disposition_policy_forbidden');
  if (invalidStates.length || resolvedWithoutOneDisposition.length || conflictWithoutDistinctSignals.length || unsupportedSignalKinds.length) structuralBlockers.push('one_or_more_member_subject_disposition_rules_invalid');
  if (collectionDerivedSignals.length) structuralBlockers.push('collection_context_used_as_subject_disposition_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_canonical_repeatability_member_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_member_subject_dispositions');
  const dispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (missingInfoboxes.length) blockers.push('one_or_more_member_sources_have_no_supported_activity_infobox');
  if (supportedInfoboxMissingType.length) blockers.push('one_or_more_supported_activity_infoboxes_lack_type_parameter');
  if (conflicts.length) blockers.push('one_or_more_explicit_member_source_subject_dispositions_conflict');
  if (unresolved.length) blockers.push('one_or_more_member_subject_dispositions_unresolved');
  if (unmappedTypes.length) blockers.push('one_or_more_member_infobox_type_values_unmapped');
  blockers.push('canonical_game_entity_and_activity_identities_not_established', 'repeatability_and_member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established');
  return {
    contract: 'sensum.activity-reference-collection-member-subject-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedEvidenceRecordCount: expectedKeys.length,
      dispositionRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      identityRevisionHashCollectionOrAliasContextMismatchMemberCandidateKeys: contextMismatches,
      leadSelectionMismatchMemberCandidateKeys: leadSelectionMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length && !leadSelectionMismatches.length
    },
    policyCoverage: {
      policy: policy.policy || null,
      infoboxTypeRuleCount: Object.keys(policy.infoboxTypeDispositions || {}).length,
      leadDeclarationRuleCount: (policy.leadDeclarationRules || []).length,
      forbiddenPolicyPaths,
      observedInfoboxTypeValues: observedTypeValues,
      unmappedInfoboxTypeValues: sorted(unique(unmappedTypes.map(record => record.infoboxTypeAssessment.normalizedValue))),
      unsupportedSignalKinds,
      collectionContextDerivedSignalMemberCandidateKeys: collectionDerivedSignals
    },
    sourceDeclarationCoverage: {
      supportedInfoboxCount: evidenceRecords.length - missingInfoboxes.length,
      missingSupportedInfoboxCount: missingInfoboxes.length,
      supportedInfoboxMissingTypeParameterCount: supportedInfoboxMissingType.length,
      firstNonEmptyLeadSelectedCount: records.filter(record => record.leadParagraphSelection !== null).length,
      noNonEmptyLeadCount: records.filter(record => record.leadParagraphSelection === null).length,
      infoboxSignalCount: records.reduce((sum, record) => sum + (record.dispositionSignals || []).filter(signal => signal.signalKind === 'infobox_type_parameter').length, 0),
      leadSignalCount: records.reduce((sum, record) => sum + (record.dispositionSignals || []).filter(signal => signal.signalKind === 'first_lead_paragraph_declaration').length, 0)
    },
    dispositionCoverage: {
      sourceSupportedCount: resolved.length,
      conflictingCount: conflicts.length,
      unresolvedCount: unresolved.length,
      unmappedInfoboxTypeCount: unmappedTypes.length,
      dispositionCounts,
      conflictDetails: conflicts.map(recordSummary),
      unresolvedDetails: unresolved.map(recordSummary),
      invalidStateMemberCandidateKeys: invalidStates,
      resolvedWithoutExactlyOneSupportedDispositionMemberCandidateKeys: resolvedWithoutOneDisposition,
      conflictsWithoutDistinctSupportedSignalsMemberCandidateKeys: conflictWithoutDistinctSignals
    },
    semanticPromotionCoverage: {
      subjectDispositionAttemptedCount: records.length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    dispositionAttemptCoverageComplete,
    subjectDispositionComplete: dispositionAttemptCoverageComplete && conflicts.length === 0 && unresolved.length === 0 && unmappedTypes.length === 0,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: dispositionAttemptCoverageComplete
  };
}
