import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildExactScopedIndependentRepeatabilityEvidence,
  discoverExactScopedIndependentRepeatabilityEvidenceRequests
} from './exact-scoped-independent-repeatability-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/exact-scoped-independent-repeatability-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'exact-scoped-independent-repeatability-evidence-work-routing';
const outputDomain = 'exact-scoped-independent-repeatability-evidence';

async function latestInputSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
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
      if (manifest.source?.audit?.routingCoverageComplete !== true || manifest.source?.audit?.evidenceWorkComplete !== false || manifest.source?.audit?.publishable !== true) reasons.push('exact_scoped_evidence_work_routing_not_publishable');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid exact-scoped independent repeatability evidence-work routing snapshot exists.');
}

async function completeBacklinks(title, maximum) {
  const titles = [];
  let continuation = null;
  let complete = false;
  let truncated = false;
  do {
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', list: 'backlinks', bltitle: title, blnamespace: '0', blfilterredir: 'nonredirects', bllimit: 'max' });
    if (continuation) params.set('blcontinue', continuation);
    const data = await fetchJson(`${WIKI_API}?${params}`);
    titles.push(...(data.query?.backlinks || []).map(row => row.title));
    continuation = data.continue?.blcontinue || null;
    if (new Set(titles).size > maximum) { truncated = true; break; }
    if (!continuation) complete = true;
  } while (continuation);
  return { titles: [...new Set(titles)].sort(), complete, truncated };
}

async function completeExactSearch(label, maximum) {
  const titles = [];
  let offset = null;
  let complete = false;
  let truncated = false;
  do {
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', list: 'search', srsearch: `"${label}"`, srnamespace: '0', srlimit: 'max', srprop: '' });
    if (offset !== null) params.set('sroffset', String(offset));
    const data = await fetchJson(`${WIKI_API}?${params}`);
    titles.push(...(data.query?.search || []).map(row => row.title));
    offset = data.continue?.sroffset ?? null;
    if (new Set(titles).size > maximum) { truncated = true; break; }
    if (offset === null) complete = true;
  } while (offset !== null);
  return { titles: [...new Set(titles)].sort(), complete, truncated };
}

async function currentRevisionPages(titles) {
  const pages = [];
  for (let index = 0; index < titles.length; index += 20) {
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: titles.slice(index, index + 20).join('|') });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < titles.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return pages.sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

const input = await latestInputSnapshot();
const requests = discoverExactScopedIndependentRepeatabilityEvidenceRequests(input.rows, policy);
const discoveryRecords = [];
for (const request of requests) {
  const backlinks = await completeBacklinks(request.exactParentTitle, request.maximumDistinctCandidateTitles);
  const search = await completeExactSearch(request.exactParentLabel, request.maximumDistinctCandidateTitles);
  const distinct = new Set([...backlinks.titles, ...search.titles]);
  discoveryRecords.push({
    memberCandidateKey: request.memberCandidateKey,
    canonicalActivityKey: request.canonicalActivityKey,
    exactParentTitle: request.exactParentTitle,
    exactParentLabel: request.exactParentLabel,
    backlinkTitles: backlinks.titles,
    searchTitles: search.titles,
    backlinkContinuationComplete: backlinks.complete,
    searchContinuationComplete: search.complete,
    truncated: backlinks.truncated || search.truncated || distinct.size > request.maximumDistinctCandidateTitles
  });
}
const candidateTitles = [...new Set(discoveryRecords.flatMap(record => [...record.backlinkTitles, ...record.searchTitles]))].sort();
const candidatePages = await currentRevisionPages(candidateTitles);
const built = buildExactScopedIndependentRepeatabilityEvidence({ workOrders: input.rows, discoveryRecords, candidatePages, policy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const fetchedCandidateRevisions = candidatePages.map(page => {
  const revision = page.revisions?.[0];
  return { pageId: page.pageid ?? null, title: page.title, missing: Boolean(page.missing), revision: revision?.revid ? String(revision.revid) : null, timestamp: revision?.timestamp || null, contentHash: revision ? hash(revision.slots?.main?.content || '') : null };
});
const source = {
  kind: 'revision_pinned_exact_same_line_subject_predicate_independent_repeatability_evidence_without_semantic_verdicts',
  api: WIKI_API,
  fetchMode: 'complete main-namespace backlinks and exact-label Wiki search with continuation, followed by current observed revision pinning; discovery metadata is not evidence',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  requests,
  discoveryRecords,
  fetchedCandidateRevisions,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = { ...built.audit, generatedAt, policy: source.policy, inputSnapshot, requests, discoveryRecords, fetchedCandidateRevisions, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  requests: report.requests,
  discoveryRecords: report.discoveryRecords,
  fetchedCandidateRevisionCount: report.fetchedCandidateRevisions.length,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    discoveryCoverage: report.discoveryCoverage,
    revisionCoverage: report.revisionCoverage,
    packetCoverage: report.packetCoverage,
    evidencePacketAttemptCoverageComplete: report.evidencePacketAttemptCoverageComplete,
    exactScopedDiscoveryChannelsComplete: report.exactScopedDiscoveryChannelsComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
