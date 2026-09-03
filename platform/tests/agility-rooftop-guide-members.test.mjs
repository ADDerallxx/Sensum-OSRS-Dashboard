import {parseAgilityRooftopGuideMembers} from '../ingestion/agility-rooftop-guide-member-lib.mjs';
import {auditAgilityRooftopGuideMemberCoverage} from '../transforms/agility-rooftop-guide-member-coverage-lib.mjs';
import {auditAgilityTrainingGuideSectionCoverage} from '../transforms/agility-training-guide-section-coverage-lib.mjs';

const names=['Draynor Village Rooftop Course','Al Kharid Rooftop Course','Varrock Rooftop Course','Canifis Rooftop Course','Falador Rooftop Course',"Seers' Village Rooftop Course",'Pollnivneach Rooftop Course','Rellekka Rooftop Course','Ardougne Rooftop Course'];
const levelLabels=['1–20/30','20–30','30–40','40–50','50–60','60–70','70–80/90','80–90','90–99'];
const rows=names.map((name,index)=>`|-\n|${levelLabels[index]}\n|[[${name}]]`).join('\n');
const source=`==Other methods==\n===Levels 1–99: Rooftop Agility Courses===\n{| class="wikitable"\n!Level!!Course\n${rows}\n|}\n===Levels 40+: Another method===\nText`;
const input={title:'Agility training',content:source,sourceRevision:'15324367',sourceTimestamp:'2026-08-29T09:28:52Z',sourceUrl:'https://oldschool.runescape.wiki/w/Agility_training'};
const parsed=parseAgilityRooftopGuideMembers(input),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};

check(parsed.audit.publishable===true&&parsed.records.length===9,'The pinned Rooftop table must yield all nine expected members.');
check(parsed.records.every((record,index)=>record.courseName===names[index]&&record.sourceOrder===index&&record.sourceRevision==='15324367'),'Member identity, order, and revision must match the source table exactly.');
check(parsed.records.every(record=>record.sourceLocator.section==='Levels 1–99: Rooftop Agility Courses'&&record.sourceLocator.row===record.courseName),'Every member must retain a row-specific source locator.');

const courseTable=names.map((name,index)=>({name,record_key:`course:${index}`}));
const vectors=names.flatMap((name,index)=>index<5?[{name,scenarioKey:`vector:${index}:base`}]:[{name,scenarioKey:`vector:${index}:base`},{name:`${name} — verified modifier`,scenarioKey:`vector:${index}:modifier`}]);
const guideCandidates=names.slice(0,3).map((name,index)=>({name,candidate_key:`guide:${index}`}));
const coverage=auditAgilityRooftopGuideMemberCoverage({members:parsed.records,courseTable,guideCandidates,vectors});
check(coverage.internalMemberAuditSatisfied===true&&coverage.memberCount===9&&coverage.coveredMemberCount===9&&coverage.uncoveredMemberCount===0,'All nine guide members must cross-check against the structured table and detailed vectors.');
check(coverage.rooftopVectorCount===13&&coverage.guideCandidateMemberCount===3,'Vector variants and target-query guide links must be counted without requiring one candidate per member.');
check(coverage.variantAndMechanicalCompletenessProven===false&&coverage.absoluteBestGate==='member_identity_coverage_satisfied_only','Identity coverage must not overclaim variant or mechanical completeness.');

const missingVector=auditAgilityRooftopGuideMemberCoverage({members:parsed.records,courseTable,guideCandidates,vectors:vectors.filter(vector=>!vector.name.startsWith('Ardougne Rooftop Course'))});
check(missingVector.internalMemberAuditSatisfied===false&&missingVector.memberDetails.find(member=>member.courseName==='Ardougne Rooftop Course')?.blockers.includes('detailed_activity_vector_missing'),'A member without a detailed vector must remain a named blocker.');
const unexpected=auditAgilityRooftopGuideMemberCoverage({members:parsed.records,courseTable:[...courseTable,{name:'Imaginary Rooftop Course',record_key:'course:unexpected'}],guideCandidates,vectors:[...vectors,{name:'Imaginary Rooftop Course',scenarioKey:'vector:unexpected'}]});
check(unexpected.blockers.includes('structured_course_not_present_in_guide_member_inventory')&&unexpected.blockers.includes('rooftop_vector_not_present_in_guide_member_inventory'),'Unexpected structured courses and vectors must fail closed.');

const sectionKey='other-methods:levels-1-99-rooftop-agility-courses',section={sectionKey,title:'Levels 1–99: Rooftop Agility Courses',sourceOrder:1,sectionRole:'method_collection',repeatableTraining:true,requiresInternalMemberAudit:true,materialToCandidateUniverse:true,sourceRevision:'15324367',sourceUrl:input.sourceUrl,sourceLocator:{headingLine:2}},candidate={candidate_key:'guide:rooftop',name:'Rooftop courses',source_section_key:sectionKey};
const sectionCoverage=auditAgilityTrainingGuideSectionCoverage({sections:[section],candidates:[candidate],memberAudits:[{sectionKey,complete:true,sourceRevision:'15324367',contentHash:'test',memberCount:9,coveredMemberCount:9,uncoveredMemberCount:0}]});
check(sectionCoverage.internalMemberAuditPendingCount===0&&sectionCoverage.sectionDetails[0].internalMemberAuditSatisfied===true,'A complete same-revision member audit must clear only its linked collection pending state.');
const staleSectionCoverage=auditAgilityTrainingGuideSectionCoverage({sections:[section],candidates:[candidate],memberAudits:[{sectionKey,complete:true,sourceRevision:'older'}]});
check(staleSectionCoverage.internalMemberAuditPendingCount===1&&staleSectionCoverage.sectionDetails[0].memberAudit.revisionMatches===false,'A member audit from another guide revision must not clear the collection gate.');

const missingRow=parseAgilityRooftopGuideMembers({...input,content:source.replace(`|-\n|${levelLabels[8]}\n|[[${names[8]}]]\n`,'')});
check(missingRow.audit.publishable===false&&missingRow.audit.blockers.includes('one_or_more_expected_rooftop_rows_missing'),'A removed expected row must block publication.');
const reordered=parseAgilityRooftopGuideMembers({...input,content:source.replace(names[0],'Swap').replace(names[1],names[0]).replace('Swap',names[1])});
check(reordered.audit.publishable===false&&reordered.audit.blockers.includes('rooftop_row_order_changed'),'A reordered source table must require review.');
const wrongTitle=parseAgilityRooftopGuideMembers({...input,title:'Rooftop Agility Courses'});
check(wrongTitle.audit.publishable===false&&wrongTitle.audit.blockers.includes('unexpected_source_title'),'An unexpected source title must fail closed.');

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Agility Rooftop guide-member inventory and coverage checks passed.');
