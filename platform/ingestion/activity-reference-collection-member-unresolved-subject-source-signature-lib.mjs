import { parseLeadParagraphEvidence, parseSourceHeadings } from './activity-candidate-source-evidence-lib.mjs';
import { parseSkillTrainingGuideDirectLinks } from './skill-training-guide-direct-link-lib.mjs';
import { parseDirectCategorySignatures, parseRootTemplateSignatures } from './unlock-linked-page-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = page => page?.revisions?.[0]?.slots?.main?.content;
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;

function maskIgnored(text) {
  return String(text ?? '').replace(
    /<!--[\s\S]*?-->|<(nowiki|pre|syntaxhighlight|source|code)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    match => match.replace(/[^\r\n]/g, ' ')
  );
}

export function auditSourceTemplateDelimiters(content = '') {
  const masked = maskIgnored(content);
  let openCount = 0;
  let closeCount = 0;
  let depth = 0;
  let underflow = false;
  for (let index = 0; index < masked.length - 1; index++) {
    const pair = masked.slice(index, index + 2);
    if (pair === '{{') { openCount++; depth++; index++; continue; }
    if (pair === '}}') { closeCount++; if (depth === 0) underflow = true; else depth--; index++; }
  }
  return { openCount, closeCount, finalDepth: depth, underflow, balanced: openCount === closeCount && depth === 0 && !underflow };
}

function directLinkEvidence(content, route) {
  const parsed = parseSkillTrainingGuideDirectLinks({
    content,
    sourcePageId: route.sourcePageId,
    title: route.resolvedTitle,
    sourceRevision: route.sourceRevision,
    sourceTimestamp: route.sourceTimestamp,
    sourceUrl: route.sourceUrl,
    sourceContentHash: route.sourceContentHash,
    skillKeys: [],
    channels: ['unresolved_subject_source_signature']
  });
  return {
    links: parsed.occurrences.map((link, index) => ({
      occurrenceKey: `${route.memberCandidateKey}:direct-link:${index + 1}`,
      ordinal: index + 1,
      sourceTarget: link.sourceTarget,
      requestedTitle: link.requestedTitle,
      requestedFragment: link.requestedFragment,
      displayText: link.displayText,
      namespaceClass: link.namespaceClass,
      sourceLocator: link.sourceLocator,
      relationshipState: 'unreviewed_candidate_only'
    })),
    delimiterAudit: {
      openCount: parsed.audit.sourceOpenCount,
      closeCount: parsed.audit.sourceCloseCount,
      balanced: parsed.audit.balancedSourceLinkDelimiters
    }
  };
}

function structuralEvidence(content, route) {
  const declarationSource = maskIgnored(content);
  const links = directLinkEvidence(content, route);
  return {
    rootTemplates: parseRootTemplateSignatures(content),
    rootTemplateDelimiterAudit: auditSourceTemplateDelimiters(content),
    directCategories: parseDirectCategorySignatures(content),
    leadParagraphEvidence: parseLeadParagraphEvidence(declarationSource, null),
    headingEvidence: parseSourceHeadings(declarationSource),
    sourceAuthoredLinks: links.links,
    sourceLinkDelimiterAudit: links.delimiterAudit
  };
}

const inputProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
  sourceRoutingContentHash: record.contentHash,
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
  sourceBlockers: record.sourceBlockers || []
});

const outputProjection = record => JSON.stringify({
  memberCandidateKey: record.memberCandidateKey,
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
  sourceBlockers: record.sourceBlockers || []
});

function evidenceProjection(record) {
  return JSON.stringify({
    rootTemplates: record.rootTemplates || [],
    rootTemplateDelimiterAudit: record.rootTemplateDelimiterAudit || null,
    directCategories: record.directCategories || [],
    leadParagraphEvidence: record.leadParagraphEvidence || [],
    headingEvidence: record.headingEvidence || [],
    sourceAuthoredLinks: record.sourceAuthoredLinks || [],
    sourceLinkDelimiterAudit: record.sourceLinkDelimiterAudit || null
  });
}

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

function routeMatchesPolicy(record, policy = {}) {
  const expected = policy.inputRoute || {};
  return record?.contract === policy.inputContract
    && record?.routingDecision?.routeKey === expected.routeKey
    && record?.routingDecision?.routeState === expected.routeState
    && record?.sourceDisposition?.state === expected.sourceState
    && record?.sourceDisposition?.disposition === null;
}

export function selectUnresolvedSubjectSourceSignatureRoutes(routingRecords = [], policy = {}) {
  return routingRecords.filter(record => routeMatchesPolicy(record, policy));
}

export function findUnresolvedSubjectSourceSignatureAccountState(records = []) {
  const findings = [];
  const visit = (value, path, recordKey) => {
    if (Array.isArray(value)) { value.forEach((child, index) => visit(child, `${path}[${index}]`, recordKey)); return; }
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

export function buildActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures({ routingRecords = [], fetchedPages = [], policy = {}, contentHash = value => value }) {
  const routes = selectUnresolvedSubjectSourceSignatureRoutes(routingRecords, policy);
  const pageByRevision = new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
  const records = routes.map(route => {
    const fetched = pageByRevision.get(String(route.sourceRevision || ''));
    const page = fetched?.page || null;
    const revision = fetched?.revision || null;
    const content = sourceContent(page);
    const computedHash = typeof content === 'string' ? contentHash(content) : null;
    const computedUrl = page?.title ? wikiUrl(page.title) : null;
    const identityContextsAligned = (route.memberIdentityContexts || []).length > 0 && (route.memberIdentityContexts || []).every(context =>
      Number(context.pageId) === Number(route.sourcePageId)
      && context.resolvedTitle === route.resolvedTitle
      && String(context.observedRevision || '') === String(route.sourceRevision || '')
      && context.observedTimestamp === route.sourceTimestamp
      && context.observedSourceUrl === route.sourceUrl
      && context.observedContentHash === route.sourceContentHash
    );
    const revisionAlignment = {
      routingRecordMatchesPolicyRoute: routeMatchesPolicy(route, policy),
      retainedIdentityContextsPresentAndAligned: identityContextsAligned,
      fetchedPageIdMatchesRoutingRecord: Boolean(page && Number(page.pageid) === Number(route.sourcePageId)),
      fetchedTitleMatchesRoutingRecord: Boolean(page && page.title === route.resolvedTitle),
      fetchedRevisionMatchesRoutingRecord: Boolean(revision && String(revision.revid) === String(route.sourceRevision || '')),
      fetchedTimestampMatchesRoutingRecord: Boolean(revision && revision.timestamp === route.sourceTimestamp),
      fetchedUrlMatchesRoutingRecord: Boolean(computedUrl && computedUrl === route.sourceUrl),
      fetchedContentHashMatchesRoutingRecord: Boolean(computedHash && computedHash === route.sourceContentHash)
    };
    const evidence = typeof content === 'string' ? structuralEvidence(content, route) : {
      rootTemplates: [],
      rootTemplateDelimiterAudit: { openCount: 0, closeCount: 0, finalDepth: 0, underflow: false, balanced: false },
      directCategories: [],
      leadParagraphEvidence: [],
      headingEvidence: [],
      sourceAuthoredLinks: [],
      sourceLinkDelimiterAudit: { openCount: 0, closeCount: 0, balanced: false }
    };
    const blockers = [];
    if (!page || !revision || typeof content !== 'string') blockers.push('exact_unresolved_subject_revision_source_content_missing');
    if (!Object.values(revisionAlignment).every(Boolean)) blockers.push('routing_identity_or_fetched_source_alignment_failed');
    if (!evidence.rootTemplateDelimiterAudit.balanced) blockers.push('source_template_delimiters_unbalanced');
    if (!evidence.sourceLinkDelimiterAudit.balanced) blockers.push('source_wikilink_delimiters_unbalanced');
    blockers.push(
      'source_subject_disposition_still_unresolved',
      'root_template_category_lead_heading_and_link_signatures_require_semantic_review',
      'linked_subject_relationships_not_reviewed',
      'canonical_game_entity_identity_not_established',
      'canonical_activity_identity_not_established',
      'repeatability_and_member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: 'sensum.activity-reference-collection-member-unresolved-subject-source-signature.v1',
      memberCandidateKey: route.memberCandidateKey,
      sourceRoutingContentHash: route.contentHash,
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
      sourceContentHash: computedHash,
      sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null,
      sourceDisposition: route.sourceDisposition,
      routingDecision: route.routingDecision,
      sourceBlockers: route.sourceBlockers || [],
      revisionAlignment,
      ...evidence,
      subjectIdentityReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
      linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: 'review_evidence_collected_subject_unresolved'
    };
  });
  return { records, audit: auditActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures(records, { routingRecords, fetchedPages, policy }) };
}

export function auditActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures(records = [], { routingRecords = [], fetchedPages = [], policy = {} } = {}) {
  const expectedRoutes = selectUnresolvedSubjectSourceSignatureRoutes(routingRecords, policy);
  const expectedKeys = expectedRoutes.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(expectedRoutes.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = expectedKeys.filter(key => !outputByKey.has(key) || inputProjection(inputByKey.get(key)) !== outputProjection(outputByKey.get(key)));
  const expectedRevisionIds = sorted(unique(expectedRoutes.map(record => String(record.sourceRevision || '')).filter(Boolean)));
  const fetchedRevisionRows = fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({ page, revision })));
  const fetchedRevisionIds = fetchedRevisionRows.map(({ revision }) => String(revision.revid || '')).filter(Boolean);
  const duplicateFetchedRevisions = duplicates(fetchedRevisionIds);
  const missingFetchedRevisions = expectedRevisionIds.filter(revision => !fetchedRevisionIds.includes(revision));
  const unexpectedFetchedRevisions = fetchedRevisionIds.filter(revision => !expectedRevisionIds.includes(revision));
  const sourceAlignmentFailures = records.filter(record => !Object.values(record.revisionAlignment || {}).every(Boolean)).map(record => record.memberCandidateKey);
  const fetchedByRevision = new Map(fetchedRevisionRows.map(row => [String(row.revision.revid), row.page]));
  const evidenceMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const content = sourceContent(fetchedByRevision.get(String(record.sourceRevision || '')));
    if (!input || typeof content !== 'string') return true;
    return evidenceProjection(record) !== JSON.stringify(structuralEvidence(content, input));
  }).map(record => record.memberCandidateKey);
  const templateDelimiterFailures = records.filter(record => record.rootTemplateDelimiterAudit?.balanced !== true).map(record => record.memberCandidateKey);
  const linkDelimiterFailures = records.filter(record => record.sourceLinkDelimiterAudit?.balanced !== true).map(record => record.memberCandidateKey);
  const policySpecificPaths = policyForbiddenPaths(policy);
  const unsupportedPromotions = records.filter(record =>
    record.subjectIdentityReview?.state !== 'unreviewed'
    || record.linkedSubjectRelationshipReview?.state !== 'unreviewed'
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.repeatabilityReview?.state !== 'unreviewed'
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_broader_source_signature_subject_review_routes');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_unresolved_subject_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_identity_revision_hash_collection_or_alias_contexts_changed');
  if (duplicateFetchedRevisions.length || missingFetchedRevisions.length || unexpectedFetchedRevisions.length) structuralBlockers.push('exact_unresolved_subject_revision_fetch_set_incomplete');
  if (sourceAlignmentFailures.length) structuralBlockers.push('one_or_more_unresolved_subject_sources_failed_page_title_revision_timestamp_or_hash_alignment');
  if (evidenceMismatches.length) structuralBlockers.push('one_or_more_structural_evidence_sets_do_not_match_exact_revision_source');
  if (templateDelimiterFailures.length || linkDelimiterFailures.length) structuralBlockers.push('one_or_more_exact_revision_sources_have_unbalanced_delimiters');
  if (policySpecificPaths.length) structuralBlockers.push('page_specific_or_collection_class_source_signature_policy_forbidden');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_subject_relationship_repeatability_member_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_unresolved_subject_source_signatures');
  const sourceSignatureCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const rootTemplateCounts = {};
  for (const template of records.flatMap(record => record.rootTemplates || [])) rootTemplateCounts[template.template] = (rootTemplateCounts[template.template] || 0) + 1;
  const blockers = [...structuralBlockers,
    'one_or_more_subject_dispositions_remain_unresolved',
    'linked_subject_relationship_review_pending',
    'canonical_game_entity_and_activity_identities_not_established',
    'repeatability_and_member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  ];
  return {
    contract: 'sensum.activity-reference-collection-member-unresolved-subject-source-signature-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      routingRecordCount: routingRecords.length,
      expectedUnresolvedSubjectCount: expectedKeys.length,
      sourceSignatureRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    sourceAlignment: {
      expectedRevisionCount: expectedRevisionIds.length,
      fetchedRevisionCount: fetchedRevisionIds.length,
      duplicateFetchedRevisions,
      missingFetchedRevisions,
      unexpectedFetchedRevisions,
      fullyAlignedCount: records.length - sourceAlignmentFailures.length,
      failedMemberCandidateKeys: sourceAlignmentFailures,
      exactFetchedRevisionSetAndSourceAlignment: !duplicateFetchedRevisions.length && !missingFetchedRevisions.length && !unexpectedFetchedRevisions.length && !sourceAlignmentFailures.length
    },
    structuralEvidenceCoverage: {
      totalSourceContentBytes: records.reduce((sum, record) => sum + Number(record.sourceContentBytes || 0), 0),
      pagesWithRootTemplates: records.filter(record => record.rootTemplates?.length).length,
      pagesWithoutRootTemplates: records.filter(record => !record.rootTemplates?.length).map(record => record.memberCandidateKey),
      uniqueRootTemplateCount: Object.keys(rootTemplateCounts).length,
      rootTemplateCounts: Object.fromEntries(Object.entries(rootTemplateCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      directCategoryCount: records.reduce((sum, record) => sum + (record.directCategories?.length || 0), 0),
      leadParagraphCount: records.reduce((sum, record) => sum + (record.leadParagraphEvidence?.length || 0), 0),
      headingCount: records.reduce((sum, record) => sum + (record.headingEvidence?.length || 0), 0),
      sourceAuthoredLinkOccurrenceCount: records.reduce((sum, record) => sum + (record.sourceAuthoredLinks?.length || 0), 0),
      mainNamespaceLinkOccurrenceCount: records.reduce((sum, record) => sum + (record.sourceAuthoredLinks || []).filter(link => link.namespaceClass === 'main').length, 0),
      templateDelimiterFailureMemberCandidateKeys: templateDelimiterFailures,
      linkDelimiterFailureMemberCandidateKeys: linkDelimiterFailures,
      exactRevisionEvidenceMismatchMemberCandidateKeys: evidenceMismatches,
      policySpecificPaths,
      collectionContextDerivedEvidenceMemberCandidateKeys: []
    },
    semanticPromotionCoverage: {
      subjectIdentityReviewedCount: records.filter(record => record.subjectIdentityReview?.state !== 'unreviewed').length,
      linkedSubjectRelationshipReviewedCount: records.filter(record => record.linkedSubjectRelationshipReview?.state !== 'unreviewed').length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    sourceSignatureCoverageComplete,
    subjectIdentityReviewComplete: false,
    linkedSubjectRelationshipReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: sourceSignatureCoverageComplete
  };
}
