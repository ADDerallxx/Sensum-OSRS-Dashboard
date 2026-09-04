import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceLinkedSubjectRelationshipDispositionContentHash',
  'canonicalActivityIdentityEvidence', 'canonicalActivityIdentityCandidateObservations',
  'canonicalGameEntityIdentity', 'canonicalActivityIdentity', 'repeatabilityReview',
  'memberExpansionReview', 'mechanicsReview', 'optimizerEligible', 'accountIndependent'
]);

function preservedInput(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !stageFields.has(key)));
}

const normalizedText = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

export function compileCanonicalActivityIdentityEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'onePacketPerSupportedLinkedSubjectRelationshipDisposition',
    'collectionDefinitionRetainsExactSourceRevisionRowCellsNarrativeAndLinks',
    'collectionActivityCandidateIdentityAndReviewMustBeSupported',
    'linkedSubjectRelationshipDispositionAndReviewMustBeSupported',
    'linkedSourceRoleDeclarationsAndBothDispositionSignalSetsAreRetained',
    'memberLinkSourceTitleAndStableRevisionHashAlignmentsAreRetained',
    'exactLabelSourceTitleAgreementIsRecordedOnlyAsAReviewObservation',
    'labelsTitlesPageIdsAliasesAndCollectionClassesCannotCreateACanonicalIdentityVerdict',
    'canonicalActivityIdentityVerdictRemainsNull',
    'canonicalIdentityRepeatabilityMembersMechanicsAndOptimizerEligibilityRemainClosed',
    'missingContradictoryOrConditionMismatchedEvidenceRemainsExplicit',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  const forbiddenPolicyPaths = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) forbiddenPolicyPaths.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return { policyId: policy.policy || null, invalidRules, forbiddenPolicyPaths: unique(forbiddenPolicyPaths).sort() };
}

function buildPacket(record) {
  const collection = record.collectionActivityEvidence || {};
  const observations = record.collectionActivityIdentityCandidateObservations || {};
  const identityReview = record.collectionActivityIdentityReview || {};
  const relationshipReview = record.linkedSubjectRelationshipReview || {};
  const label = identityReview.identity?.collectionActivityLabel || null;
  const title = record.resolvedTitle || null;
  const narrativeCells = (record.collectionActivityIdentityDispositionSignals || [])
    .flatMap(signal => signal.collectionNarrativeEvidence || [])
    .filter(cell => cell.sourceLocator && String(cell.plainText || '').trim());
  const sourceDeclarations = (record.sourceRelationshipDispositionSignals || []).flatMap(signal => signal.matchedDeclarations || []);
  const deficiencies = [];
  if (!collection.collectionSource?.pageId || !collection.collectionSource?.revision || !collection.collectionSource?.contentHash) deficiencies.push('collection_source_identity_revision_or_hash_missing');
  if (!collection.rowEvidence?.sourceLocator || !(collection.allRowCellEvidence || []).length) deficiencies.push('collection_row_or_cells_missing');
  if (!collection.memberCellEvidence?.sourceLocator || !String(collection.memberCellEvidence?.plainText || '').trim()) deficiencies.push('source_located_collection_activity_label_missing');
  if (!narrativeCells.length) deficiencies.push('source_located_collection_activity_narrative_missing');
  if (!(collection.directRowWikilinkEvidence || []).length) deficiencies.push('collection_row_link_evidence_missing');
  if (record.collectionActivityIdentityDisposition?.state !== 'source_supported_collection_activity_candidate'
    || identityReview.state !== 'reviewed_source_supported_candidate'
    || identityReview.identity?.canonicalIdentityEstablished !== false) deficiencies.push('collection_activity_candidate_identity_not_supported');
  if (record.linkedSubjectRelationshipDisposition?.state !== 'source_supported_linked_subject_relationship'
    || relationshipReview.state !== 'reviewed_source_supported'
    || relationshipReview.relationships?.length !== 1
    || relationshipReview.relationships[0]?.canonicalIdentityEstablished !== false) deficiencies.push('linked_subject_relationship_not_supported');
  if (!(record.sourceRelationshipDispositionSignals || []).length || !sourceDeclarations.length) deficiencies.push('linked_source_role_declarations_missing');
  if (!(record.collectionActivityIdentityDispositionSignals || []).length) deficiencies.push('collection_activity_identity_signals_missing');
  if (!(record.linkedSubjectRelationshipDispositionSignals || []).length) deficiencies.push('linked_subject_relationship_signals_missing');
  if (!(observations.memberLinkSourceTitleAlignments || []).length) deficiencies.push('member_link_source_title_alignment_missing');
  if (!(observations.stableSourceIdentityAlignments || []).length) deficiencies.push('stable_source_identity_alignment_missing');
  const labelMatchesSourceTitle = normalizedText(label) !== '' && normalizedText(label) === normalizedText(title);
  return {
    evidence: {
      collectionDefinition: {
        collectionSource: collection.collectionSource || null,
        sectionEvidence: collection.sectionEvidence || null,
        tableEvidence: collection.tableEvidence || null,
        rowEvidence: collection.rowEvidence || null,
        memberCellEvidence: collection.memberCellEvidence || null,
        narrativeCellEvidence: narrativeCells,
        allRowCellEvidence: collection.allRowCellEvidence || [],
        directRowWikilinkEvidence: collection.directRowWikilinkEvidence || []
      },
      collectionActivityCandidate: {
        disposition: record.collectionActivityIdentityDisposition || null,
        dispositionSignals: record.collectionActivityIdentityDispositionSignals || [],
        review: identityReview
      },
      linkedSubjectRelationship: {
        sourcePage: {
          sourcePageId: record.sourcePageId,
          resolvedTitle: record.resolvedTitle,
          sourceRevision: String(record.sourceRevision || ''),
          sourceTimestamp: record.sourceTimestamp || null,
          sourceUrl: record.sourceUrl || null,
          sourceContentHash: record.sourceContentHash || null
        },
        sourcePageSubjectDisposition: record.sourcePageSubjectDisposition || null,
        sourceRoleDisposition: record.sourceRelationshipDisposition || null,
        sourceRoleDispositionSignals: record.sourceRelationshipDispositionSignals || [],
        relationshipDisposition: record.linkedSubjectRelationshipDisposition || null,
        relationshipDispositionSignals: record.linkedSubjectRelationshipDispositionSignals || [],
        review: relationshipReview
      },
      crossSourceAlignment: {
        memberLinkSourceTitleAlignments: observations.memberLinkSourceTitleAlignments || [],
        stableSourceIdentityAlignments: observations.stableSourceIdentityAlignments || [],
        sharedMainNamespaceLinkTargets: observations.sharedMainNamespaceLinkTargets || []
      },
      evidenceState: deficiencies.length
        ? 'canonical_activity_identity_evidence_incomplete'
        : 'complete_revision_pinned_canonical_activity_identity_review_packet'
    },
    observations: {
      collectionActivityLabel: label,
      linkedSourceTitle: title,
      exactNormalizedCollectionLabelSourceTitleMatch: labelMatchesSourceTitle,
      sourcePageRelationshipClass: record.linkedSubjectRelationshipDisposition?.relationshipClass || null,
      possibleDedicatedActivityPageObservation: labelMatchesSourceTitle
        && record.linkedSubjectRelationshipDisposition?.relationshipClass === 'source_page_describes_collection_defined_activity_candidate',
      collectionScopedActivityIdentityAnchor: {
        collectionPageId: collection.collectionSource?.pageId ?? null,
        collectionRevision: String(collection.collectionSource?.revision || ''),
        sectionHeading: collection.sectionEvidence?.heading || null,
        sourceTableOrdinal: collection.tableEvidence?.sourceTableOrdinal ?? null,
        sourceRowOrdinal: collection.rowEvidence?.sourceRowOrdinal ?? null
      },
      deficiencies,
      canonicalActivityIdentityVerdict: null,
      observationState: 'identity_review_observations_only_not_a_canonical_identity'
    }
  };
}

function expectedRecord(input, policy) {
  const packet = buildPacket(input);
  const blockers = [...packet.observations.deficiencies];
  blockers.push(
    'canonical_activity_identity_disposition_pending',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'optimizer_eligibility_blocked'
  );
  return {
    contract: policy.recordContract || 'sensum.activity-reference-collection-member-canonical-activity-identity-evidence.v1',
    ...preservedInput(input),
    sourceLinkedSubjectRelationshipDispositionContentHash: input.contentHash,
    canonicalActivityIdentityEvidence: packet.evidence,
    canonicalActivityIdentityCandidateObservations: packet.observations,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: unique(blockers),
    state: packet.observations.deficiencies.length
      ? 'canonical_activity_identity_evidence_packet_blocked'
      : 'canonical_activity_identity_evidence_packet_complete_identity_unreviewed'
  };
}

export function buildActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence({ relationshipDispositionRecords = [], policy = {} }) {
  const records = relationshipDispositionRecords.map(input => expectedRecord(input, policy));
  return { records, audit: auditActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence(records, { relationshipDispositionRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence(records = [], { relationshipDispositionRecords = [], policy = {} } = {}) {
  const compiled = compileCanonicalActivityIdentityEvidencePolicy(policy);
  const expectedKeys = relationshipDispositionRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(relationshipDispositionRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output
      || output.sourceLinkedSubjectRelationshipDispositionContentHash !== input.contentHash
      || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const structurallyInvalidInputs = relationshipDispositionRecords.filter(record =>
    record.contract !== policy.inputContract || !record.contentHash || record.accountIndependent !== true
    || record.collectionActivityIdentityReview?.state !== 'reviewed_source_supported_candidate'
    || record.linkedSubjectRelationshipReview?.state !== 'reviewed_source_supported'
    || record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidPackets = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedRecord(input, policy);
    return record.contract !== expected.contract
      || JSON.stringify(record.canonicalActivityIdentityEvidence) !== JSON.stringify(expected.canonicalActivityIdentityEvidence)
      || JSON.stringify(record.canonicalActivityIdentityCandidateObservations) !== JSON.stringify(expected.canonicalActivityIdentityCandidateObservations);
  }).map(record => record.memberCandidateKey);
  const incompletePackets = records.filter(record => record.canonicalActivityIdentityCandidateObservations?.deficiencies?.length).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.canonicalActivityIdentityCandidateObservations?.canonicalActivityIdentityVerdict !== null
    || record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_linked_subject_relationship_dispositions');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_canonical_activity_identity_evidence_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_input_relationship_dispositions_failed_structural_integrity');
  if (compiled.invalidRules.length) structuralBlockers.push('canonical_activity_identity_evidence_policy_missing_required_fail_closed_rules');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_class_canonical_activity_identity_evidence_policy_forbidden');
  if (invalidPackets.length) structuralBlockers.push('one_or_more_canonical_activity_identity_evidence_packets_do_not_match_source_evidence');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_canonical_identity_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_canonical_activity_identity_evidence');
  const evidencePacketAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const canonicalActivityIdentityEvidencePacketCoverageComplete = evidencePacketAttemptCoverageComplete && incompletePackets.length === 0;
  const blockers = [...structuralBlockers];
  if (incompletePackets.length) blockers.push('one_or_more_canonical_activity_identity_evidence_packets_incomplete');
  blockers.push(
    'canonical_activity_identity_disposition_pending',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-canonical-activity-identity-evidence-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedRelationshipDispositionCount: expectedKeys.length,
      evidencePacketCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: structurallyInvalidInputs,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    evidenceCoverage: {
      completePacketCount: records.length - incompletePackets.length,
      incompletePacketCount: incompletePackets.length,
      incompleteMemberCandidateKeys: incompletePackets,
      retainedCollectionRowCellCount: records.reduce((sum, record) => sum + (record.canonicalActivityIdentityEvidence?.collectionDefinition?.allRowCellEvidence || []).length, 0),
      retainedCollectionNarrativeCellCount: records.reduce((sum, record) => sum + (record.canonicalActivityIdentityEvidence?.collectionDefinition?.narrativeCellEvidence || []).length, 0),
      retainedCollectionRowLinkCount: records.reduce((sum, record) => sum + (record.canonicalActivityIdentityEvidence?.collectionDefinition?.directRowWikilinkEvidence || []).length, 0),
      retainedSourceRoleDeclarationCount: records.reduce((sum, record) => sum + (record.canonicalActivityIdentityEvidence?.linkedSubjectRelationship?.sourceRoleDispositionSignals || []).reduce((inner, signal) => inner + (signal.matchedDeclarations || []).length, 0), 0),
      retainedCollectionIdentitySignalCount: records.reduce((sum, record) => sum + (record.canonicalActivityIdentityEvidence?.collectionActivityCandidate?.dispositionSignals || []).length, 0),
      retainedLinkedRelationshipSignalCount: records.reduce((sum, record) => sum + (record.canonicalActivityIdentityEvidence?.linkedSubjectRelationship?.relationshipDispositionSignals || []).length, 0),
      invalidPacketMemberCandidateKeys: invalidPackets
    },
    identityObservationCoverage: {
      exactNormalizedCollectionLabelSourceTitleMatchCount: records.filter(record => record.canonicalActivityIdentityCandidateObservations?.exactNormalizedCollectionLabelSourceTitleMatch === true).length,
      differentCollectionLabelSourceTitleCount: records.filter(record => record.canonicalActivityIdentityCandidateObservations?.exactNormalizedCollectionLabelSourceTitleMatch === false).length,
      possibleDedicatedActivityPageObservationCount: records.filter(record => record.canonicalActivityIdentityCandidateObservations?.possibleDedicatedActivityPageObservation === true).length,
      canonicalActivityIdentityVerdictCount: records.filter(record => record.canonicalActivityIdentityCandidateObservations?.canonicalActivityIdentityVerdict !== null).length
    },
    semanticPromotionCoverage: {
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    policyCoverage: compiled,
    accountStateFindings,
    evidencePacketAttemptCoverageComplete,
    canonicalActivityIdentityEvidencePacketCoverageComplete,
    canonicalActivityIdentityReviewComplete: false,
    repeatabilityReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: canonicalActivityIdentityEvidencePacketCoverageComplete
  };
}
