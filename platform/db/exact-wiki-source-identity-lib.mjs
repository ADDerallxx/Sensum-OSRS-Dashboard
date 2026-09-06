const hex = value => Buffer.from(String(value), 'utf8').toString('hex');
const sqlText = value => `convert_from(decode('${hex(value)}','hex'),'UTF8')`;

export function exactWikiSourceIdentityKey(source) {
  return `${source.sourceUrl}|${source.sourceRevision}`;
}

export function buildExistingExactWikiSourceCountQuery(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return 'SELECT 0;';
  const values = sources.map(source => `(${sqlText(source.sourceUrl)},${sqlText(source.title)},${sqlText(source.providerKey)},${sqlText(String(source.sourceRevision))},${sqlText(source.sourceTimestamp)}::timestamptz,${sqlText(source.sourceContentHash)})`).join(',');
  return `WITH expected(source_url,title,provider_key,source_revision,published_at,content_hash) AS (VALUES ${values}) SELECT count(*) FROM expected e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.title=e.title AND d.provider_key=e.provider_key AND d.revision_key=e.source_revision AND d.published_at=e.published_at AND d.content_hash=e.content_hash AND d.fetched_at IS NOT NULL AND d.state IN ('review','verified');`;
}

export function exactWikiSourceReconciliationPredicate(expectedAlias = 'e', sourceAlias = 'd') {
  return `${sourceAlias}.kind='osrs_wiki' AND ${sourceAlias}.canonical_url=${expectedAlias}.source_url AND ${sourceAlias}.title=${expectedAlias}.title AND ${sourceAlias}.provider_key=${expectedAlias}.provider_key AND ${sourceAlias}.revision_key=${expectedAlias}.source_revision AND ${sourceAlias}.published_at=${expectedAlias}.published_at AND ${sourceAlias}.content_hash=${expectedAlias}.content_hash AND ${sourceAlias}.fetched_at IS NOT NULL AND ${sourceAlias}.state IN ('review','verified')`;
}
