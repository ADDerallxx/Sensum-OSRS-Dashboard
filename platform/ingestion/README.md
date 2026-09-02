# V4 ingestion

The ingestion layer stages immutable source snapshots before anything reaches
the canonical tables. Generated snapshots live under `.platform-data/` and are
not committed.

## Commands

```text
node platform/ingestion/ingest-ge.mjs
node platform/ingestion/ingest-wiki-domain.mjs --domain=item-identities
node platform/ingestion/ingest-wiki-domain.mjs --domain=equipment
node platform/ingestion/ingest-wiki-domain.mjs --domain=monsters
node platform/ingestion/ingest-wiki-domain.mjs --domain=recipes
node platform/ingestion/audit-local-catalogs.mjs
node platform/ingestion/ingest-activity-evidence.mjs --limit=100
node platform/ingestion/ingest-activity-family-evidence.mjs --family=agility_course
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
- Activity evidence is captured from revision-pinned Wiki source. Keyword
  fragments are discovery aids only; they remain candidates until exact values,
  source locators, formulas, and model vectors pass the activity evidence gate.
