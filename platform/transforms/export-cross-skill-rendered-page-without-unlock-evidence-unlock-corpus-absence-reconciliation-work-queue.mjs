import fs from 'node:fs/promises';
import path from 'node:path';
import { hash, writeSnapshot } from '../ingestion/lib.mjs';
import { buildUnlockCorpusAbsenceReconciliationWorkQueue } from './cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-lib.mjs';

const root = path.resolve(process.argv.find(value => value.startsWith('--root='))?.slice(7) || '.platform-data');
const policyFile = 'platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-v1.json';
const policy = JSON.parse(await fs.readFile(path.resolve(policyFile), 'utf8'));
const domains = {
  workQueue: 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue',
  crosswalk: 'skill-training-guide-unlock-page-crosswalk',
  inventory: 'skill-level-unlock-inventory',
  equivalence: 'unlock-linked-page-wiki-equivalence',
  output: 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue'
};

async function timestampDirectories() {
  return (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry => entry.name).sort().reverse();
}

async function readSnapshot(directory, domain) {
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  if (manifest.domain !== domain || manifest.records !== records.length || manifest.contentHash !== hash(raw)) throw new Error(`${domain} snapshot ${directory} failed manifest validation.`);
  return { directory, raw, records, manifest };
}

async function latestSnapshot(domain, accept) {
  for (const directory of await timestampDirectories()) {
    try {
      const snapshot = await readSnapshot(directory, domain);
      if (accept(snapshot.manifest.source?.audit || {}, snapshot)) return snapshot;
    } catch (error) {
      if (error.code !== 'ENOENT') continue;
    }
  }
  throw new Error(`No valid ${domain} snapshot exists.`);
}

const workQueue = await latestSnapshot(domains.workQueue, audit => audit.queueExportComplete === true && audit.publishable === true &&
  audit.reconciliationComplete === false && audit.completeActivityUniverse === false && audit.evidenceWorkCoverage?.requiredChannelCounts?.level_unlock_corpus_absence_reconciliation > 0 &&
  !audit.queueCoverage?.duplicateOutputPartitionKeys?.length && !audit.queueCoverage?.missingOutputPartitionKeys?.length && !audit.queueCoverage?.unexpectedOutputPartitionKeys?.length &&
  !audit.queueCoverage?.recordMismatchPartitionKeys?.length && !audit.semanticPreservationCoverage?.unsupportedPromotionPartitionKeys?.length);

const crosswalk = await latestSnapshot(domains.crosswalk, audit => audit.crosswalkCoverageComplete === true && audit.publishable === true &&
  audit.completeActivityUniverse === false && audit.renderedTargetCoverage?.exactRenderedTargetSetAndContextMatch === true &&
  !audit.crossSourceIdentityCoverage?.matchLogicMismatchKeys?.length && !audit.semanticRoutingCoverage?.unsupportedPromotionTargetKeys?.length);

const equivalenceDirectory = crosswalk.manifest.source?.inputSnapshots?.unlockEquivalence?.directory;
const equivalenceHash = crosswalk.manifest.source?.inputSnapshots?.unlockEquivalence?.contentHash;
if (!equivalenceDirectory || !equivalenceHash) throw new Error('Crosswalk snapshot does not bind an unlock-equivalence snapshot.');
const equivalence = await readSnapshot(equivalenceDirectory, domains.equivalence);
if (equivalence.manifest.contentHash !== equivalenceHash || equivalence.manifest.source?.audit?.wikiPageEquivalenceComplete !== true ||
  equivalence.manifest.source?.audit?.publishable !== true || equivalence.manifest.source?.audit?.completeActivityUniverse !== false ||
  equivalence.manifest.source?.audit?.inputTargetCoverage?.exactTargetSetMatch !== true ||
  equivalence.manifest.source?.audit?.pageIdentityCoverage?.duplicateCanonicalWikiPageKeys?.length ||
  equivalence.manifest.source?.audit?.pageIdentityCoverage?.invalidRecordKeys?.length ||
  equivalence.manifest.source?.audit?.pageIdentityCoverage?.inconsistentGroupKeys?.length) {
  throw new Error('Crosswalk-bound unlock-equivalence snapshot failed exact validation.');
}

const inventory = await latestSnapshot(domains.inventory, audit => audit.rawInventoryComplete === true && audit.publishable === true &&
  audit.completeActivityUniverse === false && audit.officialSkillDomain?.missingSkillKeys?.length === 0 &&
  audit.officialSkillDomain?.unexpectedSkillKeys?.length === 0 && audit.officialSkillDomain?.duplicateSkillKeys?.length === 0 &&
  audit.statementCoverage?.countsMatch === true);

const snapshots = {
  workQueue: workQueue.manifest.contentHash,
  crosswalk: crosswalk.manifest.contentHash,
  inventory: inventory.manifest.contentHash,
  equivalence: equivalence.manifest.contentHash
};
const sources = {
  workQueue: workQueue.manifest.source,
  crosswalk: crosswalk.manifest.source,
  inventory: inventory.manifest.source,
  equivalence: equivalence.manifest.source
};
const built = buildUnlockCorpusAbsenceReconciliationWorkQueue({
  workQueueRecords: workQueue.records,
  crosswalkRecords: crosswalk.records,
  inventoryRecords: inventory.records,
  equivalenceRecords: equivalence.records,
  policy, snapshots, sources, contentHash: hash
});
const inputSnapshots = {
  workQueue: { directory: workQueue.directory, contentHash: snapshots.workQueue },
  crosswalk: { directory: crosswalk.directory, contentHash: snapshots.crosswalk },
  inventory: { directory: inventory.directory, contentHash: snapshots.inventory },
  equivalence: { directory: equivalence.directory, contentHash: snapshots.equivalence }
};

if (!built.audit.publishable) {
  console.log(JSON.stringify({ contract: built.audit.contract, accepted: false, inputSnapshots, audit: built.audit, outputWritten: false }, null, 2));
  process.exitCode = 2;
} else {
  const source = {
    kind: 'exact_stable_page_id_absence_review_queue_over_complete_revision_pinned_level_up_table_link_corpus_without_requirement_or_semantic_promotion',
    policy: { id: policy.policy, file: policyFile, contentHash: hash(policy) },
    inputSnapshots,
    corpusEvidenceContentHash: hash(built.corpusEvidence),
    audit: built.audit
  };
  const snapshot = await writeSnapshot(root, domains.output, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
  const generatedAt = new Date().toISOString();
  const report = {
    ...built.audit, generatedAt, policy: source.policy, inputSnapshots,
    outputSnapshot: { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash }
  };
  report.contentHash = hash(withoutContentHash(report));
  const reportDirectory = path.join(root, `${domains.output}-audits`, generatedAt.replace(/[:.]/g, '-'));
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(reportDirectory, 'queue.tsv'), built.artifacts.queueTsv);
  await fs.writeFile(path.join(reportDirectory, 'blank-decisions.ndjson'), built.artifacts.blankDecisions);
  await fs.writeFile(path.join(reportDirectory, 'corpus-evidence.json'), built.artifacts.corpusEvidenceJson);
  console.log(JSON.stringify({
    contract: report.contract, accepted: true, inputSnapshots,
    outputSnapshot: report.outputSnapshot, reportDirectory,
    artifactHashes: {
      queueTsv: hash(built.artifacts.queueTsv),
      blankDecisions: hash(built.artifacts.blankDecisions),
      corpusEvidenceJson: hash(built.artifacts.corpusEvidenceJson)
    },
    coverage: report
  }, null, 2));
}

function withoutContentHash(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'contentHash'));
}
