import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildWeightedParentTaskEntryMembershipEvidence,
  discoverWeightedParentTaskEntryMembershipExactRevisionRequests
} from './weighted-parent-task-entry-membership-evidence-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/weighted-parent-task-entry-membership-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'structural-member-candidate-review-ready-identity-and-remaining-gap-work-routing';
const outputDomain = 'weighted-parent-task-entry-membership-evidence';

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
      if (audit.routingCoverageComplete !== true || audit.evidenceWorkComplete !== false
        || audit.completeActivityUniverse !== false || audit.publishable !== true
        || audit.routingCoverage?.weightedMembershipWorkItemCount < 1) reasons.push('weighted_membership_route_not_publishable_or_empty');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) {
        reasons.push('unexpected_or_empty_input_contract_or_state');
      }
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, raw, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid weighted parent-task membership routing snapshot exists.');
}

async function exactRevisionPages(revisionIds) {
  const pages = [];
  for (let index = 0; index < revisionIds.length; index += 20) {
    const batch = revisionIds.slice(index, index + 20);
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
      rvprop: 'ids|timestamp|content', rvslots: 'main', revids: batch.join('|')
    });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return pages;
}

const input = await latestInputSnapshot();
const revisionRequests = discoverWeightedParentTaskEntryMembershipExactRevisionRequests(input.rows, policy);
const fetchedPages = await exactRevisionPages(revisionRequests.map(request => request.sourceRevision));
const built = buildWeightedParentTaskEntryMembershipEvidence({ routingRecords: input.rows, fetchedPages, policy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const fetchedRevisions = fetchedPages.flatMap(page => (page.revisions || []).map(revision => ({
  pageId: page.pageid,
  title: page.title,
  revision: String(revision.revid),
  timestamp: revision.timestamp,
  contentHash: hash(revision.slots?.main?.content || ''),
  sourceContentBytes: Buffer.byteLength(revision.slots?.main?.content || '', 'utf8')
})));

if (!built.audit.publishable) {
  console.log(JSON.stringify({
    contract: built.audit.contract,
    accepted: false,
    inputSnapshot,
    revisionRequests,
    fetchedRevisions,
    audit: built.audit,
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'revision_pinned_weighted_parent_task_entry_membership_evidence_capture_without_semantic_membership_or_optimizer_promotion',
    api: WIKI_API,
    fetchMode: 'all routed parent and candidate source keys refetched by exact revision ID with page, title, timestamp, URL, byte-count, text, and content-hash alignment',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    inputSnapshot,
    revisionRequests,
    fetchedRevisions,
    audit: built.audit
  };
  const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = {
    ...built.audit,
    generatedAt,
    policy: source.policy,
    inputSnapshot,
    fetchedRevisions,
    outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
  };
  report.contentHash = hash({ ...report, contentHash: undefined });
  const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    contract: report.contract,
    accepted: true,
    inputSnapshot,
    outputSnapshot: report.outputSnapshot,
    policy: report.policy,
    fetchedRevisions: report.fetchedRevisions,
    coverage: {
      inputCoverage: report.inputCoverage,
      revisionCoverage: report.revisionCoverage,
      packetCoverage: report.packetCoverage,
      observationCoverage: report.observationCoverage,
      semanticPreservationCoverage: report.semanticPreservationCoverage,
      evidencePacketCaptureComplete: report.evidencePacketCaptureComplete,
      weightedMembershipReviewComplete: report.weightedMembershipReviewComplete,
      completeActivityUniverse: report.completeActivityUniverse,
      absoluteBestGate: report.absoluteBestGate,
      blockers: report.blockers,
      publishable: report.publishable
    }
  }, null, 2));
}
