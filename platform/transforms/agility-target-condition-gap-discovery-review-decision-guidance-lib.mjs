import { hash, json } from '../ingestion/lib.mjs';
import {
  buildAgilityTargetConditionGapDiscoveryReviewDecisionImport,
  compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy,
  expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision
} from './agility-target-condition-gap-discovery-review-decision-import-lib.mjs';
import { compileAgilityTargetConditionGapDiscoveryReviewDecisionApplicationPolicy } from './agility-target-condition-gap-discovery-review-decision-application-lib.mjs';

const REQUIRED_RULES = [
  'packetSnapshotMustBeExplicitlySelected',
  'packetManifestRawRecordsAuditAndArtifactsMustRevalidate',
  'packetImporterAndApplicationPoliciesMustBindExactly',
  'oneGuidanceRecordPerPacketInPacketOrder',
  'everyGuidanceRecordMustExposeExactEvidenceRevisionLineAndEarliestTimestamp',
  'decisionOptionsMustExactlyMirrorImporterVocabularyAndApplicationEffects',
  'allDecisionOptionsMustRemainUnselectedAndUnrecommended',
  'blankDecisionTemplateMustRemainByteEquivalentToPacketArtifact',
  'guidanceArtifactsMustBeCompleteAndDeterministic',
  'guidanceCannotRecordInferRecommendOrApplyAHumanDecision',
  'guidanceCannotCloseBlockersCreateRatesMechanicsFactsOrPromoteOptimizerState',
  'namesTitlesPageIdsRevisionsCandidatesBlockersLinesAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash({ value: left }) === contentHash({ value: right });
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function validIsoTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|candidate|candidates|candidateKey|candidateKeys|blocker|blockers|line|lines|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|candidate|blocker|line|alias).*(?:override|exception)s?$/i;
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

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests|currentBaseLevel|currentLevel|currentXp)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  values.forEach((value, index) => visit(value, `[${index}]`));
  return sorted(unique(findings));
}

export function compileAgilityTargetConditionGapDiscoveryReviewDecisionGuidancePolicy(
  policy = {}, packetPolicy = {}, decisionPolicy = {}, applicationPolicy = {}, contentHash = hash
) {
  const expected = {
    inputDomain: 'agility-target-condition-gap-discovery-review-packet',
    inputPacketContract: 'sensum.agility-target-condition-gap-discovery-review-packet.v1',
    inputPacketPolicy: 'sensum.agility-target-condition-gap-discovery-review-packet-policy.v1',
    inputPacketPolicyFile: 'platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json',
    inputDecisionImportPolicy: 'sensum.agility-target-condition-gap-discovery-review-decision-import-policy.v1',
    inputDecisionImportPolicyFile: 'platform/policies/agility-target-condition-gap-discovery-review-decision-import-v1.json',
    inputDecisionApplicationPolicy: 'sensum.agility-target-condition-gap-discovery-review-decision-application-policy.v1',
    inputDecisionApplicationPolicyFile: 'platform/policies/agility-target-condition-gap-discovery-review-decision-application-v1.json',
    guidanceContract: 'sensum.agility-target-condition-gap-discovery-review-decision-guidance.v1',
    auditContract: 'sensum.agility-target-condition-gap-discovery-review-decision-guidance-audit.v1',
    outputDomain: 'agility-target-condition-gap-discovery-review-decision-guidance',
    guidanceState: 'evidence_bound_review_guidance_materialized_decision_still_blank'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const decisionPolicyCoverage = compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy(decisionPolicy, packetPolicy, contentHash);
  const applicationPolicyCoverage = compileAgilityTargetConditionGapDiscoveryReviewDecisionApplicationPolicy(applicationPolicy, decisionPolicy, packetPolicy, contentHash);
  const hashesMatch = policy.inputPacketPolicyContentHash === contentHash(packetPolicy)
    && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy)
    && policy.inputDecisionApplicationPolicyContentHash === contentHash(applicationPolicy);
  const crossBindingsMatch = packetPolicy.outputDomain === policy.inputDomain
    && packetPolicy.recordContract === policy.inputPacketContract
    && decisionPolicy.policy === policy.inputDecisionImportPolicy
    && applicationPolicy.policy === policy.inputDecisionApplicationPolicy;
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidBindings.length && !invalidRules.length && decisionPolicyCoverage.valid
      && applicationPolicyCoverage.valid && hashesMatch && crossBindingsMatch && !forbidden.length,
    invalidBindings,
    invalidRules: unique(invalidRules),
    decisionPolicyCoverage,
    applicationPolicyCoverage,
    hashesMatch,
    crossBindingsMatch,
    forbiddenPolicyPaths: forbidden
  };
}

function decisionOptions(decisionPolicy = {}, applicationPolicy = {}) {
  return (decisionPolicy.allowedDecisions || []).map(decision => {
    const confirmed = decision === 'confirm_source_resolves_named_blocker_only';
    const rejected = decision === 'reject_source_as_insufficient_or_condition_mismatched';
    return {
      decision,
      selected: false,
      recommended: false,
      meaning: confirmed
        ? 'The exact cited source resolves only the packet named blocker.'
        : rejected
          ? 'The exact cited source is insufficient or condition-mismatched for the named blocker.'
          : 'The packet cannot be decided without additional revision-pinned evidence.',
      separateApplicationState: confirmed
        ? applicationPolicy.applicationStates?.confirmed
        : rejected
          ? applicationPolicy.applicationStates?.rejected
          : applicationPolicy.applicationStates?.additionalEvidence,
      namedBlockerWouldCloseAfterSeparateApplication: confirmed,
      expectedNamedBlockersClosedAfterSeparateApplication: confirmed ? 1 : 0,
      additionalEvidenceRequired: !confirmed && !rejected,
      createsExpectedRate: false,
      createsFailureMechanics: false,
      createsGamePerformanceFact: false,
      promotesOptimizerEligibility: false,
      authorizesVerifiedBest: false
    };
  });
}

function earliestAllowedReviewedAt(packet = {}, packetCreatedAt = '') {
  const timestamps = [packetCreatedAt, packet.sourceEvidence?.sourceTimestamp].filter(validIsoTimestamp).map(Date.parse);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function guidanceRecord(packet, template, ordinal, snapshot, policy, decisionPolicy, applicationPolicy, contentHash = hash) {
  const requiredEvidenceKeys = sorted(template.availableEvidenceKeys || []);
  const base = {
    contract: policy.guidanceContract,
    guidanceKey: `${packet.reviewPacketKey}|decision-guidance`,
    guidanceOrdinal: ordinal,
    reviewPacketKey: packet.reviewPacketKey,
    sourcePacketSnapshotContentHash: snapshot.contentHash,
    sourcePacketSnapshotCreatedAt: snapshot.createdAt,
    sourcePacketContentHash: packet.packetContentHash,
    sourcePacketOuterContentHash: packet.contentHash,
    sourceBlankTemplateContentHash: template.contentHash,
    candidateKey: packet.candidateKey,
    candidateName: packet.candidateName,
    targetBaseAgility: packet.targetBaseAgility,
    namedBlocker: packet.namedBlocker,
    relatedOpenBlockers: structuredClone(packet.relatedOpenBlockers || []),
    reviewQuestion: packet.reviewQuestion,
    sourceEvidence: structuredClone(packet.sourceEvidence),
    requiredEvidenceKeys,
    earliestAllowedReviewedAt: earliestAllowedReviewedAt(packet, snapshot.createdAt),
    decisionVocabulary: structuredClone(decisionPolicy.allowedDecisions || []),
    decisionOptions: decisionOptions(decisionPolicy, applicationPolicy),
    reviewerRequirements: {
      reviewerMustIdentifyAHuman: true,
      obviousAutomationModelAndBotNamesRejected: true,
      reviewedAtMustBeIsoUtc: true,
      reviewedAtMustNotPrecede: earliestAllowedReviewedAt(packet, snapshot.createdAt),
      reviewNotesMinimumCharacters: 20,
      selectedEvidenceKeysMustExactlyEqualRequiredEvidenceKeys: true
    },
    blankDecisionTemplate: structuredClone(template),
    selectedDecision: null,
    recommendedDecision: null,
    humanDecisionSelected: false,
    decisionRecorded: false,
    semanticApplicationApplied: false,
    blockersClosed: 0,
    gamePerformanceFactsCreated: 0,
    expectedRateCreated: false,
    failureMechanicsCreated: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false,
    explicitNonClaims: [
      'guidance_does_not_select_or_recommend_a_decision',
      'guidance_does_not_record_or_apply_a_human_review',
      'guidance_does_not_close_the_named_or_related_blockers',
      'guidance_does_not_create_an_expected_rate_or_failure_mechanics',
      'guidance_does_not_establish_candidate_universe_completeness',
      'guidance_does_not_authorize_optimizer_eligibility_or_verified_best'
    ],
    blockers: [
      'explicit_human_target_condition_review_pending',
      'named_and_related_condition_or_mechanics_blockers_remain_open',
      'complete_activity_universe_not_established',
      'optimizer_eligibility_blocked'
    ],
    state: policy.guidanceState
  };
  const withRecordHash = { ...base, recordContentHash: contentHash(base) };
  return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
}

function escapeMarkdown(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function renderMarkdown(records = []) {
  const lines = [
    '# Agility target-condition discovery decision guidance',
    '',
    'This guidance is evidence-bound and intentionally leaves every decision unselected. It does not close a blocker or change recommendation state.',
    ''
  ];
  for (const record of records) {
    lines.push(
      `## ${record.guidanceOrdinal}. ${escapeMarkdown(record.candidateName)}`,
      '',
      `- Named blocker: \`${escapeMarkdown(record.namedBlocker)}\``,
      `- Exact source: [${escapeMarkdown(record.sourceEvidence.sourceTitle)}, revision ${record.sourceEvidence.sourceRevision}](${record.sourceEvidence.exactRevisionUrl})`,
      `- Exact line ${record.sourceEvidence.sourceLine}: ${escapeMarkdown(record.sourceEvidence.exactSourceLine)}`,
      `- Earliest valid review timestamp: \`${record.earliestAllowedReviewedAt}\``,
      `- Required evidence: ${record.requiredEvidenceKeys.map(key => `\`${escapeMarkdown(key)}\``).join(', ')}`,
      '',
      `Review question: ${escapeMarkdown(record.reviewQuestion)}`,
      '',
      'Decision paths — none selected or recommended:',
      ''
    );
    for (const option of record.decisionOptions) {
      lines.push(
        `- \`${option.decision}\`: ${option.meaning}`,
        `  - Named blockers closed after separate guarded application: ${option.expectedNamedBlockersClosedAfterSeparateApplication}`,
        '  - Creates rates, mechanics, optimizer eligibility, or verified-best authority: no'
      );
    }
    lines.push('', 'The reviewer must edit a separate completed decision file. This artifact cannot make that choice.', '');
  }
  return `${lines.join('\n').trim()}\n`;
}

function artifactsFor(records = [], blankTemplateRaw = '', contentHash = hash) {
  const guidanceMarkdown = renderMarkdown(records);
  const guidanceJson = `${JSON.stringify(records, null, 2)}\n`;
  const manifestBase = {
    contract: 'sensum.agility-target-condition-gap-discovery-review-decision-guidance-artifacts.v1',
    guidanceRecordCount: records.length,
    guidanceMarkdown: { file: 'decision-guidance.md', contentHash: contentHash(guidanceMarkdown), bytes: Buffer.byteLength(guidanceMarkdown, 'utf8') },
    guidanceJson: { file: 'decision-guidance.json', contentHash: contentHash(guidanceJson), bytes: Buffer.byteLength(guidanceJson, 'utf8') },
    blankDecisionTemplate: { file: 'decision-template.ndjson', contentHash: contentHash(blankTemplateRaw), bytes: Buffer.byteLength(blankTemplateRaw, 'utf8'), copiedByteForByte: true },
    decisionsSelected: 0,
    decisionsRecommended: 0,
    decisionsRecorded: 0,
    semanticApplications: 0
  };
  const artifactManifest = { ...manifestBase, contentHash: contentHash(manifestBase) };
  const artifactManifestJson = `${JSON.stringify(artifactManifest, null, 2)}\n`;
  return { guidanceMarkdown, guidanceJson, decisionTemplateRaw: blankTemplateRaw, artifactManifest, artifactManifestJson };
}

function validatePacket(options = {}, contentHash = hash) {
  const blankSubmissions = structuredClone(options.blankTemplates || []);
  const replay = buildAgilityTargetConditionGapDiscoveryReviewDecisionImport({
    packetRecords: options.packetRecords || [],
    packetManifest: options.packetManifest || {},
    packetRaw: options.packetRaw || '',
    artifactManifest: options.packetArtifactManifest || {},
    artifactManifestRaw: options.packetArtifactManifestRaw || '',
    reviewMarkdownRaw: options.packetReviewMarkdownRaw || '',
    blankTemplates: options.blankTemplates || [],
    blankTemplateRaw: options.blankTemplateRaw || '',
    submissions: blankSubmissions,
    policy: options.decisionPolicy || {},
    packetPolicy: options.packetPolicy || {},
    contentHash
  });
  const snapshotChecks = {
    explicitSelection: options.packetSnapshot?.explicit === true,
    snapshotMatchesManifest: options.packetSnapshot?.contentHash === options.packetManifest?.contentHash
      && options.packetSnapshot?.createdAt === options.packetManifest?.createdAt,
    manifestAndArtifactsRevalidated: replay.audit?.inputCoverage?.complete === true,
    blankTemplateRejectedAsDecision: replay.audit?.publishable === false
      && replay.audit?.submissionCoverage?.blankDecisionCount === (options.packetRecords || []).length
  };
  return { replay, snapshotChecks, complete: Object.values(snapshotChecks).every(Boolean) };
}

export function auditAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const compiled = compileAgilityTargetConditionGapDiscoveryReviewDecisionGuidancePolicy(
    options.policy, options.packetPolicy, options.decisionPolicy, options.applicationPolicy, contentHash
  );
  const packetValidation = options.packetValidation || validatePacket(options, contentHash);
  const expectedRecords = (options.packetRecords || []).map((packet, index) => guidanceRecord(
    packet,
    options.blankTemplates?.[index] || {},
    index + 1,
    options.packetSnapshot || {},
    options.policy || {},
    options.decisionPolicy || {},
    options.applicationPolicy || {},
    contentHash
  ));
  const expectedArtifacts = artifactsFor(expectedRecords, options.blankTemplateRaw || '', contentHash);
  const artifacts = options.artifacts || expectedArtifacts;
  const recordMismatches = records.map((record, index) => same(record, expectedRecords[index], contentHash) ? null : record.guidanceKey || `row:${index + 1}`).filter(Boolean);
  if (records.length !== expectedRecords.length) recordMismatches.push('guidance_record_count_mismatch');
  const optionMismatches = records.filter(record => !same(record.decisionVocabulary, options.decisionPolicy?.allowedDecisions || [], contentHash)
    || !same(record.decisionOptions, decisionOptions(options.decisionPolicy, options.applicationPolicy), contentHash)).map(record => record.guidanceKey);
  const templateMismatches = records.filter((record, index) => !same(record.blankDecisionTemplate, options.blankTemplates?.[index], contentHash)).map(record => record.guidanceKey);
  const artifactMismatches = ['guidanceMarkdown', 'guidanceJson', 'decisionTemplateRaw', 'artifactManifest', 'artifactManifestJson']
    .filter(key => !same(artifacts[key], expectedArtifacts[key], contentHash));
  const accountFindings = accountStateFindings([...(options.packetRecords || []), ...records]);
  const unsupportedPromotions = records.filter(record => record.selectedDecision !== null || record.recommendedDecision !== null
    || record.humanDecisionSelected !== false || record.decisionRecorded !== false
    || record.semanticApplicationApplied !== false || record.blockersClosed !== 0
    || record.gamePerformanceFactsCreated !== 0 || record.expectedRateCreated !== false
    || record.failureMechanicsCreated !== false || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false || record.decisionOptions?.some(option => option.selected || option.recommended));
  const packetCoverage = {
    packetCount: (options.packetRecords || []).length,
    exactPacketSnapshotRevalidated: packetValidation.complete,
    packetInputIntegrityChecks: packetValidation.replay.audit?.inputCoverage?.checks || {}
  };
  const guidanceCoverage = {
    guidanceRecordCount: records.length,
    expectedGuidanceRecordCount: expectedRecords.length,
    recordMismatches: unique(recordMismatches),
    everyDecisionOptionUnselected: records.every(record => record.decisionOptions?.every(option => option.selected === false && option.recommended === false))
  };
  const bindingCoverage = {
    optionMismatches: unique(optionMismatches),
    blankTemplateMismatches: unique(templateMismatches),
    exactRevisionLineBindings: records.filter(record => record.sourceEvidence?.exactRevisionLineRevalidated === true).length,
    guidanceAndPacketSetsMatch: same(records.map(row => row.reviewPacketKey), (options.packetRecords || []).map(row => row.reviewPacketKey), contentHash)
  };
  const artifactCoverage = {
    artifactMismatches,
    markdownContentHash: contentHash(artifacts.guidanceMarkdown || ''),
    guidanceJsonContentHash: contentHash(artifacts.guidanceJson || ''),
    blankDecisionTemplateContentHash: contentHash(artifacts.decisionTemplateRaw || ''),
    blankTemplateCopiedByteForByte: artifacts.decisionTemplateRaw === options.blankTemplateRaw
  };
  const semanticPreservationCoverage = {
    selectedDecisionCount: records.filter(row => row.selectedDecision !== null).length,
    recommendedDecisionCount: records.filter(row => row.recommendedDecision !== null).length,
    decisionRecordedCount: records.filter(row => row.decisionRecorded === true).length,
    semanticApplicationCount: records.filter(row => row.semanticApplicationApplied === true).length,
    blockersClosed: records.reduce((sum, row) => sum + Number(row.blockersClosed || 0), 0),
    gamePerformanceFactsCreated: records.reduce((sum, row) => sum + Number(row.gamePerformanceFactsCreated || 0), 0),
    optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
    automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length,
    unsupportedPromotions: unsupportedPromotions.map(row => row.guidanceKey || 'unknown')
  };
  const blockers = [];
  if (!compiled.valid) blockers.push('guidance_policy_invalid');
  if (!packetValidation.complete) blockers.push('packet_snapshot_or_artifacts_failed_revalidation');
  if (recordMismatches.length) blockers.push('guidance_records_do_not_exactly_reproduce_packet_projection');
  if (optionMismatches.length) blockers.push('decision_options_do_not_match_guarded_policies');
  if (templateMismatches.length) blockers.push('blank_decision_template_changed');
  if (artifactMismatches.length) blockers.push('guidance_artifacts_do_not_reconstruct_exactly');
  if (accountFindings.length) blockers.push('current_account_state_present');
  if (unsupportedPromotions.length) blockers.push('guidance_selected_recommended_recorded_applied_or_promoted_a_decision');
  const publishable = blockers.length === 0 && records.length > 0;
  return {
    contract: options.policy?.auditContract,
    policyCoverage: compiled,
    packetCoverage,
    guidanceCoverage,
    bindingCoverage,
    artifactCoverage,
    semanticPreservationCoverage,
    accountStateFindings: accountFindings,
    guidanceMaterializationComplete: publishable,
    humanReviewComplete: false,
    semanticApplicationComplete: false,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_pending_explicit_human_review_and_incomplete_agility_coverage',
    blockers: publishable ? [
      'explicit_human_target_condition_review_pending',
      'all_real_target_condition_blockers_remain_open',
      'condition_and_mechanics_coverage_incomplete',
      'complete_activity_universe_not_established'
    ] : unique(blockers),
    publishable
  };
}

export function buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(options = {}) {
  const contentHash = options.contentHash || hash;
  const packetValidation = validatePacket(options, contentHash);
  const compiled = compileAgilityTargetConditionGapDiscoveryReviewDecisionGuidancePolicy(
    options.policy, options.packetPolicy, options.decisionPolicy, options.applicationPolicy, contentHash
  );
  const accountFindings = accountStateFindings(options.packetRecords || []);
  const records = compiled.valid && packetValidation.complete && accountFindings.length === 0
    ? (options.packetRecords || []).map((packet, index) => guidanceRecord(
      packet,
      options.blankTemplates?.[index] || expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision(packet, options.decisionPolicy, contentHash),
      index + 1,
      options.packetSnapshot || {},
      options.policy || {},
      options.decisionPolicy || {},
      options.applicationPolicy || {},
      contentHash
    ))
    : [];
  const artifacts = artifactsFor(records, options.blankTemplateRaw || '', contentHash);
  const audit = auditAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(records, {
    ...options, artifacts, packetValidation, contentHash
  });
  return { records: audit.publishable ? records : [], artifacts, audit };
}
