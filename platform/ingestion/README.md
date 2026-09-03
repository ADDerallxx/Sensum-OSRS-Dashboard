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
node platform/ingestion/ingest-wiki-agility-course-table.mjs
node platform/ingestion/ingest-wiki-agility-variants.mjs
node platform/ingestion/ingest-wiki-hallowed-sepulchre-variants.mjs
node platform/ingestion/ingest-wiki-agility-modifier-variants.mjs
node platform/ingestion/ingest-wiki-agility-route-variants.mjs
node platform/ingestion/ingest-wiki-agility-shortcut-variants.mjs
node platform/ingestion/ingest-wiki-agility-condition-variants.mjs
node platform/ingestion/ingest-wiki-agility-access-variants.mjs
node platform/ingestion/ingest-wiki-hallowed-equipment-modifiers.mjs
node platform/ingestion/ingest-wiki-agility-training-guide.mjs
node platform/ingestion/ingest-wiki-agility-rooftop-observed-variants.mjs
node platform/ingestion/ingest-wiki-agility-floor-spike-training-variants.mjs
node platform/ingestion/ingest-wiki-agility-barbarian-fishing-variants.mjs
node platform/ingestion/ingest-wiki-agility-pyramid-variants.mjs
```

Each run writes newline-delimited records and a manifest containing the source,
record count, creation time, audit result, and SHA-256 content hash.

## Publication rules

- A failed fetch never replaces a prior validated snapshot.
- HTTP 429 and transient server errors use throttled exponential backoff.
- Every Wiki staging record retains its page URL and revision ID.
- Evidence fragments retain the complete matched source line; the manifest
  records the extractor version so source text is never silently cut without a
  traceable format change.
- Missing required fields, excess unknowns, or insufficient record counts block
  publication.
- A structurally complete record with contradictory source claims remains in a
  publishable snapshot as `blocked` evidence. This prevents an older clean-looking
  snapshot from hiding current source drift; downstream verification must retain
  the exact conflict and cannot rank or approve the record.
- Staging success means the source was captured completely; canonical
  transformation and formula validation are separate gates.
- Legacy fallback or review records remain quarantined until independently
  sourced and validated.
- Activity evidence is captured from revision-pinned Wiki source. Keyword
  fragments are discovery aids only; they remain candidates until exact values,
  source locators, formulas, and model vectors pass the activity evidence gate.
- Floor-spike success evidence keeps the generic Wiki interpolation formula
  separate from obstacle-specific inputs. A page marked `Needs skilling success
  chart` publishes neither the low nor high roll parameter, so ingestion retains
  `success_interpolation_low_high_parameters_not_published` and never substitutes
  the level-50 no-failure threshold for a level-34 probability.
