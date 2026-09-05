import { hash, json } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'oneQueueEntryAndDecisionTemplatePerEligibleReviewPacket',
  'inputRecordAndPacketContentHashesMustRevalidate',
  'allRetainedExactRevisionSourcesMustRevalidateBeforeExport',
  'queueOrderMustPreserveSourcePacketOrder',
  'everyEntryMustBindItsPacketAndEvidenceFingerprint',
  'markdownMustRetainExactSubjectInfoboxAndParentOccurrence',
  'decisionTemplateMustStartBlank',
  'decisionTemplateMustBindTheSamePacketAndEvidenceFingerprint',
  'exportDoesNotRecordReviewDecisionReviewerDateOrNotes',
  'confirmedIdentityWouldNotProveMembershipRepeatabilityMechanicsMappingCompletenessOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const DOWNSTREAM_BOUNDARIES = [
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
const equal = (left, right) => hash(left) === hash(right);
const without = (value, key) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => name !== key));
const allTrue = value => value && typeof value === 'object' && Object.values(value).length > 0 && Object.values(value).every(Boolean);

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
  return findings.sort();
}

export function compileStructuralMemberCandidateIdentityReviewQueueExportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.structural-member-candidate-identity-review-packets.v1'
    && policy.recordContract === 'sensum.structural-member-candidate-identity-review-queue-entry.v1'
    && policy.decisionTemplateContract === 'sensum.structural-member-candidate-identity-review-decision-template.v1'
    && policy.auditContract === 'sensum.structural-member-candidate-identity-review-queue-export-audit.v1'
    && policy.inputState === 'structural_member_candidate_identity_review_packets_materialized_decisions_pending_gates_closed'
    && policy.outputState === 'pending_explicit_source_bound_candidate_identity_review';
  const packetPolicy = policy.allowedDecisions || [];
  const decisionsValid = packetPolicy.length === 3
    && packetPolicy[0] === 'confirm_source_page_subject_identity_for_candidate'
    && packetPolicy[1] === 'reject_source_page_subject_identity_for_candidate'
    && packetPolicy[2] === 'needs_additional_evidence';
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && decisionsValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    decisionsValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function eligibleInput(record = {}, policy = {}) {
  const materialization = record.structuralMemberCandidateIdentityReviewPacketMaterialization || {};
  const packets = record.structuralMemberCandidateIdentityReviewPackets || [];
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && record.accountIndependent === true
    && record.optimizerEligible === false
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && materialization.state === 'source_bound_identity_review_packets_materialized_decisions_pending'
    && materialization.reviewPacketMaterializationComplete === true
    && materialization.identityReviewComplete === false
    && materialization.decisionCount === 0
    && materialization.candidateMemberIdentityVerdictCount === 0
    && materialization.canonicalGameEntityIdentityCount === 0
    && materialization.memberUniverseComplete === false
    && materialization.evidenceWorkComplete === false
    && materialization.automaticVerificationApplied === false
    && packets.length > 0;
}

export function selectStructuralMemberCandidateIdentityReviewQueueExportInputs(records = [], policy = {}) {
  return records.filter(record => eligibleInput(record, policy));
}

function sourceIntegrity(source = {}, contentHash = hash) {
  const identity = source.sourcePageIdentity || {};
  const text = source.exactRevisionSourceText;
  const checks = {
    captureComplete: source.captureComplete === true && source.state === 'complete_exact_revision_source_capture_non_verdict',
    pageIdPresent: Number(identity.sourcePageId) > 0,
    titlePresent: typeof identity.resolvedTitle === 'string' && identity.resolvedTitle.length > 0,
    revisionPresent: typeof identity.sourceRevision === 'string' && identity.sourceRevision.length > 0,
    timestampPresent: typeof identity.sourceTimestamp === 'string' && identity.sourceTimestamp.length > 0,
    urlPresent: typeof identity.sourceUrl === 'string' && identity.sourceUrl.length > 0,
    exactTextPresent: typeof text === 'string',
    contentHashMatches: typeof text === 'string' && contentHash(text) === identity.sourceContentHash,
    contentBytesMatch: typeof text === 'string' && Buffer.byteLength(text, 'utf8') === identity.sourceContentBytes,
    upstreamChecksPassed: allTrue(source.integrityChecks),
    semanticVerdictNull: source.semanticVerdict === null
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function packetIntegrity(packet = {}, policy = {}, contentHash = hash) {
  const subject = packet.subjectEvidence || {};
  const infobox = subject.rootInfobox || {};
  const parent = packet.parentOccurrenceEvidence || {};
  const decisionFieldsBlank = packet.decision === null
    && packet.reviewer === null
    && packet.reviewedAt === null
    && packet.reviewNotes === null
    && Array.isArray(packet.decisionSourceRevisions)
    && packet.decisionSourceRevisions.length === 0;
  const semanticFieldsClosed = packet.candidateMemberIdentityVerdict === null
    && packet.canonicalGameEntityIdentity === null
    && packet.parentMembershipVerdict === null
    && packet.weightedTaskEntryMembershipVerdict === null
    && packet.mappingVerdict === null
    && packet.inventoryCompletenessVerdict === null
    && packet.memberUniverseComplete === false
    && packet.automaticVerificationApplied === false;
  const checks = {
    contractMatches: packet.contract === 'sensum.structural-member-candidate-identity-review-packet.v1',
    packetKeyPresent: typeof packet.reviewPacketKey === 'string' && packet.reviewPacketKey.length > 0,
    candidateKeyPresent: typeof packet.structuralCandidateKey === 'string' && packet.structuralCandidateKey.length > 0,
    candidateRolePresent: typeof packet.candidateRole === 'string' && packet.candidateRole.length > 0,
    packetContentHashMatches: typeof packet.packetContentHash === 'string' && contentHash(without(packet, 'packetContentHash')) === packet.packetContentHash,
    subjectIdentityPresent: Number(subject.sourcePageIdentity?.sourcePageId) > 0 && typeof subject.sourcePageIdentity?.sourceRevision === 'string',
    subjectIntegrityComplete: subject.sourceIntegrity?.complete === true && allTrue(subject.sourceIntegrity?.checks),
    rootInfoboxPresent: typeof infobox.exactSourceText === 'string' && infobox.exactSourceText.length > 0,
    rootInfoboxHashMatches: typeof infobox.exactSourceText === 'string' && contentHash(infobox.exactSourceText) === infobox.exactSourceTextContentHash,
    sourceAuthoredNamePresent: Array.isArray(infobox.sourceAuthoredNameFields) && infobox.sourceAuthoredNameFields.length > 0 && infobox.sourceAuthoredNameFields.every(field => typeof field.name === 'string' && field.name.length > 0 && typeof field.value === 'string' && field.value.length > 0),
    parentIdentityPresent: Number(parent.sourcePageIdentity?.sourcePageId) > 0 && typeof parent.sourcePageIdentity?.sourceRevision === 'string',
    parentOccurrencePresent: typeof parent.exactSourceText === 'string' && parent.exactSourceText.length > 0,
    parentOccurrenceHashMatches: typeof parent.exactSourceText === 'string' && contentHash(parent.exactSourceText) === parent.exactSourceTextContentHash,
    parentIntegrityComplete: parent.integrity?.complete === true && allTrue(parent.integrity?.checks),
    scopeExact: packet.reviewScope?.decisionScope === 'exact_candidate_to_revision_pinned_source_page_subject_identity_and_single_infobox_variant',
    boundariesComplete: equal(packet.reviewScope?.confirmationDoesNotProve || [], DOWNSTREAM_BOUNDARIES),
    decisionsMatchPolicy: equal(packet.allowedDecisions || [], policy.allowedDecisions || []),
    materializationComplete: packet.packetMaterializationComplete === true && packet.eligibleForSourceBoundReview === true,
    decisionFieldsBlank,
    semanticFieldsClosed,
    pendingState: packet.state === policy.outputState,
    packetIntegrityChecksPassed: allTrue(packet.integrityChecks)
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function displayName(packet = {}) {
  const fields = packet.subjectEvidence?.rootInfobox?.sourceAuthoredNameFields || [];
  const first = fields[0] || {};
  return {
    value: String(first.value || ''),
    source: {
      kind: 'revision_pinned_root_infobox_name_field',
      parameterName: String(first.name || ''),
      rootInfoboxContentHash: packet.subjectEvidence?.rootInfobox?.exactSourceTextContentHash || null
    }
  };
}

function evidenceBinding(packet = {}) {
  const subject = packet.subjectEvidence || {};
  const parent = packet.parentOccurrenceEvidence || {};
  return {
    reviewPacketKey: packet.reviewPacketKey,
    sourcePacketContentHash: packet.packetContentHash,
    structuralCandidateKey: packet.structuralCandidateKey,
    candidateRole: packet.candidateRole,
    subject: {
      sourceKey: subject.sourceKey,
      sourcePageIdentity: subject.sourcePageIdentity,
      rootInfoboxContentHash: subject.rootInfobox?.exactSourceTextContentHash,
      sourceAuthoredNameFields: subject.rootInfobox?.sourceAuthoredNameFields
    },
    parent: {
      sourceKey: parent.sourceKey,
      sourcePageIdentity: parent.sourcePageIdentity,
      exactSourceTextContentHash: parent.exactSourceTextContentHash,
      sourceLocator: parent.sourceLocator,
      structuralRelationshipClass: parent.structuralRelationshipClass,
      roleTypeCoherenceState: parent.roleTypeCoherenceState
    },
    reviewScope: packet.reviewScope
  };
}

function decisionTemplate(packet, queueEntryKey, evidenceFingerprint, policy) {
  return {
    contract: policy.decisionTemplateContract,
    queueEntryKey,
    reviewPacketKey: packet.reviewPacketKey,
    sourcePacketContentHash: packet.packetContentHash,
    evidenceFingerprint,
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    decisionSourceRevisions: [],
    reviewNotes: null,
    state: 'blank_source_bound_candidate_identity_review_decision'
  };
}

function queueEntry(packet, packetRecord, ordinal, policy, contentHash = hash) {
  const queueEntryKey = `${packet.reviewPacketKey}|review-queue-entry`;
  const fingerprint = contentHash(evidenceBinding(packet));
  const label = displayName(packet);
  const template = decisionTemplate(packet, queueEntryKey, fingerprint, policy);
  const base = {
    contract: policy.recordContract,
    queueEntryKey,
    queueOrdinal: ordinal,
    reviewPacketKey: packet.reviewPacketKey,
    sourcePacketRecordContentHash: packetRecord.contentHash,
    sourcePacketContentHash: packet.packetContentHash,
    evidenceFingerprint: fingerprint,
    structuralCandidateKey: packet.structuralCandidateKey,
    candidateRole: packet.candidateRole,
    candidateDisplayName: label.value,
    candidateDisplayNameSource: label.source,
    subjectEvidence: {
      sourceKey: packet.subjectEvidence.sourceKey,
      sourcePageIdentity: packet.subjectEvidence.sourcePageIdentity,
      sourcePageEntityTypes: packet.subjectEvidence.sourcePageEntityTypes,
      identityBearingSourcePageTypes: packet.subjectEvidence.identityBearingSourcePageTypes,
      supplementarySourcePageTypes: packet.subjectEvidence.supplementarySourcePageTypes,
      rootInfobox: packet.subjectEvidence.rootInfobox
    },
    parentOccurrenceEvidence: {
      sourceKey: packet.parentOccurrenceEvidence.sourceKey,
      sourcePageIdentity: packet.parentOccurrenceEvidence.sourcePageIdentity,
      exactSourceText: packet.parentOccurrenceEvidence.exactSourceText,
      exactSourceTextContentHash: packet.parentOccurrenceEvidence.exactSourceTextContentHash,
      sourceLocator: packet.parentOccurrenceEvidence.sourceLocator,
      locatedSourceText: packet.parentOccurrenceEvidence.locatedSourceText,
      structuralRelationshipClass: packet.parentOccurrenceEvidence.structuralRelationshipClass,
      roleTypeCoherenceState: packet.parentOccurrenceEvidence.roleTypeCoherenceState
    },
    reviewScope: packet.reviewScope,
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate: template,
    accountIndependent: true,
    state: policy.outputState
  };
  return { ...base, entryContentHash: contentHash(base) };
}

function exactRevisionUrl(identity = {}) {
  const separator = String(identity.sourceUrl || '').includes('?') ? '&' : '?';
  return `${identity.sourceUrl || ''}${separator}oldid=${identity.sourceRevision || ''}`;
}
const markdownText = value => String(value ?? '').replaceAll('\\', '\\\\').replaceAll('`', '\\`');
const markdownInline = value => markdownText(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

export function renderStructuralMemberCandidateIdentityReviewQueueMarkdown(records = []) {
  const lines = [
    '# Structural member candidate identity review queue',
    '',
    '> This is a source-bound identity review queue, not a verified game-fact dataset. A confirmation only binds the exact candidate to the exact revision-pinned subject-page identity and infobox variant shown here.',
    '',
    `Entries: ${records.length}`,
    '',
    '## Review boundaries',
    '',
    'Confirmation does **not** prove weighted parent membership, repeatability, requirements, XP, timing, mechanics, declared-total mapping, member-universe completeness, or optimizer eligibility.',
    ''
  ];
  for (const record of records) {
    const subject = record.subjectEvidence || {};
    const parent = record.parentOccurrenceEvidence || {};
    const locator = parent.sourceLocator || {};
    lines.push(
      '<details>',
      `<summary>${String(record.queueOrdinal).padStart(3, '0')} — ${markdownInline(record.candidateDisplayName)} — ${markdownInline(record.candidateRole)}</summary>`,
      '',
      `- Queue entry: \`${markdownText(record.queueEntryKey)}\``,
      `- Evidence fingerprint: \`${record.evidenceFingerprint}\``,
      `- Packet hash: \`${record.sourcePacketContentHash}\``,
      `- Subject: [${markdownInline(subject.sourcePageIdentity?.resolvedTitle)}](${exactRevisionUrl(subject.sourcePageIdentity)}) — page ${subject.sourcePageIdentity?.sourcePageId}, revision ${subject.sourcePageIdentity?.sourceRevision}`,
      `- Parent occurrence: [${markdownInline(parent.sourcePageIdentity?.resolvedTitle)}](${exactRevisionUrl(parent.sourcePageIdentity)}) — page ${parent.sourcePageIdentity?.sourcePageId}, revision ${parent.sourcePageIdentity?.sourceRevision}, lines ${locator.lineStart}–${locator.lineEnd}`,
      '',
      '### Exact subject infobox',
      '',
      '```wikitext',
      subject.rootInfobox?.exactSourceText || '',
      '```',
      '',
      '### Exact parent occurrence',
      '',
      '```wikitext',
      parent.exactSourceText || '',
      '```',
      '',
      '### Decision',
      '',
      '- [ ] Confirm exact source-page subject identity for this candidate',
      '- [ ] Reject exact source-page subject identity for this candidate',
      '- [ ] Needs additional evidence',
      '- Reviewer:',
      '- Reviewed at:',
      '- Notes:',
      '',
      '</details>',
      ''
    );
  }
  return lines.join('\n');
}

export function serializeStructuralMemberCandidateIdentityDecisionTemplates(templates = []) {
  return templates.map(template => json(template)).join('\n') + (templates.length ? '\n' : '');
}

function accountStateFindings(records = []) {
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
  records.forEach((record, index) => walk(record, `[${index}]`));
  return findings;
}

function expectedArtifacts(packetRecords, policy, contentHash = hash) {
  const entries = [];
  let ordinal = 1;
  for (const packetRecord of packetRecords) {
    for (const packet of packetRecord.structuralMemberCandidateIdentityReviewPackets || []) {
      entries.push(queueEntry(packet, packetRecord, ordinal++, policy, contentHash));
    }
  }
  const decisionTemplates = entries.map(entry => entry.decisionTemplate);
  return {
    records: entries,
    decisionTemplates,
    markdown: renderStructuralMemberCandidateIdentityReviewQueueMarkdown(entries),
    decisionTemplateNdjson: serializeStructuralMemberCandidateIdentityDecisionTemplates(decisionTemplates)
  };
}

export function auditStructuralMemberCandidateIdentityReviewQueueExport(records = [], { packetRecords = [], policy = {}, decisionTemplates = [], markdown = '', decisionTemplateNdjson = '', contentHash = hash } = {}) {
  const compiled = compileStructuralMemberCandidateIdentityReviewQueueExportPolicy(policy);
  const inputs = selectStructuralMemberCandidateIdentityReviewQueueExportInputs(packetRecords, policy);
  const expected = compiled.valid ? expectedArtifacts(inputs, policy, contentHash) : { records: [], decisionTemplates: [], markdown: '', decisionTemplateNdjson: '' };
  const inputPackets = inputs.flatMap(record => record.structuralMemberCandidateIdentityReviewPackets || []);
  const inputKeys = inputPackets.map(packet => packet.reviewPacketKey);
  const outputKeys = records.map(record => record.reviewPacketKey);
  const templateKeys = decisionTemplates.map(template => template.reviewPacketKey);
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateOutputKeys = duplicates(outputKeys);
  const duplicateTemplateKeys = duplicates(templateKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const missingTemplateKeys = inputKeys.filter(key => !templateKeys.includes(key));
  const unexpectedTemplateKeys = templateKeys.filter(key => !inputKeys.includes(key));
  const inputRecordHashFailures = inputs.filter(record => typeof record.contentHash !== 'string' || contentHash(without(record, 'contentHash')) !== record.contentHash).map(record => record.memberCandidateKey || 'unknown');
  const sources = inputs.flatMap(record => record.structuralMemberCandidateSemanticGapEvidenceSources || []);
  const sourceFailures = sources.map(source => ({ sourceKey: source.sourceKey, integrity: sourceIntegrity(source, contentHash) })).filter(item => !item.integrity.complete);
  const packetFailures = inputPackets.map(packet => ({ reviewPacketKey: packet.reviewPacketKey, integrity: packetIntegrity(packet, policy, contentHash) })).filter(item => !item.integrity.complete);
  const recordMismatches = records.filter((record, index) => !expected.records[index] || !equal(record, expected.records[index])).map(record => record.queueEntryKey || 'unknown');
  const templateMismatches = decisionTemplates.filter((template, index) => !expected.decisionTemplates[index] || !equal(template, expected.decisionTemplates[index])).map(template => template.queueEntryKey || 'unknown');
  const queueOrderValid = records.length === expected.records.length && records.every((record, index) => record.queueOrdinal === index + 1 && record.reviewPacketKey === expected.records[index].reviewPacketKey);
  const markdownMatches = markdown === expected.markdown;
  const templateNdjsonMatches = decisionTemplateNdjson === expected.decisionTemplateNdjson;
  const decisionCount = [...records.map(record => record.decisionTemplate), ...decisionTemplates].filter(template => template?.decision !== null).length;
  const reviewerCount = [...records.map(record => record.decisionTemplate), ...decisionTemplates].filter(template => template?.reviewer !== null).length;
  const reviewedAtCount = [...records.map(record => record.decisionTemplate), ...decisionTemplates].filter(template => template?.reviewedAt !== null).length;
  const reviewNotesCount = [...records.map(record => record.decisionTemplate), ...decisionTemplates].filter(template => template?.reviewNotes !== null).length;
  const unsupportedPromotions = records.filter(record => record.optimizerEligible === true || record.candidateMemberIdentityVerdict != null || record.canonicalGameEntityIdentity != null || record.memberUniverseComplete === true).map(record => record.queueEntryKey || 'unknown');
  const accountFindings = accountStateFindings(records);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('review_queue_export_policy_invalid_or_candidate_specific');
  if (packetRecords.length !== inputs.length || duplicateInputKeys.length) structuralBlockers.push('input_review_packet_set_not_exactly_eligible_and_unique');
  if (inputRecordHashFailures.length) structuralBlockers.push('one_or_more_input_packet_record_hashes_failed_revalidation');
  if (sourceFailures.length) structuralBlockers.push('one_or_more_retained_exact_revision_sources_failed_revalidation');
  if (packetFailures.length) structuralBlockers.push('one_or_more_source_bound_review_packets_failed_revalidation');
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('input_packet_and_queue_entry_sets_do_not_match_exactly');
  if (duplicateTemplateKeys.length || missingTemplateKeys.length || unexpectedTemplateKeys.length) structuralBlockers.push('input_packet_and_decision_template_sets_do_not_match_exactly');
  if (recordMismatches.length) structuralBlockers.push('one_or_more_queue_entries_do_not_match_generic_export_policy');
  if (templateMismatches.length) structuralBlockers.push('one_or_more_decision_templates_do_not_match_queue_evidence_bindings');
  if (!queueOrderValid) structuralBlockers.push('review_queue_does_not_preserve_source_packet_order');
  if (!markdownMatches) structuralBlockers.push('markdown_review_queue_does_not_match_queue_entries');
  if (!templateNdjsonMatches) structuralBlockers.push('decision_template_ndjson_does_not_match_blank_templates');
  if (decisionCount || reviewerCount || reviewedAtCount || reviewNotesCount || unsupportedPromotions.length) structuralBlockers.push('queue_export_created_review_state_or_unsupported_semantic_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: {
      inputPacketRecordCount: packetRecords.length,
      eligiblePacketRecordCount: inputs.length,
      inputReviewPacketCount: inputPackets.length,
      queueEntryCount: records.length,
      decisionTemplateCount: decisionTemplates.length,
      duplicateInputKeys,
      duplicateOutputKeys,
      duplicateTemplateKeys,
      missingOutputKeys,
      unexpectedOutputKeys,
      missingTemplateKeys,
      unexpectedTemplateKeys
    },
    policyCoverage: compiled,
    sourceIntegrityCoverage: {
      sourceCount: sources.length,
      completeSourceCount: sources.length - sourceFailures.length,
      failedSourceCount: sourceFailures.length,
      failedSourceKeys: sourceFailures.map(item => item.sourceKey),
      inputRecordHashFailures
    },
    packetIntegrityCoverage: {
      packetCount: inputPackets.length,
      completePacketCount: inputPackets.length - packetFailures.length,
      failedPacketCount: packetFailures.length,
      failedPacketKeys: packetFailures.map(item => item.reviewPacketKey)
    },
    queueCoverage: {
      queueEntryCount: records.length,
      fingerprintBoundEntryCount: records.filter(record => typeof record.evidenceFingerprint === 'string' && record.evidenceFingerprint.length === 64).length,
      sourcePacketHashBoundEntryCount: records.filter(record => typeof record.sourcePacketContentHash === 'string' && record.sourcePacketContentHash.length === 64).length,
      sourcePacketRecordHashBoundEntryCount: records.filter(record => typeof record.sourcePacketRecordContentHash === 'string' && record.sourcePacketRecordContentHash.length === 64).length,
      blankDecisionTemplateCount: decisionTemplates.filter(template => template.decision === null && template.reviewer === null && template.reviewedAt === null && template.reviewNotes === null && template.decisionSourceRevisions?.length === 0).length,
      queueOrderValid,
      recordMismatches,
      templateMismatches
    },
    artifactCoverage: {
      markdownEntryCount: (markdown.match(/<details>/g) || []).length,
      markdownMatches,
      markdownContentHash: contentHash(markdown),
      markdownBytes: Buffer.byteLength(markdown, 'utf8'),
      decisionTemplateNdjsonMatches: templateNdjsonMatches,
      decisionTemplateNdjsonContentHash: contentHash(decisionTemplateNdjson),
      decisionTemplateNdjsonBytes: Buffer.byteLength(decisionTemplateNdjson, 'utf8')
    },
    semanticPreservationCoverage: {
      decisionCount,
      reviewerCount,
      reviewedAtCount,
      reviewNotesCount,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    reviewQueueExportComplete: publishable && records.length === inputPackets.length && decisionTemplates.length === inputPackets.length,
    identityReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'source_bound_candidate_identity_review_queue_exported_decisions_pending',
      'candidate_member_identity_review_not_completed',
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

export function buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords = [], policy = {}, contentHash = hash } = {}) {
  const compiled = compileStructuralMemberCandidateIdentityReviewQueueExportPolicy(policy);
  const inputs = compiled.valid ? selectStructuralMemberCandidateIdentityReviewQueueExportInputs(packetRecords, policy) : [];
  const artifacts = compiled.valid ? expectedArtifacts(inputs, policy, contentHash) : { records: [], decisionTemplates: [], markdown: '', decisionTemplateNdjson: '' };
  return {
    ...artifacts,
    audit: auditStructuralMemberCandidateIdentityReviewQueueExport(artifacts.records, {
      packetRecords,
      policy,
      decisionTemplates: artifacts.decisionTemplates,
      markdown: artifacts.markdown,
      decisionTemplateNdjson: artifacts.decisionTemplateNdjson,
      contentHash
    })
  };
}
