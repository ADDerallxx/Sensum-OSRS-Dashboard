import {hash, json} from '../ingestion/lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {
  buildExistingExactWikiSourceCountQuery,
  exactWikiSourceReconciliationPredicate
} from './exact-wiki-source-identity-lib.mjs';

export const ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_MATERIALIZATION_CONTRACT = 'sensum.activity-reference-collection-member-unresolved-subject-relationship-evidence-postgresql-materialization.v1';
export const ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_INPUT_DOMAIN = 'activity-reference-collection-member-unresolved-subject-relationship-evidence';
export const ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_FACT_KIND = 'raw_activity_reference_member_unresolved_subject_relationship_evidence';

const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const normalize=value=>String(value||'').replaceAll('_',' ').replace(/\s+/g,' ').trim().toLowerCase();

function assert(condition,message) { if(!condition) throw new Error(message); }
function containsAccountState(value) {
  if(Array.isArray(value)) return value.some(containsAccountState);
  if(!value||typeof value!=='object') return false;
  return Object.entries(value).some(([key,child])=>accountKey(key)||containsAccountState(child));
}
function parseRecords(raw,errors) {
  try { return String(raw||'').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse); }
  catch { errors.push('snapshot_ndjson_invalid'); return []; }
}
function sourceIdentity(source) { return `${source.sourceUrl}|${source.sourceRevision}`; }
function wikiSource({pageId,url,title,revision,timestamp,contentHash}) {
  return {providerKey:`wiki-pageid:${pageId}`,sourceUrl:url,title,sourceRevision:String(revision),sourceTimestamp:timestamp,sourceContentHash:contentHash};
}
function expectedCollectionEvidence(record) {
  const context=record.collectionContext||{};
  return {
    collectionSource:context.collectionSource||null,
    sectionEvidence:context.sectionEvidence||null,
    tableEvidence:context.tableEvidence||null,
    rowEvidence:context.rowEvidence||null,
    memberCellEvidence:context.memberCellEvidence||null,
    memberLinks:context.memberLinks||[],
    membershipClassification:context.membershipClassification||record.membershipClassification||null,
    evidenceState:'source_authored_collection_membership_assertion_review_only'
  };
}
function expectedRelationshipObservations(record) {
  const evidence=record.collectionMembershipEvidence||{};
  const source=record.sourcePageEvidence||{};
  const label=evidence.memberCellEvidence?.plainText||'';
  const labelKey=normalize(label);
  const links=source.sourceAuthoredLinks||[];
  return {
    memberLabel:label||null,
    normalizedMemberLabel:labelKey||null,
    collectionRowLinkCandidates:(evidence.memberLinks||[]).map((link,index)=>({
      candidateKey:`${record.memberCandidateKey}:collection-row-link:${index+1}`,
      requestedTitle:link.requestedTitle,
      requestedFragment:link.requestedFragment||null,
      displayText:link.displayText||null,
      rawLink:link.rawLink||null,
      sourceLocator:link.sourceLocator||null,
      relationshipState:'unreviewed_collection_row_link_candidate'
    })),
    sourcePageMainNamespaceLinkCandidates:links.filter(link=>link.namespaceClass==='main').map(link=>({...link,relationshipState:'unreviewed_source_page_link_candidate'})),
    exactMemberLabelSourceLinkMatches:labelKey?links.filter(link=>normalize(link.requestedTitle)===labelKey||normalize(link.displayText)===labelKey).map(link=>({...link,matchedMemberLabel:label,matchKind:normalize(link.requestedTitle)===labelKey?'requested_title_exact_normalized':'display_text_exact_normalized',relationshipState:'unreviewed_exact_label_link_match_candidate'})):[],
    exactMemberLabelLeadMentions:labelKey?(source.leadParagraphEvidence||[]).filter(paragraph=>normalize(paragraph.rawText).includes(labelKey)).map(paragraph=>({...paragraph,matchedMemberLabel:label,matchKind:'lead_contains_exact_normalized_full_member_label',relationshipState:'unreviewed_exact_label_text_match_candidate'})):[],
    exactMemberLabelHeadingMentions:labelKey?(source.headingEvidence||[]).filter(heading=>normalize(heading.normalizedTitle||heading.rawTitle).includes(labelKey)).map(heading=>({...heading,matchedMemberLabel:label,matchKind:'heading_contains_exact_normalized_full_member_label',relationshipState:'unreviewed_exact_label_text_match_candidate'})):[],
    relationshipVerdict:null,
    interpretationState:'candidate_observations_only_no_relationship_inference'
  };
}
function compactStatement(record) {
  const observation=record.relationshipCandidateObservations;
  const collection=record.collectionMembershipEvidence.collectionSource;
  const payload={
    blockers:record.blockers,
    canonicalActivityIdentity:null,
    canonicalGameEntityIdentity:null,
    collectionActivityIdentityReviewState:record.collectionActivityIdentityReview.state,
    collectionRowLinkCandidateCount:observation.collectionRowLinkCandidates.length,
    exactMemberLabelHeadingMentionCount:observation.exactMemberLabelHeadingMentions.length,
    exactMemberLabelLeadMentionCount:observation.exactMemberLabelLeadMentions.length,
    exactMemberLabelSourceLinkMatchCount:observation.exactMemberLabelSourceLinkMatches.length,
    linkedSubjectRelationshipReviewState:record.linkedSubjectRelationshipReview.state,
    mechanicsState:record.mechanicsReview.state,
    memberExpansionState:record.memberExpansionReview.state,
    optimizerEligible:false,
    relationshipVerdict:null,
    repeatabilityState:record.repeatabilityReview.state,
    sourcePageMainNamespaceLinkCandidateCount:observation.sourcePageMainNamespaceLinkCandidates.length,
    sourcePageSubjectDisposition:record.sourcePageSubjectDisposition,
    state:record.state
  };
  const envelope={recordKey:record.memberCandidateKey,sourceRevision:String(record.sourceRevision),sourceLocator:{memberCandidateKey:record.memberCandidateKey,sourcePageId:record.sourcePageId,collectionPageId:collection.pageId,collectionRevision:String(collection.revision)},payload};
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityReferenceMemberUnresolvedRelationshipMaterializationInput({raw,manifest,audit}) {
  const errors=[];
  const add=message=>errors.push(message);
  const records=parseRecords(raw,errors);

  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_collection_row_and_linked_source_page_relationship_review_evidence_without_semantic_inference') add('manifest_source_channel_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(manifest?.records!==records.length||records.length===0) add('manifest_record_count_mismatch');

  if(audit?.contract!=='sensum.activity-reference-collection-member-unresolved-subject-relationship-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(!audit?.outputSnapshot?.directory||audit?.outputSnapshot?.contentHash!==manifest?.contentHash||(manifest?.snapshotDirectory&&audit.outputSnapshot.directory!==manifest.snapshotDirectory)) add('audit_output_snapshot_mismatch');
  for(const input of [audit?.routingSnapshot,audit?.sourceSignatureSnapshot,manifest?.source?.routingSnapshot,manifest?.source?.sourceSignatureSnapshot]) if((input?.rejections||[]).length) add('audit_upstream_rejections_present');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','routingSnapshot','sourceSignatureSnapshot','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{};
  for(const count of ['routingRecordCount','queuedRelationshipRouteCount','sourceSignatureRecordCount','relationshipEvidencePacketCount']) if(Number(input[count])!==records.length) add(`audit_record_coverage_mismatch:${count}`);
  if(input.exactInputOutputSetContextAndSourceJoinMatch!==true) add('audit_input_output_join_not_exact');
  for(const key of ['duplicateInputMemberCandidateKeys','duplicateOutputMemberCandidateKeys','missingMemberCandidateKeys','unexpectedMemberCandidateKeys','contextMismatchMemberCandidateKeys','sourceSignatureJoinFailureMemberCandidateKeys']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  const coverage=audit?.evidenceCoverage||{};
  if((coverage.evidenceMismatchMemberCandidateKeys||[]).length) add('audit_relationship_evidence_mismatch');
  const observations=audit?.candidateObservationCoverage||{};
  if(Number(observations.relationshipVerdictCount)!==0||(observations.candidateObservationMismatchMemberCandidateKeys||[]).length||(observations.invalidCandidateStateMemberCandidateKeys||[]).length) add('audit_candidate_relationship_gate_weakened');
  if(audit?.policyCoverage?.policy!=='sensum.activity-reference-collection-member-unresolved-subject-relationship-evidence-policy.v1'||Number(audit?.policyCoverage?.evidenceChannelCount)!==7||(audit?.policyCoverage?.forbiddenPolicyPaths||[]).length) add('audit_policy_gate_invalid');
  const promotion=audit?.semanticPromotionCoverage||{};
  for(const key of ['collectionActivityIdentityReviewedCount','linkedSubjectRelationshipReviewedCount','canonicalGameEntityIdentityCount','canonicalActivityIdentityCount','repeatabilityReviewedCount','memberExpansionReviewedCount','mechanicsReviewedCount','optimizerEligibleCount']) if(Number(promotion[key])!==0) add(`audit_semantic_gate_weakened:${key}`);
  if((promotion.unsupportedPromotionMemberCandidateKeys||[]).length) add('audit_unsupported_promotions_present');
  if((audit?.accountStateFindings||[]).length) add('audit_account_state_present');
  if(audit?.relationshipEvidencePacketCoverageComplete!==true||audit?.collectionActivityIdentityReviewComplete!==false||audit?.linkedSubjectRelationshipReviewComplete!==false||audit?.repeatabilityReviewComplete!==false||audit?.requirementsXpTimingAndMechanicsComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  for(const blocker of ['relationship_candidate_observations_require_semantic_review','collection_activity_identity_not_established','linked_subject_relationship_review_pending','canonical_game_entity_and_activity_identities_not_established','repeatability_and_member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const sourcesByIdentity=new Map();
  const seen=[];
  const measured={collectionMembership:0,collectionRevisions:0,linkedRevisions:0,linkedBytes:0,rootTemplates:0,directCategories:0,leadParagraphs:0,headings:0,sourceLinks:0,mainLinks:0,rowLinks:0,exactLinkMatches:0,exactLeadMentions:0,exactHeadingMentions:0,verdicts:0};
  const requiredBlockers=['relationship_candidate_observations_require_semantic_review','collection_activity_identity_not_established','linked_subject_relationship_review_pending','canonical_game_entity_and_activity_identities_not_established','repeatability_and_member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';
    if(record?.contract!=='sensum.activity-reference-collection-member-unresolved-subject-relationship-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(record?.canonicalGameEntityIdentity!==null||record?.canonicalActivityIdentity!==null||record?.optimizerEligible!==false) add(`record_semantic_gate_weakened:${key}`);
    if(record?.state!=='relationship_evidence_collected_review_pending') add(`record_state_invalid:${key}`);
    for(const blocker of requiredBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    if(record?.sourceSignatureJoin?.matchedRecordCount!==1||record?.sourceSignatureJoin?.exactHashIdentityRevisionAndContextMatch!==true) add(`record_source_signature_join_invalid:${key}`);
    if(record?.routingDecision?.routeState!=='queued'||record?.sourcePageSubjectDisposition?.state!=='source_signature_supported'||!record?.sourcePageSubjectDisposition?.disposition) add(`record_routing_or_subject_disposition_invalid:${key}`);
    if(record?.collectionActivityIdentityReview?.state!=='unreviewed'||record?.collectionActivityIdentityReview?.identity!==null||(record?.collectionActivityIdentityReview?.evidenceKeys||[]).length) add(`record_collection_identity_review_not_closed:${key}`);
    if(record?.linkedSubjectRelationshipReview?.state!=='unreviewed'||(record?.linkedSubjectRelationshipReview?.relationships||[]).length||(record?.linkedSubjectRelationshipReview?.evidenceKeys||[]).length) add(`record_relationship_review_not_closed:${key}`);
    if(record?.repeatabilityReview?.state!=='unreviewed'||record?.repeatabilityReview?.classification!==null||(record?.repeatabilityReview?.evidenceKeys||[]).length) add(`record_repeatability_review_not_closed:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record?.memberExpansionReview?.atomicSubject!==null||(record?.memberExpansionReview?.memberKeys||[]).length||(record?.memberExpansionReview?.evidenceKeys||[]).length) add(`record_member_expansion_review_not_closed:${key}`);
    if(record?.mechanicsReview?.state!=='unreviewed'||(record?.mechanicsReview?.evidenceKeys||[]).length) add(`record_mechanics_review_not_closed:${key}`);
    const collection=record?.collectionMembershipEvidence;
    const page=record?.sourcePageEvidence;
    const observation=record?.relationshipCandidateObservations;
    if(json(collection)!==json(expectedCollectionEvidence(record))) add(`record_collection_evidence_context_mismatch:${key}`);
    if(page?.evidenceState!=='exact_revision_source_page_evidence_review_only'||Number(page?.sourcePageId)!==Number(record?.sourcePageId)||page?.resolvedTitle!==record?.resolvedTitle||String(page?.sourceRevision)!==String(record?.sourceRevision)||page?.sourceTimestamp!==record?.sourceTimestamp||page?.sourceUrl!==record?.sourceUrl||page?.sourceContentHash!==record?.sourceContentHash||!Number.isInteger(page?.sourceContentBytes)||!Object.values(page?.revisionAlignment||{}).length||!Object.values(page.revisionAlignment).every(Boolean)||page?.rootTemplateDelimiterAudit?.balanced!==true||page?.sourceLinkDelimiterAudit?.balanced!==true) add(`record_source_page_evidence_invalid:${key}`);
    if(json(observation)!==json(expectedRelationshipObservations(record))) add(`record_relationship_candidate_observations_invalid:${key}`);
    if(!(record?.memberIdentityContexts||[]).some(row=>Number(row.pageId)===Number(record.sourcePageId)&&String(row.observedRevision)===String(record.sourceRevision))) add(`record_member_identity_context_alignment_missing:${key}`);
    if(!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    for(const [name,value] of Object.entries(record||{})) if(name.endsWith('ContentHash')&&!isSha256(value)) add(`record_provenance_hash_invalid:${key}:${name}`);
    if(!Number.isInteger(Number(record?.sourcePageId))||!record?.resolvedTitle||!String(record?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')||!Number.isFinite(Date.parse(record?.sourceTimestamp))||!isSha256(record?.sourceContentHash)) add(`record_linked_source_provenance_invalid:${key}`);
    const collectionSource=collection?.collectionSource;
    if(!Number.isInteger(Number(collectionSource?.pageId))||!collectionSource?.title||!String(collectionSource?.url||'').startsWith('https://oldschool.runescape.wiki/w/')||!String(collectionSource?.revision||'')||!Number.isFinite(Date.parse(collectionSource?.timestamp))||!isSha256(collectionSource?.contentHash)) add(`record_collection_source_provenance_invalid:${key}`);
    for(const source of [wikiSource({pageId:record.sourcePageId,url:record.sourceUrl,title:record.resolvedTitle,revision:record.sourceRevision,timestamp:record.sourceTimestamp,contentHash:record.sourceContentHash}),wikiSource({pageId:collectionSource?.pageId,url:collectionSource?.url,title:collectionSource?.title,revision:collectionSource?.revision,timestamp:collectionSource?.timestamp,contentHash:collectionSource?.contentHash})]) {
      const identity=sourceIdentity(source),existing=sourcesByIdentity.get(identity);
      if(existing&&json(existing)!==json(source)) add(`record_source_identity_conflict:${key}`); else sourcesByIdentity.set(identity,source);
    }
    measured.collectionMembership+=collection?.rowEvidence?1:0;
    measured.collectionRevisions+=collectionSource?.revision&&collectionSource?.contentHash?1:0;
    measured.linkedRevisions+=page?.sourceRevision&&page?.sourceContentHash?1:0;
    measured.linkedBytes+=Number(page?.sourceContentBytes||0);
    measured.rootTemplates+=(page?.rootTemplates||[]).length;
    measured.directCategories+=(page?.directCategories||[]).length;
    measured.leadParagraphs+=(page?.leadParagraphEvidence||[]).length;
    measured.headings+=(page?.headingEvidence||[]).length;
    measured.sourceLinks+=(page?.sourceAuthoredLinks||[]).length;
    measured.mainLinks+=(observation?.sourcePageMainNamespaceLinkCandidates||[]).length;
    measured.rowLinks+=(observation?.collectionRowLinkCandidates||[]).length;
    measured.exactLinkMatches+=(observation?.exactMemberLabelSourceLinkMatches||[]).length;
    measured.exactLeadMentions+=(observation?.exactMemberLabelLeadMentions||[]).length;
    measured.exactHeadingMentions+=(observation?.exactMemberLabelHeadingMentions||[]).length;
    measured.verdicts+=observation?.relationshipVerdict===null?0:1;
    seen.push(key);
  }
  if(unique(seen).length!==seen.length) add('duplicate_record_keys');
  const evidenceExpected={collectionMembershipEvidenceCount:measured.collectionMembership,collectionRevisionPinnedCount:measured.collectionRevisions,linkedSourceRevisionPinnedCount:measured.linkedRevisions,totalLinkedSourceContentBytes:measured.linkedBytes,rootTemplateCount:measured.rootTemplates,directCategoryCount:measured.directCategories,leadParagraphCount:measured.leadParagraphs,headingCount:measured.headings,sourceAuthoredLinkOccurrenceCount:measured.sourceLinks,mainNamespaceLinkOccurrenceCount:measured.mainLinks};
  for(const [name,value] of Object.entries(evidenceExpected)) if(Number(coverage[name])!==value) add(`audit_relationship_evidence_counts_do_not_reconcile:${name}`);
  const observationExpected={collectionRowLinkCandidateCount:measured.rowLinks,sourcePageMainNamespaceLinkCandidateCount:measured.mainLinks,exactMemberLabelSourceLinkMatchCount:measured.exactLinkMatches,exactMemberLabelLeadMentionCount:measured.exactLeadMentions,exactMemberLabelHeadingMentionCount:measured.exactHeadingMentions,relationshipVerdictCount:measured.verdicts};
  for(const [name,value] of Object.entries(observationExpected)) if(Number(observations[name])!==value) add(`audit_relationship_candidate_counts_do_not_reconcile:${name}`);
  if(errors.length) throw new Error(`Activity reference-member unresolved-relationship materialization input rejected: ${unique(errors).join(', ')}`);

  const sources=[...sourcesByIdentity.values()].sort((a,b)=>sourceIdentity(a).localeCompare(sourceIdentity(b)));
  const statements=records.map(compactStatement);
  const model={
    contract:ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_MATERIALIZATION_CONTRACT,
    domain:ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_INPUT_DOMAIN,
    snapshotDirectory:audit.outputSnapshot.directory,
    snapshotCreatedAt:manifest.createdAt,
    snapshotContentHash:manifest.contentHash,
    auditContentHash:audit.contentHash,
    sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),
    sources,records,statements,skillKeys:[],
    counts:{sources:sources.length,records:records.length,statements:statements.length,sourceAuthoredLinks:measured.sourceLinks,mainNamespaceRelationshipCandidates:measured.mainLinks,collectionRowLinkCandidates:measured.rowLinks},
    gates:{relationshipEvidencePacketCoverageComplete:true,collectionActivityIdentityReviewComplete:false,linkedSubjectRelationshipReviewComplete:false,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}
  };
  model.recordHashAggregate=hash(records.map(row=>row.contentHash).sort());
  model.sourceHashAggregate=hash(sources.map(row=>row.sourceContentHash).sort());
  model.statementHashAggregate=hash(statements.map(row=>row.contentHash).sort());
  model.materializationHash=hash(model);
  model.runId=deterministicUuid('sensum-ingestion-run',`${model.domain}:${model.snapshotContentHash}`);
  model.snapshotId=deterministicUuid('sensum-data-snapshot',model.snapshotContentHash);
  return model;
}

const hex=value=>Buffer.from(String(value),'utf8').toString('hex');
const sqlText=value=>`convert_from(decode('${hex(value)}','hex'),'UTF8')`;
const sqlJson=value=>`${sqlText(json(value))}::jsonb`;
const sqlTimestamp=value=>`${sqlText(value)}::timestamptz`;
function metrics(model) { return {contract:model.contract,...model.counts,skillCoverage:0,skillKeys:[],recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}; }

export function buildActivityReferenceMemberUnresolvedRelationshipMaterializationSql(model) {
  assert(model?.contract===ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_MATERIALIZATION_CONTRACT,'materialization_contract_mismatch');
  const expectedSources=model.sources.map(source=>`(${sqlText(source.providerKey)},${sqlText(source.sourceUrl)},${sqlText(source.title)},${sqlText(source.sourceRevision)},${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(source.sourceTimestamp)},${sqlText(source.sourceContentHash)})`).join(',\n');
  const expectedRecords=model.records.map(record=>`(${sqlText(record.memberCandidateKey)},${sqlJson(record)},${sqlText(record.sourceUrl)},${sqlText(String(record.sourceRevision))},${sqlText(record.contentHash)},${sqlJson(record.blockers)})`).join(',\n');
  const expectedStatements=model.statements.map(statement=>`(${sqlText(statement.recordKey)},${sqlText(statement.sourceUrl)},${sqlText(statement.sourceRevision)},${sqlTimestamp(statement.sourceTimestamp)},${sqlText(statement.contentHash)},${sqlJson(statement.sourceLocator)},${sqlJson(statement.payload)})`).join(',\n');
  const validationSummary={contract:model.contract,auditContentHash:model.auditContentHash,...model.gates};
  const materializationMetrics=metrics(model);
  return [
    '\\set ON_ERROR_STOP on','BEGIN;',
    `SELECT pg_advisory_xact_lock(hashtextextended(${sqlText(`${model.domain}:${model.snapshotContentHash}`)},0));`,
    'CREATE TEMP TABLE expected_sources(provider_key text,source_url text,title text,source_revision text,fetched_at timestamptz,published_at timestamptz,content_hash text) ON COMMIT DROP;',`INSERT INTO expected_sources VALUES ${expectedSources};`,
    'CREATE TEMP TABLE expected_records(record_key text,payload jsonb,source_url text,source_revision text,content_hash text,findings jsonb) ON COMMIT DROP;',`INSERT INTO expected_records VALUES ${expectedRecords};`,
    'CREATE TEMP TABLE expected_statements(record_key text,source_url text,source_revision text,source_timestamp timestamptz,content_hash text,raw_locator jsonb,parsed_value jsonb) ON COMMIT DROP;',`INSERT INTO expected_statements VALUES ${expectedStatements};`,
    `INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`Accepted unresolved subject-relationship review evidence ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson(validationSummary)}) ON CONFLICT (manifest_hash) DO NOTHING;`,
    `INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.sourceRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(materializationMetrics)}) ON CONFLICT (id) DO NOTHING;`,
    "INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,provider_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",
    `INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,
    `INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,
    `INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_FACT_KIND}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,
    buildLineageInsertAndReconciliationSql(model,ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_FACT_KIND),
    `DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson(validationSummary)}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.sourceRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(materializationMetrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON ${exactWikiSourceReconciliationPredicate()}; IF actual<>${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual<>${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}')<>${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual<>${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}')<>${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_FACT_KIND}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual<>${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed'; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '"optimizerEligible"[[:space:]]*:[[:space:]]*true' OR r.payload::text ~* '"relationshipVerdict"[[:space:]]*:[[:space:]]*"' OR r.payload::text ~* '"canonical(?:Activity|GameEntity)Identity"[[:space:]]*:[[:space:]]*\{') THEN RAISE EXCEPTION 'ingestion relationship gate weakened'; END IF; END $$;`,
    'COMMIT;'
  ].join('\n')+'\n';
}

export function buildActivityReferenceMemberUnresolvedRelationshipExistingSourceCountQuery(model) { return buildExistingExactWikiSourceCountQuery(model.sources); }
export function buildActivityReferenceMemberUnresolvedRelationshipReconciliationQuery(model) {
  return `SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM activity_evidence a JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}' WHERE a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_FACT_KIND}'),'lineage',(SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE ingestion_run_id='${model.runId}'),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`;
}
export function verifyActivityReferenceMemberUnresolvedRelationshipReconciliation(model,actual) {
  assert(actual?.runId===model.runId,'reconciliation_run_id_mismatch');
  assert(actual?.status==='published','reconciliation_run_not_published');
  for(const key of ['records','sources','statements']) assert(Number(actual?.[key])===model.counts[key],`reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage)===model.counts.statements,'reconciliation_lineage_count_mismatch');
  assert(actual?.snapshotComplete===false,'unresolved_relationship_evidence_snapshot_must_not_claim_complete_world_knowledge');
  for(const [key,value] of [['recordHashAggregate',model.recordHashAggregate],['sourceHashAggregate',model.sourceHashAggregate],['statementHashAggregate',model.statementHashAggregate],['materializationHash',model.materializationHash]]) assert(actual?.metrics?.[key]===value,`reconciliation_${key}_mismatch`);
  assert(actual?.metrics?.relationshipEvidencePacketCoverageComplete===true&&actual?.metrics?.collectionActivityIdentityReviewComplete===false&&actual?.metrics?.linkedSubjectRelationshipReviewComplete===false&&actual?.metrics?.repeatabilityReviewComplete===false&&actual?.metrics?.memberExpansionReviewComplete===false&&actual?.metrics?.mechanicsReviewComplete===false&&actual?.metrics?.completeActivityUniverse===false&&Number(actual?.metrics?.optimizerEligibleRecords)===0&&actual?.metrics?.automaticVerification===false&&actual?.metrics?.semanticReviewRequired===true,'reconciliation_semantic_gate_weakened');
  return true;
}
