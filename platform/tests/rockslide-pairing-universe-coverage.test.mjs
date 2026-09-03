import {auditRockslidePairingUniverseCoverage,FULL_ACTIVITY_SCOPE,FULL_TRANSPORT_SCOPE,findEmbeddedAccountQueryState} from '../transforms/rockslide-pairing-universe-coverage-lib.mjs';

const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},sourceRef={sourceRevision:'1',sourceUrl:'https://example.test/source',sourceLocator:{line:1}};
const skillDomains=['Agility','Runecraft'].map(skill=>({skill,skillKey:skill.toLowerCase(),minimumBaseLevel:1,maximumBaseLevel:99,sourceRevision:'1',sourceUrl:'https://example.test/skills',sourceLocator:{evidence:[{line:1}]}}));
const activity=(activityKey,name,skillKeys,locationKey)=>({activityKey,name,skillKeys,repeatable:true,locations:[{locationKey,returnEligible:true}],cyclePolicy:{interruptWindows:['cycle_boundary'],returnState:'cycle_start',bankReturnBehavior:{required:false,returnTeleportReusable:false}},requirements:[],unresolvedMechanics:[],sourceRefs:[sourceRef]});
const activities=[activity('agility:ardougne','Ardougne Rooftop Course',['agility'],'ardy:start'),activity('agility:hallowed','Hallowed Sepulchre',['agility'],'sepulchre:start'),activity('runecraft:test','Synthetic Runecraft method',['runecraft'],'bank:test')];
const activityUniverse={contract:'sensum.activity-universe.v1',scope:FULL_ACTIVITY_SCOPE,complete:true,activities,skillCoverage:[{skillKey:'agility',complete:true,activityKeys:['agility:ardougne','agility:hallowed'],sourceRefs:[sourceRef]},{skillKey:'runecraft',complete:true,activityKeys:['runecraft:test'],sourceRefs:[sourceRef]}],sourceRefs:[sourceRef]};
const pathRecord=(pathKey,destinationLocationKey)=>({contract:'sensum.transportation-path.v1',pathKey,originLocationKey:'rockslide:exit',destinationLocationKey,transportKinds:['teleport'],timing:{ticks:5},cost:{gp:0,items:[]},consumption:{charges:0,items:[]},equipmentSlots:[],requirements:[],bankInteraction:{arrivesAtBank:false,reusesRequiredBankReturn:false},unresolvedMechanics:[],sourceRefs:[sourceRef]});
const paths=[pathRecord('path:ardy','ardy:start'),pathRecord('path:sepulchre','sepulchre:start'),pathRecord('path:bank','bank:test'),{...pathRecord('path:drakan','rockslide:exit'),originLocationKey:'transport:anywhere',equipmentSlots:['neck']}];
const rockslideContext={exitLocationKey:'rockslide:exit',outboundPathKey:'path:drakan',requiredEquipmentSlots:['neck'],unresolvedMechanics:[],sourceRefs:[sourceRef]};
const transportationUniverse={contract:'sensum.transportation-universe.v1',scope:FULL_TRANSPORT_SCOPE,complete:true,paths,rockslideContext,sourceRefs:[sourceRef]};
const pairingAssessments=[['agility:ardougne','path:ardy'],['agility:hallowed','path:sepulchre'],['runecraft:test','path:bank']].map(([activityKey,pathKey])=>({activityKey,decision:'compatible',decisionReasons:['verified_return_path_reaches_activity'],evaluatedReturnPathKeys:[pathKey],compatibleReturnPathKeys:[pathKey],equipmentConflict:{status:'compatible',conflictingSlots:[],reasonCodes:['no_required_activity_slot_conflict']},sourceRefs:[sourceRef]}));
const namedGuideMembers=['rockslide:core-detour','rockslide:pairing:ardougne-rooftop','rockslide:pairing:hallowed-sepulchre','rockslide:pairing:runecraft-bank-return'].map(memberKey=>({memberKey,sourceRevision:'1',sourceUrl:'https://example.test/guide',sourceLocator:{line:1},...(memberKey.includes('ardougne')?{pairedActivity:'Ardougne Rooftop Course'}:memberKey.includes('hallowed')?{pairedActivity:'Hallowed Sepulchre'}:{})}));
const input={skillDomains,rockslideContext,activityUniverse,transportationUniverse,pairingAssessments,namedGuideMembers};
const complete=auditRockslidePairingUniverseCoverage(input);
check(complete.identityUniverseComplete===true&&complete.mechanicalCoverageComplete===true&&complete.absoluteBestGate==='eligible_for_pairing_golden_review','A source-complete synthetic universe must prove the audit can pass without account state.');
check(complete.officialSkillDomain.skillCount===2&&complete.activityUniverse.skillsCovered===2&&complete.pairingAssessments.assessmentCount===3,'Coverage counts must remain explicit.');
check(complete.namedGuideRegression.examplesAreUniverseSeeds===false,'Named guide examples must remain regression expectations, never universe seeds.');

const handPicked=auditRockslidePairingUniverseCoverage({...input,activityUniverse:{...activityUniverse,scope:'selected_guide_examples',complete:true,activities:activities.slice(0,2),skillCoverage:activityUniverse.skillCoverage.slice(0,1)},pairingAssessments:pairingAssessments.slice(0,2)});
check(handPicked.identityUniverseComplete===false&&handPicked.blockers.includes('activity_universe_scope_is_not_full_game')&&handPicked.blockers.includes('one_or_more_official_skills_lack_activity_coverage'),'A hand-picked one-skill shortlist must never prove full-game coverage.');

const accountScoped=structuredClone(input);accountScoped.activityUniverse.activities[0].currentBaseLevel=78;
const accountResult=auditRockslidePairingUniverseCoverage(accountScoped);
check(accountResult.identityUniverseComplete===false&&accountResult.blockers.includes('account_query_state_baked_into_activity_universe'),'Reusable activity coverage must reject a baked-in current account level.');
check(findEmbeddedAccountQueryState([{activityKey:'x',nested:{targetBaseLevel:34}}])[0]?.path==='nested.targetBaseLevel','Nested account-query fields must be found, not merely top-level fields.');

const missingAssessment=auditRockslidePairingUniverseCoverage({...input,pairingAssessments:pairingAssessments.slice(1)});
check(missingAssessment.identityUniverseComplete===false&&missingAssessment.blockers.includes('one_or_more_activities_lack_pairing_assessment'),'Every repeatable activity must be assessed exactly once.');

const unsourcedAssessment=structuredClone(input);delete unsourcedAssessment.pairingAssessments[0].sourceRefs;
const unsourcedResult=auditRockslidePairingUniverseCoverage(unsourcedAssessment);
check(unsourcedResult.identityUniverseComplete===false&&unsourcedResult.blockers.includes('one_or_more_pairing_assessments_are_invalid'),'A pairing inclusion or exclusion without revision-pinned evidence must fail closed.');

const unassessedPath=structuredClone(input);unassessedPath.transportationUniverse.paths.push(pathRecord('path:ardy:alternate','ardy:start'));
const pathResult=auditRockslidePairingUniverseCoverage(unassessedPath);
check(pathResult.identityUniverseComplete===false&&pathResult.blockers.includes('one_or_more_relevant_return_paths_are_unassessed'),'Every relevant return path must be assessed rather than silently ignored.');

const incompleteMechanics=structuredClone(input);incompleteMechanics.transportationUniverse.paths[0].timing=null;incompleteMechanics.transportationUniverse.paths[0].unresolvedMechanics=['timing_ticks_not_published'];
const mechanicalResult=auditRockslidePairingUniverseCoverage(incompleteMechanics);
check(mechanicalResult.identityUniverseComplete===true&&mechanicalResult.mechanicalCoverageComplete===false&&mechanicalResult.blockers.includes('one_or_more_transport_paths_have_incomplete_mechanics')&&mechanicalResult.blockers.includes('rockslide_pairing_mechanics_incomplete'),'A closed identity universe must remain separate from unresolved performance mechanics.');

const missingNamed=auditRockslidePairingUniverseCoverage({...input,namedGuideMembers:namedGuideMembers.slice(0,3)});
check(missingNamed.identityUniverseComplete===false&&missingNamed.blockers.includes('named_rockslide_guide_regression_members_missing_or_changed'),'Independent discovery must still retain all source-named regression examples.');

const noUniverse=auditRockslidePairingUniverseCoverage({skillDomains,namedGuideMembers,observedActivityCorpus:{recordCount:82,skillCount:1,skills:['Agility'],canProveCompleteActivityUniverse:false}});
check(noUniverse.identityUniverseComplete===false&&noUniverse.activityUniverse.activityCount===0&&noUniverse.blockers.includes('activity_universe_not_declared_complete')&&noUniverse.blockers.includes('transportation_universe_not_declared_complete')&&noUniverse.blockers.includes('pairing_assessment_set_missing_or_empty'),'Existing golden vectors alone must not masquerade as a complete activity, transport, or pairing universe.');

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Rockslide full-activity and transport-universe coverage checks passed.');
