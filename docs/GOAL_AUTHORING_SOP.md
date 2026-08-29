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

Composite goals may contain multiple required conditions, but every condition must be explicitly declared. Do not use hidden weights. If a useful preparation metric is not part of the finish line, show it under **Readiness**, not **Progress**.

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

## Authoring workflow

1. **Clarify the outcome.** Rewrite the request as “This goal is complete when…” If that sentence cannot be made objective, create a roadmap mode or ask for a target.
2. **Classify it.** Choose one supported completion type.
3. **Research first.** Verify the endpoint, prerequisites, required levels, boost rules, partial-unlock behavior, and whether the result is an unlock or an owned item. Prefer the OSRS Wiki and record direct URLs.
4. **Separate requirements.** Put mandatory conditions in `required`; put comfort levels, gear suggestions, supplies, and strategy advice in `recommended`.
5. **Choose detection honestly.** Use automatic completion only for data the dashboard actually observes. Otherwise use a visible manual confirmation.
6. **Define progress without arbitrary weights.** Use the direct completion measure. For a quest cape, use quests completed / current quests. For a checklist, use required checks completed / total required checks. Do not blend route readiness into either.
7. **Define the finish gate.** The progress bar may reach 100% only when every required finish condition is true.
8. **Define the next action.** Select the nearest unmet prerequisite in dependency order; never recommend a downstream condition before its prerequisite.
9. **Handle live-game change.** Store verification metadata and specify whether the denominator or conditions are dynamic.
10. **Test five states.** Validate new account, partial progress, readiness-without-completion, completed, and missing/stale data.
11. **Run regression checks.** Confirm the goal does not alter unrelated goals and that changing the active goal does not change another goal's percentage.
12. **Document and deploy.** Update the goal audit, validation checks, version, backup, GitHub, Apps Script, and live verification.

## Progress display standard

Each card must show:

- **Finish line** — the exact outcome.
- **Progress** — only direct finish-line progress.
- **Readiness** — optional preparation, clearly non-completing.
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
