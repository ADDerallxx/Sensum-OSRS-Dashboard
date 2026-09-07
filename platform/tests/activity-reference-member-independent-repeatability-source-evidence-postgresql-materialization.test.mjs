import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_FACT_KIND,
  buildActivityReferenceMemberIndependentSourceExistingSourceCountQuery,
  buildActivityReferenceMemberIndependentSourceMaterializationSql,
  validateActivityReferenceMemberIndependentSourceMaterializationInput,
  verifyActivityReferenceMemberIndependentSourceReconciliation
} from '../db/activity-reference-member-independent-repeatability-source-evidence-materialization-lib.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const directory='2026-09-05T00-00-01-496Z';
const auditDirectory='2026-09-05T00-00-01-644Z';
const dataFile='activity-reference-collection-member-independent-repeatability-source-evidence.ndjson';
const load=()=>({
  raw:fs.readFileSync(path.join(root,'.platform-data',directory,dataFile),'utf8'),
  manifest:JSON.parse(fs.readFileSync(path.join(root,'.platform-data',directory,'manifest.json'),'utf8')),
  audit:JSON.parse(fs.readFileSync(path.join(root,'.platform-data','activity-reference-collection-member-independent-repeatability-source-evidence-audits',auditDirectory,'report.json'),'utf8'))
});
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
function mutateRecord(input,mutator) {
  const records=input.raw.trim().split(/\r?\n/).map(JSON.parse);mutator(records[0]);records[0].contentHash=hash(without(records[0],'contentHash'));input.raw=records.map(JSON.stringify).join('\n')+'\n';input.manifest.contentHash=hash(input.raw);input.audit.outputSnapshot.contentHash=input.manifest.contentHash;input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('real independent source evidence stays lossless, exhaustive within its discovery boundary, and candidate-only',()=>{
  const input=load(),first=validateActivityReferenceMemberIndependentSourceMaterializationInput(input),second=validateActivityReferenceMemberIndependentSourceMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:163,records:2,statements:2,candidatePageOccurrences:224,candidateRequests:240,discoveryContexts:252,sourceLocatedSignals:47,sourceAuthoredLinkOccurrences:25749,requestedTitles:176});
  assert.equal(first.records[0].contentHash,input.raw.trim().split(/\r?\n/).map(JSON.parse)[0].contentHash);
  assert.equal(first.statements.every(row=>row.payload.canonicalActivityScopeVerdict===null&&row.payload.repeatabilityVerdict===null&&row.payload.optimizerEligible===false),true);
});

test('candidate source, discovery, account, and semantic tampering fail closed',()=>{
  const source=load();mutateRecord(source,record=>{record.independentRepeatabilitySourceEvidence.candidatePages[0].sourceContentHash='d'.repeat(64);});
  assert.throws(()=>validateActivityReferenceMemberIndependentSourceMaterializationInput(source),/candidate_page_manifest_revision_mismatch|conflicting_wiki_page_revision_identity/);
  const discovery=load();mutateRecord(discovery,record=>{record.independentRepeatabilitySourceEvidence.discoveryBoundary.exactSourceSearch.truncated=true;});
  assert.throws(()=>validateActivityReferenceMemberIndependentSourceMaterializationInput(discovery),/record_discovery_response_mismatch|boundary_incomplete/);
  const account=load();mutateRecord(account,record=>{record.currentBaseLevel=34;});
  assert.throws(()=>validateActivityReferenceMemberIndependentSourceMaterializationInput(account),/record_account_state_present/);
  const promoted=load();mutateRecord(promoted,record=>{record.independentRepeatabilitySourceEvidence.candidatePages[0].repeatabilityVerdict='repeatable';});
  assert.throws(()=>validateActivityReferenceMemberIndependentSourceMaterializationInput(promoted),/candidate_page_gate_invalid/);
});

test('independent source SQL is transactional, insert-only, idempotent, and preserves semantic gates',()=>{
  const model=validateActivityReferenceMemberIndependentSourceMaterializationInput(load()),sql=buildActivityReferenceMemberIndependentSourceMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_FACT_KIND));assert.match(sql,/'candidate'/);assert.match(sql,/'review'/);assert.match(sql,/ON CONFLICT .* DO NOTHING/);assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);assert.match(sql,/COMMIT;\n$/);assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);assert.match(sql,/d\.fetched_at IS NOT NULL/);assert.match(buildActivityReferenceMemberIndependentSourceExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('generic SQL boundary rejects unsafe registry metadata',async()=>{
  const model=validateActivityReferenceMemberIndependentSourceMaterializationInput(load());
  const {buildCandidateEvidenceMaterializationSql}=await import('../db/candidate-evidence-materialization-lib.mjs');
  assert.throws(()=>buildCandidateEvidenceMaterializationSql(model,{contract:model.contract,factKind:"unsafe'; DELETE FROM activity_evidence; --",label:'Unsafe'}),/fact_kind_invalid/);
  assert.throws(()=>buildCandidateEvidenceMaterializationSql(model,{contract:model.contract,factKind:ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_FACT_KIND,label:'  '}),/label_invalid/);
});

test('independent source reconciliation rejects count, lineage, completeness, hash, and semantic drift',()=>{
  const model=validateActivityReferenceMemberIndependentSourceMaterializationInput(load()),actual={runId:model.runId,status:'published',records:2,sources:163,statements:2,lineage:2,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyActivityReferenceMemberIndependentSourceReconciliation(model,actual),true);assert.throws(()=>verifyActivityReferenceMemberIndependentSourceReconciliation(model,{...actual,sources:162}),/sources_count_mismatch/);assert.throws(()=>verifyActivityReferenceMemberIndependentSourceReconciliation(model,{...actual,lineage:1}),/lineage_count_mismatch/);assert.throws(()=>verifyActivityReferenceMemberIndependentSourceReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);assert.throws(()=>verifyActivityReferenceMemberIndependentSourceReconciliation(model,{...actual,metrics:{...actual.metrics,repeatabilityReviewComplete:true}}),/semantic_gate_weakened/);
});
