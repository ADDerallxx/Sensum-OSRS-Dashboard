import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditAgilityColossalWyrmBasicLapXpConflictReconciliation,
  buildAgilityColossalWyrmBasicLapXpConflictReconciliation,
  compileAgilityColossalWyrmBasicLapXpConflictPolicy,
  parseColossalWyrmBasicLapXpState
} from '../ingestion/agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation-lib.mjs';
import { auditAgilityColossalWyrmGuideMemberCoverage } from '../transforms/agility-colossal-wyrm-guide-member-coverage-lib.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const policy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation-v1.json', 'utf8'));
const withHashes = base => {
  const recordContentHash = hash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
};
const snapshot = (directory, records) => ({
  directory,
  records: records.length,
  contentHash: hash(`${records.map(record => json(record)).join('\n')}\n`)
});
const basicRows = finalXp => [37.2, 37.2, 37.2, 37.2, 37.2, 37.2, 37.2, finalXp];
const courseContent = (proseXp, finalXp) => `==Gameplay==
Completing the course rewards the player with experience from each obstacle, granting a total of ${proseXp} experience for basic lap completion, and 1053.6 experience for advanced lap completion.
===Basic course obstacles===
${basicRows(finalXp).map(value => `|-
| obstacle
| {{+=|xp|${value}|echo=2}}`).join('\n')}
===Advanced course obstacles===
|-
| obstacle
| {{+=|xp|1053.6|echo=2}}`;
const preIds = new Set(['15293116', '15293428', '15293429', '15293600', '15293606', '15293625']);
const firstDivergenceIds = new Set(['15293630', '15294093', '15294135']);
const chain = policy.expectedRevisionChain.map((revision, index) => {
  const pre = preIds.has(revision);
  const firstDivergence = firstDivergenceIds.has(revision);
  return {
    revid: revision,
    parentid: policy.expectedRevisionChain[index + 1] || '15290000',
    timestamp: `2026-08-${String(31 - Math.min(index, 20)).padStart(2, '0')}T00:00:00Z`,
    comment: revision === '15294093' ? 'Updated lap times and rough rates after testing' : revision === '15294160' ? 'Updated basic XP per lap' : '',
    content: pre || revision === '15294404' ? courseContent(504.1, 243.7) : firstDivergence ? courseContent(504.1, 341.2) : courseContent(633, 341.2)
  };
});
const currentCourse = {
  title: policy.courseTitle,
  content: chain[0].content,
  sourceRevision: policy.revisionAnchors.currentCourseRevision,
  sourceTimestamp: chain[0].timestamp,
  sourceUrl: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${policy.revisionAnchors.currentCourseRevision}`
};
const officialUpdate = {
  title: policy.updateTitle,
  content: `{{Update|date=12 August 2026|}}
==Colossal Wyrm Agility course==
* Increased the duration of obstacles on the basic course by ~25%.
** The advanced course by ~40%.
* Increased XP, Bone shards and Termites to match so that it's roughly the same XP/hr.
==Other changes==`,
  sourceRevision: policy.revisionAnchors.officialUpdateRevision,
  sourceTimestamp: '2026-08-12T11:00:00Z',
  sourceUrl: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${policy.revisionAnchors.officialUpdateRevision}`
};

const temporalBase = (memberKey, routePolicy, minimumAgility, lapXp, sumXp, blockers) => ({
  contract: policy.inputTemporalReconciliationContract,
  updateDate: '2026-08-12', memberKey, routePolicy, minimumAgility,
  postUpdateClaims: { lapXp },
  courseObstacleTable: { values: routePolicy === 'basic_route' ? basicRows(341.2) : [1053.6], sumXp },
  remainingBlockers: blockers,
  sourceRevisions: { currentCourse: { revision: policy.revisionAnchors.currentCourseRevision } },
  temporalAssignmentComplete: true, mechanicalAuthorityComplete: false,
  optimizerEligible: false, verifiedBestAuthorized: false,
  automaticVerificationApplied: false, accountIndependent: true
});
const temporal = [
  withHashes(temporalBase('colossal-wyrm:basic-route', 'basic_route', 50, 633, 601.6, [policy.supersededBlocker])),
  withHashes(temporalBase('colossal-wyrm:advanced-route', 'advanced_route', 62, 1053.6, 1053.6, ['advanced_rate_unresolved']))
];
const variantKeys = [
  'colossal-wyrm:ladder:1', 'colossal-wyrm:ladder:2', 'colossal-wyrm:ladder:3',
  'colossal-wyrm:tightrope:1', 'colossal-wyrm:tightrope:2', 'colossal-wyrm:tightrope:3',
  'colossal-wyrm:edge:1', 'colossal-wyrm:edge:2', 'colossal-wyrm:edge:3',
  'colossal-wyrm:rope:1', 'colossal-wyrm:rope:2',
  'colossal-wyrm:zipline:basic', 'colossal-wyrm:zipline:advanced'
];
const occurrenceRoutes = {
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
const temporalSnapshot = snapshot('fixture-temporal', temporal);
const obstacle = variantKeys.map(variantKey => {
  const routes = occurrenceRoutes[variantKey];
  const isBasicZipline = variantKey === 'colossal-wyrm:zipline:basic';
  return withHashes({
    contract: policy.inputObstacleVariantContract,
    variantKey,
    currentPageXp: isBasicZipline ? 243.7 : 37.2,
    courseOccurrences: routes.map(routePolicy => ({ routePolicy, xp: isBasicZipline ? 341.2 : 37.2 })),
    preUpdateCourseOccurrences: routes.map(routePolicy => ({ routePolicy, xp: isBasicZipline ? 243.7 : 37.2 })),
    currentPageFieldsMatchPinnedPreUpdateRevision: true,
    identityReconciliationComplete: true,
    remainingBlockersByRoute: Object.fromEntries(routes.map(route => [route, isBasicZipline ? ['basic_obstacle_zipline_basic_page_xp_243_7_conflicts_with_course_xp_341_2'] : []])),
    sourceRevisions: {
      currentCourse: { revision: policy.revisionAnchors.currentCourseRevision },
      inputTemporalReconciliation: { contentHash: temporalSnapshot.contentHash }
    },
    mechanicalAuthorityComplete: false, optimizerEligible: false,
    verifiedBestAuthorized: false, automaticVerificationApplied: false,
    accountIndependent: true
  });
});
const obstacleSnapshot = snapshot('fixture-obstacle', obstacle);
const options = {
  policy, currentCourse, officialUpdate, revisionChain: chain,
  inputTemporalReconciliationRecords: temporal,
  inputTemporalReconciliationSnapshot: temporalSnapshot,
  inputObstacleVariantRecords: obstacle,
  inputObstacleVariantSnapshot: obstacleSnapshot,
  contentHash: hash
};

check(compileAgilityColossalWyrmBasicLapXpConflictPolicy(policy).valid, 'The exact Basic lap-XP conflict policy should compile.');
const alteredChainPolicy = structuredClone(policy);
alteredChainPolicy.expectedRevisionChain[1] = '99999999';
check(!compileAgilityColossalWyrmBasicLapXpConflictPolicy(alteredChainPolicy).valid, 'An altered interior revision must invalidate the policy.');
const alteredSegmentPolicy = structuredClone(policy);
alteredSegmentPolicy.expectedStateSegmentsChronological[3].proseLapXp = 633;
check(!compileAgilityColossalWyrmBasicLapXpConflictPolicy(alteredSegmentPolicy).valid, 'An altered historical state segment must invalidate the policy.');
const parsed = parseColossalWyrmBasicLapXpState(currentCourse.content);
check(parsed.proseLapXp === 633 && parsed.tableRowCount === 8 && parsed.tableSumXp === 601.6, 'The prose and exact eight-row table sum must be parsed independently.');
const built = buildAgilityColossalWyrmBasicLapXpConflictReconciliation(options);
check(built.audit.publishable && built.audit.timelineReconciliationComplete, 'The exact source timeline should publish as a reconciliation artifact.');
check(built.records.length === 1 && built.records[0].revisionChain.revisionCount === 25, 'One Basic-route record must retain all 25 contiguous revisions.');
check(built.audit.timeline.stateSegmentCount === 5
  && built.audit.timeline.firstDivergenceRevision === '15293630'
  && built.audit.timeline.firstCurrentConflictRevision === '15294160', 'All five historical states, including the one-revision reversion, must remain explicit.');
check(built.records[0].preUpdateState.proseLapXp === 504.1 && built.records[0].preUpdateState.tableSumXp === 504.1, 'The pre-update anchor must retain its internally matching 504.1 state.');
check(built.records[0].firstDivergenceState.proseLapXp === 504.1 && built.records[0].firstDivergenceState.tableSumXp === 601.6, 'The table-first divergence must remain distinct from the later prose change.');
check(built.records[0].conflictRestoredState.revision === '15294612' && built.records[0].conflictRestoredState.conflict, 'The conflict restoration after the one-revision reversion must remain explicit.');
check(built.records[0].currentState.proseLapXp === 633 && built.records[0].currentState.tableSumXp === 601.6, 'The current 633-versus-601.6 conflict must remain unresolved.');
check(!built.records[0].conflictResolved && !built.records[0].mechanicalAuthorityComplete
  && !built.records[0].optimizerEligible && !built.records[0].verifiedBestAuthorized, 'Timeline knowledge must not grant gameplay or optimizer authority.');
check(!built.records[0].officialUpdateScope.exactBasicLapXpPublished
  && built.records[0].officialUpdateScope.authority === 'approximate_relative_change_only', 'The official update must remain approximate corroboration, not an exact XP source.');
check(built.records[0].editorCommentDisposition === 'revision_provenance_only_not_mechanical_authority', 'Wiki editor comments must be retained only as provenance.');
check(built.records[0].remainingBlockers[0] === policy.unresolvedBlocker, 'The precise unresolved timeline blocker must survive.');
check(built.records[0].recordContentHash === hash(Object.fromEntries(Object.entries(built.records[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)))), 'The reconciliation record hash must reproduce.');

const members = temporal.map((record, index) => ({
  memberKey: record.memberKey,
  candidateKey: `guide:colossal-wyrm:${index ? 'advanced' : 'basic'}`,
  name: `Colossal Wyrm — ${index ? 'Advanced' : 'Basic'}`,
  sourceOrder: index,
  routePolicy: record.routePolicy,
  minimumAgility: record.minimumAgility,
  guideSourceRevision: '15324367',
  sectionKey: 'other-methods:levels-50-62-colossal-wyrm-agility-course',
  corroboratingMinimumAgility: [record.minimumAgility],
  mechanicalBlockers: ['exact_post_update_mechanics_not_reconciled']
}));
const guideCandidates = members.map(member => ({
  candidate_key: member.candidateKey,
  source_section_key: member.sectionKey,
  source_revision: member.guideSourceRevision,
  minimum_agility: member.minimumAgility
}));
const integrated = auditAgilityColossalWyrmGuideMemberCoverage({
  members, guideCandidates, reconciliation: temporal, obstacleVariants: obstacle,
  basicLapXpConflict: built.records
});
check(integrated.internalMemberAuditSatisfied && integrated.basicLapXpConflictReconciliationApplied, 'The exact timeline must integrate only after both prior snapshots revalidate.');
check(!integrated.mechanicalBlockers.includes(policy.supersededBlocker)
  && integrated.mechanicalBlockers.includes(policy.unresolvedBlocker), 'Downstream coverage must replace only the superseded generic conflict wording.');
check(integrated.memberDetails.find(member => member.routePolicy === 'advanced_route')?.basicLapXpConflictReconciliation === null, 'The Basic-only reconciliation must not alter the Advanced route.');

const brokenParent = structuredClone(chain);
brokenParent[4].parentid = '1';
check(!buildAgilityColossalWyrmBasicLapXpConflictReconciliation({ ...options, revisionChain: brokenParent }).audit.publishable, 'A non-contiguous parent link must fail closed.');
check(!buildAgilityColossalWyrmBasicLapXpConflictReconciliation({ ...options, revisionChain: chain.slice(1) }).audit.publishable, 'A missing revision must fail the exact chain.');
const missingRow = structuredClone(chain);
missingRow[0].content = missingRow[0].content.replace('| {{+=|xp|37.2|echo=2}}', '| no xp value');
check(!buildAgilityColossalWyrmBasicLapXpConflictReconciliation({ ...options, currentCourse: { ...currentCourse, content: missingRow[0].content }, revisionChain: missingRow }).audit.publishable, 'A missing Basic table row must fail instead of changing the sum silently.');
const updateWithExact = { ...officialUpdate, content: officialUpdate.content.replace('==Other changes==', 'The basic course gives 633 XP per lap.\n==Other changes==') };
check(!buildAgilityColossalWyrmBasicLapXpConflictReconciliation({ ...options, officialUpdate: updateWithExact }).audit.publishable, 'A newly published exact update value must force re-audit rather than silently retain the old disposition.');
const tamperedTemporal = structuredClone(temporal);
tamperedTemporal[0].postUpdateClaims.lapXp = 632;
check(!buildAgilityColossalWyrmBasicLapXpConflictReconciliation({ ...options, inputTemporalReconciliationRecords: tamperedTemporal }).audit.publishable, 'A tampered input reconciliation must fail its content and record boundary.');
check(!buildAgilityColossalWyrmBasicLapXpConflictReconciliation({ ...options, currentBaseLevel: 50 }).audit.publishable, 'Account state must be forbidden from the knowledge reconciliation.');
const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
const promotionAudit = auditAgilityColossalWyrmBasicLapXpConflictReconciliation(promoted, options);
check(!promotionAudit.publishable && promotionAudit.blockers.includes('basic_lap_xp_reconciliation_promoted_unresolved_gameplay_authority'), 'Any optimizer promotion must fail closed.');
const invalidIntegration = auditAgilityColossalWyrmGuideMemberCoverage({
  members, guideCandidates, reconciliation: temporal, obstacleVariants: obstacle,
  basicLapXpConflict: promoted
});
check(!invalidIntegration.internalMemberAuditSatisfied
  && invalidIntegration.basicLapXpConflictSetValidationBlockers.includes('basic_lap_xp_conflict_record_hash_invalid'), 'Downstream integration must independently reject a changed reconciliation record.');

console.log(`Agility Colossal Wyrm Basic lap-XP conflict reconciliation checks passed: ${checks}`);
