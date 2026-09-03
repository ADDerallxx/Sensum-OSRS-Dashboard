const integer=value=>Number.isInteger(Number(value))?Number(value):null;
const unique=values=>[...new Set(values)];
const normalizeLevelSpecificBlocker=blocker=>String(blocker||'')
  .replace(/((?:at|cover|identify)_base_level_)\d+/g,'$1{level}')
  .replace(/(base_level_)\d+(_not_published)/g,'$1{level}$2');
const sorted=value=>[...value].sort((left,right)=>String(left).localeCompare(String(right)));
const embeddedQueryLevels=blocker=>[...String(blocker||'').matchAll(/(?:at|cover|identify)_base_level_(\d+)/g)].map(match=>Number(match[1]));
const queryStateKey=key=>/^(?:target_base_(?:agility|level)|targetBase(?:Agility|Level)|.*_at_target|success_probability_target_base_agility)$/i.test(key);

export function findEmbeddedAccountQueryEvidence(records=[]){
  const findings=[];
  const visit=(value,path,found)=>{
    if(Array.isArray(value)){value.forEach((item,index)=>visit(item,`${path}[${index}]`,found));return}
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      const childPath=path?`${path}.${key}`:key;
      if(queryStateKey(key))found.push({path:childPath,value:child});
      visit(child,childPath,found);
    }
  };
  for(const record of records){
    const fields=[];visit(record,'',fields);
    if(fields.length)findings.push({recordKey:record.candidate_key||record.recordKey||record.evidence_key||record.name||'unknown',fields});
  }
  return findings;
}

function validateDomain(skillDomain){
  const blockers=[],minimum=integer(skillDomain?.minimumBaseLevel),maximum=integer(skillDomain?.maximumBaseLevel);
  if(!skillDomain?.skillKey||!skillDomain?.skill)blockers.push('skill_identity_missing');
  if(minimum===null||maximum===null||minimum<1||maximum<minimum)blockers.push('invalid_base_level_domain');
  if(!skillDomain?.sourceRevision||!skillDomain?.sourceTimestamp||!skillDomain?.sourceUrl||!skillDomain?.sourceLocator?.evidence?.length)blockers.push('revision_pinned_level_domain_evidence_missing');
  if(skillDomain?.baseAndEffectiveLevelsSeparate!==true||skillDomain?.temporaryBoostsAffectEffectiveLevel!==true)blockers.push('base_effective_level_policy_missing');
  return {minimum,maximum,blockers};
}

function summarizeLevel(baseLevel,evaluation){
  const details=Array.isArray(evaluation?.details)?evaluation.details:[];
  const blockingDetails=details.filter(detail=>['mechanical_model_gap','target_condition_gap','missing_model','eligibility_unknown'].includes(detail.status));
  const blockerCodes=unique(blockingDetails.flatMap(detail=>detail.blockers||[])).sort();
  const foreignQueryLevelBlockers=unique(blockerCodes.filter(blocker=>embeddedQueryLevels(blocker).some(level=>level!==baseLevel))).sort();
  const structure=details.map(detail=>({
    candidateKey:detail.candidateKey,
    status:detail.status,
    mechanicalReadiness:detail.mechanicalReadiness||null,
    blockerTemplates:sorted((detail.blockers||[]).map(normalizeLevelSpecificBlocker))
  })).sort((left,right)=>String(left.candidateKey).localeCompare(String(right.candidateKey)));
  return {
    baseLevel,
    modelCoverageStatus:evaluation?.phaseExitSatisfied===true?'target_model_complete':'target_model_blocked',
    candidateUniverse:evaluation?.candidateUniverse||null,
    byStatus:evaluation?.byStatus||null,
    mechanicalReadiness:evaluation?.mechanicalReadiness||null,
    blockingCandidates:Number(evaluation?.blockingCandidates||0),
    blockingCandidateKeys:sorted(blockingDetails.map(detail=>detail.candidateKey)),
    blockerCodes,
    foreignQueryLevelBlockers,
    structuralSignature:JSON.stringify(structure)
  };
}

function compressLevels(levels){
  const spans=[];
  for(const level of levels){
    const prior=spans.at(-1);
    if(prior&&prior.structuralSignature===level.structuralSignature&&prior.modelCoverageStatus===level.modelCoverageStatus){prior.maximumBaseLevel=level.baseLevel;continue}
    spans.push({minimumBaseLevel:level.baseLevel,maximumBaseLevel:level.baseLevel,modelCoverageStatus:level.modelCoverageStatus,structuralSignature:level.structuralSignature,blockingCandidateKeys:level.blockingCandidateKeys,blockerTemplates:sorted(level.blockerCodes.map(normalizeLevelSpecificBlocker))});
  }
  return spans;
}

function changes(previous,current){
  if(!previous)return ['skill_domain_start'];
  const before=new Set(previous.blockingCandidateKeys),after=new Set(current.blockingCandidateKeys),reasons=[];
  const added=[...after].filter(key=>!before.has(key)),removed=[...before].filter(key=>!after.has(key));
  if(added.length)reasons.push(`blocking_candidates_added:${added.join(',')}`);
  if(removed.length)reasons.push(`blocking_candidates_removed:${removed.join(',')}`);
  if(previous.modelCoverageStatus!==current.modelCoverageStatus)reasons.push(`model_coverage_changed:${previous.modelCoverageStatus}_to_${current.modelCoverageStatus}`);
  if(!reasons.length)reasons.push('candidate_condition_or_blocker_scope_changed');
  return reasons;
}

export function auditSkillProgressionCoverage({skillDomain,methodUniverse,evaluateBaseLevel,reusableEvidenceRecords=[],performanceBreakpointCoverage={complete:false,blockers:['performance_and_ranking_breakpoints_not_audited']},snapshotRejections=[]}){
  const domain=validateDomain(skillDomain);
  if(domain.blockers.length)return {contract:'sensum.skill-progression-coverage-audit.v1',skill:skillDomain?.skill||null,domainEvidenceValid:false,blockers:domain.blockers,fullSkillCoverageSatisfied:false};
  if(typeof evaluateBaseLevel!=='function')throw new TypeError('evaluateBaseLevel must be a function.');
  const levels=[];
  for(let baseLevel=domain.minimum;baseLevel<=domain.maximum;baseLevel++)levels.push(summarizeLevel(baseLevel,evaluateBaseLevel(baseLevel)));
  const spans=compressLevels(levels),structuralBreakpoints=spans.map((span,index)=>({baseLevel:span.minimumBaseLevel,reasons:changes(index?spans[index-1]:null,span)}));
  const universeBlockers=unique(methodUniverse?.blockers||[]),universeComplete=methodUniverse?.complete===true&&universeBlockers.length===0;
  const performanceBlockers=unique(performanceBreakpointCoverage?.blockers||[]),performanceComplete=performanceBreakpointCoverage?.complete===true&&performanceBlockers.length===0;
  const blockedLevels=levels.filter(level=>level.modelCoverageStatus!=='target_model_complete');
  const embeddedQueryLevelDefects=levels.filter(level=>level.foreignQueryLevelBlockers.length).map(level=>({baseLevel:level.baseLevel,blockers:level.foreignQueryLevelBlockers}));
  const embeddedAccountQueryEvidence=findEmbeddedAccountQueryEvidence(reusableEvidenceRecords);
  const fullSkillCoverageSatisfied=universeComplete&&performanceComplete&&!blockedLevels.length&&!embeddedQueryLevelDefects.length&&!embeddedAccountQueryEvidence.length&&!snapshotRejections.length;
  return {
    contract:'sensum.skill-progression-coverage-audit.v1',
    skill:skillDomain.skill,
    skillKey:skillDomain.skillKey,
    accountIndependent:true,
    levelDomain:{minimumBaseLevel:domain.minimum,maximumBaseLevel:domain.maximum,totalIntegerLevels:levels.length,sourceRevision:skillDomain.sourceRevision,sourceTimestamp:skillDomain.sourceTimestamp,sourceUrl:skillDomain.sourceUrl,sourceLocator:skillDomain.sourceLocator},
    levelSemantics:{baseAndEffectiveLevelsSeparate:true,temporaryBoostsDoNotChangeBaseLevel:true,currentAccountLevelIsQueryOnly:true},
    methodUniverse:{...(methodUniverse||{}),complete:universeComplete,blockers:universeBlockers},
    performanceBreakpointCoverage:{...performanceBreakpointCoverage,complete:performanceComplete,blockers:performanceBlockers},
    levelCoverage:{evaluated:levels.length,modelComplete:levels.length-blockedLevels.length,modelBlocked:blockedLevels.length,blockedBaseLevels:blockedLevels.map(level=>level.baseLevel)},
    structuralBreakpoints,
    structuralSpans:spans.map(({structuralSignature,...span})=>span),
    levels:levels.map(({structuralSignature,...level})=>level),
    embeddedQueryLevelDefects,
    embeddedAccountQueryEvidence,
    snapshotRejections,
    fullSkillCoverageSatisfied,
    authoritativeClaimGate:fullSkillCoverageSatisfied?'eligible_for_skill_wide_golden_review':'blocked_incomplete_full_skill_coverage',
    blockers:unique([...universeBlockers,...performanceBlockers,...(blockedLevels.length?['one_or_more_base_levels_have_incomplete_target_models']:[]),...(embeddedQueryLevelDefects.length?['account_query_level_baked_into_reusable_evidence']:[]),...(embeddedAccountQueryEvidence.length?['account_query_state_baked_into_reusable_evidence']:[]),...(snapshotRejections.length?['one_or_more_input_snapshots_rejected']:[])])
  };
}
