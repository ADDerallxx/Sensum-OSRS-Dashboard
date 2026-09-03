import {parseAgilityBrimhavenGuideMembers} from '../ingestion/agility-brimhaven-guide-member-lib.mjs';
import {auditAgilityBrimhavenGuideMemberCoverage} from '../transforms/agility-brimhaven-guide-member-coverage-lib.mjs';
import {auditAgilityTrainingGuideSectionCoverage} from '../transforms/agility-training-guide-section-coverage-lib.mjs';

const section=`===Levels 20–47: Brimhaven Agility Arena===
[[Brimhaven Agility Arena]] offers the fastest experience from level 20 to 47. Players must have 200 coins to pay the entry fee for the course. Level 40 is required to pass all obstacles in the course, but the [[Floor spikes (Brimhaven Agility Arena)|floor spikes]] trap provides the fastest experience rate and only requires level 20 to pass. By repeatedly passing this trap, players can gain up to 30,000 experience per hour as low as level 15 with the use of [[summer pie]] to boost your agility level. Bringing food is advised as you will occasionally fail the trap.

Approximately every 60 seconds a [[Pillar (Brimhaven Agility Arena)|pillar]] in the arena will activate and will improve experience rates if tagged, increasing by 30 experience every 10 levels. It will additionally reward the player with [[Agility arena ticket|Agility arena tickets]].

At level 40 you will be able to pass every obstacle in the arena, and you can then expect to gain around 45,000-50,000 experience per hour when tagging every pillar and using the floor spikes trap during the downtime. This is without the use of [[Karamja gloves]]; wearing [[Karamja gloves 2]] or above will increase the experience rates from passing obstacles and trading in tickets by 10%.

Additionally, the floor spike obstacle can be used, which is very low intensity and can achieve approximately 36,000 experience per hour. Using the "Detached Camera" plugin, you can click a single tile to repeatedly jump back and forth. If the nearby [[Ticket Dispenser|ticket dispensers]] are active, tagging them can provide some extra experience.

===Levels 47–62: Wilderness Agility Course===`;
const input={title:'Agility training',content:section,sourceRevision:'15324367',sourceTimestamp:'2026-08-29T09:28:52Z',sourceUrl:'https://oldschool.runescape.wiki/w/Agility_training'},parsed=parseAgilityBrimhavenGuideMembers(input),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};

check(parsed.audit.publishable===true&&parsed.audit.memberCount===3&&parsed.audit.paragraphCount===4&&parsed.audit.rateClaimCount===3,'The complete section must produce three strategies across all four source paragraphs and three rate claims.');
check(parsed.records.map(record=>record.memberKey).join('|')==='brimhaven-fastest:repeated-floor-spikes|brimhaven-fastest:pillars-with-floor-spike-downtime|brimhaven-fastest:detached-camera-floor-spikes','Distinct strategies must retain stable source order and identities.');
const repeated=parsed.records[0],pillars=parsed.records[1],detached=parsed.records[2];
check(repeated.minimumAgility===20&&repeated.boostedMinimumBaseAgility===15&&repeated.observedRate.maximum===30000&&repeated.observedRate.kind==='source_stated_upper_bound','Repeated floor spikes must keep base entry, boosted entry, and upper-bound semantics separate.');
check(pillars.minimumAgility===40&&pillars.observedRate.minimum===45000&&pillars.observedRate.maximum===50000&&pillars.observedRate.levelScope.minimum===40&&pillars.observedRate.levelScope.maximum===40,'The pillar strategy must keep its full range scoped only to the observed level.');
check(pillars.modifierAxes[0].bonusPercent===10&&pillars.modifierAxes[0].expectedXpPerHourPublished===false,'The glove modifier must not manufacture a total hourly rate.');
check(detached.observedRate.value===36000&&detached.optionalPolicyAxes[0].key==='nearby_ticket_dispenser_tagging'&&detached.optionalPolicyAxes[0].incrementalXpPerHourPublished===false,'Detached-camera tagging must retain its optional unquantified policy.');
check(parsed.records.every(record=>record.sourceRevision==='15324367'&&record.sourceLocator),'Every strategy must retain pinned provenance and an exact locator.');

const guideCandidates=parsed.records.map(record=>({candidate_key:record.candidateKey,source_section_key:record.sectionKey,source_revision:record.sourceRevision,name:record.name})),vectors=[
  {name:'Brimhaven Agility Arena — Active floor spikes — level 99 — elite diary',scenarioKey:'active:99'},
  {name:'Brimhaven Agility Arena — Active floor spikes — boosted 100+ — elite diary',scenarioKey:'active:100'},
  {name:'Brimhaven Agility Arena — Detached-camera floor spikes — Standard',scenarioKey:'detached:standard'},
  {name:'Brimhaven Agility Arena — Detached-camera floor spikes — Karamja gloves',scenarioKey:'detached:gloves'}
],coverage=auditAgilityBrimhavenGuideMemberCoverage({members:parsed.records,guideCandidates,vectors});
check(coverage.internalMemberAuditSatisfied===true&&coverage.memberCount===3&&coverage.coveredMemberCount===3&&coverage.uncoveredMemberCount===0&&coverage.sectionCandidateCount===3,'All three same-revision strategy candidates must satisfy member identity coverage.');
check(coverage.linkedVectorCount===4&&coverage.variantCompletenessProven===false&&coverage.mechanicalCompletenessProven===false,'Vector links must be visible without proving variant or mechanical completeness.');
const missingCandidate=auditAgilityBrimhavenGuideMemberCoverage({members:parsed.records,guideCandidates:guideCandidates.slice(0,2),vectors});
check(missingCandidate.internalMemberAuditSatisfied===false&&missingCandidate.memberDetails[2].blockers.includes('same_revision_guide_candidate_missing'),'A missing exact strategy candidate must block the member audit.');
const staleCandidate=auditAgilityBrimhavenGuideMemberCoverage({members:parsed.records,guideCandidates:guideCandidates.map(candidate=>candidate.candidate_key===pillars.candidateKey?{...candidate,source_revision:'older'}:candidate),vectors});
check(staleCandidate.internalMemberAuditSatisfied===false&&staleCandidate.memberDetails[1].blockers.includes('guide_candidate_revision_mismatch'),'A candidate from another guide revision must not satisfy the member.');
const unexpectedCandidate=auditAgilityBrimhavenGuideMemberCoverage({members:parsed.records,guideCandidates:[...guideCandidates,{candidate_key:'guide:brimhaven:invented',source_section_key:repeated.sectionKey,source_revision:'15324367'}],vectors});
check(unexpectedCandidate.blockers.includes('guide_section_candidate_not_present_in_member_inventory'),'An unexpected candidate linked to the section must fail closed.');

const sectionRecord={sectionKey:repeated.sectionKey,title:'Levels 20–47: Brimhaven Agility Arena',sourceOrder:2,sectionRole:'composite_method_section',repeatableTraining:true,requiresInternalMemberAudit:true,materialToCandidateUniverse:true,sourceRevision:'15324367',sourceUrl:input.sourceUrl,sourceLocator:{headingLine:1}},sectionCoverage=auditAgilityTrainingGuideSectionCoverage({sections:[sectionRecord],candidates:guideCandidates,memberAudits:[{sectionKey:repeated.sectionKey,complete:true,sourceRevision:'15324367',contentHash:'test',memberCount:3,coveredMemberCount:3,uncoveredMemberCount:0}]});
check(sectionCoverage.internalMemberAuditPendingCount===0&&sectionCoverage.sectionDetails[0].internalMemberAuditSatisfied===true,'A complete same-revision Brimhaven audit must clear only its linked composite gate.');

const extraParagraph=parseAgilityBrimhavenGuideMembers({...input,content:section.replace('\n===Levels 47','\n\nA new strategy appears.\n\n===Levels 47')});
check(extraParagraph.audit.publishable===false&&extraParagraph.audit.blockers.includes('brimhaven_fastest_section_paragraph_structure_changed'),'A new unclassified section paragraph must block publication.');
const missingPolicy=parseAgilityBrimhavenGuideMembers({...input,content:section.replace('If the nearby [[Ticket Dispenser|ticket dispensers]] are active, tagging them can provide some extra experience.','')});
check(missingPolicy.audit.publishable===false&&missingPolicy.audit.blockers.includes('detached_camera_optional_ticket_policy_missing_or_changed'),'Removing the optional ticket policy must fail closed.');
const wrongTitle=parseAgilityBrimhavenGuideMembers({...input,title:'Brimhaven Agility Arena'});
check(wrongTitle.audit.publishable===false&&wrongTitle.audit.blockers.includes('unexpected_source_title'),'An unexpected source title must fail closed.');

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Agility Brimhaven guide-member inventory and coverage checks passed.');
