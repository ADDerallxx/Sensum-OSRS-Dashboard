import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions,
  buildActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions
} from '../transforms/activity-reference-collection-member-unresolved-subject-signature-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-unresolved-subject-signature-disposition-v1.json', 'utf8'));
const entityTypePolicy = JSON.parse(fs.readFileSync(policy.sourceEntityTypePolicy.file, 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

function signature({ key, title, template, collectionLabel = 'Display label', membershipClassification = 'minigame_like_activity' }) {
  const sourcePageId = 100 + key.length;
  const sourceRevision = String(200 + key.length);
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    sourceRoutingContentHash: `routing-${key}`,
    sourceMemberDispositionContentHash: `member-disposition-${key}`,
    sourceMemberEvidenceContentHash: `member-evidence-${key}`,
    collectionContext: { memberCellEvidence: { plainText: collectionLabel }, memberLinks: [{ requestedTitle: title, displayText: collectionLabel }] },
    memberIdentityContexts: [{ pageId: sourcePageId, resolvedTitle: title, observedRevision: sourceRevision, observedTimestamp: '2026-09-04T00:00:00Z', observedSourceUrl: `https://example.test/${key}`, observedContentHash: `source-${key}` }],
    sourcePageId,
    resolvedTitle: title,
    membershipClassification,
    sourceRevision,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    sourceDisposition: { state: 'unresolved_no_supported_source_declaration', disposition: null, conflictingDispositions: [] },
    routingDecision: { routeKey: 'broader_source_signature_subject_review', routeState: 'blocked_unsupported_subject_declaration', sourceState: 'unresolved_no_supported_source_declaration' },
    sourceBlockers: ['no_supported_source_subject_disposition'],
    rootTemplates: template ? [{ template, templateKey: template.toLowerCase(), line: 1 }] : [{ template: 'External', templateKey: 'external', line: 1 }],
    rootTemplateDelimiterAudit: { openCount: 1, closeCount: 1, finalDepth: 0, underflow: false, balanced: true },
    directCategories: [{ category: 'Activities', categoryKey: 'activities', line: 20 }],
    leadParagraphEvidence: [{ rawText: `'''${title}''' is described here.`, sourceLocator: { lineStart: 2, lineEnd: 2 } }],
    headingEvidence: [],
    sourceAuthoredLinks: [{ namespaceClass: 'main', requestedTitle: 'Another page' }],
    sourceLinkDelimiterAudit: { openCount: 1, closeCount: 1, balanced: true },
    subjectIdentityReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
    linkedSubjectRelationshipReview: { state: 'unreviewed', relationships: [], evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['source_subject_disposition_still_unresolved'],
    state: 'review_evidence_collected_subject_unresolved',
    contentHash: `signature-${key}`
  };
}

const inputs = [
  signature({ key: 'target', title: 'Target (Ranging Guild)', template: 'Infobox Scenery', collectionLabel: 'Archery Competition' }),
  signature({ key: 'foreman', title: 'Vineyard foreman', template: 'Infobox NPC', collectionLabel: 'Aldarin Vineyard' }),
  signature({ key: 'tasks', title: 'Wise Old Man tasks', template: 'Infobox Activity' })
];
const built = buildActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions({ sourceSignatureRecords: inputs, policy, entityTypePolicy });
const byKey = new Map(built.records.map(record => [record.memberCandidateKey, record]));

check(byKey.get('target').sourcePageSubjectDisposition.disposition === 'scenery_object_page', 'Infobox Scenery must generically classify the exact source page as scenery.');
check(byKey.get('foreman').sourcePageSubjectDisposition.disposition === 'npc_page', 'Infobox NPC must generically classify the exact source page as an NPC.');
check(byKey.get('tasks').sourcePageSubjectDisposition.disposition === 'activity_page' && byKey.get('tasks').blockers.includes('activity_page_type_does_not_prove_repeatability'), 'Infobox Activity may classify the page but must not prove a repeatable activity.');
check(built.records.every(record => record.dispositionSignals.length === 1 && record.dispositionSignals[0].signalKind === 'exact_mapped_root_template'), 'Only exact mapped root templates may act as disposition signals.');
check(built.audit.dispositionAttemptCoverageComplete && built.audit.sourcePageSubjectDispositionComplete && built.audit.publishable, 'All three generic source-page dispositions should publish when structural checks pass.');
check(built.audit.sourcePageSubjectDispositionCoverage.sourceSupportedCount === 3 && JSON.stringify(built.audit.sourcePageSubjectDispositionCoverage.subjectClassCounts) === JSON.stringify({ activity_page: 1, npc_page: 1, scenery_object_page: 1 }), 'The audit must measure each exact source-page class.');
check(!built.audit.collectionActivityIdentityReviewComplete && !built.audit.linkedSubjectRelationshipReviewComplete && built.audit.semanticPromotionCoverage.optimizerEligibleCount === 0, 'Source-page classification must leave collection identity, relationships, and optimizer promotion closed.');

const relabelledInputs = inputs.map((record, index) => index ? record : { ...record, contentHash: 'signature-target-relabelled', collectionContext: { ...record.collectionContext, memberCellEvidence: { plainText: 'Completely different label' } } });
const relabelled = buildActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions({ sourceSignatureRecords: relabelledInputs, policy, entityTypePolicy }).records[0];
check(JSON.stringify(relabelled.sourcePageSubjectDisposition) === JSON.stringify(byKey.get('target').sourcePageSubjectDisposition) && JSON.stringify(relabelled.dispositionSignals) === JSON.stringify(byKey.get('target').dispositionSignals), 'Collection labels must not alter or break source-page disposition ties.');

const conflictingInput = signature({ key: 'conflict', title: 'Conflict', template: 'Infobox NPC' });
conflictingInput.rootTemplates.push({ template: 'Infobox Activity', templateKey: 'infobox activity', line: 2 });
const conflict = buildActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions({ sourceSignatureRecords: [conflictingInput], policy, entityTypePolicy });
check(conflict.records[0].sourcePageSubjectDisposition.state === 'blocked_conflicting_mapped_root_template_classes' && conflict.records[0].sourcePageSubjectDisposition.disposition === null && !conflict.audit.sourcePageSubjectDispositionComplete, 'Distinct mapped root-template classes must remain an explicit conflict.');

const unresolved = buildActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions({ sourceSignatureRecords: [signature({ key: 'unknown', title: 'Unknown', template: null })], policy, entityTypePolicy });
check(unresolved.records[0].sourcePageSubjectDisposition.state === 'unresolved_no_mapped_root_template_class' && unresolved.records[0].dispositionSignals.length === 0 && !unresolved.audit.sourcePageSubjectDispositionComplete, 'An unmapped root-template signature must remain unresolved even if a fallback category exists.');

const changedContext = auditActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions([{ ...built.records[0], membershipClassification: 'changed' }, ...built.records.slice(1)], { sourceSignatureRecords: inputs, policy, entityTypePolicy });
check(!changedContext.publishable && changedContext.inputCoverage.contextMismatchMemberCandidateKeys.length === 1, 'Changing preserved input context must fail publication.');
const changedDisposition = auditActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions([{ ...built.records[0], sourcePageSubjectDisposition: { ...built.records[0].sourcePageSubjectDisposition, disposition: 'activity_page' } }, ...built.records.slice(1)], { sourceSignatureRecords: inputs, policy, entityTypePolicy });
check(!changedDisposition.publishable && changedDisposition.sourcePageSubjectDispositionCoverage.invalidDispositionMemberCandidateKeys.includes('target'), 'A disposition unsupported by the exact mapped root template must fail publication.');
const forbidden = buildActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions({ sourceSignatureRecords: inputs, policy: { ...policy, overrides: { target: 'scenery_object_page' } }, entityTypePolicy });
check(!forbidden.audit.publishable && forbidden.audit.blockers.includes('page_specific_or_collection_class_signature_disposition_policy_forbidden'), 'Page-specific policy overrides must fail publication.');
const promoted = auditActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions([{ ...built.records[0], optimizerEligible: true }, ...built.records.slice(1)], { sourceSignatureRecords: inputs, policy, entityTypePolicy });
check(!promoted.publishable && promoted.semanticPromotionCoverage.unsupportedPromotionMemberCandidateKeys.includes('target'), 'Optimizer promotion must remain structurally forbidden.');
const accountScoped = auditActivityReferenceCollectionMemberUnresolvedSubjectSignatureDispositions([{ ...built.records[0], currentBaseLevel: 34 }, ...built.records.slice(1)], { sourceSignatureRecords: inputs, policy, entityTypePolicy });
check(!accountScoped.publishable && accountScoped.accountStateFindings.length === 1, 'Reusable source-page disposition must reject current-account state.');

if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Unresolved collection-member source-signature disposition checks passed.');
