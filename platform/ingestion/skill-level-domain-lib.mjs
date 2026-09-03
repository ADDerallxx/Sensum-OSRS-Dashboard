const lineRecord=(lines,index)=>index<0?null:{line:index+1,text:lines[index].trim()};
const locator=(...rows)=>({evidence:rows.filter(Boolean).map(row=>({line:row.line,excerpt:row.text}))});
const key=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function parseSkillLevelDomains({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Skills')return {records:[],audit:{publishable:false,blockers:['unexpected_source_title']}};
  const lines=String(content||'').split(/\r?\n/);
  const countIndex=lines.findIndex(line=>/There are\s+\d+\s+different skills in/i.test(line));
  const domainIndex=lines.findIndex(line=>/All skills start out at level\s+\d+\s+except for\s+\[\[Hitpoints\]\], which starts with level\s+\d+\.[\s\S]*?advance a skill to\s+\[\[level\s+\d+\]\]/i.test(line));
  const boostIndex=lines.findIndex(line=>/Skills can be temporarily boosted/i.test(line));
  const baseEffectiveIndex=lines.findIndex(line=>/numerator generally represents the acting level[\s\S]*?denominator represents the base\/actual level/i.test(line));
  const countRow=lineRecord(lines,countIndex),domainRow=lineRecord(lines,domainIndex),boostRow=lineRecord(lines,boostIndex),baseEffectiveRow=lineRecord(lines,baseEffectiveIndex);
  const declaredSkillCount=Number(countRow?.text.match(/There are\s+(\d+)\s+different skills/i)?.[1]||NaN);
  const domainMatch=domainRow?.text.match(/All skills start out at level\s+(\d+)\s+except for\s+\[\[Hitpoints\]\], which starts with level\s+(\d+)\.[\s\S]*?advance a skill to\s+\[\[level\s+(\d+)\]\]/i);
  const categoryRows=[];
  for(let index=0;index<lines.length-1;index++){
    const category=lines[index].match(/^'''(Combat|Gathering|Production|Utility) skills'''/i)?.[1];
    if(!category)continue;
    const names=[...lines[index+1].matchAll(/\{\{SCP\|([^}|]+)/gi)].map(match=>match[1].trim());
    categoryRows.push({category,names,heading:lineRecord(lines,index),skills:lineRecord(lines,index+1)});
  }
  const seen=new Set(),records=[];
  for(const group of categoryRows)for(const skill of group.names){
    if(seen.has(skill.toLowerCase()))continue;
    seen.add(skill.toLowerCase());
    records.push({
      contract:'sensum.skill-level-domain.v1',
      skillKey:key(skill),
      skill,
      category:group.category.toLowerCase(),
      minimumBaseLevel:skill==='Hitpoints'?Number(domainMatch?.[2]):Number(domainMatch?.[1]),
      maximumBaseLevel:Number(domainMatch?.[3]),
      temporaryBoostsAffectEffectiveLevel:true,
      baseAndEffectiveLevelsSeparate:true,
      sourceRevision:String(sourceRevision||''),
      sourceTimestamp:sourceTimestamp||null,
      sourceUrl,
      sourceLocator:locator(countRow,domainRow,boostRow,baseEffectiveRow,group.heading,group.skills),
      state:'candidate'
    });
  }
  const blockers=[];
  if(!Number.isInteger(declaredSkillCount)||declaredSkillCount<1)blockers.push('declared_skill_count_not_published');
  if(!domainMatch)blockers.push('base_level_domain_not_published');
  if(!boostRow||!baseEffectiveRow)blockers.push('base_effective_level_separation_not_published');
  if(categoryRows.length!==4)blockers.push('official_skill_categories_incomplete');
  if(Number.isInteger(declaredSkillCount)&&records.length!==declaredSkillCount)blockers.push(`declared_${declaredSkillCount}_skills_but_parsed_${records.length}`);
  if(!sourceRevision||!sourceTimestamp||!sourceUrl)blockers.push('revision_provenance_incomplete');
  if(records.some(record=>!Number.isInteger(record.minimumBaseLevel)||!Number.isInteger(record.maximumBaseLevel)||record.minimumBaseLevel>record.maximumBaseLevel))blockers.push('invalid_skill_level_domain');
  return {records,audit:{contract:'sensum.skill-level-domain-ingestion-audit.v1',declaredSkillCount:Number.isInteger(declaredSkillCount)?declaredSkillCount:null,parsedSkillCount:records.length,categoryCount:categoryRows.length,blockers,publishable:blockers.length===0}};
}
