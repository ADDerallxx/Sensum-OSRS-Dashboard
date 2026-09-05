import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence,
  discoverMultiVariantStructuralMemberCandidateParentOccurrenceBindingExactRevisionRequests
} from './multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const inputDomain = 'structural-member-candidate-review-ready-identity-and-remaining-gap-work-routing';
const outputDomain = 'multi-variant-structural-member-candidate-parent-occurrence-binding-evidence';

async function latestInputSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${inputDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const audit = manifest.source?.audit || {};
      const reasons = [];
      if (manifest.domain !== inputDomain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (audit.routingCoverageComplete !== true || audit.identityReviewComplete !== false || audit.optimizerEligibleCount !== 0 || audit.completeActivityUniverse !== false || audit.publishable !== true) reasons.push('identity_and_remaining_gap_route_not_publishable_or_gates_not_closed');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract || row.state !== policy.inputState)) reasons.push('unexpected_or_empty_input_contract_or_state');
      if (reasons.length) {
        rejections.push({ directory, reasons });
        continue;
      }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid structural member candidate review-ready identity routing snapshot exists.');
}

async function fetchExactRevisionBatches(requests) {
  const batches = [];
  const revisions = requests.map(request => request.sourceRevision);
  for (let index = 0; index < revisions.length; index += policy.sourceCapture.revisionBatchSize) {
    const requestedRevisions = revisions.slice(index, index + policy.sourceCapture.revisionBatchSize);
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', revids: requestedRevisions.join('|') });
    const response = await fetchJson(`${WIKI_API}?${params}`);
    batches.push({ requestedRevisions, response });
    if (index + policy.sourceCapture.revisionBatchSize < revisions.length) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return batches;
}

const input = await latestInputSnapshot();
const exactRevisionRequests = discoverMultiVariantStructuralMemberCandidateParentOccurrenceBindingExactRevisionRequests(input.rows, policy);
const revisionBatches = await fetchExactRevisionBatches(exactRevisionRequests);
const built = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence({ routingRecords: input.rows, revisionBatches, policy });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_multi_variant_parent_occurrence_binding_evidence_capture_without_binding_decision_or_semantic_promotion',
  api: WIKI_API,
  fetchMode: 'official Wiki exact revision IDs with complete main-slot source text',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  exactRevisionRequests,
  audit: built.audit
};
const snapshot = await writeSnapshot(root, outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  exactRevisionRequests,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, `${outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    revisionRequestCoverage: report.revisionRequestCoverage,
    sourceCoverage: report.sourceCoverage,
    packetCoverage: report.packetCoverage,
    bindingEvidenceCoverage: report.bindingEvidenceCoverage,
    semanticPreservationCoverage: report.semanticPreservationCoverage,
    evidenceCaptureComplete: report.evidenceCaptureComplete,
    variantBindingReviewComplete: report.variantBindingReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
