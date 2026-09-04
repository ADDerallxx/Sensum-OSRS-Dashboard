const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

export function plainTextFromWiki(value = '') {
  return String(value ?? '')
    .replace(/^\s*\[\[File:[^\r\n]+\]\]\s*$/gim, ' ')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<ref\b[^>]*>[^]*?<\/ref\s*>|<ref\b[^>]*\/\s*>/gi, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstParameter(infobox, key) {
  return (infobox?.parameters || []).find(parameter => parameter.parameterKind === 'named' && parameter.parameterKey === key) || null;
}

export function compileActivityCandidateSubjectDispositionPolicy(policy = {}) {
  const pageSpecificPolicyPaths = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|title|titles|candidateKey|candidateKeys)$/i.test(name)) pageSpecificPolicyPaths.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  const leadDeclarationRules = (policy.leadDeclarationRules || []).map(rule => ({
    ...rule,
    regex: new RegExp(rule.pattern, rule.flags || '')
  }));
  return {
    policy: policy.policy || null,
    infoboxTypeDispositions: new Map(Object.entries(policy.infoboxTypeDispositions || {}).map(([key, value]) => [key.toLowerCase(), value])),
    leadDeclarationRules,
    pageSpecificPolicyPaths
  };
}

function dispositionSignals(record, compiledPolicy) {
  const signals = [];
  const typeParameter = firstParameter(record.infoboxEvidence, 'type');
  const normalizedType = plainTextFromWiki(typeParameter?.rawValue || '').toLowerCase();
  const infoboxDisposition = compiledPolicy.infoboxTypeDispositions.get(normalizedType);
  if (typeParameter && infoboxDisposition) {
    signals.push({
      signalKind: 'infobox_type_parameter',
      signalKey: `infobox_type:${normalizedType}`,
      disposition: infoboxDisposition,
      rawValue: typeParameter.rawValue,
      plainText: plainTextFromWiki(typeParameter.rawValue),
      sourceLocator: typeParameter.sourceLocator
    });
  }
  const firstLead = record.leadParagraphEvidence?.[0] || null;
  const leadPlainText = plainTextFromWiki(firstLead?.rawText || '');
  for (const rule of compiledPolicy.leadDeclarationRules) {
    if (!firstLead) continue;
    if (rule.supportedInfobox === 'absent' && record.infoboxEvidence !== null) continue;
    if (rule.supportedInfobox === 'present' && record.infoboxEvidence === null) continue;
    const match = rule.regex.exec(leadPlainText);
    if (!match) continue;
    signals.push({
      signalKind: 'first_lead_paragraph_declaration',
      signalKey: rule.ruleKey,
      disposition: rule.disposition,
      rawValue: firstLead.rawText,
      plainText: leadPlainText,
      matchedText: match[0],
      sourceLocator: firstLead.sourceLocator
    });
  }
  return signals;
}

function assessInfoboxType(record, compiledPolicy) {
  const parameter = firstParameter(record.infoboxEvidence, 'type');
  if (!parameter) return { present: false, rawValue: null, normalizedValue: null, mapped: false, disposition: null, sourceLocator: null };
  const normalizedValue = plainTextFromWiki(parameter.rawValue).toLowerCase();
  const disposition = compiledPolicy.infoboxTypeDispositions.get(normalizedValue) || null;
  return { present: true, rawValue: parameter.rawValue, normalizedValue, mapped: Boolean(disposition), disposition, sourceLocator: parameter.sourceLocator };
}

export function findActivityCandidateSubjectDispositionAccountState(records = []) {
  const findings = [];
  const visit = (value, path, recordKey) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`, recordKey)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ recordKey, path: childPath, value: child });
      visit(child, childPath, recordKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record?.candidateKey || `record-${index}`));
  return findings;
}

export function buildActivityCandidateSubjectDispositions({ evidenceRecords = [], policy = {} }) {
  const compiled = compileActivityCandidateSubjectDispositionPolicy(policy);
  const records = evidenceRecords.map(evidence => {
    const infoboxTypeAssessment = assessInfoboxType(evidence, compiled);
    const signals = dispositionSignals(evidence, compiled);
    const dispositions = sorted(unique(signals.map(signal => signal.disposition)));
    const state = infoboxTypeAssessment.present && !infoboxTypeAssessment.mapped
      ? 'blocked_unmapped_infobox_type'
      : dispositions.length === 1
        ? 'source_supported'
        : dispositions.length > 1
          ? 'blocked_conflicting_source_declarations'
          : 'unresolved_no_supported_source_declaration';
    const blockers = [];
    if (infoboxTypeAssessment.present && !infoboxTypeAssessment.mapped) blockers.push('unmapped_infobox_type_value');
    if (dispositions.length > 1) blockers.push('explicit_source_subject_dispositions_conflict');
    if (dispositions.length === 0) blockers.push('no_supported_source_subject_disposition');
    blockers.push(
      'canonical_game_entity_identity_not_established',
      'canonical_activity_identity_not_established',
      'repeatability_not_reviewed',
      'member_and_variant_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: 'sensum.activity-candidate-subject-disposition.v1',
      candidateKey: evidence.candidateKey,
      sourcePageId: evidence.sourcePageId,
      resolvedTitle: evidence.resolvedTitle,
      skillKeys: sorted(evidence.skillKeys || []),
      statementKeys: sorted(evidence.statementKeys || []),
      sourceRevision: evidence.sourceRevision,
      sourceTimestamp: evidence.sourceTimestamp,
      sourceUrl: evidence.sourceUrl,
      sourceContentHash: evidence.sourceContentHash,
      sourceEvidenceContentHash: evidence.contentHash,
      sourceSignatureContexts: evidence.sourceSignatureContexts || [],
      infoboxTypeAssessment,
      dispositionSignals: signals,
      subjectDisposition: { state, disposition: state === 'source_supported' ? dispositions[0] : null, conflictingDispositions: dispositions.length > 1 ? dispositions : [] },
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: state === 'source_supported' ? 'subject_disposition_ready' : 'blocked'
    };
  });
  return { records, audit: auditActivityCandidateSubjectDispositions(records, { evidenceRecords, policy }) };
}

const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const preservedIdentity = record => JSON.stringify({
  candidateKey: record.candidateKey,
  sourcePageId: record.sourcePageId,
  resolvedTitle: record.resolvedTitle,
  skillKeys: sorted(record.skillKeys || []),
  statementKeys: sorted(record.statementKeys || []),
  sourceRevision: String(record.sourceRevision || ''),
  sourceTimestamp: record.sourceTimestamp || null,
  sourceUrl: record.sourceUrl || null,
  sourceContentHash: record.sourceContentHash || null,
  sourceEvidenceContentHash: record.sourceEvidenceContentHash || record.contentHash || null,
  sourceSignatureContexts: record.sourceSignatureContexts || []
});

export function auditActivityCandidateSubjectDispositions(records = [], { evidenceRecords = [], policy = {} } = {}) {
  const compiled = compileActivityCandidateSubjectDispositionPolicy(policy);
  const expectedKeys = evidenceRecords.map(record => record.candidateKey);
  const actualKeys = records.map(record => record.candidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const evidenceByKey = new Map(evidenceRecords.map(record => [record.candidateKey, record]));
  const identityContextMismatches = records.filter(record => {
    const evidence = evidenceByKey.get(record.candidateKey);
    return evidence && preservedIdentity(record) !== preservedIdentity(evidence);
  }).map(record => record.candidateKey);
  const resolved = records.filter(record => record.subjectDisposition?.state === 'source_supported');
  const conflicts = records.filter(record => record.subjectDisposition?.state === 'blocked_conflicting_source_declarations');
  const unresolved = records.filter(record => record.subjectDisposition?.state === 'unresolved_no_supported_source_declaration');
  const unmappedInfoboxTypes = records.filter(record => record.subjectDisposition?.state === 'blocked_unmapped_infobox_type');
  const invalidStates = records.filter(record => !['source_supported', 'blocked_conflicting_source_declarations', 'unresolved_no_supported_source_declaration', 'blocked_unmapped_infobox_type'].includes(record.subjectDisposition?.state)).map(record => record.candidateKey);
  const resolvedWithoutOneDisposition = resolved.filter(record => !record.subjectDisposition?.disposition || record.subjectDisposition?.conflictingDispositions?.length || !record.dispositionSignals?.length || unique(record.dispositionSignals.map(signal => signal.disposition)).length !== 1).map(record => record.candidateKey);
  const conflictWithoutDistinctSignals = conflicts.filter(record => unique((record.dispositionSignals || []).map(signal => signal.disposition)).length < 2 || record.subjectDisposition?.disposition !== null).map(record => record.candidateKey);
  const unexpectedSignalKinds = unique(records.flatMap(record => (record.dispositionSignals || []).map(signal => signal.signalKind)).filter(kind => !['infobox_type_parameter', 'first_lead_paragraph_declaration'].includes(kind)));
  const dispositionCounts = Object.fromEntries(sorted(unique(resolved.map(record => record.subjectDisposition.disposition))).map(disposition => [disposition, resolved.filter(record => record.subjectDisposition.disposition === disposition).length]));
  const conflictPairs = Object.fromEntries(sorted(unique(conflicts.map(record => record.subjectDisposition.conflictingDispositions.join(' + ')))).map(pair => [pair, conflicts.filter(record => record.subjectDisposition.conflictingDispositions.join(' + ') === pair).length]));
  const accountStateFindings = findActivityCandidateSubjectDispositionAccountState(records);
  const unsupportedPromotions = records.filter(record => record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null || record.optimizerEligible !== false || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed').map(record => record.candidateKey);
  const structuralBlockers = [];
  if (duplicateInputKeys.length) structuralBlockers.push('duplicate_activity_source_evidence_candidate_keys');
  if (duplicateOutputKeys.length) structuralBlockers.push('duplicate_activity_subject_disposition_candidate_keys');
  if (missingKeys.length) structuralBlockers.push('one_or_more_activity_source_evidence_records_missing_disposition');
  if (unexpectedKeys.length) structuralBlockers.push('unexpected_activity_subject_disposition_record');
  if (identityContextMismatches.length) structuralBlockers.push('one_or_more_source_identity_revision_hash_or_context_values_changed');
  if (compiled.pageSpecificPolicyPaths.length) structuralBlockers.push('page_specific_subject_disposition_policy_forbidden');
  if (invalidStates.length || resolvedWithoutOneDisposition.length || conflictWithoutDistinctSignals.length || unexpectedSignalKinds.length) structuralBlockers.push('one_or_more_subject_disposition_rules_invalid');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_canonical_repeatability_member_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_subject_dispositions');
  const dispositionAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (conflicts.length) blockers.push('one_or_more_explicit_source_subject_dispositions_conflict');
  if (unresolved.length) blockers.push('one_or_more_activity_subject_dispositions_unresolved');
  if (unmappedInfoboxTypes.length) blockers.push('one_or_more_infobox_type_values_unmapped');
  blockers.push('canonical_game_entity_and_activity_identities_not_established', 'repeatability_and_member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established');
  return {
    contract: 'sensum.activity-candidate-subject-disposition-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedEvidenceRecordCount: expectedKeys.length,
      dispositionRecordCount: records.length,
      duplicateInputCandidateKeys: duplicateInputKeys,
      duplicateOutputCandidateKeys: duplicateOutputKeys,
      missingCandidateKeys: missingKeys,
      unexpectedCandidateKeys: unexpectedKeys,
      identityRevisionHashOrContextMismatchCandidateKeys: identityContextMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !identityContextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policy,
      infoboxTypeRuleCount: compiled.infoboxTypeDispositions.size,
      leadDeclarationRuleCount: compiled.leadDeclarationRules.length,
      pageSpecificPolicyPaths: compiled.pageSpecificPolicyPaths,
      observedInfoboxTypeValues: Object.fromEntries(sorted(unique(records.map(record => record.infoboxTypeAssessment?.normalizedValue).filter(Boolean))).map(value => [value, records.filter(record => record.infoboxTypeAssessment?.normalizedValue === value).length])),
      missingInfoboxTypeParameterCount: records.filter(record => record.infoboxTypeAssessment?.present === false).length,
      unmappedInfoboxTypeValues: sorted(unique(unmappedInfoboxTypes.map(record => record.infoboxTypeAssessment.normalizedValue))),
      unmappedInfoboxTypeCandidateKeys: unmappedInfoboxTypes.map(record => record.candidateKey),
      unexpectedSignalKinds
    },
    dispositionCoverage: {
      sourceSupportedCount: resolved.length,
      conflictingCount: conflicts.length,
      unresolvedCount: unresolved.length,
      dispositionCounts,
      conflictPairCounts: conflictPairs,
      conflictingCandidateKeys: conflicts.map(record => record.candidateKey),
      unresolvedCandidateKeys: unresolved.map(record => record.candidateKey),
      invalidStateCandidateKeys: invalidStates,
      resolvedWithoutExactlyOneSupportedDispositionCandidateKeys: resolvedWithoutOneDisposition,
      conflictsWithoutDistinctSupportedSignalsCandidateKeys: conflictWithoutDistinctSignals
    },
    semanticPromotionCoverage: {
      subjectDispositionAttemptedCount: records.length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    dispositionAttemptCoverageComplete,
    subjectDispositionComplete: dispositionAttemptCoverageComplete && conflicts.length === 0 && unresolved.length === 0 && unmappedInfoboxTypes.length === 0,
    repeatabilityReviewComplete: false,
    memberExpansionReviewComplete: false,
    requirementsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: dispositionAttemptCoverageComplete
  };
}
