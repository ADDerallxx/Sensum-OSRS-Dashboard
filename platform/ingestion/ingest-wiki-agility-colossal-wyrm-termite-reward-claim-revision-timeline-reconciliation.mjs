import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildAgilityColossalWyrmRewardClaimTimeline,
  normalizeRevisionId
} from './agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const discoveryAuditArgument = argument('discovery-audit');
const discoverySnapshotArgument = argument('discovery-snapshot');
if (!discoveryAuditArgument) throw new Error('An explicit --discovery-audit=<report.json> is required.');
if (!discoverySnapshotArgument) throw new Error('An explicit --discovery-snapshot=<directory> is required.');

const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-claim-revision-timeline-reconciliation-v1.json');
const inputPolicyFile = path.resolve('platform/policies/agility-colossal-wyrm-termite-reward-rate-source-discovery-v1.json');
const [policy, inputPolicy] = await Promise.all([
  fs.readFile(policyFile, 'utf8').then(JSON.parse),
  fs.readFile(inputPolicyFile, 'utf8').then(JSON.parse)
]);
const discoveryAuditFile = path.resolve(discoveryAuditArgument);
const discoveryAudit = JSON.parse(await fs.readFile(discoveryAuditFile, 'utf8'));
const discoverySnapshotDirectory = path.resolve(discoverySnapshotArgument);
const discoveryManifest = JSON.parse(await fs.readFile(path.join(discoverySnapshotDirectory, 'manifest.json'), 'utf8'));
discoveryManifest.snapshotDirectory = path.basename(discoverySnapshotDirectory);
const discoveryRaw = await fs.readFile(path.join(discoverySnapshotDirectory, `${policy.inputSnapshotDomain}.ndjson`), 'utf8');
const discoveryRecords = discoveryRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

async function fetchRevisionHistory(source) {
  const revisions = [];
  let continuation = null;
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'revisions', pageids: String(source.pageId),
      rvprop: 'ids|timestamp|comment|content', rvslots: 'main', rvlimit: 'max', rvstartid: source.currentRevision
    });
    if (continuation) params.set('rvcontinue', continuation);
    const data = await fetchJson(`${WIKI_API}?${params}`);
    const page = data.query?.pages?.[0];
    if (Number(page?.pageid) !== source.pageId || page?.title !== source.title) {
      throw new Error(`Revision-history identity mismatch for ${source.sourceKey}.`);
    }
    revisions.push(...(page.revisions || []).map(revision => ({
      revid: normalizeRevisionId(revision.revid), parentid: normalizeRevisionId(revision.parentid),
      timestamp: revision.timestamp || null,
      comment: typeof revision.comment === 'string' ? revision.comment : '',
      content: revision.slots?.main?.content || ''
    })));
    continuation = data.continue?.rvcontinue || null;
    if (continuation) await new Promise(resolve => setTimeout(resolve, 250));
  } while (continuation);
  return { sourceKey: source.sourceKey, title: source.title, pageId: source.pageId, paginationComplete: true, revisions };
}

const sourceHistories = [];
for (const source of policy.sourcePages) {
  sourceHistories.push(await fetchRevisionHistory(source));
  await new Promise(resolve => setTimeout(resolve, 200));
}

const built = buildAgilityColossalWyrmRewardClaimTimeline({
  discoveryAudit, discoveryManifest, discoveryRecords, inputPolicy, sourceHistories, policy, contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
const inputBinding = {
  audit: { file: discoveryAuditFile, contract: discoveryAudit.contract, contentHash: discoveryAudit.contentHash },
  snapshot: {
    directory: discoveryManifest.snapshotDirectory, domain: discoveryManifest.domain,
    contentHash: discoveryManifest.contentHash, records: discoveryManifest.records
  },
  policy: {
    file: path.relative(process.cwd(), inputPolicyFile).replaceAll('\\', '/'),
    id: inputPolicy.policy, contentHash: hash(inputPolicy)
  }
};
const sourceBindings = sourceHistories.map(history => ({
  sourceKey: history.sourceKey, title: history.title, pageId: history.pageId,
  currentRevision: history.revisions[0]?.revid || null,
  creationRevision: history.revisions.at(-1)?.revid || null,
  oldestVisibleParentRevision: history.revisions.at(-1)?.parentid || null,
  pageCreationReached: String(history.revisions.at(-1)?.parentid || '') === '0',
  apiPaginationComplete: history.paginationComplete === true,
  revisionCount: history.revisions.length,
  contentHash: hash(history.revisions.map(revision => ({
    revid: revision.revid, parentid: revision.parentid, timestamp: revision.timestamp,
    comment: revision.comment, contentHash: hash(revision.content)
  })))
}));
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'revision_pinned_colossal_wyrm_reward_claim_timeline_reconciliation',
    api: WIKI_API,
    scope: 'complete-to-creation histories for the exact course, Talk, and official-update pages bound by discovery; 17 claims tracked independently; no arithmetic reconciliation, mechanics, or optimizer promotion',
    input: inputBinding,
    sourceBindings,
    policy: policyBinding,
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
}
const reportBase = { ...built.audit, generatedAt, policy: policyBinding, input: inputBinding, sourceBindings, outputSnapshot };
const report = { ...reportBase, contentHash: hash(reportBase) };
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
