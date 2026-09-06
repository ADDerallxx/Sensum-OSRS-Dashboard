import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

import {
  assertReadOnlyCatalogSql,
  buildCatalogSql,
  formatCatalogText,
  normalizeCatalogOptions
} from './local-evidence-catalog-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const options = normalizeCatalogOptions({
  view:argument('view') || 'summary',
  skill:argument('skill') || null,
  limit:argument('limit') || 50
});
const format = argument('format') || 'text';
if (!['text','json'].includes(format)) throw new Error(`unsupported_catalog_format:${format}`);

const explicitDocker = argument('docker');
const installedDocker = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
const docker = explicitDocker || (fs.existsSync(installedDocker) ? installedDocker : 'docker');
const container = argument('container') || 'sensum-v4-postgres';
const database = argument('database') || 'sensum_v4';
const user = argument('user') || 'sensum_v4';
const sql = buildCatalogSql(options);
assertReadOnlyCatalogSql(sql);

const result = spawnSync(docker, ['exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U',user,'-d',database,'-tA'], {
  input:sql,
  encoding:'utf8',
  maxBuffer:16 * 1024 * 1024
});
if (result.status !== 0) throw new Error(`Local evidence catalog query failed: ${(result.stderr || result.stdout || '').trim()}`);

const lines = String(result.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).filter(line => !['BEGIN','SET','COMMIT'].includes(line));
if (lines.length !== 1) throw new Error(`Local evidence catalog returned ${lines.length} payloads instead of one.`);
const payload = JSON.parse(lines[0]);
process.stdout.write(format === 'json' ? `${JSON.stringify(payload,null,2)}\n` : `${formatCatalogText(payload)}\n`);
