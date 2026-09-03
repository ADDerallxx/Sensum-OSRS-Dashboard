const number=value=>Number(String(value||'').replace(/,/g,''));
const lineAt=(content,index)=>content.slice(0,index).split(/\r?\n/).length;
const excerpt=(page,match)=>({sourceRevision:String(page.sourceRevision||''),sourceUrl:page.sourceUrl,line:lineAt(page.content,match.index),excerpt:match[0].slice(0,1600)});

export function parseBrimhavenDetachedFloorSpikeVariants({obstaclePage,arenaPage,guidePage,successEvidence=[]}){
  if(obstaclePage?.title!=='Floor spikes (Brimhaven Agility Arena)'||arenaPage?.title!=='Brimhaven Agility Arena'||guidePage?.title!=='Agility training')return [];
  const obstacle=obstaclePage.content||'',arena=arenaPage.content||'',guide=guidePage.content||'';
  const info=obstacle.match(/\{\{Agility info[\s\S]{0,600}?\|version1\s*=\s*Standard[\s\S]{0,120}?\|version2\s*=\s*Karamja gloves[\s\S]{0,120}?\|level\s*=\s*(\d+)[\s\S]{0,120}?\|xp1\s*=\s*([\d.]+)[\s\S]{0,120}?\|xp2\s*=\s*([\d.]+)[\s\S]{0,180}?\|type\s*=\s*Obstacle[\s\S]{0,80}?\}\}/i);
  const failure=obstacle.match(/Failing to jump across the spikes successfully will cause the player to take damage[\s\S]{0,180}?no longer fail this obstacle at level\s+(\d+)\s+\[\[Agility\]\]/i);
  const lowAttention=obstacle.match(/clicking outside the agility arena can cause a character to route over the spikes[\s\S]{0,260}?continuously jump over the spikes, to gain very low-attention Agility experience/i);
  const access=arena.match(/course has no requirements to access other than a\s+([\d,]+)\s+\[\[coins\]\] fee/i);
  const arenaRequirement=arena.match(/level\s+(\d+)\s+Agility is required to pass[\s\S]{0,220}?\[\[Floor spikes \(Brimhaven Agility Arena\)\|floor spike\]\] obstacles/i);
  const gloves=arena.match(/Wear \[\[Karamja gloves 2\]\],[\s\S]{0,100}?\[\[Karamja gloves 4\|4\]\] for\s+(\d+)%\s+extra Agility experience from obstacles in the Brimhaven Agility Arena/i);
  const table=arena.match(/\[\[Floor spikes \(Brimhaven Agility Arena\)\|Floor spikes\]\]\s*\n\|\s*([\d.]+)\s*\(([\d.]+)\)\s*\n\|\s*(\d+)\s*t\s*\n\|\s*([\d.]+)\s*\n\|\s*-\s*\n\|\s*(\d+)/i);
  const guideHeading=guide.match(/===Levels\s+(\d+)[–-](\d+): Brimhaven Agility Arena===/i);
  const guideRate=guide.match(/Additionally, the floor spike obstacle can be used[\s\S]{0,140}?very low intensity[\s\S]{0,140}?approximately\s+([\d,]+)\s+experience per hour[\s\S]{0,220}?"Detached Camera" plugin/i);
  if(!info||!failure||!lowAttention||!access||!arenaRequirement||!gloves||!table||!guideHeading||!guideRate)return [];

  const entryLevel=number(info[1]),standardXp=number(info[2]),gloveXp=number(info[3]),failureFreeLevel=number(failure[1]),entryFee=number(access[1]),arenaLevel=number(arenaRequirement[1]),gloveBonus=number(gloves[1]),tableStandardXp=number(table[1]),tableGloveXp=number(table[2]),cycleTicks=number(table[3]),tableXpPerTick=number(table[4]),tableLevel=number(table[5]),guideLevelMinimum=number(guideHeading[1]),guideLevelMaximum=number(guideHeading[2]),equipmentUnscopedRate=number(guideRate[1]);
  const consistent=entryLevel===arenaLevel&&entryLevel===tableLevel&&entryLevel===guideLevelMinimum&&guideLevelMaximum>=guideLevelMinimum&&standardXp===tableStandardXp&&gloveXp===tableGloveXp&&Math.abs(gloveXp-standardXp*(1+gloveBonus/100))<1e-9&&Math.abs(tableXpPerTick-standardXp/cycleTicks)<1e-9&&failureFreeLevel>entryLevel;
  if(!consistent)return [];

  const targetSuccessEvidence=successEvidence.find(row=>row.candidate_key==='guide:brimhaven:floor-spikes-detached')||null;
  if(!targetSuccessEvidence)return [];
  const sourceLocator={
    obstacle:{agilityInfo:excerpt(obstaclePage,info),failure:excerpt(obstaclePage,failure),lowAttention:excerpt(obstaclePage,lowAttention)},
    arena:{access:excerpt(arenaPage,access),requirement:excerpt(arenaPage,arenaRequirement),gloves:excerpt(arenaPage,gloves),tableRow:excerpt(arenaPage,table)},
    guide:{section:excerpt(guidePage,guideHeading),equipmentUnscopedRate:excerpt(guidePage,guideRate)},
    successModel:targetSuccessEvidence.source_locator
  };
  const supportingSourceRevisions=[String(arenaPage.sourceRevision||''),String(guidePage.sourceRevision||''),...(targetSuccessEvidence.supporting_source_revisions||[])].filter(Boolean);
  const common={
    contract:'sensum.agility-floor-spike-training-variant.v1',
    parent_name:'Brimhaven Agility Arena',
    record_kind:'repeatable_method',
    standalone_training_method:true,
    axis_coverage:['obstacle_training_method','low_intensity_strategy','equipment_modifier','failure_condition'],
    entry_level:entryLevel,
    entry_boostable:null,
    boost_policy:'not_stated_by_source',
    skill_requirements:{Agility:entryLevel},
    action_unit:'obstacle_crossing',
    cycle_ticks:cycleTicks,
    failure_free_level:failureFreeLevel,
    unmodeled_level_ranges:targetSuccessEvidence.failure_probability_at_target===null?[{minimum:entryLevel,maximum:failureFreeLevel-1,blocker:targetSuccessEvidence.target_condition_blocker}]:[],
    success_model_evidence:targetSuccessEvidence,
    success_probability_target_base_agility:targetSuccessEvidence.target_base_agility,
    success_probability_at_target:targetSuccessEvidence.success_probability_at_target,
    failure_probability_at_target:targetSuccessEvidence.failure_probability_at_target,
    observed_xp_per_hour_equipment_unscoped:equipmentUnscopedRate,
    observed_rate_scope:{agility_level:{minimum:guideLevelMinimum,maximum:guideLevelMaximum},equipment_state:null,approximate:true},
    source_warning:'observed_rate_equipment_state_unspecified',
    source_rate_conflict:{rule:'observed_rate_equipment_state_unspecified',severity:'blocker',value:equipmentUnscopedRate,level_scope:{minimum:guideLevelMinimum,maximum:guideLevelMaximum},resolution:'unresolved'},
    intensity:'very_low_detached_camera',
    client_aid:'Detached Camera plugin',
    requirements:[`${entryFee} coins entry fee`],
    inherit_parent_mechanics:false,
    source_revision:String(obstaclePage.sourceRevision||''),
    supporting_source_revisions:supportingSourceRevisions,
    source_timestamp:obstaclePage.sourceTimestamp||null,
    source_url:obstaclePage.sourceUrl,
    source_locator:sourceLocator,
    state:'candidate'
  };
  return [
    {...common,record_key:'agility-obstacle-training:Brimhaven Agility Arena:detached_floor_spikes_standard',variant_key:'detached_floor_spikes_standard',name:'Brimhaven Agility Arena — Detached-camera floor spikes — Standard',xp_per_success:standardXp,equipment_policy:'no_karamja_gloves_bonus'},
    {...common,record_key:'agility-obstacle-training:Brimhaven Agility Arena:detached_floor_spikes_karamja_gloves',variant_key:'detached_floor_spikes_karamja_gloves',name:'Brimhaven Agility Arena — Detached-camera floor spikes — Karamja gloves',xp_per_success:gloveXp,equipment_policy:'karamja_gloves_bonus',equipment_requirement:{mode:'one_of',items:['Karamja gloves 2','Karamja gloves 3','Karamja gloves 4']},requirement_alternatives:['Karamja gloves 2','Karamja gloves 3','Karamja gloves 4']}
  ];
}
