import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport } from './multi-variant-binding-review-and-additional-evidence-queue-export-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/multi-variant-binding-review-and-additional-evidence-queue-export-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-disposition';
const reviewDomain = 'multi-variant-binding-review-queue';
const additionalDomain = 'multi-variant-binding-additional-evidence-work-queue';

async function latestInputSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${inputDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== inputDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.dispositionCoverageComplete !== true || manifest.source?.audit?.variantBindingReviewComplete !== false || manifest.source?.audit?.publishable !== true) reasons.push('binding_evidence_disposition_not_publishable');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid multi-variant binding-evidence disposition snapshot exists.');
}

const input = await latestInputSnapshot();
const built = buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport({ dispositionRecords: input.rows, policy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = { kind: 'deterministic_disjoint_multi_variant_binding_review_and_additional_evidence_queue_export_without_decision_or_promotion', policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) }, inputSnapshot, audit: built.audit };
const reviewSnapshot = await writeSnapshot(root, reviewDomain, built.reviewRecords.map(record => ({ ...record, contentHash: hash(record) })), source);
const additionalSnapshot = await writeSnapshot(root, additionalDomain, built.additionalEvidenceRecords.map(record => ({ ...record, contentHash: hash(record) })), source);
const reviewMarkdownFile = path.join(reviewSnapshot.dir, 'review-queue.md');
const decisionTemplateFile = path.join(reviewSnapshot.dir, 'decision-template.ndjson');
const additionalMarkdownFile = path.join(additionalSnapshot.dir, 'additional-evidence-work-queue.md');
await fs.writeFile(reviewMarkdownFile, built.reviewMarkdown, 'utf8');
await fs.writeFile(decisionTemplateFile, built.decisionTemplateNdjson, 'utf8');
await fs.writeFile(additionalMarkdownFile, built.additionalEvidenceMarkdown, 'utf8');
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  reviewOutputSnapshot: { directory: path.basename(reviewSnapshot.dir), contentHash: reviewSnapshot.manifest.contentHash },
  additionalEvidenceOutputSnapshot: { directory: path.basename(additionalSnapshot.dir), contentHash: additionalSnapshot.manifest.contentHash },
  artifacts: {
    reviewMarkdown: { file: path.basename(reviewMarkdownFile), contentHash: hash(built.reviewMarkdown), bytes: Buffer.byteLength(built.reviewMarkdown, 'utf8') },
    decisionTemplate: { file: path.basename(decisionTemplateFile), contentHash: hash(built.decisionTemplateNdjson), bytes: Buffer.byteLength(built.decisionTemplateNdjson, 'utf8') },
    additionalEvidenceMarkdown: { file: path.basename(additionalMarkdownFile), contentHash: hash(built.additionalEvidenceMarkdown), bytes: Buffer.byteLength(built.additionalEvidenceMarkdown, 'utf8') }
  }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'multi-variant-binding-review-and-additional-evidence-queue-export-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ contract: report.contract, generatedAt, inputSnapshot, reviewOutputSnapshot: report.reviewOutputSnapshot, additionalEvidenceOutputSnapshot: report.additionalEvidenceOutputSnapshot, artifacts: report.artifacts, coverage: { sourceIntegrityCoverage: report.sourceIntegrityCoverage, packetAndDispositionIntegrityCoverage: report.packetAndDispositionIntegrityCoverage, queuePartitionCoverage: report.queuePartitionCoverage, artifactCoverage: report.artifactCoverage, queueExportComplete: report.queueExportComplete, variantBindingReviewComplete: report.variantBindingReviewComplete, completeActivityUniverse: report.completeActivityUniverse, absoluteBestGate: report.absoluteBestGate, blockers: report.blockers, publishable: report.publishable } }, null, 2));
if (!report.publishable) process.exitCode = 2;
