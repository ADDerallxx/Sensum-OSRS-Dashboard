import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import { fetchCurrentRevisionPages, searchAgilityGapWikiQuery } from './agility-gap-wiki-discovery-runner.mjs';
import {
  buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery,
  resolveAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy
} from './agility-target-condition-gap-update-archive-source-discovery-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const coverageArgument = argument('coverage-audit');
const sufficiencyArgument = argument('source-sufficiency-audit');
if (!coverageArgument) throw new Error('Provide --coverage-audit=<exact report.json>.');
if (!sufficiencyArgument) throw new Error('Provide --source-sufficiency-audit=<exact report.json>.');

const policyFile = path.resolve('platform/policies/agility-target-condition-gap-update-archive-source-discovery-v1.json');
const basePolicyFile = path.resolve('platform/policies/agility-target-condition-gap-wiki-discovery-v1.json');
const coverageFile = path.resolve(coverageArgument);
const sufficiencyFile = path.resolve(sufficiencyArgument);
const [policy, basePolicy, coverageReport, sourceSufficiencyReport, namespaceRegistry] = await Promise.all([
  fs.readFile(policyFile, 'utf8').then(JSON.parse),
  fs.readFile(basePolicyFile, 'utf8').then(JSON.parse),
  fs.readFile(coverageFile, 'utf8').then(JSON.parse),
  fs.readFile(sufficiencyFile, 'utf8').then(JSON.parse),
  fetchJson(`${WIKI_API}?action=query&meta=siteinfo&siprop=namespaces&format=json&formatversion=2`)
]);
const resolvedPolicy = resolveAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy(policy, basePolicy);
const searchResponses = [];
for (const query of resolvedPolicy.queries) {
  searchResponses.push(await searchAgilityGapWikiQuery(query, resolvedPolicy));
  await new Promise(resolve => setTimeout(resolve, 150));
}
const pageIds = [...new Set(searchResponses.flatMap(response => response.pages.map(page => page.pageId)))].sort((left, right) => left - right);
const revisionPages = await fetchCurrentRevisionPages(pageIds);
const built = buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery({
  coverageReport,
  sourceSufficiencyReport,
  searchResponses,
  revisionPages,
  namespaceRegistry,
  policy,
  basePolicy,
  contentHash: hash
});
const generatedAt = new Date().toISOString();
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'query_bounded_revision_pinned_official_wiki_historical_update_archive_discovery',
    api: WIKI_API,
    scope: '17 blockers across five level-34 target-condition gaps; Update namespace only; every signal historical and non-authoritative for current state until separately reconciled',
    coverageInput: { file: coverageFile, contract: coverageReport.contract, contentHash: coverageReport.contentHash },
    sourceSufficiencyInput: { file: sufficiencyFile, contract: sourceSufficiencyReport.contract, contentHash: sourceSufficiencyReport.contentHash },
    policy: { file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'), id: policy.policy, contentHash: hash(policy) },
    basePolicy: { file: path.relative(process.cwd(), basePolicyFile).replaceAll('\\', '/'), id: basePolicy.policy, contentHash: hash(basePolicy) },
    resolvedPolicyContentHash: hash(resolvedPolicy),
    namespaceRegistryContentHash: hash(namespaceRegistry),
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
}
const report = {
  ...built.audit,
  generatedAt,
  policy: { file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'), id: policy.policy, contentHash: hash(policy) },
  basePolicy: { file: path.relative(process.cwd(), basePolicyFile).replaceAll('\\', '/'), id: basePolicy.policy, contentHash: hash(basePolicy) },
  resolvedPolicyContentHash: hash(resolvedPolicy),
  namespaceRegistryContentHash: hash(namespaceRegistry),
  coverageInputFile: coverageFile,
  sourceSufficiencyInputFile: sufficiencyFile,
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
