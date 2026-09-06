import { hash, json } from './lib.mjs';

const REQUIRED_RULES = [
  'inputSnapshotsMustBeExplicitlySelectedAndRevalidated',
  'courseRevisionChainMustBeExactContiguousAndContentBearing',
  'proseAndEightRowTableValuesMustRemainIndependent',
  'editorCommentsAreProvenanceNotMechanicalAuthority',
  'officialUpdateApproximateChangesCannotDeriveExactLapXp',
  'unresolvedConflictMustRemainAnExplicitBlocker',
  'onlyTheSupersededGenericConflictBlockerMayBeReplaced',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden'
];
const EXPECTED_REVISION_CHAIN = [
  '15331454', '15331130', '15313984', '15312490', '15310489',
  '15304185', '15303604', '15301582', '15298955', '15295850',
  '15295847', '15295144', '15294629', '15294612', '15294404',
  '15294160', '15294135', '15294093', '15293630', '15293625',
  '15293606', '15293600', '15293429', '15293428', '15293116'
];
const EXPECTED_STATE_SEGMENTS = [
  { firstRevision: '15293116', lastRevision: '15293625', revisionCount: 6, proseLapXp: 504.1, tableSumXp: 504.1 },
  { firstRevision: '15293630', lastRevision: '15294135', revisionCount: 3, proseLapXp: 504.1, tableSumXp: 601.6 },
  { firstRevision: '15294160', lastRevision: '15294160', revisionCount: 1, proseLapXp: 633, tableSumXp: 601.6 },
  { firstRevision: '15294404', lastRevision: '15294404', revisionCount: 1, proseLapXp: 504.1, tableSumXp: 504.1 },
  { firstRevision: '15294612', lastRevision: '15331454', revisionCount: 14, proseLapXp: 633, tableSumXp: 601.6 }
];
const EXPECTED_OBSTACLE_VARIANT_KEYS = [
  'colossal-wyrm:ladder:1', 'colossal-wyrm:ladder:2', 'colossal-wyrm:ladder:3',
  'colossal-wyrm:tightrope:1', 'colossal-wyrm:tightrope:2', 'colossal-wyrm:tightrope:3',
  'colossal-wyrm:edge:1', 'colossal-wyrm:edge:2', 'colossal-wyrm:edge:3',
  'colossal-wyrm:rope:1', 'colossal-wyrm:rope:2',
  'colossal-wyrm:zipline:basic', 'colossal-wyrm:zipline:advanced'
];
const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const number = value => Number(String(value ?? '').replaceAll(',', ''));
const sum = values => Number(values.reduce((total, value) => total + value, 0).toFixed(10));
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const recordsHash = records => hash(`${records.map(record => json(record)).join('\n')}\n`);
const accountKey = name => /^(?:currentBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

function accountFindings(value) {
  const findings = [];
  const visit = (current, at = '') => {
    if (Array.isArray(current)) return current.forEach((item, index) => visit(item, `${at}[${index}]`));
    if (!current || typeof current !== 'object') return;
    for (const [name, child] of Object.entries(current)) {
      const childAt = at ? `${at}.${name}` : name;
      if (accountKey(name)) findings.push(childAt);
      visit(child, childAt);
    }
  };
  visit(value);
  return findings;
}

function recordHashesValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && validHash(record?.contentHash)
    && record.recordContentHash === contentHash(without(record, ['recordContentHash', 'contentHash']))
    && record.contentHash === contentHash(without(record, ['contentHash']));
}

function locator(content, match, section) {
  return match ? {
    section,
    line: content.slice(0, match.index).split(/\r?\n/).length,
    excerpt: match[0]
  } : null;
}

export function parseColossalWyrmBasicLapXpState(content = '') {
  const prose = /granting a total of\s+([\d,.]+)\s+experience for basic lap completion/i.exec(content);
  const heading = /^===Basic course obstacles===\s*$/mi.exec(content);
  if (!heading) return { proseLapXp: prose ? number(prose[1]) : null, tableValues: [], tableSumXp: null, tableRowCount: 0, locators: { prose: locator(content, prose, 'Gameplay'), table: null } };
  const tail = content.slice(heading.index + heading[0].length);
  const end = tail.search(/^===/m);
  const section = end < 0 ? tail : tail.slice(0, end);
  const tableValues = [...section.matchAll(/\{\{\+=\|xp2?\|([\d.]+)\|/gi)].map(match => number(match[1]));
  return {
    proseLapXp: prose ? number(prose[1]) : null,
    tableValues,
    tableSumXp: tableValues.length ? sum(tableValues) : null,
    tableRowCount: tableValues.length,
    locators: {
      prose: locator(content, prose, 'Gameplay'),
      table: { section: 'Basic course obstacles', line: content.slice(0, heading.index).split(/\r?\n/).length }
    }
  };
}

function parseOfficialUpdateScope(content = '') {
  const relative = /basic course by ~([\d.]+)%[\s\S]{0,100}?advanced course by ~([\d.]+)%[\s\S]{0,220}?Increased XP, Bone shards and Termites to match so that it's roughly the same XP\/hr/i.exec(content);
  const context = relative ? content.slice(Math.max(0, relative.index - 250), relative.index + relative[0].length + 500) : '';
  const exactLapClaim = /(?:[\d,.]+\s+(?:Agility\s+)?(?:experience|XP)\s+per\s+lap|(?:lap|completion)[\s\S]{0,35}?[\d,.]+\s+(?:experience|XP))/i.exec(context);
  return {
    sectionFound: Boolean(relative),
    approximateBasicDurationIncreasePercent: relative ? number(relative[1]) : null,
    approximateAdvancedDurationIncreasePercent: relative ? number(relative[2]) : null,
    rewardsAdjustedToRoughlyRetainXpPerHour: Boolean(relative),
    exactBasicLapXpPublished: Boolean(exactLapClaim),
    locator: locator(content, relative, 'Colossal Wyrm Agility course')
  };
}

function revisionBinding(revision, title) {
  return {
    title,
    revision: String(revision?.revid || ''),
    parentRevision: String(revision?.parentid || ''),
    timestamp: revision?.timestamp || null,
    comment: typeof revision?.comment === 'string' ? revision.comment : null,
    url: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision?.revid || ''}`,
    contentHash: hash(revision?.content || '')
  };
}

function stateOf(revision) {
  const state = parseColossalWyrmBasicLapXpState(revision?.content || '');
  return {
    revision: String(revision?.revid || ''),
    parentRevision: String(revision?.parentid || ''),
    timestamp: revision?.timestamp || null,
    comment: typeof revision?.comment === 'string' ? revision.comment : null,
    proseLapXp: state.proseLapXp,
    tableValues: state.tableValues,
    tableSumXp: state.tableSumXp,
    tableRowCount: state.tableRowCount,
    conflict: Number.isFinite(state.proseLapXp) && Number.isFinite(state.tableSumXp) && state.proseLapXp !== state.tableSumXp,
    locators: state.locators,
    contentHash: hash(revision?.content || '')
  };
}

function compactState(state) {
  if (!state) return null;
  return {
    revision: state.revision,
    timestamp: state.timestamp,
    proseLapXp: state.proseLapXp,
    tableValues: state.tableValues,
    tableSumXp: state.tableSumXp,
    tableRowCount: state.tableRowCount,
    conflict: state.conflict,
    locators: state.locators,
    contentHash: state.contentHash
  };
}

function stateSegments(statesChronological) {
  const segments = [];
  for (const state of statesChronological) {
    const prior = segments.at(-1);
    if (prior && prior.proseLapXp === state.proseLapXp && prior.tableSumXp === state.tableSumXp && prior.tableRowCount === state.tableRowCount) {
      prior.lastRevision = state.revision;
      prior.lastTimestamp = state.timestamp;
      prior.revisionCount += 1;
      prior.revisions.push(state.revision);
    } else {
      segments.push({
        firstRevision: state.revision,
        lastRevision: state.revision,
        firstTimestamp: state.timestamp,
        lastTimestamp: state.timestamp,
        revisionCount: 1,
        revisions: [state.revision],
        proseLapXp: state.proseLapXp,
        tableSumXp: state.tableSumXp,
        tableRowCount: state.tableRowCount,
        conflict: state.conflict
      });
    }
  }
  return segments;
}

function inputLineage(options, policy, contentHash = hash) {
  const temporal = options.inputTemporalReconciliationRecords || [];
  const obstacle = options.inputObstacleVariantRecords || [];
  const temporalSnapshot = options.inputTemporalReconciliationSnapshot || {};
  const obstacleSnapshot = options.inputObstacleVariantSnapshot || {};
  const temporalBasic = temporal.filter(record => record.memberKey === 'colossal-wyrm:basic-route' && record.routePolicy === 'basic_route');
  const basicZipline = obstacle.filter(record => record.variantKey === 'colossal-wyrm:zipline:basic');
  const temporalValid = temporal.length === 2
    && temporal.every(record => record.contract === policy.inputTemporalReconciliationContract && recordHashesValid(record, contentHash))
    && temporal.every(record => record.sourceRevisions?.currentCourse?.revision === policy.revisionAnchors?.currentCourseRevision
      && record.temporalAssignmentComplete === true && record.mechanicalAuthorityComplete === false
      && record.optimizerEligible === false && record.verifiedBestAuthorized === false
      && record.automaticVerificationApplied === false && record.accountIndependent === true)
    && temporalBasic.length === 1
    && temporalBasic[0].sourceRevisions?.currentCourse?.revision === policy.revisionAnchors?.currentCourseRevision
    && temporalBasic[0].postUpdateClaims?.lapXp === policy.expectedStates?.currentConflict?.proseLapXp
    && temporalBasic[0].courseObstacleTable?.sumXp === policy.expectedStates?.currentConflict?.tableSumXp
    && temporalBasic[0].courseObstacleTable?.values?.length === policy.expectedStates?.currentConflict?.tableRowCount
    && temporalBasic[0].remainingBlockers?.includes(policy.supersededBlocker);
  const obstacleValid = obstacle.length === 13
    && same(obstacle.map(record => record.variantKey).sort(), [...EXPECTED_OBSTACLE_VARIANT_KEYS].sort())
    && obstacle.every(record => record.contract === policy.inputObstacleVariantContract && recordHashesValid(record, contentHash))
    && obstacle.every(record => record.identityReconciliationComplete === true
      && record.currentPageFieldsMatchPinnedPreUpdateRevision === true
      && record.mechanicalAuthorityComplete === false && record.optimizerEligible === false
      && record.verifiedBestAuthorized === false && record.automaticVerificationApplied === false
      && record.accountIndependent === true
      && record.sourceRevisions?.currentCourse?.revision === policy.revisionAnchors?.currentCourseRevision)
    && basicZipline.length === 1
    && basicZipline[0].currentPageXp === 243.7
    && basicZipline[0].courseOccurrences?.some(occurrence => occurrence.routePolicy === 'basic_route' && occurrence.xp === 341.2)
    && basicZipline[0].remainingBlockersByRoute?.basic_route?.includes('basic_obstacle_zipline_basic_page_xp_243_7_conflicts_with_course_xp_341_2');
  const temporalSnapshotValid = validHash(temporalSnapshot.contentHash)
    && temporalSnapshot.records === temporal.length
    && temporalSnapshot.contentHash === recordsHash(temporal);
  const obstacleSnapshotValid = validHash(obstacleSnapshot.contentHash)
    && obstacleSnapshot.records === obstacle.length
    && obstacleSnapshot.contentHash === recordsHash(obstacle);
  return {
    temporal: { valid: temporalValid, recordCount: temporal.length, snapshotValid: temporalSnapshotValid, snapshot: temporalSnapshot },
    obstacleVariants: { valid: obstacleValid, recordCount: obstacle.length, snapshotValid: obstacleSnapshotValid, snapshot: obstacleSnapshot },
    complete: temporalValid && obstacleValid && temporalSnapshotValid && obstacleSnapshotValid
  };
}

export function compileAgilityColossalWyrmBasicLapXpConflictPolicy(policy = {}) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation-policy.v1',
    courseTitle: 'Colossal Wyrm Agility Course',
    updateTitle: 'Update:Summer Sweep Up - Agility & Chambers of Xeric Changes',
    inputTemporalReconciliationContract: 'sensum.agility-colossal-wyrm-post-update-mechanics-reconciliation.v1',
    inputTemporalReconciliationDomain: 'agility-colossal-wyrm-post-update-mechanics-reconciliation',
    inputObstacleVariantContract: 'sensum.agility-colossal-wyrm-obstacle-page-variant-reconciliation.v1',
    inputObstacleVariantDomain: 'agility-colossal-wyrm-obstacle-page-variant-reconciliation',
    unresolvedBlocker: 'basic_lap_xp_633_prose_conflicts_with_601_6_eight_row_sum_at_current_revision_15331454',
    supersededBlocker: 'basic_post_update_lap_xp_633_conflicts_with_current_obstacle_table_601_6',
    recordContract: 'sensum.agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation.v1',
    auditContract: 'sensum.agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation-audit.v1',
    outputDomain: 'agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  if (!same(policy.revisionAnchors, {
    currentCourseRevision: '15331454', lastConfirmedPreUpdateRevision: '15293116',
    firstTableDivergenceRevision: '15293630', firstCurrentConflictRevision: '15294160',
    currentConflictRestoredRevision: '15294612', officialUpdateRevision: '15303824'
  })) invalidBindings.push('revisionAnchors');
  if (!same(policy.expectedStates, {
    preUpdate: { proseLapXp: 504.1, tableSumXp: 504.1, tableRowCount: 8 },
    firstDivergence: { proseLapXp: 504.1, tableSumXp: 601.6, tableRowCount: 8 },
    currentConflict: { proseLapXp: 633, tableSumXp: 601.6, tableRowCount: 8 }
  })) invalidBindings.push('expectedStates');
  if (!same(policy.expectedRevisionChain, EXPECTED_REVISION_CHAIN)) invalidBindings.push('expectedRevisionChain');
  if (!same(policy.expectedStateSegmentsChronological, EXPECTED_STATE_SEGMENTS)) invalidBindings.push('expectedStateSegmentsChronological');
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return { valid: !invalidBindings.length && !invalidRules.length, invalidBindings: unique(invalidBindings), invalidRules: unique(invalidRules) };
}

function buildExpected(options = {}, contentHash = hash) {
  const policy = options.policy || {};
  const chain = options.revisionChain || [];
  const chainIds = chain.map(revision => String(revision?.revid || ''));
  const exactChain = same(chainIds, policy.expectedRevisionChain || []);
  const contiguousParentChain = chain.every((revision, index) => index === chain.length - 1 || String(revision?.parentid || '') === String(chain[index + 1]?.revid || ''));
  const contentBearingChain = chain.every(revision => String(revision?.content || '').length > 0
    && String(revision?.revid || '') && String(revision?.parentid || '') && revision?.timestamp
    && typeof revision?.comment === 'string');
  const statesNewestFirst = chain.map(stateOf);
  const allStatesParse = statesNewestFirst.every(state => Number.isFinite(state.proseLapXp)
    && Number.isFinite(state.tableSumXp) && state.tableRowCount === 8 && state.tableValues.length === 8);
  const chronological = [...statesNewestFirst].reverse();
  const segments = stateSegments(chronological);
  const segmentShape = segments.map(segment => ({
    firstRevision: segment.firstRevision,
    lastRevision: segment.lastRevision,
    revisionCount: segment.revisionCount,
    proseLapXp: segment.proseLapXp,
    tableSumXp: segment.tableSumXp
  }));
  const exactSegments = same(segmentShape, policy.expectedStateSegmentsChronological || []);
  const pre = chronological.find(state => state.revision === policy.revisionAnchors?.lastConfirmedPreUpdateRevision);
  const firstDivergence = chronological.find(state => state.conflict);
  const firstCurrentConflict = chronological.find(state => state.proseLapXp === policy.expectedStates?.currentConflict?.proseLapXp
    && state.tableSumXp === policy.expectedStates?.currentConflict?.tableSumXp);
  const conflictRestored = chronological.find(state => state.revision === policy.revisionAnchors?.currentConflictRestoredRevision);
  const current = statesNewestFirst[0];
  const exactAnchoredStates = pre?.revision === policy.revisionAnchors?.lastConfirmedPreUpdateRevision
    && firstDivergence?.revision === policy.revisionAnchors?.firstTableDivergenceRevision
    && firstCurrentConflict?.revision === policy.revisionAnchors?.firstCurrentConflictRevision
    && conflictRestored?.revision === policy.revisionAnchors?.currentConflictRestoredRevision
    && same({ proseLapXp: pre?.proseLapXp, tableSumXp: pre?.tableSumXp, tableRowCount: pre?.tableRowCount }, policy.expectedStates?.preUpdate)
    && same({ proseLapXp: firstDivergence?.proseLapXp, tableSumXp: firstDivergence?.tableSumXp, tableRowCount: firstDivergence?.tableRowCount }, policy.expectedStates?.firstDivergence)
    && same({ proseLapXp: firstCurrentConflict?.proseLapXp, tableSumXp: firstCurrentConflict?.tableSumXp, tableRowCount: firstCurrentConflict?.tableRowCount }, policy.expectedStates?.currentConflict)
    && same({ proseLapXp: conflictRestored?.proseLapXp, tableSumXp: conflictRestored?.tableSumXp, tableRowCount: conflictRestored?.tableRowCount }, policy.expectedStates?.currentConflict)
    && same({ proseLapXp: current?.proseLapXp, tableSumXp: current?.tableSumXp, tableRowCount: current?.tableRowCount }, policy.expectedStates?.currentConflict);
  const course = options.currentCourse || {};
  const update = options.officialUpdate || {};
  const currentCoursePinned = course.title === policy.courseTitle
    && course.sourceRevision === policy.revisionAnchors?.currentCourseRevision
    && course.sourceTimestamp && course.sourceUrl && course.content
    && chain[0]?.content === course.content;
  const updateScope = parseOfficialUpdateScope(update.content || '');
  const officialUpdatePinned = Boolean(update.title === policy.updateTitle
    && update.sourceRevision === policy.revisionAnchors?.officialUpdateRevision
    && update.sourceTimestamp && update.sourceUrl && update.content);
  const officialUpdateScopeValid = officialUpdatePinned && updateScope.sectionFound
    && updateScope.approximateBasicDurationIncreasePercent === 25
    && updateScope.approximateAdvancedDurationIncreasePercent === 40
    && updateScope.rewardsAdjustedToRoughlyRetainXpPerHour
    && updateScope.exactBasicLapXpPublished === false;
  const lineage = inputLineage(options, policy, contentHash);
  const accountStateFindings = accountFindings({
    currentCourse: options.currentCourse,
    officialUpdate: options.officialUpdate,
    revisionChain: options.revisionChain,
    temporal: options.inputTemporalReconciliationRecords,
    obstacle: options.inputObstacleVariantRecords,
    extra: without(options, ['policy', 'currentCourse', 'officialUpdate', 'revisionChain', 'inputTemporalReconciliationRecords', 'inputTemporalReconciliationSnapshot', 'inputObstacleVariantRecords', 'inputObstacleVariantSnapshot', 'contentHash'])
  });
  const sourceReady = exactChain && contiguousParentChain && contentBearingChain && allStatesParse
    && exactSegments && exactAnchoredStates && currentCoursePinned && officialUpdateScopeValid;
  if (!sourceReady || !lineage.complete || accountStateFindings.length) {
    return { records: [], evidence: { exactChain, contiguousParentChain, contentBearingChain, allStatesParse, exactSegments, exactAnchoredStates, currentCoursePinned, officialUpdatePinned, officialUpdateScopeValid, updateScope, lineage, accountStateFindings, statesNewestFirst, segments } };
  }
  const base = {
    contract: policy.recordContract,
    memberKey: 'colossal-wyrm:basic-route',
    routePolicy: 'basic_route',
    inputSnapshots: {
      temporalReconciliation: options.inputTemporalReconciliationSnapshot,
      obstacleVariantReconciliation: options.inputObstacleVariantSnapshot
    },
    sourceRevisions: {
      currentCourse: { title: course.title, revision: course.sourceRevision, timestamp: course.sourceTimestamp, url: course.sourceUrl, contentHash: contentHash(course.content) },
      officialUpdate: { title: update.title, revision: update.sourceRevision, timestamp: update.sourceTimestamp, url: update.sourceUrl, contentHash: contentHash(update.content) },
      lastConfirmedPreUpdate: revisionBinding(chain.at(-1), policy.courseTitle),
      firstTableDivergence: revisionBinding(chain.find(revision => String(revision.revid) === policy.revisionAnchors.firstTableDivergenceRevision), policy.courseTitle),
      firstCurrentConflict: revisionBinding(chain.find(revision => String(revision.revid) === policy.revisionAnchors.firstCurrentConflictRevision), policy.courseTitle),
      currentConflictRestored: revisionBinding(chain.find(revision => String(revision.revid) === policy.revisionAnchors.currentConflictRestoredRevision), policy.courseTitle)
    },
    revisionChain: {
      order: 'newest_to_oldest',
      revisionCount: chain.length,
      currentRevision: chainIds[0],
      endRevision: chainIds.at(-1),
      contiguousByParentId: true,
      revisions: chain.map(revision => revisionBinding(revision, policy.courseTitle)),
      contentHash: contentHash(chain.map(revision => revisionBinding(revision, policy.courseTitle)))
    },
    stateSegmentsChronological: segments,
    preUpdateState: compactState(pre),
    firstDivergenceState: compactState(firstDivergence),
    firstCurrentConflictState: compactState(firstCurrentConflict),
    conflictRestoredState: compactState(conflictRestored),
    currentState: compactState(current),
    officialUpdateScope: {
      ...updateScope,
      authority: 'approximate_relative_change_only',
      exactValuesWereNotDerivedFromApproximatePercentages: true
    },
    editorCommentDisposition: 'revision_provenance_only_not_mechanical_authority',
    claimDisposition: 'unresolved_internal_course_source_conflict_with_exact_contiguous_revision_timeline',
    supersededBlocker: policy.supersededBlocker,
    remainingBlockers: [policy.unresolvedBlocker],
    timelineReconciliationComplete: true,
    conflictResolved: false,
    mechanicalAuthorityComplete: false,
    optimizerEligible: false,
    verifiedBestAuthorized: false,
    automaticVerificationApplied: false,
    accountIndependent: true
  };
  const recordContentHash = contentHash(base);
  const withRecordHash = { ...base, recordContentHash };
  return {
    records: [{ ...withRecordHash, contentHash: contentHash(withRecordHash) }],
    evidence: { exactChain, contiguousParentChain, contentBearingChain, allStatesParse, exactSegments, exactAnchoredStates, currentCoursePinned, officialUpdatePinned, officialUpdateScopeValid, updateScope, lineage, accountStateFindings, statesNewestFirst, segments }
  };
}

export function auditAgilityColossalWyrmBasicLapXpConflictReconciliation(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityColossalWyrmBasicLapXpConflictPolicy(options.policy || {});
  const expected = buildExpected(options, contentHash);
  const recordsMatchExpected = same(records, expected.records);
  const recordHashesAreValid = records.length === 1 && records.every(record => recordHashesValid(record, contentHash));
  const promotionCount = records.filter(record => record.conflictResolved !== false
    || record.mechanicalAuthorityComplete !== false || record.optimizerEligible !== false
    || record.verifiedBestAuthorized !== false || record.automaticVerificationApplied !== false).length;
  const blockers = [];
  if (!policyValidation.valid) blockers.push('basic_lap_xp_conflict_policy_invalid');
  if (!expected.evidence.lineage?.complete) blockers.push('input_reconciliation_lineage_missing_or_invalid');
  if (!expected.evidence.exactChain || !expected.evidence.contiguousParentChain || !expected.evidence.contentBearingChain) blockers.push('course_revision_chain_not_exact_contiguous_and_content_bearing');
  if (!expected.evidence.allStatesParse || !expected.evidence.exactSegments || !expected.evidence.exactAnchoredStates) blockers.push('basic_lap_xp_revision_timeline_drift_or_parse_failure');
  if (!expected.evidence.currentCoursePinned || !expected.evidence.officialUpdatePinned || !expected.evidence.officialUpdateScopeValid) blockers.push('current_course_or_official_update_scope_invalid');
  if (expected.evidence.accountStateFindings?.length) blockers.push('account_query_state_baked_into_basic_lap_xp_reconciliation');
  if (!recordsMatchExpected || !recordHashesAreValid) blockers.push('basic_lap_xp_reconciliation_record_reconstruction_or_hash_validation_failed');
  if (promotionCount) blockers.push('basic_lap_xp_reconciliation_promoted_unresolved_gameplay_authority');
  const timelineReconciliationComplete = blockers.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyValidation,
    inputLineage: expected.evidence.lineage,
    sourceIntegrity: {
      exactRevisionChain: expected.evidence.exactChain,
      contiguousParentChain: expected.evidence.contiguousParentChain,
      contentBearingRevisionChain: expected.evidence.contentBearingChain,
      allRevisionStatesParsedAsEightRows: expected.evidence.allStatesParse,
      currentCoursePinned: expected.evidence.currentCoursePinned,
      officialUpdatePinned: expected.evidence.officialUpdatePinned
    },
    timeline: {
      revisionCount: (options.revisionChain || []).length,
      stateSegmentCount: expected.evidence.segments?.length || 0,
      exactExpectedSegments: expected.evidence.exactSegments,
      exactAnchoredStates: expected.evidence.exactAnchoredStates,
      stateSegmentsChronological: (expected.evidence.segments || []).map(segment => ({
        firstRevision: segment.firstRevision,
        lastRevision: segment.lastRevision,
        revisionCount: segment.revisionCount,
        revisions: segment.revisions,
        proseLapXp: segment.proseLapXp,
        tableSumXp: segment.tableSumXp,
        tableRowCount: segment.tableRowCount,
        conflict: segment.conflict
      })),
      firstDivergenceRevision: expected.evidence.statesNewestFirst?.slice().reverse().find(state => state.conflict)?.revision || null,
      firstCurrentConflictRevision: expected.evidence.statesNewestFirst?.slice().reverse().find(state => state.proseLapXp === 633 && state.tableSumXp === 601.6)?.revision || null
    },
    authorityBoundary: {
      officialUpdateScopeValid: expected.evidence.officialUpdateScopeValid,
      officialUpdateExactBasicLapXpPublished: expected.evidence.updateScope?.exactBasicLapXpPublished ?? null,
      editorCommentsTreatedAsMechanicalAuthority: false,
      conflictResolved: false,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizationCount: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: expected.evidence.accountStateFindings?.length || 0,
      accountStateFindings: expected.evidence.accountStateFindings || []
    },
    recordsMatchExpected,
    recordHashesValid: recordHashesAreValid,
    timelineReconciliationComplete,
    conflictResolved: false,
    mechanicalCompletenessProven: false,
    absoluteBestGate: 'blocked_unresolved_basic_lap_xp_source_conflict',
    publishable: timelineReconciliationComplete,
    blockers
  };
}

export function buildAgilityColossalWyrmBasicLapXpConflictReconciliation(options = {}) {
  const contentHash = options.contentHash || hash;
  const expected = buildExpected(options, contentHash);
  const audit = auditAgilityColossalWyrmBasicLapXpConflictReconciliation(expected.records, { ...options, contentHash });
  return { records: audit.publishable ? expected.records : [], audit };
}
