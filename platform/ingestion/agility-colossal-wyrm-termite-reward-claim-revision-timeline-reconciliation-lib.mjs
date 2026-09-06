import { hash, json } from './lib.mjs';

const SOURCE_PAGES = [
  { sourceKey: 'course_article', title: 'Colossal Wyrm Agility Course', pageId: 537856, currentRevision: '15331454', authorityClass: 'current_article' },
  { sourceKey: 'talk_discussion', title: 'Talk:Colossal Wyrm Agility Course', pageId: 537905, currentRevision: '15303841', authorityClass: 'experimental_discussion' },
  { sourceKey: 'official_update', title: 'Update:Summer Sweep Up - Agility & Chambers of Xeric Changes', pageId: 678645, currentRevision: '15303824', authorityClass: 'historical_update_archive' }
];

const CLAIMS = [
  ['exact_spawn_rate_unknown', 'course_article', 'exact_spawn_rate_unknown', 'boolean'],
  ['advanced_termite_per_completion_average', 'course_article', 'advanced_termite_per_completion_average', 'number'],
  ['advanced_bone_shard_per_completion_average', 'course_article', 'advanced_bone_shard_per_completion_average', 'number'],
  ['advanced_maximum_focus_termite_hourly', 'course_article', 'advanced_maximum_focus_termite_hourly', 'number'],
  ['advanced_maximum_focus_bone_shard_hourly', 'course_article', 'advanced_maximum_focus_bone_shard_hourly', 'number'],
  ['advanced_less_intense_laps_hourly', 'course_article', 'advanced_less_intense_laps_hourly', 'number'],
  ['advanced_less_intense_termite_hourly', 'course_article', 'advanced_less_intense_termite_hourly', 'number'],
  ['advanced_less_intense_bone_shard_hourly', 'course_article', 'advanced_less_intense_bone_shard_hourly', 'number'],
  ['advanced_nominal_lap_seconds', 'course_article', 'advanced_nominal_lap_seconds', 'number'],
  ['advanced_ideal_lap_seconds', 'course_article', 'advanced_ideal_lap_seconds', 'number'],
  ['advanced_ideal_completions_hourly', 'course_article', 'advanced_ideal_completions_hourly', 'number'],
  ['basic_section_termite_scoop_range', 'course_article', 'basic_section_termite_scoop_range', 'range'],
  ['advanced_section_termite_scoop_range', 'course_article', 'advanced_section_termite_scoop_range', 'range'],
  ['bone_shard_scoop_chance_percent', 'course_article', 'bone_shard_scoop_chance_percent', 'number'],
  ['bone_shard_scoop_range', 'course_article', 'bone_shard_scoop_range', 'range'],
  ['talk_experimental_termite_average', 'talk_discussion', 'talk_experimental_termite_average', 'number'],
  ['official_relative_reward_adjustment', 'official_update', 'official_relative_reward_adjustment', 'boolean']
].map(([claimKey, sourceKey, parserKey, valueType]) => ({ claimKey, sourceKey, parserKey, valueType }));

const EXPECTED_BLOCKERS = [
  'advanced_bone_shard_6_9_experimental_per_completion_average_not_reconciled_with_current_80_percent_22_38_scoop_claim',
  'advanced_bone_shard_hourly_414_and_345_claims_conflict_with_current_90_second_and_35_lap_text',
  'advanced_termite_3_9_experimental_per_completion_average_not_reconciled_with_current_11_14_and_17_20_scoop_ranges',
  'advanced_termite_hourly_234_and_195_claims_conflict_with_current_90_second_and_35_lap_text',
  'basic_bone_shard_per_lap_and_hour_rates_unavailable_because_termite_spawn_rate_is_unknown',
  'basic_termite_per_lap_and_hour_rates_unavailable_because_spawn_rate_is_unknown'
];

const REQUIRED_RULES = [
  'inputDiscoveryAuditSnapshotAndPolicyMustBeExplicitAndRevalidated',
  'timelineSourcesMustComeFromExactDiscoverySignals',
  'everySourceHistoryMustStartAtItsPinnedRevisionAndReachItsOldestApiVisibleRevision',
  'unavailablePredecessorsMustRemainExplicitHistoricalBoundaryGaps',
  'everySourceHistoryMustBeContiguousByParentRevision',
  'everyRevisionMustBeTimestampedAndContentBearing',
  'everyDeclaredClaimMustProduceAnIndependentTimeline',
  'everyDeclaredClaimMustMatchItsPinnedCurrentRevision',
  'claimAbsenceAndNumericZeroMustRemainDistinct',
  'editorCommentsAreProvenanceNotMechanicalAuthority',
  'talkEvidenceCannotEstablishMechanics',
  'officialRelativeChangesCannotDeriveExactCurrentValues',
  'historicalPresenceDoesNotMakeAClaimCurrentOrAuthoritative',
  'allSixExistingBlockersMustRemainOpen',
  'noArithmeticReconciliationOrMechanicalFactCreationIsAllowed',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];

const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const number = value => Number(String(value ?? '').replaceAll(',', ''));
const recordsHash = records => hash(`${records.map(record => json(record)).join('\n')}\n`);

export const normalizeRevisionId = value => String(value ?? '');

function locator(content, match, section) {
  if (!match) return null;
  return {
    section,
    line: content.slice(0, match.index).split(/\r?\n/).length,
    excerpt: match[0].slice(0, 700)
  };
}

function scalar(content, regex, section) {
  const match = regex.exec(content);
  return { value: match ? number(match[1]) : null, locator: locator(content, match, section) };
}

function booleanClaim(content, regex, section) {
  const match = regex.exec(content);
  return { value: match ? true : null, locator: locator(content, match, section) };
}

function range(content, regex, section) {
  const match = regex.exec(content);
  return { value: match ? { minimum: number(match[1]), maximum: number(match[2]) } : null, locator: locator(content, match, section) };
}

export function parseColossalWyrmRewardClaim(content = '', parserKey = '') {
  const source = String(content || '');
  if (parserKey === 'exact_spawn_rate_unknown') return booleanClaim(source, /exact spawn rate is currently unknown/i, 'Rewards');
  if (parserKey === 'advanced_termite_per_completion_average') return scalar(source, /expect to receive\s+([\d.]+)[\s\S]{0,180}?\[\[termites\]\]\s+per completion of the\s+'''advanced'''\s+course/i, 'Rewards');
  if (parserKey === 'advanced_bone_shard_per_completion_average') return scalar(source, /and\s+([\d.]+)[\s\S]{0,100}?\[\[blessed bone shards\]\]/i, 'Rewards');
  if (parserKey === 'advanced_maximum_focus_termite_hourly') return scalar(source, /accumulate around\s+([\d,]+)\s+\[\[termites\]\][\s\S]{0,120}?per hour with maximum efficiency and focus/i, 'Rewards');
  if (parserKey === 'advanced_maximum_focus_bone_shard_hourly') return scalar(source, /around\s+[\d,]+\s+\[\[termites\]\]\s+and\s+([\d,]+)[\s\S]{0,100}?bone shards\]\]\s+per hour with maximum efficiency and focus/i, 'Rewards');
  if (parserKey === 'advanced_less_intense_laps_hourly') return scalar(source, /less intense estimate of\s+([\d,]+)\s+laps per hour/i, 'Rewards');
  if (parserKey === 'advanced_less_intense_termite_hourly') return scalar(source, /less intense estimate of[\s\S]{0,100}?could provide\s+([\d,]+)\s+\[\[termites\]\]/i, 'Rewards');
  if (parserKey === 'advanced_less_intense_bone_shard_hourly') return scalar(source, /less intense estimate of[\s\S]{0,160}?\[\[termites\]\]\s+and\s+([\d,]+)[\s\S]{0,100}?bone sh/i, 'Rewards');
  if (parserKey === 'advanced_nominal_lap_seconds') return scalar(source, /roughly\s+([\d.]+)\s+seconds to complete each lap of the advanced course/i, 'Rewards');
  if (parserKey === 'advanced_ideal_lap_seconds') {
    const match = /advanced course can be completed in\s+(\d+):(\d+(?:\.\d+)?)/i.exec(source);
    return { value: match ? Number((number(match[1]) * 60 + number(match[2])).toFixed(2)) : null, locator: locator(source, match, 'Advanced course') };
  }
  if (parserKey === 'advanced_ideal_completions_hourly') return scalar(source, /advanced course can be completed in[\s\S]{0,80}?allowing roughly\s+([\d,]+)\s+completions per hour/i, 'Advanced course');
  if (parserKey === 'basic_section_termite_scoop_range') return range(source, /basic portions[\s\S]{0,180}?yield\s+([\d,]+)[–-]([\d,]+)\s+\[\[termites\]\]\s+per scoop/i, 'Rewards');
  if (parserKey === 'advanced_section_termite_scoop_range') return range(source, /advanced-only portions[\s\S]{0,100}?yield\s+([\d,]+)[–-]([\d,]+)\s+per scoop/i, 'Rewards');
  if (parserKey === 'bone_shard_scoop_chance_percent') return scalar(source, /([\d.]+)%\s+chance to scoop up\s+[\d,]+[–-][\d,]+\s+\[\[blessed bone shards\]\]/i, 'Rewards');
  if (parserKey === 'bone_shard_scoop_range') return range(source, /[\d.]+%\s+chance to scoop up\s+([\d,]+)[–-]([\d,]+)\s+\[\[blessed bone shards\]\]/i, 'Rewards');
  if (parserKey === 'talk_experimental_termite_average') return scalar(source, /data points to\s+([\d.]+)\s+on average/i, 'Advanced course reward rates');
  if (parserKey === 'official_relative_reward_adjustment') return booleanClaim(source, /Increased XP, Bone shards and Termites to match so that it's roughly the same XP\/hr and termites\/hr but fewer inputs\/hr/i, 'Colossal Wyrm Agility course');
  return { value: null, locator: null };
}

function accountFindings(value) {
  const findings = [];
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|accountState|accountSnapshot|bank|bankItems|ownedEquipment|preferences)$/i;
  const visit = (current, path = '') => {
    if (Array.isArray(current)) return current.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!current || typeof current !== 'object') return;
    for (const [key, child] of Object.entries(current)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
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

export function compileAgilityColossalWyrmRewardClaimTimelinePolicy(policy = {}, contentHash = hash) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-policy.v1',
    inputAuditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-audit.v1',
    inputSnapshotDomain: 'agility-colossal-wyrm-termite-reward-rate-source-discovery',
    inputRecordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery.v1',
    inputPolicy: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-policy.v1',
    inputPolicyContentHash: 'ebf01daa4a3af026f01d5064363d3c95cf516eec143776058a4345652471e825',
    recordContract: 'sensum.agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation.v1',
    auditContract: 'sensum.agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-audit.v1',
    outputDomain: 'agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  if (!same(policy.sourcePages, SOURCE_PAGES)) invalidBindings.push('sourcePages');
  if (!same(policy.claims, CLAIMS)) invalidBindings.push('claims');
  if (!same(policy.expectedBlockers, EXPECTED_BLOCKERS)) invalidBindings.push('expectedBlockers');
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return { valid: !invalidBindings.length && !invalidRules.length, invalidBindings: unique(invalidBindings), invalidRules: unique(invalidRules) };
}

function validateInput(options, policy, contentHash = hash) {
  const audit = options.discoveryAudit || {};
  const manifest = options.discoveryManifest || {};
  const records = options.discoveryRecords || [];
  const inputPolicy = options.inputPolicy || {};
  const auditHashValid = audit.contentHash === contentHash(without(audit, ['contentHash']));
  const blockers = records.map(record => record.blocker).sort();
  const signalSources = records.flatMap(record => record.potentialEvidenceSignals || []);
  const sourceBindingsExact = SOURCE_PAGES.every(source => signalSources.some(signal => signal.title === source.title
    && Number(signal.pageId) === source.pageId && String(signal.sourceRevision) === source.currentRevision));
  const checks = {
    auditContractValid: audit.contract === policy.inputAuditContract,
    auditPublishable: audit.publishable === true,
    auditHashValid,
    manifestContractValid: manifest.contract === 'sensum.ingestion-manifest.v1',
    manifestDomainValid: manifest.domain === policy.inputSnapshotDomain,
    manifestCountValid: Number(manifest.records) === records.length,
    manifestHashValid: manifest.contentHash === recordsHash(records),
    auditSnapshotBindingValid: audit.outputSnapshot?.directory === manifest.snapshotDirectory
      && audit.outputSnapshot?.contentHash === manifest.contentHash && Number(audit.outputSnapshot?.records) === records.length,
    policyBindingValid: inputPolicy.policy === policy.inputPolicy && contentHash(inputPolicy) === policy.inputPolicyContentHash,
    recordsExact: records.length === EXPECTED_BLOCKERS.length && same(blockers, [...EXPECTED_BLOCKERS].sort()),
    recordContractsAndHashesValid: records.every(record => record.contract === policy.inputRecordContract && recordHashesValid(record, contentHash)),
    blockersStillOpen: records.every(record => record.existingBlockerPreserved === true && record.mechanicallyResolved === false
      && record.blockersClosed === 0 && record.semanticFactsCreated === 0 && record.optimizerEligible === false
      && record.verifiedBestAuthorized === false && record.automaticVerificationApplied === false && record.accountIndependent === true),
    timelineSourcesBoundToDiscoverySignals: sourceBindingsExact
  };
  return { valid: Object.values(checks).every(Boolean), checks, signalSources };
}

function validateHistories(histories = [], policy = {}) {
  const sourceKeys = histories.map(history => history.sourceKey);
  const exactPopulation = histories.length === SOURCE_PAGES.length && same(sourceKeys.sort(), SOURCE_PAGES.map(source => source.sourceKey).sort());
  const findings = SOURCE_PAGES.map(source => {
    const history = histories.find(item => item.sourceKey === source.sourceKey) || {};
    const revisions = history.revisions || [];
    const ids = revisions.map(revision => normalizeRevisionId(revision.revid));
    const identityExact = history.title === source.title && Number(history.pageId) === source.pageId;
    const startsAtPinnedRevision = ids[0] === source.currentRevision;
    const oldestVisibleParentRevision = normalizeRevisionId(revisions.at(-1)?.parentid);
    const reachesCreation = revisions.length > 0 && oldestVisibleParentRevision === '0';
    const paginationComplete = history.paginationComplete === true;
    const contiguous = revisions.every((revision, index) => index === revisions.length - 1
      || normalizeRevisionId(revision.parentid) === normalizeRevisionId(revisions[index + 1]?.revid));
    const uniqueRevisions = new Set(ids).size === ids.length;
    const contentBearing = revisions.every(revision => String(revision.content || '').length > 0
      && String(revision.revid || '') && revision.timestamp && typeof revision.comment === 'string');
    return {
      sourceKey: source.sourceKey, revisionCount: revisions.length, identityExact,
      startsAtPinnedRevision, paginationComplete, reachesCreation,
      oldestVisibleRevision: normalizeRevisionId(revisions.at(-1)?.revid),
      oldestVisibleParentRevision,
      historicalBoundaryExplicit: reachesCreation || Boolean(oldestVisibleParentRevision),
      unavailablePredecessorExplicit: !reachesCreation && Boolean(oldestVisibleParentRevision),
      contiguous, uniqueRevisions, contentBearing
    };
  });
  const requiredBooleanKeys = ['identityExact', 'startsAtPinnedRevision', 'paginationComplete', 'historicalBoundaryExplicit', 'contiguous', 'uniqueRevisions', 'contentBearing'];
  return { exactPopulation, findings, valid: exactPopulation && findings.every(finding => requiredBooleanKeys.every(key => finding[key] === true)) };
}

function revisionBinding(revision, source) {
  return {
    title: source.title,
    pageId: source.pageId,
    revision: String(revision.revid || ''),
    parentRevision: String(revision.parentid || ''),
    timestamp: revision.timestamp || null,
    comment: typeof revision.comment === 'string' ? revision.comment : null,
    url: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision.revid || ''}`,
    contentHash: hash(revision.content || '')
  };
}

function statesForClaim(history, claim) {
  return (history.revisions || []).map(revision => {
    const parsed = parseColossalWyrmRewardClaim(revision.content || '', claim.parserKey);
    return {
      revision: String(revision.revid || ''), parentRevision: String(revision.parentid || ''),
      timestamp: revision.timestamp || null, value: parsed.value, present: parsed.value !== null,
      locator: parsed.locator, contentHash: hash(revision.content || '')
    };
  });
}

function stateSegments(statesNewestFirst) {
  const segments = [];
  for (const state of [...statesNewestFirst].reverse()) {
    const prior = segments.at(-1);
    if (prior && same(prior.value, state.value)) {
      prior.lastRevision = state.revision;
      prior.lastTimestamp = state.timestamp;
      prior.revisionCount += 1;
      prior.revisions.push(state.revision);
    } else {
      segments.push({
        firstRevision: state.revision, lastRevision: state.revision,
        firstTimestamp: state.timestamp, lastTimestamp: state.timestamp,
        revisionCount: 1, revisions: [state.revision], value: state.value, present: state.present
      });
    }
  }
  return segments;
}

function authorityDisposition(sourceKey) {
  if (sourceKey === 'talk_discussion') return 'experimental_discussion_timeline_only_not_mechanical_authority';
  if (sourceKey === 'official_update') return 'historical_relative_change_timeline_only_not_exact_current_mechanic';
  return 'current_article_claim_timeline_only_not_mechanical_reconciliation';
}

function buildExpected(options = {}, contentHash = hash) {
  const policy = options.policy || {};
  const input = validateInput(options, policy, contentHash);
  const historyIntegrity = validateHistories(options.sourceHistories || [], policy);
  const accountStateFindings = accountFindings({
    discoveryAudit: options.discoveryAudit, discoveryManifest: options.discoveryManifest,
    discoveryRecords: options.discoveryRecords, sourceHistories: options.sourceHistories,
    extra: without(options, ['policy', 'inputPolicy', 'discoveryAudit', 'discoveryManifest', 'discoveryRecords', 'sourceHistories', 'contentHash'])
  });
  if (!input.valid || !historyIntegrity.valid || accountStateFindings.length) {
    return { records: [], evidence: { input, historyIntegrity, accountStateFindings, currentClaimsPresent: false } };
  }
  const records = [];
  let currentClaimsPresent = true;
  for (const claim of CLAIMS) {
    const source = SOURCE_PAGES.find(item => item.sourceKey === claim.sourceKey);
    const history = options.sourceHistories.find(item => item.sourceKey === claim.sourceKey);
    const states = statesForClaim(history, claim);
    const chronological = [...states].reverse();
    const firstObserved = chronological.find(state => state.present) || null;
    const current = states[0] || null;
    const segments = stateSegments(states);
    if (!current?.present) currentClaimsPresent = false;
    const base = {
      contract: policy.recordContract,
      claimKey: claim.claimKey,
      parserKey: claim.parserKey,
      valueType: claim.valueType,
      source: { ...source, sourceUrl: `https://oldschool.runescape.wiki/w/${source.title.replaceAll(' ', '_')}` },
      inputDiscovery: {
        auditContentHash: options.discoveryAudit.contentHash,
        snapshotDirectory: options.discoveryManifest.snapshotDirectory,
        snapshotContentHash: options.discoveryManifest.contentHash
      },
      revisionHistory: {
        order: 'newest_to_oldest', revisionCount: history.revisions.length,
        currentRevision: String(history.revisions[0].revid), creationRevision: String(history.revisions.at(-1).revid),
        contiguousByParentId: true,
        apiPaginationComplete: true,
        completeToPageCreation: normalizeRevisionId(history.revisions.at(-1).parentid) === '0',
        oldestVisibleParentRevision: normalizeRevisionId(history.revisions.at(-1).parentid),
        historicalBoundaryDisposition: normalizeRevisionId(history.revisions.at(-1).parentid) === '0'
          ? 'page_creation_reached'
          : 'oldest_api_visible_revision_has_unavailable_predecessor',
        revisions: history.revisions.map(revision => revisionBinding(revision, source)),
        contentHash: contentHash(history.revisions.map(revision => revisionBinding(revision, source)))
      },
      stateSegmentsChronological: segments,
      firstObservedState: firstObserved,
      currentState: current,
      claimHistoricallyObserved: Boolean(firstObserved),
      claimCurrentlyPresent: current?.present === true,
      transitionCount: Math.max(0, segments.length - 1),
      authorityDisposition: authorityDisposition(claim.sourceKey),
      editorCommentsDisposition: 'revision_provenance_only_not_mechanical_authority',
      arithmeticReconciliationApplied: false,
      remainingBlockers: [...EXPECTED_BLOCKERS],
      blockersClosed: 0,
      semanticFactsCreated: 0,
      mechanicalAuthorityComplete: false,
      optimizerEligible: false,
      verifiedBestAuthorized: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      completeWikiUniverseClaimed: false
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    records.push({ ...withRecordHash, contentHash: contentHash(withRecordHash) });
  }
  return { records, evidence: { input, historyIntegrity, accountStateFindings, currentClaimsPresent } };
}

export function auditAgilityColossalWyrmRewardClaimTimeline(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityColossalWyrmRewardClaimTimelinePolicy(options.policy || {}, contentHash);
  const expected = buildExpected(options, contentHash);
  const recordsMatchExpected = same(records, expected.records);
  const hashesValid = records.length === CLAIMS.length && records.every(record => recordHashesValid(record, contentHash));
  const claimKeys = records.map(record => record.claimKey);
  const sourceHistoryRevisionCounts = Object.fromEntries((options.sourceHistories || []).map(history => [history.sourceKey, history.revisions?.length || 0]));
  const promotionCount = records.filter(record => record.blockersClosed !== 0 || record.semanticFactsCreated !== 0
    || record.mechanicalAuthorityComplete !== false || record.optimizerEligible !== false
    || record.verifiedBestAuthorized !== false || record.automaticVerificationApplied !== false
    || record.completeWikiUniverseClaimed !== false).length;
  const blockers = [];
  if (!policyValidation.valid) blockers.push('reward_claim_timeline_policy_invalid');
  if (!expected.evidence.input?.valid) blockers.push('input_discovery_lineage_missing_or_invalid');
  if (!expected.evidence.historyIntegrity?.valid) blockers.push('source_revision_histories_not_exact_contiguous_content_bearing_or_complete_to_api_visible_boundary');
  if (!expected.evidence.currentClaimsPresent) blockers.push('one_or_more_declared_claims_not_found_at_pinned_current_revision');
  if (expected.evidence.accountStateFindings?.length) blockers.push('account_state_baked_into_reward_claim_timeline');
  if (!same(claimKeys.sort(), CLAIMS.map(claim => claim.claimKey).sort())) blockers.push('claim_timeline_population_incomplete_or_duplicated');
  if (!recordsMatchExpected || !hashesValid) blockers.push('reward_claim_timeline_reconstruction_or_hash_validation_failed');
  if (promotionCount) blockers.push('reward_claim_timeline_promoted_unresolved_mechanics');
  const timelineReconciliationComplete = blockers.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyValidation,
    inputLineage: expected.evidence.input,
    sourceHistoryIntegrity: {
      ...expected.evidence.historyIntegrity,
      revisionCounts: sourceHistoryRevisionCounts,
      pageCreationReachedSources: expected.evidence.historyIntegrity?.findings?.filter(finding => finding.reachesCreation).length || 0,
      unavailablePredecessorSources: expected.evidence.historyIntegrity?.findings?.filter(finding => !finding.reachesCreation).length || 0
    },
    claimCoverage: {
      expectedClaims: CLAIMS.length, outputClaims: records.length,
      distinctClaimKeys: new Set(claimKeys).size,
      currentlyPresentClaims: records.filter(record => record.claimCurrentlyPresent).length,
      historicallyObservedClaims: records.filter(record => record.claimHistoricallyObserved).length,
      exact: records.length === CLAIMS.length && new Set(claimKeys).size === CLAIMS.length
    },
    timelineCoverage: {
      totalRevisionBindings: records.reduce((sum, record) => sum + Number(record.revisionHistory?.revisionCount || 0), 0),
      uniqueSourceRevisionBindings: (options.sourceHistories || []).reduce((sum, history) => sum + Number(history.revisions?.length || 0), 0),
      stateSegments: records.reduce((sum, record) => sum + Number(record.stateSegmentsChronological?.length || 0), 0),
      transitions: records.reduce((sum, record) => sum + Number(record.transitionCount || 0), 0)
    },
    authorityBoundary: {
      sixExistingBlockersRemainOpen: records.every(record => same(record.remainingBlockers, EXPECTED_BLOCKERS)),
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      mechanicalAuthorityCount: records.filter(record => record.mechanicalAuthorityComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizationCount: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: expected.evidence.accountStateFindings?.length || 0,
      completeWikiUniverseClaims: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    recordsMatchExpected,
    recordHashesValid: hashesValid,
    timelineReconciliationComplete,
    mechanicalCompletenessProven: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_colossal_wyrm_reward_mechanics_not_authoritative',
    publishable: timelineReconciliationComplete,
    blockers: unique(blockers)
  };
}

export function buildAgilityColossalWyrmRewardClaimTimeline(options = {}) {
  const contentHash = options.contentHash || hash;
  const expected = buildExpected(options, contentHash);
  const audit = auditAgilityColossalWyrmRewardClaimTimeline(expected.records, { ...options, contentHash });
  return { records: audit.publishable ? expected.records : [], audit };
}
