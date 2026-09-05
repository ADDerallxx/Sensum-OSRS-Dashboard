import { findUnresolvedSubjectSourceSignatureAccountState } from './activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const stageFields = new Set([
  'contract', 'contentHash', 'blockers', 'state',
  'sourceCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutingContentHash',
  'schemaEvidenceSources', 'activityInfoboxSchemaSemanticsEvidence', 'activityInfoboxSchemaSemanticsReview'
]);

const preservedInput = record => Object.fromEntries(Object.entries(record || {}).filter(([key]) => !stageFields.has(key)));
const titleKey = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title || '').replaceAll(' ', '_'))}`;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (/^(?:pageId|pageIds|revision|revisions|activityName|activityNames|canonicalLabel|canonicalLabels|candidateKey|candidateKeys|memberCandidateKey|memberCandidateKeys|alias|aliases|override|overrides)$/i.test(name)) findings.push(childPath);
      visit(child, childPath);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileActivityInfoboxSchemaSemanticsEvidencePolicy(policy = {}) {
  const requiredTrueRules = [
    'oneEvidencePacketPerMatchingSchemaEvidenceRoute',
    'everyRequiredSchemaSourceMustBeFetchedAtOneCurrentExactRevision',
    'everyRequiredObservationMustRetainExactSourceLocationAndRevision',
    'templateDocumentationAndModuleImplementationAreSeparateEvidenceSources',
    'observedFieldMeaningAndRenderingDoNotAutomaticallyBindThePageSubject',
    'missingChangedDuplicateOrContradictorySchemaEvidenceRemainsBlocked',
    'schemaSourcesAreFixedByTheGenericInfoboxSchemaNotByAnActivityIdentity',
    'activityNamesLabelsPageIdsCandidateKeysAliasesAndOverridesAreForbidden',
    'inputEvidenceIdentityRevisionHashesDispositionRoutingAndContextMustBePreserved',
    'activityScopeRepeatabilityMemberMechanicsAndOptimizerPromotionAreForbidden',
    'currentAccountStateIsForbidden'
  ];
  const invalidRules = requiredTrueRules.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const sources = policy.requiredSources || [];
  const observations = policy.requiredObservations || [];
  const sourceKeys = sources.map(source => source.sourceKey);
  const sourceTitles = sources.map(source => titleKey(source.requestedTitle));
  const observationKeys = observations.map(observation => observation.observationKey);
  const invalidSources = sources.filter(source => !source.sourceKey || !source.requestedTitle || !Number.isInteger(source.namespace)).map(source => source.sourceKey || null);
  const invalidObservations = observations.filter(observation => !observation.observationKey || !sourceKeys.includes(observation.sourceKey)
    || !['literal_substring', 'exact_trimmed_line'].includes(observation.matchMode) || !observation.literal).map(observation => observation.observationKey || null);
  return {
    policyId: policy.policy || null,
    invalidRules,
    forbiddenPolicyPaths: forbiddenPolicyPaths(policy),
    duplicateSourceKeys: duplicates(sourceKeys),
    duplicateSourceTitles: duplicates(sourceTitles),
    duplicateObservationKeys: duplicates(observationKeys),
    invalidSources,
    invalidObservations,
    requiredSources: sources,
    requiredObservations: observations
  };
}

export function selectActivityInfoboxSchemaSemanticsEvidenceRoutes(records = [], policy = {}) {
  return records.filter(record => record.contract === policy.inputContract
    && record.routingDecision?.routeKey === policy.inputRouteKey
    && record.routingDecision?.routeState === policy.inputRouteState
    && record.state === 'canonical_activity_subject_declaration_semantic_evidence_work_routed_gates_closed'
    && record.canonicalActivitySubjectBinding === null
    && record.canonicalActivitySubjectDeclarationReview?.canonicalActivitySubjectDeclarationVerdict === null
    && record.canonicalActivitySubjectDeclarationReview?.canonicalActivityScopeVerdict === null
    && record.canonicalActivitySubjectDeclarationReview?.repeatabilityVerdict === null
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.mechanicsReview?.state === 'unreviewed'
    && record.optimizerEligible === false
    && record.accountIndependent === true);
}

function revisionFor(resolution) {
  return resolution?.page?.revisions?.[0] || null;
}

function sourceContent(resolution) {
  return revisionFor(resolution)?.slots?.main?.content;
}

function matchingOccurrences(content, observation) {
  const lines = String(content || '').split(/\r?\n/);
  const matches = [];
  for (const [index, line] of lines.entries()) {
    if (observation.matchMode === 'exact_trimmed_line' && line.trim() === observation.literal) {
      matches.push({ lineStart: index + 1, lineEnd: index + 1, matchedText: line.trim() });
    } else if (observation.matchMode === 'literal_substring') {
      let offset = 0;
      while (true) {
        const column = line.indexOf(observation.literal, offset);
        if (column < 0) break;
        matches.push({ lineStart: index + 1, lineEnd: index + 1, columnStart: column + 1, columnEnd: column + observation.literal.length, matchedText: observation.literal });
        offset = column + Math.max(1, observation.literal.length);
      }
    }
  }
  return matches;
}

function resolutionMap(resolutions = []) {
  return new Map(resolutions.map(resolution => [titleKey(resolution.requestedTitle), resolution]));
}

function buildSourceEvidence(sourceSpec, observations, fetchedByTitle, contentHash) {
  const resolution = fetchedByTitle.get(titleKey(sourceSpec.requestedTitle));
  const page = resolution?.page || null;
  const revision = revisionFor(resolution);
  const content = sourceContent(resolution);
  const sourceObservations = observations.filter(observation => observation.sourceKey === sourceSpec.sourceKey).map(observation => {
    const occurrences = matchingOccurrences(content, observation);
    return {
      observationKey: observation.observationKey,
      matchMode: observation.matchMode,
      literal: observation.literal,
      occurrenceCount: occurrences.length,
      occurrences,
      exactSingleOccurrence: occurrences.length === 1
    };
  });
  const deficiencies = [];
  if (!resolution) deficiencies.push('source_resolution_response_missing');
  if (!page || Object.hasOwn(page || {}, 'missing')) deficiencies.push('required_schema_source_page_missing');
  if (Number(page?.ns) !== sourceSpec.namespace) deficiencies.push('required_schema_source_namespace_mismatch');
  if (!page?.pageid || !revision?.revid || !revision?.timestamp || typeof content !== 'string') deficiencies.push('required_schema_source_revision_provenance_incomplete');
  if (sourceObservations.some(observation => observation.occurrenceCount === 0)) deficiencies.push('one_or_more_required_schema_observations_missing');
  if (sourceObservations.some(observation => observation.occurrenceCount > 1)) deficiencies.push('one_or_more_required_schema_observations_duplicated');
  return {
    sourceKey: sourceSpec.sourceKey,
    requestedTitle: sourceSpec.requestedTitle,
    resolvedTitle: page?.title || resolution?.resolvedTitle || null,
    redirected: resolution?.redirected === true,
    namespace: page?.ns ?? null,
    sourcePageId: page?.pageid ? Number(page.pageid) : null,
    sourceRevision: revision?.revid ? String(revision.revid) : null,
    sourceTimestamp: revision?.timestamp || null,
    sourceUrl: page?.title ? wikiUrl(page.title) : null,
    sourceContentHash: typeof content === 'string' ? contentHash(content) : null,
    sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : 0,
    observations: sourceObservations,
    deficiencies,
    state: deficiencies.length ? 'blocked_incomplete_revision_pinned_schema_source_evidence' : 'complete_revision_pinned_schema_source_evidence'
  };
}

function expectedRecord(input, fetchedResolutions, policy, contentHash) {
  const compiled = compileActivityInfoboxSchemaSemanticsEvidencePolicy(policy);
  const fetchedByTitle = resolutionMap(fetchedResolutions);
  const sources = compiled.requiredSources.map(source => buildSourceEvidence(source, compiled.requiredObservations, fetchedByTitle, contentHash));
  const observations = sources.flatMap(source => source.observations.map(observation => ({
    ...observation,
    sourceKey: source.sourceKey,
    sourcePageId: source.sourcePageId,
    sourceRevision: source.sourceRevision,
    sourceTimestamp: source.sourceTimestamp,
    sourceUrl: source.sourceUrl,
    sourceContentHash: source.sourceContentHash
  })));
  const complete = sources.length === compiled.requiredSources.length
    && sources.every(source => source.state === 'complete_revision_pinned_schema_source_evidence')
    && observations.length === compiled.requiredObservations.length
    && observations.every(observation => observation.exactSingleOccurrence);
  return {
    contract: policy.recordContract,
    ...preservedInput(input),
    sourceCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutingContentHash: input.contentHash,
    schemaEvidenceSources: sources,
    activityInfoboxSchemaSemanticsEvidence: {
      schemaKey: 'activity_infobox',
      evidenceState: complete
        ? 'complete_revision_pinned_activity_infobox_schema_semantics_evidence_packet'
        : 'blocked_incomplete_activity_infobox_schema_semantics_evidence_packet',
      requiredSourceCount: compiled.requiredSources.length,
      completeSourceCount: sources.filter(source => source.state === 'complete_revision_pinned_schema_source_evidence').length,
      requiredObservationCount: compiled.requiredObservations.length,
      exactSingleObservationCount: observations.filter(observation => observation.exactSingleOccurrence).length,
      observations,
      documentedNameParameterMeaningObservation: observations.find(observation => observation.observationKey === 'documentation_describes_name_as_activity_name') || null,
      nameHeaderRenderingObservation: observations.find(observation => observation.observationKey === 'module_renders_name_as_infobox_header') || null,
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivitySubjectBinding: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    activityInfoboxSchemaSemanticsReview: {
      state: complete ? 'unreviewed_complete_schema_evidence_semantic_disposition_required' : 'blocked_incomplete_schema_evidence',
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivitySubjectBinding: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: observations.filter(observation => observation.exactSingleOccurrence).map(observation => `${observation.sourceKey}:${observation.sourcePageId}:${observation.sourceRevision}:${observation.observationKey}`)
    },
    accountIndependent: true,
    blockers: unique([
      ...(input.blockers || []).filter(blocker => blocker !== 'routed_canonical_activity_subject_declaration_semantic_evidence_work_not_completed'),
      ...sources.flatMap(source => source.deficiencies),
      complete ? 'activity_infobox_schema_evidence_requires_semantic_disposition' : 'activity_infobox_schema_semantics_evidence_incomplete',
      'schema_evidence_does_not_independently_bind_canonical_activity_subject',
      'canonical_activity_subject_binding_unresolved',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    ]),
    state: complete
      ? 'activity_infobox_schema_semantics_evidence_ready_for_disposition'
      : 'activity_infobox_schema_semantics_evidence_blocked_incomplete'
  };
}

export function buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords = [], fetchedResolutions = [], policy = {}, contentHash }) {
  const inputs = selectActivityInfoboxSchemaSemanticsEvidenceRoutes(routingRecords, policy);
  const records = inputs.map(input => expectedRecord(input, fetchedResolutions, policy, contentHash));
  return { records, audit: auditActivityInfoboxSchemaSemanticsEvidence(records, { routingRecords, fetchedResolutions, policy, contentHash }) };
}

export function auditActivityInfoboxSchemaSemanticsEvidence(records = [], { routingRecords = [], fetchedResolutions = [], policy = {}, contentHash } = {}) {
  const compiled = compileActivityInfoboxSchemaSemanticsEvidencePolicy(policy);
  const inputs = selectActivityInfoboxSchemaSemanticsEvidenceRoutes(routingRecords, policy);
  const expected = inputs.map(input => expectedRecord(input, fetchedResolutions, policy, contentHash));
  const expectedKeys = inputs.map(record => record.memberCandidateKey);
  const actualKeys = records.map(record => record.memberCandidateKey);
  const inputByKey = new Map(inputs.map(record => [record.memberCandidateKey, record]));
  const expectedByKey = new Map(expected.map(record => [record.memberCandidateKey, record]));
  const duplicateInputKeys = duplicates(expectedKeys);
  const duplicateOutputKeys = duplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const contextMismatches = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || record.sourceCanonicalActivitySubjectDeclarationSemanticEvidenceWorkRoutingContentHash !== input.contentHash
      || JSON.stringify(preservedInput(record)) !== JSON.stringify(preservedInput(input));
  }).map(record => record.memberCandidateKey);
  const evidenceMismatches = records.filter(record => {
    const expectedRecordValue = expectedByKey.get(record.memberCandidateKey);
    return !expectedRecordValue
      || JSON.stringify(record.schemaEvidenceSources) !== JSON.stringify(expectedRecordValue.schemaEvidenceSources)
      || JSON.stringify(record.activityInfoboxSchemaSemanticsEvidence) !== JSON.stringify(expectedRecordValue.activityInfoboxSchemaSemanticsEvidence)
      || JSON.stringify(record.activityInfoboxSchemaSemanticsReview) !== JSON.stringify(expectedRecordValue.activityInfoboxSchemaSemanticsReview);
  }).map(record => record.memberCandidateKey);
  const requestedTitles = compiled.requiredSources.map(source => titleKey(source.requestedTitle));
  const fetchedTitles = fetchedResolutions.map(resolution => titleKey(resolution.requestedTitle));
  const duplicateFetchedTitles = duplicates(fetchedTitles);
  const missingFetchedTitles = requestedTitles.filter(title => !fetchedTitles.includes(title));
  const unexpectedFetchedTitles = fetchedTitles.filter(title => !requestedTitles.includes(title));
  const sourceRows = records.flatMap(record => record.schemaEvidenceSources || []);
  const observationRows = records.flatMap(record => record.activityInfoboxSchemaSemanticsEvidence?.observations || []);
  const subjectOrReviewMutations = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input
      || JSON.stringify(record.canonicalActivitySubjectDeclarationStructuralDisposition) !== JSON.stringify(input.canonicalActivitySubjectDeclarationStructuralDisposition)
      || JSON.stringify(record.canonicalActivitySubjectBinding) !== JSON.stringify(input.canonicalActivitySubjectBinding)
      || JSON.stringify(record.canonicalActivitySubjectDeclarationReview) !== JSON.stringify(input.canonicalActivitySubjectDeclarationReview);
  }).map(record => record.memberCandidateKey);
  const downstreamPromotions = records.filter(record => {
    const input = inputByKey.get(record.memberCandidateKey);
    return !input || JSON.stringify(record.memberExpansionReview) !== JSON.stringify(input.memberExpansionReview)
      || JSON.stringify(record.mechanicsReview) !== JSON.stringify(input.mechanicsReview)
      || record.memberExpansionReview?.state !== 'unreviewed'
      || record.mechanicsReview?.state !== 'unreviewed'
      || record.optimizerEligible !== false;
  }).map(record => record.memberCandidateKey);
  const accountStateFindings = findUnresolvedSubjectSourceSignatureAccountState(records);
  const structuralBlockers = [];
  if (!expectedKeys.length) structuralBlockers.push('no_activity_infobox_schema_semantics_evidence_routes');
  if (duplicateInputKeys.length || duplicateOutputKeys.length || missingKeys.length || unexpectedKeys.length) structuralBlockers.push('input_and_output_schema_route_sets_do_not_match_exactly');
  if (contextMismatches.length) structuralBlockers.push('one_or_more_input_evidence_identity_revision_hash_disposition_routing_or_context_values_changed');
  if (compiled.invalidRules.length || compiled.forbiddenPolicyPaths.length || compiled.duplicateSourceKeys.length || compiled.duplicateSourceTitles.length || compiled.duplicateObservationKeys.length || compiled.invalidSources.length || compiled.invalidObservations.length) structuralBlockers.push('activity_infobox_schema_semantics_evidence_policy_invalid_or_activity_specific');
  if (duplicateFetchedTitles.length || missingFetchedTitles.length || unexpectedFetchedTitles.length) structuralBlockers.push('required_schema_source_fetch_set_does_not_match_exactly');
  if (evidenceMismatches.length) structuralBlockers.push('one_or_more_schema_evidence_packets_do_not_match_inputs_and_fetched_revisions');
  if (subjectOrReviewMutations.length) structuralBlockers.push('schema_evidence_changed_subject_disposition_binding_or_review');
  if (downstreamPromotions.length) structuralBlockers.push('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_activity_infobox_schema_semantics_evidence');
  const incompleteSources = sourceRows.filter(source => source.state !== 'complete_revision_pinned_schema_source_evidence');
  const incompleteObservations = observationRows.filter(observation => !observation.exactSingleOccurrence);
  const evidencePacketAttemptCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const evidenceCoverageComplete = evidencePacketAttemptCoverageComplete && incompleteSources.length === 0
    && incompleteObservations.length === 0 && records.every(record => record.activityInfoboxSchemaSemanticsEvidence?.evidenceState === 'complete_revision_pinned_activity_infobox_schema_semantics_evidence_packet');
  return {
    contract: policy.auditContract,
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedRoutingRecordCount: expectedKeys.length,
      evidenceRecordCount: records.length,
      duplicateInputMemberCandidateKeys: duplicateInputKeys,
      duplicateOutputMemberCandidateKeys: duplicateOutputKeys,
      missingMemberCandidateKeys: missingKeys,
      unexpectedMemberCandidateKeys: unexpectedKeys,
      contextMismatchMemberCandidateKeys: contextMismatches,
      evidenceMismatchMemberCandidateKeys: evidenceMismatches,
      exactInputOutputSetAndContextMatch: !duplicateInputKeys.length && !duplicateOutputKeys.length && !missingKeys.length && !unexpectedKeys.length && !contextMismatches.length
    },
    policyCoverage: {
      policy: compiled.policyId,
      requiredSourceCount: compiled.requiredSources.length,
      requiredObservationCount: compiled.requiredObservations.length,
      invalidRules: compiled.invalidRules,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      duplicateSourceKeys: compiled.duplicateSourceKeys,
      duplicateSourceTitles: compiled.duplicateSourceTitles,
      duplicateObservationKeys: compiled.duplicateObservationKeys,
      invalidSources: compiled.invalidSources,
      invalidObservations: compiled.invalidObservations
    },
    sourceRevisionCoverage: {
      requestedSourceCount: requestedTitles.length,
      fetchedResolutionCount: fetchedTitles.length,
      duplicateFetchedTitles,
      missingFetchedTitles,
      unexpectedFetchedTitles,
      sourceEvidenceCount: sourceRows.length,
      completeSourceEvidenceCount: sourceRows.length - incompleteSources.length,
      incompleteSources: incompleteSources.map(source => ({ sourceKey: source.sourceKey, requestedTitle: source.requestedTitle, deficiencies: source.deficiencies }))
    },
    observationCoverage: {
      requiredObservationCountPerRecord: compiled.requiredObservations.length,
      observationCount: observationRows.length,
      exactSingleObservationCount: observationRows.filter(observation => observation.exactSingleOccurrence).length,
      incompleteObservations: incompleteObservations.map(observation => ({ sourceKey: observation.sourceKey, observationKey: observation.observationKey, occurrenceCount: observation.occurrenceCount }))
    },
    semanticPromotionCoverage: {
      subjectDispositionBindingOrReviewMutationMemberCandidateKeys: subjectOrReviewMutations,
      canonicalActivitySubjectBindingCount: records.filter(record => record.canonicalActivitySubjectBinding !== null).length,
      canonicalActivitySubjectDeclarationVerdictCount: records.filter(record => record.activityInfoboxSchemaSemanticsReview?.canonicalActivitySubjectDeclarationVerdict !== null).length,
      canonicalActivityScopeClassificationCount: records.filter(record => record.activityInfoboxSchemaSemanticsReview?.canonicalActivityScopeVerdict !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.activityInfoboxSchemaSemanticsReview?.repeatabilityVerdict !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReview?.state !== 'unreviewed').length,
      mechanicsReviewedCount: records.filter(record => record.mechanicsReview?.state !== 'unreviewed').length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedDownstreamPromotionMemberCandidateKeys: downstreamPromotions
    },
    accountStateFindings,
    evidencePacketAttemptCoverageComplete,
    activityInfoboxSchemaSemanticsEvidenceCoverageComplete: evidenceCoverageComplete,
    canonicalActivitySubjectBindingReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(incompleteSources.length ? ['one_or_more_required_schema_sources_incomplete'] : []),
      ...(incompleteObservations.length ? ['one_or_more_required_schema_observations_missing_or_duplicated'] : []),
      'activity_infobox_schema_evidence_requires_semantic_disposition',
      'schema_evidence_does_not_independently_bind_canonical_activity_subject',
      'canonical_activity_subject_binding_unresolved',
      'canonical_activity_scope_review_incomplete',
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: evidencePacketAttemptCoverageComplete
  };
}
