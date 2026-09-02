const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new TypeError(`${name} must be finite`);return n};
const nonnegative=(name,value)=>Math.max(0,finite(name,value));
const probability=(name,value)=>Math.min(1,Math.max(0,finite(name,value)));

export const TICK_SECONDS=.6;

export function effectiveSessionSeconds({sessionSeconds=3600,setupSeconds=0}){
  return Math.max(0,nonnegative('sessionSeconds',sessionSeconds)-nonnegative('setupSeconds',setupSeconds));
}

export function fixedCycleModel({cycleTicks,xpPerCycle,sessionSeconds=3600,setupSeconds=0}){
  const available=effectiveSessionSeconds({sessionSeconds,setupSeconds});
  const secondsPerCycle=Math.max(TICK_SECONDS,finite('cycleTicks',cycleTicks)*TICK_SECONDS);
  const cycles=available/secondsPerCycle;
  return {attempts:cycles,successes:cycles,xp:cycles*nonnegative('xpPerCycle',xpPerCycle),availableSeconds:available,bottleneck:'player_cycle'};
}

export function successRollModel({rollTicks,successProbability,xpPerSuccess,sessionSeconds=3600,setupSeconds=0,failurePenaltySeconds=0}){
  const available=effectiveSessionSeconds({sessionSeconds,setupSeconds});
  const chance=probability('successProbability',successProbability);
  const secondsPerAttempt=Math.max(TICK_SECONDS,finite('rollTicks',rollTicks)*TICK_SECONDS)+(1-chance)*nonnegative('failurePenaltySeconds',failurePenaltySeconds);
  const attempts=available/secondsPerAttempt,successes=attempts*chance;
  return {attempts,successes,xp:successes*nonnegative('xpPerSuccess',xpPerSuccess),availableSeconds:available,bottleneck:'player_cycle'};
}

export function resourceCycleModel({rollTicks,successProbability,xpPerSuccess,spawnCount,respawnSeconds,competitionShare=1,sessionSeconds=3600,setupSeconds=0,inventoryCapacity=null,bankRoundTripSeconds=0}){
  const available=effectiveSessionSeconds({sessionSeconds,setupSeconds});
  const chance=probability('successProbability',successProbability),share=probability('competitionShare',competitionShare);
  const playerSuccessesPerSecond=chance/(Math.max(TICK_SECONDS,finite('rollTicks',rollTicks)*TICK_SECONDS));
  const supplySuccessesPerSecond=Math.max(1,Math.floor(finite('spawnCount',spawnCount)))/Math.max(TICK_SECONDS,finite('respawnSeconds',respawnSeconds))*share;
  const rawRate=Math.min(playerSuccessesPerSecond,supplySuccessesPerSecond);
  const bottleneck=playerSuccessesPerSecond<=supplySuccessesPerSecond?'player_cycle':'resource_supply';
  let productive=available,bankTrips=0;
  if(inventoryCapacity!==null){
    const capacity=Math.max(1,Math.floor(finite('inventoryCapacity',inventoryCapacity))),trip=nonnegative('bankRoundTripSeconds',bankRoundTripSeconds);
    if(rawRate>0&&trip>0){const productiveCycle=capacity/rawRate;bankTrips=available/(productiveCycle+trip);productive=Math.max(0,available-bankTrips*trip)}
  }
  const successes=productive*rawRate;
  return {attempts:chance?successes/chance:0,successes,xp:successes*nonnegative('xpPerSuccess',xpPerSuccess),bankTrips,availableSeconds:available,bottleneck};
}

export function lapModel({lapSeconds,xpPerLap,failureProbability=0,failurePenaltySeconds=0,sessionSeconds=3600,setupSeconds=0}){
  const available=effectiveSessionSeconds({sessionSeconds,setupSeconds}),fail=probability('failureProbability',failureProbability);
  const expectedSeconds=Math.max(TICK_SECONDS,finite('lapSeconds',lapSeconds))+fail*nonnegative('failurePenaltySeconds',failurePenaltySeconds);
  const attempts=available/expectedSeconds,successes=attempts*(1-fail);
  return {attempts,successes,xp:successes*nonnegative('xpPerLap',xpPerLap),availableSeconds:available,bottleneck:'course_cycle'};
}

export function hourly(result,{sessionSeconds=3600}={}){
  const scale=3600/Math.max(1,nonnegative('sessionSeconds',sessionSeconds));
  return {attemptsPerHour:result.attempts*scale,successesPerHour:result.successes*scale,xpPerHour:result.xp*scale,bankTripsPerHour:(result.bankTrips||0)*scale,bottleneck:result.bottleneck};
}

export function sensitivity(model,input,{successDelta=.05,cycleDelta=.05}={}){
  const lower=model({...input,successProbability:input.successProbability==null?input.successProbability:probability('lowerSuccess',input.successProbability-successDelta),rollTicks:input.rollTicks==null?input.rollTicks:input.rollTicks*(1+cycleDelta)});
  const upper=model({...input,successProbability:input.successProbability==null?input.successProbability:probability('upperSuccess',input.successProbability+successDelta),rollTicks:input.rollTicks==null?input.rollTicks:input.rollTicks*Math.max(.01,1-cycleDelta)});
  return {lower,upper};
}
