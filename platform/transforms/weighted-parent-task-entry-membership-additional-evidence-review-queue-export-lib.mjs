import { hash } from '../ingestion/lib.mjs';
import { structuredCandidateReferencePresent } from '../ingestion/weighted-parent-task-entry-membership-additional-evidence-source-discovery-lib.mjs';
import { exactPinnedParentSectionEvidence } from './weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition-lib.mjs';

const REQUIRED_RULES = [
  'everyInputDispositionMustUseTheEligibleReviewRoute',
  'everyEligibleDispositionExportsExactlyOnce',
  'queueOrderMustPreserveDispositionOrder',
  'dispositionEvidenceAndSnapshotBindingsMustRevalidate',
  'allPinnedAndDiscoveredSourceIntegrityMustRemainComplete',
  'everyQueueEntryMustBindImmutableEvidenceAndSourceFingerprints',
  'readableArtifactMustUseOnlyExactStructuredCandidateLinesFromRetainedPinnedParentSections',
  'decisionTemplatesMustStartBlank',
  'exportDoesNotRecordAReviewDecisionReviewerDateNotesEvidenceOrMembership',
  'confirmationWouldNotProveIdentityWeightMappingCompletenessRepeatabilityMechanicsOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DECISIONS = [
  'confirm_parent_section_declares_candidate_as_task_member',
  'reject_parent_section_declares_candidate_as_task_member',
  'needs_additional_evidence'
];
const CONFIRMATION_DOES_NOT_PROVE = [
  'candidate_member_identity',
  'candidate_specific_task_weight',
  'declared_total_mapping',
  'member_universe_completeness',
  'repeatability',
  'requirements',
  'xp',
  'timing',
  'mechanics',
  'optimizer_eligibility'
];
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const allTrue = value => value && typeof value === 'object' && Object.values(value).length > 0 && Object.values(value).every(Boolean);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|title|titles|candidateKey|candidateKeys|structuralCandidateKey|structuralCandidateKeys|label|labels|alias|aliases|override|overrides)$/i;
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
  return unique(findings).sort();
}

export function compileWeightedMembershipAdditionalEvidenceReviewQueueExportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.evidencePacketContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-source-discovery.v1'
    && policy.inputContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition.v1'
    && policy.queueContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-review-queue-entry.v1'
    && policy.decisionTemplateContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-review-decision-template.v1'
    && policy.auditContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-review-queue-export-audit.v1'
    && policy.evidencePacketState === 'revision_pinned_weighted_membership_additional_source_discovery_gates_closed'
    && policy.inputState === 'weighted_membership_additional_evidence_sufficiency_disposition_gates_closed'
    && policy.eligibleClassification === 'exact_candidate_reference_in_pinned_parent_relationship_section_review_required'
    && policy.eligibleReviewRoute === 'exact_parent_section_membership_review'
    && policy.queueState === 'pending_explicit_source_bound_parent_section_membership_review';
  const decisionsValid = same(policy.allowedDecisions || [], EXPECTED_DECISIONS);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && decisionsValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    decisionsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function pageIntegrity(page = {}, contentHash = hash) {
  const checks = {
    markedComplete: page.complete === true,
    identityPresent: Boolean(page.sourceKey && Number(page.sourcePageId) > 0 && page.resolvedTitle && page.sourceRevision && page.sourceTimestamp && page.sourceUrl),
    completeSourcePresent: typeof page.sourceText === 'string',
    sourceHashMatches: typeof page.sourceText === 'string' && contentHash(page.sourceText) === page.sourceContentHash,
    sourceBytesMatch: typeof page.sourceText === 'string' && Buffer.byteLength(page.sourceText, 'utf8') === Number(page.sourceContentBytes)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function observationIntegrity(observation = {}, pagesByKey = new Map(), textField, hashField, contentHash = hash) {
  const page = pagesByKey.get(observation.sourceKey);
  const text = observation[textField];
  const checks = {
    sourceRetained: Boolean(page),
    exactTextPresent: typeof text === 'string' && text.length > 0,
    exactTextHashMatches: typeof text === 'string' && contentHash(text) === observation[hashField],
    exactTextOccursInSource: typeof text === 'string' && typeof page?.sourceText === 'string' && page.sourceText.includes(text)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function evidenceBinding(observation = {}, pagesByKey = new Map(), contentHash = hash) {
  const page = pagesByKey.get(observation.sourceKey);
  return {
    sourceKey: observation.sourceKey,
    sourceRevision: page?.sourceRevision || null,
    sourceContentHash: page?.sourceContentHash || null,
    heading: observation.heading ?? null,
    headingLine: observation.headingLine ?? null,
    lineStart: observation.lineStart ?? observation.line ?? null,
    lineEnd: observation.lineEnd ?? observation.line ?? null,
    exactEvidenceTextContentHash: observation.exactSectionTextContentHash || observation.exactSourceTextContentHash || null,
    observationContentHash: contentHash(observation)
  };
}

function sourcePacketIntegrity(packet = {}, policy = {}, contentHash = hash) {
  const pages = packet.candidateSourcePages || [];
  const pagesByKey = new Map(pages.map(page => [page.sourceKey, page]));
  const parentEvidence = exactPinnedParentSectionEvidence(packet, contentHash);
  const contextFailures = (packet.candidateParentContextObservations || []).filter(observation => !observationIntegrity(observation, pagesByKey, 'exactSectionText', 'exactSectionTextContentHash', contentHash).complete);
  const membershipFailures = (packet.candidateScopedMembershipSignalObservations || []).filter(observation => !observationIntegrity(observation, pagesByKey, 'exactSectionText', 'exactSectionTextContentHash', contentHash).complete
    || !['exact_structured_source_reference', 'exact_candidate_subject_page'].includes(observation.candidateMentionBasis));
  const weightFailures = (packet.candidateScopedWeightSignalObservations || []).filter(observation => !observationIntegrity(observation, pagesByKey, 'exactSourceText', 'exactSourceTextContentHash', contentHash).complete);
  const sourceKeys = [...pagesByKey.keys()].sort();
  const status = new Map((packet.requiredChannelStatus || []).map(item => [item.channel, item]));
  const relationshipObserved = (packet.candidateScopedMembershipSignalObservations || []).length > 0;
  const weightOrMembershipObserved = relationshipObserved || (packet.candidateScopedWeightSignalObservations || []).length > 0;
  const checks = {
    contractMatches: packet.contract === policy.evidencePacketContract,
    stateMatches: packet.state === policy.evidencePacketState,
    recordContentHashMatches: validHash(packet.recordContentHash) && contentHash(without(packet, 'recordContentHash', 'contentHash')) === packet.recordContentHash,
    snapshotRecordContentHashMatches: validHash(packet.contentHash) && contentHash(without(packet, 'contentHash')) === packet.contentHash,
    upstreamBindingsPresent: [packet.evidencePacketKey, packet.workQueueEntryKey, packet.sourceWorkQueueRecordContentHash, packet.sourceQueueSnapshotContentHash,
      packet.sourceDispositionKey, packet.sourceEvidencePacketContentHash, packet.evidenceFingerprint, packet.structuralCandidateKey].every(value => typeof value === 'string' && value.length > 0),
    pinnedSourcesComplete: Array.isArray(packet.pinnedSourceRevalidations) && packet.pinnedSourceRevalidations.length > 0
      && packet.pinnedSourceRevalidations.every(source => source.complete === true && allTrue(source.checks)),
    onePinnedParentSourcePresent: packet.pinnedSourceRevalidations.filter(source => source.sourceRoles?.includes('parent_inventory_source')).length === 1,
    discoveryQueriesComplete: Array.isArray(packet.discoveryQueries) && packet.discoveryQueries.length > 0
      && packet.discoveryQueries.every(query => query.continuationExhausted === true && query.truncated === false
        && query.returnedCount === query.results?.length && query.totalHits === query.results?.length),
    candidateSourcesComplete: pages.length > 0 && pages.every(page => pageIntegrity(page, contentHash).complete),
    newEvidenceKeysMatch: same([...(packet.newEvidenceKeys || [])].sort(), sourceKeys, contentHash),
    observationsComplete: contextFailures.length === 0 && membershipFailures.length === 0 && weightFailures.length === 0,
    exactPinnedParentEvidencePresent: parentEvidence.length > 0,
    relationshipChannelMatches: status.get('candidate_subject_parent_task_relationship_statement')?.satisfiedByCapturedEvidence === relationshipObserved,
    weightOrMembershipChannelMatches: status.get('candidate_scoped_weight_or_membership_statement')?.satisfiedByCapturedEvidence === weightOrMembershipObserved,
    humanReviewPending: status.get('explicit_source_bound_human_review')?.humanReviewRequired === true
      && status.get('explicit_source_bound_human_review')?.satisfiedByCapturedEvidence === false,
    sourceSilenceNotNegative: packet.sourceSilenceIsNotNegativeEvidence === true,
    reviewOpen: packet.evidenceReviewer === null && packet.evidenceReviewedAt === null && packet.evidenceNotes === null,
    semanticGatesClosed: packet.candidateMemberIdentityVerdict === null && packet.parentMembershipVerdict === null
      && packet.weightedTaskEntryMembershipVerdict === null && packet.repeatabilityVerdict === null
      && packet.mechanicsReviewComplete === false && packet.mappingVerdict === null && packet.inventoryCompletenessVerdict === null
      && packet.memberUniverseComplete === false && packet.optimizerEligible === false && packet.automaticVerificationApplied === false,
    accountIndependent: packet.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean), parentEvidence };
}

function dispositionIntegrity(disposition = {}, packet = {}, policy = {}, evidenceSnapshotContentHash = '', contentHash = hash) {
  const pagesByKey = new Map((packet.candidateSourcePages || []).map(page => [page.sourceKey, page]));
  const parentEvidence = exactPinnedParentSectionEvidence(packet, contentHash);
  const parentBindings = parentEvidence.map(observation => evidenceBinding(observation, pagesByKey, contentHash));
  const relationshipBindings = (packet.candidateScopedMembershipSignalObservations || []).map(observation => evidenceBinding(observation, pagesByKey, contentHash));
  const checks = {
    contractMatches: disposition.contract === policy.inputContract,
    stateMatches: disposition.state === policy.inputState,
    recordContentHashMatches: validHash(disposition.recordContentHash) && contentHash(without(disposition, 'recordContentHash', 'contentHash')) === disposition.recordContentHash,
    snapshotRecordContentHashMatches: validHash(disposition.contentHash) && contentHash(without(disposition, 'contentHash')) === disposition.contentHash,
    exactEligibleRoute: disposition.classification === policy.eligibleClassification && disposition.reviewRoute === policy.eligibleReviewRoute,
    packetBindingsMatch: disposition.sourceEvidencePacketKey === packet?.evidencePacketKey
      && disposition.sourceEvidencePacketRecordContentHash === packet?.recordContentHash
      && disposition.sourceEvidencePacketSnapshotContentHash === evidenceSnapshotContentHash,
    upstreamAndCandidateBindingsMatch: disposition.sourceWorkQueueEntryKey === packet?.workQueueEntryKey
      && disposition.sourceDispositionKey === packet?.sourceDispositionKey
      && disposition.structuralCandidateKey === packet?.structuralCandidateKey
      && disposition.candidateRole === packet?.candidateRole && same(disposition.candidateDisplay, packet?.candidateDisplay, contentHash),
    evidenceStatesMatch: disposition.parentSectionMembershipEvidenceState === 'exact_structured_candidate_reference_observed_on_pinned_parent_source_for_explicit_review'
      && disposition.candidateRelationshipContextEvidenceState === 'observed_for_explicit_review',
    allowedDecisionsMatch: same(disposition.allowedReviewDecisions, policy.allowedDecisions, contentHash),
    exactBindingsMatch: same(disposition.parentSectionEvidenceBindings, parentBindings, contentHash)
      && same(disposition.candidateRelationshipEvidenceBindings, relationshipBindings, contentHash),
    reviewOpen: disposition.reviewDecision === null && disposition.reviewer === null && disposition.reviewedAt === null && disposition.reviewNotes === null,
    semanticGatesClosed: disposition.candidateMemberIdentityVerdict === null && disposition.parentMembershipVerdict === null
      && disposition.weightedTaskEntryMembershipVerdict === null && disposition.repeatabilityVerdict === null
      && disposition.mechanicsReviewComplete === false && disposition.mappingVerdict === null && disposition.inventoryCompletenessVerdict === null
      && disposition.memberUniverseComplete === false && disposition.optimizerEligible === false && disposition.automaticVerificationApplied === false,
    accountIndependent: disposition.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean), parentEvidence };
}

function sourceIdentity(page = {}) {
  return {
    sourceKey: page.sourceKey,
    sourcePageId: page.sourcePageId,
    resolvedTitle: page.resolvedTitle,
    sourceRevision: page.sourceRevision,
    sourceTimestamp: page.sourceTimestamp,
    sourceUrl: page.sourceUrl,
    sourceContentHash: page.sourceContentHash,
    sourceContentBytes: page.sourceContentBytes
  };
}

function compactParentObservation(observation, packet, contentHash = hash) {
  const page = (packet.candidateSourcePages || []).find(item => item.sourceKey === observation.sourceKey);
  const candidate = String(observation.matchedCandidate || packet.candidateDisplay?.value || '').trim();
  const sectionLines = String(observation.exactSectionText || '').split(/\r?\n/);
  const pageLines = String(page?.sourceText || '').split(/\r?\n/);
  const exactMatchedLines = sectionLines.map((exactSourceText, offset) => ({
    lineNumber: Number(observation.lineStart) + offset,
    exactSourceText,
    exactSourceTextContentHash: contentHash(exactSourceText)
  })).filter(line => structuredCandidateReferencePresent(line.exactSourceText, candidate));
  const linesRevalidate = exactMatchedLines.length > 0 && exactMatchedLines.every(line => pageLines[line.lineNumber - 1] === line.exactSourceText);
  return {
    sourceKey: observation.sourceKey,
    resolvedTitle: page?.resolvedTitle || observation.resolvedTitle,
    sourceRevision: page?.sourceRevision || null,
    sourceUrl: page?.sourceUrl || null,
    sourceContentHash: page?.sourceContentHash || null,
    heading: observation.heading ?? null,
    headingLine: observation.headingLine ?? null,
    lineStart: observation.lineStart,
    lineEnd: observation.lineEnd,
    matchedCandidate: candidate,
    candidateMentionBasis: observation.candidateMentionBasis,
    exactSectionTextContentHash: observation.exactSectionTextContentHash,
    observationContentHash: contentHash(observation),
    exactMatchedLines,
    exactMatchedLinesRevalidated: linesRevalidate,
    semanticUse: 'exact_structured_candidate_lines_from_retained_pinned_parent_section_for_human_review_not_membership_verdict'
  };
}

function evidenceSourceIdentities(disposition, packet) {
  const keys = new Set([
    ...(disposition.parentSectionEvidenceBindings || []),
    ...(disposition.candidateRelationshipEvidenceBindings || [])
  ].map(binding => binding.sourceKey));
  return (packet.candidateSourcePages || []).filter(page => keys.has(page.sourceKey)).map(sourceIdentity);
}

function reviewScope(disposition, packet) {
  const parentKeys = new Set((disposition.parentSectionEvidenceBindings || []).map(binding => binding.sourceKey));
  const sourceRevisions = unique((packet.candidateSourcePages || []).filter(page => parentKeys.has(page.sourceKey)).map(page => page.sourceRevision)).sort();
  return {
    decisionScope: 'whether_the_exact_pinned_parent_section_declares_the_candidate_as_a_weighted_task_member',
    sourceRevisions,
    exactStructuredParentReferenceIsEvidenceNotAVerdict: true,
    confirmationDoesNotProve: [...CONFIRMATION_DOES_NOT_PROVE]
  };
}

function evidenceFingerprint(disposition, packet, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash = hash) {
  const exactParentSectionObservations = exactPinnedParentSectionEvidence(packet, contentHash).map(observation => compactParentObservation(observation, packet, contentHash));
  return contentHash({
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: packet.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: packet.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: evidenceSnapshotContentHash,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    candidateDisplay: disposition.candidateDisplay,
    classification: disposition.classification,
    parentSectionEvidenceBindings: disposition.parentSectionEvidenceBindings,
    candidateRelationshipEvidenceBindings: disposition.candidateRelationshipEvidenceBindings,
    exactParentSectionObservations,
    reviewScope: reviewScope(disposition, packet),
    allowedDecisions: disposition.allowedReviewDecisions
  });
}

function decisionTemplate(queueEntryKey, disposition, fingerprint, dispositionSnapshotContentHash, policy, contentHash = hash) {
  const base = {
    contract: policy.decisionTemplateContract,
    queueEntryKey,
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: disposition.sourceEvidencePacketKey,
    sourceEvidencePacketRecordContentHash: disposition.sourceEvidencePacketRecordContentHash,
    sourceEvidencePacketSnapshotContentHash: disposition.sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprint: fingerprint,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    decisionSourceRevisions: [],
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_source_bound_parent_section_membership_review_decision'
  };
  return { ...base, templateContentHash: contentHash(base) };
}

function queueEntry(disposition, packet, ordinal, dispositionSnapshotContentHash, evidenceSnapshotContentHash, policy, contentHash = hash) {
  const queueEntryKey = `${disposition.dispositionKey}|parent-section-membership-review-queue-entry`;
  const fingerprint = evidenceFingerprint(disposition, packet, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash);
  const template = decisionTemplate(queueEntryKey, disposition, fingerprint, dispositionSnapshotContentHash, policy, contentHash);
  const base = {
    contract: policy.queueContract,
    queueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: packet.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: packet.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: evidenceSnapshotContentHash,
    sourceWorkQueueEntryKey: disposition.sourceWorkQueueEntryKey,
    evidenceFingerprint: fingerprint,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    candidateDisplay: disposition.candidateDisplay,
    classification: disposition.classification,
    parentSectionMembershipEvidenceState: disposition.parentSectionMembershipEvidenceState,
    candidateRelationshipContextEvidenceState: disposition.candidateRelationshipContextEvidenceState,
    evidenceSourceIdentities: evidenceSourceIdentities(disposition, packet),
    parentSectionEvidenceBindings: disposition.parentSectionEvidenceBindings,
    candidateRelationshipEvidenceBindings: disposition.candidateRelationshipEvidenceBindings,
    exactParentSectionObservations: exactPinnedParentSectionEvidence(packet, contentHash).map(observation => compactParentObservation(observation, packet, contentHash)),
    reviewScope: reviewScope(disposition, packet),
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate: template,
    reviewDecision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mechanicsReviewComplete: false,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([...disposition.blockers, 'explicit_parent_section_membership_review_pending']),
    state: policy.queueState
  };
  return { ...base, recordContentHash: contentHash(base) };
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
  return unique(findings).sort();
}

function derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash = hash) {
  const compiled = compileWeightedMembershipAdditionalEvidenceReviewQueueExportPolicy(policy);
  const packetsByKey = new Map(evidencePackets.map(packet => [packet.evidencePacketKey, packet]));
  const duplicatePacketKeys = duplicates(evidencePackets.map(packet => packet.evidencePacketKey));
  const duplicateDispositionKeys = duplicates(dispositionRecords.map(record => record.dispositionKey));
  const packetAssessments = evidencePackets.map(packet => ({ key: packet.evidencePacketKey, integrity: sourcePacketIntegrity(packet, policy, contentHash) }));
  const dispositionAssessments = dispositionRecords.map(disposition => ({
    key: disposition.dispositionKey,
    integrity: dispositionIntegrity(disposition, packetsByKey.get(disposition.sourceEvidencePacketKey), policy, evidenceSnapshotContentHash, contentHash)
  }));
  const failures = [];
  if (!compiled.valid) failures.push('review_queue_export_policy_invalid_or_candidate_specific');
  if (!dispositionRecords.length || dispositionRecords.length !== evidencePackets.length) failures.push('input_disposition_and_evidence_packet_counts_do_not_match');
  if (!validHash(dispositionSnapshotContentHash) || !validHash(evidenceSnapshotContentHash)) failures.push('upstream_snapshot_hash_missing_or_invalid');
  if (duplicatePacketKeys.length || duplicateDispositionKeys.length) failures.push('duplicate_input_keys');
  if (packetAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_source_evidence_packets_failed_revalidation');
  if (dispositionAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_dispositions_failed_revalidation_or_eligible_route_requirement');
  if (accountStateFindings([...dispositionRecords, ...evidencePackets]).length) failures.push('current_account_state_present');
  const queueRecords = failures.length ? [] : dispositionRecords.map((disposition, index) => queueEntry(
    disposition, packetsByKey.get(disposition.sourceEvidencePacketKey), index + 1,
    dispositionSnapshotContentHash, evidenceSnapshotContentHash, policy, contentHash
  ));
  return { compiled, packetAssessments, dispositionAssessments, duplicatePacketKeys, duplicateDispositionKeys, failures, queueRecords };
}

function fenced(text) {
  let marker = '```';
  while (String(text).includes(marker)) marker += '`';
  return `${marker}text\n${text}\n${marker}`;
}

export function renderWeightedMembershipAdditionalEvidenceReviewQueueMarkdown(records = []) {
  const lines = [
    '# Weighted parent-task membership: exact parent-section review queue', '',
    'These entries require explicit human review. Exact structured references are evidence, not membership verdicts. No decision in this file is preselected.', ''
  ];
  for (const record of records) {
    lines.push(`## ${record.queueOrdinal}. ${record.candidateDisplay?.value || record.structuralCandidateKey}`, '');
    lines.push(`- Candidate role: \`${record.candidateRole}\``);
    lines.push(`- Review scope: \`${record.reviewScope.decisionScope}\``);
    lines.push(`- Source revisions: ${record.reviewScope.sourceRevisions.map(value => `\`${value}\``).join(', ')}`);
    lines.push(`- Queue entry: \`${record.queueEntryKey}\``, '');
    lines.push('### Exact pinned-parent evidence', '');
    for (const observation of record.exactParentSectionObservations) {
      lines.push(`- [${observation.resolvedTitle}](${observation.sourceUrl}), revision \`${observation.sourceRevision}\`, heading ${observation.heading ? `\`${observation.heading}\`` : '_lead_'}, lines ${observation.lineStart}-${observation.lineEnd}`);
      lines.push(`- Full retained section hash: \`${observation.exactSectionTextContentHash}\``);
      for (const exactLine of observation.exactMatchedLines) {
        lines.push(`- Exact candidate-bearing line ${exactLine.lineNumber}, hash \`${exactLine.exactSourceTextContentHash}\`:`, '', fenced(exactLine.exactSourceText), '');
      }
    }
    lines.push('### Allowed decisions', '');
    for (const decision of record.allowedDecisions) lines.push(`- \`${decision}\``);
    lines.push('', 'Decision: _blank_', 'Reviewer: _blank_', 'Reviewed at: _blank_', 'Notes: _blank_', '');
  }
  return `${lines.join('\n')}\n`;
}

export function serializeWeightedMembershipAdditionalEvidenceReviewDecisionTemplates(templates = []) {
  return templates.map(template => JSON.stringify(template)).join('\n') + (templates.length ? '\n' : '');
}

function unsupportedQueuePromotions(records = []) {
  return records.filter(record => record.reviewDecision !== null || record.reviewer !== null || record.reviewedAt !== null || record.reviewNotes !== null
    || record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null || record.weightedTaskEntryMembershipVerdict !== null
    || record.repeatabilityVerdict !== null || record.mechanicsReviewComplete !== false || record.mappingVerdict !== null
    || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete !== false || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false).map(record => record.queueEntryKey || 'unknown');
}

function nonBlankTemplates(templates = []) {
  return templates.filter(template => template.decision !== null || template.reviewer !== null || template.reviewedAt !== null
    || template.reviewNotes !== null || (template.decisionSourceRevisions || []).length > 0).map(template => template.queueEntryKey || 'unknown');
}

export function auditWeightedMembershipAdditionalEvidenceReviewQueueExport(records = [], {
  dispositionRecords = [], evidencePackets = [], policy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '',
  decisionTemplates = [], reviewMarkdown = '', decisionTemplateNdjson = '', contentHash = hash
} = {}) {
  const derived = derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash);
  const expectedKeys = dispositionRecords.map(record => record.dispositionKey);
  const outputKeys = records.map(record => record.sourceDispositionKey);
  const missingOutputKeys = expectedKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !expectedKeys.includes(key));
  const duplicateOutputKeys = duplicates(outputKeys);
  const recordMismatches = records.filter((record, index) => !derived.queueRecords[index] || !same(record, derived.queueRecords[index], contentHash)).map(record => record.queueEntryKey || 'unknown');
  const expectedTemplates = derived.queueRecords.map(record => record.decisionTemplate);
  const templateMismatches = decisionTemplates.filter((template, index) => !expectedTemplates[index] || !same(template, expectedTemplates[index], contentHash)).map(template => template.queueEntryKey || 'unknown');
  const expectedMarkdown = renderWeightedMembershipAdditionalEvidenceReviewQueueMarkdown(records);
  const expectedTemplateNdjson = serializeWeightedMembershipAdditionalEvidenceReviewDecisionTemplates(decisionTemplates);
  const queuePromotions = unsupportedQueuePromotions(records);
  const templatePromotions = nonBlankTemplates(decisionTemplates);
  const exactLineFailures = records.filter(record => !record.exactParentSectionObservations?.length
    || record.exactParentSectionObservations.some(observation => !observation.exactMatchedLinesRevalidated || !observation.exactMatchedLines?.length)).map(record => record.queueEntryKey || 'unknown');
  const accountFindings = accountStateFindings([...dispositionRecords, ...evidencePackets, ...records, ...decisionTemplates]);
  const failures = [...derived.failures];
  if (missingOutputKeys.length || unexpectedOutputKeys.length || duplicateOutputKeys.length || records.length !== dispositionRecords.length) failures.push('input_disposition_and_review_queue_sets_do_not_match_exactly');
  if (recordMismatches.length || templateMismatches.length || decisionTemplates.length !== records.length) failures.push('queue_or_decision_template_does_not_match_evidence_bound_derivation');
  if (reviewMarkdown !== expectedMarkdown || decisionTemplateNdjson !== expectedTemplateNdjson) failures.push('review_artifact_content_mismatch');
  if (exactLineFailures.length) failures.push('one_or_more_queue_entries_lacks_revalidated_exact_parent_candidate_lines');
  if (queuePromotions.length || templatePromotions.length) failures.push('queue_export_created_review_semantic_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const publishable = failures.length === 0;
  const allPages = evidencePackets.flatMap(packet => packet.candidateSourcePages || []);
  const allPinned = evidencePackets.flatMap(packet => packet.pinnedSourceRevalidations || []);
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputDispositionCount: dispositionRecords.length,
      inputEvidencePacketCount: evidencePackets.length,
      revalidatedDispositionCount: derived.dispositionAssessments.filter(item => item.integrity.complete).length,
      revalidatedEvidencePacketCount: derived.packetAssessments.filter(item => item.integrity.complete).length,
      duplicateDispositionKeys: derived.duplicateDispositionKeys,
      duplicateEvidencePacketKeys: derived.duplicatePacketKeys,
      dispositionSnapshotContentHash,
      evidenceSnapshotContentHash
    },
    policyCoverage: derived.compiled,
    sourceIntegrityCoverage: {
      retainedCurrentSourceCount: unique(allPages.map(page => page.sourceKey)).length,
      completeCurrentSourceCount: unique(allPages.filter(page => pageIntegrity(page, contentHash).complete).map(page => page.sourceKey)).length,
      retainedPinnedSourceCount: unique(allPinned.map(source => source.sourceKey)).length,
      completePinnedSourceCount: unique(allPinned.filter(source => source.complete === true && allTrue(source.checks)).map(source => source.sourceKey)).length,
      exactParentSectionObservationCount: records.reduce((sum, record) => sum + record.exactParentSectionObservations.length, 0),
      exactCandidateBearingLineCount: records.reduce((sum, record) => sum + record.exactParentSectionObservations.reduce((subtotal, observation) => subtotal + observation.exactMatchedLines.length, 0), 0),
      exactLineFailures
    },
    queueCoverage: {
      reviewQueueEntryCount: records.length,
      blankDecisionTemplateCount: decisionTemplates.length - templatePromotions.length,
      missingOutputKeys,
      unexpectedOutputKeys,
      duplicateOutputKeys,
      recordMismatches,
      templateMismatches
    },
    artifactCoverage: {
      markdownMatches: reviewMarkdown === expectedMarkdown,
      decisionTemplateNdjsonMatches: decisionTemplateNdjson === expectedTemplateNdjson,
      reviewMarkdownContentHash: contentHash(reviewMarkdown),
      decisionTemplateNdjsonContentHash: contentHash(decisionTemplateNdjson),
      reviewMarkdownBytes: Buffer.byteLength(reviewMarkdown, 'utf8'),
      decisionTemplateNdjsonBytes: Buffer.byteLength(decisionTemplateNdjson, 'utf8')
    },
    semanticPreservationCoverage: {
      recordedReviewDecisionCount: records.filter(record => record.reviewDecision !== null).length + decisionTemplates.filter(template => template.decision !== null).length,
      semanticVerdictCount: records.filter(record => record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null
        || record.weightedTaskEntryMembershipVerdict !== null || record.repeatabilityVerdict !== null || record.mechanicsReviewComplete
        || record.mappingVerdict !== null || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      unsupportedQueuePromotions: queuePromotions,
      nonBlankDecisionTemplates: templatePromotions
    },
    accountStateFindings: accountFindings,
    queueExportComplete: publishable,
    weightedMembershipReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(records.length ? ['exact_parent_section_membership_reviews_pending'] : []),
      'weighted_parent_task_entry_membership_not_proven',
      'member_universe_completeness_not_proven',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildWeightedMembershipAdditionalEvidenceReviewQueueExport({
  dispositionRecords = [], evidencePackets = [], policy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '', contentHash = hash
} = {}) {
  const derived = derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash);
  const records = derived.failures.length ? [] : derived.queueRecords;
  const decisionTemplates = records.map(record => record.decisionTemplate);
  const reviewMarkdown = renderWeightedMembershipAdditionalEvidenceReviewQueueMarkdown(records);
  const decisionTemplateNdjson = serializeWeightedMembershipAdditionalEvidenceReviewDecisionTemplates(decisionTemplates);
  const audit = auditWeightedMembershipAdditionalEvidenceReviewQueueExport(records, {
    dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
    decisionTemplates, reviewMarkdown, decisionTemplateNdjson, contentHash
  });
  return { records, decisionTemplates, reviewMarkdown, decisionTemplateNdjson, audit };
}
