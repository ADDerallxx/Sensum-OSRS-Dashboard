import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseAgilityAccessVariants,parsePenguinAccessSupportingEvidence} from './agility-access-variant-lib.mjs';
import {parsePenguinAccessReconciliationEvidence,reconcilePenguinAccessVariant} from './agility-penguin-access-evidence-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const titles=['Ape Atoll Agility Course','Penguin Agility Course','Werewolf Agility Course','Agility','Cold War','Iceberg'];
const pages=await wikiRevisions(titles),records=[];
const overviewPage=pages.find(page=>page.title==='Agility'),overviewRevision=overviewPage?.revisions?.[0],penguinSupport=overviewRevision?parsePenguinAccessSupportingEvidence({content:overviewRevision.slots?.main?.content||'',sourceRevision:overviewRevision.revid,sourceTimestamp:overviewRevision.timestamp,sourceUrl:'https://oldschool.runescape.wiki/w/Agility'}):null;
const sourceInput=title=>{const page=pages.find(item=>item.title===title),revision=page?.revisions?.[0];return {title:page?.title,content:revision?.slots?.main?.content||'',sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:`https://oldschool.runescape.wiki/w/${encodeURIComponent(String(page?.title||title).replace(/ /g,'_'))}`}};
const penguinReconciliation=parsePenguinAccessReconciliationEvidence({coursePage:sourceInput('Penguin Agility Course'),icebergPage:sourceInput('Iceberg'),questPage:sourceInput('Cold War'),overviewPage:sourceInput('Agility')});
for(const page of pages){
  if(page.title==='Agility')continue;
  const revision=page.revisions?.[0];if(!revision)continue;
  const sourceUrl=`https://oldschool.runescape.wiki/w/${encodeURIComponent(page.title.replace(/ /g,'_'))}`;
  for(const parsed of parseAgilityAccessVariants({title:page.title,content:revision.slots?.main?.content||'',sourceRevision:revision.revid,sourceTimestamp:revision.timestamp,sourceUrl})){
    const row=page.title==='Penguin Agility Course'?reconcilePenguinAccessVariant(parsed,{reconciliationEvidence:penguinReconciliation,overviewEvidence:penguinSupport}):parsed;
    records.push({...row,content_hash:hash(row)});
  }
}
const report=audit(records,{minimum:5,required:['parent_name','variant_key','axis_coverage','entry_level','requirements','source_revision','source_locator'],maximumUnknownRatio:0});
if(!penguinReconciliation)report.findings.push({severity:'blocker',rule:'penguin_access_reconciliation_evidence_missing'});report.publishable=!report.findings.some(finding=>finding.severity==='blocker');
const snapshot=await writeSnapshot(root,'agility-access-variants',records,{kind:'osrs_wiki_agility_access_variants',api:WIKI_API,pages:titles,penguinAccessReconciliation:penguinReconciliation?{evidenceKey:penguinReconciliation.evidence_key,resolution:penguinReconciliation.resolution,sourceRevision:penguinReconciliation.source_revision,supportingSourceRevisions:penguinReconciliation.supporting_source_revisions}:null,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,records:records.length,penguinAccessReconciliation:penguinReconciliation?.resolution||null,findings:report.findings},null,2));
