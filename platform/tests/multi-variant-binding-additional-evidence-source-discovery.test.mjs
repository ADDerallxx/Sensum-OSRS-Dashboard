import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditMultiVariantBindingAdditionalEvidenceSourceDiscovery,
  buildMultiVariantBindingAdditionalEvidenceSourceDiscovery,
  buildMultiVariantBindingDirectSourceRequests,
  buildMultiVariantBindingDiscoveryQueries,
  compileMultiVariantBindingAdditionalEvidenceSourceDiscoveryPolicy,
  discoverMultiVariantBindingCandidateRequests
} from '../ingestion/multi-variant-binding-additional-evidence-source-discovery-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-binding-additional-evidence-source-discovery-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-additional-evidence-source-discovery-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-additional-evidence-source-discovery-audit-v1.json', 'utf8'));
const sourceQueueSnapshotContentHash = 'a'.repeat(64);
const subjectContent = '{{Infobox NPC\n|version1 = Normal\n|version2 = Quest\n|name = Test NPC\n|id1 = 101\n|id2 = 202\n}}\nTest NPC is a librarian.';
const parentContent = '==Letter delivery==\n* [[Test NPC]], librarian of Test City';

function sourceIdentity(pageId, title, revision, timestamp, content) {
  return {
    resolvedTitle: title,
    sourceContentBytes: new TextEncoder().encode(content).length,
    sourceContentHash: hash(content),
    sourcePageId: pageId,
    sourceRevision: revision,
    sourceTimestamp: timestamp,
    sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`
  };
}

function queueRecord() {
  const base = {
    contract: policy.inputContract,
    workQueueEntryKey: 'work:1',
    queueOrdinal: 1,
    sourceDispositionRecordContentHash: hash('disposition-record'),
    sourceEvidencePacketContentHash: hash('evidence-packet'),
    sourceDispositionKey: 'disposition:1',
    evidenceFingerprint: hash('fingerprint'),
    structuralCandidateKey: 'candidate:1',
    candidateRole: 'message_delivery_recipient_candidate',
    candidateDisplayName: 'Test NPC',
    subjectEvidence: {
      sourcePageIdentity: sourceIdentity(10, 'Test NPC', '100', '2026-01-01T00:00:00Z', subjectContent),
      numberedVariantInventory: [
        { variantIndex: 1, identityFields: [{ identityBearing: true, parameterBase: 'version', parameterName: 'version1', value: 'Normal', variantIndex: 1 }, { identityBearing: true, parameterBase: 'id', parameterName: 'id1', value: '101', variantIndex: 1 }] },
        { variantIndex: 2, identityFields: [{ identityBearing: true, parameterBase: 'version', parameterName: 'version2', value: 'Quest', variantIndex: 2 }, { identityBearing: true, parameterBase: 'id', parameterName: 'id2', value: '202', variantIndex: 2 }] }
      ]
    },
    parentOccurrenceEvidence: {
      sourcePageIdentity: sourceIdentity(20, 'Example tasks', '200', '2026-01-02T00:00:00Z', parentContent),
      exactSourceText: '[[Test NPC]]'
    },
    insufficiencyEvidence: { blockers: ['shared_unnumbered_name_does_not_discriminate_numbered_variant'] },
    requiredAdditionalEvidenceChannels: [...policy.discovery.requiredAdditionalEvidenceChannels],
    newEvidenceKeys: [],
    reviewCandidateVariantIndex: null,
    bindingReviewDecision: null,
    boundVariantIndex: null,
    evidenceReviewer: null,
    evidenceReviewedAt: null,
    evidenceNotes: null,
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
    state: policy.inputState
  };
  const withEntryHash = { ...base, entryContentHash: hash(base) };
  return { ...withEntryHash, contentHash: hash(withEntryHash) };
}

function page(pageid, title, revision, timestamp, content, ns = 0) {
  return { pageid, ns, title, revisions: [{ revid: Number(revision), timestamp, slots: { main: { content } } }] };
}

function fixture() {
  const record = queueRecord();
  const queries = buildMultiVariantBindingDiscoveryQueries(record, policy);
  const searchResponses = queries.map((query, index) => ({
    ...query,
    totalHits: 1,
    returnedCount: 1,
    continuationExhausted: true,
    truncated: false,
    results: [{ pageid: 30, ns: 0, title: "Old man's message", size: 100, wordcount: 20, timestamp: '2026-02-01T00:00:00Z', snippet: 'Test NPC and Example', rank: 1 }]
  }));
  const requests = discoverMultiVariantBindingCandidateRequests(record, searchResponses);
  const contents = new Map([
    ['Example tasks', parentContent],
    ['Test NPC', subjectContent],
    ['Transcript:Test NPC', '==Delivering the message==\n* Test NPC: The Example sent this message.'],
    ["Old man's message", 'The Example asked you to take this to Test NPC. A separate archive URL https://test-npc.example mentions Quest.']
  ]);
  const ids = new Map([['Example tasks', 20], ['Test NPC', 10], ['Transcript:Test NPC', 40], ["Old man's message", 30]]);
  const fetchedResolutions = requests.map((request, index) => {
    const content = contents.get(request.requestedTitle);
    const p = page(ids.get(request.requestedTitle), request.requestedTitle, String(300 + index), '2026-02-01T00:00:00Z', content, request.requestedTitle.startsWith('Transcript:') ? 112 : 0);
    return { requestedTitle: request.requestedTitle, normalizedTitle: request.requestedTitle, resolvedTitle: request.requestedTitle, page: p, redirected: false };
  });
  return {
    workQueueRecords: [record],
    pinnedRevisionPages: [page(10, 'Test NPC', '100', '2026-01-01T00:00:00Z', subjectContent), page(20, 'Example tasks', '200', '2026-01-02T00:00:00Z', parentContent)],
    discoveryResponses: [{ workQueueEntryKey: record.workQueueEntryKey, searchResponses }],
    candidateRequests: [{ workQueueEntryKey: record.workQueueEntryKey, requests }],
    fetchedResolutions,
    policy,
    sourceQueueSnapshotContentHash
  };
}

const compiled = compileMultiVariantBindingAdditionalEvidenceSourceDiscoveryPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const record = queueRecord();
assert.equal(buildMultiVariantBindingDirectSourceRequests(record).length, 3);
assert.equal(buildMultiVariantBindingDiscoveryQueries(record, policy).length, 5);

const args = fixture();
const built = buildMultiVariantBindingAdditionalEvidenceSourceDiscovery(args);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.variantDisambiguationEvidenceComplete, false);
assert.equal(built.audit.variantBindingReviewComplete, false);
assert.equal(built.audit.inputCoverage.completeInputWorkQueueEntryCount, 1);
assert.equal(built.audit.pinnedSourceIntegrityCoverage.revalidatedPinnedSourceCount, 2);
assert.equal(built.audit.discoveryCoverage.queryCount, 5);
assert.equal(built.audit.discoveryCoverage.completeQueryCount, 5);
assert.ok(built.audit.sourceAlignmentCoverage.candidateScopedParentContextObservationCount > 0);
assert.equal(built.audit.sourceAlignmentCoverage.exactTaskToNumberedVariantAlignmentObservationCount, 0);
assert.equal(built.records.length, 1);
assert.ok(built.records[0].newEvidenceKeys.length > 0);
assert.equal(built.records[0].reviewCandidateVariantIndex, null);
assert.equal(built.records[0].bindingReviewDecision, null);
assert.equal(built.records[0].boundVariantIndex, null);
assert.equal(built.records[0].candidateMemberIdentityVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
assert.ok(built.records[0].blockers.includes('source_authored_numbered_variant_identity_alignment_not_observed'));
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing source discovery field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing source discovery audit field ${field}`);

const deterministic = buildMultiVariantBindingAdditionalEvidenceSourceDiscovery(structuredClone(args));
assert.deepEqual(deterministic, built);

let invalid = structuredClone(args);
invalid.workQueueRecords[0].contentHash = '0'.repeat(64);
let failed = buildMultiVariantBindingAdditionalEvidenceSourceDiscovery(invalid);
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_input_work_queue_entries_failed_revalidation'));

invalid = structuredClone(args);
invalid.pinnedRevisionPages[0].revisions[0].slots.main.content += ' drift';
failed = buildMultiVariantBindingAdditionalEvidenceSourceDiscovery(invalid);
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_pinned_sources_failed_exact_revision_revalidation'));

invalid = structuredClone(args);
invalid.discoveryResponses[0].searchResponses[0].truncated = true;
invalid.discoveryResponses[0].searchResponses[0].continuationExhausted = false;
failed = buildMultiVariantBindingAdditionalEvidenceSourceDiscovery(invalid);
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_source_searches_missing_truncated_or_mismatched'));

invalid = structuredClone(args);
invalid.fetchedResolutions.pop();
failed = buildMultiVariantBindingAdditionalEvidenceSourceDiscovery(invalid);
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_discovered_or_direct_source_pages_failed_revision_capture'));

const specific = structuredClone(policy);
specific.overrides = { 'Test NPC': 'variant1' };
assert.equal(compileMultiVariantBindingAdditionalEvidenceSourceDiscoveryPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileMultiVariantBindingAdditionalEvidenceSourceDiscoveryPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].boundVariantIndex = 1;
let audit = auditMultiVariantBindingAdditionalEvidenceSourceDiscovery(promoted, args);
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('source_discovery_created_unsupported_review_binding_semantic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentLevel = 34;
audit = auditMultiVariantBindingAdditionalEvidenceSourceDiscovery(accountScoped, args);
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Multi-variant binding additional-evidence source discovery checks passed.');
