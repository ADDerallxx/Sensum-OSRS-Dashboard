import {parseSkillLevelUnlockInventory,auditSkillLevelUnlockInventory} from '../ingestion/skill-level-unlock-inventory-lib.mjs';

const names=['Attack','Defence','Hitpoints','Magic','Prayer','Ranged','Strength','Farming','Fishing','Hunter','Mining','Woodcutting','Cooking','Crafting','Fletching','Herblore','Runecraft','Smithing','Agility','Construction','Firemaking','Sailing','Slayer','Thieving'],domains=names.map(skill=>({skillKey:skill.toLowerCase(),skill,category:'test',minimumBaseLevel:skill==='Hitpoints'?10:1,maximumBaseLevel:99})),content=`{{Level up table
|freeplayall =
* Each level improves a source-stated property
|members1 =
* Access {{plink|Example activity|pic=Example icon}} with [[Quest name|a quest]]
  and preserve this continuation line
|freeplay1 =
|members2 =
* Wield [[Example item]]
* Use [[Second example item]]
|freeplay2 = * Catch [[Inline source item]]
|members99 =
* Access [[Final activity]]
* Dye {{plinkp|Blue cape}} on [[Broken_Potter%27s_Wheel|a decoded target]]
}}`,page=skill=>({title:`${skill}/Level up table`,content,sourceRevision:`${skill}-revision`,sourceTimestamp:'2026-09-03T00:00:00Z',sourceUrl:`https://example.test/${skill}`}),failures=[],check=(condition,message)=>{if(!condition)failures.push(message)};
const record=parseSkillLevelUnlockInventory({domain:domains[0],page:page('Attack'),contentHash:'source-hash'});
check(record.rawInventoryComplete&&record.parameterCount===6,'Every supported top-level source parameter, including empty rows, must be captured.');
check(record.sourceBulletCount===7&&record.capturedStatementCount===7,'Every source bullet, including consecutive and inline entries, must be captured exactly once.');
check(record.parameters.find(row=>row.parameterName==='freeplay1')?.declaredEmpty===true,'Explicit empty level parameters must remain visible.');
const activity=record.parameters.find(row=>row.parameterName==='members1').entries[0];
check(activity.sourceText.includes('continuation line')&&activity.linkedTargets.includes('Example activity')&&activity.linkedTargets.includes('Quest name'),'Multiline statements and linked discovery targets must survive intact.');
check(activity.sourceLocator.lineEnd===activity.sourceLocator.lineStart+1,'Multiline statement locators must span their exact source lines.');
check(record.parameters.find(row=>row.parameterName==='members99').entries[1].linkedTargets.includes('Blue cape')&&record.parameters.find(row=>row.parameterName==='members99').entries[1].linkedTargets.includes("Broken Potter's Wheel"),'Plural-link templates and URI-encoded Wiki targets must retain canonical request titles for the identity crosswalk.');
check(activity.repeatableTrainingActivity===null&&activity.optimizerEligible===false&&activity.blockers.includes('semantic_identity_and_repeatability_not_classified'),'Raw unlock text must not be promoted into a verified activity identity.');
const records=domains.map(domain=>parseSkillLevelUnlockInventory({domain,page:page(domain.skill),contentHash:`hash-${domain.skill}`})),audit=auditSkillLevelUnlockInventory(records,domains);
check(audit.rawInventoryComplete&&audit.sourcePageCoverage.revisionPinnedPages===24,'All 24 revision-pinned skill pages must close the raw inventory gate.');
check(audit.statementCoverage.capturedStatementCount===168&&audit.statementCoverage.countsMatch,'Aggregate source and captured statement counts must match.');
check(audit.completeActivityUniverse===false&&audit.semanticallyClassifiedActivityCount===0&&audit.blockers.includes('level_up_tables_do_not_prove_complete_repeatable_activity_universe'),'Raw breadth must never masquerade as semantic or universe completeness.');
const unknown=parseSkillLevelUnlockInventory({domain:domains[0],page:{...page('Attack'),content:content.replace('|members2 =','|unexpected2 =')},contentHash:'hash'});
check(!unknown.rawInventoryComplete&&unknown.blockers.some(blocker=>blocker.startsWith('unknown_level_up_table_parameters:')),'Unknown template parameters must fail closed.');
const missing=auditSkillLevelUnlockInventory(records.slice(1),domains);
check(!missing.rawInventoryComplete&&missing.officialSkillDomain.missingSkillKeys.includes('attack'),'A missing official skill page must block the raw inventory.');
const polluted=auditSkillLevelUnlockInventory(records.map((row,index)=>index?row:{...row,currentBaseLevel:34}),domains);
check(!polluted.rawInventoryComplete&&polluted.blockers.includes('account_query_state_baked_into_unlock_inventory'),'Current account state must never filter reusable discovery evidence.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Cross-skill level-up-table raw discovery checks passed.');
