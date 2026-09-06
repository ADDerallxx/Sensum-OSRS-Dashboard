export const BRIMHAVEN_PASSIVE_RATE_CONTRACT='sensum.brimhaven-passive-rate-model.v1';
export const BRIMHAVEN_PASSIVE_RATE_FORMULA='brimhaven-passive-v1';

const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const rounded=value=>Number(Number(value).toFixed(10));

export function validateBrimhavenPassiveRateModel(model){
  const blockers=[];
  if(model?.contract!==BRIMHAVEN_PASSIVE_RATE_CONTRACT)blockers.push('brimhaven_passive_rate_model_contract_invalid');
  if(model?.formula_version!==BRIMHAVEN_PASSIVE_RATE_FORMULA)blockers.push('brimhaven_passive_rate_formula_version_invalid');
  const positive=[
    ['pillar_xp_per_level_band',model?.pillar_xp_per_level_band],
    ['pillar_levels_per_band',model?.pillar_levels_per_band],
    ['pillar_maximum_xp',model?.pillar_maximum_xp],
    ['pillars_per_hour',model?.pillars_per_hour],
    ['tickets_per_tag',model?.tickets_per_tag],
    ['ticket_base_xp',model?.ticket_base_xp],
    ['ticket_glove_xp',model?.ticket_glove_xp]
  ];
  for(const [key,value] of positive)if(!finite(value)||Number(value)<=0)blockers.push(`brimhaven_passive_rate_${key}_invalid`);
  if(!finite(model?.elite_double_ticket_chance)||Number(model.elite_double_ticket_chance)<0||Number(model.elite_double_ticket_chance)>1)blockers.push('brimhaven_passive_rate_elite_double_ticket_chance_invalid');
  if(typeof model?.karamja_gloves_apply!=='boolean'||typeof model?.elite_diary_apply!=='boolean')blockers.push('brimhaven_passive_rate_condition_axes_invalid');
  if(model?.equipment_policy!==(model?.karamja_gloves_apply?'karamja_gloves_bonus':'no_karamja_gloves_bonus'))blockers.push('brimhaven_passive_rate_equipment_policy_mismatch');
  if(model?.achievement_policy!==(model?.elite_diary_apply?'karamja_elite':'no_karamja_elite'))blockers.push('brimhaven_passive_rate_achievement_policy_mismatch');
  if(model?.tag_and_ticket_xp_only!==true)blockers.push('brimhaven_passive_rate_scope_not_tag_and_ticket_only');
  if(model?.obstacle_xp_included!==false)blockers.push('brimhaven_passive_rate_obstacle_xp_scope_invalid');
  if(model?.assumes_no_missed_pillars!==true)blockers.push('brimhaven_passive_rate_missed_pillar_scope_invalid');
  if(model?.level_input!=='base_agility_no_boost')blockers.push('brimhaven_passive_rate_level_input_invalid');
  if(!model?.source_revision||!model?.source_url||!model?.source_locator?.evidence?.length)blockers.push('brimhaven_passive_rate_source_binding_incomplete');
  return {valid:blockers.length===0,blockers};
}

export function evaluateBrimhavenPassiveRate(model,baseAgility){
  const validation=validateBrimhavenPassiveRateModel(model),level=Number(baseAgility);
  if(!validation.valid)return {status:'blocked',blockers:validation.blockers};
  if(!Number.isInteger(level)||level<1||level>99)return {status:'blocked',blockers:['brimhaven_passive_rate_base_agility_out_of_domain']};
  const pillarXpPerTag=Math.min(Number(model.pillar_maximum_xp),Math.floor(level/Number(model.pillar_levels_per_band))*Number(model.pillar_xp_per_level_band));
  const appliedEliteDoubleTicketChance=model.elite_diary_apply?Number(model.elite_double_ticket_chance):0;
  const ticketXp=model.karamja_gloves_apply?Number(model.ticket_glove_xp):Number(model.ticket_base_xp);
  const expectedTicketsPerTag=Number(model.tickets_per_tag)+appliedEliteDoubleTicketChance;
  const pillarXpPerHour=rounded(pillarXpPerTag*Number(model.pillars_per_hour));
  const ticketXpPerHour=rounded(expectedTicketsPerTag*ticketXp*Number(model.pillars_per_hour));
  const xpPerHour=rounded(pillarXpPerHour+ticketXpPerHour);
  return {
    status:'modeled',formulaVersion:BRIMHAVEN_PASSIVE_RATE_FORMULA,baseAgility:level,
    xpPerHour,
    components:{pillarXpPerTag,ticketXp,appliedEliteDoubleTicketChance,expectedTicketsPerTag,pillarXpPerHour,ticketXpPerHour},
    conditions:{tagAndTicketXpOnly:true,obstacleXpIncluded:false,assumesNoMissedPillars:true,pillarsPerHour:Number(model.pillars_per_hour),equipmentPolicy:model.equipment_policy,achievementPolicy:model.achievement_policy},
    sourceRevision:String(model.source_revision),sourceUrl:model.source_url,sourceLocator:model.source_locator
  };
}
