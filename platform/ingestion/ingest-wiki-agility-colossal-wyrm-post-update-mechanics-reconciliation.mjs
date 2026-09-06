import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisions } from './activity-evidence-lib.mjs';
import { buildAgilityColossalWyrmPostUpdateMechanicsReconciliation } from './agility-colossal-wyrm-post-update-mechanics-reconciliation-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = path.resolve('platform/policies/agility-colossal-wyrm-post-update-mechanics-reconciliation-v1.json');
const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));
const currentTitles = [policy.courseTitle, policy.guideTitle, policy.overviewTitle, policy.updateTitle, ...policy.obstacleTitles];

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

async function revisionChain(currentRevision, endRevision) {
  const revisions = [];
  let continuation = null;
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'revisions', titles: policy.courseTitle,
      rvprop: 'ids|timestamp|comment', rvlimit: 'max', rvstartid: String(currentRevision), rvendid: String(endRevision)
    });
    if (continuation) params.set('rvcontinue', continuation);
    const data = await fetchJson(`${WIKI_API}?${params}`);
    revisions.push(...(data.query?.pages?.[0]?.revisions || []));
    continuation = data.continue?.rvcontinue || null;
  } while (continuation);
  return revisions;
}

const currentPages = (await wikiRevisions(currentTitles)).map(currentPage);
const currentCourse = currentPages.find(page => page.title === policy.courseTitle);
const anchorRevisions = Object.values(policy.historicalAnchors);
const [historicalPages, chain] = await Promise.all([
  exactHistoricalPages(anchorRevisions),
  revisionChain(currentCourse.sourceRevision, policy.historicalAnchors.lastConfirmedPreUpdateRevision)
]);
const built = buildAgilityColossalWyrmPostUpdateMechanicsReconciliation({ currentPages, historicalPages, revisionChain: chain, policy, contentHash: hash });
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'revision_pinned_colossal_wyrm_pre_and_post_update_mechanics_reconciliation',
    api: WIKI_API,
    scope: 'basic and advanced route temporal claim assignment and contradiction audit; no inferred exact mechanics, expected rate, or optimizer promotion',
    currentPages: currentPages.map(page => ({ title: page.title, revision: page.sourceRevision, timestamp: page.sourceTimestamp, url: page.sourceUrl })),
    historicalAnchors: historicalPages.map(page => ({ title: page.title, revision: page.sourceRevision, timestamp: page.sourceTimestamp, url: page.sourceUrl })),
    revisionChain: { currentRevision: currentCourse.sourceRevision, endRevision: policy.historicalAnchors.lastConfirmedPreUpdateRevision, revisionCount: chain.length, contentHash: hash(chain) },
    policy: policyBinding,
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
}
const report = {
  ...built.audit,
  generatedAt,
  policy: policyBinding,
  currentPages: currentPages.map(page => ({ title: page.title, revision: page.sourceRevision, timestamp: page.sourceTimestamp, url: page.sourceUrl })),
  historicalAnchors: historicalPages.map(page => ({ title: page.title, revision: page.sourceRevision, timestamp: page.sourceTimestamp, url: page.sourceUrl })),
  revisionChain: { currentRevision: currentCourse.sourceRevision, endRevision: policy.historicalAnchors.lastConfirmedPreUpdateRevision, revisionCount: chain.length, contentHash: hash(chain) },
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
