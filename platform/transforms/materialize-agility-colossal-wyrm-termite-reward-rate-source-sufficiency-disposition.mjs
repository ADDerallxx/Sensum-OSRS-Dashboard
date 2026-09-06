import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition } from './agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const discoveryAuditArgument = argument('discovery-audit');
const discoverySnapshotArgument = argument('discovery-snapshot');
if (!discoveryAuditArgument) throw new Error('An explicit --discovery-audit=<report.json> is required.');
if (!discoverySnapshotArgument) throw new Error('An explicit --discovery-snapshot=<directory> is required.');

const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-v1.json');
const inputPolicyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-discovery-v1.json');
const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));
const inputPolicy = JSON.parse(await fs.readFile(inputPolicyFile, 'utf8'));
const discoveryAuditFile = path.resolve(discoveryAuditArgument);
const discoveryAudit = JSON.parse(await fs.readFile(discoveryAuditFile, 'utf8'));
const discoverySnapshotDirectory = path.resolve(discoverySnapshotArgument);
const discoveryManifest = JSON.parse(await fs.readFile(path.join(discoverySnapshotDirectory, 'manifest.json'), 'utf8'));
discoveryManifest.snapshotDirectory = path.basename(discoverySnapshotDirectory);
const discoveryRaw = await fs.readFile(path.join(discoverySnapshotDirectory, `${policy.inputSnapshotDomain}.ndjson`), 'utf8');
const discoveryRecords = discoveryRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

const built = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition({
  discoveryAudit, discoveryManifest, discoveryRecords, inputPolicy, policy, contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = { file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'), id: policy.policy, contentHash: hash(policy) };
const inputBinding = {
  audit: { file: discoveryAuditFile, contract: discoveryAudit.contract, contentHash: discoveryAudit.contentHash },
  snapshot: { directory: discoveryManifest.snapshotDirectory, domain: discoveryManifest.domain, contentHash: discoveryManifest.contentHash, records: discoveryManifest.records },
  policy: { file: path.relative(process.cwd(), inputPolicyFile).replaceAll('\\', '/'), id: inputPolicy.policy, contentHash: hash(inputPolicy) }
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'generic_fail_closed_colossal_wyrm_reward_source_sufficiency_disposition',
    scope: 'classify every retained signal by semantic shape and authority; route six unresolved blockers without creating facts, mechanics, or optimizer eligibility',
    input: inputBinding,
    policy: policyBinding,
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
}
const reportBase = { ...built.audit, generatedAt, policy: policyBinding, input: inputBinding, outputSnapshot };
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;

