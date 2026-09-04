import {parseSkillTrainingGuideDirectLinks} from './skill-training-guide-direct-link-lib.mjs';

const normalize=value=>String(value||'').replaceAll('_',' ').replace(/\s+/g,' ').trim();
const key=value=>normalize(value).toLowerCase();
const pageKey=value=>{
  const title=normalize(value),colon=title.indexOf(':'),namespace=colon>=0?title.slice(0,colon).toLowerCase():null,page=colon>=0?title.slice(colon+1):title,capitalized=page?`${page[0].toUpperCase()}${page.slice(1)}`:'';
  return namespace===null?capitalized:`${namespace}:${capitalized}`;
};
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const wikiUrl=title=>`https://oldschool.runescape.wiki/w/${encodeURIComponent(normalize(title).replaceAll(' ','_'))}`;
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

function maskNonSourceRegions(content){
  return String(content||'').replace(/<!--[\s\S]*?-->/g,match=>match.replace(/[^\r\n]/g,' ')).replace(/<(nowiki|pre|syntaxhighlight|source|code|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,match=>match.replace(/[^\r\n]/g,' '));
}

function lineAt(content,offset){
  const lines=String(content||'').split(/\r?\n/),line=String(content||'').slice(0,offset).split(/\r?\n/).length;
  return {line,excerpt:lines[line-1]?.trim()||''};
}

function splitTopLevel(value){
  const pieces=[];let start=0,curly=0,square=0;
  for(let index=0;index<value.length;){
    if(value.startsWith('{{{',index)){curly++;index+=3;continue}
    if(value.startsWith('{{',index)){curly++;index+=2;continue}
    if(value.startsWith('}}}',index)&&curly>0){curly--;index+=3;continue}
    if(value.startsWith('}}',index)&&curly>0){curly--;index+=2;continue}
    if(value.startsWith('[[',index)){square++;index+=2;continue}
    if(value.startsWith(']]',index)&&square>0){square--;index+=2;continue}
    if(value[index]==='|'&&curly===0&&square===0){pieces.push(value.slice(start,index));start=index+1}
    index++;
  }
  pieces.push(value.slice(start));return pieces;
}

function magicWordMatcher(aliases=[]){
  const patterns=aliases.filter(Boolean).map(alias=>{
    const escaped=String(alias).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\\\$1/g,'.+');
    return new RegExp(`^${escaped}$`,'i');
  });
  return value=>patterns.some(pattern=>pattern.test(value));
}

function classifyInvocation(header,parts,isMagicWord){
  const raw=normalize(header),lower=raw.toLowerCase();
  if(!raw)return {dependencyClass:'dynamic_name',pageTitle:null,sourceName:null};
  if(lower.startsWith('#invoke:')){
    const moduleName=normalize(raw.slice(raw.indexOf(':')+1));
    return moduleName&&!/[{}]/.test(moduleName)?{dependencyClass:'module_transclusion',pageTitle:`Module:${moduleName}`,sourceName:raw}:{dependencyClass:'dynamic_name',pageTitle:null,sourceName:raw};
  }
  if(raw.startsWith('#'))return {dependencyClass:'parser_function',pageTitle:null,sourceName:raw};
  if(/[{}]/.test(raw))return {dependencyClass:'dynamic_name',pageTitle:null,sourceName:raw};
  if(isMagicWord(raw))return {dependencyClass:'magic_word',pageTitle:null,sourceName:raw};
  const modifier=raw.match(/^(?:subst|safesubst|msgnw)\s*:(.*)$/i);
  if(modifier){const target=normalize(modifier[1]);return target&&!/[{}]/.test(target)?{dependencyClass:'template_substitution',pageTitle:target.includes(':')?target:`Template:${target}`,sourceName:raw}:{dependencyClass:'dynamic_name',pageTitle:null,sourceName:raw}}
  if(raw.startsWith(':'))return {dependencyClass:'page_transclusion',pageTitle:normalize(raw.slice(1)),sourceName:raw};
  if(/^(?:template|module|user|mediawiki):/i.test(raw))return {dependencyClass:'explicit_namespace_transclusion',pageTitle:raw,sourceName:raw};
  return {dependencyClass:'template_transclusion',pageTitle:`Template:${raw}`,sourceName:raw,argumentCount:Math.max(0,parts.length-1)};
}

export function parseSkillTrainingGuideTemplateDependencies(guide={},magicWordAliases=[]){
  const content=String(guide.content||''),masked=maskNonSourceRegions(content),isMagicWord=magicWordMatcher(magicWordAliases),stack=[],occurrences=[],parameterOccurrences=[],unmatchedClosingLocators=[];
  let templateOrdinal=0,parameterOrdinal=0,unmatchedClosingDelimiterCount=0;
  for(let index=0;index<masked.length;){
    if(masked.startsWith('{{{{',index)){stack.push({kind:'template',start:index,ordinal:++templateOrdinal});index+=2;continue}
    if(masked.startsWith('{{{',index)){stack.push({kind:'parameter',start:index,ordinal:++parameterOrdinal});index+=3;continue}
    if(masked.startsWith('{{',index)){stack.push({kind:'template',start:index,ordinal:++templateOrdinal});index+=2;continue}
    if(masked.startsWith('}}}',index)&&stack.at(-1)?.kind==='parameter'){
      const opened=stack.pop(),raw=content.slice(opened.start,index+3),inner=raw.slice(3,-3),parts=splitTopLevel(inner),locator=lineAt(content,opened.start);
      parameterOccurrences.push({occurrenceKey:`guide-pageid:${guide.sourcePageId}:parameter:${opened.ordinal}`,parameterName:normalize(parts[0]),rawSource:raw,guidePageId:guide.sourcePageId,guideTitle:guide.title,guideRevision:String(guide.sourceRevision||''),guideTimestamp:guide.sourceTimestamp||null,guideUrl:guide.sourceUrl||null,guideContentHash:guide.sourceContentHash||null,sourceLocator:locator,skillKeys:sorted(unique(guide.skillKeys||[])),channels:sorted(unique(guide.channels||[]))});index+=3;continue;
    }
    if(masked.startsWith('}}',index)&&stack.at(-1)?.kind==='template'){
      const opened=stack.pop(),raw=content.slice(opened.start,index+2),inner=raw.slice(2,-2),parts=splitTopLevel(inner),classified=classifyInvocation(parts[0],parts,isMagicWord),locator=lineAt(content,opened.start);
      occurrences.push({occurrenceKey:`guide-pageid:${guide.sourcePageId}:template:${opened.ordinal}`,sourceName:classified.sourceName,pageTitle:classified.pageTitle,dependencyClass:classified.dependencyClass,argumentCount:Math.max(0,parts.length-1),rawSource:raw,guidePageId:guide.sourcePageId,guideTitle:guide.title,guideRevision:String(guide.sourceRevision||''),guideTimestamp:guide.sourceTimestamp||null,guideUrl:guide.sourceUrl||null,guideContentHash:guide.sourceContentHash||null,sourceLocator:locator,skillKeys:sorted(unique(guide.skillKeys||[])),channels:sorted(unique(guide.channels||[]))});index+=2;continue;
    }
    if(masked.startsWith('}}',index)){unmatchedClosingDelimiterCount++;unmatchedClosingLocators.push(lineAt(content,index));index+=2;continue}
    index++;
  }
  return {occurrences:occurrences.sort((a,b)=>a.occurrenceKey.localeCompare(b.occurrenceKey)),parameterOccurrences:parameterOccurrences.sort((a,b)=>a.occurrenceKey.localeCompare(b.occurrenceKey)),audit:{guidePageId:guide.sourcePageId,guideRevision:String(guide.sourceRevision||''),templateInvocationCount:occurrences.length,templateParameterCount:parameterOccurrences.length,unclosedDelimiterCount:stack.length,unclosedDelimiterLocators:stack.map(row=>({...lineAt(content,row.start),kind:row.kind})),unmatchedClosingDelimiterCount,unmatchedClosingLocators,balancedSourceDelimiters:stack.length===0&&unmatchedClosingDelimiterCount===0}};
}

export function collectSkillTrainingGuideTemplateDependencies(guidePages=[],magicWordAliases=[]){
  const parsed=guidePages.map(guide=>parseSkillTrainingGuideTemplateDependencies(guide,magicWordAliases)),groups=new Map();
  for(const occurrence of parsed.flatMap(result=>result.occurrences)){
    const dependencyKey=occurrence.pageTitle?`wiki-title:${pageKey(occurrence.pageTitle)}`:`${occurrence.dependencyClass}:${key(occurrence.sourceName)}`;
    if(!groups.has(dependencyKey))groups.set(dependencyKey,{dependencyKey,dependencyClass:occurrence.dependencyClass,pageTitles:[],sourceNames:[],references:[]});
    const group=groups.get(dependencyKey);group.pageTitles.push(occurrence.pageTitle);group.sourceNames.push(occurrence.sourceName);group.references.push(occurrence);
  }
  return {records:[...groups.values()].map(group=>({...group,pageTitles:sorted(unique(group.pageTitles.filter(Boolean))),sourceNames:sorted(unique(group.sourceNames.filter(Boolean))),referenceCount:group.references.length,references:group.references.sort((a,b)=>a.occurrenceKey.localeCompare(b.occurrenceKey))})).sort((a,b)=>a.dependencyKey.localeCompare(b.dependencyKey)),guideAudits:parsed.map(result=>result.audit),parameterOccurrences:parsed.flatMap(result=>result.parameterOccurrences)};
}

function resolutionExists(resolution){const page=resolution?.page,revision=page?.revisions?.[0];return Boolean(page&&!Object.hasOwn(page,'missing')&&Number.isInteger(Number(page.pageid))&&Number(page.pageid)>0&&revision?.revid&&revision?.timestamp)}

export function buildSkillTrainingGuideTemplateDependencyInventory({expectedGuides=[],guidePages=[],magicWordAliases=[],targetResolutions=[]}={}){
  const collected=collectSkillTrainingGuideTemplateDependencies(guidePages,magicWordAliases),byTitle=new Map(targetResolutions.map(row=>[pageKey(row.requestedTitle),row]));
  const records=collected.records.map(group=>{
    const pageBacked=group.pageTitles.length>0,resolution=pageBacked?group.pageTitles.map(title=>byTitle.get(pageKey(title))).find(Boolean):null,exists=resolutionExists(resolution),page=resolution?.page,revision=page?.revisions?.[0],blockers=['historical_transclusion_revision_not_closed','rendered_link_output_not_enumerated','template_dependency_does_not_establish_activity_semantics','optimizer_eligibility_blocked'];
    if(pageBacked&&!resolution)blockers.unshift('page_dependency_api_assessment_missing');else if(pageBacked&&(!page||Object.hasOwn(page,'missing')))blockers.unshift('page_dependency_missing');else if(pageBacked&&!exists)blockers.unshift('page_dependency_revision_provenance_incomplete');
    return {contract:'sensum.skill-training-guide-template-dependency.v1',dependencyKey:group.dependencyKey,dependencyClass:group.dependencyClass,sourceNames:group.sourceNames,referenceCount:group.referenceCount,references:group.references,resolutionAttempted:pageBacked?Boolean(resolution):false,resolutionState:!pageBacked?'not_applicable_non_page_dependency':exists?'current_revision_pinned_page':page&&Object.hasOwn(page,'missing')?'missing_wiki_page':resolution?'unresolved_revision_provenance':'missing_api_assessment',targetPageIdentity:exists?{sourcePageId:Number(page.pageid),resolvedTitle:page.title,redirected:Boolean(resolution.redirected),sourceRevision:String(revision.revid),sourceTimestamp:revision.timestamp,sourceUrl:wikiUrl(page.title)}:null,renderedLinkOutput:null,historicalTransclusionRevision:null,canonicalActivityIdentity:null,optimizerEligible:false,accountIndependent:true,blockers:unique(blockers),state:'blocked'};
  });
  return {records,parameterOccurrences:collected.parameterOccurrences,audit:auditSkillTrainingGuideTemplateDependencies(records,{expectedGuides,guidePages,guideAudits:collected.guideAudits,parameterOccurrences:collected.parameterOccurrences})};
}

export function findAccountState(records=[]){
  const findings=[];const visit=(value,path,recordKey)=>{if(Array.isArray(value)){value.forEach((child,index)=>visit(child,`${path}[${index}]`,recordKey));return}if(!value||typeof value!=='object')return;for(const [name,child] of Object.entries(value)){const childPath=path?`${path}.${name}`:name;if(accountKey(name))findings.push({recordKey,path:childPath,value:child});visit(child,childPath,recordKey)}};
  records.forEach((record,index)=>visit(record,'',record?.dependencyKey||record?.targetKey||`record-${index}`));return findings;
}

export function auditSkillTrainingGuideTemplateDependencies(records=[],{expectedGuides=[],guidePages=[],guideAudits=[],parameterOccurrences=[]}={}){
  const expectedKeys=expectedGuides.map(row=>`${pageKey(row.resolvedTitle)}|${row.sourceRevision}`),actualKeys=guidePages.map(row=>`${pageKey(row.title)}|${row.sourceRevision}`),duplicateGuides=unique(actualKeys.filter((value,index)=>actualKeys.indexOf(value)!==index)),missingGuides=expectedKeys.filter(value=>!actualKeys.includes(value)),unexpectedGuides=actualKeys.filter(value=>!expectedKeys.includes(value)),unbalanced=guideAudits.filter(row=>!row.balancedSourceDelimiters),expectedOccurrences=guideAudits.reduce((sum,row)=>sum+row.templateInvocationCount,0),actualOccurrenceKeys=records.flatMap(row=>row.references||[]).map(row=>row.occurrenceKey),duplicateOccurrences=unique(actualOccurrenceKeys.filter((value,index)=>actualOccurrenceKeys.indexOf(value)!==index)),pageRecords=records.filter(row=>row.references.some(reference=>reference.pageTitle)),missingAssessments=pageRecords.filter(row=>!row.resolutionAttempted).map(row=>row.dependencyKey),missingPages=pageRecords.filter(row=>row.resolutionState==='missing_wiki_page').map(row=>row.dependencyKey),unresolvedPages=pageRecords.filter(row=>row.resolutionState==='unresolved_revision_provenance').map(row=>row.dependencyKey),invalidReferenceCounts=records.filter(row=>row.referenceCount!==(row.references||[]).length).map(row=>row.dependencyKey),promotions=records.filter(row=>row.renderedLinkOutput!==null||row.historicalTransclusionRevision!==null||row.canonicalActivityIdentity!==null||row.optimizerEligible!==false).map(row=>row.dependencyKey),accountState=findAccountState(records),blockers=[];
  if(duplicateGuides.length)blockers.push('duplicate_fetched_guide_revisions');if(missingGuides.length)blockers.push('expected_guide_revision_missing');if(unexpectedGuides.length)blockers.push('unexpected_guide_revision_fetched');if(unbalanced.length)blockers.push('unbalanced_template_or_parameter_delimiters');if(expectedOccurrences!==actualOccurrenceKeys.length||duplicateOccurrences.length)blockers.push('template_invocation_occurrence_preservation_failed');if(invalidReferenceCounts.length)blockers.push('template_dependency_reference_count_mismatch');if(missingAssessments.length)blockers.push('page_dependency_resolution_assessment_missing');if(missingPages.length)blockers.push('one_or_more_page_dependencies_are_missing');if(unresolvedPages.length)blockers.push('one_or_more_page_dependencies_lack_revision_provenance');if(promotions.length)blockers.push('unsupported_template_semantic_or_rendered_output_promotion');if(accountState.length)blockers.push('account_query_state_baked_into_template_inventory');
  blockers.push('historical_transclusion_revision_closure_not_established','rendered_template_link_output_not_enumerated','template_inventory_does_not_prove_complete_activity_universe');
  const structural=['duplicate_fetched_guide_revisions','expected_guide_revision_missing','unexpected_guide_revision_fetched','unbalanced_template_or_parameter_delimiters','template_invocation_occurrence_preservation_failed','template_dependency_reference_count_mismatch','page_dependency_resolution_assessment_missing','one_or_more_page_dependencies_are_missing','one_or_more_page_dependencies_lack_revision_provenance','unsupported_template_semantic_or_rendered_output_promotion','account_query_state_baked_into_template_inventory'];
  return {guideCoverage:{expectedUniqueGuideRevisions:expectedKeys.length,fetchedUniqueGuideRevisions:actualKeys.length,duplicateGuideRevisionKeys:duplicateGuides,missingGuideRevisionKeys:missingGuides,unexpectedGuideRevisionKeys:unexpectedGuides,exactGuideRevisionSetMatch:!duplicateGuides.length&&!missingGuides.length&&!unexpectedGuides.length},templateInvocationCoverage:{parsedOccurrenceCount:expectedOccurrences,preservedOccurrenceCount:actualOccurrenceKeys.length,uniqueDependencyCount:records.length,templateParameterOccurrenceCount:parameterOccurrences.length,dependencyClasses:Object.fromEntries(sorted(unique(records.map(row=>row.dependencyClass))).map(type=>[type,records.filter(row=>row.dependencyClass===type).length])),duplicateOccurrenceKeys:duplicateOccurrences,invalidReferenceCountDependencyKeys:invalidReferenceCounts,unbalancedGuideSources:unbalanced,exactOccurrenceSetMatch:expectedOccurrences===actualOccurrenceKeys.length&&!duplicateOccurrences.length&&!invalidReferenceCounts.length},pageDependencyResolutionCoverage:{pageBackedDependencyCount:pageRecords.length,attemptedCount:pageRecords.length-missingAssessments.length,currentRevisionPinnedCount:pageRecords.filter(row=>row.resolutionState==='current_revision_pinned_page').length,missingAssessmentDependencyKeys:missingAssessments,missingPageDependencyKeys:missingPages,unresolvedRevisionDependencyKeys:unresolvedPages},semanticPromotionCoverage:{renderedLinkOutputCount:records.filter(row=>row.renderedLinkOutput!==null).length,historicalTransclusionRevisionCount:records.filter(row=>row.historicalTransclusionRevision!==null).length,canonicalActivityIdentityCount:records.filter(row=>row.canonicalActivityIdentity!==null).length,optimizerEligibleCount:records.filter(row=>row.optimizerEligible===true).length,unsupportedPromotionDependencyKeys:promotions},accountStateFindings:accountState,sourceInvocationInventoryComplete:expectedKeys.length>0&&!structural.some(blocker=>blockers.includes(blocker)),historicalExpansionClosureComplete:false,renderedLinkCoverageComplete:false,completeActivityUniverse:false,blockers:unique(blockers)};
}

export function buildMissingLinkProvenance({missingLinkRecords=[],exactTargetResolutions=[],currentGuidePages=[],searchObservations=[],candidateResolutions=[],logEventsByTitle={}}={}){
  const exactByTitle=new Map(exactTargetResolutions.map(row=>[pageKey(row.requestedTitle),row])),guideByPageId=new Map(currentGuidePages.map(row=>[Number(row.sourcePageId),row])),searchByTitle=new Map(searchObservations.map(row=>[key(row.requestedTitle),row])),candidateByTitle=new Map(candidateResolutions.map(row=>[pageKey(row.requestedTitle),row]));
  const records=missingLinkRecords.map(missing=>{
    const requestedTitle=missing.requestedTitles?.[0]||'',exact=exactByTitle.get(pageKey(requestedTitle))||exactByTitle.get(key(requestedTitle)),exactExists=resolutionExists(exact),heads=unique((missing.references||[]).map(row=>Number(row.guidePageId))).map(pageId=>{
      const head=guideByPageId.get(pageId),pinnedReferences=(missing.references||[]).filter(row=>Number(row.guidePageId)===pageId),parsed=head?parseSkillTrainingGuideDirectLinks(head).occurrences:[],exactOccurrences=parsed.filter(row=>pageKey(row.requestedTitle)===pageKey(requestedTitle));
      return {guidePageId:pageId,guideTitle:pinnedReferences[0]?.guideTitle||head?.title||null,pinnedRevisions:sorted(unique(pinnedReferences.map(row=>String(row.guideRevision)))),currentRevision:head?.sourceRevision||null,currentTimestamp:head?.sourceTimestamp||null,currentContentHash:head?.sourceContentHash||null,currentUrl:head?.sourceUrl||null,headFetched:Boolean(head),pinnedRevisionStillCurrent:Boolean(head&&pinnedReferences.every(row=>String(row.guideRevision)===String(head.sourceRevision)&&row.guideContentHash===head.sourceContentHash)),missingTitleOccurrenceCountAtCurrentHead:exactOccurrences.length,missingTitleStillPresent:exactOccurrences.length>0};
    }),search=searchByTitle.get(key(requestedTitle))||{requestedTitle,query:null,observedAt:null,results:[]},candidates=(search.results||[]).map((result,index)=>{const resolution=candidateByTitle.get(pageKey(result.title))||candidateByTitle.get(key(result.title)),exists=resolutionExists(resolution),page=resolution?.page,revision=page?.revisions?.[0];return {rank:index+1,title:result.title,pageId:result.pageid??(exists?Number(page.pageid):null),sourceRevision:exists?String(revision.revid):null,sourceTimestamp:exists?revision.timestamp:null,sourceUrl:exists?wikiUrl(page.title):wikiUrl(result.title),exactTitleMatch:pageKey(result.title)===pageKey(requestedTitle),reviewCandidateOnly:true}}),logs=logEventsByTitle[key(requestedTitle)]||[],blockers=['source_authored_direct_link_target_missing','search_candidates_do_not_authorize_replacement','automatic_replacement_forbidden','manual_or_source_revision_reconciliation_required'];
    if(exactExists)blockers.unshift('exact_title_no_longer_missing_reaudit_required');if(heads.some(row=>!row.headFetched))blockers.unshift('current_guide_head_not_fetched');
    return {contract:'sensum.skill-training-guide-missing-link-provenance.v1',targetKey:missing.targetKey,requestedTitle,pinnedReferences:missing.references||[],exactTitleAssessment:{assessed:Boolean(exact),state:exactExists?'current_revision_pinned_page':exact?.page&&Object.hasOwn(exact.page,'missing')?'missing_wiki_page':exact?'unresolved_revision_provenance':'missing_api_assessment',targetPageIdentity:exactExists?{sourcePageId:Number(exact.page.pageid),resolvedTitle:exact.page.title,sourceRevision:String(exact.page.revisions[0].revid),sourceTimestamp:exact.page.revisions[0].timestamp,sourceUrl:wikiUrl(exact.page.title)}:null},currentGuideHeadAssessments:heads,exactTitleLogEvents:logs,searchObservation:{query:search.query||null,observedAt:search.observedAt||null,resultCount:candidates.length,candidates},automaticReplacement:null,replacementState:'blocked_manual_source_reconciliation',accountIndependent:true,blockers:unique(blockers),state:'blocked'};
  });
  return {records,audit:auditMissingLinkProvenance(records,{expectedMissingLinkRecords:missingLinkRecords})};
}

export function auditMissingLinkProvenance(records=[],{expectedMissingLinkRecords=[]}={}){
  const expected=sorted(expectedMissingLinkRecords.map(row=>row.targetKey)),actual=sorted(records.map(row=>row.targetKey)),duplicates=unique(actual.filter((value,index)=>actual.indexOf(value)!==index)),missing=expected.filter(value=>!actual.includes(value)),unexpected=actual.filter(value=>!expected.includes(value)),missingExactAssessments=records.filter(row=>!row.exactTitleAssessment?.assessed).map(row=>row.targetKey),missingHeadChecks=records.filter(row=>!row.currentGuideHeadAssessments?.length||row.currentGuideHeadAssessments.some(head=>!head.headFetched)).map(row=>row.targetKey),missingSearchObservations=records.filter(row=>!row.searchObservation?.observedAt||!row.searchObservation?.query).map(row=>row.targetKey),automaticReplacements=records.filter(row=>row.automaticReplacement!==null).map(row=>row.targetKey),accountState=findAccountState(records),unresolved=records.filter(row=>row.replacementState!=='resolved_from_new_revision_pinned_source').map(row=>row.targetKey),blockers=[];
  if(duplicates.length)blockers.push('duplicate_missing_link_provenance_records');if(missing.length)blockers.push('missing_link_provenance_record_absent');if(unexpected.length)blockers.push('unexpected_missing_link_provenance_record');if(missingExactAssessments.length)blockers.push('exact_title_assessment_missing');if(missingHeadChecks.length)blockers.push('current_guide_head_assessment_missing');if(missingSearchObservations.length)blockers.push('search_observation_missing');if(automaticReplacements.length)blockers.push('unauthorized_automatic_replacement_present');if(accountState.length)blockers.push('account_query_state_baked_into_missing_link_provenance');if(unresolved.length)blockers.push('one_or_more_source_authored_missing_links_unresolved');
  const structural=['duplicate_missing_link_provenance_records','missing_link_provenance_record_absent','unexpected_missing_link_provenance_record','exact_title_assessment_missing','current_guide_head_assessment_missing','search_observation_missing','unauthorized_automatic_replacement_present','account_query_state_baked_into_missing_link_provenance'];
  return {expectedMissingLinkCount:expected.length,provenanceRecordCount:records.length,exactTitleAssessmentCount:records.length-missingExactAssessments.length,currentGuideHeadAssessmentCount:records.reduce((sum,row)=>sum+row.currentGuideHeadAssessments.length,0),missingLinksStillPresentAtCurrentHead:records.filter(row=>row.currentGuideHeadAssessments.some(head=>head.missingTitleStillPresent)).length,searchCandidateCount:records.reduce((sum,row)=>sum+row.searchObservation.candidates.length,0),automaticReplacementCount:automaticReplacements.length,unresolvedMissingLinkTargetKeys:unresolved,duplicateTargetKeys:duplicates,missingTargetKeys:missing,unexpectedTargetKeys:unexpected,accountStateFindings:accountState,provenanceInventoryComplete:expected.length>0&&!structural.some(blocker=>blockers.includes(blocker)),missingLinkResolutionComplete:expected.length>0&&unresolved.length===0,blockers:unique(blockers)};
}

export function buildSkillTrainingGuideSourceDependencyAudit(templateAudit,missingLinkAudit){
  const blockers=unique([...templateAudit.blockers,...missingLinkAudit.blockers,'source_dependencies_do_not_prove_complete_activity_universe']);
  return {contract:'sensum.skill-training-guide-source-dependency-audit.v1',accountIndependent:templateAudit.accountStateFindings.length===0&&missingLinkAudit.accountStateFindings.length===0,guideCoverage:templateAudit.guideCoverage,templateInvocationCoverage:templateAudit.templateInvocationCoverage,pageDependencyResolutionCoverage:templateAudit.pageDependencyResolutionCoverage,missingLinkProvenanceCoverage:missingLinkAudit,sourceDependencyInventoryComplete:templateAudit.sourceInvocationInventoryComplete&&missingLinkAudit.provenanceInventoryComplete,historicalExpansionClosureComplete:false,renderedTemplateLinkCoverageComplete:false,missingLinkResolutionComplete:missingLinkAudit.missingLinkResolutionComplete,canonicalActivityIdentityCount:0,optimizerEligibleActivityCount:0,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers,publishable:false};
}
