import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionResolutions } from './activity-evidence-lib.mjs';
import {
  activityReferenceCollectionRequestedTitles,
  buildActivityReferenceCollectionMembers
} from './activity-reference-collection-member-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyPath = path.resolve('platform/policies/activity-reference-collection-member-expansion-v1.json');
const policy = JSON.parse(await fs.readFile(policyPath, 'utf8'));

async function latestRoutingSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const file = path.join(root, directory, 'activity-candidate-evidence-work-routing.ndjson');
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== 'activity-candidate-evidence-work-routing') reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.routingCoverageComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('evidence_work_routing_input_not_publishable');
      if (rows.some(record => record.contract !== 'sensum.activity-candidate-evidence-work-routing.v1')) reasons.push('unexpected_evidence_work_routing_contract');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid activity-candidate evidence-work routing snapshot exists.');
}

async function exactCollectionPage(route) {
  const url = `${WIKI_API}?action=query&format=json&formatversion=2&prop=revisions&revids=${encodeURIComponent(route.sourceRevision)}&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main`;
  const data = await fetchJson(url);
  const page = data.query?.pages?.[0] || null;
  const revision = page?.revisions?.[0] || null;
  const content = revision?.slots?.main?.content || '';
  return {
    candidateKey: route.candidateKey,
    pageId: page?.pageid ?? null,
    title: page?.title ?? null,
    revision: revision?.revid ? String(revision.revid) : null,
    timestamp: revision?.timestamp || null,
    content,
    contentHash: content ? hash(content) : null,
    apiUrl: url
  };
}

const input = await latestRoutingSnapshot();
const selectedRoutes = input.rows.filter(record => record.routingDecision?.routeKey === policy.inputRouteKey && record.routingDecision?.routeState === 'queued');
const pages = await Promise.all(selectedRoutes.map(exactCollectionPage));
const requestedTitles = activityReferenceCollectionRequestedTitles({ routes: input.rows, pages, policy });
const memberResolutions = await wikiRevisionResolutions(requestedTitles);
const built = buildActivityReferenceCollectionMembers({ routes: input.rows, pages, policy, memberResolutions });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_reference_collection_explicit_table_member_candidates',
  api: WIKI_API,
  policy: { id: policy.policy, file: 'platform/policies/activity-reference-collection-member-expansion-v1.json', contentHash: hash(policy) },
  inputSnapshot,
  collectionPages: pages.map(page => ({ candidateKey: page.candidateKey, pageId: page.pageId, title: page.title, revision: page.revision, timestamp: page.timestamp, contentHash: page.contentHash })),
  currentMemberIdentityObservationCount: memberResolutions.length,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, 'activity-reference-collection-member-candidate', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  collectionPages: source.collectionPages,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-expansion-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  collectionPages: report.collectionPages,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    sourceRevisionCoverage: report.sourceRevisionCoverage,
    sectionAndTableCoverage: report.sectionAndTableCoverage,
    memberIdentityCoverage: report.memberIdentityCoverage,
    membershipClassificationCoverage: report.membershipClassificationCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    explicitTableMemberExtractionComplete: report.explicitTableMemberExtractionComplete,
    canonicalMemberExpansionComplete: report.canonicalMemberExpansionComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
