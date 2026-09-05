import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery,
  deriveUnresolvedRenderedTargetCategorySearchQueries
} from '../ingestion/cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-lib.mjs';
import {
  auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions,
  buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions,
  compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositionPolicy
} from '../transforms/cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition-v1.json', 'utf8'));
const discoveryPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition-audit-v1.json', 'utf8'));
const sourceSnapshotContentHash = 'a'.repeat(64);

const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function page(pageid, title, revision, timestamp, content, ns = 0) {
  return { pageid, ns, title, revisions: [{ revid: Number(revision), timestamp, slots: { main: { content } } }] };
}

function sourcePacket({ categoryTitle = 'Category:Example guides', guideTitle = 'Example guide', ordinal = 1 } = {}) {
  const guideContent = `== Guide ==\nVerified context.\n[[${categoryTitle}]]`;
  const guideIdentity = {
    namespaceId: 0,
    resolvedTitle: guideTitle,
    sourceContentBytes: new TextEncoder().encode(guideContent).length,
    sourceContentHash: hash(guideContent),
    sourceLineCount: 3,
    sourcePageId: 400000 + ordinal,
    sourceRevision: String(15000000 + ordinal),
    sourceTimestamp: '2026-08-27T11:25:17Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(guideTitle.replaceAll(' ', '_'))}`
  };
  const queueBase = {
    contract: discoveryPolicy.inputContract,
    workQueueEntryKey: `work:${ordinal}`,
    queueOrdinal: ordinal,
    sourceDispositionKey: `disposition:${ordinal}`,
    sourceDispositionRecordContentHash: hash(`disposition:${ordinal}`),
    sourceEvidenceRecordContentHash: hash(`evidence:${ordinal}`),
    sourceDispositionSnapshotContentHash: 'b'.repeat(64),
    sourceEvidenceSnapshotContentHash: 'c'.repeat(64),
    evidenceFingerprint: hash(`fingerprint:${ordinal}`),
    renderedTargetKey: `wiki-title:${categoryTitle.toLowerCase()}`,
    requestedTitles: [categoryTitle],
    resolutionEvidence: {
      currentTitleResolutionEvidence: [{ requestedTitle: categoryTitle, currentMissingPage: { namespaceId: 14, title: categoryTitle }, currentPageEvidence: null }],
      pinnedGuideEvidence: [{ requestedTitle: categoryTitle, pinnedGuideSourceIdentity: guideIdentity, exactSourceOccurrences: [{ sourceLocator: { line: 3 }, sourceTarget: categoryTitle }] }]
    },
    insufficiencyDisposition: 'no_resolution_candidate_evidence_requires_additional_evidence',
    requiredAdditionalEvidenceChannels: [...discoveryPolicy.discovery.requiredAdditionalEvidenceChannels],
    newEvidenceKeys: [],
    resolutionReview: { decision: null, evidenceKeys: [], reviewNotes: null, reviewedAt: null, reviewer: null, selectedPageId: null, selectedTitle: null },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    state: discoveryPolicy.inputState
  };
  const queueRecord = { ...queueBase, contentHash: hash(queueBase) };
  const exactResult = {
    workQueueEntryKey: queueRecord.workQueueEntryKey,
    requestedTitle: categoryTitle,
    complete: true,
    response: { batchcomplete: true, query: { pages: [{ ns: 14, title: categoryTitle, missing: true, categoryinfo: { size: 1, pages: 1, files: 0, subcats: 0 } }] } }
  };
  const prefix = categoryTitle.slice('Category:'.length);
  const args = {
    workQueueRecords: [queueRecord],
    pinnedRevisionPages: [page(guideIdentity.sourcePageId, guideTitle, guideIdentity.sourceRevision, guideIdentity.sourceTimestamp, guideContent)],
    namespaceMetadata: { namespace: { id: 14, canonicalName: 'Category', localizedName: 'Category', caseRule: 'first-letter' }, aliases: [], complete: true },
    exactCurrentCategoryResults: [exactResult],
    categoryPrefixResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, prefix, entries: [{ category: prefix }], continuationExhausted: true, complete: true }],
    categoryMemberResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, members: [{ pageid: guideIdentity.sourcePageId, ns: 0, title: guideTitle, timestamp: guideIdentity.sourceTimestamp }], continuationExhausted: true, complete: true }],
    categoryMemberSourceResolutions: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, resolutions: [{ requestedTitle: guideTitle, normalizedTitle: guideTitle, resolvedTitle: guideTitle, page: page(guideIdentity.sourcePageId, guideTitle, guideIdentity.sourceRevision, guideIdentity.sourceTimestamp, guideContent), redirected: false }] }],
    namespaceSearchResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, queries: deriveUnresolvedRenderedTargetCategorySearchQueries(categoryTitle, discoveryPolicy).map(query => ({ ...query, pages: [], continuationExhausted: true, complete: true })) }],
    titleHistoryResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, events: [], continuationExhausted: true, complete: true }],
    policy: discoveryPolicy,
    sourceQueueSnapshotContentHash: 'd'.repeat(64)
  };
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(args);
  assert.equal(built.audit.publishable, true, JSON.stringify(built.audit, null, 2));
  return { ...built.records[0], contentHash: hash(built.records[0]) };
}

function rehashPacket(record) {
  const nested = ['namespaceMetadataEvidence', 'exactCurrentCategoryEvidence', 'categoryPrefixEvidence', 'categoryMemberEvidence', 'namespaceSearchEvidence', 'titleHistoryEvidence'];
  for (const key of nested) record[key].evidenceContentHash = hash(without(record[key], 'evidenceContentHash'));
  record.newEvidenceKeys = [...new Set([
    ...nested.map(key => record[key].evidenceContentHash),
    ...record.pinnedGuideRevalidations.map(item => hash(item))
  ])].sort();
  for (const channel of record.requiredChannelStatus) channel.evidenceKeys = [...record.newEvidenceKeys];
  record.recordContentHash = hash(without(record, 'recordContentHash', 'contentHash'));
  record.contentHash = hash(without(record, 'contentHash'));
  return record;
}

function describedCategoryPacket() {
  const record = structuredClone(sourcePacket());
  const text = 'A revision-pinned category description.';
  const exact = record.exactCurrentCategoryEvidence;
  exact.pageDescriptionExists = true;
  exact.redlinkCategoryState = false;
  exact.currentMissingPage = null;
  exact.currentPageIdentity = {
    namespaceId: 14,
    resolvedTitle: record.requestedTitles[0],
    sourceContentBytes: new TextEncoder().encode(text).length,
    sourceContentHash: hash(text),
    sourcePageId: 500001,
    sourceRevision: '15000009',
    sourceTimestamp: '2026-08-28T00:00:00Z',
    sourceUrl: 'https://oldschool.runescape.wiki/w/Category%3AExample_guides',
    sourceText: text
  };
  return rehashPacket(record);
}

function insufficientPacket() {
  const record = structuredClone(sourcePacket());
  Object.assign(record.exactCurrentCategoryEvidence.categoryInfo, { size: 0, pages: 0, files: 0, subcategories: 0 });
  Object.assign(record.categoryMemberEvidence, {
    members: [], memberCount: 0,
    categoryInfoReconciliation: { reportedSize: 0, enumeratedSize: 0, reportedPages: 0, enumeratedPages: 0, reportedFiles: 0, enumeratedFiles: 0, reportedSubcategories: 0, enumeratedSubcategories: 0 }
  });
  return rehashPacket(record);
}

test('policy and contracts are generic, fail closed, and forbid target-specific overrides', () => {
  const compiled = compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositionPolicy(policy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const targetSpecific = structuredClone(policy);
  targetSpecific.overrides = { 'Category:Example guides': 'resolved' };
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositionPolicy(targetSpecific).valid, false);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositionPolicy(automatic).valid, false);
});

test('routes a complete active redlink category to explicit source-bound review without semantic promotion', () => {
  const packet = sourcePacket();
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({ evidencePackets: [packet], policy, sourceSnapshotContentHash });
  assert.equal(built.audit.publishable, true, JSON.stringify(built.audit, null, 2));
  assert.equal(built.records[0].classification, 'active_redlink_category_target_resolution_review_ready');
  assert.equal(built.records[0].reviewRoute, 'explicit_source_bound_redlink_category_target_resolution_review');
  assert.equal(built.records[0].selectedResolution, null);
  assert.equal(built.records[0].optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('routes an exact revision-pinned described category page to its distinct review queue', () => {
  const packet = describedCategoryPacket();
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({ evidencePackets: [packet], policy, sourceSnapshotContentHash });
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records[0].classification, 'described_category_page_resolution_review_ready');
  assert.equal(built.records[0].reviewRoute, 'explicit_source_bound_described_category_page_resolution_review');
});

test('routes structurally complete but insufficient category evidence back to additional evidence', () => {
  const packet = insufficientPacket();
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({ evidencePackets: [packet], policy, sourceSnapshotContentHash });
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records[0].classification, 'category_target_additional_evidence_required');
  assert.equal(built.records[0].reviewRoute, 'additional_source_bound_category_resolution_evidence');
});

test('equal evidence shapes route identically despite different category and member names', () => {
  const first = sourcePacket({ categoryTitle: 'Category:Example guides', guideTitle: 'Example guide', ordinal: 1 });
  const second = sourcePacket({ categoryTitle: 'Category:Other guides', guideTitle: 'Different guide member', ordinal: 2 });
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({ evidencePackets: [first, second], policy, sourceSnapshotContentHash });
  assert.equal(built.audit.publishable, true);
  assert.deepEqual(new Set(built.records.map(record => record.classification)), new Set(['active_redlink_category_target_resolution_review_ready']));
});

test('intrinsic, nested, occurrence, and member reconciliation tampering fail closed', () => {
  for (const mutate of [
    record => { record.recordContentHash = '0'.repeat(64); },
    record => { record.categoryMemberEvidence.evidenceContentHash = '0'.repeat(64); },
    record => { record.categoryMemberEvidence.members[0].exactCategoryOccurrences[0].sourceTextContentHash = '0'.repeat(64); rehashPacket(record); },
    record => { record.exactCurrentCategoryEvidence.categoryInfo.pages = 2; rehashPacket(record); },
    record => { record.requiredChannelStatus[0].evidenceKeys = []; record.recordContentHash = hash(without(record, 'recordContentHash', 'contentHash')); record.contentHash = hash(without(record, 'contentHash')); }
  ]) {
    const record = structuredClone(sourcePacket());
    mutate(record);
    const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({ evidencePackets: [record], policy, sourceSnapshotContentHash });
    assert.equal(built.records.length, 0);
    assert.equal(built.audit.publishable, false);
    assert.ok(built.audit.blockers.includes('one_or_more_additional_resolution_evidence_packets_failed_revalidation'));
  }
  const wrongCurrentTitle = structuredClone(sourcePacket());
  wrongCurrentTitle.exactCurrentCategoryEvidence.currentMissingPage.title = 'Category:Wrong';
  rehashPacket(wrongCurrentTitle);
  const routed = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({ evidencePackets: [wrongCurrentTitle], policy, sourceSnapshotContentHash });
  assert.equal(routed.audit.publishable, true);
  assert.equal(routed.records[0].reviewRoute, 'additional_source_bound_category_resolution_evidence');
});

test('audit rejects route, binding, review, identity, optimizer, and account-state promotion', () => {
  const packet = sourcePacket();
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({ evidencePackets: [packet], policy, sourceSnapshotContentHash });
  for (const mutate of [
    record => { record.reviewRoute = policy.reviewRoutes[0]; },
    record => { record.sourceEvidencePacketRecordContentHash = 'f'.repeat(64); },
    record => { record.resolutionReview.state = 'reviewed'; },
    record => { record.canonicalActivityIdentity = { activityId: 'invented' }; },
    record => { record.optimizerEligible = true; },
    record => { record.currentLevel = 99; }
  ]) {
    const records = structuredClone(built.records);
    mutate(records[0]);
    const audit = auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions(records, { evidencePackets: [packet], policy, sourceSnapshotContentHash });
    assert.equal(audit.publishable, false);
  }
});

test('output is deterministic for an identical packet set and snapshot binding', () => {
  const args = { evidencePackets: [sourcePacket(), describedCategoryPacket()], policy, sourceSnapshotContentHash };
  assert.deepEqual(
    buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions(structuredClone(args)),
    buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions(structuredClone(args))
  );
});

test('CLI rejects a corrupted source-discovery manifest and writes no disposition output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-category-evidence-sufficiency-'));
  try {
    const snapshot = path.join(directory, '2026-01-01T00-00-00-000Z');
    fs.mkdirSync(snapshot, { recursive: true });
    const raw = `${JSON.stringify(sourcePacket())}\n`;
    fs.writeFileSync(path.join(snapshot, 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery.ndjson'), raw);
    fs.writeFileSync(path.join(snapshot, 'manifest.json'), JSON.stringify({
      domain: 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery',
      records: 1,
      contentHash: '0'.repeat(64),
      source: { audit: { evidencePacketCaptureComplete: true, resolutionEvidenceSufficiencyDispositionComplete: false, completeActivityUniverse: false, publishable: true, inputCoverage: { outputEvidencePacketCount: 1 }, semanticPreservationCoverage: { selectedResolutionCount: 0, recordedReviewCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, mechanicsReviewCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0 } } }
    }));
    const result = spawnSync(process.execPath, ['platform/transforms/build-cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-dispositions.mjs', `--root=${directory}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(directory).length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
