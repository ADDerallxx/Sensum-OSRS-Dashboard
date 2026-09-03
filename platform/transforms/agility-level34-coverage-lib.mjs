const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));

export function vectorMatchesCandidate(candidate,vector){
  const name=normalize(vector?.name);
  if(candidate.vector_match_terms?.length)return candidate.vector_match_terms.every(term=>name.includes(normalize(term)));
  const expected=normalize(candidate.vector_name_prefix||candidate.name);
  return !!expected&&(name===expected||name.startsWith(`${expected} `));
}

function vectorCoverage(vector,target){
  const entry=vector?.conditions?.entryLevel,modeled=vector?.conditions?.modeledMinimumLevel,missing=vector?.validation?.missing||[];
  if(!finite(entry))return {status:'eligibility_unknown',blockers:['entry_level_unknown']};
  if(Number(entry)>target)return {status:'outside_target',blockers:['entry_level_above_target']};
  const uncovered=(vector?.conditions?.unmodeledLevelRanges||[]).filter(range=>finite(range?.minimum)&&finite(range?.maximum)&&Number(range.minimum)<=target&&Number(range.maximum)>=target);
  if(uncovered.length)return {status:'target_condition_gap',blockers:[...new Set(uncovered.map(range=>range.blocker||'target_level_condition_model_missing'))]};
  if(!finite(modeled)||Number(modeled)>target)return {status:'target_condition_gap',blockers:['target_level_model_missing']};
  if(missing.includes('failure_model_with_level_condition'))return {status:'target_condition_gap',blockers:[vector?.conditions?.failurePossible===true&&vector?.conditions?.failureProbabilityPublished===false?`failure_probability_at_base_level_${target}_not_published`:'failure_model_with_level_condition']};
  return {status:'condition_model_present',blockers:[]};
}

function mechanicalReadiness(vectors,target){
  const applicable=vectors.filter(vector=>finite(vector?.conditions?.entryLevel)&&Number(vector.conditions.entryLevel)<=target&&finite(vector?.conditions?.modeledMinimumLevel)&&Number(vector.conditions.modeledMinimumLevel)<=target);
  if(!applicable.length)return 'not_applicable_at_target';
  if(applicable.some(vector=>vector.state==='proposed'&&!(vector.validation?.missing||[]).length&&!(vector.validation?.contradictions||[]).length))return 'ready_for_golden_review';
  return 'mechanics_incomplete';
}

function mechanicalBlockers(vectors,candidate=null){
  const blockers=[];
  for(const vector of vectors){
    blockers.push(...(vector.validation?.missing||[]));
    blockers.push(...(vector.validation?.contradictions||[]).map(item=>item.rule||'mechanical_contradiction'));
    blockers.push(...(vector.validation?.sourceConflicts||[]).map(item=>item.rule||'source_conflict'));
  }
  const guideRate=finite(candidate?.observed_xp_per_hour_upper)?Number(candidate.observed_xp_per_hour_upper):null;
  if(guideRate!==null){
    const vectorRates=vectors.map(vector=>vector.observed?.xpPerHour?.upperReference).filter(finite).map(Number);
    if(vectorRates.length&&vectorRates.every(rate=>rate!==guideRate))blockers.push('observed_rate_claims_disagree');
  }
  return [...new Set(blockers)];
}

function guideDetail(candidate,vectors,target){
  const readiness=mechanicalReadiness(vectors,target),common={candidateKey:candidate.candidate_key,name:candidate.name,origin:'training_guide',recordKind:candidate.record_kind,minimumAgility:candidate.minimum_agility,sourceRevision:candidate.source_revision,sourceUrl:candidate.source_url,sourceLocator:candidate.source_locator,matchedVectorScenarioKeys:vectors.map(x=>x.scenarioKey),mechanicalReadiness:readiness};
  if(candidate.record_kind==='one_time_progression'&&candidate.aggregate_only)return {...common,status:'authoritative_exclusion',blockers:[],exclusionReason:'aggregate_one_time_progression_not_repeatable_training'};
  if(candidate.level_scope_ambiguous)return {...common,status:'eligibility_unknown',blockers:['guide_level_scope_ambiguous']};
  if(candidate.other_skill_requirement_unknown)return {...common,status:'eligibility_unknown',blockers:['other_skill_requirement_unknown']};
  if(!vectors.length)return {...common,status:'missing_model',blockers:['no_activity_vector']};
  const coverages=vectors.map(vector=>vectorCoverage(vector,target));
  if(coverages.some(x=>x.status==='condition_model_present')){
    const blockers=mechanicalBlockers(vectors,candidate);
    return blockers.length||readiness!=='ready_for_golden_review'?{...common,status:'mechanical_model_gap',blockers:blockers.length?blockers:['mechanical_model_incomplete']}:{...common,status:'condition_model_present',blockers:[]};
  }
  const blockers=[...new Set(coverages.flatMap(x=>x.blockers).filter(x=>x!=='entry_level_above_target'))];
  const rateScope=candidate.observed_xp_per_hour_level_scope;
  if(candidate.failure_possible===true&&blockers.includes('failure_model_with_level_condition')){
    blockers.splice(blockers.indexOf('failure_model_with_level_condition'),1,`failure_probability_at_base_level_${target}_not_published`);
  }
  if(finite(rateScope?.minimum)&&finite(rateScope?.maximum)&&(target<Number(rateScope.minimum)||target>Number(rateScope.maximum))){
    blockers.push(`observed_rate_scope_${Number(rateScope.minimum)}_to_${Number(rateScope.maximum)}_does_not_cover_base_level_${target}`);
  }
  return {...common,status:'target_condition_gap',blockers:[...new Set(blockers)],targetConditionEvidence:candidate.target_condition_evidence||null,observedRateLevelScope:rateScope||null};
}

function vectorGroupDetail(vectors,target){
  const first=vectors[0],coverages=vectors.map(vector=>vectorCoverage(vector,target)),applicable=vectors.filter((_,index)=>coverages[index].status==='condition_model_present'),readiness=mechanicalReadiness(vectors,target),mechanical=mechanicalBlockers(applicable.length?applicable:vectors),hasCondition=applicable.length>0,status=hasCondition?(mechanical.length||readiness!=='ready_for_golden_review'?'mechanical_model_gap':'condition_model_present'):(coverages.some(x=>x.status==='eligibility_unknown')?'eligibility_unknown':'target_condition_gap'),entryLevels=vectors.map(vector=>vector?.conditions?.entryLevel).filter(finite).map(Number),sourceRevisions=[...new Set(vectors.flatMap(vector=>[vector.sourceRevision,...(vector.supportingSourceRevisions||[])]).filter(Boolean))],sourceLocators=vectors.flatMap(vector=>vector.validation?.sourceLocators||[]),candidateGroupKey=first.candidateGroupKey||null;
  return {candidateKey:candidateGroupKey?`vector-group:${candidateGroupKey}`:`vector:${first.scenarioKey}`,candidateGroupKey,name:first.candidateDisplayName||first.name,origin:'course_family_vector',recordKind:'repeatable_method',minimumAgility:entryLevels.length?Math.min(...entryLevels):null,sourceRevision:sourceRevisions.length===1?sourceRevisions[0]:null,sourceRevisions,sourceUrl:sourceLocators[0]?.sourceUrl||null,sourceLocator:sourceLocators,matchedVectorScenarioKeys:vectors.map(vector=>vector.scenarioKey),mechanicalReadiness:readiness,status,blockers:status==='mechanical_model_gap'?(mechanical.length?mechanical:['mechanical_model_incomplete']):[...new Set(coverages.flatMap(x=>x.blockers).filter(x=>x!=='entry_level_above_target'))]};
}

export function auditAgilityLevelCoverage({guideCandidates,vectors,targetBaseAgility=34,guideSnapshot=null,vectorSnapshot=null,snapshotRejections=[]}){
  const target=Number(targetBaseAgility),guide=guideCandidates.filter(x=>finite(x.minimum_agility)&&Number(x.minimum_agility)<=target),matched=new Set(),details=[];
  for(const candidate of guide){const matches=vectors.filter(vector=>vectorMatchesCandidate(candidate,vector));for(const vector of matches)matched.add(vector.scenarioKey);details.push(guideDetail(candidate,matches,target))}
  const unmatchedGroups=new Map();
  for(const vector of vectors){if(matched.has(vector.scenarioKey))continue;const entry=vector?.conditions?.entryLevel;if(!((finite(entry)&&Number(entry)<=target)||!finite(entry)))continue;const key=vector.candidateGroupKey?`group:${vector.candidateGroupKey}`:`scenario:${vector.scenarioKey}`;if(!unmatchedGroups.has(key))unmatchedGroups.set(key,[]);unmatchedGroups.get(key).push(vector)}
  for(const group of unmatchedGroups.values())details.push(vectorGroupDetail(group,target));
  details.sort((a,b)=>a.name.localeCompare(b.name)||a.candidateKey.localeCompare(b.candidateKey));
  const statuses=['condition_model_present','mechanical_model_gap','target_condition_gap','missing_model','eligibility_unknown','authoritative_exclusion'],byStatus=Object.fromEntries(statuses.map(status=>[status,details.filter(x=>x.status===status).length])),blockingStatuses=['mechanical_model_gap','target_condition_gap','missing_model','eligibility_unknown'],blockers=details.filter(x=>blockingStatuses.includes(x.status)),phaseExitSatisfied=!blockers.length&&!snapshotRejections.length;
  return {contract:'sensum.agility-level34-coverage-audit.v1',targetBaseAgility:target,candidateUniverse:{total:details.length,trainingGuide:guide.length,vectorOnly:details.filter(x=>x.origin==='course_family_vector').length,oneTimeProgression:details.filter(x=>x.recordKind==='one_time_progression').length},byStatus,mechanicalReadiness:{readyForGoldenReview:details.filter(x=>x.mechanicalReadiness==='ready_for_golden_review').length,incomplete:details.filter(x=>x.mechanicalReadiness==='mechanics_incomplete').length,notApplicable:details.filter(x=>x.mechanicalReadiness==='not_applicable_at_target').length},blockingCandidates:blockers.length,phaseExitSatisfied,absoluteBestActivityGate:phaseExitSatisfied?'eligible_for_golden_review':'blocked_incomplete_level_34_coverage',guideSnapshot,vectorSnapshot,snapshotRejections,details};
}
