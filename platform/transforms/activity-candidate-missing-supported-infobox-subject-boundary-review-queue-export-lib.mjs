import { hash, json } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'allThreeInputSnapshotsMustBeExplicitlySelectedAndRevalidated',
  'everyRecursiveClosurePacketMustExportExactlyOnceInSourceOrder',
  'routingOneHopAndRecursiveCandidateBindingsMustMatchExactly',
  'queueMustPreserveExactCandidateRevisionAndSourceFingerprint',
  'queueMustExposeEveryRootInvocationStaticNodeStaticEdgeCycleWrapperAndDynamicBoundary',
  'staticAncestryAndDynamicBoundariesMustRemainDistinct',
  'renderedOutputAttributionMustRemainFalse',
  'decisionTemplatesMustStartBlank',
  'exportCannotRecordReviewerTimestampNotesEvidenceSelectionOrDecision',
  'subjectDispositionCannotEstablishRepeatabilityMembershipRequirementsVariantsXpTimingMechanicsOrEligibility',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesOverridesAndExceptionsCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const EXPECTED_DISPOSITIONS = [
  'confirm_single_activity_subject',
  'confirm_composite_or_container_subject',
  'confirm_reference_collection_subject',
  'reject_as_activity_subject',
  'needs_additional_evidence'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const clone = value => structuredClone(value);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|route|routes|label|labels|alias|aliases|override|overrides|exception|exceptions|candidateKey|candidateKeys)$|(?:name|title|pageid|revision|skill|route|label|alias|candidate).*(?:override|exception)s?$/i;
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

export function compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy(policy = {}, routingPolicy = {}, oneHopPolicy = {}, recursivePolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const invalidBindings = [];
  if (policy.policy !== 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-policy.v1') invalidBindings.push('policy');
  const bindings = [
    ['routing', policy.inputRoutingPolicy, policy.inputRoutingPolicyContentHash, policy.inputRoutingDomain, routingPolicy],
    ['oneHop', policy.inputOneHopPolicy, policy.inputOneHopPolicyContentHash, policy.inputOneHopDomain, oneHopPolicy],
    ['recursive', policy.inputRecursivePolicy, policy.inputRecursivePolicyContentHash, policy.inputRecursiveDomain, recursivePolicy]
  ];
  for (const [name, id, boundHash, domain, sourcePolicy] of bindings) {
    if (id !== sourcePolicy.policy || boundHash !== contentHash(sourcePolicy) || domain !== sourcePolicy.outputDomain) invalidBindings.push(name);
  }
  if (policy.queueContract !== 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-queue-entry.v1'
    || policy.decisionTemplateContract !== 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-decision-template.v1'
    || policy.auditContract !== 'sensum.activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-audit.v1') invalidBindings.push('contracts');
  if (!same(policy.allowedSubjectDispositions, EXPECTED_DISPOSITIONS, contentHash)) invalidBindings.push('allowedSubjectDispositions');
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: !invalidRules.length && !invalidBindings.length && !forbidden.length, invalidRules: unique(invalidRules), invalidBindings: unique(invalidBindings), forbiddenPolicyPaths: forbidden };
}

function recordHashesMatch(record = {}, contentHash = hash) {
  return validHash(record.recordContentHash) && record.recordContentHash === contentHash(without(record, 'recordContentHash', 'contentHash'))
    && validHash(record.contentHash) && record.contentHash === contentHash(without(record, 'contentHash'));
}

function snapshotAssessment(raw, records, manifest, snapshot, sourcePolicy, expectations, contentHash = hash) {
  const audit = manifest?.source?.audit || {};
  const checks = {
    explicitSnapshotSelected: snapshot?.explicit === true && Boolean(snapshot?.directory),
    manifestContractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === sourcePolicy.outputDomain,
    recordCountAndRawHashMatch: manifest?.records === records.length && manifest?.contentHash === contentHash(raw),
    snapshotBindingMatchesManifest: snapshot?.contentHash === manifest?.contentHash && snapshot?.createdAt === manifest?.createdAt,
    policyBindingMatches: manifest?.source?.policy?.id === sourcePolicy.policy && manifest?.source?.policy?.contentHash === contentHash(sourcePolicy),
    recordHashesMatch: records.length > 0 && records.every(record => recordHashesMatch(record, contentHash)),
    upstreamAuditContractMatches: audit.contract === sourcePolicy.auditContract,
    upstreamPublishable: audit.publishable === true,
    upstreamRequiredGatesMatch: Object.entries(expectations).every(([key, value]) => same(audit[key], value, contentHash))
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests|currentBaseLevel|currentLevel|currentXp)$/i;
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

function semanticBoundaryIntact(record = {}) {
  return record.humanDecisionRecorded === false && record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null
    && record.repeatabilityClassification === null && record.membershipOrVariantApplication !== true
    && record.requirementsVariantsXpTimingAndMechanicsComplete === false && record.optimizerEligible === false
    && record.automaticVerificationApplied === false && record.accountIndependent === true;
}

function historicalIdentity(source = {}) {
  return {
    requestedTitle: source.requestedTitle,
    normalizedTitle: source.normalizedTitle,
    resolvedTitle: source.resolvedTitle,
    namespace: source.namespace,
    sourcePageId: source.sourcePageId,
    sourceRevision: source.sourceRevision,
    sourceTimestamp: source.sourceTimestamp,
    asOfTimestamp: source.asOfTimestamp,
    timestampAtOrBeforeBoundary: source.timestampAtOrBeforeBoundary,
    sourceUrl: source.sourceUrl,
    sourceExactRevisionUrl: source.sourceExactRevisionUrl,
    sourceContentHash: source.sourceContentHash,
    sourceContentBytes: source.sourceContentBytes,
    explicitMissing: source.explicitMissing,
    redirectTarget: source.redirectTarget || null
  };
}

function resolutionSummary(resolution = {}) {
  return {
    requestedTitle: resolution.requestedTitle,
    asOfTimestamp: resolution.asOfTimestamp,
    state: resolution.state,
    completeAssessment: resolution.completeAssessment,
    redirectCount: resolution.redirectCount,
    chain: (resolution.chain || []).map(historicalIdentity)
  };
}

function classCounts(rows = []) {
  const classes = sorted(unique(rows.map(row => row.dependencyClass)));
  return Object.fromEntries(classes.map(kind => [kind, rows.filter(row => row.dependencyClass === kind).length]));
}

function compactRootEvidence(oneHop = {}) {
  return (oneHop.rootTemplateInvocationEvidence || []).map(root => ({
    evidenceKey: `${oneHop.candidateKey}|root-invocation:${root.invocationOrdinal}`,
    invocationOrdinal: root.invocationOrdinal,
    retainedInvocation: clone(root.retainedInvocation),
    requestedTemplateTitle: root.requestedTemplateTitle,
    historicalResolution: resolutionSummary(root.historicalResolution),
    wrapperBehavior: clone(root.wrapperBehavior),
    sourceInvocationCount: (root.sourceInvocationInventory || []).length,
    sourceInvocationClassCounts: classCounts(root.sourceInvocationInventory || []),
    pageBackedOneHopDependencies: (root.pageBackedOneHopDependencyAssessments || []).map(dependency => ({
      occurrenceKey: dependency.occurrenceKey,
      sourceName: dependency.sourceName,
      pageTitle: dependency.pageTitle,
      dependencyClass: dependency.dependencyClass,
      argumentCount: dependency.argumentCount,
      sourceLocator: clone(dependency.sourceLocator),
      historicalResolution: resolutionSummary(dependency.historicalResolution)
    }))
  }));
}

function compactRecursiveEvidence(recursive = {}) {
  const graph = recursive.historicalDependencyGraph || {};
  const nodes = (graph.nodes || []).map(node => ({
    evidenceKey: `${recursive.candidateKey}|recursive-node:${node.nodeKey}`,
    nodeKey: node.nodeKey,
    minimumDepth: node.minimumDepth,
    sourceIdentity: historicalIdentity(node.sourceIdentity),
    effectiveSource: clone(node.effectiveSource),
    staticPageBackedDependencyCount: node.staticPageBackedDependencyCount,
    dynamicOrEngineBoundaryCount: node.dynamicOrEngineBoundaryCount
  }));
  const edges = (graph.edges || []).map(edge => ({
    evidenceKey: `${recursive.candidateKey}|recursive-edge:${edge.edgeKey}`,
    edgeKey: edge.edgeKey,
    fromNodeKey: edge.fromNodeKey,
    targetNodeKey: edge.targetNodeKey,
    sourceDepth: edge.sourceDepth,
    cycleEdge: edge.cycleEdge,
    dependency: clone(edge.dependency),
    historicalResolution: resolutionSummary(edge.historicalResolution)
  }));
  const cycles = (graph.cycles || []).map(cycle => ({ evidenceKey: `${recursive.candidateKey}|recursive-${cycle.cycleKey}`, ...clone(cycle) }));
  const wrappers = (graph.nodes || []).filter(node => node.effectiveSource?.kind === 'wikitext_transclusion_view').map(node => ({
    evidenceKey: `${recursive.candidateKey}|wrapper:${node.nodeKey}`,
    nodeKey: node.nodeKey,
    resolvedTitle: node.sourceIdentity?.resolvedTitle,
    sourceRevision: node.sourceIdentity?.sourceRevision,
    wrapperState: node.effectiveSource.wrapperState,
    wrapperStructure: clone(node.effectiveSource.wrapperStructure)
  }));
  const dynamicBoundaries = (graph.nodes || []).flatMap(node => (node.dependencyObservations || []).filter(dependency => !dependency.pageTitle).map(dependency => ({
    evidenceKey: `${recursive.candidateKey}|dynamic-boundary:${node.nodeKey}:${dependency.occurrenceKey}`,
    nodeKey: node.nodeKey,
    resolvedTitle: node.sourceIdentity?.resolvedTitle,
    sourceRevision: node.sourceIdentity?.sourceRevision,
    dependencyClass: dependency.dependencyClass,
    sourceName: dependency.sourceName,
    occurrenceKey: dependency.occurrenceKey,
    argumentCount: dependency.argumentCount,
    rawSource: dependency.rawSource,
    sourceLocator: clone(dependency.sourceLocator)
  })));
  return {
    entryPoints: (recursive.entryPoints || []).map(entry => ({ invocationOrdinal: entry.invocationOrdinal, requestedTemplateTitle: entry.requestedTemplateTitle, retainedInvocation: clone(entry.retainedInvocation), historicalResolution: resolutionSummary(entry.historicalResolution) })),
    nodes,
    edges,
    cycles,
    wrappers,
    dynamicBoundaries,
    coverage: clone(recursive.coverage),
    completeRenderedOutputAttribution: false
  };
}

function blankDecision() {
  return {
    subjectDisposition: null,
    compositeOrContainerVerdict: null,
    memberExpansionRequired: null,
    additionalEvidenceRequired: null,
    rejectionReason: null,
    selectedEvidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    notes: null
  };
}

function candidateBindings(routing, oneHop, recursive, snapshots) {
  return {
    routingSnapshotContentHash: snapshots.routing.contentHash,
    routingRecordContentHash: routing.recordContentHash,
    routingOuterContentHash: routing.contentHash,
    oneHopSnapshotContentHash: snapshots.oneHop.contentHash,
    oneHopRecordContentHash: oneHop.recordContentHash,
    oneHopOuterContentHash: oneHop.contentHash,
    recursiveSnapshotContentHash: snapshots.recursive.contentHash,
    recursiveRecordContentHash: recursive.recordContentHash,
    recursiveOuterContentHash: recursive.contentHash,
    candidateSourceContentHash: routing.sourcePageIdentity.sourceContentHash
  };
}

function expectedRecord(routing, oneHop, recursive, ordinal, snapshots, policy, contentHash = hash) {
  const sourceBindings = candidateBindings(routing, oneHop, recursive, snapshots);
  const structuralSourceEvidence = {
    evidenceKey: `${routing.candidateKey}|structural-source-evidence`,
    sourceSignatureContexts: clone(routing.sourceSignatureContexts),
    retainedStructuralEvidence: clone(routing.retainedStructuralEvidence),
    structuralConditionAssessment: clone(routing.structuralConditionAssessment),
    packetReviewObligations: clone(routing.packetReviewObligations),
    requiredEvidenceChannels: clone(routing.requiredEvidenceChannels),
    workRoute: clone(routing.workRoute)
  };
  const rootInvocationEvidence = compactRootEvidence(oneHop);
  const recursiveGraphEvidence = compactRecursiveEvidence(recursive);
  const evidenceFingerprint = contentHash({
    candidateKey: routing.candidateKey,
    sourcePageIdentity: routing.sourcePageIdentity,
    sourceBindings,
    structuralSourceEvidence,
    rootInvocationEvidence,
    recursiveGraphEvidence
  });
  const allEvidenceKeys = [
    structuralSourceEvidence.evidenceKey,
    ...rootInvocationEvidence.map(row => row.evidenceKey),
    ...recursiveGraphEvidence.nodes.map(row => row.evidenceKey),
    ...recursiveGraphEvidence.edges.map(row => row.evidenceKey),
    ...recursiveGraphEvidence.cycles.map(row => row.evidenceKey),
    ...recursiveGraphEvidence.wrappers.map(row => row.evidenceKey),
    ...recursiveGraphEvidence.dynamicBoundaries.map(row => row.evidenceKey)
  ];
  const base = {
    contract: policy.queueContract,
    queueEntryKey: `${recursive.closurePacketKey}|subject-boundary-review`,
    queueOrdinal: ordinal,
    candidateKey: routing.candidateKey,
    sourcePageIdentity: clone(routing.sourcePageIdentity),
    sourceBindings,
    evidenceFingerprint,
    structuralSourceEvidence,
    rootInvocationEvidence,
    recursiveGraphEvidence,
    reviewObligations: [
      { obligationKey: 'source_subject_boundary', question: 'What subject does this exact source page describe?', required: true, evidenceKeys: allEvidenceKeys },
      { obligationKey: 'atomic_composite_or_reference_collection', question: 'Is the subject one activity, a composite or container, a reference collection, or not an activity subject?', required: true, evidenceKeys: allEvidenceKeys },
      { obligationKey: 'member_expansion_scope', question: 'If the subject contains activities, must independently eligible members be enumerated?', required: true, evidenceKeys: [structuralSourceEvidence.evidenceKey, ...rootInvocationEvidence.map(row => row.evidenceKey)] },
      { obligationKey: 'dynamic_and_rendered_attribution_limit', question: 'Does unresolved dynamic expansion require additional evidence before a subject decision?', required: true, evidenceKeys: recursiveGraphEvidence.dynamicBoundaries.map(row => row.evidenceKey) }
    ],
    allowedSubjectDispositions: clone(policy.allowedSubjectDispositions),
    decisionTemplate: blankDecision(),
    humanDecisionRecorded: false,
    subjectDisposition: null,
    compositeOrContainerVerdict: null,
    memberExpansionRequired: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    explicitNonClaims: [
      'review_queue_materialization_is_not_a_human_decision',
      'static_template_ancestry_is_not_rendered_output_attribution',
      'template_structure_does_not_establish_subject_identity_or_activity_atomicity',
      'subject_disposition_would_not_by_itself_establish_repeatability_or_membership',
      'requirements_variants_xp_timing_mechanics_and_complete_universe_are_not_established',
      'account_state_is_not_evaluated',
      'optimizer_eligibility_and_verified_best_are_not_authorized'
    ],
    blockers: [
      'explicit_source_bound_subject_boundary_human_review_pending',
      ...(recursiveGraphEvidence.dynamicBoundaries.length ? ['dynamic_or_engine_expansion_boundaries_unresolved'] : []),
      'complete_rendered_output_attribution_not_established',
      'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved',
      'independent_complete_activity_universe_not_established'
    ],
    state: policy.queueState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function prospectiveQueueSnapshotContentHash(records, contentHash = hash) {
  const rows = records.map(record => ({ ...record, contentHash: contentHash(record) }));
  return contentHash(`${rows.map(row => json(row)).join('\n')}\n`);
}

function decisionTemplates(records, policy, queueSnapshotContentHash) {
  return records.map(record => ({
    contract: policy.decisionTemplateContract,
    queueEntryKey: record.queueEntryKey,
    queueEntryRecordContentHash: record.recordContentHash,
    queueSnapshotContentHash,
    candidateKey: record.candidateKey,
    sourcePageId: record.sourcePageIdentity.sourcePageId,
    sourceRevision: record.sourcePageIdentity.sourceRevision,
    evidenceFingerprint: record.evidenceFingerprint,
    allowedSubjectDispositions: clone(record.allowedSubjectDispositions),
    ...blankDecision()
  }));
}

function evidenceKeyCounts(record) {
  return {
    roots: record.rootInvocationEvidence.length,
    nodes: record.recursiveGraphEvidence.nodes.length,
    edges: record.recursiveGraphEvidence.edges.length,
    cycles: record.recursiveGraphEvidence.cycles.length,
    wrappers: record.recursiveGraphEvidence.wrappers.length,
    dynamicBoundaries: record.recursiveGraphEvidence.dynamicBoundaries.length
  };
}

export function renderActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueMarkdown(records = []) {
  const lines = [
    '# Missing-supported-infobox subject-boundary review queue', '',
    'This queue contains no decisions. Template ancestry and expansion boundaries are evidence for review, not proof of a game entity, activity, member set, mechanic, or optimizer candidate.', ''
  ];
  for (const record of records) {
    const counts = evidenceKeyCounts(record);
    lines.push(`## ${record.queueOrdinal}. ${record.sourcePageIdentity.resolvedTitle}`);
    lines.push(`- Candidate: \`${record.candidateKey}\``);
    lines.push(`- Exact Wiki revision: [${record.sourcePageIdentity.sourceRevision}](${record.sourcePageIdentity.sourceUrl}?oldid=${record.sourcePageIdentity.sourceRevision})`);
    lines.push(`- Evidence fingerprint: \`${record.evidenceFingerprint}\``);
    lines.push(`- Exposed evidence: ${counts.roots} roots; ${counts.nodes} static nodes; ${counts.edges} static edges; ${counts.cycles} cycles; ${counts.wrappers} wrapper observations; ${counts.dynamicBoundaries} dynamic or engine boundaries.`);
    lines.push('- Subject disposition: **blank — explicit human review required**', '');
    lines.push('### Source context', '');
    for (const paragraph of record.structuralSourceEvidence.retainedStructuralEvidence.leadParagraphs || []) lines.push(`- Line ${paragraph.sourceLocator?.lineStart || '?'}: ${paragraph.rawText}`);
    if (!(record.structuralSourceEvidence.retainedStructuralEvidence.leadParagraphs || []).length) lines.push('- No retained lead paragraph evidence.');
    lines.push('', '### Root invocations', '');
    for (const root of record.rootInvocationEvidence) {
      const terminal = root.historicalResolution.chain.at(-1);
      lines.push(`- \`${root.evidenceKey}\` — line ${root.retainedInvocation?.line || '?'} \`${root.requestedTemplateTitle}\` → ${terminal?.resolvedTitle || root.historicalResolution.state} @ revision ${terminal?.sourceRevision || 'historically absent'}; ${root.sourceInvocationCount} source invocations.`);
    }
    lines.push('', '### Static dependency ancestry', '');
    for (const node of record.recursiveGraphEvidence.nodes) lines.push(`- \`${node.evidenceKey}\` — depth ${node.minimumDepth}: ${node.sourceIdentity.resolvedTitle} @ ${node.sourceIdentity.sourceRevision}`);
    lines.push('', '### Cycles', '');
    if (!record.recursiveGraphEvidence.cycles.length) lines.push('- None observed.');
    for (const cycle of record.recursiveGraphEvidence.cycles) lines.push(`- \`${cycle.evidenceKey}\` — ${cycle.nodeKeys.join(' → ')}`);
    lines.push('', '### Dynamic or engine boundaries', '');
    if (!record.recursiveGraphEvidence.dynamicBoundaries.length) lines.push('- None observed.');
    for (const boundary of record.recursiveGraphEvidence.dynamicBoundaries) lines.push(`- \`${boundary.evidenceKey}\` — ${boundary.resolvedTitle} @ ${boundary.sourceRevision}; ${boundary.dependencyClass}; \`${boundary.sourceName || 'unnamed'}\`; line ${boundary.sourceLocator?.line || '?'}.`);
    lines.push('', '### Allowed disposition values', '');
    for (const disposition of record.allowedSubjectDispositions) lines.push(`- \`${disposition}\``);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

export function serializeActivityCandidateMissingSupportedInfoboxSubjectBoundaryDecisionTemplates(templates = []) {
  return `${templates.map(template => json(template)).join('\n')}\n`;
}

function buildArtifacts(records, templates, contentHash = hash) {
  const reviewMarkdown = renderActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueMarkdown(records);
  const decisionTemplateNdjson = serializeActivityCandidateMissingSupportedInfoboxSubjectBoundaryDecisionTemplates(templates);
  const evidenceIndex = `${JSON.stringify(records.map(record => ({
    queueEntryKey: record.queueEntryKey,
    candidateKey: record.candidateKey,
    sourcePageIdentity: record.sourcePageIdentity,
    evidenceFingerprint: record.evidenceFingerprint,
    evidenceCounts: evidenceKeyCounts(record),
    allowedSubjectDispositions: record.allowedSubjectDispositions,
    blockers: record.blockers
  })), null, 2)}\n`;
  const manifest = { contract: 'sensum.content-addressed-artifact-manifest.v1', artifacts: [
    { file: 'review-queue.md', kind: 'human_readable_subject_boundary_review_queue', contentHash: contentHash(reviewMarkdown), bytes: Buffer.byteLength(reviewMarkdown, 'utf8') },
    { file: 'decision-template.ndjson', kind: 'blank_source_bound_subject_boundary_decision_templates', contentHash: contentHash(decisionTemplateNdjson), bytes: Buffer.byteLength(decisionTemplateNdjson, 'utf8') },
    { file: 'evidence-index.json', kind: 'machine_readable_subject_boundary_evidence_index', contentHash: contentHash(evidenceIndex), bytes: Buffer.byteLength(evidenceIndex, 'utf8') }
  ] };
  const artifactManifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  return { reviewMarkdown, decisionTemplateNdjson, evidenceIndex, artifactManifest: manifest, artifactManifestJson };
}

function sourceBindingsMatch(routing, oneHop, recursive, snapshots) {
  return routing.candidateKey === oneHop.candidateKey && oneHop.candidateKey === recursive.candidateKey
    && oneHop.workRouteKey === routing.workRouteKey
    && oneHop.sourceBindings.routingSnapshotContentHash === snapshots.routing.contentHash
    && oneHop.sourceBindings.routingRecordContentHash === routing.recordContentHash
    && oneHop.sourceBindings.routingOuterContentHash === routing.contentHash
    && oneHop.sourceBindings.candidateSourceContentHash === routing.sourcePageIdentity.sourceContentHash
    && recursive.sourceBindings.routingSnapshotContentHash === snapshots.routing.contentHash
    && recursive.sourceBindings.oneHopSnapshotContentHash === snapshots.oneHop.contentHash
    && recursive.sourceBindings.oneHopRecordContentHash === oneHop.recordContentHash
    && recursive.sourceBindings.oneHopOuterContentHash === oneHop.contentHash
    && recursive.sourceBindings.candidateSourceContentHash === routing.sourcePageIdentity.sourceContentHash
    && oneHop.candidateRevisionRevalidation?.boundSource?.sourceRevision === routing.sourcePageIdentity.sourceRevision
    && oneHop.candidateRevisionRevalidation?.boundSource?.sourceTimestamp === routing.sourcePageIdentity.sourceTimestamp;
}

export function buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(input = {}) {
  const {
    routingRecords = [], routingRaw = '', routingManifest = {}, routingSnapshot = {},
    oneHopRecords = [], oneHopRaw = '', oneHopManifest = {}, oneHopSnapshot = {},
    recursiveRecords = [], recursiveRaw = '', recursiveManifest = {}, recursiveSnapshot = {},
    policy = {}, routingPolicy = {}, oneHopPolicy = {}, recursivePolicy = {}, contentHash = hash
  } = input;
  const compiled = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy(policy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash);
  const assessments = {
    routing: snapshotAssessment(routingRaw, routingRecords, routingManifest, routingSnapshot, routingPolicy, { evidenceWorkRoutingComplete: true, humanReviewComplete: false, completeActivityUniverse: false, publishable: true }, contentHash),
    oneHop: snapshotAssessment(oneHopRaw, oneHopRecords, oneHopManifest, oneHopSnapshot, oneHopPolicy, { evidencePacketCoverageComplete: true, recursiveHistoricalExpansionClosureComplete: false, humanReviewComplete: false, completeActivityUniverse: false, publishable: true }, contentHash),
    recursive: snapshotAssessment(recursiveRaw, recursiveRecords, recursiveManifest, recursiveSnapshot, recursivePolicy, { staticRecursiveHistoricalTransclusionClosureComplete: true, completeRenderedOutputAttribution: false, humanReviewComplete: false, completeActivityUniverse: false, publishable: true }, contentHash)
  };
  const snapshots = { routing: routingSnapshot, oneHop: oneHopSnapshot, recursive: recursiveSnapshot };
  const routingByCandidate = new Map(routingRecords.map(record => [record.candidateKey, record]));
  const oneHopByCandidate = new Map(oneHopRecords.map(record => [record.candidateKey, record]));
  const records = recursiveRecords.map((recursive, index) => expectedRecord(routingByCandidate.get(recursive.candidateKey) || {}, oneHopByCandidate.get(recursive.candidateKey) || {}, recursive, index + 1, snapshots, policy, contentHash));
  const queueSnapshotContentHash = prospectiveQueueSnapshotContentHash(records, contentHash);
  const templates = decisionTemplates(records, policy, queueSnapshotContentHash);
  const artifacts = buildArtifacts(records, templates, contentHash);
  const audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(records, {
    ...input, compiled, assessments, expectedRecords: records, decisionTemplates: templates, queueSnapshotContentHash, artifacts, contentHash
  });
  return { records, decisionTemplates: templates, queueSnapshotContentHash, artifacts, audit };
}

export function auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(records = [], context = {}) {
  const {
    routingRecords = [], oneHopRecords = [], recursiveRecords = [], routingSnapshot = {}, oneHopSnapshot = {}, recursiveSnapshot = {},
    policy = {}, compiled = {}, assessments = {}, expectedRecords = [], decisionTemplates = [], queueSnapshotContentHash = '', artifacts = {}, contentHash = hash
  } = context;
  const routingKeys = routingRecords.map(row => row.candidateKey);
  const oneHopKeys = oneHopRecords.map(row => row.candidateKey);
  const recursiveKeys = recursiveRecords.map(row => row.candidateKey);
  const actualKeys = records.map(row => row.candidateKey);
  const routingByCandidate = new Map(routingRecords.map(record => [record.candidateKey, record]));
  const oneHopByCandidate = new Map(oneHopRecords.map(record => [record.candidateKey, record]));
  const bindingMismatches = recursiveRecords.filter(recursive => !sourceBindingsMatch(routingByCandidate.get(recursive.candidateKey) || {}, oneHopByCandidate.get(recursive.candidateKey) || {}, recursive, { routing: routingSnapshot, oneHop: oneHopSnapshot, recursive: recursiveSnapshot })).map(row => row.candidateKey);
  const semanticInputViolations = [...routingRecords, ...oneHopRecords, ...recursiveRecords].filter(record => !semanticBoundaryIntact(record)).map(record => record.candidateKey);
  const expectedExposure = {
    rootInvocationCount: oneHopRecords.reduce((sum, row) => sum + (row.rootTemplateInvocationEvidence || []).length, 0),
    staticNodeCount: recursiveRecords.reduce((sum, row) => sum + (row.historicalDependencyGraph?.nodes || []).length, 0),
    staticEdgeCount: recursiveRecords.reduce((sum, row) => sum + (row.historicalDependencyGraph?.edges || []).length, 0),
    cycleCount: recursiveRecords.reduce((sum, row) => sum + (row.historicalDependencyGraph?.cycles || []).length, 0),
    wrapperObservationCount: recursiveRecords.reduce((sum, row) => sum + (row.historicalDependencyGraph?.nodes || []).filter(node => node.effectiveSource?.kind === 'wikitext_transclusion_view').length, 0),
    dynamicOrEngineBoundaryCount: recursiveRecords.reduce((sum, row) => sum + (row.historicalDependencyGraph?.nodes || []).flatMap(node => (node.dependencyObservations || []).filter(dep => !dep.pageTitle)).length, 0)
  };
  const actualExposure = {
    rootInvocationCount: records.reduce((sum, row) => sum + (row.rootInvocationEvidence || []).length, 0),
    staticNodeCount: records.reduce((sum, row) => sum + (row.recursiveGraphEvidence?.nodes || []).length, 0),
    staticEdgeCount: records.reduce((sum, row) => sum + (row.recursiveGraphEvidence?.edges || []).length, 0),
    cycleCount: records.reduce((sum, row) => sum + (row.recursiveGraphEvidence?.cycles || []).length, 0),
    wrapperObservationCount: records.reduce((sum, row) => sum + (row.recursiveGraphEvidence?.wrappers || []).length, 0),
    dynamicOrEngineBoundaryCount: records.reduce((sum, row) => sum + (row.recursiveGraphEvidence?.dynamicBoundaries || []).length, 0)
  };
  const exposureComplete = same(expectedExposure, actualExposure, contentHash);
  const queueHashMatches = queueSnapshotContentHash === prospectiveQueueSnapshotContentHash(records, contentHash);
  const blank = blankDecision();
  const invalidQueueRows = records.filter((record, index) => record.contract !== policy.queueContract || record.state !== policy.queueState
    || record.queueOrdinal !== index + 1 || !recordHashesMatch({ ...record, contentHash: contentHash(record) }, contentHash)
    || !same(record, expectedRecords[index], contentHash) || !same(record.decisionTemplate, blank, contentHash)
    || !semanticBoundaryIntact(record) || record.subjectDisposition !== null || record.compositeOrContainerVerdict !== null || record.memberExpansionRequired !== null
    || record.recursiveGraphEvidence?.completeRenderedOutputAttribution !== false).map(row => row.candidateKey);
  const invalidTemplates = decisionTemplates.filter((template, index) => template.contract !== policy.decisionTemplateContract
    || template.queueEntryKey !== records[index]?.queueEntryKey || template.queueEntryRecordContentHash !== records[index]?.recordContentHash
    || template.queueSnapshotContentHash !== queueSnapshotContentHash || template.evidenceFingerprint !== records[index]?.evidenceFingerprint
    || !same(without(template, 'contract', 'queueEntryKey', 'queueEntryRecordContentHash', 'queueSnapshotContentHash', 'candidateKey', 'sourcePageId', 'sourceRevision', 'evidenceFingerprint', 'allowedSubjectDispositions'), blank, contentHash)
    || !same(template.allowedSubjectDispositions, policy.allowedSubjectDispositions, contentHash)).map(template => template.candidateKey);
  const accountState = accountStateFindings([records, decisionTemplates]);
  const artifactChecks = {
    markdownHashMatches: artifacts.artifactManifest?.artifacts?.[0]?.contentHash === contentHash(artifacts.reviewMarkdown || ''),
    decisionTemplateHashMatches: artifacts.artifactManifest?.artifacts?.[1]?.contentHash === contentHash(artifacts.decisionTemplateNdjson || ''),
    evidenceIndexHashMatches: artifacts.artifactManifest?.artifacts?.[2]?.contentHash === contentHash(artifacts.evidenceIndex || ''),
    manifestStable: Boolean(artifacts.artifactManifestJson && contentHash(artifacts.artifactManifestJson))
  };
  const inputComplete = compiled.valid && assessments.routing?.complete && assessments.oneHop?.complete && assessments.recursive?.complete
    && same(routingKeys, oneHopKeys, contentHash) && same(oneHopKeys, recursiveKeys, contentHash) && same(recursiveKeys, actualKeys, contentHash)
    && !bindingMismatches.length && !semanticInputViolations.length;
  const queueComplete = inputComplete && records.length > 0 && !invalidQueueRows.length && decisionTemplates.length === records.length
    && !invalidTemplates.length && queueHashMatches && exposureComplete && !accountState.length && Object.values(artifactChecks).every(Boolean);
  const blockers = [];
  if (!compiled.valid) blockers.push('subject_boundary_review_queue_policy_invalid');
  if (!assessments.routing?.complete || !assessments.oneHop?.complete || !assessments.recursive?.complete) blockers.push('one_or_more_explicit_input_snapshots_failed_revalidation');
  if (!same(routingKeys, oneHopKeys, contentHash) || !same(oneHopKeys, recursiveKeys, contentHash) || !same(recursiveKeys, actualKeys, contentHash)) blockers.push('candidate_set_order_or_coverage_mismatch');
  if (bindingMismatches.length) blockers.push('routing_one_hop_or_recursive_source_binding_mismatch');
  if (semanticInputViolations.length || invalidQueueRows.length || invalidTemplates.length) blockers.push('queue_export_created_or_inherited_semantic_decision_or_promotion');
  if (!queueHashMatches) blockers.push('decision_template_queue_snapshot_binding_mismatch');
  if (!exposureComplete) blockers.push('required_subject_boundary_evidence_not_fully_exposed');
  if (accountState.length) blockers.push('current_account_state_present');
  if (!Object.values(artifactChecks).every(Boolean)) blockers.push('review_queue_artifact_hash_validation_failed');
  blockers.push('explicit_source_bound_subject_boundary_human_review_pending', 'complete_rendered_output_attribution_not_established', 'canonical_identity_repeatability_membership_requirements_variants_xp_timing_and_mechanics_unresolved', 'independent_complete_activity_universe_not_established');
  return {
    contract: policy.auditContract,
    policyCoverage: compiled,
    inputCoverage: { routingSnapshot: assessments.routing, oneHopSnapshot: assessments.oneHop, recursiveSnapshot: assessments.recursive, routingRecordCount: routingRecords.length, oneHopRecordCount: oneHopRecords.length, recursiveRecordCount: recursiveRecords.length, exactCandidateSetOrder: same(routingKeys, oneHopKeys, contentHash) && same(oneHopKeys, recursiveKeys, contentHash), semanticInputViolationCandidateKeys: unique(semanticInputViolations) },
    bindingCoverage: { exactBindingCount: recursiveRecords.length - bindingMismatches.length, expectedBindingCount: recursiveRecords.length, mismatchedCandidateKeys: bindingMismatches },
    queueCoverage: { expectedQueueEntryCount: recursiveRecords.length, queueEntryCount: records.length, blankDecisionTemplateCount: decisionTemplates.length - invalidTemplates.length, invalidQueueCandidateKeys: invalidQueueRows, invalidDecisionTemplateCandidateKeys: invalidTemplates, prospectiveQueueSnapshotContentHash: queueSnapshotContentHash, queueSnapshotBindingMatches: queueHashMatches },
    evidenceExposureCoverage: { expected: expectedExposure, actual: actualExposure, complete: exposureComplete },
    artifactCoverage: artifactChecks,
    semanticPreservationCoverage: { humanDecisionRecordedCount: records.filter(row => row.humanDecisionRecorded).length, subjectDispositionCount: records.filter(row => row.subjectDisposition !== null).length, canonicalIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length, repeatabilityClassificationCount: records.filter(row => row.repeatabilityClassification !== null).length, mechanicsCompletionCount: records.filter(row => row.requirementsVariantsXpTimingAndMechanicsComplete).length, optimizerEligibleCount: records.filter(row => row.optimizerEligible).length, automaticVerificationCount: records.filter(row => row.automaticVerificationApplied).length },
    accountStateFindings: accountState,
    queueExportComplete: queueComplete,
    subjectBoundaryReviewComplete: false,
    completeRenderedOutputAttribution: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: queueComplete
  };
}
