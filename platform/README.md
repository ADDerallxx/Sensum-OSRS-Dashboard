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

Source-provided cycle ranges remain ordered performance intervals. They may be
reviewed as bounded calculations, but they cannot enter a scalar ranking or
support an absolute-best claim until an explicit interval comparison policy is
implemented. Peak-only timings never become typical cycle times.

Courses with multiple independently failing obstacles retain one composite
condition record with per-obstacle requirements, successful XP, probabilities,
and revisions. Sensum does not derive an aggregate lap probability or expected
rate unless every obstacle outcome plus failure recovery timing is sourced.

Quest-progress access can use an explicit in-progress milestone only when a
course page and the quest sequence independently establish it. Quest completion
also satisfies earlier milestones, while merely starting a quest never does.
Resolved summary-page discrepancies remain attached to the candidate.

Obstacle evidence is stored independently of the account level. Repeated route
occurrences remain distinct, and a no-failure claim for one obstacle type cannot
be applied to another. Coverage evaluates missing probabilities and expected
rates at query time, allowing the same evidence to serve the full level range.

## Whole-skill progression coverage

Skill knowledge is account-independent. The official Skills page supplies a
revision-pinned domain for every enumerated skill (normally base levels 1–99,
with the source-stated Hitpoints starting exception), while temporary effective
levels remain separate from base levels. A current account level is only a query
against this domain; it can never define or prove the knowledge boundary.

`audit-agility-progression-coverage.mjs` applies the existing target-level audit
to every integer Agility base level and compresses only structurally identical
ranges. It separately gates candidate-universe completeness, target-level model
coverage, and performance/ranking breakpoints. It also detects a foreign query
level embedded in reusable evidence. The first report identified 79 Al Kharid
evaluations contaminated by a stored level-34 query. The V2 obstacle-evidence
schema removed that query state, and the next report measured zero embedded-level
blocker defects. Brimhaven floor-spike success evidence and its standard/glove
training variants now use account-independent V2 contracts as well: levels
20–49 derive the unpublished-parameter blocker at query time, while levels 50–99
use the source-stated no-failure threshold. The broader field scan now finds zero
embedded account-query evidence records. The report remains intentionally blocked
by a measured structural gap rather than a generic selected-parser warning. A
revision-pinned inventory of Agility training revision 15324367 counts 18 ordered
headings and 15 material method sections. Twenty guide candidates now link to
all 15 material sections, including ten candidates added for the nine previously
uncovered sections and the previously omitted every-pillar Brimhaven strategy.
The Rooftop collection's nine ordered members each match one structured course
and at least one detailed vector (17 vectors total). The early-Brimhaven
section's three ordered strategies each match exactly one same-revision guide
candidate, with four detailed-vector links reported. The Hallowed Sepulchre
composite now also links all ten floor/policy decisions to ten same-revision
vectors and retains all thirteen encounter equipment members independently.
The Colossal Wyrm composite links its Basic and Advanced routes to exactly one
same-guide-revision candidate each, while retaining conflicting post-update
mechanics from three Wiki pages and the official update notes. The Rockslide
composite links all four explicitly named members to same-revision guide
candidates, but its source leaves the activity-pairing universe open, so one
collection or composite section remains pending. These identity audits do
not claim their variants or mechanics are complete. Even
complete section coverage does not by itself prove
the entire in-game method universe. Performance breakpoints are also not audited,
and every level still has at least one incomplete candidate.

Run:

```text
node platform/ingestion/ingest-wiki-skill-level-domains.mjs
node platform/ingestion/ingest-wiki-agility-training-guide-sections.mjs
node platform/ingestion/ingest-wiki-agility-rooftop-guide-members.mjs
node platform/ingestion/ingest-wiki-agility-brimhaven-guide-members.mjs
node platform/ingestion/ingest-wiki-agility-rockslide-guide-members.mjs
node platform/ingestion/ingest-wiki-agility-colossal-wyrm-guide-members.mjs
node platform/transforms/audit-agility-rooftop-guide-member-coverage.mjs
node platform/transforms/audit-agility-brimhaven-guide-member-coverage.mjs
node platform/transforms/audit-agility-hallowed-guide-member-coverage.mjs
node platform/transforms/audit-agility-rockslide-guide-member-coverage.mjs
node platform/transforms/audit-agility-colossal-wyrm-guide-member-coverage.mjs
node platform/transforms/audit-agility-training-guide-section-coverage.mjs
node platform/transforms/audit-agility-progression-coverage.mjs
```

Run:

```text
node platform/formulas/verify-activity.mjs
node platform/transforms/activity-readiness.mjs
```
