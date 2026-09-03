import {enrichAgilityCandidateConditions,enrichAgilityCandidateEligibility,parseAgilityTrainingGuideCandidates,parseBarbarianFishingEligibility,parseBrimhavenFloorSpikeEligibility,parseRooftopTargetConditionEvidence} from '../ingestion/agility-training-guide-lib.mjs';
import {parseBrimhavenFloorSpikeSuccessEvidence} from '../ingestion/agility-floor-spike-success-evidence-lib.mjs';
import {parseAlKharidMultiObstacleFailureEvidence} from '../ingestion/agility-rooftop-multi-obstacle-evidence-lib.mjs';
const source=`===Levels 1–26/33: Questing===
Completing [[The Tourist Trap]], [[Recruitment Drive]], [[The Depths of Despair]], and [[The Grand Tree]] will grant a total of 19,700 experience.
===Levels 20–47: Brimhaven Agility Arena===
[[Brimhaven Agility Arena]] offers the fastest experience. Players must have 200 coins. The [[Floor spikes (Brimhaven Agility Arena)|floor spikes]] trap requires level 20 and can grant up to 30,000 experience per hour as low as level 15 with the use of [[summer pie]]. Bringing food is advised.
Additionally, the floor spike obstacle can be used, which is very low intensity and can achieve approximately 36,000 experience per hour. Using the "Detached Camera" plugin helps.
===Levels 1–99: Rooftop Agility Courses===
| 1–20/30
| [[Draynor Village Rooftop Course|Draynor Village]]
| 9,000–10,000
|-
| 20–30
| [[Al Kharid Rooftop Course|Al Kharid]]
| 11,000–12,000
|-
| 30–40
| [[Varrock Rooftop Course|Varrock]]
| 11,000–14,000
===Levels 15–40: Edgeville Dungeon monkeybars===
The shortcut offers up to 13,200 experience per hour and is located in the Wilderness.
===Levels 15–74: Barbarian Fishing===
[[Barbarian Fishing]] grants small amounts of passive Agility and [[Strength]] experience. Fishing from level 58 to 99 provides progress.
=== Levels 30+: Agility Pyramid ===
Roughly 13 completions can be made per hour at early levels (30–50), for 25,000 experience per hour.`;
const barbarianSource=`===Heavy rod fishing===
{{Needed|[[Barbarian rod]]|skills={{SCP|Fishing|48|link=yes}}, {{SCP|Agility|15|link=yes}}, {{SCP|Strength|15|link=yes}}}}
This method also grants Strength and Agility experience.
===Barehanded fishing===`;
const brimhavenSource=`The course has no requirements to access other than a 200 [[coins]] fee paid before each entry.
Though it is possible to reach dispensers without any [[Agility]] levels, level 20 Agility is required to pass the [[pressure pad (Brimhaven Agility Arena)|pressure pad]] and [[Floor spikes (Brimhaven Agility Arena)|floor spike]] obstacles, while level 40 Agility is required for other obstacles.`;
const alKharidSource=`The '''Al Kharid Rooftop Course''' is a [[Rooftop Agility Course]] located in [[Al Kharid]] that is available to players with an [[Agility]] level of 20 or higher.
Players get 216 experience points from completing the course.
It is possible to fail the ''Cross Tightrope 1'' and ''Teeth-grip Zip Line'' obstacles during the course, taking 1-5 damage each time.
A player can complete this course in 64.2 seconds (107 ticks). Using this course, one can gain up to around 12,100 experience per hour.
|[[Tightrope (Al Kharid Rooftop Course)#Tightrope_1|Tightrope 1]]
|{{+=|xp|36|echo=2}}
| style="text-align:center;" |Yes
|[[Zip line (Al Kharid Rooftop Course)|Zip line]]
|{{+=|xp|48|echo=2}}
| style="text-align:center;" |Yes`;
const alKharidTightropeSource=`The '''tightrope''' is an [[Agility]] obstacle found within the [[Al Kharid Rooftop Course]]. An Agility level of 20 is required to pass the obstacle. The first Tightrope encountered during the course will award 36 experience, and the second, 18.
{{Agility info|version1=Tightrope 1|version2=Tightrope 2|name1=Tightrope 1|name2=Tightrope 2|level=20|xp1=36|xp2=18|course=[[Al Kharid Rooftop Course]]|type=Obstacle}}`;
const alKharidZipLineSource=`The '''zip line''' is an [[Agility]] obstacle found within the [[Al Kharid Rooftop Course]]. An Agility level of 20 is required to pass the obstacle, which will then grant the player 48 Agility experience.
{{Agility info|name=Zip line|level=20|xp=48|course=[[Al Kharid Rooftop Course]]|type=Obstacle}}`;
const varrockSource=`The '''Varrock Rooftop Course''' is a [[Rooftop Agility Course]] located in [[Varrock]] that is available to players with an [[Agility]] level of 30 or higher.
It is possible to fail during Cross Clothes Line and Balance Wall and get inflicted with 3–8 and 2–5 damage respectively.
The course takes approximately 1 minute and 10 seconds.`;
const floorSpikeSource=`Players will no longer fail this obstacle at level 50 [[Agility]].
{{Agility info|name=Floor spikes|level=20|type=Obstacle}}
[[Category:Needs skilling success chart]]`;
const successFormulaSource=`function p.interp(low, high, level)
 local value = math.floor(low * (99 - level) / 98 + high * (level - 1) / 98 + 0.5) + 1
 return math.min(math.max(value / 256, 0), 1)`;
const parsed=parseAgilityTrainingGuideCandidates({title:'Agility training',content:source,sourceRevision:'15324367',sourceTimestamp:'2026-08-29',sourceUrl:'https://example.test'});
const eligibility=parseBarbarianFishingEligibility({title:'Barbarian Training',content:barbarianSource,sourceRevision:'15292392',sourceTimestamp:'2026-08-11',sourceUrl:'https://example.test/barbarian'});
const brimhavenEligibility=parseBrimhavenFloorSpikeEligibility({title:'Brimhaven Agility Arena',content:brimhavenSource,sourceRevision:'15293118',sourceTimestamp:'2026-08-11',sourceUrl:'https://example.test/brimhaven'});
const alKharidCondition=parseRooftopTargetConditionEvidence({title:'Al Kharid Rooftop Course',content:alKharidSource,sourceRevision:'15319534',sourceTimestamp:'2026-08-25',sourceUrl:'https://example.test/al-kharid'});
const alKharidComposite=parseAlKharidMultiObstacleFailureEvidence({coursePage:{title:'Al Kharid Rooftop Course',content:alKharidSource,sourceRevision:'15319534',sourceTimestamp:'2026-08-25',sourceUrl:'https://example.test/al-kharid'},tightropePage:{title:'Tightrope (Al Kharid Rooftop Course)',content:alKharidTightropeSource,sourceRevision:'14658399',sourceTimestamp:'2024-05-11',sourceUrl:'https://example.test/tightrope'},zipLinePage:{title:'Zip line (Al Kharid Rooftop Course)',content:alKharidZipLineSource,sourceRevision:'14687253',sourceTimestamp:'2024-06-25',sourceUrl:'https://example.test/zip-line'}});
const varrockCondition=parseRooftopTargetConditionEvidence({title:'Varrock Rooftop Course',content:varrockSource,sourceRevision:'15319528',sourceTimestamp:'2026-08-25',sourceUrl:'https://example.test/varrock'});
const floorSpikeCondition=parseBrimhavenFloorSpikeSuccessEvidence({obstaclePage:{title:'Floor spikes (Brimhaven Agility Arena)',content:floorSpikeSource,sourceRevision:'15329694',sourceTimestamp:'2026-09-03',sourceUrl:'https://example.test/floor-spikes'},formulaPage:{title:'Module:Skilling success chart',content:successFormulaSource,sourceRevision:'15325744',sourceTimestamp:'2026-08-30',sourceUrl:'https://example.test/success-formula'}});
const rows=enrichAgilityCandidateConditions(enrichAgilityCandidateEligibility(parsed,[...eligibility,...brimhavenEligibility]),[...alKharidCondition,...varrockCondition,...floorSpikeCondition,...alKharidComposite]),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},get=key=>rows.find(x=>x.candidate_key===key);
check(rows.length===9,'The level-34 guide universe must emit nine source-backed candidates.');
check(get('guide:questing:early-agility')?.record_kind==='one_time_progression'&&get('guide:questing:early-agility').quests.length===4,'Quest progression must not become a repeatable method.');
check(get('guide:brimhaven:floor-spikes-active')?.minimum_agility===20&&get('guide:brimhaven:floor-spikes-active').boosted_minimum_base_agility===15,'Brimhaven base and boosted entry levels must remain separate.');
check(get('guide:brimhaven:floor-spikes-active')?.observed_rate_kind==='source_stated_upper_bound'&&get('guide:brimhaven:floor-spikes-active')?.observed_rate_is_expected===false,'The Brimhaven "up to" rate must remain an upper bound and never become an expected rate.');
check(get('guide:brimhaven:floor-spikes-active')?.observed_xp_per_hour_upper_scope?.minimum===20&&get('guide:brimhaven:floor-spikes-active')?.observed_xp_per_hour_upper_scope?.maximum===47&&get('guide:brimhaven:floor-spikes-active')?.failure_probability_published===false,'The upper bound must retain its guide band and the missing failure probability.');
check(get('guide:brimhaven:floor-spikes-active')?.target_condition_blocker===null&&get('guide:brimhaven:floor-spikes-active')?.target_condition_evidence?.contract==='sensum.agility-floor-spike-success-evidence.v2'&&get('guide:brimhaven:floor-spikes-active')?.target_condition_evidence?.account_independent===true&&get('guide:brimhaven:floor-spikes-active')?.supporting_source_revisions?.includes('15325744'),'The active method must retain reusable formula evidence without an ingestion-time account blocker.');
check(get('guide:brimhaven:floor-spikes-detached')?.level_scope_ambiguous===false&&get('guide:brimhaven:floor-spikes-detached').minimum_agility===20,'The detached-camera method must resolve to the source-stated floor-spike requirement.');
check(get('guide:brimhaven:floor-spikes-detached')?.eligibility_scope==='floor_spike_obstacle'&&get('guide:brimhaven:floor-spikes-detached').requirements?.includes('200 coins entry fee'),'The supporting source must keep arena access and obstacle eligibility distinct.');
check(get('guide:brimhaven:floor-spikes-detached')?.supporting_source_revisions?.includes('15293118'),'The detached-camera eligibility join must retain the Brimhaven source revision.');
check(get('guide:brimhaven:floor-spikes-detached')?.observed_xp_per_hour_level_scope?.minimum===20&&get('guide:brimhaven:floor-spikes-detached')?.observed_xp_per_hour_level_scope?.maximum===47,'The Detached Camera rate must inherit the exact guide section band.');
check(get('guide:brimhaven:floor-spikes-detached')?.observed_rate_equipment_scope_unresolved===true,'The guide must not silently choose standard or Karamja-glove equipment for the 36,000 XP/hour observation.');
check(get('guide:brimhaven:floor-spikes-detached')?.target_condition_blocker===null&&get('guide:brimhaven:floor-spikes-detached')?.target_condition_evidence?.success_probability_model?.blocker==='success_interpolation_low_high_parameters_not_published'&&get('guide:brimhaven:floor-spikes-detached')?.target_condition_evidence?.source_revision==='15329694','The detached method must retain the reusable parameter gap and obstacle revision without storing a target level.');
check(get('guide:rooftop:varrock')?.observed_xp_per_hour_range?.maximum===14000,'Rooftop guide ranges must remain ranges.');
check(get('guide:rooftop:varrock')?.source_locator?.evidence?.some(item=>item.excerpt?.includes('11,000–14,000')),'The Varrock rate must retain its exact table-row locator rather than only the enclosing section.');
check(get('guide:edgeville:monkeybars')?.observed_rate_kind==='source_stated_upper_bound'&&get('guide:edgeville:monkeybars')?.observed_rate_is_expected===false,'The Edgeville guide rate must remain a non-expected upper bound.');
check(get('guide:edgeville:monkeybars')?.observed_xp_per_hour_upper_scope?.minimum===15&&get('guide:edgeville:monkeybars')?.observed_xp_per_hour_upper_scope?.maximum===40,'The Edgeville upper bound must retain its exact guide section scope.');
check(get('guide:rooftop:al-kharid')?.observed_xp_per_hour_level_scope?.minimum===20&&get('guide:rooftop:al-kharid')?.observed_xp_per_hour_level_scope?.maximum===30,'The Al Kharid guide rate must retain its source level band.');
check(get('guide:rooftop:al-kharid')?.failure_possible===true&&get('guide:rooftop:al-kharid')?.target_condition_evidence?.failure_outcomes?.length===2,'The Al Kharid candidate must retain the source-stated failing obstacles without inventing a probability.');
check(get('guide:rooftop:al-kharid')?.target_condition_evidence?.failure_outcomes?.[0]?.damage?.minimum===1&&get('guide:rooftop:al-kharid')?.supporting_source_revisions?.includes('15319534'),'Al Kharid condition evidence must retain its damage range and source revision.');
check(get('guide:rooftop:al-kharid')?.target_condition_evidence?.contract==='sensum.agility-rooftop-multi-obstacle-failure-evidence.v2'&&get('guide:rooftop:al-kharid')?.target_condition_evidence?.account_independent===true&&get('guide:rooftop:al-kharid')?.supporting_source_revisions?.includes('14658399')&&get('guide:rooftop:al-kharid')?.supporting_source_revisions?.includes('14687253'),'The account-independent composite evidence must supersede the generic row while retaining both obstacle revisions.');
check(get('guide:rooftop:al-kharid')?.target_condition_blockers?.length===0&&get('guide:rooftop:al-kharid')?.target_condition_evidence?.condition_limitations?.includes('failure_recovery_route_and_time_penalty_not_published'),'The enriched candidate must retain stable limitations without baking a target level into ingestion.');
check(get('guide:rooftop:varrock')?.observed_xp_per_hour_level_scope?.minimum===30&&get('guide:rooftop:varrock')?.observed_xp_per_hour_level_scope?.maximum===40,'The Varrock guide rate must retain its source level band.');
check(get('guide:rooftop:varrock')?.target_condition_evidence?.failure_outcomes?.[0]?.damage?.maximum===8&&get('guide:rooftop:varrock')?.target_condition_evidence?.failure_outcomes?.[1]?.damage?.maximum===5,'Varrock must preserve each obstacle-specific damage range independently.');
check(get('guide:rooftop:varrock')?.supporting_source_revisions?.includes('15319528'),'Varrock condition evidence must retain its source revision.');
check(get('guide:barbarian-fishing')?.guide_example_fishing_range?.minimum===58&&get('guide:barbarian-fishing').other_skill_requirement_unknown===false&&get('guide:barbarian-fishing').agility_rate_missing===true,'A revision-pinned supporting page must resolve hybrid eligibility without pretending the guide example is a requirement.');
check(get('guide:barbarian-fishing')?.skill_requirements?.Fishing===48&&get('guide:barbarian-fishing').skill_requirements?.Agility===15&&get('guide:barbarian-fishing').skill_requirements?.Strength===15,'Barbarian Fishing must retain all source-stated heavy-rod skill requirements.');
check(get('guide:barbarian-fishing')?.supporting_source_revisions?.includes('15292392')&&get('guide:barbarian-fishing').supporting_eligibility_evidence?.source_locator?.evidence?.length,'Cross-page eligibility must retain its supporting revision and locator.');
const withoutEvidence=enrichAgilityCandidateEligibility(parsed,[]).find(x=>x.candidate_key==='guide:barbarian-fishing');
check(withoutEvidence?.other_skill_requirement_unknown===true,'Missing supporting evidence must remain explicitly unknown.');
const conflicting=enrichAgilityCandidateEligibility(parsed,[{...eligibility[0],skill_requirements:{...eligibility[0].skill_requirements,Agility:16}}]).find(x=>x.candidate_key==='guide:barbarian-fishing');
check(conflicting?.other_skill_requirement_unknown===true&&conflicting.eligibility_contradictions?.length===1,'Contradictory cross-page requirements must fail closed.');
const detachedWithoutEvidence=enrichAgilityCandidateEligibility(parsed,[]).find(x=>x.candidate_key==='guide:brimhaven:floor-spikes-detached');
check(detachedWithoutEvidence?.level_scope_ambiguous===true,'Missing floor-spike evidence must preserve the ambiguous guide scope.');
const detachedConflict=enrichAgilityCandidateEligibility(parsed,[{...brimhavenEligibility[0],skill_requirements:{Agility:21}}]).find(x=>x.candidate_key==='guide:brimhaven:floor-spikes-detached');
check(detachedConflict?.level_scope_ambiguous===true&&detachedConflict.eligibility_contradictions?.length===1,'A conflicting obstacle requirement must not resolve the detached-camera scope.');
check(rows.every(x=>x.source_locator?.evidence?.length&&x.state==='candidate'),'Every guide candidate must remain revision-located and unapproved.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Agility training-guide candidate checks passed.');
