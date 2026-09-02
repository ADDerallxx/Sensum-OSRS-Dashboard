# Sensum V4 Platform Foundation

This isolated foundation does not serve production traffic yet.

## Target platform

- Next.js/React web client
- Cloud Run API and calculation workers
- Cloud SQL for PostgreSQL
- Cloud Run Jobs for Wiki, price, and validation refreshes
- Vertex AI for evidence review and explanations, never authoritative math

## Accuracy boundary

The optimizer may only rank a candidate when every material input is sourced
and current, explicitly modeled as an assumption with a sensitivity range, or
marked unknown and excluded from an absolute-best claim.

Generative AI may propose relationships, summarize revisions, and explain a
deterministic result. It may not invent stats, requirements, or formulas.

Run `node platform/tests/foundation.test.mjs` from the repository root.

## Automated upgrade work

The guarded unattended roadmap is documented in
`docs/V4_AUTOMATED_UPGRADE_ROADMAP.md`. Run
`node platform/automation/next-checkpoint.mjs` to validate the plan and identify
the next bounded phase. Automation may commit tested V4 checkpoints, but it may
not approve evidence or deploy the live dashboard.

## Activity-method engine

Gathering, agility courses, combat loops, and location-constrained methods are
modeled separately from production recipes. The activity contract records
success probability, cycle time, resource supply, competition, banking,
movement, failure penalties, and requirements. Unknown material inputs block an
absolute-best claim instead of being guessed.

Run:

```text
node platform/formulas/verify-activity.mjs
node platform/transforms/activity-readiness.mjs
```
