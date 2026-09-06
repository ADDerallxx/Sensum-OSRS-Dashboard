import fs from 'node:fs';

const file='platform/automation/v4-upgrade-plan.json';
const plan=JSON.parse(fs.readFileSync(file,'utf8'));
const valid=new Set(['complete','in_progress','pending','blocked_user_approval']);
const failures=[];
for(const phase of plan.phases){
  if(!phase.id||!valid.has(phase.status)||!phase.exitGate)failures.push(`Invalid phase: ${JSON.stringify(phase)}`);
}
if(plan.liveDeploymentAllowed!==false)failures.push('Unattended live deployment must remain disabled.');
if(plan.automaticEvidenceApprovalAllowed!==false)failures.push('Unattended evidence approval must remain disabled.');
if(plan.executionStrategy?.adaptiveReorderingAuthorized!==true)failures.push('Adaptive accuracy-preserving checkpoint ordering must remain authorized.');
if(plan.executionStrategy?.accuracyGatesMayBeWeakened!==false)failures.push('Adaptive execution must never weaken accuracy gates.');
if(Object.values(plan.executionStrategy?.defaultCapacityPercent||{}).reduce((sum,value)=>sum+value,0)!==100)failures.push('Execution capacity allocation must total 100 percent.');
for(const state of ['verified','bounded','blocked','discovered'])if(!plan.executionStrategy?.evidenceStates?.includes(state))failures.push(`Missing evidence state: ${state}`);
for(const shortcut of ['unsupported_inference','silent_conflict_resolution','incomplete_universe_verified_best_claim','automatic_golden_approval','production_mutation'])if(!plan.executionStrategy?.forbiddenEfficiencyShortcuts?.includes(shortcut))failures.push(`Missing forbidden efficiency shortcut: ${shortcut}`);
if(plan.authorizationPolicy?.source!=='explicit_user_approval')failures.push('V4 development permissions must remain bound to explicit user approval.');
if(!plan.authorizationPolicy?.policyDocument||!fs.existsSync(plan.authorizationPolicy.policyDocument))failures.push('V4 authorization boundary document is missing.');
if(plan.authorizationPolicy?.cloudStaging?.resourceCreationAllowed!==false||plan.authorizationPolicy?.cloudStaging?.monthlySpendCap!==null)failures.push('Paid cloud staging must remain disabled until a concrete spending cap is recorded.');
if(Object.values(plan.authorizationPolicy?.production||{}).some(Boolean))failures.push('Production permissions must remain separately gated.');
if(plan.phases.filter(x=>x.status==='in_progress').length>1)failures.push('Only one phase may be in progress.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
const next=plan.phases.find(x=>x.status==='in_progress')||plan.phases.find(x=>x.status==='pending')||plan.phases.find(x=>x.status==='blocked_user_approval')||null;
console.log(JSON.stringify({contract:plan.contract,next,liveDeploymentAllowed:plan.liveDeploymentAllowed,automaticEvidenceApprovalAllowed:plan.automaticEvidenceApprovalAllowed},null,2));
