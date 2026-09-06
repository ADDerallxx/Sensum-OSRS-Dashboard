import { hash } from '../ingestion/lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionGuidance } from './activity-candidate-priority-human-review-decision-guidance-lib.mjs';

const REQUIRED_RULES = [
  'packetGuidanceAndAdditionalEvidenceSnapshotsMustBeExplicitlySelected',
  'allThreeManifestsRawRecordsPoliciesHashesAndCrossSnapshotBindingsMustRevalidate',
  'oneAugmentedGuidanceRecordPerCompleteSourceConflictEvidencePacketInPacketOrder',
  'originalGuidanceVocabularyIdentityProjectionsCoherencePathsAndBlankTemplateMustRemainExact',
  'supplementalEvidenceMustExposeExactRevisionLocationsHeadingPathsRowsAndEvidenceKeys',
  'supplementalEvidenceKeysCannotBeInsertedIntoTheCurrentImporterDecisionShape',
  'currentImporterCompatibilityGapMustRemainAnExplicitBlocker',
  'reviewPathsMustRemainUnselectedAndCannotRecommendADisposition',
  'markdownMachineGuidanceAndBlankDecisionArtifactsMustBeDeterministic',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'humanDecisionConflictResolutionSemanticApplicationAndOptimizerPromotionAreForbidden',
  'requirementsVariantsXpTimingAndMechanicsCompletionIsForbidden',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const without = (object = {}, keys = []) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));

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

export function compileActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidancePolicy(
  policy = {}, packetPolicy = {}, guidancePolicy = {}, additionalEvidencePolicy = {}, decisionPolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidBindings = [];
  if (policy.policy !== 'sensum.activity-candidate-priority-source-conflict-augmented-human-review-guidance-policy.v1') invalidBindings.push('policy');
  if (policy.inputPacketPolicy !== packetPolicy.policy || policy.inputPacketPolicyContentHash !== contentHash(packetPolicy)) invalidBindings.push('inputPacketPolicy');
  if (policy.inputGuidancePolicy !== guidancePolicy.policy || policy.inputGuidancePolicyContentHash !== contentHash(guidancePolicy)) invalidBindings.push('inputGuidancePolicy');
  if (policy.inputAdditionalEvidencePolicy !== additionalEvidencePolicy.policy || policy.inputAdditionalEvidencePolicyContentHash !== contentHash(additionalEvidencePolicy)) invalidBindings.push('inputAdditionalEvidencePolicy');
  if (policy.inputDecisionImportPolicy !== decisionPolicy.policy || policy.inputDecisionImportPolicyContentHash !== contentHash(decisionPolicy)) invalidBindings.push('inputDecisionImportPolicy');
  if (policy.inputPacketDomain !== guidancePolicy.inputDomain || policy.inputGuidanceDomain !== guidancePolicy.outputDomain
    || policy.inputAdditionalEvidenceDomain !== additionalEvidencePolicy.outputDomain) invalidBindings.push('inputDomains');
  if (policy.recordContract !== 'sensum.activity-candidate-priority-source-conflict-augmented-human-review-guidance.v1'
    || policy.auditContract !== 'sensum.activity-candidate-priority-source-conflict-augmented-human-review-guidance-audit.v1') invalidBindings.push('contracts');
  if (!policy.outputDomain || !Array.isArray(policy.requiredReviewSequence) || !policy.requiredReviewSequence.length
    || duplicates(policy.requiredReviewSequence).length) invalidBindings.push('outputOrReviewSequence');
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidRules.length && !invalidBindings.length && !forbidden.length,
    invalidRules: unique(invalidRules),
    invalidBindings,
    forbiddenPolicyPaths: forbidden
  };
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function snapshotAssessment(raw, records, manifest, snapshot, domain, policyId, policyHash, contentHash = hash) {
  const checks = {
    explicitSnapshotSelected: snapshot?.explicit === true && Boolean(snapshot?.directory),
    manifestContractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === domain,
    recordCountAndRawHashMatch: manifest?.records === records.length && manifest?.contentHash === contentHash(raw),
    snapshotBindingMatchesManifest: snapshot?.contentHash === manifest?.contentHash && snapshot?.createdAt === manifest?.createdAt,
    createdAtValid: validIso(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policyId && manifest?.source?.policy?.contentHash === policyHash
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function recordHashesValid(record, contentHash = hash) {
  const intrinsic = without(record, ['contentHash']);
  const base = without(intrinsic, ['recordContentHash']);
  return record?.contentHash === contentHash(intrinsic) && record?.recordContentHash === contentHash(base);
}

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests)$/i;
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
  return sorted(findings);
}

function inputValidation(context) {
  const {
    packetRecords, packetRaw, packetManifest, packetSnapshot,
    guidanceRecords, guidanceRaw, guidanceManifest, guidanceSnapshot,
    additionalEvidenceRecords, additionalEvidenceRaw, additionalEvidenceManifest, additionalEvidenceSnapshot,
    policy, packetPolicy, guidancePolicy, additionalEvidencePolicy, decisionPolicy, contentHash
  } = context;
  const compiled = compileActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidancePolicy(
    policy, packetPolicy, guidancePolicy, additionalEvidencePolicy, decisionPolicy, contentHash
  );
  const packetAssessment = snapshotAssessment(packetRaw, packetRecords, packetManifest, packetSnapshot, policy.inputPacketDomain, packetPolicy.policy, policy.inputPacketPolicyContentHash, contentHash);
  const guidanceAssessment = snapshotAssessment(guidanceRaw, guidanceRecords, guidanceManifest, guidanceSnapshot, policy.inputGuidanceDomain, guidancePolicy.policy, policy.inputGuidancePolicyContentHash, contentHash);
  const additionalEvidenceAssessment = snapshotAssessment(
    additionalEvidenceRaw, additionalEvidenceRecords, additionalEvidenceManifest, additionalEvidenceSnapshot,
    policy.inputAdditionalEvidenceDomain, additionalEvidencePolicy.policy, policy.inputAdditionalEvidencePolicyContentHash, contentHash
  );
  const rebuiltGuidance = buildActivityCandidatePriorityHumanReviewDecisionGuidance({
    packetRecords, packetRaw, packetManifest, packetSnapshot,
    policy: guidancePolicy, packetPolicy, decisionPolicy, contentHash
  });
  const expectedGuidanceByKey = new Map(rebuiltGuidance.records.map(record => [record.guidanceKey, record]));
  const guidanceMismatches = guidanceRecords.filter(record => {
    const expected = expectedGuidanceByKey.get(record.guidanceKey);
    return !recordHashesValid(record, contentHash) || !expected || !same(without(record, ['contentHash']), expected, contentHash);
  }).map(record => record.guidanceKey || 'unknown');
  const packetHashFailures = packetRecords.filter(record => !recordHashesValid(record, contentHash)).map(record => record.reviewPacketKey || 'unknown');
  const additionalEvidenceHashFailures = additionalEvidenceRecords.filter(record => !recordHashesValid(record, contentHash)).map(record => record.evidencePacketKey || 'unknown');
  const conflictGuidance = guidanceRecords.filter(record => Array.isArray(record.sourceDispositionOptions) && record.sourceDispositionOptions.length > 1);
  const expectedPacketKeys = conflictGuidance.map(record => record.reviewPacketKey);
  const evidencePacketKeys = additionalEvidenceRecords.map(record => record.reviewPacketKey);
  const additionalEvidenceSetExact = !duplicates(evidencePacketKeys).length
    && same(sorted(expectedPacketKeys), sorted(evidencePacketKeys), contentHash);
  const packetByKey = new Map(packetRecords.map(record => [record.reviewPacketKey, record]));
  const guidanceByKey = new Map(guidanceRecords.map(record => [record.reviewPacketKey, record]));
  const evidenceBindingFailures = additionalEvidenceRecords.filter(record => {
    const packet = packetByKey.get(record.reviewPacketKey);
    const guidance = guidanceByKey.get(record.reviewPacketKey);
    return !packet || !guidance
      || record.contract !== additionalEvidencePolicy.recordContract
      || record.state !== 'source_conflict_additional_evidence_materialized_human_decision_pending'
      || record.sourceBindings?.packetSnapshotContentHash !== packetSnapshot.contentHash
      || record.sourceBindings?.packetRecordContentHash !== packet.recordContentHash
      || record.sourceBindings?.packetOuterContentHash !== packet.contentHash
      || record.sourceBindings?.guidanceSnapshotContentHash !== guidanceSnapshot.contentHash
      || record.sourceBindings?.guidanceRecordContentHash !== guidance.recordContentHash
      || record.sourceBindings?.guidanceOuterContentHash !== guidance.contentHash
      || record.candidateRevisionRevalidation?.exactMatch !== true
      || record.fieldSemanticsEvidence?.evidenceComplete !== true
      || record.taxonomyMembershipEvidence?.taxonomyDefinitionComplete !== true
      || record.taxonomyMembershipEvidence?.candidateMembership?.state !== 'complete_revision_pinned_taxonomy_membership_evidence'
      || !Array.isArray(record.humanReviewBoundary?.reviewEvidenceKeys) || !record.humanReviewBoundary.reviewEvidenceKeys.length
      || record.sourceConflict?.conflictResolved !== false || record.sourceConflict?.selectedSourceDisposition !== null
      || record.humanDecisionSelected !== false || record.decisionRecorded !== false || record.semanticApplicationApplied !== false
      || record.optimizerEligible !== false || record.automaticVerificationApplied !== false;
  }).map(record => record.evidencePacketKey || 'unknown');
  const additionalAudit = additionalEvidenceManifest?.source?.audit || {};
  const additionalEvidenceAuditValid = additionalAudit.contract === additionalEvidencePolicy.auditContract
    && additionalAudit.publishable === true && additionalAudit.additionalEvidenceCoverageComplete === true
    && additionalAudit.humanReviewComplete === false && additionalAudit.completeActivityUniverse === false
    && additionalAudit.semanticPreservationCoverage?.humanDecisionSelectedCount === 0
    && additionalAudit.semanticPreservationCoverage?.conflictResolvedCount === 0
    && additionalAudit.semanticPreservationCoverage?.semanticApplicationCount === 0
    && additionalAudit.semanticPreservationCoverage?.optimizerEligibleCount === 0;
  const complete = compiled.valid && packetAssessment.complete && guidanceAssessment.complete && additionalEvidenceAssessment.complete
    && rebuiltGuidance.audit.publishable && !packetHashFailures.length && !guidanceMismatches.length
    && !additionalEvidenceHashFailures.length && additionalEvidenceSetExact && !evidenceBindingFailures.length
    && additionalEvidenceAuditValid;
  return {
    complete,
    compiled,
    packetAssessment,
    guidanceAssessment,
    additionalEvidenceAssessment,
    rebuiltGuidancePublishable: rebuiltGuidance.audit.publishable,
    packetHashFailures,
    guidanceMismatches,
    additionalEvidenceHashFailures,
    additionalEvidenceSetExact,
    evidenceBindingFailures,
    additionalEvidenceAuditValid,
    conflictGuidance
  };
}

function originalGuidanceView(guidance) {
  return {
    guidanceKey: guidance.guidanceKey,
    sourcePageIdentity: structuredClone(guidance.sourcePageIdentity),
    sourceExactRevisionUrl: guidance.sourceExactRevisionUrl,
    sourceDispositionOptions: structuredClone(guidance.sourceDispositionOptions),
    requiredReviewEvidenceKeys: structuredClone(guidance.requiredReviewEvidenceKeys),
    requiredReviewedSourceRevisions: structuredClone(guidance.requiredReviewedSourceRevisions),
    evidenceDomainGuidance: structuredClone(guidance.evidenceDomainGuidance),
    decisionVocabulary: structuredClone(guidance.decisionVocabulary),
    canonicalGameEntityIdentityProjection: structuredClone(guidance.canonicalGameEntityIdentityProjection),
    canonicalActivityIdentityProjection: structuredClone(guidance.canonicalActivityIdentityProjection),
    coherencePaths: structuredClone(guidance.coherencePaths),
    earliestAllowedReviewedAt: guidance.earliestAllowedReviewedAt
  };
}

function supplementalEvidenceView(evidence) {
  const fieldObservations = evidence.fieldSemanticsEvidence.sources.flatMap(source => source.observations.map(observation => ({
    evidenceKey: observation.evidenceKey,
    sourceTitle: source.resolvedTitle,
    sourceRevision: source.sourceRevision,
    sourceExactRevisionUrl: source.sourceExactRevisionUrl,
    literal: observation.literal,
    occurrences: structuredClone(observation.occurrences)
  })));
  const taxonomy = evidence.taxonomyMembershipEvidence;
  return {
    evidencePacketKey: evidence.evidencePacketKey,
    candidateRevisionRevalidation: structuredClone(evidence.candidateRevisionRevalidation),
    fieldSemanticsObservations: fieldObservations,
    taxonomyDefinitionObservations: taxonomy.taxonomyDefinitionSource.observations.map(observation => ({
      evidenceKey: observation.evidenceKey,
      sourceTitle: taxonomy.taxonomyDefinitionSource.resolvedTitle,
      sourceRevision: taxonomy.taxonomyDefinitionSource.sourceRevision,
      sourceExactRevisionUrl: taxonomy.taxonomyDefinitionSource.sourceExactRevisionUrl,
      literal: observation.literal,
      occurrences: structuredClone(observation.occurrences)
    })),
    taxonomyMembership: structuredClone(taxonomy.candidateMembership),
    supplementalReviewEvidenceKeys: structuredClone(evidence.humanReviewBoundary.reviewEvidenceKeys),
    evidenceCollectionVerdicts: {
      fieldMeaningVerdict: evidence.fieldSemanticsEvidence.fieldMeaningVerdict,
      taxonomyVerdict: taxonomy.taxonomyVerdict,
      candidateClassificationVerdict: taxonomy.candidateMembership.classificationVerdict
    }
  };
}

function expectedRecord(packet, guidance, evidence, policy, contentHash = hash, ordinal = 1) {
  const supplemental = supplementalEvidenceView(evidence);
  const base = {
    contract: policy.recordContract,
    augmentedGuidanceKey: `${evidence.evidencePacketKey}|augmented-human-review-guidance`,
    augmentedGuidanceOrdinal: ordinal,
    candidateKey: packet.candidateKey,
    reviewPacketKey: packet.reviewPacketKey,
    sourceBindings: {
      packetSnapshotContentHash: evidence.sourceBindings.packetSnapshotContentHash,
      packetRecordContentHash: packet.recordContentHash,
      packetOuterContentHash: packet.contentHash,
      guidanceSnapshotContentHash: evidence.sourceBindings.guidanceSnapshotContentHash,
      guidanceRecordContentHash: guidance.recordContentHash,
      guidanceOuterContentHash: guidance.contentHash,
      additionalEvidenceSnapshotContentHash: evidence.sourceAdditionalEvidenceSnapshotContentHash,
      additionalEvidenceRecordContentHash: evidence.recordContentHash,
      additionalEvidenceOuterContentHash: evidence.contentHash
    },
    sourceConflict: structuredClone(evidence.sourceConflict),
    originalGuidance: originalGuidanceView(guidance),
    supplementalEvidence: supplemental,
    reviewSequence: structuredClone(policy.requiredReviewSequence),
    decisionImporterCompatibility: {
      state: 'blocked_pending_supplemental_evidence_import_contract',
      currentImporterPolicy: policy.inputDecisionImportPolicy,
      currentImporterPolicyContentHash: policy.inputDecisionImportPolicyContentHash,
      originalRequiredReviewEvidenceKeys: structuredClone(guidance.requiredReviewEvidenceKeys),
      originalRequiredReviewedSourceRevisions: structuredClone(guidance.requiredReviewedSourceRevisions),
      supplementalEvidenceKeys: structuredClone(supplemental.supplementalReviewEvidenceKeys),
      supplementalEvidenceKeysAcceptedByCurrentImporter: false,
      blankDecisionTemplateRemainsExact: true,
      requiredNextBoundary: 'extend_guarded_importer_to_bind_an_explicit_validated_supplemental_evidence_snapshot_without_weakening_original_evidence_requirements'
    },
    reviewPaths: guidance.coherencePaths.map(path => ({
      ...structuredClone(path),
      selected: false,
      supplementalEvidenceConsiderations: [
        'review_the_optional_activity_type_field_semantics_without_treating_them_as_a_subject_decision',
        'review_the_exact_taxonomy_heading_and_row_without_treating_membership_as_a_complete_activity_boundary',
        'do_not_treat_taxonomy_repeatability_language_as_candidate_specific_repeatability_proof'
      ]
    })),
    blankDecisionTemplate: structuredClone(guidance.blankDecisionTemplate),
    explicitNonClaims: unique([
      ...guidance.explicitNonClaims,
      ...evidence.explicitNonClaims,
      'supplemental_evidence_is_not_currently_an_accepted_decision_import_field',
      'review_guidance_does_not_recommend_or_select_a_source_disposition'
    ]),
    blockers: unique([
      ...evidence.blockers,
      'current_decision_importer_does_not_bind_supplemental_evidence_snapshot',
      'human_source_conflict_decision_pending'
    ]),
    state: 'source_conflict_augmented_human_review_guidance_materialized_decision_still_blank',
    accountIndependent: true,
    humanDecisionSelected: false,
    decisionRecorded: false,
    conflictResolved: false,
    semanticApplicationApplied: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function markdownFor(records) {
  const lines = [
    '# Priority activity source-conflict review guidance',
    '',
    'This bundle presents revision-pinned evidence. It does not select or record a decision.',
    'The included decision templates remain blank and are not yet able to bind the supplemental evidence keys.',
    ''
  ];
  for (const record of records) {
    const title = record.originalGuidance.sourcePageIdentity.resolvedTitle;
    lines.push(`## ${record.augmentedGuidanceOrdinal}. ${title}`, '');
    lines.push(`- Candidate: \`${record.candidateKey}\``);
    lines.push(`- Bound candidate revision: [${record.originalGuidance.sourcePageIdentity.sourceRevision}](${record.originalGuidance.sourceExactRevisionUrl})`);
    lines.push(`- Source dispositions to reconcile: ${record.originalGuidance.sourceDispositionOptions.map(value => `\`${value}\``).join(', ')}`);
    lines.push('- Decision selected: **No**', '');
    lines.push('### Conflicting source declarations', '');
    for (const signal of record.sourceConflict.dispositionSignals) {
      lines.push(`- \`${signal.disposition}\` — ${signal.matchedText || signal.rawValue || signal.plainText} (candidate source line ${signal.sourceLocator?.lineStart || '?'})`);
    }
    lines.push('', '### Supplemental field-semantics evidence', '');
    for (const observation of record.supplementalEvidence.fieldSemanticsObservations) {
      const location = observation.occurrences.map(item => item.lineStart).join(', ');
      lines.push(`- [${observation.sourceTitle} revision ${observation.sourceRevision}](${observation.sourceExactRevisionUrl}), line ${location}: ${observation.literal}`);
    }
    lines.push('', '### Supplemental taxonomy evidence', '');
    for (const observation of record.supplementalEvidence.taxonomyDefinitionObservations) {
      const location = observation.occurrences.map(item => item.lineStart).join(', ');
      lines.push(`- [${observation.sourceTitle} revision ${observation.sourceRevision}](${observation.sourceExactRevisionUrl}), line ${location}: ${observation.literal}`);
    }
    for (const occurrence of record.supplementalEvidence.taxonomyMembership.linkOccurrences) {
      lines.push(`- Heading path: ${occurrence.headingPath.map(item => item.title).join(' → ')}`);
      lines.push(`- Exact membership row: lines ${occurrence.tableRow.sourceLocator.lineStart}–${occurrence.tableRow.sourceLocator.lineEnd}`);
      for (const row of occurrence.tableRow.rawLines) lines.push(`  - \`${row.replaceAll('`', '\\`')}\``);
    }
    lines.push('', '### Review boundary', '');
    lines.push('- Compare field semantics, taxonomy membership, and the candidate subject boundary separately.');
    lines.push('- Do not infer candidate-specific repeatability from the taxonomy page alone.');
    lines.push('- The current importer cannot accept the supplemental evidence keys; do not edit the template shape.');
    lines.push('- Leave the decision template blank until the guarded importer supports the supplemental snapshot.', '');
    lines.push('### Unselected decision paths', '');
    for (const path of record.reviewPaths) lines.push(`- \`${path.pathKey}\` — selected: **No**`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

export function buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidanceArtifacts(records = [], contentHash = hash) {
  const markdown = markdownFor(records);
  const machineJson = JSON.stringify(records, null, 2) + '\n';
  const blankDecisionNdjson = records.map(record => JSON.stringify(record.blankDecisionTemplate)).join('\n') + (records.length ? '\n' : '');
  const artifacts = [
    { file: 'augmented-guidance.md', kind: 'human_readable_augmented_conflict_guidance', contentHash: contentHash(markdown), bytes: Buffer.byteLength(markdown, 'utf8') },
    { file: 'augmented-guidance.json', kind: 'machine_readable_augmented_conflict_guidance', contentHash: contentHash(machineJson), bytes: Buffer.byteLength(machineJson, 'utf8') },
    { file: 'decisions.ndjson', kind: 'untouched_importer_compatible_blank_decision_templates', contentHash: contentHash(blankDecisionNdjson), bytes: Buffer.byteLength(blankDecisionNdjson, 'utf8') }
  ];
  const artifactManifest = { contract: 'sensum.activity-candidate-priority-source-conflict-augmented-human-review-guidance-artifact-manifest.v1', records: records.length, artifacts };
  const artifactManifestJson = JSON.stringify(artifactManifest, null, 2) + '\n';
  return { markdown, machineJson, blankDecisionNdjson, artifactManifest, artifactManifestJson };
}

function deriveExpected(context) {
  const validation = inputValidation(context);
  if (!validation.complete) return { validation, expected: [] };
  const packetByKey = new Map(context.packetRecords.map(record => [record.reviewPacketKey, record]));
  const guidanceByKey = new Map(context.guidanceRecords.map(record => [record.reviewPacketKey, record]));
  const expected = context.additionalEvidenceRecords.map((evidence, index) => expectedRecord(
    packetByKey.get(evidence.reviewPacketKey),
    guidanceByKey.get(evidence.reviewPacketKey),
    { ...evidence, sourceAdditionalEvidenceSnapshotContentHash: context.additionalEvidenceSnapshot.contentHash },
    context.policy, context.contentHash, index + 1
  ));
  return { validation, expected };
}

export function auditActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance(records = [], context = {}, artifacts = null) {
  const { validation, expected } = deriveExpected(context);
  const expectedByKey = new Map(expected.map(record => [record.augmentedGuidanceKey, record]));
  const expectedKeys = expected.map(record => record.augmentedGuidanceKey);
  const actualKeys = records.map(record => record.augmentedGuidanceKey);
  const recordMismatches = records.filter(record => !expectedByKey.has(record.augmentedGuidanceKey)
    || !same(record, expectedByKey.get(record.augmentedGuidanceKey), context.contentHash)).map(record => record.augmentedGuidanceKey || 'unknown');
  const setAndOrderExact = !duplicates(actualKeys).length && same(actualKeys, expectedKeys, context.contentHash)
    && records.every((record, index) => record.augmentedGuidanceOrdinal === index + 1);
  const expectedArtifacts = buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidanceArtifacts(records, context.contentHash);
  const artifactMismatches = [];
  if (!artifacts) artifactMismatches.push('artifacts_missing');
  else {
    if (!same(artifacts.markdown, expectedArtifacts.markdown, context.contentHash)) artifactMismatches.push('markdown');
    if (!same(artifacts.machineJson, expectedArtifacts.machineJson, context.contentHash)) artifactMismatches.push('machine_json');
    if (!same(artifacts.blankDecisionNdjson, expectedArtifacts.blankDecisionNdjson, context.contentHash)) artifactMismatches.push('blank_decisions');
    if (!same(artifacts.artifactManifestJson, expectedArtifacts.artifactManifestJson, context.contentHash)) artifactMismatches.push('artifact_manifest');
  }
  const supplementalEvidenceKeyCount = records.reduce((sum, record) => sum + record.supplementalEvidence.supplementalReviewEvidenceKeys.length, 0);
  const originalEvidenceKeyCount = records.reduce((sum, record) => sum + record.originalGuidance.requiredReviewEvidenceKeys.length, 0);
  const reviewPathCount = records.reduce((sum, record) => sum + record.reviewPaths.length, 0);
  const unsupportedPromotions = records.filter(record => record.humanDecisionSelected !== false || record.decisionRecorded !== false
    || record.conflictResolved !== false || record.semanticApplicationApplied !== false
    || record.requirementsVariantsXpTimingAndMechanicsComplete !== false || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false || record.sourceConflict?.selectedSourceDisposition !== null
    || record.reviewPaths.some(path => path.selected !== false)
    || !same(record.blankDecisionTemplate, record.originalGuidance ? context.guidanceRecords.find(item => item.reviewPacketKey === record.reviewPacketKey)?.blankDecisionTemplate : null, context.contentHash)
  ).map(record => record.augmentedGuidanceKey || 'unknown');
  const accountFindings = accountStateFindings(records);
  const structuralBlockers = [];
  if (!validation.complete) structuralBlockers.push('packet_guidance_or_additional_evidence_input_revalidation_failed');
  if (!setAndOrderExact || recordMismatches.length) structuralBlockers.push('augmented_guidance_set_order_or_content_mismatch');
  if (artifactMismatches.length) structuralBlockers.push('augmented_guidance_artifacts_missing_or_not_deterministic');
  if (unsupportedPromotions.length) structuralBlockers.push('augmented_guidance_selected_a_decision_or_applied_semantic_optimizer_state');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = !structuralBlockers.length;
  return {
    contract: context.policy.auditContract,
    policyCoverage: validation.compiled,
    inputCoverage: {
      packetSnapshotAssessment: validation.packetAssessment,
      guidanceSnapshotAssessment: validation.guidanceAssessment,
      additionalEvidenceSnapshotAssessment: validation.additionalEvidenceAssessment,
      rebuiltGuidancePublishable: validation.rebuiltGuidancePublishable,
      packetHashFailures: validation.packetHashFailures,
      guidanceMismatches: validation.guidanceMismatches,
      additionalEvidenceHashFailures: validation.additionalEvidenceHashFailures,
      additionalEvidenceSetExact: validation.additionalEvidenceSetExact,
      evidenceBindingFailures: validation.evidenceBindingFailures,
      additionalEvidenceAuditValid: validation.additionalEvidenceAuditValid
    },
    guidanceCoverage: {
      sourceConflictInputCount: context.additionalEvidenceRecords.length,
      augmentedGuidanceRecordCount: records.length,
      setAndOrderExact,
      recordMismatches,
      originalEvidenceKeyCount,
      supplementalEvidenceKeyCount,
      reviewPathCount,
      selectedReviewPathCount: records.reduce((sum, record) => sum + record.reviewPaths.filter(path => path.selected).length, 0),
      blankDecisionTemplateCount: records.filter(record => record.blankDecisionTemplate).length,
      compatibilityBlockedCount: records.filter(record => record.decisionImporterCompatibility.state === 'blocked_pending_supplemental_evidence_import_contract').length
    },
    artifactCoverage: {
      artifactCount: artifacts ? 4 : 0,
      artifactManifestEntryCount: artifacts?.artifactManifest?.artifacts?.length || 0,
      artifactMismatches,
      deterministicArtifactReconstructionComplete: Boolean(artifacts) && !artifactMismatches.length
    },
    semanticPreservationCoverage: {
      humanDecisionSelectedCount: records.filter(record => record.humanDecisionSelected).length,
      decisionRecordedCount: records.filter(record => record.decisionRecorded).length,
      conflictResolvedCount: records.filter(record => record.conflictResolved).length,
      semanticApplicationCount: records.filter(record => record.semanticApplicationApplied).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    augmentedGuidanceMaterializationComplete: publishable && records.length === context.additionalEvidenceRecords.length,
    currentDecisionImporterSupportsSupplementalEvidence: false,
    humanReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'current_decision_importer_does_not_bind_supplemental_evidence_snapshot',
      'all_priority_activity_candidate_human_decisions_pending',
      'source_declaration_conflicts_not_resolved_by_guidance',
      'canonical_identity_repeatability_atomicity_and_membership_not_applied',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance(context = {}) {
  const completeContext = { ...context, contentHash: context.contentHash || hash };
  const { expected } = deriveExpected(completeContext);
  const artifacts = buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidanceArtifacts(expected, completeContext.contentHash);
  const audit = auditActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance(expected, completeContext, artifacts);
  return { records: expected, artifacts, audit };
}
