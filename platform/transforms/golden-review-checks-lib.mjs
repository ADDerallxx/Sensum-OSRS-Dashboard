import {activityCalculationShape,isOrderedActivityRange,sourceObservedActivityRateRange} from './activity-calculation-shape-lib.mjs';
import {finiteConditionLevel} from './activity-variant-condition-lib.mjs';

export function goldenReviewChecks(vector){
  const shape=activityCalculationShape(vector?.calculation),observed=sourceObservedActivityRateRange(vector),xp=vector?.mechanics?.xpPerAttempt??vector?.mechanics?.xpPerSuccess,failureComplete=vector?.mechanics?.randomFailureModelRequired===false||vector?.mechanics?.failureProbability!==null;
  const pointMechanics=shape==='point_estimate'&&(Number(vector?.mechanics?.cycleTicks)>0||Number(vector?.mechanics?.lapSeconds)>0)&&Number(xp)>0&&failureComplete;
  const boundedMechanics=shape==='bounded_cycle_range'&&isOrderedActivityRange(vector?.mechanics?.lapSecondsRange)&&Number(xp)>0&&vector?.mechanics?.randomFailureModelRequired===false;
  const observedEvidence=!!observed&&vector?.mechanics?.failureProbability===null;
  const rateValidation=observed
    ? vector?.validation?.comparisonPolicy==='source_observed_rate_range'&&vector?.validation?.rateValidation?.kind==='source_observed_rate_range'&&vector?.validation?.rateValidation?.independentObservedRate===true&&vector?.validation?.rateValidation?.preservesSourceBounds===true&&vector?.validation?.rateValidation?.sourceLevelScopePreserved===true&&vector?.validation?.rateValidation?.syntheticFailureProbability===false
    : shape==='point_estimate'
    ? vector?.validation?.differenceRatio!==null
    : shape==='bounded_cycle_range'&&vector?.validation?.comparisonPolicy==='source_timing_derived_rate_range'&&vector?.validation?.rateValidation?.kind==='source_timing_derived_range'&&vector?.validation?.rateValidation?.independentObservedRate===false&&vector?.validation?.rateValidation?.preservesSourceBounds===true;
  return {identity:!!(vector?.scenarioKey&&vector?.name&&vector?.sourceRevision),conditions:finiteConditionLevel(vector?.conditions?.entryLevel)!==null&&finiteConditionLevel(vector?.conditions?.modeledMinimumLevel)!==null,performanceEvidence:pointMechanics||boundedMechanics||observedEvidence,sourceLocators:(vector?.validation?.sourceLocators||[]).length>0,formulaOrExplicitObservation:observed?vector?.calculation===null:!!vector?.calculation?.formulaVersion,calculationOrObservationShape:observed?true:shape!=='invalid',unitAgreement:!(vector?.validation?.contradictions||[]).some(x=>x.rule==='cycle_units_disagree'),rateValidation,contradictions:(vector?.validation?.contradictions||[]).length===0,exactScope:!!vector?.scenarioKey};
}

export const eligibleForGoldenHumanApproval=vector=>Object.values(goldenReviewChecks(vector)).every(Boolean)&&!(vector?.validation?.missing||[]).length;
