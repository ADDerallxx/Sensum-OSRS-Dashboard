import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { parseSkillTrainingGuideDirectLinks } from '../ingestion/skill-training-guide-direct-link-lib.mjs';
import {
  auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence,
  buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence,
  compileIndependentRepeatabilitySignalSubjectPredicateEvidencePolicy,
  discoverIndependentRepeatabilitySignalSubjectPredicateRevisionRequests,
  selectIndependentRepeatabilitySignalSubjectPredicateEvidenceRoutes
} from '../ingestion/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync(
  'platform/policies/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-v1.json',
  'utf8'
));
const recordContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-v1.json',
  'utf8'
));
const auditContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-audit-v1.json',
  'utf8'
));
const hash = value => createHash('sha256')
  .update(typeof value === 'string' ? value : JSON.stringify(value))
  .digest('hex');

const sourceLines = [
  'Intro.',
  'This unrelated task is repeatable after visiting [[Other page]].',
  'Block and unblock the chamber repeatedly until the score changes.',
  'End.'
];
const sourceText = sourceLines.join('\n');
const sourceHash = hash(sourceText);

function locatedSignal({ key, line, matchedText, definitionKey }) {
  const contextText = sourceLines[line - 1];
  const start = contextText.indexOf(matchedText) + 1;
  return {
    contextText,
    definitionKey,
    evidenceKey: key,
    matchedText,
    reviewState: 'candidate_only_not_a_repeatability_verdict',
    scannedTextHash: sourceHash,
    signalKind: 'explicit_positive_repeatability_declaration_candidate',
    sourceContentHash: sourceHash,
    sourceLocator: { columnStart: start, columnEnd: start + matchedText.length - 1, lineStart: line, lineEnd: line },
    sourcePageId: 200,
    sourceRevision: '2000',
    sourceScope: 'independent_discovery_candidate_pageid_200'
  };
}

const parsedLinks = parseSkillTrainingGuideDirectLinks({
  content: sourceText,
  sourcePageId: 200,
  title: 'Unrelated source',
  sourceRevision: '2000',
  sourceTimestamp: '2026-09-04T00:00:00Z',
  sourceUrl: 'https://oldschool.runescape.wiki/w/Unrelated_source',
  sourceContentHash: sourceHash,
  skillKeys: [],
  channels: ['independent_repeatability_source_discovery']
}).occurrences;

const linkedSignal = locatedSignal({
  key: 'member:example:signal:linked',
  line: 2,
  matchedText: 'repeatable',
  definitionKey: 'explicit_positive_repeatable_adjective'
});
const noLinkSignal = locatedSignal({
  key: 'member:example:signal:no-link',
  line: 3,
  matchedText: 'repeatedly',
  definitionKey: 'explicit_positive_repeatedly_adverb'
});

function scopePacket(signal, links) {
  return {
    signalEvidenceKey: signal.evidenceKey,
    sourceCandidate: {
      sourcePageId: 200,
      resolvedTitle: 'Unrelated source',
      sourceRevision: '2000',
      sourceTimestamp: '2026-09-04T00:00:00Z',
      sourceUrl: 'https://oldschool.runescape.wiki/w/Unrelated_source',
      sourceContentHash: sourceHash
    },
    sourceLocatedSignal: signal,
    exactLineSourceAuthoredMainNamespaceLinks: links,
    linkResolutionAssessments: [],
    resolvedTargetPages: [],
    stableIdentityComparisons: {
      signalSourcePageMatchesLinkedSubjectAnchor: false,
      signalSourcePageMatchesCollectionAnchor: false,
      linkedSubjectAnchorTargetOccurrenceKeys: [],
      collectionAnchorTargetOccurrenceKeys: [],
      signalSourceTargetOccurrenceKeys: []
    },
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    limitations: links.length ? [] : ['no_source_authored_main_namespace_link_on_exact_signal_line'],
    deficiencies: [],
    state: links.length
      ? 'complete_revision_pinned_exact_line_link_scope_evidence'
      : 'complete_no_source_authored_main_namespace_link_on_exact_signal_line'
  };
}

function routedSignal(signal, linked) {
  return {
    evidenceWorkComplete: false,
    policyRuleKind: 'signal_scope_disposition_state',
    requiredEvidenceDomains: linked
      ? ['stable_canonical_activity_identity_anchor', 'semantic_subject_predicate_binding']
      : ['canonical_activity_subject_declaration', 'repeatability_predicate_declaration'],
    routeKey: linked
      ? 'resolve_stable_activity_anchor_then_bind_repeatability_predicate'
      : 'collect_source_bound_subject_predicate_binding_without_exact_line_link',
    routeState: linked ? 'blocked_identity_and_semantic_scope_evidence_gap' : 'blocked_semantic_scope_evidence_gap',
    signalEvidenceKey: signal.evidenceKey,
    sourceState: linked
      ? 'blocked_exact_line_links_without_stable_identity_anchor'
      : 'blocked_no_exact_line_main_namespace_link_for_scope'
  };
}

const input = () => ({
  contract: 'sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence-work-routing.v1',
  memberCandidateKey: 'member:example',
  canonicalActivityIdentity: {
    canonicalActivityKey: 'activity:example',
    canonicalLabel: 'Example activity',
    stableIdentityAnchor: {
      canonicalActivityKey: 'activity:example',
      linkedSubjectPageId: 777,
      collectionPageId: 50,
      relationshipClass: 'component_of_collection_defined_activity_candidate'
    }
  },
  independentRepeatabilitySourceEvidence: { evidenceState: 'complete_revision_pinned_independent_repeatability_source_evidence_packet' },
  independentRepeatabilitySignalScopeEvidence: {
    evidenceState: 'complete_revision_pinned_independent_repeatability_signal_scope_evidence_packet',
    signalScopeEvidencePackets: [
      scopePacket(linkedSignal, parsedLinks.filter(link => link.sourceLocator.line === 2)),
      scopePacket(noLinkSignal, [])
    ]
  },
  independentRepeatabilitySignalScopeObservations: {
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null
  },
  independentRepeatabilitySignalScopeDisposition: {
    canonicalActivityScopeClassification: null,
    repeatabilityClassification: null
  },
  independentRepeatabilitySignalScopeEvidenceWorkRouting: {
    blockedRouteCount: 2,
    evidenceWorkComplete: false,
    queuedRouteCount: 0,
    signalDispositionCount: 2,
    signalEvidenceWorkRouteCount: 2,
    signalEvidenceWorkRoutes: [routedSignal(linkedSignal, true), routedSignal(noLinkSignal, false)],
    state: 'routed_all_signal_scope_evidence_obligations_downstream_gates_closed'
  },
  independentRepeatabilitySignalScopeEvidenceWorkReview: {
    canonicalActivityScopeClassification: null,
    evidenceWorkComplete: false,
    repeatabilityClassification: null,
    state: 'reviewed_routed_blocked'
  },
  repeatabilityDisposition: { state: 'unresolved', classification: null },
  corroboratingRepeatabilityDisposition: { state: 'unresolved', classification: null },
  memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
  mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
  optimizerEligible: false,
  accountIndependent: true,
  blockers: ['canonical_activity_scope_unresolved'],
  state: 'independent_repeatability_signal_scope_evidence_work_routed_but_scope_unresolved',
  contentHash: 'input-content-hash'
});

const fetchedPages = [{
  pageid: 200,
  ns: 0,
  title: 'Unrelated source',
  revisions: [{
    revid: 2000,
    timestamp: '2026-09-04T00:00:00Z',
    slots: { main: { content: sourceText } }
  }]
}];

const record = input();
assert.equal(selectIndependentRepeatabilitySignalSubjectPredicateEvidenceRoutes([record], policy).length, 1);
const requests = discoverIndependentRepeatabilitySignalSubjectPredicateRevisionRequests([record], policy);
assert.equal(requests.length, 1);
assert.equal(requests[0].sourceRevision, '2000');
assert.equal(requests[0].signalContexts.length, 2);

const built = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence({
  routingRecords: [record],
  fetchedPages,
  policy,
  contentHash: hash
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.subjectPredicateEvidenceAttemptCoverageComplete, true);
assert.equal(built.audit.independentSignalSubjectPredicateEvidenceCoverageComplete, true);
assert.equal(built.audit.revisionCoverage.requestedExactRevisionCount, 1);
assert.equal(built.audit.revisionCoverage.fetchedExactRevisionCount, 1);
assert.equal(built.audit.revisionCoverage.exactRevisionAlignedPacketCount, 2);
assert.equal(built.audit.signalCoverage.routedSignalCount, 2);
assert.equal(built.audit.signalCoverage.sourceBoundSubjectPredicateRouteCount, 1);
assert.equal(built.audit.signalCoverage.stableAnchorThenSemanticBindingRouteCount, 1);
assert.equal(built.audit.sourceLineCoverage.exactSourceLineRevalidatedCount, 2);
assert.equal(built.audit.sourceLineCoverage.exactPredicateSpanRevalidatedCount, 2);
assert.equal(built.audit.sourceLineCoverage.exactLineLinkSetRevalidatedCount, 2);
assert.equal(built.audit.sourceLineCoverage.expectedExactLineLinkOccurrenceCount, 1);
assert.equal(built.audit.sourceLineCoverage.revalidatedExactLineLinkOccurrenceCount, 1);
assert.equal(built.audit.stableIdentityObservationCoverage.stableActivityAnchorObservedPacketCount, 0);
assert.equal(built.audit.stableIdentityObservationCoverage.semanticSubjectBindingCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.repeatabilityVerdictCount, 0);
const output = built.records[0];
assert.equal(output.state, 'independent_repeatability_signal_subject_predicate_evidence_ready_for_semantic_disposition');
assert.equal(output.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets.length, 2);
for (const packet of output.independentRepeatabilitySignalSubjectPredicateEvidence.signalSubjectPredicateEvidencePackets) {
  assert.equal(packet.sourceRevisionVerification.exactAlignment, true);
  assert.equal(packet.exactSourceLineEvidence.exactContextMatch, true);
  assert.equal(packet.repeatabilityPredicateEvidence.exactMatch, true);
  assert.equal(packet.semanticBinding.canonicalActivitySubjectVerdict, null);
  assert.equal(packet.semanticBinding.repeatabilityPredicateVerdict, null);
  assert.equal(packet.semanticBinding.canonicalActivityScopeVerdict, null);
  assert.equal(packet.semanticBinding.repeatabilityVerdict, null);
}
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), 'Missing required record field: ' + field);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), 'Missing required audit field: ' + field);

const renamed = input();
renamed.canonicalActivityIdentity.canonicalLabel = 'A renamed display label';
const renamedBuilt = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence({
  routingRecords: [renamed], fetchedPages, policy, contentHash: hash
});
assert.deepEqual(
  renamedBuilt.records[0].independentRepeatabilitySignalSubjectPredicateEvidence,
  output.independentRepeatabilitySignalSubjectPredicateEvidence
);

const structuralAnchor = input();
structuralAnchor.canonicalActivityIdentity.stableIdentityAnchor.linkedSubjectPageId = 200;
const structuralAnchorBuilt = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence({
  routingRecords: [structuralAnchor], fetchedPages, policy, contentHash: hash
});
assert.equal(structuralAnchorBuilt.audit.publishable, true);
assert.equal(structuralAnchorBuilt.audit.stableIdentityObservationCoverage.stableActivityAnchorObservedPacketCount, 2);
assert.equal(structuralAnchorBuilt.audit.stableIdentityObservationCoverage.semanticSubjectBindingCount, 0);

const badContext = input();
badContext.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0].sourceLocatedSignal.contextText = 'Changed line.';
const badContextBuilt = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence({
  routingRecords: [badContext], fetchedPages, policy, contentHash: hash
});
assert.equal(badContextBuilt.audit.publishable, false);
assert.ok(badContextBuilt.audit.blockers.includes('one_or_more_signal_subject_predicate_evidence_records_incomplete'));

const badPredicate = input();
badPredicate.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[1].sourceLocatedSignal.sourceLocator.columnStart = 1;
const badPredicateBuilt = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence({
  routingRecords: [badPredicate], fetchedPages, policy, contentHash: hash
});
assert.equal(badPredicateBuilt.audit.publishable, false);

const missingRevision = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence({
  routingRecords: [record], fetchedPages: [], policy, contentHash: hash
});
assert.equal(missingRevision.audit.publishable, false);
assert.ok(missingRevision.audit.blockers.includes('exact_signal_source_revision_fetch_set_mismatch'));

const tamperedRecords = structuredClone(built.records);
tamperedRecords[0].independentRepeatabilitySignalSubjectPredicateEvidence
  .signalSubjectPredicateEvidencePackets[0].exactSourceLineEvidence.text = 'Tampered.';
const tampered = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence(tamperedRecords, {
  routingRecords: [record], fetchedPages, policy, contentHash: hash
});
assert.equal(tampered.publishable, false);
assert.ok(tampered.blockers.includes('one_or_more_subject_predicate_evidence_packets_do_not_match_inputs_and_fetched_revisions'));

const mutatedRecords = structuredClone(built.records);
mutatedRecords[0].independentRepeatabilitySignalScopeEvidenceWorkRouting.evidenceWorkComplete = true;
const mutated = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence(mutatedRecords, {
  routingRecords: [record], fetchedPages, policy, contentHash: hash
});
assert.equal(mutated.publishable, false);
assert.ok(mutated.blockers.includes('subject_predicate_evidence_collection_changed_upstream_evidence_routing_disposition_or_review'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].independentRepeatabilitySignalSubjectPredicateEvidence
  .signalSubjectPredicateEvidencePackets[0].semanticBinding.repeatabilityVerdict = 'repeatable';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence(promotedRecords, {
  routingRecords: [record], fetchedPages, policy, contentHash: hash
});
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('subject_predicate_evidence_created_unsupported_semantic_binding_scope_repeatability_or_downstream_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].preferences = { afk: true };
const accountScoped = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence(accountRecords, {
  routingRecords: [record], fetchedPages, policy, contentHash: hash
});
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_signal_subject_predicate_evidence'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.pageIds = [200];
const forbidden = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalSubjectPredicateEvidence({
  routingRecords: [record], fetchedPages, policy: forbiddenPolicy, contentHash: hash
});
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('signal_subject_predicate_evidence_policy_invalid_or_incomplete'));

const compiled = compileIndependentRepeatabilitySignalSubjectPredicateEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Independent revision-pinned repeatability signal subject-predicate evidence checks passed.');
