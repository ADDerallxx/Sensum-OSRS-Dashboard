export function resolveCycleTiming({variant=null,tableRow=null,tickFact=null,secondsFact=null,tickSeconds=.6}={}){
  const cycleTicks=variant?.cycle_ticks??tableRow?.cycle_ticks?.minimum??tickFact?.value?.ticks??null;
  const lapSeconds=variant?.cycle_seconds??secondsFact?.value?.seconds??(cycleTicks!==null?Number(cycleTicks)*Number(tickSeconds):null);
  return {cycleTicks,lapSeconds};
}
