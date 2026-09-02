import {parseTickRange} from '../ingestion/activity-evidence-lib.mjs';
import {hourly,lapModel} from '../formulas/activity-v1.mjs';

const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message)};
check(JSON.stringify(parseTickRange('97t (58.2s)'))===JSON.stringify({minimum:97,maximum:97}),'Seconds in parentheses must not be parsed as ticks.');
check(JSON.stringify(parseTickRange('108–110t (64.8–66s)'))===JSON.stringify({minimum:108,maximum:110}),'Tick ranges must retain both tick boundaries.');
for(const scenario of [
  {name:'Falador',ticks:97,xp:586,observed:35000},
  {name:'Seers',ticks:73,xp:570,observed:46800},
  {name:'Ardougne',ticks:76,xp:889,observed:70000}
]){const calculated=hourly(lapModel({lapSeconds:scenario.ticks*.6,xpPerLap:scenario.xp,failureProbability:0})).xpPerHour,difference=Math.abs(calculated-scenario.observed)/scenario.observed;check(difference<=.04,`${scenario.name} structured course rate is implausibly far from the Wiki peak.`)}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({contract:'sensum.agility-course-table-regression.v1',passed:true},null,2));
