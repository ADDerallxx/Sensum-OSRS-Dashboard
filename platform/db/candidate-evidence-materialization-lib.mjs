import {json} from '../ingestion/lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {
  buildExistingExactWikiSourceCountQuery,
  exactWikiSourceReconciliationPredicate
} from './exact-wiki-source-identity-lib.mjs';

const assert=(condition,message)=>{if(!condition) throw new Error(message);};
const hex=value=>Buffer.from(String(value),'utf8').toString('hex');
const sqlText=value=>`convert_from(decode('${hex(value)}','hex'),'UTF8')`;
const sqlJson=value=>`${sqlText(json(value))}::jsonb`;
const sqlTimestamp=value=>`${sqlText(value)}::timestamptz`;

function metrics(model) {
  return {
    contract:model.contract,
    sources:model.counts.sources,
    records:model.counts.records,
    statements:model.counts.statements,
    skillCoverage:model.skillKeys.length,
    skillKeys:model.skillKeys,
    recordHashAggregate:model.recordHashAggregate,
    sourceHashAggregate:model.sourceHashAggregate,
    statementHashAggregate:model.statementHashAggregate,
    materializationHash:model.materializationHash,
    ...model.gates
  };
}

export function buildCandidateEvidenceMaterializationSql(model,{contract,factKind,label}) {
  assert(model?.contract===contract,'materialization_contract_mismatch');
  assert(model?.sources?.length&&model?.records?.length&&model?.statements?.length,'materialization_model_empty');
  assert(/^[a-z0-9_]+$/.test(String(factKind||'')),'materialization_fact_kind_invalid');
  assert(typeof label==='string'&&label.trim().length>0,'materialization_label_invalid');
  const expectedSources=model.sources.map(source=>`(${sqlText(source.providerKey)},${sqlText(source.sourceUrl)},${sqlText(source.title)},${sqlText(source.sourceRevision)},${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(source.sourceTimestamp)},${sqlText(source.sourceContentHash)})`).join(',\n');
  const expectedRecords=model.records.map(record=>`(${sqlText(record.memberCandidateKey)},${sqlJson(record)},${sqlText(record.sourceUrl)},${sqlText(String(record.sourceRevision))},${sqlText(record.contentHash)},${sqlJson(record.blockers)})`).join(',\n');
  const expectedStatements=model.statements.map(statement=>`(${sqlText(statement.recordKey)},${sqlText(statement.sourceUrl)},${sqlText(statement.sourceRevision)},${sqlTimestamp(statement.sourceTimestamp)},${sqlText(statement.contentHash)},${sqlJson(statement.sourceLocator)},${sqlJson(statement.payload)})`).join(',\n');
  const validationSummary={contract:model.contract,auditContentHash:model.auditContentHash,...model.gates};
  const materializationMetrics=metrics(model);
  return [
    '\\set ON_ERROR_STOP on','BEGIN;',
    `SELECT pg_advisory_xact_lock(hashtextextended(${sqlText(`${model.domain}:${model.snapshotContentHash}`)},0));`,
    'CREATE TEMP TABLE expected_sources(provider_key text,source_url text,title text,source_revision text,fetched_at timestamptz,published_at timestamptz,content_hash text) ON COMMIT DROP;',`INSERT INTO expected_sources VALUES ${expectedSources};`,
    'CREATE TEMP TABLE expected_records(record_key text,payload jsonb,source_url text,source_revision text,content_hash text,findings jsonb) ON COMMIT DROP;',`INSERT INTO expected_records VALUES ${expectedRecords};`,
    'CREATE TEMP TABLE expected_statements(record_key text,source_url text,source_revision text,source_timestamp timestamptz,content_hash text,raw_locator jsonb,parsed_value jsonb) ON COMMIT DROP;',`INSERT INTO expected_statements VALUES ${expectedStatements};`,
    `INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`${label} ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson(validationSummary)}) ON CONFLICT (manifest_hash) DO NOTHING;`,
    `INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.sourceRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(materializationMetrics)}) ON CONFLICT (id) DO NOTHING;`,
    "INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,provider_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",
    `INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,
    `INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,
    `INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${factKind}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,
    buildLineageInsertAndReconciliationSql(model,factKind),
    `DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson(validationSummary)}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.sourceRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(materializationMetrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON ${exactWikiSourceReconciliationPredicate()}; IF actual<>${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual<>${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}')<>${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual<>${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}')<>${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${factKind}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual<>${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed'; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '\"optimizerEligible\"[[:space:]]*:[[:space:]]*true') THEN RAISE EXCEPTION 'ingestion evidence state gate weakened'; END IF; END $$;`,
    'COMMIT;'
  ].join('\n')+'\n';
}

export function buildCandidateEvidenceExistingSourceCountQuery(model) {
  return buildExistingExactWikiSourceCountQuery(model.sources);
}

export function buildCandidateEvidenceReconciliationQuery(model,factKind) {
  return `SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM activity_evidence a JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}' WHERE a.fact_kind=${sqlText(factKind)}),'lineage',(SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE ingestion_run_id='${model.runId}'),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`;
}

export function verifyCandidateEvidenceReconciliation(model,actual,{gateVerifier}) {
  assert(actual?.runId===model.runId,'reconciliation_run_id_mismatch');
  assert(actual?.status==='published','reconciliation_run_not_published');
  for(const key of ['records','sources','statements']) assert(Number(actual?.[key])===model.counts[key],`reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage)===model.counts.statements,'reconciliation_lineage_count_mismatch');
  assert(actual?.snapshotComplete===false,'candidate_evidence_snapshot_must_not_claim_complete_world_knowledge');
  for(const [key,value] of [['recordHashAggregate',model.recordHashAggregate],['sourceHashAggregate',model.sourceHashAggregate],['statementHashAggregate',model.statementHashAggregate],['materializationHash',model.materializationHash]]) assert(actual?.metrics?.[key]===value,`reconciliation_${key}_mismatch`);
  assert(gateVerifier(actual.metrics,model),'reconciliation_semantic_gate_weakened');
  return true;
}
