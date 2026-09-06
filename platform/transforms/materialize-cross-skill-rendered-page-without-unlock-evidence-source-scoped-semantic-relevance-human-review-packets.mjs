import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets } from './cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet-materialization-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet-materialization-v1.json';
const queuePolicyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-v1.json';
const decisionPolicyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const queuePolicy = JSON.parse(await fs.readFile(path.resolve(queuePolicyFile), 'utf8'));
const decisionPolicy = JSON.parse(await fs.readFile(path.resolve(decisionPolicyFile), 'utf8'));
const inputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packets';

async function latestQueueSnapshot() {
  const requested = argument('queue-snapshot');
  const directories = requested ? [requested] : (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${inputDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.contract !== 'sensum.ingestion-manifest.v1' || manifest.domain !== inputDomain) reasons.push('manifest_contract_or_domain_mismatch');
      if (manifest.records !== rows.length || manifest.contentHash !== hash(raw)) reasons.push('record_count_or_content_hash_mismatch');
      if (manifest.source?.policy?.id !== policy.inputQueuePolicy || manifest.source?.policy?.contentHash !== policy.inputQueuePolicyContentHash || hash(queuePolicy) !== policy.inputQueuePolicyContentHash) reasons.push('queue_policy_binding_mismatch');
      if (hash(decisionPolicy) !== policy.inputDecisionImportPolicyContentHash || decisionPolicy.policy !== policy.inputDecisionImportPolicy) reasons.push('decision_import_policy_binding_mismatch');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid rendered-page/no-unlock source-scoped semantic-relevance review queue snapshot exists.');
}

const input = await latestQueueSnapshot();
const built = buildRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets({
  queueRecords: input.rows,
  queueRaw: input.raw,
  queueManifest: input.manifest,
  queueSnapshotContentHash: input.manifest.contentHash,
  policy, queuePolicy, decisionPolicy, contentHash: hash
});
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'deterministic_human_readable_evidence_keyed_semantic_relevance_review_packet_materialization_without_decision_or_semantic_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    inputQueuePolicy: { id: queuePolicy.policy, file: queuePolicyFile, contentHash: hash(queuePolicy) },
    inputDecisionImportPolicy: { id: decisionPolicy.policy, file: decisionPolicyFile, contentHash: hash(decisionPolicy) },
    inputSnapshot,
    audit: built.audit
  };
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const batchDirectory = path.join(snapshot.dir, 'batches');
  await fs.mkdir(batchDirectory, { recursive: true });
  for (const artifact of built.batchArtifacts) {
    await fs.writeFile(path.join(batchDirectory, artifact.markdownFile), artifact.markdown);
    await fs.writeFile(path.join(batchDirectory, artifact.decisionFile), artifact.decisionNdjson);
  }
  await fs.writeFile(path.join(snapshot.dir, 'batch-index.tsv'), built.batchIndexTsv);
  await fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifactManifestJson);

  const generatedAt = new Date().toISOString();
  const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
  const artifacts = {
    directory: 'batches', batchCount: built.batchArtifacts.length,
    batchIndex: { file: 'batch-index.tsv', contentHash: hash(built.batchIndexTsv), bytes: Buffer.byteLength(built.batchIndexTsv, 'utf8') },
    artifactManifest: { file: 'artifact-manifest.json', contentHash: hash(built.artifactManifestJson), bytes: Buffer.byteLength(built.artifactManifestJson, 'utf8') },
    aggregateBatchArtifactContentHash: hash(built.batchArtifacts.map(({ markdown, decisionNdjson, ...metadata }) => ({ ...metadata, markdownContentHash: hash(markdown), decisionContentHash: hash(decisionNdjson) })))
  };
  const report = { ...built.audit, generatedAt, policy: source.policy, inputQueuePolicy: source.inputQueuePolicy, inputDecisionImportPolicy: source.inputDecisionImportPolicy, inputSnapshot, outputSnapshot, artifacts };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputSnapshot, outputSnapshot, artifacts, reportDirectory, coverage: {
    packetCount: report.packetCoverage.packetCount,
    guideObservationCount: report.evidenceCoverage.retainedGuideObservationCount,
    batchCount: report.batchCoverage.batchCount,
    configuredBatchSize: report.batchCoverage.configuredBatchSize,
    packetMaterializationComplete: report.packetMaterializationComplete,
    semanticRelevanceReviewComplete: report.semanticRelevanceReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers
  } }, null, 2));
}
