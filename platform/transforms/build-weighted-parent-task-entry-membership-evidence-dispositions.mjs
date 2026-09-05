import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildWeightedParentTaskEntryMembershipEvidenceDispositions } from './weighted-parent-task-entry-membership-evidence-disposition-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/weighted-parent-task-entry-membership-evidence-disposition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'weighted-parent-task-entry-membership-evidence';
const outputDomain = 'weighted-parent-task-entry-membership-evidence-disposition';

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
      if (audit.evidencePacketCaptureComplete !== true || audit.weightedMembershipReviewComplete !== false
        || audit.completeActivityUniverse !== false || audit.publishable !== true
        || audit.packetCoverage?.evidencePacketCount < 1
        || audit.packetCoverage?.completeEvidencePacketCount !== audit.packetCoverage?.evidencePacketCount) {
        reasons.push('weighted_membership_evidence_snapshot_not_publishable_or_complete');
      }
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) {
        reasons.push('unexpected_or_empty_input_contract_or_state');
      }
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid weighted parent-task entry membership evidence snapshot exists.');
}

const input = await latestInputSnapshot();
const built = buildWeightedParentTaskEntryMembershipEvidenceDispositions({ evidenceRecords: input.rows, policy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'generic_fail_closed_weighted_parent_task_entry_membership_evidence_disposition_without_membership_or_optimizer_promotion',
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
    accepted: true,
    inputSnapshot,
    outputSnapshot: report.outputSnapshot,
    policy: report.policy,
    coverage: {
      inputCoverage: report.inputCoverage,
      sourceIntegrityCoverage: report.sourceIntegrityCoverage,
      packetIntegrityCoverage: report.packetIntegrityCoverage,
      dispositionCoverage: report.dispositionCoverage,
      routeCoverage: report.routeCoverage,
      dispositionCoverageComplete: report.dispositionCoverageComplete,
      weightedMembershipReviewComplete: report.weightedMembershipReviewComplete,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers,
      publishable: report.publishable
    }
  }, null, 2));
}
