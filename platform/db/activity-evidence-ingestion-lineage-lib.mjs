const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const hex = value => Buffer.from(String(value), 'utf8').toString('hex');
const sqlText = value => `convert_from(decode('${hex(value)}','hex'),'UTF8')`;

export const ACTIVITY_EVIDENCE_INGESTION_LINEAGE_CONTRACT = 'sensum.activity-evidence-ingestion-lineage.v1';

export function expectedLineageRows(model, factKind) {
  assert(model?.runId && model?.domain && Array.isArray(model?.statements), 'lineage_model_invalid');
  assert(typeof factKind === 'string' && factKind.length > 0, 'lineage_fact_kind_invalid');
  return model.statements.map(statement => ({
    runId: model.runId,
    domain: model.domain,
    factKind,
    recordKey: statement.recordKey,
    sourceRevision: String(statement.sourceRevision),
    contentHash: statement.contentHash
  }));
}

function valuesSql(rows) {
  assert(rows.length > 0, 'lineage_rows_empty');
  return rows.map(row => `('${row.runId}',${sqlText(row.domain)},${sqlText(row.factKind)},${sqlText(row.recordKey)},${sqlText(row.sourceRevision)},${sqlText(row.contentHash)})`).join(',\n');
}

export function buildExpectedLineageTempTableSql(rows) {
  const identities = new Set();
  for (const row of rows) {
    const key = `${row.factKind}\u0000${row.recordKey}\u0000${row.sourceRevision}\u0000${row.contentHash}`;
    assert(!identities.has(key), `duplicate_expected_lineage_identity:${row.factKind}:${row.recordKey}`);
    identities.add(key);
  }
  return [
    'CREATE TEMP TABLE expected_evidence_lineage(ingestion_run_id uuid,domain text,fact_kind text,record_key text,source_revision text,content_hash text) ON COMMIT DROP;',
    `INSERT INTO expected_evidence_lineage VALUES ${valuesSql(rows)};`
  ].join('\n');
}

export function buildLineageInsertAndReconciliationSql(model, factKind) {
  const rows = expectedLineageRows(model, factKind);
  return [
    buildExpectedLineageTempTableSql(rows),
    `INSERT INTO activity_evidence_ingestion_lineage(activity_evidence_id,ingestion_run_id) SELECT a.id,e.ingestion_run_id FROM expected_evidence_lineage e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind=e.fact_kind AND a.source_revision=e.source_revision AND a.content_hash=e.content_hash ON CONFLICT (activity_evidence_id) DO NOTHING;`,
    `DO $$ DECLARE actual integer; BEGIN SELECT count(*) INTO actual FROM expected_evidence_lineage e JOIN ingestion_runs r ON r.id=e.ingestion_run_id AND r.domain=e.domain JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind=e.fact_kind AND a.source_revision=e.source_revision AND a.content_hash=e.content_hash JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id=e.ingestion_run_id; IF actual <> ${rows.length} THEN RAISE EXCEPTION 'evidence ingestion lineage reconciliation failed: expected ${rows.length}, got %',actual; END IF; END $$;`
  ].join('\n');
}

export function buildLineageBackfillSql(models) {
  assert(Array.isArray(models) && models.length > 0, 'lineage_models_empty');
  const rows = models.flatMap(({model, factKind}) => expectedLineageRows(model, factKind));
  const factKinds = [...new Set(rows.map(row => row.factKind))];
  return [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    `SELECT pg_advisory_xact_lock(hashtextextended(${sqlText('activity-evidence-ingestion-lineage-backfill-v1')},0));`,
    buildExpectedLineageTempTableSql(rows),
    `DO $$ DECLARE actual integer; BEGIN SELECT count(*) INTO actual FROM expected_evidence_lineage e JOIN ingestion_runs r ON r.id=e.ingestion_run_id AND r.domain=e.domain; IF actual <> ${rows.length} THEN RAISE EXCEPTION 'expected ingestion run domain reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_evidence_lineage e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind=e.fact_kind AND a.source_revision=e.source_revision AND a.content_hash=e.content_hash; IF actual <> ${rows.length} THEN RAISE EXCEPTION 'expected evidence identity reconciliation failed: expected ${rows.length}, got %',actual; END IF; END $$;`,
    'INSERT INTO activity_evidence_ingestion_lineage(activity_evidence_id,ingestion_run_id) SELECT a.id,e.ingestion_run_id FROM expected_evidence_lineage e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind=e.fact_kind AND a.source_revision=e.source_revision AND a.content_hash=e.content_hash ON CONFLICT (activity_evidence_id) DO NOTHING;',
    `DO $$ DECLARE actual integer; BEGIN SELECT count(*) INTO actual FROM expected_evidence_lineage e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind=e.fact_kind AND a.source_revision=e.source_revision AND a.content_hash=e.content_hash JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id=e.ingestion_run_id; IF actual <> ${rows.length} THEN RAISE EXCEPTION 'lineage backfill reconciliation failed: expected ${rows.length}, got %',actual; END IF; IF EXISTS (SELECT 1 FROM activity_evidence a LEFT JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id WHERE a.fact_kind IN (${factKinds.map(sqlText).join(',')}) AND l.activity_evidence_id IS NULL) THEN RAISE EXCEPTION 'registered evidence statement remains unlinked'; END IF; IF EXISTS (SELECT 1 FROM activity_evidence_ingestion_lineage l JOIN activity_evidence a ON a.id=l.activity_evidence_id JOIN ingestion_runs r ON r.id=l.ingestion_run_id LEFT JOIN expected_evidence_lineage e ON e.ingestion_run_id=l.ingestion_run_id AND e.fact_kind=a.fact_kind AND e.record_key=a.record_key AND e.source_revision=a.source_revision AND e.content_hash=a.content_hash WHERE a.fact_kind IN (${factKinds.map(sqlText).join(',')}) AND e.ingestion_run_id IS NULL) THEN RAISE EXCEPTION 'unexpected registered evidence lineage exists'; END IF; END $$;`,
    'COMMIT;'
  ].join('\n') + '\n';
}

export function buildLineageAuditQuery(models) {
  const rows = models.flatMap(({model, factKind}) => expectedLineageRows(model, factKind));
  return `WITH expected_evidence_lineage(ingestion_run_id,domain,fact_kind,record_key,source_revision,content_hash) AS (VALUES ${valuesSql(rows)}) SELECT json_build_object('evidenceStatements',(SELECT count(*) FROM activity_evidence),'lineageRows',(SELECT count(*) FROM activity_evidence_ingestion_lineage),'expectedLineageRows',(SELECT count(*) FROM expected_evidence_lineage),'unlinkedStatements',(SELECT count(*) FROM activity_evidence a LEFT JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id WHERE l.activity_evidence_id IS NULL),'mismatchedExpectedLinks',(SELECT count(*) FROM expected_evidence_lineage e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind=e.fact_kind AND a.source_revision=e.source_revision AND a.content_hash=e.content_hash LEFT JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id=e.ingestion_run_id::uuid WHERE l.activity_evidence_id IS NULL),'byDomain',(SELECT COALESCE(json_object_agg(domain,n),'{}'::json) FROM (SELECT r.domain,count(*) n FROM activity_evidence_ingestion_lineage l JOIN ingestion_runs r ON r.id=l.ingestion_run_id GROUP BY r.domain ORDER BY r.domain) q));`;
}
