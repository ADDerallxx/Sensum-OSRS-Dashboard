import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'candidateSourceDispositionAndRoutingSnapshotsMustBeExplicitlySelected',
  'allFourManifestsRawFilesAndRecordHashesMustRevalidate',
  'sourceEvidenceDispositionAndRoutingManifestChainMustBindExactly',
  'onlyActivityDiscoveryCandidatesMayEnterPackets',
  'activityCandidatesMustRetainDirectCrossSourceUnlockEvidence',
  'renderedPageWithoutUnlockEvidenceCandidatesAreASeparatePopulation',
  'allFourCandidateSetsMustMatchExactly',
  'onePacketPerActivityDiscoveryCandidate',
  'candidateIdentityRevisionSourceAndPipelineHashesMustJoinExactly',
  'allRenderedGuideUnlockSourceInfoboxLeadHeadingLexicalDispositionAndRouteEvidenceMustBePreserved',
  'conflictingSourceDeclarationsMustRemainExplicitAndPrioritized',
  'requiredEvidenceDomainsAreReviewObligationsNotVerifiedFacts',
  'decisionTemplatesMustRemainCompletelyBlank',
  'packetGenerationDoesNotRecordOrApplyAReviewDecision',
  'packetGenerationCannotEstablishCanonicalIdentityRepeatabilityAtomicityMembershipRequirementsVariantsXpTimingMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsSkillsRoutesAndAliasesCannotAlterPolicyBehavior',
  'batchesMustBeContiguousCompleteNonOverlappingAndAtMostTheConfiguredSize',
  'markdownAndDecisionArtifactsMustReproduceExactlyFromPackets',
  'currentAccountStateIsForbidden'
];
const NON_CLAIMS = [
  'activity_page_discovery_does_not_establish_a_canonical_game_entity',
  'activity_or_minigame_page_type_does_not_establish_a_trainable_activity',
  'source_subject_disposition_does_not_establish_canonical_identity',
  'lexical_review_candidates_are_not_parsed_game_facts',
  'work_routing_describes_evidence_obligations_not_verified_facts',
  'repeatability_is_not_established',
  'atomicity_collection_membership_and_variant_scope_are_not_established',
  'requirements_unlocks_xp_timing_rates_and_mechanics_are_not_established',
  'candidate_universe_completeness_is_not_established',
  'account_state_is_not_evaluated',
  'optimizer_eligibility_is_not_established',
  'verified_best_is_not_authorized'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const stable = value => JSON.stringify(value);
const exactRevisionUrl = revision => `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}`;
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const withoutContentHash = record => {
  const { contentHash, ...rest } = record || {};
  return rest;
};

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|title|titles|candidateKey|candidateKeys|revision|revisions|skill|skills|routeKey|routeKeys|alias|aliases|override|overrides)$/i;
  const visit = (value, path = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileActivityCandidatePriorityHumanReviewPacketPolicy(policy = {}) {
  const expected = {
    candidateContract: 'sensum.cross-source-entity-activity-candidate.v1',
    sourceEvidenceContract: 'sensum.activity-candidate-source-evidence.v1',
    subjectDispositionContract: 'sensum.activity-candidate-subject-disposition.v1',
    workRoutingContract: 'sensum.activity-candidate-evidence-work-routing.v1',
    packetContract: 'sensum.activity-candidate-priority-human-review-packet.v1',
    decisionTemplateContract: 'sensum.activity-candidate-priority-human-review-decision-template.v1',
    auditContract: 'sensum.activity-candidate-priority-human-review-packet-consolidation-audit.v1',
    candidateDomain: 'cross-source-entity-activity-candidate',
    sourceEvidenceDomain: 'activity-candidate-source-evidence',
    subjectDispositionDomain: 'activity-candidate-subject-disposition',
    workRoutingDomain: 'activity-candidate-evidence-work-routing',
    outputDomain: 'activity-candidate-priority-human-review-packet'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const enumFields = ['allowedSubjectDispositionDecisions', 'allowedRepeatabilityDecisions', 'allowedAtomicityDecisions', 'allowedEvidenceDomainStatuses'];
  const invalidEnums = enumFields.filter(key => !Array.isArray(policy[key]) || policy[key].length === 0 || unique(policy[key]).length !== policy[key].length || policy[key].some(value => typeof value !== 'string' || !value));
  const forbidden = forbiddenPolicyPaths(policy);
  const batchSize = Number(policy.batchSize);
  return {
    valid: invalidBindings.length === 0 && invalidRules.length === 0 && invalidEnums.length === 0 && forbidden.length === 0 && Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 50,
    invalidBindings,
    invalidRules: unique(invalidRules),
    invalidEnums,
    forbiddenPolicyPaths: forbidden,
    batchSize
  };
}

export function findActivityCandidatePriorityHumanReviewPacketAccountState(records = []) {
  const findings = [];
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|targetLevel|username|accountName|accountState|accountSnapshot|bank|bankItems|ownedEquipment|preferences)$/i;
  const visit = (value, path, recordKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, recordKey));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push({ recordKey, path: next, value: child });
      visit(child, next, recordKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record?.candidateKey || `record-${index}`));
  return findings;
}

function recordHashValid(record = {}) {
  return validHash(record.contentHash) && hash(withoutContentHash(record)) === record.contentHash;
}

function activityCandidates(records = []) {
  return records.filter(record => record.activityDiscoveryCandidate === true);
}

function identityProjection(record = {}) {
  return {
    candidateKey: record.candidateKey,
    sourcePageId: Number(record.sourcePageId),
    resolvedTitle: record.resolvedTitle,
    skillKeys: sorted(record.skillKeys || []),
    statementKeys: sorted(record.statementKeys || []),
    sourceRevision: String(record.sourceRevision || ''),
    sourceTimestamp: record.sourceTimestamp || null,
    sourceUrl: record.sourceUrl || null,
    sourceContentHash: record.sourceContentHash || null,
    sourceSignatureContexts: record.sourceSignatureContexts || []
  };
}

function candidateIdentityProjection(candidate = {}) {
  const rendered = candidate.sourceContexts?.renderedEvidence?.targetPageIdentity || {};
  const unlock = candidate.sourceContexts?.unlockEvidence || {};
  return {
    candidateKey: candidate.candidateKey,
    sourcePageId: Number(candidate.pageIdentity?.sourcePageId),
    resolvedTitle: candidate.pageIdentity?.resolvedTitle,
    skillKeys: sorted(candidate.skillKeys || []),
    statementKeys: sorted(candidate.statementKeys || []),
    sourceRevision: String(candidate.pageIdentity?.unlockSourceRevision || ''),
    sourceTimestamp: unlock.source?.sourceTimestamp || rendered.sourceTimestamp || null,
    sourceUrl: unlock.source?.sourceUrl || rendered.sourceUrl || null,
    sourceContentHash: unlock.source?.sourceContentHash || null,
    sourceSignatureContexts: unlock.targetReferences || []
  };
}

function directActivityDiscoveryCandidateValid(record = {}, policy = {}) {
  const unlock = record.sourceContexts?.unlockEvidence || {};
  return record.contract === policy.candidateContract
    && record.activityDiscoveryCandidate === true
    && record.candidateKind === 'activity_page_identity_candidate'
    && record.queuedForSemanticReview === true
    && record.reviewStatus === 'unreviewed'
    && record.repeatabilityClassification === null
    && record.canonicalGameEntityIdentity === null
    && record.canonicalActivityIdentity === null
    && record.optimizerEligible === false
    && record.accountIndependent === true
    && unlock.activityPageCandidate === true
    && unlock.pageTypeClassified === true
    && Array.isArray(unlock.targetReferences)
    && unlock.targetReferences.length > 0
    && unlock.targetReferences.every(reference => reference.activityPageCandidate === true)
    && !record.blockers?.includes('one_or_more_rendered_pages_lack_unlock_evidence');
}

function sourceEvidenceValid(record = {}, policy = {}) {
  return record.contract === policy.sourceEvidenceContract
    && record.state === 'review_ready'
    && record.accountIndependent === true
    && record.semanticIdentityReview?.state === 'unreviewed'
    && record.repeatabilityReview?.state === 'unreviewed'
    && record.canonicalGameEntityIdentity === null
    && record.canonicalActivityIdentity === null
    && record.optimizerEligible === false
    && record.revisionAlignment
    && Object.values(record.revisionAlignment).every(Boolean)
    && Number(record.sourceContentBytes) >= 0
    && (record.infoboxEvidence === null || (typeof record.infoboxEvidence === 'object' && record.infoboxEvidence.balanced === true && Array.isArray(record.infoboxEvidence.parameters)))
    && Array.isArray(record.leadParagraphEvidence)
    && Array.isArray(record.headingEvidence)
    && Array.isArray(record.lexicalReviewCandidates);
}

function dispositionValid(record = {}, policy = {}) {
  const state = record.subjectDisposition?.state;
  return record.contract === policy.subjectDispositionContract
    && ['subject_disposition_ready', 'blocked'].includes(record.state)
    && ['source_supported', 'blocked_conflicting_source_declarations', 'blocked_unmapped_infobox_type', 'unresolved_no_supported_source_declaration'].includes(state)
    && record.accountIndependent === true
    && record.repeatabilityReview?.state === 'unreviewed'
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.canonicalGameEntityIdentity === null
    && record.canonicalActivityIdentity === null
    && record.optimizerEligible === false;
}

function routingValid(record = {}, policy = {}) {
  return record.contract === policy.workRoutingContract
    && ['evidence_work_routed', 'blocked'].includes(record.state)
    && typeof record.routingDecision?.routeKey === 'string'
    && record.routingDecision.routeKey.length > 0
    && Array.isArray(record.routingDecision.requiredEvidenceDomains)
    && record.routingDecision.requiredEvidenceDomains.length > 0
    && record.accountIndependent === true
    && record.repeatabilityReview?.state === 'unreviewed'
    && record.memberExpansionReview?.state === 'unreviewed'
    && record.canonicalGameEntityIdentity === null
    && record.canonicalActivityIdentity === null
    && record.optimizerEligible === false;
}

function pipelineBindingValid(candidate, source, disposition, routing) {
  if (!candidate || !source || !disposition || !routing) return false;
  const candidateIdentity = candidateIdentityProjection(candidate);
  const sourceIdentity = identityProjection(source);
  const dispositionIdentity = identityProjection(disposition);
  const routingIdentity = identityProjection(routing);
  return source.sourceCandidateContentHash === candidate.contentHash
    && disposition.sourceEvidenceContentHash === source.contentHash
    && routing.sourceDispositionContentHash === disposition.contentHash
    && candidateIdentity.candidateKey === sourceIdentity.candidateKey
    && candidateIdentity.sourcePageId === sourceIdentity.sourcePageId
    && candidateIdentity.resolvedTitle === sourceIdentity.resolvedTitle
    && stable(candidateIdentity.skillKeys) === stable(sourceIdentity.skillKeys)
    && stable(candidateIdentity.statementKeys) === stable(sourceIdentity.statementKeys)
    && candidateIdentity.sourceRevision === sourceIdentity.sourceRevision
    && candidateIdentity.sourceTimestamp === sourceIdentity.sourceTimestamp
    && candidateIdentity.sourceUrl === sourceIdentity.sourceUrl
    && candidateIdentity.sourceContentHash === sourceIdentity.sourceContentHash
    && candidateIdentity.sourceSignatureContexts.length === sourceIdentity.sourceSignatureContexts.length
    && stable(sourceIdentity) === stable(dispositionIdentity)
    && stable(dispositionIdentity) === stable(routingIdentity)
    && stable(disposition.subjectDisposition) === stable(routing.sourceDisposition)
    && stable(disposition.dispositionSignals || []) === stable(routing.dispositionSignals || [])
    && stable(disposition.blockers || []) === stable(routing.sourceBlockers || []);
}

function blankDecisionTemplate(packetKey, candidateKey, requiredEvidenceDomains, policy) {
  return {
    contract: policy.decisionTemplateContract,
    reviewPacketKey: packetKey,
    candidateKey,
    subjectDispositionDecision: null,
    selectedSourceDisposition: null,
    canonicalGameEntityIdentityDecision: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentityDecision: null,
    canonicalActivityIdentity: null,
    repeatabilityDecision: null,
    atomicityDecision: null,
    memberExpansionDecision: null,
    memberKeys: [],
    evidenceDomainAssessments: requiredEvidenceDomains.map(domain => ({ domain, status: null, evidenceKeys: [], notes: null })),
    reviewEvidenceKeys: [],
    reviewedSourceRevisions: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null
  };
}

function decisionTemplateBlank(template = {}) {
  return template.subjectDispositionDecision === null
    && template.selectedSourceDisposition === null
    && template.canonicalGameEntityIdentityDecision === null
    && template.canonicalGameEntityIdentity === null
    && template.canonicalActivityIdentityDecision === null
    && template.canonicalActivityIdentity === null
    && template.repeatabilityDecision === null
    && template.atomicityDecision === null
    && template.memberExpansionDecision === null
    && Array.isArray(template.memberKeys) && template.memberKeys.length === 0
    && Array.isArray(template.reviewEvidenceKeys) && template.reviewEvidenceKeys.length === 0
    && Array.isArray(template.reviewedSourceRevisions) && template.reviewedSourceRevisions.length === 0
    && template.reviewer === null
    && template.reviewedAt === null
    && template.reviewNotes === null
    && Array.isArray(template.evidenceDomainAssessments)
    && template.evidenceDomainAssessments.every(item => item.status === null && item.notes === null && Array.isArray(item.evidenceKeys) && item.evidenceKeys.length === 0);
}

function reviewPriority(routing = {}) {
  const conflict = routing.routingDecision?.routeState === 'blocked_source_conflict';
  return {
    band: conflict ? 1 : 2,
    reason: conflict ? 'source_declaration_conflict_requires_resolution_before_semantic_review' : 'priority_activity_candidate_evidence_review'
  };
}

function orderedJoins(candidateRecords, sourceEvidenceRecords, subjectDispositionRecords, workRoutingRecords) {
  const selected = activityCandidates(candidateRecords);
  const sourceByKey = new Map(sourceEvidenceRecords.map(record => [record.candidateKey, record]));
  const dispositionByKey = new Map(subjectDispositionRecords.map(record => [record.candidateKey, record]));
  const routingByKey = new Map(workRoutingRecords.map(record => [record.candidateKey, record]));
  return selected.map(candidate => ({
    candidate,
    source: sourceByKey.get(candidate.candidateKey),
    disposition: dispositionByKey.get(candidate.candidateKey),
    routing: routingByKey.get(candidate.candidateKey)
  })).filter(join => join.source && join.disposition && join.routing).sort((left, right) => {
    const leftPriority = reviewPriority(left.routing).band;
    const rightPriority = reviewPriority(right.routing).band;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const routeOrder = String(left.routing?.routingDecision?.routeKey || '').localeCompare(String(right.routing?.routingDecision?.routeKey || ''));
    if (routeOrder) return routeOrder;
    return Number(left.source?.sourcePageId || 0) - Number(right.source?.sourcePageId || 0);
  });
}

function makePacket(join, ordinal, policy, contentHash = hash) {
  const { candidate, source, disposition, routing } = join;
  const packetKey = `${candidate.candidateKey}|priority-activity-human-review-packet`;
  const domains = sorted(unique(routing.routingDecision.requiredEvidenceDomains || []));
  const batchOrdinal = Math.floor((ordinal - 1) / policy.batchSize) + 1;
  const batchItemOrdinal = ((ordinal - 1) % policy.batchSize) + 1;
  const decisionTemplate = blankDecisionTemplate(packetKey, candidate.candidateKey, domains, policy);
  const base = {
    contract: policy.packetContract,
    reviewPacketKey: packetKey,
    packetOrdinal: ordinal,
    batchOrdinal,
    batchItemOrdinal,
    candidateKey: candidate.candidateKey,
    sourcePageIdentity: {
      sourcePageId: source.sourcePageId,
      resolvedTitle: source.resolvedTitle,
      sourceRevision: source.sourceRevision,
      sourceTimestamp: source.sourceTimestamp,
      sourceUrl: source.sourceUrl,
      sourceContentHash: source.sourceContentHash,
      sourceContentBytes: source.sourceContentBytes
    },
    sourceExactRevisionUrl: exactRevisionUrl(source.sourceRevision),
    pipelineBindings: {
      candidateContentHash: candidate.contentHash,
      sourceEvidenceContentHash: source.contentHash,
      subjectDispositionContentHash: disposition.contentHash,
      workRoutingContentHash: routing.contentHash
    },
    discoveryEvidence: candidate,
    sourceEvidence: source,
    subjectAssessment: disposition,
    workRoute: routing,
    reviewPriority: reviewPriority(routing),
    reviewObligations: {
      sourceDisposition: routing.routingDecision.routeState === 'blocked_source_conflict' ? 'resolve_bound_source_declaration_conflict' : 'confirm_or_reject_bound_source_disposition',
      canonicalGameEntityIdentity: 'establish_or_reject_from_explicit_bound_evidence',
      canonicalActivityIdentity: 'establish_only_after_subject_and_activity_boundary_review',
      repeatability: 'classify_from_explicit_semantic_evidence',
      atomicityAndMembership: 'classify_atomic_composite_or_reference_collection_and_expand_members_when_required',
      requiredEvidenceDomains: domains,
      expansionAxes: sorted(unique(routing.routingDecision.expansionAxes || []))
    },
    decisionTemplate,
    explicitNonClaims: NON_CLAIMS,
    decisionRecorded: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    atomicityClassification: null,
    memberExpansionReviewed: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      ...(routing.blockers || []),
      'explicit_human_activity_candidate_review_pending',
      'canonical_identity_repeatability_atomicity_and_membership_not_established',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    state: routing.routingDecision.routeState === 'blocked_source_conflict'
      ? 'priority_activity_review_packet_materialized_source_conflict_pending'
      : 'priority_activity_review_packet_materialized_human_decision_pending'
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function expectedPackets(inputs, policy, contentHash = hash) {
  return orderedJoins(inputs.candidateRecords, inputs.sourceEvidenceRecords, inputs.subjectDispositionRecords, inputs.workRoutingRecords)
    .map((join, index) => makePacket(join, index + 1, policy, contentHash));
}

function markdownText(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function renderPacketMarkdown(packet) {
  const disposition = packet.subjectAssessment.subjectDisposition || {};
  const route = packet.workRoute.routingDecision || {};
  const lines = [
    '<details>',
    `<summary>${String(packet.packetOrdinal).padStart(2, '0')} — ${markdownText(packet.sourcePageIdentity.resolvedTitle)} — ${markdownText(packet.reviewPriority.reason)}</summary>`,
    '',
    `- Candidate: \`${markdownText(packet.candidateKey)}\``,
    `- Exact source: [page ${packet.sourcePageIdentity.sourcePageId}, revision ${packet.sourcePageIdentity.sourceRevision}](${packet.sourceExactRevisionUrl})`,
    `- Skills: ${(packet.discoveryEvidence.skillKeys || []).map(markdownText).join(', ') || 'none recorded'}`,
    `- Source disposition state: \`${markdownText(disposition.state)}\``,
    `- Source disposition: \`${markdownText(disposition.disposition)}\``,
    `- Conflicting dispositions: ${(disposition.conflictingDispositions || []).map(value => `\`${markdownText(value)}\``).join(', ') || 'none'}`,
    `- Work route: \`${markdownText(route.routeKey)}\` (${markdownText(route.routeState)})`,
    '',
    '## Review obligations',
    '',
    `- Subject: ${markdownText(packet.reviewObligations.sourceDisposition)}`,
    `- Entity identity: ${markdownText(packet.reviewObligations.canonicalGameEntityIdentity)}`,
    `- Activity identity: ${markdownText(packet.reviewObligations.canonicalActivityIdentity)}`,
    `- Repeatability: ${markdownText(packet.reviewObligations.repeatability)}`,
    `- Atomicity/membership: ${markdownText(packet.reviewObligations.atomicityAndMembership)}`,
    `- Required evidence domains: ${packet.reviewObligations.requiredEvidenceDomains.map(value => `\`${markdownText(value)}\``).join(', ')}`,
    `- Expansion axes: ${packet.reviewObligations.expansionAxes.map(value => `\`${markdownText(value)}\``).join(', ') || 'none'}`,
    '',
    '## Pipeline bindings',
    '',
    '```json',
    JSON.stringify(packet.pipelineBindings, null, 2),
    '```',
    '',
    '## Discovery and guide evidence',
    '',
    '```json',
    JSON.stringify(packet.discoveryEvidence.sourceContexts, null, 2),
    '```',
    '',
    '## Exact-revision source evidence',
    '',
    '```json',
    JSON.stringify({
      sourceSignatureContexts: packet.sourceEvidence.sourceSignatureContexts,
      pageTypeEvidence: packet.sourceEvidence.pageTypeEvidence,
      infoboxEvidence: packet.sourceEvidence.infoboxEvidence,
      leadParagraphEvidence: packet.sourceEvidence.leadParagraphEvidence,
      headingEvidence: packet.sourceEvidence.headingEvidence,
      lexicalReviewCandidates: packet.sourceEvidence.lexicalReviewCandidates
    }, null, 2),
    '```',
    '',
    '## Source disposition and work route',
    '',
    '```json',
    JSON.stringify({
      infoboxTypeAssessment: packet.subjectAssessment.infoboxTypeAssessment,
      dispositionSignals: packet.subjectAssessment.dispositionSignals,
      subjectDisposition: packet.subjectAssessment.subjectDisposition,
      routingDecision: packet.workRoute.routingDecision
    }, null, 2),
    '```',
    '',
    '## Decision worksheet',
    '',
    '- [ ] Confirm one bound source disposition',
    '- [ ] Reject all bound source dispositions',
    '- [ ] Additional evidence required',
    '- Canonical game-entity identity:',
    '- Canonical activity identity:',
    '- Repeatability:',
    '- Atomicity / membership:',
    '- Reviewer:',
    '- Reviewed at:',
    '- Evidence keys:',
    '- Notes:',
    '',
    '## Explicit nonclaims',
    '',
    ...packet.explicitNonClaims.map(value => `- ${markdownText(value)}`),
    '',
    '</details>',
    ''
  ];
  return lines.join('\n');
}

export function buildActivityCandidatePriorityHumanReviewPacketArtifacts(records = [], policy = {}, contentHash = hash) {
  const batches = [];
  const batchCount = records.length ? Math.ceil(records.length / policy.batchSize) : 0;
  for (let batchOrdinal = 1; batchOrdinal <= batchCount; batchOrdinal++) {
    const batchRecords = records.filter(record => record.batchOrdinal === batchOrdinal);
    const first = batchRecords[0]?.packetOrdinal || 0;
    const last = batchRecords.at(-1)?.packetOrdinal || 0;
    const stem = `batch-${String(batchOrdinal).padStart(2, '0')}-${String(first).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    const markdown = [`# Priority activity candidate review — batch ${batchOrdinal} of ${batchCount}`, '', ...batchRecords.map(renderPacketMarkdown)].join('\n') + '\n';
    const decisionNdjson = batchRecords.map(record => JSON.stringify(record.decisionTemplate)).join('\n') + (batchRecords.length ? '\n' : '');
    batches.push({
      batchOrdinal,
      firstPacketOrdinal: first,
      lastPacketOrdinal: last,
      recordCount: batchRecords.length,
      markdownFile: `${stem}.md`,
      decisionFile: `${stem}.decisions.ndjson`,
      markdown,
      decisionNdjson
    });
  }
  const batchIndexTsv = ['batch_ordinal\tfirst_packet_ordinal\tlast_packet_ordinal\trecord_count\tmarkdown_file\tdecision_file', ...batches.map(batch => [batch.batchOrdinal, batch.firstPacketOrdinal, batch.lastPacketOrdinal, batch.recordCount, batch.markdownFile, batch.decisionFile].join('\t'))].join('\n') + '\n';
  const artifactManifest = {
    contract: 'sensum.activity-candidate-priority-human-review-artifact-manifest.v1',
    batchSize: policy.batchSize,
    packetCount: records.length,
    batchCount: batches.length,
    artifacts: batches.flatMap(batch => [
      { file: `batches/${batch.markdownFile}`, kind: 'human_review_markdown', contentHash: contentHash(batch.markdown), bytes: Buffer.byteLength(batch.markdown, 'utf8') },
      { file: `batches/${batch.decisionFile}`, kind: 'blank_decision_template_ndjson', contentHash: contentHash(batch.decisionNdjson), bytes: Buffer.byteLength(batch.decisionNdjson, 'utf8') }
    ])
  };
  const artifactManifestJson = JSON.stringify(artifactManifest, null, 2) + '\n';
  return { batches, batchIndexTsv, artifactManifest, artifactManifestJson };
}

function compareKeySets(sets) {
  const names = Object.keys(sets);
  const baseline = sets[names[0]];
  const baselineSet = new Set(baseline);
  const results = {};
  for (const name of names) {
    const values = sets[name];
    const valueSet = new Set(values);
    results[name] = {
      count: values.length,
      duplicateKeys: duplicates(values),
      missingFromBaseline: baseline.filter(key => !valueSet.has(key)),
      unexpectedAgainstBaseline: values.filter(key => !baselineSet.has(key))
    };
  }
  return { results, exact: Object.values(results).every(result => !result.duplicateKeys.length && !result.missingFromBaseline.length && !result.unexpectedAgainstBaseline.length) };
}

export function auditActivityCandidatePriorityHumanReviewPackets(records = [], {
  candidateRecords = [], sourceEvidenceRecords = [], subjectDispositionRecords = [], workRoutingRecords = [], policy = {}, artifacts = null, contentHash = hash
} = {}) {
  const compiled = compileActivityCandidatePriorityHumanReviewPacketPolicy(policy);
  const selectedCandidates = activityCandidates(candidateRecords);
  const keySets = compareKeySets({
    candidates: selectedCandidates.map(record => record.candidateKey),
    sourceEvidence: sourceEvidenceRecords.map(record => record.candidateKey),
    subjectDispositions: subjectDispositionRecords.map(record => record.candidateKey),
    workRoutes: workRoutingRecords.map(record => record.candidateKey),
    packets: records.map(record => record.candidateKey)
  });
  const candidateByKey = new Map(selectedCandidates.map(record => [record.candidateKey, record]));
  const sourceByKey = new Map(sourceEvidenceRecords.map(record => [record.candidateKey, record]));
  const dispositionByKey = new Map(subjectDispositionRecords.map(record => [record.candidateKey, record]));
  const routingByKey = new Map(workRoutingRecords.map(record => [record.candidateKey, record]));
  const allInputRecords = [...candidateRecords, ...sourceEvidenceRecords, ...subjectDispositionRecords, ...workRoutingRecords];
  const invalidRecordHashes = allInputRecords.filter(record => !recordHashValid(record)).map(record => `${record.contract}:${record.candidateKey || 'unknown'}`);
  const invalidCandidateKeys = selectedCandidates.filter(record => !directActivityDiscoveryCandidateValid(record, policy)).map(record => record.candidateKey);
  const invalidSourceKeys = sourceEvidenceRecords.filter(record => !sourceEvidenceValid(record, policy)).map(record => record.candidateKey);
  const invalidDispositionKeys = subjectDispositionRecords.filter(record => !dispositionValid(record, policy)).map(record => record.candidateKey);
  const invalidRoutingKeys = workRoutingRecords.filter(record => !routingValid(record, policy)).map(record => record.candidateKey);
  const pipelineBindingMismatches = selectedCandidates.filter(candidate => !pipelineBindingValid(candidate, sourceByKey.get(candidate.candidateKey), dispositionByKey.get(candidate.candidateKey), routingByKey.get(candidate.candidateKey))).map(record => record.candidateKey);
  const expected = keySets.exact && compiled.valid ? expectedPackets({ candidateRecords, sourceEvidenceRecords, subjectDispositionRecords, workRoutingRecords }, policy, contentHash) : [];
  const expectedByKey = new Map(expected.map(record => [record.candidateKey, record]));
  const packetMismatches = records.filter(record => stable(record) !== stable(expectedByKey.get(record.candidateKey))).map(record => record.candidateKey);
  const expectedArtifacts = buildActivityCandidatePriorityHumanReviewPacketArtifacts(expected, policy, contentHash);
  const actualArtifacts = artifacts || buildActivityCandidatePriorityHumanReviewPacketArtifacts(records, policy, contentHash);
  const artifactMismatches = [];
  if (stable(actualArtifacts.batches) !== stable(expectedArtifacts.batches)) artifactMismatches.push('batch_artifacts');
  if (actualArtifacts.batchIndexTsv !== expectedArtifacts.batchIndexTsv) artifactMismatches.push('batch_index');
  if (actualArtifacts.artifactManifestJson !== expectedArtifacts.artifactManifestJson) artifactMismatches.push('artifact_manifest');
  const accountStateFindings = findActivityCandidatePriorityHumanReviewPacketAccountState(records);
  const nonBlankDecisionKeys = records.filter(record => !decisionTemplateBlank(record.decisionTemplate)).map(record => record.candidateKey);
  const unsupportedPromotionKeys = records.filter(record => record.decisionRecorded !== false
    || record.canonicalGameEntityIdentity !== null
    || record.canonicalActivityIdentity !== null
    || record.repeatabilityClassification !== null
    || record.atomicityClassification !== null
    || record.memberExpansionReviewed !== false
    || record.requirementsVariantsXpTimingAndMechanicsComplete !== false
    || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false).map(record => record.candidateKey);
  const conflictInputKeys = workRoutingRecords.filter(record => record.routingDecision?.routeState === 'blocked_source_conflict').map(record => record.candidateKey);
  const conflictPacketKeys = records.filter(record => record.reviewPriority?.band === 1 && record.state === 'priority_activity_review_packet_materialized_source_conflict_pending').map(record => record.candidateKey);
  const conflictPreservationComplete = stable(sorted(conflictInputKeys)) === stable(sorted(conflictPacketKeys))
    && records.slice(0, conflictInputKeys.length).every(record => record.reviewPriority?.band === 1);
  const ordinals = records.map(record => record.packetOrdinal);
  const expectedOrdinals = Array.from({ length: records.length }, (_, index) => index + 1);
  const batchCoverageComplete = stable(ordinals) === stable(expectedOrdinals)
    && records.every(record => record.batchOrdinal === Math.floor((record.packetOrdinal - 1) / policy.batchSize) + 1
      && record.batchItemOrdinal === ((record.packetOrdinal - 1) % policy.batchSize) + 1);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('packet_policy_invalid');
  if (!keySets.exact || selectedCandidates.length === 0) structuralBlockers.push('four_input_and_packet_candidate_sets_do_not_match_exactly');
  if (invalidRecordHashes.length) structuralBlockers.push('one_or_more_input_record_content_hashes_invalid');
  if (invalidCandidateKeys.length) structuralBlockers.push('one_or_more_discovery_candidates_invalid_or_not_directly_cross_source_bound');
  if (invalidSourceKeys.length || invalidDispositionKeys.length || invalidRoutingKeys.length) structuralBlockers.push('one_or_more_pipeline_records_invalid_or_semantically_promoted');
  if (pipelineBindingMismatches.length) structuralBlockers.push('one_or_more_candidate_pipeline_bindings_mismatch');
  if (packetMismatches.length) structuralBlockers.push('one_or_more_packets_do_not_match_deterministic_reconstruction');
  if (artifactMismatches.length) structuralBlockers.push('one_or_more_human_review_artifacts_do_not_match_deterministic_reconstruction');
  if (!conflictPreservationComplete) structuralBlockers.push('source_conflicts_not_preserved_or_prioritized');
  if (!batchCoverageComplete) structuralBlockers.push('packet_ordinals_or_batch_partition_invalid');
  if (nonBlankDecisionKeys.length || unsupportedPromotionKeys.length) structuralBlockers.push('packet_generation_recorded_a_decision_or_semantic_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_priority_activity_review_packets');
  const packetConsolidationComplete = structuralBlockers.length === 0;
  const blockers = unique([...structuralBlockers,
    'all_priority_activity_candidate_human_decisions_pending',
    ...(conflictInputKeys.length ? ['one_or_more_source_declaration_conflicts_remain'] : []),
    'canonical_game_entity_and_activity_identities_not_established',
    'repeatability_atomicity_and_member_expansion_not_reviewed',
    'requirements_variants_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  ]);
  return {
    contract: policy.auditContract,
    policyCoverage: {
      policy: policy.policy || null,
      valid: compiled.valid,
      invalidBindings: compiled.invalidBindings,
      invalidRules: compiled.invalidRules,
      invalidEnums: compiled.invalidEnums,
      forbiddenPolicyPaths: compiled.forbiddenPolicyPaths,
      configuredBatchSize: compiled.batchSize
    },
    inputCoverage: {
      candidateInventoryRecordCount: candidateRecords.length,
      selectedActivityDiscoveryCandidateCount: selectedCandidates.length,
      sourceEvidenceRecordCount: sourceEvidenceRecords.length,
      subjectDispositionRecordCount: subjectDispositionRecords.length,
      workRoutingRecordCount: workRoutingRecords.length,
      candidateSetComparison: keySets.results,
      exactCandidateSetsMatch: keySets.exact,
      invalidRecordHashes,
      invalidCandidateKeys,
      invalidSourceKeys,
      invalidDispositionKeys,
      invalidRoutingKeys
    },
    pipelineBindingCoverage: {
      exactlyBoundCandidateCount: selectedCandidates.length - pipelineBindingMismatches.length,
      bindingMismatchCandidateKeys: pipelineBindingMismatches,
      renderedPageWithoutUnlockEvidenceCandidateCount: selectedCandidates.filter(record => record.candidateKind === 'rendered_page_without_unlock_match').length,
      directCrossSourceUnlockEvidenceCandidateCount: selectedCandidates.filter(record => record.sourceContexts?.unlockEvidence?.activityPageCandidate === true).length
    },
    packetCoverage: {
      packetCount: records.length,
      completePacketCount: records.length - packetMismatches.length,
      packetMismatchCandidateKeys: packetMismatches,
      sourceConflictPacketCount: conflictPacketKeys.length,
      queuedReviewPacketCount: records.filter(record => record.workRoute?.routingDecision?.routeState === 'queued').length,
      routeCounts: Object.fromEntries(sorted(unique(records.map(record => record.workRoute?.routingDecision?.routeKey))).map(route => [route, records.filter(record => record.workRoute?.routingDecision?.routeKey === route).length])),
      conflictPreservationComplete
    },
    evidenceCoverage: {
      renderedGuideObservationCount: records.reduce((sum, record) => sum + (record.discoveryEvidence.sourceContexts?.renderedEvidence?.observations?.length || 0), 0),
      unlockTargetReferenceCount: records.reduce((sum, record) => sum + (record.discoveryEvidence.sourceContexts?.unlockEvidence?.targetReferences?.length || 0), 0),
      sourceSignatureContextCount: records.reduce((sum, record) => sum + (record.sourceEvidence.sourceSignatureContexts?.length || 0), 0),
      infoboxParameterOccurrenceCount: records.reduce((sum, record) => sum + (record.sourceEvidence.infoboxEvidence?.parameters?.length || 0), 0),
      leadParagraphCount: records.reduce((sum, record) => sum + (record.sourceEvidence.leadParagraphEvidence?.length || 0), 0),
      headingCount: records.reduce((sum, record) => sum + (record.sourceEvidence.headingEvidence?.length || 0), 0),
      lexicalReviewCandidateCount: records.reduce((sum, record) => sum + (record.sourceEvidence.lexicalReviewCandidates?.length || 0), 0),
      dispositionSignalCount: records.reduce((sum, record) => sum + (record.subjectAssessment.dispositionSignals?.length || 0), 0),
      requiredEvidenceDomainObligationCount: records.reduce((sum, record) => sum + (record.reviewObligations.requiredEvidenceDomains?.length || 0), 0),
      explicitNonClaimCount: records.reduce((sum, record) => sum + (record.explicitNonClaims?.length || 0), 0)
    },
    batchCoverage: {
      batchCount: actualArtifacts.batches.length,
      configuredBatchSize: policy.batchSize,
      largestBatchSize: Math.max(0, ...actualArtifacts.batches.map(batch => batch.recordCount)),
      contiguousCompleteNonOverlapping: batchCoverageComplete
    },
    artifactCoverage: {
      markdownArtifactCount: actualArtifacts.batches.length,
      blankDecisionArtifactCount: actualArtifacts.batches.length,
      artifactManifestEntryCount: actualArtifacts.artifactManifest?.artifacts?.length || 0,
      artifactMismatchKinds: artifactMismatches,
      deterministicArtifactReconstructionComplete: artifactMismatches.length === 0
    },
    semanticPreservationCoverage: {
      blankDecisionTemplateCount: records.length - nonBlankDecisionKeys.length,
      nonBlankDecisionCandidateKeys: nonBlankDecisionKeys,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      repeatabilityClassificationCount: records.filter(record => record.repeatabilityClassification !== null).length,
      atomicityClassificationCount: records.filter(record => record.atomicityClassification !== null).length,
      memberExpansionReviewedCount: records.filter(record => record.memberExpansionReviewed === true).length,
      requirementsVariantsXpTimingAndMechanicsCompleteCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete === true).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied === true).length,
      unsupportedPromotionCandidateKeys: unsupportedPromotionKeys
    },
    accountStateFindings,
    packetConsolidationComplete,
    humanReviewComplete: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers,
    publishable: packetConsolidationComplete
  };
}

export function buildActivityCandidatePriorityHumanReviewPackets({
  candidateRecords = [], sourceEvidenceRecords = [], subjectDispositionRecords = [], workRoutingRecords = [], policy = {}, contentHash = hash
} = {}) {
  const inputs = { candidateRecords, sourceEvidenceRecords, subjectDispositionRecords, workRoutingRecords };
  const records = expectedPackets(inputs, policy, contentHash);
  const artifacts = buildActivityCandidatePriorityHumanReviewPacketArtifacts(records, policy, contentHash);
  const audit = auditActivityCandidatePriorityHumanReviewPackets(records, { ...inputs, policy, artifacts, contentHash });
  return { records, artifacts, audit };
}
