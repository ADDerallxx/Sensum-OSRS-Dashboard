import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditMultiVariantBindingAdditionalEvidenceSufficiencyDisposition,
  buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition,
  compileMultiVariantBindingAdditionalEvidenceSufficiencyDispositionPolicy
} from '../transforms/multi-variant-binding-additional-evidence-sufficiency-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-binding-additional-evidence-sufficiency-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-additional-evidence-sufficiency-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-additional-evidence-sufficiency-disposition-audit-v1.json', 'utf8'));
const snapshotHash = 'c'.repeat(64);

function rehashPacket(packet) {
  const base = Object.fromEntries(Object.entries(packet).filter(([key]) => key !== 'recordContentHash' && key !== 'contentHash'));
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function sourcePage(sourceKey = 'wiki-pageid:1|revision:2') {
  const sourceText = '{{Infobox NPC\n|name=Example\n|version1=Normal\n|version2=Quest\n}}\nExample source.';
  return {
    sourceKey,
    sourcePageId: 1,
    resolvedTitle: 'Example',
    sourceRevision: '2',
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: 'https://oldschool.runescape.wiki/w/Example',
    sourceContentHash: hash(sourceText),
    sourceContentBytes: Buffer.byteLength(sourceText, 'utf8'),
    sourceText,
    complete: true
  };
}

function packet(mode = 'canonical') {
  const page = sourcePage();
  const context = mode === 'missing' ? [] : [{ sourceKey: page.sourceKey, exactSourceText: 'Give the message to Example.' }];
  const alignment = mode === 'exact' ? [{ sourceKey: page.sourceKey, variantIndex: 2, exactSourceText: '|version2=Quest' }] : [];
  const base = {
    contract: policy.inputContract,
    evidencePacketKey: `packet:${mode}`,
    workQueueEntryKey: `work:${mode}`,
    sourceDispositionKey: `source-disposition:${mode}`,
    structuralCandidateKey: `candidate:${mode}`,
    candidateRole: 'message_delivery_recipient_candidate',
    candidateDisplayName: 'Example',
    sourceQueueSnapshotContentHash: 'a'.repeat(64),
    sourceEvidencePacketContentHash: 'b'.repeat(64),
    sourceWorkQueueEntryContentHash: 'd'.repeat(64),
    sourceWorkQueueRecordContentHash: 'e'.repeat(64),
    evidenceFingerprint: 'f'.repeat(64),
    pinnedSourceRevalidations: [{
      sourceKey: page.sourceKey,
      complete: true,
      checks: { pagePresent: true, revisionMatches: true, timestampMatches: true, titleMatches: true, pageIdMatches: true, contentComplete: true, contentHashMatches: true, contentBytesMatch: true }
    }],
    discoveryQueries: [{ queryKey: 'query:1', totalHits: 1, returnedCount: 1, continuationExhausted: true, truncated: false, results: [{ pageid: 1 }] }],
    candidateSourcePages: [page],
    candidateScopedParentContextObservations: context,
    numberedVariantIdentityObservations: [{ sourceKey: page.sourceKey, variantIndex: 1, exactSourceText: '|version1=Normal' }],
    exactTaskToNumberedVariantAlignmentObservations: alignment,
    requiredChannelStatus: [
      { channel: 'candidate_scoped_parent_occurrence_context', humanReviewRequired: false, satisfiedByCapturedEvidence: context.length > 0 },
      { channel: 'source_authored_numbered_variant_identity_alignment', humanReviewRequired: false, satisfiedByCapturedEvidence: alignment.length > 0 },
      { channel: 'explicit_human_binding_review', humanReviewRequired: true, satisfiedByCapturedEvidence: false }
    ],
    reviewCandidateVariantIndex: null,
    bindingReviewDecision: null,
    boundVariantIndex: null,
    evidenceReviewer: null,
    evidenceReviewedAt: null,
    evidenceNotes: null,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mechanicsReviewComplete: false,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: [],
    state: policy.inputState
  };
  return rehashPacket(base);
}

const compiled = compileMultiVariantBindingAdditionalEvidenceSufficiencyDispositionPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.classificationValid, true);
assert.equal(compiled.routesValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const canonicalPacket = packet('canonical');
const exactPacket = packet('exact');
const missingPacket = packet('missing');
const built = buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition({ evidencePackets: [canonicalPacket, exactPacket, missingPacket], policy, sourceSnapshotContentHash: snapshotHash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionCoverageComplete, true);
assert.equal(built.audit.reviewRoutingCoverage.canonicalSubjectScopeReviewCount, 1);
assert.equal(built.audit.reviewRoutingCoverage.exactNumberedVariantBindingReviewCount, 1);
assert.equal(built.audit.reviewRoutingCoverage.additionalBindingEvidenceCount, 1);
assert.equal(built.audit.semanticPreservationCoverage.reviewCandidateVariantIndexCount, 0);
assert.equal(built.audit.semanticPreservationCoverage.boundVariantCount, 0);
assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
assert.equal(built.records.length, 3);

const canonical = built.records[0];
assert.equal(canonical.classification, policy.classifications[0]);
assert.equal(canonical.reviewRoute, 'canonical_subject_scope_review');
assert.deepEqual(canonical.allowedReviewDecisions, policy.canonicalSubjectScopeReviewDecisions);
assert.equal(canonical.sourceEvidencePacketRecordContentHash, canonicalPacket.recordContentHash);
assert.equal(canonical.reviewCandidateVariantIndex, null);
assert.equal(canonical.boundVariantIndex, null);

const exact = built.records[1];
assert.equal(exact.classification, policy.classifications[1]);
assert.equal(exact.reviewRoute, 'exact_numbered_variant_binding_review');
assert.deepEqual(exact.allowedReviewDecisions, policy.exactNumberedVariantReviewDecisions);
assert.equal(exact.reviewCandidateVariantIndex, null);
assert.equal(exact.bindingReviewDecision, null);

const missing = built.records[2];
assert.equal(missing.classification, policy.classifications[2]);
assert.equal(missing.reviewRoute, 'additional_binding_evidence');
assert.deepEqual(missing.allowedReviewDecisions, []);
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const deterministic = buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition({ evidencePackets: structuredClone([canonicalPacket, exactPacket, missingPacket]), policy: structuredClone(policy), sourceSnapshotContentHash: snapshotHash });
assert.deepEqual(deterministic, built);

const tampered = structuredClone(canonicalPacket);
tampered.candidateSourcePages[0].sourceText += ' tampered';
assert.equal(buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition({ evidencePackets: [tampered], policy, sourceSnapshotContentHash: snapshotHash }).audit.publishable, false);

const truncated = structuredClone(canonicalPacket);
truncated.discoveryQueries[0].truncated = true;
assert.equal(buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition({ evidencePackets: [rehashPacket(truncated)], policy, sourceSnapshotContentHash: snapshotHash }).audit.publishable, false);

const mismatchedStatus = structuredClone(canonicalPacket);
mismatchedStatus.requiredChannelStatus[0].satisfiedByCapturedEvidence = false;
assert.equal(buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition({ evidencePackets: [rehashPacket(mismatchedStatus)], policy, sourceSnapshotContentHash: snapshotHash }).audit.publishable, false);

const specific = structuredClone(policy);
specific.overrides = { 'candidate:canonical': 'canonical_subject_scope_review' };
assert.equal(compileMultiVariantBindingAdditionalEvidenceSufficiencyDispositionPolicy(specific).valid, false);

const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileMultiVariantBindingAdditionalEvidenceSufficiencyDispositionPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].reviewDecision = 'confirm_parent_occurrence_refers_to_canonical_subject_across_numbered_variants';
promoted[0].boundVariantIndex = 1;
promoted[0].weightedTaskEntryMembershipVerdict = 'verified';
promoted[0].optimizerEligible = true;
const promotedAudit = auditMultiVariantBindingAdditionalEvidenceSufficiencyDisposition(promoted, { evidencePackets: [canonicalPacket, exactPacket, missingPacket], policy, sourceSnapshotContentHash: snapshotHash });
assert.equal(promotedAudit.publishable, false);
assert.equal(promotedAudit.optimizerEligibleCount, 1);
assert.ok(promotedAudit.blockers.includes('disposition_created_unsupported_review_binding_semantic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(auditMultiVariantBindingAdditionalEvidenceSufficiencyDisposition(accountScoped, { evidencePackets: [canonicalPacket, exactPacket, missingPacket], policy, sourceSnapshotContentHash: snapshotHash }).publishable, false);

console.log('Multi-variant binding additional-evidence sufficiency disposition checks passed.');
