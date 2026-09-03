import fs from 'node:fs/promises';
import path from 'node:path';
import {hash} from '../ingestion/lib.mjs';
import {auditRockslidePairingUniverseCoverage} from './rockslide-pairing-universe-coverage-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||'.platform-data');

async function timestampDirectories(){
  return (await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry=>entry.name).sort().reverse();
}

async function latestRootSnapshot(domain,{optional=false}={}){
  const rejections=[];
  for(const directory of await timestampDirectories()){
    const file=path.join(root,directory,`${domain}.ndjson`);
    try{await fs.access(file)}catch{continue}
    try{
      const raw=await fs.readFile(file,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8')),reasons=[];
      if(manifest.domain!==domain)reasons.push('manifest_domain_mismatch');
      if(manifest.source?.audit?.publishable!==true)reasons.push('source_audit_not_publishable');
      if(manifest.records!==rows.length)reasons.push('record_count_mismatch');
      if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');
      if(reasons.length){rejections.push({domain,directory,reasons});continue}
      return {directory,rows,manifest,rejections,missing:false};
    }catch(error){rejections.push({domain,directory,reasons:['snapshot_validation_error'],message:error.message})}
  }
  if(optional)return {directory:null,rows:[],manifest:null,rejections,missing:true};
  throw new Error(`No valid ${domain} snapshot exists.`);
}

async function latestVectors(){
  const domainRoot=path.join(root,'activity-vectors'),rejections=[];
  let directories=[];
  try{directories=(await fs.readdir(domainRoot,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort().reverse()}catch{return {directory:null,rows:[],report:null,rejections:[],missing:true}}
  for(const directory of directories){
    try{
      const vectorFile=path.join(domainRoot,directory,'vectors.ndjson'),reportFile=path.join(domainRoot,directory,'report.json'),raw=await fs.readFile(vectorFile,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),report=JSON.parse(await fs.readFile(reportFile,'utf8')),reasons=[];
      if(report.records!==rows.length)reasons.push('record_count_mismatch');
      if(report.contentHash!==hash(rows))reasons.push('vector_content_hash_mismatch');
      if(reasons.length){rejections.push({domain:'activity-vectors',directory,reasons});continue}
      return {directory,rows,report,rejections,missing:false};
    }catch(error){rejections.push({domain:'activity-vectors',directory,reasons:['snapshot_validation_error'],message:error.message})}
  }
  return {directory:null,rows:[],report:null,rejections,missing:true};
}

const [skillDomains,namedGuideMembers,activityUniverseSnapshot,transportationUniverseSnapshot,pairingAssessmentSnapshot,vectors]=await Promise.all([
  latestRootSnapshot('skill-level-domains'),
  latestRootSnapshot('agility-rockslide-guide-members'),
  latestRootSnapshot('activity-universe',{optional:true}),
  latestRootSnapshot('transportation-universe',{optional:true}),
  latestRootSnapshot('rockslide-pairing-assessments',{optional:true}),
  latestVectors()
]);
const activityUniverse=activityUniverseSnapshot.rows[0]||null,transportationUniverse=transportationUniverseSnapshot.rows[0]||null,rockslideContext=transportationUniverse?.rockslideContext||null,pairingAssessments=pairingAssessmentSnapshot.rows;
const corpusSkills=[...new Set(vectors.rows.map(row=>row.skill).filter(Boolean))].sort();
const observedActivityCorpus={contract:vectors.report?.contract||null,recordCount:vectors.rows.length,skillCount:corpusSkills.length,skills:corpusSkills,sourceDirectory:vectors.directory,canProveCompleteActivityUniverse:false,reason:'golden_activity_vectors_are_a_review_corpus_not_an_independently_closed_activity_universe'};
const snapshotRejections=[...skillDomains.rejections,...namedGuideMembers.rejections,...activityUniverseSnapshot.rejections,...transportationUniverseSnapshot.rejections,...pairingAssessmentSnapshot.rejections,...vectors.rejections];
const report=auditRockslidePairingUniverseCoverage({skillDomains:skillDomains.rows,rockslideContext,activityUniverse,transportationUniverse,pairingAssessments,namedGuideMembers:namedGuideMembers.rows,observedActivityCorpus,snapshotRejections});
report.generatedAt=new Date().toISOString();
report.inputSnapshots={
  skillDomains:{directory:skillDomains.directory,contentHash:skillDomains.manifest.contentHash},
  namedGuideMembers:{directory:namedGuideMembers.directory,contentHash:namedGuideMembers.manifest.contentHash},
  activityUniverse:activityUniverseSnapshot.missing?{state:'missing'}:{directory:activityUniverseSnapshot.directory,contentHash:activityUniverseSnapshot.manifest.contentHash},
  transportationUniverse:transportationUniverseSnapshot.missing?{state:'missing'}:{directory:transportationUniverseSnapshot.directory,contentHash:transportationUniverseSnapshot.manifest.contentHash},
  pairingAssessments:pairingAssessmentSnapshot.missing?{state:'missing'}:{directory:pairingAssessmentSnapshot.directory,contentHash:pairingAssessmentSnapshot.manifest.contentHash},
  observedActivityVectors:vectors.missing?{state:'missing'}:{directory:vectors.directory,contentHash:vectors.report.contentHash}
};
report.contentHash=hash({...report,contentHash:undefined});
const output=path.join(root,'rockslide-pairing-universe-coverage-audits',report.generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.identityUniverseComplete||!report.mechanicalCoverageComplete)process.exitCode=2;
