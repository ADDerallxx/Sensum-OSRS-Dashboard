# Canonicalization

## Level-unlock-corpus absence reconciliation work queue

`export-cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue.mjs`
revalidates the complete rendered-page/no-unlock source queue against the
stable page-ID crosswalk, every pinned official skill level-up table, and the
complete unlock-linked-page equivalence corpus. It proves only the narrow
machine observation that each queued stable page ID occurs zero times in that
exact corpus.

The exporter also proves that every raw level-up-table statement/target
relationship is preserved exactly once in the equivalence corpus. It emits a
machine queue, readable TSV, complete corpus-evidence summary, and blank review
decisions. Absence from this corpus never means that no requirement exists:
semantic relevance, requirements outside level-up tables, canonical identity,
repeatability, mechanics, and optimizer eligibility all remain blocked. A
separate fail-closed importer is required before any human reconciliation can
be recorded.

Run:

```text
node platform/transforms/export-cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue.mjs
```

## Collection-activity identity evidence

`build-activity-reference-collection-member-collection-activity-identity-evidence.mjs`
builds one review packet for every exact source-relationship disposition. Each
packet preserves every collection row cell and direct wikilink with its source
locator, the exact linked source revision, and every matched source-role
declaration. Irregular table headers cannot discard evidence.

Stable page alignment and shared link targets are candidate observations only.
The transform cannot create a collection-activity identity, a linked-subject
relationship, repeatability, mechanics, or optimizer eligibility. Its audit
fails if evidence is removed, account state appears, a page-specific override is
introduced, or any identity or relationship verdict is injected.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-collection-activity-identity-evidence.mjs
```

## Collection-activity identity disposition

`build-activity-reference-collection-member-collection-activity-identity-dispositions.mjs`
applies a generic dual-source rule to the identity packets. A supported
collection activity candidate requires source-located label and narrative
evidence, stable member-link and page/revision/hash alignment, and at least one
matched independent source-role declaration. Narrative evidence is selected
without consulting logical table headers.

Supported results remain collection-defined candidates rather than canonical
activities. Missing obligations stay unresolved, source-role conflicts remain
blocked, and multiple identity classes remain a conflict. Linked-subject
relationships, canonical identity, repeatability, members, mechanics, and
optimizer eligibility remain closed.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-collection-activity-identity-dispositions.mjs
```

## Linked-subject relationship disposition

`build-activity-reference-collection-member-linked-subject-relationship-dispositions.mjs`
classifies the exact relationship between a supported collection-defined
activity candidate and its independently sourced linked subject. Generic rules
map a source-declared component, task provider, or task-assignment activity to
its distinct relationship semantics. Every supported result requires the
completed collection-activity identity review, retained source declarations,
dual-source identity evidence, and stable linked-source alignment.

Titles, labels, page IDs, aliases, and collection classes cannot select or alter
a relationship. The linked subject is never equated with the canonical
activity. Canonical identity, repeatability, member expansion, mechanics, and
optimizer eligibility remain closed.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-linked-subject-relationship-dispositions.mjs
```

## Canonical-activity identity evidence

`build-activity-reference-collection-member-canonical-activity-identity-evidence.mjs`
assembles one revision-pinned identity-review packet for every supported linked-
subject relationship. It retains the exact collection source and row, the
source-selected narrative cells, direct row links, source-role declarations,
collection-identity and linked-relationship signals, and stable cross-source
alignment.

An exact normalized collection-label/source-title match is explicitly only a
review observation. The packet leaves the canonical-activity verdict null and
cannot promote canonical identity, repeatability, members, mechanics, or
optimizer eligibility. Missing evidence makes the packet non-publishable.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-canonical-activity-identity-evidence.mjs
```

## Canonical-activity identity disposition

`build-activity-reference-collection-member-canonical-activity-identity-dispositions.mjs`
applies generic relationship-class rules to complete identity-evidence packets.
Its stable key combines only the collection page ID, linked-subject page ID, and
reviewed relationship class. Display labels, titles, aliases, source revisions,
row positions, and member keys are not identity selectors.

Duplicate stable anchors and competing identity classes remain blocked. A
supported canonical activity explicitly records that its linked component,
provider, or descriptive page is not the activity itself. Repeatability,
members, mechanics, and optimizer eligibility remain unreviewed.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-canonical-activity-identity-dispositions.mjs
```

## Canonical-activity repeatability evidence

`ingest-wiki-activity-reference-collection-member-repeatability-evidence.mjs`
refetches the complete linked source at the exact revision retained by each
supported canonical activity. Page ID, title, timestamp, URL, and content hash
must all align. The exact retained collection row is scanned independently, so
the evidence boundary is the full linked source plus its source-located
collection definition rather than only previously extracted lead text.

The generic policy separates explicit positive declarations, explicit negative
declarations, recurrence structures, and session boundaries. Comments and
protected source regions are masked without changing source offsets. Every
match remains a review candidate with exact source locations and hashes;
session or recurrence language is not repeatability proof, no-match is not a
negative verdict, and positive/negative candidates remain a visible conflict.
This evidence stage creates no repeatability, member, mechanics, or optimizer
promotion.

Run:

```text
node platform/ingestion/ingest-wiki-activity-reference-collection-member-repeatability-evidence.mjs
```

## Canonical-activity repeatability disposition

`build-activity-reference-collection-member-repeatability-dispositions.mjs`
applies two generic rules: one for an explicit positive declaration and one for
an explicit negative declaration. A declaration supports a classification only
when its exact source range and hash overlap an already reviewed linked-source
role declaration or an exact collection narrative cell tied to the canonical
activity. Names, IDs, labels, aliases, and collection classes cannot select a
rule.

Opposing declarations remain a conflict. An explicit but unscoped declaration
remains unresolved. Recurrence structures, session boundaries, and missing
matches remain insufficient and cannot establish either repeatability or non-
repeatability. The disposition attempt is publishable with explicit unresolved
records, while member expansion, mechanics, and optimizer eligibility stay
closed.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-repeatability-dispositions.mjs
```

## Canonical-activity repeatability evidence-work routing

`build-activity-reference-collection-member-repeatability-evidence-work-routes.mjs`
maps every state the repeatability disposition stage can emit to one generic
evidence obligation. Supported repeatable activities enter member-boundary,
cycle, requirements, variants, XP, timing, mechanics, and travel/resource
review. Supported non-repeatable activities enter authoritative exclusion-scope
review and are not automatically excluded.

Conflicts, incomplete packets, unscoped declarations, recurrence/session-only
evidence, and no-signal results retain blocked route states. The policy cannot
use activity names, titles, page IDs, candidate keys, labels, aliases, or
collection classes. Routing preserves the upstream repeatability decision and
cannot review members or mechanics, promote optimizer eligibility, or convert
an evidence obligation into a game fact.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-repeatability-evidence-work-routes.mjs
```

## Independent repeatability signal-scope disposition

`build-activity-reference-collection-member-independent-repeatability-signal-scope-dispositions.mjs`
applies one generic structural disposition to every exact signal-scope evidence
packet. An absent exact-line link cannot establish that a signal is out of
scope. An exact-line link without a reviewed stable activity identity anchor
cannot establish scope. Even a stable-anchor observation remains blocked until
separate authoritative evidence binds the repeatability predicate to the exact
canonical activity subject.

The policy forbids activity names, titles, page IDs, labels, aliases, and
per-activity overrides. Every scope and repeatability classification remains
null, while member expansion, mechanics, and optimizer eligibility stay closed.
Unresolved dispositions are publishable because they precisely identify the
missing evidence without inventing a game fact.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-independent-repeatability-signal-scope-dispositions.mjs
```

## Independent signal-scope evidence-work routing

`build-activity-reference-collection-member-independent-repeatability-signal-scope-evidence-work-routes.mjs`
maps every signal-scope disposition state to one generic evidence obligation.
Incomplete packets route only to repair. Signals without an exact-line link
route to source-bound canonical-activity subject and repeatability-predicate
evidence. Linked signals without a reviewed stable activity anchor route to
identity resolution followed by semantic binding, while an observed anchor
without binding routes directly to exact subject-predicate review.

Every route remains blocked and describes work rather than a game fact. Route
selection cannot use activity names, titles, page IDs, candidate keys, labels,
aliases, or overrides, and cannot create a scope or repeatability classification.
The audit uses activity-plus-signal composite route keys so shared source signals
cannot merge separate activity candidates.

Run:

```text
node platform/transforms/build-activity-reference-collection-member-independent-repeatability-signal-scope-evidence-work-routes.mjs
```

## Activity-candidate subject disposition

`build-activity-candidate-subject-dispositions.mjs` applies a versioned generic
policy to the revision-pinned activity-candidate evidence packet. It recognizes
only exact mapped infobox `type` values and explicit first-lead declaration
forms. Page IDs, titles, candidate keys, and per-page overrides are forbidden.
Conflicting source signals and unknown infobox types remain blockers.

This layer describes the source subject only. It never creates a canonical game
entity or activity, decides repeatability, expands composite members, structures
mechanics, or authorizes optimizer eligibility.

Run:

```text
node platform/transforms/build-activity-candidate-subject-dispositions.mjs
```

`build-activity-candidate-evidence-work-routes.mjs` maps every supported subject
disposition or blocked source state to one generic review workflow. The router
preserves source identity, revision, hashes, signals, and contexts. Its evidence
domains and expansion axes describe questions that later source work must
answer; they are not verified facts. Conflicts stay blocked, unknown future
states or dispositions fail publication, and no route can create a canonical or
optimizer-eligible activity.

Run:

```text
node platform/transforms/build-activity-candidate-evidence-work-routes.mjs
```

`canonicalize.mjs` converts the newest immutable staging snapshots into
candidate canonical records and a coverage report. It never silently fills a
missing material value.

Canonical records are eligible for later formula evaluation. Quarantined
records retain their source payload, hash, revision, and explicit reasons. A
domain's staging capture may be complete while optimizer coverage is incomplete;
these are intentionally separate gates.

Recipe records expose objective-specific capabilities. XP-rate readiness needs
verified XP and timing; profit-rate readiness additionally needs resolved input
and output identities. A record can support one objective without being falsely
presented as complete for every objective.

Run `node platform/transforms/canonicalize.mjs`.
`activity-readiness.mjs` converts canonical training gaps into a deterministic
enrichment queue. It does not invent action timing or success formulas; records
remain blocked until activity-specific, source-backed vectors are approved.

`build-activity-families.mjs` groups candidate evidence into reusable activity
families and extracts revision-pinned candidate facts. Regex output is never
automatically verified. Observed guide rates are retained separately from the
mechanical inputs used to calculate rates.

Simple lap activities use reusable fact patterns for complete-circuit XP,
minimum or average lap seconds, and practical average hourly rates. Source
seconds remain seconds unless the Wiki independently states exact game ticks;
Sensum never manufactures fractional ticks from a rounded time. A minimum lap
time produces a mechanical upper bound, which may validly exceed a practical
average but must block if the observation materially exceeds that bound. This
currently makes Gnome Stronghold revision 15290118 reviewable at level 1 with
110.5 XP per lap, a 34-second minimum, no failures, and an approximate practical
rate of 10,000 XP/hour.

`generate-golden-activity-vectors.mjs` builds reviewable, scenario-scoped test
vectors from family facts. It checks unit agreement and compares calculated
rates with observed source ranges. Passing vectors remain proposed until manual
source review; approval can open only the exact conditions covered by a vector.

`audit-agility-variant-coverage.mjs` scans revision-pinned course evidence for
material floor, route, modifier, shortcut, boost, intensity, and looting axes.
Every unexpanded axis remains an explicit coverage blocker. Variant records
must declare the exact axes they cover; their existence alone cannot clear an
unrelated finding. Hallowed Sepulchre floor and looting variants retain Wiki
rates as observational evidence and never relabel them as calculated mechanics.

`variant-snapshot-lib.mjs` discovers the newest immutable snapshot for every
`*-variants.ndjson` domain. Family classification, coverage auditing, and vector
generation use the same discovery path, so a new variant adapter cannot silently
vanish from one of those stages. Rooftop diary variants keep XP and reward-rate
effects separate, and approximate teleport timings remain calculation blockers.
Discovery accepts only snapshots whose manifest, record count, content hash, and
source audit all pass; rejected newer snapshots remain reported and cannot mask
the latest valid immutable snapshot.

Route variants keep Dorgesh-Kaan's Agility, grapple, and mixed rewards separate,
including their independent skill and equipment requirements. Werewolf
Skullball time ranges remain ranges, and its 1:45 optimal-route result remains a
peak observation rather than a typical cycle-time claim.

Werewolf Skullball revision 15315300 defines a ten-goal player-executed route
whose reward is determined by completion time. Its vectors therefore do not
invent a level-based random failure roll. The three approximate route timings
produce reviewable bounded-cycle rates and remain ineligible for scalar
ranking. The 1:45 result remains blocked as peak-only evidence without a
typical completion-time distribution. Abandoned-attempt frequency is not
stated by the source and remains unknown.

Prifddinas portal shortcuts are modeled as absent, randomly used, and
best-spawn peak conditions. The Wiki's 5–10 second saving remains a range, and
its unscoped 1:14 average lap is not assigned to either portal policy.

Brimhaven conditions keep passive level-40 and level-80 observations separate,
model Karamja gloves and the elite diary independently, and distinguish base
Agility from the boosted effective level used for the level-100 pillar reward.
The active-rate source does not specify a glove state, so the model does not
silently assign one.

Level-specific observations now also retain a stable decision-candidate key.
For Brimhaven, level 40 and level 80 remain separate evidence records but group
under the same exact passive policy (gloves state and diary state). Coverage
audits therefore count four passive policies rather than eight benchmark rows;
grouping never interpolates a missing level-34 rate or clears its blocker.

Detached-camera floor-spike training is split into standard and Karamja-glove
variants using the obstacle page, arena table, and training guide as three
independently revision-pinned sources. Both variants retain the four-tick
crossing and their 24/26.4 XP rewards, but levels 20–49 stay unmodeled because
the obstacle-specific interpolation inputs are unpublished. The V2 variants
carry the reusable success model without a target level or “at target” result;
coverage evaluates that model for each requested base level. At level 50 and
above the direct source threshold resolves failure to zero without inventing
lower-level probabilities.
The guide's approximate 36,000 XP/hour
is scoped to levels 20–47 but has no stated glove condition, so it cannot
validate either equipment variant. Mechanical calculations may still be emitted
for fully specified conditions, but missing parameters or a comparable
equipment-scoped observation continue to block review.

Barbarian Fishing is split across six exact Fishing-level benchmarks and three
interaction policies: AFK drop, three-tick drop, and three-tick cut-eat. Catch
probabilities use the rounded cascade implementation from revision 15325744 of
the official Wiki's `Module:Skilling success chart`; each fish's Agility reward
and Fishing, Strength, and Agility unlocks remain independently sourced. A
three-tick calculated rate is a mechanical upper bound, while the guide's rate
includes practical handling time, so a lower observed rate is expected and an
observed rate above the upper bound blocks review. For AFK rows, both official
tables retain their agreeing rate values and the guide's conditions remain
machine readable: the benchmark is at an exact Fishing level, assumes no
Angler outfit, includes fish-dropping time, and varies with drop speed. Neither
source publishes the catch-attempt cycle including that handling time. Every
AFK vector therefore uses
`afk_catch_attempt_cycle_including_drop_time_not_published` as its explicit
ranking blocker instead of borrowing three-tick timing or reverse-engineering a
cycle from rounded XP/hour.

A numeric zero entry level means the activity has no Agility access requirement;
it is not missing data. Vector generation preserves that access fact separately
from the minimum level actually covered by an observed rate. Certificate and
review-packet eligibility checks use the same finite-level semantics.

Ape Atoll, Penguin, and Werewolf access variants retain required equipment and
equivalent equipment alternatives, separate entry boostability from a training
boost policy, and preserve compound failure-free conditions. Ape Atoll's
conflicting 55,200 and 55,100 XP/hour statements remain an explicit verification
blocker rather than being silently reconciled.

Shayzien Basic also retains cross-page revision drift and obstacle scope
explicitly. Course revision 15168110 says its rate changed from 8,750 to 10,000
XP/hour and treats 10,000 as an upper bound, while Agility revision 15326985
still presents 8,750 as current. Because the latter exactly matches the
superseded value, it is excluded from current rate candidates and carried into
vectors as `supporting_rate_matches_superseded_pre_update_value`. Five obstacle
pages independently verify the seven-row route. Only the Tightrope page states
that failure was removed, so the other obstacle types and all unpublished
probability/outcome/recovery facts remain unresolved. Coverage converts those
level-independent limitations into blockers for the requested account level.

Hallowed Sepulchre equipment is modeled as encounter-scoped requirements and
composable modifiers, not standalone training methods. Exact resource changes
remain numeric; unquantified “faster” and “better chance” claims remain
qualitative. Observed floor-rate variants are blocked when their equipment state
is not stated by the source.

`verify-agility-variant-expansion.mjs` is the phase exit gate. It requires every
detected axis to be expanded, every finding to retain revision-pinned locators,
and every discovered snapshot to pass integrity validation.

`audit-agility-level34-coverage.mjs` unions the revision-pinned training guide
with course-family vectors at or possibly at level 34. Unknown entry levels,
higher-level-only models, missing failure conditions, and absent vectors remain
named blockers. Mechanical readiness is reported separately from condition
coverage so incomplete rates cannot be mistaken for an eligibility failure.

`audit-agility-training-guide-section-coverage.mjs` compares every ordered
heading in the revision-pinned official Agility training guide with the candidate
parser's stable section links. It distinguishes material method sections from
category and references headings, names every uncovered section, rejects orphaned
candidate links, and keeps collection/composite member coverage separate from
section coverage. Covering the guide cannot prove that the guide enumerates the
entire in-game method universe, so that broader completeness claim remains
blocked independently.

`audit-agility-rooftop-guide-member-coverage.mjs` expands the Rooftop collection
gate one level deeper. It requires each of the nine guide members to match
exactly one structured Rooftop course and at least one detailed activity vector,
while rejecting unexpected course or vector identities. A complete same-revision
report clears only this collection's internal-member gate; variant coverage,
mechanical completeness, and the wider game-universe audit remain independent.

Run:

```text
node platform/transforms/audit-agility-rooftop-guide-member-coverage.mjs
```

`audit-agility-brimhaven-guide-member-coverage.mjs` applies the same fail-closed
identity gate to the composite early-Brimhaven guide section. It requires all
three ordered strategies to match exactly one same-revision guide candidate and
rejects unexpected section candidates. Detailed-vector links are reported, but
they cannot prove variant or mechanical completeness; unpublished glove and
optional-ticket rate effects remain explicit limitations in their respective
models.

Run:

```text
node platform/transforms/audit-agility-brimhaven-guide-member-coverage.mjs
```

`audit-agility-hallowed-guide-member-coverage.mjs` expands the Hallowed
Sepulchre composite into the ten floor/looting-policy decisions already sourced
from its experience table, requires one same-revision vector for each, and
retains all thirteen encounter equipment requirements and modifiers as separate
members. The guide revision and Hallowed detail-page revision remain distinct.
Passing this identity gate does not prove cycle timing, failure mechanics,
equipment-state performance, modifier combinations, or verified ranking.

Run:

```text
node platform/transforms/audit-agility-hallowed-guide-member-coverage.mjs
```

`audit-agility-rockslide-guide-member-coverage.mjs` requires the core detour and
all three explicitly named pairing examples to match exactly one guide candidate
from the same revision. It reports that 4/4 identity result separately from the
broader pairing-universe gate. Because the source is explicitly open-ended, the
internal member audit remains blocked even when every named member matches; no
specific unlisted activity, teleport, token cost, or combined rate is inferred.

Run:

```text
node platform/transforms/audit-agility-rockslide-guide-member-coverage.mjs
```

`audit-agility-colossal-wyrm-guide-member-coverage.mjs` proves only that the
Basic and Advanced routes each have one same-guide-revision candidate with the
same level requirement. This can clear the composite identity gate while the
separate mechanical gate remains blocked by the obsolete course-page notice and
conflicting lap XP, timing, and Advanced XP/hour claims. Those mechanical
blockers are also imported into the account-independent Agility 1–99 audit.

Run:

```text
node platform/transforms/audit-agility-colossal-wyrm-guide-member-coverage.mjs
```

`audit-agility-progression-coverage.mjs` is the account-independent companion
gate. It evaluates every source-defined Agility base level from 1 through 99,
then derives structural spans from changes in candidate eligibility, condition
scope, or blocker type. Query-level numbers in otherwise identical blockers are
normalized only for breakpoint comparison, so they do not create artificial
breakpoints. The unmodified blocker text remains in each level result, and any
foreign query level embedded in reusable evidence is reported as an explicit
architectural defect. Full-skill coverage also requires a separately proven
candidate universe and verified performance/ranking breakpoints; success at one
account level can never satisfy this gate.

Al Kharid multi-obstacle evidence V2 contains only stable course and obstacle
facts. It does not store a target level or an “at target” probability. During a
coverage query, the evaluator derives a separate missing-probability blocker for
Tightrope 1 and the zip line using that query's base level. The same source record
therefore produces level-34 blockers in the pilot audit and level-70 blockers in
a level-70 query without mutating or duplicating evidence.

Werewolf Skullball's approximate route times are converted with the generic
bounded-cycle formula only when the entire source range earns the same reward.
The resulting actions/hour and XP/hour remain minimum/maximum ranges: no
midpoint is invented. These vectors may proceed to manual source review and
remain excluded from scalar ranking. Recommendation certificates compare point
and interval candidates only through `strict_non_overlapping_source_bounds_v1`:
one candidate wins only when its complete published rate range is strictly
better than another candidate's complete range. Overlapping or touching bounds
remain incomparable. This proves that the recommended run range dominates the
unplanned-scramble range, but the run/walk and walk/scramble comparisons remain
unresolved. The optimal 1:45 route remains blocked as a peak-only observation
rather than being treated as typical performance.

Agility Pyramid levels 30–50 use the training guide's revision-pinned,
approximate 25,000 XP/hour and 13-completion/hour observation. The source says
exact lower-level failure rates are unknown, so this is an observational
benchmark with failures and repeated-obstacle XP already integrated—not a
calculated success model. The level-scaled completion bonus remains a separate
candidate formula, and target coverage ignores the incomplete level-75 sibling
vector when a condition-correct level-34 variant is available.

Condition-scoped source-observed rate ranges have a separate evidence path from
mechanical calculations. A direct range must retain one ordered XP/hour band,
an exact source level scope, a revision and locator, and an explicit declaration
that outcomes are already aggregated by the source. It keeps `calculation` null,
cannot enter scalar ranking, and may enter only the strict interval policy after
manual review eligibility checks pass. Varrock revision 15324367 supplies an
11,000–14,000 XP/hour band for levels 30–40; revision 15319528 separately
supplies its failing obstacles and damage ranges. The unpublished level-34
failure probability is not synthesized, and the within-band performance and
failure mix remains source-unspecified.

`audit-skill-training-guide-inventory.mjs` measures the account-independent
cross-skill discovery foundation. It requires one record for every official
skill, retains each complete source-defined base-level domain, resolves every
directly declared training guide to its current revision, and compares those
declarations with the separately revision-pinned central guide index. Composite
rows and cross-source link disagreements remain visible. Passing this audit
means only that the training-guide discovery seed is complete; it always keeps
the independently complete repeatable-activity universe and any absolute-best
claim blocked.

Run:

```text
node platform/transforms/audit-skill-training-guide-inventory.mjs
```

`audit-skill-level-unlock-inventory.mjs` verifies the second cross-skill
discovery channel. It requires revision-pinned `Level up table` pages for every
official skill and exact equality between the source bullet count and captured
statement count on every page. Unknown parameters, missing pages, duplicate
skills, incomplete provenance, or account fields fail the raw inventory. Even a
passing raw audit reports zero semantically classified activities and cannot
close the independent repeatable-activity universe.

Run:

```text
node platform/transforms/audit-skill-level-unlock-inventory.mjs
```

`build-unlock-linked-page-entity-types.mjs` classifies every linked page using
exact root-template signals from the versioned entity-type policy. When no
mapped root-template type exists, V2 may use an exact, policy-mapped direct Wiki
category as fallback evidence. Root-template evidence always wins, so a broad
category cannot add to or override a stronger page type. Multiple explicit
types from the selected signal kind remain visible, and unmatched pages remain
untyped. A page typed as an activity is still only a discovery candidate:
canonical identity, repeatability, requirements, variants, mechanics, and
optimizer eligibility remain separate evidence gates.

Run:

```text
node platform/transforms/build-unlock-linked-page-entity-types.mjs
```

`build-unlock-linked-page-wiki-equivalence.mjs` consolidates aliases and
fragment targets only by the official MediaWiki page ID. It requires matching
resolved title, revision, timestamp, URL, source hash, and type evidence for
every member of a group. The output preserves every target, fragment, redirect,
skill, and source-statement reference exactly once. This is a storage and
identity boundary, not semantic promotion: canonical game entities, canonical
activities, repeatability, mechanics, and optimizer eligibility remain blocked.

Run:

```text
node platform/transforms/build-unlock-linked-page-wiki-equivalence.mjs
```

`build-skill-training-guide-unlock-page-crosswalk.mjs` crosswalks every grouped
rendered training-guide target against the grouped level-unlock evidence. A
match requires the same stable official MediaWiki page ID; titles are never a
fallback. The output preserves all guide observations, matched unlock reference
contexts, page-type evidence, and both source revisions. Structural publication
does not promote canonical entities or activities, prove repeatability or
mechanics, or close the independently complete activity-universe gate.

Run:

```text
node platform/transforms/build-skill-training-guide-unlock-page-crosswalk.mjs
```

`build-cross-source-entity-activity-candidates.mjs` creates a complete semantic-
review routing inventory from that crosswalk. Every input target remains present.
Only an exact cross-source page-ID match receives a candidate key and enters the
queue; an activity route additionally requires explicit activity-page evidence.
The queue is intentionally unreviewed and cannot create canonical identities,
repeatability classifications, mechanics, or optimizer eligibility.

Run:

```text
node platform/transforms/build-cross-source-entity-activity-candidates.mjs
```

`partition-cross-skill-rendered-pages-without-unlock-evidence.mjs` takes the
stable rendered-page candidates that have no matching level-unlock evidence and
routes every one into exactly one provenance partition: direct-source only,
mixed direct and unattributed rendered, or rendered-only with unattributed
origin. The transform revalidates the candidate snapshot, intrinsic hashes,
stable Wiki identities and revisions, every retained observation, and the exact
guide-revision binding set. Partition selection cannot use titles, namespaces,
page IDs, or parser channels as semantic evidence. The output is a bounded work
inventory only: it does not establish an unlock, canonical entity or activity,
repeatability, mechanics, automatic verification, or optimizer eligibility.

Run:

```text
node platform/transforms/partition-cross-skill-rendered-pages-without-unlock-evidence.mjs
```

`export-cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue.mjs`
turns that complete partition into one deterministic, source-bound work entry
per page. Each entry binds the partition and original candidate snapshots,
stable Wiki identity and revision, observation-set and guide-binding hashes,
and the exact evidence channels required by its provenance route. The readable
queue mirrors all machine entries. Evidence fields start empty, and the export
cannot establish an unlock, semantic identity, activity, repeatability result,
mechanics verdict, automatic verification, or optimizer state.

Run:

```text
node platform/transforms/export-cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue.mjs
```

`ingest-wiki-cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard.mjs`
fetches a bounded contiguous queue range by exact retained revision ID. Every
packet records the page identity, namespace, full-source hash and size, root
templates, direct categories, lead paragraphs, and headings while leaving all
semantic and optimizer fields closed. Shards are limited to 250 entries; a
successful shard is not full-population coverage. Use explicit `--start` and
`--limit` values so collection can resume deterministically, then consolidate
and revalidate every shard before claiming complete signature coverage.
Observed namespaces describe the link or parser observation retained by the
queue. The resolved source namespace is recorded independently from the exact
Wiki revision. A queue-bound identity explicitly marked as redirected may cross
that namespace boundary when its page ID, revision, timestamp, and resolved
title still match exactly; an unredirected namespace mismatch rejects the whole
shard. Rejected attempts return their attempted alignment audit while writing no
snapshot, so the specific failed queue entry remains visible.

Run:

```text
node platform/ingestion/ingest-wiki-cross-skill-rendered-page-without-unlock-evidence-target-source-signature-shard.mjs --start=1 --limit=250
```

`consolidate-cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population.mjs`
independently revalidates the authoritative queue plus every discovered shard
manifest and record. Equivalent reruns for an ordinal range must have identical
content. It deterministically selects one representative per range, requires an
exact disjoint 1:1 queue/signature population, and rechecks every queue snapshot,
entry, and source-identity binding. Gaps, overlaps, conflicting reruns, hash
drift, semantic promotion, or account-state leakage reject the entire output.
Population completion does not imply semantic reconciliation, repeatability,
mechanical completeness, or a complete activity universe.

Run:

```text
node platform/transforms/consolidate-cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population.mjs
```

`export-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue.mjs`
joins the complete signature population to its exact reconciliation queue and
resolves every queued candidate exactly once inside the larger candidate-context
inventory. Every entry retains all guide observations,
requested titles, exact source identity, templates, categories, lead paragraphs,
and headings. Review order uses only namespace and provenance partition; titles,
IDs, templates, categories, and aliases cannot select meaning. The paired
decision template starts blank and the export cannot establish relevance,
canonical identity, repeatability, mechanics, or optimizer eligibility.

Run:

```text
node platform/transforms/export-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue.mjs
```

`import-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decisions.mjs`
records explicit human decisions from a reviewed copy of that queue's blank
decision template. It supports partial review batches but rejects the whole batch
when any row is stale, partially filled, automatic-looking, uncited, unbound, or
otherwise invalid. Every completed decision must cite the complete evidence
fingerprint and pinned source. Relevant or ambiguous decisions must also cite an
exact retained guide observation; a decision that a source is irrelevant to all
contexts must cite every retained guide observation. Recording remains separate
from semantic application and cannot create identity, repeatability, mechanics,
or optimizer state.

Run with an explicitly selected reviewed template:

```text
node platform/transforms/import-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decisions.mjs --decisions=<reviewed-decision-template.ndjson>
```

`materialize-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packets.mjs`
turns the complete guarded semantic-relevance queue into deterministic,
human-readable review packets. Each packet binds the queue snapshot, outer and
intrinsic queue hashes, pinned source revision, complete evidence fingerprint,
every retained guide observation, and every retained structural source item.
Exact-revision links and stable evidence keys are included for every source and
guide observation. The queue is partitioned into contiguous, non-overlapping
batches of at most 50 packets, and each batch includes a readable Markdown file
plus a blank decision file that exactly matches the guarded importer. Packet
generation cannot record a decision or establish semantic relevance, identity,
repeatability, mechanics, or optimizer eligibility.

Run:

```text
node platform/transforms/materialize-cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packets.mjs
```
