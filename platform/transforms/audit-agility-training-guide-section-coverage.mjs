import fs from 'node:fs/promises';
import path from 'node:path';
import {hash} from '../ingestion/lib.mjs';
import {auditAgilityTrainingGuideSectionCoverage} from './agility-training-guide-section-coverage-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||'.platform-data');
async function latestRootSnapshot(domain){
  const directories=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort().reverse(),rejections=[];
  for(const directory of directories){const file=path.join(root,directory,`${domain}.ndjson`);try{await fs.access(file)}catch{continue}try{const raw=await fs.readFile(file,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8')),reasons=[];if(manifest.domain!==domain)reasons.push('manifest_domain_mismatch');if(manifest.source?.audit?.publishable!==true)reasons.push('source_audit_not_publishable');if(manifest.records!==rows.length)reasons.push('record_count_mismatch');if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');if(reasons.length){rejections.push({domain,directory,reasons});continue}return {directory,rows,manifest,rejections}}catch(error){rejections.push({domain,directory,reasons:['snapshot_validation_error'],message:error.message})}}
  throw new Error(`No valid ${domain} snapshot exists.`);
}

async function latestReport(domain,contract){
  const base=path.join(root,domain),rejections=[];
  let directories=[];
  try{directories=(await fs.readdir(base,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort().reverse()}catch{return {report:null,directory:null,rejections}}
  for(const directory of directories){
    try{
      const report=JSON.parse(await fs.readFile(path.join(base,directory,'report.json'),'utf8')),reasons=[];
      if(report.contract!==contract)reasons.push('unexpected_report_contract');
      if(report.contentHash!==hash({...report,contentHash:undefined}))reasons.push('content_hash_mismatch');
      if(reasons.length){rejections.push({domain,directory,reasons});continue}
      return {report,directory,rejections};
    }catch(error){rejections.push({domain,directory,reasons:['report_validation_error'],message:error.message})}
  }
  return {report:null,directory:null,rejections};
}

const [sections,candidates,rooftopMemberCoverage,brimhavenMemberCoverage]=await Promise.all([
  latestRootSnapshot('agility-training-guide-sections'),
  latestRootSnapshot('agility-level34-candidates'),
  latestReport('agility-rooftop-guide-member-coverage-audits','sensum.agility-rooftop-guide-member-coverage-audit.v1'),
  latestReport('agility-brimhaven-guide-member-coverage-audits','sensum.agility-brimhaven-guide-member-coverage-audit.v1')
]);
const reportMemberAudit=input=>input.report?{
  sectionKey:input.report.sectionKey,
  complete:input.report.internalMemberAuditSatisfied===true,
  sourceRevision:input.report.guideSourceRevision,
  auditDirectory:input.directory,
  contentHash:input.report.contentHash,
  memberCount:input.report.memberCount,
  coveredMemberCount:input.report.coveredMemberCount,
  uncoveredMemberCount:input.report.uncoveredMemberCount
}:null;
const memberAudits=[reportMemberAudit(rooftopMemberCoverage),reportMemberAudit(brimhavenMemberCoverage)].filter(Boolean);
const report=auditAgilityTrainingGuideSectionCoverage({sections:sections.rows,candidates:candidates.rows,memberAudits});
report.generatedAt=new Date().toISOString();
report.inputSnapshots={
  sections:{directory:sections.directory,contentHash:sections.manifest.contentHash},
  candidates:{directory:candidates.directory,contentHash:candidates.manifest.contentHash},
  rooftopMemberCoverage:rooftopMemberCoverage.report?{directory:rooftopMemberCoverage.directory,contentHash:rooftopMemberCoverage.report.contentHash,complete:rooftopMemberCoverage.report.internalMemberAuditSatisfied}:null,
  brimhavenMemberCoverage:brimhavenMemberCoverage.report?{directory:brimhavenMemberCoverage.directory,contentHash:brimhavenMemberCoverage.report.contentHash,complete:brimhavenMemberCoverage.report.internalMemberAuditSatisfied}:null
};
report.snapshotRejections=[...sections.rejections,...candidates.rejections,...rooftopMemberCoverage.rejections,...brimhavenMemberCoverage.rejections];
report.contentHash=hash({...report,contentHash:undefined});
const output=path.join(root,'agility-training-guide-section-coverage-audits',report.generatedAt.replace(/[:.]/g,'-'));await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({contract:report.contract,generatedAt:report.generatedAt,sourceRevision:report.sourceRevision,headingCount:report.headingCount,materialSectionCount:report.materialSectionCount,coveredSectionCount:report.coveredSectionCount,uncoveredSectionCount:report.uncoveredSectionCount,internalMemberAuditPendingCount:report.internalMemberAuditPendingCount,uncoveredSections:report.uncoveredSections.map(section=>({sectionKey:section.sectionKey,title:section.title,sourceLocator:section.sourceLocator})),blockers:report.blockers,inputSnapshots:report.inputSnapshots,contentHash:report.contentHash},null,2));
if(report.blockers.length)process.exitCode=2;
