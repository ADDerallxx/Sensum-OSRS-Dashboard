import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND,
  buildActivityReferenceMemberSignalSubjectPredicateExistingSourceCountQuery,
  buildActivityReferenceMemberSignalSubjectPredicateMaterializationSql,
  validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput,
  verifyActivityReferenceMemberSignalSubjectPredicateReconciliation
} from '../db/activity-reference-member-independent-repeatability-signal-subject-predicate-evidence-materialization-lib.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const directory='2026-09-05T01-18-57-976Z';
const auditDirectory='2026-09-05T01-18-58-135Z';
const dataFile='activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence.ndjson';
const load=()=>({
  raw:fs.readFileSync(path.join(root,'.platform-data',directory,dataFile),'utf8'),
  manifest:JSON.parse(fs.readFileSync(path.join(root,'.platform-data',directory,'manifest.json'),'utf8')),
  audit:JSON.parse(fs.readFileSync(path.join(root,'.platform-data','activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-audits',auditDirectory,'report.json'),'utf8'))
});
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
function mutateRecord(input,mutator) {
  const records=input.raw.trim().split(/\r?\n/).map(JSON.parse); mutator(records[0]); records[0].contentHash=hash(without(records[0],'contentHash')); input.raw=records.map(JSON.stringify).join('\n')+'\n'; input.manifest.contentHash=hash(input.raw); input.audit.outputSnapshot.contentHash=input.manifest.contentHash; input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('real subject-predicate evidence stays lossless, source-bound, candidate-only, and deterministic',()=>{
  const input=load(),first=validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(input),second=validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:19,records:2,statements:2,signals:47,exactSourceLines:47,exactPredicateSpans:47,exactLineLinkSets:47,exactLineLinkOccurrences:45,stableActivityAnchors:0,noStableActivityAnchors:47,semanticSubjectBindings:0,requestedRevisions:18});
  assert.equal(first.statements.every(row=>row.payload.canonicalActivityScopeVerdict===null&&row.payload.repeatabilityVerdict===null&&row.payload.optimizerEligible===false),true);
});

test('subject, predicate, source, account, and semantic tampering fail closed',()=>{
  const source=load(); mutateRecord(source,record=>{record.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[0].sourceRevisionVerification.expected.sourceContentHash='d'.repeat(64);});
  assert.throws(()=>validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(source),/signal_source_revision_alignment_mismatch|manifest_fetched_revision_mismatch/);
  const retainedLine=load(); mutateRecord(retainedLine,record=>{record.independentRepeatabilitySourceEvidence.candidatePages.find(page=>(page.sourceLocatedSignals||[]).length).sourceLocatedSignals[0].contextText='wrong';});
  assert.throws(()=>validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(retainedLine),/exact_source_line_not_revalidated/);
  const predicate=load(); mutateRecord(predicate,record=>{record.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[0].repeatabilityPredicateEvidence.extractedText='wrong';});
  assert.throws(()=>validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(predicate),/predicate_span_not_revalidated/);
  const account=load(); mutateRecord(account,record=>{record.currentBaseLevel=34;});
  assert.throws(()=>validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(account),/record_account_state_present/);
  const promoted=load(); mutateRecord(promoted,record=>{record.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets[0].semanticBinding.repeatabilityVerdict='repeatable';});
  assert.throws(()=>validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(promoted),/semantic_binding_gate_weakened/);
});

test('subject-predicate SQL is transactional, insert-only, idempotent, and preserves semantic gates',()=>{
  const model=validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(load()),sql=buildActivityReferenceMemberSignalSubjectPredicateMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/); assert.match(sql,/pg_advisory_xact_lock/); assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND)); assert.match(sql,/'candidate'/); assert.match(sql,/'review'/); assert.match(sql,/ON CONFLICT .* DO NOTHING/); assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/); assert.match(sql,/COMMIT;\n$/); assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i); assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/); assert.match(sql,/d\.fetched_at IS NOT NULL/); assert.match(buildActivityReferenceMemberSignalSubjectPredicateExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('subject-predicate reconciliation rejects count, lineage, completeness, hash, and semantic drift',()=>{
  const model=validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput(load()),actual={runId:model.runId,status:'published',records:2,sources:19,statements:2,lineage:2,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyActivityReferenceMemberSignalSubjectPredicateReconciliation(model,actual),true); assert.throws(()=>verifyActivityReferenceMemberSignalSubjectPredicateReconciliation(model,{...actual,sources:18}),/sources_count_mismatch/); assert.throws(()=>verifyActivityReferenceMemberSignalSubjectPredicateReconciliation(model,{...actual,lineage:1}),/lineage_count_mismatch/); assert.throws(()=>verifyActivityReferenceMemberSignalSubjectPredicateReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/); assert.throws(()=>verifyActivityReferenceMemberSignalSubjectPredicateReconciliation(model,{...actual,metrics:{...actual.metrics,repeatabilityReviewComplete:true}}),/semantic_gate_weakened/);
});
