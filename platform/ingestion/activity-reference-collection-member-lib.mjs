import { hash } from './lib.mjs';
import { plainTextFromWiki } from '../transforms/activity-candidate-subject-disposition-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

function topLevelSplit(value, delimiter) {
  const parts = [];
  let start = 0;
  let linkDepth = 0;
  let templateDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const pair = value.slice(index, index + 2);
    if (pair === '[[') { linkDepth += 1; index += 1; continue; }
    if (pair === ']]' && linkDepth) { linkDepth -= 1; index += 1; continue; }
    if (pair === '{{') { templateDepth += 1; index += 1; continue; }
    if (pair === '}}' && templateDepth) { templateDepth -= 1; index += 1; continue; }
    if (!linkDepth && !templateDepth && value.slice(index, index + delimiter.length) === delimiter) {
      parts.push(value.slice(start, index));
      start = index + delimiter.length;
      index += delimiter.length - 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function cellValue(raw) {
  const parts = topLevelSplit(String(raw || ''), '|');
  if (parts.length < 2) return String(raw || '').trim();
  const prefix = parts[0].trim();
  if (!/(?:^|\s)(?:class|style|rowspan|colspan|align|valign|scope|data-sort-value)\s*=/i.test(prefix)) return String(raw || '').trim();
  return parts.slice(1).join('|').trim();
}

function cellSpan(raw, name) {
  const match = String(raw || '').match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:["'](\\d+)["']|(\\d+))`, 'i'));
  return Number(match?.[1] || match?.[2] || 1);
}

function parseHeading(line, lineNumber) {
  const match = String(line).match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
  return match ? { heading: plainTextFromWiki(match[2]), level: match[1].length, line: lineNumber } : null;
}

function tableBounds(lines) {
  const tables = [];
  const headings = [];
  let depth = 0;
  let start = null;
  let startHeadings = null;
  for (let index = 0; index < lines.length; index += 1) {
    const heading = parseHeading(lines[index], index + 1);
    if (heading && depth === 0) {
      while (headings.length && headings.at(-1).level >= heading.level) headings.pop();
      headings.push(heading);
    }
    const trimmed = lines[index].trim();
    if (trimmed.startsWith('{|')) {
      if (depth === 0) { start = index; startHeadings = headings.map(value => ({ ...value })); }
      depth += 1;
    }
    if (trimmed.startsWith('|}') && depth) {
      depth -= 1;
      if (depth === 0) {
        tables.push({ start, end: index, headings: startHeadings });
        start = null;
        startHeadings = null;
      }
    }
  }
  return { tables, balanced: depth === 0, headings };
}

function addCells(target, source, marker, lineNumber) {
  for (const part of topLevelSplit(source, marker === '!' ? '!!' : '||')) {
    target.push({
      raw: part.trim(),
      value: cellValue(part),
      lineStart: lineNumber,
      lineEnd: lineNumber
    });
  }
}

function parseTable(lines, bound) {
  const headerCells = [];
  const rows = [];
  let current = null;
  let sawData = false;
  const finish = end => {
    if (!current) return;
    current.lineEnd = end;
    if (current.cells.length) rows.push(current);
    current = null;
  };
  for (let index = bound.start + 1; index < bound.end; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('|-')) {
      finish(index);
      current = { lineStart: index + 1, lineEnd: index + 1, cells: [], rawLines: [rawLine] };
      continue;
    }
    if (trimmed.startsWith('!') && current) {
      addCells(current.cells, trimmed.slice(1), '!', index + 1);
      current.rawLines.push(rawLine);
      sawData = true;
      continue;
    }
    if (trimmed.startsWith('!') && !sawData) {
      addCells(headerCells, trimmed.slice(1), '!', index + 1);
      continue;
    }
    if (trimmed.startsWith('|') && !trimmed.startsWith('|+')) {
      if (!current) current = { lineStart: index + 1, lineEnd: index + 1, cells: [], rawLines: [] };
      addCells(current.cells, trimmed.slice(1), '|', index + 1);
      current.rawLines.push(rawLine);
      sawData = true;
      continue;
    }
    if (current && trimmed) {
      current.rawLines.push(rawLine);
      if (current.cells.length) {
        const last = current.cells.at(-1);
        last.raw += `\n${rawLine}`;
        last.value += `\n${rawLine}`;
        last.lineEnd = index + 1;
      }
    }
  }
  finish(bound.end);
  const logicalHeaders = [];
  for (const header of headerCells) {
    const label = plainTextFromWiki(header.value);
    const span = cellSpan(header.raw, 'colspan');
    for (let index = 0; index < span; index += 1) logicalHeaders.push(label);
  }
  let activeRowspans = new Map();
  for (const row of rows) {
    const occupied = new Set([...activeRowspans.entries()].filter(([, remaining]) => remaining > 0).map(([column]) => column));
    const introduced = new Map();
    let cursor = 0;
    for (const cell of row.cells) {
      while (occupied.has(cursor)) cursor += 1;
      const colspan = cellSpan(cell.raw, 'colspan');
      const rowspan = cellSpan(cell.raw, 'rowspan');
      cell.logicalIndexStart = cursor;
      cell.logicalIndexEnd = cursor + colspan - 1;
      cell.colspan = colspan;
      cell.rowspan = rowspan;
      for (let column = cell.logicalIndexStart; column <= cell.logicalIndexEnd; column += 1) {
        occupied.add(column);
        if (rowspan > 1) introduced.set(column, Math.max(introduced.get(column) || 0, rowspan - 1));
      }
      cursor = cell.logicalIndexEnd + 1;
    }
    const next = new Map();
    for (const [column, remaining] of activeRowspans) if (remaining > 1) next.set(column, remaining - 1);
    for (const [column, remaining] of introduced) next.set(column, Math.max(next.get(column) || 0, remaining));
    activeRowspans = next;
  }
  return { headerCells, logicalHeaders, rows };
}

function wikiLinks(raw, sourceLocator) {
  const links = [];
  const pattern = /\[\[([^\[\]]+)\]\]/g;
  let match;
  while ((match = pattern.exec(String(raw || '')))) {
    const parts = topLevelSplit(match[1], '|');
    const targetWithFragment = parts[0].trim().replace(/^:/, '');
    const namespace = targetWithFragment.match(/^([^:#]+):/)?.[1]?.toLowerCase() || null;
    if (namespace && ['file', 'image', 'category', 'template', 'help', 'user', 'talk', 'module', 'special', 'mediawiki'].includes(namespace)) continue;
    const hashIndex = targetWithFragment.indexOf('#');
    const requestedTitle = (hashIndex >= 0 ? targetWithFragment.slice(0, hashIndex) : targetWithFragment).trim();
    const requestedFragment = hashIndex >= 0 ? targetWithFragment.slice(hashIndex + 1).trim() || null : null;
    if (!requestedTitle) continue;
    links.push({
      occurrence: links.length + 1,
      requestedTitle,
      requestedFragment,
      displayText: plainTextFromWiki(parts.at(-1) || requestedTitle),
      rawLink: match[0],
      sourceLocator
    });
  }
  return links;
}

export function compileActivityReferenceCollectionPolicy(policy = {}) {
  const rules = policy.sectionRules || [];
  const keys = rules.map(rule => `${rule.headingLevel}:${rule.sectionHeading.toLowerCase()}`);
  return {
    policy: policy.policy || null,
    inputRouteKey: policy.inputRouteKey || null,
    sectionRules: rules,
    sectionRuleByKey: new Map(rules.map(rule => [`${rule.headingLevel}:${rule.sectionHeading.toLowerCase()}`, rule])),
    duplicateSectionRuleKeys: unique(keys.filter((key, index) => keys.indexOf(key) !== index))
  };
}

export function findActivityReferenceCollectionAccountState(records = []) {
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
  records.forEach((record, index) => visit(record, '', record?.memberCandidateKey || `record-${index}`));
  return findings;
}

function currentIdentityResolution(link, resolution) {
  const page = resolution?.page || null;
  const revision = page?.revisions?.[0] || null;
  const content = revision?.slots?.main?.content || '';
  const missing = !page || page.missing === true || page.pageid == null;
  const complete = !missing && revision?.revid != null && Boolean(revision?.timestamp) && Boolean(content);
  return {
    occurrence: link.occurrence,
    requestedTitle: link.requestedTitle,
    requestedFragment: link.requestedFragment,
    normalizedTitle: resolution?.normalizedTitle || link.requestedTitle,
    resolvedTitle: missing ? null : page.title,
    observedSourceUrl: missing ? null : `https://oldschool.runescape.wiki/w/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    redirected: Boolean(resolution?.redirected),
    state: missing ? 'missing_current_wiki_page' : complete ? 'resolved_current_wiki_page_identity' : 'incomplete_current_wiki_page_revision_evidence',
    pageId: missing ? null : page.pageid,
    observedRevision: revision?.revid ? String(revision.revid) : null,
    observedTimestamp: revision?.timestamp || null,
    observedContentHash: content ? hash(content) : null
  };
}

function collectionSource(route, page) {
  return {
    candidateKey: route.candidateKey,
    pageId: page.pageId,
    title: page.title,
    revision: String(page.revision),
    timestamp: page.timestamp,
    url: route.sourceUrl,
    contentHash: page.contentHash,
    routingContentHash: route.contentHash,
    sourceDispositionContentHash: route.sourceDispositionContentHash
  };
}

export function parseActivityReferenceCollection({ route, page, policy = {}, memberResolutionByRequestedTitle = new Map() }) {
  const compiled = compileActivityReferenceCollectionPolicy(policy);
  const lines = String(page.content || '').split(/\r?\n/);
  const bounds = tableBounds(lines);
  const sectionOccurrences = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const heading = parseHeading(lines[index], index + 1);
    if (!heading) continue;
    const key = `${heading.level}:${heading.heading.toLowerCase()}`;
    if (!compiled.sectionRuleByKey.has(key)) continue;
    const values = sectionOccurrences.get(key) || [];
    values.push(heading.line);
    sectionOccurrences.set(key, values);
  }
  const tableResults = [];
  for (const [tableIndex, bound] of bounds.tables.entries()) {
    const mappedHeading = [...bound.headings].reverse().find(heading => compiled.sectionRuleByKey.has(`${heading.level}:${heading.heading.toLowerCase()}`));
    if (!mappedHeading) continue;
    const sectionRule = compiled.sectionRuleByKey.get(`${mappedHeading.level}:${mappedHeading.heading.toLowerCase()}`);
    const parsed = parseTable(lines, bound);
    const memberLogicalIndices = parsed.logicalHeaders
      .map((header, index) => plainTextFromWiki(header).toLowerCase() === sectionRule.memberHeader.toLowerCase() ? index : -1)
      .filter(index => index >= 0);
    if (!memberLogicalIndices.length) {
      tableResults.push({ tableIndex: tableIndex + 1, bound, mappedHeading, sectionRule, parsed, memberCellIndex: null });
      continue;
    }
    tableResults.push({ tableIndex: tableIndex + 1, bound, mappedHeading, sectionRule, parsed, memberCellIndex: Math.max(...memberLogicalIndices) });
  }
  const records = [];
  for (const table of tableResults) {
    if (table.memberCellIndex == null) continue;
    for (const [rowIndex, row] of table.parsed.rows.entries()) {
      const imageCellIndices = row.cells
        .map((cell, index) => /\[\[(?:File|Image):/i.test(cell.value) ? index : -1)
        .filter(index => index >= 0);
      const imageAdjacentMemberCells = imageCellIndices
        .map(index => row.cells[index + 1])
        .filter(cell => cell && wikiLinks(cell.value, { lineStart: cell.lineStart, lineEnd: cell.lineEnd }).length);
      const gridMemberCell = row.cells.find(cell => cell.logicalIndexStart <= table.memberCellIndex && cell.logicalIndexEnd >= table.memberCellIndex) || null;
      const memberCell = imageAdjacentMemberCells.length === 1 ? imageAdjacentMemberCells[0] : gridMemberCell;
      const memberCellSelection = imageAdjacentMemberCells.length === 1 ? 'source_image_adjacent_text_cell_within_spanning_member_header' : 'logical_header_column';
      const locator = memberCell ? { lineStart: memberCell.lineStart, lineEnd: memberCell.lineEnd } : { lineStart: row.lineStart, lineEnd: row.lineEnd };
      const links = wikiLinks(memberCell?.value || '', locator);
      const resolutions = links.map(link => currentIdentityResolution(link, memberResolutionByRequestedTitle.get(link.requestedTitle)));
      const resolvedPageIds = unique(resolutions.filter(value => value.pageId != null).map(value => value.pageId));
      const blockers = [
        'canonical_game_entity_identity_not_established',
        'canonical_activity_identity_not_established',
        'repeatability_requirements_variants_xp_timing_and_mechanics_not_reviewed',
        'optimizer_eligibility_blocked'
      ];
      if (!memberCell) blockers.push('source_row_has_no_member_cell');
      if (!links.length) blockers.push('source_member_cell_has_no_main_namespace_link');
      if (resolutions.some(value => value.state !== 'resolved_current_wiki_page_identity')) blockers.push('one_or_more_member_links_do_not_resolve_to_a_current_wiki_page');
      if (resolvedPageIds.length > 1) blockers.push('source_row_resolves_to_multiple_distinct_wiki_pages');
      const cells = row.cells.map((cell, physicalIndex) => ({
        physicalIndex,
        logicalIndexStart: cell.logicalIndexStart,
        logicalIndexEnd: cell.logicalIndexEnd,
        colspan: cell.colspan,
        rowspan: cell.rowspan,
        logicalHeader: table.parsed.logicalHeaders[cell.logicalIndexStart] || null,
        rawValue: cell.value,
        plainText: plainTextFromWiki(cell.value),
        sourceLocator: { lineStart: cell.lineStart, lineEnd: cell.lineEnd }
      }));
      records.push({
        contract: 'sensum.activity-reference-collection-member-candidate.v1',
        collectionCandidateKey: route.candidateKey,
        memberCandidateKey: `collection-row:${route.sourcePageId}:${route.sourceRevision}:${slug(table.mappedHeading.heading)}:${table.tableIndex}:${rowIndex + 1}`,
        collectionSource: collectionSource(route, page),
        membershipClassification: table.sectionRule.membershipClassification,
        sectionEvidence: { heading: table.mappedHeading.heading, level: table.mappedHeading.level, sourceLocator: { lineStart: table.mappedHeading.line, lineEnd: table.mappedHeading.line } },
        tableEvidence: { sourceTableOrdinal: table.tableIndex, sourceLocator: { lineStart: table.bound.start + 1, lineEnd: table.bound.end + 1 }, memberHeader: table.sectionRule.memberHeader, logicalHeaders: table.parsed.logicalHeaders },
        rowEvidence: { sourceRowOrdinal: rowIndex + 1, sourceLocator: { lineStart: row.lineStart, lineEnd: row.lineEnd }, rawText: row.rawLines.join('\n'), cells },
        memberCellEvidence: memberCell ? { physicalIndex: row.cells.indexOf(memberCell), logicalIndex: table.memberCellIndex, selection: memberCellSelection, rawValue: memberCell.value, plainText: plainTextFromWiki(memberCell.value), sourceLocator: locator } : null,
        memberLinks: links,
        currentWikiIdentityResolutions: resolutions,
        canonicalGameEntityIdentity: null,
        canonicalActivityIdentity: null,
        repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
        mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
        optimizerEligible: false,
        accountIndependent: true,
        blockers: unique(blockers),
        state: blockers.length === 4 ? 'explicit_collection_member_candidate' : 'blocked_collection_member_candidate'
      });
    }
  }
  return { records, parseAudit: { sourceLineCount: lines.length, balancedTables: bounds.balanced, sectionOccurrences: Object.fromEntries(sectionOccurrences), tableResults } };
}

const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));

export function auditActivityReferenceCollectionMembers(records = [], { routes = [], pages = [], policy = {}, parseAudits = [] } = {}) {
  const compiled = compileActivityReferenceCollectionPolicy(policy);
  const expectedRoutes = routes.filter(route => route.routingDecision?.routeKey === compiled.inputRouteKey && route.routingDecision?.routeState === 'queued');
  const expectedKeys = expectedRoutes.map(route => route.candidateKey);
  const pageByKey = new Map(pages.map(page => [page.candidateKey, page]));
  const recordsByCollection = new Map();
  for (const record of records) {
    const values = recordsByCollection.get(record.collectionCandidateKey) || [];
    values.push(record);
    recordsByCollection.set(record.collectionCandidateKey, values);
  }
  const routeSourceMismatches = [];
  for (const route of expectedRoutes) {
    const page = pageByKey.get(route.candidateKey);
    if (!page || page.pageId !== route.sourcePageId || String(page.revision) !== String(route.sourceRevision) || page.timestamp !== route.sourceTimestamp || page.title !== route.resolvedTitle || page.contentHash !== route.sourceContentHash) routeSourceMismatches.push(route.candidateKey);
  }
  const unexpectedCollectionKeys = sorted(unique(records.map(record => record.collectionCandidateKey).filter(key => !expectedKeys.includes(key))));
  const missingCollectionKeys = expectedKeys.filter(key => !recordsByCollection.has(key));
  const memberKeys = records.map(record => record.memberCandidateKey);
  const duplicateMemberKeys = duplicates(memberKeys);
  const sourceRowCount = parseAudits.flatMap(audit => audit.tableResults || []).filter(table => table.memberCellIndex != null).reduce((sum, table) => sum + table.parsed.rows.length, 0);
  const mappedTablesWithoutMemberHeader = parseAudits.flatMap(audit => audit.tableResults || []).filter(table => table.memberCellIndex == null).map(table => ({ section: table.mappedHeading.heading, tableOrdinal: table.tableIndex }));
  const missingOrDuplicatePolicySections = [];
  for (const parseAudit of parseAudits) {
    for (const rule of compiled.sectionRules) {
      const key = `${rule.headingLevel}:${rule.sectionHeading.toLowerCase()}`;
      const count = (parseAudit.sectionOccurrences?.[key] || []).length;
      if (count !== 1) missingOrDuplicatePolicySections.push({ candidateKey: parseAudit.candidateKey, sectionHeading: rule.sectionHeading, headingLevel: rule.headingLevel, occurrences: count });
    }
  }
  const rowsWithoutMemberCell = records.filter(record => !record.memberCellEvidence).map(record => record.memberCandidateKey);
  const rowsWithoutMemberLinks = records.filter(record => !(record.memberLinks || []).length).map(record => record.memberCandidateKey);
  const resolutionAttempts = records.flatMap(record => record.currentWikiIdentityResolutions || []);
  const requestedTitles = unique(records.flatMap(record => (record.memberLinks || []).map(link => link.requestedTitle)));
  const attemptedTitles = unique(resolutionAttempts.map(value => value.requestedTitle));
  const unattemptedTitles = sorted(requestedTitles.filter(title => !attemptedTitles.includes(title)));
  const missingResolutionRows = records.filter(record => (record.currentWikiIdentityResolutions || []).some(value => value.state !== 'resolved_current_wiki_page_identity')).map(record => record.memberCandidateKey);
  const multiIdentityRows = records.filter(record => unique((record.currentWikiIdentityResolutions || []).filter(value => value.pageId != null).map(value => value.pageId)).length > 1).map(record => record.memberCandidateKey);
  const accountStateFindings = findActivityReferenceCollectionAccountState(records);
  const unsupportedPromotions = records.filter(record => record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null || record.repeatabilityReview?.state !== 'unreviewed' || record.mechanicsReview?.state !== 'unreviewed' || record.optimizerEligible === true).map(record => record.memberCandidateKey);
  const membershipCounts = {};
  for (const record of records) membershipCounts[record.membershipClassification] = (membershipCounts[record.membershipClassification] || 0) + 1;
  const structuralBlockers = [];
  if (!expectedRoutes.length) structuralBlockers.push('no_queued_reference_collection_routes');
  if (duplicates(expectedKeys).length || missingCollectionKeys.length || unexpectedCollectionKeys.length) structuralBlockers.push('queued_collection_route_and_output_sets_do_not_match');
  if (routeSourceMismatches.length) structuralBlockers.push('one_or_more_fetched_collection_revisions_do_not_match_the_routed_source');
  if (compiled.duplicateSectionRuleKeys.length) structuralBlockers.push('duplicate_collection_section_policy_rules');
  if (parseAudits.some(audit => !audit.balancedTables)) structuralBlockers.push('one_or_more_collection_sources_have_unbalanced_tables');
  if (missingOrDuplicatePolicySections.length) structuralBlockers.push('one_or_more_policy_mapped_sections_are_missing_or_duplicated');
  if (mappedTablesWithoutMemberHeader.length) structuralBlockers.push('one_or_more_mapped_tables_lack_the_required_member_header');
  if (sourceRowCount !== records.length || duplicateMemberKeys.length) structuralBlockers.push('source_table_rows_and_member_candidate_records_do_not_match_exactly');
  if (rowsWithoutMemberCell.length || rowsWithoutMemberLinks.length) structuralBlockers.push('one_or_more_source_rows_lack_a_linked_member_cell');
  if (unattemptedTitles.length) structuralBlockers.push('one_or_more_distinct_member_titles_received_no_identity_resolution_attempt');
  if (missingResolutionRows.length) structuralBlockers.push('one_or_more_member_links_do_not_resolve_to_a_current_wiki_page');
  if (multiIdentityRows.length) structuralBlockers.push('one_or_more_source_rows_resolve_to_multiple_distinct_wiki_pages');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_canonical_repeatability_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_collection_member_candidates');
  const explicitTableMemberExtractionComplete = expectedRoutes.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers,
    'canonical_game_entity_and_activity_identities_not_established',
    'member_repeatability_requirements_variants_xp_timing_and_mechanics_not_reviewed',
    'independent_complete_activity_universe_not_established'
  ];
  return {
    contract: 'sensum.activity-reference-collection-member-expansion-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      routedRecordCount: routes.length,
      queuedCollectionRouteCount: expectedRoutes.length,
      processedCollectionCount: recordsByCollection.size,
      duplicateQueuedCollectionKeys: duplicates(expectedKeys),
      missingCollectionKeys,
      unexpectedCollectionKeys
    },
    sourceRevisionCoverage: { exactRouteSourceMatchCount: expectedRoutes.length - routeSourceMismatches.length, routeSourceMismatchCandidateKeys: routeSourceMismatches },
    sectionAndTableCoverage: {
      policySectionRuleCount: compiled.sectionRules.length,
      missingOrDuplicatePolicySections,
      mappedMemberTableCount: parseAudits.flatMap(audit => audit.tableResults || []).filter(table => table.memberCellIndex != null).length,
      mappedTablesWithoutMemberHeader,
      sourceDataRowCount: sourceRowCount,
      memberCandidateRecordCount: records.length,
      duplicateMemberCandidateKeys: duplicateMemberKeys,
      rowsWithoutMemberCell,
      rowsWithoutMemberLinks
    },
    memberIdentityCoverage: {
      memberLinkOccurrenceCount: resolutionAttempts.length,
      distinctRequestedTitleCount: requestedTitles.length,
      resolutionAttemptedTitleCount: attemptedTitles.length,
      unattemptedTitles,
      resolvedOccurrenceCount: resolutionAttempts.filter(value => value.state === 'resolved_current_wiki_page_identity').length,
      missingResolutionRows,
      multiIdentityRows,
      distinctResolvedWikiPageIdCount: unique(resolutionAttempts.filter(value => value.pageId != null).map(value => value.pageId)).length
    },
    membershipClassificationCoverage: { counts: membershipCounts, officialMinigameCount: membershipCounts.official_minigame || 0, minigameLikeBossCount: membershipCounts.minigame_like_boss || 0, minigameLikeActivityCount: membershipCounts.minigame_like_activity || 0 },
    semanticPromotionCoverage: {
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionMemberKeys: unsupportedPromotions
    },
    accountStateFindings,
    explicitTableMemberExtractionComplete,
    memberIdentityResolutionAttemptCoverageComplete: requestedTitles.length > 0 && unattemptedTitles.length === 0,
    canonicalMemberExpansionComplete: false,
    repeatabilityRequirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: explicitTableMemberExtractionComplete
  };
}

export function buildActivityReferenceCollectionMembers({ routes = [], pages = [], policy = {}, memberResolutions = [] }) {
  const resolutionByTitle = new Map(memberResolutions.map(resolution => [resolution.requestedTitle, resolution]));
  const pageByKey = new Map(pages.map(page => [page.candidateKey, page]));
  const compiled = compileActivityReferenceCollectionPolicy(policy);
  const records = [];
  const parseAudits = [];
  for (const route of routes.filter(value => value.routingDecision?.routeKey === compiled.inputRouteKey && value.routingDecision?.routeState === 'queued')) {
    const page = pageByKey.get(route.candidateKey);
    if (!page) continue;
    const parsed = parseActivityReferenceCollection({ route, page, policy, memberResolutionByRequestedTitle: resolutionByTitle });
    records.push(...parsed.records);
    parseAudits.push({ ...parsed.parseAudit, candidateKey: route.candidateKey });
  }
  return { records, parseAudits, audit: auditActivityReferenceCollectionMembers(records, { routes, pages, policy, parseAudits }) };
}

export function activityReferenceCollectionRequestedTitles({ routes = [], pages = [], policy = {} }) {
  const titles = [];
  const compiled = compileActivityReferenceCollectionPolicy(policy);
  for (const route of routes.filter(value => value.routingDecision?.routeKey === compiled.inputRouteKey && value.routingDecision?.routeState === 'queued')) {
    const page = pages.find(value => value.candidateKey === route.candidateKey);
    if (!page) continue;
    const parsed = parseActivityReferenceCollection({ route, page, policy });
    titles.push(...parsed.records.flatMap(record => record.memberLinks.map(link => link.requestedTitle)));
  }
  return sorted(unique(titles));
}
