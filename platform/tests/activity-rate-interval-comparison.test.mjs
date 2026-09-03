import {ACTIVITY_RATE_INTERVAL_POLICY,activityRateBounds,compareActivityRateBounds,compareActivityRateCandidates} from '../transforms/activity-rate-interval-comparison-lib.mjs';
import {rankScalarActivityRates} from '../transforms/activity-calculation-shape-lib.mjs';

const bounded=(scenarioKey,minimum,maximum)=>({scenarioKey,sourceRevision:'15315300',contentHash:`hash:${scenarioKey}`,calculation:{calculationKind:'bounded_cycle_range',actionsPerHourRange:{minimum:1,maximum:2},xpPerHourRange:{minimum,maximum}}});
const point=(scenarioKey,rate)=>({scenarioKey,calculation:{calculationKind:'point_estimate',actionsPerHour:1,xpPerHour:rate}});
const observed=(scenarioKey,minimum,maximum)=>({scenarioKey,calculation:null,conditions:{observationalBenchmarkOnly:true,outcomeIntegratedInObservedRate:true},observed:{xpPerHour:{candidateRanges:[{minimum,maximum,levelScope:{minimum:30,maximum:40},sourceRevision:'15324367',sourceLocator:{line:1}}]}}});
const run=bounded('skullball:run',750*3600/165,750*3600/140),walk=bounded('skullball:walk',750*3600/195,750*3600/165),scramble=bounded('skullball:scramble',750*3600/229,750*3600/180),peakOnly={scenarioKey:'skullball:optimal-peak',mechanics:{lapSecondsObservedPeak:105},calculation:null};
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};

check(ACTIVITY_RATE_INTERVAL_POLICY==='strict_non_overlapping_source_bounds_v1','The comparison policy must be versioned and explicit.');
check(activityRateBounds(run)?.minimum===750*3600/165&&activityRateBounds(run)?.maximum===750*3600/140,'Published timing bounds must survive without midpoint conversion.');
check(activityRateBounds(run)?.sourceRevision==='15315300'&&activityRateBounds(run)?.vectorContentHash==='hash:skullball:run','Every compared bound must retain its source revision and exact vector hash.');
check(compareActivityRateBounds(run,scramble).outcome==='left_strictly_dominates','The run route must strictly dominate the fully lower scramble range.');
check(compareActivityRateBounds(run,walk).outcome==='overlap_or_touch','A shared boundary must remain incomparable rather than becoming strict dominance.');
check(compareActivityRateBounds(walk,scramble).outcome==='overlap_or_touch','Overlapping route ranges must remain incomparable.');
check(compareActivityRateCandidates([run,scramble]).strictDominanceWinner===run,'A non-overlapping range may win only through strict bound dominance.');
const allRoutes=compareActivityRateCandidates([run,walk,scramble]);
check(allRoutes.strictDominanceWinner===null&&!allRoutes.comparisonComplete&&allRoutes.unresolvedComparisons.length===2,'Overlapping Skullball ranges must prevent a complete winner.');
check(compareActivityRateCandidates([run,peakOnly]).invalidCandidateKeys.includes('skullball:optimal-peak'),'Peak-only evidence must be excluded until a typical bound is published.');
check(rankScalarActivityRates([run,walk,scramble,point('point',10000)]).map(x=>x.scenarioKey).join(',')==='point','Interval candidates must remain outside scalar ranking after the comparison policy is added.');
check(compareActivityRateBounds(point('cheap',10),bounded('cost-range',20,30),{objective:'minimize'}).outcome==='left_strictly_dominates','The generic policy must honor minimization objectives without reversing the bounds.');
check(activityRateBounds(observed('varrock',11000,14000))?.kind==='source_observed_rate_range','Direct observed ranges must retain a distinct evidence kind.');
check(compareActivityRateBounds(observed('varrock',11000,14000),bounded('skullball',16000,19000)).outcome==='right_strictly_dominates','Source-observed and mechanically derived ranges may compare only through complete non-overlapping bounds.');
check(compareActivityRateBounds(observed('overlap',14000,17000),bounded('skullball-overlap',16000,19000)).outcome==='overlap_or_touch','Overlapping observed and derived bounds must remain incomparable.');

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Activity interval-comparison safety checks passed.');
