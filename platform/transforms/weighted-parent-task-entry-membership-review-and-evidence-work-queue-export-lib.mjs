import { hash, json } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'everyDispositionMustEnterExactlyOneOfThreeDisjointQueues',
  'queueOrderMustPreserveSourceDispositionOrderWithinEachRoute',
  'inputRecordSourcePacketDispositionAndChannelHashesMustRevalidate',
  'everyQueueEntryMustBindImmutableEvidenceAndSourceFingerprints',
  'onlyReviewRoutesMayProduceBlankDecisionTemplates',
  'reviewDecisionTemplatesMustStartBlank',
  'variantEvidenceQueueCannotSelectANameVersionOrVariantIndex',
  'additionalEvidenceQueueMustPreserveSourceSilenceAsAnEvidenceGap',
  'parentGlobalWeightAndDistributionEvidenceMustRemainNonCandidateContext',
  'readableArtifactsMustUseOnlyRetainedExactEvidence',
  'exportDoesNotRecordAReviewDecisionReviewerDateNotesEvidenceOrMembership',
  'reviewConfirmationWouldNotProveIdentityMappingCompletenessRepeatabilityMechanicsOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const ALL_ROUTES = [
  'numbered_alias_or_variant_scope_evidence_required',
  'candidate_scoped_weight_review_ready',
  'candidate_subject_corroboration_review_ready',
  'additional_candidate_membership_evidence_required'
];
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const equal = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const allTrue = value => value && typeof value === 'object' && Object.values(value).length > 0 && Object.values(value).every(item => item === true);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|title|titles|label|labels|alias|aliases|override|overrides)$/i;
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
  return [...new Set(findings)].sort();
}

export function compileWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.weighted-parent-task-entry-membership-evidence-disposition.v1'
    && policy.reviewQueueContract === 'sensum.weighted-parent-task-entry-membership-review-queue-entry.v1'
    && policy.decisionTemplateContract === 'sensum.weighted-parent-task-entry-membership-review-decision-template.v1'
    && policy.variantEvidenceQueueContract === 'sensum.weighted-parent-task-entry-membership-variant-scope-evidence-work-queue-entry.v1'
    && policy.additionalEvidenceQueueContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-work-queue-entry.v1'
    && policy.auditContract === 'sensum.weighted-parent-task-entry-membership-review-and-evidence-work-queue-export-audit.v1'
    && policy.inputState === 'weighted_parent_task_entry_membership_evidence_disposition_recorded_all_verdicts_closed';
  const reviewRoutes = policy.reviewRoutes || [];
  const routesValid = equal(reviewRoutes, ['candidate_scoped_weight_review_ready', 'candidate_subject_corroboration_review_ready'])
    && policy.variantEvidenceRoute === 'numbered_alias_or_variant_scope_evidence_required'
    && policy.additionalEvidenceRoute === 'additional_candidate_membership_evidence_required'
    && new Set([...reviewRoutes, policy.variantEvidenceRoute, policy.additionalEvidenceRoute]).size === ALL_ROUTES.length;
  const decisionsValid = equal(policy.allowedDecisions || [], [
    'confirm_source_supports_candidate_membership',
    'reject_source_supports_candidate_membership',
    'needs_additional_evidence'
  ]);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && routesValid && decisionsValid && !invalidRules.length && !forbidden.length,
    contractValid,
    routesValid,
    decisionsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function sourceIntegrity(source = {}) {
  const identity = source.sourcePageIdentity || {};
  const checks = {
    complete: source.complete === true,
    sourceKeyPresent: typeof source.sourceKey === 'string' && source.sourceKey.length > 0,
    rolesPresent: Array.isArray(source.roles) && source.roles.length > 0,
    identityComplete: Number(identity.sourcePageId) > 0 && typeof identity.resolvedTitle === 'string' && identity.resolvedTitle.length > 0
      && typeof identity.sourceRevision === 'string' && identity.sourceRevision.length > 0
      && typeof identity.sourceTimestamp === 'string' && identity.sourceTimestamp.length > 0
      && typeof identity.sourceUrl === 'string' && identity.sourceUrl.length > 0
      && typeof identity.sourceContentHash === 'string' && identity.sourceContentHash.length > 0
      && Number.isInteger(identity.sourceContentBytes) && identity.sourceContentBytes > 0,
    upstreamChecksComplete: allTrue(source.checks)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function channel(packet = {}, name) {
  return (packet.channelObservations || []).find(item => item.channel === name);
}

function evidenceCounts(packet = {}) {
  return {
    candidateScopedWeightStatementCount: channel(packet, 'candidate_scoped_same_line_weight_statement')?.observations?.length || 0,
    parentGlobalWeightStatementCount: channel(packet, 'parent_global_weight_statement')?.observations?.length || 0,
    parentDistributionStatementCount: channel(packet, 'parent_global_weight_statement')?.distributionObservations?.length || 0,
    candidateSubjectCorroborationCount: channel(packet, 'candidate_subject_corroboration')?.observations?.length || 0,
    numberedAliasOrVariantSignalCount: channel(packet, 'duplicate_alias_and_variant_signals')?.observations?.length || 0
  };
}

function routeFor(counts = {}) {
  if (counts.numberedAliasOrVariantSignalCount > 0) return 'numbered_alias_or_variant_scope_evidence_required';
  if (counts.candidateScopedWeightStatementCount > 0) return 'candidate_scoped_weight_review_ready';
  if (counts.candidateSubjectCorroborationCount > 0) return 'candidate_subject_corroboration_review_ready';
  return 'additional_candidate_membership_evidence_required';
}

function packetIntegrity(packet = {}, sourcesByKey = new Map(), contentHash = hash) {
  const sourceKeys = packet.sourceEvidenceKeys || [];
  const revision = channel(packet, 'exact_revision_source_revalidation');
  const occurrence = channel(packet, 'exact_parent_occurrence_binding');
  const verdict = channel(packet, 'weighted_membership_verdict_separation');
  const checks = {
    packetHashMatches: typeof packet.recordContentHash === 'string' && contentHash(without(packet, 'recordContentHash')) === packet.recordContentHash,
    captureComplete: packet.captureComplete === true && packet.state === 'revision_pinned_weighted_parent_task_entry_membership_evidence_captured_review_pending',
    sourceSetComplete: sourceKeys.length > 0 && duplicates(sourceKeys).length === 0 && sourceKeys.every(key => sourceIntegrity(sourcesByKey.get(key)).complete),
    sourceRevalidationChannelComplete: revision?.observations?.length === sourceKeys.length && revision.observations.every(item => item.complete === true && allTrue(item.checks)),
    parentOccurrenceComplete: occurrence?.observations?.length === 1 && occurrence.observations[0]?.integrity?.complete === true && allTrue(occurrence.observations[0]?.integrity?.checks),
    evidenceChannelsPresent: ['candidate_scoped_same_line_weight_statement', 'parent_global_weight_statement', 'candidate_subject_corroboration', 'duplicate_alias_and_variant_signals'].every(name => Array.isArray(channel(packet, name)?.observations)),
    distributionEvidencePresent: Array.isArray(channel(packet, 'parent_global_weight_statement')?.distributionObservations),
    semanticVerdictsNull: (packet.channelObservations || []).every(item => item.semanticVerdict === null)
      && packet.weightedTaskEntryMembershipVerdict === null && packet.candidateMemberIdentityVerdict === null
      && packet.mappingVerdict === null && packet.inventoryCompletenessVerdict === null,
    reviewSeparationIntact: verdict?.weightedTaskEntryMembershipVerdict === null && verdict?.automaticReviewForbidden === true,
    downstreamGatesClosed: packet.weightedMembershipSemanticEvidenceComplete === false && packet.memberUniverseComplete === false
      && packet.optimizerEligible === false && packet.automaticVerificationApplied === false && packet.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function dispositionIntegrity(disposition = {}, packet = {}, contentHash = hash) {
  const counts = evidenceCounts(packet);
  const checks = {
    keyAndPacketMatch: disposition.dispositionKey === `${packet.packetKey}|evidence-disposition` && disposition.packetKey === packet.packetKey,
    packetHashMatch: disposition.packetRecordContentHash === packet.recordContentHash,
    sourceAndCandidateBindingsMatch: disposition.workItemKey === packet.workItemKey
      && disposition.structuralCandidateKey === packet.structuralCandidateKey && disposition.candidateRole === packet.candidateRole
      && equal(disposition.sourceDispositionKeys, packet.sourceDispositionKeys, contentHash)
      && equal(disposition.sourceEvidenceKeys, packet.sourceEvidenceKeys, contentHash),
    channelBindingsMatch: equal(disposition.channelEvidenceBindings, (packet.channelObservations || []).map(item => ({ channel: item.channel, contentHash: contentHash(item) })), contentHash),
    evidenceCountsMatch: equal(disposition.evidenceCounts, counts, contentHash),
    routeMatchesGenericPriority: disposition.route === routeFor(counts) && ALL_ROUTES.includes(disposition.route),
    reviewReadinessMatchesRoute: disposition.reviewReady === ['candidate_scoped_weight_review_ready', 'candidate_subject_corroboration_review_ready'].includes(disposition.route),
    semanticGatesClosed: disposition.weightedTaskEntryMembershipVerdict === null && disposition.candidateMemberIdentityVerdict === null
      && disposition.mappingVerdict === null && disposition.inventoryCompletenessVerdict === null
      && disposition.memberUniverseComplete === false && disposition.optimizerEligible === false
      && disposition.automaticVerificationApplied === false && disposition.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function eligibleInput(record = {}, policy = {}, contentHash = hash) {
  const sources = record.weightedParentTaskEntryMembershipEvidenceSources || [];
  const packets = record.weightedParentTaskEntryMembershipEvidencePackets || [];
  const dispositions = record.weightedParentTaskEntryMembershipEvidenceDispositions || [];
  const summary = record.weightedParentTaskEntryMembershipEvidenceDisposition || {};
  const review = record.weightedParentTaskEntryMembershipEvidenceDispositionReview || {};
  const sourcesByKey = new Map(sources.map(source => [source.sourceKey, source]));
  const packetsByKey = new Map(packets.map(packet => [packet.packetKey, packet]));
  return record.contract === policy.inputContract && record.state === policy.inputState && record.accountIndependent === true
    && typeof record.contentHash === 'string' && contentHash(without(record, 'contentHash')) === record.contentHash
    && sources.length > 0 && sources.every(source => sourceIntegrity(source).complete)
    && packets.length > 0 && packets.every(packet => packetIntegrity(packet, sourcesByKey, contentHash).complete)
    && dispositions.length === packets.length && dispositions.every(item => dispositionIntegrity(item, packetsByKey.get(item.packetKey), contentHash).complete)
    && summary.dispositionCount === dispositions.length && Object.values(summary.routeCounts || {}).reduce((sum, count) => sum + count, 0) === dispositions.length
    && summary.weightedTaskEntryMembershipVerdictCount === 0 && summary.candidateMemberIdentityVerdictCount === 0
    && summary.mappingVerdictCount === 0 && summary.inventoryCompletenessVerdictCount === 0
    && summary.memberUniverseComplete === false && summary.optimizerEligibleCount === 0 && summary.automaticVerificationApplied === false
    && review.reviewedDispositionKeys?.length === 0 && review.reviewer === null && review.reviewedAt === null
    && review.reviewNotes === null && review.weightedTaskEntryMembershipVerdict === null && review.automaticVerificationApplied === false
    && record.weightedTaskEntryMembershipVerdict === null && record.memberUniverseComplete === false
    && record.optimizerEligible === false && record.automaticVerificationApplied === false;
}

export function selectWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportInputs(records = [], policy = {}, contentHash = hash) {
  return records.filter(record => eligibleInput(record, policy, contentHash));
}

function packetFor(record, disposition) {
  return (record.weightedParentTaskEntryMembershipEvidencePackets || []).find(packet => packet.packetKey === disposition.packetKey);
}

function sourceFor(record, packet, role) {
  const keys = new Set(packet.sourceEvidenceKeys || []);
  return (record.weightedParentTaskEntryMembershipEvidenceSources || []).find(source => keys.has(source.sourceKey) && source.roles?.includes(role));
}

function candidateDisplay(record, packet) {
  const source = sourceFor(record, packet, 'candidate_subject_source');
  return {
    value: source?.sourcePageIdentity?.resolvedTitle || packet.structuralCandidateKey,
    source: source ? {
      kind: 'retained_revision_pinned_candidate_subject_source_title',
      sourceKey: source.sourceKey,
      sourcePageId: source.sourcePageIdentity.sourcePageId,
      sourceRevision: source.sourcePageIdentity.sourceRevision,
      sourceContentHash: source.sourcePageIdentity.sourceContentHash
    } : { kind: 'structural_candidate_key_fallback', structuralCandidateKey: packet.structuralCandidateKey }
  };
}

function parentOccurrence(packet) {
  const item = channel(packet, 'exact_parent_occurrence_binding')?.observations?.[0];
  return item ? {
    occurrence: item.occurrence,
    exactSourceLine: item.integrity?.exactSourceLine,
    integrity: item.integrity
  } : null;
}

function sourceRevisions(record, packet) {
  const keys = new Set(packet.sourceEvidenceKeys || []);
  return unique((record.weightedParentTaskEntryMembershipEvidenceSources || [])
    .filter(source => keys.has(source.sourceKey)).map(source => source.sourcePageIdentity?.sourceRevision).filter(Boolean)).sort();
}

function evidenceBinding(record, disposition, packet, contentHash = hash) {
  return {
    sourceDispositionRecordContentHash: record.contentHash,
    sourceEvidenceRecordContentHash: record.sourceWeightedParentTaskEntryMembershipEvidenceContentHash,
    sourceDispositionKey: disposition.dispositionKey,
    sourceEvidencePacketKey: packet.packetKey,
    sourceEvidencePacketContentHash: packet.recordContentHash,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    sourceDispositionKeys: disposition.sourceDispositionKeys,
    sourceEvidenceKeys: disposition.sourceEvidenceKeys,
    channelEvidenceBindings: disposition.channelEvidenceBindings,
    evidenceCounts: disposition.evidenceCounts,
    route: disposition.route,
    parentOccurrenceContentHash: contentHash(parentOccurrence(packet))
  };
}

function blankDecisionTemplate(queueEntryKey, disposition, packet, evidenceFingerprint, policy) {
  return {
    contract: policy.decisionTemplateContract,
    queueEntryKey,
    sourceDispositionKey: disposition.dispositionKey,
    sourceEvidencePacketContentHash: packet.recordContentHash,
    evidenceFingerprint,
    allowedDecisions: [...policy.allowedDecisions],
    decisionSourceRevisions: [],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_source_bound_weighted_membership_review_decision'
  };
}

function commonEntry(record, disposition, packet, queueEntryKey, ordinal, evidenceFingerprint) {
  return {
    queueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionRecordContentHash: record.contentHash,
    sourceEvidenceRecordContentHash: record.sourceWeightedParentTaskEntryMembershipEvidenceContentHash,
    sourceDispositionKey: disposition.dispositionKey,
    sourceEvidencePacketKey: packet.packetKey,
    sourceEvidencePacketContentHash: packet.recordContentHash,
    evidenceFingerprint,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    candidateDisplay: candidateDisplay(record, packet),
    sourceRevisions: sourceRevisions(record, packet),
    weightedTaskEntryMembershipVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true
  };
}

function reviewEntry(record, disposition, packet, ordinal, policy, contentHash = hash) {
  const queueEntryKey = `${disposition.dispositionKey}|review-queue-entry`;
  const evidenceFingerprint = contentHash(evidenceBinding(record, disposition, packet, contentHash));
  const decisionTemplate = blankDecisionTemplate(queueEntryKey, disposition, packet, evidenceFingerprint, policy);
  return {
    contract: policy.reviewQueueContract,
    ...commonEntry(record, disposition, packet, queueEntryKey, ordinal, evidenceFingerprint),
    reviewEvidence: {
      route: disposition.route,
      evidenceCounts: disposition.evidenceCounts,
      parentOccurrence: parentOccurrence(packet),
      candidateScopedWeightStatements: channel(packet, 'candidate_scoped_same_line_weight_statement').observations,
      candidateSubjectCorroborations: channel(packet, 'candidate_subject_corroboration').observations,
      nonCandidateParentContext: {
        globalWeightStatements: channel(packet, 'parent_global_weight_statement').observations,
        distributionStatements: channel(packet, 'parent_global_weight_statement').distributionObservations,
        candidateMembershipProof: false
      }
    },
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate,
    state: 'pending_explicit_source_bound_weighted_membership_review'
  };
}

function variantEvidenceEntry(record, disposition, packet, ordinal, policy, contentHash = hash) {
  const queueEntryKey = `${disposition.dispositionKey}|variant-scope-evidence-work-entry`;
  const evidenceFingerprint = contentHash(evidenceBinding(record, disposition, packet, contentHash));
  return {
    contract: policy.variantEvidenceQueueContract,
    ...commonEntry(record, disposition, packet, queueEntryKey, ordinal, evidenceFingerprint),
    variantScopeEvidence: {
      route: disposition.route,
      evidenceCounts: disposition.evidenceCounts,
      parentOccurrence: parentOccurrence(packet),
      numberedAliasOrVariantSignals: channel(packet, 'duplicate_alias_and_variant_signals').observations,
      candidateScopedWeightStatements: channel(packet, 'candidate_scoped_same_line_weight_statement').observations,
      candidateSubjectCorroborations: channel(packet, 'candidate_subject_corroboration').observations
    },
    requiredEvidenceChannels: [
      'exact_candidate_name_or_variant_scope_binding',
      'candidate_specific_membership_evidence_after_scope_resolution',
      'explicit_source_bound_human_review'
    ],
    reviewCandidateVariantIndex: null,
    state: 'blocked_pending_numbered_alias_or_variant_scope_evidence'
  };
}

function additionalEvidenceEntry(record, disposition, packet, ordinal, policy, contentHash = hash) {
  const queueEntryKey = `${disposition.dispositionKey}|additional-membership-evidence-work-entry`;
  const evidenceFingerprint = contentHash(evidenceBinding(record, disposition, packet, contentHash));
  return {
    contract: policy.additionalEvidenceQueueContract,
    ...commonEntry(record, disposition, packet, queueEntryKey, ordinal, evidenceFingerprint),
    retainedEvidenceState: {
      route: disposition.route,
      evidenceCounts: disposition.evidenceCounts,
      parentOccurrence: parentOccurrence(packet),
      candidateScopedWeightStatements: [],
      candidateSubjectCorroborations: [],
      nonCandidateParentContext: {
        globalWeightStatements: channel(packet, 'parent_global_weight_statement').observations,
        distributionStatements: channel(packet, 'parent_global_weight_statement').distributionObservations,
        candidateMembershipProof: false
      }
    },
    requiredEvidenceChannels: [
      'candidate_subject_parent_task_relationship_statement',
      'candidate_scoped_weight_or_membership_statement',
      'explicit_source_bound_human_review'
    ],
    sourceSilenceIsNotNegativeEvidence: true,
    state: 'blocked_pending_additional_candidate_specific_membership_evidence'
  };
}

function markdownText(value) {
  return String(value ?? '').replace(/```/g, '` ` `');
}

function evidenceLines(observations = []) {
  if (!observations.length) return '_None retained._';
  return observations.map(item => `- Revision-pinned line: \`${markdownText(item.exactSourceLine || item.exactSourceText || item.matchedText || json(item))}\``).join('\n');
}

export function renderWeightedMembershipReviewQueueMarkdown(records = []) {
  const parts = ['# Weighted parent-task membership review queue', '', 'These entries are source-bound review candidates. No decision or membership verdict has been recorded.', ''];
  for (const record of records) {
    parts.push(`## ${record.queueOrdinal}. ${markdownText(record.candidateDisplay.value)}`, '', `- Candidate role: \`${record.candidateRole}\``, `- Review route: \`${record.reviewEvidence.route}\``, `- Source revisions: ${record.sourceRevisions.map(value => `\`${value}\``).join(', ')}`, '- Decision: **blank**', '', '### Exact parent occurrence', '', '```text', markdownText(record.reviewEvidence.parentOccurrence?.occurrence?.exactSourceText || record.reviewEvidence.parentOccurrence?.exactSourceLine || ''), '```', '', '### Candidate-scoped weight evidence', '', evidenceLines(record.reviewEvidence.candidateScopedWeightStatements), '', '### Candidate-subject corroboration', '', evidenceLines(record.reviewEvidence.candidateSubjectCorroborations), '', 'Parent-wide weights and distribution percentages are retained only as non-candidate context.', '');
  }
  return `${parts.join('\n').trimEnd()}\n`;
}

export function renderWeightedMembershipVariantEvidenceQueueMarkdown(records = []) {
  const parts = ['# Weighted membership variant-scope evidence work queue', '', 'No numbered name, version, alias, or variant index has been selected.', ''];
  for (const record of records) {
    parts.push(`## ${record.queueOrdinal}. ${markdownText(record.candidateDisplay.value)}`, '', `- Candidate role: \`${record.candidateRole}\``, `- Retained variant signals: ${record.variantScopeEvidence.numberedAliasOrVariantSignals.length}`, '- Review candidate variant index: **blank**', '- Required next evidence:', ...record.requiredEvidenceChannels.map(value => `  - \`${value}\``), '', '### Exact parent occurrence', '', '```text', markdownText(record.variantScopeEvidence.parentOccurrence?.occurrence?.exactSourceText || record.variantScopeEvidence.parentOccurrence?.exactSourceLine || ''), '```', '', '### Numbered alias or variant signals', '', evidenceLines(record.variantScopeEvidence.numberedAliasOrVariantSignals), '');
  }
  return `${parts.join('\n').trimEnd()}\n`;
}

export function renderWeightedMembershipAdditionalEvidenceQueueMarkdown(records = []) {
  const parts = ['# Weighted membership additional evidence work queue', '', 'These candidates have no retained candidate-specific membership evidence. Source silence is not a negative fact.', ''];
  for (const record of records) {
    parts.push(`## ${record.queueOrdinal}. ${markdownText(record.candidateDisplay.value)}`, '', `- Candidate role: \`${record.candidateRole}\``, '- Candidate-scoped weight statements: 0', '- Candidate-subject corroborations: 0', '- Required next evidence:', ...record.requiredEvidenceChannels.map(value => `  - \`${value}\``), '', '### Exact parent occurrence', '', '```text', markdownText(record.retainedEvidenceState.parentOccurrence?.occurrence?.exactSourceText || record.retainedEvidenceState.parentOccurrence?.exactSourceLine || ''), '```', '');
  }
  return `${parts.join('\n').trimEnd()}\n`;
}

export function serializeWeightedMembershipReviewDecisionTemplates(templates = []) {
  return templates.map(template => JSON.stringify(template)).join('\n') + (templates.length ? '\n' : '');
}

function buildOutputs(dispositionRecords = [], policy = {}, contentHash = hash) {
  const reviewRecords = [], variantEvidenceRecords = [], additionalEvidenceRecords = [];
  for (const record of dispositionRecords) {
    for (const disposition of record.weightedParentTaskEntryMembershipEvidenceDispositions || []) {
      const packet = packetFor(record, disposition);
      if (policy.reviewRoutes.includes(disposition.route)) reviewRecords.push(reviewEntry(record, disposition, packet, reviewRecords.length + 1, policy, contentHash));
      else if (disposition.route === policy.variantEvidenceRoute) variantEvidenceRecords.push(variantEvidenceEntry(record, disposition, packet, variantEvidenceRecords.length + 1, policy, contentHash));
      else if (disposition.route === policy.additionalEvidenceRoute) additionalEvidenceRecords.push(additionalEvidenceEntry(record, disposition, packet, additionalEvidenceRecords.length + 1, policy, contentHash));
    }
  }
  const decisionTemplates = reviewRecords.map(record => record.decisionTemplate);
  return {
    reviewRecords,
    decisionTemplates,
    variantEvidenceRecords,
    additionalEvidenceRecords,
    reviewMarkdown: renderWeightedMembershipReviewQueueMarkdown(reviewRecords),
    variantEvidenceMarkdown: renderWeightedMembershipVariantEvidenceQueueMarkdown(variantEvidenceRecords),
    additionalEvidenceMarkdown: renderWeightedMembershipAdditionalEvidenceQueueMarkdown(additionalEvidenceRecords),
    decisionTemplateNdjson: serializeWeightedMembershipReviewDecisionTemplates(decisionTemplates)
  };
}

function accountStateFindings(values = []) {
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i;
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
  return findings;
}

export function auditWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport(reviewRecords = [], {
  dispositionRecords = [], policy = {}, variantEvidenceRecords = [], additionalEvidenceRecords = [], decisionTemplates = [],
  reviewMarkdown = '', variantEvidenceMarkdown = '', additionalEvidenceMarkdown = '', decisionTemplateNdjson = '', contentHash = hash
} = {}) {
  const compiled = compileWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportPolicy(policy);
  const inputs = selectWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportInputs(dispositionRecords, policy, contentHash);
  const expected = compiled.valid ? buildOutputs(inputs, policy, contentHash) : buildOutputs([], policy, contentHash);
  const dispositions = inputs.flatMap(record => record.weightedParentTaskEntryMembershipEvidenceDispositions || []);
  const sources = inputs.flatMap(record => record.weightedParentTaskEntryMembershipEvidenceSources || []);
  const packets = inputs.flatMap(record => record.weightedParentTaskEntryMembershipEvidencePackets || []);
  const queueGroups = [reviewRecords, variantEvidenceRecords, additionalEvidenceRecords];
  const queueDispositionKeys = queueGroups.flat().map(item => item.sourceDispositionKey);
  const expectedDispositionKeys = dispositions.map(item => item.dispositionKey);
  const crossQueueKeys = unique(queueGroups.flatMap((group, index) => group.filter(item => queueGroups.some((other, otherIndex) => otherIndex !== index && other.some(entry => entry.sourceDispositionKey === item.sourceDispositionKey))).map(item => item.sourceDispositionKey)));
  const missingDispositionKeys = expectedDispositionKeys.filter(key => !queueDispositionKeys.includes(key));
  const unexpectedDispositionKeys = queueDispositionKeys.filter(key => !expectedDispositionKeys.includes(key));
  const duplicateQueueDispositionKeys = duplicates(queueDispositionKeys);
  const queueOutputMismatches = {
    review: equal(reviewRecords, expected.reviewRecords, contentHash) ? [] : reviewRecords.map(item => item.queueEntryKey),
    variantEvidence: equal(variantEvidenceRecords, expected.variantEvidenceRecords, contentHash) ? [] : variantEvidenceRecords.map(item => item.queueEntryKey),
    additionalEvidence: equal(additionalEvidenceRecords, expected.additionalEvidenceRecords, contentHash) ? [] : additionalEvidenceRecords.map(item => item.queueEntryKey),
    decisions: equal(decisionTemplates, expected.decisionTemplates, contentHash) ? [] : decisionTemplates.map(item => item.queueEntryKey)
  };
  const inputIntegrityFailures = dispositionRecords.filter(record => !eligibleInput(record, policy, contentHash)).map(item => item.sourceRoutingRecordContentHash || item.contentHash || 'unknown');
  const blankDecisionTemplateCount = decisionTemplates.filter(template => template.decision === null && template.reviewer === null && template.reviewedAt === null && template.reviewNotes === null && template.decisionSourceRevisions?.length === 0).length;
  const unsupportedPromotions = [...reviewRecords, ...variantEvidenceRecords, ...additionalEvidenceRecords].filter(item => item.weightedTaskEntryMembershipVerdict !== null || item.memberUniverseComplete !== false || item.optimizerEligible !== false || item.automaticVerificationApplied !== false || item.accountIndependent !== true).map(item => item.queueEntryKey);
  const invalidVariantSelections = variantEvidenceRecords.filter(item => item.reviewCandidateVariantIndex !== null).map(item => item.queueEntryKey);
  const invalidAdditionalSilence = additionalEvidenceRecords.filter(item => item.sourceSilenceIsNotNegativeEvidence !== true || item.retainedEvidenceState?.candidateScopedWeightStatements?.length !== 0 || item.retainedEvidenceState?.candidateSubjectCorroborations?.length !== 0).map(item => item.queueEntryKey);
  const artifactMismatches = [];
  if (reviewMarkdown !== expected.reviewMarkdown) artifactMismatches.push('review_markdown');
  if (variantEvidenceMarkdown !== expected.variantEvidenceMarkdown) artifactMismatches.push('variant_evidence_markdown');
  if (additionalEvidenceMarkdown !== expected.additionalEvidenceMarkdown) artifactMismatches.push('additional_evidence_markdown');
  if (decisionTemplateNdjson !== expected.decisionTemplateNdjson) artifactMismatches.push('decision_template_ndjson');
  const accountFindings = accountStateFindings([reviewRecords, variantEvidenceRecords, additionalEvidenceRecords, decisionTemplates]);
  const blockers = [];
  if (!compiled.valid) blockers.push('weighted_membership_queue_export_policy_invalid_or_specific');
  if (dispositionRecords.length !== inputs.length || inputIntegrityFailures.length) blockers.push('input_disposition_record_set_not_exactly_eligible_and_integrity_valid');
  if (missingDispositionKeys.length || unexpectedDispositionKeys.length || duplicateQueueDispositionKeys.length || crossQueueKeys.length) blockers.push('three_queue_partition_not_exact_disjoint_and_complete');
  if (Object.values(queueOutputMismatches).some(values => values.length)) blockers.push('one_or_more_queue_entries_or_decision_templates_do_not_match_policy_output');
  if (blankDecisionTemplateCount !== decisionTemplates.length || decisionTemplates.length !== reviewRecords.length) blockers.push('review_decision_templates_not_exactly_blank_and_one_per_review_entry');
  if (unsupportedPromotions.length || invalidVariantSelections.length || invalidAdditionalSilence.length) blockers.push('queue_export_created_unsupported_semantic_state_or_evidence_interpretation');
  if (artifactMismatches.length) blockers.push('readable_or_decision_artifacts_do_not_match_queue_records');
  if (accountFindings.length) blockers.push('current_account_state_present');
  const publishable = compiled.valid && dispositionRecords.length === inputs.length && !inputIntegrityFailures.length
    && !missingDispositionKeys.length && !unexpectedDispositionKeys.length && !duplicateQueueDispositionKeys.length && !crossQueueKeys.length
    && !Object.values(queueOutputMismatches).some(values => values.length) && blankDecisionTemplateCount === decisionTemplates.length
    && decisionTemplates.length === reviewRecords.length && !unsupportedPromotions.length && !invalidVariantSelections.length
    && !invalidAdditionalSilence.length && !artifactMismatches.length && !accountFindings.length;
  return {
    contract: policy.auditContract,
    inputCoverage: { inputDispositionRecordCount: dispositionRecords.length, eligibleDispositionRecordCount: inputs.length, dispositionCount: dispositions.length, inputIntegrityFailureCount: inputIntegrityFailures.length, inputIntegrityFailures },
    policyCoverage: compiled,
    sourcePacketAndDispositionIntegrityCoverage: { sourceCount: sources.length, packetCount: packets.length, dispositionCount: dispositions.length, completeSourcePacketAndDispositionSetCount: publishable ? dispositions.length : 0 },
    queuePartitionCoverage: {
      reviewQueueEntryCount: reviewRecords.length,
      blankDecisionTemplateCount,
      variantScopeEvidenceQueueEntryCount: variantEvidenceRecords.length,
      additionalMembershipEvidenceQueueEntryCount: additionalEvidenceRecords.length,
      totalQueueEntryCount: queueDispositionKeys.length,
      missingDispositionKeys,
      unexpectedDispositionKeys,
      duplicateQueueDispositionKeys,
      crossQueueKeys,
      queueOutputMismatches
    },
    artifactCoverage: {
      reviewMarkdownBytes: Buffer.byteLength(reviewMarkdown, 'utf8'),
      variantEvidenceMarkdownBytes: Buffer.byteLength(variantEvidenceMarkdown, 'utf8'),
      additionalEvidenceMarkdownBytes: Buffer.byteLength(additionalEvidenceMarkdown, 'utf8'),
      decisionTemplateNdjsonBytes: Buffer.byteLength(decisionTemplateNdjson, 'utf8'),
      artifactMismatches
    },
    semanticPreservationCoverage: { unsupportedPromotions, invalidVariantSelections, invalidAdditionalSilence },
    accountStateFindings: accountFindings,
    queueExportComplete: publishable && queueDispositionKeys.length === dispositions.length,
    weightedMembershipReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...blockers,
      'weighted_parent_task_entry_membership_reviews_pending',
      ...(variantEvidenceRecords.length ? ['numbered_alias_or_variant_scope_evidence_pending'] : []),
      ...(additionalEvidenceRecords.length ? ['additional_candidate_specific_membership_evidence_pending'] : []),
      'weighted_parent_task_entry_membership_not_proven',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'all_repeatability_evidence_domains_remain_unresolved',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport({
  dispositionRecords = [], policy = {}, contentHash = hash
} = {}) {
  const compiled = compileWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportPolicy(policy);
  const inputs = compiled.valid ? selectWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportInputs(dispositionRecords, policy, contentHash) : [];
  const output = buildOutputs(inputs, policy, contentHash);
  return {
    ...output,
    audit: auditWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport(output.reviewRecords, {
      dispositionRecords,
      policy,
      variantEvidenceRecords: output.variantEvidenceRecords,
      additionalEvidenceRecords: output.additionalEvidenceRecords,
      decisionTemplates: output.decisionTemplates,
      reviewMarkdown: output.reviewMarkdown,
      variantEvidenceMarkdown: output.variantEvidenceMarkdown,
      additionalEvidenceMarkdown: output.additionalEvidenceMarkdown,
      decisionTemplateNdjson: output.decisionTemplateNdjson,
      contentHash
    })
  };
}
