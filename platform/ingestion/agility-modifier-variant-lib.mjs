const number=value=>Number(String(value||'').replace(/,/g,''));
const lineMatch=(content,pattern)=>{const match=content.match(pattern);return match?{match,line:content.slice(0,match.index).split(/\r?\n/).length,text:match[0].slice(0,900)}:null};
const locator=(...evidence)=>({evidence:evidence.filter(Boolean).map(x=>({line:x.line,excerpt:x.text}))});
const record=(base,data)=>({...base,...data,state:'candidate'});
const entryMatch=content=>lineMatch(content,/available to players with(?: an?)?\s*(?:\[\[Agility\]\]|Agility)?\s*level(?: of)?\s*(\d+)/i);

function pollnivneach(base,content){
  const entry=entryMatch(content),totals=lineMatch(content,/Completing the course rewards a total of\s*([\d,]+)\s*Agility experience[^.]*increased to\s*([\d,]+)\s*experience after completing the \[\[Desert Hard Diary\]\]/i),rates=lineMatch(content,/With\s*(\d+)\s*ticks\s*\(([\d.]+)\s*seconds\)\s*per lap[^.]*?([\d,]+)\s*exp per hour without the diary[^.]*?([\d,]+)\s*exp per hour with the diary/i);
  if(!entry||!totals||!rates)return [];
  const entryLevel=number(entry.match[1]),cycleTicks=number(rates.match[1]),cycleSeconds=number(rates.match[2]);
  return [['standard','No diary',[],number(totals.match[1]),number(rates.match[3])],['desert_hard','Desert Hard Diary',['Desert Hard Diary'],number(totals.match[2]),number(rates.match[4])]].map(([key,label,requirements,xp,observed])=>record(base,{record_key:`agility-modifier:${base.parent_name}:${key}`,variant_key:key,name:`${base.parent_name} — ${label}`,modifier_type:'achievement_diary',axis_coverage:['achievement_modifier'],entry_level:entryLevel,requirements,xp_per_lap:xp,cycle_ticks:cycleTicks,cycle_seconds:cycleSeconds,observed_xp_per_hour:observed,source_locator:locator(entry,totals,rates)}));
}

function seers(base,content){
  const entry=entryMatch(content),total=lineMatch(content,/Players gain\s*([\d,]+)\s*experience in total per completed lap/i),failure=lineMatch(content,/obstacles will stop failing at\s*(\d+)\s*Agility/i),rates=lineMatch(content,/A perfect lap takes\s*(\d+)\s*ticks, or\s*([\d.]+)\s*seconds\s*\(~([\d.]+)\s*seconds with Seers bank teleport\)[\s\S]{0,180}?([\d,]+)\s*per hour[\s\S]{0,100}?or\s*([\d,]+)\s*per hour/i),marks=lineMatch(content,/\|None\s*\r?\n\|([\d.]+)[\s\S]*?\|Easy\s*\r?\n\|([\d.]+)[\s\S]*?\|Medium\s*\r?\n\|([\d.]+)[\s\S]*?\|Hard\s*\r?\n\|([\d.]+)/i),diary=lineMatch(content,/Completing the \[\[hard Kandarin Diary\]\] for the \[\[Camelot Teleport\]\][^.]*increasing the experience gained per hour/i);
  if(!entry||!total||!failure||!rates||!marks)return [];
  const entryLevel=number(entry.match[1]),xp=number(total.match[1]),failureFree=number(failure.match[1]),cycleTicks=number(rates.match[1]),cycleSeconds=number(rates.match[2]),baseRate=number(rates.match[4]),markRates={none:number(marks.match[1]),easy:number(marks.match[2]),medium:number(marks.match[3]),hard:number(marks.match[4])},rows=[];
  for(const [key,label,requirements] of [['none','No diary',[]],['easy','Kandarin Easy Diary',['Kandarin Easy Diary']],['medium','Kandarin Medium Diary',['Kandarin Medium Diary']],['hard_standard','Kandarin Hard Diary — standard return',['Kandarin Hard Diary']]]){const tier=key==='hard_standard'?'hard':key;rows.push(record(base,{record_key:`agility-modifier:${base.parent_name}:${key}`,variant_key:key,name:`${base.parent_name} — ${label}`,modifier_type:'achievement_diary',axis_coverage:['achievement_modifier'],entry_level:entryLevel,requirements,xp_per_lap:xp,cycle_ticks:cycleTicks,cycle_seconds:cycleSeconds,failure_free_level:failureFree,observed_xp_per_hour:baseRate,objective_metrics:{marks_of_grace_per_hour:markRates[tier]},source_locator:locator(entry,total,failure,rates,marks)}))}
  rows.push(record(base,{record_key:`agility-modifier:${base.parent_name}:hard_bank_teleport`,variant_key:'hard_bank_teleport',name:`${base.parent_name} — Kandarin Hard Diary — bank teleport`,modifier_type:'achievement_diary_route',axis_coverage:['achievement_modifier'],entry_level:entryLevel,requirements:['Kandarin Hard Diary'],inherit_parent_mechanics:false,xp_per_lap:xp,cycle_ticks:null,cycle_seconds:null,cycle_seconds_observed_approximate:number(rates.match[3]),failure_free_level:failureFree,observed_xp_per_hour:number(rates.match[5]),observed_rate_approximate:true,objective_metrics:{marks_of_grace_per_hour:null},source_locator:locator(entry,total,failure,rates,diary)}));
  return rows;
}

function ardougne(base,content){
  const entry=entryMatch(content),rates=lineMatch(content,/A full lap[^\n]*?([\d.]+)\s*seconds\s*\((\d+)\s*\[\[tick\]\]s\)[^\n]*?maximum experience per hour\s*([\d,.]+)/i),elite=lineMatch(content,/Completing the \[\[elite Ardougne Diary\]\][^\n]*?increase[^\n]*?marks of grace[^\n]*?by\s*(\d+)%[^\n]*?([\d.]+)\s*marks per hour/i),timers=lineMatch(content,/theoretical maximum of\s*([\d.]+)\s*tokens per hour without the diary, and\s*([\d.]+)\s*per hour with the diary/i);
  if(!entry||!rates||!elite||!timers)return [];
  const common={modifier_type:'achievement_diary_reward',axis_coverage:['achievement_modifier'],entry_level:number(entry.match[1]),cycle_ticks:number(rates.match[2]),cycle_seconds:number(rates.match[1]),observed_xp_per_hour:number(rates.match[3])};
  return [record(base,{...common,record_key:`agility-modifier:${base.parent_name}:standard`,variant_key:'standard',name:`${base.parent_name} — No diary`,requirements:[],objective_metrics:{marks_of_grace_per_hour_average:null,marks_of_grace_per_hour_theoretical:number(timers.match[1])},source_locator:locator(entry,rates,timers)}),record(base,{...common,record_key:`agility-modifier:${base.parent_name}:ardougne_elite`,variant_key:'ardougne_elite',name:`${base.parent_name} — Ardougne Elite Diary`,requirements:['Ardougne Elite Diary'],objective_metrics:{mark_chance_multiplier:1+number(elite.match[1])/100,marks_of_grace_per_hour_average:number(elite.match[2]),marks_of_grace_per_hour_theoretical:number(timers.match[2])},source_locator:locator(entry,rates,elite,timers)})];
}

function rellekka(base,content){
  const entry=entryMatch(content),rates=lineMatch(content,/A full lap[^\n]*?([\d.]+)\s*seconds\s*\((\d+)\s*\[\[tick\]\]s\)[^\n]*?maximum rate of\s*([\d,.]+)\s*experience per hour[^\n]*?maximum rate of\s*([\d,.]+)\s*experience per hour with[^\n]*?\[\[hard Fremennik Diary\]\][^\n]*?roughly\s*([\d,.]+)\s*xp\/hr[^\n]*?\[\[Fremennik sea boots 4\]\]/i);
  if(!entry||!rates)return [];
  const seconds=number(rates.match[1]),ticks=number(rates.match[2]),standardRate=number(rates.match[3]),hardRate=number(rates.match[4]),bootsBonus=number(rates.match[5]),standardXp=Math.round(standardRate*seconds/3600*10)/10,hardXp=Math.round(hardRate*seconds/3600*10)/10,common={modifier_type:'achievement_diary',entry_level:number(entry.match[1])},derived=()=>({...locator(entry,rates),derivations:{xp_per_lap:'observed_xp_per_hour * cycle_seconds / 3600',rounded_decimal_places:1}});
  return [record(base,{...common,record_key:`agility-modifier:${base.parent_name}:standard`,variant_key:'standard',name:`${base.parent_name} — No diary`,axis_coverage:['achievement_modifier'],requirements:[],xp_per_lap:standardXp,cycle_ticks:ticks,cycle_seconds:seconds,observed_xp_per_hour:standardRate,source_locator:derived()}),record(base,{...common,record_key:`agility-modifier:${base.parent_name}:fremennik_hard`,variant_key:'fremennik_hard',name:`${base.parent_name} — Fremennik Hard Diary`,axis_coverage:['achievement_modifier'],requirements:['Fremennik Hard Diary'],xp_per_lap:hardXp,cycle_ticks:ticks,cycle_seconds:seconds,observed_xp_per_hour:hardRate,source_locator:derived()}),record(base,{...common,record_key:`agility-modifier:${base.parent_name}:sea_boots_4`,variant_key:'sea_boots_4',name:`${base.parent_name} — Fremennik sea boots 4 teleport`,axis_coverage:['achievement_modifier','equipment_modifier'],requirements:['Fremennik Elite Diary','Fremennik sea boots 4'],inherit_parent_mechanics:false,xp_per_lap:hardXp,cycle_ticks:null,cycle_seconds:null,observed_xp_per_hour:hardRate+bootsBonus,observed_rate_approximate:true,observed_xp_bonus_per_hour_approximate:bootsBonus,source_locator:derived()})];
}

export function parseAgilityModifierVariants({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  const base={contract:'sensum.agility-modifier-variant.v1',parent_name:title,source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl};
  if(title==='Pollnivneach Rooftop Course')return pollnivneach(base,content);
  if(title==="Seers' Village Rooftop Course")return seers(base,content);
  if(title==='Ardougne Rooftop Course')return ardougne(base,content);
  if(title==='Rellekka Rooftop Course')return rellekka(base,content);
  return [];
}
