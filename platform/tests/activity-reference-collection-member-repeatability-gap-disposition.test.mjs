import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberRepeatabilityGapDispositions,
  buildActivityReferenceCollectionMemberRepeatabilityGapDispositions,
  compileRepeatabilityGapDispositionPolicy
} from '../transforms/activity-reference-collection-member-repeatability-gap-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-repeatability-gap-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-gap-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-gap-disposition-audit-v1.json', 'utf8'));

function signal(kind, key) {
  return {
    evidenceKey: `signal:${key}`,
    definitionKey: key,
    signalKind: kind,
    matchedText: kind.includes('negative') ? 'cannot be repeated' : 'can be repeated',
    contextText: kind.includes('negative') ? 'This can not be repeated.' : 'This can be repeated.',
    sourceLocator: { lineStart: 12, lineEnd: 12 }
  };
}

function candidate({ key, signals = [], label = `Activity ${key}` }) {
  return {
    contract: 'sensum.activity-reference-collection-member-repeatability-gap-evidence.v1',
    memberCandidateKey: `member:${key}`,
    sourceRepeatabilityEvidenceWorkRoutingContentHash: `routing:${key}`,
    canonicalActivityIdentity: {
      canonicalActivityKey: `activity:${key}`,
      identityClass: 'collection_defined_activity',
      canonicalLabel: label,
      evidenceKeys: [`identity:${key}`]
    },
    repeatabilityDisposition: {
      state: 'unresolved_recurrence_or_session_structure_without_explicit_declaration',
      classification: null,
      evidenceKeys: [`upstream:${key}`],
      deficiencies: ['recurrence_or_session_structure_is_not_explicit_repeatability_evidence']
    },
    repeatabilityReview: { state: 'reviewed_blocked', classification: null, evidenceKeys: [`upstream:${key}`] },
    corroboratingRepeatabilityEvidence: {
      evidenceState: 'complete_revision_pinned_corroborating_repeatability_evidence_packet',
      discoveryBoundary: { routeKey: 'test-route', candidateRequests: [], candidateRequestAssessments: [] },
      candidatePages: [{
        sourcePageId: 1000 + key.length,
        resolvedTitle: `Source ${key}`,
        sourceRevision: `2000${key.length}`,
        sourceTimestamp: '2026-09-04T00:00:00Z',
        sourceUrl: `https://oldschool.runescape.wiki/w/Source_${key}`,
        sourceContentHash: `source-hash-${key}`,
        completeRevisionContentScanned: true,
        discoveryContexts: [{ channel: 'source_signal_line_main_namespace_link', requestedTitle: `Source ${key}` }],
        sourceLocatedSignals: signals,
        repeatabilityVerdict: null,
        reviewState: 'corroborating_source_candidate_only_not_a_repeatability_verdict'
      }]
    },
    corroboratingRepeatabilityCandidateObservations: {
      candidatePageCount: 1,
      candidateRequestCount: 1,
      discoveryContextCount: 1,
      sourceLocatedSignalCount: signals.length,
      explicitPositiveDeclarationCandidateCount: signals.filter(item => item.signalKind.includes('positive')).length,
      explicitNegativeDeclarationCandidateCount: signals.filter(item => item.signalKind.includes('negative')).length,
      recurrenceStructureCandidateCount: signals.filter(item => item.signalKind === 'recurrence_structure_candidate').length,
      sessionBoundaryCandidateCount: signals.filter(item => item.signalKind === 'session_boundary_candidate').length,
      candidateScopeVerdict: null,
      repeatabilityVerdict: null,
      deficiencies: []
    },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: [
      'repeatability_classification_unresolved',
      'member_expansion_not_reviewed',
      'requirements_xp_timing_and_mechanics_not_structured',
      'optimizer_eligibility_blocked',
      'corroborating_repeatability_evidence_requires_semantic_disposition'
    ],
    state: 'corroborating_repeatability_evidence_collected_without_semantic_promotion',
    contentHash: `gap-evidence-${key}`
  };
}

const inputs = [
  candidate({ key: 'none' }),
  candidate({ key: 'structural', signals: [signal('recurrence_structure_candidate', 'recurrence')] }),
  candidate({ key: 'positive', signals: [signal('explicit_positive_repeatability_declaration_candidate', 'positive')] }),
  candidate({ key: 'negative', signals: [signal('explicit_negative_repeatability_declaration_candidate', 'negative')] }),
  candidate({
    key: 'opposing',
    signals: [
      signal('explicit_positive_repeatability_declaration_candidate', 'positive'),
      signal('explicit_negative_repeatability_declaration_candidate', 'negative')
    ]
  })
];

const built = buildActivityReferenceCollectionMemberRepeatabilityGapDispositions({ gapEvidenceRecords: inputs, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.repeatabilityGapDispositionAttemptCoverageComplete, true);
assert.equal(built.audit.repeatabilityClassificationCoverageComplete, false);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.dispositionCoverage.noExplicitDeclarationCount, 1);
assert.equal(built.audit.dispositionCoverage.structuralSignalOnlyCount, 1);
assert.equal(built.audit.dispositionCoverage.unscopedExplicitDeclarationCount, 2);
assert.equal(built.audit.dispositionCoverage.opposingUnscopedDeclarationCount, 1);
assert.equal(built.audit.dispositionCoverage.resolvedClassificationCount, 0);
assert.equal(built.records[0].corroboratingRepeatabilityDisposition.state, 'blocked_no_explicit_declaration_in_bounded_corroborating_sources');
assert.equal(built.records[1].corroboratingRepeatabilityDisposition.state, 'blocked_structural_signal_without_explicit_repeatability_declaration');
assert.equal(built.records[2].corroboratingRepeatabilityDisposition.state, 'blocked_explicit_declaration_candidate_without_canonical_activity_scope');
assert.equal(built.records[4].corroboratingRepeatabilityDisposition.state, 'blocked_opposing_candidate_declarations_without_canonical_activity_scope');
assert.ok(built.records.every(record =>
  record.repeatabilityDisposition.classification === null
  && record.corroboratingRepeatabilityDisposition.classification === null
  && record.memberExpansionReview.state === 'unreviewed'
  && record.mechanicsReview.state === 'unreviewed'
  && record.optimizerEligible === false
));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamedInput = candidate({ key: 'positive', signals: [signal('explicit_positive_repeatability_declaration_candidate', 'positive')], label: 'Renamed display label' });
const renamed = buildActivityReferenceCollectionMemberRepeatabilityGapDispositions({ gapEvidenceRecords: [renamedInput], policy });
assert.deepEqual(renamed.records[0].corroboratingRepeatabilityDisposition, built.records[2].corroboratingRepeatabilityDisposition);

const incompleteInputs = structuredClone(inputs);
incompleteInputs[0].corroboratingRepeatabilityEvidence.evidenceState = 'incomplete';
incompleteInputs[0].contentHash = 'incomplete-gap-evidence';
const incomplete = buildActivityReferenceCollectionMemberRepeatabilityGapDispositions({ gapEvidenceRecords: incompleteInputs, policy });
assert.equal(incomplete.audit.publishable, false);
assert.ok(incomplete.audit.blockers.includes('one_or_more_repeatability_gap_evidence_packets_failed_structural_integrity'));

const unsupportedInputs = structuredClone(inputs);
unsupportedInputs[0].corroboratingRepeatabilityEvidence.candidatePages[0].sourceLocatedSignals.push(signal('unsupported_signal', 'unsupported'));
unsupportedInputs[0].contentHash = 'unsupported-gap-evidence';
const unsupported = buildActivityReferenceCollectionMemberRepeatabilityGapDispositions({ gapEvidenceRecords: unsupportedInputs, policy });
assert.equal(unsupported.audit.publishable, false);

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { 'member:none': 'repeatable' };
const forbidden = buildActivityReferenceCollectionMemberRepeatabilityGapDispositions({ gapEvidenceRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_specific_repeatability_gap_disposition_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].corroboratingRepeatabilityDisposition.state = 'source_supported_repeatable_activity';
alteredRecords[0].corroboratingRepeatabilityDisposition.classification = 'repeatable';
const altered = auditActivityReferenceCollectionMemberRepeatabilityGapDispositions(alteredRecords, { gapEvidenceRecords: inputs, policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_repeatability_gap_dispositions_not_reproducible_from_generic_rules'));

const upstreamMutatedRecords = structuredClone(built.records);
upstreamMutatedRecords[0].repeatabilityDisposition.classification = 'repeatable';
const upstreamMutated = auditActivityReferenceCollectionMemberRepeatabilityGapDispositions(upstreamMutatedRecords, { gapEvidenceRecords: inputs, policy });
assert.equal(upstreamMutated.publishable, false);
assert.ok(upstreamMutated.blockers.includes('upstream_repeatability_disposition_or_review_mutated'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].memberExpansionReview = { state: 'reviewed', atomicSubject: true, memberKeys: [], evidenceKeys: [] };
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberRepeatabilityGapDispositions(promotedRecords, { gapEvidenceRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberRepeatabilityGapDispositions(accountRecords, { gapEvidenceRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_repeatability_gap_dispositions'));

const compiled = compileRepeatabilityGapDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Generic repeatability-gap disposition checks passed.');
