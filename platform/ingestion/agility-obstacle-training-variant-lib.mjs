const number=value=>Number(String(value||'').replace(/,/g,''));
const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const lineAt=(content,index)=>content.slice(0,index).split(/\r?\n/).length;
const excerpt=(content,match)=>({line:lineAt(content,match.index),excerpt:match[0].slice(0,1400)});
const key=value=>normalize(value).replace(/ /g,'_');

function obstacleRows(content){
  const rows=[];
  for(const table of content.matchAll(/\{\|\s*class="wikitable"[\s\S]*?\n\|\}/gi)){
    if(!/!\s*Obstacle\s*\n/i.test(table[0])||!/!\s*Level Required\s*\n/i.test(table[0])||!/!\s*Experience\s*\n/i.test(table[0]))continue;
    const tableOffset=table.index;
    for(const raw of table[0].split(/^\|-\s*$/m)){
      const link=[...raw.matchAll(/^\|\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s*$/gm)].find(match=>!/^File:/i.test(match[1]));
      if(!link)continue;
      const afterLink=raw.slice((link.index||0)+link[0].length),level=afterLink.match(/^\|\s*(\d+)\s*$/m),xp=afterLink.match(/^\|\s*\{\{SCP\|Agility\|([\d.]+)(?:\|[^}]*)?\}\}\s*$/mi);
      if(!level||!xp)continue;
      const rowIndex=tableOffset+table[0].indexOf(raw);
      rows.push({sourceName:link[1],displayName:link[2]||link[1],entryLevel:number(level[1]),xpPerSuccess:number(xp[1]),raw,index:rowIndex});
    }
  }
  return rows;
}

function uniqueObstacleMatch(rows,claimName){
  const wanted=normalize(claimName),exact=rows.filter(row=>normalize(row.displayName)===wanted||normalize(row.sourceName)===wanted);
  if(exact.length===1)return exact[0];
  const words=wanted.split(' ').filter(word=>word.length>3),partial=rows.filter(row=>words.length&&words.every(word=>normalize(row.displayName).includes(word)||normalize(row.sourceName).includes(word)));
  if(partial.length===1)return partial[0];
  const last=words.at(-1),fallback=last?rows.filter(row=>normalize(row.displayName).split(' ').includes(last)): [];
  return fallback.length===1?fallback[0]:null;
}

function parseShortcutTrainingVariant({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  const info=content.match(/\{\{Agility info[\s\S]{0,500}?\|level\s*=\s*(\d+)[\s\S]{0,300}?\|xp\s*=\s*([\d.]+)[\s\S]{0,200}?\|type\s*=\s*Shortcut[\s\S]{0,100}?\}\}/i);
  const claim=content.match(/An Agility level of\s+(\d+)\s+is required[\s\S]{0,700}?This obstacle can not be failed\.[\s\S]{0,180}?up to\s+([\d,]+)\s+experience per hour/i);
  const risk=content.match(/located in the Wilderness[\s\S]{0,180}?attacked by other players/i);
  const motionless=content.match(/==\s*Motionless training\s*==[\s\S]{0,500}?requiring no camera rotation or mouse movement/i);
  if(!info||!claim||!risk||!motionless)return [];
  const templateLevel=number(info[1]),claimLevel=number(claim[1]);
  if(templateLevel!==claimLevel)return [];
  return [{
    contract:'sensum.agility-obstacle-training-variant.v1',
    record_key:`agility-obstacle-training:${title}:motionless`,
    parent_name:title,
    variant_key:'motionless_training',
    name:`${title} — Motionless training`,
    record_kind:'repeatable_method',
    standalone_training_method:true,
    axis_coverage:['obstacle_training_method','low_intensity_strategy','risk_context'],
    entry_level:templateLevel,
    entry_boostable:null,
    boost_policy:'not_stated_by_source',
    skill_requirements:{Agility:templateLevel},
    xp_per_success:number(info[2]),
    action_unit:'obstacle_crossing',
    failure_free_level:templateLevel,
    observed_rate_minimum_level:templateLevel,
    observed_xp_per_hour_upper:number(claim[2]),
    observed_xp_per_hour_upper_scope:{minimum:templateLevel,maximum:null},
    observed_rate_kind:'source_stated_upper_bound',
    observed_rate_is_expected:false,
    cycle_ticks:null,
    cycle_timing_blocker:'motionless_round_trip_cycle_ticks_not_published',
    intensity:'motionless_repeated_click',
    risk_context:['Wilderness','Player attack','Earth warrior survival'],
    requirements:['Survive Earth warrior attacks'],
    inherit_parent_mechanics:false,
    source_revision:String(sourceRevision||''),
    source_timestamp:sourceTimestamp||null,
    source_url:sourceUrl,
    source_locator:{agilityInfo:excerpt(content,info),mechanicsAndRate:excerpt(content,claim),risk:excerpt(content,risk),method:excerpt(content,motionless)},
    state:'candidate'
  }];
}

export function parseAgilityObstacleTrainingVariants({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  const rows=obstacleRows(content),records=[];
  const claims=[...content.matchAll(/After level\s+(\d+),\s+clicking the\s+([^\n.]+?)\s+without moving the camera is an?\s+\[\[idle(?:\|[^\]]+)?\]\]\s+training method with rates of up to\s+([\d,]+)\s+experience per hour/gi)];
  for(const claim of claims){
    const obstacle=uniqueObstacleMatch(rows,claim[2]);
    if(!obstacle)continue;
    const success=obstacle.raw.match(/At level\s+(\d+)[\s\S]{0,220}?chance of successfully crossing the\s+([^,.]+)[\s\S]{0,180}?stop failing entirely(?: around)? at level\s+(\d+)/i);
    if(!success)continue;
    const observedLevel=number(claim[1]),failureFreeLevel=number(success[3]);
    if(observedLevel!==failureFreeLevel)continue;
    const rowLocator={line:lineAt(content,obstacle.index),excerpt:obstacle.raw.slice(0,1400)};
    records.push({
      contract:'sensum.agility-obstacle-training-variant.v1',
      record_key:`agility-obstacle-training:${title}:${key(obstacle.displayName)}`,
      parent_name:title,
      variant_key:`${key(obstacle.displayName)}_idle`,
      name:`${title} — ${obstacle.displayName} idle`,
      record_kind:'repeatable_method',
      axis_coverage:['obstacle_training_method'],
      entry_level:obstacle.entryLevel,
      entry_boostable:false,
      skill_requirements:{Agility:obstacle.entryLevel},
      xp_per_success:obstacle.xpPerSuccess,
      action_unit:'obstacle_crossing',
      failure_free_level:failureFreeLevel,
      observed_rate_minimum_level:observedLevel,
      observed_xp_per_hour:number(claim[3]),
      inherit_parent_mechanics:false,
      source_revision:String(sourceRevision||''),
      source_timestamp:sourceTimestamp||null,
      source_url:sourceUrl,
      source_locator:{tableRow:rowLocator,success:excerpt(content,{...success,index:obstacle.index+(success.index||0)}),observedRate:excerpt(content,claim)},
      state:'candidate'
    });
  }
  records.push(...parseShortcutTrainingVariant({title,content,sourceRevision,sourceTimestamp,sourceUrl}));
  return records;
}
