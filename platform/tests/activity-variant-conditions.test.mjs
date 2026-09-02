import {resolveVariantConditionModel} from '../transforms/activity-variant-condition-lib.mjs';
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const boosted=resolveVariantConditionModel({entry_boostable:false,base_agility_level_minimum:70,effective_agility_level_minimum:75,failure_free_effective_agility_level:75,boost_policy:'maintain_effective_level',equipment_requirement:{mode:'one_of'}});
check(boosted.baseLevelMinimum===70&&boosted.effectiveLevelMinimum===75,'Base and effective Agility levels must remain separate.');
check(boosted.failure?.value?.minimum_level===75&&boosted.failure?.value?.level_kind==='effective','An effective-level failure threshold must not become a base requirement.');
check(boosted.conditionDetails.entryBoostable===false&&boosted.conditionDetails.boostPolicy==='maintain_effective_level','Entry and training boost policies must remain independent.');
const compound=resolveVariantConditionModel({failure_free_condition:{all_of:[{skill:'Agility',minimum:80},{skill:'Strength',minimum:80},{carried_weight_kg:{maximum:2}}]}});
check(compound.failure?.value?.probability===0&&compound.failure?.value?.minimum_level===80&&compound.failure?.value?.level_kind==='compound'&&compound.failure?.value?.all_of?.length===3,'Compound failure-free conditions must retain the Agility threshold and remain conjunctive.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Activity variant condition checks passed.');
