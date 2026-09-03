# Canonicalization

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
the obstacle page has no success-rate chart. The generic success interpolation
formula is separately pinned, but cannot produce a probability without the
obstacle's unpublished low/high inputs. The guide's approximate 36,000 XP/hour
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

Shayzien Basic also retains cross-page revision drift explicitly. Course revision
15168110 says its rate changed from 8,750 to 10,000 XP/hour and treats 10,000 as
an upper bound, while Agility revision 15326985 still presents 8,750 as current.
Because the latter exactly matches the superseded value, it is excluded from
current rate candidates and carried into vectors as
`supporting_rate_matches_superseded_pre_update_value`. The separate qualitative
failure claim remains non-numeric and cannot create a level-34 failure rate.

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
