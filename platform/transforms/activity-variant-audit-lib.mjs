const rules=[
  {axis:'course_branch',objective:'xp_per_hour',test:text=>/(?:split into a basic and advanced course|two courses available[^\n]{0,180}?basic[^\n]{0,100}?advanced)/i.test(text)},
  {axis:'floor_access',objective:'xp_per_hour',test:text=>/(?:enter Floor\s*[1-9]|each floor|Floor\s*[1-9][^\n]{0,120}?(?:level|required|path|trap))/i.test(text)},
  {axis:'route_strategy',objective:'xp_per_hour',test:text=>/(?:one of two routes|Agility route|grapple route|==\s*Recommended route|==\s*Optimal route)/i.test(text)},
  {axis:'achievement_modifier',objective:'multi_objective',test:text=>/diary/i.test(text)&&/(?:experience|xp|rate|teleport|increase|marks? of grace|chance|lap)/i.test(text)&&!/(?:is a requirement for|task in the)/i.test(text)},
  {axis:'equipment_modifier',objective:'multi_objective',test:text=>/\b(?:gloves?|boots?|capes?|rings?|focus|grapple|symbols?|hammers?|suits?|crossbows?|light sources?)\b/i.test(text)&&(/(?:experience|xp|rate|success|time|failure|penalty|marks?)/i.test(text)||/(?:has to wear|when equipped|wearing|bring any|has to bring|holding|in (?:the )?(?:player's )?inventory|through use of|using (?:a|the)|required to complete this course)/i.test(text))},
  {axis:'random_shortcut',objective:'xp_per_hour',test:text=>/(?:portal shortcuts?|using shortcuts?|portal spawn|shortcuts? bring the lap duration)/i.test(text)},
  {axis:'temporary_boost',objective:'xp_per_hour',test:text=>/(?:temporary boosts?|boosted Agility|maintain a boosted)/i.test(text)},
  {axis:'intensity_strategy',objective:'xp_per_hour',test:text=>/(?:passive approach|constantly jumping|during down time|==\s*Optimal route|==\s*Recommended route)/i.test(text)},
  {axis:'looting_policy',objective:'multi_objective',test:text=>/(?:coffins?|looting)/i.test(text)&&/(?:floor|time|experience|xp|route|reward)/i.test(text)}
];

export function auditVariantAxes({records,members,variants}){
  const roles=new Map(members.map(x=>[x.name,x.entity_role])),variantParents=new Map(),coveredAxes=new Map();
  for(const row of variants){if(!variantParents.has(row.parent_name))variantParents.set(row.parent_name,new Set());variantParents.get(row.parent_name).add(row.variant_key);if(!coveredAxes.has(row.parent_name))coveredAxes.set(row.parent_name,new Set());for(const axis of row.axis_coverage||[])coveredAxes.get(row.parent_name).add(axis)}
  for(const [parent,keys] of variantParents)if(keys.has('basic')&&keys.has('advanced'))coveredAxes.get(parent)?.add('course_branch');
  const findings=[];
  for(const record of records){if(roles.get(record.name)==='reference_collection')continue;const fragments=record.evidence_fragments||[];
    for(const rule of rules){const matched=fragments.filter(x=>rule.test(x.text||'')).slice(0,8);if(!matched.length)continue;const expanded=coveredAxes.get(record.name)?.has(rule.axis);findings.push({name:record.name,axis:rule.axis,objective:rule.objective,state:expanded?'expanded':'requires_model_variant',source_revision:record.source_revision,source_url:record.source_url,source_locators:matched.map(x=>({line:x.line,excerpt:x.text}))})}
  }
  const pending=findings.filter(x=>x.state==='requires_model_variant'),byAxis=Object.fromEntries(rules.map(rule=>[rule.axis,{findings:findings.filter(x=>x.axis===rule.axis).length,pending:pending.filter(x=>x.axis===rule.axis).length}]));
  return {contract:'sensum.activity-variant-audit.v1',recordsReviewed:records.filter(x=>roles.get(x.name)!=='reference_collection').length,referenceCollectionsExcluded:records.filter(x=>roles.get(x.name)==='reference_collection').length,findings:findings.length,expanded:findings.filter(x=>x.state==='expanded').length,pending:pending.length,pendingPages:[...new Set(pending.map(x=>x.name))].sort(),byAxis,completeCoverage:pending.length===0,absoluteBestActivityGate:pending.length?'blocked':'eligible_for_next_gate',details:findings};
}
