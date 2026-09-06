const WIKI_PREFIX = 'https://oldschool.runescape.wiki/w/';
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

const withoutHash = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const reportHash = (report, contentHash) => contentHash({ ...report, contentHash: undefined });

function titleFromWikiUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string' || !sourceUrl.startsWith(WIKI_PREFIX)) return null;
  const raw = sourceUrl.slice(WIKI_PREFIX.length).split('#')[0];
  if (!raw) return null;
  try { return decodeURIComponent(raw).replaceAll('_', ' '); } catch { return null; }
}

function visitSourcePairs(value, path, found) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitSourcePairs(item, `${path}[${index}]`, found));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const sourceRevision = value.sourceRevision ?? value.source_revision;
  const sourceUrl = value.sourceUrl ?? value.source_url;
  if (sourceRevision !== undefined && sourceUrl !== undefined) {
    found.push({ sourceRevision: String(sourceRevision), sourceUrl: String(sourceUrl), sourcePath: path || '$' });
  }
  for (const [key, child] of Object.entries(value)) visitSourcePairs(child, path ? `${path}.${key}` : key, found);
}

export function extractAgilityOpenBlockerSources(report = {}, policy = {}) {
  const blockedCandidates = (report.details || []).filter(detail => Array.isArray(detail.blockers) && detail.blockers.length > 0);
  const grouped = new Map();
  const invalidPairs = [];
  for (const candidate of blockedCandidates) {
    const pairs = [];
    visitSourcePairs(candidate, '', pairs);
    for (const pair of pairs) {
      const requestedTitle = titleFromWikiUrl(pair.sourceUrl);
      const revisionValid = /^[1-9]\d*$/.test(pair.sourceRevision);
      if (!requestedTitle || !revisionValid || !pair.sourceUrl.startsWith(policy.acceptedSourceOrigin || WIKI_PREFIX)) {
        invalidPairs.push({ candidateKey: candidate.candidateKey, ...pair });
        continue;
      }
      const sourceKey = `${pair.sourceRevision}|${pair.sourceUrl}`;
      if (!grouped.has(sourceKey)) grouped.set(sourceKey, {
        sourceKey,
        requestedTitle,
        sourceRevision: pair.sourceRevision,
        sourceUrl: pair.sourceUrl,
        occurrences: [],
        candidates: new Map()
      });
      const source = grouped.get(sourceKey);
      source.occurrences.push({ candidateKey: candidate.candidateKey, sourcePath: pair.sourcePath });
      if (!source.candidates.has(candidate.candidateKey)) source.candidates.set(candidate.candidateKey, {
        candidateKey: candidate.candidateKey,
        candidateName: candidate.name,
        candidateStatus: candidate.status,
        mechanicalReadiness: candidate.mechanicalReadiness,
        blockers: sorted(candidate.blockers)
      });
    }
  }
  const sources = [...grouped.values()].map(source => ({
    ...source,
    occurrences: source.occurrences.sort((a, b) => `${a.candidateKey}|${a.sourcePath}`.localeCompare(`${b.candidateKey}|${b.sourcePath}`)),
    candidates: [...source.candidates.values()].sort((a, b) => a.candidateKey.localeCompare(b.candidateKey))
  })).sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  return { blockedCandidates, sources, invalidPairs };
}

function exactByRevision(pages = []) {
  const map = new Map();
  for (const page of pages) for (const revision of page.revisions || []) map.set(String(revision.revid), { page, revision });
  return map;
}

function headByRequestedTitle(resolutions = []) {
  return new Map(resolutions.map(resolution => [resolution.requestedTitle, resolution]));
}

function revisionState(source, exact, head) {
  if (!exact?.page || !exact?.revision || typeof exact.revision.slots?.main?.content !== 'string') return 'exact_revision_unavailable_blocked';
  if (!head?.page || !head.page.revisions?.[0]) return 'current_head_unavailable_blocked';
  if (Number(head.page.pageid) !== Number(exact.page.pageid)) return 'source_identity_mismatch_blocked';
  if (head.redirected || head.resolvedTitle !== exact.page.title) return 'redirect_or_title_change_reaudit_required';
  const pinned = Number(source.sourceRevision);
  const current = Number(head.page.revisions[0].revid);
  if (current === pinned) return 'unchanged';
  if (current > pinned) return 'head_advanced_reaudit_required';
  return 'head_older_than_pinned_blocked';
}

export function findAgilityOpenBlockerMonitorAccountState(records = []) {
  const findings = [];
  const visit = (value, path, sourceKey) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`, sourceKey)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ sourceKey, path: childPath, value: child });
      visit(child, childPath, sourceKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record.sourceKey || `record-${index}`));
  return findings;
}

export function buildAgilityOpenBlockerSourceRevisionMonitor({ coverageReport = {}, exactRevisionPages = [], headResolutions = [], policy = {}, contentHash = value => value }) {
  const extracted = extractAgilityOpenBlockerSources(coverageReport, policy);
  const exactMap = exactByRevision(exactRevisionPages);
  const headMap = headByRequestedTitle(headResolutions);
  const records = extracted.sources.map(source => {
    const exact = exactMap.get(source.sourceRevision);
    const head = headMap.get(source.requestedTitle);
    const content = exact?.revision?.slots?.main?.content;
    const state = revisionState(source, exact, head);
    const reauditing = ['head_advanced_reaudit_required', 'redirect_or_title_change_reaudit_required'].includes(state);
    const integrityBlocked = state.endsWith('_blocked');
    const candidateBlockers = unique(source.candidates.flatMap(candidate => candidate.blockers));
    const base = {
      contract: policy.recordContract,
      sourceKey: source.sourceKey,
      inputAuditContentHash: coverageReport.contentHash || null,
      requestedTitle: source.requestedTitle,
      pinnedSource: {
        sourceRevision: source.sourceRevision,
        sourceUrl: source.sourceUrl,
        pageId: Number.isInteger(exact?.page?.pageid) ? exact.page.pageid : null,
        resolvedTitle: exact?.page?.title || null,
        timestamp: exact?.revision?.timestamp || null,
        contentHash: typeof content === 'string' ? contentHash(content) : null,
        contentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null,
        exactRevisionRetrievable: typeof content === 'string' && String(exact?.revision?.revid || '') === source.sourceRevision
      },
      currentHead: {
        pageId: Number.isInteger(head?.page?.pageid) ? head.page.pageid : null,
        resolvedTitle: head?.page?.title || head?.resolvedTitle || null,
        revision: head?.page?.revisions?.[0]?.revid ? String(head.page.revisions[0].revid) : null,
        timestamp: head?.page?.revisions?.[0]?.timestamp || null,
        redirected: Boolean(head?.redirected)
      },
      revisionState: state,
      sourceOccurrenceCount: source.occurrences.length,
      sourceOccurrences: source.occurrences,
      affectedCandidates: source.candidates,
      existingBlockerCount: candidateBlockers.length,
      blockersClosed: 0,
      reauditRequired: reauditing,
      semanticFactsCreated: 0,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      blockers: unique([
        ...candidateBlockers,
        integrityBlocked ? state : null,
        reauditing ? 'source_revision_changed_reaudit_required' : 'open_condition_or_mechanical_model_blockers_remain'
      ].filter(Boolean))
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
  return { records, audit: auditAgilityOpenBlockerSourceRevisionMonitor(records, { coverageReport, exactRevisionPages, headResolutions, policy, contentHash }) };
}

export function auditAgilityOpenBlockerSourceRevisionMonitor(records = [], { coverageReport = {}, exactRevisionPages = [], headResolutions = [], policy = {}, contentHash = value => value } = {}) {
  const extracted = extractAgilityOpenBlockerSources(coverageReport, policy);
  const expectedKeys = extracted.sources.map(source => source.sourceKey);
  const actualKeys = records.map(record => record.sourceKey);
  const duplicateKeys = actualKeys.filter((key, index) => actualKeys.indexOf(key) !== index);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputContractValid = coverageReport.contract === policy.inputAuditContract;
  const inputHashValid = Boolean(coverageReport.contentHash) && reportHash(coverageReport, contentHash) === coverageReport.contentHash;
  const expectedBlockingCount = Number(coverageReport.blockingCandidates);
  const blockedCandidateCountMatches = Number.isInteger(expectedBlockingCount) && expectedBlockingCount === extracted.blockedCandidates.length;
  const recordHashesValid = records.every(record => {
    const expectedRecordHash = contentHash(withoutHash(record, ['recordContentHash', 'contentHash']));
    const expectedContentHash = contentHash(withoutHash(record, ['contentHash']));
    return record.recordContentHash === expectedRecordHash && record.contentHash === expectedContentHash;
  });
  const accountFindings = findAgilityOpenBlockerMonitorAccountState(records);
  const forbiddenPromotionCount = records.filter(record => record.blockersClosed !== 0 || record.semanticFactsCreated !== 0 || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).length;
  const exactRetrievedCount = records.filter(record => record.pinnedSource?.exactRevisionRetrievable).length;
  const headResolvedCount = records.filter(record => record.currentHead?.revision).length;
  const integrityBlockedCount = records.filter(record => record.revisionState?.endsWith('_blocked')).length;
  const unchangedCount = records.filter(record => record.revisionState === 'unchanged').length;
  const reauditRequiredCount = records.filter(record => record.reauditRequired).length;
  const preservedCandidateKeys = unique(records.flatMap(record => record.affectedCandidates?.map(candidate => candidate.candidateKey) || []));
  const expectedCandidateKeys = sorted(extracted.blockedCandidates.map(candidate => candidate.candidateKey));
  const candidateSetPreserved = JSON.stringify(sorted(preservedCandidateKeys)) === JSON.stringify(expectedCandidateKeys);
  const candidateBlockersPreserved = records.every(record => record.affectedCandidates?.every(candidate => candidate.blockers?.every(blocker => record.blockers.includes(blocker))));
  const blockers = [];
  if (!inputContractValid) blockers.push('input_coverage_audit_contract_invalid');
  if (!inputHashValid) blockers.push('input_coverage_audit_content_hash_invalid');
  if (!blockedCandidateCountMatches) blockers.push('input_blocking_candidate_count_mismatch');
  if (extracted.invalidPairs.length) blockers.push('one_or_more_blocked_candidate_source_pairs_invalid');
  if (duplicateKeys.length || missingKeys.length || unexpectedKeys.length) blockers.push('monitor_source_set_mismatch');
  if (exactRetrievedCount !== expectedKeys.length) blockers.push('one_or_more_pinned_revisions_not_retrievable');
  if (headResolvedCount !== expectedKeys.length) blockers.push('one_or_more_current_heads_not_resolved');
  if (integrityBlockedCount) blockers.push('one_or_more_source_revision_integrity_checks_blocked');
  if (!recordHashesValid) blockers.push('one_or_more_monitor_record_hashes_invalid');
  if (!candidateSetPreserved || !candidateBlockersPreserved) blockers.push('affected_candidate_or_blocker_preservation_failed');
  if (forbiddenPromotionCount) blockers.push('monitor_created_unsupported_fact_resolution_or_optimizer_promotion');
  if (accountFindings.length) blockers.push('account_query_state_baked_into_source_revision_monitor');
  return {
    contract: policy.auditContract,
    inputAudit: {
      contract: coverageReport.contract || null,
      contentHash: coverageReport.contentHash || null,
      contractValid: inputContractValid,
      contentHashValid: inputHashValid,
      declaredBlockingCandidates: Number.isFinite(expectedBlockingCount) ? expectedBlockingCount : null
    },
    candidateCoverage: {
      expectedBlockedCandidateCount: extracted.blockedCandidates.length,
      preservedBlockedCandidateCount: preservedCandidateKeys.length,
      candidateSetPreserved,
      candidateBlockersPreserved
    },
    sourceCoverage: {
      expectedDistinctSourceCount: expectedKeys.length,
      outputSourceCount: records.length,
      exactRevisionRetrievedCount: exactRetrievedCount,
      currentHeadResolvedCount: headResolvedCount,
      invalidSourcePairCount: extracted.invalidPairs.length,
      missingKeys,
      unexpectedKeys,
      duplicateKeys: unique(duplicateKeys)
    },
    revisionStates: {
      unchangedCount,
      reauditRequiredCount,
      integrityBlockedCount,
      byState: Object.fromEntries(sorted(unique(records.map(record => record.revisionState))).map(state => [state, records.filter(record => record.revisionState === state).length]))
    },
    blockerPreservation: {
      existingBlockedCandidateCount: extracted.blockedCandidates.length,
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length
    },
    sourceRevisionMonitoringComplete: blockers.length === 0,
    sourceSetCurrent: blockers.length === 0 && reauditRequiredCount === 0 && unchangedCount === expectedKeys.length,
    conditionOrMechanicsCoverageComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable: blockers.length === 0,
    blockers: unique(blockers)
  };
}
