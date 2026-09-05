import { hash } from '../ingestion/lib.mjs';

const IDENTITY_BRANCH='reviewed_structural_candidate_member_identity_and_variant_scope_evidence';
const PAGE_TYPE_BRANCH='unresolved_source_page_entity_type_evidence';
const RELATIONSHIP_BRANCH='structural_parent_relationship_reconciliation_evidence';
const MEMBERSHIP_BRANCH='weighted_parent_task_entry_membership_evidence';
const MAPPING_BRANCH='declared_total_one_to_one_member_mapping_evidence';
const UNIVERSE_BRANCH='complete_member_universe_reconciliation_evidence';
const INPUT_BRANCHES=[IDENTITY_BRANCH,PAGE_TYPE_BRANCH,RELATIONSHIP_BRANCH,MEMBERSHIP_BRANCH,MAPPING_BRANCH,UNIVERSE_BRANCH];
const ROUTE_NAMES=['reviewReadyIdentity','multiVariantIdentity','nestedSubjectBinding','otherIdentityGap','structuralRelationshipGap','weightedMembership','declaredTotalMapping','completeUniverse'];
const REQUIRED_RULES=['oneRoutingRecordPerEligibleDispositionRecord','everyInputDispositionMustBeReferencedExactlyOnce','reviewReadyIdentityRoutesToExplicitHumanReviewNotAVerdict','multiVariantIdentityRoutesToExactParentVariantBinding','nestedIdentityAndPageTypeDispositionsMayMergeOnlyForTheSameCandidate','mergedNestedSubjectWorkMustReferenceBothSourceDispositions','unrecognizedIdentityReadinessFailuresRemainExplicitGenericWork','relationshipMembershipMappingAndUniverseBranchesRemainSeparate','existingRevisionPinnedEvidenceMayBeReferencedButNotReinterpreted','sourceSilenceArithmeticEqualityAndGlobalWeightLanguageCannotCompleteWork','allSemanticVerdictsReviewDecisionsAndCanonicalIdentitiesRemainNull','upstreamEvidenceDispositionsReviewsAndHashesMustBePreserved','namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterRoutingPolicy','repeatabilityMechanicsMemberExpansionAndOptimizerPromotionAreForbidden','currentAccountStateIsForbidden'];
const STAGE_FIELDS=new Set(['contract','contentHash','blockers','state','sourceStructuralMemberCandidateSemanticGapEvidenceDispositionContentHash','structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting']);
const VERDICT_FIELDS=['candidateMemberIdentityVerdict','sourcePageEntityTypeVerdict','structuralParentRelationshipVerdict','weightedTaskEntryMembershipVerdict','mappingVerdict','inventoryCompletenessVerdict','canonicalGameEntityIdentity'];
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const duplicates=values=>unique(values.filter((value,index)=>values.indexOf(value)!==index));
const preservedInput=record=>Object.fromEntries(Object.entries(record||{}).filter(([key])=>!STAGE_FIELDS.has(key)));

function forbiddenPolicyPaths(policy={}){
  const findings=[];
  const forbidden=/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|title|titles|label|labels|alias|aliases|override|overrides)$/i;
  const walk=(value,at='')=>{
    if(Array.isArray(value))return value.forEach((child,index)=>walk(child,`${at}[${index}]`));
    if(!value||typeof value!=='object')return;
    for(const [key,child]of Object.entries(value)){
      const next=at?`${at}.${key}`:key;
      if(forbidden.test(key))findings.push(next);
      walk(child,next);
    }
  };
  walk(policy);
  return sorted(unique(findings));
}

export function compileStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutingPolicy(policy={}){
  const invalidRules=REQUIRED_RULES.filter(rule=>policy.rules?.[rule]!==true);
  if(policy.rules?.automaticVerificationAllowed!==false)invalidRules.push('automaticVerificationAllowed');
  const contractValid=policy.inputContract==='sensum.structural-member-candidate-semantic-gap-evidence-disposition.v1'
    &&policy.recordContract==='sensum.structural-member-candidate-review-ready-identity-and-remaining-gap-work-routing.v1'
    &&policy.auditContract==='sensum.structural-member-candidate-review-ready-identity-and-remaining-gap-work-routing-audit.v1'
    &&policy.inputState==='structural_member_candidate_semantic_gap_evidence_disposition_recorded_gates_closed';
  const routes=policy.routes||{};
  const invalidRoutes=ROUTE_NAMES.filter(name=>{
    const route=routes[name];
    return !route||typeof route.routeKey!=='string'||!route.routeKey||typeof route.workKind!=='string'||!route.workKind||route.requiredChannels?.length!==4||new Set(route.requiredChannels).size!==4;
  });
  const routeKeys=ROUTE_NAMES.map(name=>routes[name]?.routeKey).filter(Boolean);
  const duplicateRouteKeys=duplicates(routeKeys);
  const forbidden=forbiddenPolicyPaths(policy);
  return {valid:contractValid&&!invalidRules.length&&!invalidRoutes.length&&!duplicateRouteKeys.length&&!forbidden.length,contractValid,invalidRules:unique(invalidRules),invalidRoutes,duplicateRouteKeys,forbiddenPolicyPaths:forbidden};
}

function allVerdictsNull(value={}){return VERDICT_FIELDS.every(field=>value[field]===null);}
function dispositionValid(disposition={}){
  return typeof disposition.dispositionKey==='string'&&disposition.dispositionKey.length>0
    &&INPUT_BRANCHES.includes(disposition.branchKey)
    &&disposition.packetIntegrity?.complete===true
    &&allVerdictsNull(disposition)
    &&disposition.memberUniverseComplete===false
    &&disposition.evidenceWorkComplete===false
    &&disposition.automaticVerificationApplied===false;
}
function selectorMatches(record,policy){
  const summary=record.structuralMemberCandidateSemanticGapEvidenceDisposition||{};
  const review=record.structuralMemberCandidateSemanticGapEvidenceDispositionReview||{};
  const dispositions=record.structuralMemberCandidateSemanticGapEvidenceDispositions||[];
  const identity=dispositions.filter(item=>item.branchKey===IDENTITY_BRANCH);
  const ready=identity.filter(item=>item.identityAndVariantScopeReviewReadiness?.reviewReady===true);
  const multiVariant=identity.filter(item=>item.identityAndVariantScopeReviewReadiness?.multiVariantSeries===true);
  const untyped=identity.filter(item=>item.identityAndVariantScopeReviewReadiness?.blockers?.includes('candidate_source_page_type_unresolved'));
  const readyKeys=sorted(ready.map(item=>item.dispositionKey));
  const blockedKeys=sorted(identity.filter(item=>item.identityAndVariantScopeReviewReadiness?.reviewReady!==true).map(item=>item.dispositionKey));
  return record.contract===policy.inputContract
    &&record.state===policy.inputState
    &&record.accountIndependent===true
    &&summary.state==='generic_fail_closed_semantic_sufficiency_disposition_recorded_all_verdicts_closed'
    &&summary.dispositionCount===dispositions.length
    &&summary.candidateIdentityDispositionCount===identity.length
    &&summary.candidateIdentityReviewReadyCount===ready.length
    &&summary.candidateIdentityReviewBlockedCount===identity.length-ready.length
    &&summary.multiVariantScopeBlockedCount===multiVariant.length
    &&summary.untypedOrNestedSubjectBindingBlockedCount===untyped.length
    &&INPUT_BRANCHES.every(branch=>summary.branchDispositionCounts?.[branch]===dispositions.filter(item=>item.branchKey===branch).length)
    &&summary.completedSemanticGapWorkItemCount===0
    &&summary.candidateMemberIdentityVerdictCount===0
    &&summary.sourcePageEntityTypeVerdictCount===0
    &&summary.structuralParentRelationshipVerdictCount===0
    &&summary.weightedTaskEntryMembershipVerdictCount===0
    &&summary.mappingVerdictCount===0
    &&summary.inventoryCompletenessVerdictCount===0
    &&summary.canonicalGameEntityIdentityCount===0
    &&summary.memberUniverseComplete===false
    &&summary.evidenceWorkComplete===false
    &&summary.automaticVerificationApplied===false
    &&review.state==='review_readiness_classified_final_semantic_decisions_pending'
    &&review.candidateMemberIdentityVerdict===null
    &&review.sourcePageEntityTypeVerdict===null
    &&review.structuralParentRelationshipVerdict===null
    &&review.weightedTaskEntryMembershipVerdict===null
    &&review.mappingVerdict===null
    &&review.inventoryCompletenessVerdict===null
    &&JSON.stringify(sorted(review.candidateIdentityReviewReadyDispositionKeys||[]))===JSON.stringify(readyKeys)
    &&JSON.stringify(sorted(review.candidateIdentityReviewBlockedDispositionKeys||[]))===JSON.stringify(blockedKeys)
    &&review.memberUniverseComplete===false
    &&review.evidenceWorkComplete===false
    &&review.automaticVerificationApplied===false
    &&dispositions.length>0
    &&new Set(dispositions.map(item=>item.dispositionKey)).size===dispositions.length
    &&dispositions.every(dispositionValid)
    &&record.memberExpansionReview?.state==='unreviewed'
    &&record.mechanicsReview?.state==='unreviewed'
    &&record.optimizerEligible===false;
}
export function selectStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutingInputs(records=[],policy={}){return records.filter(record=>selectorMatches(record,policy));}

function sourceIntegrity(source={},contentHash=hash){
  const identity=source.sourcePageIdentity||{};
  const text=source.exactRevisionSourceText;
  const checks={
    captureComplete:source.captureComplete===true&&source.state==='complete_exact_revision_source_capture_non_verdict',
    pageIdPresent:Number(identity.sourcePageId)>0,
    titlePresent:typeof identity.resolvedTitle==='string'&&identity.resolvedTitle.length>0,
    revisionPresent:typeof identity.sourceRevision==='string'&&identity.sourceRevision.length>0,
    timestampPresent:typeof identity.sourceTimestamp==='string'&&identity.sourceTimestamp.length>0,
    urlPresent:typeof identity.sourceUrl==='string'&&identity.sourceUrl.length>0,
    textPresent:typeof text==='string',
    hashMatches:typeof text==='string'&&contentHash(text)===identity.sourceContentHash,
    bytesMatch:typeof text==='string'&&Buffer.byteLength(text,'utf8')===identity.sourceContentBytes,
    upstreamIntegrityChecksPassed:Object.values(source.integrityChecks||{}).length>0&&Object.values(source.integrityChecks||{}).every(Boolean),
    semanticVerdictNull:source.semanticVerdict===null
  };
  return {checks,complete:Object.values(checks).every(Boolean)};
}

function workItem(input,policy,routeName,dispositions,{reviewReady=false,mergedNested=false}={}){
  const route=policy.routes[routeName];
  const dispositionKeys=sorted(dispositions.map(item=>item.dispositionKey));
  const candidateKeys=unique(dispositions.map(item=>item.structuralCandidateKey).filter(Boolean));
  const candidateRoles=unique(dispositions.map(item=>item.candidateRole).filter(Boolean));
  const readiness=dispositions.map(item=>item.identityAndVariantScopeReviewReadiness).find(Boolean)||null;
  return {
    workItemKey:`${dispositionKeys.join('&')}|work-route|${route.routeKey}`,
    routeKey:route.routeKey,
    workKind:route.workKind,
    structuralCandidateKey:candidateKeys.length===1?candidateKeys[0]:null,
    candidateRole:candidateRoles.length===1?candidateRoles[0]:null,
    sourceDispositionKeys:dispositionKeys,
    sourceDispositionStates:dispositions.map(item=>({dispositionKey:item.dispositionKey,state:item.state})).sort((a,b)=>a.dispositionKey.localeCompare(b.dispositionKey)),
    sourceEvidenceKeys:sorted(unique(dispositions.flatMap(item=>item.sourceEvidenceKeys||[]))),
    requiredChannels:route.requiredChannels,
    identityAndVariantScopeReviewReadiness:readiness,
    reviewReady,
    mergedNestedIdentityAndPageTypeDispositions:mergedNested,
    newEvidenceKeys:[],
    reviewDecision:null,
    candidateMemberIdentityVerdict:null,
    sourcePageEntityTypeVerdict:null,
    structuralParentRelationshipVerdict:null,
    weightedTaskEntryMembershipVerdict:null,
    mappingVerdict:null,
    inventoryCompletenessVerdict:null,
    canonicalGameEntityIdentity:null,
    memberUniverseComplete:false,
    evidenceWorkComplete:false,
    automaticVerificationApplied:false,
    workState:reviewReady?'pending_explicit_source_bound_identity_review_no_verdict':`blocked_pending_${route.routeKey}`
  };
}

function routeDispositions(input,policy){
  const dispositions=input.structuralMemberCandidateSemanticGapEvidenceDispositions||[];
  const identity=dispositions.filter(item=>item.branchKey===IDENTITY_BRANCH);
  const pageType=dispositions.filter(item=>item.branchKey===PAGE_TYPE_BRANCH);
  const usedIdentity=new Set(),usedPageType=new Set();
  const reviewReadyIdentityWorkItems=[];
  const multiVariantIdentityWorkItems=[];
  const nestedSubjectBindingWorkItems=[];
  const otherIdentityGapWorkItems=[];

  for(const typeDisposition of pageType){
    const matches=identity.filter(item=>item.structuralCandidateKey===typeDisposition.structuralCandidateKey&&item.identityAndVariantScopeReviewReadiness?.blockers?.includes('candidate_source_page_type_unresolved'));
    if(matches.length===1){
      const identityDisposition=matches[0];
      usedIdentity.add(identityDisposition.dispositionKey);
      usedPageType.add(typeDisposition.dispositionKey);
      nestedSubjectBindingWorkItems.push(workItem(input,policy,'nestedSubjectBinding',[identityDisposition,typeDisposition],{mergedNested:true}));
    }else{
      usedPageType.add(typeDisposition.dispositionKey);
      nestedSubjectBindingWorkItems.push(workItem(input,policy,'nestedSubjectBinding',[typeDisposition]));
    }
  }
  for(const disposition of identity){
    if(usedIdentity.has(disposition.dispositionKey))continue;
    const readiness=disposition.identityAndVariantScopeReviewReadiness||{};
    if(readiness.reviewReady===true)reviewReadyIdentityWorkItems.push(workItem(input,policy,'reviewReadyIdentity',[disposition],{reviewReady:true}));
    else if(readiness.multiVariantSeries===true)multiVariantIdentityWorkItems.push(workItem(input,policy,'multiVariantIdentity',[disposition]));
    else if(readiness.blockers?.includes('candidate_source_page_type_unresolved'))nestedSubjectBindingWorkItems.push(workItem(input,policy,'nestedSubjectBinding',[disposition]));
    else otherIdentityGapWorkItems.push(workItem(input,policy,'otherIdentityGap',[disposition]));
  }
  for(const disposition of pageType){
    if(!usedPageType.has(disposition.dispositionKey))nestedSubjectBindingWorkItems.push(workItem(input,policy,'nestedSubjectBinding',[disposition]));
  }
  const structuralRelationshipGapWorkItems=dispositions.filter(item=>item.branchKey===RELATIONSHIP_BRANCH).map(item=>workItem(input,policy,'structuralRelationshipGap',[item]));
  const weightedMembershipWorkItems=dispositions.filter(item=>item.branchKey===MEMBERSHIP_BRANCH).map(item=>workItem(input,policy,'weightedMembership',[item]));
  const declaredTotalMappingWorkItems=dispositions.filter(item=>item.branchKey===MAPPING_BRANCH).map(item=>workItem(input,policy,'declaredTotalMapping',[item]));
  const completeUniverseWorkItems=dispositions.filter(item=>item.branchKey===UNIVERSE_BRANCH).map(item=>workItem(input,policy,'completeUniverse',[item]));
  const groups={reviewReadyIdentityWorkItems,multiVariantIdentityWorkItems,nestedSubjectBindingWorkItems,otherIdentityGapWorkItems,structuralRelationshipGapWorkItems,weightedMembershipWorkItems,declaredTotalMappingWorkItems,completeUniverseWorkItems};
  const allItems=Object.values(groups).flat();
  return {groups,allItems};
}

function expectedRecord(input,policy){
  const {groups,allItems}=routeDispositions(input,policy);
  const sourceDispositionKeys=(input.structuralMemberCandidateSemanticGapEvidenceDispositions||[]).map(item=>item.dispositionKey);
  const referencedDispositionKeys=allItems.flatMap(item=>item.sourceDispositionKeys);
  const {contentHash:inputHash,blockers:inputBlockers=[],...rest}=input;
  return {
    contract:policy.recordContract,
    ...preservedInput(rest),
    sourceStructuralMemberCandidateSemanticGapEvidenceDispositionContentHash:inputHash,
    structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting:{
      routeState:'review_ready_identities_and_remaining_semantic_gaps_routed_all_verdicts_closed',
      ...groups,
      inputDispositionCount:sourceDispositionKeys.length,
      reviewReadyIdentityWorkItemCount:groups.reviewReadyIdentityWorkItems.length,
      multiVariantIdentityWorkItemCount:groups.multiVariantIdentityWorkItems.length,
      nestedSubjectBindingWorkItemCount:groups.nestedSubjectBindingWorkItems.length,
      mergedNestedSubjectWorkItemCount:groups.nestedSubjectBindingWorkItems.filter(item=>item.mergedNestedIdentityAndPageTypeDispositions).length,
      otherIdentityGapWorkItemCount:groups.otherIdentityGapWorkItems.length,
      structuralRelationshipGapWorkItemCount:groups.structuralRelationshipGapWorkItems.length,
      weightedMembershipWorkItemCount:groups.weightedMembershipWorkItems.length,
      declaredTotalMappingWorkItemCount:groups.declaredTotalMappingWorkItems.length,
      completeUniverseWorkItemCount:groups.completeUniverseWorkItems.length,
      totalWorkItemCount:allItems.length,
      sourceDispositionReferenceCount:referencedDispositionKeys.length,
      uniqueSourceDispositionReferenceCount:new Set(referencedDispositionKeys).size,
      existingEvidenceReferenceCount:allItems.reduce((sum,item)=>sum+item.sourceEvidenceKeys.length,0),
      newEvidenceKeyCount:0,
      completedWorkItemCount:0,
      reviewDecisionCount:0,
      semanticVerdictCount:0,
      candidateIdentityRelationshipMembershipMappingAndUniverseBranchesSeparated:true,
      identityReviewComplete:false,
      memberUniverseComplete:false,
      evidenceWorkComplete:false,
      automaticVerificationApplied:false
    },
    accountIndependent:true,
    blockers:unique([...inputBlockers,'candidate_identity_and_remaining_semantic_gap_work_routed_not_completed',...(groups.reviewReadyIdentityWorkItems.length?['source_bound_candidate_identity_reviews_pending']:[]),...(groups.multiVariantIdentityWorkItems.length?['exact_parent_variant_binding_evidence_pending']:[]),...(groups.nestedSubjectBindingWorkItems.length?['nested_subject_and_page_type_binding_evidence_pending']:[]),...(groups.otherIdentityGapWorkItems.length?['other_candidate_identity_readiness_gap_evidence_pending']:[]),...(groups.structuralRelationshipGapWorkItems.length?['structural_parent_relationship_reconciliation_pending']:[]),'weighted_parent_task_entry_membership_not_proven','one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven','member_universe_completeness_not_proven','all_repeatability_evidence_domains_remain_unresolved','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']),
    state:'structural_member_candidate_review_ready_identity_and_remaining_gap_work_routed_gates_closed'
  };
}

function allItems(route={}){return [route.reviewReadyIdentityWorkItems||[],route.multiVariantIdentityWorkItems||[],route.nestedSubjectBindingWorkItems||[],route.otherIdentityGapWorkItems||[],route.structuralRelationshipGapWorkItems||[],route.weightedMembershipWorkItems||[],route.declaredTotalMappingWorkItems||[],route.completeUniverseWorkItems||[]].flat();}
function routeSemanticFailure(item,dispositionsByKey,policy){
  const refs=(item.sourceDispositionKeys||[]).map(key=>dispositionsByKey.get(key)).filter(Boolean);
  const candidateKeys=unique(refs.map(ref=>ref.structuralCandidateKey).filter(Boolean));
  const expectedCandidateKey=candidateKeys.length===1?candidateKeys[0]:null;
  if(refs.length!==(item.sourceDispositionKeys||[]).length||item.structuralCandidateKey!==expectedCandidateKey)return true;
  if(item.routeKey===policy.routes.reviewReadyIdentity.routeKey)return refs.length!==1||refs[0].branchKey!==IDENTITY_BRANCH||refs[0].identityAndVariantScopeReviewReadiness?.reviewReady!==true||item.reviewReady!==true;
  if(item.routeKey===policy.routes.multiVariantIdentity.routeKey)return refs.length!==1||refs[0].branchKey!==IDENTITY_BRANCH||refs[0].identityAndVariantScopeReviewReadiness?.reviewReady===true||refs[0].identityAndVariantScopeReviewReadiness?.multiVariantSeries!==true;
  if(item.routeKey===policy.routes.nestedSubjectBinding.routeKey){
    if(item.mergedNestedIdentityAndPageTypeDispositions)return refs.length!==2||refs.filter(ref=>ref.branchKey===IDENTITY_BRANCH&&ref.identityAndVariantScopeReviewReadiness?.blockers?.includes('candidate_source_page_type_unresolved')).length!==1||refs.filter(ref=>ref.branchKey===PAGE_TYPE_BRANCH).length!==1||candidateKeys.length!==1;
    return refs.length!==1||!((refs[0].branchKey===PAGE_TYPE_BRANCH)||(refs[0].branchKey===IDENTITY_BRANCH&&refs[0].identityAndVariantScopeReviewReadiness?.blockers?.includes('candidate_source_page_type_unresolved')));
  }
  if(item.routeKey===policy.routes.otherIdentityGap.routeKey)return refs.length!==1||refs[0].branchKey!==IDENTITY_BRANCH||refs[0].identityAndVariantScopeReviewReadiness?.reviewReady===true||refs[0].identityAndVariantScopeReviewReadiness?.multiVariantSeries===true||refs[0].identityAndVariantScopeReviewReadiness?.blockers?.includes('candidate_source_page_type_unresolved');
  if(item.routeKey===policy.routes.structuralRelationshipGap.routeKey)return refs.length!==1||refs[0].branchKey!==RELATIONSHIP_BRANCH;
  if(item.routeKey===policy.routes.weightedMembership.routeKey)return refs.length!==1||refs[0].branchKey!==MEMBERSHIP_BRANCH;
  if(item.routeKey===policy.routes.declaredTotalMapping.routeKey)return refs.length!==1||refs[0].branchKey!==MAPPING_BRANCH;
  if(item.routeKey===policy.routes.completeUniverse.routeKey)return refs.length!==1||refs[0].branchKey!==UNIVERSE_BRANCH;
  return true;
}
function accountStateFindings(records){
  const forbidden=/^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i,findings=[];
  const walk=(value,at='')=>{
    if(Array.isArray(value))return value.forEach((child,index)=>walk(child,`${at}[${index}]`));
    if(!value||typeof value!=='object')return;
    for(const [key,child]of Object.entries(value)){
      const next=at?`${at}.${key}`:key;
      if(forbidden.test(key))findings.push(next);
      walk(child,next);
    }
  };
  records.forEach((record,index)=>walk(record,`[${index}]`));
  return findings;
}

export function auditStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutes(records=[],{dispositionRecords=[],policy={},contentHash=hash}={}){
  const compiled=compileStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutingPolicy(policy);
  const inputs=selectStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutingInputs(dispositionRecords,policy);
  const expected=compiled.valid?inputs.map(input=>expectedRecord(input,policy)):[];
  const inputKeys=inputs.map(item=>item.memberCandidateKey),outputKeys=records.map(item=>item.memberCandidateKey);
  const duplicateInputKeys=duplicates(inputKeys),duplicateOutputKeys=duplicates(outputKeys);
  const missingOutputKeys=inputKeys.filter(key=>!outputKeys.includes(key)),unexpectedOutputKeys=outputKeys.filter(key=>!inputKeys.includes(key));
  const recordMismatches=records.filter(record=>{const match=expected.find(item=>item.memberCandidateKey===record.memberCandidateKey);return !match||contentHash(record)!==contentHash(match);}).map(item=>item.memberCandidateKey);
  const upstreamMismatches=records.filter(record=>{const input=inputs.find(item=>item.memberCandidateKey===record.memberCandidateKey);return !input||contentHash(preservedInput(record))!==contentHash(preservedInput(input));}).map(item=>item.memberCandidateKey);
  const sources=records.flatMap(record=>record.structuralMemberCandidateSemanticGapEvidenceSources||[]);
  const sourceFailures=sources.filter(source=>!sourceIntegrity(source,contentHash).complete).map(source=>source.sourceKey);
  const inputDispositions=inputs.flatMap(record=>record.structuralMemberCandidateSemanticGapEvidenceDispositions||[]);
  const inputDispositionKeys=inputDispositions.map(item=>item.dispositionKey);
  const routes=records.map(record=>record.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting||{});
  const items=routes.flatMap(allItems);
  const referenceKeys=items.flatMap(item=>item.sourceDispositionKeys||[]);
  const duplicateReferenceKeys=duplicates(referenceKeys),missingDispositionReferences=inputDispositionKeys.filter(key=>!referenceKeys.includes(key)),unexpectedDispositionReferences=referenceKeys.filter(key=>!inputDispositionKeys.includes(key));
  const dispositionsByKey=new Map(inputDispositions.map(item=>[item.dispositionKey,item]));
  const mergedNestedValidationFailures=items.filter(item=>item.mergedNestedIdentityAndPageTypeDispositions).filter(item=>{
    const refs=(item.sourceDispositionKeys||[]).map(key=>dispositionsByKey.get(key)).filter(Boolean);
    return refs.length!==2||refs.filter(ref=>ref.branchKey===IDENTITY_BRANCH).length!==1||refs.filter(ref=>ref.branchKey===PAGE_TYPE_BRANCH).length!==1||new Set(refs.map(ref=>ref.structuralCandidateKey)).size!==1;
  }).map(item=>item.workItemKey);
  const itemFailures=items.filter(item=>{
    const route=Object.values(policy.routes||{}).find(candidate=>candidate.routeKey===item.routeKey);
    return !route||item.workKind!==route.workKind||item.requiredChannels?.length!==4||!item.sourceDispositionKeys?.length||item.newEvidenceKeys?.length||item.reviewDecision!==null||!allVerdictsNull(item)||item.memberUniverseComplete!==false||item.evidenceWorkComplete!==false||item.automaticVerificationApplied!==false;
  }).map(item=>item.workItemKey);
  const routeSemanticFailures=items.filter(item=>routeSemanticFailure(item,dispositionsByKey,policy)).map(item=>item.workItemKey);
  const routeFailures=records.filter(record=>{
    const route=record.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting||{},routeItems=allItems(route),input=inputs.find(item=>item.memberCandidateKey===record.memberCandidateKey),dispositionCount=input?.structuralMemberCandidateSemanticGapEvidenceDispositions?.length||0,refs=routeItems.flatMap(item=>item.sourceDispositionKeys||[]);
    return route.inputDispositionCount!==dispositionCount||route.totalWorkItemCount!==routeItems.length||route.sourceDispositionReferenceCount!==refs.length||route.uniqueSourceDispositionReferenceCount!==new Set(refs).size||route.uniqueSourceDispositionReferenceCount!==dispositionCount||route.newEvidenceKeyCount!==0||route.completedWorkItemCount!==0||route.reviewDecisionCount!==0||route.semanticVerdictCount!==0||route.candidateIdentityRelationshipMembershipMappingAndUniverseBranchesSeparated!==true||route.identityReviewComplete!==false||route.memberUniverseComplete!==false||route.evidenceWorkComplete!==false||route.automaticVerificationApplied!==false;
  }).map(item=>item.memberCandidateKey);
  const unsupportedPromotions=records.filter(record=>{
    const route=record.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting||{};
    return route.identityReviewComplete!==false||route.memberUniverseComplete!==false||route.evidenceWorkComplete!==false||route.automaticVerificationApplied!==false||route.completedWorkItemCount!==0||route.reviewDecisionCount!==0||route.semanticVerdictCount!==0||allItems(route).some(item=>item.reviewDecision!==null||!allVerdictsNull(item)||item.memberUniverseComplete!==false||item.evidenceWorkComplete!==false||item.automaticVerificationApplied!==false)||record.memberExpansionReview?.state!=='unreviewed'||record.mechanicsReview?.state!=='unreviewed'||record.optimizerEligible!==false;
  }).map(item=>item.memberCandidateKey);
  const accountFindings=accountStateFindings(records),blockers=[];
  if(!compiled.valid)blockers.push('review_ready_identity_and_remaining_gap_routing_policy_invalid_or_page_specific');
  if(dispositionRecords.length!==inputs.length||duplicateInputKeys.length)blockers.push('input_semantic_disposition_set_not_exactly_eligible_and_unique');
  if(duplicateOutputKeys.length||missingOutputKeys.length||unexpectedOutputKeys.length)blockers.push('input_output_work_route_set_mismatch');
  if(sourceFailures.length)blockers.push('one_or_more_exact_revision_sources_failed_revalidation');
  if(duplicateReferenceKeys.length||missingDispositionReferences.length||unexpectedDispositionReferences.length)blockers.push('input_disposition_reference_coverage_not_exactly_once');
  if(mergedNestedValidationFailures.length)blockers.push('merged_nested_subject_work_does_not_bind_exactly_one_identity_and_page_type_disposition_for_same_candidate');
  if(itemFailures.length||routeFailures.length)blockers.push('one_or_more_review_or_gap_work_routes_invalid');
  if(routeSemanticFailures.length)blockers.push('one_or_more_work_items_do_not_match_semantic_route_conditions');
  if(recordMismatches.length)blockers.push('one_or_more_routes_do_not_match_generic_policy');
  if(upstreamMismatches.length)blockers.push('upstream_evidence_dispositions_reviews_or_hashes_changed');
  if(unsupportedPromotions.length)blockers.push('routing_created_unsupported_review_identity_membership_completeness_mechanics_or_optimizer_promotion');
  if(accountFindings.length)blockers.push('current_account_state_present');
  const publishable=compiled.valid&&dispositionRecords.length===inputs.length&&!duplicateInputKeys.length&&!duplicateOutputKeys.length&&!missingOutputKeys.length&&!unexpectedOutputKeys.length&&!sourceFailures.length&&!duplicateReferenceKeys.length&&!missingDispositionReferences.length&&!unexpectedDispositionReferences.length&&!mergedNestedValidationFailures.length&&!itemFailures.length&&!routeFailures.length&&!routeSemanticFailures.length&&!recordMismatches.length&&!upstreamMismatches.length&&!unsupportedPromotions.length&&!accountFindings.length;
  const count=key=>items.filter(item=>item.routeKey===policy.routes?.[key]?.routeKey).length;
  return {
    contract:policy.auditContract,
    inputCoverage:{inputDispositionRecordCount:dispositionRecords.length,eligibleDispositionRecordCount:inputs.length,routeRecordCount:records.length,duplicateInputKeys,duplicateOutputKeys,missingOutputKeys,unexpectedOutputKeys},
    policyCoverage:compiled,
    sourceIntegrityCoverage:{sourceCount:sources.length,completeSourceCount:sources.length-sourceFailures.length,failedSourceCount:sourceFailures.length,failedSourceKeys:sourceFailures},
    routingCoverage:{inputDispositionCount:inputDispositions.length,totalWorkItemCount:items.length,reviewReadyIdentityWorkItemCount:count('reviewReadyIdentity'),multiVariantIdentityWorkItemCount:count('multiVariantIdentity'),nestedSubjectBindingWorkItemCount:count('nestedSubjectBinding'),mergedNestedSubjectWorkItemCount:items.filter(item=>item.mergedNestedIdentityAndPageTypeDispositions).length,otherIdentityGapWorkItemCount:count('otherIdentityGap'),structuralRelationshipGapWorkItemCount:count('structuralRelationshipGap'),weightedMembershipWorkItemCount:count('weightedMembership'),declaredTotalMappingWorkItemCount:count('declaredTotalMapping'),completeUniverseWorkItemCount:count('completeUniverse'),completedWorkItemCount:items.filter(item=>item.evidenceWorkComplete).length,reviewDecisionCount:items.filter(item=>item.reviewDecision!==null).length,semanticVerdictCount:items.filter(item=>!allVerdictsNull(item)).length,itemFailures,routeFailures,routeSemanticFailures},
    dispositionReferenceCoverage:{sourceDispositionReferenceCount:referenceKeys.length,uniqueSourceDispositionReferenceCount:new Set(referenceKeys).size,duplicateReferenceKeys,missingDispositionReferences,unexpectedDispositionReferences,mergedNestedValidationFailures},
    branchSeparationCoverage:{separatedRecordCount:routes.filter(route=>route.candidateIdentityRelationshipMembershipMappingAndUniverseBranchesSeparated).length,reviewReadyIdentityBranchCount:count('reviewReadyIdentity'),identityEvidenceGapBranchCount:count('multiVariantIdentity')+count('nestedSubjectBinding')+count('otherIdentityGap'),relationshipBranchCount:count('structuralRelationshipGap'),membershipBranchCount:count('weightedMembership'),mappingBranchCount:count('declaredTotalMapping'),universeBranchCount:count('completeUniverse')},
    semanticPreservationCoverage:{recordMismatches,upstreamMismatches,unsupportedPromotions},
    accountStateFindings:accountFindings,
    routingCoverageComplete:publishable&&records.length===inputs.length,
    identityReviewComplete:false,
    evidenceWorkComplete:false,
    memberExpansionComplete:false,
    mechanicsReviewComplete:false,
    optimizerEligibleCount:0,
    completeActivityUniverse:false,
    absoluteBestGate:'blocked_incomplete_activity_universe',
    blockers:unique([...blockers,'candidate_identity_and_remaining_semantic_gap_work_routed_not_completed',...(count('reviewReadyIdentity')?['source_bound_candidate_identity_reviews_pending']:[]),...(count('multiVariantIdentity')?['exact_parent_variant_binding_evidence_pending']:[]),...(count('nestedSubjectBinding')?['nested_subject_and_page_type_binding_evidence_pending']:[]),...(count('otherIdentityGap')?['other_candidate_identity_readiness_gap_evidence_pending']:[]),...(count('structuralRelationshipGap')?['structural_parent_relationship_reconciliation_pending']:[]),'weighted_parent_task_entry_membership_not_proven','one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven','member_universe_completeness_not_proven','all_repeatability_evidence_domains_remain_unresolved','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']),
    publishable
  };
}

export function buildStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutes({dispositionRecords=[],policy={},contentHash=hash}={}){
  const compiled=compileStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutingPolicy(policy);
  const records=compiled.valid?selectStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutingInputs(dispositionRecords,policy).map(input=>expectedRecord(input,policy)):[];
  return {records,audit:auditStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutes(records,{dispositionRecords,policy,contentHash})};
}
