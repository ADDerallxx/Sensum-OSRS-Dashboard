import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = page => page?.revisions?.[0]?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;
const allowedSignalKinds = new Set([
  'explicit_positive_repeatability_declaration_candidate',
  'explicit_negative_repeatability_declaration_candidate',
  'recurrence_structure_candidate',
  'session_boundary_candidate'
]);
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceCanonicalActivityIdentityDispositionContentHash',
  'repeatabilityEvidence', 'repeatabilityCandidateObservations',
  'repeatabilityReview', 'memberExpansionReview', 'mechanicsReview',
  'optimizerEligible', 'accountIndependent'
]);

function preservedInput(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !stageFields.has(key)));
}

export function maskRepeatabilityIgnoredRegions(text = '') {
  return String(text).replace(
    /<!--[\s\S]*?-->|<(nowiki|pre|syntaxhighlight|source|code)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    match => match.replace(/[^\r\n]/g, ' ')
  );
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === '\n') starts.push(index + 1);
  return starts;
}

function lineNumberAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= offset) low = middle + 1;
    else high = middle - 1;
  }
  return high + 1;
}

function sourceLocation(text, starts, index, length, lineOffset = 0) {
  const startLine = lineNumberAt(starts, index);
  const endLine = lineNumberAt(starts, Math.max(index, index + length - 1));
  return {
    lineStart: startLine + lineOffset,
    lineEnd: endLine + lineOffset,
    columnStart: index - starts[startLine - 1] + 1,
    columnEnd: index + length - starts[endLine - 1]
  };
}

function contextText(text, locator, lineOffset = 0) {
  const lines = String(text).split(/\r?\n/);
  const start = Math.max(0, locator.lineStart - lineOffset - 1);
  const end = Math.max(start, locator.lineEnd - lineOffset);
  return lines.slice(start, end).join('\n');
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|collectionClass|collectionClasses|membershipClassification|membershipClassifications|collectionDisplayLabel|collectionDisplayLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileRepeatabilityEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'onePacketPerSupportedCanonicalActivityIdentity',
    'linkedSourceIsFetchedAtTheExactRetainedRevision',
    'pageTitleTimestampUrlAndContentHashMustAlign',
    'completeLinkedSourceAndExactCollectionRowAreScanned',
    'commentsAndProtectedRegionsCannotCreateSignals',
    'everySignalRetainsExactSourceScopeLocationTextRevisionAndHash',
    'lexicalSignalsAreReviewCandidatesOnly',
    'absenceOfALexicalSignalIsNotEvidenceOfNonRepeatability',
    'recurrenceAndSessionSignalsAreNotExplicitRepeatabilityProof',
    'positiveAndNegativeSignalsAreRetainedTogetherAsConflictCandidates',
    'repeatabilityVerdictRemainsNull',
    'repeatabilityReviewMembersMechanicsAndOptimizerEligibilityRemainClosed',
    'missingContradictoryOrConditionMismatchedEvidenceRemainsExplicit',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  const definitions = policy.sourceScan?.signalDefinitions || [];
  const keys = definitions.map(definition => definition.definitionKey);
  const duplicateDefinitionKeys = duplicates(keys);
  const invalidDefinitionKeys = [];
  const compiledDefinitions = [];
  for (const definition of definitions) {
    let expression = null;
    try {
      expression = new RegExp(definition.pattern, `${policy.sourceScan?.caseInsensitive === false ? '' : 'i'}${policy.sourceScan?.unicode === false ? '' : 'u'}g`);
    } catch {
      // Reported below as an invalid definition.
    }
    if (!definition.definitionKey || !allowedSignalKinds.has(definition.signalKind) || !definition.pattern || !expression || expression.test('')) {
      invalidDefinitionKeys.push(definition.definitionKey || '(missing)');
      continue;
    }
    expression.lastIndex = 0;
    compiledDefinitions.push({ ...definition, expression });
  }
  return {
    policyId: policy.policy || null,
    invalidRules,
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    duplicateDefinitionKeys,
    invalidDefinitionKeys: unique(invalidDefinitionKeys),
    definitions: compiledDefinitions,
    requiredDefinitionKindsMissing: [...allowedSignalKinds].filter(kind => !definitions.some(definition => definition.signalKind === kind))
  };
}

export function scanRepeatabilitySource({ text, sourceScope, sourcePageId, sourceRevision, sourceContentHash, scannedTextHash, lineOffset = 0, memberCandidateKey, definitions }) {
  const original = String(text || '');
  const masked = maskRepeatabilityIgnoredRegions(original);
  const starts = lineStarts(masked);
  const signals = [];
  for (const definition of definitions) {
    definition.expression.lastIndex = 0;
    for (const match of masked.matchAll(definition.expression)) {
      const locator = sourceLocation(masked, starts, match.index, match[0].length, lineOffset);
      const ordinal = signals.filter(signal => signal.definitionKey === definition.definitionKey).length + 1;
      signals.push({
        evidenceKey: `${memberCandidateKey}:repeatability:${sourceScope}:${definition.definitionKey}:${ordinal}`,
        definitionKey: definition.definitionKey,
        signalKind: definition.signalKind,
        sourceScope,
        sourcePageId,
        sourceRevision: String(sourceRevision || ''),
        sourceContentHash,
        scannedTextHash,
        matchedText: original.slice(match.index, match.index + match[0].length),
        contextText: contextText(original, locator, lineOffset),
        sourceLocator: locator,
        reviewState: 'candidate_only_not_a_repeatability_verdict'
      });
    }
  }
  return signals;
}

function fetchedRevisionMap(fetchedPages = []) {
  return new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
}

function sourceAlignment(input, fetched, contentHash) {
  const page = fetched?.page || null;
  const revision = fetched?.revision || null;
  const content = sourceContent(page);
  const computedHash = typeof content === 'string' ? contentHash(content) : null;
  const evidenceBoundary = input.canonicalActivityIdentity?.evidenceRevisionBoundary || {};
  const collectionSource = input.canonicalActivityIdentityEvidence?.collectionDefinition?.collectionSource || {};
  return {
    inputContractMatchesPolicy: true,
    canonicalActivityIdentityReviewIsSourceSupported: input.canonicalActivityIdentityReview?.state === 'reviewed_source_supported',
    canonicalActivityIdentityPresent: Boolean(input.canonicalActivityIdentity?.canonicalActivityKey),
    linkedSubjectRemainsDistinctFromCanonicalActivity: input.canonicalActivityIdentity?.linkedSubjectIsCanonicalActivity === false,
    fetchedPageIdMatchesInput: Boolean(page && Number(page.pageid) === Number(input.sourcePageId)),
    fetchedTitleMatchesInput: Boolean(page && page.title === input.resolvedTitle),
    fetchedRevisionMatchesInput: Boolean(revision && String(revision.revid) === String(input.sourceRevision || '')),
    fetchedTimestampMatchesInput: Boolean(revision && revision.timestamp === input.sourceTimestamp),
    fetchedUrlMatchesInput: Boolean(page?.title && wikiUrl(page.title) === input.sourceUrl),
    fetchedContentHashMatchesInput: Boolean(computedHash && computedHash === input.sourceContentHash),
    identityBoundaryMatchesLinkedRevision: String(evidenceBoundary.linkedSourceRevision || '') === String(input.sourceRevision || ''),
    identityBoundaryMatchesCollectionRevision: String(evidenceBoundary.collectionRevision || '') === String(collectionSource.revision || '')
  };
}

function packetFor(input, fetched, policy, contentHash) {
  const compiled = compileRepeatabilityEvidencePolicy(policy);
  const page = fetched?.page || null;
  const revision = fetched?.revision || null;
  const linkedContent = sourceContent(page);
  const collectionDefinition = input.canonicalActivityIdentityEvidence?.collectionDefinition || {};
  const collectionSource = collectionDefinition.collectionSource || {};
  const row = collectionDefinition.rowEvidence || {};
  const rowText = typeof row.rawText === 'string' ? row.rawText : null;
  const alignment = sourceAlignment(input, fetched, contentHash);
  alignment.inputContractMatchesPolicy = input.contract === policy.inputContract;
  const deficiencies = [];
  if (!input.contentHash) deficiencies.push('canonical_activity_identity_disposition_content_hash_missing');
  if (!Object.values(alignment).every(Boolean)) deficiencies.push('canonical_activity_identity_or_exact_linked_source_alignment_failed');
  if (typeof linkedContent !== 'string') deficiencies.push('exact_linked_source_revision_content_missing');
  if (!collectionSource.pageId || !collectionSource.revision || !collectionSource.contentHash || !row.sourceLocator || !rowText) deficiencies.push('exact_collection_row_source_missing');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.duplicateDefinitionKeys.length || compiled.invalidDefinitionKeys.length || compiled.requiredDefinitionKindsMissing.length) deficiencies.push('repeatability_evidence_policy_invalid_or_incomplete');
  const linkedTextHash = typeof linkedContent === 'string' ? contentHash(linkedContent) : null;
  const rowTextHash = rowText ? contentHash(rowText) : null;
  const linkedSignals = typeof linkedContent === 'string' ? scanRepeatabilitySource({
    text: linkedContent,
    sourceScope: 'complete_linked_source_revision',
    sourcePageId: input.sourcePageId,
    sourceRevision: input.sourceRevision,
    sourceContentHash: input.sourceContentHash,
    scannedTextHash: linkedTextHash,
    memberCandidateKey: input.memberCandidateKey,
    definitions: compiled.definitions
  }) : [];
  const rowSignals = rowText ? scanRepeatabilitySource({
    text: rowText,
    sourceScope: 'exact_collection_row',
    sourcePageId: collectionSource.pageId,
    sourceRevision: collectionSource.revision,
    sourceContentHash: collectionSource.contentHash,
    scannedTextHash: rowTextHash,
    lineOffset: Number(row.sourceLocator.lineStart || 1) - 1,
    memberCandidateKey: input.memberCandidateKey,
    definitions: compiled.definitions
  }) : [];
  const signals = [...linkedSignals, ...rowSignals];
  const count = kind => signals.filter(signal => signal.signalKind === kind).length;
  const positive = count('explicit_positive_repeatability_declaration_candidate');
  const negative = count('explicit_negative_repeatability_declaration_candidate');
  return {
    evidence: {
      canonicalActivityIdentity: input.canonicalActivityIdentity || null,
      sourceAlignment: alignment,
      linkedSourceScan: {
        sourcePageId: input.sourcePageId,
        resolvedTitle: input.resolvedTitle,
        sourceRevision: String(input.sourceRevision || ''),
        sourceTimestamp: input.sourceTimestamp || null,
        sourceUrl: input.sourceUrl || null,
        sourceContentHash: input.sourceContentHash || null,
        fetchedContentHash: linkedTextHash,
        sourceContentBytes: typeof linkedContent === 'string' ? Buffer.byteLength(linkedContent, 'utf8') : null,
        scannedLineCount: typeof linkedContent === 'string' ? linkedContent.split(/\r?\n/).length : 0,
        completeRevisionContentScanned: typeof linkedContent === 'string' && Object.values(alignment).every(Boolean),
        commentsAndProtectedRegionsMasked: policy.sourceScan?.maskCommentsAndProtectedRegions === true
      },
      collectionRowScan: {
        sourcePageId: collectionSource.pageId ?? null,
        resolvedTitle: collectionSource.title || null,
        sourceRevision: String(collectionSource.revision || ''),
        sourceTimestamp: collectionSource.timestamp || null,
        sourceUrl: collectionSource.url || null,
        sourceContentHash: collectionSource.contentHash || null,
        rowTextHash,
        rowSourceLocator: row.sourceLocator || null,
        sourceRowOrdinal: row.sourceRowOrdinal ?? null,
        sourceContentBytes: rowText ? Buffer.byteLength(rowText, 'utf8') : null,
        scannedLineCount: rowText ? rowText.split(/\r?\n/).length : 0,
        exactRetainedRowScanned: Boolean(rowText && row.sourceLocator && collectionSource.contentHash),
        commentsAndProtectedRegionsMasked: policy.sourceScan?.maskCommentsAndProtectedRegions === true
      },
      sourceLocatedSignals: signals,
      evidenceState: deficiencies.length ? 'repeatability_evidence_packet_incomplete' : 'complete_revision_pinned_repeatability_review_packet'
    },
    observations: {
      explicitPositiveDeclarationCandidateCount: positive,
      explicitNegativeDeclarationCandidateCount: negative,
      recurrenceStructureCandidateCount: count('recurrence_structure_candidate'),
      sessionBoundaryCandidateCount: count('session_boundary_candidate'),
      positiveNegativeConflictCandidate: positive > 0 && negative > 0,
      noLexicalSignalObserved: signals.length === 0,
      absenceSemantics: 'no_lexical_signal_does_not_establish_non_repeatability',
      deficiencies,
      repeatabilityVerdict: null,
      observationState: 'source_located_candidates_only_repeatability_unreviewed'
    }
  };
}

function expectedRecord(input, fetched, policy, contentHash) {
  const packet = packetFor(input, fetched, policy, contentHash);
  const blockers = [...packet.observations.deficiencies];
  blockers.push(
    'repeatability_disposition_pending',
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'optimizer_eligibility_blocked'
  );
  return {
    contract: policy.recordContract || 'sensum.activity-reference-collection-member-repeatability-evidence.v1',
    ...preservedInput(input),
    sourceCanonicalActivityIdentityDispositionContentHash: input.contentHash,
    repeatabilityEvidence: packet.evidence,
    repeatabilityCandidateObservations: packet.observations,
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: unique(blockers),
    state: packet.observations.deficiencies.length ? 'repeatability_evidence_packet_blocked' : 'repeatability_evidence_packet_complete_review_unperformed'
  };
}

export function buildActivityReferenceCollectionMemberRepeatabilityEvidence({ identityDispositionRecords = [], fetchedPages = [], policy = {}, contentHash = value => value }) {
  const fetched = fetchedRevisionMap(fetchedPages);
  const records = identityDispositionRecords.map(input => expectedRecord(input, fetched.get(String(input.sourceRevision || '')), policy, contentHash));
  return { records, audit: auditActivityReferenceCollectionMemberRepeatabilityEvidence(records, { identityDispositionRecords, fetchedPages, policy, contentHash }) };
}

export function auditActivityReferenceCollectionMemberRepeatabilityEvidence(records = [], { identityDispositionRecords = [], fetchedPages = [], policy = {}, contentHash = value => value } = {}) {
  const compiled = compileRepeatabilityEvidencePolicy(policy);
  const expectedKeys = identityDispositionRecords.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(identityDispositionRecords.map(record => [record.memberCandidateKey, record]));
  const outputByKey = new Map(records.map(record => [record.memberCandidateKey, record]));
  const fetched = fetchedRevisionMap(fetchedPages);
  const fetchedRevisionIds = fetchedPages.flatMap(page => (page.revisions || []).map(revision => String(revision.revid || ''))).filter(Boolean);
  const expectedRevisionIds = sorted(unique(identityDispositionRecords.map(record => String(record.sourceRevision || '')).filter(Boolean)));
  const duplicateFetchedRevisions = duplicates(fetchedRevisionIds);
  const missingFetchedRevisions = expectedRevisionIds.filter(revision => !fetchedRevisionIds.includes(revision));
  const unexpectedFetchedRevisions = fetchedRevisionIds.filter(revision => !expectedRevisionIds.includes(revision));
  const contextMismatches = expectedKeys.filter(key => {
    const input = inputByKey.get(key);
    const output = outputByKey.get(key);
    return !output || output.sourceCanonicalActivityIdentityDispositionContentHash !== input.contentHash || JSON.stringify(preservedInput(input)) !== JSON.stringify(preservedInput(output));
  });
  const structurallyInvalidInputs = identityDispositionRecords.filter(record =>
    record.contract !== policy.inputContract || !record.contentHash || record.accountIndependent !== true
    || record.canonicalActivityIdentityReview?.state !== 'reviewed_source_supported'
    || !record.canonicalActivityIdentity?.canonicalActivityKey
    || record.canonicalActivityIdentity?.linkedSubjectIsCanonicalActivity !== false
    || record.repeatabilityReview?.state !== 'unreviewed' || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const invalidPackets = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    if (!input) return true;
    const expected = expectedRecord(input, fetched.get(String(input.sourceRevision || '')), policy, contentHash);
    return record.contract !== expected.contract
      || JSON.stringify(record.repeatabilityEvidence) !== JSON.stringify(expected.repeatabilityEvidence)
      || JSON.stringify(record.repeatabilityCandidateObservations) !== JSON.stringify(expected.repeatabilityCandidateObservations);
  }).map(record => record.memberCandidateKey);
  const incompletePackets = records.filter(record => record.repeatabilityCandidateObservations?.deficiencies?.length).map(record => record.memberCandidateKey);
  const alignmentFailures = records.filter(record => !Object.values(record.repeatabilityEvidence?.sourceAlignment || {}).every(Boolean)).map(record => record.memberCandidateKey);
  const incompleteScans = records.filter(record => record.repeatabilityEvidence?.linkedSourceScan?.completeRevisionContentScanned !== true || record.repeatabilityEvidence?.collectionRowScan?.exactRetainedRowScanned !== true).map(record => record.memberCandidateKey);
  const invalidSignals = records.filter(record => (record.repeatabilityEvidence?.sourceLocatedSignals || []).some(signal =>
    !signal.evidenceKey || !signal.definitionKey || !allowedSignalKinds.has(signal.signalKind)
    || !['complete_linked_source_revision', 'exact_collection_row'].includes(signal.sourceScope)
    || !signal.sourcePageId || !signal.sourceRevision || !signal.sourceContentHash || !signal.scannedTextHash
    || !signal.matchedText || !signal.contextText || !signal.sourceLocator?.lineStart
    || signal.reviewState !== 'candidate_only_not_a_repeatability_verdict'
  )).map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record =>
    record.repeatabilityCandidateObservations?.repeatabilityVerdict !== null
    || record.repeatabilityReview?.state !== 'unreviewed'
    || record.memberExpansionReview?.state !== 'unreviewed'
    || record.mechanicsReview?.state !== 'unreviewed'
    || record.optimizerEligible !== false
  ).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_supported_canonical_activity_identities');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_repeatability_evidence_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_hash_identity_revision_evidence_or_context_fields_changed');
  if (structurallyInvalidInputs.length) structuralBlockers.push('one_or_more_input_canonical_activity_identities_failed_structural_integrity');
  if (duplicateFetchedRevisions.length || missingFetchedRevisions.length || unexpectedFetchedRevisions.length) structuralBlockers.push('exact_linked_source_revision_fetch_set_incomplete');
  if (alignmentFailures.length) structuralBlockers.push('one_or_more_linked_sources_failed_page_title_revision_timestamp_url_or_hash_alignment');
  if (compiled.invalidRules.length || compiled.duplicateDefinitionKeys.length || compiled.invalidDefinitionKeys.length || compiled.requiredDefinitionKindsMissing.length) structuralBlockers.push('repeatability_evidence_policy_missing_valid_required_generic_rules');
  if (compiled.forbiddenPolicyPaths.length) structuralBlockers.push('page_specific_or_collection_specific_repeatability_evidence_policy_forbidden');
  if (invalidPackets.length || incompleteScans.length || invalidSignals.length) structuralBlockers.push('one_or_more_repeatability_evidence_packets_or_signals_do_not_match_exact_revision_sources');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_repeatability_evidence');
  const evidencePacketAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const repeatabilityEvidencePacketCoverageComplete = evidencePacketAttemptCoverageComplete && incompletePackets.length === 0;
  const allSignals = records.flatMap(record => record.repeatabilityEvidence?.sourceLocatedSignals || []);
  const count = kind => allSignals.filter(signal => signal.signalKind === kind).length;
  const blockers = [...structuralBlockers];
  if (incompletePackets.length) blockers.push('one_or_more_repeatability_evidence_packets_incomplete');
  blockers.push(
    'repeatability_disposition_pending',
    'member_expansion_not_reviewed',
    'requirements_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: policy.auditContract || 'sensum.activity-reference-collection-member-repeatability-evidence-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedCanonicalActivityIdentityCount: expectedKeys.length,
      repeatabilityEvidencePacketCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      structurallyInvalidInputMemberCandidateKeys: structurallyInvalidInputs,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    sourceAlignment: {
      expectedExactRevisionCount: expectedRevisionIds.length,
      fetchedExactRevisionCount: fetchedRevisionIds.length,
      duplicateFetchedRevisionIds: duplicateFetchedRevisions,
      missingFetchedRevisionIds: missingFetchedRevisions,
      unexpectedFetchedRevisionIds: unexpectedFetchedRevisions,
      alignedPacketCount: records.length - unique(alignmentFailures).length,
      alignmentFailureMemberCandidateKeys: unique(alignmentFailures)
    },
    policyCoverage: {
      policy: compiled.policyId,
      signalDefinitionCount: compiled.definitions.length,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      duplicateDefinitionKeys: compiled.duplicateDefinitionKeys,
      invalidDefinitionKeys: compiled.invalidDefinitionKeys,
      requiredDefinitionKindsMissing: compiled.requiredDefinitionKindsMissing
    },
    repeatabilityEvidenceCoverage: {
      completePacketCount: records.length - incompletePackets.length,
      incompletePacketCount: incompletePackets.length,
      incompleteMemberCandidateKeys: incompletePackets,
      completeLinkedSourceScanCount: records.filter(record => record.repeatabilityEvidence?.linkedSourceScan?.completeRevisionContentScanned === true).length,
      exactCollectionRowScanCount: records.filter(record => record.repeatabilityEvidence?.collectionRowScan?.exactRetainedRowScanned === true).length,
      linkedSourceBytesScanned: records.reduce((sum, record) => sum + Number(record.repeatabilityEvidence?.linkedSourceScan?.sourceContentBytes || 0), 0),
      collectionRowBytesScanned: records.reduce((sum, record) => sum + Number(record.repeatabilityEvidence?.collectionRowScan?.sourceContentBytes || 0), 0),
      sourceLocatedSignalCount: allSignals.length,
      invalidPacketMemberCandidateKeys: invalidPackets,
      incompleteScanMemberCandidateKeys: incompleteScans,
      invalidSignalMemberCandidateKeys: invalidSignals
    },
    candidateObservationCoverage: {
      explicitPositiveDeclarationCandidateCount: count('explicit_positive_repeatability_declaration_candidate'),
      explicitNegativeDeclarationCandidateCount: count('explicit_negative_repeatability_declaration_candidate'),
      recurrenceStructureCandidateCount: count('recurrence_structure_candidate'),
      sessionBoundaryCandidateCount: count('session_boundary_candidate'),
      positiveNegativeConflictCandidateCount: records.filter(record => record.repeatabilityCandidateObservations?.positiveNegativeConflictCandidate === true).length,
      zeroSignalPacketCount: records.filter(record => record.repeatabilityCandidateObservations?.noLexicalSignalObserved === true).length,
      repeatabilityVerdictCount: records.filter(record => record.repeatabilityCandidateObservations?.repeatabilityVerdict !== null).length
    },
    semanticPromotionCoverage: {
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    evidencePacketAttemptCoverageComplete,
    repeatabilityEvidencePacketCoverageComplete,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: repeatabilityEvidencePacketCoverageComplete
  };
}
