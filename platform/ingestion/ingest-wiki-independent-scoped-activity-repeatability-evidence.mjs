import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildIndependentScopedActivityRepeatabilityEvidence,
  discoverIndependentScopedActivityRepeatabilityCandidateTitles,
  discoverIndependentScopedActivityRepeatabilitySeedRequests
} from './independent-scoped-activity-repeatability-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/independent-scoped-activity-repeatability-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'scoped-canonical-activity-repeatability-gap-evidence-work-routing';
const outputDomain = 'independent-scoped-activity-repeatability-evidence';

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
        || manifest.source?.audit?.evidenceWorkComplete !== false
        || manifest.source?.audit?.publishable !== true) reasons.push('repeatability_gap_evidence_work_routing_not_publishable');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid scoped canonical-activity repeatability-gap evidence-work routing snapshot exists.');
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

async function currentTitlePages(titles) {
  const pages = [];
  for (let index = 0; index < titles.length; index += 20) {
    const batch = titles.slice(index, index + 20);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'revisions',
      rvprop: 'ids|timestamp|content',
      rvslots: 'main',
      titles: batch.join('|')
    });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < titles.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return pages;
}

const input = await latestInputSnapshot();
const seedRequests = discoverIndependentScopedActivityRepeatabilitySeedRequests(input.rows, policy);
const seedRevisions = [...new Set(seedRequests.map(request => request.revision))];
const seedPages = await exactRevisionPages(seedRevisions);
const candidateDiscovery = discoverIndependentScopedActivityRepeatabilityCandidateTitles({ workOrders: input.rows, seedPages, policy });
const candidateTitles = [...new Set(candidateDiscovery.flatMap(record => record.requestedTitles))];
const candidatePages = await currentTitlePages(candidateTitles);
const built = buildIndependentScopedActivityRepeatabilityEvidence({ workOrders: input.rows, seedPages, candidatePages, policy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_independent_scoped_activity_repeatability_candidate_evidence_without_semantic_verdicts',
  api: WIKI_API,
  fetchMode: 'exact primary and collection anchor revisions followed by complete source-authored main-namespace link fetch and reciprocal-link filtering; rendered links excluded',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  seedRequests,
  candidateDiscovery,
  candidateTitleCount: candidateTitles.length,
  fetchedSeedRevisions: seedPages.flatMap(page => (page.revisions || []).map(revision => ({
    pageId: page.pageid,
    title: page.title,
    revision: String(revision.revid),
    timestamp: revision.timestamp,
    contentHash: hash(revision.slots?.main?.content || '')
  }))),
  fetchedCandidateRevisions: candidatePages.map(page => {
    const revision = page.revisions?.[0];
    return {
      pageId: page.pageid ?? null,
      title: page.title,
      missing: Boolean(page.missing),
      revision: revision?.revid ? String(revision.revid) : null,
      timestamp: revision?.timestamp || null,
      contentHash: revision ? hash(revision.slots?.main?.content || '') : null
    };
  }),
  audit: built.audit
};
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  seedRequests,
  candidateDiscovery,
  fetchedSeedRevisions: source.fetchedSeedRevisions,
  fetchedCandidateRevisions: source.fetchedCandidateRevisions,
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
  seedRequests: report.seedRequests,
  candidateDiscovery: report.candidateDiscovery,
  fetchedSeedRevisions: report.fetchedSeedRevisions,
  fetchedCandidateRevisionCount: report.fetchedCandidateRevisions.length,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    revisionCoverage: report.revisionCoverage,
    discoveryCoverage: report.discoveryCoverage,
    packetCoverage: report.packetCoverage,
    evidencePacketAttemptCoverageComplete: report.evidencePacketAttemptCoverageComplete,
    independentEvidenceDiscoveryScopeComplete: report.independentEvidenceDiscoveryScopeComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
