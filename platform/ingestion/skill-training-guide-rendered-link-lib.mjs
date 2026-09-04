import {findAccountState} from './skill-training-guide-source-dependency-lib.mjs';

const normalize=value=>String(value||'').replaceAll('_',' ').replace(/\s+/g,' ').trim();
const pageKey=value=>{
  const title=normalize(value),colon=title.indexOf(':'),namespace=colon>=0?title.slice(0,colon).toLowerCase():null,page=colon>=0?title.slice(colon+1):title,capitalized=page?`${page[0].toUpperCase()}${page.slice(1)}`:'';
  return namespace===null?capitalized:`${namespace}:${capitalized}`;
};
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const wikiUrl=title=>`https://oldschool.runescape.wiki/w/${encodeURIComponent(normalize(title).replaceAll(' ','_'))}`;

function parserRenderedTargets(response={}){
  const links=(response.links||[]).map(row=>({...row,parserChannel:'links',parserReportedExists:row.exists===true}));
  const categories=(response.categories||[]).map(row=>({ns:14,title:`Category:${normalize(row.category)}`,parserChannel:'categories',parserReportedExists:row.missing!==true,parserMetadata:{sortkey:row.sortkey??''}}));
  const images=(response.images||[]).map(title=>({ns:6,title:`File:${normalize(title)}`,parserChannel:'images',parserReportedExists:null}));
  return [...links,...categories,...images];
}

function identityFromResolution(resolution){
  const page=resolution?.page,revision=page?.revisions?.[0],exists=Boolean(page&&!Object.hasOwn(page,'missing')&&Number.isInteger(Number(page.pageid))&&Number(page.pageid)>0&&revision?.revid&&revision?.timestamp);
  return exists?{sourcePageId:Number(page.pageid),resolvedTitle:page.title,redirected:Boolean(resolution.redirected),sourceRevision:String(revision.revid),sourceTimestamp:revision.timestamp,sourceUrl:wikiUrl(page.title)}:null;
}

function resolutionState(resolution){
  if(!resolution)return 'missing_api_assessment';
  if(resolution.page&&Object.hasOwn(resolution.page,'missing'))return 'missing_wiki_page';
  return identityFromResolution(resolution)?'current_revision_pinned_page':'unresolved_revision_provenance';
}

function addGuidePresence(index,guidePageId,pageId,title){
  if(!index.has(guidePageId))index.set(guidePageId,{pageIds:new Set(),titleKeys:new Set()});
  const entry=index.get(guidePageId);if(pageId)entry.pageIds.add(Number(pageId));if(title)entry.titleKeys.add(pageKey(title));
}

function directSourcePresenceIndex(records=[]){
  const index=new Map();
  for(const record of records)for(const reference of record.references||[])addGuidePresence(index,Number(reference.guidePageId),record.targetPageIdentity?.sourcePageId,reference.requestedTitle||reference.sourceTarget);
  return index;
}

function directDependencyPresenceIndex(records=[]){
  const index=new Map();
  for(const record of records)for(const reference of record.references||[])if(reference.pageTitle)addGuidePresence(index,Number(reference.guidePageId),record.targetPageIdentity?.sourcePageId,reference.pageTitle);
  return index;
}

function classifyPresence(index,guidePageId,title,identity){
  const presence=index.get(Number(guidePageId));
  if(identity&&presence?.pageIds.has(identity.sourcePageId))return 'direct_source_stable_page_id';
  if(presence?.titleKeys.has(pageKey(title)))return 'direct_source_exact_mediawiki_title';
  return 'rendered_only_origin_unattributed';
}

function enrichTarget(row,resolution){
  const identity=identityFromResolution(resolution);
  return {namespaceId:Number(row.ns),requestedTitle:row.title,parserChannel:row.parserChannel||'links',parserReportedExists:row.parserReportedExists??null,parserMetadata:row.parserMetadata||null,resolutionAttempted:Boolean(resolution),resolutionState:resolutionState(resolution),targetPageIdentity:identity};
}

export function buildSkillTrainingGuideRenderInventory({expectedGuides=[],parserObservations=[],linkTargetResolutions=[],dependencyTargetResolutions=[],directLinkRecords=[],sourceDependencyRecords=[]}={}){
  const linkResolutionByTitle=new Map(linkTargetResolutions.map(row=>[pageKey(row.requestedTitle),row])),dependencyResolutionByTitle=new Map(dependencyTargetResolutions.map(row=>[pageKey(row.requestedTitle),row])),directLinks=directSourcePresenceIndex(directLinkRecords),directDependencies=directDependencyPresenceIndex(sourceDependencyRecords);
  const renderObservations=parserObservations.map(observation=>{
    const response=observation.response||{},guidePageId=Number(observation.guidePageId),links=parserRenderedTargets(response).map(row=>{const enriched=enrichTarget(row,linkResolutionByTitle.get(pageKey(row.title)));return {...enriched,sourcePresence:classifyPresence(directLinks,guidePageId,row.title,enriched.targetPageIdentity)}}),dependencies=(response.templates||[]).map(row=>{const enriched=enrichTarget({...row,parserChannel:'templates',parserReportedExists:row.exists===true},dependencyResolutionByTitle.get(pageKey(row.title)));return {...enriched,directSourceDependencyPresence:classifyPresence(directDependencies,guidePageId,row.title,enriched.targetPageIdentity)}}),blockers=[];
    if(observation.parserError)blockers.push('parser_response_missing_or_error');
    if(Number(response.pageid)!==guidePageId)blockers.push('parser_returned_different_guide_page_id');
    if(String(response.revid)!==String(observation.requestedRevision))blockers.push('parser_returned_different_guide_revision');
    if(links.some(row=>!row.resolutionAttempted))blockers.push('one_or_more_rendered_links_lack_resolution_assessment');
    if(dependencies.some(row=>!row.resolutionAttempted))blockers.push('one_or_more_parser_dependencies_lack_resolution_assessment');
    if(links.some(row=>typeof row.parserReportedExists==='boolean'&&row.parserReportedExists!==(row.resolutionState==='current_revision_pinned_page')))blockers.push('parser_link_existence_disagrees_with_resolution_observation');
    if(dependencies.some(row=>typeof row.parserReportedExists==='boolean'&&row.parserReportedExists!==(row.resolutionState==='current_revision_pinned_page')))blockers.push('parser_dependency_existence_disagrees_with_resolution_observation');
    blockers.push('historical_dependency_revision_closure_not_established');
    if(links.some(row=>row.sourcePresence==='rendered_only_origin_unattributed'))blockers.push('rendered_only_link_origin_not_attributed');
    blockers.push('rendered_links_do_not_establish_activity_semantics_or_completeness');
    return {contract:'sensum.skill-training-guide-render-observation.v1',guidePageId,guideTitle:observation.guideTitle,requestedRevision:String(observation.requestedRevision),parserReturnedRevision:String(response.revid??''),parserError:observation.parserError||null,guideTimestamp:observation.guideTimestamp||null,guideContentHash:observation.guideContentHash||null,guideUrl:observation.guideUrl||null,skillKeys:sorted(unique(observation.skillKeys||[])),channels:sorted(unique(observation.channels||[])),observedAt:observation.observedAt,renderedLinkTargetCount:links.length,renderedLinks:links,parserReportedDependencyCount:dependencies.length,parserReportedDependencies:dependencies,historicalDependencyRevisionClosure:null,accountIndependent:true,blockers:unique(blockers),state:'blocked'};
  }).sort((a,b)=>a.guidePageId-b.guidePageId||a.requestedRevision.localeCompare(b.requestedRevision));

  const groups=new Map();
  for(const render of renderObservations)for(const link of render.renderedLinks){
    const renderedTargetKey=link.targetPageIdentity?`wiki-pageid:${link.targetPageIdentity.sourcePageId}`:`wiki-title:${pageKey(link.requestedTitle)}`;
    if(!groups.has(renderedTargetKey))groups.set(renderedTargetKey,{renderedTargetKey,requestedTitles:[],namespaceIds:[],targetPageIdentities:[],observations:[]});
    const group=groups.get(renderedTargetKey);group.requestedTitles.push(link.requestedTitle);group.namespaceIds.push(link.namespaceId);if(link.targetPageIdentity)group.targetPageIdentities.push(link.targetPageIdentity);group.observations.push({guidePageId:render.guidePageId,guideTitle:render.guideTitle,guideRevision:render.requestedRevision,guideContentHash:render.guideContentHash,parserObservedAt:render.observedAt,parserChannel:link.parserChannel,namespaceId:link.namespaceId,requestedTitle:link.requestedTitle,parserReportedExists:link.parserReportedExists,parserMetadata:link.parserMetadata,resolutionState:link.resolutionState,sourcePresence:link.sourcePresence});
  }
  const renderedLinks=[...groups.values()].map(group=>{
    const identities=new Map(group.targetPageIdentities.map(identity=>[`${identity.sourcePageId}|${identity.sourceRevision}`,identity])),identity=[...identities.values()][0]||null,presenceTypes=['direct_source_stable_page_id','direct_source_exact_mediawiki_title','rendered_only_origin_unattributed'],sourcePresenceCounts=Object.fromEntries(presenceTypes.map(type=>[type,group.observations.filter(row=>row.sourcePresence===type).length])),blockers=['historical_dependency_revision_closure_not_established','rendered_link_does_not_establish_activity_semantics','optimizer_eligibility_blocked'];
    if(sourcePresenceCounts.rendered_only_origin_unattributed)blockers.unshift('rendered_only_origin_not_attributed');if(identities.size>1)blockers.unshift('conflicting_target_revision_identities_within_observation');
    return {contract:'sensum.skill-training-guide-rendered-link.v1',renderedTargetKey:group.renderedTargetKey,requestedTitles:sorted(unique(group.requestedTitles)),namespaceIds:sorted(unique(group.namespaceIds)),guideObservationCount:group.observations.length,observations:group.observations.sort((a,b)=>a.guidePageId-b.guidePageId||a.requestedTitle.localeCompare(b.requestedTitle)),targetPageIdentity:identity,sourcePresenceCounts,canonicalActivityIdentity:null,repeatableTrainingActivity:null,optimizerEligible:false,accountIndependent:true,blockers:unique(blockers),state:'blocked'};
  }).sort((a,b)=>a.renderedTargetKey.localeCompare(b.renderedTargetKey));
  return {renderObservations,renderedLinks,audit:auditSkillTrainingGuideRenderInventory({expectedGuides,renderObservations,renderedLinks,directLinkRecords,sourceDependencyRecords,inputAccountStateFindings:findAccountState(parserObservations)})};
}

function directPairs(records=[]){
  const pairs=new Map();
  for(const record of records){
    if(['dynamic_target','in_page_fragment'].includes(record.namespaceClass))continue;
    for(const reference of record.references||[]){
      const guidePageId=Number(reference.guidePageId),pairKey=record.targetPageIdentity?`${guidePageId}|pageid:${record.targetPageIdentity.sourcePageId}`:`${guidePageId}|title:${pageKey(reference.requestedTitle||reference.sourceTarget)}`;
      if(!pairs.has(pairKey))pairs.set(pairKey,{pairKey,guidePageId,pageId:record.targetPageIdentity?.sourcePageId||null,titleKey:pageKey(reference.requestedTitle||reference.sourceTarget)});
    }
  }
  return [...pairs.values()];
}

function sourceDependencyPairs(records=[]){
  const pairs=new Map();
  for(const record of records)for(const reference of record.references||[])if(reference.pageTitle){
    const guidePageId=Number(reference.guidePageId),pairKey=record.targetPageIdentity?`${guidePageId}|pageid:${record.targetPageIdentity.sourcePageId}`:`${guidePageId}|title:${pageKey(reference.pageTitle)}`;
    if(!pairs.has(pairKey))pairs.set(pairKey,{pairKey,guidePageId,pageId:record.targetPageIdentity?.sourcePageId||null,titleKey:pageKey(reference.pageTitle)});
  }
  return [...pairs.values()];
}

function pairIsRendered(pair,rows,targetField){
  return rows.some(render=>render.guidePageId===pair.guidePageId&&render[targetField].some(target=>(pair.pageId&&target.targetPageIdentity?.sourcePageId===pair.pageId)||target.requestedTitle&&pageKey(target.requestedTitle)===pair.titleKey));
}

export function auditSkillTrainingGuideRenderInventory({expectedGuides=[],renderObservations=[],renderedLinks=[],directLinkRecords=[],sourceDependencyRecords=[],inputAccountStateFindings=[]}={}){
  const expectedKeys=expectedGuides.map(row=>`${Number(row.pageId||row.sourcePageId)}|${row.revision||row.sourceRevision}`),actualKeys=renderObservations.map(row=>`${row.guidePageId}|${row.requestedRevision}`),duplicateGuideKeys=unique(actualKeys.filter((value,index)=>actualKeys.indexOf(value)!==index)),missingGuideKeys=expectedKeys.filter(value=>!actualKeys.includes(value)),unexpectedGuideKeys=actualKeys.filter(value=>!expectedKeys.includes(value)),parserErrors=renderObservations.filter(row=>row.parserError).map(row=>({guidePageId:row.guidePageId,requestedRevision:row.requestedRevision,error:row.parserError})),revisionMismatches=renderObservations.filter(row=>row.requestedRevision!==row.parserReturnedRevision).map(row=>`${row.guidePageId}|${row.requestedRevision}|${row.parserReturnedRevision}`),linkObservations=renderObservations.flatMap(row=>row.renderedLinks),dependencyObservations=renderObservations.flatMap(row=>row.parserReportedDependencies),preservedGroupedLinkObservations=renderedLinks.reduce((sum,row)=>sum+row.guideObservationCount,0),missingLinkAssessments=linkObservations.filter(row=>!row.resolutionAttempted).length,missingDependencyAssessments=dependencyObservations.filter(row=>!row.resolutionAttempted).length,linkExistenceDisagreements=linkObservations.filter(row=>typeof row.parserReportedExists==='boolean'&&row.parserReportedExists!==(row.resolutionState==='current_revision_pinned_page')).length,dependencyExistenceDisagreements=dependencyObservations.filter(row=>typeof row.parserReportedExists==='boolean'&&row.parserReportedExists!==(row.resolutionState==='current_revision_pinned_page')).length,conflictingGroups=renderedLinks.filter(row=>row.blockers.includes('conflicting_target_revision_identities_within_observation')).map(row=>row.renderedTargetKey),direct=directPairs(directLinkRecords),matchedDirect=direct.filter(pair=>pairIsRendered(pair,renderObservations,'renderedLinks')),dependencies=sourceDependencyPairs(sourceDependencyRecords),matchedDependencies=dependencies.filter(pair=>pairIsRendered(pair,renderObservations,'parserReportedDependencies')),renderedOnly=linkObservations.filter(row=>row.sourcePresence==='rendered_only_origin_unattributed'),accountState=[...inputAccountStateFindings,...findAccountState([...renderObservations,...renderedLinks])],promotions=renderedLinks.filter(row=>row.canonicalActivityIdentity!==null||row.repeatableTrainingActivity!==null||row.optimizerEligible!==false).map(row=>row.renderedTargetKey),blockers=[];
  if(duplicateGuideKeys.length)blockers.push('duplicate_guide_render_observations');if(missingGuideKeys.length)blockers.push('one_or_more_expected_guide_render_observations_missing');if(unexpectedGuideKeys.length)blockers.push('unexpected_guide_render_observation');if(parserErrors.length)blockers.push('one_or_more_parser_responses_missing_or_error');if(revisionMismatches.length)blockers.push('parser_returned_revision_mismatch');if(missingLinkAssessments)blockers.push('one_or_more_rendered_links_lack_resolution_assessment');if(missingDependencyAssessments)blockers.push('one_or_more_parser_dependencies_lack_resolution_assessment');if(linkExistenceDisagreements)blockers.push('parser_link_existence_disagrees_with_resolution_observation');if(dependencyExistenceDisagreements)blockers.push('parser_dependency_existence_disagrees_with_resolution_observation');if(preservedGroupedLinkObservations!==linkObservations.length)blockers.push('rendered_link_grouping_did_not_preserve_every_observation');if(conflictingGroups.length)blockers.push('rendered_link_identity_conflict');if(matchedDirect.length!==direct.length)blockers.push('one_or_more_direct_source_targets_absent_from_rendered_link_set');if(matchedDependencies.length!==dependencies.length)blockers.push('one_or_more_direct_source_dependencies_absent_from_parser_dependency_set');if(promotions.length)blockers.push('unsupported_rendered_link_semantic_promotion');if(accountState.length)blockers.push('account_query_state_baked_into_rendered_link_inventory');
  blockers.push('historical_dependency_revision_closure_not_established');if(renderedOnly.length)blockers.push('rendered_only_link_origin_not_attributed');blockers.push('rendered_link_inventory_does_not_prove_complete_activity_universe');
  const structural=['duplicate_guide_render_observations','one_or_more_expected_guide_render_observations_missing','unexpected_guide_render_observation','one_or_more_parser_responses_missing_or_error','parser_returned_revision_mismatch','one_or_more_rendered_links_lack_resolution_assessment','one_or_more_parser_dependencies_lack_resolution_assessment','parser_link_existence_disagrees_with_resolution_observation','parser_dependency_existence_disagrees_with_resolution_observation','rendered_link_grouping_did_not_preserve_every_observation','rendered_link_identity_conflict','one_or_more_direct_source_targets_absent_from_rendered_link_set','one_or_more_direct_source_dependencies_absent_from_parser_dependency_set','unsupported_rendered_link_semantic_promotion','account_query_state_baked_into_rendered_link_inventory'];
  return {contract:'sensum.skill-training-guide-rendered-link-audit.v1',accountIndependent:accountState.length===0,guideRenderCoverage:{expectedGuideRevisions:expectedKeys.length,parserObservations:actualKeys.length,parserResponseErrors:parserErrors,duplicateGuideKeys,missingGuideKeys,unexpectedGuideKeys,revisionMismatches,exactGuideRevisionSetMatch:!parserErrors.length&&!duplicateGuideKeys.length&&!missingGuideKeys.length&&!unexpectedGuideKeys.length&&!revisionMismatches.length},renderedLinkCoverage:{perGuideTargetObservations:linkObservations.length,preservedGroupedTargetObservations:preservedGroupedLinkObservations,uniqueRenderedTargets:renderedLinks.length,linkChannelObservations:linkObservations.filter(row=>row.parserChannel==='links').length,categoryChannelObservations:linkObservations.filter(row=>row.parserChannel==='categories').length,imageChannelObservations:linkObservations.filter(row=>row.parserChannel==='images').length,mainNamespaceObservations:linkObservations.filter(row=>row.namespaceId===0).length,nonMainNamespaceObservations:linkObservations.filter(row=>row.namespaceId!==0).length,currentRevisionPinnedObservations:linkObservations.filter(row=>row.resolutionState==='current_revision_pinned_page').length,missingPageObservations:linkObservations.filter(row=>row.resolutionState==='missing_wiki_page').length,parserExistenceNotReportedObservations:linkObservations.filter(row=>row.parserReportedExists===null).length,missingResolutionAssessmentCount:missingLinkAssessments,parserExistenceDisagreementCount:linkExistenceDisagreements,conflictingRenderedTargetKeys:conflictingGroups},parserDependencyCoverage:{perGuideDependencyObservations:dependencyObservations.length,uniqueParserReportedDependencyPageIds:unique(dependencyObservations.map(row=>row.targetPageIdentity?.sourcePageId).filter(Boolean)).length,currentRevisionPinnedObservations:dependencyObservations.filter(row=>row.resolutionState==='current_revision_pinned_page').length,missingPageObservations:dependencyObservations.filter(row=>row.resolutionState==='missing_wiki_page').length,missingResolutionAssessmentCount:missingDependencyAssessments,parserExistenceDisagreementCount:dependencyExistenceDisagreements,directSourceDependencyPairs:dependencies.length,matchedDirectSourceDependencyPairs:matchedDependencies.length,unmatchedDirectSourceDependencyPairKeys:dependencies.filter(pair=>!matchedDependencies.includes(pair)).map(row=>row.pairKey)},directSourceReconciliation:{eligibleDirectSourceGuideTargetPairs:direct.length,matchedDirectSourceGuideTargetPairs:matchedDirect.length,unmatchedDirectSourceGuideTargetPairKeys:direct.filter(pair=>!matchedDirect.includes(pair)).map(row=>row.pairKey),stablePageIdMatches:linkObservations.filter(row=>row.sourcePresence==='direct_source_stable_page_id').length,exactTitleFallbackMatches:linkObservations.filter(row=>row.sourcePresence==='direct_source_exact_mediawiki_title').length,renderedOnlyOriginUnattributedObservations:renderedOnly.length},semanticPromotionCoverage:{canonicalActivityIdentityCount:renderedLinks.filter(row=>row.canonicalActivityIdentity!==null).length,repeatabilityProvenCount:renderedLinks.filter(row=>row.repeatableTrainingActivity!==null).length,optimizerEligibleCount:renderedLinks.filter(row=>row.optimizerEligible===true).length,unsupportedPromotionTargetKeys:promotions},accountStateFindings:accountState,renderedLinkObservationComplete:expectedKeys.length>0&&!structural.some(blocker=>blockers.includes(blocker)),historicalDependencyRevisionClosureComplete:false,renderedOnlyOriginAttributionComplete:renderedOnly.length===0,canonicalActivityIdentityCount:0,optimizerEligibleActivityCount:0,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:unique(blockers),publishable:false};
}
