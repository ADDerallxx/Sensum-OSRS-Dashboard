import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildActivityCanonicalSubjectScopeEvidence,
  discoverActivityCanonicalSubjectScopeExactRevisionRequests
} from './activity-canonical-subject-scope-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/activity-canonical-subject-scope-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'activity-canonical-subject-scope-evidence-work-routing';
const outputDomain = 'activity-canonical-subject-scope-evidence';

async function latestInputSnapshot() {
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
      if (manifest.source?.audit?.routingCoverageComplete !== true
        || manifest.source?.audit?.canonicalActivitySubjectBindingReviewComplete !== true
        || manifest.source?.audit?.publishable !== true) reasons.push('scope_evidence_work_routing_not_publishable');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid canonical-activity subject scope-evidence routing snapshot exists.');
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

const input = await latestInputSnapshot();
const revisionRequests = discoverActivityCanonicalSubjectScopeExactRevisionRequests(input.rows, policy);
const fetchedPages = await exactRevisionPages(revisionRequests.map(request => request.sourceRevision));
const built = buildActivityCanonicalSubjectScopeEvidence({ routingRecords: input.rows, fetchedPages, policy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_complete_canonical_activity_subject_source_and_structural_scope_observations_without_scope_or_repeatability_verdict',
  api: WIKI_API,
  fetchMode: 'exact subject-binding revision IDs with complete source text and structural inventories',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  revisionRequests,
  fetchedRevisions: fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({
    pageId: page.pageid,
    title: page.title,
    revision: String(revision.revid),
    timestamp: revision.timestamp,
    contentHash: hash(revision.slots?.main?.content || ''),
    sourceContentBytes: Buffer.byteLength(revision.slots?.main?.content || '', 'utf8')
  }))),
  audit: built.audit
};
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  fetchedRevisions: source.fetchedRevisions,
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
  fetchedRevisions: report.fetchedRevisions,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    revisionCoverage: report.revisionCoverage,
    captureCoverage: report.captureCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    evidencePacketAttemptCoverageComplete: report.evidencePacketAttemptCoverageComplete,
    canonicalActivityScopeEvidenceCoverageComplete: report.canonicalActivityScopeEvidenceCoverageComplete,
    canonicalActivitySubjectBindingReviewComplete: report.canonicalActivitySubjectBindingReviewComplete,
    canonicalActivityScopeReviewComplete: report.canonicalActivityScopeReviewComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
