import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditAgilityColossalWyrmRewardClaimTemporalConflictSynthesis,
  buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis,
  compileAgilityColossalWyrmRewardClaimTemporalConflictPolicy
} from '../ingestion/agility-colossal-wyrm-termite-reward-claim-temporal-conflict-synthesis-lib.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const policy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-termite-reward-claim-temporal-conflict-synthesis-v1.json', 'utf8'));
const inputPolicy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-v1.json', 'utf8'));

const claimKeys = inputPolicy.claims.map(claim => claim.claimKey);
const blockers = inputPolicy.expectedBlockers;
const sourceByKey = Object.fromEntries(inputPolicy.sourcePages.map(source => [source.sourceKey, source]));
const sourceForClaim = claimKey => inputPolicy.claims.find(claim => claim.claimKey === claimKey).sourceKey;
const sourceHistories = {
  course_article: [
    ['15331454', '15293428', '2026-09-05T13:53:38Z'],
    ['15293428', '15290000', '2026-08-13T12:00:00Z'],
    ['15290000', '14750069', '2026-08-01T12:00:00Z'],
    ['14750069', '0', '2024-09-25T10:33:53Z']
  ],
  talk_discussion: [
    ['15303841', '14959495', '2026-08-17T08:33:48Z'],
    ['14959495', '14750197', '2025-08-06T00:12:47Z'],
    ['14750197', '0', '2024-09-25T13:58:36Z']
  ],
  official_update: [
    ['15303824', '15293418', '2026-08-17T07:53:45Z'],
    ['15293418', '0', '2026-08-12T10:12:31Z']
  ]
};

const values = {
  exact_spawn_rate_unknown: true,
  advanced_termite_per_completion_average: 3.9,
  advanced_bone_shard_per_completion_average: 6.9,
  advanced_maximum_focus_termite_hourly: 234,
  advanced_maximum_focus_bone_shard_hourly: 414,
  advanced_less_intense_laps_hourly: 35,
  advanced_less_intense_termite_hourly: 195,
  advanced_less_intense_bone_shard_hourly: 345,
  advanced_nominal_lap_seconds: 90,
  advanced_ideal_lap_seconds: 82.8,
  advanced_ideal_completions_hourly: 41,
  basic_section_termite_scoop_range: { minimum: 11, maximum: 14 },
  advanced_section_termite_scoop_range: { minimum: 17, maximum: 20 },
  bone_shard_scoop_chance_percent: 80,
  bone_shard_scoop_range: { minimum: 22, maximum: 38 },
  talk_experimental_termite_average: 3.9,
  official_relative_reward_adjustment: true
};
const introducedAfter = new Set(['advanced_termite_per_completion_average']);
const changedAfter = new Set(['advanced_less_intense_laps_hourly', 'advanced_ideal_lap_seconds']);

function bindings(sourceKey) {
  const source = sourceByKey[sourceKey];
  return sourceHistories[sourceKey].map(([revision, parentRevision, timestamp]) => ({
    title: source.title,
    pageId: source.pageId,
    revision,
    parentRevision,
    timestamp,
    comment: '',
    url: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision}`,
    contentHash: hash(`${sourceKey}:${revision}`)
  }));
}

function timelineRecord(claimKey) {
  const sourceKey = sourceForClaim(claimKey);
  const source = sourceByKey[sourceKey];
  const revisions = bindings(sourceKey);
  const chronological = [...revisions].reverse();
  const currentValue = values[claimKey];
  let segments;
  let firstObserved;
  if (claimKey === policy.boundaryClaimKey) {
    segments = [{
      firstRevision: chronological[0].revision, firstTimestamp: chronological[0].timestamp,
      lastRevision: chronological.at(-1).revision, lastTimestamp: chronological.at(-1).timestamp,
      present: true, value: true, revisionCount: chronological.length,
      revisions: chronological.map(binding => binding.revision)
    }];
    firstObserved = { revision: chronological[0].revision, timestamp: chronological[0].timestamp, present: true, value: true, locator: null };
  } else if (introducedAfter.has(claimKey)) {
    const earlier = chronological.slice(0, 2);
    const later = chronological.slice(2);
    segments = [
      { firstRevision: earlier[0].revision, firstTimestamp: earlier[0].timestamp, lastRevision: earlier.at(-1).revision, lastTimestamp: earlier.at(-1).timestamp, present: false, value: null, revisionCount: earlier.length, revisions: earlier.map(binding => binding.revision) },
      { firstRevision: later[0].revision, firstTimestamp: later[0].timestamp, lastRevision: later.at(-1).revision, lastTimestamp: later.at(-1).timestamp, present: true, value: currentValue, revisionCount: later.length, revisions: later.map(binding => binding.revision) }
    ];
    firstObserved = { revision: later[0].revision, timestamp: later[0].timestamp, present: true, value: currentValue, locator: null };
  } else if (changedAfter.has(claimKey)) {
    const earlier = chronological.slice(0, 2);
    const later = chronological.slice(2);
    const earlierValue = claimKey === 'advanced_less_intense_laps_hourly' ? 50 : 58.8;
    segments = [
      { firstRevision: earlier[0].revision, firstTimestamp: earlier[0].timestamp, lastRevision: earlier.at(-1).revision, lastTimestamp: earlier.at(-1).timestamp, present: true, value: earlierValue, revisionCount: earlier.length, revisions: earlier.map(binding => binding.revision) },
      { firstRevision: later[0].revision, firstTimestamp: later[0].timestamp, lastRevision: later.at(-1).revision, lastTimestamp: later.at(-1).timestamp, present: true, value: currentValue, revisionCount: later.length, revisions: later.map(binding => binding.revision) }
    ];
    firstObserved = { revision: earlier[0].revision, timestamp: earlier[0].timestamp, present: true, value: earlierValue, locator: null };
  } else {
    segments = [{
      firstRevision: chronological[0].revision, firstTimestamp: chronological[0].timestamp,
      lastRevision: chronological.at(-1).revision, lastTimestamp: chronological.at(-1).timestamp,
      present: true, value: currentValue, revisionCount: chronological.length,
      revisions: chronological.map(binding => binding.revision)
    }];
    firstObserved = { revision: chronological[0].revision, timestamp: chronological[0].timestamp, present: true, value: currentValue, locator: null };
  }
  const currentState = { revision: revisions[0].revision, timestamp: revisions[0].timestamp, present: true, value: currentValue, locator: null };
  const base = {
    contract: policy.inputRecordContract,
    claimKey,
    source,
    revisionHistory: {
      order: 'newest_to_oldest', revisionCount: revisions.length,
      currentRevision: revisions[0].revision, creationRevision: revisions.at(-1).revision,
      contiguousByParentId: true, apiPaginationComplete: true, completeToPageCreation: true,
      oldestVisibleParentRevision: '0', revisions, contentHash: hash(revisions)
    },
    stateSegmentsChronological: segments,
    firstObservedState: firstObserved,
    currentState,
    claimHistoricallyObserved: true,
    claimCurrentlyPresent: true,
    transitionCount: segments.length - 1,
    remainingBlockers: blockers,
    mechanicalAuthorityComplete: false,
    optimizerEligible: false,
    verifiedBestAuthorized: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false
  };
  const recordContentHash = hash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

const timelineRecords = claimKeys.map(timelineRecord);
const timelineRaw = `${timelineRecords.map(record => json(record)).join('\n')}\n`;
const timelineManifest = {
  contract: 'sensum.ingestion-manifest.v1',
  domain: policy.inputSnapshotDomain,
  records: timelineRecords.length,
  contentHash: hash(timelineRaw),
  snapshotDirectory: 'timeline-snapshot'
};
const timelineAuditBase = {
  contract: policy.inputAuditContract,
  publishable: true,
  outputSnapshot: { directory: timelineManifest.snapshotDirectory, contentHash: timelineManifest.contentHash, records: timelineRecords.length }
};
const timelineAudit = { ...timelineAuditBase, contentHash: hash(timelineAuditBase) };
const options = { policy, inputPolicy, timelineAudit, timelineManifest, timelineRecords, contentHash: hash };

check(compileAgilityColossalWyrmRewardClaimTemporalConflictPolicy(policy).valid, 'The exact temporal-conflict policy should compile.');
check(hash(inputPolicy) === policy.inputPolicyContentHash, 'The synthesis must bind the exact timeline policy bytes.');
const built = buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis(options);
check(built.audit.publishable, 'A complete exact timeline should produce a publishable temporal synthesis.');
check(built.records.length === 6 && built.audit.blockerCoverage.exact, 'Every open mechanics blocker should have one exact synthesis record.');
check(built.audit.claimCoverage.distinctClaimsCovered === 17 && built.audit.claimCoverage.exact, 'All 17 timeline claims must participate in at least one blocker synthesis.');
check(Object.values(built.audit.temporalCoverage.uniqueClaimRelationshipCounts).reduce((sum, value) => sum + value, 0) === 17, 'Unique temporal relationship totals must count claims rather than repeated blocker bindings.');
check(built.audit.temporalCoverage.uniqueClaimPostBoundaryTransitions < built.audit.temporalCoverage.blockerClaimBindingPostBoundaryTransitions, 'Unique and repeated blocker-binding transition totals must remain visibly distinct.');
check(built.records.every(record => record.mechanicallyResolved === false && record.mechanicalFactsCreated === 0), 'Chronology must not resolve mechanics or create facts.');
check(built.records.every(record => record.officialUpdateBoundary.firstObservedRevision === '15293418'), 'Every record should bind the boundary claim to its first observed revision.');
const termiteAverage = built.records.flatMap(record => record.claimTemporalStates).find(state => state.claimKey === 'advanced_termite_per_completion_average');
check(termiteAverage.relationshipToOfficialUpdateBoundary === 'introduced_after_boundary', 'A first appearance after the boundary should remain explicitly introduced after it.');
check(termiteAverage.stateAtOrBeforeBoundary?.present === false && termiteAverage.stateAtOrBeforeBoundary.value === null, 'Absence before the boundary must remain null rather than zero.');
const lapEstimate = built.records.flatMap(record => record.claimTemporalStates).find(state => state.claimKey === 'advanced_less_intense_laps_hourly');
check(lapEstimate.relationshipToOfficialUpdateBoundary === 'present_before_boundary_changed_after_boundary', 'A later value transition should be classified distinctly.');
check(lapEstimate.stateAtOrBeforeBoundary.value === 50 && lapEstimate.currentState.value === 35, 'The synthesis should preserve before/current values without arithmetic.');
check(lapEstimate.postBoundaryTransitions.length === 1 && lapEstimate.postBoundaryTransitions[0].value === 35, 'Every post-boundary transition should remain directly inspectable.');
const unchanged = built.records.flatMap(record => record.claimTemporalStates).find(state => state.claimKey === 'exact_spawn_rate_unknown');
check(unchanged.relationshipToOfficialUpdateBoundary === 'present_before_boundary_unchanged_after_boundary', 'An unchanged claim should not be mislabeled as an update change.');
const boundary = built.records.flatMap(record => record.claimTemporalStates).find(state => state.claimKey === policy.boundaryClaimKey);
check(boundary.relationshipToOfficialUpdateBoundary === 'boundary_source_claim', 'The official claim must define rather than merely follow the boundary.');
check(built.audit.temporalCoverage.chronologyOnly && built.audit.authorityBoundary.allSixBlockersRemainOpen, 'The audit must keep chronology and authority separate.');
check(built.records.every(record => record.recordContentHash === hash(Object.fromEntries(Object.entries(record).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))))), 'Every record content hash should reproduce.');
check(built.records.every(record => record.contentHash === hash(Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'contentHash')))), 'Every final record hash should reproduce.');
check(JSON.stringify(buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis(options)) === JSON.stringify(buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis(options)), 'Identical inputs should reproduce identical output.');

const reordered = structuredClone(timelineRecords);
[reordered[0], reordered[1]] = [reordered[1], reordered[0]];
check(!buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis({ ...options, timelineRecords: reordered }).audit.publishable, 'Timeline population reordering must fail closed.');

const brokenParent = structuredClone(timelineRecords);
brokenParent[0].revisionHistory.revisions[0].parentRevision = 'wrong';
check(!buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis({ ...options, timelineRecords: brokenParent }).audit.publishable, 'A broken parent chain must fail closed.');

const brokenTimestamp = structuredClone(timelineRecords);
brokenTimestamp[0].revisionHistory.revisions[0].timestamp = 'not-a-time';
check(!buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis({ ...options, timelineRecords: brokenTimestamp }).audit.publishable, 'An invalid revision timestamp must fail closed.');

const alteredSegment = structuredClone(timelineRecords);
alteredSegment[0].stateSegmentsChronological[0].revisions.pop();
check(!buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis({ ...options, timelineRecords: alteredSegment }).audit.publishable, 'Incomplete segment coverage must fail closed.');

const accountState = buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis({ ...options, accountState: { username: 'not-allowed' } });
check(!accountState.audit.publishable, 'Account state must be rejected from the evidence synthesis.');

const promoted = structuredClone(built.records);
promoted[0].mechanicallyResolved = true;
check(!auditAgilityColossalWyrmRewardClaimTemporalConflictSynthesis(promoted, options).publishable, 'A chronology-based mechanics promotion must fail independent audit.');

const invalidPolicy = structuredClone(policy);
invalidPolicy.blockerClaimSets[0].claimKeys.pop();
check(!compileAgilityColossalWyrmRewardClaimTemporalConflictPolicy(invalidPolicy).valid, 'A changed blocker/claim mapping must invalidate the policy.');

const noArgs = spawnSync(process.execPath, ['platform/ingestion/synthesize-agility-colossal-wyrm-termite-reward-claim-temporal-conflicts.mjs'], { encoding: 'utf8' });
check(noArgs.status !== 0, 'The CLI must reject implicit timeline inputs.');
check(`${noArgs.stdout}${noArgs.stderr}`.includes('explicit --timeline-audit='), 'The CLI should name its first missing explicit input.');

console.log(`Agility Colossal Wyrm reward claim temporal-conflict synthesis checks passed: ${checks}`);
