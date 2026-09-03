const finite=value=>Number.isFinite(Number(value));
const clamp=value=>Math.min(Math.max(value,0),1);

export function skillingSuccessInterpolation({low,high,level}){
  if(!finite(low)||!finite(high)||!finite(level))throw new Error('low, high, and level are required numeric inputs.');
  const numericLevel=Number(level),value=Math.floor(Number(low)*(99-numericLevel)/98+Number(high)*(numericLevel-1)/98+0.5)+1;
  return clamp(value/256);
}

export function evaluateSkillingSuccessAtBaseLevel(model,baseLevel){
  const level=Number(baseLevel),entry=Number(model?.entryLevel),failureFree=Number(model?.failureFreeLevel);
  if(!Number.isInteger(level)||level<1||level>99)throw new Error('baseLevel must be an integer from 1 through 99.');
  if(!Number.isInteger(entry)||!Number.isInteger(failureFree)||entry<1||failureFree<=entry)throw new Error('The success model requires valid entry and failure-free levels.');
  if(level<entry)return {status:'outside_entry_scope',baseLevel:level,successProbability:null,failureProbability:null,blocker:'target_below_method_entry_level'};
  if(level>=failureFree)return {status:'source_failure_free_threshold',baseLevel:level,successProbability:1,failureProbability:0,blocker:null};
  if(model?.formulaKind!=='wiki_skilling_success_interpolation'||model?.parameterStatus!=='ready'||!finite(model?.parameters?.low)||!finite(model?.parameters?.high))return {status:'blocked_incomplete_probability_model',baseLevel:level,successProbability:null,failureProbability:null,blocker:model?.blocker||'success_probability_model_incomplete'};
  const successProbability=skillingSuccessInterpolation({low:model.parameters.low,high:model.parameters.high,level});
  return {status:'revision_pinned_formula',baseLevel:level,successProbability,failureProbability:1-successProbability,blocker:null};
}

export function cascadeSuccessProbabilities(bounds,level){
  if(!Array.isArray(bounds)||!bounds.length)throw new Error('Ordered cascade bounds are required.');
  let remaining=1;
  const outcomes=[];
  for(const bound of bounds){
    if(!finite(bound?.requiredLevel)||!finite(bound?.low)||!finite(bound?.high)||!bound?.key)throw new Error('Every cascade bound requires key, requiredLevel, low, and high.');
    if(Number(level)<Number(bound.requiredLevel)){outcomes.push({key:bound.key,probability:0});continue}
    const conditional=skillingSuccessInterpolation({low:bound.low,high:bound.high,level}),probability=remaining*conditional;
    outcomes.push({key:bound.key,probability,conditionalProbability:conditional});
    remaining*=1-conditional;
  }
  return {outcomes,noOutcomeProbability:remaining,totalProbability:outcomes.reduce((sum,row)=>sum+row.probability,0)+remaining};
}

export function expectedXpPerAttempt({bounds,level,xpByKey}){
  const distribution=cascadeSuccessProbabilities(bounds,level),expectedXp=distribution.outcomes.reduce((sum,row)=>sum+row.probability*Number(xpByKey?.[row.key]||0),0);
  return {...distribution,expectedXp};
}
