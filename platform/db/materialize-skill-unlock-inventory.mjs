import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

import {hash} from '../ingestion/lib.mjs';
import {
  buildReconciliationQuery,
  buildSkillUnlockMaterializationSql,
  validateSkillUnlockMaterializationInput,
  verifyReconciliation
} from './skill-unlock-materialization-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const container = argument('container') || 'sensum-v4-postgres';
const database = argument('database') || 'sensum_v4';
const user = argument('user') || 'sensum_v4';

function dockerExecutable() {
  const explicit = argument('docker');
  const installed = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
  if (explicit) return explicit;
  if (fsSync.existsSync(installed)) return installed;
  return 'docker';
}

function runPsql(sql, {expectFailure = false} = {}) {
  const result = spawnSync(dockerExecutable(), ['exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database, '-tA'], {input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (!expectFailure && result.status !== 0) throw new Error(`PostgreSQL materialization failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result;
}

async function validInput() {
  const explicitSnapshot = argument('snapshot-dir');
  const explicitAudit = argument('audit');
  const auditFiles = explicitAudit ? [path.resolve(explicitAudit)] : (await fs.readdir(path.join(root, 'skill-level-unlock-inventory-audits'), {withFileTypes:true}))
    .filter(entry => entry.isDirectory()).map(entry => path.join(root, 'skill-level-unlock-inventory-audits', entry.name, 'report.json')).sort().reverse();
  const rejections = [];
  for (const auditFile of auditFiles) {
    try {
      const audit = JSON.parse(await fs.readFile(auditFile, 'utf8'));
      const snapshotDirectory = explicitSnapshot ? path.basename(path.resolve(explicitSnapshot)) : audit?.inputSnapshot?.directory;
      if (!snapshotDirectory) throw new Error('audit_missing_snapshot_directory');
      const snapshotDir = explicitSnapshot ? path.resolve(explicitSnapshot) : path.join(root, snapshotDirectory);
      const raw = await fs.readFile(path.join(snapshotDir, 'skill-level-unlock-inventory.ndjson'), 'utf8');
      const manifest = JSON.parse(await fs.readFile(path.join(snapshotDir, 'manifest.json'), 'utf8'));
      manifest.snapshotDirectory = snapshotDirectory;
      return {model:validateSkillUnlockMaterializationInput({raw,manifest,audit}), auditFile, snapshotDir};
    } catch (error) {
      rejections.push({auditFile,message:error.message});
    }
  }
  throw new Error(`No accepted skill unlock snapshot could be materialized: ${JSON.stringify(rejections)}`);
}

const {model,auditFile,snapshotDir} = await validInput();
const before = runPsql(`SELECT json_build_object('runs',(SELECT count(*) FROM ingestion_runs WHERE id='${model.runId}'),'snapshots',(SELECT count(*) FROM data_snapshots WHERE id='${model.snapshotId}'),'records',(SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}'));`).stdout.trim();
runPsql(buildSkillUnlockMaterializationSql(model));
const actual = JSON.parse(runPsql(buildReconciliationQuery(model)).stdout.trim());
verifyReconciliation(model, actual);

// A second complete application must be a no-op with the same reconciliation result.
runPsql(buildSkillUnlockMaterializationSql(model));
const repeated = JSON.parse(runPsql(buildReconciliationQuery(model)).stdout.trim());
verifyReconciliation(model, repeated);
if (JSON.stringify(actual) !== JSON.stringify(repeated)) throw new Error('idempotent_reconciliation_result_changed');

// Prove PostgreSQL rollback independently of the materialized data.
const rollbackProbeId = model.runId.replace(/.$/, model.runId.endsWith('0') ? '1' : '0');
const probe = runPsql(`BEGIN; INSERT INTO data_snapshots(id,label,manifest_hash,complete) VALUES ('${rollbackProbeId}','rollback probe','${hash(`rollback:${model.materializationHash}`)}',false); DO $$ BEGIN RAISE EXCEPTION 'intentional rollback probe'; END $$; COMMIT;`, {expectFailure:true});
if (probe.status === 0) throw new Error('rollback_probe_did_not_fail');
const rollbackCount = Number(runPsql(`SELECT count(*) FROM data_snapshots WHERE id='${rollbackProbeId}';`).stdout.trim());
if (rollbackCount !== 0) throw new Error('rollback_probe_left_database_rows');

const report = {
  contract: 'sensum.cross-skill-evidence-postgresql-materialization-audit.v1',
  generatedAt: new Date().toISOString(),
  input: {snapshotDirectory:path.basename(snapshotDir),snapshotContentHash:model.snapshotContentHash,auditFile:path.relative(process.cwd(),auditFile),auditContentHash:model.auditContentHash},
  database: {container,database,runId:model.runId,snapshotId:model.snapshotId},
  before: JSON.parse(before),
  reconciled: actual,
  expected: model.counts,
  hashes: {recordHashAggregate:model.recordHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash},
  gates: model.gates,
  transactionRollbackProven: true,
  idempotentReapplicationProven: true,
  productionMutations: 0,
  optimizerPromotions: 0,
  verifiedBestAuthorizations: 0,
  publishable: true
};
report.contentHash = hash(report);
const output = path.join(root, 'cross-skill-evidence-postgresql-materialization-audits', report.generatedAt.replace(/[:.]/g,'-'));
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,reportDirectory:path.relative(process.cwd(),output)},null,2));
