import { hash, json } from '../ingestion/lib.mjs';
import { compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy } from './activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-lib.mjs';
import {
  buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport,
  compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy,
  expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision
} from './activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-lib.mjs';

const REQUIRED_RULES = [
  'queueSnapshotAndBlankTemplateArtifactMustBeExplicitlySelected',
  'queueManifestPolicyArtifactRawOuterIntrinsicAndEvidenceHashesMustRevalidate',
  'queueAndDecisionImporterPoliciesMustBindExactly',
  'oneGuidanceRecordPerQueueEntryInQueueOrder',
  'everyGuidanceRecordMustExposeTheExactCandidateRevisionAndEvidenceFingerprint',
  'everyGuidanceRecordMustExposeOnlyImporterAllowedDispositionsAndExactCoherencePaths',
  'minimumEvidenceSelectionMustBeAProvenExactSetCoverOfAllRequiredReviewObligations',
  'minimumEvidenceSelectionIsAnUnselectedCoverageExampleNotAReviewConclusion',
  'reviewerAndTimestampRequirementsMustMirrorTheImporter',
  'blankDecisionTemplatesMustRemainByteEquivalentToTheQueueArtifact',
  'artifactsMustBeCompleteContentAddressedAndDeterministic',
  'guidanceCannotSelectRecommendRecordInferOrApplyAReviewDecision',
  'guidanceCannotEstablishCanonicalIdentityRepeatabilityMembershipRequirementsVariantsXpTimingMechanicsCompleteUniverseOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash({ value: left }) === contentHash({ value: right });
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === (value.includes('.') ? value : value.replace(/Z$/, '.000Z'));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|route|routes|label|labels|alias|aliases|override|overrides|exception|exceptions)$/i;
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

export function compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidancePolicy(
  policy = {}, queuePolicy = {}, decisionPolicy = {}, routingPolicy = {}, oneHopPolicy = {}, recursivePolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const queuePolicyCoverage = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy(
    queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash
  );
  const decisionPolicyCoverage = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy(
    decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash
  );
  const contractsValid = policy.policy === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-policy.v1'
    && policy.inputQueuePolicy === queuePolicy.policy && policy.inputQueuePolicyContentHash === contentHash(queuePolicy)
    && policy.inputDecisionImportPolicy === decisionPolicy.policy && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy)
    && policy.inputDomain === queuePolicy.outputDomain && policy.queueContract === queuePolicy.queueContract
    && policy.decisionTemplateContract === queuePolicy.decisionTemplateContract
    && policy.guidanceContract === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance.v1'
    && policy.auditContract === 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-audit.v1'
    && policy.outputDomain === 'activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance';
  const stateValid = policy.guidanceState === 'source_bound_subject_boundary_human_review_guidance_materialized_decision_still_blank';
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && stateValid && queuePolicyCoverage.valid && decisionPolicyCoverage.valid
      && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid, stateValid, queuePolicyCoverage, decisionPolicyCoverage,
    invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden
  };
}

function collectTimestamps(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach(child => collectTimestamps(child, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:timestamp|observedAt|createdAt|generatedAt)$/i.test(key) && validIsoTimestamp(child)) result.push(child);
    else collectTimestamps(child, result);
  }
  return result;
}

function earliestAllowedReviewedAt(queue, queueSnapshotCreatedAt) {
  const values = [...collectTimestamps(queue), queueSnapshotCreatedAt].filter(validIsoTimestamp).map(Date.parse);
  return values.length ? new Date(Math.max(...values)).toISOString() : null;
}

function dispositionCoherenceMatrix() {
  return [
    {
      subjectDisposition: 'confirm_single_activity_subject', selected: false,
      compositeOrContainerVerdict: false, memberExpansionRequired: false,
      additionalEvidenceRequired: false, rejectionReason: null
    },
    {
      subjectDisposition: 'confirm_composite_or_container_subject', selected: false,
      compositeOrContainerVerdict: true, memberExpansionRequired: true,
      additionalEvidenceRequired: false, rejectionReason: null
    },
    {
      subjectDisposition: 'confirm_reference_collection_subject', selected: false,
      compositeOrContainerVerdict: true, memberExpansionRequired: true,
      additionalEvidenceRequired: false, rejectionReason: null
    },
    {
      subjectDisposition: 'reject_as_activity_subject', selected: false,
      compositeOrContainerVerdict: false, memberExpansionRequired: false,
      additionalEvidenceRequired: false, rejectionReason: 'required_meaningful_text_at_least_20_characters'
    },
    {
      subjectDisposition: 'needs_additional_evidence', selected: false,
      compositeOrContainerVerdict: null, memberExpansionRequired: null,
      additionalEvidenceRequired: true, rejectionReason: null
    }
  ];
}

function exactMinimumEvidenceSetCover(obligations = []) {
  const required = obligations.filter(row => row.required === true);
  if (!required.length) return null;
  const keys = sorted(unique(required.flatMap(row => row.evidenceKeys || [])));
  const coverage = new Map(keys.map(key => [key, required.reduce((mask, row, index) =>
    row.evidenceKeys.includes(key) ? mask | (1 << index) : mask, 0)]));
  const fullMask = (1 << required.length) - 1;
  const best = new Map([[0, []]]);
  const better = (candidate, current) => !current || candidate.length < current.length
    || (candidate.length === current.length && candidate.join('\u0000').localeCompare(current.join('\u0000')) < 0);
  for (const key of keys) {
    for (const [mask, selected] of [...best.entries()]) {
      const nextMask = mask | coverage.get(key);
      const candidate = [...selected, key];
      if (better(candidate, best.get(nextMask))) best.set(nextMask, candidate);
    }
  }
  const selected = best.get(fullMask);
  if (!selected) return null;
  return {
    selected: false,
    exactMinimumKeyCount: selected.length,
    coverageExampleKeys: selected,
    coverageByKey: selected.map(key => ({
      evidenceKey: key,
      coveredReviewObligationKeys: required.filter(row => row.evidenceKeys.includes(key)).map(row => row.obligationKey)
    })),
    coveredReviewObligationKeys: required.map(row => row.obligationKey),
    proofMethod: 'exact_dynamic_programming_set_cover_over_all_required_obligations',
    statement: 'This is a deterministic minimum field-validity coverage example, not a selected evidence set and not a conclusion that the cited evidence is semantically sufficient.'
  };
}

function guidanceRecord(queue, blankTemplate, snapshot, policy, contentHash = hash) {
  const minimumEvidenceSelection = exactMinimumEvidenceSetCover(queue.reviewObligations || []);
  const earliestReview = earliestAllowedReviewedAt(queue, snapshot.createdAt);
  const base = {
    contract: policy.guidanceContract,
    guidanceKey: `${queue.queueEntryKey}|human-review-guidance`,
    guidanceOrdinal: queue.queueOrdinal,
    queueEntryKey: queue.queueEntryKey,
    candidateKey: queue.candidateKey,
    sourceQueueSnapshotContentHash: snapshot.contentHash,
    sourceQueueSnapshotCreatedAt: snapshot.createdAt,
    sourceQueueRecordContentHash: queue.recordContentHash,
    sourceQueueOuterContentHash: queue.contentHash,
    sourceBlankTemplateContentHash: contentHash(blankTemplate),
    sourcePageIdentity: structuredClone(queue.sourcePageIdentity),
    sourceExactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${queue.sourcePageIdentity.sourceRevision}`,
    sourceBindings: structuredClone(queue.sourceBindings),
    evidenceFingerprint: queue.evidenceFingerprint,
    allowedSubjectDispositions: structuredClone(queue.allowedSubjectDispositions),
    dispositionCoherenceMatrix: dispositionCoherenceMatrix(),
    reviewObligationGuidance: (queue.reviewObligations || []).map((row, index) => ({
      obligationOrdinal: index + 1,
      obligationKey: row.obligationKey,
      question: row.question,
      required: row.required,
      allowedEvidenceKeyCount: row.evidenceKeys.length,
      exactEvidenceKeyPath: `queue.reviewObligations[${index}].evidenceKeys`,
      atLeastOneBoundKeyMustBeSelected: true
    })),
    minimumEvidenceSelection,
    reviewerRequirements: {
      everyQueueEntryMustBeCompletedInOneBatch: true,
      reviewerMustIdentifyAHuman: true,
      obviousAutomationModelAndBotNamesRejected: true,
      reviewedAtMustBeIsoUtc: true,
      reviewedAtMustNotPrecede: earliestReview,
      notesMinimumCharacters: 20,
      selectedEvidenceKeysMustBeUniqueAndBound: true,
      everyRequiredReviewObligationMustBeCovered: true,
      submissionFieldSetMustExactlyMatchBlankTemplate: true
    },
    blankDecisionTemplate: structuredClone(blankTemplate),
    explicitNonClaims: [
      'guidance_does_not_select_recommend_record_infer_or_apply_a_subject_disposition',
      'minimum_evidence_selection_is_only_a_field_validity_set_cover_example',
      'template_structure_and_static_ancestry_are_not_rendered_output_attribution',
      'canonical_game_entity_and_activity_identity_are_not_established',
      'repeatability_membership_and_variant_scope_are_not_established',
      'requirements_variants_xp_timing_and_mechanics_are_not_established',
      'complete_activity_universe_is_not_established',
      'account_state_is_not_evaluated',
      'optimizer_eligibility_and_verified_best_are_not_authorized'
    ],
    humanDecisionSelected: false,
    evidenceSelectionApplied: false,
    decisionRecorded: false,
    semanticApplicationApplied: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    membershipOrVariantApplication: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: [
      'explicit_source_bound_subject_boundary_human_review_pending',
      'dynamic_or_engine_expansion_boundaries_unresolved',
      'complete_rendered_output_attribution_not_established',
      'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved',
      'independent_complete_activity_universe_not_established'
    ],
    state: policy.guidanceState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function markdownEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

export function renderActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidanceMarkdown(records = []) {
  const lines = [
    '# Missing-supported-infobox subject-boundary human-review guidance', '',
    'This packet explains how to complete the guarded decision templates. It selects no decision or evidence and applies no semantic state.', '',
    'All queue rows must be completed together. One blank, partial, stale, duplicated, unbound, automated, or incoherent row rejects the entire import.', ''
  ];
  for (const record of records) {
    lines.push(`## ${record.guidanceOrdinal}. ${markdownEscape(record.sourcePageIdentity.resolvedTitle)}`, '');
    lines.push(`- Exact revision: [${record.sourcePageIdentity.sourceRevision}](${record.sourceExactRevisionUrl})`);
    lines.push(`- Candidate: \`${markdownEscape(record.candidateKey)}\``);
    lines.push(`- Evidence fingerprint: \`${record.evidenceFingerprint}\``);
    lines.push(`- Earliest permitted review time: \`${record.reviewerRequirements.reviewedAtMustNotPrecede}\``, '');
    lines.push('### Allowed coherent field combinations', '');
    lines.push('| Disposition | Composite/container | Expand members | More evidence | Rejection reason |', '|---|---:|---:|---:|---|');
    for (const row of record.dispositionCoherenceMatrix) {
      lines.push(`| \`${row.subjectDisposition}\` | ${String(row.compositeOrContainerVerdict)} | ${String(row.memberExpansionRequired)} | ${String(row.additionalEvidenceRequired)} | ${row.rejectionReason || 'null'} |`);
    }
    lines.push('', '### Required evidence obligations', '');
    for (const row of record.reviewObligationGuidance) lines.push(`- **${markdownEscape(row.obligationKey)}:** ${markdownEscape(row.question)} (${row.allowedEvidenceKeyCount} bound keys; choose at least one).`);
    lines.push('', `Exact minimum set-cover size: **${record.minimumEvidenceSelection.exactMinimumKeyCount}**`, '');
    for (const row of record.minimumEvidenceSelection.coverageByKey) lines.push(`- \`${markdownEscape(row.evidenceKey)}\` covers: ${row.coveredReviewObligationKeys.map(markdownEscape).join(', ')}`);
    lines.push('', `> ${record.minimumEvidenceSelection.statement}`, '');
    lines.push('### Nonclaims', '');
    for (const item of record.explicitNonClaims) lines.push(`- ${markdownEscape(item)}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function buildArtifacts(records, blankTemplateRaw, contentHash = hash) {
  const guidanceMarkdown = renderActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidanceMarkdown(records);
  const guidanceIndex = `${JSON.stringify(records.map(row => ({
    guidanceKey: row.guidanceKey,
    queueEntryKey: row.queueEntryKey,
    candidateKey: row.candidateKey,
    sourcePageIdentity: row.sourcePageIdentity,
    evidenceFingerprint: row.evidenceFingerprint,
    dispositionCount: row.dispositionCoherenceMatrix.length,
    reviewObligationCount: row.reviewObligationGuidance.length,
    exactMinimumEvidenceKeyCount: row.minimumEvidenceSelection.exactMinimumKeyCount,
    earliestAllowedReviewedAt: row.reviewerRequirements.reviewedAtMustNotPrecede,
    decisionSelected: false
  })), null, 2)}\n`;
  const checklist = [
    '# Subject-boundary decision submission checklist', '',
    '1. Review the exact source revision and the queue evidence for every row.',
    '2. Choose exactly one allowed disposition and copy its dependent-field combination exactly.',
    '3. Select only bound evidence keys and cover every required review obligation.',
    '4. Enter a human reviewer, an ISO UTC review time no earlier than the stated boundary, and meaningful notes.',
    '5. Complete every queue row in one file. Do not add, remove, or rename fields.',
    '6. Run the guarded importer. A rejected batch writes no decision snapshot.', '',
    'The included decision-template.ndjson is intentionally blank and byte-equivalent to the queue artifact.'
  ].join('\n') + '\n';
  const artifacts = [
    { file: 'review-guidance.md', kind: 'human_readable_subject_boundary_decision_guidance', contentHash: contentHash(guidanceMarkdown), bytes: Buffer.byteLength(guidanceMarkdown, 'utf8') },
    { file: 'guidance-index.json', kind: 'machine_readable_subject_boundary_guidance_index', contentHash: contentHash(guidanceIndex), bytes: Buffer.byteLength(guidanceIndex, 'utf8') },
    { file: 'submission-checklist.md', kind: 'guarded_subject_boundary_submission_checklist', contentHash: contentHash(checklist), bytes: Buffer.byteLength(checklist, 'utf8') },
    { file: 'decision-template.ndjson', kind: 'byte_equivalent_blank_subject_boundary_decision_templates', contentHash: contentHash(blankTemplateRaw), bytes: Buffer.byteLength(blankTemplateRaw, 'utf8') }
  ];
  const artifactManifest = { contract: 'sensum.content-addressed-artifact-manifest.v1', artifacts };
  return { guidanceMarkdown, guidanceIndex, checklist, decisionTemplateNdjson: blankTemplateRaw, artifactManifest, artifactManifestJson: `${JSON.stringify(artifactManifest, null, 2)}\n` };
}

function inputAssessment(input, compiled, contentHash = hash) {
  const { queueRecords = [], queueRaw = '', queueManifest = {}, artifactManifest = {}, blankTemplates = [], blankTemplateRaw = '', decisionPolicy = {}, queuePolicy = {} } = input;
  const templateArtifact = (artifactManifest.artifacts || []).find(row => row.file === 'decision-template.ndjson');
  const importerDryRun = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport({
    queueRecords, blankTemplates, submissions: blankTemplates, policy: decisionPolicy, queuePolicy,
    routingPolicy: input.routingPolicy, oneHopPolicy: input.oneHopPolicy, recursivePolicy: input.recursivePolicy,
    queueSnapshotContentHash: queueManifest.contentHash, queueSnapshotCreatedAt: queueManifest.createdAt, contentHash
  });
  const checks = {
    explicitQueueSnapshotSelected: input.queueSnapshot?.explicit === true && validHash(input.queueSnapshot.contentHash) && validIsoTimestamp(input.queueSnapshot.createdAt),
    manifestContractDomainCountAndRawHashMatch: queueManifest.contract === 'sensum.ingestion-manifest.v1'
      && queueManifest.domain === input.policy.inputDomain && queueManifest.records === queueRecords.length
      && queueManifest.contentHash === contentHash(queueRaw),
    selectedSnapshotMatchesManifest: input.queueSnapshot?.contentHash === queueManifest.contentHash && input.queueSnapshot?.createdAt === queueManifest.createdAt,
    manifestPolicyBindingMatches: queueManifest.source?.policy?.id === queuePolicy.policy && queueManifest.source?.policy?.contentHash === contentHash(queuePolicy),
    manifestAuditGatesMatch: queueManifest.source?.audit?.contract === queuePolicy.auditContract
      && queueManifest.source?.audit?.queueExportComplete === true
      && queueManifest.source?.audit?.subjectBoundaryReviewComplete === false
      && queueManifest.source?.audit?.completeActivityUniverse === false
      && queueManifest.source?.audit?.semanticPreservationCoverage?.humanDecisionRecordedCount === 0
      && queueManifest.source?.audit?.semanticPreservationCoverage?.optimizerEligibleCount === 0
      && queueManifest.source?.audit?.semanticPreservationCoverage?.automaticVerificationCount === 0
      && queueManifest.source?.audit?.publishable === true,
    artifactManifestAndTemplateHashMatch: artifactManifest.contract === 'sensum.content-addressed-artifact-manifest.v1'
      && templateArtifact?.contentHash === contentHash(blankTemplateRaw)
      && templateArtifact?.bytes === Buffer.byteLength(blankTemplateRaw, 'utf8'),
    importerPolicyAndQueueRecordsRevalidate: importerDryRun.audit.policyCoverage.valid === true
      && importerDryRun.audit.queueCoverage.invalidQueueRows.length === 0,
    blankTemplatesExactlyRevalidate: importerDryRun.audit.templateCoverage.invalidTemplateRows.length === 0
      && importerDryRun.audit.templateCoverage.actualTemplateCount === queueRecords.length
      && importerDryRun.audit.templateCoverage.exactTemplateOrder === true,
    blankDryRunRecordsNoDecision: importerDryRun.records.length === 0
      && importerDryRun.audit.submissionCoverage.completedDecisionCount === 0
      && importerDryRun.audit.semanticPreservationCoverage.reviewDecisionRecordedCount === 0,
    guidancePolicyValid: compiled.valid === true,
    queueNonEmpty: queueRecords.length > 0
  };
  return { checks, complete: Object.values(checks).every(Boolean), importerDryRunAudit: importerDryRun.audit };
}

export function auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(records = [], context = {}) {
  const { input = {}, compiled = {}, inputCoverage = {}, expectedRecords = [], artifacts = {}, contentHash = hash } = context;
  const invalidGuidanceRows = records.map((row, index) => {
    const integrity = validHash(row.recordContentHash) && row.recordContentHash === contentHash(without(row, 'recordContentHash', 'contentHash'));
    return integrity && same(row, expectedRecords[index], contentHash) ? null : row.candidateKey || index;
  }).filter(value => value !== null);
  const guidanceCoverage = {
    expectedGuidanceRecordCount: input.queueRecords?.length || 0,
    guidanceRecordCount: records.length,
    invalidGuidanceRows,
    exactCandidateRevisionBindingCount: records.filter(row => row.sourcePageIdentity?.sourceRevision && validHash(row.evidenceFingerprint)).length,
    dispositionCoherencePathCount: records.reduce((sum, row) => sum + row.dispositionCoherenceMatrix.length, 0),
    selectedDispositionPathCount: records.reduce((sum, row) => sum + row.dispositionCoherenceMatrix.filter(path => path.selected).length, 0),
    reviewObligationCount: records.reduce((sum, row) => sum + row.reviewObligationGuidance.length, 0),
    minimumEvidenceCoverageKeyCount: records.reduce((sum, row) => sum + (row.minimumEvidenceSelection?.exactMinimumKeyCount || 0), 0),
    minimumEvidenceSelectionsApplied: records.filter(row => row.minimumEvidenceSelection?.selected === true).length,
    blankDecisionTemplateCount: records.filter(row => same(row.blankDecisionTemplate,
      input.blankTemplates?.[row.guidanceOrdinal - 1], contentHash)).length
  };
  const artifactRows = artifacts.artifactManifest?.artifacts || [];
  const artifactCoverage = {
    expectedArtifactCount: 4,
    artifactCount: artifactRows.length,
    reviewGuidanceHashMatches: artifactRows.find(row => row.file === 'review-guidance.md')?.contentHash === contentHash(artifacts.guidanceMarkdown || ''),
    guidanceIndexHashMatches: artifactRows.find(row => row.file === 'guidance-index.json')?.contentHash === contentHash(artifacts.guidanceIndex || ''),
    submissionChecklistHashMatches: artifactRows.find(row => row.file === 'submission-checklist.md')?.contentHash === contentHash(artifacts.checklist || ''),
    blankTemplateByteHashMatches: artifactRows.find(row => row.file === 'decision-template.ndjson')?.contentHash === contentHash(input.blankTemplateRaw || '')
      && artifacts.decisionTemplateNdjson === input.blankTemplateRaw,
    manifestStable: artifacts.artifactManifestJson === `${JSON.stringify(artifacts.artifactManifest, null, 2)}\n`
  };
  const semanticPreservationCoverage = {
    humanDecisionSelectedCount: records.filter(row => row.humanDecisionSelected === true).length,
    evidenceSelectionAppliedCount: records.filter(row => row.evidenceSelectionApplied === true).length,
    decisionRecordedCount: records.filter(row => row.decisionRecorded === true).length,
    semanticApplicationCount: records.filter(row => row.semanticApplicationApplied === true).length,
    canonicalIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length,
    repeatabilityClassificationCount: records.filter(row => row.repeatabilityClassification !== null).length,
    membershipOrVariantApplicationCount: records.filter(row => row.membershipOrVariantApplication === true).length,
    mechanicsCompletionCount: records.filter(row => row.requirementsVariantsXpTimingAndMechanicsComplete === true).length,
    completeActivityUniverseCount: records.filter(row => row.completeActivityUniverse === true).length,
    optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
    automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length
  };
  const accountFindings = accountStateFindings([input.queueRecords, input.blankTemplates, records, artifacts]);
  const semanticBoundaryIntact = Object.values(semanticPreservationCoverage).every(value => value === 0);
  const artifactsComplete = artifactCoverage.artifactCount === artifactCoverage.expectedArtifactCount
    && Object.entries(artifactCoverage).filter(([key]) => !['expectedArtifactCount', 'artifactCount'].includes(key)).every(([, value]) => value === true);
  const guidanceMaterializationComplete = compiled.valid === true && inputCoverage.complete === true
    && records.length === (input.queueRecords?.length || 0) && records.length > 0 && invalidGuidanceRows.length === 0
    && guidanceCoverage.exactCandidateRevisionBindingCount === records.length
    && guidanceCoverage.selectedDispositionPathCount === 0 && guidanceCoverage.minimumEvidenceSelectionsApplied === 0
    && guidanceCoverage.blankDecisionTemplateCount === records.length && artifactsComplete && semanticBoundaryIntact && accountFindings.length === 0;
  const blockers = [];
  if (!compiled.valid) blockers.push('human_review_guidance_policy_invalid');
  if (!inputCoverage.complete) blockers.push('queue_or_blank_template_input_revalidation_failed');
  if (records.length !== (input.queueRecords?.length || 0) || invalidGuidanceRows.length) blockers.push('guidance_record_coverage_or_integrity_failed');
  if (!artifactsComplete) blockers.push('guidance_artifact_coverage_or_byte_equivalence_failed');
  if (!semanticBoundaryIntact) blockers.push('guidance_selected_or_applied_an_unsupported_decision_or_semantic_state');
  if (accountFindings.length) blockers.push('current_account_state_present');
  return {
    contract: input.policy?.auditContract,
    policyCoverage: compiled,
    inputCoverage: { ...inputCoverage, importerDryRunAudit: undefined },
    queueCoverage: {
      queueEntryCount: input.queueRecords?.length || 0,
      blankTemplateCount: input.blankTemplates?.length || 0,
      exactQueueAndTemplateBindingCount: inputCoverage.importerDryRunAudit?.bindingCoverage?.exactImmutableBindingCount || 0,
      realHumanDecisionCount: 0
    },
    guidanceCoverage,
    artifactCoverage,
    semanticPreservationCoverage,
    accountStateFindings: accountFindings,
    guidanceMaterializationComplete,
    humanReviewComplete: false,
    semanticApplicationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: guidanceMaterializationComplete ? [
      'explicit_source_bound_subject_boundary_human_review_pending',
      'complete_rendered_output_attribution_not_established',
      'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved',
      'independent_complete_activity_universe_not_established'
    ] : unique(blockers),
    publishable: guidanceMaterializationComplete
  };
}

export function buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(input = {}) {
  const contentHash = input.contentHash || hash;
  const compiled = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidancePolicy(
    input.policy, input.queuePolicy, input.decisionPolicy, input.routingPolicy, input.oneHopPolicy, input.recursivePolicy, contentHash
  );
  const inputCoverage = inputAssessment(input, compiled, contentHash);
  const expectedRecords = (input.queueRecords || []).map((queue, index) => guidanceRecord(
    queue, input.blankTemplates?.[index], input.queueSnapshot, input.policy, contentHash
  ));
  const records = inputCoverage.complete ? expectedRecords : [];
  const artifacts = buildArtifacts(records, input.blankTemplateRaw || '', contentHash);
  const audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(records, {
    input, compiled, inputCoverage, expectedRecords, artifacts, contentHash
  });
  return { records: audit.publishable ? records : [], artifacts, audit };
}
