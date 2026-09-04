import {auditSkillTrainingGuideDirectLinkInventory,buildSkillTrainingGuideDirectLinkInventory,parseSkillTrainingGuideDirectLinks} from '../ingestion/skill-training-guide-direct-link-lib.mjs';

const source=(title,pageId,revision,content,skillKeys,channels)=>({title,sourcePageId:pageId,sourceRevision:revision,sourceTimestamp:'2026-09-04T00:00:00Z',sourceUrl:`https://example.test/${pageId}`,sourceContentHash:`hash-${pageId}`,content,skillKeys,channels});
const guidePages=[source('Guide One',1,'11','[[Course|course]] [[Item#Part]] [[Category:Training]] [[#Notes]] [[{{#var:item}}]] [[Kourend %26 Kebos Diary]] <!-- [[Hidden]] --> <nowiki>[[Ignored]]</nowiki>',['agility'],['members']),source('Guide Two',2,'22','[[Course]] and [[Other item]].',['attack','strength'],['members','free_to_play'])];
const expectedGuides=guidePages.map(page=>({resolvedTitle:page.title,sourceRevision:page.sourceRevision}));
const resolution=(requestedTitle,pageid)=>({requestedTitle,redirected:false,page:{pageid,title:requestedTitle,revisions:[{revid:pageid+1000,timestamp:'2026-09-04T00:00:00Z'}]}});
const targetResolutions=[resolution('Course',100),resolution('Item',101),resolution('Other item',102),resolution('Kourend & Kebos Diary',103)];
const unlockEquivalenceRecords=[{sourcePageId:100,canonicalWikiPageKey:'osrs-wiki-pageid:100',resolvedTitle:'Course',entityTypes:['activity_page'],activityPageCandidate:true}];
const failures=[],check=(condition,message)=>{if(!condition)failures.push(message)};

const parsed=parseSkillTrainingGuideDirectLinks(guidePages[0]);
check(parsed.occurrences.length===6&&parsed.audit.balancedSourceLinkDelimiters,'Only direct source wikilinks outside comments and literal-code regions must be parsed.');
check(parsed.occurrences.some(row=>row.namespaceClass==='non_main'&&row.requestedTitle==='Category:Training'),'Non-main namespace links must remain explicit.');
check(parsed.occurrences.some(row=>row.namespaceClass==='in_page_fragment'&&row.requestedFragment==='Notes'),'In-page fragments must remain explicit without external resolution.');
check(parsed.occurrences.some(row=>row.namespaceClass==='dynamic_target'&&row.sourceTarget==='{{#var:item}}'),'Source-dynamic link targets must remain visible without being sent to static page resolution.');
check(parsed.occurrences.some(row=>row.requestedTitle==='Kourend & Kebos Diary'&&row.sourceTarget==='Kourend %26 Kebos Diary'),'Source-authored URI escapes must decode for exact Wiki title resolution while retaining the original target text.');

const built=buildSkillTrainingGuideDirectLinkInventory({expectedGuides,guidePages,targetResolutions,unlockEquivalenceRecords}),course=built.records.find(row=>row.requestedTitles.includes('Course')),category=built.records.find(row=>row.namespaceClass==='non_main'),fragment=built.records.find(row=>row.namespaceClass==='in_page_fragment'),dynamic=built.records.find(row=>row.namespaceClass==='dynamic_target');
check(built.audit.inventoryFoundationComplete&&built.audit.publishable,'A complete revision-matched guide and target inventory must publish as discovery evidence.');
check(built.audit.guideCoverage.expectedUniqueGuideRevisions===2&&built.audit.guideCoverage.exactGuideRevisionSetMatch,'Every expected guide revision must be fetched exactly once.');
check(built.audit.directLinkCoverage.parsedOccurrenceCount===8&&built.audit.directLinkCoverage.preservedOccurrenceCount===8&&built.audit.directLinkCoverage.dynamicTargetCount===1&&built.audit.directLinkCoverage.exactOccurrenceSetMatch,'Every static and dynamic direct link occurrence must survive aggregation exactly once.');
check(course.referenceCount===2&&course.unlockEquivalence.matched&&course.unlockEquivalence.sourcePageId===100&&course.unlockEquivalence.activityPageCandidate,'Guide and unlock records may intersect only through the same stable Wiki page ID.');
check(category.resolutionState==='not_applicable_non_main'&&fragment.resolutionState==='not_applicable_in_page_fragment'&&dynamic.resolutionState==='not_applicable_dynamic_target','Non-main, self-fragment, and dynamic links must remain visible without fake page resolution.');
check(built.audit.semanticPromotionCoverage.canonicalActivityIdentityCount===0&&built.audit.semanticPromotionCoverage.repeatabilityProvenCount===0&&built.audit.semanticPromotionCoverage.optimizerEligibleActivityCount===0&&built.audit.completeActivityUniverse===false,'Guide links and exact stable-ID overlap must not promote canonical or repeatable activities.');

const missingResolution=buildSkillTrainingGuideDirectLinkInventory({expectedGuides,guidePages,targetResolutions:targetResolutions.slice(1),unlockEquivalenceRecords});
check(!missingResolution.audit.inventoryFoundationComplete&&missingResolution.audit.blockers.includes('one_or_more_main_namespace_targets_lack_resolution_assessment'),'A missing main-namespace resolution assessment must fail closed.');
const redLinkResolutions=targetResolutions.map(row=>row.requestedTitle==='Other item'?{requestedTitle:'Other item',redirected:false,page:{title:'Other item',missing:true}}:row),redLink=buildSkillTrainingGuideDirectLinkInventory({expectedGuides,guidePages,targetResolutions:redLinkResolutions,unlockEquivalenceRecords});
check(!redLink.audit.inventoryFoundationComplete&&!redLink.audit.publishable&&redLink.audit.blockers.includes('one_or_more_main_namespace_targets_are_missing'),'A source-authored link to a missing Wiki page must remain an explicit publication blocker.');
const unstable=built.records.map(row=>row.targetKey===course.targetKey?{...row,unlockEquivalence:{...row.unlockEquivalence,sourcePageId:999}}:row),unstableAudit=auditSkillTrainingGuideDirectLinkInventory(unstable,{expectedGuides,guidePages,guideAudits:guidePages.map(page=>parseSkillTrainingGuideDirectLinks(page).audit)});
check(!unstableAudit.publishable&&unstableAudit.blockers.includes('unlock_intersection_not_supported_by_stable_page_id'),'A title-like match with a different stable page ID must fail publication.');
const polluted=built.records.map((row,index)=>index?row:{...row,currentBaseLevel:34}),pollutedAudit=auditSkillTrainingGuideDirectLinkInventory(polluted,{expectedGuides,guidePages,guideAudits:guidePages.map(page=>parseSkillTrainingGuideDirectLinks(page).audit)});
check(!pollutedAudit.publishable&&pollutedAudit.blockers.includes('account_query_state_baked_into_guide_link_inventory'),'Account query state must never enter reusable guide-link discovery evidence.');

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Cross-skill training-guide direct-link discovery checks passed.');
