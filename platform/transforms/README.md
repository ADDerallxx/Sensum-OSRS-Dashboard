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

Prifddinas portal shortcuts are modeled as absent, randomly used, and
best-spawn peak conditions. The Wiki's 5–10 second saving remains a range, and
its unscoped 1:14 average lap is not assigned to either portal policy.

Brimhaven conditions keep passive level-40 and level-80 observations separate,
model Karamja gloves and the elite diary independently, and distinguish base
Agility from the boosted effective level used for the level-100 pillar reward.
The active-rate source does not specify a glove state, so the model does not
silently assign one.

A numeric zero entry level means the activity has no Agility access requirement;
it is not missing data. Vector generation preserves that access fact separately
from the minimum level actually covered by an observed rate. Certificate and
review-packet eligibility checks use the same finite-level semantics.

Ape Atoll, Penguin, and Werewolf access variants retain required equipment and
equivalent equipment alternatives, separate entry boostability from a training
boost policy, and preserve compound failure-free conditions. Ape Atoll's
conflicting 55,200 and 55,100 XP/hour statements remain an explicit verification
blocker rather than being silently reconciled.

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
