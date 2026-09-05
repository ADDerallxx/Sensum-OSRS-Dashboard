import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildStructuralMemberCandidateIdentityReviewQueueExport } from './structural-member-candidate-identity-review-queue-export-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/structural-member-candidate-identity-review-queue-export-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'structural-member-candidate-identity-review-packets';
const outputDomain = 'structural-member-candidate-identity-review-queue';

async function latestInputSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${inputDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const audit = manifest.source?.audit || {};
      const reasons = [];
      if (manifest.domain !== inputDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (audit.reviewPacketMaterializationComplete !== true || audit.identityReviewComplete !== false || audit.optimizerEligibleCount !== 0 || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('review_packet_snapshot_not_publishable_or_gates_not_closed');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) {
        rejections.push({ directory, reasons });
        continue;
      }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid structural member candidate identity review packet snapshot exists.');
}

const input = await latestInputSnapshot();
const built = buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords: input.rows, policy });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'deterministic_source_bound_candidate_identity_review_queue_export_without_review_decision_or_semantic_promotion',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const markdownFile = path.join(snapshot.dir, 'review-queue.md');
const decisionTemplateFile = path.join(snapshot.dir, 'decision-template.ndjson');
await fs.writeFile(markdownFile, built.markdown, 'utf8');
await fs.writeFile(decisionTemplateFile, built.decisionTemplateNdjson, 'utf8');
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash },
  artifacts: {
    markdown: { file: path.basename(markdownFile), contentHash: hash(built.markdown), bytes: Buffer.byteLength(built.markdown, 'utf8') },
    decisionTemplate: { file: path.basename(decisionTemplateFile), contentHash: hash(built.decisionTemplateNdjson), bytes: Buffer.byteLength(built.decisionTemplateNdjson, 'utf8') }
  }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot: report.outputSnapshot,
  artifacts: report.artifacts,
  coverage: {
    inputCoverage: report.inputCoverage,
    sourceIntegrityCoverage: report.sourceIntegrityCoverage,
    packetIntegrityCoverage: report.packetIntegrityCoverage,
    queueCoverage: report.queueCoverage,
    artifactCoverage: report.artifactCoverage,
    semanticPreservationCoverage: report.semanticPreservationCoverage,
    reviewQueueExportComplete: report.reviewQueueExportComplete,
    identityReviewComplete: report.identityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
