import {parsePenguinAccessReconciliationEvidence,reconcilePenguinAccessVariant} from '../ingestion/agility-penguin-access-evidence-lib.mjs';

const page=(title,content,sourceRevision)=>({title,content,sourceRevision,sourceTimestamp:'2026-09-03T00:00:00Z',sourceUrl:`https://example.test/${encodeURIComponent(title)}`});
const course=`The Penguin Agility Course is available to players with boosted level 30 [[Agility]] and partial completion of [[Cold War]].
This Agility course requires a boostable level 30 [[Agility]] and is located on the [[Iceberg]], which requires partial completion of {{SCP|Quest}} [[Cold War]] to access.`;
const iceberg=`The iceberg can only be accessed by those who have gone halfway through [[Cold War]].`;
const quest=`Once inside, go into the first room on the left and talk to the KGP agent; you will now have to complete an [[Penguin agility course|agility course]].
Note: You may re-enter the [[Penguin agility course|agility course]] after completion of the quest if you have made another penguin suit.`;
const overview=`This Agility course requires level 30 Agility and is located on the [[Iceberg]], which requires completion of {{SCP|Quest}} [[Cold War]] to access.`;
const parse=(overrides={})=>parsePenguinAccessReconciliationEvidence({coursePage:page('Penguin Agility Course',overrides.course||course,'15239936'),icebergPage:page('Iceberg',overrides.iceberg||iceberg,'15317986'),questPage:page('Cold War',overrides.quest||quest,'15315223'),overviewPage:page('Agility',overrides.overview||overview,'15326985')});
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},evidence=parse();
check(evidence?.resolution?.status==='resolved'&&evidence.resolution.basis.length===4,'Three specific sources and the post-completion note must resolve the overview summary discrepancy transparently.');
check(evidence?.canonical_requirement?.mode==='any_of'&&evidence.canonical_requirement.alternatives.some(x=>x.state==='completed')&&evidence.canonical_requirement.alternatives.some(x=>x.milestone==='penguin_agility_course_access'),'The canonical requirement must accept completion or the exact in-progress milestone.');
check(evidence?.canonical_requirement?.alternatives?.[1]?.quest_start_alone_sufficient===false,'Merely starting Cold War must not unlock the course.');
check(evidence?.supporting_source_revisions?.includes('15317986')&&evidence.supporting_source_revisions.includes('15315223')&&evidence.supporting_source_revisions.includes('15326985'),'All corroborating and discrepant revisions must survive.');
const variant={parent_name:'Penguin Agility Course',source_revision:'15239936',requirements:['Partial completion of Cold War','Clockwork suit'],quest_progress_requirements:[{quest:'Cold War',state:'partial_completion',exact_stage_published:false}],source_conflicts:[{rule:'quest_progress_requirement_conflict'}],source_locator:{evidence:[]}};
const reconciled=reconcilePenguinAccessVariant(variant,{reconciliationEvidence:evidence});
check(reconciled.quest_progress_requirements?.[0]?.minimum_progress==='reached_penguin_agility_course_during_quest'&&reconciled.source_conflicts.length===0,'Resolved evidence must replace the vague requirement and remove only the resolved conflict.');
check(reconciled.resolved_source_discrepancies?.[0]?.resolution?.rule==='specific_course_location_and_quest_sequence_override_general_overview_summary','The overview discrepancy must remain visible after resolution.');
const overviewEvidence={source_revision:'15326985',requirement_claim:{quest:'Cold War',state:'completion'}};
const unresolved=reconcilePenguinAccessVariant(variant,{overviewEvidence});
check(unresolved.source_conflicts?.some(x=>x.rule==='quest_progress_requirement_conflict'&&x.resolution==='unresolved'),'Missing quest-sequence corroboration must preserve the original conflict.');
check(parse({quest:'The quest eventually reaches an agility course.'})===null,'Incomplete quest-sequence evidence must not resolve the discrepancy.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Penguin access reconciliation evidence checks passed.');
