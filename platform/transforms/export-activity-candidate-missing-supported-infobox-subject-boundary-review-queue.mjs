import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport } from './activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const routingDirectory = argument('routing-snapshot');
const oneHopDirectory = argument('one-hop-snapshot');
const recursiveDirectory = argument('recursive-snapshot');
const policyFile = 'platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-v1.json';
const routingPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json';
const oneHopPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json';
const recursivePolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json';
const queueContractFile = 'platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-entry-v1.json';
const decisionContractFile = 'platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-template-v1.json';
const auditContractFile = 'platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-audit-v1.json';
const rejectionContract = 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-audit.v1';

function rejection(reason, error = null, audit = null) {
  console.log(JSON.stringify({ contract: rejectionContract, accepted: false, reason, ...(error ? { error } : {}), ...(audit ? { audit } : {}), outputWritten: false }, null, 2));
  process.exitCode = 2;
}

async function readJson(file) { return JSON.parse(await fs.readFile(path.resolve(file), 'utf8')); }

async function readSnapshot(directory, domain) {
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  return { raw, records, manifest, snapshot: { directory, contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

function contractsMatch(records, templates, audit, queueContract, decisionContract, auditContract) {
  const queueRecordsMatch = records.every(record => queueContract.required.every(field => Object.hasOwn(record, field))
    && Object.entries(queueContract.invariants || {}).every(([field, value]) => hash(record[field]) === hash(value)));
  const decisionTemplatesMatch = templates.every(template => decisionContract.required.every(field => Object.hasOwn(template, field))
    && Object.entries(decisionContract.blankInvariants || {}).every(([field, value]) => hash(template[field]) === hash(value)));
  const auditMatches = auditContract.required.every(field => Object.hasOwn(audit, field))
    && Object.entries(auditContract.invariants || {}).every(([field, value]) => hash(audit[field]) === hash(value));
  return { queueRecordsMatch, decisionTemplatesMatch, auditMatches, complete: queueRecordsMatch && decisionTemplatesMatch && auditMatches };
}

if (!routingDirectory || !oneHopDirectory || !recursiveDirectory) {
  rejection('--routing-snapshot=<directory>, --one-hop-snapshot=<directory>, and --recursive-snapshot=<directory> are required. No input is selected automatically.');
} else {
  try {
    const [policy, routingPolicy, oneHopPolicy, recursivePolicy, queueContract, decisionContract, auditContract] = await Promise.all([
      readJson(policyFile), readJson(routingPolicyFile), readJson(oneHopPolicyFile), readJson(recursivePolicyFile),
      readJson(queueContractFile), readJson(decisionContractFile), readJson(auditContractFile)
    ]);
    const [routing, oneHop, recursive] = await Promise.all([
      readSnapshot(routingDirectory, policy.inputRoutingDomain),
      readSnapshot(oneHopDirectory, policy.inputOneHopDomain),
      readSnapshot(recursiveDirectory, policy.inputRecursiveDomain)
    ]);
    const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport({
      routingRecords: routing.records, routingRaw: routing.raw, routingManifest: routing.manifest, routingSnapshot: routing.snapshot,
      oneHopRecords: oneHop.records, oneHopRaw: oneHop.raw, oneHopManifest: oneHop.manifest, oneHopSnapshot: oneHop.snapshot,
      recursiveRecords: recursive.records, recursiveRaw: recursive.raw, recursiveManifest: recursive.manifest, recursiveSnapshot: recursive.snapshot,
      policy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash: hash
    });
    const contractCoverage = contractsMatch(built.records, built.decisionTemplates, built.audit, queueContract, decisionContract, auditContract);
    if (!built.audit.publishable || !contractCoverage.complete) {
      rejection('Source-bound subject-boundary review queue failed an input, binding, evidence-exposure, semantic-preservation, artifact, or contract gate.', null, { ...built.audit, contractCoverage });
    } else {
      const policyBinding = (id, file, value) => ({ id, file, contentHash: hash(value) });
      const inputSnapshots = {
        routing: { directory: routingDirectory, contentHash: routing.manifest.contentHash, createdAt: routing.manifest.createdAt },
        oneHop: { directory: oneHopDirectory, contentHash: oneHop.manifest.contentHash, createdAt: oneHop.manifest.createdAt },
        recursive: { directory: recursiveDirectory, contentHash: recursive.manifest.contentHash, createdAt: recursive.manifest.createdAt }
      };
      const source = {
        kind: 'deterministic_source_bound_subject_boundary_review_queue_with_blank_decisions_and_no_semantic_or_optimizer_promotion',
        policy: policyBinding(policy.policy, policyFile, policy),
        inputRoutingPolicy: policyBinding(routingPolicy.policy, routingPolicyFile, routingPolicy),
        inputOneHopPolicy: policyBinding(oneHopPolicy.policy, oneHopPolicyFile, oneHopPolicy),
        inputRecursivePolicy: policyBinding(recursivePolicy.policy, recursivePolicyFile, recursivePolicy),
        queueContract: { file: queueContractFile, contentHash: hash(queueContract) },
        decisionContract: { file: decisionContractFile, contentHash: hash(decisionContract) },
        auditContract: { file: auditContractFile, contentHash: hash(auditContract) },
        inputSnapshots,
        contractCoverage,
        audit: built.audit
      };
      const snapshotRows = built.records.map(record => ({ ...record, contentHash: hash(record) }));
      const snapshot = await writeSnapshot(root, policy.outputDomain, snapshotRows, source);
      if (snapshot.manifest.contentHash !== built.queueSnapshotContentHash) throw new Error('Written queue snapshot hash differs from the pre-bound decision-template hash.');
      await Promise.all([
        fs.writeFile(path.join(snapshot.dir, 'review-queue.md'), built.artifacts.reviewMarkdown),
        fs.writeFile(path.join(snapshot.dir, 'decision-template.ndjson'), built.artifacts.decisionTemplateNdjson),
        fs.writeFile(path.join(snapshot.dir, 'evidence-index.json'), built.artifacts.evidenceIndex),
        fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson)
      ]);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
      const report = {
        ...built.audit,
        generatedAt,
        policy: source.policy,
        inputSnapshots,
        outputSnapshot,
        contractCoverage,
        artifacts: {
          ...built.artifacts.artifactManifest,
          artifactManifest: { file: 'artifact-manifest.json', contentHash: hash(built.artifacts.artifactManifestJson), bytes: Buffer.byteLength(built.artifacts.artifactManifestJson, 'utf8') }
        }
      };
      report.contentHash = hash({ ...report, contentHash: undefined });
      const reportDirectory = path.join(root, `${policy.outputDomain}-export-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(reportDirectory, { recursive: true });
      await fs.writeFile(path.join(reportDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        inputSnapshots,
        outputSnapshot,
        reportDirectory,
        artifacts: report.artifacts,
        coverage: {
          queueEntryCount: report.queueCoverage.queueEntryCount,
          blankDecisionTemplateCount: report.queueCoverage.blankDecisionTemplateCount,
          exactBindingCount: report.bindingCoverage.exactBindingCount,
          evidenceExposure: report.evidenceExposureCoverage.actual,
          queueExportComplete: report.queueExportComplete,
          subjectBoundaryReviewComplete: report.subjectBoundaryReviewComplete,
          completeRenderedOutputAttribution: report.completeRenderedOutputAttribution,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    rejection('Explicit snapshots or required queue inputs could not be read or validated.', error.message);
  }
}
