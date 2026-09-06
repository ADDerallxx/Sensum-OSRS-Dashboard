import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications } from './agility-target-condition-gap-discovery-review-decision-application-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const packetDirectoryArgument = argument('packet-snapshot');
const decisionDirectoryArgument = argument('decision-snapshot');
const root = path.resolve(argument('root') || '.platform-data');

function fail(message, details = {}) {
  console.log(JSON.stringify({
    contract: 'sensum.agility-target-condition-gap-discovery-review-decision-application-audit.v1',
    accepted: false,
    error: message,
    ...details,
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
}

const parseNdjson = raw => raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

if (!packetDirectoryArgument || !decisionDirectoryArgument) {
  fail('Required: --packet-snapshot=<exact review-packet snapshot directory> --decision-snapshot=<exact imported-decision snapshot directory>. No input is selected automatically.');
} else {
  try {
    const packetDirectory = path.resolve(packetDirectoryArgument);
    const decisionDirectory = path.resolve(decisionDirectoryArgument);
    const inputPacketDomain = 'agility-target-condition-gap-discovery-review-packet';
    const inputDecisionDomain = 'agility-target-condition-gap-discovery-review-decisions';
    const outputDomain = 'agility-target-condition-gap-discovery-review-decision-applications';
    const applicationPolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-decision-application-v1.json';
    const decisionPolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-decision-import-v1.json';
    const packetPolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json';
    const [
      packetRaw, packetManifestRaw, artifactManifestRaw, reviewMarkdownRaw, blankTemplateRaw,
      decisionRaw, decisionManifestRaw, applicationPolicyRaw, decisionPolicyRaw, packetPolicyRaw
    ] = await Promise.all([
      fs.readFile(path.join(packetDirectory, `${inputPacketDomain}.ndjson`), 'utf8'),
      fs.readFile(path.join(packetDirectory, 'manifest.json'), 'utf8'),
      fs.readFile(path.join(packetDirectory, 'artifact-manifest.json'), 'utf8'),
      fs.readFile(path.join(packetDirectory, 'review-packet.md'), 'utf8'),
      fs.readFile(path.join(packetDirectory, 'decision-template.ndjson'), 'utf8'),
      fs.readFile(path.join(decisionDirectory, `${inputDecisionDomain}.ndjson`), 'utf8'),
      fs.readFile(path.join(decisionDirectory, 'manifest.json'), 'utf8'),
      fs.readFile(path.resolve(applicationPolicyFile), 'utf8'),
      fs.readFile(path.resolve(decisionPolicyFile), 'utf8'),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8')
    ]);
    const packetRecords = parseNdjson(packetRaw);
    const packetManifest = JSON.parse(packetManifestRaw);
    const artifactManifest = JSON.parse(artifactManifestRaw);
    const blankTemplates = parseNdjson(blankTemplateRaw);
    const decisionRecords = parseNdjson(decisionRaw);
    const decisionManifest = JSON.parse(decisionManifestRaw);
    const policy = JSON.parse(applicationPolicyRaw);
    const decisionPolicy = JSON.parse(decisionPolicyRaw);
    const packetPolicy = JSON.parse(packetPolicyRaw);
    const packetSnapshot = {
      directory: packetDirectory,
      contentHash: packetManifest.contentHash,
      createdAt: packetManifest.createdAt,
      records: packetManifest.records,
      explicit: true
    };
    const decisionSnapshot = {
      directory: decisionDirectory,
      contentHash: decisionManifest.contentHash,
      createdAt: decisionManifest.createdAt,
      records: decisionManifest.records,
      explicit: true
    };
    const built = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications({
      packetRecords,
      packetRaw,
      packetManifest,
      artifactManifest,
      artifactManifestRaw,
      reviewMarkdownRaw,
      blankTemplates,
      blankTemplateRaw,
      packetSnapshot,
      decisionRecords,
      decisionRaw,
      decisionManifest,
      decisionSnapshot,
      policy,
      decisionPolicy,
      packetPolicy,
      contentHash: hash
    });
    if (!built.audit.publishable) {
      fail('The review-decision application batch failed atomic validation.', { packetSnapshot, decisionSnapshot, audit: built.audit });
    } else {
      const source = {
        kind: 'explicit_human_review_decision_application_limited_to_named_blocker_disposition_without_rate_mechanics_optimizer_or_universe_promotion',
        policy: { id: policy.policy, file: applicationPolicyFile, contentHash: hash(policy) },
        decisionPolicy: { id: decisionPolicy.policy, file: decisionPolicyFile, contentHash: hash(decisionPolicy) },
        packetPolicy: { id: packetPolicy.policy, file: packetPolicyFile, contentHash: hash(packetPolicy) },
        packetSnapshot,
        decisionSnapshot,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, outputDomain, built.records, source);
      const generatedAt = new Date().toISOString();
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        decisionPolicy: source.decisionPolicy,
        packetPolicy: source.packetPolicy,
        packetSnapshot,
        decisionSnapshot,
        outputSnapshot: {
          directory: path.basename(snapshot.dir),
          records: snapshot.manifest.records,
          contentHash: snapshot.manifest.contentHash
        }
      };
      report.contentHash = hash(report);
      const auditDirectory = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(auditDirectory, { recursive: true });
      await fs.writeFile(path.join(auditDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        packetSnapshot,
        decisionSnapshot,
        outputSnapshot: report.outputSnapshot,
        auditDirectory,
        coverage: {
          applicationCoverage: report.applicationCoverage,
          semanticPreservationCoverage: report.semanticPreservationCoverage,
          conditionOrMechanicsCoverageComplete: report.conditionOrMechanicsCoverageComplete,
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
