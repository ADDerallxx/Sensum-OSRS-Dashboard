# Sensum V4 authorization boundaries

Recorded from the user's explicit approval on 2026-09-06. These permissions
remove implementation bottlenecks but do not weaken the product definition,
evidence standards, or production gates.

## Approved development actions

- Resume V4 checkpoint work under the adaptive accuracy-preserving strategy.
- Fetch Git remotes and create or push a dedicated V4 development branch for
  recoverable backup. This does not authorize merging or deploying it.
- Use responsible, rate-limited, read-only official Wiki, Jagex, RuneLite, GE
  price, documentation, and dependency-registry access. Non-authoritative
  sources remain discovery material unless independently accepted by policy.
- Install pinned, scoped development dependencies and operate isolated local
  PostgreSQL, API, worker, browser-test, and load-test services on loopback.
- Import sanitized read-only copies of existing account data into isolated V4
  development storage. The source and live V3 data remain unchanged.
- Promote low-risk structured facts deterministically only when an exact
  revision-pinned official field passes schema, consistency, contradiction,
  and drift gates and creates no broad optimizer or `verified best` claim.
- Refactor and consolidate superseded V4 code behind tests and recoverable Git
  history. Unique evidence cannot be discarded.
- Deduplicate, compress, archive, and eventually remove redundant generated
  evidence only after content hashes, lineage, manifests, and a recoverable copy
  have been verified.
- Run bounded parallel collection or validation jobs when their output targets
  do not overlap. Publication and phase-state transitions remain serialized.
- Create disableable, resource-limited local refresh schedules that write only
  to isolated V4 development storage.
- Prepare concise human-review batches and record explicit user decisions for
  material semantics, conflicts, formulas, exclusions, and golden winners.
- Conduct an independent adversarial validation pass before broad optimizer
  accuracy claims.

## Approved in principle but still condition-gated

- A separate non-production cloud staging environment is approved only after a
  concrete monthly spending cap is recorded. Until then, paid-resource creation
  remains disabled.
- Cloud credentials and secrets may be used only after they are supplied through
  an approved secret channel. They must never be printed, logged, or committed.

## Not authorized by this approval

- Merging V4 into the production branch or replacing the live V3 dashboard.
- Running `deploy.ps1`, `clasp push`, Apps Script deployment, production database
  migration, production-data mutation, or production cutover.
- Automatically approving golden evidence or material human-review decisions.
- Exposing credentials, requesting the RuneScape password, reading the player's
  bank, or depending on an approval-gated custom RuneLite plugin.
- Treating discovered, bounded, ambiguous, contradictory, or incomplete evidence
  as verified merely to accelerate delivery.

Each production or paid-resource gate still requires its named preconditions and
a separate recorded approval where the product definition requires one.
