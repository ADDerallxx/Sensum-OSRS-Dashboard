import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {enrichAgilityCandidateConditions,parseAgilityTrainingGuideCandidates,parseRooftopTargetConditionEvidence} from './agility-training-guide-lib.mjs';
import {buildRooftopObservedRateVariants} from './agility-rooftop-observed-variant-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data'),titles=['Agility training','Varrock Rooftop Course'],pages=await wikiRevisions(titles),guideRows=[],conditionRows=[];
for(const page of pages){const revision=page.revisions?.[0];if(!revision)continue;const input={title:page.title,content:revision.slots?.main?.content||'',sourceRevision:revision.revid,sourceTimestamp:revision.timestamp,sourceUrl:`https://oldschool.runescape.wiki/w/${encodeURIComponent(page.title.replace(/ /g,'_'))}`};guideRows.push(...parseAgilityTrainingGuideCandidates(input));conditionRows.push(...parseRooftopTargetConditionEvidence(input))}
const candidates=enrichAgilityCandidateConditions(guideRows,conditionRows),records=buildRooftopObservedRateVariants(candidates).map(row=>({...row,content_hash:hash(row)}));
const report=audit(records,{minimum:1,required:['parent_name','variant_key','entry_level','base_agility_level_minimum','base_agility_level_maximum','observed_xp_per_hour_range','observed_xp_per_hour_level_scope','observed_rate_source_revision','observed_rate_source_locator','source_revision','supporting_evidence','source_locator'],maximumUnknownRatio:0});
const snapshot=await writeSnapshot(root,'agility-rooftop-observed-variants',records,{kind:'osrs_wiki_condition_scoped_rooftop_observed_rate_range',api:WIKI_API,pages:titles,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,records:records.length,findings:report.findings},null,2));
