import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionGuidance } from './activity-candidate-priority-human-review-decision-guidance-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const packetDirectory = argument('packet-snapshot');
const policyFile = 'platform/policies/activity-candidate-priority-human-review-decision-guidance-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const decisionPolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-v1.json';

if (!packetDirectory) {
  console.log(JSON.stringify({
    contract: 'sensum.activity-candidate-priority-human-review-decision-guidance-audit.v1',
    accepted: false,
    reason: '--packet-snapshot=<directory> is required. No packet snapshot is selected automatically.',
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
} else {
  try {
    const [policy, packetPolicy, decisionPolicy] = await Promise.all([
      fs.readFile(path.resolve(policyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8').then(JSON.parse)
    ]);
    const packetRaw = await fs.readFile(path.join(root, packetDirectory, `${policy.inputDomain}.ndjson`), 'utf8');
    const packetRecords = packetRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const packetManifest = JSON.parse(await fs.readFile(path.join(root, packetDirectory, 'manifest.json'), 'utf8'));
    const packetSnapshot = {
      directory: packetDirectory,
      contentHash: packetManifest.contentHash,
      createdAt: packetManifest.createdAt,
      explicit: true
    };
    const built = buildActivityCandidatePriorityHumanReviewDecisionGuidance({
      packetRecords, packetRaw, packetManifest, packetSnapshot,
      policy, packetPolicy, decisionPolicy, contentHash: hash
    });
    const inputSnapshot = { directory: packetDirectory, contentHash: packetManifest.contentHash, createdAt: packetManifest.createdAt };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const source = {
        kind: 'deterministic_revision_bound_priority_activity_human_decision_guidance_without_decision_or_semantic_optimizer_promotion',
        policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
        inputPacketPolicy: { id: packetPolicy.policy, file: packetPolicyFile, contentHash: hash(packetPolicy) },
        inputDecisionImportPolicy: { id: decisionPolicy.policy, file: decisionPolicyFile, contentHash: hash(decisionPolicy) },
        inputSnapshot,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      const batchDirectory = path.join(snapshot.dir, 'batches');
      await fs.mkdir(batchDirectory, { recursive: true });
      for (const artifact of built.artifacts.batches) {
        await fs.writeFile(path.join(batchDirectory, artifact.markdownFile), artifact.markdown);
        await fs.writeFile(path.join(batchDirectory, artifact.guidanceFile), artifact.guidanceJson);
        await fs.writeFile(path.join(batchDirectory, artifact.decisionFile), artifact.decisionNdjson);
      }
      await fs.writeFile(path.join(snapshot.dir, 'batch-index.tsv'), built.artifacts.batchIndexTsv);
      await fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
      const artifactSummary = {
        directory: 'batches',
        batchCount: built.artifacts.batches.length,
        batchIndex: { file: 'batch-index.tsv', contentHash: hash(built.artifacts.batchIndexTsv), bytes: Buffer.byteLength(built.artifacts.batchIndexTsv, 'utf8') },
        artifactManifest: { file: 'artifact-manifest.json', contentHash: hash(built.artifacts.artifactManifestJson), bytes: Buffer.byteLength(built.artifacts.artifactManifestJson, 'utf8') },
        aggregateBatchArtifactContentHash: hash(built.artifacts.batches.map(({ markdown, guidanceJson, decisionNdjson, ...metadata }) => ({
          ...metadata,
          markdownContentHash: hash(markdown),
          guidanceContentHash: hash(guidanceJson),
          decisionContentHash: hash(decisionNdjson)
        })))
      };
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        inputPacketPolicy: source.inputPacketPolicy,
        inputDecisionImportPolicy: source.inputDecisionImportPolicy,
        inputSnapshot,
        outputSnapshot,
        artifacts: artifactSummary
      };
      report.contentHash = hash({ ...report, contentHash: undefined });
      const reportDirectory = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(reportDirectory, { recursive: true });
      await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        inputSnapshot,
        outputSnapshot,
        artifacts: artifactSummary,
        reportDirectory,
        coverage: {
          packetRecordCount: report.packetCoverage.packetRecordCount,
          guidanceRecordCount: report.guidanceCoverage.guidanceRecordCount,
          requiredEvidenceKeyCount: report.guidanceCoverage.requiredEvidenceKeyCount,
          requiredRevisionCount: report.guidanceCoverage.requiredRevisionCount,
          evidenceDomainCount: report.guidanceCoverage.evidenceDomainCount,
          batchCount: report.artifactCoverage.batchCount,
          guidanceMaterializationComplete: report.guidanceMaterializationComplete,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    console.log(JSON.stringify({
      contract: 'sensum.activity-candidate-priority-human-review-decision-guidance-audit.v1',
      accepted: false,
      reason: 'Explicit packet snapshot could not be read or validated.',
      error: error.message,
      outputWritten: false
    }, null, 2));
    process.exitCode = 2;
  }
}
