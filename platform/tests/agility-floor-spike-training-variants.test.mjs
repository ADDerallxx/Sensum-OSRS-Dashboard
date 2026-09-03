import {parseBrimhavenDetachedFloorSpikeVariants} from '../ingestion/agility-floor-spike-training-variant-lib.mjs';
import {parseBrimhavenFloorSpikeSuccessEvidence} from '../ingestion/agility-floor-spike-success-evidence-lib.mjs';
import {evaluateSkillingSuccessAtBaseLevel} from '../formulas/skilling-success-v1.mjs';
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const obstaclePage={title:'Floor spikes (Brimhaven Agility Arena)',sourceRevision:'15329694',sourceTimestamp:'2026-09-03',sourceUrl:'https://example.test/floor-spikes',content:`Failing to jump across the spikes successfully will cause the player to take damage. Players will no longer fail this obstacle at level 50 [[Agility]].
An unusual property of floor spikes is that clicking outside the agility arena can cause a character to route over the spikes. Careful positioning of the camera can allow a player to click in the same spot repeatedly to continuously jump over the spikes, to gain very low-attention Agility experience.
{{Agility info
|name = Floor spikes
|version1 = Standard
|version2 = Karamja gloves
|level = 20
|xp1 = 24
|xp2 = 26.4
|course = [[Brimhaven Agility Arena]]
|type = Obstacle
}}
[[Category:Needs skilling success chart]]`};
const arenaPage={title:'Brimhaven Agility Arena',sourceRevision:'15293118',sourceTimestamp:'2026-08-11',sourceUrl:'https://example.test/brimhaven',content:`The course has no requirements to access other than a 200 [[coins]] fee.
level 20 Agility is required to pass the [[pressure pad (Brimhaven Agility Arena)|pressure pad]] and [[Floor spikes (Brimhaven Agility Arena)|floor spike]] obstacles.
*Wear [[Karamja gloves 2]], [[Karamja gloves 3|3]], or [[Karamja gloves 4|4]] for 10% extra Agility experience from obstacles in the Brimhaven Agility Arena.
|[[Floor spikes (Brimhaven Agility Arena)|Floor spikes]]
|24 (26.4)
|4 t
|6
|-
|20`};
const guidePage={title:'Agility training',sourceRevision:'15324367',sourceTimestamp:'2026-08-29',sourceUrl:'https://example.test/agility-guide',content:`===Levels 20–47: Brimhaven Agility Arena===
Additionally, the floor spike obstacle can be used, which is very low intensity and can achieve approximately 36,000 experience per hour. Using the "Detached Camera" plugin`};
const formulaPage={title:'Module:Skilling success chart',sourceRevision:'15325744',sourceTimestamp:'2026-08-30',sourceUrl:'https://example.test/success-formula',content:`function p.interp(low, high, level)
 local value = math.floor(low * (99 - level) / 98 + high * (level - 1) / 98 + 0.5) + 1
 return math.min(math.max(value / 256, 0), 1)
end`};
const successEvidence=parseBrimhavenFloorSpikeSuccessEvidence({obstaclePage,formulaPage});
const input={obstaclePage,arenaPage,guidePage,successEvidence},rows=parseBrimhavenDetachedFloorSpikeVariants(input),standard=rows.find(row=>row.variant_key==='detached_floor_spikes_standard'),gloves=rows.find(row=>row.variant_key==='detached_floor_spikes_karamja_gloves');
check(successEvidence.length===2&&successEvidence.every(row=>row.contract==='sensum.agility-floor-spike-success-evidence.v2'&&row.account_independent===true&&row.state==='blocked'&&row.success_formula_published===true&&row.success_formula_parameters_published===false&&!('target_base_agility' in row)&&!('success_probability_at_target' in row)),'Reusable evidence must preserve the generic formula gap without storing an account query.');
check(rows.length===2&&rows.every(row=>row.standalone_training_method===true),'A complete three-page evidence set must emit standard and glove variants.');
check(rows.every(row=>row.contract==='sensum.agility-floor-spike-training-variant.v2'&&row.account_independent===true&&!('success_probability_target_base_agility' in row)&&!('success_probability_at_target' in row)),'Floor-spike variants must be account-independent and use the V2 evidence contract.');
check(standard?.entry_level===20&&standard?.xp_per_success===24&&standard?.cycle_ticks===4&&standard?.failure_free_level===50,'Standard floor-spike mechanics and thresholds must remain source-bound.');
check(gloves?.xp_per_success===26.4&&gloves?.equipment_requirement?.items?.length===3,'The Karamja glove bonus must remain an explicit equipment variant.');
check(rows.every(row=>row.unmodeled_level_ranges?.[0]?.blocker==='success_interpolation_low_high_parameters_not_published'&&row.source_warning==='observed_rate_equipment_state_unspecified'),'The exact missing interpolation inputs and equipment-unresolved guide rate must remain blockers.');
check(rows.every(row=>row.observed_xp_per_hour_equipment_unscoped===36000&&row.observed_rate_scope?.agility_level?.minimum===20&&row.observed_rate_scope?.agility_level?.maximum===47&&row.observed_rate_scope?.equipment_state===null),'The guide heading must scope the observation to levels 20–47 without inventing an equipment state.');
check(rows.every(row=>row.supporting_source_revisions?.includes('15293118')&&row.supporting_source_revisions?.includes('15324367')&&row.supporting_source_revisions?.includes('15325744')),'The approximate guide rate and generic formula must retain every supporting source revision.');
check(parseBrimhavenDetachedFloorSpikeVariants({obstaclePage,arenaPage,guidePage,successEvidence:[]}).length===0,'Missing success evidence must fail closed rather than restore a generic blocker.');
check(parseBrimhavenDetachedFloorSpikeVariants({...input,guidePage:{...guidePage,content:guidePage.content.replace('20–47','21–47')}}).length===0,'A guide band that conflicts with the obstacle entry requirement must fail closed.');
check(parseBrimhavenDetachedFloorSpikeVariants({...input,arenaPage:{...arenaPage,content:arenaPage.content.replace('|4 t','|5 t')}}).length===0,'A table timing/XP-per-tick contradiction must fail closed.');
check(parseBrimhavenDetachedFloorSpikeVariants({...input,obstaclePage:{...obstaclePage,content:obstaclePage.content.replace('|xp2 = 26.4','|xp2 = 26.5')}}).length===0,'A glove XP contradiction must fail closed.');
const at34=evaluateSkillingSuccessAtBaseLevel(successEvidence[0].success_probability_model,34),at50=evaluateSkillingSuccessAtBaseLevel(successEvidence[0].success_probability_model,50);
check(at34.status==='blocked_incomplete_probability_model'&&at34.blocker==='success_interpolation_low_high_parameters_not_published','The account query must derive the missing parameter blocker at evaluation time.');
check(at50.status==='source_failure_free_threshold'&&at50.failureProbability===0,'The same reusable evidence must establish zero failure at the source threshold.');
const parameterizedObstacle={...obstaclePage,content:obstaclePage.content.replace('[[Category:Needs skilling success chart]]','{{Skilling success chart|req1=20|low1=32|high1=192}}')},parameterizedEvidence=parseBrimhavenFloorSpikeSuccessEvidence({obstaclePage:parameterizedObstacle,formulaPage});
check(parameterizedEvidence.every(row=>row.state==='candidate'&&row.success_probability_model?.parameterStatus==='ready'&&evaluateSkillingSuccessAtBaseLevel(row.success_probability_model,34).successProbability===87/256),'Revision-pinned low/high inputs must remain reusable and calculate only at query time.');
const mismatchedRequirement=parseBrimhavenFloorSpikeSuccessEvidence({obstaclePage:{...parameterizedObstacle,content:parameterizedObstacle.content.replace('req1=20','req1=21')},formulaPage});
check(mismatchedRequirement.every(row=>row.state==='blocked'&&row.success_probability_model?.blocker==='success_interpolation_requirement_does_not_match_obstacle_entry'),'A chart requirement that conflicts with obstacle entry must remain an explicit blocker.');
const conflictingMarker=parseBrimhavenFloorSpikeSuccessEvidence({obstaclePage:{...parameterizedObstacle,content:`${parameterizedObstacle.content}\n[[Category:Needs skilling success chart]]`},formulaPage});
check(conflictingMarker.every(row=>row.state==='blocked'&&row.success_probability_model?.blocker==='success_chart_conflicts_with_needs_chart_marker'),'Published parameters and a simultaneous missing-chart marker must fail closed as contradictory evidence.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Brimhaven floor-spike training variant checks passed.');
