const finite=value=>Number.isFinite(Number(value));
const nonnegative=value=>finite(value)&&Number(value)>=0;
const orderedRange=value=>value&&nonnegative(value.minimum)&&nonnegative(value.maximum)&&Number(value.maximum)>=Number(value.minimum);

export function activityCalculationShape(calculation){
  if(!calculation)return 'invalid';
  if(calculation.calculationKind==='point_estimate'&&nonnegative(calculation.actionsPerHour)&&nonnegative(calculation.xpPerHour))return 'point_estimate';
  if(calculation.calculationKind==='bounded_cycle_range'&&orderedRange(calculation.actionsPerHourRange)&&orderedRange(calculation.xpPerHourRange))return 'bounded_cycle_range';
  return 'invalid';
}

export const hasScalarActivityRate=vector=>activityCalculationShape(vector?.calculation)==='point_estimate';
export const hasBoundedActivityRate=vector=>activityCalculationShape(vector?.calculation)==='bounded_cycle_range';
export const rankScalarActivityRates=rows=>[...rows].filter(hasScalarActivityRate).sort((a,b)=>b.calculation.xpPerHour-a.calculation.xpPerHour);
export const boundedActivityRates=rows=>[...rows].filter(hasBoundedActivityRate);
export const isOrderedActivityRange=orderedRange;
export function sourceRangeHasConstantReward(cycleSecondsRange,rewardRule){
  if(!orderedRange(cycleSecondsRange))return false;
  if(!rewardRule)return true;
  const fullRewardLimit=Number(rewardRule.full_reward_time_limit_seconds);
  return Number.isFinite(fullRewardLimit)&&Number(cycleSecondsRange.maximum)<fullRewardLimit;
}
