import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityReferenceCollectionMemberRepeatabilityDispositions,
  buildActivityReferenceCollectionMemberRepeatabilityDispositions,
  compileRepeatabilityDispositionPolicy
} from '../transforms/activity-reference-collection-member-repeatability-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-repeatability-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-disposition-audit-v1.json', 'utf8'));

function candidate({ key, signalKind = null, sourceScope = 'complete_linked_source_revision', matchedText = null, signalLine = 20, roleLine = 20, rowLine = 40 }) {
  const memberCandidateKey = `collection-row:${key}`;
  const sourceContentHash = `source-hash-${key}`;
  const collectionContentHash = `collection-hash-${key}`;
  const sourcePageId = 1000 + key.length;
  const sourceRevision = String(2000 + key.length);
  const collectionRevision = '15327496';
  const text = matchedText || (signalKind === 'explicit_negative_repeatability_declaration_candidate'
    ? 'cannot be repeated'
    : signalKind === 'explicit_positive_repeatability_declaration_candidate'
      ? 'can be repeated'
      : signalKind === 'recurrence_structure_candidate'
        ? 'assign various tasks'
        : signalKind === 'session_boundary_candidate'
          ? 'at the end of the game'
          : null);
  const sourceLocatedSignals = signalKind ? [{
    evidenceKey: `${memberCandidateKey}:repeatability:1`,
    definitionKey: `${signalKind}:definition`,
    signalKind,
    sourceScope,
    sourcePageId: sourceScope === 'exact_collection_row' ? 2078 : sourcePageId,
    sourceRevision: sourceScope === 'exact_collection_row' ? collectionRevision : sourceRevision,
    sourceContentHash: sourceScope === 'exact_collection_row' ? collectionContentHash : sourceContentHash,
    scannedTextHash: `scan-${key}`,
    matchedText: text,
    contextText: `The activity ${text}.`,
    sourceLocator: { lineStart: sourceScope === 'exact_collection_row' ? rowLine : signalLine, lineEnd: sourceScope === 'exact_collection_row' ? rowLine : signalLine },
    reviewState: 'candidate_only_not_a_repeatability_verdict'
  }] : [];
  const sourceRoleSignal = {
    evidenceKey: `${memberCandidateKey}:source-role`,
    ruleKey: 'generic_source_role',
    relationshipClass: 'task_provider',
    sourcePageId,
    sourceRevision,
    sourceContentHash,
    matchedDeclarations: [{
      sourceLocator: { lineStart: roleLine, lineEnd: roleLine },
      matchedText: text || 'provides the task',
      rawText: `The activity ${text || 'provides the task'}.`,
      plainText: `The activity ${text || 'provides the task'}.`
    }]
  };
  const narrativeCell = {
    rawValue: `The activity ${text || 'provides a reward'}.`,
    plainText: `The activity ${text || 'provides a reward'}.`,
    sourceLocator: { lineStart: rowLine, lineEnd: rowLine }
  };
  return {
    contract: policy.inputContract,
    memberCandidateKey,
    sourcePageId,
    resolvedTitle: `Source ${key}`,
    sourceRevision,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash,
    canonicalActivityIdentityEvidence: {
      collectionDefinition: {
        collectionSource: { pageId: 2078, revision: collectionRevision, contentHash: collectionContentHash },
        narrativeCellEvidence: [narrativeCell]
      },
      linkedSubjectRelationship: {
        relationshipDisposition: { state: 'source_supported_linked_subject_relationship', relationshipClass: 'task_provider_for_collection_defined_activity_candidate' },
        review: { state: 'reviewed_source_supported' },
        sourceRoleDispositionSignals: [sourceRoleSignal]
      }
    },
    canonicalActivityIdentityReview: { state: 'reviewed_source_supported' },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: {
      canonicalActivityKey: `activity:test:${key}`,
      identityClass: 'collection_defined_activity_with_task_provider_anchor',
      canonicalLabel: `Activity ${key}`,
      evidenceRevisionBoundary: { collectionRevision, linkedSourceRevision: sourceRevision },
      linkedSubjectIsCanonicalActivity: false,
      evidenceKeys: [`identity:${key}`]
    },
    repeatabilityEvidence: {
      evidenceState: 'complete_revision_pinned_repeatability_review_packet',
      sourceLocatedSignals
    },
    repeatabilityCandidateObservations: {
      deficiencies: [],
      repeatabilityVerdict: null
    },
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['repeatability-disposition-pending'],
    contentHash: `repeatability-evidence-${key}`
  };
}

const inputs = [
  candidate({ key: 'positive', signalKind: 'explicit_positive_repeatability_declaration_candidate' }),
  candidate({ key: 'negative', signalKind: 'explicit_negative_repeatability_declaration_candidate' }),
  candidate({ key: 'recurrence', signalKind: 'recurrence_structure_candidate' }),
  candidate({ key: 'session', signalKind: 'session_boundary_candidate' }),
  candidate({ key: 'unscoped', signalKind: 'explicit_positive_repeatability_declaration_candidate', signalLine: 30, roleLine: 20 }),
  candidate({ key: 'collection', signalKind: 'explicit_positive_repeatability_declaration_candidate', sourceScope: 'exact_collection_row' }),
  candidate({ key: 'none' })
];
const built = buildActivityReferenceCollectionMemberRepeatabilityDispositions({ repeatabilityEvidenceRecords: inputs, policy });

assert.equal(built.audit.publishable, true);
assert.equal(built.audit.repeatabilityDispositionAttemptCoverageComplete, true);
assert.equal(built.audit.repeatabilityClassificationCoverageComplete, false);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.repeatabilityDispositionCoverage.sourceSupportedRepeatableCount, 2);
assert.equal(built.audit.repeatabilityDispositionCoverage.sourceSupportedNonRepeatableCount, 1);
assert.equal(built.audit.repeatabilityDispositionCoverage.conflictingCount, 0);
assert.equal(built.audit.repeatabilityDispositionCoverage.unresolvedCount, 4);
assert.equal(built.audit.repeatabilityDispositionCoverage.linkedSourceRoleScopeProofCount, 2);
assert.equal(built.audit.repeatabilityDispositionCoverage.collectionNarrativeScopeProofCount, 1);
assert.equal(built.records[0].repeatabilityReview.classification, 'repeatable');
assert.equal(built.records[1].repeatabilityReview.classification, 'non_repeatable');
assert.equal(built.records[2].repeatabilityDisposition.state, 'unresolved_recurrence_or_session_structure_without_explicit_declaration');
assert.equal(built.records[3].repeatabilityDisposition.state, 'unresolved_recurrence_or_session_structure_without_explicit_declaration');
assert.equal(built.records[4].repeatabilityDisposition.state, 'unresolved_explicit_repeatability_declaration_scope_not_established');
assert.equal(built.records[5].repeatabilityReview.classification, 'repeatable');
assert.equal(built.records[6].repeatabilityDisposition.state, 'unresolved_no_explicit_repeatability_evidence');
assert.ok(built.records.every(record => record.memberExpansionReview.state === 'unreviewed' && record.mechanicsReview.state === 'unreviewed' && record.optimizerEligible === false));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const conflictInput = candidate({ key: 'conflict', signalKind: 'explicit_positive_repeatability_declaration_candidate' });
conflictInput.repeatabilityEvidence.sourceLocatedSignals.push({
  ...structuredClone(conflictInput.repeatabilityEvidence.sourceLocatedSignals[0]),
  evidenceKey: 'collection-row:conflict:repeatability:2',
  definitionKey: 'explicit-negative',
  signalKind: 'explicit_negative_repeatability_declaration_candidate',
  matchedText: 'cannot be repeated',
  contextText: 'The activity cannot be repeated.'
});
conflictInput.canonicalActivityIdentityEvidence.linkedSubjectRelationship.sourceRoleDispositionSignals[0].matchedDeclarations[0].rawText = 'The activity can be repeated but cannot be repeated.';
const conflict = buildActivityReferenceCollectionMemberRepeatabilityDispositions({ repeatabilityEvidenceRecords: [conflictInput], policy });
assert.equal(conflict.audit.publishable, true);
assert.equal(conflict.records[0].repeatabilityDisposition.state, 'blocked_conflicting_explicit_repeatability_declarations');
assert.equal(conflict.records[0].repeatabilityReview.classification, null);

const renamedInputs = structuredClone(inputs);
renamedInputs[0].resolvedTitle = 'Entirely different display title';
renamedInputs[0].canonicalActivityIdentity.canonicalLabel = 'Entirely different display label';
renamedInputs[0].contentHash = 'renamed-repeatability-evidence';
const renamed = buildActivityReferenceCollectionMemberRepeatabilityDispositions({ repeatabilityEvidenceRecords: renamedInputs, policy });
assert.equal(renamed.records[0].repeatabilityReview.classification, 'repeatable');

const incompleteInputs = structuredClone(inputs);
incompleteInputs[0].repeatabilityEvidence.evidenceState = 'repeatability_evidence_packet_incomplete';
incompleteInputs[0].repeatabilityCandidateObservations.deficiencies = ['source_missing'];
incompleteInputs[0].contentHash = 'incomplete-repeatability-evidence';
const incomplete = buildActivityReferenceCollectionMemberRepeatabilityDispositions({ repeatabilityEvidenceRecords: incompleteInputs, policy });
assert.equal(incomplete.audit.publishable, false);
assert.equal(incomplete.records[0].repeatabilityDisposition.state, 'unresolved_incomplete_repeatability_evidence');

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { activity: 'repeatable' };
const forbidden = buildActivityReferenceCollectionMemberRepeatabilityDispositions({ repeatabilityEvidenceRecords: inputs, policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_specific_repeatability_disposition_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].repeatabilityDisposition.classification = 'non_repeatable';
const altered = auditActivityReferenceCollectionMemberRepeatabilityDispositions(alteredRecords, { repeatabilityEvidenceRecords: inputs, policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_repeatability_dispositions_not_supported_by_complete_generic_source_scope_evidence'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].memberExpansionReview = { state: 'reviewed', atomicSubject: true, memberKeys: [], evidenceKeys: [] };
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberRepeatabilityDispositions(promotedRecords, { repeatabilityEvidenceRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberRepeatabilityDispositions(accountRecords, { repeatabilityEvidenceRecords: inputs, policy });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_repeatability_dispositions'));

const compiled = compileRepeatabilityDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.duplicateRuleKeys, []);
assert.deepEqual(compiled.invalidRuleKeys, []);
assert.deepEqual(compiled.requiredClassificationsMissing, []);

console.log('Generic collection-activity repeatability-disposition checks passed.');
