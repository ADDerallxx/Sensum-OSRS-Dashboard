import assert from 'node:assert/strict';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SOURCE_FACT_KIND,
  buildActivityReferenceMemberSourceExistingSourceCountQuery,
  buildActivityReferenceMemberSourceMaterializationSql,
  validateActivityReferenceMemberSourceMaterializationInput,
  verifyActivityReferenceMemberSourceReconciliation
} from '../db/activity-reference-collection-member-source-evidence-materialization-lib.mjs';

const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));

function fixture() {
  const record={
    contract:'sensum.activity-reference-collection-member-source-evidence.v1',memberCandidateKey:'collection-row:2078:123:section:1:2',sourceMemberCandidateContentHash:'b'.repeat(64),
    collectionContext:{collectionCandidateKey:'osrs-wiki-pageid:2078',collectionSource:{pageId:2078},membershipClassification:'official_minigame',sectionEvidence:{},tableEvidence:{},rowEvidence:{},memberCellEvidence:{plainText:'Example activity'},memberLinks:[]},
    memberIdentityContexts:[{pageId:42,resolvedTitle:'Example activity',observedRevision:'123',observedTimestamp:'2026-09-01T00:00:00Z',observedSourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',observedContentHash:'a'.repeat(64),state:'resolved_current_wiki_page_identity'}],
    sourcePageId:42,resolvedTitle:'Example activity',sourceRevision:'123',sourceTimestamp:'2026-09-01T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:'a'.repeat(64),sourceContentBytes:1000,
    revisionAlignment:{memberIdentityOccurrencesPresent:true,memberIdentityOccurrencesEquivalent:true,memberIdentityOccurrencesResolved:true,fetchedPageIdMatch:true,fetchedTitleMatch:true,fetchedRevisionMatch:true,fetchedTimestampMatch:true,fetchedContentHashMatch:true},
    membershipClassification:'official_minigame',infoboxEvidence:null,leadParagraphEvidence:[],headingEvidence:[],lexicalReviewCandidates:[],
    semanticIdentityReview:{state:'unreviewed',disposition:null,evidenceKeys:[]},repeatabilityReview:{state:'unreviewed',classification:null,evidenceKeys:[]},
    canonicalGameEntityIdentity:null,canonicalActivityIdentity:null,optimizerEligible:false,accountIndependent:true,
    blockers:['source_evidence_requires_semantic_review','canonical_game_entity_identity_not_established','canonical_activity_identity_not_established','repeatability_not_semantically_reviewed','requirements_variants_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'],state:'review_ready'
  };
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n',directory='2026-09-06T21-00-00-000Z';
  const coreAudit={
    contract:'sensum.activity-reference-collection-member-source-evidence-audit.v1',accountIndependent:true,
    inputCoverage:{expectedMemberCandidateCount:1,sourceEvidenceRecordCount:1,duplicateInputMemberCandidateKeys:[],duplicateOutputMemberCandidateKeys:[],missingMemberCandidateKeys:[],unexpectedMemberCandidateKeys:[],contextMismatchMemberCandidateKeys:[],exactCandidateAndContextSetMatch:true},
    sourceAlignment:{distinctExpectedRevisionCount:1,fetchedRevisionCount:1,duplicateFetchedRevisions:[],missingFetchedRevisions:[],identityContextFailureMemberCandidateKeys:[],collectionDisplayResolvedTitleDifferenceCount:0,collectionDisplayResolvedTitleDifferences:[],fullyAlignedCount:1,failedMemberCandidateKeys:[],allIdentityContextsAndFetchedSourcesAligned:true},
    structuralEvidenceCoverage:{totalSourceContentBytes:1000,supportedInfoboxCount:0,missingSupportedInfoboxMemberCandidateKeys:[record.memberCandidateKey],missingSupportedInfoboxMemberSources:[],unbalancedSupportedInfoboxMemberCandidateKeys:[],infoboxTemplateCounts:{},totalInfoboxParameterOccurrences:0,totalLeadParagraphs:0,totalHeadings:0},
    lexicalCandidateCoverage:{policySignalCount:1,matchedStatementCount:0,candidateCountWithAnyMatch:0,familyCounts:{},signalCounts:{},unexpectedSignalKeys:[]},
    semanticPromotionCoverage:{reviewReadyCount:1,semanticIdentityReviewedCount:0,repeatabilityReviewedCount:0,canonicalGameEntityIdentityCount:0,canonicalActivityIdentityCount:0,optimizerEligibleCount:0,unsupportedPromotionMemberCandidateKeys:[]},
    accountStateFindings:[],sourceEvidenceCoverageComplete:true,semanticReviewComplete:false,repeatabilityReviewComplete:false,requirementsVariantsXpTimingAndMechanicsComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',
    blockers:['one_or_more_member_sources_have_no_supported_activity_infobox','member_semantic_identity_review_pending','member_repeatability_review_pending','member_requirements_variants_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'],publishable:true
  };
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'activity-reference-collection-member-source-evidence',createdAt:'2026-09-06T21:00:00Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_reference_collection_member_semantic_review_packet',api:'https://oldschool.runescape.wiki/api.php',inputSnapshot:{directory:'members',contentHash:'d'.repeat(64),rejections:[]},fetchedRevisions:[{pageId:42,title:'Example activity',revision:'123',timestamp:'2026-09-01T00:00:00Z',contentHash:'a'.repeat(64)}],audit:structuredClone(coreAudit)}};
  const audit={...structuredClone(coreAudit),generatedAt:'2026-09-06T21:00:01Z',policies:{packet:{id:'fixture',file:'fixture',contentHash:'c'.repeat(64)}},inputSnapshot:{directory:'members',contentHash:'d'.repeat(64),rejections:[]},outputSnapshot:{directory,contentHash:manifest.contentHash}};
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

test('reference-member source records materialize losslessly without inferred skill scope',()=>{
  const input=fixture(),first=validateActivityReferenceMemberSourceMaterializationInput(input),second=validateActivityReferenceMemberSourceMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:1,records:1,statements:1});
  assert.deepEqual(first.skillKeys,[]);
  assert.equal(first.records[0].contentHash,input.record.contentHash);
  assert.equal(first.statements[0].payload.optimizerEligible,false);
  assert.equal(first.gates.missingSupportedActivityInfoboxCount,1);
  assert.equal(first.gates.semanticReviewComplete,false);
});

test('reference-member tampering, account state, promotion, and blocker loss fail closed',()=>{
  const tampered=fixture(); tampered.raw=tampered.raw.replace('Example activity','Changed activity');
  assert.throws(()=>validateActivityReferenceMemberSourceMaterializationInput(tampered),/snapshot_content_hash_mismatch/);
  const accountBound=fixture(); accountBound.record.currentBaseLevel=34; rehashInput(accountBound);
  assert.throws(()=>validateActivityReferenceMemberSourceMaterializationInput(accountBound),/record_account_state_present/);
  const promoted=fixture(); promoted.record.optimizerEligible=true; rehashInput(promoted);
  assert.throws(()=>validateActivityReferenceMemberSourceMaterializationInput(promoted),/record_semantic_gate_weakened/);
  const missingBlocker=fixture(); missingBlocker.audit.blockers.pop(); missingBlocker.manifest.source.audit.blockers.pop(); missingBlocker.audit.contentHash=hash(without(missingBlocker.audit,'contentHash'));
  assert.throws(()=>validateActivityReferenceMemberSourceMaterializationInput(missingBlocker),/audit_required_blocker_missing/);
});

test('reference-member SQL is transactional, insert-only, candidate-only, and lineage-bound',()=>{
  const model=validateActivityReferenceMemberSourceMaterializationInput(fixture()),sql=buildActivityReferenceMemberSourceMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_SOURCE_FACT_KIND));
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.match(buildActivityReferenceMemberSourceExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('reference-member reconciliation rejects count, lineage, hash, and semantic drift',()=>{
  const model=validateActivityReferenceMemberSourceMaterializationInput(fixture());
  const actual={runId:model.runId,status:'published',records:1,sources:1,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,skillCoverage:0,skillKeys:[],...model.gates}};
  assert.equal(verifyActivityReferenceMemberSourceReconciliation(model,actual),true);
  assert.throws(()=>verifyActivityReferenceMemberSourceReconciliation(model,{...actual,statements:0}),/statements_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberSourceReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberSourceReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivityReferenceMemberSourceReconciliation(model,{...actual,metrics:{...actual.metrics,optimizerEligibleRecords:1}}),/semantic_gate_weakened/);
});
