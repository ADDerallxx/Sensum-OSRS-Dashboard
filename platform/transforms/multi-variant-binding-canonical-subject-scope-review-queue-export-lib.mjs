import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'everyCanonicalSubjectScopeDispositionExportsExactlyOnce',
  'nonCanonicalReviewRoutesRemainOutsideThisQueue',
  'dispositionAndEvidenceSnapshotBindingsMustRevalidate',
  'allPinnedAndDiscoveredSourceIntegrityMustRemainComplete',
  'everyQueueEntryMustBindImmutableEvidenceAndSourceFingerprints',
  'queueOrderMustPreserveEligibleDispositionOrder',
  'markdownMustRetainExactMatchedObservationLinesAndRevisionIdentities',
  'decisionTemplatesMustStartBlank',
  'canonicalSubjectConfirmationCannotSelectANumberedVariant',
  'reviewQueueCannotContainAReviewCandidateVariantIndexOrBoundVariant',
  'exportDoesNotRecordAReviewDecisionReviewerDateNotesEvidenceOrBinding',
  'confirmationDoesNotProveMembershipRepeatabilityRequirementsXpTimingMechanicsMappingCompletenessOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DECISIONS = [
  'confirm_parent_occurrence_refers_to_canonical_subject_across_numbered_variants',
  'require_exact_numbered_variant_binding',
  'reject_parent_occurrence_subject_relation',
  'needs_additional_evidence'
];
const CONFIRMATION_DOES_NOT_PROVE = [
  'exact_numbered_variant_binding',
  'candidate_member_identity',
  'weighted_parent_membership',
  'repeatability',
  'requirements',
  'xp',
  'timing',
  'mechanics',
  'declared_total_mapping',
  'member_universe_completeness',
  'optimizer_eligibility'
];
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right) => hash(left) === hash(right);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

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

export function compileMultiVariantBindingCanonicalSubjectScopeReviewQueueExportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.evidencePacketContract === 'sensum.multi-variant-binding-additional-evidence-source-discovery.v1'
    && policy.inputContract === 'sensum.multi-variant-binding-additional-evidence-sufficiency-disposition.v1'
    && policy.queueContract === 'sensum.multi-variant-binding-canonical-subject-scope-review-queue-entry.v1'
    && policy.decisionTemplateContract === 'sensum.multi-variant-binding-canonical-subject-scope-review-decision-template.v1'
    && policy.auditContract === 'sensum.multi-variant-binding-canonical-subject-scope-review-queue-export-audit.v1'
    && policy.evidencePacketState === 'revision_pinned_additional_variant_binding_source_discovery_gates_closed'
    && policy.inputState === 'additional_variant_binding_evidence_sufficiency_disposition_gates_closed'
    && policy.eligibleClassification === 'canonical_subject_context_observed_exact_numbered_variant_alignment_absent'
    && policy.eligibleReviewRoute === 'canonical_subject_scope_review'
    && policy.queueState === 'pending_explicit_source_bound_canonical_subject_scope_review';
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
  const text = page.sourceText;
  const checks = {
    complete: page.complete === true,
    identityPresent: Number(page.sourcePageId) > 0 && typeof page.resolvedTitle === 'string' && page.resolvedTitle.length > 0
      && typeof page.sourceRevision === 'string' && page.sourceRevision.length > 0
      && typeof page.sourceTimestamp === 'string' && page.sourceTimestamp.length > 0
      && typeof page.sourceUrl === 'string' && page.sourceUrl.length > 0,
    sourceKeyPresent: typeof page.sourceKey === 'string' && page.sourceKey.length > 0,
    sourceTextPresent: typeof text === 'string',
    sourceHashMatches: typeof text === 'string' && contentHash(text) === page.sourceContentHash,
    sourceBytesMatch: typeof text === 'string' && Buffer.byteLength(text, 'utf8') === Number(page.sourceContentBytes)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function observationIntegrity(observation = {}, page = {}, kind = 'context', contentHash = hash) {
  if (!page?.sourceText) return false;
  if (kind === 'context') {
    const text = String(observation.exactSectionText || '');
    const folded = text.toLocaleLowerCase('en-US');
    const candidateTerms = observation.matchedCandidateTerms || [];
    return typeof observation.exactSectionText === 'string'
      && contentHash(observation.exactSectionText) === observation.exactSectionTextContentHash
      && page.sourceText.includes(observation.exactSectionText)
      && Number.isInteger(observation.lineStart) && Number.isInteger(observation.lineEnd)
      && observation.lineStart > 0 && observation.lineEnd >= observation.lineStart
      && candidateTerms.length > 0 && candidateTerms.some(term => folded.includes(String(term).toLocaleLowerCase('en-US')))
      && typeof observation.matchedParentAnchor === 'string' && folded.includes(observation.matchedParentAnchor.toLocaleLowerCase('en-US'))
      && observation.semanticUse === 'candidate_scoped_parent_context_evidence_not_numbered_variant_binding';
  }
  const line = page.sourceText.split(/\r?\n/)[Number(observation.line) - 1];
  return typeof observation.exactSourceText === 'string'
    && typeof line === 'string' && line.trim() === observation.exactSourceText.trim()
    && Number.isInteger(observation.variantIndex) && observation.variantIndex > 0
    && (kind === 'identity'
      ? observation.semanticUse === 'numbered_variant_identity_observation_not_task_alignment'
      : observation.semanticUse === 'source_authored_same_line_task_to_numbered_variant_alignment_review_evidence');
}

function evidencePacketIntegrity(packet = {}, policy = {}, contentHash = hash) {
  const pages = packet.candidateSourcePages || [];
  const pageByKey = new Map(pages.map(page => [page.sourceKey, page]));
  const context = packet.candidateScopedParentContextObservations || [];
  const identities = packet.numberedVariantIdentityObservations || [];
  const alignments = packet.exactTaskToNumberedVariantAlignmentObservations || [];
  const statusByChannel = new Map((packet.requiredChannelStatus || []).map(status => [status.channel, status]));
  const checks = {
    contractMatches: packet.contract === policy.evidencePacketContract,
    stateMatches: packet.state === policy.evidencePacketState,
    recordContentHashMatches: validHash(packet.recordContentHash) && contentHash(without(packet, 'recordContentHash', 'contentHash')) === packet.recordContentHash,
    snapshotRecordContentHashMatches: validHash(packet.contentHash) && contentHash(without(packet, 'contentHash')) === packet.contentHash,
    upstreamBindingsPresent: validHash(packet.sourceQueueSnapshotContentHash) && validHash(packet.sourceEvidencePacketContentHash)
      && validHash(packet.sourceWorkQueueEntryContentHash) && validHash(packet.sourceWorkQueueRecordContentHash)
      && validHash(packet.evidenceFingerprint),
    pinnedSourcesComplete: Array.isArray(packet.pinnedSourceRevalidations) && packet.pinnedSourceRevalidations.length > 0
      && packet.pinnedSourceRevalidations.every(source => source.complete === true && Object.values(source.checks || {}).length > 0 && Object.values(source.checks || {}).every(Boolean)),
    discoveryQueriesComplete: Array.isArray(packet.discoveryQueries) && packet.discoveryQueries.length > 0
      && packet.discoveryQueries.every(query => query.continuationExhausted === true && query.truncated === false
        && query.returnedCount === query.results?.length && query.totalHits === query.results?.length),
    candidateSourcesComplete: pages.length > 0 && pages.every(page => pageIntegrity(page, contentHash).complete),
    contextObservationsRevalidated: context.every(observation => observationIntegrity(observation, pageByKey.get(observation.sourceKey), 'context', contentHash)),
    identityObservationsRevalidated: identities.every(observation => observationIntegrity(observation, pageByKey.get(observation.sourceKey), 'identity', contentHash)),
    alignmentObservationsRevalidated: alignments.every(observation => observationIntegrity(observation, pageByKey.get(observation.sourceKey), 'alignment', contentHash)),
    channelStatesMatch: statusByChannel.get('candidate_scoped_parent_occurrence_context')?.satisfiedByCapturedEvidence === (context.length > 0)
      && statusByChannel.get('source_authored_numbered_variant_identity_alignment')?.satisfiedByCapturedEvidence === (alignments.length > 0)
      && statusByChannel.get('explicit_human_binding_review')?.satisfiedByCapturedEvidence === false
      && statusByChannel.get('explicit_human_binding_review')?.humanReviewRequired === true,
    reviewAndVariantOpen: packet.reviewCandidateVariantIndex === null && packet.bindingReviewDecision === null && packet.boundVariantIndex === null
      && packet.evidenceReviewer === null && packet.evidenceReviewedAt === null && packet.evidenceNotes === null,
    semanticGatesClosed: packet.candidateMemberIdentityVerdict === null && packet.parentMembershipVerdict === null
      && packet.weightedTaskEntryMembershipVerdict === null && packet.repeatabilityVerdict === null
      && packet.mechanicsReviewComplete === false && packet.mappingVerdict === null
      && packet.inventoryCompletenessVerdict === null && packet.memberUniverseComplete === false
      && packet.optimizerEligible === false && packet.automaticVerificationApplied === false,
    accountIndependent: packet.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function dispositionIntegrity(disposition = {}, packet = {}, policy = {}, evidenceSnapshotContentHash = '', contentHash = hash) {
  const canonical = disposition.classification === policy.eligibleClassification && disposition.reviewRoute === policy.eligibleReviewRoute;
  const checks = {
    contractMatches: disposition.contract === policy.inputContract,
    stateMatches: disposition.state === policy.inputState,
    recordContentHashMatches: validHash(disposition.recordContentHash) && contentHash(without(disposition, 'recordContentHash', 'contentHash')) === disposition.recordContentHash,
    snapshotRecordContentHashMatches: validHash(disposition.contentHash) && contentHash(without(disposition, 'contentHash')) === disposition.contentHash,
    packetKeyMatches: disposition.sourceEvidencePacketKey === packet?.evidencePacketKey,
    packetRecordHashMatches: disposition.sourceEvidencePacketRecordContentHash === packet?.recordContentHash,
    packetSnapshotHashMatches: disposition.sourceEvidencePacketSnapshotContentHash === evidenceSnapshotContentHash,
    candidateBindingsMatch: disposition.sourceDispositionKey === packet?.sourceDispositionKey
      && disposition.structuralCandidateKey === packet?.structuralCandidateKey
      && disposition.candidateRole === packet?.candidateRole
      && disposition.candidateDisplayName === packet?.candidateDisplayName,
    routeCoherent: canonical || disposition.reviewRoute !== policy.eligibleReviewRoute,
    canonicalEvidenceCoherent: !canonical || (disposition.canonicalSubjectContextEvidenceState === 'observed_for_explicit_scope_review'
      && disposition.exactNumberedVariantAlignmentEvidenceState === 'not_observed'
      && (packet?.candidateScopedParentContextObservations || []).length > 0
      && (packet?.exactTaskToNumberedVariantAlignmentObservations || []).length === 0
      && same(disposition.allowedReviewDecisions, policy.allowedDecisions)),
    reviewAndVariantOpen: disposition.reviewDecision === null && disposition.reviewCandidateVariantIndex === null
      && disposition.bindingReviewDecision === null && disposition.boundVariantIndex === null,
    semanticGatesClosed: disposition.candidateMemberIdentityVerdict === null && disposition.parentMembershipVerdict === null
      && disposition.weightedTaskEntryMembershipVerdict === null && disposition.repeatabilityVerdict === null
      && disposition.mechanicsReviewComplete === false && disposition.mappingVerdict === null
      && disposition.inventoryCompletenessVerdict === null && disposition.memberUniverseComplete === false
      && disposition.optimizerEligible === false && disposition.automaticVerificationApplied === false,
    accountIndependent: disposition.accountIndependent === true
  };
  return { checks, canonical, complete: Object.values(checks).every(Boolean) };
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

function evidenceSourceIdentities(packet = {}) {
  const observationKeys = new Set([
    ...(packet.candidateScopedParentContextObservations || []),
    ...(packet.numberedVariantIdentityObservations || []),
    ...(packet.exactTaskToNumberedVariantAlignmentObservations || [])
  ].map(observation => observation.sourceKey));
  return (packet.candidateSourcePages || []).filter(page => observationKeys.has(page.sourceKey)).map(sourceIdentity);
}

function compactContextObservations(packet = {}) {
  return (packet.candidateScopedParentContextObservations || []).map(observation => {
    const terms = unique([...(observation.matchedCandidateTerms || []), observation.matchedParentAnchor].filter(Boolean));
    const exactMatchedLines = String(observation.exactSectionText || '').split(/\r?\n/)
      .map((exactSourceText, index) => ({ lineNumber: Number(observation.lineStart) + index, exactSourceText }))
      .filter(line => terms.some(term => line.exactSourceText.toLocaleLowerCase('en-US').includes(String(term).toLocaleLowerCase('en-US'))));
    return {
      sourceKey: observation.sourceKey,
      resolvedTitle: observation.resolvedTitle,
      heading: observation.heading,
      lineStart: observation.lineStart,
      lineEnd: observation.lineEnd,
      exactSectionTextContentHash: observation.exactSectionTextContentHash,
      matchedCandidateTerms: observation.matchedCandidateTerms,
      matchedParentAnchor: observation.matchedParentAnchor,
      exactMatchedLines,
      semanticUse: observation.semanticUse
    };
  });
}

function reviewScope(packet = {}) {
  const identities = evidenceSourceIdentities(packet);
  return {
    decisionScope: 'whether_the_parent_task_occurrence_refers_to_the_canonical_subject_across_numbered_variants',
    sourceRevisions: unique(identities.map(identity => identity.sourceRevision)).sort(),
    canonicalContextObservedDoesNotProveExactNumberedVariant: true,
    confirmationDoesNotProve: [...CONFIRMATION_DOES_NOT_PROVE]
  };
}

function evidenceFingerprint(disposition, packet, dispositionSnapshotContentHash, policy, contentHash = hash) {
  return contentHash({
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: packet.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: packet.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: disposition.sourceEvidencePacketSnapshotContentHash,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    canonicalSubjectContextEvidenceState: disposition.canonicalSubjectContextEvidenceState,
    exactNumberedVariantAlignmentEvidenceState: disposition.exactNumberedVariantAlignmentEvidenceState,
    evidenceSourceIdentities: evidenceSourceIdentities(packet),
    candidateScopedParentContextObservations: compactContextObservations(packet),
    numberedVariantIdentityObservations: packet.numberedVariantIdentityObservations,
    exactTaskToNumberedVariantAlignmentObservations: packet.exactTaskToNumberedVariantAlignmentObservations,
    reviewScope: reviewScope(packet),
    allowedDecisions: policy.allowedDecisions
  });
}

function decisionTemplate(queueEntryKey, disposition, packet, fingerprint, dispositionSnapshotContentHash, policy, contentHash = hash) {
  const base = {
    contract: policy.decisionTemplateContract,
    queueEntryKey,
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: packet.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: packet.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: disposition.sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprint: fingerprint,
    reviewCandidateVariantIndex: null,
    boundVariantIndex: null,
    decisionSourceRevisions: [],
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_source_bound_canonical_subject_scope_review_decision'
  };
  return { ...base, templateContentHash: contentHash(base) };
}

function queueEntry(disposition, packet, ordinal, dispositionSnapshotContentHash, policy, contentHash = hash) {
  const queueEntryKey = `${disposition.dispositionKey}|canonical-subject-scope-review-queue-entry`;
  const fingerprint = evidenceFingerprint(disposition, packet, dispositionSnapshotContentHash, policy, contentHash);
  const template = decisionTemplate(queueEntryKey, disposition, packet, fingerprint, dispositionSnapshotContentHash, policy, contentHash);
  const base = {
    contract: policy.queueContract,
    queueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionKey: disposition.dispositionKey,
    sourceDispositionRecordContentHash: disposition.recordContentHash,
    sourceDispositionSnapshotContentHash: dispositionSnapshotContentHash,
    sourceEvidencePacketKey: packet.evidencePacketKey,
    sourceEvidencePacketRecordContentHash: packet.recordContentHash,
    sourceEvidencePacketSnapshotContentHash: disposition.sourceEvidencePacketSnapshotContentHash,
    evidenceFingerprint: fingerprint,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    candidateDisplayName: disposition.candidateDisplayName,
    canonicalSubjectContextEvidenceState: disposition.canonicalSubjectContextEvidenceState,
    exactNumberedVariantAlignmentEvidenceState: disposition.exactNumberedVariantAlignmentEvidenceState,
    evidenceSourceIdentities: evidenceSourceIdentities(packet),
    candidateScopedParentContextObservations: compactContextObservations(packet),
    numberedVariantIdentityObservations: packet.numberedVariantIdentityObservations,
    exactTaskToNumberedVariantAlignmentObservations: packet.exactTaskToNumberedVariantAlignmentObservations,
    reviewScope: reviewScope(packet),
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate: template,
    reviewDecision: null,
    reviewCandidateVariantIndex: null,
    bindingReviewDecision: null,
    boundVariantIndex: null,
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
    blockers: unique([...disposition.blockers, 'explicit_canonical_subject_scope_review_pending', 'exact_numbered_variant_binding_not_proven']),
    state: policy.queueState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash = hash) {
  const compiled = compileMultiVariantBindingCanonicalSubjectScopeReviewQueueExportPolicy(policy);
  const packetByKey = new Map(evidencePackets.map(packet => [packet.evidencePacketKey, packet]));
  const packetAssessments = evidencePackets.map(packet => ({ key: packet.evidencePacketKey, integrity: evidencePacketIntegrity(packet, policy, contentHash) }));
  const dispositionAssessments = dispositionRecords.map(disposition => ({
    key: disposition.dispositionKey,
    packetKey: disposition.sourceEvidencePacketKey,
    integrity: dispositionIntegrity(disposition, packetByKey.get(disposition.sourceEvidencePacketKey), policy, evidenceSnapshotContentHash, contentHash)
  }));
  const inputPacketKeys = evidencePackets.map(packet => packet.evidencePacketKey);
  const dispositionPacketKeys = dispositionRecords.map(disposition => disposition.sourceEvidencePacketKey);
  const failures = [];
  if (!compiled.valid) failures.push('canonical_subject_scope_review_queue_export_policy_invalid_or_candidate_specific');
  if (!dispositionRecords.length) failures.push('no_sufficiency_dispositions');
  if (!evidencePackets.length) failures.push('no_source_discovery_packets');
  if (!validHash(dispositionSnapshotContentHash) || !validHash(evidenceSnapshotContentHash)) failures.push('upstream_snapshot_content_hash_missing_or_invalid');
  if (duplicates(inputPacketKeys).length || duplicates(dispositionRecords.map(record => record.dispositionKey)).length || duplicates(dispositionPacketKeys).length) failures.push('duplicate_input_keys');
  if (inputPacketKeys.some(key => !dispositionPacketKeys.includes(key)) || dispositionPacketKeys.some(key => !inputPacketKeys.includes(key))) failures.push('disposition_and_evidence_packet_sets_do_not_match_exactly');
  if (packetAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_source_discovery_packets_failed_revalidation');
  if (dispositionAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_sufficiency_dispositions_failed_revalidation');
  if (accountStateFindings([...dispositionRecords, ...evidencePackets]).length) failures.push('current_account_state_present');
  const eligible = failures.length ? [] : dispositionRecords.filter(disposition => disposition.classification === policy.eligibleClassification && disposition.reviewRoute === policy.eligibleReviewRoute);
  if (!failures.length && !eligible.length) failures.push('no_canonical_subject_scope_review_dispositions');
  const queueRecords = failures.length ? [] : eligible.map((disposition, index) => queueEntry(disposition, packetByKey.get(disposition.sourceEvidencePacketKey), index + 1, dispositionSnapshotContentHash, policy, contentHash));
  const decisionTemplates = queueRecords.map(record => record.decisionTemplate);
  return { compiled, packetAssessments, dispositionAssessments, failures, eligible, queueRecords, decisionTemplates };
}

function fenced(text) {
  const value = String(text || '');
  const fence = value.includes('```') ? '````' : '```';
  return `${fence}text\n${value}\n${fence}`;
}

export function renderMultiVariantBindingCanonicalSubjectScopeReviewQueueMarkdown(records = []) {
  const lines = [
    '# Multi-variant canonical-subject scope review queue',
    '',
    'This queue asks only whether a parent task occurrence refers to the canonical subject across its numbered variants. Confirmation cannot select the Normal variant—or any numbered variant—and cannot prove downstream gameplay facts.',
    ''
  ];
  for (const record of records) {
    lines.push(`## ${record.queueOrdinal}. ${record.candidateDisplayName}`, '');
    lines.push(`- Queue key: \`${record.queueEntryKey}\``);
    lines.push(`- Evidence fingerprint: \`${record.evidenceFingerprint}\``);
    lines.push(`- Canonical context: **${record.canonicalSubjectContextEvidenceState}**`);
    lines.push(`- Exact numbered-variant alignment: **${record.exactNumberedVariantAlignmentEvidenceState}**`);
    lines.push(`- Review candidate variant: **none**`);
    lines.push(`- Bound variant: **none**`, '');
    lines.push('### Evidence sources', '');
    for (const source of record.evidenceSourceIdentities) lines.push(`- [${source.resolvedTitle}](${source.sourceUrl}) — revision \`${source.sourceRevision}\`, page ${source.sourcePageId}, hash \`${source.sourceContentHash}\``);
    lines.push('', '### Canonical-context observations', '');
    for (const observation of record.candidateScopedParentContextObservations) {
      const matchedLines = observation.exactMatchedLines.map(line => `${line.lineNumber}: ${line.exactSourceText}`).join('\n');
      lines.push(`<details><summary>${observation.resolvedTitle}, ${observation.heading || 'source section'}, lines ${observation.lineStart}-${observation.lineEnd}</summary>`, '');
      lines.push(`Full section hash: \`${observation.exactSectionTextContentHash}\`. The complete exact section remains bound in the upstream evidence packet.`);
      lines.push('', fenced(matchedLines), '', '</details>', '');
    }
    lines.push('### Numbered-variant identity observations', '');
    for (const observation of record.numberedVariantIdentityObservations) lines.push(`- ${observation.resolvedTitle}, variant ${observation.variantIndex}, \`${observation.parameterName}\`: \`${observation.exactSourceText}\``);
    lines.push('', '### Exact task-to-numbered-variant alignment', '', '- None observed. This absence is why exact variant binding remains blocked.', '', '### Allowed decisions', '');
    for (const decision of record.allowedDecisions) lines.push(`- \`${decision}\``);
    lines.push('', 'Decision: _blank_', 'Reviewer: _blank_', 'Reviewed at: _blank_', 'Notes: _blank_', '');
  }
  return `${lines.join('\n')}\n`;
}

export function serializeMultiVariantBindingCanonicalSubjectScopeReviewDecisionTemplates(templates = []) {
  return templates.map(template => JSON.stringify(template)).join('\n') + (templates.length ? '\n' : '');
}

function unsupportedQueuePromotions(records = []) {
  return records.filter(record => record.reviewDecision !== null || record.reviewCandidateVariantIndex !== null
    || record.bindingReviewDecision !== null || record.boundVariantIndex !== null
    || record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null
    || record.weightedTaskEntryMembershipVerdict !== null || record.repeatabilityVerdict !== null
    || record.mechanicsReviewComplete !== false || record.mappingVerdict !== null
    || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).map(record => record.queueEntryKey || 'unknown');
}

function nonBlankTemplates(templates = []) {
  return templates.filter(template => template.decision !== null || template.reviewer !== null || template.reviewedAt !== null
    || template.reviewNotes !== null || (template.decisionSourceRevisions || []).length > 0
    || template.reviewCandidateVariantIndex !== null || template.boundVariantIndex !== null).map(template => template.queueEntryKey || 'unknown');
}

export function auditMultiVariantBindingCanonicalSubjectScopeReviewQueueExport(records = [], {
  dispositionRecords = [], evidencePackets = [], policy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '',
  decisionTemplates = [], reviewMarkdown = '', decisionTemplateNdjson = '', contentHash = hash
} = {}) {
  const derived = derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash);
  const eligibleKeys = derived.eligible.map(record => record.dispositionKey);
  const outputKeys = records.map(record => record.sourceDispositionKey);
  const missingOutputKeys = eligibleKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !eligibleKeys.includes(key));
  const duplicateOutputKeys = duplicates(outputKeys);
  const recordMismatches = records.filter((record, index) => !derived.queueRecords[index] || !same(record, derived.queueRecords[index])).map(record => record.queueEntryKey || 'unknown');
  const templateMismatches = decisionTemplates.filter((template, index) => !derived.decisionTemplates[index] || !same(template, derived.decisionTemplates[index])).map(template => template.queueEntryKey || 'unknown');
  const expectedMarkdown = renderMultiVariantBindingCanonicalSubjectScopeReviewQueueMarkdown(records);
  const expectedTemplateNdjson = serializeMultiVariantBindingCanonicalSubjectScopeReviewDecisionTemplates(decisionTemplates);
  const queuePromotions = unsupportedQueuePromotions(records);
  const templatePromotions = nonBlankTemplates(decisionTemplates);
  const accountFindings = accountStateFindings([...dispositionRecords, ...evidencePackets, ...records, ...decisionTemplates]);
  const failures = [...derived.failures];
  if (missingOutputKeys.length || unexpectedOutputKeys.length || duplicateOutputKeys.length || records.length !== derived.eligible.length) failures.push('eligible_disposition_and_review_queue_sets_do_not_match_exactly');
  if (recordMismatches.length || templateMismatches.length || decisionTemplates.length !== records.length) failures.push('queue_or_decision_template_does_not_match_evidence_bound_derivation');
  if (reviewMarkdown !== expectedMarkdown || decisionTemplateNdjson !== expectedTemplateNdjson) failures.push('review_artifact_content_mismatch');
  if (queuePromotions.length || templatePromotions.length) failures.push('queue_export_created_review_binding_semantic_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const publishable = failures.length === 0;
  const allPages = evidencePackets.flatMap(packet => packet.candidateSourcePages || []);
  const allPinned = evidencePackets.flatMap(packet => packet.pinnedSourceRevalidations || []);
  const nonCanonicalCount = dispositionRecords.length - derived.eligible.length;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputDispositionCount: dispositionRecords.length,
      inputEvidencePacketCount: evidencePackets.length,
      eligibleCanonicalSubjectScopeDispositionCount: derived.eligible.length,
      nonCanonicalDispositionCount: nonCanonicalCount,
      revalidatedDispositionCount: derived.dispositionAssessments.filter(item => item.integrity.complete).length,
      revalidatedEvidencePacketCount: derived.packetAssessments.filter(item => item.integrity.complete).length,
      dispositionSnapshotContentHash,
      evidenceSnapshotContentHash
    },
    policyCoverage: derived.compiled,
    sourceIntegrityCoverage: {
      retainedCurrentSourceCount: unique(allPages.map(page => page.sourceKey)).length,
      completeCurrentSourceCount: unique(allPages.filter(page => pageIntegrity(page, contentHash).complete).map(page => page.sourceKey)).length,
      retainedPinnedSourceCount: unique(allPinned.map(source => source.sourceKey)).length,
      completePinnedSourceCount: unique(allPinned.filter(source => source.complete === true && Object.values(source.checks || {}).every(Boolean)).map(source => source.sourceKey)).length,
      contextObservationCount: evidencePackets.reduce((sum, packet) => sum + (packet.candidateScopedParentContextObservations || []).length, 0),
      numberedVariantIdentityObservationCount: evidencePackets.reduce((sum, packet) => sum + (packet.numberedVariantIdentityObservations || []).length, 0),
      exactTaskToNumberedVariantAlignmentObservationCount: evidencePackets.reduce((sum, packet) => sum + (packet.exactTaskToNumberedVariantAlignmentObservations || []).length, 0)
    },
    queueCoverage: {
      reviewQueueEntryCount: records.length,
      blankDecisionTemplateCount: decisionTemplates.length - templatePromotions.length,
      missingOutputKeys,
      unexpectedOutputKeys,
      duplicateOutputKeys,
      recordMismatches,
      templateMismatches,
      exactNumberedVariantReviewEntriesAllowed: 0
    },
    artifactCoverage: {
      markdownMatches: reviewMarkdown === expectedMarkdown,
      decisionTemplateNdjsonMatches: decisionTemplateNdjson === expectedTemplateNdjson,
      reviewMarkdownContentHash: contentHash(reviewMarkdown),
      decisionTemplateNdjsonContentHash: contentHash(decisionTemplateNdjson)
    },
    semanticPreservationCoverage: {
      recordedReviewDecisionCount: records.filter(record => record.reviewDecision !== null).length + decisionTemplates.filter(template => template.decision !== null).length,
      reviewCandidateVariantIndexCount: records.filter(record => record.reviewCandidateVariantIndex !== null).length + decisionTemplates.filter(template => template.reviewCandidateVariantIndex !== null).length,
      boundVariantCount: records.filter(record => record.boundVariantIndex !== null).length + decisionTemplates.filter(template => template.boundVariantIndex !== null).length,
      semanticVerdictCount: records.filter(record => record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null
        || record.weightedTaskEntryMembershipVerdict !== null || record.repeatabilityVerdict !== null
        || record.mechanicsReviewComplete || record.mappingVerdict !== null
        || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      unsupportedQueuePromotions: queuePromotions,
      nonBlankDecisionTemplates: templatePromotions
    },
    accountStateFindings: accountFindings,
    queueExportComplete: publishable,
    canonicalSubjectScopeReviewComplete: false,
    variantBindingReviewComplete: false,
    optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(records.length ? ['canonical_subject_scope_review_decisions_pending'] : []),
      'exact_numbered_variant_bindings_not_proven',
      'candidate_member_identity_and_variant_binding_reviews_not_completed',
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

export function buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport({
  dispositionRecords = [], evidencePackets = [], policy = {}, dispositionSnapshotContentHash = '', evidenceSnapshotContentHash = '', contentHash = hash
} = {}) {
  const derived = derive(dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash, contentHash);
  const records = derived.failures.length ? [] : derived.queueRecords;
  const decisionTemplates = derived.failures.length ? [] : derived.decisionTemplates;
  const reviewMarkdown = renderMultiVariantBindingCanonicalSubjectScopeReviewQueueMarkdown(records);
  const decisionTemplateNdjson = serializeMultiVariantBindingCanonicalSubjectScopeReviewDecisionTemplates(decisionTemplates);
  const audit = auditMultiVariantBindingCanonicalSubjectScopeReviewQueueExport(records, {
    dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
    decisionTemplates, reviewMarkdown, decisionTemplateNdjson, contentHash
  });
  return { records, decisionTemplates, reviewMarkdown, decisionTemplateNdjson, audit };
}
