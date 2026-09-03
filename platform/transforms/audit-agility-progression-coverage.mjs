import fs from 'node:fs/promises';
import path from 'node:path';
import {hash} from '../ingestion/lib.mjs';
import {auditAgilityLevelCoverage} from './agility-level34-coverage-lib.mjs';
import {auditSkillProgressionCoverage} from './skill-progression-coverage-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||'.platform-data');
const readRows=async file=>(await fs.readFile(file,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

async function latestRootSnapshot(domain){
  const directories=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort().reverse(),rejections=[];
  for(const directory of directories){
    const file=path.join(root,directory,`${domain}.ndjson`);
    try{await fs.access(file)}catch{continue}
    try{
      const raw=await fs.readFile(file,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8')),reasons=[];
      if(manifest.domain!==domain)reasons.push('manifest_domain_mismatch');
      if(manifest.source?.audit?.publishable!==true)reasons.push('source_audit_not_publishable');
      if(manifest.records!==rows.length)reasons.push('record_count_mismatch');
      if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');
      if(reasons.length){rejections.push({kind:domain,directory,reasons});continue}
      return {directory,rows,manifest,rejections};
    }catch(error){rejections.push({kind:domain,directory,reasons:['snapshot_validation_error'],message:error.message})}
  }
  throw new Error(`No valid ${domain} snapshot exists.`);
}

async function latestVectors(){
  const base=path.join(root,'activity-vectors'),directories=(await fs.readdir(base,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort().reverse(),rejections=[];
  for(const directory of directories){
    try{
      const rows=await readRows(path.join(base,directory,'vectors.ndjson')),report=JSON.parse(await fs.readFile(path.join(base,directory,'report.json'),'utf8')),reasons=[];
      if(report.contract!=='sensum.golden-activity-vector-generation.v1')reasons.push('unexpected_report_contract');
      if(report.records!==rows.length)reasons.push('record_count_mismatch');
      if(report.contentHash!==hash(rows))reasons.push('content_hash_mismatch');
      if(reasons.length){rejections.push({kind:'activity-vectors',directory,reasons});continue}
      return {directory,rows,report,rejections};
    }catch(error){rejections.push({kind:'activity-vectors',directory,reasons:['snapshot_validation_error'],message:error.message})}
  }
  throw new Error('No valid activity-vector snapshot exists.');
}

const [domains,guide,vectors]=await Promise.all([latestRootSnapshot('skill-level-domains'),latestRootSnapshot('agility-level34-candidates'),latestVectors()]);
const agilityDomain=domains.rows.find(record=>record.skill==='Agility');
if(!agilityDomain)throw new Error('The valid skill-domain snapshot does not contain Agility.');
const report=auditSkillProgressionCoverage({
  skillDomain:agilityDomain,
  methodUniverse:{
    complete:false,
    candidateSources:[{kind:'selected_training_guide_sections',snapshot:guide.directory,sourceRevision:guide.rows[0]?.source_revision||null},{kind:'activity_vectors',snapshot:vectors.directory,contentHash:vectors.report.contentHash}],
    blockers:['training_guide_parser_covers_only_selected_sections','complete_agility_method_universe_not_audited']
  },
  performanceBreakpointCoverage:{complete:false,blockers:['performance_and_ranking_breakpoints_not_audited']},
  reusableEvidenceRecords:guide.rows,
  evaluateBaseLevel:baseLevel=>auditAgilityLevelCoverage({guideCandidates:guide.rows,vectors:vectors.rows,targetBaseAgility:baseLevel,guideSnapshot:{dir:guide.directory,revision:guide.rows[0]?.source_revision||null,contentHash:guide.manifest.contentHash},vectorSnapshot:{dir:vectors.directory,contentHash:vectors.report.contentHash}}),
  snapshotRejections:[...domains.rejections,...guide.rejections,...vectors.rejections]
});
report.generatedAt=new Date().toISOString();
report.inputSnapshots={skillDomains:{directory:domains.directory,contentHash:domains.manifest.contentHash},guide:{directory:guide.directory,contentHash:guide.manifest.contentHash},vectors:{directory:vectors.directory,contentHash:vectors.report.contentHash}};
report.contentHash=hash({...report,contentHash:undefined});
const output=path.join(root,'skill-progression-coverage-audits',report.generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({contract:report.contract,generatedAt:report.generatedAt,skill:report.skill,levelDomain:report.levelDomain,levelCoverage:report.levelCoverage,structuralBreakpointCount:report.structuralBreakpoints.length,embeddedQueryLevelDefectCount:report.embeddedQueryLevelDefects.length,embeddedAccountQueryEvidenceCount:report.embeddedAccountQueryEvidence.length,fullSkillCoverageSatisfied:report.fullSkillCoverageSatisfied,authoritativeClaimGate:report.authoritativeClaimGate,blockers:report.blockers,inputSnapshots:report.inputSnapshots,contentHash:report.contentHash},null,2));
if(!report.fullSkillCoverageSatisfied)process.exitCode=2;
