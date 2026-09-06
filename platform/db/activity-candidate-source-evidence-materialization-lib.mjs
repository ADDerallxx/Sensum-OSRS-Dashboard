import {hash, json} from '../ingestion/lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {
  buildExistingExactWikiSourceCountQuery,
  exactWikiSourceReconciliationPredicate
} from './exact-wiki-source-identity-lib.mjs';

export const ACTIVITY_CANDIDATE_SOURCE_MATERIALIZATION_CONTRACT = 'sensum.activity-candidate-source-evidence-postgresql-materialization.v1';
export const ACTIVITY_CANDIDATE_SOURCE_INPUT_DOMAIN = 'activity-candidate-source-evidence';
export const ACTIVITY_CANDIDATE_SOURCE_FACT_KIND = 'raw_activity_candidate_source_evidence';

const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

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
function compactStatement(record) {
  const payload={
    blockers:record.blockers,
    canonicalActivityIdentity:null,
    canonicalGameEntityIdentity:null,
    optimizerEligible:false,
    repeatabilityState:record.repeatabilityReview.state,
    semanticIdentityState:record.semanticIdentityReview.state,
    skillKeys:record.skillKeys,
    state:record.state
  };
  const envelope={recordKey:record.candidateKey,sourceRevision:String(record.sourceRevision),sourceLocator:{candidateKey:record.candidateKey,sourcePageId:record.sourcePageId},payload};
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityCandidateSourceMaterializationInput({raw,manifest,audit}) {
  const errors=[];
  const add=message=>errors.push(message);
  const records=parseRecords(raw,errors);

  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_CANDIDATE_SOURCE_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_activity_candidate_source_evidence_review_packet') add('manifest_source_channel_mismatch');
  if(manifest?.source?.api!=='https://oldschool.runescape.wiki/api.php') add('manifest_source_api_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(manifest?.records!==records.length||records.length===0) add('manifest_record_count_mismatch');

  if(audit?.contract!=='sensum.activity-candidate-source-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(audit?.outputSnapshot?.directory!==manifest?.snapshotDirectory||audit?.outputSnapshot?.contentHash!==manifest?.contentHash) add('audit_output_snapshot_mismatch');
  if((audit?.inputSnapshots?.candidates?.rejections||[]).length||(audit?.inputSnapshots?.sourceSignatures?.rejections||[]).length) add('audit_upstream_rejections_present');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','inputSnapshots','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{};
  if(input.expectedActivityCandidateCount!==records.length||input.sourceEvidenceRecordCount!==records.length||input.relevantSourceSignaturePageCount!==records.length||input.fetchedExactRevisionCount!==records.length||input.exactCandidateSignatureAndFetchSetMatch!==true) add('audit_record_or_source_coverage_mismatch');
  for(const key of ['duplicateInputCandidateKeys','duplicateOutputCandidateKeys','missingCandidateKeys','unexpectedCandidateKeys','conflictingSignaturePageIds','missingSignaturePageIds','duplicateInputSignatureContextKeys','duplicateOutputSignatureContextKeys','missingSignatureContextKeys','unexpectedSignatureContextKeys','duplicateFetchedRevisions','missingFetchedRevisions']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  if(audit?.sourceAlignment?.fullyAlignedCount!==records.length||audit?.sourceAlignment?.allPageIdsRevisionsAndContentHashesAligned!==true||(audit?.sourceAlignment?.failedCandidateKeys||[]).length) add('audit_source_alignment_incomplete');
  if(audit?.sourceEvidenceCoverageComplete!==true) add('audit_source_evidence_coverage_incomplete');
  if(audit?.semanticReviewComplete!==false||audit?.repeatabilityReviewComplete!==false||audit?.requirementsVariantsXpTimingAndMechanicsComplete!==false) add('audit_review_gate_unexpected');
  if(audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_semantic_gate_weakened');
  for(const blocker of ['activity_candidate_semantic_identity_review_pending','activity_candidate_repeatability_review_pending','requirements_variants_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);
  const promotion=audit?.semanticPromotionCoverage||{};
  if(promotion.reviewReadyCount!==records.length||promotion.semanticIdentityReviewedCount!==0||promotion.repeatabilityReviewedCount!==0||promotion.canonicalGameEntityIdentityCount!==0||promotion.canonicalActivityIdentityCount!==0||promotion.optimizerEligibleCount!==0||(promotion.unsupportedPromotionCandidateKeys||[]).length) add('audit_optimizer_or_semantic_gate_weakened');
  if((audit?.accountStateFindings||[]).length) add('audit_account_state_present');
  if((audit?.structuralEvidenceCoverage?.supportedInfoboxCount||0)+(audit?.structuralEvidenceCoverage?.missingSupportedInfoboxCandidateKeys||[]).length!==records.length||(audit?.structuralEvidenceCoverage?.unbalancedSupportedInfoboxCandidateKeys||[]).length) add('audit_structural_coverage_mismatch');
  if((audit?.lexicalCandidateCoverage?.unexpectedSignalKeys||[]).length) add('audit_lexical_policy_mismatch');

  const fetched=new Map((manifest?.source?.fetchedRevisions||[]).map(source=>[`${source.pageId}|${source.revision}`,source]));
  const seen=[];
  const sources=[];
  const requiredBlockers=['source_evidence_requires_semantic_review','canonical_game_entity_identity_not_established','canonical_activity_identity_not_established','repeatability_not_semantically_reviewed','requirements_variants_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
  for(const record of records) {
    const key=record?.candidateKey||'unknown';
    if(record?.contract!=='sensum.activity-candidate-source-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(record?.optimizerEligible!==false||record?.canonicalGameEntityIdentity!==null||record?.canonicalActivityIdentity!==null) add(`record_semantic_gate_weakened:${key}`);
    if(record?.state!=='review_ready') add(`record_state_not_review_ready:${key}`);
    if(record?.semanticIdentityReview?.state!=='unreviewed'||record?.semanticIdentityReview?.disposition!==null||(record?.semanticIdentityReview?.evidenceKeys||[]).length) add(`record_semantic_review_not_closed:${key}`);
    if(record?.repeatabilityReview?.state!=='unreviewed'||record?.repeatabilityReview?.classification!==null||(record?.repeatabilityReview?.evidenceKeys||[]).length) add(`record_repeatability_review_not_closed:${key}`);
    for(const blocker of requiredBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    if(!Object.values(record?.revisionAlignment||{}).length||!Object.values(record.revisionAlignment).every(Boolean)) add(`record_revision_alignment_failed:${key}`);
    if(!Array.isArray(record?.skillKeys)||!record.skillKeys.length||unique(record.skillKeys).length!==record.skillKeys.length) add(`record_skill_scope_invalid:${key}`);
    if(!isSha256(record?.sourceCandidateContentHash)||!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    if(!Number.isInteger(Number(record?.sourcePageId))||!String(record?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')||!Number.isFinite(Date.parse(record?.sourceTimestamp))||!isSha256(record?.sourceContentHash)) add(`record_source_provenance_invalid:${key}`);
    const source=fetched.get(`${record?.sourcePageId}|${record?.sourceRevision}`);
    if(!source||source.title!==record?.resolvedTitle||source.timestamp!==record?.sourceTimestamp||source.contentHash!==record?.sourceContentHash) add(`manifest_fetched_revision_mismatch:${key}`);
    seen.push(key);
    sources.push({providerKey:`wiki-pageid:${record.sourcePageId}`,sourceUrl:record.sourceUrl,title:record.resolvedTitle,sourceRevision:String(record.sourceRevision),sourceTimestamp:record.sourceTimestamp,sourceContentHash:record.sourceContentHash});
  }
  if(unique(seen).length!==seen.length) add('duplicate_record_keys');
  if(fetched.size!==records.length||sources.length!==records.length||unique(sources.map(source=>`${source.sourceUrl}|${source.sourceRevision}`)).length!==records.length) add('manifest_source_coverage_mismatch');
  if(errors.length) throw new Error(`Activity candidate-source materialization input rejected: ${unique(errors).join(', ')}`);

  const statements=records.map(compactStatement);
  const skillKeys=unique(records.flatMap(record=>record.skillKeys)).sort();
  const model={
    contract:ACTIVITY_CANDIDATE_SOURCE_MATERIALIZATION_CONTRACT,domain:ACTIVITY_CANDIDATE_SOURCE_INPUT_DOMAIN,
    snapshotDirectory:manifest.snapshotDirectory,snapshotCreatedAt:manifest.createdAt,snapshotContentHash:manifest.contentHash,auditContentHash:audit.contentHash,
    sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),sources,records,statements,skillKeys,
    counts:{sources:sources.length,records:records.length,statements:statements.length},
    gates:{sourceEvidenceCoverageComplete:true,semanticReviewComplete:false,repeatabilityReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}
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
function metrics(model) {
  return {contract:model.contract,sources:model.counts.sources,records:model.counts.records,statements:model.counts.statements,skillCoverage:model.skillKeys.length,skillKeys:model.skillKeys,recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates};
}

export function buildActivityCandidateSourceMaterializationSql(model) {
  assert(model?.contract===ACTIVITY_CANDIDATE_SOURCE_MATERIALIZATION_CONTRACT,'materialization_contract_mismatch');
  const expectedSources=model.sources.map(source=>`(${sqlText(source.providerKey)},${sqlText(source.sourceUrl)},${sqlText(source.title)},${sqlText(source.sourceRevision)},${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(source.sourceTimestamp)},${sqlText(source.sourceContentHash)})`).join(',\n');
  const expectedRecords=model.records.map(record=>`(${sqlText(record.candidateKey)},${sqlJson(record)},${sqlText(record.sourceUrl)},${sqlText(String(record.sourceRevision))},${sqlText(record.contentHash)},${sqlJson(record.blockers)})`).join(',\n');
  const expectedStatements=model.statements.map(statement=>`(${sqlText(statement.recordKey)},${sqlText(statement.sourceUrl)},${sqlText(statement.sourceRevision)},${sqlTimestamp(statement.sourceTimestamp)},${sqlText(statement.contentHash)},${sqlJson(statement.sourceLocator)},${sqlJson(statement.payload)})`).join(',\n');
  const validationSummary={contract:model.contract,auditContentHash:model.auditContentHash,...model.gates};
  const materializationMetrics=metrics(model);
  return [
    '\\set ON_ERROR_STOP on','BEGIN;',
    `SELECT pg_advisory_xact_lock(hashtextextended(${sqlText(`${model.domain}:${model.snapshotContentHash}`)},0));`,
    'CREATE TEMP TABLE expected_sources(provider_key text,source_url text,title text,source_revision text,fetched_at timestamptz,published_at timestamptz,content_hash text) ON COMMIT DROP;',`INSERT INTO expected_sources VALUES ${expectedSources};`,
    'CREATE TEMP TABLE expected_records(record_key text,payload jsonb,source_url text,source_revision text,content_hash text,findings jsonb) ON COMMIT DROP;',`INSERT INTO expected_records VALUES ${expectedRecords};`,
    'CREATE TEMP TABLE expected_statements(record_key text,source_url text,source_revision text,source_timestamp timestamptz,content_hash text,raw_locator jsonb,parsed_value jsonb) ON COMMIT DROP;',`INSERT INTO expected_statements VALUES ${expectedStatements};`,
    `INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`Accepted activity candidate source evidence ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson(validationSummary)}) ON CONFLICT (manifest_hash) DO NOTHING;`,
    `INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.sourceRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(materializationMetrics)}) ON CONFLICT (id) DO NOTHING;`,
    "INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,provider_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",
    `INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,
    `INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,
    `INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${ACTIVITY_CANDIDATE_SOURCE_FACT_KIND}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,
    buildLineageInsertAndReconciliationSql(model,ACTIVITY_CANDIDATE_SOURCE_FACT_KIND),
    `DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson(validationSummary)}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.sourceRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(materializationMetrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON ${exactWikiSourceReconciliationPredicate()}; IF actual<>${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual<>${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}')<>${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual<>${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}')<>${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${ACTIVITY_CANDIDATE_SOURCE_FACT_KIND}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual<>${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed'; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '\"optimizerEligible\"[[:space:]]*:[[:space:]]*true') THEN RAISE EXCEPTION 'ingestion evidence state gate weakened'; END IF; END $$;`,
    'COMMIT;'
  ].join('\n')+'\n';
}

export function buildActivityCandidateSourceExistingSourceCountQuery(model) { return buildExistingExactWikiSourceCountQuery(model.sources); }
export function buildActivityCandidateSourceReconciliationQuery(model) {
  return `SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM activity_evidence a JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}' WHERE a.fact_kind='${ACTIVITY_CANDIDATE_SOURCE_FACT_KIND}'),'lineage',(SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE ingestion_run_id='${model.runId}'),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`;
}
export function verifyActivityCandidateSourceReconciliation(model,actual) {
  assert(actual?.runId===model.runId,'reconciliation_run_id_mismatch');
  assert(actual?.status==='published','reconciliation_run_not_published');
  for(const key of ['records','sources','statements']) assert(Number(actual?.[key])===model.counts[key],`reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage)===model.counts.statements,'reconciliation_lineage_count_mismatch');
  assert(actual?.snapshotComplete===false,'candidate_source_snapshot_must_not_claim_complete_world_knowledge');
  for(const [key,value] of [['recordHashAggregate',model.recordHashAggregate],['sourceHashAggregate',model.sourceHashAggregate],['statementHashAggregate',model.statementHashAggregate],['materializationHash',model.materializationHash]]) assert(actual?.metrics?.[key]===value,`reconciliation_${key}_mismatch`);
  assert(actual?.metrics?.sourceEvidenceCoverageComplete===true&&actual?.metrics?.semanticReviewComplete===false&&actual?.metrics?.repeatabilityReviewComplete===false&&actual?.metrics?.completeActivityUniverse===false&&Number(actual?.metrics?.optimizerEligibleRecords)===0&&actual?.metrics?.automaticVerification===false&&actual?.metrics?.semanticReviewRequired===true,'reconciliation_semantic_gate_weakened');
  return true;
}
