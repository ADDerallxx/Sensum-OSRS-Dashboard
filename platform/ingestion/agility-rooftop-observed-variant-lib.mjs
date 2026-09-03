const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const slug=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function buildRooftopObservedRateVariants(candidates,{candidateKeys=['guide:rooftop:varrock']}={}){
  const selected=new Set(candidateKeys),records=[];
  for(const candidate of candidates||[]){
    if(!selected.has(candidate?.candidate_key))continue;
    const entry=finite(candidate.minimum_agility),minimum=finite(candidate.observed_xp_per_hour_range?.minimum),maximum=finite(candidate.observed_xp_per_hour_range?.maximum),scopeMinimum=finite(candidate.observed_xp_per_hour_level_scope?.minimum),scopeMaximum=finite(candidate.observed_xp_per_hour_level_scope?.maximum),condition=candidate.target_condition_evidence;
    if(entry===null||minimum===null||maximum===null||maximum<minimum||scopeMinimum===null||scopeMaximum===null||scopeMaximum<scopeMinimum||condition?.failure_possible!==true||!condition?.source_revision||!condition?.source_locator)continue;
    const key=slug(candidate.name);
    records.push({
      contract:'sensum.agility-rooftop-observed-variant.v1',record_key:`agility-rooftop-observed:${key}:levels-${scopeMinimum}-${scopeMaximum}`,parent_name:candidate.name,variant_key:`source_observed_levels_${scopeMinimum}_${scopeMaximum}`,name:`${candidate.name} — Source-observed levels ${scopeMinimum}–${scopeMaximum}`,standalone_training_method:true,inherit_parent_mechanics:false,candidate_group_key:`agility-rooftop:${key}:standard`,candidate_display_name:candidate.name,axis_coverage:['base_level_band','failure_integrated_observation'],entry_level:entry,base_agility_level_minimum:scopeMinimum,base_agility_level_maximum:scopeMaximum,skill_requirements:{Agility:entry},requirements:candidate.requirements||[],failure_possible:true,failure_probability_published:false,failure_qualifier:'source_hourly_band_does_not_publish_failure_probability',failure_outcomes:condition.failure_outcomes||[],observational_benchmark_only:true,outcome_model:'source_observed_hourly_rate_range',outcome_integrated_in_observed_rate:true,observed_xp_per_hour_range:{minimum,maximum},observed_xp_per_hour_level_scope:{minimum:scopeMinimum,maximum:scopeMaximum},observed_rate_condition_scope:{course:candidate.name,base_agility_band:{minimum:scopeMinimum,maximum:scopeMaximum},within_band_player_performance_and_failure_mix:'source_unspecified'},observed_rate_kind:'source_published_level_band_rate_range',observed_rate_approximate:true,observed_comparison_policy:'source_observed_rate_range',observed_rate_source_revision:String(candidate.source_revision||''),observed_rate_source_url:candidate.source_url,observed_rate_source_locator:candidate.source_locator,source_revision:String(candidate.source_revision||''),source_timestamp:candidate.source_timestamp||null,source_url:candidate.source_url,source_locator:candidate.source_locator,supporting_evidence:condition,supporting_source_revisions:[...new Set([...(candidate.supporting_source_revisions||[]),String(condition.source_revision)])],state:'candidate'
    });
  }
  return records;
}
