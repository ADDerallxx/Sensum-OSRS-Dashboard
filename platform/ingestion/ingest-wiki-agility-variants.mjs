import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {enrichAgilityVariantsWithSupportingEvidence,parseAgilityVariants,parseShayzienBasicSupportingEvidence} from './agility-variant-lib.mjs';
import {enrichAgilityVariantsWithObstacleEvidence,parseShayzienBasicObstacleEvidence} from './agility-shayzien-obstacle-evidence-lib.mjs';
import {WIKI_API,wikiCategoryMembers,wikiRevisions} from './activity-evidence-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const members=await wikiCategoryMembers('Agility courses'),pages=await wikiRevisions(members.map(x=>x.title)),rawRecords=[];
const sourceInput=page=>{const revision=page?.revisions?.[0];return {title:page?.title,content:revision?.slots?.main?.content||'',sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:`https://oldschool.runescape.wiki/w/${encodeURIComponent(String(page?.title||'').replace(/ /g,'_'))}`}};
for(const page of pages){const input=sourceInput(page);for(const record of parseAgilityVariants(input))rawRecords.push(record)}
const supportingPages=await wikiRevisions(['Agility']),supportingEvidence=supportingPages.flatMap(page=>parseShayzienBasicSupportingEvidence(sourceInput(page)));
const obstacleTitles=['Ladder (Shayzien Agility Course)','Monkeybars (Shayzien Agility Course)','Tightrope (Shayzien Agility Course)','Bar (Shayzien Agility Course)','Gap (Shayzien Agility Course)'],obstaclePages=await wikiRevisions(obstacleTitles),shayzienCourse=pages.find(page=>page.title==='Shayzien Agility Course'),agilityOverview=supportingPages.find(page=>page.title==='Agility');
const obstacleEvidence=parseShayzienBasicObstacleEvidence({coursePage:sourceInput(shayzienCourse),overviewPage:sourceInput(agilityOverview),obstaclePages:obstaclePages.map(sourceInput)});
const records=enrichAgilityVariantsWithObstacleEvidence(enrichAgilityVariantsWithSupportingEvidence(rawRecords,supportingEvidence),obstacleEvidence).map(record=>({...record,content_hash:hash(record)}));
const report=audit(records,{minimum:4,required:['parent_name','variant_key','name','entry_level','xp_per_lap','cycle_seconds','source_revision','source_locator'],maximumUnknownRatio:0});
if(!supportingEvidence.some(row=>row.parent_name==='Shayzien Agility Course'&&row.variant_key==='basic'))report.findings.push({severity:'blocker',rule:'shayzien_basic_supporting_evidence_missing'});
if(!obstacleEvidence.some(row=>row.candidate_key==='agility-variant:Shayzien Agility Course:basic'))report.findings.push({severity:'blocker',rule:'shayzien_basic_obstacle_failure_scope_evidence_missing'});
for(const row of records)for(const conflict of row.supporting_evidence_conflicts||[])report.findings.push({severity:'record_blocker',record:row.record_key,...conflict});
for(const row of records)for(const conflict of row.obstacle_failure_evidence?.source_conflicts||[])report.findings.push({severity:'record_blocker',record:row.record_key,...conflict});
report.publishable=!report.findings.some(finding=>finding.severity==='blocker');
const snapshot=await writeSnapshot(root,'agility-variants',records,{kind:'osrs_wiki_composite_activity_variants_with_revision_pinned_supporting_evidence',api:WIKI_API,category:'Agility courses',categoryMembers:members.length,supportingEvidence:supportingEvidence.map(row=>({evidenceKey:row.evidence_key,sourceRevision:row.source_revision,sourceUrl:row.source_url})),obstacleEvidence:obstacleEvidence.map(row=>({evidenceKey:row.evidence_key,sourceRevision:row.source_revision,supportingSourceRevisions:row.supporting_source_revisions})),audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,records:records.length,supportingEvidence:supportingEvidence.length,obstacleEvidence:obstacleEvidence.length,variants:records.map(x=>({name:x.name,entryLevel:x.entry_level,xpPerLap:x.xp_per_lap,cycleSeconds:x.cycle_seconds,sourceWarning:x.source_warning})),findings:report.findings},null,2));
