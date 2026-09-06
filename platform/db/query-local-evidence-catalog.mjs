import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {
  assertCatalogPayload,
  assertReadOnlyCatalogSql,
  buildCatalogSql,
  formatCatalogText,
  normalizeCatalogOptions
} from './local-evidence-catalog-lib.mjs';

const installedDocker = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';

export function queryLocalEvidenceCatalog(options = {}, runtime = {}) {
  const normalized = normalizeCatalogOptions(options);
  const docker = runtime.docker || (fs.existsSync(installedDocker) ? installedDocker : 'docker');
  const container = runtime.container || 'sensum-v4-postgres';
  const database = runtime.database || 'sensum_v4';
  const user = runtime.user || 'sensum_v4';
  const sql = buildCatalogSql(normalized);
  assertReadOnlyCatalogSql(sql);
  const result = spawnSync(docker, ['exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U',user,'-d',database,'-tA'], {input:sql,encoding:'utf8',maxBuffer:16 * 1024 * 1024});
  if (result.status !== 0) throw new Error(`Local evidence catalog query failed: ${(result.stderr || result.stdout || '').trim()}`);
  const lines = String(result.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).filter(line => !['BEGIN','SET','COMMIT'].includes(line));
  if (lines.length !== 1) throw new Error(`Local evidence catalog returned ${lines.length} payloads instead of one.`);
  const payload = JSON.parse(lines[0]);
  assertCatalogPayload(payload, normalized.view);
  return payload;
}

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  const options = {view:argument('view') || 'summary',skill:argument('skill') || null,domain:argument('domain') || null,source:argument('source') || null,revision:argument('revision') || null,limit:argument('limit') || 50};
  const format = argument('format') || 'text';
  if (!['text','json'].includes(format)) throw new Error(`unsupported_catalog_format:${format}`);
  const payload = queryLocalEvidenceCatalog(options,{docker:argument('docker'),container:argument('container'),database:argument('database'),user:argument('user')});
  process.stdout.write(format === 'json' ? `${JSON.stringify(payload,null,2)}\n` : `${formatCatalogText(payload)}\n`);
}
