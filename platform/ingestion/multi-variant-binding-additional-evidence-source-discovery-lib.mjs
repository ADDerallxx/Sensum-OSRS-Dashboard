import { hash } from './lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([name]) => !keys.includes(name)));
const same = (left, right) => hash(left) === hash(right);
const sourceRevision = page => page?.revisions?.[0];
const sourceContent = page => sourceRevision(page)?.slots?.main?.content;
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

export function compileMultiVariantBindingAdditionalEvidenceSourceDiscoveryPolicy(policy = {}) {
  const requiredRules = [
    'onePacketPerAdditionalEvidenceWorkEntry',
    'inputQueueEntryAndContentHashesMustRevalidate',
    'everyPinnedSubjectAndParentRevisionMustRefetchAndRevalidate',
    'queriesMustBeDerivedOnlyFromRevisionBoundParentSubjectAndVariantEvidence',
    'candidateContextAndEveryNumberedVariantIdentityQueryMustBeFullyEnumerated',
    'directSubjectParentAndTranscriptRequestsMustResolveThroughTheOfficialWikiApi',
    'everyDiscoveredPageMustRetainRevisionTimestampUrlHashBytesAndCompleteSource',
    'searchRankSnippetAndLexicalCooccurrenceAreDiscoveryOnly',
    'sectionAndLineObservationsCannotSelectANumberedVariant',
    'canonicalNpcContextCannotBeForcedIntoTheNormalVariant',
    'missingNumberedVariantAlignmentRemainsAnExplicitBlocker',
    'humanBindingReviewRemainsSeparateAndRequired',
    'identityMembershipRepeatabilityMechanicsMappingCompletenessAndOptimizerVerdictsRemainClosed',
    'namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotSelectAVerdict',
    'currentAccountStateIsForbidden'
  ];
  const expectedDirect = ['pinned_parent_page', 'pinned_subject_page', 'current_parent_page', 'current_subject_page', 'current_subject_transcript'];
  const expectedBases = ['id', 'version'];
  const expectedChannels = ['candidate_scoped_parent_occurrence_context', 'source_authored_numbered_variant_identity_alignment', 'explicit_human_binding_review'];
  const invalidRules = requiredRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  if (policy.discovery?.apiNamespace !== 0) invalidRules.push('api_namespace_invalid');
  if (policy.discovery?.sourceSearchOperator !== 'insource') invalidRules.push('source_search_operator_invalid');
  if (!Number.isInteger(policy.discovery?.maximumSearchResultsPerQuery) || policy.discovery.maximumSearchResultsPerQuery < 1) invalidRules.push('search_limit_invalid');
  if (policy.discovery?.requireSearchContinuationExhausted !== true) invalidRules.push('search_continuation_exhaustion_not_required');
  if (policy.discovery?.retainCompleteExactRevisionSourceText !== true) invalidRules.push('complete_source_retention_not_required');
  if (policy.discovery?.deduplicateCurrentPagesByStablePageId !== true) invalidRules.push('stable_page_deduplication_not_required');
  const contractValid = policy.inputContract === 'sensum.multi-variant-binding-additional-evidence-work-queue-entry.v1'
    && policy.recordContract === 'sensum.multi-variant-binding-additional-evidence-source-discovery.v1'
    && policy.auditContract === 'sensum.multi-variant-binding-additional-evidence-source-discovery-audit.v1'
    && policy.inputState === 'blocked_pending_additional_variant_disambiguation_evidence'
    && policy.recordState === 'revision_pinned_additional_variant_binding_source_discovery_gates_closed';
  const configurationValid = same(policy.discovery?.directSourceRequestKinds || [], expectedDirect)
    && same(policy.discovery?.numberedVariantIdentityParameterBases || [], expectedBases)
    && same(policy.discovery?.requiredAdditionalEvidenceChannels || [], expectedChannels);
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
  const base = without(record, 'entryContentHash', 'contentHash');
  const withEntryHash = without(record, 'contentHash');
  const expectedChannels = policy.discovery?.requiredAdditionalEvidenceChannels || [];
  const checks = {
    contractMatches: record.contract === policy.inputContract,
    stateMatches: record.state === policy.inputState,
    ordinalValid: Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0,
    workQueueEntryKeyPresent: typeof record.workQueueEntryKey === 'string' && record.workQueueEntryKey.length > 0,
    entryContentHashMatches: typeof record.entryContentHash === 'string' && contentHash(base) === record.entryContentHash,
    recordContentHashMatches: typeof record.contentHash === 'string' && contentHash(withEntryHash) === record.contentHash,
    evidenceBindingsPresent: typeof record.sourceDispositionKey === 'string' && typeof record.sourceEvidencePacketContentHash === 'string' && typeof record.evidenceFingerprint === 'string',
    sourcePagesPresent: Boolean(record.subjectEvidence?.sourcePageIdentity && record.parentOccurrenceEvidence?.sourcePageIdentity),
    numberedVariantsPresent: Array.isArray(record.subjectEvidence?.numberedVariantInventory) && record.subjectEvidence.numberedVariantInventory.length > 1,
    requiredChannelsMatch: same(record.requiredAdditionalEvidenceChannels || [], expectedChannels),
    evidenceStartsBlank: Array.isArray(record.newEvidenceKeys) && record.newEvidenceKeys.length === 0 && record.evidenceReviewer === null && record.evidenceReviewedAt === null && record.evidenceNotes === null,
    noVariantSelected: record.reviewCandidateVariantIndex === null && record.bindingReviewDecision === null && record.boundVariantIndex === null,
    semanticGatesClosed: record.candidateMemberIdentityVerdict === null && record.parentMembershipVerdict === null
      && record.weightedTaskEntryMembershipVerdict === null && record.repeatabilityVerdict === null
      && record.mechanicsReviewComplete === false && record.mappingVerdict === null
      && record.inventoryCompletenessVerdict === null && record.memberUniverseComplete === false
      && record.optimizerEligible === false && record.automaticVerificationApplied === false,
    accountIndependent: record.accountIndependent === true
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function escapeSearch(value) {
  return String(value || '').trim().replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function parentAnchor(record) {
  return String(record.parentOccurrenceEvidence?.sourcePageIdentity?.resolvedTitle || '').replace(/\s+tasks$/i, '').trim();
}

function subjectTitle(record) {
  return String(record.subjectEvidence?.sourcePageIdentity?.resolvedTitle || '').trim();
}

function candidateLabel(record) {
  return String(record.candidateDisplayName || '').trim();
}

export function buildMultiVariantBindingDiscoveryQueries(record = {}, policy = {}) {
  const operator = policy.discovery?.sourceSearchOperator || 'insource';
  const anchor = parentAnchor(record);
  const candidate = candidateLabel(record);
  const subject = subjectTitle(record);
  const queries = [];
  const add = (queryKind, terms, variantIndex = null, identityField = null) => {
    const clean = unique(terms.map(value => String(value || '').trim()).filter(Boolean));
    if (!clean.length) return;
    const query = clean.map(term => `${operator}:"${escapeSearch(term)}"`).join(' ');
    const key = `${queryKind}|${variantIndex ?? 'none'}|${identityField?.parameterName || 'none'}|${hash(query)}`;
    if (!queries.some(item => item.query === query)) queries.push({ queryKey: key, queryKind, variantIndex, identityField, terms: clean, query, namespace: policy.discovery?.apiNamespace });
  };
  add('candidate_display_and_parent_context', [anchor, candidate]);
  add('resolved_subject_and_parent_context', [anchor, subject]);
  const allowedBases = new Set(policy.discovery?.numberedVariantIdentityParameterBases || []);
  for (const variant of record.subjectEvidence?.numberedVariantInventory || []) {
    for (const field of variant.identityFields || []) {
      if (!allowedBases.has(field.parameterBase)) continue;
      add('numbered_variant_identity_and_parent_context', [anchor, candidate, field.value], variant.variantIndex, {
        parameterBase: field.parameterBase,
        parameterName: field.parameterName,
        value: field.value
      });
    }
  }
  return queries;
}

export function buildMultiVariantBindingDirectSourceRequests(record = {}) {
  const parent = String(record.parentOccurrenceEvidence?.sourcePageIdentity?.resolvedTitle || '').trim();
  const subject = subjectTitle(record);
  return [
    { requestKind: 'current_parent_page', requestedTitle: parent },
    { requestKind: 'current_subject_page', requestedTitle: subject },
    { requestKind: 'current_subject_transcript', requestedTitle: subject ? `Transcript:${subject}` : '' }
  ].filter(item => item.requestedTitle);
}

export function discoverMultiVariantBindingCandidateRequests(record, searchResponses = []) {
  const map = new Map();
  const add = (requestedTitle, context, observedPageId = null) => {
    const title = String(requestedTitle || '').trim();
    if (!title) return;
    const key = title.toLocaleLowerCase('en');
    const current = map.get(key) || { requestedTitle: title, observedPageIds: [], discoveryContexts: [] };
    if (observedPageId) current.observedPageIds.push(Number(observedPageId));
    current.observedPageIds = sorted(unique(current.observedPageIds)).map(Number);
    current.discoveryContexts.push(context);
    current.discoveryContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    map.set(key, current);
  };
  for (const direct of buildMultiVariantBindingDirectSourceRequests(record)) add(direct.requestedTitle, { channel: 'direct_source_request', requestKind: direct.requestKind, semanticUse: 'source_discovery_only' });
  for (const response of searchResponses) {
    for (const [index, result] of (response.results || []).entries()) add(result.title, {
      channel: 'exact_source_search', queryKey: response.queryKey, query: response.query,
      rank: result.rank ?? index + 1, resultTimestamp: result.timestamp || null,
      resultSize: result.size ?? null, resultWordCount: result.wordcount ?? null,
      resultSnippet: result.snippet ?? null, semanticUse: 'source_discovery_only_not_variant_binding'
    }, result.pageid);
  }
  return [...map.values()].sort((left, right) => left.requestedTitle.localeCompare(right.requestedTitle));
}

function pinnedExpectations(records = []) {
  const map = new Map();
  for (const record of records) {
    for (const [role, identity] of [
      ['pinned_subject_page', record.subjectEvidence?.sourcePageIdentity],
      ['pinned_parent_page', record.parentOccurrenceEvidence?.sourcePageIdentity]
    ]) {
      if (!identity?.sourceRevision) continue;
      const key = String(identity.sourceRevision);
      const current = map.get(key) || { ...identity, roles: [], workQueueEntryKeys: [] };
      current.roles.push(role);
      current.workQueueEntryKeys.push(record.workQueueEntryKey);
      current.roles = sorted(unique(current.roles));
      current.workQueueEntryKeys = sorted(unique(current.workQueueEntryKeys));
      map.set(key, current);
    }
  }
  return [...map.values()].sort((left, right) => String(left.sourceRevision).localeCompare(String(right.sourceRevision)));
}

function revalidatePinnedSources(records, pinnedRevisionPages, contentHash = hash) {
  const rows = [];
  for (const expected of pinnedExpectations(records)) {
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
    rows.push({
      sourceKey: `wiki-pageid:${expected.sourcePageId}|revision:${expected.sourceRevision}`,
      sourceRole: expected.roles,
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
    });
  }
  return rows;
}

function sourcePages(requests, resolutions, contentHash = hash) {
  const byPage = new Map();
  for (const resolution of resolutions) {
    const request = requests.find(item => item.requestedTitle === resolution.requestedTitle);
    const page = resolution.page;
    const revision = sourceRevision(page);
    const content = sourceContent(page);
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
    current.discoveryContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    byPage.set(key, current);
  }
  return [...byPage.values()].sort((left, right) => String(left.sourceKey || left.resolvedTitle).localeCompare(String(right.sourceKey || right.resolvedTitle)));
}

function sections(sourceText = '') {
  const lines = String(sourceText).split(/\r?\n/);
  const result = [];
  let current = { heading: null, lineStart: 1, lines: [] };
  for (const [index, line] of lines.entries()) {
    if (/^={2,6}.*={2,6}$/.test(line)) {
      if (current.lines.length) result.push({ ...current, lineEnd: index, text: current.lines.join('\n') });
      current = { heading: line.trim(), lineStart: index + 1, lines: [line] };
    } else current.lines.push(line);
  }
  if (current.lines.length) result.push({ ...current, lineEnd: lines.length, text: current.lines.join('\n') });
  return result;
}

function includesFolded(text, value) {
  return String(text || '').toLocaleLowerCase('en').includes(String(value || '').toLocaleLowerCase('en'));
}

function sourceTermPresent(text, value) {
  const term = String(value || '').trim();
  if (!term) return false;
  const withoutUrls = String(text || '').replace(/https?:\/\/[^\s|}\]]+/gi, ' ');
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(withoutUrls);
}

function observationsFor(record, pages) {
  const anchor = parentAnchor(record);
  const candidate = candidateLabel(record);
  const subject = subjectTitle(record);
  const candidateTerms = unique([candidate, subject, subject.replace(/\s*\([^)]*\)\s*$/, '')].filter(Boolean));
  const context = [];
  const identities = [];
  const exactAlignments = [];
  for (const page of pages.filter(item => item.complete)) {
    const pageSections = sections(page.sourceText);
    for (const section of pageSections) {
      const hasAnchor = sourceTermPresent(section.text, anchor);
      const matchingCandidateTerms = candidateTerms.filter(term => sourceTermPresent(section.text, term));
      if (hasAnchor && matchingCandidateTerms.length) context.push({
        sourceKey: page.sourceKey, resolvedTitle: page.resolvedTitle, heading: section.heading,
        lineStart: section.lineStart, lineEnd: section.lineEnd,
        matchedParentAnchor: anchor, matchedCandidateTerms: matchingCandidateTerms,
        exactSectionText: section.text, exactSectionTextContentHash: hash(section.text),
        semanticUse: 'candidate_scoped_parent_context_evidence_not_numbered_variant_binding'
      });
    }
    const lines = String(page.sourceText).split(/\r?\n/);
    for (const variant of record.subjectEvidence?.numberedVariantInventory || []) {
      for (const field of variant.identityFields || []) {
        if (!(field.parameterBase === 'id' || field.parameterBase === 'version')) continue;
        for (const [index, line] of lines.entries()) {
          const parameterPattern = new RegExp(`\\b${String(field.parameterName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`, 'i');
          const exactValue = includesFolded(line, field.value);
          if (parameterPattern.test(line) && exactValue) identities.push({
            sourceKey: page.sourceKey, resolvedTitle: page.resolvedTitle, line: index + 1,
            variantIndex: variant.variantIndex, parameterBase: field.parameterBase,
            parameterName: field.parameterName, value: field.value, exactSourceText: line,
            semanticUse: 'numbered_variant_identity_observation_not_task_alignment'
          });
          if (parameterPattern.test(line) && sourceTermPresent(line, anchor) && candidateTerms.some(term => sourceTermPresent(line, term)) && exactValue) exactAlignments.push({
            sourceKey: page.sourceKey, resolvedTitle: page.resolvedTitle, line: index + 1,
            variantIndex: variant.variantIndex, parameterBase: field.parameterBase,
            parameterName: field.parameterName, value: field.value, exactSourceText: line,
            semanticUse: 'source_authored_same_line_task_to_numbered_variant_alignment_review_evidence'
          });
        }
      }
    }
  }
  const dedupe = values => [...new Map(values.map(value => [hash(value), value])).values()];
  return { context: dedupe(context), identities: dedupe(identities), exactAlignments: dedupe(exactAlignments) };
}

function searchResponseAssessment(record, responses, policy) {
  const expected = buildMultiVariantBindingDiscoveryQueries(record, policy);
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

function makeRecord(record, searchResponses, requests, pages, pinnedRows, policy, sourceQueueSnapshotContentHash, contentHash = hash) {
  const observations = observationsFor(record, pages);
  const candidateContextSatisfied = observations.context.length > 0;
  const numberedAlignmentSatisfied = observations.exactAlignments.length > 0;
  const channelStatus = [
    { channel: 'candidate_scoped_parent_occurrence_context', satisfiedByCapturedEvidence: candidateContextSatisfied, humanReviewRequired: false },
    { channel: 'source_authored_numbered_variant_identity_alignment', satisfiedByCapturedEvidence: numberedAlignmentSatisfied, humanReviewRequired: false },
    { channel: 'explicit_human_binding_review', satisfiedByCapturedEvidence: false, humanReviewRequired: true }
  ];
  const blockers = [];
  if (!candidateContextSatisfied) blockers.push('candidate_scoped_parent_occurrence_context_not_observed');
  if (!numberedAlignmentSatisfied) blockers.push('source_authored_numbered_variant_identity_alignment_not_observed');
  blockers.push('explicit_human_binding_review_pending');
  const sourceKeys = sorted(unique(pages.filter(page => page.complete).map(page => page.sourceKey)));
  const base = {
    contract: policy.recordContract,
    evidencePacketKey: `${record.workQueueEntryKey}|additional-source-discovery|${contentHash({ sourceKeys, queries: searchResponses.map(item => item.queryKey) })}`,
    workQueueEntryKey: record.workQueueEntryKey,
    sourceWorkQueueRecordContentHash: record.contentHash,
    sourceWorkQueueEntryContentHash: record.entryContentHash,
    sourceQueueSnapshotContentHash,
    sourceDispositionKey: record.sourceDispositionKey,
    sourceEvidencePacketContentHash: record.sourceEvidencePacketContentHash,
    evidenceFingerprint: record.evidenceFingerprint,
    structuralCandidateKey: record.structuralCandidateKey,
    candidateRole: record.candidateRole,
    candidateDisplayName: record.candidateDisplayName,
    pinnedSourceRevalidations: pinnedRows.filter(row => row.workQueueEntryKeys.includes(record.workQueueEntryKey)),
    discoveryQueries: searchResponses,
    directSourceRequests: buildMultiVariantBindingDirectSourceRequests(record),
    candidateSourcePages: pages,
    candidateScopedParentContextObservations: observations.context,
    numberedVariantIdentityObservations: observations.identities,
    exactTaskToNumberedVariantAlignmentObservations: observations.exactAlignments,
    requiredChannelStatus: channelStatus,
    newEvidenceKeys: sourceKeys,
    reviewCandidateVariantIndex: null,
    bindingReviewDecision: null,
    boundVariantIndex: null,
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

function preflight({ workQueueRecords, pinnedRevisionPages, discoveryResponses, candidateRequests, fetchedResolutions, policy, sourceQueueSnapshotContentHash, contentHash = hash }) {
  const compiled = compileMultiVariantBindingAdditionalEvidenceSourceDiscoveryPolicy(policy);
  const inputAssessments = workQueueRecords.map(record => ({ workQueueEntryKey: record.workQueueEntryKey, integrity: inputIntegrity(record, policy, contentHash) }));
  const duplicateInputKeys = duplicates(workQueueRecords.map(record => record.workQueueEntryKey));
  const queueOrderValid = workQueueRecords.every((record, index) => record.queueOrdinal === index + 1);
  const pinnedRows = revalidatePinnedSources(workQueueRecords, pinnedRevisionPages, contentHash);
  const records = [];
  const discoveryAssessments = [];
  const sourceGroups = [];
  for (const record of workQueueRecords) {
    const responses = discoveryResponses.find(item => item.workQueueEntryKey === record.workQueueEntryKey)?.searchResponses || [];
    const assessment = searchResponseAssessment(record, responses, policy);
    discoveryAssessments.push({ workQueueEntryKey: record.workQueueEntryKey, ...assessment });
    const requests = candidateRequests.find(item => item.workQueueEntryKey === record.workQueueEntryKey)?.requests || [];
    const resolutions = fetchedResolutions.filter(item => requests.some(request => request.requestedTitle === item.requestedTitle));
    const pages = sourcePages(requests, resolutions, contentHash);
    const resolvedRequestTitles = new Set(resolutions.map(item => item.requestedTitle));
    const missingRequestTitles = requests.filter(request => !resolvedRequestTitles.has(request.requestedTitle)).map(request => request.requestedTitle);
    sourceGroups.push({ workQueueEntryKey: record.workQueueEntryKey, requests, pages, missingRequestTitles });
    records.push(makeRecord(record, responses, requests, pages, pinnedRows, policy, sourceQueueSnapshotContentHash, contentHash));
  }
  const failures = [];
  if (!compiled.valid) failures.push('source_discovery_policy_invalid_or_candidate_specific');
  if (!workQueueRecords.length) failures.push('no_additional_evidence_work_entries');
  if (duplicateInputKeys.length) failures.push('duplicate_input_work_queue_keys');
  if (!queueOrderValid) failures.push('input_queue_order_invalid');
  if (inputAssessments.some(item => !item.integrity.complete)) failures.push('one_or_more_input_work_queue_entries_failed_revalidation');
  if (pinnedRows.some(row => !row.complete)) failures.push('one_or_more_pinned_sources_failed_exact_revision_revalidation');
  if (discoveryAssessments.some(item => !item.complete)) failures.push('one_or_more_source_searches_missing_truncated_or_mismatched');
  if (sourceGroups.some(group => group.requests.length === 0 || group.pages.length === 0 || group.missingRequestTitles.length > 0 || group.pages.some(page => !page.complete))) failures.push('one_or_more_discovered_or_direct_source_pages_failed_revision_capture');
  if (accountStateFindings([...workQueueRecords, ...records]).length) failures.push('current_account_state_present');
  return { compiled, inputAssessments, duplicateInputKeys, queueOrderValid, pinnedRows, discoveryAssessments, sourceGroups, records, failures };
}

export function auditMultiVariantBindingAdditionalEvidenceSourceDiscovery(records = [], args = {}) {
  const flight = preflight(args);
  const expected = flight.failures.length ? [] : flight.records;
  const outputKeys = records.map(record => record.workQueueEntryKey);
  const inputKeys = args.workQueueRecords.map(record => record.workQueueEntryKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = inputKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !inputKeys.includes(key));
  const recordMismatches = records.filter((record, index) => !expected[index] || !same(record, expected[index])).map(record => record.evidencePacketKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.reviewCandidateVariantIndex !== null || record.bindingReviewDecision !== null || record.boundVariantIndex !== null
    || record.evidenceReviewer !== null || record.evidenceReviewedAt !== null || record.evidenceNotes !== null
    || record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null
    || record.weightedTaskEntryMembershipVerdict !== null || record.repeatabilityVerdict !== null
    || record.mechanicsReviewComplete !== false || record.mappingVerdict !== null
    || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).map(record => record.evidencePacketKey || 'unknown');
  const accountFindings = accountStateFindings([...args.workQueueRecords, ...records]);
  const failures = [...flight.failures];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) failures.push('input_and_output_packet_sets_do_not_match_exactly');
  if (recordMismatches.length) failures.push('one_or_more_output_packets_do_not_match_source_discovery_inputs');
  if (unsupportedPromotions.length) failures.push('source_discovery_created_unsupported_review_binding_semantic_or_optimizer_promotion');
  if (accountFindings.length) failures.push('current_account_state_present');
  const exactAlignments = records.flatMap(record => record.exactTaskToNumberedVariantAlignmentObservations || []);
  const candidateContexts = records.flatMap(record => record.candidateScopedParentContextObservations || []);
  const allChannelsSatisfied = records.length > 0 && records.every(record => (record.requiredChannelStatus || []).every(channel => channel.satisfiedByCapturedEvidence));
  const publishable = failures.length === 0;
  return {
    contract: args.policy.auditContract,
    inputCoverage: {
      inputWorkQueueEntryCount: args.workQueueRecords.length,
      completeInputWorkQueueEntryCount: flight.inputAssessments.filter(item => item.integrity.complete).length,
      failedInputWorkQueueEntryKeys: flight.inputAssessments.filter(item => !item.integrity.complete).map(item => item.workQueueEntryKey),
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
      queryCount: flight.discoveryAssessments.reduce((total, item) => total + item.rows.length, 0),
      completeQueryCount: flight.discoveryAssessments.reduce((total, item) => total + item.rows.filter(row => row.complete).length, 0),
      incompleteQueryKeys: flight.discoveryAssessments.flatMap(item => item.rows.filter(row => !row.complete).map(row => row.queryKey)),
      requestedCurrentSourceCount: unique(flight.sourceGroups.flatMap(group => group.requests.map(request => request.requestedTitle))).length,
      capturedDistinctCurrentSourceCount: unique(flight.sourceGroups.flatMap(group => group.pages.filter(page => page.complete).map(page => page.sourceKey))).length,
      failedCurrentSourceRequests: flight.sourceGroups.flatMap(group => [...group.missingRequestTitles, ...group.pages.filter(page => !page.complete).flatMap(page => page.requestedTitles)])
    },
    sourceAlignmentCoverage: {
      candidateScopedParentContextObservationCount: candidateContexts.length,
      numberedVariantIdentityObservationCount: records.reduce((total, record) => total + (record.numberedVariantIdentityObservations || []).length, 0),
      exactTaskToNumberedVariantAlignmentObservationCount: exactAlignments.length,
      recordsWithCandidateScopedParentContext: records.filter(record => record.candidateScopedParentContextObservations.length > 0).map(record => record.workQueueEntryKey),
      recordsWithExactTaskToNumberedVariantAlignment: records.filter(record => record.exactTaskToNumberedVariantAlignmentObservations.length > 0).map(record => record.workQueueEntryKey)
    },
    requiredChannelCoverage: {
      requiredChannelCount: (args.policy.discovery?.requiredAdditionalEvidenceChannels || []).length * records.length,
      satisfiedChannelCount: records.reduce((total, record) => total + record.requiredChannelStatus.filter(channel => channel.satisfiedByCapturedEvidence).length, 0),
      unsatisfiedChannels: records.flatMap(record => record.requiredChannelStatus.filter(channel => !channel.satisfiedByCapturedEvidence).map(channel => ({ workQueueEntryKey: record.workQueueEntryKey, channel: channel.channel }))),
      allChannelsSatisfied
    },
    semanticPreservationCoverage: {
      outputPacketCount: records.length,
      duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys, recordMismatches,
      reviewCandidateVariantIndexCount: records.filter(record => record.reviewCandidateVariantIndex !== null).length,
      boundVariantCount: records.filter(record => record.boundVariantIndex !== null).length,
      semanticVerdictCount: records.filter(record => record.candidateMemberIdentityVerdict !== null || record.parentMembershipVerdict !== null || record.repeatabilityVerdict !== null || record.mechanicsReviewComplete || record.mappingVerdict !== null || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    evidencePacketAttemptCoverageComplete: publishable,
    variantDisambiguationEvidenceComplete: publishable && allChannelsSatisfied,
    variantBindingReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...failures,
      ...(exactAlignments.length === records.length && records.length > 0 ? [] : ['one_or_more_exact_task_to_numbered_variant_alignments_not_observed']),
      'explicit_human_binding_review_pending',
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

export function buildMultiVariantBindingAdditionalEvidenceSourceDiscovery(args = {}) {
  const flight = preflight(args);
  const records = flight.failures.length === 0 ? flight.records : [];
  return { records, audit: auditMultiVariantBindingAdditionalEvidenceSourceDiscovery(records, args) };
}
