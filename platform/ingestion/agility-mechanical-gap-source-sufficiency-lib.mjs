const requiredRules = [
  'inputAuditContractAndContentHashMustValidate',
  'policyCandidateSetMustEqualEveryMechanicalModelGap',
  'policyBlockerSetsMustMatchInputExactly',
  'everyBlockerMustMapToExactlyOneEvidenceDomain',
  'everyDeclaredSourceMustResolveByExactRevisionAndTitle',
  'diagnosticSignalsRouteManualReauditAndNeverResolveFacts',
  'absenceMeansOnlyNotFoundInTheDeclaredRevisionBoundChannels',
  'blockersClosedAndSemanticFactsCreatedMustAlwaysBeZero',
  'optimizerEligibilityAndAutomaticVerificationAreForbidden',
  'accountSpecificInputsAreForbidden',
  'completeWikiOrActivityUniverseClaimsAreForbidden'
];

const sorted = values => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = values => [...new Set(values)];
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const excerpt = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 700);
const accountKey = key => /^(?:currentBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(key);

function lineSignals(sourceEntry, predicate, signalKind) {
  const results = [];
  const contentLines = String(sourceEntry.content || '').split(/\r?\n/);
  for (let index = 0; index < contentLines.length; index += 1) {
    if (!predicate(contentLines[index])) continue;
    results.push({
      signalKind,
      sourceKey: sourceEntry.source.sourceKey,
      title: sourceEntry.source.title,
      sourceRevision: sourceEntry.source.revision,
      line: index + 1,
      excerpt: excerpt(contentLines[index])
    });
  }
  return results;
}

function diagnosticSignals(kind, sourceEntries) {
  if (kind === 'skullball_typical_cycle') {
    return sourceEntries.flatMap(entry => lineSignals(
      entry,
      line => /(?:typical|average|expected|normally|usually)[^\n]{0,180}(?:completion|lap|route|game)?[^\n]{0,100}\b\d+:\d+(?:\.\d+)?(?:\s*(?:-|–|to)\s*\d+:\d+(?:\.\d+)?)?/i.test(line)
        || /(?:completion|lap|route|game)[^\n]{0,120}(?:typically|averages?|expected|normally|usually)[^\n]{0,100}\b\d+:\d+(?:\.\d+)?/i.test(line),
      kind
    ));
  }
  if (kind === 'barbarian_afk_cycle_with_drop') {
    return sourceEntries.flatMap(entry => lineSignals(
      entry,
      line => /\bAFK\b/i.test(line)
        && /drop(?:ping|ped)?/i.test(line)
        && /\b\d+(?:\.\d+)?\s*(?:game\s*)?(?:ticks?|seconds?)\b/i.test(line)
        && /(?:catch|attempt|cycle|fish)/i.test(line),
      kind
    ));
  }
  if (kind === 'edgeville_motionless_round_trip_timing') {
    return sourceEntries.flatMap(entry => lineSignals(
      entry,
      line => /(?:motionless|monkeybars?)/i.test(line)
        && /(?:round[ -]?trip|back\s+and\s+forth|both\s+(?:ways|directions)|there\s+and\s+back|full\s+cycle)/i.test(line)
        && /\b\d+(?:\.\d+)?\s*(?:game\s*)?(?:ticks?|seconds?)\b/i.test(line),
      kind
    ));
  }
  if (kind === 'edgeville_upper_bound_reconciliation') {
    return sourceEntries.flatMap(entry => lineSignals(
      entry,
      line => /13,?000/.test(line)
        && /13,?200/.test(line)
        && /(?:correct(?:ed|ion)?|revis(?:ed|ion)|replac(?:ed|es)|supersed(?:ed|es)|previous(?:ly)?|instead|reconcil)/i.test(line),
      kind
    ));
  }
  return [];
}

function contextSignals(sourceEntries) {
  const definitions = [
    ['skullball_bounded_route_time', line => /(?:2:20\s*-\s*2:45|2:45\s*-\s*3:15|3:00\s*-\s*3:49)/.test(line)],
    ['skullball_peak_time', line => /times as fast as\s+1:45/i.test(line)],
    ['barbarian_afk_drop_scope', line => /AFK rates include the time spent dropping the fish/i.test(line)],
    ['edgeville_13000_upper_bound', line => /up to\s+13,?000\s+experience per hour/i.test(line)],
    ['edgeville_13200_upper_bound', line => /up to\s+13,?200\s+experience per hour/i.test(line)],
    ['motionless_method', line => /motionless|no camera rotation or mouse movement|mouse cursor in one spot/i.test(line)]
  ];
  const found = [];
  for (const [kind, predicate] of definitions) {
    for (const entry of sourceEntries) found.push(...lineSignals(entry, predicate, kind));
  }
  return found.slice(0, 30);
}

function exactRevisionMap(pages = []) {
  const result = new Map();
  for (const page of pages) {
    for (const revision of page.revisions || []) result.set(String(revision.revid), { page, revision });
  }
  return result;
}

function inputHashValid(coverageReport, contentHash) {
  return Boolean(coverageReport?.contentHash)
    && contentHash({ ...coverageReport, contentHash: undefined }) === coverageReport.contentHash;
}

function policyErrors(policy = {}) {
  const errors = [];
  if (!Number.isInteger(Number(policy.targetBaseAgility))) errors.push('targetBaseAgility');
  if (!Array.isArray(policy.sources) || !policy.sources.length) errors.push('sources');
  if (!Array.isArray(policy.candidates) || !policy.candidates.length) errors.push('candidates');
  if (!Array.isArray(policy.blockerRules) || !policy.blockerRules.length) errors.push('blockerRules');
  for (const rule of requiredRules) if (policy.rules?.[rule] !== true) errors.push(rule);
  if (policy.rules?.automaticVerificationAllowed !== false) errors.push('automaticVerificationAllowed');
  const sourceKeys = (policy.sources || []).map(source => source.sourceKey);
  if (unique(sourceKeys).length !== sourceKeys.length) errors.push('duplicateSourceKeys');
  const candidateKeys = (policy.candidates || []).map(candidate => candidate.candidateKey);
  if (unique(candidateKeys).length !== candidateKeys.length) errors.push('duplicateCandidateKeys');
  for (const source of policy.sources || []) {
    if (!source.sourceKey || !source.title || !/^[1-9]\d*$/.test(String(source.revision))
      || !source.url?.startsWith(policy.acceptedSourceOrigin || 'https://oldschool.runescape.wiki/w/') || !source.channel) {
      errors.push(`invalidSource:${source.sourceKey || 'unknown'}`);
    }
  }
  for (const candidate of policy.candidates || []) {
    if (!candidate.candidateKey || !candidate.sourceKeys?.length || !candidate.expectedBlockers?.length) errors.push(`invalidCandidate:${candidate.candidateKey || 'unknown'}`);
    for (const sourceKey of candidate.sourceKeys || []) if (!sourceKeys.includes(sourceKey)) errors.push(`unknownCandidateSource:${candidate.candidateKey}:${sourceKey}`);
    for (const [kind, diagnosticKeys] of Object.entries(candidate.diagnosticSourceKeysByKind || {})) {
      if (!diagnosticKeys?.length) errors.push(`emptyDiagnosticSourceSet:${candidate.candidateKey}:${kind}`);
      for (const sourceKey of diagnosticKeys || []) if (!candidate.sourceKeys.includes(sourceKey)) errors.push(`diagnosticSourceOutsideCandidateSet:${candidate.candidateKey}:${kind}:${sourceKey}`);
    }
  }
  for (const rule of policy.blockerRules || []) {
    try { new RegExp(rule.pattern); } catch { errors.push(`invalidBlockerPattern:${rule.pattern}`); }
    if (!rule.domain || !rule.requiredEvidenceShape || !rule.diagnosticKinds?.length) errors.push(`invalidBlockerRule:${rule.pattern || 'unknown'}`);
  }
  return unique(errors);
}

function accountFindings(records = []) {
  const findings = [];
  const visit = (value, path, candidateKey) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`, candidateKey)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ candidateKey, path: childPath });
      visit(child, childPath, candidateKey);
    }
  };
  records.forEach(record => visit(record, '', record.candidateKey));
  return findings;
}

function constructRecords({ coverageReport = {}, exactRevisionPages = [], policy = {}, contentHash = value => value }) {
  const pages = exactRevisionMap(exactRevisionPages);
  const sources = new Map((policy.sources || []).map(source => [source.sourceKey, source]));
  const candidates = new Map((coverageReport.details || []).map(detail => [detail.candidateKey, detail]));
  return (policy.candidates || []).map(candidatePolicy => {
    const candidate = candidates.get(candidatePolicy.candidateKey) || {};
    const sourceEntries = candidatePolicy.sourceKeys.map(sourceKey => {
      const source = sources.get(sourceKey);
      const exact = pages.get(String(source?.revision || ''));
      const content = exact?.revision?.slots?.main?.content;
      return { source, exact, content: typeof content === 'string' ? content : null };
    });
    const sourceBindings = sourceEntries.map(entry => ({
      sourceKey: entry.source?.sourceKey || null,
      title: entry.source?.title || null,
      sourceRevision: entry.source?.revision || null,
      sourceUrl: entry.source?.url || null,
      channel: entry.source?.channel || null,
      resolvedTitle: entry.exact?.page?.title || null,
      resolvedRevision: entry.exact?.revision?.revid ? String(entry.exact.revision.revid) : null,
      timestamp: entry.exact?.revision?.timestamp || null,
      exactRevisionRetrievable: typeof entry.content === 'string'
        && String(entry.exact?.revision?.revid || '') === String(entry.source?.revision || '')
        && entry.exact?.page?.title === entry.source?.title,
      contentHash: typeof entry.content === 'string' ? contentHash(entry.content) : null,
      contentBytes: typeof entry.content === 'string' ? Buffer.byteLength(entry.content, 'utf8') : null
    }));
    const evidenceDomains = (candidate.blockers || []).map(blocker => {
      const matches = (policy.blockerRules || []).filter(rule => new RegExp(rule.pattern).test(blocker));
      const rule = matches.length === 1 ? matches[0] : null;
      const diagnosticKinds = rule ? unique(rule.diagnosticKinds) : [];
      const diagnosticSourceKeys = unique(diagnosticKinds.flatMap(kind => candidatePolicy.diagnosticSourceKeysByKind?.[kind] || candidatePolicy.sourceKeys));
      const resolutionSignals = diagnosticKinds.flatMap(kind => {
        const selectedKeys = candidatePolicy.diagnosticSourceKeysByKind?.[kind] || candidatePolicy.sourceKeys;
        return diagnosticSignals(kind, sourceEntries.filter(entry => selectedKeys.includes(entry.source?.sourceKey)));
      });
      return {
        blocker,
        mappingStatus: matches.length === 1 ? 'mapped' : matches.length === 0 ? 'unmapped' : 'ambiguous',
        domain: rule?.domain || null,
        requiredEvidenceShape: rule?.requiredEvidenceShape || null,
        diagnosticKinds,
        auditedSourceKeys: candidatePolicy.sourceKeys,
        diagnosticSourceKeys,
        resolutionSignals,
        disposition: resolutionSignals.length
          ? 'potential_mechanics_evidence_requires_manual_reaudit'
          : 'unresolved_not_found_in_declared_revision_bound_channels'
      };
    });
    const manualReauditRequired = evidenceDomains.some(domain => domain.resolutionSignals.length > 0);
    const base = {
      contract: policy.recordContract,
      candidateKey: candidatePolicy.candidateKey,
      candidateName: candidate.name || null,
      targetBaseAgility: Number(policy.targetBaseAgility),
      inputAuditContentHash: coverageReport.contentHash || null,
      sourceBindings,
      contextSignals: contextSignals(sourceEntries),
      evidenceDomains,
      existingBlockers: sorted(candidate.blockers || []),
      disposition: manualReauditRequired
        ? 'blocked_pending_manual_semantic_reaudit'
        : 'blocked_no_mechanics_matched_evidence_in_declared_revision_bound_channels',
      manualReauditRequired,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      completeWikiUniverseClaimed: false
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
}

export function buildAgilityMechanicalGapSourceSufficiency({ coverageReport = {}, exactRevisionPages = [], policy = {}, contentHash = value => value }) {
  const records = constructRecords({ coverageReport, exactRevisionPages, policy, contentHash });
  return { records, audit: auditAgilityMechanicalGapSourceSufficiency(records, { coverageReport, exactRevisionPages, policy, contentHash }) };
}

export function auditAgilityMechanicalGapSourceSufficiency(records = [], { coverageReport = {}, exactRevisionPages = [], policy = {}, contentHash = value => value } = {}) {
  const invalidPolicyRules = policyErrors(policy);
  const inputContractValid = coverageReport.contract === policy.inputAuditContract;
  const inputContentHashValid = inputHashValid(coverageReport, contentHash);
  const inputTargetValid = Number(coverageReport.targetBaseAgility) === Number(policy.targetBaseAgility);
  const inputCandidates = (coverageReport.details || []).filter(detail => detail.status === 'mechanical_model_gap');
  const inputKeys = sorted(inputCandidates.map(candidate => candidate.candidateKey));
  const policyKeys = sorted((policy.candidates || []).map(candidate => candidate.candidateKey));
  const outputKeys = records.map(record => record.candidateKey);
  const candidateSetMatches = same(inputKeys, policyKeys) && same(sorted(outputKeys), policyKeys) && unique(outputKeys).length === outputKeys.length;
  const policyByCandidate = new Map((policy.candidates || []).map(candidate => [candidate.candidateKey, candidate]));
  const inputByCandidate = new Map(inputCandidates.map(candidate => [candidate.candidateKey, candidate]));
  const blockerSetsMatch = policyKeys.every(candidateKey => same(
    sorted(policyByCandidate.get(candidateKey)?.expectedBlockers || []),
    sorted(inputByCandidate.get(candidateKey)?.blockers || [])
  ));
  const expectedRecords = constructRecords({ coverageReport, exactRevisionPages, policy, contentHash });
  const recordsMatchExpected = same(records, expectedRecords);
  const bindings = records.flatMap(record => record.sourceBindings || []);
  const sourceSet = new Map(bindings.map(binding => [binding.sourceKey, binding]));
  const declaredSourceKeys = sorted((policy.sources || []).map(source => source.sourceKey));
  const sourceSetMatches = same(sorted(sourceSet.keys()), declaredSourceKeys);
  const exactRevisionRetrievedCount = [...sourceSet.values()].filter(binding => binding.exactRevisionRetrievable).length;
  const allExactRevisionsResolved = sourceSetMatches && exactRevisionRetrievedCount === declaredSourceKeys.length;
  const evidenceDomains = records.flatMap(record => record.evidenceDomains || []);
  const mappedDomainCount = evidenceDomains.filter(domain => domain.mappingStatus === 'mapped').length;
  const allBlockersMappedOnce = evidenceDomains.length > 0 && mappedDomainCount === evidenceDomains.length;
  const preservedBlockers = records.every(record => same(sorted(record.existingBlockers || []), sorted(inputByCandidate.get(record.candidateKey)?.blockers || [])));
  const forbiddenPromotionCount = records.filter(record => record.blockersClosed !== 0
    || record.semanticFactsCreated !== 0
    || record.optimizerEligible !== false
    || record.automaticVerificationApplied !== false
    || record.accountIndependent !== true
    || record.completeWikiUniverseClaimed !== false).length;
  const foundAccountState = accountFindings(records);
  const recordHashesValid = records.every(record => {
    const expectedRecordHash = contentHash(without(record, ['recordContentHash', 'contentHash']));
    const expectedContentHash = contentHash(without(record, ['contentHash']));
    return record.recordContentHash === expectedRecordHash && record.contentHash === expectedContentHash;
  });
  const resolutionSignalCount = evidenceDomains.reduce((sum, domain) => sum + (domain.resolutionSignals?.length || 0), 0);
  const manualReauditCandidateCount = records.filter(record => record.manualReauditRequired).length;
  const blockers = [];
  if (invalidPolicyRules.length) blockers.push('policy_rules_invalid');
  if (!inputContractValid) blockers.push('input_coverage_audit_contract_invalid');
  if (!inputContentHashValid) blockers.push('input_coverage_audit_content_hash_invalid');
  if (!inputTargetValid) blockers.push('input_target_base_agility_mismatch');
  if (!candidateSetMatches) blockers.push('mechanical_gap_candidate_set_mismatch');
  if (!blockerSetsMatch) blockers.push('mechanical_gap_blocker_set_mismatch');
  if (!sourceSetMatches) blockers.push('declared_source_set_mismatch');
  if (!allExactRevisionsResolved) blockers.push('one_or_more_declared_exact_revisions_unavailable_or_identity_mismatched');
  if (!allBlockersMappedOnce) blockers.push('one_or_more_blockers_unmapped_or_ambiguously_mapped');
  if (!recordsMatchExpected) blockers.push('output_records_do_not_match_source_bound_reconstruction');
  if (!recordHashesValid) blockers.push('one_or_more_record_hashes_invalid');
  if (!preservedBlockers) blockers.push('input_blockers_not_preserved_exactly');
  if (forbiddenPromotionCount) blockers.push('unsupported_fact_resolution_or_optimizer_promotion_detected');
  if (foundAccountState.length) blockers.push('account_query_state_baked_into_source_sufficiency_audit');
  const publishable = blockers.length === 0;
  return {
    contract: policy.auditContract,
    inputAudit: {
      contract: coverageReport.contract || null,
      contentHash: coverageReport.contentHash || null,
      contractValid: inputContractValid,
      contentHashValid: inputContentHashValid,
      targetBaseAgility: Number.isFinite(Number(coverageReport.targetBaseAgility)) ? Number(coverageReport.targetBaseAgility) : null,
      targetMatchesPolicy: inputTargetValid
    },
    candidateCoverage: {
      inputMechanicalGapCount: inputCandidates.length,
      policyCandidateCount: policyKeys.length,
      outputRecordCount: records.length,
      candidateSetMatches,
      blockerSetsMatch
    },
    sourceCoverage: {
      declaredDistinctSourceCount: declaredSourceKeys.length,
      boundDistinctSourceCount: sourceSet.size,
      exactRevisionRetrievedCount,
      sourceSetMatches,
      allExactRevisionsResolved
    },
    evidenceDomainCoverage: {
      blockerCount: evidenceDomains.length,
      mappedDomainCount,
      allBlockersMappedOnce,
      resolutionSignalCount,
      manualReauditCandidateCount,
      unresolvedDomainCount: evidenceDomains.filter(domain => domain.disposition === 'unresolved_not_found_in_declared_revision_bound_channels').length
    },
    blockerPreservation: {
      preserved: preservedBlockers,
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      accountStateFindingCount: foundAccountState.length,
      completeWikiUniverseClaimCount: records.filter(record => record.completeWikiUniverseClaimed).length
    },
    invalidPolicyRules,
    recordsMatchExpected,
    recordHashesValid,
    sourceChannelAuditComplete: publishable,
    sourceSufficiencyDispositionStable: publishable && resolutionSignalCount === 0,
    conditionOrMechanicsCoverageComplete: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable,
    blockers
  };
}
