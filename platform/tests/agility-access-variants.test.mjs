import {parseAgilityAccessVariants} from '../ingestion/agility-access-variant-lib.mjs';
const sources={
  'Ape Atoll Agility Course':`The '''Ape Atoll Agility Course''' is available to players with level 48 [[Agility]] (cannot be [[Temporary skill boost|boosted]]). Access requires partial completion of [[Monkey Madness I]], up to Chapter 2.
To use the agility course, the player has to wear either the [[Ninja monkey greegree (small)|small]] or [[Ninja monkey greegree (medium)|medium-sized]] ninja monkey greegree or the [[Kruk monkey greegree]]. Attempting any obstacle without a ninja or Kruk greegree equipped will result in the player automatically failing the course.
The agility course rewards 580 [[Agility]] [[experience]] per completed lap. It is possible to get upwards of 55,200 [[Agility]] experience per hour.
The chance of successfully passing the obstacles scales with the player's [[Agility]] level, where obstacles can no longer be failed after reaching level 75.
Take a large number of [[summer pie]]s or [[agility potion]]s (at levels 70 and 72, respectively) to maintain a boosted [[Agility]] level of at least 75. Therefore, it is recommended to have at least level 72 to use summer pies and 73 for agility potions.
At level 75 and higher, expect a maximum of 95 laps per hour (63 [[Game tick|ticks]] per lap), resulting in 55,100 [[Agility]] experience per hour.`,
  'Penguin Agility Course':`The '''Penguin Agility Course''' is available to players with boosted level 30 [[Agility]] and partial completion of [[Cold War]]. To access the Agility course, the player has to wear a [[clockwork suit]].
The Agility course rewards 540 Agility [[experience]] per completed lap. With an average time of 65 seconds per lap, it is possible to get upwards of 30,000 Agility experience per hour. At lower Agility levels expect to get around 22,000–27,000 Agility experience per hour.
Players need to transform into a penguin by talking to Larry with a [[clockwork suit]] in the inventory and choosing the "Tuxedo-time" option.
Even at level 99 the player is not safe from failing all of these obstacles.
The [[cape slot]] should be empty while transforming into a penguin, since the clockwork suit needs to go into that slot.`,
  'Werewolf Agility Course':`The '''Werewolf Agility course''' is available to players with level 60 [[Agility]]. Access requires completion of [[Creature of Fenkenstrain]]. To access the Agility course, the player has to wear a [[Ring of Charos]].
The Agility course rewards 730 Agility [[experience]] per completed lap, assuming the player hands in the [[Stick (item)|stick]] every time. With an average time of 38 seconds per lap, it is possible to train.
With level 80 in Agility and [[Strength]] and a weight of 2 kg or lower, this obstacle will never be failed.
At level 80 and higher expect a maximum of 94 laps per hour (~63.62 [[RuneScape clock|tick]]s per lap, assuming an even distribution of stick spawns), resulting in 68,600 Agility experience per hour.`
};
const parse=title=>parseAgilityAccessVariants({title,content:sources[title],sourceRevision:'test-revision',sourceTimestamp:'2026-09-02T00:00:00Z',sourceUrl:'https://example.test'}),ape=parse('Ape Atoll Agility Course'),penguin=parse('Penguin Agility Course'),werewolf=parse('Werewolf Agility Course'),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
check(ape.length===3,'Ape Atoll must emit natural, summer-pie, and agility-potion policies.');
check(ape.every(x=>x.equipment_requirement?.items?.length===3&&x.entry_level===48&&x.entry_boostable===false),'Every Ape policy must retain all greegree alternatives and the unboostable entry requirement.');
check(ape.find(x=>x.variant_key==='summer_pie_to_75')?.base_agility_level_minimum===70&&ape.find(x=>x.variant_key==='summer_pie_to_75')?.recommended_base_agility_level===72,'Summer-pie feasible and recommended base levels must remain distinct.');
check(ape.find(x=>x.variant_key==='agility_potion_to_75')?.boost_source?.agility_bonus===3&&ape.find(x=>x.variant_key==='agility_potion_to_75')?.effective_agility_level_minimum===75,'Agility potion base and effective level conditions must remain explicit.');
check(ape.every(x=>x.source_warning==='conflicting_page_rate_55200_vs_55100'&&x.source_rate_conflict?.resolution==='unresolved'),'The Ape Atoll rate contradiction must block verification.');
check(penguin.length===1&&penguin[0].entry_boostable===true&&penguin[0].boost_source_unspecified_by_page===true&&penguin[0].failure_persists_through_agility_level===99,'Penguin access must not invent a base level, boost source, or failure-free threshold.');
check(penguin[0]?.equipment_requirement?.items?.[0]==='Clockwork suit'&&penguin[0]?.requirements?.includes('Empty cape slot while transforming'),'Penguin transformation equipment state must remain explicit.');
check(werewolf.length===1&&werewolf[0].equipment_requirement?.items?.[0]==='Ring of Charos','Werewolf access must retain the Ring of Charos requirement.');
check(werewolf[0]?.failure_free_condition?.all_of?.length===3&&werewolf[0]?.observed_xp_per_hour===68600,'Werewolf no-failure conditions must remain conjunctive and rate-scoped.');
check([...ape,...penguin,...werewolf].every(x=>x.source_locator?.evidence?.length&&x.state==='candidate'),'Every access variant must remain revision-located and unapproved.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Agility access variant checks passed.');
