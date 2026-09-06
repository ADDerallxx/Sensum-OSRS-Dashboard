import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance } from './activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const queueDirectoryArgument = argument('queue');
const templateFileArgument = argument('templates');
const guidancePolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-v1.json';
const queuePolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-v1.json';
const decisionPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-v1.json';
const routingPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json';
const oneHopPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json';
const recursivePolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json';

if (!queueDirectoryArgument || !templateFileArgument) {
  console.log(JSON.stringify({
    contract: 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-audit.v1',
    accepted: false,
    reason: '--queue=<queue-snapshot-directory> and --templates=<exact-blank-template.ndjson> are required. No input is selected automatically.',
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
} else {
  try {
    const queueDirectory = path.resolve(queueDirectoryArgument);
    const templateFile = path.resolve(templateFileArgument);
    const [policy, queuePolicy, decisionPolicy, routingPolicy, oneHopPolicy, recursivePolicy] = await Promise.all([
      fs.readFile(path.resolve(guidancePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(queuePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(routingPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(oneHopPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(recursivePolicyFile), 'utf8').then(JSON.parse)
    ]);
    const [queueRaw, queueManifest, artifactManifest, blankTemplateRaw] = await Promise.all([
      fs.readFile(path.join(queueDirectory, `${policy.inputDomain}.ndjson`), 'utf8'),
      fs.readFile(path.join(queueDirectory, 'manifest.json'), 'utf8').then(JSON.parse),
      fs.readFile(path.join(queueDirectory, 'artifact-manifest.json'), 'utf8').then(JSON.parse),
      fs.readFile(templateFile, 'utf8')
    ]);
    const parseNdjson = raw => raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const queueRecords = parseNdjson(queueRaw);
    const blankTemplates = parseNdjson(blankTemplateRaw);
    const queueSnapshot = {
      directory: path.basename(queueDirectory),
      contentHash: queueManifest.contentHash,
      createdAt: queueManifest.createdAt,
      explicit: true
    };
    const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance({
      queueRecords, queueRaw, queueManifest, artifactManifest, blankTemplates, blankTemplateRaw, queueSnapshot,
      policy, queuePolicy, decisionPolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash: hash
    });
    const inputSnapshot = {
      directory: queueSnapshot.directory,
      contentHash: queueSnapshot.contentHash,
      createdAt: queueSnapshot.createdAt,
      blankTemplateFile: templateFile,
      blankTemplateContentHash: hash(blankTemplateRaw)
    };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshot, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const source = {
        kind: 'deterministic_source_bound_subject_boundary_human_review_guidance_with_byte_equivalent_blank_decisions_and_no_semantic_or_optimizer_promotion',
        policy: { id: policy.policy, file: guidancePolicyFile, contentHash: hash(policy) },
        inputQueuePolicy: { id: queuePolicy.policy, file: queuePolicyFile, contentHash: hash(queuePolicy) },
        inputDecisionImportPolicy: { id: decisionPolicy.policy, file: decisionPolicyFile, contentHash: hash(decisionPolicy) },
        inputSnapshot,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      await Promise.all([
        fs.writeFile(path.join(snapshot.dir, 'review-guidance.md'), built.artifacts.guidanceMarkdown),
        fs.writeFile(path.join(snapshot.dir, 'guidance-index.json'), built.artifacts.guidanceIndex),
        fs.writeFile(path.join(snapshot.dir, 'submission-checklist.md'), built.artifacts.checklist),
        fs.writeFile(path.join(snapshot.dir, 'decision-template.ndjson'), built.artifacts.decisionTemplateNdjson),
        fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson)
      ]);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash, records: snapshot.manifest.records };
      const artifactSummary = {
        artifactCount: built.artifacts.artifactManifest.artifacts.length,
        artifactManifestContentHash: hash(built.artifacts.artifactManifestJson),
        aggregateArtifactContentHash: hash(built.artifacts.artifactManifest.artifacts)
      };
      const reportBase = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        inputQueuePolicy: source.inputQueuePolicy,
        inputDecisionImportPolicy: source.inputDecisionImportPolicy,
        inputSnapshot,
        outputSnapshot,
        artifacts: artifactSummary
      };
      const report = { ...reportBase, contentHash: hash(reportBase) };
      const reportDirectory = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(reportDirectory, { recursive: true });
      await fs.writeFile(path.join(reportDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        inputSnapshot,
        outputSnapshot,
        artifacts: artifactSummary,
        reportDirectory,
        coverage: {
          queueEntryCount: report.queueCoverage.queueEntryCount,
          guidanceRecordCount: report.guidanceCoverage.guidanceRecordCount,
          dispositionCoherencePathCount: report.guidanceCoverage.dispositionCoherencePathCount,
          reviewObligationCount: report.guidanceCoverage.reviewObligationCount,
          minimumEvidenceCoverageKeyCount: report.guidanceCoverage.minimumEvidenceCoverageKeyCount,
          blankDecisionTemplateCount: report.guidanceCoverage.blankDecisionTemplateCount,
          guidanceMaterializationComplete: report.guidanceMaterializationComplete,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    console.log(JSON.stringify({
      contract: 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-audit.v1',
      accepted: false,
      reason: 'Explicit queue snapshot or blank-template artifact could not be read or validated.',
      error: error.message,
      outputWritten: false
    }, null, 2));
    process.exitCode = 2;
  }
}
