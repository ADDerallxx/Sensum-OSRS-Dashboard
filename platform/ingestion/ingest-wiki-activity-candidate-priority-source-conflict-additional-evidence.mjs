import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionResolutions } from './activity-evidence-lib.mjs';
import { buildActivityCandidatePrioritySourceConflictAdditionalEvidence } from './activity-candidate-priority-source-conflict-additional-evidence-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const packetDirectory = argument('packet-snapshot');
const guidanceDirectory = argument('guidance-snapshot');
const policyFile = 'platform/policies/activity-candidate-priority-source-conflict-additional-evidence-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const guidancePolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-guidance-v1.json';
const decisionPolicyFile = 'platform/policies/activity-candidate-priority-human-review-decision-import-v1.json';

const rejection = (reason, error = null) => {
  console.log(JSON.stringify({
    contract: 'sensum.activity-candidate-priority-source-conflict-additional-evidence-audit.v1',
    accepted: false,
    reason,
    ...(error ? { error } : {}),
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
};

if (!packetDirectory || !guidanceDirectory) {
  rejection('--packet-snapshot=<directory> and --guidance-snapshot=<directory> are required. Neither input is selected automatically.');
} else {
  try {
    const [policy, packetPolicy, guidancePolicy, decisionPolicy] = await Promise.all([
      fs.readFile(path.resolve(policyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(guidancePolicyFile), 'utf8').then(JSON.parse),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8').then(JSON.parse)
    ]);
    const [packetRaw, packetManifest, guidanceRaw, guidanceManifest] = await Promise.all([
      fs.readFile(path.join(root, packetDirectory, `${policy.inputPacketDomain}.ndjson`), 'utf8'),
      fs.readFile(path.join(root, packetDirectory, 'manifest.json'), 'utf8').then(JSON.parse),
      fs.readFile(path.join(root, guidanceDirectory, `${policy.inputGuidanceDomain}.ndjson`), 'utf8'),
      fs.readFile(path.join(root, guidanceDirectory, 'manifest.json'), 'utf8').then(JSON.parse)
    ]);
    const packetRecords = packetRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const guidanceRecords = guidanceRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const packetSnapshot = { directory: packetDirectory, contentHash: packetManifest.contentHash, createdAt: packetManifest.createdAt, explicit: true };
    const guidanceSnapshot = { directory: guidanceDirectory, contentHash: guidanceManifest.contentHash, createdAt: guidanceManifest.createdAt, explicit: true };
    const conflictPackets = packetRecords.filter(record => record.subjectAssessment?.subjectDisposition?.state === policy.sourceConflictState);
    const requestedTitles = [...new Set([
      ...policy.requiredSupportingSources.map(source => source.requestedTitle),
      ...conflictPackets.map(record => record.sourcePageIdentity.resolvedTitle)
    ])];
    const fetchedResolutions = await wikiRevisionResolutions(requestedTitles);
    const built = buildActivityCandidatePrioritySourceConflictAdditionalEvidence({
      packetRecords, packetRaw, packetManifest, packetSnapshot,
      guidanceRecords, guidanceRaw, guidanceManifest, guidanceSnapshot,
      fetchedResolutions, policy, packetPolicy, guidancePolicy, decisionPolicy, contentHash: hash
    });
    const inputSnapshots = {
      packets: { directory: packetDirectory, contentHash: packetManifest.contentHash, createdAt: packetManifest.createdAt },
      guidance: { directory: guidanceDirectory, contentHash: guidanceManifest.contentHash, createdAt: guidanceManifest.createdAt }
    };
    if (!built.audit.publishable) {
      console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshots, audit: built.audit, outputWritten: false }, null, 2));
      process.exitCode = 2;
    } else {
      const fetchedRevisions = fetchedResolutions.map(resolution => {
        const revision = resolution.page?.revisions?.[0];
        const content = revision?.slots?.main?.content;
        return {
          requestedTitle: resolution.requestedTitle,
          resolvedTitle: resolution.page?.title || resolution.resolvedTitle,
          namespace: resolution.page?.ns ?? null,
          pageId: resolution.page?.pageid || null,
          revision: revision?.revid ? String(revision.revid) : null,
          timestamp: revision?.timestamp || null,
          contentHash: typeof content === 'string' ? hash(content) : null
        };
      });
      const source = {
        kind: 'revision_pinned_priority_activity_source_conflict_additional_evidence_without_human_decision_or_semantic_optimizer_promotion',
        api: WIKI_API,
        fetchMode: 'current exact revision source for generic supporting pages and every conflict candidate selected by source state',
        policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
        inputPacketPolicy: { id: packetPolicy.policy, file: packetPolicyFile, contentHash: hash(packetPolicy) },
        inputGuidancePolicy: { id: guidancePolicy.policy, file: guidancePolicyFile, contentHash: hash(guidancePolicy) },
        inputDecisionImportPolicy: { id: decisionPolicy.policy, file: decisionPolicyFile, contentHash: hash(decisionPolicy) },
        inputSnapshots,
        fetchedRevisions,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
      const report = { ...built.audit, generatedAt, policy: source.policy, inputSnapshots, fetchedRevisions, outputSnapshot };
      report.contentHash = hash({ ...report, contentHash: undefined });
      const reportDirectory = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(reportDirectory, { recursive: true });
      await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        inputSnapshots,
        fetchedRevisions,
        outputSnapshot,
        reportDirectory,
        coverage: {
          sourceConflictPacketCount: report.inputCoverage.sourceConflictPacketCount,
          outputRecordCount: report.inputCoverage.outputRecordCount,
          completeSupportingSourceCount: report.sourceCoverage.completeSupportingSourceCount,
          candidateRevisionExactMatchCount: report.sourceCoverage.candidateRevisionExactMatchCount,
          fieldSemanticsCompleteCount: report.evidenceCoverage.fieldSemanticsCompleteCount,
          taxonomyMembershipCompleteCount: report.evidenceCoverage.taxonomyMembershipCompleteCount,
          reviewEvidenceKeyCount: report.evidenceCoverage.reviewEvidenceKeyCount,
          additionalEvidenceCoverageComplete: report.additionalEvidenceCoverageComplete,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    rejection('Explicit packet/guidance snapshots or required official Wiki evidence could not be read or validated.', error.message);
  }
}
