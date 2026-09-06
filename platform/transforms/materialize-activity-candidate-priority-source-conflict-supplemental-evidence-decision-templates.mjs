import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterialization } from './activity-candidate-priority-source-conflict-supplemental-evidence-decision-template-materialization-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const packetDirectory = argument('packet-snapshot');
const guidanceDirectory = argument('guidance-snapshot');
const additionalEvidenceDirectory = argument('additional-evidence-snapshot');
const augmentedGuidanceDirectory = argument('augmented-guidance-snapshot');
const policyFile = 'platform/policies/activity-candidate-priority-source-conflict-supplemental-evidence-decision-template-materialization-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const guidancePolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-guidance-v1.json';
const additionalEvidencePolicyFile = 'platform/policies/activity-candidate-priority-source-conflict-additional-evidence-v1.json';
const augmentedGuidancePolicyFile = 'platform/policies/activity-candidate-priority-source-conflict-augmented-human-review-guidance-v1.json';
const supplementalImporterPolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-supplemental-evidence-v1.json';
const decisionPolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-v1.json';
const rejectionContract = 'sensum.activity-candidate-priority-source-conflict-supplemental-evidence-decision-template-materialization-audit.v1';

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
  return {
    raw,
    records,
    manifest,
    snapshot: { directory, contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true }
  };
}

if (!packetDirectory || !guidanceDirectory || !additionalEvidenceDirectory || !augmentedGuidanceDirectory) {
  rejection('--packet-snapshot=<directory>, --guidance-snapshot=<directory>, --additional-evidence-snapshot=<directory>, and --augmented-guidance-snapshot=<directory> are required. No input is selected automatically.');
} else {
  try {
    const [policy, packetPolicy, guidancePolicy, additionalEvidencePolicy, augmentedGuidancePolicy, supplementalImporterPolicy, decisionPolicy] = await Promise.all([
      fs.readFile(path.resolve(policyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(guidancePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(additionalEvidencePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(augmentedGuidancePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(supplementalImporterPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8').then(JSON.parse)
    ]);
    const [packet, guidance, additionalEvidence, augmentedGuidance] = await Promise.all([
      readSnapshot(packetDirectory, policy.inputPacketDomain),
      readSnapshot(guidanceDirectory, policy.inputGuidanceDomain),
      readSnapshot(additionalEvidenceDirectory, policy.inputAdditionalEvidenceDomain),
      readSnapshot(augmentedGuidanceDirectory, policy.inputAugmentedGuidanceDomain)
    ]);
    const built = buildActivityCandidatePrioritySupplementalEvidenceDecisionTemplateMaterialization({
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
      augmentedGuidanceRecords: augmentedGuidance.records,
      augmentedGuidanceRaw: augmentedGuidance.raw,
      augmentedGuidanceManifest: augmentedGuidance.manifest,
      augmentedGuidanceSnapshot: augmentedGuidance.snapshot,
      policy,
      packetPolicy,
      guidancePolicy,
      additionalEvidencePolicy,
      augmentedGuidancePolicy,
      supplementalImporterPolicy,
      decisionPolicy,
      contentHash: hash
    });
    const inputSnapshots = {
      packet: { directory: packetDirectory, contentHash: packet.manifest.contentHash, createdAt: packet.manifest.createdAt },
      guidance: { directory: guidanceDirectory, contentHash: guidance.manifest.contentHash, createdAt: guidance.manifest.createdAt },
      additionalEvidence: { directory: additionalEvidenceDirectory, contentHash: additionalEvidence.manifest.contentHash, createdAt: additionalEvidence.manifest.createdAt },
      augmentedGuidance: { directory: augmentedGuidanceDirectory, contentHash: augmentedGuidance.manifest.contentHash, createdAt: augmentedGuidance.manifest.createdAt }
    };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshots, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const policyBinding = (id, file, value) => ({ id, file, contentHash: hash(value) });
      const source = {
        kind: 'deterministic_blank_supplemental_evidence_bound_human_decision_templates_without_decision_or_semantic_optimizer_promotion',
        policy: policyBinding(policy.policy, policyFile, policy),
        inputPacketPolicy: policyBinding(packetPolicy.policy, packetPolicyFile, packetPolicy),
        inputGuidancePolicy: policyBinding(guidancePolicy.policy, guidancePolicyFile, guidancePolicy),
        inputAdditionalEvidencePolicy: policyBinding(additionalEvidencePolicy.policy, additionalEvidencePolicyFile, additionalEvidencePolicy),
        inputAugmentedGuidancePolicy: policyBinding(augmentedGuidancePolicy.policy, augmentedGuidancePolicyFile, augmentedGuidancePolicy),
        inputSupplementalDecisionImportPolicy: policyBinding(supplementalImporterPolicy.policy, supplementalImporterPolicyFile, supplementalImporterPolicy),
        inputDecisionImportPolicy: policyBinding(decisionPolicy.policy, decisionPolicyFile, decisionPolicy),
        inputSnapshots,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      await Promise.all([
        fs.writeFile(path.join(snapshot.dir, 'review-instructions.md'), built.artifacts.markdown),
        fs.writeFile(path.join(snapshot.dir, 'decision-templates.ndjson'), built.artifacts.decisionTemplateNdjson),
        fs.writeFile(path.join(snapshot.dir, 'template-index.json'), built.artifacts.templateIndexJson),
        fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson)
      ]);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
      const artifactSummary = {
        artifactCount: built.artifacts.artifactManifest.artifacts.length + 1,
        artifacts: [
          ...built.artifacts.artifactManifest.artifacts,
          { file: 'artifact-manifest.json', kind: 'content_addressed_artifact_manifest', contentHash: hash(built.artifacts.artifactManifestJson), bytes: Buffer.byteLength(built.artifacts.artifactManifestJson, 'utf8') }
        ]
      };
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        inputPacketPolicy: source.inputPacketPolicy,
        inputGuidancePolicy: source.inputGuidancePolicy,
        inputAdditionalEvidencePolicy: source.inputAdditionalEvidencePolicy,
        inputAugmentedGuidancePolicy: source.inputAugmentedGuidancePolicy,
        inputSupplementalDecisionImportPolicy: source.inputSupplementalDecisionImportPolicy,
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
          templateRecordCount: report.templateCoverage.templateRecordCount,
          requiredOriginalEvidenceKeyCount: report.templateCoverage.requiredOriginalEvidenceKeyCount,
          requiredSupplementalEvidenceKeyCount: report.templateCoverage.requiredSupplementalEvidenceKeyCount,
          requiredOriginalSourceRevisionCount: report.templateCoverage.requiredOriginalSourceRevisionCount,
          requiredSupplementalSourceRevisionCount: report.templateCoverage.requiredSupplementalSourceRevisionCount,
          guardedImporterRejectedBlankTemplates: report.guardedImporterBlankRejectionCoverage.complete,
          decisionRecordsProduced: report.guardedImporterBlankRejectionCoverage.decisionRecordsProduced,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    rejection('Explicit packet, guidance, additional-evidence, or augmented-guidance snapshot could not be read or validated.', error.message);
  }
}
