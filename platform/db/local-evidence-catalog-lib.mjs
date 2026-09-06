export const LOCAL_EVIDENCE_CATALOG_CONTRACT = 'sensum.local-evidence-catalog.v3';

const VIEWS = new Set(['summary', 'skills', 'sources', 'blockers', 'domains', 'lineage']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function textLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function normalizeCatalogOptions({view = 'summary', skill = null, domain = null, source = null, revision = null, limit = 50} = {}) {
  assert(VIEWS.has(view), `unsupported_catalog_view:${view}`);
  const normalizedLimit = Number(limit);
  assert(Number.isInteger(normalizedLimit) && normalizedLimit >= 1 && normalizedLimit <= 500, 'catalog_limit_must_be_between_1_and_500');
  if (skill !== null && skill !== undefined && skill !== '') {
    assert(/^[a-z0-9-]+$/.test(String(skill)), 'catalog_skill_filter_invalid');
    assert(view === 'skills' || view === 'sources', 'catalog_skill_filter_not_supported_for_view');
  }
  if (domain !== null && domain !== undefined && domain !== '') {
    assert(/^[a-z0-9-]+$/.test(String(domain)), 'catalog_domain_filter_invalid');
    assert(view === 'domains' || view === 'lineage', 'catalog_domain_filter_not_supported_for_view');
  }
  if (source !== null && source !== undefined && source !== '') {
    assert(/^[A-Za-z0-9:_-]+$/.test(String(source)), 'catalog_source_filter_invalid');
    assert(view === 'sources' || view === 'lineage', 'catalog_source_filter_not_supported_for_view');
  }
  if (revision !== null && revision !== undefined && revision !== '') {
    assert(/^[A-Za-z0-9._:-]+$/.test(String(revision)), 'catalog_revision_filter_invalid');
    assert(view === 'sources' || view === 'lineage', 'catalog_revision_filter_not_supported_for_view');
  }
  return {view, skill:skill ? String(skill) : null, domain:domain ? String(domain) : null, source:source ? String(source) : null, revision:revision ? String(revision) : null, limit:normalizedLimit};
}

function summaryQuery() {
  return `WITH latest_run AS (
  SELECT domain,status,finished_at,record_count,source_revision,content_hash,metrics
  FROM ingestion_runs
  ORDER BY finished_at DESC NULLS LAST, started_at DESC NULLS LAST
  LIMIT 1
), blocker_rows AS (
  SELECT blocker FROM ingestion_records r
  CROSS JOIN LATERAL jsonb_array_elements_text(r.findings) AS f(blocker)
  UNION ALL
  SELECT blocker FROM activity_evidence a
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(a.parsed_value->'blockers','[]'::jsonb)) AS f(blocker)
), state_counts AS (
  SELECT state::text AS state,count(*)::integer AS records
  FROM activity_evidence GROUP BY state
)
SELECT json_build_object(
  'contract',${textLiteral(LOCAL_EVIDENCE_CATALOG_CONTRACT)},
  'view','summary',
  'generatedAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'counts',json_build_object(
    'skills',(SELECT count(*) FROM skills),
    'sources',(SELECT count(*) FROM data_sources),
    'wikiSources',(SELECT count(*) FROM data_sources WHERE kind='osrs_wiki'),
    'revisionPinnedWikiSources',(SELECT count(*) FROM data_sources WHERE kind='osrs_wiki' AND revision_key IS NOT NULL AND revision_key<>''),
    'wikiSourcesMissingRevision',(SELECT count(*) FROM data_sources WHERE kind='osrs_wiki' AND (revision_key IS NULL OR revision_key='')),
    'snapshots',(SELECT count(*) FROM data_snapshots),
    'completeSnapshots',(SELECT count(*) FROM data_snapshots WHERE complete),
    'ingestionRuns',(SELECT count(*) FROM ingestion_runs),
    'ingestionRecords',(SELECT count(*) FROM ingestion_records),
    'evidenceStatements',(SELECT count(*) FROM activity_evidence),
    'evidenceStatementLineageRows',(SELECT count(*) FROM activity_evidence_ingestion_lineage),
    'unlinkedEvidenceStatements',(SELECT count(*) FROM activity_evidence a LEFT JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id WHERE l.activity_evidence_id IS NULL),
    'optimizerEligibleStatements',(SELECT count(*) FROM activity_evidence WHERE parsed_value->>'optimizerEligible'='true'),
    'openValidationFindings',(SELECT count(*) FROM validation_findings WHERE resolved_at IS NULL),
    'explicitBlockerOccurrences',(SELECT count(*) FROM blocker_rows)
  ),
  'evidenceStates',COALESCE((SELECT json_object_agg(state,records) FROM state_counts),'{}'::json),
  'latestIngestion',(SELECT row_to_json(latest_run) FROM latest_run),
  'topBlockers',COALESCE((SELECT json_agg(row_to_json(b)) FROM (
    SELECT blocker,count(*)::integer AS occurrences FROM blocker_rows GROUP BY blocker ORDER BY count(*) DESC,blocker LIMIT 10
  ) b),'[]'::json)
);`;
}

function skillsQuery({skill, limit}) {
  const filter = skill ? `WHERE s.slug=${textLiteral(skill)}` : '';
  return `SELECT json_build_object(
  'contract',${textLiteral(LOCAL_EVIDENCE_CATALOG_CONTRACT)},
  'view','skills',
  'rows',COALESCE(json_agg(row_to_json(q)),'[]'::json)
) FROM (
  SELECT s.slug,s.name,s.maximum_level AS "maximumLevel",d.revision_key AS "sourceRevision",
    d.published_at AS "sourceTimestamp",d.state::text AS "sourceState",
    count(a.id)::integer AS "statementCount",
    count(a.id) FILTER (WHERE a.state='candidate')::integer AS "candidateCount",
    count(a.id) FILTER (WHERE a.state='verified')::integer AS "verifiedCount",
    count(a.id) FILTER (WHERE a.parsed_value->>'optimizerEligible'='true')::integer AS "optimizerEligibleCount"
  FROM skills s
  LEFT JOIN LATERAL (
    SELECT * FROM data_sources source
    WHERE source.provider_key=s.slug AND source.kind='osrs_wiki'
    ORDER BY source.published_at DESC NULLS LAST,source.fetched_at DESC
    LIMIT 1
  ) d ON true
  LEFT JOIN activity_evidence a ON a.source_id=d.id AND a.fact_kind='raw_skill_level_unlock_statement'
  ${filter}
  GROUP BY s.slug,s.name,s.maximum_level,d.revision_key,d.published_at,d.state
  ORDER BY s.name,d.published_at DESC NULLS LAST
  LIMIT ${limit}
) q;`;
}

function sourcesQuery({skill, source, revision, limit}) {
  const filters = [
    skill ? `d.provider_key=${textLiteral(skill)}` : null,
    source ? `d.provider_key=${textLiteral(source)}` : null,
    revision ? `d.revision_key=${textLiteral(revision)}` : null
  ].filter(Boolean);
  const filter = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return `SELECT json_build_object(
  'contract',${textLiteral(LOCAL_EVIDENCE_CATALOG_CONTRACT)},
  'view','sources',
  'rows',COALESCE(json_agg(row_to_json(q)),'[]'::json)
) FROM (
  SELECT d.provider_key AS "sourceKey",d.title,d.canonical_url AS url,d.revision_key AS revision,
    d.published_at AS "sourceTimestamp",d.fetched_at AS "fetchedAt",d.state::text AS state,
    count(a.id)::integer AS "statementCount",
    (SELECT count(*)::integer FROM snapshot_sources linked WHERE linked.source_id=d.id) AS "snapshotLinkCount"
  FROM data_sources d
  LEFT JOIN activity_evidence a ON a.source_id=d.id
  ${filter}
  GROUP BY d.id
  ORDER BY d.provider_key,d.published_at DESC NULLS LAST
  LIMIT ${limit}
) q;`;
}

function domainsQuery({domain, limit}) {
  const filter = domain ? `WHERE r.domain=${textLiteral(domain)}` : '';
  return `SELECT json_build_object(
  'contract',${textLiteral(LOCAL_EVIDENCE_CATALOG_CONTRACT)},
  'view','domains',
  'rows',COALESCE(json_agg(row_to_json(q)),'[]'::json)
) FROM (
  SELECT r.domain,r.id AS "runId",r.status::text AS status,r.finished_at AS "finishedAt",
    r.content_hash AS "snapshotContentHash",r.source_revision AS "sourceRevisions",
    s.id AS "snapshotId",s.complete AS "snapshotComplete",
    (SELECT count(*)::integer FROM snapshot_sources ss WHERE ss.snapshot_id=s.id) AS "sourceCount",
    (SELECT count(*)::integer FROM ingestion_records records WHERE records.run_id=r.id) AS "recordCount",
    COALESCE((r.metrics->>'statements')::integer,0) AS "declaredStatementCount",
    (SELECT count(*)::integer FROM activity_evidence_ingestion_lineage statement_links WHERE statement_links.ingestion_run_id=r.id) AS "directStatementCount",
    'direct_activity_evidence_ingestion_run_foreign_key'::text AS "statementLineageState",
    COALESCE((r.metrics->>'optimizerEligibleRecords')::integer,0) AS "optimizerEligibleCount",
    COALESCE((r.metrics->>'automaticVerification')::boolean,false) AS "automaticVerification",
    COALESCE((r.metrics->>'completeActivityUniverse')::boolean,false) AS "completeActivityUniverse",
    COALESCE((r.metrics->>'semanticReviewRequired')::boolean,false) AS "semanticReviewRequired",
    r.metrics->>'materializationHash' AS "materializationHash",
    (r.record_count=(SELECT count(*) FROM ingestion_records records WHERE records.run_id=r.id)) AS "recordCountReconciles",
    (COALESCE((r.metrics->>'sources')::integer,(SELECT count(*) FROM snapshot_sources ss WHERE ss.snapshot_id=s.id))=(SELECT count(*) FROM snapshot_sources ss WHERE ss.snapshot_id=s.id)) AS "sourceCountReconciles",
    (COALESCE((r.metrics->>'statements')::integer,0)=(SELECT count(*) FROM activity_evidence_ingestion_lineage statement_links WHERE statement_links.ingestion_run_id=r.id)) AS "statementCountReconciles"
  FROM ingestion_runs r
  LEFT JOIN data_snapshots s ON s.manifest_hash=r.content_hash
  ${filter}
  ORDER BY r.finished_at DESC NULLS LAST,r.domain
  LIMIT ${limit}
) q;`;
}

function lineageQuery({domain, source, revision, limit}) {
  const filters = [
    domain ? `lineage.domain=${textLiteral(domain)}` : null,
    source ? `lineage."sourceKey"=${textLiteral(source)}` : null,
    revision ? `lineage.revision=${textLiteral(revision)}` : null
  ].filter(Boolean);
  const filter = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return `WITH lineage AS (
  SELECT d.provider_key AS "sourceKey",d.title,d.canonical_url AS url,d.revision_key AS revision,
    d.published_at AS "sourceTimestamp",d.fetched_at AS "fetchedAt",d.content_hash AS "sourceContentHash",
    d.state::text AS "sourceState",s.id AS "snapshotId",s.label AS "snapshotLabel",
    s.manifest_hash AS "snapshotContentHash",s.complete AS "snapshotComplete",
    r.domain,r.id AS "runId",r.status::text AS "runStatus",r.finished_at AS "runFinishedAt",
    (SELECT count(*)::integer FROM snapshot_sources all_links WHERE all_links.source_id=d.id) AS "snapshotLinkCount",
    (SELECT count(*)::integer FROM activity_evidence_ingestion_lineage statement_links JOIN activity_evidence a ON a.id=statement_links.activity_evidence_id WHERE statement_links.ingestion_run_id=r.id AND a.source_id=d.id) AS "directStatementCount"
  FROM data_sources d
  JOIN snapshot_sources ss ON ss.source_id=d.id
  JOIN data_snapshots s ON s.id=ss.snapshot_id
  LEFT JOIN ingestion_runs r ON r.content_hash=s.manifest_hash
)
SELECT json_build_object(
  'contract',${textLiteral(LOCAL_EVIDENCE_CATALOG_CONTRACT)},
  'view','lineage',
  'rows',COALESCE(json_agg(row_to_json(q)),'[]'::json)
) FROM (
  SELECT * FROM lineage ${filter}
  ORDER BY "snapshotLinkCount" DESC,"sourceKey",revision,"runFinishedAt" DESC NULLS LAST
  LIMIT ${limit}
) q;`;
}

function blockersQuery({limit}) {
  return `WITH blockers AS (
  SELECT blocker,'ingestion_record'::text AS origin FROM ingestion_records r
  CROSS JOIN LATERAL jsonb_array_elements_text(r.findings) AS f(blocker)
  UNION ALL
  SELECT blocker,'evidence_statement'::text AS origin FROM activity_evidence a
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(a.parsed_value->'blockers','[]'::jsonb)) AS f(blocker)
  UNION ALL
  SELECT rule_key,'validation_finding'::text FROM validation_findings WHERE resolved_at IS NULL
)
SELECT json_build_object(
  'contract',${textLiteral(LOCAL_EVIDENCE_CATALOG_CONTRACT)},
  'view','blockers',
  'rows',COALESCE(json_agg(row_to_json(q)),'[]'::json)
) FROM (
  SELECT blocker,origin,count(*)::integer AS occurrences
  FROM blockers GROUP BY blocker,origin ORDER BY count(*) DESC,blocker,origin LIMIT ${limit}
) q;`;
}

export function buildCatalogSql(options = {}) {
  const normalized = normalizeCatalogOptions(options);
  const query = normalized.view === 'summary' ? summaryQuery()
    : normalized.view === 'skills' ? skillsQuery(normalized)
      : normalized.view === 'sources' ? sourcesQuery(normalized)
        : normalized.view === 'blockers' ? blockersQuery(normalized)
          : normalized.view === 'domains' ? domainsQuery(normalized)
            : lineageQuery(normalized);
  return `BEGIN TRANSACTION READ ONLY;\nSET LOCAL statement_timeout='15s';\n${query}\nCOMMIT;\n`;
}

export function assertReadOnlyCatalogSql(sql) {
  assert(/^BEGIN TRANSACTION READ ONLY;/m.test(sql), 'catalog_transaction_not_read_only');
  assert(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|COPY|CALL|DO)\b/i.test(sql), 'catalog_sql_contains_mutation');
  return true;
}

export function assessCatalogSummary(payload) {
  assert(payload?.contract === LOCAL_EVIDENCE_CATALOG_CONTRACT && payload?.view === 'summary', 'catalog_summary_contract_invalid');
  const counts = payload.counts || {};
  const metrics = payload.latestIngestion?.metrics || {};
  const integrityBlockers = [];
  if (Number(counts.skills) !== 24) integrityBlockers.push('official_skill_count_not_24');
  if (Number(counts.wikiSourcesMissingRevision) > 0 || Number(counts.wikiSources) !== Number(counts.revisionPinnedWikiSources)) integrityBlockers.push('wiki_source_revision_missing');
  if (Number(counts.completeSnapshots) > 0 && metrics.completeActivityUniverse === false) integrityBlockers.push('incomplete_inventory_marked_complete');
  if (Number(counts.optimizerEligibleStatements) > 0 && Number(payload.evidenceStates?.verified || 0) === 0) integrityBlockers.push('unverified_statement_optimizer_eligible');
  if (Number(counts.evidenceStatementLineageRows) !== Number(counts.evidenceStatements) || Number(counts.unlinkedEvidenceStatements) !== 0) integrityBlockers.push('evidence_statement_lineage_incomplete');
  const knowledgeBlockers = (payload.topBlockers || []).map(row => ({blocker:row.blocker,occurrences:Number(row.occurrences)}));
  if (metrics.completeActivityUniverse === false) knowledgeBlockers.unshift({blocker:'complete_activity_universe_not_proven',occurrences:1});
  return {
    runtimeStatus:'healthy',
    catalogIntegrity:integrityBlockers.length ? 'error' : 'healthy',
    knowledgeReadiness:knowledgeBlockers.length ? 'blocked' : 'ready',
    optimizerReady:knowledgeBlockers.length === 0 && Number(counts.optimizerEligibleStatements) > 0,
    integrityBlockers,
    knowledgeBlockers
  };
}

export function assertCatalogPayload(payload, expectedView) {
  assert(payload?.contract === LOCAL_EVIDENCE_CATALOG_CONTRACT, 'catalog_payload_contract_invalid');
  assert(payload?.view === expectedView, 'catalog_payload_view_mismatch');
  if (expectedView === 'summary') return assessCatalogSummary(payload);
  assert(Array.isArray(payload?.rows), 'catalog_payload_rows_missing');
  if (expectedView === 'domains') {
    for (const row of payload.rows) {
      assert(typeof row?.domain === 'string' && row.domain.length > 0, 'catalog_domain_identity_missing');
      assert(row?.recordCountReconciles === true && row?.sourceCountReconciles === true && row?.statementCountReconciles === true, 'catalog_domain_counts_do_not_reconcile');
      assert(typeof row?.snapshotComplete === 'boolean' && Number.isInteger(Number(row?.recordCount)) && Number.isInteger(Number(row?.sourceCount)), 'catalog_domain_state_invalid');
      assert(Number.isInteger(Number(row?.declaredStatementCount)) && Number(row?.directStatementCount) === Number(row?.declaredStatementCount) && row?.statementLineageState === 'direct_activity_evidence_ingestion_run_foreign_key', 'catalog_domain_statement_lineage_invalid');
    }
  }
  if (expectedView === 'lineage') {
    for (const row of payload.rows) {
      assert(typeof row?.sourceKey === 'string' && row.sourceKey.length > 0, 'catalog_lineage_source_identity_missing');
      assert(typeof row?.url === 'string' && row.url.length > 0, 'catalog_lineage_source_url_invalid');
      assert((row?.revision === null || typeof row?.revision === 'string') && typeof row?.sourceContentHash === 'string' && /^[a-f0-9]{64}$/.test(row.sourceContentHash), 'catalog_lineage_revision_identity_invalid');
      assert(typeof row?.domain === 'string' && row.domain.length > 0 && row?.snapshotId && row?.runId, 'catalog_lineage_domain_binding_missing');
      assert(Number(row?.snapshotLinkCount) >= 1, 'catalog_lineage_link_count_invalid');
      assert(Number(row?.directStatementCount) >= 0, 'catalog_lineage_statement_count_invalid');
    }
  }
  return true;
}

export function formatCatalogText(payload) {
  if (payload.view === 'summary') {
    const health = assessCatalogSummary(payload), c = payload.counts, states = payload.evidenceStates || {};
    return [
      'Sensum V4 local evidence catalog',
      `Runtime: ${health.runtimeStatus} | Catalog integrity: ${health.catalogIntegrity} | Knowledge readiness: ${health.knowledgeReadiness}`,
      `${c.skills} skills | ${c.revisionPinnedWikiSources}/${c.wikiSources} revision-pinned Wiki sources | ${c.ingestionRecords} raw records | ${c.evidenceStatements} evidence statements`,
      `${states.candidate || 0} candidate | ${states.verified || 0} verified | ${c.optimizerEligibleStatements} optimizer eligible`,
      `Complete snapshots: ${c.completeSnapshots} | Open validation findings: ${c.openValidationFindings} | Explicit blocker occurrences: ${c.explicitBlockerOccurrences}`,
      ...health.knowledgeBlockers.slice(0, 10).map(row => `BLOCKED: ${row.blocker} (${row.occurrences})`)
    ].join('\n');
  }
  const rows = payload.rows || [];
  if (!rows.length) return `Sensum V4 ${payload.view}: no rows`;
  if (payload.view === 'domains') return [`Sensum V4 evidence domains (${rows.length})`, ...rows.map(row => `${row.domain} | ${row.recordCount} records | ${row.sourceCount} sources | ${row.directStatementCount}/${row.declaredStatementCount} directly linked statements | complete=${row.snapshotComplete} | optimizer=${row.optimizerEligibleCount}`)].join('\n');
  if (payload.view === 'lineage') return [`Sensum V4 source lineage (${rows.length})`, ...rows.map(row => `${row.sourceKey} @ ${row.revision} | ${row.domain} | snapshot ${row.snapshotId} | ${row.snapshotLinkCount} linked snapshot${Number(row.snapshotLinkCount) === 1 ? '' : 's'}`)].join('\n');
  return [`Sensum V4 ${payload.view} (${rows.length})`, ...rows.map(row => JSON.stringify(row))].join('\n');
}
