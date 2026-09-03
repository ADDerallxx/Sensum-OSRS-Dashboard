# Sensum V4 automated upgrade roadmap

This roadmap is the durable handoff for unattended V4 work. The machine-readable
state is in `platform/automation/v4-upgrade-plan.json`.

The product outcome and stopping condition are authoritative in
`docs/V4_PRODUCT_DEFINITION.md`. Every checkpoint must advance that product
promise; completing infrastructure or ingesting records alone is not success.

## Operating rules

- Complete one bounded checkpoint per run.
- Read the latest reports and Git state before changing code.
- Use revision-pinned OSRS Wiki facts and official game formulas where available.
- Treat missing, conflicting, stale, or variant-mixed evidence as a blocker.
- Never promote regex output or AI-generated facts directly to verified data.
- Run the relevant regression suite before committing.
- Commit and push only a clean, independently useful checkpoint.
- Preserve the current live V3 Apps Script dashboard. Do not run `deploy.ps1`,
  `clasp push`, or create a live deployment without explicit user approval.
- Do not automatically approve golden vectors. Generate review packets and wait
  for a source-backed review decision.
- Stop and report when credentials, billing, destructive migration, external
  service creation, or a product choice requires the user.

## Roadmap order

1. Expand composite Agility pages into exact variants.
2. Close every level-34 Agility eligibility and mechanical-model gap.
3. Review and approve exact Agility vectors; issue a reproducible certificate.
4. Generalize the method engine across every trainable skill family.
5. Complete item, recipe, equipment, effect, monster, location, and price coverage.
6. Add adversarial optimizer evaluations, revision-drift checks, and confidence calibration.
7. Implement the Cloud SQL/API/job architecture behind a compatibility boundary.
8. Build the new client progressively without removing the stable live dashboard.
9. Perform architecture, terminology, accessibility, responsive-layout, and UI cohesion reviews.
10. Prepare a reversible migration rehearsal and request approval before production cutover.

The plan is complete only when the accuracy gates pass, the replacement has been
rehearsed, and the user explicitly approves production deployment.

## Recent bounded checkpoints

The Al Kharid Rooftop Course now has a composite, per-obstacle failure-evidence
model. Course revision 15319534 identifies Tightrope 1 and the zip line as its
only failing obstacles, confirms 1–5 damage, 216 completion XP, and a 107-tick
source-stated lap. Tightrope revision 14658399 and zip-line revision 14687253
independently confirm their level-20 requirements and 36/48 successful XP, but
neither publishes a success chart or level-34 probability. The course sources
also do not publish failed-attempt XP or recovery routing and time. The audit
therefore replaces one generic course probability gap with four precise blockers
and keeps the guide's level 20–30 rate out of scope at level 34. No aggregate lap
probability or expected XP/hour is inferred from the generic Wiki formula, the
damage ranges, or the source-stated 12,100 XP/hour upper bound.

The Varrock Rooftop Course now has a condition-scoped source-observed rate
interval. Official Wiki revision 15319528 confirms two failing obstacles with
separate 3–8 and 2–5 damage ranges, while training-guide revision 15324367
publishes 11,000–14,000 XP/hour for levels 30–40. Because that band includes
base level 34, Sensum can retain it as aggregate outcome evidence without
inventing the unpublished failure probability. The full interval, level band,
and an explicit source-unspecified within-band performance/failure mix survive
into the vector and review packet. It remains an uncalculated, manually
reviewed interval that cannot enter scalar ranking or support an exact expected
rate. This closes Varrock's target-condition gap without claiming verified best.

The Shayzien basic-course model now fails closed on a stale cross-page rate.
Course revision 15168110 retains the level-1 entry, 153.5 XP, 51-second minimum,
10,000 XP/hour upper bound, and the explicit change from 8,750 to 10,000.
Agility revision 15326985 still presents 8,750 as a current practical average and
calls obstacle failure “very unlikely.” Because 8,750 exactly matches the course
page's superseded value, ingestion no longer attaches it as current rate evidence.
The conflicted record remains publishable as blocked evidence so downstream
coverage exposes `supporting_rate_matches_superseded_pre_update_value` instead of
falling back to an older clean-looking snapshot. The separate unpublished numeric
failure probability at base level 34 also remains a blocker.

The Penguin Agility Course model now preserves its boostable level-30 entry as
an entry rule rather than a training-boost assumption. Wiki revision 15239936
also remains explicit about partial Cold War progress, the clockwork-suit
transformation and cape-slot state, the 540 XP lap reward, and failures still
being possible at level 99. Its 22,000–27,000 XP/hour claim is retained as an
observed range for unspecified “lower levels,” not assigned to base level 34.
The target audit therefore names both missing pieces: a level-34 failure
probability and an observed-rate band that actually identifies level 34. The
Agility overview at revision 15326985 says full Cold War completion is required,
contradicting the course page's partial-completion claim. Both revisions remain
attached and the unresolved access conflict is a third explicit blocker.

The Agility Pyramid now has a level-30–50 observed benchmark sourced from
Agility training revision 15324367: roughly 13 completions and 25,000 XP/hour.
Course revision 15267215 separately supplies the level-30 entry, obstacle XP,
base-level completion-bonus formula, and explicit warning that exact lower-level
failure rates are unknown. Sensum therefore keeps 25,000 as an approximate,
failure-inclusive observation rather than manufacturing a level-34 failure
curve or multiplying completions by successful-lap XP. This closes the Pyramid
target-condition gap while leaving its vector subject to manual golden review.

The repeated-floor-spike Brimhaven candidate now preserves the guide's wording
as an upper bound rather than an expected rate. Agility training revision
15324367 places the method in the level 20–47 section and says players can gain
“up to” 30,000 XP/hour, but it does not publish a level-34 failure probability
or expected rate. The audit exposes both missing facts explicitly and retains
the 30,000 figure only as non-ranking upper-bound evidence. This checkpoint
improves blocker precision without claiming additional condition coverage.

Brimhaven's four passive policies now separate arena access from benchmark
scope. Arena revision 15293118 says the course itself has no skill requirement
and supplies approximate rates only at Agility 40 and 80, across the independent
Karamja-glove and elite-diary states. The eight observations are now scoped,
revision-located review candidates at exactly those levels; level 34 reports
that only level-40/80 benchmarks exist and that its expected rate is unpublished.
No benchmark is interpolated, and benchmark levels are no longer represented as
access requirements.

The Detached Camera floor-spike observation now retains the complete condition
scope that the sources actually publish. Agility training revision 15324367
places the approximately 36,000 XP/hour statement inside its levels 20–47
Brimhaven section. Arena revision 15293118 and floor-spike revision 15329694
separately establish the level-20 obstacle requirement, standard and
Karamja-glove XP variants, four-tick cycle, and failures below level 50. The
guide does not identify which equipment state produced 36,000 XP/hour, and no
source publishes the failure probability at base level 34. The audit therefore
names those two unresolved conditions independently and cannot use the observed
rate to validate or rank either equipment variant.

The Brimhaven floor-spike success gap is now parameter-specific rather than a
generic missing-probability claim. Floor-spike revision 15329694 retains the
level-20 entry and level-50 no-failure threshold, but explicitly remains in
`Needs skilling success chart`. Module revision 15325744 supplies the generic
rounded interpolation formula, not the obstacle-specific low/high inputs. Both
repeated and detached level-34 candidates therefore expose
`success_interpolation_low_high_parameters_not_published`; no probability is
interpolated from entry and failure-free levels. A source fixture proves that
revision-pinned parameters would use the verified formula, while mismatched
requirements fail closed.

The Edgeville Dungeon monkeybars model now distinguishes observations from
mechanics and retains its cross-page disagreement without normalization.
Monkeybars revision 15161382 states 20 XP per successful crossing, no failure,
and an upper bound of 13,000 XP/hour from level 15, but does not publish the
complete motionless round-trip cycle. Agility training revision 15324367 places
an independent 13,200 XP/hour upper bound in its levels 15–40 section. Revision
history contains no authoritative reconciliation between those values. Both
claims are now non-expected upper-bound evidence with their own revision and
scope; the audit names the missing round-trip ticks and the 13,000-versus-13,200
conflict explicitly. Neither rate is selected, averaged, or reverse-engineered
into game mechanics.

Werewolf Skullball rate intervals now have a generic, certificate-level
comparison policy. Revision 15315300 remains the sole game-fact source: its
2:20–2:45 run, 2:45–3:15 walk, and 3:00–3:49 scramble timings each retain their
full 750-XP reward and become source-bounded XP/hour ranges. The policy permits
only strict dominance across complete non-overlapping bounds, never midpoint or
scalar conversion. It proves the run range strictly dominates scramble, while
the touching run/walk boundary and overlapping walk/scramble ranges remain
incomparable. The 1:45 “as fast as” observation still lacks a typical timing
range and remains an explicit mechanical blocker. No interval entered scalar
ranking and no peak observation was promoted.

Barbarian Fishing's AFK variants now expose the exact limit of the official
evidence instead of the generic `cycle_ticks` gap. Barbarian Training revision
15292392 and Pay-to-play Fishing training revision 15329351 publish matching
AFK rate rows; the guide states that the rates assume no Angler outfit, include
dropping time, and vary with the player's drop speed. Each of the six AFK rows
therefore retains its exact Fishing-level scope, rate conditions, both source
locations, and the blocker
`afk_catch_attempt_cycle_including_drop_time_not_published`. No three-tick
timing was borrowed and no attempt cycle was reverse-engineered from rounded
XP/hour. The exact three-tick variants remain separately reviewable.
