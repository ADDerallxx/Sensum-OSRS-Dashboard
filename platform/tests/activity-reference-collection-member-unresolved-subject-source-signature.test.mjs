import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures,
  auditSourceTemplateDelimiters,
  buildActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures,
  selectUnresolvedSubjectSourceSignatureRoutes
} from '../ingestion/activity-reference-collection-member-unresolved-subject-source-signature-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-unresolved-subject-source-signature-v1.json', 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const content = `<!-- {{Infobox Item}} [[Hidden page]] -->
{{Infobox NPC
|name=Example foreman
}}
'''Example foreman''' directs work at the [[Aldarin Vineyard]] and gives players [[Grapes|grapes]].

==Tasks==
Players may ask about [[Wise Old Man tasks]].
[[Category:Non-player characters]]`;

function route(overrides = {}) {
  const sourcePageId = 123;
  const resolvedTitle = 'Example foreman';
  const sourceRevision = '456';
  const sourceTimestamp = '2026-09-04T00:00:00Z';
  const sourceUrl = 'https://oldschool.runescape.wiki/w/Example_foreman';
  const sourceContentHash = hash(content);
  return {
    contract: policy.inputContract,
    memberCandidateKey: 'collection-row:1:2:activities:1:1',
    sourceMemberDispositionContentHash: 'disposition-hash',
    sourceMemberEvidenceContentHash: 'evidence-hash',
    collectionContext: { memberCellEvidence: { plainText: 'A display label that is not the page title' }, memberLinks: [{ requestedTitle: resolvedTitle, displayText: 'A display label that is not the page title' }] },
    memberIdentityContexts: [{ pageId: sourcePageId, resolvedTitle, observedRevision: sourceRevision, observedTimestamp: sourceTimestamp, observedSourceUrl: sourceUrl, observedContentHash: sourceContentHash }],
    sourcePageId,
    resolvedTitle,
    membershipClassification: 'minigame_like_activity',
    sourceRevision,
    sourceTimestamp,
    sourceUrl,
    sourceContentHash,
    sourceDisposition: { state: policy.inputRoute.sourceState, disposition: null, conflictingDispositions: [] },
    dispositionSignals: [],
    sourceBlockers: ['no_supported_source_subject_disposition'],
    routingDecision: { routeKey: policy.inputRoute.routeKey, routeState: policy.inputRoute.routeState, sourceState: policy.inputRoute.sourceState },
    accountIndependent: true,
    optimizerEligible: false,
    contentHash: 'routing-hash',
    ...overrides
  };
}

const input = route();
const fetchedPages = [{ pageid: input.sourcePageId, title: input.resolvedTitle, revisions: [{ revid: Number(input.sourceRevision), timestamp: input.sourceTimestamp, slots: { main: { content } } }] }];
const built = buildActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures({ routingRecords: [input], fetchedPages, policy, contentHash: hash });
const record = built.records[0];

check(selectUnresolvedSubjectSourceSignatureRoutes([input, route({ memberCandidateKey: 'ignored', routingDecision: { routeKey: 'another_route', routeState: 'queued' } })], policy).length === 1, 'Only the generic broader-signature unresolved-subject route may enter this packet.');
check(record.rootTemplates.map(value => value.template).join('|') === 'Infobox NPC', 'Root template evidence must exclude commented templates and preserve the exact source template.');
check(record.directCategories.length === 1 && record.directCategories[0].category === 'Non-player characters', 'Direct category evidence must remain source-located.');
check(record.leadParagraphEvidence.length === 1 && record.headingEvidence.length === 1, 'Lead and heading declarations must be retained without interpreting them.');
check(record.sourceAuthoredLinks.length === 4 && record.sourceAuthoredLinks.every((link, index) => link.ordinal === index + 1), 'Every genuine direct wikilink occurrence must be retained in source order while commented links stay excluded.');
check(record.sourceAuthoredLinks.filter(link => link.namespaceClass === 'main').length === 3 && record.sourceAuthoredLinks.every(link => link.relationshipState === 'unreviewed_candidate_only'), 'Linked pages must remain relationship candidates rather than canonical relationships.');
check(record.revisionAlignment.fetchedContentHashMatchesRoutingRecord && record.sourceContentHash === hash(content), 'The packet must reconcile the exact fetched content with the retained routing hash.');
check(record.subjectIdentityReview.state === 'unreviewed' && record.linkedSubjectRelationshipReview.state === 'unreviewed' && record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null && record.optimizerEligible === false, 'Structural evidence cannot promote subject identity, relationships, repeatability, or optimizer eligibility.');
check(built.audit.sourceSignatureCoverageComplete && built.audit.publishable && !built.audit.subjectIdentityReviewComplete && !built.audit.linkedSubjectRelationshipReviewComplete, 'Complete structural collection must remain distinct from unresolved semantic review.');
check(built.audit.structuralEvidenceCoverage.sourceAuthoredLinkOccurrenceCount === 4 && built.audit.structuralEvidenceCoverage.mainNamespaceLinkOccurrenceCount === 3, 'The audit must report complete direct-link evidence counts.');
check(auditSourceTemplateDelimiters('{{A|x={{B}}}}').balanced && !auditSourceTemplateDelimiters('{{A').balanced && auditSourceTemplateDelimiters('<!-- {{A -->').balanced, 'Template delimiter validation must handle nesting, imbalance, and ignored comments.');

const relabelled = route({ collectionContext: { ...input.collectionContext, memberCellEvidence: { plainText: 'Entirely different collection label' } } });
const relabelledBuilt = buildActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures({ routingRecords: [relabelled], fetchedPages, policy, contentHash: hash });
check(JSON.stringify({ ...record, collectionContext: null }) === JSON.stringify({ ...relabelledBuilt.records[0], collectionContext: null }), 'Changing collection display context must not change exact-revision source evidence or review state.');

const changedContext = auditActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures([{ ...record, membershipClassification: 'changed' }], { routingRecords: [input], fetchedPages, policy });
check(!changedContext.publishable && changedContext.inputCoverage.contextMismatchMemberCandidateKeys.length === 1, 'Changing input identity, hashes, membership, collection, or alias context must fail publication.');
const changedEvidence = auditActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures([{ ...record, sourceAuthoredLinks: record.sourceAuthoredLinks.slice(1) }], { routingRecords: [input], fetchedPages, policy });
check(!changedEvidence.publishable && changedEvidence.structuralEvidenceCoverage.exactRevisionEvidenceMismatchMemberCandidateKeys.length === 1, 'Dropping exact-revision structural evidence must fail publication.');

const hashMismatchInput = route({ sourceContentHash: 'wrong', memberIdentityContexts: [{ ...input.memberIdentityContexts[0], observedContentHash: 'wrong' }] });
const hashMismatch = buildActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures({ routingRecords: [hashMismatchInput], fetchedPages, policy, contentHash: hash });
check(!hashMismatch.audit.publishable && hashMismatch.audit.sourceAlignment.failedMemberCandidateKeys.length === 1, 'A fetched-content hash mismatch must remain an explicit structural blocker.');

const brokenContent = '{{Infobox NPC}}\n[[Broken link';
const brokenInput = route({ sourceContentHash: hash(brokenContent), memberIdentityContexts: [{ ...input.memberIdentityContexts[0], observedContentHash: hash(brokenContent) }] });
const brokenPages = [{ pageid: brokenInput.sourcePageId, title: brokenInput.resolvedTitle, revisions: [{ revid: Number(brokenInput.sourceRevision), timestamp: brokenInput.sourceTimestamp, slots: { main: { content: brokenContent } } }] }];
const broken = buildActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures({ routingRecords: [brokenInput], fetchedPages: brokenPages, policy, contentHash: hash });
check(!broken.audit.publishable && broken.audit.structuralEvidenceCoverage.linkDelimiterFailureMemberCandidateKeys.length === 1, 'Unbalanced direct-link delimiters must block structural publication.');

const forbiddenPolicy = { ...policy, overrides: { 'Example foreman': 'npc' } };
const forbidden = buildActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures({ routingRecords: [input], fetchedPages, policy: forbiddenPolicy, contentHash: hash });
check(!forbidden.audit.publishable && forbidden.audit.blockers.includes('page_specific_or_collection_class_source_signature_policy_forbidden'), 'Page-specific policy selectors must fail publication.');

const promoted = auditActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures([{ ...record, canonicalGameEntityIdentity: { key: 'invented' } }], { routingRecords: [input], fetchedPages, policy });
check(!promoted.publishable && promoted.semanticPromotionCoverage.unsupportedPromotionMemberCandidateKeys.length === 1, 'Unsupported canonical promotion must fail publication.');
const accountScoped = auditActivityReferenceCollectionMemberUnresolvedSubjectSourceSignatures([{ ...record, currentBaseLevel: 34 }], { routingRecords: [input], fetchedPages, policy });
check(!accountScoped.publishable && accountScoped.accountStateFindings.length === 1, 'Reusable source evidence must reject current-account fields.');

if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Unresolved collection-member exact-revision source-signature checks passed.');
