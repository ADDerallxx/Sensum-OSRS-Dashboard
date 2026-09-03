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
  return records;
}
