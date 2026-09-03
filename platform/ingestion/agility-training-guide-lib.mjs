const number=value=>Number(String(value||'').replace(/,/g,''));
const lineMatch=(content,pattern)=>{const match=content.match(pattern);return match?{match,line:content.slice(0,match.index).split(/\r?\n/).length,text:match[0].slice(0,1600)}:null};
const locator=(...evidence)=>({evidence:evidence.filter(Boolean).map(x=>({line:x.line,excerpt:x.text}))});
const record=(base,data)=>({...base,...data,state:'candidate'});

export function parseBarbarianFishingEligibility({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Barbarian Training')return [];
  const section=lineMatch(content,/===Heavy rod fishing===[\s\S]{0,900}?\{\{SCP\|Strength\|\d+\|[^}]*\}\}/i);
  if(!section)return [];
  const skillRequirements={};
  for(const skill of ['Fishing','Agility','Strength']){
    const match=section.text.match(new RegExp(`\\{\\{SCP\\|${skill}\\|(\\d+)\\|[^}]*\\}\\}`,'i'));
    if(!match)return [];
    skillRequirements[skill]=number(match[1]);
  }
  return [{
    contract:'sensum.agility-candidate-eligibility-evidence.v1',
    evidence_key:'eligibility:barbarian-fishing:heavy-rod',
    candidate_key:'guide:barbarian-fishing',
    method_variant:'heavy_rod_fishing',
    skill_requirements:skillRequirements,
    source_revision:String(sourceRevision||''),
    source_timestamp:sourceTimestamp||null,
    source_url:sourceUrl,
    source_locator:locator(section),
    state:'candidate'
  }];
}

export function parseBrimhavenFloorSpikeEligibility({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Brimhaven Agility Arena')return [];
  const access=lineMatch(content,/course has no requirements to access other than a\s+([\d,]+)\s+\[\[coins\]\] fee/i);
  const obstacle=lineMatch(content,/level\s+(\d+)\s+Agility is required to pass[\s\S]{0,260}?\[\[Floor spikes \(Brimhaven Agility Arena\)\|floor spike\]\] obstacles/i);
  if(!access||!obstacle)return [];
  const entryLevel=number(obstacle.match[1]),entryFee=number(access.match[1]);
  return [{
    contract:'sensum.agility-candidate-eligibility-evidence.v1',
    evidence_key:'eligibility:brimhaven:detached-floor-spikes',
    candidate_key:'guide:brimhaven:floor-spikes-detached',
    method_variant:'detached_camera_floor_spikes',
    eligibility_scope:'floor_spike_obstacle',
    skill_requirements:{Agility:entryLevel},
    requirements:[`${entryFee} coins entry fee`],
    source_revision:String(sourceRevision||''),
    source_timestamp:sourceTimestamp||null,
    source_url:sourceUrl,
    source_locator:locator(access,obstacle),
    state:'candidate'
  }];
}

export function parseRooftopTargetConditionEvidence({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  const candidates={
    'Al Kharid Rooftop Course':{candidateKey:'guide:rooftop:al-kharid',failurePattern:/possible to fail the ''([^']+)'' and ''([^']+)'' obstacles[\s\S]{0,100}?taking\s+(\d+)[–-](\d+)\s+damage each time/i},
    'Varrock Rooftop Course':{candidateKey:'guide:rooftop:varrock',failurePattern:/possible to fail during\s+([^\n.]+?)\s+and\s+([^\n.]+?)\s+and get inflicted with\s+(\d+)[–-](\d+)\s+and\s+(\d+)[–-](\d+)\s+damage respectively/i}
  },candidate=candidates[title];
  if(!candidate)return [];
  const entry=lineMatch(content,/available to players with an \[\[Agility\]\] level of\s+(\d+)\s+or higher/i);
  const failure=lineMatch(content,candidate.failurePattern);
  if(!entry||!failure)return [];
  const sharedDamage={minimum:number(failure.match[3]),maximum:number(failure.match[4])};
  return [{
    contract:'sensum.agility-candidate-condition-evidence.v1',
    evidence_key:`condition:${candidate.candidateKey.slice('guide:rooftop:'.length)}-rooftop:failure`,
    candidate_key:candidate.candidateKey,
    method_variant:'standard_lap',
    entry_level:number(entry.match[1]),
    failure_possible:true,
    failure_outcomes:[
      {obstacle:failure.match[1],damage:sharedDamage},
      {obstacle:failure.match[2],damage:failure.match[5]===undefined?sharedDamage:{minimum:number(failure.match[5]),maximum:number(failure.match[6])}}
    ],
    source_revision:String(sourceRevision||''),
    source_timestamp:sourceTimestamp||null,
    source_url:sourceUrl,
    source_locator:locator(entry,failure),
    state:'candidate'
  }];
}

export function enrichAgilityCandidateEligibility(records,evidenceRows){
  const evidenceByCandidate=new Map((evidenceRows||[]).map(row=>[row.candidate_key,row]));
  return records.map(row=>{
    const evidence=evidenceByCandidate.get(row.candidate_key);
    if(!evidence)return row;
    const sourceAgility=number(evidence.skill_requirements?.Agility);
    const contradictions=[];
    if(!sourceAgility||sourceAgility!==number(row.minimum_agility))contradictions.push({
      rule:'supporting_agility_requirement_disagrees',
      guideMinimum:number(row.minimum_agility),
      supportingMinimum:sourceAgility||null
    });
    if(contradictions.length)return {
      ...row,
      eligibility_contradictions:contradictions,
      supporting_eligibility_evidence:evidence,
      ...(row.other_skill_requirement_unknown===true?{other_skill_requirement_unknown:true}:{}),
      ...(row.level_scope_ambiguous===true?{level_scope_ambiguous:true}:{})
    };
    const resolvesCrossSkill=row.other_skill_requirement_unknown===true,resolvesLevelScope=row.level_scope_ambiguous===true;
    return {
      ...row,
      skill_requirements:{...evidence.skill_requirements},
      requirements:[...new Set([...(row.requirements||[]),...(evidence.requirements||[])])],
      ...(resolvesCrossSkill?{other_skill_requirement_unknown:false}:{}),
      ...(resolvesLevelScope?{level_scope_ambiguous:false,minimum_agility_source:'supporting_obstacle_requirement',eligibility_scope:evidence.eligibility_scope}:{}),
      supporting_source_revisions:[...new Set([...(row.supporting_source_revisions||[]),evidence.source_revision])],
      supporting_eligibility_evidence:evidence
    };
  });
}

export function enrichAgilityCandidateConditions(records,evidenceRows){
  const evidenceByCandidate=new Map((evidenceRows||[]).map(row=>[row.candidate_key,row]));
  return records.map(row=>{
    const evidence=evidenceByCandidate.get(row.candidate_key);
    if(!evidence)return row;
    return {
      ...row,
      failure_possible:evidence.failure_possible===true,
      target_condition_evidence:evidence,
      supporting_source_revisions:[...new Set([...(row.supporting_source_revisions||[]),evidence.source_revision])]
    };
  });
}

export function parseAgilityTrainingGuideCandidates({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Agility training')return [];
  const base={contract:'sensum.agility-level34-candidate.v1',source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl};
  const questing=lineMatch(content,/===Levels\s+(\d+)[–-](\d+)\/(\d+): Questing===[\s\S]{0,700}?\[\[The Tourist Trap\]\][\s\S]{0,260}?\[\[Recruitment Drive\]\][\s\S]{0,160}?\[\[The Depths of Despair\]\][\s\S]{0,160}?\[\[The Grand Tree\]\][\s\S]{0,180}?total of\s+([\d,]+)\s+experience/i);
  const brimhavenHeading=lineMatch(content,/===Levels\s+(\d+)[–-](\d+): Brimhaven Agility Arena===/i);
  const brimhavenActive=lineMatch(content,/\[\[Brimhaven Agility Arena\]\] offers the fastest experience[\s\S]{0,180}?must have\s+([\d,]+)\s+coins[\s\S]{0,180}?\[\[Floor spikes \(Brimhaven Agility Arena\)\|floor spikes\]\] trap[\s\S]{0,120}?requires level\s+(\d+)[\s\S]{0,220}?up to\s+([\d,]+)\s+experience per hour as low as level\s+(\d+)\s+with the use of \[\[summer pie\]\][\s\S]{0,140}?Bringing food is advised/i);
  const brimhavenDetached=lineMatch(content,/Additionally, the floor spike obstacle can be used[\s\S]{0,120}?very low intensity[\s\S]{0,120}?approximately\s+([\d,]+)\s+experience per hour[\s\S]{0,180}?"Detached Camera" plugin/i);
  const rooftopsHeading=lineMatch(content,/===Levels\s+(\d+)[–-](\d+): Rooftop Agility Courses===/i);
  const draynorRooftop=lineMatch(content,/\|\s*1[–-]20\/30\s*\n\|\s*\[\[Draynor Village Rooftop Course\|Draynor Village\]\]\s*\n\|\s*([\d,]+)[–-]([\d,]+)/i);
  const alKharidRooftop=lineMatch(content,/\|\s*20[–-]30\s*\n\|\s*\[\[Al Kharid Rooftop Course\|Al Kharid\]\]\s*\n\|\s*([\d,]+)[–-]([\d,]+)/i);
  const varrockRooftop=lineMatch(content,/\|\s*30[–-]40\s*\n\|\s*\[\[Varrock Rooftop Course\|Varrock\]\]\s*\n\|\s*([\d,]+)[–-]([\d,]+)/i);
  const monkeybars=lineMatch(content,/===Levels\s+(\d+)[–-](\d+): Edgeville Dungeon monkeybars===[\s\S]{0,300}?offers up to\s+([\d,]+)\s+experience per hour[\s\S]{0,180}?located in the Wilderness/i);
  const barbarian=lineMatch(content,/===Levels\s+(\d+)[–-](\d+): Barbarian Fishing===[\s\S]{0,260}?grants small amounts of passive Agility and \[\[Strength\]\] experience[\s\S]{0,260}?Fishing from level\s+(\d+)\s+to\s+(\d+)/i);
  const pyramid=lineMatch(content,/===\s*Levels\s+(\d+)\+:\s*Agility Pyramid\s*===[\s\S]{0,500}?Roughly\s+(\d+)\s+completions[\s\S]{0,300}?early levels\s*\((\d+)[–-](\d+)\)[\s\S]{0,300}?([\d,]+)\s+experience per hour/i);
  if(!questing||!brimhavenHeading||!brimhavenActive||!brimhavenDetached||!rooftopsHeading||!draynorRooftop||!alKharidRooftop||!varrockRooftop||!monkeybars||!barbarian||!pyramid){if(process.env.SENSUM_LEVEL34_DEBUG){const pyramidAt=content.indexOf('Agility Pyramid');console.error('Agility guide parse blockers',{questing:!!questing,brimhavenHeading:!!brimhavenHeading,brimhavenActive:!!brimhavenActive,brimhavenDetached:!!brimhavenDetached,rooftopsHeading:!!rooftopsHeading,draynorRooftop:!!draynorRooftop,alKharidRooftop:!!alKharidRooftop,varrockRooftop:!!varrockRooftop,monkeybars:!!monkeybars,barbarian:!!barbarian,pyramid:!!pyramid,pyramidExcerpt:pyramidAt>=0?content.slice(Math.max(0,pyramidAt-300),pyramidAt+1400):null})}return []}
  const rows=[
    record(base,{candidate_key:'guide:questing:early-agility',name:'Early Agility quest rewards',record_kind:'one_time_progression',minimum_agility:number(questing.match[1]),guide_level_maximum:number(questing.match[3]),quests:['The Tourist Trap','Recruitment Drive','The Depths of Despair','The Grand Tree'],aggregate_xp:number(questing.match[4]),aggregate_only:true,source_locator:locator(questing)}),
    record(base,{candidate_key:'guide:brimhaven:floor-spikes-active',name:'Brimhaven Agility Arena — Repeated floor spikes',record_kind:'repeatable_method',minimum_agility:number(brimhavenActive.match[2]),guide_level_maximum:number(brimhavenHeading.match[2]),requirements:[`${number(brimhavenActive.match[1])} coins entry fee`],observed_xp_per_hour_upper:number(brimhavenActive.match[3]),observed_xp_per_hour_upper_scope:{minimum:number(brimhavenHeading.match[1]),maximum:number(brimhavenHeading.match[2])},observed_rate_kind:'source_stated_upper_bound',observed_rate_is_expected:false,boosted_minimum_base_agility:number(brimhavenActive.match[4]),boost_source:'Summer pie',failure_possible:true,failure_probability_published:false,food_advised:true,vector_match_terms:['Brimhaven Agility Arena','Active floor spikes'],source_locator:locator(brimhavenHeading,brimhavenActive)}),
    record(base,{candidate_key:'guide:brimhaven:floor-spikes-detached',name:'Brimhaven Agility Arena — Detached-camera floor spikes',record_kind:'repeatable_method',minimum_agility:number(brimhavenHeading.match[1]),guide_level_maximum:number(brimhavenHeading.match[2]),minimum_agility_source:'section_heading',level_scope_ambiguous:true,intensity:'very_low',client_aid:'Detached Camera plugin',observed_xp_per_hour_approximate:number(brimhavenDetached.match[1]),observed_xp_per_hour_level_scope:{minimum:number(brimhavenHeading.match[1]),maximum:number(brimhavenHeading.match[2])},observed_rate_kind:'approximate_section_scoped_equipment_unspecified',observed_rate_equipment_scope_unresolved:true,vector_name_prefix:'Brimhaven Agility Arena — Detached-camera floor spikes',source_locator:locator(brimhavenHeading,brimhavenDetached)}),
    record(base,{candidate_key:'guide:rooftop:draynor',name:'Draynor Village Rooftop Course',record_kind:'repeatable_method',minimum_agility:1,guide_level_maximum:30,observed_xp_per_hour_range:{minimum:number(draynorRooftop.match[1]),maximum:number(draynorRooftop.match[2])},vector_name_prefix:'Draynor Village Rooftop Course',source_locator:locator(rooftopsHeading,draynorRooftop)}),
    record(base,{candidate_key:'guide:rooftop:al-kharid',name:'Al Kharid Rooftop Course',record_kind:'repeatable_method',minimum_agility:20,guide_level_maximum:30,observed_xp_per_hour_range:{minimum:number(alKharidRooftop.match[1]),maximum:number(alKharidRooftop.match[2])},observed_xp_per_hour_level_scope:{minimum:20,maximum:30},vector_name_prefix:'Al Kharid Rooftop Course',source_locator:locator(rooftopsHeading,alKharidRooftop)}),
    record(base,{candidate_key:'guide:rooftop:varrock',name:'Varrock Rooftop Course',record_kind:'repeatable_method',minimum_agility:30,guide_level_maximum:40,observed_xp_per_hour_range:{minimum:number(varrockRooftop.match[1]),maximum:number(varrockRooftop.match[2])},observed_xp_per_hour_level_scope:{minimum:30,maximum:40},vector_name_prefix:'Varrock Rooftop Course',source_locator:locator(rooftopsHeading,varrockRooftop)}),
    record(base,{candidate_key:'guide:edgeville:monkeybars',name:'Edgeville Dungeon monkeybars',record_kind:'repeatable_method',minimum_agility:number(monkeybars.match[1]),guide_level_maximum:number(monkeybars.match[2]),observed_xp_per_hour_upper:number(monkeybars.match[3]),observed_xp_per_hour_upper_scope:{minimum:number(monkeybars.match[1]),maximum:number(monkeybars.match[2])},observed_rate_kind:'source_stated_upper_bound',observed_rate_is_expected:false,risk_context:['Wilderness','Player killers'],vector_match_terms:['Monkeybars','Edgeville Dungeon'],source_locator:locator(monkeybars)}),
    record(base,{candidate_key:'guide:barbarian-fishing',name:'Barbarian Fishing — passive Agility XP',record_kind:'hybrid_training_method',minimum_agility:number(barbarian.match[1]),guide_level_maximum:number(barbarian.match[2]),guide_example_fishing_range:{minimum:number(barbarian.match[3]),maximum:number(barbarian.match[4])},other_skill_requirement_unknown:true,secondary_xp_skill:'Strength',agility_rate_missing:true,vector_name_prefix:'Barbarian Fishing',source_locator:locator(barbarian)}),
    record(base,{candidate_key:'guide:agility-pyramid',name:'Agility Pyramid',record_kind:'repeatable_method',minimum_agility:number(pyramid.match[1]),guide_level_maximum:number(pyramid.match[4]),observed_completions_per_hour:number(pyramid.match[2]),observed_xp_per_hour:number(pyramid.match[5]),vector_name_prefix:'Agility Pyramid',source_locator:locator(pyramid)})
  ];
  return rows;
}
