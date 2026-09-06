import { hash, json } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'inputSnapshotMustBeExplicitlySelected',
  'manifestRawRecordsAndAllRecordHashesMustRevalidate',
  'inputAuditMustBePublishableQueryBoundedAndFailClosed',
  'onePacketPerCandidateBoundPotentialEvidenceSignal',
  'candidateBlockerDomainQueryAndSignalMustJoinExactly',
  'signalSourceMustBeRefetchedByExactRevision',
  'sourcePageIdTitleRevisionTimestampHashBytesLineAndExcerptMustRevalidate',
  'reviewPacketMustRetainAllCandidateBlockersAndDiscoveryBindings',
  'decisionTemplateMustRemainCompletelyBlank',
  'packetGenerationDoesNotRecordOrApplyAReviewDecision',
  'packetGenerationCannotCloseBlockersCreateFactsOrPromoteOptimizerState',
  'confirmationCouldResolveOnlyTheNamedBlockerAfterSeparateGuardedApplication',
  'otherConditionMechanicsUniverseAndBestClaimsRemainBlocked',
  'namesTitlesPageIdsRevisionsCandidatesBlockersLinesAndAliasesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const ALLOWED_DECISIONS = [
  'confirm_source_resolves_named_blocker_only',
  'reject_source_as_insufficient_or_condition_mismatched',
  'needs_additional_revision_pinned_evidence'
];
const NON_CLAIMS = [
  'packet_materialization_does_not_close_the_named_blocker',
  'source_discovery_match_is_not_a_verified_game_fact',
  'source_line_does_not_establish_an_expected_rate_at_the_target_level_unless_its_scope_explicitly_does_so',
  'other_candidate_condition_and_mechanics_blockers_remain_open',
  'candidate_universe_completeness_is_not_established',
  'account_state_is_not_evaluated',
  'optimizer_eligibility_is_not_established',
  'verified_best_is_not_authorized'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const normalizeExcerpt = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 700);
const revisionUrl = revision => `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}`;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:candidateKey|candidateKeys|blocker|blockers|pageId|pageIds|title|titles|revision|revisions|line|lines|alias|aliases|override|overrides)$/i;
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

export function compileAgilityTargetConditionGapDiscoveryReviewPacketPolicy(policy = {}) {
  const expected = {
    inputManifestContract: 'sensum.ingestion-manifest.v1',
    inputDomain: 'agility-target-condition-gap-wiki-discovery',
    inputRecordContract: 'sensum.agility-target-condition-gap-wiki-discovery.v1',
    inputAuditContract: 'sensum.agility-target-condition-gap-wiki-discovery-audit.v1',
    inputPolicy: 'sensum.agility-target-condition-gap-wiki-discovery-policy.v1',
    inputPolicyFile: 'platform/policies/agility-target-condition-gap-wiki-discovery-v1.json',
    recordContract: 'sensum.agility-target-condition-gap-discovery-review-packet.v1',
    decisionTemplateContract: 'sensum.agility-target-condition-gap-discovery-review-decision-template.v1',
    auditContract: 'sensum.agility-target-condition-gap-discovery-review-packet-materialization-audit.v1',
    outputDomain: 'agility-target-condition-gap-discovery-review-packet'
  };
  const invalidBindings = Object.entries(expected).filter(([key, value]) => policy[key] !== value).map(([key]) => key);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const decisionsValid = same(policy.allowedDecisions, ALLOWED_DECISIONS);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: !invalidBindings.length && !invalidRules.length && decisionsValid && !forbidden.length, invalidBindings, invalidRules: unique(invalidRules), decisionsValid, forbiddenPolicyPaths: forbidden };
}

export function findAgilityTargetConditionGapDiscoveryReviewPacketAccountState(records = []) {
  const findings = [];
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|accountState|accountSnapshot|bank|bankItems|ownedEquipment|preferences)$/i;
  const visit = (value, path, packetKey) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, packetKey));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) findings.push({ reviewPacketKey: packetKey, path: next });
      visit(child, next, packetKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record.reviewPacketKey || `record-${index}`));
  return findings;
}

function recordHashesValid(record, contentHash = hash) {
  if (!validHash(record?.contentHash) || contentHash(without(record, ['contentHash'])) !== record.contentHash) return false;
  const core = without(record, ['contentHash', 'recordContentHash']);
  return validHash(record.recordContentHash) && contentHash(core) === record.recordContentHash;
}

function inputIntegrity({ discoveryRecords = [], discoveryManifest = {}, discoveryRaw = '', inputPolicy = {}, policy = {}, contentHash = hash }) {
  const audit = discoveryManifest.source?.audit || {};
  const signalCount = discoveryRecords.reduce((sum, record) => sum + (record.evidenceDomains || []).reduce((inner, domain) => inner + (domain.potentialEvidenceSignals || []).length, 0), 0);
  const manualCandidateCount = discoveryRecords.filter(record => record.manualReauditRequired === true).length;
  const checks = {
    manifestContractMatches: discoveryManifest.contract === policy.inputManifestContract,
    manifestDomainMatches: discoveryManifest.domain === policy.inputDomain,
    manifestRecordCountMatches: Number(discoveryManifest.records) === discoveryRecords.length,
    manifestRawHashMatches: typeof discoveryRaw === 'string' && discoveryManifest.contentHash === contentHash(discoveryRaw),
    inputPolicyIdMatches: inputPolicy.policy === policy.inputPolicy && discoveryManifest.source?.policy?.id === inputPolicy.policy,
    inputPolicyHashMatches: discoveryManifest.source?.policy?.contentHash === contentHash(inputPolicy),
    auditContractMatches: audit.contract === policy.inputAuditContract,
    auditPublishable: audit.publishable === true,
    queryBoundedDiscoveryComplete: audit.queryBoundedDiscoveryComplete === true,
    sourceDiscoveryRequiresReview: audit.sourceDiscoveryDispositionStable === false,
    auditSignalCountMatches: Number(audit.evidenceDomainCoverage?.potentialEvidenceSignalCount) === signalCount,
    auditManualCandidateCountMatches: Number(audit.evidenceDomainCoverage?.manualReauditCandidateCount) === manualCandidateCount,
    inputBlockerPreservation: audit.blockerPreservation?.preserved === true && Number(audit.blockerPreservation?.blockersClosed) === 0 && Number(audit.blockerPreservation?.semanticFactsCreated) === 0,
    inputOptimizerAndVerificationClosed: Number(audit.blockerPreservation?.optimizerEligibleCount) === 0 && Number(audit.blockerPreservation?.automaticVerificationCount) === 0,
    inputAccountAndUniverseClosed: Number(audit.blockerPreservation?.accountStateFindingCount) === 0 && Number(audit.blockerPreservation?.completeWikiUniverseClaimCount) === 0 && audit.completeWikiUniverse === false,
    allRecordContractsMatch: discoveryRecords.every(record => record.contract === policy.inputRecordContract),
    allRecordHashesValid: discoveryRecords.every(record => recordHashesValid(record, contentHash)),
    allRecordsFailClosed: discoveryRecords.every(record => record.accountIndependent === true && record.blockersClosed === 0 && record.semanticFactsCreated === 0 && record.optimizerEligible === false && record.automaticVerificationApplied === false && record.completeWikiUniverseClaimed === false)
  };
  return { checks, complete: Object.values(checks).every(Boolean), signalCount, manualCandidateCount };
}

function extractedSignals(discoveryRecords = []) {
  const rows = [];
  for (const record of discoveryRecords) {
    for (const domain of record.evidenceDomains || []) {
      for (const signal of domain.potentialEvidenceSignals || []) {
        rows.push({ record, domain, signal, signalKey: `${record.candidateKey}|${domain.blocker}|${signal.signalKind}|wiki-pageid:${signal.pageId}|revision:${signal.sourceRevision}|line:${signal.line}` });
      }
    }
  }
  return rows.sort((left, right) => left.signalKey.localeCompare(right.signalKey));
}

function revisionsById(revisionPages = []) {
  const rows = new Map();
  for (const page of revisionPages) for (const revision of page.revisions || []) rows.set(String(revision.revid), { page, revision });
  return rows;
}

function sourceForSignal(entry, revisionRows, contentHash = hash) {
  const { record, domain, signal } = entry;
  const discovered = (record.discoveredPages || []).filter(page => Number(page.pageId) === Number(signal.pageId) && String(page.sourceRevision) === String(signal.sourceRevision));
  const source = revisionRows.get(String(signal.sourceRevision));
  const content = source?.revision?.slots?.main?.content;
  const lines = typeof content === 'string' ? content.split(/\r?\n/) : [];
  const exactLine = Number(signal.line) > 0 ? lines[Number(signal.line) - 1] : null;
  const matchedDomainQueries = sorted((discovered[0]?.matchedQueryKeys || []).filter(key => (domain.queryKeys || []).includes(key)));
  const checks = {
    exactlyOneDiscoveredPageMatch: discovered.length === 1,
    exactRevisionReturned: String(source?.revision?.revid || '') === String(signal.sourceRevision),
    pageIdMatches: Number(source?.page?.pageid) === Number(signal.pageId),
    titleMatches: source?.page?.title === signal.title && discovered[0]?.title === signal.title,
    timestampMatches: source?.revision?.timestamp === discovered[0]?.sourceTimestamp,
    sourceUrlMatches: signal.sourceUrl === discovered[0]?.sourceUrl,
    contentPresent: typeof content === 'string',
    contentHashMatches: typeof content === 'string' && contentHash(content) === discovered[0]?.contentHash,
    contentBytesMatch: typeof content === 'string' && Buffer.byteLength(content, 'utf8') === Number(discovered[0]?.contentBytes),
    lineNumberValid: Number.isInteger(Number(signal.line)) && Number(signal.line) > 0 && Number(signal.line) <= lines.length,
    lineExcerptMatches: typeof exactLine === 'string' && normalizeExcerpt(exactLine) === signal.excerpt,
    domainDispositionRequiresReview: domain.disposition === 'potential_evidence_requires_manual_semantic_reaudit',
    candidateDispositionRequiresReview: record.manualReauditRequired === true && record.disposition === 'blocked_pending_manual_semantic_reaudit',
    namedBlockerStillOpen: (record.existingBlockers || []).includes(domain.blocker),
    domainHasQueryBinding: matchedDomainQueries.length > 0
  };
  const evidenceKey = `wiki-pageid:${signal.pageId}|revision:${signal.sourceRevision}|line:${signal.line}`;
  return {
    checks,
    complete: Object.values(checks).every(Boolean),
    matchedDomainQueries,
    evidence: {
      evidenceKey,
      signalKind: signal.signalKind,
      sourcePageId: Number(signal.pageId),
      sourceTitle: signal.title,
      sourceRevision: String(signal.sourceRevision),
      sourceTimestamp: discovered[0]?.sourceTimestamp || null,
      sourceUrl: signal.sourceUrl,
      exactRevisionUrl: revisionUrl(signal.sourceRevision),
      sourceContentHash: discovered[0]?.contentHash || null,
      sourceContentBytes: discovered[0]?.contentBytes ?? null,
      sourceLine: Number(signal.line),
      exactSourceLine: exactLine,
      normalizedExcerpt: signal.excerpt,
      matchedDomainQueryKeys: matchedDomainQueries,
      integrityChecks: checks,
      exactRevisionLineRevalidated: Object.values(checks).every(Boolean)
    }
  };
}

function packetFor(entry, revisionRows, discoveryManifest, policy, contentHash = hash) {
  const { record, domain, signalKey } = entry;
  const source = sourceForSignal(entry, revisionRows, contentHash);
  const queryBindings = (record.searchQueries || []).filter(query => source.matchedDomainQueries.includes(query.queryKey)).map(query => ({
    queryKey: query.queryKey,
    blocker: query.blocker,
    diagnosticKind: query.diagnosticKind,
    searchText: query.searchText,
    resultSetHash: query.resultSetHash,
    resultContainsSourcePage: (query.resultPageIds || []).includes(source.evidence.sourcePageId)
  }));
  const base = {
    contract: policy.recordContract,
    reviewPacketKey: `${signalKey}|manual-review-packet`,
    sourceDiscoverySnapshot: { domain: discoveryManifest.domain, createdAt: discoveryManifest.createdAt, contentHash: discoveryManifest.contentHash },
    sourceDiscoveryRecordContentHash: record.contentHash,
    candidateKey: record.candidateKey,
    candidateName: record.candidateName,
    targetBaseAgility: record.targetBaseAgility,
    namedBlocker: domain.blocker,
    relatedOpenBlockers: sorted((record.existingBlockers || []).filter(blocker => blocker !== domain.blocker)),
    queryBindings,
    sourceEvidence: source.evidence,
    reviewQuestion: 'Does this exact revision and source line resolve only the named blocker for this exact candidate and condition scope?',
    reviewScope: {
      decisionAppliesOnlyToNamedBlocker: domain.blocker,
      confirmationRequiresSeparateGuardedDecisionImportAndApplication: true,
      confirmationDoesNotProve: [...NON_CLAIMS],
      otherOpenBlockersRemain: sorted((record.existingBlockers || []).filter(blocker => blocker !== domain.blocker))
    },
    allowedDecisions: [...policy.allowedDecisions],
    decision: null,
    selectedEvidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false,
    packetMaterializationComplete: source.complete && queryBindings.length > 0 && queryBindings.every(query => query.resultContainsSourcePage),
    state: 'pending_explicit_human_semantic_review_no_decision'
  };
  const packetContentHash = contentHash(base);
  const withPacketHash = { ...base, packetContentHash };
  return { ...withPacketHash, contentHash: contentHash(withPacketHash) };
}

function decisionTemplate(packet, policy, contentHash = hash) {
  const base = {
    contract: policy.decisionTemplateContract,
    reviewPacketKey: packet.reviewPacketKey,
    packetContentHash: packet.packetContentHash,
    availableEvidenceKeys: [packet.sourceEvidence.evidenceKey],
    decision: null,
    selectedEvidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null
  };
  return { ...base, contentHash: contentHash(base) };
}

function markdown(packets) {
  const lines = ['# Agility target-condition discovery review packet', '', 'This artifact contains source-discovery evidence for human review. It records no decision and closes no blocker.', ''];
  for (const [index, packet] of packets.entries()) {
    lines.push(`## ${index + 1}. ${packet.candidateName}`, '', `- Packet: \`${packet.reviewPacketKey}\``, `- Named blocker: \`${packet.namedBlocker}\``, `- Target base Agility: ${packet.targetBaseAgility}`, `- Source: [${packet.sourceEvidence.sourceTitle}, revision ${packet.sourceEvidence.sourceRevision}](${packet.sourceEvidence.exactRevisionUrl})`, `- Source line: ${packet.sourceEvidence.sourceLine}`, `- Exact line: ${packet.sourceEvidence.exactSourceLine}`, '', `Review question: ${packet.reviewQuestion}`, '', 'Allowed decisions:', ...packet.allowedDecisions.map(decision => `- \`${decision}\``), '', 'This packet does not establish:', ...packet.reviewScope.confirmationDoesNotProve.map(nonClaim => `- ${nonClaim.replaceAll('_', ' ')}`), '');
  }
  return `${lines.join('\n').trim()}\n`;
}

function artifactsFor(packets, policy, contentHash = hash) {
  const reviewMarkdown = markdown(packets);
  const decisions = packets.map(packet => decisionTemplate(packet, policy, contentHash));
  const decisionNdjson = `${decisions.map(value => json(value)).join('\n')}\n`;
  const manifestBase = {
    contract: 'sensum.agility-target-condition-gap-discovery-review-artifacts.v1',
    packetCount: packets.length,
    reviewMarkdown: { file: 'review-packet.md', contentHash: contentHash(reviewMarkdown), bytes: Buffer.byteLength(reviewMarkdown, 'utf8') },
    decisionTemplate: { file: 'decision-template.ndjson', recordCount: decisions.length, contentHash: contentHash(decisionNdjson), bytes: Buffer.byteLength(decisionNdjson, 'utf8') },
    packetContentHashes: packets.map(packet => packet.packetContentHash),
    decisionsRecorded: 0
  };
  const artifactManifest = { ...manifestBase, contentHash: contentHash(manifestBase) };
  const artifactManifestJson = `${JSON.stringify(artifactManifest, null, 2)}\n`;
  return { reviewMarkdown, decisions, decisionNdjson, artifactManifest, artifactManifestJson };
}

function outputHashesValid(records, contentHash = hash) {
  return records.every(record => validHash(record.contentHash) && contentHash(without(record, ['contentHash'])) === record.contentHash && validHash(record.packetContentHash) && contentHash(without(record, ['contentHash', 'packetContentHash'])) === record.packetContentHash);
}

export function auditAgilityTargetConditionGapDiscoveryReviewPackets(records = [], artifacts = {}, inputs = {}) {
  const { discoveryRecords = [], discoveryManifest = {}, discoveryRaw = '', revisionPages = [], inputPolicy = {}, policy = {}, contentHash = hash } = inputs;
  const compiled = compileAgilityTargetConditionGapDiscoveryReviewPacketPolicy(policy);
  const input = inputIntegrity({ discoveryRecords, discoveryManifest, discoveryRaw, inputPolicy, policy, contentHash });
  const signals = extractedSignals(discoveryRecords);
  const revisionRows = revisionsById(revisionPages);
  const sourceRows = signals.map(signal => sourceForSignal(signal, revisionRows, contentHash));
  const expectedRecords = signals.map(signal => packetFor(signal, revisionRows, discoveryManifest, policy, contentHash));
  const expectedArtifacts = artifactsFor(expectedRecords, policy, contentHash);
  const signalKeys = signals.map(signal => signal.signalKey);
  const packetKeys = records.map(record => record.reviewPacketKey);
  const expectedPacketKeys = expectedRecords.map(record => record.reviewPacketKey);
  const accountStateFindings = findAgilityTargetConditionGapDiscoveryReviewPacketAccountState(records);
  const semanticPreservationCoverage = {
    decisionCount: records.filter(record => record.decision !== null).length,
    selectedEvidenceCount: records.reduce((sum, record) => sum + (record.selectedEvidenceKeys || []).length, 0),
    blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
    semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
    optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
    automaticVerificationCount: records.filter(record => record.automaticVerificationApplied === true).length,
    completeWikiUniverseClaimCount: records.filter(record => record.completeWikiUniverseClaimed === true).length
  };
  const packetCoverage = {
    expectedPacketCount: signals.length,
    outputPacketCount: records.length,
    completePacketCount: records.filter(record => record.packetMaterializationComplete === true).length,
    packetSetMatches: same(packetKeys, expectedPacketKeys),
    packetContentMatches: same(records, expectedRecords),
    outputHashesValid: outputHashesValid(records, contentHash)
  };
  const artifactCoverage = {
    markdownMatches: artifacts.reviewMarkdown === expectedArtifacts.reviewMarkdown,
    decisionTemplateMatches: artifacts.decisionNdjson === expectedArtifacts.decisionNdjson,
    artifactManifestMatches: artifacts.artifactManifestJson === expectedArtifacts.artifactManifestJson,
    decisionTemplateCount: artifacts.decisions?.length || 0,
    allDecisionTemplatesBlank: (artifacts.decisions || []).every(decision => decision.decision === null && decision.selectedEvidenceKeys?.length === 0 && decision.reviewer === null && decision.reviewedAt === null && decision.reviewNotes === null)
  };
  const integrityBlockers = [];
  if (!compiled.valid) integrityBlockers.push('review_packet_policy_invalid');
  if (!input.complete) integrityBlockers.push('input_discovery_snapshot_or_audit_invalid');
  if (!signals.length || unique(signalKeys).length !== signalKeys.length) integrityBlockers.push('candidate_bound_signal_set_missing_or_duplicate');
  if (sourceRows.some(source => !source.complete)) integrityBlockers.push('one_or_more_exact_revision_signal_lines_failed_revalidation');
  if (!packetCoverage.packetSetMatches || !packetCoverage.packetContentMatches || !packetCoverage.outputHashesValid || packetCoverage.completePacketCount !== signals.length) integrityBlockers.push('review_packet_set_or_content_invalid');
  if (!Object.values(artifactCoverage).every(value => value === true || (typeof value === 'number' && value === signals.length))) integrityBlockers.push('review_packet_artifacts_invalid');
  if (Object.values(semanticPreservationCoverage).some(Number) || accountStateFindings.length) integrityBlockers.push('packet_generation_created_unsupported_decision_fact_promotion_or_account_state');
  const reviewPacketMaterializationComplete = !integrityBlockers.length;
  return {
    contract: policy.auditContract,
    inputCoverage: { inputRecordCount: discoveryRecords.length, manifestRecordCount: Number(discoveryManifest.records || 0), manualReauditCandidateCount: input.manualCandidateCount, potentialEvidenceSignalCount: input.signalCount, integrityChecks: input.checks, complete: input.complete },
    policyCoverage: compiled,
    signalCoverage: { inputSignalCount: signals.length, uniqueSignalCount: unique(signalKeys).length, signalKeys, packetSetMatches: packetCoverage.packetSetMatches },
    sourceIntegrityCoverage: { requestedRevisionCount: unique(signals.map(signal => String(signal.signal.sourceRevision))).length, returnedRevisionCount: revisionRows.size, completeSourceCount: sourceRows.filter(source => source.complete).length, exactRevisionLineCoverageComplete: sourceRows.length === signals.length && sourceRows.every(source => source.complete) },
    packetCoverage,
    artifactCoverage,
    semanticPreservationCoverage,
    accountStateFindings,
    reviewPacketMaterializationComplete,
    humanReviewComplete: false,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    blockers: unique([...integrityBlockers, 'manual_semantic_review_decision_pending', 'all_input_target_condition_blockers_remain_open', 'condition_and_mechanics_coverage_incomplete', 'complete_activity_universe_not_established']),
    publishable: !integrityBlockers.length
  };
}

export function buildAgilityTargetConditionGapDiscoveryReviewPackets(inputs = {}) {
  const { discoveryRecords = [], discoveryManifest = {}, revisionPages = [], policy = {}, contentHash = hash } = inputs;
  const revisions = revisionsById(revisionPages);
  const records = extractedSignals(discoveryRecords).map(signal => packetFor(signal, revisions, discoveryManifest, policy, contentHash));
  const artifacts = artifactsFor(records, policy, contentHash);
  const audit = auditAgilityTargetConditionGapDiscoveryReviewPackets(records, artifacts, inputs);
  return { records, artifacts, audit };
}
