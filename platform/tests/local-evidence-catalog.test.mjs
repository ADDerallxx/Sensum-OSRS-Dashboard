import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  LOCAL_EVIDENCE_CATALOG_CONTRACT,
  assessCatalogSummary,
  assertReadOnlyCatalogSql,
  buildCatalogSql,
  formatCatalogText,
  normalizeCatalogOptions
} from '../db/local-evidence-catalog-lib.mjs';

const contract = JSON.parse(fs.readFileSync('platform/contracts/local-evidence-catalog-health-audit-v1.json','utf8'));

function summary(overrides = {}) {
  return {
    contract:LOCAL_EVIDENCE_CATALOG_CONTRACT,
    view:'summary',
    counts:{skills:24,sources:24,wikiSources:24,revisionPinnedWikiSources:24,wikiSourcesMissingRevision:0,snapshots:1,completeSnapshots:0,ingestionRuns:1,ingestionRecords:24,evidenceStatements:4768,optimizerEligibleStatements:0,openValidationFindings:0,explicitBlockerOccurrences:4792},
    evidenceStates:{candidate:4768},
    latestIngestion:{metrics:{completeActivityUniverse:false}},
    topBlockers:[{blocker:'semantic_identity_and_repeatability_not_classified',occurrences:4768}],
    ...overrides
  };
}

test('every catalog view is constrained to a read-only transaction',()=>{
  assert.deepEqual(contract.requiredViews,['summary','skills','sources','blockers']);
  for (const view of contract.requiredViews) assert.equal(assertReadOnlyCatalogSql(buildCatalogSql({view})),true);
});

test('catalog options reject injection, unknown views, and unbounded output',()=>{
  assert.throws(()=>normalizeCatalogOptions({view:'tables'}),/unsupported_catalog_view/);
  assert.throws(()=>normalizeCatalogOptions({view:'skills',skill:"agility'; DROP TABLE skills;--"}),/skill_filter_invalid/);
  assert.throws(()=>normalizeCatalogOptions({view:'skills',limit:501}),/limit_must_be_between/);
  assert.throws(()=>normalizeCatalogOptions({view:'summary',skill:'agility'}),/skill_filter_not_supported/);
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

test('human summary separates runtime, integrity, and knowledge readiness',()=>{
  const output=formatCatalogText(summary());
  assert.match(output,/Runtime: healthy/);
  assert.match(output,/Catalog integrity: healthy/);
  assert.match(output,/Knowledge readiness: blocked/);
  assert.match(output,/24\/24 revision-pinned Wiki sources/);
  assert.match(output,/BLOCKED: complete_activity_universe_not_proven/);
});

test('CLI accepts only generated catalog SQL and contains no credential access',()=>{
  const source=fs.readFileSync('platform/db/query-local-evidence-catalog.mjs','utf8');
  assert.match(source,/buildCatalogSql/);
  assert.doesNotMatch(source,/SENSUM_V4_DB_PASSWORD|process\.env|--command|--sql/);
});
