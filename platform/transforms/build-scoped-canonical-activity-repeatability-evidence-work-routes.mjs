import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes } from './scoped-canonical-activity-repeatability-evidence-work-routing-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/scoped-canonical-activity-repeatability-evidence-work-routing-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'activity-canonical-subject-scope-disposition';
const outputDomain = 'scoped-canonical-activity-repeatability-evidence-work-routing';

async function latestScopeDispositionSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
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
      if (manifest.source?.audit?.canonicalActivityScopeReviewComplete !== true
        || manifest.source?.audit?.publishable !== true) reasons.push('canonical_activity_scope_disposition_not_publishable');
      if (!rows.length || rows.some(record => record.contract !== policy.inputContract || record.state !== policy.eligibleInputState)) reasons.push('unexpected_or_empty_scope_disposition_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid reviewed canonical-activity scope-disposition snapshot exists.');
}

const input = await latestScopeDispositionSnapshot();
const built = buildScopedCanonicalActivityRepeatabilityEvidenceWorkRoutes({ scopeDispositionRecords: input.rows, policy });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'generic_scoped_canonical_activity_repeatability_evidence_work_routing_without_repeatability_member_mechanics_or_optimizer_promotion',
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
    routingCoverage: report.routingCoverage,
    semanticPreservationCoverage: report.semanticPreservationCoverage,
    routingCoverageComplete: report.routingCoverageComplete,
    evidenceWorkComplete: report.evidenceWorkComplete,
    canonicalActivityScopeReviewComplete: report.canonicalActivityScopeReviewComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    memberExpansionComplete: report.memberExpansionComplete,
    mechanicsReviewComplete: report.mechanicsReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
