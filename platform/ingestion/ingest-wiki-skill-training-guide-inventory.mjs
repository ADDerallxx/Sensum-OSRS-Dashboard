import path from 'node:path';
import {hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,wikiRevisionResolutions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseSkillLevelDomains} from './skill-level-domain-lib.mjs';
import {buildSkillTrainingGuideInventory} from './skill-training-guide-inventory-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data'),sourceUrl=title=>`https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ','_'))}`;
const foundations=await wikiRevisions(['Skills','Skill training guides']),skillsPage=foundations.find(page=>page.title==='Skills'),indexPage=foundations.find(page=>page.title==='Skill training guides'),skillsRevision=skillsPage?.revisions?.[0],indexRevision=indexPage?.revisions?.[0];
if(!skillsRevision||!indexRevision)throw new Error('The official Skills and Skill training guides pages must both return revisions.');
const domains=parseSkillLevelDomains({title:'Skills',content:skillsRevision.slots?.main?.content||'',sourceRevision:skillsRevision.revid,sourceTimestamp:skillsRevision.timestamp,sourceUrl:sourceUrl('Skills')});
if(!domains.audit.publishable)throw new Error(`Official skill-domain parsing failed: ${domains.audit.blockers.join(', ')}`);
const skillWikiPages=await wikiRevisions(domains.records.map(row=>row.skill)),skillPages=skillWikiPages.map(page=>{const revision=page.revisions?.[0];return {title:page.title,content:revision?.slots?.main?.content||'',sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:sourceUrl(page.title)}});
const declarations=skillPages.flatMap(page=>{const match=page.content.match(/\{\{\s*Has skill guide\s*\|([\s\S]*?)\}\}/i);if(!match)return[];return [...match[1].matchAll(/(?:^|\|)\s*(?:members|free|iron|uim)\s*=\s*([^|}]+)/gi)].map(result=>result[1].trim().replaceAll('_',' '))}),guideTitles=[...new Set(declarations)];
const resolutions=await wikiRevisionResolutions(guideTitles),built=buildSkillTrainingGuideInventory({skillDomains:domains.records,skillPages,centralIndexPage:{title:'Skill training guides',content:indexRevision.slots?.main?.content||'',sourceRevision:indexRevision.revid,sourceTimestamp:indexRevision.timestamp,sourceUrl:sourceUrl('Skill training guides')},guideResolutions:resolutions}),records=built.records.map(record=>({...record,contentHash:hash(record)}));
const source={kind:'osrs_wiki_cross_skill_training_guide_inventory',api:WIKI_API,skillsPage:{revision:String(skillsRevision.revid),timestamp:skillsRevision.timestamp},centralIndex:{revision:String(indexRevision.revid),timestamp:indexRevision.timestamp},skillPages:skillPages.map(page=>({title:page.title,revision:String(page.sourceRevision),timestamp:page.sourceTimestamp})),guidePages:resolutions.map(row=>({requestedTitle:row.requestedTitle,resolvedTitle:row.page?.title||null,revision:row.page?.revisions?.[0]?.revid?String(row.page.revisions[0].revid):null,timestamp:row.page?.revisions?.[0]?.timestamp||null,redirected:row.redirected})),audit:built.audit};
const snapshot=await writeSnapshot(root,'skill-training-guide-inventory',records,source);
console.log(JSON.stringify({manifest:snapshot.manifest,audit:built.audit},null,2));
if(!built.audit.publishable)process.exitCode=2;
