import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting } from './activity-candidate-missing-supported-infobox-evidence-work-routing-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const sourceEvidenceDirectory = argument('source-evidence-snapshot');
const packetDirectory = argument('packet-snapshot');
const policyFile = 'platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json';
const sourceEvidencePolicyFile = 'platform/policies/activity-candidate-semantic-evidence-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const rejectionContract = 'sensum.activity-candidate-missing-supported-infobox-evidence-work-routing-audit.v1';

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
  return { raw, records, manifest, snapshot: { directory, contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

if (!sourceEvidenceDirectory || !packetDirectory) {
  rejection('--source-evidence-snapshot=<directory> and --packet-snapshot=<directory> are required. No input is selected automatically.');
} else {
  try {
    const [policy, sourceEvidencePolicy, packetPolicy] = await Promise.all([
      fs.readFile(path.resolve(policyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(sourceEvidencePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8').then(JSON.parse)
    ]);
    const [sourceEvidence, packet] = await Promise.all([
      readSnapshot(sourceEvidenceDirectory, policy.inputSourceEvidenceDomain),
      readSnapshot(packetDirectory, policy.inputPacketDomain)
    ]);
    const built = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting({
      sourceEvidenceRecords: sourceEvidence.records,
      sourceEvidenceRaw: sourceEvidence.raw,
      sourceEvidenceManifest: sourceEvidence.manifest,
      sourceEvidenceSnapshot: sourceEvidence.snapshot,
      packetRecords: packet.records,
      packetRaw: packet.raw,
      packetManifest: packet.manifest,
      packetSnapshot: packet.snapshot,
      policy,
      sourceEvidencePolicy,
      packetPolicy,
      contentHash: hash
    });
    const inputSnapshots = {
      sourceEvidence: { directory: sourceEvidenceDirectory, contentHash: sourceEvidence.manifest.contentHash, createdAt: sourceEvidence.manifest.createdAt },
      packet: { directory: packetDirectory, contentHash: packet.manifest.contentHash, createdAt: packet.manifest.createdAt }
    };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshots, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const policyBinding = (id, file, value) => ({ id, file, contentHash: hash(value) });
      const source = {
        kind: 'revision_pinned_missing_supported_infobox_structural_evidence_work_routing_without_semantic_or_optimizer_promotion',
        policy: policyBinding(policy.policy, policyFile, policy),
        inputSourceEvidencePolicy: policyBinding(sourceEvidencePolicy.policy, sourceEvidencePolicyFile, sourceEvidencePolicy),
        inputPacketPolicy: policyBinding(packetPolicy.policy, packetPolicyFile, packetPolicy),
        inputSnapshots,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      await Promise.all([
        fs.writeFile(path.join(snapshot.dir, 'evidence-work-queue.md'), built.artifacts.markdown),
        fs.writeFile(path.join(snapshot.dir, 'evidence-work-queue.json'), built.artifacts.machineJson),
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
        inputSourceEvidencePolicy: source.inputSourceEvidencePolicy,
        inputPacketPolicy: source.inputPacketPolicy,
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
          sourceEvidenceRecordCount: report.selectionCoverage.sourceEvidenceRecordCount,
          workRouteRecordCount: report.selectionCoverage.workRouteRecordCount,
          selectedCandidateKeys: report.selectionCoverage.selectedCandidateKeys,
          directSupportedInfoboxAbsentCount: report.structuralConditionCoverage.directSupportedInfoboxAbsentCount,
          unsupportedInfoboxLikeInvocationObservedCount: report.structuralConditionCoverage.unsupportedInfoboxLikeInvocationObservedCount,
          aliasEquivalenceUnresolvedCount: report.structuralConditionCoverage.aliasEquivalenceUnresolvedCount,
          transclusionExpansionUnresolvedCount: report.structuralConditionCoverage.transclusionExpansionUnresolvedCount,
          compositeContainerUnresolvedCount: report.structuralConditionCoverage.compositeContainerUnresolvedCount,
          evidenceWorkRoutingComplete: report.evidenceWorkRoutingComplete,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    rejection('Explicit source-evidence or priority-packet snapshot could not be read or validated.', error.message);
  }
}
