import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance } from './activity-candidate-priority-source-conflict-augmented-human-review-guidance-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const packetDirectory = argument('packet-snapshot');
const guidanceDirectory = argument('guidance-snapshot');
const additionalEvidenceDirectory = argument('additional-evidence-snapshot');
const policyFile = 'platform/policies/activity-candidate-priority-source-conflict-augmented-human-review-guidance-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const guidancePolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-guidance-v1.json';
const additionalEvidencePolicyFile = 'platform/policies/activity-candidate-priority-source-conflict-additional-evidence-v1.json';
const decisionPolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-v1.json';
const rejectionContract = 'sensum.activity-candidate-priority-source-conflict-augmented-human-review-guidance-audit.v1';

function rejection(reason, error = null) {
  console.log(JSON.stringify({
    contract: rejectionContract,
    accepted: false,
    reason,
    ...(error ? { error } : {}),
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
}

async function readSnapshot(directory, domain) {
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  const snapshot = {
    directory,
    contentHash: manifest.contentHash,
    createdAt: manifest.createdAt,
    explicit: true
  };
  return { raw, records, manifest, snapshot };
}

if (!packetDirectory || !guidanceDirectory || !additionalEvidenceDirectory) {
  rejection('--packet-snapshot=<directory>, --guidance-snapshot=<directory>, and --additional-evidence-snapshot=<directory> are required. No input is selected automatically.');
} else {
  try {
    const [policy, packetPolicy, guidancePolicy, additionalEvidencePolicy, decisionPolicy] = await Promise.all([
      fs.readFile(path.resolve(policyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(guidancePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(additionalEvidencePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8').then(JSON.parse)
    ]);
    const [packet, guidance, additionalEvidence] = await Promise.all([
      readSnapshot(packetDirectory, policy.inputPacketDomain),
      readSnapshot(guidanceDirectory, policy.inputGuidanceDomain),
      readSnapshot(additionalEvidenceDirectory, policy.inputAdditionalEvidenceDomain)
    ]);
    const built = buildActivityCandidatePrioritySourceConflictAugmentedHumanReviewGuidance({
      packetRecords: packet.records,
      packetRaw: packet.raw,
      packetManifest: packet.manifest,
      packetSnapshot: packet.snapshot,
      guidanceRecords: guidance.records,
      guidanceRaw: guidance.raw,
      guidanceManifest: guidance.manifest,
      guidanceSnapshot: guidance.snapshot,
      additionalEvidenceRecords: additionalEvidence.records,
      additionalEvidenceRaw: additionalEvidence.raw,
      additionalEvidenceManifest: additionalEvidence.manifest,
      additionalEvidenceSnapshot: additionalEvidence.snapshot,
      policy,
      packetPolicy,
      guidancePolicy,
      additionalEvidencePolicy,
      decisionPolicy,
      contentHash: hash
    });
    const inputSnapshots = {
      packet: { directory: packetDirectory, contentHash: packet.manifest.contentHash, createdAt: packet.manifest.createdAt },
      guidance: { directory: guidanceDirectory, contentHash: guidance.manifest.contentHash, createdAt: guidance.manifest.createdAt },
      additionalEvidence: { directory: additionalEvidenceDirectory, contentHash: additionalEvidence.manifest.contentHash, createdAt: additionalEvidence.manifest.createdAt }
    };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({
        contract: built.audit.contract,
        accepted: false,
        inputSnapshots,
        audit: built.audit,
        outputWritten: false
      }, null, 2));
      process.exitCode = 2;
    } else {
      const policyBinding = (id, file, value) => ({ id, file, contentHash: hash(value) });
      const source = {
        kind: 'deterministic_revision_bound_source_conflict_augmented_human_review_guidance_without_decision_or_semantic_optimizer_promotion',
        policy: policyBinding(policy.policy, policyFile, policy),
        inputPacketPolicy: policyBinding(packetPolicy.policy, packetPolicyFile, packetPolicy),
        inputGuidancePolicy: policyBinding(guidancePolicy.policy, guidancePolicyFile, guidancePolicy),
        inputAdditionalEvidencePolicy: policyBinding(additionalEvidencePolicy.policy, additionalEvidencePolicyFile, additionalEvidencePolicy),
        inputDecisionImportPolicy: policyBinding(decisionPolicy.policy, decisionPolicyFile, decisionPolicy),
        inputSnapshots,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      await Promise.all([
        fs.writeFile(path.join(snapshot.dir, 'augmented-guidance.md'), built.artifacts.markdown),
        fs.writeFile(path.join(snapshot.dir, 'augmented-guidance.json'), built.artifacts.machineJson),
        fs.writeFile(path.join(snapshot.dir, 'decisions.ndjson'), built.artifacts.blankDecisionNdjson),
        fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson)
      ]);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
      const artifactSummary = {
        artifactCount: built.artifacts.artifactManifest.artifacts.length + 1,
        artifacts: [
          ...built.artifacts.artifactManifest.artifacts,
          {
            file: 'artifact-manifest.json',
            kind: 'content_addressed_artifact_manifest',
            contentHash: hash(built.artifacts.artifactManifestJson),
            bytes: Buffer.byteLength(built.artifacts.artifactManifestJson, 'utf8')
          }
        ]
      };
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        inputPacketPolicy: source.inputPacketPolicy,
        inputGuidancePolicy: source.inputGuidancePolicy,
        inputAdditionalEvidencePolicy: source.inputAdditionalEvidencePolicy,
        inputDecisionImportPolicy: source.inputDecisionImportPolicy,
        inputSnapshots,
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
        inputSnapshots,
        outputSnapshot,
        artifacts: artifactSummary,
        reportDirectory,
        coverage: {
          sourceConflictInputCount: report.guidanceCoverage.sourceConflictInputCount,
          augmentedGuidanceRecordCount: report.guidanceCoverage.augmentedGuidanceRecordCount,
          originalEvidenceKeyCount: report.guidanceCoverage.originalEvidenceKeyCount,
          supplementalEvidenceKeyCount: report.guidanceCoverage.supplementalEvidenceKeyCount,
          reviewPathCount: report.guidanceCoverage.reviewPathCount,
          selectedReviewPathCount: report.guidanceCoverage.selectedReviewPathCount,
          compatibilityBlockedCount: report.guidanceCoverage.compatibilityBlockedCount,
          augmentedGuidanceMaterializationComplete: report.augmentedGuidanceMaterializationComplete,
          currentDecisionImporterSupportsSupplementalEvidence: report.currentDecisionImporterSupportsSupplementalEvidence,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    rejection('Explicit packet, guidance, or additional-evidence snapshot could not be read or validated.', error.message);
  }
}
