import { hash } from '../ingestion/lib.mjs';
import {
  boundSourceRevisionsForActivityCandidatePriorityPacket,
  requiredReviewEvidenceKeysForActivityCandidatePriorityPacket
} from './activity-candidate-priority-human-review-decision-import-lib.mjs';
import {
  buildActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence,
  buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplate,
  requiredSupplementalReviewRevisionsForActivityCandidatePriorityConflict
} from './activity-candidate-priority-human-review-decision-import-supplemental-evidence-lib.mjs';

const REQUIRED_RULES = [
  'allFourSnapshotsMustBeExplicitlySelected',
  'allPoliciesManifestsRawRecordsOuterAndIntrinsicHashesMustRevalidate',
  'completePacketToAugmentedGuidanceChainMustRevalidateThroughTheGuardedImporter',
  'oneTemplateMustExistForEachExactAugmentedConflictRecordInSourceOrder',
  'templatesMustBeBuiltOnlyByTheGuardedImporterTemplateBuilder',
  'everyPacketGuidanceEvidenceAndAugmentedGuidanceFingerprintMustRemainExact',
  'originalAndSupplementalEvidenceChannelsMustRemainSeparate',
  'allHumanDecisionReviewAndCitationFieldsMustStartBlank',
  'readableInstructionsMustDescribeEveryRequiredHumanCompletionStep',
  'machineReadableTemplatesInstructionsAndManifestsMustBeDeterministic',
  'untouchedTemplatesMustBeRejectedByTheGuardedImporterWithZeroDecisionRecords',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'humanDecisionSemanticApplicationAndOptimizerPromotionAreForbidden',
  'requirementsVariantsXpTimingAndMechanicsCompletionIsForbidden',
  'currentAccountStateIsForbidden'
];

const EXPECTED_BLANK_IMPORT_BLOCKERS = [
  'no_completed_supplemental_evidence_bound_human_decisions_submitted',
  'recorded_human_decisions_require_separate_semantic_application',
  'remaining_priority_activity_human_decisions_pending',
  'canonical_identity_repeatability_atomicity_and_membership_not_applied',
  'requirements_variants_xp_timing_and_mechanics_not_structured',
  'independent_complete_activity_universe_not_established'
];

const unique = values => [...new Set(values)];
const sorted = values => [...(values || [])].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|route|routes|label|labels|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|route|label|alias).*(?:override|exception)s?$/i;
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

export function compileActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterializationPolicy(
  policy = {}, packetPolicy = {}, guidancePolicy = {}, additionalEvidencePolicy = {}, augmentedGuidancePolicy = {},
  supplementalImporterPolicy = {}, decisionPolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidBindings = [];
  const exact = (actualId, expectedId, actualHash, expectedPolicy) => actualId === expectedId && actualHash === contentHash(expectedPolicy);
  if (policy.policy !== 'sensum.activity-candidate-priority-source-conflict-supplemental-evidence-decision-template-materialization-policy.v1') invalidBindings.push('policy');
  if (!exact(policy.inputPacketPolicy, packetPolicy.policy, policy.inputPacketPolicyContentHash, packetPolicy)) invalidBindings.push('inputPacketPolicy');
  if (!exact(policy.inputGuidancePolicy, guidancePolicy.policy, policy.inputGuidancePolicyContentHash, guidancePolicy)) invalidBindings.push('inputGuidancePolicy');
  if (!exact(policy.inputAdditionalEvidencePolicy, additionalEvidencePolicy.policy, policy.inputAdditionalEvidencePolicyContentHash, additionalEvidencePolicy)) invalidBindings.push('inputAdditionalEvidencePolicy');
  if (!exact(policy.inputAugmentedGuidancePolicy, augmentedGuidancePolicy.policy, policy.inputAugmentedGuidancePolicyContentHash, augmentedGuidancePolicy)) invalidBindings.push('inputAugmentedGuidancePolicy');
  if (!exact(policy.inputSupplementalDecisionImportPolicy, supplementalImporterPolicy.policy, policy.inputSupplementalDecisionImportPolicyContentHash, supplementalImporterPolicy)) invalidBindings.push('inputSupplementalDecisionImportPolicy');
  if (!exact(policy.inputDecisionImportPolicy, decisionPolicy.policy, policy.inputDecisionImportPolicyContentHash, decisionPolicy)) invalidBindings.push('inputDecisionImportPolicy');
  if (policy.inputPacketDomain !== supplementalImporterPolicy.inputPacketDomain
    || policy.inputGuidanceDomain !== supplementalImporterPolicy.inputGuidanceDomain
    || policy.inputAdditionalEvidenceDomain !== supplementalImporterPolicy.inputAdditionalEvidenceDomain
    || policy.inputAugmentedGuidanceDomain !== supplementalImporterPolicy.inputAugmentedGuidanceDomain) invalidBindings.push('inputDomains');
  if (policy.templateContract !== supplementalImporterPolicy.submissionContract
    || policy.recordContract !== 'sensum.activity-candidate-priority-source-conflict-supplemental-evidence-decision-template-materialization.v1'
    || policy.auditContract !== 'sensum.activity-candidate-priority-source-conflict-supplemental-evidence-decision-template-materialization-audit.v1'
    || !policy.outputDomain || !policy.recordState) invalidBindings.push('contractsOrOutput');
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidRules.length && !invalidBindings.length && !forbidden.length,
    invalidRules: unique(invalidRules),
    invalidBindings,
    forbiddenPolicyPaths: forbidden
  };
}

function completionInstructions() {
  return [
    { step: 1, action: 'Do not edit identity, contract, snapshot, record, outer-hash, or template-binding fields.' },
    { step: 2, action: 'Review the original packet evidence and complete every baseDecision decision, evidence-domain, evidence-key, revision, reviewer, timestamp, and notes field.' },
    { step: 3, action: 'Keep original evidence only in baseDecision.reviewEvidenceKeys and use every required original evidence key and source revision.' },
    { step: 4, action: 'Review the separately bound field-semantics, taxonomy, and candidate-revalidation evidence.' },
    { step: 5, action: 'Copy every required supplemental evidence key and source revision into supplementalEvidenceReview; do not copy them into baseDecision.' },
    { step: 6, action: 'Add human-authored supplemental review notes and use a reviewedAt timestamp no earlier than every bound evidence timestamp.' },
    { step: 7, action: 'Submit the entire NDJSON file through the supplemental-evidence guarded importer; partial rows, automated reviewers, stale bindings, and unsupported promotions reject the batch.' }
  ];
}

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests|currentBaseLevel|targetBaseLevel|currentLevel|currentXp)$/i;
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

function blankTemplateProof(audit = {}, expectedCount = 0) {
  const input = audit.inputCoverage || {};
  const submissions = audit.submissionCoverage || {};
  const semantics = audit.semanticPreservationCoverage || {};
  const checks = {
    importerRejected: audit.publishable === false && audit.supplementalEvidenceBoundDecisionRecordingComplete === false,
    allFourSnapshotsRevalidated: input.packetSnapshotAssessment?.complete === true
      && input.guidanceSnapshotAssessment?.complete === true
      && input.additionalEvidenceSnapshotAssessment?.complete === true
      && input.augmentedGuidanceSnapshotAssessment?.complete === true,
    augmentedChainRebuiltExactly: input.rebuiltAugmentedGuidancePublishable === true
      && input.augmentedGuidanceSetAndOrderExact === true
      && input.augmentedGuidanceMismatches?.length === 0 && input.augmentedGuidanceAuditValid === true,
    decisionFileBoundExactly: input.decisionFileAssessment?.complete === true,
    everyTemplateRecognizedBlank: submissions.submissionRowCount === expectedCount
      && submissions.blankSubmissionCount === expectedCount && submissions.completedSubmissionCount === 0
      && submissions.invalidSubmissionCount === 0 && submissions.duplicateSubmissionKeys?.length === 0,
    zeroDecisionRecords: audit.recordCoverage?.recordedDecisionCount === 0,
    zeroSemanticOrOptimizerPromotions: semantics.semanticApplicationCount === 0 && semantics.appliedIdentityCount === 0
      && semantics.appliedRepeatabilityAtomicityOrMembershipCount === 0
      && semantics.requirementsVariantsXpTimingAndMechanicsCompleteCount === 0
      && semantics.optimizerEligibleCount === 0 && semantics.automaticVerificationCount === 0
      && semantics.unsupportedPromotions?.length === 0,
    expectedBlockerSetExact: same(sorted(audit.blockers || []), sorted(EXPECTED_BLANK_IMPORT_BLOCKERS))
  };
  return { checks, complete: Object.values(checks).every(Boolean), blockers: [...(audit.blockers || [])] };
}

function derive(context) {
  const contentHash = context.contentHash || hash;
  const compiled = compileActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterializationPolicy(
    context.policy, context.packetPolicy, context.guidancePolicy, context.additionalEvidencePolicy,
    context.augmentedGuidancePolicy, context.supplementalImporterPolicy, context.decisionPolicy, contentHash
  );
  const packetByKey = new Map((context.packetRecords || []).map(record => [record.reviewPacketKey, record]));
  const evidenceByKey = new Map((context.additionalEvidenceRecords || []).map(record => [record.reviewPacketKey, record]));
  const instructions = completionInstructions();
  const records = (context.augmentedGuidanceRecords || []).map((augmented, index) => {
    const packet = packetByKey.get(augmented.reviewPacketKey);
    const evidence = evidenceByKey.get(augmented.reviewPacketKey);
    const template = buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplate(
      augmented, evidence, context.augmentedGuidanceSnapshot?.contentHash
    );
    const base = {
      contract: context.policy?.recordContract,
      templateMaterializationKey: `${augmented.augmentedGuidanceKey}|supplemental-evidence-bound-blank-template`,
      templateOrdinal: index + 1,
      candidateKey: augmented.candidateKey,
      reviewPacketKey: augmented.reviewPacketKey,
      augmentedGuidanceKey: augmented.augmentedGuidanceKey,
      sourceBindings: {
        packetSnapshotContentHash: context.packetSnapshot?.contentHash,
        guidanceSnapshotContentHash: context.guidanceSnapshot?.contentHash,
        additionalEvidenceSnapshotContentHash: context.additionalEvidenceSnapshot?.contentHash,
        augmentedGuidanceSnapshotContentHash: context.augmentedGuidanceSnapshot?.contentHash,
        packetRecordContentHash: packet?.recordContentHash,
        packetOuterContentHash: packet?.contentHash,
        guidanceRecordContentHash: augmented.sourceBindings?.guidanceRecordContentHash,
        guidanceOuterContentHash: augmented.sourceBindings?.guidanceOuterContentHash,
        additionalEvidenceRecordContentHash: evidence?.recordContentHash,
        additionalEvidenceOuterContentHash: evidence?.contentHash,
        augmentedGuidanceRecordContentHash: augmented.recordContentHash,
        augmentedGuidanceOuterContentHash: augmented.contentHash
      },
      humanCompletionInstructions: structuredClone(instructions),
      requiredOriginalEvidenceKeys: packet ? requiredReviewEvidenceKeysForActivityCandidatePriorityPacket(packet) : [],
      requiredSupplementalEvidenceKeys: [...(augmented.supplementalEvidence?.supplementalReviewEvidenceKeys || [])],
      requiredOriginalSourceRevisions: packet ? boundSourceRevisionsForActivityCandidatePriorityPacket(packet) : [],
      requiredSupplementalSourceRevisions: evidence ? requiredSupplementalReviewRevisionsForActivityCandidatePriorityConflict(evidence) : [],
      blankDecisionTemplate: template,
      blankDecisionTemplateContentHash: contentHash(template),
      humanDecisionSelected: false,
      decisionRecorded: false,
      semanticApplicationApplied: false,
      requirementsVariantsXpTimingAndMechanicsComplete: false,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      state: context.policy?.recordState
    };
    return { ...base, recordContentHash: contentHash(base) };
  });
  const decisionTemplateNdjson = records.map(record => JSON.stringify(record.blankDecisionTemplate)).join('\n') + (records.length ? '\n' : '');
  const importer = buildActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence({
    ...context,
    policy: context.supplementalImporterPolicy,
    submissions: records.map(record => record.blankDecisionTemplate),
    decisionFile: {
      explicit: true,
      file: 'decision-templates.ndjson',
      contentHash: contentHash(decisionTemplateNdjson),
      rows: records.length
    },
    contentHash
  });
  return { compiled, records, decisionTemplateNdjson, importer, blankProof: blankTemplateProof(importer.audit, records.length) };
}

function markdownFor(records = []) {
  const lines = [
    '# Priority activity source-conflict review templates', '',
    'These templates are blank by design. Their bindings are machine generated and must not be edited.',
    'Completing a template records a human review decision only; it does not apply semantics or make the candidate optimizer eligible.', ''
  ];
  for (const record of records) {
    lines.push(`## ${record.templateOrdinal}. ${record.blankDecisionTemplate.candidateKey}`, '');
    lines.push(`- Review packet: \`${record.reviewPacketKey}\``);
    lines.push(`- Augmented guidance: \`${record.augmentedGuidanceKey}\``);
    lines.push(`- Template hash: \`${record.blankDecisionTemplateContentHash}\``, '');
    lines.push('### Required completion sequence', '');
    for (const item of record.humanCompletionInstructions) lines.push(`${item.step}. ${item.action}`);
    lines.push('', '### Original evidence keys', '');
    for (const key of record.requiredOriginalEvidenceKeys) lines.push(`- \`${key}\``);
    lines.push('', '### Supplemental evidence keys', '');
    for (const key of record.requiredSupplementalEvidenceKeys) lines.push(`- \`${key}\``);
    lines.push('', `Original revisions: ${record.requiredOriginalSourceRevisions.map(value => `\`${value}\``).join(', ')}`);
    lines.push(`Supplemental revisions: ${record.requiredSupplementalSourceRevisions.map(value => `\`${value}\``).join(', ')}`, '');
  }
  return lines.join('\n') + '\n';
}

export function buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterializationArtifacts(records = [], contentHash = hash) {
  const markdown = markdownFor(records);
  const decisionTemplateNdjson = records.map(record => JSON.stringify(record.blankDecisionTemplate)).join('\n') + (records.length ? '\n' : '');
  const templateIndexJson = JSON.stringify(records.map(record => ({
    templateOrdinal: record.templateOrdinal,
    templateMaterializationKey: record.templateMaterializationKey,
    candidateKey: record.candidateKey,
    reviewPacketKey: record.reviewPacketKey,
    augmentedGuidanceKey: record.augmentedGuidanceKey,
    blankDecisionTemplateContentHash: record.blankDecisionTemplateContentHash,
    sourceBindings: record.sourceBindings
  })), null, 2) + '\n';
  const manifest = {
    contract: 'sensum.activity-candidate-priority-source-conflict-supplemental-evidence-decision-template-artifact-manifest.v1',
    records: records.length,
    artifacts: [
      { file: 'review-instructions.md', kind: 'human_readable_completion_instructions', contentHash: contentHash(markdown), bytes: Buffer.byteLength(markdown, 'utf8') },
      { file: 'decision-templates.ndjson', kind: 'guarded_importer_compatible_blank_templates', contentHash: contentHash(decisionTemplateNdjson), bytes: Buffer.byteLength(decisionTemplateNdjson, 'utf8') },
      { file: 'template-index.json', kind: 'machine_readable_binding_index', contentHash: contentHash(templateIndexJson), bytes: Buffer.byteLength(templateIndexJson, 'utf8') }
    ]
  };
  const artifactManifestJson = JSON.stringify(manifest, null, 2) + '\n';
  return { markdown, decisionTemplateNdjson, templateIndexJson, artifactManifest: manifest, artifactManifestJson };
}

export function auditActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterialization(records = [], context = {}, artifacts = null) {
  const completeContext = { ...context, contentHash: context.contentHash || hash };
  const derived = derive(completeContext);
  const expectedByKey = new Map(derived.records.map(record => [record.templateMaterializationKey, record]));
  const expectedKeys = derived.records.map(record => record.templateMaterializationKey);
  const actualKeys = records.map(record => record.templateMaterializationKey);
  const duplicateKeys = duplicates(actualKeys);
  const recordMismatches = records.filter(record => !expectedByKey.has(record.templateMaterializationKey)
    || !same(record, expectedByKey.get(record.templateMaterializationKey), completeContext.contentHash))
    .map(record => record.templateMaterializationKey || 'unknown');
  const setOrderAndOrdinalsExact = !duplicateKeys.length && same(actualKeys, expectedKeys, completeContext.contentHash)
    && records.every((record, index) => record.templateOrdinal === index + 1);
  const templateMismatches = records.filter(record => record.blankDecisionTemplateContentHash !== completeContext.contentHash(record.blankDecisionTemplate)
    || record.blankDecisionTemplate?.contract !== completeContext.policy?.templateContract
    || !same(record.blankDecisionTemplate, expectedByKey.get(record.templateMaterializationKey)?.blankDecisionTemplate, completeContext.contentHash))
    .map(record => record.templateMaterializationKey || 'unknown');
  const expectedArtifacts = buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterializationArtifacts(records, completeContext.contentHash);
  const artifactMismatches = [];
  if (!artifacts) artifactMismatches.push('artifacts_missing');
  else {
    if (!same(artifacts.markdown, expectedArtifacts.markdown, completeContext.contentHash)) artifactMismatches.push('review_instructions');
    if (!same(artifacts.decisionTemplateNdjson, expectedArtifacts.decisionTemplateNdjson, completeContext.contentHash)) artifactMismatches.push('decision_templates');
    if (!same(artifacts.templateIndexJson, expectedArtifacts.templateIndexJson, completeContext.contentHash)) artifactMismatches.push('template_index');
    if (!same(artifacts.artifactManifestJson, expectedArtifacts.artifactManifestJson, completeContext.contentHash)) artifactMismatches.push('artifact_manifest');
  }
  const unsupportedPromotions = records.filter(record => record.humanDecisionSelected !== false || record.decisionRecorded !== false
    || record.semanticApplicationApplied !== false || record.requirementsVariantsXpTimingAndMechanicsComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false || record.accountIndependent !== true)
    .map(record => record.templateMaterializationKey || 'unknown');
  const accountFindings = accountStateFindings(records);
  const structuralBlockers = [];
  if (!derived.compiled.valid) structuralBlockers.push('template_materialization_policy_invalid_or_not_exactly_bound');
  if (!derived.blankProof.complete) structuralBlockers.push('guarded_importer_did_not_revalidate_and_reject_untouched_templates_exactly');
  if (!setOrderAndOrdinalsExact || recordMismatches.length || templateMismatches.length) structuralBlockers.push('template_record_set_order_binding_or_content_mismatch');
  if (records.length !== (context.augmentedGuidanceRecords || []).length) structuralBlockers.push('one_template_per_augmented_conflict_record_not_proven');
  if (artifactMismatches.length) structuralBlockers.push('template_artifacts_missing_or_not_deterministic');
  if (unsupportedPromotions.length) structuralBlockers.push('template_materialization_selected_a_decision_or_applied_semantic_optimizer_state');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = !structuralBlockers.length;
  return {
    contract: context.policy?.auditContract,
    policyCoverage: derived.compiled,
    inputCoverage: derived.importer.audit.inputCoverage,
    templateCoverage: {
      augmentedConflictRecordCount: (context.augmentedGuidanceRecords || []).length,
      templateRecordCount: records.length,
      setOrderAndOrdinalsExact,
      duplicateTemplateKeys: duplicateKeys,
      recordMismatches,
      templateMismatches,
      requiredOriginalEvidenceKeyCount: records.reduce((sum, record) => sum + record.requiredOriginalEvidenceKeys.length, 0),
      requiredSupplementalEvidenceKeyCount: records.reduce((sum, record) => sum + record.requiredSupplementalEvidenceKeys.length, 0),
      requiredOriginalSourceRevisionCount: records.reduce((sum, record) => sum + record.requiredOriginalSourceRevisions.length, 0),
      requiredSupplementalSourceRevisionCount: records.reduce((sum, record) => sum + record.requiredSupplementalSourceRevisions.length, 0),
      instructionStepCount: records.reduce((sum, record) => sum + record.humanCompletionInstructions.length, 0)
    },
    artifactCoverage: {
      artifactCount: artifacts ? 4 : 0,
      artifactManifestEntryCount: artifacts?.artifactManifest?.artifacts?.length || 0,
      artifactMismatches,
      deterministicArtifactReconstructionComplete: Boolean(artifacts) && !artifactMismatches.length
    },
    guardedImporterBlankRejectionCoverage: {
      ...derived.blankProof,
      decisionRecordsProduced: derived.importer.records.length,
      importerPublishable: derived.importer.audit.publishable,
      blankTemplateCount: derived.importer.audit.submissionCoverage?.blankSubmissionCount || 0,
      invalidTemplateCount: derived.importer.audit.submissionCoverage?.invalidSubmissionCount || 0
    },
    semanticPreservationCoverage: {
      humanDecisionSelectedCount: records.filter(record => record.humanDecisionSelected).length,
      decisionRecordedCount: records.filter(record => record.decisionRecorded).length,
      semanticApplicationCount: records.filter(record => record.semanticApplicationApplied).length,
      requirementsVariantsXpTimingAndMechanicsCompleteCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    templateMaterializationComplete: publishable && records.length > 0,
    humanReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'supplemental_evidence_bound_human_decisions_not_yet_recorded',
      'canonical_identity_repeatability_atomicity_and_membership_not_applied',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterialization(context = {}) {
  const completeContext = { ...context, contentHash: context.contentHash || hash };
  const derived = derive(completeContext);
  const artifacts = buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterializationArtifacts(derived.records, completeContext.contentHash);
  const audit = auditActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterialization(derived.records, completeContext, artifacts);
  return { records: derived.records, artifacts, audit };
}
