export const finiteConditionLevel=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const finite=finiteConditionLevel;
export const isTrainableVariantRecord=row=>!['composable_modifier','encounter_requirement'].includes(row?.record_kind);

export function resolveEntryAndModeledLevels({explicitEntryLevel,inferredEntryLevels=[],baseLevelMinimum=null,failureBaseThreshold=0}){
  const explicit=finite(explicitEntryLevel),inferred=inferredEntryLevels.map(finite).filter(x=>x!==null),inferredEntry=inferred.length?Math.max(...inferred):null,entryLevel=explicit??(inferredEntry!==null&&inferredEntry>0?inferredEntry:null);
  if(entryLevel===null)return {entryLevel:null,modeledMinimumLevel:null};
  return {entryLevel,modeledMinimumLevel:Math.max(entryLevel,finite(baseLevelMinimum)??0,finite(failureBaseThreshold)??0)};
}

export function resolveVariantConditionModel(variant,legacyFailure=null){
  if(!variant)return {failure:legacyFailure,baseLevelMinimum:null,effectiveLevelMinimum:null,conditionDetails:{}};
  const baseLevelMinimum=finite(variant.base_agility_level_minimum)??(typeof variant.skill_requirements?.Agility==='number'?finite(variant.skill_requirements.Agility):null);
  const effectiveLevelMinimum=finite(variant.effective_agility_level_minimum)??finite(variant.failure_free_effective_agility_level);
  let failure=legacyFailure;
  if(finite(variant.failure_free_level)!==null)failure={value:{probability:0,minimum_level:finite(variant.failure_free_level),level_kind:'base'}};
  else if(finite(variant.failure_free_effective_agility_level)!==null)failure={value:{probability:0,minimum_level:finite(variant.failure_free_effective_agility_level),level_kind:'effective'}};
  else if(Array.isArray(variant.failure_free_condition?.all_of)&&variant.failure_free_condition.all_of.length)failure={value:{probability:0,minimum_level:variant.failure_free_condition.all_of.find(x=>x.skill==='Agility')?.minimum??null,level_kind:'compound',all_of:variant.failure_free_condition.all_of}};
  return {failure,baseLevelMinimum,effectiveLevelMinimum,conditionDetails:{entryBoostable:variant.entry_boostable??null,boostPolicy:variant.boost_policy??null,boostSource:variant.boost_source??null,equipmentRequirement:variant.equipment_requirement??null,failureFreeCondition:variant.failure_free_condition??null,outcomeModel:variant.outcome_model??null,randomFailureRollApplicable:variant.random_failure_roll_applicable??null,completionScope:variant.completion_scope??null,unmodeledLevelRanges:Array.isArray(variant.unmodeled_level_ranges)?variant.unmodeled_level_ranges:[]}};
}
