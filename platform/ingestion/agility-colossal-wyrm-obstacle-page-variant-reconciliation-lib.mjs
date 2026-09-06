import { hash, json } from './lib.mjs';

const ROUTES = ['basic_route', 'advanced_route'];
const REQUIRED_RULES = [
  'priorTemporalReconciliationSnapshotMustBeExplicitlySelectedAndRevalidated',
  'currentCourseAndEveryCurrentObstaclePageMustBeRevisionPinned',
  'preUpdateCourseAndObstacleRevisionsMustBeExact',
  'courseRowAnchorsMustMapToExactlyOneObstaclePageVersion',
  'sharedCourseRowsMustRemainSeparateOccurrences',
  'currentAndPreUpdateXpMustRemainSeparate',
  'currentPageAndCourseXpDisagreementsRemainExplicitBlockers',
  'matchingPreUpdatePageFieldsDoNotProveCurrentMechanicalAuthority',
  'genericObstacleBlockersMayBeReplacedOnlyByCompleteSpecificCoverage',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden'
];
const EXPECTED_VARIANT_KEYS = [
  'colossal-wyrm:ladder:1',
  'colossal-wyrm:ladder:2',
  'colossal-wyrm:ladder:3',
  'colossal-wyrm:tightrope:1',
  'colossal-wyrm:tightrope:2',
  'colossal-wyrm:tightrope:3',
  'colossal-wyrm:edge:1',
  'colossal-wyrm:edge:2',
  'colossal-wyrm:edge:3',
  'colossal-wyrm:rope:1',
  'colossal-wyrm:rope:2',
  'colossal-wyrm:zipline:basic',
  'colossal-wyrm:zipline:advanced'
];
const same = (left, right) => json(left) === json(right);
const unique = values => [...new Set(values)];
const number = value => Number(String(value || '').replaceAll(',', ''));
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const accountKey = name => /^(?:currentBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const titleStem = title => String(title || '').replace(/\s*\(Colossal Wyrm Agility Course\)$/, '');
const token = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const numericToken = value => String(value).replace('.', '_').replace('-', 'negative_');
const variantKey = (title, version) => `colossal-wyrm:${token(titleStem(title))}:${token(version)}`;

function accountFindings(value) {
  const findings = [];
  const visit = (current, path = '') => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!current || typeof current !== 'object') return;
    for (const [name, child] of Object.entries(current)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(value);
  return findings;
}

function pageBinding(page = {}) {
  return { title: page.title || null, revision: String(page.sourceRevision || ''), timestamp: page.sourceTimestamp || null, url: page.sourceUrl || null };
}

function recordsHashesValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && validHash(record?.contentHash)
    && contentHash(without(record, ['recordContentHash', 'contentHash'])) === record.recordContentHash
    && contentHash(without(record, ['contentHash'])) === record.contentHash;
}

function sectionText(content, heading, nextHeading) {
  const start = String(content || '').search(new RegExp(`^===${heading}===\\s*$`, 'mi'));
  if (start < 0) return null;
  const tail = String(content).slice(start);
  const next = tail.slice(1).search(new RegExp(`^===${nextHeading}===\\s*$`, 'mi'));
  return next < 0 ? tail : tail.slice(0, next + 1);
}

function courseRows(content = '', obstacleTitles = []) {
  const rows = [];
  for (const [routePolicy, heading, nextHeading] of [
    ['basic_route', 'Basic course obstacles', 'Advanced course obstacles'],
    ['advanced_route', 'Advanced course obstacles', 'Termites']
  ]) {
    const section = sectionText(content, heading, nextHeading);
    if (!section) continue;
    let sourceOrder = 0;
    for (const block of section.split(/\n\|-\s*\n/)) {
      const link = [...block.matchAll(/\[\[([^\]|#]+)(?:#([^\]|]+))?\|([^\]]+)\]\]/g)]
        .find(match => obstacleTitles.includes(match[1]));
      const xp = /\{\{\+=\|xp2?\|([\d.]+)\|/i.exec(block);
      if (!link || !xp) continue;
      const routeName = routePolicy === 'basic_route' ? 'Basic' : 'Advanced';
      const selector = link[2] || routeName;
      const action = /\|\s*style="text-align:center;"\|\s*(Yes|No)/i.exec(block);
      rows.push({
        routePolicy,
        sourceOrder,
        pageTitle: link[1],
        linkAnchor: link[2] || null,
        linkLabel: link[3],
        pageVersion: selector,
        variantKey: variantKey(link[1], selector),
        xp: number(xp[1]),
        actionNeeded: action?.[1] || null
      });
      sourceOrder += 1;
    }
  }
  return rows;
}

function courseXpRowCounts(content = '') {
  return Object.fromEntries([
    ['basic_route', 'Basic course obstacles', 'Advanced course obstacles'],
    ['advanced_route', 'Advanced course obstacles', 'Termites']
  ].map(([routePolicy, heading, nextHeading]) => {
    const section = sectionText(content, heading, nextHeading);
    const count = section ? section.split(/\n\|-\s*\n/).filter(block => /\{\{\+=\|xp2?\|[\d.]+\|/i.test(block)).length : 0;
    return [routePolicy, count];
  }));
}

function pageVariants(page = {}) {
  const content = String(page.content || '');
  const start = content.indexOf('{{Agility info');
  if (start < 0) return [];
  const tail = content.slice(start);
  const end = tail.search(/^\}\}\s*$/m);
  if (end < 0) return [];
  const template = tail.slice(0, end);
  const values = {};
  for (const match of template.matchAll(/^\|(version|level|xp)(\d+)\s*=\s*(.+)$/gmi)) {
    values[match[2]] ||= {};
    values[match[2]][match[1].toLowerCase()] = match[3].trim();
  }
  return Object.entries(values).sort((left, right) => Number(left[0]) - Number(right[0])).flatMap(([index, fields]) => {
    if (!fields.version || !fields.level || !fields.xp) return [];
    return [{
      variantKey: variantKey(page.title, fields.version),
      pageTitle: page.title,
      pageVersion: fields.version,
      versionIndex: Number(index),
      minimumAgility: number(fields.level),
      xp: number(fields.xp)
    }];
  });
}

function sortedRows(rows) {
  return [...rows].sort((left, right) => ROUTES.indexOf(left.routePolicy) - ROUTES.indexOf(right.routePolicy) || left.sourceOrder - right.sourceOrder);
}

function comparableCourseRows(rows) {
  return sortedRows(rows).map(row => ({ routePolicy: row.routePolicy, sourceOrder: row.sourceOrder, variantKey: row.variantKey, xp: row.xp, actionNeeded: row.actionNeeded }));
}

function expectedSourceSets(options, policy) {
  const currentTitles = [policy.courseTitle, ...policy.obstaclePages.map(entry => entry.title)];
  const actualCurrentTitles = (options.currentPages || []).map(page => page.title);
  const historicalBindings = [
    { title: policy.courseTitle, revision: policy.historicalCourseRevisions.lastConfirmedPreUpdateRevision },
    { title: policy.courseTitle, revision: policy.historicalCourseRevisions.firstCompletePostUpdateTableRevision },
    ...policy.obstaclePages.map(entry => ({ title: entry.title, revision: entry.preUpdateRevision }))
  ];
  const actualHistoricalBindings = (options.historicalPages || []).map(page => ({ title: page.title, revision: String(page.sourceRevision) }));
  return {
    exactCurrentPageSet: actualCurrentTitles.length === currentTitles.length
      && unique(actualCurrentTitles).length === currentTitles.length
      && currentTitles.every(title => actualCurrentTitles.includes(title)),
    exactHistoricalPageSet: actualHistoricalBindings.length === historicalBindings.length
      && historicalBindings.every(binding => actualHistoricalBindings.some(actual => same(actual, binding)))
      && unique(actualHistoricalBindings.map(binding => `${binding.title}:${binding.revision}`)).length === historicalBindings.length
  };
}

function priorReconciliationValid(options, current, policy, contentHash) {
  const records = options.inputReconciliationRecords || [];
  const currentCourse = current[policy.courseTitle];
  const currentObstacleBindings = policy.obstaclePages.map(entry => pageBinding(current[entry.title]));
  const recordsValid = records.length === 2 && records.every(record => record.contract === policy.inputReconciliationContract
    && record.temporalAssignmentComplete === true
    && record.mechanicalAuthorityComplete === false
    && record.optimizerEligible === false
    && record.verifiedBestAuthorized === false
    && record.automaticVerificationApplied === false
    && record.accountIndependent === true
    && recordsHashesValid(record, contentHash)
    && record.sourceRevisions?.currentCourse?.revision === String(currentCourse?.sourceRevision)
    && same(record.sourceRevisions?.obstacles, currentObstacleBindings));
  return {
    recordsValid,
    snapshotExplicit: typeof options.inputReconciliationSnapshot?.directory === 'string'
      && validHash(options.inputReconciliationSnapshot?.contentHash)
      && Number(options.inputReconciliationSnapshot?.records) === 2,
    routeSetValid: records.map(record => record.routePolicy).sort().join(',') === 'advanced_route,basic_route'
  };
}

export function compileAgilityColossalWyrmObstaclePageVariantPolicy(policy = {}) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-obstacle-page-variant-reconciliation-policy.v1',
    courseTitle: 'Colossal Wyrm Agility Course',
    updateDate: '2026-08-12',
    inputReconciliationContract: 'sensum.agility-colossal-wyrm-post-update-mechanics-reconciliation.v1',
    inputReconciliationDomain: 'agility-colossal-wyrm-post-update-mechanics-reconciliation',
    recordContract: 'sensum.agility-colossal-wyrm-obstacle-page-variant-reconciliation.v1',
    auditContract: 'sensum.agility-colossal-wyrm-obstacle-page-variant-reconciliation-audit.v1',
    outputDomain: 'agility-colossal-wyrm-obstacle-page-variant-reconciliation'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  if (!same(policy.historicalCourseRevisions, { lastConfirmedPreUpdateRevision: '15293116', firstCompletePostUpdateTableRevision: '15295144' })) invalidBindings.push('historicalCourseRevisions');
  if (!same(policy.obstaclePages, [
    { title: 'Ladder (Colossal Wyrm Agility Course)', preUpdateRevision: '15202729' },
    { title: 'Tightrope (Colossal Wyrm Agility Course)', preUpdateRevision: '15202730' },
    { title: 'Edge (Colossal Wyrm Agility Course)', preUpdateRevision: '15202732' },
    { title: 'Rope (Colossal Wyrm Agility Course)', preUpdateRevision: '15202733' },
    { title: 'Zipline (Colossal Wyrm Agility Course)', preUpdateRevision: '15202731' }
  ])) invalidBindings.push('obstaclePages');
  if (!same(policy.expectedRouteOccurrenceCounts, { basic_route: 8, advanced_route: 8 })) invalidBindings.push('expectedRouteOccurrenceCounts');
  if (!same(policy.expectedVariantKeys, EXPECTED_VARIANT_KEYS)) invalidBindings.push('expectedVariantKeys');
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return { valid: !invalidBindings.length && !invalidRules.length, invalidBindings: unique(invalidBindings), invalidRules: unique(invalidRules) };
}

function buildExpected(options = {}, contentHash = hash) {
  const policy = options.policy || {};
  const current = Object.fromEntries((options.currentPages || []).map(page => [page.title, page]));
  const historical = Object.fromEntries((options.historicalPages || []).map(page => [`${page.title}:${page.sourceRevision}`, page]));
  const currentCourse = current[policy.courseTitle];
  const preCourse = historical[`${policy.courseTitle}:${policy.historicalCourseRevisions?.lastConfirmedPreUpdateRevision}`];
  const postTableCourse = historical[`${policy.courseTitle}:${policy.historicalCourseRevisions?.firstCompletePostUpdateTableRevision}`];
  const sourceSets = expectedSourceSets(options, policy);
  const prior = priorReconciliationValid(options, current, policy, contentHash);
  const obstacleTitles = policy.obstaclePages?.map(entry => entry.title) || [];
  const currentRows = courseRows(currentCourse?.content, obstacleTitles);
  const preRows = courseRows(preCourse?.content, obstacleTitles);
  const postTableRows = courseRows(postTableCourse?.content, obstacleTitles);
  const rawRouteRowCounts = {
    current: courseXpRowCounts(currentCourse?.content),
    preUpdate: courseXpRowCounts(preCourse?.content),
    firstCompletePostUpdateTable: courseXpRowCounts(postTableCourse?.content)
  };
  const currentVariants = policy.obstaclePages?.flatMap(entry => pageVariants(current[entry.title])) || [];
  const preVariants = policy.obstaclePages?.flatMap(entry => pageVariants(historical[`${entry.title}:${entry.preUpdateRevision}`])) || [];
  const routeCountsValid = ROUTES.every(route => currentRows.filter(row => row.routePolicy === route).length === policy.expectedRouteOccurrenceCounts?.[route]
    && preRows.filter(row => row.routePolicy === route).length === policy.expectedRouteOccurrenceCounts?.[route]
    && postTableRows.filter(row => row.routePolicy === route).length === policy.expectedRouteOccurrenceCounts?.[route]);
  const rawRouteRowCountsValid = ROUTES.every(route => Object.values(rawRouteRowCounts).every(counts => counts[route] === policy.expectedRouteOccurrenceCounts?.[route]));
  const expectedVariantSetValid = currentVariants.length === policy.expectedVariantKeys?.length
    && preVariants.length === policy.expectedVariantKeys?.length
    && policy.expectedVariantKeys.every(key => currentVariants.some(variant => variant.variantKey === key) && preVariants.some(variant => variant.variantKey === key));
  const currentRowsMapExactly = currentRows.every(row => currentVariants.filter(variant => variant.variantKey === row.variantKey).length === 1);
  const historicalRowsMapExactly = preRows.every(row => preVariants.filter(variant => variant.variantKey === row.variantKey).length === 1);
  const currentCourseMatchesPostTable = same(comparableCourseRows(currentRows), comparableCourseRows(postTableRows));
  const allPagesPinned = [...(options.currentPages || []), ...(options.historicalPages || [])].every(page => page.sourceRevision && page.sourceTimestamp && page.sourceUrl && page.content);
  const sourceReady = sourceSets.exactCurrentPageSet && sourceSets.exactHistoricalPageSet && prior.recordsValid && prior.snapshotExplicit && prior.routeSetValid
    && routeCountsValid && rawRouteRowCountsValid && expectedVariantSetValid && currentRowsMapExactly && historicalRowsMapExactly && currentCourseMatchesPostTable && allPagesPinned;
  const evidence = { sourceReady, ...sourceSets, prior, routeCountsValid, rawRouteRowCounts, rawRouteRowCountsValid, expectedVariantSetValid, currentRowsMapExactly, historicalRowsMapExactly, currentCourseMatchesPostTable, allPagesPinned, currentRows, preRows, postTableRows, currentVariants, preVariants };
  if (!sourceReady) return { records: [], evidence };

  const records = policy.expectedVariantKeys.map(key => {
    const currentVariant = currentVariants.find(variant => variant.variantKey === key);
    const preVariant = preVariants.find(variant => variant.variantKey === key);
    const courseOccurrences = sortedRows(currentRows.filter(row => row.variantKey === key));
    const preUpdateCourseOccurrences = sortedRows(preRows.filter(row => row.variantKey === key));
    const currentPageMatchesCurrentCourse = courseOccurrences.every(row => row.xp === currentVariant.xp);
    const currentPageMatchesPreUpdateCourse = preUpdateCourseOccurrences.length > 0 && preUpdateCourseOccurrences.every(row => row.xp === currentVariant.xp);
    const currentPageFieldsMatchPinnedPreUpdateRevision = same(
      { version: currentVariant.pageVersion, level: currentVariant.minimumAgility, xp: currentVariant.xp },
      { version: preVariant.pageVersion, level: preVariant.minimumAgility, xp: preVariant.xp }
    );
    const courseXpChangedSincePreUpdate = courseOccurrences.some(row => {
      const previous = preUpdateCourseOccurrences.find(candidate => candidate.routePolicy === row.routePolicy && candidate.sourceOrder === row.sourceOrder);
      return previous?.xp !== row.xp;
    });
    const remainingBlockersByRoute = Object.fromEntries(ROUTES.map(route => [route, courseOccurrences.filter(row => row.routePolicy === route && row.xp !== currentVariant.xp).map(row => `${route.replace('_route', '')}_obstacle_${token(titleStem(row.pageTitle))}_${token(row.pageVersion)}_page_xp_${numericToken(currentVariant.xp)}_conflicts_with_course_xp_${numericToken(row.xp)}`)]).filter(([, blockers]) => blockers.length));
    const xpDisposition = currentPageMatchesCurrentCourse
      ? 'current_obstacle_page_matches_current_course_rows'
      : currentPageMatchesPreUpdateCourse
        ? 'current_obstacle_page_matches_pinned_pre_update_course_only'
        : 'current_obstacle_page_conflicts_with_pinned_pre_update_and_current_course_rows';
    const base = {
      contract: policy.recordContract,
      variantKey: key,
      pageTitle: currentVariant.pageTitle,
      pageVersion: currentVariant.pageVersion,
      versionIndex: currentVariant.versionIndex,
      minimumAgility: currentVariant.minimumAgility,
      currentPageXp: currentVariant.xp,
      preUpdatePageXp: preVariant.xp,
      courseOccurrences,
      preUpdateCourseOccurrences,
      currentPageFieldsMatchPinnedPreUpdateRevision,
      currentPageMatchesCurrentCourse,
      currentPageMatchesPreUpdateCourse,
      courseXpChangedSincePreUpdate,
      identityReconciliationComplete: true,
      xpDisposition,
      remainingBlockersByRoute,
      mechanicalAuthorityComplete: false,
      optimizerEligible: false,
      verifiedBestAuthorized: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      sourceRevisions: {
        currentCourse: pageBinding(currentCourse),
        preUpdateCourse: pageBinding(preCourse),
        firstCompletePostUpdateTableCourse: pageBinding(postTableCourse),
        currentObstaclePage: pageBinding(current[currentVariant.pageTitle]),
        preUpdateObstaclePage: pageBinding(historical[`${currentVariant.pageTitle}:${policy.obstaclePages.find(entry => entry.title === currentVariant.pageTitle).preUpdateRevision}`]),
        inputTemporalReconciliation: options.inputReconciliationSnapshot
      }
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
  return { records, evidence };
}

export function auditAgilityColossalWyrmObstaclePageVariantReconciliation(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityColossalWyrmObstaclePageVariantPolicy(options.policy || {});
  const expected = buildExpected(options, contentHash);
  const recordsMatchExpected = same(records, expected.records);
  const recordHashesValid = records.every(record => recordsHashesValid(record, contentHash));
  const accountStateFindings = accountFindings(without(options, ['contentHash']));
  const sourceIntegrity = {
    exactCurrentPageCount: (options.currentPages || []).length,
    exactHistoricalPageCount: (options.historicalPages || []).length,
    exactCurrentPageSet: expected.evidence.exactCurrentPageSet === true,
    exactHistoricalPageSet: expected.evidence.exactHistoricalPageSet === true,
    allPagesRevisionPinned: expected.evidence.allPagesPinned === true,
    currentCourseMatchesFirstCompletePostUpdateTable: expected.evidence.currentCourseMatchesPostTable === true,
    sourceReady: expected.evidence.sourceReady === true
  };
  const inputReconciliation = {
    snapshotExplicit: expected.evidence.prior?.snapshotExplicit === true,
    recordsValid: expected.evidence.prior?.recordsValid === true,
    routeSetValid: expected.evidence.prior?.routeSetValid === true,
    recordCount: (options.inputReconciliationRecords || []).length,
    snapshot: options.inputReconciliationSnapshot || null
  };
  const variantCoverage = {
    expectedVariantCount: options.policy?.expectedVariantKeys?.length || 0,
    recordCount: records.length,
    variantKeys: records.map(record => record.variantKey),
    expectedVariantSetValid: expected.evidence.expectedVariantSetValid === true,
    allCourseRowsMapExactly: expected.evidence.currentRowsMapExactly === true && expected.evidence.historicalRowsMapExactly === true,
    currentCourseUnmappedOccurrences: (expected.evidence.currentRows || []).filter(row => !(expected.evidence.currentVariants || []).some(variant => variant.variantKey === row.variantKey)).map(row => ({ routePolicy: row.routePolicy, sourceOrder: row.sourceOrder, pageTitle: row.pageTitle, linkAnchor: row.linkAnchor, pageVersion: row.pageVersion, variantKey: row.variantKey })),
    preUpdateCourseUnmappedOccurrences: (expected.evidence.preRows || []).filter(row => !(expected.evidence.preVariants || []).some(variant => variant.variantKey === row.variantKey)).map(row => ({ routePolicy: row.routePolicy, sourceOrder: row.sourceOrder, pageTitle: row.pageTitle, linkAnchor: row.linkAnchor, pageVersion: row.pageVersion, variantKey: row.variantKey })),
    availableCurrentVariantKeys: (expected.evidence.currentVariants || []).map(variant => variant.variantKey),
    complete: records.length === 13 && options.policy?.expectedVariantKeys?.every(key => records.some(record => record.variantKey === key))
  };
  const currentRows = expected.evidence.currentRows || [];
  const routeOccurrenceCoverage = {
    currentCourseOccurrenceCount: currentRows.length,
    preUpdateCourseOccurrenceCount: (expected.evidence.preRows || []).length,
    firstCompletePostUpdateTableOccurrenceCount: (expected.evidence.postTableRows || []).length,
    basicCurrentOccurrenceCount: currentRows.filter(row => row.routePolicy === 'basic_route').length,
    advancedCurrentOccurrenceCount: currentRows.filter(row => row.routePolicy === 'advanced_route').length,
    sharedOccurrencesRemainSeparate: currentRows.length === 16,
    rawRouteRowCounts: expected.evidence.rawRouteRowCounts || null,
    noUnparsedOrAdditionalXpRows: expected.evidence.rawRouteRowCountsValid === true,
    complete: expected.evidence.routeCountsValid === true && expected.evidence.rawRouteRowCountsValid === true
  };
  const allOccurrences = records.flatMap(record => record.courseOccurrences.map(occurrence => ({ record, occurrence })));
  const preciseBlockers = unique(records.flatMap(record => Object.values(record.remainingBlockersByRoute || {}).flat()));
  const xpReconciliation = {
    currentCourseOccurrenceMatchCount: allOccurrences.filter(({ record, occurrence }) => record.currentPageXp === occurrence.xp).length,
    currentCourseOccurrenceConflictCount: allOccurrences.filter(({ record, occurrence }) => record.currentPageXp !== occurrence.xp).length,
    currentPageVariantMatchCount: records.filter(record => record.currentPageMatchesCurrentCourse).length,
    currentPageVariantConflictCount: records.filter(record => !record.currentPageMatchesCurrentCourse).length,
    currentFieldsMatchingPinnedPreUpdatePageCount: records.filter(record => record.currentPageFieldsMatchPinnedPreUpdateRevision).length,
    currentPageMatchingOnlyPreUpdateCourseCount: records.filter(record => record.xpDisposition === 'current_obstacle_page_matches_pinned_pre_update_course_only').length,
    currentPageConflictingWithPreAndCurrentCourseCount: records.filter(record => record.xpDisposition === 'current_obstacle_page_conflicts_with_pinned_pre_update_and_current_course_rows').length
  };
  const promotionCount = records.filter(record => record.mechanicalAuthorityComplete || record.optimizerEligible || record.verifiedBestAuthorized || record.automaticVerificationApplied || record.accountIndependent !== true).length;
  const blockers = [];
  if (!policyValidation.valid) blockers.push('colossal_wyrm_obstacle_variant_reconciliation_policy_invalid');
  if (!inputReconciliation.snapshotExplicit || !inputReconciliation.recordsValid || !inputReconciliation.routeSetValid || inputReconciliation.recordCount !== 2) blockers.push('input_temporal_reconciliation_missing_or_invalid');
  if (!sourceIntegrity.exactCurrentPageSet || !sourceIntegrity.exactHistoricalPageSet || !sourceIntegrity.allPagesRevisionPinned || !sourceIntegrity.currentCourseMatchesFirstCompletePostUpdateTable || !sourceIntegrity.sourceReady) blockers.push('obstacle_variant_source_integrity_incomplete');
  if (!variantCoverage.complete || !variantCoverage.expectedVariantSetValid || !variantCoverage.allCourseRowsMapExactly) blockers.push('obstacle_page_variant_identity_coverage_incomplete');
  if (!routeOccurrenceCoverage.complete || !routeOccurrenceCoverage.sharedOccurrencesRemainSeparate) blockers.push('course_route_occurrence_coverage_incomplete');
  if (!recordsMatchExpected || !recordHashesValid) blockers.push('obstacle_variant_record_reconstruction_or_hash_validation_failed');
  if (promotionCount) blockers.push('obstacle_variant_reconciliation_promoted_mechanical_or_optimizer_authority');
  if (accountStateFindings.length) blockers.push('account_query_state_baked_into_obstacle_variant_reconciliation');
  const reconciliationComplete = blockers.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyValidation,
    inputReconciliation,
    sourceIntegrity,
    variantCoverage,
    routeOccurrenceCoverage,
    xpReconciliation,
    blockerPreservation: {
      genericObstacleBlockersReplacedOnlyAfterCompleteSpecificCoverage: reconciliationComplete,
      preciseRemainingBlockers: preciseBlockers,
      preciseRemainingBlockerCount: preciseBlockers.length,
      mechanicallyAuthoritativeVariants: 0,
      optimizerEligibleCount: 0,
      verifiedBestAuthorizationCount: 0,
      automaticVerificationCount: 0,
      accountStateFindingCount: accountStateFindings.length,
      accountStateFindings
    },
    recordsMatchExpected,
    recordHashesValid,
    reconciliationComplete,
    mechanicalCompletenessProven: false,
    absoluteBestGate: 'blocked_colossal_wyrm_mechanics_not_authoritative',
    publishable: reconciliationComplete,
    blockers
  };
}

export function buildAgilityColossalWyrmObstaclePageVariantReconciliation(options = {}) {
  const contentHash = options.contentHash || hash;
  const expected = buildExpected(options, contentHash);
  const audit = auditAgilityColossalWyrmObstaclePageVariantReconciliation(expected.records, { ...options, contentHash });
  return { records: audit.publishable ? expected.records : [], audit };
}
