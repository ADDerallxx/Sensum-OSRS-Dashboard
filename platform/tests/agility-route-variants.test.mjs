import {parseAgilityRouteVariants} from '../ingestion/agility-route-variant-lib.mjs';
const meta=title=>({title,sourceRevision:'1',sourceTimestamp:'2026-01-01',sourceUrl:'https://example.test'});
const dorgesh=`The course is available to players with level 70 [[Agility]]. Completion of the [[quest]] [[Death to the Dorgeshuun]] is also required. Optionally, level 70 [[Strength]] and [[Ranged]] (in addition to 70 Agility), are required to traverse the grapple route. The player also has to bring a [[Light sources|light source]].
bring any [[Crossbow (weapon)|crossbow]], as well as multiple [[mith grapple]]s, since there is a 1/25 chance of the grapple being destroyed upon usage.
The Agility route back and forth takes 2:36 minutes.
The grapple route back and forth takes 1:30 minutes.
A combination of both routes takes 2:03 minutes.
Delivery bonus
|{{SCP|Agility|2,432}}
! colspan=2 |Total
!{{SCP|Agility|2,750}}
Delivery bonus
|{{SCP|Ranged|1,142}}
! colspan=2 |Total
!{{SCP|Agility|108}}<br/>{{SCP|Ranged|1,250}}<br/>{{SCP|Strength|108}}
When following the Agility route back and forth at level 99, expect to be able to complete a maximum of 23 laps per hour resulting in 63,000 Agility experience per hour.
When following the grapple route back and forth, expect to be able to complete a maximum of 40 laps per hour resulting in 50,000 Ranged experience, 4,300 Agility experience, and 4,300 Strength experience per hour.
When following the grapple route one way and the Agility route at level 99 the other way, expect to be able to complete a maximum of 29 laps per hour resulting in 41,000 Agility experience, 18,000 Ranged experience, and 1,500 Strength experience per hour.`;
const skullball=`You must have an Agility level of 25, completed the [[Creature of Fenkenstrain]] [[quest]], and be wearing a [[Ring of Charos]].
You will gain 750 [[Agility]] experience if you complete the game in under 4 minutes. For every 3 seconds over 4 minutes, you'll lose 8 experience.
Run recommended route
|2:20 - 2:45
|750
|-
|Walk recommended route
|2:45 - 3:15
|750
|-
|Unplanned scramble
|3:00 - 3:49
|750
== Optimal route ==
With more effort, times as fast as 1:45 can be achieved.`;
const rows=[...parseAgilityRouteVariants({...meta('Dorgesh-Kaan Agility Course'),content:dorgesh}),...parseAgilityRouteVariants({...meta('Werewolf Skullball'),content:skullball})],failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
check(rows.length===7,'Two route families must emit seven independent variants.');
const grapple=rows.find(x=>x.variant_key==='grapple_both_ways'),mixed=rows.find(x=>x.variant_key==='mixed'),walk=rows.find(x=>x.variant_key==='recommended_walk'),optimal=rows.find(x=>x.variant_key==='optimal_run');
check(grapple?.skill_requirements?.Ranged===70&&grapple.requirements.includes('Mith grapple'),'Grapple eligibility must remain independent and explicit.');
check(grapple?.xp_per_lap_by_skill?.Ranged===1250&&grapple.observed_xp_per_hour_by_skill?.Agility===4300,'Multi-skill rewards and observed rates must remain separated.');
check(mixed?.xp_per_lap_by_skill===null&&mixed.mechanical_reward_blocker,'The mixed route must not invent an unstated per-lap reward vector.');
check(walk?.cycle_seconds===null&&walk.cycle_seconds_range?.minimum===165&&walk.cycle_seconds_range?.maximum===195,'Approximate Wiki time ranges must remain ranges.');
check(optimal?.cycle_seconds===null&&optimal.cycle_seconds_observed_peak===105&&optimal.observed_peak_not_typical===true,'The optimal-route peak must not become a typical cycle time.');
check(rows.every(x=>x.source_locator?.evidence?.length&&x.source_revision),'Every route variant must retain revision-bound source locators.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Agility route variant checks passed.');
