import {expectedXpPerAttempt} from '../formulas/skilling-success-v1.mjs';

const number=value=>Number(String(value||'').replace(/,/g,''));
const normalize=value=>String(value||'').trim().toLowerCase();
const lineAt=(content,index)=>content.slice(0,index).split(/\r?\n/).length;
const excerpt=(page,match)=>({sourceRevision:String(page.sourceRevision||''),sourceUrl:page.sourceUrl,line:lineAt(page.content,match.index),excerpt:match[0].slice(0,1800)});

const fishNames=['Leaping trout','Leaping salmon','Leaping sturgeon'];
const benchmarkLevels=[48,58,70,80,90,99];

function parseFishPage(page){
  const escaped=page.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),content=page.content||'';
  const claim=content.match(new RegExp(`'''${escaped}'''[\\s\\S]{0,240}?requires\\s+(\\d+)\\s+\\[\\[Fishing\\]\\],\\s+(\\d+)\\s+\\[\\[Strength\\]\\],\\s+and\\s+(\\d+)\\s+\\[\\[Agility\\]\\][\\s\\S]{0,180}?providing\\s+([\\d.]+)\\s+Fishing experience,\\s+([\\d.]+)\\s+Strength experience,\\s+and\\s+([\\d.]+)\\s+Agility experience`, 'i'));
  const bait=content.match(/order in which bait is consumed[\s\S]{0,220}?\[\[fish offcuts\]\][\s\S]{0,100}?\[\[fishing bait\]\][\s\S]{0,100}?\[\[Feather\|feathers\]\][\s\S]{0,100}?\[\[roe\]\][\s\S]{0,100}?\[\[caviar\]\]/i);
  const chart=content.match(/\{\{Skilling success chart\|label=Barbarian rod fishing chance[\s\S]{0,700}?\}\}/i);
  if(!claim||!bait||!chart)return null;
  const rolls={};
  for(const match of chart[0].matchAll(/label(\d+)\s*=\s*(Leaping (?:trout|salmon|sturgeon))\s*\|low\1\s*=\s*(\d+)\s*\|high\1\s*=\s*(\d+)\s*\|req\1\s*=\s*(\d+)/gi))rolls[normalize(match[2])]={index:number(match[1]),low:number(match[3]),high:number(match[4]),requiredFishing:number(match[5])};
  if(Object.keys(rolls).length!==3)return null;
  return {name:page.title,requirements:{Fishing:number(claim[1]),Strength:number(claim[2]),Agility:number(claim[3])},xp:{Fishing:number(claim[4]),Strength:number(claim[5]),Agility:number(claim[6])},roll:rolls[normalize(page.title)],source:{claim:excerpt(page,claim),baitOrder:excerpt(page,bait),successChart:excerpt(page,chart)}};
}

function parseMethodFishTable(page){
  const content=page.content||'',rows=[];
  for(const name of fishNames){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),match=content.match(new RegExp(`\\{\\{plinkt\\|${escaped}\\}\\}\\s*\\n\\|\\s*(\\d+)\\s*\\|\\|\\s*(\\d+)\\s*\\|\\|\\s*(\\d+)\\s*\\|\\|\\s*(\\d+)\\s*\\n\\|\\s*([\\d.]+)\\s*\\|\\|\\s*([\\d.]+)\\s*\\|\\|\\s*([\\d.]+)\\s*\\|\\|\\s*([\\d.]+)\\s*\\|\\|\\s*([\\d.]+)`, 'i'));
    if(!match)return [];
    rows.push({name,requirements:{Fishing:number(match[1]),Strength:number(match[2]),Agility:number(match[3]),Cooking:number(match[4])},xp:{Fishing:number(match[5]),Strength:number(match[6]),Agility:number(match[7]),Cooking:number(match[8]),Total:number(match[9])},source:excerpt(page,match)});
  }
  return rows;
}

function parseRates(page){
  const rows=[];
  for(const level of benchmarkLevels){
    const match=(page.content||'').match(new RegExp(`\\|-\\s*\\n\\|\\s*${level}\\s*\\n\\|\\s*([\\d,]+)\\s*\\n\\|\\s*([\\d,]+)\\s*\\n\\|\\s*([\\d,]+)\\s*\\n\\|\\s*([\\d,]+)\\s*\\n\\|\\s*([\\d,]+)\\s*\\n\\|\\s*([\\d,]+)\\s*\\n\\|\\s*([\\d,]+)`, 'i'));
    if(!match)return [];
    rows.push({FishingLevel:level,afk:{Fishing:number(match[1]),Other:number(match[2]),Total:number(match[3])},threeTick:{Fishing:number(match[4]),Other:number(match[5]),Cooking:number(match[6]),Total:number(match[7])},source:excerpt(page,match)});
  }
  return rows;
}

const same=value=>JSON.stringify(value);
export function parseBarbarianFishingVariants({pages}){
  const byTitle=new Map((pages||[]).map(page=>[page.title,page])),training=byTitle.get('Barbarian Training'),guide=byTitle.get('Pay-to-play Fishing training'),formulaPage=byTitle.get('Module:Skilling success chart'),fish=fishNames.map(name=>byTitle.get(name)).map(page=>page&&parseFishPage(page));
  const formula=(formulaPage?.content||'').match(/function p\.interp\(low, high, level\)[\s\S]{0,260}?math\.floor\(low\*\(99-level\)\/98 \+ high\*\(level-1\)\/98 \+ 0\.5\) \+ 1[\s\S]{0,120}?value \/ 256[\s\S]{0,800}?function cascadeInterp\(bounds, level, index\)[\s\S]{0,500}?rate = rate \* \(1 - p\.interp\(low, high, level\)\)/i);
  if(!training||!guide||!formulaPage||!formula||fish.some(row=>!row)){if(process.env.SENSUM_BARBARIAN_FISHING_DEBUG)console.error('Barbarian Fishing page blockers',{training:!!training,guide:!!guide,formulaPage:!!formulaPage,formula:!!formula,fish:fish.map(Boolean)});return []}
  const methodIntro=(training.content||'').match(/\{\{Needed\|\[\[Barbarian rod\]\][\s\S]{0,300}?skills=\{\{SCP\|Fishing\|48[\s\S]{0,180}?\{\{SCP\|Strength\|15[\s\S]{0,100}?\}\}\}\}/i);
  const method=(training.content||'').match(/Use the rod at the \[\[Fishing spot \(barbarian\)\|fishing spots\]\][\s\S]{0,180}?catch \[\[leaping trout\]\], \[\[leaping salmon\]\], or \[\[leaping sturgeon\]\][\s\S]{0,160}?low-effort[\s\S]{0,120}?grants \[\[Strength\]\] and \[\[Agility\]\] experience/i);
  const rateAssumptions=(guide.content||'').match(/The experience rates (?:shown )?in the table below assume the player is not wearing the \[\[angler's outfit\]\][\s\S]{0,260}?AFK rates include the time spent dropping the fish[\s\S]{0,220}?Cooking rates from using the cut-eat method assumes level 99 Cooking/i);
  const threeTick=(guide.content||'').match(/basic method for 3-tick fishing is to drop the fish between catches[\s\S]{0,360}?start the 3-tick cycle[\s\S]{0,200}?requires accurate clicking and some practice/i);
  const cutEat=(guide.content||'').match(/"Cut-eat" or "eat-cut" fishing[\s\S]{0,500}?level 80 Cooking is recommended[\s\S]{0,500}?starting a 3-tick cycle with herb and tar[\s\S]{0,500}?knife[\s\S]{0,1000}?less predictable due to randomness/i);
  const location=(guide.content||'').match(/best spot for Barbarian Fishing is at the pond next to the \[\[Otto's Grotto\]\]/i);
  const methodFish=parseMethodFishTable(training),trainingRates=parseRates(training),guideRates=parseRates(guide);
  if(!methodIntro||!method||!rateAssumptions||!threeTick||!cutEat||!location||methodFish.length!==3||trainingRates.length!==6||guideRates.length!==6){if(process.env.SENSUM_BARBARIAN_FISHING_DEBUG)console.error('Barbarian Fishing parse blockers',{methodIntro:!!methodIntro,method:!!method,rateAssumptions:!!rateAssumptions,threeTick:!!threeTick,cutEat:!!cutEat,location:!!location,methodFish:methodFish.length,trainingRates:trainingRates.length,guideRates:guideRates.length});return []}
  if(fish.some((row,index)=>{const table=methodFish[index];return row.name!==table.name||row.requirements.Fishing!==table.requirements.Fishing||row.requirements.Strength!==table.requirements.Strength||row.requirements.Agility!==table.requirements.Agility||row.xp.Fishing!==table.xp.Fishing||row.xp.Strength!==table.xp.Strength||row.xp.Agility!==table.xp.Agility})){if(process.env.SENSUM_BARBARIAN_FISHING_DEBUG)console.error('Barbarian Fishing fish table contradiction',{fish:fish.map(row=>({name:row.name,requirements:row.requirements,xp:row.xp})),methodFish});return []}
  if(same(trainingRates.map(({source,...row})=>row))!==same(guideRates.map(({source,...row})=>row))){if(process.env.SENSUM_BARBARIAN_FISHING_DEBUG)console.error('Barbarian Fishing rate table contradiction',{trainingRates,guideRates});return []}

  const supportingSourceRevisions=[String(guide.sourceRevision||''),String(formulaPage.sourceRevision||''),...fish.map(row=>String(byTitle.get(row.name).sourceRevision||''))].filter(Boolean),orderedBounds=[...fish].sort((a,b)=>a.roll.index-b.roll.index).map(row=>({key:normalize(row.name),requiredLevel:row.roll.requiredFishing,low:row.roll.low,high:row.roll.high})),xpByKey=Object.fromEntries(fish.map(row=>[normalize(row.name),row.xp.Agility])),records=[];
  for(const rate of trainingRates){
    const available=fish.filter(row=>row.requirements.Fishing<=rate.FishingLevel),highest=available.at(-1),expected=expectedXpPerAttempt({bounds:orderedBounds,level:rate.FishingLevel,xpByKey}),base={
      contract:'sensum.agility-barbarian-fishing-variant.v1',parent_name:'Barbarian Fishing',record_kind:'hybrid_training_method',standalone_training_method:true,axis_coverage:['fishing_level_benchmark','catch_mix','interaction_policy','multi_skill_rewards'],
      entry_level:highest.requirements.Agility,entry_boostable:null,boost_policy:'not_stated_by_source',skill_requirements:{Fishing:rate.FishingLevel,Strength:highest.requirements.Strength,Agility:highest.requirements.Agility},
      equipment_requirement:{mode:'one_of',items:['Barbarian rod','Pearl barbarian rod']},requirements:['Started the Fishing section of Barbarian Training'],requirement_alternatives:['Fishing bait','Feathers','Fish offcuts','Roe','Caviar'],location:"Otto's Grotto",rate_benchmark_fishing_level:rate.FishingLevel,
      available_catches:available.map(row=>({name:row.name,requirements:row.requirements,xp_per_catch:row.xp})),catch_roll_parameters:available.map(row=>({name:row.name,...row.roll})),catch_probabilities:expected.outcomes.filter(row=>row.probability>0),no_catch_probability:expected.noOutcomeProbability,catch_probability_formula:{key:'skilling.success_chart_cascade',version:`wiki-module-r${formulaPage.sourceRevision}`,source_revision:String(formulaPage.sourceRevision||'')},xp_per_attempt:expected.expectedXp,failure_model_required:false,action_unit:'catch_attempt',observed_comparison_policy:'mechanical_upper_bound_vs_practical_observed',
      source_revision:String(training.sourceRevision||''),supporting_source_revisions:supportingSourceRevisions,source_timestamp:training.sourceTimestamp||null,source_url:training.sourceUrl,
      source_locator:{methodRequirements:excerpt(training,methodIntro),method:excerpt(training,method),methodFishTable:methodFish.map(row=>row.source),trainingRate:rate.source,guideRate:guideRates.find(row=>row.FishingLevel===rate.FishingLevel).source,rateAssumptions:excerpt(guide,rateAssumptions),location:excerpt(guide,location),fish:available.map(row=>row.source),formula:excerpt(formulaPage,formula)},state:'candidate'
    };
    const xpPerSuccess=available.length===1?available[0].xp.Agility:null;
    const rateBySkill=other=>({Fishing:other.Fishing,Strength:other.Other,Agility:other.Other});
    records.push({...base,record_key:`agility-barbarian-fishing:afk:${rate.FishingLevel}`,variant_key:`afk_fishing_${rate.FishingLevel}`,name:`Barbarian Fishing — AFK drop — Fishing ${rate.FishingLevel}`,interaction_policy:'afk_drop',intensity:'low_effort',cycle_ticks:null,cycle_timing_blocker:'afk_catch_attempt_cycle_including_drop_time_not_published',xp_per_success:xpPerSuccess,observed_xp_per_hour:rate.afk.Other,observed_xp_per_hour_by_skill:{...rateBySkill(rate.afk),Total:rate.afk.Total},observed_rate_kind:'source_table_afk_benchmark',observed_rate_approximate:true,observed_rate_condition_scope:{skill:'Fishing',minimum:rate.FishingLevel,maximum:rate.FishingLevel,angler_outfit:false,dropping_time_included:true,drop_speed_affects_rate:true},observed_comparison_policy:'observational_benchmark_without_published_attempt_cycle',observed_rate_source_revision:String(training.sourceRevision||''),observed_rate_source_url:training.sourceUrl,observed_rate_source_locator:{rateTable:rate.source,corroboratingRateTable:guideRates.find(row=>row.FishingLevel===rate.FishingLevel).source,rateAssumptions:excerpt(guide,rateAssumptions)}});
    const threeTickCommon={...base,interaction_policy:'three_tick',intensity:'high',cycle_ticks:3,xp_per_success:xpPerSuccess,observed_xp_per_hour:rate.threeTick.Other,observed_xp_per_hour_by_skill:rateBySkill(rate.threeTick),tick_manipulation_requirements:{mode:'one_of',methods:['Herb and tar','Knife and teak or mahogany logs']},source_locator:{...base.source_locator,interaction:excerpt(guide,threeTick)}};
    records.push({...threeTickCommon,record_key:`agility-barbarian-fishing:three_tick_drop:${rate.FishingLevel}`,variant_key:`three_tick_drop_fishing_${rate.FishingLevel}`,name:`Barbarian Fishing — 3-tick drop — Fishing ${rate.FishingLevel}`,disposal_policy:'drop'});
    records.push({...threeTickCommon,record_key:`agility-barbarian-fishing:three_tick_cut_eat:${rate.FishingLevel}`,variant_key:`three_tick_cut_eat_fishing_${rate.FishingLevel}`,name:`Barbarian Fishing — 3-tick cut-eat — Fishing ${rate.FishingLevel}`,skill_requirements:{...threeTickCommon.skill_requirements,Cooking:99},requirements:[...threeTickCommon.requirements,'Knife','Cooking 99 rate benchmark'],disposal_policy:'cut_eat',observed_xp_per_hour_by_skill:{...rateBySkill(rate.threeTick),Cooking:rate.threeTick.Cooking,Total:rate.threeTick.Total},source_locator:{...base.source_locator,interaction:excerpt(guide,cutEat)}});
  }
  return records;
}
