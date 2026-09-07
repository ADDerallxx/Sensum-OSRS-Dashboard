import fs from 'node:fs';
import {hash,json} from '../ingestion/lib.mjs';
import {compileCrossSkillUntypedPageEvidencePolicy} from '../ingestion/cross-skill-untyped-page-source-evidence-lib.mjs';
import {classifyAcceptedEvidenceAccountIndependence} from './account-independence-classification-lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {
  buildCandidateEvidenceExistingSourceCountQuery,
  buildCandidateEvidenceMaterializationSql,
  buildCandidateEvidenceReconciliationQuery,
  verifyCandidateEvidenceReconciliation
} from './candidate-evidence-materialization-lib.mjs';

export const CROSS_SKILL_UNTYPED_PAGE_SOURCE_MATERIALIZATION_CONTRACT='sensum.cross-skill-untyped-page-source-evidence-postgresql-materialization.v1';
export const CROSS_SKILL_UNTYPED_PAGE_SOURCE_INPUT_DOMAIN='cross-skill-untyped-page-source-evidence';
export const CROSS_SKILL_UNTYPED_PAGE_SOURCE_FACT_KIND='raw_cross_skill_untyped_page_source_evidence';

const POLICY_ID='sensum.cross-skill-untyped-page-source-evidence-policy.v1';
const POLICY_FILE='platform/policies/cross-skill-untyped-page-source-evidence-v1.json';
const RECORD_CONTRACT='sensum.cross-skill-untyped-page-source-evidence.v1';
const AUDIT_CONTRACT='sensum.cross-skill-untyped-page-source-evidence-audit.v1';
const SOURCE_KIND='revision_pinned_cross_skill_untyped_page_source_evidence_without_semantic_classification';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/cross-skill-untyped-page-source-evidence-v1.json',import.meta.url),'utf8'));
const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const sourceIdentity=source=>`${source.sourceUrl}|${source.sourceRevision}`;

function parseRecords(raw,errors) {
  try{return String(raw||'').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);}
  catch{errors.push('snapshot_ndjson_invalid');return[];}
}

function validSnapshot(snapshot) {
  return snapshot&&typeof snapshot.directory==='string'&&snapshot.directory.length>0&&isSha256(snapshot.contentHash)&&Array.isArray(snapshot.rejections)&&snapshot.rejections.length===0;
}

function normalizedSource(record) {
  return {
    providerKey:`wiki-pageid:${Number(record?.sourcePageId)}`,
    sourceUrl:record?.sourceUrl,
    title:record?.resolvedTitle,
    sourceRevision:String(record?.sourceRevision||''),
    sourceTimestamp:record?.sourceTimestamp,
    sourceContentHash:record?.sourceContentHash
  };
}

function validWikiSource(source) {
  const pageId=Number(String(source?.providerKey||'').replace('wiki-pageid:',''));
  return Number.isInteger(pageId)&&pageId>0&&typeof source?.title==='string'&&source.title.length>0&&source.sourceRevision.length>0
    &&Number.isFinite(Date.parse(source?.sourceTimestamp))&&String(source?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')&&isSha256(source?.sourceContentHash);
}

function frequency(rows,key) {
  const counts={};
  for(const row of rows) counts[row[key]]=(counts[row[key]]||0)+1;
  return counts;
}

function structuralCoverage(records) {
  const templates=records.flatMap(record=>record.rootTemplateEvidence||[]);
  const categories=records.flatMap(record=>record.directCategoryEvidence||[]);
  return {
    namespaceCounts:frequency(records.map(record=>({key:String(record.sourceNamespaceId)})),'key'),
    pagesWithRootTemplates:records.filter(record=>record.rootTemplateEvidence?.length).length,
    pagesWithDirectCategories:records.filter(record=>record.directCategoryEvidence?.length).length,
    uniqueRootTemplateCount:unique(templates.map(row=>row.template)).length,
    uniqueDirectCategoryCount:unique(categories.map(row=>row.category)).length,
    rootTemplateCounts:frequency(templates,'template'),
    directCategoryCounts:frequency(categories,'category'),
    totalLeadParagraphs:records.reduce((sum,record)=>sum+(record.leadParagraphEvidence?.length||0),0),
    totalHeadings:records.reduce((sum,record)=>sum+(record.headingEvidence?.length||0),0),
    totalSourceContentBytes:records.reduce((sum,record)=>sum+Number(record.sourceContentBytes||0),0),
    missingNamespaceCandidateKeys:records.filter(record=>!Number.isInteger(record.sourceNamespaceId)).map(record=>record.candidateKey)
  };
}

function compactStatement(record) {
  const payload={
    blockers:record.blockers,
    canonicalActivityIdentity:null,
    canonicalGameEntityIdentity:null,
    optimizerEligible:false,
    pageTypeReviewState:record.pageTypeReview.state,
    repeatabilityClassification:null,
    skillKeys:record.skillKeys,
    sourceNamespaceId:record.sourceNamespaceId,
    structuralEvidence:{
      directCategoryCount:record.directCategoryEvidence.length,
      headingCount:record.headingEvidence.length,
      leadParagraphCount:record.leadParagraphEvidence.length,
      rootTemplateCount:record.rootTemplateEvidence.length,
      sourceContentBytes:record.sourceContentBytes,
      sourceLineCount:record.sourceLineCount,
      sourceSignatureContextCount:record.sourceSignatureContexts.length
    },
    state:record.state
  };
  const envelope={recordKey:record.candidateKey,sourceRevision:String(record.sourceRevision),sourceLocator:{candidateKey:record.candidateKey,sourcePageId:Number(record.sourcePageId)},payload};
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateCrossSkillUntypedPageSourceMaterializationInput({raw,manifest,audit}) {
  const errors=[],add=message=>errors.push(message),records=parseRecords(raw,errors),compiled=compileCrossSkillUntypedPageEvidencePolicy(POLICY);
  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==CROSS_SKILL_UNTYPED_PAGE_SOURCE_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!==SOURCE_KIND) add('manifest_source_channel_mismatch');
  if(manifest?.source?.api!=='https://oldschool.runescape.wiki/api.php'||manifest?.source?.fetchMode!=='exact retained revision IDs') add('manifest_source_api_or_mode_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(Number(manifest?.records)!==records.length||records.length===0) add('manifest_record_count_mismatch');
  if(!compiled.valid||compiled.invalidRules.length||POLICY?.policy!==POLICY_ID||POLICY?.recordContract!==RECORD_CONTRACT||POLICY?.auditContract!==AUDIT_CONTRACT) add('evidence_policy_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest.source.policy.file!==POLICY_FILE||manifest.source.policy.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  for(const key of ['candidates','sourceSignatures']) if(!validSnapshot(manifest?.source?.inputSnapshots?.[key])) add(`manifest_input_snapshot_invalid:${key}`);

  if(audit?.contract!==AUDIT_CONTRACT) add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true) add('audit_not_publishable');
  if(audit?.policy?.id!==POLICY_ID||audit?.policy?.file!==POLICY_FILE||audit?.policy?.contentHash!==hash(POLICY)) add('audit_policy_binding_mismatch');
  if(json(audit?.inputSnapshots)!==json(manifest?.source?.inputSnapshots)) add('audit_input_snapshot_mismatch');
  if(!audit?.outputSnapshot?.directory||audit?.outputSnapshot?.contentHash!==manifest?.contentHash) add('audit_output_snapshot_mismatch');
  if(Number(audit?.fetchedRevisionCount)!==records.length) add('audit_fetched_revision_count_mismatch');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','inputSnapshots','fetchedRevisionCount','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');
  const accountIndependence=classifyAcceptedEvidenceAccountIndependence({audit,manifest,records});
  if(!accountIndependence.proven) add(`account_independence_not_proven:${accountIndependence.blockers.join('|')}`);

  const input=audit?.inputCoverage||{};
  for(const key of ['expectedUntypedCandidateCount','sourceEvidenceRecordCount','relevantSourceSignaturePageCount','fetchedExactRevisionCount']) if(Number(input[key])!==records.length) add(`audit_input_count_mismatch:${key}`);
  if(Number(input.relevantSourceSignatureCount)!==Number(input.preservedSourceSignatureContextCount)||Number(input.relevantSourceSignatureCount)<=records.length) add('audit_signature_context_count_mismatch');
  for(const key of ['duplicateInputCandidateKeys','duplicateOutputCandidateKeys','missingCandidateKeys','unexpectedCandidateKeys','missingSignaturePageIds','duplicateInputSignatureContextKeys','duplicateOutputSignatureContextKeys','missingSignatureContextKeys','unexpectedSignatureContextKeys','duplicateFetchedRevisions','missingFetchedRevisions']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  if(Number(audit?.sourceAlignment?.fullyAlignedCount)!==records.length||audit?.sourceAlignment?.allPageIdsRevisionsTimestampsTitlesHashesBytesTemplatesAndCategoriesAligned!==true||(audit?.sourceAlignment?.failedCandidateKeys||[]).length) add('audit_source_alignment_incomplete');
  if(audit?.sourceEvidenceCoverageComplete!==true||audit?.pageTypeReviewComplete!==false||audit?.canonicalIdentityComplete!==false||audit?.repeatabilityAndMechanicsComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_semantic_gate_weakened');
  for(const blocker of ['untyped_page_type_semantic_review_pending','canonical_game_entity_and_activity_identity_not_established','repeatability_requirements_variants_xp_timing_and_mechanics_not_proven','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const fetched=manifest?.source?.fetchedRevisions||[],fetchedByIdentity=new Map();
  for(const source of fetched) {
    const key=`${Number(source?.pageId)}|${String(source?.revision||'')}`;
    if(fetchedByIdentity.has(key)) add(`manifest_duplicate_fetched_revision:${key}`);
    fetchedByIdentity.set(key,source);
    if(!Number.isInteger(Number(source?.pageId))||Number(source.pageId)<=0||!Number.isInteger(Number(source?.namespaceId))||!source?.title||!source?.revision||!Number.isFinite(Date.parse(source?.timestamp))||!isSha256(source?.contentHash)) add(`manifest_fetched_revision_invalid:${key}`);
  }
  if(fetched.length!==records.length) add('manifest_fetched_revision_set_mismatch');

  const requiredAlignment=['policyValid','candidateIntrinsicHashValid','signatureIntrinsicHashesValid','candidateAndSignaturePageIdMatch','candidateAndSignatureRevisionMatch','candidateAndSignatureContentHashMatch','allSignatureContextsEquivalent','fetchedAndSignaturePageIdMatch','fetchedAndSignatureRevisionMatch','fetchedAndSignatureTimestampMatch','fetchedAndSignatureTitleMatch','fetchedAndSignatureContentHashMatch','fetchedAndSignatureContentBytesMatch','fetchedRootTemplatesMatchSignatures','fetchedDirectCategoriesMatchSignatures'];
  const requiredBlockers=['page_type_semantic_review_pending','canonical_game_entity_identity_not_established','canonical_activity_identity_not_established','repeatability_requirements_variants_xp_timing_and_mechanics_not_proven','optimizer_eligibility_blocked'];
  const seenKeys=[],seenContexts=[],sourceMap=new Map();
  for(const record of records) {
    const key=record?.candidateKey||'unknown';seenKeys.push(key);
    if(record?.contract!==RECORD_CONTRACT) add(`record_contract_mismatch:${key}`);
    if(!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))||!isSha256(record?.sourceCandidateContentHash)) add(`record_content_hash_mismatch:${key}`);
    if(record?.state!=='review_ready'||record?.optimizerEligible!==false||record?.canonicalGameEntityIdentity!==null||record?.canonicalActivityIdentity!==null||record?.repeatabilityClassification!==null) add(`record_semantic_gate_weakened:${key}`);
    if(record?.pageTypeReview?.state!=='unreviewed'||record?.pageTypeReview?.disposition!==null||(record?.pageTypeReview?.evidenceKeys||[]).length) add(`record_page_type_review_not_closed:${key}`);
    for(const blocker of requiredBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    if(requiredAlignment.some(name=>record?.revisionAlignment?.[name]!==true)||Object.keys(record?.revisionAlignment||{}).length!==requiredAlignment.length) add(`record_revision_alignment_failed:${key}`);
    if(!Array.isArray(record?.skillKeys)||!record.skillKeys.length||unique(record.skillKeys).length!==record.skillKeys.length||!Array.isArray(record?.statementKeys)||unique(record.statementKeys).length!==record.statementKeys.length) add(`record_skill_or_statement_scope_invalid:${key}`);
    if(!Number.isInteger(record?.sourceNamespaceId)||!Number.isInteger(record?.sourceContentBytes)||record.sourceContentBytes<=0||!Number.isInteger(record?.sourceLineCount)||record.sourceLineCount<=0) add(`record_source_structure_invalid:${key}`);
    for(const [name,value] of [['rootTemplateEvidence',record?.rootTemplateEvidence],['directCategoryEvidence',record?.directCategoryEvidence],['leadParagraphEvidence',record?.leadParagraphEvidence],['headingEvidence',record?.headingEvidence],['sourceSignatureContexts',record?.sourceSignatureContexts]]) if(!Array.isArray(value)) add(`record_structural_array_invalid:${key}:${name}`);
    const source=normalizedSource(record);
    if(!validWikiSource(source)) add(`record_source_provenance_invalid:${key}`);
    const fetch=fetchedByIdentity.get(`${Number(record?.sourcePageId)}|${String(record?.sourceRevision||'')}`);
    if(!fetch||Number(fetch.namespaceId)!==record.sourceNamespaceId||fetch.title!==record.resolvedTitle||fetch.timestamp!==record.sourceTimestamp||fetch.contentHash!==record.sourceContentHash) add(`manifest_fetched_revision_mismatch:${key}`);
    const identity=sourceIdentity(source),prior=sourceMap.get(identity);
    if(prior&&json(prior)!==json(source)) add(`conflicting_exact_wiki_source_identity:${key}`);
    sourceMap.set(identity,source);
    for(const context of record?.sourceSignatureContexts||[]) {
      const contextKey=hash(context);seenContexts.push(contextKey);
      if(Number(context?.pageId)!==Number(record.sourcePageId)||String(context?.identitySourceRevision||'')!==String(record.sourceRevision)||!context?.targetKey||!context?.requestedTitle||!isSha256(context?.sourceSignatureContentHash)||!Array.isArray(context?.referencedBy?.skillKeys)||!Array.isArray(context?.referencedBy?.statementKeys)) add(`record_signature_context_invalid:${key}`);
    }
  }
  if(unique(seenKeys).length!==records.length) add('duplicate_record_keys');
  if(sourceMap.size!==records.length||fetchedByIdentity.size!==records.length) add('exact_source_identity_count_mismatch');
  if(unique(seenContexts).length!==seenContexts.length||seenContexts.length!==Number(input.relevantSourceSignatureCount)) add('source_signature_context_set_mismatch');

  const structural=structuralCoverage(records),promotion=audit?.semanticPromotionCoverage||{};
  if(json(structural)!==json(audit?.structuralEvidenceCoverage)) add('audit_structural_coverage_mismatch');
  if(Number(promotion.reviewReadyCount)!==records.length||Number(promotion.pageTypeReviewedCount)!==0||Number(promotion.canonicalGameEntityIdentityCount)!==0||Number(promotion.canonicalActivityIdentityCount)!==0||Number(promotion.repeatabilityClassifiedCount)!==0||Number(promotion.optimizerEligibleCount)!==0||(promotion.unsupportedPromotionCandidateKeys||[]).length) add('audit_semantic_promotion_mismatch');
  if(errors.length) throw new Error(`Cross-skill untyped page-source materialization input rejected: ${unique(errors).join(', ')}`);

  const sources=[...sourceMap.values()].sort((a,b)=>sourceIdentity(a).localeCompare(sourceIdentity(b))),statements=records.map(compactStatement),skillKeys=sorted(unique(records.flatMap(record=>record.skillKeys)));
  const gates={accountIndependenceProven:true,accountIndependenceBasis:accountIndependence.basis,sourceEvidenceCoverageComplete:true,sourceSignatureContextCount:seenContexts.length,pagesWithRootTemplates:structural.pagesWithRootTemplates,pagesWithDirectCategories:structural.pagesWithDirectCategories,pageTypeReviewComplete:false,canonicalIdentityComplete:false,repeatabilityAndMechanicsComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true};
  const model={contract:CROSS_SKILL_UNTYPED_PAGE_SOURCE_MATERIALIZATION_CONTRACT,domain:CROSS_SKILL_UNTYPED_PAGE_SOURCE_INPUT_DOMAIN,snapshotDirectory:audit.outputSnapshot.directory,snapshotCreatedAt:manifest.createdAt,snapshotContentHash:manifest.contentHash,auditContentHash:audit.contentHash,sourceRevision:sources.map(source=>source.sourceRevision).sort().join(','),sources,records,statements,skillKeys,counts:{sources:sources.length,records:records.length,statements:statements.length,sourceSignatureContexts:seenContexts.length},gates};
  model.recordHashAggregate=hash(records.map(record=>record.contentHash).sort());model.sourceHashAggregate=hash(sources.map(source=>source.sourceContentHash).sort());model.statementHashAggregate=hash(statements.map(statement=>statement.contentHash).sort());model.materializationHash=hash(model);model.runId=deterministicUuid('sensum-ingestion-run',`${model.domain}:${model.snapshotContentHash}`);model.snapshotId=deterministicUuid('sensum-data-snapshot',model.snapshotContentHash);
  return model;
}

export function buildCrossSkillUntypedPageSourceMaterializationSql(model) {
  return buildCandidateEvidenceMaterializationSql(model,{contract:CROSS_SKILL_UNTYPED_PAGE_SOURCE_MATERIALIZATION_CONTRACT,factKind:CROSS_SKILL_UNTYPED_PAGE_SOURCE_FACT_KIND,label:'Accepted cross-skill untyped page-source evidence',recordKey:record=>record.candidateKey});
}
export function buildCrossSkillUntypedPageSourceExistingSourceCountQuery(model) {return buildCandidateEvidenceExistingSourceCountQuery(model);}
export function buildCrossSkillUntypedPageSourceReconciliationQuery(model) {return buildCandidateEvidenceReconciliationQuery(model,CROSS_SKILL_UNTYPED_PAGE_SOURCE_FACT_KIND);}
export function verifyCrossSkillUntypedPageSourceReconciliation(model,actual) {
  return verifyCandidateEvidenceReconciliation(model,actual,{gateVerifier:metrics=>metrics?.accountIndependenceProven===true&&metrics?.accountIndependenceBasis===model.gates.accountIndependenceBasis&&metrics?.sourceEvidenceCoverageComplete===true&&Number(metrics?.sourceSignatureContextCount)===model.counts.sourceSignatureContexts&&Number(metrics?.pagesWithRootTemplates)===model.gates.pagesWithRootTemplates&&Number(metrics?.pagesWithDirectCategories)===model.gates.pagesWithDirectCategories&&metrics?.pageTypeReviewComplete===false&&metrics?.canonicalIdentityComplete===false&&metrics?.repeatabilityAndMechanicsComplete===false&&metrics?.completeActivityUniverse===false&&Number(metrics?.optimizerEligibleRecords)===0&&metrics?.automaticVerification===false&&metrics?.semanticReviewRequired===true});
}
