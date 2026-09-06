import { hash, json } from '../ingestion/lib.mjs';

const EXPECTED_STAGES = [
  ['current_article_search', 'platform/ingestion/ingest-wiki-agility-target-condition-gap-wiki-discovery.mjs', 'sensum.agility-target-condition-gap-wiki-discovery-audit.v1', 'agility-target-condition-gap-wiki-discovery', ['coverage_audit', 'source_sufficiency_audit']],
  ['current_source_code_search', 'platform/ingestion/ingest-wiki-agility-target-condition-gap-template-module-source-discovery.mjs', 'sensum.agility-target-condition-gap-template-module-source-discovery-audit.v1', 'agility-target-condition-gap-template-module-source-discovery', ['coverage_audit', 'source_sufficiency_audit']],
  ['historical_update_archive_search', 'platform/ingestion/ingest-wiki-agility-target-condition-gap-update-archive-source-discovery.mjs', 'sensum.agility-target-condition-gap-update-archive-source-discovery-audit.v1', 'agility-target-condition-gap-update-archive-source-discovery', ['coverage_audit', 'source_sufficiency_audit']],
  ['source_channel_coverage_synthesis', 'platform/transforms/synthesize-agility-target-condition-gap-source-channel-coverage.mjs', 'sensum.agility-target-condition-gap-source-channel-coverage-synthesis-audit.v1', 'agility-target-condition-gap-source-channel-coverage-synthesis', ['current_article_search', 'current_source_code_search', 'historical_update_archive_search']],
  ['source_channel_change_registry', 'platform/transforms/materialize-agility-target-condition-gap-source-channel-change-monitoring-registry.mjs', 'sensum.agility-target-condition-gap-source-channel-change-monitoring-registry-audit.v1', 'agility-target-condition-gap-source-channel-change-monitoring-registry', ['source_channel_coverage_synthesis', 'current_article_search', 'current_source_code_search', 'historical_update_archive_search']],
  ['source_channel_change_evaluation', 'platform/transforms/evaluate-agility-target-condition-gap-source-channel-changes.mjs', 'sensum.agility-target-condition-gap-source-channel-change-evaluation-audit.v1', 'agility-target-condition-gap-source-channel-change-evaluation', ['baseline_registry', 'source_channel_change_registry']]
];

const REQUIRED_RULES = [
  'allFourExternalInputsMustBeExplicitlySelected',
  'coverageSufficiencyAndBaselineRegistryInputsMustValidateBeforeExecution',
  'allStagesRunSequentiallyInsideOneIsolatedLocalDirectory',
  'eachStageMustExitZeroAndPublishAValidReportAndSnapshotBeforeTheNextStarts',
  'everyStageReportManifestRawPayloadPolicyAuditAndContentHashMustValidate',
  'everyDownstreamDependencyMustBindTheExactPriorReportAndSnapshotHashes',
  'firstFailureStopsAllRemainingStagesAndProducesNoSuccessfulLineageSnapshot',
  'successfulLineageMustContainExactlySixOrderedStages',
  'refreshDoesNotApproveEvidenceApplySemanticsOrCloseBlockers',
  'changeEvaluationEventsOnlyRequeueEvidenceWork',
  'noSchedulerCloudResourceProductionDataMigrationDeploymentOrCutoverIsAllowed',
  'deployClaspMigrationAndProductionCommandsAreForbidden',
  'optimizerEligibilityAndVerifiedBestAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];

const unique = values => [...new Set(values)];
const same = (left, right) => json(left) === json(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));

export function compileAgilityTargetConditionGapSourceChannelDryRunRefreshPolicy(policy = {}) {
  const expected = {
    policy: 'sensum.agility-target-condition-gap-source-channel-dry-run-refresh-orchestration-policy.v1',
    mode: 'isolated_local_dry_run',
    runDirectoryName: 'agility-target-condition-gap-source-channel-refresh-runs',
    recordContract: 'sensum.agility-target-condition-gap-source-channel-dry-run-refresh-lineage.v1',
    auditContract: 'sensum.agility-target-condition-gap-source-channel-dry-run-refresh-orchestration-audit.v1',
    outputDomain: 'agility-target-condition-gap-source-channel-dry-run-refresh-orchestration'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const actualStages = (policy.stages || []).map(stage => [stage.stageKey, stage.script, stage.reportContract, stage.outputDomain, stage.dependencies]);
  if (!same(actualStages, EXPECTED_STAGES)) invalidBindings.push('stages');
  const requiredInputs = {
    coverageAudit: 'sensum.agility-level34-coverage-audit.v1',
    sourceSufficiencyAudit: 'sensum.agility-target-condition-source-sufficiency-audit.v1',
    baselineRegistryAudit: 'sensum.agility-target-condition-gap-source-channel-change-monitoring-registry-audit.v1',
    baselineRegistryManifest: 'sensum.ingestion-manifest.v1'
  };
  if (!same(policy.inputContracts, requiredInputs)) invalidBindings.push('inputContracts');
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return { valid: !invalidBindings.length && !invalidRules.length, invalidBindings: unique(invalidBindings), invalidRules: unique(invalidRules) };
}

export function expectedRefreshStageDependencies(stageKey, externalInputs = {}, priorStages = []) {
  const prior = Object.fromEntries(priorStages.map(stage => [stage.stageKey, stage]));
  const stage = EXPECTED_STAGES.find(([key]) => key === stageKey);
  if (!stage) return null;
  return Object.fromEntries(stage[4].map(dependency => {
    if (dependency === 'coverage_audit') return [dependency, { reportContentHash: externalInputs.coverageAudit?.contentHash || null }];
    if (dependency === 'source_sufficiency_audit') return [dependency, { reportContentHash: externalInputs.sourceSufficiencyAudit?.contentHash || null }];
    if (dependency === 'baseline_registry') return [dependency, {
      reportContentHash: externalInputs.baselineRegistryReport?.contentHash || null,
      snapshotContentHash: externalInputs.baselineRegistrySnapshot?.contentHash || null
    }];
    return [dependency, {
      reportContentHash: prior[dependency]?.reportContentHash || null,
      snapshotContentHash: prior[dependency]?.snapshotContentHash || null
    }];
  }));
}

export function validateRefreshExternalInputs(externalInputs = {}, policy = {}) {
  const required = ['coverageAudit', 'sourceSufficiencyAudit', 'baselineRegistryReport', 'baselineRegistrySnapshot'];
  const expectedContract = {
    coverageAudit: policy.inputContracts?.coverageAudit,
    sourceSufficiencyAudit: policy.inputContracts?.sourceSufficiencyAudit,
    baselineRegistryReport: policy.inputContracts?.baselineRegistryAudit,
    baselineRegistrySnapshot: policy.inputContracts?.baselineRegistryManifest
  };
  const checks = Object.fromEntries(required.map(key => [key, {
    explicitlySelected: externalInputs[key]?.explicitlySelected === true,
    contractMatches: externalInputs[key]?.contract === expectedContract[key],
    contentHashValid: externalInputs[key]?.contentHashValid === true && validHash(externalInputs[key]?.contentHash),
    publishable: key.endsWith('Snapshot') || externalInputs[key]?.publishable === true
  }]));
  const crossBindings = {
    baselineReportSnapshotHashMatches: externalInputs.baselineRegistryReport?.outputSnapshotContentHash === externalInputs.baselineRegistrySnapshot?.contentHash,
    baselineReportSnapshotDirectoryMatches: externalInputs.baselineRegistryReport?.outputSnapshotDirectory === externalInputs.baselineRegistrySnapshot?.directory
  };
  const complete = Object.values(checks).every(group => Object.values(group).every(Boolean)) && Object.values(crossBindings).every(Boolean);
  return { complete, checks, crossBindings };
}

function findForbiddenState(value, path = '', findings = []) {
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|accountState|accountSnapshot|bank|bankItems|ownedEquipment|preferences)$/i;
  if (Array.isArray(value)) value.forEach((child, index) => findForbiddenState(child, `${path}[${index}]`, findings));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (forbidden.test(key)) findings.push(next);
    findForbiddenState(child, next, findings);
  }
  return findings;
}

function stageHashesValid(stage = {}) {
  return validHash(stage.reportContentHash) && validHash(stage.snapshotContentHash)
    && stage.reportHashValid === true && stage.snapshotHashValid === true
    && stage.reportSnapshotBindingValid === true && stage.policyAuditIntegrityValid === true;
}

function recordHashesValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && validHash(record?.contentHash)
    && contentHash(without(record, ['recordContentHash', 'contentHash'])) === record.recordContentHash
    && contentHash(without(record, ['contentHash'])) === record.contentHash;
}

function makeRecord(options, contentHash = hash) {
  const stages = options.stageResults.map(stage => ({ ...stage }));
  const base = {
    contract: options.policy.recordContract,
    runId: options.runId,
    mode: options.policy.mode,
    runDirectory: options.runDirectory,
    externalInputs: options.externalInputs,
    stages,
    lineageComplete: true,
    changeDetected: stages.at(-1)?.changeDetected === true,
    changeEventCount: Number(stages.at(-1)?.changeEventCount || 0),
    eventsOnlyRequeueEvidenceWork: stages.at(-1)?.eventsOnlyRequeueEvidenceWork === true,
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligible: false,
    verifiedBestAuthorized: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false
  };
  const recordContentHash = contentHash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
}

export function auditAgilityTargetConditionGapSourceChannelDryRunRefresh(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policy = options.policy || {};
  const stages = options.stageResults || [];
  const policyValidation = compileAgilityTargetConditionGapSourceChannelDryRunRefreshPolicy(policy);
  const externalInputIntegrity = validateRefreshExternalInputs(options.externalInputs, policy);
  const expectedOrder = EXPECTED_STAGES.map(([key]) => key);
  const actualOrder = stages.map(stage => stage.stageKey);
  const failedIndex = stages.findIndex(stage => stage.successful !== true);
  const allSixStages = same(actualOrder, expectedOrder);
  const stoppedAtFirstFailure = failedIndex < 0 || stages.length === failedIndex + 1;
  const everyStageValid = allSixStages && stages.every((stage, index) => {
    const spec = EXPECTED_STAGES[index];
    return stage.successful === true && stage.exitCode === 0 && stage.reportContract === spec[2]
      && stage.outputDomain === spec[3] && stage.auditPublishable === true && stageHashesValid(stage)
      && same(stage.dependencies, expectedRefreshStageDependencies(stage.stageKey, options.externalInputs, stages.slice(0, index)));
  });
  const semanticPromotionCount = stages.filter(stage => Number(stage.blockersClosed || 0) !== 0
    || Number(stage.semanticFactsCreated || 0) !== 0 || Number(stage.optimizerEligibleCount || 0) !== 0
    || Number(stage.verifiedBestAuthorizationCount || 0) !== 0 || Number(stage.automaticVerificationCount || 0) !== 0
    || Number(stage.completeWikiUniverseClaimCount || 0) !== 0).length;
  const accountStateFindings = findForbiddenState({ externalInputs: options.externalInputs, stages });
  const expectedRecords = policyValidation.valid && externalInputIntegrity.complete && everyStageValid
    ? [makeRecord(options, contentHash)] : [];
  const recordsMatchExpected = same(records, expectedRecords);
  const hashesValid = records.every(record => recordHashesValid(record, contentHash));
  const final = stages.at(-1);
  const changeEvaluation = {
    present: final?.stageKey === 'source_channel_change_evaluation',
    changeDetected: final?.changeDetected === true,
    changeEventCount: Number(final?.changeEventCount || 0),
    eventsOnlyRequeueEvidenceWork: final?.eventsOnlyRequeueEvidenceWork === true
  };
  const blockers = [];
  if (!policyValidation.valid) blockers.push('dry_run_refresh_policy_invalid');
  if (!externalInputIntegrity.complete) blockers.push('external_input_integrity_failed');
  if (!allSixStages) blockers.push(failedIndex >= 0 ? `stage_failed:${stages[failedIndex]?.stageKey || 'unknown'}` : 'six_stage_lineage_incomplete_or_out_of_order');
  if (!stoppedAtFirstFailure) blockers.push('execution_continued_after_first_failure');
  if (allSixStages && !everyStageValid) blockers.push('stage_report_snapshot_policy_audit_or_dependency_integrity_failed');
  if (allSixStages && (!changeEvaluation.present || !changeEvaluation.eventsOnlyRequeueEvidenceWork)) blockers.push('change_evaluation_missing_or_can_apply_semantics');
  if (semanticPromotionCount || accountStateFindings.length) blockers.push('refresh_created_semantic_optimizer_account_or_authority_state');
  if (!recordsMatchExpected || !hashesValid) blockers.push('lineage_record_reconstruction_or_hash_validation_failed');
  const orchestrationComplete = blockers.length === 0 && expectedRecords.length === 1;
  return {
    contract: policy.auditContract,
    policyValidation,
    externalInputIntegrity,
    stageCoverage: { expectedStageCount: 6, executedStageCount: stages.length, expectedOrder, actualOrder, allSixStages, everyStageValid },
    lineageIntegrity: { dependenciesExact: everyStageValid, accountStateFindingCount: accountStateFindings.length },
    failureSafety: { stoppedAtFirstFailure, successfulLineageWrittenAfterFailure: failedIndex >= 0 && records.length > 0 },
    changeEvaluation,
    blockerPreservation: {
      blockersClosed: stages.reduce((sum, stage) => sum + Number(stage.blockersClosed || 0), 0),
      semanticFactsCreated: stages.reduce((sum, stage) => sum + Number(stage.semanticFactsCreated || 0), 0),
      optimizerEligibleCount: stages.reduce((sum, stage) => sum + Number(stage.optimizerEligibleCount || 0), 0),
      verifiedBestAuthorizationCount: stages.reduce((sum, stage) => sum + Number(stage.verifiedBestAuthorizationCount || 0), 0),
      automaticVerificationCount: stages.reduce((sum, stage) => sum + Number(stage.automaticVerificationCount || 0), 0),
      completeWikiUniverseClaimCount: stages.reduce((sum, stage) => sum + Number(stage.completeWikiUniverseClaimCount || 0), 0)
    },
    recordsMatchExpected,
    recordHashesValid: hashesValid,
    orchestrationComplete,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable: orchestrationComplete,
    blockers: unique(blockers)
  };
}

export function buildAgilityTargetConditionGapSourceChannelDryRunRefresh(options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityTargetConditionGapSourceChannelDryRunRefreshPolicy(options.policy || {});
  const external = validateRefreshExternalInputs(options.externalInputs, options.policy || {});
  const stages = options.stageResults || [];
  const preliminarilyComplete = policyValidation.valid && external.complete && stages.length === EXPECTED_STAGES.length
    && stages.every(stage => stage.successful === true);
  const records = preliminarilyComplete ? [makeRecord(options, contentHash)] : [];
  const audit = auditAgilityTargetConditionGapSourceChannelDryRunRefresh(records, { ...options, contentHash });
  return { records: audit.publishable ? records : [], audit };
}

export async function executeRefreshStages(stageSpecs, executeStage) {
  const results = [];
  for (const stage of stageSpecs) {
    const result = await executeStage(stage, [...results]);
    results.push(result);
    if (result.successful !== true) break;
  }
  return results;
}

export const agilityTargetConditionGapRefreshStageSpecifications = () => EXPECTED_STAGES.map(([stageKey, script, reportContract, outputDomain, dependencies]) => ({ stageKey, script, reportContract, outputDomain, dependencies: [...dependencies] }));
