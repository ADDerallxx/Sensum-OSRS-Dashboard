import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport } from './cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const decisionFileArgument = argument('decisions');
if (!decisionFileArgument) throw new Error('Required: --decisions=<reviewed-decision-template.ndjson>. No decision file is selected automatically.');
const decisionFile = path.resolve(decisionFileArgument);
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-v1.json';
const queuePolicyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const queuePolicy = JSON.parse(await fs.readFile(path.resolve(queuePolicyFile), 'utf8'));
const inputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decisions';

async function latestQueueSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
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
      if (manifest.contract !== 'sensum.ingestion-manifest.v1' || manifest.domain !== inputDomain) reasons.push('manifest_contract_or_domain_mismatch');
      if (manifest.records !== rows.length || manifest.contentHash !== hash(raw)) reasons.push('record_count_or_content_hash_mismatch');
      if (manifest.source?.policy?.id !== policy.inputQueuePolicy || manifest.source?.policy?.contentHash !== policy.inputQueuePolicyContentHash ||
          hash(queuePolicy) !== policy.inputQueuePolicyContentHash) reasons.push('queue_policy_binding_mismatch');
      if (audit.queueExportComplete !== true || audit.semanticRelevanceReviewComplete !== false || audit.reconciliationComplete !== false ||
          audit.completeActivityUniverse !== false || audit.publishable !== true || semantic.semanticDispositionCount !== 0 ||
          semantic.canonicalGameEntityIdentityCount !== 0 || semantic.canonicalActivityIdentityCount !== 0 ||
          semantic.repeatabilityClassifiedCount !== 0 || semantic.mechanicsReviewCompleteCount !== 0 ||
          semantic.optimizerEligibleCount !== 0 || semantic.automaticVerificationCount !== 0 || semantic.decidedTemplateCount !== 0) {
        reasons.push('review_queue_snapshot_not_publishable_or_semantic_gates_not_closed');
      }
      if (queue.reviewQueueEntryCount !== rows.length || queue.blankDecisionTemplateCount !== rows.length ||
          queue.duplicateOutputKeys?.length || queue.missingOutputKeys?.length || queue.unexpectedOutputKeys?.length ||
          queue.mismatchKeys?.length || queue.priorityOrderMatches !== true) reasons.push('review_queue_coverage_not_exact_or_complete');
      if (!rows.length || rows.some(row => row.contract !== policy.queueContract || row.state !== policy.queueState)) reasons.push('unexpected_or_empty_queue_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid rendered-page/no-unlock source-scoped semantic-relevance review queue snapshot exists.');
}

const queue = await latestQueueSnapshot();
const submissionRaw = await fs.readFile(decisionFile, 'utf8');
const submissions = submissionRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const built = buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport({ queueRecords: queue.rows, submissions, policy, queuePolicy, queueSnapshotContentHash: queue.manifest.contentHash, contentHash: hash });
const inputSnapshot = { directory: queue.directory, contentHash: queue.manifest.contentHash, rejections: queue.rejections };
const submission = { file: decisionFile, contentHash: hash(submissionRaw), rows: submissions.length };

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, submission, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'explicit_human_source_scoped_semantic_relevance_review_decision_recording_without_semantic_application',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    inputQueuePolicy: { id: queuePolicy.policy, file: queuePolicyFile, contentHash: hash(queuePolicy) },
    inputSnapshot, submission, audit: built.audit
  };
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = { ...built.audit, generatedAt, policy: source.policy, inputQueuePolicy: source.inputQueuePolicy, inputSnapshot, submission, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputSnapshot, submission, outputSnapshot: report.outputSnapshot, coverage: report }, null, 2));
}
