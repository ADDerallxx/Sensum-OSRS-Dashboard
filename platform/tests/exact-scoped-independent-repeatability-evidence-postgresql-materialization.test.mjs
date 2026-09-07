import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

import {hash} from '../ingestion/lib.mjs';
import {
  EXACT_SCOPED_INDEPENDENT_REPEATABILITY_FACT_KIND,
  buildExactScopedIndependentRepeatabilityExistingSourceCountQuery,
  buildExactScopedIndependentRepeatabilityMaterializationSql,
  validateExactScopedIndependentRepeatabilityMaterializationInput,
  verifyExactScopedIndependentRepeatabilityReconciliation
} from '../db/exact-scoped-independent-repeatability-evidence-materialization-lib.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const directory='2026-09-05T06-00-11-552Z';
const auditDirectory='2026-09-05T06-00-11-640Z';
const dataFile='exact-scoped-independent-repeatability-evidence.ndjson';
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const load=()=>({
  raw:fs.readFileSync(path.join(root,'.platform-data',directory,dataFile),'utf8'),
  manifest:JSON.parse(fs.readFileSync(path.join(root,'.platform-data',directory,'manifest.json'),'utf8')),
  audit:JSON.parse(fs.readFileSync(path.join(root,'.platform-data','exact-scoped-independent-repeatability-evidence-audits',auditDirectory,'report.json'),'utf8'))
});

function mutateRecord(input,mutator) {
  const record=JSON.parse(input.raw.trim());
  mutator(record);
  record.contentHash=hash(without(record,'contentHash'));
  input.raw=JSON.stringify(record)+'\n';
  input.manifest.contentHash=hash(input.raw);
  input.audit.outputSnapshot.contentHash=input.manifest.contentHash;
  input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('real exact-scoped evidence remains lossless, deterministic, revision-bound, and unresolved',()=>{
  const input=load(),first=validateExactScopedIndependentRepeatabilityMaterializationInput(input),second=validateExactScopedIndependentRepeatabilityMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:125,primarySources:1,records:1,statements:1,discoveryCandidateTitles:126,retainedIndependentSources:124,evidenceDomainPackets:6});
  assert.equal(first.snapshotContentHash,'5db4b6c5cd7b5efc1ad7c750aa9a95d9922d659a3ad33b69f890bb78c26404c5');
  assert.equal(first.auditContentHash,'569e11ba33d16f6dfaadbaf47d64038dfdeae3333d8b3d44af62ff5bcffd119f');
  assert.equal(first.sources.length,125);
  assert.ok(first.sources.some(source=>source.sourceRevision==='14997080'&&source.title==='Wise Old Man tasks'));
  assert.equal(first.gates.accountIndependenceBasis,'empty_audit_findings_plus_full_structural_scan');
  assert.equal(first.gates.exactSameLineSubjectPredicateCandidateSignals,0);
  assert.equal(first.gates.completeIndependentSourceUniverse,false);
  assert.equal(first.gates.repeatabilityReviewComplete,false);
  assert.equal(first.gates.optimizerEligibleRecords,0);
  assert.equal(first.records[0].contentHash,JSON.parse(input.raw.trim()).contentHash);
  assert.equal(first.statements[0].payload.repeatabilityVerdict,null);
  assert.equal(first.statements[0].payload.optimizerEligible,false);
});

test('account, semantic, packet, and retained-source tampering fail closed',()=>{
  const account=load();mutateRecord(account,record=>{record.currentBaseLevel=34;});
  assert.throws(()=>validateExactScopedIndependentRepeatabilityMaterializationInput(account),/account_independence_not_proven/);
  const promoted=load();mutateRecord(promoted,record=>{record.optimizerEligible=true;});
  assert.throws(()=>validateExactScopedIndependentRepeatabilityMaterializationInput(promoted),/record_semantic_gate_weakened/);
  const packet=load();mutateRecord(packet,record=>{record.exactScopedIndependentRepeatabilityEvidence.evidenceDomainPackets[0].resolved=true;});
  assert.throws(()=>validateExactScopedIndependentRepeatabilityMaterializationInput(packet),/record_domain_packet_gate_weakened/);
  const source=load();mutateRecord(source,record=>{record.exactScopedIndependentRepeatabilityEvidence.independentSources[0].exactRevisionSourceText+=' tampered';});
  assert.throws(()=>validateExactScopedIndependentRepeatabilityMaterializationInput(source),/record_independent_source_invalid/);
});

test('exact-scoped SQL is transactional, insert-only, idempotent, and candidate-preserving',()=>{
  const model=validateExactScopedIndependentRepeatabilityMaterializationInput(load()),sql=buildExactScopedIndependentRepeatabilityMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,new RegExp(EXACT_SCOPED_INDEPENDENT_REPEATABILITY_FACT_KIND));
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);
  assert.match(sql,/d\.fetched_at IS NOT NULL/);
  assert.match(buildExactScopedIndependentRepeatabilityExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('exact-scoped reconciliation rejects count, lineage, completeness, hash, and semantic drift',()=>{
  const model=validateExactScopedIndependentRepeatabilityMaterializationInput(load()),actual={runId:model.runId,status:'published',records:1,sources:125,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyExactScopedIndependentRepeatabilityReconciliation(model,actual),true);
  assert.throws(()=>verifyExactScopedIndependentRepeatabilityReconciliation(model,{...actual,records:0}),/records_count_mismatch/);
  assert.throws(()=>verifyExactScopedIndependentRepeatabilityReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyExactScopedIndependentRepeatabilityReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyExactScopedIndependentRepeatabilityReconciliation(model,{...actual,metrics:{...actual.metrics,repeatabilityReviewComplete:true}}),/semantic_gate_weakened/);
});
