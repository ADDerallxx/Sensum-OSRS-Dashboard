import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  LOCAL_EVIDENCE_CATALOG_CONTRACT,
  assessCatalogSummary,
  assertCatalogPayload,
  assertReadOnlyCatalogSql,
  buildCatalogSql,
  formatCatalogText,
  normalizeCatalogOptions
} from '../db/local-evidence-catalog-lib.mjs';

const contract = JSON.parse(fs.readFileSync('platform/contracts/local-evidence-catalog-health-audit-v3.json','utf8'));

function summary(overrides = {}) {
  return {
    contract:LOCAL_EVIDENCE_CATALOG_CONTRACT,
    view:'summary',
    counts:{skills:24,sources:24,wikiSources:24,revisionPinnedWikiSources:24,wikiSourcesMissingRevision:0,snapshots:1,completeSnapshots:0,ingestionRuns:1,ingestionRecords:24,evidenceStatements:4768,evidenceStatementLineageRows:4768,unlinkedEvidenceStatements:0,optimizerEligibleStatements:0,openValidationFindings:0,explicitBlockerOccurrences:4792},
    evidenceStates:{candidate:4768},
    latestIngestion:{metrics:{completeActivityUniverse:false}},
    topBlockers:[{blocker:'semantic_identity_and_repeatability_not_classified',occurrences:4768}],
    ...overrides
  };
}

test('every catalog view is constrained to a read-only transaction',()=>{
  assert.deepEqual(contract.requiredViews,['summary','skills','sources','blockers','domains','lineage']);
  for (const view of contract.requiredViews) assert.equal(assertReadOnlyCatalogSql(buildCatalogSql({view})),true);
});

test('catalog options reject injection, unknown views, and unbounded output',()=>{
  assert.throws(()=>normalizeCatalogOptions({view:'tables'}),/unsupported_catalog_view/);
  assert.throws(()=>normalizeCatalogOptions({view:'skills',skill:"agility'; DROP TABLE skills;--"}),/skill_filter_invalid/);
  assert.throws(()=>normalizeCatalogOptions({view:'skills',limit:501}),/limit_must_be_between/);
  assert.throws(()=>normalizeCatalogOptions({view:'summary',skill:'agility'}),/skill_filter_not_supported/);
  assert.throws(()=>normalizeCatalogOptions({view:'domains',domain:"items'; DROP TABLE items;--"}),/domain_filter_invalid/);
  assert.throws(()=>normalizeCatalogOptions({view:'lineage',source:'wiki page 1'}),/source_filter_invalid/);
  assert.throws(()=>normalizeCatalogOptions({view:'lineage',revision:'1 OR 1=1'}),/revision_filter_invalid/);
  assert.throws(()=>normalizeCatalogOptions({view:'summary',domain:'items'}),/domain_filter_not_supported/);
  assert.throws(()=>normalizeCatalogOptions({view:'domains',source:'wiki-pageid:1'}),/source_filter_not_supported/);
  assert.deepEqual(normalizeCatalogOptions({view:'lineage',domain:'weighted-parent-task-entry-membership-evidence',source:'wiki-pageid:240934',revision:'14997080',limit:10}),{view:'lineage',skill:null,domain:'weighted-parent-task-entry-membership-evidence',source:'wiki-pageid:240934',revision:'14997080',limit:10});
});

test('domain and lineage queries expose reconciled relationships without mutation',()=>{
  const domains=buildCatalogSql({view:'domains',domain:'skill-level-unlock-inventory'}),lineage=buildCatalogSql({view:'lineage',source:'wiki-pageid:240934',revision:'14997080'});
  assert.match(domains,/recordCountReconciles/);
  assert.match(domains,/sourceCountReconciles/);
  assert.match(domains,/statementCountReconciles/);
  assert.match(lineage,/snapshotLinkCount/);
  assert.match(lineage,/snapshot_sources/);
  assert.match(lineage,/ingestion_runs/);
  assert.equal(assertReadOnlyCatalogSql(domains),true);
  assert.equal(assertReadOnlyCatalogSql(lineage),true);
});

test('domain and lineage payloads fail closed on broken identity or reconciliation',()=>{
  const domainPayload={contract:LOCAL_EVIDENCE_CATALOG_CONTRACT,view:'domains',rows:[{domain:'skill-level-unlock-inventory',snapshotComplete:false,recordCount:24,sourceCount:24,declaredStatementCount:4768,directStatementCount:4768,statementLineageState:'direct_activity_evidence_ingestion_run_foreign_key',recordCountReconciles:true,sourceCountReconciles:true,statementCountReconciles:true}]};
  const lineagePayload={contract:LOCAL_EVIDENCE_CATALOG_CONTRACT,view:'lineage',rows:[{sourceKey:'wiki-pageid:240934',url:'https://oldschool.runescape.wiki/w/Wise_Old_Man_tasks',revision:'14997080',sourceContentHash:'a'.repeat(64),domain:'activity-canonical-subject-scope-evidence',snapshotId:'snapshot',runId:'run',snapshotLinkCount:2,directStatementCount:1}]};
  assert.equal(assertCatalogPayload(domainPayload,'domains'),true);
  assert.equal(assertCatalogPayload(lineagePayload,'lineage'),true);
  assert.throws(()=>assertCatalogPayload({...domainPayload,rows:[{...domainPayload.rows[0],sourceCountReconciles:false}]},'domains'),/counts_do_not_reconcile/);
  assert.throws(()=>assertCatalogPayload({...domainPayload,rows:[{...domainPayload.rows[0],directStatementCount:4767,statementCountReconciles:false}]},'domains'),/counts_do_not_reconcile/);
  assert.throws(()=>assertCatalogPayload({...domainPayload,rows:[{...domainPayload.rows[0],statementLineageState:'proven'}]},'domains'),/statement_lineage_invalid/);
  assert.throws(()=>assertCatalogPayload({...lineagePayload,rows:[{...lineagePayload.rows[0],sourceContentHash:'bad'}]},'lineage'),/revision_identity_invalid/);
  assert.throws(()=>assertCatalogPayload(lineagePayload,'domains'),/view_mismatch/);
});

test('incomplete evidence is visible as blocked without mislabeling runtime health',()=>{
  const health=assessCatalogSummary(summary());
  assert.equal(health.runtimeStatus,'healthy');
  assert.equal(health.catalogIntegrity,'healthy');
  assert.equal(health.knowledgeReadiness,'blocked');
  assert.equal(health.optimizerReady,false);
  assert.ok(health.knowledgeBlockers.some(row=>row.blocker==='complete_activity_universe_not_proven'));
});

test('integrity drift becomes an error and cannot look optimizer-ready',()=>{
  const input=summary();
  input.counts.revisionPinnedWikiSources=23;
  input.counts.wikiSourcesMissingRevision=1;
  input.counts.optimizerEligibleStatements=1;
  const health=assessCatalogSummary(input);
  assert.equal(health.catalogIntegrity,'error');
  assert.deepEqual(health.integrityBlockers,['wiki_source_revision_missing','unverified_statement_optimizer_eligible']);
  assert.equal(health.optimizerReady,false);
});

test('missing statement lineage becomes a catalog integrity error',()=>{
  const input=summary(); input.counts.evidenceStatementLineageRows=4767; input.counts.unlinkedEvidenceStatements=1;
  assert.ok(assessCatalogSummary(input).integrityBlockers.includes('evidence_statement_lineage_incomplete'));
});

test('human summary separates runtime, integrity, and knowledge readiness',()=>{
  const output=formatCatalogText(summary());
  assert.match(output,/Runtime: healthy/);
  assert.match(output,/Catalog integrity: healthy/);
  assert.match(output,/Knowledge readiness: blocked/);
  assert.match(output,/24\/24 revision-pinned Wiki sources/);
  assert.match(output,/BLOCKED: complete_activity_universe_not_proven/);
});

test('human domain and lineage output is concise and relationship-oriented',()=>{
  const domains=formatCatalogText({view:'domains',rows:[{domain:'example',recordCount:1,sourceCount:2,declaredStatementCount:3,directStatementCount:3,statementLineageState:'direct_activity_evidence_ingestion_run_foreign_key',snapshotComplete:false,optimizerEligibleCount:0}]});
  const lineage=formatCatalogText({view:'lineage',rows:[{sourceKey:'wiki-pageid:240934',revision:'14997080',domain:'example',snapshotId:'snapshot',snapshotLinkCount:2}]});
  assert.match(domains,/example \| 1 records \| 2 sources \| 3\/3 directly linked statements/);
  assert.match(lineage,/2 linked snapshots/);
});

test('CLI accepts only generated catalog SQL and contains no credential access',()=>{
  const source=fs.readFileSync('platform/db/query-local-evidence-catalog.mjs','utf8');
  assert.match(source,/buildCatalogSql/);
  assert.match(source,/argument\('domain'\)/);
  assert.match(source,/argument\('source'\)/);
  assert.match(source,/argument\('revision'\)/);
  assert.match(source,/assertCatalogPayload/);
  assert.doesNotMatch(source,/SENSUM_V4_DB_PASSWORD|process\.env|--command|--sql/);
});
