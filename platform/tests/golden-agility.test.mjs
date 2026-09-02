import {hourly,lapModel} from '../formulas/activity-v1.mjs';

const source={
  name:'Ape Atoll Agility Course',
  revision:'15322097',
  url:'https://oldschool.runescape.wiki/w/Ape_Atoll_Agility_Course',
  conditions:{minimumAgility:75,failureProbability:0},
  mechanics:{cycleTicks:63,xpPerLap:580},
  observedPeakXpPerHour:55200,
  state:'proposed'
};
const result=hourly(lapModel({lapSeconds:source.mechanics.cycleTicks*.6,xpPerLap:source.mechanics.xpPerLap,failureProbability:source.conditions.failureProbability}));
const difference=Math.abs(result.xpPerHour-source.observedPeakXpPerHour)/source.observedPeakXpPerHour;
const failures=[];
if(Math.abs(result.successesPerHour-3600/(63*.6))>1e-9)failures.push('Lap rate calculation changed.');
if(Math.abs(result.xpPerHour-55238.09523809524)>1e-9)failures.push('XP rate calculation changed.');
if(difference>.02)failures.push('Calculated rate no longer agrees with the revision-pinned observed peak within 2%.');
if(source.state!=='proposed')failures.push('Golden scenario must remain proposed until manually approved.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({contract:'sensum.golden-agility-regression.v1',passed:true,source,result,differenceRatio:difference,approvalGate:'blocked'},null,2));
