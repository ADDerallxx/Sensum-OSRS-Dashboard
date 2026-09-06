import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import {
  auditRenderedPageWithoutUnlockReconciliationWorkQueue,
  renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown
} from './cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-lib.mjs';

const SOURCE_CONTRACT = 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-entry.v1';
const CANDIDATE_CONTRACT = 'sensum.cross-source-entity-activity-candidate.v1';
const HISTORICAL_CHANNEL = 'historical_rendered_expansion_dependency_attribution';
const HISTORICAL_PRESENCE = 'rendered_only_origin_unattributed';
const HISTORICAL_PARTITIONS = ['mixed_direct_and_unattributed_rendered', 'rendered_only_origin_unattributed'];
const ALLOWED_DISPOSITIONS = [
  'confirm_complete_historical_dependency_attribution',
  'reject_proposed_historical_dependency_attribution',
  'historical_dependency_evidence_unavailable'
];
const REQUIRED_EVIDENCE = [
  'exact_historical_guide_revision_and_content_hash',
  'exact_generating_dependency_identity_type_revision_and_content_hash',
  'source_locator_or_parameter_proving_the_dependency_emitted_the_observation',
  'exact_parser_channel_requested_title_and_rendered_target_binding'
];
const NON_CLAIMS = [
  'current_dependency_graph_matches_the_historical_guide_revision',
  'rendered_observation_origin_is_known',
  'dependency_revision_is_known',
  'rendered_target_is_semantically_relevant_to_a_skill',
  'rendered_target_is_a_canonical_game_entity_or_activity',
  'rendered_target_is_repeatable',
  'requirements_variants_xp_timing_or_mechanics_are_complete',
  'rendered_target_is_optimizer_eligible'
];
const REQUIRED_RULES = [
  'everySourceQueueRecordRequiringHistoricalAttributionMustEnterExactlyOnce',
  'sourceQueuePolicyManifestSnapshotOuterIntrinsicPartitionAndCandidateBindingsMustRevalidate',
  'onlyMixedOrRenderedOnlyRoutesMayRequireHistoricalAttribution',
  'oneOutputEntryMustBindOneSourceQueueRecordAndOneCandidate',
  'queueOrderMustPreserveTheFilteredAuthoritativeSourceQueueOrder',
  'everyRenderedOnlyObservationMustBePreservedExactlyOnce',
  'directSourceObservationsMustNotEnterTheHistoricalAttributionObservationSet',
  'historicalGuideRevisionBindingsMustDeriveOnlyFromPreservedObservations',
  'currentDependencyGraphsCannotSubstituteForHistoricalRevisionLineage',
  'missingDependencyRevisionOrGenerativeOriginMustRemainAnExplicitBlocker',
  'blankDecisionTemplatesCannotApplyAnAttributionDecision',
  'queueExportCannotEstablishAttributionRequirementSemanticIdentityRepeatabilityMechanicsOrOptimizerState',
  'titlesNamespacesPageIdsParserChannelsAliasesAndOverridesCannotAlterWorkRouting',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const exactRevisionUrl = revision => `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}`;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:titleOverrides|namespaceOverrides|pageIdOverrides|parserChannelOverrides|aliasOverrides|partitionOverrides|targetOverrides|exceptions|overrides)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  visit(policy);
  return unique(findings).sort();
}

export function compileHistoricalAttributionWorkQueuePolicy(policy = {}, contentHash = hash) {
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-policy.v1' &&
    policy.inputWorkQueueContract === SOURCE_CONTRACT && policy.inputCandidateContract === CANDIDATE_CONTRACT &&
    policy.outputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-entry.v1' &&
    policy.decisionTemplateContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-decision-template.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-historical-attribution-work-queue-export-audit.v1';
  const inputPoliciesValid = policy.inputWorkQueuePolicy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-policy.v1' &&
    validHash(policy.inputWorkQueuePolicyContentHash) && policy.inputPartitionPolicy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-partition-policy.v1' &&
    validHash(policy.inputPartitionPolicyContentHash);
  const vocabularyValid = policy.requiredEvidenceChannel === HISTORICAL_CHANNEL &&
    policy.historicalObservationSourcePresence === HISTORICAL_PRESENCE &&
    same(policy.allowedReviewDispositions || [], ALLOWED_DISPOSITIONS, contentHash) &&
    same(policy.requiredAttributionEvidence || [], REQUIRED_EVIDENCE, contentHash) && same(policy.nonClaims || [], NON_CLAIMS, contentHash);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && inputPoliciesValid && vocabularyValid && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid, inputPoliciesValid, vocabularyValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden
  };
}

function outerHashValid(record, contentHash = hash) {
  return validHash(record?.contentHash) && record.contentHash === contentHash(without(record, 'contentHash'));
}

function sourceIntrinsicHashValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && record.recordContentHash === contentHash(without(record, 'contentHash', 'recordContentHash'));
}

function sourceGatesClosed(record = {}) {
  const evidence = record.evidenceCollection || {};
  return record.unlockEvidencePresent === false && record.semanticDisposition === null && record.canonicalGameEntityIdentity === null &&
    record.canonicalActivityIdentity === null && record.repeatabilityClassification === null && record.mechanicsReviewComplete === false &&
    record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true &&
    Array.isArray(evidence.evidenceKeys) && evidence.evidenceKeys.length === 0 &&
    evidence.historicalRenderedExpansionDependencyAttribution === null;
}

function candidateGatesClosed(record = {}) {
  return record.contract === CANDIDATE_CONTRACT && record.candidateKind === 'rendered_page_without_unlock_match' &&
    record.sourceContexts?.crossSourcePageIdentityEstablished === false && record.sourceContexts?.unlockEvidence === null &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.optimizerEligible === false && record.accountIndependent === true;
}

function observationValid(observation = {}) {
  return Number.isInteger(observation.guidePageId) && observation.guidePageId > 0 && /^\d+$/.test(String(observation.guideRevision || '')) &&
    validHash(observation.guideContentHash) && typeof observation.guideTitle === 'string' && observation.guideTitle.length > 0 &&
    Number.isInteger(observation.namespaceId) && ['links', 'categories', 'images'].includes(observation.parserChannel) &&
    typeof observation.requestedTitle === 'string' && observation.requestedTitle.length > 0 &&
    observation.resolutionState === 'current_revision_pinned_page' && observation.sourcePresence === HISTORICAL_PRESENCE;
}

function historicalObservations(candidate = {}, contentHash = hash) {
  return (candidate.sourceContexts?.renderedEvidence?.observations || []).filter(row => row.sourcePresence === HISTORICAL_PRESENCE).map(observation => ({
    observationKey: contentHash({ renderedTargetKey: candidate.renderedTargetKey, observation }),
    observationContentHash: contentHash(observation),
    exactGuideRevisionUrl: exactRevisionUrl(observation.guideRevision),
    observation
  }));
}

function historicalGuideRevisionBindings(observations = [], contentHash = hash) {
  const groups = new Map();
  for (const row of observations) {
    const observation = row.observation;
    const key = `${observation.guidePageId}|${observation.guideRevision}|${observation.guideContentHash}`;
    if (!groups.has(key)) groups.set(key, {
      guidePageId: observation.guidePageId,
      guideTitle: observation.guideTitle,
      guideRevision: observation.guideRevision,
      guideContentHash: observation.guideContentHash,
      exactGuideRevisionUrl: row.exactGuideRevisionUrl,
      observationKeys: []
    });
    groups.get(key).observationKeys.push(row.observationKey);
  }
  return [...groups.values()].map(group => ({ ...group, observationCount: group.observationKeys.length, bindingContentHash: contentHash(group) }));
}

function expectedRecord(source, candidate, policy, snapshots, ordinal, contentHash = hash) {
  const observations = historicalObservations(candidate, contentHash);
  const bindings = historicalGuideRevisionBindings(observations, contentHash);
  const base = {
    contract: policy.outputContract,
    historicalAttributionWorkEntryKey: `${source.workQueueEntryKey}|historical-rendered-attribution-work`,
    queueOrdinal: ordinal,
    sourceWorkQueueOrdinal: source.queueOrdinal,
    sourceWorkQueueEntryKey: source.workQueueEntryKey,
    sourceWorkQueueRecordContentHash: source.contentHash,
    sourceWorkQueueIntrinsicRecordContentHash: source.recordContentHash,
    sourceWorkQueueSnapshotContentHash: snapshots.workQueue,
    sourcePartitionSnapshotContentHash: source.sourcePartitionSnapshotContentHash,
    sourceCandidateContentHash: candidate.contentHash,
    sourceCandidateSnapshotContentHash: snapshots.candidate,
    renderedTargetKey: source.renderedTargetKey,
    stableWikiPageIdentity: source.stableWikiPageIdentity,
    provenancePartition: source.provenancePartition,
    requiredEvidenceChannel: HISTORICAL_CHANNEL,
    guideObservationCount: source.guideObservationCount,
    historicalRenderedObservationCount: observations.length,
    historicalRenderedObservationSetContentHash: contentHash(observations),
    historicalRenderedObservations: observations,
    historicalGuideRevisionBindingCount: bindings.length,
    historicalGuideRevisionBindingsContentHash: contentHash(bindings),
    historicalGuideRevisionBindings: bindings,
    requiredAttributionEvidence: policy.requiredAttributionEvidence,
    nonClaims: policy.nonClaims,
    historicalRenderedExpansionDependencyAttribution: null,
    attributionEvidenceKeys: [],
    reviewDecision: null,
    requirementOrUnlockApplied: false,
    semanticDisposition: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: [
      'historical_rendered_expansion_dependency_attribution_pending',
      'historical_dependency_revision_and_generative_origin_unavailable',
      'current_dependency_graph_cannot_substitute_for_historical_revision_lineage',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ],
    state: 'blocked_pending_historical_rendered_expansion_dependency_attribution'
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function expectedDecisionTemplate(record, policy) {
  return {
    contract: policy.decisionTemplateContract,
    historicalAttributionWorkEntryKey: record.historicalAttributionWorkEntryKey,
    renderedTargetKey: record.renderedTargetKey,
    sourceWorkQueueRecordContentHash: record.sourceWorkQueueRecordContentHash,
    sourceCandidateContentHash: record.sourceCandidateContentHash,
    historicalRenderedObservationSetContentHash: record.historicalRenderedObservationSetContentHash,
    disposition: null,
    observationAttributions: [],
    evidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    notes: null
  };
}

function outputGatesClosed(record = {}) {
  return record.historicalRenderedExpansionDependencyAttribution === null && Array.isArray(record.attributionEvidenceKeys) &&
    record.attributionEvidenceKeys.length === 0 && record.reviewDecision === null && record.requirementOrUnlockApplied === false &&
    record.semanticDisposition === null && record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.mechanicsReviewComplete === false && record.optimizerEligible === false &&
    record.automaticVerificationApplied === false && record.accountIndependent === true;
}

function sourceManifestsValid({ sources = {}, snapshots = {}, policy = {}, sourceWorkQueuePolicy = {}, partitionPolicy = {}, workQueueRecords = [], partitionRecords = [], candidateRecords = [], contentHash = hash } = {}) {
  const work = sources.workQueue || {}, partition = sources.partition || {}, candidate = sources.candidate || {};
  return work.domain === 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue' && work.records === workQueueRecords.length &&
    work.contentHash === snapshots.workQueue && work.source?.policy?.id === policy.inputWorkQueuePolicy &&
    work.source?.policy?.contentHash === policy.inputWorkQueuePolicyContentHash && contentHash(sourceWorkQueuePolicy) === policy.inputWorkQueuePolicyContentHash &&
    work.source?.partitionPolicy?.id === policy.inputPartitionPolicy && work.source?.partitionPolicy?.contentHash === policy.inputPartitionPolicyContentHash &&
    contentHash(partitionPolicy) === policy.inputPartitionPolicyContentHash && work.source?.inputPartitionSnapshot?.contentHash === snapshots.partition &&
    work.source?.inputCandidateSnapshot?.contentHash === snapshots.candidate && work.source?.audit?.queueExportComplete === true &&
    work.source?.audit?.publishable === true && work.source?.audit?.reconciliationComplete === false && work.source?.audit?.completeActivityUniverse === false &&
    partition.domain === 'cross-skill-rendered-page-without-unlock-evidence-partition' && partition.records === partitionRecords.length && partition.contentHash === snapshots.partition &&
    partition.source?.audit?.partitionComplete === true && partition.source?.audit?.publishable === true && partition.source?.audit?.completeActivityUniverse === false &&
    candidate.domain === 'cross-source-entity-activity-candidate' && candidate.records === candidateRecords.length && candidate.contentHash === snapshots.candidate &&
    candidate.source?.audit?.candidateInventoryComplete === true && candidate.source?.audit?.publishable === true && candidate.source?.audit?.completeActivityUniverse === false;
}

function analyzeInputs(input = {}) {
  const { workQueueRecords = [], partitionRecords = [], candidateRecords = [], policy = {}, sourceWorkQueuePolicy = {}, partitionPolicy = {}, snapshots = {}, sources = {}, contentHash = hash } = input;
  const compiled = compileHistoricalAttributionWorkQueuePolicy(policy, contentHash);
  const snapshotHashesValid = ['workQueue', 'partition', 'candidate'].every(key => validHash(snapshots[key]));
  const manifestsValid = sourceManifestsValid(input);
  const bareWorkQueue = workQueueRecords.map(row => without(row, 'contentHash'));
  const upstream = auditRenderedPageWithoutUnlockReconciliationWorkQueue(bareWorkQueue, {
    partitionRecords, candidateRecords, policy: sourceWorkQueuePolicy, partitionPolicy,
    partitionSnapshotContentHash: snapshots.partition, candidateSnapshotContentHash: snapshots.candidate,
    markdown: renderRenderedPageWithoutUnlockReconciliationWorkQueueMarkdown(bareWorkQueue), contentHash
  });
  const workQueueOuterHashMismatchKeys = workQueueRecords.filter(row => !outerHashValid(row, contentHash)).map(row => row.workQueueEntryKey);
  const workQueueIntrinsicHashMismatchKeys = workQueueRecords.filter(row => !sourceIntrinsicHashValid(row, contentHash)).map(row => row.workQueueEntryKey);
  const workQueueContractMismatchKeys = workQueueRecords.filter(row => row.contract !== SOURCE_CONTRACT).map(row => row.workQueueEntryKey);
  const workQueuePromotionKeys = workQueueRecords.filter(row => !sourceGatesClosed(row)).map(row => row.workQueueEntryKey);
  const invalidSourceOrdinals = workQueueRecords.filter((row, index) => row.queueOrdinal !== index + 1).map(row => row.workQueueEntryKey);
  const duplicateSourceKeys = duplicates(workQueueRecords.map(row => row.workQueueEntryKey));
  const candidateOuterHashMismatchKeys = candidateRecords.filter(row => !outerHashValid(row, contentHash)).map(row => row.renderedTargetKey);
  const boundTargetKeys = new Set(workQueueRecords.map(row => row.renderedTargetKey));
  const boundCandidates = candidateRecords.filter(row => boundTargetKeys.has(row.renderedTargetKey));
  const candidateGateMismatchKeys = boundCandidates.filter(row => !candidateGatesClosed(row)).map(row => row.renderedTargetKey);
  const duplicateCandidateKeys = duplicates(candidateRecords.map(row => row.renderedTargetKey));
  const candidateByTarget = new Map(candidateRecords.map(row => [row.renderedTargetKey, row]));
  const candidateBindingMismatchKeys = workQueueRecords.filter(row => {
    const candidate = candidateByTarget.get(row.renderedTargetKey);
    return !candidate || row.sourceCandidateContentHash !== candidate.contentHash || row.sourceCandidateSnapshotContentHash !== snapshots.candidate ||
      row.sourcePartitionSnapshotContentHash !== snapshots.partition || row.guideObservationCount !== candidate.sourceContexts?.renderedEvidence?.guideObservationCount ||
      !same(row.stableWikiPageIdentity, candidate.sourceContexts?.renderedEvidence?.targetPageIdentity, contentHash);
  }).map(row => row.workQueueEntryKey);
  const historicalSources = workQueueRecords.filter(row => row.historicalRenderedAttributionRequired === true || row.requiredEvidenceChannels?.includes(HISTORICAL_CHANNEL));
  const historicalRouteMismatchKeys = historicalSources.filter(row => row.historicalRenderedAttributionRequired !== true ||
    !row.requiredEvidenceChannels?.includes(HISTORICAL_CHANNEL) || !HISTORICAL_PARTITIONS.includes(row.provenancePartition)).map(row => row.workQueueEntryKey);
  const unexpectedHistoricalFlags = workQueueRecords.filter(row => !HISTORICAL_PARTITIONS.includes(row.provenancePartition) &&
    (row.historicalRenderedAttributionRequired === true || row.requiredEvidenceChannels?.includes(HISTORICAL_CHANNEL))).map(row => row.workQueueEntryKey);
  const historicalObservationInvalidKeys = [];
  const historicalObservationEmptyKeys = [];
  const historicalObservationCountMismatchKeys = [];
  for (const source of historicalSources) {
    const candidate = candidateByTarget.get(source.renderedTargetKey);
    if (!candidate) continue;
    const observations = historicalObservations(candidate, contentHash);
    if (!observations.length) historicalObservationEmptyKeys.push(source.workQueueEntryKey);
    if (observations.some(row => !observationValid(row.observation))) historicalObservationInvalidKeys.push(source.workQueueEntryKey);
    const declared = candidate.sourceContexts?.renderedEvidence?.sourcePresenceCounts?.[HISTORICAL_PRESENCE];
    if (declared !== observations.length || source.sourcePresenceCounts?.[HISTORICAL_PRESENCE] !== observations.length) historicalObservationCountMismatchKeys.push(source.workQueueEntryKey);
  }
  const accountStateFindings = findAccountState([workQueueRecords, partitionRecords, candidateRecords]);
  const valid = compiled.valid && snapshotHashesValid && manifestsValid && upstream.publishable === true &&
    workQueueOuterHashMismatchKeys.length === 0 && workQueueIntrinsicHashMismatchKeys.length === 0 && workQueueContractMismatchKeys.length === 0 &&
    workQueuePromotionKeys.length === 0 && invalidSourceOrdinals.length === 0 && duplicateSourceKeys.length === 0 &&
    candidateOuterHashMismatchKeys.length === 0 && candidateGateMismatchKeys.length === 0 && duplicateCandidateKeys.length === 0 &&
    candidateBindingMismatchKeys.length === 0 && historicalSources.length > 0 && historicalRouteMismatchKeys.length === 0 &&
    unexpectedHistoricalFlags.length === 0 && historicalObservationInvalidKeys.length === 0 && historicalObservationEmptyKeys.length === 0 &&
    historicalObservationCountMismatchKeys.length === 0 && accountStateFindings.length === 0;
  return {
    valid, compiled, upstream, historicalSources, candidateByTarget, snapshotHashesValid, manifestsValid,
    workQueueOuterHashMismatchKeys, workQueueIntrinsicHashMismatchKeys, workQueueContractMismatchKeys, workQueuePromotionKeys,
    invalidSourceOrdinals, duplicateSourceKeys, candidateOuterHashMismatchKeys, candidateGateMismatchKeys, duplicateCandidateKeys,
    candidateBindingMismatchKeys, historicalRouteMismatchKeys, unexpectedHistoricalFlags, historicalObservationInvalidKeys,
    historicalObservationEmptyKeys, historicalObservationCountMismatchKeys, accountStateFindings
  };
}

function expectedRecords(input, analysis) {
  return analysis.historicalSources.map((source, index) => expectedRecord(source, analysis.candidateByTarget.get(source.renderedTargetKey), input.policy, input.snapshots, index + 1, input.contentHash || hash));
}

export function renderHistoricalAttributionQueueTsv(records = []) {
  const clean = value => String(value ?? '').replace(/[\t\r\n]+/g, ' ');
  const lines = ['ordinal\ttarget_title\ttarget_page_id\ttarget_revision\tprovenance_partition\tall_guide_observations\thistorical_rendered_observations\thistorical_guide_revisions\tstate'];
  for (const row of records) lines.push([
    row.queueOrdinal, row.stableWikiPageIdentity?.resolvedTitle, row.stableWikiPageIdentity?.sourcePageId,
    row.stableWikiPageIdentity?.sourceRevision, row.provenancePartition, row.guideObservationCount,
    row.historicalRenderedObservationCount, row.historicalGuideRevisionBindingCount, row.state
  ].map(clean).join('\t'));
  return lines.join('\n') + '\n';
}

export function renderHistoricalAttributionBlankDecisions(records = [], policy = {}) {
  return records.map(row => JSON.stringify(expectedDecisionTemplate(row, policy))).join('\n') + (records.length ? '\n' : '');
}

export function buildHistoricalAttributionWorkQueue(input = {}) {
  const contentHash = input.contentHash || hash;
  const analysis = analyzeInputs({ ...input, contentHash });
  const records = analysis.valid ? expectedRecords({ ...input, contentHash }, analysis) : [];
  const artifacts = {
    queueTsv: renderHistoricalAttributionQueueTsv(records),
    blankDecisions: renderHistoricalAttributionBlankDecisions(records, input.policy)
  };
  const audit = auditHistoricalAttributionWorkQueue(records, { ...input, contentHash, artifacts });
  if (audit.publishable) return { records, artifacts, audit };
  const emptyArtifacts = { queueTsv: renderHistoricalAttributionQueueTsv([]), blankDecisions: '' };
  return { records: [], artifacts: emptyArtifacts, audit: auditHistoricalAttributionWorkQueue([], { ...input, contentHash, artifacts: emptyArtifacts }) };
}

export function auditHistoricalAttributionWorkQueue(records = [], input = {}) {
  const contentHash = input.contentHash || hash;
  const analysis = analyzeInputs({ ...input, contentHash });
  const expected = analysis.valid ? expectedRecords({ ...input, contentHash }, analysis) : [];
  const expectedByKey = new Map(expected.map(row => [row.historicalAttributionWorkEntryKey, row]));
  const expectedKeys = expected.map(row => row.historicalAttributionWorkEntryKey);
  const outputKeys = records.map(row => row.historicalAttributionWorkEntryKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingKeys = expectedKeys.filter(key => !outputKeys.includes(key));
  const unexpectedKeys = outputKeys.filter(key => !expectedKeys.includes(key));
  const recordMismatchKeys = records.filter(row => !same(row, expectedByKey.get(row.historicalAttributionWorkEntryKey), contentHash) ||
    !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'))).map(row => row.historicalAttributionWorkEntryKey);
  const outputPromotionKeys = records.filter(row => !outputGatesClosed(row)).map(row => row.historicalAttributionWorkEntryKey);
  const outputObservationKeys = records.flatMap(row => row.historicalRenderedObservations?.map(observation => observation.observationKey) || []);
  const expectedObservationKeys = expected.flatMap(row => row.historicalRenderedObservations.map(observation => observation.observationKey));
  const duplicateObservationKeys = duplicates(outputObservationKeys);
  const missingObservationKeys = expectedObservationKeys.filter(key => !outputObservationKeys.includes(key));
  const unexpectedObservationKeys = outputObservationKeys.filter(key => !expectedObservationKeys.includes(key));
  const directObservationLeakKeys = records.flatMap(row => (row.historicalRenderedObservations || []).filter(item => item.observation?.sourcePresence !== HISTORICAL_PRESENCE).map(item => item.observationKey));
  const artifacts = input.artifacts || {};
  const expectedQueueTsv = renderHistoricalAttributionQueueTsv(records);
  const expectedBlankDecisions = renderHistoricalAttributionBlankDecisions(records, input.policy);
  const artifactMismatchFiles = [];
  if (artifacts.queueTsv !== expectedQueueTsv) artifactMismatchFiles.push('queue.tsv');
  if (artifacts.blankDecisions !== expectedBlankDecisions) artifactMismatchFiles.push('blank-decisions.ndjson');
  let parsedDecisions = [], decisionArtifactValid = true;
  try { parsedDecisions = artifacts.blankDecisions?.trim() ? artifacts.blankDecisions.trim().split(/\r?\n/).map(JSON.parse) : []; } catch { decisionArtifactValid = false; }
  const expectedDecisions = records.map(row => expectedDecisionTemplate(row, input.policy));
  if (!decisionArtifactValid || !same(parsedDecisions, expectedDecisions, contentHash)) decisionArtifactValid = false;
  const reviewStartedKeys = records.filter(row => row.reviewDecision !== null || row.historicalRenderedExpansionDependencyAttribution !== null || row.attributionEvidenceKeys?.length).map(row => row.historicalAttributionWorkEntryKey);
  const accountStateFindings = unique([...analysis.accountStateFindings, ...findAccountState(records)]).sort();
  const structuralBlockers = [];
  if (!analysis.compiled.valid) structuralBlockers.push('historical_attribution_queue_policy_invalid_or_specific');
  if (!analysis.snapshotHashesValid || !analysis.manifestsValid || analysis.upstream.publishable !== true) structuralBlockers.push('source_queue_policy_manifest_snapshot_or_upstream_revalidation_failed');
  if (analysis.workQueueOuterHashMismatchKeys.length || analysis.workQueueIntrinsicHashMismatchKeys.length || analysis.workQueueContractMismatchKeys.length || analysis.workQueuePromotionKeys.length || analysis.invalidSourceOrdinals.length || analysis.duplicateSourceKeys.length) structuralBlockers.push('source_work_queue_records_invalid');
  if (analysis.candidateOuterHashMismatchKeys.length || analysis.candidateGateMismatchKeys.length || analysis.duplicateCandidateKeys.length || analysis.candidateBindingMismatchKeys.length) structuralBlockers.push('source_candidate_records_or_bindings_invalid');
  if (analysis.historicalRouteMismatchKeys.length || analysis.unexpectedHistoricalFlags.length) structuralBlockers.push('historical_attribution_route_set_invalid');
  if (analysis.historicalObservationInvalidKeys.length || analysis.historicalObservationEmptyKeys.length || analysis.historicalObservationCountMismatchKeys.length) structuralBlockers.push('historical_rendered_observation_set_invalid');
  if (duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length || recordMismatchKeys.length) structuralBlockers.push('historical_attribution_queue_not_exact');
  if (duplicateObservationKeys.length || missingObservationKeys.length || unexpectedObservationKeys.length || directObservationLeakKeys.length) structuralBlockers.push('historical_rendered_observation_population_not_exact');
  if (artifactMismatchFiles.length || !decisionArtifactValid) structuralBlockers.push('historical_attribution_artifacts_mismatch');
  if (reviewStartedKeys.length || outputPromotionKeys.length) structuralBlockers.push('historical_attribution_or_downstream_state_applied_at_export');
  if (accountStateFindings.length) structuralBlockers.push('current_account_state_present');
  const queueExportComplete = expected.length > 0 && structuralBlockers.length === 0;
  const expectedHistoricalObservations = expected.reduce((sum, row) => sum + row.historicalRenderedObservationCount, 0);
  return {
    contract: input.policy?.auditContract,
    policyCoverage: {
      policyValid: analysis.compiled.valid, contractsValid: analysis.compiled.contractsValid,
      inputPoliciesValid: analysis.compiled.inputPoliciesValid, vocabularyValid: analysis.compiled.vocabularyValid,
      invalidRules: analysis.compiled.invalidRules, forbiddenPolicyPaths: analysis.compiled.forbiddenPolicyPaths
    },
    inputCoverage: {
      sourceWorkQueueRecordCount: input.workQueueRecords?.length || 0,
      partitionRecordCount: input.partitionRecords?.length || 0,
      candidateRecordCount: input.candidateRecords?.length || 0,
      snapshotHashesValid: analysis.snapshotHashesValid, sourceManifestsValid: analysis.manifestsValid,
      upstreamQueueRevalidated: analysis.upstream.publishable === true
    },
    sourceQueueCoverage: {
      historicalAttributionRequiredCount: analysis.historicalSources.length,
      excludedDirectSourceOnlyCount: (input.workQueueRecords?.length || 0) - analysis.historicalSources.length,
      outerHashMismatchKeys: analysis.workQueueOuterHashMismatchKeys,
      intrinsicHashMismatchKeys: analysis.workQueueIntrinsicHashMismatchKeys,
      contractMismatchKeys: analysis.workQueueContractMismatchKeys,
      promotionKeys: analysis.workQueuePromotionKeys,
      invalidOrdinalKeys: analysis.invalidSourceOrdinals,
      duplicateKeys: analysis.duplicateSourceKeys,
      routeMismatchKeys: analysis.historicalRouteMismatchKeys,
      unexpectedHistoricalFlagKeys: analysis.unexpectedHistoricalFlags
    },
    candidateCoverage: {
      matchedHistoricalCandidateCount: analysis.historicalSources.filter(row => analysis.candidateByTarget.has(row.renderedTargetKey)).length,
      outerHashMismatchKeys: analysis.candidateOuterHashMismatchKeys,
      semanticGateMismatchKeys: analysis.candidateGateMismatchKeys,
      duplicateTargetKeys: analysis.duplicateCandidateKeys,
      bindingMismatchKeys: analysis.candidateBindingMismatchKeys
    },
    observationCoverage: {
      expectedHistoricalRenderedObservationCount: expectedHistoricalObservations,
      outputHistoricalRenderedObservationCount: outputObservationKeys.length,
      expectedHistoricalGuideRevisionBindingCount: expected.reduce((sum, row) => sum + row.historicalGuideRevisionBindingCount, 0),
      invalidObservationSourceKeys: analysis.historicalObservationInvalidKeys,
      emptyObservationSourceKeys: analysis.historicalObservationEmptyKeys,
      countMismatchSourceKeys: analysis.historicalObservationCountMismatchKeys,
      duplicateObservationKeys, missingObservationKeys, unexpectedObservationKeys, directObservationLeakKeys,
      exactHistoricalObservationPopulation: expectedHistoricalObservations > 0 && duplicateObservationKeys.length === 0 && missingObservationKeys.length === 0 && unexpectedObservationKeys.length === 0 && directObservationLeakKeys.length === 0
    },
    queueCoverage: {
      expectedRecordCount: expected.length, outputRecordCount: records.length,
      mixedRecordCount: records.filter(row => row.provenancePartition === 'mixed_direct_and_unattributed_rendered').length,
      renderedOnlyRecordCount: records.filter(row => row.provenancePartition === 'rendered_only_origin_unattributed').length,
      duplicateOutputKeys, missingOutputKeys: missingKeys, unexpectedOutputKeys: unexpectedKeys, recordMismatchKeys,
      orderMatchesFilteredSourceQueue: same(outputKeys, expectedKeys, contentHash)
    },
    artifactCoverage: {
      queueTsvContentHash: contentHash(artifacts.queueTsv || ''),
      blankDecisionsContentHash: contentHash(artifacts.blankDecisions || ''),
      artifactMismatchFiles, decisionArtifactValid
    },
    reviewCoverage: {
      blankDecisionTemplateCount: parsedDecisions.length,
      reviewStartedCount: reviewStartedKeys.length,
      reviewStartedKeys,
      attributionCompletedCount: records.filter(row => row.historicalRenderedExpansionDependencyAttribution !== null).length
    },
    semanticPreservationCoverage: {
      requirementOrUnlockApplicationCount: records.filter(row => row.requirementOrUnlockApplied === true).length,
      semanticDispositionCount: records.filter(row => row.semanticDisposition !== null).length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassificationCount: records.filter(row => row.repeatabilityClassification !== null).length,
      mechanicsReviewCompleteCount: records.filter(row => row.mechanicsReviewComplete === true).length,
      optimizerPromotionCount: records.filter(row => row.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length,
      unsupportedPromotionKeys: outputPromotionKeys
    },
    accountStateFindings,
    queueExportComplete,
    historicalAttributionComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers,
      'historical_rendered_expansion_dependency_attribution_pending',
      'historical_dependency_revision_and_generative_origin_unavailable',
      'current_dependency_graph_cannot_substitute_for_historical_revision_lineage',
      'source_scoped_semantic_relevance_disposition_pending',
      'level_unlock_corpus_absence_reconciliation_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: queueExportComplete
  };
}
