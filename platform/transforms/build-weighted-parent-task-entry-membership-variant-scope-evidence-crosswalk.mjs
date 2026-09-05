import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildWeightedMembershipVariantScopeEvidenceCrosswalk } from './weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));

async function latestSnapshot(domain, gate) {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      reasons.push(...gate(manifest, rows));
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error(`No valid ${domain} snapshot exists.`);
}

const [inputQueue, exactReviews, singleVariantReviews, canonicalReviews] = await Promise.all([
  latestSnapshot('weighted-parent-task-entry-membership-variant-scope-evidence-work-queue', (manifest, rows) => {
    const audit = manifest.source?.audit || {};
    const partition = audit.queuePartitionCoverage || {};
    return audit.queueExportComplete === true && audit.weightedMembershipReviewComplete === false && audit.optimizerEligibleCount === 0
      && audit.completeActivityUniverse === false && audit.publishable === true && partition.variantScopeEvidenceQueueEntryCount === rows.length
      && partition.totalQueueEntryCount === Number(partition.reviewQueueEntryCount) + Number(partition.variantScopeEvidenceQueueEntryCount) + Number(partition.additionalMembershipEvidenceQueueEntryCount)
      && !partition.missingDispositionKeys?.length && !partition.unexpectedDispositionKeys?.length && !partition.duplicateQueueDispositionKeys?.length && !partition.crossQueueKeys?.length
      ? [] : ['weighted_membership_variant_scope_queue_not_complete_or_gates_not_closed'];
  }),
  latestSnapshot('multi-variant-binding-review-queue', (manifest, rows) => {
    const audit = manifest.source?.audit || {};
    const partition = audit.queuePartitionCoverage || {};
    return audit.queueExportComplete === true && audit.variantBindingReviewComplete === false && audit.optimizerEligibleCount === 0
      && audit.completeActivityUniverse === false && audit.publishable === true && partition.reviewQueueEntryCount === rows.length
      && partition.unionCount === Number(partition.reviewQueueEntryCount) + Number(partition.additionalEvidenceQueueEntryCount)
      && !partition.crossQueueKeys?.length && !partition.missingOutputKeys?.length && !partition.unexpectedOutputKeys?.length
      ? [] : ['exact_variant_review_queue_not_complete_or_gates_not_closed'];
  }),
  latestSnapshot('structural-member-candidate-identity-review-queue', (manifest, rows) => {
    const audit = manifest.source?.audit || {};
    const coverage = audit.queueCoverage || {};
    return audit.reviewQueueExportComplete === true && audit.identityReviewComplete === false && audit.optimizerEligibleCount === 0
      && audit.completeActivityUniverse === false && audit.publishable === true && coverage.queueEntryCount === rows.length
      && coverage.blankDecisionTemplateCount === rows.length && coverage.queueOrderValid === true
      && !coverage.recordMismatches?.length && !coverage.templateMismatches?.length
      ? [] : ['single_variant_identity_review_queue_not_complete_or_gates_not_closed'];
  }),
  latestSnapshot('multi-variant-binding-canonical-subject-scope-review-queue', (manifest, rows) => {
    const audit = manifest.source?.audit || {};
    const coverage = audit.queueCoverage || {};
    return audit.queueExportComplete === true && audit.canonicalSubjectScopeReviewComplete === false && audit.variantBindingReviewComplete === false
      && audit.optimizerEligibleCount === 0 && audit.completeActivityUniverse === false && audit.publishable === true
      && coverage.reviewQueueEntryCount === rows.length && coverage.exactNumberedVariantReviewEntriesAllowed === 0
      && !coverage.missingOutputKeys?.length && !coverage.unexpectedOutputKeys?.length && !coverage.duplicateOutputKeys?.length
      ? [] : ['canonical_subject_review_queue_not_complete_or_gates_not_closed'];
  })
]);

const built = buildWeightedMembershipVariantScopeEvidenceCrosswalk({ inputRecords: inputQueue.rows, exactReviewRecords: exactReviews.rows, singleVariantReviewRecords: singleVariantReviews.rows, canonicalReviewRecords: canonicalReviews.rows, policy });
const inputSnapshots = {
  variantScopeQueue: { directory: inputQueue.directory, contentHash: inputQueue.manifest.contentHash, rejections: inputQueue.rejections },
  exactVariantReviewQueue: { directory: exactReviews.directory, contentHash: exactReviews.manifest.contentHash, rejections: exactReviews.rejections },
  singleVariantIdentityReviewQueue: { directory: singleVariantReviews.directory, contentHash: singleVariantReviews.manifest.contentHash, rejections: singleVariantReviews.rejections },
  canonicalSubjectReviewQueue: { directory: canonicalReviews.directory, contentHash: canonicalReviews.manifest.contentHash, rejections: canonicalReviews.rejections }
};
if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshots, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = { kind: 'exact_structural_candidate_key_crosswalk_to_existing_variant_scope_evidence_without_review_or_semantic_promotion', policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) }, inputSnapshots, audit: built.audit };
  const snapshot = await writeSnapshot(root, 'weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = { ...built.audit, generatedAt, policy: source.policy, inputSnapshots, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const output = path.join(root, 'weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk-audits', generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputSnapshots, outputSnapshot: report.outputSnapshot, coverage: { inputQueueCoverage: report.inputQueueCoverage, existingEvidenceCoverage: report.existingEvidenceCoverage, crosswalkCoverage: report.crosswalkCoverage, semanticPreservationCoverage: report.semanticPreservationCoverage, crosswalkComplete: report.crosswalkComplete, variantScopeEvidenceComplete: report.variantScopeEvidenceComplete, weightedMembershipReviewComplete: report.weightedMembershipReviewComplete, completeActivityUniverse: report.completeActivityUniverse, absoluteBestGate: report.absoluteBestGate, blockers: report.blockers, publishable: report.publishable } }, null, 2));
}
