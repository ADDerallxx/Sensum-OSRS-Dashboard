import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditWeightedMembershipAdditionalEvidenceSourceDiscovery,
  buildWeightedMembershipAdditionalEvidenceDirectSourceRequests,
  buildWeightedMembershipAdditionalEvidenceDiscoveryQueries,
  buildWeightedMembershipAdditionalEvidenceSourceDiscovery,
  compileWeightedMembershipAdditionalEvidenceSourceDiscoveryPolicy,
  deriveWeightedMembershipParentSectionContext,
  discoverWeightedMembershipCandidateRequests,
  structuredCandidateReferencePresent
} from '../ingestion/weighted-parent-task-entry-membership-additional-evidence-source-discovery-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-additional-evidence-source-discovery-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-source-discovery-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-additional-evidence-source-discovery-audit-v1.json', 'utf8'));
const sourceQueueSnapshotContentHash = 'a'.repeat(64);
const candidateContent = '{{Infobox Item\n|name = Anchovies\n|id = 319\n}}\nAnchovies are a food item.';
const parentContent = 'The Wise Old Man can assign tasks.\n\n==Item tasks==\n{|\n|{{plink|Anchovies}}||{{plink|Bones}}\n|}';

function identity(pageId, title, revision, timestamp, content, roles) {
  return {
    sourceKey: `wiki-pageid:${pageId}|revision:${revision}`,
    roles,
    resolvedTitle: title,
    sourceContentBytes: new TextEncoder().encode(content).length,
    sourceContentHash: hash(content),
    sourcePageId: pageId,
    sourceRevision: revision,
    sourceTimestamp: timestamp,
    sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`
  };
}

function queueRecord(role = 'item_delivery_target_candidate') {
  const candidate = identity(10, 'Anchovies', '100', '2026-01-01T00:00:00Z', candidateContent, ['candidate_subject_source']);
  const parent = identity(20, 'Wise Old Man tasks', '200', '2026-01-02T00:00:00Z', parentContent, ['parent_inventory_source']);
  const base = {
    contract: policy.inputContract,
    queueEntryKey: 'work:1',
    queueOrdinal: 1,
    sourceDispositionRecordContentHash: hash('disposition-record'),
    sourceEvidenceRecordContentHash: hash('evidence-record'),
    sourceDispositionKey: 'disposition:1',
    sourceEvidencePacketKey: 'packet:1',
    sourceEvidencePacketContentHash: hash('evidence-packet'),
    evidenceFingerprint: hash('fingerprint'),
    structuralCandidateKey: 'candidate:1',
    candidateRole: role,
    candidateDisplay: {
      value: 'Anchovies',
      source: { kind: 'retained_revision_pinned_candidate_subject_source_title', sourceKey: candidate.sourceKey, sourcePageId: 10, sourceRevision: '100', sourceContentHash: hash(candidateContent) }
    },
    evidenceSourceIdentities: [candidate, parent],
    sourceRevisions: ['100', '200'],
    retainedEvidenceState: {
      route: 'additional_candidate_membership_evidence_required',
      evidenceCounts: {},
      parentOccurrence: {
        occurrence: {
          exactSourceText: '{{plink|Anchovies}}',
          exactSourceTextContentHash: hash('{{plink|Anchovies}}'),
          sourceContentHash: hash(parentContent),
          sourceLocator: { lineStart: 5, lineEnd: 5, columnStart: 2, columnEnd: 22 },
          sourcePageId: 20,
          sourceRevision: '200'
        },
        exactSourceLine: '|{{plink|Anchovies}}||{{plink|Bones}}',
        integrity: { checks: {}, complete: true, exactSourceLine: '|{{plink|Anchovies}}||{{plink|Bones}}' }
      },
      candidateScopedWeightStatements: [],
      candidateSubjectCorroborations: [],
      nonCandidateParentContext: { globalWeightStatements: [], distributionStatements: [], candidateMembershipProof: false }
    },
    requiredEvidenceChannels: [...policy.discovery.requiredAdditionalEvidenceChannels],
    sourceSilenceIsNotNegativeEvidence: true,
    weightedTaskEntryMembershipVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.inputState
  };
  return { ...base, contentHash: hash(base) };
}

function page(pageid, title, revision, timestamp, content, ns = 0) {
  return { pageid, ns, title, revisions: [{ revid: Number(revision), timestamp, slots: { main: { content } } }] };
}

function fixture() {
  const record = queueRecord();
  const pinnedRevisionPages = [
    page(10, 'Anchovies', '100', '2026-01-01T00:00:00Z', candidateContent),
    page(20, 'Wise Old Man tasks', '200', '2026-01-02T00:00:00Z', parentContent)
  ];
  const queries = buildWeightedMembershipAdditionalEvidenceDiscoveryQueries(record, policy, pinnedRevisionPages);
  const searchResponses = queries.map(query => ({
    ...query,
    totalHits: 1,
    returnedCount: 1,
    continuationExhausted: true,
    truncated: false,
    results: [{ pageid: 20, ns: 0, title: 'Wise Old Man tasks', size: 100, wordcount: 20, timestamp: '2026-02-01T00:00:00Z', snippet: 'Anchovies and tasks', rank: 1 }]
  }));
  const requests = discoverWeightedMembershipCandidateRequests(record, searchResponses);
  const contents = new Map([['Anchovies', candidateContent], ['Wise Old Man tasks', parentContent]]);
  const ids = new Map([['Anchovies', 10], ['Wise Old Man tasks', 20]]);
  const fetchedResolutions = requests.map((request, index) => {
    const content = contents.get(request.requestedTitle);
    return {
      requestedTitle: request.requestedTitle,
      normalizedTitle: request.requestedTitle,
      resolvedTitle: request.requestedTitle,
      page: page(ids.get(request.requestedTitle), request.requestedTitle, String(300 + index), '2026-02-01T00:00:00Z', content),
      redirected: false
    };
  });
  return {
    workQueueRecords: [record],
    pinnedRevisionPages,
    discoveryResponses: [{ workQueueEntryKey: record.queueEntryKey, searchResponses }],
    candidateRequests: [{ workQueueEntryKey: record.queueEntryKey, requests }],
    fetchedResolutions,
    policy,
    sourceQueueSnapshotContentHash
  };
}

const compiled = compileWeightedMembershipAdditionalEvidenceSourceDiscoveryPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const args = fixture();
const record = args.workQueueRecords[0];
assert.equal(deriveWeightedMembershipParentSectionContext(record, args.pinnedRevisionPages).heading, 'Item tasks');
assert.equal(buildWeightedMembershipAdditionalEvidenceDiscoveryQueries(record, policy, args.pinnedRevisionPages).length, 3);
assert.equal(buildWeightedMembershipAdditionalEvidenceDirectSourceRequests(record).length, 2);
assert.equal(buildWeightedMembershipAdditionalEvidenceDirectSourceRequests(queueRecord('message_delivery_recipient_candidate')).length, 3);
assert.equal(structuredCandidateReferencePresent('{{plink|Beer}}', 'Beer'), true);
assert.equal(structuredCandidateReferencePresent('{{plink|Beer glass}}', 'Beer'), false);
assert.equal(structuredCandidateReferencePresent('[[Leather gloves]]', 'Leather'), false);

const built = buildWeightedMembershipAdditionalEvidenceSourceDiscovery(args);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.candidateSpecificMembershipEvidenceComplete, true);
assert.equal(built.audit.weightedMembershipReviewComplete, false);
assert.equal(built.audit.inputCoverage.completeInputWorkQueueEntryCount, 1);
assert.equal(built.audit.pinnedSourceIntegrityCoverage.revalidatedPinnedSourceCount, 2);
assert.equal(built.audit.discoveryCoverage.queryCount, 3);
assert.equal(built.audit.discoveryCoverage.completeQueryCount, 3);
assert.ok(built.audit.sourceObservationCoverage.candidateParentContextObservationCount > 0);
assert.ok(built.audit.sourceObservationCoverage.candidateScopedMembershipSignalObservationCount > 0);
assert.equal(built.audit.sourceObservationCoverage.candidateScopedWeightSignalObservationCount, 0);
assert.equal(built.audit.requiredChannelCoverage.allEvidenceChannelsObserved, true);
assert.equal(built.audit.requiredChannelCoverage.allChannelsSatisfied, false);
assert.equal(built.records.length, 1);
assert.ok(built.records[0].newEvidenceKeys.length > 0);
assert.equal(built.records[0].parentMembershipVerdict, null);
assert.equal(built.records[0].weightedTaskEntryMembershipVerdict, null);
assert.equal(built.records[0].optimizerEligible, false);
assert.ok(built.records[0].blockers.includes('explicit_source_bound_human_review_pending'));
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing source discovery field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing source discovery audit field ${field}`);

const deterministic = buildWeightedMembershipAdditionalEvidenceSourceDiscovery(structuredClone(args));
assert.deepEqual(deterministic, built);

let invalid = structuredClone(args);
invalid.workQueueRecords[0].contentHash = '0'.repeat(64);
let failed = buildWeightedMembershipAdditionalEvidenceSourceDiscovery(invalid);
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_input_work_queue_entries_failed_revalidation'));

invalid = structuredClone(args);
invalid.pinnedRevisionPages[0].revisions[0].slots.main.content += ' drift';
failed = buildWeightedMembershipAdditionalEvidenceSourceDiscovery(invalid);
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_pinned_sources_failed_exact_revision_revalidation'));

invalid = structuredClone(args);
invalid.discoveryResponses[0].searchResponses[0].truncated = true;
invalid.discoveryResponses[0].searchResponses[0].continuationExhausted = false;
failed = buildWeightedMembershipAdditionalEvidenceSourceDiscovery(invalid);
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_source_searches_missing_truncated_or_mismatched'));

invalid = structuredClone(args);
invalid.fetchedResolutions.pop();
failed = buildWeightedMembershipAdditionalEvidenceSourceDiscovery(invalid);
assert.equal(failed.audit.publishable, false);
assert.equal(failed.records.length, 0);
assert.ok(failed.audit.blockers.includes('one_or_more_discovered_or_direct_source_pages_failed_revision_capture'));

const specific = structuredClone(policy);
specific.overrides = { Anchovies: 'member' };
assert.equal(compileWeightedMembershipAdditionalEvidenceSourceDiscoveryPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileWeightedMembershipAdditionalEvidenceSourceDiscoveryPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].parentMembershipVerdict = 'member';
let audit = auditWeightedMembershipAdditionalEvidenceSourceDiscovery(promoted, args);
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('source_discovery_created_unsupported_review_semantic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentLevel = 34;
audit = auditWeightedMembershipAdditionalEvidenceSourceDiscovery(accountScoped, args);
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Weighted parent-task membership additional-evidence source discovery checks passed.');
