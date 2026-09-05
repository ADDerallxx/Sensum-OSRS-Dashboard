import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions } from './cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'cross-skill-unresolved-rendered-target-resolution-evidence';
const outputDomain = 'cross-skill-unresolved-rendered-target-resolution-evidence-sufficiency-disposition';
const withoutContentHash = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => key !== 'contentHash'));

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
      if (audit.resolutionEvidenceCoverageComplete !== true || audit.canonicalIdentityComplete !== false ||
          audit.completeActivityUniverse !== false || audit.publishable !== true) {
        reasons.push('resolution_evidence_snapshot_not_publishable_or_semantic_gates_not_closed');
      }
      if (audit.inputCoverage?.expectedUnresolvedRenderedTargetCount !== rows.length || !rows.length) reasons.push('unexpected_or_empty_resolution_evidence_record_count');
      if (rows.some(row => row.contract !== policy.inputContract || row.state !== 'resolution_evidence_captured_review_pending')) reasons.push('unexpected_input_contract_or_state');
      if (rows.some(row => !row.contentHash || hash(withoutContentHash(row)) !== row.contentHash)) reasons.push('input_intrinsic_record_hash_failure');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid unresolved rendered-target resolution-evidence snapshot exists.');
}

const input = await latestInputSnapshot();
const built = buildUnresolvedRenderedTargetResolutionEvidenceSufficiencyDispositions({
  evidenceRecords: input.rows,
  inputSnapshotContentHash: input.manifest.contentHash,
  policy,
  contentHash: hash
});
const generatedAt = new Date().toISOString();
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'generic_fail_closed_resolution_evidence_sufficiency_routing_without_identity_selection',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  audit: built.audit
};

if (!built.audit.publishable) {
  console.error(JSON.stringify({ contract: built.audit.contract, generatedAt, inputSnapshot, outputWritten: false, coverage: built.audit }, null, 2));
  process.exitCode = 2;
} else {
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
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
    outputWritten: true,
    coverage: {
      inputCoverage: report.inputCoverage,
      policyCoverage: report.policyCoverage,
      dispositionCoverage: report.dispositionCoverage,
      bindingCoverage: report.bindingCoverage,
      semanticPreservationCoverage: report.semanticPreservationCoverage,
      dispositionCoverageComplete: report.dispositionCoverageComplete,
      resolutionReviewComplete: report.resolutionReviewComplete,
      canonicalIdentityComplete: report.canonicalIdentityComplete,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers,
      publishable: report.publishable
    }
  }, null, 2));
}
