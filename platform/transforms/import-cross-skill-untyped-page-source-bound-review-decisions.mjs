import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildCrossSkillUntypedPageReviewDecisionImport } from './cross-skill-untyped-page-source-bound-review-decision-import-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const decisionFileArgument = argument('decisions');
if (!decisionFileArgument) throw new Error('Required: --decisions=<reviewed-decision-template.ndjson>. No decision file is selected automatically.');
const decisionFile = path.resolve(decisionFileArgument);
const policyFile = 'platform/policies/cross-skill-untyped-page-source-bound-review-decision-import-v1.json';
const pageTypePolicyFile = 'platform/policies/unlock-linked-page-entity-type-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const pageTypePolicy = JSON.parse(await fs.readFile(path.resolve(pageTypePolicyFile), 'utf8'));
const inputDomain = 'cross-skill-untyped-page-source-bound-review-queue';
const outputDomain = 'cross-skill-untyped-page-source-bound-review-decisions';

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
      const queue = audit.queueCoverage || {};
      const semantic = audit.semanticPreservationCoverage || {};
      const reasons = [];
      if (manifest.domain !== inputDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (audit.queueExportComplete !== true || audit.pageTypeReviewComplete !== false || audit.completeActivityUniverse !== false || audit.publishable !== true ||
          semantic.recordedReviewCount !== 0 || semantic.reviewedPageTypeCount !== 0 || semantic.canonicalGameEntityIdentityCount !== 0 ||
          semantic.canonicalActivityIdentityCount !== 0 || semantic.repeatabilityClassifiedCount !== 0 || semantic.optimizerEligibleCount !== 0 || semantic.decidedTemplateCount !== 0) {
        reasons.push('review_queue_snapshot_not_publishable_or_semantic_gates_not_closed');
      }
      if (queue.reviewQueueEntryCount !== rows.length || queue.blankDecisionTemplateCount !== rows.length ||
          queue.duplicateOutputCandidateKeys?.length || queue.missingOutputCandidateKeys?.length ||
          queue.unexpectedOutputCandidateKeys?.length || queue.recordMismatchCandidateKeys?.length || queue.orderMatchesDispositionOrder !== true) {
        reasons.push('review_queue_coverage_not_exact_or_complete');
      }
      if (!rows.length || rows.some(row => row.contract !== policy.queueContract || row.state !== policy.queueState)) {
        reasons.push('unexpected_or_empty_queue_contract_or_state');
      }
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid cross-skill untyped-page source-bound review queue snapshot exists.');
}

const queue = await latestQueueSnapshot();
const submissionRaw = await fs.readFile(decisionFile, 'utf8');
const submissions = submissionRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const built = buildCrossSkillUntypedPageReviewDecisionImport({
  queueRecords: queue.rows,
  submissions,
  policy,
  pageTypePolicy,
  queueSnapshotContentHash: queue.manifest.contentHash,
  contentHash: hash
});
const inputSnapshot = { directory: queue.directory, contentHash: queue.manifest.contentHash, rejections: queue.rejections };
const submission = { file: decisionFile, contentHash: hash(submissionRaw), rows: submissions.length };

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, submission, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'explicit_human_source_bound_untyped_page_review_decision_recording_without_semantic_application',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    pageTypePolicy: { id: pageTypePolicy.policy, file: pageTypePolicyFile, contentHash: hash(pageTypePolicy) },
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
    pageTypePolicy: source.pageTypePolicy,
    inputSnapshot,
    submission,
    outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
  };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputSnapshot, submission, outputSnapshot: report.outputSnapshot, coverage: report }, null, 2));
}
