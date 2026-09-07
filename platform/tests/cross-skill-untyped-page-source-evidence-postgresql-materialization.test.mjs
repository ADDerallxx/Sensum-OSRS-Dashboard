import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

import {hash} from '../ingestion/lib.mjs';
import {
  CROSS_SKILL_UNTYPED_PAGE_SOURCE_FACT_KIND,
  buildCrossSkillUntypedPageSourceExistingSourceCountQuery,
  buildCrossSkillUntypedPageSourceMaterializationSql,
  validateCrossSkillUntypedPageSourceMaterializationInput,
  verifyCrossSkillUntypedPageSourceReconciliation
} from '../db/cross-skill-untyped-page-source-evidence-materialization-lib.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const directory='2026-09-05T20-01-12-230Z';
const auditDirectory='2026-09-05T20-01-12-234Z';
const dataFile='cross-skill-untyped-page-source-evidence.ndjson';
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const load=()=>({
  raw:fs.readFileSync(path.join(root,'.platform-data',directory,dataFile),'utf8'),
  manifest:JSON.parse(fs.readFileSync(path.join(root,'.platform-data',directory,'manifest.json'),'utf8')),
  audit:JSON.parse(fs.readFileSync(path.join(root,'.platform-data','cross-skill-untyped-page-source-evidence-audits',auditDirectory,'report.json'),'utf8'))
});

function mutateRecord(input,index,mutator) {
  const records=input.raw.trim().split(/\r?\n/).map(JSON.parse);
  mutator(records[index]);
  records[index].contentHash=hash(without(records[index],'contentHash'));
  input.raw=records.map(JSON.stringify).join('\n')+'\n';
  input.manifest.contentHash=hash(input.raw);
  input.audit.outputSnapshot.contentHash=input.manifest.contentHash;
  input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('real cross-skill untyped evidence remains lossless, exact-source-bound, deterministic, and unresolved',()=>{
  const input=load(),first=validateCrossSkillUntypedPageSourceMaterializationInput(input),second=validateCrossSkillUntypedPageSourceMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:68,records:68,statements:68,sourceSignatureContexts:74});
  assert.equal(first.snapshotContentHash,'66875e3ed0c4a8cd8d5dcc90bccc7d8409d134a4b9502d9b976e45b1e1d664b6');
  assert.equal(first.auditContentHash,'adf9a54f046e7e61831d6b8ae08850e0fabfdd07787cc88565cf16b48c14aad5');
  assert.deepEqual(first.skillKeys,['agility','attack','construction','cooking','crafting','defence','farming','fishing','hunter','magic','prayer','ranged','sailing','slayer','smithing','strength','thieving']);
  assert.equal(first.gates.accountIndependenceBasis,'empty_audit_findings_plus_full_structural_scan');
  assert.equal(first.gates.pagesWithRootTemplates,68);
  assert.equal(first.gates.pagesWithDirectCategories,15);
  assert.ok(first.records.every((record,index)=>record.contentHash===input.raw.trim().split(/\r?\n/).map(JSON.parse)[index].contentHash));
  assert.ok(first.statements.every(statement=>statement.payload.pageTypeReviewState==='unreviewed'&&statement.payload.canonicalGameEntityIdentity===null&&statement.payload.canonicalActivityIdentity===null&&statement.payload.repeatabilityClassification===null&&statement.payload.optimizerEligible===false));
});

test('account, semantic, source, context, and structural tampering fail closed',()=>{
  const account=load();mutateRecord(account,0,record=>{record.currentBaseLevel=34;});
  assert.throws(()=>validateCrossSkillUntypedPageSourceMaterializationInput(account),/account_independence_not_proven/);
  const promoted=load();mutateRecord(promoted,0,record=>{record.canonicalActivityIdentity='invented';});
  assert.throws(()=>validateCrossSkillUntypedPageSourceMaterializationInput(promoted),/record_semantic_gate_weakened/);
  const source=load();source.manifest.source.fetchedRevisions[0].contentHash='d'.repeat(64);
  assert.throws(()=>validateCrossSkillUntypedPageSourceMaterializationInput(source),/manifest_fetched_revision_mismatch/);
  const context=load();mutateRecord(context,0,record=>{record.sourceSignatureContexts.pop();});
  assert.throws(()=>validateCrossSkillUntypedPageSourceMaterializationInput(context),/source_signature_context_set_mismatch/);
  const structural=load();mutateRecord(structural,0,record=>{record.rootTemplateEvidence.pop();});
  assert.throws(()=>validateCrossSkillUntypedPageSourceMaterializationInput(structural),/audit_structural_coverage_mismatch/);
});

test('cross-skill untyped SQL is transactional, insert-only, idempotent, and candidate-preserving',()=>{
  const model=validateCrossSkillUntypedPageSourceMaterializationInput(load()),sql=buildCrossSkillUntypedPageSourceMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,new RegExp(CROSS_SKILL_UNTYPED_PAGE_SOURCE_FACT_KIND));
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);
  assert.match(sql,/d\.fetched_at IS NOT NULL/);
  assert.match(buildCrossSkillUntypedPageSourceExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('cross-skill untyped reconciliation rejects count, lineage, completeness, hash, and semantic drift',()=>{
  const model=validateCrossSkillUntypedPageSourceMaterializationInput(load()),actual={runId:model.runId,status:'published',records:68,sources:68,statements:68,lineage:68,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyCrossSkillUntypedPageSourceReconciliation(model,actual),true);
  assert.throws(()=>verifyCrossSkillUntypedPageSourceReconciliation(model,{...actual,sources:67}),/sources_count_mismatch/);
  assert.throws(()=>verifyCrossSkillUntypedPageSourceReconciliation(model,{...actual,lineage:67}),/lineage_count_mismatch/);
  assert.throws(()=>verifyCrossSkillUntypedPageSourceReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyCrossSkillUntypedPageSourceReconciliation(model,{...actual,metrics:{...actual.metrics,pageTypeReviewComplete:true}}),/semantic_gate_weakened/);
});
