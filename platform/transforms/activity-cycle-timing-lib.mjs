export function resolveCycleTiming({variant=null,tableRow=null,tickFact=null,secondsFact=null,tickSeconds=.6}={}){
  const cycleTicks=variant?.cycle_ticks??tableRow?.cycle_ticks?.minimum??tickFact?.value?.ticks??null;
  const lapSeconds=variant?.cycle_seconds??secondsFact?.value?.seconds??(cycleTicks!==null?Number(cycleTicks)*Number(tickSeconds):null);
  const range=variant?.cycle_seconds_range,lapSecondsRange=range&&Number.isFinite(Number(range.minimum))&&Number.isFinite(Number(range.maximum))&&Number(range.minimum)>0&&Number(range.maximum)>=Number(range.minimum)?{minimum:Number(range.minimum),maximum:Number(range.maximum)}:null;
  const peak=variant?.cycle_seconds_observed_peak,lapSecondsObservedPeak=Number.isFinite(Number(peak))&&Number(peak)>0?Number(peak):null;
  return {cycleTicks,lapSeconds,lapSecondsRange,lapSecondsObservedPeak};
}
