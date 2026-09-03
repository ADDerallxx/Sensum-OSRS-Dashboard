import {agilityPyramidCompletionBonus,agilityPyramidLapXp} from '../formulas/agility-pyramid-v1.mjs';
import {parseAgilityPyramidEarlyLevelVariant} from '../ingestion/agility-pyramid-variant-lib.mjs';

const course=`The only requirement for this course is level 30 [[Agility]]. However, the fail rate for the obstacles is rather high at that level, sometimes making it feel almost impossible to reach the top.
[[Stone block (Agility Pyramid)|Stone block]]||12||5{{+=|xp|12*5}}
[[Low wall (Agility Pyramid)|Low wall]]||8||5{{+=|xp|8*5}}
[[Ledge (Agility Pyramid)|Ledge]]||52||4{{+=|xp|52*4}}
[[Pyramid block (Agility Pyramid)|Pyramid block]]||0||2{{+=|xp|0*2}}
[[Plank (Agility Pyramid)|Plank]]||56.4||2{{+=|xp|56.4*2}}
[[Gap (Agility Pyramid)#Cross|Gap]]||56.4||3{{+=|xp|56.4*3}}
[[Gap (Agility Pyramid)#Jump|Gap]]||22||6{{+=|xp|22*6}}
!Completion bonus
!<math>300 +Agility \\ level \\times 8</math><ref>Bonus experience is rewarded for completing the course. The maximum bonus experience is capped at 1,000 at level 88 and higher. [[Temporary skill boost]]s do not affect the bonus experience.</ref>
Due to not knowing the exact fail rates of obstacles for other Agility levels, it is hard to predict the experience rates for players with lower Agility levels.`;
const guide='Roughly 13 completions can be made per hour at early levels (30-50), for {{NoCoins|130000}} gp/hour and 25,000 experience per hour.';
const rows=parseAgilityPyramidEarlyLevelVariant({courseContent:course,guideContent:guide,courseSource:{sourceRevision:'course-rev',sourceTimestamp:'2026-01-01T00:00:00Z',sourceUrl:'https://example.test/course'},guideSource:{sourceRevision:'guide-rev',sourceTimestamp:'2026-01-02T00:00:00Z',sourceUrl:'https://example.test/guide'}}),row=rows[0],failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
check(rows.length===1&&row.base_agility_level_minimum===30&&row.base_agility_level_maximum===50,'The early-level benchmark must remain scoped to levels 30–50.');
check(row.observational_benchmark_only===true&&row.outcome_integrated_in_observed_rate===true&&row.observed_xp_per_hour===25000&&row.observed_laps_per_hour===13,'The source benchmark must remain observed and failure-inclusive.');
check(row.failure_possible===true&&row.failure_probability_published===false&&row.failure_qualifier==='exact_lower_level_fail_rates_unknown','Unknown lower-level failure rates must not become a synthetic probability.');
check(row.static_obstacle_xp_total===722&&row.completion_bonus_formula?.temporary_boosts_affect_bonus===false,'Obstacle XP and base-level completion-bonus semantics must remain separate.');
check(agilityPyramidCompletionBonus(34)===572&&agilityPyramidLapXp({baseAgility:34})===1294,'The revision-pinned reward formula must produce 1,294 XP for a successful base-level-34 lap.');
check(agilityPyramidCompletionBonus(88)===1000&&agilityPyramidCompletionBonus(99)===1000,'The completion bonus must cap at 1,000 XP from base level 88.');
check(row.source_revision==='course-rev'&&row.supporting_evidence?.source_revision==='guide-rev','Both official source revisions must survive ingestion.');
check(row.observed_rate_source_revision==='guide-rev'&&row.observed_rate_source_locator?.evidence?.[0]?.excerpt?.includes('25,000'),'The hourly observation must point to its guide revision rather than the course-mechanics page.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Agility Pyramid variant and formula checks passed.');
