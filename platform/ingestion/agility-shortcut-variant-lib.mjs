const number=value=>Number(String(value||'').replace(/,/g,''));
const lineMatch=(content,pattern)=>{const match=content.match(pattern);return match?{match,line:content.slice(0,match.index).split(/\r?\n/).length,text:match[0].slice(0,1000)}:null};
const locator=(...evidence)=>({evidence:evidence.filter(Boolean).map(x=>({line:x.line,excerpt:x.text}))});
const record=(base,data)=>({...base,...data,state:'candidate'});

function prifddinas(base,content){
  const access=lineMatch(content,/available to players with\s+(\d+)\s+\[\[Agility\]\][^\n]*completed the \[\[Song of the Elves\]\]/i);
  const failure=lineMatch(content,/course becomes impossible to fail at level\s+(\d+)\s+Agility/i);
  const portalRules=lineMatch(content,/portals[\s\S]{0,160}?act as shortcuts[\s\S]{0,260}?total of\s+(\d+)\s+possible unique portal locations[\s\S]{0,160}?only one can appear per lap[\s\S]{0,260}?spawn randomly for each player/i);
  const portalEffect=lineMatch(content,/Portal shortcuts bring the lap duration down by around\s+(\d+)\s*[–-]\s*(\d+)\s+seconds[\s\S]{0,240}?Using a portal grants\s+([\d.]+)\s+experience and, on average, adds an additional\s+([\d.]+)\s+experience per lap/i);
  const rateChange=lineMatch(content,/experience rates have been increased from\s+[\d,]+\s+experience per hour at level\s+(\d+)\s+when not using shortcuts and\s+[\d,]+\s+experience per hour when using shortcuts to\s+([\d,]+)\s+and\s+([\d,]+), respectively/i);
  const averageLap=lineMatch(content,/average lap duration is about\s+(\d+):(\d+)/i);
  const peak=lineMatch(content,/fastest possible completion time without exploits being\s+(\d+):(\d+(?:\.\d+)?)[\s\S]{0,300}?time of\s+\d+:\d+(?:\.\d+)?\s+can only be achieved[\s\S]{0,360}?portal spawn on top of the bank[\s\S]{0,300}?running to this tile instead[\s\S]{0,240}?additional \[\[tick\]\][\s\S]{0,160}?time of\s+(\d+):(\d+(?:\.\d+)?)/i);
  const shards=lineMatch(content,/roughly\s+([\d.]+)\s+\[\[crystal shard\]\]s per hour\s*\(([\d.]+)\s+shard per lap\)[^.]*each portal providing one shard/i);
  const obstacleMatches=[...content.matchAll(/\{\{\+=\|xp\|([\d.]+)\|echo=2\}\}/g)];
  const totalLine=lineMatch(content,/Total\s*\n!\s*\{\{#var:xp\}\}<br\/>~\{\{#expr:\{\{#var:xp\}\}\+([\d.]+)\}\} with portals/i);
  if(!access||!failure||!portalRules||!portalEffect||!rateChange||!averageLap||!peak||!shards||obstacleMatches.length!==12||!totalLine){if(process.env.SENSUM_SHORTCUT_DEBUG)console.error('Prifddinas shortcut parse blockers',{access:!!access,failure:!!failure,portalRules:!!portalRules,portalEffect:!!portalEffect,rateChange:!!rateChange,averageLap:!!averageLap,peak:!!peak,shards:!!shards,obstacles:obstacleMatches.length,totalLine:!!totalLine});return []}
  const entry=number(access.match[1]),baseXp=Math.round(obstacleMatches.reduce((sum,x)=>sum+number(x[1]),0)*10)/10,averagePortalXp=number(totalLine.match[1]),requirements=['Song of the Elves'],common={axis_coverage:['random_shortcut'],entry_level:entry,skill_requirements:{Agility:entry},requirements,failure_free_level:number(failure.match[1]),inherit_parent_mechanics:false};
  const unresolvedAverage={cycle_seconds:null,unassigned_observed_average_seconds:number(averageLap.match[1])*60+number(averageLap.match[2]),timing_blocker:'The pinned page does not bind its 1:14 average lap duration to a specific portal policy.'};
  return [
    record(base,{...common,...unresolvedAverage,record_key:`agility-shortcut:${base.parent_name}:no_portal`,variant_key:'no_portal',name:`${base.parent_name} — No portal shortcut`,shortcut_policy:'portal_absent_or_not_used',xp_per_lap:baseXp,observed_xp_per_hour:number(rateChange.match[2]),observed_rate_conditions:{Agility:number(rateChange.match[1]),shortcut_policy:'not_using_shortcuts'},source_locator:locator(access,failure,rateChange,averageLap,totalLine)}),
    record(base,{...common,...unresolvedAverage,record_key:`agility-shortcut:${base.parent_name}:use_random_portal`,variant_key:'use_random_portal',name:`${base.parent_name} — Use random portal shortcut`,shortcut_policy:'use_when_spawned',portal_spawn_random:true,portal_locations:number(portalRules.match[1]),maximum_portals_per_normal_lap:1,xp_per_lap_expected:Math.round((baseXp+averagePortalXp)*10)/10,portal_xp_per_use:number(portalEffect.match[3]),portal_average_xp_added_per_lap:averagePortalXp,portal_time_saved_seconds_range:{minimum:number(portalEffect.match[1]),maximum:number(portalEffect.match[2])},observed_xp_per_hour:number(rateChange.match[3]),observed_rate_conditions:{Agility:number(rateChange.match[1]),shortcut_policy:'using_shortcuts'},objective_metrics:{crystal_shards_per_hour_approximate:number(shards.match[1]),crystal_shards_per_lap_approximate:number(shards.match[2])},source_locator:locator(access,failure,portalRules,portalEffect,rateChange,averageLap,shards,totalLine)}),
    record(base,{...common,record_key:`agility-shortcut:${base.parent_name}:best_portal_spawn_peak`,variant_key:'best_portal_spawn_peak',name:`${base.parent_name} — Best portal spawn peak`,shortcut_policy:'best_random_spawn_after_positioning',portal_spawn_random:true,cycle_seconds:null,cycle_seconds_observed_peak:number(peak.match[1])*60+number(peak.match[2]),running_start_cycle_seconds_observed_peak:number(peak.match[3])*60+number(peak.match[4]),observed_peak_not_typical:true,xp_per_lap:null,mechanical_reward_blocker:'The pinned page does not enumerate the spawn-specific obstacles skipped, so exact peak-lap XP is unresolved.',source_locator:locator(access,portalRules,portalEffect,peak)})
  ];
}

export function parseAgilityShortcutVariants({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  const base={contract:'sensum.agility-shortcut-variant.v1',parent_name:title,source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl};
  if(title==='Prifddinas Agility Course')return prifddinas(base,content);
  return [];
}
