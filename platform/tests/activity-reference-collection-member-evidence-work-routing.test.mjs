import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberEvidenceWorkRoutes,
  buildActivityReferenceCollectionMemberEvidenceWorkRoutes
} from '../transforms/activity-reference-collection-member-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-evidence-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-evidence-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-evidence-work-routing-audit-v1.json', 'utf8'));

const dispositionRecord = ({ key = '1', disposition = 'minigame_subject', state = 'source_supported', conflicts = [], classification = 'official_minigame' } = {}) => ({
  contract: 'sensum.activity-reference-collection-member-subject-disposition.v1',
  memberCandidateKey: `member:${key}`,
  sourceMemberEvidenceContentHash: `evidence-${key}`,
  collectionContext: {
    collectionCandidateKey: 'osrs-wiki-pageid:2078',
    membershipClassification: classification,
    memberCellEvidence: { plainText: `Display ${key}` },
    memberLinks: [{ occurrence: 1, requestedTitle: `Example ${key}` }]
  },
  memberIdentityContexts: [{ pageId: Number(key), resolvedTitle: `Example ${key}`, observedRevision: `10${key}` }],
  sourcePageId: Number(key),
  resolvedTitle: `Example ${key}`,
  membershipClassification: classification,
  sourceRevision: `10${key}`,
  sourceTimestamp: '2026-09-04T00:00:00Z',
  sourceUrl: `https://example.test/${key}`,
  sourceContentHash: `source-${key}`,
  sourceEvidenceBlockers: ['source_evidence_requires_semantic_review'],
  infoboxTypeAssessment: { present: true, normalizedValue: 'minigame', mapped: true, disposition: 'minigame_subject' },
  leadParagraphSelection: { sourceParagraphIndex: 0, rawText: 'Example', plainText: 'Example', sourceLocator: { lineStart: 5, lineEnd: 5 } },
  dispositionSignals: [{ signalKind: 'infobox_type_parameter', signalKey: 'type', disposition: disposition || conflicts[0], sourceLocator: { lineStart: 2, lineEnd: 2 } }],
  subjectDisposition: { state, disposition, conflictingDispositions: conflicts },
  repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
  memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
  canonicalGameEntityIdentity: null,
  canonicalActivityIdentity: null,
  optimizerEligible: false,
  accountIndependent: true,
  blockers: ['canonical_activity_identity_not_established'],
  state: state === 'source_supported' ? 'subject_disposition_ready' : 'blocked',
  contentHash: `disposition-${key}`
});

const inputs = [
  dispositionRecord(),
  dispositionRecord({ key: '2', disposition: 'facility_subject', classification: 'minigame_like_activity' }),
  dispositionRecord({ key: '3', disposition: null, state: 'blocked_conflicting_source_declarations', conflicts: ['activity_subject', 'minigame_subject'] }),
  dispositionRecord({ key: '4', disposition: null, state: 'unresolved_no_supported_source_declaration', conflicts: [] })
];
const built = buildActivityReferenceCollectionMemberEvidenceWorkRoutes({ dispositionRecords: inputs, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.routingCoverage.routedCount, 4);
assert.equal(built.audit.routingCoverage.queuedCount, 2);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 2);
assert.equal(built.records[0].routingDecision.routeKey, 'minigame_session_and_mode_review');
assert.equal(built.records[1].routingDecision.routeKey, 'facility_activity_member_discovery_review');
assert.equal(built.records[2].routingDecision.routeKey, 'source_declaration_conflict_reconciliation');
assert.equal(built.records[2].routingDecision.routeState, 'blocked_source_conflict');
assert.equal(built.records[3].routingDecision.routeKey, 'broader_source_signature_subject_review');
assert.equal(built.records[3].routingDecision.routeState, 'blocked_unsupported_subject_declaration');
assert.deepEqual(built.records[0].routingDecision, buildActivityReferenceCollectionMemberEvidenceWorkRoutes({ dispositionRecords: [dispositionRecord({ classification: 'minigame_like_activity' })], policy }).records[0].routingDecision);
assert.equal(built.records[0].canonicalActivityIdentity, null);
assert.equal(built.records[0].optimizerEligible, false);
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const unknownDisposition = buildActivityReferenceCollectionMemberEvidenceWorkRoutes({ dispositionRecords: [dispositionRecord({ key: '5', disposition: 'unknown_subject' })], policy });
assert.equal(unknownDisposition.audit.publishable, false);
assert.deepEqual(unknownDisposition.audit.policyCoverage.unmappedSubjectDispositions, ['unknown_subject']);

const unknownState = buildActivityReferenceCollectionMemberEvidenceWorkRoutes({ dispositionRecords: [dispositionRecord({ key: '6', disposition: null, state: 'blocked_future_state' })], policy });
assert.equal(unknownState.audit.publishable, false);
assert.deepEqual(unknownState.audit.policyCoverage.unmappedSourceStates, ['blocked_future_state']);

const collectionSpecificPolicy = structuredClone(policy);
collectionSpecificPolicy.membershipClassifications = ['official_minigame'];
const forbidden = buildActivityReferenceCollectionMemberEvidenceWorkRoutes({ dispositionRecords: [inputs[0]], policy: collectionSpecificPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_collection_class_or_override_routing_policy_forbidden'));

const invalidPolicy = structuredClone(policy);
invalidPolicy.stateRoutes.blocked_conflicting_source_declarations.routeState = 'queued';
const invalid = buildActivityReferenceCollectionMemberEvidenceWorkRoutes({ dispositionRecords: [inputs[2]], policy: invalidPolicy });
assert.equal(invalid.audit.publishable, false);
assert.ok(invalid.audit.blockers.includes('one_or_more_policy_route_definitions_invalid'));

const alteredContextRecords = structuredClone(built.records);
alteredContextRecords[0].memberIdentityContexts = [];
const alteredContext = auditActivityReferenceCollectionMemberEvidenceWorkRoutes(alteredContextRecords, { dispositionRecords: inputs, policy });
assert.equal(alteredContext.publishable, false);
assert.ok(alteredContext.blockers.includes('one_or_more_identity_revision_hash_disposition_signal_collection_or_alias_context_values_changed'));

const alteredRouteRecords = structuredClone(built.records);
alteredRouteRecords[0].routingDecision.routeKey = 'different_route';
const alteredRoute = auditActivityReferenceCollectionMemberEvidenceWorkRoutes(alteredRouteRecords, { dispositionRecords: inputs, policy });
assert.equal(alteredRoute.publishable, false);
assert.ok(alteredRoute.blockers.includes('one_or_more_member_routing_decisions_do_not_match_policy'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberEvidenceWorkRoutes(promotedRecords, { dispositionRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_canonical_repeatability_member_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].accountState = { level: 34 };
const accountInjected = auditActivityReferenceCollectionMemberEvidenceWorkRoutes(accountRecords, { dispositionRecords: inputs, policy });
assert.equal(accountInjected.publishable, false);
assert.ok(accountInjected.blockers.includes('account_query_state_baked_into_member_evidence_work_routes'));

console.log('Generic collection-member evidence-work routing checks passed.');
