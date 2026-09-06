import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {hash} from '../ingestion/lib.mjs';
import {
  ACCEPTED_EVIDENCE_REGISTRY_CONTRACT,
  acceptedEvidenceDomains,
  getAcceptedEvidenceAdapter
} from './accepted-evidence-materialization-registry-lib.mjs';
import {loadAcceptedInput, runAcceptedEvidenceMaterialization} from './materialize-accepted-evidence.mjs';
import {queryLocalEvidenceCatalog} from './query-local-evidence-catalog.mjs';

export const ACCEPTED_EVIDENCE_BATCH_MATERIALIZATION_CONTRACT = 'sensum.accepted-evidence-batch-materialization-audit.v1';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const cleanError = error => String(error?.message || error || 'unknown_error').replace(/[\r\n]+/g,' ').slice(0,2000);

async function writeReport(root, report) {
  report.contentHash=hash(report);
  const output=path.join(root,'accepted-evidence-batch-materialization-audits',report.generatedAt.replace(/[:.]/g,'-'));
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  return {...report,reportDirectory:path.relative(process.cwd(),output)};
}

function preflightSummary(domain, adapter, loaded) {
  const {model,auditFile,snapshotDir}=loaded;
  return {
    domain,
    factKind:adapter.factKind,
    runId:model.runId,
    snapshotId:model.snapshotId,
    snapshotDirectory:path.basename(snapshotDir),
    auditFile:path.relative(process.cwd(),auditFile),
    snapshotContentHash:model.snapshotContentHash,
    auditContentHash:model.auditContentHash,
    materializationHash:model.materializationHash,
    counts:model.counts
  };
}

function reconcileDomain(preflight, catalogRows) {
  const row=catalogRows.find(candidate=>candidate.runId===preflight.runId);
  const expectedSources=Number(preflight.counts.sources);
  const expectedRecords=Number(preflight.counts.records);
  const expectedStatements=Number(preflight.counts.statements);
  const blockers=[];
  if (!row) blockers.push('catalog_run_missing');
  else {
    if (row.domain!==preflight.domain) blockers.push('catalog_domain_mismatch');
    if (Number(row.sourceCount)!==expectedSources || row.sourceCountReconciles!==true) blockers.push('catalog_source_count_mismatch');
    if (Number(row.recordCount)!==expectedRecords || row.recordCountReconciles!==true) blockers.push('catalog_record_count_mismatch');
    if (Number(row.declaredStatementCount)!==expectedStatements || Number(row.directStatementCount)!==expectedStatements || row.statementCountReconciles!==true) blockers.push('catalog_statement_lineage_count_mismatch');
    if (row.snapshotContentHash!==preflight.snapshotContentHash || row.materializationHash!==preflight.materializationHash) blockers.push('catalog_materialization_identity_mismatch');
  }
  return {domain:preflight.domain,runId:preflight.runId,reconciled:blockers.length===0,blockers,catalogRow:row || null};
}

export async function runAcceptedEvidenceBatchMaterialization(options = {}, dependencies = {}) {
  const root=path.resolve(options.root || argument('root') || '.platform-data');
  const databaseRuntime={
    container:options.container || argument('container') || 'sensum-v4-postgres',
    database:options.database || argument('database') || 'sensum_v4',
    user:options.user || argument('user') || 'sensum_v4'
  };
  const domains=(dependencies.domains || acceptedEvidenceDomains)().slice().sort();
  const adapterFor=dependencies.getAdapter || getAcceptedEvidenceAdapter;
  const load=dependencies.loadInput || loadAcceptedInput;
  const materialize=dependencies.materialize || runAcceptedEvidenceMaterialization;
  const query=dependencies.query || queryLocalEvidenceCatalog;
  const now=dependencies.now || (()=>new Date().toISOString());
  const generatedAt=now();

  const settled=await Promise.allSettled(domains.map(async domain=>{
    const adapter=adapterFor(domain);
    const loaded=await load({root,adapter});
    return {adapter,loaded,summary:preflightSummary(domain,adapter,loaded)};
  }));
  const preflight=[];
  const preflightFailures=[];
  settled.forEach((result,index)=>{
    if (result.status==='fulfilled') preflight.push(result.value);
    else preflightFailures.push({domain:domains[index],error:cleanError(result.reason)});
  });
  preflight.sort((a,b)=>a.summary.domain.localeCompare(b.summary.domain));
  const inputSetHash=hash(preflight.map(entry=>({domain:entry.summary.domain,factKind:entry.summary.factKind,runId:entry.summary.runId,snapshotContentHash:entry.summary.snapshotContentHash,auditContentHash:entry.summary.auditContentHash,materializationHash:entry.summary.materializationHash,counts:entry.summary.counts})));

  if (preflightFailures.length) {
    return writeReport(root,{
      contract:ACCEPTED_EVIDENCE_BATCH_MATERIALIZATION_CONTRACT,generatedAt,registryContract:ACCEPTED_EVIDENCE_REGISTRY_CONTRACT,
      registryDomains:domains,inputSetHash,preflight:preflight.map(entry=>entry.summary),preflightFailures,
      executions:[],reconciliation:[],failureStage:'preflight',allInputsPrevalidated:false,allRegisteredDomainsAttempted:false,
      allRegisteredDomainsSucceeded:false,allRegisteredDomainsReconciled:false,databaseMutationAttempts:0,
      optimizerPromotions:0,verifiedBestAuthorizations:0,productionMutations:0,publishable:false
    });
  }

  const before=query({view:'summary'},databaseRuntime);
  const executions=[];
  for (const entry of preflight) {
    try {
      const report=await materialize({root,domain:entry.summary.domain,snapshotDir:entry.loaded.snapshotDir,audit:entry.loaded.auditFile,...databaseRuntime});
      executions.push({domain:entry.summary.domain,status:'succeeded',reportContentHash:report.contentHash,reportDirectory:report.reportDirectory,reconciledStatements:Number(report.reconciled?.statements),reconciledLineage:Number(report.reconciled?.lineage)});
    } catch (error) {
      executions.push({domain:entry.summary.domain,status:'failed',error:cleanError(error)});
    }
  }
  const after=query({view:'summary'},databaseRuntime);
  const catalog=query({view:'domains',limit:500},databaseRuntime);
  const reconciliation=preflight.map(entry=>reconcileDomain(entry.summary,catalog.rows));
  const allSucceeded=executions.length===domains.length && executions.every(row=>row.status==='succeeded');
  const allReconciled=reconciliation.length===domains.length && reconciliation.every(row=>row.reconciled);
  const lineageComplete=Number(after.counts?.evidenceStatementLineageRows)===Number(after.counts?.evidenceStatements) && Number(after.counts?.unlinkedEvidenceStatements)===0;
  const semanticStatePreserved=Number(after.counts?.optimizerEligibleStatements)===Number(before.counts?.optimizerEligibleStatements) && Number(after.evidenceStates?.verified || 0)===Number(before.evidenceStates?.verified || 0);
  const publishable=allSucceeded && allReconciled && lineageComplete && semanticStatePreserved;
  return writeReport(root,{
    contract:ACCEPTED_EVIDENCE_BATCH_MATERIALIZATION_CONTRACT,generatedAt,registryContract:ACCEPTED_EVIDENCE_REGISTRY_CONTRACT,
    registryDomains:domains,inputSetHash,preflight:preflight.map(entry=>entry.summary),preflightFailures:[],
    before:{counts:before.counts,evidenceStates:before.evidenceStates},executions,reconciliation,
    after:{counts:after.counts,evidenceStates:after.evidenceStates},failureStage:publishable?null:(allSucceeded?'reconciliation':'execution'),
    allInputsPrevalidated:true,allRegisteredDomainsAttempted:executions.length===domains.length,allRegisteredDomainsSucceeded:allSucceeded,
    allRegisteredDomainsReconciled:allReconciled,directStatementLineageComplete:lineageComplete,semanticStatePreserved,
    databaseMutationAttempts:executions.length,optimizerPromotions:0,verifiedBestAuthorizations:0,productionMutations:0,publishable
  });
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  const report=await runAcceptedEvidenceBatchMaterialization();
  console.log(JSON.stringify(report,null,2));
  if (!report.publishable) process.exitCode=1;
}
