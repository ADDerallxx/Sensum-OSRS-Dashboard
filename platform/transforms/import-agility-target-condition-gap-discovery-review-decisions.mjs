import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildAgilityTargetConditionGapDiscoveryReviewDecisionImport } from './agility-target-condition-gap-discovery-review-decision-import-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const packetDirectoryArgument = argument('packet-snapshot');
const templateFileArgument = argument('templates');
const decisionFileArgument = argument('decisions');
const root = path.resolve(argument('root') || '.platform-data');

function fail(message, details = {}) {
  console.log(JSON.stringify({
    contract: 'sensum.agility-target-condition-gap-discovery-review-decision-import-audit.v1',
    accepted: false,
    error: message,
    ...details,
    outputWritten: false
  }, null, 2));
  process.exitCode = 2;
}

function parseNdjson(raw) {
  return raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

if (!packetDirectoryArgument || !templateFileArgument || !decisionFileArgument) {
  fail('Required: --packet-snapshot=<exact packet snapshot directory> --templates=<exact blank decision-template.ndjson> --decisions=<completed decisions.ndjson>. No input is selected automatically.');
} else {
  try {
    const packetDirectory = path.resolve(packetDirectoryArgument);
    const templateFile = path.resolve(templateFileArgument);
    const decisionFile = path.resolve(decisionFileArgument);
    const inputDomain = 'agility-target-condition-gap-discovery-review-packet';
    const outputDomain = 'agility-target-condition-gap-discovery-review-decisions';
    const packetRawFile = path.join(packetDirectory, `${inputDomain}.ndjson`);
    const packetManifestFile = path.join(packetDirectory, 'manifest.json');
    const artifactManifestFile = path.join(packetDirectory, 'artifact-manifest.json');
    const reviewMarkdownFile = path.join(packetDirectory, 'review-packet.md');
    const importPolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-decision-import-v1.json';
    const packetPolicyFile = 'platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json';
    const [packetRaw, packetManifestRaw, artifactManifestRaw, reviewMarkdownRaw, blankTemplateRaw, decisionRaw, policyRaw, packetPolicyRaw] = await Promise.all([
      fs.readFile(packetRawFile, 'utf8'),
      fs.readFile(packetManifestFile, 'utf8'),
      fs.readFile(artifactManifestFile, 'utf8'),
      fs.readFile(reviewMarkdownFile, 'utf8'),
      fs.readFile(templateFile, 'utf8'),
      fs.readFile(decisionFile, 'utf8'),
      fs.readFile(path.resolve(importPolicyFile), 'utf8'),
      fs.readFile(path.resolve(packetPolicyFile), 'utf8')
    ]);
    const packetRecords = parseNdjson(packetRaw);
    const packetManifest = JSON.parse(packetManifestRaw);
    const artifactManifest = JSON.parse(artifactManifestRaw);
    const blankTemplates = parseNdjson(blankTemplateRaw);
    const submissions = parseNdjson(decisionRaw);
    const policy = JSON.parse(policyRaw);
    const packetPolicy = JSON.parse(packetPolicyRaw);
    const inputSnapshot = {
      directory: packetDirectory,
      domain: packetManifest.domain,
      createdAt: packetManifest.createdAt,
      records: packetRecords.length,
      contentHash: packetManifest.contentHash
    };
    const templateSnapshot = { file: templateFile, rows: blankTemplates.length, contentHash: hash(blankTemplateRaw) };
    const submission = { file: decisionFile, rows: submissions.length, contentHash: hash(decisionRaw) };
    const built = buildAgilityTargetConditionGapDiscoveryReviewDecisionImport({
      packetRecords,
      packetManifest,
      packetRaw,
      artifactManifest,
      artifactManifestRaw,
      reviewMarkdownRaw,
      blankTemplates,
      blankTemplateRaw,
      submissions,
      decisionRaw,
      policy,
      packetPolicy,
      contentHash: hash
    });
    if (!built.audit.publishable) {
      fail('The completed review decision batch failed atomic validation.', { inputSnapshot, templateSnapshot, submission, audit: built.audit });
    } else {
      const source = {
        kind: 'explicit_source_bound_human_review_decision_recording_without_semantic_application_fact_creation_blocker_closure_or_optimizer_promotion',
        policy: { id: policy.policy, file: importPolicyFile, contentHash: hash(policy) },
        packetPolicy: { id: packetPolicy.policy, file: packetPolicyFile, contentHash: hash(packetPolicy) },
        inputSnapshot,
        templateSnapshot,
        submission,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, outputDomain, built.records, source);
      const generatedAt = new Date().toISOString();
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        packetPolicy: source.packetPolicy,
        inputSnapshot,
        templateSnapshot,
        submission,
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
        inputSnapshot,
        templateSnapshot,
        submission,
        outputSnapshot: report.outputSnapshot,
        auditDirectory,
        coverage: {
          reviewDecisionRecordingComplete: report.reviewDecisionRecordingComplete,
          humanReviewComplete: report.humanReviewComplete,
          semanticApplicationComplete: report.semanticApplicationComplete,
          semanticPreservationCoverage: report.semanticPreservationCoverage,
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
