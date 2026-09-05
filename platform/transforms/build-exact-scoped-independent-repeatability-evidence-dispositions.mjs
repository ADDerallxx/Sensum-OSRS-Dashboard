import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildExactScopedIndependentRepeatabilityEvidenceDispositions } from './exact-scoped-independent-repeatability-evidence-disposition-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/exact-scoped-independent-repeatability-evidence-disposition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'exact-scoped-independent-repeatability-evidence';
const outputDomain = 'exact-scoped-independent-repeatability-evidence-disposition';

async function latestEvidenceSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${inputDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== inputDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.evidencePacketAttemptCoverageComplete !== true || manifest.source?.audit?.exactScopedDiscoveryChannelsComplete !== true || manifest.source?.audit?.repeatabilityReviewComplete !== false || manifest.source?.audit?.publishable !== true) reasons.push('exact_scoped_repeatability_evidence_not_complete_or_publishable');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid exact-scoped independent repeatability evidence snapshot exists.');
}

const input = await latestEvidenceSnapshot();
const built = buildExactScopedIndependentRepeatabilityEvidenceDispositions({ evidenceRecords: input.rows, policy });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = { kind: 'generic_exact_scoped_independent_repeatability_domain_disposition_without_negative_inference_or_verdict', policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) }, inputSnapshot, audit: built.audit };
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = { ...built.audit, generatedAt, policy: source.policy, inputSnapshot, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    packetIntegrityCoverage: report.packetIntegrityCoverage,
    domainDispositionCoverage: report.domainDispositionCoverage,
    semanticPreservationCoverage: report.semanticPreservationCoverage,
    dispositionAttemptCoverageComplete: report.dispositionAttemptCoverageComplete,
    repeatabilityClassificationCoverageComplete: report.repeatabilityClassificationCoverageComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
