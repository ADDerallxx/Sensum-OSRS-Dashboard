const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const nonnegative=value=>finite(value)&&Number(value)>=0;
const orderedRange=value=>value&&nonnegative(value.minimum)&&nonnegative(value.maximum)&&Number(value.maximum)>=Number(value.minimum);
const orderedLevelRange=value=>value&&finite(value.minimum)&&finite(value.maximum)&&Number(value.maximum)>=Number(value.minimum);

export function activityCalculationShape(calculation){
  if(!calculation)return 'invalid';
  if(calculation.calculationKind==='point_estimate'&&nonnegative(calculation.actionsPerHour)&&nonnegative(calculation.xpPerHour))return 'point_estimate';
  if(calculation.calculationKind==='bounded_cycle_range'&&orderedRange(calculation.actionsPerHourRange)&&orderedRange(calculation.xpPerHourRange))return 'bounded_cycle_range';
  return 'invalid';
}

export const hasScalarActivityRate=vector=>activityCalculationShape(vector?.calculation)==='point_estimate';
export const hasBoundedActivityRate=vector=>activityCalculationShape(vector?.calculation)==='bounded_cycle_range';
export function sourceObservedActivityRateRange(vector){
  if(vector?.conditions?.observationalBenchmarkOnly!==true||vector?.conditions?.outcomeIntegratedInObservedRate!==true||vector?.calculation!==null)return null;
  const ranges=vector?.observed?.xpPerHour?.candidateRanges;
  if(!Array.isArray(ranges)||ranges.length!==1)return null;
  const range=ranges[0];
  if(!orderedRange(range)||!orderedLevelRange(range.levelScope)||!range.sourceRevision||!range.sourceLocator)return null;
  return {minimum:Number(range.minimum),maximum:Number(range.maximum),sourceRevision:String(range.sourceRevision),sourceUrl:range.sourceUrl??null,sourceLocator:range.sourceLocator,levelScope:{minimum:Number(range.levelScope.minimum),maximum:Number(range.levelScope.maximum)},conditionScope:range.conditionScope??null,observationKind:range.observationKind??null,approximate:range.approximate===true};
}
export const hasSourceObservedActivityRate=vector=>sourceObservedActivityRateRange(vector)!==null;
export const hasIntervalActivityRate=vector=>hasBoundedActivityRate(vector)||hasSourceObservedActivityRate(vector);
export const rankScalarActivityRates=rows=>[...rows].filter(hasScalarActivityRate).sort((a,b)=>b.calculation.xpPerHour-a.calculation.xpPerHour);
export const boundedActivityRates=rows=>[...rows].filter(hasBoundedActivityRate);
export const intervalActivityRates=rows=>[...rows].filter(hasIntervalActivityRate);
export const isOrderedActivityRange=orderedRange;
export function sourceRangeHasConstantReward(cycleSecondsRange,rewardRule){
  if(!orderedRange(cycleSecondsRange))return false;
  if(!rewardRule)return true;
  const fullRewardLimit=Number(rewardRule.full_reward_time_limit_seconds);
  return Number.isFinite(fullRewardLimit)&&Number(cycleSecondsRange.maximum)<fullRewardLimit;
}
