import { hash } from './lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => !keys.includes(name)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const revisionFor = page => page?.revisions?.[0];
const contentFor = page => revisionFor(page)?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;

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
  return sorted(unique(findings));
}

export function compileWeightedMembershipAdditionalEvidenceSourceDiscoveryPolicy(policy = {}) {
  const requiredRules = [
    'onePacketPerAdditionalEvidenceWorkEntry',
    'inputQueueRecordAndSnapshotHashesMustRevalidate',
    'everyPinnedCandidateAndParentRevisionMustRefetchAndRevalidate',
    'queriesMustBeDerivedOnlyFromRevisionBoundCandidateParentAndSectionEvidence',
    'allDerivedQueriesMustBeFullyEnumerated',
    'directCandidateParentAndRoleApplicableTranscriptRequestsUseOfficialWikiApi',
    'everyDiscoveredPageRetainsRevisionTimestampUrlHashBytesAndCompleteSource',
    'searchRankSnippetAndLexicalSignalsAreDiscoveryOnly',
    'parentSectionContextMaySupportReviewButCannotCreateMembership',
    'sourceSilenceIsNotNegativeEvidence',
    'missingCandidateSpecificEvidenceRemainsAnExplicitBlocker',
    'explicitHumanReviewRemainsSeparateAndRequired',
    'identityMembershipRepeatabilityMechanicsMappingCompletenessAndOptimizerVerdictsRemainClosed',
    'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotSelectAVerdict',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  if (policy.discovery?.apiNamespace !== 0) invalidRules.push('api_namespace_invalid');
  if (policy.discovery?.sourceSearchOperator !== 'insource') invalidRules.push('source_search_operator_invalid');
  if (!Number.isInteger(policy.discovery?.maximumSearchResultsPerQuery) || policy.discovery.maximumSearchResultsPerQuery < 1) invalidRules.push('search_limit_invalid');
  if (policy.discovery?.requireSearchContinuationExhausted !== true) invalidRules.push('search_continuation_exhaustion_not_required');
  if (policy.discovery?.retainCompleteExactRevisionSourceText !== true) invalidRules.push('complete_source_retention_not_required');
  if (policy.discovery?.deduplicateCurrentPagesByStablePageId !== true) invalidRules.push('stable_page_deduplication_not_required');
  if (policy.discovery?.deriveSectionContextFromPinnedParentOccurrence !== true) invalidRules.push('pinned_parent_section_context_not_required');
  const expectedRequests = ['current_parent_page', 'current_candidate_page', 'current_candidate_transcript_when_role_is_recipient'];
  const expectedChannels = ['candidate_subject_parent_task_relationship_statement', 'candidate_scoped_weight_or_membership_statement', 'explicit_source_bound_human_review'];
  const contractValid = policy.inputContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-work-queue-entry.v1'
    && policy.recordContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-source-discovery.v1'
    && policy.auditContract === 'sensum.weighted-parent-task-entry-membership-additional-evidence-source-discovery-audit.v1'
    && policy.inputState === 'blocked_pending_additional_candidate_specific_membership_evidence'
    && policy.recordState === 'revision_pinned_weighted_membership_additional_source_discovery_gates_closed';
  const configurationValid = same(policy.discovery?.directSourceRequestKinds || [], expectedRequests)
    && same(policy.discovery?.requiredAdditionalEvidenceChannels || [], expectedChannels)
    && Array.isArray(policy.discovery?.relationshipSignalTokens) && policy.discovery.relationshipSignalTokens.length > 0
    && Array.isArray(policy.discovery?.weightSignalTokens) && policy.discovery.weightSignalTokens.length > 0;
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractValid && configurationValid && invalidRules.length === 0 && forbidden.length === 0,
    contractValid,
    configurationValid,
    invalidRules: unique(invalidRules),
    forbiddenPolicyPaths: forbidden
  };
}

function inputIntegrity(record = {}, policy = {}, contentHash = hash) {
  const expectedChannels = policy.discovery?.requiredAdditionalEvidenceChannels || [];
  const parent = record.retainedEvidenceState?.parentOccurrence;
  const identities = record.evidenceSourceIdentities || [];
  const candidateIdentity = identities.find(item => item.roles?.includes('candidate_subject_source'));
  const parentIdentity = identities.find(item => item.roles?.includes('parent_inventory_source'));
  const checks = {
    contractMatches: record.contract === policy.inputContract,
    stateMatches: record.state === policy.inputState,
    ordinalValid: Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0,
    queueEntryKeyPresent: typeof record.queueEntryKey === 'string' && record.queueEntryKey.length > 0,
    recordContentHashMatches: typeof record.contentHash === 'string' && contentHash(without(record, 'contentHash')) === record.contentHash,
    evidenceBindingsPresent: [record.sourceDispositionRecordContentHash, record.sourceEvidenceRecordContentHash, record.sourceDispositionKey, record.sourceEvidencePacketKey, record.sourceEvidencePacketContentHash, record.evidenceFingerprint, record.structuralCandidateKey].every(value => typeof value === 'string' && value.length > 0),
    candidateDisplayBound: typeof record.candidateDisplay?.value === 'string' && record.candidateDisplay.value.length > 0 && record.candidateDisplay?.source?.sourceKey === candidateIdentity?.sourceKey,
    candidateAndParentSourcesPresent: Boolean(candidateIdentity && parentIdentity),
    sourceRevisionSetMatches: same(sorted(unique(identities.map(item => String(item.sourceRevision)))), sorted(unique(record.sourceRevisions?.map(String) || [])), contentHash),
    parentOccurrenceIntegrityComplete: parent?.integrity?.complete === true && typeof parent?.occurrence?.exactSourceText === 'string',
    parentOccurrenceBoundToParentSource: String(parent?.occurrence?.sourceRevision || '') === String(parentIdentity?.sourceRevision || '') && Number(parent?.occurrence?.sourcePageId) === Number(parentIdentity?.sourcePageId),
    requiredChannelsMatch: same(record.requiredEvidenceChannels || [], expectedChannels, contentHash),
    silencePreserved: record.sourceSilenceIsNotNegativeEvidence === true && record.retainedEvidenceState?.candidateScopedWeightStatements?.length === 0 && record.retainedEvidenceState?.candidateSubjectCorroborations?.length === 0,
    semanticGatesClosed: record.weightedTaskEntryMembershipVerdict === null && record.memberUniverseComplete === false && record.optimizerEligible === false && record.automaticVerificationApplied === false,
    accountIndependent: record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function sourceIdentity(record, role) {
  return (record.evidenceSourceIdentities || []).find(item => item.roles?.includes(role));
}

function escapeSearch(value) {
  return String(value || '').trim().replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function cleanWikiText(value) {
  return String(value || '')
    .replace(/^={2,6}\s*|\s*={2,6}$/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPinnedPage(identity, pinnedRevisionPages = []) {
  return pinnedRevisionPages.find(page => (page.revisions || []).some(revision => String(revision.revid) === String(identity?.sourceRevision)));
}

export function deriveWeightedMembershipParentSectionContext(record = {}, pinnedRevisionPages = []) {
  const identity = sourceIdentity(record, 'parent_inventory_source');
  const page = findPinnedPage(identity, pinnedRevisionPages);
  const content = contentFor(page);
  const lineNumber = Number(record.retainedEvidenceState?.parentOccurrence?.occurrence?.sourceLocator?.lineStart || 0);
  if (typeof content !== 'string' || lineNumber < 1) return { heading: null, headingLine: null, occurrenceLine: lineNumber || null };
  const lines = content.split(/\r?\n/);
  for (let index = Math.min(lineNumber - 2, lines.length - 1); index >= 0; index -= 1) {
    if (/^={2,6}.*={2,6}\s*$/.test(lines[index])) return { heading: cleanWikiText(lines[index]), headingLine: index + 1, occurrenceLine: lineNumber };
  }
  return { heading: null, headingLine: null, occurrenceLine: lineNumber };
}

export function buildWeightedMembershipAdditionalEvidenceDiscoveryQueries(record = {}, policy = {}, pinnedRevisionPages = []) {
  const operator = policy.discovery?.sourceSearchOperator || 'insource';
  const candidate = String(record.candidateDisplay?.value || '').trim();
  const parentTitle = String(sourceIdentity(record, 'parent_inventory_source')?.resolvedTitle || '').trim();
  const parentAnchor = parentTitle.replace(/\s+tasks$/i, '').trim();
  const context = deriveWeightedMembershipParentSectionContext(record, pinnedRevisionPages);
  const queries = [];
  const add = (queryKind, terms) => {
    const clean = unique(terms.map(value => String(value || '').trim()).filter(Boolean));
    if (clean.length < 2) return;
    const query = clean.map(term => `${operator}:"${escapeSearch(term)}"`).join(' ');
    if (queries.some(item => item.query === query)) return;
    queries.push({ queryKey: `${queryKind}|${hash(query)}`, queryKind, terms: clean, query, namespace: policy.discovery?.apiNamespace });
  };
  add('candidate_and_parent_anchor', [candidate, parentAnchor]);
  add('candidate_and_parent_title', [candidate, parentTitle]);
  add('candidate_and_pinned_parent_section_heading', [candidate, context.heading]);
  return queries;
}

export function buildWeightedMembershipAdditionalEvidenceDirectSourceRequests(record = {}) {
  const candidate = String(record.candidateDisplay?.value || '').trim();
  const parent = String(sourceIdentity(record, 'parent_inventory_source')?.resolvedTitle || '').trim();
  const requests = [
    { requestKind: 'current_parent_page', requestedTitle: parent },
    { requestKind: 'current_candidate_page', requestedTitle: candidate }
  ];
  if (record.candidateRole === 'message_delivery_recipient_candidate') requests.push({ requestKind: 'current_candidate_transcript_when_role_is_recipient', requestedTitle: candidate ? `Transcript:${candidate}` : '' });
  return requests.filter(item => item.requestedTitle);
}

export function discoverWeightedMembershipCandidateRequests(record, searchResponses = []) {
  const map = new Map();
  const add = (requestedTitle, context, observedPageId = null) => {
    const title = String(requestedTitle || '').trim();
    if (!title) return;
    const key = title.toLocaleLowerCase('en');
    const current = map.get(key) || { requestedTitle: title, observedPageIds: [], discoveryContexts: [] };
    if (observedPageId) current.observedPageIds.push(Number(observedPageId));
    current.observedPageIds = sorted(unique(current.observedPageIds)).map(Number);
    current.discoveryContexts.push(context);
    current.discoveryContexts.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    map.set(key, current);
  };
  for (const direct of buildWeightedMembershipAdditionalEvidenceDirectSourceRequests(record)) add(direct.requestedTitle, { channel: 'direct_source_request', requestKind: direct.requestKind, semanticUse: 'source_discovery_only' });
  for (const response of searchResponses) {
    for (const [index, result] of (response.results || []).entries()) add(result.title, {
      channel: 'exact_source_search', queryKey: response.queryKey, query: response.query,
      rank: result.rank ?? index + 1, resultTimestamp: result.timestamp || null,
      resultSize: result.size ?? null, resultWordCount: result.wordcount ?? null,
      resultSnippet: result.snippet ?? null, semanticUse: 'source_discovery_only_not_membership'
    }, result.pageid);
  }
  return [...map.values()].sort((left, right) => left.requestedTitle.localeCompare(right.requestedTitle));
}

function pinnedExpectations(records = []) {
  const map = new Map();
  for (const record of records) {
    for (const identity of record.evidenceSourceIdentities || []) {
      const key = String(identity.sourceRevision || '');
      if (!key) continue;
      const current = map.get(key) || { ...identity, roles: [], workQueueEntryKeys: [] };
      current.roles.push(...(identity.roles || []));
      current.workQueueEntryKeys.push(record.queueEntryKey);
      current.roles = sorted(unique(current.roles));
      current.workQueueEntryKeys = sorted(unique(current.workQueueEntryKeys));
      map.set(key, current);
    }
  }
  return [...map.values()].sort((left, right) => String(left.sourceRevision).localeCompare(String(right.sourceRevision)));
}

function revalidatePinnedSources(records, pinnedRevisionPages, contentHash = hash) {
  return pinnedExpectations(records).map(expected => {
    const found = pinnedRevisionPages.flatMap(page => (page.revisions || []).map(revision => ({ page, revision }))).find(row => String(row.revision.revid) === String(expected.sourceRevision));
    const content = found?.revision?.slots?.main?.content;
    const checks = {
      pagePresent: Boolean(found),
      pageIdMatches: Number(found?.page?.pageid) === Number(expected.sourcePageId),
      titleMatches: found?.page?.title === expected.resolvedTitle,
      revisionMatches: String(found?.revision?.revid || '') === String(expected.sourceRevision),
      timestampMatches: found?.revision?.timestamp === expected.sourceTimestamp,
      contentComplete: typeof content === 'string',
      contentHashMatches: typeof content === 'string' && contentHash(content) === expected.sourceContentHash,
      contentBytesMatch: typeof content === 'string' && new TextEncoder().encode(content).length === Number(expected.sourceContentBytes)
    };
    return {
      sourceKey: `wiki-pageid:${expected.sourcePageId}|revision:${expected.sourceRevision}`,
      sourceRoles: expected.roles,
      workQueueEntryKeys: expected.workQueueEntryKeys,
      sourcePageId: expected.sourcePageId,
      resolvedTitle: expected.resolvedTitle,
      sourceRevision: String(expected.sourceRevision),
      sourceTimestamp: expected.sourceTimestamp,
      sourceUrl: expected.sourceUrl,
      sourceContentHash: expected.sourceContentHash,
      sourceContentBytes: expected.sourceContentBytes,
      checks,
      complete: Object.values(checks).every(Boolean)
    };
  });
}

function sourcePages(requests, resolutions, contentHash = hash) {
  const byPage = new Map();
  for (const resolution of resolutions) {
    const request = requests.find(item => item.requestedTitle === resolution.requestedTitle);
    const page = resolution.page;
    const revision = revisionFor(page);
    const content = contentFor(page);
    const pageId = Number(page?.pageid || 0);
    const key = pageId ? String(pageId) : `missing:${resolution.requestedTitle}`;
    const current = byPage.get(key) || {
      sourceKey: pageId && revision?.revid ? `wiki-pageid:${pageId}|revision:${revision.revid}` : null,
      requestedTitles: [], normalizedTitles: [], resolvedTitle: page?.title || resolution.resolvedTitle || null,
      redirectedRequests: [], namespace: page?.ns ?? null, sourcePageId: pageId || null,
      sourceRevision: revision?.revid ? String(revision.revid) : null, sourceTimestamp: revision?.timestamp || null,
      sourceUrl: page?.title ? wikiUrl(page.title) : null,
      sourceContentHash: typeof content === 'string' ? contentHash(content) : null,
      sourceContentBytes: typeof content === 'string' ? new TextEncoder().encode(content).length : null,
      sourceText: typeof content === 'string' ? content : null,
      discoveryContexts: [], complete: Boolean(pageId && revision?.revid && revision?.timestamp && page?.title && typeof content === 'string')
    };
    current.requestedTitles.push(resolution.requestedTitle);
    current.normalizedTitles.push(resolution.normalizedTitle);
    if (resolution.redirected) current.redirectedRequests.push(resolution.requestedTitle);
    current.discoveryContexts.push(...(request?.discoveryContexts || []));
    current.requestedTitles = sorted(unique(current.requestedTitles));
    current.normalizedTitles = sorted(unique(current.normalizedTitles));
    current.redirectedRequests = sorted(unique(current.redirectedRequests));
    current.discoveryContexts.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    byPage.set(key, current);
  }
  return [...byPage.values()].sort((left, right) => String(left.sourceKey || left.resolvedTitle).localeCompare(String(right.sourceKey || right.resolvedTitle)));
}

function sections(sourceText = '') {
  const lines = String(sourceText).split(/\r?\n/);
  const result = [];
  let current = { heading: null, headingLine: null, lineStart: 1, lines: [] };
  for (const [index, line] of lines.entries()) {
    if (/^={2,6}.*={2,6}\s*$/.test(line)) {
      if (current.lines.length) result.push({ ...current, lineEnd: index, text: current.lines.join('\n') });
      current = { heading: cleanWikiText(line), headingLine: index + 1, lineStart: index + 1, lines: [line] };
    } else current.lines.push(line);
  }
  if (current.lines.length) result.push({ ...current, lineEnd: lines.length, text: current.lines.join('\n') });
  return result;
}

function sourceTermPresent(text, value) {
  const term = String(value || '').trim();
  if (!term) return false;
  const withoutUrls = String(text || '').replace(/https?:\/\/[^\s|}\]]+/gi, ' ');
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(withoutUrls);
}

export function structuredCandidateReferencePresent(text, candidate) {
  const escaped = String(candidate || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  const source = String(text || '');
  const wikiLink = new RegExp(`\\[\\[\\s*${escaped}\\s*(?:[|#\\]])`, 'iu');
  const linkTemplate = new RegExp(`\\{\\{\\s*[^{}|]+\\|\\s*${escaped}\\s*(?:[|}])`, 'iu');
  return wikiLink.test(source) || linkTemplate.test(source);
}

function sourcePageIsCandidateSubject(page, candidate) {
  const title = String(page?.resolvedTitle || '').replace(/^Transcript:/i, '').trim();
  return title.localeCompare(String(candidate || '').trim(), 'en', { sensitivity: 'base' }) === 0;
}

function tokenMatches(text, tokens = []) {
  return tokens.filter(token => sourceTermPresent(text, token));
}

function observationsFor(record, pages, policy, pinnedRevisionPages) {
  const candidate = String(record.candidateDisplay?.value || '').trim();
  const parentTitle = String(sourceIdentity(record, 'parent_inventory_source')?.resolvedTitle || '').trim();
  const parentAnchor = parentTitle.replace(/\s+tasks$/i, '').trim();
  const parentSection = deriveWeightedMembershipParentSectionContext(record, pinnedRevisionPages);
  const contextTerms = unique([parentTitle, parentAnchor, parentSection.heading].filter(Boolean));
  const parentSourcePageId = Number(sourceIdentity(record, 'parent_inventory_source')?.sourcePageId || 0);
  const context = [], memberships = [], weights = [];
  for (const page of pages.filter(item => item.complete)) {
    for (const section of sections(page.sourceText)) {
      if (!sourceTermPresent(section.text, candidate)) continue;
      const structuredCandidateReference = structuredCandidateReferencePresent(section.text, candidate);
      const candidateSubjectPage = sourcePageIsCandidateSubject(page, candidate);
      const matchedContextTerms = contextTerms.filter(term => sourceTermPresent(section.text, term) || sourceTermPresent(section.heading, term));
      const relationshipSignals = tokenMatches(`${section.heading || ''}\n${section.text}`, policy.discovery?.relationshipSignalTokens || []);
      const exact = {
        sourceKey: page.sourceKey,
        resolvedTitle: page.resolvedTitle,
        heading: section.heading,
        headingLine: section.headingLine,
        lineStart: section.lineStart,
        lineEnd: section.lineEnd,
        matchedCandidate: candidate,
        candidateMentionBasis: structuredCandidateReference ? 'exact_structured_source_reference' : (candidateSubjectPage ? 'exact_candidate_subject_page' : 'lexical_discovery_only'),
        matchedContextTerms,
        exactSectionText: section.text,
        exactSectionTextContentHash: hash(section.text)
      };
      if (matchedContextTerms.length || Number(page.sourcePageId) === parentSourcePageId) context.push({ ...exact, semanticUse: 'candidate_parent_context_source_discovery_only' });
      if ((structuredCandidateReference || candidateSubjectPage) && relationshipSignals.length && (matchedContextTerms.length || Number(page.sourcePageId) === parentSourcePageId)) memberships.push({
        ...exact,
        relationshipSignals,
        signalBasis: sourceTermPresent(section.heading, candidate) ? 'candidate_in_relationship_labeled_heading' : (sourceTermPresent(section.heading, relationshipSignals[0]) ? 'candidate_in_relationship_labeled_section' : 'candidate_and_relationship_language_in_section'),
        semanticUse: 'candidate_scoped_membership_signal_for_explicit_review_not_membership_verdict'
      });
      const lines = section.text.split(/\r?\n/);
      for (const [offset, line] of lines.entries()) {
        if (!sourceTermPresent(line, candidate)) continue;
        const exactCandidateOnLine = structuredCandidateReferencePresent(line, candidate) || (candidateSubjectPage && sourceTermPresent(line, candidate));
        const weightSignals = tokenMatches(line, policy.discovery?.weightSignalTokens || []);
        const lineRelationshipSignals = tokenMatches(line, policy.discovery?.relationshipSignalTokens || []);
        const lineParentContextTerms = contextTerms.filter(term => sourceTermPresent(line, term));
        if (exactCandidateOnLine && weightSignals.length && (lineRelationshipSignals.length || lineParentContextTerms.length)) weights.push({
          sourceKey: page.sourceKey, resolvedTitle: page.resolvedTitle,
          line: section.lineStart + offset, matchedCandidate: candidate, weightSignals,
          relationshipSignals: lineRelationshipSignals, matchedParentContextTerms: lineParentContextTerms,
          exactSourceText: line, exactSourceTextContentHash: hash(line),
          semanticUse: 'candidate_and_weight_language_same_line_for_explicit_review_not_weight_or_membership_verdict'
        });
      }
    }
  }
  const dedupe = values => [...new Map(values.map(value => [hash(value), value])).values()];
  return { context: dedupe(context), memberships: dedupe(memberships), weights: dedupe(weights) };
}

function searchAssessment(record, responses, policy, pinnedRevisionPages) {
  const expected = buildWeightedMembershipAdditionalEvidenceDiscoveryQueries(record, policy, pinnedRevisionPages);
  const rows = expected.map(query => {
    const response = responses.find(item => item.queryKey === query.queryKey);
    const checks = {
      responsePresent: Boolean(response),
      queryMatches: response?.query === query.query,
      namespaceMatches: response?.namespace === policy.discovery?.apiNamespace,
      resultCountMatches: Number(response?.returnedCount) === (response?.results || []).length,
      totalHitsRetained: Number(response?.totalHits) === (response?.results || []).length,
      continuationExhausted: response?.continuationExhausted === true,
      notTruncated: response?.truncated === false,
      resultsValid: (response?.results || []).every(result => Number(result.ns) === policy.discovery?.apiNamespace && result.pageid && result.title)
    };
    return { queryKey: query.queryKey, checks, complete: Object.values(checks).every(Boolean) };
  });
  return { expected, rows, complete: rows.length === expected.length && rows.every(row => row.complete) };
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
  return findings;
}

function makeRecord(record, searchResponses, pages, pinnedRows, policy, sourceQueueSnapshotContentHash, pinnedRevisionPages, contentHash = hash) {
  const observations = observationsFor(record, pages, policy, pinnedRevisionPages);
  const relationshipSatisfied = observations.memberships.length > 0;
  const candidateWeightOrMembershipSatisfied = observations.memberships.length > 0 || observations.weights.length > 0;
  const channelStatus = [
    { channel: 'candidate_subject_parent_task_relationship_statement', satisfiedByCapturedEvidence: relationshipSatisfied, humanReviewRequired: false },
    { channel: 'candidate_scoped_weight_or_membership_statement', satisfiedByCapturedEvidence: candidateWeightOrMembershipSatisfied, humanReviewRequired: false },
    { channel: 'explicit_source_bound_human_review', satisfiedByCapturedEvidence: false, humanReviewRequired: true }
  ];
  const blockers = [];
  if (!relationshipSatisfied) blockers.push('candidate_subject_parent_task_relationship_statement_not_observed');
  if (!candidateWeightOrMembershipSatisfied) blockers.push('candidate_scoped_weight_or_membership_statement_not_observed');
  blockers.push('explicit_source_bound_human_review_pending');
  const sourceKeys = sorted(unique(pages.filter(page => page.complete).map(page => page.sourceKey)));
  const base = {
    contract: policy.recordContract,
    evidencePacketKey: `${record.queueEntryKey}|additional-source-discovery|${contentHash({ sourceKeys, queries: searchResponses.map(item => item.queryKey) })}`,
    workQueueEntryKey: record.queueEntryKey,
    sourceWorkQueueRecordContentHash: record.contentHash,
    sourceQueueSnapshotContentHash,
    sourceDispositionKey: record.sourceDispositionKey,
    sourceEvidencePacketContentHash: record.sourceEvidencePacketContentHash,
    evidenceFingerprint: record.evidenceFingerprint,
    structuralCandidateKey: record.structuralCandidateKey,
    candidateRole: record.candidateRole,
    candidateDisplay: record.candidateDisplay,
    pinnedSourceRevalidations: pinnedRows.filter(row => row.workQueueEntryKeys.includes(record.queueEntryKey)),
    discoveryQueries: searchResponses,
    directSourceRequests: buildWeightedMembershipAdditionalEvidenceDirectSourceRequests(record),
    candidateSourcePages: pages,
    parentSectionContext: deriveWeightedMembershipParentSectionContext(record, pinnedRevisionPages),
    candidateParentContextObservations: observations.context,
    candidateScopedMembershipSignalObservations: observations.memberships,
    candidateScopedWeightSignalObservations: observations.weights,
    requiredChannelStatus: channelStatus,
    newEvidenceKeys: sourceKeys,
    sourceSilenceIsNotNegativeEvidence: true,
    evidenceReviewer: null,
    evidenceReviewedAt: null,
    evidenceNotes: null,
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
    blockers,
    state: policy.recordState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function preflight(args = {}) {
  const { workQueueRecords = [], pinnedRevisionPages = [], discoveryResponses = [], candidateRequests = [], fetchedResolutions = [], policy = {}, sourceQueueSnapshotContentHash, contentHash = hash } = args;
  const compiled = compileWeightedMembershipAdditionalEvidenceSourceDiscoveryPolicy(policy);
  const inputAssessments = workQueueRecords.map(record => ({ queueEntryKey: record.queueEntryKey, integrity: inputIntegrity(record, policy, contentHash) }));
  const duplicateInputKeys = duplicates(workQueueRecords.map(record => record.queueEntryKey));
  const queueOrderValid = workQueueRecords.every((record, index) => record.queueOrdinal === index + 1);
  const pinnedRows = revalidatePinnedSources(workQueueRecords, pinnedRevisionPages, contentHash);
  const records = [], searchAssessments = [], sourceGroups = [];
  for (const record of workQueueRecords) {
    const responses = discoveryResponses.find(item => item.workQueueEntryKey === record.queueEntryKey)?.searchResponses || [];
    const search = searchAssessment(record, responses, policy, pinnedRevisionPages);
    searchAssessments.push({ workQueueEntryKey: record.queueEntryKey, ...search });
    const requests = candidateRequests.find(item => item.workQueueEntryKey === record.queueEntryKey)?.requests || [];
    const resolutions = fetchedResolutions.filter(item => requests.some(request => request.requestedTitle === item.requestedTitle));
    const pages = sourcePages(requests, resolutions, contentHash);
    const resolvedTitles = new Set(resolutions.map(item => item.requestedTitle));
    const missingRequestTitles = requests.filter(request => !resolvedTitles.has(request.requestedTitle)).map(request => request.requestedTitle);
    sourceGroups.push({ workQueueEntryKey: record.queueEntryKey, requests, pages, missingRequestTitles });
    records.push(makeRecord(record, responses, pages, pinnedRows, policy, sourceQueueSnapshotContentHash, pinnedRevisionPages, contentHash));
  }
  const failures = [];
  if (!compiled.valid) failures.push('source_discovery_policy_invalid_or_candidate_specific');
  if (!workQueueRecords.length) failures.push('no_additional_evidence_work_entries');
  if (typeof sourceQueueSnapshotContentHash !== 'string' || !sourceQueueSnapshotContentHash) failures.push('source_queue_snapshot_hash_missing');
  if (duplicateInputKeys.length) failures.push('duplicate_input_work_queue_keys');
  if (!queueOrderValid) failures.push('input_queue_order_invalid');
  if (inputAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_input_work_queue_entries_failed_revalidation');
  if (pinnedRows.some(row => !row.complete)) failures.push('one_or_more_pinned_sources_failed_exact_revision_revalidation');
  if (searchAssessments.some(item => !item.complete)) failures.push('one_or_more_source_searches_missing_truncated_or_mismatched');
  if (sourceGroups.some(group => group.requests.length === 0 || group.pages.length === 0 || group.missingRequestTitles.length > 0 || group.pages.some(page => !page.complete))) failures.push('one_or_more_discovered_or_direct_source_pages_failed_revision_capture');
  if (accountStateFindings([...workQueueRecords, ...records]).length) failures.push('current_account_state_present');
  return { compiled, inputAssessments, duplicateInputKeys, queueOrderValid, pinnedRows, searchAssessments, sourceGroups, records, failures };
}

export function auditWeightedMembershipAdditionalEvidenceSourceDiscovery(records = [], args = {}) {
  const flight = preflight(args);
  const expected = flight.failures.length ? [] : flight.records;
  const inputKeys = (args.workQueueRecords || []).map(record => record.queueEntryKey);
  const outputKeys = records.map(record => record.workQueueEntryKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !expected[index] || !same(record, expected[index], args.contentHash || hash)).map(record => record.evidencePacketKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.evidenceReviewer !== null || record.evidenceReviewedAt !== null || record.evidenceNotes !== null
    || record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null || record.weightedTaskEntryMembershipVerdict !== null
    || record.repeatabilityVerdict !== null || record.mechanicsReviewComplete !== false || record.mappingVerdict !== null
    || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete !== false || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false || record.sourceSilenceIsNotNegativeEvidence !== true).map(record => record.evidencePacketKey || 'unknown');
  const accountFindings = accountStateFindings([...(args.workQueueRecords || []), ...records]);
  const failures = [...flight.failures];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) failures.push('input_and_output_packet_sets_do_not_match_exactly');
  if (recordMismatches.length) failures.push('one_or_more_output_packets_do_not_match_source_discovery_inputs');
  if (unsupportedPromotions.length) failures.push('source_discovery_created_unsupported_review_semantic_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const memberships = records.flatMap(record => record.candidateScopedMembershipSignalObservations || []);
  const weights = records.flatMap(record => record.candidateScopedWeightSignalObservations || []);
  const allEvidenceChannelsObserved = records.length > 0 && records.every(record => record.requiredChannelStatus.filter(channel => !channel.humanReviewRequired).every(channel => channel.satisfiedByCapturedEvidence));
  const allChannelsSatisfied = records.length > 0 && records.every(record => record.requiredChannelStatus.every(channel => channel.satisfiedByCapturedEvidence));
  const publishable = failures.length === 0;
  return {
    contract: args.policy?.auditContract,
    inputCoverage: {
      inputWorkQueueEntryCount: (args.workQueueRecords || []).length,
      completeInputWorkQueueEntryCount: flight.inputAssessments.filter(item => item.integrity.complete).length,
      failedInputWorkQueueEntryKeys: flight.inputAssessments.filter(item => !item.integrity.complete).map(item => item.queueEntryKey),
      duplicateInputKeys: flight.duplicateInputKeys,
      queueOrderValid: flight.queueOrderValid,
      sourceQueueSnapshotContentHash: args.sourceQueueSnapshotContentHash
    },
    policyCoverage: flight.compiled,
    pinnedSourceIntegrityCoverage: {
      distinctPinnedSourceCount: flight.pinnedRows.length,
      revalidatedPinnedSourceCount: flight.pinnedRows.filter(row => row.complete).length,
      failedSourceKeys: flight.pinnedRows.filter(row => !row.complete).map(row => row.sourceKey)
    },
    discoveryCoverage: {
      queryCount: flight.searchAssessments.reduce((total, item) => total + item.rows.length, 0),
      completeQueryCount: flight.searchAssessments.reduce((total, item) => total + item.rows.filter(row => row.complete).length, 0),
      incompleteQueryKeys: flight.searchAssessments.flatMap(item => item.rows.filter(row => !row.complete).map(row => row.queryKey)),
      requestedCurrentSourceCount: unique(flight.sourceGroups.flatMap(group => group.requests.map(request => request.requestedTitle))).length,
      capturedDistinctCurrentSourceCount: unique(flight.sourceGroups.flatMap(group => group.pages.filter(page => page.complete).map(page => page.sourceKey))).length,
      failedCurrentSourceRequests: flight.sourceGroups.flatMap(group => [...group.missingRequestTitles, ...group.pages.filter(page => !page.complete).flatMap(page => page.requestedTitles)])
    },
    sourceObservationCoverage: {
      candidateParentContextObservationCount: records.reduce((total, record) => total + record.candidateParentContextObservations.length, 0),
      candidateScopedMembershipSignalObservationCount: memberships.length,
      candidateScopedWeightSignalObservationCount: weights.length,
      recordsWithCandidateScopedMembershipSignals: records.filter(record => record.candidateScopedMembershipSignalObservations.length > 0).map(record => record.workQueueEntryKey),
      recordsWithCandidateScopedWeightSignals: records.filter(record => record.candidateScopedWeightSignalObservations.length > 0).map(record => record.workQueueEntryKey)
    },
    requiredChannelCoverage: {
      requiredChannelCount: (args.policy?.discovery?.requiredAdditionalEvidenceChannels || []).length * records.length,
      satisfiedChannelCount: records.reduce((total, record) => total + record.requiredChannelStatus.filter(channel => channel.satisfiedByCapturedEvidence).length, 0),
      allEvidenceChannelsObserved,
      allChannelsSatisfied,
      unsatisfiedChannels: records.flatMap(record => record.requiredChannelStatus.filter(channel => !channel.satisfiedByCapturedEvidence).map(channel => ({ workQueueEntryKey: record.workQueueEntryKey, channel: channel.channel })))
    },
    semanticPreservationCoverage: {
      outputPacketCount: records.length,
      duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys, recordMismatches,
      reviewDecisionCount: records.filter(record => record.evidenceReviewer !== null).length,
      membershipVerdictCount: records.filter(record => record.parentMembershipVerdict !== null || record.weightedTaskEntryMembershipVerdict !== null).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    evidencePacketAttemptCoverageComplete: publishable,
    candidateSpecificMembershipEvidenceComplete: publishable && allEvidenceChannelsObserved,
    weightedMembershipReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(records.some(record => record.candidateScopedMembershipSignalObservations.length === 0) ? ['one_or_more_candidate_subject_parent_task_relationship_statements_not_observed'] : []),
      ...(records.some(record => record.candidateScopedMembershipSignalObservations.length === 0 && record.candidateScopedWeightSignalObservations.length === 0) ? ['one_or_more_candidate_scoped_weight_or_membership_statements_not_observed'] : []),
      'explicit_source_bound_human_review_pending',
      'weighted_parent_task_entry_membership_not_proven',
      'member_universe_completeness_not_proven',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildWeightedMembershipAdditionalEvidenceSourceDiscovery(args = {}) {
  const flight = preflight(args);
  const records = flight.failures.length === 0 ? flight.records : [];
  return { records, audit: auditWeightedMembershipAdditionalEvidenceSourceDiscovery(records, args) };
}
