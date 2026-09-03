import {compareCalculatedToObserved} from '../transforms/activity-rate-comparison-lib.mjs';

const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const practicalBelow=compareCalculatedToObserved({calculatedXpPerHour:4296.875,observedUpper:4100,policy:'mechanical_upper_bound_vs_practical_observed'});
const impossiblePractical=compareCalculatedToObserved({calculatedXpPerHour:4100,observedUpper:4296.875,policy:'mechanical_upper_bound_vs_practical_observed'});
const absoluteDifference=compareCalculatedToObserved({calculatedXpPerHour:4296.875,observedUpper:4100,policy:'absolute_tolerance'});
check(practicalBelow.differenceRatio>.02&&!practicalBelow.violatesTolerance,'A practical observed rate may be lower than its mechanical upper bound.');
check(impossiblePractical.violatesTolerance,'A practical observed rate materially above its mechanical upper bound must block.');
check(absoluteDifference.violatesTolerance,'Ordinary observed/mechanical comparisons must remain symmetric.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Activity-rate comparison policy checks passed.');
