import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from './lib.mjs';
import { buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis } from './agility-colossal-wyrm-termite-reward-claim-temporal-conflict-synthesis-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const timelineAuditArgument = argument('timeline-audit');
const timelineSnapshotArgument = argument('timeline-snapshot');
if (!timelineAuditArgument) throw new Error('An explicit --timeline-audit=<report.json> is required.');
if (!timelineSnapshotArgument) throw new Error('An explicit --timeline-snapshot=<directory> is required.');

const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-claim-temporal-conflict-synthesis-v1.json');
const inputPolicyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-v1.json');
const [policy, inputPolicy] = await Promise.all([
  fs.readFile(policyFile, 'utf8').then(JSON.parse),
  fs.readFile(inputPolicyFile, 'utf8').then(JSON.parse)
]);

const timelineAuditFile = path.resolve(timelineAuditArgument);
const timelineAudit = JSON.parse(await fs.readFile(timelineAuditFile, 'utf8'));
const timelineSnapshotDirectory = path.resolve(timelineSnapshotArgument);
const timelineManifest = JSON.parse(await fs.readFile(path.join(timelineSnapshotDirectory, 'manifest.json'), 'utf8'));
timelineManifest.snapshotDirectory = path.basename(timelineSnapshotDirectory);
const timelineRaw = await fs.readFile(path.join(timelineSnapshotDirectory, `${policy.inputSnapshotDomain}.ndjson`), 'utf8');
const timelineRecords = timelineRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

const built = buildAgilityColossalWyrmRewardClaimTemporalConflictSynthesis({
  timelineAudit,
  timelineManifest,
  timelineRecords,
  inputPolicy,
  policy,
  contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
const inputBinding = {
  audit: {
    file: timelineAuditFile,
    contract: timelineAudit.contract,
    contentHash: timelineAudit.contentHash
  },
  snapshot: {
    directory: timelineManifest.snapshotDirectory,
    domain: timelineManifest.domain,
    contentHash: timelineManifest.contentHash,
    records: timelineManifest.records
  },
  policy: {
    file: path.relative(process.cwd(), inputPolicyFile).replaceAll('\\', '/'),
    id: inputPolicy.policy,
    contentHash: hash(inputPolicy)
  }
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'revision_pinned_colossal_wyrm_reward_claim_temporal_conflict_synthesis',
    scope: 'six exact reward-mechanics blockers synthesized from 17 independent claim histories around the official relative-change boundary; chronology only; no causality, arithmetic reconciliation, mechanic, or optimizer promotion',
    input: inputBinding,
    policy: policyBinding,
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
  input: inputBinding,
  outputSnapshot
};
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
