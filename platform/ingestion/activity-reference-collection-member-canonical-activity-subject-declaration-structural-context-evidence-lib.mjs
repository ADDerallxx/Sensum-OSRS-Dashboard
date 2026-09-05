import { maskRepeatabilityIgnoredRegions } from './activity-reference-collection-member-repeatability-evidence-lib.mjs';
import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = revision => revision?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceCanonicalActivitySubjectDeclarationExactLineEvidenceContentHash',
  'canonicalActivitySubjectDeclarationStructuralContextEvidence',
  'canonicalActivitySubjectDeclarationStructuralContextObservations',
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

export function compileCanonicalActivitySubjectDeclarationStructuralContextEvidencePolicy(policy = {}) {
  const required = [
    'onePacketPerCompleteExactLineEvidenceRecord',
    'everyRetainedCandidateRevisionIsFetchedExactlyOnce',
    'fetchedPageIdentityRevisionTimestampUrlAndHashMustAlign',
    'everyInputOccurrenceMustRevalidateAtItsExactOffsetsLinesColumnsTextAndHash',
    'everyOccurrenceRetainsHeadingLeadParagraphListTableLinkTemplateAndParameterContext',
    'balancedLinkTemplateAndTableDelimitersAreRequired',
    'commentsAndProtectedRegionsRemainExplicitlyNonActive',
    'structuralContextIsObservationOnlyAndCannotSelectSemanticVerdicts',
    'templateNamesParameterNamesHeadingsMarkersAndPagePositionCannotSelectAVerdict',
    'upstreamEvidenceIdentityOccurrencesDispositionsAndReviewsRemainUnchanged',
    'memberExpansionMechanicsAndOptimizerEligibilityRemainClosed',
    'missingContradictoryTruncatedOrConditionMismatchedEvidenceRemainsExplicit',
    'activitySpecificNamesTitlesPageIdsLabelsAliasesAndOverridesCannotSelectAVerdict',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = required.filter(rule => policy.rules?.[rule] !== true);
  if (policy.evidenceChannel !== 'revision_pinned_exact_occurrence_structural_parent_inventory') invalidRules.push('structural_context_evidence_channel_not_configured');
  if (!policy.inputContract || !policy.recordContract || !policy.auditContract || !policy.inputState) invalidRules.push('structural_context_contract_boundary_missing');
  return { policyId: policy.policy || null, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbiddenPolicyPaths(policy) };
}

function routeMatches(record, policy) {
  const evidence = record.canonicalActivitySubjectDeclarationExactLineEvidence || {};
  const review = record.canonicalActivitySubjectDeclarationReview || {};
  return record.contract === policy.inputContract
    && record.state === policy.inputState
    && evidence.evidenceState === 'complete_revision_pinned_subject_declaration_exact_line_evidence_packet'
    && review.state === 'unreviewed_exact_line_evidence_collected_semantic_disposition_required'
    && review.canonicalActivitySubjectDeclarationVerdict === null
    && review.canonicalActivityScopeVerdict === null
    && review.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true;
}

export function selectCanonicalActivitySubjectDeclarationStructuralContextEvidenceRoutes(records = [], policy = {}) {
  return records.filter(record => routeMatches(record, policy));
}

function candidatePackets(record = {}) {
  return record.canonicalActivitySubjectDeclarationExactLineEvidence?.candidateEvidencePackets || [];
}

export function discoverCanonicalActivitySubjectDeclarationStructuralContextRevisionRequests(records = [], policy = {}) {
  const requests = new Map();
  for (const record of selectCanonicalActivitySubjectDeclarationStructuralContextEvidenceRoutes(records, policy)) {
    for (const packet of candidatePackets(record)) {
      const source = packet.discoveryCandidate?.revisionEvidence || {};
      if (!source.sourceRevision) continue;
      const key = String(source.sourceRevision);
      const current = requests.get(key) || {
        sourceRevision: key,
        sourcePageId: Number(source.sourcePageId || 0) || null,
        resolvedTitle: source.resolvedTitle || null,
        sourceTimestamp: source.sourceTimestamp || null,
        sourceUrl: source.sourceUrl || null,
        sourceContentHash: source.sourceContentHash || null,
        occurrenceContexts: []
      };
      for (const occurrence of packet.exactPhraseOccurrences || []) {
        current.occurrenceContexts.push({
          memberCandidateKey: record.memberCandidateKey,
          candidateEvidenceKey: packet.candidateEvidenceKey,
          occurrenceKey: occurrence.occurrenceKey
        });
      }
      current.occurrenceContexts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      requests.set(key, current);
    }
  }
  return [...requests.values()].sort((a, b) => Number(a.sourcePageId) - Number(b.sourcePageId) || a.sourceRevision.localeCompare(b.sourceRevision));
}

function fetchedByRevision(fetchedPages = []) {
  return new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
}

function lineIndex(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === '\n') starts.push(index + 1);
  const lines = text.split(/\r?\n/);
  return { starts, lines };
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

function locator(text, starts, start, endExclusive) {
  const lineStart = lineNumberAt(starts, start);
  const lineEnd = lineNumberAt(starts, Math.max(start, endExclusive - 1));
  return {
    absoluteOffsetStart: start,
    absoluteOffsetEnd: endExclusive - 1,
    lineStart,
    lineEnd,
    columnStart: start - starts[lineStart - 1] + 1,
    columnEnd: endExclusive - 1 - starts[lineEnd - 1] + 1
  };
}

function spanEvidence(text, starts, start, endExclusive, contentHash) {
  const exactSource = text.slice(start, endExclusive);
  return { sourceLocator: locator(text, starts, start, endExclusive), exactSource, exactSourceContentHash: contentHash(exactSource) };
}

function splitTopLevelSpans(text, start, end, delimiter = '|') {
  const boundaries = [start];
  let curly = 0;
  let square = 0;
  for (let index = start; index < end;) {
    if (text.startsWith('{{{', index)) { curly++; index += 3; continue; }
    if (text.startsWith('{{', index)) { curly++; index += 2; continue; }
    if (text.startsWith('}}}', index) && curly > 0) { curly--; index += 3; continue; }
    if (text.startsWith('}}', index) && curly > 0) { curly--; index += 2; continue; }
    if (text.startsWith('[[', index)) { square++; index += 2; continue; }
    if (text.startsWith(']]', index) && square > 0) { square--; index += 2; continue; }
    if (text[index] === delimiter && curly === 0 && square === 0) boundaries.push(index + 1);
    index++;
  }
  return boundaries.map((segmentStart, index) => ({ start: segmentStart, end: index + 1 < boundaries.length ? boundaries[index + 1] - 1 : end }));
}

function topLevelEquals(text, start, end) {
  let curly = 0;
  let square = 0;
  for (let index = start; index < end;) {
    if (text.startsWith('{{{', index)) { curly++; index += 3; continue; }
    if (text.startsWith('{{', index)) { curly++; index += 2; continue; }
    if (text.startsWith('}}}', index) && curly > 0) { curly--; index += 3; continue; }
    if (text.startsWith('}}', index) && curly > 0) { curly--; index += 2; continue; }
    if (text.startsWith('[[', index)) { square++; index += 2; continue; }
    if (text.startsWith(']]', index) && square > 0) { square--; index += 2; continue; }
    if (text[index] === '=' && curly === 0 && square === 0) return index;
    index++;
  }
  return -1;
}

function templateParameterContext(text, template, occurrenceStart) {
  const segments = splitTopLevelSpans(text, template.start + 2, template.end - 2);
  const segmentIndex = segments.findIndex(segment => occurrenceStart >= segment.start && occurrenceStart < segment.end);
  if (segmentIndex < 0) return { role: 'template_delimiter_or_unresolved_segment', parameterOrdinal: null, parameterName: null };
  if (segmentIndex === 0) return { role: 'template_name', parameterOrdinal: null, parameterName: null };
  const segment = segments[segmentIndex];
  const equals = topLevelEquals(text, segment.start, segment.end);
  return {
    role: equals >= 0 && occurrenceStart > equals ? 'named_parameter_value' : equals >= 0 ? 'named_parameter_name' : 'positional_parameter',
    parameterOrdinal: segmentIndex,
    parameterName: equals >= 0 ? text.slice(segment.start, equals).trim() || null : null
  };
}

function parseTemplates(text, masked, starts, contentHash) {
  const stack = [];
  const templates = [];
  const parameters = [];
  const unmatchedClosing = [];
  for (let index = 0; index < masked.length;) {
    if (masked.startsWith('{{{', index)) { stack.push({ kind: 'parameter', start: index }); index += 3; continue; }
    if (masked.startsWith('{{', index)) { stack.push({ kind: 'template', start: index }); index += 2; continue; }
    if (masked.startsWith('}}}', index) && stack.at(-1)?.kind === 'parameter') {
      const opened = stack.pop();
      const end = index + 3;
      parameters.push({ kind: 'template_parameter_reference', ...spanEvidence(text, starts, opened.start, end, contentHash) });
      index = end;
      continue;
    }
    if (masked.startsWith('}}', index) && stack.at(-1)?.kind === 'template') {
      const opened = stack.pop();
      const end = index + 2;
      const nameSegment = splitTopLevelSpans(text, opened.start + 2, index)[0];
      templates.push({
        kind: 'template_invocation',
        templateName: nameSegment ? text.slice(nameSegment.start, nameSegment.end).trim().replace(/^subst\s*:/i, '') || null : null,
        start: opened.start,
        end,
        ...spanEvidence(text, starts, opened.start, end, contentHash)
      });
      index = end;
      continue;
    }
    if (masked.startsWith('}}', index)) { unmatchedClosing.push(index); index += 2; continue; }
    index++;
  }
  return {
    templates,
    parameters,
    audit: {
      unclosedDelimiterCount: stack.length,
      unmatchedClosingDelimiterCount: unmatchedClosing.length,
      balanced: stack.length === 0 && unmatchedClosing.length === 0
    }
  };
}

function parseLinks(text, masked, starts, contentHash) {
  const links = [];
  let ordinal = 0;
  for (const match of masked.matchAll(/\[\[([^\[\]]+?)\]\]/g)) {
    ordinal++;
    const start = match.index;
    const end = start + match[0].length;
    const segments = splitTopLevelSpans(text, start + 2, end - 2);
    links.push({ ordinal, start, end, segments, ...spanEvidence(text, starts, start, end, contentHash) });
  }
  const openCount = (masked.match(/\[\[/g) || []).length;
  const closeCount = (masked.match(/\]\]/g) || []).length;
  return { links, audit: { openCount, closeCount, balanced: openCount === closeCount } };
}

function linkSegmentContext(text, link, occurrenceStart) {
  const segmentIndex = link.segments.findIndex(segment => occurrenceStart >= segment.start && occurrenceStart < segment.end);
  if (segmentIndex < 0) return { role: 'link_delimiter_or_unresolved_segment', segmentOrdinal: null, optionName: null };
  if (segmentIndex === 0) return { role: 'link_target', segmentOrdinal: 0, optionName: null };
  const segment = link.segments[segmentIndex];
  const equals = topLevelEquals(text, segment.start, segment.end);
  return {
    role: equals >= 0 && occurrenceStart > equals ? 'link_option_value' : equals >= 0 ? 'link_option_name' : 'link_display_or_positional_value',
    segmentOrdinal: segmentIndex,
    optionName: equals >= 0 ? text.slice(segment.start, equals).trim() || null : null
  };
}

function parseTables(text, masked, starts, contentHash) {
  const stack = [];
  const tables = [];
  const unmatchedClosing = [];
  const expression = /\{\||\|\}/g;
  for (const match of masked.matchAll(expression)) {
    if (match[0] === '{|') stack.push({ start: match.index });
    else if (stack.length) {
      const opened = stack.pop();
      const end = match.index + 2;
      tables.push({ start: opened.start, end, ...spanEvidence(text, starts, opened.start, end, contentHash) });
    } else unmatchedClosing.push(match.index);
  }
  return { tables, audit: { unclosedDelimiterCount: stack.length, unmatchedClosingDelimiterCount: unmatchedClosing.length, balanced: stack.length === 0 && unmatchedClosing.length === 0 } };
}

function headingsBefore(text, masked, starts, occurrenceStart, contentHash) {
  const hierarchy = [];
  const stack = [];
  let firstHeadingStart = null;
  for (let line = 0; line < starts.length; line++) {
    const start = starts[line];
    const end = line + 1 < starts.length ? starts[line + 1] - 1 : text.length;
    if (start >= occurrenceStart) break;
    const raw = masked.slice(start, end).replace(/\r$/, '');
    const match = /^(={1,6})\s*(.*?)\s*\1\s*$/.exec(raw);
    if (!match) continue;
    if (firstHeadingStart === null) firstHeadingStart = start;
    const level = match[1].length;
    const exactSource = text.slice(start, end).replace(/\r$/, '');
    const heading = { level, headingText: match[2].trim(), ...spanEvidence(text, starts, start, start + exactSource.length, contentHash) };
    while (stack.length && stack.at(-1).level >= level) stack.pop();
    stack.push(heading);
  }
  hierarchy.push(...stack);
  if (firstHeadingStart === null) {
    const first = masked.match(/^={1,6}[^\r\n]*={1,6}\s*$/m);
    firstHeadingStart = first?.index ?? null;
  }
  return { hierarchy, beforeFirstHeading: firstHeadingStart === null || occurrenceStart < firstHeadingStart };
}

function lineBounds(index, lineNumber, text) {
  const start = index.starts[lineNumber - 1];
  const end = lineNumber < index.starts.length ? index.starts[lineNumber] - 1 : text.length;
  return { start, end: end > start && text[end - 1] === '\r' ? end - 1 : end };
}

function sourceBlock(text, masked, index, occurrenceLine, contentHash) {
  let first = occurrenceLine;
  let last = occurrenceLine;
  const usable = line => {
    const bounds = lineBounds(index, line, text);
    return masked.slice(bounds.start, bounds.end).trim() !== '';
  };
  while (first > 1 && usable(first - 1)) first--;
  while (last < index.lines.length && usable(last + 1)) last++;
  const start = lineBounds(index, first, text).start;
  const end = lineBounds(index, last, text).end;
  return { blockKind: 'contiguous_nonblank_source_block', ...spanEvidence(text, index.starts, start, end, contentHash) };
}

function tableContext(text, index, table, occurrenceStart, occurrenceLine, contentHash) {
  if (!table) return null;
  const tableStartLine = table.sourceLocator.lineStart;
  const tableEndLine = table.sourceLocator.lineEnd;
  let rowStartLine = tableStartLine;
  let rowEndLine = tableEndLine;
  for (let line = tableStartLine; line <= occurrenceLine; line++) {
    const bounds = lineBounds(index, line, text);
    if (/^\s*\|-/.test(text.slice(bounds.start, bounds.end))) rowStartLine = line;
  }
  for (let line = occurrenceLine + 1; line <= tableEndLine; line++) {
    const bounds = lineBounds(index, line, text);
    if (/^\s*(?:\|-|\|\})/.test(text.slice(bounds.start, bounds.end))) { rowEndLine = line - 1; break; }
  }
  const rowStart = lineBounds(index, rowStartLine, text).start;
  const rowEnd = lineBounds(index, Math.max(rowStartLine, rowEndLine), text).end;
  const currentLine = lineBounds(index, occurrenceLine, text);
  const trimmed = text.slice(currentLine.start, currentLine.end).trimStart();
  return {
    table: { ...table, start: undefined, end: undefined },
    row: { ...spanEvidence(text, index.starts, rowStart, rowEnd, contentHash), rowStartMarkerPresent: /^\s*\|-/.test(text.slice(rowStart, rowEnd)) },
    occurrenceLineCellMarker: /^[|!]/.test(trimmed) ? trimmed[0] : null,
    occurrenceOffsetWithinTable: occurrenceStart - table.start
  };
}

function structuralContext(text, occurrence, parsed, contentHash) {
  const start = Number(occurrence.sourceLocator?.absoluteOffsetStart);
  const end = Number(occurrence.sourceLocator?.absoluteOffsetEnd) + 1;
  const occurrenceLine = occurrence.sourceLocator?.lineStart;
  const line = lineBounds(parsed.index, occurrenceLine, text);
  const rawLine = text.slice(line.start, line.end);
  const trimmed = rawLine.trimStart();
  const list = /^([*#;:]+)\s*/.exec(trimmed);
  const heading = headingsBefore(text, parsed.masked, parsed.index.starts, start, contentHash);
  const enclosingTemplates = parsed.templateParse.templates
    .filter(template => start >= template.start && end <= template.end)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .map(template => ({
      templateName: template.templateName,
      occurrenceRole: templateParameterContext(text, template, start),
      sourceLocator: template.sourceLocator,
      exactSource: template.exactSource,
      exactSourceContentHash: template.exactSourceContentHash
    }));
  const enclosingParameterReferences = parsed.templateParse.parameters
    .filter(parameter => start >= parameter.sourceLocator.absoluteOffsetStart && end - 1 <= parameter.sourceLocator.absoluteOffsetEnd)
    .map(parameter => parameter);
  const enclosingLinks = parsed.linkParse.links
    .filter(link => start >= link.start && end <= link.end)
    .map(link => ({
      linkOrdinal: link.ordinal,
      occurrenceRole: linkSegmentContext(text, link, start),
      sourceLocator: link.sourceLocator,
      exactSource: link.exactSource,
      exactSourceContentHash: link.exactSourceContentHash
    }));
  const enclosingTable = parsed.tableParse.tables
    .filter(table => start >= table.start && end <= table.end)
    .sort((a, b) => b.start - a.start)[0] || null;
  return {
    sourceRegionState: occurrence.sourceRegionState,
    pagePosition: { beforeFirstHeading: heading.beforeFirstHeading, headingHierarchy: heading.hierarchy },
    exactLine: {
      ...spanEvidence(text, parsed.index.starts, line.start, line.end, contentHash),
      leadingWhitespaceCount: rawLine.length - rawLine.trimStart().length,
      startsWithRedirectDirective: /^#redirect\b/i.test(trimmed),
      startsWithHeadingMarkup: /^={1,6}[^=]/.test(trimmed),
      startsWithTemplateParameterMarker: /^\|\s*[^|}]*=/.test(trimmed),
      startsWithTableCellMarker: Boolean(enclosingTable && /^[|!]/.test(trimmed)),
      listMarker: list?.[1] || null
    },
    contiguousSourceBlock: sourceBlock(text, parsed.masked, parsed.index, occurrenceLine, contentHash),
    enclosingTemplates,
    enclosingTemplateParameterReferences: enclosingParameterReferences,
    enclosingLinks,
    enclosingTable: tableContext(text, parsed.index, enclosingTable, start, occurrenceLine, contentHash),
    delimiterAudit: {
      templatesBalanced: parsed.templateParse.audit.balanced,
      linksBalanced: parsed.linkParse.audit.balanced,
      tablesBalanced: parsed.tableParse.audit.balanced
    },
    canonicalActivitySubjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    semanticUse: occurrence.sourceRegionState === 'active_source_text'
      ? 'revision_pinned_structural_observation_requires_semantic_disposition'
      : 'protected_or_mixed_source_observation_cannot_support_semantic_binding'
  };
}

function parsedDocument(text, contentHash) {
  const masked = maskRepeatabilityIgnoredRegions(text);
  const index = lineIndex(text);
  return {
    masked,
    index,
    templateParse: parseTemplates(text, masked, index.starts, contentHash),
    linkParse: parseLinks(text, masked, index.starts, contentHash),
    tableParse: parseTables(text, masked, index.starts, contentHash)
  };
}

function revalidateOccurrence(text, occurrence, parsed, contentHash) {
  const start = Number(occurrence.sourceLocator?.absoluteOffsetStart);
  const end = Number(occurrence.sourceLocator?.absoluteOffsetEnd) + 1;
  const actual = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start ? text.slice(start, end) : null;
  const actualLocator = actual !== null ? locator(text, parsed.index.starts, start, end) : null;
  const lineStart = actualLocator?.lineStart;
  const lineEnd = actualLocator?.lineEnd;
  const actualLines = actualLocator ? parsed.index.lines.slice(lineStart - 1, lineEnd).join('\n') : null;
  const regionSlice = actual !== null ? parsed.masked.slice(start, end) : '';
  const fullyActive = actual !== null && regionSlice.toLocaleLowerCase('en') === actual.toLocaleLowerCase('en');
  const fullyMasked = actual !== null && regionSlice.replace(/[\r\n ]/g, '') === '';
  const actualRegionState = fullyActive ? 'active_source_text' : fullyMasked ? 'protected_or_ignored_source_region' : 'mixed_active_and_protected_source_region';
  const expectedLocator = occurrence.sourceLocator || {};
  const locatorMatches = actualLocator !== null
    && Number(actualLocator.absoluteOffsetStart) === Number(expectedLocator.absoluteOffsetStart)
    && Number(actualLocator.absoluteOffsetEnd) === Number(expectedLocator.absoluteOffsetEnd)
    && Number(actualLocator.lineStart) === Number(expectedLocator.lineStart)
    && Number(actualLocator.lineEnd) === Number(expectedLocator.lineEnd)
    && Number(actualLocator.columnStart) === Number(expectedLocator.columnStart)
    && Number(actualLocator.columnEnd) === Number(expectedLocator.columnEnd);
  return {
    absoluteOffsetsMatch: actual !== null && actual === occurrence.matchedText,
    lineAndColumnLocatorMatches: locatorMatches,
    exactSourceLinesMatch: actualLines === occurrence.exactSourceLines,
    exactSourceLinesHashMatches: actualLines !== null && contentHash(actualLines) === occurrence.exactSourceLinesContentHash,
    sourceRegionStateMatches: actualRegionState === occurrence.sourceRegionState,
    exactCaseFlagMatches: actual !== null && (actual === occurrence.exactPhrase) === occurrence.canonicalActivityLabelExactCaseMatch,
    actualMatchedText: actual,
    actualSourceLocator: actualLocator,
    actualExactSourceLines: actualLines,
    actualExactSourceLinesContentHash: actualLines === null ? null : contentHash(actualLines),
    actualSourceRegionState: actualRegionState
  };
}

function sourceVerification(source, fetched, contentHash) {
  const page = fetched?.page || null;
  const revision = fetched?.revision || null;
  const content = sourceContent(revision);
  const computedHash = typeof content === 'string' ? contentHash(content) : null;
  return {
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
}

function expectedRecord(input, fetchedPages, policy, contentHash) {
  const compiled = compileCanonicalActivitySubjectDeclarationStructuralContextEvidencePolicy(policy);
  const fetched = fetchedByRevision(fetchedPages);
  const contexts = [];
  for (const candidate of candidatePackets(input)) {
    const source = candidate.discoveryCandidate?.revisionEvidence || {};
    const fetchedRevision = fetched.get(String(source.sourceRevision || ''));
    const verification = sourceVerification(source, fetchedRevision, contentHash);
    const text = sourceContent(fetchedRevision?.revision);
    const parsed = typeof text === 'string' ? parsedDocument(text, contentHash) : null;
    for (const occurrence of candidate.exactPhraseOccurrences || []) {
      const revalidation = parsed ? revalidateOccurrence(text, { ...occurrence, exactPhrase: candidate.exactPhrase }, parsed, contentHash) : null;
      const context = parsed && revalidation ? structuralContext(text, occurrence, parsed, contentHash) : null;
      const deficiencies = [];
      if (!Object.values(verification).every(Boolean)) deficiencies.push('candidate_exact_revision_page_identity_timestamp_url_or_hash_alignment_failed');
      if (!revalidation || !Object.entries(revalidation).filter(([key]) => key.endsWith('Match') || key.endsWith('Matches')).every(([, value]) => value === true)) deficiencies.push('exact_line_occurrence_revalidation_failed');
      if (!context) deficiencies.push('structural_context_not_collected');
      if (context && !Object.values(context.delimiterAudit).every(Boolean)) deficiencies.push('source_structural_delimiters_unbalanced');
      contexts.push({
        structuralContextEvidenceKey: `${occurrence.occurrenceKey}:structural-context-v1`,
        candidateEvidenceKey: candidate.candidateEvidenceKey,
        occurrenceKey: occurrence.occurrenceKey,
        sourceRevisionEvidence: source,
        sourceRevisionVerification: verification,
        sourceExactLineOccurrence: occurrence,
        exactOccurrenceRevalidation: revalidation,
        structuralContext: context,
        canonicalActivitySubjectDeclarationVerdict: null,
        canonicalActivityScopeVerdict: null,
        repeatabilityVerdict: null,
        deficiencies,
        state: deficiencies.length ? 'blocked_incomplete_structural_context_evidence' : 'complete_revision_pinned_structural_context_evidence'
      });
    }
  }
  contexts.sort((a, b) => a.occurrenceKey.localeCompare(b.occurrenceKey));
  const deficiencies = [];
  if (!input.contentHash) deficiencies.push('exact_line_evidence_content_hash_missing');
  if (!routeMatches(input, policy)) deficiencies.push('input_does_not_match_complete_exact_line_evidence_state');
  if (!contexts.length) deficiencies.push('exact_line_evidence_contains_no_occurrences');
  if (duplicates(contexts.map(context => context.occurrenceKey)).length) deficiencies.push('duplicate_structural_context_occurrence_key');
  if (contexts.some(context => context.deficiencies.length)) deficiencies.push('one_or_more_structural_context_packets_incomplete');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) deficiencies.push('canonical_activity_subject_declaration_structural_context_policy_invalid_or_activity_specific');
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceCanonicalActivitySubjectDeclarationExactLineEvidenceContentHash: input.contentHash,
    canonicalActivitySubjectDeclarationStructuralContextEvidence: {
      evidenceState: deficiencies.length ? 'incomplete_revision_pinned_subject_declaration_structural_context_evidence_packet' : 'complete_revision_pinned_subject_declaration_structural_context_evidence_packet',
      evidenceChannel: policy.evidenceChannel,
      canonicalActivityKey: input.canonicalActivityIdentity?.canonicalActivityKey || null,
      occurrenceStructuralContextPackets: contexts
    },
    canonicalActivitySubjectDeclarationStructuralContextObservations: {
      occurrenceCount: contexts.length,
      exactOccurrenceRevalidatedCount: contexts.filter(context => context.exactOccurrenceRevalidation && Object.entries(context.exactOccurrenceRevalidation).filter(([key]) => key.endsWith('Match') || key.endsWith('Matches')).every(([, value]) => value === true)).length,
      activeSourceOccurrenceCount: contexts.filter(context => context.structuralContext?.sourceRegionState === 'active_source_text').length,
      beforeFirstHeadingCount: contexts.filter(context => context.structuralContext?.pagePosition?.beforeFirstHeading).length,
      headingScopedCount: contexts.filter(context => context.structuralContext?.pagePosition?.headingHierarchy?.length).length,
      templateContainedCount: contexts.filter(context => context.structuralContext?.enclosingTemplates?.length).length,
      linkContainedCount: contexts.filter(context => context.structuralContext?.enclosingLinks?.length).length,
      tableContainedCount: contexts.filter(context => context.structuralContext?.enclosingTable).length,
      listMarkedCount: contexts.filter(context => context.structuralContext?.exactLine?.listMarker).length,
      redirectDirectiveCount: contexts.filter(context => context.structuralContext?.exactLine?.startsWithRedirectDirective).length,
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      deficiencies
    },
    canonicalActivitySubjectDeclarationReview: {
      state: 'unreviewed_structural_context_evidence_collected_semantic_disposition_required',
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: []
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => blocker !== 'canonical_activity_subject_declaration_exact_line_evidence_requires_semantic_disposition'),
      ...deficiencies,
      'canonical_activity_subject_declaration_structural_context_requires_semantic_disposition',
      'canonical_activity_subject_binding_unresolved',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: deficiencies.length ? 'canonical_activity_subject_declaration_structural_context_evidence_blocked_incomplete' : 'canonical_activity_subject_declaration_structural_context_evidence_ready_for_semantic_disposition'
  };
}

export function buildCanonicalActivitySubjectDeclarationStructuralContextEvidence({ exactLineRecords = [], fetchedPages = [], policy = {}, contentHash = value => value }) {
  const routes = selectCanonicalActivitySubjectDeclarationStructuralContextEvidenceRoutes(exactLineRecords, policy);
  const records = routes.map(record => expectedRecord(record, fetchedPages, policy, contentHash));
  return { records, audit: auditCanonicalActivitySubjectDeclarationStructuralContextEvidence(records, { exactLineRecords, fetchedPages, policy, contentHash }) };
}

export function auditCanonicalActivitySubjectDeclarationStructuralContextEvidence(records = [], { exactLineRecords = [], fetchedPages = [], policy = {}, contentHash = value => value } = {}) {
  const inputs = selectCanonicalActivitySubjectDeclarationStructuralContextEvidenceRoutes(exactLineRecords, policy);
  const expected = inputs.map(record => expectedRecord(record, fetchedPages, policy, contentHash));
  const expectedKeys = inputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const inputByKey = new Map(inputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || record.sourceCanonicalActivitySubjectDeclarationExactLineEvidenceContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const structuralEvidenceMismatches = records.filter(record => {
    const target = expectedByKey.get(record.memberCandidateKey);
    return !target
      || JSON.stringify(record.canonicalActivitySubjectDeclarationStructuralContextEvidence) !== JSON.stringify(target.canonicalActivitySubjectDeclarationStructuralContextEvidence)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationStructuralContextObservations) !== JSON.stringify(target.canonicalActivitySubjectDeclarationStructuralContextObservations);
  }).map(record => record.memberCandidateKey);
  const inputOccurrences = inputs.flatMap(record => candidatePackets(record).flatMap(packet => packet.exactPhraseOccurrences || []));
  const outputPackets = records.flatMap(record => record.canonicalActivitySubjectDeclarationStructuralContextEvidence?.occurrenceStructuralContextPackets || []);
  const inputOccurrenceKeys = inputOccurrences.map(occurrence => occurrence.occurrenceKey);
  const outputOccurrenceKeys = outputPackets.map(packet => packet.occurrenceKey);
  const missingOccurrences = inputOccurrenceKeys.filter(key => !outputOccurrenceKeys.includes(key));
  const unexpectedOccurrences = outputOccurrenceKeys.filter(key => !inputOccurrenceKeys.includes(key));
  const requests = discoverCanonicalActivitySubjectDeclarationStructuralContextRevisionRequests(inputs, policy);
  const expectedRevisionIds = requests.map(request => request.sourceRevision);
  const fetchedRows = fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({ page, revision })));
  const fetchedRevisionIds = fetchedRows.map(row => String(row.revision.revid || '')).filter(Boolean);
  const missingRevisionIds = expectedRevisionIds.filter(revision => !fetchedRevisionIds.includes(revision));
  const unexpectedRevisionIds = fetchedRevisionIds.filter(revision => !expectedRevisionIds.includes(revision));
  const duplicateFetchedRevisionIds = duplicates(fetchedRevisionIds);
  const incompleteRecords = records.filter(record => record.canonicalActivitySubjectDeclarationStructuralContextEvidence?.evidenceState !== 'complete_revision_pinned_subject_declaration_structural_context_evidence_packet').map(record => record.memberCandidateKey);
  const exactRevalidationFailures = outputPackets.filter(packet => !packet.exactOccurrenceRevalidation || Object.entries(packet.exactOccurrenceRevalidation).filter(([key]) => key.endsWith('Match') || key.endsWith('Matches')).some(([, value]) => value !== true)).map(packet => packet.occurrenceKey);
  const unbalancedPackets = outputPackets.filter(packet => packet.structuralContext && !Object.values(packet.structuralContext.delimiterAudit || {}).every(Boolean)).map(packet => packet.occurrenceKey);
  const unsupportedPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    const packets = record.canonicalActivitySubjectDeclarationStructuralContextEvidence?.occurrenceStructuralContextPackets || [];
    return !input
      || record.canonicalActivitySubjectDeclarationStructuralContextObservations?.canonicalActivitySubjectDeclarationVerdict !== null
      || record.canonicalActivitySubjectDeclarationStructuralContextObservations?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationStructuralContextObservations?.repeatabilityVerdict !== null
      || packets.some(packet => packet.canonicalActivitySubjectDeclarationVerdict !== null || packet.canonicalActivityScopeVerdict !== null || packet.repeatabilityVerdict !== null
        || packet.structuralContext?.canonicalActivitySubjectDeclarationVerdict !== null
        || packet.structuralContext?.canonicalActivityScopeVerdict !== null
        || packet.structuralContext?.repeatabilityVerdict !== null)
      || record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict !== null
      || record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict !== null
      || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const compiled = compileCanonicalActivitySubjectDeclarationStructuralContextEvidencePolicy(policy);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structural = [];
  if (!expectedKeys.length) structural.push('no_complete_exact_line_evidence_inputs');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structural.push('input_and_output_structural_context_record_sets_do_not_match_exactly');
  if (contextMismatches.length) structural.push('upstream_evidence_identity_occurrences_disposition_or_review_changed');
  if (structuralEvidenceMismatches.length) structural.push('one_or_more_structural_context_packets_not_reproducible');
  if (missingOccurrences.length || unexpectedOccurrences.length || duplicates(inputOccurrenceKeys).length || duplicates(outputOccurrenceKeys).length) structural.push('exact_line_and_structural_context_occurrence_sets_do_not_match');
  if (missingRevisionIds.length || unexpectedRevisionIds.length || duplicateFetchedRevisionIds.length) structural.push('exact_candidate_revision_fetch_set_mismatch');
  if (exactRevalidationFailures.length) structural.push('one_or_more_exact_line_occurrences_failed_revision_revalidation');
  if (unbalancedPackets.length) structural.push('one_or_more_structural_sources_have_unbalanced_delimiters');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length) structural.push('canonical_activity_subject_declaration_structural_context_policy_invalid_or_activity_specific');
  if (incompleteRecords.length) structural.push('one_or_more_subject_declaration_structural_context_evidence_records_incomplete');
  if (unsupportedPromotions.length) structural.push('structural_context_evidence_created_unsupported_semantic_or_downstream_promotion');
  if (accountStateFindings.length) structural.push('account_query_state_baked_into_subject_declaration_structural_context_evidence');
  const attemptComplete = expectedKeys.length > 0 && inputOccurrenceKeys.length > 0
    && !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length
    && !missingOccurrences.length && !unexpectedOccurrences.length && !duplicates(inputOccurrenceKeys).length && !duplicates(outputOccurrenceKeys).length;
  const complete = attemptComplete && !structural.length;
  return {
    contract: policy.auditContract,
    accountIndependent: !accountStateFindings.length,
    inputCoverage: { expectedRecordCount: expectedKeys.length, outputRecordCount: records.length, duplicateInputMemberCandidateKeys: duplicateInputKeys, duplicateOutputMemberCandidateKeys: duplicateOutputKeys, missingMemberCandidateKeys: missingKeys, unexpectedMemberCandidateKeys: unexpectedKeys, contextMismatchMemberCandidateKeys: contextMismatches },
    policyCoverage: compiled,
    revisionCoverage: { requestedExactRevisionCount: expectedRevisionIds.length, fetchedExactRevisionCount: fetchedRevisionIds.length, missingRevisionIds, unexpectedRevisionIds, duplicateFetchedRevisionIds, totalFetchedSourceBytes: fetchedRows.reduce((sum, row) => sum + Buffer.byteLength(sourceContent(row.revision) || '', 'utf8'), 0), exactRevisionFetchSetMatch: !missingRevisionIds.length && !unexpectedRevisionIds.length && !duplicateFetchedRevisionIds.length },
    occurrenceCoverage: { inputExactLineOccurrenceCount: inputOccurrenceKeys.length, outputStructuralContextPacketCount: outputOccurrenceKeys.length, missingOccurrenceKeys: missingOccurrences, unexpectedOccurrenceKeys: unexpectedOccurrences, duplicateInputOccurrenceKeys: duplicates(inputOccurrenceKeys), duplicateOutputOccurrenceKeys: duplicates(outputOccurrenceKeys), exactOccurrenceSetMatch: !missingOccurrences.length && !unexpectedOccurrences.length && !duplicates(inputOccurrenceKeys).length && !duplicates(outputOccurrenceKeys).length, exactOccurrenceRevalidatedCount: outputOccurrenceKeys.length - exactRevalidationFailures.length, exactOccurrenceRevalidationFailureKeys: exactRevalidationFailures, structuralEvidenceMismatchMemberCandidateKeys: structuralEvidenceMismatches },
    structuralCoverage: {
      activeSourceOccurrenceCount: outputPackets.filter(packet => packet.structuralContext?.sourceRegionState === 'active_source_text').length,
      protectedOrMixedOccurrenceCount: outputPackets.filter(packet => packet.structuralContext && packet.structuralContext.sourceRegionState !== 'active_source_text').length,
      beforeFirstHeadingCount: outputPackets.filter(packet => packet.structuralContext?.pagePosition?.beforeFirstHeading).length,
      headingScopedCount: outputPackets.filter(packet => packet.structuralContext?.pagePosition?.headingHierarchy?.length).length,
      templateContainedCount: outputPackets.filter(packet => packet.structuralContext?.enclosingTemplates?.length).length,
      linkContainedCount: outputPackets.filter(packet => packet.structuralContext?.enclosingLinks?.length).length,
      tableContainedCount: outputPackets.filter(packet => packet.structuralContext?.enclosingTable).length,
      listMarkedCount: outputPackets.filter(packet => packet.structuralContext?.exactLine?.listMarker).length,
      redirectDirectiveCount: outputPackets.filter(packet => packet.structuralContext?.exactLine?.startsWithRedirectDirective).length,
      unbalancedDelimiterOccurrenceKeys: unbalancedPackets
    },
    semanticPromotionCoverage: { unsupportedPromotionMemberCandidateKeys: unsupportedPromotions, semanticSubjectBindingCount: 0, canonicalActivityScopeClassificationCount: 0, repeatabilityClassificationCount: 0, memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length, mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length, optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length },
    incompleteRecordMemberCandidateKeys: incompleteRecords,
    accountStateFindings,
    structuralContextEvidenceAttemptCoverageComplete: attemptComplete,
    canonicalActivitySubjectDeclarationStructuralContextEvidenceCoverageComplete: complete,
    canonicalActivitySubjectBindingReviewComplete: false,
    repeatabilityReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structural, 'canonical_activity_subject_declaration_structural_context_requires_semantic_disposition', 'canonical_activity_scope_review_incomplete', 'repeatability_classification_unresolved', 'member_expansion_not_reviewed', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable: complete
  };
}
