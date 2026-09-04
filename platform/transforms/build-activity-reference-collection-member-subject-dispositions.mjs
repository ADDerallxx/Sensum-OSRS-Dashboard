import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityReferenceCollectionMemberSubjectDispositions } from './activity-reference-collection-member-subject-disposition-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policy = JSON.parse(await fs.readFile(path.resolve('platform/policies/activity-reference-collection-member-subject-disposition-v1.json'), 'utf8'));

async function latestMemberSourceEvidenceSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const domain = 'activity-reference-collection-member-source-evidence';
      const file = path.join(root, directory, `${domain}.ndjson`);
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.sourceEvidenceCoverageComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('member_source_evidence_not_publishable');
      if (rows.some(record => record.contract !== 'sensum.activity-reference-collection-member-source-evidence.v1')) reasons.push('unexpected_member_source_evidence_contract');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid revision-pinned collection-member source-evidence snapshot exists.');
}

const input = await latestMemberSourceEvidenceSnapshot();
const built = buildActivityReferenceCollectionMemberSubjectDispositions({ evidenceRecords: input.rows, policy });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'generic_source_declared_reference_collection_member_subject_disposition_without_collection_class_or_optimizer_promotion',
  policy: { id: policy.policy, file: 'platform/policies/activity-reference-collection-member-subject-disposition-v1.json', contentHash: hash(policy) },
  inputSnapshot,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, 'activity-reference-collection-member-subject-disposition', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-subject-disposition-audits', generatedAt.replace(/[:.]/g, '-'));
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
    sourceDeclarationCoverage: report.sourceDeclarationCoverage,
    dispositionCoverage: report.dispositionCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    dispositionAttemptCoverageComplete: report.dispositionAttemptCoverageComplete,
    subjectDispositionComplete: report.subjectDispositionComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
