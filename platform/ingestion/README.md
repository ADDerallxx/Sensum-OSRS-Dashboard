# V4 ingestion

The ingestion layer stages immutable source snapshots before anything reaches
the canonical tables. Generated snapshots live under `.platform-data/` and are
not committed.

## Commands

```text
node platform/ingestion/ingest-ge.mjs
node platform/ingestion/ingest-wiki-domain.mjs --domain=equipment
node platform/ingestion/ingest-wiki-domain.mjs --domain=monsters
node platform/ingestion/ingest-wiki-domain.mjs --domain=recipes
node platform/ingestion/audit-local-catalogs.mjs
```

Each run writes newline-delimited records and a manifest containing the source,
record count, creation time, audit result, and SHA-256 content hash.

## Publication rules

- A failed fetch never replaces a prior validated snapshot.
- HTTP 429 and transient server errors use throttled exponential backoff.
- Every Wiki staging record retains its page URL and revision ID.
- Missing required fields, excess unknowns, or insufficient record counts block
  publication.
- Staging success means the source was captured completely; canonical
  transformation and formula validation are separate gates.
- Legacy fallback or review records remain quarantined until independently
  sourced and validated.

