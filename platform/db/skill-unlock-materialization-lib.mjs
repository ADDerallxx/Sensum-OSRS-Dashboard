import crypto from 'node:crypto';

import {hash, json} from '../ingestion/lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';

export const MATERIALIZATION_CONTRACT = 'sensum.cross-skill-evidence-postgresql-materialization.v1';
export const INPUT_DOMAIN = 'skill-level-unlock-inventory';
export const RAW_STATEMENT_FACT_KIND = 'raw_skill_level_unlock_statement';

const requiredRecordFields = [
  'skillKey', 'skill', 'minimumBaseLevel', 'maximumBaseLevel', 'sourceRevision',
  'sourceTimestamp', 'sourceUrl', 'sourceContentHash', 'contentHash', 'parameters'
];

const isSha256 = value => /^[a-f0-9]{64}$/.test(String(value || ''));
const unique = values => [...new Set(values)];
const without = (value, key) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

function containsAccountState(value) {
  if (Array.isArray(value)) return value.some(containsAccountState);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([name,child]) => accountKey(name) || containsAccountState(child));
}

export function deterministicUuid(namespace, value) {
  const bytes = crypto.createHash('sha256').update(`${namespace}\0${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceTitle(skill) {
  return `${skill}/Level up table`;
}

function statementRows(records) {
  return records.flatMap(record => record.parameters.flatMap(parameter => parameter.entries.map(entry => {
    const payload = {
      availability: entry.availability,
      blockers: entry.blockers,
      classificationState: entry.classificationState,
      linkedTargets: entry.linkedTargets,
      optimizerEligible: entry.optimizerEligible,
      repeatableTrainingActivity: entry.repeatableTrainingActivity,
      sequence: entry.sequence,
      sourceLeadingVerb: entry.sourceLeadingVerb,
      sourceText: entry.sourceText
    };
    const envelope = {
      recordKey: entry.entryKey,
      skillKey: record.skillKey,
      parameterName: parameter.parameterName,
      level: entry.level,
      availability: entry.availability,
      sourceRevision: record.sourceRevision,
      sourceLocator: entry.sourceLocator,
      payload
    };
    return {
      ...envelope,
      sourceUrl: record.sourceUrl,
      sourceTimestamp: record.sourceTimestamp,
      contentHash: hash(envelope)
    };
  })));
}

export function validateSkillUnlockMaterializationInput({raw, manifest, audit}) {
  const errors = [];
  const add = message => errors.push(message);
  let records = [];

  if (manifest?.contract !== 'sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if (manifest?.domain !== INPUT_DOMAIN) add('manifest_domain_mismatch');
  if (manifest?.source?.kind !== 'osrs_wiki_cross_skill_level_up_table_raw_discovery_inventory' || manifest?.source?.api !== 'https://oldschool.runescape.wiki/api.php') add('manifest_source_channel_mismatch');
  if (!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if (!isSha256(manifest?.contentHash)) add('manifest_content_hash_invalid');
  if (manifest?.contentHash !== hash(raw)) add('snapshot_content_hash_mismatch');

  try {
    records = String(raw || '').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  } catch {
    add('snapshot_ndjson_invalid');
  }

  if (manifest?.records !== records.length) add('manifest_record_count_mismatch');
  if (audit?.contract !== 'sensum.skill-level-unlock-inventory-audit.v1') add('audit_contract_mismatch');
  if (!isSha256(audit?.contentHash) || audit?.contentHash !== hash(without(audit, 'contentHash'))) add('audit_content_hash_mismatch');
  if (audit?.publishable !== true || audit?.rawInventoryComplete !== true) add('raw_inventory_audit_not_publishable');
  if (audit?.inputSnapshot?.directory !== manifest?.snapshotDirectory) add('audit_snapshot_directory_mismatch');
  if (audit?.inputSnapshot?.contentHash !== manifest?.contentHash) add('audit_snapshot_hash_mismatch');
  if (audit?.accountIndependent !== true || (audit?.embeddedAccountQueryState || []).length) add('account_state_present');
  if (audit?.completeActivityUniverse !== false || audit?.optimizerEligibleActivityCount !== 0) add('audit_semantic_gate_weakened');
  if (audit?.absoluteBestGate !== 'blocked_incomplete_activity_universe') add('absolute_best_gate_weakened');
  if (manifest?.source?.audit?.publishable !== true || manifest?.source?.audit?.rawInventoryComplete !== true || manifest?.source?.audit?.optimizerEligibleActivityCount !== 0 || manifest?.source?.audit?.completeActivityUniverse !== false) add('manifest_source_audit_gate_weakened');

  const manifestSources = new Map((manifest?.source?.levelUpTables || []).map(row => [row.skillKey, row]));
  const domainSkills = new Map((manifest?.source?.skillDomain?.skills || []).map(row => [row.skillKey, row]));
  const seenSkills = [];
  const seenEntries = [];
  let capturedStatements = 0;

  for (const record of records) {
    for (const field of requiredRecordFields) if (record?.[field] === undefined || record?.[field] === null) add(`record_required_field_missing:${record?.skillKey || 'unknown'}:${field}`);
    if (record?.contract !== 'sensum.skill-level-unlock-inventory.v1') add(`record_contract_mismatch:${record?.skillKey || 'unknown'}`);
    if (record?.accountIndependent !== true) add(`record_account_state_present:${record?.skillKey || 'unknown'}`);
    if (containsAccountState(record)) add(`record_account_state_present:${record?.skillKey || 'unknown'}`);
    if (record?.rawInventoryComplete !== true || record?.state !== 'candidate' || (record?.blockers || []).length) add(`record_not_accepted_raw_candidate:${record?.skillKey || 'unknown'}`);
    if (!String(record?.sourceUrl || '').startsWith('https://oldschool.runescape.wiki/w/') || !Number.isFinite(Date.parse(record?.sourceTimestamp))) add(`record_source_provenance_invalid:${record?.skillKey || 'unknown'}`);
    if (!isSha256(record?.contentHash) || record?.contentHash !== hash(without(record, 'contentHash'))) add(`record_content_hash_mismatch:${record?.skillKey || 'unknown'}`);
    if (!isSha256(record?.sourceContentHash)) add(`source_content_hash_invalid:${record?.skillKey || 'unknown'}`);
    const source = manifestSources.get(record?.skillKey);
    if (!source || source.title !== sourceTitle(record?.skill) || String(source.revision) !== String(record?.sourceRevision) || source.timestamp !== record?.sourceTimestamp || source.sourceContentHash !== record?.sourceContentHash || source.parameterCount !== record?.parameterCount || source.statementCount !== record?.capturedStatementCount) add(`manifest_source_mismatch:${record?.skillKey || 'unknown'}`);
    const domain = domainSkills.get(record?.skillKey);
    if (!domain || domain.minimumBaseLevel !== record?.minimumBaseLevel || domain.maximumBaseLevel !== record?.maximumBaseLevel) add(`skill_domain_mismatch:${record?.skillKey || 'unknown'}`);
    seenSkills.push(record?.skillKey);

    if (record?.parameterCount !== (record?.parameters || []).length) add(`record_parameter_count_mismatch:${record?.skillKey || 'unknown'}`);
    let recordStatements = 0;
    for (const parameter of record?.parameters || []) {
      if (parameter?.entryCount !== (parameter?.entries || []).length) add(`parameter_entry_count_mismatch:${record.skillKey}:${parameter?.parameterName || 'unknown'}`);
      for (const entry of parameter?.entries || []) {
        recordStatements++;
        seenEntries.push(entry?.entryKey);
        if (entry?.classificationState !== 'pending_semantic_activity_classification' || entry?.optimizerEligible !== false || entry?.repeatableTrainingActivity !== null || json(entry?.blockers || []) !== json(['semantic_identity_and_repeatability_not_classified'])) add(`statement_semantic_gate_weakened:${entry?.entryKey || 'unknown'}`);
        if (entry?.sourceLocator?.parameter !== parameter?.parameterName || entry?.availability !== parameter?.availability || entry?.level !== parameter?.level) add(`statement_parent_scope_mismatch:${entry?.entryKey || 'unknown'}`);
      }
    }
    if (recordStatements !== record?.capturedStatementCount || recordStatements !== record?.sourceBulletCount) add(`record_statement_count_mismatch:${record?.skillKey || 'unknown'}`);
    capturedStatements += recordStatements;
  }

  if (unique(seenSkills).length !== seenSkills.length) add('duplicate_skill_records');
  if (unique(seenEntries).length !== seenEntries.length) add('duplicate_statement_keys');
  if (manifestSources.size !== records.length || domainSkills.size !== records.length) add('manifest_skill_coverage_mismatch');
  if (audit?.officialSkillDomain?.inventorySkillCount !== records.length) add('audit_skill_count_mismatch');
  if (audit?.statementCoverage?.capturedStatementCount !== capturedStatements || audit?.statementCoverage?.sourceBulletCount !== capturedStatements || audit?.statementCoverage?.countsMatch !== true) add('audit_statement_count_mismatch');

  if (errors.length) throw new Error(`Skill unlock materialization input rejected: ${unique(errors).join(', ')}`);

  const statements = statementRows(records);
  const model = {
    contract: MATERIALIZATION_CONTRACT,
    domain: INPUT_DOMAIN,
    snapshotDirectory: manifest.snapshotDirectory,
    snapshotCreatedAt: manifest.createdAt,
    snapshotContentHash: manifest.contentHash,
    auditContentHash: audit.contentHash,
    skillsRevision: manifest.source.skillDomain.revision,
    records,
    statements,
    counts: {skills: records.length, sources: records.length, records: records.length, statements: statements.length},
    gates: {rawInventoryComplete: true, completeActivityUniverse: false, optimizerEligibleRecords: 0, automaticVerification: false}
  };
  model.recordHashAggregate = hash(records.map(row => row.contentHash).sort());
  model.statementHashAggregate = hash(statements.map(row => row.contentHash).sort());
  model.materializationHash = hash(model);
  model.runId = deterministicUuid('sensum-ingestion-run', `${model.domain}:${model.snapshotContentHash}`);
  model.snapshotId = deterministicUuid('sensum-data-snapshot', model.snapshotContentHash);
  return model;
}

const hex = value => Buffer.from(String(value), 'utf8').toString('hex');
const sqlText = value => `convert_from(decode('${hex(value)}','hex'),'UTF8')`;
const sqlJson = value => `${sqlText(json(value))}::jsonb`;
const sqlTimestamp = value => `${sqlText(value)}::timestamptz`;

export function buildSkillUnlockMaterializationSql(model) {
  assert(model?.contract === MATERIALIZATION_CONTRACT, 'materialization_contract_mismatch');
  const expectedSources = model.records.map(record => `(${sqlText(record.skillKey)},${sqlText(record.sourceUrl)},${sqlText(sourceTitle(record.skill))},${sqlText(record.sourceRevision)},${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(record.sourceTimestamp)},${sqlText(record.sourceContentHash)})`).join(',\n');
  const expectedSkills = model.records.map(record => `(${sqlText(record.skillKey)},${sqlText(record.skill)},${record.maximumBaseLevel})`).join(',\n');
  const expectedRecords = model.records.map(record => `(${sqlText(record.skillKey)},${sqlJson(record)},${sqlText(record.sourceUrl)},${sqlText(record.sourceRevision)},${sqlText(record.contentHash)},${sqlJson(['semantic_identity_and_repeatability_not_classified','level_up_tables_do_not_prove_complete_repeatable_activity_universe'])})`).join(',\n');
  const expectedStatements = model.statements.map(statement => `(${sqlText(statement.recordKey)},${sqlText(statement.sourceUrl)},${sqlText(statement.sourceRevision)},${sqlTimestamp(statement.sourceTimestamp)},${sqlText(statement.contentHash)},${sqlJson({skillKey:statement.skillKey,parameterName:statement.parameterName,availability:statement.availability,level:statement.level,sourceLocator:statement.sourceLocator})},${sqlJson(statement.payload)})`).join(',\n');
  const metrics = {contract:model.contract,skills:model.counts.skills,sources:model.counts.sources,records:model.counts.records,statements:model.counts.statements,recordHashAggregate:model.recordHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,rawInventoryComplete:true,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false};
  const lines = [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    `SELECT pg_advisory_xact_lock(hashtextextended(${sqlText(`${model.domain}:${model.snapshotContentHash}`)}, 0));`,
    'CREATE TEMP TABLE expected_sources(skill_key text,source_url text,title text,source_revision text,fetched_at timestamptz,published_at timestamptz,content_hash text) ON COMMIT DROP;',
    `INSERT INTO expected_sources VALUES ${expectedSources};`,
    'CREATE TEMP TABLE expected_skills(slug text,name text,maximum_level smallint) ON COMMIT DROP;',
    `INSERT INTO expected_skills VALUES ${expectedSkills};`,
    'CREATE TEMP TABLE expected_records(record_key text,payload jsonb,source_url text,source_revision text,content_hash text,findings jsonb) ON COMMIT DROP;',
    `INSERT INTO expected_records VALUES ${expectedRecords};`,
    'CREATE TEMP TABLE expected_statements(record_key text,source_url text,source_revision text,source_timestamp timestamptz,content_hash text,raw_locator jsonb,parsed_value jsonb) ON COMMIT DROP;',
    `INSERT INTO expected_statements VALUES ${expectedStatements};`,
    `INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`Cross-skill raw unlock inventory ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson({contract:model.contract,auditContentHash:model.auditContentHash,rawInventoryComplete:true,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false})}) ON CONFLICT (manifest_hash) DO NOTHING;`,
    `INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.skillsRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(metrics)}) ON CONFLICT (id) DO NOTHING;`,
    "INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,skill_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",
    `INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,
    'INSERT INTO skills(slug,name,maximum_level) SELECT slug,name,maximum_level FROM expected_skills ON CONFLICT (slug) DO NOTHING;',
    `INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,
    `INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${RAW_STATEMENT_FACT_KIND}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,
    buildLineageInsertAndReconciliationSql(model, RAW_STATEMENT_FACT_KIND)
  ];
  lines.push(
    `DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson({contract:model.contract,auditContentHash:model.auditContentHash,rawInventoryComplete:true,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false})}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.skillsRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(metrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.title=e.title AND d.provider_key=e.skill_key AND d.revision_key=e.source_revision AND d.fetched_at=e.fetched_at AND d.published_at=e.published_at AND d.content_hash=e.content_hash AND d.state IN ('review','verified'); IF actual <> ${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed: expected ${model.counts.sources}, got %',actual; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual <> ${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}') <> ${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_skills e JOIN skills s ON s.slug=e.slug AND s.name=e.name AND s.maximum_level=e.maximum_level; IF actual <> ${model.counts.skills} THEN RAISE EXCEPTION 'skill reconciliation failed: expected ${model.counts.skills}, got %',actual; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual <> ${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}') <> ${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${RAW_STATEMENT_FACT_KIND}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual <> ${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed: expected ${model.counts.statements}, got %',actual; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '\"optimizerEligible\"[[:space:]]*:[[:space:]]*true') THEN RAISE EXCEPTION 'ingestion evidence state gate weakened'; END IF; END $$;`,
    'COMMIT;'
  );
  return lines.join('\n') + '\n';
}

export function buildReconciliationQuery(model) {
  const expectedStatements=model.statements.map(row=>`(${sqlText(row.recordKey)},${sqlText(row.sourceRevision)},${sqlText(row.contentHash)})`).join(',');
  return `WITH expected_statement(record_key,source_revision,content_hash) AS (VALUES ${expectedStatements}) SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM expected_statement e JOIN activity_evidence a ON a.record_key=e.record_key AND a.source_revision=e.source_revision AND a.content_hash=e.content_hash AND a.fact_kind='${RAW_STATEMENT_FACT_KIND}'),'lineage',(SELECT count(*) FROM expected_statement e JOIN activity_evidence a ON a.record_key=e.record_key AND a.source_revision=e.source_revision AND a.content_hash=e.content_hash AND a.fact_kind='${RAW_STATEMENT_FACT_KIND}' JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}'),'skills',(SELECT count(*) FROM skills WHERE slug IN (${model.records.map(row => sqlText(row.skillKey)).join(',')})),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`;
}

export function verifyReconciliation(model, actual) {
  assert(actual?.runId === model.runId, 'reconciliation_run_id_mismatch');
  assert(actual?.status === 'published', 'reconciliation_run_not_published');
  for (const key of ['records', 'sources', 'statements', 'skills']) assert(Number(actual?.[key]) === model.counts[key], `reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage) === model.counts.statements, 'reconciliation_lineage_count_mismatch');
  assert(actual?.snapshotComplete === false, 'raw_inventory_snapshot_must_not_claim_complete_world_knowledge');
  assert(actual?.metrics?.recordHashAggregate === model.recordHashAggregate, 'reconciliation_record_hash_mismatch');
  assert(actual?.metrics?.statementHashAggregate === model.statementHashAggregate, 'reconciliation_statement_hash_mismatch');
  assert(actual?.metrics?.materializationHash === model.materializationHash, 'reconciliation_materialization_hash_mismatch');
  assert(actual?.metrics?.completeActivityUniverse === false && Number(actual?.metrics?.optimizerEligibleRecords) === 0 && actual?.metrics?.automaticVerification === false, 'reconciliation_semantic_gate_weakened');
  return true;
}
