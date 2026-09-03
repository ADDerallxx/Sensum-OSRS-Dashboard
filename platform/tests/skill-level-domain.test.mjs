import {parseSkillLevelDomains} from '../ingestion/skill-level-domain-lib.mjs';

const skills={Combat:['Attack','Defence','Hitpoints','Magic','Prayer','Ranged','Strength'],Gathering:['Farming','Fishing','Hunter','Mining','Woodcutting'],Production:['Cooking','Crafting','Fletching','Herblore','Runecraft','Smithing'],Utility:['Agility','Construction','Firemaking','Sailing','Slayer','Thieving']};
const categoryText=Object.entries(skills).map(([category,names])=>`'''${category} skills''' - description\n:${names.map(name=>`{{SCP|${name}|link=yes}}`).join(', ')}`).join('\n');
const source=`There are 24 different skills in ''[[Old School RuneScape]]''.
All skills start out at level 1 except for [[Hitpoints]], which starts with level 10. Players can advance a skill to [[level 99]]. After that, they can increase their experience up to 200,000,000 but get no more levels for doing so.
Skills can be temporarily boosted through special equipment, items, [[Prayer]], or [[potions]].
When viewing the skills interface, each skill has a numerator and a denominator. While their roles vary by skill, the numerator generally represents the acting level, while the denominator represents the base/actual level.
${categoryText}`;
const input={title:'Skills',content:source,sourceRevision:'15321845',sourceTimestamp:'2026-08-27T06:12:04Z',sourceUrl:'https://oldschool.runescape.wiki/w/Skills'};
const parsed=parseSkillLevelDomains(input),failures=[],check=(condition,message)=>{if(!condition)failures.push(message)};
check(parsed.audit.publishable===true&&parsed.records.length===24,'All 24 source-enumerated skills must parse before the domain snapshot is publishable.');
check(parsed.records.find(record=>record.skill==='Agility')?.minimumBaseLevel===1&&parsed.records.find(record=>record.skill==='Agility')?.maximumBaseLevel===99,'Agility must retain the source-published base-level domain 1–99.');
check(parsed.records.find(record=>record.skill==='Hitpoints')?.minimumBaseLevel===10,'Hitpoints must retain its source-published starting-level exception.');
check(parsed.records.every(record=>record.baseAndEffectiveLevelsSeparate&&record.temporaryBoostsAffectEffectiveLevel&&record.sourceRevision==='15321845'&&record.sourceLocator?.evidence?.length>=6),'Every skill must retain boost semantics, provenance, and exact locators.');
const missing=parseSkillLevelDomains({...input,content:source.replace('{{SCP|Sailing|link=yes}}, ','')});
check(missing.audit.publishable===false&&missing.audit.blockers.includes('declared_24_skills_but_parsed_23'),'A partially parsed official skill list must fail closed.');
const noLevel=parseSkillLevelDomains({...input,content:source.replace('Players can advance a skill to [[level 99]].','')});
check(noLevel.audit.publishable===false&&noLevel.audit.blockers.includes('base_level_domain_not_published'),'Missing level-domain evidence must block every derived skill record.');
const wrongTitle=parseSkillLevelDomains({...input,title:'Agility'});
check(wrongTitle.audit.publishable===false&&wrongTitle.records.length===0,'A different Wiki page must not be accepted as the canonical skill-domain source.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Skill level-domain evidence checks passed.');
