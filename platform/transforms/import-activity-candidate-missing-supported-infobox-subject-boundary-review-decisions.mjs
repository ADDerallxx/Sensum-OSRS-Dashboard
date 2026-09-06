import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport } from './activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const queueDirectoryArgument = argument('queue');
const templateFileArgument = argument('templates');
const decisionFileArgument = argument('decisions');

if (!queueDirectoryArgument || !templateFileArgument || !decisionFileArgument) {
  console.error('Required: --queue=<queue-snapshot-directory> --templates=<exact-blank-template.ndjson> --decisions=<completed-decisions.ndjson>. No input is selected automatically.');
  process.exitCode = 2;
} else {
  const queueDirectory = path.resolve(queueDirectoryArgument);
  const templateFile = path.resolve(templateFileArgument);
  const decisionFile = path.resolve(decisionFileArgument);
  const inputDomain = 'activity-candidate-missing-supported-infobox-subject-boundary-review-queue';
  const outputDomain = 'activity-candidate-missing-supported-infobox-subject-boundary-review-decisions';
  const queueRawFile = path.join(queueDirectory, `${inputDomain}.ndjson`);
  const queueManifestFile = path.join(queueDirectory, 'manifest.json');
  const artifactManifestFile = path.join(queueDirectory, 'artifact-manifest.json');
  const importPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-v1.json';
  const queuePolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-v1.json';
  const routingPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json';
  const oneHopPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json';
  const recursivePolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json';
  const [queueRaw, queueManifestRaw, artifactManifestRaw, templateRaw, decisionRaw, importPolicyRaw, queuePolicyRaw, routingPolicyRaw, oneHopPolicyRaw, recursivePolicyRaw] = await Promise.all([
    fs.readFile(queueRawFile, 'utf8'), fs.readFile(queueManifestFile, 'utf8'), fs.readFile(artifactManifestFile, 'utf8'),
    fs.readFile(templateFile, 'utf8'), fs.readFile(decisionFile, 'utf8'), fs.readFile(path.resolve(importPolicyFile), 'utf8'),
    fs.readFile(path.resolve(queuePolicyFile), 'utf8'), fs.readFile(path.resolve(routingPolicyFile), 'utf8'),
    fs.readFile(path.resolve(oneHopPolicyFile), 'utf8'), fs.readFile(path.resolve(recursivePolicyFile), 'utf8')
  ]);
  const parseNdjson = raw => raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const queueRecords = parseNdjson(queueRaw);
  const blankTemplates = parseNdjson(templateRaw);
  const submissions = parseNdjson(decisionRaw);
  const queueManifest = JSON.parse(queueManifestRaw);
  const artifactManifest = JSON.parse(artifactManifestRaw);
  const importPolicy = JSON.parse(importPolicyRaw);
  const queuePolicy = JSON.parse(queuePolicyRaw);
  const routingPolicy = JSON.parse(routingPolicyRaw);
  const oneHopPolicy = JSON.parse(oneHopPolicyRaw);
  const recursivePolicy = JSON.parse(recursivePolicyRaw);
  const queueAudit = queueManifest.source?.audit || {};
  const templateArtifact = (artifactManifest.artifacts || []).find(row => row.file === 'decision-template.ndjson');
  const manifestRejections = [];
  if (queueManifest.contract !== 'sensum.ingestion-manifest.v1') manifestRejections.push('queue_manifest_contract_mismatch');
  if (queueManifest.domain !== inputDomain) manifestRejections.push('queue_manifest_domain_mismatch');
  if (queueManifest.records !== queueRecords.length) manifestRejections.push('queue_manifest_record_count_mismatch');
  if (queueManifest.contentHash !== hash(queueRaw)) manifestRejections.push('queue_manifest_content_hash_mismatch');
  if (queueManifest.source?.policy?.id !== queuePolicy.policy || queueManifest.source?.policy?.contentHash !== hash(queuePolicy)) manifestRejections.push('queue_manifest_policy_binding_mismatch');
  if (artifactManifest.contract !== 'sensum.content-addressed-artifact-manifest.v1') manifestRejections.push('artifact_manifest_contract_mismatch');
  if (!templateArtifact || templateArtifact.contentHash !== hash(templateRaw) || templateArtifact.bytes !== Buffer.byteLength(templateRaw, 'utf8')) manifestRejections.push('blank_template_artifact_binding_mismatch');
  if (queueAudit.contract !== queuePolicy.auditContract || queueAudit.queueExportComplete !== true
    || queueAudit.subjectBoundaryReviewComplete !== false || queueAudit.completeActivityUniverse !== false
    || queueAudit.semanticPreservationCoverage?.humanDecisionRecordedCount !== 0
    || queueAudit.semanticPreservationCoverage?.optimizerEligibleCount !== 0
    || queueAudit.semanticPreservationCoverage?.automaticVerificationCount !== 0
    || queueAudit.publishable !== true) manifestRejections.push('queue_manifest_audit_gates_invalid_or_open');
  if (!queueRecords.length) manifestRejections.push('queue_snapshot_empty');

  const inputSnapshot = {
    directory: queueDirectory,
    contentHash: queueManifest.contentHash,
    createdAt: queueManifest.createdAt,
    records: queueRecords.length,
    manifestRejections
  };
  const templateSnapshot = { file: templateFile, contentHash: hash(templateRaw), rows: blankTemplates.length };
  const submission = { file: decisionFile, contentHash: hash(decisionRaw), rows: submissions.length };

  if (manifestRejections.length) {
    console.log(JSON.stringify({ contract: importPolicy.auditContract, accepted: false, inputSnapshot, templateSnapshot, submission, outputWritten: false }, null, 2));
    process.exitCode = 2;
  } else {
    const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport({
      queueRecords, blankTemplates, submissions, policy: importPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy,
      queueSnapshotContentHash: queueManifest.contentHash, queueSnapshotCreatedAt: queueManifest.createdAt
    });
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, templateSnapshot, submission, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const source = {
        kind: 'explicit_source_bound_subject_boundary_human_review_decision_recording_without_semantic_or_optimizer_application',
        policy: { id: importPolicy.policy, file: importPolicyFile, contentHash: hash(importPolicy) },
        queuePolicy: { id: queuePolicy.policy, file: queuePolicyFile, contentHash: hash(queuePolicy) },
        inputSnapshot, templateSnapshot, submission, audit: built.audit
      };
      const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      const report = {
        ...built.audit,
        generatedAt: new Date().toISOString(),
        policy: source.policy,
        queuePolicy: source.queuePolicy,
        inputSnapshot,
        templateSnapshot,
        submission,
        outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records }
      };
      const auditDirectory = path.join(root, `${outputDomain}-audits`, report.generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(auditDirectory, { recursive: true });
      await fs.writeFile(path.join(auditDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({ accepted: true, outputWritten: true, snapshot: report.outputSnapshot, auditDirectory, audit: built.audit }, null, 2));
    }
  }
}
