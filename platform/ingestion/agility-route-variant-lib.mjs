const number=value=>Number(String(value||'').replace(/,/g,''));
const seconds=(minutes,rest)=>number(minutes)*60+number(rest);
const lineMatch=(content,pattern)=>{const match=content.match(pattern);return match?{match,line:content.slice(0,match.index).split(/\r?\n/).length,text:match[0].slice(0,900)}:null};
const locator=(...evidence)=>({evidence:evidence.filter(Boolean).map(x=>({line:x.line,excerpt:x.text}))});
const record=(base,data)=>({...base,...data,state:'candidate'});

function dorgeshKaan(base,content){
  const access=lineMatch(content,/available to players with level\s+(\d+)\s+\[\[Agility\]\][\s\S]{0,500}?\[\[Death to the Dorgeshuun\]\][\s\S]{0,500}?\[\[Light sources\|light source\]\]/i);
  const grappleLevel=lineMatch(content,/Optionally, level\s+(\d+)\s+\[\[Strength\]\]\s+and\s+\[\[Ranged\]\]/i);
  const tools=lineMatch(content,/bring any \[\[Crossbow \(weapon\)\|crossbow\]\][\s\S]{0,300}?multiple \[\[mith grapple\]\]s[\s\S]{0,900}?1\/25[\s\S]{0,900}?chance of the grapple being destroyed/i);
  const agilityTime=lineMatch(content,/Agility route back and forth takes\s+(\d+):(\d+)\s+minutes/i);
  const grappleTime=lineMatch(content,/grapple route back and forth takes\s+(\d+):(\d+)\s+minutes/i);
  const mixedTime=lineMatch(content,/combination of both routes takes\s+(\d+):(\d+)\s+minutes/i);
  const agilityTotal=lineMatch(content,/Delivery bonus\s*\n\|\{\{SCP\|Agility\|2,432\}[\s\S]{0,220}?Total[\s\S]{0,80}?\{\{SCP\|Agility\|([\d,]+)\}\}/i);
  const grappleTotal=lineMatch(content,/Delivery bonus\s*\n\|\{\{SCP\|Ranged\|1,142\}[\s\S]{0,240}?Total[\s\S]{0,120}?\{\{SCP\|Agility\|([\d,]+)\}\}<br\/>\{\{SCP\|Ranged\|([\d,]+)\}\}<br\/>\{\{SCP\|Strength\|([\d,]+)\}\}/i);
  const agilityRate=lineMatch(content,/Agility route back and forth at level\s+(\d+)[^.]*maximum of\s+(\d+)\s+laps per hour resulting in\s+([\d,]+)\s+Agility experience per hour/i);
  const grappleRate=lineMatch(content,/grapple route back and forth[^.]*maximum of\s+(\d+)\s+laps per hour resulting in\s+([\d,]+)\s+Ranged experience,\s+([\d,]+)\s+Agility experience, and\s+([\d,]+)\s+Strength experience per hour/i);
  const mixedRate=lineMatch(content,/grapple route one way and the Agility route at level\s+(\d+)\s+the other way[^.]*maximum of\s+(\d+)\s+laps per hour resulting in\s+([\d,]+)\s+Agility experience,\s+([\d,]+)\s+Ranged experience, and\s+([\d,]+)\s+Strength experience per hour/i);
  if(!access||!grappleLevel||!tools||!agilityTime||!grappleTime||!mixedTime||!agilityTotal||!grappleTotal||!agilityRate||!grappleRate||!mixedRate){if(process.env.SENSUM_ROUTE_DEBUG)console.error('Dorgesh-Kaan route parse blockers',{access:!!access,grappleLevel:!!grappleLevel,tools:!!tools,agilityTime:!!agilityTime,grappleTime:!!grappleTime,mixedTime:!!mixedTime,agilityTotal:!!agilityTotal,grappleTotal:!!grappleTotal,agilityRate:!!agilityRate,grappleRate:!!grappleRate,mixedRate:!!mixedRate});return []}
  const entry=number(access.match[1]),baseRequirements=['Death to the Dorgeshuun','Light source'],grappleRequirements=[...baseRequirements,'Crossbow','Mith grapple'];
  const common={axis_coverage:['route_strategy'],entry_level:entry,skill_requirements:{Agility:entry},inherit_parent_mechanics:false};
  return [
    record(base,{...common,record_key:`agility-route:${base.parent_name}:agility_both_ways`,variant_key:'agility_both_ways',name:`${base.parent_name} — Agility route both ways`,requirements:baseRequirements,cycle_seconds:seconds(agilityTime.match[1],agilityTime.match[2]),cycle_ticks:seconds(agilityTime.match[1],agilityTime.match[2])/0.6,xp_per_lap_by_skill:{Agility:number(agilityTotal.match[1])},observed_laps_per_hour:number(agilityRate.match[2]),observed_xp_per_hour_by_skill:{Agility:number(agilityRate.match[3])},observed_rate_conditions:{Agility:number(agilityRate.match[1]),performance:'maximum'},source_locator:locator(access,agilityTime,agilityTotal,agilityRate)}),
    record(base,{...common,record_key:`agility-route:${base.parent_name}:grapple_both_ways`,variant_key:'grapple_both_ways',name:`${base.parent_name} — Grapple route both ways`,axis_coverage:['route_strategy','equipment_modifier'],requirements:grappleRequirements,skill_requirements:{Agility:entry,Strength:number(grappleLevel.match[1]),Ranged:number(grappleLevel.match[1])},cycle_seconds:seconds(grappleTime.match[1],grappleTime.match[2]),cycle_ticks:seconds(grappleTime.match[1],grappleTime.match[2])/0.6,xp_per_lap_by_skill:{Agility:number(grappleTotal.match[1]),Ranged:number(grappleTotal.match[2]),Strength:number(grappleTotal.match[3])},observed_laps_per_hour:number(grappleRate.match[1]),observed_xp_per_hour_by_skill:{Ranged:number(grappleRate.match[2]),Agility:number(grappleRate.match[3]),Strength:number(grappleRate.match[4])},observed_rate_conditions:{performance:'maximum',agility_success_scaling:true},consumable_risk:{item:'Mith grapple',loss_chance_per_use:'1/25'},source_locator:locator(access,grappleLevel,tools,grappleTime,grappleTotal,grappleRate)}),
    record(base,{...common,record_key:`agility-route:${base.parent_name}:mixed`,variant_key:'mixed',name:`${base.parent_name} — Mixed Agility and grapple routes`,axis_coverage:['route_strategy','equipment_modifier'],requirements:grappleRequirements,skill_requirements:{Agility:entry,Strength:number(grappleLevel.match[1]),Ranged:number(grappleLevel.match[1])},cycle_seconds:seconds(mixedTime.match[1],mixedTime.match[2]),cycle_ticks:seconds(mixedTime.match[1],mixedTime.match[2])/0.6,xp_per_lap_by_skill:null,observed_laps_per_hour:number(mixedRate.match[2]),observed_xp_per_hour_by_skill:{Agility:number(mixedRate.match[3]),Ranged:number(mixedRate.match[4]),Strength:number(mixedRate.match[5])},observed_rate_conditions:{Agility:number(mixedRate.match[1]),performance:'maximum'},mechanical_reward_blocker:'The pinned page does not state a complete per-lap mixed-route reward vector.',source_locator:locator(access,grappleLevel,tools,mixedTime,mixedRate)})
  ];
}

function skullball(base,content){
  const access=lineMatch(content,/must have an Agility level of\s+(\d+)[^.]*completed the \[\[Creature of Fenkenstrain\]\][^.]*wearing a \[\[Ring of Charos\]\]/i);
  const reward=lineMatch(content,/gain\s+([\d,]+)\s+\[\[Agility\]\] experience if you complete the game in under\s+(\d+)\s+minutes[\s\S]{0,100}?For every\s+(\d+)\s+seconds over[^,]*, you'll lose\s+(\d+)\s+experience/i);
  const table=lineMatch(content,/Run recommended route\s*\n\|(\d+):(\d+)\s*-\s*(\d+):(\d+)\s*\n\|([\d,]+)[\s\S]{0,80}?Walk recommended route\s*\n\|(\d+):(\d+)\s*-\s*(\d+):(\d+)\s*\n\|([\d,]+)[\s\S]{0,80}?Unplanned scramble\s*\n\|(\d+):(\d+)\s*-\s*(\d+):(\d+)\s*\n\|([\d,]+)/i);
  const optimal=lineMatch(content,/Optimal route ==[\s\S]{0,120}?times as fast as\s+(\d+):(\d+)\s+can be achieved/i);
  if(!access||!reward||!table||!optimal){if(process.env.SENSUM_ROUTE_DEBUG)console.error('Werewolf Skullball route parse blockers',{access:!!access,reward:!!reward,table:!!table,optimal:!!optimal});return []}
  const entry=number(access.match[1]),requirements=['Creature of Fenkenstrain','Ring of Charos'],rewardRule={full_reward_time_limit_seconds:number(reward.match[2])*60,full_reward_xp:number(reward.match[1]),late_penalty_interval_seconds:number(reward.match[3]),late_penalty_xp:number(reward.match[4])},common={entry_level:entry,skill_requirements:{Agility:entry},requirements,axis_coverage:['route_strategy','equipment_modifier'],xp_per_lap_by_skill:{Agility:number(reward.match[1])},reward_rule:rewardRule,outcome_model:'completion_time_reward',failure_model_required:false,random_failure_roll_applicable:false,completion_scope:'all_10_goals_completed',abandoned_attempt_rate:null,inherit_parent_mechanics:false};
  const ranged=(key,label,start,mode)=>record(base,{...common,record_key:`agility-route:${base.parent_name}:${key}`,variant_key:key,name:`${base.parent_name} — ${label}`,axis_coverage:[...common.axis_coverage,'intensity_strategy'],intensity:mode,cycle_seconds:null,cycle_seconds_range:{minimum:seconds(table.match[start],table.match[start+1]),maximum:seconds(table.match[start+2],table.match[start+3])},observed_reward_xp:number(table.match[start+4]),source_locator:locator(access,reward,table)});
  return [
    ranged('recommended_run','Recommended route — run',1,'run'),
    ranged('recommended_walk','Recommended route — walk',6,'walk'),
    ranged('unplanned_scramble','Unplanned scramble',11,'unplanned'),
    record(base,{...common,record_key:`agility-route:${base.parent_name}:optimal_run`,variant_key:'optimal_run',name:`${base.parent_name} — Optimal route`,axis_coverage:[...common.axis_coverage,'intensity_strategy'],intensity:'high_effort_tick_precise',cycle_seconds:null,cycle_seconds_observed_peak:seconds(optimal.match[1],optimal.match[2]),observed_peak_not_typical:true,source_locator:locator(access,reward,optimal)})
  ];
}

export function parseAgilityRouteVariants({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  const base={contract:'sensum.agility-route-variant.v1',parent_name:title,source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl};
  if(title==='Dorgesh-Kaan Agility Course')return dorgeshKaan(base,content);
  if(title==='Werewolf Skullball')return skullball(base,content);
  return [];
}
