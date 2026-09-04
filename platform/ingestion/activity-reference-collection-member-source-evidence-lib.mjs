import {
  collectLexicalReviewCandidates,
  parseLeadParagraphEvidence,
  parseSourceHeadings,
  parseSupportedActivityInfobox
} from './activity-candidate-source-evidence-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const normalizedLabel = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const collectionContext = candidate => ({
  collectionCandidateKey: candidate.collectionCandidateKey,
  collectionSource: candidate.collectionSource,
  membershipClassification: candidate.membershipClassification,
  sectionEvidence: candidate.sectionEvidence,
  tableEvidence: candidate.tableEvidence,
  rowEvidence: candidate.rowEvidence,
  memberCellEvidence: candidate.memberCellEvidence,
  memberLinks: candidate.memberLinks
});

const identityProjection = identity => JSON.stringify({
  pageId: identity?.pageId ?? null,
  resolvedTitle: identity?.resolvedTitle || null,
  observedRevision: String(identity?.observedRevision || ''),
  observedTimestamp: identity?.observedTimestamp || null,
  observedSourceUrl: identity?.observedSourceUrl || null,
  observedContentHash: identity?.observedContentHash || null,
  state: identity?.state || null
});

const inputProjection = candidate => JSON.stringify({
  memberCandidateKey: candidate.memberCandidateKey,
  sourceMemberCandidateContentHash: candidate.contentHash,
  collectionContext: collectionContext(candidate),
  memberIdentityContexts: candidate.currentWikiIdentityResolutions || []
});

const outputProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceMemberCandidateContentHash: record.sourceMemberCandidateContentHash,
  collectionContext: record.collectionContext,
  memberIdentityContexts: record.memberIdentityContexts
});

function retainedIdentity(candidate) {
  const contexts = candidate.currentWikiIdentityResolutions || [];
  const projections = unique(contexts.map(identityProjection));
  const resolved = contexts.filter(context => context.state === 'resolved_current_wiki_page_identity');
  return {
    contexts,
    identity: resolved[0] || contexts[0] || null,
    occurrencesPresent: contexts.length > 0,
    occurrencesEquivalent: contexts.length > 0 && projections.length === 1,
    occurrencesResolved: contexts.length > 0 && resolved.length === contexts.length
  };
}

const fetchedRevisionRows = fetchedPages => fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({ page, revision })));
const sourceContent = revision => revision?.slots?.main?.content;

export function findActivityReferenceCollectionMemberSourceEvidenceAccountState(records = []) {
  const findings = [];
  const visit = (value, path, recordKey) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`, recordKey)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ recordKey, path: childPath, value: child });
      visit(child, childPath, recordKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record?.memberCandidateKey || `record-${index}`));
  return findings;
}

export function buildActivityReferenceCollectionMemberSourceEvidence({ candidates = [], fetchedPages = [], evidencePolicy = {}, contentHash = value => value }) {
  const fetchedByRevision = new Map(fetchedRevisionRows(fetchedPages).map(value => [String(value.revision.revid), value]));
  const records = candidates.map(candidate => {
    const retained = retainedIdentity(candidate);
    const identity = retained.identity;
    const fetched = fetchedByRevision.get(String(identity?.observedRevision || ''));
    const page = fetched?.page || null;
    const revision = fetched?.revision || null;
    const content = sourceContent(revision);
    const computedHash = typeof content === 'string' ? contentHash(content) : null;
    const revisionAlignment = {
      memberIdentityOccurrencesPresent: retained.occurrencesPresent,
      memberIdentityOccurrencesEquivalent: retained.occurrencesEquivalent,
      memberIdentityOccurrencesResolved: retained.occurrencesResolved,
      fetchedPageIdMatch: Boolean(identity && Number(page?.pageid) === Number(identity.pageId)),
      fetchedTitleMatch: Boolean(identity && page?.title === identity.resolvedTitle),
      fetchedRevisionMatch: Boolean(identity && String(revision?.revid || '') === String(identity.observedRevision || '')),
      fetchedTimestampMatch: Boolean(identity && revision?.timestamp === identity.observedTimestamp),
      fetchedContentHashMatch: Boolean(identity && computedHash && computedHash === identity.observedContentHash)
    };
    const infoboxEvidence = typeof content === 'string' ? parseSupportedActivityInfobox(content) : null;
    const leadParagraphEvidence = typeof content === 'string' ? parseLeadParagraphEvidence(content, infoboxEvidence) : [];
    const headingEvidence = typeof content === 'string' ? parseSourceHeadings(content) : [];
    const lexicalReviewCandidates = typeof content === 'string' ? collectLexicalReviewCandidates(content, evidencePolicy) : [];
    const blockers = [];
    if (!retained.occurrencesPresent) blockers.push('member_identity_context_missing');
    if (!retained.occurrencesEquivalent) blockers.push('member_identity_occurrences_conflict');
    if (!retained.occurrencesResolved) blockers.push('one_or_more_member_identity_occurrences_unresolved');
    if (!page || !revision || typeof content !== 'string') blockers.push('exact_member_revision_source_content_missing');
    if (!Object.values(revisionAlignment).every(Boolean)) blockers.push('member_candidate_identity_or_fetched_source_alignment_failed');
    if (infoboxEvidence && !infoboxEvidence.balanced) blockers.push('supported_activity_infobox_unbalanced');
    if (!infoboxEvidence) blockers.push('supported_activity_infobox_not_present');
    blockers.push(
      'source_evidence_requires_semantic_review',
      'canonical_game_entity_identity_not_established',
      'canonical_activity_identity_not_established',
      'repeatability_not_semantically_reviewed',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    const sourceBlocked = blockers.some(blocker => [
      'member_identity_context_missing',
      'member_identity_occurrences_conflict',
      'one_or_more_member_identity_occurrences_unresolved',
      'exact_member_revision_source_content_missing',
      'member_candidate_identity_or_fetched_source_alignment_failed',
      'supported_activity_infobox_unbalanced'
    ].includes(blocker));
    return {
      contract: 'sensum.activity-reference-collection-member-source-evidence.v1',
      memberCandidateKey: candidate.memberCandidateKey,
      sourceMemberCandidateContentHash: candidate.contentHash,
      collectionContext: collectionContext(candidate),
      memberIdentityContexts: candidate.currentWikiIdentityResolutions || [],
      sourcePageId: identity?.pageId ?? null,
      resolvedTitle: identity?.resolvedTitle || null,
      sourceRevision: identity?.observedRevision || null,
      sourceTimestamp: identity?.observedTimestamp || null,
      sourceUrl: identity?.observedSourceUrl || null,
      sourceContentHash: computedHash,
      sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null,
      revisionAlignment,
      membershipClassification: candidate.membershipClassification,
      infoboxEvidence,
      leadParagraphEvidence,
      headingEvidence,
      lexicalReviewCandidates,
      semanticIdentityReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: sourceBlocked ? 'blocked_source' : 'review_ready'
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberSourceEvidence(records, { candidates, fetchedPages, evidencePolicy }) };
}

export function auditActivityReferenceCollectionMemberSourceEvidence(records = [], { candidates = [], fetchedPages = [], evidencePolicy = {} } = {}) {
  const expectedKeys = candidates.map(candidate => candidate.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(candidates.map(candidate => [candidate.memberCandidateKey, candidate]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || inputProjection(input) !== outputProjection(output);
  });
  const expectedRevisions = candidates.map(candidate => retainedIdentity(candidate).identity?.observedRevision).filter(Boolean).map(String);
  const distinctExpectedRevisions = unique(expectedRevisions);
  const fetchedRows = fetchedRevisionRows(fetchedPages);
  const fetchedRevisionIds = fetchedRows.map(value => String(value.revision.revid));
  const duplicateFetchedRevisions = duplicates(fetchedRevisionIds);
  const missingFetchedRevisions = distinctExpectedRevisions.filter(revision => !fetchedRevisionIds.includes(revision));
  const identityContextFailures = candidates.filter(candidate => {
    const retained = retainedIdentity(candidate);
    return !retained.occurrencesPresent || !retained.occurrencesEquivalent || !retained.occurrencesResolved;
  }).map(candidate => candidate.memberCandidateKey);
  const sourceAlignmentFailures = records.filter(record => !Object.values(record.revisionAlignment || {}).every(Boolean)).map(record => record.memberCandidateKey);
  const missingInfoboxes = records.filter(record => !record.infoboxEvidence).map(record => record.memberCandidateKey);
  const missingInfoboxMembers = records.filter(record => !record.infoboxEvidence).map(record => ({
    memberCandidateKey: record.memberCandidateKey,
    collectionDisplayLabel: record.collectionContext?.memberCellEvidence?.plainText || null,
    resolvedTitle: record.resolvedTitle,
    membershipClassification: record.membershipClassification,
    sourceRevision: record.sourceRevision
  }));
  const unbalancedInfoboxes = records.filter(record => record.infoboxEvidence && !record.infoboxEvidence.balanced).map(record => record.memberCandidateKey);
  const collectionDisplayResolvedTitleDifferences = records.filter(record =>
    record.collectionContext?.memberCellEvidence?.plainText
    && record.resolvedTitle
    && normalizedLabel(record.collectionContext.memberCellEvidence.plainText) !== normalizedLabel(record.resolvedTitle)
  ).map(record => ({
    memberCandidateKey: record.memberCandidateKey,
    collectionDisplayLabel: record.collectionContext.memberCellEvidence.plainText,
    resolvedTitle: record.resolvedTitle,
    membershipClassification: record.membershipClassification
  }));
  const policySignals = new Set((evidencePolicy.lexicalSignals || []).map(signal => signal.signalKey));
  const unexpectedSignalKeys = sorted(unique(records.flatMap(record => (record.lexicalReviewCandidates || []).map(candidate => candidate.signalKey)).filter(key => !policySignals.has(key))));
  const familyCounts = {};
  const signalCounts = {};
  for (const match of records.flatMap(record => record.lexicalReviewCandidates || [])) {
    familyCounts[match.family] = (familyCounts[match.family] || 0) + 1;
    signalCounts[match.signalKey] = (signalCounts[match.signalKey] || 0) + 1;
  }
  const unsupportedPromotions = records.filter(record =>
    record.semanticIdentityReview?.state !== 'unreviewed'
    || record.repeatabilityReview?.state !== 'unreviewed'
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.optimizerEligible === true
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findActivityReferenceCollectionMemberSourceEvidenceAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_collection_member_candidates');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_member_candidate_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_collection_or_identity_contexts_were_not_preserved');
  if (identityContextFailures.length) structuralBlockers.push('one_or_more_member_candidates_lack_one_equivalent_resolved_wiki_identity');
  if (duplicateFetchedRevisions.length || missingFetchedRevisions.length) structuralBlockers.push('exact_member_revision_fetch_set_incomplete');
  if (sourceAlignmentFailures.length) structuralBlockers.push('one_or_more_member_sources_failed_page_title_revision_timestamp_or_hash_alignment');
  if (unbalancedInfoboxes.length) structuralBlockers.push('one_or_more_supported_activity_infoboxes_unbalanced');
  if (unexpectedSignalKeys.length) structuralBlockers.push('one_or_more_lexical_signal_keys_not_in_policy');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_semantic_repeatability_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_member_source_evidence');
  const sourceEvidenceCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (missingInfoboxes.length) blockers.push('one_or_more_member_sources_have_no_supported_activity_infobox');
  blockers.push(
    'member_semantic_identity_review_pending',
    'member_repeatability_review_pending',
    'member_requirements_variants_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: 'sensum.activity-reference-collection-member-source-evidence-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedMemberCandidateCount: expectedKeys.length,
      sourceEvidenceRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      exactCandidateAndContextSetMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    sourceAlignment: {
      distinctExpectedRevisionCount: distinctExpectedRevisions.length,
      fetchedRevisionCount: fetchedRevisionIds.length,
      duplicateFetchedRevisions,
      missingFetchedRevisions,
      identityContextFailureMemberCandidateKeys: identityContextFailures,
      collectionDisplayResolvedTitleDifferenceCount: collectionDisplayResolvedTitleDifferences.length,
      collectionDisplayResolvedTitleDifferences,
      fullyAlignedCount: records.length - sourceAlignmentFailures.length,
      failedMemberCandidateKeys: sourceAlignmentFailures,
      allIdentityContextsAndFetchedSourcesAligned: !identityContextFailures.length && !sourceAlignmentFailures.length && !duplicateFetchedRevisions.length && !missingFetchedRevisions.length
    },
    structuralEvidenceCoverage: {
      totalSourceContentBytes: records.reduce((sum, record) => sum + (record.sourceContentBytes || 0), 0),
      supportedInfoboxCount: records.length - missingInfoboxes.length,
      missingSupportedInfoboxMemberCandidateKeys: missingInfoboxes,
      missingSupportedInfoboxMembers: missingInfoboxMembers,
      unbalancedSupportedInfoboxMemberCandidateKeys: unbalancedInfoboxes,
      infoboxTemplateCounts: Object.fromEntries(sorted(unique(records.map(record => record.infoboxEvidence?.template).filter(Boolean))).map(template => [template, records.filter(record => record.infoboxEvidence?.template === template).length])),
      totalInfoboxParameterOccurrences: records.reduce((sum, record) => sum + (record.infoboxEvidence?.parameters?.length || 0), 0),
      totalLeadParagraphs: records.reduce((sum, record) => sum + (record.leadParagraphEvidence?.length || 0), 0),
      totalHeadings: records.reduce((sum, record) => sum + (record.headingEvidence?.length || 0), 0)
    },
    lexicalCandidateCoverage: {
      policySignalCount: policySignals.size,
      matchedStatementCount: records.reduce((sum, record) => sum + (record.lexicalReviewCandidates?.length || 0), 0),
      candidateCountWithAnyMatch: records.filter(record => record.lexicalReviewCandidates?.length).length,
      familyCounts: Object.fromEntries(Object.entries(familyCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      signalCounts: Object.fromEntries(Object.entries(signalCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      unexpectedSignalKeys
    },
    semanticPromotionCoverage: {
      reviewReadyCount: records.filter(record => record.state === 'review_ready').length,
      semanticIdentityReviewedCount: records.filter(record => record.semanticIdentityReview?.state !== 'unreviewed').length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    sourceEvidenceCoverageComplete,
    semanticReviewComplete: false,
    repeatabilityReviewComplete: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: sourceEvidenceCoverageComplete
  };
}
