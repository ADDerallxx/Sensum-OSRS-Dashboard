import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionImport } from './activity-candidate-priority-human-review-decision-import-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const packetDirectoryArgument = argument('packets');
const decisionFileArgument = argument('decisions');
if (!packetDirectoryArgument) throw new Error('Required: --packets=<activity-candidate-priority-human-review-packet-snapshot-directory>. No packet snapshot is selected automatically.');
if (!decisionFileArgument) throw new Error('Required: --decisions=<reviewed-decision-template.ndjson>. No decision file is selected automatically.');

const packetDirectory = path.resolve(packetDirectoryArgument);
const decisionFile = path.resolve(decisionFileArgument);
const inputDomain = 'activity-candidate-priority-human-review-packet';
const outputDomain = 'activity-candidate-priority-human-review-decisions';
const packetRawFile = path.join(packetDirectory, `${inputDomain}.ndjson`);
const manifestFile = path.join(packetDirectory, 'manifest.json');
const importPolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const importPolicy = JSON.parse(await fs.readFile(path.resolve(importPolicyFile), 'utf8'));
const packetPolicy = JSON.parse(await fs.readFile(path.resolve(packetPolicyFile), 'utf8'));

function parseNdjson(raw) {
  return raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

const packetRaw = await fs.readFile(packetRawFile, 'utf8');
const packetRecords = parseNdjson(packetRaw);
const packetManifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const packetAudit = packetManifest.source?.audit || {};
const manifestRejections = [];
if (packetManifest.contract !== 'sensum.ingestion-manifest.v1') manifestRejections.push('packet_manifest_contract_mismatch');
if (packetManifest.domain !== inputDomain) manifestRejections.push('packet_manifest_domain_mismatch');
if (packetManifest.records !== packetRecords.length) manifestRejections.push('packet_manifest_record_count_mismatch');
if (packetManifest.contentHash !== hash(packetRaw)) manifestRejections.push('packet_manifest_content_hash_mismatch');
if (packetManifest.source?.policy?.id !== packetPolicy.policy
  || packetManifest.source?.policy?.contentHash !== hash(packetPolicy)) manifestRejections.push('packet_manifest_policy_binding_mismatch');
if (packetAudit.packetConsolidationComplete !== true
  || packetAudit.humanReviewComplete !== false
  || packetAudit.requirementsVariantsXpTimingAndMechanicsComplete !== false
  || packetAudit.completeActivityUniverse !== false
  || packetAudit.semanticPreservationCoverage?.optimizerEligibleCount !== 0
  || packetAudit.semanticPreservationCoverage?.automaticVerificationCount !== 0
  || packetAudit.publishable !== true) manifestRejections.push('packet_manifest_audit_gates_invalid_or_open');
if (!packetRecords.length) manifestRejections.push('packet_snapshot_empty');

const inputSnapshot = {
  directory: packetDirectory,
  contentHash: packetManifest.contentHash,
  createdAt: packetManifest.createdAt,
  records: packetRecords.length,
  manifestRejections
};

if (manifestRejections.length) {
  console.log(JSON.stringify({
    contract: importPolicy.auditContract,
    accepted: false,
    inputSnapshot,
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
} else {
  const submissionRaw = await fs.readFile(decisionFile, 'utf8');
  const submissions = parseNdjson(submissionRaw);
  const submission = { file: decisionFile, contentHash: hash(submissionRaw), rows: submissions.length };
  const built = buildActivityCandidatePriorityHumanReviewDecisionImport({
    packetRecords,
    submissions,
    policy: importPolicy,
    packetSnapshotContentHash: packetManifest.contentHash,
    packetSnapshotCreatedAt: packetManifest.createdAt
  });

  if (!built.audit.publishable) {
    console.log(JSON.stringify({
      contract: built.audit.contract,
      accepted: false,
      inputSnapshot,
      submission,
      audit: built.audit,
      outputWritten: false
    }, null, 2));
    process.exitCode = 2;
  } else {
    const source = {
      kind: 'explicit_revision_and_fingerprint_bound_priority_activity_human_review_decision_recording_without_semantic_or_optimizer_application',
      policy: { id: importPolicy.policy, file: importPolicyFile, contentHash: hash(importPolicy) },
      packetPolicy: { id: packetPolicy.policy, file: packetPolicyFile, contentHash: hash(packetPolicy) },
      inputSnapshot,
      submission,
      audit: built.audit
    };
    const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
    const generatedAt = new Date().toISOString();
    const report = {
      ...built.audit,
      generatedAt,
      policy: source.policy,
      packetPolicy: source.packetPolicy,
      inputSnapshot,
      submission,
      outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
    };
    report.contentHash = hash({ ...report, contentHash: undefined });
    const output = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({
      contract: report.contract,
      accepted: true,
      inputSnapshot,
      submission,
      outputSnapshot: report.outputSnapshot,
      coverage: {
        packetCoverage: report.packetCoverage,
        submissionCoverage: report.submissionCoverage,
        bindingCoverage: report.bindingCoverage,
        recordCoverage: report.recordCoverage,
        semanticPreservationCoverage: report.semanticPreservationCoverage,
        reviewDecisionRecordingComplete: report.reviewDecisionRecordingComplete,
        humanReviewComplete: report.humanReviewComplete,
        completeActivityUniverse: report.completeActivityUniverse,
        absoluteBestGate: report.absoluteBestGate,
        blockers: report.blockers,
        publishable: report.publishable
      }
    }, null, 2));
  }
}
