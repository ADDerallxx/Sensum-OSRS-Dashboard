import { hash } from '../ingestion/lib.mjs';
import { compileAgilityTargetConditionGapDiscoveryReviewPacketPolicy } from './agility-target-condition-gap-discovery-review-packet-lib.mjs';

const REQUIRED_RULES = [
  'packetSnapshotTemplateAndDecisionFileMustBeExplicitlySelected',
  'packetManifestRawRecordAndArtifactHashesMustRevalidate',
  'packetAuditMustBePublishableCompleteAndFailClosed',
  'blankTemplateMustExactlyMatchPacketGeneratedArtifact',
  'submissionFieldSetImmutableBindingsAndHashesMustMatchTemplate',
  'everyPacketMustHaveExactlyOneCompletedDecision',
  'blankPartialDuplicateUnknownOrExtraRowsRejectEntireBatch',
  'decisionMustUseAnAllowedValue',
  'selectedEvidenceMustExactlyMatchAvailablePacketEvidence',
  'humanReviewerTimestampAndMeaningfulNotesAreRequired',
  'reviewedAtMustNotPrecedePacketOrEvidence',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingDoesNotApplySemanticsCloseBlockersCreateFactsOrPromoteOptimizerState',
  'namesTitlesPageIdsRevisionsCandidatesBlockersLinesAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateAndPromotionFieldsAreForbiddenInSubmissions'
];
const ALLOWED_DECISIONS = [
  'confirm_source_resolves_named_blocker_only',
  'reject_source_as_insufficient_or_condition_mismatched',
  'needs_additional_revision_pinned_evidence'
];
const EXPLICIT_NON_CLAIMS = [
  'recorded_review_decision_is_not_semantic_application',
  'named_blocker_remains_open_until_separate_guarded_application',
  'no_game_fact_is_created',
  'other_condition_and_mechanics_blockers_remain_open',
  'candidate_universe_completeness_is_not_established',
  'optimizer_eligibility_is_not_established',
  'verified_best_is_not_authorized'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash({ value: left }) === contentHash({ value: right });
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === (value.includes('.') ? value : value.replace(/Z$/, '.000Z'));
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|ai)$/.test(value)
    || /\b(?:bot|automated reviewer|language model|ai reviewer|codex|chatgpt|openai|sensum|gpt(?:[- ]?\d[^ ]*)?)\b/.test(value);
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|candidate|candidates|candidateKey|candidateKeys|blocker|blockers|line|lines|alias|aliases|override|overrides|exception|exceptions)$/i;
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

function submissionForbiddenFindings(submissions = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests|currentBaseLevel|currentLevel|currentXp|blockersClosed|semanticFactsCreated|optimizerEligible|automaticVerificationApplied|completeWikiUniverseClaimed|semanticApplicationApplied)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  submissions.forEach((submission, index) => visit(submission, `[${index}]`));
  return sorted(unique(findings));
}

export function compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy(policy = {}, packetPolicy = {}, contentHash = hash) {
  const expected = {
    inputManifestContract: 'sensum.ingestion-manifest.v1',
    inputPacketDomain: 'agility-target-condition-gap-discovery-review-packet',
    inputPacketContract: 'sensum.agility-target-condition-gap-discovery-review-packet.v1',
    inputPacketAuditContract: 'sensum.agility-target-condition-gap-discovery-review-packet-materialization-audit.v1',
    inputPacketPolicy: 'sensum.agility-target-condition-gap-discovery-review-packet-policy.v1',
    inputPacketPolicyFile: 'platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json',
    artifactManifestContract: 'sensum.agility-target-condition-gap-discovery-review-artifacts.v1',
    submissionContract: 'sensum.agility-target-condition-gap-discovery-review-decision-template.v1',
    recordContract: 'sensum.agility-target-condition-gap-discovery-review-decision.v1',
    auditContract: 'sensum.agility-target-condition-gap-discovery-review-decision-import-audit.v1',
    outputDomain: 'agility-target-condition-gap-discovery-review-decisions',
    recordState: 'recorded_source_bound_target_condition_human_review_decision_pending_separate_semantic_application'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const packetPolicyCoverage = compileAgilityTargetConditionGapDiscoveryReviewPacketPolicy(packetPolicy);
  const packetBindingsValid = packetPolicy.policy === policy.inputPacketPolicy
    && contentHash(packetPolicy) === policy.inputPacketPolicyContentHash
    && packetPolicy.outputDomain === policy.inputPacketDomain
    && packetPolicy.recordContract === policy.inputPacketContract
    && packetPolicy.decisionTemplateContract === policy.submissionContract
    && packetPolicy.auditContract === policy.inputPacketAuditContract;
  const decisionsValid = same(policy.allowedDecisions || [], ALLOWED_DECISIONS, contentHash)
    && same(policy.allowedDecisions || [], packetPolicy.allowedDecisions || [], contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidBindings.length && !invalidRules.length && packetPolicyCoverage.valid && packetBindingsValid && decisionsValid && !forbidden.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    packetPolicyCoverage,
    packetBindingsValid,
    decisionsValid,
    forbiddenPolicyPaths: forbidden
  };
}

function packetHashesValid(packet = {}, contentHash = hash) {
  return validHash(packet.contentHash)
    && packet.contentHash === contentHash(without(packet, 'contentHash'))
    && validHash(packet.packetContentHash)
    && packet.packetContentHash === contentHash(without(packet, 'contentHash', 'packetContentHash'));
}

function packetIntegrity(packet = {}, policy = {}, contentHash = hash) {
  const evidenceKey = packet.sourceEvidence?.evidenceKey;
  const checks = {
    contractMatches: packet.contract === policy.inputPacketContract,
    hashesValid: packetHashesValid(packet, contentHash),
    keyPresent: typeof packet.reviewPacketKey === 'string' && packet.reviewPacketKey.length > 0,
    packetMaterializationComplete: packet.packetMaterializationComplete === true,
    statePendingHumanReview: packet.state === 'pending_explicit_human_semantic_review_no_decision',
    decisionFieldsBlank: packet.decision === null && Array.isArray(packet.selectedEvidenceKeys) && packet.selectedEvidenceKeys.length === 0
      && packet.reviewer === null && packet.reviewedAt === null && packet.reviewNotes === null,
    evidenceIdentityComplete: typeof evidenceKey === 'string' && evidenceKey.length > 0
      && Number.isInteger(packet.sourceEvidence?.sourcePageId) && packet.sourceEvidence.sourcePageId > 0
      && /^\d+$/.test(String(packet.sourceEvidence?.sourceRevision || ''))
      && validIsoTimestamp(packet.sourceEvidence?.sourceTimestamp)
      && Number.isInteger(packet.sourceEvidence?.sourceLine) && packet.sourceEvidence.sourceLine > 0
      && packet.sourceEvidence?.exactRevisionLineRevalidated === true
      && validHash(packet.sourceEvidence?.sourceContentHash),
    queryBindingPresent: Array.isArray(packet.queryBindings) && packet.queryBindings.length > 0
      && packet.queryBindings.every(row => row.resultContainsSourcePage === true),
    allowedDecisionsMatch: same(packet.allowedDecisions || [], policy.allowedDecisions || [], contentHash),
    semanticGatesClosed: packet.blockersClosed === 0 && packet.semanticFactsCreated === 0
      && packet.optimizerEligible === false && packet.automaticVerificationApplied === false
      && packet.accountIndependent === true && packet.completeWikiUniverseClaimed === false
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function expectedBlankTemplate(packet = {}, policy = {}, contentHash = hash) {
  const base = {
    contract: policy.submissionContract,
    reviewPacketKey: packet.reviewPacketKey,
    packetContentHash: packet.packetContentHash,
    availableEvidenceKeys: [packet.sourceEvidence?.evidenceKey],
    decision: null,
    selectedEvidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null
  };
  return { ...base, contentHash: contentHash(base) };
}

function inputIntegrity(context = {}, policy = {}, packetPolicy = {}, contentHash = hash) {
  const { packetRecords = [], packetManifest = {}, packetRaw = '', artifactManifest = {}, artifactManifestRaw = '', reviewMarkdownRaw = '', blankTemplates = [], blankTemplateRaw = '' } = context;
  const audit = packetManifest.source?.audit || {};
  const packetAssessments = packetRecords.map(packet => packetIntegrity(packet, policy, contentHash));
  const expectedTemplates = packetRecords.map(packet => expectedBlankTemplate(packet, policy, contentHash));
  const artifactBase = without(artifactManifest, 'contentHash');
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    manifestContractMatches: packetManifest.contract === policy.inputManifestContract,
    manifestDomainMatches: packetManifest.domain === policy.inputPacketDomain,
    manifestRecordCountMatches: Number(packetManifest.records) === packetRecords.length && packetRecords.length > 0,
    manifestRawHashMatches: typeof packetRaw === 'string' && packetManifest.contentHash === contentHash(packetRaw),
    packetPolicyBindingMatches: packetManifest.source?.policy?.id === packetPolicy.policy
      && packetManifest.source?.policy?.contentHash === contentHash(packetPolicy),
    packetAuditValid: audit.contract === policy.inputPacketAuditContract && audit.publishable === true
      && audit.reviewPacketMaterializationComplete === true && audit.humanReviewComplete === false,
    packetAuditFailClosed: Number(semantic.decisionCount) === 0 && Number(semantic.selectedEvidenceCount) === 0
      && Number(semantic.blockersClosed) === 0 && Number(semantic.semanticFactsCreated) === 0
      && Number(semantic.optimizerEligibleCount) === 0 && Number(semantic.automaticVerificationCount) === 0
      && Number(semantic.completeWikiUniverseClaimCount) === 0 && audit.completeWikiUniverse === false,
    packetRecordsValid: packetAssessments.every(row => row.complete),
    packetKeysUnique: duplicates(packetRecords.map(row => row.reviewPacketKey)).length === 0,
    artifactManifestContractMatches: artifactManifest.contract === policy.artifactManifestContract,
    artifactManifestHashMatches: validHash(artifactManifest.contentHash) && artifactManifest.contentHash === contentHash(artifactBase),
    artifactManifestRawMatches: typeof artifactManifestRaw === 'string'
      && artifactManifestRaw === `${JSON.stringify(artifactManifest, null, 2)}\n`,
    artifactPacketBindingsMatch: Number(artifactManifest.packetCount) === packetRecords.length
      && same(artifactManifest.packetContentHashes || [], packetRecords.map(row => row.packetContentHash), contentHash)
      && Number(artifactManifest.decisionsRecorded) === 0,
    reviewMarkdownArtifactMatches: artifactManifest.reviewMarkdown?.file === 'review-packet.md'
      && artifactManifest.reviewMarkdown?.contentHash === contentHash(reviewMarkdownRaw)
      && Number(artifactManifest.reviewMarkdown?.bytes) === Buffer.byteLength(reviewMarkdownRaw, 'utf8'),
    blankTemplateArtifactMatches: artifactManifest.decisionTemplate?.file === 'decision-template.ndjson'
      && Number(artifactManifest.decisionTemplate?.recordCount) === blankTemplates.length
      && artifactManifest.decisionTemplate?.contentHash === contentHash(blankTemplateRaw)
      && Number(artifactManifest.decisionTemplate?.bytes) === Buffer.byteLength(blankTemplateRaw, 'utf8'),
    blankTemplatesExactlyMatchPackets: same(blankTemplates, expectedTemplates, contentHash)
  };
  return { checks, complete: Object.values(checks).every(Boolean), packetAssessments, expectedTemplates };
}

function submissionShape(submission = {}) {
  const keys = Array.isArray(submission.selectedEvidenceKeys) ? submission.selectedEvidenceKeys : [];
  const reviewFields = [submission.decision, submission.reviewer, submission.reviewedAt, submission.reviewNotes];
  const allBlank = reviewFields.every(blank) && keys.length === 0;
  const anyReviewField = reviewFields.some(value => !blank(value)) || keys.length > 0;
  return { keys, allBlank, anyReviewField };
}

function submissionAssessment(submission = {}, packet, template, packetManifest = {}, policy = {}, contentHash = hash) {
  const shape = submissionShape(submission);
  const latestBoundTimestamp = packet && validIsoTimestamp(packetManifest.createdAt) && validIsoTimestamp(packet.sourceEvidence?.sourceTimestamp)
    ? new Date(Math.max(Date.parse(packetManifest.createdAt), Date.parse(packet.sourceEvidence.sourceTimestamp))).toISOString()
    : null;
  const bindingChecks = {
    packetExists: Boolean(packet),
    templateExists: Boolean(template),
    fieldSetExact: same(sorted(Object.keys(submission)), sorted(Object.keys(template || {})), contentHash),
    immutableBindingsMatch: Boolean(packet && template) && ['contract', 'reviewPacketKey', 'packetContentHash', 'availableEvidenceKeys']
      .every(key => same(submission[key], template[key], contentHash)),
    submissionHashValid: validHash(submission.contentHash)
      && submission.contentHash === contentHash(without(submission, 'contentHash'))
  };
  const contentChecks = shape.allBlank ? {} : {
    decisionAllowed: policy.allowedDecisions?.includes(submission.decision) === true,
    selectedEvidenceExact: Boolean(template) && duplicates(shape.keys).length === 0
      && same(sorted(shape.keys), sorted(template.availableEvidenceKeys || []), contentHash),
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforePacketOrEvidence: validIsoTimestamp(submission.reviewedAt) && latestBoundTimestamp !== null
      && Date.parse(submission.reviewedAt) >= Date.parse(latestBoundTimestamp),
    reviewNotesMeaningful: typeof submission.reviewNotes === 'string' && submission.reviewNotes.trim().length >= 20
  };
  const bindingComplete = Object.values(bindingChecks).every(Boolean);
  const contentComplete = !shape.allBlank && Object.values(contentChecks).every(Boolean);
  return {
    shape,
    bindingChecks,
    contentChecks,
    latestBoundTimestamp,
    blank: shape.allBlank && bindingComplete,
    complete: shape.anyReviewField && bindingComplete && contentComplete,
    invalid: !shape.anyReviewField || !bindingComplete || !contentComplete
  };
}

function decisionRecord(submission, packet, template, packetManifest, policy, contentHash = hash) {
  const decisionFacts = {
    decision: submission.decision,
    selectedEvidenceKeys: sorted(submission.selectedEvidenceKeys),
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    reviewNotes: submission.reviewNotes.trim()
  };
  const base = {
    contract: policy.recordContract,
    decisionKey: `${packet.reviewPacketKey}|human-review-decision|${contentHash(decisionFacts)}`,
    reviewPacketKey: packet.reviewPacketKey,
    sourcePacketSnapshot: {
      domain: packetManifest.domain,
      createdAt: packetManifest.createdAt,
      contentHash: packetManifest.contentHash
    },
    sourcePacketContentHash: packet.packetContentHash,
    sourcePacketOuterContentHash: packet.contentHash,
    sourceBlankTemplateContentHash: template.contentHash,
    candidateKey: packet.candidateKey,
    targetBaseAgility: packet.targetBaseAgility,
    namedBlocker: packet.namedBlocker,
    sourceEvidence: {
      evidenceKey: packet.sourceEvidence.evidenceKey,
      sourcePageId: packet.sourceEvidence.sourcePageId,
      sourceTitle: packet.sourceEvidence.sourceTitle,
      sourceRevision: packet.sourceEvidence.sourceRevision,
      sourceTimestamp: packet.sourceEvidence.sourceTimestamp,
      exactRevisionUrl: packet.sourceEvidence.exactRevisionUrl,
      sourceContentHash: packet.sourceEvidence.sourceContentHash,
      sourceLine: packet.sourceEvidence.sourceLine,
      exactSourceLine: packet.sourceEvidence.exactSourceLine
    },
    availableEvidenceKeys: sorted(template.availableEvidenceKeys),
    ...decisionFacts,
    reviewDecisionRecorded: true,
    semanticApplicationApplied: false,
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false,
    explicitNonClaims: [...EXPLICIT_NON_CLAIMS],
    blockers: [
      'human_review_decision_recorded_but_not_semantically_applied',
      'named_blocker_remains_open_pending_separate_application',
      'condition_and_mechanics_coverage_incomplete',
      'complete_activity_universe_not_established'
    ],
    state: policy.recordState
  };
  const withRecordHash = { ...base, recordContentHash: contentHash(base) };
  return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
}

export function auditAgilityTargetConditionGapDiscoveryReviewDecisionImport(records = [], context = {}) {
  const { policy = {}, packetPolicy = {}, packetRecords = [], packetManifest = {}, blankTemplates = [], submissions = [], input, submissionAssessments = [], contentHash = hash } = context;
  const compiled = compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy(policy, packetPolicy, contentHash);
  const forbiddenFindings = submissionForbiddenFindings(submissions);
  const packetKeys = packetRecords.map(row => row.reviewPacketKey);
  const templateKeys = blankTemplates.map(row => row.reviewPacketKey);
  const submissionKeys = submissions.map(row => row.reviewPacketKey);
  const completed = submissionAssessments.filter(row => row.complete).length;
  const expectedRecords = submissionAssessments.every(row => row.complete) && submissions.length === packetRecords.length
    ? submissions.map(submission => {
      const packet = packetRecords.find(row => row.reviewPacketKey === submission.reviewPacketKey);
      const template = blankTemplates.find(row => row.reviewPacketKey === submission.reviewPacketKey);
      return decisionRecord(submission, packet, template, packetManifest, policy, contentHash);
    })
    : [];
  const inputCoverage = { checks: input?.checks || {}, complete: input?.complete === true };
  const packetCoverage = {
    packetCount: packetRecords.length,
    uniquePacketCount: unique(packetKeys).length,
    allPacketsValid: input?.packetAssessments?.every(row => row.complete) === true,
    exactSetRequired: true
  };
  const templateCoverage = {
    templateCount: blankTemplates.length,
    uniqueTemplateCount: unique(templateKeys).length,
    exactPacketSet: same(sorted(templateKeys), sorted(packetKeys), contentHash),
    exactlyMatchesGeneratedArtifacts: input?.checks?.blankTemplatesExactlyMatchPackets === true
  };
  const submissionCoverage = {
    submissionCount: submissions.length,
    completedDecisionCount: completed,
    blankDecisionCount: submissionAssessments.filter(row => row.blank).length,
    invalidDecisionCount: submissionAssessments.filter(row => row.invalid).length,
    duplicateReviewPacketKeys: duplicates(submissionKeys),
    unknownReviewPacketKeys: sorted(submissionKeys.filter(key => !packetKeys.includes(key))),
    missingReviewPacketKeys: sorted(packetKeys.filter(key => !submissionKeys.includes(key))),
    invalidSubmissionRows: submissionAssessments.map((row, index) => ({ reviewPacketKey: submissions[index]?.reviewPacketKey || null, ...row })).filter(row => row.invalid)
  };
  const exactSubmissionSet = submissions.length === packetRecords.length
    && duplicates(submissionKeys).length === 0
    && same(sorted(submissionKeys), sorted(packetKeys), contentHash);
  const recordsReproduce = records.length === expectedRecords.length && same(records, expectedRecords, contentHash);
  const bindingCoverage = {
    exactSubmissionSet,
    everySubmissionBoundAndComplete: submissionAssessments.length === submissions.length && submissionAssessments.every(row => row.complete),
    decisionRecordsExactlyReproduceValidatedSubmissions: recordsReproduce
  };
  const semanticPreservationCoverage = {
    semanticApplicationCount: records.filter(row => row.semanticApplicationApplied === true).length,
    blockersClosed: records.reduce((sum, row) => sum + Number(row.blockersClosed || 0), 0),
    semanticFactsCreated: records.reduce((sum, row) => sum + Number(row.semanticFactsCreated || 0), 0),
    optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
    automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length,
    completeWikiUniverseClaimCount: records.filter(row => row.completeWikiUniverseClaimed === true).length
  };
  const recordsFailClosed = records.every(row => row.reviewDecisionRecorded === true
    && row.semanticApplicationApplied === false && row.blockersClosed === 0 && row.semanticFactsCreated === 0
    && row.optimizerEligible === false && row.automaticVerificationApplied === false
    && row.accountIndependent === true && row.completeWikiUniverseClaimed === false
    && validHash(row.recordContentHash) && row.recordContentHash === contentHash(without(row, 'recordContentHash', 'contentHash'))
    && validHash(row.contentHash) && row.contentHash === contentHash(without(row, 'contentHash')));
  const blockers = [];
  if (!compiled.valid) blockers.push('decision_import_policy_invalid');
  if (!inputCoverage.complete) blockers.push('packet_snapshot_or_artifact_integrity_failed');
  if (!exactSubmissionSet) blockers.push('decision_submission_does_not_cover_exact_packet_set');
  if (!submissionAssessments.length || submissionAssessments.some(row => row.invalid)) blockers.push('one_or_more_decisions_blank_partial_or_invalid');
  if (forbiddenFindings.length) blockers.push('account_state_or_promotion_fields_present_in_submission');
  if (!recordsReproduce) blockers.push('decision_records_do_not_exactly_reproduce_validated_submissions');
  if (!recordsFailClosed || Object.values(semanticPreservationCoverage).some(Number)) blockers.push('decision_import_created_unsupported_semantic_or_optimizer_promotion');
  const publishable = blockers.length === 0 && records.length === packetRecords.length && records.length > 0;
  const persistentBlockers = publishable ? [
    'human_review_decision_recorded_but_not_semantically_applied',
    'named_blocker_remains_open_pending_separate_application',
    'condition_and_mechanics_coverage_incomplete',
    'complete_activity_universe_not_established'
  ] : blockers;
  return {
    contract: policy.auditContract,
    policyCoverage: compiled,
    inputCoverage,
    packetCoverage,
    templateCoverage,
    submissionCoverage,
    bindingCoverage,
    semanticPreservationCoverage,
    accountStateFindings: forbiddenFindings,
    reviewDecisionRecordingComplete: publishable,
    humanReviewComplete: publishable,
    semanticApplicationComplete: false,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_pending_separate_semantic_application_and_incomplete_agility_coverage',
    blockers: persistentBlockers,
    publishable
  };
}

export function buildAgilityTargetConditionGapDiscoveryReviewDecisionImport(context = {}) {
  const { policy = {}, packetPolicy = {}, packetRecords = [], packetManifest = {}, blankTemplates = [], submissions = [], contentHash = hash } = context;
  const input = inputIntegrity(context, policy, packetPolicy, contentHash);
  const packetByKey = new Map(packetRecords.map(row => [row.reviewPacketKey, row]));
  const templateByKey = new Map(blankTemplates.map(row => [row.reviewPacketKey, row]));
  const submissionAssessments = submissions.map(submission => submissionAssessment(
    submission,
    packetByKey.get(submission.reviewPacketKey),
    templateByKey.get(submission.reviewPacketKey),
    packetManifest,
    policy,
    contentHash
  ));
  const preconditions = compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy(policy, packetPolicy, contentHash).valid
    && input.complete
    && submissionForbiddenFindings(submissions).length === 0
    && submissions.length === packetRecords.length
    && duplicates(submissions.map(row => row.reviewPacketKey)).length === 0
    && same(sorted(submissions.map(row => row.reviewPacketKey)), sorted(packetRecords.map(row => row.reviewPacketKey)), contentHash)
    && submissionAssessments.every(row => row.complete);
  const records = preconditions ? submissions.map(submission => decisionRecord(
    submission,
    packetByKey.get(submission.reviewPacketKey),
    templateByKey.get(submission.reviewPacketKey),
    packetManifest,
    policy,
    contentHash
  )) : [];
  const audit = auditAgilityTargetConditionGapDiscoveryReviewDecisionImport(records, {
    ...context, input, submissionAssessments, contentHash
  });
  return { records: audit.publishable ? records : [], audit };
}

export { expectedBlankTemplate as expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision };
