import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry } from './agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
for (const name of ['discovery-audit', 'discovery-snapshot', 'sufficiency-audit', 'sufficiency-snapshot']) {
  if (!argument(name)) throw new Error(`An explicit --${name}=<${name.endsWith('audit') ? 'report.json' : 'snapshot directory'}> is required.`);
}

async function loadSnapshot(directoryArgument) {
  const directory = path.resolve(directoryArgument);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  manifest.snapshotDirectory = path.basename(directory);
  const raw = await fs.readFile(path.join(directory, `${manifest.domain}.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  return { directory, manifest, records };
}

const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-v1.json');
const discoveryPolicyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-discovery-v1.json');
const sufficiencyPolicyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-v1.json');
const discoveryAuditFile = path.resolve(argument('discovery-audit'));
const sufficiencyAuditFile = path.resolve(argument('sufficiency-audit'));
const [policy, discoveryPolicy, sufficiencyPolicy, discoveryAudit, sufficiencyAudit, discoverySnapshot, sufficiencySnapshot] = await Promise.all([
  fs.readFile(policyFile, 'utf8').then(JSON.parse),
  fs.readFile(discoveryPolicyFile, 'utf8').then(JSON.parse),
  fs.readFile(sufficiencyPolicyFile, 'utf8').then(JSON.parse),
  fs.readFile(discoveryAuditFile, 'utf8').then(JSON.parse),
  fs.readFile(sufficiencyAuditFile, 'utf8').then(JSON.parse),
  loadSnapshot(argument('discovery-snapshot')),
  loadSnapshot(argument('sufficiency-snapshot'))
]);

const built = buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry({
  discoveryAudit,
  discoveryManifest: discoverySnapshot.manifest,
  discoveryRecords: discoverySnapshot.records,
  discoveryPolicy,
  sufficiencyAudit,
  sufficiencyManifest: sufficiencySnapshot.manifest,
  sufficiencyRecords: sufficiencySnapshot.records,
  sufficiencyPolicy,
  policy,
  contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
const inputs = {
  discovery: {
    audit: { file: discoveryAuditFile, contract: discoveryAudit.contract, contentHash: discoveryAudit.contentHash },
    snapshot: {
      directory: discoverySnapshot.manifest.snapshotDirectory,
      domain: discoverySnapshot.manifest.domain,
      contentHash: discoverySnapshot.manifest.contentHash,
      records: discoverySnapshot.manifest.records
    },
    policy: {
      file: path.relative(process.cwd(), discoveryPolicyFile).replaceAll('\\', '/'),
      id: discoveryPolicy.policy,
      contentHash: hash(discoveryPolicy)
    }
  },
  sufficiency: {
    audit: { file: sufficiencyAuditFile, contract: sufficiencyAudit.contract, contentHash: sufficiencyAudit.contentHash },
    snapshot: {
      directory: sufficiencySnapshot.manifest.snapshotDirectory,
      domain: sufficiencySnapshot.manifest.domain,
      contentHash: sufficiencySnapshot.manifest.contentHash,
      records: sufficiencySnapshot.manifest.records
    },
    policy: {
      file: path.relative(process.cwd(), sufficiencyPolicyFile).replaceAll('\\', '/'),
      id: sufficiencyPolicy.policy,
      contentHash: hash(sufficiencyPolicy)
    }
  }
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'deterministic_fail_closed_colossal_wyrm_reward_source_change_monitoring_registry',
    scope: 'six open reward-mechanics blocker domains; monitor 47 queries, 353 source-binding occurrences over 71 distinct revisions, 30 classified signals, and six sufficiency dispositions',
    policy: policyBinding,
    inputs,
    audit: built.audit
  });
  outputSnapshot = {
    directory: path.basename(snapshot.dir),
    contentHash: snapshot.manifest.contentHash,
    records: snapshot.manifest.records
  };
}
const reportBase = { ...built.audit, generatedAt, policy: policyBinding, inputs, outputSnapshot };
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
