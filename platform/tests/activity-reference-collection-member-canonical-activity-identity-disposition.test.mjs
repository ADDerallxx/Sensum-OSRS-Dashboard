import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions,
  buildActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions,
  compileCanonicalActivityIdentityDispositionPolicy
} from '../transforms/activity-reference-collection-member-canonical-activity-identity-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-canonical-activity-identity-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-identity-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-identity-disposition-audit-v1.json', 'utf8'));

function evidence({ key, label, title, collectionPageId, sourcePageId, relationshipClass, collectionRevision = '15327496', sourceRevision = '200', rowOrdinal = 1 }) {
  const identitySignal = { evidenceKey: `${key}:identity`, signalKind: 'dual_source_collection_activity_identity_candidate' };
  const sourceRoleSignal = {
    evidenceKey: `${key}:source-role`,
    matchedDeclarations: [{ sourceLocator: { lineStart: 20, lineEnd: 20 }, rawText: 'Source declaration', plainText: 'Source declaration', matchedText: 'Source declaration' }]
  };
  const relationshipSignal = { evidenceKey: `${key}:relationship`, signalKind: 'generic_linked_subject_collection_activity_relationship' };
  const identity = { identityClass: 'collection_row_defined_activity_candidate', collectionActivityLabel: label, canonicalIdentityEstablished: false };
  const memberCell = { plainText: label, sourceLocator: { lineStart: 10, lineEnd: 10 } };
  const narrativeCell = { plainText: 'Players perform this source-defined activity.', sourceLocator: { lineStart: 11, lineEnd: 11 } };
  const relationship = {
    relationshipClass,
    subject: { sourcePageId, resolvedTitle: title, sourceRevision, sourceContentHash: `${key}:source-hash` },
    activityCandidate: identity,
    canonicalIdentityEstablished: false
  };
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    resolvedTitle: title,
    canonicalActivityIdentityEvidence: {
      collectionDefinition: {
        collectionSource: { pageId: collectionPageId, revision: collectionRevision, contentHash: `${key}:collection-hash` },
        rowEvidence: { sourceRowOrdinal: rowOrdinal, sourceLocator: { lineStart: 10, lineEnd: 11 } },
        memberCellEvidence: memberCell,
        narrativeCellEvidence: [narrativeCell],
        allRowCellEvidence: [memberCell, narrativeCell],
        directRowWikilinkEvidence: [{ requestedTitle: title, sourceLocator: { lineStart: 10, lineEnd: 10 } }]
      },
      collectionActivityCandidate: {
        disposition: { state: 'source_supported_collection_activity_candidate' },
        dispositionSignals: [identitySignal],
        review: { state: 'reviewed_source_supported_candidate', identity, evidenceKeys: [identitySignal.evidenceKey] }
      },
      linkedSubjectRelationship: {
        sourcePage: { sourcePageId, resolvedTitle: title, sourceRevision, sourceContentHash: `${key}:source-hash` },
        sourceRoleDispositionSignals: [sourceRoleSignal],
        relationshipDisposition: { state: 'source_supported_linked_subject_relationship', relationshipClass },
        relationshipDispositionSignals: [relationshipSignal],
        review: { state: 'reviewed_source_supported', relationships: [relationship], evidenceKeys: [relationshipSignal.evidenceKey] }
      },
      crossSourceAlignment: {
        memberLinkSourceTitleAlignments: [{ evidenceState: 'aligned' }],
        stableSourceIdentityAlignments: [{ evidenceState: 'aligned' }],
        sharedMainNamespaceLinkTargets: []
      },
      evidenceState: 'complete_revision_pinned_canonical_activity_identity_review_packet'
    },
    canonicalActivityIdentityCandidateObservations: {
      collectionActivityLabel: label,
      linkedSourceTitle: title,
      exactNormalizedCollectionLabelSourceTitleMatch: label.toLowerCase() === title.toLowerCase(),
      sourcePageRelationshipClass: relationshipClass,
      possibleDedicatedActivityPageObservation: false,
      collectionScopedActivityIdentityAnchor: { collectionPageId, collectionRevision, sourceRowOrdinal: rowOrdinal },
      deficiencies: [],
      canonicalActivityIdentityVerdict: null,
      observationState: 'identity_review_observations_only_not_a_canonical_identity'
    },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed' },
    memberExpansionReview: { state: 'unreviewed' },
    mechanicsReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['identity-disposition-pending'],
    contentHash: `${key}:evidence-hash`
  };
}

const inputs = [
  evidence({ key: 'component', label: 'Archery Competition', title: 'Target (Ranging Guild)', collectionPageId: 2078, sourcePageId: 308573, relationshipClass: 'component_of_collection_defined_activity_candidate' }),
  evidence({ key: 'provider', label: 'Aldarin Vineyard', title: 'Vineyard foreman', collectionPageId: 2078, sourcePageId: 9001, relationshipClass: 'task_provider_for_collection_defined_activity_candidate' }),
  evidence({ key: 'description', label: 'Wise Old Man tasks', title: 'Wise Old Man tasks', collectionPageId: 2078, sourcePageId: 9002, relationshipClass: 'source_page_describes_collection_defined_activity_candidate' })
];
const built = buildActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions({ identityEvidenceRecords: inputs, policy });

assert.equal(built.audit.publishable, true);
assert.equal(built.audit.identityDispositionAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivityIdentityReviewComplete, true);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.canonicalActivityIdentityDispositionCoverage.sourceSupportedCount, 3);
assert.equal(built.audit.canonicalActivityIdentityDispositionCoverage.conflictingCount, 0);
assert.equal(built.audit.canonicalActivityIdentityDispositionCoverage.unresolvedCount, 0);
assert.equal(built.audit.canonicalActivityIdentityDispositionCoverage.stableCanonicalActivityKeyCount, 3);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivityIdentityCount, 3);
assert.equal(built.audit.semanticPromotionCoverage.canonicalGameEntityIdentityCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.linkedSubjectEquatedWithCanonicalActivityCount, 0);
assert.ok(built.records.every(record =>
  record.canonicalActivityIdentityReview.state === 'reviewed_source_supported'
  && record.canonicalActivityIdentity.linkedSubjectIsCanonicalActivity === false
  && record.repeatabilityReview.state === 'unreviewed'
  && record.optimizerEligible === false
));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = buildActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions({
  identityEvidenceRecords: [evidence({ key: 'renamed', label: 'Renamed activity', title: 'Renamed source', collectionPageId: 2078, sourcePageId: 308573, relationshipClass: 'component_of_collection_defined_activity_candidate', collectionRevision: '99999999', sourceRevision: '88888888', rowOrdinal: 99 })],
  policy
});
assert.equal(renamed.audit.publishable, true);
assert.equal(renamed.records[0].canonicalActivityIdentity.canonicalActivityKey, built.records[0].canonicalActivityIdentity.canonicalActivityKey);

const incompleteInputs = structuredClone(inputs);
incompleteInputs[0].canonicalActivityIdentityEvidence.collectionDefinition.narrativeCellEvidence = [];
incompleteInputs[0].contentHash = 'incomplete-evidence';
const incomplete = buildActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions({ identityEvidenceRecords: incompleteInputs, policy });
assert.equal(incomplete.records[0].canonicalActivityIdentityDisposition.state, 'unresolved_incomplete_canonical_activity_identity_evidence');
assert.equal(incomplete.records[0].canonicalActivityIdentity, null);
assert.equal(incomplete.audit.canonicalActivityIdentityReviewComplete, false);

const collisionInputs = [structuredClone(inputs[0]), structuredClone(inputs[0])];
collisionInputs[1].memberCandidateKey = 'component-collision';
collisionInputs[1].contentHash = 'collision-evidence';
const collision = buildActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions({ identityEvidenceRecords: collisionInputs, policy });
assert.ok(collision.records.every(record => record.canonicalActivityIdentityDisposition.state === 'blocked_duplicate_stable_canonical_activity_identity_anchor'));
assert.equal(collision.audit.canonicalActivityIdentityReviewComplete, false);

const conflictingPolicy = structuredClone(policy);
conflictingPolicy.identityDispositionRules.push({
  ...conflictingPolicy.identityDispositionRules[0],
  ruleKey: 'competing_component_identity',
  canonicalIdentityClass: 'different_collection_activity_identity'
});
const conflicting = buildActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions({ identityEvidenceRecords: inputs, policy: conflictingPolicy });
assert.equal(conflicting.records[0].canonicalActivityIdentityDisposition.state, 'blocked_conflicting_canonical_activity_identity_signals');

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { component: 'canonical' };
const forbidden = buildActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions({ identityEvidenceRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_class_canonical_activity_identity_disposition_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].canonicalActivityIdentity.canonicalActivityKey = 'altered';
const altered = auditActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions(alteredRecords, { identityEvidenceRecords: inputs, policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_canonical_activity_identity_dispositions_not_supported_by_complete_generic_evidence'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].canonicalActivityIdentity.linkedSubjectIsCanonicalActivity = true;
promotedRecords[0].repeatabilityReview.state = 'reviewed';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions(promotedRecords, { identityEvidenceRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_linked_subject_equivalence_game_entity_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberCanonicalActivityIdentityDispositions(accountRecords, { identityEvidenceRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_canonical_activity_identity_dispositions'));

const compiled = compileCanonicalActivityIdentityDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRuleKeys, []);
assert.deepEqual(compiled.duplicateRuleKeys, []);
assert.deepEqual(compiled.missingRequiredPolicyRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Generic canonical-activity identity-disposition checks passed.');
