import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from './lib.mjs';
import { WIKI_API, wikiRevisionResolutions } from './activity-evidence-lib.mjs';
import { buildActivityInfoboxSchemaSemanticsEvidence } from './activity-infobox-schema-semantics-evidence-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/activity-infobox-schema-semantics-evidence-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const domain = 'activity-reference-collection-member-canonical-activity-subject-declaration-semantic-evidence-work-routing';

async function latestRoutingSnapshot() {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.routingCoverageComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('semantic_evidence_work_routing_not_publishable');
      if (rows.some(record => record.contract !== policy.inputContract)) reasons.push('unexpected_semantic_evidence_work_routing_contract');
      if (!rows.length) reasons.push('no_semantic_evidence_work_routing_records');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) {
      if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message });
    }
  }
  throw new Error('No valid canonical-activity subject-declaration semantic evidence-work routing snapshot exists.');
}

const input = await latestRoutingSnapshot();
const requestedTitles = policy.requiredSources.map(source => source.requestedTitle);
const fetchedResolutions = await wikiRevisionResolutions(requestedTitles);
const built = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: input.rows, fetchedResolutions, policy, contentHash: hash });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = {
  kind: 'revision_pinned_activity_infobox_template_documentation_and_module_schema_semantics_evidence_without_subject_binding',
  api: WIKI_API,
  fetchMode: 'current exact revision source for every policy-required activity-infobox schema page',
  policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
  inputSnapshot,
  fetchedRevisions: fetchedResolutions.map(resolution => {
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
  }),
  audit: built.audit
};
const snapshot = await writeSnapshot(root, 'activity-infobox-schema-semantics-evidence', built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
const generatedAt = new Date().toISOString();
const report = {
  ...built.audit,
  generatedAt,
  policy: source.policy,
  inputSnapshot,
  fetchedRevisions: source.fetchedRevisions,
  outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
};
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-infobox-schema-semantics-evidence-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  contract: report.contract,
  generatedAt,
  inputSnapshot,
  fetchedRevisions: report.fetchedRevisions,
  outputSnapshot: report.outputSnapshot,
  coverage: {
    inputCoverage: report.inputCoverage,
    policyCoverage: report.policyCoverage,
    sourceRevisionCoverage: report.sourceRevisionCoverage,
    observationCoverage: report.observationCoverage,
    semanticPromotionCoverage: report.semanticPromotionCoverage,
    evidencePacketAttemptCoverageComplete: report.evidencePacketAttemptCoverageComplete,
    activityInfoboxSchemaSemanticsEvidenceCoverageComplete: report.activityInfoboxSchemaSemanticsEvidenceCoverageComplete,
    completeActivityUniverse: report.completeActivityUniverse,
    absoluteBestGate: report.absoluteBestGate,
    blockers: report.blockers,
    publishable: report.publishable
  }
}, null, 2));
if (!report.publishable) process.exitCode = 2;
