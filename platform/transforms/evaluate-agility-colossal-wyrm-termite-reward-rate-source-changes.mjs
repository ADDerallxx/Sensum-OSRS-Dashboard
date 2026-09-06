import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation } from './agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
for (const name of ['baseline-report', 'baseline-snapshot', 'current-report', 'current-snapshot']) {
  if (!argument(name)) throw new Error(`An explicit --${name}=<${name.endsWith('report') ? 'report.json' : 'snapshot directory'}> is required.`);
}

async function loadInput(label) {
  const reportFile = path.resolve(argument(`${label}-report`));
  const snapshotDirectory = path.resolve(argument(`${label}-snapshot`));
  const [report, manifest] = await Promise.all([
    fs.readFile(reportFile, 'utf8').then(JSON.parse),
    fs.readFile(path.join(snapshotDirectory, 'manifest.json'), 'utf8').then(JSON.parse)
  ]);
  const raw = await fs.readFile(path.join(snapshotDirectory, `${manifest.domain}.ndjson`), 'utf8');
  return { reportFile, report, manifest, raw, snapshotDirectory: path.basename(snapshotDirectory) };
}

const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-v1.json');
const registryPolicyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-v1.json');
const [policy, registryPolicy, baseline, current] = await Promise.all([
  fs.readFile(policyFile, 'utf8').then(JSON.parse),
  fs.readFile(registryPolicyFile, 'utf8').then(JSON.parse),
  loadInput('baseline'),
  loadInput('current')
]);
const built = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation({
  baseline, current, policy, registryPolicy, contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
const registryPolicyBinding = {
  file: path.relative(process.cwd(), registryPolicyFile).replaceAll('\\', '/'),
  id: registryPolicy.policy,
  contentHash: hash(registryPolicy)
};
const inputBinding = input => ({
  reportFile: input.reportFile,
  reportContentHash: input.report.contentHash || null,
  snapshotDirectory: input.snapshotDirectory,
  snapshotContentHash: input.manifest.contentHash || null,
  createdAt: input.manifest.createdAt || null
});
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'deterministic_fail_closed_colossal_wyrm_reward_source_change_evaluation',
    scope: 'exact changed reward-mechanics blocker domains only; an empty snapshot is a valid unchanged evaluation and never a game-fact assertion',
    policy: policyBinding,
    inputRegistryPolicy: registryPolicyBinding,
    baseline: inputBinding(baseline),
    current: inputBinding(current),
    audit: built.audit
  });
  outputSnapshot = {
    directory: path.basename(snapshot.dir),
    contentHash: snapshot.manifest.contentHash,
    records: snapshot.manifest.records
  };
}
const reportBase = {
  ...built.audit,
  generatedAt,
  policy: policyBinding,
  inputRegistryPolicy: registryPolicyBinding,
  baseline: inputBinding(baseline),
  current: inputBinding(current),
  outputSnapshot
};
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
