const number=value=>Number(String(value||'').replace(/,/g,''));
const lineAt=(content,index)=>content.slice(0,index).split(/\r?\n/).length;

export function parseHallowedSepulchreVariants({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Hallowed Sepulchre')return [];
  const section=content.match(/==Experience rates==([\s\S]*?)(?=\n==[^=]|$)/i)?.[1]||'',policyNotes=section.split(/\r?\n/).filter(line=>/^Please note\b|^#\s/.test(line));
  const start=content.indexOf(section),rowPattern=/\|-\s*\r?\n\|(\d+)\s*\r?\n\|\{\{SCP\|Agility\|(\d+)[^\n]*\r?\n\|([\d,]+)[^\n]*\r?\n\|([\d,]+)[^\n]*\r?\n\|([\d,]+)[^\n]*\r?\n\|([\d,]+)[^\n]*\r?\n\|([\d,]+)/gi,rows=[];
  for(const match of section.matchAll(rowPattern)){
    const floor=number(match[1]),entryLevel=number(match[2]),floorXp=number(match[3]),cumulativeXp=number(match[4]),lootingRate=number(match[5]),noLootingRate=number(match[6]),treasureXp=number(match[7]),line=lineAt(content,start+match.index);
    for(const policy of ['looting','no_looting']){
      const rate=policy==='looting'?lootingRate:noLootingRate,label=policy==='looting'?'Realistic looting':'No looting';
      rows.push({contract:'sensum.hallowed-sepulchre-variant.v1',record_key:`hallowed-sepulchre:floor-${floor}:${policy}`,parent_name:title,variant_key:`floor-${floor}:${policy}`,name:`${title} — Floor ${floor} — ${label}`,model_kind:'observed_rate',axis_coverage:['floor_access','looting_policy'],floor,looting_policy:policy,entry_level:entryLevel,entry_boostable:true,floor_xp:floorXp,cumulative_xp:cumulativeXp,observed_xp_per_hour:rate,treasure_encounter_xp:treasureXp,requirements:['Sins of the Father'],mechanical_cycle_known:false,source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl,source_locator:{line,excerpt:match[0].slice(0,700),rate_column:policy==='looting'?'Realistic Looting XP/hour':'Realistic No looting XP/hour',policy_notes:policyNotes},state:'candidate'});
    }
  }
  return rows;
}
