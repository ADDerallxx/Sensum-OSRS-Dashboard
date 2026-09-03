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
node platform/ingestion/ingest-wiki-agility-training-guide-sections.mjs
node platform/ingestion/ingest-wiki-agility-rooftop-guide-members.mjs
node platform/ingestion/ingest-wiki-agility-brimhaven-guide-members.mjs
node platform/ingestion/ingest-wiki-agility-rockslide-guide-members.mjs
node platform/ingestion/ingest-wiki-agility-colossal-wyrm-guide-members.mjs
node platform/ingestion/ingest-wiki-agility-rooftop-observed-variants.mjs
node platform/ingestion/ingest-wiki-agility-floor-spike-training-variants.mjs
node platform/ingestion/ingest-wiki-agility-barbarian-fishing-variants.mjs
node platform/ingestion/ingest-wiki-agility-pyramid-variants.mjs
node platform/ingestion/ingest-wiki-skill-level-domains.mjs
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
  `success_interpolation_low_high_parameters_not_published` for every query in
  the failing range. Reusable evidence stores no account level: evaluation uses
  the level-50 no-failure threshold only for queries at or above level 50.
- Skill-domain ingestion reads the official Skills page instead of hard-coding
  a player-specific range. The declared skill count must match all four parsed
  skill categories. The source's Hitpoints starting exception, level-99 maximum,
  and base/effective-level distinction remain revision-located; a partial list or
  missing domain statement makes the snapshot unpublishable.
- Training-guide section ingestion inventories every Wiki heading in source
  order. Every method-bearing subsection is retained with its parent, source
  lines, revision, and structural role. New heading depths or parents fail
  closed, while a new method section automatically becomes a named candidate-
  parser coverage gap rather than disappearing silently.
- Training-guide candidate expansion is fail-closed across all nine formerly
  uncovered material sections. It emits ten candidates because the Colossal Wyrm
  basic and advanced routes remain separate. Natural and boosted entry levels,
  effective-level requirements, exact-level observations, upper bounds, hybrid
  incremental rates, unresolved rate scopes, quests, and equipment requirements
  remain distinct fields. A missing expected section blocks publication rather
  than silently shrinking the universe.
- Rooftop guide-member ingestion expands the revision-pinned collection table
  into its nine ordered course identities. Missing, new, duplicate, or reordered
  rows block publication. The guide's recommended level labels remain source
  labels rather than being promoted to eligibility formulas.
- Early-Brimhaven guide-member ingestion expands the composite level 20–47
  section into its three ordered strategy identities: repeated floor spikes,
  every-pillar tagging with floor spikes during downtime, and detached-camera
  floor spikes. Exact-level observations stay exact-level, the unpublished
  glove-adjusted hourly rate is not synthesized, and optional ticket-dispenser
  tagging remains a separate unquantified policy axis. Added, removed, duplicate,
  reordered, or structurally changed section paragraphs block publication.
- Hallowed Sepulchre member coverage reuses the revision-pinned floor/policy and
  equipment snapshots. Five maximum floors crossed with two looting policies
  remain ten independent decision members, while thirteen encounter equipment
  records remain non-method modifiers or requirements. Their detail-page
  revision is never substituted for the separate training-guide revision.
- Rockslide guide-member ingestion records the core detour and every explicitly
  named pairing from the pinned guide revision. Its open-ended “other
  activities” language remains a coverage limitation; named examples never
  become proof of a complete pairing universe.
- Colossal Wyrm guide-member ingestion requires two route identities across the
  training guide, course page, Agility overview, and official update notes. It
  publishes contradictory values as separate evidence claims: the obsolete
  marker, three Advanced hourly rates, two lap-XP totals per route, and two
  Advanced timings remain visible rather than being reconciled by guesswork.
- Al Kharid multi-obstacle evidence V2 stores the two failing obstacle identities,
  successful XP, damage, requirements, timing, source revisions, and stable
  unknown-model states without storing an account level. Level-numbered missing
  probability blockers are derived only by the downstream coverage query.
