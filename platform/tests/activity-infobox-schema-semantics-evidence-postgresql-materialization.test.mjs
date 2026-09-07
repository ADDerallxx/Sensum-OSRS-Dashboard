import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_INFOBOX_SCHEMA_FACT_KIND,
  buildActivityInfoboxSchemaExistingSourceCountQuery,
  buildActivityInfoboxSchemaMaterializationSql,
  validateActivityInfoboxSchemaMaterializationInput,
  verifyActivityInfoboxSchemaReconciliation
} from '../db/activity-infobox-schema-semantics-evidence-materialization-lib.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const directory='2026-09-05T03-08-47-250Z';
const auditDirectory='2026-09-05T03-08-47-308Z';
const dataFile='activity-infobox-schema-semantics-evidence.ndjson';
const load=()=>(
  {
    raw:fs.readFileSync(path.join(root,'.platform-data',directory,dataFile),'utf8'),
    manifest:JSON.parse(fs.readFileSync(path.join(root,'.platform-data',directory,'manifest.json'),'utf8')),
    audit:JSON.parse(fs.readFileSync(path.join(root,'.platform-data','activity-infobox-schema-semantics-evidence-audits',auditDirectory,'report.json'),'utf8'))
  }
);
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
function mutateRecord(input,mutator) {
  const records=input.raw.trim().split(/\r?\n/).map(JSON.parse);
  mutator(records[0]);
  records[0].contentHash=hash(without(records[0],'contentHash'));
  input.raw=records.map(JSON.stringify).join('\n')+'\n';
  input.manifest.contentHash=hash(input.raw);
  input.audit.outputSnapshot.contentHash=input.manifest.contentHash;
  input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('real infobox schema evidence remains lossless, revision-pinned, deterministic, and semantically unresolved',()=>{
  const input=load(),first=validateActivityInfoboxSchemaMaterializationInput(input),second=validateActivityInfoboxSchemaMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:4,records:1,statements:1,schemaSources:3,schemaObservations:7});
  assert.equal(first.records[0].contentHash,input.raw.trim().split(/\r?\n/).map(JSON.parse)[0].contentHash);
  assert.equal(first.statements[0].payload.canonicalActivitySubjectBinding,null);
  assert.equal(first.statements[0].payload.canonicalActivityScopeVerdict,null);
  assert.equal(first.statements[0].payload.repeatabilityVerdict,null);
  assert.equal(first.statements[0].payload.optimizerEligible,false);
  assert.deepEqual(first.sources.map(source=>`${source.title}@${source.sourceRevision}`).sort(),[
    'Module:Infobox Activity@15325766',
    'Template:Infobox Activity/doc@15206128',
    'Template:Infobox Activity@15325765',
    'Wise Old Man tasks@14997080'
  ].sort());
});

test('schema source, observation, account, and semantic tampering fail closed',()=>{
  const source=load();mutateRecord(source,record=>{record.schemaEvidenceSources[0].sourceContentHash='d'.repeat(64);});
  assert.throws(()=>validateActivityInfoboxSchemaMaterializationInput(source),/schema_source_manifest_mismatch|schema_evidence_mismatch|conflicting_wiki_page_revision_identity/);
  const observation=load();mutateRecord(observation,record=>{record.schemaEvidenceSources[0].observations[0].literal='invented';});
  assert.throws(()=>validateActivityInfoboxSchemaMaterializationInput(observation),/schema_source_observation_invalid|schema_evidence_mismatch/);
  const account=load();mutateRecord(account,record=>{record.currentBaseLevel=34;});
  assert.throws(()=>validateActivityInfoboxSchemaMaterializationInput(account),/record_account_state_present/);
  const promoted=load();mutateRecord(promoted,record=>{record.activityInfoboxSchemaSemanticsEvidence.canonicalActivitySubjectBinding='Wise Old Man tasks';});
  assert.throws(()=>validateActivityInfoboxSchemaMaterializationInput(promoted),/schema_evidence_semantic_promotion|schema_evidence_mismatch/);
});

test('infobox schema SQL is transactional, insert-only, idempotent, and candidate-preserving',()=>{
  const model=validateActivityInfoboxSchemaMaterializationInput(load()),sql=buildActivityInfoboxSchemaMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,new RegExp(ACTIVITY_INFOBOX_SCHEMA_FACT_KIND));
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);
  assert.match(sql,/d\.fetched_at IS NOT NULL/);
  assert.match(buildActivityInfoboxSchemaExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('infobox schema reconciliation rejects count, lineage, completeness, hash, and semantic drift',()=>{
  const model=validateActivityInfoboxSchemaMaterializationInput(load()),actual={runId:model.runId,status:'published',records:1,sources:4,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyActivityInfoboxSchemaReconciliation(model,actual),true);
  assert.throws(()=>verifyActivityInfoboxSchemaReconciliation(model,{...actual,sources:3}),/sources_count_mismatch/);
  assert.throws(()=>verifyActivityInfoboxSchemaReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyActivityInfoboxSchemaReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivityInfoboxSchemaReconciliation(model,{...actual,metrics:{...actual.metrics,canonicalActivitySubjectBindingReviewComplete:true}}),/semantic_gate_weakened/);
});
