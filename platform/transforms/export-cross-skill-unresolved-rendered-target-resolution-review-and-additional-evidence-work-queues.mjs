import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport } from './cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queue-export-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queue-export-v1.json';
const sufficiencyPolicyFile = 'platform/policies/cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const sufficiencyPolicy = JSON.parse(await fs.readFile(path.resolve(sufficiencyPolicyFile), 'utf8'));
const dispositionDomain = 'cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition';
const evidenceDomain = 'cross-skill-unresolved-rendered-target-resolution-evidence';
const reviewDomain = 'cross-skill-unresolved-rendered-target-resolution-review-queue';
const additionalDomain = 'cross-skill-unresolved-rendered-target-resolution-additional-evidence-work-queue';

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

function baseReasons(snapshot, domain) {
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
      const reasons = baseReasons(snapshot, dispositionDomain);
      if (audit.dispositionCoverageComplete !== true || audit.resolutionReviewComplete !== false || audit.canonicalIdentityComplete !== false ||
          audit.completeActivityUniverse !== false || audit.publishable !== true || audit.semanticPreservationCoverage?.resolutionReviewCompletedCount !== 0 ||
          audit.semanticPreservationCoverage?.selectedResolutionCount !== 0 || audit.semanticPreservationCoverage?.optimizerEligibleCount !== 0) {
        reasons.push('disposition_snapshot_not_publishable_or_semantic_gates_not_closed');
      }
      if (!snapshot.rows.length || snapshot.rows.some(row => row.contract !== policy.inputDispositionContract ||
          !['pending_explicit_source_bound_resolution_review', 'pending_additional_source_bound_resolution_evidence'].includes(row.state))) {
        reasons.push('unexpected_or_empty_disposition_contract_or_state');
      }
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { ...snapshot, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid unresolved rendered-target resolution sufficiency-disposition snapshot exists.');
}

async function evidenceSnapshotByHash(expectedHash) {
  const rejections = [];
  for (const directory of await timestampDirectories()) {
    try {
      const snapshot = await readSnapshot(directory, evidenceDomain);
      if (snapshot.manifest.contentHash !== expectedHash) continue;
      const audit = snapshot.manifest.source?.audit || {};
      const reasons = baseReasons(snapshot, evidenceDomain);
      if (audit.resolutionEvidenceCoverageComplete !== true || audit.canonicalIdentityComplete !== false || audit.completeActivityUniverse !== false ||
          audit.publishable !== true || audit.semanticPromotionCoverage?.resolutionDispositionCount !== 0 ||
          audit.semanticPromotionCoverage?.canonicalGameEntityIdentityCount !== 0 || audit.semanticPromotionCoverage?.optimizerEligibleCount !== 0) {
        reasons.push('evidence_snapshot_not_publishable_or_semantic_gates_not_closed');
      }
      if (!snapshot.rows.length || snapshot.rows.some(row => row.contract !== policy.inputEvidenceContract || row.state !== 'resolution_evidence_captured_review_pending')) {
        reasons.push('unexpected_or_empty_evidence_contract_or_state');
      }
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { ...snapshot, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error(`No valid unresolved rendered-target resolution-evidence snapshot matches ${expectedHash}.`);
}

const dispositionInput = await latestDispositionSnapshot();
const evidenceHashes = [...new Set(dispositionInput.rows.map(row => row.sourceEvidenceSnapshotContentHash))];
if (evidenceHashes.length !== 1) throw new Error('Disposition snapshot does not bind exactly one source-evidence snapshot.');
const evidenceInput = await evidenceSnapshotByHash(evidenceHashes[0]);
const dispositionSnapshot = { directory: dispositionInput.directory, contentHash: dispositionInput.manifest.contentHash, rejections: dispositionInput.rejections };
const evidenceSnapshot = { directory: evidenceInput.directory, contentHash: evidenceInput.manifest.contentHash, rejections: evidenceInput.rejections };
const built = buildUnresolvedRenderedTargetResolutionReviewAndAdditionalEvidenceWorkQueueExport({
  dispositionRecords: dispositionInput.rows,
  evidenceRecords: evidenceInput.rows,
  policy,
  sufficiencyPolicy,
  dispositionSnapshotContentHash: dispositionInput.manifest.contentHash,
  evidenceSnapshotContentHash: evidenceInput.manifest.contentHash,
  contentHash: hash
});

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, dispositionSnapshot, evidenceSnapshot, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'deterministic_disjoint_unresolved_rendered_target_resolution_review_and_additional_evidence_queue_export_without_resolution_or_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    sufficiencyPolicy: { id: sufficiencyPolicy.policy, file: sufficiencyPolicyFile, contentHash: hash(sufficiencyPolicy) },
    dispositionSnapshot,
    evidenceSnapshot,
    audit: built.audit
  };
  const reviewSnapshot = await writeSnapshot(root, reviewDomain, built.reviewRecords.map(record => ({ ...record, contentHash: hash(record) })), source);
  while (new Date().toISOString() === reviewSnapshot.manifest.createdAt) await new Promise(resolve => setTimeout(resolve, 1));
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
    sufficiencyPolicy: source.sufficiencyPolicy,
    dispositionSnapshot,
    evidenceSnapshot,
    reviewOutputSnapshot: { directory: path.basename(reviewSnapshot.dir), contentHash: reviewSnapshot.manifest.contentHash },
    additionalEvidenceOutputSnapshot: { directory: path.basename(additionalSnapshot.dir), contentHash: additionalSnapshot.manifest.contentHash },
    artifacts: {
      reviewMarkdown: { file: path.basename(reviewMarkdownFile), contentHash: hash(built.reviewMarkdown), bytes: Buffer.byteLength(built.reviewMarkdown, 'utf8') },
      decisionTemplate: { file: path.basename(decisionTemplateFile), contentHash: hash(built.decisionTemplateNdjson), bytes: Buffer.byteLength(built.decisionTemplateNdjson, 'utf8') },
      additionalEvidenceMarkdown: { file: path.basename(additionalMarkdownFile), contentHash: hash(built.additionalEvidenceMarkdown), bytes: Buffer.byteLength(built.additionalEvidenceMarkdown, 'utf8') }
    }
  };
  report.contentHash = hash(withoutContentHash(report));
  const reportDirectory = path.join(root, 'cross-skill-unresolved-rendered-target-resolution-review-and-additional-evidence-work-queue-export-audits', generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    contract: report.contract,
    accepted: true,
    dispositionSnapshot,
    evidenceSnapshot,
    reviewOutputSnapshot: report.reviewOutputSnapshot,
    additionalEvidenceOutputSnapshot: report.additionalEvidenceOutputSnapshot,
    artifacts: report.artifacts,
    coverage: report
  }, null, 2));
}

function withoutContentHash(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'contentHash'));
}
