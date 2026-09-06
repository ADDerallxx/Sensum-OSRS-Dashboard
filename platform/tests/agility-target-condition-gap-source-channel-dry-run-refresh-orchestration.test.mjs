import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  agilityTargetConditionGapRefreshStageSpecifications,
  buildAgilityTargetConditionGapSourceChannelDryRunRefresh,
  compileAgilityTargetConditionGapSourceChannelDryRunRefreshPolicy,
  executeRefreshStages,
  expectedRefreshStageDependencies,
  validateRefreshExternalInputs
} from '../orchestration/agility-target-condition-gap-source-channel-dry-run-refresh-orchestration-lib.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const policy = JSON.parse(fs.readFileSync('platform/policies/agility-target-condition-gap-source-channel-dry-run-refresh-orchestration-v1.json', 'utf8'));
const h = character => character.repeat(64);
const externalInputs = {
  coverageAudit: { file: 'coverage.json', explicitlySelected: true, contract: policy.inputContracts.coverageAudit, contentHash: h('1'), contentHashValid: true, publishable: true },
  sourceSufficiencyAudit: { file: 'sufficiency.json', explicitlySelected: true, contract: policy.inputContracts.sourceSufficiencyAudit, contentHash: h('2'), contentHashValid: true, publishable: true },
  baselineRegistryReport: { file: 'baseline.json', explicitlySelected: true, contract: policy.inputContracts.baselineRegistryAudit, contentHash: h('3'), contentHashValid: true, publishable: true, outputSnapshotContentHash: h('4'), outputSnapshotDirectory: 'baseline-snapshot' },
  baselineRegistrySnapshot: { path: 'baseline-snapshot', directory: 'baseline-snapshot', explicitlySelected: true, contract: policy.inputContracts.baselineRegistryManifest, contentHash: h('4'), contentHashValid: true }
};

const compiled = compileAgilityTargetConditionGapSourceChannelDryRunRefreshPolicy(policy);
check(compiled.valid, 'The exact dry-run refresh policy should compile.');
check(compiled.invalidBindings.length === 0 && compiled.invalidRules.length === 0, 'The exact policy should have no invalid binding or rule.');
check(agilityTargetConditionGapRefreshStageSpecifications().length === 6, 'The refresh must have exactly six stages.');
check(validateRefreshExternalInputs(externalInputs, policy).complete, 'All four explicit external inputs should validate.');

const stages = [];
for (const [index, spec] of agilityTargetConditionGapRefreshStageSpecifications().entries()) {
  const stage = {
    ...spec,
    startedAt: `2026-09-06T12:0${index}:00.000Z`,
    completedAt: `2026-09-06T12:0${index}:01.000Z`,
    exitCode: 0,
    successful: true,
    reportFile: `${spec.stageKey}-report.json`,
    reportContentHash: h(String((index + 5) % 10)),
    reportHashValid: true,
    snapshotPath: `${spec.stageKey}-snapshot`,
    snapshotDirectory: `${spec.stageKey}-snapshot`,
    snapshotContentHash: h(String((index + 6) % 10)),
    snapshotRecordCount: index === 5 ? 0 : 17,
    snapshotHashValid: true,
    reportSnapshotBindingValid: true,
    policyAuditIntegrityValid: true,
    dependencies: expectedRefreshStageDependencies(spec.stageKey, externalInputs, stages),
    auditPublishable: true,
    auditBlockers: [],
    changeDetected: false,
    changeEventCount: 0,
    eventsOnlyRequeueEvidenceWork: true,
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligibleCount: 0,
    verifiedBestAuthorizationCount: 0,
    automaticVerificationCount: 0,
    completeWikiUniverseClaimCount: 0
  };
  stages.push(stage);
}

const options = { policy, externalInputs, stageResults: stages, runId: 'synthetic-run', runDirectory: '.platform-data/synthetic-run', contentHash: hash };
const built = buildAgilityTargetConditionGapSourceChannelDryRunRefresh(options);
check(built.audit.publishable, 'A complete exact six-stage lineage should publish.');
check(built.records.length === 1 && built.records[0].lineageComplete, 'A successful refresh should produce one complete lineage record.');
check(built.records[0].changeEventCount === 0 && built.records[0].changeDetected === false, 'An unchanged refresh should preserve an empty change event result.');
check(built.records[0].blockersClosed === 0 && built.records[0].semanticFactsCreated === 0, 'Refresh orchestration must not close blockers or create facts.');
check(built.records[0].optimizerEligible === false && built.records[0].verifiedBestAuthorized === false, 'Refresh orchestration must not promote optimizer or verified-best state.');
check(built.records[0].recordContentHash === hash(Object.fromEntries(Object.entries(built.records[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)))), 'The lineage record content hash should reproduce.');
check(built.records[0].contentHash === hash(Object.fromEntries(Object.entries(built.records[0]).filter(([key]) => key !== 'contentHash'))), 'The final lineage hash should reproduce.');

const dependencyTamper = structuredClone(stages);
dependencyTamper[4].dependencies.current_article_search.reportContentHash = h('f');
const dependencyRejected = buildAgilityTargetConditionGapSourceChannelDryRunRefresh({ ...options, stageResults: dependencyTamper });
check(!dependencyRejected.audit.publishable && dependencyRejected.records.length === 0, 'A predecessor report-hash mismatch must reject the lineage.');
check(dependencyRejected.audit.blockers.includes('stage_report_snapshot_policy_audit_or_dependency_integrity_failed'), 'Dependency tampering should produce an explicit integrity blocker.');

const semanticTamper = structuredClone(stages);
semanticTamper[5].semanticFactsCreated = 1;
const semanticRejected = buildAgilityTargetConditionGapSourceChannelDryRunRefresh({ ...options, stageResults: semanticTamper });
check(!semanticRejected.audit.publishable && semanticRejected.records.length === 0, 'A refresh that creates semantic facts must fail closed.');
check(semanticRejected.audit.blockers.includes('refresh_created_semantic_optimizer_account_or_authority_state'), 'Semantic promotion should have an explicit blocker.');

const accountTamper = structuredClone(stages);
accountTamper[0].accountState = { username: 'not-allowed' };
const accountRejected = buildAgilityTargetConditionGapSourceChannelDryRunRefresh({ ...options, stageResults: accountTamper });
check(!accountRejected.audit.publishable, 'Account-specific state must be rejected from the reusable refresh lineage.');

const routingTamper = structuredClone(stages);
routingTamper[5].eventsOnlyRequeueEvidenceWork = false;
const routingRejected = buildAgilityTargetConditionGapSourceChannelDryRunRefresh({ ...options, stageResults: routingTamper });
check(!routingRejected.audit.publishable && routingRejected.audit.blockers.includes('change_evaluation_missing_or_can_apply_semantics'), 'Change events must only requeue evidence work.');

const invalidExternal = structuredClone(externalInputs);
invalidExternal.baselineRegistrySnapshot.contentHash = h('9');
check(!validateRefreshExternalInputs(invalidExternal, policy).complete, 'A baseline report/snapshot mismatch must invalidate external inputs.');
check(!buildAgilityTargetConditionGapSourceChannelDryRunRefresh({ ...options, externalInputs: invalidExternal }).audit.publishable, 'Invalid external inputs must prevent a lineage snapshot.');

const invalidPolicy = structuredClone(policy);
invalidPolicy.stages.reverse();
check(!compileAgilityTargetConditionGapSourceChannelDryRunRefreshPolicy(invalidPolicy).valid, 'Reordering the six policy stages must fail compilation.');

const failureSpecs = agilityTargetConditionGapRefreshStageSpecifications();
let executionCount = 0;
const stopped = await executeRefreshStages(failureSpecs, async stage => {
  executionCount += 1;
  return { stageKey: stage.stageKey, successful: executionCount < 3 };
});
check(executionCount === 3 && stopped.length === 3, 'Execution must stop immediately at the first failed stage.');
const failedBuild = buildAgilityTargetConditionGapSourceChannelDryRunRefresh({ ...options, stageResults: stopped });
check(!failedBuild.audit.publishable && failedBuild.records.length === 0, 'A failed stage must never produce a successful lineage snapshot.');
check(failedBuild.audit.failureSafety.stoppedAtFirstFailure, 'The audit should recognize correct first-failure stopping behavior.');

const first = buildAgilityTargetConditionGapSourceChannelDryRunRefresh(options);
const second = buildAgilityTargetConditionGapSourceChannelDryRunRefresh(options);
check(JSON.stringify(first) === JSON.stringify(second), 'Identical inputs should reproduce identical lineage and audit output.');

console.log(`Agility target-condition dry-run refresh orchestration checks passed: ${checks}`);
