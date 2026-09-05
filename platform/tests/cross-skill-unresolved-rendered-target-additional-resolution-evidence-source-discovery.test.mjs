import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery,
  buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery,
  compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscoveryPolicy,
  deriveUnresolvedRenderedTargetCategorySearchQueries
} from '../ingestion/cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-audit-v1.json', 'utf8'));
const sourceQueueSnapshotContentHash = 'a'.repeat(64);
const guideContent = '== Farming ==\nTrain Farming.\n[[Category:Ironman Mode guides]]\n[[Category:Farming guides]]';
const guideIdentity = {
  namespaceId: 0,
  resolvedTitle: 'Ironman Guide/Farming',
  sourceContentBytes: new TextEncoder().encode(guideContent).length,
  sourceContentHash: hash(guideContent),
  sourceLineCount: 4,
  sourcePageId: 301699,
  sourceRevision: '15321988',
  sourceTimestamp: '2026-08-27T11:25:17Z',
  sourceUrl: 'https://oldschool.runescape.wiki/w/Ironman_Guide%2FFarming'
};

function queueRecord(requestedTitle, ordinal) {
  const line = requestedTitle.includes('Ironman') ? 3 : 4;
  const base = {
    contract: policy.inputContract,
    workQueueEntryKey: `work:${ordinal}`,
    queueOrdinal: ordinal,
    sourceDispositionKey: `disposition:${ordinal}`,
    sourceDispositionRecordContentHash: hash(`disposition:${ordinal}`),
    sourceEvidenceRecordContentHash: hash(`evidence:${ordinal}`),
    sourceDispositionSnapshotContentHash: 'b'.repeat(64),
    sourceEvidenceSnapshotContentHash: 'c'.repeat(64),
    evidenceFingerprint: hash(`fingerprint:${ordinal}`),
    renderedTargetKey: `wiki-title:${requestedTitle.toLowerCase()}`,
    requestedTitles: [requestedTitle],
    resolutionEvidence: {
      currentTitleResolutionEvidence: [{
        requestedTitle,
        currentMissingPage: { namespaceId: 14, title: requestedTitle },
        currentPageEvidence: null
      }],
      pinnedGuideEvidence: [{
        requestedTitle,
        pinnedGuideSourceIdentity: guideIdentity,
        exactSourceOccurrences: [{ sourceLocator: { line }, sourceTarget: requestedTitle }]
      }]
    },
    insufficiencyDisposition: 'no_resolution_candidate_evidence_requires_additional_evidence',
    requiredAdditionalEvidenceChannels: [...policy.discovery.requiredAdditionalEvidenceChannels],
    newEvidenceKeys: [],
    resolutionReview: {
      decision: null, evidenceKeys: [], reviewNotes: null, reviewedAt: null,
      reviewer: null, selectedPageId: null, selectedTitle: null
    },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    state: policy.inputState
  };
  return { ...base, contentHash: hash(base) };
}

function page(pageid, title, revision, timestamp, content, ns = 0) {
  return { pageid, ns, title, revisions: [{ revid: Number(revision), timestamp, slots: { main: { content } } }] };
}

function exactResult(record) {
  const requestedTitle = record.requestedTitles[0];
  return {
    workQueueEntryKey: record.workQueueEntryKey,
    requestedTitle,
    complete: true,
    response: {
      batchcomplete: true,
      query: {
        pages: [{ ns: 14, title: requestedTitle, missing: true, categoryinfo: { size: 1, pages: 1, files: 0, subcats: 0 } }]
      }
    }
  };
}

function fixture() {
  const workQueueRecords = [queueRecord('Category:Farming guides', 1), queueRecord('Category:Ironman Mode guides', 2)];
  const pinnedRevisionPages = [page(301699, 'Ironman Guide/Farming', '15321988', '2026-08-27T11:25:17Z', guideContent)];
  const exactCurrentCategoryResults = workQueueRecords.map(exactResult);
  const categoryPrefixResults = workQueueRecords.map(record => {
    const requestedTitle = record.requestedTitles[0];
    const prefix = requestedTitle.slice('Category:'.length);
    return { workQueueEntryKey: record.workQueueEntryKey, requestedTitle, prefix, entries: [{ category: prefix }], continuationExhausted: true, complete: true };
  });
  const categoryMemberResults = workQueueRecords.map(record => ({
    workQueueEntryKey: record.workQueueEntryKey,
    requestedTitle: record.requestedTitles[0],
    members: [{ pageid: 301699, ns: 0, title: 'Ironman Guide/Farming', timestamp: '2026-08-27T11:25:17Z' }],
    continuationExhausted: true,
    complete: true
  }));
  const categoryMemberSourceResolutions = workQueueRecords.map(record => ({
    workQueueEntryKey: record.workQueueEntryKey,
    resolutions: [{
      requestedTitle: 'Ironman Guide/Farming', normalizedTitle: 'Ironman Guide/Farming', resolvedTitle: 'Ironman Guide/Farming',
      page: page(301699, 'Ironman Guide/Farming', '15321988', '2026-08-27T11:25:17Z', guideContent), redirected: false
    }]
  }));
  const namespaceSearchResults = workQueueRecords.map(record => ({
    workQueueEntryKey: record.workQueueEntryKey,
    requestedTitle: record.requestedTitles[0],
    queries: deriveUnresolvedRenderedTargetCategorySearchQueries(record.requestedTitles[0], policy).map(query => ({
      ...query, pages: [], continuationExhausted: true, complete: true
    }))
  }));
  const titleHistoryResults = workQueueRecords.map(record => ({
    workQueueEntryKey: record.workQueueEntryKey,
    requestedTitle: record.requestedTitles[0],
    events: [], continuationExhausted: true, complete: true
  }));
  return {
    workQueueRecords,
    pinnedRevisionPages,
    namespaceMetadata: {
      namespace: { id: 14, canonicalName: 'Category', localizedName: 'Category', caseRule: 'first-letter' },
      aliases: [], complete: true
    },
    exactCurrentCategoryResults,
    categoryPrefixResults,
    categoryMemberResults,
    categoryMemberSourceResolutions,
    namespaceSearchResults,
    titleHistoryResults,
    policy,
    sourceQueueSnapshotContentHash
  };
}

test('policy and query derivation are generic, category-scoped, and prefix-safe', () => {
  const compiled = compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscoveryPolicy(policy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const queries = deriveUnresolvedRenderedTargetCategorySearchQueries('Category:Farming guides', policy);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries.map(item => item.terms), [['Farming guides'], ['Farming guides']]);
  assert.ok(queries.every(item => !item.query.includes('Category:')));
  assert.deepEqual(deriveUnresolvedRenderedTargetCategorySearchQueries('Farming guides', policy), []);
});

test('captures redlink category state, exhaustive membership, pinned source occurrences, and history without resolving identity', () => {
  const args = fixture();
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(args);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.evidencePacketCaptureComplete, true);
  assert.equal(built.audit.resolutionEvidenceSufficiencyDispositionComplete, false);
  assert.equal(built.audit.categoryIdentityCoverage.redlinkCategoryCount, 2);
  assert.equal(built.audit.categoryIdentityCoverage.categoryApiStateCount, 2);
  assert.equal(built.audit.categoryMemberCoverage.totalMemberCount, 2);
  assert.equal(built.audit.categoryMemberCoverage.membersWithRevisionPinnedExactCategoryOccurrence, 2);
  assert.equal(built.audit.categoryPrefixCoverage.exactCategoryNamePresentCount, 2);
  assert.equal(built.audit.namespaceSearchCoverage.queryCount, 4);
  assert.equal(built.audit.titleHistoryCoverage.eventCount, 0);
  assert.equal(built.audit.requiredChannelCoverage.allEvidenceChannelsObserved, true);
  assert.equal(built.records.length, 2);
  assert.ok(built.records.every(record => record.selectedResolution === null && record.optimizerEligible === false));
  assert.ok(built.records.every(record => record.newEvidenceKeys.length >= 7));
  for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
  assert.deepEqual(buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(structuredClone(args)), built);
});

test('fails closed when an input queue record is altered', () => {
  const args = fixture();
  args.workQueueRecords[0].contentHash = '0'.repeat(64);
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(args);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('one_or_more_input_work_queue_entries_failed_revalidation'));
});

test('fails closed when namespace metadata is not the official category namespace', () => {
  const args = fixture();
  args.namespaceMetadata.namespace.id = 0;
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(args);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('official_category_namespace_metadata_missing_or_invalid'));
});

test('fails closed when a category member lacks current revision source or the exact category occurrence', () => {
  let args = fixture();
  args.categoryMemberSourceResolutions[0].resolutions = [];
  let built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(args);
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('one_or_more_additional_resolution_evidence_packets_incomplete'));
  args = fixture();
  args.categoryMemberSourceResolutions[0].resolutions[0].page.revisions[0].slots.main.content = 'No category link here.';
  built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(args);
  assert.equal(built.audit.publishable, false);
});

test('fails closed on incomplete prefix, namespace-search, exact-category, or log coverage', () => {
  for (const mutate of [
    args => { args.categoryPrefixResults[0].entries = []; },
    args => { args.namespaceSearchResults[0].queries[0].continuationExhausted = false; },
    args => { delete args.exactCurrentCategoryResults[0].response.query.pages[0].categoryinfo; },
    args => { args.exactCurrentCategoryResults[0].response.query.pages[0].categoryinfo.size = 2; },
    args => { args.titleHistoryResults[0].continuationExhausted = false; }
  ]) {
    const args = fixture();
    mutate(args);
    const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(args);
    assert.equal(built.audit.publishable, false);
    assert.ok(built.audit.blockers.includes('one_or_more_additional_resolution_evidence_packets_incomplete'));
  }
});

test('rejects title-specific policy overrides and any automatic verification permission', () => {
  const specific = structuredClone(policy);
  specific.overrides = { 'Category:Farming guides': 'resolved' };
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscoveryPolicy(specific).valid, false);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscoveryPolicy(automatic).valid, false);
});

test('audit detects semantic promotion and current account contamination', () => {
  const args = fixture();
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(args);
  const promoted = structuredClone(built.records);
  promoted[0].selectedResolution = { pageId: 301699 };
  let audit = auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(promoted, args);
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('source_discovery_created_unsupported_resolution_identity_or_optimizer_promotion'));
  const accountScoped = structuredClone(built.records);
  accountScoped[0].currentLevel = 34;
  audit = auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(accountScoped, args);
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('current_account_state_present'));
  const rebound = structuredClone(built.records);
  rebound[0].sourceEvidenceRecordContentHash = 'f'.repeat(64);
  const base = Object.fromEntries(Object.entries(rebound[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)));
  rebound[0].recordContentHash = hash(base);
  audit = auditUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery(rebound, args);
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('one_or_more_additional_resolution_evidence_packets_incomplete'));
});

test('CLI rejects a corrupted queue snapshot before network access and writes no evidence output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-category-resolution-evidence-'));
  try {
    const snapshot = path.join(directory, '2026-01-01T00-00-00-000Z');
    fs.mkdirSync(snapshot, { recursive: true });
    const raw = `${JSON.stringify(queueRecord('Category:Farming guides', 1))}\n`;
    fs.writeFileSync(path.join(snapshot, 'cross-skill-unresolved-rendered-target-resolution-additional-evidence-work-queue.ndjson'), raw);
    fs.writeFileSync(path.join(snapshot, 'manifest.json'), JSON.stringify({
      domain: 'cross-skill-unresolved-rendered-target-resolution-additional-evidence-work-queue',
      records: 1,
      contentHash: '0'.repeat(64),
      source: { audit: { queueExportComplete: true, resolutionReviewComplete: false, completeActivityUniverse: false, publishable: true, semanticPreservationCoverage: { optimizerEligibleCount: 0, selectedResolutionCount: 0 } } }
    }));
    const result = spawnSync(process.execPath, [
      'platform/ingestion/ingest-wiki-cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery.mjs',
      `--root=${directory}`
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(directory).some(name => name.includes('additional-resolution-evidence-source-discovery-audits')), false);
    assert.equal(fs.readdirSync(directory).length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
