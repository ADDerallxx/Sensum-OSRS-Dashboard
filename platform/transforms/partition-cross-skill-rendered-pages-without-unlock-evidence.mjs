import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildRenderedPageWithoutUnlockEvidencePartition } from './cross-skill-rendered-page-without-unlock-evidence-partition-lib.mjs';

const root = path.resolve(process.argv.find(value => value.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-partition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'cross-source-entity-activity-candidate';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-partition';

async function timestampDirectories() {
  return (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
}

async function latestCandidateSnapshot() {
  const rejections = [];
  for (const directory of await timestampDirectories()) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${inputDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const audit = manifest.source?.audit || {};
      const reasons = [];
      if (manifest.domain !== inputDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (audit.candidateInventoryComplete !== true || audit.publishable !== true || audit.completeActivityUniverse !== false || audit.accountIndependent !== true) reasons.push('candidate_inventory_not_complete_account_independent_or_publishable');
      if (audit.inputCoverage?.exactTargetSetAndContextMatch !== true || audit.candidateCoverage?.duplicateCandidateKeys?.length || audit.candidateCoverage?.candidateRoutingMismatchKeys?.length) reasons.push('candidate_inventory_set_or_routing_not_exact');
      if (audit.candidateCoverage?.renderedPageWithoutUnlockMatchCount !== rows.filter(row => row.candidateKind === policy.inputCandidateKind).length) reasons.push('rendered_page_without_unlock_count_mismatch');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract)) reasons.push('unexpected_or_empty_candidate_contract');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, raw, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid cross-source entity/activity candidate snapshot exists.');
}

const input = await latestCandidateSnapshot();
const built = buildRenderedPageWithoutUnlockEvidencePartition({ candidateRecords: input.rows, policy, sourceCandidateSnapshotContentHash: input.manifest.contentHash, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'generic_source_provenance_partition_of_stable_rendered_pages_without_unlock_evidence_or_semantic_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) }, inputSnapshot, audit: built.audit
  };
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = { ...built.audit, generatedAt, policy: source.policy, inputSnapshot, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
  report.contentHash = hash(Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'contentHash')));
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputSnapshot, outputSnapshot: report.outputSnapshot, coverage: report }, null, 2));
}
