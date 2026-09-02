const finite=value=>Number.isFinite(Number(value))?Number(value):null;

export function resolveVariantConditionModel(variant,legacyFailure=null){
  if(!variant)return {failure:legacyFailure,baseLevelMinimum:null,effectiveLevelMinimum:null,conditionDetails:{}};
  const baseLevelMinimum=finite(variant.base_agility_level_minimum)??(typeof variant.skill_requirements?.Agility==='number'?finite(variant.skill_requirements.Agility):null);
  const effectiveLevelMinimum=finite(variant.effective_agility_level_minimum)??finite(variant.failure_free_effective_agility_level);
  let failure=legacyFailure;
  if(finite(variant.failure_free_level)!==null)failure={value:{probability:0,minimum_level:finite(variant.failure_free_level),level_kind:'base'}};
  else if(finite(variant.failure_free_effective_agility_level)!==null)failure={value:{probability:0,minimum_level:finite(variant.failure_free_effective_agility_level),level_kind:'effective'}};
  else if(Array.isArray(variant.failure_free_condition?.all_of)&&variant.failure_free_condition.all_of.length)failure={value:{probability:0,minimum_level:variant.failure_free_condition.all_of.find(x=>x.skill==='Agility')?.minimum??null,level_kind:'compound',all_of:variant.failure_free_condition.all_of}};
  return {failure,baseLevelMinimum,effectiveLevelMinimum,conditionDetails:{entryBoostable:variant.entry_boostable??null,boostPolicy:variant.boost_policy??null,boostSource:variant.boost_source??null,equipmentRequirement:variant.equipment_requirement??null,failureFreeCondition:variant.failure_free_condition??null}};
}
