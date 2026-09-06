import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ACTIVITY_EVIDENCE_INGESTION_LINEAGE_CONTRACT,
  buildLineageAuditQuery,
  buildLineageBackfillSql,
  buildLineageInsertAndReconciliationSql,
  expectedLineageRows
} from '../db/activity-evidence-ingestion-lineage-lib.mjs';

const runId = '11111111-1111-1111-1111-111111111111';
const model = {
  domain:'example-domain',
  runId,
  statements:[
    {recordKey:'example:1',sourceRevision:'123',contentHash:'a'.repeat(64)},
    {recordKey:'example:2',sourceRevision:'124',contentHash:'b'.repeat(64)}
  ]
};

test('lineage migration is one-to-one, foreign-keyed, indexed, and transactional',()=>{
  const sql=fs.readFileSync('platform/db/migrations/0009_activity_evidence_ingestion_lineage.sql','utf8');
  assert.match(sql,/^BEGIN;/m);
  assert.match(sql,/activity_evidence_id uuid PRIMARY KEY REFERENCES activity_evidence\(id\) ON DELETE CASCADE/);
  assert.match(sql,/ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs\(id\) ON DELETE RESTRICT/);
  assert.match(sql,/CREATE INDEX activity_evidence_ingestion_lineage_run_idx/);
  assert.match(sql,/COMMIT;/);
});

test('lineage rows preserve exact accepted statement identity',()=>{
  assert.equal(ACTIVITY_EVIDENCE_INGESTION_LINEAGE_CONTRACT,'sensum.activity-evidence-ingestion-lineage.v1');
  assert.deepEqual(expectedLineageRows(model,'raw_example'),[
    {runId,domain:'example-domain',factKind:'raw_example',recordKey:'example:1',sourceRevision:'123',contentHash:'a'.repeat(64)},
    {runId,domain:'example-domain',factKind:'raw_example',recordKey:'example:2',sourceRevision:'124',contentHash:'b'.repeat(64)}
  ]);
});

test('future materialization writes lineage in the caller transaction and reconciles the exact run',()=>{
  const sql=buildLineageInsertAndReconciliationSql(model,'raw_example');
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.match(sql,/l\.ingestion_run_id=e\.ingestion_run_id/);
  assert.match(sql,/r\.domain=e\.domain/);
  assert.match(sql,/ON CONFLICT \(activity_evidence_id\) DO NOTHING/);
  assert.doesNotMatch(sql,/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/i);
});

test('backfill is transactional, idempotent, and fails closed on extra or missing lineage',()=>{
  const sql=buildLineageBackfillSql([{model,factKind:'raw_example'}]);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/registered evidence statement remains unlinked/);
  assert.match(sql,/unexpected registered evidence lineage exists/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/i);
});

test('duplicate expected evidence identity is rejected before SQL execution',()=>{
  assert.throws(()=>buildLineageBackfillSql([{model:{...model,statements:[model.statements[0],model.statements[0]]},factKind:'raw_example'}]),/duplicate_expected_lineage_identity/);
});

test('audit reconciles totals, missing links, exact run bindings, and per-domain counts',()=>{
  const sql=buildLineageAuditQuery([{model,factKind:'raw_example'}]);
  assert.match(sql,/expectedLineageRows/);
  assert.match(sql,/unlinkedStatements/);
  assert.match(sql,/mismatchedExpectedLinks/);
  assert.match(sql,/e\.ingestion_run_id::uuid/);
  assert.match(sql,/json_object_agg\(domain,n\)/);
});

test('backfill audit contract forbids semantic or production side effects',()=>{
  const contract=JSON.parse(fs.readFileSync('platform/contracts/activity-evidence-ingestion-lineage-backfill-audit-v1.json','utf8'));
  assert.deepEqual(contract.requiredGates,['allStatementsLinked','exactRunBindings','activityEvidenceUnchanged','idempotentReapplication','foreignKeysEnforced']);
  assert.ok(contract.forbiddenEffects.includes('optimizer promotion'));
  assert.ok(contract.forbiddenEffects.includes('production mutation'));
});
