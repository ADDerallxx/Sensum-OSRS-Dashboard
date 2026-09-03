import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseBarbarianFishingVariants} from './agility-barbarian-fishing-variant-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const titles=['Barbarian Training','Pay-to-play Fishing training','Leaping trout','Leaping salmon','Leaping sturgeon','Module:Skilling success chart'];
const pages=(await wikiRevisions(titles)).map(page=>{const revision=page.revisions?.[0];return {title:page.title,content:revision?.slots?.main?.content||'',sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:`https://oldschool.runescape.wiki/w/${encodeURIComponent(page.title.replace(/ /g,'_'))}`}});
const records=parseBarbarianFishingVariants({pages}).map(row=>({...row,content_hash:hash(row)}));
const report=audit(records,{minimum:18,required:['variant_key','name','skill_requirements','available_catches','catch_roll_parameters','catch_probabilities','catch_probability_formula','xp_per_attempt','interaction_policy','observed_xp_per_hour','observed_xp_per_hour_by_skill','source_revision','supporting_source_revisions','source_locator'],maximumUnknownRatio:0});
const snapshot=await writeSnapshot(root,'agility-barbarian-fishing-variants',records,{kind:'osrs_wiki_cross_page_barbarian_fishing_variants',api:WIKI_API,pages:titles,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,records:records.length,benchmarks:[...new Set(records.map(row=>row.rate_benchmark_fishing_level))],policies:[...new Set(records.map(row=>row.interaction_policy+':'+row.disposal_policy))],findings:report.findings},null,2));
