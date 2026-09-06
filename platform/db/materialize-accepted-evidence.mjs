import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

import {hash} from '../ingestion/lib.mjs';
import {getAcceptedEvidenceAdapter} from './accepted-evidence-materialization-registry-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

function dockerExecutable() {
  const explicit = argument('docker');
  const installed = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
  if (explicit) return explicit;
  if (fsSync.existsSync(installed)) return installed;
  return 'docker';
}

function runPsql(sql, {expectFailure = false, container, database, user} = {}) {
  const result = spawnSync(dockerExecutable(), ['exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database, '-tA'], {input: sql, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024});
  if (!expectFailure && result.status !== 0) throw new Error(`PostgreSQL materialization failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result;
}

async function loadAcceptedInput({root, adapter, explicitSnapshot, explicitAudit}) {
  const auditFiles = explicitAudit ? [path.resolve(explicitAudit)] : (await fs.readdir(path.join(root, adapter.auditDirectory), {withFileTypes:true}))
    .filter(entry => entry.isDirectory()).map(entry => path.join(root, adapter.auditDirectory, entry.name, 'report.json')).sort().reverse();
  const rejections = [];
  for (const auditFile of auditFiles) {
    try {
      const audit = JSON.parse(await fs.readFile(auditFile, 'utf8'));
      if (audit.contract !== adapter.auditContract) throw new Error('audit_contract_mismatch');
      const snapshotDirectory = explicitSnapshot ? path.basename(path.resolve(explicitSnapshot)) : adapter.snapshotDirectory(audit);
      if (!snapshotDirectory) throw new Error('audit_missing_snapshot_directory');
      const snapshotDir = explicitSnapshot ? path.resolve(explicitSnapshot) : path.join(root, snapshotDirectory);
      const raw = await fs.readFile(path.join(snapshotDir, adapter.dataFile), 'utf8');
      const manifest = JSON.parse(await fs.readFile(path.join(snapshotDir, 'manifest.json'), 'utf8'));
      manifest.snapshotDirectory = snapshotDirectory;
      return {model:adapter.validate({raw, manifest, audit}), auditFile, snapshotDir};
    } catch (error) {
      rejections.push({auditFile, message:error.message});
    }
  }
  throw new Error(`No accepted ${adapter.domain} snapshot could be materialized: ${JSON.stringify(rejections)}`);
}

export async function runAcceptedEvidenceMaterialization(options = {}) {
  const domain = options.domain || argument('domain');
  if (!domain) throw new Error('accepted_evidence_domain_required');
  const adapter = getAcceptedEvidenceAdapter(domain);
  const root = path.resolve(options.root || argument('root') || '.platform-data');
  const container = options.container || argument('container') || 'sensum-v4-postgres';
  const database = options.database || argument('database') || 'sensum_v4';
  const user = options.user || argument('user') || 'sensum_v4';
  const explicitSnapshot = options.snapshotDir || argument('snapshot-dir');
  const explicitAudit = options.audit || argument('audit');
  const psql = (sql, other = {}) => runPsql(sql, {...other, container, database, user});
  const {model, auditFile, snapshotDir} = await loadAcceptedInput({root, adapter, explicitSnapshot, explicitAudit});
  const before = JSON.parse(psql(`SELECT json_build_object('runs',(SELECT count(*) FROM ingestion_runs WHERE id='${model.runId}'),'snapshots',(SELECT count(*) FROM data_snapshots WHERE id='${model.snapshotId}'),'records',(SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}'));`).stdout.trim());
  psql(adapter.buildSql(model));
  const actual = JSON.parse(psql(adapter.buildReconciliationQuery(model)).stdout.trim());
  adapter.verifyReconciliation(model, actual);
  psql(adapter.buildSql(model));
  const repeated = JSON.parse(psql(adapter.buildReconciliationQuery(model)).stdout.trim());
  adapter.verifyReconciliation(model, repeated);
  if (JSON.stringify(actual) !== JSON.stringify(repeated)) throw new Error('idempotent_reconciliation_result_changed');

  const rollbackProbeId = model.runId.replace(/.$/, model.runId.endsWith('0') ? '1' : '0');
  const probe = psql(`BEGIN; INSERT INTO data_snapshots(id,label,manifest_hash,complete) VALUES ('${rollbackProbeId}','rollback probe','${hash(`rollback:${model.materializationHash}`)}',false); DO $$ BEGIN RAISE EXCEPTION 'intentional rollback probe'; END $$; COMMIT;`, {expectFailure:true});
  if (probe.status === 0) throw new Error('rollback_probe_did_not_fail');
  const rollbackCount = Number(psql(`SELECT count(*) FROM data_snapshots WHERE id='${rollbackProbeId}';`).stdout.trim());
  if (rollbackCount !== 0) throw new Error('rollback_probe_left_database_rows');

  const report = {
    contract: 'sensum.accepted-evidence-postgresql-materialization-audit.v1',
    generatedAt: new Date().toISOString(),
    registryContract: 'sensum.accepted-evidence-materialization-registry.v1',
    domain,
    input: {snapshotDirectory:path.basename(snapshotDir), snapshotContentHash:model.snapshotContentHash, auditFile:path.relative(process.cwd(),auditFile), auditContentHash:model.auditContentHash},
    database: {container, database, runId:model.runId, snapshotId:model.snapshotId},
    before,
    reconciled: actual,
    expected: model.counts,
    hashes: {recordHashAggregate:model.recordHashAggregate, sourceHashAggregate:model.sourceHashAggregate || null, statementHashAggregate:model.statementHashAggregate, materializationHash:model.materializationHash},
    gates: model.gates,
    transactionRollbackProven: true,
    idempotentReapplicationProven: true,
    productionMutations: 0,
    optimizerPromotions: 0,
    verifiedBestAuthorizations: 0,
    publishable: true
  };
  report.contentHash = hash(report);
  const output = path.join(root, 'accepted-evidence-postgresql-materialization-audits', report.generatedAt.replace(/[:.]/g,'-'));
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  return {...report, reportDirectory:path.relative(process.cwd(),output)};
}

if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1)))) {
  console.log(JSON.stringify(await runAcceptedEvidenceMaterialization(), null, 2));
}
