import assert from 'node:assert/strict';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_CANDIDATE_SOURCE_FACT_KIND,
  buildActivityCandidateSourceExistingSourceCountQuery,
  buildActivityCandidateSourceMaterializationSql,
  validateActivityCandidateSourceMaterializationInput,
  verifyActivityCandidateSourceReconciliation
} from '../db/activity-candidate-source-evidence-materialization-lib.mjs';

const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));

function fixture() {
  const record={
    contract:'sensum.activity-candidate-source-evidence.v1',candidateKey:'osrs-wiki-pageid:42',sourceCandidateContentHash:'b'.repeat(64),sourceSignatureContexts:[],
    sourcePageId:42,resolvedTitle:'Example activity',skillKeys:['agility','mining'],statementKeys:['agility:members1:1'],sourceRevision:'123',sourceTimestamp:'2026-09-01T00:00:00Z',
    sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:'a'.repeat(64),sourceContentBytes:1000,
    revisionAlignment:{candidateAndSignaturePageIdMatch:true,allSignatureContextsEquivalent:true,fetchedAndSignaturePageIdMatch:true,candidateAndSignatureRevisionMatch:true,fetchedAndSignatureRevisionMatch:true,fetchedAndSignatureContentHashMatch:true},
    pageTypeEvidence:{entityTypes:['activity_page'],rootTemplates:[],directCategories:[]},infoboxEvidence:{balanced:true},leadParagraphEvidence:[],headingEvidence:[],lexicalReviewCandidates:[],
    semanticIdentityReview:{state:'unreviewed',disposition:null,evidenceKeys:[]},repeatabilityReview:{state:'unreviewed',classification:null,evidenceKeys:[]},
    canonicalGameEntityIdentity:null,canonicalActivityIdentity:null,optimizerEligible:false,accountIndependent:true,
    blockers:['source_evidence_requires_semantic_review','canonical_game_entity_identity_not_established','canonical_activity_identity_not_established','repeatability_not_semantically_reviewed','requirements_variants_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'],state:'review_ready'
  };
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n',directory='2026-09-06T20-00-00-000Z';
  const coreAudit={
    contract:'sensum.activity-candidate-source-evidence-audit.v1',accountIndependent:true,
    inputCoverage:{expectedActivityCandidateCount:1,sourceEvidenceRecordCount:1,relevantSourceSignatureCount:1,relevantSourceSignaturePageCount:1,preservedSourceSignatureContextCount:0,fetchedExactRevisionCount:1,duplicateInputCandidateKeys:[],duplicateOutputCandidateKeys:[],missingCandidateKeys:[],unexpectedCandidateKeys:[],multiContextSignaturePageIds:[],conflictingSignaturePageIds:[],missingSignaturePageIds:[],duplicateInputSignatureContextKeys:[],duplicateOutputSignatureContextKeys:[],missingSignatureContextKeys:[],unexpectedSignatureContextKeys:[],duplicateFetchedRevisions:[],missingFetchedRevisions:[],exactCandidateSignatureAndFetchSetMatch:true},
    sourceAlignment:{fullyAlignedCount:1,failedCandidateKeys:[],allPageIdsRevisionsAndContentHashesAligned:true},
    structuralEvidenceCoverage:{supportedInfoboxCount:1,missingSupportedInfoboxCandidateKeys:[],unbalancedSupportedInfoboxCandidateKeys:[],infoboxTemplateCounts:{'Infobox Activity':1},totalInfoboxParameterOccurrences:1,totalLeadParagraphs:0,totalHeadings:0},
    lexicalCandidateCoverage:{policySignalCount:1,matchedStatementCount:0,candidateCountWithAnyMatch:0,familyCounts:{},signalCounts:{},unexpectedSignalKeys:[]},
    semanticPromotionCoverage:{reviewReadyCount:1,semanticIdentityReviewedCount:0,repeatabilityReviewedCount:0,canonicalGameEntityIdentityCount:0,canonicalActivityIdentityCount:0,optimizerEligibleCount:0,unsupportedPromotionCandidateKeys:[]},
    accountStateFindings:[],sourceEvidenceCoverageComplete:true,semanticReviewComplete:false,repeatabilityReviewComplete:false,requirementsVariantsXpTimingAndMechanicsComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',
    blockers:['activity_candidate_semantic_identity_review_pending','activity_candidate_repeatability_review_pending','requirements_variants_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'],publishable:true
  };
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'activity-candidate-source-evidence',createdAt:'2026-09-06T20:00:00Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_activity_candidate_source_evidence_review_packet',api:'https://oldschool.runescape.wiki/api.php',fetchedRevisions:[{pageId:42,title:'Example activity',revision:'123',timestamp:'2026-09-01T00:00:00Z',contentHash:'a'.repeat(64)}],audit:structuredClone(coreAudit)}};
  const audit={...structuredClone(coreAudit),generatedAt:'2026-09-06T20:00:01Z',policy:{file:'fixture',id:'fixture',contentHash:'c'.repeat(64)},inputSnapshots:{candidates:{directory:'candidates',contentHash:'d'.repeat(64),rejections:[]},sourceSignatures:{directory:'signatures',contentHash:'e'.repeat(64),rejections:[]}},outputSnapshot:{directory,contentHash:manifest.contentHash}};
  audit.contentHash=hash(audit);
  return {raw,manifest,audit,record};
}

function rehashInput(input) {
  input.record.contentHash=hash(without(input.record,'contentHash'));
  input.raw=JSON.stringify(input.record)+'\n';
  input.manifest.contentHash=hash(input.raw);
  input.audit.outputSnapshot.contentHash=input.manifest.contentHash;
  input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('candidate-source records materialize losslessly, deterministically, and across measured skills',()=>{
  const input=fixture(),first=validateActivityCandidateSourceMaterializationInput(input),second=validateActivityCandidateSourceMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:1,records:1,statements:1});
  assert.deepEqual(first.skillKeys,['agility','mining']);
  assert.equal(first.records[0].contentHash,input.record.contentHash);
  assert.equal(first.statements[0].payload.optimizerEligible,false);
  assert.deepEqual(first.gates,{sourceEvidenceCoverageComplete:true,semanticReviewComplete:false,repeatabilityReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true});
});

test('candidate-source tampering, account state, and semantic promotion fail closed',()=>{
  const tampered=fixture(); tampered.raw=tampered.raw.replace('Example activity','Changed activity');
  assert.throws(()=>validateActivityCandidateSourceMaterializationInput(tampered),/snapshot_content_hash_mismatch/);
  const accountBound=fixture(); accountBound.record.currentBaseLevel=34; rehashInput(accountBound);
  assert.throws(()=>validateActivityCandidateSourceMaterializationInput(accountBound),/record_account_state_present/);
  const promoted=fixture(); promoted.record.optimizerEligible=true; rehashInput(promoted);
  assert.throws(()=>validateActivityCandidateSourceMaterializationInput(promoted),/record_semantic_gate_weakened/);
  const drift=fixture(); drift.audit.semanticPromotionCoverage.optimizerEligibleCount=1; drift.manifest.source.audit.semanticPromotionCoverage.optimizerEligibleCount=1; drift.audit.contentHash=hash(without(drift.audit,'contentHash'));
  assert.throws(()=>validateActivityCandidateSourceMaterializationInput(drift),/audit_optimizer_or_semantic_gate_weakened/);
  const missingBlocker=fixture(); missingBlocker.audit.blockers.pop(); missingBlocker.manifest.source.audit.blockers.pop(); missingBlocker.audit.contentHash=hash(without(missingBlocker.audit,'contentHash'));
  assert.throws(()=>validateActivityCandidateSourceMaterializationInput(missingBlocker),/audit_required_blocker_missing/);
});

test('candidate-source SQL is transactional, insert-only, candidate-only, and directly lineage-bound',()=>{
  const model=validateActivityCandidateSourceMaterializationInput(fixture()),sql=buildActivityCandidateSourceMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,new RegExp(ACTIVITY_CANDIDATE_SOURCE_FACT_KIND));
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.match(buildActivityCandidateSourceExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('candidate-source reconciliation rejects count, lineage, hash, and semantic drift',()=>{
  const model=validateActivityCandidateSourceMaterializationInput(fixture());
  const actual={runId:model.runId,status:'published',records:1,sources:1,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyActivityCandidateSourceReconciliation(model,actual),true);
  assert.throws(()=>verifyActivityCandidateSourceReconciliation(model,{...actual,statements:0}),/statements_count_mismatch/);
  assert.throws(()=>verifyActivityCandidateSourceReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyActivityCandidateSourceReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivityCandidateSourceReconciliation(model,{...actual,metrics:{...actual.metrics,optimizerEligibleRecords:1}}),/semantic_gate_weakened/);
});
