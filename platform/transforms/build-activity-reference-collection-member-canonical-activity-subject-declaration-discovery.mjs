import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildCanonicalActivitySubjectDeclarationDiscovery } from './activity-reference-collection-member-canonical-activity-subject-declaration-discovery-lib.mjs';

const root = path.resolve(process.argv.find(argument => argument.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-discovery-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const domain = 'activity-reference-collection-member-independent-repeatability-signal-subject-predicate-disposition';

async function latestInput() {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(x => x.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(x.name)).map(x => x.name).sort().reverse();
  const rejections = [];
  for (const directory of directories) {
    try {
      const raw = await fs.readFile(path.join(root, directory, domain + '.ndjson'), 'utf8');
      const rows = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
      const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
      const reasons = [];
      if (manifest.domain !== domain) reasons.push('manifest_domain_mismatch');
      if (manifest.records !== rows.length) reasons.push('record_count_mismatch');
      if (manifest.contentHash !== hash(raw)) reasons.push('content_hash_mismatch');
      if (manifest.source?.audit?.subjectPredicateDispositionAttemptCoverageComplete !== true || manifest.source?.audit?.signalSubjectPredicateDispositionCoverageComplete !== true || manifest.source?.audit?.publishable !== true) reasons.push('subject_predicate_disposition_input_not_publishable');
      if (!rows.length || rows.some(row => row.contract !== policy.inputContract)) reasons.push('unexpected_or_empty_input_contract');
      if (reasons.length) { rejections.push({ directory, reasons }); continue; }
      return { directory, rows, manifest, rejections };
    } catch (error) { if (error.code !== 'ENOENT') rejections.push({ directory, reasons: ['snapshot_validation_error'], message: error.message }); }
  }
  throw new Error('No valid signal subject-predicate disposition snapshot exists.');
}

const input = await latestInput();
const built = buildCanonicalActivitySubjectDeclarationDiscovery({ dispositionRecords: input.rows, policy });
const inputSnapshot = { directory: input.directory, contentHash: input.manifest.contentHash, rejections: input.rejections };
const source = { kind: 'revision_pinned_candidate_level_canonical_activity_subject_declaration_discovery_without_semantic_or_downstream_promotion', policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) }, inputSnapshot, audit: built.audit };
const snapshot = await writeSnapshot(root, 'activity-reference-collection-member-canonical-activity-subject-declaration-discovery', built.records.map(row => ({ ...row, contentHash: hash(row) })), source);
const generatedAt = new Date().toISOString();
const report = { ...built.audit, generatedAt, policy: source.policy, inputSnapshot, outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash } };
report.contentHash = hash({ ...report, contentHash: undefined });
const output = path.join(root, 'activity-reference-collection-member-canonical-activity-subject-declaration-discovery-audits', generatedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ contract: report.contract, generatedAt, inputSnapshot, outputSnapshot: report.outputSnapshot, coverage: { signalConsolidationCoverage: report.signalConsolidationCoverage, searchBoundaryCoverage: report.searchBoundaryCoverage, revisionCoverage: report.revisionCoverage, semanticPromotionCoverage: report.semanticPromotionCoverage, canonicalActivitySubjectDeclarationDiscoveryCoverageComplete: report.canonicalActivitySubjectDeclarationDiscoveryCoverageComplete, canonicalActivitySubjectBindingReviewComplete: report.canonicalActivitySubjectBindingReviewComplete, completeActivityUniverse: report.completeActivityUniverse, absoluteBestGate: report.absoluteBestGate, blockers: report.blockers, publishable: report.publishable } }, null, 2));
if (!report.publishable) process.exitCode = 2;
