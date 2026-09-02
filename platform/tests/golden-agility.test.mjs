import {hourly,lapModel} from '../formulas/activity-v1.mjs';

const source={
  name:'Ape Atoll Agility Course',
  revision:'15322097',
  url:'https://oldschool.runescape.wiki/w/Ape_Atoll_Agility_Course',
  conditions:{minimumAgility:75,failureProbability:0},
  mechanics:{cycleTicks:63,xpPerLap:580},
  observedRateClaims:{introUpwards:55200,detailedMaximum:55100},
  sourceConflict:'The same pinned revision states 55,200 in the introduction and 55,100 in the detailed rate section.',
  state:'blocked'
};
const result=hourly(lapModel({lapSeconds:source.mechanics.cycleTicks*.6,xpPerLap:source.mechanics.xpPerLap,failureProbability:source.conditions.failureProbability}));
const differences=Object.fromEntries(Object.entries(source.observedRateClaims).map(([key,value])=>[key,Math.abs(result.xpPerHour-value)/value]));
const failures=[];
if(Math.abs(result.successesPerHour-3600/(63*.6))>1e-9)failures.push('Lap rate calculation changed.');
if(Math.abs(result.xpPerHour-55238.09523809524)>1e-9)failures.push('XP rate calculation changed.');
if(Object.values(differences).some(value=>value>.02))failures.push('Calculated rate no longer agrees with both revision-pinned observations within 2%.');
if(source.state!=='blocked'||!source.sourceConflict)failures.push('Contradictory source observations must remain blocked until manually resolved.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({contract:'sensum.golden-agility-regression.v1',passed:true,source,result,differenceRatios:differences,approvalGate:'blocked_source_conflict'},null,2));
