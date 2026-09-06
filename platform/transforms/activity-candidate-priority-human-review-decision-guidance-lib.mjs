import { hash } from '../ingestion/lib.mjs';
import { compileActivityCandidatePriorityHumanReviewPacketPolicy } from './activity-candidate-priority-human-review-packet-consolidation-lib.mjs';
import {
  boundSourceRevisionsForActivityCandidatePriorityPacket,
  buildActivityCandidatePriorityHumanReviewDecisionImport,
  canonicalActivityIdentityProposalForActivityCandidatePriorityPacket,
  canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket,
  compileActivityCandidatePriorityHumanReviewDecisionImportPolicy,
  requiredReviewEvidenceKeysForActivityCandidatePriorityPacket
} from './activity-candidate-priority-human-review-decision-import-lib.mjs';

const REQUIRED_RULES = [
  'packetSnapshotMustBeExplicitlySelected',
  'packetManifestRawOuterIntrinsicAndEmbeddedPipelineBindingsMustRevalidate',
  'packetPolicyAndDecisionImporterPolicyMustBindExactly',
  'oneGuidanceRecordPerPacketInPacketOrder',
  'everyGuidanceRecordMustExposeExactRequiredEvidenceKeysAndAllBoundSourceRevisions',
  'everyGuidanceRecordMustExposeOnlyImporterAllowedDecisionVocabulary',
  'canonicalIdentityGuidanceMustEqualTheRevisionPinnedPacketProjection',
  'coherencePathsAreGenericInstructionsAndCannotSelectAPath',
  'blankDecisionTemplateMustRemainByteEquivalentToThePacketTemplate',
  'batchArtifactsMustBeContiguousCompleteNonOverlappingAndDeterministic',
  'guidanceCannotRecordInferRecommendOrApplyAnyHumanDecision',
  'guidanceCannotEstablishIdentityRepeatabilityAtomicityMembershipRequirementsVariantsXpTimingMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);

function validIsoTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

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

export function compileActivityCandidatePriorityHumanReviewDecisionGuidancePolicy(
  policy = {}, packetPolicy = {}, decisionPolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const packetPolicyCoverage = compileActivityCandidatePriorityHumanReviewPacketPolicy(packetPolicy);
  const decisionPolicyCoverage = compileActivityCandidatePriorityHumanReviewDecisionImportPolicy(decisionPolicy);
  const contractsValid = policy.policy === 'sensum.activity-candidate-priority-human-review-decision-guidance-policy.v1'
    && policy.packetContract === packetPolicy.packetContract
    && policy.guidanceContract === 'sensum.activity-candidate-priority-human-review-decision-guidance.v1'
    && policy.auditContract === 'sensum.activity-candidate-priority-human-review-decision-guidance-audit.v1'
    && policy.inputPacketPolicy === packetPolicy.policy
    && policy.inputPacketPolicyContentHash === contentHash(packetPolicy)
    && policy.inputDecisionImportPolicy === decisionPolicy.policy
    && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy)
    && policy.inputDomain === packetPolicy.outputDomain
    && policy.outputDomain === 'activity-candidate-priority-human-review-decision-guidance'
    && policy.batchSize === packetPolicy.batchSize
    && policy.batchSize === decisionPolicy.packetBatchSize;
  const stateValid = policy.guidanceState === 'review_guidance_materialized_decision_still_blank';
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && stateValid && packetPolicyCoverage.valid && decisionPolicyCoverage.valid
      && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid,
    stateValid,
    packetPolicyCoverage,
    decisionPolicyCoverage,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function collectTimestamps(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach(child => collectTimestamps(child, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:Timestamp|ObservedAt)$/i.test(key) && validIsoTimestamp(child)) result.push(child);
    else collectTimestamps(child, result);
  }
  return result;
}

function earliestAllowedReviewedAt(packet, packetSnapshotCreatedAt) {
  const timestamps = [...collectTimestamps(packet), packetSnapshotCreatedAt].filter(validIsoTimestamp).map(Date.parse);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function sourceDispositionOptions(packet = {}) {
  const disposition = packet.subjectAssessment?.subjectDisposition || {};
  return disposition.disposition ? [disposition.disposition] : sorted(unique(disposition.conflictingDispositions || []));
}

function decisionVocabulary(decisionPolicy = {}) {
  return {
    subjectDispositionDecision: structuredClone(decisionPolicy.allowedSubjectDispositionDecisions || []),
    canonicalGameEntityIdentityDecision: structuredClone(decisionPolicy.allowedCanonicalGameEntityIdentityDecisions || []),
    canonicalActivityIdentityDecision: structuredClone(decisionPolicy.allowedCanonicalActivityIdentityDecisions || []),
    repeatabilityDecision: structuredClone(decisionPolicy.allowedRepeatabilityDecisions || []),
    atomicityDecision: structuredClone(decisionPolicy.allowedAtomicityDecisions || []),
    memberExpansionDecision: structuredClone(decisionPolicy.allowedMemberExpansionDecisions || []),
    evidenceDomainStatus: structuredClone(decisionPolicy.allowedEvidenceDomainStatuses || [])
  };
}

function coherencePaths() {
  return [
    {
      path: 'confirmed_atomic_activity_subject', selected: false,
      subjectDispositionDecision: 'confirm_one_bound_source_disposition',
      selectedSourceDispositionInstruction: 'choose_exactly_one_value_from_sourceDispositionOptions',
      canonicalGameEntityIdentityDecision: 'confirm_bound_source_page_subject_identity',
      canonicalActivityIdentityDecision: 'confirm_bound_source_subject_as_activity_container',
      repeatabilityDecision: 'repeatable_activity', atomicityDecision: 'atomic_activity_subject',
      memberExpansionDecision: 'not_required_atomic_subject', memberKeysInstruction: 'must_remain_empty'
    },
    {
      path: 'confirmed_composite_activity_subject', selected: false,
      subjectDispositionDecision: 'confirm_one_bound_source_disposition',
      selectedSourceDispositionInstruction: 'choose_exactly_one_value_from_sourceDispositionOptions',
      canonicalGameEntityIdentityDecision: 'confirm_bound_source_page_subject_identity',
      canonicalActivityIdentityDecision: 'confirm_bound_source_subject_as_activity_container',
      repeatabilityDecision: 'composite_or_collection_requires_expansion', atomicityDecision: 'composite_activity_subject',
      memberExpansionDecision: 'required_for_composite_subject', memberKeysInstruction: 'must_remain_empty_until_separate_member_expansion_application'
    },
    {
      path: 'confirmed_reference_collection_subject', selected: false,
      subjectDispositionDecision: 'confirm_one_bound_source_disposition',
      selectedSourceDispositionInstruction: 'choose_exactly_one_value_from_sourceDispositionOptions',
      canonicalGameEntityIdentityDecision: 'confirm_bound_source_page_subject_identity',
      canonicalActivityIdentityDecision: 'confirm_bound_source_subject_as_activity_container',
      repeatabilityDecision: 'composite_or_collection_requires_expansion', atomicityDecision: 'reference_collection_subject',
      memberExpansionDecision: 'required_for_reference_collection_subject', memberKeysInstruction: 'must_remain_empty_until_separate_member_expansion_application'
    },
    {
      path: 'rejected_non_repeatable_subject', selected: false,
      subjectDispositionDecision: 'reject_all_bound_source_dispositions', selectedSourceDispositionInstruction: 'must_be_null',
      canonicalGameEntityIdentityDecision: 'reject_bound_source_page_subject_identity',
      canonicalActivityIdentityDecision: 'reject_bound_source_subject_as_activity_container',
      repeatabilityDecision: 'non_repeatable_subject', atomicityDecision: 'not_applicable_non_repeatable_subject',
      memberExpansionDecision: 'not_applicable_non_repeatable_subject', memberKeysInstruction: 'must_remain_empty'
    },
    {
      path: 'additional_evidence_required', selected: false,
      subjectDispositionDecision: 'additional_evidence_required', selectedSourceDispositionInstruction: 'must_be_null',
      canonicalGameEntityIdentityDecision: 'additional_evidence_required',
      canonicalActivityIdentityDecision: 'additional_evidence_required',
      repeatabilityDecision: 'additional_evidence_required', atomicityDecision: 'additional_evidence_required',
      memberExpansionDecision: 'additional_evidence_required', memberKeysInstruction: 'must_remain_empty'
    }
  ];
}

function guidanceRecord(packet, packetSnapshot, policy, decisionPolicy, contentHash = hash) {
  const requiredEvidenceKeys = requiredReviewEvidenceKeysForActivityCandidatePriorityPacket(packet);
  const requiredRevisions = boundSourceRevisionsForActivityCandidatePriorityPacket(packet);
  const base = {
    contract: policy.guidanceContract,
    guidanceKey: `${packet.reviewPacketKey}|human-decision-guidance`,
    guidanceOrdinal: packet.packetOrdinal,
    batchOrdinal: packet.batchOrdinal,
    batchItemOrdinal: packet.batchItemOrdinal,
    reviewPacketKey: packet.reviewPacketKey,
    candidateKey: packet.candidateKey,
    sourcePacketSnapshotContentHash: packetSnapshot.contentHash,
    sourcePacketSnapshotCreatedAt: packetSnapshot.createdAt,
    sourcePacketRecordContentHash: packet.recordContentHash,
    sourcePacketOuterContentHash: packet.contentHash,
    sourcePageIdentity: structuredClone(packet.sourcePageIdentity),
    sourceExactRevisionUrl: packet.sourceExactRevisionUrl,
    pipelineBindings: structuredClone(packet.pipelineBindings),
    sourceDispositionOptions: sourceDispositionOptions(packet),
    requiredReviewEvidenceKeys: requiredEvidenceKeys,
    requiredReviewedSourceRevisions: requiredRevisions,
    earliestAllowedReviewedAt: earliestAllowedReviewedAt(packet, packetSnapshot.createdAt),
    canonicalGameEntityIdentityProjection: canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket(packet),
    canonicalActivityIdentityProjection: canonicalActivityIdentityProposalForActivityCandidatePriorityPacket(packet),
    decisionVocabulary: decisionVocabulary(decisionPolicy),
    evidenceDomainGuidance: (packet.reviewObligations?.requiredEvidenceDomains || []).map(domain => ({
      domain,
      allowedStatuses: structuredClone(decisionPolicy.allowedEvidenceDomainStatuses),
      evidenceKeysMustBeNonEmpty: true,
      evidenceKeysMustBeSubsetOfRequiredReviewEvidenceKeys: true,
      notesRequired: true
    })),
    coherencePaths: coherencePaths(),
    reviewerRequirements: {
      reviewerMustIdentifyAHuman: true,
      obviousAutomationModelAndBotNamesRejected: true,
      reviewedAtMustBeIsoUtc: true,
      reviewedAtMustNotPrecede: earliestAllowedReviewedAt(packet, packetSnapshot.createdAt),
      reviewNotesRequired: true,
      everyRequiredRevisionMustBeListedExactlyOnce: true,
      everyRequiredReviewEvidenceKeyMustBeListedExactlyOnce: true
    },
    blankDecisionTemplate: structuredClone(packet.decisionTemplate),
    explicitNonClaims: [
      'guidance_does_not_select_or_recommend_a_decision_path',
      'identity_projections_are_required_submission_shapes_not_applied_identities',
      'evidence_domain_names_are_review_obligations_not_verified_facts',
      'member_keys_must_remain_empty_until_separate_member_expansion_application',
      'human_review_is_not_complete',
      'requirements_variants_xp_timing_and_mechanics_are_not_established',
      'complete_activity_universe_is_not_established',
      'account_state_is_not_evaluated',
      'optimizer_eligibility_is_not_established',
      'verified_best_is_not_authorized'
    ],
    humanDecisionSelected: false,
    decisionRecorded: false,
    semanticApplicationApplied: false,
    memberKeys: [],
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: [
      'explicit_human_activity_candidate_review_pending',
      'canonical_identity_repeatability_atomicity_and_membership_not_applied',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ],
    state: policy.guidanceState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function markdownText(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function renderGuidanceMarkdown(record) {
  const lines = [
    '<details>',
    `<summary>${String(record.guidanceOrdinal).padStart(2, '0')} — ${markdownText(record.sourcePageIdentity.resolvedTitle)} — decision guidance</summary>`,
    '',
    `- Candidate: \`${markdownText(record.candidateKey)}\``,
    `- Exact source: [page ${record.sourcePageIdentity.sourcePageId}, revision ${record.sourcePageIdentity.sourceRevision}](${record.sourceExactRevisionUrl})`,
    `- Source disposition options: ${record.sourceDispositionOptions.map(value => `\`${markdownText(value)}\``).join(', ') || 'none — additional evidence required'}`,
    `- Earliest valid review timestamp: \`${record.earliestAllowedReviewedAt}\``,
    '',
    '## Required evidence keys', '',
    ...record.requiredReviewEvidenceKeys.map(value => `- \`${markdownText(value)}\``),
    '',
    '## Required reviewed revisions', '',
    ...record.requiredReviewedSourceRevisions.map(value => `- [revision ${value}](https://oldschool.runescape.wiki/w/Special:Redirect/revision/${value})`),
    '',
    '## Required evidence domains', '',
    ...record.evidenceDomainGuidance.map(value => `- \`${markdownText(value.domain)}\`: choose one allowed status, cite one or more required evidence keys, and write notes.`),
    '',
    '## Exact identity projections', '', '```json',
    JSON.stringify({
      canonicalGameEntityIdentity: record.canonicalGameEntityIdentityProjection,
      canonicalActivityIdentity: record.canonicalActivityIdentityProjection
    }, null, 2),
    '```', '',
    '## Generic coherent paths — none selected', '',
    ...record.coherencePaths.map(value => `- \`${value.path}\``),
    '',
    '## Decision vocabulary', '', '```json', JSON.stringify(record.decisionVocabulary, null, 2), '```', '',
    '## Untouched decision template', '', '```json', JSON.stringify(record.blankDecisionTemplate, null, 2), '```', '',
    'The reviewer must edit the separate `.decisions.ndjson` file. This guidance does not choose, record, or apply a decision.',
    '', '</details>', ''
  ];
  return lines.join('\n');
}

export function buildActivityCandidatePriorityHumanReviewDecisionGuidanceArtifacts(records = [], policy = {}, contentHash = hash) {
  const batches = [];
  const batchCount = records.length ? Math.ceil(records.length / policy.batchSize) : 0;
  for (let batchOrdinal = 1; batchOrdinal <= batchCount; batchOrdinal++) {
    const batchRecords = records.filter(record => record.batchOrdinal === batchOrdinal);
    const first = batchRecords[0]?.guidanceOrdinal || 0;
    const last = batchRecords.at(-1)?.guidanceOrdinal || 0;
    const stem = `batch-${String(batchOrdinal).padStart(2, '0')}-${String(first).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    const markdown = [`# Priority activity human-decision guidance — batch ${batchOrdinal} of ${batchCount}`, '', ...batchRecords.map(renderGuidanceMarkdown)].join('\n') + '\n';
    const guidanceJson = JSON.stringify(batchRecords, null, 2) + '\n';
    const decisionNdjson = batchRecords.map(record => JSON.stringify(record.blankDecisionTemplate)).join('\n') + (batchRecords.length ? '\n' : '');
    batches.push({
      batchOrdinal,
      firstGuidanceOrdinal: first,
      lastGuidanceOrdinal: last,
      recordCount: batchRecords.length,
      markdownFile: `${stem}.guidance.md`,
      guidanceFile: `${stem}.guidance.json`,
      decisionFile: `${stem}.decisions.ndjson`,
      markdown,
      guidanceJson,
      decisionNdjson
    });
  }
  const batchIndexTsv = [
    'batch_ordinal\tfirst_guidance_ordinal\tlast_guidance_ordinal\trecord_count\tmarkdown_file\tguidance_file\tdecision_file',
    ...batches.map(batch => [batch.batchOrdinal, batch.firstGuidanceOrdinal, batch.lastGuidanceOrdinal, batch.recordCount, batch.markdownFile, batch.guidanceFile, batch.decisionFile].join('\t'))
  ].join('\n') + '\n';
  const artifactManifest = {
    contract: 'sensum.activity-candidate-priority-human-review-decision-guidance-artifact-manifest.v1',
    batchSize: policy.batchSize,
    guidanceRecordCount: records.length,
    batchCount: batches.length,
    artifacts: batches.flatMap(batch => [
      { file: `batches/${batch.markdownFile}`, kind: 'human_decision_guidance_markdown', contentHash: contentHash(batch.markdown), bytes: Buffer.byteLength(batch.markdown, 'utf8') },
      { file: `batches/${batch.guidanceFile}`, kind: 'machine_readable_human_decision_guidance', contentHash: contentHash(batch.guidanceJson), bytes: Buffer.byteLength(batch.guidanceJson, 'utf8') },
      { file: `batches/${batch.decisionFile}`, kind: 'untouched_blank_decision_template_ndjson', contentHash: contentHash(batch.decisionNdjson), bytes: Buffer.byteLength(batch.decisionNdjson, 'utf8') }
    ])
  };
  const artifactManifestJson = JSON.stringify(artifactManifest, null, 2) + '\n';
  return { batches, batchIndexTsv, artifactManifest, artifactManifestJson };
}

function packetManifestAssessment(packetRecords, packetRaw, packetManifest, packetSnapshot, policy, contentHash = hash) {
  const audit = packetManifest?.source?.audit || {};
  const packetCoverage = audit.packetCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    explicitSnapshotSelected: packetSnapshot?.explicit === true,
    manifestContractAndDomainMatch: packetManifest?.contract === 'sensum.ingestion-manifest.v1' && packetManifest?.domain === policy.inputDomain,
    recordCountAndRawHashMatch: packetManifest?.records === packetRecords.length && contentHash(packetRaw) === packetManifest?.contentHash,
    snapshotBindingMatchesManifest: packetSnapshot?.contentHash === packetManifest?.contentHash && packetSnapshot?.createdAt === packetManifest?.createdAt,
    createdAtValid: validIsoTimestamp(packetManifest?.createdAt),
    packetPolicyBindingMatches: packetManifest?.source?.policy?.id === policy.inputPacketPolicy
      && packetManifest?.source?.policy?.contentHash === policy.inputPacketPolicyContentHash,
    packetGateAndCoverageMatch: audit.packetConsolidationComplete === true && audit.humanReviewComplete === false
      && audit.requirementsVariantsXpTimingAndMechanicsComplete === false && audit.completeActivityUniverse === false && audit.publishable === true
      && packetCoverage.packetCount === packetRecords.length && packetCoverage.completePacketCount === packetRecords.length
      && packetCoverage.packetMismatchCandidateKeys?.length === 0,
    semanticGatesClosed: semantic.nonBlankDecisionCandidateKeys?.length === 0
      && semantic.canonicalGameEntityIdentityCount === 0 && semantic.canonicalActivityIdentityCount === 0
      && semantic.repeatabilityClassificationCount === 0 && semantic.atomicityClassificationCount === 0
      && semantic.memberExpansionReviewedCount === 0 && semantic.requirementsVariantsXpTimingAndMechanicsCompleteCount === 0
      && semantic.optimizerEligibleCount === 0 && semantic.automaticVerificationCount === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function accountStateFindings(values = []) {
  const forbidden = /^(?:currentBaseLevel|targetBaseLevel|currentLevel|currentXp|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|bank|bankItems|playerName|username|preferences|currentAccount)$/i;
  const findings = [];
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
  return findings.sort();
}

export function auditActivityCandidatePriorityHumanReviewDecisionGuidance(records = [], {
  packetRecords = [], packetRaw = '', packetManifest = {}, packetSnapshot = {},
  policy = {}, packetPolicy = {}, decisionPolicy = {}, artifacts = null, contentHash = hash
} = {}) {
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionGuidancePolicy(policy, packetPolicy, decisionPolicy, contentHash);
  const manifestAssessment = packetManifestAssessment(packetRecords, packetRaw, packetManifest, packetSnapshot, policy, contentHash);
  const packetRevalidation = buildActivityCandidatePriorityHumanReviewDecisionImport({
    packetRecords,
    submissions: packetRecords.map(record => structuredClone(record.decisionTemplate)),
    policy: decisionPolicy,
    packetSnapshotContentHash: packetSnapshot.contentHash,
    packetSnapshotCreatedAt: packetSnapshot.createdAt,
    contentHash
  });
  const packetAudit = packetRevalidation.audit;
  const packetsRevalidated = packetAudit.packetCoverage?.completePacketCount === packetRecords.length
    && packetAudit.packetCoverage?.failedPacketCount === 0
    && packetAudit.submissionCoverage?.blankSubmissionCount === packetRecords.length
    && packetAudit.submissionCoverage?.invalidSubmissionCount === 0
    && packetRevalidation.records.length === 0
    && packetAudit.blockers?.includes('no_completed_human_review_decisions_submitted');
  const expected = compiled.valid && manifestAssessment.complete && packetsRevalidated
    ? packetRecords.map(packet => guidanceRecord(packet, packetSnapshot, policy, decisionPolicy, contentHash)) : [];
  const expectedByKey = new Map(expected.map(record => [record.guidanceKey, record]));
  const packetKeys = packetRecords.map(record => record.reviewPacketKey);
  const guidancePacketKeys = records.map(record => record.reviewPacketKey);
  const duplicatePacketKeys = duplicates(packetKeys);
  const duplicateGuidanceKeys = duplicates(records.map(record => record.guidanceKey));
  const missingGuidancePacketKeys = packetKeys.filter(key => !guidancePacketKeys.includes(key));
  const unexpectedGuidancePacketKeys = guidancePacketKeys.filter(key => !packetKeys.includes(key));
  const recordMismatches = records.filter(record => !expectedByKey.has(record.guidanceKey)
    || !same(record, expectedByKey.get(record.guidanceKey), contentHash)).map(record => record.guidanceKey || 'unknown');
  const orderMatches = records.every((record, index) => record.guidanceOrdinal === index + 1
    && record.batchOrdinal === Math.floor(index / policy.batchSize) + 1
    && record.batchItemOrdinal === (index % policy.batchSize) + 1);
  const requiredEvidenceKeyCount = records.reduce((sum, record) => sum + record.requiredReviewEvidenceKeys.length, 0);
  const requiredRevisionCount = records.reduce((sum, record) => sum + record.requiredReviewedSourceRevisions.length, 0);
  const evidenceDomainCount = records.reduce((sum, record) => sum + record.evidenceDomainGuidance.length, 0);
  const vocabularyMatches = records.filter(record => !same(record.decisionVocabulary, decisionVocabulary(decisionPolicy), contentHash)).map(record => record.guidanceKey);
  const identityProjectionMismatches = records.filter(record => {
    const packet = packetRecords.find(item => item.reviewPacketKey === record.reviewPacketKey);
    return !packet || !same(record.canonicalGameEntityIdentityProjection, canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket(packet), contentHash)
      || !same(record.canonicalActivityIdentityProjection, canonicalActivityIdentityProposalForActivityCandidatePriorityPacket(packet), contentHash);
  }).map(record => record.guidanceKey);
  const blankTemplateMismatches = records.filter(record => {
    const packet = packetRecords.find(item => item.reviewPacketKey === record.reviewPacketKey);
    return !packet || !same(record.blankDecisionTemplate, packet.decisionTemplate, contentHash);
  }).map(record => record.guidanceKey);
  const expectedArtifacts = buildActivityCandidatePriorityHumanReviewDecisionGuidanceArtifacts(records, policy, contentHash);
  const artifactMismatches = [];
  if (artifacts) {
    if (!same(artifacts.batchIndexTsv, expectedArtifacts.batchIndexTsv, contentHash)) artifactMismatches.push('batch_index');
    if (!same(artifacts.artifactManifestJson, expectedArtifacts.artifactManifestJson, contentHash)) artifactMismatches.push('artifact_manifest');
    if (!same(artifacts.batches, expectedArtifacts.batches, contentHash)) artifactMismatches.push('batch_payloads');
  }
  const unsupportedPromotions = records.filter(record => record.humanDecisionSelected !== false
    || record.decisionRecorded !== false || record.semanticApplicationApplied !== false
    || record.memberKeys.length !== 0 || record.requirementsVariantsXpTimingAndMechanicsComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).map(record => record.guidanceKey);
  const accountFindings = accountStateFindings([...packetRecords, ...records]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('decision_guidance_policy_or_bound_policy_invalid');
  if (!manifestAssessment.complete) structuralBlockers.push('packet_manifest_snapshot_or_gate_revalidation_failed');
  if (!packetsRevalidated) structuralBlockers.push('one_or_more_packet_records_failed_guarded_importer_revalidation');
  if (duplicatePacketKeys.length || duplicateGuidanceKeys.length) structuralBlockers.push('duplicate_packet_or_guidance_keys');
  if (missingGuidancePacketKeys.length || unexpectedGuidancePacketKeys.length) structuralBlockers.push('packet_and_guidance_sets_do_not_match_exactly');
  if (recordMismatches.length || !orderMatches) structuralBlockers.push('one_or_more_guidance_records_do_not_match_expected_packet_order_or_content');
  if (vocabularyMatches.length || identityProjectionMismatches.length || blankTemplateMismatches.length) structuralBlockers.push('one_or_more_importer_vocabulary_projection_or_blank_template_bindings_mismatch');
  if (!artifacts || artifactMismatches.length) structuralBlockers.push('guidance_batch_artifacts_missing_or_not_deterministically_reconstructable');
  if (unsupportedPromotions.length) structuralBlockers.push('guidance_created_a_human_decision_or_semantic_optimizer_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    policyCoverage: compiled,
    packetCoverage: {
      packetRecordCount: packetRecords.length,
      manifestAssessment,
      guardedImporterPacketRevalidation: packetAudit.packetCoverage,
      blankSubmissionCount: packetAudit.submissionCoverage?.blankSubmissionCount || 0,
      invalidSubmissionCount: packetAudit.submissionCoverage?.invalidSubmissionCount || 0,
      packetsRevalidated
    },
    guidanceCoverage: {
      guidanceRecordCount: records.length,
      duplicatePacketKeys,
      duplicateGuidanceKeys,
      missingGuidancePacketKeys,
      unexpectedGuidancePacketKeys,
      recordMismatches,
      orderMatchesPacketOrder: orderMatches,
      sourceConflictGuidanceCount: records.filter(record => record.sourceDispositionOptions.length > 1).length,
      requiredEvidenceKeyCount,
      requiredRevisionCount,
      evidenceDomainCount,
      coherencePathCount: records.reduce((sum, record) => sum + record.coherencePaths.length, 0)
    },
    bindingCoverage: {
      exactVocabularyBindingCount: records.length - vocabularyMatches.length,
      vocabularyMismatchGuidanceKeys: vocabularyMatches,
      exactIdentityProjectionBindingCount: records.length - identityProjectionMismatches.length,
      identityProjectionMismatchGuidanceKeys: identityProjectionMismatches,
      exactBlankDecisionTemplateBindingCount: records.length - blankTemplateMismatches.length,
      blankDecisionTemplateMismatchGuidanceKeys: blankTemplateMismatches
    },
    artifactCoverage: {
      batchCount: artifacts?.batches?.length || 0,
      configuredBatchSize: policy.batchSize,
      largestBatchSize: Math.max(0, ...(artifacts?.batches || []).map(batch => batch.recordCount)),
      markdownArtifactCount: artifacts?.batches?.length || 0,
      machineGuidanceArtifactCount: artifacts?.batches?.length || 0,
      blankDecisionArtifactCount: artifacts?.batches?.length || 0,
      artifactManifestEntryCount: artifacts?.artifactManifest?.artifacts?.length || 0,
      artifactMismatches,
      deterministicArtifactReconstructionComplete: Boolean(artifacts) && artifactMismatches.length === 0
    },
    semanticPreservationCoverage: {
      humanDecisionSelectedCount: records.filter(record => record.humanDecisionSelected).length,
      decisionRecordedCount: records.filter(record => record.decisionRecorded).length,
      semanticApplicationCount: records.filter(record => record.semanticApplicationApplied).length,
      memberKeyCount: records.reduce((sum, record) => sum + record.memberKeys.length, 0),
      requirementsVariantsXpTimingAndMechanicsCompleteCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    guidanceMaterializationComplete: publishable,
    humanReviewComplete: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'all_priority_activity_candidate_human_decisions_pending',
      'canonical_identity_repeatability_atomicity_and_membership_not_applied',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildActivityCandidatePriorityHumanReviewDecisionGuidance({
  packetRecords = [], packetRaw = '', packetManifest = {}, packetSnapshot = {},
  policy = {}, packetPolicy = {}, decisionPolicy = {}, contentHash = hash
} = {}) {
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionGuidancePolicy(policy, packetPolicy, decisionPolicy, contentHash);
  const manifestAssessment = packetManifestAssessment(packetRecords, packetRaw, packetManifest, packetSnapshot, policy, contentHash);
  const packetRevalidation = buildActivityCandidatePriorityHumanReviewDecisionImport({
    packetRecords,
    submissions: packetRecords.map(record => structuredClone(record.decisionTemplate)),
    policy: decisionPolicy,
    packetSnapshotContentHash: packetSnapshot.contentHash,
    packetSnapshotCreatedAt: packetSnapshot.createdAt,
    contentHash
  });
  const packetsRevalidated = packetRevalidation.audit.packetCoverage?.completePacketCount === packetRecords.length
    && packetRevalidation.audit.packetCoverage?.failedPacketCount === 0
    && packetRevalidation.audit.submissionCoverage?.blankSubmissionCount === packetRecords.length
    && packetRevalidation.audit.submissionCoverage?.invalidSubmissionCount === 0;
  const records = compiled.valid && manifestAssessment.complete && packetsRevalidated
    ? packetRecords.map(packet => guidanceRecord(packet, packetSnapshot, policy, decisionPolicy, contentHash)) : [];
  const artifacts = buildActivityCandidatePriorityHumanReviewDecisionGuidanceArtifacts(records, policy, contentHash);
  return {
    records,
    artifacts,
    audit: auditActivityCandidatePriorityHumanReviewDecisionGuidance(records, {
      packetRecords, packetRaw, packetManifest, packetSnapshot,
      policy, packetPolicy, decisionPolicy, artifacts, contentHash
    })
  };
}
