import {findSourceSignatureAccountState} from '../ingestion/unlock-linked-page-source-signature-lib.mjs';

const normalize=value=>String(value||'').replaceAll('_',' ').replace(/\s+/g,' ').trim();
const signalKey=value=>normalize(value).toLowerCase();
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>a.localeCompare(b));

function compileSignals(typeMap={},signalKind){
  const signalToType=new Map(),duplicates=[];
  for(const [entityType,signals] of Object.entries(typeMap))for(const signal of signals||[]){
    const key=signalKey(signal);
    if(signalToType.has(key))duplicates.push({signalKind,signal,entityTypes:[signalToType.get(key),entityType]});
    else signalToType.set(key,entityType);
  }
  return {signalToType,duplicates};
}

export function compileUnlockLinkedPageEntityTypePolicy(policy={}){
  const templates=compileSignals(policy.rootTemplateTypes||policy.types||{},'root_template');
  const categories=compileSignals(policy.fallbackDirectCategoryTypes||{},'direct_category');
  return {
    policyId:policy.policy||null,
    recordContract:policy.recordContract||'sensum.unlock-linked-page-entity-type.v1',
    auditContract:policy.auditContract||'sensum.unlock-linked-page-entity-type-audit.v1',
    templateToType:templates.signalToType,
    categoryToType:categories.signalToType,
    duplicateTemplateSignals:templates.duplicates,
    duplicateCategorySignals:categories.duplicates,
    duplicateSignals:[...templates.duplicates,...categories.duplicates],
    activityCandidateTypes:new Set(policy.activityCandidateTypes||[])
  };
}

function expectedEvidence(signature,compiled){
  const templateEvidence=(signature.rootTemplates||[]).flatMap(template=>{
    const key=signalKey(template.template),entityType=compiled.templateToType.get(key);
    return entityType?[{entityType,signalKind:'root_template',signal:template.template,signalKey:key,template:template.template,templateKey:key,line:template.line}]:[];
  });
  if(templateEvidence.length)return templateEvidence;
  return (signature.directCategories||[]).flatMap(category=>{
    const key=signalKey(category.category),entityType=compiled.categoryToType.get(key);
    return entityType?[{entityType,signalKind:'direct_category',signal:category.category,signalKey:key,category:category.category,categoryKey:key,line:category.line}]:[];
  });
}

export function buildUnlockLinkedPageEntityTypes({signatures=[],policy={}}){
  const compiled=compileUnlockLinkedPageEntityTypePolicy(policy),records=signatures.map(signature=>{
    const evidence=expectedEvidence(signature,compiled).map(match=>({...match,policy:compiled.policyId,sourcePageId:signature.sourcePageId,sourceRevision:String(signature.sourceRevision||''),sourceTimestamp:signature.sourceTimestamp||null,sourceUrl:signature.sourceUrl||null,sourceContentHash:signature.sourceContentHash||null})),entityTypes=sorted(unique(evidence.map(row=>row.entityType))),activityPageCandidate=entityTypes.some(type=>compiled.activityCandidateTypes.has(type)),classificationState=!entityTypes.length?'untyped':entityTypes.length===1?'typed':'multi_typed',blockers=[];
    if(!entityTypes.length)blockers.push('no_policy_mapped_source_type_evidence');
    blockers.push('canonical_entity_identity_not_established','canonical_activity_identity_not_established');
    if(activityPageCandidate)blockers.push('activity_page_repeatability_not_proven');
    blockers.push('requirements_variants_xp_timing_and_mechanics_not_proven','optimizer_eligibility_blocked');
    return {contract:compiled.recordContract,targetKey:signature.targetKey,requestedTitle:signature.requestedTitle,requestedFragment:signature.requestedFragment||null,resolvedTitle:signature.resolvedTitle,redirected:Boolean(signature.redirected),referencedBy:signature.referencedBy||{skillKeys:[],statementKeys:[]},entityTypes,entityTypeEvidence:evidence,classificationState,pageTypeClassified:entityTypes.length>0,activityPageCandidate,canonicalEntityIdentity:false,canonicalActivityIdentity:null,repeatabilityEvidence:{state:activityPageCandidate?'unproven':'not_assessed_not_activity_typed',evidence:[]},repeatableTrainingActivity:null,mechanicsEvidence:null,optimizerEligible:false,source:{sourcePageId:signature.sourcePageId,sourceRevision:String(signature.sourceRevision||''),sourceTimestamp:signature.sourceTimestamp||null,sourceUrl:signature.sourceUrl||null,sourceContentHash:signature.sourceContentHash||null},accountIndependent:true,blockers:unique(blockers),state:'blocked'};
  }),audit=auditUnlockLinkedPageEntityTypes(records,{signatures,policy});
  return {records,audit};
}

export function auditUnlockLinkedPageEntityTypes(records=[],{signatures=[],policy={}}={}){
  const compiled=compileUnlockLinkedPageEntityTypePolicy(policy),signatureByKey=new Map(signatures.map(row=>[row.targetKey,row])),expectedKeys=signatures.map(row=>row.targetKey),actualKeys=records.map(row=>row?.targetKey).filter(Boolean),duplicates=unique(actualKeys.filter((value,index)=>actualKeys.indexOf(value)!==index)),missing=expectedKeys.filter(key=>!actualKeys.includes(key)),unexpected=actualKeys.filter(key=>!expectedKeys.includes(key));
  const invalidRecords=records.filter(record=>{
    const signature=signatureByKey.get(record.targetKey);if(!signature)return true;
    const evidence=expectedEvidence(signature,compiled),expectedTypes=sorted(unique(evidence.map(row=>row.entityType))),actualTypes=sorted(record.entityTypes||[]);
    if(record.contract!==compiled.recordContract||JSON.stringify(expectedTypes)!==JSON.stringify(actualTypes)||record.entityTypeEvidence?.length!==evidence.length)return true;
    if(record.source?.sourcePageId!==signature.sourcePageId||record.source?.sourceRevision!==String(signature.sourceRevision||'')||record.source?.sourceContentHash!==signature.sourceContentHash)return true;
    if(record.requestedFragment!==(signature.requestedFragment||null)||record.redirected!==Boolean(signature.redirected)||JSON.stringify(record.referencedBy)!==JSON.stringify(signature.referencedBy||{skillKeys:[],statementKeys:[]}))return true;
    if(record.optimizerEligible!==false||record.canonicalEntityIdentity!==false||record.canonicalActivityIdentity!==null||record.repeatableTrainingActivity!==null)return true;
    return (record.entityTypeEvidence||[]).some(row=>!evidence.some(match=>match.entityType===row.entityType&&match.signalKind===row.signalKind&&match.signalKey===row.signalKey&&match.line===row.line&&row.sourcePageId===signature.sourcePageId&&row.sourceRevision===String(signature.sourceRevision||'')&&row.sourceContentHash===signature.sourceContentHash));
  }).map(row=>row.targetKey),untyped=records.filter(row=>!row.entityTypes?.length).map(row=>row.targetKey),multiTyped=records.filter(row=>row.entityTypes?.length>1).map(row=>row.targetKey),categoryFallback=records.filter(row=>row.entityTypeEvidence?.some(evidence=>evidence.signalKind==='direct_category')),accountState=findSourceSignatureAccountState(records),blockers=[];
  if(compiled.duplicateSignals.length)blockers.push('entity_type_policy_contains_duplicate_signals');
  if(duplicates.length)blockers.push('duplicate_linked_page_entity_type_records');
  if(missing.length)blockers.push('one_or_more_source_signatures_missing_entity_type_record');
  if(unexpected.length)blockers.push('unexpected_linked_page_entity_type_record');
  if(invalidRecords.length)blockers.push('one_or_more_entity_type_records_not_supported_by_exact_source_evidence');
  if(accountState.length)blockers.push('account_query_state_baked_into_entity_type_records');
  if(untyped.length)blockers.push('one_or_more_linked_pages_remain_untyped');
  blockers.push('canonical_entity_and_activity_identities_not_established','repeatability_requirements_variants_and_mechanics_not_proven','independent_complete_activity_universe_not_established');
  const structuralBlockers=['entity_type_policy_contains_duplicate_signals','duplicate_linked_page_entity_type_records','one_or_more_source_signatures_missing_entity_type_record','unexpected_linked_page_entity_type_record','one_or_more_entity_type_records_not_supported_by_exact_source_evidence','account_query_state_baked_into_entity_type_records'],pageTypeRoutingComplete=expectedKeys.length>0&&!structuralBlockers.some(blocker=>blockers.includes(blocker)),typeCounts={};
  for(const record of records)for(const type of record.entityTypes||[])typeCounts[type]=(typeCounts[type]||0)+1;
  return {contract:compiled.auditContract,accountIndependent:accountState.length===0,inputSignatureCoverage:{expectedSignatureCount:expectedKeys.length,classificationRecordCount:actualKeys.length,missingTargetKeys:missing,unexpectedTargetKeys:unexpected,duplicateTargetKeys:duplicates,exactTargetSetMatch:!missing.length&&!unexpected.length&&!duplicates.length},policyCoverage:{policy:compiled.policyId,mappedRootTemplateCount:compiled.templateToType.size,mappedFallbackDirectCategoryCount:compiled.categoryToType.size,duplicateSignals:compiled.duplicateSignals,invalidRecordTargetKeys:invalidRecords,rootTemplateClassifiedCount:records.filter(row=>row.entityTypeEvidence?.some(evidence=>evidence.signalKind==='root_template')).length,categoryFallbackClassifiedCount:categoryFallback.length},entityTypeCoverage:{pageTypeClassifiedCount:records.length-untyped.length,untypedPageCount:untyped.length,untypedTargetKeys:untyped,multiTypedPageCount:multiTyped.length,multiTypedTargetKeys:multiTyped,typeCounts:Object.fromEntries(Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))),activityPageCandidateCount:records.filter(row=>row.activityPageCandidate).length},embeddedAccountQueryState:accountState,pageTypeRoutingComplete,entityTypeClassificationComplete:pageTypeRoutingComplete&&!untyped.length,canonicalEntityIdentityCount:records.filter(row=>row.canonicalEntityIdentity===true).length,canonicalActivityIdentityCount:records.filter(row=>row.canonicalActivityIdentity!==null).length,repeatabilityProvenCount:records.filter(row=>row.repeatableTrainingActivity!==null).length,optimizerEligibleActivityCount:records.filter(row=>row.optimizerEligible===true).length,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:unique(blockers),publishable:pageTypeRoutingComplete};
}
