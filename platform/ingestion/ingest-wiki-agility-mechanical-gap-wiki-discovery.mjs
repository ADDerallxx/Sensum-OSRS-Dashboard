import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import { buildAgilityMechanicalGapWikiDiscovery } from './agility-mechanical-gap-wiki-discovery-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const coverageArgument = argument('coverage-audit');
const sufficiencyArgument = argument('source-sufficiency-audit');
if (!coverageArgument) throw new Error('Provide --coverage-audit=<exact report.json>.');
if (!sufficiencyArgument) throw new Error('Provide --source-sufficiency-audit=<exact report.json>.');
const coverageFile = path.resolve(coverageArgument);
const sufficiencyFile = path.resolve(sufficiencyArgument);
const coverageReport = JSON.parse(await fs.readFile(coverageFile, 'utf8'));
const sourceSufficiencyReport = JSON.parse(await fs.readFile(sufficiencyFile, 'utf8'));
const policyFile = path.resolve('platform/policies/agility-mechanical-gap-wiki-discovery-v1.json');
const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));

async function search(query) {
  const pages = [];
  let offset = null;
  let reportedTotalHits = null;
  let paginationComplete = false;
  let truncated = false;
  while (!paginationComplete && !truncated) {
    const remaining = Number(policy.searchResultLimitPerQuery) - pages.length;
    if (remaining <= 0) { truncated = true; break; }
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      list: 'search',
      srsearch: query.searchText,
      srnamespace: policy.searchNamespaces.join('|'),
      srlimit: String(Math.min(50, remaining)),
      srprop: '',
      srsort: 'just_match'
    });
    if (offset !== null) params.set('sroffset', String(offset));
    const data = await fetchJson(`${WIKI_API}?${params}`);
    if (reportedTotalHits === null) reportedTotalHits = Number(data.query?.searchinfo?.totalhits ?? 0);
    pages.push(...(data.query?.search || []).map(result => ({ pageId: Number(result.pageid), title: result.title })));
    if (data.continue?.sroffset !== undefined) {
      offset = Number(data.continue.sroffset);
      if (pages.length >= Number(policy.searchResultLimitPerQuery)) truncated = true;
    } else {
      paginationComplete = true;
    }
  }
  return {
    queryKey: query.queryKey,
    searchText: query.searchText,
    namespaces: [...policy.searchNamespaces],
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
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'revisions',
      rvprop: 'ids|timestamp|content',
      rvslots: 'main',
      pageids: batch.join('|')
    });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < pageIds.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return pages;
}

const searchResponses = [];
for (const query of policy.queries) {
  searchResponses.push(await search(query));
  await new Promise(resolve => setTimeout(resolve, 150));
}
const pageIds = [...new Set(searchResponses.flatMap(response => response.pages.map(page => page.pageId)))].sort((left, right) => left - right);
const revisionPages = await fetchCurrentRevisionPages(pageIds);
const built = buildAgilityMechanicalGapWikiDiscovery({ coverageReport, sourceSufficiencyReport, searchResponses, revisionPages, policy, contentHash: hash });
const generatedAt = new Date().toISOString();
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, 'agility-mechanical-gap-wiki-discovery', built.records, {
    kind: 'query_bounded_candidate_specific_official_wiki_source_discovery',
    api: WIKI_API,
    searchMode: 'all results within each exact declared namespace-0 query bound; every returned page pinned to its fetched current revision',
    scope: 'four blockers across three level-34 mechanical-model gaps; not a complete Wiki or game-fact universe',
    coverageInput: { file: coverageFile, contract: coverageReport.contract, contentHash: coverageReport.contentHash },
    sourceSufficiencyInput: { file: sufficiencyFile, contract: sourceSufficiencyReport.contract, contentHash: sourceSufficiencyReport.contentHash },
    policy: { file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'), id: policy.policy, contentHash: hash(policy) },
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
}
const report = {
  ...built.audit,
  generatedAt,
  policy: { file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'), id: policy.policy, contentHash: hash(policy) },
  coverageInputFile: coverageFile,
  sourceSufficiencyInputFile: sufficiencyFile,
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, 'agility-mechanical-gap-wiki-discovery-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
