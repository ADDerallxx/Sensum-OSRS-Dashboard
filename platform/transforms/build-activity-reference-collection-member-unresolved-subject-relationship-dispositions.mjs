import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions } from './activity-reference-collection-member-unresolved-subject-relationship-disposition-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/activity-reference-collection-member-unresolved-subject-relationship-disposition-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));

async function latestRelationshipEvidenceSnapshot() {
  const domain = 'activity-reference-collection-member-unresolved-subject-relationship-evidence';
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const file = path.join(root, directory, `${domain}.ndjson`);
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.relationshipEvidencePacketCoverageComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('relationship_evidence_input_not_publishable');
      if (rows.some(record => record.contract !== policy.inputContract)) reasons.push('unexpected_relationship_evidence_contract');
      if (!rows.length) reasons.push('no_relationship_evidence_records');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid revision-pinned unresolved-subject relationship-evidence snapshot exists.');
}

const input = await latestRelationshipEvidenceSnapshot();
const built = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions({ relationshipEvidenceRecords: input.rows, policy });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'generic_exact_lead_declaration_source_relationship_disposition_without_collection_identity_or_optimizer_promotion',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, 'activity-reference-collection-member-unresolved-subject-relationship-disposition', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-unresolved-subject-relationship-disposition-audits', generatedAt.replace(/[:.]/g, '-'));
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
    sourceRelationshipDispositionCoverage: report.sourceRelationshipDispositionCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    dispositionAttemptCoverageComplete: report.dispositionAttemptCoverageComplete,
    sourceRelationshipDispositionComplete: report.sourceRelationshipDispositionComplete,
    collectionActivityIdentityReviewComplete: report.collectionActivityIdentityReviewComplete,
    linkedSubjectRelationshipReviewComplete: report.linkedSubjectRelationshipReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
