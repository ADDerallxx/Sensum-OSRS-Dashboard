import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import { buildAgilityOpenBlockerSourceRevisionReconciliation } from './agility-open-blocker-source-revision-reconciliation-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const snapshotArgument = process.argv.find(argument => argument.startsWith('--monitor-snapshot='))?.slice('--monitor-snapshot='.length);
if (!snapshotArgument) throw new Error('Provide --monitor-snapshot=<exact snapshot directory>.');
const snapshotDirectory = path.resolve(snapshotArgument);
const policy = JSON.parse(await fs.readFile(path.resolve('platform/policies/agility-open-blocker-source-revision-reconciliation-v1.json'), 'utf8'));
const dataFile = path.join(snapshotDirectory, `${policy.inputDomain}.ndjson`);
const raw = await fs.readFile(dataFile, 'utf8');
const monitorRecords = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const manifest = JSON.parse(await fs.readFile(path.join(snapshotDirectory, 'manifest.json'), 'utf8'));
const manifestErrors = [];
if (manifest.domain !== policy.inputDomain) manifestErrors.push('manifest_domain_mismatch');
if (manifest.records !== monitorRecords.length) manifestErrors.push('manifest_record_count_mismatch');
if (manifest.contentHash !== hash(raw)) manifestErrors.push('manifest_content_hash_mismatch');
if (manifest.source?.audit?.publishable !== true || manifest.source?.audit?.sourceRevisionMonitoringComplete !== true) manifestErrors.push('input_monitor_not_publishable_or_complete');
if (manifestErrors.length) throw new Error(`Invalid monitor snapshot: ${manifestErrors.join(', ')}`);

async function fetchExactRevisionPages(revisionIds) {
  const pages = [];
  for (let index = 0; index < revisionIds.length; index += 20) {
    const batch = revisionIds.slice(index, index + 20);
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'ids|timestamp|content|user|comment', rvslots: 'main', revids: batch.join('|') });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return pages;
}

const selected = monitorRecords.filter(record => record.reauditRequired === true);
const revisionIds = [...new Set(selected.flatMap(record => [record.pinnedSource?.sourceRevision, record.currentHead?.revision]).filter(Boolean).map(String))];
const exactRevisionPages = await fetchExactRevisionPages(revisionIds);
const inputBinding = { directory: path.basename(snapshotDirectory), contentHash: manifest.contentHash, domain: manifest.domain };
const built = buildAgilityOpenBlockerSourceRevisionReconciliation({ monitorRecords, exactRevisionPages, policy, inputBinding, contentHash: hash });
const generatedAt = new Date().toISOString();
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, 'agility-open-blocker-source-revision-reconciliation', built.records, {
    kind: 'revision_pinned_open_agility_blocker_source_revision_reconciliation',
    api: WIKI_API,
    fetchMode: 'exact pinned and current revision content',
    inputMonitor: inputBinding,
    policy: { file: 'platform/policies/agility-open-blocker-source-revision-reconciliation-v1.json', id: policy.policy, contentHash: hash(policy) },
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
}
const report = {
  ...built.audit,
  generatedAt,
  policy: { file: 'platform/policies/agility-open-blocker-source-revision-reconciliation-v1.json', id: policy.policy, contentHash: hash(policy) },
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, 'agility-open-blocker-source-revision-reconciliation-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputMonitor: report.inputMonitor,
  sourceCoverage: report.sourceCoverage,
  contentStates: report.contentStates,
  blockerPreservation: report.blockerPreservation,
  revisionReconciliationComplete: report.revisionReconciliationComplete,
  allRevisionDriftAlertsResolved: report.allRevisionDriftAlertsResolved,
  semanticReauditRequired: report.semanticReauditRequired,
  conditionOrMechanicsCoverageComplete: report.conditionOrMechanicsCoverageComplete,
  absoluteBestGate: report.absoluteBestGate,
  outputSnapshot,
  blockers: report.blockers,
  publishable: report.publishable
}, null, 2));
if (!report.publishable) process.exitCode = 2;
