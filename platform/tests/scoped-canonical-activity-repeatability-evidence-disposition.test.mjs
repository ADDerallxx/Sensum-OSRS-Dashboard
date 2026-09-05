import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditScopedCanonicalActivityRepeatabilityEvidenceDispositions,
  buildScopedCanonicalActivityRepeatabilityEvidenceDispositions,
  compileScopedCanonicalActivityRepeatabilityEvidenceDispositionPolicy
} from '../transforms/scoped-canonical-activity-repeatability-evidence-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/scoped-canonical-activity-repeatability-evidence-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/scoped-canonical-activity-repeatability-evidence-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/scoped-canonical-activity-repeatability-evidence-disposition-audit-v1.json', 'utf8'));
const domains = [
  'parent_activity_post_completion_reassignment_or_restart',
  'member_task_reselection_and_repeatability',
  'cooldown_reset_daily_or_session_limits',
  'finite_exhaustion_one_time_or_completion_lockout',
  'availability_and_assignment_eligibility_across_sessions',
  'independent_source_corroboration_or_conflict'
];
const channels = ['complete_exact_revision_source_text', 'prior_scope_packet_revision_and_hash_alignment', 'complete_source_line_inventory', 'comments_and_protected_regions_masked', 'generic_source_located_signal_inventory', 'evidence_domain_partition', 'parent_and_member_repeatability_separation', 'repeatability_verdict_separation'];

function evidenceRecord({ key = '1', label = 'Activity 1', signalKinds = ['recurrence_structure_candidate_not_repeatability_proof', 'recurrence_structure_candidate_not_repeatability_proof', 'availability_or_assignment_condition_candidate', 'independent_source_reference_candidate_not_corroboration'] } = {}) {
  const lines = ['An NPC can assign various tasks.', 'There are 59 tasks in total that can be assigned.', "Only give tasks that match the player's current level.", '{{CiteNews}}'];
  const text = lines.join('\n');
  const identity = { sourcePageId: 101, resolvedTitle: label, sourceRevision: '201', sourceTimestamp: '2026-01-01T00:00:00Z', sourceUrl: 'https://oldschool.runescape.wiki/w/Activity_1', sourceContentHash: hash(text), sourceContentBytes: Buffer.byteLength(text) };
  const signals = signalKinds.map((signalKind, index) => {
    const domainByKind = {
      explicit_repeatability_declaration_candidate: domains[0],
      recurrence_structure_candidate_not_repeatability_proof: domains[0],
      member_repeatability_declaration_candidate: domains[1],
      cooldown_reset_or_frequency_limit_candidate: domains[2],
      finite_exhaustion_or_lockout_candidate: domains[3],
      availability_or_assignment_condition_candidate: domains[4],
      independent_source_reference_candidate_not_corroboration: domains[5]
    };
    const lineIndex = Math.min(index, lines.length - 1);
    return {
      evidenceKey: `signal:${key}:${index}`,
      definitionKey: `definition:${index}`,
      evidenceDomain: domainByKind[signalKind],
      signalKind,
      sourcePageId: identity.sourcePageId,
      sourceRevision: identity.sourceRevision,
      sourceContentHash: identity.sourceContentHash,
      matchedText: lines[lineIndex],
      exactSourceLine: lines[lineIndex],
      exactSourceLineContentHash: hash(lines[lineIndex]),
      sourceLocator: { lineStart: lineIndex + 1, lineEnd: lineIndex + 1, columnStart: 1, columnEnd: lines[lineIndex].length },
      reviewState: 'candidate_only_not_parent_or_member_repeatability_verdict'
    };
  });
  const scopeVerdict = 'source_supported_composite_assigned_task_activity_scope';
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivitySubjectBinding: { canonicalActivityKey: `activity:${key}`, sourcePageIdentity: { ...identity, sourceContentBytes: undefined }, accountIndependent: true },
    canonicalActivityScopeDisposition: { state: 'source_supported_composite_assigned_task_activity_scope', canonicalActivityScopeVerdict: scopeVerdict, repeatabilityVerdict: null },
    canonicalActivityScopeReview: { state: 'reviewed_source_supported_composite_assigned_task_activity_scope', canonicalActivityScopeVerdict: scopeVerdict, repeatabilityVerdict: null },
    canonicalActivityRepeatabilityEvidenceSources: [{
      sourcePageIdentity: identity,
      sourceRevisionVerification: { fetched: true, aligned: true },
      exactRevisionSourceText: text,
      sourceLines: lines.map((rawText, index) => ({ ordinal: index + 1, sourceLocator: { lineStart: index + 1, lineEnd: index + 1 }, rawText, rawTextContentHash: hash(rawText) })),
      sourceLocatedSignals: signals,
      captureChannels: channels.map(channelKey => ({ channelKey, complete: true })),
      domainEvidence: domains.map(domainKey => ({ domainKey, captureState: 'captured_for_semantic_disposition_not_a_repeatability_verdict', resolutionState: 'unresolved_pending_semantic_disposition_and_possible_independent_evidence' })),
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      deficiencies: [],
      state: 'complete_revision_pinned_scoped_activity_repeatability_source'
    }],
    canonicalActivityRepeatabilityEvidence: {
      evidenceState: policy.requiredEvidenceState,
      requiredEvidenceDomainCount: 6,
      capturedEvidenceDomainCount: 6,
      resolvedEvidenceDomainCount: 0,
      requiredCaptureChannelCount: 8,
      completedCaptureChannelCount: 8,
      sourceLocatedSignalCount: signals.length,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivityRepeatabilityEvidenceReview: { state: 'unreviewed_complete_revision_pinned_repeatability_evidence_semantic_disposition_required', repeatabilityVerdict: null },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['scoped_canonical_activity_repeatability_evidence_requires_semantic_disposition'],
    state: policy.inputState,
    contentHash: `evidence-${key}`
  };
}

const input = evidenceRecord();
const built = buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionAttemptCoverageComplete, true);
assert.equal(built.audit.repeatabilityClassificationCoverageComplete, false);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.signalDispositionCoverage.inputSourceLocatedSignalCount, 4);
assert.equal(built.audit.signalDispositionCoverage.dispositionSignalCount, 4);
assert.equal(built.audit.signalDispositionCoverage.everyInputSignalDispositionedExactlyOnce, true);
assert.equal(built.audit.domainDispositionCoverage.dispositionedDomainCount, 6);
assert.equal(built.audit.domainDispositionCoverage.resolvedDomainCount, 0);
assert.equal(built.audit.domainDispositionCoverage.unresolvedDomainCount, 6);
assert.equal(built.audit.domainDispositionCoverage.nextEvidenceWorkRoutedCount, 1);
const output = built.records[0];
assert.equal(output.canonicalActivityRepeatabilityDisposition.state, 'blocked_parent_and_member_repeatability_not_proven');
assert.equal(output.canonicalActivityRepeatabilityDisposition.classification, null);
assert.equal(output.canonicalActivityRepeatabilityDisposition.recurrenceStructureNotProofCount, 2);
assert.equal(output.canonicalActivityRepeatabilityDisposition.explicitRepeatabilityDeclarationCandidateCount, 0);
assert.equal(output.canonicalActivityRepeatabilityDisposition.unresolvedEvidenceDomains.length, 6);
assert.equal(output.canonicalActivityRepeatabilityReview.parentActivityRepeatabilityVerdict, null);
assert.equal(output.canonicalActivityRepeatabilityReview.memberTaskRepeatabilityVerdict, null);
assert.equal(output.canonicalActivityRepeatabilityNextEvidenceWork.routeKey, 'collect_revision_pinned_independent_scoped_activity_repeatability_evidence');
assert.deepEqual(output.canonicalActivityScopeDisposition, input.canonicalActivityScopeDisposition);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [evidenceRecord({ key: '2', label: 'Renamed activity' })], policy });
assert.deepEqual(renamed.records[0].canonicalActivityRepeatabilityDispositionSignals.map(item => item.dispositionClass), output.canonicalActivityRepeatabilityDispositionSignals.map(item => item.dispositionClass));

const multiple = buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({
  evidenceRecords: [input, evidenceRecord({ key: '2', label: 'Second activity' })],
  policy
});
assert.equal(multiple.audit.publishable, true);
assert.equal(multiple.audit.inputCoverage.dispositionRecordCount, 2);
assert.equal(multiple.audit.domainDispositionCoverage.requiredDomainCount, 12);
assert.equal(multiple.audit.domainDispositionCoverage.dispositionedDomainCount, 12);
assert.equal(multiple.audit.domainDispositionCoverage.unresolvedDomainCount, 12);
assert.equal(multiple.audit.domainDispositionCoverage.nextEvidenceWorkRoutedCount, 2);

const zero = buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [evidenceRecord({ key: '3', signalKinds: [] })], policy });
assert.equal(zero.audit.publishable, true);
assert.equal(zero.records[0].canonicalActivityRepeatabilityDisposition.classification, null);
assert.ok(zero.records[0].canonicalActivityRepeatabilityDisposition.evidenceDomainAssessments.every(item => item.dispositionState.includes('no_')));

const allKinds = buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [evidenceRecord({ key: '4', signalKinds: ['explicit_repeatability_declaration_candidate', 'member_repeatability_declaration_candidate', 'cooldown_reset_or_frequency_limit_candidate', 'finite_exhaustion_or_lockout_candidate'] })], policy });
assert.equal(allKinds.audit.publishable, true);
assert.equal(allKinds.records[0].canonicalActivityRepeatabilityDisposition.classification, null);
assert.ok(allKinds.records[0].canonicalActivityRepeatabilityDisposition.deficiencies.includes('explicit_declaration_requires_exact_subject_predicate_and_recurrence_boundary_review'));

const invalidInput = evidenceRecord({ key: '5' });
invalidInput.canonicalActivityRepeatabilityEvidenceSources[0].sourceLines[0].rawTextContentHash = 'tampered';
const invalid = buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [invalidInput], policy });
assert.equal(invalid.audit.publishable, false);
assert.ok(invalid.audit.blockers.includes('one_or_more_input_evidence_packets_failed_exact_integrity_revalidation'));

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'member:1': 'repeatable' };
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [input], policy: specificPolicy }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [input], policy: automaticPolicy }).audit.publishable, false);

const altered = structuredClone(built.records);
altered[0].canonicalActivityRepeatabilityDispositionSignals[0].dispositionClass = 'repeatability_proof';
const alteredAudit = auditScopedCanonicalActivityRepeatabilityEvidenceDispositions(altered, { evidenceRecords: [input], policy });
assert.equal(alteredAudit.publishable, false);
assert.ok(alteredAudit.blockers.includes('one_or_more_signal_or_packet_dispositions_not_reproducible_from_generic_policy'));

const promoted = structuredClone(built.records);
promoted[0].canonicalActivityRepeatabilityDisposition.classification = 'repeatable';
promoted[0].canonicalActivityRepeatabilityReview.parentActivityRepeatabilityVerdict = 'repeatable';
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditScopedCanonicalActivityRepeatabilityEvidenceDispositions(promoted, { evidenceRecords: [input], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('repeatability_disposition_created_unsupported_parent_member_scope_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditScopedCanonicalActivityRepeatabilityEvidenceDispositions(accountScoped, { evidenceRecords: [input], policy });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_scoped_activity_repeatability_dispositions'));

const deterministicA = buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [input], policy });
const deterministicB = buildScopedCanonicalActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileScopedCanonicalActivityRepeatabilityEvidenceDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.duplicateSignalKinds, []);
assert.deepEqual(compiled.missingSignalKinds, []);
assert.deepEqual(compiled.unexpectedSignalKinds, []);

console.log('Generic scoped canonical-activity repeatability evidence disposition checks passed.');
