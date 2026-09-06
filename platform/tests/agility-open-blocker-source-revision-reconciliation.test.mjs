import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  auditAgilityOpenBlockerSourceRevisionReconciliation,
  buildAgilityOpenBlockerSourceRevisionReconciliation,
  buildDeterministicLineDelta
} from '../ingestion/agility-open-blocker-source-revision-reconciliation-lib.mjs';

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(stable(value))).digest('hex');
const policy = {
  policy: 'test-policy',
  inputRecordContract: 'sensum.agility-open-blocker-source-revision-monitor.v1',
  inputDomain: 'agility-open-blocker-source-revision-monitor',
  recordContract: 'sensum.agility-open-blocker-source-revision-reconciliation.v1',
  auditContract: 'sensum.agility-open-blocker-source-revision-reconciliation-audit.v1'
};
const oldContent = 'first\nsecond\nthird\n';
const baseMonitor = {
  contract: policy.inputRecordContract,
  sourceKey: '100|https://oldschool.runescape.wiki/w/Example',
  inputAuditContentHash: 'audit-hash',
  requestedTitle: 'Example',
  pinnedSource: { sourceRevision: '100', sourceUrl: 'https://oldschool.runescape.wiki/w/Example', pageId: 1, resolvedTitle: 'Example', timestamp: '2026-01-01T00:00:00Z', contentHash: hash(oldContent), contentBytes: Buffer.byteLength(oldContent), exactRevisionRetrievable: true },
  currentHead: { pageId: 1, resolvedTitle: 'Example', revision: '101', timestamp: '2026-01-02T00:00:00Z', redirected: false },
  revisionState: 'head_advanced_reaudit_required',
  sourceOccurrenceCount: 1,
  sourceOccurrences: [{ candidateKey: 'guide:one', sourcePath: 'sourceLocator' }],
  affectedCandidates: [{ candidateKey: 'guide:one', candidateName: 'One', candidateStatus: 'target_condition_gap', mechanicalReadiness: 'target_condition_gap', blockers: ['probability_unpublished'] }],
  existingBlockerCount: 1,
  blockersClosed: 0,
  reauditRequired: true,
  semanticFactsCreated: 0,
  optimizerEligible: false,
  automaticVerificationApplied: false,
  accountIndependent: true,
  blockers: ['probability_unpublished', 'source_revision_changed_reaudit_required']
};
const recordContentHash = hash(baseMonitor);
const monitorWithRecordHash = { ...baseMonitor, recordContentHash };
const monitor = { ...monitorWithRecordHash, contentHash: hash(monitorWithRecordHash) };
const page = (revid, content, comment = '') => ({ pageid: 1, title: 'Example', revisions: [{ revid, timestamp: revid === 100 ? '2026-01-01T00:00:00Z' : '2026-01-02T00:00:00Z', user: 'Editor', comment, slots: { main: { content } } }] });
const binding = { directory: 'snapshot', contentHash: 'manifest-hash', domain: policy.inputDomain };

assert.deepEqual(buildDeterministicLineDelta(oldContent, oldContent), { oldLineCount: 4, newLineCount: 4, addedLineCount: 0, removedLineCount: 0, changedHunkCount: 0, hunks: [] });
const lineDelta = buildDeterministicLineDelta(oldContent, 'first\nchanged\nthird\nadded\n');
assert.equal(lineDelta.changedHunkCount, 2);
assert.equal(lineDelta.addedLineCount, 2);
assert.equal(lineDelta.removedLineCount, 1);

const identical = buildAgilityOpenBlockerSourceRevisionReconciliation({ monitorRecords: [monitor], exactRevisionPages: [page(100, oldContent), page(101, oldContent, 'Revert')], policy, inputBinding: binding, contentHash: hash });
assert.equal(identical.audit.publishable, true);
assert.equal(identical.audit.allRevisionDriftAlertsResolved, true);
assert.equal(identical.audit.semanticReauditRequired, false);
assert.equal(identical.records[0].contentComparison.state, 'byte_identical_revision_churn');
assert.equal(identical.records[0].blockersClosed, 0);

const changed = buildAgilityOpenBlockerSourceRevisionReconciliation({ monitorRecords: [monitor], exactRevisionPages: [page(100, oldContent), page(101, 'first\nchanged\nthird\n')], policy, inputBinding: binding, contentHash: hash });
assert.equal(changed.audit.publishable, true);
assert.equal(changed.audit.allRevisionDriftAlertsResolved, false);
assert.equal(changed.audit.semanticReauditRequired, true);
assert.equal(changed.records[0].contentComparison.lineDelta.changedHunkCount, 1);
assert.ok(changed.records[0].blockers.includes('source_content_changed_semantic_reaudit_required'));

const missing = buildAgilityOpenBlockerSourceRevisionReconciliation({ monitorRecords: [monitor], exactRevisionPages: [page(100, oldContent)], policy, inputBinding: binding, contentHash: hash });
assert.equal(missing.audit.publishable, false);
assert.ok(missing.audit.blockers.includes('one_or_more_exact_revision_pairs_failed_integrity'));

const tamperedMonitor = structuredClone(monitor);
tamperedMonitor.affectedCandidates[0].candidateName = 'Tampered';
assert.equal(buildAgilityOpenBlockerSourceRevisionReconciliation({ monitorRecords: [tamperedMonitor], exactRevisionPages: [page(100, oldContent), page(101, oldContent)], policy, inputBinding: binding, contentHash: hash }).audit.publishable, false);

const promoted = structuredClone(identical.records);
promoted[0].optimizerEligible = true;
assert.equal(auditAgilityOpenBlockerSourceRevisionReconciliation(promoted, { monitorRecords: [monitor], policy, inputBinding: binding, contentHash: hash }).publishable, false);

const accountScoped = structuredClone(identical.records);
accountScoped[0].accountState = { level: 34 };
assert.equal(auditAgilityOpenBlockerSourceRevisionReconciliation(accountScoped, { monitorRecords: [monitor], policy, inputBinding: binding, contentHash: hash }).publishable, false);

const deterministic = buildAgilityOpenBlockerSourceRevisionReconciliation({ monitorRecords: structuredClone([monitor]), exactRevisionPages: structuredClone([page(100, oldContent), page(101, oldContent, 'Revert')]), policy: structuredClone(policy), inputBinding: structuredClone(binding), contentHash: hash });
assert.deepEqual(deterministic, identical);
console.log('Agility open-blocker source revision-reconciliation checks passed.');
