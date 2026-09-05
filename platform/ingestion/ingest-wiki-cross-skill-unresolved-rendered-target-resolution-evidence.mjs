import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildUnresolvedRenderedTargetResolutionEvidence,
  isUnresolvedRenderedTarget
} from './cross-skill-unresolved-rendered-target-resolution-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const inputDomain = 'skill-training-guide-rendered-link';
const outputDomain = 'cross-skill-unresolved-rendered-target-resolution-evidence';
const policyFile = 'platform/policies/cross-skill-unresolved-rendered-target-resolution-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const withoutContentHash = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => key !== 'contentHash'));

async function latestSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name).sort().reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const file = path.join(root, directory, `${inputDomain}.ndjson`);
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const unresolved = rows.filter(isUnresolvedRenderedTarget);
      const unresolvedObservationCount = unresolved.reduce((sum, row) => sum + Number(row.guideObservationCount || 0), 0);
      const reasons = [];
      if (manifest.domain !== inputDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.renderedLinkObservationComplete !== true) reasons.push('rendered_link_observation_not_complete');
      if (manifest.source?.audit?.semanticPromotionCoverage?.optimizerEligibleCount !== 0) reasons.push('upstream_optimizer_promotion_present');
      if (manifest.source?.audit?.renderedLinkCoverage?.missingPageObservations !== unresolvedObservationCount) reasons.push('unresolved_observation_count_mismatch');
      if (!unresolved.length) reasons.push('no_unresolved_rendered_targets');
      if (rows.some(record => record.contract !== policy.inputContract)) reasons.push('unexpected_input_contract');
      if (rows.some(record => !record.contentHash || hash(withoutContentHash(record)) !== record.contentHash)) reasons.push('input_intrinsic_record_hash_failure');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, raw, rows, manifest, unresolved, rejections };
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
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return pages;
}

async function exactCurrentResolution(requestedTitle) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'revisions',
    rvprop: 'ids|timestamp|content', rvslots: 'main', titles: requestedTitle
  });
  const response = await fetchJson(`${WIKI_API}?${params}`);
  return { requestedTitle, complete: response.batchcomplete === true, response };
}

async function completeDiscovery(requestedTitle, namespaceIds) {
  const query = `intitle:${requestedTitle}`;
  const pages = new Map();
  for (const namespaceId of namespaceIds) {
    let continuation = {};
    do {
      const params = new URLSearchParams({
        action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrsearch: query,
        gsrnamespace: String(namespaceId), gsrlimit: 'max', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main',
        ...continuation
      });
      const response = await fetchJson(`${WIKI_API}?${params}`);
      for (const page of response.query?.pages || []) pages.set(Number(page.pageid), page);
      continuation = response.continue || null;
    } while (continuation);
  }
  return { requestedTitle, namespaceIds, query, pages: [...pages.values()], complete: true };
}

async function completeLogHistory(requestedTitle) {
  const events = [];
  let continuation = {};
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', list: 'logevents', letitle: requestedTitle,
      leprop: 'ids|title|type|user|timestamp|comment|details', lelimit: 'max', ...continuation
    });
    const response = await fetchJson(`${WIKI_API}?${params}`);
    events.push(...(response.query?.logevents || []));
    continuation = response.continue || null;
  } while (continuation);
  return { requestedTitle, events, complete: true };
}

const input = await latestSnapshot();
const guideRevisions = [...new Set(input.unresolved.flatMap(record => record.observations.map(row => String(row.guideRevision))))]
  .sort((a, b) => Number(a) - Number(b));
const titles = [...new Set(input.unresolved.flatMap(record => record.requestedTitles))].sort();
const namespacesByTitle = new Map(titles.map(title => [title, [...new Set(input.unresolved.flatMap(record =>
  record.observations.filter(row => row.requestedTitle === title).map(row => Number(row.namespaceId))))].sort((a, b) => a - b)]));

const fetchedGuides = await exactRevisionPages(guideRevisions);
const currentTitleResolutions = [];
const discoveryResults = [];
const titleLogResults = [];
for (const title of titles) {
  currentTitleResolutions.push(await exactCurrentResolution(title));
  discoveryResults.push(await completeDiscovery(title, namespacesByTitle.get(title)));
  titleLogResults.push(await completeLogHistory(title));
  await new Promise(resolve => setTimeout(resolve, 250));
}

const built = buildUnresolvedRenderedTargetResolutionEvidence({
  renderedTargets: input.rows,
  fetchedGuides,
  currentTitleResolutions,
  discoveryResults,
  titleLogResults,
  inputSnapshotContentHash: input.manifest.contentHash,
  policy,
  contentHash: hash
});
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'official_wiki_exact_current_resolution_pinned_source_context_and_source_derived_discovery_evidence',
  api: WIKI_API,
  fetchMode: 'exact retained guide revisions plus exact current title resolution, exhaustive title-derived search, and complete exact-title log history',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  fetchedGuideRevisions: fetchedGuides.flatMap(page => (page.revisions || []).map(revision => ({
    pageId: Number(page.pageid), title: page.title, revision: String(revision.revid), timestamp: revision.timestamp,
    contentHash: hash(revision.slots?.main?.content || '')
  }))),
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
      sourceGuideCoverage: report.sourceGuideCoverage,
      currentResolutionCoverage: report.currentResolutionCoverage,
      discoveryCoverage: report.discoveryCoverage,
      logHistoryCoverage: report.logHistoryCoverage,
      semanticPromotionCoverage: report.semanticPromotionCoverage,
      resolutionEvidenceCoverageComplete: report.resolutionEvidenceCoverageComplete,
      canonicalIdentityComplete: report.canonicalIdentityComplete,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers,
      publishable: report.publishable
    }
  }, null, 2));
}
