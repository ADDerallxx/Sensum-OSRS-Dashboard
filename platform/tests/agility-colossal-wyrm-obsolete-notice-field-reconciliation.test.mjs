import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditAgilityColossalWyrmObsoleteNoticeFieldReconciliation,
  buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation,
  compileAgilityColossalWyrmObsoleteNoticeFieldPolicy,
  parseColossalWyrmObsoleteNoticeFieldState
} from '../ingestion/agility-colossal-wyrm-obsolete-notice-field-reconciliation-lib.mjs';
import { auditAgilityColossalWyrmGuideMemberCoverage } from '../transforms/agility-colossal-wyrm-guide-member-coverage-lib.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const policy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-obsolete-notice-field-reconciliation-v1.json', 'utf8'));
const withHashes = base => {
  const recordContentHash = hash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
};
const snapshot = (directory, records) => ({ directory, records: records.length, contentHash: hash(`${records.map(record => json(record)).join('\n')}\n`) });
const chronologicalIds = [...policy.expectedRevisionChain].reverse();
const position = revision => chronologicalIds.indexOf(revision);
const segmentFor = (segments, revision) => segments.find(segment => position(revision) >= position(segment.firstRevision) && position(revision) <= position(segment.lastRevision));

function contentFor(revision) {
  const duration = segmentFor(policy.expectedFieldSegmentsChronological.duration, revision);
  const experience = segmentFor(policy.expectedFieldSegmentsChronological.experience, revision);
  const termites = segmentFor(policy.expectedFieldSegmentsChronological.termites, revision);
  const shards = segmentFor(policy.expectedFieldSegmentsChronological.bone_shards, revision);
  const notice = segmentFor(policy.expectedObsoleteNoticeSegmentsChronological, revision);
  const period = position(revision) < position('15301582') ? 'one minute' : '90 seconds';
  const lessLaps = position(revision) < position('15301582') ? 50 : 35;
  return `${notice.present ? '{{Obsolete|Changes to course durations, experience, termites, and bone shards.|update=Update:Summer Sweep Up - Agility & Chambers of Xeric Changes}}\n' : ''}==Gameplay==
Completing the course rewards the player with experience from each obstacle, granting a total of ${experience.basicLapXp} experience for basic lap completion, and ${experience.advancedLapXp} experience for advanced lap completion.
Under ideal conditions, the basic course can be completed in ${Math.floor(duration.basicSeconds / 60)}:${String((duration.basicSeconds % 60).toFixed(2)).padStart(5, '0')}, yielding approximately 49 completions per hour.
The advanced course can be completed in ${Math.floor(duration.advancedSeconds / 60)}:${String((duration.advancedSeconds % 60).toFixed(2)).padStart(5, '0')}, allowing roughly 41 completions per hour.
===Termites===
While completing either course, termites will occasionally spawn. Spawns on the basic portions of the course yield ${termites.basicScoopMin}-${termites.basicScoopMax} [[termites]] per scoop, while spawns on the advanced-only portions of the course yield ${termites.advancedScoopMin}-${termites.advancedScoopMax} per scoop. When collecting termites, players also have an ${shards.conditionalChancePercent}% chance to scoop up ${shards.scoopMin}–${shards.scoopMax} [[blessed bone shards]] in the process.
The exact spawn rate is currently unknown. However, players can expect to receive 3.9 [[termites]] per completion of the advanced course on average, and 6.9 [[blessed bone shards]]. Should players take roughly ${period} to complete each lap of the advanced course, they can accumulate around 234 [[termites]] and 414 [[Blessed bone shards|bone shards]] per hour with maximum efficiency and focus. A less intense estimate of ${lessLaps} laps per hour could provide 195 [[termites]] and 345 [[Blessed bone shards|bone shards]].`;
}

const chain = policy.expectedRevisionChain.map((revision, index) => ({
  revid: revision,
  parentid: policy.expectedRevisionChain[index + 1] || '15290000',
  timestamp: `2026-08-${String(31 - Math.min(index, 20)).padStart(2, '0')}T00:00:00Z`,
  comment: revision === '15331130' || revision === '15331454' ? '/* Termites */' : '',
  content: contentFor(revision)
}));
const currentCourse = {
  title: policy.courseTitle,
  content: chain[0].content,
  sourceRevision: policy.revisionAnchors.currentCourseRevision,
  sourceTimestamp: chain[0].timestamp,
  sourceUrl: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${policy.revisionAnchors.currentCourseRevision}`
};
const officialUpdate = {
  title: policy.updateTitle,
  content: `==Colossal Wyrm Agility course==
* Increased the duration of the Colossal Wyrm Agility course:
** The basic course by ~25%.
** The advanced course by ~40%.
* Increased XP, Bone shards and Termites to match so that it's roughly the same XP/hr and termites/hr but fewer inputs/hr, meaning the course is lower intensity than before.`,
  sourceRevision: policy.revisionAnchors.officialUpdateRevision,
  sourceTimestamp: '2026-08-12T11:00:00Z',
  sourceUrl: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${policy.revisionAnchors.officialUpdateRevision}`
};
const authority = { mechanicalAuthorityComplete: false, optimizerEligible: false, verifiedBestAuthorized: false, automaticVerificationApplied: false, accountIndependent: true };
const temporal = ['basic_route', 'advanced_route'].map(routePolicy => withHashes({
  contract: policy.inputTemporalReconciliationContract,
  memberKey: `colossal-wyrm:${routePolicy.replace('_route', '')}-route`, routePolicy,
  minimumAgility: routePolicy === 'basic_route' ? 50 : 62,
  updateDate: '2026-08-12', temporalAssignmentComplete: true,
  sourceRevisions: { currentCourse: { revision: policy.revisionAnchors.currentCourseRevision } },
  remainingBlockers: [policy.genericObsoleteBlocker, `${routePolicy.replace('_route', '')}_approximate_or_upper_bound_rate_not_exact_expected_rate`], ...authority
}));
const temporalSnapshot = snapshot('fixture-temporal', temporal);
const variantRoutes = {
  'colossal-wyrm:ladder:1': ['basic_route', 'advanced_route'],
  'colossal-wyrm:tightrope:1': ['basic_route', 'advanced_route'],
  'colossal-wyrm:edge:1': ['basic_route', 'advanced_route'],
  'colossal-wyrm:ladder:3': ['basic_route'],
  'colossal-wyrm:tightrope:2': ['basic_route'],
  'colossal-wyrm:edge:2': ['basic_route'],
  'colossal-wyrm:rope:1': ['basic_route'],
  'colossal-wyrm:zipline:basic': ['basic_route'],
  'colossal-wyrm:ladder:2': ['advanced_route'],
  'colossal-wyrm:tightrope:3': ['advanced_route'],
  'colossal-wyrm:edge:3': ['advanced_route'],
  'colossal-wyrm:rope:2': ['advanced_route'],
  'colossal-wyrm:zipline:advanced': ['advanced_route']
};
const obstacle = Object.entries(variantRoutes).map(([variantKey, routes]) => withHashes({
  contract: policy.inputObstacleVariantContract, variantKey,
  identityReconciliationComplete: true,
  currentPageFieldsMatchPinnedPreUpdateRevision: true,
  courseOccurrences: routes.map(routePolicy => ({ routePolicy })),
  preUpdateCourseOccurrences: routes.map(routePolicy => ({ routePolicy })),
  remainingBlockersByRoute: Object.fromEntries(routes.map(route => [route, []])),
  sourceRevisions: { currentCourse: { revision: policy.revisionAnchors.currentCourseRevision }, inputTemporalReconciliation: { contentHash: temporalSnapshot.contentHash } },
  ...authority
}));
const obstacleSnapshot = snapshot('fixture-obstacle', obstacle);
const basicLap = [withHashes({
  contract: policy.inputBasicLapXpContract,
  memberKey: 'colossal-wyrm:basic-route', routePolicy: 'basic_route',
  sourceRevisions: { currentCourse: { revision: policy.revisionAnchors.currentCourseRevision } },
  timelineReconciliationComplete: true, conflictResolved: false,
  revisionChain: { revisionCount: 25 },
  firstDivergenceState: { revision: '15293630' },
  firstCurrentConflictState: { revision: '15294160' },
  currentState: { proseLapXp: 633, tableSumXp: 601.6 },
  supersededBlocker: 'basic_post_update_lap_xp_633_conflicts_with_current_obstacle_table_601_6',
  inputSnapshots: { temporalReconciliation: temporalSnapshot, obstacleVariantReconciliation: obstacleSnapshot },
  remainingBlockers: ['basic_lap_xp_633_prose_conflicts_with_601_6_eight_row_sum_at_current_revision_15331454'], ...authority
})];
const basicLapSnapshot = snapshot('fixture-basic-lap', basicLap);
const options = {
  policy, currentCourse, officialUpdate, revisionChain: chain,
  inputTemporalRecords: temporal, inputTemporalSnapshot: temporalSnapshot,
  inputObstacleRecords: obstacle, inputObstacleSnapshot: obstacleSnapshot,
  inputBasicLapXpRecords: basicLap, inputBasicLapXpSnapshot: basicLapSnapshot,
  contentHash: hash
};

check(compileAgilityColossalWyrmObsoleteNoticeFieldPolicy(policy).valid, 'The field-level obsolete-notice policy should compile.');
const alteredPolicy = structuredClone(policy);
alteredPolicy.expectedFieldSegmentsChronological.duration[0].basicSeconds = 55;
check(!compileAgilityColossalWyrmObsoleteNoticeFieldPolicy(alteredPolicy).valid, 'An altered revision-pinned field state must invalidate the policy.');
const parsed = parseColossalWyrmObsoleteNoticeFieldState(currentCourse.content);
check(parsed.obsoleteNotice.present && parsed.obsoleteNotice.namedFields.length === 4, 'The current obsolete notice must retain all four named fields.');
check(parsed.duration.basicSeconds === 67.8 && parsed.duration.advancedSeconds === 82.8, 'Current source-observed course durations must parse exactly.');
check(parsed.experience.basicLapXp === 633 && parsed.experience.advancedLapXp === 1053.6, 'Current prose lap XP must parse without resolving cross-source conflicts.');
check(parsed.termites.basicScoopMin === 11 && parsed.termites.basicScoopMax === 14 && parsed.termites.advancedScoopMin === 17 && parsed.termites.advancedScoopMax === 20, 'Current termite scoop ranges must parse exactly.');
check(parsed.bone_shards.conditionalChancePercent === 80 && parsed.bone_shards.scoopMin === 22 && parsed.bone_shards.scoopMax === 38, 'Current conditional bone-shard scoop claim must parse exactly.');
check(parsed.termites.exactSpawnRateKnown === false && parsed.bone_shards.exactSpawnRateKnown === false, 'The explicitly unknown spawn rate must remain unknown for both reward fields.');

const built = buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation(options);
check(built.audit.publishable && built.audit.fieldTimelineReconciliationComplete, 'The exact four-field history should publish as a reconciliation artifact.');
check(built.records.length === 4 && built.records.map(record => record.field).join('|') === policy.expectedFields.join('|'), 'Exactly one ordered record must exist for each obsolete-notice field.');
check(built.records.find(record => record.field === 'duration').stateSegmentsChronological.length === 6, 'Duration must retain all six source-observed states.');
check(built.records.find(record => record.field === 'experience').stateSegmentsChronological.length === 5, 'Experience must retain all five source-observed states.');
check(built.records.find(record => record.field === 'termites').stateSegmentsChronological.length === 4, 'Termites must retain all four source-observed range states.');
check(built.records.find(record => record.field === 'bone_shards').stateSegmentsChronological.length === 2, 'Bone shards must retain both source-observed range states.');
check(built.records.every(record => record.obsoleteNoticeTimeline.segments.length === 6), 'The six-state obsolete-banner history must accompany every field.');
check(built.records.every(record => !record.fieldMechanicallyResolved && !record.mechanicalAuthorityComplete && !record.optimizerEligible && !record.verifiedBestAuthorized), 'Timeline reconciliation must not become mechanical or optimizer authority.');
check(built.records.every(record => Object.values(record.officialUpdateScope.exactValuesPublished).every(value => value === false)), 'Approximate official update language must not become exact field values.');
const termite = built.records.find(record => record.field === 'termites');
const shards = built.records.find(record => record.field === 'bone_shards');
check(termite.arithmeticConsistency.maximumImpliedLapsPerHour === 60 && termite.arithmeticConsistency.narrativeImpliedLapsPerHour === 40, 'The termite maximum-hour claim must expose its 60-versus-40 implied-lap mismatch.');
check(termite.arithmeticConsistency.lessIntenseImpliedLapsPerHour === 50 && termite.arithmeticConsistency.statedLessIntenseLapsPerHour === 35, 'The termite less-intense claim must expose its 50-versus-35 mismatch.');
check(shards.arithmeticConsistency.maximumImpliedLapsPerHour === 60 && shards.arithmeticConsistency.lessIntenseImpliedLapsPerHour === 50, 'Bone-shard hourly claims must preserve their incompatible implied lap counts.');
check(built.audit.arithmeticConsistency.contradictionsPreserved, 'Both reward-field arithmetic contradictions must remain explicit.');
check(termite.remainingBlockersByRoute.advanced_route.some(blocker => blocker.includes('3_9_experimental')), 'The advanced termite experimental-average condition mismatch must remain a blocker.');
check(shards.remainingBlockersByRoute.basic_route.some(blocker => blocker.includes('spawn_rate_is_unknown')), 'The Basic bone-shard rate must remain unavailable while spawn rate is unknown.');
check(built.records.every(record => record.recordContentHash === hash(Object.fromEntries(Object.entries(record).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))))), 'Every field record hash must reproduce.');

const members = temporal.map((record, index) => ({
  memberKey: record.memberKey,
  candidateKey: `guide:colossal-wyrm:${index ? 'advanced' : 'basic'}`,
  name: `Colossal Wyrm — ${index ? 'Advanced' : 'Basic'}`,
  sourceOrder: index, routePolicy: record.routePolicy, minimumAgility: record.minimumAgility,
  guideSourceRevision: '15324367', sectionKey: 'other-methods:levels-50-62-colossal-wyrm-agility-course',
  corroboratingMinimumAgility: [record.minimumAgility],
  mechanicalBlockers: [policy.genericObsoleteBlocker, `${record.routePolicy.replace('_route', '')}_current_obstacle_pages_not_reconciled_with_course_table`, ...(record.routePolicy === 'basic_route' ? ['basic_post_update_lap_xp_633_conflicts_with_current_obstacle_table_601_6'] : [])]
}));
const guideCandidates = members.map(member => ({ candidate_key: member.candidateKey, source_section_key: member.sectionKey, source_revision: member.guideSourceRevision, minimum_agility: member.minimumAgility }));
const integrated = auditAgilityColossalWyrmGuideMemberCoverage({ members, guideCandidates, reconciliation: temporal, obstacleVariants: obstacle, basicLapXpConflict: basicLap, obsoleteNoticeFields: built.records });
check(integrated.internalMemberAuditSatisfied && integrated.obsoleteNoticeFieldReconciliationApplied, 'The field records must integrate only after every prior Colossal Wyrm snapshot revalidates.');
check(!integrated.mechanicalBlockers.includes(policy.genericObsoleteBlocker), 'The downstream route audit must replace the broad obsolete blocker.');
check(integrated.mechanicalBlockers.some(blocker => blocker.includes('termite')) && integrated.mechanicalBlockers.some(blocker => blocker.includes('bone_shard')), 'The downstream route audit must retain precise termite and bone-shard blockers.');
check(integrated.memberDetails.every(member => member.obsoleteNoticeFieldReconciliation?.fieldCount === 4), 'Both routes must retain the four-field reconciliation lineage.');

const brokenParent = structuredClone(chain);
brokenParent[3].parentid = '1';
check(!buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation({ ...options, revisionChain: brokenParent }).audit.publishable, 'A non-contiguous revision chain must fail closed.');
const missingNotice = structuredClone(chain);
missingNotice[0].content = missingNotice[0].content.replace(/^\{\{Obsolete[^\n]+\n/, '');
check(!buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation({ ...options, currentCourse: { ...currentCourse, content: missingNotice[0].content }, revisionChain: missingNotice }).audit.publishable, 'A changed current obsolete notice must force re-audit.');
const changedTermites = structuredClone(chain);
changedTermites[0].content = changedTermites[0].content.replace('17-20 per scoop', '17-21 per scoop');
check(!buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation({ ...options, currentCourse: { ...currentCourse, content: changedTermites[0].content }, revisionChain: changedTermites }).audit.publishable, 'A changed current termite range must fail the pinned field timeline.');
const exactUpdate = { ...officialUpdate, content: `${officialUpdate.content}\nThe basic course takes 67.8 seconds.` };
check(!buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation({ ...options, officialUpdate: exactUpdate }).audit.publishable, 'New exact official-update mechanics must force re-audit rather than inherit the approximate disposition.');
const tamperedTemporal = structuredClone(temporal);
tamperedTemporal[0].remainingBlockers = [];
check(!buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation({ ...options, inputTemporalRecords: tamperedTemporal }).audit.publishable, 'A changed upstream record must fail the explicit snapshot boundary.');
check(!buildAgilityColossalWyrmObsoleteNoticeFieldReconciliation({ ...options, currentBaseLevel: 50 }).audit.publishable, 'Account state must be forbidden from the knowledge reconciliation.');
const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
const promotedAudit = auditAgilityColossalWyrmObsoleteNoticeFieldReconciliation(promoted, options);
check(!promotedAudit.publishable && promotedAudit.blockers.includes('obsolete_field_reconciliation_promoted_mechanical_or_optimizer_authority'), 'Any optimizer promotion must fail closed.');

console.log(`Agility Colossal Wyrm obsolete-notice field reconciliation checks passed: ${checks}`);
