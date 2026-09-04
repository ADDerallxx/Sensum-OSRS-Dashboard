import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberCollectionActivityIdentityDispositions,
  buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions,
  compileCollectionActivityIdentityDispositionPolicy
} from '../transforms/activity-reference-collection-member-collection-activity-identity-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-collection-activity-identity-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-collection-activity-identity-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-collection-activity-identity-disposition-audit-v1.json', 'utf8'));

function evidence({ key, label, role, irregularHeader = false, declarations = 1 }) {
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
    collectionContext: { memberCellEvidence: { plainText: label } },
    memberIdentityContexts: [],
    sourcePageId: 100 + key.length,
    resolvedTitle: `Source ${key}`,
    membershipClassification: 'example_collection_member',
    sourceRevision: `200${key.length}`,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    sourcePageSubjectDisposition: { state: 'source_signature_supported' },
    sourceRelationshipDispositionSignals,
    sourceRelationshipDisposition: {
      state: 'source_declaration_supported',
      relationshipClass: role,
      conflictingRelationshipClasses: [],
      evidenceKeys: sourceRelationshipDispositionSignals.map(signal => signal.evidenceKey)
    },
    collectionActivityEvidence: {
      collectionSource: { pageId: 1, revision: '999' },
      sectionEvidence: { heading: 'Activities' },
      tableEvidence: { sourceTableOrdinal: 2 },
      rowEvidence: { sourceRowOrdinal: 3 },
      memberCellEvidence: {
        plainText: label,
        rawValue: `[[Source ${key}|${label}]]`,
        sourceLocator: { lineStart: 10, lineEnd: 10 }
      },
      nonEmptyRowCellEvidence: [
        {
          logicalHeader: 'Activity',
          plainText: label,
          rawValue: `[[Source ${key}|${label}]]`,
          sourceLocator: { lineStart: 10, lineEnd: 10 }
        },
        {
          logicalHeader: irregularHeader ? 'Activity Classification' : 'Description',
          plainText: 'Players perform this repeatable activity and receive an appropriate reward.',
          rawValue: 'Players perform this repeatable activity and receive an appropriate reward.',
          sourceLocator: { lineStart: 11, lineEnd: 11 }
        }
      ]
    },
    collectionActivityIdentityCandidateObservations: {
      memberLinkSourceTitleAlignments: [{ evidenceState: 'aligned' }],
      stableSourceIdentityAlignments: [{ evidenceState: 'aligned' }],
      sharedMainNamespaceLinkTargets: [],
      collectionActivityIdentityVerdict: null,
      linkedSubjectRelationshipVerdict: null
    },
    collectionActivityIdentityReview: { state: 'unreviewed', identity: null, evidenceKeys: [] },
    linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed' },
    memberExpansionReview: { state: 'unreviewed' },
    mechanicsReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['identity-disposition-pending'],
    contentHash: `identity-evidence-${key}`
  };
}

const inputs = [
  evidence({ key: 'scenery', label: 'Archery Competition', role: 'activity_component' }),
  evidence({ key: 'npc', label: 'Aldarin Vineyard', role: 'task_provider', irregularHeader: true, declarations: 2 }),
  evidence({ key: 'activity', label: 'Wise Old Man tasks', role: 'task_assignment_activity' })
];
const built = buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions({ identityEvidenceRecords: inputs, policy });

assert.equal(built.audit.publishable, true);
assert.equal(built.audit.identityDispositionAttemptCoverageComplete, true);
assert.equal(built.audit.collectionActivityIdentityReviewComplete, true);
assert.equal(built.audit.linkedSubjectRelationshipReviewComplete, false);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.collectionActivityIdentityDispositionCoverage.attemptedCount, 3);
assert.equal(built.audit.collectionActivityIdentityDispositionCoverage.sourceSupportedCount, 3);
assert.equal(built.audit.collectionActivityIdentityDispositionCoverage.conflictingCount, 0);
assert.equal(built.audit.collectionActivityIdentityDispositionCoverage.unresolvedCount, 0);
assert.equal(built.audit.collectionActivityIdentityDispositionCoverage.dualSourceIdentitySignalCount, 3);
assert.equal(built.audit.collectionActivityIdentityDispositionCoverage.collectionNarrativeEvidenceCellCount, 3);
assert.equal(built.audit.collectionActivityIdentityDispositionCoverage.retainedSourceRelationshipDeclarationCount, 4);
assert.ok(built.records.every(record =>
  record.collectionActivityIdentityDisposition.state === 'source_supported_collection_activity_candidate'
  && record.collectionActivityIdentityReview.state === 'reviewed_source_supported_candidate'
  && record.collectionActivityIdentityReview.identity.canonicalIdentityEstablished === false
  && record.linkedSubjectRelationshipReview.state === 'unreviewed'
  && record.canonicalActivityIdentity === null
  && record.optimizerEligible === false
));
assert.equal(built.records[1].collectionActivityIdentityDispositionSignals[0].collectionNarrativeEvidence[0].logicalHeader, 'Activity Classification');
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamedInputs = structuredClone(inputs);
renamedInputs[0].collectionActivityEvidence.memberCellEvidence.plainText = 'Renamed source activity';
renamedInputs[0].contentHash = 'renamed-evidence';
const renamed = buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions({ identityEvidenceRecords: renamedInputs, policy });
assert.equal(renamed.audit.publishable, true);
assert.equal(renamed.records[0].collectionActivityIdentityDisposition.state, 'source_supported_collection_activity_candidate');
assert.equal(renamed.records[0].collectionActivityIdentityDisposition.collectionActivityLabel, 'Renamed source activity');

const noNarrativeInputs = structuredClone(inputs);
noNarrativeInputs[0].collectionActivityEvidence.nonEmptyRowCellEvidence = noNarrativeInputs[0].collectionActivityEvidence.nonEmptyRowCellEvidence.slice(0, 1);
noNarrativeInputs[0].contentHash = 'no-narrative-evidence';
const noNarrative = buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions({ identityEvidenceRecords: noNarrativeInputs, policy });
assert.equal(noNarrative.audit.publishable, true);
assert.equal(noNarrative.audit.collectionActivityIdentityReviewComplete, false);
assert.equal(noNarrative.records[0].collectionActivityIdentityDisposition.state, 'unresolved_insufficient_collection_activity_identity_evidence');

const noAlignmentInputs = structuredClone(inputs);
noAlignmentInputs[0].collectionActivityIdentityCandidateObservations.stableSourceIdentityAlignments = [];
noAlignmentInputs[0].contentHash = 'no-stable-alignment-evidence';
const noAlignment = buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions({ identityEvidenceRecords: noAlignmentInputs, policy });
assert.equal(noAlignment.records[0].collectionActivityIdentityDisposition.state, 'unresolved_insufficient_collection_activity_identity_evidence');

const sourceConflictInputs = structuredClone(inputs);
sourceConflictInputs[0].sourceRelationshipDisposition = {
  state: 'blocked_conflicting_source_relationship_declarations',
  relationshipClass: null,
  conflictingRelationshipClasses: ['activity_component', 'task_provider'],
  evidenceKeys: []
};
sourceConflictInputs[0].contentHash = 'source-conflict-evidence';
const sourceConflict = buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions({ identityEvidenceRecords: sourceConflictInputs, policy });
assert.equal(sourceConflict.records[0].collectionActivityIdentityDisposition.state, 'blocked_source_relationship_conflict');

const conflictingPolicy = structuredClone(policy);
conflictingPolicy.identityDispositionRules.push({
  ...conflictingPolicy.identityDispositionRules[0],
  ruleKey: 'second_generic_identity_rule',
  identityClass: 'different_collection_activity_candidate'
});
const conflicting = buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions({ identityEvidenceRecords: inputs, policy: conflictingPolicy });
assert.equal(conflicting.audit.publishable, true);
assert.equal(conflicting.records[0].collectionActivityIdentityDisposition.state, 'blocked_conflicting_collection_activity_identity_signals');

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { activity: 'supported' };
const forbidden = buildActivityReferenceCollectionMemberCollectionActivityIdentityDispositions({ identityEvidenceRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_class_identity_disposition_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].collectionActivityIdentityDisposition.identityClass = 'altered';
const altered = auditActivityReferenceCollectionMemberCollectionActivityIdentityDispositions(alteredRecords, { identityEvidenceRecords: inputs, policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_collection_activity_identity_dispositions_not_supported_by_complete_dual_source_evidence'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].linkedSubjectRelationshipReview.state = 'reviewed';
promotedRecords[0].canonicalActivityIdentity = 'activity:example';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberCollectionActivityIdentityDispositions(promotedRecords, { identityEvidenceRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_linked_relationship_canonical_identity_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberCollectionActivityIdentityDispositions(accountRecords, { identityEvidenceRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_collection_activity_identity_dispositions'));

const compiled = compileCollectionActivityIdentityDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRuleKeys, []);
assert.deepEqual(compiled.duplicateRuleKeys, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Generic collection-activity identity-disposition checks passed.');
