import {eligibleForGoldenHumanApproval,goldenReviewChecks} from '../transforms/golden-review-checks-lib.mjs';

const bounded={scenarioKey:'agility:skullball:run',name:'Skullball run',sourceRevision:'15315300',conditions:{entryLevel:25,modeledMinimumLevel:25},mechanics:{lapSecondsRange:{minimum:140,maximum:165},xpPerSuccess:750,randomFailureModelRequired:false,failureProbability:null},calculation:{formulaVersion:'activity-v1',calculationKind:'bounded_cycle_range',actionsPerHourRange:{minimum:21.8,maximum:25.7},xpPerHourRange:{minimum:16363,maximum:19286}},validation:{comparisonPolicy:'source_timing_derived_rate_range',rateValidation:{kind:'source_timing_derived_range',independentObservedRate:false,preservesSourceBounds:true},missing:[],contradictions:[],sourceLocators:[{sourceRevision:'15315300'}]}};
const falselyIndependent=structuredClone(bounded);falselyIndependent.validation.rateValidation.independentObservedRate=true;
const failures=[];
if(!eligibleForGoldenHumanApproval(bounded))failures.push('A complete source-derived bounded vector must be eligible for manual review.');
if(eligibleForGoldenHumanApproval(falselyIndependent))failures.push('A source-derived range mislabeled as independently observed must fail review eligibility.');
if(goldenReviewChecks(bounded).rateValidation!==true)failures.push('Bound-preserving source-derived rate validation must be explicit.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Golden bounded-review safety checks passed.');
