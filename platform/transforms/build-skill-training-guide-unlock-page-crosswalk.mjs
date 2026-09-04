import fs from 'node:fs/promises';
import path from 'node:path';
import {hash,writeSnapshot} from '../ingestion/lib.mjs';
import {buildSkillTrainingGuideUnlockPageCrosswalk} from './skill-training-guide-unlock-page-crosswalk-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||'.platform-data');

async function latestSnapshot(domain,gate){
  const directories=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry=>entry.name).sort().reverse(),rejections=[];
  for(const directory of directories){
    const file=path.join(root,directory,`${domain}.ndjson`);
    try{
      const raw=await fs.readFile(file,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8')),reasons=[];
      if(manifest.domain!==domain)reasons.push('manifest_domain_mismatch');
      if(manifest.records!==rows.length)reasons.push('record_count_mismatch');
      if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');
      reasons.push(...gate(manifest,rows));
      if(reasons.length){rejections.push({directory,reasons});continue}
      return {directory,rows,manifest,rejections};
    }catch(error){if(error.code!=='ENOENT')rejections.push({directory,reasons:['snapshot_validation_error'],message:error.message})}
  }
  throw new Error(`No valid ${domain} snapshot exists.`);
}

const [renderedLinks,unlockEquivalence]=await Promise.all([
  latestSnapshot('skill-training-guide-rendered-link',(manifest,rows)=>manifest.source?.audit?.renderedLinkObservationComplete===true&&manifest.source.audit.guideRenderCoverage?.exactGuideRevisionSetMatch===true&&manifest.source.audit.renderedLinkCoverage?.uniqueRenderedTargets===rows.length?[]:['rendered_link_observation_scope_not_complete']),
  latestSnapshot('unlock-linked-page-wiki-equivalence',(manifest,rows)=>manifest.source?.audit?.wikiPageEquivalenceComplete===true&&manifest.source.audit.publishable===true&&rows.every(record=>Number.isInteger(record.sourcePageId)&&record.sourcePageId>0)?[]:['unlock_wiki_page_equivalence_not_complete'])
]);
const built=buildSkillTrainingGuideUnlockPageCrosswalk({renderedLinkRecords:renderedLinks.rows,unlockEquivalenceRecords:unlockEquivalence.rows}),inputSnapshots={renderedLinks:{directory:renderedLinks.directory,contentHash:renderedLinks.manifest.contentHash,rejections:renderedLinks.rejections},unlockEquivalence:{directory:unlockEquivalence.directory,contentHash:unlockEquivalence.manifest.contentHash,rejections:unlockEquivalence.rejections}},source={kind:'exact_stable_wiki_page_id_crosswalk_between_rendered_training_guides_and_level_unlock_evidence',inputSnapshots,audit:built.audit},snapshot=await writeSnapshot(root,'skill-training-guide-unlock-page-crosswalk',built.records.map(record=>({...record,contentHash:hash(record)})),source),generatedAt=new Date().toISOString(),report={...built.audit,generatedAt,inputSnapshots,outputSnapshot:{directory:path.basename(snapshot.dir),contentHash:snapshot.manifest.contentHash}};
report.contentHash=hash({...report,contentHash:undefined});
const output=path.join(root,'skill-training-guide-unlock-page-crosswalk-audits',generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({contract:report.contract,generatedAt:report.generatedAt,inputSnapshots:report.inputSnapshots,outputSnapshot:report.outputSnapshot,coverage:{renderedTargetCoverage:report.renderedTargetCoverage,unlockEvidenceCoverage:report.unlockEvidenceCoverage,crossSourceIdentityCoverage:report.crossSourceIdentityCoverage,revisionCoverage:report.revisionCoverage,semanticRoutingCoverage:report.semanticRoutingCoverage,crosswalkCoverageComplete:report.crosswalkCoverageComplete,completeActivityUniverse:report.completeActivityUniverse,absoluteBestGate:report.absoluteBestGate,blockers:report.blockers,publishable:report.publishable}},null,2));
if(!report.publishable)process.exitCode=2;
