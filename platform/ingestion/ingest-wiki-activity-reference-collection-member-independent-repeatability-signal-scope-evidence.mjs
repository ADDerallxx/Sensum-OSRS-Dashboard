import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionResolutions } from './activity-evidence-lib.mjs';
import {
  buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence,
  discoverIndependentRepeatabilitySignalScopeLinkRequests,
  selectIndependentRepeatabilitySignalScopeRoutes
} from './activity-reference-collection-member-independent-repeatability-signal-scope-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));

async function latestIndependentSourceEvidenceSnapshot() {
  const domain = 'activity-reference-collection-member-independent-repeatability-source-evidence';
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const file = path.join(root, directory, domain + '.ndjson');
      const raw = await fs.readFile(file, 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.independentSourceEvidenceCoverageComplete !== true
        || manifest.source?.audit?.publishable !== true) reasons.push('independent_source_evidence_input_not_publishable');
      if (rows.some(record => record.contract !== policy.inputContract)) reasons.push('unexpected_independent_source_evidence_contract');
      if (!rows.length) reasons.push('no_independent_source_evidence_records');
      if (reasons.length) {
        rejections.push({ directory, reasons });
        continue;
      }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid independent repeatability-source evidence snapshot exists.');
}

const input = await latestIndependentSourceEvidenceSnapshot();
const routes = selectIndependentRepeatabilitySignalScopeRoutes(input.rows, policy);
const requests = discoverIndependentRepeatabilitySignalScopeLinkRequests(routes, policy);
const requestedTitles = requests.map(request => request.requestedTitle);
const targetResolutions = await wikiRevisionResolutions(requestedTitles);
const built = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence({
  sourceEvidenceRecords: input.rows,
  targetResolutions,
  policy,
  contentHash: hash
});
const inputSnapshot = {
  directory: input.directory,
  contentHash: input.manifest.contentHash,
  rejections: input.rejections
};
const source = {
  kind: 'revision_pinned_exact_signal_line_source_authored_main_namespace_link_scope_evidence_without_scope_or_repeatability_verdict',
  api: WIKI_API,
  fetchMode: 'complete current revision content for every unique main-namespace source-authored link target occurring on an exact retained repeatability-signal line',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  requestedTitles,
  requestContexts: requests,
  fetchedTargetRevisions: targetResolutions.map(resolution => {
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
  'activity-reference-collection-member-independent-repeatability-signal-scope-evidence',
  built.records.map(record => ({ ...record, contentHash: hash(record) })),
  source
);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(
  root,
  'activity-reference-collection-member-independent-repeatability-signal-scope-evidence-audits',
  generatedAt.replace(/[:.]/g, '-')
);
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    signalCoverage: report.signalCoverage,
    exactLineLinkCoverage: report.exactLineLinkCoverage,
    resolutionCoverage: report.resolutionCoverage,
    stableIdentityComparisonCoverage: report.stableIdentityComparisonCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    signalScopeEvidenceAttemptCoverageComplete: report.signalScopeEvidenceAttemptCoverageComplete,
    independentSignalScopeEvidenceCoverageComplete: report.independentSignalScopeEvidenceCoverageComplete,
    canonicalActivityScopeReviewComplete: report.canonicalActivityScopeReviewComplete,
    repeatabilityReviewComplete: report.repeatabilityReviewComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
