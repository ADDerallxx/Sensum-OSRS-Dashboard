import { hash } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';

const REQUIRED_RULES = [
  'allThreeInputSnapshotsAndEveryIntrinsicRecordMustRevalidate', 'inputSignatureAndQueueSetsMustMatchExactlyAndEveryQueueCandidateMustResolveExactlyOnce',
  'everySignatureExportsExactlyOnceByPriorityThenOriginalQueueOrdinal', 'queueEntriesBindAllThreeSnapshotsAndRecords',
  'allGuideObservationsRequestedTitlesAndStructuralEvidenceMustBePreserved', 'reviewPriorityMayDependOnlyOnNamespaceAndProvenancePartition',
  'decisionTemplatesMustStartBlank', 'exportDoesNotApplySemanticDispositionOrAnyDownstreamPromotion',
  'namesTitlesPageIdsRevisionsTemplatesCategoriesOrAliasesCannotAlterPolicyBehavior', 'currentAccountStateIsForbidden'
];
const EXPECTED_DISPOSITIONS = [
  'relevant_to_one_or_more_retained_training_guide_contexts',
  'not_relevant_to_any_retained_training_guide_context',
  'ambiguous_or_context_specific_additional_evidence_required'
];
const EXPECTED_PRIORITIES = { direct_source_only: 1, mixed_direct_and_unattributed_rendered: 2, rendered_only_origin_unattributed: 3 };
const unique = values => [...new Set(values)];
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|template|templates|category|categories|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|template|category|alias).*(?:override|exception)s?$/i;
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
  return sorted(unique(findings));
}

export function compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy(policy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-policy.v1' &&
    policy.signatureContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature.v1' &&
    policy.queueInputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-entry.v1' &&
    policy.candidateContract === 'sensum.cross-source-entity-activity-candidate.v1' &&
    policy.outputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-entry.v1' &&
    policy.decisionTemplateContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-decision-template.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-audit.v1' &&
    policy.inputPopulationPolicy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-target-source-signature-population-consolidation-policy.v1' && validHash(policy.inputPopulationPolicyContentHash) &&
    policy.inputQueuePolicy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-export-policy.v1' && validHash(policy.inputQueuePolicyContentHash) &&
    policy.reviewRoutes?.mainNamespace === 'main_namespace_source_context_review' && policy.reviewRoutes?.nonMainNamespace === 'non_main_namespace_source_context_review' &&
    policy.queueState === 'pending_explicit_source_scoped_semantic_relevance_review';
  const dispositionsValid = same(policy.allowedDispositions || [], EXPECTED_DISPOSITIONS, contentHash);
  const prioritiesValid = same(policy.priorityByProvenancePartition || {}, EXPECTED_PRIORITIES, contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractsValid && dispositionsValid && prioritiesValid && invalidRules.length === 0 && forbidden.length === 0, contractsValid, dispositionsValid, prioritiesValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function outerHashValid(record, contract, contentHash) {
  return record?.contract === contract && validHash(record.contentHash) && record.contentHash === contentHash(without(record, 'contentHash'));
}

function doubleHashValid(record, contract, contentHash) {
  return outerHashValid(record, contract, contentHash) && validHash(record.recordContentHash) && record.recordContentHash === contentHash(without(record, 'contentHash', 'recordContentHash'));
}

function signatureValid(record, policy, contentHash) {
  return doubleHashValid(record, policy.signatureContract, contentHash) && Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0 &&
    Object.values(record.revisionAlignment || {}).length > 0 && Object.values(record.revisionAlignment).every(Boolean) &&
    record.sourceScopedSemanticRelevanceReview?.state === 'unreviewed' && record.sourceScopedSemanticRelevanceReview?.disposition === null &&
    record.sourceScopedSemanticRelevanceReview?.evidenceKeys?.length === 0 && record.unlockEvidencePresent === false &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null && record.repeatabilityClassification === null &&
    record.mechanicsReviewComplete === false && record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true;
}

function queueValid(record, policy, contentHash) {
  return doubleHashValid(record, policy.queueInputContract, contentHash) && Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0 &&
    record.semanticDisposition === null && record.unlockEvidencePresent === false && record.canonicalGameEntityIdentity === null &&
    record.canonicalActivityIdentity === null && record.repeatabilityClassification === null && record.mechanicsReviewComplete === false &&
    record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true;
}

function candidateValid(record, policy, contentHash) {
  return outerHashValid(record, policy.candidateContract, contentHash) && record.candidateKind === 'rendered_page_without_unlock_match' &&
    record.sourceContexts?.semanticRoutingState === 'rendered_stable_page_without_unlock_evidence' && record.sourceContexts?.unlockEvidence === null &&
    Array.isArray(record.sourceContexts?.renderedEvidence?.observations) && record.sourceContexts.renderedEvidence.observations.length > 0 &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null && record.repeatabilityClassification === null &&
    record.optimizerEligible === false && record.accountIndependent === true;
}

function guideBindings(observations = [], contentHash = hash) {
  const seen = new Map();
  for (const row of observations) {
    const binding = { guidePageId: row.guidePageId, guideTitle: row.guideTitle, guideRevision: row.guideRevision, guideContentHash: row.guideContentHash };
    seen.set(contentHash(binding), binding);
  }
  return sorted([...seen.entries()]).map(([, value]) => value);
}

function boundInputs(signature, queue, candidate, source, policy, contentHash) {
  if (!signatureValid(signature, policy, contentHash) || !queueValid(queue, policy, contentHash) || !candidateValid(candidate, policy, contentHash)) return false;
  const rendered = candidate.sourceContexts.renderedEvidence;
  const identity = queue.stableWikiPageIdentity || {};
  return Number.isInteger(policy.priorityByProvenancePartition?.[queue.provenancePartition]) &&
    signature.queueOrdinal === queue.queueOrdinal && signature.provenancePartition === queue.provenancePartition &&
    signature.sourceWorkQueueEntryKey === queue.workQueueEntryKey &&
    signature.sourceWorkQueueEntryContentHash === queue.contentHash && signature.sourceWorkQueueEntryIntrinsicContentHash === queue.recordContentHash &&
    signature.sourceWorkQueueSnapshotContentHash === source.queueSnapshotContentHash && queue.sourceCandidateContentHash === candidate.contentHash &&
    queue.sourceCandidateSnapshotContentHash === source.candidateSnapshotContentHash && signature.sourceWorkQueueSnapshotContentHash === source.queueSnapshotContentHash &&
    signature.sourcePageId === identity.sourcePageId && String(signature.sourceRevision) === String(identity.sourceRevision) &&
    signature.sourceTimestamp === identity.sourceTimestamp && signature.resolvedTitle === identity.resolvedTitle && signature.sourceUrl === identity.sourceUrl &&
    candidate.renderedTargetKey === queue.renderedTargetKey && signature.renderedTargetKey === queue.renderedTargetKey &&
    candidate.pageIdentity?.sourcePageId === identity.sourcePageId && String(candidate.pageIdentity?.renderedSourceRevision) === String(identity.sourceRevision) &&
    candidate.pageIdentity?.resolvedTitle === identity.resolvedTitle && rendered.targetPageIdentity?.sourcePageId === identity.sourcePageId &&
    String(rendered.targetPageIdentity?.sourceRevision) === String(identity.sourceRevision) && rendered.targetPageIdentity?.sourceTimestamp === identity.sourceTimestamp &&
    rendered.targetPageIdentity?.resolvedTitle === identity.resolvedTitle && rendered.targetPageIdentity?.sourceUrl === identity.sourceUrl &&
    same(signature.requestedTitles, queue.requestedTitles, contentHash) && same(signature.requestedTitles, rendered.requestedTitles, contentHash) &&
    same(signature.observedNamespaceIds, queue.namespaceIds, contentHash) && same(signature.observedNamespaceIds, rendered.namespaceIds, contentHash) &&
    queue.guideObservationCount === rendered.observations.length && queue.renderedObservationSetContentHash === contentHash(rendered.observations) &&
    queue.guideSourceBindingCount === guideBindings(rendered.observations, contentHash).length && queue.guideSourceBindingsContentHash === contentHash(guideBindings(rendered.observations, contentHash));
}

function sourcePageIdentity(signature) {
  return { sourcePageId: signature.sourcePageId, sourceNamespaceId: signature.sourceNamespaceId, resolvedTitle: signature.resolvedTitle, sourceRevision: signature.sourceRevision, sourceTimestamp: signature.sourceTimestamp, sourceUrl: signature.sourceUrl, sourceContentHash: signature.sourceContentHash, sourceContentBytes: signature.sourceContentBytes, sourceLineCount: signature.sourceLineCount };
}

function structuralEvidence(signature) {
  return { rootTemplates: signature.rootTemplateEvidence, directCategories: signature.directCategoryEvidence, leadParagraphs: signature.leadParagraphEvidence, headings: signature.headingEvidence };
}

function evidenceFingerprint(signature, queue, candidate, source, contentHash) {
  return contentHash({ sourceSignatureSnapshotContentHash: source.signatureSnapshotContentHash, sourceSignatureRecordContentHash: signature.contentHash, sourceWorkQueueSnapshotContentHash: source.queueSnapshotContentHash, sourceWorkQueueRecordContentHash: queue.contentHash, sourceCandidateSnapshotContentHash: source.candidateSnapshotContentHash, sourceCandidateRecordContentHash: candidate.contentHash, sourcePageIdentity: sourcePageIdentity(signature), requestedTitles: signature.requestedTitles, retainedGuideContexts: candidate.sourceContexts.renderedEvidence, structuralEvidence: structuralEvidence(signature) });
}

function expectedEntry(signature, queue, candidate, source, policy, reviewQueueOrdinal, contentHash) {
  const provenanceRank = policy.priorityByProvenancePartition[queue.provenancePartition];
  const namespaceRank = signature.sourceNamespaceId === 0 ? 0 : 1;
  const base = {
    contract: policy.outputContract, reviewQueueOrdinal, sourceQueueOrdinal: signature.queueOrdinal,
    workQueueEntryKey: `${signature.signatureKey}|source-scoped-semantic-relevance-review`,
    sourceSignatureKey: signature.signatureKey, sourceSignatureRecordContentHash: signature.contentHash, sourceSignatureSnapshotContentHash: source.signatureSnapshotContentHash,
    sourceWorkQueueRecordContentHash: queue.contentHash, sourceWorkQueueSnapshotContentHash: source.queueSnapshotContentHash,
    sourceCandidateRecordContentHash: candidate.contentHash, sourceCandidateSnapshotContentHash: source.candidateSnapshotContentHash,
    sourcePageIdentity: sourcePageIdentity(signature), provenancePartition: queue.provenancePartition, requestedTitles: signature.requestedTitles,
    retainedGuideContexts: candidate.sourceContexts.renderedEvidence, structuralEvidence: structuralEvidence(signature),
    evidenceFingerprint: evidenceFingerprint(signature, queue, candidate, source, contentHash),
    reviewPriority: { band: provenanceRank + namespaceRank * 3, provenanceRank, namespaceRank },
    reviewRoute: namespaceRank === 0 ? policy.reviewRoutes.mainNamespace : policy.reviewRoutes.nonMainNamespace,
    allowedDispositions: policy.allowedDispositions,
    reviewQuestion: 'Does this exact revision-pinned source have a material semantic relationship to one or more retained training-guide observations?',
    semanticDisposition: null, reviewer: null, reviewedAt: null, reviewNotes: null, reviewEvidenceKeys: [],
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null, mechanicsReviewComplete: false,
    optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true,
    blockers: ['source_scoped_semantic_relevance_review_pending', 'level_unlock_corpus_absence_reconciliation_pending', ...(queue.historicalRenderedAttributionRequired ? ['historical_rendered_expansion_dependency_attribution_pending'] : []), 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'optimizer_eligibility_blocked'],
    state: policy.queueState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function expectedTemplate(entry, policy, contentHash) {
  const base = { contract: policy.decisionTemplateContract, workQueueEntryKey: entry.workQueueEntryKey, evidenceFingerprint: entry.evidenceFingerprint, sourcePageId: entry.sourcePageIdentity.sourcePageId, sourceRevision: entry.sourcePageIdentity.sourceRevision, sourceContentHash: entry.sourcePageIdentity.sourceContentHash, reviewRoute: entry.reviewRoute, allowedDispositions: entry.allowedDispositions, decision: null, reviewer: null, reviewedAt: null, reviewNotes: null, evidenceKeys: [], state: 'blank_source_scoped_semantic_relevance_review_decision' };
  return { ...base, templateContentHash: contentHash(base) };
}

const tsv = value => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
export function renderRenderedPageWithoutUnlockSemanticRelevanceReviewIndex(records = []) {
  const lines = ['review_ordinal\tsource_ordinal\ttitle\tnamespace\tprovenance\tpriority\troute\tguide_observations\tguide_titles\troot_templates\tdirect_categories\tleads\theadings\tsource_revision\tsource_url\twork_queue_key'];
  for (const record of records) {
    const guideTitles = sorted(unique(record.retainedGuideContexts.observations.map(row => row.guideTitle))).join('; ');
    const identity = record.sourcePageIdentity;
    lines.push([record.reviewQueueOrdinal, record.sourceQueueOrdinal, identity.resolvedTitle, identity.sourceNamespaceId, record.provenancePartition, record.reviewPriority.band, record.reviewRoute, record.retainedGuideContexts.observations.length, guideTitles, record.structuralEvidence.rootTemplates.length, record.structuralEvidence.directCategories.length, record.structuralEvidence.leadParagraphs.length, record.structuralEvidence.headings.length, identity.sourceRevision, identity.sourceUrl, record.workQueueEntryKey].map(tsv).join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

export function serializeRenderedPageWithoutUnlockSemanticRelevanceDecisionTemplates(templates = []) {
  return templates.map(template => JSON.stringify(template)).join('\n') + (templates.length ? '\n' : '');
}

function promoted(entry) {
  return entry.semanticDisposition !== null || entry.reviewer !== null || entry.reviewedAt !== null || entry.reviewNotes !== null || entry.reviewEvidenceKeys?.length || entry.canonicalGameEntityIdentity !== null || entry.canonicalActivityIdentity !== null || entry.repeatabilityClassification !== null || entry.mechanicsReviewComplete !== false || entry.optimizerEligible !== false || entry.automaticVerificationApplied !== false;
}

function templateDecided(template) {
  return template.decision !== null || template.reviewer !== null || template.reviewedAt !== null || template.reviewNotes !== null || template.evidenceKeys?.length || template.state !== 'blank_source_scoped_semantic_relevance_review_decision';
}

export function buildRenderedPageWithoutUnlockSemanticRelevanceWorkQueue({ signatureRecords = [], queueRecords = [], candidateRecords = [], policy = {}, signatureSnapshotContentHash = '', queueSnapshotContentHash = '', candidateSnapshotContentHash = '', contentHash = hash } = {}) {
  const source = { signatureSnapshotContentHash, queueSnapshotContentHash, candidateSnapshotContentHash };
  const compiled = compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy(policy, contentHash);
  const queueByOrdinal = new Map(queueRecords.map(record => [record.queueOrdinal, record]));
  const candidateByHash = new Map(candidateRecords.map(record => [record.contentHash, record]));
  const bound = signatureRecords.map(signature => ({ signature, queue: queueByOrdinal.get(signature.queueOrdinal), candidate: candidateByHash.get(queueByOrdinal.get(signature.queueOrdinal)?.sourceCandidateContentHash) }));
  const inputComplete = compiled.valid && [signatureSnapshotContentHash, queueSnapshotContentHash, candidateSnapshotContentHash].every(validHash) && signatureRecords.length > 0 && signatureRecords.length === queueRecords.length && !duplicates(signatureRecords.map(row => row.queueOrdinal)).length && !duplicates(queueRecords.map(row => row.queueOrdinal)).length && bound.every(row => boundInputs(row.signature, row.queue, row.candidate, source, policy, contentHash));
  const ordered = inputComplete ? bound.sort((left, right) => {
    const leftRank = policy.priorityByProvenancePartition[left.queue.provenancePartition] + (left.signature.sourceNamespaceId === 0 ? 0 : 3);
    const rightRank = policy.priorityByProvenancePartition[right.queue.provenancePartition] + (right.signature.sourceNamespaceId === 0 ? 0 : 3);
    return leftRank - rightRank || left.signature.queueOrdinal - right.signature.queueOrdinal;
  }) : [];
  const records = ordered.map((row, index) => expectedEntry(row.signature, row.queue, row.candidate, source, policy, index + 1, contentHash));
  const decisionTemplates = records.map(record => expectedTemplate(record, policy, contentHash));
  const reviewIndexTsv = renderRenderedPageWithoutUnlockSemanticRelevanceReviewIndex(records);
  const decisionTemplateNdjson = serializeRenderedPageWithoutUnlockSemanticRelevanceDecisionTemplates(decisionTemplates);
  const audit = auditRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(records, { signatureRecords, queueRecords, candidateRecords, policy, signatureSnapshotContentHash, queueSnapshotContentHash, candidateSnapshotContentHash, decisionTemplates, reviewIndexTsv, decisionTemplateNdjson, contentHash });
  return audit.publishable ? { records, decisionTemplates, reviewIndexTsv, decisionTemplateNdjson, audit } : { records: [], decisionTemplates: [], reviewIndexTsv: '', decisionTemplateNdjson: '', audit };
}

export function auditRenderedPageWithoutUnlockSemanticRelevanceWorkQueue(records = [], { signatureRecords = [], queueRecords = [], candidateRecords = [], policy = {}, signatureSnapshotContentHash = '', queueSnapshotContentHash = '', candidateSnapshotContentHash = '', decisionTemplates = [], reviewIndexTsv = '', decisionTemplateNdjson = '', contentHash = hash } = {}) {
  const source = { signatureSnapshotContentHash, queueSnapshotContentHash, candidateSnapshotContentHash };
  const compiled = compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy(policy, contentHash);
  const queueByOrdinal = new Map(queueRecords.map(record => [record.queueOrdinal, record]));
  const candidateByHash = new Map(candidateRecords.map(record => [record.contentHash, record]));
  const invalidOrdinals = signatureRecords.filter(signature => !boundInputs(signature, queueByOrdinal.get(signature.queueOrdinal), candidateByHash.get(queueByOrdinal.get(signature.queueOrdinal)?.sourceCandidateContentHash), source, policy, contentHash)).map(row => row.queueOrdinal);
  const expectedBound = signatureRecords.filter(signature => !invalidOrdinals.includes(signature.queueOrdinal)).map(signature => ({ signature, queue: queueByOrdinal.get(signature.queueOrdinal), candidate: candidateByHash.get(queueByOrdinal.get(signature.queueOrdinal).sourceCandidateContentHash) })).sort((left, right) => {
    const leftRank = policy.priorityByProvenancePartition?.[left.queue.provenancePartition] + (left.signature.sourceNamespaceId === 0 ? 0 : 3);
    const rightRank = policy.priorityByProvenancePartition?.[right.queue.provenancePartition] + (right.signature.sourceNamespaceId === 0 ? 0 : 3);
    return leftRank - rightRank || left.signature.queueOrdinal - right.signature.queueOrdinal;
  });
  const expectedRecords = compiled.valid ? expectedBound.map((row, index) => expectedEntry(row.signature, row.queue, row.candidate, source, policy, index + 1, contentHash)) : [];
  const expectedByKey = new Map(expectedRecords.map(record => [record.sourceSignatureKey, record]));
  const outputKeys = records.map(record => record.sourceSignatureKey);
  const inputKeys = signatureRecords.map(record => record.signatureKey);
  const mismatchKeys = records.filter(record => !expectedByKey.has(record.sourceSignatureKey) || !same(record, expectedByKey.get(record.sourceSignatureKey), contentHash)).map(record => record.sourceSignatureKey);
  const expectedTemplates = records.map(record => expectedTemplate(record, policy, contentHash));
  const templateMismatches = decisionTemplates.filter((template, index) => !expectedTemplates[index] || !same(template, expectedTemplates[index], contentHash)).map(template => template.workQueueEntryKey);
  if (decisionTemplates.length !== expectedTemplates.length) templateMismatches.push('decision_template_count_mismatch');
  const indexMatches = reviewIndexTsv === renderRenderedPageWithoutUnlockSemanticRelevanceReviewIndex(records);
  const templateNdjsonMatches = decisionTemplateNdjson === serializeRenderedPageWithoutUnlockSemanticRelevanceDecisionTemplates(decisionTemplates);
  const promotions = records.filter(promoted).map(record => record.sourceSignatureKey);
  const decidedTemplates = decisionTemplates.filter(templateDecided).map(template => template.workQueueEntryKey);
  const accountStateFindings = findAccountState([...records, ...decisionTemplates]);
  const blockers = [];
  if (!compiled.valid) blockers.push('semantic_relevance_work_queue_policy_invalid_or_source_specific');
  if (![signatureSnapshotContentHash, queueSnapshotContentHash, candidateSnapshotContentHash].every(validHash)) blockers.push('one_or_more_upstream_snapshot_hashes_missing_or_invalid');
  if (duplicates(inputKeys).length || duplicates(queueRecords.map(row => row.workQueueEntryKey)).length || duplicates(candidateRecords.map(row => row.contentHash)).length) blockers.push('duplicate_upstream_record_keys');
  if (signatureRecords.length !== queueRecords.length || invalidOrdinals.length) blockers.push('signature_queue_candidate_bindings_incomplete_or_invalid');
  if (duplicates(outputKeys).length || !same(sorted(inputKeys), sorted(outputKeys), contentHash)) blockers.push('semantic_relevance_work_queue_set_incomplete_or_mismatched');
  if (!same(outputKeys, expectedRecords.map(row => row.sourceSignatureKey), contentHash)) blockers.push('review_queue_priority_order_invalid');
  if (mismatchKeys.length) blockers.push('one_or_more_review_queue_records_do_not_match_bound_inputs');
  if (templateMismatches.length || !templateNdjsonMatches) blockers.push('one_or_more_blank_decision_templates_do_not_match_queue');
  if (!indexMatches) blockers.push('readable_review_index_does_not_match_queue');
  if (promotions.length || decidedTemplates.length) blockers.push('queue_export_created_review_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  const queueExportComplete = signatureRecords.length > 0 && blockers.length === 0;
  const matchedCandidates = signatureRecords.map(signature => candidateByHash.get(queueByOrdinal.get(signature.queueOrdinal)?.sourceCandidateContentHash)).filter(Boolean);
  return {
    contract: policy.auditContract,
    policyCoverage: compiled,
    inputCoverage: { signatureRecordCount: signatureRecords.length, queueRecordCount: queueRecords.length, candidateInventoryRecordCount: candidateRecords.length, matchedCandidateRecordCount: matchedCandidates.length, invalidBindingOrdinals: invalidOrdinals, signatureSnapshotContentHash, queueSnapshotContentHash, candidateSnapshotContentHash },
    bindingCoverage: { fullyBoundSignatureCount: signatureRecords.length - invalidOrdinals.length, allThreeSnapshotsAndRecordsBound: invalidOrdinals.length === 0 },
    contextPreservationCoverage: { retainedGuideObservationCount: matchedCandidates.reduce((sum, row) => sum + row.sourceContexts.renderedEvidence.observations.length, 0), retainedDistinctGuideBindingCount: unique(matchedCandidates.flatMap(row => guideBindings(row.sourceContexts.renderedEvidence.observations, contentHash).map(binding => contentHash(binding)))).length, retainedRequestedTitleCount: signatureRecords.reduce((sum, row) => sum + row.requestedTitles.length, 0), retainedRootTemplateCount: signatureRecords.reduce((sum, row) => sum + row.rootTemplateEvidence.length, 0), retainedDirectCategoryCount: signatureRecords.reduce((sum, row) => sum + row.directCategoryEvidence.length, 0), retainedLeadParagraphCount: signatureRecords.reduce((sum, row) => sum + row.leadParagraphEvidence.length, 0), retainedHeadingCount: signatureRecords.reduce((sum, row) => sum + row.headingEvidence.length, 0), exactContextPreservation: invalidOrdinals.length === 0 && mismatchKeys.length === 0 },
    queueCoverage: { reviewQueueEntryCount: records.length, blankDecisionTemplateCount: decisionTemplates.length - decidedTemplates.length, mainNamespaceEntryCount: records.filter(row => row.reviewRoute === policy.reviewRoutes?.mainNamespace).length, nonMainNamespaceEntryCount: records.filter(row => row.reviewRoute === policy.reviewRoutes?.nonMainNamespace).length, priorityBandCounts: Object.fromEntries([1, 2, 3, 4, 5, 6].map(band => [String(band), records.filter(row => row.reviewPriority.band === band).length])), duplicateOutputKeys: duplicates(outputKeys), missingOutputKeys: inputKeys.filter(key => !outputKeys.includes(key)), unexpectedOutputKeys: outputKeys.filter(key => !inputKeys.includes(key)), mismatchKeys, priorityOrderMatches: same(outputKeys, expectedRecords.map(row => row.sourceSignatureKey), contentHash) },
    artifactCoverage: { reviewIndexMatchesQueue: indexMatches, decisionTemplateNdjsonMatches: templateNdjsonMatches, decisionTemplateMismatchKeys: unique(templateMismatches), reviewIndexBytes: Buffer.byteLength(reviewIndexTsv, 'utf8'), decisionTemplateBytes: Buffer.byteLength(decisionTemplateNdjson, 'utf8') },
    semanticPreservationCoverage: { semanticDispositionCount: records.filter(row => row.semanticDisposition !== null).length, canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length, canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length, repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length, mechanicsReviewCompleteCount: records.filter(row => row.mechanicsReviewComplete === true).length, optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length, automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length, decidedTemplateCount: decidedTemplates.length, unsupportedPromotionKeys: promotions },
    accountStateFindings,
    queueExportComplete,
    semanticRelevanceReviewComplete: false,
    reconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers, ...(queueExportComplete ? ['source_scoped_semantic_relevance_review_pending'] : []), 'level_unlock_corpus_absence_reconciliation_pending', 'historical_rendered_expansion_dependency_attribution_incomplete', 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'independent_complete_activity_universe_not_established']),
    publishable: queueExportComplete
  };
}
