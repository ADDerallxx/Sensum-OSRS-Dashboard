import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import { compileHistoricalAttributionWorkQueuePolicy } from './cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-lib.mjs';

const DECISIONS = [
  'confirm_complete_historical_dependency_attribution',
  'reject_proposed_historical_dependency_attribution',
  'historical_dependency_evidence_unavailable'
];
const OUTCOMES = ['confirmed_historical_generating_dependency', 'rejected_historical_generating_dependency'];
const DEPENDENCY_KINDS = ['template', 'module', 'transcluded_page'];
const LOCATOR_KINDS = ['wikitext_line_range', 'template_parameter', 'module_execution_path', 'transclusion_path'];
const ROUTES = {
  confirm_complete_historical_dependency_attribution: 'confirmed_historical_attribution_pending_separate_application',
  reject_proposed_historical_dependency_attribution: 'rejected_historical_attribution_pending_additional_evidence',
  historical_dependency_evidence_unavailable: 'historical_dependency_evidence_unavailable_requires_additional_discovery'
};
const ATTRIBUTION_FIELDS = [
  'observationKey', 'observationContentHash', 'attributionOutcome', 'dependencyKind',
  'dependencyPageId', 'dependencyNamespaceId', 'dependencyTitle', 'dependencyRevision',
  'dependencyTimestamp', 'dependencyContentHash', 'exactDependencyRevisionUrl',
  'generativeSourceLocator', 'evidenceKeys'
];
const LOCATOR_FIELDS = ['kind', 'value'];
const REQUIRED_RULES = [
  'oneRecordedDecisionPerCompletedSubmission', 'partialReviewBatchesAreAllowed', 'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected', 'anyInvalidRowRejectsTheEntireBatch',
  'queueManifestPolicySnapshotOuterIntrinsicSourceObservationAndBindingHashesMustRevalidate',
  'submissionMustMatchEveryImmutableBlankTemplateBinding', 'submissionFieldSetMustExactlyMatchTheBlankTemplate',
  'decisionMustBeExplicitlyAllowed', 'reviewerReviewedAtMeaningfulNotesAndBoundEvidenceKeysAreRequired',
  'reviewedAtMustNotPrecedeTheQueueSnapshotOrLatestBoundObservation',
  'confirmedDispositionMustAttributeEveryObservationExactlyOnce',
  'confirmedAttributionMustBindExactHistoricalGuideAndDependencyRevisionsContentHashesAndGenerativeLocator',
  'rejectedDispositionMustIdentifyAtLeastOneRejectedProposedAttribution',
  'evidenceUnavailableDispositionMustContainNoProposedAttributionAndCiteEveryObservation',
  'allDependencyRevisionUrlsMustBeExactOfficialWikiRevisionUrls', 'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingADecisionDoesNotApplyAttributionRequirementUnlockSemanticIdentityRepeatabilityMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsDependencyKindsParserChannelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
const exactRevisionUrl = revision => `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}`;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:titleOverrides|pageIdOverrides|revisionOverrides|dependencyKindOverrides|parserChannelOverrides|aliasOverrides|targetOverrides|exceptions|overrides)$/i;
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
  return sorted(unique(findings));
}

export function compileHistoricalAttributionReviewDecisionImportPolicy(policy = {}, queuePolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-policy.v1' &&
    policy.queueContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-entry.v1' &&
    policy.submissionContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-decision-template.v1' &&
    policy.recordContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-review-decision-import-audit.v1' &&
    policy.inputQueuePolicy === queuePolicy.policy && policy.inputQueuePolicyContentHash === contentHash(queuePolicy) &&
    policy.queueState === 'blocked_pending_historical_rendered_expansion_dependency_attribution' &&
    policy.recordState === 'recorded_historical_attribution_review_decision_pending_application';
  const queuePolicyCoverage = compileHistoricalAttributionWorkQueuePolicy(queuePolicy, contentHash);
  const vocabularyValid = same(policy.allowedDecisions || [], DECISIONS, contentHash) &&
    same(policy.allowedDecisions || [], queuePolicy.allowedReviewDispositions || [], contentHash) &&
    same(policy.allowedAttributionOutcomes || [], OUTCOMES, contentHash) &&
    same(policy.allowedDependencyKinds || [], DEPENDENCY_KINDS, contentHash) &&
    same(policy.allowedLocatorKinds || [], LOCATOR_KINDS, contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && queuePolicyCoverage.valid && vocabularyValid && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid, queuePolicyCoverage, vocabularyValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden
  };
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const normalized = value.includes('.')
    ? value.replace(/\.(\d{1,3})Z$/, (_, digits) => `.${digits.padEnd(3, '0')}Z`)
    : value.replace(/Z$/, '.000Z');
  return new Date(parsed).toISOString() === normalized;
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|ai)$/.test(value) ||
    /\b(?:bot|automated reviewer|language model|ai reviewer|codex|chatgpt|openai|sensum|gpt(?:[- ]?\d[^ ]*)?)\b/.test(value);
}

function observationValid(row = {}, renderedTargetKey = '', contentHash = hash) {
  const observation = row.observation || {};
  return validHash(row.observationKey) && row.observationKey === contentHash({ renderedTargetKey, observation }) &&
    validHash(row.observationContentHash) && row.observationContentHash === contentHash(observation) &&
    /^\d+$/.test(String(observation.guideRevision || '')) && row.exactGuideRevisionUrl === exactRevisionUrl(observation.guideRevision) &&
    Number.isInteger(observation.guidePageId) && observation.guidePageId > 0 && validHash(observation.guideContentHash) &&
    typeof observation.guideTitle === 'string' && observation.guideTitle.length > 0 && Number.isInteger(observation.namespaceId) &&
    ['links', 'categories', 'images'].includes(observation.parserChannel) && validIsoTimestamp(observation.parserObservedAt) &&
    typeof observation.requestedTitle === 'string' && observation.requestedTitle.length > 0 &&
    observation.resolutionState === 'current_revision_pinned_page' && observation.sourcePresence === 'rendered_only_origin_unattributed';
}

function guideBindingsValid(record = {}, observationKeys = [], contentHash = hash) {
  const bindings = record.historicalGuideRevisionBindings || [];
  if (record.historicalGuideRevisionBindingCount !== bindings.length || record.historicalGuideRevisionBindingsContentHash !== contentHash(bindings)) return false;
  const boundKeys = [];
  for (const binding of bindings) {
    const base = without(binding, 'bindingContentHash', 'observationCount');
    if (!validHash(binding.bindingContentHash) || binding.bindingContentHash !== contentHash(base) ||
        !Number.isInteger(binding.guidePageId) || binding.guidePageId <= 0 || !/^\d+$/.test(String(binding.guideRevision || '')) ||
        !validHash(binding.guideContentHash) || binding.exactGuideRevisionUrl !== exactRevisionUrl(binding.guideRevision) ||
        binding.observationCount !== binding.observationKeys?.length || !binding.observationKeys?.every(validHash)) return false;
    boundKeys.push(...binding.observationKeys);
  }
  return duplicates(boundKeys).length === 0 && same(sorted(boundKeys), sorted(observationKeys), contentHash);
}

export function expectedHistoricalAttributionBlankDecision(queue = {}, policy = {}) {
  return {
    contract: policy.submissionContract,
    historicalAttributionWorkEntryKey: queue.historicalAttributionWorkEntryKey,
    renderedTargetKey: queue.renderedTargetKey,
    sourceWorkQueueRecordContentHash: queue.sourceWorkQueueRecordContentHash,
    sourceCandidateContentHash: queue.sourceCandidateContentHash,
    historicalRenderedObservationSetContentHash: queue.historicalRenderedObservationSetContentHash,
    disposition: null,
    observationAttributions: [],
    evidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    notes: null
  };
}

function queueRecordIntegrity(record = {}, { policy = {}, queuePolicy = {}, queueSnapshotContentHash = '', contentHash = hash } = {}) {
  const observations = record.historicalRenderedObservations || [];
  const observationKeys = observations.map(row => row.observationKey);
  const expectedTemplate = expectedHistoricalAttributionBlankDecision(record, policy);
  const checks = {
    contractMatches: record.contract === policy.queueContract,
    stateMatches: record.state === policy.queueState,
    outerHashMatches: validHash(record.contentHash) && record.contentHash === contentHash(without(record, 'contentHash')),
    intrinsicHashMatches: validHash(record.recordContentHash) && record.recordContentHash === contentHash(without(record, 'contentHash', 'recordContentHash')),
    stableKeyMatches: typeof record.historicalAttributionWorkEntryKey === 'string' &&
      record.historicalAttributionWorkEntryKey === `${record.sourceWorkQueueEntryKey}|historical-rendered-attribution-work`,
    snapshotAndRecordHashesPresent: [queueSnapshotContentHash, record.sourceWorkQueueRecordContentHash,
      record.sourceWorkQueueIntrinsicRecordContentHash, record.sourceWorkQueueSnapshotContentHash,
      record.sourcePartitionSnapshotContentHash, record.sourceCandidateContentHash,
      record.sourceCandidateSnapshotContentHash, record.historicalRenderedObservationSetContentHash,
      record.historicalGuideRevisionBindingsContentHash].every(validHash),
    queueSnapshotContentHashValid: validHash(queueSnapshotContentHash),
    targetIdentityComplete: Number.isInteger(record.stableWikiPageIdentity?.sourcePageId) && record.stableWikiPageIdentity.sourcePageId > 0 &&
      typeof record.stableWikiPageIdentity?.sourceRevision === 'string' && record.stableWikiPageIdentity.sourceRevision.length > 0 &&
      validIsoTimestamp(record.stableWikiPageIdentity?.sourceTimestamp) && typeof record.stableWikiPageIdentity?.sourceUrl === 'string' && record.stableWikiPageIdentity.sourceUrl.length > 0,
    routeAndVocabularyValid: ['mixed_direct_and_unattributed_rendered', 'rendered_only_origin_unattributed'].includes(record.provenancePartition) &&
      record.requiredEvidenceChannel === queuePolicy.requiredEvidenceChannel && same(record.requiredAttributionEvidence || [], queuePolicy.requiredAttributionEvidence || [], contentHash) &&
      same(record.nonClaims || [], queuePolicy.nonClaims || [], contentHash),
    observationPopulationExact: observations.length > 0 && record.historicalRenderedObservationCount === observations.length &&
      record.historicalRenderedObservationSetContentHash === contentHash(observations) && duplicates(observationKeys).length === 0 &&
      observations.every(row => observationValid(row, record.renderedTargetKey, contentHash)),
    guideBindingsExact: guideBindingsValid(record, observationKeys, contentHash),
    reviewFieldsBlank: record.historicalRenderedExpansionDependencyAttribution === null && Array.isArray(record.attributionEvidenceKeys) &&
      record.attributionEvidenceKeys.length === 0 && record.reviewDecision === null,
    semanticGatesClosed: record.requirementOrUnlockApplied === false && record.semanticDisposition === null &&
      record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
      record.repeatabilityClassification === null && record.mechanicsReviewComplete === false && record.optimizerEligible === false &&
      record.automaticVerificationApplied === false,
    accountIndependent: record.accountIndependent === true,
    blankTemplateComplete: Object.values(without(expectedTemplate, 'disposition', 'observationAttributions', 'evidenceKeys', 'reviewer', 'reviewedAt', 'notes')).every(value => value !== null && value !== undefined && value !== '')
  };
  return { complete: Object.values(checks).every(Boolean), checks, expectedTemplate };
}

function queueEvidenceKeys(queue = {}, queueSnapshotContentHash = '') {
  return unique([
    queueSnapshotContentHash, queue.contentHash, queue.recordContentHash,
    queue.sourceWorkQueueRecordContentHash, queue.sourceWorkQueueIntrinsicRecordContentHash,
    queue.sourceWorkQueueSnapshotContentHash, queue.sourcePartitionSnapshotContentHash,
    queue.sourceCandidateContentHash, queue.sourceCandidateSnapshotContentHash,
    queue.historicalRenderedObservationSetContentHash, queue.historicalGuideRevisionBindingsContentHash,
    ...(queue.historicalRenderedObservations || []).flatMap(row => [row.observationKey, row.observationContentHash, row.observation?.guideContentHash]),
    ...(queue.historicalGuideRevisionBindings || []).flatMap(row => [row.bindingContentHash, row.guideContentHash])
  ].filter(validHash));
}

function attributionAssessment(attribution = {}, queue, expectedOutcome, contentHash = hash) {
  const observation = (queue?.historicalRenderedObservations || []).find(row => row.observationKey === attribution.observationKey);
  const evidenceKeys = Array.isArray(attribution.evidenceKeys) ? attribution.evidenceKeys : [];
  const locator = attribution.generativeSourceLocator || {};
  const dependencyKindNamespaceValid = attribution.dependencyKind === 'template' ? attribution.dependencyNamespaceId === 10 :
    attribution.dependencyKind === 'module' ? attribution.dependencyNamespaceId === 828 :
      attribution.dependencyKind === 'transcluded_page' && Number.isInteger(attribution.dependencyNamespaceId) && ![10, 828].includes(attribution.dependencyNamespaceId);
  const requiredEvidence = observation ? [observation.observationKey, observation.observationContentHash, observation.observation.guideContentHash, attribution.dependencyContentHash] : [];
  const checks = {
    fieldSetExact: same(sorted(Object.keys(attribution)), sorted(ATTRIBUTION_FIELDS), contentHash),
    locatorFieldSetExact: same(sorted(Object.keys(locator)), sorted(LOCATOR_FIELDS), contentHash),
    observationKnownAndBound: Boolean(observation) && attribution.observationContentHash === observation.observationContentHash,
    outcomeMatchesDecision: attribution.attributionOutcome === expectedOutcome,
    dependencyKindAndNamespaceValid: DEPENDENCY_KINDS.includes(attribution.dependencyKind) && dependencyKindNamespaceValid,
    dependencyIdentityComplete: Number.isInteger(attribution.dependencyPageId) && attribution.dependencyPageId > 0 &&
      typeof attribution.dependencyTitle === 'string' && attribution.dependencyTitle.trim().length > 0 &&
      /^\d+$/.test(String(attribution.dependencyRevision || '')) && validIsoTimestamp(attribution.dependencyTimestamp) && validHash(attribution.dependencyContentHash),
    exactOfficialRevisionUrl: attribution.exactDependencyRevisionUrl === exactRevisionUrl(attribution.dependencyRevision),
    generativeLocatorComplete: LOCATOR_KINDS.includes(locator.kind) && typeof locator.value === 'string' && locator.value.trim().length >= 3,
    evidenceCompleteUniqueAndBound: evidenceKeys.length > 0 && duplicates(evidenceKeys).length === 0 &&
      evidenceKeys.every(validHash) && requiredEvidence.every(key => evidenceKeys.includes(key))
  };
  return { complete: Object.values(checks).every(Boolean), checks, observation, requiredEvidence };
}

function submissionShape(submission = {}) {
  const attributions = Array.isArray(submission.observationAttributions) ? submission.observationAttributions : [];
  const evidenceKeys = Array.isArray(submission.evidenceKeys) ? submission.evidenceKeys : [];
  const allBlank = blank(submission.disposition) && attributions.length === 0 && evidenceKeys.length === 0 &&
    blank(submission.reviewer) && blank(submission.reviewedAt) && blank(submission.notes);
  const anyReviewField = !blank(submission.disposition) || attributions.length > 0 || evidenceKeys.length > 0 ||
    !blank(submission.reviewer) || !blank(submission.reviewedAt) || !blank(submission.notes);
  return { allBlank, anyReviewField, attributions, evidenceKeys };
}

function submissionAssessment(submission = {}, queue, context = {}) {
  const { policy = {}, queueSnapshotContentHash = '', queueSnapshotCreatedAt = '', contentHash = hash } = context;
  const shape = submissionShape(submission);
  const expected = queue ? expectedHistoricalAttributionBlankDecision(queue, policy) : {};
  const mutable = ['disposition', 'observationAttributions', 'evidenceKeys', 'reviewer', 'reviewedAt', 'notes'];
  const expectedOutcome = submission.disposition === DECISIONS[0] ? OUTCOMES[0] : submission.disposition === DECISIONS[1] ? OUTCOMES[1] : null;
  const attributionAssessments = shape.attributions.map(row => attributionAssessment(row, queue, expectedOutcome, contentHash));
  const attributionKeys = shape.attributions.map(row => `${row.observationKey}|${row.dependencyPageId}|${row.dependencyRevision}|${row.attributionOutcome}`);
  const submittedObservationKeys = shape.attributions.map(row => row.observationKey);
  const expectedObservationKeys = (queue?.historicalRenderedObservations || []).map(row => row.observationKey);
  const coreEvidence = queue ? [queueSnapshotContentHash, queue.contentHash, queue.recordContentHash,
    queue.sourceWorkQueueRecordContentHash, queue.sourceCandidateContentHash,
    queue.historicalRenderedObservationSetContentHash, queue.historicalGuideRevisionBindingsContentHash] : [];
  const allQueueEvidence = queue ? queueEvidenceKeys(queue, queueSnapshotContentHash) : [];
  const attributionEvidence = shape.attributions.flatMap(row => [row.dependencyContentHash, ...(Array.isArray(row.evidenceKeys) ? row.evidenceKeys : [])]).filter(validHash);
  const allowedTopEvidence = new Set([...allQueueEvidence, ...attributionEvidence]);
  const latestTimes = queue ? [queueSnapshotCreatedAt, queue.stableWikiPageIdentity?.sourceTimestamp,
    ...(queue.historicalRenderedObservations || []).map(row => row.observation?.parserObservedAt),
    ...shape.attributions.map(row => row.dependencyTimestamp)] : [];
  const latestRequiredTime = latestTimes.length && latestTimes.every(validIsoTimestamp) ? Math.max(...latestTimes.map(Date.parse)) : null;
  const confirmComplete = submission.disposition !== DECISIONS[0] || (
    shape.attributions.length === expectedObservationKeys.length && duplicates(submittedObservationKeys).length === 0 &&
    same(submittedObservationKeys, expectedObservationKeys, contentHash) && attributionAssessments.every(row => row.complete)
  );
  const rejectComplete = submission.disposition !== DECISIONS[1] || (
    shape.attributions.length > 0 && duplicates(attributionKeys).length === 0 && attributionAssessments.every(row => row.complete)
  );
  const unavailableComplete = submission.disposition !== DECISIONS[2] || (
    shape.attributions.length === 0 && allQueueEvidence.every(key => shape.evidenceKeys.includes(key))
  );
  const checks = {
    queueKnown: Boolean(queue),
    fieldSetExact: same(sorted(Object.keys(submission)), sorted(Object.keys(expected)), contentHash),
    immutableBindingsExact: same(without(submission, ...mutable), without(expected, ...mutable), contentHash),
    decisionAllowed: policy.allowedDecisions?.includes(submission.disposition),
    reviewerPresentAndHuman: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 2 && !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValidAndCurrent: validIsoTimestamp(submission.reviewedAt) && latestRequiredTime !== null && Date.parse(submission.reviewedAt) >= latestRequiredTime,
    notesMeaningful: typeof submission.notes === 'string' && submission.notes.trim().length >= 20,
    evidenceKeysNonEmptyUniqueAndBound: shape.evidenceKeys.length > 0 && duplicates(shape.evidenceKeys).length === 0 &&
      shape.evidenceKeys.every(key => validHash(key) && allowedTopEvidence.has(key)),
    coreEvidenceComplete: coreEvidence.every(key => shape.evidenceKeys.includes(key)),
    attributionRowsValid: attributionAssessments.every(row => row.complete),
    decisionSpecificAttributionComplete: confirmComplete && rejectComplete && unavailableComplete,
    attributionEvidencePromotedToDecision: attributionEvidence.every(key => shape.evidenceKeys.includes(key))
  };
  const bindingComplete = checks.queueKnown && checks.fieldSetExact && checks.immutableBindingsExact;
  const completed = !shape.allBlank && Object.values(checks).every(Boolean);
  const partial = shape.anyReviewField && !completed;
  const invalid = !bindingComplete || (shape.anyReviewField && !completed);
  return { shape, checks, attributionAssessments, bindingComplete, completed, partial, invalid };
}

function canonicalAttributions(attributions = [], queue = {}) {
  const order = new Map((queue.historicalRenderedObservations || []).map((row, index) => [row.observationKey, index]));
  return structuredClone(attributions).map(row => ({ ...row, evidenceKeys: sorted(row.evidenceKeys) })).sort((a, b) =>
    (order.get(a.observationKey) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.observationKey) ?? Number.MAX_SAFE_INTEGER) ||
    a.dependencyPageId - b.dependencyPageId || String(a.dependencyRevision).localeCompare(String(b.dependencyRevision)));
}

function expectedDecisionRecord(queue, submission, policy, queueSnapshotContentHash, contentHash = hash) {
  const attributions = canonicalAttributions(submission.observationAttributions, queue);
  const decisionFacts = {
    disposition: submission.disposition,
    observationAttributions: attributions,
    reviewer: submission.reviewer.trim(), reviewedAt: submission.reviewedAt,
    reviewNotes: submission.notes.trim(), evidenceKeys: sorted(submission.evidenceKeys)
  };
  const route = ROUTES[submission.disposition];
  const base = {
    contract: policy.recordContract,
    decisionKey: `${queue.historicalAttributionWorkEntryKey}|historical-attribution-review-decision|${contentHash(decisionFacts)}`,
    historicalAttributionWorkEntryKey: queue.historicalAttributionWorkEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceQueueIntrinsicRecordContentHash: queue.recordContentHash,
    sourceWorkQueueEntryKey: queue.sourceWorkQueueEntryKey,
    sourceWorkQueueRecordContentHash: queue.sourceWorkQueueRecordContentHash,
    sourceCandidateContentHash: queue.sourceCandidateContentHash,
    renderedTargetKey: queue.renderedTargetKey,
    stableWikiPageIdentity: queue.stableWikiPageIdentity,
    blankTemplateContentHash: contentHash(expectedHistoricalAttributionBlankDecision(queue, policy)),
    historicalRenderedObservationSetContentHash: queue.historicalRenderedObservationSetContentHash,
    historicalRenderedObservationCount: queue.historicalRenderedObservationCount,
    historicalGuideRevisionBindingsContentHash: queue.historicalGuideRevisionBindingsContentHash,
    disposition: submission.disposition,
    submittedObservationAttributions: attributions,
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    reviewNotes: submission.notes.trim(),
    evidenceKeys: sorted(submission.evidenceKeys),
    reviewDecisionRecorded: true,
    reviewOutcomeRoute: route,
    historicalAttributionApplied: false,
    historicalRenderedExpansionDependencyAttribution: null,
    requirementOrUnlockApplied: false,
    semanticDisposition: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      route,
      'historical_attribution_application_not_performed',
      'source_scoped_semantic_relevance_disposition_pending',
      'level_unlock_corpus_absence_reconciliation_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ]),
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function closedDecisionRecord(record = {}) {
  return record.reviewDecisionRecorded === true && record.historicalAttributionApplied === false &&
    record.historicalRenderedExpansionDependencyAttribution === null && record.requirementOrUnlockApplied === false &&
    record.semanticDisposition === null && record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.mechanicsReviewComplete === false && record.optimizerEligible === false &&
    record.automaticVerificationApplied === false && record.accountIndependent === true;
}

export function buildHistoricalAttributionReviewDecisionImport(input = {}) {
  const audit = auditHistoricalAttributionReviewDecisionImport([], input, true);
  if (!audit._proposedRecords || !audit.publishable) return { records: [], audit: without(audit, '_proposedRecords') };
  const records = audit._proposedRecords;
  return { records, audit: without(auditHistoricalAttributionReviewDecisionImport(records, input, false), '_proposedRecords') };
}

export function auditHistoricalAttributionReviewDecisionImport(records = [], input = {}, derive = false) {
  const { queueRecords = [], submissions = [], policy = {}, queuePolicy = {}, queueSnapshotContentHash = '', queueSnapshotCreatedAt = '', contentHash = hash } = input;
  const compiled = compileHistoricalAttributionReviewDecisionImportPolicy(policy, queuePolicy, contentHash);
  const queueKeys = queueRecords.map(row => row.historicalAttributionWorkEntryKey);
  const duplicateQueueKeys = duplicates(queueKeys);
  const queueByKey = new Map(queueRecords.map(row => [row.historicalAttributionWorkEntryKey, row]));
  const queueAssessments = queueRecords.map(row => ({ key: row.historicalAttributionWorkEntryKey,
    ...queueRecordIntegrity(row, { policy, queuePolicy, queueSnapshotContentHash, contentHash }) }));
  const invalidQueueKeys = queueAssessments.filter(row => !row.complete).map(row => row.key);
  const submissionKeys = submissions.map(row => row.historicalAttributionWorkEntryKey);
  const duplicateSubmissionKeys = duplicates(submissionKeys);
  const unknownSubmissionKeys = unique(submissionKeys.filter(key => !queueByKey.has(key)));
  const assessments = submissions.map((submission, index) => ({
    index, key: submission.historicalAttributionWorkEntryKey, submission,
    assessment: submissionAssessment(submission, queueByKey.get(submission.historicalAttributionWorkEntryKey),
      { policy, queueSnapshotContentHash, queueSnapshotCreatedAt, contentHash })
  }));
  const blankRows = assessments.filter(row => row.assessment.shape.allBlank && row.assessment.bindingComplete);
  const completedRows = assessments.filter(row => row.assessment.completed);
  const partialRows = assessments.filter(row => row.assessment.partial);
  const invalidSubmissionIndexes = unique([
    ...assessments.filter(row => row.assessment.invalid).map(row => row.index),
    ...assessments.filter(row => unknownSubmissionKeys.includes(row.key)).map(row => row.index),
    ...assessments.filter(row => duplicateSubmissionKeys.includes(row.key)).map(row => row.index)
  ]).sort((a, b) => a - b);
  const sourceValid = compiled.valid && validHash(queueSnapshotContentHash) && validIsoTimestamp(queueSnapshotCreatedAt) &&
    queueRecords.length > 0 && duplicateQueueKeys.length === 0 && invalidQueueKeys.length === 0;
  const batchValid = sourceValid && completedRows.length > 0 && invalidSubmissionIndexes.length === 0;
  const proposed = batchValid ? completedRows.map(row => expectedDecisionRecord(queueByKey.get(row.key), row.submission, policy, queueSnapshotContentHash, contentHash)) : [];
  const expected = derive ? proposed : (batchValid ? completedRows.map(row => expectedDecisionRecord(queueByKey.get(row.key), row.submission, policy, queueSnapshotContentHash, contentHash)) : []);
  const expectedByKey = new Map(expected.map(row => [row.decisionKey, row]));
  const recordKeys = records.map(row => row.decisionKey);
  const expectedKeys = expected.map(row => row.decisionKey);
  const duplicateRecordKeys = duplicates(recordKeys);
  const missingRecordKeys = expectedKeys.filter(key => !recordKeys.includes(key));
  const unexpectedRecordKeys = recordKeys.filter(key => !expectedKeys.includes(key));
  const recordMismatchKeys = records.filter(row => !same(row, expectedByKey.get(row.decisionKey), contentHash) ||
    !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'))).map(row => row.decisionKey);
  const unsupportedPromotions = records.filter(row => !closedDecisionRecord(row)).map(row => row.decisionKey);
  const accountStateFindings = findAccountState([...queueRecords, ...submissions, ...records]);
  const blockers = [];
  if (!compiled.valid) blockers.push('historical_attribution_review_decision_import_policy_invalid_or_specific');
  if (!validHash(queueSnapshotContentHash) || !validIsoTimestamp(queueSnapshotCreatedAt)) blockers.push('queue_manifest_snapshot_binding_invalid');
  if (duplicateQueueKeys.length || invalidQueueKeys.length) blockers.push('one_or_more_queue_records_failed_exact_revalidation');
  if (!submissions.length) blockers.push('no_review_submissions_supplied');
  if (!completedRows.length) blockers.push('no_completed_human_review_decisions_supplied');
  if (invalidSubmissionIndexes.length) blockers.push('one_or_more_review_submissions_invalid');
  if (!derive && (duplicateRecordKeys.length || missingRecordKeys.length || unexpectedRecordKeys.length || recordMismatchKeys.length)) blockers.push('recorded_decision_set_does_not_match_completed_submission_set');
  if (unsupportedPromotions.length) blockers.push('decision_record_applied_unsupported_attribution_semantic_or_optimizer_state');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  const recordSetValid = derive || (!duplicateRecordKeys.length && !missingRecordKeys.length && !unexpectedRecordKeys.length && !recordMismatchKeys.length && !unsupportedPromotions.length);
  const structurallyPublishable = batchValid && recordSetValid && accountStateFindings.length === 0;
  const audit = {
    contract: policy.auditContract,
    queueCoverage: {
      queueRecordCount: queueRecords.length, validQueueRecordCount: queueRecords.length - invalidQueueKeys.length,
      duplicateQueueKeys, invalidQueueKeys, queueSnapshotContentHashValid: validHash(queueSnapshotContentHash),
      queueSnapshotCreatedAtValid: validIsoTimestamp(queueSnapshotCreatedAt)
    },
    submissionCoverage: {
      submissionCount: submissions.length, completedSubmissionCount: completedRows.length,
      blankSubmissionCount: blankRows.length, partialSubmissionCount: partialRows.length,
      duplicateSubmissionKeys, unknownSubmissionKeys, invalidSubmissionIndexes
    },
    policyCoverage: {
      policyValid: compiled.valid, contractsValid: compiled.contractsValid, queuePolicyValid: compiled.queuePolicyCoverage.valid,
      vocabularyValid: compiled.vocabularyValid, invalidRules: compiled.invalidRules, forbiddenPolicyPaths: compiled.forbiddenPolicyPaths
    },
    bindingCoverage: {
      completedSubmissionKeys: completedRows.map(row => row.key),
      allCompletedSubmissionsMatchOneQueueEntry: completedRows.every(row => queueByKey.has(row.key)),
      immutableBindingFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank &&
        (!row.assessment.checks.queueKnown || !row.assessment.checks.fieldSetExact || !row.assessment.checks.immutableBindingsExact)).map(row => row.index),
      coreEvidenceFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.coreEvidenceComplete).map(row => row.index),
      attributionEvidenceFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank &&
        (!row.assessment.checks.attributionRowsValid || !row.assessment.checks.attributionEvidencePromotedToDecision)).map(row => row.index),
      decisionSpecificEvidenceFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.decisionSpecificAttributionComplete).map(row => row.index),
      unboundEvidenceFailureIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.evidenceKeysNonEmptyUniqueAndBound).map(row => row.index),
      staleReviewTimestampIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.reviewedAtValidAndCurrent).map(row => row.index),
      automaticReviewerIndexes: assessments.filter(row => !row.assessment.shape.allBlank && !row.assessment.checks.reviewerPresentAndHuman).map(row => row.index)
    },
    recordCoverage: {
      recordedDecisionCount: records.length,
      decisionDistribution: Object.fromEntries(DECISIONS.map(value => [value, records.filter(row => row.disposition === value).length])),
      submittedObservationAttributionCount: records.reduce((sum, row) => sum + (row.submittedObservationAttributions?.length || 0), 0),
      duplicateRecordKeys, missingRecordKeys, unexpectedRecordKeys, recordMismatchKeys,
      orderMatchesCompletedSubmissions: same(records.map(row => row.historicalAttributionWorkEntryKey), completedRows.map(row => row.key), contentHash)
    },
    semanticPreservationCoverage: {
      historicalAttributionApplications: records.filter(row => row.historicalAttributionApplied === true || row.historicalRenderedExpansionDependencyAttribution !== null).length,
      requirementOrUnlockApplications: records.filter(row => row.requirementOrUnlockApplied === true).length,
      semanticDispositionApplications: records.filter(row => row.semanticDisposition !== null).length,
      canonicalIdentityPromotions: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length,
      repeatabilityPromotions: records.filter(row => row.repeatabilityClassification !== null).length,
      mechanicsPromotions: records.filter(row => row.mechanicsReviewComplete === true).length,
      optimizerPromotions: records.filter(row => row.optimizerEligible === true).length,
      automaticVerifications: records.filter(row => row.automaticVerificationApplied === true).length,
      unsupportedPromotions
    },
    accountStateFindings,
    reviewDecisionRecordingComplete: structurallyPublishable && records.length === queueRecords.length,
    historicalAttributionApplicationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers,
      'historical_attribution_application_not_performed',
      'source_scoped_semantic_relevance_disposition_pending',
      'level_unlock_corpus_absence_reconciliation_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: structurallyPublishable
  };
  if (derive) audit._proposedRecords = proposed;
  return audit;
}
