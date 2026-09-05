import { maskRepeatabilityIgnoredRegions } from './activity-reference-collection-member-repeatability-evidence-lib.mjs';
import { parseSkillTrainingGuideDirectLinks } from './skill-training-guide-direct-link-lib.mjs';
import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = revision => revision?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceCanonicalActivitySubjectDeclarationDiscoveryContentHash',
  'canonicalActivitySubjectDeclarationExactLineEvidence',
  'canonicalActivitySubjectDeclarationExactLineObservations',
  'canonicalActivitySubjectDeclarationReview'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|resolvedTitle|resolvedTitles|title|titles|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|canonicalLabel|canonicalLabels|label|labels|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileCanonicalActivitySubjectDeclarationExactLineEvidencePolicy(policy = {}) {
  const required = [
    'onePacketPerCompleteSubjectDeclarationDiscoveryRecord',
    'everyCandidateSourceRevisionIsFetchedExactlyOnce',
    'fetchedPageIdTitleRevisionTimestampUrlAndContentHashMustAlign',
    'searchPhraseMustMatchTheRevisionBoundCanonicalActivityLabel',
    'everyRawExactPhraseOccurrenceIsRetainedWithExactLinesColumnsTextAndHash',
    'commentsAndProtectedRegionsRemainVisibleButCannotBecomeActiveEvidence',
    'activeAndProtectedOccurrenceSetsMustBeCompleteAndDisjoint',
    'sourceAuthoredLinksOnExactOccurrenceLinesAreStructuralObservationsOnly',
    'absenceOfAnExactPhraseAfterRevisionFetchBlocksPublication',
    'exactPhraseOccurrenceDoesNotEstablishSemanticSubjectScopeOrRepeatability',
    'titlesLabelsLinksTemplatesHeadingsTablesAndLexicalProximityCannotSelectAVerdict',
    'upstreamEvidenceIdentitiesDispositionsAndReviewsRemainUnchanged',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'missingContradictoryTruncatedOrConditionMismatchedEvidenceRemainsExplicit',
    'activitySpecificNamesTitlesPageIdsLabelsAliasesAndOverridesCannotSelectAVerdict',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = required.filter(rule => policy.rules?.[rule] !== true);
  if (policy.evidenceChannel !== 'complete_exact_revision_source_phrase_occurrence_inventory') invalidRules.push('exact_line_evidence_channel_not_configured');
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract || !policy.inputState) invalidRules.push('exact_line_evidence_contract_boundary_missing');
  return { policyId: policy.policy || null, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbiddenPolicyPaths(policy) };
}

function routeMatches(record, policy) {
  const discovery = record.canonicalActivitySubjectDeclarationDiscovery || {};
  const review = record.canonicalActivitySubjectDeclarationReview || {};
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && discovery.evidenceState === 'complete_revision_pinned_canonical_activity_subject_declaration_discovery_packet'
    && discovery.canonicalActivitySubjectDeclarationVerdict === null
    && discovery.canonicalActivityScopeVerdict === null
    && discovery.repeatabilityVerdict === null
    && review.state === 'unreviewed_exact_declaration_extraction_required'
    && review.canonicalActivitySubjectDeclarationVerdict === null
    && review.canonicalActivityScopeVerdict === null
    && review.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true;
}

export function selectCanonicalActivitySubjectDeclarationExactLineEvidenceRoutes(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

export function exactPhraseFromSearch(record = {}) {
  const query = String(record.canonicalActivitySubjectDeclarationDiscovery?.exactSourcePhraseSearch?.query || '');
  const match = /^insource:"((?:\\.|[^"\\])*)"$/u.exec(query);
  if (!match) return null;
  return match[1].replace(/\\([\\"])/g, '$1');
}

function candidateSources(record = {}) {
  return record.canonicalActivitySubjectDeclarationDiscovery?.candidateSources || [];
}

function candidatePairKey(record, candidate) {
  const revision = candidate?.revisionEvidence || {};
  return `${record.memberCandidateKey}|${Number(revision.sourcePageId || 0)}|${String(revision.sourceRevision || '')}`;
}

export function discoverCanonicalActivitySubjectDeclarationExactRevisionRequests(records = [], policy = {}) {
  const requests = new Map();
  for (const record of selectCanonicalActivitySubjectDeclarationExactLineEvidenceRoutes(records, policy)) {
    const phrase = exactPhraseFromSearch(record);
    for (const candidate of candidateSources(record)) {
      const source = candidate.revisionEvidence || {};
      if (!source.sourceRevision) continue;
      const key = String(source.sourceRevision);
      const current = requests.get(key) || {
        sourceRevision: key,
        sourcePageId: Number(source.sourcePageId || 0) || null,
        resolvedTitle: source.resolvedTitle || null,
        sourceTimestamp: source.sourceTimestamp || null,
        sourceUrl: source.sourceUrl || null,
        sourceContentHash: source.sourceContentHash || null,
        candidateContexts: []
      };
      current.candidateContexts.push({
        memberCandidateKey: record.memberCandidateKey,
        canonicalActivityKey: record.canonicalActivityIdentity?.canonicalActivityKey || null,
        exactPhrase: phrase,
        candidatePairKey: candidatePairKey(record, candidate)
      });
      current.candidateContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      requests.set(key, current);
    }
  }
  return [...requests.values()].sort((a, b) => Number(a.sourcePageId) - Number(b.sourcePageId) || a.sourceRevision.localeCompare(b.sourceRevision));
}

function fetchedByRevision(fetchedPages = []) {
  return new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
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

function sourceLocator(text, starts, index, length) {
  const lineStart = lineNumberAt(starts, index);
  const lineEnd = lineNumberAt(starts, Math.max(index, index + length - 1));
  return {
    absoluteOffsetStart: index,
    absoluteOffsetEnd: index + length - 1,
    lineStart,
    lineEnd,
    columnStart: index - starts[lineStart - 1] + 1,
    columnEnd: index + length - starts[lineEnd - 1]
  };
}

function exactLines(text, locator) {
  const lines = String(text).split(/\r?\n/);
  return lines.slice(locator.lineStart - 1, locator.lineEnd).join('\n');
}

function phraseOccurrences({ content, phrase, source, contentHash, occurrenceKeyPrefix }) {
  if (typeof content !== 'string' || !phrase) return { occurrences: [], directLinkAudit: null };
  const masked = maskRepeatabilityIgnoredRegions(content);
  const starts = lineStarts(content);
  const expression = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const parsedLinks = parseSkillTrainingGuideDirectLinks({
    content,
    sourcePageId: source.sourcePageId,
    title: source.resolvedTitle,
    sourceRevision: source.sourceRevision,
    sourceTimestamp: source.sourceTimestamp,
    sourceUrl: source.sourceUrl,
    sourceContentHash: source.sourceContentHash,
    skillKeys: [],
    channels: ['canonical_activity_subject_declaration_exact_line_evidence']
  });
  const occurrences = [];
  for (const match of content.matchAll(expression)) {
    const locator = sourceLocator(content, starts, match.index, match[0].length);
    const rawLines = exactLines(content, locator);
    const maskedMatch = masked.slice(match.index, match.index + match[0].length);
    const fullyActive = maskedMatch.toLocaleLowerCase('en') === match[0].toLocaleLowerCase('en');
    const fullyMasked = maskedMatch.replace(/[\r\n ]/g, '') === '';
    const sourceRegionState = fullyActive ? 'active_source_text' : fullyMasked ? 'protected_or_ignored_source_region' : 'mixed_active_and_protected_source_region';
    const linksOnLines = parsedLinks.occurrences.filter(link => {
      const line = Number(link.sourceLocator?.line || 0);
      return line >= locator.lineStart && line <= locator.lineEnd;
    }).map(link => link.occurrenceKey).filter(Boolean).sort();
    const trimmed = rawLines.trim();
    const occurrenceKey = `${occurrenceKeyPrefix}:${locator.absoluteOffsetStart}:${match[0].length}`;
    occurrences.push({
      occurrenceKey,
      matchedText: match[0],
      canonicalActivityLabelExactCaseMatch: match[0] === phrase,
      sourceRegionState,
      sourceLocator: locator,
      exactSourceLines: rawLines,
      exactSourceLinesContentHash: contentHash(rawLines),
      structuralObservations: {
        lineStartsWithHeadingMarkup: /^={1,6}[^=]/u.test(trimmed),
        lineStartsWithTableMarkup: /^[|!]/u.test(trimmed),
        lineStartsWithTemplateMarkup: /^\{\{/u.test(trimmed),
        sourceAuthoredLinkOccurrenceKeysOnExactLines: linksOnLines
      },
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      semanticUse: fullyActive
        ? 'active_exact_phrase_occurrence_requires_semantic_subject_and_scope_review'
        : 'protected_or_mixed_occurrence_retained_but_cannot_support_semantic_binding'
    });
  }
  return { occurrences, directLinkAudit: parsedLinks.audit };
}

function candidatePacket(record, candidate, fetched, phrase, contentHash) {
  const source = candidate.revisionEvidence || {};
  const evidenceKey = candidatePairKey(record, candidate);
  const page = fetched?.page || null;
  const revision = fetched?.revision || null;
  const content = sourceContent(revision);
  const computedHash = typeof content === 'string' ? contentHash(content) : null;
  const verification = {
    fetchedPagePresent: Boolean(page),
    fetchedRevisionContentPresent: typeof content === 'string',
    fetchedPageIdMatchesCandidate: Boolean(page && Number(page.pageid) === Number(source.sourcePageId)),
    fetchedTitleMatchesCandidate: Boolean(page && page.title === source.resolvedTitle),
    fetchedRevisionMatchesCandidate: Boolean(revision && String(revision.revid) === String(source.sourceRevision || '')),
    fetchedTimestampMatchesCandidate: Boolean(revision && revision.timestamp === source.sourceTimestamp),
    fetchedUrlMatchesCandidate: Boolean(page?.title && wikiUrl(page.title) === source.sourceUrl),
    fetchedContentHashMatchesCandidate: Boolean(computedHash && computedHash === source.sourceContentHash),
    upstreamCompleteRevisionScanConfirmed: source.completeRevisionContentScanned === true
  };
  const extracted = phraseOccurrences({ content, phrase, source, contentHash, occurrenceKeyPrefix: evidenceKey });
  const occurrences = extracted.occurrences;
  const deficiencies = [];
  if (!Object.values(verification).every(Boolean)) deficiencies.push('candidate_exact_revision_page_title_timestamp_url_or_hash_alignment_failed');
  if (!phrase) deficiencies.push('canonical_activity_exact_search_phrase_missing');
  if (!occurrences.length) deficiencies.push('exact_canonical_activity_phrase_absent_from_fetched_candidate_revision');
  if (extracted.directLinkAudit && extracted.directLinkAudit.balancedSourceLinkDelimiters !== true) deficiencies.push('candidate_source_wikilink_delimiters_unbalanced');
  return {
    candidateEvidenceKey: evidenceKey,
    discoveryCandidate: candidate,
    sourceRevisionVerification: verification,
    exactPhrase: phrase,
    matchMode: 'unicode_case_insensitive_literal_phrase',
    rawOccurrenceCount: occurrences.length,
    activeSourceOccurrenceCount: occurrences.filter(item => item.sourceRegionState === 'active_source_text').length,
    protectedOrMixedOccurrenceCount: occurrences.filter(item => item.sourceRegionState !== 'active_source_text').length,
    exactPhraseOccurrences: occurrences,
    sourceLinkDelimiterAudit: extracted.directLinkAudit,
    canonicalActivitySubjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    deficiencies,
    state: deficiencies.length ? 'blocked_incomplete_exact_line_candidate_evidence' : 'complete_revision_pinned_exact_phrase_occurrence_inventory'
  };
}

function expectedRecord(input, fetchedPages, policy, contentHash) {
  const compiled = compileCanonicalActivitySubjectDeclarationExactLineEvidencePolicy(policy);
  const fetched = fetchedByRevision(fetchedPages);
  const phrase = exactPhraseFromSearch(input);
  const canonicalLabel = input.canonicalActivityIdentity?.canonicalLabel || null;
  const candidates = candidateSources(input).map(candidate => candidatePacket(
    input,
    candidate,
    fetched.get(String(candidate.revisionEvidence?.sourceRevision || '')),
    phrase,
    contentHash
  ));
  const candidateKeys = candidates.map(candidate => candidate.candidateEvidenceKey);
  const deficiencies = [];
  if (!input.contentHash) deficiencies.push('subject_declaration_discovery_content_hash_missing');
  if (!routeMatches(input, policy)) deficiencies.push('input_does_not_match_complete_subject_declaration_discovery_state');
  if (!phrase || phrase !== canonicalLabel) deficiencies.push('exact_source_search_phrase_and_canonical_activity_label_mismatch');
  if (!candidates.length) deficiencies.push('subject_declaration_discovery_contains_no_candidate_sources');
  if (duplicates(candidateKeys).length) deficiencies.push('duplicate_candidate_evidence_pair');
  if (candidates.some(candidate => candidate.deficiencies.length)) deficiencies.push('one_or_more_exact_line_candidate_evidence_packets_incomplete');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) deficiencies.push('canonical_activity_subject_declaration_exact_line_evidence_policy_invalid_or_activity_specific');
  const occurrences = candidates.flatMap(candidate => candidate.exactPhraseOccurrences || []);
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceCanonicalActivitySubjectDeclarationDiscoveryContentHash: input.contentHash,
    canonicalActivitySubjectDeclarationExactLineEvidence: {
      evidenceState: deficiencies.length ? 'incomplete_revision_pinned_subject_declaration_exact_line_evidence_packet' : 'complete_revision_pinned_subject_declaration_exact_line_evidence_packet',
      evidenceChannel: policy.evidenceChannel,
      canonicalActivityKey: input.canonicalActivityIdentity?.canonicalActivityKey || null,
      exactPhrase: phrase,
      candidateEvidencePackets: candidates
    },
    canonicalActivitySubjectDeclarationExactLineObservations: {
      candidateSourceCount: candidates.length,
      exactRevisionAlignedCandidateCount: candidates.filter(candidate => Object.values(candidate.sourceRevisionVerification).every(Boolean)).length,
      rawOccurrenceCount: occurrences.length,
      activeSourceOccurrenceCount: occurrences.filter(item => item.sourceRegionState === 'active_source_text').length,
      protectedOrMixedOccurrenceCount: occurrences.filter(item => item.sourceRegionState !== 'active_source_text').length,
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      deficiencies
    },
    canonicalActivitySubjectDeclarationReview: {
      state: 'unreviewed_exact_line_evidence_collected_semantic_disposition_required',
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: []
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => blocker !== 'canonical_activity_subject_declaration_requires_exact_line_extraction_and_semantic_review'),
      ...deficiencies,
      'canonical_activity_subject_declaration_exact_line_evidence_requires_semantic_disposition',
      'canonical_activity_subject_binding_unresolved',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: deficiencies.length ? 'canonical_activity_subject_declaration_exact_line_evidence_blocked_incomplete' : 'canonical_activity_subject_declaration_exact_line_evidence_ready_for_semantic_disposition'
  };
}

export function buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords = [], fetchedPages = [], policy = {}, contentHash = value => value }) {
  const routes = selectCanonicalActivitySubjectDeclarationExactLineEvidenceRoutes(discoveryRecords, policy);
  const records = routes.map(record => expectedRecord(record, fetchedPages, policy, contentHash));
  return { records, audit: auditCanonicalActivitySubjectDeclarationExactLineEvidence(records, { discoveryRecords, fetchedPages, policy, contentHash }) };
}

export function auditCanonicalActivitySubjectDeclarationExactLineEvidence(records = [], { discoveryRecords = [], fetchedPages = [], policy = {}, contentHash = value => value } = {}) {
  const inputs = selectCanonicalActivitySubjectDeclarationExactLineEvidenceRoutes(discoveryRecords, policy);
  const expected = inputs.map(record => expectedRecord(record, fetchedPages, policy, contentHash));
  const expectedKeys = inputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputByKey = new Map(inputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || record.sourceCanonicalActivitySubjectDeclarationDiscoveryContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const evidenceMismatches = records.filter(record => {
    const target = expectedByKey.get(record.memberCandidateKey);
    return !target
      || JSON.stringify(record.canonicalActivitySubjectDeclarationExactLineEvidence) !== JSON.stringify(target.canonicalActivitySubjectDeclarationExactLineEvidence)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationExactLineObservations) !== JSON.stringify(target.canonicalActivitySubjectDeclarationExactLineObservations);
  }).map(record => record.memberCandidateKey);
  const inputPairs = inputs.flatMap(record => candidateSources(record).map(candidate => candidatePairKey(record, candidate)));
  const outputPackets = records.flatMap(record => record.canonicalActivitySubjectDeclarationExactLineEvidence?.candidateEvidencePackets || []);
  const outputPairs = outputPackets.map(packet => packet.candidateEvidenceKey);
  const missingPairs = inputPairs.filter(key => !outputPairs.includes(key));
  const unexpectedPairs = outputPairs.filter(key => !inputPairs.includes(key));
  const revisionRequests = discoverCanonicalActivitySubjectDeclarationExactRevisionRequests(inputs, policy);
  const expectedRevisionIds = revisionRequests.map(request => request.sourceRevision);
  const fetchedRows = fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({ page, revision })));
  const fetchedRevisionIds = fetchedRows.map(row => String(row.revision.revid || '')).filter(Boolean);
  const missingRevisionIds = expectedRevisionIds.filter(revision => !fetchedRevisionIds.includes(revision));
  const unexpectedRevisionIds = fetchedRevisionIds.filter(revision => !expectedRevisionIds.includes(revision));
  const duplicateFetchedRevisionIds = duplicates(fetchedRevisionIds);
  const occurrences = outputPackets.flatMap(packet => packet.exactPhraseOccurrences || []);
  const occurrenceKeys = occurrences.map(item => item.occurrenceKey);
  const incompleteRecords = records.filter(record => record.canonicalActivitySubjectDeclarationExactLineEvidence?.evidenceState !== 'complete_revision_pinned_subject_declaration_exact_line_evidence_packet').map(record => record.memberCandidateKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const packets = record.canonicalActivitySubjectDeclarationExactLineEvidence?.candidateEvidencePackets || [];
    return !input
      || record.canonicalActivitySubjectDeclarationExactLineObservations?.canonicalActivitySubjectDeclarationVerdict !== null
      || record.canonicalActivitySubjectDeclarationExactLineObservations?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationExactLineObservations?.repeatabilityVerdict !== null
      || packets.some(packet => packet.canonicalActivitySubjectDeclarationVerdict !== null || packet.canonicalActivityScopeVerdict !== null || packet.repeatabilityVerdict !== null
        || (packet.exactPhraseOccurrences || []).some(item => item.canonicalActivitySubjectDeclarationVerdict !== null || item.canonicalActivityScopeVerdict !== null || item.repeatabilityVerdict !== null))
      || record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const compiled = compileCanonicalActivitySubjectDeclarationExactLineEvidencePolicy(policy);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structural = [];
  if (!expectedKeys.length) structural.push('no_complete_subject_declaration_discovery_inputs');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structural.push('input_and_output_exact_line_evidence_record_sets_do_not_match_exactly');
  if (contextMismatches.length) structural.push('upstream_evidence_identity_disposition_or_review_changed');
  if (evidenceMismatches.length) structural.push('one_or_more_exact_line_evidence_packets_not_reproducible');
  if (missingPairs.length || unexpectedPairs.length || duplicates(inputPairs).length || duplicates(outputPairs).length) structural.push('candidate_evidence_pair_set_mismatch');
  if (missingRevisionIds.length || unexpectedRevisionIds.length || duplicateFetchedRevisionIds.length) structural.push('exact_candidate_revision_fetch_set_mismatch');
  if (duplicates(occurrenceKeys).length) structural.push('duplicate_exact_phrase_occurrence_keys');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) structural.push('canonical_activity_subject_declaration_exact_line_evidence_policy_invalid_or_activity_specific');
  if (incompleteRecords.length) structural.push('one_or_more_subject_declaration_exact_line_evidence_records_incomplete');
  if (unsupportedPromotions.length) structural.push('exact_line_evidence_created_unsupported_semantic_or_downstream_promotion');
  if (accountStateFindings.length) structural.push('account_query_state_baked_into_subject_declaration_exact_line_evidence');
  const attemptComplete = expectedKeys.length > 0 && inputPairs.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length
    && !missingPairs.length && !unexpectedPairs.length && !duplicates(inputPairs).length && !duplicates(outputPairs).length;
  const complete = attemptComplete && !structural.length;
  return {
    contract: policy.auditContract,
    accountIndependent: !accountStateFindings.length,
    inputCoverage: { expectedRecordCount: expectedKeys.length, outputRecordCount: records.length, duplicateInputMemberCandidateKeys: duplicateInputKeys, duplicateOutputMemberCandidateKeys: duplicateOutputKeys, missingMemberCandidateKeys: missingKeys, unexpectedMemberCandidateKeys: unexpectedKeys, contextMismatchMemberCandidateKeys: contextMismatches },
    policyCoverage: compiled,
    revisionCoverage: { requestedExactRevisionCount: expectedRevisionIds.length, fetchedExactRevisionCount: fetchedRevisionIds.length, missingRevisionIds, unexpectedRevisionIds, duplicateFetchedRevisionIds, totalFetchedSourceBytes: fetchedRows.reduce((sum, row) => sum + Buffer.byteLength(sourceContent(row.revision) || '', 'utf8'), 0), exactRevisionFetchSetMatch: !missingRevisionIds.length && !unexpectedRevisionIds.length && !duplicateFetchedRevisionIds.length },
    candidateCoverage: { inputCandidatePairCount: inputPairs.length, outputCandidatePacketCount: outputPairs.length, missingCandidatePairs: missingPairs, unexpectedCandidatePairs: unexpectedPairs, duplicateInputCandidatePairs: duplicates(inputPairs), duplicateOutputCandidatePairs: duplicates(outputPairs), exactCandidatePairSetMatch: !missingPairs.length && !unexpectedPairs.length && !duplicates(inputPairs).length && !duplicates(outputPairs).length, exactRevisionAlignedCandidateCount: outputPackets.filter(packet => Object.values(packet.sourceRevisionVerification || {}).every(Boolean)).length, incompleteCandidatePacketCount: outputPackets.filter(packet => packet.deficiencies?.length).length },
    occurrenceCoverage: { rawExactPhraseOccurrenceCount: occurrences.length, activeSourceOccurrenceCount: occurrences.filter(item => item.sourceRegionState === 'active_source_text').length, protectedOrMixedOccurrenceCount: occurrences.filter(item => item.sourceRegionState !== 'active_source_text').length, exactCaseOccurrenceCount: occurrences.filter(item => item.canonicalActivityLabelExactCaseMatch).length, duplicateOccurrenceKeys: duplicates(occurrenceKeys), evidenceMismatchMemberCandidateKeys: evidenceMismatches },
    semanticPromotionCoverage: { unsupportedPromotionMemberCandidateKeys: unsupportedPromotions, semanticSubjectBindingCount: 0, canonicalActivityScopeClassificationCount: 0, repeatabilityClassificationCount: 0, memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length, mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length, optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length },
    incompleteRecordMemberCandidateKeys: incompleteRecords,
    accountStateFindings,
    exactLineEvidenceAttemptCoverageComplete: attemptComplete,
    canonicalActivitySubjectDeclarationExactLineEvidenceCoverageComplete: complete,
    canonicalActivitySubjectBindingReviewComplete: false,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structural, 'canonical_activity_subject_declaration_exact_line_evidence_requires_semantic_disposition', 'canonical_activity_scope_review_incomplete', 'repeatability_classification_unresolved', 'member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable: complete
  };
}
