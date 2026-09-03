import {parseBrimhavenDetachedFloorSpikeVariants} from '../ingestion/agility-floor-spike-training-variant-lib.mjs';
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const obstaclePage={title:'Floor spikes (Brimhaven Agility Arena)',sourceRevision:'15201362',sourceTimestamp:'2026-04-29',sourceUrl:'https://example.test/floor-spikes',content:`Failing to jump across the spikes successfully will cause the player to take damage. Players will no longer fail this obstacle at level 50 [[Agility]].
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
}}`};
const arenaPage={title:'Brimhaven Agility Arena',sourceRevision:'15293118',sourceTimestamp:'2026-08-11',sourceUrl:'https://example.test/brimhaven',content:`The course has no requirements to access other than a 200 [[coins]] fee.
level 20 Agility is required to pass the [[pressure pad (Brimhaven Agility Arena)|pressure pad]] and [[Floor spikes (Brimhaven Agility Arena)|floor spike]] obstacles.
*Wear [[Karamja gloves 2]], [[Karamja gloves 3|3]], or [[Karamja gloves 4|4]] for 10% extra Agility experience from obstacles in the Brimhaven Agility Arena.
|[[Floor spikes (Brimhaven Agility Arena)|Floor spikes]]
|24 (26.4)
|4 t
|6
|-
|20`};
const guidePage={title:'Agility training',sourceRevision:'15324367',sourceTimestamp:'2026-08-29',sourceUrl:'https://example.test/agility-guide',content:`Additionally, the floor spike obstacle can be used, which is very low intensity and can achieve approximately 36,000 experience per hour. Using the "Detached Camera" plugin`};
const input={obstaclePage,arenaPage,guidePage},rows=parseBrimhavenDetachedFloorSpikeVariants(input),standard=rows.find(row=>row.variant_key==='detached_floor_spikes_standard'),gloves=rows.find(row=>row.variant_key==='detached_floor_spikes_karamja_gloves');
check(rows.length===2&&rows.every(row=>row.standalone_training_method===true),'A complete three-page evidence set must emit standard and glove variants.');
check(rows.every(row=>row.contract==='sensum.agility-floor-spike-training-variant.v1'),'Floor-spike variants must use the contract that permits only an explicitly unscoped observed-rate claim.');
check(standard?.entry_level===20&&standard?.xp_per_success===24&&standard?.cycle_ticks===4&&standard?.failure_free_level===50,'Standard floor-spike mechanics and thresholds must remain source-bound.');
check(gloves?.xp_per_success===26.4&&gloves?.equipment_requirement?.items?.length===3,'The Karamja glove bonus must remain an explicit equipment variant.');
check(rows.every(row=>row.unmodeled_level_ranges?.[0]?.blocker==='failure_probability_by_level_missing'&&row.source_warning==='observed_rate_level_and_equipment_scope_unspecified'),'The missing level-34 success rate and unscoped guide rate must remain blockers.');
check(rows.every(row=>row.unscoped_observed_xp_per_hour===36000&&row.supporting_source_revisions?.includes('15293118')&&row.supporting_source_revisions?.includes('15324367')),'The approximate guide rate must retain both supporting source revisions without being assigned to an exact condition.');
check(parseBrimhavenDetachedFloorSpikeVariants({...input,arenaPage:{...arenaPage,content:arenaPage.content.replace('|4 t','|5 t')}}).length===0,'A table timing/XP-per-tick contradiction must fail closed.');
check(parseBrimhavenDetachedFloorSpikeVariants({...input,obstaclePage:{...obstaclePage,content:obstaclePage.content.replace('|xp2 = 26.4','|xp2 = 26.5')}}).length===0,'A glove XP contradiction must fail closed.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Brimhaven floor-spike training variant checks passed.');
