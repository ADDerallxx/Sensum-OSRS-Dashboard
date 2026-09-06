import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation } from './cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population-consolidation-lib.mjs';

const root = path.resolve(process.argv.find(value => value.startsWith('--root='))?.slice(7) || '.platform-data');
const queueDomain = 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue';
const shardDomain = 'cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population';
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population-consolidation-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));

async function readSnapshot(directory, domain, manifest) {
  try {
    const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
    return { directory, manifest, records: raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse), rawContentHash: hash(raw) };
  } catch (error) {
    return { directory, manifest, records: [], rawContentHash: null, readError: error.message };
  }
}

const directories = (await fs.readdir(root, { withFileTypes: true }))
  .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
  .map(entry => entry.name).sort();
const queueSnapshots = [];
const shardSnapshots = [];
for (const directory of directories) {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
    if (manifest.domain === queueDomain) queueSnapshots.push(await readSnapshot(directory, queueDomain, manifest));
    if (manifest.domain === shardDomain) shardSnapshots.push(await readSnapshot(directory, shardDomain, manifest));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (!queueSnapshots.length) throw new Error('No rendered-page/no-unlock reconciliation work-queue snapshot exists.');
if (!shardSnapshots.length) throw new Error('No rendered-page/no-unlock target source-signature shard snapshots exist.');

const queueSnapshot = queueSnapshots.at(-1);
const built = buildRenderedPageWithoutUnlockTargetSourceSignaturePopulation({ queueSnapshot, shardSnapshots, policy, contentHash: hash });
const inputQueueSnapshot = { directory: queueSnapshot.directory, contentHash: queueSnapshot.manifest?.contentHash || null };
if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputQueueSnapshot, coverage: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'deterministic_complete_source_signature_population_without_semantic_or_optimizer_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    inputQueueSnapshot,
    selectedShardSnapshots: built.audit.shardDiscoveryCoverage.selectedShards,
    audit: built.audit
  };
  const snapshot = await writeSnapshot(root, outputDomain, built.records, source);
  const generatedAt = new Date().toISOString();
  const report = { ...built.audit, generatedAt, policy: source.policy, inputQueueSnapshot, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
  report.contentHash = hash(Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'contentHash')));
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputQueueSnapshot, outputSnapshot: report.outputSnapshot, reportDirectory, coverage: report }, null, 2));
}
