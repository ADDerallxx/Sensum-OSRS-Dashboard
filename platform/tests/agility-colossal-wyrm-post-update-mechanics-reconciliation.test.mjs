import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditAgilityColossalWyrmPostUpdateMechanicsReconciliation,
  buildAgilityColossalWyrmPostUpdateMechanicsReconciliation,
  compileAgilityColossalWyrmPostUpdatePolicy
} from '../ingestion/agility-colossal-wyrm-post-update-mechanics-reconciliation-lib.mjs';
import { auditAgilityColossalWyrmGuideMemberCoverage } from '../transforms/agility-colossal-wyrm-guide-member-coverage-lib.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const policy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-post-update-mechanics-reconciliation-v1.json', 'utf8'));
const page = (title, content, revision, timestamp = '2026-09-05T00:00:00Z') => ({ title, content, sourceRevision: String(revision), sourceTimestamp: timestamp, sourceUrl: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision}` });
const preText = `Both courses share a common entrance ladder and first tightrope obstacle, granting a total of 504.1 experience for basic lap completion, and 749.6 experience for advanced lap completion.
Under ideal conditions, the basic course can be completed in 0:54.00, yielding approximately 61–62 completions per hour (including 3.6 seconds of downtime between laps) and ~31,000 xp/hr.
The advanced course can be completed in 0:58.80, allowing roughly 57 completions per hour and ~42,000 xp/hr.`;
const postClaims = `Both courses share a common entrance ladder and first tightrope obstacle, granting a total of 633 experience for basic lap completion, and 1053.6 experience for advanced lap completion.
Under ideal conditions, the basic course can be completed in 1:07.80, yielding approximately 49 completions per hour (including 3.6 seconds of downtime between laps) and ~31,000 xp/hr.
The advanced course can be completed in 1:22.80, allowing roughly 41 completions per hour and ~43,000 xp/hr.`;
const prior = `Prior to the [[Update:Summer Sweep Up - Agility & Chambers of Xeric Changes|2026 Summer Sweep Up Second Batch]], the basic course could be completed in 0:54.00 and the advanced course in 0:58.80.`;
const tables = `===Basic course obstacles===
{{+=|xp|37.2|echo=2}}
{{+=|xp|37.2|echo=2}}
{{+=|xp|37.2|echo=2}}
{{+=|xp|37.2|echo=2}}
{{+=|xp|37.2|echo=2}}
{{+=|xp|37.2|echo=2}}
{{+=|xp|37.2|echo=2}}
{{+=|xp|341.2|echo=2}}
===Advanced course obstacles===
{{+=|xp2|37.2|echo=2}}
{{+=|xp2|37.2|echo=2}}
{{+=|xp2|37.2|echo=2}}
{{+=|xp2|70|echo=2}}
{{+=|xp2|70|echo=2}}
{{+=|xp2|70|echo=2}}
{{+=|xp2|70|echo=2}}
{{+=|xp2|662|echo=2}}
===Termites===`;
const currentCourse = page(policy.courseTitle, `{{Obsolete|Changes to course durations, experience, termites, and bone shards.|update=x}}
${postClaims}
${prior}
${tables}`, '15331454');
const guide = page(policy.guideTitle, `There are two routes, the basic course requires 50 Agility and gives up to 31,000 xp/hr, and the advanced course requires 62 Agility and gives up to 42,000 xp/hr. The advanced route requires only 6 clicks per 60-second lap.`, '15331211');
const overview = page(policy.overviewTitle, `The regular course consists of six obstacles and gives 504.1 experience per lap. At level 62 Agility the player can do the Advanced Course. The Advanced course consists of six obstacles and gives 749.6 experience per lap.
Players can expect to get up to 31,000 Agility experience per hour on the basic course, and up to 44,000 experience per hour on the advanced course.`, '15326985');
const update = page(policy.updateTitle, `{{Update|date=12 August 2026|url=x}}
The basic course by ~25%.
The advanced course by ~40%.
Increased XP, Bone shards and Termites to match so that it's roughly the same XP/hr.`, '15303824', '2026-08-17T00:00:00Z');
const obstaclePages = policy.obstacleTitles.map((title, index) => page(title, index === 4 ? '|xp1 = 243.7\n|xp2 = 325' : '|xp1 = 37.2\n|xp2 = 62', String(15329584 + index)));
const currentPages = [currentCourse, guide, overview, update, ...obstaclePages];
const historicalPages = [
  page(policy.courseTitle, preText, '15293116', '2026-08-11T21:47:04Z'),
  page(policy.courseTitle, postClaims, '15294160', '2026-08-12T19:22:14Z'),
  page(policy.courseTitle, `${postClaims}\n${prior}`, '15295144', '2026-08-12T23:05:33Z')
];
const revisionChain = ['15331454', '15295144', '15294160', '15294093', '15293116'].map(revid => ({ revid: Number(revid), timestamp: '2026-08-12T00:00:00Z' }));
const options = { currentPages, historicalPages, revisionChain, policy, contentHash: hash };

check(compileAgilityColossalWyrmPostUpdatePolicy(policy).valid, 'The exact policy should compile.');
const built = buildAgilityColossalWyrmPostUpdateMechanicsReconciliation(options);
check(built.audit.publishable && built.audit.reconciliationComplete, 'The complete evidence set should publish a reconciliation.');
check(built.records.length === 2, 'Basic and advanced routes should remain independent records.');
const [basic, advanced] = built.records;
check(basic.preUpdateClaims.lapXp === 504.1 && basic.postUpdateClaims.lapXp === 633, 'Basic pre- and post-update XP must remain separate.');
check(advanced.preUpdateClaims.durationSeconds === 58.8 && advanced.postUpdateClaims.durationSeconds === 82.8, 'Advanced pre- and post-update timing must remain separate.');
check(basic.officialRelativeChange.approximatePercent === 25 && advanced.officialRelativeChange.approximatePercent === 40, 'Official relative percentages should remain approximate source claims.');
check(basic.observedRelativeChange.corroboratesApproximateOfficialChange && advanced.observedRelativeChange.corroboratesApproximateOfficialChange, 'Observed source values should corroborate the approximate update percentages.');
check(basic.observedRelativeChange.valuesWereNotDerivedFromOfficialPercentage && advanced.observedRelativeChange.valuesWereNotDerivedFromOfficialPercentage, 'Exact values must not be derived from approximate percentages.');
check(basic.courseObstacleTable.sumXp === 601.6 && basic.courseObstacleTable.sumMatchesClaim === false, 'The Basic obstacle-table sum must expose the 601.6 versus 633 conflict.');
check(advanced.courseObstacleTable.sumXp === 1053.6 && advanced.courseObstacleTable.sumMatchesClaim === true, 'The Advanced obstacle-table sum must independently match 1,053.6.');
check(basic.remainingBlockers.includes('basic_post_update_lap_xp_633_conflicts_with_current_obstacle_table_601_6'), 'The exact Basic internal conflict must remain named.');
check(advanced.claimDispositions.lapXp === 'post_update_source_observed_and_current_course_table_correlated', 'Advanced lap XP should be temporally assigned and table-correlated, not declared verified.');
check(advanced.crossSourceClaims.guide.upperBoundXpPerHour === 42000 && advanced.crossSourceClaims.overview.upperBoundXpPerHour === 44000, 'Conflicting or condition-distinct cross-page upper bounds must remain visible.');
check(built.records.every(record => record.mechanicalAuthorityComplete === false && record.optimizerEligible === false && record.verifiedBestAuthorized === false), 'Temporal reconciliation must not promote mechanical or optimizer authority.');
check(built.audit.temporalCoverage.anchorsInCurrentRevisionChain && built.audit.temporalCoverage.currentCourseRetainsFirstCompletePostUpdateClaims, 'The audit must prove the historical anchors and current retention.');
check(built.audit.sourceIntegrity.exactCurrentPageSet && built.audit.sourceIntegrity.exactHistoricalAnchorSet && built.audit.sourceIntegrity.allRequiredObstaclePagesReady, 'The audit must require the exact current and historical source sets, including every obstacle page.');
check(built.audit.temporalCoverage.revisionChainOrderedFromCurrentThroughPreUpdateAnchor && built.audit.temporalCoverage.officialUpdateDateMatchesPolicy && built.audit.temporalCoverage.officialRelativeChangesMatchPolicy, 'The revision chain, official update date, and approximate percentages must match the pinned policy.');
check(built.audit.reconciliationCoverage.obstacleTableMatchedRoutes.join(',') === 'advanced_route' && built.audit.reconciliationCoverage.obstacleTableConflictRoutes.join(',') === 'basic_route', 'The audit should distinguish matched Advanced and conflicting Basic tables.');
check(built.audit.blockerPreservation.remainingBlockerCount > 0 && built.audit.mechanicalCompletenessProven === false, 'Material source blockers must survive publication.');
check(basic.recordContentHash === hash(Object.fromEntries(Object.entries(basic).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)))), 'Record content hashes should reproduce.');
check(basic.contentHash === hash(Object.fromEntries(Object.entries(basic).filter(([key]) => key !== 'contentHash'))), 'Final record hashes should reproduce.');

const missingChain = buildAgilityColossalWyrmPostUpdateMechanicsReconciliation({ ...options, revisionChain: revisionChain.filter(revision => revision.revid !== 15294160) });
check(!missingChain.audit.publishable && missingChain.records.length === 0, 'A historical anchor missing from the current revision chain must fail closed.');
const reversedChain = buildAgilityColossalWyrmPostUpdateMechanicsReconciliation({ ...options, revisionChain: [...revisionChain].reverse() });
check(!reversedChain.audit.publishable && reversedChain.audit.blockers.includes('post_update_temporal_chain_or_claim_assignment_incomplete'), 'An unordered or reversed revision chain must fail temporal reconciliation.');
const missingObstacle = buildAgilityColossalWyrmPostUpdateMechanicsReconciliation({ ...options, currentPages: currentPages.slice(0, -1) });
check(!missingObstacle.audit.publishable && missingObstacle.audit.blockers.includes('current_or_historical_source_integrity_incomplete'), 'A missing current obstacle page must fail exact source-set integrity.');
const wrongDatePages = structuredClone(currentPages);
wrongDatePages[3].content = wrongDatePages[3].content.replace('12 August 2026', '13 August 2026');
const wrongDate = buildAgilityColossalWyrmPostUpdateMechanicsReconciliation({ ...options, currentPages: wrongDatePages });
check(!wrongDate.audit.publishable && wrongDate.audit.blockers.includes('post_update_temporal_chain_or_claim_assignment_incomplete'), 'A changed official update date must fail the pinned temporal policy.');
const accountBound = buildAgilityColossalWyrmPostUpdateMechanicsReconciliation({ ...options, currentBaseLevel: 34 });
check(!accountBound.audit.publishable && accountBound.audit.blockerPreservation.accountStateFindingCount === 1 && accountBound.audit.blockers.includes('account_query_state_baked_into_post_update_reconciliation'), 'Account-query input must be rejected from the account-independent reconciliation.');
const driftedCurrent = structuredClone(currentPages);
driftedCurrent[0].content = driftedCurrent[0].content.replace('1053.6', '1053.5');
const drifted = buildAgilityColossalWyrmPostUpdateMechanicsReconciliation({ ...options, currentPages: driftedCurrent });
check(!drifted.audit.publishable, 'A current claim that no longer matches the pinned correction revision must fail closed.');
const invalidPolicy = structuredClone(policy);
invalidPolicy.rules.relativeUpdatePercentagesMayCorroborateButNeverDeriveExactValues = false;
check(!compileAgilityColossalWyrmPostUpdatePolicy(invalidPolicy).valid, 'Disabling the no-derivation rule must invalidate the policy.');
const promoted = structuredClone(built.records);
promoted[1].optimizerEligible = true;
const promotionAudit = auditAgilityColossalWyrmPostUpdateMechanicsReconciliation(promoted, options);
check(!promotionAudit.publishable && promotionAudit.blockers.includes('reconciliation_promoted_mechanical_or_optimizer_authority'), 'Optimizer promotion must fail closed.');
check(promotionAudit.blockers.includes('reconciliation_record_reconstruction_or_hash_validation_failed'), 'Tampering must also invalidate record reconstruction and hashes.');

const members = built.records.map((record, index) => ({
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
const guideCandidates = members.map(member => ({ candidate_key: member.candidateKey, source_section_key: member.sectionKey, source_revision: member.guideSourceRevision, minimum_agility: member.minimumAgility }));
const integrated = auditAgilityColossalWyrmGuideMemberCoverage({ members, guideCandidates, reconciliation: built.records });
check(integrated.internalMemberAuditSatisfied && integrated.postUpdateTemporalReconciliationApplied && integrated.reconciliationRecordCount === 2, 'Both route members must consume exactly one validated temporal reconciliation record.');
check(!integrated.mechanicalBlockers.includes('exact_post_update_mechanics_not_reconciled') && integrated.mechanicalBlockers.includes('basic_post_update_lap_xp_633_conflicts_with_current_obstacle_table_601_6'), 'Coverage must replace the old generic reconciliation blocker with precise current blockers.');
check(integrated.mechanicalCompletenessProven === false && integrated.absoluteBestGate === 'blocked_conflicting_or_obsolete_colossal_wyrm_mechanics', 'Temporal integration must not clear the mechanical or absolute-best gate.');
const mismatchedReconciliation = structuredClone(built.records);
mismatchedReconciliation[1].minimumAgility = 61;
const mismatchedCoverage = auditAgilityColossalWyrmGuideMemberCoverage({ members, guideCandidates, reconciliation: mismatchedReconciliation });
check(!mismatchedCoverage.internalMemberAuditSatisfied && mismatchedCoverage.identityBlockers.includes('one_or_more_colossal_wyrm_routes_lack_exact_same_revision_candidate'), 'A reconciliation/member requirement mismatch must fail the integrated route audit.');
check(mismatchedCoverage.memberDetails[1].identityBlockers.includes('post_update_reconciliation_record_hash_invalid'), 'The coverage boundary must independently reject a tampered reconciliation record hash.');

console.log(`Agility Colossal Wyrm post-update reconciliation checks passed: ${checks}`);
