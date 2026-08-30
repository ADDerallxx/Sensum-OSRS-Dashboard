# Sensum Goal Registry Audit

Audit date: 2026-08-29  
Scope: All 16 goals currently shown by the dashboard  
Standard: `docs/GOAL_AUTHORING_SOP.md`

Implementation status: V2.73 implements explicit completion types, direct Quest Cape progress, Balanced as an ongoing roadmap, finish-line text, source metadata, honest manual-confirmation states, and a separate path-readiness calculation using transitive prerequisite quests plus highest mandatory base-skill targets. Combat Growth runs through level 126 with milestone checkpoints; Transportation is the Core Transportation Network; Fire Cape and Infernal Cape each combine preparation checkpoints with the final manually confirmed cape.

## Executive finding

The existing progress engine has two paths: goals with a recognized anchor quest receive a weighted preparation score, while every other goal receives a generic score made from 70% account quest completion and 30% current-route readiness. That fallback is invalid. It caused Quest Cape to display 48% when 48 of 182 quests is approximately 26%, and it assigns unrelated progress to Balanced, Combat Growth, Transportation, Fire Cape Prep, and Infernal Cape.

Anchor-quest goals also need correction: completing prerequisites or meeting skill requirements can raise their progress substantially, but only the actual unlock should complete the goal. Preparation belongs in a separate Readiness display.

## Audited definitions

| Current goal | Verdict | Correct model and finish line | Detection |
|---|---|---|---|
| Balanced | Reclassify | `ROADMAP_MODE`. Ongoing recommendation strategy balancing useful unlocks, quests, skills, and account development. It cannot be accomplished. | Configuration |
| Fairy Rings | Correct endpoint, wrong likely detection | `QUEST_PARTIAL_UNLOCK`. Complete when the Fairy Godfather grants fairy-ring permission during Fairytale II; full quest completion also satisfies it. Fairytale I is required, but Fairytale II skill requirements and full completion are not required for the unlock. | Quest-stage detection if available; otherwise manual |
| Combat Growth | Corrected | `SKILL_THRESHOLD`. Finish at maximum combat level 126, with visible checkpoints at 70, 85, 100, 110, and 120. Overall progress uses current combat level / 126. | Stats |
| Transportation | Redefine | Recommended `CHECKLIST` named **Core Transportation Network**. Required networks must be explicitly chosen—for example fairy rings, spirit trees, and gnome gliders. Do not claim “all transportation,” which is open-ended and update-sensitive. | Quest flags plus manual partial-unlock checks |
| Fossil Island Access | Valid | `QUEST_COMPLETE`. Complete Bone Voyage, which unlocks Fossil Island. The Dig Site and 100 Kudos are prerequisites/readiness, not completion. | Quest completion |
| Fire Cape Prep | Corrected and renamed in display | **Fire Cape** is one phased checklist: Wiki-aligned preparation checkpoints followed by defeating TzTok-Jad and manually confirming the cape. Preparation can advance the bar but cannot complete the goal. | Stats/quest for preparation; manual cape confirmation |
| Barrows Gloves / RFD | Rename for precision | If tracking quest completion, name it **Barrows Gloves Unlocked** and complete Recipe for Disaster. If tracking actual ownership, require RFD plus manual confirmation that the gloves were purchased. | Quest plus optional manual ownership |
| Ancient Magicks | Valid | `QUEST_COMPLETE`. Complete Desert Treasure I to unlock the Ancient Magicks spellbook. | Quest completion |
| Piety | Composite and currently incomplete if quest-only | `CHECKLIST`. Complete King's Ransom, complete Knight Waves Training Grounds, reach 70 Prayer, and reach 70 Defence. Quest completion alone is insufficient. | Quest + stats + RuneLite/manual Knight Waves flag |
| Lunar Spellbook | Valid | `QUEST_COMPLETE`. Complete Lunar Diplomacy to unlock the spellbook. Later Dream Mentor spells are a separate expansion goal, not part of this finish line. | Quest completion |
| Darkmeyer Access | Valid | `QUEST_COMPLETE`. Complete Sins of the Father to unlock full Darkmeyer access. | Quest completion |
| Tombs of Amascut Access | Valid | `QUEST_COMPLETE`. Complete Beneath Cursed Sands to access Tombs of Amascut. Suggested raid stats belong in readiness, not access progress. | Quest completion |
| Dragon Slayer II | Valid | `QUEST_COMPLETE`. Complete Dragon Slayer II. Its quest, skill, QP, and Barbarian Training requirements are readiness details; only quest completion finishes the goal. | Quest completion |
| Prifddinas | Valid | `QUEST_COMPLETE`. Complete Song of the Elves to unlock Prifddinas. The eight level-70 skill requirements and prerequisite quests are readiness details. | Quest completion |
| Quest Cape | Formula invalid | `ALL_CURRENT_QUESTS`. Progress is completed tracked quests divided by the current verified quest total. Complete only when every current quest is complete. Quest points are a useful integrity cross-check, not a weighted bonus. New quest releases reopen the goal automatically. | Quest completion dataset + verified dynamic total |
| Inferno / Infernal Cape | Corrected and renamed in display | **Infernal Cape** is one phased checklist: Wiki suggested combat checkpoints, completion of the Fire Cape goal, then all 69 waves and TzKal-Zuk. Only manual cape confirmation completes it. | Stats plus completed Fire Cape goal; manual Infernal cape confirmation |

## Source register

All sources were checked on 2026-08-29.

- Fairy rings: https://oldschool.runescape.wiki/w/Fairy_rings
- Transportation overview: https://oldschool.runescape.wiki/w/Transportation
- Fossil Island: https://oldschool.runescape.wiki/w/Fossil_Island
- Kudos/Bone Voyage gate: https://oldschool.runescape.wiki/w/Kudos
- TzHaar Fight Cave: https://oldschool.runescape.wiki/w/TzHaar_Fight_Cave
- Recipe for Disaster: https://oldschool.runescape.wiki/w/Recipe_for_Disaster
- Ancient Magicks: https://oldschool.runescape.wiki/w/Ancient_Magicks
- Desert Treasure I: https://oldschool.runescape.wiki/w/Desert_Treasure_I
- Piety/prayer unlocks: https://oldschool.runescape.wiki/w/Prayer
- Lunar spellbook: https://oldschool.runescape.wiki/w/Lunar_spellbook
- Lunar Diplomacy: https://oldschool.runescape.wiki/w/Lunar_Diplomacy
- Sins of the Father: https://oldschool.runescape.wiki/w/Sins_of_the_Father
- Darkmeyer: https://oldschool.runescape.wiki/w/Darkmeyer
- Tombs of Amascut: https://oldschool.runescape.wiki/w/Tombs_of_Amascut
- Beneath Cursed Sands: https://oldschool.runescape.wiki/w/Beneath_Cursed_Sands
- Dragon Slayer II: https://oldschool.runescape.wiki/w/Dragon_Slayer_II
- Song of the Elves: https://oldschool.runescape.wiki/w/Song_of_the_Elves
- Quest point cape: https://oldschool.runescape.wiki/w/Quest_point_cape
- Inferno: https://oldschool.runescape.wiki/w/Inferno
- Infernal cape: https://oldschool.runescape.wiki/w/Infernal_cape

## Required implementation sequence

1. Remove the generic 70/30 fallback.
2. Reclassify Balanced as a roadmap mode with no percentage.
3. Correct Quest Cape to the direct dynamic quest fraction.
4. Add explicit completion types and finish-line text to goal records.
5. Separate progress from readiness on every card.
6. Add honest manual confirmation for partial unlocks and owned rewards that current data cannot observe.
7. Clarify Combat Growth and Transportation before assigning either a percentage.
8. Split or rename Fire Cape Prep, Barrows Gloves / RFD, and Inferno / Infernal Cape.
9. Add verification metadata and automated regression tests.
