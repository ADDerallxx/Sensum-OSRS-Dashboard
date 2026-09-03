import {activityCalculationShape,boundedActivityRates,rankScalarActivityRates,sourceRangeHasConstantReward} from '../transforms/activity-calculation-shape-lib.mjs';

const point={name:'point',calculation:{calculationKind:'point_estimate',actionsPerHour:20,xpPerHour:15000}};
const bounded={name:'bounded',calculation:{calculationKind:'bounded_cycle_range',actionsPerHourRange:{minimum:20,maximum:25},xpPerHourRange:{minimum:15000,maximum:18750}}};
const reversed={name:'reversed',calculation:{calculationKind:'bounded_cycle_range',actionsPerHourRange:{minimum:25,maximum:20},xpPerHourRange:{minimum:18750,maximum:15000}}};
const failures=[];
if(activityCalculationShape(point.calculation)!=='point_estimate')failures.push('A valid scalar calculation must retain point-estimate identity.');
if(activityCalculationShape(bounded.calculation)!=='bounded_cycle_range')failures.push('A valid bounded calculation must retain interval identity.');
if(activityCalculationShape(reversed.calculation)!=='invalid')failures.push('Reversed intervals must fail closed.');
if(rankScalarActivityRates([bounded,point])[0]!==point||rankScalarActivityRates([bounded,point]).length!==1)failures.push('Interval-only rates must never enter scalar ranking.');
if(boundedActivityRates([point,bounded])[0]!==bounded)failures.push('Bounded rates must remain explicitly discoverable as ranking blockers.');
if(!sourceRangeHasConstantReward({minimum:180,maximum:229},{full_reward_time_limit_seconds:240}))failures.push('A range wholly below the full-reward limit must support a constant-reward calculation.');
if(sourceRangeHasConstantReward({minimum:180,maximum:240},{full_reward_time_limit_seconds:240}))failures.push('A range reaching an exclusive full-reward boundary must require time-dependent reward modeling.');
if(sourceRangeHasConstantReward({minimum:240,maximum:180},null))failures.push('An invalid source range must fail closed even without a variable reward rule.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Activity calculation-shape safety checks passed.');
