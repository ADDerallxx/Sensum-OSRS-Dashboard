import fs from 'node:fs';
import {hash,json} from '../ingestion/lib.mjs';
import {compileActivityInfoboxSchemaSemanticsEvidencePolicy} from '../ingestion/activity-infobox-schema-semantics-evidence-lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {
  buildCandidateEvidenceExistingSourceCountQuery,
  buildCandidateEvidenceMaterializationSql,
  buildCandidateEvidenceReconciliationQuery,
  verifyCandidateEvidenceReconciliation
} from './candidate-evidence-materialization-lib.mjs';

export const ACTIVITY_INFOBOX_SCHEMA_MATERIALIZATION_CONTRACT='sensum.activity-infobox-schema-semantics-evidence-postgresql-materialization.v1';
export const ACTIVITY_INFOBOX_SCHEMA_INPUT_DOMAIN='activity-infobox-schema-semantics-evidence';
export const ACTIVITY_INFOBOX_SCHEMA_FACT_KIND='raw_activity_infobox_schema_semantics_evidence';

const POLICY_ID='sensum.activity-infobox-schema-semantics-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-infobox-schema-semantics-evidence-v1.json';
const POLICY=JSON.parse(fs.readFileSync(new URL('../policies/activity-infobox-schema-semantics-evidence-v1.json',import.meta.url),'utf8'));
const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const sorted=values=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const sourceIdentity=source=>`${source.sourceUrl}|${source.sourceRevision}`;
const assert=(condition,message)=>{if(!condition) throw new Error(message);};

function containsAccountState(value) {
  if(Array.isArray(value)) return value.some(containsAccountState);
  if(!value||typeof value!=='object') return false;
  return Object.entries(value).some(([key,child])=>accountKey(key)||containsAccountState(child));
}

function parseRecords(raw,errors) {
  try{return String(raw||'').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);}
  catch{errors.push('snapshot_ndjson_invalid');return[];}
}

function normalizedSource(source,{titleKey='resolvedTitle',pageIdKey='sourcePageId',revisionKey='sourceRevision',timestampKey='sourceTimestamp',hashKey='sourceContentHash'}={}) {
  return {
    providerKey:`wiki-pageid:${Number(source?.[pageIdKey])}`,
    sourceUrl:source?.sourceUrl,
    title:source?.[titleKey],
    sourceRevision:String(source?.[revisionKey]||''),
    sourceTimestamp:source?.[timestampKey],
    sourceContentHash:source?.[hashKey]
  };
}

function validWikiSource(source) {
  return Number.isInteger(Number(source?.providerKey?.replace('wiki-pageid:','')))&&Number(source.providerKey.replace('wiki-pageid:',''))>0
    &&typeof source?.title==='string'&&source.title.length>0
    &&source.sourceRevision.length>0
    &&Number.isFinite(Date.parse(source?.sourceTimestamp))
    &&String(source?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')
    &&isSha256(source?.sourceContentHash);
}

function addSource(sourceMap,pageMap,source,errors,context) {
  if(!validWikiSource(source)){errors.push(`invalid_exact_wiki_source:${context}`);return;}
  const identity=sourceIdentity(source),pageKey=`${source.providerKey}|${source.sourceRevision}`,prior=sourceMap.get(identity),priorPage=pageMap.get(pageKey);
  if(prior&&json(prior)!==json(source)) errors.push(`conflicting_exact_wiki_source_identity:${context}`);
  if(priorPage&&sourceIdentity(priorPage)!==identity) errors.push(`conflicting_wiki_page_revision_identity:${context}`);
  sourceMap.set(identity,source);pageMap.set(pageKey,source);
}

function compactStatement(record) {
  const evidence=record.activityInfoboxSchemaSemanticsEvidence;
  const payload={
    blockers:record.blockers,
    canonicalActivityScopeVerdict:null,
    canonicalActivitySubjectBinding:null,
    canonicalActivitySubjectDeclarationVerdict:null,
    completeSchemaSourceCount:evidence.completeSourceCount,
    exactSchemaObservationCount:evidence.exactSingleObservationCount,
    optimizerEligible:false,
    repeatabilityVerdict:null,
    reviewState:record.activityInfoboxSchemaSemanticsReview.state,
    schemaKey:evidence.schemaKey,
    state:record.state
  };
  const envelope={recordKey:record.memberCandidateKey,sourceRevision:String(record.sourceRevision),sourceLocator:{memberCandidateKey:record.memberCandidateKey,sourcePageId:Number(record.sourcePageId),schemaKey:evidence.schemaKey},payload};
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityInfoboxSchemaMaterializationInput({raw,manifest,audit}) {
  const errors=[],add=message=>errors.push(message),records=parseRecords(raw,errors),compiled=compileActivityInfoboxSchemaSemanticsEvidencePolicy(POLICY);
  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_INFOBOX_SCHEMA_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_activity_infobox_template_documentation_and_module_schema_semantics_evidence_without_subject_binding') add('manifest_source_channel_mismatch');
  if(manifest?.source?.api!=='https://oldschool.runescape.wiki/api.php') add('manifest_source_api_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(Number(manifest?.records)!==records.length||records.length!==1) add('manifest_record_count_mismatch');
  if(POLICY?.policy!==POLICY_ID||POLICY?.recordContract!=='sensum.activity-infobox-schema-semantics-evidence.v1'||POLICY?.auditContract!=='sensum.activity-infobox-schema-semantics-evidence-audit.v1'||compiled.invalidRules.length||compiled.forbiddenPolicyPaths.length||compiled.duplicateSourceKeys.length||compiled.duplicateSourceTitles.length||compiled.duplicateObservationKeys.length||compiled.invalidSources.length||compiled.invalidObservations.length) add('schema_policy_invalid');
  if(manifest?.source?.policy?.id!==POLICY_ID||manifest.source.policy.file!==POLICY_FILE||manifest.source.policy.contentHash!==hash(POLICY)) add('manifest_policy_binding_mismatch');
  if((manifest?.source?.inputSnapshot?.rejections||[]).length||!manifest?.source?.inputSnapshot?.directory||!isSha256(manifest?.source?.inputSnapshot?.contentHash)) add('manifest_input_snapshot_invalid');

  if(audit?.contract!=='sensum.activity-infobox-schema-semantics-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(audit?.policy?.id!==POLICY_ID||audit.policy.file!==POLICY_FILE||audit.policy.contentHash!==hash(POLICY)) add('audit_policy_binding_mismatch');
  if(json(audit?.inputSnapshot)!==json(manifest?.source?.inputSnapshot)) add('audit_input_snapshot_mismatch');
  if(!audit?.outputSnapshot?.directory||audit.outputSnapshot.contentHash!==manifest?.contentHash) add('audit_output_snapshot_mismatch');
  if(json(audit?.fetchedRevisions)!==json(manifest?.source?.fetchedRevisions)) add('audit_fetched_revision_mismatch');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','inputSnapshot','fetchedRevisions','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{},policyAudit=audit?.policyCoverage||{},revisionAudit=audit?.sourceRevisionCoverage||{},observationAudit=audit?.observationCoverage||{},promotion=audit?.semanticPromotionCoverage||{};
  if(Number(input.expectedRoutingRecordCount)!==records.length||Number(input.evidenceRecordCount)!==records.length||input.exactInputOutputSetAndContextMatch!==true) add('audit_input_coverage_mismatch');
  for(const key of ['duplicateInputMemberCandidateKeys','duplicateOutputMemberCandidateKeys','missingMemberCandidateKeys','unexpectedMemberCandidateKeys','contextMismatchMemberCandidateKeys','evidenceMismatchMemberCandidateKeys']) if((input[key]||[]).length) add(`audit_input_set_invalid:${key}`);
  if(policyAudit.policy!==POLICY_ID||Number(policyAudit.requiredSourceCount)!==compiled.requiredSources.length||Number(policyAudit.requiredObservationCount)!==compiled.requiredObservations.length) add('audit_policy_coverage_mismatch');
  for(const key of ['invalidRules','forbiddenPolicyPaths','duplicateSourceKeys','duplicateSourceTitles','duplicateObservationKeys','invalidSources','invalidObservations']) if((policyAudit[key]||[]).length) add(`audit_policy_gate_invalid:${key}`);
  if(Number(revisionAudit.requestedSourceCount)!==compiled.requiredSources.length||Number(revisionAudit.fetchedResolutionCount)!==compiled.requiredSources.length||Number(revisionAudit.sourceEvidenceCount)!==compiled.requiredSources.length||Number(revisionAudit.completeSourceEvidenceCount)!==compiled.requiredSources.length) add('audit_source_revision_count_mismatch');
  for(const key of ['duplicateFetchedTitles','missingFetchedTitles','unexpectedFetchedTitles','incompleteSources']) if((revisionAudit[key]||[]).length) add(`audit_source_revision_invalid:${key}`);
  if(Number(observationAudit.requiredObservationCountPerRecord)!==compiled.requiredObservations.length||Number(observationAudit.observationCount)!==compiled.requiredObservations.length||Number(observationAudit.exactSingleObservationCount)!==compiled.requiredObservations.length||(observationAudit.incompleteObservations||[]).length) add('audit_observation_coverage_mismatch');
  for(const key of ['subjectDispositionBindingOrReviewMutationMemberCandidateKeys','unsupportedDownstreamPromotionMemberCandidateKeys']) if((promotion[key]||[]).length) add(`audit_semantic_promotion:${key}`);
  for(const key of ['canonicalActivitySubjectBindingCount','canonicalActivitySubjectDeclarationVerdictCount','canonicalActivityScopeClassificationCount','repeatabilityClassificationCount','memberExpansionReviewedCount','mechanicsReviewedCount','optimizerEligibleCount']) if(Number(promotion[key])!==0) add(`audit_semantic_gate_weakened:${key}`);
  if((audit?.accountStateFindings||[]).length||audit?.evidencePacketAttemptCoverageComplete!==true||audit?.activityInfoboxSchemaSemanticsEvidenceCoverageComplete!==true||audit?.canonicalActivitySubjectBindingReviewComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  for(const blocker of ['activity_infobox_schema_evidence_requires_semantic_disposition','schema_evidence_does_not_independently_bind_canonical_activity_subject','canonical_activity_subject_binding_unresolved','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const specs=new Map(compiled.requiredSources.map(source=>[source.sourceKey,source])),observationsByKey=new Map(compiled.requiredObservations.map(observation=>[observation.observationKey,observation])),fetched=manifest?.source?.fetchedRevisions||[],fetchedByTitle=new Map();
  for(const source of fetched) {
    if(fetchedByTitle.has(source.requestedTitle)) add(`manifest_duplicate_requested_title:${source.requestedTitle}`);
    fetchedByTitle.set(source.requestedTitle,source);
    const spec=compiled.requiredSources.find(item=>item.requestedTitle===source.requestedTitle);
    if(!spec||Number(source.namespace)!==spec.namespace||!Number.isInteger(Number(source.pageId))||Number(source.pageId)<=0||!source.resolvedTitle||!source.revision||!Number.isFinite(Date.parse(source.timestamp))||!isSha256(source.contentHash)) add(`manifest_fetched_revision_invalid:${source.requestedTitle}`);
  }
  if(fetched.length!==compiled.requiredSources.length||compiled.requiredSources.some(spec=>!fetchedByTitle.has(spec.requestedTitle))) add('manifest_required_source_set_mismatch');

  const sourceMap=new Map(),pageMap=new Map(),seenRecordKeys=[];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';seenRecordKeys.push(key);
    if(record?.contract!=='sensum.activity-infobox-schema-semantics-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    if(record?.state!=='activity_infobox_schema_semantics_evidence_ready_for_disposition'||record?.optimizerEligible!==false||record?.canonicalGameEntityIdentity!==null||record?.canonicalActivitySubjectBinding!==null) add(`record_semantic_gate_weakened:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record?.mechanicsReview?.state!=='unreviewed') add(`record_downstream_review_gate_weakened:${key}`);
    for(const blocker of ['activity_infobox_schema_evidence_requires_semantic_disposition','schema_evidence_does_not_independently_bind_canonical_activity_subject','canonical_activity_subject_binding_unresolved','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked']) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    for(const [name,value] of Object.entries(record||{})) if(name.endsWith('ContentHash')&&!isSha256(value)) add(`record_provenance_hash_invalid:${key}:${name}`);
    addSource(sourceMap,pageMap,normalizedSource(record),errors,`primary:${key}`);

    const sources=record?.schemaEvidenceSources||[],evidence=record?.activityInfoboxSchemaSemanticsEvidence||{},review=record?.activityInfoboxSchemaSemanticsReview||{},sourceByKey=new Map(sources.map(source=>[source.sourceKey,source]));
    if(sources.length!==compiled.requiredSources.length||sourceByKey.size!==sources.length||compiled.requiredSources.some(spec=>!sourceByKey.has(spec.sourceKey))) add(`record_schema_source_set_mismatch:${key}`);
    const flattened=[];
    for(const source of sources) {
      const spec=specs.get(source.sourceKey),fetch=spec&&fetchedByTitle.get(spec.requestedTitle),normalized=normalizedSource(source);
      if(!spec||source.requestedTitle!==spec.requestedTitle||Number(source.namespace)!==spec.namespace||source.state!=='complete_revision_pinned_schema_source_evidence'||(source.deficiencies||[]).length) add(`record_schema_source_invalid:${key}:${source.sourceKey}`);
      if(!fetch||source.resolvedTitle!==fetch.resolvedTitle||Number(source.sourcePageId)!==Number(fetch.pageId)||String(source.sourceRevision)!==String(fetch.revision)||source.sourceTimestamp!==fetch.timestamp||source.sourceContentHash!==fetch.contentHash) add(`record_schema_source_manifest_mismatch:${key}:${source.sourceKey}`);
      addSource(sourceMap,pageMap,normalized,errors,`schema:${key}:${source.sourceKey}`);
      const expectedKeys=compiled.requiredObservations.filter(item=>item.sourceKey===source.sourceKey).map(item=>item.observationKey),actualKeys=(source.observations||[]).map(item=>item.observationKey);
      if(json(sorted(expectedKeys))!==json(sorted(actualKeys))||unique(actualKeys).length!==actualKeys.length) add(`record_schema_source_observation_set_mismatch:${key}:${source.sourceKey}`);
      for(const observation of source.observations||[]) {
        const specObservation=observationsByKey.get(observation.observationKey);
        if(!specObservation||specObservation.sourceKey!==source.sourceKey||observation.matchMode!==specObservation.matchMode||observation.literal!==specObservation.literal||Number(observation.occurrenceCount)!==1||observation.exactSingleOccurrence!==true||(observation.occurrences||[]).length!==1) add(`record_schema_source_observation_invalid:${key}:${observation.observationKey}`);
        flattened.push({...observation,sourceKey:source.sourceKey,sourcePageId:source.sourcePageId,sourceRevision:source.sourceRevision,sourceTimestamp:source.sourceTimestamp,sourceUrl:source.sourceUrl,sourceContentHash:source.sourceContentHash});
      }
    }
    const observationKeys=(evidence.observations||[]).map(item=>item.observationKey),expectedEvidenceKeys=flattened.map(observation=>`${observation.sourceKey}:${observation.sourcePageId}:${observation.sourceRevision}:${observation.observationKey}`);
    if(evidence.schemaKey!=='activity_infobox'||evidence.evidenceState!=='complete_revision_pinned_activity_infobox_schema_semantics_evidence_packet'||Number(evidence.requiredSourceCount)!==compiled.requiredSources.length||Number(evidence.completeSourceCount)!==compiled.requiredSources.length||Number(evidence.requiredObservationCount)!==compiled.requiredObservations.length||Number(evidence.exactSingleObservationCount)!==compiled.requiredObservations.length||json(evidence.observations)!==json(flattened)||unique(observationKeys).length!==compiled.requiredObservations.length) add(`record_schema_evidence_mismatch:${key}`);
    if(evidence.canonicalActivitySubjectBinding!==null||evidence.canonicalActivitySubjectDeclarationVerdict!==null||evidence.canonicalActivityScopeVerdict!==null||evidence.repeatabilityVerdict!==null) add(`record_schema_evidence_semantic_promotion:${key}`);
    if(json(evidence.documentedNameParameterMeaningObservation)!==json(flattened.find(item=>item.observationKey==='documentation_describes_name_as_activity_name'))||json(evidence.nameHeaderRenderingObservation)!==json(flattened.find(item=>item.observationKey==='module_renders_name_as_infobox_header'))) add(`record_schema_named_observation_mismatch:${key}`);
    if(review.state!=='unreviewed_complete_schema_evidence_semantic_disposition_required'||review.canonicalActivitySubjectBinding!==null||review.canonicalActivitySubjectDeclarationVerdict!==null||review.canonicalActivityScopeVerdict!==null||review.repeatabilityVerdict!==null||json(review.evidenceKeys)!==json(expectedEvidenceKeys)) add(`record_schema_review_gate_weakened:${key}`);
  }
  if(unique(seenRecordKeys).length!==records.length) add('duplicate_record_keys');
  if(sourceMap.size!==compiled.requiredSources.length+records.length) add('exact_source_identity_count_mismatch');
  if(errors.length) throw new Error(`Activity infobox schema materialization input rejected: ${unique(errors).join(', ')}`);

  const sources=[...sourceMap.values()].sort((a,b)=>sourceIdentity(a).localeCompare(sourceIdentity(b))),statements=records.map(compactStatement);
  const gates={activityInfoboxSchemaSemanticsEvidenceCoverageComplete:true,schemaSourceCount:compiled.requiredSources.length,schemaObservationCount:compiled.requiredObservations.length,canonicalActivitySubjectBindingReviewComplete:false,canonicalActivityScopeReviewComplete:false,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true};
  const model={contract:ACTIVITY_INFOBOX_SCHEMA_MATERIALIZATION_CONTRACT,domain:ACTIVITY_INFOBOX_SCHEMA_INPUT_DOMAIN,snapshotDirectory:audit.outputSnapshot.directory,snapshotCreatedAt:manifest.createdAt,snapshotContentHash:manifest.contentHash,auditContentHash:audit.contentHash,sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),sources,records,statements,skillKeys:[],counts:{sources:sources.length,records:records.length,statements:statements.length,schemaSources:compiled.requiredSources.length,schemaObservations:compiled.requiredObservations.length},gates};
  model.recordHashAggregate=hash(records.map(row=>row.contentHash).sort());model.sourceHashAggregate=hash(sources.map(row=>row.sourceContentHash).sort());model.statementHashAggregate=hash(statements.map(row=>row.contentHash).sort());model.materializationHash=hash(model);model.runId=deterministicUuid('sensum-ingestion-run',`${model.domain}:${model.snapshotContentHash}`);model.snapshotId=deterministicUuid('sensum-data-snapshot',model.snapshotContentHash);
  return model;
}

export function buildActivityInfoboxSchemaMaterializationSql(model) {
  return buildCandidateEvidenceMaterializationSql(model,{contract:ACTIVITY_INFOBOX_SCHEMA_MATERIALIZATION_CONTRACT,factKind:ACTIVITY_INFOBOX_SCHEMA_FACT_KIND,label:'Accepted activity-infobox schema evidence'});
}
export function buildActivityInfoboxSchemaExistingSourceCountQuery(model) {return buildCandidateEvidenceExistingSourceCountQuery(model);}
export function buildActivityInfoboxSchemaReconciliationQuery(model) {return buildCandidateEvidenceReconciliationQuery(model,ACTIVITY_INFOBOX_SCHEMA_FACT_KIND);}
export function verifyActivityInfoboxSchemaReconciliation(model,actual) {
  return verifyCandidateEvidenceReconciliation(model,actual,{gateVerifier:metrics=>metrics?.activityInfoboxSchemaSemanticsEvidenceCoverageComplete===true&&Number(metrics?.schemaSourceCount)===model.counts.schemaSources&&Number(metrics?.schemaObservationCount)===model.counts.schemaObservations&&metrics?.canonicalActivitySubjectBindingReviewComplete===false&&metrics?.canonicalActivityScopeReviewComplete===false&&metrics?.repeatabilityReviewComplete===false&&metrics?.memberExpansionReviewComplete===false&&metrics?.mechanicsReviewComplete===false&&metrics?.completeActivityUniverse===false&&Number(metrics?.optimizerEligibleRecords)===0&&metrics?.automaticVerification===false&&metrics?.semanticReviewRequired===true});
}
