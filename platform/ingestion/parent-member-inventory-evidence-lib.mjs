import { hash } from './lib.mjs';
import { parseSourceHeadings } from './activity-candidate-source-evidence-lib.mjs';

const CHANNELS = [
  'complete_exact_revision_source_text',
  'prior_source_packet_revision_hash_and_text_alignment',
  'complete_source_line_inventory',
  'heading_and_section_boundary_inventory',
  'top_level_wikitable_row_and_cell_inventory',
  'source_authored_bullet_entry_inventory',
  'root_plink_template_inventory',
  'declared_total_signal_inventory',
  'non_exhaustive_qualification_signal_inventory',
  'completeness_and_member_identity_verdict_separation'
];
const REQUIRED_RULES = [
  'oneEvidencePacketPerEligibleMemberIdentityBranch',
  'sourceIsFetchedAtTheExactCanonicalSubjectBindingRevision',
  'fetchedPageIdTitleRevisionTimestampUrlAndContentHashMustMatchTheBinding',
  'priorSourcePacketMustMatchTheSameExactRevisionHashAndSourceText',
  'completeExactRevisionSourceTextMustBeRetained',
  'everySourceLineMustBeRetainedWithLocationAndHash',
  'headingsTablesCellsBulletsAndRootPlinkTemplatesAreStructuralObservationsOnly',
  'declaredTotalsAndNonExhaustiveQualificationsRemainSeparateExactSourceSignals',
  'matchingAnObservedStructureToADeclaredTotalCannotProveACompleteMemberUniverse',
  'observedItemsRecipientsHeadingsAndNarrativeClassesCannotBecomeReviewedMemberIdentitiesAutomatically',
  'missingChangedContradictoryTruncatedCompositeAmbiguousOrConditionMismatchedEvidenceRemainsBlocked',
  'namesTitlesPageIdsCandidateKeysLabelsAliasesAndOverridesCannotSelectOrCompleteMembers',
  'inputEvidenceRevisionsDiscoveryDispositionAndRoutingMustBePreserved',
  'repeatabilityMemberMechanicsAndOptimizerVerdictsRemainUnchanged',
  'memberIdentityAndInventoryCompletenessVerdictsRemainNull',
  'currentAccountStateIsForbidden'
];
const STAGE_FIELDS = new Set([
  'contract','contentHash','blockers','state',
  'sourceMemberIdentityAndAuthoritativeSourceChannelEvidenceWorkRoutingContentHash',
  'parentMemberInventoryEvidenceSources','parentMemberInventoryEvidence','parentMemberInventoryEvidenceReview'
]);
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value,index) => values.indexOf(value) !== index));
const sorted = values => [...values].sort((a,b) => String(a).localeCompare(String(b)));
const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !STAGE_FIELDS.has(key)));
const sourceContent = revision => revision?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;

function forbiddenPolicyPaths(policy={}) {
  const findings=[];
  const forbidden=/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|label|labels|alias|aliases|override|overrides)$/i;
  const walk=(value,at='')=>{if(Array.isArray(value))return value.forEach((child,index)=>walk(child,`${at}[${index}]`));if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){const next=at?`${at}.${key}`:key;if(forbidden.test(key))findings.push(next);walk(child,next)}};
  walk(policy); return sorted(unique(findings));
}

function compileDefinitions(definitions=[], expectedClassKey, expectedClasses) {
  const invalid=[]; const compiled=[];
  for (const definition of definitions) {
    let expression=null;
    try { expression=new RegExp(definition.pattern,'giu'); } catch {}
    if (!definition.definitionKey || !expectedClasses.has(definition[expectedClassKey]) || !definition.pattern || !expression || expression.test('')) {
      invalid.push(definition.definitionKey || '(missing)'); continue;
    }
    expression.lastIndex=0; compiled.push({...definition,expression});
  }
  return {compiled,invalid:unique(invalid),duplicateKeys:duplicates(definitions.map(item=>item.definitionKey))};
}

export function compileParentMemberInventoryEvidencePolicy(policy={}) {
  const totals=compileDefinitions(policy.sourceScan?.declaredTotalDefinitions || [],'quantityClass',new Set(['exact_source_authored_total_observation','approximate_source_authored_total_observation']));
  const qualifications=compileDefinitions(policy.sourceScan?.nonExhaustiveDefinitions || [],'qualificationClass',new Set(['source_authored_non_exhaustive_inventory_warning']));
  const invalidRules=REQUIRED_RULES.filter(rule=>policy.rules?.[rule]!==true);
  if(policy.rules?.automaticVerificationAllowed!==false)invalidRules.push('automaticVerificationAllowed');
  const contractValid=policy.inputContract==='sensum.member-identity-and-authoritative-source-channel-evidence-work-routing.v1'
    && policy.recordContract==='sensum.parent-member-inventory-evidence.v1'
    && policy.auditContract==='sensum.parent-member-inventory-evidence-audit.v1'
    && policy.inputState==='member_identity_and_authoritative_source_channel_evidence_work_routed_gates_closed'
    && policy.inputBranchKey==='reviewed_member_identity_expansion'
    && policy.inputWorkKind==='reviewed_member_identity_expansion';
  const invalidChannels=JSON.stringify(policy.requiredCaptureChannels||[])===JSON.stringify(CHANNELS)?[]:['requiredCaptureChannels'];
  const forbidden=forbiddenPolicyPaths(policy);
  const invalidDefinitions=[...totals.invalid,...qualifications.invalid];
  const duplicateDefinitionKeys=unique([...totals.duplicateKeys,...qualifications.duplicateKeys]);
  const valid=contractValid&&!invalidRules.length&&!invalidChannels.length&&!forbidden.length&&!invalidDefinitions.length&&!duplicateDefinitionKeys.length&&totals.compiled.length>0&&qualifications.compiled.length>0;
  return {valid,contractValid,invalidRules,invalidChannels,forbiddenPolicyPaths:forbidden,invalidDefinitions,duplicateDefinitionKeys,declaredTotalDefinitions:totals.compiled,nonExhaustiveDefinitions:qualifications.compiled};
}

function selectorMatches(record,policy){
  const route=record.memberIdentityAndAuthoritativeSourceChannelEvidenceWorkRouting||{};
  const memberItems=(route.domainEvidenceWorkItems||[]).filter(item=>item.branchKey===policy.inputBranchKey&&item.inputWorkKind===policy.inputWorkKind);
  return record.contract===policy.inputContract&&record.state===policy.inputState&&record.accountIndependent===true
    && route.routeState==='routed_blocked_member_identity_and_authoritative_source_channel_work_not_completed'
    && route.memberIdentityWorkItemCount===1&&memberItems.length===1&&memberItems[0].domainKey==='member_task_reselection_and_repeatability'
    && memberItems[0].evidenceWorkComplete===false&&memberItems[0].evidenceKeys?.length===0
    && memberItems[0].requireExactSameLineSubjectPredicateScope===true
    && memberItems[0].crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed===false
    && record.memberExpansionReview?.state==='unreviewed'&&record.mechanicsReview?.state==='unreviewed'&&record.optimizerEligible===false;
}
export function selectParentMemberInventoryEvidenceInputs(records=[],policy={}){return records.filter(record=>selectorMatches(record,policy))}

export function discoverParentMemberInventoryExactRevisionRequests(records=[],policy={}) {
  const requests=new Map();
  for(const record of selectParentMemberInventoryEvidenceInputs(records,policy)){
    const source=record.canonicalActivitySubjectBinding?.sourcePageIdentity||{}; if(!source.sourceRevision)continue;
    const key=String(source.sourceRevision); const request=requests.get(key)||{sourceRevision:key,sourcePageId:Number(source.sourcePageId||0)||null,resolvedTitle:source.resolvedTitle||null,sourceTimestamp:source.sourceTimestamp||null,sourceUrl:source.sourceUrl||null,sourceContentHash:source.sourceContentHash||null,routeContexts:[]};
    request.routeContexts.push({memberCandidateKey:record.memberCandidateKey,canonicalActivityKey:record.canonicalActivityIdentity?.canonicalActivityKey||null});
    request.routeContexts.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))); requests.set(key,request);
  }
  return [...requests.values()].sort((a,b)=>Number(a.sourcePageId)-Number(b.sourcePageId)||a.sourceRevision.localeCompare(b.sourceRevision));
}

function fetchedByRevision(fetchedPages=[]){return new Map(fetchedPages.flatMap(page=>(page.revisions||[]).map(revision=>[String(revision.revid),{page,revision}])))}
function lineStarts(text){const starts=[0];for(let i=0;i<text.length;i++)if(text[i]==='\n')starts.push(i+1);return starts}
function lineNumberAt(starts,offset){let low=0,high=starts.length-1;while(low<=high){const middle=Math.floor((low+high)/2);if(starts[middle]<=offset)low=middle+1;else high=middle-1}return high+1}
function locatorFor(text,starts,index,length){const lineStart=lineNumberAt(starts,index),lineEnd=lineNumberAt(starts,Math.max(index,index+length-1));return {lineStart,lineEnd,columnStart:index-starts[lineStart-1]+1,columnEnd:index+length-starts[lineEnd-1]}}
function sourceLines(text,contentHash){return String(text).split(/\r?\n/).map((rawText,index)=>({ordinal:index+1,sourceLocator:{lineStart:index+1,lineEnd:index+1},rawText,rawTextContentHash:contentHash(rawText)}))}

function sectionPaths(text,headings){
  const byLine=new Map(headings.map(item=>[item.line,item])); const stack=[]; const paths=[]; const lines=String(text).split(/\r?\n/);
  for(let i=0;i<lines.length;i++){const heading=byLine.get(i+1);if(heading){while(stack.length&&stack.at(-1).level>=heading.level)stack.pop();stack.push({level:heading.level,title:heading.normalizedTitle});}paths[i+1]=stack.map(item=>item.title)}
  return paths;
}

function splitCells(raw){
  const cells=[];let start=0,templateDepth=0,linkDepth=0;
  for(let i=0;i<raw.length-1;i++){
    const pair=raw.slice(i,i+2);
    if(pair==='{{'){templateDepth++;i++;continue} if(pair==='}}'&&templateDepth){templateDepth--;i++;continue}
    if(pair==='[['){linkDepth++;i++;continue} if(pair===']]'&&linkDepth){linkDepth--;i++;continue}
    if(pair==='||'&&templateDepth===0&&linkDepth===0){cells.push(raw.slice(start,i).trim());start=i+2;i++}
  }
  cells.push(raw.slice(start).trim()); return cells;
}

function parseTables(text,paths,contentHash){
  const lines=String(text).split(/\r?\n/);const tables=[];let current=null,row=null,depth=0;
  const finishRow=()=>{if(row){row.cellCount=row.cells.length;row.rawTextContentHash=contentHash(row.rawText);current.rows.push(row);row=null}};
  for(let i=0;i<lines.length;i++){
    const raw=lines[i],trimmed=raw.trim();
    if(trimmed.startsWith('{|')){depth++;if(depth===1)current={tableOrdinal:tables.length+1,sourceLocator:{lineStart:i+1,lineEnd:null},sectionPath:paths[i+1]||[],openingLine:raw,rows:[]};continue}
    if(!current)continue;
    if(trimmed.startsWith('|}')){if(depth===1){finishRow();current.sourceLocator.lineEnd=i+1;current.rowCount=current.rows.length;current.cellCount=current.rows.reduce((sum,item)=>sum+item.cells.length,0);current.rawTextContentHash=contentHash(lines.slice(current.sourceLocator.lineStart-1,i+1).join('\n'));tables.push(current);current=null}depth=Math.max(0,depth-1);continue}
    if(depth!==1)continue;
    if(trimmed.startsWith('|-')){finishRow();row={rowOrdinal:(current.rows?.length||0)+1,sourceLocator:{lineStart:i+1,lineEnd:i+1},rawText:raw,cells:[]};continue}
    if((trimmed.startsWith('|')||trimmed.startsWith('!'))&&!trimmed.startsWith('|+')){
      if(!row)row={rowOrdinal:(current.rows?.length||0)+1,sourceLocator:{lineStart:i+1,lineEnd:i+1},rawText:'',cells:[]};
      row.sourceLocator.lineEnd=i+1;row.rawText+=(row.rawText?'\n':'')+raw;const marker=trimmed[0];const payload=trimmed.slice(1);const parts=splitCells(payload);
      for(const part of parts)row.cells.push({cellOrdinal:row.cells.length+1,cellKind:marker==='!'?'header':'data',rawText:part,sourceLocator:{lineStart:i+1,lineEnd:i+1},rawTextContentHash:contentHash(part)});
    }
  }
  return tables;
}

function parseBullets(text,paths,contentHash){return String(text).split(/\r?\n/).flatMap((rawText,index)=>{const match=rawText.match(/^(\*+)\s*(.+)$/u);return match?[{entryOrdinal:0,depth:match[1].length,rawText,entryText:match[2],sectionPath:paths[index+1]||[],sourceLocator:{lineStart:index+1,lineEnd:index+1},rawTextContentHash:contentHash(rawText)}]:[]}).map((entry,index)=>({...entry,entryOrdinal:index+1}))}
function parsePlinks(text,paths,contentHash){const starts=lineStarts(text);const observations=[];const pattern=/\{\{\s*plink\s*\|\s*([^|}\n]+)(?:\|[^}]*)?\}\}/giu;let ordinal=0;for(const match of String(text).matchAll(pattern)){ordinal++;const loc=locatorFor(text,starts,match.index,match[0].length);observations.push({templateOrdinal:ordinal,template:'plink',requestedTitle:match[1].trim(),rawInvocation:match[0],sectionPath:paths[loc.lineStart]||[],sourceLocator:loc,rawInvocationContentHash:contentHash(match[0])})}return observations}
function scanSignals(text,definitions,contentHash){const starts=lineStarts(text),lines=String(text).split(/\r?\n/),signals=[];for(const definition of definitions){definition.expression.lastIndex=0;let ordinal=0;for(const match of String(text).matchAll(definition.expression)){ordinal++;const loc=locatorFor(text,starts,match.index,match[0].length),line=lines[loc.lineStart-1]||'';signals.push({signalOrdinal:0,definitionKey:definition.definitionKey,observationClass:definition.quantityClass||definition.qualificationClass,observedQuantity:definition.quantityClass?Number(match[1]):null,observedNoun:definition.quantityClass?(match[2]||null):null,matchedText:match[0],exactSourceLine:line,exactSourceLineContentHash:contentHash(line),sourceLocator:loc})}}return signals.sort((a,b)=>a.sourceLocator.lineStart-b.sourceLocator.lineStart||a.sourceLocator.columnStart-b.sourceLocator.columnStart||a.definitionKey.localeCompare(b.definitionKey)).map((item,index)=>({...item,signalOrdinal:index+1}))}

function priorSources(input){return [...(input.canonicalActivityScopeEvidenceSources||[]),...(input.canonicalActivityRepeatabilityEvidenceSources||[])];}
function packetFor(input,fetched,policy,contentHash){
  const compiled=compileParentMemberInventoryEvidencePolicy(policy);const expected=input.canonicalActivitySubjectBinding?.sourcePageIdentity||{};const page=fetched?.page||null,revision=fetched?.revision||null,content=sourceContent(revision);const computedHash=typeof content==='string'?contentHash(content):null,sourceUrl=page?.title?wikiUrl(page.title):null;
  const matchingPrior=priorSources(input).filter(source=>source.sourcePageIdentity?.sourcePageId===expected.sourcePageId&&source.sourcePageIdentity?.sourceRevision===expected.sourceRevision&&source.sourcePageIdentity?.sourceContentHash===expected.sourceContentHash&&source.exactRevisionSourceText===content);
  const verification={fetchedPagePresent:Boolean(page),fetchedRevisionContentPresent:typeof content==='string',fetchedPageIdMatchesBinding:Boolean(page&&Number(page.pageid)===Number(expected.sourcePageId)),fetchedTitleMatchesBinding:Boolean(page&&page.title===expected.resolvedTitle),fetchedRevisionMatchesBinding:Boolean(revision&&String(revision.revid)===String(expected.sourceRevision||'')),fetchedTimestampMatchesBinding:Boolean(revision&&revision.timestamp===expected.sourceTimestamp),fetchedUrlMatchesBinding:Boolean(sourceUrl&&sourceUrl===expected.sourceUrl),fetchedContentHashMatchesBinding:Boolean(computedHash&&computedHash===expected.sourceContentHash),priorExactRevisionHashAndTextPacketPresent:matchingPrior.length>0};
  const headings=typeof content==='string'?parseSourceHeadings(content):[],paths=typeof content==='string'?sectionPaths(content,headings):[];const lines=typeof content==='string'?sourceLines(content,contentHash):[];const tables=typeof content==='string'?parseTables(content,paths,contentHash):[];const bullets=typeof content==='string'?parseBullets(content,paths,contentHash):[];const plinks=typeof content==='string'?parsePlinks(content,paths,contentHash):[];const totals=typeof content==='string'?scanSignals(content,compiled.declaredTotalDefinitions,contentHash):[];const qualifications=typeof content==='string'?scanSignals(content,compiled.nonExhaustiveDefinitions,contentHash):[];
  const capture={complete_exact_revision_source_text:typeof content==='string'&&content.length>0,prior_source_packet_revision_hash_and_text_alignment:matchingPrior.length>0,complete_source_line_inventory:typeof content==='string'&&lines.length===String(content).split(/\r?\n/).length,heading_and_section_boundary_inventory:typeof content==='string',top_level_wikitable_row_and_cell_inventory:typeof content==='string',source_authored_bullet_entry_inventory:typeof content==='string',root_plink_template_inventory:typeof content==='string',declared_total_signal_inventory:typeof content==='string',non_exhaustive_qualification_signal_inventory:typeof content==='string',completeness_and_member_identity_verdict_separation:true};
  const deficiencies=[];if(!Object.values(verification).every(Boolean))deficiencies.push('exact_bound_subject_revision_identity_hash_or_prior_packet_alignment_failed');if(CHANNELS.some(channel=>capture[channel]!==true))deficiencies.push('one_or_more_parent_member_inventory_capture_channels_incomplete');
  const sourceEvidenceKey=`${input.memberCandidateKey}|${expected.sourcePageId}|${expected.sourceRevision}:parent-member-inventory-source`;
  return {sourceEvidenceKey,canonicalActivityKey:input.canonicalActivityIdentity?.canonicalActivityKey||null,sourcePageIdentity:{sourcePageId:page?.pageid?Number(page.pageid):null,resolvedTitle:page?.title||null,sourceRevision:revision?.revid?String(revision.revid):null,sourceTimestamp:revision?.timestamp||null,sourceUrl,sourceContentHash:computedHash,sourceContentBytes:typeof content==='string'?Buffer.byteLength(content,'utf8'):0},sourceRevisionVerification:verification,exactRevisionSourceText:typeof content==='string'?content:null,structuralInventory:{sourceLines:lines,headings,topLevelWikiTables:tables,sourceAuthoredBulletEntries:bullets,rootPlinkTemplates:plinks,declaredTotalSignals:totals,nonExhaustiveQualificationSignals:qualifications},captureChannels:CHANNELS.map(channelKey=>({channelKey,complete:capture[channelKey]===true})),inventoryCompletenessVerdict:null,memberIdentityVerdict:null,reviewedMemberIdentities:[],deficiencies,state:deficiencies.length?'blocked_incomplete_revision_pinned_parent_member_inventory_source':'complete_revision_pinned_parent_member_inventory_source'};
}

function expectedRecord(input,fetchedPages,policy,contentHash){
  const fetched=fetchedByRevision(fetchedPages),source=input.canonicalActivitySubjectBinding?.sourcePageIdentity||{},packet=packetFor(input,fetched.get(String(source.sourceRevision||'')),policy,contentHash),complete=packet.state==='complete_revision_pinned_parent_member_inventory_source';
  const totals=packet.structuralInventory.declaredTotalSignals,qualifications=packet.structuralInventory.nonExhaustiveQualificationSignals;const boundary=totals.length&&qualifications.length?'declared_total_and_non_exhaustive_qualification_observed_semantic_disposition_required':totals.length?'declared_total_observed_without_complete_member_universe_proof':qualifications.length?'non_exhaustive_qualification_observed_without_declared_total_reconciliation':'no_source_authored_completeness_boundary_resolved';
  const {contentHash:inputHash,blockers:inputBlockers=[],...rest}=input;
  return {contract:policy.recordContract,...preservedInput(rest),sourceMemberIdentityAndAuthoritativeSourceChannelEvidenceWorkRoutingContentHash:inputHash,parentMemberInventoryEvidenceSources:[packet],parentMemberInventoryEvidence:{evidenceState:complete?'complete_revision_pinned_parent_member_inventory_observation_packet':'blocked_incomplete_parent_member_inventory_observation_packet',inventoryBoundaryState:boundary,sourceEvidenceKeys:[packet.sourceEvidenceKey],observationCounts:{sourceLineCount:packet.structuralInventory.sourceLines.length,headingCount:packet.structuralInventory.headings.length,topLevelWikiTableCount:packet.structuralInventory.topLevelWikiTables.length,tableRowCount:packet.structuralInventory.topLevelWikiTables.reduce((sum,table)=>sum+table.rowCount,0),tableCellCount:packet.structuralInventory.topLevelWikiTables.reduce((sum,table)=>sum+table.cellCount,0),bulletEntryCount:packet.structuralInventory.sourceAuthoredBulletEntries.length,rootPlinkTemplateCount:packet.structuralInventory.rootPlinkTemplates.length,declaredTotalSignalCount:totals.length,nonExhaustiveQualificationSignalCount:qualifications.length},declaredTotalObservations:totals.map(signal=>({definitionKey:signal.definitionKey,observationClass:signal.observationClass,observedQuantity:signal.observedQuantity,observedNoun:signal.observedNoun,evidenceKey:`${packet.sourceEvidenceKey}:declared-total:${signal.signalOrdinal}`})),memberUniverseComplete:false,inventoryCompletenessVerdict:null,memberIdentityVerdict:null,reviewedMemberIdentityCount:0,automaticVerificationApplied:false},parentMemberInventoryEvidenceReview:{state:complete?'unreviewed_revision_pinned_parent_member_inventory_semantic_disposition_required':'blocked_incomplete_parent_member_inventory_evidence',inventoryCompletenessVerdict:null,memberIdentityVerdict:null,reviewedMemberIdentities:[],evidenceKeys:complete?[packet.sourceEvidenceKey]:[]},accountIndependent:true,blockers:unique([...inputBlockers,...packet.deficiencies,'parent_member_inventory_evidence_requires_semantic_disposition',...(qualifications.length?['source_inventory_non_exhaustive_qualification_requires_explicit_resolution']:[]),'stable_member_identities_not_reviewed','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked']),state:complete?'parent_member_inventory_evidence_ready_for_semantic_disposition':'parent_member_inventory_evidence_blocked_incomplete'};
}

function accountStateFindings(records){const forbidden=/^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i;const findings=[];const walk=(value,at='')=>{if(Array.isArray(value))return value.forEach((child,index)=>walk(child,`${at}[${index}]`));if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){const next=at?`${at}.${key}`:key;if(forbidden.test(key))findings.push(next);walk(child,next)}};records.forEach((record,index)=>walk(record,`[${index}]`));return findings}

export function auditParentMemberInventoryEvidence(records=[],{routingRecords=[],fetchedPages=[],policy={},contentHash=hash}={}){
  const compiled=compileParentMemberInventoryEvidencePolicy(policy),inputs=selectParentMemberInventoryEvidenceInputs(routingRecords,policy),expected=compiled.valid?inputs.map(input=>expectedRecord(input,fetchedPages,policy,contentHash)):[];const inputKeys=inputs.map(item=>item.memberCandidateKey),outputKeys=records.map(item=>item.memberCandidateKey),duplicateInputKeys=duplicates(inputKeys),duplicateOutputKeys=duplicates(outputKeys),missingOutputKeys=inputKeys.filter(key=>!outputKeys.includes(key)),unexpectedOutputKeys=outputKeys.filter(key=>!inputKeys.includes(key));
  const requested=discoverParentMemberInventoryExactRevisionRequests(routingRecords,policy).map(item=>item.sourceRevision).sort(),fetched=fetchedPages.flatMap(page=>(page.revisions||[]).map(revision=>String(revision.revid))).sort();const exactRevisionFetchSetMatch=JSON.stringify(requested)===JSON.stringify(fetched);
  const recordMismatches=records.filter(record=>{const match=expected.find(item=>item.memberCandidateKey===record.memberCandidateKey);return !match||hash(record)!==hash(match)}).map(item=>item.memberCandidateKey);const upstreamMismatches=records.filter(record=>{const input=inputs.find(item=>item.memberCandidateKey===record.memberCandidateKey);return !input||hash(preservedInput(record))!==hash(preservedInput(input))}).map(item=>item.memberCandidateKey);
  const unsupportedPromotions=records.filter(record=>record.parentMemberInventoryEvidence?.memberUniverseComplete!==false||record.parentMemberInventoryEvidence?.inventoryCompletenessVerdict!==null||record.parentMemberInventoryEvidence?.memberIdentityVerdict!==null||record.parentMemberInventoryEvidence?.reviewedMemberIdentityCount!==0||record.parentMemberInventoryEvidenceReview?.inventoryCompletenessVerdict!==null||record.parentMemberInventoryEvidenceReview?.memberIdentityVerdict!==null||record.parentMemberInventoryEvidenceReview?.reviewedMemberIdentities?.length||record.memberExpansionReview?.state!=='unreviewed'||record.mechanicsReview?.state!=='unreviewed'||record.optimizerEligible!==false).map(item=>item.memberCandidateKey);
  const packets=records.flatMap(record=>record.parentMemberInventoryEvidenceSources||[]),completePackets=packets.filter(packet=>packet.state==='complete_revision_pinned_parent_member_inventory_source'),accountFindings=accountStateFindings(records);const blockers=[];
  if(!compiled.valid)blockers.push('parent_member_inventory_evidence_policy_invalid_or_activity_specific');if(routingRecords.length!==inputs.length||duplicateInputKeys.length)blockers.push('input_routing_set_not_exactly_eligible_and_unique');if(duplicateOutputKeys.length||missingOutputKeys.length||unexpectedOutputKeys.length)blockers.push('input_output_inventory_evidence_set_mismatch');if(!exactRevisionFetchSetMatch)blockers.push('exact_parent_member_inventory_revision_fetch_set_mismatch');if(recordMismatches.length)blockers.push('one_or_more_parent_member_inventory_packets_do_not_match_exact_sources');if(upstreamMismatches.length)blockers.push('input_evidence_revisions_discovery_disposition_or_routing_changed');if(unsupportedPromotions.length)blockers.push('parent_member_inventory_evidence_created_unsupported_member_repeatability_mechanics_or_optimizer_promotion');if(accountFindings.length)blockers.push('current_account_state_present');
  const attemptComplete=compiled.valid&&routingRecords.length===inputs.length&&!duplicateInputKeys.length&&!duplicateOutputKeys.length&&!missingOutputKeys.length&&!unexpectedOutputKeys.length&&exactRevisionFetchSetMatch&&!recordMismatches.length&&!upstreamMismatches.length&&!unsupportedPromotions.length&&!accountFindings.length;
  const observations=packets.map(packet=>packet.structuralInventory||{});const observationCoverage={sourceLineCount:observations.reduce((sum,item)=>sum+(item.sourceLines||[]).length,0),headingCount:observations.reduce((sum,item)=>sum+(item.headings||[]).length,0),topLevelWikiTableCount:observations.reduce((sum,item)=>sum+(item.topLevelWikiTables||[]).length,0),tableRowCount:observations.reduce((sum,item)=>sum+(item.topLevelWikiTables||[]).reduce((inner,table)=>inner+(table.rowCount||0),0),0),tableCellCount:observations.reduce((sum,item)=>sum+(item.topLevelWikiTables||[]).reduce((inner,table)=>inner+(table.cellCount||0),0),0),bulletEntryCount:observations.reduce((sum,item)=>sum+(item.sourceAuthoredBulletEntries||[]).length,0),rootPlinkTemplateCount:observations.reduce((sum,item)=>sum+(item.rootPlinkTemplates||[]).length,0),declaredTotalSignalCount:observations.reduce((sum,item)=>sum+(item.declaredTotalSignals||[]).length,0),nonExhaustiveQualificationSignalCount:observations.reduce((sum,item)=>sum+(item.nonExhaustiveQualificationSignals||[]).length,0),reviewedMemberIdentityCount:0,inventoryCompletenessVerdictCount:0,memberIdentityVerdictCount:0};return {contract:policy.auditContract,inputCoverage:{inputRoutingRecordCount:routingRecords.length,eligibleMemberIdentityBranchCount:inputs.length,inventoryEvidenceRecordCount:records.length,duplicateInputKeys,duplicateOutputKeys,missingOutputKeys,unexpectedOutputKeys},policyCoverage:compiled,revisionCoverage:{requestedRevisionCount:requested.length,fetchedRevisionCount:fetched.length,requestedRevisions:requested,fetchedRevisions:fetched,exactRevisionFetchSetMatch,completeVerifiedSourcePacketCount:completePackets.length},captureCoverage:{sourcePacketCount:packets.length,completeSourcePacketCount:completePackets.length,requiredCaptureChannelCount:CHANNELS.length,completedCaptureChannelCount:packets.reduce((sum,packet)=>sum+(packet.captureChannels||[]).filter(channel=>channel.complete).length,0)},observationCoverage,semanticPreservationCoverage:{recordMismatches,upstreamMismatches,unsupportedPromotions},accountStateFindings:accountFindings,evidencePacketAttemptCoverageComplete:attemptComplete,inventoryEvidencePacketCoverageComplete:attemptComplete&&completePackets.length===inputs.length,memberIdentityReviewComplete:false,memberExpansionComplete:false,mechanicsReviewComplete:false,optimizerEligibleCount:0,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:unique([...blockers,'parent_member_inventory_evidence_requires_semantic_disposition',...(observationCoverage.nonExhaustiveQualificationSignalCount?['source_inventory_non_exhaustive_qualification_requires_explicit_resolution']:[]),'stable_member_identities_not_reviewed','all_repeatability_evidence_domains_remain_unresolved','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']),publishable:attemptComplete};
}

export function buildParentMemberInventoryEvidence({routingRecords=[],fetchedPages=[],policy={},contentHash=hash}){const compiled=compileParentMemberInventoryEvidencePolicy(policy);const records=compiled.valid?selectParentMemberInventoryEvidenceInputs(routingRecords,policy).map(input=>expectedRecord(input,fetchedPages,policy,contentHash)):[];return {records,audit:auditParentMemberInventoryEvidence(records,{routingRecords,fetchedPages,policy,contentHash})}}
