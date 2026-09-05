import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence,
  buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence,
  compileIndependentRepeatabilitySignalScopeEvidencePolicy,
  discoverIndependentRepeatabilitySignalScopeLinkRequests,
  selectIndependentRepeatabilitySignalScopeRoutes
} from '../ingestion/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync(
  'platform/policies/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-v1.json',
  'utf8'
));
const recordContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-v1.json',
  'utf8'
));
const auditContract = JSON.parse(fs.readFileSync(
  'platform/contracts/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-audit-v1.json',
  'utf8'
));
const hash = value => createHash('sha256')
  .update(typeof value === 'string' ? value : JSON.stringify(value))
  .digest('hex');

const pageOneContent = 'Page one source.';
const pageTwoContent = 'Page two source.';
const pageOneHash = hash(pageOneContent);
const pageTwoHash = hash(pageTwoContent);

const signal = ({ key, pageId, revision, sourceHash, line, kind = 'explicit_positive_repeatability_declaration_candidate' }) => ({
  contextText: 'Exact retained source line.',
  definitionKey: kind === 'session_boundary_candidate' ? 'session_end_boundary' : 'explicit_positive_repeatable_adjective',
  evidenceKey: key,
  matchedText: kind === 'session_boundary_candidate' ? 'at the end of the game' : 'repeatable',
  reviewState: 'candidate_only_not_a_repeatability_verdict',
  scannedTextHash: sourceHash,
  signalKind: kind,
  sourceContentHash: sourceHash,
  sourceLocator: { columnStart: 1, columnEnd: 10, lineStart: line, lineEnd: line },
  sourcePageId: pageId,
  sourceRevision: revision,
  sourceScope: 'candidate-pageid-' + pageId
});

const link = ({ key, title, line, pageId = 200, revision = '2000', sourceHash = pageOneHash, namespaceClass = 'main' }) => ({
  channels: ['independent_repeatability_source_discovery'],
  displayText: null,
  guideContentHash: sourceHash,
  guidePageId: pageId,
  guideRevision: revision,
  guideTimestamp: '2026-09-04T00:00:00Z',
  guideTitle: 'Candidate page ' + pageId,
  guideUrl: 'https://oldschool.runescape.wiki/w/Candidate_page_' + pageId,
  namespaceClass,
  occurrenceKey: key,
  requestedFragment: null,
  requestedTitle: title,
  skillKeys: [],
  sourceLocator: { excerpt: 'source link', line },
  sourceTarget: title
});

const input = () => ({
  contract: 'sensum.activity-reference-collection-member-independent-repeatability-source-evidence.v1',
  memberCandidateKey: 'member:example',
  canonicalActivityIdentity: {
    canonicalActivityKey: 'activity:example',
    canonicalLabel: 'Example activity',
    stableIdentityAnchor: {
      linkedSubjectPageId: 777,
      collectionPageId: 50,
      relationshipClass: 'describes'
    }
  },
  repeatabilityDisposition: { state: 'unresolved', classification: null },
  repeatabilityReview: { state: 'reviewed_blocked', classification: null },
  corroboratingRepeatabilityDisposition: { state: 'unresolved', classification: null },
  corroboratingRepeatabilityReview: { state: 'reviewed_blocked', classification: null },
  independentRepeatabilitySourceEvidence: {
    evidenceState: 'complete_revision_pinned_independent_repeatability_source_evidence_packet',
    discoveryBoundary: {},
    candidatePages: [
      {
        sourcePageId: 200,
        resolvedTitle: 'Candidate page 200',
        sourceRevision: '2000',
        sourceTimestamp: '2026-09-04T00:00:00Z',
        sourceUrl: 'https://oldschool.runescape.wiki/w/Candidate_page_200',
        sourceContentHash: pageOneHash,
        completeRevisionContentScanned: true,
        sourceAuthoredLinks: [
          link({ key: 'link:anchor', title: 'Activity anchor', line: 10 }),
          link({ key: 'link:other', title: 'Other page', line: 10 }),
          link({ key: 'link:outside', title: 'Outside line', line: 9 }),
          link({ key: 'link:file', title: 'File:Image.png', line: 10, namespaceClass: 'non_main' })
        ],
        sourceLocatedSignals: [
          signal({ key: 'signal:linked', pageId: 200, revision: '2000', sourceHash: pageOneHash, line: 10 }),
          signal({ key: 'signal:no-link', pageId: 200, revision: '2000', sourceHash: pageOneHash, line: 20, kind: 'session_boundary_candidate' })
        ],
        canonicalActivityScopeVerdict: null,
        repeatabilityVerdict: null
      },
      {
        sourcePageId: 201,
        resolvedTitle: 'Candidate page 201',
        sourceRevision: '2010',
        sourceTimestamp: '2026-09-04T00:00:00Z',
        sourceUrl: 'https://oldschool.runescape.wiki/w/Candidate_page_201',
        sourceContentHash: pageTwoHash,
        completeRevisionContentScanned: true,
        sourceAuthoredLinks: [
          link({
            key: 'link:alias',
            title: 'Activity alias',
            line: 5,
            pageId: 201,
            revision: '2010',
            sourceHash: pageTwoHash
          })
        ],
        sourceLocatedSignals: [
          signal({ key: 'signal:alias', pageId: 201, revision: '2010', sourceHash: pageTwoHash, line: 5 })
        ],
        canonicalActivityScopeVerdict: null,
        repeatabilityVerdict: null
      }
    ]
  },
  independentRepeatabilityCandidateObservations: {
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    deficiencies: []
  },
  memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
  mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
  optimizerEligible: false,
  accountIndependent: true,
  blockers: ['repeatability_classification_unresolved'],
  state: 'independent_repeatability_source_evidence_ready_for_semantic_disposition',
  contentHash: 'input-content-hash'
});

const resolution = ({ requestedTitle, pageId, resolvedTitle, content, redirected = false }) => ({
  requestedTitle,
  normalizedTitle: requestedTitle,
  resolvedTitle,
  redirected,
  page: {
    pageid: pageId,
    ns: 0,
    title: resolvedTitle,
    revisions: [{
      revid: pageId * 10,
      timestamp: '2026-09-04T01:00:00Z',
      slots: { main: { content } }
    }]
  }
});

const resolutions = [
  resolution({ requestedTitle: 'Activity anchor', pageId: 777, resolvedTitle: 'Canonical anchor page', content: 'Anchor source.' }),
  resolution({ requestedTitle: 'Activity alias', pageId: 777, resolvedTitle: 'Canonical anchor page', content: 'Anchor source.', redirected: true }),
  resolution({ requestedTitle: 'Other page', pageId: 888, resolvedTitle: 'Other page', content: 'Other source.' })
];

const record = input();
assert.equal(selectIndependentRepeatabilitySignalScopeRoutes([record], policy).length, 1);
const requests = discoverIndependentRepeatabilitySignalScopeLinkRequests([record], policy);
assert.deepEqual(requests.map(request => request.requestedTitle), ['Activity alias', 'Activity anchor', 'Other page']);
assert.equal(requests.reduce((sum, request) => sum + request.linkOccurrenceContexts.length, 0), 3);

const built = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence({
  sourceEvidenceRecords: [record],
  targetResolutions: resolutions,
  policy,
  contentHash: hash
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.signalScopeEvidenceAttemptCoverageComplete, true);
assert.equal(built.audit.independentSignalScopeEvidenceCoverageComplete, true);
assert.equal(built.audit.signalCoverage.sourceLocatedSignalCount, 3);
assert.equal(built.audit.signalCoverage.signalScopeEvidencePacketCount, 3);
assert.equal(built.audit.signalCoverage.signalsWithExactLineMainNamespaceLinks, 2);
assert.equal(built.audit.signalCoverage.signalsWithoutExactLineMainNamespaceLinks, 1);
assert.equal(built.audit.exactLineLinkCoverage.expectedLinkOccurrenceCount, 3);
assert.equal(built.audit.exactLineLinkCoverage.preservedLinkOccurrenceCount, 3);
assert.equal(built.audit.resolutionCoverage.distinctRequestedTitleCount, 3);
assert.equal(built.audit.resolutionCoverage.attemptedRequestedTitleCount, 3);
assert.equal(built.audit.resolutionCoverage.revisionPinnedResolutionAssessmentCount, 3);
assert.equal(built.audit.resolutionCoverage.uniqueResolvedTargetPageCount, 2);
assert.equal(built.audit.resolutionCoverage.redirectedResolutionAssessmentCount, 1);
assert.equal(built.audit.stableIdentityComparisonCoverage.targetOccurrenceMatchesLinkedSubjectAnchorCount, 2);
assert.equal(built.audit.stableIdentityComparisonCoverage.canonicalActivityScopeVerdictCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.repeatabilityVerdictCount, 0);
const output = built.records[0];
assert.equal(output.independentRepeatabilitySignalScopeObservations.canonicalActivityScopeVerdict, null);
assert.equal(output.independentRepeatabilitySignalScopeObservations.repeatabilityVerdict, null);
assert.equal(output.independentRepeatabilitySignalScopeEvidence.resolvedTargetPages.length, 2);
assert.equal(
  output.independentRepeatabilitySignalScopeEvidence.resolvedTargetPages
    .find(page => page.targetPageIdentity.sourcePageId === 777).linkOccurrenceContexts.length,
  2
);
const noLinkPacket = output.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets
  .find(packet => packet.signalEvidenceKey === 'signal:no-link');
assert.equal(noLinkPacket.state, 'complete_no_source_authored_main_namespace_link_on_exact_signal_line');
assert.deepEqual(noLinkPacket.limitations, ['no_source_authored_main_namespace_link_on_exact_signal_line']);
assert.equal(noLinkPacket.canonicalActivityScopeVerdict, null);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), 'Missing required record field: ' + field);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), 'Missing required audit field: ' + field);

const missingResolution = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence({
  sourceEvidenceRecords: [record],
  targetResolutions: resolutions.slice(0, 2),
  policy,
  contentHash: hash
});
assert.equal(missingResolution.audit.publishable, false);
assert.ok(missingResolution.audit.blockers.includes('one_or_more_exact_line_link_targets_lack_revision_pinned_main_namespace_identity'));

const misalignedInput = input();
misalignedInput.independentRepeatabilitySourceEvidence.candidatePages[0].sourceAuthoredLinks[0].guideContentHash = 'wrong-hash';
const misaligned = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence({
  sourceEvidenceRecords: [misalignedInput],
  targetResolutions: resolutions,
  policy,
  contentHash: hash
});
assert.equal(misaligned.audit.publishable, false);

const tamperedRecords = structuredClone(built.records);
tamperedRecords[0].independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0]
  .linkResolutionAssessments[0].targetPageIdentity.sourceRevision = '999';
const tampered = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence(tamperedRecords, {
  sourceEvidenceRecords: [record],
  targetResolutions: resolutions,
  policy,
  contentHash: hash
});
assert.equal(tampered.publishable, false);
assert.ok(tampered.blockers.includes('one_or_more_signal_scope_evidence_packets_do_not_match_inputs_and_resolutions'));

const mutatedRecords = structuredClone(built.records);
mutatedRecords[0].repeatabilityDisposition.classification = 'repeatable';
const mutated = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence(mutatedRecords, {
  sourceEvidenceRecords: [record],
  targetResolutions: resolutions,
  policy,
  contentHash: hash
});
assert.equal(mutated.publishable, false);
assert.ok(mutated.blockers.includes('scope_evidence_collection_changed_upstream_evidence_disposition_or_review'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0].canonicalActivityScopeVerdict = 'in_scope';
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence(promotedRecords, {
  sourceEvidenceRecords: [record],
  targetResolutions: resolutions,
  policy,
  contentHash: hash
});
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('scope_evidence_created_unsupported_scope_repeatability_or_downstream_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].preferences = { afk: true };
const accountScoped = auditActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence(accountRecords, {
  sourceEvidenceRecords: [record],
  targetResolutions: resolutions,
  policy,
  contentHash: hash
});
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_signal_scope_evidence'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.pageIds = [777];
const forbidden = buildActivityReferenceCollectionMemberIndependentRepeatabilitySignalScopeEvidence({
  sourceEvidenceRecords: [record],
  targetResolutions: resolutions,
  policy: forbiddenPolicy,
  contentHash: hash
});
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('independent_repeatability_signal_scope_evidence_policy_invalid_or_incomplete'));

const compiled = compileIndependentRepeatabilitySignalScopeEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Independent revision-pinned repeatability signal-scope evidence checks passed.');
