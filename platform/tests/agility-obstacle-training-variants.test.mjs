import {parseAgilityObstacleTrainingVariants} from '../ingestion/agility-obstacle-training-variant-lib.mjs';

const source=`{| class="wikitable"
|-
!Image
!Obstacle
!Level Required
!Experience
!Description
|-
|[[File:Balancing ledge.png]]
|[[Balancing ledge (Test Dungeon)|Balancing Ledge]]
|40
| {{SCP|Agility|22.5}}
|If failed, the player falls.
At level 40, players have around a 71% chance of successfully crossing the balance ledge, and will stop failing entirely at level 64.

After level 64, clicking the ledge without moving the camera is an [[idle]] training method with rates of up to 15,000 experience per hour.
|-
|[[File:Monkeybars.png]]
|[[Monkeybars (Test Dungeon)|Monkeybars]]
|57
|{{SCP|Agility|20}}
|No idle rate is stated.
|}`;
const input={title:'Test Dungeon',content:source,sourceRevision:'15267053',sourceTimestamp:'2026-07-18',sourceUrl:'https://example.test'};
const rows=parseAgilityObstacleTrainingVariants(input),row=rows[0],failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
check(rows.length===1,'Only an obstacle with a source-stated repeatable training claim may become a variant.');
check(row?.entry_level===40&&row?.failure_free_level===64&&row?.observed_rate_minimum_level===64,'Entry, failure-free, and observed-rate levels must remain distinct.');
check(row?.xp_per_success===22.5&&row?.observed_xp_per_hour===15000&&row?.action_unit==='obstacle_crossing','The table XP and prose hourly rate must retain their original units.');
check(row?.source_revision==='15267053'&&row?.source_locator?.tableRow&&row?.source_locator?.success&&row?.source_locator?.observedRate,'Every joined fact must retain revision-pinned locators.');
const ambiguous=source.replace('[[Monkeybars (Test Dungeon)|Monkeybars]]','[[Second ledge (Test Dungeon)|Ledge]]');
check(parseAgilityObstacleTrainingVariants({...input,content:ambiguous}).length===0,'Ambiguous obstacle names must fail closed.');
const mismatched=source.replace('After level 64','After level 63');
check(parseAgilityObstacleTrainingVariants({...input,content:mismatched}).length===0,'A rate level that contradicts the failure-free threshold must fail closed.');
const shortcut=`The '''monkeybars''' is an Agility shortcut. An Agility level of 15 is required to traverse these monkey bars. Some people use the monkey bars as a low-intensity way to train Agility. This obstacle can not be failed. Players can gain up to 13,000 experience per hour.
Be aware that the monkey bars are located in the Wilderness, and the player may be attacked by other players.
{{Agility info
|name = Monkey bars
|level = 15
|xp = 20
|type = Shortcut
}}
== Motionless training ==
Players can set a "motionless" training method, requiring no camera rotation or mouse movement.`;
const shortcutRows=parseAgilityObstacleTrainingVariants({title:'Monkeybars (Edgeville Dungeon)',content:shortcut,sourceRevision:'15161382',sourceTimestamp:'2026-03-30',sourceUrl:'https://example.test/edgeville'}),shortcutRow=shortcutRows[0];
check(shortcutRows.length===1&&shortcutRow?.standalone_training_method===true,'A complete shortcut training source must emit a standalone candidate.');
check(shortcutRow?.entry_level===15&&shortcutRow?.xp_per_success===20&&shortcutRow?.failure_free_level===15&&shortcutRow?.observed_xp_per_hour===13000,'Shortcut eligibility, action XP, failure behavior, and observed rate must remain source-bound.');
check(shortcutRow?.risk_context?.includes('Wilderness')&&shortcutRow?.cycle_ticks===null,'Wilderness risk must be explicit and unstated cycle timing must remain null.');
check(parseAgilityObstacleTrainingVariants({title:'Monkeybars (Edgeville Dungeon)',content:shortcut.replace('|level = 15','|level = 16'),sourceRevision:'1'}).length===0,'Conflicting narrative and template levels must fail closed.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Agility obstacle-training variant checks passed.');
