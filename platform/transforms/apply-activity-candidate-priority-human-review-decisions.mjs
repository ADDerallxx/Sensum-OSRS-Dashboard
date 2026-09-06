import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionApplications } from './activity-candidate-priority-human-review-decision-application-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const packetDirectory = argument('packet-snapshot');
const decisionDirectory = argument('decision-snapshot');
const policyFile = 'platform/policies/activity-candidate-priority-human-review-decision-application-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const decisionPolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-v1.json';
const packetDomain = 'activity-candidate-priority-human-review-packet';
const decisionDomain = 'activity-candidate-priority-human-review-decisions';
const outputDomain = 'activity-candidate-priority-human-review-decision-applications';

if (!packetDirectory || !decisionDirectory) {
  console.log(JSON.stringify({
    contract: 'sensum.activity-candidate-priority-human-review-decision-application-audit.v1',
    accepted: false,
    reason: 'Both --packet-snapshot=<directory> and --decision-snapshot=<directory> are required. No input is selected automatically.',
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
    async function snapshot(directory, domain) {
      const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
      const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      return { directory, raw, records, manifest, contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true };
    }
    const [packets, decisions] = await Promise.all([
      snapshot(packetDirectory, packetDomain),
      snapshot(decisionDirectory, decisionDomain)
    ]);
    const built = buildActivityCandidatePriorityHumanReviewDecisionApplications({
      packetRecords: packets.records,
      packetRaw: packets.raw,
      packetManifest: packets.manifest,
      packetSnapshot: { directory: packets.directory, contentHash: packets.contentHash, createdAt: packets.createdAt, explicit: true },
      decisionRecords: decisions.records,
      decisionRaw: decisions.raw,
      decisionManifest: decisions.manifest,
      decisionSnapshot: { directory: decisions.directory, contentHash: decisions.contentHash, createdAt: decisions.createdAt, explicit: true },
      policy,
      packetPolicy,
      decisionPolicy,
      contentHash: hash
    });
    const inputs = {
      packets: { directory: packets.directory, contentHash: packets.contentHash, createdAt: packets.createdAt },
      decisions: { directory: decisions.directory, contentHash: decisions.contentHash, createdAt: decisions.createdAt }
    };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputs, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const source = {
        kind: 'explicit_human_decision_bound_priority_activity_semantic_review_application_without_member_mechanics_or_optimizer_promotion',
        policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
        inputPacketPolicy: { id: packetPolicy.policy, file: packetPolicyFile, contentHash: hash(packetPolicy) },
        inputDecisionImportPolicy: { id: decisionPolicy.policy, file: decisionPolicyFile, contentHash: hash(decisionPolicy) },
        inputs,
        audit: built.audit
      };
      const output = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      const generatedAt = new Date().toISOString();
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        inputPacketPolicy: source.inputPacketPolicy,
        inputDecisionImportPolicy: source.inputDecisionImportPolicy,
        inputs,
        outputSnapshot: { directory: path.basename(output.dir), contentHash: output.manifest.contentHash }
      };
      report.contentHash = hash({ ...report, contentHash: undefined });
      const reportDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(reportDirectory, { recursive: true });
      await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        inputs,
        outputSnapshot: report.outputSnapshot,
        reportDirectory,
        coverage: {
          applicationRecordCount: report.applicationCoverage.applicationRecordCount,
          appliedCandidateScopeCount: report.applicationCoverage.appliedCandidateScopeCount,
          authoritativeExclusionCount: report.applicationCoverage.authoritativeExclusionCount,
          additionalEvidenceBlockedCount: report.applicationCoverage.additionalEvidenceBlockedCount,
          missingDecisionCount: report.decisionCoverage.missingDecisionCount,
          memberExpansionRequiredCount: report.applicationCoverage.memberExpansionRequiredCount,
          applicationBatchComplete: report.applicationBatchComplete,
          priorityActivityHumanReviewApplicationComplete: report.priorityActivityHumanReviewApplicationComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    console.log(JSON.stringify({
      contract: 'sensum.activity-candidate-priority-human-review-decision-application-audit.v1',
      accepted: false,
      reason: 'Explicit packet or decision snapshot could not be read or validated.',
      error: error.message,
      outputWritten: false
    }, null, 2));
    process.exitCode = 2;
  }
}
