import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const compose = fs.readFileSync('platform/local/compose.yaml', 'utf8');
const manager = fs.readFileSync('platform/local/Manage-SensumV4Local.ps1', 'utf8');
const ignore = fs.readFileSync('.gitignore', 'utf8');

test('local PostgreSQL is loopback-only and password-gated', () => {
  assert.match(compose, /127\.0\.0\.1:54329:5432/);
  assert.match(compose, /POSTGRES_PASSWORD:\s*\$\{SENSUM_V4_DB_PASSWORD:\?Set SENSUM_V4_DB_PASSWORD/);
});

test('local PostgreSQL data is durable and resource-bounded', () => {
  assert.match(compose, /postgres:18\.1-bookworm@sha256:[a-f0-9]{64}/);
  assert.match(compose, /sensum_v4_postgres_data:\/var\/lib\/postgresql/);
  assert.match(compose, /mem_limit:\s*4g/);
  assert.match(compose, /cpus:\s*4\.0/);
  assert.match(compose, /pg_isready/);
});

test('manager tracks migrations, preserves data on stop, and supports backups', () => {
  assert.match(manager, /sensum_schema_migrations/);
  assert.match(manager, /\$null -ne \$applied -and \(\[string\]\$applied\)\.Trim\(\)/);
  assert.match(manager, /must contain explicit BEGIN and COMMIT statements/);
  assert.match(manager, /'compose'.*'stop'/s);
  assert.match(manager, /pg_dump/);
  assert.doesNotMatch(manager, /compose'.*'down'.*--volumes/s);
  assert.match(manager, /\$env:PATH = "\$dockerBin;\$env:PATH"/);
});

test('every current migration owns an explicit transaction boundary', () => {
  const migrationRoot = 'platform/db/migrations';
  for (const name of fs.readdirSync(migrationRoot).filter(name => name.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(migrationRoot, name), 'utf8');
    assert.match(sql, /^\s*BEGIN;\s*$/im, `${name} must begin a transaction`);
    assert.match(sql, /^\s*COMMIT;\s*$/im, `${name} must commit its transaction`);
  }
});

test('local database artifacts and secrets remain outside Git', () => {
  assert.match(ignore, /^\.platform-local\/$/m);
  assert.match(ignore, /^platform\/local\/\.env$/m);
});
