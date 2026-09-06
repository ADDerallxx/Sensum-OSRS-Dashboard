import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionMetadataResolutions } from './activity-evidence-lib.mjs';
import { buildAgilityOpenBlockerSourceRevisionMonitor, extractAgilityOpenBlockerSources } from './agility-open-blocker-source-revision-monitor-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const auditFileArgument = process.argv.find(argument => argument.startsWith('--coverage-audit='))?.slice('--coverage-audit='.length);
if (!auditFileArgument) throw new Error('Provide --coverage-audit=<exact report.json>.');
const auditFile = path.resolve(auditFileArgument);
const coverageReport = JSON.parse(await fs.readFile(auditFile, 'utf8'));
const policy = JSON.parse(await fs.readFile(path.resolve('platform/policies/agility-open-blocker-source-revision-monitor-v1.json'), 'utf8'));
const extracted = extractAgilityOpenBlockerSources(coverageReport, policy);

async function fetchExactRevisionPages(revisionIds) {
  const pages = [];
  for (let index = 0; index < revisionIds.length; index += 20) {
    const batch = revisionIds.slice(index, index + 20);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'revisions',
      rvprop: 'ids|timestamp|content',
      rvslots: 'main',
      revids: batch.join('|')
    });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return pages;
}

const [exactRevisionPages, headResolutions] = await Promise.all([
  fetchExactRevisionPages(extracted.sources.map(source => source.sourceRevision)),
  wikiRevisionMetadataResolutions(extracted.sources.map(source => source.requestedTitle))
]);
const built = buildAgilityOpenBlockerSourceRevisionMonitor({ coverageReport, exactRevisionPages, headResolutions, policy, contentHash: hash });
const generatedAt = new Date().toISOString();
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, 'agility-open-blocker-source-revision-monitor', built.records, {
    kind: 'revision_pinned_open_agility_blocker_source_revision_monitor',
    api: WIKI_API,
    fetchMode: 'exact pinned revisions plus current-head metadata',
    inputAudit: { file: auditFile, contract: coverageReport.contract, contentHash: coverageReport.contentHash },
    policy: { file: 'platform/policies/agility-open-blocker-source-revision-monitor-v1.json', id: policy.policy, contentHash: hash(policy) },
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
}
const report = {
  ...built.audit,
  generatedAt,
  policy: { file: 'platform/policies/agility-open-blocker-source-revision-monitor-v1.json', id: policy.policy, contentHash: hash(policy) },
  inputAuditFile: auditFile,
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, 'agility-open-blocker-source-revision-monitor-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputAudit: report.inputAudit,
  candidateCoverage: report.candidateCoverage,
  sourceCoverage: report.sourceCoverage,
  revisionStates: report.revisionStates,
  blockerPreservation: report.blockerPreservation,
  sourceRevisionMonitoringComplete: report.sourceRevisionMonitoringComplete,
  sourceSetCurrent: report.sourceSetCurrent,
  conditionOrMechanicsCoverageComplete: report.conditionOrMechanicsCoverageComplete,
  absoluteBestGate: report.absoluteBestGate,
  outputSnapshot,
  blockers: report.blockers,
  publishable: report.publishable
}, null, 2));
if (!report.publishable) process.exitCode = 2;
