import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hash } from '../ingestion/lib.mjs';
import {
  agilityColossalWyrmRewardRefreshStageSpecifications,
  buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh,
  compileAgilityColossalWyrmTermiteRewardRateDryRunRefreshPolicy,
  executeColossalWyrmRewardRefreshStages,
  expectedColossalWyrmRewardRefreshStageDependencies,
  validateColossalWyrmRewardRefreshExternalInputs
} from '../orchestration/agility-colossal-wyrm-termite-reward-rate-dry-run-refresh-orchestration-lib.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const policy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-termite-reward-rate-dry-run-refresh-orchestration-v1.json', 'utf8'));
const h = character => character.repeat(64);
const externalInputs = {
  fieldAudit: {
    file: 'field-report.json', explicitlySelected: true, contract: policy.inputContracts.fieldAudit,
    contentHash: h('1'), contentHashValid: true, publishable: true, deepIntegrityValid: true,
    outputSnapshotContentHash: h('2'), outputSnapshotDirectory: 'field-snapshot'
  },
  fieldSnapshot: {
    path: 'field-snapshot', directory: 'field-snapshot', explicitlySelected: true,
    contract: policy.inputContracts.fieldManifest, contentHash: h('2'), contentHashValid: true, deepIntegrityValid: true
  },
  baselineRegistryReport: {
    file: 'baseline-report.json', explicitlySelected: true, contract: policy.inputContracts.baselineRegistryAudit,
    contentHash: h('3'), contentHashValid: true, publishable: true, deepIntegrityValid: true,
    outputSnapshotContentHash: h('4'), outputSnapshotDirectory: 'baseline-snapshot'
  },
  baselineRegistrySnapshot: {
    path: 'baseline-snapshot', directory: 'baseline-snapshot', explicitlySelected: true,
    contract: policy.inputContracts.baselineRegistryManifest, contentHash: h('4'), contentHashValid: true, deepIntegrityValid: true
  }
};

const compiled = compileAgilityColossalWyrmTermiteRewardRateDryRunRefreshPolicy(policy);
check(compiled.valid, 'The exact four-stage dry-run policy should compile.');
check(compiled.invalidBindings.length === 0 && compiled.invalidRules.length === 0, 'The exact policy should have no invalid binding or rule.');
check(agilityColossalWyrmRewardRefreshStageSpecifications().length === 4, 'The refresh must have exactly four stages.');
check(validateColossalWyrmRewardRefreshExternalInputs(externalInputs, policy).complete, 'All four explicit external inputs should validate.');

const stages = [];
for (const [index, spec] of agilityColossalWyrmRewardRefreshStageSpecifications().entries()) {
  const stage = {
    ...spec,
    startedAt: `2026-09-06T16:0${index}:00.000Z`,
    completedAt: `2026-09-06T16:0${index}:01.000Z`,
    exitCode: 0,
    successful: true,
    reportFile: `${spec.stageKey}-report.json`,
    reportContentHash: h(String(index + 5)),
    reportHashValid: true,
    snapshotPath: `${spec.stageKey}-snapshot`,
    snapshotDirectory: `${spec.stageKey}-snapshot`,
    snapshotContentHash: h(String(index + 6)),
    snapshotRecordCount: index === 3 ? 0 : 6,
    snapshotHashValid: true,
    reportSnapshotBindingValid: true,
    policyAuditIntegrityValid: true,
    dependencies: expectedColossalWyrmRewardRefreshStageDependencies(spec.stageKey, externalInputs, stages),
    auditPublishable: true,
    auditBlockers: [],
    changeDetected: false,
    changeEventCount: 0,
    eventsOnlyRequeueExactEvidenceWork: true,
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligibleCount: 0,
    verifiedBestAuthorizationCount: 0,
    automaticVerificationCount: 0,
    completeWikiUniverseClaimCount: 0
  };
  stages.push(stage);
}

const options = {
  policy, externalInputs, stageResults: stages,
  runId: 'synthetic-run', runDirectory: '.platform-data/synthetic-colossal-wyrm-reward-run', contentHash: hash
};
const built = buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh(options);
check(built.audit.publishable, 'A complete exact four-stage lineage should publish.');
check(built.records.length === 1 && built.records[0].lineageComplete, 'A successful refresh should produce one complete lineage record.');
check(!built.records[0].changeDetected && built.records[0].changeEventCount === 0, 'An unchanged refresh should preserve an empty change result.');
check(built.records[0].eventsOnlyRequeueExactEvidenceWork, 'Any future event must be limited to exact evidence work.');
check(built.records[0].blockersClosed === 0 && built.records[0].semanticFactsCreated === 0, 'The refresh must not close blockers or create facts.');
check(!built.records[0].optimizerEligible && !built.records[0].verifiedBestAuthorized, 'The refresh must not promote optimizer or verified-best state.');
check(built.records[0].recordContentHash === hash(Object.fromEntries(Object.entries(built.records[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)))), 'The lineage record hash should reproduce.');
check(built.records[0].contentHash === hash(Object.fromEntries(Object.entries(built.records[0]).filter(([key]) => key !== 'contentHash'))), 'The final lineage hash should reproduce.');

const dependencyTamper = structuredClone(stages);
dependencyTamper[2].dependencies.reward_source_discovery.reportContentHash = h('f');
const dependencyRejected = buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh({ ...options, stageResults: dependencyTamper });
check(!dependencyRejected.audit.publishable && dependencyRejected.records.length === 0, 'A predecessor report-hash mismatch must reject the lineage.');
check(dependencyRejected.audit.blockers.includes('stage_report_snapshot_policy_audit_or_dependency_integrity_failed'), 'Dependency tampering should have an explicit integrity blocker.');

const semanticTamper = structuredClone(stages);
semanticTamper[3].semanticFactsCreated = 1;
const semanticRejected = buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh({ ...options, stageResults: semanticTamper });
check(!semanticRejected.audit.publishable && semanticRejected.records.length === 0, 'A refresh that creates semantic facts must fail closed.');
check(semanticRejected.audit.blockers.includes('refresh_created_semantic_optimizer_account_or_authority_state'), 'Semantic promotion should have an explicit blocker.');

const accountTamper = structuredClone(stages);
accountTamper[0].accountState = { username: 'not-allowed' };
check(!buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh({ ...options, stageResults: accountTamper }).audit.publishable, 'Account state must be rejected from reusable refresh lineage.');

const routingTamper = structuredClone(stages);
routingTamper[3].eventsOnlyRequeueExactEvidenceWork = false;
const routingRejected = buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh({ ...options, stageResults: routingTamper });
check(!routingRejected.audit.publishable && routingRejected.audit.blockers.includes('change_evaluation_missing_or_can_apply_semantics'), 'Change events must only requeue exact evidence work.');

const invalidExternal = structuredClone(externalInputs);
invalidExternal.fieldSnapshot.contentHash = h('9');
check(!validateColossalWyrmRewardRefreshExternalInputs(invalidExternal, policy).complete, 'A field report/snapshot mismatch must invalidate external inputs.');
check(!buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh({ ...options, externalInputs: invalidExternal }).audit.publishable, 'Invalid external inputs must prevent a lineage snapshot.');

const shallowExternal = structuredClone(externalInputs);
shallowExternal.baselineRegistrySnapshot.deepIntegrityValid = false;
check(!validateColossalWyrmRewardRefreshExternalInputs(shallowExternal, policy).complete, 'A baseline without deep registry integrity must be rejected.');

const invalidPolicy = structuredClone(policy);
invalidPolicy.stages.reverse();
check(!compileAgilityColossalWyrmTermiteRewardRateDryRunRefreshPolicy(invalidPolicy).valid, 'Reordering the four stages must fail compilation.');

let executionCount = 0;
const stopped = await executeColossalWyrmRewardRefreshStages(agilityColossalWyrmRewardRefreshStageSpecifications(), async stage => {
  executionCount += 1;
  return { stageKey: stage.stageKey, successful: executionCount < 3 };
});
check(executionCount === 3 && stopped.length === 3, 'Execution must stop immediately at the first failed stage.');
const failedBuild = buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh({ ...options, stageResults: stopped });
check(!failedBuild.audit.publishable && failedBuild.records.length === 0, 'A failed stage must never produce a successful lineage snapshot.');
check(failedBuild.audit.failureSafety.stoppedAtFirstFailure, 'The audit should recognize correct first-failure stopping behavior.');

const first = buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh(options);
const second = buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh(options);
check(JSON.stringify(first) === JSON.stringify(second), 'Identical inputs should reproduce identical lineage and audit output.');

const noArgs = spawnSync(process.execPath, ['platform/orchestration/run-agility-colossal-wyrm-termite-reward-rate-dry-run-refresh.mjs'], { encoding: 'utf8' });
check(noArgs.status !== 0, 'The CLI must reject implicit input selection.');
check(`${noArgs.stdout}${noArgs.stderr}`.includes('Provide --field-audit='), 'The CLI should identify the first missing explicit input.');

console.log(`Agility Colossal Wyrm reward dry-run refresh orchestration checks passed: ${checks}`);
