import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence } from './activity-reference-collection-member-unresolved-subject-relationship-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/activity-reference-collection-member-unresolved-subject-relationship-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));

async function snapshots(domain) {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const found = [];
  for (const directory of directories) {
    try {
      const file = path.join(root, directory, `${domain}.ndjson`);
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      found.push({ directory, raw, rows, manifest });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return found;
}

async function latestRoutingSnapshot() {
  const domain = 'activity-reference-collection-member-unresolved-subject-relationship-work-routing';
  const rejections = [];
  for (const candidate of await snapshots(domain)) {
    const reasons = [];
    if (candidate.manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
    if (candidate.manifest.records !== candidate.rows.length) reasons.push('record_count_mismatch');
    if (candidate.manifest.contentHash !== hash(candidate.raw)) reasons.push('content_hash_mismatch');
    if (candidate.manifest.source?.audit?.routingCoverageComplete !== true || candidate.manifest.source?.audit?.publishable !== true) reasons.push('relationship_work_routing_input_not_publishable');
    if (candidate.rows.some(record => record.contract !== policy.inputRoutingContract)) reasons.push('unexpected_relationship_work_routing_contract');
    if (!candidate.rows.some(record => record.routingDecision?.routeState === 'queued')) reasons.push('no_queued_relationship_work_routes');
    if (reasons.length) { rejections.push({ directory: candidate.directory, reasons }); continue; }
    return { ...candidate, rejections };
  }
  throw new Error('No valid relationship-work routing snapshot with queued routes exists.');
}

async function matchingSourceSignatureSnapshot(routes) {
  const domain = 'activity-reference-collection-member-unresolved-subject-source-signature';
  const queued = routes.filter(record => record.routingDecision?.routeState === 'queued');
  const rejections = [];
  for (const candidate of await snapshots(domain)) {
    const reasons = [];
    if (candidate.manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
    if (candidate.manifest.records !== candidate.rows.length) reasons.push('record_count_mismatch');
    if (candidate.manifest.contentHash !== hash(candidate.raw)) reasons.push('content_hash_mismatch');
    if (candidate.manifest.source?.audit?.sourceSignatureCoverageComplete !== true || candidate.manifest.source?.audit?.publishable !== true) reasons.push('source_signature_input_not_publishable');
    if (candidate.rows.some(record => record.contract !== policy.inputSourceSignatureContract)) reasons.push('unexpected_source_signature_contract');
    for (const route of queued) {
      const exact = candidate.rows.filter(record => record.memberCandidateKey === route.memberCandidateKey && record.contentHash === route.sourceSignatureContentHash);
      if (exact.length !== 1) reasons.push(`source_signature_join_count_${route.memberCandidateKey}_${exact.length}`);
    }
    if (reasons.length) { rejections.push({ directory: candidate.directory, reasons }); continue; }
    return { ...candidate, rejections };
  }
  throw new Error('No valid source-signature snapshot exactly matches every queued relationship route.');
}

const routing = await latestRoutingSnapshot();
const signatures = await matchingSourceSignatureSnapshot(routing.rows);
const built = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence({ routingRecords: routing.rows, sourceSignatureRecords: signatures.rows, policy });
const routingSnapshot = { directory: routing.directory, contentHash: routing.manifest.contentHash, rejections: routing.rejections };
const sourceSignatureSnapshot = { directory: signatures.directory, contentHash: signatures.manifest.contentHash, rejections: signatures.rejections };
const source = {
  kind: 'revision_pinned_collection_row_and_linked_source_page_relationship_review_evidence_without_semantic_inference',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  routingSnapshot,
  sourceSignatureSnapshot,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, 'activity-reference-collection-member-unresolved-subject-relationship-evidence', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  routingSnapshot,
  sourceSignatureSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-unresolved-subject-relationship-evidence-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  routingSnapshot,
  sourceSignatureSnapshot,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    evidenceCoverage: report.evidenceCoverage,
    candidateObservationCoverage: report.candidateObservationCoverage,
    policyCoverage: report.policyCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    relationshipEvidencePacketCoverageComplete: report.relationshipEvidencePacketCoverageComplete,
    collectionActivityIdentityReviewComplete: report.collectionActivityIdentityReviewComplete,
    linkedSubjectRelationshipReviewComplete: report.linkedSubjectRelationshipReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
