import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'packetSnapshotAndDecisionFileMustBeExplicitlySelected',
  'packetManifestRawFileOuterAndIntrinsicHashesMustRevalidate',
  'embeddedCandidateEvidenceDispositionAndRoutingHashesMustRevalidate',
  'oneRecordedDecisionPerCompletedSubmission',
  'partialReviewBatchesAreAllowed',
  'blankTemplateRowsAreIgnored',
  'partiallyCompletedRowsAreRejected',
  'anyInvalidRowRejectsTheEntireBatch',
  'submissionKeysAndEvidenceDomainsMustMatchThePacketTemplateExactly',
  'submissionMustCitePacketPipelineSourceAndRevisionBindingsExactly',
  'everyEvidenceDomainRequiresAnAllowedStatusBoundEvidenceAndNotes',
  'subjectIdentityRepeatabilityAtomicityAndExpansionDecisionsMustBeExplicitAllowedAndCoherent',
  'proposedCanonicalIdentitiesMustEqualTheRevisionPinnedPacketProjection',
  'memberKeysCannotBeRecordedBeforeSeparateMemberExpansionApplication',
  'reviewerReviewedAtBoundSourceRevisionsAndNotesAreRequired',
  'reviewedAtMustNotPrecedeThePacketOrItsBoundEvidence',
  'obviousAutomaticOrModelReviewerNamesAreRejected',
  'recordingDoesNotApplyIdentityRepeatabilityAtomicityMembershipRequirementsVariantsXpTimingMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => !keys.includes(name)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const blank = value => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|title|titles|skill|skills|route|routes|label|labels|alias|aliases|override|overrides)$/i;
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
  return findings.sort();
}

function exactEnum(actual, expected) {
  return same(actual || [], expected);
}

export function compileActivityCandidatePriorityHumanReviewDecisionImportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.packetContract === 'sensum.activity-candidate-priority-human-review-packet.v1'
    && policy.submissionContract === 'sensum.activity-candidate-priority-human-review-decision-template.v1'
    && policy.recordContract === 'sensum.activity-candidate-priority-human-review-decision.v1'
    && policy.auditContract === 'sensum.activity-candidate-priority-human-review-decision-import-audit.v1'
    && policy.packetBatchSize === 5
    && policy.recordState === 'recorded_priority_activity_human_review_decision_pending_separate_semantic_application';
  const enumsValid = exactEnum(policy.packetStates, [
    'priority_activity_review_packet_materialized_source_conflict_pending',
    'priority_activity_review_packet_materialized_human_decision_pending'
  ]) && exactEnum(policy.allowedSubjectDispositionDecisions, [
    'confirm_one_bound_source_disposition',
    'reject_all_bound_source_dispositions',
    'additional_evidence_required'
  ]) && exactEnum(policy.allowedCanonicalGameEntityIdentityDecisions, [
    'confirm_bound_source_page_subject_identity',
    'reject_bound_source_page_subject_identity',
    'additional_evidence_required'
  ]) && exactEnum(policy.allowedCanonicalActivityIdentityDecisions, [
    'confirm_bound_source_subject_as_activity_container',
    'reject_bound_source_subject_as_activity_container',
    'additional_evidence_required'
  ]) && exactEnum(policy.allowedRepeatabilityDecisions, [
    'repeatable_activity',
    'non_repeatable_subject',
    'composite_or_collection_requires_expansion',
    'additional_evidence_required'
  ]) && exactEnum(policy.allowedAtomicityDecisions, [
    'atomic_activity_subject',
    'composite_activity_subject',
    'reference_collection_subject',
    'not_applicable_non_repeatable_subject',
    'additional_evidence_required'
  ]) && exactEnum(policy.allowedMemberExpansionDecisions, [
    'not_required_atomic_subject',
    'required_for_composite_subject',
    'required_for_reference_collection_subject',
    'not_applicable_non_repeatable_subject',
    'additional_evidence_required'
  ]) && exactEnum(policy.allowedEvidenceDomainStatuses, [
    'supported_by_bound_evidence',
    'not_supported_by_bound_evidence',
    'additional_evidence_required'
  ]);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && enumsValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    enumsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function decisionTemplateBlank(template = {}) {
  return template.subjectDispositionDecision === null
    && template.selectedSourceDisposition === null
    && template.canonicalGameEntityIdentityDecision === null
    && template.canonicalGameEntityIdentity === null
    && template.canonicalActivityIdentityDecision === null
    && template.canonicalActivityIdentity === null
    && template.repeatabilityDecision === null
    && template.atomicityDecision === null
    && template.memberExpansionDecision === null
    && Array.isArray(template.memberKeys) && template.memberKeys.length === 0
    && Array.isArray(template.reviewEvidenceKeys) && template.reviewEvidenceKeys.length === 0
    && Array.isArray(template.reviewedSourceRevisions) && template.reviewedSourceRevisions.length === 0
    && template.reviewer === null
    && template.reviewedAt === null
    && template.reviewNotes === null
    && Array.isArray(template.evidenceDomainAssessments)
    && template.evidenceDomainAssessments.every(item => item.status === null
      && item.notes === null
      && Array.isArray(item.evidenceKeys)
      && item.evidenceKeys.length === 0);
}

function recordHashValid(record, contentHash = hash) {
  return record && validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash;
}

function packetRecordIntegrity(packet = {}, policy = {}, contentHash = hash) {
  const template = packet.decisionTemplate || {};
  const requiredDomains = sorted(packet.reviewObligations?.requiredEvidenceDomains || []);
  const templateDomains = (template.evidenceDomainAssessments || []).map(item => item.domain);
  const pipeline = packet.pipelineBindings || {};
  const sourceIdentity = packet.sourcePageIdentity || {};
  const checks = {
    contractMatches: packet.contract === policy.packetContract,
    stateMatches: policy.packetStates?.includes(packet.state) === true,
    accountIndependent: packet.accountIndependent === true,
    ordinalsValid: Number.isInteger(packet.packetOrdinal) && packet.packetOrdinal > 0
      && Number.isInteger(packet.batchOrdinal) && packet.batchOrdinal > 0
      && Number.isInteger(packet.batchItemOrdinal) && packet.batchItemOrdinal > 0,
    keysPresent: typeof packet.reviewPacketKey === 'string' && packet.reviewPacketKey.length > 0
      && typeof packet.candidateKey === 'string' && packet.candidateKey.length > 0,
    packetRecordContentHashMatches: validHash(packet.recordContentHash)
      && contentHash(without(packet, 'recordContentHash', 'contentHash')) === packet.recordContentHash,
    packetOuterContentHashMatches: validHash(packet.contentHash)
      && contentHash(without(packet, 'contentHash')) === packet.contentHash,
    embeddedCandidateHashMatches: recordHashValid(packet.discoveryEvidence, contentHash),
    embeddedSourceEvidenceHashMatches: recordHashValid(packet.sourceEvidence, contentHash),
    embeddedSubjectDispositionHashMatches: recordHashValid(packet.subjectAssessment, contentHash),
    embeddedWorkRoutingHashMatches: recordHashValid(packet.workRoute, contentHash),
    pipelineHashesPresent: ['candidateContentHash', 'sourceEvidenceContentHash', 'subjectDispositionContentHash', 'workRoutingContentHash'].every(key => validHash(pipeline[key])),
    pipelineHashesMatchEmbeddedRecords: pipeline.candidateContentHash === packet.discoveryEvidence?.contentHash
      && pipeline.sourceEvidenceContentHash === packet.sourceEvidence?.contentHash
      && pipeline.subjectDispositionContentHash === packet.subjectAssessment?.contentHash
      && pipeline.workRoutingContentHash === packet.workRoute?.contentHash,
    pipelineChainMatches: packet.sourceEvidence?.sourceCandidateContentHash === packet.discoveryEvidence?.contentHash
      && packet.subjectAssessment?.sourceEvidenceContentHash === packet.sourceEvidence?.contentHash
      && packet.workRoute?.sourceDispositionContentHash === packet.subjectAssessment?.contentHash,
    sourceIdentityMatchesEmbeddedRecords: sourceIdentity.sourcePageId === packet.sourceEvidence?.sourcePageId
      && sourceIdentity.sourceRevision === packet.sourceEvidence?.sourceRevision
      && sourceIdentity.sourceTimestamp === packet.sourceEvidence?.sourceTimestamp
      && sourceIdentity.sourceContentHash === packet.sourceEvidence?.sourceContentHash
      && sourceIdentity.sourcePageId === packet.subjectAssessment?.sourcePageId
      && sourceIdentity.sourceRevision === packet.subjectAssessment?.sourceRevision
      && sourceIdentity.sourcePageId === packet.workRoute?.sourcePageId
      && sourceIdentity.sourceRevision === packet.workRoute?.sourceRevision,
    exactRevisionUrlMatches: packet.sourceExactRevisionUrl === `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${sourceIdentity.sourceRevision}`,
    blankTemplateContractMatches: template.contract === policy.submissionContract,
    blankTemplateKeysMatch: template.reviewPacketKey === packet.reviewPacketKey && template.candidateKey === packet.candidateKey,
    blankTemplateDomainsMatch: same(sorted(templateDomains), requiredDomains, contentHash)
      && unique(templateDomains).length === templateDomains.length,
    blankTemplateDecisionFieldsBlank: decisionTemplateBlank(template),
    semanticGatesClosed: packet.decisionRecorded === false
      && packet.canonicalGameEntityIdentity === null
      && packet.canonicalActivityIdentity === null
      && packet.repeatabilityClassification === null
      && packet.atomicityClassification === null
      && packet.memberExpansionReviewed === false
      && packet.requirementsVariantsXpTimingAndMechanicsComplete === false
      && packet.optimizerEligible === false
      && packet.automaticVerificationApplied === false
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function collectRevisionValues(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach(child => collectRevisionValues(child, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:source|guide|identity|renderedSource|unlockSource)Revision$/i.test(key)
      && (typeof child === 'string' || typeof child === 'number')
      && /^\d+$/.test(String(child))) result.push(String(child));
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
    if (/(?:Timestamp|ObservedAt)$/i.test(key) && validIsoTimestamp(child)) result.push(child);
    else collectEvidenceTimestamps(child, result);
  }
  return result;
}

export function boundSourceRevisionsForActivityCandidatePriorityPacket(packet = {}) {
  return sorted(unique(collectRevisionValues(packet)));
}

export function requiredReviewEvidenceKeysForActivityCandidatePriorityPacket(packet = {}) {
  return sorted([
    `packet-record-content-hash:${packet.recordContentHash}`,
    `candidate-content-hash:${packet.pipelineBindings?.candidateContentHash}`,
    `source-evidence-content-hash:${packet.pipelineBindings?.sourceEvidenceContentHash}`,
    `subject-disposition-content-hash:${packet.pipelineBindings?.subjectDispositionContentHash}`,
    `work-routing-content-hash:${packet.pipelineBindings?.workRoutingContentHash}`,
    `source-content-hash:${packet.sourcePageIdentity?.sourceContentHash}`,
    `source-revision:${packet.sourcePageIdentity?.sourceRevision}`
  ]);
}

export function canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket(packet = {}) {
  return {
    kind: 'revision_pinned_osrs_wiki_page_subject',
    stableGameEntityKey: packet.candidateKey,
    sourcePageId: packet.sourcePageIdentity?.sourcePageId,
    canonicalTitle: packet.sourcePageIdentity?.resolvedTitle,
    sourceRevision: packet.sourcePageIdentity?.sourceRevision,
    sourceContentHash: packet.sourcePageIdentity?.sourceContentHash
  };
}

export function canonicalActivityIdentityProposalForActivityCandidatePriorityPacket(packet = {}) {
  return {
    kind: 'revision_pinned_activity_container_candidate',
    stableActivityKey: `osrs-activity-pageid:${packet.sourcePageIdentity?.sourcePageId}`,
    sourceGameEntityKey: packet.candidateKey,
    sourcePageId: packet.sourcePageIdentity?.sourcePageId,
    canonicalTitle: packet.sourcePageIdentity?.resolvedTitle,
    sourceRevision: packet.sourcePageIdentity?.sourceRevision,
    sourceContentHash: packet.sourcePageIdentity?.sourceContentHash
  };
}

function reviewerLooksAutomatic(reviewer) {
  const value = String(reviewer || '').trim().toLowerCase();
  return /^(?:automatic|automation|system|codex|chatgpt|openai|sensum|ai|gpt(?:[- ]?\d.*)?)$/.test(value)
    || /\b(?:bot|automated reviewer|language model|ai reviewer)\b/.test(value);
}

function submissionShape(submission = {}) {
  const assessments = Array.isArray(submission.evidenceDomainAssessments) ? submission.evidenceDomainAssessments : [];
  const allBlank = blank(submission.subjectDispositionDecision)
    && blank(submission.selectedSourceDisposition)
    && blank(submission.canonicalGameEntityIdentityDecision)
    && blank(submission.canonicalGameEntityIdentity)
    && blank(submission.canonicalActivityIdentityDecision)
    && blank(submission.canonicalActivityIdentity)
    && blank(submission.repeatabilityDecision)
    && blank(submission.atomicityDecision)
    && blank(submission.memberExpansionDecision)
    && Array.isArray(submission.memberKeys) && submission.memberKeys.length === 0
    && assessments.every(item => blank(item.status) && blank(item.notes) && Array.isArray(item.evidenceKeys) && item.evidenceKeys.length === 0)
    && Array.isArray(submission.reviewEvidenceKeys) && submission.reviewEvidenceKeys.length === 0
    && Array.isArray(submission.reviewedSourceRevisions) && submission.reviewedSourceRevisions.length === 0
    && blank(submission.reviewer)
    && blank(submission.reviewedAt)
    && blank(submission.reviewNotes);
  return { allBlank, anyReviewField: !allBlank };
}

function availableSourceDispositions(packet = {}) {
  const subject = packet.subjectAssessment?.subjectDisposition || {};
  return subject.disposition ? [subject.disposition] : sorted(unique(subject.conflictingDispositions || []));
}

function coherenceChecks(submission, packet, policy, contentHash = hash) {
  const subjectConfirm = submission.subjectDispositionDecision === 'confirm_one_bound_source_disposition';
  const gameConfirm = submission.canonicalGameEntityIdentityDecision === 'confirm_bound_source_page_subject_identity';
  const gameReject = submission.canonicalGameEntityIdentityDecision === 'reject_bound_source_page_subject_identity';
  const activityConfirm = submission.canonicalActivityIdentityDecision === 'confirm_bound_source_subject_as_activity_container';
  const activityReject = submission.canonicalActivityIdentityDecision === 'reject_bound_source_subject_as_activity_container';
  const dispositions = availableSourceDispositions(packet);
  const atomicityToExpansion = {
    atomic_activity_subject: 'not_required_atomic_subject',
    composite_activity_subject: 'required_for_composite_subject',
    reference_collection_subject: 'required_for_reference_collection_subject',
    not_applicable_non_repeatable_subject: 'not_applicable_non_repeatable_subject',
    additional_evidence_required: 'additional_evidence_required'
  };
  return {
    subjectDispositionDecisionAllowed: policy.allowedSubjectDispositionDecisions?.includes(submission.subjectDispositionDecision) === true,
    selectedSourceDispositionCoherent: subjectConfirm
      ? dispositions.includes(submission.selectedSourceDisposition) && dispositions.length > 0
      : submission.selectedSourceDisposition === null,
    canonicalGameEntityDecisionAllowed: policy.allowedCanonicalGameEntityIdentityDecisions?.includes(submission.canonicalGameEntityIdentityDecision) === true,
    canonicalGameEntityProposalCoherent: gameConfirm
      ? same(submission.canonicalGameEntityIdentity, canonicalGameEntityIdentityProposalForActivityCandidatePriorityPacket(packet), contentHash)
      : submission.canonicalGameEntityIdentity === null,
    canonicalActivityDecisionAllowed: policy.allowedCanonicalActivityIdentityDecisions?.includes(submission.canonicalActivityIdentityDecision) === true,
    canonicalActivityProposalCoherent: activityConfirm
      ? gameConfirm && subjectConfirm && same(submission.canonicalActivityIdentity, canonicalActivityIdentityProposalForActivityCandidatePriorityPacket(packet), contentHash)
      : submission.canonicalActivityIdentity === null,
    rejectedGameEntityAlsoRejectsActivity: !gameReject || activityReject,
    repeatabilityDecisionAllowed: policy.allowedRepeatabilityDecisions?.includes(submission.repeatabilityDecision) === true,
    atomicityDecisionAllowed: policy.allowedAtomicityDecisions?.includes(submission.atomicityDecision) === true,
    memberExpansionDecisionAllowed: policy.allowedMemberExpansionDecisions?.includes(submission.memberExpansionDecision) === true,
    atomicityAndExpansionCoherent: atomicityToExpansion[submission.atomicityDecision] === submission.memberExpansionDecision,
    nonRepeatableCoherent: submission.repeatabilityDecision !== 'non_repeatable_subject'
      || (submission.atomicityDecision === 'not_applicable_non_repeatable_subject'
        && submission.memberExpansionDecision === 'not_applicable_non_repeatable_subject'
        && !activityConfirm),
    compositeRepeatabilityCoherent: submission.repeatabilityDecision !== 'composite_or_collection_requires_expansion'
      || ['composite_activity_subject', 'reference_collection_subject'].includes(submission.atomicityDecision),
    memberKeysRemainEmpty: Array.isArray(submission.memberKeys) && submission.memberKeys.length === 0
  };
}

function submissionAssessment(submission = {}, packet, policy = {}, packetSnapshotCreatedAt = '', contentHash = hash) {
  const shape = submissionShape(submission);
  const expectedDomains = sorted(packet?.reviewObligations?.requiredEvidenceDomains || []);
  const assessments = Array.isArray(submission.evidenceDomainAssessments) ? submission.evidenceDomainAssessments : [];
  const submittedDomains = assessments.map(item => item.domain);
  const expectedEvidenceKeys = requiredReviewEvidenceKeysForActivityCandidatePriorityPacket(packet || {});
  const expectedRevisions = boundSourceRevisionsForActivityCandidatePriorityPacket(packet || {});
  const bindingChecks = {
    packetExists: Boolean(packet),
    submissionKeysExact: packet ? same(sorted(Object.keys(submission)), sorted(Object.keys(packet.decisionTemplate || {})), contentHash) : false,
    contractMatches: submission.contract === policy.submissionContract,
    reviewPacketMatches: packet?.reviewPacketKey === submission.reviewPacketKey,
    candidateMatches: packet?.candidateKey === submission.candidateKey,
    evidenceDomainsExact: same(sorted(submittedDomains), expectedDomains, contentHash)
      && unique(submittedDomains).length === submittedDomains.length,
    evidenceAssessmentKeysExact: assessments.every(item => same(sorted(Object.keys(item || {})), ['domain', 'evidenceKeys', 'notes', 'status'], contentHash))
  };
  const evidenceTimestamps = collectEvidenceTimestamps(packet || {}).map(Date.parse);
  if (validIsoTimestamp(packetSnapshotCreatedAt)) evidenceTimestamps.push(Date.parse(packetSnapshotCreatedAt));
  const domainAssessmentsComplete = assessments.length === expectedDomains.length && assessments.every(item => {
    const evidenceKeys = Array.isArray(item.evidenceKeys) ? item.evidenceKeys : [];
    return policy.allowedEvidenceDomainStatuses?.includes(item.status) === true
      && evidenceKeys.length > 0
      && unique(evidenceKeys).length === evidenceKeys.length
      && evidenceKeys.every(key => expectedEvidenceKeys.includes(key))
      && typeof item.notes === 'string'
      && item.notes.trim().length > 0;
  });
  const coherence = shape.allBlank ? {} : coherenceChecks(submission, packet || {}, policy, contentHash);
  const contentChecks = shape.allBlank ? {} : {
    ...coherence,
    domainAssessmentsComplete,
    reviewEvidenceKeysExact: same(sorted(submission.reviewEvidenceKeys || []), expectedEvidenceKeys, contentHash)
      && unique(submission.reviewEvidenceKeys || []).length === (submission.reviewEvidenceKeys || []).length,
    reviewedSourceRevisionsExact: same(sorted(submission.reviewedSourceRevisions || []), expectedRevisions, contentHash)
      && unique((submission.reviewedSourceRevisions || []).map(String)).length === (submission.reviewedSourceRevisions || []).length,
    reviewerPresent: typeof submission.reviewer === 'string' && submission.reviewer.trim().length >= 3,
    reviewerNotObviouslyAutomatic: !reviewerLooksAutomatic(submission.reviewer),
    reviewedAtValid: validIsoTimestamp(submission.reviewedAt),
    reviewedAtNotBeforePacketOrEvidence: validIsoTimestamp(submission.reviewedAt)
      && evidenceTimestamps.length > 0
      && Date.parse(submission.reviewedAt) >= Math.max(...evidenceTimestamps),
    reviewNotesPresent: typeof submission.reviewNotes === 'string' && submission.reviewNotes.trim().length > 0
  };
  const bindingComplete = Object.values(bindingChecks).every(Boolean);
  const contentComplete = shape.allBlank || Object.values(contentChecks).every(Boolean);
  return {
    shape,
    bindingChecks,
    contentChecks,
    expectedEvidenceKeys,
    expectedRevisions,
    blank: shape.allBlank && bindingComplete,
    complete: shape.anyReviewField && !shape.allBlank && bindingComplete && contentComplete,
    partialOrInvalid: !bindingComplete || (shape.anyReviewField && !shape.allBlank && !contentComplete)
  };
}

function normalizedDomainAssessments(assessments = []) {
  return [...assessments].map(item => ({
    domain: item.domain,
    status: item.status,
    evidenceKeys: sorted(item.evidenceKeys || []),
    notes: item.notes.trim()
  })).sort((left, right) => left.domain.localeCompare(right.domain));
}

function decisionRecord(submission, packet, packetSnapshotContentHash, packetSnapshotCreatedAt, policy, contentHash = hash) {
  const normalized = {
    subjectDispositionDecision: submission.subjectDispositionDecision,
    selectedSourceDisposition: submission.selectedSourceDisposition,
    canonicalGameEntityIdentityDecision: submission.canonicalGameEntityIdentityDecision,
    canonicalGameEntityIdentity: submission.canonicalGameEntityIdentity,
    canonicalActivityIdentityDecision: submission.canonicalActivityIdentityDecision,
    canonicalActivityIdentity: submission.canonicalActivityIdentity,
    repeatabilityDecision: submission.repeatabilityDecision,
    atomicityDecision: submission.atomicityDecision,
    memberExpansionDecision: submission.memberExpansionDecision,
    memberKeys: [],
    evidenceDomainAssessments: normalizedDomainAssessments(submission.evidenceDomainAssessments),
    reviewEvidenceKeys: sorted(submission.reviewEvidenceKeys),
    reviewedSourceRevisions: sorted(submission.reviewedSourceRevisions),
    reviewer: submission.reviewer.trim(),
    reviewedAt: submission.reviewedAt,
    reviewNotes: submission.reviewNotes.trim()
  };
  const base = {
    contract: policy.recordContract,
    decisionKey: `${packet.reviewPacketKey}|human-review-decision|${contentHash(normalized)}`,
    reviewPacketKey: packet.reviewPacketKey,
    candidateKey: packet.candidateKey,
    sourcePacketSnapshotContentHash: packetSnapshotContentHash,
    sourcePacketSnapshotCreatedAt: packetSnapshotCreatedAt,
    sourcePacketRecordContentHash: packet.recordContentHash,
    sourcePacketOuterContentHash: packet.contentHash,
    pipelineBindings: structuredClone(packet.pipelineBindings),
    sourcePageIdentity: structuredClone(packet.sourcePageIdentity),
    subjectDispositionDecision: normalized.subjectDispositionDecision,
    selectedSourceDisposition: normalized.selectedSourceDisposition,
    canonicalGameEntityIdentityDecision: normalized.canonicalGameEntityIdentityDecision,
    reviewedCanonicalGameEntityIdentityProposal: normalized.canonicalGameEntityIdentity,
    canonicalActivityIdentityDecision: normalized.canonicalActivityIdentityDecision,
    reviewedCanonicalActivityIdentityProposal: normalized.canonicalActivityIdentity,
    repeatabilityDecision: normalized.repeatabilityDecision,
    atomicityDecision: normalized.atomicityDecision,
    memberExpansionDecision: normalized.memberExpansionDecision,
    memberKeys: [],
    evidenceDomainAssessments: normalized.evidenceDomainAssessments,
    reviewEvidenceKeys: normalized.reviewEvidenceKeys,
    reviewedSourceRevisions: normalized.reviewedSourceRevisions,
    reviewer: normalized.reviewer,
    reviewedAt: normalized.reviewedAt,
    reviewNotes: normalized.reviewNotes,
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

function preflight(packetRecords, submissions, policy, packetSnapshotContentHash, packetSnapshotCreatedAt, contentHash = hash) {
  const packetMap = new Map(packetRecords.map(record => [record.reviewPacketKey, record]));
  const assessments = submissions.map((submission, index) => {
    const packet = packetMap.get(submission.reviewPacketKey);
    return { index, submission, packet, assessment: submissionAssessment(submission, packet, policy, packetSnapshotCreatedAt, contentHash) };
  });
  const completed = assessments.filter(item => item.assessment.complete);
  const blanks = assessments.filter(item => item.assessment.blank);
  const invalid = assessments.filter(item => item.assessment.partialOrInvalid);
  const packetKeys = packetRecords.map(item => item.reviewPacketKey);
  const duplicatePacketKeys = duplicates(packetKeys);
  const duplicateCandidateKeys = duplicates(packetRecords.map(item => item.candidateKey));
  const duplicateSubmissionKeys = duplicates(submissions.map(item => item.reviewPacketKey));
  const packetIntegrityFailures = packetRecords
    .map(packet => ({ reviewPacketKey: packet.reviewPacketKey, integrity: packetRecordIntegrity(packet, policy, contentHash) }))
    .filter(item => !item.integrity.complete);
  const packetOrderValid = packetRecords.every((packet, index) => packet.packetOrdinal === index + 1
    && packet.batchOrdinal === Math.floor(index / policy.packetBatchSize) + 1
    && packet.batchItemOrdinal === (index % policy.packetBatchSize) + 1);
  const snapshotBindingValid = validHash(packetSnapshotContentHash) && validIsoTimestamp(packetSnapshotCreatedAt);
  const structuralFailures = [];
  if (duplicatePacketKeys.length) structuralFailures.push('duplicate_packet_keys');
  if (duplicateCandidateKeys.length) structuralFailures.push('duplicate_packet_candidate_keys');
  if (packetIntegrityFailures.length) structuralFailures.push('one_or_more_packet_records_failed_hash_pipeline_or_blank_template_revalidation');
  if (!packetOrderValid) structuralFailures.push('packet_order_or_batch_partition_invalid');
  if (!snapshotBindingValid) structuralFailures.push('packet_snapshot_hash_or_created_at_missing_or_invalid');
  if (duplicateSubmissionKeys.length) structuralFailures.push('duplicate_submission_review_packet_keys');
  if (invalid.length) structuralFailures.push('one_or_more_submission_rows_partial_stale_unknown_uncited_incoherent_or_invalid');
  if (!completed.length) structuralFailures.push('no_completed_human_review_decisions_submitted');
  const atomicAcceptable = structuralFailures.length === 0;
  const expectedRecords = atomicAcceptable
    ? completed.map(item => decisionRecord(item.submission, item.packet, packetSnapshotContentHash, packetSnapshotCreatedAt, policy, contentHash))
    : [];
  return {
    packetIntegrityFailures,
    packetOrderValid,
    snapshotBindingValid,
    duplicatePacketKeys,
    duplicateCandidateKeys,
    duplicateSubmissionKeys,
    assessments,
    completed,
    blanks,
    invalid,
    structuralFailures,
    atomicAcceptable,
    expectedRecords
  };
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
  return findings.sort();
}

export function auditActivityCandidatePriorityHumanReviewDecisionImport(records = [], {
  packetRecords = [],
  submissions = [],
  policy = {},
  packetSnapshotContentHash = '',
  packetSnapshotCreatedAt = '',
  contentHash = hash
} = {}) {
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionImportPolicy(policy);
  const flight = preflight(packetRecords, submissions, policy, packetSnapshotContentHash, packetSnapshotCreatedAt, contentHash);
  const expected = compiled.valid ? flight.expectedRecords : [];
  const completedKeys = flight.completed.map(item => item.submission.reviewPacketKey);
  const outputKeys = records.map(record => record.reviewPacketKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = completedKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !completedKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !expected[index] || !same(record, expected[index], contentHash))
    .map(record => record.decisionKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.semanticApplicationApplied !== false
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.repeatabilityClassification !== null
    || record.atomicityClassification !== null
    || record.memberExpansionApplied !== false
    || record.requirementsVariantsXpTimingAndMechanicsComplete !== false
    || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false).map(record => record.decisionKey || 'unknown');
  const accountFindings = accountStateFindings([...submissions, ...records]);
  const structuralBlockers = [...flight.structuralFailures];
  if (!compiled.valid) structuralBlockers.push('human_review_decision_import_policy_invalid_or_candidate_specific');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('completed_submission_and_recorded_decision_sets_do_not_match_exactly');
  if (recordMismatches.length) structuralBlockers.push('one_or_more_recorded_decisions_do_not_match_submission_and_packet_bindings');
  if (unsupportedPromotions.length) structuralBlockers.push('decision_import_created_unsupported_semantic_or_optimizer_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = compiled.valid && flight.atomicAcceptable && structuralBlockers.length === 0;
  const distribution = (name, allowed) => Object.fromEntries((allowed || []).map(value => [value, records.filter(record => record[name] === value).length]));
  return {
    contract: policy.auditContract,
    packetCoverage: {
      packetCount: packetRecords.length,
      completePacketCount: packetRecords.length - flight.packetIntegrityFailures.length,
      failedPacketCount: flight.packetIntegrityFailures.length,
      failedReviewPacketKeys: flight.packetIntegrityFailures.map(item => item.reviewPacketKey),
      duplicatePacketKeys: flight.duplicatePacketKeys,
      duplicateCandidateKeys: flight.duplicateCandidateKeys,
      packetOrderAndBatchPartitionValid: flight.packetOrderValid,
      packetSnapshotContentHash,
      packetSnapshotCreatedAt,
      packetSnapshotBindingValid: flight.snapshotBindingValid
    },
    submissionCoverage: {
      submissionRowCount: submissions.length,
      completedSubmissionCount: flight.completed.length,
      blankSubmissionCount: flight.blanks.length,
      invalidSubmissionCount: flight.invalid.length,
      invalidSubmissionRows: flight.invalid.map(item => ({
        index: item.index,
        reviewPacketKey: item.submission.reviewPacketKey || null,
        candidateKey: item.submission.candidateKey || null,
        bindingChecks: item.assessment.bindingChecks,
        contentChecks: item.assessment.contentChecks
      })),
      duplicateSubmissionKeys: flight.duplicateSubmissionKeys
    },
    policyCoverage: compiled,
    bindingCoverage: {
      completedSubmissionCount: flight.completed.length,
      exactPacketBindingCount: flight.completed.filter(item => Object.values(item.assessment.bindingChecks).every(Boolean)).length,
      exactEvidenceKeySetCount: flight.completed.filter(item => item.assessment.contentChecks.reviewEvidenceKeysExact).length,
      exactSourceRevisionSetCount: flight.completed.filter(item => item.assessment.contentChecks.reviewedSourceRevisionsExact).length,
      completeEvidenceDomainAssessmentCount: flight.completed.reduce((sum, item) => sum + item.submission.evidenceDomainAssessments.length, 0),
      explicitHumanReviewerCount: flight.completed.filter(item => item.assessment.contentChecks.reviewerPresent && item.assessment.contentChecks.reviewerNotObviouslyAutomatic).length,
      explicitPostPacketReviewedAtCount: flight.completed.filter(item => item.assessment.contentChecks.reviewedAtValid && item.assessment.contentChecks.reviewedAtNotBeforePacketOrEvidence).length,
      explicitReviewNotesCount: flight.completed.filter(item => item.assessment.contentChecks.reviewNotesPresent).length
    },
    recordCoverage: {
      recordedDecisionCount: records.length,
      remainingPacketDecisionCount: Math.max(0, packetRecords.length - records.length),
      duplicateOutputKeys,
      missingOutputKeys,
      unexpectedOutputKeys,
      recordMismatches,
      subjectDispositionDecisionDistribution: distribution('subjectDispositionDecision', policy.allowedSubjectDispositionDecisions),
      canonicalGameEntityIdentityDecisionDistribution: distribution('canonicalGameEntityIdentityDecision', policy.allowedCanonicalGameEntityIdentityDecisions),
      canonicalActivityIdentityDecisionDistribution: distribution('canonicalActivityIdentityDecision', policy.allowedCanonicalActivityIdentityDecisions),
      repeatabilityDecisionDistribution: distribution('repeatabilityDecision', policy.allowedRepeatabilityDecisions),
      atomicityDecisionDistribution: distribution('atomicityDecision', policy.allowedAtomicityDecisions),
      memberExpansionDecisionDistribution: distribution('memberExpansionDecision', policy.allowedMemberExpansionDecisions)
    },
    semanticPreservationCoverage: {
      semanticApplicationAppliedCount: records.filter(record => record.semanticApplicationApplied).length,
      appliedCanonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      appliedCanonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      appliedRepeatabilityOrAtomicityCount: records.filter(record => record.repeatabilityClassification !== null || record.atomicityClassification !== null).length,
      appliedMemberExpansionCount: records.filter(record => record.memberExpansionApplied).length,
      requirementsVariantsXpTimingAndMechanicsCompleteCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    reviewDecisionRecordingComplete: publishable,
    humanReviewComplete: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'recorded_human_decisions_require_separate_semantic_application',
      'canonical_game_entity_and_activity_identity_application_not_completed',
      'repeatability_atomicity_and_member_expansion_application_not_completed',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildActivityCandidatePriorityHumanReviewDecisionImport({
  packetRecords = [],
  submissions = [],
  policy = {},
  packetSnapshotContentHash = '',
  packetSnapshotCreatedAt = '',
  contentHash = hash
} = {}) {
  const compiled = compileActivityCandidatePriorityHumanReviewDecisionImportPolicy(policy);
  const flight = compiled.valid
    ? preflight(packetRecords, submissions, policy, packetSnapshotContentHash, packetSnapshotCreatedAt, contentHash)
    : { atomicAcceptable: false, expectedRecords: [] };
  const records = flight.atomicAcceptable ? flight.expectedRecords : [];
  return {
    records,
    audit: auditActivityCandidatePriorityHumanReviewDecisionImport(records, {
      packetRecords,
      submissions,
      policy,
      packetSnapshotContentHash,
      packetSnapshotCreatedAt,
      contentHash
    })
  };
}
