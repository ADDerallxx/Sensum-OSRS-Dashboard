import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionResolutions } from './activity-evidence-lib.mjs';
import {
  buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence,
  discoverIndependentRepeatabilityCandidateRequests,
  exactSourceSearchQuery,
  selectIndependentRepeatabilitySourceRoutes
} from './activity-reference-collection-member-independent-repeatability-source-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/activity-reference-collection-member-independent-repeatability-source-evidence-v1.json';
const repeatabilityPolicyFile = 'platform/policies/activity-reference-collection-member-repeatability-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const repeatabilityPolicy = JSON.parse(await fs.readFile(path.resolve(repeatabilityPolicyFile), 'utf8'));

async function latestGapDispositionSnapshot() {
  const domain = 'activity-reference-collection-member-repeatability-gap-disposition';
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
      if (manifest.source?.audit?.repeatabilityGapDispositionAttemptCoverageComplete !== true
        || manifest.source?.audit?.publishable !== true) reasons.push('repeatability_gap_disposition_input_not_publishable');
      if (rows.some(record => record.contract !== policy.inputContract)) reasons.push('unexpected_repeatability_gap_disposition_contract');
      if (!rows.length) reasons.push('no_repeatability_gap_disposition_records');
      if (reasons.length) {
        rejections.push({ directory, reasons });
        continue;
      }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid repeatability-gap disposition snapshot exists.');
}

async function wikiExactSourceSearch(query, maximumResults) {
  const results = [];
  let continuation = null;
  let totalHits = null;
  let truncated = false;
  do {
    const remaining = maximumResults - results.length;
    if (remaining <= 0) {
      truncated = continuation !== null;
      break;
    }
    const limit = Math.min(500, remaining);
    const continuationSuffix = continuation === null ? '' : `&sroffset=${encodeURIComponent(continuation)}`;
    const url = `${WIKI_API}?action=query&format=json&formatversion=2&list=search&srnamespace=0&srlimit=${limit}&srprop=size%7Cwordcount%7Ctimestamp%7Csnippet&srinfo=totalhits&srsearch=${encodeURIComponent(query)}${continuationSuffix}`;
    const data = await fetchJson(url);
    if (totalHits === null) totalHits = Number(data.query?.searchinfo?.totalhits || 0);
    for (const row of data.query?.search || []) results.push({
      pageid: Number(row.pageid),
      ns: Number(row.ns),
      title: row.title,
      size: Number(row.size),
      wordcount: Number(row.wordcount),
      timestamp: row.timestamp || null,
      snippet: row.snippet || null,
      rank: results.length + 1
    });
    continuation = data.continue?.sroffset ?? null;
    if (continuation !== null && results.length < maximumResults) await new Promise(resolve => setTimeout(resolve, 150));
  } while (continuation !== null);
  if (continuation !== null) truncated = true;
  return {
    query,
    namespace: 0,
    totalHits: totalHits ?? results.length,
    returnedCount: results.length,
    continuationExhausted: continuation === null,
    truncated,
    results
  };
}

async function wikiMainNamespaceBacklinks(anchorTitle, maximumResults) {
  const results = [];
  let continuation = null;
  let truncated = false;
  do {
    const remaining = maximumResults - results.length;
    if (remaining <= 0) {
      truncated = continuation !== null;
      break;
    }
    const limit = Math.min(500, remaining);
    const continuationSuffix = continuation === null ? '' : `&blcontinue=${encodeURIComponent(continuation)}`;
    const url = `${WIKI_API}?action=query&format=json&formatversion=2&list=backlinks&bltitle=${encodeURIComponent(anchorTitle)}&blnamespace=0&bllimit=${limit}${continuationSuffix}`;
    const data = await fetchJson(url);
    for (const row of data.query?.backlinks || []) results.push({
      pageid: Number(row.pageid),
      ns: Number(row.ns),
      title: row.title,
      ordinal: results.length + 1
    });
    continuation = data.continue?.blcontinue ?? null;
    if (continuation !== null && results.length < maximumResults) await new Promise(resolve => setTimeout(resolve, 150));
  } while (continuation !== null);
  if (continuation !== null) truncated = true;
  return {
    anchorTitle,
    namespace: 0,
    returnedCount: results.length,
    continuationExhausted: continuation === null,
    truncated,
    results
  };
}

const input = await latestGapDispositionSnapshot();
const routes = selectIndependentRepeatabilitySourceRoutes(input.rows, policy);
const discoveryResponses = [];
for (const route of routes) {
  const query = exactSourceSearchQuery(route, policy);
  const anchorTitle = String(route.resolvedTitle || '').trim();
  const [exactSourceSearch, backlinks] = await Promise.all([
    wikiExactSourceSearch(query, policy.discovery.maximumSearchResultsPerActivity),
    wikiMainNamespaceBacklinks(anchorTitle, policy.discovery.maximumBacklinkResultsPerActivity)
  ]);
  discoveryResponses.push({ memberCandidateKey: route.memberCandidateKey, exactSourceSearch, backlinks });
}
const requestedTitles = sortedUnique(discoveryResponses.flatMap(response => {
  const route = routes.find(item => item.memberCandidateKey === response.memberCandidateKey);
  return discoverIndependentRepeatabilityCandidateRequests(route, response, policy).map(request => request.requestedTitle);
}));
const fetchedResolutions = await wikiRevisionResolutions(requestedTitles);
const built = buildActivityReferenceCollectionMemberIndependentRepeatabilitySourceEvidence({
  gapDispositionRecords: input.rows,
  discoveryResponses,
  fetchedResolutions,
  policy,
  repeatabilityPolicy,
  contentHash: hash
});
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_independent_exact_source_search_and_backlink_repeatability_candidates_without_scope_or_verdict_promotion',
  api: WIKI_API,
  fetchMode: 'fully enumerated exact-source phrase search and main-namespace backlinks, then current revision content for every discovered title',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  repeatabilitySignalPolicy: { id: repeatabilityPolicy.policy, file: repeatabilityPolicyFile, contentHash: hash(repeatabilityPolicy) },
  inputSnapshot,
  discoveryResponses,
  requestedTitles,
  fetchedRevisions: fetchedResolutions.map(resolution => {
    const revision = resolution.page?.revisions?.[0];
    const content = revision?.slots?.main?.content;
    return {
      requestedTitle: resolution.requestedTitle,
      normalizedTitle: resolution.normalizedTitle,
      resolvedTitle: resolution.page?.title || resolution.resolvedTitle,
      redirected: resolution.redirected === true,
      namespace: resolution.page?.ns ?? null,
      pageId: resolution.page?.pageid || null,
      revision: revision?.revid ? String(revision.revid) : null,
      timestamp: revision?.timestamp || null,
      contentHash: typeof content === 'string' ? hash(content) : null
    };
  }),
  audit: built.audit
};
const snapshot = await writeSnapshot(
  root,
  'activity-reference-collection-member-independent-repeatability-source-evidence',
  built.records.map(record => ({ ...record, contentHash: hash(record) })),
  source
);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  repeatabilitySignalPolicy: source.repeatabilitySignalPolicy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-independent-repeatability-source-evidence-audits', generatedAt.replace(/[:.]/g, '-'));
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
    discoveryCoverage: report.discoveryCoverage,
    sourceAlignmentCoverage: report.sourceAlignmentCoverage,
    repeatabilitySignalCoverage: report.repeatabilitySignalCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    evidencePacketAttemptCoverageComplete: report.evidencePacketAttemptCoverageComplete,
    independentSourceEvidenceCoverageComplete: report.independentSourceEvidenceCoverageComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
