import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hash, json, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation } from '../transforms/agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-lib.mjs';
import {
  agilityColossalWyrmRewardRefreshStageSpecifications,
  buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh,
  executeColossalWyrmRewardRefreshStages,
  expectedColossalWyrmRewardRefreshStageDependencies,
  validateColossalWyrmRewardRefreshExternalInputs
} from './agility-colossal-wyrm-termite-reward-rate-dry-run-refresh-orchestration-lib.mjs';

const executeFile = promisify(execFile);
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const requiredArguments = ['field-audit', 'field-snapshot', 'baseline-registry-report', 'baseline-registry-snapshot'];
for (const name of requiredArguments) if (!argument(name)) throw new Error(`Provide --${name}=<exact ${name.endsWith('snapshot') ? 'snapshot directory' : 'report.json'}>.`);

const root = path.resolve(argument('root') || '.platform-data');
const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-dry-run-refresh-orchestration-v1.json');
const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDirectory = path.join(root, policy.runDirectoryName, runId);

const reportHashValid = report => typeof report?.contentHash === 'string' && hash({ ...report, contentHash: undefined }) === report.contentHash;
const auditContainedInReport = (audit, report) => Object.entries(audit || {}).every(([key, value]) => json(report?.[key]) === json(value));

async function loadSnapshot(directoryArgument, expectedDomain) {
  const snapshotPath = path.resolve(directoryArgument);
  const manifest = JSON.parse(await fs.readFile(path.join(snapshotPath, 'manifest.json'), 'utf8'));
  const raw = await fs.readFile(path.join(snapshotPath, `${manifest.domain}.ndjson`), 'utf8');
  return {
    directory: path.basename(snapshotPath), path: snapshotPath, manifest, raw,
    contract: manifest.contract,
    contentHash: manifest.contentHash || null,
    contentHashValid: manifest.contract === 'sensum.ingestion-manifest.v1' && manifest.domain === expectedDomain
      && manifest.contentHash === hash(raw),
    explicitlySelected: true
  };
}

async function loadFieldInput() {
  const reportFile = path.resolve(argument('field-audit'));
  const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
  const snapshot = await loadSnapshot(argument('field-snapshot'), 'agility-colossal-wyrm-obsolete-notice-field-reconciliation');
  const reportValid = report.contract === policy.inputContracts.fieldAudit && reportHashValid(report) && report.publishable === true;
  const bindingValid = report.outputSnapshot?.contentHash === snapshot.contentHash
    && report.outputSnapshot?.directory === snapshot.directory
    && Number(report.outputSnapshot?.records) === Number(snapshot.manifest.records);
  const auditBindingValid = auditContainedInReport(snapshot.manifest.source?.audit, report);
  const deepIntegrityValid = reportValid && snapshot.contentHashValid && bindingValid && auditBindingValid;
  return {
    report: {
      file: reportFile, explicitlySelected: true, contract: report.contract,
      contentHash: report.contentHash || null, contentHashValid: reportValid,
      publishable: reportValid, deepIntegrityValid,
      outputSnapshotContentHash: report.outputSnapshot?.contentHash || null,
      outputSnapshotDirectory: report.outputSnapshot?.directory || null
    },
    snapshot: { ...snapshot, manifest: undefined, raw: undefined, deepIntegrityValid }
  };
}

async function loadBaselineRegistry() {
  const reportFile = path.resolve(argument('baseline-registry-report'));
  const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
  const snapshot = await loadSnapshot(argument('baseline-registry-snapshot'), 'agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry');
  const [evaluationPolicy, registryPolicy] = await Promise.all([
    fs.readFile(path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-v1.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-v1.json'), 'utf8').then(JSON.parse)
  ]);
  const evaluatorInput = { reportFile, report, manifest: snapshot.manifest, raw: snapshot.raw, snapshotDirectory: snapshot.directory };
  const deepRegistryIntegrityValid = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation({
    baseline: evaluatorInput, current: evaluatorInput, policy: evaluationPolicy, registryPolicy, contentHash: hash
  }).audit.publishable === true;
  const reportValid = report.contract === policy.inputContracts.baselineRegistryAudit && reportHashValid(report)
    && report.publishable === true && report.registryComplete === true
    && report.outputSnapshot?.contentHash === snapshot.contentHash && report.outputSnapshot?.directory === snapshot.directory;
  const deepIntegrityValid = reportValid && snapshot.contentHashValid && deepRegistryIntegrityValid;
  return {
    report: {
      file: reportFile, explicitlySelected: true, contract: report.contract,
      contentHash: report.contentHash || null, contentHashValid: reportValid,
      publishable: reportValid, deepIntegrityValid,
      outputSnapshotContentHash: report.outputSnapshot?.contentHash || null,
      outputSnapshotDirectory: report.outputSnapshot?.directory || null
    },
    snapshot: { ...snapshot, manifest: undefined, raw: undefined, deepIntegrityValid }
  };
}

const [field, baselineRegistry] = await Promise.all([loadFieldInput(), loadBaselineRegistry()]);
const externalInputs = {
  fieldAudit: field.report,
  fieldSnapshot: field.snapshot,
  baselineRegistryReport: baselineRegistry.report,
  baselineRegistrySnapshot: baselineRegistry.snapshot
};

function stageArguments(stage, priorStages) {
  const common = [`--root=${runDirectory}`];
  const prior = Object.fromEntries(priorStages.map(result => [result.stageKey, result]));
  if (stage.stageKey === 'reward_source_discovery') return [...common,
    `--field-audit=${field.report.file}`, `--field-snapshot=${field.snapshot.path}`
  ];
  if (stage.stageKey === 'reward_source_sufficiency') return [...common,
    `--discovery-audit=${prior.reward_source_discovery.reportFile}`,
    `--discovery-snapshot=${prior.reward_source_discovery.snapshotPath}`
  ];
  if (stage.stageKey === 'reward_source_change_registry') return [...common,
    `--discovery-audit=${prior.reward_source_discovery.reportFile}`,
    `--discovery-snapshot=${prior.reward_source_discovery.snapshotPath}`,
    `--sufficiency-audit=${prior.reward_source_sufficiency.reportFile}`,
    `--sufficiency-snapshot=${prior.reward_source_sufficiency.snapshotPath}`
  ];
  return [...common,
    `--baseline-report=${baselineRegistry.report.file}`,
    `--baseline-snapshot=${baselineRegistry.snapshot.path}`,
    `--current-report=${prior.reward_source_change_registry.reportFile}`,
    `--current-snapshot=${prior.reward_source_change_registry.snapshotPath}`
  ];
}

function reportSnapshotBinding(binding = {}) {
  return { reportContentHash: binding.audit?.contentHash || null, snapshotContentHash: binding.snapshot?.contentHash || null };
}

function dependenciesFromManifest(stageKey, manifest) {
  if (stageKey === 'reward_source_discovery') return {
    field_reconciliation: reportSnapshotBinding(manifest.source?.input)
  };
  if (stageKey === 'reward_source_sufficiency') return {
    reward_source_discovery: reportSnapshotBinding(manifest.source?.input)
  };
  if (stageKey === 'reward_source_change_registry') return {
    reward_source_discovery: reportSnapshotBinding(manifest.source?.inputs?.discovery),
    reward_source_sufficiency: reportSnapshotBinding(manifest.source?.inputs?.sufficiency)
  };
  return {
    baseline_registry: {
      reportContentHash: manifest.source?.baseline?.reportContentHash || null,
      snapshotContentHash: manifest.source?.baseline?.snapshotContentHash || null
    },
    reward_source_change_registry: {
      reportContentHash: manifest.source?.current?.reportContentHash || null,
      snapshotContentHash: manifest.source?.current?.snapshotContentHash || null
    }
  };
}

const authorityNumber = (audit, key) => Number(audit?.authorityBoundary?.[key] || audit?.blockerPreservation?.[key] || 0);

async function runStage(stage, priorStages) {
  const startedAt = new Date().toISOString();
  try {
    const child = await executeFile(process.execPath, [stage.script, ...stageArguments(stage, priorStages)], {
      cwd: process.cwd(), maxBuffer: 100 * 1024 * 1024, windowsHide: true
    });
    const output = JSON.parse(child.stdout.trim());
    const reportFile = path.join(path.resolve(output.reportDir), 'report.json');
    const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
    const snapshotPath = path.join(runDirectory, output.outputSnapshot?.directory || 'missing');
    const manifest = JSON.parse(await fs.readFile(path.join(snapshotPath, 'manifest.json'), 'utf8'));
    const raw = await fs.readFile(path.join(snapshotPath, `${manifest.domain}.ndjson`), 'utf8');
    const dependencies = dependenciesFromManifest(stage.stageKey, manifest);
    const expectedDependencies = expectedColossalWyrmRewardRefreshStageDependencies(stage.stageKey, externalInputs, priorStages);
    const reportHashIsValid = reportHashValid(report);
    const snapshotHashIsValid = manifest.contentHash === hash(raw);
    const reportSnapshotBindingValid = report.outputSnapshot?.directory === path.basename(snapshotPath)
      && report.outputSnapshot?.contentHash === manifest.contentHash;
    const policyAuditIntegrityValid = auditContainedInReport(output.audit, report)
      && json(output.audit) === json(manifest.source?.audit)
      && json(dependencies) === json(expectedDependencies);
    const successful = report.contract === stage.reportContract && manifest.domain === stage.outputDomain
      && report.publishable === true && output.audit?.publishable === true && reportHashIsValid
      && snapshotHashIsValid && reportSnapshotBindingValid && policyAuditIntegrityValid;
    return {
      stageKey: stage.stageKey, script: stage.script, startedAt, completedAt: new Date().toISOString(),
      exitCode: 0, successful, reportFile, reportContract: report.contract,
      reportContentHash: report.contentHash || null, reportHashValid: reportHashIsValid,
      snapshotPath, snapshotDirectory: path.basename(snapshotPath),
      snapshotContentHash: manifest.contentHash || null, snapshotRecordCount: Number(manifest.records || 0),
      snapshotHashValid: snapshotHashIsValid, reportSnapshotBindingValid, policyAuditIntegrityValid,
      outputDomain: manifest.domain, dependencies, auditPublishable: output.audit?.publishable === true,
      auditBlockers: output.audit?.blockers || [],
      changeDetected: output.audit?.changeCoverage?.changeDetected === true,
      changeEventCount: Number(output.audit?.changeCoverage?.changeEventCount || 0),
      eventsOnlyRequeueExactEvidenceWork: stage.stageKey !== 'reward_source_change_evaluation'
        || output.audit?.routingCoverage?.everyEventRequeuesOnlyExactEvidenceWork === true,
      blockersClosed: authorityNumber(output.audit, 'blockersClosed'),
      semanticFactsCreated: authorityNumber(output.audit, 'semanticFactsCreated'),
      optimizerEligibleCount: authorityNumber(output.audit, 'optimizerEligibleRecords') + authorityNumber(output.audit, 'optimizerEligibleEvents'),
      verifiedBestAuthorizationCount: authorityNumber(output.audit, 'verifiedBestAuthorizations'),
      automaticVerificationCount: authorityNumber(output.audit, 'automaticVerifications'),
      completeWikiUniverseClaimCount: authorityNumber(output.audit, 'completeWikiUniverseClaims')
    };
  } catch (error) {
    return {
      stageKey: stage.stageKey, script: stage.script, startedAt, completedAt: new Date().toISOString(),
      exitCode: Number.isInteger(error.code) ? error.code : 1, successful: false,
      reportFile: null, reportContract: stage.reportContract, reportContentHash: null,
      reportHashValid: false, snapshotPath: null, snapshotDirectory: null,
      snapshotContentHash: null, snapshotRecordCount: 0, snapshotHashValid: false,
      reportSnapshotBindingValid: false, policyAuditIntegrityValid: false,
      outputDomain: stage.outputDomain,
      dependencies: expectedColossalWyrmRewardRefreshStageDependencies(stage.stageKey, externalInputs, priorStages),
      auditPublishable: false, auditBlockers: ['stage_execution_failed'],
      error: String(error.stderr || error.message || error).trim().slice(0, 4000),
      blockersClosed: 0, semanticFactsCreated: 0, optimizerEligibleCount: 0,
      verifiedBestAuthorizationCount: 0, automaticVerificationCount: 0, completeWikiUniverseClaimCount: 0
    };
  }
}

let stageResults = [];
const externalIntegrity = validateColossalWyrmRewardRefreshExternalInputs(externalInputs, policy);
if (externalIntegrity.complete) {
  await fs.mkdir(runDirectory, { recursive: true });
  stageResults = await executeColossalWyrmRewardRefreshStages(agilityColossalWyrmRewardRefreshStageSpecifications(), runStage);
}

const built = buildAgilityColossalWyrmTermiteRewardRateDryRunRefresh({ policy, externalInputs, stageResults, runId, runDirectory });
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'isolated_local_four_stage_colossal_wyrm_reward_source_refresh_lineage',
    scope: 'query-bounded official Wiki discovery, sufficiency disposition, monitoring-registry refresh, and exact change routing only; no semantic application or complete-universe claim',
    runId, runDirectory, policy: policyBinding, externalInputs, audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
}
const reportBase = { ...built.audit, generatedAt, runId, runDirectory, policy: policyBinding, externalInputs, stageResults, outputSnapshot };
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, runDirectory, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
