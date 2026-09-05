import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport } from './multi-variant-binding-canonical-subject-scope-review-decision-import-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const decisionFileArgument = argument('decisions');
if (!decisionFileArgument) throw new Error('Required: --decisions=<reviewed-decision-template.ndjson>. No decision file is selected automatically.');
const decisionFile = path.resolve(decisionFileArgument);
const policyFile = 'platform/policies/multi-variant-binding-canonical-subject-scope-review-decision-import-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'multi-variant-binding-canonical-subject-scope-review-queue';
const outputDomain = 'multi-variant-binding-canonical-subject-scope-review-decisions';

async function latestQueueSnapshot() {
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
      if (audit.queueExportComplete !== true || audit.canonicalSubjectScopeReviewComplete !== false
        || audit.variantBindingReviewComplete !== false || audit.optimizerEligibleCount !== 0
        || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('canonical_subject_scope_review_queue_not_publishable_or_gates_not_closed');
      if (!rows.length || rows.some(row => row.contract !== policy.queueContract || row.state !== policy.queueState)) reasons.push('unexpected_or_empty_queue_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid canonical-subject scope review queue snapshot exists.');
}

const queue = await latestQueueSnapshot();
const submissionRaw = await fs.readFile(decisionFile, 'utf8');
const submissions = submissionRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const built = buildMultiVariantBindingCanonicalSubjectScopeReviewDecisionImport({
  queueRecords: queue.rows,
  submissions,
  policy,
  queueSnapshotContentHash: queue.manifest.contentHash,
  contentHash: hash
});
const inputSnapshot = { directory: queue.directory, contentHash: queue.manifest.contentHash, rejections: queue.rejections };
const submission = { file: decisionFile, contentHash: hash(submissionRaw), rows: submissions.length };

if (!built.audit.publishable) {
  console.log(JSON.stringify({
    contract: built.audit.contract,
    accepted: false,
    inputSnapshot,
    submission,
    audit: built.audit,
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'explicit_human_source_bound_canonical_subject_scope_review_decision_recording_without_semantic_disposition_or_numbered_variant_binding',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    inputSnapshot,
    submission,
    audit: built.audit
  };
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = {
    ...built.audit,
    generatedAt,
    policy: source.policy,
    inputSnapshot,
    submission,
    outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
  };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    contract: report.contract,
    accepted: true,
    inputSnapshot,
    submission,
    outputSnapshot: report.outputSnapshot,
    coverage: {
      queueCoverage: report.queueCoverage,
      submissionCoverage: report.submissionCoverage,
      bindingCoverage: report.bindingCoverage,
      recordCoverage: report.recordCoverage,
      semanticPreservationCoverage: report.semanticPreservationCoverage,
      reviewDecisionRecordingComplete: report.reviewDecisionRecordingComplete,
      canonicalSubjectScopeReviewComplete: report.canonicalSubjectScopeReviewComplete,
      variantBindingReviewComplete: report.variantBindingReviewComplete,
      optimizerEligibleCount: report.optimizerEligibleCount,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers,
      publishable: report.publishable
    }
  }, null, 2));
}
