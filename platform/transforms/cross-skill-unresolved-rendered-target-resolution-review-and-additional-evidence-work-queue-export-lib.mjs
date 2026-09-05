import { hash } from '../ingestion/lib.mjs';
import {
  auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions,
  findUnresolvedRenderedTargetResolutionSufficiencyAccountState
} from './cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-lib.mjs';

const REQUIRED_RULES = [
  'everyDispositionMustEnterExactlyOneOfTwoDisjointQueues',
  'queueOrderMustPreserveDispositionOrderWithinEachRoute',
  'dispositionEvidenceAndBothSnapshotHashesMustRevalidate',
  'everyQueueEntryMustRetainAllRevisionPinnedResolutionEvidence',
  'reviewQueueRequiresCurrentOrCandidateEvidence',
  'reviewDecisionTemplatesMustStartBlank',
  'additionalEvidenceQueueMustStartWithoutNewEvidence',
  'queueExportCannotSelectAResolutionOrIdentity',
  'confirmationCannotProveActivityIdentityRepeatabilityMechanicsOrOptimizerEligibility',
  'titlesPageIdsRevisionsCandidateNamesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DECISIONS = [
  'confirm_exact_current_resolution',
  'confirm_revision_pinned_candidate_resolution',
  'reject_all_presented_resolution_candidates',
  'needs_additional_evidence'
];
const EXPECTED_CHANNELS = [
  'independent_revision_pinned_official_wiki_source_discovery',
  'exact_title_redirect_move_and_deletion_history',
  'pinned_guide_context_resolution'
];
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => (left === undefined || right === undefined) ? left === right : contentHash(left) === contentHash(right);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:titleOverrides|pageIdOverrides|revisionOverrides|candidateNameOverrides|candidateKeyOverrides|overrides|exceptions)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  visit(policy);
  return unique(findings).sort();
}

export function compileUnresolvedRenderedTargetResolutionQueueExportPolicy(policy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queue-export-policy.v1' &&
    policy.inputDispositionContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition.v1' &&
    policy.inputEvidenceContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-evidence.v1' &&
    policy.reviewQueueContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-queue-entry.v1' &&
    policy.decisionTemplateContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-decision-template.v1' &&
    policy.additionalEvidenceQueueContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-additional-evidence-work-queue-entry.v1' &&
    policy.auditContract === 'sensum.cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queue-export-audit.v1';
  const routesValid = policy.reviewReadyRoute === 'explicit_source_bound_resolution_review' &&
    policy.additionalEvidenceRoute === 'additional_source_bound_resolution_evidence' && policy.reviewReadyRoute !== policy.additionalEvidenceRoute;
  const decisionsValid = same(policy.allowedDecisions || [], EXPECTED_DECISIONS, contentHash);
  const channelsValid = same(policy.additionalEvidenceChannels || [], EXPECTED_CHANNELS, contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && routesValid && decisionsValid && channelsValid && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid,
    routesValid,
    decisionsValid,
    channelsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function blankReview() {
  return { decision: null, selectedPageId: null, selectedTitle: null, evidenceKeys: [], reviewer: null, reviewedAt: null, reviewNotes: null };
}

function retainedResolutionEvidence(evidence = {}) {
  return {
    guideObservations: evidence.guideObservations || [],
    pinnedGuideEvidence: evidence.pinnedGuideEvidence || [],
    currentTitleResolutionEvidence: evidence.currentTitleResolutionEvidence || [],
    titleLogEvidence: evidence.titleLogEvidence || [],
    discoveryEvidence: evidence.discoveryEvidence || []
  };
}

function allowedReviewDecisions(disposition, policy) {
  const decisions = [];
  if (disposition.currentResolvedTitleCount > 0) decisions.push(policy.allowedDecisions[0]);
  if (disposition.revisionPinnedCandidateCount > 0) decisions.push(policy.allowedDecisions[1], policy.allowedDecisions[2]);
  decisions.push(policy.allowedDecisions[3]);
  return unique(decisions);
}

function expectedReviewEntry(disposition, evidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash) {
  return {
    contract: policy.reviewQueueContract,
    queueEntryKey: `${disposition.dispositionKey}|resolution-review-queue`,
    queueOrdinal: 0,
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.contentHash,
    sourceEvidenceRecordContentHash: evidence.contentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidenceSnapshotContentHash: evidenceSnapshotContentHash,
    evidenceFingerprint: disposition.evidenceFingerprint,
    renderedTargetKey: disposition.renderedTargetKey,
    requestedTitles: evidence.requestedTitles,
    resolutionEvidence: retainedResolutionEvidence(evidence),
    allowedDecisions: allowedReviewDecisions(disposition, policy),
    decisionTemplate: blankReview(),
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    state: 'pending_explicit_source_bound_resolution_review'
  };
}

function expectedAdditionalEvidenceEntry(disposition, evidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash) {
  return {
    contract: policy.additionalEvidenceQueueContract,
    workQueueEntryKey: `${disposition.dispositionKey}|additional-resolution-evidence-work`,
    queueOrdinal: 0,
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.contentHash,
    sourceEvidenceRecordContentHash: evidence.contentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidenceSnapshotContentHash: evidenceSnapshotContentHash,
    evidenceFingerprint: disposition.evidenceFingerprint,
    renderedTargetKey: disposition.renderedTargetKey,
    requestedTitles: evidence.requestedTitles,
    resolutionEvidence: retainedResolutionEvidence(evidence),
    insufficiencyDisposition: disposition.evidenceSufficiencyDisposition,
    requiredAdditionalEvidenceChannels: policy.additionalEvidenceChannels,
    newEvidenceKeys: [],
    resolutionReview: blankReview(),
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    state: 'blocked_pending_additional_source_bound_resolution_evidence'
  };
}

function expectedDecisionTemplate(record, policy, contentHash = hash) {
  return {
    contract: policy.decisionTemplateContract,
    queueEntryKey: record.queueEntryKey,
    queueEntryContentHash: contentHash(record),
    sourceDispositionKey: record.sourceDispositionKey,
    sourceDispositionRecordContentHash: record.sourceDispositionRecordContentHash,
    sourceEvidenceRecordContentHash: record.sourceEvidenceRecordContentHash,
    sourceDispositionSnapshotContentHash: record.sourceDispositionSnapshotContentHash,
    sourceEvidenceSnapshotContentHash: record.sourceEvidenceSnapshotContentHash,
    evidenceFingerprint: record.evidenceFingerprint,
    allowedDecisions: record.allowedDecisions,
    ...blankReview(),
    state: 'blank_explicit_human_resolution_review_template'
  };
}

function dispositionHashValid(record, contentHash = hash) {
  return validHash(record?.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash;
}

function evidenceBindingsValid(disposition, evidence, dispositionSnapshotContentHash, evidenceSnapshotContentHash) {
  return disposition?.resolutionEvidenceKey === evidence?.resolutionEvidenceKey &&
    disposition?.sourceEvidenceRecordContentHash === evidence?.contentHash &&
    disposition?.sourceEvidenceSnapshotContentHash === evidenceSnapshotContentHash &&
    validHash(dispositionSnapshotContentHash) && validHash(evidenceSnapshotContentHash);
}

function blankTemplate(template = {}) {
  return template.decision === null && template.selectedPageId === null && template.selectedTitle === null &&
    Array.isArray(template.evidenceKeys) && template.evidenceKeys.length === 0 && template.reviewer === null &&
    template.reviewedAt === null && template.reviewNotes === null && template.state === 'blank_explicit_human_resolution_review_template';
}

function reviewEntryClosed(record = {}) {
  return Object.values(record.decisionTemplate || {}).filter(value => value !== null && !(Array.isArray(value) && value.length === 0)).length === 0 &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null && record.repeatabilityClassification === null &&
    record.optimizerEligible === false && record.accountIndependent === true;
}

function additionalEntryClosed(record = {}) {
  const review = record.resolutionReview || {};
  return review.decision === null && review.selectedPageId === null && review.selectedTitle === null && Array.isArray(review.evidenceKeys) && review.evidenceKeys.length === 0 &&
    review.reviewer === null && review.reviewedAt === null && review.reviewNotes === null && Array.isArray(record.newEvidenceKeys) && record.newEvidenceKeys.length === 0 &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null && record.repeatabilityClassification === null &&
    record.optimizerEligible === false && record.accountIndependent === true;
}

function titleLines(record) {
  return (record.requestedTitles || []).map(title => `- Requested title: \`${title}\``);
}

function evidenceLines(record) {
  const evidence = record.resolutionEvidence || {};
  const lines = [];
  for (const row of evidence.currentTitleResolutionEvidence || []) {
    if (row.currentPageEvidence) lines.push(`- Current exact page: ${row.currentPageEvidence.resolvedTitle} — page ${row.currentPageEvidence.sourcePageId}, revision ${row.currentPageEvidence.sourceRevision}`);
    else lines.push(`- Current exact page: missing (${row.requestedTitle})`);
  }
  for (const row of evidence.discoveryEvidence || []) for (const candidate of row.candidates || []) {
    const identity = candidate.sourcePageIdentity || {};
    lines.push(`- Candidate #${candidate.searchRank}: ${identity.resolvedTitle} — page ${identity.sourcePageId}, revision ${identity.sourceRevision}, ${identity.sourceUrl}`);
  }
  for (const row of evidence.pinnedGuideEvidence || []) for (const occurrence of row.exactSourceOccurrences || []) {
    lines.push(`- Guide occurrence: ${row.guideTitle} revision ${row.guideRevision}, line ${occurrence.sourceLocator?.line ?? 'unknown'} — ${occurrence.sourceLocator?.excerpt || occurrence.sourceTarget}`);
  }
  for (const row of evidence.titleLogEvidence || []) lines.push(`- Exact-title log events retained: ${row.eventCount}`);
  return lines;
}

export function renderUnresolvedRenderedTargetResolutionReviewQueueMarkdown(records = []) {
  const lines = ['# Unresolved rendered-target resolution review queue', '', 'This artifact presents revision-pinned evidence for explicit human review. It selects no page or identity.', ''];
  for (const record of records) {
    lines.push(`## ${record.queueOrdinal}. ${record.renderedTargetKey}`, '', ...titleLines(record), ...evidenceLines(record), '', `Allowed decisions: ${record.allowedDecisions.join(', ')}`, '', 'Selected resolution: none', '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function renderUnresolvedRenderedTargetAdditionalEvidenceQueueMarkdown(records = []) {
  const lines = ['# Unresolved rendered-target additional-evidence work queue', '', 'These targets lack sufficient source-bound evidence for resolution review. No page or identity is selected.', ''];
  for (const record of records) {
    lines.push(`## ${record.queueOrdinal}. ${record.renderedTargetKey}`, '', ...titleLines(record), ...evidenceLines(record), '', `Insufficiency: ${record.insufficiencyDisposition}`, '', 'Required evidence channels:');
    for (const channel of record.requiredAdditionalEvidenceChannels || []) lines.push(`- ${channel}`);
    lines.push('', 'New evidence recorded: none', '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function serializeUnresolvedRenderedTargetResolutionDecisionTemplates(templates = []) {
  return templates.map(template => JSON.stringify(template)).join('\n') + (templates.length ? '\n' : '');
}

export function buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport({
  dispositionRecords = [], evidenceRecords = [], policy = {}, sufficiencyPolicy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '', contentHash = hash
} = {}) {
  const compiled = compileUnresolvedRenderedTargetResolutionQueueExportPolicy(policy, contentHash);
  const evidenceByKey = new Map(evidenceRecords.map(row => [row.resolutionEvidenceKey, row]));
  const upstream = auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(dispositionRecords, {
    evidenceRecords, inputSnapshotContentHash: evidenceSnapshotContentHash, policy: sufficiencyPolicy, contentHash
  });
  const inputsValid = compiled.valid && upstream.publishable === true && validHash(dispositionSnapshotContentHash) && validHash(evidenceSnapshotContentHash) &&
    dispositionRecords.length > 0 && dispositionRecords.length === evidenceRecords.length &&
    !duplicates(dispositionRecords.map(row => row.dispositionKey)).length && !duplicates(evidenceRecords.map(row => row.resolutionEvidenceKey)).length &&
    dispositionRecords.every(row => dispositionHashValid(row, contentHash) && evidenceBindingsValid(row, evidenceByKey.get(row.resolutionEvidenceKey), dispositionSnapshotContentHash, evidenceSnapshotContentHash));
  const reviewRecords = [];
  const additionalEvidenceRecords = [];
  if (inputsValid) for (const disposition of dispositionRecords) {
    const evidence = evidenceByKey.get(disposition.resolutionEvidenceKey);
    if (disposition.reviewRoute === policy.reviewReadyRoute) reviewRecords.push(expectedReviewEntry(disposition, evidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash));
    else if (disposition.reviewRoute === policy.additionalEvidenceRoute) additionalEvidenceRecords.push(expectedAdditionalEvidenceEntry(disposition, evidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash));
  }
  reviewRecords.forEach((record, index) => { record.queueOrdinal = index + 1; });
  additionalEvidenceRecords.forEach((record, index) => { record.queueOrdinal = index + 1; });
  const decisionTemplates = reviewRecords.map(record => expectedDecisionTemplate(record, policy, contentHash));
  const reviewMarkdown = renderUnresolvedRenderedTargetResolutionReviewQueueMarkdown(reviewRecords);
  const additionalEvidenceMarkdown = renderUnresolvedRenderedTargetAdditionalEvidenceQueueMarkdown(additionalEvidenceRecords);
  const decisionTemplateNdjson = serializeUnresolvedRenderedTargetResolutionDecisionTemplates(decisionTemplates);
  const audit = auditUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(reviewRecords, {
    dispositionRecords, evidenceRecords, policy, sufficiencyPolicy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
    additionalEvidenceRecords, decisionTemplates, reviewMarkdown, additionalEvidenceMarkdown, decisionTemplateNdjson, contentHash
  });
  return { reviewRecords, additionalEvidenceRecords, decisionTemplates, reviewMarkdown, additionalEvidenceMarkdown, decisionTemplateNdjson, audit };
}

export function auditUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport(reviewRecords = [], {
  dispositionRecords = [], evidenceRecords = [], policy = {}, sufficiencyPolicy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '',
  additionalEvidenceRecords = [], decisionTemplates = [], reviewMarkdown = '', additionalEvidenceMarkdown = '', decisionTemplateNdjson = '', contentHash = hash
} = {}) {
  const compiled = compileUnresolvedRenderedTargetResolutionQueueExportPolicy(policy, contentHash);
  const evidenceByKey = new Map(evidenceRecords.map(row => [row.resolutionEvidenceKey, row]));
  const upstream = auditUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions(dispositionRecords, {
    evidenceRecords, inputSnapshotContentHash: evidenceSnapshotContentHash, policy: sufficiencyPolicy, contentHash
  });
  const invalidDispositionKeys = dispositionRecords.filter(row => !dispositionHashValid(row, contentHash) || !evidenceBindingsValid(row, evidenceByKey.get(row.resolutionEvidenceKey), dispositionSnapshotContentHash, evidenceSnapshotContentHash)).map(row => row.dispositionKey);
  const expectedReview = [];
  const expectedAdditional = [];
  if (compiled.valid && upstream.publishable === true && validHash(dispositionSnapshotContentHash) && validHash(evidenceSnapshotContentHash)) for (const disposition of dispositionRecords) {
    const evidence = evidenceByKey.get(disposition.resolutionEvidenceKey);
    if (!evidence) continue;
    if (disposition.reviewRoute === policy.reviewReadyRoute) expectedReview.push(expectedReviewEntry(disposition, evidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash));
    else if (disposition.reviewRoute === policy.additionalEvidenceRoute) expectedAdditional.push(expectedAdditionalEvidenceEntry(disposition, evidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash));
  }
  expectedReview.forEach((record, index) => { record.queueOrdinal = index + 1; });
  expectedAdditional.forEach((record, index) => { record.queueOrdinal = index + 1; });
  const expectedReviewByKey = new Map(expectedReview.map(row => [row.sourceDispositionKey, row]));
  const expectedAdditionalByKey = new Map(expectedAdditional.map(row => [row.sourceDispositionKey, row]));
  const reviewMismatches = reviewRecords.filter(row => !same(row, expectedReviewByKey.get(row.sourceDispositionKey), contentHash)).map(row => row.sourceDispositionKey);
  const additionalMismatches = additionalEvidenceRecords.filter(row => !same(row, expectedAdditionalByKey.get(row.sourceDispositionKey), contentHash)).map(row => row.sourceDispositionKey);
  const reviewKeys = reviewRecords.map(row => row.sourceDispositionKey);
  const additionalKeys = additionalEvidenceRecords.map(row => row.sourceDispositionKey);
  const inputKeys = dispositionRecords.map(row => row.dispositionKey);
  const queueKeys = [...reviewKeys, ...additionalKeys];
  const expectedTemplates = reviewRecords.map(row => expectedDecisionTemplate(row, policy, contentHash));
  const templateMismatches = decisionTemplates.map((row, index) => !same(row, expectedTemplates[index], contentHash) ? row.queueEntryKey || `template-${index}` : null).filter(Boolean);
  if (decisionTemplates.length !== expectedTemplates.length) templateMismatches.push('decision_template_count_mismatch');
  const reviewOrderMatches = same(reviewKeys, dispositionRecords.filter(row => row.reviewRoute === policy.reviewReadyRoute).map(row => row.dispositionKey), contentHash);
  const additionalOrderMatches = same(additionalKeys, dispositionRecords.filter(row => row.reviewRoute === policy.additionalEvidenceRoute).map(row => row.dispositionKey), contentHash);
  const artifactsMatch = reviewMarkdown === renderUnresolvedRenderedTargetResolutionReviewQueueMarkdown(reviewRecords) &&
    additionalEvidenceMarkdown === renderUnresolvedRenderedTargetAdditionalEvidenceQueueMarkdown(additionalEvidenceRecords) &&
    decisionTemplateNdjson === serializeUnresolvedRenderedTargetResolutionDecisionTemplates(decisionTemplates);
  const promotedReviewKeys = reviewRecords.filter(row => !reviewEntryClosed(row)).map(row => row.sourceDispositionKey);
  const promotedAdditionalKeys = additionalEvidenceRecords.filter(row => !additionalEntryClosed(row)).map(row => row.sourceDispositionKey);
  const decidedTemplateKeys = decisionTemplates.filter(row => !blankTemplate(row)).map(row => row.queueEntryKey);
  const allQueueRecords = [...reviewRecords, ...additionalEvidenceRecords];
  const recordedReviewCount = reviewRecords.filter(row => row.decisionTemplate?.decision !== null).length + additionalEvidenceRecords.filter(row => row.resolutionReview?.decision !== null).length;
  const selectedResolutionCount = reviewRecords.filter(row => row.decisionTemplate?.selectedPageId !== null || row.decisionTemplate?.selectedTitle !== null).length +
    additionalEvidenceRecords.filter(row => row.resolutionReview?.selectedPageId !== null || row.resolutionReview?.selectedTitle !== null).length;
  const accountStateFindings = findUnresolvedRenderedTargetResolutionSufficiencyAccountState([...reviewRecords, ...additionalEvidenceRecords, ...decisionTemplates]);
  const blockers = [];
  if (!compiled.valid) blockers.push('resolution_queue_export_policy_invalid_or_specific');
  if (!validHash(dispositionSnapshotContentHash) || !validHash(evidenceSnapshotContentHash)) blockers.push('one_or_more_upstream_snapshot_hashes_missing_or_invalid');
  if (upstream.publishable !== true || invalidDispositionKeys.length) blockers.push('one_or_more_upstream_dispositions_or_evidence_bindings_failed_revalidation');
  if (duplicates(inputKeys).length || duplicates(queueKeys).length || !same(sorted(inputKeys), sorted(queueKeys), contentHash)) blockers.push('queue_partition_not_exact_complete_and_disjoint');
  if (!reviewOrderMatches || !additionalOrderMatches) blockers.push('queue_order_does_not_preserve_source_disposition_order');
  if (reviewMismatches.length || additionalMismatches.length) blockers.push('one_or_more_queue_entries_do_not_match_bound_source_evidence');
  if (templateMismatches.length || !artifactsMatch) blockers.push('one_or_more_queue_artifacts_or_blank_templates_do_not_match');
  if (promotedReviewKeys.length || promotedAdditionalKeys.length || decidedTemplateKeys.length) blockers.push('queue_export_created_resolution_review_identity_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  const queueExportComplete = inputKeys.length > 0 && blockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      dispositionRecordCount: dispositionRecords.length,
      evidenceRecordCount: evidenceRecords.length,
      revalidatedDispositionAndEvidenceCount: dispositionRecords.length - invalidDispositionKeys.length,
      invalidDispositionKeys,
      upstreamDispositionAuditPublishable: upstream.publishable === true
    },
    policyCoverage: compiled,
    bindingCoverage: {
      exactDispositionSnapshotBindingCount: queueKeys.filter(key => dispositionRecords.find(row => row.dispositionKey === key)?.contentHash).length,
      exactEvidenceSnapshotBindingCount: [...reviewRecords, ...additionalEvidenceRecords].filter(row => row.sourceEvidenceSnapshotContentHash === evidenceSnapshotContentHash).length,
      retainedPinnedGuideEvidenceCount: [...reviewRecords, ...additionalEvidenceRecords].reduce((sum, row) => sum + (row.resolutionEvidence?.pinnedGuideEvidence?.length || 0), 0),
      retainedCurrentTitleResolutionEvidenceCount: [...reviewRecords, ...additionalEvidenceRecords].reduce((sum, row) => sum + (row.resolutionEvidence?.currentTitleResolutionEvidence?.length || 0), 0),
      retainedDiscoveryCandidateCount: [...reviewRecords, ...additionalEvidenceRecords].reduce((sum, row) => sum + (row.resolutionEvidence?.discoveryEvidence || []).reduce((inner, evidence) => inner + (evidence.candidates?.length || 0), 0), 0),
      retainedTitleLogEvidenceCount: [...reviewRecords, ...additionalEvidenceRecords].reduce((sum, row) => sum + (row.resolutionEvidence?.titleLogEvidence?.length || 0), 0)
    },
    queuePartitionCoverage: {
      reviewQueueEntryCount: reviewRecords.length,
      additionalEvidenceQueueEntryCount: additionalEvidenceRecords.length,
      blankDecisionTemplateCount: decisionTemplates.length,
      blankAdditionalEvidenceWorkCount: additionalEvidenceRecords.filter(row => row.newEvidenceKeys?.length === 0).length,
      duplicateQueueDispositionKeys: duplicates(queueKeys),
      missingQueueDispositionKeys: inputKeys.filter(key => !queueKeys.includes(key)),
      unexpectedQueueDispositionKeys: queueKeys.filter(key => !inputKeys.includes(key)),
      crossQueueDispositionKeys: reviewKeys.filter(key => additionalKeys.includes(key)),
      reviewOrderMatches,
      additionalEvidenceOrderMatches: additionalOrderMatches,
      reviewRecordMismatchKeys: reviewMismatches,
      additionalEvidenceRecordMismatchKeys: additionalMismatches
    },
    artifactCoverage: {
      reviewMarkdownMatchesQueue: reviewMarkdown === renderUnresolvedRenderedTargetResolutionReviewQueueMarkdown(reviewRecords),
      additionalEvidenceMarkdownMatchesQueue: additionalEvidenceMarkdown === renderUnresolvedRenderedTargetAdditionalEvidenceQueueMarkdown(additionalEvidenceRecords),
      decisionTemplateNdjsonMatchesTemplates: decisionTemplateNdjson === serializeUnresolvedRenderedTargetResolutionDecisionTemplates(decisionTemplates),
      decisionTemplateMismatchKeys: unique(templateMismatches),
      reviewMarkdownBytes: Buffer.byteLength(reviewMarkdown, 'utf8'),
      additionalEvidenceMarkdownBytes: Buffer.byteLength(additionalEvidenceMarkdown, 'utf8'),
      decisionTemplateNdjsonBytes: Buffer.byteLength(decisionTemplateNdjson, 'utf8')
    },
    semanticPreservationCoverage: {
      recordedReviewCount,
      selectedResolutionCount,
      canonicalGameEntityIdentityCount: allQueueRecords.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: allQueueRecords.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: allQueueRecords.filter(row => row.repeatabilityClassification !== null).length,
      optimizerEligibleCount: allQueueRecords.filter(row => row.optimizerEligible === true).length,
      decidedTemplateCount: decidedTemplateKeys.length,
      promotedReviewKeys,
      promotedAdditionalEvidenceKeys: promotedAdditionalKeys
    },
    accountStateFindings,
    queueExportComplete,
    resolutionReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers,
      'explicit_source_bound_resolution_reviews_pending',
      'additional_source_bound_resolution_evidence_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: queueExportComplete
  };
}
