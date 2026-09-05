import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditWeightedParentTaskEntryMembershipEvidence,
  buildWeightedParentTaskEntryMembershipEvidence,
  compileWeightedParentTaskEntryMembershipEvidencePolicy,
  discoverWeightedParentTaskEntryMembershipExactRevisionRequests
} from '../ingestion/weighted-parent-task-entry-membership-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-evidence-audit-v1.json', 'utf8'));
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`;

const parentText = `{{Infobox Activity|name=Test Master tasks}}
There are 2 tasks in total, each of which is allotted an equal weight. Each task has the same chance.
==Item delivery==
|{{plink|Test item}}
These make up approximately 80% of all tasks.
==Message delivery==
* [[Test NPC]]`;
const itemText = `{{Infobox Item
|name=Test item
}}
The [[Test Master tasks|Test Master task]] may request this item.`;
const npcText = `{{Infobox NPC
|name1=Test NPC
|version2=Second form
}}
No parent-task relationship is stated here.`;

function source(sourceKey, pageId, title, revision, timestamp, text, roles) {
  const record = {
    sourceKey,
    sourcePageIdentity: {
      sourcePageId: pageId,
      resolvedTitle: title,
      sourceRevision: revision,
      sourceTimestamp: timestamp,
      sourceUrl: wikiUrl(title),
      sourceContentHash: hash(text),
      sourceContentBytes: Buffer.byteLength(text, 'utf8')
    },
    exactRevisionSourceText: text,
    roles,
    captureComplete: true,
    integrityChecks: { pageIdMatches: true, revisionMatches: true, contentHashMatches: true },
    semanticVerdict: null,
    state: 'complete_exact_revision_source_capture_non_verdict'
  };
  return record;
}

const parent = source('source:parent', 100, 'Test Master tasks', '500', '2026-01-01T00:00:00Z', parentText, ['structural_parent_source']);
const item = source('source:item', 101, 'Test item', '501', '2026-01-02T00:00:00Z', itemText, ['candidate_subject_source']);
const npc = source('source:npc', 102, 'Test NPC', '502', '2026-01-03T00:00:00Z', npcText, ['candidate_subject_source']);

function occurrence(text, exactSourceText, line, columnStart, pageId = 100, revision = '500') {
  const record = {
    exactSourceText,
    exactSourceTextContentHash: hash(exactSourceText),
    sourceContentHash: hash(text),
    sourceLocator: { lineStart: line, lineEnd: line, columnStart, columnEnd: columnStart + exactSourceText.length - 1 },
    sourcePageId: pageId,
    sourceRevision: revision
  };
  return record;
}

function workItem(key, role, subjectKey) {
  return {
    workItemKey: `work:${key}`,
    structuralCandidateKey: `candidate:${key}`,
    candidateRole: role,
    routeKey: policy.inputRouteKey,
    workKind: policy.inputWorkKind,
    workState: 'blocked_pending_weighted_parent_task_entry_membership_evidence',
    sourceDispositionKeys: [`disposition:${key}`],
    sourceDispositionStates: [{ dispositionKey: `disposition:${key}`, state: 'blocked_weighted_parent_task_entry_membership_disposition' }],
    sourceEvidenceKeys: [subjectKey, parent.sourceKey],
    requiredChannels: ['candidate_scoped_weight_statement', 'duplicate_alias_treatment', 'variant_membership_treatment', 'weighted_membership_review'],
    evidenceWorkComplete: false,
    reviewDecision: null,
    candidateMemberIdentityVerdict: null,
    sourcePageEntityTypeVerdict: null,
    structuralParentRelationshipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false
  };
}

function gapPacket(key, exactSourceText, line, columnStart) {
  return {
    branchKey: 'weighted_parent_task_entry_membership_evidence',
    structuralCandidateKey: `candidate:${key}`,
    channelObservations: [{
      channel: 'explicit_weighted_entry_membership',
      evidence: { candidateOccurrence: occurrence(parentText, exactSourceText, line, columnStart) }
    }]
  };
}

function routingRecord() {
  const workItems = [
    workItem('item', 'item_delivery_target_candidate', item.sourceKey),
    workItem('npc', 'message_delivery_recipient_candidate', npc.sourceKey)
  ];
  const record = {
    contract: policy.inputContract,
    structuralMemberCandidateSemanticGapEvidenceSources: [parent, item, npc],
    structuralMemberCandidateSemanticGapEvidencePackets: [
      gapPacket('item', '{{plink|Test item}}', 4, 2),
      gapPacket('npc', '* [[Test NPC]]', 7, 1)
    ],
    structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting: {
      routeState: policy.inputRouteState,
      weightedMembershipWorkItemCount: workItems.length,
      weightedMembershipWorkItems: workItems
    },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['weighted_parent_task_entry_membership_not_proven'],
    state: policy.inputState,
    contentHash: hash('routing-record')
  };
  delete record.structuralMemberCandidateSemanticGapEvidencePackets[1].channelObservations[0].evidence.candidateOccurrence.sourceLocator.columnStart;
  delete record.structuralMemberCandidateSemanticGapEvidencePackets[1].channelObservations[0].evidence.candidateOccurrence.sourceLocator.columnEnd;
  return record;
}

function fetched(sourceRecord, overrides = {}) {
  const identity = sourceRecord.sourcePageIdentity;
  return {
    pageid: overrides.pageId ?? identity.sourcePageId,
    title: overrides.title ?? identity.resolvedTitle,
    revisions: [{
      revid: Number(overrides.revision ?? identity.sourceRevision),
      timestamp: overrides.timestamp ?? identity.sourceTimestamp,
      slots: { main: { content: overrides.text ?? sourceRecord.exactRevisionSourceText } }
    }]
  };
}

const input = routingRecord();
const fetchedPages = [fetched(parent), fetched(item), fetched(npc)];
const compiled = compileWeightedParentTaskEntryMembershipEvidencePolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.invalidChannels, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidDefinitions, []);

const requests = discoverWeightedParentTaskEntryMembershipExactRevisionRequests([input], policy);
assert.equal(requests.length, 3);
assert.deepEqual(requests.map(request => request.sourceRevision).sort(), ['500', '501', '502']);

const built = buildWeightedParentTaskEntryMembershipEvidence({ routingRecords: [input], fetchedPages, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketCaptureComplete, true);
assert.equal(built.audit.weightedMembershipReviewComplete, false);
assert.equal(built.audit.inputCoverage.weightedMembershipWorkItemCount, 2);
assert.equal(built.audit.revisionCoverage.exactRevisionRequestCount, 3);
assert.equal(built.audit.revisionCoverage.completeSourceRevalidationCount, 3);
assert.equal(built.audit.packetCoverage.evidencePacketCount, 2);
assert.equal(built.audit.packetCoverage.completeEvidencePacketCount, 2);
assert.equal(built.audit.observationCoverage.candidateScopedWeightStatementCount, 0);
assert.equal(built.audit.observationCoverage.globalWeightStatementCount, 4);
assert.equal(built.audit.observationCoverage.uniqueGlobalWeightStatementCount, 2);
assert.equal(built.audit.observationCoverage.parentDistributionStatementCount, 2);
assert.equal(built.audit.observationCoverage.uniqueParentDistributionStatementCount, 1);
assert.equal(built.audit.observationCoverage.candidateSubjectCorroborationCount, 1);
assert.equal(built.audit.observationCoverage.aliasVariantSignalCount, 2);
assert.equal(built.records.length, 1);
assert.equal(built.records[0].weightedParentTaskEntryMembershipEvidencePackets.length, 2);
assert.equal(built.records[0].weightedTaskEntryMembershipVerdict, null);
assert.equal(built.records[0].memberUniverseComplete, false);
assert.equal(built.records[0].optimizerEligible, false);
for (const packet of built.records[0].weightedParentTaskEntryMembershipEvidencePackets) {
  assert.equal(packet.captureComplete, true);
  assert.equal(packet.weightedMembershipSemanticEvidenceComplete, false);
  assert.equal(packet.weightedTaskEntryMembershipVerdict, null);
  assert.deepEqual(packet.requiredChannels, policy.requiredChannels);
}
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing output field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const deterministic = buildWeightedParentTaskEntryMembershipEvidence({
  routingRecords: [structuredClone(input)], fetchedPages: structuredClone(fetchedPages), policy: structuredClone(policy), contentHash: hash
});
assert.deepEqual(deterministic, built);

for (const badFetched of [
  [],
  [fetched(parent), fetched(item), fetched(npc, { pageId: 999 })],
  [fetched(parent), fetched(item), fetched(npc, { text: `${npcText}\nchanged` })]
]) {
  const failed = buildWeightedParentTaskEntryMembershipEvidence({ routingRecords: [input], fetchedPages: badFetched, policy, contentHash: hash });
  assert.equal(failed.audit.publishable, false);
  assert.equal(failed.audit.evidencePacketCaptureComplete, false);
}

const stale = routingRecord();
stale.structuralMemberCandidateSemanticGapEvidenceSources[1].exactRevisionSourceText += '\nstale';
let failed = buildWeightedParentTaskEntryMembershipEvidence({ routingRecords: [stale], fetchedPages, policy, contentHash: hash });
assert.equal(failed.audit.publishable, false);

const badOccurrence = routingRecord();
badOccurrence.structuralMemberCandidateSemanticGapEvidencePackets[0].channelObservations[0].evidence.candidateOccurrence.sourceLocator.columnStart = 1;
failed = buildWeightedParentTaskEntryMembershipEvidence({ routingRecords: [badOccurrence], fetchedPages, policy, contentHash: hash });
assert.equal(failed.audit.publishable, false);

const specific = structuredClone(policy);
specific.overrides = { 'candidate:item': 'accept' };
assert.equal(compileWeightedParentTaskEntryMembershipEvidencePolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileWeightedParentTaskEntryMembershipEvidencePolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].weightedTaskEntryMembershipVerdict = 'member';
promoted[0].weightedParentTaskEntryMembershipEvidencePackets[0].weightedTaskEntryMembershipVerdict = 'member';
promoted[0].memberUniverseComplete = true;
promoted[0].optimizerEligible = true;
let promotedAudit = auditWeightedParentTaskEntryMembershipEvidence(promoted, { routingRecords: [input], fetchedPages, policy, contentHash: hash });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('weighted_membership_evidence_created_unsupported_semantic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
promotedAudit = auditWeightedParentTaskEntryMembershipEvidence(accountScoped, { routingRecords: [input], fetchedPages, policy, contentHash: hash });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('current_account_state_present'));

console.log('Revision-pinned weighted parent-task entry membership evidence checks passed.');
