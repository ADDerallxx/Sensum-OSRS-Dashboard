import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditAgilityColossalWyrmRewardClaimTimeline,
  buildAgilityColossalWyrmRewardClaimTimeline,
  compileAgilityColossalWyrmRewardClaimTimelinePolicy,
  normalizeRevisionId,
  parseColossalWyrmRewardClaim
} from '../ingestion/agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-lib.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const policy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-v1.json', 'utf8'));
const inputPolicy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-discovery-v1.json', 'utf8'));

check(normalizeRevisionId(0) === '0', 'A numeric page-creation parent ID must remain an explicit zero.');
check(normalizeRevisionId(null) === '', 'A genuinely absent revision ID must remain empty.');

const courseCurrent = `
The advanced course can be completed in 1:22.80, allowing roughly 41 completions per hour.
Spawns on the basic portions of the course yield 11-14 [[termites]] per scoop, while spawns on the advanced-only portions of the course yield 17-20 per scoop.
Players also have an 80% chance to scoop up 22–38 [[blessed bone shards]].
The exact spawn rate is currently unknown. However, players can expect to receive 3.9<ref>experimental</ref> [[termites]] per completion of the '''advanced''' course on average, and 6.9<ref /> [[blessed bone shards]]. Should players take roughly 90 seconds to complete each lap of the advanced course, they can accumulate around 234 [[termites]] and 414 [[Blessed bone shards|bone shards]] per hour with maximum efficiency and focus. A less intense estimate of 35 laps per hour could provide 195 [[termites]] and 345 [[Blessed bone shards|bone shards]].
`;
const courseEarlier = `The exact spawn rate is currently unknown. Players can expect to receive 3.9 [[termites]] per completion of the '''advanced''' course on average, and 6.9 [[blessed bone shards]].`;
const talkCurrent = 'Currently data points to 3.9 on average, page has been updated to reflect that.';
const updateCurrent = "Increased XP, Bone shards and Termites to match so that it's roughly the same XP/hr and termites/hr but fewer inputs/hr.";

for (const claim of policy.claims.filter(item => item.sourceKey === 'course_article')) {
  check(parseColossalWyrmRewardClaim(courseCurrent, claim.parserKey).value !== null, `Current course fixture should parse ${claim.claimKey}.`);
}
check(parseColossalWyrmRewardClaim(talkCurrent, 'talk_experimental_termite_average').value === 3.9, 'Talk average should parse exactly.');
check(parseColossalWyrmRewardClaim(updateCurrent, 'official_relative_reward_adjustment').value === true, 'Official relative adjustment should parse exactly.');
check(parseColossalWyrmRewardClaim('', 'advanced_termite_per_completion_average').value === null, 'Claim absence must remain null rather than numeric zero.');

const blockerRecords = policy.expectedBlockers.map((blocker, index) => {
  const signals = [];
  if (index === 0) signals.push({ title: policy.sourcePages[0].title, pageId: policy.sourcePages[0].pageId, sourceRevision: policy.sourcePages[0].currentRevision });
  if (index === 1) signals.push({ title: policy.sourcePages[1].title, pageId: policy.sourcePages[1].pageId, sourceRevision: policy.sourcePages[1].currentRevision });
  if (index === 2) signals.push({ title: policy.sourcePages[2].title, pageId: policy.sourcePages[2].pageId, sourceRevision: policy.sourcePages[2].currentRevision });
  const base = {
    contract: policy.inputRecordContract, blocker, potentialEvidenceSignals: signals,
    existingBlockerPreserved: true, mechanicallyResolved: false, blockersClosed: 0,
    semanticFactsCreated: 0, optimizerEligible: false, verifiedBestAuthorized: false,
    automaticVerificationApplied: false, accountIndependent: true
  };
  const recordContentHash = hash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
});
const discoveryRaw = `${blockerRecords.map(record => json(record)).join('\n')}\n`;
const discoveryManifest = {
  contract: 'sensum.ingestion-manifest.v1', domain: policy.inputSnapshotDomain,
  records: blockerRecords.length, contentHash: hash(discoveryRaw), snapshotDirectory: 'discovery-snapshot'
};
const discoveryAuditBase = {
  contract: policy.inputAuditContract, publishable: true,
  outputSnapshot: { directory: discoveryManifest.snapshotDirectory, contentHash: discoveryManifest.contentHash, records: blockerRecords.length }
};
const discoveryAudit = { ...discoveryAuditBase, contentHash: hash(discoveryAuditBase) };

const revision = (revid, parentid, timestamp, content, comment = '') => ({ revid, parentid, timestamp, content, comment });
const sourceHistories = [
  {
    sourceKey: 'course_article', title: policy.sourcePages[0].title, pageId: policy.sourcePages[0].pageId,
    paginationComplete: true, revisions: [
      revision(policy.sourcePages[0].currentRevision, '200', '2026-09-05T13:53:38Z', courseCurrent, 'current'),
      revision('200', '100', '2025-08-06T00:12:00Z', courseEarlier, 'add experimental averages'),
      revision('100', '0', '2024-09-25T00:00:00Z', 'Course created.', 'create')
    ]
  },
  {
    sourceKey: 'talk_discussion', title: policy.sourcePages[1].title, pageId: policy.sourcePages[1].pageId,
    paginationComplete: true, revisions: [
      revision(policy.sourcePages[1].currentRevision, '300', '2026-08-17T08:33:48Z', talkCurrent, 'archive'),
      revision('300', '0', '2025-08-06T00:12:00Z', talkCurrent, 'record sample')
    ]
  },
  {
    sourceKey: 'official_update', title: policy.sourcePages[2].title, pageId: policy.sourcePages[2].pageId,
    paginationComplete: true, revisions: [
      revision(policy.sourcePages[2].currentRevision, '400', '2026-08-17T07:53:45Z', updateCurrent, 'current'),
      revision('400', '0', '2026-08-15T00:00:00Z', updateCurrent, 'publish')
    ]
  }
];

const options = { policy, inputPolicy, discoveryAudit, discoveryManifest, discoveryRecords: blockerRecords, sourceHistories, contentHash: hash };
const compiled = compileAgilityColossalWyrmRewardClaimTimelinePolicy(policy, hash);
check(compiled.valid, 'The exact claim-timeline policy should compile.');
const built = buildAgilityColossalWyrmRewardClaimTimeline(options);
check(built.audit.publishable, 'Complete exact histories should produce a publishable timeline.');
check(built.records.length === 17 && built.audit.claimCoverage.exact, 'Every declared claim should have one independent record.');
check(built.audit.claimCoverage.currentlyPresentClaims === 17, 'All pinned-current fixture claims should be found.');
check(built.audit.sourceHistoryIntegrity.findings.every(finding => finding.reachesCreation && finding.contiguous), 'Every source history should be contiguous to creation.');
check(built.audit.sourceHistoryIntegrity.findings.every(finding => finding.historicalBoundaryExplicit && !finding.unavailablePredecessorExplicit), 'A reached creation boundary must not be mislabeled as an unavailable predecessor.');
check(built.audit.authorityBoundary.sixExistingBlockersRemainOpen, 'All six mechanics blockers must remain open.');
check(built.audit.authorityBoundary.semanticFactsCreated === 0 && built.audit.authorityBoundary.mechanicalAuthorityCount === 0, 'Timeline evidence must not create mechanical facts.');
check(built.records.every(record => record.recordContentHash === hash(Object.fromEntries(Object.entries(record).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))))), 'Every record hash should reproduce.');
check(built.records.every(record => record.contentHash === hash(Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'contentHash')))), 'Every final record hash should reproduce.');
check(built.records.find(record => record.claimKey === 'advanced_termite_per_completion_average').firstObservedState.value === 3.9, 'The first experimental termite average should be retained without promotion.');
check(built.records.find(record => record.claimKey === 'advanced_ideal_lap_seconds').currentState.value === 82.8, 'Minute-second lap text should normalize exactly to seconds.');

const chainTamper = structuredClone(sourceHistories);
chainTamper[0].revisions[0].parentid = 'wrong';
check(!buildAgilityColossalWyrmRewardClaimTimeline({ ...options, sourceHistories: chainTamper }).audit.publishable, 'A broken parent chain must fail closed.');

const paginationTamper = structuredClone(sourceHistories);
paginationTamper[1].paginationComplete = false;
check(!buildAgilityColossalWyrmRewardClaimTimeline({ ...options, sourceHistories: paginationTamper }).audit.publishable, 'An incompletely paginated history must fail closed.');

const currentTamper = structuredClone(sourceHistories);
currentTamper[0].revisions[0].revid = '999';
check(!buildAgilityColossalWyrmRewardClaimTimeline({ ...options, sourceHistories: currentTamper }).audit.publishable, 'A current revision mismatch must fail closed.');

const parserDrift = structuredClone(sourceHistories);
parserDrift[0].revisions[0].content = parserDrift[0].revisions[0].content.replace('234 [[termites]]', 'many [[termites]]');
check(!buildAgilityColossalWyrmRewardClaimTimeline({ ...options, sourceHistories: parserDrift }).audit.publishable, 'A declared claim missing from the pinned revision must fail closed.');

const sourceBindingTamper = structuredClone(blockerRecords);
sourceBindingTamper[1].potentialEvidenceSignals[0].sourceRevision = '999';
check(!buildAgilityColossalWyrmRewardClaimTimeline({ ...options, discoveryRecords: sourceBindingTamper }).audit.publishable, 'A timeline source not exactly bound by discovery must fail closed.');

const accountTamper = buildAgilityColossalWyrmRewardClaimTimeline({ ...options, accountState: { username: 'not-allowed' } });
check(!accountTamper.audit.publishable, 'Account-specific state must be rejected.');

const outputPromotion = structuredClone(built.records);
outputPromotion[0].mechanicalAuthorityComplete = true;
check(!auditAgilityColossalWyrmRewardClaimTimeline(outputPromotion, options).publishable, 'A mechanically promoted output must fail independent audit.');
check(JSON.stringify(buildAgilityColossalWyrmRewardClaimTimeline(options)) === JSON.stringify(buildAgilityColossalWyrmRewardClaimTimeline(options)), 'Identical inputs should reproduce the exact timeline.');

const invalidPolicy = structuredClone(policy);
invalidPolicy.claims.pop();
check(!compileAgilityColossalWyrmRewardClaimTimelinePolicy(invalidPolicy, hash).valid, 'A missing claim definition must invalidate the policy.');

const noArgs = spawnSync(process.execPath, ['platform/ingestion/ingest-wiki-agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation.mjs'], { encoding: 'utf8' });
check(noArgs.status !== 0, 'The CLI must reject implicit discovery inputs before network access.');
check(`${noArgs.stdout}${noArgs.stderr}`.includes('explicit --discovery-audit='), 'The CLI should identify the missing report input.');

console.log(`Agility Colossal Wyrm reward claim revision-timeline checks passed: ${checks}`);
