import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from '../ingestion/lib.mjs';
import { WIKI_API } from '../ingestion/activity-evidence-lib.mjs';
import { buildAgilityTargetConditionGapDiscoveryReviewPackets } from './agility-target-condition-gap-discovery-review-packet-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const snapshotDirectory = argument('discovery-snapshot');
const policyFile = 'platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputPolicy = JSON.parse(await fs.readFile(path.resolve(policy.inputPolicyFile), 'utf8'));

async function exactRevisionPages(revisionIds) {
  const pages = [];
  for (let index = 0; index < revisionIds.length; index += 20) {
    const batch = revisionIds.slice(index, index + 20);
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', revids: batch.join('|') });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return pages;
}

function fail(message, audit = null) {
  console.log(JSON.stringify({ contract: policy.auditContract, accepted: false, error: message, audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
}

try {
  if (!snapshotDirectory) throw new Error('--discovery-snapshot=<exact snapshot directory> is required; implicit latest selection is forbidden.');
  const snapshotPath = path.join(root, snapshotDirectory);
  const discoveryRaw = await fs.readFile(path.join(snapshotPath, `${policy.inputDomain}.ndjson`), 'utf8');
  const discoveryRecords = discoveryRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const discoveryManifest = JSON.parse(await fs.readFile(path.join(snapshotPath, 'manifest.json'), 'utf8'));
  const revisionIds = sortedUnique(discoveryRecords.flatMap(record => (record.evidenceDomains || []).flatMap(domain => (domain.potentialEvidenceSignals || []).map(signal => String(signal.sourceRevision)))));
  const revisionPages = await exactRevisionPages(revisionIds);
  const inputs = { discoveryRecords, discoveryManifest, discoveryRaw, revisionPages, inputPolicy, policy, contentHash: hash };
  const built = buildAgilityTargetConditionGapDiscoveryReviewPackets(inputs);
  const inputSnapshot = { directory: snapshotDirectory, domain: discoveryManifest.domain, createdAt: discoveryManifest.createdAt, contentHash: discoveryManifest.contentHash };
  if (!built.audit.publishable) {
    fail('Review-packet materialization failed its fail-closed integrity audit.', built.audit);
  } else {
    const source = {
      kind: 'deterministic_exact_revision_target_condition_discovery_manual_review_packet_without_decision_or_semantic_promotion',
      policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
      inputPolicy: { id: inputPolicy.policy, file: policy.inputPolicyFile, contentHash: hash(inputPolicy) },
      inputSnapshot,
      exactRevisionApi: WIKI_API,
      audit: built.audit
    };
    const snapshot = await writeSnapshot(root, policy.outputDomain, built.records, source);
    await fs.writeFile(path.join(snapshot.dir, 'review-packet.md'), built.artifacts.reviewMarkdown);
    await fs.writeFile(path.join(snapshot.dir, 'decision-template.ndjson'), built.artifacts.decisionNdjson);
    await fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson);
    const generatedAt = new Date().toISOString();
    const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
    const artifacts = {
      reviewMarkdown: built.artifacts.artifactManifest.reviewMarkdown,
      decisionTemplate: built.artifacts.artifactManifest.decisionTemplate,
      artifactManifest: { file: 'artifact-manifest.json', contentHash: hash(built.artifacts.artifactManifestJson), bytes: Buffer.byteLength(built.artifacts.artifactManifestJson, 'utf8') }
    };
    const report = { ...built.audit, generatedAt, policy: source.policy, inputPolicy: source.inputPolicy, inputSnapshot, outputSnapshot, artifacts };
    report.contentHash = hash({ ...report, contentHash: undefined });
    const reportDirectory = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
    await fs.mkdir(reportDirectory, { recursive: true });
    await fs.writeFile(path.join(reportDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ contract: report.contract, accepted: true, inputSnapshot, outputSnapshot, artifacts, reportDirectory, coverage: { signalCoverage: report.signalCoverage, sourceIntegrityCoverage: report.sourceIntegrityCoverage, packetCoverage: report.packetCoverage, artifactCoverage: report.artifactCoverage, semanticPreservationCoverage: report.semanticPreservationCoverage, reviewPacketMaterializationComplete: report.reviewPacketMaterializationComplete, humanReviewComplete: report.humanReviewComplete, absoluteBestGate: report.absoluteBestGate, blockers: report.blockers } }, null, 2));
  }
} catch (error) {
  fail(error.message);
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right)));
}
