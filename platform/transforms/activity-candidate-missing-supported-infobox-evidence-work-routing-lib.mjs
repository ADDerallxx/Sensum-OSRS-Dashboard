import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'sourceEvidenceAndPriorityPacketSnapshotsMustBeExplicitlySelected',
  'bothManifestsRawRecordsPoliciesAndHashesMustRevalidate',
  'packetEmbeddedSourceEvidenceMustMatchTheSelectedSourceEvidenceExactly',
  'onlyRecordsWithNoSupportedInfoboxEvidenceMayEnterTheWorkQueue',
  'directAbsenceUnsupportedInfoboxLikeAliasTransclusionAndCompositeConditionsMustRemainDistinct',
  'retainedSignaturesRootTemplatesCategoriesLeadHeadingsAndPacketObligationsMustRemainExact',
  'absenceOfASupportedInfoboxCannotEstablishAbsenceOfAnActivityOrRequirement',
  'unknownAliasOrTransclusionProvenanceMustRemainUnresolved',
  'compositeOrContainerStatusRequiresExplicitHumanReview',
  'oneWorkRoutePerEligibleCandidateMustPreservePacketOrder',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'identityRepeatabilityMembershipRequirementsVariantsXpTimingMechanicsAndOptimizerPromotionAreForbidden',
  'currentAccountStateIsForbidden'
];

const EXPECTED_CONDITION_STATES = [
  'present_supported_direct_invocation',
  'absent_from_revision_pinned_source_evidence',
  'unsupported_infobox_like_invocation_observed',
  'no_unsupported_infobox_like_invocation_observed',
  'unresolved_alias_equivalence_graph_not_bound',
  'unresolved_revision_pinned_expansion_provenance_not_bound',
  'unresolved_composite_or_container_subject_boundary_review_required'
];

const EXPECTED_EVIDENCE_CHANNELS = [
  'exact_revision_root_template_invocation_inventory',
  'revision_pinned_template_alias_and_equivalence_graph',
  'revision_pinned_template_expansion_and_transclusion_provenance',
  'source_page_subject_boundary_human_review',
  'composite_container_and_member_enumeration_evidence_when_applicable'
];

const unique = values => [...new Set(values)];
const sorted = values => [...(values || [])].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, keys = []) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|route|routes|label|labels|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|route|label|alias).*(?:override|exception)s?$/i;
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

export function compileActivityCandidateMissingSupportedInfoboxEvidenceWorkRoutingPolicy(
  policy = {}, sourceEvidencePolicy = {}, packetPolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidBindings = [];
  if (policy.policy !== 'sensum.activity-candidate-missing-supported-infobox-evidence-work-routing-policy.v1') invalidBindings.push('policy');
  if (policy.inputSourceEvidencePolicy !== sourceEvidencePolicy.policy
    || policy.inputSourceEvidencePolicyContentHash !== contentHash(sourceEvidencePolicy)) invalidBindings.push('inputSourceEvidencePolicy');
  if (policy.inputPacketPolicy !== packetPolicy.policy
    || policy.inputPacketPolicyContentHash !== contentHash(packetPolicy)) invalidBindings.push('inputPacketPolicy');
  if (policy.inputSourceEvidenceDomain !== 'activity-candidate-source-evidence'
    || policy.inputPacketDomain !== packetPolicy.outputDomain) invalidBindings.push('inputDomains');
  if (policy.recordContract !== 'sensum.activity-candidate-missing-supported-infobox-evidence-work-routing.v1'
    || policy.auditContract !== 'sensum.activity-candidate-missing-supported-infobox-evidence-work-routing-audit.v1'
    || !policy.outputDomain || !policy.recordState) invalidBindings.push('contractsOrOutput');
  if (!same(policy.structuralConditionStates, EXPECTED_CONDITION_STATES, contentHash)) invalidBindings.push('structuralConditionStates');
  if (!same(policy.requiredEvidenceChannels, EXPECTED_EVIDENCE_CHANNELS, contentHash)) invalidBindings.push('requiredEvidenceChannels');
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: !invalidRules.length && !invalidBindings.length && !forbidden.length,
    invalidRules: unique(invalidRules),
    invalidBindings,
    forbiddenPolicyPaths: forbidden
  };
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function sourceRecordValid(record, contentHash = hash) {
  return record?.contentHash === contentHash(without(record, ['contentHash']));
}

function packetRecordValid(record, contentHash = hash) {
  const intrinsic = without(record, ['contentHash']);
  const base = without(intrinsic, ['recordContentHash']);
  return record?.contentHash === contentHash(intrinsic) && record?.recordContentHash === contentHash(base);
}

function snapshotAssessment(raw, records, manifest, snapshot, domain, policy, contentHash = hash) {
  const sourcePolicyMatches = typeof manifest?.source?.policy === 'string'
    ? manifest.source.policy === policy.policy
    : manifest?.source?.policy?.id === policy.policy && manifest.source.policy.contentHash === contentHash(policy);
  const checks = {
    explicitSnapshotSelected: snapshot?.explicit === true && Boolean(snapshot?.directory),
    manifestContractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === domain,
    recordCountAndRawHashMatch: manifest?.records === records.length && manifest?.contentHash === contentHash(raw),
    snapshotBindingMatchesManifest: snapshot?.contentHash === manifest?.contentHash && snapshot?.createdAt === manifest?.createdAt,
    createdAtValid: validIso(manifest?.createdAt),
    sourcePolicyMatches
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function inputValidation(context) {
  const contentHash = context.contentHash || hash;
  const compiled = compileActivityCandidateMissingSupportedInfoboxEvidenceWorkRoutingPolicy(
    context.policy, context.sourceEvidencePolicy, context.packetPolicy, contentHash
  );
  const sourceAssessment = snapshotAssessment(
    context.sourceEvidenceRaw, context.sourceEvidenceRecords || [], context.sourceEvidenceManifest,
    context.sourceEvidenceSnapshot, context.policy?.inputSourceEvidenceDomain, context.sourceEvidencePolicy, contentHash
  );
  const packetAssessment = snapshotAssessment(
    context.packetRaw, context.packetRecords || [], context.packetManifest,
    context.packetSnapshot, context.policy?.inputPacketDomain, context.packetPolicy, contentHash
  );
  const invalidSourceKeys = (context.sourceEvidenceRecords || []).filter(record => !sourceRecordValid(record, contentHash)).map(record => record.candidateKey || 'unknown');
  const invalidPacketKeys = (context.packetRecords || []).filter(record => !packetRecordValid(record, contentHash)).map(record => record.candidateKey || 'unknown');
  const sourceByKey = new Map((context.sourceEvidenceRecords || []).map(record => [record.candidateKey, record]));
  const sourceKeys = (context.sourceEvidenceRecords || []).map(record => record.candidateKey);
  const packetKeys = (context.packetRecords || []).map(record => record.candidateKey);
  const embeddedSourceMismatches = (context.packetRecords || []).filter(packet => {
    const source = sourceByKey.get(packet.candidateKey);
    return !source || packet.pipelineBindings?.sourceEvidenceContentHash !== source.contentHash
      || !same(packet.sourceEvidence, source, contentHash)
      || packet.sourcePageIdentity?.sourcePageId !== source.sourcePageId
      || String(packet.sourcePageIdentity?.sourceRevision) !== String(source.sourceRevision)
      || packet.sourcePageIdentity?.sourceContentHash !== source.sourceContentHash;
  }).map(packet => packet.candidateKey || 'unknown');
  const sourceAudit = context.sourceEvidenceManifest?.source?.audit || {};
  const derivedMissingKeys = (context.sourceEvidenceRecords || []).filter(record => record.infoboxEvidence == null).map(record => record.candidateKey);
  const sourceAuditValid = sourceAudit.contract === context.sourceEvidencePolicy?.auditContract
    && sourceAudit.publishable === true && sourceAudit.sourceEvidenceCoverageComplete === true
    && sourceAudit.semanticReviewComplete === false && sourceAudit.completeActivityUniverse === false
    && sourceAudit.sourceAlignment?.allPageIdsRevisionsAndContentHashesAligned === true
    && sourceAudit.semanticPromotionCoverage?.unsupportedPromotionCandidateKeys?.length === 0
    && same(sorted(sourceAudit.structuralEvidenceCoverage?.missingSupportedInfoboxCandidateKeys || []), sorted(derivedMissingKeys), contentHash);
  const packetAudit = context.packetManifest?.source?.audit || {};
  const packetAuditValid = packetAudit.contract === context.packetPolicy?.auditContract
    && packetAudit.publishable === true && packetAudit.packetConsolidationComplete === true
    && packetAudit.humanReviewComplete === false && packetAudit.completeActivityUniverse === false
    && packetAudit.packetCoverage?.packetCount === (context.packetRecords || []).length
    && packetAudit.packetCoverage?.completePacketCount === (context.packetRecords || []).length
    && packetAudit.semanticPreservationCoverage?.optimizerEligibleCount === 0
    && packetAudit.semanticPreservationCoverage?.automaticVerificationCount === 0;
  const exactCandidateSets = !duplicates(sourceKeys).length && !duplicates(packetKeys).length
    && same(sorted(sourceKeys), sorted(packetKeys), contentHash);
  return {
    complete: compiled.valid && sourceAssessment.complete && packetAssessment.complete
      && !invalidSourceKeys.length && !invalidPacketKeys.length && !embeddedSourceMismatches.length
      && exactCandidateSets && sourceAuditValid && packetAuditValid,
    compiled, sourceAssessment, packetAssessment, invalidSourceKeys, invalidPacketKeys,
    embeddedSourceMismatches, exactCandidateSets, sourceAuditValid, packetAuditValid, derivedMissingKeys
  };
}

function structuralConditionAssessment(source = {}) {
  const rootTemplates = source.pageTypeEvidence?.rootTemplates || [];
  const unsupportedInfoboxLikeInvocations = rootTemplates.filter(item => /^infobox(?:\s|$)/i.test(String(item.template || '')));
  return {
    supportedDirectInfoboxInvocation: {
      state: source.infoboxEvidence == null
        ? 'absent_from_revision_pinned_source_evidence'
        : 'present_supported_direct_invocation',
      observedSupportedInfobox: source.infoboxEvidence ? structuredClone(source.infoboxEvidence) : null
    },
    unsupportedInfoboxLikeInvocation: {
      state: unsupportedInfoboxLikeInvocations.length
        ? 'unsupported_infobox_like_invocation_observed'
        : 'no_unsupported_infobox_like_invocation_observed',
      invocations: structuredClone(unsupportedInfoboxLikeInvocations)
    },
    aliasOrEquivalenceCondition: {
      state: 'unresolved_alias_equivalence_graph_not_bound',
      verdict: null
    },
    transclusionOrExpansionCondition: {
      state: 'unresolved_revision_pinned_expansion_provenance_not_bound',
      verdict: null
    },
    compositeOrContainerCondition: {
      state: 'unresolved_composite_or_container_subject_boundary_review_required',
      verdict: null
    }
  };
}

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests|currentBaseLevel|targetBaseLevel|currentLevel|currentXp)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  values.forEach((value, index) => visit(value, `[${index}]`));
  return sorted(unique(findings));
}

function derive(context) {
  const contentHash = context.contentHash || hash;
  const validation = inputValidation({ ...context, contentHash });
  if (!validation.complete) return { validation, records: [] };
  const sourceByKey = new Map((context.sourceEvidenceRecords || []).map(record => [record.candidateKey, record]));
  const records = (context.packetRecords || []).filter(packet => sourceByKey.get(packet.candidateKey)?.infoboxEvidence == null).map((packet, index) => {
    const source = sourceByKey.get(packet.candidateKey);
    const base = {
      contract: context.policy.recordContract,
      workRouteKey: `${packet.reviewPacketKey}|missing-supported-infobox-evidence-work-route`,
      workRouteOrdinal: index + 1,
      candidateKey: packet.candidateKey,
      reviewPacketKey: packet.reviewPacketKey,
      sourceBindings: {
        sourceEvidenceSnapshotContentHash: context.sourceEvidenceSnapshot.contentHash,
        sourceEvidenceContentHash: source.contentHash,
        sourceContentHash: source.sourceContentHash,
        sourcePageId: source.sourcePageId,
        sourceRevision: String(source.sourceRevision),
        packetSnapshotContentHash: context.packetSnapshot.contentHash,
        packetRecordContentHash: packet.recordContentHash,
        packetOuterContentHash: packet.contentHash
      },
      sourcePageIdentity: {
        sourcePageId: source.sourcePageId,
        resolvedTitle: source.resolvedTitle,
        sourceRevision: String(source.sourceRevision),
        sourceTimestamp: source.sourceTimestamp,
        sourceUrl: source.sourceUrl,
        sourceContentHash: source.sourceContentHash,
        sourceContentBytes: source.sourceContentBytes
      },
      sourceSignatureContexts: structuredClone(source.sourceSignatureContexts || []),
      retainedStructuralEvidence: {
        pageEntityTypes: structuredClone(source.pageTypeEvidence?.entityTypes || []),
        rootTemplates: structuredClone(source.pageTypeEvidence?.rootTemplates || []),
        directCategories: structuredClone(source.pageTypeEvidence?.directCategories || []),
        leadParagraphs: structuredClone(source.leadParagraphEvidence || []),
        headings: structuredClone(source.headingEvidence || []),
        supportedInfoboxEvidence: null,
        lexicalReviewCandidates: structuredClone(source.lexicalReviewCandidates || [])
      },
      packetReviewObligations: structuredClone(packet.reviewObligations || {}),
      structuralConditionAssessment: structuralConditionAssessment(source),
      requiredEvidenceChannels: [...context.policy.requiredEvidenceChannels],
      workRoute: {
        routeKey: 'missing_supported_infobox_structural_evidence_reconciliation',
        routeState: 'blocked_pending_alias_expansion_and_subject_boundary_evidence',
        completionRequires: [
          'exact_alias_or_equivalence_disposition',
          'exact_transclusion_or_expansion_provenance_disposition',
          'explicit_composite_or_container_subject_boundary_decision'
        ]
      },
      explicitNonClaims: [
        'missing_supported_infobox_does_not_prove_missing_activity',
        'missing_supported_infobox_does_not_prove_no_requirements',
        'page_entity_type_does_not_establish_canonical_identity',
        'lead_category_heading_and_lexical_evidence_require_semantic_review',
        'alias_transclusion_composite_and_container_conditions_are_unresolved',
        'repeatability_membership_variants_xp_timing_and_mechanics_are_not_established',
        'optimizer_eligibility_and_verified_best_are_not_authorized'
      ],
      humanDecisionRecorded: false,
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      repeatabilityClassification: null,
      membershipOrVariantApplication: false,
      requirementsVariantsXpTimingAndMechanicsComplete: false,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      state: context.policy.recordState
    };
    return { ...base, recordContentHash: contentHash(base) };
  });
  return { validation, records };
}

function markdownFor(records = []) {
  const lines = [
    '# Missing supported infobox evidence-work queue', '',
    '> These are revision-pinned structural evidence routes, not activity classifications or optimizer candidates.', '',
    'A missing supported infobox proves only that the selected exact source evidence did not contain a supported direct invocation. Alias, transclusion, wrapper, composite, and container causes remain separate unresolved questions.', ''
  ];
  for (const record of records) {
    const identity = record.sourcePageIdentity;
    lines.push(`## ${record.workRouteOrdinal}. ${identity.resolvedTitle}`, '');
    lines.push(`- Exact source: [revision ${identity.sourceRevision}](https://oldschool.runescape.wiki/w/Special:Redirect/revision/${identity.sourceRevision})`);
    lines.push(`- Candidate: \`${record.candidateKey}\``);
    lines.push(`- Review packet: \`${record.reviewPacketKey}\``);
    lines.push(`- Root templates retained: ${record.retainedStructuralEvidence.rootTemplates.length}`);
    lines.push(`- Lead paragraphs retained: ${record.retainedStructuralEvidence.leadParagraphs.length}`);
    lines.push(`- Headings retained: ${record.retainedStructuralEvidence.headings.length}`);
    lines.push(`- Unsupported infobox-like invocations observed: ${record.structuralConditionAssessment.unsupportedInfoboxLikeInvocation.invocations.length}`, '');
    lines.push('### Structural condition states', '');
    for (const [key, value] of Object.entries(record.structuralConditionAssessment)) lines.push(`- ${key}: \`${value.state}\``);
    lines.push('', '### Required evidence channels', '');
    for (const channel of record.requiredEvidenceChannels) lines.push(`- \`${channel}\``);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

export function buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRoutingArtifacts(records = [], contentHash = hash) {
  const markdown = markdownFor(records);
  const machineJson = JSON.stringify(records, null, 2) + '\n';
  const artifactManifest = {
    contract: 'sensum.activity-candidate-missing-supported-infobox-evidence-work-routing-artifact-manifest.v1',
    records: records.length,
    artifacts: [
      { file: 'evidence-work-queue.md', kind: 'human_readable_missing_infobox_evidence_work_queue', contentHash: contentHash(markdown), bytes: Buffer.byteLength(markdown, 'utf8') },
      { file: 'evidence-work-queue.json', kind: 'machine_readable_missing_infobox_evidence_work_queue', contentHash: contentHash(machineJson), bytes: Buffer.byteLength(machineJson, 'utf8') }
    ]
  };
  const artifactManifestJson = JSON.stringify(artifactManifest, null, 2) + '\n';
  return { markdown, machineJson, artifactManifest, artifactManifestJson };
}

export function auditActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(records = [], context = {}, artifacts = null) {
  const completeContext = { ...context, contentHash: context.contentHash || hash };
  const derived = derive(completeContext);
  const expectedByKey = new Map(derived.records.map(record => [record.workRouteKey, record]));
  const expectedKeys = derived.records.map(record => record.workRouteKey);
  const actualKeys = records.map(record => record.workRouteKey);
  const duplicateKeys = duplicates(actualKeys);
  const recordMismatches = records.filter(record => !expectedByKey.has(record.workRouteKey)
    || !same(record, expectedByKey.get(record.workRouteKey), completeContext.contentHash)).map(record => record.workRouteKey || 'unknown');
  const setOrderAndOrdinalsExact = !duplicateKeys.length && same(actualKeys, expectedKeys, completeContext.contentHash)
    && records.every((record, index) => record.workRouteOrdinal === index + 1);
  const expectedArtifacts = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRoutingArtifacts(records, completeContext.contentHash);
  const artifactMismatches = [];
  if (!artifacts) artifactMismatches.push('artifacts_missing');
  else {
    if (!same(artifacts.markdown, expectedArtifacts.markdown, completeContext.contentHash)) artifactMismatches.push('markdown');
    if (!same(artifacts.machineJson, expectedArtifacts.machineJson, completeContext.contentHash)) artifactMismatches.push('machine_json');
    if (!same(artifacts.artifactManifestJson, expectedArtifacts.artifactManifestJson, completeContext.contentHash)) artifactMismatches.push('artifact_manifest');
  }
  const unsupportedPromotions = records.filter(record => record.humanDecisionRecorded !== false
    || record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null
    || record.repeatabilityClassification !== null || record.membershipOrVariantApplication !== false
    || record.requirementsVariantsXpTimingAndMechanicsComplete !== false || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false || record.accountIndependent !== true)
    .map(record => record.workRouteKey || 'unknown');
  const accountFindings = accountStateFindings(records);
  const directAbsentCount = records.filter(record => record.structuralConditionAssessment?.supportedDirectInfoboxInvocation?.state === 'absent_from_revision_pinned_source_evidence').length;
  const unsupportedObservedCount = records.filter(record => record.structuralConditionAssessment?.unsupportedInfoboxLikeInvocation?.state === 'unsupported_infobox_like_invocation_observed').length;
  const aliasUnresolvedCount = records.filter(record => record.structuralConditionAssessment?.aliasOrEquivalenceCondition?.state === 'unresolved_alias_equivalence_graph_not_bound').length;
  const transclusionUnresolvedCount = records.filter(record => record.structuralConditionAssessment?.transclusionOrExpansionCondition?.state === 'unresolved_revision_pinned_expansion_provenance_not_bound').length;
  const compositeUnresolvedCount = records.filter(record => record.structuralConditionAssessment?.compositeOrContainerCondition?.state === 'unresolved_composite_or_container_subject_boundary_review_required').length;
  const structuralBlockers = [];
  if (!derived.validation.complete) structuralBlockers.push('source_evidence_or_priority_packet_input_revalidation_failed');
  if (!setOrderAndOrdinalsExact || duplicateKeys.length || recordMismatches.length) structuralBlockers.push('missing_infobox_work_route_set_order_or_content_mismatch');
  if (records.length !== derived.validation.derivedMissingKeys.length || directAbsentCount !== records.length) structuralBlockers.push('missing_supported_infobox_candidate_selection_not_exact');
  if (aliasUnresolvedCount !== records.length || transclusionUnresolvedCount !== records.length || compositeUnresolvedCount !== records.length) structuralBlockers.push('unresolved_structural_conditions_were_collapsed_or_silently_resolved');
  if (artifactMismatches.length) structuralBlockers.push('evidence_work_route_artifacts_missing_or_not_deterministic');
  if (unsupportedPromotions.length) structuralBlockers.push('evidence_work_routing_created_unsupported_semantic_or_optimizer_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = !structuralBlockers.length;
  return {
    contract: context.policy?.auditContract,
    policyCoverage: derived.validation.compiled,
    inputCoverage: {
      sourceEvidenceSnapshotAssessment: derived.validation.sourceAssessment,
      packetSnapshotAssessment: derived.validation.packetAssessment,
      invalidSourceEvidenceKeys: derived.validation.invalidSourceKeys,
      invalidPacketKeys: derived.validation.invalidPacketKeys,
      embeddedSourceEvidenceMismatches: derived.validation.embeddedSourceMismatches,
      exactCandidateSets: derived.validation.exactCandidateSets,
      sourceEvidenceAuditValid: derived.validation.sourceAuditValid,
      packetAuditValid: derived.validation.packetAuditValid
    },
    selectionCoverage: {
      sourceEvidenceRecordCount: (context.sourceEvidenceRecords || []).length,
      priorityPacketRecordCount: (context.packetRecords || []).length,
      expectedMissingSupportedInfoboxCandidateCount: derived.validation.derivedMissingKeys.length,
      workRouteRecordCount: records.length,
      selectedCandidateKeys: records.map(record => record.candidateKey),
      setOrderAndOrdinalsExact,
      duplicateWorkRouteKeys: duplicateKeys,
      recordMismatches
    },
    structuralConditionCoverage: {
      directSupportedInfoboxAbsentCount: directAbsentCount,
      unsupportedInfoboxLikeInvocationObservedCount: unsupportedObservedCount,
      aliasEquivalenceUnresolvedCount: aliasUnresolvedCount,
      transclusionExpansionUnresolvedCount: transclusionUnresolvedCount,
      compositeContainerUnresolvedCount: compositeUnresolvedCount,
      retainedSourceSignatureContextCount: records.reduce((sum, record) => sum + record.sourceSignatureContexts.length, 0),
      retainedRootTemplateCount: records.reduce((sum, record) => sum + record.retainedStructuralEvidence.rootTemplates.length, 0),
      retainedDirectCategoryCount: records.reduce((sum, record) => sum + record.retainedStructuralEvidence.directCategories.length, 0),
      retainedLeadParagraphCount: records.reduce((sum, record) => sum + record.retainedStructuralEvidence.leadParagraphs.length, 0),
      retainedHeadingCount: records.reduce((sum, record) => sum + record.retainedStructuralEvidence.headings.length, 0),
      retainedLexicalReviewCandidateCount: records.reduce((sum, record) => sum + record.retainedStructuralEvidence.lexicalReviewCandidates.length, 0),
      retainedPacketEvidenceDomainObligationCount: records.reduce((sum, record) => sum + (record.packetReviewObligations.requiredEvidenceDomains || []).length, 0),
      requiredEvidenceChannelCount: records.reduce((sum, record) => sum + record.requiredEvidenceChannels.length, 0)
    },
    artifactCoverage: {
      artifactCount: artifacts ? 3 : 0,
      artifactManifestEntryCount: artifacts?.artifactManifest?.artifacts?.length || 0,
      artifactMismatches,
      deterministicArtifactReconstructionComplete: Boolean(artifacts) && !artifactMismatches.length
    },
    semanticPreservationCoverage: {
      humanDecisionRecordedCount: records.filter(record => record.humanDecisionRecorded).length,
      canonicalIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.repeatabilityClassification !== null).length,
      membershipOrVariantApplicationCount: records.filter(record => record.membershipOrVariantApplication).length,
      requirementsVariantsXpTimingAndMechanicsCompleteCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    evidenceWorkRoutingComplete: publishable && records.length > 0,
    humanReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'template_alias_or_equivalence_graph_not_bound',
      'template_expansion_or_transclusion_provenance_not_bound',
      'composite_container_and_member_boundary_review_pending',
      'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_not_established',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(context = {}) {
  const completeContext = { ...context, contentHash: context.contentHash || hash };
  const derived = derive(completeContext);
  const artifacts = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRoutingArtifacts(derived.records, completeContext.contentHash);
  const audit = auditActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(derived.records, completeContext, artifacts);
  return { records: derived.records, artifacts, audit };
}
