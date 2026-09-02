import {parseHallowedEquipmentModifiers} from '../ingestion/hallowed-equipment-modifier-lib.mjs';
const source=`The area contains [[magical obelisk]]s, which will restore the player's run energy if a [[Saradomin item]] is equipped.
Running into a trap will teleport the player, costing time. This deals a small amount of damage unless the [[hallowed ring]] is equipped.
Having a [[lockpick]] in the player's inventory will increase the chance of success when opening coffins. A [[strange old lockpick]] will give an even better chance of successfully looting, and will not use any charges.
* [[Bridge (Hallowed Sepulchre)|Broken bridges]] - Must be built using a [[saw]], [[hammer]], 2 planks, and 5 nails. A [[crystal saw]] can be used and its invisible [[boost]] works as well. It is possible to fail and bend the nails, though using a [[hallowed hammer]] will remove the failure chance.
**2 [[plank]]s and 5 [[steel nails]]: awards 150 [[Construction]] experience
**2 [[oak plank]]s and 5 [[mithril nails]]: awards 300 [[Construction]] experience
**2 [[teak plank]]s and 5 [[adamantite nails]]: awards 450 [[Construction]] experience
**2 [[mahogany plank]]s and 5 [[rune nails]]: awards 700 [[Construction]] experience
* [[Saradomin brazier]] - Blocks coffins. The barrier is unlocked by sacrificing two [[vampyre dust]], rewarding 200 [[Prayer]] experience. Only one vampyre dust is required when wearing a [[Hallowed symbol]].
* [[Portal frame]] - Must be activated using [[enchantment spells]] from the [[standard spellbook]], all rewarding the same 200 [[Magic]] experience. It will automatically use the highest level enchantment spell. The enchantment can be failed twice, after which the portal will be broken and impassable. Holding the [[hallowed focus]] will remove the possibility of failure, and causes the player to use the lowest level enchantment spell.
**{{SCP|Magic|7|link=yes}}: LvL-1 Enchant: 1 [[Cosmic rune]], 1 [[Water rune]]
**{{SCP|Magic|27|link=yes}}: Lvl-2 Enchant: 1 [[Cosmic rune]], 3 [[Air rune]]s
**{{SCP|Magic|49|link=yes}}: Lvl-3 Enchant: 1 [[Cosmic rune]], 5 [[Fire rune]]s
**{{SCP|Magic|57|link=yes}}: Lvl-4 Enchant: 1 [[Cosmic rune]], 10 [[Earth rune]]s
**{{SCP|Magic|68|link=yes}}: Lvl-5 Enchant: 1 [[Cosmic rune]], 15 [[Water runes]], 15 [[Earth runes]]
**{{SCP|Magic|87|link=yes}}: Lvl-6 Enchant: 1 [[Cosmic rune]], 20 [[Earth runes]], 20 [[Fire runes]]
**{{SCP|Magic|93|link=yes}}: Lvl-7 Enchant: 1 [[Cosmic rune]], 20 [[Blood rune]]s, 20 [[Soul rune]]s
* [[Pillar (Hallowed Sepulchre)|Pillars]] - Must be grappled using a [[crossbow]] and [[mith grapple]]. There is a chance of failure unless the [[hallowed grapple]] is used instead.
If players are finding they regularly fail obstacles, purchase the [[hallowed ring]]; otherwise, the [[hallowed grapple]] saves more time overall.
|{{plinkt|Hallowed grapple}}
|{{Currency|Hallowed mark|100}}
|Always succeeds.
|-
|{{plinkt|Hallowed focus}}
|{{Currency|Hallowed mark|100}}
|Guarantees portals.
|-
|{{plinkt|Hallowed symbol}}
|{{Currency|Hallowed mark|100}}
|Halves sacrifices.
|-
|{{plinkt|Hallowed hammer}}
|{{Currency|Hallowed mark|100}}
|Never breaks nails.
|-
|{{plinkt|Hallowed ring}}
|{{Currency|Hallowed mark|250}}
|Prevents damage, reducing the time penalty, and eliminating the need to bring food.
|-`;
const rows=parseHallowedEquipmentModifiers({title:'Hallowed Sepulchre',content:source,sourceRevision:'15322138',sourceTimestamp:'2026-08-27T17:27:38Z',sourceUrl:'https://example.test'}),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},get=key=>rows.find(x=>x.variant_key===key);
check(rows.length===13,'Hallowed equipment must emit all encounter requirements and equipment modifiers.');
check(rows.every(x=>['composable_modifier','encounter_requirement'].includes(x.record_kind)&&x.axis_coverage.includes('equipment_modifier')),'Equipment records must be composable non-method records.');
check(get('bridge_standard_requirements')?.resource_alternatives?.length===4&&get('bridge_standard_requirements').resource_alternatives[3].xp_by_skill.Construction===700,'All bridge material tiers must remain independent.');
check(get('portal_standard_requirements')?.spell_alternatives?.length===7&&get('portal_standard_requirements').failure_policy.maximum_failures_before_impassable===2,'All portal spell options and the failure limit must remain explicit.');
check(get('portal_standard_requirements').spell_alternatives[4].inputs.some(x=>x.item==='Water rune'&&x.source_item_title==='Water runes'),'Plural Wiki link targets must normalize to canonical items while retaining the source title.');
check(get('brazier_hallowed_symbol')?.effect?.resource_replacement?.baseline_quantity===2&&get('brazier_hallowed_symbol').effect.resource_replacement.modified_quantity===1,'The symbol resource reduction must retain its baseline.');
check(get('traps_hallowed_ring')?.effect?.numeric_time_delta===null&&get('coffin_lockpick')?.effect?.numeric_delta===null,'Qualitative effects must not become invented numeric bonuses.');
check(get('pillar_hallowed_grapple')?.effect?.success_chance===1&&get('portal_hallowed_focus')?.effect?.selection_policy==='lowest_usable_enchantment','Guaranteed equipment effects must retain encounter-specific behavior.');
check(rows.every(x=>x.source_locator?.evidence?.length&&x.state==='candidate'),'Every Hallowed equipment record must remain revision-located and unapproved.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Hallowed equipment modifier checks passed.');
