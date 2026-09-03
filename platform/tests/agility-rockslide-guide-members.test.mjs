import {parseAgilityRockslideGuideMembers} from '../ingestion/agility-rockslide-guide-member-lib.mjs';
import {auditAgilityRockslideGuideMemberCoverage} from '../transforms/agility-rockslide-guide-member-coverage-lib.mjs';
import {auditAgilityTrainingGuideSectionCoverage} from '../transforms/agility-training-guide-section-coverage-lib.mjs';

const section=`=== Levels 78+: Rockslide + Other Activities ===
After completion of [[The Blood Moon Rises]] you can mix other activities with the [[Rockslide (Vampyrium)]] shortcut which grants 550 experience every ~7.5 minutes. Teleporting to Vampyrium using [[Drakan's medallion]] and navigating the shortcut takes around 17-20 seconds, for "effective" experience per hour of 100,000-120,000. Using the shortcut diligently will net players 3,500 to 4,000 extra experience each hour.

In order to be effective the activity you are returning to must have teleportation nearby. It is effective to combine this method with the [[Ardougne Rooftop Course]] (with teleport) or [[Hallowed Sepulchre]] (with [[Hallowed crystal shard]]), however the latter does use Hallowed tokens which may not be desirable. Note that as a hybrid method this is not limited to Agility, for instance you could train [[Runecraft]] with the medallion in the neck slot. In such a case a teleport would be saved as you already needed one teleport to return to a bank, rather than one teleport to go to Vampyrium and another to return.

To maximise marks of grace whilst running agility laps you should delay teleporting until the next Mark of Grace spawns and you have finished the lap. This ensures the 3 minute mark cooldown is counting down while you are away from the course, so should not decrease your overall marks/hr.
==Other methods==`,input={title:'Agility training',content:section,sourceRevision:'15324367',sourceTimestamp:'2026-08-29T09:28:52Z',sourceUrl:'https://oldschool.runescape.wiki/w/Agility_training'},parsed=parseAgilityRockslideGuideMembers(input),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},member=key=>parsed.records.find(record=>record.memberKey===key);

check(parsed.audit.publishable===true&&parsed.audit.namedMemberCount===4&&parsed.audit.paragraphCount===3,'The exact three-paragraph section must publish four named members.');
check(parsed.audit.sourceOpenEndedPairingUniverse===true&&parsed.audit.coverageLimitations.includes('rockslide_paired_activity_universe_open_ended'),'Named-member publication must preserve the open-ended pairing-universe limitation.');
check(parsed.records.every(record=>record.sourceRevision==='15324367'&&record.sourceUrl===input.sourceUrl&&record.sourceLocator?.line),'Every member must retain pinned provenance and a source locator.');
const core=member('rockslide:core-detour');
check(core.minimumAgility===78&&core.xpPerDetour===550&&core.sourceIntervalMinutesApproximate===7.5&&core.detourSecondsRange.minimum===17&&core.detourSecondsRange.maximum===20,'Core detour timing and XP must remain exact source facts.');
check(core.effectiveXpPerHourRange.minimum===100000&&core.effectiveXpPerHourRange.maximum===120000&&core.incrementalXpPerHourRange.minimum===3500&&core.incrementalXpPerHourRange.maximum===4000&&core.effectiveRateIsNotSustainedTrainingRate===true,'Effective and incremental rates must remain distinct.');
const ardougne=member('rockslide:pairing:ardougne-rooftop');
check(ardougne.returnTeleportIdentityPublished===false&&ardougne.optionalPolicyAxes[0].markCooldownMinutes===3&&ardougne.optionalPolicyAxes[0].marksPerHourEffect==='source_expected_not_to_decrease','Ardougne must preserve the unnamed teleport and scoped marks policy.');
const hallowed=member('rockslide:pairing:hallowed-sepulchre');
check(hallowed.returnTeleportItem==='Hallowed crystal shard'&&hallowed.tokenCostPerCyclePublished===false,'Hallowed must retain the named shard without inventing token cost.');
const runecraft=member('rockslide:pairing:runecraft-bank-return');
check(runecraft.specificActivityPublished===false&&runecraft.pairingPolicy==='generic_skill_example_reusing_bank_return_teleport','Runecraft must remain a generic example, not a fabricated method.');

const guideCandidates=parsed.records.map(record=>({candidate_key:record.candidateKey,source_section_key:record.sectionKey,source_revision:record.sourceRevision})),coverage=auditAgilityRockslideGuideMemberCoverage({members:parsed.records,guideCandidates});
check(coverage.namedMemberIdentitySatisfied===true&&coverage.coveredNamedMemberCount===4,'All four named members must match exactly one same-revision guide candidate.');
check(coverage.pairedActivityUniverseComplete===false&&coverage.internalMemberAuditSatisfied===false&&coverage.blockers.includes('rockslide_paired_activity_universe_open_ended'),'Open source language must keep the internal universe audit blocked after named identity coverage.');
const missing=auditAgilityRockslideGuideMemberCoverage({members:parsed.records,guideCandidates:guideCandidates.slice(1)});
check(missing.namedMemberIdentitySatisfied===false&&missing.blockers.includes('one_or_more_rockslide_named_members_lack_exact_same_revision_candidate'),'A missing named candidate must fail identity coverage.');
const stale=auditAgilityRockslideGuideMemberCoverage({members:parsed.records,guideCandidates:guideCandidates.map((candidate,index)=>index?candidate:{...candidate,source_revision:'older'})});
check(stale.namedMemberIdentitySatisfied===false&&stale.memberDetails[0].blockers.includes('guide_candidate_revision_mismatch'),'A stale candidate must not cover a named member.');
const unexpected=auditAgilityRockslideGuideMemberCoverage({members:parsed.records,guideCandidates:[...guideCandidates,{candidate_key:'guide:rockslide-pairing:unreviewed',source_section_key:core.sectionKey,source_revision:core.sourceRevision}]});
check(unexpected.namedMemberIdentitySatisfied===false&&unexpected.blockers.includes('guide_section_candidate_not_present_in_named_member_inventory'),'An unexpected same-section candidate must fail closed.');

const sectionCoverage=auditAgilityTrainingGuideSectionCoverage({sections:[{sectionKey:core.sectionKey,title:'Levels 78+: Rockslide + Other Activities',sourceOrder:5,sectionRole:'composite_method_section',repeatableTraining:true,requiresInternalMemberAudit:true,materialToCandidateUniverse:true,sourceRevision:core.sourceRevision,sourceUrl:core.sourceUrl,sourceLocator:{headingLine:1}}],candidates:guideCandidates,memberAudits:[{sectionKey:core.sectionKey,complete:false,sourceRevision:core.sourceRevision,contentHash:'test',memberCount:4,coveredMemberCount:4,uncoveredMemberCount:0}]});
check(sectionCoverage.internalMemberAuditPendingCount===1&&sectionCoverage.sectionDetails[0].internalMemberAuditSatisfied===false,'Named identity coverage must not clear the Rockslide section gate.');

for(const [changed,blocker] of [[section.replace(/\n\nIn order to be effective[\s\S]*?(?=\n\nTo maximise)/,''),'rockslide_named_pairings_missing_or_changed'],[section.replace(/\n\nTo maximise[\s\S]*?(?=\n==Other methods==)/,''),'rockslide_marks_policy_missing_or_changed'],[section.replace('\n==Other methods==','\n\nA fourth paragraph.\n==Other methods=='),'rockslide_section_paragraph_structure_changed']]){const result=parseAgilityRockslideGuideMembers({...input,content:changed});check(result.audit.publishable===false&&result.audit.blockers.includes(blocker),`${blocker} must block publication.`)}
check(parseAgilityRockslideGuideMembers({...input,title:'Wrong title'}).audit.blockers.includes('unexpected_source_title'),'Wrong page identity must fail closed.');

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Agility Rockslide named-member and open-universe checks passed.');
