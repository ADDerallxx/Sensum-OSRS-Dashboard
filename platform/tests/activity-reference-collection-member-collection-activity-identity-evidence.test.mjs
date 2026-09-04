import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberCollectionActivityIdentityEvidence,
  buildActivityReferenceCollectionMemberCollectionActivityIdentityEvidence
} from '../transforms/activity-reference-collection-member-collection-activity-identity-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-collection-activity-identity-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-collection-activity-identity-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-collection-activity-identity-evidence-audit-v1.json', 'utf8'));

function input({ key, label, role, subjectClass, irregularHeader = false, declarationCount = 1 }) {
  const pageId = 200 + key.length;
  const revision = `300${key.length}`;
  const title = `Source ${key}`;
  const memberLink = {
    occurrence: 1,
    requestedTitle: title,
    requestedFragment: null,
    displayText: label,
    rawLink: `[[${title}|${label}]]`,
    sourceLocator: { lineStart: 12, lineEnd: 12 }
  };
  const collectionContext = {
    collectionSource: {
      candidateKey: 'collection:1',
      pageId: 1,
      title: 'Collection',
      revision: '999',
      timestamp: '2026-09-01T00:00:00Z',
      url: 'https://example.test/collection',
      contentHash: 'collection-hash'
    },
    sectionEvidence: { heading: 'Activities', level: 2, sourceLocator: { lineStart: 10, lineEnd: 10 } },
    tableEvidence: { sourceTableOrdinal: 1, memberHeader: 'Activity', logicalHeaders: ['Activity', 'Description'], sourceLocator: { lineStart: 11, lineEnd: 30 } },
    rowEvidence: {
      sourceRowOrdinal: 1,
      rawText: `[[${title}|${label}]] || Do [[Shared item]] work.`,
      cells: [
        { logicalHeader: 'Activity', plainText: label, rawValue: `[[${title}|${label}]]`, sourceLocator: { lineStart: 12, lineEnd: 12 } },
        { logicalHeader: irregularHeader ? 'Activity Classification' : 'Description', plainText: 'Do Shared item work.', rawValue: 'Do [[Shared item]] work.', sourceLocator: { lineStart: 13, lineEnd: 13 } }
      ],
      sourceLocator: { lineStart: 12, lineEnd: 13 }
    },
    memberCellEvidence: { plainText: label, rawValue: `[[${title}|${label}]]`, sourceLocator: { lineStart: 12, lineEnd: 12 } },
    memberLinks: [memberLink],
    membershipClassification: 'minigame_like_activity'
  };
  const sourceRelationshipDispositionSignals = [{
    evidenceKey: `${key}:role`,
    signalKind: 'exact_lead_relationship_declaration_rule',
    ruleKey: `generic-${role}`,
    sourcePageSubjectClass: subjectClass,
    relationshipClass: role,
    matchedDeclarations: Array.from({ length: declarationCount }, (_, index) => ({
      leadOrdinal: index + 1,
      sourceLocator: { lineStart: 2 + index, lineEnd: 2 + index },
      rawText: `Declaration ${index + 1}`,
      plainText: `Declaration ${index + 1}`,
      matchedText: `Declaration ${index + 1}`,
      matchIndex: 0,
      pattern: 'Declaration',
      flags: ''
    })),
    sourcePageId: pageId,
    sourceRevision: revision,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`
  }];
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    sourceRelationshipEvidenceContentHash: `relationship-evidence-${key}`,
    sourceRelationshipRoutingContentHash: `relationship-routing-${key}`,
    sourceSignatureDispositionContentHash: `signature-disposition-${key}`,
    sourceSignatureContentHash: `signature-${key}`,
    sourceRoutingContentHash: `routing-${key}`,
    sourceMemberDispositionContentHash: `member-disposition-${key}`,
    sourceMemberEvidenceContentHash: `member-evidence-${key}`,
    collectionContext,
    memberIdentityContexts: [{
      pageId,
      requestedTitle: title,
      resolvedTitle: title,
      observedRevision: revision,
      observedTimestamp: '2026-09-04T00:00:00Z',
      observedSourceUrl: `https://example.test/${key}`,
      observedContentHash: `source-${key}`,
      state: 'resolved_current_wiki_page_identity'
    }],
    sourcePageId: pageId,
    resolvedTitle: title,
    membershipClassification: 'minigame_like_activity',
    sourceRevision: revision,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    sourcePageSubjectDisposition: { state: 'source_signature_supported', disposition: subjectClass },
    routingDecision: { routeKey: `${subjectClass}-review`, routeState: 'queued' },
    sourceBlockers: [],
    sourceSignatureBlockers: [],
    sourceDispositionBlockers: [],
    sourceRelationshipRoutingBlockers: [],
    sourceRelationshipEvidenceBlockers: [],
    sourceSignatureJoin: { exactHashIdentityRevisionAndContextMatch: true },
    collectionMembershipEvidence: { rowEvidence: collectionContext.rowEvidence, memberLinks: [memberLink] },
    sourcePageEvidence: {
      sourceRevision: revision,
      sourceContentHash: `source-${key}`,
      sourceAuthoredLinks: [{
        ordinal: 1,
        requestedTitle: 'Shared item',
        displayText: null,
        namespaceClass: 'main',
        sourceLocator: { line: 3 }
      }]
    },
    relationshipCandidateObservations: { relationshipVerdict: null },
    sourceRelationshipEvidenceSummary: { collectionMembershipEvidencePresent: true },
    sourceRelationshipDispositionSignals,
    sourceRelationshipDisposition: {
      state: 'source_declaration_supported',
      relationshipClass: role,
      conflictingRelationshipClasses: [],
      evidenceKeys: sourceRelationshipDispositionSignals.map(signal => signal.evidenceKey)
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
    blockers: ['collection-identity-pending'],
    contentHash: `relationship-disposition-${key}`
  };
}

const inputs = [
  input({ key: 'scenery', label: 'Archery Competition', role: 'activity_component', subjectClass: 'scenery_object_page' }),
  input({ key: 'npc', label: 'Aldarin Vineyard', role: 'task_provider', subjectClass: 'npc_page', irregularHeader: true, declarationCount: 2 }),
  input({ key: 'activity', label: 'Wise Old Man tasks', role: 'task_assignment_activity', subjectClass: 'activity_page' })
];
const built = buildActivityReferenceCollectionMemberCollectionActivityIdentityEvidence({ relationshipDispositionRecords: inputs, policy });

assert.equal(built.audit.publishable, true);
assert.equal(built.audit.identityEvidencePacketCoverageComplete, true);
assert.equal(built.audit.collectionActivityIdentityReviewComplete, false);
assert.equal(built.audit.linkedSubjectRelationshipReviewComplete, false);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.audit.collectionActivityEvidenceCoverage.collectionRevisionPinnedCount, 3);
assert.equal(built.audit.collectionActivityEvidenceCoverage.linkedSourceRevisionPinnedCount, 3);
assert.equal(built.audit.collectionActivityEvidenceCoverage.allRowCellEvidenceCount, 6);
assert.equal(built.audit.collectionActivityEvidenceCoverage.nonEmptyRowCellEvidenceCount, 6);
assert.equal(built.audit.collectionActivityEvidenceCoverage.directRowWikilinkEvidenceCount, 6);
assert.equal(built.audit.collectionActivityEvidenceCoverage.sourceRelationshipDispositionSignalCount, 3);
assert.equal(built.audit.collectionActivityEvidenceCoverage.matchedSourceDeclarationCount, 4);
assert.equal(built.audit.candidateObservationCoverage.memberLinkSourceTitleAlignmentCount, 3);
assert.equal(built.audit.candidateObservationCoverage.stableSourceIdentityAlignmentCount, 3);
assert.equal(built.audit.candidateObservationCoverage.sharedMainNamespaceLinkTargetCount, 3);
assert.equal(built.audit.candidateObservationCoverage.collectionActivityIdentityVerdictCount, 0);
assert.equal(built.audit.candidateObservationCoverage.linkedSubjectRelationshipVerdictCount, 0);
assert.equal(built.records[1].collectionActivityEvidence.nonEmptyRowCellEvidence[1].logicalHeader, 'Activity Classification');
assert.equal(built.records[1].collectionActivityEvidence.nonEmptyRowCellEvidence[1].plainText, 'Do Shared item work.');
assert.ok(built.records.every(record => record.collectionActivityIdentityReview.state === 'unreviewed' && record.linkedSubjectRelationshipReview.state === 'unreviewed' && record.optimizerEligible === false));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const changedLabelInputs = structuredClone(inputs);
changedLabelInputs[0].collectionContext.memberCellEvidence.plainText = 'A different display label';
changedLabelInputs[0].collectionContext.rowEvidence.cells[0].plainText = 'A different display label';
changedLabelInputs[0].contentHash = 'changed-label-disposition';
const changedLabel = buildActivityReferenceCollectionMemberCollectionActivityIdentityEvidence({ relationshipDispositionRecords: changedLabelInputs, policy });
assert.equal(changedLabel.audit.publishable, true);
assert.equal(changedLabel.records[0].collectionActivityIdentityCandidateObservations.collectionActivityIdentityVerdict, null);

const conflictingInputs = structuredClone(inputs);
conflictingInputs[0].sourceRelationshipDisposition = {
  state: 'blocked_conflicting_source_relationship_declarations',
  relationshipClass: null,
  conflictingRelationshipClasses: ['activity_component', 'task_provider'],
  evidenceKeys: conflictingInputs[0].sourceRelationshipDispositionSignals.map(signal => signal.evidenceKey)
};
conflictingInputs[0].contentHash = 'conflicting-disposition';
const conflicting = buildActivityReferenceCollectionMemberCollectionActivityIdentityEvidence({ relationshipDispositionRecords: conflictingInputs, policy });
assert.equal(conflicting.audit.publishable, true);
assert.deepEqual(conflicting.records[0].collectionActivityIdentityCandidateObservations.retainedSourceRelationshipClasses, ['activity_component', 'task_provider']);

const alteredRecords = structuredClone(built.records);
alteredRecords[0].collectionActivityEvidence.allRowCellEvidence = [];
const altered = auditActivityReferenceCollectionMemberCollectionActivityIdentityEvidence(alteredRecords, { relationshipDispositionRecords: inputs, policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_collection_activity_evidence_packets_changed_or_lost_source_located_evidence'));

const verdictRecords = structuredClone(built.records);
verdictRecords[0].collectionActivityIdentityCandidateObservations.collectionActivityIdentityVerdict = 'same_activity';
const verdict = auditActivityReferenceCollectionMemberCollectionActivityIdentityEvidence(verdictRecords, { relationshipDispositionRecords: inputs, policy });
assert.equal(verdict.publishable, false);
assert.ok(verdict.blockers.includes('one_or_more_identity_candidate_observation_sets_contain_an_unsupported_verdict'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { scenery: 'same_activity' };
const forbidden = buildActivityReferenceCollectionMemberCollectionActivityIdentityEvidence({ relationshipDispositionRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_class_identity_evidence_policy_forbidden'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].collectionActivityIdentityReview.state = 'reviewed';
promotedRecords[0].canonicalActivityIdentity = 'activity:example';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberCollectionActivityIdentityEvidence(promotedRecords, { relationshipDispositionRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberCollectionActivityIdentityEvidence(accountRecords, { relationshipDispositionRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_collection_activity_identity_evidence'));

console.log('Revision-pinned collection-activity identity-evidence checks passed.');
