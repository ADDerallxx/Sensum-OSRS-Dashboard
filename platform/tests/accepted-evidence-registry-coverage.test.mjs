import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  ACCEPTED_EVIDENCE_REGISTRY_COVERAGE_CONTRACT,
  auditAcceptedEvidenceRegistryCoverage,
  inspectOutputDataset
} from '../db/audit-accepted-evidence-registry-coverage.mjs';

const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));

function writeDataset(root,domain,{accountBound=false,promoted=false,tamper=false}={}) {
  const snapshot='2026-09-06T20-00-00-000Z';
  const record={
    contract:`sensum.${domain}.v1`,accountIndependent:true,candidateKey:`${domain}:1`,skillKeys:['agility','mining'],
    sourcePageId:42,resolvedTitle:'Example activity',sourceRevision:'123',sourceTimestamp:'2026-09-01T00:00:00Z',
    sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:'a'.repeat(64),optimizerEligible:promoted
  };
  if(accountBound) record.currentBaseLevel=34;
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n';
  const snapshotDir=path.join(root,snapshot);
  fs.mkdirSync(snapshotDir,{recursive:true});
  fs.writeFileSync(path.join(snapshotDir,`${domain}.ndjson`),raw);
  const manifest={contract:'sensum.ingestion-manifest.v1',domain,createdAt:'2026-09-06T20:00:00Z',records:1,contentHash:tamper?'f'.repeat(64):hash(raw),source:{kind:'revision_pinned_fixture'}};
  fs.writeFileSync(path.join(snapshotDir,'manifest.json'),JSON.stringify(manifest));
  const audit={contract:`sensum.${domain}-audit.v1`,accountIndependent:true,outputSnapshot:{directory:snapshot,contentHash:manifest.contentHash},publishable:true};
  audit.contentHash=hash(audit);
  const auditDir=path.join(root,`${domain}-audits`,'2026-09-06T20-00-01-000Z');
  fs.mkdirSync(auditDir,{recursive:true});
  fs.writeFileSync(path.join(auditDir,'report.json'),JSON.stringify(audit));
}

test('dataset inspection proves hashes, direct source identity, and semantic safety',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sensum-registry-dataset-'));
  try {
    writeDataset(root,'alpha-evidence');
    const result=await inspectOutputDataset(root,'alpha-evidence-audits');
    assert.equal(result.status,'adapter_ready');
    assert.equal(result.records,1);
    assert.equal(result.directRevisionPinnedSources,1);
    assert.equal(result.skillCoverage,2);
    assert.deepEqual(result.skillKeys,['agility','mining']);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('tampered, account-bound, and promoted datasets fail closed',async()=>{
  for (const [suffix,options,blocker] of [
    ['tampered',{tamper:true},'snapshot_content_hash_mismatch'],
    ['account',{accountBound:true},'account_state_present'],
    ['promoted',{promoted:true},'unsafe_automatic_promotion_present']
  ]) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),`sensum-registry-${suffix}-`));
    try {
      writeDataset(root,`${suffix}-evidence`,options);
      const result=await inspectOutputDataset(root,`${suffix}-evidence-audits`);
      assert.equal(result.status,'blocked');
      assert.ok(result.blockers.includes(blocker));
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  }
});

test('coverage excludes its own reports and selects the broadest safe unregistered domain',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sensum-registry-coverage-'));
  try {
    for (const name of ['wide-evidence-audits','narrow-evidence-audits','blocked-evidence-audits','accepted-evidence-registry-coverage-audits']) fs.mkdirSync(path.join(root,name),{recursive:true});
    const datasets={
      'wide-evidence-audits':{domain:'wide-evidence',status:'adapter_ready',records:5,directRevisionPinnedSources:5,skillCoverage:4,skillKeys:['a','b','c','d'],snapshotContentHash:'a'.repeat(64),auditContract:'sensum.wide-evidence-audit.v1'},
      'narrow-evidence-audits':{domain:'narrow-evidence',status:'adapter_ready',records:50,directRevisionPinnedSources:50,skillCoverage:2,skillKeys:['a','b'],snapshotContentHash:'b'.repeat(64),auditContract:'sensum.narrow-evidence-audit.v1'},
      'blocked-evidence-audits':{domain:'blocked-evidence',status:'blocked',records:100,skillCoverage:24,blockers:['fixture_blocker']}
    };
    const adapter={domain:'registered-evidence',factKind:'raw_registered',auditDirectory:'unused',dataFile:'unused.ndjson'};
    const report=await auditAcceptedEvidenceRegistryCoverage({root},{
      domains:()=>['registered-evidence'],getAdapter:()=>adapter,
      loadInput:async()=>({model:{runId:'11111111-1111-1111-1111-111111111111',snapshotContentHash:'c'.repeat(64),counts:{sources:1,records:1,statements:1},records:[]}}),
      inspectDataset:async(_root,name)=>datasets[name]
    });
    assert.equal(report.contract,ACCEPTED_EVIDENCE_REGISTRY_COVERAGE_CONTRACT);
    assert.deepEqual(report.coverage,{detectedEvidenceDatasets:4,registeredEvidenceDatasets:1,unregisteredEvidenceDatasets:3,adapterReadyEvidenceDatasets:2,blockedEvidenceDatasets:1,registryCoverageRatio:0.25});
    assert.equal(report.selectedNextDomain.domain,'wide-evidence');
    assert.ok(!report.datasets.some(row=>row.domain==='accepted-evidence-registry-coverage'));
    const stored=JSON.parse(fs.readFileSync(path.join(process.cwd(),report.reportDirectory,'report.json'),'utf8'));
    assert.equal(stored.contentHash,hash(without(stored,'contentHash')));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('coverage contract retains strict admission and forbidden-promotion rules',()=>{
  const contract=JSON.parse(fs.readFileSync('platform/contracts/accepted-evidence-registry-coverage-audit-v1.json','utf8'));
  assert.equal(contract.datasetDefinition.auditAndEveryRecordMustBeAccountIndependent,true);
  assert.equal(contract.datasetDefinition.coverageAuditorOutputDirectoryExcluded,true);
  assert.equal(contract.datasetDefinition.automaticPromotionAllowed,false);
  assert.ok(contract.adapterAdmissionRequires.includes('direct ingestion-run lineage'));
  assert.deepEqual(contract.selectionOrder,['skillCoverage_desc','records_desc','directRevisionPinnedSources_desc','domain_asc']);
});
