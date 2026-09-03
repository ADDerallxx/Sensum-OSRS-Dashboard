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

The Al Kharid Rooftop Course target-condition audit is fail-closed. Official Wiki
revision 15319534 confirms that two obstacles can fail and cause 1–5 damage, but
does not publish a failure probability for base Agility 34. Training-guide
revision 15324367 scopes its 11,000–12,000 XP/hour range to levels 20–30. The
coverage report therefore exposes both missing conditions and does not reuse the
perfect-lap maximum or the out-of-band guide rate as a level-34 estimate.

The Varrock Rooftop Course now uses the same revision-pinned condition-evidence
path. Official Wiki revision 15319528 confirms two failing obstacles with
separate 3–8 and 2–5 damage ranges. Training-guide revision 15324367 scopes the
11,000–14,000 XP/hour range to levels 30–40, which includes level 34, but neither
source publishes a level-34 failure probability. Varrock therefore remains
blocked with that exact missing condition instead of receiving an inferred rate.

The Shayzien basic-course model now joins its course mechanics to the official
Agility overview instead of discarding cross-page evidence. Course revision
15168110 retains the level-1 entry, 153.5 XP, and 51-second minimum. Agility
revision 15326985 separately retains the approximate 53-second observation,
8,750 XP/hour practical average, and qualitative “very unlikely” failure claim.
Because that wording is not a numeric probability at level 34, the vector keeps
the observation but withholds a calculated rate and names the missing condition.

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
Brimhaven section. Arena revision 15293118 and floor-spike revision 15201362
separately establish the level-20 obstacle requirement, standard and
Karamja-glove XP variants, four-tick cycle, and failures below level 50. The
guide does not identify which equipment state produced 36,000 XP/hour, and no
source publishes the failure probability at base level 34. The audit therefore
names those two unresolved conditions independently and cannot use the observed
rate to validate or rank either equipment variant.
