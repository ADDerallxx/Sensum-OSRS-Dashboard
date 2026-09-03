import {parseAlKharidMultiObstacleFailureEvidence} from '../ingestion/agility-rooftop-multi-obstacle-evidence-lib.mjs';

const course=`The '''Al Kharid Rooftop Course''' is a [[Rooftop Agility Course]] located in [[Al Kharid]] that is available to players with an [[Agility]] level of 20 or higher.
Players get 216 experience points from completing the course.
It is possible to fail the ''Cross Tightrope 1'' and ''Teeth-grip Zip Line'' obstacles during the course, taking 1-5 damage each time.
A player can complete this course in 64.2 seconds (107 ticks). Using this course, one can gain up to around 12,100 experience per hour.
|[[Tightrope (Al Kharid Rooftop Course)#Tightrope_1|Tightrope 1]]
|{{+=|xp|36|echo=2}}
| style="text-align:center;" |Yes
|[[Zip line (Al Kharid Rooftop Course)|Zip line]]
|{{+=|xp|48|echo=2}}
| style="text-align:center;" |Yes`;
const tightrope=`The '''tightrope''' is an [[Agility]] obstacle found within the [[Al Kharid Rooftop Course]]. An Agility level of 20 is required to pass the obstacle. The first Tightrope encountered during the course will award 36 experience, and the second, 18.
{{Agility info
|version1 = Tightrope 1
|version2 = Tightrope 2
|name1 = Tightrope 1
|name2 = Tightrope 2
|level = 20
|xp1 = 36
|xp2 = 18
|course = [[Al Kharid Rooftop Course]]
|type = Obstacle
}}`;
const zipLine=`The '''zip line''' is an [[Agility]] obstacle found within the [[Al Kharid Rooftop Course]]. An Agility level of 20 is required to pass the obstacle, which will then grant the player 48 Agility experience.
{{Agility info
|name = Zip line
|level = 20
|xp = 48
|course = [[Al Kharid Rooftop Course]]
|type = Obstacle
}}`;
const page=(title,content,sourceRevision)=>({title,content,sourceRevision,sourceTimestamp:'2026-08-25',sourceUrl:`https://example.test/${encodeURIComponent(title)}`});
const parse=(overrides={})=>parseAlKharidMultiObstacleFailureEvidence({coursePage:page('Al Kharid Rooftop Course',overrides.course||course,'15319534'),tightropePage:page('Tightrope (Al Kharid Rooftop Course)',overrides.tightrope||tightrope,'14658399'),zipLinePage:page('Zip line (Al Kharid Rooftop Course)',overrides.zipLine||zipLine,'14687253')});
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const [evidence]=parse();
check(evidence?.failure_outcomes?.length===2,'The composite model must retain both failing obstacles independently.');
check(evidence?.failure_outcomes?.[0]?.obstacle_key==='tightrope_1'&&evidence.failure_outcomes[0].xp_on_success===36&&evidence.failure_outcomes[0].damage.minimum===1,'Tightrope 1 must retain its own success XP and damage evidence.');
check(evidence?.failure_outcomes?.[1]?.obstacle_key==='zip_line'&&evidence.failure_outcomes[1].xp_on_success===48&&evidence.failure_outcomes[1].damage.maximum===5,'The zip line must retain its own success XP and damage evidence.');
check(evidence?.contract==='sensum.agility-rooftop-multi-obstacle-failure-evidence.v2'&&evidence.account_independent===true&&!('target_base_agility' in evidence),'Reusable evidence must not contain an account query level.');
check(evidence?.failure_outcomes?.every(row=>row.success_chart_present===false&&row.success_probability_evidence_status==='not_published'&&!('success_probability_at_target' in row)),'Absent obstacle success charts must remain level-independent unknowns and never produce synthetic probabilities.');
check(evidence?.aggregate_failure_probability_model?.published===false&&evidence.failure_probability_published===false,'Two known failure points must not be collapsed into an inferred lap probability.');
check(evidence?.condition_limitations?.includes('per_obstacle_success_probability_model_incomplete')&&!('target_condition_blockers' in evidence),'Evidence must retain the stable model limitation without emitting target-level blockers during ingestion.');
check(evidence?.condition_limitations?.includes('failed_obstacle_xp_outcome_not_published')&&evidence.condition_limitations.includes('failure_recovery_route_and_time_penalty_not_published'),'Unknown failed-attempt XP and recovery timing must remain separate account-independent limitations.');
check(evidence?.lap_timing?.ticks===107&&evidence.lap_timing.failure_inclusion_unspecified===true&&evidence.source_stated_xp_per_hour_upper.is_expected===false,'Published timing and upper-bound rate must not become expected failure-inclusive performance.');
check(evidence?.source_revision==='15319534'&&evidence.supporting_source_revisions.includes('14658399')&&evidence.supporting_source_revisions.includes('14687253'),'The course and both obstacle revisions must survive.');
const [conflicting]=parse({zipLine:zipLine.replace('|level = 20','|level = 21').replace('level of 20','level of 21')});
check(conflicting?.source_conflicts?.[0]?.rule==='zip_line_requirement_disagrees_with_course_entry'&&conflicting.condition_limitations.includes('zip_line_requirement_disagrees_with_course_entry'),'A cross-page requirement disagreement must fail closed.');
check(parseAlKharidMultiObstacleFailureEvidence({coursePage:page('Al Kharid Rooftop Course',course,'1'),tightropePage:page('Wrong title',tightrope,'2'),zipLinePage:page('Zip line (Al Kharid Rooftop Course)',zipLine,'3')}).length===0,'Wrong or missing source pages must not produce partial composite evidence.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Al Kharid multi-obstacle failure evidence checks passed.');
