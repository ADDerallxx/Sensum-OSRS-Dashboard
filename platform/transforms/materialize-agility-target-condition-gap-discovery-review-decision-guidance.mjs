import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance } from './agility-target-condition-gap-discovery-review-decision-guidance-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const packetDirectoryArgument = argument('packet-snapshot');
const root = path.resolve(argument('root') || '.platform-data');

function fail(message, details = {}) {
  console.log(JSON.stringify({
    contract: 'sensum.agility-target-condition-gap-discovery-review-decision-guidance-audit.v1',
    accepted: false,
    error: message,
    ...details,
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
}

const parseNdjson = raw => raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

if (!packetDirectoryArgument) {
  fail('Required: --packet-snapshot=<exact review-packet snapshot directory>. No packet is selected automatically.');
} else {
  try {
    const packetDirectory = path.resolve(packetDirectoryArgument);
    const inputDomain = 'agility-target-condition-gap-discovery-review-packet';
    const outputDomain = 'agility-target-condition-gap-discovery-review-decision-guidance';
    const guidancePolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-decision-guidance-v1.json';
    const packetPolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json';
    const decisionPolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-decision-import-v1.json';
    const applicationPolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-decision-application-v1.json';
    const [
      packetRaw, packetManifestRaw, packetArtifactManifestRaw, packetReviewMarkdownRaw, blankTemplateRaw,
      guidancePolicyRaw, packetPolicyRaw, decisionPolicyRaw, applicationPolicyRaw
    ] = await Promise.all([
      fs.readFile(path.join(packetDirectory, `${inputDomain}.ndjson`), 'utf8'),
      fs.readFile(path.join(packetDirectory, 'manifest.json'), 'utf8'),
      fs.readFile(path.join(packetDirectory, 'artifact-manifest.json'), 'utf8'),
      fs.readFile(path.join(packetDirectory, 'review-packet.md'), 'utf8'),
      fs.readFile(path.join(packetDirectory, 'decision-template.ndjson'), 'utf8'),
      fs.readFile(path.resolve(guidancePolicyFile), 'utf8'),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8'),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8'),
      fs.readFile(path.resolve(applicationPolicyFile), 'utf8')
    ]);
    const packetRecords = parseNdjson(packetRaw);
    const packetManifest = JSON.parse(packetManifestRaw);
    const packetArtifactManifest = JSON.parse(packetArtifactManifestRaw);
    const blankTemplates = parseNdjson(blankTemplateRaw);
    const policy = JSON.parse(guidancePolicyRaw);
    const packetPolicy = JSON.parse(packetPolicyRaw);
    const decisionPolicy = JSON.parse(decisionPolicyRaw);
    const applicationPolicy = JSON.parse(applicationPolicyRaw);
    const packetSnapshot = {
      directory: packetDirectory,
      contentHash: packetManifest.contentHash,
      createdAt: packetManifest.createdAt,
      records: packetManifest.records,
      explicit: true
    };
    const built = buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance({
      packetRecords,
      packetRaw,
      packetManifest,
      packetArtifactManifest,
      packetArtifactManifestRaw,
      packetReviewMarkdownRaw,
      blankTemplates,
      blankTemplateRaw,
      packetSnapshot,
      policy,
      packetPolicy,
      decisionPolicy,
      applicationPolicy,
      contentHash: hash
    });
    if (!built.audit.publishable) {
      fail('The review-decision guidance packet failed validation.', { packetSnapshot, audit: built.audit });
    } else {
      const source = {
        kind: 'deterministic_exact_packet_human_review_decision_guidance_without_selection_recommendation_recording_application_or_promotion',
        policy: { id: policy.policy, file: guidancePolicyFile, contentHash: hash(policy) },
        packetPolicy: { id: packetPolicy.policy, file: packetPolicyFile, contentHash: hash(packetPolicy) },
        decisionPolicy: { id: decisionPolicy.policy, file: decisionPolicyFile, contentHash: hash(decisionPolicy) },
        applicationPolicy: { id: applicationPolicy.policy, file: applicationPolicyFile, contentHash: hash(applicationPolicy) },
        packetSnapshot,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, outputDomain, built.records, source);
      await Promise.all([
        fs.writeFile(path.join(snapshot.dir, 'decision-guidance.md'), built.artifacts.guidanceMarkdown),
        fs.writeFile(path.join(snapshot.dir, 'decision-guidance.json'), built.artifacts.guidanceJson),
        fs.writeFile(path.join(snapshot.dir, 'decision-template.ndjson'), built.artifacts.decisionTemplateRaw),
        fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson)
      ]);
      const generatedAt = new Date().toISOString();
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        packetPolicy: source.packetPolicy,
        decisionPolicy: source.decisionPolicy,
        applicationPolicy: source.applicationPolicy,
        packetSnapshot,
        outputSnapshot: {
          directory: path.basename(snapshot.dir),
          records: snapshot.manifest.records,
          contentHash: snapshot.manifest.contentHash
        },
        artifacts: built.artifacts.artifactManifest
      };
      report.contentHash = hash(report);
      const auditDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(auditDirectory, { recursive: true });
      await fs.writeFile(path.join(auditDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        packetSnapshot,
        outputSnapshot: report.outputSnapshot,
        artifacts: report.artifacts,
        auditDirectory,
        coverage: {
          guidanceCoverage: report.guidanceCoverage,
          bindingCoverage: report.bindingCoverage,
          semanticPreservationCoverage: report.semanticPreservationCoverage,
          humanReviewComplete: report.humanReviewComplete,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        },
        outputWritten: true
      }, null, 2));
    }
  } catch (error) {
    fail(error.message);
  }
}
