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
2. Validate the account-independent Agility model across levels 1–99 while
   closing level 34 as the first account-query certificate slice.
3. Review and approve exact Agility vectors; issue a reproducible certificate.
4. Generalize the method engine across every trainable skill family and audit
   each complete base-level domain rather than only the current account level.
5. Complete item, recipe, equipment, effect, monster, location, and price coverage.
6. Add adversarial optimizer evaluations, revision-drift checks, and confidence calibration.
7. Implement the Cloud SQL/API/job architecture behind a compatibility boundary.
8. Build the new client progressively without removing the stable live dashboard.
9. Perform architecture, terminology, accessibility, responsive-layout, and UI cohesion reviews.
10. Prepare a reversible migration rehearsal and request approval before production cutover.

The plan is complete only when the accuracy gates pass, the replacement has been
rehearsed, and the user explicitly approves production deployment.

## Recent bounded checkpoints

The three collection members routed to broader source-signature review now have
exact-revision structural evidence packets. `Target (Ranging Guild)` revision
15225200, `Vineyard foreman` revision 14834637, and `Wise Old Man tasks`
revision 14997080 each match the retained page ID, title, timestamp, URL, and
content hash. Across 15,638 source bytes, the packets preserve 21 distinct root
template signatures, 11 lead paragraphs, 22 headings, and all 73 direct source
wikilink occurrences, including 65 main-namespace relationship candidates.
Comments and protected source regions cannot become declarations, and template
or wikilink imbalance fails publication. Collection display labels remain
separate from linked page subjects: `Archery Competition` is not substituted
for `Target (Ranging Guild)`, and `Aldarin Vineyard` is not substituted for
`Vineyard foreman`. Repeated live runs produced byte-identical output. This is
stronger review evidence, not a semantic decision: all three subject identities
and linked relationships remain unreviewed and blocked, with no canonical
identity, repeatability, member expansion, mechanics, or optimizer promotion.
The next checkpoint should apply a generic source-signature disposition to
these three packets without using titles or collection context as answers.

All 69 reference-collection member dispositions now have exactly one generic
evidence-work route. Sixty source-supported subjects are queued: 43 minigame
session/mode reviews, six activity action/variant reviews, four boss encounter
reviews, four facility member-discovery reviews, and one each for activity-
collection expansion, fought-entity encounter classification, and skill-
expansion activity discovery. The six infobox/lead conflicts route to blocked
source-declaration reconciliation, while Target (Ranging Guild), Vineyard
foreman, and Wise Old Man tasks route to blocked broader source-signature
review. The policy defines three blocked-state routes and ten supported-
disposition routes, has no invalid or duplicate route definitions, and leaves
no observed state or disposition unmapped. Exact source identity, revision,
hash, signals, collection row, membership, link, and alias context is preserved
for all 69 records. Collection context selected or altered zero routes, and the
output is byte-identical across repeated runs. Routing creates evidence
obligations only; canonical identity, repeatability, member expansion,
mechanics, and optimizer eligibility remain at zero. The next checkpoint should
collect broader root-template and linked-subject evidence for the three
unresolved pages without using their collection labels as answers.

All 69 revision-pinned reference-collection members now have a generic,
source-declared subject disposition attempt. Exact input identity, revision,
hash, collection row, membership, link, and alias context is preserved for all
69 records. Sixty subjects have exactly one supported disposition: 43
minigames, six activities, four boss encounters, four facilities, one activity
collection, one fought entity, and one skill expansion. Six sources expose a
direct conflict between their infobox and lead declaration: Golem crafting,
Hallowed Sepulchre, Chompy bird hunting, Dorgesh-Kaan market trading, Keldagrim
tasks, and Stealing valuables. Three linked subjects remain unresolved: Target
(Ranging Guild), Vineyard foreman, and Wise Old Man tasks. The policy used 52
exact infobox-type signals and 60 first-non-empty-lead signals, while using no
collection class, display label, resolved title, page ID, or candidate key as a
semantic shortcut. `minigame-style boss` is not misread as a minigame. The
69-record output is byte-identical across repeated runs. Subject disposition
does not establish canonical identity, repeatability, atomicity, mechanics, or
optimizer eligibility. The next checkpoint should route supported, conflicting,
and unresolved members to generic evidence work without silently breaking ties.

All 69 reference-collection member candidates now have exact-revision semantic
review packets. The retained member identities yielded 69 distinct revision
requests; all 69 fetched pages match their page ID, resolved title, revision,
timestamp, and content hash, covering 1,374,078 source bytes. The packets retain
54 balanced supported activity/minigame infoboxes with 744 raw parameter
occurrences, 196 lead paragraphs, 954 ordered headings, and 2,454 source-located
lexical review signals. Fifteen pages have no supported Activity/Minigame
infobox, and the audit lists their display labels, resolved titles, membership
classes, and revisions instead of guessing a type. Six collection display labels
differ materially from the linked page title, including `Aldarin Vineyard`
linking to `Vineyard foreman`; these contexts remain distinct and visible for
semantic identity review. The 69-record output is byte-identical across repeated
live runs. No lexical match, collection class, or page identity established a
canonical entity, repeatability, mechanics, or optimizer eligibility. The next
checkpoint should apply a generic, source-declared member disposition that can
leave facility, NPC, composite, ambiguous, and conflicting identities blocked.

The first routed reference collection is now expanded from exact, source-located
table evidence. `Minigames` page 2078 revision 15327496 matches the routed page
ID, timestamp, and content hash exactly. All six mapped tables and all 69 data
rows are preserved: 49 official minigames, five explicitly separate
minigame-like bosses, and 15 explicitly separate minigame-like activities. The
70 member-link occurrences resolve to 69 current stable Wiki page identities;
the additional occurrence is the preserved `Temple Trekking` / `Burgh de Rott
Ramble` display alias on one source row. A source-authored missing leading region
cell and a header-marked data cell exposed by the first failed live audit are
handled through general Wiki table structure rather than title-specific rules.
The accepted snapshot is byte-deterministic across two live runs and has no
missing member cells, links, resolutions, or multi-identity rows. Collection
membership still does not establish canonical game-entity or activity identity,
repeatability, requirements, variants, XP, timing, mechanics, or optimizer
eligibility. The next checkpoint should build revision-pinned semantic evidence
packets for these 69 member candidates before any such promotion is considered.

All 29 activity-candidate subject records now receive exactly one generic
evidence-work route while preserving their source revision, content hash,
signals, and alias/redirect contexts. Twenty-seven supported subjects enter
seven review queues: 18 minigame session/mode reviews, three trial
objective/completion reviews, two activity action/variant reviews, and one each
for collection-member expansion, assignment-pool/task expansion, boss encounter
variants, and raid composite/scale review. Hallowed Sepulchre revision 15322138
and Stealing valuables revision 15323349 enter a blocked source-declaration
reconciliation route; routing does not erase or resolve their conflict. The
policy contains three blocked-state routes and seven supported-disposition
routes with no page IDs, titles, candidate keys, or overrides. These routes are
evidence obligations rather than game facts: canonical identity, repeatability,
member expansion, mechanics, and optimizer eligibility remain at zero. The next
checkpoint should execute the first evidence-bound expansion queue, beginning
with the revision-pinned reference collection and its explicit members.

A generic, source-declared subject-disposition layer now evaluates all 29
activity candidates without page IDs, titles, candidate keys, or per-page
overrides in its policy. Four exact infobox `type` values and six first-lead
declaration forms give 27 candidates one supported disposition: 18 minigames,
three trials, two activities, and one each for an assignment system, boss
encounter, raid, and reference collection. No candidate is unresolved and no
observed infobox type is unmapped. Hallowed Sepulchre revision 15322138 and
Stealing valuables revision 15323349 remain blocked because their infobox says
`Minigame` while their lead explicitly calls the subject an activity. The audit
preserves that contradiction rather than choosing a preferred source field.
Subject disposition does not establish canonical identity, repeatability,
atomicity, member coverage, mechanics, or optimizer eligibility; all of those
promotion counts remain zero. The next checkpoint must resolve or scope the two
source conflicts and begin evidence-bound composite/member expansion.

The 29 explicit activity-page candidates now have a revision-pinned semantic
review evidence packet. Exact revision fetches reconcile all 29 stable Wiki page
IDs and content hashes against 31 retained source-signature contexts; the two
multi-context alias pages preserve every context and have no revision or hash
conflict. The packet inventories 27 balanced supported infoboxes (26 Activity,
one Minigame), 351 raw infobox parameter occurrences, 84 lead paragraphs, and
423 ordered headings. Two pages—`Minigames` and `Hunters' Rumours`—do not use a
supported activity infobox and remain explicitly visible. A versioned lexical
policy identifies 1,286 source-located review candidates across subject scope,
repeatability, requirements, XP/rewards, timing/rates, and variants. Those
matches are search aids only: all 29 semantic identities and repeatability
decisions remain unreviewed, and zero canonical entities, canonical activities,
or optimizer-eligible methods were created. The next step is evidence-bound
semantic disposition and composite/member expansion, beginning with the
reference collection, bosses/raid, contract systems, trials, and minigames.

The exact cross-source page matches now feed a complete semantic-review candidate
inventory rather than being promoted directly into the optimizer. All 6,639
crosswalk records retain their source contexts and receive one deterministic
route. Exactly 1,909 stable, revision-aligned Wiki page identities enter the
review queue across all 24 skills: 29 explicit activity-page candidates, 1,812
typed non-activity page candidates, and 68 untyped page candidates. The remaining
4,725 stable rendered pages lack unlock evidence and five rendered targets remain
unresolved, so none enters the queue. Candidate keys are stable Wiki page IDs;
there are no duplicates, revision conflicts, account inputs, inferred facts,
canonical entity or activity identities, repeatability classifications, or
optimizer-eligible records. The next evidence step must examine the retained
source signatures and contexts to establish semantic identities and repeatability
without treating page type as sufficient proof.

A deterministic cross-source page-identity crosswalk now joins the rendered
training-guide inventory to the level-unlock inventory only by exact official
MediaWiki page ID. It preserves all 6,639 rendered target groups and all
27,092 guide observations without changing their guide, parser-channel, title,
or provenance context. Exact IDs establish 1,909 cross-source page matches
covering 6,036 guide observations; all 1,909 use the same retained page revision.
The matched set contains 1,841 typed pages, 68 explicitly untyped pages, and 29
activity-page candidates. Another 4,730 rendered targets have no unlock evidence,
1,565 unlock pages have no rendered-guide match, and five rendered targets remain
unresolved. Those are measured evidence boundaries, not errors hidden by title
matching. The crosswalk creates zero canonical entities, canonical activities,
repeatability proofs, or optimizer candidates. Historical template-expansion
provenance, semantic identity, mechanics, and the independently complete activity
universe therefore remain explicit blockers.

A revision-pinned rendered-guide observation audit now covers all 81 retained
training-guide revisions through the official MediaWiki parser. It preserves
27,092/27,092 returned target observations across 6,639 stable or exact-title
groups: 20,858 internal-link, 247 category, and 5,987 image observations. Every
target has a current Wiki resolution assessment; 27,087 observations resolve
to current revision-pinned pages and five remain missing. All 10,376 eligible
direct-source guide/target pairs and all 795 direct page-backed dependency pairs
reconcile with the parser output. A first live run omitted the parser's separate
category and image channels and produced 324 false absences; the contract and
regression fixture were corrected before this checkpoint was accepted. The
parser reports no image existence flags and no dependency revision IDs, so
current resolution cannot establish historical template-expansion closure.
There are 16,284 rendered-only observations whose exact template or generative
origin is not attributable from this response. No canonical activity,
repeatability proof, or optimizer candidate was created, and complete activity-
universe and absolute-best claims remain blocked.

A fail-closed source-dependency audit now covers all 81 retained guide
revisions. It preserves 19,072/19,072 direct source template invocations across
1,086 dependency records with balanced delimiters: 90 template
transclusions, three page transclusions, 687 parser-function forms, 305 dynamic
names, and one magic word. All 93 page-backed dependencies received official
Wiki API assessments and current revision provenance. Those current revisions
do not prove which dependency revisions were used when each historical guide
revision rendered, and rendered template links remain unenumerated, so
historical expansion closure is explicitly false. The three missing direct
links were independently rechecked against the current guide heads; every head
is still the same pinned revision and every missing link is still present.
Official search observations produced one revision-pinned review candidate per
missing title—`Ash covered tome` page 104670 revision 15188494, `Spirit Tree
(Farming)/Patches` page 263875 revision 15278913, and `Tiny tempor` page 306334
revision 15190148—but none is an exact MediaWiki title match and no automatic
replacement was made. The source-dependency inventory is complete for its
declared direct-source scope, while publication, canonical activity identity,
optimizer eligibility, and the complete activity-universe claim remain
blocked.

A fail-closed content-link readiness audit now covers all 81 unique
revision-pinned training-guide pages. It preserves 15,140 direct source
wikilink occurrences across 4,407 target records: 4,183 main-namespace pages,
215 non-main targets, eight in-page fragments, and one source-dynamic target.
All main targets received an API assessment; 4,180 resolve to revision-pinned
pages and three source-authored links currently point to missing pages:
`Ash-covered tome` from Ironman Guide/Farming revision 15321988,
`spirit tree (Farming)/Patches` from Ultimate Ironman Guide/Construction
revision 15319378, and `Tiny Tempoross` from Ultimate Ironman Guide/Fishing
revision 15318352. The audit therefore remains non-publishable rather than
guessing replacements. Exact stable page IDs establish 1,462 intersections
with the unlock set, covering 6,644 guide-link occurrences, but this creates
zero canonical activities, repeatability proofs, or optimizer candidates.
Template-generated links and unlinked semantic mentions remain outside this
direct-source slice and explicitly block complete activity-universe claims.

The complete cross-skill linked-page set now has an exact direct-category
fallback for pages without a mapped root-template type. Seventeen explicitly
mapped direct-category signals classify 64 additional target references while
root-template evidence remains authoritative whenever present. This increases
typed targets from 3,357 to 3,421 and reduces untyped stable Wiki pages from 190
to 137. Stable grouping still preserves all 3,567 targets and 6,375 statement
references across 3,474 MediaWiki page IDs. Activity-page candidates rise from
30 to 33 target references and from 29 to 31 stable pages, but remain discovery
candidates only: no canonical entity, repeatability, mechanics, or optimizer
eligibility was inferred. The 81 unique training-guide pages have zero exact
page-title overlap with these linked targets, so guide-content discovery—not
title matching—is required for the next reconciliation step.

The complete linked-page set now has a stable official Wiki-page equivalence
boundary. All 3,567 original targets and all 6,375 source-statement references
are preserved exactly once across 3,474 official MediaWiki page IDs. Fifty-eight
pages have multiple aliases or fragments, consolidating 93 duplicate page
references without discarding their requested title, fragment, redirect, skill,
or statement context. The grouped set contains 190 still-untyped Wiki pages and
29 activity-page identities (from 30 original activity references). These are
page identities only: none establishes a canonical game entity or activity,
proves repeatability or mechanics, or becomes optimizer eligible. Cross-source
semantic reconciliation and an independently complete activity universe remain
required before any authoritative best claim.

The complete cross-skill linked-page set now has revision-pinned source
signatures and a deterministic, fail-closed page-type routing layer. All 3,567
resolved pages were fetched at the same revisions retained by the identity
snapshot, covering 18,420,515 source bytes with zero revision drift. A
versioned policy maps 23 exact root-template signals to 22 page types: 3,357
pages have at least one explicit type, 807 legitimately have multiple types,
and 210 unmatched pages remain visibly untyped. Thirty pages are merely
activity-page candidates. No page type creates a canonical entity or activity,
proves repeatability or mechanics, or becomes optimizer eligible. The complete
activity universe and absolute-best claims therefore remain blocked while the
untyped pages and cross-source activity identities are reconciled.

Cross-skill unlock discovery now has a deterministic semantic-routing and Wiki
page-identity layer across the complete level-domain inventory, not an
Agility-only or current-account slice. The refreshed 24 level-up-table pages
still contain 4,768/4,768 captured source statements. A versioned source-role
policy routes every statement across all 114 observed leading forms: 4,717 have
a surface role and 51 deliberately remain `unresolved_source_form`. The 6,375
statement link references resolve to 3,567 distinct revision-pinned official
Wiki pages, including 191 redirects and no missing or unresolved pages. The
parser now recognizes plural-link templates and decodes a source-authored URI
escape before API resolution. These are discovery and identity facts only:
3,121 action-shaped statements are candidates for deeper investigation, while
canonical activity identities, semantic entity types, repeatability, mechanics,
and optimizer eligibility remain zero. The complete activity universe and every
absolute-best claim therefore remain blocked. Agility is still the first
end-to-end certification track, but it no longer defines the knowledge boundary.

The second cross-skill discovery channel now captures every revision-pinned
official `Level up table`. All 24 pages are tied to the Skills revision-15321845
domain and preserve all 3,870 top-level membership/level parameters, including
2,111 explicitly empty parameters. The independent lexical count and parsed
inventory agree at 4,768/4,768 source statements; each statement retains its
skill, source level, membership scope, raw multiline text, linked discovery
targets, page revision, content hash, and exact source lines. An initial live
run exposed 21 inline-on-parameter statements that the independent counter did
not include; that snapshot failed publication, the counter and regression
fixture were corrected, and only the subsequent matching snapshot passes. No
statement has been promoted into a canonical or repeatable activity: semantic
classification, mechanics, cross-source identity reconciliation, and proof of
the complete activity universe remain separate blockers. Thus this checkpoint
substantially expands all-skill breadth without creating optimizer candidates
or weakening the absolute-best gate.

Cross-skill training-guide discovery now starts from the complete official skill
domain rather than the current account. Skills revision 15321845 supplies all 24
skills and their complete base-level domains (normally 1–99, with Hitpoints'
level-10 start). Each skill's own current page supplies its `Has skill guide`
declaration, and every one of the 87 declared links resolves to a pinned Wiki
revision across 81 unique guide pages. No account fields appear in the inventory.
The independent central index at revision 15231153 has only 22 rows: Attack,
Strength, and Hitpoints are represented through one composite Combat row, and
all four Defence guide links disagree with the newer direct Defence-page
declaration. Those differences remain explicit blockers. The 24-skill guide
inventory is a complete discovery foundation, not a complete activity universe:
Wiki training guides intentionally prioritize useful methods and do not prove
that every repeatable in-game action has been enumerated. Absolute-best claims
therefore remain blocked while activity discovery expands under a separate gate.

Rockslide pairing coverage now has an independent, fail-closed universe gate.
The gate requires every official skill to have a complete repeatable-activity
inventory, every activity to be assessed exactly once, and every relevant
return path to come from a complete transportation graph with explicit timing,
cost, consumption, equipment-slot, requirement, and bank-return state. Current
account fields, curated lists, named Wiki examples, and golden-vector corpora
cannot establish the boundary. The first readiness report measures 24 official
skill domains and four revision-15324367 Rockslide guide members, but it finds
no independently closed activity universe, transportation universe, or pairing
assessment set. The existing 82-vector corpus contains only Agility and is
reported as review material, not universe evidence. Rockslide therefore remains
open, the guide composite count remains one, and all 99 Agility levels remain
blocked. Synthetic complete-universe fixtures prove the gate can pass, while
missing skills, account-filtered records, unassessed routes, stale guide scope,
and incomplete travel mechanics fail closed.

The Colossal Wyrm composite now has two independently identified route members,
Basic and Advanced, and both match exactly one same-guide-revision candidate.
Four official sources are retained separately: Agility training revision
15324367, the course page at revision 15313984, the Agility overview at revision
15326985, and the August update at revision 15303824. Their level-50 and
level-62 route identities agree, so the internal-member gate is complete and
the unaudited composite count falls from two to one. Their mechanics do not
agree: the course page is marked obsolete for duration and experience, Basic
lap XP is 633 versus 504.1, Advanced lap XP is 1,053.6 versus 749.6, Advanced
timing is 60 versus 82.8 seconds, and Advanced rates are 42,000, 43,000, and
44,000 XP/hour across the sources. The update confirms approximate 25%/40%
duration increases and matching reward adjustments but publishes no exact
post-update values. Sensum therefore preserves all claims, blocks verified
Colossal Wyrm performance, and carries those blockers into every-level Agility
coverage. Level-34 coverage is unchanged because both routes begin later; all
99 Agility levels remain blocked from an authoritative skill-wide claim.

The Rockslide + Other Activities section now has a revision-pinned named-member
audit. Agility training revision 15324367 supplies four explicit identities: the
core Rockslide detour and pairings with Ardougne Rooftop, Hallowed Sepulchre,
and a generic Runecraft bank-return example. All four match exactly one
same-revision guide candidate. The model keeps the shortcut's 100,000–120,000
"effective" rate separate from its 3,500–4,000 incremental Agility XP/hour,
does not invent the Ardougne teleport, Hallowed token cost, or a specific
Runecraft method, and preserves the optional three-minute marks-of-grace timing
policy. Because the source says “other activities” and “for instance,” it does
not define a closed pairing universe. The named 4/4 audit therefore remains
explicitly incomplete, does not reduce the two pending composite-section gates,
and cannot support an absolute-best claim. The three added pairings begin at
level 78, so level-34 coverage is unchanged; the complete Agility 1–99 audit was
rerun and all 99 levels remain blocked.

The Hallowed Sepulchre section now has a cross-source member identity audit.
Agility training revision 15324367 retains the composite guide candidate and
its three declared axes. Hallowed Sepulchre revision 15322138 supplies five
maximum-floor choices crossed with looting and no-looting policies, producing
ten decision members; all ten match exactly one same-revision activity vector.
The same detail-page revision supplies thirteen independent encounter equipment
requirements and modifiers, all of which are linked without treating them as
standalone methods. This reduces unaudited collection/composite sections from
three to two. It does not prove route mechanics, failure probabilities, cycle
timing, equipment-state rate effects, or the complete modifier cross-product.
The level-34 audit is unchanged because Hallowed Sepulchre is not eligible
there, and the full Agility levels 1–99 gate remains blocked at every level.

The level 20–47 Brimhaven section now has a same-revision internal-member
identity audit rather than being accepted as one opaque candidate. Agility
training revision 15324367 contains three ordered strategies: repeated floor
spikes, every-pillar tagging with floor spikes during downtime, and
detached-camera floor spikes. All three match exactly one guide candidate; the
middle strategy was previously absent and is now represented. Four detailed
vectors are linked, while the unpublished glove-adjusted hourly rate and the
unquantified optional ticket-dispenser benefit remain explicit limitations.
This reduces unaudited collection/composite sections from four to three without
claiming variant or mechanical completeness. The level-34 candidate universe is
unchanged because the new strategy starts at level 40. The full Agility domain
was rerun across levels 1–99 and all 99 levels remain blocked from an
authoritative best claim.

The Rooftop Agility Courses collection now has a same-revision internal-member
identity audit rather than being treated as complete because its section exists.
Agility training revision 15324367 supplies nine ordered Rooftop members. Every
member matches exactly one structured course record and at least one detailed
activity vector, for 17 linked vectors; three members also have level-34 guide
candidates. Missing, added, duplicate, or reordered source rows and unexpected
course/vector identities fail closed. This clears the Rooftop collection member
gate and reduces unaudited collection/composite sections from five to four, but
does not prove variant or mechanical completeness. All 99 Agility levels remain
blocked from a skill-wide authority claim.

Every material section in Agility training revision 15324367 now emits at least
one revision-located candidate. Ten new candidates cover the nine previously
unrepresented sections: Wilderness, Hallowed Sepulchre, the Rockslide hybrid
detour, Brimhaven tickets, Ape Atoll, Shayzien Advanced, both Colossal Wyrm
routes, Werewolf, and Prifddinas. Boosted base-level entry remains separate from
the required effective level for Wilderness and Werewolf; vague rate bands,
upper bounds, the Rockslide “effective” rate, and exact-level Brimhaven
observations retain their source semantics. The section audit moved from 6/15 to
15/15, but five collection/composite sections still need member-level audits and
the guide is still not accepted as proof of the complete game universe. Existing
vectors are linked rather than duplicated, all 99 levels remain blocked from a
full-skill authority claim, and level-34 coverage is unchanged.

Agility now has a revision-pinned structural inventory of the complete official
training-guide page instead of treating a selected parser as an unnamed universe.
Training-guide revision 15324367 contains 18 ordered headings: 15 material method
sections, two method-category headings, and one references heading. Existing
candidates link by stable section key to 6 of the 15 material sections. Nine exact
sections remain uncovered, and the covered Rooftop collection plus composite
Brimhaven section still require internal-member audits. The progression gate now
uses those measured findings at every base level from 1 through 99. It still
withholds full-skill authority because the official guide is not itself proven to
enumerate every possible in-game method. No current account state, candidate,
rate, or eligibility fact was inferred by this inventory.

Brimhaven floor-spike evidence is now account-independent under V2 success and
training-variant contracts. Floor-spike revision 15329694 still establishes
level-20 entry and the level-50 no-failure threshold; module revision 15325744
still supplies only the generic rounded interpolation formula, while the
obstacle-specific low/high inputs remain unpublished. Neither the two guide
records nor the two standard/Karamja-glove variants now store a target level or
an “at target” probability. The evaluator derives the exact missing-parameter
blocker for queries from levels 20–49, and derives zero failure directly from
the published threshold at levels 50–99. The whole-skill audit still evaluates
all 99 Agility levels, but its embedded account-query evidence count fell from
two to zero. No probability, expected rate, or candidate coverage was invented.

Al Kharid's composite failure evidence is now account-independent under a V2
schema. Course revision 15319534 and obstacle revisions 14658399 and 14687253
still establish the two failing obstacles, their requirements and successful XP,
damage, course timing, and the same unpublished probability and recovery facts.
The schema no longer stores `target_base_agility`, null “at target” probabilities,
or level-numbered ingestion blockers. Coverage derives those blockers at query
time: the pilot still names both missing level-34 probabilities, while a level-70
query names both missing level-70 probabilities. The 1–99 audit's embedded-query
blocker defects fell from 79 to 0. The subsequent Brimhaven V2 migration removed
the final two embedded account-query evidence records. The broader skill-wide
gate remains blocked, and no probability, expected rate, or additional candidate
coverage was invented.

Whole-skill progression coverage is now an explicit gate rather than an implied
future expansion of the level-34 pilot. Skills revision 15321845 declares 24
skills, the ordinary level 1 start, Hitpoints' level 10 exception, the level 99
maximum, temporary boosts, and the base/effective-level distinction. The new
ingestion audit parsed all 24 skills across the four source categories and kept
those facts revision-located. A generic progression audit now evaluates every
integer level in a skill's source-defined domain and separates target-model
coverage, candidate-universe completeness, structural breakpoints, and
performance/ranking breakpoints. Its first Agility run evaluated levels 1–99
and correctly withheld skill-wide authority: all 99 levels still contain at
least one incomplete candidate, the guide parser covers selected sections rather
than a proven complete universe, performance breakpoints are not audited, and
79 level evaluations expose older reusable evidence with level 34 baked into it.
Those are measured blockers, not inferred coverage.

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

The Shayzien basic-course model now retains its complete seven-obstacle sequence
and evaluates its limitations at the requested account level rather than baking
level 34 into the evidence. Course revision 15168110 supplies level-1 entry,
153.5 lap XP, a 51-second minimum, the seven XP rows, a 10,000 XP/hour upper
bound, and the explicit change from 8,750 to 10,000. Independent obstacle
revisions 14715880, 14730388, 14738994, 14658395, and 14658396 confirm every
level and successful XP value. Only Tightrope revision 14738994 explicitly says
failure was removed, so that fact applies to the three Tightrope occurrences and
not to Ladder, Monkeybars, Bar, or Gap. Agility revision 15326985 still presents
8,750 as a current practical average and describes failure only as “very
unlikely.” Sensum therefore preserves the stale-rate conflict and derives the
requested-level blockers for unknown failure-capable obstacle identity, aggregate
probability, failed-attempt XP, recovery routing/time, and current expected rate.
It does not manufacture any of those facts from the upper bound or description.

The Penguin Agility Course's Cold War access discrepancy is now resolved with
revision-pinned specificity evidence rather than silently choosing one page.
Course revision 15239936 states partial completion twice, Iceberg revision
15317986 says access begins halfway through Cold War, and Cold War revision
15315223 requires the course before quest completion while separately confirming
post-completion re-entry. Together these direct access and quest-sequence sources
override the general Agility overview's completion-only summary at revision
15326985. The canonical requirement accepts either completed Cold War or an
explicit in-progress `penguin_agility_course_access` milestone; merely starting
the quest is insufficient. The resolved discrepancy and all four revisions remain
visible. Penguin's independent level-34 failure-probability and rate-scope gaps
remain blocked.

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
