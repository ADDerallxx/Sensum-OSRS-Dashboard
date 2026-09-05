import { hash } from './lib.mjs';

const CHANNELS = [
  'source_authored_requested_subject_resolution',
  'normalization_and_redirect_chain',
  'stable_wiki_page_id_and_resolved_title',
  'current_observed_revision_timestamp_url_and_content_hash',
  'complete_exact_revision_source_text',
  'pinned_parent_candidate_source_observation_alignment',
  'subject_identity_member_identity_parent_membership_entity_type_and_completeness_verdict_separation'
];
const REQUIRED_RULES = [
  'oneEvidenceRecordPerEligibleRoutingRecord',
  'oneEvidencePacketPerCandidateIdentityWorkItem',
  'everyDistinctRequestedSubjectMustBeSubmittedToTheOfficialWikiApi',
  'normalizationAndRedirectStepsMustBeRetainedWithoutCaseInsensitiveOrFallbackMatching',
  'everyResolvedSubjectMustRetainStablePageIdResolvedTitleCurrentRevisionTimestampUrlHashAndCompleteText',
  'everyPacketMustBindBackToTheExactPinnedParentCandidateObservation',
  'resolvedWikiPageIdentityIsNotAReviewedMemberIdentityOrEntityTypeVerdict',
  'sourceOccurrenceAlignmentIsNotAParentMembershipVerdict',
  'redirectConvergenceAndMatchingCountsCannotProveOneToOneMembershipOrCompleteness',
  'missingAmbiguousCyclicNonMainspaceOrIncompleteRevisionEvidenceRemainsBlocked',
  'parentMappingAndCompleteUniverseWorkItemsMustRemainSeparateAndUnchanged',
  'inputEvidenceRevisionsStructuresDispositionsAndRoutingMustBePreserved',
  'namesTitlesPageIdsCandidateKeysLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'memberRepeatabilityMechanicsAndOptimizerPromotionAreForbidden',
  'currentAccountStateIsForbidden'
];
const COMPLETENESS_BRANCHES = [
  'declared_total_one_to_one_member_mapping_evidence',
  'complete_member_universe_reconciliation_evidence'
];
const STAGE_FIELDS = new Set([
  'contract','contentHash','blockers','state',
  'sourceParentMemberCandidateIdentityAndCompletenessEvidenceWorkRoutingContentHash',
  'structuralMemberCandidateIdentityEvidenceSources',
  'structuralMemberCandidateIdentityEvidence',
  'structuralMemberCandidateIdentityEvidenceReview'
]);
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value,index) => values.indexOf(value) !== index));
const sorted = values => [...values].sort((a,b) => String(a).localeCompare(String(b)));
const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !STAGE_FIELDS.has(key)));
const sourceContent = revision => revision?.slots?.main?.content;
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;

function forbiddenPolicyPaths(policy={}) {
  const findings=[];
  const forbidden=/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|title|titles|label|labels|alias|aliases|override|overrides)$/i;
  const walk=(value,at='')=>{if(Array.isArray(value))return value.forEach((child,index)=>walk(child,`${at}[${index}]`));if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){const next=at?`${at}.${key}`:key;if(forbidden.test(key))findings.push(next);walk(child,next)}};
  walk(policy);
  return sorted(unique(findings));
}

export function compileStructuralMemberCandidateIdentityEvidencePolicy(policy={}) {
  const invalidRules=REQUIRED_RULES.filter(rule=>policy.rules?.[rule]!==true);
  if(policy.rules?.automaticVerificationAllowed!==false)invalidRules.push('automaticVerificationAllowed');
  const contractValid=policy.inputContract==='sensum.parent-member-candidate-identity-and-completeness-evidence-work-routing.v1'
    && policy.recordContract==='sensum.structural-member-candidate-identity-evidence.v1'
    && policy.auditContract==='sensum.structural-member-candidate-identity-evidence-audit.v1'
    && policy.inputState==='parent_member_candidate_identity_and_completeness_evidence_work_routed_gates_closed'
    && policy.inputRouteState==='routed_blocked_candidate_identity_and_parent_completeness_evidence_work_not_completed'
    && policy.inputBranchKey==='stable_structural_member_candidate_identity_evidence'
    && policy.inputWorkKind==='revision_pinned_candidate_subject_identity_and_parent_relation_evidence';
  const invalidChannels=JSON.stringify(policy.requiredCaptureChannels||[])===JSON.stringify(CHANNELS)?[]:['requiredCaptureChannels'];
  const source=policy.sourceResolution||{};
  const invalidSourceResolution=source.namespace===0&&Number.isInteger(source.batchSize)&&source.batchSize>=1&&source.batchSize<=50&&source.followRedirects===true&&source.retainNormalizationChain===true&&source.retainRedirectChain===true&&source.retainCompleteCurrentRevisionSourceText===true&&source.requireStablePageIdentity===true?[]:['sourceResolution'];
  const forbidden=forbiddenPolicyPaths(policy);
  const valid=contractValid&&!invalidRules.length&&!invalidChannels.length&&!invalidSourceResolution.length&&!forbidden.length;
  return {valid,contractValid,invalidRules,invalidChannels,invalidSourceResolution,forbiddenPolicyPaths:forbidden};
}

function routeItemMatchesCandidate(item,candidate,policy){
  return item?.branchKey===policy.inputBranchKey
    && item?.workKind===policy.inputWorkKind
    && item?.structuralCandidateKey===candidate?.candidateKey
    && item?.candidateRole===candidate?.candidateRole
    && hash(item?.sourceAuthoredSubjectObservation)===hash(candidate?.subjectObservation)
    && hash(item?.sourceCandidateEvidence)===hash(candidate?.sourceEvidence)
    && typeof item?.sourceAuthoredSubjectObservation?.requestedTitle==='string'
    && item.sourceAuthoredSubjectObservation.requestedTitle.length>0
    && item.expectedEntityKind===null
    && item.evidenceKeys?.length===0
    && item.identityVerdict===null
    && item.parentMembershipVerdict===null
    && item.evidenceWorkComplete===false
    && item.automaticVerificationApplied===false
    && String(item.workState||'').startsWith('blocked_');
}

function selectorMatches(record,policy){
  const route=record.parentMemberCandidateIdentityAndCompletenessEvidenceWorkRouting||{};
  const disposition=record.parentMemberInventoryDisposition||{};
  const candidates=disposition.memberCandidates||[];
  const identityItems=route.candidateIdentityWorkItems||[];
  const completenessItems=route.completenessWorkItems||[];
  return record.contract===policy.inputContract&&record.state===policy.inputState&&record.accountIndependent===true
    && route.routeState===policy.inputRouteState&&route.candidateIdentityBranchKey===policy.inputBranchKey
    && route.candidateIdentityWorkItemCount===identityItems.length&&identityItems.length===candidates.length&&candidates.length===disposition.structuralCandidateCount
    && new Set(identityItems.map(item=>item.structuralCandidateKey)).size===identityItems.length
    && identityItems.every((item,index)=>routeItemMatchesCandidate(item,candidates[index],policy))
    && route.completenessWorkItemCount===2&&completenessItems.length===2
    && COMPLETENESS_BRANCHES.every((branch,index)=>completenessItems[index]?.branchKey===branch)
    && completenessItems.every(item=>item.evidenceKeys?.length===0&&item.mappingVerdict===null&&item.inventoryCompletenessVerdict===null&&item.memberUniverseComplete===false&&item.evidenceWorkComplete===false&&item.automaticVerificationApplied===false&&String(item.workState||'').startsWith('blocked_'))
    && route.totalWorkItemCount===identityItems.length+2&&route.evidenceKeyCount===0&&route.completedWorkItemCount===0&&route.identityVerdictCount===0&&route.parentMembershipVerdictCount===0&&route.inventoryCompletenessVerdictCount===0&&route.memberUniverseComplete===false&&route.evidenceWorkComplete===false&&route.automaticVerificationApplied===false
    && route.candidateIdentityAndParentCompletenessBranchesSeparated===true&&route.oneToOneMappingAndCompleteUniverseReconciliationSeparated===true
    && disposition.memberUniverseComplete===false&&disposition.memberIdentityVerdict===null&&disposition.inventoryCompletenessVerdict===null&&disposition.reviewedMemberIdentityCount===0
    && record.parentMemberInventoryDispositionReview?.state==='reviewed_generic_fail_closed_parent_member_inventory_disposition'
    && record.parentMemberInventoryDispositionReview?.memberIdentityVerdict===null&&record.parentMemberInventoryDispositionReview?.inventoryCompletenessVerdict===null
    && record.memberExpansionReview?.state==='unreviewed'&&record.mechanicsReview?.state==='unreviewed'&&record.optimizerEligible===false;
}

export function selectStructuralMemberCandidateIdentityEvidenceInputs(records=[],policy={}){
  return records.filter(record=>selectorMatches(record,policy));
}

export function discoverStructuralMemberCandidateIdentityRequests(records=[],policy={}){
  const requests=new Map();
  for(const record of selectStructuralMemberCandidateIdentityEvidenceInputs(records,policy)){
    for(const item of record.parentMemberCandidateIdentityAndCompletenessEvidenceWorkRouting.candidateIdentityWorkItems){
      const requestedSubject=item.sourceAuthoredSubjectObservation.requestedTitle;
      const request=requests.get(requestedSubject)||{requestedSubject,contexts:[]};
      request.contexts.push({memberCandidateKey:record.memberCandidateKey,workItemKey:item.workItemKey,structuralCandidateKey:item.structuralCandidateKey,candidateRole:item.candidateRole,parentSourcePageId:item.sourceCandidateEvidence.sourcePageId,parentSourceRevision:String(item.sourceCandidateEvidence.sourceRevision)});
      request.contexts.sort((a,b)=>a.workItemKey.localeCompare(b.workItemKey));
      requests.set(requestedSubject,request);
    }
  }
  return [...requests.values()].sort((a,b)=>a.requestedSubject.localeCompare(b.requestedSubject));
}

function mappingIndex(rows=[]){
  const map=new Map(),duplicateFrom=[];
  for(const row of rows||[]){if(!row||typeof row.from!=='string'||typeof row.to!=='string')continue;if(map.has(row.from))duplicateFrom.push(row.from);else map.set(row.from,row.to)}
  return {map,duplicateFrom:unique(duplicateFrom)};
}

function resolutionFor(requestedSubject,resolutionBatches=[]){
  const containing=resolutionBatches.filter(batch=>(batch.requestedSubjects||[]).includes(requestedSubject));
  if(containing.length!==1)return {attempted:false,requestedSubject,normalizedSubject:requestedSubject,resolvedSubject:null,normalizationChain:[],redirectChain:[],page:null,resolutionIssues:[containing.length?'duplicate_resolution_attempt':'missing_resolution_attempt']};
  const query=containing[0].response?.query||{};
  const normalized=mappingIndex(query.normalized),redirects=mappingIndex(query.redirects),issues=[];
  if(normalized.duplicateFrom.length)issues.push('ambiguous_normalization_mapping');
  if(redirects.duplicateFrom.length)issues.push('ambiguous_redirect_mapping');
  const normalizationChain=[],redirectChain=[],seen=new Set([requestedSubject]);
  let current=requestedSubject;
  for(let guard=0;guard<20;guard++){
    const next=normalized.map.get(current);
    if(!next||next===current)break;
    normalizationChain.push({from:current,to:next});
    if(seen.has(next)){issues.push('normalization_or_redirect_cycle');current=next;break}
    seen.add(next);current=next;
  }
  const normalizedSubject=current;
  for(let guard=0;guard<20;guard++){
    const next=redirects.map.get(current);
    if(!next||next===current)break;
    redirectChain.push({from:current,to:next});
    if(seen.has(next)){issues.push('normalization_or_redirect_cycle');current=next;break}
    seen.add(next);current=next;
    const normalizedRedirect=normalized.map.get(current);
    if(normalizedRedirect&&normalizedRedirect!==current){normalizationChain.push({from:current,to:normalizedRedirect});if(seen.has(normalizedRedirect)){issues.push('normalization_or_redirect_cycle');current=normalizedRedirect;break}seen.add(normalizedRedirect);current=normalizedRedirect}
  }
  if(normalizationChain.length>=20||redirectChain.length>=20)issues.push('normalization_or_redirect_chain_limit_exceeded');
  const matchingPages=(query.pages||[]).filter(page=>page?.title===current);
  if(matchingPages.length!==1)issues.push(matchingPages.length?'ambiguous_resolved_page':'resolved_page_missing_from_response');
  const page=matchingPages.length===1?matchingPages[0]:null;
  return {attempted:true,requestedSubject,normalizedSubject,resolvedSubject:page?.title||current,normalizationChain,redirectChain,page,resolutionIssues:unique(issues)};
}

function exactParentOccurrenceAligned(input,item,candidate){
  const source=item.sourceCandidateEvidence||{};
  const matchingParentSources=(input.parentMemberInventoryEvidenceSources||[]).filter(packet=>{
    const identity=packet.sourcePageIdentity||{};
    return Number(identity.sourcePageId)===Number(source.sourcePageId)&&String(identity.sourceRevision||'')===String(source.sourceRevision||'')&&identity.sourceContentHash===source.sourceContentHash;
  });
  const sourceText=matchingParentSources[0]?.exactRevisionSourceText;
  const start=Number(source.sourceLocator?.lineStart||0),end=Number(source.sourceLocator?.lineEnd||0);
  const selectedLines=typeof sourceText==='string'&&start>0&&end>=start?sourceText.split(/\r?\n/).slice(start-1,end).join('\n'):null;
  return {
    candidatePresent:Boolean(candidate),
    structuralCandidateKeyMatches:Boolean(candidate&&candidate.candidateKey===item.structuralCandidateKey),
    candidateRoleMatches:Boolean(candidate&&candidate.candidateRole===item.candidateRole),
    sourceAuthoredSubjectObservationMatches:Boolean(candidate&&hash(candidate.subjectObservation)===hash(item.sourceAuthoredSubjectObservation)),
    sourceCandidateEvidenceMatches:Boolean(candidate&&hash(candidate.sourceEvidence)===hash(item.sourceCandidateEvidence)),
    parentRevisionPinnedSourcePacketMatches:matchingParentSources.length===1,
    exactSourceTextHashMatches:Boolean(source.exactSourceText&&hash(source.exactSourceText)===source.exactSourceTextContentHash),
    exactSourceTextOccursAtPinnedParentLocator:Boolean(selectedLines!==null&&selectedLines.includes(source.exactSourceText||''))
  };
}

function packetFor(input,item,resolutionBatches,policy,contentHash){
  const candidate=(input.parentMemberInventoryDisposition?.memberCandidates||[]).find(entry=>entry.candidateKey===item.structuralCandidateKey);
  const resolution=resolutionFor(item.sourceAuthoredSubjectObservation.requestedTitle,resolutionBatches);
  const page=resolution.page,revision=page?.revisions?.[0],content=sourceContent(revision);
  const pageMissing=Boolean(page&&Object.hasOwn(page,'missing'));
  const alignment=exactParentOccurrenceAligned(input,item,candidate);
  const capture={
    source_authored_requested_subject_resolution:resolution.attempted&&resolution.requestedSubject===item.sourceAuthoredSubjectObservation.requestedTitle&&!resolution.resolutionIssues.length,
    normalization_and_redirect_chain:resolution.attempted&&!resolution.resolutionIssues.some(issue=>issue.includes('mapping')||issue.includes('cycle')||issue.includes('chain_limit')),
    stable_wiki_page_id_and_resolved_title:Boolean(page&&!pageMissing&&Number(page.pageid)>0&&typeof page.title==='string'&&page.title.length>0&&Number(page.ns)===policy.sourceResolution.namespace),
    current_observed_revision_timestamp_url_and_content_hash:Boolean(revision?.revid&&revision?.timestamp&&typeof content==='string'),
    complete_exact_revision_source_text:typeof content==='string'&&content.length>0,
    pinned_parent_candidate_source_observation_alignment:Object.values(alignment).every(Boolean),
    subject_identity_member_identity_parent_membership_entity_type_and_completeness_verdict_separation:true
  };
  const deficiencies=[];
  if(!resolution.attempted)deficiencies.push('official_wiki_subject_resolution_not_attempted_exactly_once');
  deficiencies.push(...resolution.resolutionIssues);
  if(pageMissing)deficiencies.push('requested_subject_wiki_page_missing');
  if(page&&!pageMissing&&Number(page.ns)!==policy.sourceResolution.namespace)deficiencies.push('resolved_subject_not_in_required_namespace');
  if(!capture.stable_wiki_page_id_and_resolved_title&&!pageMissing)deficiencies.push('stable_wiki_subject_page_identity_incomplete');
  if(!capture.current_observed_revision_timestamp_url_and_content_hash||!capture.complete_exact_revision_source_text)deficiencies.push('current_observed_revision_provenance_or_complete_source_text_incomplete');
  if(!capture.pinned_parent_candidate_source_observation_alignment)deficiencies.push('pinned_parent_candidate_source_observation_alignment_failed');
  const complete=CHANNELS.every(channel=>capture[channel]===true);
  const sourceEvidenceKey=complete?`${item.structuralCandidateKey}|wiki-pageid:${page.pageid}|revision:${revision.revid}:candidate-subject-identity-source`:null;
  return {
    packetKey:`${item.workItemKey}|candidate-subject-identity-evidence-packet`,
    workItemKey:item.workItemKey,
    structuralCandidateKey:item.structuralCandidateKey,
    candidateRole:item.candidateRole,
    sourceAuthoredSubjectObservation:item.sourceAuthoredSubjectObservation,
    sourceCandidateEvidence:item.sourceCandidateEvidence,
    sourceRequestResolution:{requestedSubject:resolution.requestedSubject,normalizedSubject:resolution.normalizedSubject,resolvedSubject:resolution.resolvedSubject,normalizationChain:resolution.normalizationChain,redirectChain:resolution.redirectChain,normalized:resolution.normalizationChain.length>0,redirected:resolution.redirectChain.length>0,pageMissing,resolvedNamespace:page?.ns??null,resolutionIssues:resolution.resolutionIssues},
    sourcePageIdentity:{sourcePageId:page&&!pageMissing&&page.pageid?Number(page.pageid):null,resolvedTitle:page&&!pageMissing?page.title:null,sourceRevision:revision?.revid?String(revision.revid):null,sourceTimestamp:revision?.timestamp||null,sourceUrl:page&&!pageMissing?wikiUrl(page.title):null,sourceContentHash:typeof content==='string'?contentHash(content):null,sourceContentBytes:typeof content==='string'?Buffer.byteLength(content,'utf8'):0},
    exactRevisionSourceText:typeof content==='string'?content:null,
    parentCandidateSourceAlignment:alignment,
    captureChannels:CHANNELS.map(channelKey=>({channelKey,complete:capture[channelKey]===true})),
    sourceEvidenceKey,
    stableSubjectIdentityEvidenceState:complete?'resolved_revision_pinned_wiki_subject_page_identity':'blocked_incomplete_wiki_subject_page_identity_evidence',
    candidateMemberIdentityVerdict:null,
    parentMembershipVerdict:null,
    entityTypeVerdict:null,
    inventoryCompletenessVerdict:null,
    memberUniverseComplete:false,
    evidencePacketComplete:complete,
    evidenceWorkComplete:false,
    automaticVerificationApplied:false,
    deficiencies:unique(deficiencies),
    state:complete?'complete_revision_pinned_candidate_subject_identity_observation_not_parent_membership_verdict':'blocked_incomplete_candidate_subject_identity_observation'
  };
}

function expectedRecord(input,resolutionBatches,policy,contentHash){
  const route=input.parentMemberCandidateIdentityAndCompletenessEvidenceWorkRouting;
  const packets=route.candidateIdentityWorkItems.map(item=>packetFor(input,item,resolutionBatches,policy,contentHash));
  const completePackets=packets.filter(packet=>packet.evidencePacketComplete);
  const allComplete=completePackets.length===packets.length&&packets.length===route.candidateIdentityWorkItemCount;
  const {contentHash:inputHash,blockers:inputBlockers=[],...rest}=input;
  const resolvedPageIds=completePackets.map(packet=>packet.sourcePageIdentity.sourcePageId);
  const retainedBlockers=inputBlockers.filter(blocker=>!(allComplete&&['candidate_identity_and_parent_completeness_evidence_work_routed_not_completed','structural_member_candidates_require_stable_identity_evidence'].includes(blocker)));
  return {
    contract:policy.recordContract,
    ...preservedInput(rest),
    sourceParentMemberCandidateIdentityAndCompletenessEvidenceWorkRoutingContentHash:inputHash,
    structuralMemberCandidateIdentityEvidenceSources:packets,
    structuralMemberCandidateIdentityEvidence:{
      evidenceState:allComplete?'complete_revision_pinned_candidate_subject_page_identity_evidence_requires_semantic_disposition':'partial_or_blocked_candidate_subject_page_identity_evidence',
      structuralCandidateCount:route.candidateIdentityWorkItemCount,
      identityEvidencePacketCount:packets.length,
      completeRevisionPinnedSubjectIdentityPacketCount:completePackets.length,
      incompleteSubjectIdentityPacketCount:packets.length-completePackets.length,
      distinctRequestedSubjectCount:new Set(packets.map(packet=>packet.sourceRequestResolution.requestedSubject)).size,
      uniqueResolvedPageIdCount:new Set(resolvedPageIds).size,
      normalizedSubjectCount:packets.filter(packet=>packet.sourceRequestResolution.normalized).length,
      redirectedSubjectCount:packets.filter(packet=>packet.sourceRequestResolution.redirected).length,
      sourceEvidenceKeys:completePackets.map(packet=>packet.sourceEvidenceKey),
      stableSourcePageIdentityEvidenceComplete:allComplete,
      candidateMemberIdentityVerdict:null,
      parentMembershipVerdict:null,
      entityTypeVerdict:null,
      inventoryCompletenessVerdict:null,
      memberUniverseComplete:false,
      automaticVerificationApplied:false
    },
    structuralMemberCandidateIdentityEvidenceReview:{
      state:'unreviewed_candidate_member_identity_entity_type_and_parent_relation_semantic_disposition_required',
      stableSourcePageIdentityEvidenceComplete:allComplete,
      candidateMemberIdentityVerdict:null,
      parentMembershipVerdict:null,
      entityTypeVerdict:null,
      inventoryCompletenessVerdict:null,
      memberUniverseComplete:false,
      evidenceWorkComplete:false,
      automaticVerificationApplied:false,
      evidenceKeys:completePackets.map(packet=>packet.sourceEvidenceKey)
    },
    accountIndependent:true,
    blockers:unique([
      ...retainedBlockers,
      ...(allComplete?['revision_pinned_candidate_subject_page_identities_require_semantic_member_entity_type_and_parent_relation_disposition']:['one_or_more_candidate_subject_page_identity_evidence_packets_incomplete']),
      'resolved_subject_page_identity_does_not_prove_parent_membership',
      'source_inventory_non_exhaustive_qualification_prevents_completeness',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state:allComplete?'structural_member_candidate_identity_evidence_ready_for_semantic_disposition_gates_closed':'structural_member_candidate_identity_evidence_incomplete_gates_closed'
  };
}

function accountStateFindings(records){
  const forbidden=/^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i,findings=[];
  const walk=(value,at='')=>{if(Array.isArray(value))return value.forEach((child,index)=>walk(child,`${at}[${index}]`));if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){const next=at?`${at}.${key}`:key;if(forbidden.test(key))findings.push(next);walk(child,next)}};
  records.forEach((record,index)=>walk(record,`[${index}]`));return findings;
}

function requestCoverage(inputs,resolutionBatches,policy){
  const expected=discoverStructuralMemberCandidateIdentityRequests(inputs,policy).map(request=>request.requestedSubject);
  const submitted=resolutionBatches.flatMap(batch=>batch.requestedSubjects||[]);
  const duplicateSubmittedSubjects=duplicates(submitted),missingSubmittedSubjects=expected.filter(subject=>!submitted.includes(subject)),unexpectedSubmittedSubjects=submitted.filter(subject=>!expected.includes(subject));
  const invalidBatches=resolutionBatches.flatMap((batch,index)=>{
    const findings=[];
    if(!Array.isArray(batch.requestedSubjects)||!batch.requestedSubjects.length||batch.requestedSubjects.length>policy.sourceResolution.batchSize) findings.push(`batch_${index+1}_requested_subject_set_invalid`);
    if(!batch.response||!batch.response.query||!Array.isArray(batch.response.query.pages)) findings.push(`batch_${index+1}_wiki_query_response_invalid`);
    return findings;
  });
  return {candidateIdentityWorkItemCount:inputs.reduce((sum,input)=>sum+input.parentMemberCandidateIdentityAndCompletenessEvidenceWorkRouting.candidateIdentityWorkItemCount,0),distinctRequestedSubjectCount:expected.length,submittedSubjectCount:submitted.length,resolutionBatchCount:resolutionBatches.length,duplicateSubmittedSubjects,missingSubmittedSubjects,unexpectedSubmittedSubjects,invalidBatches,resolutionAttemptCoverageComplete:expected.length>0&&!duplicateSubmittedSubjects.length&&!missingSubmittedSubjects.length&&!unexpectedSubmittedSubjects.length&&!invalidBatches.length};
}

export function auditStructuralMemberCandidateIdentityEvidence(records=[],{routingRecords=[],resolutionBatches=[],policy={},contentHash=hash}={}){
  const compiled=compileStructuralMemberCandidateIdentityEvidencePolicy(policy);
  const inputs=selectStructuralMemberCandidateIdentityEvidenceInputs(routingRecords,policy);
  const expected=compiled.valid?inputs.map(input=>expectedRecord(input,resolutionBatches,policy,contentHash)):[];
  const coverage=requestCoverage(inputs,resolutionBatches,policy);
  const inputKeys=inputs.map(item=>item.memberCandidateKey),outputKeys=records.map(item=>item.memberCandidateKey);
  const duplicateInputKeys=duplicates(inputKeys),duplicateOutputKeys=duplicates(outputKeys),missingOutputKeys=inputKeys.filter(key=>!outputKeys.includes(key)),unexpectedOutputKeys=outputKeys.filter(key=>!inputKeys.includes(key));
  const recordMismatches=records.filter(record=>{const match=expected.find(item=>item.memberCandidateKey===record.memberCandidateKey);return !match||hash(record)!==hash(match)}).map(item=>item.memberCandidateKey);
  const upstreamMismatches=records.filter(record=>{const input=inputs.find(item=>item.memberCandidateKey===record.memberCandidateKey);return !input||hash(preservedInput(record))!==hash(preservedInput(input))}).map(item=>item.memberCandidateKey);
  const packets=records.flatMap(record=>record.structuralMemberCandidateIdentityEvidenceSources||[]);
  const expectedWorkItemKeys=inputs.flatMap(input=>input.parentMemberCandidateIdentityAndCompletenessEvidenceWorkRouting.candidateIdentityWorkItems.map(item=>item.workItemKey));
  const packetWorkItemKeys=packets.map(packet=>packet.workItemKey);
  const duplicatePacketWorkItemKeys=duplicates(packetWorkItemKeys),missingPacketWorkItemKeys=expectedWorkItemKeys.filter(key=>!packetWorkItemKeys.includes(key)),unexpectedPacketWorkItemKeys=packetWorkItemKeys.filter(key=>!expectedWorkItemKeys.includes(key));
  const completePackets=packets.filter(packet=>packet.evidencePacketComplete===true&&packet.state==='complete_revision_pinned_candidate_subject_identity_observation_not_parent_membership_verdict');
  const parentAlignmentFailures=packets.filter(packet=>!Object.values(packet.parentCandidateSourceAlignment||{}).every(Boolean)).map(packet=>packet.workItemKey);
  const unsupportedPromotions=records.filter(record=>{
    const summary=record.structuralMemberCandidateIdentityEvidence||{},review=record.structuralMemberCandidateIdentityEvidenceReview||{};
    return summary.candidateMemberIdentityVerdict!==null||summary.parentMembershipVerdict!==null||summary.entityTypeVerdict!==null||summary.inventoryCompletenessVerdict!==null||summary.memberUniverseComplete!==false||summary.automaticVerificationApplied!==false
      ||review.candidateMemberIdentityVerdict!==null||review.parentMembershipVerdict!==null||review.entityTypeVerdict!==null||review.inventoryCompletenessVerdict!==null||review.memberUniverseComplete!==false||review.evidenceWorkComplete!==false||review.automaticVerificationApplied!==false
      ||(record.structuralMemberCandidateIdentityEvidenceSources||[]).some(packet=>packet.candidateMemberIdentityVerdict!==null||packet.parentMembershipVerdict!==null||packet.entityTypeVerdict!==null||packet.inventoryCompletenessVerdict!==null||packet.memberUniverseComplete!==false||packet.evidenceWorkComplete!==false||packet.automaticVerificationApplied!==false)
      ||record.parentMemberInventoryDisposition?.memberUniverseComplete!==false||record.parentMemberInventoryDisposition?.memberIdentityVerdict!==null||record.parentMemberInventoryDisposition?.inventoryCompletenessVerdict!==null
      ||record.memberExpansionReview?.state!=='unreviewed'||record.mechanicsReview?.state!=='unreviewed'||record.optimizerEligible!==false;
  }).map(item=>item.memberCandidateKey);
  const accountFindings=accountStateFindings(records),blockers=[];
  if(!compiled.valid)blockers.push('structural_member_candidate_identity_evidence_policy_invalid_or_activity_specific');
  if(routingRecords.length!==inputs.length||duplicateInputKeys.length)blockers.push('input_candidate_identity_routing_set_not_exactly_eligible_and_unique');
  if(duplicateOutputKeys.length||missingOutputKeys.length||unexpectedOutputKeys.length)blockers.push('input_output_candidate_identity_evidence_record_set_mismatch');
  if(!coverage.resolutionAttemptCoverageComplete)blockers.push('official_wiki_requested_subject_resolution_attempt_set_incomplete_or_mismatched');
  if(duplicatePacketWorkItemKeys.length||missingPacketWorkItemKeys.length||unexpectedPacketWorkItemKeys.length)blockers.push('candidate_identity_evidence_packet_set_incomplete_or_mismatched');
  if(recordMismatches.length)blockers.push('one_or_more_candidate_identity_evidence_records_do_not_match_exact_source_resolutions');
  if(upstreamMismatches.length)blockers.push('input_evidence_revisions_structures_dispositions_or_routing_changed');
  if(unsupportedPromotions.length)blockers.push('candidate_subject_identity_evidence_created_unsupported_member_entity_type_membership_completeness_repeatability_mechanics_or_optimizer_promotion');
  if(accountFindings.length)blockers.push('current_account_state_present');
  const publishable=compiled.valid&&routingRecords.length===inputs.length&&!duplicateInputKeys.length&&!duplicateOutputKeys.length&&!missingOutputKeys.length&&!unexpectedOutputKeys.length&&coverage.resolutionAttemptCoverageComplete&&!duplicatePacketWorkItemKeys.length&&!missingPacketWorkItemKeys.length&&!unexpectedPacketWorkItemKeys.length&&!recordMismatches.length&&!upstreamMismatches.length&&!unsupportedPromotions.length&&!accountFindings.length;
  const packetCoverageComplete=publishable&&packets.length===expectedWorkItemKeys.length&&completePackets.length===packets.length&&!parentAlignmentFailures.length;
  return {
    contract:policy.auditContract,
    inputCoverage:{inputRoutingRecordCount:routingRecords.length,eligibleRoutingRecordCount:inputs.length,identityEvidenceRecordCount:records.length,duplicateInputKeys,duplicateOutputKeys,missingOutputKeys,unexpectedOutputKeys},
    policyCoverage:compiled,
    requestCoverage:coverage,
    resolutionCoverage:{identityEvidencePacketCount:packets.length,completeRevisionPinnedSubjectIdentityPacketCount:completePackets.length,incompleteSubjectIdentityPacketCount:packets.length-completePackets.length,normalizedPacketCount:packets.filter(packet=>packet.sourceRequestResolution?.normalized).length,redirectedPacketCount:packets.filter(packet=>packet.sourceRequestResolution?.redirected).length,missingWikiPagePacketCount:packets.filter(packet=>packet.sourceRequestResolution?.pageMissing).length,resolutionIssuePacketCount:packets.filter(packet=>packet.sourceRequestResolution?.resolutionIssues?.length).length,uniqueResolvedPageIdCount:new Set(completePackets.map(packet=>packet.sourcePageIdentity.sourcePageId)).size,duplicatePacketWorkItemKeys,missingPacketWorkItemKeys,unexpectedPacketWorkItemKeys},
    parentCandidateAlignmentCoverage:{alignedPacketCount:packets.length-parentAlignmentFailures.length,misalignedPacketCount:parentAlignmentFailures.length,misalignedWorkItemKeys:parentAlignmentFailures},
    semanticPreservationCoverage:{recordMismatches,upstreamMismatches,unsupportedPromotions},
    accountStateFindings:accountFindings,
    evidencePacketAttemptCoverageComplete:publishable,
    candidateSubjectIdentityEvidencePacketCoverageComplete:packetCoverageComplete,
    memberIdentityReviewComplete:false,
    memberExpansionComplete:false,
    mechanicsReviewComplete:false,
    optimizerEligibleCount:0,
    completeActivityUniverse:false,
    absoluteBestGate:'blocked_incomplete_activity_universe',
    blockers:unique([
      ...blockers,
      ...(packetCoverageComplete?['revision_pinned_candidate_subject_page_identities_require_semantic_member_entity_type_and_parent_relation_disposition']:['one_or_more_candidate_subject_page_identity_evidence_packets_incomplete']),
      'resolved_subject_page_identity_does_not_prove_parent_membership',
      'source_inventory_non_exhaustive_qualification_prevents_completeness',
      'one_to_one_mapping_between_structural_candidates_and_declared_total_not_proven',
      'member_universe_completeness_not_proven',
      'all_repeatability_evidence_domains_remain_unresolved',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildStructuralMemberCandidateIdentityEvidence({routingRecords=[],resolutionBatches=[],policy={},contentHash=hash}){
  const compiled=compileStructuralMemberCandidateIdentityEvidencePolicy(policy);
  const records=compiled.valid?selectStructuralMemberCandidateIdentityEvidenceInputs(routingRecords,policy).map(input=>expectedRecord(input,resolutionBatches,policy,contentHash)):[];
  return {records,audit:auditStructuralMemberCandidateIdentityEvidence(records,{routingRecords,resolutionBatches,policy,contentHash})};
}
