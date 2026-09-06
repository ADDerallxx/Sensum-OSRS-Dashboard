import { hash, json } from './lib.mjs';

const CLAIM_KEYS = [
  'exact_spawn_rate_unknown',
  'advanced_termite_per_completion_average',
  'advanced_bone_shard_per_completion_average',
  'advanced_maximum_focus_termite_hourly',
  'advanced_maximum_focus_bone_shard_hourly',
  'advanced_less_intense_laps_hourly',
  'advanced_less_intense_termite_hourly',
  'advanced_less_intense_bone_shard_hourly',
  'advanced_nominal_lap_seconds',
  'advanced_ideal_lap_seconds',
  'advanced_ideal_completions_hourly',
  'basic_section_termite_scoop_range',
  'advanced_section_termite_scoop_range',
  'bone_shard_scoop_chance_percent',
  'bone_shard_scoop_range',
  'talk_experimental_termite_average',
  'official_relative_reward_adjustment'
];

const CLAIM_SOURCE_KEYS = Object.fromEntries(CLAIM_KEYS.map((claimKey, index) => [
  claimKey,
  index === 15 ? 'talk_discussion' : index === 16 ? 'official_update' : 'course_article'
]));

const SOURCE_EXPECTATIONS = {
  course_article: { title: 'Colossal Wyrm Agility Course', pageId: 537856, currentRevision: '15331454', authorityClass: 'current_article' },
  talk_discussion: { title: 'Talk:Colossal Wyrm Agility Course', pageId: 537905, currentRevision: '15303841', authorityClass: 'experimental_discussion' },
  official_update: { title: 'Update:Summer Sweep Up - Agility & Chambers of Xeric Changes', pageId: 678645, currentRevision: '15303824', authorityClass: 'historical_update_archive' }
};

const BLOCKER_CLAIM_SETS = [
  {
    blocker: 'advanced_bone_shard_6_9_experimental_per_completion_average_not_reconciled_with_current_80_percent_22_38_scoop_claim',
    claimKeys: ['advanced_bone_shard_per_completion_average', 'bone_shard_scoop_chance_percent', 'bone_shard_scoop_range', 'official_relative_reward_adjustment'],
    requiredEvidence: 'current_source_authored_equation_or_sampling_scope_linking_spawn_events_scoop_yields_and_bone_shards_per_completion'
  },
  {
    blocker: 'advanced_bone_shard_hourly_414_and_345_claims_conflict_with_current_90_second_and_35_lap_text',
    claimKeys: ['advanced_bone_shard_per_completion_average', 'advanced_maximum_focus_bone_shard_hourly', 'advanced_less_intense_bone_shard_hourly', 'advanced_less_intense_laps_hourly', 'advanced_nominal_lap_seconds', 'advanced_ideal_lap_seconds', 'advanced_ideal_completions_hourly', 'official_relative_reward_adjustment'],
    requiredEvidence: 'current_source_authored_condition_set_reconciling_bone_shards_per_completion_lap_timing_laps_per_hour_and_hourly_yields'
  },
  {
    blocker: 'advanced_termite_3_9_experimental_per_completion_average_not_reconciled_with_current_11_14_and_17_20_scoop_ranges',
    claimKeys: ['exact_spawn_rate_unknown', 'advanced_termite_per_completion_average', 'basic_section_termite_scoop_range', 'advanced_section_termite_scoop_range', 'talk_experimental_termite_average', 'official_relative_reward_adjustment'],
    requiredEvidence: 'current_source_authored_equation_or_sampling_scope_linking_spawn_events_section_scoop_yields_and_termites_per_completion'
  },
  {
    blocker: 'advanced_termite_hourly_234_and_195_claims_conflict_with_current_90_second_and_35_lap_text',
    claimKeys: ['advanced_termite_per_completion_average', 'advanced_maximum_focus_termite_hourly', 'advanced_less_intense_termite_hourly', 'advanced_less_intense_laps_hourly', 'advanced_nominal_lap_seconds', 'advanced_ideal_lap_seconds', 'advanced_ideal_completions_hourly', 'official_relative_reward_adjustment'],
    requiredEvidence: 'current_source_authored_condition_set_reconciling_termites_per_completion_lap_timing_laps_per_hour_and_hourly_yields'
  },
  {
    blocker: 'basic_bone_shard_per_lap_and_hour_rates_unavailable_because_termite_spawn_rate_is_unknown',
    claimKeys: ['exact_spawn_rate_unknown', 'bone_shard_scoop_chance_percent', 'bone_shard_scoop_range', 'official_relative_reward_adjustment'],
    requiredEvidence: 'official_exact_termite_spawn_mechanic_and_basic_course_event_opportunities_needed_for_bone_shard_expectation'
  },
  {
    blocker: 'basic_termite_per_lap_and_hour_rates_unavailable_because_spawn_rate_is_unknown',
    claimKeys: ['exact_spawn_rate_unknown', 'basic_section_termite_scoop_range', 'official_relative_reward_adjustment'],
    requiredEvidence: 'official_exact_termite_spawn_mechanic_and_basic_course_event_opportunities_needed_for_termite_expectation'
  }
];

const REQUIRED_RULES = [
  'inputTimelineAuditSnapshotAndPolicyMustBeExplicitAndRevalidated',
  'allSixBlockerClaimSetsMustBeExactAndDisjointByRecord',
  'allSeventeenTimelineClaimsMustBeCoveredByAtLeastOneBlocker',
  'officialUpdateBoundaryMustComeFromItsOwnTimelineClaim',
  'preBoundaryAndPostBoundaryStatesMustComeFromExactRevisionTimestamps',
  'claimAbsenceAndNumericZeroMustRemainDistinct',
  'temporalOrderCannotEstablishCausalityOrMechanicalAuthority',
  'talkEvidenceCannotEstablishMechanics',
  'officialRelativeChangesCannotDeriveExactCurrentValues',
  'allSixExistingBlockersMustRemainOpen',
  'noArithmeticReconciliationOrMechanicalFactCreationIsAllowed',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];

const RELATIONSHIPS = [
  'boundary_source_claim',
  'introduced_after_boundary',
  'present_before_boundary_changed_after_boundary',
  'present_before_boundary_unchanged_after_boundary'
];

const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const recordsHash = records => hash(`${records.map(record => json(record)).join('\n')}\n`);
const timestamp = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

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

function compactState(state) {
  if (!state) return null;
  return {
    revision: String(state.revision || ''),
    timestamp: state.timestamp || null,
    present: state.present === true,
    value: state.present === true ? state.value : null,
    locator: state.locator || null
  };
}

function segmentForRevision(record, revision) {
  return (record.stateSegmentsChronological || []).find(segment => (segment.revisions || []).includes(revision)) || null;
}

function stateAtRevision(record, binding) {
  if (!binding) return null;
  const segment = segmentForRevision(record, String(binding.revision || ''));
  if (!segment) return null;
  return {
    revision: String(binding.revision || ''),
    timestamp: binding.timestamp || null,
    present: segment.present === true,
    value: segment.present === true ? segment.value : null,
    segmentFirstRevision: segment.firstRevision,
    segmentLastRevision: segment.lastRevision
  };
}

function timelineRecordValid(record, policy, contentHash = hash) {
  if (record?.contract !== policy.inputRecordContract || !recordHashesValid(record, contentHash)) return false;
  if (!CLAIM_KEYS.includes(record.claimKey) || record.claimHistoricallyObserved !== true || record.claimCurrentlyPresent !== true) return false;
  if (record.mechanicalAuthorityComplete !== false || record.optimizerEligible !== false
    || record.verifiedBestAuthorized !== false || record.automaticVerificationApplied !== false
    || record.accountIndependent !== true || record.completeWikiUniverseClaimed !== false) return false;
  if (!same(record.remainingBlockers, BLOCKER_CLAIM_SETS.map(item => item.blocker))) return false;
  const expectedSource = SOURCE_EXPECTATIONS[CLAIM_SOURCE_KEYS[record.claimKey]];
  if (!expectedSource || record.source?.sourceKey !== CLAIM_SOURCE_KEYS[record.claimKey]
    || record.source?.title !== expectedSource.title || Number(record.source?.pageId) !== expectedSource.pageId
    || record.source?.currentRevision !== expectedSource.currentRevision
    || record.source?.authorityClass !== expectedSource.authorityClass) return false;
  const history = record.revisionHistory || {};
  const revisions = history.revisions || [];
  const segments = record.stateSegmentsChronological || [];
  const revisionIds = revisions.map(binding => String(binding.revision || ''));
  const chronologicalIds = [...revisionIds].reverse();
  const segmentIds = segments.flatMap(segment => segment.revisions || []);
  const timestampsValid = revisions.every(binding => timestamp(binding.timestamp) !== null)
    && revisions.every((binding, index) => index === revisions.length - 1
      || timestamp(binding.timestamp) >= timestamp(revisions[index + 1].timestamp));
  const revisionHashesValid = revisions.every(binding => validHash(binding.contentHash))
    && history.contentHash === contentHash(revisions);
  const parentChainValid = revisions.every((binding, index) => index === revisions.length - 1
    ? binding.parentRevision === '0'
    : binding.parentRevision === revisions[index + 1].revision);
  const segmentsValid = segments.length > 0
    && same(segmentIds, chronologicalIds)
    && segments.every(segment => Array.isArray(segment.revisions) && segment.revisions.length === segment.revisionCount
      && segment.firstRevision === segment.revisions[0]
      && segment.lastRevision === segment.revisions.at(-1)
      && timestamp(segment.firstTimestamp) !== null && timestamp(segment.lastTimestamp) !== null)
    && Number(record.transitionCount) === segments.length - 1;
  return history.order === 'newest_to_oldest' && history.apiPaginationComplete === true
    && history.completeToPageCreation === true && history.contiguousByParentId === true
    && history.oldestVisibleParentRevision === '0' && revisions.length === history.revisionCount
    && revisions.length > 0 && new Set(revisionIds).size === revisions.length
    && revisionIds[0] === history.currentRevision && revisionIds.at(-1) === history.creationRevision
    && record.source?.currentRevision === history.currentRevision
    && timestampsValid && revisionHashesValid && parentChainValid && segmentsValid
    && record.currentState?.revision === history.currentRevision && record.currentState?.present === true
    && record.firstObservedState?.present === true && timestamp(record.firstObservedState?.timestamp) !== null;
}

function relationshipFor(record, boundaryClaimKey, boundaryTimestamp) {
  if (record.claimKey === boundaryClaimKey) return 'boundary_source_claim';
  const firstObserved = timestamp(record.firstObservedState?.timestamp);
  if (firstObserved > boundaryTimestamp) return 'introduced_after_boundary';
  const laterTransitions = (record.stateSegmentsChronological || []).filter((segment, index) => index > 0 && timestamp(segment.firstTimestamp) > boundaryTimestamp);
  return laterTransitions.length
    ? 'present_before_boundary_changed_after_boundary'
    : 'present_before_boundary_unchanged_after_boundary';
}

function temporalState(record, boundaryClaimKey, boundaryTimestamp) {
  const revisions = record.revisionHistory.revisions;
  const atOrBefore = revisions.find(binding => timestamp(binding.timestamp) <= boundaryTimestamp) || null;
  const firstAfter = [...revisions].reverse().find(binding => timestamp(binding.timestamp) > boundaryTimestamp) || null;
  const transitionSegmentsAfter = (record.stateSegmentsChronological || [])
    .filter((segment, index) => index > 0 && timestamp(segment.firstTimestamp) > boundaryTimestamp);
  const firstTransition = transitionSegmentsAfter[0] || null;
  return {
    claimKey: record.claimKey,
    sourceKey: record.source.sourceKey,
    sourceAuthorityClass: record.source.authorityClass,
    relationshipToOfficialUpdateBoundary: relationshipFor(record, boundaryClaimKey, boundaryTimestamp),
    firstObservedState: compactState(record.firstObservedState),
    stateAtOrBeforeBoundary: stateAtRevision(record, atOrBefore),
    firstRevisionAfterBoundary: stateAtRevision(record, firstAfter),
    firstTransitionAfterBoundary: firstTransition ? {
      revision: firstTransition.firstRevision,
      timestamp: firstTransition.firstTimestamp,
      present: firstTransition.present === true,
      value: firstTransition.present === true ? firstTransition.value : null
    } : null,
    postBoundaryTransitions: transitionSegmentsAfter.map(segment => ({
      revision: segment.firstRevision,
      timestamp: segment.firstTimestamp,
      present: segment.present === true,
      value: segment.present === true ? segment.value : null
    })),
    postBoundaryTransitionCount: transitionSegmentsAfter.length,
    currentState: compactState(record.currentState),
    temporalOrderEstablishesCausality: false,
    temporalOrderEstablishesMechanicalAuthority: false
  };
}

export function compileAgilityColossalWyrmRewardClaimTemporalConflictPolicy(policy = {}) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-termite-reward-claim-temporal-conflict-synthesis-policy.v1',
    inputAuditContract: 'sensum.agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-audit.v1',
    inputSnapshotDomain: 'agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation',
    inputRecordContract: 'sensum.agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation.v1',
    inputPolicy: 'sensum.agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-policy.v1',
    inputPolicyContentHash: 'cc0cdff5f219bab3969bc2ee34fc97b2e45a4fcaf3e76d4b5c11fdf2c0a55a5a',
    boundaryClaimKey: 'official_relative_reward_adjustment',
    recordContract: 'sensum.agility-colossal-wyrm-termite-reward-claim-temporal-conflict-synthesis.v1',
    auditContract: 'sensum.agility-colossal-wyrm-termite-reward-claim-temporal-conflict-synthesis-audit.v1',
    outputDomain: 'agility-colossal-wyrm-termite-reward-claim-temporal-conflict-synthesis'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  if (!same(policy.blockerClaimSets, BLOCKER_CLAIM_SETS)) invalidBindings.push('blockerClaimSets');
  const coveredClaims = unique(BLOCKER_CLAIM_SETS.flatMap(item => item.claimKeys)).sort();
  if (!same(coveredClaims, [...CLAIM_KEYS].sort())) invalidBindings.push('claimCoverage');
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return { valid: !invalidBindings.length && !invalidRules.length, invalidBindings: unique(invalidBindings), invalidRules: unique(invalidRules) };
}

function validateInput(options, policy, contentHash = hash) {
  const audit = options.timelineAudit || {};
  const manifest = options.timelineManifest || {};
  const records = options.timelineRecords || [];
  const inputPolicy = options.inputPolicy || {};
  const claimKeys = records.map(record => record.claimKey);
  const recordSetExact = records.length === CLAIM_KEYS.length && same(claimKeys, CLAIM_KEYS);
  const sourceHistoriesExact = Object.keys(SOURCE_EXPECTATIONS).every(sourceKey => {
    const sourceRecords = records.filter(record => record.source?.sourceKey === sourceKey);
    return sourceRecords.length > 0 && new Set(sourceRecords.map(record => record.revisionHistory?.contentHash)).size === 1;
  });
  const checks = {
    auditContractValid: audit.contract === policy.inputAuditContract,
    auditPublishable: audit.publishable === true && audit.temporalConflictSynthesisComplete !== true,
    auditHashValid: audit.contentHash === contentHash(without(audit, ['contentHash'])),
    manifestContractValid: manifest.contract === 'sensum.ingestion-manifest.v1',
    manifestDomainValid: manifest.domain === policy.inputSnapshotDomain,
    manifestCountValid: Number(manifest.records) === records.length,
    manifestHashValid: manifest.contentHash === recordsHash(records),
    auditSnapshotBindingValid: audit.outputSnapshot?.directory === manifest.snapshotDirectory
      && audit.outputSnapshot?.contentHash === manifest.contentHash
      && Number(audit.outputSnapshot?.records) === records.length,
    policyBindingValid: inputPolicy.policy === policy.inputPolicy && contentHash(inputPolicy) === policy.inputPolicyContentHash,
    recordSetExact,
    recordsValid: recordSetExact && records.every(record => timelineRecordValid(record, policy, contentHash)),
    sourceHistoriesExact,
    allSixBlockersRemainOpen: records.every(record => same(record.remainingBlockers, BLOCKER_CLAIM_SETS.map(item => item.blocker)))
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

function buildExpected(options, contentHash = hash) {
  const policy = options.policy || {};
  const input = validateInput(options, policy, contentHash);
  const accountStateFindings = accountFindings({
    timelineAudit: options.timelineAudit,
    timelineManifest: options.timelineManifest,
    timelineRecords: options.timelineRecords,
    extra: without(options, ['policy', 'inputPolicy', 'timelineAudit', 'timelineManifest', 'timelineRecords', 'contentHash'])
  });
  const recordsByClaim = new Map((options.timelineRecords || []).map(record => [record.claimKey, record]));
  const boundaryRecord = recordsByClaim.get(policy.boundaryClaimKey);
  const boundaryTimestamp = timestamp(boundaryRecord?.firstObservedState?.timestamp);
  const boundaryValid = boundaryTimestamp !== null
    && boundaryRecord?.source?.authorityClass === 'historical_update_archive'
    && boundaryRecord?.firstObservedState?.value === true
    && boundaryRecord?.currentState?.value === true;
  if (!input.valid || !boundaryValid || accountStateFindings.length) {
    return { records: [], evidence: { input, accountStateFindings, boundaryValid, boundaryTimestamp } };
  }
  const records = BLOCKER_CLAIM_SETS.map(definition => {
    const claimTemporalStates = definition.claimKeys.map(claimKey => temporalState(recordsByClaim.get(claimKey), policy.boundaryClaimKey, boundaryTimestamp));
    const relationshipCounts = Object.fromEntries(RELATIONSHIPS.map(relationship => [
      relationship,
      claimTemporalStates.filter(state => state.relationshipToOfficialUpdateBoundary === relationship).length
    ]));
    const boundary = compactState(boundaryRecord.firstObservedState);
    const base = {
      contract: policy.recordContract,
      blocker: definition.blocker,
      inputTimeline: {
        auditContentHash: options.timelineAudit.contentHash,
        snapshotDirectory: options.timelineManifest.snapshotDirectory,
        snapshotContentHash: options.timelineManifest.contentHash,
        records: options.timelineRecords.length
      },
      officialUpdateBoundary: {
        claimKey: policy.boundaryClaimKey,
        sourceKey: boundaryRecord.source.sourceKey,
        sourceTitle: boundaryRecord.source.title,
        sourceRevision: boundaryRecord.source.currentRevision,
        firstObservedRevision: boundary.revision,
        firstObservedTimestamp: boundary.timestamp,
        value: boundary.value,
        authorityDisposition: 'official_relative_change_notice_only_not_exact_current_mechanics'
      },
      claimTemporalStates,
      relationshipCounts,
      requiredEvidence: definition.requiredEvidence,
      synthesisDisposition: 'unresolved_chronology_only_cannot_reconcile_mechanics',
      temporalSynthesisComplete: true,
      causalityEstablished: false,
      mechanicallyResolved: false,
      blockersClosed: 0,
      mechanicalFactsCreated: 0,
      arithmeticReconciliationApplied: false,
      mechanicalAuthorityComplete: false,
      optimizerEligible: false,
      verifiedBestAuthorized: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      completeWikiUniverseClaimed: false
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
  return { records, evidence: { input, accountStateFindings, boundaryValid, boundaryTimestamp } };
}

export function auditAgilityColossalWyrmRewardClaimTemporalConflictSynthesis(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityColossalWyrmRewardClaimTemporalConflictPolicy(options.policy || {});
  const expected = buildExpected(options, contentHash);
  const recordsMatchExpected = same(records, expected.records);
  const hashesValid = records.length === BLOCKER_CLAIM_SETS.length && records.every(record => recordHashesValid(record, contentHash));
  const blockersFound = records.map(record => record.blocker);
  const claimStates = records.flatMap(record => record.claimTemporalStates || []);
  const uniqueClaimStates = [...new Map(claimStates.map(state => [state.claimKey, state])).values()];
  const coveredClaims = unique(claimStates.map(state => state.claimKey));
  const promotionCount = records.filter(record => record.mechanicallyResolved !== false || record.blockersClosed !== 0
    || record.mechanicalFactsCreated !== 0 || record.arithmeticReconciliationApplied !== false
    || record.mechanicalAuthorityComplete !== false || record.optimizerEligible !== false
    || record.verifiedBestAuthorized !== false || record.automaticVerificationApplied !== false
    || record.completeWikiUniverseClaimed !== false).length;
  const blockers = [];
  if (!policyValidation.valid) blockers.push('reward_claim_temporal_conflict_policy_invalid');
  if (!expected.evidence.input?.valid) blockers.push('input_claim_timeline_lineage_missing_or_invalid');
  if (!expected.evidence.boundaryValid) blockers.push('official_update_boundary_claim_missing_or_invalid');
  if (expected.evidence.accountStateFindings?.length) blockers.push('account_state_baked_into_temporal_conflict_synthesis');
  if (!same(blockersFound, BLOCKER_CLAIM_SETS.map(item => item.blocker))) blockers.push('blocker_temporal_synthesis_population_incomplete_or_reordered');
  if (!same([...coveredClaims].sort(), [...CLAIM_KEYS].sort())) blockers.push('timeline_claims_not_completely_covered_by_blocker_synthesis');
  if (!recordsMatchExpected || !hashesValid) blockers.push('temporal_conflict_synthesis_reconstruction_or_hash_validation_failed');
  if (promotionCount) blockers.push('temporal_sequence_promoted_to_gameplay_authority');
  const complete = blockers.length === 0;
  return {
    contract: options.policy?.auditContract,
    policyValidation,
    inputLineage: expected.evidence.input,
    blockerCoverage: {
      expectedBlockers: BLOCKER_CLAIM_SETS.length,
      outputRecords: records.length,
      distinctBlockers: new Set(blockersFound).size,
      exact: records.length === BLOCKER_CLAIM_SETS.length && same(blockersFound, BLOCKER_CLAIM_SETS.map(item => item.blocker))
    },
    claimCoverage: {
      expectedClaims: CLAIM_KEYS.length,
      distinctClaimsCovered: coveredClaims.length,
      blockerClaimBindings: claimStates.length,
      exact: same([...coveredClaims].sort(), [...CLAIM_KEYS].sort())
    },
    temporalCoverage: {
      officialUpdateBoundaryValid: expected.evidence.boundaryValid,
      officialUpdateBoundaryTimestamp: expected.evidence.boundaryTimestamp ? new Date(expected.evidence.boundaryTimestamp).toISOString() : null,
      blockerClaimBindingRelationshipCounts: Object.fromEntries(RELATIONSHIPS.map(relationship => [relationship, claimStates.filter(state => state.relationshipToOfficialUpdateBoundary === relationship).length])),
      uniqueClaimRelationshipCounts: Object.fromEntries(RELATIONSHIPS.map(relationship => [relationship, uniqueClaimStates.filter(state => state.relationshipToOfficialUpdateBoundary === relationship).length])),
      blockerClaimBindingPostBoundaryTransitions: claimStates.reduce((sum, state) => sum + Number(state.postBoundaryTransitionCount || 0), 0),
      uniqueClaimPostBoundaryTransitions: uniqueClaimStates.reduce((sum, state) => sum + Number(state.postBoundaryTransitionCount || 0), 0),
      chronologyOnly: claimStates.every(state => state.temporalOrderEstablishesCausality === false && state.temporalOrderEstablishesMechanicalAuthority === false)
    },
    authorityBoundary: {
      allSixBlockersRemainOpen: records.every(record => record.mechanicallyResolved === false && record.blockersClosed === 0),
      causalityEstablishedCount: records.filter(record => record.causalityEstablished).length,
      mechanicallyResolvedCount: records.filter(record => record.mechanicallyResolved).length,
      mechanicalFactsCreated: records.reduce((sum, record) => sum + Number(record.mechanicalFactsCreated || 0), 0),
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      verifiedBestAuthorizationCount: records.filter(record => record.verifiedBestAuthorized).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: expected.evidence.accountStateFindings?.length || 0,
      completeWikiUniverseClaims: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    recordsMatchExpected,
    recordHashesValid: hashesValid,
    temporalConflictSynthesisComplete: complete,
    mechanicalCompletenessProven: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_colossal_wyrm_reward_mechanics_not_authoritative',
    publishable: complete,
    blockers: unique(blockers)
  };
}

export function buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis(options = {}) {
  const contentHash = options.contentHash || hash;
  const expected = buildExpected(options, contentHash);
  const audit = auditAgilityColossalWyrmRewardClaimTemporalConflictSynthesis(expected.records, { ...options, contentHash });
  return { records: audit.publishable ? expected.records : [], audit };
}
