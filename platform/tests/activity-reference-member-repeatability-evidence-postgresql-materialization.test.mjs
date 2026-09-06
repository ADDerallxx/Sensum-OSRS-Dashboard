import assert from 'node:assert/strict';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND,
  buildActivityReferenceMemberRepeatabilityExistingSourceCountQuery,
  buildActivityReferenceMemberRepeatabilityMaterializationSql,
  validateActivityReferenceMemberRepeatabilityMaterializationInput,
  verifyActivityReferenceMemberRepeatabilityReconciliation
} from '../db/activity-reference-member-repeatability-evidence-materialization-lib.mjs';

const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));

function fixture() {
  const identity={canonicalActivityKey:'activity:test:example',canonicalLabel:'Example activity',identityClass:'collection_defined_activity_with_descriptive_page_anchor',linkedSubjectIsCanonicalActivity:false,evidenceRevisionBoundary:{collectionRevision:'999',linkedSourceRevision:'123'},evidenceKeys:['identity:example']};
  const signal={contextText:'The activity can be repeated.',definitionKey:'explicit_positive_can_or_may_be_repeated',evidenceKey:'repeatability:example:1',matchedText:'can be repeated',reviewState:'candidate_only_not_a_repeatability_verdict',scannedTextHash:'a'.repeat(64),signalKind:'explicit_positive_repeatability_declaration_candidate',sourceContentHash:'a'.repeat(64),sourceLocator:{columnEnd:28,columnStart:14,lineEnd:4,lineStart:4},sourcePageId:42,sourceRevision:'123',sourceScope:'complete_linked_source_revision'};
  const record={
    contract:'sensum.activity-reference-collection-member-repeatability-evidence.v1',memberCandidateKey:'collection-row:2078:999:section:1:2',sourcePageId:42,resolvedTitle:'Example activity',sourceRevision:'123',sourceTimestamp:'2026-09-02T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:'a'.repeat(64),canonicalGameEntityIdentity:null,canonicalActivityIdentity:identity,canonicalActivityIdentityReview:{state:'reviewed_source_supported',identity:structuredClone(identity),evidenceKeys:['identity:example']},
    repeatabilityEvidence:{canonicalActivityIdentity:structuredClone(identity),evidenceState:'complete_revision_pinned_repeatability_review_packet',linkedSourceScan:{commentsAndProtectedRegionsMasked:true,completeRevisionContentScanned:true,fetchedContentHash:'a'.repeat(64),resolvedTitle:'Example activity',scannedLineCount:10,sourceContentBytes:100,sourceContentHash:'a'.repeat(64),sourcePageId:42,sourceRevision:'123',sourceTimestamp:'2026-09-02T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity'},collectionRowScan:{commentsAndProtectedRegionsMasked:true,exactRetainedRowScanned:true,resolvedTitle:'Minigames',rowSourceLocator:{lineStart:10,lineEnd:12},rowTextHash:'b'.repeat(64),scannedLineCount:3,sourceContentBytes:30,sourceContentHash:'c'.repeat(64),sourcePageId:2078,sourceRevision:'999',sourceTimestamp:'2026-09-01T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Minigames'},sourceAlignment:{canonicalActivityIdentityPresent:true,canonicalActivityIdentityReviewIsSourceSupported:true,fetchedContentHashMatchesInput:true,fetchedPageIdMatchesInput:true,fetchedRevisionMatchesInput:true,fetchedTimestampMatchesInput:true,fetchedTitleMatchesInput:true,fetchedUrlMatchesInput:true,identityBoundaryMatchesCollectionRevision:true,identityBoundaryMatchesLinkedRevision:true,inputContractMatchesPolicy:true,linkedSubjectRemainsDistinctFromCanonicalActivity:true},sourceLocatedSignals:[signal]},
    repeatabilityCandidateObservations:{absenceSemantics:'no_lexical_signal_does_not_establish_non_repeatability',deficiencies:[],explicitNegativeDeclarationCandidateCount:0,explicitPositiveDeclarationCandidateCount:1,noLexicalSignalObserved:false,observationState:'source_located_candidates_only_repeatability_unreviewed',positiveNegativeConflictCandidate:false,recurrenceStructureCandidateCount:0,repeatabilityVerdict:null,sessionBoundaryCandidateCount:0},repeatabilityReview:{state:'unreviewed',classification:null,evidenceKeys:[]},memberExpansionReview:{state:'unreviewed',atomicSubject:null,memberKeys:[],evidenceKeys:[]},mechanicsReview:{state:'unreviewed',evidenceKeys:[]},optimizerEligible:false,accountIndependent:true,blockers:['repeatability_disposition_pending','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'],state:'repeatability_evidence_packet_complete_review_unperformed'
  };
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n',directory='2026-09-06T23-00-00-000Z';
  const coreAudit={contract:'sensum.activity-reference-collection-member-repeatability-evidence-audit.v1',accountIndependent:true,inputCoverage:{expectedCanonicalActivityIdentityCount:1,repeatabilityEvidencePacketCount:1,duplicateInputMemberCandidateKeys:[],duplicateOutputMemberCandidateKeys:[],missingMemberCandidateKeys:[],unexpectedMemberCandidateKeys:[],contextMismatchMemberCandidateKeys:[],structurallyInvalidInputMemberCandidateKeys:[],exactInputOutputSetAndContextMatch:true},sourceAlignment:{expectedExactRevisionCount:1,fetchedExactRevisionCount:1,duplicateFetchedRevisionIds:[],missingFetchedRevisionIds:[],unexpectedFetchedRevisionIds:[],alignedPacketCount:1,alignmentFailureMemberCandidateKeys:[]},policyCoverage:{policy:'sensum.activity-reference-collection-member-repeatability-evidence-policy.v1',signalDefinitionCount:11,invalidRules:[],forbiddenPolicyPaths:[],duplicateDefinitionKeys:[],invalidDefinitionKeys:[],requiredDefinitionKindsMissing:[]},repeatabilityEvidenceCoverage:{completePacketCount:1,incompletePacketCount:0,incompleteMemberCandidateKeys:[],completeLinkedSourceScanCount:1,exactCollectionRowScanCount:1,linkedSourceBytesScanned:100,collectionRowBytesScanned:30,sourceLocatedSignalCount:1,invalidPacketMemberCandidateKeys:[],incompleteScanMemberCandidateKeys:[],invalidSignalMemberCandidateKeys:[]},candidateObservationCoverage:{explicitPositiveDeclarationCandidateCount:1,explicitNegativeDeclarationCandidateCount:0,recurrenceStructureCandidateCount:0,sessionBoundaryCandidateCount:0,positiveNegativeConflictCandidateCount:0,zeroSignalPacketCount:0,repeatabilityVerdictCount:0},semanticPromotionCoverage:{repeatabilityReviewedCount:0,memberExpansionReviewedCount:0,mechanicsReviewedCount:0,optimizerEligibleCount:0,unsupportedPromotionMemberCandidateKeys:[]},accountStateFindings:[],evidencePacketAttemptCoverageComplete:true,repeatabilityEvidencePacketCoverageComplete:true,repeatabilityReviewComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:['repeatability_disposition_pending','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'],publishable:true};
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'activity-reference-collection-member-repeatability-evidence',createdAt:'2026-09-06T23:00:00Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_complete_linked_source_and_exact_collection_row_repeatability_evidence_candidates_without_semantic_promotion',inputSnapshot:{directory:'input',contentHash:'d'.repeat(64),rejections:[]},fetchedRevisions:[{pageId:42,title:'Example activity',revision:'123',timestamp:'2026-09-02T00:00:00Z',contentHash:'a'.repeat(64)}],audit:structuredClone(coreAudit)}};
  const audit={...structuredClone(coreAudit),generatedAt:'2026-09-06T23:00:01Z',policy:{id:'fixture',file:'fixture',contentHash:'e'.repeat(64)},inputSnapshot:{directory:'input',contentHash:'d'.repeat(64),rejections:[]},outputSnapshot:{directory,contentHash:manifest.contentHash}};
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

test('repeatability evidence preserves reviewed activity identity but no repeatability verdict',()=>{
  const input=fixture(),first=validateActivityReferenceMemberRepeatabilityMaterializationInput(input),second=validateActivityReferenceMemberRepeatabilityMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:1,records:1,statements:1,signals:1,canonicalActivities:1});
  assert.deepEqual(first.skillKeys,[]);
  assert.equal(first.statements[0].payload.canonicalActivityIdentity.canonicalActivityKey,'activity:test:example');
  assert.equal(first.statements[0].payload.repeatabilityVerdict,null);
  assert.equal(first.gates.repeatabilityReviewComplete,false);
  const auditLocated=fixture(); delete auditLocated.manifest.snapshotDirectory;
  assert.equal(validateActivityReferenceMemberRepeatabilityMaterializationInput(auditLocated).snapshotDirectory,auditLocated.audit.outputSnapshot.directory);
});

test('repeatability tampering, account state, promotion, count drift, and source drift fail closed',()=>{
  const tampered=fixture(); tampered.raw=tampered.raw.replace('Example activity','Changed activity'); assert.throws(()=>validateActivityReferenceMemberRepeatabilityMaterializationInput(tampered),/snapshot_content_hash_mismatch/);
  const account=fixture(); account.record.currentBaseLevel=34; rehashInput(account); assert.throws(()=>validateActivityReferenceMemberRepeatabilityMaterializationInput(account),/record_account_state_present/);
  const promoted=fixture(); promoted.record.repeatabilityCandidateObservations.repeatabilityVerdict='repeatable'; promoted.record.repeatabilityReview={state:'reviewed_source_supported',classification:'repeatable',evidenceKeys:['repeatability:example:1']}; rehashInput(promoted); assert.throws(()=>validateActivityReferenceMemberRepeatabilityMaterializationInput(promoted),/repeatability_review_not_closed|candidate_gate_invalid/);
  const countDrift=fixture(); countDrift.audit.repeatabilityEvidenceCoverage.sourceLocatedSignalCount=2; countDrift.audit.contentHash=hash(without(countDrift.audit,'contentHash')); assert.throws(()=>validateActivityReferenceMemberRepeatabilityMaterializationInput(countDrift),/manifest_embedded_audit_mismatch|counts_do_not_reconcile/);
  const sourceDrift=fixture(); sourceDrift.record.repeatabilityEvidence.linkedSourceScan.sourceRevision='124'; rehashInput(sourceDrift); assert.throws(()=>validateActivityReferenceMemberRepeatabilityMaterializationInput(sourceDrift),/linked_source_scan_invalid/);
  const directoryDrift=fixture(); directoryDrift.manifest.snapshotDirectory='different'; assert.throws(()=>validateActivityReferenceMemberRepeatabilityMaterializationInput(directoryDrift),/audit_output_snapshot_mismatch/);
});

test('repeatability SQL is transactional, insert-only, candidate-only, and lineage-bound',()=>{
  const model=validateActivityReferenceMemberRepeatabilityMaterializationInput(fixture()),sql=buildActivityReferenceMemberRepeatabilityMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND));
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.match(buildActivityReferenceMemberRepeatabilityExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('repeatability reconciliation rejects count, lineage, completeness, and semantic drift',()=>{
  const model=validateActivityReferenceMemberRepeatabilityMaterializationInput(fixture());
  const actual={runId:model.runId,status:'published',records:1,sources:1,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,signals:1,canonicalActivities:1,skillCoverage:0,skillKeys:[],...model.gates}};
  assert.equal(verifyActivityReferenceMemberRepeatabilityReconciliation(model,actual),true);
  assert.throws(()=>verifyActivityReferenceMemberRepeatabilityReconciliation(model,{...actual,sources:0}),/sources_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberRepeatabilityReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberRepeatabilityReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivityReferenceMemberRepeatabilityReconciliation(model,{...actual,metrics:{...actual.metrics,repeatabilityReviewComplete:true}}),/semantic_gate_weakened/);
});
