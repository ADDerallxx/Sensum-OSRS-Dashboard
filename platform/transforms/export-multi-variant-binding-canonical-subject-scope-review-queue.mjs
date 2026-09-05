import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport } from './multi-variant-binding-canonical-subject-scope-review-queue-export-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/multi-variant-binding-canonical-subject-scope-review-queue-export-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const dispositionDomain = 'multi-variant-binding-additional-evidence-sufficiency-disposition';
const evidenceDomain = 'multi-variant-binding-additional-evidence-source-discovery';
const outputDomain = 'multi-variant-binding-canonical-subject-scope-review-queue';

async function timestampDirectories() {
  return (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name).sort().reverse();
}

async function readSnapshot(directory, domain) {
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  return { directory, raw, rows, manifest };
}

function baseSnapshotReasons(snapshot, domain) {
  const reasons = [];
  if (snapshot.manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
  if (snapshot.manifest.records !== snapshot.rows.length) reasons.push('record_count_mismatch');
  if (snapshot.manifest.contentHash !== hash(snapshot.raw)) reasons.push('content_hash_mismatch');
  return reasons;
}

async function latestDispositionSnapshot() {
  const rejections = [];
  for (const directory of await timestampDirectories()) {
    try {
      const snapshot = await readSnapshot(directory, dispositionDomain);
      const audit = snapshot.manifest.source?.audit || {};
      const reasons = baseSnapshotReasons(snapshot, dispositionDomain);
      if (audit.dispositionCoverageComplete !== true || audit.variantBindingReviewComplete !== false
        || audit.optimizerEligibleCount !== 0 || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('disposition_snapshot_not_publishable_or_gates_not_closed');
      if (!snapshot.rows.length || snapshot.rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { ...snapshot, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid multi-variant binding additional-evidence sufficiency-disposition snapshot exists.');
}

async function evidenceSnapshotByHash(expectedHash) {
  const rejections = [];
  for (const directory of await timestampDirectories()) {
    try {
      const snapshot = await readSnapshot(directory, evidenceDomain);
      if (snapshot.manifest.contentHash !== expectedHash) continue;
      const audit = snapshot.manifest.source?.audit || {};
      const reasons = baseSnapshotReasons(snapshot, evidenceDomain);
      if (audit.evidencePacketAttemptCoverageComplete !== true || audit.variantBindingReviewComplete !== false
        || audit.optimizerEligibleCount !== 0 || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('evidence_snapshot_not_publishable_or_gates_not_closed');
      if (!snapshot.rows.length || snapshot.rows.some(row => row.contract !== policy.evidencePacketContract || row.state !== policy.evidencePacketState)) reasons.push('unexpected_or_empty_evidence_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { ...snapshot, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error(`No valid source-discovery evidence snapshot matches ${expectedHash}.`);
}

const dispositionInput = await latestDispositionSnapshot();
const evidenceHashes = [...new Set(dispositionInput.rows.map(row => row.sourceEvidencePacketSnapshotContentHash))];
if (evidenceHashes.length !== 1) throw new Error('Disposition snapshot does not bind exactly one source-discovery evidence snapshot.');
const evidenceInput = await evidenceSnapshotByHash(evidenceHashes[0]);
const built = buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport({
  dispositionRecords: dispositionInput.rows,
  evidencePackets: evidenceInput.rows,
  policy,
  dispositionSnapshotContentHash: dispositionInput.manifest.contentHash,
  evidenceSnapshotContentHash: evidenceInput.manifest.contentHash,
  contentHash: hash
});
const dispositionSnapshot = { directory: dispositionInput.directory, contentHash: dispositionInput.manifest.contentHash, rejections: dispositionInput.rejections };
const evidenceSnapshot = { directory: evidenceInput.directory, contentHash: evidenceInput.manifest.contentHash, rejections: evidenceInput.rejections };
const source = {
  kind: 'deterministic_source_bound_canonical_subject_scope_review_queue_export_without_numbered_variant_selection_review_decision_or_semantic_promotion',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  dispositionSnapshot,
  evidenceSnapshot,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const reviewMarkdownFile = path.join(snapshot.dir, 'review-queue.md');
const decisionTemplateFile = path.join(snapshot.dir, 'decision-template.ndjson');
await fs.writeFile(reviewMarkdownFile, built.reviewMarkdown, 'utf8');
await fs.writeFile(decisionTemplateFile, built.decisionTemplateNdjson, 'utf8');
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  dispositionSnapshot,
  evidenceSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash },
  artifacts: {
    reviewMarkdown: { file: path.basename(reviewMarkdownFile), contentHash: hash(built.reviewMarkdown), bytes: Buffer.byteLength(built.reviewMarkdown, 'utf8') },
    decisionTemplate: { file: path.basename(decisionTemplateFile), contentHash: hash(built.decisionTemplateNdjson), bytes: Buffer.byteLength(built.decisionTemplateNdjson, 'utf8') }
  }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDirectory = path.join(root, `${outputDomain}-export-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDirectory, { recursive: true });
await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  dispositionSnapshot,
  evidenceSnapshot,
  outputSnapshot: report.outputSnapshot,
  artifacts: report.artifacts,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    sourceIntegrityCoverage: report.sourceIntegrityCoverage,
    queueCoverage: report.queueCoverage,
    artifactCoverage: report.artifactCoverage,
    semanticPreservationCoverage: report.semanticPreservationCoverage,
    queueExportComplete: report.queueExportComplete,
    canonicalSubjectScopeReviewComplete: report.canonicalSubjectScopeReviewComplete,
    variantBindingReviewComplete: report.variantBindingReviewComplete,
    optimizerEligibleCount: report.optimizerEligibleCount,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
