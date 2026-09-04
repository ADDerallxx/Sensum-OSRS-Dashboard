import fs from 'node:fs/promises';
import path from 'node:path';
import {fetchJson,hash,writeSnapshot} from './lib.mjs';
import {WIKI_API,wikiRevisionMetadataResolutions} from './activity-evidence-lib.mjs';
import {buildSkillTrainingGuideDirectLinkInventory,collectSkillTrainingGuideDirectLinkReferences} from './skill-training-guide-direct-link-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data');
const normalizedTitle=value=>String(value||'').replaceAll('_',' ').replace(/\s+/g,' ').trim();
const guideKey=(title,revision)=>`${normalizedTitle(title).toLowerCase()}|${revision}`;

async function latestSnapshot(domain,sourceGate){
  const directories=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry=>entry.name).sort().reverse(),rejections=[];
  for(const directory of directories){
    const file=path.join(root,directory,`${domain}.ndjson`);
    try{
      const raw=await fs.readFile(file,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8')),reasons=[];
      if(manifest.domain!==domain)reasons.push('manifest_domain_mismatch');
      if(manifest.records!==rows.length)reasons.push('record_count_mismatch');
      if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');
      reasons.push(...sourceGate(manifest,rows));
      if(reasons.length){rejections.push({directory,reasons});continue}
      return {directory,rows,manifest,rejections};
    }catch(error){if(error.code!=='ENOENT')rejections.push({directory,reasons:['snapshot_validation_error'],message:error.message})}
  }
  throw new Error(`No valid ${domain} snapshot exists.`);
}

function expectedGuidesFromInventory(records){
  const guides=new Map();
  for(const record of records)for(const guide of record.guides||[]){
    if(!guide.available||!guide.resolvedTitle||!guide.sourceRevision)continue;
    const key=guideKey(guide.resolvedTitle,guide.sourceRevision);
    if(!guides.has(key))guides.set(key,{resolvedTitle:guide.resolvedTitle,sourceRevision:String(guide.sourceRevision),sourceTimestamp:guide.sourceTimestamp,sourceUrl:guide.sourceUrl,contexts:[]});
    guides.get(key).contexts.push({skillKey:record.skillKey,skill:record.skill,channel:guide.channel});
  }
  return [...guides.values()].map(guide=>({...guide,contexts:guide.contexts.sort((a,b)=>a.skillKey.localeCompare(b.skillKey)||a.channel.localeCompare(b.channel))})).sort((a,b)=>guideKey(a.resolvedTitle,a.sourceRevision).localeCompare(guideKey(b.resolvedTitle,b.sourceRevision)));
}

async function fetchGuideRevisions(expectedGuides){
  const fetched=[];
  for(let index=0;index<expectedGuides.length;index+=20){
    const batch=expectedGuides.slice(index,index+20),url=`${WIKI_API}?action=query&format=json&formatversion=2&prop=revisions&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&revids=${encodeURIComponent(batch.map(row=>row.sourceRevision).join('|'))}`,data=await fetchJson(url),revisionRows=(data.query?.pages||[]).flatMap(page=>(page.revisions||[]).map(revision=>({page,revision}))),byRevision=new Map(revisionRows.map(row=>[String(row.revision.revid),row]));
    for(const expected of batch){
      const match=byRevision.get(String(expected.sourceRevision));if(!match)continue;
      const content=match.revision.slots?.main?.content||'',contexts=expected.contexts||[];
      fetched.push({title:match.page.title,sourcePageId:Number(match.page.pageid),sourceRevision:String(match.revision.revid),sourceTimestamp:match.revision.timestamp,sourceUrl:expected.sourceUrl,sourceContentHash:hash(content),content,skillKeys:[...new Set(contexts.map(row=>row.skillKey))],channels:[...new Set(contexts.map(row=>row.channel))]});
    }
    if(index+20<expectedGuides.length)await new Promise(resolve=>setTimeout(resolve,350));
  }
  return fetched;
}

const [guideInventory,unlockEquivalence]=await Promise.all([
  latestSnapshot('skill-training-guide-inventory',(manifest,rows)=>{const reasons=[];if(manifest.source?.audit?.publishable!==true||rows.length!==24)reasons.push('guide_inventory_foundation_not_publishable');return reasons}),
  latestSnapshot('unlock-linked-page-wiki-equivalence',(manifest)=>{const reasons=[];if(manifest.source?.audit?.publishable!==true||manifest.source?.audit?.wikiPageEquivalenceComplete!==true)reasons.push('wiki_equivalence_not_publishable');return reasons})
]);
const expectedGuides=expectedGuidesFromInventory(guideInventory.rows),guidePages=await fetchGuideRevisions(expectedGuides),preliminary=collectSkillTrainingGuideDirectLinkReferences(guidePages),mainTitles=preliminary.records.filter(row=>row.namespaceClass==='main').map(row=>row.requestedTitles[0]),targetResolutions=await wikiRevisionMetadataResolutions(mainTitles),built=buildSkillTrainingGuideDirectLinkInventory({expectedGuides,guidePages,targetResolutions,unlockEquivalenceRecords:unlockEquivalence.rows});
const source={kind:'revision_pinned_cross_skill_training_guide_direct_source_link_inventory_with_stable_page_id_unlock_intersection',api:WIKI_API,inputSnapshots:{guideInventory:{directory:guideInventory.directory,contentHash:guideInventory.manifest.contentHash,rejections:guideInventory.rejections},unlockEquivalence:{directory:unlockEquivalence.directory,contentHash:unlockEquivalence.manifest.contentHash,rejections:unlockEquivalence.rejections}},expectedGuideRevisionCount:expectedGuides.length,fetchedGuideRevisions:guidePages.map(row=>({title:row.title,pageId:row.sourcePageId,revision:row.sourceRevision,timestamp:row.sourceTimestamp,contentHash:row.sourceContentHash})),audit:built.audit},snapshot=await writeSnapshot(root,'skill-training-guide-direct-link',built.records.map(record=>({...record,contentHash:hash(record)})),source),generatedAt=new Date().toISOString(),report={...built.audit,generatedAt,inputSnapshots:source.inputSnapshots,outputSnapshot:{directory:path.basename(snapshot.dir),contentHash:snapshot.manifest.contentHash}};
report.contentHash=hash({...report,contentHash:undefined});
const auditDirectory=path.join(root,'skill-training-guide-direct-link-audits',generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(auditDirectory,{recursive:true});await fs.writeFile(path.join(auditDirectory,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({contract:report.contract,generatedAt:report.generatedAt,inputSnapshots:report.inputSnapshots,outputSnapshot:report.outputSnapshot,coverage:{guideCoverage:report.guideCoverage,directLinkCoverage:{parsedOccurrenceCount:report.directLinkCoverage.parsedOccurrenceCount,preservedOccurrenceCount:report.directLinkCoverage.preservedOccurrenceCount,uniqueTargetCount:report.directLinkCoverage.uniqueTargetCount,mainNamespaceTargetCount:report.directLinkCoverage.mainNamespaceTargetCount,nonMainNamespaceTargetCount:report.directLinkCoverage.nonMainNamespaceTargetCount,inPageFragmentTargetCount:report.directLinkCoverage.inPageFragmentTargetCount,dynamicTargetCount:report.directLinkCoverage.dynamicTargetCount,exactOccurrenceSetMatch:report.directLinkCoverage.exactOccurrenceSetMatch},resolutionCoverage:{attemptedMainNamespaceTargets:report.resolutionCoverage.attemptedMainNamespaceTargets,revisionPinnedMainNamespaceTargets:report.resolutionCoverage.revisionPinnedMainNamespaceTargets,missingApiResponseCount:report.resolutionCoverage.missingApiResponseTargetKeys.length,missingPageCount:report.resolutionCoverage.missingPageTargetKeys.length,unresolvedProvenanceCount:report.resolutionCoverage.unresolvedProvenanceTargetKeys.length},unlockIntersectionCoverage:report.unlockIntersectionCoverage,semanticPromotionCoverage:report.semanticPromotionCoverage,inventoryFoundationComplete:report.inventoryFoundationComplete,templateGeneratedLinkCoverageComplete:report.templateGeneratedLinkCoverageComplete,completeActivityUniverse:report.completeActivityUniverse,absoluteBestGate:report.absoluteBestGate,blockers:report.blockers,publishable:report.publishable}},null,2));
if(!report.publishable)process.exitCode=2;
