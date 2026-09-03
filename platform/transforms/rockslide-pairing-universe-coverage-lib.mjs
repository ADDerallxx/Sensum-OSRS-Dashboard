const FULL_ACTIVITY_SCOPE='all_repeatable_training_activities_across_every_official_trainable_skill';
const FULL_TRANSPORT_SCOPE='all_player_transport_paths_with_requirements_costs_slots_and_timing';
const decisions=new Set(['compatible','incompatible','blocked']);
const unique=values=>[...new Set(values)];
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const nonEmpty=value=>Array.isArray(value)&&value.length>0;
const finite=value=>Number.isFinite(Number(value));
const sourceRefValid=ref=>Boolean(ref?.sourceRevision&&ref?.sourceUrl&&ref?.sourceLocator);
const duplicateValues=values=>unique(values.filter((value,index)=>value&&values.indexOf(value)!==index));

const accountQueryKey=key=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(key);
export function findEmbeddedAccountQueryState(records=[]){
  const findings=[];
  const visit=(value,path,recordKey)=>{
    if(Array.isArray(value)){value.forEach((item,index)=>visit(item,`${path}[${index}]`,recordKey));return}
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      const childPath=path?`${path}.${key}`:key;
      if(accountQueryKey(key))findings.push({recordKey,path:childPath,value:child});
      visit(child,childPath,recordKey);
    }
  };
  records.forEach((record,index)=>visit(record,'',record?.activityKey||record?.pathKey||record?.skillKey||`record-${index}`));
  return findings;
}

function validateSkillDomain(skillDomains){
  const blockers=[],keys=skillDomains.map(row=>row?.skillKey).filter(Boolean),duplicates=duplicateValues(keys),invalid=skillDomains.filter(row=>!row?.skillKey||!row?.skill||!Number.isInteger(Number(row?.minimumBaseLevel))||!Number.isInteger(Number(row?.maximumBaseLevel))||Number(row.minimumBaseLevel)<1||Number(row.maximumBaseLevel)<Number(row.minimumBaseLevel)||!row?.sourceRevision||!row?.sourceUrl||!nonEmpty(row?.sourceLocator?.evidence));
  if(!skillDomains.length)blockers.push('official_skill_domain_missing');
  if(duplicates.length)blockers.push('official_skill_domain_has_duplicate_skills');
  if(invalid.length)blockers.push('official_skill_domain_has_invalid_records');
  return {skillKeys:unique(keys),duplicates,invalidSkillKeys:invalid.map(row=>row?.skillKey||null),blockers};
}

function validateActivityUniverse(universe,officialSkillKeys){
  const activities=Array.isArray(universe?.activities)?universe.activities:[],coverage=Array.isArray(universe?.skillCoverage)?universe.skillCoverage:[],blockers=[];
  const activityKeys=activities.map(row=>row?.activityKey).filter(Boolean),duplicateActivityKeys=duplicateValues(activityKeys),coverageKeys=coverage.map(row=>row?.skillKey).filter(Boolean),duplicateCoverageKeys=duplicateValues(coverageKeys),official=new Set(officialSkillKeys),knownActivities=new Set(activityKeys);
  if(universe?.contract!=='sensum.activity-universe.v1')blockers.push('activity_universe_contract_missing_or_invalid');
  if(universe?.scope!==FULL_ACTIVITY_SCOPE)blockers.push('activity_universe_scope_is_not_full_game');
  if(universe?.complete!==true)blockers.push('activity_universe_not_declared_complete');
  if(!nonEmpty(universe?.sourceRefs)||!universe.sourceRefs.every(sourceRefValid))blockers.push('activity_universe_discovery_provenance_incomplete');
  if(!activities.length)blockers.push('activity_universe_has_no_activities');
  if(duplicateActivityKeys.length)blockers.push('activity_universe_has_duplicate_activity_keys');
  if(duplicateCoverageKeys.length)blockers.push('activity_universe_has_duplicate_skill_coverage');
  const missingSkillCoverage=officialSkillKeys.filter(key=>!coverageKeys.includes(key)),unexpectedSkillCoverage=coverageKeys.filter(key=>!official.has(key)),incompleteSkillCoverage=coverage.filter(row=>row?.complete!==true||!nonEmpty(row?.activityKeys)||!nonEmpty(row?.sourceRefs)||!row.sourceRefs.every(sourceRefValid)).map(row=>row?.skillKey||null);
  if(missingSkillCoverage.length)blockers.push('one_or_more_official_skills_lack_activity_coverage');
  if(unexpectedSkillCoverage.length)blockers.push('activity_coverage_contains_unknown_skills');
  if(incompleteSkillCoverage.length)blockers.push('one_or_more_skill_activity_coverage_declarations_are_incomplete');
  const invalidIdentities=[],invalidPairability=[],unknownSkills=[],unlinkedActivities=[];
  for(const activity of activities){
    const key=activity?.activityKey||null,skills=Array.isArray(activity?.skillKeys)?activity.skillKeys:[];
    if(!key||!activity?.name||!nonEmpty(skills)||activity?.repeatable!==true||!nonEmpty(activity?.sourceRefs)||!activity.sourceRefs.every(sourceRefValid))invalidIdentities.push(key);
    if(skills.some(skill=>!official.has(skill)))unknownSkills.push(key);
    const locationsValid=nonEmpty(activity?.locations)&&activity.locations.every(location=>location?.locationKey&&typeof location?.returnEligible==='boolean'),cycle=activity?.cyclePolicy,bank=cycle?.bankReturnBehavior,cycleValid=nonEmpty(cycle?.interruptWindows)&&typeof cycle?.returnState==='string'&&typeof bank?.required==='boolean'&&typeof bank?.returnTeleportReusable==='boolean';
    if(!locationsValid||!cycleValid||!Array.isArray(activity?.requirements)||!Array.isArray(activity?.unresolvedMechanics))invalidPairability.push(key);
    const declaredByEverySkill=skills.every(skill=>coverage.some(row=>row?.skillKey===skill&&Array.isArray(row?.activityKeys)&&row.activityKeys.includes(key)));
    if(!declaredByEverySkill)unlinkedActivities.push(key);
  }
  const unknownDeclaredActivities=unique(coverage.flatMap(row=>Array.isArray(row?.activityKeys)?row.activityKeys:[]).filter(key=>!knownActivities.has(key)));
  if(invalidIdentities.length)blockers.push('one_or_more_activity_identities_are_incomplete');
  if(invalidPairability.length)blockers.push('one_or_more_activities_lack_pairability_evidence_shape');
  if(unknownSkills.length)blockers.push('one_or_more_activities_reference_unknown_skills');
  if(unlinkedActivities.length||unknownDeclaredActivities.length)blockers.push('activity_and_skill_coverage_links_do_not_close');
  const accountQueryState=findEmbeddedAccountQueryState([universe,...activities,...coverage]);
  if(accountQueryState.length)blockers.push('account_query_state_baked_into_activity_universe');
  const identityComplete=!blockers.some(blocker=>['activity_universe_contract_missing_or_invalid','activity_universe_scope_is_not_full_game','activity_universe_not_declared_complete','activity_universe_discovery_provenance_incomplete','activity_universe_has_no_activities','activity_universe_has_duplicate_activity_keys','activity_universe_has_duplicate_skill_coverage','one_or_more_official_skills_lack_activity_coverage','activity_coverage_contains_unknown_skills','one_or_more_skill_activity_coverage_declarations_are_incomplete','one_or_more_activity_identities_are_incomplete','one_or_more_activities_reference_unknown_skills','activity_and_skill_coverage_links_do_not_close','account_query_state_baked_into_activity_universe'].includes(blocker));
  return {activities,activityKeys,coverage,identityComplete,blockers,missingSkillCoverage,unexpectedSkillCoverage,incompleteSkillCoverage,duplicateActivityKeys,duplicateCoverageKeys,invalidIdentities,invalidPairability,unknownSkills,unlinkedActivities,unknownDeclaredActivities,accountQueryState};
}

function timingComplete(timing){return finite(timing?.ticks)||finite(timing?.minimumTicks)&&finite(timing?.maximumTicks)&&Number(timing.minimumTicks)<=Number(timing.maximumTicks)}
function validateTransportationUniverse(universe){
  const paths=Array.isArray(universe?.paths)?universe.paths:[],blockers=[],pathKeys=paths.map(row=>row?.pathKey).filter(Boolean),duplicatePathKeys=duplicateValues(pathKeys),invalidIdentities=[],invalidMechanics=[];
  if(universe?.contract!=='sensum.transportation-universe.v1')blockers.push('transportation_universe_contract_missing_or_invalid');
  if(universe?.scope!==FULL_TRANSPORT_SCOPE)blockers.push('transportation_universe_scope_is_not_full_game');
  if(universe?.complete!==true)blockers.push('transportation_universe_not_declared_complete');
  if(!nonEmpty(universe?.sourceRefs)||!universe.sourceRefs.every(sourceRefValid))blockers.push('transportation_universe_discovery_provenance_incomplete');
  if(!paths.length)blockers.push('transportation_universe_has_no_paths');
  if(duplicatePathKeys.length)blockers.push('transportation_universe_has_duplicate_path_keys');
  for(const path of paths){
    const key=path?.pathKey||null;
    if(path?.contract!=='sensum.transportation-path.v1'||!key||!path?.originLocationKey||!path?.destinationLocationKey||!nonEmpty(path?.transportKinds)||!nonEmpty(path?.sourceRefs)||!path.sourceRefs.every(sourceRefValid))invalidIdentities.push(key);
    const cost=path?.cost,consumption=path?.consumption,bank=path?.bankInteraction,shape=own(path,'timing')&&finite(cost?.gp)&&Number(cost.gp)>=0&&Array.isArray(cost?.items)&&finite(consumption?.charges)&&Number(consumption.charges)>=0&&Array.isArray(consumption?.items)&&Array.isArray(path?.equipmentSlots)&&Array.isArray(path?.requirements)&&typeof bank?.arrivesAtBank==='boolean'&&typeof bank?.reusesRequiredBankReturn==='boolean'&&Array.isArray(path?.unresolvedMechanics);
    if(!shape||!timingComplete(path?.timing)||path.unresolvedMechanics?.length)invalidMechanics.push(key);
  }
  if(invalidIdentities.length)blockers.push('one_or_more_transport_path_identities_are_incomplete');
  if(invalidMechanics.length)blockers.push('one_or_more_transport_paths_have_incomplete_mechanics');
  const accountQueryState=findEmbeddedAccountQueryState([universe,...paths]);
  if(accountQueryState.length)blockers.push('account_query_state_baked_into_transportation_universe');
  const identityComplete=!blockers.some(blocker=>blocker!=='one_or_more_transport_paths_have_incomplete_mechanics');
  const mechanicsComplete=identityComplete&&!invalidMechanics.length;
  return {paths,pathKeys,identityComplete,mechanicsComplete,blockers,duplicatePathKeys,invalidIdentities,invalidMechanics,accountQueryState};
}

function validateRockslideContext(context,transportState){
  const blockers=[],outbound=transportState.paths.filter(path=>path.pathKey===context?.outboundPathKey),accountQueryState=findEmbeddedAccountQueryState(context?[context]:[]);
  if(!context?.exitLocationKey||!context?.outboundPathKey||!nonEmpty(context?.requiredEquipmentSlots)||!nonEmpty(context?.sourceRefs)||!context.sourceRefs.every(sourceRefValid)||!Array.isArray(context?.unresolvedMechanics))blockers.push('rockslide_pairing_context_missing_or_invalid');
  if(outbound.length!==1)blockers.push('rockslide_outbound_path_missing_or_duplicate_in_transport_universe');
  if(accountQueryState.length)blockers.push('account_query_state_baked_into_rockslide_context');
  return {blockers,outboundPathMatches:outbound.length,accountQueryState,identityComplete:!blockers.some(blocker=>blocker!=='rockslide_pairing_context_mechanics_incomplete'),mechanicsComplete:!blockers.length&&!context.unresolvedMechanics.length&&transportState.mechanicsComplete};
}

function validateAssessments(assessments,activityState,transportState,contextState,context){
  const blockers=[],activityKeys=new Set(activityState.activityKeys),pathKeys=new Set(transportState.pathKeys),assessmentKeys=assessments.map(row=>row?.activityKey).filter(Boolean),duplicateActivityAssessments=duplicateValues(assessmentKeys),unknownActivityAssessments=unique(assessmentKeys.filter(key=>!activityKeys.has(key))),missingActivityAssessments=activityState.activityKeys.filter(key=>!assessmentKeys.includes(key)),invalidAssessments=[],unassessedReturnPaths=[];
  for(const assessment of assessments){
    const activity=activityState.activities.find(row=>row.activityKey===assessment?.activityKey),evaluated=Array.isArray(assessment?.evaluatedReturnPathKeys)?assessment.evaluatedReturnPathKeys:[],compatible=Array.isArray(assessment?.compatibleReturnPathKeys)?assessment.compatibleReturnPathKeys:[],returnLocations=new Set((activity?.locations||[]).filter(location=>location?.returnEligible===true).map(location=>location?.locationKey).filter(Boolean)),relevant=transportState.paths.filter(path=>path.originLocationKey===context?.exitLocationKey&&returnLocations.has(path.destinationLocationKey)).map(path=>path.pathKey),unknownPaths=unique([...evaluated,...compatible].filter(key=>!pathKeys.has(key))),missingRelevant=relevant.filter(key=>!evaluated.includes(key)),equipmentConflict=assessment?.equipmentConflict,equipmentConflictValid=['compatible','incompatible','blocked'].includes(equipmentConflict?.status)&&Array.isArray(equipmentConflict?.conflictingSlots)&&nonEmpty(equipmentConflict?.reasonCodes);
    const valid=activity&&decisions.has(assessment?.decision)&&nonEmpty(assessment?.decisionReasons)&&Array.isArray(assessment?.evaluatedReturnPathKeys)&&Array.isArray(assessment?.compatibleReturnPathKeys)&&equipmentConflictValid&&nonEmpty(assessment?.sourceRefs)&&assessment.sourceRefs.every(sourceRefValid)&&!unknownPaths.length&&compatible.every(key=>evaluated.includes(key))&&!(assessment.decision==='compatible'&&!compatible.length)&&!(['incompatible','blocked'].includes(assessment.decision)&&compatible.length)&&!(assessment.decision==='compatible'&&equipmentConflict.status!=='compatible');
    if(!valid)invalidAssessments.push(assessment?.activityKey||null);
    if(missingRelevant.length)unassessedReturnPaths.push({activityKey:assessment?.activityKey||null,pathKeys:missingRelevant});
  }
  if(!assessments.length)blockers.push('pairing_assessment_set_missing_or_empty');
  if(duplicateActivityAssessments.length)blockers.push('one_or_more_activities_have_duplicate_pairing_assessments');
  if(unknownActivityAssessments.length)blockers.push('pairing_assessments_reference_unknown_activities');
  if(missingActivityAssessments.length)blockers.push('one_or_more_activities_lack_pairing_assessment');
  if(invalidAssessments.length)blockers.push('one_or_more_pairing_assessments_are_invalid');
  if(unassessedReturnPaths.length)blockers.push('one_or_more_relevant_return_paths_are_unassessed');
  const accountQueryState=findEmbeddedAccountQueryState(assessments);
  if(accountQueryState.length)blockers.push('account_query_state_baked_into_pairing_assessments');
  return {blockers,duplicateActivityAssessments,unknownActivityAssessments,missingActivityAssessments,invalidAssessments,unassessedReturnPaths,accountQueryState,complete:contextState.identityComplete&&!blockers.length,mechanicsComplete:contextState.mechanicsComplete&&!blockers.length&&assessments.every(assessment=>assessment.decision!=='blocked'&&assessment.equipmentConflict?.status!=='blocked')};
}

function validateNamedGuideRegression(namedGuideMembers,activityState){
  const required=['rockslide:core-detour','rockslide:pairing:ardougne-rooftop','rockslide:pairing:hallowed-sepulchre','rockslide:pairing:runecraft-bank-return'],keys=namedGuideMembers.map(row=>row?.memberKey),missing=required.filter(key=>!keys.includes(key)),revisionSet=unique(namedGuideMembers.map(row=>row?.sourceRevision).filter(Boolean)),blockers=[];
  if(missing.length||namedGuideMembers.length!==required.length)blockers.push('named_rockslide_guide_regression_members_missing_or_changed');
  if(revisionSet.length!==1||namedGuideMembers.some(row=>!row?.sourceUrl||!row?.sourceLocator))blockers.push('named_rockslide_guide_regression_provenance_invalid');
  const namedActivities=namedGuideMembers.filter(row=>row?.pairedActivity).map(row=>row.pairedActivity),matchedActivities=namedActivities.filter(name=>activityState.activities.some(activity=>activity.name===name));
  if(activityState.identityComplete&&matchedActivities.length!==namedActivities.length)blockers.push('named_rockslide_activity_examples_missing_from_complete_universe');
  return {expectedMemberCount:required.length,observedMemberCount:namedGuideMembers.length,missingMemberKeys:missing,sourceRevision:revisionSet.length===1?revisionSet[0]:null,namedActivityExamples:namedActivities,matchedActivityExamples:matchedActivities,examplesAreUniverseSeeds:false,blockers,complete:!blockers.length};
}

export function auditRockslidePairingUniverseCoverage({skillDomains=[],rockslideContext=null,activityUniverse=null,transportationUniverse=null,pairingAssessments=[],namedGuideMembers=[],observedActivityCorpus=null,snapshotRejections=[]}){
  const skillState=validateSkillDomain(skillDomains),activityState=validateActivityUniverse(activityUniverse,skillState.skillKeys),transportState=validateTransportationUniverse(transportationUniverse),contextState=validateRockslideContext(rockslideContext,transportState),assessmentState=validateAssessments(pairingAssessments,activityState,transportState,contextState,rockslideContext),namedGuideRegression=validateNamedGuideRegression(namedGuideMembers,activityState),blockers=unique([...skillState.blockers,...activityState.blockers,...transportState.blockers,...contextState.blockers,...assessmentState.blockers,...namedGuideRegression.blockers,...(snapshotRejections.length?['one_or_more_input_snapshots_rejected']:[])]),identityUniverseComplete=!skillState.blockers.length&&activityState.identityComplete&&transportState.identityComplete&&contextState.identityComplete&&assessmentState.complete&&namedGuideRegression.complete&&!snapshotRejections.length,mechanicalCoverageComplete=identityUniverseComplete&&transportState.mechanicsComplete&&contextState.mechanicsComplete&&assessmentState.mechanicsComplete&&!activityState.invalidPairability.length&&activityState.activities.every(activity=>!activity.unresolvedMechanics.length);
  if(identityUniverseComplete&&!mechanicalCoverageComplete&&!blockers.includes('rockslide_pairing_mechanics_incomplete'))blockers.push('rockslide_pairing_mechanics_incomplete');
  return {
    contract:'sensum.rockslide-pairing-universe-coverage-audit.v1',
    accountIndependent:true,
    officialSkillDomain:{skillCount:skillState.skillKeys.length,skillKeys:skillState.skillKeys,duplicates:skillState.duplicates,invalidSkillKeys:skillState.invalidSkillKeys,blockers:skillState.blockers},
    rockslideContext:{present:Boolean(rockslideContext),exitLocationKey:rockslideContext?.exitLocationKey||null,outboundPathKey:rockslideContext?.outboundPathKey||null,requiredEquipmentSlots:rockslideContext?.requiredEquipmentSlots||[],outboundPathMatches:contextState.outboundPathMatches,embeddedAccountQueryState:contextState.accountQueryState,identityComplete:contextState.identityComplete,mechanicsComplete:contextState.mechanicsComplete,blockers:contextState.blockers},
    activityUniverse:{scope:activityUniverse?.scope||null,declaredComplete:activityUniverse?.complete===true,activityCount:activityState.activities.length,skillsCovered:activityState.coverage.filter(row=>row?.complete===true).length,missingSkillCoverage:activityState.missingSkillCoverage,invalidIdentityCount:activityState.invalidIdentities.length,invalidPairabilityCount:activityState.invalidPairability.length,embeddedAccountQueryState:activityState.accountQueryState,identityComplete:activityState.identityComplete,blockers:activityState.blockers},
    transportationUniverse:{scope:transportationUniverse?.scope||null,declaredComplete:transportationUniverse?.complete===true,pathCount:transportState.paths.length,invalidIdentityCount:transportState.invalidIdentities.length,incompleteMechanicalPathCount:transportState.invalidMechanics.length,embeddedAccountQueryState:transportState.accountQueryState,identityComplete:transportState.identityComplete,mechanicsComplete:transportState.mechanicsComplete,blockers:transportState.blockers},
    pairingAssessments:{assessmentCount:pairingAssessments.length,activityCount:activityState.activities.length,missingActivityKeys:assessmentState.missingActivityAssessments,duplicateActivityKeys:assessmentState.duplicateActivityAssessments,unknownActivityKeys:assessmentState.unknownActivityAssessments,invalidActivityKeys:assessmentState.invalidAssessments,unassessedReturnPaths:assessmentState.unassessedReturnPaths,embeddedAccountQueryState:assessmentState.accountQueryState,complete:assessmentState.complete,blockers:assessmentState.blockers},
    namedGuideRegression,
    observedActivityCorpus:observedActivityCorpus||null,
    snapshotRejections,
    identityUniverseComplete,
    mechanicalCoverageComplete,
    internalMemberAuditSatisfied:identityUniverseComplete,
    absoluteBestGate:identityUniverseComplete&&mechanicalCoverageComplete?'eligible_for_pairing_golden_review':'blocked_incomplete_rockslide_pairing_universe',
    blockers
  };
}

export {FULL_ACTIVITY_SCOPE,FULL_TRANSPORT_SCOPE};
