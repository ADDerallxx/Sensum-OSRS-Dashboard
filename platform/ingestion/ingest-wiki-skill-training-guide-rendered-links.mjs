import fs from 'node:fs/promises';
import path from 'node:path';
import {fetchJson,hash,writeSnapshot} from './lib.mjs';
import {WIKI_API,wikiRevisionMetadataResolutions} from './activity-evidence-lib.mjs';
import {buildSkillTrainingGuideRenderInventory} from './skill-training-guide-rendered-link-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data');
const normalize=value=>String(value||'').replaceAll('_',' ').replace(/\s+/g,' ').trim();
const key=(title,revision)=>`${normalize(title)}|${revision}`;

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

function expectedGuidesFromInputs(guideInventoryRows,sourceDependencyManifest){
  const contexts=new Map();
  for(const record of guideInventoryRows)for(const guide of record.guides||[])if(guide.available&&guide.resolvedTitle&&guide.sourceRevision){
    const identity=key(guide.resolvedTitle,guide.sourceRevision);if(!contexts.has(identity))contexts.set(identity,[]);contexts.get(identity).push({skillKey:record.skillKey,skill:record.skill,channel:guide.channel});
  }
  return (sourceDependencyManifest.source?.fetchedGuideRevisions||[]).map(guide=>{const rows=contexts.get(key(guide.title,guide.revision))||[];return {pageId:Number(guide.pageId),title:guide.title,revision:String(guide.revision),timestamp:guide.timestamp,contentHash:guide.contentHash,url:`https://oldschool.runescape.wiki/w/${encodeURIComponent(guide.title.replaceAll(' ','_'))}`,skillKeys:[...new Set(rows.map(row=>row.skillKey))],channels:[...new Set(rows.map(row=>row.channel))]}}).sort((a,b)=>a.pageId-b.pageId||a.revision.localeCompare(b.revision));
}

async function mapConcurrent(items,limit,worker){
  const results=new Array(items.length);let cursor=0;
  async function run(){for(;;){const index=cursor++;if(index>=items.length)return;results[index]=await worker(items[index],index)}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run));return results;
}

async function parsePinnedGuide(guide){
  const observedAt=new Date().toISOString(),params=new URLSearchParams({action:'parse',format:'json',formatversion:'2',oldid:guide.revision,prop:'links|categories|images|templates|revid',disablelimitreport:'1',disableeditsection:'1',maxlag:'5'});
  try{
    const data=await fetchJson(`${WIKI_API}?${params}`),response=data.parse?{pageid:Number(data.parse.pageid),title:data.parse.title,revid:Number(data.parse.revid),links:data.parse.links||[],categories:data.parse.categories||[],images:data.parse.images||[],templates:data.parse.templates||[]}:null;
    return {guidePageId:guide.pageId,guideTitle:guide.title,requestedRevision:guide.revision,guideTimestamp:guide.timestamp,guideContentHash:guide.contentHash,guideUrl:guide.url,skillKeys:guide.skillKeys,channels:guide.channels,observedAt,response,parserError:data.error||(!response?{code:'missing_parse_payload',message:'Official parser response did not include parse data.'}:null)};
  }catch(error){return {guidePageId:guide.pageId,guideTitle:guide.title,requestedRevision:guide.revision,guideTimestamp:guide.timestamp,guideContentHash:guide.contentHash,guideUrl:guide.url,skillKeys:guide.skillKeys,channels:guide.channels,observedAt,response:null,parserError:{code:'fetch_or_parse_error',message:error.message}}}
}

const [guideInventory,directLinks,sourceDependencies]=await Promise.all([
  latestSnapshot('skill-training-guide-inventory',(manifest,rows)=>manifest.source?.audit?.publishable===true&&rows.length===24?[]:['guide_inventory_foundation_not_publishable']),
  latestSnapshot('skill-training-guide-direct-link',(manifest)=>manifest.source?.audit?.guideCoverage?.exactGuideRevisionSetMatch===true&&manifest.source?.audit?.directLinkCoverage?.exactOccurrenceSetMatch===true?[]:['direct_link_inventory_not_structurally_complete']),
  latestSnapshot('skill-training-guide-template-dependency',(manifest)=>manifest.source?.audit?.sourceInvocationInventoryComplete===true?[]:['source_dependency_inventory_not_structurally_complete'])
]);

const expectedGuides=expectedGuidesFromInputs(guideInventory.rows,sourceDependencies.manifest),parserObservations=await mapConcurrent(expectedGuides,4,parsePinnedGuide),renderedTitles=[...new Set(parserObservations.flatMap(row=>[...(row.response?.links||[]).map(link=>link.title),...(row.response?.categories||[]).map(category=>`Category:${normalize(category.category)}`),...(row.response?.images||[]).map(image=>`File:${normalize(image)}`)]))],dependencyTitles=[...new Set(parserObservations.flatMap(row=>row.response?.templates||[]).map(row=>row.title))],[linkTargetResolutions,dependencyTargetResolutions]=await Promise.all([wikiRevisionMetadataResolutions(renderedTitles),wikiRevisionMetadataResolutions(dependencyTitles)]),built=buildSkillTrainingGuideRenderInventory({expectedGuides,parserObservations,linkTargetResolutions,dependencyTargetResolutions,directLinkRecords:directLinks.rows,sourceDependencyRecords:sourceDependencies.rows});

const inputSnapshots={guideInventory:{directory:guideInventory.directory,contentHash:guideInventory.manifest.contentHash,rejections:guideInventory.rejections},directLinks:{directory:directLinks.directory,contentHash:directLinks.manifest.contentHash,rejections:directLinks.rejections},sourceDependencies:{directory:sourceDependencies.directory,contentHash:sourceDependencies.manifest.contentHash,rejections:sourceDependencies.rejections}},commonSource={kind:'official_parser_observation_of_revision_pinned_training_guides_with_current_target_resolution',api:WIKI_API,parserMode:'action=parse oldid with links categories images templates and revid',inputSnapshots,audit:built.audit},observationSnapshot=await writeSnapshot(root,'skill-training-guide-render-observation',built.renderObservations.map(record=>({...record,contentHash:hash(record)})),commonSource),renderedLinkSnapshot=await writeSnapshot(root,'skill-training-guide-rendered-link',built.renderedLinks.map(record=>({...record,contentHash:hash(record)})),commonSource),generatedAt=new Date().toISOString(),report={...built.audit,generatedAt,inputSnapshots,outputSnapshots:{renderObservations:{directory:path.basename(observationSnapshot.dir),contentHash:observationSnapshot.manifest.contentHash},renderedLinks:{directory:path.basename(renderedLinkSnapshot.dir),contentHash:renderedLinkSnapshot.manifest.contentHash}}};
report.contentHash=hash({...report,contentHash:undefined});
const auditDirectory=path.join(root,'skill-training-guide-rendered-link-audits',generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(auditDirectory,{recursive:true});await fs.writeFile(path.join(auditDirectory,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({contract:report.contract,generatedAt:report.generatedAt,outputSnapshots:report.outputSnapshots,coverage:{guideRenderCoverage:report.guideRenderCoverage,renderedLinkCoverage:report.renderedLinkCoverage,parserDependencyCoverage:report.parserDependencyCoverage,directSourceReconciliation:report.directSourceReconciliation,semanticPromotionCoverage:report.semanticPromotionCoverage,renderedLinkObservationComplete:report.renderedLinkObservationComplete,historicalDependencyRevisionClosureComplete:report.historicalDependencyRevisionClosureComplete,renderedOnlyOriginAttributionComplete:report.renderedOnlyOriginAttributionComplete,completeActivityUniverse:report.completeActivityUniverse,absoluteBestGate:report.absoluteBestGate,blockers:report.blockers,publishable:report.publishable}},null,2));
if(!report.publishable)process.exitCode=2;
