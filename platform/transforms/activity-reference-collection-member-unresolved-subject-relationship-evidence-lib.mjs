import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();

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

function collectionMembershipEvidence(source = {}) {
  const context = source.collectionContext || {};
  return {
    collectionSource: context.collectionSource || null,
    sectionEvidence: context.sectionEvidence || null,
    tableEvidence: context.tableEvidence || null,
    rowEvidence: context.rowEvidence || null,
    memberCellEvidence: context.memberCellEvidence || null,
    memberLinks: context.memberLinks || [],
    membershipClassification: context.membershipClassification || source.membershipClassification || null,
    evidenceState: 'source_authored_collection_membership_assertion_review_only'
  };
}

function sourcePageEvidence(source = {}) {
  return {
    sourcePageId: source.sourcePageId,
    resolvedTitle: source.resolvedTitle,
    sourceRevision: String(source.sourceRevision || ''),
    sourceTimestamp: source.sourceTimestamp || null,
    sourceUrl: source.sourceUrl || null,
    sourceContentHash: source.sourceContentHash || null,
    sourceContentBytes: source.sourceContentBytes ?? null,
    revisionAlignment: source.revisionAlignment || null,
    rootTemplates: source.rootTemplates || [],
    rootTemplateDelimiterAudit: source.rootTemplateDelimiterAudit || null,
    directCategories: source.directCategories || [],
    leadParagraphEvidence: source.leadParagraphEvidence || [],
    headingEvidence: source.headingEvidence || [],
    sourceAuthoredLinks: source.sourceAuthoredLinks || [],
    sourceLinkDelimiterAudit: source.sourceLinkDelimiterAudit || null,
    evidenceState: 'exact_revision_source_page_evidence_review_only'
  };
}

function relationshipCandidateObservations(source = {}) {
  const label = source.collectionContext?.memberCellEvidence?.plainText || '';
  const labelKey = normalize(label);
  const collectionLinks = source.collectionContext?.memberLinks || [];
  const sourceLinks = source.sourceAuthoredLinks || [];
  const leads = source.leadParagraphEvidence || [];
  const headings = source.headingEvidence || [];
  const collectionRowLinkCandidates = collectionLinks.map((link, index) => ({
    candidateKey: `${source.memberCandidateKey}:collection-row-link:${index + 1}`,
    requestedTitle: link.requestedTitle,
    requestedFragment: link.requestedFragment || null,
    displayText: link.displayText || null,
    rawLink: link.rawLink || null,
    sourceLocator: link.sourceLocator || null,
    relationshipState: 'unreviewed_collection_row_link_candidate'
  }));
  const sourcePageMainNamespaceLinkCandidates = sourceLinks.filter(link => link.namespaceClass === 'main').map(link => ({
    ...link,
    relationshipState: 'unreviewed_source_page_link_candidate'
  }));
  const exactMemberLabelSourceLinkMatches = labelKey ? sourceLinks.filter(link =>
    normalize(link.requestedTitle) === labelKey || normalize(link.displayText) === labelKey
  ).map(link => ({
    ...link,
    matchedMemberLabel: label,
    matchKind: normalize(link.requestedTitle) === labelKey ? 'requested_title_exact_normalized' : 'display_text_exact_normalized',
    relationshipState: 'unreviewed_exact_label_link_match_candidate'
  })) : [];
  const exactMemberLabelLeadMentions = labelKey ? leads.filter(paragraph => normalize(paragraph.rawText).includes(labelKey)).map(paragraph => ({
    ...paragraph,
    matchedMemberLabel: label,
    matchKind: 'lead_contains_exact_normalized_full_member_label',
    relationshipState: 'unreviewed_exact_label_text_match_candidate'
  })) : [];
  const exactMemberLabelHeadingMentions = labelKey ? headings.filter(heading => normalize(heading.normalizedTitle || heading.rawTitle).includes(labelKey)).map(heading => ({
    ...heading,
    matchedMemberLabel: label,
    matchKind: 'heading_contains_exact_normalized_full_member_label',
    relationshipState: 'unreviewed_exact_label_text_match_candidate'
  })) : [];
  return {
    memberLabel: label || null,
    normalizedMemberLabel: labelKey || null,
    collectionRowLinkCandidates,
    sourcePageMainNamespaceLinkCandidates,
    exactMemberLabelSourceLinkMatches,
    exactMemberLabelLeadMentions,
    exactMemberLabelHeadingMentions,
    relationshipVerdict: null,
    interpretationState: 'candidate_observations_only_no_relationship_inference'
  };
}

const routeContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceRelationshipRoutingContentHash: record.contentHash,
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
  sourceRelationshipRoutingBlockers: record.blockers || []
});

const outputContextProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
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
  sourceRelationshipRoutingBlockers: record.sourceRelationshipRoutingBlockers || []
});

function sourceMatchesRoute(source, route, policy) {
  return source?.contract === policy.inputSourceSignatureContract
    && source.memberCandidateKey === route.memberCandidateKey
    && source.contentHash === route.sourceSignatureContentHash
    && source.sourcePageId === route.sourcePageId
    && source.resolvedTitle === route.resolvedTitle
    && String(source.sourceRevision || '') === String(route.sourceRevision || '')
    && source.sourceTimestamp === route.sourceTimestamp
    && source.sourceUrl === route.sourceUrl
    && source.sourceContentHash === route.sourceContentHash
    && JSON.stringify(source.collectionContext) === JSON.stringify(route.collectionContext)
    && JSON.stringify(source.memberIdentityContexts) === JSON.stringify(route.memberIdentityContexts);
}

export function buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence({ routingRecords = [], sourceSignatureRecords = [], policy = {} }) {
  const queuedRoutes = routingRecords.filter(record => record.routingDecision?.routeState === 'queued');
  const sourcesByKey = new Map();
  for (const source of sourceSignatureRecords) {
    const list = sourcesByKey.get(source.memberCandidateKey) || [];
    list.push(source);
    sourcesByKey.set(source.memberCandidateKey, list);
  }
  const records = queuedRoutes.map(route => {
    const matches = (sourcesByKey.get(route.memberCandidateKey) || []).filter(source => sourceMatchesRoute(source, route, policy));
    const source = matches.length === 1 ? matches[0] : null;
    const blockers = [];
    if (!source) blockers.push('exact_source_signature_hash_identity_revision_and_context_join_failed');
    blockers.push(
      'relationship_candidate_observations_require_semantic_review',
      'collection_activity_identity_not_established',
      'linked_subject_relationship_review_pending',
      'canonical_game_entity_and_activity_identities_not_established',
      'repeatability_and_member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: policy.recordContract || 'sensum.activity-reference-collection-member-unresolved-subject-relationship-evidence.v1',
      memberCandidateKey: route.memberCandidateKey,
      sourceRelationshipRoutingContentHash: route.contentHash,
      sourceSignatureDispositionContentHash: route.sourceSignatureDispositionContentHash,
      sourceSignatureContentHash: route.sourceSignatureContentHash,
      sourceRoutingContentHash: route.sourceRoutingContentHash,
      sourceMemberDispositionContentHash: route.sourceMemberDispositionContentHash,
      sourceMemberEvidenceContentHash: route.sourceMemberEvidenceContentHash,
      collectionContext: route.collectionContext,
      memberIdentityContexts: route.memberIdentityContexts,
      sourcePageId: route.sourcePageId,
      resolvedTitle: route.resolvedTitle,
      membershipClassification: route.membershipClassification,
      sourceRevision: route.sourceRevision,
      sourceTimestamp: route.sourceTimestamp,
      sourceUrl: route.sourceUrl,
      sourceContentHash: route.sourceContentHash,
      sourcePageSubjectDisposition: route.sourcePageSubjectDisposition,
      routingDecision: route.routingDecision,
      sourceBlockers: route.sourceBlockers || [],
      sourceSignatureBlockers: route.sourceSignatureBlockers || [],
      sourceDispositionBlockers: route.sourceDispositionBlockers || [],
      sourceRelationshipRoutingBlockers: route.blockers || [],
      sourceSignatureJoin: { matchedRecordCount: matches.length, exactHashIdentityRevisionAndContextMatch: matches.length === 1 },
      collectionMembershipEvidence: collectionMembershipEvidence(source || {}),
      sourcePageEvidence: sourcePageEvidence(source || {}),
      relationshipCandidateObservations: relationshipCandidateObservations(source || {}),
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
      state: source ? 'relationship_evidence_collected_review_pending' : 'relationship_evidence_blocked_missing_exact_source_join'
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence(records, { routingRecords, sourceSignatureRecords, policy }) };
}

export function auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence(records = [], { routingRecords = [], sourceSignatureRecords = [], policy = {} } = {}) {
  const queuedRoutes = routingRecords.filter(record => record.routingDecision?.routeState === 'queued');
  const expectedKeys = queuedRoutes.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const routeByKey = new Map(queuedRoutes.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => !outputByKey.has(key) || routeContextProjection(routeByKey.get(key)) !== outputContextProjection(outputByKey.get(key)));
  const sourceMatchesByKey = new Map(expectedKeys.map(key => {
    const route = routeByKey.get(key);
    return [key, sourceSignatureRecords.filter(source => sourceMatchesRoute(source, route, policy))];
  }));
  const joinFailures = expectedKeys.filter(key => sourceMatchesByKey.get(key).length !== 1);
  const evidenceMismatches = expectedKeys.filter(key => {
    const source = sourceMatchesByKey.get(key)[0];
    const output = outputByKey.get(key);
    return !source || !output
      || JSON.stringify(output.collectionMembershipEvidence) !== JSON.stringify(collectionMembershipEvidence(source))
      || JSON.stringify(output.sourcePageEvidence) !== JSON.stringify(sourcePageEvidence(source));
  });
  const candidateObservationMismatches = expectedKeys.filter(key => {
    const source = sourceMatchesByKey.get(key)[0];
    const output = outputByKey.get(key);
    return !source || !output || JSON.stringify(output.relationshipCandidateObservations) !== JSON.stringify(relationshipCandidateObservations(source));
  });
  const invalidInputRoutes = queuedRoutes.filter(record => record.contract !== policy.inputRoutingContract || !record.contentHash || !record.sourceSignatureContentHash || record.accountIndependent !== true || record.optimizerEligible !== false).map(record => record.memberCandidateKey);
  const forbiddenPaths = forbiddenPolicyPaths(policy);
  const invalidCandidateStates = records.filter(record =>
    record.relationshipCandidateObservations?.relationshipVerdict !== null
    || record.relationshipCandidateObservations?.interpretationState !== 'candidate_observations_only_no_relationship_inference'
    || (record.relationshipCandidateObservations?.collectionRowLinkCandidates || []).some(candidate => candidate.relationshipState !== 'unreviewed_collection_row_link_candidate')
    || (record.relationshipCandidateObservations?.sourcePageMainNamespaceLinkCandidates || []).some(candidate => candidate.relationshipState !== 'unreviewed_source_page_link_candidate')
    || (record.relationshipCandidateObservations?.exactMemberLabelSourceLinkMatches || []).some(candidate => candidate.relationshipState !== 'unreviewed_exact_label_link_match_candidate')
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
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_queued_relationship_work_routes');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_relationship_evidence_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_pipeline_hash_identity_revision_disposition_signal_collection_membership_or_alias_contexts_changed');
  if (invalidInputRoutes.length) structuralBlockers.push('one_or_more_relationship_work_routes_failed_structural_integrity');
  if (joinFailures.length) structuralBlockers.push('one_or_more_routes_did_not_join_exactly_one_source_signature_by_member_key_hash_identity_revision_and_context');
  if (evidenceMismatches.length) structuralBlockers.push('one_or_more_collection_row_or_source_page_evidence_sets_changed_or_were_lost');
  if (candidateObservationMismatches.length || invalidCandidateStates.length) structuralBlockers.push('one_or_more_relationship_candidate_observation_sets_invalid');
  if (forbiddenPaths.length) structuralBlockers.push('page_specific_or_collection_class_relationship_evidence_policy_forbidden');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_relationship_evidence_packets');
  const relationshipEvidencePacketCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const evidence = records.map(record => record.sourcePageEvidence || {});
  const observations = records.map(record => record.relationshipCandidateObservations || {});
  const blockers = [...structuralBlockers,
    'relationship_candidate_observations_require_semantic_review',
    'collection_activity_identity_not_established',
    'linked_subject_relationship_review_pending',
    'canonical_game_entity_and_activity_identities_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  ];
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-unresolved-subject-relationship-evidence-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      routingRecordCount: routingRecords.length,
      queuedRelationshipRouteCount: expectedKeys.length,
      sourceSignatureRecordCount: sourceSignatureRecords.length,
      relationshipEvidencePacketCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      sourceSignatureJoinFailureMemberCandidateKeys: joinFailures,
      exactInputOutputSetContextAndSourceJoinMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length && !joinFailures.length
    },
    evidenceCoverage: {
      collectionMembershipEvidenceCount: records.filter(record => record.collectionMembershipEvidence?.rowEvidence).length,
      collectionRevisionPinnedCount: records.filter(record => record.collectionMembershipEvidence?.collectionSource?.revision && record.collectionMembershipEvidence?.collectionSource?.contentHash).length,
      linkedSourceRevisionPinnedCount: evidence.filter(value => value.sourceRevision && value.sourceContentHash).length,
      totalLinkedSourceContentBytes: evidence.reduce((sum, value) => sum + Number(value.sourceContentBytes || 0), 0),
      rootTemplateCount: evidence.reduce((sum, value) => sum + (value.rootTemplates?.length || 0), 0),
      directCategoryCount: evidence.reduce((sum, value) => sum + (value.directCategories?.length || 0), 0),
      leadParagraphCount: evidence.reduce((sum, value) => sum + (value.leadParagraphEvidence?.length || 0), 0),
      headingCount: evidence.reduce((sum, value) => sum + (value.headingEvidence?.length || 0), 0),
      sourceAuthoredLinkOccurrenceCount: evidence.reduce((sum, value) => sum + (value.sourceAuthoredLinks?.length || 0), 0),
      mainNamespaceLinkOccurrenceCount: observations.reduce((sum, value) => sum + (value.sourcePageMainNamespaceLinkCandidates?.length || 0), 0),
      evidenceMismatchMemberCandidateKeys: evidenceMismatches
    },
    candidateObservationCoverage: {
      collectionRowLinkCandidateCount: observations.reduce((sum, value) => sum + (value.collectionRowLinkCandidates?.length || 0), 0),
      sourcePageMainNamespaceLinkCandidateCount: observations.reduce((sum, value) => sum + (value.sourcePageMainNamespaceLinkCandidates?.length || 0), 0),
      exactMemberLabelSourceLinkMatchCount: observations.reduce((sum, value) => sum + (value.exactMemberLabelSourceLinkMatches?.length || 0), 0),
      exactMemberLabelLeadMentionCount: observations.reduce((sum, value) => sum + (value.exactMemberLabelLeadMentions?.length || 0), 0),
      exactMemberLabelHeadingMentionCount: observations.reduce((sum, value) => sum + (value.exactMemberLabelHeadingMentions?.length || 0), 0),
      relationshipVerdictCount: observations.filter(value => value.relationshipVerdict !== null && value.relationshipVerdict !== undefined).length,
      candidateObservationMismatchMemberCandidateKeys: candidateObservationMismatches,
      invalidCandidateStateMemberCandidateKeys: invalidCandidateStates
    },
    policyCoverage: {
      policy: policy.policy || null,
      evidenceChannelCount: (policy.evidenceChannels || []).length,
      forbiddenPolicyPaths: forbiddenPaths
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
    relationshipEvidencePacketCoverageComplete,
    collectionActivityIdentityReviewComplete: false,
    linkedSubjectRelationshipReviewComplete: false,
    repeatabilityReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: relationshipEvidencePacketCoverageComplete
  };
}
