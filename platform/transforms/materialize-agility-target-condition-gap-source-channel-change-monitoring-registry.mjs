import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry } from './agility-target-condition-gap-source-channel-change-monitoring-registry-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
for (const name of ['synthesis-report', 'synthesis-snapshot', 'article-report', 'article-snapshot', 'source-code-report', 'source-code-snapshot', 'update-report', 'update-snapshot']) {
  if (!argument(name)) throw new Error(`Provide --${name}=<exact ${name.endsWith('report') ? 'report.json' : 'snapshot directory'}>.`);
}

async function loadSnapshot(directoryArgument) {
  const directory = path.resolve(directoryArgument);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const raw = await fs.readFile(path.join(directory, `${manifest.domain}.ndjson`), 'utf8');
  return { directory, manifest, rawRecords: raw };
}

const policyFile = path.resolve('platform/policies/agility-target-condition-gap-source-channel-change-monitoring-registry-v1.json');
const synthesisPolicyFile = path.resolve('platform/policies/agility-target-condition-gap-source-channel-coverage-synthesis-v1.json');
const basePolicyFile = path.resolve('platform/policies/agility-target-condition-gap-wiki-discovery-v1.json');
const [policy, synthesisPolicy, basePolicy] = await Promise.all([
  fs.readFile(policyFile, 'utf8').then(JSON.parse),
  fs.readFile(synthesisPolicyFile, 'utf8').then(JSON.parse),
  fs.readFile(basePolicyFile, 'utf8').then(JSON.parse)
]);
const synthesisReportFile = path.resolve(argument('synthesis-report'));
const [synthesisReport, synthesisSnapshot] = await Promise.all([
  fs.readFile(synthesisReportFile, 'utf8').then(JSON.parse),
  loadSnapshot(argument('synthesis-snapshot'))
]);
const sourceSpecifications = [
  ['current_article_search', 'article-report', 'article-snapshot'],
  ['current_source_code_search', 'source-code-report', 'source-code-snapshot'],
  ['historical_update_archive_search', 'update-report', 'update-snapshot']
];
const sourceInputs = {};
const upstreamBindings = [];
for (const [channelKey, reportArgument, snapshotArgument] of sourceSpecifications) {
  const reportFile = path.resolve(argument(reportArgument));
  const [report, snapshot] = await Promise.all([
    fs.readFile(reportFile, 'utf8').then(JSON.parse),
    loadSnapshot(argument(snapshotArgument))
  ]);
  sourceInputs[channelKey] = {
    report,
    manifest: snapshot.manifest,
    rawRecords: snapshot.rawRecords,
    snapshotDirectory: path.basename(snapshot.directory)
  };
  upstreamBindings.push({
    channelKey,
    reportFile,
    reportContentHash: report.contentHash || null,
    snapshotDirectory: path.basename(snapshot.directory),
    snapshotContentHash: snapshot.manifest.contentHash || null
  });
}

const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry({
  synthesisReport,
  synthesisManifest: synthesisSnapshot.manifest,
  synthesisRaw: synthesisSnapshot.rawRecords,
  synthesisSnapshotDirectory: path.basename(synthesisSnapshot.directory),
  sourceInputs,
  synthesisPolicy,
  basePolicy,
  policy,
  contentHash: hash
});
const generatedAt = new Date().toISOString();
const policyBinding = {
  file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
  id: policy.policy,
  contentHash: hash(policy)
};
const synthesisBinding = {
  reportFile: synthesisReportFile,
  reportContentHash: synthesisReport.contentHash || null,
  snapshotDirectory: path.basename(synthesisSnapshot.directory),
  snapshotContentHash: synthesisSnapshot.manifest.contentHash || null,
  policy: {
    file: path.relative(process.cwd(), synthesisPolicyFile).replaceAll('\\', '/'),
    id: synthesisPolicy.policy,
    contentHash: hash(synthesisPolicy)
  },
  basePolicy: {
    file: path.relative(process.cwd(), basePolicyFile).replaceAll('\\', '/'),
    id: basePolicy.policy,
    contentHash: hash(basePolicy)
  }
};
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'deterministic_fail_closed_source_channel_change_monitoring_registry',
    scope: 'seventeen open level-34 Agility target-condition blocker domains; baseline registry only, not a source refresh or game-fact decision',
    policy: policyBinding,
    inputSynthesis: synthesisBinding,
    upstreamInputs: upstreamBindings,
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
}
const report = {
  ...built.audit,
  generatedAt,
  policy: policyBinding,
  inputSynthesis: synthesisBinding,
  upstreamInputs: upstreamBindings,
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
