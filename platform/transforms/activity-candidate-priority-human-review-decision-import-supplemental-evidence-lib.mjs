import { hash } from '../ingestion/lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionImport } from './activity-candidate-priority-human-review-decision-import-lib.mjs';
import { buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance } from './activity-candidate-priority-source-conflict-augmented-human-review-guidance-lib.mjs';

const REQUIRED_RULES = [
  'allFourSnapshotsAndDecisionFileMustBeExplicitlySelected',
  'allManifestsRawRecordsOuterAndIntrinsicHashesMustRevalidate',
  'completePacketToAugmentedGuidanceChainMustRebuildExactly',
  'oneSubmissionMayTargetOnlyOneExactAugmentedConflictRecord',
  'baseDecisionProjectionMustPassTheExistingImporterUnchanged',
  'originalPacketEvidenceKeysRevisionsDomainsAndCoherenceCannotBeWeakened',
  'supplementalBindingsMustMatchTheExactEvidenceAndAugmentedGuidanceRecords',
  'supplementalEvidenceKeysAndRevisionsMustBeCompleteExactAndSeparate',
  'reviewedAtMustNotPrecedeAnyBoundPacketOrSupplementalEvidence',
  'supplementalReviewNotesAreRequired',
  'partialReviewBatchesAreAllowed',
  'blankTemplateRowsAreIgnored',
  'partiallyCompletedOrLegacyRowsAreRejected',
  'anyInvalidRowRejectsTheEntireBatch',
  'recordingDoesNotApplyIdentityRepeatabilityAtomicityMembershipRequirementsVariantsXpTimingMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...(values || [])].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, keys = []) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function validIso(value) {
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

export function compileActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidencePolicy(
  policy = {}, packetPolicy = {}, guidancePolicy = {}, additionalEvidencePolicy = {}, augmentedGuidancePolicy = {}, decisionPolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidBindings = [];
  const exact = (actualId, expectedId, actualHash, expectedPolicy) => actualId === expectedId && actualHash === contentHash(expectedPolicy);
  if (policy.policy !== 'sensum.activity-candidate-priority-human-review-decision-import-supplemental-evidence-policy.v1') invalidBindings.push('policy');
  if (!exact(policy.inputPacketPolicy, packetPolicy.policy, policy.inputPacketPolicyContentHash, packetPolicy)) invalidBindings.push('inputPacketPolicy');
  if (!exact(policy.inputGuidancePolicy, guidancePolicy.policy, policy.inputGuidancePolicyContentHash, guidancePolicy)) invalidBindings.push('inputGuidancePolicy');
  if (!exact(policy.inputAdditionalEvidencePolicy, additionalEvidencePolicy.policy, policy.inputAdditionalEvidencePolicyContentHash, additionalEvidencePolicy)) invalidBindings.push('inputAdditionalEvidencePolicy');
  if (!exact(policy.inputAugmentedGuidancePolicy, augmentedGuidancePolicy.policy, policy.inputAugmentedGuidancePolicyContentHash, augmentedGuidancePolicy)) invalidBindings.push('inputAugmentedGuidancePolicy');
  if (!exact(policy.inputDecisionImportPolicy, decisionPolicy.policy, policy.inputDecisionImportPolicyContentHash, decisionPolicy)) invalidBindings.push('inputDecisionImportPolicy');
  if (policy.inputPacketDomain !== augmentedGuidancePolicy.inputPacketDomain
    || policy.inputGuidanceDomain !== augmentedGuidancePolicy.inputGuidanceDomain
    || policy.inputAdditionalEvidenceDomain !== augmentedGuidancePolicy.inputAdditionalEvidenceDomain
    || policy.inputAugmentedGuidanceDomain !== augmentedGuidancePolicy.outputDomain) invalidBindings.push('inputDomains');
  if (policy.submissionContract !== 'sensum.activity-candidate-priority-human-review-decision-supplemental-evidence-template.v1'
    || policy.recordContract !== 'sensum.activity-candidate-priority-human-review-decision-supplemental-evidence-bound.v1'
    || policy.auditContract !== 'sensum.activity-candidate-priority-human-review-decision-import-supplemental-evidence-audit.v1'
    || policy.recordState !== 'recorded_priority_activity_human_review_decision_with_supplemental_evidence_pending_separate_semantic_application'
    || !policy.outputDomain) invalidBindings.push('contractsOrOutput');
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidRules.length && !invalidBindings.length && !forbidden.length,
    invalidRules: unique(invalidRules),
    invalidBindings,
    forbiddenPolicyPaths: forbidden
  };
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

function collectRevisionValues(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach(child => collectRevisionValues(child, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    if (/Revision$/i.test(key) && (typeof child === 'string' || typeof child === 'number') && /^\d+$/.test(String(child))) result.push(String(child));
    else if (/Revisions$/i.test(key) && Array.isArray(child)) child.filter(item => /^\d+$/.test(String(item))).forEach(item => result.push(String(item)));
    else collectRevisionValues(child, result);
  }
  return result;
}

function collectEvidenceTimestamps(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach(child => collectEvidenceTimestamps(child, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:Timestamp|ObservedAt|FetchedAt|CreatedAt)$/i.test(key) && validIso(child)) result.push(child);
    else collectEvidenceTimestamps(child, result);
  }
  return result;
}

export function requiredSupplementalReviewRevisionsForActivityCandidatePriorityConflict(evidence = {}) {
  return sorted(unique(collectRevisionValues(evidence)));
}

export function buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplate(augmented = {}, evidence = {}, augmentedSnapshotContentHash = null) {
  return {
    contract: 'sensum.activity-candidate-priority-human-review-decision-supplemental-evidence-template.v1',
    augmentedGuidanceKey: augmented.augmentedGuidanceKey,
    reviewPacketKey: augmented.reviewPacketKey,
    candidateKey: augmented.candidateKey,
    baseDecision: structuredClone(augmented.blankDecisionTemplate),
    supplementalEvidenceReview: {
      additionalEvidenceSnapshotContentHash: augmented.sourceBindings?.additionalEvidenceSnapshotContentHash,
      additionalEvidenceRecordContentHash: augmented.sourceBindings?.additionalEvidenceRecordContentHash,
      additionalEvidenceOuterContentHash: augmented.sourceBindings?.additionalEvidenceOuterContentHash,
      augmentedGuidanceSnapshotContentHash: augmentedSnapshotContentHash,
      augmentedGuidanceRecordContentHash: augmented.recordContentHash,
      augmentedGuidanceOuterContentHash: augmented.contentHash,
      evidenceKeys: [],
      reviewedSourceRevisions: [],
      notes: null
    }
  };
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
  return sorted(findings);
}

function validateInputs(context) {
  const {
    packetRecords = [], packetRaw = '', packetManifest = {}, packetSnapshot = {},
    guidanceRecords = [], guidanceRaw = '', guidanceManifest = {}, guidanceSnapshot = {},
    additionalEvidenceRecords = [], additionalEvidenceRaw = '', additionalEvidenceManifest = {}, additionalEvidenceSnapshot = {},
    augmentedGuidanceRecords = [], augmentedGuidanceRaw = '', augmentedGuidanceManifest = {}, augmentedGuidanceSnapshot = {},
    submissions = [], decisionFile = {},
    policy = {}, packetPolicy = {}, guidancePolicy = {}, additionalEvidencePolicy = {}, augmentedGuidancePolicy = {}, decisionPolicy = {}, contentHash = hash
  } = context;
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidencePolicy(
    policy, packetPolicy, guidancePolicy, additionalEvidencePolicy, augmentedGuidancePolicy, decisionPolicy, contentHash
  );
  const packetAssessment = snapshotAssessment(packetRaw, packetRecords, packetManifest, packetSnapshot, policy.inputPacketDomain, packetPolicy.policy, policy.inputPacketPolicyContentHash, contentHash);
  const guidanceAssessment = snapshotAssessment(guidanceRaw, guidanceRecords, guidanceManifest, guidanceSnapshot, policy.inputGuidanceDomain, guidancePolicy.policy, policy.inputGuidancePolicyContentHash, contentHash);
  const additionalEvidenceAssessment = snapshotAssessment(additionalEvidenceRaw, additionalEvidenceRecords, additionalEvidenceManifest, additionalEvidenceSnapshot, policy.inputAdditionalEvidenceDomain, additionalEvidencePolicy.policy, policy.inputAdditionalEvidencePolicyContentHash, contentHash);
  const augmentedGuidanceAssessment = snapshotAssessment(augmentedGuidanceRaw, augmentedGuidanceRecords, augmentedGuidanceManifest, augmentedGuidanceSnapshot, policy.inputAugmentedGuidanceDomain, augmentedGuidancePolicy.policy, policy.inputAugmentedGuidancePolicyContentHash, contentHash);
  const rebuilt = buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance({
    packetRecords, packetRaw, packetManifest, packetSnapshot,
    guidanceRecords, guidanceRaw, guidanceManifest, guidanceSnapshot,
    additionalEvidenceRecords, additionalEvidenceRaw, additionalEvidenceManifest, additionalEvidenceSnapshot,
    policy: augmentedGuidancePolicy, packetPolicy, guidancePolicy, additionalEvidencePolicy, decisionPolicy, contentHash
  });
  const expectedByKey = new Map(rebuilt.records.map(record => [record.augmentedGuidanceKey, record]));
  const augmentedGuidanceMismatches = augmentedGuidanceRecords.filter(record => {
    const expected = expectedByKey.get(record.augmentedGuidanceKey);
    return !recordHashesValid(record, contentHash) || !expected || !same(without(record, ['contentHash']), expected, contentHash);
  }).map(record => record.augmentedGuidanceKey || 'unknown');
  const augmentedKeys = augmentedGuidanceRecords.map(record => record.augmentedGuidanceKey);
  const expectedKeys = rebuilt.records.map(record => record.augmentedGuidanceKey);
  const augmentedSetAndOrderExact = !duplicates(augmentedKeys).length && same(augmentedKeys, expectedKeys, contentHash);
  const augmentedAudit = augmentedGuidanceManifest?.source?.audit || {};
  const augmentedAuditValid = augmentedAudit.contract === augmentedGuidancePolicy.auditContract
    && augmentedAudit.publishable === true && augmentedAudit.augmentedGuidanceMaterializationComplete === true
    && augmentedAudit.currentDecisionImporterSupportsSupplementalEvidence === false
    && augmentedAudit.humanReviewComplete === false && augmentedAudit.completeActivityUniverse === false
    && augmentedAudit.semanticPreservationCoverage?.humanDecisionSelectedCount === 0
    && augmentedAudit.semanticPreservationCoverage?.decisionRecordedCount === 0
    && augmentedAudit.semanticPreservationCoverage?.semanticApplicationCount === 0
    && augmentedAudit.semanticPreservationCoverage?.optimizerEligibleCount === 0;
  const decisionFileAssessment = {
    explicitDecisionFileSelected: decisionFile.explicit === true && typeof decisionFile.file === 'string' && decisionFile.file.length > 0,
    decisionFileContentHashValid: validHash(decisionFile.contentHash),
    decisionFileRowCountMatches: decisionFile.rows === submissions.length
  };
  decisionFileAssessment.complete = Object.values(decisionFileAssessment).every(Boolean);
  const complete = compiled.valid && packetAssessment.complete && guidanceAssessment.complete
    && additionalEvidenceAssessment.complete && augmentedGuidanceAssessment.complete
    && decisionFileAssessment.complete && rebuilt.audit.publishable
    && !augmentedGuidanceMismatches.length && augmentedSetAndOrderExact && augmentedAuditValid;
  return {
    complete, compiled, packetAssessment, guidanceAssessment, additionalEvidenceAssessment, augmentedGuidanceAssessment,
    rebuiltAugmentedGuidancePublishable: rebuilt.audit.publishable, augmentedGuidanceMismatches,
    augmentedSetAndOrderExact, augmentedAuditValid, decisionFileAssessment
  };
}

function submissionAssessment(submission, augmented, evidence, additionalEvidenceSnapshot, augmentedSnapshot, contentHash = hash) {
  const template = augmented && evidence
    ? buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplate(augmented, evidence, augmentedSnapshot.contentHash)
    : null;
  const supplemental = submission?.supplementalEvidenceReview || {};
  const baseDecision = submission?.baseDecision || {};
  const expectedEvidenceKeys = sorted(augmented?.supplementalEvidence?.supplementalReviewEvidenceKeys || []);
  const expectedRevisions = requiredSupplementalReviewRevisionsForActivityCandidatePriorityConflict(evidence || {});
  const baseBlank = template ? same(baseDecision, template.baseDecision, contentHash) : false;
  const supplementalBlank = Array.isArray(supplemental.evidenceKeys) && supplemental.evidenceKeys.length === 0
    && Array.isArray(supplemental.reviewedSourceRevisions) && supplemental.reviewedSourceRevisions.length === 0
    && supplemental.notes === null;
  const bindingChecks = {
    augmentedRecordExists: Boolean(augmented),
    evidenceRecordExists: Boolean(evidence),
    submissionKeysExact: same(sorted(Object.keys(submission || {})), ['augmentedGuidanceKey', 'baseDecision', 'candidateKey', 'contract', 'reviewPacketKey', 'supplementalEvidenceReview'], contentHash),
    contractMatches: submission?.contract === 'sensum.activity-candidate-priority-human-review-decision-supplemental-evidence-template.v1',
    identityMatches: submission?.augmentedGuidanceKey === augmented?.augmentedGuidanceKey
      && submission?.reviewPacketKey === augmented?.reviewPacketKey && submission?.candidateKey === augmented?.candidateKey,
    baseDecisionKeysExact: augmented ? same(sorted(Object.keys(baseDecision)), sorted(Object.keys(augmented.blankDecisionTemplate || {})), contentHash) : false,
    baseDecisionIdentityMatches: baseDecision.reviewPacketKey === augmented?.reviewPacketKey && baseDecision.candidateKey === augmented?.candidateKey,
    supplementalKeysExact: same(sorted(Object.keys(supplemental)), [
      'additionalEvidenceOuterContentHash', 'additionalEvidenceRecordContentHash', 'additionalEvidenceSnapshotContentHash',
      'augmentedGuidanceOuterContentHash', 'augmentedGuidanceRecordContentHash', 'augmentedGuidanceSnapshotContentHash',
      'evidenceKeys', 'notes', 'reviewedSourceRevisions'
    ], contentHash),
    supplementalBindingsExact: supplemental.additionalEvidenceSnapshotContentHash === augmented?.sourceBindings?.additionalEvidenceSnapshotContentHash
      && supplemental.additionalEvidenceRecordContentHash === evidence?.recordContentHash
      && supplemental.additionalEvidenceOuterContentHash === evidence?.contentHash
      && supplemental.augmentedGuidanceSnapshotContentHash === augmentedSnapshot.contentHash
      && supplemental.augmentedGuidanceRecordContentHash === augmented?.recordContentHash
      && supplemental.augmentedGuidanceOuterContentHash === augmented?.contentHash
  };
  const allBlank = baseBlank && supplementalBlank;
  const evidenceTimestamps = collectEvidenceTimestamps(evidence || {}).map(Date.parse);
  for (const value of [additionalEvidenceSnapshot.createdAt, augmentedSnapshot.createdAt, augmented?.originalGuidance?.sourcePageIdentity?.sourceTimestamp]) {
    if (validIso(value)) evidenceTimestamps.push(Date.parse(value));
  }
  const contentChecks = allBlank ? {} : {
    supplementalEvidenceKeysExact: same(sorted(supplemental.evidenceKeys || []), expectedEvidenceKeys, contentHash)
      && unique(supplemental.evidenceKeys || []).length === (supplemental.evidenceKeys || []).length,
    supplementalRevisionsExact: same(sorted(supplemental.reviewedSourceRevisions || []), expectedRevisions, contentHash)
      && unique((supplemental.reviewedSourceRevisions || []).map(String)).length === (supplemental.reviewedSourceRevisions || []).length,
    supplementalNotesPresent: typeof supplemental.notes === 'string' && supplemental.notes.trim().length > 0,
    reviewedAtCoversSupplementalEvidence: validIso(baseDecision.reviewedAt) && evidenceTimestamps.length > 0
      && Date.parse(baseDecision.reviewedAt) >= Math.max(...evidenceTimestamps),
    supplementalKeysRemainSeparateFromOriginalReviewKeys: Array.isArray(baseDecision.reviewEvidenceKeys)
      && (supplemental.evidenceKeys || []).every(key => !baseDecision.reviewEvidenceKeys.includes(key))
  };
  const bindingsComplete = Object.values(bindingChecks).every(Boolean);
  const contentComplete = allBlank || Object.values(contentChecks).every(Boolean);
  return {
    allBlank, completedCandidate: !allBlank && bindingsComplete && contentComplete,
    partialOrInvalid: !bindingsComplete || (!allBlank && !contentComplete),
    bindingChecks, contentChecks, expectedEvidenceKeys, expectedRevisions
  };
}

function preflight(context, validation) {
  const {
    packetRecords = [], additionalEvidenceRecords = [], additionalEvidenceSnapshot = {}, augmentedGuidanceRecords = [], augmentedGuidanceSnapshot = {},
    submissions = [], decisionPolicy = {}, contentHash = hash
  } = context;
  const augmentedByKey = new Map(augmentedGuidanceRecords.map(record => [record.augmentedGuidanceKey, record]));
  const evidenceByReviewPacket = new Map(additionalEvidenceRecords.map(record => [record.reviewPacketKey, record]));
  const assessed = submissions.map((submission, index) => {
    const augmented = augmentedByKey.get(submission.augmentedGuidanceKey);
    const evidence = augmented ? evidenceByReviewPacket.get(augmented.reviewPacketKey) : null;
    return { index, submission, augmented, evidence, assessment: submissionAssessment(submission, augmented, evidence, additionalEvidenceSnapshot, augmentedGuidanceSnapshot, contentHash) };
  });
  const blanks = assessed.filter(item => item.assessment.allBlank && !item.assessment.partialOrInvalid);
  const candidates = assessed.filter(item => item.assessment.completedCandidate);
  const invalid = assessed.filter(item => item.assessment.partialOrInvalid);
  const duplicateSubmissionKeys = duplicates(submissions.map(row => row.augmentedGuidanceKey).filter(value => typeof value === 'string' && value.length > 0));
  const baseImport = buildActivityCandidatePriorityHumanReviewDecisionImport({
    packetRecords,
    submissions: candidates.map(item => item.submission.baseDecision),
    policy: decisionPolicy,
    packetSnapshotContentHash: context.packetSnapshot.contentHash,
    packetSnapshotCreatedAt: context.packetSnapshot.createdAt,
    contentHash
  });
  const baseByPacket = new Map(baseImport.records.map(record => [record.reviewPacketKey, record]));
  const completed = candidates.filter(item => baseByPacket.has(item.augmented.reviewPacketKey));
  const structuralFailures = [];
  if (!validation.complete) structuralFailures.push('packet_guidance_evidence_or_augmented_guidance_revalidation_failed');
  if (duplicateSubmissionKeys.length) structuralFailures.push('duplicate_augmented_guidance_submission_keys');
  if (invalid.length) structuralFailures.push('one_or_more_submissions_partial_legacy_stale_unbound_or_invalid');
  if (!candidates.length) structuralFailures.push('no_completed_supplemental_evidence_bound_human_decisions_submitted');
  if (candidates.length && !baseImport.audit.publishable) structuralFailures.push('base_decision_projection_failed_existing_guarded_importer');
  if (completed.length !== candidates.length) structuralFailures.push('base_decision_record_set_does_not_match_completed_supplemental_submissions');
  const acceptable = !structuralFailures.length;
  return { assessed, blanks, candidates, completed, invalid, duplicateSubmissionKeys, baseImport, baseByPacket, structuralFailures, acceptable };
}

function decisionRecord(item, baseDecisionRecord, context) {
  const { policy, contentHash = hash, packetSnapshot, guidanceSnapshot, additionalEvidenceSnapshot, augmentedGuidanceSnapshot } = context;
  const supplemental = item.submission.supplementalEvidenceReview;
  const normalizedSupplemental = {
    additionalEvidenceSnapshotContentHash: supplemental.additionalEvidenceSnapshotContentHash,
    additionalEvidenceRecordContentHash: supplemental.additionalEvidenceRecordContentHash,
    additionalEvidenceOuterContentHash: supplemental.additionalEvidenceOuterContentHash,
    augmentedGuidanceSnapshotContentHash: supplemental.augmentedGuidanceSnapshotContentHash,
    augmentedGuidanceRecordContentHash: supplemental.augmentedGuidanceRecordContentHash,
    augmentedGuidanceOuterContentHash: supplemental.augmentedGuidanceOuterContentHash,
    evidenceKeys: sorted(supplemental.evidenceKeys),
    reviewedSourceRevisions: sorted(supplemental.reviewedSourceRevisions),
    notes: supplemental.notes.trim()
  };
  const base = {
    contract: policy.recordContract,
    supplementalDecisionKey: `${item.augmented.augmentedGuidanceKey}|supplemental-evidence-bound-decision|${contentHash({ baseDecisionKey: baseDecisionRecord.decisionKey, supplemental: normalizedSupplemental })}`,
    candidateKey: item.augmented.candidateKey,
    reviewPacketKey: item.augmented.reviewPacketKey,
    augmentedGuidanceKey: item.augmented.augmentedGuidanceKey,
    sourceBindings: {
      packetSnapshotContentHash: packetSnapshot.contentHash,
      guidanceSnapshotContentHash: guidanceSnapshot.contentHash,
      additionalEvidenceSnapshotContentHash: additionalEvidenceSnapshot.contentHash,
      augmentedGuidanceSnapshotContentHash: augmentedGuidanceSnapshot.contentHash,
      packetRecordContentHash: item.augmented.sourceBindings.packetRecordContentHash,
      packetOuterContentHash: item.augmented.sourceBindings.packetOuterContentHash,
      guidanceRecordContentHash: item.augmented.sourceBindings.guidanceRecordContentHash,
      guidanceOuterContentHash: item.augmented.sourceBindings.guidanceOuterContentHash,
      additionalEvidenceRecordContentHash: item.evidence.recordContentHash,
      additionalEvidenceOuterContentHash: item.evidence.contentHash,
      augmentedGuidanceRecordContentHash: item.augmented.recordContentHash,
      augmentedGuidanceOuterContentHash: item.augmented.contentHash
    },
    baseDecisionRecord: structuredClone(baseDecisionRecord),
    supplementalEvidenceReview: normalizedSupplemental,
    reviewDecisionRecorded: true,
    semanticApplicationApplied: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    atomicityClassification: null,
    memberExpansionApplied: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function derive(context) {
  const validation = validateInputs(context);
  const flight = preflight(context, validation);
  const records = flight.acceptable ? flight.completed.map(item => decisionRecord(item, flight.baseByPacket.get(item.augmented.reviewPacketKey), context)) : [];
  return { validation, flight, records };
}

export function auditActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence(records = [], context = {}) {
  const completeContext = { ...context, contentHash: context.contentHash || hash };
  const { validation, flight, records: expected } = derive(completeContext);
  const expectedByKey = new Map(expected.map(record => [record.supplementalDecisionKey, record]));
  const actualKeys = records.map(record => record.supplementalDecisionKey);
  const expectedKeys = expected.map(record => record.supplementalDecisionKey);
  const duplicateOutputKeys = duplicates(actualKeys);
  const recordMismatches = records.filter(record => !expectedByKey.has(record.supplementalDecisionKey)
    || !same(record, expectedByKey.get(record.supplementalDecisionKey), completeContext.contentHash)).map(record => record.supplementalDecisionKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.reviewDecisionRecorded !== true
    || record.semanticApplicationApplied !== false || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null || record.repeatabilityClassification !== null
    || record.atomicityClassification !== null || record.memberExpansionApplied !== false
    || record.requirementsVariantsXpTimingAndMechanicsComplete !== false || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true
    || record.baseDecisionRecord?.semanticApplicationApplied !== false || record.baseDecisionRecord?.optimizerEligible !== false
  ).map(record => record.supplementalDecisionKey || 'unknown');
  const accountFindings = accountStateFindings([...(context.submissions || []), ...records]);
  const structuralBlockers = [...flight.structuralFailures];
  if (duplicateOutputKeys.length || !same(actualKeys, expectedKeys, completeContext.contentHash)) structuralBlockers.push('completed_submission_and_recorded_decision_sets_do_not_match_exactly');
  if (recordMismatches.length) structuralBlockers.push('recorded_supplemental_decision_content_or_binding_mismatch');
  if (unsupportedPromotions.length) structuralBlockers.push('decision_import_created_unsupported_semantic_or_optimizer_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = validation.complete && flight.acceptable && !structuralBlockers.length;
  return {
    contract: context.policy?.auditContract,
    policyCoverage: validation.compiled,
    inputCoverage: {
      packetSnapshotAssessment: validation.packetAssessment,
      guidanceSnapshotAssessment: validation.guidanceAssessment,
      additionalEvidenceSnapshotAssessment: validation.additionalEvidenceAssessment,
      augmentedGuidanceSnapshotAssessment: validation.augmentedGuidanceAssessment,
      rebuiltAugmentedGuidancePublishable: validation.rebuiltAugmentedGuidancePublishable,
      augmentedGuidanceSetAndOrderExact: validation.augmentedSetAndOrderExact,
      augmentedGuidanceMismatches: validation.augmentedGuidanceMismatches,
      augmentedGuidanceAuditValid: validation.augmentedAuditValid,
      decisionFileAssessment: validation.decisionFileAssessment
    },
    submissionCoverage: {
      submissionRowCount: (context.submissions || []).length,
      completedSubmissionCount: flight.completed.length,
      blankSubmissionCount: flight.blanks.length,
      invalidSubmissionCount: flight.invalid.length,
      duplicateSubmissionKeys: flight.duplicateSubmissionKeys,
      invalidSubmissions: flight.invalid.map(item => ({
        index: item.index,
        augmentedGuidanceKey: item.submission.augmentedGuidanceKey || null,
        bindingChecks: item.assessment.bindingChecks,
        contentChecks: item.assessment.contentChecks
      }))
    },
    baseImporterCoverage: {
      invoked: flight.candidates.length > 0,
      publishable: flight.baseImport.audit.publishable,
      completedBaseDecisionCount: flight.baseImport.records.length,
      baseImporterBlockers: flight.baseImport.audit.blockers
    },
    supplementalBindingCoverage: {
      exactSupplementalBindingCount: flight.completed.filter(item => Object.values(item.assessment.bindingChecks).every(Boolean)).length,
      exactSupplementalEvidenceKeySetCount: flight.completed.filter(item => item.assessment.contentChecks.supplementalEvidenceKeysExact).length,
      exactSupplementalRevisionSetCount: flight.completed.filter(item => item.assessment.contentChecks.supplementalRevisionsExact).length,
      postEvidenceReviewedAtCount: flight.completed.filter(item => item.assessment.contentChecks.reviewedAtCoversSupplementalEvidence).length,
      supplementalNotesCount: flight.completed.filter(item => item.assessment.contentChecks.supplementalNotesPresent).length,
      supplementalKeysSeparatedFromOriginalCount: flight.completed.filter(item => item.assessment.contentChecks.supplementalKeysRemainSeparateFromOriginalReviewKeys).length
    },
    recordCoverage: {
      recordedDecisionCount: records.length,
      sourceConflictRecordCount: (context.augmentedGuidanceRecords || []).length,
      remainingSourceConflictDecisionCount: Math.max(0, (context.augmentedGuidanceRecords || []).length - records.length),
      duplicateOutputKeys,
      recordMismatches
    },
    semanticPreservationCoverage: {
      semanticApplicationCount: records.filter(record => record.semanticApplicationApplied).length,
      appliedIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null).length,
      appliedRepeatabilityAtomicityOrMembershipCount: records.filter(record => record.repeatabilityClassification !== null || record.atomicityClassification !== null || record.memberExpansionApplied).length,
      requirementsVariantsXpTimingAndMechanicsCompleteCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    supplementalEvidenceBoundDecisionRecordingComplete: publishable,
    allSourceConflictDecisionsRecorded: publishable && records.length === (context.augmentedGuidanceRecords || []).length,
    humanReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'recorded_human_decisions_require_separate_semantic_application',
      'remaining_priority_activity_human_decisions_pending',
      'canonical_identity_repeatability_atomicity_and_membership_not_applied',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence(context = {}) {
  const completeContext = { ...context, contentHash: context.contentHash || hash };
  const derived = derive(completeContext);
  const records = derived.records;
  return { records, audit: auditActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence(records, completeContext) };
}
