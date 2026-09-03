const finite=value=>Number.isFinite(Number(value));

export function compareCalculatedToObserved({calculatedXpPerHour,observedUpper,policy='absolute_tolerance',tolerance=.02}){
  if(!finite(calculatedXpPerHour)||!finite(observedUpper)||!finite(tolerance))return {differenceRatio:null,violatesTolerance:false};
  const calculated=Number(calculatedXpPerHour),observed=Number(observedUpper),numericTolerance=Number(tolerance),differenceRatio=Math.abs(calculated-observed)/Math.max(1,observed);
  const violatesTolerance=policy==='mechanical_upper_bound_vs_practical_observed'
    ? observed>calculated*(1+numericTolerance)
    : differenceRatio>numericTolerance;
  return {differenceRatio,violatesTolerance};
}
