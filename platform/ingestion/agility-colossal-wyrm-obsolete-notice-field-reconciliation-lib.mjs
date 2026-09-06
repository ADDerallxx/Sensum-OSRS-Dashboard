import { hash, json } from './lib.mjs';

const REQUIRED_RULES = [
  'inputSnapshotsMustBeExplicitlySelectedAndRevalidated',
  'courseRevisionChainMustBeExactContiguousAndContentBearing',
  'obsoleteNoticeMustBeParsedIndependentlyAtEveryRevision',
  'eachNamedFieldMustHaveAnIndependentRecordAndDisposition',
  'sourceObservedValuesRemainDistinctFromMechanicalAuthority',
  'editorCommentsAreProvenanceNotMechanicalAuthority',
  'officialUpdateApproximateChangesCannotDeriveExactMechanics',
  'experimentalAveragesRemainExperimental',
  'unknownSpawnRateMustRemainExplicit',
  'arithmeticContradictionsMustRemainExplicitBlockers',
  'onlyTheGenericObsoleteBlockerMayBeReplaced',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden'
];
const EXPECTED_FIELDS = ['duration', 'experience', 'termites', 'bone_shards'];
const EXPECTED_POLICY_HASHES = {
  revisionAnchors: '8f3d2bd06f37a46839755bdcc45fa5091291c249cbe88a977e29399a8cda0fde',
  revisionChain: '8bfb8e7a44129b37253a03378d93811deaea3672e446e117377480494c92d690',
  fieldSegments: '4eb548d48989c67ae92777c261c8adf245572115b052eb16b378458ca68f6888',
  obsoleteNoticeSegments: '61c449d769efc938afc70fe0ef030189596d3816576cfe221be0fb42cb890ab4'
};
const ROUTES = ['basic_route', 'advanced_route'];
const BASIC_XP_BLOCKER = 'basic_lap_xp_633_prose_conflicts_with_601_6_eight_row_sum_at_current_revision_15331454';
const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const number = value => Number(String(value ?? '').replaceAll(',', ''));
const round = value => Number(value.toFixed(10));
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
  return match ? { section, line: content.slice(0, match.index).split(/\r?\n/).length, excerpt: match[0] } : null;
}

function seconds(minutes, seconds) {
  return number(minutes) * 60 + number(seconds);
}

export function parseColossalWyrmObsoleteNoticeFieldState(content = '') {
  const obsolete = /\{\{Obsolete\|([^\n}]*?)(?:\|)?update=([^\n}]+)\}\}/i.exec(content);
  const basicDuration = /basic course can be completed in\s+(\d+):(\d+\.\d+)/i.exec(content);
  const advancedDuration = /advanced course can be completed in\s+(\d+):(\d+\.\d+)/i.exec(content);
  const experience = /granting a total of\s+([\d,.]+)\s+experience for basic lap completion, and\s+([\d,.]+)\s+experience for advanced lap completion/i.exec(content);
  const termiteScoops = /basic portions[\s\S]{0,180}?yield\s+(\d+)[-–](\d+)[\s\S]{0,180}?advanced-only portions[\s\S]{0,100}?yield\s+(\d+)[-–](\d+)/i.exec(content);
  const boneScoops = /(\d+)% chance[\s\S]{0,100}?scoop up\s+(\d+)[-–](\d+)\s+\[\[blessed bone shards\]\]/i.exec(content);
  const termiteAverage = /expect to receive\s+([\d.]+)[\s\S]{0,300}?\[\[termites\]\]\s+per completion/i.exec(content);
  const boneAverage = /per completion[\s\S]{0,180}?on average, and\s+([\d.]+)/i.exec(content);
  const narrativePeriod = /take roughly\s+(one minute|[\d.]+\s+seconds)\s+to complete each lap/i.exec(content);
  const maximumHourly = /accumulate around\s+(\d+)\s+\[\[termites\]\][\s\S]{0,100}?and\s+(\d+)\s+\[\[Blessed bone shards\|bone shards\]\]\s+per hour/i.exec(content);
  const lessIntense = /less intense estimate of\s+(\d+)\s+laps per hour could provide\s+(\d+)\s+\[\[termites\]\][\s\S]{0,100}?and\s+(\d+)\s+\[\[Blessed bone shards\|bone shards\]\]/i.exec(content);
  const unknownSpawn = /The exact spawn rate is currently unknown\./i.exec(content);
  const periodSeconds = narrativePeriod ? (narrativePeriod[1].toLowerCase() === 'one minute' ? 60 : number(/[\d.]+/.exec(narrativePeriod[1])?.[0])) : null;
  return {
    obsoleteNotice: {
      present: Boolean(obsolete),
      namedFields: obsolete ? obsolete[1].replace(/[.|]+$/g, '').split(',').map(value => value.trim().toLowerCase().replace(/^and\s+/, '').replaceAll(' ', '_')) : [],
      updateTitle: obsolete ? obsolete[2].trim() : null,
      locator: locator(content, obsolete, 'Obsolete notice')
    },
    duration: {
      basicSeconds: basicDuration ? seconds(basicDuration[1], basicDuration[2]) : null,
      advancedSeconds: advancedDuration ? seconds(advancedDuration[1], advancedDuration[2]) : null,
      locators: { basic: locator(content, basicDuration, 'Gameplay'), advanced: locator(content, advancedDuration, 'Gameplay') }
    },
    experience: {
      basicLapXp: experience ? number(experience[1]) : null,
      advancedLapXp: experience ? number(experience[2]) : null,
      locator: locator(content, experience, 'Gameplay')
    },
    termites: {
      basicScoopMin: termiteScoops ? number(termiteScoops[1]) : null,
      basicScoopMax: termiteScoops ? number(termiteScoops[2]) : null,
      advancedScoopMin: termiteScoops ? number(termiteScoops[3]) : null,
      advancedScoopMax: termiteScoops ? number(termiteScoops[4]) : null,
      exactSpawnRateKnown: unknownSpawn ? false : null,
      advancedExperimentalPerCompletion: termiteAverage ? number(termiteAverage[1]) : null,
      narrativePeriodSeconds: periodSeconds,
      maximumHourlyClaim: maximumHourly ? number(maximumHourly[1]) : null,
      lessIntenseLapsPerHour: lessIntense ? number(lessIntense[1]) : null,
      lessIntenseHourlyClaim: lessIntense ? number(lessIntense[2]) : null,
      locators: { scoops: locator(content, termiteScoops, 'Termites'), spawnRate: locator(content, unknownSpawn, 'Termites'), average: locator(content, termiteAverage, 'Termites'), hourly: locator(content, maximumHourly, 'Termites'), lessIntense: locator(content, lessIntense, 'Termites') }
    },
    bone_shards: {
      conditionalChancePercent: boneScoops ? number(boneScoops[1]) : null,
      scoopMin: boneScoops ? number(boneScoops[2]) : null,
      scoopMax: boneScoops ? number(boneScoops[3]) : null,
      exactSpawnRateKnown: unknownSpawn ? false : null,
      advancedExperimentalPerCompletion: boneAverage ? number(boneAverage[1]) : null,
      narrativePeriodSeconds: periodSeconds,
      maximumHourlyClaim: maximumHourly ? number(maximumHourly[2]) : null,
      lessIntenseLapsPerHour: lessIntense ? number(lessIntense[1]) : null,
      lessIntenseHourlyClaim: lessIntense ? number(lessIntense[3]) : null,
      locators: { scoops: locator(content, boneScoops, 'Termites'), spawnRate: locator(content, unknownSpawn, 'Termites'), average: locator(content, boneAverage, 'Termites'), hourly: locator(content, maximumHourly, 'Termites'), lessIntense: locator(content, lessIntense, 'Termites') }
    }
  };
}

function parseOfficialUpdateScope(content = '') {
  const relative = /basic course by ~([\d.]+)%[\s\S]{0,100}?advanced course by ~([\d.]+)%[\s\S]{0,240}?Increased XP, Bone shards and Termites to match so that it's roughly the same XP\/hr and termites\/hr but fewer inputs\/hr/i.exec(content);
  const context = relative ? content.slice(Math.max(0, relative.index - 200), relative.index + relative[0].length + 450) : '';
  const exactDuration = /(?:basic|advanced)[^\n]{0,50}?(?:\d+:\d+|\d+(?:\.\d+)?\s+(?:seconds?|ticks?))/i.test(context);
  const exactExperience = /\d+(?:\.\d+)?\s+(?:Agility\s+)?(?:experience|XP)(?:\s+per\s+(?:lap|completion))?/i.test(context);
  const exactTermites = /\d+(?:\.\d+)?\s+Termites?(?:\s+per\s+(?:scoop|lap|completion|hour))?/i.test(context);
  const exactBoneShards = /\d+(?:\.\d+)?\s+(?:Blessed\s+)?Bone shards?(?:\s+per\s+(?:scoop|lap|completion|hour))?/i.test(context);
  return {
    sectionFound: Boolean(relative),
    approximateBasicDurationIncreasePercent: relative ? number(relative[1]) : null,
    approximateAdvancedDurationIncreasePercent: relative ? number(relative[2]) : null,
    rewardsAdjustedToRoughlyRetainXpAndTermitesPerHour: Boolean(relative),
    fewerInputsPerHourClaimed: Boolean(relative),
    exactValuesPublished: { duration: exactDuration, experience: exactExperience, termites: exactTermites, bone_shards: exactBoneShards },
    locator: locator(content, relative, 'Colossal Wyrm Agility course')
  };
}

function fieldState(revision, field) {
  const parsed = parseColossalWyrmObsoleteNoticeFieldState(revision?.content || '');
  return {
    revision: String(revision?.revid || ''),
    parentRevision: String(revision?.parentid || ''),
    timestamp: revision?.timestamp || null,
    comment: typeof revision?.comment === 'string' ? revision.comment : null,
    value: parsed[field],
    contentHash: hash(revision?.content || '')
  };
}

function comparable(field, value) {
  if (!value) return null;
  if (field === 'duration') return { basicSeconds: value.basicSeconds, advancedSeconds: value.advancedSeconds };
  if (field === 'experience') return { basicLapXp: value.basicLapXp, advancedLapXp: value.advancedLapXp };
  if (field === 'termites') return { basicScoopMin: value.basicScoopMin, basicScoopMax: value.basicScoopMax, advancedScoopMin: value.advancedScoopMin, advancedScoopMax: value.advancedScoopMax };
  return { conditionalChancePercent: value.conditionalChancePercent, scoopMin: value.scoopMin, scoopMax: value.scoopMax };
}

function stateSegments(states, field) {
  const segments = [];
  for (const state of states) {
    const value = comparable(field, state.value);
    const prior = segments.at(-1);
    if (prior && same(prior.value, value)) {
      prior.lastRevision = state.revision;
      prior.lastTimestamp = state.timestamp;
      prior.revisionCount += 1;
      prior.revisions.push(state.revision);
    } else {
      segments.push({ firstRevision: state.revision, lastRevision: state.revision, firstTimestamp: state.timestamp, lastTimestamp: state.timestamp, revisionCount: 1, revisions: [state.revision], value });
    }
  }
  return segments;
}

function segmentShape(segments) {
  return segments.map(segment => ({ firstRevision: segment.firstRevision, lastRevision: segment.lastRevision, revisionCount: segment.revisionCount, ...segment.value }));
}

function obsoleteSegments(revisions) {
  const segments = [];
  for (const revision of revisions) {
    const notice = parseColossalWyrmObsoleteNoticeFieldState(revision.content).obsoleteNotice;
    const prior = segments.at(-1);
    if (prior && prior.present === notice.present && same(prior.namedFields, notice.namedFields) && prior.updateTitle === notice.updateTitle) {
      prior.lastRevision = String(revision.revid);
      prior.revisionCount += 1;
      prior.revisions.push(String(revision.revid));
    } else {
      segments.push({ firstRevision: String(revision.revid), lastRevision: String(revision.revid), revisionCount: 1, revisions: [String(revision.revid)], present: notice.present, namedFields: notice.namedFields, updateTitle: notice.updateTitle });
    }
  }
  return segments;
}

function arithmetic(field, value) {
  if (!['termites', 'bone_shards'].includes(field)) return { applicable: false };
  const average = value.advancedExperimentalPerCompletion;
  const maximumImpliedLapsPerHour = average ? round(value.maximumHourlyClaim / average) : null;
  const narrativeImpliedLapsPerHour = value.narrativePeriodSeconds ? round(3600 / value.narrativePeriodSeconds) : null;
  const lessIntenseImpliedLapsPerHour = average ? round(value.lessIntenseHourlyClaim / average) : null;
  return {
    applicable: true,
    averageIsExperimental: true,
    maximumHourlyClaim: value.maximumHourlyClaim,
    maximumImpliedLapsPerHour,
    narrativePeriodSeconds: value.narrativePeriodSeconds,
    narrativeImpliedLapsPerHour,
    maximumClaimConsistentWithNarrativePeriod: maximumImpliedLapsPerHour === narrativeImpliedLapsPerHour,
    lessIntenseHourlyClaim: value.lessIntenseHourlyClaim,
    lessIntenseImpliedLapsPerHour,
    statedLessIntenseLapsPerHour: value.lessIntenseLapsPerHour,
    lessIntenseClaimConsistentWithStatedLaps: lessIntenseImpliedLapsPerHour === value.lessIntenseLapsPerHour
  };
}

function blockersByRoute(field) {
  if (field === 'duration') return {
    basic_route: ['basic_current_duration_67_8_seconds_is_source_observed_but_obsolete_and_not_exactly_published_by_official_update_15303824'],
    advanced_route: ['advanced_current_duration_82_8_seconds_is_source_observed_but_obsolete_and_not_exactly_published_by_official_update_15303824']
  };
  if (field === 'experience') return {
    basic_route: ['basic_current_experience_is_obsolete_conflicting_and_not_exactly_published_by_official_update_15303824', BASIC_XP_BLOCKER],
    advanced_route: ['advanced_current_experience_is_obsolete_with_obstacle_page_conflicts_and_not_exactly_published_by_official_update_15303824']
  };
  if (field === 'termites') return {
    basic_route: ['basic_termite_per_lap_and_hour_rates_unavailable_because_spawn_rate_is_unknown'],
    advanced_route: ['advanced_termite_3_9_experimental_per_completion_average_not_reconciled_with_current_11_14_and_17_20_scoop_ranges', 'advanced_termite_hourly_234_and_195_claims_conflict_with_current_90_second_and_35_lap_text']
  };
  return {
    basic_route: ['basic_bone_shard_per_lap_and_hour_rates_unavailable_because_termite_spawn_rate_is_unknown'],
    advanced_route: ['advanced_bone_shard_6_9_experimental_per_completion_average_not_reconciled_with_current_80_percent_22_38_scoop_claim', 'advanced_bone_shard_hourly_414_and_345_claims_conflict_with_current_90_second_and_35_lap_text']
  };
}

function claimDisposition(field) {
  if (field === 'duration') return 'source_observed_current_values_remain_marked_obsolete_and_official_update_is_approximate_only';
  if (field === 'experience') return 'current_values_remain_non_authoritative_due_exact_cross_source_conflicts_and_no_exact_official_update_values';
  if (field === 'termites') return 'current_scoop_ranges_source_observed_but_spawn_rate_unknown_and_hourly_claims_arithmetically_inconsistent';
  return 'current_conditional_scoop_range_source_observed_but_spawn_rate_unknown_and_hourly_claims_arithmetically_inconsistent';
}

function validateInputRecords(options, policy, contentHash = hash) {
  const definitions = [
    ['temporalReconciliation', options.inputTemporalRecords || [], options.inputTemporalSnapshot || {}, policy.inputTemporalReconciliationContract, 2],
    ['obstacleVariantReconciliation', options.inputObstacleRecords || [], options.inputObstacleSnapshot || {}, policy.inputObstacleVariantContract, 13],
    ['basicLapXpConflictReconciliation', options.inputBasicLapXpRecords || [], options.inputBasicLapXpSnapshot || {}, policy.inputBasicLapXpContract, 1]
  ];
  const inputs = {};
  for (const [name, records, snapshot, contract, expectedCount] of definitions) {
    const hashesValid = records.every(record => recordHashesValid(record, contentHash));
    const authorityValid = records.every(record => record.contract === contract && record.mechanicalAuthorityComplete === false && record.optimizerEligible === false && record.verifiedBestAuthorized === false && record.automaticVerificationApplied === false && record.accountIndependent === true);
    const snapshotValid = validHash(snapshot.contentHash) && snapshot.records === records.length && snapshot.contentHash === recordsHash(records);
    inputs[name] = { records: records.length, expectedCount, hashesValid, authorityValid, snapshotValid, snapshot };
  }
  const temporal = options.inputTemporalRecords || [];
  const basic = options.inputBasicLapXpRecords || [];
  const semanticBindingsValid = temporal.length === 2
    && temporal.every(record => record.remainingBlockers?.includes(policy.genericObsoleteBlocker) && record.sourceRevisions?.currentCourse?.revision === policy.revisionAnchors.currentCourseRevision)
    && basic.length === 1 && basic[0].remainingBlockers?.includes(BASIC_XP_BLOCKER)
    && basic[0].sourceRevisions?.currentCourse?.revision === policy.revisionAnchors.currentCourseRevision;
  const complete = Object.values(inputs).every(input => input.records === input.expectedCount && input.hashesValid && input.authorityValid && input.snapshotValid) && semanticBindingsValid;
  return { ...inputs, semanticBindingsValid, complete };
}

export function compileAgilityColossalWyrmObsoleteNoticeFieldPolicy(policy = {}) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-obsolete-notice-field-reconciliation-policy.v1',
    courseTitle: 'Colossal Wyrm Agility Course',
    updateTitle: 'Update:Summer Sweep Up - Agility & Chambers of Xeric Changes',
    inputTemporalReconciliationContract: 'sensum.agility-colossal-wyrm-post-update-mechanics-reconciliation.v1',
    inputTemporalReconciliationDomain: 'agility-colossal-wyrm-post-update-mechanics-reconciliation',
    inputObstacleVariantContract: 'sensum.agility-colossal-wyrm-obstacle-page-variant-reconciliation.v1',
    inputObstacleVariantDomain: 'agility-colossal-wyrm-obstacle-page-variant-reconciliation',
    inputBasicLapXpContract: 'sensum.agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation.v1',
    inputBasicLapXpDomain: 'agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation',
    genericObsoleteBlocker: 'current_course_page_obsolete_for_duration_experience_termites_and_bone_shards',
    recordContract: 'sensum.agility-colossal-wyrm-obsolete-notice-field-reconciliation.v1',
    auditContract: 'sensum.agility-colossal-wyrm-obsolete-notice-field-reconciliation-audit.v1',
    outputDomain: 'agility-colossal-wyrm-obsolete-notice-field-reconciliation'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  if (!same(policy.expectedFields, EXPECTED_FIELDS)) invalidBindings.push('expectedFields');
  if (hash(policy.revisionAnchors) !== EXPECTED_POLICY_HASHES.revisionAnchors) invalidBindings.push('revisionAnchors');
  if (hash(policy.expectedRevisionChain) !== EXPECTED_POLICY_HASHES.revisionChain) invalidBindings.push('expectedRevisionChain');
  if (!same(Object.keys(policy.expectedFieldSegmentsChronological || {}), EXPECTED_FIELDS) || hash(policy.expectedFieldSegmentsChronological) !== EXPECTED_POLICY_HASHES.fieldSegments) invalidBindings.push('expectedFieldSegmentsChronological');
  if (hash(policy.expectedObsoleteNoticeSegmentsChronological) !== EXPECTED_POLICY_HASHES.obsoleteNoticeSegments) invalidBindings.push('expectedObsoleteNoticeSegmentsChronological');
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return { valid: !invalidBindings.length && !invalidRules.length, invalidBindings: unique(invalidBindings), invalidRules: unique(invalidRules) };
}

function buildExpected(options = {}, contentHash = hash) {
  const policy = options.policy || {};
  const chain = options.revisionChain || [];
  const ids = chain.map(revision => String(revision?.revid || ''));
  const exactChain = same(ids, policy.expectedRevisionChain || []);
  const contiguousParentChain = chain.every((revision, index) => index === chain.length - 1 || String(revision?.parentid || '') === String(chain[index + 1]?.revid || ''));
  const contentBearingChain = chain.every(revision => String(revision?.content || '').length > 0 && revision?.timestamp && typeof revision?.comment === 'string');
  const chronological = [...chain].reverse();
  const notices = obsoleteSegments(chronological);
  const noticeShape = notices.map(segment => ({ firstRevision: segment.firstRevision, lastRevision: segment.lastRevision, revisionCount: segment.revisionCount, present: segment.present }));
  const exactNoticeTimeline = same(noticeShape, policy.expectedObsoleteNoticeSegmentsChronological || []);
  const currentParsed = parseColossalWyrmObsoleteNoticeFieldState(options.currentCourse?.content || '');
  const expectedNamedFields = ['changes_to_course_durations', 'experience', 'termites', 'bone_shards'];
  const currentNoticeValid = currentParsed.obsoleteNotice.present && same(currentParsed.obsoleteNotice.namedFields, expectedNamedFields) && currentParsed.obsoleteNotice.updateTitle === policy.updateTitle;
  const segmentsByField = Object.fromEntries(EXPECTED_FIELDS.map(field => {
    const states = chronological.map(revision => fieldState(revision, field));
    return [field, { states, segments: stateSegments(states, field) }];
  }));
  const exactFieldSegments = Object.fromEntries(EXPECTED_FIELDS.map(field => [field, same(segmentShape(segmentsByField[field].segments), policy.expectedFieldSegmentsChronological?.[field] || [])]));
  const allFieldValuesParse = EXPECTED_FIELDS.every(field => segmentsByField[field].states.every(state => Object.values(comparable(field, state.value) || {}).every(Number.isFinite)))
    && segmentsByField.termites.states.every(state => state.value.exactSpawnRateKnown === false && Number.isFinite(state.value.advancedExperimentalPerCompletion) && Number.isFinite(state.value.maximumHourlyClaim) && Number.isFinite(state.value.lessIntenseLapsPerHour) && Number.isFinite(state.value.lessIntenseHourlyClaim))
    && segmentsByField.bone_shards.states.every(state => state.value.exactSpawnRateKnown === false && Number.isFinite(state.value.advancedExperimentalPerCompletion) && Number.isFinite(state.value.maximumHourlyClaim) && Number.isFinite(state.value.lessIntenseLapsPerHour) && Number.isFinite(state.value.lessIntenseHourlyClaim));
  const currentCoursePinned = options.currentCourse?.title === policy.courseTitle && options.currentCourse?.sourceRevision === policy.revisionAnchors?.currentCourseRevision && options.currentCourse?.sourceTimestamp && options.currentCourse?.sourceUrl && options.currentCourse?.content === chain[0]?.content;
  const updateScope = parseOfficialUpdateScope(options.officialUpdate?.content || '');
  const updatePinned = options.officialUpdate?.title === policy.updateTitle && options.officialUpdate?.sourceRevision === policy.revisionAnchors?.officialUpdateRevision && options.officialUpdate?.sourceTimestamp && options.officialUpdate?.sourceUrl && options.officialUpdate?.content;
  const updateScopeValid = updatePinned && updateScope.sectionFound && updateScope.approximateBasicDurationIncreasePercent === 25 && updateScope.approximateAdvancedDurationIncreasePercent === 40 && updateScope.rewardsAdjustedToRoughlyRetainXpAndTermitesPerHour && Object.values(updateScope.exactValuesPublished).every(value => value === false);
  const inputLineage = validateInputRecords(options, policy, contentHash);
  const accountStateFindings = accountFindings(without(options, ['contentHash']));
  const sourceReady = exactChain && contiguousParentChain && contentBearingChain && exactNoticeTimeline && currentNoticeValid && Object.values(exactFieldSegments).every(Boolean) && allFieldValuesParse && currentCoursePinned && updateScopeValid;
  if (!sourceReady || !inputLineage.complete || accountStateFindings.length) return { records: [], evidence: { exactChain, contiguousParentChain, contentBearingChain, exactNoticeTimeline, currentNoticeValid, exactFieldSegments, allFieldValuesParse, currentCoursePinned, updateScopeValid, inputLineage, accountStateFindings, sourceReady } };
  const sourceRevisions = {
    currentCourse: { title: options.currentCourse.title, revision: options.currentCourse.sourceRevision, timestamp: options.currentCourse.sourceTimestamp, url: options.currentCourse.sourceUrl, contentHash: hash(options.currentCourse.content) },
    officialUpdate: { title: options.officialUpdate.title, revision: options.officialUpdate.sourceRevision, timestamp: options.officialUpdate.sourceTimestamp, url: options.officialUpdate.sourceUrl, contentHash: hash(options.officialUpdate.content) }
  };
  const records = EXPECTED_FIELDS.map(field => {
    const states = segmentsByField[field].states;
    const current = states.at(-1);
    const pre = states[0];
    const currentArithmetic = arithmetic(field, current.value);
    const base = {
      contract: policy.recordContract,
      field,
      inputSnapshots: {
        temporalReconciliation: options.inputTemporalSnapshot,
        obstacleVariantReconciliation: options.inputObstacleSnapshot,
        basicLapXpConflictReconciliation: options.inputBasicLapXpSnapshot
      },
      sourceRevisions,
      revisionChain: { currentRevision: ids[0], endRevision: ids.at(-1), revisionCount: ids.length, revisions: ids, contentHash: hash(chain.map(revision => ({ revision: String(revision.revid), parentRevision: String(revision.parentid), timestamp: revision.timestamp, comment: revision.comment, contentHash: hash(revision.content) }))) },
      obsoleteNoticeTimeline: { segments: notices, currentNotice: currentParsed.obsoleteNotice },
      stateSegmentsChronological: segmentsByField[field].segments,
      preUpdateState: { revision: pre.revision, timestamp: pre.timestamp, ...pre.value },
      currentState: { revision: current.revision, timestamp: current.timestamp, ...current.value },
      officialUpdateScope: { ...updateScope, authority: 'approximate_relative_change_only_no_exact_field_values' },
      arithmeticConsistency: currentArithmetic,
      claimDisposition: claimDisposition(field),
      supersededBlocker: policy.genericObsoleteBlocker,
      remainingBlockersByRoute: blockersByRoute(field),
      fieldTimelineReconciliationComplete: true,
      fieldMechanicallyResolved: false,
      mechanicalAuthorityComplete: false,
      optimizerEligible: false,
      verifiedBestAuthorized: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      editorCommentDisposition: 'revision_provenance_only_not_mechanical_authority'
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
  return { records, evidence: { exactChain, contiguousParentChain, contentBearingChain, exactNoticeTimeline, currentNoticeValid, exactFieldSegments, allFieldValuesParse, currentCoursePinned, updateScopeValid, inputLineage, accountStateFindings, sourceReady } };
}

export function auditAgilityColossalWyrmObsoleteNoticeFieldReconciliation(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityColossalWyrmObsoleteNoticeFieldPolicy(options.policy || {});
  const expected = buildExpected(options, contentHash);
  const recordsMatchExpected = same(records, expected.records);
  const hashesValid = records.every(record => recordHashesValid(record, contentHash));
  const fieldKeys = records.map(record => record.field);
  const fieldCoverage = { expectedFields: EXPECTED_FIELDS, recordCount: records.length, uniqueFields: unique(fieldKeys), complete: records.length === EXPECTED_FIELDS.length && same(fieldKeys, EXPECTED_FIELDS) };
  const arithmeticRecords = records.filter(record => record.arithmeticConsistency?.applicable);
  const arithmeticConsistency = {
    evaluatedFields: arithmeticRecords.map(record => record.field),
    maximumNarrativeContradictions: arithmeticRecords.filter(record => record.arithmeticConsistency.maximumClaimConsistentWithNarrativePeriod === false).map(record => record.field),
    lessIntenseContradictions: arithmeticRecords.filter(record => record.arithmeticConsistency.lessIntenseClaimConsistentWithStatedLaps === false).map(record => record.field),
    contradictionsPreserved: arithmeticRecords.length === 2 && arithmeticRecords.every(record => record.arithmeticConsistency.maximumClaimConsistentWithNarrativePeriod === false && record.arithmeticConsistency.lessIntenseClaimConsistentWithStatedLaps === false)
  };
  const authorityViolations = records.filter(record => record.fieldMechanicallyResolved !== false || record.mechanicalAuthorityComplete !== false || record.optimizerEligible !== false || record.verifiedBestAuthorized !== false || record.automaticVerificationApplied !== false || record.accountIndependent !== true);
  const allRouteBlockersPresent = records.every(record => ROUTES.every(route => Array.isArray(record.remainingBlockersByRoute?.[route]) && record.remainingBlockersByRoute[route].length));
  const blockers = [];
  if (!policyValidation.valid) blockers.push('colossal_wyrm_obsolete_notice_field_policy_invalid');
  if (!expected.evidence.sourceReady) blockers.push('course_revision_field_timeline_or_official_update_binding_incomplete');
  if (!expected.evidence.inputLineage?.complete) blockers.push('explicit_input_snapshot_lineage_invalid');
  if (!fieldCoverage.complete) blockers.push('duration_experience_termites_or_bone_shards_record_missing');
  if (!recordsMatchExpected || !hashesValid) blockers.push('field_reconciliation_record_reconstruction_or_hash_validation_failed');
  if (!arithmeticConsistency.contradictionsPreserved) blockers.push('termite_or_bone_shard_arithmetic_contradiction_not_preserved');
  if (!allRouteBlockersPresent) blockers.push('field_specific_route_blockers_missing');
  if (authorityViolations.length) blockers.push('obsolete_field_reconciliation_promoted_mechanical_or_optimizer_authority');
  if (expected.evidence.accountStateFindings?.length) blockers.push('account_query_state_baked_into_obsolete_field_reconciliation');
  const publishable = blockers.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyValidation,
    inputLineage: expected.evidence.inputLineage,
    sourceIntegrity: { exactChain: expected.evidence.exactChain === true, contiguousParentChain: expected.evidence.contiguousParentChain === true, contentBearingChain: expected.evidence.contentBearingChain === true, currentCoursePinned: expected.evidence.currentCoursePinned === true, officialUpdateScopeValid: expected.evidence.updateScopeValid === true, allFieldValuesParse: expected.evidence.allFieldValuesParse === true },
    fieldCoverage,
    obsoleteNoticeCoverage: { exactTimeline: expected.evidence.exactNoticeTimeline === true, currentNoticeNamesAllFourFields: expected.evidence.currentNoticeValid === true },
    arithmeticConsistency,
    authorityBoundary: { mechanicalAuthorityCount: authorityViolations.filter(record => record.mechanicalAuthorityComplete).length, optimizerEligibleCount: authorityViolations.filter(record => record.optimizerEligible).length, verifiedBestAuthorizationCount: authorityViolations.filter(record => record.verifiedBestAuthorized).length, automaticVerificationCount: authorityViolations.filter(record => record.automaticVerificationApplied).length, accountStateFindingCount: expected.evidence.accountStateFindings?.length || 0 },
    recordsMatchExpected,
    recordHashesValid: hashesValid,
    fieldTimelineReconciliationComplete: publishable,
    mechanicalCompletenessProven: false,
    absoluteBestGate: 'blocked_colossal_wyrm_obsolete_fields_not_mechanically_authoritative',
    publishable,
    blockers
  };
}

export function buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation(options = {}) {
  const contentHash = options.contentHash || hash;
  const expected = buildExpected(options, contentHash);
  const audit = auditAgilityColossalWyrmObsoleteNoticeFieldReconciliation(expected.records, { ...options, contentHash });
  return { records: audit.publishable ? expected.records : [], audit };
}
