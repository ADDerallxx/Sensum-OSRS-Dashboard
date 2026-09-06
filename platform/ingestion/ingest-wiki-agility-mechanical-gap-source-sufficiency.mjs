import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import { buildAgilityMechanicalGapSourceSufficiency } from './agility-mechanical-gap-source-sufficiency-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const auditArgument = process.argv.find(argument => argument.startsWith('--coverage-audit='))?.slice('--coverage-audit='.length);
if (!auditArgument) throw new Error('Provide --coverage-audit=<exact report.json>.');
const auditFile = path.resolve(auditArgument);
const coverageReport = JSON.parse(await fs.readFile(auditFile, 'utf8'));
const policyFile = path.resolve('platform/policies/agility-mechanical-gap-source-sufficiency-v1.json');
const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));

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

const revisionIds = [...new Set(policy.sources.map(source => String(source.revision)))];
const exactRevisionPages = await fetchExactRevisionPages(revisionIds);
const built = buildAgilityMechanicalGapSourceSufficiency({ coverageReport, exactRevisionPages, policy, contentHash: hash });
const generatedAt = new Date().toISOString();
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, 'agility-mechanical-gap-source-sufficiency', built.records, {
    kind: 'revision_bound_mechanical_gap_source_channel_sufficiency',
    api: WIKI_API,
    fetchMode: 'exact declared revisions only',
    scope: 'three level-34 mechanical-model gaps; not a complete Wiki or activity universe',
    inputAudit: { file: auditFile, contract: coverageReport.contract, contentHash: coverageReport.contentHash },
    policy: { file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'), id: policy.policy, contentHash: hash(policy) },
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
}
const report = {
  ...built.audit,
  generatedAt,
  policy: { file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'), id: policy.policy, contentHash: hash(policy) },
  inputAuditFile: auditFile,
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, 'agility-mechanical-gap-source-sufficiency-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
