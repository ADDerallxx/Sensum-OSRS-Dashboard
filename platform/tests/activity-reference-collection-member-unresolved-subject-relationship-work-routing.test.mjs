import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes,
  buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes
} from '../transforms/activity-reference-collection-member-unresolved-subject-relationship-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-unresolved-subject-relationship-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-unresolved-subject-relationship-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-unresolved-subject-relationship-work-routing-audit-v1.json', 'utf8'));

function disposition({ key, subjectClass, state = 'source_signature_supported', collectionLabel = 'Display label' }) {
  const pageId = 100 + key.length;
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    sourceSignatureContentHash: `signature-${key}`,
    sourceRoutingContentHash: `routing-${key}`,
    sourceMemberDispositionContentHash: `member-disposition-${key}`,
    sourceMemberEvidenceContentHash: `member-evidence-${key}`,
    collectionContext: { memberCellEvidence: { plainText: collectionLabel }, memberLinks: [{ requestedTitle: `Example ${key}`, displayText: collectionLabel }] },
    memberIdentityContexts: [{ pageId, resolvedTitle: `Example ${key}`, observedRevision: `200${key.length}` }],
    sourcePageId: pageId,
    resolvedTitle: `Example ${key}`,
    membershipClassification: 'minigame_like_activity',
    sourceRevision: `200${key.length}`,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    sourceSignatureEvidenceSummary: { rootTemplateCount: 1, sourceAuthoredLinkOccurrenceCount: 2 },
    dispositionSignals: [{ signalKind: 'exact_mapped_root_template', template: 'Infobox Example', sourcePageSubjectClass: subjectClass }],
    sourcePageSubjectDisposition: { state, disposition: state === 'source_signature_supported' ? subjectClass : null, conflictingDispositions: state.startsWith('blocked_') ? ['activity_page', 'npc_page'] : [], evidenceKeys: [`${key}:1`] },
    sourceBlockers: ['source-blocker'],
    sourceSignatureBlockers: ['signature-blocker'],
    collectionActivityIdentityReview: { state: 'unreviewed', identity: null, evidenceKeys: [] },
    linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['source_page_subject_class_does_not_establish_collection_activity_identity'],
    state: 'source_page_subject_disposed_collection_activity_unresolved',
    contentHash: `disposition-${key}`
  };
}

const inputs = [
  disposition({ key: 'activity', subjectClass: 'activity_page' }),
  disposition({ key: 'npc', subjectClass: 'npc_page' }),
  disposition({ key: 'scenery', subjectClass: 'scenery_object_page' })
];
const built = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes({ dispositionRecords: inputs, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.routingCoverage.routedCount, 3);
assert.equal(built.audit.routingCoverage.queuedCount, 3);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 0);
assert.equal(built.records[0].routingDecision.routeKey, 'activity_page_scope_repeatability_and_collection_relationship_review');
assert.equal(built.records[1].routingDecision.routeKey, 'npc_subject_collection_activity_relationship_review');
assert.equal(built.records[2].routingDecision.routeKey, 'scenery_subject_collection_activity_relationship_review');
assert.ok(built.records.every(record => record.routingDecision.policyRuleKind === 'source_page_subject_class' && record.optimizerEligible === false && record.collectionActivityIdentityReview.state === 'unreviewed'));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const relabelled = disposition({ key: 'activity', subjectClass: 'activity_page', collectionLabel: 'Completely different collection label' });
assert.deepEqual(
  buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes({ dispositionRecords: [relabelled], policy }).records[0].routingDecision,
  built.records[0].routingDecision,
  'Collection labels must not select or alter relationship-work routing.'
);

const blockedInput = disposition({ key: 'blocked', subjectClass: 'npc_page', state: 'blocked_conflicting_mapped_root_template_classes' });
const blocked = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes({ dispositionRecords: [blockedInput], policy });
assert.equal(blocked.records[0].routingDecision.policyRuleKind, 'disposition_state');
assert.equal(blocked.records[0].routingDecision.routeKey, 'source_page_subject_class_conflict_reconciliation');
assert.equal(blocked.records[0].routingDecision.routeState, 'blocked_source_page_class_conflict');

const unknownClass = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes({ dispositionRecords: [disposition({ key: 'unknown', subjectClass: 'future_page_class' })], policy });
assert.equal(unknownClass.audit.publishable, false);
assert.deepEqual(unknownClass.audit.policyCoverage.unmappedSourcePageSubjectClasses, ['future_page_class']);

const unknownStateInput = disposition({ key: 'unknown-state', subjectClass: null, state: 'blocked_future_state' });
const unknownState = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes({ dispositionRecords: [unknownStateInput], policy });
assert.equal(unknownState.audit.publishable, false);
assert.deepEqual(unknownState.audit.policyCoverage.unmappedDispositionStates, ['blocked_future_state']);

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.collectionClasses = ['minigame_like_activity'];
const forbidden = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes({ dispositionRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_collection_class_or_override_relationship_routing_policy_forbidden'));

const invalidPolicy = structuredClone(policy);
invalidPolicy.subjectClassRoutes.activity_page.routeState = 'blocked_wrong';
const invalid = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes({ dispositionRecords: inputs, policy: invalidPolicy });
assert.equal(invalid.audit.publishable, false);
assert.ok(invalid.audit.blockers.includes('one_or_more_relationship_work_route_definitions_invalid'));

const alteredContextRecords = structuredClone(built.records);
alteredContextRecords[0].sourceSignatureContentHash = 'changed';
const alteredContext = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes(alteredContextRecords, { dispositionRecords: inputs, policy });
assert.equal(alteredContext.publishable, false);
assert.ok(alteredContext.blockers.includes('one_or_more_input_hash_identity_revision_disposition_signal_collection_membership_or_alias_contexts_changed'));

const alteredRouteRecords = structuredClone(built.records);
alteredRouteRecords[0].routingDecision.routeKey = 'different_route';
const alteredRoute = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes(alteredRouteRecords, { dispositionRecords: inputs, policy });
assert.equal(alteredRoute.publishable, false);
assert.ok(alteredRoute.blockers.includes('one_or_more_relationship_work_routing_decisions_do_not_match_policy'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].linkedSubjectRelationshipReview.state = 'reviewed';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes(promotedRecords, { dispositionRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].accountState = { level: 34 };
const accountScoped = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipWorkRoutes(accountRecords, { dispositionRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_relationship_work_routes'));

console.log('Generic unresolved collection-member relationship-work routing checks passed.');
