import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseAgilityPyramidEarlyLevelVariant} from './agility-pyramid-variant-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data'),titles=['Agility Pyramid','Agility training'],pages=await wikiRevisions(titles),byTitle=new Map(pages.map(page=>[page.title,page]));
const source=title=>{const page=byTitle.get(title),revision=page?.revisions?.[0];return {content:revision?.slots?.main?.content||'',source:{sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:`https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replace(/ /g,'_'))}`}}};
const course=source('Agility Pyramid'),guide=source('Agility training'),records=parseAgilityPyramidEarlyLevelVariant({courseContent:course.content,guideContent:guide.content,courseSource:course.source,guideSource:guide.source}).map(row=>({...row,content_hash:hash(row)}));
const report=audit(records,{minimum:1,required:['parent_name','variant_key','entry_level','observed_xp_per_hour','observed_xp_per_hour_level_scope','observed_rate_source_revision','observed_rate_source_locator','source_revision','supporting_evidence','source_locator'],maximumUnknownRatio:0});
const snapshot=await writeSnapshot(root,'agility-pyramid-variants',records,{kind:'osrs_wiki_agility_pyramid_level_scoped_observation',api:WIKI_API,pages:titles,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,records:records.length,findings:report.findings},null,2));
