import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import { buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery } from './agility-colossal-wyrm-termite-reward-rate-source-discovery-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const fieldAuditArgument = argument('field-audit');
const fieldSnapshotArgument = argument('field-snapshot');
if (!fieldAuditArgument) throw new Error('An explicit --field-audit=<report.json> is required.');
if (!fieldSnapshotArgument) throw new Error('An explicit --field-snapshot=<directory> is required.');

const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-discovery-v1.json');
const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));
const fieldAuditFile = path.resolve(fieldAuditArgument);
const fieldAudit = JSON.parse(await fs.readFile(fieldAuditFile, 'utf8'));
const fieldSnapshotDirectory = path.resolve(fieldSnapshotArgument);
const fieldManifest = JSON.parse(await fs.readFile(path.join(fieldSnapshotDirectory, 'manifest.json'), 'utf8'));
fieldManifest.snapshotDirectory = path.basename(fieldSnapshotDirectory);
const fieldRaw = await fs.readFile(path.join(fieldSnapshotDirectory, `${policy.inputSnapshotDomain}.ndjson`), 'utf8');
const fieldRecords = fieldRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

async function searchQuery(query) {
  const channel = policy.channels.find(item => item.channelKey === query.channelKey);
  if (!channel) throw new Error(`Unknown source channel ${query.channelKey}.`);
  const pages = [];
  let offset = null;
  let reportedTotalHits = null;
  let paginationComplete = false;
  let truncated = false;
  while (!paginationComplete && !truncated) {
    const remaining = Number(policy.searchResultLimitPerQuery) - pages.length;
    if (remaining <= 0) { truncated = true; break; }
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', list: 'search',
      srsearch: query.searchText, srnamespace: channel.namespaces.join('|'),
      srlimit: String(Math.min(50, remaining)), srprop: '', srsort: 'just_match'
    });
    if (offset !== null) params.set('sroffset', String(offset));
    const data = await fetchJson(`${WIKI_API}?${params}`);
    if (reportedTotalHits === null) reportedTotalHits = Number(data.query?.searchinfo?.totalhits ?? 0);
    pages.push(...(data.query?.search || []).map(result => ({ pageId: Number(result.pageid), title: result.title, namespaceId: Number(result.ns) })));
    if (data.continue?.sroffset !== undefined) {
      offset = Number(data.continue.sroffset);
      if (pages.length >= Number(policy.searchResultLimitPerQuery)) truncated = true;
    } else paginationComplete = true;
  }
  return {
    queryKey: query.queryKey,
    channelKey: query.channelKey,
    searchText: query.searchText,
    namespaces: [...channel.namespaces],
    maxResults: Number(policy.searchResultLimitPerQuery),
    reportedTotalHits,
    pages,
    paginationComplete,
    truncated
  };
}

async function fetchCurrentRevisionPages(pageIds) {
  const pages = [];
  for (let index = 0; index < pageIds.length; index += 20) {
    const batch = pageIds.slice(index, index + 20);
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
      rvprop: 'ids|timestamp|content', rvslots: 'main', pageids: batch.join('|')
    });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < pageIds.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return pages;
}

const namespaceRegistry = await fetchJson(`${WIKI_API}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', meta: 'siteinfo', siprop: 'namespaces' })}`);
const searchResponses = [];
for (const query of policy.queries) {
  searchResponses.push(await searchQuery(query));
  await new Promise(resolve => setTimeout(resolve, 150));
}
const pageIds = sortedUnique(searchResponses.flatMap(response => response.pages.map(page => page.pageId)));
const revisionPages = await fetchCurrentRevisionPages(pageIds);
const built = buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery({
  fieldAudit, fieldManifest, fieldRecords, namespaceRegistry,
  searchResponses, revisionPages, policy, contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = { file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'), id: policy.policy, contentHash: hash(policy) };
const inputBinding = {
  audit: { file: fieldAuditFile, contract: fieldAudit.contract, contentHash: fieldAudit.contentHash },
  snapshot: { directory: fieldManifest.snapshotDirectory, domain: fieldManifest.domain, contentHash: fieldManifest.contentHash, records: fieldManifest.records }
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'query_bounded_revision_pinned_colossal_wyrm_reward_rate_source_discovery',
    api: WIKI_API,
    scope: 'six exact termite and bone-shard blockers across current articles, official updates, Talk discussions, and source-code namespaces; discovery signals cannot create mechanics or close blockers',
    searchMode: 'all results within each exact declared query/channel bound; every returned page pinned to its fetched current revision',
    input: inputBinding,
    policy: policyBinding,
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
}
const reportBase = { ...built.audit, generatedAt, policy: policyBinding, input: inputBinding, outputSnapshot };
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => Number(left) - Number(right));
}

