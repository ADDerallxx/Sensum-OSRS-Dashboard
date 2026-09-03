import {cascadeSuccessProbabilities,evaluateSkillingSuccessAtBaseLevel,expectedXpPerAttempt,skillingSuccessInterpolation} from '../formulas/skilling-success-v1.mjs';
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},close=(a,b)=>Math.abs(a-b)<1e-12;
check(close(skillingSuccessInterpolation({low:32,high:192,level:48}),110/256),'Interpolation must preserve the Wiki module rounding order and +1 roll.');
const incompleteModel={entryLevel:20,failureFreeLevel:50,formulaKind:'wiki_skilling_success_interpolation',parameterStatus:'not_published',parameters:null,blocker:'success_interpolation_low_high_parameters_not_published'};
const belowEntry=evaluateSkillingSuccessAtBaseLevel(incompleteModel,19),blockedAt34=evaluateSkillingSuccessAtBaseLevel(incompleteModel,34),failureFreeAt50=evaluateSkillingSuccessAtBaseLevel(incompleteModel,50),parameterizedAt34=evaluateSkillingSuccessAtBaseLevel({...incompleteModel,parameterStatus:'ready',parameters:{low:32,high:192},blocker:null},34);
check(belowEntry.status==='outside_entry_scope'&&belowEntry.successProbability===null,'A query below the source entry level must remain outside the model scope.');
check(blockedAt34.status==='blocked_incomplete_probability_model'&&blockedAt34.blocker==='success_interpolation_low_high_parameters_not_published','A query inside the failing range must retain the source parameter blocker.');
check(failureFreeAt50.status==='source_failure_free_threshold'&&failureFreeAt50.successProbability===1&&failureFreeAt50.failureProbability===0,'The source no-failure threshold must evaluate without interpolation parameters.');
check(parameterizedAt34.status==='revision_pinned_formula'&&close(parameterizedAt34.successProbability,87/256),'Revision-pinned parameters must be evaluated only for the requested base level.');
for(const invalid of [0,34.5,100]){let rejected=false;try{evaluateSkillingSuccessAtBaseLevel(incompleteModel,invalid)}catch{rejected=true}check(rejected,`Invalid base level ${invalid} must fail closed.`)}
const bounds=[{key:'sturgeon',requiredLevel:70,low:8,high:64},{key:'salmon',requiredLevel:58,low:16,high:96},{key:'trout',requiredLevel:48,low:32,high:192}];
const at48=cascadeSuccessProbabilities(bounds,48),at70=cascadeSuccessProbabilities(bounds,70);
check(at48.outcomes.find(row=>row.key==='sturgeon')?.probability===0&&at48.outcomes.find(row=>row.key==='salmon')?.probability===0&&close(at48.totalProbability,1),'Locked cascade outcomes must remain zero and total probability must include no-catch rolls.');
const sturgeonAt70=skillingSuccessInterpolation({low:8,high:64,level:70}),salmonConditional=skillingSuccessInterpolation({low:16,high:96,level:70});
check(close(at70.outcomes.find(row=>row.key==='salmon').probability,(1-sturgeonAt70)*salmonConditional),'Later outcomes must be conditional on every earlier eligible roll failing.');
const xp=expectedXpPerAttempt({bounds,level:70,xpByKey:{sturgeon:7,salmon:6,trout:5}});
check(xp.expectedXp>0&&xp.expectedXp<7&&close(xp.totalProbability,1),'Expected XP must weight every cascade outcome and preserve the no-catch remainder.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Revision-pinned skilling success formula checks passed.');
