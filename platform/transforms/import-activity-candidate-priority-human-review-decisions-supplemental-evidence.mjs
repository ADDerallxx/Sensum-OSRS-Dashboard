import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence } from './activity-candidate-priority-human-review-decision-import-supplemental-evidence-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const packetDirectory = argument('packet-snapshot');
const guidanceDirectory = argument('guidance-snapshot');
const additionalEvidenceDirectory = argument('additional-evidence-snapshot');
const augmentedGuidanceDirectory = argument('augmented-guidance-snapshot');
const decisionFile = argument('decisions');
const policyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-supplemental-evidence-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const guidancePolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-guidance-v1.json';
const evidencePolicyFile = 'platform/policies/activity-candidate-priority-source-conflict-additional-evidence-v1.json';
const augmentedPolicyFile = 'platform/policies/activity-candidate-priority-source-conflict-augmented-human-review-guidance-v1.json';
const decisionPolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-v1.json';
const rejectionContract = 'sensum.activity-candidate-priority-human-review-decision-import-supplemental-evidence-audit.v1';

function reject(reason, error = null) {
  console.log(JSON.stringify({ contract: rejectionContract, accepted: false, reason, ...(error ? { error } : {}), outputWritten: false }, null, 2));
  process.exitCode = 2;
}

const parseNdjson = raw => raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

async function readSnapshot(directory, domain) {
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const records = parseNdjson(raw);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  return {
    raw, records, manifest,
    snapshot: { directory, contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true }
  };
}

if (!packetDirectory || !guidanceDirectory || !additionalEvidenceDirectory || !augmentedGuidanceDirectory || !decisionFile) {
  reject('--packet-snapshot, --guidance-snapshot, --additional-evidence-snapshot, --augmented-guidance-snapshot, and --decisions are all required. No input is selected automatically.');
} else {
  try {
    const [policy, packetPolicy, guidancePolicy, additionalEvidencePolicy, augmentedGuidancePolicy, decisionPolicy] = await Promise.all([
      fs.readFile(path.resolve(policyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(guidancePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(evidencePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(augmentedPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8').then(JSON.parse)
    ]);
    const [packet, guidance, evidence, augmented, decisionRaw] = await Promise.all([
      readSnapshot(packetDirectory, policy.inputPacketDomain),
      readSnapshot(guidanceDirectory, policy.inputGuidanceDomain),
      readSnapshot(additionalEvidenceDirectory, policy.inputAdditionalEvidenceDomain),
      readSnapshot(augmentedGuidanceDirectory, policy.inputAugmentedGuidanceDomain),
      fs.readFile(path.resolve(decisionFile), 'utf8')
    ]);
    const submissions = parseNdjson(decisionRaw);
    const built = buildActivityCandidatePriorityHumanReviewDecisionImportSupplementalEvidence({
      packetRecords: packet.records, packetRaw: packet.raw, packetManifest: packet.manifest, packetSnapshot: packet.snapshot,
      guidanceRecords: guidance.records, guidanceRaw: guidance.raw, guidanceManifest: guidance.manifest, guidanceSnapshot: guidance.snapshot,
      additionalEvidenceRecords: evidence.records, additionalEvidenceRaw: evidence.raw,
      additionalEvidenceManifest: evidence.manifest, additionalEvidenceSnapshot: evidence.snapshot,
      augmentedGuidanceRecords: augmented.records, augmentedGuidanceRaw: augmented.raw,
      augmentedGuidanceManifest: augmented.manifest, augmentedGuidanceSnapshot: augmented.snapshot,
      submissions,
      decisionFile: { explicit: true, file: path.resolve(decisionFile), contentHash: hash(decisionRaw), rows: submissions.length },
      policy, packetPolicy, guidancePolicy, additionalEvidencePolicy, augmentedGuidancePolicy, decisionPolicy, contentHash: hash
    });
    const inputSnapshots = {
      packet: packet.snapshot, guidance: guidance.snapshot,
      additionalEvidence: evidence.snapshot, augmentedGuidance: augmented.snapshot
    };
    const submission = { file: path.resolve(decisionFile), contentHash: hash(decisionRaw), rows: submissions.length };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshots, submission, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const binding = (value, file) => ({ id: value.policy, file, contentHash: hash(value) });
      const source = {
        kind: 'explicit_human_priority_activity_decision_recording_with_separate_exact_supplemental_evidence_binding_without_semantic_or_optimizer_application',
        policy: binding(policy, policyFile),
        packetPolicy: binding(packetPolicy, packetPolicyFile),
        guidancePolicy: binding(guidancePolicy, guidancePolicyFile),
        additionalEvidencePolicy: binding(additionalEvidencePolicy, evidencePolicyFile),
        augmentedGuidancePolicy: binding(augmentedGuidancePolicy, augmentedPolicyFile),
        decisionImportPolicy: binding(decisionPolicy, decisionPolicyFile),
        inputSnapshots, submission, audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
      const report = { ...built.audit, generatedAt, policy: source.policy, inputSnapshots, submission, outputSnapshot };
      report.contentHash = hash({ ...report, contentHash: undefined });
      const reportDirectory = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(reportDirectory, { recursive: true });
      await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({
        contract: report.contract, accepted: true, inputSnapshots, submission, outputSnapshot, reportDirectory,
        coverage: {
          submissionCoverage: report.submissionCoverage,
          baseImporterCoverage: report.baseImporterCoverage,
          supplementalBindingCoverage: report.supplementalBindingCoverage,
          recordCoverage: report.recordCoverage,
          semanticPreservationCoverage: report.semanticPreservationCoverage,
          supplementalEvidenceBoundDecisionRecordingComplete: report.supplementalEvidenceBoundDecisionRecordingComplete,
          allSourceConflictDecisionsRecorded: report.allSourceConflictDecisionsRecorded,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    reject('Explicit snapshots or the decision file could not be read or validated.', error.message);
  }
}
