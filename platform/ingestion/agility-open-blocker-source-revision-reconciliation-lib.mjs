const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const accountKey = name => /^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|ownedItems|ownedEquipment|playerName|username|preferences)$/i.test(name);
const withoutHash = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function diffOperations(oldLines, newLines) {
  const rows = oldLines.length + 1;
  const columns = newLines.length + 1;
  const table = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex--) {
      table[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? table[oldIndex + 1][newIndex + 1] + 1
        : Math.max(table[oldIndex + 1][newIndex], table[oldIndex][newIndex + 1]);
    }
  }
  const operations = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      operations.push({ kind: 'equal', oldLine: oldIndex + 1, newLine: newIndex + 1, text: oldLines[oldIndex] });
      oldIndex++;
      newIndex++;
    } else if (newIndex < newLines.length && (oldIndex === oldLines.length || table[oldIndex][newIndex + 1] >= table[oldIndex + 1][newIndex])) {
      operations.push({ kind: 'add', oldLine: oldIndex + 1, newLine: newIndex + 1, text: newLines[newIndex] });
      newIndex++;
    } else {
      operations.push({ kind: 'remove', oldLine: oldIndex + 1, newLine: newIndex + 1, text: oldLines[oldIndex] });
      oldIndex++;
    }
  }
  return operations;
}

export function buildDeterministicLineDelta(oldContent = '', newContent = '') {
  const oldLines = String(oldContent).split(/\r?\n/);
  const newLines = String(newContent).split(/\r?\n/);
  if (oldContent === newContent) return { oldLineCount: oldLines.length, newLineCount: newLines.length, addedLineCount: 0, removedLineCount: 0, changedHunkCount: 0, hunks: [] };
  const operations = diffOperations(oldLines, newLines);
  const hunks = [];
  let pending = null;
  const flush = () => {
    if (!pending) return;
    hunks.push({
      oldStart: pending.oldStart,
      oldEnd: pending.removedLines.length ? pending.oldStart + pending.removedLines.length - 1 : pending.oldStart - 1,
      newStart: pending.newStart,
      newEnd: pending.addedLines.length ? pending.newStart + pending.addedLines.length - 1 : pending.newStart - 1,
      removedLines: pending.removedLines,
      addedLines: pending.addedLines
    });
    pending = null;
  };
  for (const operation of operations) {
    if (operation.kind === 'equal') { flush(); continue; }
    if (!pending) pending = { oldStart: operation.oldLine, newStart: operation.newLine, removedLines: [], addedLines: [] };
    if (operation.kind === 'remove') pending.removedLines.push(operation.text);
    if (operation.kind === 'add') pending.addedLines.push(operation.text);
  }
  flush();
  return {
    oldLineCount: oldLines.length,
    newLineCount: newLines.length,
    addedLineCount: hunks.reduce((sum, hunk) => sum + hunk.addedLines.length, 0),
    removedLineCount: hunks.reduce((sum, hunk) => sum + hunk.removedLines.length, 0),
    changedHunkCount: hunks.length,
    hunks
  };
}

function revisionsById(pages = []) {
  const map = new Map();
  for (const page of pages) for (const revision of page.revisions || []) map.set(String(revision.revid), { page, revision });
  return map;
}

export function findAgilityRevisionReconciliationAccountState(records = []) {
  const findings = [];
  const visit = (value, path, key) => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`, key)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${name}` : name;
      if (accountKey(name)) findings.push({ reconciliationKey: key, path: childPath, value: child });
      visit(child, childPath, key);
    }
  };
  records.forEach((record, index) => visit(record, '', record.reconciliationKey || `record-${index}`));
  return findings;
}

export function buildAgilityOpenBlockerSourceRevisionReconciliation({ monitorRecords = [], exactRevisionPages = [], policy = {}, inputBinding = {}, contentHash = value => value }) {
  const revisionMap = revisionsById(exactRevisionPages);
  const expected = monitorRecords.filter(record => record.reauditRequired === true);
  const records = expected.map(monitor => {
    const pinned = revisionMap.get(String(monitor.pinnedSource?.sourceRevision || ''));
    const current = revisionMap.get(String(monitor.currentHead?.revision || ''));
    const pinnedContent = pinned?.revision?.slots?.main?.content;
    const currentContent = current?.revision?.slots?.main?.content;
    const pinnedHash = typeof pinnedContent === 'string' ? contentHash(pinnedContent) : null;
    const currentHash = typeof currentContent === 'string' ? contentHash(currentContent) : null;
    const pinnedBytes = typeof pinnedContent === 'string' ? Buffer.byteLength(pinnedContent, 'utf8') : null;
    const currentBytes = typeof currentContent === 'string' ? Buffer.byteLength(currentContent, 'utf8') : null;
    const exactContentAvailable = typeof pinnedContent === 'string' && typeof currentContent === 'string';
    const pageIdentityStable = Boolean(pinned?.page && current?.page && Number(pinned.page.pageid) === Number(current.page.pageid) && pinned.page.title === current.page.title);
    const pinnedMatchesMonitor = Boolean(
      pinned?.page &&
      String(pinned.revision?.revid || '') === String(monitor.pinnedSource?.sourceRevision || '') &&
      Number(pinned.page.pageid) === Number(monitor.pinnedSource?.pageId) &&
      pinned.page.title === monitor.pinnedSource?.resolvedTitle &&
      pinnedHash === monitor.pinnedSource?.contentHash &&
      pinnedBytes === monitor.pinnedSource?.contentBytes
    );
    const currentMatchesMonitor = Boolean(
      current?.page &&
      String(current.revision?.revid || '') === String(monitor.currentHead?.revision || '') &&
      Number(current.page.pageid) === Number(monitor.currentHead?.pageId) &&
      current.page.title === monitor.currentHead?.resolvedTitle
    );
    const lineDelta = exactContentAvailable ? buildDeterministicLineDelta(pinnedContent, currentContent) : null;
    const byteIdentical = exactContentAvailable && pinnedContent === currentContent;
    const contentState = !exactContentAvailable || !pageIdentityStable || !pinnedMatchesMonitor || !currentMatchesMonitor
      ? 'source_integrity_blocked'
      : byteIdentical ? 'byte_identical_revision_churn' : 'content_changed_semantic_reaudit_required';
    const revisionDriftAlertResolved = contentState === 'byte_identical_revision_churn';
    const semanticReauditRequired = contentState === 'content_changed_semantic_reaudit_required';
    const originalBlockers = unique(monitor.affectedCandidates?.flatMap(candidate => candidate.blockers || []) || []);
    const base = {
      contract: policy.recordContract,
      reconciliationKey: `reconcile:${monitor.sourceKey}:${monitor.currentHead?.revision || 'missing'}`,
      inputMonitorContentHash: monitor.contentHash,
      requestedTitle: monitor.requestedTitle,
      pinnedRevision: {
        pageId: pinned?.page?.pageid ?? null,
        title: pinned?.page?.title ?? null,
        revision: pinned?.revision?.revid ? String(pinned.revision.revid) : null,
        timestamp: pinned?.revision?.timestamp ?? null,
        contentHash: pinnedHash,
        contentBytes: pinnedBytes,
        user: pinned?.revision?.user ?? null,
        comment: pinned?.revision?.comment ?? null
      },
      currentRevision: {
        pageId: current?.page?.pageid ?? null,
        title: current?.page?.title ?? null,
        revision: current?.revision?.revid ? String(current.revision.revid) : null,
        timestamp: current?.revision?.timestamp ?? null,
        contentHash: currentHash,
        contentBytes: currentBytes,
        user: current?.revision?.user ?? null,
        comment: current?.revision?.comment ?? null
      },
      revisionIdentity: { exactContentAvailable, pageIdentityStable, pinnedMatchesMonitor, currentMatchesMonitor },
      contentComparison: { state: contentState, byteIdentical, lineDelta },
      affectedCandidates: monitor.affectedCandidates || [],
      revisionDriftAlertResolved,
      semanticReauditRequired,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      blockers: unique([
        ...originalBlockers,
        contentState === 'source_integrity_blocked' ? 'source_revision_reconciliation_integrity_failed' : null,
        semanticReauditRequired ? 'source_content_changed_semantic_reaudit_required' : null,
        'open_condition_or_mechanical_model_blockers_remain'
      ].filter(Boolean))
    };
    const recordContentHash = contentHash(base);
    const withRecordHash = { ...base, recordContentHash };
    return { ...withRecordHash, contentHash: contentHash(withRecordHash) };
  });
  return { records, audit: auditAgilityOpenBlockerSourceRevisionReconciliation(records, { monitorRecords, exactRevisionPages, policy, inputBinding, contentHash }) };
}

export function auditAgilityOpenBlockerSourceRevisionReconciliation(records = [], { monitorRecords = [], policy = {}, inputBinding = {}, contentHash = value => value } = {}) {
  const expected = monitorRecords.filter(record => record.reauditRequired === true);
  const expectedKeys = expected.map(record => `reconcile:${record.sourceKey}:${record.currentHead?.revision || 'missing'}`);
  const actualKeys = records.map(record => record.reconciliationKey);
  const duplicateKeys = unique(actualKeys.filter((key, index) => actualKeys.indexOf(key) !== index));
  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  const unexpectedKeys = actualKeys.filter(key => !expectedKeys.includes(key));
  const inputRecordsValid = monitorRecords.every(record => {
    if (record.contract !== policy.inputRecordContract) return false;
    const expectedRecordHash = contentHash(withoutHash(record, ['recordContentHash', 'contentHash']));
    const expectedContentHash = contentHash(withoutHash(record, ['contentHash']));
    return record.recordContentHash === expectedRecordHash && record.contentHash === expectedContentHash;
  });
  const inputBindingValid = Boolean(inputBinding.directory && inputBinding.contentHash && inputBinding.domain === policy.inputDomain);
  const outputHashesValid = records.every(record => {
    const expectedRecordHash = contentHash(withoutHash(record, ['recordContentHash', 'contentHash']));
    const expectedContentHash = contentHash(withoutHash(record, ['contentHash']));
    return record.recordContentHash === expectedRecordHash && record.contentHash === expectedContentHash;
  });
  const sourceIntegrityBlockedCount = records.filter(record => record.contentComparison?.state === 'source_integrity_blocked').length;
  const byteIdenticalCount = records.filter(record => record.contentComparison?.state === 'byte_identical_revision_churn').length;
  const contentChangedCount = records.filter(record => record.contentComparison?.state === 'content_changed_semantic_reaudit_required').length;
  const semanticReauditRequiredCount = records.filter(record => record.semanticReauditRequired).length;
  const driftAlertResolvedCount = records.filter(record => record.revisionDriftAlertResolved).length;
  const forbiddenPromotionCount = records.filter(record => record.blockersClosed !== 0 || record.semanticFactsCreated !== 0 || record.optimizerEligible !== false || record.automaticVerificationApplied !== false).length;
  const blockersPreserved = records.every(record => {
    const source = expected.find(item => record.reconciliationKey === `reconcile:${item.sourceKey}:${item.currentHead?.revision || 'missing'}`);
    return Boolean(source) && source.affectedCandidates.every(candidate => candidate.blockers.every(blocker => record.blockers.includes(blocker)));
  });
  const accountFindings = findAgilityRevisionReconciliationAccountState(records);
  const blockers = [];
  if (!expected.length) blockers.push('no_reaudit_required_monitor_records_selected');
  if (!inputRecordsValid) blockers.push('one_or_more_input_monitor_records_invalid');
  if (!inputBindingValid) blockers.push('input_monitor_snapshot_binding_invalid');
  if (duplicateKeys.length || missingKeys.length || unexpectedKeys.length) blockers.push('revision_reconciliation_output_set_mismatch');
  if (!outputHashesValid) blockers.push('one_or_more_revision_reconciliation_record_hashes_invalid');
  if (sourceIntegrityBlockedCount) blockers.push('one_or_more_exact_revision_pairs_failed_integrity');
  if (!blockersPreserved) blockers.push('existing_candidate_blocker_preservation_failed');
  if (forbiddenPromotionCount) blockers.push('revision_reconciliation_created_unsupported_fact_resolution_or_promotion');
  if (accountFindings.length) blockers.push('account_query_state_baked_into_revision_reconciliation');
  return {
    contract: policy.auditContract,
    inputMonitor: {
      directory: inputBinding.directory || null,
      contentHash: inputBinding.contentHash || null,
      domain: inputBinding.domain || null,
      recordCount: monitorRecords.length,
      recordsValid: inputRecordsValid,
      bindingValid: inputBindingValid,
      reauditRequiredRecordCount: expected.length
    },
    sourceCoverage: {
      expectedSourceCount: expected.length,
      outputSourceCount: records.length,
      missingKeys,
      unexpectedKeys,
      duplicateKeys,
      sourceIntegrityBlockedCount
    },
    contentStates: {
      byteIdenticalRevisionChurnCount: byteIdenticalCount,
      contentChangedSemanticReauditRequiredCount: contentChangedCount,
      revisionDriftAlertResolvedCount: driftAlertResolvedCount
    },
    blockerPreservation: {
      blockersPreserved,
      blockersClosed: records.reduce((sum, record) => sum + Number(record.blockersClosed || 0), 0),
      semanticFactsCreated: records.reduce((sum, record) => sum + Number(record.semanticFactsCreated || 0), 0),
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length
    },
    revisionReconciliationComplete: blockers.length === 0,
    allRevisionDriftAlertsResolved: blockers.length === 0 && driftAlertResolvedCount === expected.length,
    semanticReauditRequired: semanticReauditRequiredCount > 0,
    conditionOrMechanicsCoverageComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_level_34_coverage',
    publishable: blockers.length === 0,
    blockers
  };
}
