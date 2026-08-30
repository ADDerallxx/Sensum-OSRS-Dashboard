# Sensum Dashboard Goal Authoring SOP

Status: Required project standard  
Owner: Sensum OSRS Dashboard  
Last reviewed: 2026-08-29

## Purpose

Use this SOP whenever a goal is created, renamed, re-scoped, scored, marked complete, or displayed in Goal Progress. A goal must represent a finite player outcome. Recommendation styles and open-ended account directions are not goals.

## Non-negotiable rules

1. Give every goal one unambiguous finish line.
2. Never use an unrelated readiness score, route score, or account-wide average as goal progress.
3. Separate required conditions from recommended preparation.
4. Base completion on base levels unless the official requirement explicitly permits a boost and the product intentionally supports boost-aware completion.
5. Do not infer ownership, partial quest state, boss kills, minigame completion, diary completion, or unlock state from levels alone.
6. If the dashboard cannot observe the finish line, require explicit manual confirmation and label it as manual.
7. Cite the OSRS Wiki page that supports every game fact and store a verification date.
8. Never silently fill missing data. An unverifiable condition must be `REVIEW`, not assumed true.
9. New quests or Wiki revisions must trigger revalidation of dynamic goals such as Quest Cape.
10. A goal cannot be marked accomplished merely because its preparation requirements are met.

## Goal versus roadmap mode

A **goal** ends when a defined condition becomes true: a quest is completed, an unlock is obtained, a threshold is reached, a checklist is finished, or an achievement is confirmed.

A **roadmap mode** changes recommendation priorities but has no completion state. Examples include Balanced, Efficient Questing, PvM Focus, Skilling Focus, and Money-Making Focus. Roadmap modes display `Ongoing` and never show a percentage or an Accomplish button.

## Supported completion types

| Type | Finish line | Valid progress |
|---|---|---|
| `QUEST_COMPLETE` | One named quest is complete | Relevant prerequisite quests plus the anchor quest; completion requires the anchor |
| `QUEST_PARTIAL_UNLOCK` | A documented step inside a quest is reached | Manually confirmed or detected quest-stage flag; full quest completion also satisfies it |
| `SKILL_THRESHOLD` | Every named base-level target is met | Per-skill progress toward exact targets |
| `CHECKLIST` | Every required named condition is met | Required checks completed / required checks total |
| `ITEM_OR_REWARD_OWNED` | An untradeable reward or achievement is confirmed | Required preparation may be shown separately; ownership confirmation controls completion |
| `ALL_CURRENT_QUESTS` | Every currently released quest is complete | Completed tracked quests / current verified quest total |
| `ROADMAP_MODE` | No finish line | No percentage; display `Ongoing` |

Composite goals may contain multiple required conditions, but every condition must be explicitly declared. Do not use hidden weights. If a useful preparation metric is not part of the finish line, show it under **Path readiness**, not **Goal completion**.

Every goal must expose both metrics independently:

- **Goal completion** measures only the stated finish line. It may require manual confirmation when the endpoint is not observable.
- **Path readiness** measures the complete transitive prerequisite quest chain plus progress toward the highest mandatory base-skill target for each skill across that chain. Completed quest steps count as binary requirements; skill targets contribute fractional progress up to their required base level. The score is the unweighted average of those visible atomic requirements.

Never let path readiness mark a goal accomplished. A player can be 100% ready and still need to finish or manually confirm the final outcome.

## Goal Ranking Contract

Every finite goal must expose the same ranking metadata. This contract applies automatically to existing goals and is mandatory for every future goal:

- `completionPercent` — progress toward the actual finish line.
- `pathReadinessPercent` — progress through required prerequisite quests and mandatory base-skill targets.
- `remainingQuestSteps` — incomplete required quests, using the complete transitive dependency chain.
- `unmetSkillTargets` — mandatory base-level targets not yet met.
- `needsConfirmation` — true when the path is ready but the finish line cannot be observed automatically.
- `dataConfidence` — `VERIFIED`, `STALE`, `INCOMPLETE`, or `REVIEW`.

The default **Closest to ready** order is fixed:

1. Automatically completed goals.
2. Goals at 100% path readiness that need manual confirmation.
3. Highest path-readiness percentage.
4. Fewest remaining prerequisite quests.
5. Fewest unmet mandatory skill targets.
6. Highest goal-completion percentage.
7. Alphabetical name as the stable final tie-breaker.

Roadmap modes are excluded because they have no finish line. Recommended levels, optional routes, boosts, equipment, supplies, and comfort targets never affect ranking. Missing or unaudited goal data receives `REVIEW` confidence and sorts beneath verified goals instead of receiving an invented score. Completion and readiness must never be blended into a single fabricated percentage.

## Goal Action Plan Contract

Every finite goal must generate an ordered action plan from the same verified data used for readiness:

1. Traverse the complete prerequisite quest graph in dependency order.
2. Insert each unmet mandatory base-skill target immediately before the quest that requires it.
3. Never repeat a lower skill target after a higher target for that skill has already been planned.
4. Place the goal's finish-line quest or action last.
5. Use a visible manual-confirmation step for partial quest states, owned rewards, boss victories, or other outcomes the dashboard cannot observe.
6. Label each step as `Ready now`, `Train first`, `Complete quest`, or `Manual confirmation`.
7. State the expected unlock or dashboard effect of each meaningful step.
8. Use Wiki quest-length categories and the existing active-route training model for time guidance. Display an unavailable/variable label when no stable estimate exists; never invent one.
9. Recalculate the plan after every account sync, quest confirmation, stat change, or active-goal switch.
10. Provide direct `Make active goal` and `Plan tonight` actions.

## Required goal record

Every goal definition must contain:

- Stable ID
- User-facing name
- Account stage
- Completion type
- One-sentence finish line
- Required conditions
- Recommended conditions, kept separately
- Detection method for each required condition (`quest`, `stats`, `RuneLite`, `manual`, or another named source)
- Progress formula in plain language
- Completion formula in plain language
- Next-action selection rule
- OSRS Wiki source URL(s)
- Last verified date
- Revision/review status
- Behavior when data is missing
- All Goal Ranking Contract fields
- Dependency-ordered action-plan behavior

## Authoring workflow

1. **Clarify the outcome.** Rewrite the request as “This goal is complete when…” If that sentence cannot be made objective, create a roadmap mode or ask for a target.
2. **Classify it.** Choose one supported completion type.
3. **Research first.** Verify the endpoint, prerequisites, required levels, boost rules, partial-unlock behavior, and whether the result is an unlock or an owned item. Prefer the OSRS Wiki and record direct URLs.
4. **Separate requirements.** Put mandatory conditions in `required`; put comfort levels, gear suggestions, supplies, and strategy advice in `recommended`.
5. **Choose detection honestly.** Use automatic completion only for data the dashboard actually observes. Otherwise use a visible manual confirmation.
6. **Define both metrics without arbitrary weights.** Use the direct finish-line measure for goal completion. Separately calculate path readiness from every transitive prerequisite quest and highest mandatory base-skill target. For a quest cape, completion remains quests completed / current quests; readiness may describe the remaining quest-and-skill path but must not change that completion percentage.
7. **Define the finish gate.** The progress bar may reach 100% only when every required finish condition is true.
8. **Define the next action.** Select the nearest unmet prerequisite in dependency order; never recommend a downstream condition before its prerequisite.
9. **Handle live-game change.** Store verification metadata and specify whether the denominator or conditions are dynamic.
10. **Test five states.** Validate new account, partial progress, readiness-without-completion, completed, and missing/stale data.
11. **Run regression checks.** Confirm the goal does not alter unrelated goals and that changing the active goal does not change another goal's percentage.
12. **Test ranking.** Verify readiness ordering, remaining-quest and skill tie-breakers, ready-to-confirm placement, roadmap exclusion, and review-data fallback.
13. **Document and deploy.** Update the goal audit, validation checks, version, backup, GitHub, Apps Script, and live verification.

## Progress display standard

Each card must show:

- **Finish line** — the exact outcome.
- **Goal completion** — only direct finish-line progress.
- **Path readiness** — prerequisite quest-chain and mandatory base-skill progress, clearly non-completing.
- **Next requirement** — the earliest unmet required condition.
- **Tracked by** — automatic source or manual confirmation.
- **Verified** — date and Wiki link.

Use `Ongoing` for roadmap modes, `Needs confirmation` when the endpoint is not observable, and `Data unavailable` rather than manufacturing a percentage.

## Acceptance checklist

A goal is ready only when all answers are yes:

- Can a player explain the finish line in one sentence?
- Is every required condition supported by a source?
- Are recommendations excluded from completion?
- Can the dashboard truly observe each automatic condition?
- Is manual confirmation available for anything it cannot observe?
- Does 100% mean the goal is actually accomplished?
- Does 0–99% use only goal-relevant data?
- Are prerequisites ordered correctly?
- Will game updates trigger review instead of silent drift?
- Do automated checks cover the goal's completion type and edge cases?

## Future-chat instruction

When a user requests a new goal, read this SOP and `docs/GOAL_REGISTRY_AUDIT.md` first. State the proposed finish line, type, required conditions, detection method, and source before implementation. If the user names an aspiration without a measurable endpoint, propose a concrete goal or roadmap mode rather than inventing a percentage.
