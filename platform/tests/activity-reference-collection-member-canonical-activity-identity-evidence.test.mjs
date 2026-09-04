import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence,
  buildActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence,
  compileCanonicalActivityIdentityEvidencePolicy
} from '../transforms/activity-reference-collection-member-canonical-activity-identity-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-canonical-activity-identity-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-identity-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-identity-evidence-audit-v1.json', 'utf8'));

function input({ key, label, title, relationshipClass }) {
  const memberCandidateKey = `collection-row:${key}`;
  const sourceRoleSignal = {
    evidenceKey: `${memberCandidateKey}:source-role`,
    relationshipClass: relationshipClass === 'component_of_collection_defined_activity_candidate' ? 'activity_component'
      : relationshipClass === 'task_provider_for_collection_defined_activity_candidate' ? 'task_provider'
        : 'task_assignment_activity',
    matchedDeclarations: [{
      sourceLocator: { lineStart: 20, lineEnd: 20 },
      rawText: 'The source makes an exact declaration.',
      plainText: 'The source makes an exact declaration.',
      matchedText: 'exact declaration'
    }]
  };
  const identitySignal = {
    evidenceKey: `${memberCandidateKey}:identity`,
    signalKind: 'dual_source_collection_activity_identity_candidate',
    collectionNarrativeEvidence: [],
    memberLinkSourceTitleAlignments: [{ evidenceState: 'aligned' }],
    stableSourceIdentityAlignments: [{ evidenceState: 'aligned' }]
  };
  const relationshipSignal = { evidenceKey: `${memberCandidateKey}:relationship`, signalKind: 'generic_linked_subject_collection_activity_relationship' };
  const identity = {
    identityClass: 'collection_row_defined_activity_candidate',
    collectionActivityLabel: label,
    collectionLocator: { collectionPageId: 2078, collectionRevision: '15327496', sectionHeading: 'Activities', sourceTableOrdinal: 2, sourceRowOrdinal: 1 },
    linkedSourceRelationshipClass: sourceRoleSignal.relationshipClass,
    canonicalIdentityEstablished: false
  };
  const relationship = {
    relationshipClass,
    subject: { sourcePageId: 100, resolvedTitle: title, sourceRevision: '200', sourceContentHash: `source-${key}` },
    activityCandidate: identity,
    canonicalIdentityEstablished: false
  };
  const memberCell = { plainText: label, rawValue: `[[${title}|${label}]]`, sourceLocator: { lineStart: 10, lineEnd: 10 } };
  const narrativeCell = { plainText: 'Players perform the described activity for its source-stated rewards.', rawValue: 'Players perform the described activity for its source-stated rewards.', sourceLocator: { lineStart: 11, lineEnd: 11 } };
  identitySignal.collectionNarrativeEvidence = [narrativeCell];
  return {
    contract: policy.inputContract,
    memberCandidateKey,
    sourcePageId: 100,
    resolvedTitle: title,
    sourceRevision: '200',
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    sourcePageSubjectDisposition: { state: 'source_signature_supported' },
    sourceRelationshipDispositionSignals: [sourceRoleSignal],
    sourceRelationshipDisposition: { state: 'source_declaration_supported', relationshipClass: sourceRoleSignal.relationshipClass, evidenceKeys: [sourceRoleSignal.evidenceKey] },
    collectionActivityEvidence: {
      collectionSource: { pageId: 2078, revision: '15327496', contentHash: 'collection-hash', title: 'Minigames' },
      sectionEvidence: { heading: 'Activities', sourceLocator: { lineStart: 1, lineEnd: 1 } },
      tableEvidence: { sourceTableOrdinal: 2 },
      rowEvidence: { sourceRowOrdinal: 1, sourceLocator: { lineStart: 10, lineEnd: 11 } },
      memberCellEvidence: memberCell,
      nonEmptyRowCellEvidence: [memberCell, narrativeCell],
      allRowCellEvidence: [memberCell, narrativeCell],
      directRowWikilinkEvidence: [{ requestedTitle: title, sourceLocator: { lineStart: 10, lineEnd: 10 } }]
    },
    collectionActivityIdentityCandidateObservations: {
      memberLinkSourceTitleAlignments: [{ evidenceState: 'aligned' }],
      stableSourceIdentityAlignments: [{ evidenceState: 'aligned' }],
      sharedMainNamespaceLinkTargets: []
    },
    collectionActivityIdentityDispositionSignals: [identitySignal],
    collectionActivityIdentityDisposition: { state: 'source_supported_collection_activity_candidate', identityClass: identity.identityClass, collectionActivityLabel: label, evidenceKeys: [identitySignal.evidenceKey] },
    collectionActivityIdentityReview: { state: 'reviewed_source_supported_candidate', identity, evidenceKeys: [identitySignal.evidenceKey] },
    linkedSubjectRelationshipDispositionSignals: [relationshipSignal],
    linkedSubjectRelationshipDisposition: { state: 'source_supported_linked_subject_relationship', relationshipClass, evidenceKeys: [relationshipSignal.evidenceKey] },
    linkedSubjectRelationshipReview: { state: 'reviewed_source_supported', relationships: [relationship], evidenceKeys: [relationshipSignal.evidenceKey] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed' },
    memberExpansionReview: { state: 'unreviewed' },
    mechanicsReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical-identity-pending'],
    contentHash: `relationship-disposition-${key}`
  };
}

const inputs = [
  input({ key: 'component', label: 'Archery Competition', title: 'Target (Ranging Guild)', relationshipClass: 'component_of_collection_defined_activity_candidate' }),
  input({ key: 'provider', label: 'Aldarin Vineyard', title: 'Vineyard foreman', relationshipClass: 'task_provider_for_collection_defined_activity_candidate' }),
  input({ key: 'activity', label: 'Wise Old Man tasks', title: 'Wise Old Man tasks', relationshipClass: 'source_page_describes_collection_defined_activity_candidate' })
];
const built = buildActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence({ relationshipDispositionRecords: inputs, policy });

assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivityIdentityEvidencePacketCoverageComplete, true);
assert.equal(built.audit.canonicalActivityIdentityReviewComplete, false);
assert.equal(built.audit.evidenceCoverage.completePacketCount, 3);
assert.equal(built.audit.evidenceCoverage.incompletePacketCount, 0);
assert.equal(built.audit.evidenceCoverage.retainedCollectionRowCellCount, 6);
assert.equal(built.audit.evidenceCoverage.retainedCollectionNarrativeCellCount, 3);
assert.equal(built.audit.evidenceCoverage.retainedSourceRoleDeclarationCount, 3);
assert.equal(built.audit.identityObservationCoverage.exactNormalizedCollectionLabelSourceTitleMatchCount, 1);
assert.equal(built.audit.identityObservationCoverage.differentCollectionLabelSourceTitleCount, 2);
assert.equal(built.audit.identityObservationCoverage.possibleDedicatedActivityPageObservationCount, 1);
assert.equal(built.audit.identityObservationCoverage.canonicalActivityIdentityVerdictCount, 0);
assert.ok(built.records.every(record =>
  record.canonicalActivityIdentityCandidateObservations.canonicalActivityIdentityVerdict === null
  && record.canonicalGameEntityIdentity === null
  && record.canonicalActivityIdentity === null
  && record.repeatabilityReview.state === 'unreviewed'
  && record.optimizerEligible === false
));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamedInputs = structuredClone(inputs);
renamedInputs[0].resolvedTitle = 'Archery Competition';
renamedInputs[0].linkedSubjectRelationshipReview.relationships[0].subject.resolvedTitle = 'Archery Competition';
renamedInputs[0].contentHash = 'renamed-input';
const renamed = buildActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence({ relationshipDispositionRecords: renamedInputs, policy });
assert.equal(renamed.audit.publishable, true);
assert.equal(renamed.records[0].canonicalActivityIdentityCandidateObservations.exactNormalizedCollectionLabelSourceTitleMatch, true);
assert.equal(renamed.records[0].canonicalActivityIdentityCandidateObservations.canonicalActivityIdentityVerdict, null);

const missingNarrativeInputs = structuredClone(inputs);
missingNarrativeInputs[0].collectionActivityEvidence.nonEmptyRowCellEvidence = [missingNarrativeInputs[0].collectionActivityEvidence.memberCellEvidence];
missingNarrativeInputs[0].collectionActivityIdentityDispositionSignals[0].collectionNarrativeEvidence = [];
missingNarrativeInputs[0].contentHash = 'missing-narrative-input';
const missingNarrative = buildActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence({ relationshipDispositionRecords: missingNarrativeInputs, policy });
assert.equal(missingNarrative.audit.publishable, false);
assert.equal(missingNarrative.audit.canonicalActivityIdentityEvidencePacketCoverageComplete, false);
assert.ok(missingNarrative.records[0].canonicalActivityIdentityCandidateObservations.deficiencies.includes('source_located_collection_activity_narrative_missing'));

const conflictingInputs = structuredClone(inputs);
conflictingInputs[0].linkedSubjectRelationshipDisposition.state = 'blocked_conflicting_linked_subject_relationship_signals';
conflictingInputs[0].linkedSubjectRelationshipReview = { state: 'reviewed_blocked', relationships: [], evidenceKeys: [] };
conflictingInputs[0].contentHash = 'conflicting-input';
const conflicting = buildActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence({ relationshipDispositionRecords: conflictingInputs, policy });
assert.equal(conflicting.audit.publishable, false);
assert.ok(conflicting.records[0].canonicalActivityIdentityCandidateObservations.deficiencies.includes('linked_subject_relationship_not_supported'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { activity: 'canonical' };
const forbidden = buildActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence({ relationshipDispositionRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_class_canonical_activity_identity_evidence_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].canonicalActivityIdentityEvidence.collectionDefinition.narrativeCellEvidence = [];
const altered = auditActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence(alteredRecords, { relationshipDispositionRecords: inputs, policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_canonical_activity_identity_evidence_packets_do_not_match_source_evidence'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].canonicalActivityIdentityCandidateObservations.canonicalActivityIdentityVerdict = 'canonical';
promotedRecords[0].canonicalActivityIdentity = 'activity:example';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence(promotedRecords, { relationshipDispositionRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_canonical_identity_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberCanonicalActivityIdentityEvidence(accountRecords, { relationshipDispositionRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_canonical_activity_identity_evidence'));

const compiled = compileCanonicalActivityIdentityEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Revision-pinned canonical-activity identity-evidence packet checks passed.');
