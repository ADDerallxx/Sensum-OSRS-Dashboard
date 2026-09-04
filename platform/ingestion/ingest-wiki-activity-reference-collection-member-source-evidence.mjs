import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import { buildActivityReferenceCollectionMemberSourceEvidence } from './activity-reference-collection-member-source-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const packetPolicy = JSON.parse(await fs.readFile(path.resolve('platform/policies/activity-reference-collection-member-source-evidence-v1.json'), 'utf8'));
const evidencePolicy = JSON.parse(await fs.readFile(path.resolve('platform/policies/activity-candidate-semantic-evidence-v1.json'), 'utf8'));

async function latestMemberCandidateSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const domain = 'activity-reference-collection-member-candidate';
      const file = path.join(root, directory, `${domain}.ndjson`);
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.explicitTableMemberExtractionComplete !== true || manifest.source?.audit?.memberIdentityResolutionAttemptCoverageComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('collection_member_candidate_input_not_publishable');
      if (rows.some(record => record.contract !== 'sensum.activity-reference-collection-member-candidate.v1')) reasons.push('unexpected_collection_member_candidate_contract');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid activity reference-collection member candidate snapshot exists.');
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

const input = await latestMemberCandidateSnapshot();
const revisionIds = [...new Set(input.rows.flatMap(record => (record.currentWikiIdentityResolutions || []).map(identity => identity.observedRevision).filter(Boolean)))];
const fetchedPages = await exactRevisionPages(revisionIds);
const built = buildActivityReferenceCollectionMemberSourceEvidence({ candidates: input.rows, fetchedPages, evidencePolicy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_reference_collection_member_semantic_review_packet',
  api: WIKI_API,
  fetchMode: 'exact retained member revision IDs',
  policies: {
    packet: { id: packetPolicy.policy, file: 'platform/policies/activity-reference-collection-member-source-evidence-v1.json', contentHash: hash(packetPolicy) },
    structuralAndLexical: { id: evidencePolicy.policy, file: 'platform/policies/activity-candidate-semantic-evidence-v1.json', contentHash: hash(evidencePolicy) }
  },
  inputSnapshot,
  fetchedRevisions: fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({
    pageId: page.pageid,
    title: page.title,
    revision: String(revision.revid),
    timestamp: revision.timestamp,
    contentHash: hash(revision.slots?.main?.content || '')
  }))),
  audit: built.audit
};
const snapshot = await writeSnapshot(root, 'activity-reference-collection-member-source-evidence', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policies: source.policies,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-source-evidence-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    sourceAlignment: report.sourceAlignment,
    structuralEvidenceCoverage: report.structuralEvidenceCoverage,
    lexicalCandidateCoverage: report.lexicalCandidateCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    sourceEvidenceCoverageComplete: report.sourceEvidenceCoverageComplete,
    semanticReviewComplete: report.semanticReviewComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
