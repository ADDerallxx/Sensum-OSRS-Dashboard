import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition } from './multi-variant-binding-additional-evidence-sufficiency-disposition-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/multi-variant-binding-additional-evidence-sufficiency-disposition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'multi-variant-binding-additional-evidence-source-discovery';
const outputDomain = 'multi-variant-binding-additional-evidence-sufficiency-disposition';

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
      if (audit.evidencePacketAttemptCoverageComplete !== true
        || audit.variantDisambiguationEvidenceComplete !== false
        || audit.variantBindingReviewComplete !== false
        || audit.optimizerEligibleCount !== 0
        || audit.completeActivityUniverse !== false
        || audit.publishable !== true) reasons.push('source_discovery_not_publishable_or_gates_not_closed');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) {
        rejections.push({ directory, reasons });
        continue;
      }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid multi-variant binding additional-evidence source-discovery snapshot exists.');
}

const input = await latestInputSnapshot();
const built = buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition({
  evidencePackets: input.rows,
  policy,
  sourceSnapshotContentHash: input.manifest.contentHash,
  contentHash: hash
});
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'generic_fail_closed_additional_variant_binding_evidence_sufficiency_disposition_without_review_binding_or_semantic_promotion',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDirectory, { recursive: true });
await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    sourceIntegrityCoverage: report.sourceIntegrityCoverage,
    dispositionCoverage: report.dispositionCoverage,
    reviewRoutingCoverage: report.reviewRoutingCoverage,
    semanticPreservationCoverage: report.semanticPreservationCoverage,
    dispositionCoverageComplete: report.dispositionCoverageComplete,
    variantBindingReviewComplete: report.variantBindingReviewComplete,
    optimizerEligibleCount: report.optimizerEligibleCount,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
