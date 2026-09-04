import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions,
  buildActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions,
  compileLinkedSubjectRelationshipDispositionPolicy
} from '../transforms/activity-reference-collection-member-linked-subject-relationship-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-linked-subject-relationship-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-linked-subject-relationship-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-linked-subject-relationship-disposition-audit-v1.json', 'utf8'));

function input({ key, label, sourceTitle, role, declarations = 1 }) {
  const sourceRelationshipDispositionSignals = [{
    evidenceKey: `${key}:source-role`,
    relationshipClass: role,
    matchedDeclarations: Array.from({ length: declarations }, (_, index) => ({
      sourceLocator: { lineStart: 20 + index, lineEnd: 20 + index },
      rawText: `Source declaration ${index + 1}`,
      plainText: `Source declaration ${index + 1}`,
      matchedText: `Source declaration ${index + 1}`
    }))
  }];
  const identitySignal = {
    evidenceKey: `${key}:collection-activity-identity`,
    signalKind: 'dual_source_collection_activity_identity_candidate',
    identityClass: 'collection_row_defined_activity_candidate',
    linkedSourceRelationshipClass: role,
    linkedSourceRelationshipEvidenceKeys: [`${key}:source-role`],
    memberLinkSourceTitleAlignments: [{ evidenceState: 'aligned' }],
    stableSourceIdentityAlignments: [{ evidenceState: 'aligned' }]
  };
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    sourceRelationshipDispositionContentHash: `relationship-disposition-${key}`,
    sourceRelationshipEvidenceContentHash: `relationship-evidence-${key}`,
    sourceRelationshipRoutingContentHash: `relationship-routing-${key}`,
    sourceSignatureDispositionContentHash: `signature-disposition-${key}`,
    sourceSignatureContentHash: `signature-${key}`,
    sourceRoutingContentHash: `routing-${key}`,
    sourceMemberDispositionContentHash: `member-disposition-${key}`,
    sourceMemberEvidenceContentHash: `member-evidence-${key}`,
    sourceCollectionActivityIdentityEvidenceContentHash: `identity-evidence-${key}`,
    collectionContext: { memberCellEvidence: { plainText: label } },
    memberIdentityContexts: [],
    sourcePageId: 100 + key.length,
    resolvedTitle: sourceTitle,
    membershipClassification: 'example_collection_member',
    sourceRevision: `200${key.length}`,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    sourcePageSubjectDisposition: { state: 'source_signature_supported' },
    sourceRelationshipDispositionSignals,
    sourceRelationshipDisposition: { state: 'source_declaration_supported', relationshipClass: role, conflictingRelationshipClasses: [], evidenceKeys: [`${key}:source-role`] },
    collectionActivityEvidence: { memberCellEvidence: { plainText: label } },
    collectionActivityIdentityCandidateObservations: { memberLinkSourceTitleAlignments: [{ evidenceState: 'aligned' }], stableSourceIdentityAlignments: [{ evidenceState: 'aligned' }] },
    collectionActivityIdentityDispositionSignals: [identitySignal],
    collectionActivityIdentityDisposition: {
      state: 'source_supported_collection_activity_candidate',
      identityClass: 'collection_row_defined_activity_candidate',
      collectionActivityLabel: label,
      linkedSourceRelationshipClass: role,
      evidenceKeys: [identitySignal.evidenceKey]
    },
    collectionActivityIdentityReview: {
      state: 'reviewed_source_supported_candidate',
      identity: { identityClass: 'collection_row_defined_activity_candidate', collectionActivityLabel: label, collectionLocator: { collectionPageId: 1 }, linkedSourceRelationshipClass: role, canonicalIdentityEstablished: false },
      evidenceKeys: [identitySignal.evidenceKey]
    },
    linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed' },
    memberExpansionReview: { state: 'unreviewed' },
    mechanicsReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['relationship-review-pending'],
    contentHash: `identity-disposition-${key}`
  };
}

const inputs = [
  input({ key: 'component', label: 'Archery Competition', sourceTitle: 'Target (Ranging Guild)', role: 'activity_component' }),
  input({ key: 'provider', label: 'Aldarin Vineyard', sourceTitle: 'Vineyard foreman', role: 'task_provider', declarations: 2 }),
  input({ key: 'assignment', label: 'Wise Old Man tasks', sourceTitle: 'Wise Old Man tasks', role: 'task_assignment_activity' })
];
const built = buildActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions({ identityDispositionRecords: inputs, policy });

assert.equal(built.audit.publishable, true);
assert.equal(built.audit.relationshipDispositionAttemptCoverageComplete, true);
assert.equal(built.audit.collectionActivityIdentityReviewComplete, true);
assert.equal(built.audit.linkedSubjectRelationshipReviewComplete, true);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.linkedSubjectRelationshipDispositionCoverage.sourceSupportedCount, 3);
assert.equal(built.audit.linkedSubjectRelationshipDispositionCoverage.conflictingCount, 0);
assert.equal(built.audit.linkedSubjectRelationshipDispositionCoverage.unresolvedCount, 0);
assert.deepEqual(built.records.map(record => record.linkedSubjectRelationshipDisposition.relationshipClass), [
  'component_of_collection_defined_activity_candidate',
  'task_provider_for_collection_defined_activity_candidate',
  'source_page_describes_collection_defined_activity_candidate'
]);
assert.ok(built.records.every(record =>
  record.linkedSubjectRelationshipReview.state === 'reviewed_source_supported'
  && record.linkedSubjectRelationshipReview.relationships.length === 1
  && record.linkedSubjectRelationshipReview.relationships[0].canonicalIdentityEstablished === false
  && record.canonicalActivityIdentity === null
  && record.repeatabilityReview.state === 'unreviewed'
  && record.optimizerEligible === false
));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamedInputs = structuredClone(inputs);
renamedInputs[0].resolvedTitle = 'Renamed source page';
renamedInputs[0].collectionActivityIdentityReview.identity.collectionActivityLabel = 'Renamed activity';
renamedInputs[0].collectionActivityIdentityDisposition.collectionActivityLabel = 'Renamed activity';
renamedInputs[0].contentHash = 'renamed-input';
const renamed = buildActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions({ identityDispositionRecords: renamedInputs, policy });
assert.equal(renamed.audit.publishable, true);
assert.equal(renamed.records[0].linkedSubjectRelationshipDisposition.relationshipClass, 'component_of_collection_defined_activity_candidate');

const missingSignalInputs = structuredClone(inputs);
missingSignalInputs[0].collectionActivityIdentityDispositionSignals = [];
missingSignalInputs[0].contentHash = 'missing-signal-input';
const missingSignal = buildActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions({ identityDispositionRecords: missingSignalInputs, policy });
assert.equal(missingSignal.audit.publishable, true);
assert.equal(missingSignal.records[0].linkedSubjectRelationshipDisposition.state, 'unresolved_insufficient_linked_subject_relationship_evidence');
assert.equal(missingSignal.audit.linkedSubjectRelationshipReviewComplete, false);

const sourceConflictInputs = structuredClone(inputs);
sourceConflictInputs[0].sourceRelationshipDisposition = { state: 'blocked_conflicting_source_relationship_declarations', relationshipClass: null, evidenceKeys: [] };
sourceConflictInputs[0].contentHash = 'source-conflict-input';
const sourceConflict = buildActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions({ identityDispositionRecords: sourceConflictInputs, policy });
assert.equal(sourceConflict.records[0].linkedSubjectRelationshipDisposition.state, 'blocked_source_relationship_conflict');

const conflictingPolicy = structuredClone(policy);
conflictingPolicy.relationshipDispositionRules.push({
  ...conflictingPolicy.relationshipDispositionRules[0],
  ruleKey: 'competing_generic_component_semantics',
  linkedSubjectRelationshipClass: 'different_component_relationship'
});
const conflicting = buildActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions({ identityDispositionRecords: inputs, policy: conflictingPolicy });
assert.equal(conflicting.records[0].linkedSubjectRelationshipDisposition.state, 'blocked_conflicting_linked_subject_relationship_signals');

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { component: 'supported' };
const forbidden = buildActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions({ identityDispositionRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_class_linked_subject_relationship_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].linkedSubjectRelationshipDisposition.relationshipClass = 'altered';
const altered = auditActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions(alteredRecords, { identityDispositionRecords: inputs, policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_linked_subject_relationship_dispositions_not_supported_by_complete_generic_evidence'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].linkedSubjectRelationshipReview.relationships[0].canonicalIdentityEstablished = true;
promotedRecords[0].canonicalActivityIdentity = 'activity:example';
promotedRecords[0].repeatabilityReview.state = 'reviewed';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions(promotedRecords, { identityDispositionRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_canonical_identity_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberLinkedSubjectRelationshipDispositions(accountRecords, { identityDispositionRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_linked_subject_relationship_dispositions'));

const compiled = compileLinkedSubjectRelationshipDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRuleKeys, []);
assert.deepEqual(compiled.duplicateRuleKeys, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Generic linked-subject relationship-disposition checks passed.');
