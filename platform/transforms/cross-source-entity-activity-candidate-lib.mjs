import {findAccountState} from '../ingestion/skill-training-guide-source-dependency-lib.mjs';

const unique=values=>[...new Set(values)];
const sorted=values=>unique(values.filter(value=>value!==null&&value!==undefined&&value!=='')).sort((a,b)=>String(a).localeCompare(String(b)));
const exact=value=>JSON.stringify(value);

function candidateKind(record){
  if(!record.crossSourcePageIdentityEstablished)return record.sourcePageId?'rendered_page_without_unlock_match':'unresolved_rendered_target';
  if(record.unlockEvidence?.activityPageCandidate)return 'activity_page_identity_candidate';
  if(record.unlockEvidence?.pageTypeClassified)return 'typed_page_identity_candidate';
  return 'untyped_page_identity_candidate';
}

function sourceContexts(record){
  return {
    renderedEvidence:record.renderedEvidence,
    unlockEvidence:record.unlockEvidence,
    crossSourcePageIdentityEstablished:record.crossSourcePageIdentityEstablished,
    revisionRelationship:record.revisionRelationship,
    semanticRoutingState:record.semanticRoutingState
  };
}

function pageIdentity(record){
  return {
    sourcePageId:record.sourcePageId,
    resolvedTitle:record.resolvedTitle,
    renderedSourceRevision:record.renderedEvidence?.targetPageIdentity?.sourceRevision||null,
    unlockSourceRevision:record.unlockEvidence?.source?.sourceRevision||null,
    revisionRelationship:record.revisionRelationship
  };
}

function evidenceReferences(record){
  const references=record.unlockEvidence?.targetReferences||[];
  return {
    skillKeys:sorted(references.flatMap(reference=>reference.referencedBy?.skillKeys||[])),
    statementKeys:sorted(references.flatMap(reference=>reference.referencedBy?.statementKeys||[]))
  };
}

function buildCandidate(record){
  const queued=record.crossSourcePageIdentityEstablished===true&&Number.isInteger(record.sourcePageId)&&record.sourcePageId>0;
  const references=evidenceReferences(record),kind=candidateKind(record),blockers=[];
  if(!record.sourcePageId)blockers.push('stable_wiki_page_id_missing');
  if(!record.crossSourcePageIdentityEstablished)blockers.push('exact_cross_source_page_identity_not_established');
  if(record.revisionRelationship==='different_revision')blockers.push('cross_source_revisions_differ');
  if(kind==='untyped_page_identity_candidate')blockers.push('source_scoped_page_type_unresolved');
  if(kind==='activity_page_identity_candidate')blockers.push('activity_page_type_is_discovery_evidence_only');
  blockers.push('canonical_game_entity_identity_not_established','canonical_activity_identity_not_established','repeatability_requirements_variants_xp_timing_and_mechanics_not_proven','optimizer_eligibility_blocked');
  return {
    contract:'sensum.cross-source-entity-activity-candidate.v1',
    renderedTargetKey:record.renderedTargetKey,
    candidateKey:queued?`osrs-wiki-pageid:${record.sourcePageId}`:null,
    candidateKind:kind,
    pageIdentity:pageIdentity(record),
    sourceContexts:sourceContexts(record),
    skillKeys:references.skillKeys,
    statementKeys:references.statementKeys,
    queuedForSemanticReview:queued,
    activityDiscoveryCandidate:queued&&record.unlockEvidence?.activityPageCandidate===true,
    reviewStatus:queued?'unreviewed':'not_queued',
    canonicalGameEntityIdentity:null,
    canonicalActivityIdentity:null,
    repeatabilityClassification:null,
    optimizerEligible:false,
    sourceCrosswalkContentHash:record.contentHash||null,
    accountIndependent:true,
    blockers:unique(blockers),
    state:'blocked'
  };
}

export function buildCrossSourceEntityActivityCandidates({crosswalkRecords=[]}={}){
  const records=crosswalkRecords.map(buildCandidate).sort((a,b)=>a.renderedTargetKey.localeCompare(b.renderedTargetKey));
  return {records,audit:auditCrossSourceEntityActivityCandidates(records,{crosswalkRecords})};
}

export function auditCrossSourceEntityActivityCandidates(records=[],{crosswalkRecords=[]}={}){
  const inputKeys=crosswalkRecords.map(record=>record.renderedTargetKey),recordKeys=records.map(record=>record.renderedTargetKey),duplicates=values=>unique(values.filter((value,index)=>values.indexOf(value)!==index)),duplicateInputKeys=duplicates(inputKeys),duplicateRecordKeys=duplicates(recordKeys),missingRecordKeys=inputKeys.filter(key=>!recordKeys.includes(key)),unexpectedRecordKeys=recordKeys.filter(key=>!inputKeys.includes(key)),inputByKey=new Map(crosswalkRecords.map(record=>[record.renderedTargetKey,record])),contextMismatchKeys=[],candidateRoutingMismatchKeys=[],activityRoutingMismatchKeys=[],pageIdentityMismatchKeys=[];
  for(const record of records){
    const input=inputByKey.get(record.renderedTargetKey);if(!input)continue;
    const expectedQueued=input.crossSourcePageIdentityEstablished===true&&Number.isInteger(input.sourcePageId)&&input.sourcePageId>0;
    if(exact(record.sourceContexts)!==exact(sourceContexts(input)))contextMismatchKeys.push(record.renderedTargetKey);
    if(record.candidateKind!==candidateKind(input)||record.queuedForSemanticReview!==expectedQueued||record.reviewStatus!==(expectedQueued?'unreviewed':'not_queued')||record.candidateKey!==(expectedQueued?`osrs-wiki-pageid:${input.sourcePageId}`:null))candidateRoutingMismatchKeys.push(record.renderedTargetKey);
    if(record.activityDiscoveryCandidate!==(expectedQueued&&input.unlockEvidence?.activityPageCandidate===true))activityRoutingMismatchKeys.push(record.renderedTargetKey);
    if(exact(record.pageIdentity)!==exact(pageIdentity(input)))pageIdentityMismatchKeys.push(record.renderedTargetKey);
  }
  const queued=records.filter(record=>record.queuedForSemanticReview),candidateKeys=queued.map(record=>record.candidateKey),duplicateCandidateKeys=duplicates(candidateKeys),promotions=records.filter(record=>record.canonicalGameEntityIdentity!==null||record.canonicalActivityIdentity!==null||record.repeatabilityClassification!==null||record.optimizerEligible!==false).map(record=>record.renderedTargetKey),accountState=findAccountState([...crosswalkRecords,...records]),sameRevision=queued.filter(record=>record.pageIdentity.revisionRelationship==='same_revision'),differentRevision=queued.filter(record=>record.pageIdentity.revisionRelationship==='different_revision'),kindCounts={},skillCounts={};
  for(const record of records)kindCounts[record.candidateKind]=(kindCounts[record.candidateKind]||0)+1;
  for(const record of queued)for(const skill of record.skillKeys)skillCounts[skill]=(skillCounts[skill]||0)+1;
  const blockers=[];
  if(duplicateInputKeys.length)blockers.push('duplicate_crosswalk_input_target_keys');if(duplicateRecordKeys.length)blockers.push('duplicate_candidate_inventory_target_keys');if(missingRecordKeys.length)blockers.push('one_or_more_crosswalk_targets_missing_from_candidate_inventory');if(unexpectedRecordKeys.length)blockers.push('unexpected_target_in_candidate_inventory');if(contextMismatchKeys.length)blockers.push('one_or_more_crosswalk_source_contexts_changed');if(candidateRoutingMismatchKeys.length)blockers.push('one_or_more_semantic_review_routes_invalid');if(activityRoutingMismatchKeys.length)blockers.push('one_or_more_activity_candidate_routes_invalid');if(pageIdentityMismatchKeys.length)blockers.push('one_or_more_page_identity_revisions_changed');if(duplicateCandidateKeys.length)blockers.push('stable_page_id_queued_more_than_once');if(promotions.length)blockers.push('unsupported_canonical_or_optimizer_promotion');if(accountState.length)blockers.push('account_query_state_baked_into_candidate_inventory');
  if(records.some(record=>record.candidateKind==='rendered_page_without_unlock_match'))blockers.push('one_or_more_rendered_pages_lack_unlock_evidence');if(records.some(record=>record.candidateKind==='unresolved_rendered_target'))blockers.push('one_or_more_rendered_targets_unresolved');if(records.some(record=>record.candidateKind==='untyped_page_identity_candidate'))blockers.push('one_or_more_cross_source_pages_remain_untyped');if(differentRevision.length)blockers.push('one_or_more_cross_source_candidate_revisions_differ');blockers.push('candidate_queue_does_not_establish_canonical_game_entity_or_activity_identity','repeatability_requirements_variants_xp_timing_and_mechanics_not_proven','independent_complete_activity_universe_not_established');
  const structural=['duplicate_crosswalk_input_target_keys','duplicate_candidate_inventory_target_keys','one_or_more_crosswalk_targets_missing_from_candidate_inventory','unexpected_target_in_candidate_inventory','one_or_more_crosswalk_source_contexts_changed','one_or_more_semantic_review_routes_invalid','one_or_more_activity_candidate_routes_invalid','one_or_more_page_identity_revisions_changed','stable_page_id_queued_more_than_once','unsupported_canonical_or_optimizer_promotion','account_query_state_baked_into_candidate_inventory'],candidateInventoryComplete=inputKeys.length>0&&!structural.some(blocker=>blockers.includes(blocker));
  return {
    contract:'sensum.cross-source-entity-activity-candidate-audit.v1',
    accountIndependent:accountState.length===0,
    inputCoverage:{crosswalkRecordCount:inputKeys.length,candidateInventoryRecordCount:recordKeys.length,duplicateInputTargetKeys:duplicateInputKeys,duplicateInventoryTargetKeys:duplicateRecordKeys,missingTargetKeys:missingRecordKeys,unexpectedTargetKeys:unexpectedRecordKeys,contextMismatchKeys,pageIdentityMismatchKeys,exactTargetSetAndContextMatch:!duplicateInputKeys.length&&!duplicateRecordKeys.length&&!missingRecordKeys.length&&!unexpectedRecordKeys.length&&!contextMismatchKeys.length&&!pageIdentityMismatchKeys.length},
    candidateCoverage:{semanticReviewQueueCount:queued.length,stableCandidateKeyCount:candidateKeys.length,duplicateCandidateKeys,candidateRoutingMismatchKeys,kindCounts:Object.fromEntries(Object.entries(kindCounts).sort(([a],[b])=>a.localeCompare(b))),renderedPageWithoutUnlockMatchCount:records.filter(record=>record.candidateKind==='rendered_page_without_unlock_match').length,unresolvedRenderedTargetCount:records.filter(record=>record.candidateKind==='unresolved_rendered_target').length},
    revisionCoverage:{sameRevisionCandidateCount:sameRevision.length,differentRevisionCandidateCount:differentRevision.length},
    semanticReviewCoverage:{activityDiscoveryCandidateCount:queued.filter(record=>record.activityDiscoveryCandidate).length,typedNonActivityCandidateCount:queued.filter(record=>record.candidateKind==='typed_page_identity_candidate').length,untypedCandidateCount:queued.filter(record=>record.candidateKind==='untyped_page_identity_candidate').length,skillCounts:Object.fromEntries(Object.entries(skillCounts).sort(([a],[b])=>a.localeCompare(b))),activityRoutingMismatchKeys,canonicalGameEntityIdentityCount:records.filter(record=>record.canonicalGameEntityIdentity!==null).length,canonicalActivityIdentityCount:records.filter(record=>record.canonicalActivityIdentity!==null).length,repeatabilityClassifiedCount:records.filter(record=>record.repeatabilityClassification!==null).length,optimizerEligibleCount:records.filter(record=>record.optimizerEligible===true).length,unsupportedPromotionTargetKeys:promotions},
    accountStateFindings:accountState,
    candidateInventoryComplete,
    completeActivityUniverse:false,
    absoluteBestGate:'blocked_incomplete_activity_universe',
    blockers:unique(blockers),
    publishable:candidateInventoryComplete
  };
}
