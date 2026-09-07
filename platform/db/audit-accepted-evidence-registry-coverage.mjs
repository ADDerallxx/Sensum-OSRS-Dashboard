import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {hash} from '../ingestion/lib.mjs';
import {acceptedEvidenceDomains, getAcceptedEvidenceAdapter} from './accepted-evidence-materialization-registry-lib.mjs';
import {
  ACCOUNT_INDEPENDENCE_CLASSIFICATION_CONTRACT,
  classifyAcceptedEvidenceAccountIndependence
} from './account-independence-classification-lib.mjs';
import {loadAcceptedInput} from './materialize-accepted-evidence.mjs';

export const ACCEPTED_EVIDENCE_REGISTRY_COVERAGE_CONTRACT = 'sensum.accepted-evidence-registry-coverage-audit.v1';

const argument=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
function containsUnsafePromotion(value) {
  if (Array.isArray(value)) return value.some(containsUnsafePromotion);
  if (!value || typeof value!=='object') return false;
  return Object.entries(value).some(([key,child])=>((key==='optimizerEligible'||key==='automaticVerificationApplied')&&child===true)||containsUnsafePromotion(child));
}

function unique(values) { return [...new Set(values)]; }

async function latestReport(auditDirectory) {
  const entries=(await fs.readdir(auditDirectory,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort().reverse();
  if (!entries.length) throw new Error('audit_directory_has_no_runs');
  const file=path.join(auditDirectory,entries[0],'report.json');
  return {file,report:JSON.parse(await fs.readFile(file,'utf8'))};
}

export async function inspectOutputDataset(root,auditDirectoryName) {
  const blockers=[];
  try {
    const {file,report}=await latestReport(path.join(root,auditDirectoryName));
    const domain=auditDirectoryName.replace(/-audits$/,'');
    if (report.contract!==`sensum.${domain}-audit.v1` && !report.contract?.startsWith(`sensum.${domain}-audit.v`)) blockers.push('audit_contract_domain_mismatch');
    if (report.contentHash!==hash(without(report,'contentHash'))) blockers.push('audit_content_hash_mismatch');
    if (report.publishable!==true) blockers.push('audit_not_publishable');
    if (!report.outputSnapshot?.directory || !report.outputSnapshot?.contentHash) blockers.push('audit_output_snapshot_missing');
    if (blockers.length) return {domain,auditDirectory:auditDirectoryName,auditFile:path.relative(process.cwd(),file),status:'blocked',blockers};
    const snapshotDir=path.join(root,report.outputSnapshot.directory);
    const manifest=JSON.parse(await fs.readFile(path.join(snapshotDir,'manifest.json'),'utf8'));
    const dataFile=path.join(snapshotDir,`${manifest.domain}.ndjson`);
    const raw=await fs.readFile(dataFile,'utf8');
    let records=[];
    try { records=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse); } catch { blockers.push('snapshot_ndjson_invalid'); }
    if (manifest.contract!=='sensum.ingestion-manifest.v1') blockers.push('manifest_contract_mismatch');
    if (manifest.domain!==domain) blockers.push('manifest_domain_mismatch');
    if (manifest.contentHash!==hash(raw)||report.outputSnapshot.contentHash!==manifest.contentHash) blockers.push('snapshot_content_hash_mismatch');
    if (manifest.records!==records.length) blockers.push('snapshot_record_count_mismatch');
    if (records.some(record=>record.contentHash!==hash(without(record,'contentHash')))) blockers.push('record_content_hash_mismatch');
    const accountIndependence=classifyAcceptedEvidenceAccountIndependence({audit:report,manifest,records});
    blockers.push(...accountIndependence.blockers);
    if (containsUnsafePromotion(records)||containsUnsafePromotion(report)) blockers.push('unsafe_automatic_promotion_present');
    const directSources=records.filter(record=>Number.isInteger(Number(record.sourcePageId))&&record.sourceUrl&&record.sourceRevision&&Number.isFinite(Date.parse(record.sourceTimestamp))&&/^[a-f0-9]{64}$/.test(String(record.sourceContentHash||'')));
    if (directSources.length!==records.length) blockers.push('one_or_more_records_lack_direct_revision_pinned_source_identity');
    const skillKeys=unique(records.flatMap(record=>[...(Array.isArray(record.skillKeys)?record.skillKeys:[]),record.skillKey].filter(Boolean))).sort();
    const sourceIdentities=unique(directSources.map(record=>`${record.sourcePageId}|${record.sourceRevision}|${record.sourceContentHash}`));
    return {
      domain,auditDirectory:auditDirectoryName,auditFile:path.relative(process.cwd(),file),auditContract:report.contract,
      snapshotDirectory:report.outputSnapshot.directory,snapshotContentHash:manifest.contentHash,sourceKind:manifest.source?.kind||null,
      records:records.length,directRevisionPinnedSources:sourceIdentities.length,skillKeys,skillCoverage:skillKeys.length,
      accountIndependence,
      integrityValid:!blockers.some(blocker=>blocker!=='one_or_more_records_lack_direct_revision_pinned_source_identity'),
      directSourceIdentityReady:directSources.length===records.length,
      semanticGateSafe:accountIndependence.proven&&!blockers.includes('unsafe_automatic_promotion_present'),
      status:blockers.length?'blocked':'adapter_ready',blockers
    };
  } catch (error) {
    return {domain:auditDirectoryName.replace(/-audits$/,''),auditDirectory:auditDirectoryName,status:'blocked',blockers:[`dataset_inspection_failed:${String(error.message).replace(/[\r\n]+/g,' ').slice(0,500)}`]};
  }
}

export async function auditAcceptedEvidenceRegistryCoverage(options={},dependencies={}) {
  const root=path.resolve(options.root||argument('root')||'.platform-data');
  const registryDomains=(dependencies.domains||acceptedEvidenceDomains)().slice().sort();
  const adapterFor=dependencies.getAdapter||getAcceptedEvidenceAdapter;
  const load=dependencies.loadInput||loadAcceptedInput;
  const inspect=dependencies.inspectDataset||inspectOutputDataset;
  const ownAuditDirectory='accepted-evidence-registry-coverage-audits';
  const names=(await fs.readdir(root,{withFileTypes:true}))
    .filter(entry=>entry.isDirectory()&&entry.name.endsWith('-evidence-audits')&&entry.name!==ownAuditDirectory)
    .map(entry=>entry.name).sort();
  const outputDatasets=await Promise.all(names.map(name=>inspect(root,name)));
  const byDomain=new Map(outputDatasets.map(dataset=>[dataset.domain,dataset]));
  const registered=[];
  for (const domain of registryDomains) {
    const adapter=adapterFor(domain);
    const loaded=await load({root,adapter});
    const existing=byDomain.get(domain);
    registered.push({
      domain,factKind:adapter.factKind,runId:loaded.model.runId,snapshotContentHash:loaded.model.snapshotContentHash,
      records:loaded.model.counts.records,statements:loaded.model.counts.statements,sources:loaded.model.counts.sources,
      status:'registered',datasetAuditStatus:existing?.status||'registry_validated_non_output_snapshot_input'
    });
    if (!existing) byDomain.set(domain,{domain,records:loaded.model.counts.records,skillKeys:domain==='skill-level-unlock-inventory'?loaded.model.records.map(record=>record.skillKey).sort():[],skillCoverage:domain==='skill-level-unlock-inventory'?loaded.model.records.length:0,status:'registered_only'});
  }
  const datasets=[...byDomain.values()].sort((a,b)=>a.domain.localeCompare(b.domain));
  for (const dataset of datasets) if (registryDomains.includes(dataset.domain)) dataset.status='registered';
  const unregistered=datasets.filter(dataset=>!registryDomains.includes(dataset.domain));
  const adapterReady=unregistered.filter(dataset=>dataset.status==='adapter_ready').sort((a,b)=>b.skillCoverage-a.skillCoverage||b.records-a.records||b.directRevisionPinnedSources-a.directRevisionPinnedSources||a.domain.localeCompare(b.domain));
  const blocked=unregistered.filter(dataset=>dataset.status!=='adapter_ready');
  const selected=adapterReady[0]||null;
  const report={
    contract:ACCEPTED_EVIDENCE_REGISTRY_COVERAGE_CONTRACT,generatedAt:new Date().toISOString(),registryDomains,registered,
    coverage:{detectedEvidenceDatasets:datasets.length,registeredEvidenceDatasets:registered.length,unregisteredEvidenceDatasets:unregistered.length,adapterReadyEvidenceDatasets:adapterReady.length,blockedEvidenceDatasets:blocked.length,registryCoverageRatio:datasets.length?registered.length/datasets.length:0},
    datasets,selectionPolicy:{order:['skillCoverage_desc','records_desc','directRevisionPinnedSources_desc','domain_asc'],accountStateForbidden:true,accountIndependenceClassificationContract:ACCOUNT_INDEPENDENCE_CLASSIFICATION_CONTRACT,automaticPromotionForbidden:true,directRevisionPinnedSourceIdentityRequired:true},
    selectedNextDomain:selected?{domain:selected.domain,records:selected.records,skillCoverage:selected.skillCoverage,skillKeys:selected.skillKeys,directRevisionPinnedSources:selected.directRevisionPinnedSources,snapshotContentHash:selected.snapshotContentHash,auditContract:selected.auditContract}:null,
    blockers:selected?[]:['no_unregistered_adapter_ready_evidence_dataset'],databaseMutations:0,optimizerPromotions:0,verifiedBestAuthorizations:0,productionMutations:0,publishable:true
  };
  report.contentHash=hash(report);
  const output=path.join(root,'accepted-evidence-registry-coverage-audits',report.generatedAt.replace(/[:.]/g,'-'));
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  return {...report,reportDirectory:path.relative(process.cwd(),output)};
}

if(path.resolve(process.argv[1]||'')===path.resolve(fileURLToPath(import.meta.url))) console.log(JSON.stringify(await auditAcceptedEvidenceRegistryCoverage(),null,2));
