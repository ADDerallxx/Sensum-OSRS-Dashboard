import {parseAgilityTrainingGuideExpansionCandidates} from '../ingestion/agility-training-guide-lib.mjs';
import {parseAgilityTrainingGuideSectionInventory} from '../ingestion/agility-training-guide-section-inventory-lib.mjs';
import {auditAgilityTrainingGuideSectionCoverage} from '../transforms/agility-training-guide-section-coverage-lib.mjs';

const source=`==Fastest experience==
===Levels 47–62: Wilderness Agility Course===
The [[Wilderness Agility Course]] offers the fastest experience rates from level 47 to 62. Level 52 is normally required to enter the course, but this can be boosted from level 47 with a [[summer pie]]. However, level 49 is required to pass the [[Obstacle pipe (Wilderness Agility Course)|pipe obstacle]].
===Levels 62–99: Hallowed Sepulchre===
The [[Hallowed Sepulchre]] offers the fastest experience from level 62 onwards. To access the Hallowed Sepulchre, players must have completed [[Sins of the Father]].
=== Levels 78+: Rockslide + Other Activities ===
After completion of [[The Blood Moon Rises]] you can mix other activities with the [[Rockslide (Vampyrium)]] shortcut which grants 550 experience every ~7.5 minutes. Teleporting to Vampyrium using [[Drakan's medallion]] and navigating the shortcut takes around 17-20 seconds, for "effective" experience per hour of 100,000-120,000. Using the shortcut diligently will net players 3,500 to 4,000 extra experience each hour.

In order to be effective the activity you are returning to must have teleportation nearby. It is effective to combine this method with the [[Ardougne Rooftop Course]] (with teleport) or [[Hallowed Sepulchre]] (with [[Hallowed crystal shard]]), however the latter does use Hallowed tokens which may not be desirable. Note that as a hybrid method this is not limited to Agility, for instance you could train [[Runecraft]] with the medallion in the neck slot. In such a case a teleport would be saved as you already needed one teleport to return to a bank, rather than one teleport to go to Vampyrium and another to return.

To maximise marks of grace whilst running agility laps you should delay teleporting until the next Mark of Grace spawns and you have finished the lap. This ensures the 3 minute mark cooldown is counting down while you are away from the course, so should not decrease your overall marks/hr.
==Other methods==
=== Levels 40/50+: Brimhaven Agility Arena ===
Tickets can be exchanged for 345 [[Agility]] [[experience]] per ticket. Karamja gloves give an additional 10% experience, giving 379.5 Agility experience. At level 40 Agility, players can earn roughly 28,000 XP per hour (or 30,000 experience per hour with gloves). At level 80 Agility, players can earn roughly 35,000 experience per hour (or roughly 37,000 experience per hour with gloves). The elite diary adds roughly 2,277 experience per hour added.
===Levels 48–52/60: Ape Atoll Agility Course===
This is available to players who have completed chapter 2 of [[Monkey Madness I]]. They must wear a [[ninja monkey greegree]] or a Kruk greegree. [[Boosts]] cannot be used to enter the course before level 48 Agility. Players can gain around 30,000–35,000 experience per hour at level 48, increasing to around 45,000–50,000 experience per hour at higher levels. Players stop failing the obstacles at level 75, from which point onwards it is possible to gain up to 55,000 experience per hour.
===Levels 45–52/60: Shayzien Advanced Agility Course===
Completing this course requires a [[crossbow]] and a [[mith grapple]]. Players can gain around 30,000 experience per hour at level 45.
===Levels 50/62: Colossal Wyrm Agility Course===
There are two routes, the basic course requires 50 Agility and gives up to 31,000 xp/hr, and the advanced course requires 62 Agility and gives up to 42,000 xp/hr. The advanced route requires only 6 clicks per 60-second lap, with two sections of the course allowing a full 20 seconds of AFK time each.
===Levels 60–80/90: Werewolf Agility Course===
Players must have completed [[Creature of Fenkenstrain]] and wear a [[Ring of Charos]]. This course requires level 60 Agility, but players can use summer pies to boost to level 60 even at level 55. With level 80 in Agility and [[Strength]], the death-slide cannot be failed when [[weight]] is below 2kg. Players can gain up to around 50,000–55,000 experience per hour at lower levels and 67,000–68,000 experience per hour at higher levels.
===Levels 75–99: Prifddinas Agility Course===
The course offers training from level 75 onwards. Players must have completed [[Song of the Elves]] to access this course. Players can gain up to around 60,000 experience per hour at level 75, increasing to 65,000 experience per hour from level 90 onwards.
==References==
{{Reflist}}`,input={title:'Agility training',content:source,sourceRevision:'15324367',sourceTimestamp:'2026-08-29T09:28:52Z',sourceUrl:'https://oldschool.runescape.wiki/w/Agility_training'},parsed=parseAgilityTrainingGuideExpansionCandidates(input),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},get=key=>parsed.records.find(row=>row.candidate_key===key);

check(parsed.audit.publishable===true&&parsed.audit.parsedSectionCount===9&&parsed.records.length===13,'All nine guide sections must parse into thirteen independently identified candidates.');
check(new Set(parsed.records.map(row=>row.candidate_key)).size===13&&parsed.records.every(row=>row.source_section_key&&row.source_revision==='15324367'),'Expanded candidates must have stable identities, section links, and pinned provenance.');
check(get('guide:wilderness-agility-course')?.minimum_agility===47&&get('guide:wilderness-agility-course')?.natural_entry_agility===52&&get('guide:wilderness-agility-course')?.obstacle_effective_agility_requirement===49,'Wilderness boosted base level, natural entry, and obstacle requirement must remain separate.');
check(get('guide:hallowed-sepulchre')?.requirements?.includes('Sins of the Father')&&get('guide:hallowed-sepulchre')?.internal_member_audit_required===true,'Hallowed access and composite floor/policy audit must remain explicit.');
check(get('guide:rockslide-hybrid-detour')?.effective_rate_is_not_sustained_training_rate===true&&get('guide:rockslide-hybrid-detour')?.incremental_xp_per_hour_range?.maximum===4000,'Rockslide effective and incremental rates must not be conflated.');
check(get('guide:rockslide-hybrid-detour')?.paired_activity_universe_closed===false&&get('guide:rockslide-hybrid-detour')?.pairing_universe_blocker==='source_uses_open_ended_other_activities_and_for_instance','The source\'s open-ended pairing universe must remain an explicit blocker.');
check(get('guide:rockslide-pairing:ardougne-rooftop')?.return_teleport_identity_published===false&&get('guide:rockslide-pairing:ardougne-rooftop')?.optional_policy_axes?.[0]?.mark_cooldown_minutes===3,'The Ardougne example must retain its unspecified teleport and source-stated marks timing policy.');
check(get('guide:rockslide-pairing:hallowed-sepulchre')?.return_teleport_item==='Hallowed crystal shard'&&get('guide:rockslide-pairing:hallowed-sepulchre')?.token_cost_per_cycle_published===false,'The Hallowed example must retain its named return item without inventing a token cost.');
check(get('guide:rockslide-pairing:runecraft-bank-return')?.paired_activity?.specific_activity_published===false&&get('guide:rockslide-pairing:runecraft-bank-return')?.bank_return_teleport_reused===true,'The Runecraft example must not become a fabricated specific training method.');
check(get('guide:brimhaven:ticket-course')?.observed_level_benchmarks?.length===2&&get('guide:brimhaven:ticket-course')?.benchmark_interpolation_allowed===false,'Brimhaven exact benchmarks must not authorize interpolation.');
check(get('guide:ape-atoll-agility-course')?.entry_boostable===false&&get('guide:ape-atoll-agility-course')?.failure_free_base_agility===75,'Ape Atoll entry and failure-free levels must remain distinct.');
check(get('guide:shayzien-advanced-agility-course')?.entry_requirement_requires_supporting_page===true,'A source-observed Shayzien training level must not silently become a verified entry requirement.');
check(get('guide:colossal-wyrm:basic')?.minimum_agility===50&&get('guide:colossal-wyrm:advanced')?.minimum_agility===62&&get('guide:colossal-wyrm:advanced')?.source_stated_lap_seconds===60,'Colossal Wyrm routes must remain separate candidates.');
check(get('guide:werewolf-agility-course')?.minimum_agility===55&&get('guide:werewolf-agility-course')?.natural_entry_agility===60&&get('guide:werewolf-agility-course')?.observed_rate_level_scope_unresolved===true,'Werewolf boosted entry must remain separate and its vague rate bands must stay unresolved.');
check(get('guide:prifddinas-agility-course')?.requirements?.includes('Song of the Elves')&&get('guide:prifddinas-agility-course')?.observed_xp_per_hour_upper_benchmarks?.[1]?.baseAgility===90,'Prifddinas access and level-specific upper bounds must survive parsing.');

const inventory=parseAgilityTrainingGuideSectionInventory(input),coverage=auditAgilityTrainingGuideSectionCoverage({sections:inventory.records,candidates:parsed.records});
check(coverage.materialSectionCount===9&&coverage.coveredSectionCount===9&&coverage.uncoveredSectionCount===0,'Every expanded fixture section must link to at least one candidate.');
check(coverage.internalMemberAuditPendingCount===3&&coverage.blockers.includes('covered_collection_or_composite_section_members_not_audited'),'Hallowed, Rockslide, and Colossal composite members must remain separately unaudited.');

const missing=parseAgilityTrainingGuideExpansionCandidates({...input,content:source.replace(/===Levels 75–99: Prifddinas Agility Course===[\s\S]*?(?===References==)/,'')});
check(missing.audit.publishable===false&&missing.audit.blockers.includes('guide_section_parser_missing:prifddinas_agility_course')&&missing.records.length===12,'A missing expected guide section must fail publication rather than silently shrink coverage.');
const missingPairings=parseAgilityTrainingGuideExpansionCandidates({...input,content:source.replace(/In order to be effective[\s\S]*?(?=\n\nTo maximise)/,'')});
check(missingPairings.audit.publishable===false&&missingPairings.audit.missingMemberEvidence.includes('guide_member_evidence_missing:rockslide_named_pairings'),'Missing named pairing evidence must fail publication.');
const missingMarks=parseAgilityTrainingGuideExpansionCandidates({...input,content:source.replace(/To maximise marks of grace[\s\S]*?(?=\n==Other methods==)/,'')});
check(missingMarks.audit.publishable===false&&missingMarks.audit.missingMemberEvidence.includes('guide_member_evidence_missing:rockslide_marks_policy'),'Missing marks-of-grace policy evidence must fail publication.');
const wrongTitle=parseAgilityTrainingGuideExpansionCandidates({...input,title:'Not Agility training'});
check(wrongTitle.audit.publishable===false&&wrongTitle.audit.blockers.includes('unexpected_source_title'),'An unexpected source page must fail closed.');

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Agility training-guide full-section expansion checks passed.');
