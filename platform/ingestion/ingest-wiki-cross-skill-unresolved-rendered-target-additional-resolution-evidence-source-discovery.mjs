import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionResolutions } from './activity-evidence-lib.mjs';
import {
  buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery,
  deriveUnresolvedRenderedTargetCategorySearchQueries
} from './cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'cross-skill-unresolved-rendered-target-resolution-additional-evidence-work-queue';
const outputDomain = 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery';

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
      if (audit.queueExportComplete !== true || audit.resolutionReviewComplete !== false || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('additional_resolution_evidence_queue_not_publishable_or_gates_not_closed');
      if (audit.semanticPreservationCoverage?.optimizerEligibleCount !== 0 || audit.semanticPreservationCoverage?.selectedResolutionCount !== 0) reasons.push('upstream_semantic_or_optimizer_promotion_present');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (rows.some(row => !row.contentHash || hash(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'contentHash'))) !== row.contentHash)) reasons.push('input_intrinsic_record_hash_failure');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error(`No valid ${inputDomain} snapshot exists.`);
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

async function officialCategoryNamespaceMetadata() {
  const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', meta: 'siteinfo', siprop: 'namespaces|namespacealiases' });
  const data = await fetchJson(`${WIKI_API}?${params}`);
  const row = data.query?.namespaces?.[String(policy.discovery.categoryNamespaceId)];
  return {
    namespace: row ? {
      id: Number(row.id), canonicalName: row.canonical || null,
      localizedName: row.name || null, caseRule: row.case || null
    } : null,
    aliases: (data.query?.namespacealiases || []).filter(item => Number(item.id) === policy.discovery.categoryNamespaceId).map(item => item.alias),
    complete: data.batchcomplete === true && Boolean(row)
  };
}

async function exactCurrentCategory(workQueueEntryKey, requestedTitle) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', redirects: '1', converttitles: '1',
    titles: requestedTitle, prop: 'info|revisions|categoryinfo', rvprop: 'ids|timestamp|content', rvslots: 'main'
  });
  const response = await fetchJson(`${WIKI_API}?${params}`);
  return { workQueueEntryKey, requestedTitle, response, complete: response.batchcomplete === true };
}

async function completeCategoryPrefix(workQueueEntryKey, requestedTitle) {
  const prefix = requestedTitle.slice(requestedTitle.indexOf(':') + 1);
  const entries = [];
  let continuation = null;
  let finalBatchComplete = false;
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', list: 'allcategories',
      acprefix: prefix, aclimit: String(policy.discovery.maximumResultsPerQuery)
    });
    if (continuation) params.set('accontinue', continuation);
    const response = await fetchJson(`${WIKI_API}?${params}`);
    entries.push(...(response.query?.allcategories || []));
    finalBatchComplete = response.batchcomplete === true;
    continuation = response.continue?.accontinue || null;
    if (continuation) await new Promise(resolve => setTimeout(resolve, 150));
  } while (continuation);
  return { workQueueEntryKey, requestedTitle, prefix, entries, continuationExhausted: continuation === null, complete: finalBatchComplete && continuation === null };
}

async function completeCategoryMembers(workQueueEntryKey, requestedTitle) {
  const members = [];
  let continuation = null;
  let finalBatchComplete = false;
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', list: 'categorymembers',
      cmtitle: requestedTitle, cmlimit: String(policy.discovery.maximumResultsPerQuery),
      cmprop: 'ids|title|sortkey|sortkeyprefix|timestamp'
    });
    if (continuation) params.set('cmcontinue', continuation);
    const response = await fetchJson(`${WIKI_API}?${params}`);
    members.push(...(response.query?.categorymembers || []));
    finalBatchComplete = response.batchcomplete === true;
    continuation = response.continue?.cmcontinue || null;
    if (continuation) await new Promise(resolve => setTimeout(resolve, 150));
  } while (continuation);
  return { workQueueEntryKey, requestedTitle, members, continuationExhausted: continuation === null, complete: finalBatchComplete && continuation === null };
}

async function completeNamespaceSearch(queryDefinition) {
  const pages = new Map();
  let continuation = {};
  let finalBatchComplete = false;
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', generator: 'search',
      gsrsearch: queryDefinition.query, gsrnamespace: String(queryDefinition.namespaceId),
      gsrlimit: String(policy.discovery.maximumResultsPerQuery), prop: 'revisions',
      rvprop: 'ids|timestamp|content', rvslots: 'main', ...continuation
    });
    const response = await fetchJson(`${WIKI_API}?${params}`);
    for (const page of response.query?.pages || []) pages.set(Number(page.pageid), page);
    finalBatchComplete = response.batchcomplete === true;
    continuation = response.continue || null;
    if (continuation) await new Promise(resolve => setTimeout(resolve, 150));
  } while (continuation);
  return { ...queryDefinition, pages: [...pages.values()], continuationExhausted: continuation === null, complete: finalBatchComplete && continuation === null };
}

async function completeTitleHistory(workQueueEntryKey, requestedTitle) {
  const events = [];
  let continuation = {};
  let finalBatchComplete = false;
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', list: 'logevents', letitle: requestedTitle,
      leprop: 'ids|title|type|user|timestamp|comment|details', lelimit: 'max', ...continuation
    });
    const response = await fetchJson(`${WIKI_API}?${params}`);
    events.push(...(response.query?.logevents || []));
    finalBatchComplete = response.batchcomplete === true;
    continuation = response.continue || null;
    if (continuation) await new Promise(resolve => setTimeout(resolve, 150));
  } while (continuation);
  return { workQueueEntryKey, requestedTitle, events, continuationExhausted: continuation === null, complete: finalBatchComplete && continuation === null };
}

const input = await latestInputSnapshot();
const revisionIds = [...new Set(input.rows.flatMap(record => (record.resolutionEvidence?.pinnedGuideEvidence || [])
  .map(item => item.pinnedGuideSourceIdentity?.sourceRevision)).filter(Boolean).map(String))].sort((left, right) => Number(left) - Number(right));
const pinnedRevisionPages = await exactRevisionPages(revisionIds);
const namespaceMetadata = await officialCategoryNamespaceMetadata();
const exactCurrentCategoryResults = [];
const categoryPrefixResults = [];
const categoryMemberResults = [];
const namespaceSearchResults = [];
const titleHistoryResults = [];
for (const record of input.rows) {
  const requestedTitle = record.requestedTitles[0];
  exactCurrentCategoryResults.push(await exactCurrentCategory(record.workQueueEntryKey, requestedTitle));
  categoryPrefixResults.push(await completeCategoryPrefix(record.workQueueEntryKey, requestedTitle));
  categoryMemberResults.push(await completeCategoryMembers(record.workQueueEntryKey, requestedTitle));
  const queries = [];
  for (const definition of deriveUnresolvedRenderedTargetCategorySearchQueries(requestedTitle, policy)) queries.push(await completeNamespaceSearch(definition));
  namespaceSearchResults.push({ workQueueEntryKey: record.workQueueEntryKey, requestedTitle, queries });
  titleHistoryResults.push(await completeTitleHistory(record.workQueueEntryKey, requestedTitle));
  await new Promise(resolve => setTimeout(resolve, 200));
}
const categoryMemberSourceResolutions = [];
for (const result of categoryMemberResults) {
  const titles = [...new Set(result.members.map(member => member.title))].sort((left, right) => left.localeCompare(right));
  categoryMemberSourceResolutions.push({
    workQueueEntryKey: result.workQueueEntryKey,
    resolutions: titles.length ? await wikiRevisionResolutions(titles) : []
  });
}

const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery({
  workQueueRecords: input.rows,
  pinnedRevisionPages,
  namespaceMetadata,
  exactCurrentCategoryResults,
  categoryPrefixResults,
  categoryMemberResults,
  categoryMemberSourceResolutions,
  namespaceSearchResults,
  titleHistoryResults,
  policy,
  sourceQueueSnapshotContentHash: input.manifest.contentHash,
  contentHash: hash
});
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'namespace_aware_official_wiki_category_resolution_evidence_without_resolution_or_semantic_promotion',
  api: WIKI_API,
  fetchMode: 'exact pinned guide revisions, current category namespace metadata, exact category info, exhaustive category membership and prefix inventories, prefix-stripped namespace searches, exact title logs, and current revision source capture',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  pinnedRevisionIds: revisionIds,
  audit: built.audit
};

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, inputSnapshot, coverage: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
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
      pinnedGuideIntegrityCoverage: report.pinnedGuideIntegrityCoverage,
      namespaceMetadataCoverage: report.namespaceMetadataCoverage,
      categoryIdentityCoverage: report.categoryIdentityCoverage,
      categoryMemberCoverage: report.categoryMemberCoverage,
      categoryPrefixCoverage: report.categoryPrefixCoverage,
      namespaceSearchCoverage: report.namespaceSearchCoverage,
      titleHistoryCoverage: report.titleHistoryCoverage,
      requiredChannelCoverage: report.requiredChannelCoverage,
      semanticPreservationCoverage: report.semanticPreservationCoverage,
      evidencePacketCaptureComplete: report.evidencePacketCaptureComplete,
      resolutionEvidenceSufficiencyDispositionComplete: report.resolutionEvidenceSufficiencyDispositionComplete,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers,
      publishable: report.publishable
    }
  }, null, 2));
}
