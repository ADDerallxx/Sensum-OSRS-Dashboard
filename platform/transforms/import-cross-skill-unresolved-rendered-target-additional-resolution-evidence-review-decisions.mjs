import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport } from './cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-import-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-import-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const queueDomain = 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue';
const outputDomain = 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decisions';

async function timestampDirectories() {
  return (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
}

async function latestQueueSnapshot() {
  const rejections = [];
  for (const directory of await timestampDirectories()) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${queueDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const audit = manifest.source?.audit || {};
      const queue = audit.queueCoverage || {};
      const artifact = audit.artifactCoverage || {};
      const semantic = audit.semanticPreservationCoverage || {};
      const reasons = [];
      if (manifest.domain !== queueDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (audit.queueExportComplete !== true || audit.categoryResolutionReviewComplete !== false || audit.resolutionApplicationComplete !== false || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('category_review_queue_snapshot_not_publishable_or_gates_not_closed');
      if (queue.reviewQueueEntryCount !== rows.length || queue.blankDecisionTemplateCount !== rows.length || queue.missingOutputKeys?.length || queue.unexpectedOutputKeys?.length || queue.duplicateOutputKeys?.length || queue.recordMismatches?.length || queue.templateMismatches?.length) reasons.push('category_review_queue_coverage_not_exact_or_complete');
      if (artifact.decisionTemplateNdjsonMatches !== true || semantic.recordedReviewCount !== 0 || semantic.selectedResolutionCount !== 0 || semantic.canonicalGameEntityIdentityCount !== 0 || semantic.canonicalActivityIdentityCount !== 0 || semantic.repeatabilityClassifiedCount !== 0 || semantic.mechanicsReviewCompleteCount !== 0 || semantic.optimizerEligibleCount !== 0 || semantic.automaticVerificationCount !== 0) reasons.push('review_queue_artifact_or_semantic_gates_invalid');
      if (!rows.length || rows.some(row => row.contract !== policy.queueContract || row.state !== policy.queueState)) reasons.push('unexpected_or_empty_queue_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid unresolved rendered-target category-resolution review queue snapshot exists.');
}

const queue = await latestQueueSnapshot();
const decisionFile = path.resolve(argument('decisions') || path.join(root, queue.directory, 'decision-template.ndjson'));
const submissionRaw = await fs.readFile(decisionFile, 'utf8');
const submissions = submissionRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionImport({ queueRecords: queue.rows, submissions, policy, queueSnapshotContentHash: queue.manifest.contentHash, contentHash: hash });
const inputSnapshot = { directory: queue.directory, contentHash: queue.manifest.contentHash, rejections: queue.rejections };
const submission = { file: decisionFile, contentHash: hash(submissionRaw), rows: submissions.length };

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, submission, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'explicit_human_source_bound_category_target_resolution_review_decision_recording_without_resolution_or_semantic_application',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) }, inputSnapshot, submission, audit: built.audit
  };
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = { ...built.audit, generatedAt, policy: source.policy, inputSnapshot, submission, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
  report.contentHash = hash(withoutHash(report));
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputSnapshot, submission, outputSnapshot: report.outputSnapshot, coverage: report }, null, 2));
}

function withoutHash(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'contentHash'));
}
