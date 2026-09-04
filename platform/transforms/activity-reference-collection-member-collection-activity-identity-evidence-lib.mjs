import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();

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
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|collectionDisplayLabel|collectionDisplayLabels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

function rowWikilinks(rowEvidence = {}) {
  const links = [];
  for (const [cellIndex, cell] of (rowEvidence.cells || []).entries()) {
    const raw = String(cell.rawValue || '');
    let occurrence = 0;
    for (const match of raw.matchAll(/\[\[([^\[\]]+?)\]\]/g)) {
      occurrence += 1;
      const parts = match[1].split('|');
      const requested = String(parts.shift() || '').trim();
      const fragmentIndex = requested.indexOf('#');
      const requestedTitle = (fragmentIndex >= 0 ? requested.slice(0, fragmentIndex) : requested).trim();
      const requestedFragment = fragmentIndex >= 0 ? requested.slice(fragmentIndex + 1).trim() || null : null;
      const displayText = parts.length ? parts.at(-1).trim() || null : null;
      links.push({
        cellIndex,
        cellLogicalHeader: cell.logicalHeader || null,
        occurrence,
        requestedTitle,
        requestedFragment,
        displayText,
        rawLink: match[0],
        namespaceClass: requestedTitle.includes(':') ? 'non_main' : 'main',
        sourceLocator: cell.sourceLocator || rowEvidence.sourceLocator || null
      });
    }
  }
  return links;
}

function collectionActivityEvidence(record = {}) {
  const context = record.collectionContext || {};
  const row = context.rowEvidence || {};
  const cells = row.cells || [];
  return {
    collectionSource: context.collectionSource || null,
    sectionEvidence: context.sectionEvidence || null,
    tableEvidence: context.tableEvidence || null,
    rowEvidence: row,
    memberCellEvidence: context.memberCellEvidence || null,
    memberLinks: context.memberLinks || [],
    allRowCellEvidence: cells,
    nonEmptyRowCellEvidence: cells.filter(cell => String(cell.plainText || '').trim() || String(cell.rawValue || '').trim()),
    directRowWikilinkEvidence: rowWikilinks(row),
    sourceRelationshipDispositionEvidence: {
      sourcePageSubjectDisposition: record.sourcePageSubjectDisposition || null,
      sourceRelationshipDispositionSignals: record.sourceRelationshipDispositionSignals || [],
      sourceRelationshipDisposition: record.sourceRelationshipDisposition || null
    },
    evidenceState: 'revision_pinned_collection_row_and_source_role_evidence_review_only'
  };
}

function sameStableSourceIdentity(context = {}, record = {}) {
  return Number(context.pageId) === Number(record.sourcePageId)
    && normalize(context.resolvedTitle) === normalize(record.resolvedTitle)
    && String(context.observedRevision || '') === String(record.sourceRevision || '')
    && context.observedContentHash === record.sourceContentHash;
}

function identityCandidateObservations(record = {}, evidence = collectionActivityEvidence(record)) {
  const sourceLinks = (record.sourcePageEvidence?.sourceAuthoredLinks || []).filter(link => link.namespaceClass === 'main');
  const collectionLinks = evidence.directRowWikilinkEvidence.filter(link => link.namespaceClass === 'main');
  const sharedMainNamespaceLinkTargets = [];
  for (const collectionLink of collectionLinks) {
    const collectionTarget = normalize(collectionLink.requestedTitle);
    if (!collectionTarget) continue;
    for (const sourceLink of sourceLinks) {
      if (normalize(sourceLink.requestedTitle) !== collectionTarget) continue;
      sharedMainNamespaceLinkTargets.push({
        normalizedTarget: collectionTarget,
        collectionLink,
        sourceLink,
        evidenceState: 'exact_normalized_link_target_intersection_review_only'
      });
    }
  }
  const memberLinkSourceTitleAlignments = (record.collectionContext?.memberLinks || [])
    .filter(link => normalize(link.requestedTitle) === normalize(record.resolvedTitle))
    .map(link => ({
      memberLink: link,
      resolvedTitle: record.resolvedTitle,
      sourcePageId: record.sourcePageId,
      sourceRevision: String(record.sourceRevision || ''),
      evidenceState: 'collection_member_link_matches_linked_source_title_review_only'
    }));
  const stableSourceIdentityAlignments = (record.memberIdentityContexts || [])
    .filter(context => sameStableSourceIdentity(context, record))
    .map(context => ({
      memberIdentityContext: context,
      sourcePageId: record.sourcePageId,
      sourceRevision: String(record.sourceRevision || ''),
      sourceContentHash: record.sourceContentHash,
      evidenceState: 'stable_page_revision_and_hash_alignment_review_only'
    }));
  return {
    collectionRowCellCandidates: evidence.nonEmptyRowCellEvidence,
    memberLinkSourceTitleAlignments,
    stableSourceIdentityAlignments,
    sharedMainNamespaceLinkTargets,
    retainedSourceRelationshipClasses: unique([
      record.sourceRelationshipDisposition?.relationshipClass,
      ...(record.sourceRelationshipDisposition?.conflictingRelationshipClasses || [])
    ].filter(Boolean)),
    collectionActivityIdentityVerdict: null,
    linkedSubjectRelationshipVerdict: null,
    interpretationState: 'candidate_observations_only_no_identity_or_relationship_inference'
  };
}

function preservedInput(record = {}) {
  return {
    memberCandidateKey: record.memberCandidateKey,
    sourceRelationshipDispositionContentHash: record.contentHash,
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
    sourceRelationshipDispositionBlockers: record.blockers || [],
    sourceSignatureJoin: record.sourceSignatureJoin || null,
    collectionMembershipEvidence: record.collectionMembershipEvidence || null,
    sourcePageEvidence: record.sourcePageEvidence || null,
    relationshipCandidateObservations: record.relationshipCandidateObservations || null,
    sourceRelationshipEvidenceSummary: record.sourceRelationshipEvidenceSummary || null,
    sourceRelationshipDispositionSignals: record.sourceRelationshipDispositionSignals || [],
    sourceRelationshipDisposition: record.sourceRelationshipDisposition || null
  };
}

function outputPreservedInput(record = {}) {
  return {
    memberCandidateKey: record.memberCandidateKey,
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
    sourceSignatureJoin: record.sourceSignatureJoin || null,
    collectionMembershipEvidence: record.collectionMembershipEvidence || null,
    sourcePageEvidence: record.sourcePageEvidence || null,
    relationshipCandidateObservations: record.relationshipCandidateObservations || null,
    sourceRelationshipEvidenceSummary: record.sourceRelationshipEvidenceSummary || null,
    sourceRelationshipDispositionSignals: record.sourceRelationshipDispositionSignals || [],
    sourceRelationshipDisposition: record.sourceRelationshipDisposition || null
  };
}

export function buildActivityReferenceCollectionMemberCollectionActivityIdentityEvidence({ relationshipDispositionRecords = [], policy = {} }) {
  const records = relationshipDispositionRecords.map(input => {
    const evidence = collectionActivityEvidence(input);
    return {
      contract: policy.recordContract || 'sensum.activity-reference-collection-member-collection-activity-identity-evidence.v1',
      ...preservedInput(input),
      collectionActivityEvidence: evidence,
      collectionActivityIdentityCandidateObservations: identityCandidateObservations(input, evidence),
      collectionActivityIdentityReview: { state: 'unreviewed', identity: null, evidenceKeys: [] },
      linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique([
        'collection_activity_identity_evidence_requires_semantic_disposition',
        'exact_linked_subject_collection_relationship_review_pending',
        'canonical_game_entity_and_activity_identities_not_established',
        'repeatability_and_member_expansion_not_reviewed',
        'requirements_xp_timing_and_mechanics_not_structured',
        'optimizer_eligibility_blocked'
      ]),
      state: 'collection_activity_identity_evidence_ready_for_review'
    };
  });
  return {
    records,
    audit: auditActivityReferenceCollectionMemberCollectionActivityIdentityEvidence(records, { relationshipDispositionRecords, policy })
  };
}

export function auditActivityReferenceCollectionMemberCollectionActivityIdentityEvidence(records = [], { relationshipDispositionRecords = [], policy = {} } = {}) {
  const expectedKeys = relationshipDispositionRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(relationshipDispositionRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key =>
    !outputByKey.has(key)
    || JSON.stringify(preservedInput(inputByKey.get(key))) !== JSON.stringify(outputPreservedInput(outputByKey.get(key)))
  );
  const allowedRelationshipStates = [
    'source_declaration_supported',
    'blocked_conflicting_source_relationship_declarations',
    'unresolved_no_supported_source_relationship_declaration'
  ];
  const inputStructuralFailures = relationshipDispositionRecords.filter(record =>
    record.contract !== policy.inputContract
    || !record.contentHash
    || record.accountIndependent !== true
    || !allowedRelationshipStates.includes(record.sourceRelationshipDisposition?.state)
    || !record.collectionContext?.rowEvidence?.cells
    || !record.collectionContext?.collectionSource?.revision
    || !record.sourceRevision
    || !record.sourceContentHash
    || record.collectionActivityIdentityReview?.state !== 'unreviewed'
    || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidEvidenceRecords = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expectedEvidence = collectionActivityEvidence(input);
    const expectedObservations = identityCandidateObservations(input, expectedEvidence);
    return record.contract !== policy.recordContract
      || JSON.stringify(record.collectionActivityEvidence) !== JSON.stringify(expectedEvidence)
      || JSON.stringify(record.collectionActivityIdentityCandidateObservations) !== JSON.stringify(expectedObservations);
  }).map(record => record.memberCandidateKey);
  const invalidSourceLocators = records.filter(record =>
    (record.collectionActivityEvidence?.nonEmptyRowCellEvidence || []).some(cell => !cell.sourceLocator)
    || (record.collectionActivityEvidence?.directRowWikilinkEvidence || []).some(link => !link.sourceLocator)
  ).map(record => record.memberCandidateKey);
  const invalidCandidateVerdicts = records.filter(record =>
    record.collectionActivityIdentityCandidateObservations?.collectionActivityIdentityVerdict !== null
    || record.collectionActivityIdentityCandidateObservations?.linkedSubjectRelationshipVerdict !== null
  ).map(record => record.memberCandidateKey);
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
  const policyPaths = forbiddenPolicyPaths(policy);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_source_relationship_dispositions');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_identity_evidence_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_disposition_collection_membership_or_alias_contexts_changed');
  if (inputStructuralFailures.length) structuralBlockers.push('one_or_more_input_source_relationship_dispositions_failed_structural_integrity');
  if (invalidEvidenceRecords.length || invalidSourceLocators.length) structuralBlockers.push('one_or_more_collection_activity_evidence_packets_changed_or_lost_source_located_evidence');
  if (invalidCandidateVerdicts.length) structuralBlockers.push('one_or_more_identity_candidate_observation_sets_contain_an_unsupported_verdict');
  if (policyPaths.length) structuralBlockers.push('page_specific_or_collection_class_identity_evidence_policy_forbidden');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_collection_activity_identity_evidence');
  const identityEvidencePacketCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers,
    'collection_activity_identity_evidence_requires_semantic_disposition',
    'exact_linked_subject_collection_relationship_review_pending',
    'canonical_game_entity_and_activity_identities_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  ];
  const relationshipClasses = {};
  for (const record of records) {
    const relationshipClass = record.sourceRelationshipDisposition?.relationshipClass;
    if (relationshipClass) relationshipClasses[relationshipClass] = (relationshipClasses[relationshipClass] || 0) + 1;
  }
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-collection-activity-identity-evidence-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedSourceRelationshipDispositionCount: expectedKeys.length,
      identityEvidencePacketCount: records.length,
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
      evidenceChannels: policy.evidenceChannels || [],
      forbiddenPolicyPaths: policyPaths
    },
    collectionActivityEvidenceCoverage: {
      collectionRevisionPinnedCount: records.filter(record => record.collectionActivityEvidence?.collectionSource?.revision).length,
      linkedSourceRevisionPinnedCount: records.filter(record => record.sourceRevision && record.sourceContentHash).length,
      allRowCellEvidenceCount: records.reduce((sum, record) => sum + (record.collectionActivityEvidence?.allRowCellEvidence || []).length, 0),
      nonEmptyRowCellEvidenceCount: records.reduce((sum, record) => sum + (record.collectionActivityEvidence?.nonEmptyRowCellEvidence || []).length, 0),
      directRowWikilinkEvidenceCount: records.reduce((sum, record) => sum + (record.collectionActivityEvidence?.directRowWikilinkEvidence || []).length, 0),
      sourceRelationshipDispositionSignalCount: records.reduce((sum, record) => sum + (record.sourceRelationshipDispositionSignals || []).length, 0),
      matchedSourceDeclarationCount: records.reduce((sum, record) => sum + (record.sourceRelationshipDispositionSignals || []).reduce((inner, signal) => inner + (signal.matchedDeclarations || []).length, 0), 0),
      relationshipClassCounts: Object.fromEntries(Object.entries(relationshipClasses).sort((a, b) => a[0].localeCompare(b[0]))),
      invalidEvidenceMemberCandidateKeys: invalidEvidenceRecords,
      invalidSourceLocatorMemberCandidateKeys: invalidSourceLocators
    },
    candidateObservationCoverage: {
      memberLinkSourceTitleAlignmentCount: records.reduce((sum, record) => sum + (record.collectionActivityIdentityCandidateObservations?.memberLinkSourceTitleAlignments || []).length, 0),
      stableSourceIdentityAlignmentCount: records.reduce((sum, record) => sum + (record.collectionActivityIdentityCandidateObservations?.stableSourceIdentityAlignments || []).length, 0),
      sharedMainNamespaceLinkTargetCount: records.reduce((sum, record) => sum + (record.collectionActivityIdentityCandidateObservations?.sharedMainNamespaceLinkTargets || []).length, 0),
      collectionActivityIdentityVerdictCount: records.filter(record => record.collectionActivityIdentityCandidateObservations?.collectionActivityIdentityVerdict !== null).length,
      linkedSubjectRelationshipVerdictCount: records.filter(record => record.collectionActivityIdentityCandidateObservations?.linkedSubjectRelationshipVerdict !== null).length,
      invalidCandidateVerdictMemberCandidateKeys: invalidCandidateVerdicts
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
    identityEvidencePacketCoverageComplete,
    collectionActivityIdentityReviewComplete: false,
    linkedSubjectRelationshipReviewComplete: false,
    repeatabilityReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: identityEvidencePacketCoverageComplete
  };
}
