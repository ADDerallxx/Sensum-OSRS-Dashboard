import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityTargetConditionGapSourceChannelCoverageSynthesis } from './agility-target-condition-gap-source-channel-coverage-synthesis-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const specifications = [
  ['current_article_search', 'article-report', 'article-snapshot'],
  ['current_source_code_search', 'source-code-report', 'source-code-snapshot'],
  ['historical_update_archive_search', 'update-report', 'update-snapshot']
];
for (const [, reportArgument, snapshotArgument] of specifications) {
  if (!argument(reportArgument)) throw new Error(`Provide --${reportArgument}=<exact report.json>.`);
  if (!argument(snapshotArgument)) throw new Error(`Provide --${snapshotArgument}=<exact snapshot directory>.`);
}

const policyFile = path.resolve('platform/policies/agility-target-condition-gap-source-channel-coverage-synthesis-v1.json');
const basePolicyFile = path.resolve('platform/policies/agility-target-condition-gap-wiki-discovery-v1.json');
const [policy, basePolicy] = await Promise.all([
  fs.readFile(policyFile, 'utf8').then(JSON.parse),
  fs.readFile(basePolicyFile, 'utf8').then(JSON.parse)
]);
const inputs = {};
const inputBindings = [];
for (const [channelKey, reportArgument, snapshotArgument] of specifications) {
  const reportFile = path.resolve(argument(reportArgument));
  const snapshotDirectory = path.resolve(argument(snapshotArgument));
  const [report, manifest] = await Promise.all([
    fs.readFile(reportFile, 'utf8').then(JSON.parse),
    fs.readFile(path.join(snapshotDirectory, 'manifest.json'), 'utf8').then(JSON.parse)
  ]);
  const rawFile = path.join(snapshotDirectory, `${manifest.domain}.ndjson`);
  const rawRecords = await fs.readFile(rawFile, 'utf8');
  inputs[channelKey] = { report, manifest, rawRecords, snapshotDirectory: path.basename(snapshotDirectory) };
  inputBindings.push({
    channelKey,
    reportFile,
    reportContentHash: report.contentHash || null,
    snapshotDirectory: path.basename(snapshotDirectory),
    snapshotContentHash: manifest.contentHash || null
  });
}

const built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis({ inputs, policy, basePolicy, contentHash: hash });
const generatedAt = new Date().toISOString();
let outputSnapshot = null;
if (built.audit.publishable) {
  const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, {
    kind: 'deterministic_fail_closed_source_channel_coverage_synthesis',
    scope: 'five level-34 Agility target-condition candidates and 17 blockers across current article, current source-code, and historical Update-archive bounded searches; not complete Wiki or game-fact absence',
    inputs: inputBindings,
    policy: {
      file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
      id: policy.policy,
      contentHash: hash(policy)
    },
    basePolicy: {
      file: path.relative(process.cwd(), basePolicyFile).replaceAll('\\', '/'),
      id: basePolicy.policy,
      contentHash: hash(basePolicy)
    },
    audit: built.audit
  });
  outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
}
const report = {
  ...built.audit,
  generatedAt,
  policy: {
    file: path.relative(process.cwd(), policyFile).replaceAll('\\', '/'),
    id: policy.policy,
    contentHash: hash(policy)
  },
  basePolicy: {
    file: path.relative(process.cwd(), basePolicyFile).replaceAll('\\', '/'),
    id: basePolicy.policy,
    contentHash: hash(basePolicy)
  },
  inputs: inputBindings,
  outputSnapshot
};
report.contentHash = hash({ ...report, contentHash: undefined });
const reportDir = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportDir, outputSnapshot, audit: built.audit }, null, 2));
if (!built.audit.publishable) process.exitCode = 2;
