import { hash, json } from './lib.mjs';

const ROUTES = ['basic', 'advanced'];
const REQUIRED_RULES = [
  'currentAndHistoricalOfficialWikiRevisionsMustBePinned',
  'historicalAnchorsMustBelongToTheCurrentCourseRevisionChain',
  'preAndPostUpdateClaimsMustRemainSeparate',
  'relativeUpdatePercentagesMayCorroborateButNeverDeriveExactValues',
  'currentCourseObsoleteNoticeMustRemainVisible',
  'currentObstacleTableMustBeSummedWithoutFillingMissingXp',
  'internalAndCrossPageContradictionsRemainExplicitBlockers',
  'approximateAndUpperBoundRatesCannotBecomeExactExpectedRates',
  'temporalReconciliationDoesNotByItselfProveMechanicalAuthority',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden'
];
const number = value => Number(String(value || '').replaceAll(',', ''));
const sum = values => Number(values.reduce((total, value) => total + value, 0).toFixed(10));
const same = (left, right) => json(left) === json(right);
const unique = values => [...new Set(values)];
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const accountKey = name => /^(?:currentBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

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

function located(content, match, section) {
  return match ? { section, line: content.slice(0, match.index).split(/\r?\n/).length, excerpt: match[0] } : null;
}

function pageBinding(page = {}) {
  return { title: page.title || null, revision: String(page.sourceRevision || ''), timestamp: page.sourceTimestamp || null, url: page.sourceUrl || null };
}

function claims(content = '') {
  const lap = /granting a total of\s+([\d.]+)\s+experience for basic lap completion, and\s+([\d.]+)\s+experience for advanced lap completion/i.exec(content);
  const basic = /basic course can be completed in\s+(\d+):(\d+\.\d+), yielding approximately\s+([\d–-]+)\s+completions per hour \(including\s+([\d.]+)\s+seconds of downtime between laps\) and ~([\d,]+)\s+xp\/hr/i.exec(content);
  const advanced = /advanced course can be completed in\s+(\d+):(\d+\.\d+), allowing roughly\s+(\d+)\s+completions per hour and ~([\d,]+)\s+xp\/hr/i.exec(content);
  const prior = /Prior to the[\s\S]{0,180}?basic course could be completed in\s+(\d+):(\d+\.\d+)\s+and the advanced course in\s+(\d+):(\d+\.\d+)/i.exec(content);
  return {
    basic: lap && basic ? { lapXp: number(lap[1]), durationSeconds: number(basic[1]) * 60 + number(basic[2]), completionsPerHourText: basic[3], downtimeSeconds: number(basic[4]), approximateXpPerHour: number(basic[5]) } : null,
    advanced: lap && advanced ? { lapXp: number(lap[2]), durationSeconds: number(advanced[1]) * 60 + number(advanced[2]), completionsPerHourText: advanced[3], approximateXpPerHour: number(advanced[4]) } : null,
    priorTiming: prior ? { basicSeconds: number(prior[1]) * 60 + number(prior[2]), advancedSeconds: number(prior[3]) * 60 + number(prior[4]) } : null,
    locators: {
      lap: located(content, lap, 'Gameplay'),
      basic: located(content, basic, 'Gameplay'),
      advanced: located(content, advanced, 'Gameplay'),
      prior: located(content, prior, 'Gameplay')
    }
  };
}

function tableEvidence(content = '', route) {
  const startPattern = new RegExp(`^===${route === 'basic' ? 'Basic' : 'Advanced'} course obstacles===\\s*$`, 'mi');
  const start = startPattern.exec(content);
  if (!start) return { values: [], sum: null, locator: null };
  const tail = content.slice(start.index + start[0].length);
  const end = tail.search(/^===/m);
  const section = end < 0 ? tail : tail.slice(0, end);
  const values = [...section.matchAll(/\{\{\+=\|xp2?\|([\d.]+)\|/gi)].map(match => number(match[1]));
  return { values, sum: values.length ? sum(values) : null, locator: { section: `${route} course obstacles`, line: content.slice(0, start.index).split(/\r?\n/).length } };
}

function overviewClaims(content = '') {
  const routes = /regular course consists of\s+(\w+)\s+obstacles and gives\s+([\d.]+)\s+experience per lap[\s\S]{0,220}?At level\s+(\d+)\s+Agility[\s\S]{0,260}?Advanced course consists of\s+(\w+)\s+obstacles and gives\s+([\d.]+)\s+experience per lap/i.exec(content);
  const rates = /up to\s+([\d,]+)\s+Agility experience per hour on the basic course, and up to\s+([\d,]+)\s+experience per hour on the advanced course/i.exec(content);
  return routes && rates ? {
    basic: { lapXp: number(routes[2]), upperBoundXpPerHour: number(rates[1]) },
    advanced: { minimumAgility: number(routes[3]), lapXp: number(routes[5]), upperBoundXpPerHour: number(rates[2]) },
    locators: { routes: located(content, routes, 'Colossal Wyrm Agility Course'), rates: located(content, rates, 'Colossal Wyrm Agility Course') }
  } : null;
}

function guideClaims(content = '') {
  const match = /basic course requires\s+(\d+)\s+Agility and gives up to\s+([\d,]+)\s+xp\/hr, and the advanced course requires\s+(\d+)\s+Agility and gives up to\s+([\d,]+)\s+xp\/hr\. The advanced route requires only\s+(\d+)\s+clicks per\s+(\d+)-second lap/i.exec(content);
  return match ? {
    basic: { minimumAgility: number(match[1]), upperBoundXpPerHour: number(match[2]) },
    advanced: { minimumAgility: number(match[3]), upperBoundXpPerHour: number(match[4]), clicks: number(match[5]), durationSeconds: number(match[6]) },
    locator: located(content, match, 'Levels 50/62: Colossal Wyrm Agility Course')
  } : null;
}

function updateClaims(content = '') {
  const date = /\{\{Update\|date=(\d{1,2}\s+\w+\s+\d{4})\|/i.exec(content);
  const changes = /basic course by ~([\d.]+)%[\s\S]{0,80}?advanced course by ~([\d.]+)%[\s\S]{0,180}?Increased XP, Bone shards and Termites to match so that it's roughly the same XP\/hr/i.exec(content);
  return date && changes ? { dateText: date[1], basicPercent: number(changes[1]), advancedPercent: number(changes[2]), locator: located(content, changes, 'Colossal Wyrm Agility course') } : null;
}

function observedDelta(before, after) {
  return Number((((after / before) - 1) * 100).toFixed(6));
}

function hashesValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && validHash(record?.contentHash)
    && contentHash(without(record, ['recordContentHash', 'contentHash'])) === record.recordContentHash
    && contentHash(without(record, ['contentHash'])) === record.contentHash;
}

export function compileAgilityColossalWyrmPostUpdatePolicy(policy = {}) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-post-update-mechanics-reconciliation-policy.v1',
    courseTitle: 'Colossal Wyrm Agility Course',
    guideTitle: 'Agility training',
    overviewTitle: 'Agility',
    updateTitle: 'Update:Summer Sweep Up - Agility & Chambers of Xeric Changes',
    updateDate: '2026-08-12',
    recordContract: 'sensum.agility-colossal-wyrm-post-update-mechanics-reconciliation.v1',
    auditContract: 'sensum.agility-colossal-wyrm-post-update-mechanics-reconciliation-audit.v1',
    outputDomain: 'agility-colossal-wyrm-post-update-mechanics-reconciliation'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  if (!same(policy.historicalAnchors, { lastConfirmedPreUpdateRevision: '15293116', firstCompletePostUpdateCorrectionRevision: '15294160', explicitPreUpdateTimingClarificationRevision: '15295144' })) invalidBindings.push('historicalAnchors');
  if (!same(policy.officialRelativeChanges, { basicPercent: 25, advancedPercent: 40 })) invalidBindings.push('officialRelativeChanges');
  if (!same(policy.obstacleTitles, [
    'Ladder (Colossal Wyrm Agility Course)',
    'Tightrope (Colossal Wyrm Agility Course)',
    'Edge (Colossal Wyrm Agility Course)',
    'Rope (Colossal Wyrm Agility Course)',
    'Zipline (Colossal Wyrm Agility Course)'
  ])) invalidBindings.push('obstacleTitles');
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return { valid: !invalidBindings.length && !invalidRules.length, invalidBindings: unique(invalidBindings), invalidRules: unique(invalidRules) };
}

function buildExpected(options = {}, contentHash = hash) {
  const policy = options.policy || {};
  const current = Object.fromEntries((options.currentPages || []).map(page => [page.title, page]));
  const historical = Object.fromEntries((options.historicalPages || []).map(page => [String(page.sourceRevision), page]));
  const course = current[policy.courseTitle];
  const guide = current[policy.guideTitle];
  const overview = current[policy.overviewTitle];
  const update = current[policy.updateTitle];
  const prePage = historical[policy.historicalAnchors?.lastConfirmedPreUpdateRevision];
  const postPage = historical[policy.historicalAnchors?.firstCompletePostUpdateCorrectionRevision];
  const clarificationPage = historical[policy.historicalAnchors?.explicitPreUpdateTimingClarificationRevision];
  const currentClaims = claims(course?.content);
  const preClaims = claims(prePage?.content);
  const postClaims = claims(postPage?.content);
  const clarificationClaims = claims(clarificationPage?.content);
  const guideData = guideClaims(guide?.content);
  const overviewData = overviewClaims(overview?.content);
  const updateData = updateClaims(update?.content);
  const tables = { basic: tableEvidence(course?.content, 'basic'), advanced: tableEvidence(course?.content, 'advanced') };
  const obsolete = /\{\{Obsolete\|Changes to course durations, experience, termites, and bone shards\./i.exec(course?.content || '');
  const chainIds = (options.revisionChain || []).map(revision => String(revision.revid));
  const currentTitles = [policy.courseTitle, policy.guideTitle, policy.overviewTitle, policy.updateTitle, ...(policy.obstacleTitles || [])];
  const actualCurrentTitles = (options.currentPages || []).map(page => page.title);
  const historicalAnchorIds = Object.values(policy.historicalAnchors || {}).map(String);
  const actualHistoricalIds = (options.historicalPages || []).map(page => String(page.sourceRevision));
  const exactCurrentPageSet = actualCurrentTitles.length === currentTitles.length
    && unique(actualCurrentTitles).length === currentTitles.length
    && currentTitles.every(title => actualCurrentTitles.includes(title));
  const exactHistoricalAnchorSet = actualHistoricalIds.length === historicalAnchorIds.length
    && unique(actualHistoricalIds).length === historicalAnchorIds.length
    && historicalAnchorIds.every(revision => actualHistoricalIds.includes(revision))
    && (options.historicalPages || []).every(page => page.title === policy.courseTitle);
  const anchorsInChain = Object.values(policy.historicalAnchors || {}).every(revision => chainIds.includes(String(revision)));
  const clarificationIndex = chainIds.indexOf(String(policy.historicalAnchors?.explicitPreUpdateTimingClarificationRevision));
  const postIndex = chainIds.indexOf(String(policy.historicalAnchors?.firstCompletePostUpdateCorrectionRevision));
  const preIndex = chainIds.indexOf(String(policy.historicalAnchors?.lastConfirmedPreUpdateRevision));
  const revisionChainOrdered = chainIds[0] === String(course?.sourceRevision)
    && chainIds.at(-1) === String(policy.historicalAnchors?.lastConfirmedPreUpdateRevision)
    && clarificationIndex > -1 && postIndex > -1 && preIndex > -1
    && clarificationIndex < postIndex && postIndex < preIndex
    && chainIds.every((revision, index) => index === 0 || Number(chainIds[index - 1]) > Number(revision));
  const updateDateMatchesPolicy = updateData?.dateText === '12 August 2026' && policy.updateDate === '2026-08-12';
  const updatePercentagesMatchPolicy = updateData?.basicPercent === policy.officialRelativeChanges?.basicPercent
    && updateData?.advancedPercent === policy.officialRelativeChanges?.advancedPercent;
  const obstaclePagesReady = (policy.obstacleTitles || []).every(title => {
    const page = current[title];
    return page?.sourceRevision && page?.sourceTimestamp && page?.sourceUrl && page?.content
      && [...String(page.content).matchAll(/^\|xp\d+\s*=\s*([\d.]+)/gmi)].length > 0;
  });
  const obstacleTablesReady = ROUTES.every(route => tables[route].values.length > 0 && Number.isFinite(tables[route].sum));
  const currentRetainsPost = ROUTES.every(route => same(currentClaims[route], postClaims[route]));
  const clarificationMatchesPre = clarificationClaims.priorTiming?.basicSeconds === preClaims.basic?.durationSeconds
    && clarificationClaims.priorTiming?.advancedSeconds === preClaims.advanced?.durationSeconds;
  const sourceReady = exactCurrentPageSet && exactHistoricalAnchorSet
    && [course, guide, overview, update, prePage, postPage, clarificationPage].every(page => page?.sourceRevision && page?.sourceTimestamp && page?.sourceUrl && page?.content)
    && guideData && overviewData && updateData && currentClaims.basic && currentClaims.advanced && preClaims.basic && preClaims.advanced
    && postClaims.basic && postClaims.advanced && clarificationMatchesPre && obsolete && anchorsInChain && revisionChainOrdered
    && updateDateMatchesPolicy && updatePercentagesMatchPolicy && obstaclePagesReady && obstacleTablesReady && currentRetainsPost;
  const integrity = { exactCurrentPageSet, exactHistoricalAnchorSet, anchorsInChain, revisionChainOrdered, updateDateMatchesPolicy, updatePercentagesMatchPolicy, obstaclePagesReady, obstacleTablesReady };
  if (!sourceReady) return { records: [], evidence: { sourceReady, ...integrity, currentRetainsPost, clarificationMatchesPre, obsoletePresent: Boolean(obsolete), current, historical, currentClaims, preClaims, postClaims, clarificationClaims, guideData, overviewData, updateData, tables } };
  const sourceRevisions = {
    currentCourse: pageBinding(course),
    currentGuide: pageBinding(guide),
    currentOverview: pageBinding(overview),
    officialUpdate: pageBinding(update),
    preUpdateCourse: pageBinding(prePage),
    firstCompletePostUpdateCourse: pageBinding(postPage),
    explicitPreUpdateClarificationCourse: pageBinding(clarificationPage),
    obstacles: policy.obstacleTitles.map(title => pageBinding(current[title]))
  };
  const obstaclePageXp = Object.fromEntries(policy.obstacleTitles.map(title => [title, [...String(current[title]?.content || '').matchAll(/^\|xp\d+\s*=\s*([\d.]+)/gmi)].map(match => number(match[1]))]));
  const records = ROUTES.map(route => {
    const before = preClaims[route];
    const after = postClaims[route];
    const officialPercent = route === 'basic' ? updateData.basicPercent : updateData.advancedPercent;
    const relative = { durationPercent: observedDelta(before.durationSeconds, after.durationSeconds), lapXpPercent: observedDelta(before.lapXp, after.lapXp) };
    const tableMatches = tables[route].sum === after.lapXp;
    const remainingBlockers = [
      'current_course_page_obsolete_for_duration_experience_termites_and_bone_shards',
      `${route}_current_obstacle_pages_not_reconciled_with_course_table`,
      `${route}_approximate_or_upper_bound_rate_not_exact_expected_rate`
    ];
    if (!tableMatches) remainingBlockers.push(`${route}_post_update_lap_xp_${String(after.lapXp).replace('.', '_')}_conflicts_with_current_obstacle_table_${String(tables[route].sum).replace('.', '_')}`);
    const base = {
      contract: policy.recordContract,
      memberKey: `colossal-wyrm:${route}-route`,
      routePolicy: `${route}_route`,
      minimumAgility: route === 'basic' ? guideData.basic.minimumAgility : guideData.advanced.minimumAgility,
      sourceRevisions,
      updateDate: policy.updateDate,
      preUpdateClaims: before,
      postUpdateClaims: after,
      officialRelativeChange: { approximatePercent: officialPercent, exactPostUpdateValuesPublishedByUpdate: false },
      observedRelativeChange: { ...relative, corroboratesApproximateOfficialChange: Math.abs(relative.durationPercent - officialPercent) <= 1.5 && Math.abs(relative.lapXpPercent - officialPercent) <= 1.5, valuesWereNotDerivedFromOfficialPercentage: true },
      courseObstacleTable: { values: tables[route].values, sumXp: tables[route].sum, claimedLapXp: after.lapXp, sumMatchesClaim: tableMatches, locator: tables[route].locator },
      obstaclePageXp,
      crossSourceClaims: { guide: guideData[route], overview: overviewData[route] },
      claimDispositions: {
        temporalAssignment: 'post_update_values_source_observed_in_course_revision_chain',
        duration: 'post_update_source_observed_candidate_not_formula_derived',
        lapXp: tableMatches ? 'post_update_source_observed_and_current_course_table_correlated' : 'blocked_current_course_internal_conflict',
        xpPerHour: 'approximate_observation_and_upper_bounds_not_exact_expected_rate',
        priorGuideOrOverviewValues: 'retained_as_temporally_stale_or_condition_distinct_until_source_correction'
      },
      sourceLocators: { currentCourse: currentClaims.locators, postUpdateCourse: postClaims.locators, preUpdateCourse: preClaims.locators, clarification: clarificationClaims.locators, guide: guideData.locator, overview: overviewData.locators, update: updateData.locator, obsolete: located(course.content, obsolete, 'Obsolete notice') },
      temporalAssignmentComplete: true,
      mechanicalAuthorityComplete: false,
      remainingBlockers,
      optimizerEligible: false,
      verifiedBestAuthorized: false,
      automaticVerificationApplied: false,
      accountIndependent: true
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
  return { records, evidence: { sourceReady, ...integrity, currentRetainsPost, clarificationMatchesPre, obsoletePresent: Boolean(obsolete), currentClaims, preClaims, postClaims, clarificationClaims, guideData, overviewData, updateData, tables } };
}

export function auditAgilityColossalWyrmPostUpdateMechanicsReconciliation(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityColossalWyrmPostUpdatePolicy(options.policy || {});
  const expected = buildExpected(options, contentHash);
  const recordsMatchExpected = same(records, expected.records);
  const recordHashesValid = records.every(record => hashesValid(record, contentHash));
  const sourceIntegrity = {
    exactCurrentPageCount: (options.currentPages || []).length,
    exactHistoricalAnchorCount: (options.historicalPages || []).length,
    allPagesRevisionPinned: [...(options.currentPages || []), ...(options.historicalPages || [])].every(page => page.sourceRevision && page.sourceTimestamp && page.sourceUrl && page.content),
    exactCurrentPageSet: expected.evidence.exactCurrentPageSet === true,
    exactHistoricalAnchorSet: expected.evidence.exactHistoricalAnchorSet === true,
    allRequiredObstaclePagesReady: expected.evidence.obstaclePagesReady === true,
    bothCurrentObstacleTablesReady: expected.evidence.obstacleTablesReady === true,
    sourceReady: expected.evidence.sourceReady === true
  };
  const temporalCoverage = {
    anchorsInCurrentRevisionChain: expected.evidence.anchorsInChain === true,
    revisionChainOrderedFromCurrentThroughPreUpdateAnchor: expected.evidence.revisionChainOrdered === true,
    officialUpdateDateMatchesPolicy: expected.evidence.updateDateMatchesPolicy === true,
    officialRelativeChangesMatchPolicy: expected.evidence.updatePercentagesMatchPolicy === true,
    currentCourseRetainsFirstCompletePostUpdateClaims: expected.evidence.currentRetainsPost === true,
    explicitPriorTimingMatchesPreUpdateRevision: expected.evidence.clarificationMatchesPre === true,
    currentCourseObsoleteNoticePresent: expected.evidence.obsoletePresent === true
  };
  const routeCoverage = { expectedRoutes: ROUTES, recordCount: records.length, routeKeys: records.map(record => record.routePolicy), complete: records.length === 2 && ROUTES.every(route => records.some(record => record.routePolicy === `${route}_route`)) };
  const reconciliationCoverage = {
    temporallyAssignedRoutes: records.filter(record => record.temporalAssignmentComplete).length,
    mechanicallyAuthoritativeRoutes: records.filter(record => record.mechanicalAuthorityComplete).length,
    obstacleTableMatchedRoutes: records.filter(record => record.courseObstacleTable?.sumMatchesClaim).map(record => record.routePolicy),
    obstacleTableConflictRoutes: records.filter(record => !record.courseObstacleTable?.sumMatchesClaim).map(record => record.routePolicy),
    allRelativeChangesCorroborateOfficialApproximationWithoutDerivation: records.every(record => record.observedRelativeChange?.corroboratesApproximateOfficialChange === true && record.observedRelativeChange?.valuesWereNotDerivedFromOfficialPercentage === true)
  };
  const promotionCount = records.filter(record => record.optimizerEligible || record.verifiedBestAuthorized || record.automaticVerificationApplied || record.accountIndependent !== true || record.mechanicalAuthorityComplete).length;
  const foundAccountState = accountFindings(without(options, ['contentHash']));
  const remainingBlockers = unique(records.flatMap(record => record.remainingBlockers || []));
  const blockers = [];
  if (!policyValidation.valid) blockers.push('colossal_wyrm_post_update_reconciliation_policy_invalid');
  if (!sourceIntegrity.allPagesRevisionPinned || !sourceIntegrity.exactCurrentPageSet || !sourceIntegrity.exactHistoricalAnchorSet || !sourceIntegrity.allRequiredObstaclePagesReady || !sourceIntegrity.bothCurrentObstacleTablesReady || !sourceIntegrity.sourceReady) blockers.push('current_or_historical_source_integrity_incomplete');
  if (!Object.values(temporalCoverage).every(Boolean)) blockers.push('post_update_temporal_chain_or_claim_assignment_incomplete');
  if (!routeCoverage.complete) blockers.push('basic_or_advanced_route_reconciliation_missing');
  if (!reconciliationCoverage.allRelativeChangesCorroborateOfficialApproximationWithoutDerivation) blockers.push('post_update_relative_change_not_corroborated');
  if (!recordsMatchExpected || !recordHashesValid) blockers.push('reconciliation_record_reconstruction_or_hash_validation_failed');
  if (promotionCount) blockers.push('reconciliation_promoted_mechanical_or_optimizer_authority');
  if (foundAccountState.length) blockers.push('account_query_state_baked_into_post_update_reconciliation');
  const reconciliationComplete = blockers.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyValidation,
    sourceIntegrity,
    temporalCoverage,
    routeCoverage,
    reconciliationCoverage,
    blockerPreservation: { remainingBlockers, remainingBlockerCount: remainingBlockers.length, semanticFactsApplied: 0, optimizerEligibleCount: 0, verifiedBestAuthorizationCount: 0, automaticVerificationCount: 0, accountStateFindingCount: foundAccountState.length, accountStateFindings: foundAccountState },
    recordsMatchExpected,
    recordHashesValid,
    reconciliationComplete,
    mechanicalCompletenessProven: false,
    absoluteBestGate: 'blocked_colossal_wyrm_mechanics_not_authoritative',
    publishable: reconciliationComplete,
    blockers
  };
}

export function buildAgilityColossalWyrmPostUpdateMechanicsReconciliation(options = {}) {
  const contentHash = options.contentHash || hash;
  const expected = buildExpected(options, contentHash);
  const audit = auditAgilityColossalWyrmPostUpdateMechanicsReconciliation(expected.records, { ...options, contentHash });
  return { records: audit.publishable ? expected.records : [], audit };
}
