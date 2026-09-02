import {parseAgilityShortcutVariants} from '../ingestion/agility-shortcut-variant-lib.mjs';
const content=`The '''Prifddinas Agility Course''' is an Agility course available to players with 75 [[Agility]] who have completed the [[Song of the Elves]] [[quest]].
The course becomes impossible to fail at level 91 Agility.
The course is unique in that [[Portal|portals]], which act as shortcuts, appear at various points. There are a total of 6 possible unique portal locations, and only one can appear per lap. Using these shortcuts, which spawn randomly for each player, slightly increases experience.
Portal shortcuts bring the lap duration down by around 5–10 seconds depending on the location. Using a portal grants 82 experience and, on average, adds an additional 55.4 experience per lap.
The average lap duration is about 1:14, with the fastest possible completion time without exploits being 1:03.60, and the world record being 0:58.20. The time of 1:03.60 can only be achieved by standing by the bank, and getting the portal spawn on top of the bank. When running to this tile instead, the climbing animation takes an additional [[tick]], resulting in a time of 1:04.20.
Players can expect to find roughly 45 [[crystal shard]]s per hour (0.94 shard per lap), with each portal providing one shard.
{{+=|xp|11.5|echo=2}}{{+=|xp|30.7|echo=2}}{{+=|xp|28.1|echo=2}}{{+=|xp|23.0|echo=2}}{{+=|xp|11.5|echo=2}}{{+=|xp|0|echo=2}}{{+=|xp|25.6|echo=2}}{{+=|xp|30.7|echo=2}}{{+=|xp|25.6|echo=2}}{{+=|xp|30.7|echo=2}}{{+=|xp|30.7|echo=2}}{{+=|xp|1037.1|echo=2}}
Total
! {{#var:xp}}<br/>~{{#expr:{{#var:xp}}+55.4}} with portals
The Agility Course experience rates have been increased from 56,000 experience per hour at level 90 when not using shortcuts and 62,000 experience per hour when using shortcuts to 60,000 and 66,000, respectively.`;
const rows=parseAgilityShortcutVariants({title:'Prifddinas Agility Course',content,sourceRevision:'15322180',sourceTimestamp:'2026-08-27',sourceUrl:'https://example.test'}),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
check(rows.length===3,'Prifddinas must emit no-portal, random-portal, and best-spawn peak variants.');
const none=rows.find(x=>x.variant_key==='no_portal'),portal=rows.find(x=>x.variant_key==='use_random_portal'),peak=rows.find(x=>x.variant_key==='best_portal_spawn_peak');
check(none?.xp_per_lap===1285.2&&none.observed_xp_per_hour===60000,'No-portal XP and observed level-90 rate must remain separate and exact.');
check(portal?.xp_per_lap_expected===1340.6&&portal.portal_time_saved_seconds_range?.minimum===5&&portal.portal_time_saved_seconds_range?.maximum===10,'Portal expected XP and time-saving range must remain explicit.');
check(none?.cycle_seconds===null&&portal?.cycle_seconds===null&&none?.unassigned_observed_average_seconds===74,'The unscoped 1:14 average must not be assigned to either portal policy.');
check(peak?.cycle_seconds===null&&peak.cycle_seconds_observed_peak===63.6&&peak.observed_peak_not_typical===true,'Best-spawn timing must remain a conditional peak.');
check(peak?.xp_per_lap===null&&peak.mechanical_reward_blocker,'Unknown spawn-specific peak XP must remain blocked.');
check(rows.every(x=>x.axis_coverage.includes('random_shortcut')&&x.source_locator?.evidence?.length),'Every shortcut variant must cover the audited axis and retain evidence.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Agility shortcut variant checks passed.');
