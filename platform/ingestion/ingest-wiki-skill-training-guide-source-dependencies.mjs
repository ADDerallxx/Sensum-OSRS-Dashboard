import fs from 'node:fs/promises';
import path from 'node:path';
import {fetchJson,hash,writeSnapshot} from './lib.mjs';
import {WIKI_API,wikiRevisionMetadataResolutions,wikiRevisionResolutions} from './activity-evidence-lib.mjs';
import {
  buildSkillTrainingGuideTemplateDependencyInventory,
  buildMissingLinkProvenance,
  buildSkillTrainingGuideSourceDependencyAudit,
  collectSkillTrainingGuideTemplateDependencies
} from './skill-training-guide-source-dependency-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data');
const normalize=value=>String(value||'').replaceAll('_',' ').replace(/\s+/g,' ').trim();
const titleKey=value=>normalize(value).toLowerCase();
const guideKey=(title,revision)=>`${titleKey(title)}|${revision}`;

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
    const identity=guideKey(guide.resolvedTitle,guide.sourceRevision);
    if(!guides.has(identity))guides.set(identity,{resolvedTitle:guide.resolvedTitle,sourceRevision:String(guide.sourceRevision),sourceTimestamp:guide.sourceTimestamp,sourceUrl:guide.sourceUrl,contexts:[]});
    guides.get(identity).contexts.push({skillKey:record.skillKey,skill:record.skill,channel:guide.channel});
  }
  return [...guides.values()].map(guide=>({...guide,contexts:guide.contexts.sort((a,b)=>a.skillKey.localeCompare(b.skillKey)||a.channel.localeCompare(b.channel))})).sort((a,b)=>guideKey(a.resolvedTitle,a.sourceRevision).localeCompare(guideKey(b.resolvedTitle,b.sourceRevision)));
}

async function fetchPinnedGuideRevisions(expectedGuides){
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

async function fetchMagicWordAliases(){
  const data=await fetchJson(`${WIKI_API}?action=query&format=json&formatversion=2&meta=siteinfo&siprop=magicwords`);
  return [...new Set((data.query?.magicwords||[]).flatMap(row=>row.aliases||[]))];
}

function currentGuidePages(resolutions){
  return resolutions.filter(row=>row.page&&!Object.hasOwn(row.page,'missing')&&row.page.revisions?.[0]).map(row=>{
    const revision=row.page.revisions[0],content=revision.slots?.main?.content||'';
    return {title:row.page.title,sourcePageId:Number(row.page.pageid),sourceRevision:String(revision.revid),sourceTimestamp:revision.timestamp,sourceUrl:`https://oldschool.runescape.wiki/w/${encodeURIComponent(row.page.title.replaceAll(' ','_'))}`,sourceContentHash:hash(content),content,skillKeys:[],channels:[]};
  });
}

async function observeMissingTitle(requestedTitle){
  const query=`intitle:"${requestedTitle}"`,observedAt=new Date().toISOString(),params=new URLSearchParams({action:'query',format:'json',formatversion:'2',list:'search|logevents',srsearch:query,srnamespace:'0',srlimit:'10',letitle:requestedTitle,lelimit:'50'}),data=await fetchJson(`${WIKI_API}?${params}`);
  return {requestedTitle,query,observedAt,results:(data.query?.search||[]).map(row=>({title:row.title,pageid:Number(row.pageid)})),logEvents:data.query?.logevents||[]};
}

const [guideInventory,directLinks]=await Promise.all([
  latestSnapshot('skill-training-guide-inventory',(manifest,rows)=>manifest.source?.audit?.publishable===true&&rows.length===24?[]:['guide_inventory_foundation_not_publishable']),
  latestSnapshot('skill-training-guide-direct-link',(manifest)=>{
    const audit=manifest.source?.audit,reasons=[];
    if(audit?.guideCoverage?.exactGuideRevisionSetMatch!==true)reasons.push('direct_link_guide_revision_set_incomplete');
    if(audit?.directLinkCoverage?.exactOccurrenceSetMatch!==true)reasons.push('direct_link_occurrence_set_incomplete');
    if((audit?.resolutionCoverage?.missingApiResponseTargetKeys||[]).length)reasons.push('direct_link_resolution_assessment_incomplete');
    return reasons;
  })
]);

const expectedGuides=expectedGuidesFromInventory(guideInventory.rows),[guidePages,magicWordAliases]=await Promise.all([fetchPinnedGuideRevisions(expectedGuides),fetchMagicWordAliases()]),collected=collectSkillTrainingGuideTemplateDependencies(guidePages,magicWordAliases),pageTitles=[...new Set(collected.records.flatMap(row=>row.pageTitles||[]))],targetResolutions=await wikiRevisionMetadataResolutions(pageTitles),templateBuilt=buildSkillTrainingGuideTemplateDependencyInventory({expectedGuides,guidePages,magicWordAliases,targetResolutions});

const templateSource={kind:'revision_pinned_cross_skill_training_guide_source_template_dependency_inventory',api:WIKI_API,inputSnapshots:{guideInventory:{directory:guideInventory.directory,contentHash:guideInventory.manifest.contentHash,rejections:guideInventory.rejections},directLinks:{directory:directLinks.directory,contentHash:directLinks.manifest.contentHash,rejections:directLinks.rejections}},magicWordAliasCount:magicWordAliases.length,fetchedGuideRevisions:guidePages.map(row=>({title:row.title,pageId:row.sourcePageId,revision:row.sourceRevision,timestamp:row.sourceTimestamp,contentHash:row.sourceContentHash})),audit:templateBuilt.audit},templateSnapshot=await writeSnapshot(root,'skill-training-guide-template-dependency',templateBuilt.records.map(record=>({...record,contentHash:hash(record)})),templateSource);

const missingLinkRecords=directLinks.rows.filter(row=>row.resolutionState==='missing_wiki_page'),missingTitles=missingLinkRecords.map(row=>row.requestedTitles[0]),guideTitles=[...new Set(missingLinkRecords.flatMap(row=>row.references.map(reference=>reference.guideTitle)))],[exactTargetResolutions,headResolutions,observations]=await Promise.all([wikiRevisionMetadataResolutions(missingTitles),wikiRevisionResolutions(guideTitles),Promise.all(missingTitles.map(observeMissingTitle))]),candidateTitles=[...new Set(observations.flatMap(row=>row.results.map(result=>result.title)))],candidateResolutions=await wikiRevisionMetadataResolutions(candidateTitles),logs=Object.fromEntries(observations.map(row=>[titleKey(row.requestedTitle),row.logEvents])),provenanceBuilt=buildMissingLinkProvenance({missingLinkRecords,exactTargetResolutions,currentGuidePages:currentGuidePages(headResolutions),searchObservations:observations.map(({logEvents,...row})=>row),candidateResolutions,logEventsByTitle:logs});

const provenanceSource={kind:'source_authored_missing_training_guide_link_provenance_without_automatic_replacement',api:WIKI_API,inputSnapshots:{directLinks:{directory:directLinks.directory,contentHash:directLinks.manifest.contentHash,rejections:directLinks.rejections}},audit:provenanceBuilt.audit},provenanceSnapshot=await writeSnapshot(root,'skill-training-guide-missing-link-provenance',provenanceBuilt.records.map(record=>({...record,contentHash:hash(record)})),provenanceSource),generatedAt=new Date().toISOString(),combined=buildSkillTrainingGuideSourceDependencyAudit(templateBuilt.audit,provenanceBuilt.audit),report={...combined,generatedAt,inputSnapshots:{guideInventory:templateSource.inputSnapshots.guideInventory,directLinks:templateSource.inputSnapshots.directLinks},outputSnapshots:{templateDependencies:{directory:path.basename(templateSnapshot.dir),contentHash:templateSnapshot.manifest.contentHash},missingLinkProvenance:{directory:path.basename(provenanceSnapshot.dir),contentHash:provenanceSnapshot.manifest.contentHash}}};
report.contentHash=hash({...report,contentHash:undefined});
const auditDirectory=path.join(root,'skill-training-guide-source-dependency-audits',generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(auditDirectory,{recursive:true});await fs.writeFile(path.join(auditDirectory,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({contract:report.contract,generatedAt:report.generatedAt,outputSnapshots:report.outputSnapshots,coverage:{guideCoverage:report.guideCoverage,templateInvocationCoverage:report.templateInvocationCoverage,pageDependencyResolutionCoverage:report.pageDependencyResolutionCoverage,missingLinkProvenanceCoverage:{expectedMissingLinkCount:report.missingLinkProvenanceCoverage.expectedMissingLinkCount,provenanceRecordCount:report.missingLinkProvenanceCoverage.provenanceRecordCount,currentGuideHeadAssessmentCount:report.missingLinkProvenanceCoverage.currentGuideHeadAssessmentCount,missingLinksStillPresentAtCurrentHead:report.missingLinkProvenanceCoverage.missingLinksStillPresentAtCurrentHead,searchCandidateCount:report.missingLinkProvenanceCoverage.searchCandidateCount,automaticReplacementCount:report.missingLinkProvenanceCoverage.automaticReplacementCount,provenanceInventoryComplete:report.missingLinkProvenanceCoverage.provenanceInventoryComplete,missingLinkResolutionComplete:report.missingLinkProvenanceCoverage.missingLinkResolutionComplete},sourceDependencyInventoryComplete:report.sourceDependencyInventoryComplete,historicalExpansionClosureComplete:report.historicalExpansionClosureComplete,renderedTemplateLinkCoverageComplete:report.renderedTemplateLinkCoverageComplete,missingLinkResolutionComplete:report.missingLinkResolutionComplete,canonicalActivityIdentityCount:report.canonicalActivityIdentityCount,optimizerEligibleActivityCount:report.optimizerEligibleActivityCount,completeActivityUniverse:report.completeActivityUniverse,absoluteBestGate:report.absoluteBestGate,blockers:report.blockers,publishable:report.publishable}},null,2));
if(!report.publishable)process.exitCode=2;
