import assert from 'node:assert/strict';
import {buildSkillTrainingGuideRenderInventory} from '../ingestion/skill-training-guide-rendered-link-lib.mjs';

const expectedGuides=[{pageId:100,title:'Guide',revision:'500',timestamp:'2026-01-01T00:00:00Z',contentHash:'guide-hash',skillKeys:['agility'],channels:['members']}];
const parserObservations=[{guidePageId:100,guideTitle:'Guide',requestedRevision:'500',guideTimestamp:'2026-01-01T00:00:00Z',guideContentHash:'guide-hash',guideUrl:'https://oldschool.runescape.wiki/w/Guide',skillKeys:['agility'],channels:['members'],observedAt:'2026-01-02T00:00:00Z',response:{pageid:100,title:'Guide',revid:500,links:[{ns:0,title:'Canonical target',exists:true},{ns:0,title:'Expanded target',exists:true},{ns:0,title:'Bad Title'}],categories:[{sortkey:'',category:'Training_guides'}],images:['Method.png'],templates:[{ns:10,title:'Template:SCP',exists:true},{ns:10,title:'Template:Navigation',exists:true}]}}];
const resolution=(requestedTitle,pageid)=>({requestedTitle,redirected:false,page:{pageid,title:requestedTitle,revisions:[{revid:pageid+1000,timestamp:'2026-01-02T00:00:00Z'}]}});
const linkTargetResolutions=[resolution('Canonical target',10),resolution('Expanded target',11),{requestedTitle:'Bad Title',page:{ns:0,title:'Bad Title',missing:true}},resolution('Category:Training guides',12),resolution('File:Method.png',13)];
const dependencyTargetResolutions=[resolution('Template:SCP',20),resolution('Template:Navigation',21)];
const directLinkRecords=[
  {namespaceClass:'main',targetPageIdentity:{sourcePageId:10},references:[{guidePageId:100,requestedTitle:'Redirect alias'}]},
  {namespaceClass:'main',targetPageIdentity:null,references:[{guidePageId:100,requestedTitle:'Bad Title'}]},
  {namespaceClass:'non_main',targetPageIdentity:{sourcePageId:12},references:[{guidePageId:100,requestedTitle:'Category:Training guides'}]},
  {namespaceClass:'non_main',targetPageIdentity:{sourcePageId:13},references:[{guidePageId:100,requestedTitle:'File:Method.png'}]}
];
const sourceDependencyRecords=[{targetPageIdentity:{sourcePageId:20},references:[{guidePageId:100,pageTitle:'Template:SCP'}]}];
const built=buildSkillTrainingGuideRenderInventory({expectedGuides,parserObservations,linkTargetResolutions,dependencyTargetResolutions,directLinkRecords,sourceDependencyRecords});

assert.equal(built.renderObservations.length,1);
assert.equal(built.renderedLinks.length,5);
assert.equal(built.audit.guideRenderCoverage.exactGuideRevisionSetMatch,true);
assert.equal(built.audit.renderedLinkObservationComplete,true);
assert.equal(built.audit.historicalDependencyRevisionClosureComplete,false);
assert.equal(built.audit.renderedOnlyOriginAttributionComplete,false);
assert.equal(built.audit.directSourceReconciliation.eligibleDirectSourceGuideTargetPairs,4);
assert.equal(built.audit.directSourceReconciliation.matchedDirectSourceGuideTargetPairs,4);
assert.equal(built.audit.directSourceReconciliation.stablePageIdMatches,3);
assert.equal(built.audit.directSourceReconciliation.exactTitleFallbackMatches,1);
assert.equal(built.audit.directSourceReconciliation.renderedOnlyOriginUnattributedObservations,1);
assert.equal(built.audit.renderedLinkCoverage.linkChannelObservations,3);
assert.equal(built.audit.renderedLinkCoverage.categoryChannelObservations,1);
assert.equal(built.audit.renderedLinkCoverage.imageChannelObservations,1);
assert.equal(built.audit.renderedLinkCoverage.parserExistenceNotReportedObservations,1);
assert.deepEqual(new Set(built.renderObservations[0].renderedLinks.map(row=>row.parserChannel)),new Set(['links','categories','images']));
assert.equal(built.audit.parserDependencyCoverage.directSourceDependencyPairs,1);
assert.equal(built.audit.parserDependencyCoverage.matchedDirectSourceDependencyPairs,1);
assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount,0);
assert.equal(built.renderedLinks.every(row=>row.optimizerEligible===false),true);
assert.equal(built.audit.publishable,false);

const missingResolution=buildSkillTrainingGuideRenderInventory({expectedGuides,parserObservations,linkTargetResolutions:linkTargetResolutions.slice(1),dependencyTargetResolutions,directLinkRecords,sourceDependencyRecords});
assert.equal(missingResolution.audit.renderedLinkObservationComplete,false);
assert.ok(missingResolution.audit.blockers.includes('one_or_more_rendered_links_lack_resolution_assessment'));

const revisionMismatch=structuredClone(parserObservations);revisionMismatch[0].response.revid=501;
const mismatch=buildSkillTrainingGuideRenderInventory({expectedGuides,parserObservations:revisionMismatch,linkTargetResolutions,dependencyTargetResolutions,directLinkRecords,sourceDependencyRecords});
assert.equal(mismatch.audit.renderedLinkObservationComplete,false);
assert.ok(mismatch.audit.blockers.includes('parser_returned_revision_mismatch'));

const accountInjected=structuredClone(parserObservations);accountInjected[0].accountState={level:34};
const accountBlocked=buildSkillTrainingGuideRenderInventory({expectedGuides,parserObservations:accountInjected,linkTargetResolutions,dependencyTargetResolutions,directLinkRecords,sourceDependencyRecords});
assert.equal(accountBlocked.audit.accountIndependent,false);
assert.equal(accountBlocked.audit.renderedLinkObservationComplete,false);
assert.ok(accountBlocked.audit.blockers.includes('account_query_state_baked_into_rendered_link_inventory'));

console.log('Cross-skill revision-pinned rendered-link observation checks passed.');
