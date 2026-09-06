import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisions } from './activity-evidence-lib.mjs';
import { buildAgilityColossalWyrmObstaclePageVariantReconciliation } from './agility-colossal-wyrm-obstacle-page-variant-reconciliation-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const reconciliationArgument = argument('reconciliation-snapshot');
if (!reconciliationArgument) throw new Error('An explicit --reconciliation-snapshot=<directory> is required.');

const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-obstacle-page-variant-reconciliation-v1.json');
const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));

function currentPage(page) {
  const revision = page?.revisions?.[0];
  return {
    title: page?.title,
    content: revision?.slots?.main?.content || '',
    sourceRevision: String(revision?.revid || ''),
    sourceTimestamp: revision?.timestamp || null,
    sourceUrl: `https://oldschool.runescape.wiki/w/${String(page?.title || '').replaceAll(' ', '_')}`
  };
}

async function exactHistoricalPages(revisionIds) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
    revids: revisionIds.join('|'), rvprop: 'ids|timestamp|content', rvslots: 'main'
  });
  const data = await fetchJson(`${WIKI_API}?${params}`);
  return (data.query?.pages || []).flatMap(page => (page.revisions || []).map(revision => ({
    title: page.title,
    content: revision.slots?.main?.content || '',
    sourceRevision: String(revision.revid || ''),
    sourceTimestamp: revision.timestamp || null,
    sourceUrl: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision.revid}`
  })));
}

async function explicitReconciliationSnapshot(directoryArgument) {
  const directory = path.resolve(directoryArgument);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const file = path.join(directory, `${policy.inputReconciliationDomain}.ndjson`);
  const raw = await fs.readFile(file, 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const failures = [];
  if (manifest.contract !== 'sensum.ingestion-manifest.v1') failures.push('manifest_contract_mismatch');
  if (manifest.domain !== policy.inputReconciliationDomain) failures.push('manifest_domain_mismatch');
  if (manifest.source?.audit?.publishable !== true) failures.push('source_audit_not_publishable');
  if (manifest.records !== records.length) failures.push('record_count_mismatch');
  if (manifest.contentHash !== hash(raw)) failures.push('content_hash_mismatch');
  if (failures.length) throw new Error(`Invalid explicit reconciliation snapshot: ${failures.join(', ')}`);
  return {
    directory: path.basename(directory),
    absoluteDirectory: directory,
    contentHash: manifest.contentHash,
    records: manifest.records,
    rows: records,
    manifest
  };
}

const input = await explicitReconciliationSnapshot(reconciliationArgument);
const currentTitles = [policy.courseTitle, ...policy.obstaclePages.map(entry => entry.title)];
const historicalRevisionIds = [
  policy.historicalCourseRevisions.lastConfirmedPreUpdateRevision,
  policy.historicalCourseRevisions.firstCompletePostUpdateTableRevision,
  ...policy.obstaclePages.map(entry => entry.preUpdateRevision)
];
const [currentPages, historicalPages] = await Promise.all([
  wikiRevisions(currentTitles).then(pages => pages.map(currentPage)),
  exactHistoricalPages(historicalRevisionIds)
]);
const inputReconciliationSnapshot = { directory: input.directory, contentHash: input.contentHash, records: input.records };
const built = buildAgilityColossalWyrmObstaclePageVariantReconciliation({
  currentPages,
  historicalPages,
  inputReconciliationRecords: input.rows,
  inputReconciliationSnapshot,
  policy,
  contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
const currentBindings = currentPages.map(page => ({ title: page.title, revision: page.sourceRevision, timestamp: page.sourceTimestamp, url: page.sourceUrl }));
const historicalBindings = historicalPages.map(page => ({ title: page.title, revision: page.sourceRevision, timestamp: page.sourceTimestamp, url: page.sourceUrl }));
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'revision_pinned_colossal_wyrm_obstacle_page_variant_reconciliation',
    api: WIKI_API,
    scope: 'exact obstacle-page version to course-row occurrence mapping and source-conflict preservation; no inferred XP, mechanical authority, optimizer eligibility, or automatic verification',
    currentPages: currentBindings,
    historicalPages: historicalBindings,
    inputTemporalReconciliation: inputReconciliationSnapshot,
    policy: policyBinding,
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
}
const reportBase = {
  ...built.audit,
  generatedAt,
  policy: policyBinding,
  currentPages: currentBindings,
  historicalPages: historicalBindings,
  inputTemporalReconciliation: inputReconciliationSnapshot,
  outputSnapshot
};
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
