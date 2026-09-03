import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseAgilityObstacleTrainingVariants} from './agility-obstacle-training-variant-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const titles=['Yanille Agility Dungeon','Monkeybars (Edgeville Dungeon)'];
const pages=await wikiRevisions(titles),records=[];
for(const page of pages){
  const revision=page.revisions?.[0];
  if(!revision)continue;
  const sourceUrl=`https://oldschool.runescape.wiki/w/${encodeURIComponent(page.title.replace(/ /g,'_'))}`;
  for(const row of parseAgilityObstacleTrainingVariants({title:page.title,content:revision.slots?.main?.content||'',sourceRevision:revision.revid,sourceTimestamp:revision.timestamp,sourceUrl}))records.push({...row,content_hash:hash(row)});
}
const report=audit(records,{minimum:2,required:['parent_name','variant_key','name','entry_level','xp_per_success','failure_free_level','source_revision','source_locator'],maximumUnknownRatio:0});
for(const row of records)if(!Number.isFinite(Number(row.observed_xp_per_hour))&&!Number.isFinite(Number(row.observed_xp_per_hour_upper)))report.findings.push({severity:'blocker',rule:'observed_rate_missing',record:row.name});
report.publishable=!report.findings.some(finding=>finding.severity==='blocker');
const snapshot=await writeSnapshot(root,'agility-obstacle-training-variants',records,{kind:'osrs_wiki_structured_obstacle_training_variants',api:WIKI_API,pages:titles,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,records:records.length,variants:records.map(row=>({name:row.name,entryLevel:row.entry_level,failureFreeLevel:row.failure_free_level,observedRateMinimumLevel:row.observed_rate_minimum_level,observedRate:row.observed_xp_per_hour??row.observed_xp_per_hour_upper,observedRateKind:row.observed_rate_kind||null,cycleTimingBlocker:row.cycle_timing_blocker||null})),findings:report.findings},null,2));
