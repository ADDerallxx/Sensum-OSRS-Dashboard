import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hash, json, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityTargetConditionGapSourceChannelChangeEvaluation } from '../transforms/agility-target-condition-gap-source-channel-change-evaluation-lib.mjs';
import {
  agilityTargetConditionGapRefreshStageSpecifications,
  buildAgilityTargetConditionGapSourceChannelDryRunRefresh,
  executeRefreshStages,
  expectedRefreshStageDependencies,
  validateRefreshExternalInputs
} from './agility-target-condition-gap-source-channel-dry-run-refresh-orchestration-lib.mjs';

const executeFile = promisify(execFile);
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const requiredArguments = ['coverage-audit', 'source-sufficiency-audit', 'baseline-registry-report', 'baseline-registry-snapshot'];
for (const name of requiredArguments) if (!argument(name)) throw new Error(`Provide --${name}=<exact ${name.endsWith('snapshot') ? 'snapshot directory' : 'report.json'}>.`);

const root = path.resolve(argument('root') || '.platform-data');
const policyFile = path.resolve('platform/policies/agility-target-condition-gap-source-channel-dry-run-refresh-orchestration-v1.json');
const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDirectory = path.join(root, policy.runDirectoryName, runId);

const reportHashValid = report => typeof report?.contentHash === 'string' && hash({ ...report, contentHash: undefined }) === report.contentHash;
const auditContainedInReport = (audit, report) => Object.entries(audit || {}).every(([key, value]) => json(report?.[key]) === json(value));

async function loadReportInput(fileArgument, expectedContract, allowBlockedCoverage = false) {
  const file = path.resolve(fileArgument);
  const report = JSON.parse(await fs.readFile(file, 'utf8'));
  const integrity = report.contract === expectedContract && reportHashValid(report);
  return {
    file,
    explicitlySelected: true,
    contract: report.contract,
    contentHash: report.contentHash || null,
    contentHashValid: integrity,
    publishable: integrity && (allowBlockedCoverage || report.publishable === true),
    report
  };
}

async function loadBaselineRegistry(reportArgument, snapshotArgument) {
  const reportFile = path.resolve(reportArgument);
  const snapshotDirectory = path.resolve(snapshotArgument);
  const [report, manifest] = await Promise.all([
    fs.readFile(reportFile, 'utf8').then(JSON.parse),
    fs.readFile(path.join(snapshotDirectory, 'manifest.json'), 'utf8').then(JSON.parse)
  ]);
  const raw = await fs.readFile(path.join(snapshotDirectory, `${manifest.domain}.ndjson`), 'utf8');
  const directory = path.basename(snapshotDirectory);
  const [evaluationPolicy, registryPolicy] = await Promise.all([
    fs.readFile(path.resolve('platform/policies/agility-target-condition-gap-source-channel-change-evaluation-v1.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.resolve('platform/policies/agility-target-condition-gap-source-channel-change-monitoring-registry-v1.json'), 'utf8').then(JSON.parse)
  ]);
  const evaluatorInput = { reportFile, report, manifest, raw, snapshotDirectory: directory };
  const deepRegistryIntegrityValid = buildAgilityTargetConditionGapSourceChannelChangeEvaluation({
    baseline: evaluatorInput,
    current: evaluatorInput,
    policy: evaluationPolicy,
    registryPolicy,
    contentHash: hash
  }).audit.publishable === true;
  const reportValid = report.contract === policy.inputContracts.baselineRegistryAudit && reportHashValid(report)
    && report.publishable === true && report.registryComplete === true
    && report.outputSnapshot?.contentHash === manifest.contentHash && report.outputSnapshot?.directory === directory
    && deepRegistryIntegrityValid;
  const snapshotValid = manifest.contract === policy.inputContracts.baselineRegistryManifest
    && manifest.domain === 'agility-target-condition-gap-source-channel-change-monitoring-registry'
    && manifest.contentHash === hash(raw);
  return {
    report: {
      file: reportFile,
      explicitlySelected: true,
      contract: report.contract,
      contentHash: report.contentHash || null,
      contentHashValid: reportValid,
      publishable: reportValid,
      outputSnapshotContentHash: report.outputSnapshot?.contentHash || null,
      outputSnapshotDirectory: report.outputSnapshot?.directory || null,
      deepRegistryIntegrityValid
    },
    snapshot: {
      directory,
      path: snapshotDirectory,
      explicitlySelected: true,
      contract: manifest.contract,
      contentHash: manifest.contentHash || null,
      contentHashValid: snapshotValid,
      deepRegistryIntegrityValid,
      manifest,
      raw
    }
  };
}

const [coverageAudit, sourceSufficiencyAudit, baselineRegistry] = await Promise.all([
  loadReportInput(argument('coverage-audit'), policy.inputContracts.coverageAudit, true),
  loadReportInput(argument('source-sufficiency-audit'), policy.inputContracts.sourceSufficiencyAudit),
  loadBaselineRegistry(argument('baseline-registry-report'), argument('baseline-registry-snapshot'))
]);
const externalInputs = {
  coverageAudit: { ...coverageAudit, report: undefined },
  sourceSufficiencyAudit: { ...sourceSufficiencyAudit, report: undefined },
  baselineRegistryReport: baselineRegistry.report,
  baselineRegistrySnapshot: { ...baselineRegistry.snapshot, manifest: undefined, raw: undefined }
};

function stageArguments(stage, priorStages) {
  const common = [`--root=${runDirectory}`];
  if (stage.stageKey.endsWith('_search')) return [...common,
    `--coverage-audit=${coverageAudit.file}`,
    `--source-sufficiency-audit=${sourceSufficiencyAudit.file}`
  ];
  const prior = Object.fromEntries(priorStages.map(result => [result.stageKey, result]));
  if (stage.stageKey === 'source_channel_coverage_synthesis') return [...common,
    `--article-report=${prior.current_article_search.reportFile}`,
    `--article-snapshot=${prior.current_article_search.snapshotPath}`,
    `--source-code-report=${prior.current_source_code_search.reportFile}`,
    `--source-code-snapshot=${prior.current_source_code_search.snapshotPath}`,
    `--update-report=${prior.historical_update_archive_search.reportFile}`,
    `--update-snapshot=${prior.historical_update_archive_search.snapshotPath}`
  ];
  if (stage.stageKey === 'source_channel_change_registry') return [...common,
    `--synthesis-report=${prior.source_channel_coverage_synthesis.reportFile}`,
    `--synthesis-snapshot=${prior.source_channel_coverage_synthesis.snapshotPath}`,
    `--article-report=${prior.current_article_search.reportFile}`,
    `--article-snapshot=${prior.current_article_search.snapshotPath}`,
    `--source-code-report=${prior.current_source_code_search.reportFile}`,
    `--source-code-snapshot=${prior.current_source_code_search.snapshotPath}`,
    `--update-report=${prior.historical_update_archive_search.reportFile}`,
    `--update-snapshot=${prior.historical_update_archive_search.snapshotPath}`
  ];
  return [...common,
    `--baseline-report=${baselineRegistry.report.file}`,
    `--baseline-snapshot=${baselineRegistry.snapshot.path}`,
    `--current-report=${prior.source_channel_change_registry.reportFile}`,
    `--current-snapshot=${prior.source_channel_change_registry.snapshotPath}`
  ];
}

function dependenciesFromManifest(stageKey, manifest) {
  if (stageKey.endsWith('_search')) return {
    coverage_audit: { reportContentHash: manifest.source?.coverageInput?.contentHash || null },
    source_sufficiency_audit: { reportContentHash: manifest.source?.sourceSufficiencyInput?.contentHash || null }
  };
  if (stageKey === 'source_channel_coverage_synthesis') return Object.fromEntries((manifest.source?.inputs || []).map(input => [input.channelKey, {
    reportContentHash: input.reportContentHash || null,
    snapshotContentHash: input.snapshotContentHash || null
  }]));
  if (stageKey === 'source_channel_change_registry') {
    const synthesis = manifest.source?.inputSynthesis || {};
    return {
      source_channel_coverage_synthesis: { reportContentHash: synthesis.reportContentHash || null, snapshotContentHash: synthesis.snapshotContentHash || null },
      ...Object.fromEntries((manifest.source?.upstreamInputs || []).map(input => [input.channelKey, {
        reportContentHash: input.reportContentHash || null,
        snapshotContentHash: input.snapshotContentHash || null
      }]))
    };
  }
  return {
    baseline_registry: {
      reportContentHash: manifest.source?.baseline?.reportContentHash || null,
      snapshotContentHash: manifest.source?.baseline?.snapshotContentHash || null
    },
    source_channel_change_registry: {
      reportContentHash: manifest.source?.current?.reportContentHash || null,
      snapshotContentHash: manifest.source?.current?.snapshotContentHash || null
    }
  };
}

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
    const expectedDependencies = expectedRefreshStageDependencies(stage.stageKey, externalInputs, priorStages);
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
      stageKey: stage.stageKey,
      script: stage.script,
      startedAt,
      completedAt: new Date().toISOString(),
      exitCode: 0,
      successful,
      reportFile,
      reportContract: report.contract,
      reportContentHash: report.contentHash || null,
      reportHashValid: reportHashIsValid,
      snapshotPath,
      snapshotDirectory: path.basename(snapshotPath),
      snapshotContentHash: manifest.contentHash || null,
      snapshotRecordCount: Number(manifest.records || 0),
      snapshotHashValid: snapshotHashIsValid,
      reportSnapshotBindingValid,
      policyAuditIntegrityValid,
      outputDomain: manifest.domain,
      dependencies,
      auditPublishable: output.audit?.publishable === true,
      auditBlockers: output.audit?.blockers || [],
      changeDetected: output.audit?.changeCoverage?.changeDetected === true,
      changeEventCount: Number(output.audit?.changeCoverage?.changeEventCount || 0),
      eventsOnlyRequeueEvidenceWork: stage.stageKey !== 'source_channel_change_evaluation'
        || output.audit?.routingCoverage?.everyEventRequeuesOnlyEvidenceWork === true,
      blockersClosed: Number(output.audit?.blockerPreservation?.blockersClosed || 0),
      semanticFactsCreated: Number(output.audit?.blockerPreservation?.semanticFactsCreated || 0),
      optimizerEligibleCount: Number(output.audit?.blockerPreservation?.optimizerEligibleCount || 0),
      verifiedBestAuthorizationCount: Number(output.audit?.blockerPreservation?.verifiedBestAuthorizationCount || 0),
      automaticVerificationCount: Number(output.audit?.blockerPreservation?.automaticVerificationCount || 0),
      completeWikiUniverseClaimCount: Number(output.audit?.blockerPreservation?.completeWikiUniverseClaimCount || 0)
    };
  } catch (error) {
    return {
      stageKey: stage.stageKey,
      script: stage.script,
      startedAt,
      completedAt: new Date().toISOString(),
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      successful: false,
      reportFile: null,
      reportContract: stage.reportContract,
      reportContentHash: null,
      reportHashValid: false,
      snapshotPath: null,
      snapshotDirectory: null,
      snapshotContentHash: null,
      snapshotRecordCount: 0,
      snapshotHashValid: false,
      reportSnapshotBindingValid: false,
      policyAuditIntegrityValid: false,
      outputDomain: stage.outputDomain,
      dependencies: expectedRefreshStageDependencies(stage.stageKey, externalInputs, priorStages),
      auditPublishable: false,
      auditBlockers: ['stage_execution_failed'],
      error: String(error.stderr || error.message || error).trim().slice(0, 4000),
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligibleCount: 0,
      verifiedBestAuthorizationCount: 0,
      automaticVerificationCount: 0,
      completeWikiUniverseClaimCount: 0
    };
  }
}

let stageResults = [];
const externalIntegrity = validateRefreshExternalInputs(externalInputs, policy);
if (externalIntegrity.complete) {
  await fs.mkdir(runDirectory, { recursive: true });
  stageResults = await executeRefreshStages(agilityTargetConditionGapRefreshStageSpecifications(), runStage);
}

const built = buildAgilityTargetConditionGapSourceChannelDryRunRefresh({
  policy, externalInputs, stageResults, runId, runDirectory
});
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'isolated_local_six_stage_target_condition_source_refresh_lineage',
    scope: 'query-bounded official Wiki evidence discovery, synthesis, monitoring, and change routing only; no semantic application or complete-universe claim',
    runId, runDirectory, policy: policyBinding, externalInputs, audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
}
const report = {
  ...built.audit,
  generatedAt,
  runId,
  runDirectory,
  policy: policyBinding,
  externalInputs,
  stageResults,
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, runDirectory, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
