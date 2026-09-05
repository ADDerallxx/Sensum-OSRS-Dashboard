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
node platform/ingestion/ingest-wiki-skill-training-guide-inventory.mjs
node platform/ingestion/ingest-wiki-skill-level-unlock-inventory.mjs
node platform/ingestion/ingest-wiki-unlock-linked-page-identities.mjs
node platform/ingestion/ingest-wiki-unlock-linked-page-source-signatures.mjs
node platform/ingestion/ingest-wiki-skill-training-guide-direct-links.mjs
node platform/ingestion/ingest-wiki-skill-training-guide-source-dependencies.mjs
node platform/ingestion/ingest-wiki-activity-reference-collection-member-repeatability-gap-evidence.mjs
node platform/transforms/build-activity-reference-collection-member-repeatability-gap-dispositions.mjs
node platform/ingestion/ingest-wiki-activity-reference-collection-member-independent-repeatability-source-evidence.mjs
node platform/ingestion/ingest-wiki-activity-reference-collection-member-independent-repeatability-signal-scope-evidence.mjs
node platform/ingestion/ingest-wiki-activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence.mjs
node platform/ingestion/ingest-wiki-activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence.mjs
node platform/ingestion/ingest-wiki-activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence.mjs
node platform/transforms/build-activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-dispositions.mjs
node platform/ingestion/ingest-wiki-activity-infobox-schema-semantics-evidence.mjs
node platform/transforms/build-activity-infobox-schema-semantics-dispositions.mjs
node platform/transforms/build-activity-canonical-subject-scope-evidence-work-routes.mjs
node platform/ingestion/ingest-wiki-activity-canonical-subject-scope-evidence.mjs
node platform/transforms/build-activity-canonical-subject-scope-dispositions.mjs
node platform/transforms/build-unlock-statement-semantic-crosswalk.mjs
node platform/transforms/build-unlock-linked-page-entity-types.mjs
node platform/transforms/build-unlock-linked-page-wiki-equivalence.mjs
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
- Cross-skill guide discovery starts from every official skill and its complete
  revision-pinned base-level domain, then reads the `Has skill guide`
  declaration from each skill page and resolves every declared guide to its own
  Wiki revision. The central `Skill training guides` index is retained as a
  separate comparison source. Composite rows and disagreement between that
  index and direct skill pages remain explicit blockers. A complete guide
  inventory is only a discovery foundation: training guides prioritize useful
  methods and can never, by themselves, prove that every repeatable in-game
  training activity has been enumerated.
- Cross-skill level-up-table discovery captures every top-level source parameter
  and every bullet statement from each of the 24 revision-pinned skill tables.
  Empty parameters, membership scope, source level, multiline text, links, and
  exact locators remain visible. These are raw discovery statements only:
  leading verbs and links do not establish a canonical activity, repeatability,
  XP mechanics, or optimizer eligibility. Semantic classification and a broader
  independent universe closure remain separate fail-closed gates.
- Cross-skill unlock semantic routing uses a versioned policy that must account
  for every observed leading form exactly once. A role describes only the
  statement's surface form; action-shaped statements remain discovery
  candidates and cannot become canonical, repeatable, mechanically complete, or
  optimizer-eligible from wording alone. Every explicit linked target is
  resolved independently to revision-pinned Wiki page metadata with redirects
  preserved. Page resolution does not establish entity type or activity
  identity, and unresolved statement forms remain measurable blockers.
- Linked-page source-signature ingestion retrieves the complete current source
  for every revision-pinned resolved page, verifies that the retrieved revision
  still matches the identity snapshot, and records stable official Wiki page
  IDs, content hashes, exact root-template and direct-category locators, and the
  original alias, fragment, redirect, skill, and statement contexts. Source
  structure is discovery evidence only: it cannot establish a canonical entity, activity,
  repeatability, mechanics, or optimizer eligibility. Revision drift remains a
  visible alignment blocker rather than being silently accepted.
- Page-type routing uses exact root-template evidence first. Only a page with no
  mapped root-template type may use an exact, policy-mapped direct category as a
  fallback. Category routing cannot override a root type or establish canonical
  identity, repeatability, mechanics, or optimizer eligibility.
- Training-guide direct-link ingestion fetches every declared guide at its
  retained revision, preserves each direct source wikilink with its line and
  guide-content hash, and resolves main-namespace targets to stable Wiki page
  IDs. Comments, literal-code regions, dynamic targets, non-main namespaces,
  and in-page fragments remain explicitly distinguished. Missing source links,
  template-generated links, and unlinked semantic mentions stay visible as
  blockers; exact link overlap never proves a canonical or repeatable activity.
- Training-guide source-dependency ingestion preserves nested direct template
  invocations with guide revision, content hash, line, and raw source. It keeps
  page transclusions, template transclusions, parser functions, magic words,
  and dynamic names distinct. Current template/module page revisions are only
  discovery provenance: they cannot close the historical render dependency
  graph or establish the links a template emitted. Missing direct links are
  checked against current guide heads and official search results, but candidate
  titles remain manual-review evidence with `automaticReplacement: null`.
- Training-guide rendered-link ingestion parses every retained guide `oldid`
  through the official Wiki API and preserves links, categories, images, and
  template dependencies as distinct parser channels. It resolves every target
  at observation time and reconciles all eligible direct-source guide/target
  pairs, but it does not treat a current target or dependency revision as the
  historical transclusion revision. Rendered-only links retain unattributed
  origin and remain semantically blocked from optimizer use.
- Stable Wiki-page equivalence groups those typed references only when their
  official page ID and revision-bound evidence agree. Every original target and
  its statement context remains present. This removes duplicate page fetches;
  it does not merge section semantics, establish a canonical game entity or
  activity, prove repeatability, or make anything optimizer eligible.
- Activity-candidate source-evidence ingestion fetches the 29 currently queued
  activity pages by exact retained revision ID. It preserves all same-page
  alias/redirect contexts, balanced activity/minigame infobox parameters, lead
  paragraphs, every heading, and source-located lexical review candidates.
  Page type and lexical matches remain discovery evidence only; semantic
  identity, repeatability, mechanics, and optimizer eligibility require later
  evidence-bound review.
- Repeatability-gap evidence ingestion expands only blocked structural-signal
  routes. Candidate pages must be linked on the exact source line containing the
  unresolved recurrence/session signal or from the exact retained collection
  row. Every main-namespace candidate is resolved to its current official Wiki
  revision, redirects collapse by stable page ID without losing discovery
  contexts, and already scanned source pages remain explicit exclusions. Full
  candidate revisions are scanned with the existing repeatability policy, but
  links and lexical matches remain review evidence and create no verdict.
- Independent repeatability-source ingestion exhausts exact canonical-label
  source searches and main-namespace backlinks to the stable linked subject.
  Every candidate is pinned to a current official Wiki revision and every
  source-authored link is retained. Search rank, snippets, backlink presence,
  page names, and lexical signals remain discovery-only observations.
- Independent repeatability signal-scope ingestion selects only
  source-authored main-namespace links occurring on each exact retained signal
  line. Every target is resolved to a stable page ID and current revision;
  redirects preserve every occurrence context. A target match or missing link
  cannot create canonical-activity scope, repeatability, member, mechanics, or
  optimizer conclusions.
- Canonical-activity subject-declaration exact-line ingestion refetches every
  discovery candidate at its retained revision and inventories every literal
  canonical-label occurrence with exact lines, columns, source text, hashes,
  and same-line link keys. Comments and protected regions remain visible but
  non-active. A phrase occurrence, link, title, template parameter, heading,
  table cell, redirect, or incidental mention never establishes the declared
  subject, activity scope, repeatability, mechanics, or optimizer eligibility;
  those require a separate structural-context and semantic disposition.
- Canonical-activity subject-declaration structural-context ingestion refetches
  those same retained revisions, revalidates every exact occurrence by named
  locator fields rather than JSON property order, and preserves its heading,
  lead, source-block, list, table-row, link-segment, template, parameter, and
  protected-region context. Balanced source delimiters are mandatory. All
  structures remain observations only and cannot create a subject binding,
  activity-scope or repeatability verdict, member or mechanics review, or
  optimizer eligibility without a separate semantic disposition.
- Canonical-activity subject-declaration structural-context disposition assigns
  every occurrence exactly one generic evidence-use class. Only an active,
  exact-case, pre-heading activity-infobox `name` value on a dynamically title-
  aligned source becomes a page-subject candidate, and that candidate remains
  unbound until the infobox schema semantics are revision-pinned. Title-aligned
  supporting occurrences, cross-page links, cross-page mentions, and protected
  text cannot independently bind the subject. No-candidate records remain
  unresolved and route to independent discovery rather than becoming negative
  existence verdicts.
- Canonical-activity subject-declaration semantic evidence-work routing consumes
  only complete structural-context dispositions and routes solely by their
  generic disposition state. Schema-dependent candidates require pinned
  activity-infobox field semantics; records without a qualified candidate
  require independent canonical subject-page discovery; multiple candidates
  require reconciliation. Run
  `node platform/transforms/build-activity-reference-collection-member-canonical-activity-subject-declaration-semantic-evidence-work-routes.mjs`.
  The router preserves every upstream evidence hash, structural signal, and
  review value while keeping subject binding, scope, repeatability, members,
  mechanics, and optimizer eligibility closed.
- Activity-infobox schema-semantics ingestion fetches the current exact revisions
  of `Template:Infobox Activity`, its `/doc` subpage, and
  `Module:Infobox Activity`. It source-locates the template invocation and doc
  transclusion, the documented `name` meaning, and the module's `name` handler,
  infobox identity, and header rendering. Run
  `node platform/ingestion/ingest-wiki-activity-infobox-schema-semantics-evidence.mjs`.
  Missing, duplicate, changed, unpinned, or namespace-mismatched evidence stays
  blocked. Complete schema evidence still requires a separate semantic
  disposition and cannot independently bind the page subject.
- Activity-infobox schema-semantics disposition binds a canonical activity
  subject only when exactly one structurally qualified candidate passes all ten
  structural checks, its label, source title, and infobox `name` value align
  exactly, and all seven revision-pinned schema observations occur exactly once.
  Run `node platform/transforms/build-activity-infobox-schema-semantics-dispositions.mjs`.
  The disposition promotes only the canonical subject declaration; activity
  scope, repeatability, membership, requirements, XP, timing, mechanics, and
  optimizer eligibility remain separate evidence gates.
- Canonical-activity subject scope-evidence routing consumes only complete,
  source-supported subject bindings and routes each exactly once to six generic,
  revision-pinned scope-evidence obligations. Run
  `node platform/transforms/build-activity-canonical-subject-scope-evidence-work-routes.mjs`.
  Page type, identity, and the existence of an activity infobox do not establish
  training scope or repeatability. The route preserves the complete upstream
  binding and remains blocked from scope, repeatability, member, mechanics, and
  optimizer promotion until separate evidence work passes.
- Canonical-activity subject scope-evidence ingestion refetches each routed
  subject at the exact revision retained by its binding. It preserves the
  complete source text plus activity-infobox, lead-paragraph, heading, root-
  template, direct-category, and line-by-line hash inventories. All six routed
  evidence domains and eight capture channels must be complete. These are
  observations only: scope, repeatability, members, requirements, XP, timing,
  mechanics, and optimizer eligibility remain blocked until separate semantic
  disposition and downstream evidence gates pass.
- Canonical-activity subject scope disposition applies generic exact-line signal
  rules to a complete scope packet. The current rule distinguishes a composite,
  conditionally assigned task activity only when all five source signals occur
  exactly once, including the source-authored positive task count and explicit
  non-exhaustive-list warning. Missing or duplicate signals publish a blocked
  disposition rather than a guessed scope. A successful scope classification
  still cannot establish repeatability, member completeness, mechanics, or
  optimizer eligibility.
- Scoped canonical-activity repeatability evidence-work routing consumes only a
  reviewed, source-supported scope disposition and routes it exactly once to six
  generic evidence obligations. Run
  `node platform/transforms/build-scoped-canonical-activity-repeatability-evidence-work-routes.mjs`.
  Parent recurrence, member recurrence, cooldowns/resets, finite exhaustion,
  future cross-session availability, and independent corroboration remain
  separate. Plural tasks, declared counts, non-exhaustive lists, names, titles,
  page IDs, and account state cannot select the route or produce a repeatability
  verdict. Publication proves only complete deterministic routing; it does not
  make the activity, its members, or its mechanics optimizer-eligible.
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
