import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue } from './cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-lib.mjs';

const root = path.resolve(process.argv.find(value => value.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const populationDomain = 'cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population';
const queueDomain = 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue';
const candidateDomain = 'cross-source-entity-activity-candidate';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue';

async function directories() {
  return (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
}

async function readSnapshot(directory, domain) {
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  return { directory, raw, records, manifest };
}

function basicValid(snapshot, domain) {
  return snapshot.manifest.contract === 'sensum.ingestion-manifest.v1' && snapshot.manifest.domain === domain && snapshot.manifest.records === snapshot.records.length && snapshot.records.length > 0 && snapshot.manifest.contentHash === hash(snapshot.raw);
}

async function latestPopulation() {
  for (const directory of await directories()) {
    try {
      const snapshot = await readSnapshot(directory, populationDomain);
      const audit = snapshot.manifest.source?.audit || {};
      if (basicValid(snapshot, populationDomain) && snapshot.manifest.source?.policy?.id === policy.inputPopulationPolicy &&
        snapshot.manifest.source.policy.contentHash === policy.inputPopulationPolicyContentHash && audit.sourceSignaturePopulationComplete === true &&
        audit.reconciliationComplete === false && audit.completeActivityUniverse === false && audit.publishable === true &&
        audit.semanticPreservationCoverage?.semanticReviewCompletedCount === 0 && audit.semanticPreservationCoverage?.optimizerEligibleCount === 0) return snapshot;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('No valid complete rendered-page/no-unlock target source-signature population exists.');
}

async function snapshotByHash(domain, expectedHash, validate) {
  for (const directory of await directories()) {
    try {
      const snapshot = await readSnapshot(directory, domain);
      if (snapshot.manifest.contentHash === expectedHash && basicValid(snapshot, domain) && validate(snapshot)) return snapshot;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error(`No valid ${domain} snapshot matches ${expectedHash}.`);
}

const population = await latestPopulation();
const queueHashes = [...new Set(population.records.map(record => record.sourceWorkQueueSnapshotContentHash))];
if (queueHashes.length !== 1) throw new Error('Source-signature population does not bind exactly one reconciliation queue snapshot.');
const queue = await snapshotByHash(queueDomain, queueHashes[0], snapshot => snapshot.manifest.source?.policy?.id === policy.inputQueuePolicy && snapshot.manifest.source.policy.contentHash === policy.inputQueuePolicyContentHash && snapshot.manifest.source?.audit?.queueExportComplete === true && snapshot.manifest.source.audit.reconciliationComplete === false && snapshot.manifest.source.audit.publishable === true);
const candidateHashes = [...new Set(queue.records.map(record => record.sourceCandidateSnapshotContentHash))];
if (candidateHashes.length !== 1) throw new Error('Reconciliation queue does not bind exactly one source-candidate snapshot.');
const candidates = await snapshotByHash(candidateDomain, candidateHashes[0], snapshot => snapshot.manifest.source?.audit?.candidateInventoryComplete === true && snapshot.manifest.source.audit.completeActivityUniverse === false && snapshot.manifest.source.audit.publishable === true && snapshot.manifest.source.audit.semanticReviewCoverage?.optimizerEligibleCount === 0);

const sourceSnapshots = {
  signatureSnapshotContentHash: population.manifest.contentHash,
  queueSnapshotContentHash: queue.manifest.contentHash,
  candidateSnapshotContentHash: candidates.manifest.contentHash
};
const built = buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue({ signatureRecords: population.records, queueRecords: queue.records, candidateRecords: candidates.records, policy, ...sourceSnapshots, contentHash: hash });
const inputs = {
  signaturePopulation: { directory: population.directory, contentHash: population.manifest.contentHash },
  reconciliationQueue: { directory: queue.directory, contentHash: queue.manifest.contentHash },
  candidateInventory: { directory: candidates.directory, contentHash: candidates.manifest.contentHash }
};
if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputs, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = { kind: 'deterministic_source_bound_semantic_relevance_work_queue_without_review_disposition_or_downstream_promotion', policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) }, inputs, audit: built.audit };
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const indexFile = path.join(snapshot.dir, 'review-index.tsv');
  const templateFile = path.join(snapshot.dir, 'decision-template.ndjson');
  await fs.writeFile(indexFile, built.reviewIndexTsv, 'utf8');
  await fs.writeFile(templateFile, built.decisionTemplateNdjson, 'utf8');
  const generatedAt = new Date().toISOString();
  const artifacts = {
    reviewIndex: { file: path.basename(indexFile), contentHash: hash(built.reviewIndexTsv), bytes: Buffer.byteLength(built.reviewIndexTsv, 'utf8') },
    decisionTemplate: { file: path.basename(templateFile), contentHash: hash(built.decisionTemplateNdjson), bytes: Buffer.byteLength(built.decisionTemplateNdjson, 'utf8') }
  };
  const report = { ...built.audit, generatedAt, policy: source.policy, inputs, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }, artifacts };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const reportDirectory = path.join(root, `${outputDomain}-export-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputs, outputSnapshot: report.outputSnapshot, artifacts, reportDirectory, coverage: report }, null, 2));
}
