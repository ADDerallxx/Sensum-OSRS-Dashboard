import { hash } from '../ingestion/lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => left !== undefined && right !== undefined && contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const allTrue = value => value && typeof value === 'object' && Object.keys(value).length > 0 && Object.values(value).every(Boolean);
const EXPECTED_CLASSIFICATIONS = [
  'described_category_page_resolution_review_ready',
  'active_redlink_category_target_resolution_review_ready'
];
const EXPECTED_ROUTES = [
  'explicit_source_bound_described_category_page_resolution_review',
  'explicit_source_bound_redlink_category_target_resolution_review'
];
const EXPECTED_DECISIONS = {
  described_category_page_resolution_review_ready: [
    'confirm_exact_current_category_page_resolution',
    'reject_exact_current_category_page_resolution',
    'needs_additional_evidence'
  ],
  active_redlink_category_target_resolution_review_ready: [
    'confirm_active_redlink_category_target',
    'reject_active_redlink_category_target',
    'needs_additional_evidence'
  ]
};
const CONFIRMATION_DOES_NOT_PROVE = [
  'canonical_game_entity_identity',
  'canonical_activity_identity',
  'repeatability',
  'requirements',
  'variants',
  'xp',
  'timing',
  'mechanics',
  'optimizer_eligibility'
];

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|title|titles|requestedTitle|requestedTitles|renderedTargetKey|renderedTargetKeys|memberName|memberNames|alias|aliases|override|overrides)$/i;
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  walk(policy);
  return sorted(unique(findings));
}

export function compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExportPolicy(policy = {}) {
  const requiredRules = [
    'everyInputDispositionMustUseAReviewReadyCategoryRoute',
    'everyEligibleDispositionExportsExactlyOnce',
    'queueOrderMustPreserveDispositionOrder',
    'dispositionEvidenceAndBothSnapshotBindingsMustRevalidate',
    'allNestedEvidenceHashesSourcesOccurrencesAndMemberCountsMustRevalidate',
    'everyQueueEntryMustBindImmutableEvidenceAndSourceFingerprints',
    'readableArtifactMustUseOnlyRetainedRevisionPinnedCategoryEvidence',
    'decisionTemplatesMustStartBlank',
    'exportDoesNotRecordAReviewDecisionReviewerDateNotesEvidenceOrResolution',
    'confirmationWouldNotProveGameEntityActivityRepeatabilityMechanicsOrOptimizerEligibility',
    'namesTitlesPageIdsRevisionsMemberNamesAliasesAndOverridesCannotAlterPolicyBehavior',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.evidencePacketContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery.v1'
    && policy.inputContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition.v1'
    && policy.queueContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-entry.v1'
    && policy.decisionTemplateContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-template.v1'
    && policy.auditContract === 'sensum.cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-export-audit.v1'
    && policy.evidencePacketState === 'revision_pinned_unresolved_rendered_target_additional_resolution_evidence_gates_closed'
    && policy.inputState === 'unresolved_rendered_target_additional_resolution_evidence_sufficiency_disposition_gates_closed'
    && policy.queueState === 'pending_explicit_source_bound_category_target_resolution_review';
  const configurationValid = same(policy.eligibleClassifications || [], EXPECTED_CLASSIFICATIONS)
    && same(policy.eligibleReviewRoutes || [], EXPECTED_ROUTES)
    && same(policy.classificationReviewRoutes || {}, Object.fromEntries(EXPECTED_CLASSIFICATIONS.map((classification, index) => [classification, EXPECTED_ROUTES[index]])))
    && same(policy.classificationAllowedDecisions || {}, EXPECTED_DECISIONS);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractValid && configurationValid && invalidRules.length === 0 && forbidden.length === 0, contractValid, configurationValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function accountStateFindings(values = []) {
  const forbidden = /^(?:currentBaseLevel|targetBaseLevel|currentLevel|currentXp|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|bank|bankItems|playerName|username|preferences|currentAccount)$/i;
  const findings = [];
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  values.forEach((value, index) => walk(value, `[${index}]`));
  return sorted(unique(findings));
}

function nestedHashValid(value, contentHash = hash) {
  return validHash(value?.evidenceContentHash) && contentHash(without(value, 'evidenceContentHash')) === value.evidenceContentHash;
}

function sourceIdentityIntegrity(identity = {}, requireSourceText = true, contentHash = hash) {
  const checks = {
    pageId: Number.isInteger(Number(identity.sourcePageId)) && Number(identity.sourcePageId) > 0,
    namespace: Number.isInteger(Number(identity.namespaceId)),
    title: typeof identity.resolvedTitle === 'string' && identity.resolvedTitle.length > 0,
    revision: typeof identity.sourceRevision === 'string' && /^\d+$/.test(identity.sourceRevision),
    timestamp: typeof identity.sourceTimestamp === 'string' && !Number.isNaN(Date.parse(identity.sourceTimestamp)),
    url: typeof identity.sourceUrl === 'string' && identity.sourceUrl.startsWith('https://oldschool.runescape.wiki/w/'),
    sourceHash: validHash(identity.sourceContentHash),
    sourceBytes: Number.isInteger(Number(identity.sourceContentBytes)) && Number(identity.sourceContentBytes) >= 0,
    sourceText: !requireSourceText || typeof identity.sourceText === 'string',
    sourceTextHash: !requireSourceText || contentHash(identity.sourceText) === identity.sourceContentHash,
    sourceTextBytes: !requireSourceText || new TextEncoder().encode(identity.sourceText).length === Number(identity.sourceContentBytes)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function normalizedWikiTitle(value) {
  const title = String(value || '').replaceAll('_', ' ').trim();
  const colon = title.indexOf(':');
  const prefix = colon >= 0 ? title.slice(0, colon).toLocaleLowerCase('en') : '';
  const rest = colon >= 0 ? title.slice(colon + 1) : title;
  return `${prefix}:${rest ? `${rest[0].toLocaleUpperCase('en')}${rest.slice(1)}` : rest}`;
}

function occurrenceTargets(occurrence = {}, requestedTitle = '') {
  const match = String(occurrence.sourceText || '').match(/^\[\[\s*([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/);
  return Boolean(match && normalizedWikiTitle(match[1]) === normalizedWikiTitle(requestedTitle));
}

function occurrenceIntegrity(occurrence = {}, identity = {}, requestedTitle = '', requireLineBinding = true, contentHash = hash) {
  const lines = typeof identity.sourceText === 'string' ? identity.sourceText.split(/\r?\n/) : [];
  const checks = {
    line: Number.isInteger(Number(occurrence.line)) && Number(occurrence.line) > 0,
    exactText: typeof occurrence.sourceText === 'string' && occurrence.sourceText.length > 0,
    exactTextHash: validHash(occurrence.sourceTextContentHash) && contentHash(occurrence.sourceText) === occurrence.sourceTextContentHash,
    exactTarget: occurrenceTargets(occurrence, requestedTitle),
    exactLineBinding: !requireLineBinding || lines[Number(occurrence.line) - 1] === occurrence.sourceText
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function packetIntegrity(packet = {}, policy = {}, contentHash = hash) {
  const requestedTitle = packet.requestedTitles?.[0];
  const nestedKeys = ['namespaceMetadataEvidence', 'exactCurrentCategoryEvidence', 'categoryPrefixEvidence', 'categoryMemberEvidence', 'namespaceSearchEvidence', 'titleHistoryEvidence'];
  const nested = nestedKeys.map(key => packet[key]);
  const members = packet.categoryMemberEvidence?.members || [];
  const memberIdentities = members.map(member => member.currentSourceIdentity);
  const searchIdentities = (packet.namespaceSearchEvidence?.queries || []).flatMap(query => query.candidates || []).map(candidate => candidate.sourceIdentity);
  const exactIdentity = packet.exactCurrentCategoryEvidence?.currentPageIdentity;
  const completeIdentities = [...memberIdentities, ...searchIdentities, ...(exactIdentity ? [exactIdentity] : [])];
  const identityByPageRevision = new Map(completeIdentities.map(identity => [`${identity?.sourcePageId}|${identity?.sourceRevision}`, identity]));
  const memberFailures = members.filter(member => {
    const identity = member.currentSourceIdentity;
    return member.complete !== true || !allTrue(member.checks) || !sourceIdentityIntegrity(identity, true, contentHash).complete
      || Number(member.pageId) !== Number(identity?.sourcePageId) || Number(member.namespaceId) !== Number(identity?.namespaceId) || member.title !== identity?.resolvedTitle
      || !(member.exactCategoryOccurrences || []).length || (member.exactCategoryOccurrences || []).some(occurrence => !occurrenceIntegrity(occurrence, identity, requestedTitle, true, contentHash).complete);
  });
  const reconciliation = packet.categoryMemberEvidence?.categoryInfoReconciliation || {};
  const memberCounts = {
    size: members.length,
    pages: members.filter(member => Number(member.namespaceId) === 0).length,
    files: members.filter(member => Number(member.namespaceId) === 6).length,
    subcategories: members.filter(member => Number(member.namespaceId) === 14).length
  };
  const pinnedFailures = (packet.pinnedGuideRevalidations || []).filter(item => {
    const identity = item.sourceIdentity || {};
    const completeIdentity = identityByPageRevision.get(`${identity.sourcePageId}|${identity.sourceRevision}`);
    return item.complete !== true || !allTrue(item.checks) || !sourceIdentityIntegrity(identity, false, contentHash).complete || !completeIdentity
      || !['namespaceId', 'resolvedTitle', 'sourceContentBytes', 'sourceContentHash', 'sourcePageId', 'sourceRevision', 'sourceTimestamp', 'sourceUrl'].every(key => identity[key] === completeIdentity[key])
      || !(item.exactCategoryOccurrences || []).length || (item.exactCategoryOccurrences || []).some(occurrence => !occurrenceIntegrity(occurrence, completeIdentity, requestedTitle, true, contentHash).complete);
  });
  const queries = packet.namespaceSearchEvidence?.queries || [];
  const searchFailures = queries.filter(query => query.complete !== true || query.continuationExhausted !== true || Number(query.namespaceId) !== 14
    || Number(query.candidateCount) !== (query.candidates || []).length || (query.candidates || []).some(candidate => !sourceIdentityIntegrity(candidate.sourceIdentity, true, contentHash).complete));
  const expectedEvidenceKeys = sorted(unique([...nested.map(value => value?.evidenceContentHash), ...(packet.pinnedGuideRevalidations || []).map(value => contentHash(value))].filter(Boolean)));
  const channelKeys = (packet.requiredChannelStatus || []).flatMap(item => item.evidenceKeys || []);
  const review = packet.resolutionReview || {};
  const info = packet.exactCurrentCategoryEvidence?.categoryInfo || {};
  const checks = {
    contractMatches: packet.contract === policy.evidencePacketContract,
    stateMatches: packet.state === policy.evidencePacketState,
    recordContentHashMatches: validHash(packet.recordContentHash) && contentHash(without(packet, 'recordContentHash', 'contentHash')) === packet.recordContentHash,
    snapshotRecordContentHashMatches: validHash(packet.contentHash) && contentHash(without(packet, 'contentHash')) === packet.contentHash,
    upstreamBindingsPresent: [packet.evidencePacketKey, packet.workQueueEntryKey, packet.sourceWorkQueueRecordContentHash, packet.sourceQueueSnapshotContentHash,
      packet.sourceDispositionKey, packet.sourceDispositionRecordContentHash, packet.sourceEvidenceRecordContentHash, packet.sourceDispositionSnapshotContentHash,
      packet.sourceEvidenceSnapshotContentHash, packet.evidenceFingerprint, packet.renderedTargetKey].every(value => typeof value === 'string' && value.length > 0),
    oneRequestedCategoryTitle: Array.isArray(packet.requestedTitles) && packet.requestedTitles.length === 1 && requestedTitle?.startsWith('Category:'),
    nestedRequestedTitlesMatch: [packet.exactCurrentCategoryEvidence?.requestedTitle, packet.categoryPrefixEvidence?.requestedTitle,
      packet.categoryMemberEvidence?.requestedTitle, packet.namespaceSearchEvidence?.requestedTitle, packet.titleHistoryEvidence?.requestedTitle,
      ...(packet.pinnedGuideRevalidations || []).map(item => item.requestedTitle)].every(value => value === requestedTitle),
    nestedEvidenceHashesComplete: nested.every(value => nestedHashValid(value, contentHash) && value.complete === true),
    officialCategoryNamespace: Number(packet.namespaceMetadataEvidence?.namespaceId) === 14 && packet.namespaceMetadataEvidence?.canonicalName === 'Category' && packet.namespaceMetadataEvidence?.queryComplete === true,
    exactCategoryEvidenceChecksComplete: allTrue(packet.exactCurrentCategoryEvidence?.checks) && packet.exactCurrentCategoryEvidence?.queryComplete === true,
    exactPrefixComplete: packet.categoryPrefixEvidence?.exactBaseTitlePresent === true && packet.categoryPrefixEvidence?.continuationExhausted === true,
    memberInventoryComplete: packet.categoryMemberEvidence?.continuationExhausted === true && Number(packet.categoryMemberEvidence?.memberCount) === members.length && memberFailures.length === 0,
    memberInventoryReconciles: Number(reconciliation.reportedSize) === memberCounts.size && Number(reconciliation.enumeratedSize) === memberCounts.size
      && Number(reconciliation.reportedPages) === memberCounts.pages && Number(reconciliation.enumeratedPages) === memberCounts.pages
      && Number(reconciliation.reportedFiles) === memberCounts.files && Number(reconciliation.enumeratedFiles) === memberCounts.files
      && Number(reconciliation.reportedSubcategories) === memberCounts.subcategories && Number(reconciliation.enumeratedSubcategories) === memberCounts.subcategories
      && Number(info.size) === memberCounts.size && Number(info.pages) === memberCounts.pages && Number(info.files) === memberCounts.files && Number(info.subcategories) === memberCounts.subcategories,
    pinnedGuideRevalidationsComplete: (packet.pinnedGuideRevalidations || []).length > 0 && pinnedFailures.length === 0,
    namespaceSearchComplete: packet.namespaceSearchEvidence?.allExpectedQueriesPresent === true && queries.length > 0 && searchFailures.length === 0 && packet.namespaceSearchEvidence?.selectedCandidatePageId === null,
    titleHistoryComplete: packet.titleHistoryEvidence?.continuationExhausted === true && Number(packet.titleHistoryEvidence?.eventCount) === (packet.titleHistoryEvidence?.events || []).length,
    newEvidenceKeysMatch: same(packet.newEvidenceKeys || [], expectedEvidenceKeys, contentHash),
    requiredChannelsComplete: (packet.requiredChannelStatus || []).length === 3 && packet.requiredChannelStatus.every(item => item.observed === true && item.evidenceKeys?.length > 0) && channelKeys.every(key => expectedEvidenceKeys.includes(key)),
    sourceSilencePreserved: packet.sourceSilenceIsNotNegativeEvidence === true,
    reviewBlank: [review.decision, review.reviewer, review.reviewedAt, review.reviewNotes].every(value => value === null) && Array.isArray(review.evidenceKeys) && review.evidenceKeys.length === 0,
    semanticGatesClosed: packet.selectedResolution === null && packet.canonicalGameEntityIdentity === null && packet.canonicalActivityIdentity === null
      && packet.repeatabilityClassification === null && packet.mechanicsReviewComplete === false && packet.optimizerEligible === false && packet.automaticVerificationApplied === false,
    accountIndependent: packet.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean), memberFailures: memberFailures.length, pinnedFailures: pinnedFailures.length, searchFailures: searchFailures.length };
}

function dispositionIntegrity(disposition = {}, packet = {}, policy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '', contentHash = hash) {
  const classification = disposition.classification;
  const expectedRoute = policy.classificationReviewRoutes?.[classification];
  const expectedDecisions = policy.classificationAllowedDecisions?.[classification];
  const binding = disposition.evidenceBindings || {};
  const review = disposition.resolutionReview || {};
  const evidenceShapeValid = classification === EXPECTED_CLASSIFICATIONS[0]
    ? disposition.evidenceShape?.describedCategoryPageReviewEvidenceComplete === true
    : disposition.evidenceShape?.activeRedlinkCategoryReviewEvidenceComplete === true;
  const checks = {
    contractMatches: disposition.contract === policy.inputContract,
    stateMatches: disposition.state === policy.inputState,
    recordContentHashMatches: validHash(disposition.recordContentHash) && contentHash(without(disposition, 'recordContentHash', 'contentHash')) === disposition.recordContentHash,
    snapshotRecordContentHashMatches: validHash(disposition.contentHash) && contentHash(without(disposition, 'contentHash')) === disposition.contentHash,
    reviewReadyClassification: policy.eligibleClassifications?.includes(classification),
    exactReviewRoute: disposition.reviewRoute === expectedRoute && policy.eligibleReviewRoutes?.includes(disposition.reviewRoute),
    evidenceShapeValid,
    allowedDecisionsMatch: same(disposition.allowedReviewDecisions, expectedDecisions, contentHash),
    packetBindingsMatch: disposition.sourceEvidencePacketKey === packet?.evidencePacketKey && disposition.sourceEvidencePacketRecordContentHash === packet?.recordContentHash
      && disposition.sourceEvidencePacketSnapshotContentHash === evidenceSnapshotContentHash,
    upstreamBindingsMatch: disposition.sourceWorkQueueEntryKey === packet?.workQueueEntryKey && disposition.sourceDispositionKey === packet?.sourceDispositionKey
      && disposition.sourceDispositionRecordContentHash === packet?.sourceDispositionRecordContentHash && disposition.sourceEvidenceRecordContentHash === packet?.sourceEvidenceRecordContentHash
      && disposition.evidenceFingerprint === packet?.evidenceFingerprint && disposition.renderedTargetKey === packet?.renderedTargetKey && same(disposition.requestedTitles, packet?.requestedTitles, contentHash),
    evidenceBindingsMatch: binding.namespaceMetadataEvidenceContentHash === packet?.namespaceMetadataEvidence?.evidenceContentHash
      && binding.exactCurrentCategoryEvidenceContentHash === packet?.exactCurrentCategoryEvidence?.evidenceContentHash
      && binding.categoryPrefixEvidenceContentHash === packet?.categoryPrefixEvidence?.evidenceContentHash
      && binding.categoryMemberEvidenceContentHash === packet?.categoryMemberEvidence?.evidenceContentHash
      && binding.namespaceSearchEvidenceContentHash === packet?.namespaceSearchEvidence?.evidenceContentHash
      && binding.titleHistoryEvidenceContentHash === packet?.titleHistoryEvidence?.evidenceContentHash
      && same(binding.pinnedGuideRevalidationContentHashes, sorted((packet?.pinnedGuideRevalidations || []).map(item => contentHash(item))), contentHash)
      && same(binding.newEvidenceKeys, packet?.newEvidenceKeys, contentHash),
    dispositionSnapshotBound: validHash(dispositionSnapshotContentHash),
    reviewBlank: review.state === 'unreviewed' && [review.decision, review.reviewer, review.reviewedAt, review.reviewNotes].every(value => value === null) && review.evidenceKeys?.length === 0,
    semanticGatesClosed: disposition.selectedResolution === null && disposition.canonicalGameEntityIdentity === null && disposition.canonicalActivityIdentity === null
      && disposition.repeatabilityClassification === null && disposition.mechanicsReviewComplete === false && disposition.optimizerEligible === false && disposition.automaticVerificationApplied === false,
    accountIndependent: disposition.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function compactIdentity(identity = {}) {
  return {
    namespaceId: identity.namespaceId,
    resolvedTitle: identity.resolvedTitle,
    sourcePageId: identity.sourcePageId,
    sourceRevision: identity.sourceRevision,
    sourceTimestamp: identity.sourceTimestamp,
    sourceUrl: identity.sourceUrl,
    sourceContentHash: identity.sourceContentHash,
    sourceContentBytes: identity.sourceContentBytes
  };
}

function compactOccurrences(occurrences = []) {
  return occurrences.map(item => ({ line: item.line, exactSourceText: item.sourceText, exactSourceTextContentHash: item.sourceTextContentHash }));
}

function categoryEvidence(disposition, packet) {
  const exact = packet.exactCurrentCategoryEvidence;
  return {
    namespace: {
      namespaceId: packet.namespaceMetadataEvidence.namespaceId,
      canonicalName: packet.namespaceMetadataEvidence.canonicalName,
      localizedName: packet.namespaceMetadataEvidence.localizedName,
      caseRule: packet.namespaceMetadataEvidence.caseRule,
      evidenceContentHash: packet.namespaceMetadataEvidence.evidenceContentHash
    },
    currentCategoryState: {
      requestedTitle: exact.requestedTitle,
      categoryExistsByApiState: exact.categoryExistsByApiState,
      pageDescriptionExists: exact.pageDescriptionExists,
      redlinkCategoryState: exact.redlinkCategoryState,
      currentMissingPage: exact.currentMissingPage,
      currentPageIdentity: exact.currentPageIdentity ? compactIdentity(exact.currentPageIdentity) : null,
      categoryInfo: exact.categoryInfo,
      evidenceContentHash: exact.evidenceContentHash
    },
    prefixInventory: {
      prefix: packet.categoryPrefixEvidence.prefix,
      exactBaseTitlePresent: packet.categoryPrefixEvidence.exactBaseTitlePresent,
      entries: packet.categoryPrefixEvidence.entries,
      evidenceContentHash: packet.categoryPrefixEvidence.evidenceContentHash
    },
    memberInventory: {
      memberCount: packet.categoryMemberEvidence.memberCount,
      categoryInfoReconciliation: packet.categoryMemberEvidence.categoryInfoReconciliation,
      members: packet.categoryMemberEvidence.members.map(member => ({
        pageId: member.pageId,
        namespaceId: member.namespaceId,
        title: member.title,
        sourceIdentity: compactIdentity(member.currentSourceIdentity),
        exactCategoryOccurrences: compactOccurrences(member.exactCategoryOccurrences)
      })),
      evidenceContentHash: packet.categoryMemberEvidence.evidenceContentHash
    },
    pinnedGuideRevalidations: packet.pinnedGuideRevalidations.map(item => ({
      workQueueEntryKey: item.workQueueEntryKey,
      requestedTitle: item.requestedTitle,
      sourceIdentity: compactIdentity(item.sourceIdentity),
      exactCategoryOccurrences: compactOccurrences(item.exactCategoryOccurrences),
      evidenceContentHash: hash(item)
    })),
    namespaceSearch: {
      queries: packet.namespaceSearchEvidence.queries.map(query => ({
        queryKind: query.queryKind,
        query: query.query,
        terms: query.terms,
        namespaceId: query.namespaceId,
        candidateCount: query.candidateCount,
        candidates: (query.candidates || []).map(candidate => ({ ...without(candidate, 'sourceIdentity'), sourceIdentity: compactIdentity(candidate.sourceIdentity) }))
      })),
      evidenceContentHash: packet.namespaceSearchEvidence.evidenceContentHash
    },
    titleHistory: {
      eventCount: packet.titleHistoryEvidence.eventCount,
      events: packet.titleHistoryEvidence.events,
      evidenceContentHash: packet.titleHistoryEvidence.evidenceContentHash
    },
    evidenceBindings: disposition.evidenceBindings
  };
}

function reviewScope(disposition) {
  const described = disposition.classification === EXPECTED_CLASSIFICATIONS[0];
  return {
    decisionScope: described
      ? 'whether_the_exact_current_revision_pinned_category_page_is_the_exact_resolution_of_the_unresolved_rendered_target'
      : 'whether_the_active_redlink_category_api_identity_is_the_exact_resolution_of_the_unresolved_rendered_target',
    evidenceShape: described ? 'exact_current_revision_pinned_described_category_page' : 'active_redlink_category_with_reconciled_revision_pinned_membership',
    reviewReadinessIsNotAResolution: true,
    sourceSilenceIsNotNegativeEvidence: true,
    confirmationDoesNotProve: [...CONFIRMATION_DOES_NOT_PROVE]
  };
}

function fingerprint(disposition, packet, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash = hash) {
  return contentHash({
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: packet.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: packet.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: evidenceSnapshotContentHash,
    renderedTargetKey: disposition.renderedTargetKey,
    requestedTitles: disposition.requestedTitles,
    classification: disposition.classification,
    reviewRoute: disposition.reviewRoute,
    categoryEvidence: categoryEvidence(disposition, packet),
    reviewScope: reviewScope(disposition),
    allowedDecisions: disposition.allowedReviewDecisions
  });
}

function decisionTemplate(queueEntryKey, disposition, evidenceFingerprint, dispositionSnapshotContentHash, policy, contentHash = hash) {
  const base = {
    contract: policy.decisionTemplateContract,
    queueEntryKey,
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: disposition.sourceEvidencePacketKey,
    sourceEvidencePacketRecordContentHash: disposition.sourceEvidencePacketRecordContentHash,
    sourceEvidencePacketSnapshotContentHash: disposition.sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprint,
    renderedTargetKey: disposition.renderedTargetKey,
    requestedTitles: [...disposition.requestedTitles],
    classification: disposition.classification,
    reviewRoute: disposition.reviewRoute,
    allowedDecisions: [...disposition.allowedReviewDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    evidenceKeys: [],
    selectedResolution: null,
    state: 'blank_source_bound_category_target_resolution_review_decision'
  };
  return { ...base, templateContentHash: contentHash(base) };
}

function queueEntry(disposition, packet, ordinal, dispositionSnapshotContentHash, evidenceSnapshotContentHash, policy, contentHash = hash) {
  const queueEntryKey = `${disposition.dispositionKey}|category-target-resolution-review-queue-entry`;
  const evidenceFingerprint = fingerprint(disposition, packet, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash);
  const template = decisionTemplate(queueEntryKey, disposition, evidenceFingerprint, dispositionSnapshotContentHash, policy, contentHash);
  const base = {
    contract: policy.queueContract,
    queueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: packet.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: packet.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: evidenceSnapshotContentHash,
    sourceWorkQueueEntryKey: disposition.sourceWorkQueueEntryKey,
    evidenceFingerprint,
    renderedTargetKey: disposition.renderedTargetKey,
    requestedTitles: [...disposition.requestedTitles],
    classification: disposition.classification,
    reviewRoute: disposition.reviewRoute,
    categoryEvidence: categoryEvidence(disposition, packet),
    reviewScope: reviewScope(disposition),
    allowedDecisions: [...disposition.allowedReviewDecisions],
    decisionTemplate: template,
    resolutionReview: { state: 'unreviewed', decision: null, reviewer: null, reviewedAt: null, reviewNotes: null, evidenceKeys: [] },
    selectedResolution: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([...disposition.blockers, 'explicit_source_bound_category_target_resolution_review_pending']),
    state: policy.queueState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash = hash) {
  const compiled = compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExportPolicy(policy);
  const packetsByKey = new Map(evidencePackets.map(packet => [packet.evidencePacketKey, packet]));
  const duplicatePacketKeys = duplicates(evidencePackets.map(packet => packet.evidencePacketKey));
  const duplicateDispositionKeys = duplicates(dispositionRecords.map(record => record.dispositionKey));
  const packetAssessments = evidencePackets.map(packet => ({ key: packet.evidencePacketKey, integrity: packetIntegrity(packet, policy, contentHash) }));
  const dispositionAssessments = dispositionRecords.map(disposition => ({
    key: disposition.dispositionKey,
    integrity: dispositionIntegrity(disposition, packetsByKey.get(disposition.sourceEvidencePacketKey), policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash)
  }));
  const failures = [];
  if (!compiled.valid) failures.push('category_resolution_review_queue_export_policy_invalid_or_target_specific');
  if (!dispositionRecords.length || dispositionRecords.length !== evidencePackets.length) failures.push('input_disposition_and_evidence_packet_counts_do_not_match');
  if (!validHash(dispositionSnapshotContentHash) || !validHash(evidenceSnapshotContentHash)) failures.push('upstream_snapshot_hash_missing_or_invalid');
  if (duplicatePacketKeys.length || duplicateDispositionKeys.length) failures.push('duplicate_input_keys');
  if (packetAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_source_evidence_packets_failed_revalidation');
  if (dispositionAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_dispositions_failed_revalidation_or_review_ready_route_requirement');
  if (accountStateFindings([...dispositionRecords, ...evidencePackets]).length) failures.push('current_account_state_present');
  const records = failures.length ? [] : dispositionRecords.map((disposition, index) => queueEntry(
    disposition, packetsByKey.get(disposition.sourceEvidencePacketKey), index + 1,
    dispositionSnapshotContentHash, evidenceSnapshotContentHash, policy, contentHash
  ));
  return { compiled, packetAssessments, dispositionAssessments, duplicatePacketKeys, duplicateDispositionKeys, failures, records };
}

function fenced(text) {
  let marker = '```';
  while (String(text).includes(marker)) marker += '`';
  return `${marker}text\n${text}\n${marker}`;
}

export function renderUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueMarkdown(records = []) {
  const lines = [
    '# Unresolved rendered-target category resolution review queue', '',
    'These entries require explicit human review. Category evidence establishes review readiness only; no resolution or semantic game fact is preselected.', ''
  ];
  for (const record of records) {
    const title = record.requestedTitles[0];
    const state = record.categoryEvidence.currentCategoryState;
    lines.push(`## ${record.queueOrdinal}. ${title}`, '');
    lines.push(`- Evidence shape: \`${record.reviewScope.evidenceShape}\``);
    lines.push(`- Review scope: \`${record.reviewScope.decisionScope}\``);
    lines.push(`- Category API state present: \`${state.categoryExistsByApiState}\``);
    lines.push(`- Description page present: \`${state.pageDescriptionExists}\``);
    lines.push(`- Redlink category state: \`${state.redlinkCategoryState}\``);
    lines.push(`- Members: \`${record.categoryEvidence.memberInventory.memberCount}\``);
    lines.push(`- Queue entry: \`${record.queueEntryKey}\``, '');
    if (state.currentPageIdentity) {
      const source = state.currentPageIdentity;
      lines.push('### Exact current category page', '', `- [${source.resolvedTitle}](${source.sourceUrl}), revision \`${source.sourceRevision}\`, page ID \`${source.sourcePageId}\`, source hash \`${source.sourceContentHash}\``, '');
    }
    lines.push('### Revision-pinned category members', '');
    for (const member of record.categoryEvidence.memberInventory.members) {
      const source = member.sourceIdentity;
      lines.push(`- [${member.title}](${source.sourceUrl}), revision \`${source.sourceRevision}\`, page ID \`${source.sourcePageId}\`, source hash \`${source.sourceContentHash}\``);
      for (const occurrence of member.exactCategoryOccurrences) {
        lines.push(`- Exact category occurrence line ${occurrence.line}, hash \`${occurrence.exactSourceTextContentHash}\`:`, '', fenced(occurrence.exactSourceText), '');
      }
    }
    lines.push('### Pinned guide revalidation', '');
    for (const guide of record.categoryEvidence.pinnedGuideRevalidations) {
      const source = guide.sourceIdentity;
      lines.push(`- [${source.resolvedTitle}](${source.sourceUrl}), revision \`${source.sourceRevision}\`, source hash \`${source.sourceContentHash}\``);
      for (const occurrence of guide.exactCategoryOccurrences) lines.push(`- Revalidated occurrence line ${occurrence.line}, hash \`${occurrence.exactSourceTextContentHash}\``);
    }
    lines.push('', '### Allowed decisions', '');
    for (const decision of record.allowedDecisions) lines.push(`- \`${decision}\``);
    lines.push('', 'Decision: _blank_', 'Reviewer: _blank_', 'Reviewed at: _blank_', 'Notes: _blank_', 'Evidence keys: _blank_', 'Selected resolution: _blank_', '');
  }
  return `${lines.join('\n')}\n`;
}

export function serializeUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionTemplates(templates = []) {
  return templates.map(template => JSON.stringify(template)).join('\n') + (templates.length ? '\n' : '');
}

function queuePromotions(records = []) {
  return records.filter(record => record.resolutionReview?.state !== 'unreviewed' || record.resolutionReview?.decision !== null
    || record.resolutionReview?.reviewer !== null || record.resolutionReview?.reviewedAt !== null || record.resolutionReview?.reviewNotes !== null
    || record.resolutionReview?.evidenceKeys?.length || record.selectedResolution !== null || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null || record.repeatabilityClassification !== null || record.mechanicsReviewComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).map(record => record.queueEntryKey || 'unknown');
}

function templatePromotions(templates = []) {
  return templates.filter(template => template.decision !== null || template.reviewer !== null || template.reviewedAt !== null
    || template.reviewNotes !== null || template.evidenceKeys?.length || template.selectedResolution !== null).map(template => template.queueEntryKey || 'unknown');
}

export function auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport(records = [], {
  dispositionRecords = [], evidencePackets = [], policy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '',
  decisionTemplates = [], reviewMarkdown = '', decisionTemplateNdjson = '', contentHash = hash
} = {}) {
  const derived = derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash);
  const expectedKeys = dispositionRecords.map(record => record.dispositionKey);
  const outputKeys = records.map(record => record.sourceDispositionKey);
  const missingOutputKeys = expectedKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !expectedKeys.includes(key));
  const duplicateOutputKeys = duplicates(outputKeys);
  const recordMismatches = records.filter((record, index) => !derived.records[index] || !same(record, derived.records[index], contentHash)).map(record => record.queueEntryKey || 'unknown');
  const expectedTemplates = derived.records.map(record => record.decisionTemplate);
  const templateMismatches = decisionTemplates.filter((template, index) => !expectedTemplates[index] || !same(template, expectedTemplates[index], contentHash)).map(template => template.queueEntryKey || 'unknown');
  const expectedMarkdown = renderUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueMarkdown(records);
  const expectedTemplateNdjson = serializeUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionTemplates(decisionTemplates);
  const promotedQueues = queuePromotions(records);
  const promotedTemplates = templatePromotions(decisionTemplates);
  const accountFindings = accountStateFindings([...dispositionRecords, ...evidencePackets, ...records, ...decisionTemplates]);
  const failures = [...derived.failures];
  if (missingOutputKeys.length || unexpectedOutputKeys.length || duplicateOutputKeys.length || records.length !== dispositionRecords.length) failures.push('input_disposition_and_review_queue_sets_do_not_match_exactly');
  if (recordMismatches.length || templateMismatches.length || decisionTemplates.length !== records.length) failures.push('queue_or_decision_template_does_not_match_evidence_bound_derivation');
  if (reviewMarkdown !== expectedMarkdown || decisionTemplateNdjson !== expectedTemplateNdjson) failures.push('review_artifact_content_mismatch');
  if (promotedQueues.length || promotedTemplates.length) failures.push('queue_export_created_review_resolution_semantic_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const publishable = failures.length === 0;
  const memberOccurrences = evidencePackets.flatMap(packet => (packet.categoryMemberEvidence?.members || []).flatMap(member => member.exactCategoryOccurrences || []));
  const pinnedOccurrences = evidencePackets.flatMap(packet => (packet.pinnedGuideRevalidations || []).flatMap(item => item.exactCategoryOccurrences || []));
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputDispositionCount: dispositionRecords.length,
      inputEvidencePacketCount: evidencePackets.length,
      revalidatedDispositionCount: derived.dispositionAssessments.filter(item => item.integrity.complete).length,
      revalidatedEvidencePacketCount: derived.packetAssessments.filter(item => item.integrity.complete).length,
      duplicateDispositionKeys: derived.duplicateDispositionKeys,
      duplicateEvidencePacketKeys: derived.duplicatePacketKeys,
      dispositionSnapshotContentHash,
      evidenceSnapshotContentHash
    },
    policyCoverage: derived.compiled,
    sourceIntegrityCoverage: {
      revisionPinnedCategoryMemberCount: evidencePackets.reduce((sum, packet) => sum + (packet.categoryMemberEvidence?.members || []).length, 0),
      exactCategoryMemberOccurrenceCount: memberOccurrences.length,
      pinnedGuideRevalidationCount: evidencePackets.reduce((sum, packet) => sum + (packet.pinnedGuideRevalidations || []).length, 0),
      pinnedGuideExactOccurrenceCount: pinnedOccurrences.length,
      namespaceSearchQueryCount: evidencePackets.reduce((sum, packet) => sum + (packet.namespaceSearchEvidence?.queries || []).length, 0),
      titleHistoryEventCount: evidencePackets.reduce((sum, packet) => sum + Number(packet.titleHistoryEvidence?.eventCount || 0), 0),
      failedEvidencePacketIntegrity: derived.packetAssessments.filter(item => !item.integrity.complete).map(item => ({ key: item.key, failedChecks: Object.entries(item.integrity.checks).filter(([, passed]) => !passed).map(([check]) => check) })),
      failedDispositionIntegrity: derived.dispositionAssessments.filter(item => !item.integrity.complete).map(item => ({ key: item.key, failedChecks: Object.entries(item.integrity.checks).filter(([, passed]) => !passed).map(([check]) => check) }))
    },
    queueCoverage: {
      reviewQueueEntryCount: records.length,
      describedCategoryPageReviewEntryCount: records.filter(record => record.classification === EXPECTED_CLASSIFICATIONS[0]).length,
      activeRedlinkCategoryReviewEntryCount: records.filter(record => record.classification === EXPECTED_CLASSIFICATIONS[1]).length,
      blankDecisionTemplateCount: decisionTemplates.length - promotedTemplates.length,
      missingOutputKeys,
      unexpectedOutputKeys,
      duplicateOutputKeys,
      recordMismatches,
      templateMismatches
    },
    artifactCoverage: {
      markdownMatches: reviewMarkdown === expectedMarkdown,
      decisionTemplateNdjsonMatches: decisionTemplateNdjson === expectedTemplateNdjson,
      reviewMarkdownContentHash: contentHash(reviewMarkdown),
      decisionTemplateNdjsonContentHash: contentHash(decisionTemplateNdjson),
      reviewMarkdownBytes: new TextEncoder().encode(reviewMarkdown).length,
      decisionTemplateNdjsonBytes: new TextEncoder().encode(decisionTemplateNdjson).length
    },
    semanticPreservationCoverage: {
      recordedReviewCount: records.filter(record => record.resolutionReview?.state !== 'unreviewed').length + decisionTemplates.filter(template => template.decision !== null).length,
      selectedResolutionCount: records.filter(record => record.selectedResolution !== null).length + decisionTemplates.filter(template => template.selectedResolution !== null).length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(record => record.repeatabilityClassification !== null).length,
      mechanicsReviewCompleteCount: records.filter(record => record.mechanicsReviewComplete === true).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied === true).length,
      unsupportedQueuePromotions: promotedQueues,
      nonBlankDecisionTemplates: promotedTemplates
    },
    accountStateFindings: accountFindings,
    queueExportComplete: publishable,
    categoryResolutionReviewComplete: false,
    resolutionApplicationComplete: false,
    canonicalIdentityComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(records.length ? ['explicit_source_bound_category_target_resolution_reviews_pending'] : []),
      'category_target_resolutions_not_applied',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport({
  dispositionRecords = [], evidencePackets = [], policy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '', contentHash = hash
} = {}) {
  const derived = derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash);
  const records = derived.failures.length ? [] : derived.records;
  const decisionTemplates = records.map(record => record.decisionTemplate);
  const reviewMarkdown = renderUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueMarkdown(records);
  const decisionTemplateNdjson = serializeUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionTemplates(decisionTemplates);
  const audit = auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport(records, {
    dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
    decisionTemplates, reviewMarkdown, decisionTemplateNdjson, contentHash
  });
  return { records, decisionTemplates, reviewMarkdown, decisionTemplateNdjson, audit };
}
