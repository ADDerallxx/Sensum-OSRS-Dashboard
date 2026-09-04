import assert from 'node:assert/strict';
import {auditCrossSourceEntityActivityCandidates,buildCrossSourceEntityActivityCandidates} from '../transforms/cross-source-entity-activity-candidate-lib.mjs';

const crosswalk=({key,pageId,title,matched=true,type='item_page',activity=false,renderedRevision='10',unlockRevision='10'})=>({
  contract:'sensum.skill-training-guide-unlock-page-crosswalk.v1',renderedTargetKey:key,sourcePageId:pageId,resolvedTitle:title,
  renderedEvidence:{requestedTitles:[title],namespaceIds:[0],guideObservationCount:1,observations:[{guideTitle:'Guide',guideRevision:'1',parserChannel:'links'}],sourcePresenceCounts:{direct_source_stable_page_id:1},targetPageIdentity:pageId?{sourcePageId:pageId,resolvedTitle:title,sourceRevision:renderedRevision}:null},
  unlockEvidence:matched?{canonicalWikiPageKey:`osrs-wiki-pageid:${pageId}`,sourcePageId:pageId,resolvedTitle:title,targetReferenceCount:1,targetReferences:[{targetKey:`target:${pageId}`,referencedBy:{skillKeys:['agility'],statementKeys:[`agility:${pageId}`]}}],entityTypes:type?[type]:[],pageTypeClassified:Boolean(type),activityPageCandidate:activity,source:{sourceRevision:unlockRevision}}:null,
  crossSourcePageIdentityEstablished:matched,revisionRelationship:!pageId?'rendered_target_unresolved':matched?(renderedRevision===unlockRevision?'same_revision':'different_revision'):'no_unlock_page_match',semanticRoutingState:!pageId?'rendered_target_unresolved':matched?activity?'cross_source_activity_page_candidate':type?'cross_source_typed_page':'cross_source_untyped_page':'rendered_stable_page_without_unlock_evidence',canonicalGameEntityIdentity:null,canonicalActivityIdentity:null,repeatableTrainingActivity:null,optimizerEligible:false,accountIndependent:true,blockers:[],state:'blocked'
});

const crosswalkRecords=[
  crosswalk({key:'wiki-pageid:1',pageId:1,title:'Activity',type:'activity_page',activity:true}),
  crosswalk({key:'wiki-pageid:2',pageId:2,title:'Item',type:'item_page'}),
  crosswalk({key:'wiki-pageid:3',pageId:3,title:'Untyped',type:null,renderedRevision:'30',unlockRevision:'31'}),
  crosswalk({key:'wiki-pageid:4',pageId:4,title:'Guide only',matched:false}),
  crosswalk({key:'wiki-title:missing',pageId:null,title:'Missing',matched:false})
];
const built=buildCrossSourceEntityActivityCandidates({crosswalkRecords});

assert.equal(built.records.length,5);
assert.equal(built.audit.candidateInventoryComplete,true);
assert.equal(built.audit.publishable,true);
assert.equal(built.audit.inputCoverage.exactTargetSetAndContextMatch,true);
assert.equal(built.audit.candidateCoverage.semanticReviewQueueCount,3);
assert.equal(built.audit.candidateCoverage.renderedPageWithoutUnlockMatchCount,1);
assert.equal(built.audit.candidateCoverage.unresolvedRenderedTargetCount,1);
assert.equal(built.audit.revisionCoverage.sameRevisionCandidateCount,2);
assert.equal(built.audit.revisionCoverage.differentRevisionCandidateCount,1);
assert.equal(built.audit.semanticReviewCoverage.activityDiscoveryCandidateCount,1);
assert.equal(built.audit.semanticReviewCoverage.typedNonActivityCandidateCount,1);
assert.equal(built.audit.semanticReviewCoverage.untypedCandidateCount,1);
assert.equal(built.records.find(record=>record.renderedTargetKey==='wiki-pageid:4').candidateKey,null);
assert.equal(built.records.find(record=>record.renderedTargetKey==='wiki-title:missing').queuedForSemanticReview,false);
assert.equal(built.audit.semanticReviewCoverage.canonicalGameEntityIdentityCount,0);
assert.equal(built.audit.semanticReviewCoverage.optimizerEligibleCount,0);
assert.equal(built.audit.completeActivityUniverse,false);

const altered=structuredClone(built.records);altered[0].sourceContexts.renderedEvidence.observations[0].guideRevision='999';
const contextBlocked=auditCrossSourceEntityActivityCandidates(altered,{crosswalkRecords});
assert.equal(contextBlocked.candidateInventoryComplete,false);
assert.ok(contextBlocked.blockers.includes('one_or_more_crosswalk_source_contexts_changed'));

const illegallyQueued=structuredClone(built.records);const unmatched=illegallyQueued.find(record=>record.renderedTargetKey==='wiki-pageid:4');unmatched.candidateKey='osrs-wiki-pageid:4';unmatched.queuedForSemanticReview=true;unmatched.reviewStatus='unreviewed';
const queueBlocked=auditCrossSourceEntityActivityCandidates(illegallyQueued,{crosswalkRecords});
assert.equal(queueBlocked.candidateInventoryComplete,false);
assert.ok(queueBlocked.blockers.includes('one_or_more_semantic_review_routes_invalid'));

const activityPromoted=structuredClone(built.records);activityPromoted.find(record=>record.renderedTargetKey==='wiki-pageid:2').activityDiscoveryCandidate=true;
const activityBlocked=auditCrossSourceEntityActivityCandidates(activityPromoted,{crosswalkRecords});
assert.equal(activityBlocked.candidateInventoryComplete,false);
assert.ok(activityBlocked.blockers.includes('one_or_more_activity_candidate_routes_invalid'));

const optimizerPromoted=structuredClone(built.records);optimizerPromoted[0].optimizerEligible=true;
const promotionBlocked=auditCrossSourceEntityActivityCandidates(optimizerPromoted,{crosswalkRecords});
assert.equal(promotionBlocked.candidateInventoryComplete,false);
assert.ok(promotionBlocked.blockers.includes('unsupported_canonical_or_optimizer_promotion'));

const accountInjected=structuredClone(crosswalkRecords);accountInjected[0].accountState={level:34};
const accountBlocked=buildCrossSourceEntityActivityCandidates({crosswalkRecords:accountInjected});
assert.equal(accountBlocked.audit.accountIndependent,false);
assert.equal(accountBlocked.audit.candidateInventoryComplete,false);
assert.ok(accountBlocked.audit.blockers.includes('account_query_state_baked_into_candidate_inventory'));

console.log('Cross-source entity and activity semantic-review candidate checks passed.');
