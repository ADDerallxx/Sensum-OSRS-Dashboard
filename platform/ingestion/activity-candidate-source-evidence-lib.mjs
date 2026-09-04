const normalize = value => String(value ?? '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const lineNumber = (text, offset) => String(text ?? '').slice(0, offset).split(/\r?\n/).length;
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);

function maskIgnored(text) {
  return String(text ?? '').replace(
    /<!--[\s\S]*?-->|<nowiki\b[^>]*>[\s\S]*?<\/nowiki\s*>|<pre\b[^>]*>[\s\S]*?<\/pre\s*>|<syntaxhighlight\b[^>]*>[\s\S]*?<\/syntaxhighlight\s*>/gi,
    match => match.replace(/[^\r\n]/g, ' ')
  );
}

function splitTopLevel(text, absoluteStart = 0) {
  const source = String(text ?? '');
  const masked = maskIgnored(source);
  const parts = [];
  let start = 0;
  let templateDepth = 0;
  let linkDepth = 0;
  let tableDepth = 0;
  for (let index = 0; index < masked.length; index++) {
    const pair = masked.slice(index, index + 2);
    if (pair === '{{') { templateDepth++; index++; continue; }
    if (pair === '}}' && templateDepth > 0) { templateDepth--; index++; continue; }
    if (pair === '[[') { linkDepth++; index++; continue; }
    if (pair === ']]' && linkDepth > 0) { linkDepth--; index++; continue; }
    if (pair === '{|') { tableDepth++; index++; continue; }
    if (pair === '|}' && tableDepth > 0) { tableDepth--; index++; continue; }
    if (masked[index] === '|' && templateDepth === 0 && linkDepth === 0 && tableDepth === 0) {
      parts.push({ text: source.slice(start, index), start: absoluteStart + start, end: absoluteStart + index });
      start = index + 1;
    }
  }
  parts.push({ text: source.slice(start), start: absoluteStart + start, end: absoluteStart + source.length });
  return parts;
}

function topLevelEquals(text) {
  const source = String(text ?? '');
  const masked = maskIgnored(source);
  let templateDepth = 0;
  let linkDepth = 0;
  let tableDepth = 0;
  for (let index = 0; index < masked.length; index++) {
    const pair = masked.slice(index, index + 2);
    if (pair === '{{') { templateDepth++; index++; continue; }
    if (pair === '}}' && templateDepth > 0) { templateDepth--; index++; continue; }
    if (pair === '[[') { linkDepth++; index++; continue; }
    if (pair === ']]' && linkDepth > 0) { linkDepth--; index++; continue; }
    if (pair === '{|') { tableDepth++; index++; continue; }
    if (pair === '|}' && tableDepth > 0) { tableDepth--; index++; continue; }
    if (masked[index] === '=' && templateDepth === 0 && linkDepth === 0 && tableDepth === 0) return index;
  }
  return -1;
}

export function parseSupportedActivityInfobox(content = '') {
  const source = String(content ?? '');
  const masked = maskIgnored(source);
  const match = /\{\{\s*(Infobox\s+(?:Activity|Minigame))\b/i.exec(masked);
  if (!match) return null;
  const start = match.index;
  let depth = 0;
  let end = null;
  for (let index = start; index < masked.length - 1; index++) {
    const pair = masked.slice(index, index + 2);
    if (pair === '{{') { depth++; index++; continue; }
    if (pair === '}}' && depth > 0) {
      depth--;
      index++;
      if (depth === 0) { end = index + 1; break; }
    }
  }
  if (end === null) {
    return {
      template: normalize(match[1]),
      balanced: false,
      sourceLocator: { lineStart: lineNumber(source, start), lineEnd: null },
      parameters: []
    };
  }
  const innerStart = start + 2;
  const inner = source.slice(innerStart, end - 2);
  const parts = splitTopLevel(inner, innerStart);
  const template = normalize(parts.shift()?.text);
  let positionalIndex = 0;
  const parameters = parts.map((part, ordinal) => {
    const equals = topLevelEquals(part.text);
    const named = equals >= 0;
    if (!named) positionalIndex++;
    const rawName = named ? part.text.slice(0, equals).trim() : null;
    const rawValue = (named ? part.text.slice(equals + 1) : part.text).trim();
    return {
      ordinal: ordinal + 1,
      parameterKind: named ? 'named' : 'positional',
      parameterName: rawName,
      parameterKey: rawName ? normalize(rawName).toLowerCase() : null,
      positionalIndex: named ? null : positionalIndex,
      rawValue,
      sourceLocator: {
        lineStart: lineNumber(source, part.start),
        lineEnd: lineNumber(source, part.end)
      }
    };
  });
  return {
    template,
    balanced: true,
    sourceLocator: { lineStart: lineNumber(source, start), lineEnd: lineNumber(source, end) },
    parameters
  };
}

export function parseSourceHeadings(content = '') {
  const source = String(content ?? '');
  const rows = [];
  for (const match of source.matchAll(/^(={2,6})\s*(.*?)\s*\1\s*$/gm)) {
    rows.push({
      ordinal: rows.length + 1,
      level: match[1].length,
      rawTitle: match[2],
      normalizedTitle: normalize(match[2]),
      line: lineNumber(source, match.index)
    });
  }
  return rows;
}

export function parseLeadParagraphEvidence(content = '', infobox = null) {
  const source = String(content ?? '');
  const startLine = infobox?.sourceLocator?.lineEnd || 0;
  const lines = source.split(/\r?\n/);
  const rows = [];
  let buffer = [];
  let bufferStart = null;
  const flush = () => {
    const rawText = buffer.join('\n').trim();
    if (rawText) rows.push({ ordinal: rows.length + 1, rawText, sourceLocator: { lineStart: bufferStart, lineEnd: bufferStart + buffer.length - 1 } });
    buffer = [];
    bufferStart = null;
  };
  for (let index = startLine; index < lines.length; index++) {
    const line = lines[index];
    if (/^={2,6}\s*.*?\s*=+\s*$/.test(line)) { flush(); break; }
    if (!line.trim()) { flush(); continue; }
    if (/^\s*(?:\{\{|\}\}|\[\[Category:|\{\||\|\}|\|-|\!|\|)/i.test(line)) { flush(); continue; }
    if (bufferStart === null) bufferStart = index + 1;
    buffer.push(line);
  }
  flush();
  return rows;
}

export function collectLexicalReviewCandidates(content = '', policy = {}) {
  const source = String(content ?? '');
  const lines = source.split(/\r?\n/);
  const signals = (policy.lexicalSignals || []).map(signal => ({ ...signal, regex: new RegExp(signal.pattern, signal.flags || '') }));
  const rows = [];
  for (const [index, rawText] of lines.entries()) {
    if (!rawText.trim()) continue;
    for (const signal of signals) {
      if (!signal.regex.test(rawText)) continue;
      rows.push({
        signalKey: signal.signalKey,
        family: signal.family,
        line: index + 1,
        rawText: rawText.trim(),
        interpretationState: 'review_candidate_only'
      });
    }
  }
  return rows;
}

export function findActivityCandidateSourceEvidenceAccountState(records = []) {
  const findings = [];
  const visit = (value, path, recordKey) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`, recordKey)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ recordKey, path: childPath, value: child });
      visit(child, childPath, recordKey);
    }
  };
  records.forEach((record, index) => visit(record, '', record?.candidateKey || `record-${index}`));
  return findings;
}

const keyDuplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const sourceContent = page => page?.revisions?.[0]?.slots?.main?.content;
const signatureContextKey = (pageId, context = {}) => JSON.stringify({
  pageId: Number(pageId),
  targetKey: context.targetKey || null,
  requestedTitle: context.requestedTitle || null,
  requestedFragment: context.requestedFragment || null,
  redirected: Boolean(context.redirected),
  identitySourceRevision: String(context.identitySourceRevision || ''),
  referencedBy: {
    skillKeys: sorted(context.referencedBy?.skillKeys || []),
    statementKeys: sorted(context.referencedBy?.statementKeys || [])
  }
});

export function buildActivityCandidateSourceEvidence({ candidates = [], signatures = [], fetchedPages = [], policy = {}, contentHash = value => value }) {
  const activityCandidates = candidates.filter(candidate => candidate.candidateKind === 'activity_page_identity_candidate');
  const signaturesByPageId = new Map();
  for (const signature of signatures) {
    const key = String(signature.sourcePageId);
    if (!signaturesByPageId.has(key)) signaturesByPageId.set(key, []);
    signaturesByPageId.get(key).push(signature);
  }
  const pageByRevision = new Map(fetchedPages.flatMap(page => (page.revisions || []).map(revision => [String(revision.revid), { page, revision }])));
  const records = activityCandidates.map(candidate => {
    const pageId = candidate.pageIdentity?.sourcePageId;
    const signatureGroup = [...(signaturesByPageId.get(String(pageId)) || [])].sort((a, b) => String(a.targetKey).localeCompare(String(b.targetKey)));
    const signature = signatureGroup[0];
    const equivalentSignatureContexts = signatureGroup.length > 0 && signatureGroup.every(row =>
      Number(row.sourcePageId) === Number(signature.sourcePageId) &&
      String(row.sourceRevision || '') === String(signature.sourceRevision || '') &&
      row.sourceContentHash === signature.sourceContentHash &&
      row.resolvedTitle === signature.resolvedTitle &&
      row.sourceTimestamp === signature.sourceTimestamp &&
      row.sourceUrl === signature.sourceUrl
    );
    const fetched = pageByRevision.get(String(signature?.sourceRevision || candidate.pageIdentity?.unlockSourceRevision || ''));
    const page = fetched?.page || null;
    const revision = fetched?.revision || null;
    const content = sourceContent(page);
    const computedHash = typeof content === 'string' ? contentHash(content) : null;
    const revisionAlignment = {
      candidateAndSignaturePageIdMatch: Boolean(signature && Number(signature.sourcePageId) === Number(pageId)),
      allSignatureContextsEquivalent: equivalentSignatureContexts,
      fetchedAndSignaturePageIdMatch: Boolean(signature && Number(page?.pageid) === Number(signature.sourcePageId)),
      candidateAndSignatureRevisionMatch: Boolean(signature && String(candidate.pageIdentity?.unlockSourceRevision || '') === String(signature.sourceRevision || '')),
      fetchedAndSignatureRevisionMatch: Boolean(signature && String(revision?.revid || '') === String(signature.sourceRevision || '')),
      fetchedAndSignatureContentHashMatch: Boolean(signature && computedHash && computedHash === signature.sourceContentHash)
    };
    const infoboxEvidence = typeof content === 'string' ? parseSupportedActivityInfobox(content) : null;
    const headingEvidence = typeof content === 'string' ? parseSourceHeadings(content) : [];
    const leadParagraphEvidence = typeof content === 'string' ? parseLeadParagraphEvidence(content, infoboxEvidence) : [];
    const lexicalReviewCandidates = typeof content === 'string' ? collectLexicalReviewCandidates(content, policy) : [];
    const blockers = [];
    if (!signature) blockers.push('retained_source_signature_missing');
    if (!page || !revision || typeof content !== 'string') blockers.push('exact_revision_source_content_missing');
    if (!Object.values(revisionAlignment).every(Boolean)) blockers.push('candidate_signature_or_fetched_source_alignment_failed');
    if (infoboxEvidence && !infoboxEvidence.balanced) blockers.push('supported_activity_infobox_unbalanced');
    if (!infoboxEvidence) blockers.push('supported_activity_infobox_not_present');
    blockers.push(
      'source_evidence_requires_semantic_review',
      'canonical_game_entity_identity_not_established',
      'canonical_activity_identity_not_established',
      'repeatability_not_semantically_reviewed',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked'
    );
    return {
      contract: 'sensum.activity-candidate-source-evidence.v1',
      candidateKey: candidate.candidateKey,
      sourceCandidateContentHash: candidate.contentHash,
      sourceSignatureContexts: signatureGroup.map(row => ({
        targetKey: row.targetKey,
        requestedTitle: row.requestedTitle,
        requestedFragment: row.requestedFragment,
        redirected: Boolean(row.redirected),
        identitySourceRevision: row.identitySourceRevision,
        referencedBy: row.referencedBy
      })),
      sourcePageId: Number.isInteger(pageId) ? pageId : null,
      resolvedTitle: signature?.resolvedTitle || candidate.pageIdentity?.resolvedTitle || null,
      skillKeys: sorted(candidate.skillKeys || []),
      statementKeys: sorted(candidate.statementKeys || []),
      sourceRevision: signature?.sourceRevision || null,
      sourceTimestamp: signature?.sourceTimestamp || null,
      sourceUrl: signature?.sourceUrl || null,
      sourceContentHash: computedHash,
      sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : null,
      revisionAlignment,
      pageTypeEvidence: {
        entityTypes: sorted(candidate.sourceContexts?.unlockEvidence?.entityTypes || []),
        rootTemplates: signature?.rootTemplates || [],
        directCategories: signature?.directCategories || []
      },
      infoboxEvidence,
      leadParagraphEvidence,
      headingEvidence,
      lexicalReviewCandidates,
      semanticIdentityReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      canonicalGameEntityIdentity: null,
      canonicalActivityIdentity: null,
      optimizerEligible: false,
      accountIndependent: true,
      blockers: unique(blockers),
      state: blockers.some(blocker => ['retained_source_signature_missing', 'exact_revision_source_content_missing', 'candidate_signature_or_fetched_source_alignment_failed', 'supported_activity_infobox_unbalanced'].includes(blocker)) ? 'blocked_source' : 'review_ready'
    };
  });
  const audit = auditActivityCandidateSourceEvidence(records, { candidates, signatures, fetchedPages, policy });
  return { records, audit };
}

export function auditActivityCandidateSourceEvidence(records = [], { candidates = [], signatures = [], fetchedPages = [], policy = {} } = {}) {
  const expectedCandidates = candidates.filter(candidate => candidate.candidateKind === 'activity_page_identity_candidate');
  const expectedKeys = expectedCandidates.map(candidate => candidate.candidateKey);
  const actualKeys = records.map(record => record.candidateKey);
  const duplicateExpectedKeys = keyDuplicates(expectedKeys);
  const duplicateActualKeys = keyDuplicates(actualKeys);
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const expectedPageIds = expectedCandidates.map(candidate => String(candidate.pageIdentity?.sourcePageId));
  const relevantSignatures = signatures.filter(signature => expectedPageIds.includes(String(signature.sourcePageId)));
  const signaturePageIds = unique(relevantSignatures.map(signature => String(signature.sourcePageId)));
  const multiContextSignaturePageIds = signaturePageIds.filter(pageId => relevantSignatures.filter(signature => String(signature.sourcePageId) === pageId).length > 1);
  const conflictingSignaturePageIds = multiContextSignaturePageIds.filter(pageId => {
    const group = relevantSignatures.filter(signature => String(signature.sourcePageId) === pageId);
    const first = group[0];
    return group.some(signature => String(signature.sourceRevision || '') !== String(first.sourceRevision || '') || signature.sourceContentHash !== first.sourceContentHash || signature.resolvedTitle !== first.resolvedTitle || signature.sourceTimestamp !== first.sourceTimestamp || signature.sourceUrl !== first.sourceUrl);
  });
  const missingSignaturePageIds = expectedPageIds.filter(pageId => !signaturePageIds.includes(pageId));
  const relevantRevisions = new Set(relevantSignatures.map(signature => String(signature.sourceRevision)));
  const fetchedRevisionKeys = fetchedPages.flatMap(page => (page.revisions || []).map(revision => String(revision.revid))).filter(revision => relevantRevisions.has(revision));
  const duplicateFetchedRevisions = keyDuplicates(fetchedRevisionKeys);
  const missingFetchedRevisions = [...relevantRevisions].filter(revision => !fetchedRevisionKeys.includes(revision));
  const expectedSignatureContextKeys = relevantSignatures.map(signature => signatureContextKey(signature.sourcePageId, signature));
  const actualSignatureContextKeys = records.flatMap(record => (record.sourceSignatureContexts || []).map(context => signatureContextKey(record.sourcePageId, context)));
  const duplicateExpectedSignatureContexts = keyDuplicates(expectedSignatureContextKeys);
  const duplicateActualSignatureContexts = keyDuplicates(actualSignatureContextKeys);
  const missingSignatureContexts = expectedSignatureContextKeys.filter(key => !actualSignatureContextKeys.includes(key));
  const unexpectedSignatureContexts = actualSignatureContextKeys.filter(key => !expectedSignatureContextKeys.includes(key));
  const sourceAlignmentFailures = records.filter(record => !Object.values(record.revisionAlignment || {}).every(Boolean)).map(record => record.candidateKey);
  const unbalancedInfoboxes = records.filter(record => record.infoboxEvidence && !record.infoboxEvidence.balanced).map(record => record.candidateKey);
  const missingInfoboxes = records.filter(record => !record.infoboxEvidence).map(record => record.candidateKey);
  const accountStateFindings = findActivityCandidateSourceEvidenceAccountState(records);
  const unsupportedPromotions = records.filter(record => record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null || record.optimizerEligible !== false || record.semanticIdentityReview?.state !== 'unreviewed' || record.repeatabilityReview?.state !== 'unreviewed').map(record => record.candidateKey);
  const signalCounts = {};
  const familyCounts = {};
  for (const record of records) for (const evidence of record.lexicalReviewCandidates || []) {
    signalCounts[evidence.signalKey] = (signalCounts[evidence.signalKey] || 0) + 1;
    familyCounts[evidence.family] = (familyCounts[evidence.family] || 0) + 1;
  }
  const policySignals = new Set((policy.lexicalSignals || []).map(signal => signal.signalKey));
  const unexpectedSignalKeys = unique(records.flatMap(record => (record.lexicalReviewCandidates || []).map(evidence => evidence.signalKey)).filter(key => !policySignals.has(key)));
  const structuralBlockers = [];
  if (duplicateExpectedKeys.length) structuralBlockers.push('duplicate_activity_candidate_keys');
  if (duplicateActualKeys.length) structuralBlockers.push('duplicate_activity_source_evidence_keys');
  if (missingKeys.length) structuralBlockers.push('one_or_more_activity_candidates_missing_source_evidence');
  if (unexpectedKeys.length) structuralBlockers.push('unexpected_activity_source_evidence_record');
  if (missingSignaturePageIds.length) structuralBlockers.push('activity_candidate_source_signature_join_incomplete');
  if (conflictingSignaturePageIds.length) structuralBlockers.push('same_page_source_signature_contexts_conflict');
  if (duplicateExpectedSignatureContexts.length || duplicateActualSignatureContexts.length || missingSignatureContexts.length || unexpectedSignatureContexts.length) structuralBlockers.push('activity_source_signature_context_preservation_failed');
  if (duplicateFetchedRevisions.length || missingFetchedRevisions.length) structuralBlockers.push('exact_revision_fetch_set_incomplete');
  if (sourceAlignmentFailures.length) structuralBlockers.push('one_or_more_source_records_failed_page_revision_or_hash_alignment');
  if (unbalancedInfoboxes.length) structuralBlockers.push('one_or_more_supported_activity_infoboxes_unbalanced');
  if (unexpectedSignalKeys.length) structuralBlockers.push('one_or_more_lexical_signal_keys_not_in_policy');
  if (unsupportedPromotions.length) structuralBlockers.push('unsupported_semantic_repeatability_or_optimizer_promotion');
  if (accountStateFindings.length) structuralBlockers.push('account_query_state_baked_into_activity_source_evidence');
  const sourceEvidenceCoverageComplete = expectedKeys.length > 0 && structuralBlockers.length === 0;
  const blockers = [...structuralBlockers];
  if (missingInfoboxes.length) blockers.push('one_or_more_activity_candidates_have_no_supported_infobox');
  blockers.push(
    'activity_candidate_semantic_identity_review_pending',
    'activity_candidate_repeatability_review_pending',
    'requirements_variants_xp_timing_and_mechanics_not_structured',
    'independent_complete_activity_universe_not_established'
  );
  return {
    contract: 'sensum.activity-candidate-source-evidence-audit.v1',
    accountIndependent: accountStateFindings.length === 0,
    inputCoverage: {
      expectedActivityCandidateCount: expectedKeys.length,
      sourceEvidenceRecordCount: records.length,
      relevantSourceSignatureCount: relevantSignatures.length,
      relevantSourceSignaturePageCount: signaturePageIds.length,
      preservedSourceSignatureContextCount: actualSignatureContextKeys.length,
      fetchedExactRevisionCount: fetchedRevisionKeys.length,
      duplicateInputCandidateKeys: duplicateExpectedKeys,
      duplicateOutputCandidateKeys: duplicateActualKeys,
      missingCandidateKeys: missingKeys,
      unexpectedCandidateKeys: unexpectedKeys,
      multiContextSignaturePageIds,
      conflictingSignaturePageIds,
      missingSignaturePageIds,
      duplicateInputSignatureContextKeys: duplicateExpectedSignatureContexts,
      duplicateOutputSignatureContextKeys: duplicateActualSignatureContexts,
      missingSignatureContextKeys: missingSignatureContexts,
      unexpectedSignatureContextKeys: unexpectedSignatureContexts,
      duplicateFetchedRevisions,
      missingFetchedRevisions,
      exactCandidateSignatureAndFetchSetMatch: !duplicateExpectedKeys.length && !duplicateActualKeys.length && !missingKeys.length && !unexpectedKeys.length && !missingSignaturePageIds.length && !conflictingSignaturePageIds.length && !duplicateExpectedSignatureContexts.length && !duplicateActualSignatureContexts.length && !missingSignatureContexts.length && !unexpectedSignatureContexts.length && !duplicateFetchedRevisions.length && !missingFetchedRevisions.length
    },
    sourceAlignment: {
      fullyAlignedCount: records.length - sourceAlignmentFailures.length,
      failedCandidateKeys: sourceAlignmentFailures,
      allPageIdsRevisionsAndContentHashesAligned: sourceAlignmentFailures.length === 0
    },
    structuralEvidenceCoverage: {
      supportedInfoboxCount: records.length - missingInfoboxes.length,
      missingSupportedInfoboxCandidateKeys: missingInfoboxes,
      unbalancedSupportedInfoboxCandidateKeys: unbalancedInfoboxes,
      infoboxTemplateCounts: Object.fromEntries(sorted(unique(records.map(record => record.infoboxEvidence?.template).filter(Boolean))).map(template => [template, records.filter(record => record.infoboxEvidence?.template === template).length])),
      totalInfoboxParameterOccurrences: records.reduce((sum, record) => sum + (record.infoboxEvidence?.parameters?.length || 0), 0),
      totalLeadParagraphs: records.reduce((sum, record) => sum + (record.leadParagraphEvidence?.length || 0), 0),
      totalHeadings: records.reduce((sum, record) => sum + (record.headingEvidence?.length || 0), 0)
    },
    lexicalCandidateCoverage: {
      policySignalCount: policySignals.size,
      matchedStatementCount: records.reduce((sum, record) => sum + (record.lexicalReviewCandidates?.length || 0), 0),
      candidateCountWithAnyMatch: records.filter(record => record.lexicalReviewCandidates?.length).length,
      familyCounts: Object.fromEntries(Object.entries(familyCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      signalCounts: Object.fromEntries(Object.entries(signalCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      unexpectedSignalKeys
    },
    semanticPromotionCoverage: {
      reviewReadyCount: records.filter(record => record.state === 'review_ready').length,
      semanticIdentityReviewedCount: records.filter(record => record.semanticIdentityReview?.state !== 'unreviewed').length,
      repeatabilityReviewedCount: records.filter(record => record.repeatabilityReview?.state !== 'unreviewed').length,
      canonicalGameEntityIdentityCount: records.filter(record => record.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(record => record.canonicalActivityIdentity !== null).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length,
      unsupportedPromotionCandidateKeys: unsupportedPromotions
    },
    accountStateFindings,
    sourceEvidenceCoverageComplete,
    semanticReviewComplete: false,
    repeatabilityReviewComplete: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique(blockers),
    publishable: sourceEvidenceCoverageComplete
  };
}
