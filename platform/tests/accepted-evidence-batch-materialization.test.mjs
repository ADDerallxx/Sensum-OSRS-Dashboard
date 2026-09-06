import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  ACCEPTED_EVIDENCE_BATCH_MATERIALIZATION_CONTRACT,
  runAcceptedEvidenceBatchMaterialization
} from '../db/materialize-accepted-evidence-batch.mjs';

const domains=['alpha-domain','beta-domain','gamma-domain'];
const ids={
  'alpha-domain':'11111111-1111-1111-1111-111111111111',
  'beta-domain':'22222222-2222-2222-2222-222222222222',
  'gamma-domain':'33333333-3333-3333-3333-333333333333'
};

function model(domain) {
  return {
    domain,runId:ids[domain],snapshotId:ids[domain].replace(/^./,'9'),
    snapshotContentHash:hash(`snapshot:${domain}`),auditContentHash:hash(`audit:${domain}`),materializationHash:hash(`materialization:${domain}`),
    counts:{sources:1,records:1,statements:1}
  };
}

function summary() {
  return {contract:'sensum.local-evidence-catalog.v3',view:'summary',counts:{evidenceStatements:3,evidenceStatementLineageRows:3,unlinkedEvidenceStatements:0,optimizerEligibleStatements:0},evidenceStates:{candidate:3,verified:0}};
}

function domainRows() {
  return domains.map(domain=>({domain,runId:ids[domain],sourceCount:1,recordCount:1,declaredStatementCount:1,directStatementCount:1,sourceCountReconciles:true,recordCountReconciles:true,statementCountReconciles:true,snapshotContentHash:hash(`snapshot:${domain}`),materializationHash:hash(`materialization:${domain}`)}));
}

function runtime(overrides={}) {
  let queryCalls=0;
  const executions=[];
  return {
    calls:{get query(){return queryCalls;},executions},
    dependencies:{
      domains:()=>domains,
      getAdapter:domain=>({domain,factKind:`raw_${domain}`,auditDirectory:'audits',auditContract:'audit.v1',dataFile:'data.ndjson'}),
      loadInput:async({adapter})=>({model:model(adapter.domain),auditFile:`C:/audit/${adapter.domain}.json`,snapshotDir:`C:/snapshot/${adapter.domain}`}),
      materialize:async options=>{executions.push(options.domain); return {contentHash:hash(`report:${options.domain}`),reportDirectory:`reports/${options.domain}`,reconciled:{statements:1,lineage:1}};},
      query:options=>{queryCalls++; return options.view==='summary'?summary():{contract:'sensum.local-evidence-catalog.v3',view:'domains',rows:domainRows()};},
      now:()=> '2026-09-06T20:00:00.000Z',
      ...overrides
    }
  };
}

test('successful batch prevalidates, attempts, and reconciles every registered domain',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sensum-batch-success-'));
  try {
    const rt=runtime();
    const report=await runAcceptedEvidenceBatchMaterialization({root},rt.dependencies);
    assert.equal(ACCEPTED_EVIDENCE_BATCH_MATERIALIZATION_CONTRACT,'sensum.accepted-evidence-batch-materialization-audit.v1');
    assert.equal(report.publishable,true);
    assert.equal(report.allInputsPrevalidated,true);
    assert.equal(report.allRegisteredDomainsSucceeded,true);
    assert.equal(report.allRegisteredDomainsReconciled,true);
    assert.equal(report.directStatementLineageComplete,true);
    assert.equal(report.semanticStatePreserved,true);
    assert.deepEqual(rt.calls.executions,domains);
    assert.equal(rt.calls.query,3);
    const stored=JSON.parse(fs.readFileSync(path.join(process.cwd(),report.reportDirectory,'report.json'),'utf8'));
    assert.equal(stored.contentHash,hash(Object.fromEntries(Object.entries(stored).filter(([key])=>key!=='contentHash'))));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('one failed preflight prevents every database mutation attempt',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sensum-batch-preflight-'));
  try {
    const rt=runtime({loadInput:async({adapter})=>{if(adapter.domain==='beta-domain')throw new Error('fixture_input_rejected'); return {model:model(adapter.domain),auditFile:`C:/audit/${adapter.domain}.json`,snapshotDir:`C:/snapshot/${adapter.domain}`};}});
    const report=await runAcceptedEvidenceBatchMaterialization({root},rt.dependencies);
    assert.equal(report.publishable,false);
    assert.equal(report.failureStage,'preflight');
    assert.equal(report.databaseMutationAttempts,0);
    assert.equal(report.executions.length,0);
    assert.equal(rt.calls.executions.length,0);
    assert.equal(rt.calls.query,0);
    assert.deepEqual(report.preflightFailures,[{domain:'beta-domain',error:'fixture_input_rejected'}]);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('execution failure is isolated, all domains are attempted, and batch fails closed',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sensum-batch-execution-'));
  try {
    const executions=[];
    const rt=runtime({materialize:async options=>{executions.push(options.domain); if(options.domain==='beta-domain')throw new Error('fixture_transaction_failed'); return {contentHash:hash(`report:${options.domain}`),reportDirectory:`reports/${options.domain}`,reconciled:{statements:1,lineage:1}};}});
    const report=await runAcceptedEvidenceBatchMaterialization({root},rt.dependencies);
    assert.deepEqual(executions,domains);
    assert.equal(report.allRegisteredDomainsAttempted,true);
    assert.equal(report.allRegisteredDomainsSucceeded,false);
    assert.equal(report.failureStage,'execution');
    assert.equal(report.publishable,false);
    assert.deepEqual(report.executions.map(row=>row.status),['succeeded','failed','succeeded']);
    assert.equal(report.executions[1].error,'fixture_transaction_failed');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('catalog identity or lineage drift makes a successful execution non-publishable',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sensum-batch-reconcile-'));
  try {
    let calls=0;
    const rt=runtime({query:options=>{calls++; if(options.view==='summary'){const value=summary(); if(calls>1)value.counts.unlinkedEvidenceStatements=1; return value;} const rows=domainRows(); rows[1].materializationHash='f'.repeat(64); return {contract:'sensum.local-evidence-catalog.v3',view:'domains',rows};}});
    const report=await runAcceptedEvidenceBatchMaterialization({root},rt.dependencies);
    assert.equal(report.allRegisteredDomainsSucceeded,true);
    assert.equal(report.allRegisteredDomainsReconciled,false);
    assert.equal(report.directStatementLineageComplete,false);
    assert.equal(report.failureStage,'reconciliation');
    assert.equal(report.publishable,false);
    assert.ok(report.reconciliation[1].blockers.includes('catalog_materialization_identity_mismatch'));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('contract explicitly encodes preflight and per-domain failure isolation',()=>{
  const contract=JSON.parse(fs.readFileSync('platform/contracts/accepted-evidence-batch-materialization-audit-v1.json','utf8'));
  assert.equal(contract.failurePolicy.preflightFailureAllowsDatabaseMutation,false);
  assert.equal(contract.failurePolicy.executionTransactionsArePerDomain,true);
  assert.equal(contract.failurePolicy.anyDomainFailureAllowsPublishableBatch,false);
  assert.ok(contract.forbiddenEffects.includes('optimizer promotion'));
  assert.ok(contract.forbiddenEffects.includes('production mutation'));
});
