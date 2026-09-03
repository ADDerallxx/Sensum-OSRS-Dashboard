import fs from 'node:fs/promises';
import path from 'node:path';
import {hash} from '../ingestion/lib.mjs';
import {hasIntervalActivityRate,intervalActivityRates,rankScalarActivityRates} from './activity-calculation-shape-lib.mjs';
import {ACTIVITY_RATE_INTERVAL_POLICY,activityRateBounds,compareActivityRateCandidates} from './activity-rate-interval-comparison-lib.mjs';
import {finiteConditionLevel} from './activity-variant-condition-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--root='))?.slice(7)||'.platform-data');
const level=Math.max(1,Number(process.argv.find(x=>x.startsWith('--level='))?.slice(8)||1));
const skill=process.argv.find(x=>x.startsWith('--skill='))?.slice(8)||'Agility';

async function latest(baseName,fileName){
  const base=path.join(root,baseName),dirs=(await fs.readdir(base,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();
  for(const dir of dirs){
    const file=path.join(base,dir,fileName);
    try{
      await fs.access(file);
      return {dir,rows:(await fs.readFile(file,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)};
    }catch{}
  }
  throw new Error(`No ${fileName} found.`);
}

const vectors=await latest('activity-vectors','vectors.ndjson');
let decisions=[];
try{decisions=(await fs.readFile(path.join(root,'activity-review-decisions','decisions.ndjson'),'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)}catch{}
const currentDecision=vector=>[...decisions].reverse().find(x=>x.scenarioKey===vector.scenarioKey&&x.sourceRevision===vector.sourceRevision&&x.vectorContentHash===vector.contentHash)||null;
const isApproved=vector=>currentDecision(vector)?.decision==='approve';
const eligible=vectors.rows.filter(x=>{const entry=finiteConditionLevel(x.conditions?.entryLevel);return entry!==null&&entry<=level});
const applicable=eligible.filter(x=>{const modeled=finiteConditionLevel(x.conditions?.modeledMinimumLevel);return modeled!==null&&modeled<=level});
const approved=applicable.filter(isApproved),proposed=applicable.filter(x=>x.state==='proposed');
const unknown=vectors.rows.filter(x=>{
  const entry=finiteConditionLevel(x.conditions?.entryLevel),modeled=finiteConditionLevel(x.conditions?.modeledMinimumLevel),missing=(x.validation?.missing||[]).length,contradictions=(x.validation?.contradictions||[]).length;
  return entry===null||(entry<=level&&(modeled===null||missing||contradictions||modeled>level));
});
const comparable=applicable.filter(x=>(isApproved(x)||x.state==='proposed')&&activityRateBounds(x)!==null);
const intervalOnlyEligible=intervalActivityRates(applicable);
const intervalComparison=intervalOnlyEligible.length?compareActivityRateCandidates(comparable,{objective:'maximize'}):null;
const scalarRanked=intervalComparison?[]:rankScalarActivityRates(comparable);
const leader=intervalComparison?intervalComparison.strictDominanceWinner:(scalarRanked[0]||null);
const winner=leader&&isApproved(leader)?leader:null,provisional=leader&&!winner?leader:null;
const closest=!intervalComparison&&leader?(scalarRanked[1]||null):null;
const completeEligibleCoverage=unknown.length===0&&comparable.length===applicable.length;
const comparisonComplete=intervalComparison?intervalComparison.comparisonComplete:true;
const allEligibleApproved=approved.length===eligible.length;
const claim=winner?(completeEligibleCoverage&&comparisonComplete&&allEligibleApproved?'verified_absolute_best':'best_approved'):(provisional?'provisional':'insufficient_data');
const unresolvedKeys=new Set((intervalComparison?.unresolvedComparisons||[]).flatMap(x=>[x.left?.candidateKey,x.right?.candidateKey]).filter(Boolean));
const dominantKey=intervalComparison?.strictDominanceWinnerKey||null;
const dominatedKeys=new Set((intervalComparison?.comparisons||[]).filter(x=>x.dominantCandidateKey===dominantKey&&dominantKey).map(x=>x.left?.candidateKey===dominantKey?x.right?.candidateKey:x.left?.candidateKey).filter(Boolean));
const exclusions=vectors.rows.filter(x=>x!==winner).map(x=>{
  const entry=finiteConditionLevel(x.conditions?.entryLevel),modeled=finiteConditionLevel(x.conditions?.modeledMinimumLevel),candidateKey=x.scenarioKey??x.recordKey??x.name;
  return {scenarioKey:x.scenarioKey,name:x.name,rateBounds:activityRateBounds(x),reasons:[
    ...(entry!==null&&entry>level?['level_requirement_not_met']:[]),
    ...(entry===null?['eligibility_unknown']:[]),
    ...(entry!==null&&entry<=level&&modeled!==null&&modeled>level?['current_level_model_missing']:[]),
    ...(intervalComparison&&unresolvedKeys.has(candidateKey)?['interval_bounds_overlap_or_touch']:[]),
    ...(intervalComparison&&dominatedKeys.has(candidateKey)?['strictly_dominated_under_interval_policy']:[]),
    ...(hasIntervalActivityRate(x)&&!intervalComparison?['interval_comparison_policy_not_applied']:[]),
    ...(x.validation?.missing||[]),
    ...(x.validation?.contradictions||[]).map(item=>`contradiction:${item.rule||'unresolved'}`),
    ...(x.state==='proposed'&&!isApproved(x)?['awaiting_approval']:[]),
    ...(currentDecision(x)?.decision==='reject'?['review_rejected']:[])
  ]};
});
const summarizeRate=vector=>{if(!vector)return null;const bounds=activityRateBounds(vector);return {scenarioKey:vector.scenarioKey,name:vector.name,xpPerHour:vector.calculation?.xpPerHour??null,xpPerHourRange:bounds&&bounds.kind!=='point_estimate'?{minimum:bounds.minimum,maximum:bounds.maximum}:null,rateEvidenceKind:bounds?.kind??null,comparisonBasis:bounds}};
const comparisonSummary=intervalComparison?{
  policy:ACTIVITY_RATE_INTERVAL_POLICY,
  objective:intervalComparison.objective,
  semantics:intervalComparison.semantics,
  candidates:intervalComparison.candidates,
  comparisons:intervalComparison.comparisons,
  unresolvedComparisons:intervalComparison.unresolvedComparisons,
  invalidCandidateKeys:intervalComparison.invalidCandidateKeys,
  strictDominanceWinnerKey:intervalComparison.strictDominanceWinnerKey,
  comparisonComplete:intervalComparison.comparisonComplete
}:null;
const challengeResult={
  status:winner&&completeEligibleCoverage&&comparisonComplete?'winner_survives':'inconclusive',
  reason:intervalComparison&&!comparisonComplete?'Published rate bounds overlap or touch, so strict interval dominance cannot identify one winner.':winner?'The selected candidate was compared against every complete applicable candidate under the declared rate policy.':provisional?'No approved winner; provisional evidence cannot survive an authoritative challenge.':'No complete comparable candidate can be selected.',
  challengers:intervalComparison?.unresolvedComparisons.map(x=>({leftCandidateKey:x.left?.candidateKey,rightCandidateKey:x.right?.candidateKey,outcome:x.outcome}))??(closest?[{scenarioKey:closest.scenarioKey,name:closest.name,xpPerHour:closest.calculation?.xpPerHour}]:[])
};
const certificate={
  contract:'sensum.recommendation-certificate.v1',
  certificateKey:`${skill.toLowerCase()}-xp-level-${level}-${Date.now()}`,
  generatedAt:new Date().toISOString(),
  objective:{skill,metric:'xp_per_hour'},
  accountConditions:{baseLevel:level,baseLevelsOnly:true},
  dataSnapshot:{vectorBuild:vectors.dir},
  formulaVersion:leader?.calculation?.formulaVersion??null,
  rateEvidenceKind:leader?activityRateBounds(leader)?.kind??null:null,
  claimStrength:claim,
  candidateCoverage:{total:vectors.rows.length,eligible:eligible.length,approvedEligible:approved.length,proposedEligible:proposed.length,unknownEligibility:unknown.length,intervalComparableEligible:intervalOnlyEligible.length,scalarRankingPolicy:'calculated_point_estimates_only',intervalComparisonPolicy:intervalOnlyEligible.length?ACTIVITY_RATE_INTERVAL_POLICY:null,completeEligibleCoverage,comparisonComplete},
  intervalComparison:comparisonSummary,
  winner:summarizeRate(winner),
  provisionalLeader:provisional?{...summarizeRate(provisional),label:'Not approved'}:null,
  closestAlternative:summarizeRate(closest),
  exclusions,
  challengeResult,
  confidence:{grade:claim==='verified_absolute_best'?'verified':claim==='best_approved'?'limited':'insufficient',reason:intervalComparison&&!comparisonComplete?'Source-bounded candidates remain incomparable where their ranges overlap or touch.':completeEligibleCoverage?'Eligible evidence coverage is complete for the comparison.':'At least one candidate has unknown eligibility, incomplete mechanics, or contradictory evidence.'},
  evidence:vectors.rows.map(x=>({scenarioKey:x.scenarioKey,sourceRevision:x.sourceRevision,vectorContentHash:x.contentHash,reviewDecisionHash:currentDecision(x)?.contentHash||null})),
  contentHash:null
};
certificate.contentHash=hash({...certificate,contentHash:undefined});
const out=path.join(root,'recommendation-certificates',certificate.generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'certificate.json'),JSON.stringify(certificate,null,2)+'\n');
console.log(JSON.stringify(certificate,null,2));
