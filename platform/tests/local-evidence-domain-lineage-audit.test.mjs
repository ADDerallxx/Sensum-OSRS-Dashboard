import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {auditLocalEvidenceDomainLineage} from '../db/audit-local-evidence-domain-lineage.mjs';

const contract=JSON.parse(fs.readFileSync('platform/contracts/local-evidence-domain-lineage-audit-v2.json','utf8'));

function fixtures() {
  const counts={skills:24,sources:84,wikiSources:84,revisionPinnedWikiSources:84,wikiSourcesMissingRevision:0,snapshots:3,completeSnapshots:0,ingestionRuns:3,ingestionRecords:26,evidenceStatements:4770,evidenceStatementLineageRows:4770,unlinkedEvidenceStatements:0,optimizerEligibleStatements:0,openValidationFindings:0,explicitBlockerOccurrences:4960};
  const summary={contract:'sensum.local-evidence-catalog.v3',view:'summary',counts,evidenceStates:{candidate:4770}};
  const domain=row=>({domain:row,runId:`run-${row}`,status:'published',snapshotContentHash:'a'.repeat(64),snapshotId:`snapshot-${row}`,snapshotComplete:false,sourceCount:1,recordCount:1,declaredStatementCount:1,directStatementCount:1,statementLineageState:'direct_activity_evidence_ingestion_run_foreign_key',optimizerEligibleCount:0,automaticVerification:false,completeActivityUniverse:false,recordCountReconciles:true,sourceCountReconciles:true,statementCountReconciles:true});
  const lineage=domainName=>({sourceKey:'wiki-pageid:240934',title:'Wise Old Man tasks',url:'https://oldschool.runescape.wiki/w/Wise_Old_Man_tasks',revision:'14997080',sourceTimestamp:'2025-09-30T14:52:55Z',fetchedAt:'2026-09-05T03:48:20Z',sourceContentHash:'b'.repeat(64),sourceState:'review',snapshotId:`snapshot-${domainName}`,snapshotComplete:false,domain:domainName,runId:`run-${domainName}`,runStatus:'published',snapshotLinkCount:2,directStatementCount:1});
  return {summary,domains:{contract:'sensum.local-evidence-catalog.v3',view:'domains',rows:[domain('one'),domain('two'),domain('three')]},lineage:{contract:'sensum.local-evidence-catalog.v3',view:'lineage',rows:[lineage('one'),lineage('two')]}};
}

function mockQuery(data) {
  return options=>options.view==='summary'?structuredClone(data.summary):structuredClone(data[options.view]);
}

test('lineage audit contract preserves read-only, direct-lineage, and source-reuse gates',()=>{
  assert.equal(contract.contract,'sensum.local-evidence-domain-lineage-audit.v2');
  assert.equal(contract.rules.allCatalogQueriesMustUseReadOnlyTransactions,true);
  assert.equal(contract.rules.directStatementRunLineageMustReconcile,true);
  assert.equal(contract.rules.optimizerPromotionAllowed,false);
  assert.equal(contract.rules.productionMutationAllowed,false);
});

test('audit proves shared exact source lineage and stable catalog counts',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sensum-lineage-audit-'));
  try {
    const report=await auditLocalEvidenceDomainLineage({root},{query:mockQuery(fixtures())});
    assert.equal(report.domains.count,3);
    assert.equal(report.sharedSource.snapshotLinks,2);
    assert.equal(report.sharedSource.expectedLinksMode,'detected');
    assert.deepEqual(report.sharedSource.domains,['one','two']);
    assert.equal(report.statementRunLineage.complete,true);
    assert.equal(report.statementRunLineage.blocker,null);
    assert.equal(report.statementRunLineage.directStatements,3);
    assert.equal(report.catalogCountsStableAcrossAudit,true);
    assert.equal(report.databaseMutations,0);
    const stored=JSON.parse(fs.readFileSync(path.join(process.cwd(),report.reportDirectory,'report.json'),'utf8'));
    assert.equal(stored.contentHash,hash(Object.fromEntries(Object.entries(stored).filter(([key])=>key!=='contentHash'))));
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
});

test('audit fails closed on missing lineage, source drift, count drift, or direct statement mismatch',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sensum-lineage-audit-negative-'));
  try {
    const missing=fixtures(); missing.lineage.rows.pop();
    await assert.rejects(auditLocalEvidenceDomainLineage({root,expectedLinks:2},{query:mockQuery(missing)}),/lineage_count_mismatch/);
    const drift=fixtures(); drift.lineage.rows[1].sourceContentHash='c'.repeat(64);
    await assert.rejects(auditLocalEvidenceDomainLineage({root},{query:mockQuery(drift)}),/source_identity_drift/);
    const hidden=fixtures(); hidden.domains.rows[0].directStatementCount=0; hidden.domains.rows[0].statementCountReconciles=false;
    await assert.rejects(auditLocalEvidenceDomainLineage({root},{query:mockQuery(hidden)}),/statement_run_lineage_does_not_reconcile/);
    const calls=[]; const countDrift=fixtures(); const query=options=>{calls.push(options.view); const value=options.view==='summary'?structuredClone(countDrift.summary):structuredClone(countDrift[options.view]); if(options.view==='summary'&&calls.filter(view=>view==='summary').length===2)value.counts.sources=85; return value;};
    await assert.rejects(auditLocalEvidenceDomainLineage({root},{query}),/changed_database_counts/);
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
});
