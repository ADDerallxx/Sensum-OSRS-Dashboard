import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseAgilityAccessVariants} from './agility-access-variant-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const titles=['Ape Atoll Agility Course','Penguin Agility Course','Werewolf Agility Course'];
const pages=await wikiRevisions(titles),records=[];
for(const page of pages){
  const revision=page.revisions?.[0];if(!revision)continue;
  const sourceUrl=`https://oldschool.runescape.wiki/w/${encodeURIComponent(page.title.replace(/ /g,'_'))}`;
  for(const row of parseAgilityAccessVariants({title:page.title,content:revision.slots?.main?.content||'',sourceRevision:revision.revid,sourceTimestamp:revision.timestamp,sourceUrl}))records.push({...row,content_hash:hash(row)});
}
const report=audit(records,{minimum:5,required:['parent_name','variant_key','axis_coverage','entry_level','requirements','source_revision','source_locator'],maximumUnknownRatio:0});
const snapshot=await writeSnapshot(root,'agility-access-variants',records,{kind:'osrs_wiki_agility_access_variants',api:WIKI_API,pages:titles,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,records:records.length,findings:report.findings},null,2));
