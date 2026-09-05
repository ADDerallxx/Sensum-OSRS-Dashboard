import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildCrossSkillUntypedPageSourceBoundReviewQueueExport } from './cross-skill-untyped-page-source-bound-review-queue-export-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/cross-skill-untyped-page-source-bound-review-queue-export-v1.json';
const pageTypePolicyFile = 'platform/policies/unlock-linked-page-entity-type-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const pageTypePolicy = JSON.parse(await fs.readFile(path.resolve(pageTypePolicyFile), 'utf8'));
const dispositionDomain = 'cross-skill-untyped-page-source-evidence-sufficiency-disposition';
const evidenceDomain = 'cross-skill-untyped-page-source-evidence';
const outputDomain = 'cross-skill-untyped-page-source-bound-review-queue';

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
      if (audit.dispositionCoverageComplete !== true || audit.pageTypeReviewComplete !== false ||
          audit.canonicalIdentityComplete !== false || audit.repeatabilityAndMechanicsComplete !== false ||
          audit.completeActivityUniverse !== false || audit.publishable !== true ||
          audit.semanticPreservationCoverage?.pageTypeReviewedCount !== 0 ||
          audit.semanticPreservationCoverage?.optimizerEligibleCount !== 0) {
        reasons.push('disposition_snapshot_not_publishable_or_semantic_gates_not_closed');
      }
      if (!snapshot.rows.length || snapshot.rows.some(row => row.contract !== policy.inputContract || row.state !== 'review_routed')) {
        reasons.push('unexpected_or_empty_disposition_contract_or_state');
      }
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { ...snapshot, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid cross-skill untyped-page sufficiency-disposition snapshot exists.');
}

async function evidenceSnapshotByHash(expectedHash) {
  const rejections = [];
  for (const directory of await timestampDirectories()) {
    try {
      const snapshot = await readSnapshot(directory, evidenceDomain);
      if (snapshot.manifest.contentHash !== expectedHash) continue;
      const audit = snapshot.manifest.source?.audit || {};
      const reasons = baseReasons(snapshot, evidenceDomain);
      if (audit.sourceEvidenceCoverageComplete !== true || audit.pageTypeReviewComplete !== false ||
          audit.canonicalIdentityComplete !== false || audit.repeatabilityAndMechanicsComplete !== false ||
          audit.completeActivityUniverse !== false || audit.publishable !== true ||
          audit.semanticPromotionCoverage?.pageTypeReviewedCount !== 0 ||
          audit.semanticPromotionCoverage?.optimizerEligibleCount !== 0) {
        reasons.push('evidence_snapshot_not_publishable_or_semantic_gates_not_closed');
      }
      if (!snapshot.rows.length || snapshot.rows.some(row => row.contract !== policy.evidenceContract || row.state !== 'review_ready')) {
        reasons.push('unexpected_or_empty_evidence_contract_or_state');
      }
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { ...snapshot, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error(`No valid cross-skill untyped-page source-evidence snapshot matches ${expectedHash}.`);
}

const dispositionInput = await latestDispositionSnapshot();
const evidenceHashes = unique(dispositionInput.rows.map(row => row.sourceEvidenceSnapshotContentHash));
if (evidenceHashes.length !== 1) throw new Error('Disposition snapshot does not bind exactly one source-evidence snapshot.');
const evidenceInput = await evidenceSnapshotByHash(evidenceHashes[0]);
const dispositionSnapshot = { directory: dispositionInput.directory, contentHash: dispositionInput.manifest.contentHash, rejections: dispositionInput.rejections };
const evidenceSnapshot = { directory: evidenceInput.directory, contentHash: evidenceInput.manifest.contentHash, rejections: evidenceInput.rejections };
const built = buildCrossSkillUntypedPageSourceBoundReviewQueueExport({
  dispositionRecords: dispositionInput.rows,
  evidenceRecords: evidenceInput.rows,
  policy,
  pageTypePolicy,
  dispositionSnapshotContentHash: dispositionInput.manifest.contentHash,
  evidenceSnapshotContentHash: evidenceInput.manifest.contentHash,
  contentHash: hash
});

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, dispositionSnapshot, evidenceSnapshot, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'deterministic_source_bound_untyped_page_review_queue_export_without_review_or_semantic_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    pageTypePolicy: { id: pageTypePolicy.policy, file: pageTypePolicyFile, contentHash: hash(pageTypePolicy) },
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
    pageTypePolicy: source.pageTypePolicy,
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
    accepted: true,
    dispositionSnapshot,
    evidenceSnapshot,
    outputSnapshot: report.outputSnapshot,
    artifacts: report.artifacts,
    coverage: report
  }, null, 2));
}

function unique(values) {
  return [...new Set(values)];
}
