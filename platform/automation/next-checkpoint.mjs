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
if(plan.phases.filter(x=>x.status==='in_progress').length>1)failures.push('Only one phase may be in progress.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
const next=plan.phases.find(x=>x.status==='in_progress')||plan.phases.find(x=>x.status==='pending')||plan.phases.find(x=>x.status==='blocked_user_approval')||null;
console.log(JSON.stringify({contract:plan.contract,next,liveDeploymentAllowed:plan.liveDeploymentAllowed,automaticEvidenceApprovalAllowed:plan.automaticEvidenceApprovalAllowed},null,2));
