import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidatePriorityHumanReviewPackets } from './activity-candidate-priority-human-review-packet-consolidation-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const policyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const sourceEvidencePolicyFile = 'platform/policies/activity-candidate-semantic-evidence-v1.json';
const subjectDispositionPolicyFile = 'platform/policies/activity-candidate-subject-disposition-v1.json';
const workRoutingPolicyFile = 'platform/policies/activity-candidate-evidence-work-routing-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const sourceEvidencePolicy = JSON.parse(await fs.readFile(path.resolve(sourceEvidencePolicyFile), 'utf8'));
const subjectDispositionPolicy = JSON.parse(await fs.readFile(path.resolve(subjectDispositionPolicyFile), 'utf8'));
const workRoutingPolicy = JSON.parse(await fs.readFile(path.resolve(workRoutingPolicyFile), 'utf8'));

async function loadExplicitSnapshot(argumentName, domain) {
  const directory = argument(argumentName);
  if (!directory) throw new Error(`--${argumentName}=<snapshot-directory> is required; implicit snapshot selection is forbidden.`);
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  const reasons = [];
  if (manifest.contract !== 'sensum.ingestion-manifest.v1' || manifest.domain !== domain) reasons.push('manifest_contract_or_domain_mismatch');
  if (manifest.records !== rows.length || manifest.contentHash !== hash(raw)) reasons.push('record_count_or_raw_content_hash_mismatch');
  const invalidRecordHashes = rows.filter(record => {
    const { contentHash, ...rest } = record;
    return typeof contentHash !== 'string' || hash(rest) !== contentHash;
  }).map(record => record.candidateKey || 'unknown');
  if (invalidRecordHashes.length) reasons.push('one_or_more_record_content_hashes_invalid');
  if (reasons.length) throw new Error(`${domain} snapshot ${directory} failed validation: ${reasons.join(', ')}`);
  return { directory, domain, rows, raw, manifest };
}

function snapshotBinding(snapshot) {
  return { directory: snapshot.directory, contentHash: snapshot.manifest.contentHash, createdAt: snapshot.manifest.createdAt };
}

function fail(message) {
  console.log(JSON.stringify({
    contract: policy.auditContract,
    accepted: false,
    error: message,
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
}

try {
  const candidates = await loadExplicitSnapshot('candidate-snapshot', policy.candidateDomain);
  const sourceEvidence = await loadExplicitSnapshot('source-evidence-snapshot', policy.sourceEvidenceDomain);
  const subjectDisposition = await loadExplicitSnapshot('subject-disposition-snapshot', policy.subjectDispositionDomain);
  const workRouting = await loadExplicitSnapshot('work-routing-snapshot', policy.workRoutingDomain);
  const chainErrors = [];
  const candidateBinding = sourceEvidence.manifest.source?.inputSnapshots?.candidates;
  if (candidateBinding?.directory !== candidates.directory || candidateBinding?.contentHash !== candidates.manifest.contentHash) chainErrors.push('source_evidence_to_candidate_snapshot_binding_mismatch');
  const sourceBinding = subjectDisposition.manifest.source?.inputSnapshot;
  if (sourceBinding?.directory !== sourceEvidence.directory || sourceBinding?.contentHash !== sourceEvidence.manifest.contentHash) chainErrors.push('subject_disposition_to_source_evidence_snapshot_binding_mismatch');
  const dispositionBinding = workRouting.manifest.source?.inputSnapshot;
  if (dispositionBinding?.directory !== subjectDisposition.directory || dispositionBinding?.contentHash !== subjectDisposition.manifest.contentHash) chainErrors.push('work_routing_to_subject_disposition_snapshot_binding_mismatch');
  if (sourceEvidence.manifest.source?.policy !== sourceEvidencePolicy.policy) chainErrors.push('source_evidence_policy_binding_mismatch');
  if (subjectDisposition.manifest.source?.policy !== subjectDispositionPolicy.policy) chainErrors.push('subject_disposition_policy_binding_mismatch');
  if (workRouting.manifest.source?.policy !== workRoutingPolicy.policy) chainErrors.push('work_routing_policy_binding_mismatch');
  if (candidates.manifest.source?.audit?.publishable !== true || candidates.manifest.source?.audit?.candidateInventoryComplete !== true) chainErrors.push('candidate_snapshot_audit_not_publishable_or_complete');
  if (sourceEvidence.manifest.source?.audit?.publishable !== true || sourceEvidence.manifest.source?.audit?.sourceEvidenceCoverageComplete !== true) chainErrors.push('source_evidence_snapshot_audit_not_publishable_or_complete');
  if (subjectDisposition.manifest.source?.audit?.publishable !== true || subjectDisposition.manifest.source?.audit?.dispositionAttemptCoverageComplete !== true) chainErrors.push('subject_disposition_snapshot_audit_not_publishable_or_complete');
  if (workRouting.manifest.source?.audit?.publishable !== true || workRouting.manifest.source?.audit?.routingCoverageComplete !== true) chainErrors.push('work_routing_snapshot_audit_not_publishable_or_complete');
  if (chainErrors.length) throw new Error(`Explicit activity-candidate pipeline chain failed validation: ${chainErrors.join(', ')}`);

  const built = buildActivityCandidatePriorityHumanReviewPackets({
    candidateRecords: candidates.rows,
    sourceEvidenceRecords: sourceEvidence.rows,
    subjectDispositionRecords: subjectDisposition.rows,
    workRoutingRecords: workRouting.rows,
    policy,
    contentHash: hash
  });
  const inputSnapshots = {
    candidates: snapshotBinding(candidates),
    sourceEvidence: snapshotBinding(sourceEvidence),
    subjectDisposition: snapshotBinding(subjectDisposition),
    workRouting: snapshotBinding(workRouting)
  };
  if (!built.audit.publishable) {
    console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshots, audit: built.audit, outputWritten: false }, null, 2));
    process.exitCode = 2;
  } else {
    const source = {
      kind: 'deterministic_revision_bound_priority_activity_candidate_human_review_packet_consolidation_without_decision_or_semantic_optimizer_promotion',
      policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
      upstreamPolicies: {
        sourceEvidence: { id: sourceEvidencePolicy.policy, file: sourceEvidencePolicyFile, contentHash: hash(sourceEvidencePolicy) },
        subjectDisposition: { id: subjectDispositionPolicy.policy, file: subjectDispositionPolicyFile, contentHash: hash(subjectDispositionPolicy) },
        workRouting: { id: workRoutingPolicy.policy, file: workRoutingPolicyFile, contentHash: hash(workRoutingPolicy) }
      },
      inputSnapshots,
      audit: built.audit
    };
    const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
    const batchDirectory = path.join(snapshot.dir, 'batches');
    await fs.mkdir(batchDirectory, { recursive: true });
    for (const artifact of built.artifacts.batches) {
      await fs.writeFile(path.join(batchDirectory, artifact.markdownFile), artifact.markdown);
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
      aggregateBatchArtifactContentHash: hash(built.artifacts.batches.map(({ markdown, decisionNdjson, ...metadata }) => ({ ...metadata, markdownContentHash: hash(markdown), decisionContentHash: hash(decisionNdjson) })))
    };
    const report = {
      ...built.audit,
      generatedAt,
      policy: source.policy,
      upstreamPolicies: source.upstreamPolicies,
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
        candidateInventoryRecordCount: report.inputCoverage.candidateInventoryRecordCount,
        selectedActivityDiscoveryCandidateCount: report.inputCoverage.selectedActivityDiscoveryCandidateCount,
        exactlyBoundCandidateCount: report.pipelineBindingCoverage.exactlyBoundCandidateCount,
        directCrossSourceUnlockEvidenceCandidateCount: report.pipelineBindingCoverage.directCrossSourceUnlockEvidenceCandidateCount,
        renderedPageWithoutUnlockEvidenceCandidateCount: report.pipelineBindingCoverage.renderedPageWithoutUnlockEvidenceCandidateCount,
        packetCount: report.packetCoverage.packetCount,
        sourceConflictPacketCount: report.packetCoverage.sourceConflictPacketCount,
        queuedReviewPacketCount: report.packetCoverage.queuedReviewPacketCount,
        batchCount: report.batchCoverage.batchCount,
        packetConsolidationComplete: report.packetConsolidationComplete,
        humanReviewComplete: report.humanReviewComplete,
        completeActivityUniverse: report.completeActivityUniverse,
        absoluteBestGate: report.absoluteBestGate,
        blockers: report.blockers
      }
    }, null, 2));
  }
} catch (error) {
  fail(error.message);
}
