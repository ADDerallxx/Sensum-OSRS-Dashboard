import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import { buildActivityCandidateSourceEvidence } from './activity-candidate-source-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policy = JSON.parse(await fs.readFile(path.resolve('platform/policies/activity-candidate-semantic-evidence-v1.json'), 'utf8'));

async function latestSnapshot(domain, validate) {
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
      reasons.push(...validate({ rows, manifest }));
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error(`No valid ${domain} snapshot exists.`);
}

async function exactRevisionPages(revisionIds) {
  const pages = [];
  for (let index = 0; index < revisionIds.length; index += 20) {
    const batch = revisionIds.slice(index, index + 20);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'revisions',
      rvprop: 'ids|timestamp|content',
      rvslots: 'main',
      revids: batch.join('|')
    });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return pages;
}

const candidates = await latestSnapshot('cross-source-entity-activity-candidate', ({ rows, manifest }) => {
  const reasons = [];
  if (manifest.source?.audit?.candidateInventoryComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('candidate_inventory_not_complete');
  if (rows.some(record => record.contract !== 'sensum.cross-source-entity-activity-candidate.v1')) reasons.push('unexpected_candidate_contract');
  return reasons;
});
const signatures = await latestSnapshot('unlock-linked-page-source-signature', ({ rows, manifest }) => {
  const reasons = [];
  if (manifest.source?.audit?.sourceSignatureCoverageComplete !== true || manifest.source?.audit?.identityRevisionAlignmentComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('source_signature_inventory_not_complete_or_aligned');
  if (rows.some(record => record.contract !== 'sensum.unlock-linked-page-source-signature.v1')) reasons.push('unexpected_source_signature_contract');
  return reasons;
});

const activityCandidates = candidates.rows.filter(candidate => candidate.candidateKind === 'activity_page_identity_candidate');
const activityPageIds = new Set(activityCandidates.map(candidate => String(candidate.pageIdentity.sourcePageId)));
const activitySignatures = signatures.rows.filter(signature => activityPageIds.has(String(signature.sourcePageId)));
const fetchedPages = await exactRevisionPages([...new Set(activitySignatures.map(signature => signature.sourceRevision))]);
const built = buildActivityCandidateSourceEvidence({ candidates: candidates.rows, signatures: signatures.rows, fetchedPages, policy, contentHash: hash });
const inputSnapshots = {
  candidates: { directory: candidates.directory, contentHash: candidates.manifest.contentHash, rejections: candidates.rejections },
  sourceSignatures: { directory: signatures.directory, contentHash: signatures.manifest.contentHash, rejections: signatures.rejections }
};
const source = {
  kind: 'revision_pinned_activity_candidate_source_evidence_review_packet',
  api: WIKI_API,
  fetchMode: 'exact retained revision IDs',
  policy: policy.policy,
  inputSnapshots,
  fetchedRevisions: fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({ pageId: page.pageid, title: page.title, revision: String(revision.revid), timestamp: revision.timestamp, contentHash: hash(revision.slots?.main?.content || '') }))),
  audit: built.audit
};
const snapshot = await writeSnapshot(root, 'activity-candidate-source-evidence', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: { file: 'platform/policies/activity-candidate-semantic-evidence-v1.json', id: policy.policy, contentHash: hash(policy) },
  inputSnapshots,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-candidate-source-evidence-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshots,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    sourceAlignment: report.sourceAlignment,
    structuralEvidenceCoverage: report.structuralEvidenceCoverage,
    lexicalCandidateCoverage: report.lexicalCandidateCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    sourceEvidenceCoverageComplete: report.sourceEvidenceCoverageComplete,
    semanticReviewComplete: report.semanticReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
