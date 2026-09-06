import {BRIMHAVEN_PASSIVE_RATE_CONTRACT,BRIMHAVEN_PASSIVE_RATE_FORMULA,evaluateBrimhavenPassiveRate,validateBrimhavenPassiveRateModel} from '../formulas/brimhaven-passive-v1.mjs';
import {evaluateExpectedRateModel,validateExpectedRateModel} from '../formulas/expected-rate-model-registry.mjs';

const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const model=({gloves=false,elite=false}={})=>({contract:BRIMHAVEN_PASSIVE_RATE_CONTRACT,formula_version:BRIMHAVEN_PASSIVE_RATE_FORMULA,level_input:'base_agility_no_boost',pillar_xp_per_level_band:30,pillar_levels_per_band:10,pillar_maximum_xp:300,pillars_per_hour:60,tickets_per_tag:1,ticket_base_xp:345,ticket_glove_xp:379.5,karamja_gloves_apply:gloves,elite_double_ticket_chance:0.1,elite_diary_apply:elite,tag_and_ticket_xp_only:true,obstacle_xp_included:false,assumes_no_missed_pillars:true,equipment_policy:gloves?'karamja_gloves_bonus':'no_karamja_gloves_bonus',achievement_policy:elite?'karamja_elite':'no_karamja_elite',source_revision:'15293118',source_url:'https://oldschool.runescape.wiki/w/Brimhaven_Agility_Arena',source_locator:{evidence:[{line:196,excerpt:'revision-pinned test evidence'}]}});

check(validateBrimhavenPassiveRateModel(model()).valid,'A complete revision-pinned Brimhaven passive formula must validate.');
check(validateExpectedRateModel(model()).valid&&evaluateExpectedRateModel(model(),34).xpPerHour===26100,'The generic expected-rate registry must route the supported formula without method-specific generator code.');
check(validateExpectedRateModel({contract:'unknown'}).blockers.includes('expected_rate_model_contract_unsupported')&&evaluateExpectedRateModel({contract:'unknown'},34).status==='blocked','Unknown expected-rate contracts must fail closed.');
const noGloves=evaluateBrimhavenPassiveRate(model(),34),gloves=evaluateBrimhavenPassiveRate(model({gloves:true}),34),elite=evaluateBrimhavenPassiveRate(model({elite:true}),34),combined=evaluateBrimhavenPassiveRate(model({gloves:true,elite:true}),34);
check(noGloves.xpPerHour===26100&&noGloves.components.pillarXpPerTag===90,'Level 34 no-glove/no-Elite expected rate must use the published 30-XP-per-10-level tag rule.');
check(gloves.xpPerHour===28170&&elite.xpPerHour===28170,'Glove ticket XP and the Elite expected extra ticket must remain independent even when their level-34 totals coincide.');
check(combined.xpPerHour===30447&&combined.components.expectedTicketsPerTag===1.1,'Combined gloves and Elite expected value must use 379.5 XP and 1.1 expected tickets per tag.');
check(noGloves.conditions.obstacleXpIncluded===false&&noGloves.conditions.assumesNoMissedPillars===true,'The formula must expose its source-stated exclusions and throughput condition.');
check(evaluateBrimhavenPassiveRate(model(),40).xpPerHour===27900&&evaluateBrimhavenPassiveRate(model(),80).xpPerHour===35100,'The formula must remain level-parameterized rather than interpolating approximate level-40/80 observations.');
check(evaluateBrimhavenPassiveRate(model(),0).status==='blocked'&&evaluateBrimhavenPassiveRate(model(),100).status==='blocked','Base-level evaluation must stay inside the 1–99 domain.');
const missingEvidence=model();delete missingEvidence.source_locator;
check(evaluateBrimhavenPassiveRate(missingEvidence,34).blockers.includes('brimhaven_passive_rate_source_binding_incomplete'),'Missing revision evidence must fail closed.');
const mixedScope=model();mixedScope.obstacle_xp_included=true;
check(evaluateBrimhavenPassiveRate(mixedScope,34).blockers.includes('brimhaven_passive_rate_obstacle_xp_scope_invalid'),'A condition-mismatched obstacle-XP model must fail closed.');
const mismatchedEquipment=model();mismatchedEquipment.equipment_policy='karamja_gloves_bonus';
check(evaluateBrimhavenPassiveRate(mismatchedEquipment,34).blockers.includes('brimhaven_passive_rate_equipment_policy_mismatch'),'A condition axis and policy mismatch must fail closed.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Brimhaven passive expected-rate formula checks passed.');
