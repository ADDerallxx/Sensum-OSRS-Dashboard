import {resolveCycleTiming} from '../transforms/activity-cycle-timing-lib.mjs';

const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const secondsOnly=resolveCycleTiming({secondsFact:{value:{seconds:34,timing_kind:'minimum'}}});
const ticksOnly=resolveCycleTiming({tickFact:{value:{ticks:63}}});
const explicit=resolveCycleTiming({variant:{cycle_ticks:3,cycle_seconds:1.8}});
check(secondsOnly.lapSeconds===34&&secondsOnly.cycleTicks===null,'Second-based evidence must not synthesize fractional game ticks.');
check(ticksOnly.cycleTicks===63&&ticksOnly.lapSeconds===37.8,'Exact tick evidence must convert to seconds for the lap formula.');
check(explicit.cycleTicks===3&&explicit.lapSeconds===1.8,'Explicit variant timing must retain both source units.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Activity cycle-timing resolution checks passed.');
