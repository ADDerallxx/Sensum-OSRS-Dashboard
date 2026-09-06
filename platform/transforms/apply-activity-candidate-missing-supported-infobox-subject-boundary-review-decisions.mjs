import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications } from './activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const queueDirectoryArgument = argument('queue-snapshot');
const decisionDirectoryArgument = argument('decision-snapshot');
const queueDomain = 'activity-candidate-missing-supported-infobox-subject-boundary-review-queue';
const decisionDomain = 'activity-candidate-missing-supported-infobox-subject-boundary-review-decisions';
const outputDomain = 'activity-candidate-missing-supported-infobox-subject-boundary-review-decision-applications';
const policyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-v1.json';
const decisionPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-v1.json';
const queuePolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-v1.json';
const routingPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json';
const oneHopPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json';
const recursivePolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json';
const refusalContract = 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-audit.v1';

if (!queueDirectoryArgument || !decisionDirectoryArgument) {
  console.log(JSON.stringify({
    contract: refusalContract,
    accepted: false,
    reason: 'Both --queue-snapshot=<directory> and --decision-snapshot=<directory> are required. No input is selected automatically.',
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
} else {
  try {
    const queueDirectory = path.resolve(queueDirectoryArgument);
    const decisionDirectory = path.resolve(decisionDirectoryArgument);
    const queueRawFile = path.join(queueDirectory, `${queueDomain}.ndjson`);
    const queueManifestFile = path.join(queueDirectory, 'manifest.json');
    const queueArtifactManifestFile = path.join(queueDirectory, 'artifact-manifest.json');
    const blankTemplateFile = path.join(queueDirectory, 'decision-template.ndjson');
    const decisionRawFile = path.join(decisionDirectory, `${decisionDomain}.ndjson`);
    const decisionManifestFile = path.join(decisionDirectory, 'manifest.json');
    const [
      queueRaw, queueManifestRaw, queueArtifactManifestRaw, blankTemplateRaw, decisionRaw, decisionManifestRaw,
      policyRaw, decisionPolicyRaw, queuePolicyRaw, routingPolicyRaw, oneHopPolicyRaw, recursivePolicyRaw
    ] = await Promise.all([
      fs.readFile(queueRawFile, 'utf8'), fs.readFile(queueManifestFile, 'utf8'),
      fs.readFile(queueArtifactManifestFile, 'utf8'), fs.readFile(blankTemplateFile, 'utf8'),
      fs.readFile(decisionRawFile, 'utf8'), fs.readFile(decisionManifestFile, 'utf8'),
      fs.readFile(path.resolve(policyFile), 'utf8'), fs.readFile(path.resolve(decisionPolicyFile), 'utf8'),
      fs.readFile(path.resolve(queuePolicyFile), 'utf8'), fs.readFile(path.resolve(routingPolicyFile), 'utf8'),
      fs.readFile(path.resolve(oneHopPolicyFile), 'utf8'), fs.readFile(path.resolve(recursivePolicyFile), 'utf8')
    ]);
    const parseNdjson = raw => raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const queueRecords = parseNdjson(queueRaw);
    const blankTemplates = parseNdjson(blankTemplateRaw);
    const decisionRecords = parseNdjson(decisionRaw);
    const queueManifest = JSON.parse(queueManifestRaw);
    const queueArtifactManifest = JSON.parse(queueArtifactManifestRaw);
    const decisionManifest = JSON.parse(decisionManifestRaw);
    const policy = JSON.parse(policyRaw);
    const decisionPolicy = JSON.parse(decisionPolicyRaw);
    const queuePolicy = JSON.parse(queuePolicyRaw);
    const routingPolicy = JSON.parse(routingPolicyRaw);
    const oneHopPolicy = JSON.parse(oneHopPolicyRaw);
    const recursivePolicy = JSON.parse(recursivePolicyRaw);
    const queueSnapshot = {
      directory: queueDirectory,
      contentHash: queueManifest.contentHash,
      createdAt: queueManifest.createdAt,
      explicit: true
    };
    const decisionSnapshot = {
      directory: decisionDirectory,
      contentHash: decisionManifest.contentHash,
      createdAt: decisionManifest.createdAt,
      explicit: true
    };
    const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications({
      queueRecords, queueRaw, queueManifest, queueArtifactManifest, blankTemplates, blankTemplateRaw, queueSnapshot,
      decisionRecords, decisionRaw, decisionManifest, decisionSnapshot,
      policy, decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash: hash
    });
    const inputs = {
      queue: { directory: queueDirectory, contentHash: queueSnapshot.contentHash, createdAt: queueSnapshot.createdAt },
      decisions: { directory: decisionDirectory, contentHash: decisionSnapshot.contentHash, createdAt: decisionSnapshot.createdAt }
    };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputs, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const source = {
        kind: 'explicit_source_bound_subject_boundary_human_review_decision_application_without_identity_membership_mechanics_or_optimizer_promotion',
        policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
        inputDecisionImportPolicy: { id: decisionPolicy.policy, file: decisionPolicyFile, contentHash: hash(decisionPolicy) },
        inputQueuePolicy: { id: queuePolicy.policy, file: queuePolicyFile, contentHash: hash(queuePolicy) },
        inputs,
        audit: built.audit
      };
      const output = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      const generatedAt = new Date().toISOString();
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        inputDecisionImportPolicy: source.inputDecisionImportPolicy,
        inputQueuePolicy: source.inputQueuePolicy,
        inputs,
        outputSnapshot: { directory: path.basename(output.dir), contentHash: output.manifest.contentHash, records: output.manifest.records }
      };
      report.contentHash = hash({ ...report, contentHash: undefined });
      const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(reportDirectory, { recursive: true });
      await fs.writeFile(path.join(reportDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        inputs,
        outputSnapshot: report.outputSnapshot,
        reportDirectory,
        coverage: {
          applicationRecordCount: report.applicationCoverage.applicationRecordCount,
          resolvedScopeCount: report.applicationCoverage.resolvedScopeCount,
          candidateScopedRejectionCount: report.applicationCoverage.candidateScopedRejectionCount,
          additionalEvidenceBlockedCount: report.applicationCoverage.additionalEvidenceBlockedCount,
          memberExpansionRequiredCount: report.applicationCoverage.memberExpansionRequiredCount,
          applicationBatchComplete: report.applicationBatchComplete,
          subjectBoundaryReviewComplete: report.subjectBoundaryReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    console.log(JSON.stringify({
      contract: refusalContract,
      accepted: false,
      reason: 'Explicit queue or decision snapshot could not be read or validated.',
      error: error.message,
      outputWritten: false
    }, null, 2));
    process.exitCode = 2;
  }
}
