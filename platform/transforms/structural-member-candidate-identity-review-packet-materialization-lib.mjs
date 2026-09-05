import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES=['onePacketPerReviewReadyIdentityWorkItem','exactRevisionSubjectSourceIdentityHashBytesAndTextMustRevalidate','oneIdentityBearingRootInfoboxMustMatchTheReadinessEvidence','sourceAuthoredNameFieldsMustMatchTheExactInfobox','candidateDispositionMustMatchTheRoutedCandidateExactly','parentOccurrenceRevisionHashLocatorAndExactTextMustRevalidate','reviewPacketMustContainSubjectAndParentEvidence','packetGenerationDoesNotRecordAReviewDecision','confirmedSourcePageSubjectIdentityWouldNotProveParentMembership','identityReviewCannotProveWeightRepeatabilityMechanicsMappingOrCompleteness','allReviewDecisionsVerdictsAndCanonicalIdentitiesRemainNull','allNonReviewRoutesAndUpstreamEvidenceMustBePreserved','namesTitlesPageIdsRevisionsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior','memberExpansionMechanicsAndOptimizerPromotionAreForbidden','currentAccountStateIsForbidden'];
const DECISIONS=['confirm_source_page_subject_identity_for_candidate','reject_source_page_subject_identity_for_candidate','needs_additional_evidence'];
const STAGE_FIELDS=new Set(['contract','contentHash','blockers','state','sourceStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutingContentHash','structuralMemberCandidateIdentityReviewPackets','structuralMemberCandidateIdentityReviewPacketMaterialization']);
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const duplicates=values=>unique(values.filter((value,index)=>values.indexOf(value)!==index));
const normalize=value=>String(value||'').replaceAll('_',' ').replace(/\s+/g,' ').trim().toLowerCase();
const preservedInput=record=>Object.fromEntries(Object.entries(record||{}).filter(([key])=>!STAGE_FIELDS.has(key)));

function forbiddenPolicyPaths(policy={}){
  const findings=[];
  const forbidden=/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|title|titles|label|labels|alias|aliases|override|overrides)$/i;
  const walk=(value,at='')=>{
    if(Array.isArray(value))return value.forEach((child,index)=>walk(child,`${at}[${index}]`));
    if(!value||typeof value!=='object')return;
    for(const [key,child]of Object.entries(value)){
      const next=at?`${at}.${key}`:key;
      if(forbidden.test(key))findings.push(next);
      walk(child,next);
    }
  };
  walk(policy);
  return sorted(unique(findings));
}
export function compileStructuralMemberCandidateIdentityReviewPacketMaterializationPolicy(policy={}){
  const invalidRules=REQUIRED_RULES.filter(rule=>policy.rules?.[rule]!==true);
  if(policy.rules?.automaticVerificationAllowed!==false)invalidRules.push('automaticVerificationAllowed');
  const contractValid=policy.inputContract==='sensum.structural-member-candidate-review-ready-identity-and-remaining-gap-work-routing.v1'
    &&policy.recordContract==='sensum.structural-member-candidate-identity-review-packets.v1'
    &&policy.auditContract==='sensum.structural-member-candidate-identity-review-packet-materialization-audit.v1'
    &&policy.inputState==='structural_member_candidate_review_ready_identity_and_remaining_gap_work_routed_gates_closed'
    &&policy.reviewRouteKey==='source_bound_candidate_identity_review';
  const decisionsValid=Array.isArray(policy.allowedDecisions)&&policy.allowedDecisions.length===DECISIONS.length&&DECISIONS.every((decision,index)=>policy.allowedDecisions[index]===decision);
  const forbidden=forbiddenPolicyPaths(policy);
  return {valid:contractValid&&decisionsValid&&!invalidRules.length&&!forbidden.length,contractValid,decisionsValid,invalidRules:unique(invalidRules),forbiddenPolicyPaths:forbidden};
}

function reviewWorkItemValid(item={},policy={}){
  return item.routeKey===policy.reviewRouteKey
    &&item.reviewReady===true
    &&item.workState==='pending_explicit_source_bound_identity_review_no_verdict'
    &&typeof item.workItemKey==='string'&&item.workItemKey.length>0
    &&typeof item.structuralCandidateKey==='string'&&item.structuralCandidateKey.length>0
    &&item.sourceDispositionKeys?.length===1
    &&item.sourceEvidenceKeys?.length>=2
    &&item.requiredChannels?.length===4
    &&item.identityAndVariantScopeReviewReadiness?.reviewReady===true
    &&item.identityAndVariantScopeReviewReadiness?.sourceIntegrity?.complete===true
    &&item.identityAndVariantScopeReviewReadiness?.identityBearingRootTemplates?.length===1
    &&item.identityAndVariantScopeReviewReadiness?.infoboxNameFields?.length>0
    &&item.identityAndVariantScopeReviewReadiness?.multiVariantSeries===false
    &&item.identityAndVariantScopeReviewReadiness?.blockers?.length===0
    &&item.newEvidenceKeys?.length===0
    &&item.reviewDecision===null
    &&item.candidateMemberIdentityVerdict===null
    &&item.sourcePageEntityTypeVerdict===null
    &&item.structuralParentRelationshipVerdict===null
    &&item.weightedTaskEntryMembershipVerdict===null
    &&item.mappingVerdict===null
    &&item.inventoryCompletenessVerdict===null
    &&item.canonicalGameEntityIdentity===null
    &&item.memberUniverseComplete===false
    &&item.evidenceWorkComplete===false
    &&item.automaticVerificationApplied===false;
}
function selectorMatches(record,policy){
  const route=record.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting||{};
  const reviewItems=route.reviewReadyIdentityWorkItems||[];
  return record.contract===policy.inputContract
    &&record.state===policy.inputState
    &&record.accountIndependent===true
    &&route.routeState==='review_ready_identities_and_remaining_semantic_gaps_routed_all_verdicts_closed'
    &&route.reviewReadyIdentityWorkItemCount===reviewItems.length
    &&reviewItems.length>0
    &&new Set(reviewItems.map(item=>item.workItemKey)).size===reviewItems.length
    &&new Set(reviewItems.map(item=>item.structuralCandidateKey)).size===reviewItems.length
    &&reviewItems.every(item=>reviewWorkItemValid(item,policy))
    &&route.completedWorkItemCount===0
    &&route.reviewDecisionCount===0
    &&route.semanticVerdictCount===0
    &&route.identityReviewComplete===false
    &&route.memberUniverseComplete===false
    &&route.evidenceWorkComplete===false
    &&route.automaticVerificationApplied===false
    &&record.memberExpansionReview?.state==='unreviewed'
    &&record.mechanicsReview?.state==='unreviewed'
    &&record.optimizerEligible===false;
}
export function selectStructuralMemberCandidateIdentityReviewPacketMaterializationInputs(records=[],policy={}){return records.filter(record=>selectorMatches(record,policy));}

function sourceIntegrity(source={},contentHash=hash){
  const identity=source.sourcePageIdentity||{},text=source.exactRevisionSourceText;
  const checks={captureComplete:source.captureComplete===true&&source.state==='complete_exact_revision_source_capture_non_verdict',pageIdPresent:Number(identity.sourcePageId)>0,titlePresent:typeof identity.resolvedTitle==='string'&&identity.resolvedTitle.length>0,revisionPresent:typeof identity.sourceRevision==='string'&&identity.sourceRevision.length>0,timestampPresent:typeof identity.sourceTimestamp==='string'&&identity.sourceTimestamp.length>0,urlPresent:typeof identity.sourceUrl==='string'&&identity.sourceUrl.length>0,textPresent:typeof text==='string',hashMatches:typeof text==='string'&&contentHash(text)===identity.sourceContentHash,bytesMatch:typeof text==='string'&&Buffer.byteLength(text,'utf8')===identity.sourceContentBytes,upstreamIntegrityChecksPassed:Object.values(source.integrityChecks||{}).length>0&&Object.values(source.integrityChecks||{}).every(Boolean),semanticVerdictNull:source.semanticVerdict===null};
  return {checks,complete:Object.values(checks).every(Boolean)};
}
function topLevelParameters(block=''){
  const source=String(block),segments=[];let depth=0,linkDepth=0,start=null;
  for(let index=0;index<source.length-1;index++){
    const pair=source.slice(index,index+2);
    if(pair==='{{'){depth++;index++;continue;}
    if(pair==='}}'){if(depth===1&&start!==null){segments.push(source.slice(start,index));start=null;}depth=Math.max(0,depth-1);index++;continue;}
    if(pair==='[['){linkDepth++;index++;continue;}
    if(pair===']]'&&linkDepth>0){linkDepth--;index++;continue;}
    if(source[index]==='|'&&depth===1&&linkDepth===0){if(start!==null)segments.push(source.slice(start,index));start=index+1;}
  }
  return segments.map(segment=>{const equals=segment.indexOf('=');return equals<0?null:{name:segment.slice(0,equals).trim(),nameKey:normalize(segment.slice(0,equals)),value:segment.slice(equals+1).trim()};}).filter(Boolean);
}
function rootTemplateBlocks(source=''){
  const text=String(source),blocks=[];let depth=0,start=-1,name='';
  for(let index=0;index<text.length-1;index++){
    const pair=text.slice(index,index+2);
    if(pair==='{{'){if(depth===0){start=index;let end=index+2;while(end<text.length&&!/[|}\r\n]/.test(text[end]))end++;name=text.slice(index+2,end).replace(/^subst\s*:/i,'').trim();}depth++;index++;continue;}
    if(pair==='}}'&&depth>0){depth--;if(depth===0&&start>=0){const block=text.slice(start,index+2),lineStart=text.slice(0,start).split(/\r?\n/).length,lineEnd=lineStart+block.split(/\r?\n/).length-1;blocks.push({template:name,templateKey:normalize(name),lineStart,lineEnd,exactSourceText:block,parameters:topLevelParameters(block)});start=-1;name='';}index++;}
  }
  return blocks;
}
function sameNameFields(actual=[],expected=[]){
  const shape=values=>values.map(item=>({name:String(item.name||''),value:String(item.value||'')}));
  return JSON.stringify(shape(actual))===JSON.stringify(shape(expected));
}
function sourceForIdentity(sources,identity={}){return sources.find(source=>Number(source.sourcePageIdentity?.sourcePageId)===Number(identity.sourcePageId)&&String(source.sourcePageIdentity?.sourceRevision||'')===String(identity.sourceRevision||''));}
function parentOccurrenceIntegrity(candidate={},sources=[],contentHash=hash){
  const evidence=candidate.structuralParentRelationship?.evidence?.sourceCandidateEvidence||{};
  const parent=sourceForIdentity(sources,{sourcePageId:evidence.sourcePageId,sourceRevision:evidence.sourceRevision});
  const parentCheck=parent?sourceIntegrity(parent,contentHash):{checks:{},complete:false};
  const locator=evidence.sourceLocator||{},lines=String(parent?.exactRevisionSourceText||'').split(/\r?\n/),lineStart=Number(locator.lineStart||0),lineEnd=Number(locator.lineEnd||0);
  const locatedText=lineStart>0&&lineEnd>=lineStart?lines.slice(lineStart-1,lineEnd).join('\n'):'';
  const checks={parentSourceIntegrityComplete:parentCheck.complete,parentPageIdMatches:Number(parent?.sourcePageIdentity?.sourcePageId)===Number(evidence.sourcePageId),parentRevisionMatches:String(parent?.sourcePageIdentity?.sourceRevision||'')===String(evidence.sourceRevision||''),parentContentHashMatches:parent?.sourcePageIdentity?.sourceContentHash===evidence.sourceContentHash,locatorValid:lineStart>0&&lineEnd>=lineStart&&lineEnd<=lines.length,exactSourceTextPresent:typeof evidence.exactSourceText==='string'&&evidence.exactSourceText.length>0,exactSourceTextHashMatches:typeof evidence.exactSourceText==='string'&&contentHash(evidence.exactSourceText)===evidence.exactSourceTextContentHash,exactSourceTextOccursAtLocator:typeof evidence.exactSourceText==='string'&&locatedText.includes(evidence.exactSourceText),structuralRelationshipSupported:candidate.structuralParentRelationship?.supported===true,candidateRoleCoherent:candidate.structuralParentRelationship?.roleTypeCoherenceState==='supported_required_source_page_type_present',parentMembershipVerdictNull:candidate.structuralParentRelationship?.parentMembershipVerdict===null,weightedMembershipVerdictNull:candidate.structuralParentRelationship?.weightedTaskEntryMembershipVerdict===null};
  return {parentSource:parent||null,parentSourceIntegrity:parentCheck,evidence,locatedText,checks,complete:Object.values(checks).every(Boolean)};
}

function reviewPacket(record,item,policy,contentHash=hash){
  const readiness=item.identityAndVariantScopeReviewReadiness||{},sources=record.structuralMemberCandidateSemanticGapEvidenceSources||[];
  const subject=sourceForIdentity(sources,readiness.sourcePageIdentity||{}),subjectCheck=subject?sourceIntegrity(subject,contentHash):{checks:{},complete:false};
  const expectedTemplate=readiness.identityBearingRootTemplates?.[0]||{},blocks=subject?rootTemplateBlocks(subject.exactRevisionSourceText):[];
  const matchingBlocks=blocks.filter(block=>block.templateKey===normalize(expectedTemplate.template)&&block.lineStart===Number(expectedTemplate.line));
  const block=matchingBlocks.length===1?matchingBlocks[0]:null;
  const actualNameFields=(block?.parameters||[]).filter(parameter=>/^name(?:\d+)?$/.test(parameter.nameKey)).map(parameter=>({name:parameter.name,value:parameter.value}));
  const candidates=(record.structuralMemberCandidateIdentityDispositions||[]).filter(candidate=>candidate.structuralCandidateKey===item.structuralCandidateKey),candidate=candidates[0]||null;
  const parent=parentOccurrenceIntegrity(candidate||{},sources,contentHash);
  const sourceDisposition=(record.structuralMemberCandidateSemanticGapEvidenceDispositions||[]).find(disposition=>disposition.dispositionKey===item.sourceDispositionKeys?.[0]);
  const checks={workItemReviewReady:reviewWorkItemValid(item,policy),subjectSourceIntegrityComplete:subjectCheck.complete,subjectSourceMatchesReadinessEvidenceKey:subject?.sourceKey===readiness.sourceEvidenceKey,oneMatchingIdentityBearingRootInfobox:matchingBlocks.length===1,rootInfoboxTemplateMatches:block?.template===expectedTemplate.template,rootInfoboxLineMatches:block?.lineStart===Number(expectedTemplate.line),sourceAuthoredNameFieldsMatch:sameNameFields(actualNameFields,readiness.infoboxNameFields||[]),candidateDispositionExactlyOne:candidates.length===1,candidateDispositionIntegrityComplete:candidate?.evidenceIntegrity?.complete===true,candidateDispositionRoleMatches:candidate?.candidateRole===item.candidateRole,candidateDispositionSourceIdentityMatches:contentHash(candidate?.sourcePageIdentity||{})===contentHash(readiness.sourcePageIdentity||{}),sourceDispositionMatches:sourceDisposition?.structuralCandidateKey===item.structuralCandidateKey&&sourceDisposition?.identityAndVariantScopeReviewReadiness?.reviewReady===true,parentOccurrenceComplete:parent.complete};
  const base={contract:'sensum.structural-member-candidate-identity-review-packet.v1',reviewPacketKey:`${item.workItemKey}|source-bound-review-packet`,sourceWorkItemKey:item.workItemKey,sourceDispositionKey:item.sourceDispositionKeys[0],structuralCandidateKey:item.structuralCandidateKey,candidateRole:item.candidateRole,subjectEvidence:{sourceKey:subject?.sourceKey||null,sourcePageIdentity:readiness.sourcePageIdentity||null,sourcePageEntityTypes:readiness.sourcePageEntityTypes||[],identityBearingSourcePageTypes:readiness.identityBearingSourcePageTypes||[],supplementarySourcePageTypes:readiness.supplementarySourcePageTypes||[],rootInfobox:block?{template:block.template,lineStart:block.lineStart,lineEnd:block.lineEnd,exactSourceText:block.exactSourceText,exactSourceTextContentHash:contentHash(block.exactSourceText),parameterNames:block.parameters.map(parameter=>parameter.name),sourceAuthoredNameFields:actualNameFields}:null,sourceIntegrity:subjectCheck},parentOccurrenceEvidence:{sourceKey:parent.parentSource?.sourceKey||null,sourcePageIdentity:parent.parentSource?.sourcePageIdentity||null,exactSourceText:parent.evidence.exactSourceText||null,exactSourceTextContentHash:parent.evidence.exactSourceTextContentHash||null,sourceLocator:parent.evidence.sourceLocator||null,locatedSourceText:parent.locatedText||null,structuralRelationshipClass:candidate?.structuralParentRelationship?.relationshipClass||null,roleTypeCoherenceState:candidate?.structuralParentRelationship?.roleTypeCoherenceState||null,integrity:{checks:parent.checks,complete:parent.complete,parentSourceIntegrity:parent.parentSourceIntegrity}},reviewScope:{decisionScope:'exact_candidate_to_revision_pinned_source_page_subject_identity_and_single_infobox_variant',confirmationDoesNotProve:['weighted_parent_membership','repeatability','requirements','xp','timing','mechanics','declared_total_mapping','member_universe_completeness','optimizer_eligibility'],sourceRevisions:sorted(unique([readiness.sourcePageIdentity?.sourceRevision,parent.evidence.sourceRevision].filter(Boolean)))},allowedDecisions:policy.allowedDecisions,integrityChecks:checks,packetMaterializationComplete:Object.values(checks).every(Boolean),eligibleForSourceBoundReview:Object.values(checks).every(Boolean),decision:null,reviewer:null,reviewedAt:null,decisionSourceRevisions:[],reviewNotes:null,candidateMemberIdentityVerdict:null,canonicalGameEntityIdentity:null,parentMembershipVerdict:null,weightedTaskEntryMembershipVerdict:null,mappingVerdict:null,inventoryCompletenessVerdict:null,memberUniverseComplete:false,automaticVerificationApplied:false,state:'pending_explicit_source_bound_candidate_identity_review'};
  return {...base,packetContentHash:contentHash(base)};
}

function expectedRecord(input,policy,contentHash=hash){
  const items=input.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting.reviewReadyIdentityWorkItems||[],packets=items.map(item=>reviewPacket(input,item,policy,contentHash));
  const {contentHash:inputHash,blockers:inputBlockers=[],...rest}=input;
  return {contract:policy.recordContract,...preservedInput(rest),sourceStructuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRoutingContentHash:inputHash,structuralMemberCandidateIdentityReviewPackets:packets,structuralMemberCandidateIdentityReviewPacketMaterialization:{state:'source_bound_identity_review_packets_materialized_decisions_pending',reviewReadyWorkItemCount:items.length,reviewPacketCount:packets.length,completePacketCount:packets.filter(packet=>packet.packetMaterializationComplete).length,eligibleForSourceBoundReviewCount:packets.filter(packet=>packet.eligibleForSourceBoundReview).length,subjectEvidenceCount:packets.filter(packet=>packet.subjectEvidence?.rootInfobox).length,parentOccurrenceEvidenceCount:packets.filter(packet=>packet.parentOccurrenceEvidence?.exactSourceText).length,decisionCount:0,candidateMemberIdentityVerdictCount:0,canonicalGameEntityIdentityCount:0,reviewPacketMaterializationComplete:packets.length===items.length&&packets.every(packet=>packet.packetMaterializationComplete),identityReviewComplete:false,memberUniverseComplete:false,evidenceWorkComplete:false,automaticVerificationApplied:false},accountIndependent:true,blockers:unique([...inputBlockers,'source_bound_candidate_identity_review_packets_materialized_decisions_pending','candidate_member_identity_review_not_completed','weighted_parent_task_entry_membership_not_proven','one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven','member_universe_completeness_not_proven','all_repeatability_evidence_domains_remain_unresolved','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']),state:'structural_member_candidate_identity_review_packets_materialized_decisions_pending_gates_closed'};
}

function accountStateFindings(records){
  const forbidden=/^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i,findings=[];
  const walk=(value,at='')=>{if(Array.isArray(value))return value.forEach((child,index)=>walk(child,`${at}[${index}]`));if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){const next=at?`${at}.${key}`:key;if(forbidden.test(key))findings.push(next);walk(child,next);}};
  records.forEach((record,index)=>walk(record,`[${index}]`));return findings;
}
export function auditStructuralMemberCandidateIdentityReviewPacketMaterialization(records=[],{routingRecords=[],policy={},contentHash=hash}={}){
  const compiled=compileStructuralMemberCandidateIdentityReviewPacketMaterializationPolicy(policy),inputs=selectStructuralMemberCandidateIdentityReviewPacketMaterializationInputs(routingRecords,policy),expected=compiled.valid?inputs.map(input=>expectedRecord(input,policy,contentHash)):[];
  const inputKeys=inputs.map(item=>item.memberCandidateKey),outputKeys=records.map(item=>item.memberCandidateKey),duplicateInputKeys=duplicates(inputKeys),duplicateOutputKeys=duplicates(outputKeys),missingOutputKeys=inputKeys.filter(key=>!outputKeys.includes(key)),unexpectedOutputKeys=outputKeys.filter(key=>!inputKeys.includes(key));
  const recordMismatches=records.filter(record=>{const match=expected.find(item=>item.memberCandidateKey===record.memberCandidateKey);return !match||contentHash(record)!==contentHash(match);}).map(item=>item.memberCandidateKey),upstreamMismatches=records.filter(record=>{const input=inputs.find(item=>item.memberCandidateKey===record.memberCandidateKey);return !input||contentHash(preservedInput(record))!==contentHash(preservedInput(input));}).map(item=>item.memberCandidateKey);
  const sources=records.flatMap(record=>record.structuralMemberCandidateSemanticGapEvidenceSources||[]),sourceFailures=sources.filter(source=>!sourceIntegrity(source,contentHash).complete).map(source=>source.sourceKey);
  const expectedItems=inputs.flatMap(record=>record.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting.reviewReadyIdentityWorkItems||[]),packets=records.flatMap(record=>record.structuralMemberCandidateIdentityReviewPackets||[]);
  const expectedWorkKeys=expectedItems.map(item=>item.workItemKey),packetWorkKeys=packets.map(packet=>packet.sourceWorkItemKey),packetKeys=packets.map(packet=>packet.reviewPacketKey),duplicatePacketKeys=duplicates(packetKeys),duplicatePacketWorkKeys=duplicates(packetWorkKeys),missingPacketWorkKeys=expectedWorkKeys.filter(key=>!packetWorkKeys.includes(key)),unexpectedPacketWorkKeys=packetWorkKeys.filter(key=>!expectedWorkKeys.includes(key));
  const packetFailures=packets.filter(packet=>packet.packetMaterializationComplete!==true||packet.eligibleForSourceBoundReview!==true||packet.packetContentHash!==contentHash(Object.fromEntries(Object.entries(packet).filter(([key])=>key!=='packetContentHash')))||Object.values(packet.integrityChecks||{}).some(value=>value!==true)||packet.decision!==null||packet.reviewer!==null||packet.reviewedAt!==null||packet.decisionSourceRevisions?.length||packet.candidateMemberIdentityVerdict!==null||packet.canonicalGameEntityIdentity!==null||packet.parentMembershipVerdict!==null||packet.weightedTaskEntryMembershipVerdict!==null||packet.mappingVerdict!==null||packet.inventoryCompletenessVerdict!==null||packet.memberUniverseComplete!==false||packet.automaticVerificationApplied!==false).map(packet=>packet.reviewPacketKey);
  const materializationFailures=records.filter(record=>{const summary=record.structuralMemberCandidateIdentityReviewPacketMaterialization||{},recordPackets=record.structuralMemberCandidateIdentityReviewPackets||[],input=inputs.find(item=>item.memberCandidateKey===record.memberCandidateKey),expectedCount=input?.structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting?.reviewReadyIdentityWorkItemCount||0;return summary.reviewReadyWorkItemCount!==expectedCount||summary.reviewPacketCount!==recordPackets.length||summary.completePacketCount!==recordPackets.length||summary.eligibleForSourceBoundReviewCount!==recordPackets.length||summary.subjectEvidenceCount!==recordPackets.length||summary.parentOccurrenceEvidenceCount!==recordPackets.length||summary.decisionCount!==0||summary.candidateMemberIdentityVerdictCount!==0||summary.canonicalGameEntityIdentityCount!==0||summary.reviewPacketMaterializationComplete!==true||summary.identityReviewComplete!==false||summary.memberUniverseComplete!==false||summary.evidenceWorkComplete!==false||summary.automaticVerificationApplied!==false;}).map(item=>item.memberCandidateKey);
  const unsupportedPromotions=records.filter(record=>record.structuralMemberCandidateIdentityReviewPacketMaterialization?.identityReviewComplete!==false||record.structuralMemberCandidateIdentityReviewPacketMaterialization?.memberUniverseComplete!==false||record.structuralMemberCandidateIdentityReviewPacketMaterialization?.evidenceWorkComplete!==false||record.structuralMemberCandidateIdentityReviewPacketMaterialization?.decisionCount!==0||(record.structuralMemberCandidateIdentityReviewPackets||[]).some(packet=>packet.decision!==null||packet.reviewer!==null||packet.candidateMemberIdentityVerdict!==null||packet.canonicalGameEntityIdentity!==null||packet.parentMembershipVerdict!==null||packet.weightedTaskEntryMembershipVerdict!==null||packet.mappingVerdict!==null||packet.inventoryCompletenessVerdict!==null||packet.memberUniverseComplete!==false||packet.automaticVerificationApplied!==false)||record.memberExpansionReview?.state!=='unreviewed'||record.mechanicsReview?.state!=='unreviewed'||record.optimizerEligible!==false).map(item=>item.memberCandidateKey);
  const accountFindings=accountStateFindings(records),blockers=[];
  if(!compiled.valid)blockers.push('identity_review_packet_materialization_policy_invalid_or_page_specific');
  if(routingRecords.length!==inputs.length||duplicateInputKeys.length)blockers.push('input_routing_record_set_not_exactly_eligible_and_unique');
  if(duplicateOutputKeys.length||missingOutputKeys.length||unexpectedOutputKeys.length)blockers.push('input_output_review_packet_record_set_mismatch');
  if(sourceFailures.length)blockers.push('one_or_more_exact_revision_sources_failed_revalidation');
  if(duplicatePacketKeys.length||duplicatePacketWorkKeys.length||missingPacketWorkKeys.length||unexpectedPacketWorkKeys.length)blockers.push('review_work_item_and_packet_sets_do_not_match_exactly');
  if(packetFailures.length||materializationFailures.length)blockers.push('one_or_more_source_bound_identity_review_packets_invalid_or_incomplete');
  if(recordMismatches.length)blockers.push('one_or_more_review_packet_records_do_not_match_generic_policy');
  if(upstreamMismatches.length)blockers.push('upstream_routes_evidence_dispositions_or_hashes_changed');
  if(unsupportedPromotions.length)blockers.push('packet_generation_created_unsupported_review_identity_membership_completeness_mechanics_or_optimizer_promotion');
  if(accountFindings.length)blockers.push('current_account_state_present');
  const publishable=compiled.valid&&routingRecords.length===inputs.length&&!duplicateInputKeys.length&&!duplicateOutputKeys.length&&!missingOutputKeys.length&&!unexpectedOutputKeys.length&&!sourceFailures.length&&!duplicatePacketKeys.length&&!duplicatePacketWorkKeys.length&&!missingPacketWorkKeys.length&&!unexpectedPacketWorkKeys.length&&!packetFailures.length&&!materializationFailures.length&&!recordMismatches.length&&!upstreamMismatches.length&&!unsupportedPromotions.length&&!accountFindings.length;
  return {contract:policy.auditContract,inputCoverage:{inputRoutingRecordCount:routingRecords.length,eligibleRoutingRecordCount:inputs.length,packetRecordCount:records.length,duplicateInputKeys,duplicateOutputKeys,missingOutputKeys,unexpectedOutputKeys},policyCoverage:compiled,sourceIntegrityCoverage:{sourceCount:sources.length,completeSourceCount:sources.length-sourceFailures.length,failedSourceCount:sourceFailures.length,failedSourceKeys:sourceFailures},reviewPacketCoverage:{reviewReadyWorkItemCount:expectedItems.length,reviewPacketCount:packets.length,completePacketCount:packets.length-packetFailures.length,eligibleForSourceBoundReviewCount:packets.filter(packet=>packet.eligibleForSourceBoundReview).length,duplicatePacketKeys,duplicatePacketWorkKeys,missingPacketWorkKeys,unexpectedPacketWorkKeys,packetFailures,materializationFailures,decisionCount:packets.filter(packet=>packet.decision!==null).length},reviewEvidenceCoverage:{subjectRootInfoboxEvidenceCount:packets.filter(packet=>packet.subjectEvidence?.rootInfobox).length,parentOccurrenceEvidenceCount:packets.filter(packet=>packet.parentOccurrenceEvidence?.exactSourceText).length,exactCandidateDispositionMatchCount:packets.filter(packet=>packet.integrityChecks?.candidateDispositionExactlyOne&&packet.integrityChecks?.sourceDispositionMatches).length},semanticPreservationCoverage:{recordMismatches,upstreamMismatches,unsupportedPromotions},accountStateFindings:accountFindings,reviewPacketMaterializationComplete:publishable&&packets.length===expectedItems.length,identityReviewComplete:false,evidenceWorkComplete:false,memberExpansionComplete:false,mechanicsReviewComplete:false,optimizerEligibleCount:0,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:unique([...blockers,'source_bound_candidate_identity_review_packets_materialized_decisions_pending','candidate_member_identity_review_not_completed','weighted_parent_task_entry_membership_not_proven','one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven','member_universe_completeness_not_proven','all_repeatability_evidence_domains_remain_unresolved','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']),publishable};
}
export function buildStructuralMemberCandidateIdentityReviewPackets({routingRecords=[],policy={},contentHash=hash}={}){const compiled=compileStructuralMemberCandidateIdentityReviewPacketMaterializationPolicy(policy),records=compiled.valid?selectStructuralMemberCandidateIdentityReviewPacketMaterializationInputs(routingRecords,policy).map(input=>expectedRecord(input,policy,contentHash)):[];return {records,audit:auditStructuralMemberCandidateIdentityReviewPacketMaterialization(records,{routingRecords,policy,contentHash})};}
