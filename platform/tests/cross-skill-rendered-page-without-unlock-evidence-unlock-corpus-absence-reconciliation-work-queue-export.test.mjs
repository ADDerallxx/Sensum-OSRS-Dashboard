import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditUnlockCorpusAbsenceReconciliationWorkQueue,
  buildUnlockCorpusAbsenceReconciliationWorkQueue,
  compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy,
  renderUnlockCorpusAbsenceReconciliationBlankDecisions,
  renderUnlockCorpusAbsenceReconciliationQueueTsv,
  renderUnlockCorpusEvidenceJson
} from '../transforms/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-entry-v1.json', 'utf8'));
const decisionContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-decision-template-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-audit-v1.json', 'utf8'));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const outer = value => ({ ...value, contentHash: hash(value) });
const snapshots = { workQueue: 'a'.repeat(64), crosswalk: 'b'.repeat(64), inventory: 'c'.repeat(64), equivalence: 'd'.repeat(64) };

function identity(ordinal) {
  return { redirected: false, resolvedTitle: `Rendered ${ordinal}`, sourcePageId: 2000 + ordinal, sourceRevision: String(15300000 + ordinal), sourceTimestamp: '2026-09-03T12:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/Rendered_${ordinal}` };
}

function workQueueRecord(ordinal) {
  const base = {
    contract: 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-entry.v1',
    workQueueEntryKey: `wiki-pageid:${2000 + ordinal}|work`, queueOrdinal: ordinal,
    renderedTargetKey: `wiki-pageid:${2000 + ordinal}`, stableWikiPageIdentity: identity(ordinal),
    guideObservationCount: ordinal, requiredEvidenceChannels: ['revision_pinned_target_source_signature', 'source_scoped_semantic_relevance_disposition', 'level_unlock_corpus_absence_reconciliation'],
    evidenceCollection: { evidenceKeys: [], revisionPinnedTargetSourceSignature: null, sourceScopedSemanticRelevanceDisposition: null, levelUnlockCorpusAbsenceReconciliation: null, historicalRenderedExpansionDependencyAttribution: null },
    unlockEvidencePresent: false, semanticDisposition: null, canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null, repeatabilityClassification: null, mechanicsReviewComplete: false,
    optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return outer(intrinsic);
}

function crosswalkRecord(ordinal, matched = false) {
  const id = identity(ordinal);
  return outer({
    contract: 'sensum.skill-training-guide-unlock-page-crosswalk.v1', renderedTargetKey: `wiki-pageid:${id.sourcePageId}`,
    sourcePageId: id.sourcePageId, resolvedTitle: id.resolvedTitle,
    renderedEvidence: { guideObservationCount: ordinal, targetPageIdentity: id },
    unlockEvidence: matched ? { canonicalWikiPageKey: `osrs-wiki-pageid:${id.sourcePageId}` } : null,
    crossSourcePageIdentityEstablished: matched,
    revisionRelationship: matched ? 'same_revision' : 'no_unlock_page_match',
    semanticRoutingState: matched ? 'revision_aligned_cross_source_page_identity' : 'rendered_stable_page_without_unlock_evidence',
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatableTrainingActivity: null,
    optimizerEligible: false, accountIndependent: true
  });
}

function inventoryRecord(skillKey, skill, ordinal, linkedTitle) {
  const entry = {
    entryKey: `${skillKey}:members${ordinal}:1`, availability: 'members', level: ordinal, sequence: 1,
    sourceText: `* [[${linkedTitle}]]`, sourceLeadingVerb: null, linkedTargets: [linkedTitle],
    sourceLocator: { lineStart: ordinal, lineEnd: ordinal, parameter: `members${ordinal}` },
    classificationState: 'pending_semantic_activity_classification', repeatableTrainingActivity: null,
    optimizerEligible: false, blockers: ['semantic_identity_and_repeatability_not_classified']
  };
  return outer({
    contract: 'sensum.skill-level-unlock-inventory.v1', skillKey, skill, category: 'test', minimumBaseLevel: 1,
    maximumBaseLevel: 99, accountIndependent: true, sourceRevision: String(15200000 + ordinal),
    sourceTimestamp: '2026-09-01T00:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/${skill}%2FLevel_up_table`,
    sourceContentHash: hash(`${skill}:source`), sourceLocator: { lineStart: 1, lineEnd: 5, template: 'Level up table' },
    parameters: [{ parameterName: `members${ordinal}`, availability: 'members', level: ordinal, declaredEmpty: false, entryCount: 1, entries: [entry], sourceLocator: { lineStart: 1, lineEnd: 5 } }],
    parameterCount: 1, sourceBulletCount: 1, capturedStatementCount: 1, rawInventoryComplete: true,
    blockers: [], state: 'candidate'
  });
}

function equivalenceRecord(pageId, title, statementKey, skillKey) {
  return outer({
    contract: 'sensum.unlock-linked-page-wiki-equivalence.v1', canonicalWikiPageKey: `osrs-wiki-pageid:${pageId}`,
    sourcePageId: pageId, resolvedTitle: title,
    targetReferences: [{ targetKey: `wiki-title:${title.toLowerCase()}`, requestedTitle: title, requestedFragment: null, redirected: false, referencedBy: { skillKeys: [skillKey], statementKeys: [statementKey] }, entityTypes: ['item_page'], classificationState: 'typed', activityPageCandidate: false }],
    targetReferenceCount: 1, entityTypes: ['item_page'], pageTypeClassified: true, activityPageCandidate: false,
    wikiPageEquivalenceEstablished: true, canonicalGameEntityIdentity: null, canonicalActivityIdentity: null,
    repeatableTrainingActivity: null, optimizerEligible: false,
    source: { sourceRevision: String(15100000 + pageId), sourceTimestamp: '2026-08-30T00:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/${title}`, sourceContentHash: hash(`${title}:page`) },
    accountIndependent: true, blockers: ['canonical_game_entity_identity_not_established'], state: 'blocked'
  });
}

const workQueueRecords = [workQueueRecord(1), workQueueRecord(2)];
const crosswalkRecords = [crosswalkRecord(1), crosswalkRecord(2), crosswalkRecord(9, true)];
const inventoryRecords = [inventoryRecord('attack', 'Attack', 1, 'Thing A'), inventoryRecord('magic', 'Magic', 2, 'Thing B')];
const equivalenceRecords = [
  equivalenceRecord(3001, 'Thing A', 'attack:members1:1', 'attack'),
  equivalenceRecord(3002, 'Thing B', 'magic:members2:1', 'magic')
];
const sources = {
  workQueue: { audit: { queueExportComplete: true, publishable: true, reconciliationComplete: false, completeActivityUniverse: false, queueCoverage: { outputRecordCount: 2, duplicateOutputPartitionKeys: [], missingOutputPartitionKeys: [], unexpectedOutputPartitionKeys: [], recordMismatchPartitionKeys: [] }, semanticPreservationCoverage: { unsupportedPromotionPartitionKeys: [] } } },
  crosswalk: { audit: { crosswalkCoverageComplete: true, publishable: true, completeActivityUniverse: false, renderedTargetCoverage: { exactRenderedTargetSetAndContextMatch: true }, crossSourceIdentityCoverage: { matchLogicMismatchKeys: [] }, semanticRoutingCoverage: { unsupportedPromotionTargetKeys: [] } } },
  inventory: {
    skillDomain: { page: 'Skills', revision: '15321845', timestamp: '2026-08-27T06:12:04Z', skills: inventoryRecords.map(row => ({ skillKey: row.skillKey, minimumBaseLevel: 1, maximumBaseLevel: 99 })) },
    levelUpTables: inventoryRecords.map(row => ({ skillKey: row.skillKey, revision: row.sourceRevision, timestamp: row.sourceTimestamp, sourceContentHash: row.sourceContentHash, parameterCount: row.parameterCount, statementCount: row.capturedStatementCount })),
    audit: { rawInventoryComplete: true, publishable: true, completeActivityUniverse: false, officialSkillDomain: { missingSkillKeys: [], unexpectedSkillKeys: [], duplicateSkillKeys: [] }, statementCoverage: { countsMatch: true } }
  },
  equivalence: { audit: { wikiPageEquivalenceComplete: true, publishable: true, completeActivityUniverse: false, inputTargetCoverage: { exactTargetSetMatch: true }, pageIdentityCoverage: { duplicateCanonicalWikiPageKeys: [], invalidRecordKeys: [], inconsistentGroupKeys: [] } } }
};
const source = { workQueueRecords, crosswalkRecords, inventoryRecords, equivalenceRecords, policy, snapshots, sources, contentHash: hash };
const cloneSource = () => ({ ...structuredClone(without(source, 'contentHash')), contentHash: hash });

test('policy and contracts encode a generic fail-closed absence review boundary', () => {
  const compiled = compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy(policy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.pageIdOverrides = { 2001: 'skip' };
  assert.equal(compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy(specific, hash).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy(automatic, hash).valid, false);
});

test('exports every required stable no-match target exactly once and preserves zero-match scope', () => {
  const built = buildUnlockCorpusAbsenceReconciliationWorkQueue(source);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records.length, 2);
  assert.deepEqual(built.records.map(row => row.queueOrdinal), [1, 2]);
  assert.equal(built.audit.crosswalkCoverage.exactStableNoMatchTargetSetAndBindings, true);
  assert.equal(built.audit.absenceCoverage.zeroExactStablePageIdMatchCount, 2);
  assert.equal(built.audit.absenceReconciliationComplete, false);
  assert.match(built.records[0].findingScope.statement, /does not occur/);
  assert.ok(built.records[0].findingScope.nonClaims.includes('no_level_requirement_exists'));
  for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing work-queue field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('binds the complete inventory relation set to the stable equivalence corpus', () => {
  const built = buildUnlockCorpusAbsenceReconciliationWorkQueue(source);
  assert.equal(built.audit.inventoryCoverage.officialSkillCount, 2);
  assert.equal(built.audit.inventoryCoverage.capturedStatementCount, 2);
  assert.equal(built.audit.equivalenceCoverage.statementReferenceCount, 2);
  assert.equal(built.audit.corpusBindingCoverage.exactInventoryToEquivalenceStatementTargetRelationSet, true);
  assert.equal(built.corpusEvidence.statementTargetRelationSetContentHash, built.records[0].corpusEvidence.statementTargetRelationSetContentHash);
  assert.equal(built.records[0].corpusEvidenceContentHash, hash(built.corpusEvidence));
});

test('machine queue, corpus evidence, TSV, and blank decisions are deterministic', () => {
  const first = buildUnlockCorpusAbsenceReconciliationWorkQueue(source);
  const second = buildUnlockCorpusAbsenceReconciliationWorkQueue(cloneSource());
  assert.deepEqual(second, first);
  assert.equal(first.artifacts.queueTsv, renderUnlockCorpusAbsenceReconciliationQueueTsv(first.records));
  assert.equal(first.artifacts.blankDecisions, renderUnlockCorpusAbsenceReconciliationBlankDecisions(first.records, policy));
  assert.equal(first.artifacts.corpusEvidenceJson, renderUnlockCorpusEvidenceJson(first.corpusEvidence));
  const decisions = first.artifacts.blankDecisions.trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(decisions.length, 2);
  assert.equal(decisions[0].disposition, null);
  for (const field of decisionContract.required) assert.ok(Object.hasOwn(decisions[0], field), `Missing decision-template field ${field}`);
});

for (const [name, mutate] of [
  ['work-queue outer hash drift', value => { value.workQueueRecords[0].contentHash = '0'.repeat(64); }],
  ['work-queue intrinsic hash drift', value => { value.workQueueRecords[0].recordContentHash = '0'.repeat(64); value.workQueueRecords[0].contentHash = hash(without(value.workQueueRecords[0], 'contentHash')); }],
  ['crosswalk target identity drift', value => { value.crosswalkRecords[0].renderedEvidence.targetPageIdentity.sourcePageId = 9999; value.crosswalkRecords[0].contentHash = hash(without(value.crosswalkRecords[0], 'contentHash')); }],
  ['inventory source hash drift', value => { value.inventoryRecords[0].sourceContentHash = 'f'.repeat(64); value.inventoryRecords[0].contentHash = hash(without(value.inventoryRecords[0], 'contentHash')); }],
  ['equivalence skill-reference drift', value => { value.equivalenceRecords[0].targetReferences[0].referencedBy.skillKeys = ['magic']; value.equivalenceRecords[0].contentHash = hash(without(value.equivalenceRecords[0], 'contentHash')); }],
  ['missing inventory-to-equivalence relation', value => { value.equivalenceRecords[0].targetReferences[0].requestedTitle = 'Different'; value.equivalenceRecords[0].contentHash = hash(without(value.equivalenceRecords[0], 'contentHash')); }]
]) test(`fails atomically on ${name}`, () => {
  const changed = cloneSource(); mutate(changed);
  const built = buildUnlockCorpusAbsenceReconciliationWorkQueue(changed);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
});

test('fails when a queued target page ID occurs in the unlock-equivalence corpus', () => {
  const changed = cloneSource();
  changed.equivalenceRecords[0].sourcePageId = 2001;
  changed.equivalenceRecords[0].canonicalWikiPageKey = 'osrs-wiki-pageid:2001';
  changed.equivalenceRecords[0].contentHash = hash(without(changed.equivalenceRecords[0], 'contentHash'));
  const built = buildUnlockCorpusAbsenceReconciliationWorkQueue(changed);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.deepEqual(built.audit.absenceCoverage.nonZeroMatchSourceWorkQueueKeys, [workQueueRecords[0].workQueueEntryKey]);
});

test('audit rejects review state, semantic promotion, account state, and artifact drift', () => {
  const built = buildUnlockCorpusAbsenceReconciliationWorkQueue(source);
  const changed = structuredClone(built.records);
  changed[0].reviewDecision = 'confirm_corpus_absence_finding';
  changed[0].canonicalActivityIdentity = { id: 'invented' };
  changed[0].optimizerEligible = true;
  changed[0].accountLevel = 34;
  changed[0].recordContentHash = hash(without(changed[0], 'recordContentHash'));
  const audit = auditUnlockCorpusAbsenceReconciliationWorkQueue(changed, { ...source, artifacts: { ...built.artifacts, queueTsv: 'tampered\n' } });
  assert.equal(audit.publishable, false);
  assert.equal(audit.reviewCoverage.reviewStartedCount, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotionKeys.length, 1);
  assert.deepEqual(audit.artifactCoverage.artifactMismatchFiles, ['queue.tsv']);
  assert.ok(audit.blockers.includes('current_account_state_present_in_output'));
});

test('CLI rejects a corrupt source work-queue manifest without writing output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-unlock-corpus-absence-'));
  try {
    const directory = path.join(root, '2026-09-06T10-00-00-000Z'); fs.mkdirSync(directory, { recursive: true });
    const raw = workQueueRecords.map(JSON.stringify).join('\n') + '\n';
    fs.writeFileSync(path.join(directory, 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ domain: 'cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue', records: workQueueRecords.length, contentHash: '0'.repeat(64), source: { audit: sources.workQueue.audit } }));
    const command = spawnSync(process.execPath, ['platform/transforms/export-cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(command.status, 0);
    assert.match(command.stderr, /No valid cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue snapshot exists/);
    assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue.ndjson'))).length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

console.log('Cross-skill unlock-corpus absence reconciliation work-queue export checks passed.');
