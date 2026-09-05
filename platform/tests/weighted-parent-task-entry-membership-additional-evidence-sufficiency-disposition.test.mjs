import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditWeightedMembershipAdditionalEvidenceSufficiencyDisposition,
  buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions,
  compileWeightedMembershipAdditionalEvidenceSufficiencyDispositionPolicy,
  exactPinnedParentSectionEvidence
} from '../transforms/weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-sufficiency-disposition-audit-v1.json', 'utf8'));
const sourceSnapshotContentHash = 'a'.repeat(64);
const parentText = '==Easy task items==\n|{{plink|Anchovies}}||{{plink|Bones}}';
const candidateText = 'Anchovies may be requested for a task.';

function page(sourceKey, sourcePageId, resolvedTitle, sourceRevision, sourceText) {
  return {
    sourceKey,
    requestedTitles: [resolvedTitle],
    normalizedTitles: [resolvedTitle],
    resolvedTitle,
    redirectedRequests: [],
    namespace: 0,
    sourcePageId,
    sourceRevision,
    sourceTimestamp: '2026-02-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/${resolvedTitle.replaceAll(' ', '_')}`,
    sourceContentHash: hash(sourceText),
    sourceContentBytes: new TextEncoder().encode(sourceText).length,
    sourceText,
    discoveryContexts: [],
    complete: true
  };
}

function pinned(sourceKey, sourcePageId, resolvedTitle, sourceRevision, sourceText, sourceRoles) {
  return {
    sourceKey,
    sourceRoles,
    workQueueEntryKeys: ['work:1'],
    sourcePageId,
    resolvedTitle,
    sourceRevision,
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/${resolvedTitle.replaceAll(' ', '_')}`,
    sourceContentHash: hash(sourceText),
    sourceContentBytes: new TextEncoder().encode(sourceText).length,
    checks: { pagePresent: true, pageIdMatches: true, titleMatches: true, revisionMatches: true, timestampMatches: true, contentComplete: true, contentHashMatches: true, contentBytesMatch: true },
    complete: true
  };
}

function observation(sourceKey, resolvedTitle, exactSectionText, candidateMentionBasis = 'exact_structured_source_reference', heading = 'Easy task items') {
  return {
    sourceKey,
    resolvedTitle,
    heading,
    headingLine: 1,
    lineStart: 1,
    lineEnd: 2,
    matchedCandidate: 'Anchovies',
    candidateMentionBasis,
    matchedContextTerms: ['Wise Old Man tasks', 'Wise Old Man', 'Easy task items'],
    exactSectionText,
    exactSectionTextContentHash: hash(exactSectionText),
    relationshipSignals: ['tasks'],
    signalBasis: 'candidate_in_relationship_labeled_section',
    semanticUse: 'candidate_scoped_membership_signal_for_explicit_review_not_membership_verdict'
  };
}

function rehash(packet) {
  const bare = structuredClone(packet);
  delete bare.recordContentHash;
  delete bare.contentHash;
  const withRecordHash = { ...bare, recordContentHash: hash(bare) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function packet(route = 'exact') {
  const candidateKey = 'wiki-pageid:10|revision:300';
  const parentKey = 'wiki-pageid:20|revision:400';
  const pages = [page(candidateKey, 10, 'Anchovies', '300', candidateText), page(parentKey, 20, 'Wise Old Man tasks', '400', parentText)];
  let membership = [observation(parentKey, 'Wise Old Man tasks', parentText)];
  if (route === 'context') membership = [observation(candidateKey, 'Anchovies', candidateText, 'exact_candidate_subject_page', null)];
  if (route === 'additional') membership = [];
  const observed = membership.length > 0;
  const base = {
    contract: policy.inputContract,
    evidencePacketKey: 'packet:1',
    workQueueEntryKey: 'work:1',
    sourceWorkQueueRecordContentHash: hash('work'),
    sourceQueueSnapshotContentHash: hash('queue'),
    sourceDispositionKey: 'source-disposition:1',
    sourceEvidencePacketContentHash: hash('source-evidence'),
    evidenceFingerprint: hash('fingerprint'),
    structuralCandidateKey: 'candidate:1',
    candidateRole: 'item_delivery_target_candidate',
    candidateDisplay: { value: 'Anchovies', source: { sourceKey: candidateKey } },
    pinnedSourceRevalidations: [
      pinned(candidateKey, 10, 'Anchovies', '100', candidateText, ['candidate_subject_source']),
      pinned(parentKey, 20, 'Wise Old Man tasks', '200', parentText, ['parent_inventory_source'])
    ],
    discoveryQueries: [{ queryKey: 'q1', query: 'insource:"Anchovies" insource:"Wise Old Man"', namespace: 0, totalHits: 1, returnedCount: 1, continuationExhausted: true, truncated: false, results: [{ pageid: 20, ns: 0, title: 'Wise Old Man tasks' }] }],
    directSourceRequests: [],
    candidateSourcePages: pages,
    parentSectionContext: { heading: 'Easy task items', headingLine: 1, occurrenceLine: 2 },
    candidateParentContextObservations: membership,
    candidateScopedMembershipSignalObservations: membership,
    candidateScopedWeightSignalObservations: [],
    requiredChannelStatus: [
      { channel: 'candidate_subject_parent_task_relationship_statement', satisfiedByCapturedEvidence: observed, humanReviewRequired: false },
      { channel: 'candidate_scoped_weight_or_membership_statement', satisfiedByCapturedEvidence: observed, humanReviewRequired: false },
      { channel: 'explicit_source_bound_human_review', satisfiedByCapturedEvidence: false, humanReviewRequired: true }
    ],
    newEvidenceKeys: [candidateKey, parentKey].sort(),
    sourceSilenceIsNotNegativeEvidence: true,
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
    blockers: [],
    state: policy.inputState
  };
  return rehash(base);
}

const compiled = compileWeightedMembershipAdditionalEvidenceSufficiencyDispositionPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const exactPacket = packet('exact');
assert.equal(exactPinnedParentSectionEvidence(exactPacket).length, 1);
let built = buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({ evidencePackets: [exactPacket], policy, sourceSnapshotContentHash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionCoverageComplete, true);
assert.equal(built.audit.reviewRoutingCoverage.exact_parent_section_membership_review, 1);
assert.equal(built.audit.reviewRoutingCoverage.reviewReadyCount, 1);
assert.equal(built.audit.reviewRoutingCoverage.additionalEvidenceRequiredCount, 0);
assert.equal(built.records.length, 1);
assert.equal(built.records[0].reviewRoute, 'exact_parent_section_membership_review');
assert.equal(built.records[0].parentSectionEvidenceBindings.length, 1);
assert.equal(built.records[0].reviewDecision, null);
assert.equal(built.records[0].weightedTaskEntryMembershipVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing disposition field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing disposition audit field ${field}`);

const contextBuilt = buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({ evidencePackets: [packet('context')], policy, sourceSnapshotContentHash });
assert.equal(contextBuilt.audit.publishable, true);
assert.equal(contextBuilt.records[0].reviewRoute, 'candidate_relationship_context_review');
assert.equal(contextBuilt.records[0].parentSectionEvidenceBindings.length, 0);

const additionalBuilt = buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({ evidencePackets: [packet('additional')], policy, sourceSnapshotContentHash });
assert.equal(additionalBuilt.audit.publishable, true);
assert.equal(additionalBuilt.records[0].reviewRoute, 'additional_candidate_membership_evidence');
assert.deepEqual(additionalBuilt.records[0].allowedReviewDecisions, []);

const deterministic = buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({ evidencePackets: [structuredClone(exactPacket)], policy: structuredClone(policy), sourceSnapshotContentHash });
assert.deepEqual(deterministic, built);

let invalidPacket = structuredClone(exactPacket);
invalidPacket.contentHash = '0'.repeat(64);
let failed = buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({ evidencePackets: [invalidPacket], policy, sourceSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_source_discovery_packets_failed_revalidation'));

invalidPacket = structuredClone(exactPacket);
invalidPacket.candidateSourcePages[1].sourceText += ' drift';
invalidPacket = rehash(invalidPacket);
failed = buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({ evidencePackets: [invalidPacket], policy, sourceSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_source_discovery_packets_failed_revalidation'));

invalidPacket = structuredClone(exactPacket);
invalidPacket.candidateScopedMembershipSignalObservations[0].exactSectionTextContentHash = '0'.repeat(64);
invalidPacket = rehash(invalidPacket);
failed = buildWeightedMembershipAdditionalEvidenceSufficiencyDispositions({ evidencePackets: [invalidPacket], policy, sourceSnapshotContentHash });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_source_discovery_packets_failed_revalidation'));

const specific = structuredClone(policy);
specific.overrides = { Anchovies: 'member' };
assert.equal(compileWeightedMembershipAdditionalEvidenceSufficiencyDispositionPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileWeightedMembershipAdditionalEvidenceSufficiencyDispositionPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].weightedTaskEntryMembershipVerdict = 'member';
let audit = auditWeightedMembershipAdditionalEvidenceSufficiencyDisposition(promoted, { evidencePackets: [exactPacket], policy, sourceSnapshotContentHash });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('sufficiency_disposition_created_unsupported_review_semantic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentLevel = 34;
audit = auditWeightedMembershipAdditionalEvidenceSufficiencyDisposition(accountScoped, { evidencePackets: [exactPacket], policy, sourceSnapshotContentHash });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Weighted parent-task membership additional-evidence sufficiency disposition checks passed.');
