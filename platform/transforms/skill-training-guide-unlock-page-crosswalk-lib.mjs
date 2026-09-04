import {findAccountState} from '../ingestion/skill-training-guide-source-dependency-lib.mjs';

const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));

function renderedEvidenceFrom(record){
  return {
    requestedTitles: record.requestedTitles||[],
    namespaceIds: record.namespaceIds||[],
    guideObservationCount: record.guideObservationCount,
    observations: record.observations||[],
    sourcePresenceCounts: record.sourcePresenceCounts||{},
    targetPageIdentity: record.targetPageIdentity||null
  };
}

function unlockEvidenceFrom(record){
  if(!record)return null;
  return {
    canonicalWikiPageKey: record.canonicalWikiPageKey,
    sourcePageId: record.sourcePageId,
    resolvedTitle: record.resolvedTitle,
    targetReferenceCount: record.targetReferenceCount,
    targetReferences: record.targetReferences||[],
    entityTypes: record.entityTypes||[],
    pageTypeClassified: Boolean(record.pageTypeClassified),
    activityPageCandidate: Boolean(record.activityPageCandidate),
    source: record.source||null
  };
}

function revisionRelationship(rendered,unlock){
  if(!rendered.targetPageIdentity)return 'rendered_target_unresolved';
  if(!unlock)return 'no_unlock_page_match';
  return String(rendered.targetPageIdentity.sourceRevision)===String(unlock.source?.sourceRevision)?'same_revision':'different_revision';
}

function semanticRoutingState(rendered,unlock){
  if(!rendered.targetPageIdentity)return 'rendered_target_unresolved';
  if(!unlock)return 'rendered_stable_page_without_unlock_evidence';
  if(unlock.activityPageCandidate)return 'cross_source_activity_page_candidate';
  if(unlock.pageTypeClassified)return 'cross_source_typed_page';
  return 'cross_source_untyped_page';
}

function crosswalkRecord(rendered,unlock){
  const blockers=[];
  if(!rendered.targetPageIdentity)blockers.push('rendered_target_wiki_page_missing');
  else if(!unlock)blockers.push('no_level_unlock_page_evidence_for_rendered_target');
  if(unlock&&String(rendered.targetPageIdentity?.sourceRevision)!==String(unlock.source?.sourceRevision))blockers.push('source_revisions_differ');
  if(unlock&&!unlock.pageTypeClassified)blockers.push('unlock_page_type_unresolved');
  if(unlock?.activityPageCandidate)blockers.push('activity_page_candidate_not_repeatability_proof');
  blockers.push('historical_dependency_revision_closure_not_established','canonical_game_entity_identity_not_established','canonical_activity_identity_not_established','requirements_variants_xp_timing_and_mechanics_not_proven','optimizer_eligibility_blocked');
  return {
    contract:'sensum.skill-training-guide-unlock-page-crosswalk.v1',
    renderedTargetKey:rendered.renderedTargetKey,
    sourcePageId:rendered.targetPageIdentity?.sourcePageId||null,
    resolvedTitle:rendered.targetPageIdentity?.resolvedTitle||rendered.requestedTitles?.[0]||null,
    renderedEvidence:renderedEvidenceFrom(rendered),
    unlockEvidence:unlockEvidenceFrom(unlock),
    crossSourcePageIdentityEstablished:Boolean(rendered.targetPageIdentity&&unlock),
    revisionRelationship:revisionRelationship(rendered,unlock),
    semanticRoutingState:semanticRoutingState(rendered,unlock),
    canonicalGameEntityIdentity:null,
    canonicalActivityIdentity:null,
    repeatableTrainingActivity:null,
    optimizerEligible:false,
    accountIndependent:true,
    blockers:unique(blockers),
    state:'blocked'
  };
}

function exact(value){return JSON.stringify(value)}

export function buildSkillTrainingGuideUnlockPageCrosswalk({renderedLinkRecords=[],unlockEquivalenceRecords=[]}={}){
  const unlockByPageId=new Map(unlockEquivalenceRecords.map(record=>[record.sourcePageId,record]));
  const records=renderedLinkRecords.map(rendered=>crosswalkRecord(rendered,rendered.targetPageIdentity?unlockByPageId.get(rendered.targetPageIdentity.sourcePageId):null)).sort((a,b)=>a.renderedTargetKey.localeCompare(b.renderedTargetKey));
  return {records,audit:auditSkillTrainingGuideUnlockPageCrosswalk(records,{renderedLinkRecords,unlockEquivalenceRecords})};
}

export function auditSkillTrainingGuideUnlockPageCrosswalk(records=[],{renderedLinkRecords=[],unlockEquivalenceRecords=[]}={}){
  const renderedKeys=renderedLinkRecords.map(record=>record.renderedTargetKey),recordKeys=records.map(record=>record.renderedTargetKey),duplicateRenderedKeys=unique(renderedKeys.filter((value,index)=>renderedKeys.indexOf(value)!==index)),duplicateRecordKeys=unique(recordKeys.filter((value,index)=>recordKeys.indexOf(value)!==index)),missingRecordKeys=renderedKeys.filter(key=>!recordKeys.includes(key)),unexpectedRecordKeys=recordKeys.filter(key=>!renderedKeys.includes(key)),renderedByKey=new Map(renderedLinkRecords.map(record=>[record.renderedTargetKey,record])),unlockPageIds=unlockEquivalenceRecords.map(record=>record.sourcePageId),duplicateUnlockPageIds=unique(unlockPageIds.filter((value,index)=>unlockPageIds.indexOf(value)!==index)),unlockByPageId=new Map(unlockEquivalenceRecords.map(record=>[record.sourcePageId,record])),renderedContextMismatches=[],unlockContextMismatches=[],matchLogicMismatches=[],revisionRelationshipMismatches=[],semanticRoutingMismatches=[];
  for(const record of records){
    const rendered=renderedByKey.get(record.renderedTargetKey);if(!rendered)continue;
    const unlock=rendered.targetPageIdentity?unlockByPageId.get(rendered.targetPageIdentity.sourcePageId):null;
    if(exact(record.renderedEvidence)!==exact(renderedEvidenceFrom(rendered)))renderedContextMismatches.push(record.renderedTargetKey);
    if(exact(record.unlockEvidence)!==exact(unlockEvidenceFrom(unlock)))unlockContextMismatches.push(record.renderedTargetKey);
    if(record.crossSourcePageIdentityEstablished!==Boolean(rendered.targetPageIdentity&&unlock)||record.sourcePageId!==(rendered.targetPageIdentity?.sourcePageId||null))matchLogicMismatches.push(record.renderedTargetKey);
    if(record.revisionRelationship!==revisionRelationship(rendered,unlock))revisionRelationshipMismatches.push(record.renderedTargetKey);
    if(record.semanticRoutingState!==semanticRoutingState(rendered,unlock))semanticRoutingMismatches.push(record.renderedTargetKey);
  }
  const matched=records.filter(record=>record.crossSourcePageIdentityEstablished),matchedPageIds=new Set(matched.map(record=>record.sourcePageId)),unmatched=records.filter(record=>!record.crossSourcePageIdentityEstablished),sameRevision=matched.filter(record=>record.revisionRelationship==='same_revision'),differentRevision=matched.filter(record=>record.revisionRelationship==='different_revision'),typed=matched.filter(record=>record.unlockEvidence?.pageTypeClassified),activityCandidates=matched.filter(record=>record.unlockEvidence?.activityPageCandidate),entityTypeCounts={};
  for(const record of matched)for(const entityType of record.unlockEvidence?.entityTypes||[])entityTypeCounts[entityType]=(entityTypeCounts[entityType]||0)+1;
  const sortedEntityTypeCounts=Object.fromEntries(Object.entries(entityTypeCounts).sort(([a],[b])=>a.localeCompare(b))),inputObservationCount=renderedLinkRecords.reduce((sum,record)=>sum+(record.guideObservationCount||0),0),outputObservationCount=records.reduce((sum,record)=>sum+(record.renderedEvidence?.guideObservationCount||0),0),matchedObservationCount=matched.reduce((sum,record)=>sum+(record.renderedEvidence?.guideObservationCount||0),0),promotions=records.filter(record=>record.canonicalGameEntityIdentity!==null||record.canonicalActivityIdentity!==null||record.repeatableTrainingActivity!==null||record.optimizerEligible!==false).map(record=>record.renderedTargetKey),accountState=findAccountState([...renderedLinkRecords,...unlockEquivalenceRecords,...records]),blockers=[];
  if(duplicateRenderedKeys.length)blockers.push('duplicate_rendered_input_target_keys');if(duplicateRecordKeys.length)blockers.push('duplicate_crosswalk_target_keys');if(missingRecordKeys.length)blockers.push('one_or_more_rendered_targets_missing_from_crosswalk');if(unexpectedRecordKeys.length)blockers.push('unexpected_target_in_crosswalk');if(duplicateUnlockPageIds.length)blockers.push('duplicate_unlock_equivalence_page_ids');if(renderedContextMismatches.length)blockers.push('one_or_more_rendered_contexts_changed');if(unlockContextMismatches.length)blockers.push('one_or_more_unlock_contexts_changed');if(matchLogicMismatches.length)blockers.push('one_or_more_cross_source_matches_not_exact_page_id_matches');if(revisionRelationshipMismatches.length)blockers.push('one_or_more_revision_relationships_incorrect');if(semanticRoutingMismatches.length)blockers.push('one_or_more_semantic_routes_incorrect');if(inputObservationCount!==outputObservationCount)blockers.push('rendered_observation_count_not_preserved');if(promotions.length)blockers.push('unsupported_crosswalk_semantic_promotion');if(accountState.length)blockers.push('account_query_state_baked_into_crosswalk');
  if(unmatched.length)blockers.push('one_or_more_rendered_targets_lack_unlock_evidence');if(unlockEquivalenceRecords.some(record=>!matchedPageIds.has(record.sourcePageId)))blockers.push('one_or_more_unlock_pages_lack_rendered_guide_evidence');if(records.some(record=>record.revisionRelationship==='rendered_target_unresolved'))blockers.push('one_or_more_rendered_targets_unresolved');if(differentRevision.length)blockers.push('one_or_more_cross_source_page_revisions_differ');blockers.push('historical_dependency_revision_closure_not_established','cross_source_page_identity_does_not_establish_game_entity_or_activity_identity','repeatability_requirements_variants_xp_timing_and_mechanics_not_proven','independent_complete_activity_universe_not_established');
  const structural=['duplicate_rendered_input_target_keys','duplicate_crosswalk_target_keys','one_or_more_rendered_targets_missing_from_crosswalk','unexpected_target_in_crosswalk','duplicate_unlock_equivalence_page_ids','one_or_more_rendered_contexts_changed','one_or_more_unlock_contexts_changed','one_or_more_cross_source_matches_not_exact_page_id_matches','one_or_more_revision_relationships_incorrect','one_or_more_semantic_routes_incorrect','rendered_observation_count_not_preserved','unsupported_crosswalk_semantic_promotion','account_query_state_baked_into_crosswalk'],crosswalkCoverageComplete=renderedKeys.length>0&&!structural.some(blocker=>blockers.includes(blocker));
  return {
    contract:'sensum.skill-training-guide-unlock-page-crosswalk-audit.v1',
    accountIndependent:accountState.length===0,
    renderedTargetCoverage:{inputTargetCount:renderedKeys.length,crosswalkRecordCount:recordKeys.length,inputGuideObservationCount:inputObservationCount,preservedGuideObservationCount:outputObservationCount,stableRenderedPageCount:renderedLinkRecords.filter(record=>record.targetPageIdentity).length,unresolvedRenderedTargetCount:renderedLinkRecords.filter(record=>!record.targetPageIdentity).length,duplicateInputTargetKeys:duplicateRenderedKeys,duplicateCrosswalkTargetKeys:duplicateRecordKeys,missingTargetKeys:missingRecordKeys,unexpectedTargetKeys:unexpectedRecordKeys,renderedContextMismatchKeys:renderedContextMismatches,exactRenderedTargetSetAndContextMatch:!duplicateRenderedKeys.length&&!duplicateRecordKeys.length&&!missingRecordKeys.length&&!unexpectedRecordKeys.length&&!renderedContextMismatches.length&&inputObservationCount===outputObservationCount},
    unlockEvidenceCoverage:{unlockEquivalenceRecordCount:unlockEquivalenceRecords.length,duplicateUnlockPageIds,unlockContextMismatchKeys:unlockContextMismatches,unlockOnlyPageCount:unlockEquivalenceRecords.filter(record=>!matchedPageIds.has(record.sourcePageId)).length},
    crossSourceIdentityCoverage:{exactStablePageIdMatchCount:matched.length,matchedGuideObservationCount:matchedObservationCount,renderedTargetsWithoutUnlockMatchCount:unmatched.length,renderedGuideObservationsWithoutUnlockMatchCount:outputObservationCount-matchedObservationCount,matchLogicMismatchKeys:matchLogicMismatches,allRenderedTargetsHaveUnlockEvidence:unmatched.length===0},
    revisionCoverage:{sameRevisionMatchCount:sameRevision.length,differentRevisionMatchCount:differentRevision.length,unresolvedOrUnmatchedRevisionCount:unmatched.length,revisionRelationshipMismatchKeys:revisionRelationshipMismatches},
    semanticRoutingCoverage:{typedCrossSourcePageCount:typed.length,untypedCrossSourcePageCount:matched.length-typed.length,activityPageCandidateCount:activityCandidates.length,entityTypeCounts:sortedEntityTypeCounts,semanticRoutingMismatchKeys:semanticRoutingMismatches,canonicalGameEntityIdentityCount:records.filter(record=>record.canonicalGameEntityIdentity!==null).length,canonicalActivityIdentityCount:records.filter(record=>record.canonicalActivityIdentity!==null).length,repeatabilityProvenCount:records.filter(record=>record.repeatableTrainingActivity!==null).length,optimizerEligibleCount:records.filter(record=>record.optimizerEligible===true).length,unsupportedPromotionTargetKeys:promotions},
    accountStateFindings:accountState,
    crosswalkCoverageComplete,
    completeActivityUniverse:false,
    absoluteBestGate:'blocked_incomplete_activity_universe',
    blockers:unique(blockers),
    publishable:crosswalkCoverageComplete
  };
}
