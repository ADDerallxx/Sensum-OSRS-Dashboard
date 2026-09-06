import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

import {hash} from '../ingestion/lib.mjs';
import {acceptedEvidenceDomains, getAcceptedEvidenceAdapter} from './accepted-evidence-materialization-registry-lib.mjs';
import {buildLineageAuditQuery, buildLineageBackfillSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {loadAcceptedInput} from './materialize-accepted-evidence.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

function dockerExecutable() {
  const explicit = argument('docker');
  const installed = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
  if (explicit) return explicit;
  if (fsSync.existsSync(installed)) return installed;
  return 'docker';
}

function livePsql(sql, {container, database, user, expectFailure = false}) {
  const result = spawnSync(dockerExecutable(), ['exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U',user,'-d',database,'-tA'], {input:sql,encoding:'utf8',maxBuffer:256*1024*1024});
  if (!expectFailure && result.status !== 0) throw new Error(`PostgreSQL lineage operation failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result;
}

async function loadModels(root) {
  return Promise.all(acceptedEvidenceDomains().map(async domain => {
    const adapter = getAcceptedEvidenceAdapter(domain);
    const {model,auditFile,snapshotDir} = await loadAcceptedInput({root,adapter});
    return {domain,factKind:adapter.factKind,model,auditFile,snapshotDir};
  }));
}

function parseJson(result) {
  return JSON.parse(result.stdout.trim());
}

export async function runActivityEvidenceIngestionLineageBackfill(options = {}, dependencies = {}) {
  const root = path.resolve(options.root || argument('root') || '.platform-data');
  const container = options.container || argument('container') || 'sensum-v4-postgres';
  const database = options.database || argument('database') || 'sensum_v4';
  const user = options.user || argument('user') || 'sensum_v4';
  const models = dependencies.models || await loadModels(root);
  const psql = dependencies.psql || ((sql, other = {}) => livePsql(sql,{container,database,user,...other}));
  const auditSql = buildLineageAuditQuery(models);
  const before = parseJson(psql(auditSql));
  const evidenceBefore = parseJson(psql(`SELECT json_build_object('count',count(*),'contentHash',md5(string_agg(id::text||'|'||record_key||'|'||fact_kind||'|'||state::text||'|'||raw_locator::text||'|'||parsed_value::text||'|'||source_id::text||'|'||source_revision||'|'||source_timestamp::text||'|'||content_hash,E'\\n' ORDER BY id))) FROM activity_evidence;`));
  psql(buildLineageBackfillSql(models));
  const after = parseJson(psql(auditSql));
  const evidenceAfter = parseJson(psql(`SELECT json_build_object('count',count(*),'contentHash',md5(string_agg(id::text||'|'||record_key||'|'||fact_kind||'|'||state::text||'|'||raw_locator::text||'|'||parsed_value::text||'|'||source_id::text||'|'||source_revision||'|'||source_timestamp::text||'|'||content_hash,E'\\n' ORDER BY id))) FROM activity_evidence;`));
  if (Number(after.lineageRows) !== Number(after.expectedLineageRows) || Number(after.unlinkedStatements) !== 0 || Number(after.mismatchedExpectedLinks) !== 0) throw new Error('lineage_live_reconciliation_failed');
  if (JSON.stringify(evidenceBefore) !== JSON.stringify(evidenceAfter)) throw new Error('activity_evidence_changed_during_lineage_backfill');

  psql(buildLineageBackfillSql(models));
  const repeated = parseJson(psql(auditSql));
  if (JSON.stringify(after) !== JSON.stringify(repeated)) throw new Error('lineage_backfill_not_idempotent');

  const probeId = models[0].model.runId;
  const probe = psql(`BEGIN; INSERT INTO activity_evidence_ingestion_lineage(activity_evidence_id,ingestion_run_id) VALUES ('00000000-0000-0000-0000-000000000000','${probeId}'); COMMIT;`,{expectFailure:true});
  if (probe.status === 0) throw new Error('lineage_foreign_key_probe_did_not_fail');
  const probeCount = Number(psql(`SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE activity_evidence_id='00000000-0000-0000-0000-000000000000';`).stdout.trim());
  if (probeCount !== 0) throw new Error('lineage_foreign_key_probe_left_rows');

  const report = {
    contract:'sensum.activity-evidence-ingestion-lineage-backfill-audit.v1',
    generatedAt:new Date().toISOString(),
    database:{container,database},
    domains:models.map(entry=>({domain:entry.domain,factKind:entry.factKind,runId:entry.model.runId,statements:entry.model.counts.statements,snapshotContentHash:entry.model.snapshotContentHash,auditContentHash:entry.model.auditContentHash})),
    before,after,evidenceBefore,evidenceAfter,
    gates:{allStatementsLinked:true,exactRunBindings:true,activityEvidenceUnchanged:true,idempotentReapplication:true,foreignKeysEnforced:true},
    productionMutations:0,
    optimizerPromotions:0,
    verifiedBestAuthorizations:0
  };
  report.contentHash=hash(report);
  const output=path.join(root,'activity-evidence-ingestion-lineage-backfill-audits',report.generatedAt.replace(/[:.]/g,'-'));
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  return {...report,reportDirectory:path.relative(process.cwd(),output)};
}

if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1)))) {
  console.log(JSON.stringify(await runActivityEvidenceIngestionLineageBackfill(),null,2));
}
