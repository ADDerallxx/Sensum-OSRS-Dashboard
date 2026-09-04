import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityReferenceCollectionMemberEvidenceWorkRoutes } from './activity-reference-collection-member-evidence-work-routing-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policy = JSON.parse(await fs.readFile(path.resolve('platform/policies/activity-reference-collection-member-evidence-work-routing-v1.json'), 'utf8'));

async function latestMemberDispositionSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const domain = 'activity-reference-collection-member-subject-disposition';
      const file = path.join(root, directory, `${domain}.ndjson`);
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.dispositionAttemptCoverageComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('member_subject_disposition_not_publishable');
      if (rows.some(record => record.contract !== 'sensum.activity-reference-collection-member-subject-disposition.v1')) reasons.push('unexpected_member_subject_disposition_contract');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid collection-member subject-disposition snapshot exists.');
}

const input = await latestMemberDispositionSnapshot();
const built = buildActivityReferenceCollectionMemberEvidenceWorkRoutes({ dispositionRecords: input.rows, policy });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'generic_collection_member_evidence_work_routing_without_collection_context_or_semantic_promotion',
  policy: { id: policy.policy, file: 'platform/policies/activity-reference-collection-member-evidence-work-routing-v1.json', contentHash: hash(policy) },
  inputSnapshot,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, 'activity-reference-collection-member-evidence-work-routing', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-evidence-work-routing-audits', generatedAt.replace(/[:.]/g, '-'));
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
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    routingCoverageComplete: report.routingCoverageComplete,
    evidenceWorkComplete: report.evidenceWorkComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
