import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport } from './weighted-parent-task-entry-membership-review-and-evidence-work-queue-export-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/weighted-parent-task-entry-membership-review-and-evidence-work-queue-export-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'weighted-parent-task-entry-membership-evidence-disposition';
const reviewDomain = 'weighted-parent-task-entry-membership-review-queue';
const variantDomain = 'weighted-parent-task-entry-membership-variant-scope-evidence-work-queue';
const additionalDomain = 'weighted-parent-task-entry-membership-additional-evidence-work-queue';

async function latestInputSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name).sort().reverse();
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
      if (audit.dispositionCoverageComplete !== true || audit.weightedMembershipReviewComplete !== false
        || audit.completeActivityUniverse !== false || audit.publishable !== true
        || audit.dispositionCoverage?.dispositionCount < 1
        || audit.dispositionCoverage?.missingDispositionPacketKeys?.length !== 0
        || audit.dispositionCoverage?.unexpectedDispositionPacketKeys?.length !== 0) {
        reasons.push('weighted_membership_disposition_snapshot_not_publishable_or_complete');
      }
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) {
        reasons.push('unexpected_or_empty_input_contract_or_state');
      }
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid weighted parent-task membership evidence disposition snapshot exists.');
}

const input = await latestInputSnapshot();
const built = buildWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport({ dispositionRecords: input.rows, policy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'source_bound_weighted_parent_task_entry_membership_review_and_evidence_work_queue_export_without_decision_or_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    inputSnapshot,
    audit: built.audit
  };
  const reviewSnapshot = await writeSnapshot(root, reviewDomain, built.reviewRecords.map(record => ({ ...record, contentHash: hash(record) })), source);
  const variantSnapshot = await writeSnapshot(root, variantDomain, built.variantEvidenceRecords.map(record => ({ ...record, contentHash: hash(record) })), source);
  const additionalSnapshot = await writeSnapshot(root, additionalDomain, built.additionalEvidenceRecords.map(record => ({ ...record, contentHash: hash(record) })), source);
  const reviewMarkdownFile = path.join(reviewSnapshot.dir, 'review-queue.md');
  const decisionTemplateFile = path.join(reviewSnapshot.dir, 'decision-template.ndjson');
  const variantMarkdownFile = path.join(variantSnapshot.dir, 'variant-scope-evidence-work-queue.md');
  const additionalMarkdownFile = path.join(additionalSnapshot.dir, 'additional-evidence-work-queue.md');
  await fs.writeFile(reviewMarkdownFile, built.reviewMarkdown, 'utf8');
  await fs.writeFile(decisionTemplateFile, built.decisionTemplateNdjson, 'utf8');
  await fs.writeFile(variantMarkdownFile, built.variantEvidenceMarkdown, 'utf8');
  await fs.writeFile(additionalMarkdownFile, built.additionalEvidenceMarkdown, 'utf8');
  const generatedAt = new Date().toISOString();
  const report = {
    ...built.audit,
    generatedAt,
    policy: source.policy,
    inputSnapshot,
    reviewOutputSnapshot: { directory: path.basename(reviewSnapshot.dir), contentHash: reviewSnapshot.manifest.contentHash },
    variantEvidenceOutputSnapshot: { directory: path.basename(variantSnapshot.dir), contentHash: variantSnapshot.manifest.contentHash },
    additionalEvidenceOutputSnapshot: { directory: path.basename(additionalSnapshot.dir), contentHash: additionalSnapshot.manifest.contentHash },
    artifacts: {
      reviewMarkdown: { file: path.basename(reviewMarkdownFile), contentHash: hash(built.reviewMarkdown), bytes: Buffer.byteLength(built.reviewMarkdown, 'utf8') },
      decisionTemplate: { file: path.basename(decisionTemplateFile), contentHash: hash(built.decisionTemplateNdjson), bytes: Buffer.byteLength(built.decisionTemplateNdjson, 'utf8') },
      variantEvidenceMarkdown: { file: path.basename(variantMarkdownFile), contentHash: hash(built.variantEvidenceMarkdown), bytes: Buffer.byteLength(built.variantEvidenceMarkdown, 'utf8') },
      additionalEvidenceMarkdown: { file: path.basename(additionalMarkdownFile), contentHash: hash(built.additionalEvidenceMarkdown), bytes: Buffer.byteLength(built.additionalEvidenceMarkdown, 'utf8') }
    }
  };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const reportDirectory = path.join(root, 'weighted-parent-task-entry-membership-review-and-evidence-work-queue-export-audits', generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    contract: report.contract,
    accepted: true,
    inputSnapshot,
    reviewOutputSnapshot: report.reviewOutputSnapshot,
    variantEvidenceOutputSnapshot: report.variantEvidenceOutputSnapshot,
    additionalEvidenceOutputSnapshot: report.additionalEvidenceOutputSnapshot,
    artifacts: report.artifacts,
    coverage: {
      inputCoverage: report.inputCoverage,
      sourcePacketAndDispositionIntegrityCoverage: report.sourcePacketAndDispositionIntegrityCoverage,
      queuePartitionCoverage: report.queuePartitionCoverage,
      artifactCoverage: report.artifactCoverage,
      queueExportComplete: report.queueExportComplete,
      weightedMembershipReviewComplete: report.weightedMembershipReviewComplete,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers,
      publishable: report.publishable
    }
  }, null, 2));
}
