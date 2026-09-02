import fs from 'node:fs';
const sql=fs.readFileSync('platform/db/migrations/0001_canonical_osrs.sql','utf8');
const optimizer=JSON.parse(fs.readFileSync('platform/contracts/optimizer-v1.json','utf8'));
const result=JSON.parse(fs.readFileSync('platform/contracts/calculation-result-v1.json','utf8'));
const control=fs.readFileSync('platform/db/migrations/0002_ingestion_control.sql','utf8');
const failures=[];const check=(ok,msg)=>{if(!ok)failures.push(msg)};
for(const table of ['data_sources','data_snapshots','items','equipment','effects','npcs','npc_combat_stats','locations','recipes','price_observations','profiles','account_snapshots','training_methods','optimization_runs','optimization_evidence','validation_findings'])check(new RegExp(`CREATE TABLE ${table} \\(`).test(sql),`Missing canonical table: ${table}`);
check(/content_hash text NOT NULL/.test(sql),'Sources must be content-addressed.');
check(/formula_version text NOT NULL/.test(sql),'Calculations must retain formula versions.');
check(/unknown_count bigint/.test(sql),'Runs must expose unknown candidate coverage.');
check(optimizer.claimPolicy.absoluteBestRequiresCompleteCandidateCoverage===true,'Absolute-best requires complete coverage.');
check(optimizer.claimPolicy.aiGeneratedFactsAllowed===false,'AI facts must not be authoritative.');
check(result.explanation.authoritative===false,'AI explanations must be non-authoritative.');
for(const table of ['ingestion_runs','ingestion_records','publication_gates'])check(new RegExp(`CREATE TABLE ${table} \\(`).test(control),`Missing ingestion-control table: ${table}`);
check(/maximum_unknown_ratio/.test(control)&&/require_source_revision/.test(control),'Publication gates must enforce completeness and provenance.');
for(const file of ['platform/ingestion/lib.mjs','platform/ingestion/ingest-ge.mjs','platform/ingestion/ingest-wiki-domain.mjs','platform/ingestion/audit-local-catalogs.mjs'])check(fs.existsSync(file),`Missing ingestion component: ${file}`);
if(failures.length){console.error(failures.map(x=>'FAIL: '+x).join('\n'));process.exit(1)}
console.log('V4 foundation checks passed: canonical schema, provenance, coverage, and calculation contracts.');
