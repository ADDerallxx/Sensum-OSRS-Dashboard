import {activityCalculationShape,isOrderedActivityRange,sourceObservedActivityRateRange} from './activity-calculation-shape-lib.mjs';

export const ACTIVITY_RATE_INTERVAL_POLICY='strict_non_overlapping_source_bounds_v1';

const keyOf=vector=>vector?.scenarioKey??vector?.recordKey??vector?.name??null;

export function activityRateBounds(vector){
  const shape=activityCalculationShape(vector?.calculation);
  if(shape==='point_estimate'){
    const rate=Number(vector.calculation.xpPerHour);
    return {candidateKey:keyOf(vector),kind:'point_estimate',minimum:rate,maximum:rate,sourceRevision:vector?.sourceRevision??null,vectorContentHash:vector?.contentHash??null};
  }
  if(shape==='bounded_cycle_range'&&isOrderedActivityRange(vector.calculation.xpPerHourRange)){
    return {candidateKey:keyOf(vector),kind:'bounded_cycle_range',minimum:Number(vector.calculation.xpPerHourRange.minimum),maximum:Number(vector.calculation.xpPerHourRange.maximum),sourceRevision:vector?.sourceRevision??null,vectorContentHash:vector?.contentHash??null};
  }
  const observed=sourceObservedActivityRateRange(vector);
  if(observed)return {candidateKey:keyOf(vector),kind:'source_observed_rate_range',minimum:observed.minimum,maximum:observed.maximum,sourceRevision:observed.sourceRevision,vectorContentHash:vector?.contentHash??null,levelScope:observed.levelScope,observationKind:observed.observationKind,approximate:observed.approximate};
  return null;
}

export function compareActivityRateBounds(leftVector,rightVector,{objective='maximize'}={}){
  const left=activityRateBounds(leftVector),right=activityRateBounds(rightVector);
  const base={policy:ACTIVITY_RATE_INTERVAL_POLICY,objective,left,right};
  if(!left||!right)return {...base,outcome:'invalid_or_missing_bounds',dominantCandidateKey:null};
  if(objective==='maximize'){
    if(left.minimum>right.maximum)return {...base,outcome:'left_strictly_dominates',dominantCandidateKey:left.candidateKey};
    if(right.minimum>left.maximum)return {...base,outcome:'right_strictly_dominates',dominantCandidateKey:right.candidateKey};
  }else if(objective==='minimize'){
    if(left.maximum<right.minimum)return {...base,outcome:'left_strictly_dominates',dominantCandidateKey:left.candidateKey};
    if(right.maximum<left.minimum)return {...base,outcome:'right_strictly_dominates',dominantCandidateKey:right.candidateKey};
  }else return {...base,outcome:'unsupported_objective',dominantCandidateKey:null};
  return {...base,outcome:'overlap_or_touch',dominantCandidateKey:null};
}

export function compareActivityRateCandidates(vectors,{objective='maximize'}={}){
  const candidates=vectors.map(vector=>({vector,bounds:activityRateBounds(vector)})),invalidCandidateKeys=candidates.filter(x=>!x.bounds).map(x=>keyOf(x.vector)),valid=candidates.filter(x=>x.bounds),comparisons=[];
  for(let left=0;left<valid.length;left++)for(let right=left+1;right<valid.length;right++)comparisons.push(compareActivityRateBounds(valid[left].vector,valid[right].vector,{objective}));
  const dominatesEveryOther=entry=>valid.every(other=>other===entry||compareActivityRateBounds(entry.vector,other.vector,{objective}).dominantCandidateKey===entry.bounds.candidateKey),dominators=valid.filter(dominatesEveryOther);
  const strictDominanceWinner=dominators.length===1?dominators[0].vector:null,unresolvedComparisons=comparisons.filter(x=>x.outcome==='overlap_or_touch'||x.outcome==='invalid_or_missing_bounds'||x.outcome==='unsupported_objective');
  return {
    policy:ACTIVITY_RATE_INTERVAL_POLICY,
    objective,
    semantics:'A winner must be strictly better across the complete published bounds. Overlapping or touching bounds remain incomparable.',
    candidates:valid.map(x=>x.bounds),
    invalidCandidateKeys,
    comparisons,
    unresolvedComparisons,
    strictDominanceWinner,
    strictDominanceWinnerKey:keyOf(strictDominanceWinner),
    comparisonComplete:invalidCandidateKeys.length===0&&(valid.length<=1||strictDominanceWinner!==null)
  };
}
