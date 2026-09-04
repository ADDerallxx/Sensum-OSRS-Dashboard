import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence,
  buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence
} from '../transforms/activity-reference-collection-member-unresolved-subject-relationship-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-unresolved-subject-relationship-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-unresolved-subject-relationship-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-unresolved-subject-relationship-evidence-audit-v1.json', 'utf8'));

function source({ key, label, subjectClass, reciprocal = false }) {
  const pageId = 100 + key.length;
  const revision = `200${key.length}`;
  const title = `Example ${key}`;
  const collectionContext = {
    collectionSource: { candidateKey: 'collection:1', pageId: 1, title: 'Collection', revision: '999', timestamp: '2026-09-01T00:00:00Z', url: 'https://example.test/collection', contentHash: 'collection-hash' },
    sectionEvidence: { heading: 'Activities', level: 2, sourceLocator: { lineStart: 10, lineEnd: 10 } },
    tableEvidence: { sourceTableOrdinal: 1, memberHeader: 'Activity', logicalHeaders: ['Activity', 'Description'], sourceLocator: { lineStart: 11, lineEnd: 30 } },
    rowEvidence: { sourceRowOrdinal: 1, rawText: `[[${title}|${label}]]`, cells: [{ plainText: label }], sourceLocator: { lineStart: 12, lineEnd: 13 } },
    memberCellEvidence: { plainText: label, rawValue: `[[${title}|${label}]]`, sourceLocator: { lineStart: 12, lineEnd: 12 } },
    memberLinks: [{ occurrence: 1, requestedTitle: title, requestedFragment: null, displayText: label, rawLink: `[[${title}|${label}]]`, sourceLocator: { lineStart: 12, lineEnd: 12 } }],
    membershipClassification: 'minigame_like_activity'
  };
  return {
    contract: policy.inputSourceSignatureContract,
    memberCandidateKey: key,
    sourceRoutingContentHash: `old-routing-${key}`,
    sourceMemberDispositionContentHash: `member-disposition-${key}`,
    sourceMemberEvidenceContentHash: `member-evidence-${key}`,
    collectionContext,
    memberIdentityContexts: [{ pageId, resolvedTitle: title, observedRevision: revision }],
    sourcePageId: pageId,
    resolvedTitle: title,
    membershipClassification: 'minigame_like_activity',
    sourceRevision: revision,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    sourceContentBytes: 100,
    sourceDisposition: { state: 'unresolved_no_supported_source_declaration', disposition: null },
    routingDecision: { routeKey: 'broader_source_signature_subject_review' },
    sourceBlockers: ['source-blocker'],
    revisionAlignment: { aligned: true },
    rootTemplates: [{ template: 'Infobox Example', templateKey: 'infobox example', line: 1 }],
    rootTemplateDelimiterAudit: { balanced: true },
    directCategories: [{ category: 'Activities', line: 20 }],
    leadParagraphEvidence: [{ ordinal: 1, rawText: reciprocal ? `${label} is explicitly mentioned.` : 'A different description.', sourceLocator: { lineStart: 2, lineEnd: 2 } }],
    headingEvidence: [{ ordinal: 1, normalizedTitle: reciprocal ? label : 'Details', rawTitle: reciprocal ? label : 'Details', line: 3 }],
    sourceAuthoredLinks: [
      { ordinal: 1, requestedTitle: reciprocal ? label : 'Other page', displayText: null, namespaceClass: 'main', sourceLocator: { line: 2 } },
      { ordinal: 2, requestedTitle: 'File:Image.png', displayText: null, namespaceClass: 'non_main', sourceLocator: { line: 4 } }
    ],
    sourceLinkDelimiterAudit: { balanced: true },
    subjectIdentityReview: { state: 'unreviewed' },
    linkedSubjectRelationshipReview: { state: 'unreviewed' },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed' },
    memberExpansionReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['source-subject-unresolved'],
    contentHash: `signature-${key}`,
    subjectClass
  };
}

function route(sourceRecord, subjectClass) {
  return {
    contract: policy.inputRoutingContract,
    memberCandidateKey: sourceRecord.memberCandidateKey,
    sourceSignatureDispositionContentHash: `signature-disposition-${sourceRecord.memberCandidateKey}`,
    sourceSignatureContentHash: sourceRecord.contentHash,
    sourceRoutingContentHash: sourceRecord.sourceRoutingContentHash,
    sourceMemberDispositionContentHash: sourceRecord.sourceMemberDispositionContentHash,
    sourceMemberEvidenceContentHash: sourceRecord.sourceMemberEvidenceContentHash,
    collectionContext: sourceRecord.collectionContext,
    memberIdentityContexts: sourceRecord.memberIdentityContexts,
    sourcePageId: sourceRecord.sourcePageId,
    resolvedTitle: sourceRecord.resolvedTitle,
    membershipClassification: sourceRecord.membershipClassification,
    sourceRevision: sourceRecord.sourceRevision,
    sourceTimestamp: sourceRecord.sourceTimestamp,
    sourceUrl: sourceRecord.sourceUrl,
    sourceContentHash: sourceRecord.sourceContentHash,
    sourcePageSubjectDisposition: { state: 'source_signature_supported', disposition: subjectClass },
    dispositionSignals: [{ signalKind: 'exact_mapped_root_template', sourcePageSubjectClass: subjectClass }],
    sourceBlockers: sourceRecord.sourceBlockers,
    sourceSignatureBlockers: sourceRecord.blockers,
    sourceDispositionBlockers: ['disposition-blocker'],
    routingDecision: { routeKey: `${subjectClass}-review`, routeState: 'queued', requiredEvidenceDomains: ['relationship'], expansionAxes: [] },
    collectionActivityIdentityReview: { state: 'unreviewed' },
    linkedSubjectRelationshipReview: { state: 'unreviewed' },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed' },
    memberExpansionReview: { state: 'unreviewed' },
    mechanicsReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['relationship-work-pending'],
    contentHash: `relationship-route-${sourceRecord.memberCandidateKey}`
  };
}

const sources = [
  source({ key: 'activity', label: 'Activity label', subjectClass: 'activity_page', reciprocal: true }),
  source({ key: 'npc', label: 'NPC activity', subjectClass: 'npc_page', reciprocal: false }),
  source({ key: 'scenery', label: 'Scenery activity', subjectClass: 'scenery_object_page', reciprocal: false })
];
const routes = [route(sources[0], 'activity_page'), route(sources[1], 'npc_page'), route(sources[2], 'scenery_object_page')];
const built = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence({ routingRecords: routes, sourceSignatureRecords: sources, policy });

assert.equal(built.audit.publishable, true);
assert.equal(built.audit.relationshipEvidencePacketCoverageComplete, true);
assert.equal(built.audit.collectionActivityIdentityReviewComplete, false);
assert.equal(built.audit.linkedSubjectRelationshipReviewComplete, false);
assert.equal(built.audit.inputCoverage.exactInputOutputSetContextAndSourceJoinMatch, true);
assert.equal(built.audit.evidenceCoverage.collectionMembershipEvidenceCount, 3);
assert.equal(built.audit.evidenceCoverage.totalLinkedSourceContentBytes, 300);
assert.equal(built.audit.evidenceCoverage.sourceAuthoredLinkOccurrenceCount, 6);
assert.equal(built.audit.evidenceCoverage.mainNamespaceLinkOccurrenceCount, 3);
assert.equal(built.audit.candidateObservationCoverage.collectionRowLinkCandidateCount, 3);
assert.equal(built.audit.candidateObservationCoverage.exactMemberLabelSourceLinkMatchCount, 1);
assert.equal(built.audit.candidateObservationCoverage.exactMemberLabelLeadMentionCount, 1);
assert.equal(built.audit.candidateObservationCoverage.exactMemberLabelHeadingMentionCount, 1);
assert.equal(built.audit.candidateObservationCoverage.relationshipVerdictCount, 0);
assert.ok(built.records.every(record => record.relationshipCandidateObservations.relationshipVerdict === null && record.linkedSubjectRelationshipReview.state === 'unreviewed' && record.optimizerEligible === false));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const changedLabelSource = structuredClone(sources[1]);
changedLabelSource.collectionContext.memberCellEvidence.plainText = 'Activity label';
changedLabelSource.collectionContext.memberLinks[0].displayText = 'Activity label';
changedLabelSource.contentHash = 'signature-npc-changed';
const changedLabelRoute = route(changedLabelSource, 'npc_page');
const changedLabel = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence({ routingRecords: [changedLabelRoute], sourceSignatureRecords: [changedLabelSource], policy });
assert.equal(changedLabel.records[0].routingDecision.routeKey, 'npc_page-review');
assert.equal(changedLabel.records[0].linkedSubjectRelationshipReview.state, 'unreviewed');
assert.equal(changedLabel.records[0].relationshipCandidateObservations.relationshipVerdict, null);

const badHashRoutes = structuredClone(routes);
badHashRoutes[0].sourceSignatureContentHash = 'wrong';
const badHash = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence({ routingRecords: badHashRoutes, sourceSignatureRecords: sources, policy });
assert.equal(badHash.audit.publishable, false);
assert.ok(badHash.audit.blockers.includes('one_or_more_routes_did_not_join_exactly_one_source_signature_by_member_key_hash_identity_revision_and_context'));

const alteredEvidenceRecords = structuredClone(built.records);
alteredEvidenceRecords[0].sourcePageEvidence.sourceAuthoredLinks = [];
const alteredEvidence = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence(alteredEvidenceRecords, { routingRecords: routes, sourceSignatureRecords: sources, policy });
assert.equal(alteredEvidence.publishable, false);
assert.ok(alteredEvidence.blockers.includes('one_or_more_collection_row_or_source_page_evidence_sets_changed_or_were_lost'));

const inferredRecords = structuredClone(built.records);
inferredRecords[0].relationshipCandidateObservations.relationshipVerdict = 'same_activity';
const inferred = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence(inferredRecords, { routingRecords: routes, sourceSignatureRecords: sources, policy });
assert.equal(inferred.publishable, false);
assert.ok(inferred.blockers.includes('one_or_more_relationship_candidate_observation_sets_invalid'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { activity: 'same_activity' };
const forbidden = buildActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence({ routingRecords: routes, sourceSignatureRecords: sources, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_class_relationship_evidence_policy_forbidden'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].linkedSubjectRelationshipReview.state = 'reviewed';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence(promotedRecords, { routingRecords: routes, sourceSignatureRecords: sources, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_collection_identity_relationship_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberUnresolvedSubjectRelationshipEvidence(accountRecords, { routingRecords: routes, sourceSignatureRecords: sources, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_relationship_evidence_packets'));

console.log('Revision-pinned unresolved collection-member relationship-evidence checks passed.');
