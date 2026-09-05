import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import { buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions } from '../transforms/weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition-lib.mjs';
import {
  auditWeightedMembershipAdditionalEvidenceReviewQueueExport,
  buildWeightedMembershipAdditionalEvidenceReviewQueueExport,
  compileWeightedMembershipAdditionalEvidenceReviewQueueExportPolicy,
  renderWeightedMembershipAdditionalEvidenceReviewQueueMarkdown,
  serializeWeightedMembershipAdditionalEvidenceReviewDecisionTemplates
} from '../transforms/weighted-parent-task-entry-membership-additional-evidence-review-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-additional-evidence-review-queue-export-v1.json', 'utf8'));
const dispositionPolicy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition-v1.json', 'utf8'));
const queueContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-review-queue-entry-v1.json', 'utf8'));
const decisionContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-review-decision-template-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-review-queue-export-audit-v1.json', 'utf8'));
const evidenceSnapshotContentHash = 'a'.repeat(64);
const dispositionSnapshotContentHash = 'b'.repeat(64);

function snapshotRecord(record) {
  return { ...record, contentHash: hash(record) };
}

function rehashPacket(record) {
  const base = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'recordContentHash' && key !== 'contentHash'));
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function rehashDisposition(record) {
  const base = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'recordContentHash' && key !== 'contentHash'));
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function fixturePacket() {
  const parentText = '==Easy task items==\n* Bring [[Beer]] to the Wise Old Man.\n* Store a [[Beer glass]] separately.';
  const candidateText = '{{Infobox Item\n|name=Beer\n}}\nBeer is an item.';
  const parentKey = 'wiki-pageid:2|revision:22';
  const candidateKey = 'wiki-pageid:1|revision:11';
  const parentPage = {
    sourceKey: parentKey,
    sourcePageId: 2,
    resolvedTitle: 'Wise Old Man tasks',
    sourceRevision: '22',
    sourceTimestamp: '2026-01-02T00:00:00Z',
    sourceUrl: 'https://oldschool.runescape.wiki/w/Wise_Old_Man_tasks',
    sourceContentHash: hash(parentText),
    sourceContentBytes: Buffer.byteLength(parentText, 'utf8'),
    sourceText: parentText,
    complete: true,
    requestedTitles: ['Wise Old Man tasks'],
    normalizedTitles: ['Wise Old Man tasks'],
    redirectedRequests: [],
    discoveryContexts: []
  };
  const candidatePage = {
    sourceKey: candidateKey,
    sourcePageId: 1,
    resolvedTitle: 'Beer',
    sourceRevision: '11',
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: 'https://oldschool.runescape.wiki/w/Beer',
    sourceContentHash: hash(candidateText),
    sourceContentBytes: Buffer.byteLength(candidateText, 'utf8'),
    sourceText: candidateText,
    complete: true,
    requestedTitles: ['Beer'],
    normalizedTitles: ['Beer'],
    redirectedRequests: [],
    discoveryContexts: []
  };
  const observation = {
    sourceKey: parentKey,
    resolvedTitle: parentPage.resolvedTitle,
    heading: 'Easy task items',
    headingLine: 1,
    lineStart: 1,
    lineEnd: 3,
    matchedCandidate: 'Beer',
    candidateMentionBasis: 'exact_structured_source_reference',
    matchedContextTerms: ['Wise Old Man tasks'],
    exactSectionText: parentText,
    exactSectionTextContentHash: hash(parentText),
    relationshipSignals: ['task', 'bring'],
    signalBasis: 'candidate_and_relationship_language_in_section',
    semanticUse: 'candidate_scoped_membership_signal_for_explicit_review_not_membership_verdict'
  };
  const checks = { pagePresent: true, revisionMatches: true, timestampMatches: true, titleMatches: true, pageIdMatches: true, contentComplete: true, contentHashMatches: true, contentBytesMatch: true };
  const base = {
    contract: policy.evidencePacketContract,
    evidencePacketKey: 'packet:beer',
    workQueueEntryKey: 'work:beer',
    sourceDispositionKey: 'source-disposition:beer',
    structuralCandidateKey: 'candidate:beer',
    candidateRole: 'item_delivery_target_candidate',
    candidateDisplay: { value: 'Beer', source: { kind: 'retained_revision_pinned_candidate_subject_source_title', sourceKey: candidateKey, sourcePageId: 1, sourceRevision: '11', sourceContentHash: hash(candidateText) } },
    sourceQueueSnapshotContentHash: 'c'.repeat(64),
    sourceEvidencePacketContentHash: 'd'.repeat(64),
    sourceWorkQueueRecordContentHash: 'e'.repeat(64),
    evidenceFingerprint: 'f'.repeat(64),
    parentSectionContext: { heading: 'Easy task items' },
    pinnedSourceRevalidations: [
      { sourceKey: parentKey, sourcePageId: 2, resolvedTitle: parentPage.resolvedTitle, sourceRevision: '22', sourceTimestamp: parentPage.sourceTimestamp, sourceUrl: parentPage.sourceUrl, sourceContentHash: parentPage.sourceContentHash, sourceContentBytes: parentPage.sourceContentBytes, sourceRoles: ['parent_inventory_source'], complete: true, checks },
      { sourceKey: candidateKey, sourcePageId: 1, resolvedTitle: candidatePage.resolvedTitle, sourceRevision: '11', sourceTimestamp: candidatePage.sourceTimestamp, sourceUrl: candidatePage.sourceUrl, sourceContentHash: candidatePage.sourceContentHash, sourceContentBytes: candidatePage.sourceContentBytes, sourceRoles: ['candidate_subject_source'], complete: true, checks }
    ],
    directSourceRequests: [],
    discoveryQueries: [{ queryKey: 'query:beer', query: 'Beer', namespace: 0, totalHits: 2, returnedCount: 2, continuationExhausted: true, truncated: false, results: [{ pageid: 1 }, { pageid: 2 }] }],
    candidateSourcePages: [candidatePage, parentPage].sort((left, right) => left.sourceKey.localeCompare(right.sourceKey)),
    newEvidenceKeys: [candidateKey, parentKey].sort(),
    candidateParentContextObservations: [{ ...observation, semanticUse: 'candidate_parent_context_source_discovery_only' }],
    candidateScopedMembershipSignalObservations: [observation],
    candidateScopedWeightSignalObservations: [],
    requiredChannelStatus: [
      { channel: 'candidate_subject_parent_task_relationship_statement', humanReviewRequired: false, satisfiedByCapturedEvidence: true },
      { channel: 'candidate_scoped_weight_or_membership_statement', humanReviewRequired: false, satisfiedByCapturedEvidence: true },
      { channel: 'explicit_source_bound_human_review', humanReviewRequired: true, satisfiedByCapturedEvidence: false }
    ],
    evidenceReviewer: null,
    evidenceReviewedAt: null,
    evidenceNotes: null,
    sourceSilenceIsNotNegativeEvidence: true,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mechanicsReviewComplete: false,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: ['explicit_source_bound_human_review_pending'],
    state: policy.evidencePacketState
  };
  return rehashPacket(base);
}

const compiled = compileWeightedMembershipAdditionalEvidenceReviewQueueExportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const evidencePackets = [fixturePacket()];
const dispositionBuild = buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({
  evidencePackets,
  policy: dispositionPolicy,
  sourceSnapshotContentHash: evidenceSnapshotContentHash
});
assert.equal(dispositionBuild.audit.publishable, true);
const dispositionRecords = dispositionBuild.records.map(snapshotRecord);
const built = buildWeightedMembershipAdditionalEvidenceReviewQueueExport({
  dispositionRecords,
  evidencePackets,
  policy,
  dispositionSnapshotContentHash,
  evidenceSnapshotContentHash
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.queueExportComplete, true);
assert.equal(built.audit.inputCoverage.revalidatedDispositionCount, 1);
assert.equal(built.audit.inputCoverage.revalidatedEvidencePacketCount, 1);
assert.equal(built.audit.queueCoverage.reviewQueueEntryCount, 1);
assert.equal(built.audit.queueCoverage.blankDecisionTemplateCount, 1);
assert.equal(built.audit.sourceIntegrityCoverage.exactParentSectionObservationCount, 1);
assert.equal(built.audit.sourceIntegrityCoverage.exactCandidateBearingLineCount, 1);
assert.equal(built.records.length, 1);
assert.equal(built.decisionTemplates.length, 1);

const entry = built.records[0];
assert.equal(entry.candidateDisplay.value, 'Beer');
assert.equal(entry.exactParentSectionObservations[0].exactMatchedLines.length, 1);
assert.match(entry.exactParentSectionObservations[0].exactMatchedLines[0].exactSourceText, /\[\[Beer\]\]/);
assert.doesNotMatch(entry.exactParentSectionObservations[0].exactMatchedLines[0].exactSourceText, /Beer glass/);
assert.equal(entry.reviewDecision, null);
assert.equal(entry.weightedTaskEntryMembershipVerdict, null);
assert.equal(entry.optimizerEligible, false);
assert.equal(entry.decisionTemplate.decision, null);
assert.deepEqual(entry.allowedDecisions, policy.allowedDecisions);
assert.match(built.reviewMarkdown, /revision `22`/);
assert.match(built.reviewMarkdown, /Bring \[\[Beer\]\] to the Wise Old Man/);
assert.equal(renderWeightedMembershipAdditionalEvidenceReviewQueueMarkdown(built.records), built.reviewMarkdown);
assert.equal(serializeWeightedMembershipAdditionalEvidenceReviewDecisionTemplates(built.decisionTemplates), built.decisionTemplateNdjson);
for (const field of queueContract.required) assert.ok(Object.hasOwn(entry, field), `Missing queue field: ${field}`);
for (const field of decisionContract.required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing decision field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const deterministic = buildWeightedMembershipAdditionalEvidenceReviewQueueExport({
  dispositionRecords: structuredClone(dispositionRecords),
  evidencePackets: structuredClone(evidencePackets),
  policy: structuredClone(policy),
  dispositionSnapshotContentHash,
  evidenceSnapshotContentHash
});
assert.deepEqual(deterministic, built);

const tamperedEvidence = structuredClone(evidencePackets);
tamperedEvidence[0].candidateSourcePages[1].sourceText += ' changed';
tamperedEvidence[0] = rehashPacket(tamperedEvidence[0]);
assert.equal(buildWeightedMembershipAdditionalEvidenceReviewQueueExport({ dispositionRecords, evidencePackets: tamperedEvidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash }).audit.publishable, false);

const tamperedDisposition = structuredClone(dispositionRecords);
tamperedDisposition[0].parentSectionEvidenceBindings[0].lineEnd += 1;
tamperedDisposition[0] = rehashDisposition(tamperedDisposition[0]);
assert.equal(buildWeightedMembershipAdditionalEvidenceReviewQueueExport({ dispositionRecords: tamperedDisposition, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash }).audit.publishable, false);

const decidedRecords = structuredClone(built.records);
decidedRecords[0].reviewDecision = policy.allowedDecisions[0];
let audit = auditWeightedMembershipAdditionalEvidenceReviewQueueExport(decidedRecords, {
  dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
  decisionTemplates: built.decisionTemplates,
  reviewMarkdown: renderWeightedMembershipAdditionalEvidenceReviewQueueMarkdown(decidedRecords),
  decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('queue_export_created_review_semantic_or_optimizer_promotion'));

const decidedTemplates = structuredClone(built.decisionTemplates);
decidedTemplates[0].decision = policy.allowedDecisions[0];
audit = auditWeightedMembershipAdditionalEvidenceReviewQueueExport(built.records, {
  dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
  decisionTemplates: decidedTemplates,
  reviewMarkdown: built.reviewMarkdown,
  decisionTemplateNdjson: serializeWeightedMembershipAdditionalEvidenceReviewDecisionTemplates(decidedTemplates)
});
assert.equal(audit.publishable, false);

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
audit = auditWeightedMembershipAdditionalEvidenceReviewQueueExport(accountScoped, {
  dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
  decisionTemplates: built.decisionTemplates,
  reviewMarkdown: renderWeightedMembershipAdditionalEvidenceReviewQueueMarkdown(accountScoped),
  decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'candidate:beer': 'confirm' };
assert.equal(compileWeightedMembershipAdditionalEvidenceReviewQueueExportPolicy(specificPolicy).valid, false);
const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(compileWeightedMembershipAdditionalEvidenceReviewQueueExportPolicy(automaticPolicy).valid, false);

console.log('Weighted parent-task additional-evidence review queue export checks passed.');
