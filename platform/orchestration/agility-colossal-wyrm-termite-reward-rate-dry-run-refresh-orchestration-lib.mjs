import { hash, json } from '../ingestion/lib.mjs';

const EXPECTED_STAGES = [
  ['reward_source_discovery', 'platform/ingestion/ingest-wiki-agility-colossal-wyrm-termite-reward-rate-source-discovery.mjs', 'sensum.agility-colossal-wyrm-termite-reward-rate-source-discovery-audit.v1', 'agility-colossal-wyrm-termite-reward-rate-source-discovery', ['field_reconciliation']],
  ['reward_source_sufficiency', 'platform/transforms/materialize-agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition.mjs', 'sensum.agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-audit.v1', 'agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition', ['reward_source_discovery']],
  ['reward_source_change_registry', 'platform/transforms/materialize-agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry.mjs', 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-audit.v1', 'agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry', ['reward_source_discovery', 'reward_source_sufficiency']],
  ['reward_source_change_evaluation', 'platform/transforms/evaluate-agility-colossal-wyrm-termite-reward-rate-source-changes.mjs', 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-audit.v1', 'agility-colossal-wyrm-termite-reward-rate-source-change-evaluation', ['baseline_registry', 'reward_source_change_registry']]
];

const REQUIRED_RULES = [
  'allFourExternalInputsMustBeExplicitlySelected',
  'fieldAndBaselineRegistryInputsMustValidateBeforeExecution',
  'allStagesRunSequentiallyInsideOneIsolatedLocalDirectory',
  'eachStageMustExitZeroAndPublishAValidReportAndSnapshotBeforeTheNextStarts',
  'everyStageReportManifestRawPayloadPolicyAuditAndContentHashMustValidate',
  'everyDownstreamDependencyMustBindTheExactPriorReportAndSnapshotHashes',
  'firstFailureStopsAllRemainingStagesAndProducesNoSuccessfulLineageSnapshot',
  'successfulLineageMustContainExactlyFourOrderedStages',
  'refreshDoesNotApproveEvidenceApplySemanticsOrCloseBlockers',
  'changeEvaluationEventsOnlyRequeueExactEvidenceWork',
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

export function compileAgilityColossalWyrmTermiteRewardRateDryRunRefreshPolicy(policy = {}) {
  const expected = {
    policy: 'sensum.agility-colossal-wyrm-termite-reward-rate-dry-run-refresh-orchestration-policy.v1',
    mode: 'isolated_local_dry_run',
    runDirectoryName: 'agility-colossal-wyrm-termite-reward-rate-refresh-runs',
    recordContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-dry-run-refresh-lineage.v1',
    auditContract: 'sensum.agility-colossal-wyrm-termite-reward-rate-dry-run-refresh-orchestration-audit.v1',
    outputDomain: 'agility-colossal-wyrm-termite-reward-rate-dry-run-refresh-orchestration'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const actualStages = (policy.stages || []).map(stage => [stage.stageKey, stage.script, stage.reportContract, stage.outputDomain, stage.dependencies]);
  if (!same(actualStages, EXPECTED_STAGES)) invalidBindings.push('stages');
  const requiredInputs = {
    fieldAudit: 'sensum.agility-colossal-wyrm-obsolete-notice-field-reconciliation-audit.v1',
    fieldManifest: 'sensum.ingestion-manifest.v1',
    baselineRegistryAudit: 'sensum.agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-audit.v1',
    baselineRegistryManifest: 'sensum.ingestion-manifest.v1'
  };
  if (!same(policy.inputContracts, requiredInputs)) invalidBindings.push('inputContracts');
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  return { valid: !invalidBindings.length && !invalidRules.length, invalidBindings: unique(invalidBindings), invalidRules: unique(invalidRules) };
}

export function expectedColossalWyrmRewardRefreshStageDependencies(stageKey, externalInputs = {}, priorStages = []) {
  const prior = Object.fromEntries(priorStages.map(stage => [stage.stageKey, stage]));
  const stage = EXPECTED_STAGES.find(([key]) => key === stageKey);
  if (!stage) return null;
  return Object.fromEntries(stage[4].map(dependency => {
    if (dependency === 'field_reconciliation') return [dependency, {
      reportContentHash: externalInputs.fieldAudit?.contentHash || null,
      snapshotContentHash: externalInputs.fieldSnapshot?.contentHash || null
    }];
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

export function validateColossalWyrmRewardRefreshExternalInputs(externalInputs = {}, policy = {}) {
  const required = ['fieldAudit', 'fieldSnapshot', 'baselineRegistryReport', 'baselineRegistrySnapshot'];
  const expectedContract = {
    fieldAudit: policy.inputContracts?.fieldAudit,
    fieldSnapshot: policy.inputContracts?.fieldManifest,
    baselineRegistryReport: policy.inputContracts?.baselineRegistryAudit,
    baselineRegistrySnapshot: policy.inputContracts?.baselineRegistryManifest
  };
  const checks = Object.fromEntries(required.map(key => [key, {
    explicitlySelected: externalInputs[key]?.explicitlySelected === true,
    contractMatches: externalInputs[key]?.contract === expectedContract[key],
    contentHashValid: externalInputs[key]?.contentHashValid === true && validHash(externalInputs[key]?.contentHash),
    deepIntegrityValid: externalInputs[key]?.deepIntegrityValid === true,
    publishable: key.endsWith('Snapshot') || externalInputs[key]?.publishable === true
  }]));
  const crossBindings = {
    fieldReportSnapshotHashMatches: externalInputs.fieldAudit?.outputSnapshotContentHash === externalInputs.fieldSnapshot?.contentHash,
    fieldReportSnapshotDirectoryMatches: externalInputs.fieldAudit?.outputSnapshotDirectory === externalInputs.fieldSnapshot?.directory,
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
    eventsOnlyRequeueExactEvidenceWork: stages.at(-1)?.eventsOnlyRequeueExactEvidenceWork === true,
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

export function auditAgilityColossalWyrmTermiteRewardRateDryRunRefresh(records = [], options = {}) {
  const contentHash = options.contentHash || hash;
  const policy = options.policy || {};
  const stages = options.stageResults || [];
  const policyValidation = compileAgilityColossalWyrmTermiteRewardRateDryRunRefreshPolicy(policy);
  const externalInputIntegrity = validateColossalWyrmRewardRefreshExternalInputs(options.externalInputs, policy);
  const expectedOrder = EXPECTED_STAGES.map(([key]) => key);
  const actualOrder = stages.map(stage => stage.stageKey);
  const failedIndex = stages.findIndex(stage => stage.successful !== true);
  const allFourStages = same(actualOrder, expectedOrder);
  const stoppedAtFirstFailure = failedIndex < 0 || stages.length === failedIndex + 1;
  const everyStageValid = allFourStages && stages.every((stage, index) => {
    const spec = EXPECTED_STAGES[index];
    return stage.successful === true && stage.exitCode === 0 && stage.reportContract === spec[2]
      && stage.outputDomain === spec[3] && stage.auditPublishable === true && stageHashesValid(stage)
      && same(stage.dependencies, expectedColossalWyrmRewardRefreshStageDependencies(stage.stageKey, options.externalInputs, stages.slice(0, index)));
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
    present: final?.stageKey === 'reward_source_change_evaluation',
    changeDetected: final?.changeDetected === true,
    changeEventCount: Number(final?.changeEventCount || 0),
    eventsOnlyRequeueExactEvidenceWork: final?.eventsOnlyRequeueExactEvidenceWork === true
  };
  const blockers = [];
  if (!policyValidation.valid) blockers.push('dry_run_refresh_policy_invalid');
  if (!externalInputIntegrity.complete) blockers.push('external_input_integrity_failed');
  if (!allFourStages) blockers.push(failedIndex >= 0 ? `stage_failed:${stages[failedIndex]?.stageKey || 'unknown'}` : 'four_stage_lineage_incomplete_or_out_of_order');
  if (!stoppedAtFirstFailure) blockers.push('execution_continued_after_first_failure');
  if (allFourStages && !everyStageValid) blockers.push('stage_report_snapshot_policy_audit_or_dependency_integrity_failed');
  if (allFourStages && (!changeEvaluation.present || !changeEvaluation.eventsOnlyRequeueExactEvidenceWork)) blockers.push('change_evaluation_missing_or_can_apply_semantics');
  if (semanticPromotionCount || accountStateFindings.length) blockers.push('refresh_created_semantic_optimizer_account_or_authority_state');
  if (!recordsMatchExpected || !hashesValid) blockers.push('lineage_record_reconstruction_or_hash_validation_failed');
  const orchestrationComplete = blockers.length === 0 && expectedRecords.length === 1;
  return {
    contract: policy.auditContract,
    policyValidation,
    externalInputIntegrity,
    stageCoverage: { expectedStageCount: 4, executedStageCount: stages.length, expectedOrder, actualOrder, allFourStages, everyStageValid },
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
    mechanicalCompletenessProven: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_colossal_wyrm_reward_mechanics_not_authoritative',
    publishable: orchestrationComplete,
    blockers: unique(blockers)
  };
}

export function buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh(options = {}) {
  const contentHash = options.contentHash || hash;
  const policyValidation = compileAgilityColossalWyrmTermiteRewardRateDryRunRefreshPolicy(options.policy || {});
  const external = validateColossalWyrmRewardRefreshExternalInputs(options.externalInputs, options.policy || {});
  const stages = options.stageResults || [];
  const preliminarilyComplete = policyValidation.valid && external.complete && stages.length === EXPECTED_STAGES.length
    && stages.every(stage => stage.successful === true);
  const records = preliminarilyComplete ? [makeRecord(options, contentHash)] : [];
  const audit = auditAgilityColossalWyrmTermiteRewardRateDryRunRefresh(records, { ...options, contentHash });
  return { records: audit.publishable ? records : [], audit };
}

export async function executeColossalWyrmRewardRefreshStages(stageSpecs, executeStage) {
  const results = [];
  for (const stage of stageSpecs) {
    const result = await executeStage(stage, [...results]);
    results.push(result);
    if (result.successful !== true) break;
  }
  return results;
}

export const agilityColossalWyrmRewardRefreshStageSpecifications = () => EXPECTED_STAGES.map(([stageKey, script, reportContract, outputDomain, dependencies]) => ({ stageKey, script, reportContract, outputDomain, dependencies: [...dependencies] }));
