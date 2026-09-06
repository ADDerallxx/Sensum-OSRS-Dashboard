import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisions } from './activity-evidence-lib.mjs';
import { buildAgilityColossalWyrmBasicLapXpConflictReconciliation } from './agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const temporalArgument = argument('temporal-reconciliation-snapshot');
const obstacleArgument = argument('obstacle-variant-snapshot');
if (!temporalArgument) throw new Error('An explicit --temporal-reconciliation-snapshot=<directory> is required.');
if (!obstacleArgument) throw new Error('An explicit --obstacle-variant-snapshot=<directory> is required.');

const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation-v1.json');
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

async function explicitSnapshot(directoryArgument, domain) {
  const directory = path.resolve(directoryArgument);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const file = path.join(directory, `${domain}.ndjson`);
  const raw = await fs.readFile(file, 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const failures = [];
  if (manifest.contract !== 'sensum.ingestion-manifest.v1') failures.push('manifest_contract_mismatch');
  if (manifest.domain !== domain) failures.push('manifest_domain_mismatch');
  if (manifest.source?.audit?.publishable !== true) failures.push('source_audit_not_publishable');
  if (manifest.records !== records.length) failures.push('record_count_mismatch');
  if (manifest.contentHash !== hash(raw)) failures.push('content_hash_mismatch');
  if (failures.length) throw new Error(`Invalid explicit ${domain} snapshot: ${failures.join(', ')}`);
  return {
    directory: path.basename(directory),
    absoluteDirectory: directory,
    contentHash: manifest.contentHash,
    records: manifest.records,
    rows: records,
    manifest
  };
}

async function revisionChain() {
  const revisions = [];
  let continuation = null;
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'revisions', titles: policy.courseTitle,
      rvprop: 'ids|timestamp|comment|content', rvslots: 'main', rvlimit: 'max',
      rvstartid: policy.revisionAnchors.currentCourseRevision,
      rvendid: policy.revisionAnchors.lastConfirmedPreUpdateRevision
    });
    if (continuation) params.set('rvcontinue', continuation);
    const data = await fetchJson(`${WIKI_API}?${params}`);
    revisions.push(...(data.query?.pages?.[0]?.revisions || []).map(revision => ({
      revid: String(revision.revid || ''),
      parentid: String(revision.parentid || ''),
      timestamp: revision.timestamp || null,
      comment: typeof revision.comment === 'string' ? revision.comment : '',
      content: revision.slots?.main?.content || ''
    })));
    continuation = data.continue?.rvcontinue || null;
  } while (continuation);
  return revisions;
}

const [temporal, obstacle, currentPages, chain] = await Promise.all([
  explicitSnapshot(temporalArgument, policy.inputTemporalReconciliationDomain),
  explicitSnapshot(obstacleArgument, policy.inputObstacleVariantDomain),
  wikiRevisions([policy.courseTitle, policy.updateTitle]).then(pages => pages.map(currentPage)),
  revisionChain()
]);
const currentCourse = currentPages.find(page => page.title === policy.courseTitle);
const officialUpdate = currentPages.find(page => page.title === policy.updateTitle);
const temporalSnapshot = { directory: temporal.directory, contentHash: temporal.contentHash, records: temporal.records };
const obstacleSnapshot = { directory: obstacle.directory, contentHash: obstacle.contentHash, records: obstacle.records };
const built = buildAgilityColossalWyrmBasicLapXpConflictReconciliation({
  currentCourse,
  officialUpdate,
  revisionChain: chain,
  inputTemporalReconciliationRecords: temporal.rows,
  inputTemporalReconciliationSnapshot: temporalSnapshot,
  inputObstacleVariantRecords: obstacle.rows,
  inputObstacleVariantSnapshot: obstacleSnapshot,
  policy,
  contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
const sourceBindings = {
  currentCourse: { title: currentCourse?.title, revision: currentCourse?.sourceRevision, timestamp: currentCourse?.sourceTimestamp, url: currentCourse?.sourceUrl },
  officialUpdate: { title: officialUpdate?.title, revision: officialUpdate?.sourceRevision, timestamp: officialUpdate?.sourceTimestamp, url: officialUpdate?.sourceUrl },
  revisionChain: {
    currentRevision: chain[0]?.revid || null,
    endRevision: chain.at(-1)?.revid || null,
    revisionCount: chain.length,
    contentHash: hash(chain.map(revision => ({ revid: revision.revid, parentid: revision.parentid, timestamp: revision.timestamp, comment: revision.comment, contentHash: hash(revision.content) })))
  }
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'revision_pinned_colossal_wyrm_basic_lap_xp_conflict_timeline',
    api: WIKI_API,
    scope: 'exact contiguous course-revision timeline for Basic prose lap XP versus eight-row obstacle sum; unresolved conflict retained; no inferred exact XP or optimizer promotion',
    sourceBindings,
    inputTemporalReconciliation: temporalSnapshot,
    inputObstacleVariantReconciliation: obstacleSnapshot,
    policy: policyBinding,
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
}
const reportBase = {
  ...built.audit,
  generatedAt,
  policy: policyBinding,
  sourceBindings,
  inputTemporalReconciliation: temporalSnapshot,
  inputObstacleVariantReconciliation: obstacleSnapshot,
  outputSnapshot
};
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
