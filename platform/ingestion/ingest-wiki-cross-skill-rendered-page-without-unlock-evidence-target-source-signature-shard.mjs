import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import { buildRenderedPageWithoutUnlockTargetSourceSignatureShard, selectRenderedPageWithoutUnlockSourceSignatureShard } from './cross-skill-rendered-page-without-unlock-evidence-target-source-signature-lib.mjs';

const root = path.resolve(process.argv.find(value => value.startsWith('--root='))?.slice(7) || '.platform-data');
const startOrdinal = Number(process.argv.find(value => value.startsWith('--start='))?.slice(8) || 1);
const limit = Number(process.argv.find(value => value.startsWith('--limit='))?.slice(8) || 250);
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-target-source-signature-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard';

async function latestQueueSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${inputDomain}.ndjson`), 'utf8');
      const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const audit = manifest.source?.audit || {};
      if (manifest.domain !== inputDomain || manifest.records !== records.length || manifest.contentHash !== hash(raw) || !records.length ||
        audit.queueExportComplete !== true || audit.publishable !== true || audit.reconciliationComplete !== false || audit.completeActivityUniverse !== false ||
        audit.queueCoverage?.outputRecordCount !== records.length || audit.queueCoverage?.missingOutputPartitionKeys?.length || audit.queueCoverage?.unexpectedOutputPartitionKeys?.length ||
        audit.semanticPreservationCoverage?.unsupportedPromotionPartitionKeys?.length) continue;
      return { directory, records, manifest };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('No valid rendered-page/no-unlock reconciliation work-queue snapshot exists.');
}

async function exactRevisionPages(revisionIds) {
  const pages = [];
  for (let index = 0; index < revisionIds.length; index += 20) {
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', revids: revisionIds.slice(index, index + 20).join('|') });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return pages;
}

const queue = await latestQueueSnapshot();
const selected = selectRenderedPageWithoutUnlockSourceSignatureShard(queue.records, { startOrdinal, limit, maximumShardSize: policy.maximumShardSize });
if (!selected.length) throw new Error('Requested queue shard is empty.');
const revisionIds = selected.map(row => String(row.stableWikiPageIdentity.sourceRevision));
const fetchedPages = await exactRevisionPages(revisionIds);
const built = buildRenderedPageWithoutUnlockTargetSourceSignatureShard({ queueRecords: queue.records, fetchedPages, policy, queueSnapshotContentHash: queue.manifest.contentHash, startOrdinal, limit, contentHash: hash });
const inputQueueSnapshot = { directory: queue.directory, contentHash: queue.manifest.contentHash };
const source = {
  kind: 'revision_pinned_target_source_signature_shard_without_semantic_or_optimizer_promotion', api: WIKI_API,
  fetchMode: 'exact queue-bound revision IDs', shard: { startOrdinal, requestedLimit: limit },
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) }, inputQueueSnapshot,
  fetchedRevisions: fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({ pageId: page.pageid, namespaceId: page.ns, title: page.title, revision: String(revision.revid), timestamp: revision.timestamp, contentHash: hash(revision.slots?.main?.content || '') }))),
  audit: built.audit
};

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputQueueSnapshot, coverage: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = { ...built.audit, generatedAt, policy: source.policy, inputQueueSnapshot, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
  report.contentHash = hash(Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'contentHash')));
  const output = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ contract: report.contract, accepted: true, inputQueueSnapshot, outputSnapshot: report.outputSnapshot, reportDirectory: output, coverage: report }, null, 2));
}
