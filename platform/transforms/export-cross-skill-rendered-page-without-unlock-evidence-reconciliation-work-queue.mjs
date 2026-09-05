import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockReconciliationWorkQueue } from './cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-lib.mjs';

const root = path.resolve(process.argv.find(value => value.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-v1.json';
const partitionPolicyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-partition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const partitionPolicy = JSON.parse(await fs.readFile(path.resolve(partitionPolicyFile), 'utf8'));
const partitionDomain = 'cross-skill-rendered-page-without-unlock-evidence-partition';
const candidateDomain = 'cross-source-entity-activity-candidate';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue';

async function timestampDirectories() {
  return (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
}

async function latestPartitionSnapshot() {
  for (const directory of await timestampDirectories()) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${partitionDomain}.ndjson`), 'utf8');
      const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const audit = manifest.source?.audit || {};
      if (manifest.domain !== partitionDomain || manifest.records !== records.length || manifest.contentHash !== hash(raw) ||
        audit.partitionComplete !== true || audit.publishable !== true || audit.unlockEvidenceReconciled !== false || audit.completeActivityUniverse !== false ||
        audit.partitionCoverage?.exactDisjointPartition !== true || audit.semanticPreservationCoverage?.unsupportedPromotionTargetKeys?.length || !records.length) continue;
      return { directory, raw, records, manifest };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('No valid rendered-page/no-unlock partition snapshot exists.');
}

async function boundCandidateSnapshot(partition) {
  const directory = partition.manifest.source?.inputSnapshot?.directory;
  const expectedHash = partition.manifest.source?.inputSnapshot?.contentHash;
  if (!directory || !expectedHash) throw new Error('Partition snapshot does not bind a candidate snapshot.');
  const raw = await fs.readFile(path.join(root, directory, `${candidateDomain}.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  const audit = manifest.source?.audit || {};
  if (manifest.domain !== candidateDomain || manifest.records !== records.length || manifest.contentHash !== hash(raw) || manifest.contentHash !== expectedHash ||
    audit.candidateInventoryComplete !== true || audit.publishable !== true || audit.completeActivityUniverse !== false || audit.accountIndependent !== true ||
    audit.inputCoverage?.exactTargetSetAndContextMatch !== true || audit.candidateCoverage?.duplicateCandidateKeys?.length || audit.candidateCoverage?.candidateRoutingMismatchKeys?.length) {
    throw new Error('Bound candidate snapshot failed exact validation.');
  }
  return { directory, raw, records, manifest };
}

const partition = await latestPartitionSnapshot();
const candidate = await boundCandidateSnapshot(partition);
const built = buildRenderedPageWithoutUnlockReconciliationWorkQueue({
  partitionRecords: partition.records, candidateRecords: candidate.records, policy, partitionPolicy,
  partitionSnapshotContentHash: partition.manifest.contentHash, candidateSnapshotContentHash: candidate.manifest.contentHash, contentHash: hash
});
const inputPartitionSnapshot = { directory: partition.directory, contentHash: partition.manifest.contentHash };
const inputCandidateSnapshot = { directory: candidate.directory, contentHash: candidate.manifest.contentHash };

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputPartitionSnapshot, inputCandidateSnapshot, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'generic_source_bound_reconciliation_work_queue_without_semantic_or_optimizer_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    partitionPolicy: { id: partitionPolicy.policy, file: partitionPolicyFile, contentHash: hash(partitionPolicy) },
    inputPartitionSnapshot, inputCandidateSnapshot, audit: built.audit
  };
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = { ...built.audit, generatedAt, policy: source.policy, partitionPolicy: source.partitionPolicy, inputPartitionSnapshot, inputCandidateSnapshot, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
  report.contentHash = hash(withoutContentHash(report));
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(reportDirectory, 'queue.md'), built.markdown);
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputPartitionSnapshot, inputCandidateSnapshot, outputSnapshot: report.outputSnapshot, reportDirectory, coverage: report }, null, 2));
}

function withoutContentHash(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'contentHash'));
}
