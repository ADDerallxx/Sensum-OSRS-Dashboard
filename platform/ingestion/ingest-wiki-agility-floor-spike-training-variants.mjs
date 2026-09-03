import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseBrimhavenDetachedFloorSpikeVariants} from './agility-floor-spike-training-variant-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const titles=['Floor spikes (Brimhaven Agility Arena)','Brimhaven Agility Arena','Agility training'];
const pages=await wikiRevisions(titles),byTitle=new Map(pages.map(page=>[page.title,page]));
const input=title=>{const page=byTitle.get(title),revision=page?.revisions?.[0];return {title:page?.title,content:revision?.slots?.main?.content||'',sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:`https://oldschool.runescape.wiki/w/${encodeURIComponent(String(page?.title||title).replace(/ /g,'_'))}`}};
const records=parseBrimhavenDetachedFloorSpikeVariants({obstaclePage:input(titles[0]),arenaPage:input(titles[1]),guidePage:input(titles[2])}).map(row=>({...row,content_hash:hash(row)}));
const report=audit(records,{minimum:2,required:['parent_name','variant_key','name','entry_level','xp_per_success','cycle_ticks','failure_free_level','unscoped_observed_xp_per_hour','source_revision','supporting_source_revisions','source_locator'],maximumUnknownRatio:0});
const snapshot=await writeSnapshot(root,'agility-floor-spike-training-variants',records,{kind:'osrs_wiki_cross_page_floor_spike_training_variants',api:WIKI_API,pages:titles,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,records:records.length,variants:records.map(row=>({name:row.name,entryLevel:row.entry_level,failureFreeLevel:row.failure_free_level,cycleTicks:row.cycle_ticks,xpPerSuccess:row.xp_per_success,unscopedRate:row.unscoped_observed_xp_per_hour})),findings:report.findings},null,2));
