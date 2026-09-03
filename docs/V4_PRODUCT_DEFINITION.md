# Sensum V4 product definition

## Product promise

Sensum V4 is an account-specific OSRS decision engine. Given the player's
current account state, preferences, and the current game state, it must identify,
compare, and explain the best verified thing to do or use next.

That promise covers training methods, equipment setups, boss preparation,
quest routes, progression goals, and money-making methods across the supported
OSRS experience.

## Definition of done

V4 is complete only when all of these gates pass:

1. The knowledge system covers every relevant skill, activity, item, recipe,
   weapon, armour piece, equipment effect, monster, boss, location, requirement,
   unlock, quest, diary, supply, tick timing, XP value, and live price needed by
   a recommendation.
   For every trainable skill, that knowledge spans the complete revision-pinned
   base-level domain (normally levels 1–99). The player's current level is a
   query input only and can never define or prove the coverage boundary.
2. Material facts and formulas retain revision-pinned official OSRS Wiki
   evidence. Automated monitoring detects source drift. Missing, stale,
   contradictory, composite, or condition-mismatched evidence remains an
   explicit blocker and is never silently inferred.
3. The optimizer evaluates the complete eligible candidate pool and models
   levels, quests, diaries, boosts, equipment effects, attack styles, weaknesses,
   travel, banking, supplies, food, potions, cost, profit, risk, intensity, AFK
   time, practical availability, and meaningful breakpoints.
4. Recommendations provide realistic Budget, Practical, Premium, and BIS
   options where applicable without assuming bank ownership. Every result
   explains its winner, considered alternatives, conditions, expected
   performance, source revisions, confidence, uncertainty, and next breakpoint.
5. Sensum uses `verified best` only when candidate coverage, eligibility,
   formulas, variants, and evidence are complete. Otherwise it uses `best among
   verified candidates` or withholds the recommendation and displays blockers.
6. Accuracy is demonstrated with source-bound golden examples, regression and
   adversarial tests, sensitivity checks, coverage reports, reproducible
   recommendation certificates, and manual approval of important reference
   results.
7. The PostgreSQL, API, worker, and new-client architecture provides reliable
   feature parity for account, goal, quest, training, boss, money, completion,
   settings, and data-health workflows.
8. The interface is fast, responsive, accessible, visually cohesive,
   consistently worded, and passes architecture, navigation, terminology, and
   UI review.
9. Migration, reconciliation, backup, rollback, failure-recovery, load, and
   cutover rehearsals pass without corrupting existing data.

## Operating boundaries

- Complete one independently useful, tested, documented, reversible checkpoint
  at a time.
- Preserve unrelated work and never hide unresolved evidence or coverage gaps.
- Do not depend on a custom RuneLite plugin that requires approval.
- Keep live V3 and production data unchanged until every required gate passes
  and the user explicitly approves V4 production cutover.

Infrastructure, ingestion volume, or a completed roadmap phase is not by itself
success. The stopping condition is a reliable, evidence-backed answer to:

> Given this account, these preferences, and the current game state, what is the
> best verified thing to do or use next—and why?
