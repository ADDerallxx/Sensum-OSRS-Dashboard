import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {hash, json} from '../ingestion/lib.mjs';
import {queryLocalEvidenceCatalog} from './query-local-evidence-catalog.mjs';

export const LOCAL_EVIDENCE_DOMAIN_LINEAGE_AUDIT_CONTRACT = 'sensum.local-evidence-domain-lineage-audit.v2';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function auditLocalEvidenceDomainLineage(options = {}, runtime = {}) {
  const source = options.source || 'wiki-pageid:240934';
  const revision = options.revision || '14997080';
  const expectedLinks = Number(options.expectedLinks || 2);
  assert(Number.isInteger(expectedLinks) && expectedLinks >= 2, 'expected_shared_source_links_must_be_at_least_2');

  const query = runtime.query || queryLocalEvidenceCatalog;
  const queryRuntime = Object.fromEntries(Object.entries(runtime).filter(([key]) => key !== 'query'));
  const before = query({view:'summary'}, queryRuntime);
  const domains = query({view:'domains',limit:500}, queryRuntime);
  const lineage = query({view:'lineage',source,revision,limit:500}, queryRuntime);
  const after = query({view:'summary'}, queryRuntime);

  assert(json(before.counts) === json(after.counts) && json(before.evidenceStates) === json(after.evidenceStates), 'catalog_queries_changed_database_counts');
  assert(domains.rows.length > 0 && domains.rows.every(row => row.recordCountReconciles === true && row.sourceCountReconciles === true), 'domain_run_snapshot_counts_do_not_reconcile');
  assert(domains.rows.every(row => row.statementLineageState === 'direct_activity_evidence_ingestion_run_foreign_key' && row.statementCountReconciles === true && Number(row.directStatementCount) === Number(row.declaredStatementCount)), 'statement_run_lineage_does_not_reconcile');
  assert(lineage.rows.length === expectedLinks, 'shared_source_lineage_count_mismatch');
  assert(new Set(lineage.rows.map(row => `${row.sourceKey}|${row.url}|${row.revision}|${row.sourceContentHash}|${row.fetchedAt}`)).size === 1, 'shared_source_identity_drift');
  assert(new Set(lineage.rows.map(row => row.snapshotId)).size === expectedLinks, 'shared_source_snapshot_identity_not_unique');
  assert(new Set(lineage.rows.map(row => row.domain)).size === expectedLinks, 'shared_source_domain_identity_not_unique');
  assert(lineage.rows.every(row => Number(row.snapshotLinkCount) === expectedLinks), 'shared_source_link_count_not_global');

  const report = {
    contract:LOCAL_EVIDENCE_DOMAIN_LINEAGE_AUDIT_CONTRACT,
    generatedAt:new Date().toISOString(),
    catalogContract:before.contract,
    views:['summary','domains','lineage'],
    databaseCounts:after.counts,
    evidenceStates:after.evidenceStates,
    domains:{count:domains.rows.length,rows:domains.rows},
    sharedSource:{sourceKey:source,revision,title:lineage.rows[0].title,url:lineage.rows[0].url,sourceTimestamp:lineage.rows[0].sourceTimestamp,fetchedAt:lineage.rows[0].fetchedAt,sourceContentHash:lineage.rows[0].sourceContentHash,snapshotLinks:lineage.rows.length,domains:lineage.rows.map(row => row.domain).sort(),snapshotIds:lineage.rows.map(row => row.snapshotId).sort()},
    statementRunLineage:{complete:true,state:'direct_activity_evidence_ingestion_run_foreign_key',directStatements:domains.rows.reduce((sum,row)=>sum+Number(row.directStatementCount),0),declaredStatements:domains.rows.reduce((sum,row)=>sum+Number(row.declaredStatementCount),0),blocker:null},
    domainRecordAndSourceCountsReconciled:true,
    sharedSourceIdentityReusedWithoutDuplication:true,
    catalogCountsStableAcrossAudit:true,
    databaseTransactionsReadOnly:true,
    databaseMutations:0,
    optimizerPromotions:0,
    productionMutations:0,
    publishable:true
  };
  report.contentHash=hash(report);
  const root=path.resolve(options.root || '.platform-data');
  const output=path.join(root,'local-evidence-domain-lineage-audits',report.generatedAt.replace(/[:.]/g,'-'));
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  return {...report,reportDirectory:path.relative(process.cwd(),output)};
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  console.log(JSON.stringify(await auditLocalEvidenceDomainLineage({source:argument('source'),revision:argument('revision'),expectedLinks:argument('expected-links'),root:argument('root')},{docker:argument('docker'),container:argument('container'),database:argument('database'),user:argument('user')}),null,2));
}
