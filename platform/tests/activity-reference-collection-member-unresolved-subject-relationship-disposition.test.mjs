import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions,
  buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions,
  compileRelationshipDispositionPolicy
} from '../transforms/activity-reference-collection-member-unresolved-subject-relationship-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-unresolved-subject-relationship-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-unresolved-subject-relationship-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-unresolved-subject-relationship-disposition-audit-v1.json', 'utf8'));

function evidence({ key, label, subjectClass, leads }) {
  const sourcePageId = 100 + key.length;
  const sourceRevision = `200${key.length}`;
  const resolvedTitle = `Example ${key}`;
  const collectionContext = {
    collectionSource: { candidateKey: 'collection:1', pageId: 1, title: 'Collection', revision: '999', timestamp: '2026-09-01T00:00:00Z', url: 'https://example.test/collection', contentHash: 'collection-hash' },
    sectionEvidence: { heading: 'Activities', level: 2, sourceLocator: { lineStart: 10, lineEnd: 10 } },
    tableEvidence: { sourceTableOrdinal: 1, memberHeader: 'Activity', logicalHeaders: ['Activity', 'Description'], sourceLocator: { lineStart: 11, lineEnd: 30 } },
    rowEvidence: { sourceRowOrdinal: 1, rawText: `[[${resolvedTitle}|${label}]]`, cells: [{ plainText: label }], sourceLocator: { lineStart: 12, lineEnd: 13 } },
    memberCellEvidence: { plainText: label, rawValue: `[[${resolvedTitle}|${label}]]`, sourceLocator: { lineStart: 12, lineEnd: 12 } },
    memberLinks: [{ occurrence: 1, requestedTitle: resolvedTitle, requestedFragment: null, displayText: label, rawLink: `[[${resolvedTitle}|${label}]]`, sourceLocator: { lineStart: 12, lineEnd: 12 } }],
    membershipClassification: 'minigame_like_activity'
  };
  const leadParagraphEvidence = leads.map((rawText, index) => ({ ordinal: index + 1, rawText, sourceLocator: { lineStart: 20 + index, lineEnd: 20 + index } }));
  const relationshipCandidateObservations = {
    memberLabel: label,
    normalizedMemberLabel: label.toLowerCase(),
    collectionRowLinkCandidates: [{ candidateKey: `${key}:row-link:1`, requestedTitle: resolvedTitle, displayText: label, relationshipState: 'unreviewed_collection_row_link_candidate' }],
    sourcePageMainNamespaceLinkCandidates: [{ ordinal: 1, requestedTitle: 'Unrelated', displayText: null, namespaceClass: 'main', sourceLocator: { line: 20 }, relationshipState: 'unreviewed_source_page_link_candidate' }],
    exactMemberLabelSourceLinkMatches: [],
    exactMemberLabelLeadMentions: [],
    exactMemberLabelHeadingMentions: [],
    relationshipVerdict: null,
    interpretationState: 'candidate_observations_only_no_relationship_inference'
  };
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    sourceRelationshipRoutingContentHash: `relationship-route-${key}`,
    sourceSignatureDispositionContentHash: `signature-disposition-${key}`,
    sourceSignatureContentHash: `signature-${key}`,
    sourceRoutingContentHash: `routing-${key}`,
    sourceMemberDispositionContentHash: `member-disposition-${key}`,
    sourceMemberEvidenceContentHash: `member-evidence-${key}`,
    collectionContext,
    memberIdentityContexts: [{ pageId: sourcePageId, resolvedTitle, observedRevision: sourceRevision }],
    sourcePageId,
    resolvedTitle,
    membershipClassification: 'minigame_like_activity',
    sourceRevision,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    sourcePageSubjectDisposition: { state: 'source_signature_supported', disposition: subjectClass, evidenceKeys: [`${key}:subject`] },
    routingDecision: { routeKey: `${subjectClass}-relationship-review`, routeState: 'queued', requiredEvidenceDomains: ['relationship'] },
    sourceBlockers: [],
    sourceSignatureBlockers: [],
    sourceDispositionBlockers: [],
    sourceRelationshipRoutingBlockers: [],
    sourceSignatureJoin: { matchedRecordCount: 1, exactHashIdentityRevisionAndContextMatch: true },
    collectionMembershipEvidence: { collectionSource: collectionContext.collectionSource, rowEvidence: collectionContext.rowEvidence, memberLinks: collectionContext.memberLinks, evidenceState: 'source_authored_collection_membership_assertion_review_only' },
    sourcePageEvidence: {
      sourcePageId,
      resolvedTitle,
      sourceRevision,
      sourceTimestamp: '2026-09-04T00:00:00Z',
      sourceUrl: `https://example.test/${key}`,
      sourceContentHash: `source-${key}`,
      sourceContentBytes: 100,
      revisionAlignment: { aligned: true },
      rootTemplates: [{ template: 'Infobox Example', templateKey: 'infobox example', line: 1 }],
      rootTemplateDelimiterAudit: { balanced: true },
      directCategories: [],
      leadParagraphEvidence,
      headingEvidence: [{ ordinal: 1, normalizedTitle: 'Details', rawTitle: 'Details', line: 30 }],
      sourceAuthoredLinks: [{ ordinal: 1, requestedTitle: 'Unrelated', displayText: null, namespaceClass: 'main', sourceLocator: { line: 20 } }],
      sourceLinkDelimiterAudit: { balanced: true },
      evidenceState: 'exact_revision_source_page_evidence_review_only'
    },
    relationshipCandidateObservations,
    collectionActivityIdentityReview: { state: 'unreviewed', identity: null, evidenceKeys: [] },
    linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['relationship-review-pending'],
    state: 'relationship_evidence_collected_review_pending',
    contentHash: `relationship-evidence-${key}`
  };
}

const inputs = [
  evidence({ key: 'scenery', label: 'Competition', subjectClass: 'scenery_object_page', leads: ['Targets play the central role in the guild shooting range minigame.'] }),
  evidence({ key: 'npc', label: 'Vineyard', subjectClass: 'npc_page', leads: ['The foreman gives the player a barrel to fill and bring back.', 'The task can be repeated for rewards.'] }),
  evidence({ key: 'activity', label: 'Tasks', subjectClass: 'activity_page', leads: ['The character can assign various tasks and give rewards in return.'] })
];

const built = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions({ relationshipEvidenceRecords: inputs, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionAttemptCoverageComplete, true);
assert.equal(built.audit.sourceRelationshipDispositionComplete, true);
assert.equal(built.audit.collectionActivityIdentityReviewComplete, false);
assert.equal(built.audit.linkedSubjectRelationshipReviewComplete, false);
assert.equal(built.audit.sourceRelationshipDispositionCoverage.sourceSupportedCount, 3);
assert.equal(built.audit.sourceRelationshipDispositionCoverage.conflictingCount, 0);
assert.equal(built.audit.sourceRelationshipDispositionCoverage.unresolvedCount, 0);
assert.deepEqual(built.audit.sourceRelationshipDispositionCoverage.relationshipClassCounts, { activity_component: 1, task_assignment_activity: 1, task_provider: 1 });
assert.equal(built.audit.sourceRelationshipDispositionCoverage.exactLeadDeclarationSignalCount, 3);
assert.equal(built.audit.sourceRelationshipDispositionCoverage.matchedLeadDeclarationCount, 4);
assert.deepEqual(built.records.map(record => record.sourceRelationshipDisposition.relationshipClass), ['activity_component', 'task_provider', 'task_assignment_activity']);
assert.ok(built.records.every(record => record.sourceRelationshipDisposition.state === 'source_declaration_supported' && record.collectionActivityIdentityReview.state === 'unreviewed' && record.linkedSubjectRelationshipReview.state === 'unreviewed' && record.optimizerEligible === false));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const changedCollection = structuredClone(inputs);
changedCollection[0].collectionContext.memberCellEvidence.plainText = 'Completely different label';
changedCollection[0].collectionContext.memberLinks[0].displayText = 'Completely different label';
changedCollection[0].collectionMembershipEvidence.memberLinks[0].displayText = 'Completely different label';
changedCollection[0].contentHash = 'relationship-evidence-scenery-changed-context';
const changedBuilt = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions({ relationshipEvidenceRecords: changedCollection, policy });
assert.equal(changedBuilt.records[0].sourceRelationshipDisposition.relationshipClass, 'activity_component');
assert.equal(changedBuilt.records[0].sourceRelationshipDispositionSignals[0].matchedDeclarations[0].matchedText, built.records[0].sourceRelationshipDispositionSignals[0].matchedDeclarations[0].matchedText);

const unmatchedInputs = structuredClone(inputs);
unmatchedInputs[0].sourcePageEvidence.leadParagraphEvidence[0].rawText = 'Targets are decorative scenery.';
const unmatched = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions({ relationshipEvidenceRecords: unmatchedInputs, policy });
assert.equal(unmatched.audit.publishable, true);
assert.equal(unmatched.audit.sourceRelationshipDispositionComplete, false);
assert.equal(unmatched.records[0].sourceRelationshipDisposition.state, 'unresolved_no_supported_source_relationship_declaration');

const conflictingPolicy = structuredClone(policy);
conflictingPolicy.relationshipDeclarationRules.push({
  ruleKey: 'second_generic_scenery_role',
  sourcePageSubjectClasses: ['scenery_object_page'],
  relationshipClass: 'task_provider',
  requiredLeadPatterns: [{ pattern: '\\bcentral role in [^.]{0,160}\\bminigame\\b', flags: 'i' }]
});
const conflicting = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions({ relationshipEvidenceRecords: inputs, policy: conflictingPolicy });
assert.equal(conflicting.audit.publishable, true);
assert.equal(conflicting.audit.sourceRelationshipDispositionComplete, false);
assert.equal(conflicting.records[0].sourceRelationshipDisposition.state, 'blocked_conflicting_source_relationship_declarations');

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { scenery: 'activity_component' };
const forbidden = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions({ relationshipEvidenceRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_class_relationship_disposition_policy_forbidden'));

const invalidInput = structuredClone(inputs);
invalidInput[0].relationshipCandidateObservations.relationshipVerdict = 'same_activity';
const invalid = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions({ relationshipEvidenceRecords: invalidInput, policy });
assert.equal(invalid.audit.publishable, false);
assert.ok(invalid.audit.blockers.includes('one_or_more_input_relationship_evidence_packets_failed_structural_integrity'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].linkedSubjectRelationshipReview.state = 'reviewed';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions(promotedRecords, { relationshipEvidenceRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipDispositions(accountRecords, { relationshipEvidenceRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_source_relationship_dispositions'));

const compiled = compileRelationshipDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRuleKeys, []);
assert.deepEqual(compiled.duplicateRuleKeys, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Generic unresolved collection-member source-relationship disposition checks passed.');
