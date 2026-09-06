import {hash, json} from '../ingestion/lib.mjs';
import {deterministicUuid} from './skill-unlock-materialization-lib.mjs';
import {buildLineageInsertAndReconciliationSql} from './activity-evidence-ingestion-lineage-lib.mjs';
import {
  buildExistingExactWikiSourceCountQuery,
  exactWikiSourceReconciliationPredicate
} from './exact-wiki-source-identity-lib.mjs';

export const ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_MATERIALIZATION_CONTRACT = 'sensum.activity-reference-collection-member-repeatability-evidence-postgresql-materialization.v1';
export const ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_INPUT_DOMAIN = 'activity-reference-collection-member-repeatability-evidence';
export const ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND = 'raw_activity_reference_member_repeatability_evidence';

const isSha256=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const unique=values=>[...new Set(values)];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));
const withoutKeys=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([name])=>!keys.includes(name)));
const accountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const allowedSignalKinds=new Set([
  'explicit_positive_repeatability_declaration_candidate',
  'explicit_negative_repeatability_declaration_candidate',
  'recurrence_structure_candidate',
  'session_boundary_candidate'
]);

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
function signalCount(observation,name) { return Number(observation?.[name]||0); }
function compactStatement(record) {
  const identity=record.canonicalActivityIdentity;
  const observations=record.repeatabilityCandidateObservations;
  const rowScan=record.repeatabilityEvidence.collectionRowScan;
  const payload={
    blockers:record.blockers,
    canonicalActivityIdentity:{
      canonicalActivityKey:identity.canonicalActivityKey,
      canonicalLabel:identity.canonicalLabel,
      identityClass:identity.identityClass,
      evidenceRevisionBoundary:identity.evidenceRevisionBoundary
    },
    mechanicsState:record.mechanicsReview.state,
    memberExpansionState:record.memberExpansionReview.state,
    noLexicalSignalObserved:observations.noLexicalSignalObserved,
    optimizerEligible:false,
    repeatabilityCandidateCounts:{
      explicitNegative:observations.explicitNegativeDeclarationCandidateCount,
      explicitPositive:observations.explicitPositiveDeclarationCandidateCount,
      recurrenceStructure:observations.recurrenceStructureCandidateCount,
      sessionBoundary:observations.sessionBoundaryCandidateCount
    },
    repeatabilityReviewState:record.repeatabilityReview.state,
    repeatabilityVerdict:null,
    sourceLocatedSignalCount:record.repeatabilityEvidence.sourceLocatedSignals.length,
    state:record.state
  };
  const envelope={
    recordKey:record.memberCandidateKey,
    sourceRevision:String(record.sourceRevision),
    sourceLocator:{
      memberCandidateKey:record.memberCandidateKey,
      sourcePageId:record.sourcePageId,
      collectionPageId:rowScan.sourcePageId,
      collectionRevision:String(rowScan.sourceRevision)
    },
    payload
  };
  return {...envelope,sourceUrl:record.sourceUrl,sourceTimestamp:record.sourceTimestamp,contentHash:hash(envelope)};
}

export function validateActivityReferenceMemberRepeatabilityMaterializationInput({raw,manifest,audit}) {
  const errors=[];
  const add=message=>errors.push(message);
  const records=parseRecords(raw,errors);

  if(manifest?.contract!=='sensum.ingestion-manifest.v1') add('manifest_contract_mismatch');
  if(manifest?.domain!==ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_INPUT_DOMAIN) add('manifest_domain_mismatch');
  if(manifest?.source?.kind!=='revision_pinned_complete_linked_source_and_exact_collection_row_repeatability_evidence_candidates_without_semantic_promotion') add('manifest_source_channel_mismatch');
  if(!Number.isFinite(Date.parse(manifest?.createdAt))) add('manifest_created_at_invalid');
  if(!isSha256(manifest?.contentHash)||manifest.contentHash!==hash(raw)) add('snapshot_content_hash_mismatch');
  if(manifest?.records!==records.length||records.length===0) add('manifest_record_count_mismatch');

  if(audit?.contract!=='sensum.activity-reference-collection-member-repeatability-evidence-audit.v1') add('audit_contract_mismatch');
  if(!isSha256(audit?.contentHash)||audit.contentHash!==hash(without(audit,'contentHash'))) add('audit_content_hash_mismatch');
  if(audit?.publishable!==true||audit?.accountIndependent!==true) add('audit_not_accepted_account_independent_evidence');
  if(!audit?.outputSnapshot?.directory||audit?.outputSnapshot?.contentHash!==manifest?.contentHash||(manifest?.snapshotDirectory&&audit.outputSnapshot.directory!==manifest.snapshotDirectory)) add('audit_output_snapshot_mismatch');
  if((audit?.inputSnapshot?.rejections||[]).length||(manifest?.source?.inputSnapshot?.rejections||[]).length) add('audit_upstream_rejections_present');
  if(hash(manifest?.source?.audit)!==hash(withoutKeys(audit||{},['generatedAt','policy','inputSnapshot','outputSnapshot','contentHash']))) add('manifest_embedded_audit_mismatch');

  const input=audit?.inputCoverage||{};
  if(input.expectedCanonicalActivityIdentityCount!==records.length||input.repeatabilityEvidencePacketCount!==records.length||input.exactInputOutputSetAndContextMatch!==true) add('audit_record_coverage_mismatch');
  for(const key of ['duplicateInputMemberCandidateKeys','duplicateOutputMemberCandidateKeys','missingMemberCandidateKeys','unexpectedMemberCandidateKeys','contextMismatchMemberCandidateKeys','structurallyInvalidInputMemberCandidateKeys']) if((input[key]||[]).length) add(`audit_input_set_not_exact:${key}`);
  const sourceAlignment=audit?.sourceAlignment||{};
  if(sourceAlignment.expectedExactRevisionCount!==records.length||sourceAlignment.fetchedExactRevisionCount!==records.length||sourceAlignment.alignedPacketCount!==records.length) add('audit_source_alignment_count_mismatch');
  for(const key of ['duplicateFetchedRevisionIds','missingFetchedRevisionIds','unexpectedFetchedRevisionIds','alignmentFailureMemberCandidateKeys']) if((sourceAlignment[key]||[]).length) add(`audit_source_alignment_invalid:${key}`);
  const policy=audit?.policyCoverage||{};
  if(policy.policy!=='sensum.activity-reference-collection-member-repeatability-evidence-policy.v1'||policy.signalDefinitionCount!==11) add('audit_policy_identity_or_definition_count_mismatch');
  for(const key of ['invalidRules','forbiddenPolicyPaths','duplicateDefinitionKeys','invalidDefinitionKeys','requiredDefinitionKindsMissing']) if((policy[key]||[]).length) add(`audit_policy_gate_invalid:${key}`);
  const coverage=audit?.repeatabilityEvidenceCoverage||{};
  for(const key of ['incompletePacketCount','incompleteMemberCandidateKeys','invalidPacketMemberCandidateKeys','incompleteScanMemberCandidateKeys','invalidSignalMemberCandidateKeys']) {
    const value=coverage[key];
    if(Array.isArray(value)?value.length:Number(value)!==0) add(`audit_repeatability_evidence_invalid:${key}`);
  }
  const promotion=audit?.semanticPromotionCoverage||{};
  for(const key of ['repeatabilityReviewedCount','memberExpansionReviewedCount','mechanicsReviewedCount','optimizerEligibleCount']) if(Number(promotion[key])!==0) add(`audit_semantic_gate_weakened:${key}`);
  if((promotion.unsupportedPromotionMemberCandidateKeys||[]).length) add('audit_unsupported_promotions_present');
  if((audit?.accountStateFindings||[]).length) add('audit_account_state_present');
  if(audit?.evidencePacketAttemptCoverageComplete!==true||audit?.repeatabilityEvidencePacketCoverageComplete!==true||audit?.repeatabilityReviewComplete!==false||audit?.completeActivityUniverse!==false||audit?.absoluteBestGate!=='blocked_incomplete_activity_universe') add('audit_review_or_universe_gate_weakened');
  for(const blocker of ['repeatability_disposition_pending','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established']) if(!(audit?.blockers||[]).includes(blocker)) add(`audit_required_blocker_missing:${blocker}`);

  const fetched=manifest?.source?.fetchedRevisions||[];
  if(fetched.length!==records.length) add('manifest_fetched_revision_count_mismatch');
  const fetchedByIdentity=new Map();
  for(const source of fetched) {
    const key=`${source.pageId}|${source.revision}`;
    if(fetchedByIdentity.has(key)) add(`manifest_duplicate_fetched_revision:${key}`);
    fetchedByIdentity.set(key,source);
  }
  const sourcesByIdentity=new Map();
  const seenRecords=[],seenActivities=[],seenSignals=[];
  const measured={completePackets:0,linkedScans:0,rowScans:0,linkedBytes:0,rowBytes:0,signals:0,explicitPositive:0,explicitNegative:0,recurrence:0,session:0,conflicts:0,zeroSignals:0,verdicts:0};
  const requiredBlockers=['repeatability_disposition_pending','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
  for(const record of records) {
    const key=record?.memberCandidateKey||'unknown';
    if(record?.contract!=='sensum.activity-reference-collection-member-repeatability-evidence.v1') add(`record_contract_mismatch:${key}`);
    if(record?.accountIndependent!==true||containsAccountState(record)) add(`record_account_state_present:${key}`);
    if(record?.canonicalGameEntityIdentity!==null||record?.optimizerEligible!==false) add(`record_semantic_gate_weakened:${key}`);
    if(record?.state!=='repeatability_evidence_packet_complete_review_unperformed') add(`record_state_invalid:${key}`);
    for(const blocker of requiredBlockers) if(!(record?.blockers||[]).includes(blocker)) add(`record_required_blocker_missing:${key}:${blocker}`);
    const identity=record?.canonicalActivityIdentity;
    if(!identity?.canonicalActivityKey||!identity?.canonicalLabel||!identity?.identityClass||identity?.linkedSubjectIsCanonicalActivity!==false||!String(identity?.evidenceRevisionBoundary?.collectionRevision||'')||String(identity?.evidenceRevisionBoundary?.linkedSourceRevision||'')!==String(record?.sourceRevision)) add(`record_canonical_activity_identity_invalid:${key}`);
    if(record?.canonicalActivityIdentityReview?.state!=='reviewed_source_supported'||hash(record?.canonicalActivityIdentityReview?.identity)!==hash(identity)||(record?.canonicalActivityIdentityReview?.evidenceKeys||[]).length===0) add(`record_canonical_activity_review_mismatch:${key}`);
    if(record?.repeatabilityReview?.state!=='unreviewed'||record?.repeatabilityReview?.classification!==null||(record?.repeatabilityReview?.evidenceKeys||[]).length) add(`record_repeatability_review_not_closed:${key}`);
    if(record?.memberExpansionReview?.state!=='unreviewed'||record?.memberExpansionReview?.atomicSubject!==null||(record?.memberExpansionReview?.memberKeys||[]).length||(record?.memberExpansionReview?.evidenceKeys||[]).length) add(`record_member_expansion_review_not_closed:${key}`);
    if(record?.mechanicsReview?.state!=='unreviewed'||(record?.mechanicsReview?.evidenceKeys||[]).length) add(`record_mechanics_review_not_closed:${key}`);
    const evidence=record?.repeatabilityEvidence;
    const observation=record?.repeatabilityCandidateObservations;
    if(evidence?.evidenceState!=='complete_revision_pinned_repeatability_review_packet'||hash(evidence?.canonicalActivityIdentity)!==hash(identity)) add(`record_repeatability_evidence_identity_mismatch:${key}`);
    if(!Object.values(evidence?.sourceAlignment||{}).length||!Object.values(evidence.sourceAlignment).every(Boolean)) add(`record_source_alignment_failed:${key}`);
    if(observation?.observationState!=='source_located_candidates_only_repeatability_unreviewed'||observation?.absenceSemantics!=='no_lexical_signal_does_not_establish_non_repeatability'||observation?.repeatabilityVerdict!==null) add(`record_repeatability_candidate_gate_invalid:${key}`);
    const linked=evidence?.linkedSourceScan;
    if(linked?.completeRevisionContentScanned!==true||linked?.commentsAndProtectedRegionsMasked!==true||Number(linked?.sourcePageId)!==Number(record?.sourcePageId)||String(linked?.sourceRevision)!==String(record?.sourceRevision)||linked?.sourceTimestamp!==record?.sourceTimestamp||linked?.sourceUrl!==record?.sourceUrl||linked?.resolvedTitle!==record?.resolvedTitle||linked?.sourceContentHash!==record?.sourceContentHash||linked?.fetchedContentHash!==record?.sourceContentHash||!Number.isInteger(linked?.scannedLineCount)||!Number.isInteger(linked?.sourceContentBytes)) add(`record_linked_source_scan_invalid:${key}`);
    const row=evidence?.collectionRowScan;
    if(row?.exactRetainedRowScanned!==true||row?.commentsAndProtectedRegionsMasked!==true||String(row?.sourceRevision)!==String(identity?.evidenceRevisionBoundary?.collectionRevision)||!Number.isInteger(Number(row?.sourcePageId))||!String(row?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')||!Number.isFinite(Date.parse(row?.sourceTimestamp))||!isSha256(row?.sourceContentHash)||!isSha256(row?.rowTextHash)||!Number.isInteger(row?.scannedLineCount)||!Number.isInteger(row?.sourceContentBytes)) add(`record_collection_row_scan_invalid:${key}`);
    const fetchedSource=fetchedByIdentity.get(`${record?.sourcePageId}|${record?.sourceRevision}`);
    if(!fetchedSource||fetchedSource.title!==record?.resolvedTitle||fetchedSource.timestamp!==record?.sourceTimestamp||fetchedSource.contentHash!==record?.sourceContentHash) add(`record_fetched_revision_alignment_missing:${key}`);
    const source={providerKey:`wiki-pageid:${record.sourcePageId}`,sourceUrl:record.sourceUrl,title:record.resolvedTitle,sourceRevision:String(record.sourceRevision),sourceTimestamp:record.sourceTimestamp,sourceContentHash:record.sourceContentHash};
    const sourceKey=sourceIdentity(source),existing=sourcesByIdentity.get(sourceKey);
    if(existing&&json(existing)!==json(source)) add(`record_source_identity_conflict:${key}`); else sourcesByIdentity.set(sourceKey,source);
    const signals=evidence?.sourceLocatedSignals||[];
    for(const signal of signals) {
      const signalKey=signal?.evidenceKey||'unknown';
      const scan=signal?.sourceScope==='complete_linked_source_revision'?linked:signal?.sourceScope==='exact_collection_row'?row:null;
      if(!scan||!allowedSignalKinds.has(signal?.signalKind)||!signal?.definitionKey||!signal?.matchedText||!signal?.contextText||signal?.reviewState!=='candidate_only_not_a_repeatability_verdict'||!isSha256(signal?.sourceContentHash)||!isSha256(signal?.scannedTextHash)||String(signal?.sourceRevision)!==String(scan?.sourceRevision)||Number(signal?.sourcePageId)!==Number(scan?.sourcePageId)||signal?.sourceContentHash!==scan?.sourceContentHash||!Number.isInteger(signal?.sourceLocator?.lineStart)||!Number.isInteger(signal?.sourceLocator?.lineEnd)) add(`record_repeatability_signal_invalid:${key}:${signalKey}`);
      seenSignals.push(signalKey);
    }
    if(!isSha256(record?.contentHash)||record.contentHash!==hash(without(record,'contentHash'))) add(`record_content_hash_mismatch:${key}`);
    for(const [name,value] of Object.entries(record||{})) if(name.endsWith('ContentHash')&&!isSha256(value)) add(`record_provenance_hash_invalid:${key}:${name}`);
    if(!Number.isInteger(Number(record?.sourcePageId))||!record?.resolvedTitle||!String(record?.sourceUrl||'').startsWith('https://oldschool.runescape.wiki/w/')||!Number.isFinite(Date.parse(record?.sourceTimestamp))||!isSha256(record?.sourceContentHash)) add(`record_source_provenance_invalid:${key}`);
    measured.completePackets++;
    measured.linkedScans++;
    measured.rowScans++;
    measured.linkedBytes+=Number(linked?.sourceContentBytes||0);
    measured.rowBytes+=Number(row?.sourceContentBytes||0);
    measured.signals+=signals.length;
    measured.explicitPositive+=signalCount(observation,'explicitPositiveDeclarationCandidateCount');
    measured.explicitNegative+=signalCount(observation,'explicitNegativeDeclarationCandidateCount');
    measured.recurrence+=signalCount(observation,'recurrenceStructureCandidateCount');
    measured.session+=signalCount(observation,'sessionBoundaryCandidateCount');
    measured.conflicts+=observation?.positiveNegativeConflictCandidate===true?1:0;
    measured.zeroSignals+=observation?.noLexicalSignalObserved===true?1:0;
    measured.verdicts+=observation?.repeatabilityVerdict===null?0:1;
    seenRecords.push(key);
    seenActivities.push(identity.canonicalActivityKey);
  }
  if(unique(seenRecords).length!==seenRecords.length) add('duplicate_record_keys');
  if(unique(seenActivities).length!==seenActivities.length) add('duplicate_canonical_activity_keys');
  if(unique(seenSignals).length!==seenSignals.length) add('duplicate_repeatability_signal_keys');
  if(fetchedByIdentity.size!==sourcesByIdentity.size||[...fetchedByIdentity.keys()].some(key=>!records.some(record=>`${record.sourcePageId}|${record.sourceRevision}`===key))) add('manifest_fetched_revision_set_mismatch');
  if(Number(coverage.completePacketCount)!==measured.completePackets||Number(coverage.completeLinkedSourceScanCount)!==measured.linkedScans||Number(coverage.exactCollectionRowScanCount)!==measured.rowScans||Number(coverage.linkedSourceBytesScanned)!==measured.linkedBytes||Number(coverage.collectionRowBytesScanned)!==measured.rowBytes||Number(coverage.sourceLocatedSignalCount)!==measured.signals) add('audit_repeatability_evidence_counts_do_not_reconcile');
  const observations=audit?.candidateObservationCoverage||{};
  if(Number(observations.explicitPositiveDeclarationCandidateCount)!==measured.explicitPositive||Number(observations.explicitNegativeDeclarationCandidateCount)!==measured.explicitNegative||Number(observations.recurrenceStructureCandidateCount)!==measured.recurrence||Number(observations.sessionBoundaryCandidateCount)!==measured.session||Number(observations.positiveNegativeConflictCandidateCount)!==measured.conflicts||Number(observations.zeroSignalPacketCount)!==measured.zeroSignals||Number(observations.repeatabilityVerdictCount)!==measured.verdicts) add('audit_repeatability_candidate_counts_do_not_reconcile');
  if(errors.length) throw new Error(`Activity reference-member repeatability materialization input rejected: ${unique(errors).join(', ')}`);

  const sources=[...sourcesByIdentity.values()].sort((a,b)=>sourceIdentity(a).localeCompare(sourceIdentity(b)));
  const statements=records.map(compactStatement);
  const model={
    contract:ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_MATERIALIZATION_CONTRACT,
    domain:ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_INPUT_DOMAIN,
    snapshotDirectory:audit.outputSnapshot.directory,
    snapshotCreatedAt:manifest.createdAt,
    snapshotContentHash:manifest.contentHash,
    auditContentHash:audit.contentHash,
    sourceRevision:sources.map(row=>row.sourceRevision).sort().join(','),
    sources,records,statements,skillKeys:[],
    counts:{sources:sources.length,records:records.length,statements:statements.length,signals:measured.signals,canonicalActivities:seenActivities.length},
    gates:{evidencePacketAttemptCoverageComplete:true,repeatabilityEvidencePacketCoverageComplete:true,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false,semanticReviewRequired:true}
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

export function buildActivityReferenceMemberRepeatabilityMaterializationSql(model) {
  assert(model?.contract===ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_MATERIALIZATION_CONTRACT,'materialization_contract_mismatch');
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
    `INSERT INTO data_snapshots(id,label,manifest_hash,complete,validation_summary) VALUES ('${model.snapshotId}',${sqlText(`Accepted repeatability review evidence ${model.snapshotDirectory}`)},${sqlText(model.snapshotContentHash)},false,${sqlJson(validationSummary)}) ON CONFLICT (manifest_hash) DO NOTHING;`,
    `INSERT INTO ingestion_runs(id,domain,status,source_kind,started_at,finished_at,record_count,source_revision,content_hash,raw_object_uri,metrics) VALUES ('${model.runId}',${sqlText(model.domain)},'published','osrs_wiki',${sqlTimestamp(model.snapshotCreatedAt)},${sqlTimestamp(model.snapshotCreatedAt)},${model.counts.records},${sqlText(model.sourceRevision)},${sqlText(model.snapshotContentHash)},${sqlText(`.platform-data/${model.snapshotDirectory}/${model.domain}.ndjson`)},${sqlJson(materializationMetrics)}) ON CONFLICT (id) DO NOTHING;`,
    "INSERT INTO data_sources(kind,canonical_url,title,provider_key,revision_key,fetched_at,published_at,content_hash,state) SELECT 'osrs_wiki',source_url,title,provider_key,source_revision,fetched_at,published_at,content_hash,'review' FROM expected_sources ON CONFLICT (kind,canonical_url,revision_key) DO NOTHING;",
    `INSERT INTO snapshot_sources(snapshot_id,source_id) SELECT '${model.snapshotId}',d.id FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT DO NOTHING;`,
    `INSERT INTO ingestion_records(run_id,record_key,payload,source_url,source_revision,content_hash,state,findings) SELECT '${model.runId}',record_key,payload,source_url,source_revision,content_hash,'review',findings FROM expected_records ON CONFLICT (run_id,record_key) DO NOTHING;`,
    `INSERT INTO activity_evidence(record_key,fact_kind,state,raw_locator,parsed_value,source_id,source_revision,source_timestamp,content_hash) SELECT e.record_key,'${ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND}','candidate',e.raw_locator,e.parsed_value,d.id,e.source_revision,e.source_timestamp,e.content_hash FROM expected_statements e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision ON CONFLICT (record_key,fact_kind,source_revision) DO NOTHING;`,
    buildLineageInsertAndReconciliationSql(model,ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND),
    `DO $$ DECLARE actual integer; BEGIN IF NOT EXISTS (SELECT 1 FROM data_snapshots WHERE id='${model.snapshotId}' AND manifest_hash=${sqlText(model.snapshotContentHash)} AND complete=false AND validation_summary=${sqlJson(validationSummary)}) THEN RAISE EXCEPTION 'data snapshot reconciliation failed'; END IF; IF NOT EXISTS (SELECT 1 FROM ingestion_runs WHERE id='${model.runId}' AND domain=${sqlText(model.domain)} AND status='published' AND source_kind='osrs_wiki' AND record_count=${model.counts.records} AND source_revision=${sqlText(model.sourceRevision)} AND content_hash=${sqlText(model.snapshotContentHash)} AND metrics=${sqlJson(materializationMetrics)}) THEN RAISE EXCEPTION 'ingestion run reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON ${exactWikiSourceReconciliationPredicate()}; IF actual<>${model.counts.sources} THEN RAISE EXCEPTION 'source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_sources e JOIN data_sources d ON d.kind='osrs_wiki' AND d.canonical_url=e.source_url AND d.revision_key=e.source_revision JOIN snapshot_sources ss ON ss.source_id=d.id AND ss.snapshot_id='${model.snapshotId}'; IF actual<>${model.counts.sources} OR (SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}')<>${model.counts.sources} THEN RAISE EXCEPTION 'snapshot source reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key AND r.payload=e.payload AND r.source_url=e.source_url AND r.source_revision=e.source_revision AND r.content_hash=e.content_hash AND r.state='review' AND r.findings=e.findings; IF actual<>${model.counts.records} OR (SELECT count(*) FROM ingestion_records WHERE run_id='${model.runId}')<>${model.counts.records} THEN RAISE EXCEPTION 'ingestion record reconciliation failed'; END IF; SELECT count(*) INTO actual FROM expected_statements e JOIN activity_evidence a ON a.record_key=e.record_key AND a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND}' AND a.state='candidate' AND a.raw_locator=e.raw_locator AND a.parsed_value=e.parsed_value AND a.source_revision=e.source_revision AND a.source_timestamp=e.source_timestamp AND a.content_hash=e.content_hash; IF actual<>${model.counts.statements} THEN RAISE EXCEPTION 'statement reconciliation failed'; END IF; IF EXISTS (SELECT 1 FROM expected_records e JOIN ingestion_records r ON r.run_id='${model.runId}' AND r.record_key=e.record_key WHERE r.payload::text ~* '\"optimizerEligible\"[[:space:]]*:[[:space:]]*true' OR r.payload::text ~* '\"repeatabilityVerdict\"[[:space:]]*:[[:space:]]*\"' OR r.payload::text ~* '\"repeatabilityReview\"[[:space:]]*:[[:space:]]*\\{[^}]*\"state\"[[:space:]]*:[[:space:]]*\"reviewed') THEN RAISE EXCEPTION 'ingestion repeatability gate weakened'; END IF; END $$;`,
    'COMMIT;'
  ].join('\n')+'\n';
}

export function buildActivityReferenceMemberRepeatabilityExistingSourceCountQuery(model) { return buildExistingExactWikiSourceCountQuery(model.sources); }
export function buildActivityReferenceMemberRepeatabilityReconciliationQuery(model) {
  return `SELECT json_build_object('runId',r.id,'status',r.status,'records',(SELECT count(*) FROM ingestion_records WHERE run_id=r.id),'sources',(SELECT count(*) FROM snapshot_sources WHERE snapshot_id='${model.snapshotId}'),'statements',(SELECT count(*) FROM activity_evidence a JOIN activity_evidence_ingestion_lineage l ON l.activity_evidence_id=a.id AND l.ingestion_run_id='${model.runId}' WHERE a.fact_kind='${ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND}'),'lineage',(SELECT count(*) FROM activity_evidence_ingestion_lineage WHERE ingestion_run_id='${model.runId}'),'metrics',r.metrics,'snapshotComplete',(SELECT complete FROM data_snapshots WHERE id='${model.snapshotId}')) FROM ingestion_runs r WHERE r.id='${model.runId}';`;
}
export function verifyActivityReferenceMemberRepeatabilityReconciliation(model,actual) {
  assert(actual?.runId===model.runId,'reconciliation_run_id_mismatch');
  assert(actual?.status==='published','reconciliation_run_not_published');
  for(const key of ['records','sources','statements']) assert(Number(actual?.[key])===model.counts[key],`reconciliation_${key}_count_mismatch`);
  assert(Number(actual?.lineage)===model.counts.statements,'reconciliation_lineage_count_mismatch');
  assert(actual?.snapshotComplete===false,'repeatability_evidence_snapshot_must_not_claim_complete_world_knowledge');
  for(const [key,value] of [['recordHashAggregate',model.recordHashAggregate],['sourceHashAggregate',model.sourceHashAggregate],['statementHashAggregate',model.statementHashAggregate],['materializationHash',model.materializationHash]]) assert(actual?.metrics?.[key]===value,`reconciliation_${key}_mismatch`);
  assert(actual?.metrics?.evidencePacketAttemptCoverageComplete===true&&actual?.metrics?.repeatabilityEvidencePacketCoverageComplete===true&&actual?.metrics?.repeatabilityReviewComplete===false&&actual?.metrics?.memberExpansionReviewComplete===false&&actual?.metrics?.mechanicsReviewComplete===false&&actual?.metrics?.completeActivityUniverse===false&&Number(actual?.metrics?.optimizerEligibleRecords)===0&&actual?.metrics?.automaticVerification===false&&actual?.metrics?.semanticReviewRequired===true,'reconciliation_semantic_gate_weakened');
  return true;
}
