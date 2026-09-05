import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditWeightedMembershipVariantScopeEvidenceCrosswalk,
  buildWeightedMembershipVariantScopeEvidenceCrosswalk,
  compileWeightedMembershipVariantScopeEvidenceCrosswalkPolicy
} from '../transforms/weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk-audit-v1.json', 'utf8'));

const identity = (kind, ordinal) => ({
  sourcePageId: (kind === 'candidate' ? 100 : 200) + ordinal,
  sourceRevision: String((kind === 'candidate' ? 1000 : 2000) + ordinal),
  sourceContentHash: hash(`${kind}:${ordinal}`),
  roles: [kind === 'candidate' ? 'candidate_subject_source' : 'parent_inventory_source']
});

function inputRecord(ordinal) {
  const candidate = identity('candidate', ordinal);
  const parent = identity('parent', ordinal);
  const base = {
    contract: policy.inputQueueContract,
    queueEntryKey: `input:${ordinal}`,
    queueOrdinal: ordinal,
    structuralCandidateKey: `candidate:${ordinal}`,
    candidateRole: 'item_delivery_target_candidate',
    candidateDisplay: { value: `Candidate ${ordinal}` },
    evidenceFingerprint: hash(`fingerprint:${ordinal}`),
    evidenceSourceIdentities: [candidate, parent],
    sourceRevisions: [candidate.sourceRevision, parent.sourceRevision].sort(),
    variantScopeEvidence: { route: 'numbered_alias_or_variant_scope_evidence_required', parentOccurrence: { integrity: { complete: true } } },
    requiredEvidenceChannels: ['exact_candidate_name_or_variant_scope_binding'],
    reviewCandidateVariantIndex: null,
    weightedTaskEntryMembershipVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.inputQueueState
  };
  return { ...base, contentHash: hash(base) };
}

function exactReview(input) {
  const candidate = input.evidenceSourceIdentities.find(item => item.roles.includes('candidate_subject_source'));
  const parent = input.evidenceSourceIdentities.find(item => item.roles.includes('parent_inventory_source'));
  const base = {
    contract: policy.exactVariantReviewContract,
    queueEntryKey: `exact:${input.queueOrdinal}`,
    structuralCandidateKey: input.structuralCandidateKey,
    candidateRole: input.candidateRole,
    subjectEvidence: { sourcePageIdentity: structuredClone(candidate) },
    parentOccurrenceEvidence: { sourcePageIdentity: structuredClone(parent) },
    reviewScope: { sourceRevisions: [...input.sourceRevisions] },
    sourceEvidencePacketContentHash: hash(`packet:${input.queueOrdinal}`),
    evidenceFingerprint: hash(`exact-fingerprint:${input.queueOrdinal}`),
    variantBindingReviewEvidence: { reviewCandidateVariantIndex: 1, matchingVariantIndices: [1], sourceBindingEvidenceState: 'unique_exact_parent_display_to_numbered_name_match_review_pending', bindingReviewDecision: null, boundVariantIndex: null },
    bindingReviewDecision: null,
    boundVariantIndex: null,
    candidateMemberIdentityVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.exactVariantReviewState
  };
  const withEntry = { ...base, entryContentHash: hash(base) };
  return { ...withEntry, contentHash: hash(withEntry) };
}

function canonicalReview(input) {
  const base = {
    contract: policy.canonicalSubjectReviewContract,
    queueEntryKey: `canonical:${input.queueOrdinal}`,
    structuralCandidateKey: input.structuralCandidateKey,
    candidateRole: input.candidateRole,
    evidenceSourceIdentities: [...input.evidenceSourceIdentities, { sourcePageId: 999, sourceRevision: '9999', sourceContentHash: hash('extra') }],
    reviewScope: { sourceRevisions: [...input.sourceRevisions, '9999'].sort() },
    sourceEvidencePacketRecordContentHash: hash(`canonical-packet:${input.queueOrdinal}`),
    evidenceFingerprint: hash(`canonical-fingerprint:${input.queueOrdinal}`),
    canonicalSubjectContextEvidenceState: 'observed_for_explicit_scope_review',
    exactNumberedVariantAlignmentEvidenceState: 'not_observed',
    reviewDecision: null,
    reviewCandidateVariantIndex: null,
    bindingReviewDecision: null,
    boundVariantIndex: null,
    candidateMemberIdentityVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    state: policy.canonicalSubjectReviewState
  };
  const withRecord = { ...base, recordContentHash: hash(base) };
  return { ...withRecord, contentHash: hash(withRecord) };
}

function singleVariantReview(input) {
  const candidate = input.evidenceSourceIdentities.find(item => item.roles.includes('candidate_subject_source'));
  const parent = input.evidenceSourceIdentities.find(item => item.roles.includes('parent_inventory_source'));
  const base = {
    contract: policy.singleVariantIdentityReviewContract,
    queueEntryKey: `single:${input.queueOrdinal}`,
    structuralCandidateKey: input.structuralCandidateKey,
    candidateRole: input.candidateRole,
    subjectEvidence: { sourcePageIdentity: structuredClone(candidate), rootInfobox: { sourceAuthoredNameFields: [{ name: 'name', value: input.candidateDisplay.value }] } },
    parentOccurrenceEvidence: { sourcePageIdentity: structuredClone(parent) },
    reviewScope: { decisionScope: 'exact_candidate_to_revision_pinned_source_page_subject_identity_and_single_infobox_variant', sourceRevisions: [...input.sourceRevisions] },
    sourcePacketContentHash: hash(`single-packet:${input.queueOrdinal}`),
    evidenceFingerprint: hash(`single-fingerprint:${input.queueOrdinal}`),
    decisionTemplate: { decision: null },
    accountIndependent: true,
    state: policy.singleVariantIdentityReviewState
  };
  const withEntry = { ...base, entryContentHash: hash(base) };
  return { ...withEntry, contentHash: hash(withEntry) };
}

const compiled = compileWeightedMembershipVariantScopeEvidenceCrosswalkPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const inputs = [inputRecord(1), inputRecord(2), inputRecord(3), inputRecord(4)];
const exact = exactReview(inputs[0]);
const single = singleVariantReview(inputs[1]);
const canonical = canonicalReview(inputs[2]);
const built = buildWeightedMembershipVariantScopeEvidenceCrosswalk({ inputRecords: inputs, exactReviewRecords: [exact], singleVariantReviewRecords: [single], canonicalReviewRecords: [canonical], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.crosswalkComplete, true);
assert.equal(built.audit.variantScopeEvidenceComplete, false);
assert.equal(built.records.length, 4);
assert.deepEqual(built.records.map(record => record.queueOrdinal), [1, 2, 3, 4]);
assert.deepEqual(built.records.map(record => record.reuseClassification), policy.classifications);
assert.equal(built.audit.crosswalkCoverage.reusableExactVariantEvidenceCount, 1);
assert.equal(built.audit.crosswalkCoverage.reusableSingleVariantIdentityEvidenceCount, 1);
assert.equal(built.audit.crosswalkCoverage.reusableCanonicalSubjectEvidenceCount, 1);
assert.equal(built.audit.crosswalkCoverage.noCompatibleExistingEvidenceCount, 1);
assert.equal(built.records[0].existingEvidenceReference.proposedButUnboundVariantIndex, 1);
for (const record of built.records) {
  assert.equal(record.reviewDecisionRecorded, false);
  assert.equal(record.reviewCandidateVariantIndex, null);
  assert.equal(record.boundVariantIndex, null);
  assert.equal(record.weightedTaskEntryMembershipVerdict, null);
  assert.equal(record.optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing crosswalk field ${field}`);
}
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const deterministicComplete = buildWeightedMembershipVariantScopeEvidenceCrosswalk({ inputRecords: structuredClone(inputs), exactReviewRecords: [structuredClone(exact)], singleVariantReviewRecords: [structuredClone(single)], canonicalReviewRecords: [structuredClone(canonical)], policy: structuredClone(policy) });
assert.equal(hash(deterministicComplete), hash(built));

function fails(inputRecords = inputs, exactReviewRecords = [exact], singleVariantReviewRecords = [single], canonicalReviewRecords = [canonical], changedPolicy = policy) {
  const result = buildWeightedMembershipVariantScopeEvidenceCrosswalk({ inputRecords, exactReviewRecords, singleVariantReviewRecords, canonicalReviewRecords, policy: changedPolicy });
  assert.equal(result.audit.publishable, false);
  assert.equal(result.records.length, 0);
}

fails([inputs[0], inputs[0]], [exact], [], []);
fails(inputs, [exact, exact], [single], [canonical]);
fails(inputs, [exact], [single, single], [canonical]);
fails(inputs, [exact], [single], [canonical, canonical]);
fails(inputs, [exact], [{ ...single, structuralCandidateKey: exact.structuralCandidateKey }], [canonical]);
fails([{ ...inputs[0], currentBaseLevel: 34 }], [], [], []);
fails(inputs, [{ ...exact, contentHash: hash('tampered') }], [single], [canonical]);
fails(inputs, [exact], [{ ...single, contentHash: hash('tampered') }], [canonical]);
fails(inputs, [exact], [single], [{ ...canonical, contentHash: hash('tampered') }]);
const mismatchedExact = exactReview(inputs[0]);
mismatchedExact.subjectEvidence.sourcePageIdentity.sourceRevision = 'wrong';
const mismatchedExactBase = Object.fromEntries(Object.entries(mismatchedExact).filter(([key]) => !['entryContentHash', 'contentHash'].includes(key)));
mismatchedExact.entryContentHash = hash(mismatchedExactBase);
mismatchedExact.contentHash = hash(Object.fromEntries(Object.entries(mismatchedExact).filter(([key]) => key !== 'contentHash')));
fails(inputs, [mismatchedExact], [single], [canonical]);
fails(inputs, [exact], [single], [canonical], { ...structuredClone(policy), candidateKeys: [inputs[0].structuralCandidateKey] });
fails(inputs, [exact], [single], [canonical], { ...structuredClone(policy), rules: { ...policy.rules, automaticVerificationAllowed: true } });

const promoted = structuredClone(built.records);
promoted[0].reviewCandidateVariantIndex = 1;
promoted[0].boundVariantIndex = 1;
promoted[0].weightedTaskEntryMembershipVerdict = 'member';
promoted[0].optimizerEligible = true;
promoted[0].recordContentHash = hash(Object.fromEntries(Object.entries(promoted[0]).filter(([key]) => key !== 'recordContentHash')));
const promotedAudit = auditWeightedMembershipVariantScopeEvidenceCrosswalk(promoted, { inputRecords: inputs, exactReviewRecords: [exact], singleVariantReviewRecords: [single], canonicalReviewRecords: [canonical], policy });
assert.equal(promotedAudit.publishable, false);
assert.equal(promotedAudit.semanticPreservationCoverage.unsupportedPromotionKeys.length, 1);

console.log('Weighted parent-task membership variant-scope evidence crosswalk tests passed.');
