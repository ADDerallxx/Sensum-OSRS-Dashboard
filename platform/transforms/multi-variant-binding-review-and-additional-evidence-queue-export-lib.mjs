import { hash, json } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'everyDispositionMustEnterExactlyOneOfTwoDisjointQueues',
  'queueOrderMustPreserveSourceDispositionOrderWithinEachRoute',
  'inputRecordSourcePacketAndDispositionHashesMustRevalidate',
  'allRetainedExactRevisionSourcesMustRevalidateBeforeExport',
  'everyQueueEntryMustBindImmutableEvidenceAndSourceFingerprints',
  'reviewQueueRequiresExactlyOneUnboundReviewCandidateVariantIndex',
  'reviewDecisionTemplatesMustStartBlank',
  'additionalEvidenceQueueCannotContainAReviewCandidateVariantIndex',
  'additionalEvidenceQueueMustRetainWhyTheParentOccurrenceIsNonDiscriminating',
  'markdownMustRetainExactSubjectInfoboxAndParentOccurrence',
  'exportDoesNotRecordAReviewDecisionReviewerDateNotesEvidenceOrBoundVariant',
  'confirmationWouldNotProveIdentityMembershipRepeatabilityMechanicsMappingCompletenessOrOptimizerEligibility',
  'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const DOWNSTREAM_BOUNDARIES = ['candidate_member_identity', 'weighted_parent_membership', 'repeatability', 'requirements', 'xp', 'timing', 'mechanics', 'declared_total_mapping', 'member_universe_completeness', 'optimizer_eligibility'];
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const equal = (left, right) => hash(left) === hash(right);
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
  return [...new Set(findings)].sort();
}

export function compileMultiVariantBindingReviewAndAdditionalEvidenceQueueExportPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputContract === 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-disposition.v1'
    && policy.reviewQueueContract === 'sensum.multi-variant-binding-review-queue-entry.v1'
    && policy.decisionTemplateContract === 'sensum.multi-variant-binding-review-decision-template.v1'
    && policy.additionalEvidenceQueueContract === 'sensum.multi-variant-binding-additional-evidence-work-queue-entry.v1'
    && policy.auditContract === 'sensum.multi-variant-binding-review-and-additional-evidence-queue-export-audit.v1'
    && policy.inputState === 'multi_variant_parent_occurrence_binding_evidence_sufficiency_disposition_recorded_all_verdicts_closed'
    && policy.reviewQueueState === 'pending_explicit_source_bound_variant_binding_review'
    && policy.additionalEvidenceQueueState === 'blocked_pending_additional_variant_disambiguation_evidence';
  const routeKeysValid = typeof policy.reviewReadyRouteKey === 'string' && typeof policy.additionalEvidenceRouteKey === 'string' && policy.reviewReadyRouteKey !== policy.additionalEvidenceRouteKey;
  const decisions = policy.allowedDecisions || [];
  const decisionsValid = equal(decisions, ['confirm_exact_parent_occurrence_to_numbered_variant_binding', 'reject_exact_parent_occurrence_to_numbered_variant_binding', 'needs_additional_evidence']);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractValid && routeKeysValid && decisionsValid && invalidRules.length === 0 && forbidden.length === 0, contractValid, routeKeysValid, decisionsValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function sourceIntegrity(source = {}, contentHash = hash) {
  const identity = source.sourcePageIdentity || {};
  const text = source.exactRevisionSourceText;
  const checks = {
    captureComplete: source.captureComplete === true && source.state === 'complete_exact_revision_source_capture_non_verdict',
    identityComplete: Number(identity.sourcePageId) > 0 && typeof identity.resolvedTitle === 'string' && identity.resolvedTitle.length > 0 && typeof identity.sourceRevision === 'string' && identity.sourceRevision.length > 0 && typeof identity.sourceTimestamp === 'string' && identity.sourceTimestamp.length > 0 && typeof identity.sourceUrl === 'string' && identity.sourceUrl.length > 0,
    textPresent: typeof text === 'string',
    hashMatches: typeof text === 'string' && contentHash(text) === identity.sourceContentHash,
    bytesMatch: typeof text === 'string' && Buffer.byteLength(text, 'utf8') === identity.sourceContentBytes,
    upstreamChecksPassed: allTrue(source.integrityChecks),
    semanticVerdictNull: source.semanticVerdict === null
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function packetIntegrity(packet = {}, sourcesByKey = new Map(), contentHash = hash) {
  const subject = sourcesByKey.get(packet.subjectEvidence?.sourceKey);
  const parent = sourcesByKey.get(packet.parentOccurrenceEvidence?.sourceKey);
  const root = packet.subjectEvidence?.rootInfobox || {};
  const occurrence = packet.parentOccurrenceEvidence || {};
  const checks = {
    packetHashMatches: typeof packet.packetContentHash === 'string' && contentHash(without(packet, 'packetContentHash')) === packet.packetContentHash,
    captureComplete: packet.captureComplete === true && packet.state === 'revision_pinned_parent_occurrence_variant_binding_evidence_captured_review_pending',
    upstreamChecksPassed: allTrue(packet.integrityChecks),
    subjectSourceRevalidated: sourceIntegrity(subject, contentHash).complete,
    parentSourceRevalidated: sourceIntegrity(parent, contentHash).complete,
    subjectIdentityMatches: Boolean(subject && equal(subject.sourcePageIdentity, packet.subjectEvidence?.sourcePageIdentity)),
    parentIdentityMatches: Boolean(parent && equal(parent.sourcePageIdentity, occurrence.sourcePageIdentity)),
    rootInfoboxHashMatches: typeof root.exactSourceText === 'string' && contentHash(root.exactSourceText) === root.exactSourceTextContentHash,
    rootInfoboxOccursInSubject: typeof subject?.exactRevisionSourceText === 'string' && subject.exactRevisionSourceText.includes(root.exactSourceText || ''),
    parentOccurrenceHashMatches: typeof occurrence.exactSourceText === 'string' && contentHash(occurrence.exactSourceText) === occurrence.exactSourceTextContentHash,
    parentOccurrenceLocated: typeof occurrence.locatedSourceText === 'string' && occurrence.locatedSourceText.includes(occurrence.exactSourceText || '') && typeof parent?.exactRevisionSourceText === 'string' && parent.exactRevisionSourceText.includes(occurrence.exactSourceText || ''),
    reviewOpen: packet.variantBindingReviewComplete === false && packet.bindingEvidence?.bindingReviewDecision === null && packet.bindingEvidence?.boundVariantIndex === null,
    semanticGatesClosed: packet.candidateMemberIdentityVerdict === null && packet.parentMembershipVerdict === null && packet.weightedTaskEntryMembershipVerdict === null && packet.mappingVerdict === null && packet.inventoryCompletenessVerdict === null && packet.memberUniverseComplete === false && packet.optimizerEligible === false && packet.automaticVerificationApplied === false
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function dispositionIntegrity(disposition = {}, packet = {}, policy = {}) {
  const sufficiency = disposition.sufficiencyDisposition || {};
  const ready = sufficiency.routeKey === policy.reviewReadyRouteKey;
  const additional = sufficiency.routeKey === policy.additionalEvidenceRouteKey;
  const checks = {
    keyMatches: disposition.dispositionKey === `${packet.packetKey}|binding-evidence-disposition` && disposition.packetKey === packet.packetKey,
    sourceBindingsMatch: disposition.sourceWorkItemKey === packet.sourceWorkItemKey && disposition.sourceDispositionKey === packet.sourceDispositionKey && disposition.structuralCandidateKey === packet.structuralCandidateKey && disposition.candidateRole === packet.candidateRole,
    evidenceIntegrityComplete: disposition.evidenceIntegrity?.complete === true && allTrue(disposition.evidenceIntegrity?.checks),
    exactlyOneRoute: ready !== additional,
    reviewReadyCoherent: !ready || (sufficiency.reviewReady === true && Number.isInteger(sufficiency.reviewCandidateVariantIndex) && equal(sufficiency.matchingVariantIndices, [sufficiency.reviewCandidateVariantIndex]) && packet.bindingEvidence?.reviewReadyForVariantBinding === true && packet.bindingEvidence?.uniqueExactNumberedNameMatch === true),
    additionalCoherent: !additional || (sufficiency.reviewReady === false && sufficiency.reviewCandidateVariantIndex === null && Array.isArray(sufficiency.requiredAdditionalEvidenceChannels) && sufficiency.requiredAdditionalEvidenceChannels.length > 0),
    reviewUnresolved: sufficiency.bindingReviewDecision === null && sufficiency.boundVariantIndex === null,
    semanticGatesClosed: disposition.candidateMemberIdentityVerdict === null && disposition.parentMembershipVerdict === null && disposition.weightedTaskEntryMembershipVerdict === null && disposition.repeatabilityVerdict === null && disposition.mappingVerdict === null && disposition.inventoryCompletenessVerdict === null && disposition.canonicalGameEntityIdentity === null && disposition.memberUniverseComplete === false && disposition.mechanicsReviewComplete === false && disposition.optimizerEligible === false && disposition.automaticVerificationApplied === false
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function eligibleInput(record = {}, policy = {}, contentHash = hash) {
  const summary = record.variantBindingEvidenceDispositionSummary || {};
  const review = record.variantBindingEvidenceDispositionReview || {};
  const sources = record.exactRevisionSources || [];
  const packets = record.variantBindingEvidencePackets || [];
  const dispositions = record.variantBindingEvidenceDispositions || [];
  const sourcesByKey = new Map(sources.map(source => [source.sourceKey, source]));
  const packetsByKey = new Map(packets.map(packet => [packet.packetKey, packet]));
  return record.contract === policy.inputContract && record.state === policy.inputState && record.accountIndependent === true
    && typeof record.contentHash === 'string' && contentHash(without(record, 'contentHash')) === record.contentHash
    && sources.length > 0 && sources.every(source => sourceIntegrity(source, contentHash).complete)
    && packets.length > 0 && packets.every(packet => packetIntegrity(packet, sourcesByKey, contentHash).complete)
    && dispositions.length === packets.length && dispositions.every(disposition => dispositionIntegrity(disposition, packetsByKey.get(disposition.packetKey), policy).complete)
    && summary.dispositionCount === dispositions.length && summary.reviewReadyDispositionCount + summary.additionalEvidenceDispositionCount === dispositions.length
    && summary.bindingDecisionCount === 0 && summary.boundVariantCount === 0 && summary.optimizerEligibleCount === 0 && summary.memberUniverseComplete === false && summary.automaticVerificationApplied === false
    && review.bindingReviewDecision === null && review.boundVariantIndex === null && review.candidateMemberIdentityVerdict === null && review.memberUniverseComplete === false && review.evidenceWorkComplete === false && review.automaticVerificationApplied === false
    && record.optimizerEligible !== true;
}

export function selectMultiVariantBindingReviewAndAdditionalEvidenceQueueExportInputs(records = [], policy = {}, contentHash = hash) {
  return records.filter(record => eligibleInput(record, policy, contentHash));
}

function packetFor(record, disposition) {
  return (record.variantBindingEvidencePackets || []).find(packet => packet.packetKey === disposition.packetKey);
}

function displayName(packet = {}, disposition = {}) {
  const index = disposition.sufficiencyDisposition?.reviewCandidateVariantIndex;
  const match = (packet.bindingEvidence?.numberedNameFields || []).find(field => field.variantIndex === index);
  const parent = packet.bindingEvidence?.parentSubjectLinkDisplayValues?.[0];
  const subject = packet.subjectEvidence?.sourcePageIdentity?.resolvedTitle;
  return { value: String(match?.value || parent || subject || ''), source: match ? { kind: 'revision_pinned_numbered_infobox_name_field', parameterName: match.parameterName, variantIndex: match.variantIndex, rootInfoboxContentHash: packet.subjectEvidence?.rootInfobox?.exactSourceTextContentHash } : { kind: 'revision_pinned_parent_occurrence_display_text', parentOccurrenceContentHash: packet.parentOccurrenceEvidence?.exactSourceTextContentHash } };
}

function evidenceBinding(record, disposition, packet) {
  return {
    sourceDispositionRecordContentHash: record.contentHash,
    sourceEvidencePacketContentHash: packet.packetContentHash,
    sourceDispositionKey: disposition.dispositionKey,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    subject: {
      sourceKey: packet.subjectEvidence.sourceKey,
      sourcePageIdentity: packet.subjectEvidence.sourcePageIdentity,
      rootInfoboxContentHash: packet.subjectEvidence.rootInfobox.exactSourceTextContentHash,
      numberedVariantIndices: packet.subjectEvidence.numberedVariantIndices,
      numberedVariantInventory: packet.subjectEvidence.numberedVariantInventory
    },
    parent: {
      sourceKey: packet.parentOccurrenceEvidence.sourceKey,
      sourcePageIdentity: packet.parentOccurrenceEvidence.sourcePageIdentity,
      exactSourceTextContentHash: packet.parentOccurrenceEvidence.exactSourceTextContentHash,
      sourceLocator: packet.parentOccurrenceEvidence.sourceLocator,
      parentSubjectLinkDisplayValues: packet.bindingEvidence.parentSubjectLinkDisplayValues
    },
    sufficiencyDisposition: disposition.sufficiencyDisposition
  };
}

function sourceRevisions(packet = {}) {
  return unique([packet.subjectEvidence?.sourcePageIdentity?.sourceRevision, packet.parentOccurrenceEvidence?.sourcePageIdentity?.sourceRevision].filter(Boolean)).sort();
}

function reviewDecisionTemplate(queueEntryKey, disposition, packet, evidenceFingerprint, policy) {
  return {
    contract: policy.decisionTemplateContract,
    queueEntryKey,
    sourceDispositionKey: disposition.dispositionKey,
    sourceEvidencePacketContentHash: packet.packetContentHash,
    evidenceFingerprint,
    reviewCandidateVariantIndex: disposition.sufficiencyDisposition.reviewCandidateVariantIndex,
    decisionSourceRevisions: [],
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    state: 'blank_source_bound_variant_binding_review_decision'
  };
}

function reviewEntry(record, disposition, packet, ordinal, policy, contentHash) {
  const queueEntryKey = `${disposition.dispositionKey}|review-queue-entry`;
  const evidenceFingerprint = contentHash(evidenceBinding(record, disposition, packet));
  const label = displayName(packet, disposition);
  const decisionTemplate = reviewDecisionTemplate(queueEntryKey, disposition, packet, evidenceFingerprint, policy);
  const base = {
    contract: policy.reviewQueueContract,
    queueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionRecordContentHash: record.contentHash,
    sourceEvidencePacketContentHash: packet.packetContentHash,
    sourceDispositionKey: disposition.dispositionKey,
    evidenceFingerprint,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    candidateDisplayName: label.value,
    candidateDisplayNameSource: label.source,
    subjectEvidence: packet.subjectEvidence,
    parentOccurrenceEvidence: packet.parentOccurrenceEvidence,
    variantBindingReviewEvidence: {
      sourceBindingEvidenceState: disposition.sufficiencyDisposition.sourceBindingEvidenceState,
      matchingVariantIndices: disposition.sufficiencyDisposition.matchingVariantIndices,
      reviewCandidateVariantIndex: disposition.sufficiencyDisposition.reviewCandidateVariantIndex,
      bindingReviewDecision: null,
      boundVariantIndex: null
    },
    reviewScope: { decisionScope: 'exact_parent_occurrence_to_exact_revision_pinned_numbered_infobox_variant', sourceRevisions: sourceRevisions(packet), confirmationDoesNotProve: DOWNSTREAM_BOUNDARIES },
    allowedDecisions: [...policy.allowedDecisions],
    decisionTemplate,
    bindingReviewDecision: null,
    boundVariantIndex: null,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.reviewQueueState
  };
  return { ...base, entryContentHash: contentHash(base) };
}

function additionalEvidenceEntry(record, disposition, packet, ordinal, policy, contentHash) {
  const workQueueEntryKey = `${disposition.dispositionKey}|additional-evidence-work-queue-entry`;
  const evidenceFingerprint = contentHash(evidenceBinding(record, disposition, packet));
  const label = displayName(packet, disposition);
  const base = {
    contract: policy.additionalEvidenceQueueContract,
    workQueueEntryKey,
    queueOrdinal: ordinal,
    sourceDispositionRecordContentHash: record.contentHash,
    sourceEvidencePacketContentHash: packet.packetContentHash,
    sourceDispositionKey: disposition.dispositionKey,
    evidenceFingerprint,
    structuralCandidateKey: disposition.structuralCandidateKey,
    candidateRole: disposition.candidateRole,
    candidateDisplayName: label.value,
    candidateDisplayNameSource: label.source,
    subjectEvidence: packet.subjectEvidence,
    parentOccurrenceEvidence: packet.parentOccurrenceEvidence,
    insufficiencyEvidence: {
      sourceBindingEvidenceState: disposition.sufficiencyDisposition.sourceBindingEvidenceState,
      matchingVariantIndices: disposition.sufficiencyDisposition.matchingVariantIndices,
      sharedUnnumberedNameFields: packet.bindingEvidence.sharedUnnumberedNameFields,
      sharedUnnumberedNameMatchesParentDisplay: packet.bindingEvidence.sharedUnnumberedNameMatchesParentDisplay,
      blockers: disposition.blockers
    },
    requiredAdditionalEvidenceChannels: disposition.sufficiencyDisposition.requiredAdditionalEvidenceChannels,
    newEvidenceKeys: [],
    evidenceReviewer: null,
    evidenceReviewedAt: null,
    evidenceNotes: null,
    reviewCandidateVariantIndex: null,
    bindingReviewDecision: null,
    boundVariantIndex: null,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.additionalEvidenceQueueState
  };
  return { ...base, entryContentHash: contentHash(base) };
}

function exactRevisionUrl(identity = {}) {
  const separator = String(identity.sourceUrl || '').includes('?') ? '&' : '?';
  return `${identity.sourceUrl || ''}${separator}oldid=${identity.sourceRevision || ''}`;
}
const md = value => String(value ?? '').replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('|', '\\|');

export function renderMultiVariantBindingReviewQueueMarkdown(records = []) {
  const lines = ['# Multi-variant binding review queue', '', '> This queue proposes exact source-bound variant matches for human review. A review-candidate index is not a bound variant or a verified game fact.', '', `Entries: ${records.length}`, '', 'A confirmation does **not** prove candidate identity, weighted parent membership, repeatability, requirements, XP, timing, mechanics, declared-total mapping, member-universe completeness, or optimizer eligibility.', ''];
  for (const record of records) {
    const subject = record.subjectEvidence || {};
    const parent = record.parentOccurrenceEvidence || {};
    const locator = parent.sourceLocator || {};
    lines.push('<details>', `<summary>${String(record.queueOrdinal).padStart(3, '0')} — ${md(record.candidateDisplayName)} — proposed variant ${record.variantBindingReviewEvidence.reviewCandidateVariantIndex}</summary>`, '', `- Queue entry: \`${md(record.queueEntryKey)}\``, `- Evidence fingerprint: \`${record.evidenceFingerprint}\``, `- Evidence packet hash: \`${record.sourceEvidencePacketContentHash}\``, `- Subject: [${md(subject.sourcePageIdentity?.resolvedTitle)}](${exactRevisionUrl(subject.sourcePageIdentity)}) — page ${subject.sourcePageIdentity?.sourcePageId}, revision ${subject.sourcePageIdentity?.sourceRevision}`, `- Parent: [${md(parent.sourcePageIdentity?.resolvedTitle)}](${exactRevisionUrl(parent.sourcePageIdentity)}) — page ${parent.sourcePageIdentity?.sourcePageId}, revision ${parent.sourcePageIdentity?.sourceRevision}, lines ${locator.lineStart}–${locator.lineEnd}`, '', '## Exact subject infobox', '', '```wikitext', subject.rootInfobox?.exactSourceText || '', '```', '', '## Exact parent occurrence', '', '```wikitext', parent.exactSourceText || '', '```', '', '## Decision', '', '- [ ] Confirm exact parent-occurrence-to-numbered-variant binding', '- [ ] Reject binding', '- [ ] Needs additional evidence', '- Reviewer:', '- Reviewed at:', '- Notes:', '', '</details>', '');
  }
  return lines.join('\n');
}

export function renderMultiVariantBindingAdditionalEvidenceQueueMarkdown(records = []) {
  const lines = ['# Multi-variant binding additional-evidence work queue', '', '> These entries are not review-ready. Their parent occurrences do not uniquely identify a numbered source variant.', '', `Entries: ${records.length}`, ''];
  for (const record of records) {
    const subject = record.subjectEvidence || {};
    const parent = record.parentOccurrenceEvidence || {};
    lines.push('<details>', `<summary>${String(record.queueOrdinal).padStart(3, '0')} — ${md(record.candidateDisplayName)} — additional evidence required</summary>`, '', `- Work item: \`${md(record.workQueueEntryKey)}\``, `- Evidence fingerprint: \`${record.evidenceFingerprint}\``, `- Source state: \`${md(record.insufficiencyEvidence.sourceBindingEvidenceState)}\``, `- Subject: [${md(subject.sourcePageIdentity?.resolvedTitle)}](${exactRevisionUrl(subject.sourcePageIdentity)}) — revision ${subject.sourcePageIdentity?.sourceRevision}`, '', '## Exact subject infobox', '', '```wikitext', subject.rootInfobox?.exactSourceText || '', '```', '', '## Exact parent occurrence', '', '```wikitext', parent.exactSourceText || '', '```', '', '## Required evidence channels', '', ...record.requiredAdditionalEvidenceChannels.map(channel => `- ${md(channel)}`), '', '</details>', '');
  }
  return lines.join('\n');
}

export function serializeMultiVariantBindingReviewDecisionTemplates(templates = []) {
  return templates.map(template => json(template)).join('\n') + (templates.length ? '\n' : '');
}

function expectedArtifacts(inputs, policy, contentHash) {
  const reviewRecords = [];
  const additionalEvidenceRecords = [];
  for (const record of inputs) {
    let reviewOrdinal = reviewRecords.length + 1;
    let additionalOrdinal = additionalEvidenceRecords.length + 1;
    for (const disposition of record.variantBindingEvidenceDispositions || []) {
      const packet = packetFor(record, disposition);
      if (disposition.sufficiencyDisposition.routeKey === policy.reviewReadyRouteKey) reviewRecords.push(reviewEntry(record, disposition, packet, reviewOrdinal++, policy, contentHash));
      else if (disposition.sufficiencyDisposition.routeKey === policy.additionalEvidenceRouteKey) additionalEvidenceRecords.push(additionalEvidenceEntry(record, disposition, packet, additionalOrdinal++, policy, contentHash));
    }
  }
  const decisionTemplates = reviewRecords.map(record => record.decisionTemplate);
  return {
    reviewRecords,
    additionalEvidenceRecords,
    decisionTemplates,
    reviewMarkdown: renderMultiVariantBindingReviewQueueMarkdown(reviewRecords),
    additionalEvidenceMarkdown: renderMultiVariantBindingAdditionalEvidenceQueueMarkdown(additionalEvidenceRecords),
    decisionTemplateNdjson: serializeMultiVariantBindingReviewDecisionTemplates(decisionTemplates)
  };
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
  return [...new Set(findings)].sort();
}

export function auditMultiVariantBindingReviewAndAdditionalEvidenceQueueExport(reviewRecords = [], { dispositionRecords = [], policy = {}, additionalEvidenceRecords = [], decisionTemplates = [], reviewMarkdown = '', additionalEvidenceMarkdown = '', decisionTemplateNdjson = '', contentHash = hash } = {}) {
  const compiled = compileMultiVariantBindingReviewAndAdditionalEvidenceQueueExportPolicy(policy);
  const inputs = selectMultiVariantBindingReviewAndAdditionalEvidenceQueueExportInputs(dispositionRecords, policy, contentHash);
  const expected = compiled.valid ? expectedArtifacts(inputs, policy, contentHash) : { reviewRecords: [], additionalEvidenceRecords: [], decisionTemplates: [], reviewMarkdown: '', additionalEvidenceMarkdown: '', decisionTemplateNdjson: '' };
  const inputDispositions = inputs.flatMap(record => record.variantBindingEvidenceDispositions || []);
  const inputKeys = inputDispositions.map(item => item.dispositionKey);
  const reviewKeys = reviewRecords.map(item => item.sourceDispositionKey);
  const additionalKeys = additionalEvidenceRecords.map(item => item.sourceDispositionKey);
  const outputKeys = [...reviewKeys, ...additionalKeys];
  const duplicateInputKeys = duplicates(inputKeys);
  const duplicateReviewKeys = duplicates(reviewKeys);
  const duplicateAdditionalKeys = duplicates(additionalKeys);
  const crossQueueKeys = reviewKeys.filter(key => additionalKeys.includes(key));
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const inputHashFailures = dispositionRecords.filter(record => typeof record.contentHash !== 'string' || contentHash(without(record, 'contentHash')) !== record.contentHash).map(record => record.memberCandidateKey || 'unknown');
  const sources = inputs.flatMap(record => record.exactRevisionSources || []);
  const sourceFailures = sources.filter(source => !sourceIntegrity(source, contentHash).complete).map(source => source.sourceKey);
  const packetFailures = [];
  const dispositionFailures = [];
  for (const record of inputs) {
    const sourcesByKey = new Map(record.exactRevisionSources.map(source => [source.sourceKey, source]));
    for (const disposition of record.variantBindingEvidenceDispositions) {
      const packet = packetFor(record, disposition);
      if (!packetIntegrity(packet, sourcesByKey, contentHash).complete) packetFailures.push(packet?.packetKey || disposition.dispositionKey);
      if (!dispositionIntegrity(disposition, packet, policy).complete) dispositionFailures.push(disposition.dispositionKey);
    }
  }
  const reviewMismatches = reviewRecords.filter((record, index) => !expected.reviewRecords[index] || !equal(record, expected.reviewRecords[index])).map(record => record.queueEntryKey);
  const additionalMismatches = additionalEvidenceRecords.filter((record, index) => !expected.additionalEvidenceRecords[index] || !equal(record, expected.additionalEvidenceRecords[index])).map(record => record.workQueueEntryKey);
  const templateMismatches = decisionTemplates.filter((record, index) => !expected.decisionTemplates[index] || !equal(record, expected.decisionTemplates[index])).map(record => record.queueEntryKey);
  const sourceReviewOrder = inputDispositions.filter(item => item.sufficiencyDisposition.routeKey === policy.reviewReadyRouteKey).map(item => item.dispositionKey);
  const sourceAdditionalOrder = inputDispositions.filter(item => item.sufficiencyDisposition.routeKey === policy.additionalEvidenceRouteKey).map(item => item.dispositionKey);
  const reviewOrderPreserved = equal(reviewKeys, sourceReviewOrder) && reviewRecords.every((record, index) => record.queueOrdinal === index + 1);
  const additionalOrderPreserved = equal(additionalKeys, sourceAdditionalOrder) && additionalEvidenceRecords.every((record, index) => record.queueOrdinal === index + 1);
  const artifactsMatch = reviewMarkdown === expected.reviewMarkdown && additionalEvidenceMarkdown === expected.additionalEvidenceMarkdown && decisionTemplateNdjson === expected.decisionTemplateNdjson;
  const blankTemplates = decisionTemplates.filter(template => template.decision === null && template.reviewer === null && template.reviewedAt === null && template.reviewNotes === null && Array.isArray(template.decisionSourceRevisions) && template.decisionSourceRevisions.length === 0);
  const blankEvidenceWork = additionalEvidenceRecords.filter(record => record.newEvidenceKeys?.length === 0 && record.evidenceReviewer === null && record.evidenceReviewedAt === null && record.evidenceNotes === null && record.reviewCandidateVariantIndex === null && record.bindingReviewDecision === null && record.boundVariantIndex === null);
  const unsupportedPromotions = [...reviewRecords, ...additionalEvidenceRecords].filter(record => record.boundVariantIndex != null || record.bindingReviewDecision != null || record.variantBindingReviewEvidence?.boundVariantIndex != null || record.variantBindingReviewEvidence?.bindingReviewDecision != null || record.candidateMemberIdentityVerdict != null || record.parentMembershipVerdict != null || record.weightedTaskEntryMembershipVerdict != null || record.repeatabilityVerdict != null || record.mappingVerdict != null || record.inventoryCompletenessVerdict != null || record.memberUniverseComplete === true || record.mechanicsReviewComplete === true || record.optimizerEligible === true || record.automaticVerificationApplied === true).map(record => record.queueEntryKey || record.workQueueEntryKey);
  const accountFindings = accountStateFindings([...reviewRecords, ...additionalEvidenceRecords, ...decisionTemplates]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('multi_variant_binding_queue_export_policy_invalid_or_candidate_specific');
  if (dispositionRecords.length !== inputs.length || duplicateInputKeys.length || inputHashFailures.length) structuralBlockers.push('input_disposition_record_set_not_exactly_eligible_unique_and_hash_valid');
  if (duplicateReviewKeys.length || duplicateAdditionalKeys.length || crossQueueKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('review_and_additional_evidence_queue_partition_not_exact_disjoint_and_complete');
  if (sourceFailures.length || packetFailures.length || dispositionFailures.length) structuralBlockers.push('one_or_more_sources_packets_or_dispositions_failed_revalidation');
  if (reviewMismatches.length || additionalMismatches.length || templateMismatches.length) structuralBlockers.push('one_or_more_queue_entries_or_templates_do_not_match_generic_export_policy');
  if (!reviewOrderPreserved || !additionalOrderPreserved) structuralBlockers.push('one_or_more_queues_do_not_preserve_source_disposition_order');
  if (!artifactsMatch) structuralBlockers.push('one_or_more_queue_artifacts_do_not_match_exact_expected_rendering');
  if (blankTemplates.length !== decisionTemplates.length || blankEvidenceWork.length !== additionalEvidenceRecords.length || unsupportedPromotions.length) structuralBlockers.push('queue_export_created_review_evidence_or_unsupported_semantic_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    inputCoverage: { inputDispositionRecordCount: dispositionRecords.length, eligibleDispositionRecordCount: inputs.length, inputDispositionCount: inputDispositions.length, duplicateInputKeys, inputHashFailures },
    policyCoverage: compiled,
    sourceIntegrityCoverage: { exactRevisionSourceCount: sources.length, completeSourceCount: sources.length - sourceFailures.length, failedSourceKeys: sourceFailures },
    packetAndDispositionIntegrityCoverage: { evidencePacketCount: inputDispositions.length, revalidatedPacketCount: inputDispositions.length - packetFailures.length, failedPacketKeys: packetFailures, dispositionCount: inputDispositions.length, revalidatedDispositionCount: inputDispositions.length - dispositionFailures.length, failedDispositionKeys: dispositionFailures },
    queuePartitionCoverage: { reviewQueueEntryCount: reviewRecords.length, additionalEvidenceQueueEntryCount: additionalEvidenceRecords.length, unionCount: outputKeys.length, duplicateReviewKeys, duplicateAdditionalKeys, crossQueueKeys, missingOutputKeys, unexpectedOutputKeys, reviewOrderPreserved, additionalOrderPreserved, blankDecisionTemplateCount: blankTemplates.length, blankAdditionalEvidenceWorkCount: blankEvidenceWork.length },
    artifactCoverage: { reviewMarkdownMatches: reviewMarkdown === expected.reviewMarkdown, additionalEvidenceMarkdownMatches: additionalEvidenceMarkdown === expected.additionalEvidenceMarkdown, decisionTemplateNdjsonMatches: decisionTemplateNdjson === expected.decisionTemplateNdjson, reviewMarkdownContentHash: contentHash(reviewMarkdown), additionalEvidenceMarkdownContentHash: contentHash(additionalEvidenceMarkdown), decisionTemplateNdjsonContentHash: contentHash(decisionTemplateNdjson) },
    semanticPreservationCoverage: { reviewMismatches, additionalMismatches, templateMismatches, unsupportedPromotions },
    accountStateFindings: accountFindings,
    queueExportComplete: publishable && outputKeys.length === inputKeys.length,
    variantBindingReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers, 'multi_variant_binding_review_decisions_pending', ...(additionalEvidenceRecords.length ? ['one_or_more_variant_bindings_require_additional_disambiguating_evidence'] : []), 'candidate_member_identity_and_variant_binding_reviews_pending', 'weighted_parent_task_entry_membership_not_proven', 'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven', 'member_universe_completeness_not_proven', 'all_repeatability_evidence_domains_remain_unresolved', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable
  };
}

export function buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport({ dispositionRecords = [], policy = {}, contentHash = hash } = {}) {
  const compiled = compileMultiVariantBindingReviewAndAdditionalEvidenceQueueExportPolicy(policy);
  const inputs = compiled.valid ? selectMultiVariantBindingReviewAndAdditionalEvidenceQueueExportInputs(dispositionRecords, policy, contentHash) : [];
  const artifacts = expectedArtifacts(inputs, policy, contentHash);
  return { ...artifacts, audit: auditMultiVariantBindingReviewAndAdditionalEvidenceQueueExport(artifacts.reviewRecords, { dispositionRecords, policy, additionalEvidenceRecords: artifacts.additionalEvidenceRecords, decisionTemplates: artifacts.decisionTemplates, reviewMarkdown: artifacts.reviewMarkdown, additionalEvidenceMarkdown: artifacts.additionalEvidenceMarkdown, decisionTemplateNdjson: artifacts.decisionTemplateNdjson, contentHash }) };
}
