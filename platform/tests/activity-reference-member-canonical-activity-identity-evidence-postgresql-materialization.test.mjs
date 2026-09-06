import assert from 'node:assert/strict';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_CANONICAL_IDENTITY_FACT_KIND,
  buildActivityReferenceMemberCanonicalIdentityExistingSourceCountQuery,
  buildActivityReferenceMemberCanonicalIdentityMaterializationSql,
  validateActivityReferenceMemberCanonicalIdentityMaterializationInput,
  verifyActivityReferenceMemberCanonicalIdentityReconciliation
} from '../db/activity-reference-member-canonical-activity-identity-evidence-materialization-lib.mjs';

const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));

function fixture() {
  const collectionSource={candidateKey:'osrs-wiki-pageid:2078',pageId:2078,title:'Minigames',url:'https://oldschool.runescape.wiki/w/Minigames',revision:'999',timestamp:'2026-09-01T00:00:00Z',contentHash:'b'.repeat(64)};
  const sourcePage={sourcePageId:42,resolvedTitle:'Example activity',sourceRevision:'123',sourceTimestamp:'2026-09-02T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:'a'.repeat(64)};
  const record={
    contract:'sensum.activity-reference-collection-member-canonical-activity-identity-evidence.v1',memberCandidateKey:'collection-row:2078:999:section:1:2',sourceLinkedSubjectRelationshipDispositionContentHash:'c'.repeat(64),
    ...sourcePage,sourcePageEvidence:{revisionAlignment:{fetchedContentHashMatchesRoutingRecord:true,fetchedPageIdMatchesRoutingRecord:true,fetchedRevisionMatchesRoutingRecord:true,fetchedTimestampMatchesRoutingRecord:true,fetchedTitleMatchesRoutingRecord:true,fetchedUrlMatchesRoutingRecord:true,retainedIdentityContextsPresentAndAligned:true,routingRecordMatchesPolicyRoute:true}},
    canonicalActivityIdentityEvidence:{collectionDefinition:{collectionSource},linkedSubjectRelationship:{sourcePage},crossSourceAlignment:{stableSourceIdentityAlignments:[{sourcePageId:42,sourceRevision:'123',sourceContentHash:'a'.repeat(64)}]},evidenceState:'complete_revision_pinned_canonical_activity_identity_review_packet'},
    canonicalActivityIdentityCandidateObservations:{collectionActivityLabel:'Example competition',linkedSourceTitle:'Example activity',exactNormalizedCollectionLabelSourceTitleMatch:false,sourcePageRelationshipClass:'activity_component',possibleDedicatedActivityPageObservation:false,collectionScopedActivityIdentityAnchor:{collectionPageId:2078,collectionRevision:'999',sectionHeading:'Skilling',sourceTableOrdinal:1,sourceRowOrdinal:1},deficiencies:[],canonicalActivityIdentityVerdict:null,observationState:'identity_review_observations_only_not_a_canonical_identity'},
    canonicalGameEntityIdentity:null,canonicalActivityIdentity:null,repeatabilityReview:{state:'unreviewed',classification:null,evidenceKeys:[]},memberExpansionReview:{state:'unreviewed',atomicSubject:null,memberKeys:[],evidenceKeys:[]},mechanicsReview:{state:'unreviewed',evidenceKeys:[]},optimizerEligible:false,accountIndependent:true,
    blockers:['canonical_activity_identity_disposition_pending','repeatability_and_member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'],state:'canonical_activity_identity_evidence_packet_complete_identity_unreviewed'
  };
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n',directory='2026-09-06T22-00-00-000Z';
  const coreAudit={contract:'sensum.activity-reference-collection-member-canonical-activity-identity-evidence-audit.v1',accountIndependent:true,inputCoverage:{expectedRelationshipDispositionCount:1,evidencePacketCount:1,duplicateInputMemberCandidateKeys:[],duplicateOutputMemberCandidateKeys:[],missingMemberCandidateKeys:[],unexpectedMemberCandidateKeys:[],contextMismatchMemberCandidateKeys:[],structurallyInvalidInputMemberCandidateKeys:[],exactInputOutputSetAndContextMatch:true},evidenceCoverage:{completePacketCount:1,incompletePacketCount:0,incompleteMemberCandidateKeys:[],retainedCollectionRowCellCount:1,retainedCollectionNarrativeCellCount:1,retainedCollectionRowLinkCount:1,retainedSourceRoleDeclarationCount:1,retainedCollectionIdentitySignalCount:1,retainedLinkedRelationshipSignalCount:1,invalidPacketMemberCandidateKeys:[]},identityObservationCoverage:{exactNormalizedCollectionLabelSourceTitleMatchCount:0,differentCollectionLabelSourceTitleCount:1,possibleDedicatedActivityPageObservationCount:0,canonicalActivityIdentityVerdictCount:0},semanticPromotionCoverage:{canonicalGameEntityIdentityCount:0,canonicalActivityIdentityCount:0,repeatabilityReviewedCount:0,memberExpansionReviewedCount:0,mechanicsReviewedCount:0,optimizerEligibleCount:0,unsupportedPromotionMemberCandidateKeys:[]},policyCoverage:{policyId:'sensum.activity-reference-collection-member-canonical-activity-identity-evidence-policy.v1',invalidRules:[],forbiddenPolicyPaths:[]},accountStateFindings:[],evidencePacketAttemptCoverageComplete:true,canonicalActivityIdentityEvidencePacketCoverageComplete:true,canonicalActivityIdentityReviewComplete:false,repeatabilityReviewComplete:false,requirementsXpTimingAndMechanicsComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:['canonical_activity_identity_disposition_pending','repeatability_and_member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'],publishable:true};
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'activity-reference-collection-member-canonical-activity-identity-evidence',createdAt:'2026-09-06T22:00:00Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_canonical_activity_identity_review_evidence_without_identity_or_optimizer_promotion',inputSnapshot:{directory:'input',contentHash:'d'.repeat(64),rejections:[]},audit:structuredClone(coreAudit)}};
  const audit={...structuredClone(coreAudit),generatedAt:'2026-09-06T22:00:01Z',policy:{id:'fixture',file:'fixture',contentHash:'e'.repeat(64)},inputSnapshot:{directory:'input',contentHash:'d'.repeat(64),rejections:[]},outputSnapshot:{directory,contentHash:manifest.contentHash}};audit.contentHash=hash(audit);
  return {raw,manifest,audit,record};
}

function rehashInput(input) { input.record.contentHash=hash(without(input.record,'contentHash'));input.raw=JSON.stringify(input.record)+'\n';input.manifest.contentHash=hash(input.raw);input.audit.outputSnapshot.contentHash=input.manifest.contentHash;input.audit.contentHash=hash(without(input.audit,'contentHash')); }

test('canonical-identity evidence preserves both source layers and closed semantic gates',()=>{
  const input=fixture(),first=validateActivityReferenceMemberCanonicalIdentityMaterializationInput(input),second=validateActivityReferenceMemberCanonicalIdentityMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:2,records:1,statements:1});
  assert.deepEqual(first.skillKeys,[]);
  assert.equal(first.statements[0].payload.canonicalActivityIdentity,null);
  assert.equal(first.statements[0].payload.canonicalActivityIdentityVerdict,null);
  assert.equal(first.gates.canonicalActivityIdentityReviewComplete,false);
});

test('canonical-identity tampering, account state, promotion, and source drift fail closed',()=>{
  const tampered=fixture();tampered.raw=tampered.raw.replace('Example competition','Changed competition');assert.throws(()=>validateActivityReferenceMemberCanonicalIdentityMaterializationInput(tampered),/snapshot_content_hash_mismatch/);
  const account=fixture();account.record.currentBaseLevel=34;rehashInput(account);assert.throws(()=>validateActivityReferenceMemberCanonicalIdentityMaterializationInput(account),/record_account_state_present/);
  const promoted=fixture();promoted.record.canonicalActivityIdentity='activity:example';rehashInput(promoted);assert.throws(()=>validateActivityReferenceMemberCanonicalIdentityMaterializationInput(promoted),/record_semantic_gate_weakened/);
  const drift=fixture();drift.record.canonicalActivityIdentityEvidence.linkedSubjectRelationship.sourcePage.sourceRevision='124';rehashInput(drift);assert.throws(()=>validateActivityReferenceMemberCanonicalIdentityMaterializationInput(drift),/record_linked_source_binding_mismatch/);
});

test('canonical-identity SQL is transactional, insert-only, candidate-only, and lineage-bound',()=>{
  const model=validateActivityReferenceMemberCanonicalIdentityMaterializationInput(fixture()),sql=buildActivityReferenceMemberCanonicalIdentityMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_CANONICAL_IDENTITY_FACT_KIND));assert.match(sql,/'candidate'/);assert.match(sql,/'review'/);assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);assert.match(sql,/ON CONFLICT .* DO NOTHING/);assert.match(sql,/COMMIT;\n$/);assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);assert.match(buildActivityReferenceMemberCanonicalIdentityExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('canonical-identity reconciliation rejects count, lineage, completeness, and promotion drift',()=>{
  const model=validateActivityReferenceMemberCanonicalIdentityMaterializationInput(fixture());const actual={runId:model.runId,status:'published',records:1,sources:2,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,skillCoverage:0,skillKeys:[],...model.gates}};assert.equal(verifyActivityReferenceMemberCanonicalIdentityReconciliation(model,actual),true);assert.throws(()=>verifyActivityReferenceMemberCanonicalIdentityReconciliation(model,{...actual,sources:1}),/sources_count_mismatch/);assert.throws(()=>verifyActivityReferenceMemberCanonicalIdentityReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);assert.throws(()=>verifyActivityReferenceMemberCanonicalIdentityReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);assert.throws(()=>verifyActivityReferenceMemberCanonicalIdentityReconciliation(model,{...actual,metrics:{...actual.metrics,canonicalActivityIdentityReviewComplete:true}}),/semantic_gate_weakened/);
});
