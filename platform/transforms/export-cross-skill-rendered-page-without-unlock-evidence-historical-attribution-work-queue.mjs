import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildHistoricalAttributionWorkQueue } from './cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-lib.mjs';

const root = path.resolve(process.argv.find(value => value.startsWith('--root='))?.slice(7) || '.platform-data');
const requestedWorkQueueSnapshot = process.argv.find(value => value.startsWith('--work-queue-snapshot='))?.slice(22);
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-v1.json';
const sourceWorkQueuePolicyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-v1.json';
const partitionPolicyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-partition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const sourceWorkQueuePolicy = JSON.parse(await fs.readFile(path.resolve(sourceWorkQueuePolicyFile), 'utf8'));
const partitionPolicy = JSON.parse(await fs.readFile(path.resolve(partitionPolicyFile), 'utf8'));
const domains = {
  workQueue: 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue',
  partition: 'cross-skill-rendered-page-without-unlock-evidence-partition',
  candidate: 'cross-source-entity-activity-candidate',
  output: 'cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue'
};

async function loadSnapshot(directory, domain) {
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  if (manifest.domain !== domain || manifest.records !== records.length || manifest.contentHash !== hash(raw)) {
    throw new Error(`${domain} snapshot ${directory} failed manifest validation.`);
  }
  return { directory, raw, records, manifest };
}

async function timestampDirectories() {
  return (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
}

function validWorkQueueSource(snapshot) {
  const source = snapshot.manifest.source || {}, audit = source.audit || {};
  return source.policy?.id === policy.inputWorkQueuePolicy && source.policy?.contentHash === policy.inputWorkQueuePolicyContentHash &&
    source.partitionPolicy?.id === policy.inputPartitionPolicy && source.partitionPolicy?.contentHash === policy.inputPartitionPolicyContentHash &&
    audit.queueExportComplete === true && audit.publishable === true && audit.reconciliationComplete === false && audit.completeActivityUniverse === false &&
    audit.evidenceWorkCoverage?.historicalRenderedAttributionRequiredCount > 0 &&
    !audit.queueCoverage?.duplicateOutputPartitionKeys?.length && !audit.queueCoverage?.missingOutputPartitionKeys?.length &&
    !audit.queueCoverage?.unexpectedOutputPartitionKeys?.length && !audit.queueCoverage?.recordMismatchPartitionKeys?.length &&
    !audit.semanticPreservationCoverage?.unsupportedPromotionPartitionKeys?.length;
}

async function selectWorkQueueSnapshot() {
  if (requestedWorkQueueSnapshot) {
    const snapshot = await loadSnapshot(requestedWorkQueueSnapshot, domains.workQueue);
    if (!validWorkQueueSource(snapshot)) throw new Error(`Requested work-queue snapshot ${requestedWorkQueueSnapshot} failed source-gate validation.`);
    return snapshot;
  }
  for (const directory of await timestampDirectories()) {
    try {
      const snapshot = await loadSnapshot(directory, domains.workQueue);
      if (validWorkQueueSource(snapshot)) return snapshot;
    } catch (error) { if (error.code !== 'ENOENT' && !/failed manifest validation/.test(error.message)) throw error; }
  }
  throw new Error('No valid cross-skill rendered-page/no-unlock reconciliation work-queue snapshot exists.');
}

async function loadBoundSnapshot(sourceWorkQueue, key, domain) {
  const binding = sourceWorkQueue.manifest.source?.[key];
  if (!binding?.directory || !binding?.contentHash) throw new Error(`Source work queue does not bind ${key}.`);
  const snapshot = await loadSnapshot(binding.directory, domain);
  if (snapshot.manifest.contentHash !== binding.contentHash) throw new Error(`${key} content hash does not match the source work queue binding.`);
  return snapshot;
}

const workQueue = await selectWorkQueueSnapshot();
const partition = await loadBoundSnapshot(workQueue, 'inputPartitionSnapshot', domains.partition);
const candidate = await loadBoundSnapshot(workQueue, 'inputCandidateSnapshot', domains.candidate);
const snapshots = {
  workQueue: workQueue.manifest.contentHash,
  partition: partition.manifest.contentHash,
  candidate: candidate.manifest.contentHash
};
const sources = { workQueue: workQueue.manifest, partition: partition.manifest, candidate: candidate.manifest };
const built = buildHistoricalAttributionWorkQueue({
  workQueueRecords: workQueue.records,
  partitionRecords: partition.records,
  candidateRecords: candidate.records,
  policy,
  sourceWorkQueuePolicy,
  partitionPolicy,
  snapshots,
  sources,
  contentHash: hash
});
const inputSnapshots = {
  workQueue: { directory: workQueue.directory, contentHash: snapshots.workQueue },
  partition: { directory: partition.directory, contentHash: snapshots.partition },
  candidate: { directory: candidate.directory, contentHash: snapshots.candidate }
};

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshots, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'source_bound_historical_rendered_expansion_dependency_attribution_work_queue_without_attribution_or_semantic_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    inputWorkQueuePolicy: { id: sourceWorkQueuePolicy.policy, file: sourceWorkQueuePolicyFile, contentHash: hash(sourceWorkQueuePolicy) },
    inputPartitionPolicy: { id: partitionPolicy.policy, file: partitionPolicyFile, contentHash: hash(partitionPolicy) },
    inputSnapshots,
    audit: built.audit
  };
  const snapshot = await writeSnapshot(root, domains.output, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = {
    ...built.audit,
    generatedAt,
    policy: source.policy,
    inputWorkQueuePolicy: source.inputWorkQueuePolicy,
    inputPartitionPolicy: source.inputPartitionPolicy,
    inputSnapshots,
    outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash },
    artifactHashes: {
      queueTsv: hash(built.artifacts.queueTsv),
      blankDecisions: hash(built.artifacts.blankDecisions)
    }
  };
  report.contentHash = hash(withoutContentHash(report));
  const reportDirectory = path.join(root, `${domains.output}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(reportDirectory, 'queue.tsv'), built.artifacts.queueTsv);
  await fs.writeFile(path.join(reportDirectory, 'blank-decisions.ndjson'), built.artifacts.blankDecisions);
  console.log(JSON.stringify({
    contract: report.contract,
    accepted: true,
    inputSnapshots,
    outputSnapshot: report.outputSnapshot,
    reportDirectory,
    artifactHashes: report.artifactHashes,
    coverage: {
      queueRecords: report.queueCoverage.outputRecordCount,
      mixedRecords: report.queueCoverage.mixedRecordCount,
      renderedOnlyRecords: report.queueCoverage.renderedOnlyRecordCount,
      historicalRenderedObservations: report.observationCoverage.outputHistoricalRenderedObservationCount,
      historicalGuideRevisionBindings: report.observationCoverage.expectedHistoricalGuideRevisionBindingCount,
      attributionDecisions: report.reviewCoverage.attributionCompletedCount,
      optimizerPromotions: report.semanticPreservationCoverage.optimizerPromotionCount,
      queueExportComplete: report.queueExportComplete,
      historicalAttributionComplete: report.historicalAttributionComplete,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers
    }
  }, null, 2));
}

function withoutContentHash(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'contentHash'));
}
