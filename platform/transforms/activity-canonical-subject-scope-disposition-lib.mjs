import { findUnresolvedSubjectSourceSignatureAccountState } from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';
import { createHash } from 'node:crypto';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceActivityCanonicalSubjectScopeEvidenceContentHash',
  'canonicalActivityScopeDisposition', 'canonicalActivityScopeReview'
]);
const resolvedScopeBlockers = new Set([
  'canonical_activity_scope_unresolved',
  'canonical_activity_scope_review_incomplete',
  'canonical_activity_scope_evidence_requires_semantic_disposition'
]);
const hashText = value => createHash('sha256').update(String(value)).digest('hex');

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

function validRegex(signal) {
  try {
    new RegExp(signal.pattern, signal.flags || '');
    return true;
  } catch {
    return false;
  }
}

export function compileActivityCanonicalSubjectScopeDispositionPolicy(policy = {}) {
  const requiredTrueRules = [
    'oneDispositionPerCompleteScopeEvidenceRecord',
    'scopeClassificationRequiresOneCompleteExactRevisionSourcePacket',
    'scopeClassificationRequiresEveryGenericSignalExactlyOnce',
    'positiveIntegerCapturesMustBeSourceAuthored',
    'sourceLinesHashesLocatorsAndRevisionIdentityMustRemainAligned',
    'scopeClassificationDoesNotClassifyRepeatability',
    'scopeClassificationDoesNotCompleteMemberExpansionOrMechanics',
    'scopeClassificationDoesNotCreateOptimizerCandidates',
    'nonExhaustiveMemberInventoryRemainsAnExplicitBlocker',
    'missingChangedDuplicateContradictoryOrConditionMismatchedEvidenceRemainsBlocked',
    'activityNamesLabelsPageIdsCandidateKeysAliasesCollectionClassesAndOverridesAreForbidden',
    'upstreamEvidenceIdentityRevisionHashesAndContextMustBePreserved',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract || !policy.inputState || !policy.requiredEvidenceState) invalidRules.push('scope_disposition_contract_boundary_missing');
  const rule = policy.scopeRule || {};
  const signals = Array.isArray(rule.requiredSignals) ? rule.requiredSignals : [];
  const invalidScopeRule = [];
  if (!rule.ruleKey || rule.requiredSourcePacketCount !== 1 || !rule.verdict || !rule.scopeClass || !rule.memberUniverseState || !rule.assignmentConditionState) invalidScopeRule.push('scope_rule_identity_or_cardinality_invalid');
  if (!signals.length || duplicates(signals.map(signal => signal.signalKey)).length) invalidScopeRule.push('required_signal_keys_invalid');
  if (signals.some(signal => !signal.signalKey || signal.sourceRegion !== 'lead' || signal.cardinality !== 'exactly_one' || !signal.pattern || !validRegex(signal))) invalidScopeRule.push('required_signal_definition_invalid');
  const captured = signals.filter(signal => signal.positiveIntegerCaptureGroup !== undefined);
  if (captured.length !== 1 || !Number.isInteger(captured[0]?.positiveIntegerCaptureGroup) || captured[0].positiveIntegerCaptureGroup < 1) invalidScopeRule.push('positive_integer_capture_rule_invalid');
  return {
    policyId: policy.policy || null,
    invalidRules,
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    invalidScopeRule,
    scopeRule: rule,
    requiredSignals: signals
  };
}

export function selectActivityCanonicalSubjectScopeDispositionInputs(records = [], policy = {}) {
  return records.filter(record => record.contract === policy.inputContract
    && record.state === policy.inputState
    && record.canonicalActivityScopeEvidence?.evidenceState === policy.requiredEvidenceState
    && record.canonicalActivityScopeReview?.state === 'unreviewed_complete_revision_pinned_scope_evidence_semantic_disposition_required'
    && record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === null
    && record.canonicalActivityScopeReview?.repeatabilityVerdict === null
    && record.canonicalActivitySubjectBinding !== null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true);
}

function wikiPlainText(value = '') {
  return String(value)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function linesForRegion(packet, sourceRegion) {
  const lines = packet?.structuralInventory?.sourceLines || [];
  if (sourceRegion !== 'lead') return [];
  const leadLocators = packet?.structuralInventory?.leadParagraphs?.map(paragraph => paragraph.sourceLocator) || [];
  return lines.filter(line => leadLocators.some(locator => line.ordinal >= locator.lineStart && line.ordinal <= locator.lineEnd));
}

function signalMatches(packet, signal) {
  const flags = unique(`${signal.flags || ''}g`.split('')).join('');
  const expression = new RegExp(signal.pattern, flags);
  const matches = [];
  for (const line of linesForRegion(packet, signal.sourceRegion)) {
    const lexicalText = wikiPlainText(line.rawText);
    for (const match of lexicalText.matchAll(expression)) {
      const capture = signal.positiveIntegerCaptureGroup === undefined
        ? null
        : Number(match[signal.positiveIntegerCaptureGroup]);
      matches.push({
        signalKey: signal.signalKey,
        sourceEvidenceKey: packet.sourceEvidenceKey,
        exactSourceLine: line.rawText,
        exactSourceLineContentHash: line.rawTextContentHash,
        sourceLocator: line.sourceLocator,
        lexicalMatch: match[0],
        lexicalOffsetStart: match.index,
        lexicalOffsetEnd: match.index + match[0].length,
        capturedPositiveInteger: Number.isInteger(capture) && capture > 0 ? capture : null,
        evidenceKey: `${packet.sourceEvidenceKey}:${signal.signalKey}:${line.ordinal}:${match.index}`
      });
    }
  }
  return matches;
}

function identityAligned(bindingIdentity = {}, packetIdentity = {}) {
  return ['sourcePageId', 'resolvedTitle', 'sourceRevision', 'sourceTimestamp', 'sourceUrl', 'sourceContentHash']
    .every(field => bindingIdentity[field] === packetIdentity[field]);
}

function scopeBasis(input, compiled) {
  const packets = input.canonicalActivityScopeEvidenceSources || [];
  const packet = packets[0] || null;
  const signalEvidence = Object.fromEntries(compiled.requiredSignals.map(signal => [signal.signalKey, signalMatches(packet, signal)]));
  const capturedRule = compiled.requiredSignals.find(signal => signal.positiveIntegerCaptureGroup !== undefined);
  const declaredTaskCount = capturedRule && signalEvidence[capturedRule.signalKey]?.length === 1
    ? signalEvidence[capturedRule.signalKey][0].capturedPositiveInteger
    : null;
  const revisionChecks = Object.values(packet?.sourceRevisionVerification || {});
  const sourceLines = packet?.structuralInventory?.sourceLines || [];
  const reconstructedSource = sourceLines.map(line => line.rawText).join('\n');
  const checks = {
    exactRequiredSourcePacketCount: packets.length === compiled.scopeRule.requiredSourcePacketCount,
    completeEvidenceState: input.canonicalActivityScopeEvidence?.evidenceState === 'complete_revision_pinned_canonical_activity_scope_evidence_packet',
    completeSourcePacketState: packet?.state === 'complete_revision_pinned_canonical_activity_scope_source',
    sourcePacketHasNoDeficiencies: Array.isArray(packet?.deficiencies) && packet.deficiencies.length === 0,
    allRevisionBoundaryChecksPass: revisionChecks.length > 0 && revisionChecks.every(value => value === true),
    bindingAndPacketSourceIdentityAlign: identityAligned(input.canonicalActivitySubjectBinding?.sourcePageIdentity, packet?.sourcePageIdentity),
    exactSourceLineInventoryReconstructsSource: typeof packet?.exactRevisionSourceText === 'string' && reconstructedSource === packet.exactRevisionSourceText,
    sourceContentHashMatchesExactText: typeof packet?.exactRevisionSourceText === 'string'
      && packet?.sourcePageIdentity?.sourceContentHash === hashText(packet.exactRevisionSourceText),
    sourceLineHashesMatchExactText: sourceLines.length > 0 && sourceLines.every(line => line.rawTextContentHash === hashText(line.rawText)),
    sourceLineLocatorsAndOrdinalsAlign: sourceLines.length > 0 && sourceLines.every((line, index) => line.ordinal === index + 1
      && line.sourceLocator?.lineStart === line.ordinal && line.sourceLocator?.lineEnd === line.ordinal),
    evidenceDomainCountComplete: packet?.domainEvidence?.length === input.canonicalActivityScopeEvidence?.requiredEvidenceDomainCount
      && packet?.domainEvidence?.every(domain => domain.captureState === 'captured_for_semantic_disposition_not_a_scope_verdict'),
    captureChannelCountComplete: packet?.captureChannels?.length === input.canonicalActivityScopeEvidence?.requiredCaptureChannelCount
      && packet?.captureChannels?.every(channel => channel.complete === true),
    everyRequiredSignalOccursExactlyOnce: compiled.requiredSignals.every(signal => signalEvidence[signal.signalKey]?.length === 1),
    declaredTaskCountIsSourceAuthoredPositiveInteger: Number.isInteger(declaredTaskCount) && declaredTaskCount > 0,
    upstreamScopeAndRepeatabilityVerdictsRemainNull: input.canonicalActivityScopeEvidence?.canonicalActivityScopeVerdict === null
      && input.canonicalActivityScopeEvidence?.repeatabilityVerdict === null
      && packet?.canonicalActivityScopeVerdict === null
      && packet?.repeatabilityVerdict === null
  };
  const deficiencies = [
    ...Object.entries(checks).filter(([, passed]) => !passed).map(([check]) => check),
    ...compiled.requiredSignals.flatMap(signal => {
      const count = signalEvidence[signal.signalKey]?.length || 0;
      return count === 1 ? [] : [`required_signal_cardinality:${signal.signalKey}:${count}`];
    })
  ];
  return {
    sufficient: Object.values(checks).every(Boolean),
    checks,
    deficiencies,
    signalEvidence,
    declaredTaskCount,
    packet
  };
}

function expectedRecord(input, policy) {
  const compiled = compileActivityCanonicalSubjectScopeDispositionPolicy(policy);
  const basis = scopeBasis(input, compiled);
  const rule = compiled.scopeRule;
  const evidenceSignals = compiled.requiredSignals.flatMap(signal => basis.signalEvidence[signal.signalKey] || []);
  const evidenceKeys = evidenceSignals.map(signal => signal.evidenceKey);
  const classified = basis.sufficient;
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceActivityCanonicalSubjectScopeEvidenceContentHash: input.contentHash,
    canonicalActivityScopeDisposition: {
      state: classified ? 'source_supported_composite_assigned_task_activity_scope' : 'blocked_incomplete_or_inconsistent_scope_evidence',
      ruleKey: rule.ruleKey || null,
      canonicalActivityScopeVerdict: classified ? rule.verdict : null,
      scopeClass: classified ? rule.scopeClass : null,
      memberUniverseState: classified ? rule.memberUniverseState : null,
      assignmentConditionState: classified ? rule.assignmentConditionState : null,
      declaredTaskCount: classified ? basis.declaredTaskCount : null,
      memberInventoryComplete: classified ? false : null,
      evidenceSignals,
      evidenceKeys,
      sufficiencyChecks: basis.checks,
      deficiencies: basis.deficiencies,
      repeatabilityVerdict: null
    },
    canonicalActivityScopeReview: {
      state: classified ? 'reviewed_source_supported_composite_assigned_task_activity_scope' : 'reviewed_blocked_incomplete_or_inconsistent_scope_evidence',
      canonicalActivitySubjectDeclarationVerdict: input.canonicalActivityScopeReview.canonicalActivitySubjectDeclarationVerdict,
      canonicalActivityScopeVerdict: classified ? rule.verdict : null,
      scopeClass: classified ? rule.scopeClass : null,
      declaredTaskCount: classified ? basis.declaredTaskCount : null,
      memberUniverseState: classified ? rule.memberUniverseState : null,
      assignmentConditionState: classified ? rule.assignmentConditionState : null,
      repeatabilityVerdict: null,
      evidenceKeys
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => !(classified && resolvedScopeBlockers.has(blocker))),
      ...basis.deficiencies.map(deficiency => `canonical_activity_scope_sufficiency_failed:${deficiency}`),
      ...(classified ? ['source_declares_member_inventory_may_not_be_exhaustive'] : ['canonical_activity_scope_unresolved']),
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: classified
      ? 'canonical_activity_scope_disposed_composite_assigned_tasks_repeatability_unresolved'
      : 'canonical_activity_scope_disposition_blocked_incomplete_or_inconsistent_evidence'
  };
}

export function buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords = [], policy = {} }) {
  const inputs = selectActivityCanonicalSubjectScopeDispositionInputs(evidenceRecords, policy);
  const records = inputs.map(input => expectedRecord(input, policy));
  return { records, audit: auditActivityCanonicalSubjectScopeDispositions(records, { evidenceRecords, policy }) };
}

export function auditActivityCanonicalSubjectScopeDispositions(records = [], { evidenceRecords = [], policy = {} } = {}) {
  const compiled = compileActivityCanonicalSubjectScopeDispositionPolicy(policy);
  const inputs = selectActivityCanonicalSubjectScopeDispositionInputs(evidenceRecords, policy);
  const expected = inputs.map(input => expectedRecord(input, policy));
  const inputByKey = new Map(inputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const expectedKeys = inputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || record.sourceActivityCanonicalSubjectScopeEvidenceContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const dispositionMismatches = records.filter(record => {
    const expectedValue = expectedByKey.get(record.memberCandidateKey);
    return !expectedValue
      || JSON.stringify(record.canonicalActivityScopeDisposition) !== JSON.stringify(expectedValue.canonicalActivityScopeDisposition)
      || JSON.stringify(record.canonicalActivityScopeReview) !== JSON.stringify(expectedValue.canonicalActivityScopeReview)
      || JSON.stringify(record.blockers) !== JSON.stringify(expectedValue.blockers)
      || record.state !== expectedValue.state
      || record.accountIndependent !== true;
  }).map(record => record.memberCandidateKey);
  const invalidScopeClassifications = records.filter(record => {
    const expectedValue = expectedByKey.get(record.memberCandidateKey);
    return record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict !== expectedValue?.canonicalActivityScopeReview?.canonicalActivityScopeVerdict
      || (record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict !== null
        && record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict !== compiled.scopeRule.verdict);
  }).map(record => record.memberCandidateKey);
  const staleResolvedScopeBlockers = records.filter(record => record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === compiled.scopeRule.verdict
    && (record.blockers || []).some(blocker => resolvedScopeBlockers.has(blocker))).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => record.canonicalActivityScopeDisposition?.repeatabilityVerdict !== null
    || record.canonicalActivityScopeReview?.repeatabilityVerdict !== null
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const dispositionAttemptCoverageComplete = inputs.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length
    && !contextMismatches.length && !dispositionMismatches.length && !invalidScopeClassifications.length
    && !staleResolvedScopeBlockers.length && !downstreamPromotions.length && !accountStateFindings.length
    && !compiled.invalidRules.length && !compiled.forbiddenPolicyPaths.length && !compiled.invalidScopeRule.length;
  const classified = records.filter(record => record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict === compiled.scopeRule.verdict);
  const canonicalActivityScopeReviewComplete = dispositionAttemptCoverageComplete && classified.length === inputs.length;
  const structuralBlockers = [
    ...(duplicateInputKeys.length ? ['duplicate_input_member_candidate_keys'] : []),
    ...(duplicateOutputKeys.length ? ['duplicate_output_member_candidate_keys'] : []),
    ...(missingKeys.length ? ['missing_scope_disposition_records'] : []),
    ...(unexpectedKeys.length ? ['unexpected_scope_disposition_records'] : []),
    ...(contextMismatches.length ? ['upstream_scope_evidence_context_mutated'] : []),
    ...(dispositionMismatches.length ? ['one_or_more_scope_dispositions_do_not_match_policy'] : []),
    ...(invalidScopeClassifications.length ? ['unsupported_or_insufficient_scope_classification'] : []),
    ...(staleResolvedScopeBlockers.length ? ['classified_scope_retains_resolved_scope_blocker'] : []),
    ...(downstreamPromotions.length ? ['unsupported_repeatability_member_mechanics_or_optimizer_promotion'] : []),
    ...(accountStateFindings.length ? ['account_query_state_baked_into_canonical_activity_scope_disposition'] : []),
    ...compiled.invalidRules.map(rule => `invalid_policy_rule:${rule}`),
    ...compiled.forbiddenPolicyPaths.map(path => `activity_specific_policy_path_forbidden:${path}`),
    ...compiled.invalidScopeRule.map(rule => `invalid_scope_rule:${rule}`)
  ];
  return {
    contract: policy.auditContract,
    accountIndependent: true,
    inputCoverage: {
      expectedEvidenceRecordCount: inputs.length,
      dispositionRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      invalidScopeRule: compiled.invalidScopeRule,
      requiredSignalCount: compiled.requiredSignals.length
    },
    scopeClassificationCoverage: {
      sourceSupportedCompositeAssignedTaskScopeCount: classified.length,
      blockedScopeCount: records.length - classified.length,
      declaredTaskCounts: Object.fromEntries(classified.map(record => [record.memberCandidateKey, record.canonicalActivityScopeReview.declaredTaskCount])),
      scopeClasses: Object.fromEntries(classified.map(record => [record.memberCandidateKey, record.canonicalActivityScopeReview.scopeClass])),
      memberUniverseStates: Object.fromEntries(classified.map(record => [record.memberCandidateKey, record.canonicalActivityScopeReview.memberUniverseState])),
      dispositionMismatchMemberCandidateKeys: dispositionMismatches,
      invalidScopeClassificationMemberCandidateKeys: invalidScopeClassifications,
      staleResolvedScopeBlockerMemberCandidateKeys: staleResolvedScopeBlockers
    },
    semanticPromotionCoverage: {
      preservedCanonicalActivitySubjectBindingCount: records.filter(record => record.canonicalActivitySubjectBinding !== null).length,
      canonicalActivityScopeClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.canonicalActivityScopeVerdict !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.canonicalActivityScopeReview?.repeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedDownstreamPromotionMemberCandidateKeys: downstreamPromotions
    },
    accountStateFindings,
    dispositionAttemptCoverageComplete,
    canonicalActivityScopeReviewComplete,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(canonicalActivityScopeReviewComplete ? [] : ['canonical_activity_scope_review_incomplete']),
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: dispositionAttemptCoverageComplete
  };
}
