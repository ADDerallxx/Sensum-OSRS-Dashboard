import {agilityGuideSectionKey} from './agility-training-guide-section-inventory-lib.mjs';

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
      failure_probability_published:evidence.failure_probability_published===true,
      target_condition_blocker:evidence.target_condition_blocker||null,
      target_condition_blockers:Array.isArray(evidence.target_condition_blockers)?[...evidence.target_condition_blockers]:[],
      success_model_evidence:evidence.success_formula_kind?evidence:null,
      target_condition_evidence:evidence,
      supporting_source_revisions:[...new Set([...(row.supporting_source_revisions||[]),evidence.source_revision,...(evidence.supporting_source_revisions||[])])]
    };
  });
}

export function parseAgilityTrainingGuideExpansionCandidates({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Agility training')return {records:[],audit:{expectedSectionCount:9,parsedSectionCount:0,expectedCandidateCount:13,parsedCandidateCount:0,blockers:['unexpected_source_title'],publishable:false}};
  const base={contract:'sensum.agility-level34-candidate.v1',source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl},records=[],missing=[];
  const section=(key,pattern)=>{const match=lineMatch(content,pattern);if(!match)missing.push(`guide_section_parser_missing:${key}`);return match};
  const headingTitle=match=>match?.match?.[0]?.match(/^===\s*(.*?)\s*===/m)?.[1]||null;
  const sectionKey=(parent,match)=>agilityGuideSectionKey(parent,headingTitle(match));

  const wilderness=section('wilderness_agility_course',/===\s*Levels\s+(\d+)[–-](\d+):\s*Wilderness Agility Course\s*===[\s\S]{0,1500}?Level\s+(\d+)\s+is normally required to enter the course[\s\S]{0,180}?boosted from level\s+(\d+)\s+with a\s+\[\[summer pie\]\][\s\S]{0,180}?level\s+(\d+)\s+is required to pass the\s+\[\[Obstacle pipe[^\]]*\|pipe obstacle\]\]/i);
  if(wilderness)records.push(record(base,{candidate_key:'guide:wilderness-agility-course',source_section_key:sectionKey('Fastest experience',wilderness),name:'Wilderness Agility Course',record_kind:'repeatable_method',minimum_agility:number(wilderness.match[4]),natural_entry_agility:number(wilderness.match[3]),boosted_entry_agility:number(wilderness.match[4]),boost_source:'Summer pie',obstacle_effective_agility_requirement:number(wilderness.match[5]),guide_level_scope:{minimum:number(wilderness.match[1]),maximum:number(wilderness.match[2])},boosted_entry_is_not_base_level:true,risk_context:['Deep Wilderness','Player killers'],vector_name_prefix:'Wilderness Agility Course',source_locator:locator(wilderness)}));

  const hallowed=section('hallowed_sepulchre',/===\s*Levels\s+(\d+)[–-](\d+):\s*Hallowed Sepulchre\s*===[\s\S]{0,450}?offers the fastest experience from level\s+(\d+)\s+onwards[\s\S]{0,500}?must have completed\s+\[\[Sins of the Father\]\]/i);
  if(hallowed)records.push(record(base,{candidate_key:'guide:hallowed-sepulchre',source_section_key:sectionKey('Fastest experience',hallowed),name:'Hallowed Sepulchre',record_kind:'repeatable_method',minimum_agility:number(hallowed.match[3]),guide_level_scope:{minimum:number(hallowed.match[1]),maximum:number(hallowed.match[2])},requirements:['Sins of the Father'],composite_variant_axes:['maximum_floor','looting_policy','equipment_state'],internal_member_audit_required:true,vector_name_prefix:'Hallowed Sepulchre',source_locator:locator(hallowed)}));

  const rockslide=section('rockslide_other_activities',/===\s*Levels\s+(\d+)\+:\s*Rockslide\s*\+\s*Other Activities\s*===[\s\S]{0,250}?completion of\s+\[\[The Blood Moon Rises\]\][\s\S]{0,180}?grants\s+([\d,.]+)\s+experience every\s+~([\d.]+)\s+minutes[\s\S]{0,180}?takes around\s+(\d+)[–-](\d+)\s+seconds[\s\S]{0,180}?"effective" experience per hour of\s+([\d,]+)[–-]([\d,]+)[\s\S]{0,180}?net players\s+([\d,]+)\s+to\s+([\d,]+)\s+extra experience each hour/i);
  const rockslidePairings=lineMatch(content,/In order to be effective the activity you are returning to must have teleportation nearby[\s\S]{0,220}?combine this method with the \[\[Ardougne Rooftop Course\]\] \(with teleport\) or \[\[Hallowed Sepulchre\]\] \(with \[\[Hallowed crystal shard\]\]\)[\s\S]{0,180}?latter does use Hallowed tokens[\s\S]{0,240}?not limited to Agility, for instance you could train \[\[Runecraft\]\] with the medallion in the neck slot[\s\S]{0,260}?teleport would be saved[\s\S]{0,180}?return to a bank/i),rockslideMarks=lineMatch(content,/To maximise marks of grace whilst running agility laps you should delay teleporting until the next Mark of Grace spawns and you have finished the lap[\s\S]{0,220}?3 minute mark cooldown[\s\S]{0,160}?should not decrease your overall marks\/hr/i);
  if(!rockslidePairings)missing.push('guide_member_evidence_missing:rockslide_named_pairings');
  if(!rockslideMarks)missing.push('guide_member_evidence_missing:rockslide_marks_policy');
  if(rockslide){
    const key=sectionKey('Fastest experience',rockslide),shared={source_section_key:key,record_kind:'hybrid_training_method',minimum_agility:number(rockslide.match[1]),requirements:['The Blood Moon Rises'],parent_candidate_key:'guide:rockslide-hybrid-detour',xp_per_detour:number(rockslide.match[2]),source_interval_minutes_approximate:number(rockslide.match[3]),detour_seconds_range:{minimum:number(rockslide.match[4]),maximum:number(rockslide.match[5])},effective_xp_per_hour_range:{minimum:number(rockslide.match[6]),maximum:number(rockslide.match[7])},incremental_xp_per_hour_range:{minimum:number(rockslide.match[8]),maximum:number(rockslide.match[9])},effective_rate_is_not_sustained_training_rate:true,combined_activity_total_rate_published:false,internal_member_audit_required:true};
    records.push(record(base,{...shared,candidate_key:'guide:rockslide-hybrid-detour',parent_candidate_key:null,name:'Rockslide shortcut — Hybrid activity detour',requires_return_activity_with_nearby_teleport:true,paired_activity_universe_closed:false,pairing_universe_blocker:'source_uses_open_ended_other_activities_and_for_instance',source_locator:locator(rockslide,rockslidePairings)}));
    if(rockslidePairings){
      records.push(record(base,{...shared,candidate_key:'guide:rockslide-pairing:ardougne-rooftop',name:'Rockslide shortcut + Ardougne Rooftop Course',paired_activity:{kind:'agility_course',name:'Ardougne Rooftop Course'},return_teleport_required:true,return_teleport_identity_published:false,optional_policy_axes:rockslideMarks?[{key:'delay_teleport_until_mark_spawn_and_lap_completion',mark_cooldown_minutes:3,marks_per_hour_effect:'source_expected_not_to_decrease'}]:[],source_locator:locator(rockslide,rockslidePairings,rockslideMarks)}));
      records.push(record(base,{...shared,candidate_key:'guide:rockslide-pairing:hallowed-sepulchre',name:'Rockslide shortcut + Hallowed Sepulchre',paired_activity:{kind:'agility_course',name:'Hallowed Sepulchre'},return_teleport_item:'Hallowed crystal shard',source_cost_warning:'uses Hallowed tokens which may not be desirable',token_cost_per_cycle_published:false,source_locator:locator(rockslide,rockslidePairings)}));
      records.push(record(base,{...shared,candidate_key:'guide:rockslide-pairing:runecraft-bank-return',name:'Rockslide shortcut + Runecraft bank-return activity',paired_activity:{kind:'skill_example',skill:'Runecraft',specific_activity_published:false},drakans_medallion_slot:'neck',bank_return_teleport_reused:true,additional_return_teleport_avoided:true,source_locator:locator(rockslide,rockslidePairings)}));
    }
  }

  const brimhaven=section('brimhaven_ticket_course',/===\s*Levels\s+(\d+)\/(\d+)\+:\s*Brimhaven Agility Arena\s*===[\s\S]{0,450}?for\s+([\d.]+)\s+\[\[Agility\]\]\s+\[\[experience\]\]\s+per ticket[\s\S]{0,260}?additional 10% experience, giving\s+([\d.]+)[\s\S]{0,450}?At level\s+(\d+)\s+Agility, players can earn roughly\s+([\d,]+)\s+XP per hour\s*\(or\s+([\d,]+)[\s\S]{0,180}?At level\s+(\d+)\s+Agility, players can earn roughly\s+([\d,]+)[\s\S]{0,100}?roughly\s+([\d,]+)[\s\S]{0,220}?roughly\s+([\d,]+)\s+experience per hour added/i);
  if(brimhaven)records.push(record(base,{candidate_key:'guide:brimhaven:ticket-course',source_section_key:sectionKey('Other methods',brimhaven),name:'Brimhaven Agility Arena — Ticket course',record_kind:'repeatable_method',minimum_agility:number(brimhaven.match[1]),guide_level_scope:{minimum:number(brimhaven.match[1]),alternateStart:number(brimhaven.match[2]),maximum:null},ticket_xp:{standard:number(brimhaven.match[3]),karamjaGloves2Plus:number(brimhaven.match[4])},observed_level_benchmarks:[{baseAgility:number(brimhaven.match[5]),standardXpPerHour:number(brimhaven.match[6]),karamjaGlovesXpPerHour:number(brimhaven.match[7])},{baseAgility:number(brimhaven.match[8]),standardXpPerHour:number(brimhaven.match[9]),karamjaGlovesXpPerHour:number(brimhaven.match[10])}],elite_diary_xp_per_hour_addition_approximate:number(brimhaven.match[11]),benchmark_interpolation_allowed:false,vector_match_terms:['Brimhaven Agility Arena','Passive'],source_locator:locator(brimhaven)}));

  const apeAtoll=section('ape_atoll_agility_course',/===\s*Levels\s+(\d+)[–-](\d+)\/(\d+):\s*Ape Atoll Agility Course\s*===[\s\S]{0,300}?completed chapter 2 of\s+\[\[Monkey Madness I\]\][\s\S]{0,300}?wear a\s+\[\[ninja monkey greegree\]\][\s\S]{0,260}?\[\[Boosts\]\]\s+cannot be used to enter the course before level\s+(\d+)\s+Agility[\s\S]{0,300}?around\s+([\d,]+)[–-]([\d,]+)\s+experience per hour at level\s+(\d+)[\s\S]{0,200}?around\s+([\d,]+)[–-]([\d,]+)\s+experience per hour at higher levels[\s\S]{0,180}?stop failing the obstacles at level\s+(\d+)[\s\S]{0,140}?up to\s+([\d,]+)\s+experience per hour/i);
  if(apeAtoll)records.push(record(base,{candidate_key:'guide:ape-atoll-agility-course',source_section_key:sectionKey('Other methods',apeAtoll),name:'Ape Atoll Agility Course',record_kind:'repeatable_method',minimum_agility:number(apeAtoll.match[4]),guide_level_scope:{minimum:number(apeAtoll.match[1]),intermediate:number(apeAtoll.match[2]),alternateEnd:number(apeAtoll.match[3])},requirements:['Monkey Madness I chapter 2','Ninja monkey greegree or Kruk greegree'],entry_boostable:false,observed_xp_per_hour_benchmarks:[{baseAgility:number(apeAtoll.match[7]),minimum:number(apeAtoll.match[5]),maximum:number(apeAtoll.match[6]),scope:'source_stated_level'},{baseAgility:null,minimum:number(apeAtoll.match[8]),maximum:number(apeAtoll.match[9]),scope:'higher_levels_unspecified'}],failure_free_base_agility:number(apeAtoll.match[10]),observed_xp_per_hour_upper_after_failure_free:number(apeAtoll.match[11]),vector_name_prefix:'Ape Atoll Agility Course',source_locator:locator(apeAtoll)}));

  const shayzien=section('shayzien_advanced_agility_course',/===\s*Levels\s+(\d+)[–-](\d+)\/(\d+):\s*Shayzien Advanced Agility Course\s*===[\s\S]{0,400}?requires a\s+\[\[crossbow\]\]\s+and a\s+\[\[mith grapple\]\][\s\S]{0,160}?around\s+([\d,]+)\s+experience per hour at level\s+(\d+)/i);
  if(shayzien)records.push(record(base,{candidate_key:'guide:shayzien-advanced-agility-course',source_section_key:sectionKey('Other methods',shayzien),name:'Shayzien Agility Course — Advanced',record_kind:'repeatable_method',minimum_agility:number(shayzien.match[1]),minimum_agility_source:'source_observed_training_level',entry_requirement_requires_supporting_page:true,guide_level_scope:{minimum:number(shayzien.match[1]),intermediate:number(shayzien.match[2]),alternateEnd:number(shayzien.match[3])},requirements:['Crossbow','Mith grapple'],observed_xp_per_hour_approximate:number(shayzien.match[4]),observed_xp_per_hour_level_scope:{minimum:number(shayzien.match[5]),maximum:number(shayzien.match[5])},vector_name_prefix:'Shayzien Agility Course — Advanced',source_locator:locator(shayzien)}));

  const colossal=section('colossal_wyrm_agility_course',/===\s*Levels\s+(\d+)\/(\d+):\s*Colossal Wyrm Agility Course\s*===[\s\S]{0,1200}?basic course requires\s+(\d+)\s+Agility and gives up to\s+([\d,]+)\s+xp\/hr, and the advanced course requires\s+(\d+)\s+Agility and gives up to\s+([\d,]+)\s+xp\/hr[\s\S]{0,180}?advanced route requires only\s+(\d+)\s+clicks per\s+(\d+)-second lap[\s\S]{0,180}?two sections[\s\S]{0,120}?full\s+(\d+)\s+seconds of AFK time each/i);
  if(colossal){
    const key=sectionKey('Other methods',colossal),shared={source_section_key:key,record_kind:'repeatable_method',source_locator:locator(colossal),internal_member_audit_required:true};
    records.push(record(base,{...shared,candidate_key:'guide:colossal-wyrm:basic',name:'Colossal Wyrm Agility Course — Basic',minimum_agility:number(colossal.match[3]),observed_xp_per_hour_upper:number(colossal.match[4]),observed_rate_kind:'source_stated_upper_bound',observed_rate_is_expected:false,vector_name_prefix:'Colossal Wyrm Agility Course — Basic'}));
    records.push(record(base,{...shared,candidate_key:'guide:colossal-wyrm:advanced',name:'Colossal Wyrm Agility Course — Advanced',minimum_agility:number(colossal.match[5]),observed_xp_per_hour_upper:number(colossal.match[6]),observed_rate_kind:'source_stated_upper_bound',observed_rate_is_expected:false,source_stated_clicks_per_lap:number(colossal.match[7]),source_stated_lap_seconds:number(colossal.match[8]),source_stated_afk_sections:2,source_stated_afk_seconds_each:number(colossal.match[9]),vector_name_prefix:'Colossal Wyrm Agility Course — Advanced'}));
  }

  const werewolf=section('werewolf_agility_course',/===\s*Levels\s+(\d+)[–-](\d+)\/(\d+):\s*Werewolf Agility Course\s*===[\s\S]{0,450}?completed\s+\[\[Creature of Fenkenstrain\]\]\s+and wear a\s+\[\[Ring of Charos\]\][\s\S]{0,420}?requires level\s+(\d+)\s+Agility[\s\S]{0,160}?boost to level\s+\d+\s+even at level\s+(\d+)[\s\S]{0,260}?With level\s+(\d+)\s+in Agility and\s+\[\[Strength\]\][\s\S]{0,100}?\[\[weight\]\]\s+is below\s+(\d+)kg[\s\S]{0,280}?up to around\s+([\d,]+)[–-]([\d,]+)\s+experience per hour at lower levels and\s+([\d,]+)[–-]([\d,]+)\s+experience per hour at higher levels/i);
  if(werewolf)records.push(record(base,{candidate_key:'guide:werewolf-agility-course',source_section_key:sectionKey('Other methods',werewolf),name:'Werewolf Agility Course',record_kind:'repeatable_method',minimum_agility:number(werewolf.match[5]),natural_entry_agility:number(werewolf.match[4]),boosted_entry_agility:number(werewolf.match[5]),boost_source:'Summer pie',boosted_entry_is_not_base_level:true,requirements:['Creature of Fenkenstrain','Ring of Charos'],failure_free_condition:{baseAgility:number(werewolf.match[6]),strength:number(werewolf.match[6]),maximumWeightKgExclusive:number(werewolf.match[7])},observed_xp_per_hour_ranges:[{minimum:number(werewolf.match[8]),maximum:number(werewolf.match[9]),levelScope:'lower_levels_unspecified'},{minimum:number(werewolf.match[10]),maximum:number(werewolf.match[11]),levelScope:'higher_levels_unspecified'}],observed_rate_level_scope_unresolved:true,vector_name_prefix:'Werewolf Agility Course',source_locator:locator(werewolf)}));

  const prifddinas=section('prifddinas_agility_course',/===\s*Levels\s+(\d+)[–-](\d+):\s*Prifddinas Agility Course\s*===[\s\S]{0,500}?from level\s+(\d+)\s+onwards[\s\S]{0,160}?completed\s+\[\[Song of the Elves\]\][\s\S]{0,500}?up to around\s+([\d,]+)\s+experience per hour at level\s+(\d+), increasing to\s+([\d,]+)\s+experience per hour from level\s+(\d+)\s+onwards/i);
  if(prifddinas)records.push(record(base,{candidate_key:'guide:prifddinas-agility-course',source_section_key:sectionKey('Other methods',prifddinas),name:'Prifddinas Agility Course',record_kind:'repeatable_method',minimum_agility:number(prifddinas.match[3]),guide_level_scope:{minimum:number(prifddinas.match[1]),maximum:number(prifddinas.match[2])},requirements:['Song of the Elves'],observed_xp_per_hour_upper_benchmarks:[{baseAgility:number(prifddinas.match[5]),xpPerHour:number(prifddinas.match[4])},{baseAgility:number(prifddinas.match[7]),xpPerHour:number(prifddinas.match[6])}],observed_rate_kind:'source_stated_upper_bounds',observed_rate_is_expected:false,vector_name_prefix:'Prifddinas Agility Course',source_locator:locator(prifddinas)}));

  const candidateKeys=records.map(row=>row.candidate_key),duplicateCandidateKeys=[...new Set(candidateKeys.filter((key,index)=>candidateKeys.indexOf(key)!==index))],blockers=[...missing,...duplicateCandidateKeys.map(key=>`duplicate_candidate_key:${key}`)];
  if(!sourceRevision||!sourceTimestamp||!sourceUrl)blockers.push('revision_provenance_incomplete');
  const missingSections=missing.filter(key=>key.startsWith('guide_section_parser_missing:'));
  return {records,audit:{expectedSectionCount:9,parsedSectionCount:9-missingSections.length,expectedCandidateCount:13,parsedCandidateCount:records.length,missingSections,missingMemberEvidence:missing.filter(key=>key.startsWith('guide_member_evidence_missing:')),duplicateCandidateKeys,blockers,publishable:blockers.length===0}};
}

export function parseAgilityTrainingGuideCandidates({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Agility training')return [];
  const base={contract:'sensum.agility-level34-candidate.v1',source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl};
  const questing=lineMatch(content,/===Levels\s+(\d+)[–-](\d+)\/(\d+): Questing===[\s\S]{0,700}?\[\[The Tourist Trap\]\][\s\S]{0,260}?\[\[Recruitment Drive\]\][\s\S]{0,160}?\[\[The Depths of Despair\]\][\s\S]{0,160}?\[\[The Grand Tree\]\][\s\S]{0,180}?total of\s+([\d,]+)\s+experience/i);
  const brimhavenHeading=lineMatch(content,/===Levels\s+(\d+)[–-](\d+): Brimhaven Agility Arena===/i);
  const brimhavenActive=lineMatch(content,/\[\[Brimhaven Agility Arena\]\] offers the fastest experience[\s\S]{0,180}?must have\s+([\d,]+)\s+coins[\s\S]{0,180}?\[\[Floor spikes \(Brimhaven Agility Arena\)\|floor spikes\]\] trap[\s\S]{0,120}?requires level\s+(\d+)[\s\S]{0,220}?up to\s+([\d,]+)\s+experience per hour as low as level\s+(\d+)\s+with the use of \[\[summer pie\]\][\s\S]{0,140}?Bringing food is advised/i);
  const brimhavenPillars=lineMatch(content,/At level\s+(\d+)\s+you will be able to pass every obstacle[\s\S]{0,180}?expect to gain around\s+([\d,]+)[–-]([\d,]+)\s+experience per hour when tagging every pillar and using the floor spikes trap during the downtime[\s\S]{0,160}?without the use of \[\[Karamja gloves\]\][\s\S]{0,200}?\[\[Karamja gloves 2\]\] or above[\s\S]{0,160}?by\s+(\d+)%/i);
  const brimhavenDetached=lineMatch(content,/Additionally, the floor spike obstacle can be used[\s\S]{0,120}?very low intensity[\s\S]{0,120}?approximately\s+([\d,]+)\s+experience per hour[\s\S]{0,180}?"Detached Camera" plugin/i);
  const brimhavenDetachedTickets=lineMatch(content,/If the nearby \[\[Ticket Dispenser\|ticket dispensers\]\] are active, tagging them can provide some extra experience/i);
  const rooftopsHeading=lineMatch(content,/===Levels\s+(\d+)[–-](\d+): Rooftop Agility Courses===/i);
  const draynorRooftop=lineMatch(content,/\|\s*1[–-]20\/30\s*\n\|\s*\[\[Draynor Village Rooftop Course\|Draynor Village\]\]\s*\n\|\s*([\d,]+)[–-]([\d,]+)/i);
  const alKharidRooftop=lineMatch(content,/\|\s*20[–-]30\s*\n\|\s*\[\[Al Kharid Rooftop Course\|Al Kharid\]\]\s*\n\|\s*([\d,]+)[–-]([\d,]+)/i);
  const varrockRooftop=lineMatch(content,/\|\s*30[–-]40\s*\n\|\s*\[\[Varrock Rooftop Course\|Varrock\]\]\s*\n\|\s*([\d,]+)[–-]([\d,]+)/i);
  const monkeybars=lineMatch(content,/===Levels\s+(\d+)[–-](\d+): Edgeville Dungeon monkeybars===[\s\S]{0,300}?offers up to\s+([\d,]+)\s+experience per hour[\s\S]{0,180}?located in the Wilderness/i);
  const barbarian=lineMatch(content,/===Levels\s+(\d+)[–-](\d+): Barbarian Fishing===[\s\S]{0,260}?grants small amounts of passive Agility and \[\[Strength\]\] experience[\s\S]{0,260}?Fishing from level\s+(\d+)\s+to\s+(\d+)/i);
  const pyramid=lineMatch(content,/===\s*Levels\s+(\d+)\+:\s*Agility Pyramid\s*===[\s\S]{0,500}?Roughly\s+(\d+)\s+completions[\s\S]{0,300}?early levels\s*\((\d+)[–-](\d+)\)[\s\S]{0,300}?([\d,]+)\s+experience per hour/i);
  if(!questing||!brimhavenHeading||!brimhavenActive||!brimhavenPillars||!brimhavenDetached||!brimhavenDetachedTickets||!rooftopsHeading||!draynorRooftop||!alKharidRooftop||!varrockRooftop||!monkeybars||!barbarian||!pyramid){if(process.env.SENSUM_LEVEL34_DEBUG){const pyramidAt=content.indexOf('Agility Pyramid');console.error('Agility guide parse blockers',{questing:!!questing,brimhavenHeading:!!brimhavenHeading,brimhavenActive:!!brimhavenActive,brimhavenPillars:!!brimhavenPillars,brimhavenDetached:!!brimhavenDetached,brimhavenDetachedTickets:!!brimhavenDetachedTickets,rooftopsHeading:!!rooftopsHeading,draynorRooftop:!!draynorRooftop,alKharidRooftop:!!alKharidRooftop,varrockRooftop:!!varrockRooftop,monkeybars:!!monkeybars,barbarian:!!barbarian,pyramid:!!pyramid,pyramidExcerpt:pyramidAt>=0?content.slice(Math.max(0,pyramidAt-300),pyramidAt+1400):null})}return []}
  const sectionKeys={questing:agilityGuideSectionKey('Fastest experience',questing.match[0].match(/^===\s*(.*?)\s*===/m)?.[1]),brimhavenFastest:agilityGuideSectionKey('Fastest experience',brimhavenHeading.match[0].match(/^===\s*(.*?)\s*===/m)?.[1]),rooftops:agilityGuideSectionKey('Other methods',rooftopsHeading.match[0].match(/^===\s*(.*?)\s*===/m)?.[1]),monkeybars:agilityGuideSectionKey('Other methods',monkeybars.match[0].match(/^===\s*(.*?)\s*===/m)?.[1]),barbarian:agilityGuideSectionKey('Other methods',barbarian.match[0].match(/^===\s*(.*?)\s*===/m)?.[1]),pyramid:agilityGuideSectionKey('Other methods',pyramid.match[0].match(/^===\s*(.*?)\s*===/m)?.[1])};
  const rows=[
    record(base,{candidate_key:'guide:questing:early-agility',source_section_key:sectionKeys.questing,name:'Early Agility quest rewards',record_kind:'one_time_progression',minimum_agility:number(questing.match[1]),guide_level_maximum:number(questing.match[3]),quests:['The Tourist Trap','Recruitment Drive','The Depths of Despair','The Grand Tree'],aggregate_xp:number(questing.match[4]),aggregate_only:true,source_locator:locator(questing)}),
    record(base,{candidate_key:'guide:brimhaven:floor-spikes-active',source_section_key:sectionKeys.brimhavenFastest,name:'Brimhaven Agility Arena — Repeated floor spikes',record_kind:'repeatable_method',minimum_agility:number(brimhavenActive.match[2]),guide_level_maximum:number(brimhavenHeading.match[2]),requirements:[`${number(brimhavenActive.match[1])} coins entry fee`],observed_xp_per_hour_upper:number(brimhavenActive.match[3]),observed_xp_per_hour_upper_scope:{minimum:number(brimhavenHeading.match[1]),maximum:number(brimhavenHeading.match[2])},observed_rate_kind:'source_stated_upper_bound',observed_rate_is_expected:false,boosted_minimum_base_agility:number(brimhavenActive.match[4]),boost_source:'Summer pie',failure_possible:true,failure_probability_published:false,food_advised:true,vector_match_terms:['Brimhaven Agility Arena','Active floor spikes'],source_locator:locator(brimhavenHeading,brimhavenActive)}),
    record(base,{candidate_key:'guide:brimhaven:pillars-floor-spikes-downtime',source_section_key:sectionKeys.brimhavenFastest,name:'Brimhaven Agility Arena — Pillars with floor-spike downtime',record_kind:'repeatable_method',minimum_agility:number(brimhavenPillars.match[1]),guide_level_maximum:number(brimhavenHeading.match[2]),requirements:[`${number(brimhavenActive.match[1])} coins entry fee`],strategy_policy:'tag_every_pillar_and_use_floor_spikes_during_downtime',observed_xp_per_hour_range:{minimum:number(brimhavenPillars.match[2]),maximum:number(brimhavenPillars.match[3])},observed_xp_per_hour_level_scope:{minimum:number(brimhavenPillars.match[1]),maximum:number(brimhavenPillars.match[1])},observed_rate_kind:'approximate_source_expected_level_40_range',observed_rate_is_expected:true,observed_rate_approximate:true,equipment_policy:'no_karamja_gloves',equipment_variant_available:true,equipment_variant_requirement:['Karamja gloves 2','Karamja gloves 3','Karamja gloves 4'],equipment_variant_bonus_percent:number(brimhavenPillars.match[4]),equipment_variant_expected_rate_published:false,vector_match_terms:['Brimhaven Agility Arena','Active floor spikes'],source_locator:locator(brimhavenHeading,brimhavenPillars)}),
    record(base,{candidate_key:'guide:brimhaven:floor-spikes-detached',source_section_key:sectionKeys.brimhavenFastest,name:'Brimhaven Agility Arena — Detached-camera floor spikes',record_kind:'repeatable_method',minimum_agility:number(brimhavenHeading.match[1]),guide_level_maximum:number(brimhavenHeading.match[2]),minimum_agility_source:'section_heading',level_scope_ambiguous:true,intensity:'very_low',client_aid:'Detached Camera plugin',observed_xp_per_hour_approximate:number(brimhavenDetached.match[1]),observed_xp_per_hour_level_scope:{minimum:number(brimhavenHeading.match[1]),maximum:number(brimhavenHeading.match[2])},observed_rate_kind:'approximate_section_scoped_equipment_unspecified',observed_rate_equipment_scope_unresolved:true,optional_policy_axes:[{key:'nearby_ticket_dispenser_tagging',description:'Tag nearby active ticket dispensers for some extra experience',incremental_xp_per_hour_published:false}],vector_name_prefix:'Brimhaven Agility Arena — Detached-camera floor spikes',source_locator:locator(brimhavenHeading,brimhavenDetached,brimhavenDetachedTickets)}),
    record(base,{candidate_key:'guide:rooftop:draynor',source_section_key:sectionKeys.rooftops,name:'Draynor Village Rooftop Course',record_kind:'repeatable_method',minimum_agility:1,guide_level_maximum:30,observed_xp_per_hour_range:{minimum:number(draynorRooftop.match[1]),maximum:number(draynorRooftop.match[2])},vector_name_prefix:'Draynor Village Rooftop Course',source_locator:locator(rooftopsHeading,draynorRooftop)}),
    record(base,{candidate_key:'guide:rooftop:al-kharid',source_section_key:sectionKeys.rooftops,name:'Al Kharid Rooftop Course',record_kind:'repeatable_method',minimum_agility:20,guide_level_maximum:30,observed_xp_per_hour_range:{minimum:number(alKharidRooftop.match[1]),maximum:number(alKharidRooftop.match[2])},observed_xp_per_hour_level_scope:{minimum:20,maximum:30},vector_name_prefix:'Al Kharid Rooftop Course',source_locator:locator(rooftopsHeading,alKharidRooftop)}),
    record(base,{candidate_key:'guide:rooftop:varrock',source_section_key:sectionKeys.rooftops,name:'Varrock Rooftop Course',record_kind:'repeatable_method',minimum_agility:30,guide_level_maximum:40,observed_xp_per_hour_range:{minimum:number(varrockRooftop.match[1]),maximum:number(varrockRooftop.match[2])},observed_xp_per_hour_level_scope:{minimum:30,maximum:40},vector_name_prefix:'Varrock Rooftop Course',source_locator:locator(rooftopsHeading,varrockRooftop)}),
    record(base,{candidate_key:'guide:edgeville:monkeybars',source_section_key:sectionKeys.monkeybars,name:'Edgeville Dungeon monkeybars',record_kind:'repeatable_method',minimum_agility:number(monkeybars.match[1]),guide_level_maximum:number(monkeybars.match[2]),observed_xp_per_hour_upper:number(monkeybars.match[3]),observed_xp_per_hour_upper_scope:{minimum:number(monkeybars.match[1]),maximum:number(monkeybars.match[2])},observed_rate_kind:'source_stated_upper_bound',observed_rate_is_expected:false,risk_context:['Wilderness','Player killers'],vector_match_terms:['Monkeybars','Edgeville Dungeon'],source_locator:locator(monkeybars)}),
    record(base,{candidate_key:'guide:barbarian-fishing',source_section_key:sectionKeys.barbarian,name:'Barbarian Fishing — passive Agility XP',record_kind:'hybrid_training_method',minimum_agility:number(barbarian.match[1]),guide_level_maximum:number(barbarian.match[2]),guide_example_fishing_range:{minimum:number(barbarian.match[3]),maximum:number(barbarian.match[4])},other_skill_requirement_unknown:true,secondary_xp_skill:'Strength',agility_rate_missing:true,vector_name_prefix:'Barbarian Fishing',source_locator:locator(barbarian)}),
    record(base,{candidate_key:'guide:agility-pyramid',source_section_key:sectionKeys.pyramid,name:'Agility Pyramid',record_kind:'repeatable_method',minimum_agility:number(pyramid.match[1]),guide_level_maximum:number(pyramid.match[4]),observed_completions_per_hour:number(pyramid.match[2]),observed_xp_per_hour:number(pyramid.match[5]),vector_name_prefix:'Agility Pyramid',source_locator:locator(pyramid)})
  ];
  return rows;
}
