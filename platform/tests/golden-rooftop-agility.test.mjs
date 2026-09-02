import {hourly,lapModel} from '../formulas/activity-v1.mjs';

const scenarios=[
  {name:'Draynor Village Rooftop Course',revision:'15239943',minimumAgility:1,cycleSeconds:43.2,xpPerLap:120,observedPeak:10000},
  {name:'Canifis Rooftop Course',revision:'15322677',minimumAgility:64,cycleSeconds:43.8,xpPerLap:240,observedPeak:19700}
];
const results=[],failures=[];
for(const source of scenarios){const result=hourly(lapModel({lapSeconds:source.cycleSeconds,xpPerLap:source.xpPerLap,failureProbability:0})),differenceRatio=Math.abs(result.xpPerHour-source.observedPeak)/source.observedPeak;results.push({source,result,differenceRatio,state:'proposed'});if(differenceRatio>.02)failures.push(`${source.name} exceeds the 2% observed-rate tolerance.`)}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({contract:'sensum.golden-rooftop-agility-regression.v1',passed:true,results,approvalGate:'blocked'},null,2));
