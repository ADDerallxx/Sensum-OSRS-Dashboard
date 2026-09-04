import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionResolutions } from './activity-evidence-lib.mjs';
import {
  buildActivityReferenceCollectionMemberRepeatabilityGapEvidence,
  discoverRepeatabilityGapCandidateRequests,
  selectRepeatabilityGapRoutes
} from './activity-reference-collection-member-repeatability-gap-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/activity-reference-collection-member-repeatability-gap-evidence-v1.json';
const repeatabilityPolicyFile = 'platform/policies/activity-reference-collection-member-repeatability-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const repeatabilityPolicy = JSON.parse(await fs.readFile(path.resolve(repeatabilityPolicyFile), 'utf8'));

async function latestRepeatabilityEvidenceWorkRoutingSnapshot() {
  const domain = 'activity-reference-collection-member-repeatability-evidence-work-routing';
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const file = path.join(root, directory, `${domain}.ndjson`);
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.routingCoverageComplete !== true
        || manifest.source?.audit?.publishable !== true) reasons.push('repeatability_evidence_work_routing_input_not_publishable');
      if (rows.some(record => record.contract !== policy.inputContract)) reasons.push('unexpected_repeatability_evidence_work_routing_contract');
      if (!rows.length) reasons.push('no_repeatability_evidence_work_routing_records');
      if (reasons.length) {
        rejections.push({ directory, reasons });
        continue;
      }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid repeatability evidence-work-routing snapshot exists.');
}

const input = await latestRepeatabilityEvidenceWorkRoutingSnapshot();
const routes = selectRepeatabilityGapRoutes(input.rows, policy);
const requestedTitles = [...new Set(routes.flatMap(route =>
  discoverRepeatabilityGapCandidateRequests(route, policy).map(request => request.requestedTitle)
))].sort((a, b) => a.localeCompare(b));
const fetchedResolutions = await wikiRevisionResolutions(requestedTitles);
const built = buildActivityReferenceCollectionMemberRepeatabilityGapEvidence({
  routingRecords: input.rows,
  fetchedResolutions,
  policy,
  repeatabilityPolicy,
  contentHash: hash
});
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_source_authored_link_corroborating_repeatability_evidence_without_semantic_promotion',
  api: WIKI_API,
  fetchMode: 'current revisions for all main-namespace pages linked on exact structural-signal lines or exact retained collection rows',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  repeatabilitySignalPolicy: { id: repeatabilityPolicy.policy, file: repeatabilityPolicyFile, contentHash: hash(repeatabilityPolicy) },
  inputSnapshot,
  requestedTitles,
  fetchedRevisions: fetchedResolutions.map(resolution => {
    const revision = resolution.page?.revisions?.[0];
    const content = revision?.slots?.main?.content;
    return {
      requestedTitle: resolution.requestedTitle,
      normalizedTitle: resolution.normalizedTitle,
      resolvedTitle: resolution.page?.title || resolution.resolvedTitle,
      redirected: resolution.redirected === true,
      namespace: resolution.page?.ns ?? null,
      pageId: resolution.page?.pageid || null,
      revision: revision?.revid ? String(revision.revid) : null,
      timestamp: revision?.timestamp || null,
      contentHash: typeof content === 'string' ? hash(content) : null
    };
  }),
  audit: built.audit
};
const snapshot = await writeSnapshot(
  root,
  'activity-reference-collection-member-repeatability-gap-evidence',
  built.records.map(record => ({ ...record, contentHash: hash(record) })),
  source
);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  repeatabilitySignalPolicy: source.repeatabilitySignalPolicy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-repeatability-gap-evidence-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    candidateDiscoveryCoverage: report.candidateDiscoveryCoverage,
    sourceAlignmentCoverage: report.sourceAlignmentCoverage,
    repeatabilitySignalCoverage: report.repeatabilitySignalCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    evidencePacketAttemptCoverageComplete: report.evidencePacketAttemptCoverageComplete,
    repeatabilityGapEvidencePacketCoverageComplete: report.repeatabilityGapEvidencePacketCoverageComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
