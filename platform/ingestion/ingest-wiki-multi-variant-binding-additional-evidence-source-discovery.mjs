import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionResolutions } from './activity-evidence-lib.mjs';
import {
  buildMultiVariantBindingAdditionalEvidenceSourceDiscovery,
  buildMultiVariantBindingDiscoveryQueries,
  discoverMultiVariantBindingCandidateRequests
} from './multi-variant-binding-additional-evidence-source-discovery-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/multi-variant-binding-additional-evidence-source-discovery-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'multi-variant-binding-additional-evidence-work-queue';
const outputDomain = 'multi-variant-binding-additional-evidence-source-discovery';

async function latestInputSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name).sort().reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${inputDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const audit = manifest.source?.audit || {};
      const reasons = [];
      if (manifest.domain !== inputDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (audit.queueExportComplete !== true || audit.variantBindingReviewComplete !== false || audit.optimizerEligibleCount !== 0 || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('additional_evidence_queue_not_publishable_or_gates_not_closed');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) {
        rejections.push({ directory, reasons });
        continue;
      }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid multi-variant binding additional-evidence work queue snapshot exists.');
}

async function exactRevisionPages(revisionIds) {
  const pages = [];
  for (let index = 0; index < revisionIds.length; index += 20) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
      rvprop: 'ids|timestamp|content', rvslots: 'main', revids: revisionIds.slice(index, index + 20).join('|')
    });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return pages;
}

async function exactSourceSearch(queryDefinition) {
  const results = [];
  let continuation = null;
  let totalHits = null;
  let truncated = false;
  do {
    const remaining = policy.discovery.maximumSearchResultsPerQuery - results.length;
    if (remaining <= 0) {
      truncated = continuation !== null;
      break;
    }
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', list: 'search',
      srnamespace: String(queryDefinition.namespace), srlimit: String(Math.min(500, remaining)),
      srprop: 'size|wordcount|timestamp|snippet', srinfo: 'totalhits', srsearch: queryDefinition.query
    });
    if (continuation !== null) params.set('sroffset', String(continuation));
    const data = await fetchJson(`${WIKI_API}?${params}`);
    if (totalHits === null) totalHits = Number(data.query?.searchinfo?.totalhits || 0);
    for (const row of data.query?.search || []) results.push({
      pageid: Number(row.pageid), ns: Number(row.ns), title: row.title,
      size: Number(row.size), wordcount: Number(row.wordcount), timestamp: row.timestamp || null,
      snippet: row.snippet || null, rank: results.length + 1
    });
    continuation = data.continue?.sroffset ?? null;
    if (continuation !== null && results.length < policy.discovery.maximumSearchResultsPerQuery) await new Promise(resolve => setTimeout(resolve, 150));
  } while (continuation !== null);
  if (continuation !== null) truncated = true;
  return {
    ...queryDefinition,
    totalHits: totalHits ?? results.length,
    returnedCount: results.length,
    continuationExhausted: continuation === null,
    truncated,
    results
  };
}

const input = await latestInputSnapshot();
const revisionIds = [...new Set(input.rows.flatMap(record => [
  record.subjectEvidence?.sourcePageIdentity?.sourceRevision,
  record.parentOccurrenceEvidence?.sourcePageIdentity?.sourceRevision
]).filter(Boolean).map(String))].sort();
const pinnedRevisionPages = await exactRevisionPages(revisionIds);
const discoveryResponses = [];
const candidateRequests = [];
for (const record of input.rows) {
  const queryDefinitions = buildMultiVariantBindingDiscoveryQueries(record, policy);
  const searchResponses = [];
  for (const query of queryDefinitions) searchResponses.push(await exactSourceSearch(query));
  discoveryResponses.push({ workQueueEntryKey: record.workQueueEntryKey, searchResponses });
  candidateRequests.push({
    workQueueEntryKey: record.workQueueEntryKey,
    requests: discoverMultiVariantBindingCandidateRequests(record, searchResponses)
  });
}
const requestedTitles = [...new Set(candidateRequests.flatMap(group => group.requests.map(request => request.requestedTitle)))].sort((left, right) => left.localeCompare(right));
const fetchedResolutions = await wikiRevisionResolutions(requestedTitles);
const built = buildMultiVariantBindingAdditionalEvidenceSourceDiscovery({
  workQueueRecords: input.rows,
  pinnedRevisionPages,
  discoveryResponses,
  candidateRequests,
  fetchedResolutions,
  policy,
  sourceQueueSnapshotContentHash: input.manifest.contentHash,
  contentHash: hash
});
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_exact_source_discovery_for_ambiguous_multi_variant_parent_bindings_without_review_or_promotion',
  api: WIKI_API,
  fetchMode: 'exact pinned revision revalidation plus fully enumerated source-derived current-revision searches and direct subject parent transcript capture',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  pinnedRevisionIds: revisionIds,
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
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDirectory, { recursive: true });
await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    pinnedSourceIntegrityCoverage: report.pinnedSourceIntegrityCoverage,
    discoveryCoverage: report.discoveryCoverage,
    sourceAlignmentCoverage: report.sourceAlignmentCoverage,
    requiredChannelCoverage: report.requiredChannelCoverage,
    semanticPreservationCoverage: report.semanticPreservationCoverage,
    evidencePacketAttemptCoverageComplete: report.evidencePacketAttemptCoverageComplete,
    variantDisambiguationEvidenceComplete: report.variantDisambiguationEvidenceComplete,
    variantBindingReviewComplete: report.variantBindingReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
