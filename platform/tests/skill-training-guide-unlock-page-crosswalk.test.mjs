import assert from 'node:assert/strict';
import {auditSkillTrainingGuideUnlockPageCrosswalk,buildSkillTrainingGuideUnlockPageCrosswalk} from '../transforms/skill-training-guide-unlock-page-crosswalk-lib.mjs';

const identity=(sourcePageId,resolvedTitle,sourceRevision)=>({sourcePageId,resolvedTitle,redirected:false,sourceRevision,sourceTimestamp:'2026-01-01T00:00:00Z',sourceUrl:`https://oldschool.runescape.wiki/w/${resolvedTitle}`});
const rendered=(key,pageIdentity,title)=>({contract:'sensum.skill-training-guide-rendered-link.v1',renderedTargetKey:key,requestedTitles:[title],namespaceIds:[0],guideObservationCount:1,observations:[{guidePageId:10,guideTitle:'Guide',guideRevision:'100',guideContentHash:'guide-hash',parserObservedAt:'2026-01-02T00:00:00Z',parserChannel:'links',namespaceId:0,requestedTitle:title,parserReportedExists:pageIdentity!==null,parserMetadata:null,resolutionState:pageIdentity?'current_revision_pinned_page':'missing_wiki_page',sourcePresence:'rendered_only_origin_unattributed'}],targetPageIdentity:pageIdentity,sourcePresenceCounts:{direct_source_stable_page_id:0,direct_source_exact_mediawiki_title:0,rendered_only_origin_unattributed:1},canonicalActivityIdentity:null,repeatableTrainingActivity:null,optimizerEligible:false,accountIndependent:true,blockers:[],state:'blocked'});
const unlock=(pageId,title,revision,{typed=true,activity=false}={})=>({contract:'sensum.unlock-linked-page-wiki-equivalence.v1',canonicalWikiPageKey:`osrs-wiki-pageid:${pageId}`,sourcePageId:pageId,resolvedTitle:title,targetReferences:[{targetKey:`wiki-title:${title.toLowerCase()}`,requestedTitle:title,requestedFragment:null,redirected:false,referencedBy:{skillKeys:['agility'],statementKeys:['agility:members1:1']},entityTypes:typed?activity?['activity_page']:['item_page']:[],classificationState:typed?'typed':'untyped',activityPageCandidate:activity}],targetReferenceCount:1,entityTypes:typed?activity?['activity_page']:['item_page']:[],pageTypeClassified:typed,activityPageCandidate:activity,wikiPageEquivalenceEstablished:true,canonicalGameEntityIdentity:null,canonicalActivityIdentity:null,repeatableTrainingActivity:null,optimizerEligible:false,source:{sourceRevision:revision,sourceTimestamp:'2026-01-01T00:00:00Z',sourceUrl:`https://oldschool.runescape.wiki/w/${title}`,sourceContentHash:`hash-${pageId}`},accountIndependent:true,blockers:[],state:'blocked'});

const renderedLinkRecords=[
  rendered('wiki-pageid:1',identity(1,'Activity','11'),'Activity'),
  rendered('wiki-pageid:2',identity(2,'Untyped','22'),'Untyped'),
  rendered('wiki-pageid:3',identity(3,'Guide only','33'),'Guide only'),
  rendered('wiki-title:unlock only',null,'Unlock only')
];
const unlockEquivalenceRecords=[unlock(1,'Activity','11',{activity:true}),unlock(2,'Untyped','21',{typed:false}),unlock(4,'Unlock only','44')];
const built=buildSkillTrainingGuideUnlockPageCrosswalk({renderedLinkRecords,unlockEquivalenceRecords});

assert.equal(built.records.length,4);
assert.equal(built.audit.crosswalkCoverageComplete,true);
assert.equal(built.audit.publishable,true);
assert.equal(built.audit.renderedTargetCoverage.exactRenderedTargetSetAndContextMatch,true);
assert.equal(built.audit.crossSourceIdentityCoverage.exactStablePageIdMatchCount,2);
assert.equal(built.audit.crossSourceIdentityCoverage.renderedTargetsWithoutUnlockMatchCount,2);
assert.equal(built.audit.unlockEvidenceCoverage.unlockOnlyPageCount,1);
assert.equal(built.audit.revisionCoverage.sameRevisionMatchCount,1);
assert.equal(built.audit.revisionCoverage.differentRevisionMatchCount,1);
assert.equal(built.audit.semanticRoutingCoverage.typedCrossSourcePageCount,1);
assert.equal(built.audit.semanticRoutingCoverage.untypedCrossSourcePageCount,1);
assert.equal(built.audit.semanticRoutingCoverage.activityPageCandidateCount,1);
assert.equal(built.records.find(record=>record.renderedTargetKey==='wiki-title:unlock only').crossSourcePageIdentityEstablished,false);
assert.equal(built.audit.semanticRoutingCoverage.optimizerEligibleCount,0);
assert.equal(built.audit.completeActivityUniverse,false);

const altered=structuredClone(built.records);altered[0].renderedEvidence.observations[0].guideRevision='999';
const contextBlocked=auditSkillTrainingGuideUnlockPageCrosswalk(altered,{renderedLinkRecords,unlockEquivalenceRecords});
assert.equal(contextBlocked.crosswalkCoverageComplete,false);
assert.ok(contextBlocked.blockers.includes('one_or_more_rendered_contexts_changed'));

const promoted=structuredClone(built.records);promoted[0].optimizerEligible=true;
const promotionBlocked=auditSkillTrainingGuideUnlockPageCrosswalk(promoted,{renderedLinkRecords,unlockEquivalenceRecords});
assert.equal(promotionBlocked.crosswalkCoverageComplete,false);
assert.ok(promotionBlocked.blockers.includes('unsupported_crosswalk_semantic_promotion'));

const accountInjected=structuredClone(renderedLinkRecords);accountInjected[0].accountState={level:34};
const accountBlocked=buildSkillTrainingGuideUnlockPageCrosswalk({renderedLinkRecords:accountInjected,unlockEquivalenceRecords});
assert.equal(accountBlocked.audit.accountIndependent,false);
assert.equal(accountBlocked.audit.crosswalkCoverageComplete,false);
assert.ok(accountBlocked.audit.blockers.includes('account_query_state_baked_into_crosswalk'));

console.log('Cross-skill rendered-guide and unlock-page crosswalk checks passed.');
