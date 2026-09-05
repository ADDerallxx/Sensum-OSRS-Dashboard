import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport } from './cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-export-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-export-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const dispositionDomain = 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition';
const evidenceDomain = 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery';
const outputDomain = 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue';

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
      const semantic = audit.semanticPreservationCoverage || {};
      const reasons = baseReasons(snapshot, dispositionDomain);
      if (audit.dispositionCoverageComplete !== true || audit.resolutionReviewComplete !== false || audit.canonicalIdentityComplete !== false
        || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('disposition_snapshot_not_publishable_or_gates_not_closed');
      if ([semantic.resolutionReviewCompletedCount, semantic.selectedResolutionCount, semantic.canonicalGameEntityIdentityCount,
        semantic.canonicalActivityIdentityCount, semantic.repeatabilityClassifiedCount, semantic.mechanicsReviewCompleteCount,
        semantic.optimizerEligibleCount, semantic.automaticVerificationCount].some(value => value !== 0)) reasons.push('disposition_snapshot_contains_review_resolution_or_semantic_promotion');
      if (!snapshot.rows.length || snapshot.rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState
        || !policy.eligibleClassifications.includes(row.classification) || !policy.eligibleReviewRoutes.includes(row.reviewRoute))) {
        reasons.push('unexpected_empty_or_nonreview_ready_input_contract_state_or_route');
      }
      if (snapshot.rows.some(row => !row.contentHash || hash(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'contentHash'))) !== row.contentHash)) reasons.push('input_disposition_record_hash_failure');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { ...snapshot, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error(`No valid ${dispositionDomain} snapshot exists.`);
}

async function evidenceSnapshotByHash(expectedHash) {
  const rejections = [];
  for (const directory of await timestampDirectories()) {
    try {
      const snapshot = await readSnapshot(directory, evidenceDomain);
      if (snapshot.manifest.contentHash !== expectedHash) continue;
      const audit = snapshot.manifest.source?.audit || {};
      const semantic = audit.semanticPreservationCoverage || {};
      const reasons = baseReasons(snapshot, evidenceDomain);
      if (audit.evidencePacketCaptureComplete !== true || audit.resolutionEvidenceSufficiencyDispositionComplete !== false
        || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('evidence_snapshot_not_publishable_or_gates_not_closed');
      if ([semantic.selectedResolutionCount, semantic.recordedReviewCount, semantic.canonicalGameEntityIdentityCount,
        semantic.canonicalActivityIdentityCount, semantic.repeatabilityClassifiedCount, semantic.mechanicsReviewCompleteCount,
        semantic.optimizerEligibleCount, semantic.automaticVerificationCount].some(value => value !== 0)) reasons.push('evidence_snapshot_contains_review_resolution_or_semantic_promotion');
      if (!snapshot.rows.length || snapshot.rows.some(row => row.contract !== policy.evidencePacketContract || row.state !== policy.evidencePacketState)) reasons.push('unexpected_or_empty_evidence_contract_or_state');
      if (snapshot.rows.some(row => !row.contentHash || hash(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'contentHash'))) !== row.contentHash)) reasons.push('input_evidence_record_hash_failure');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { ...snapshot, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error(`No valid ${evidenceDomain} snapshot matches ${expectedHash}.`);
}

const dispositionInput = await latestDispositionSnapshot();
const evidenceHashes = [...new Set(dispositionInput.rows.map(row => row.sourceEvidencePacketSnapshotContentHash))];
if (evidenceHashes.length !== 1) throw new Error('Disposition snapshot does not bind exactly one source-discovery evidence snapshot.');
const evidenceInput = await evidenceSnapshotByHash(evidenceHashes[0]);
const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport({
  dispositionRecords: dispositionInput.rows,
  evidencePackets: evidenceInput.rows,
  policy,
  dispositionSnapshotContentHash: dispositionInput.manifest.contentHash,
  evidenceSnapshotContentHash: evidenceInput.manifest.contentHash,
  contentHash: hash
});
const dispositionSnapshot = { directory: dispositionInput.directory, contentHash: dispositionInput.manifest.contentHash, rejections: dispositionInput.rejections };
const evidenceSnapshot = { directory: evidenceInput.directory, contentHash: evidenceInput.manifest.contentHash, rejections: evidenceInput.rejections };

if (!built.audit.publishable) {
  console.error(JSON.stringify({ contract: built.audit.contract, accepted: false, dispositionSnapshot, evidenceSnapshot, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'deterministic_source_bound_category_target_resolution_review_queue_export_without_review_resolution_identity_or_optimizer_promotion',
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
      reviewMarkdown: { file: path.basename(reviewMarkdownFile), contentHash: hash(built.reviewMarkdown), bytes: new TextEncoder().encode(built.reviewMarkdown).length },
      decisionTemplate: { file: path.basename(decisionTemplateFile), contentHash: hash(built.decisionTemplateNdjson), bytes: new TextEncoder().encode(built.decisionTemplateNdjson).length }
    }
  };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const reportDirectory = path.join(root, `${outputDomain}-export-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    contract: report.contract,
    accepted: true,
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
      categoryResolutionReviewComplete: report.categoryResolutionReviewComplete,
      resolutionApplicationComplete: report.resolutionApplicationComplete,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers,
      publishable: report.publishable
    }
  }, null, 2));
}
