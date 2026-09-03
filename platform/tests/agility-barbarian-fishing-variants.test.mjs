import {parseBarbarianFishingVariants} from '../ingestion/agility-barbarian-fishing-variant-lib.mjs';
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const fish=(title,fishing,strength,agility,fishXp,otherXp,low,high,index)=>({title,sourceRevision:String(100+index),sourceUrl:`https://example.test/${index}`,content:`'''${title}''' is a fish which requires ${fishing} [[Fishing]], ${strength} [[Strength]], and ${agility} [[Agility]] to be caught, providing ${fishXp} Fishing experience, ${otherXp} Strength experience, and ${otherXp} Agility experience.
The order in which bait is consumed from the inventory is: [[fish offcuts]], [[fishing bait]], [[Feather|feathers]], [[roe]], then [[caviar]].
{{Skilling success chart|label=Barbarian rod fishing chance|cascade=yes|showbefore=no
|label1=Leaping sturgeon|low1=8|high1=64|req1=70
|label2=Leaping salmon|low2=16|high2=96|req2=58
|label3=Leaping trout|low3=32|high3=192|req3=48
}}`});
const rateRows=[[48,23000,2300,27600,41000,4100,5400,54600],[58,37000,3400,43800,68000,6300,9300,89900],[70,48000,4400,56800,90000,8200,13800,120200],[80,52000,4700,61400,97000,8800,14800,129400],[90,54000,4900,63800,103000,9300,15800,137400],[99,57000,5200,67400,108000,9800,16800,144400]].map(row=>`|-\n|${row.join('\n|')}`).join('\n');
const fishTable=`|{{plinkt|Leaping trout}}\n|48||15||15||0\n|50||5||5||10||70\n|-\n|{{plinkt|Leaping salmon}}\n|58||30||30||0\n|70||6||6||10||92\n|-\n|{{plinkt|Leaping sturgeon}}\n|70||45||45||0\n|80||7||7||15||109`;
const training={title:'Barbarian Training',sourceRevision:'15292392',sourceUrl:'https://example.test/training',content:`{{Needed|[[Barbarian rod]] or the equipable version, the [[Pearl barbarian rod]]. Also, [[Fishing bait]], [[feathers]], [[fish offcuts]], [[roe]] or [[caviar]]|recommended=[[Knife]]|skills={{SCP|Fishing|48|link=yes}}, {{SCP|Agility|15|link=yes}}, {{SCP|Strength|15|link=yes}}}}
Use the rod at the [[Fishing spot (barbarian)|fishing spots]] in the lake to catch [[leaping trout]], [[leaping salmon]], or [[leaping sturgeon]]. This is a [[Idle training|low-effort]] training method that also grants [[Strength]] and [[Agility]] experience.
${fishTable}\n${rateRows}`};
const guide={title:'Pay-to-play Fishing training',sourceRevision:'15327367',sourceUrl:'https://example.test/guide',content:`The best spot for Barbarian Fishing is at the pond next to the [[Otto's Grotto]].
The basic method for 3-tick fishing is to drop the fish between catches. To do so, start the 3-tick cycle, drop the fish using shift drop, and click on the fishing spot. This requires accurate clicking and some practice to perform consistently.
"Cut-eat" or "eat-cut" fishing is more advanced. Having at least level 80 Cooking is recommended for a 100% cut rate. Cut-eat fishing is done by starting a 3-tick cycle with herb and tar, cutting the fish with a knife and eating the roe/caviar to tick manipulate. It is less predictable due to randomness being involved.
The experience rates shown in the table below assume the player is not wearing the [[angler's outfit]]. The AFK rates include the time spent dropping the fish, and the actual rates vary. The Cooking rates from using the cut-eat method assumes level 99 Cooking.
${rateRows}`};
const formula={title:'Module:Skilling success chart',sourceRevision:'15325744',sourceUrl:'https://example.test/formula',content:`function p.interp(low, high, level)\nlocal value = math.floor(low*(99-level)/98 + high*(level-1)/98 + 0.5) + 1\nreturn math.min(math.max(value / 256, 0), 1)\nend\nfunction cascadeInterp(bounds, level, index)\nlocal rate = 1.0\nrate = rate * (1 - p.interp(low, high, level))`};
const pages=[training,guide,formula,fish('Leaping trout',48,15,15,50,5,32,192,1),fish('Leaping salmon',58,30,30,70,6,16,96,2),fish('Leaping sturgeon',70,45,45,80,7,8,64,3)],rows=parseBarbarianFishingVariants({pages}),get=key=>rows.find(row=>row.variant_key===key);
check(rows.length===18,'Six Fishing benchmarks crossed with three interaction policies must emit eighteen variants.');
check(get('afk_fishing_48')?.skill_requirements?.Agility===15&&get('afk_fishing_58')?.skill_requirements?.Agility===30&&get('afk_fishing_70')?.skill_requirements?.Agility===45,'Fish unlocks must raise Agility and Strength requirements at the exact benchmark.');
check(get('afk_fishing_48')?.observed_xp_per_hour===2300&&get('three_tick_drop_fishing_58')?.observed_xp_per_hour===6300,'Agility rates must remain separate from Fishing and total XP.');
check(get('three_tick_cut_eat_fishing_58')?.skill_requirements?.Cooking===99&&get('three_tick_cut_eat_fishing_58')?.observed_xp_per_hour_by_skill?.Cooking===9300,'Cut-eat Cooking rates must retain their level-99 benchmark condition.');
check(get('three_tick_drop_fishing_48')?.cycle_ticks===3&&get('afk_fishing_48')?.cycle_ticks===null,'Three-tick timing must not be copied onto the AFK method.');
check(get('afk_fishing_48')?.cycle_timing_blocker==='afk_catch_attempt_cycle_including_drop_time_not_published','The missing AFK attempt cycle must remain an exact source-evidence blocker.');
check(get('afk_fishing_48')?.observed_rate_condition_scope?.skill==='Fishing'&&get('afk_fishing_48')?.observed_rate_condition_scope?.minimum===48&&get('afk_fishing_48')?.observed_rate_condition_scope?.maximum===48,'The AFK table rate must remain scoped to its exact Fishing benchmark level.');
check(get('afk_fishing_48')?.observed_rate_condition_scope?.angler_outfit===false&&get('afk_fishing_48')?.observed_rate_condition_scope?.dropping_time_included===true&&get('afk_fishing_48')?.observed_rate_condition_scope?.drop_speed_affects_rate===true,'AFK equipment, dropping-time, and player-speed conditions must remain machine readable.');
check(get('afk_fishing_48')?.observed_rate_kind==='source_table_afk_benchmark'&&get('afk_fishing_48')?.observed_rate_approximate===true&&get('afk_fishing_48')?.observed_rate_source_revision==='15292392','The rounded AFK table value must remain revision-bound observational evidence, not a calculated rate.');
check(get('afk_fishing_48')?.observed_rate_source_locator?.corroboratingRateTable?.sourceRevision==='15327367'&&get('afk_fishing_48')?.observed_rate_source_locator?.rateAssumptions?.excerpt?.includes('dropping'),'Both agreeing rate tables and the guide assumptions must remain attached.');
check(rows.every(row=>row.catch_probability_formula?.source_revision==='15325744'&&row.xp_per_attempt>0&&row.failure_model_required===false),'Catch probabilities and expected XP must use the pinned Wiki module formula.');
check(Math.abs(get('afk_fishing_48').catch_probabilities.find(row=>row.key==='leaping trout').probability-110/256)<1e-12,'The level-48 trout probability must retain the Wiki module rounding result.');
const changedGuide={...guide,content:guide.content.replace('|2300\n|27600','|2400\n|27600')};
check(parseBarbarianFishingVariants({pages:pages.map(page=>page.title===guide.title?changedGuide:page)}).length===0,'Conflicting rate tables must fail closed.');
const troutPage=pages.find(page=>page.title==='Leaping trout'),changedFish={...troutPage,content:troutPage.content.replace('50 Fishing experience','51 Fishing experience')};
check(parseBarbarianFishingVariants({pages:pages.map(page=>page.title===changedFish.title?changedFish:page)}).length===0,'Conflicting fish rewards must fail closed.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Barbarian Fishing variant checks passed.');
