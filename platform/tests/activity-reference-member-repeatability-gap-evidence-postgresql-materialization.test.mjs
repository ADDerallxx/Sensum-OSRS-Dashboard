import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_FACT_KIND,
  buildActivityReferenceMemberRepeatabilityGapExistingSourceCountQuery,
  buildActivityReferenceMemberRepeatabilityGapMaterializationSql,
  validateActivityReferenceMemberRepeatabilityGapMaterializationInput,
  verifyActivityReferenceMemberRepeatabilityGapReconciliation
} from '../db/activity-reference-member-repeatability-gap-evidence-materialization-lib.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const directory='2026-09-04T23-25-52-916Z';
const auditDirectory='2026-09-04T23-25-52-935Z';
const dataFile='activity-reference-collection-member-repeatability-gap-evidence.ndjson';
const load=()=>({
  raw:fs.readFileSync(path.join(root,'.platform-data',directory,dataFile),'utf8'),
  manifest:JSON.parse(fs.readFileSync(path.join(root,'.platform-data',directory,'manifest.json'),'utf8')),
  audit:JSON.parse(fs.readFileSync(path.join(root,'.platform-data','activity-reference-collection-member-repeatability-gap-evidence-audits',auditDirectory,'report.json'),'utf8'))
});
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
function mutateRecord(input,mutator) {
  const records=input.raw.trim().split(/\r?\n/).map(JSON.parse);mutator(records[0]);records[0].contentHash=hash(without(records[0],'contentHash'));input.raw=records.map(JSON.stringify).join('\n')+'\n';input.manifest.contentHash=hash(input.raw);input.audit.outputSnapshot.contentHash=input.manifest.contentHash;input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('real repeatability-gap evidence remains lossless, revision-pinned, deterministic, and unresolved',()=>{
  const input=load(),first=validateActivityReferenceMemberRepeatabilityGapMaterializationInput(input),second=validateActivityReferenceMemberRepeatabilityGapMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:10,records:2,statements:2,candidatePages:8,candidateRequests:11,discoveryContexts:13,sourceLocatedSignals:1});
  assert.equal(first.records[0].contentHash,input.raw.trim().split(/\r?\n/).map(JSON.parse)[0].contentHash);
  assert.equal(first.statements.every(row=>row.payload.repeatabilityClassification===null&&row.payload.repeatabilityVerdict===null&&row.payload.candidateScopeVerdict===null&&row.payload.optimizerEligible===false),true);
  assert.equal(first.gates.repeatabilityReviewComplete,false);
});

test('gap source, discovery, account, and semantic tampering fail closed',()=>{
  const source=load();mutateRecord(source,record=>{record.corroboratingRepeatabilityEvidence.candidatePages[0].sourceContentHash='d'.repeat(64);});
  assert.throws(()=>validateActivityReferenceMemberRepeatabilityGapMaterializationInput(source),/conflicting_wiki_page_revision_identity|candidate_page_manifest_revision_mismatch/);
  const discovery=load();mutateRecord(discovery,record=>{record.corroboratingRepeatabilityEvidence.discoveryBoundary.candidateRequests[0].discoveryContexts[0].channel='invented_channel';});
  assert.throws(()=>validateActivityReferenceMemberRepeatabilityGapMaterializationInput(discovery),/candidate_request_assessment_mismatch|discovery_channel_invalid/);
  const account=load();mutateRecord(account,record=>{record.currentBaseLevel=34;});
  assert.throws(()=>validateActivityReferenceMemberRepeatabilityGapMaterializationInput(account),/record_account_state_present/);
  const promoted=load();mutateRecord(promoted,record=>{record.corroboratingRepeatabilityCandidateObservations.repeatabilityVerdict='repeatable';});
  assert.throws(()=>validateActivityReferenceMemberRepeatabilityGapMaterializationInput(promoted),/observation_reconciliation_failed/);
});

test('repeatability-gap SQL is transactional, insert-only, idempotent, and candidate-preserving',()=>{
  const model=validateActivityReferenceMemberRepeatabilityGapMaterializationInput(load()),sql=buildActivityReferenceMemberRepeatabilityGapMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_FACT_KIND));assert.match(sql,/'candidate'/);assert.match(sql,/'review'/);assert.match(sql,/ON CONFLICT .* DO NOTHING/);assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);assert.match(sql,/COMMIT;\n$/);assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);assert.match(sql,/d\.fetched_at IS NOT NULL/);assert.match(buildActivityReferenceMemberRepeatabilityGapExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('repeatability-gap reconciliation rejects count, lineage, completeness, hash, and semantic drift',()=>{
  const model=validateActivityReferenceMemberRepeatabilityGapMaterializationInput(load()),actual={runId:model.runId,status:'published',records:2,sources:10,statements:2,lineage:2,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyActivityReferenceMemberRepeatabilityGapReconciliation(model,actual),true);assert.throws(()=>verifyActivityReferenceMemberRepeatabilityGapReconciliation(model,{...actual,sources:9}),/sources_count_mismatch/);assert.throws(()=>verifyActivityReferenceMemberRepeatabilityGapReconciliation(model,{...actual,lineage:1}),/lineage_count_mismatch/);assert.throws(()=>verifyActivityReferenceMemberRepeatabilityGapReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);assert.throws(()=>verifyActivityReferenceMemberRepeatabilityGapReconciliation(model,{...actual,metrics:{...actual.metrics,repeatabilityReviewComplete:true}}),/semantic_gate_weakened/);
});
