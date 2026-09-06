import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildUnlockCorpusAbsenceReconciliationApplications } from './cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const queueDirectory = argument('queue-snapshot');
const decisionDirectory = argument('decision-snapshot');
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-v1.json';
const queuePolicyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-v1.json';
const decisionPolicyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-v1.json';
const queueDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue';
const decisionDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decisions';
const outputDomain = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-applications';
const auditContract = 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-application-audit.v1';

if (!queueDirectory || !decisionDirectory) {
  console.log(JSON.stringify({
    contract: auditContract,
    accepted: false,
    reason: 'Both --queue-snapshot=<directory> and --decision-snapshot=<directory> are required. No input is selected automatically.',
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
} else {
  try {
    const [policy, queuePolicy, decisionPolicy] = await Promise.all([
      fs.readFile(path.resolve(policyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(queuePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8').then(JSON.parse)
    ]);
    async function snapshot(directory, domain) {
      const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
      const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      return { directory, raw, records, manifest, contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true };
    }
    const [queue, decisions] = await Promise.all([
      snapshot(queueDirectory, queueDomain),
      snapshot(decisionDirectory, decisionDomain)
    ]);
    const built = buildUnlockCorpusAbsenceReconciliationApplications({
      queueRecords: queue.records, queueRaw: queue.raw, queueManifest: queue.manifest,
      queueSnapshot: { directory: queue.directory, contentHash: queue.contentHash, createdAt: queue.createdAt, explicit: true },
      decisionRecords: decisions.records, decisionRaw: decisions.raw, decisionManifest: decisions.manifest,
      decisionSnapshot: { directory: decisions.directory, contentHash: decisions.contentHash, createdAt: decisions.createdAt, explicit: true },
      policy, queuePolicy, decisionPolicy, contentHash: hash
    });
    const inputs = {
      queue: {
        directory: queue.directory,
        contentHash: queue.contentHash,
        createdAt: queue.createdAt,
        corpusEvidenceContentHash: queue.manifest.source?.corpusEvidenceContentHash
      },
      decisions: { directory: decisions.directory, contentHash: decisions.contentHash, createdAt: decisions.createdAt }
    };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputs, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const source = {
        kind: 'explicit_human_decision_bound_level_unlock_corpus_absence_reconciliation_application_without_no_requirement_or_optimizer_promotion',
        policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
        inputQueuePolicy: { id: queuePolicy.policy, file: queuePolicyFile, contentHash: hash(queuePolicy) },
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
        inputQueuePolicy: source.inputQueuePolicy,
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
          confirmedAppliedCount: report.applicationCoverage.confirmedAppliedCount,
          rejectedAppliedCount: report.applicationCoverage.rejectedAppliedCount,
          additionalEvidenceAppliedCount: report.applicationCoverage.additionalEvidenceAppliedCount,
          missingDecisionCount: report.decisionCoverage.missingDecisionCount,
          applicationBatchComplete: report.applicationBatchComplete,
          unlockCorpusAbsenceReviewComplete: report.unlockCorpusAbsenceReviewComplete,
          absenceReconciliationComplete: report.absenceReconciliationComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    console.log(JSON.stringify({
      contract: auditContract,
      accepted: false,
      reason: 'Explicit queue or decision snapshot could not be read or validated.',
      error: error.message,
      outputWritten: false
    }, null, 2));
    process.exitCode = 2;
  }
}
