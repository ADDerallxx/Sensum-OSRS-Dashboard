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
import { buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions } from '../transforms/cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition-lib.mjs';
import {
  auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport,
  buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport,
  compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExportPolicy,
  renderUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueMarkdown,
  serializeUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionTemplates
} from '../transforms/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-export-v1.json', 'utf8'));
const dispositionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition-v1.json', 'utf8'));
const discoveryPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-unresolved-rendered-target-additional-resolution-evidence-source-discovery-v1.json', 'utf8'));
const queueContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-entry-v1.json', 'utf8'));
const decisionContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-decision-template-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue-export-audit-v1.json', 'utf8'));
const evidenceSnapshotContentHash = 'a'.repeat(64);
const dispositionSnapshotContentHash = 'b'.repeat(64);
const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

function page(pageid, title, revision, timestamp, content, ns = 0) {
  return { pageid, ns, title, revisions: [{ revid: Number(revision), timestamp, slots: { main: { content } } }] };
}

function sourcePacket({ categoryTitle = 'Category:Example guides', guideTitle = 'Example guide', ordinal = 1 } = {}) {
  const guideContent = `== Guide ==\nVerified context.\n[[${categoryTitle}]]`;
  const guideIdentity = {
    namespaceId: 0, resolvedTitle: guideTitle, sourceContentBytes: new TextEncoder().encode(guideContent).length,
    sourceContentHash: hash(guideContent), sourceLineCount: 3, sourcePageId: 400000 + ordinal,
    sourceRevision: String(15000000 + ordinal), sourceTimestamp: '2026-08-27T11:25:17Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(guideTitle.replaceAll(' ', '_'))}`
  };
  const queueBase = {
    contract: discoveryPolicy.inputContract, workQueueEntryKey: `work:${ordinal}`, queueOrdinal: ordinal,
    sourceDispositionKey: `disposition:${ordinal}`, sourceDispositionRecordContentHash: hash(`disposition:${ordinal}`),
    sourceEvidenceRecordContentHash: hash(`evidence:${ordinal}`), sourceDispositionSnapshotContentHash: 'c'.repeat(64),
    sourceEvidenceSnapshotContentHash: 'd'.repeat(64), evidenceFingerprint: hash(`fingerprint:${ordinal}`),
    renderedTargetKey: `wiki-title:${categoryTitle.toLowerCase()}`, requestedTitles: [categoryTitle],
    resolutionEvidence: {
      currentTitleResolutionEvidence: [{ requestedTitle: categoryTitle, currentMissingPage: { namespaceId: 14, title: categoryTitle }, currentPageEvidence: null }],
      pinnedGuideEvidence: [{ requestedTitle: categoryTitle, pinnedGuideSourceIdentity: guideIdentity, exactSourceOccurrences: [{ sourceLocator: { line: 3 }, sourceTarget: categoryTitle }] }]
    },
    insufficiencyDisposition: 'no_resolution_candidate_evidence_requires_additional_evidence',
    requiredAdditionalEvidenceChannels: [...discoveryPolicy.discovery.requiredAdditionalEvidenceChannels], newEvidenceKeys: [],
    resolutionReview: { decision: null, evidenceKeys: [], reviewNotes: null, reviewedAt: null, reviewer: null, selectedPageId: null, selectedTitle: null },
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    optimizerEligible: false, accountIndependent: true, state: discoveryPolicy.inputState
  };
  const queueRecord = { ...queueBase, contentHash: hash(queueBase) };
  const prefix = categoryTitle.slice('Category:'.length);
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSourceDiscovery({
    workQueueRecords: [queueRecord],
    pinnedRevisionPages: [page(guideIdentity.sourcePageId, guideTitle, guideIdentity.sourceRevision, guideIdentity.sourceTimestamp, guideContent)],
    namespaceMetadata: { namespace: { id: 14, canonicalName: 'Category', localizedName: 'Category', caseRule: 'first-letter' }, aliases: [], complete: true },
    exactCurrentCategoryResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, complete: true, response: { batchcomplete: true, query: { pages: [{ ns: 14, title: categoryTitle, missing: true, categoryinfo: { size: 1, pages: 1, files: 0, subcats: 0 } }] } } }],
    categoryPrefixResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, prefix, entries: [{ category: prefix }], continuationExhausted: true, complete: true }],
    categoryMemberResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, members: [{ pageid: guideIdentity.sourcePageId, ns: 0, title: guideTitle, timestamp: guideIdentity.sourceTimestamp }], continuationExhausted: true, complete: true }],
    categoryMemberSourceResolutions: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, resolutions: [{ requestedTitle: guideTitle, normalizedTitle: guideTitle, resolvedTitle: guideTitle, page: page(guideIdentity.sourcePageId, guideTitle, guideIdentity.sourceRevision, guideIdentity.sourceTimestamp, guideContent), redirected: false }] }],
    namespaceSearchResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, queries: deriveUnresolvedRenderedTargetCategorySearchQueries(categoryTitle, discoveryPolicy).map(query => ({ ...query, pages: [], continuationExhausted: true, complete: true })) }],
    titleHistoryResults: [{ workQueueEntryKey: queueRecord.workQueueEntryKey, requestedTitle: categoryTitle, events: [], continuationExhausted: true, complete: true }],
    policy: discoveryPolicy, sourceQueueSnapshotContentHash: 'e'.repeat(64)
  });
  assert.equal(built.audit.publishable, true);
  return { ...built.records[0], contentHash: hash(built.records[0]) };
}

function rehashPacket(record) {
  const nested = ['namespaceMetadataEvidence', 'exactCurrentCategoryEvidence', 'categoryPrefixEvidence', 'categoryMemberEvidence', 'namespaceSearchEvidence', 'titleHistoryEvidence'];
  for (const key of nested) record[key].evidenceContentHash = hash(without(record[key], 'evidenceContentHash'));
  record.newEvidenceKeys = [...new Set([...nested.map(key => record[key].evidenceContentHash), ...record.pinnedGuideRevalidations.map(item => hash(item))])].sort();
  for (const channel of record.requiredChannelStatus) channel.evidenceKeys = [...record.newEvidenceKeys];
  record.recordContentHash = hash(without(record, 'recordContentHash', 'contentHash'));
  record.contentHash = hash(without(record, 'contentHash'));
  return record;
}

function describedPacket() {
  const record = structuredClone(sourcePacket({ categoryTitle: 'Category:Described guides', guideTitle: 'Described guide', ordinal: 2 }));
  const text = 'A revision-pinned category description.';
  Object.assign(record.exactCurrentCategoryEvidence, {
    pageDescriptionExists: true, redlinkCategoryState: false, currentMissingPage: null,
    currentPageIdentity: {
      namespaceId: 14, resolvedTitle: record.requestedTitles[0], sourceContentBytes: new TextEncoder().encode(text).length,
      sourceContentHash: hash(text), sourcePageId: 500001, sourceRevision: '15000009', sourceTimestamp: '2026-08-28T00:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(record.requestedTitles[0].replaceAll(' ', '_'))}`, sourceText: text
    }
  });
  return rehashPacket(record);
}

function dispositions(packets) {
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceSufficiencyDispositions({
    evidencePackets: packets, policy: dispositionPolicy, sourceSnapshotContentHash: evidenceSnapshotContentHash
  });
  assert.equal(built.audit.publishable, true);
  return built.records.map(record => ({ ...record, contentHash: hash(record) }));
}

function build(packets = [sourcePacket()]) {
  return buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport({
    dispositionRecords: dispositions(packets), evidencePackets: packets, policy,
    dispositionSnapshotContentHash, evidenceSnapshotContentHash
  });
}

test('policy and contracts define a generic, blank, fail-closed category review export', () => {
  const compiled = compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExportPolicy(policy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy);
  specific.overrides = { 'Category:Example guides': 'confirm' };
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExportPolicy(specific).valid, false);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExportPolicy(automatic).valid, false);
});

test('exports one exact source-bound active-redlink review row and blank template', () => {
  const built = build();
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.queueExportComplete, true);
  assert.equal(built.records.length, 1);
  assert.equal(built.decisionTemplates.length, 1);
  const entry = built.records[0];
  assert.equal(entry.classification, 'active_redlink_category_target_resolution_review_ready');
  assert.equal(entry.categoryEvidence.memberInventory.memberCount, 1);
  assert.equal(entry.categoryEvidence.memberInventory.members[0].exactCategoryOccurrences[0].exactSourceText, '[[Category:Example guides]]');
  assert.equal(entry.resolutionReview.decision, null);
  assert.equal(entry.selectedResolution, null);
  assert.equal(entry.optimizerEligible, false);
  assert.equal(entry.decisionTemplate.decision, null);
  assert.equal(entry.decisionTemplate.selectedResolution, null);
  assert.match(built.reviewMarkdown, /Category:Example guides/);
  assert.match(built.reviewMarkdown, /revision `15000001`/);
  for (const field of queueContract.required) assert.ok(Object.hasOwn(entry, field), `Missing queue field ${field}`);
  for (const field of decisionContract.required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing decision field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('exports the distinct described-category review shape without selecting it', () => {
  const built = build([describedPacket()]);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records[0].classification, 'described_category_page_resolution_review_ready');
  assert.equal(built.records[0].reviewRoute, 'explicit_source_bound_described_category_page_resolution_review');
  assert.equal(built.records[0].categoryEvidence.currentCategoryState.currentPageIdentity.sourcePageId, 500001);
  assert.equal(built.records[0].selectedResolution, null);
});

test('preserves input order and behaves identically for different names with equal evidence shapes', () => {
  const packets = [
    sourcePacket({ categoryTitle: 'Category:First guides', guideTitle: 'First member', ordinal: 1 }),
    sourcePacket({ categoryTitle: 'Category:Second guides', guideTitle: 'Second member', ordinal: 2 })
  ];
  const built = build(packets);
  assert.equal(built.audit.publishable, true);
  assert.deepEqual(built.records.map(record => record.queueOrdinal), [1, 2]);
  assert.deepEqual(new Set(built.records.map(record => record.classification)), new Set(['active_redlink_category_target_resolution_review_ready']));
});

test('rejects a disposition routed back to additional evidence', () => {
  const packets = [sourcePacket()];
  const rows = dispositions(packets);
  rows[0].classification = 'category_target_additional_evidence_required';
  rows[0].reviewRoute = 'additional_source_bound_category_resolution_evidence';
  rows[0].allowedReviewDecisions = [];
  rows[0].recordContentHash = hash(without(rows[0], 'recordContentHash', 'contentHash'));
  rows[0].contentHash = hash(without(rows[0], 'contentHash'));
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport({ dispositionRecords: rows, evidencePackets: packets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash });
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.publishable, false);
});

test('fails atomically on evidence, disposition, or snapshot-binding drift', () => {
  const packets = [sourcePacket()];
  const rows = dispositions(packets);
  const cases = [
    { evidencePackets: [{ ...packets[0], contentHash: '0'.repeat(64) }], dispositionRecords: rows, dispositionSnapshotContentHash, evidenceSnapshotContentHash },
    { evidencePackets: packets, dispositionRecords: [{ ...rows[0], contentHash: '0'.repeat(64) }], dispositionSnapshotContentHash, evidenceSnapshotContentHash },
    { evidencePackets: packets, dispositionRecords: rows, dispositionSnapshotContentHash: 'bad', evidenceSnapshotContentHash }
  ];
  for (const args of cases) {
    const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport({ ...args, policy });
    assert.equal(built.records.length, 0);
    assert.equal(built.audit.publishable, false);
  }
});

test('audit rejects review, resolution, semantic, optimizer, template, and account promotion', () => {
  const packets = [sourcePacket()];
  const rows = dispositions(packets);
  const built = buildUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport({ dispositionRecords: rows, evidencePackets: packets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash });
  for (const mutate of [
    ({ records }) => { records[0].resolutionReview.decision = records[0].allowedDecisions[0]; },
    ({ records }) => { records[0].selectedResolution = { title: 'invented' }; },
    ({ records }) => { records[0].canonicalActivityIdentity = { activityId: 'invented' }; },
    ({ records }) => { records[0].optimizerEligible = true; },
    ({ templates }) => { templates[0].decision = templates[0].allowedDecisions[0]; },
    ({ records }) => { records[0].currentLevel = 99; }
  ]) {
    const records = structuredClone(built.records);
    const templates = structuredClone(built.decisionTemplates);
    mutate({ records, templates });
    const audit = auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport(records, {
      dispositionRecords: rows, evidencePackets: packets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
      decisionTemplates: templates, reviewMarkdown: renderUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueMarkdown(records),
      decisionTemplateNdjson: serializeUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewDecisionTemplates(templates)
    });
    assert.equal(audit.publishable, false);
  }
});

test('machine records, Markdown, and templates are deterministic and artifact drift is detected', () => {
  const packets = [sourcePacket(), describedPacket()];
  const first = build(packets);
  const second = build(structuredClone(packets));
  assert.deepEqual(second, first);
  const audit = auditUnresolvedRenderedTargetAdditionalResolutionEvidenceReviewQueueExport(first.records, {
    dispositionRecords: dispositions(packets), evidencePackets: packets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
    decisionTemplates: first.decisionTemplates, reviewMarkdown: `${first.reviewMarkdown}changed`, decisionTemplateNdjson: first.decisionTemplateNdjson
  });
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('review_artifact_content_mismatch'));
});

test('CLI rejects a corrupt disposition manifest before writing review artifacts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-category-review-export-'));
  try {
    const snapshot = path.join(directory, '2026-01-02T00-00-00-000Z');
    fs.mkdirSync(snapshot, { recursive: true });
    const packet = sourcePacket();
    const row = dispositions([packet])[0];
    const raw = `${JSON.stringify(row)}\n`;
    fs.writeFileSync(path.join(snapshot, 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition.ndjson'), raw);
    fs.writeFileSync(path.join(snapshot, 'manifest.json'), JSON.stringify({
      domain: 'cross-skill-unresolved-rendered-target-additional-resolution-evidence-sufficiency-disposition', records: 1, contentHash: '0'.repeat(64),
      source: { audit: { dispositionCoverageComplete: true, resolutionReviewComplete: false, canonicalIdentityComplete: false, completeActivityUniverse: false, publishable: true, semanticPreservationCoverage: { resolutionReviewCompletedCount: 0, selectedResolutionCount: 0, canonicalGameEntityIdentityCount: 0, canonicalActivityIdentityCount: 0, repeatabilityClassifiedCount: 0, mechanicsReviewCompleteCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0 } } }
    }));
    const result = spawnSync(process.execPath, ['platform/transforms/export-cross-skill-unresolved-rendered-target-additional-resolution-evidence-review-queue.mjs', `--root=${directory}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(directory).length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
