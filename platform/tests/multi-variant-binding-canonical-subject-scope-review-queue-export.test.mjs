import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import { buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition } from '../transforms/multi-variant-binding-additional-evidence-sufficiency-disposition-lib.mjs';
import {
  auditMultiVariantBindingCanonicalSubjectScopeReviewQueueExport,
  buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport,
  compileMultiVariantBindingCanonicalSubjectScopeReviewQueueExportPolicy,
  renderMultiVariantBindingCanonicalSubjectScopeReviewQueueMarkdown,
  serializeMultiVariantBindingCanonicalSubjectScopeReviewDecisionTemplates
} from '../transforms/multi-variant-binding-canonical-subject-scope-review-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-binding-canonical-subject-scope-review-queue-export-v1.json', 'utf8'));
const dispositionPolicy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-binding-additional-evidence-sufficiency-disposition-v1.json', 'utf8'));
const queueContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-canonical-subject-scope-review-queue-entry-v1.json', 'utf8'));
const decisionContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-canonical-subject-scope-review-decision-template-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-canonical-subject-scope-review-queue-export-audit-v1.json', 'utf8'));
const evidenceSnapshotHash = 'c'.repeat(64);
const dispositionSnapshotHash = 'd'.repeat(64);
const dispositionSnapshotContentHash = dispositionSnapshotHash;

function rehashPacket(packet) {
  const base = Object.fromEntries(Object.entries(packet).filter(([key]) => key !== 'recordContentHash' && key !== 'contentHash'));
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function snapshotDisposition(record) {
  return { ...record, contentHash: hash(record) };
}

function rehashDisposition(record) {
  const base = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'recordContentHash' && key !== 'contentHash'));
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function packet(mode) {
  const sourceKey = `wiki-pageid:${mode === 'canonical' ? 1 : 2}|revision:${mode === 'canonical' ? 11 : 12}`;
  const sourceText = '{{Infobox NPC\n|name=Example\n|version1=Normal\n|version2=Quest\n|task2=Give the message to Example\n}}\nWise Old Man asks you to give the message to Example.';
  const page = {
    sourceKey,
    sourcePageId: mode === 'canonical' ? 1 : 2,
    resolvedTitle: `Example ${mode}`,
    sourceRevision: mode === 'canonical' ? '11' : '12',
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Example_${mode}`,
    sourceContentHash: hash(sourceText),
    sourceContentBytes: Buffer.byteLength(sourceText, 'utf8'),
    sourceText,
    complete: true
  };
  const context = [{
    sourceKey,
    resolvedTitle: page.resolvedTitle,
    heading: '==Task==',
    lineStart: 7,
    lineEnd: 7,
    exactSectionText: 'Wise Old Man asks you to give the message to Example.',
    exactSectionTextContentHash: hash('Wise Old Man asks you to give the message to Example.'),
    matchedCandidateTerms: ['Example'],
    matchedParentAnchor: 'Wise Old Man',
    semanticUse: 'candidate_scoped_parent_context_evidence_not_numbered_variant_binding'
  }];
  const identity = [{
    sourceKey,
    resolvedTitle: page.resolvedTitle,
    line: 3,
    parameterBase: 'version',
    parameterName: 'version1',
    value: 'Normal',
    variantIndex: 1,
    exactSourceText: '|version1=Normal',
    semanticUse: 'numbered_variant_identity_observation_not_task_alignment'
  }];
  const alignment = mode === 'exact' ? [{
    sourceKey,
    resolvedTitle: page.resolvedTitle,
    line: 5,
    parameterBase: 'task',
    parameterName: 'task2',
    value: 'Give the message to Example',
    variantIndex: 2,
    exactSourceText: '|task2=Give the message to Example',
    semanticUse: 'source_authored_same_line_task_to_numbered_variant_alignment_review_evidence'
  }] : [];
  const base = {
    contract: policy.evidencePacketContract,
    evidencePacketKey: `packet:${mode}`,
    workQueueEntryKey: `work:${mode}`,
    sourceDispositionKey: `source-disposition:${mode}`,
    structuralCandidateKey: `candidate:${mode}`,
    candidateRole: 'message_delivery_recipient_candidate',
    candidateDisplayName: `Example ${mode}`,
    sourceQueueSnapshotContentHash: 'a'.repeat(64),
    sourceEvidencePacketContentHash: 'b'.repeat(64),
    sourceWorkQueueEntryContentHash: 'e'.repeat(64),
    sourceWorkQueueRecordContentHash: 'f'.repeat(64),
    evidenceFingerprint: '1'.repeat(64),
    pinnedSourceRevalidations: [{ sourceKey, complete: true, checks: { pagePresent: true, revisionMatches: true, timestampMatches: true, titleMatches: true, pageIdMatches: true, contentComplete: true, contentHashMatches: true, contentBytesMatch: true } }],
    discoveryQueries: [{ queryKey: 'query:1', totalHits: 1, returnedCount: 1, continuationExhausted: true, truncated: false, results: [{ pageid: page.sourcePageId }] }],
    candidateSourcePages: [page],
    candidateScopedParentContextObservations: context,
    numberedVariantIdentityObservations: identity,
    exactTaskToNumberedVariantAlignmentObservations: alignment,
    requiredChannelStatus: [
      { channel: 'candidate_scoped_parent_occurrence_context', humanReviewRequired: false, satisfiedByCapturedEvidence: true },
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
    state: policy.evidencePacketState
  };
  return rehashPacket(base);
}

const compiled = compileMultiVariantBindingCanonicalSubjectScopeReviewQueueExportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const evidencePackets = [packet('canonical'), packet('exact')];
const dispositionBuild = buildMultiVariantBindingAdditionalEvidenceSufficiencyDisposition({ evidencePackets, policy: dispositionPolicy, sourceSnapshotContentHash: evidenceSnapshotHash });
assert.equal(dispositionBuild.audit.publishable, true);
const dispositionRecords = dispositionBuild.records.map(snapshotDisposition);
const built = buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport({
  dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash: evidenceSnapshotHash
});
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.queueExportComplete, true);
assert.equal(built.audit.inputCoverage.inputDispositionCount, 2);
assert.equal(built.audit.inputCoverage.eligibleCanonicalSubjectScopeDispositionCount, 1);
assert.equal(built.audit.inputCoverage.nonCanonicalDispositionCount, 1);
assert.equal(built.audit.queueCoverage.reviewQueueEntryCount, 1);
assert.equal(built.audit.queueCoverage.exactNumberedVariantReviewEntriesAllowed, 0);
assert.equal(built.audit.queueCoverage.blankDecisionTemplateCount, 1);
assert.equal(built.audit.sourceIntegrityCoverage.contextObservationCount, 2);
assert.equal(built.audit.sourceIntegrityCoverage.numberedVariantIdentityObservationCount, 2);
assert.equal(built.audit.sourceIntegrityCoverage.exactTaskToNumberedVariantAlignmentObservationCount, 1);
assert.equal(built.records.length, 1);
assert.equal(built.decisionTemplates.length, 1);

const entry = built.records[0];
assert.equal(entry.candidateDisplayName, 'Example canonical');
assert.equal(entry.reviewCandidateVariantIndex, null);
assert.equal(entry.bindingReviewDecision, null);
assert.equal(entry.boundVariantIndex, null);
assert.equal(entry.optimizerEligible, false);
assert.equal(entry.exactTaskToNumberedVariantAlignmentObservations.length, 0);
assert.equal(entry.reviewScope.canonicalContextObservedDoesNotProveExactNumberedVariant, true);
assert.ok(entry.reviewScope.confirmationDoesNotProve.includes('exact_numbered_variant_binding'));
assert.deepEqual(entry.allowedDecisions, policy.allowedDecisions);
assert.equal(entry.decisionTemplate.decision, null);
assert.equal(entry.decisionTemplate.reviewCandidateVariantIndex, null);
assert.equal(entry.decisionTemplate.boundVariantIndex, null);
assert.match(built.reviewMarkdown, /Review candidate variant: \*\*none\*\*/);
assert.match(built.reviewMarkdown, /None observed\. This absence is why exact variant binding remains blocked/);
assert.equal(renderMultiVariantBindingCanonicalSubjectScopeReviewQueueMarkdown(built.records), built.reviewMarkdown);
assert.equal(serializeMultiVariantBindingCanonicalSubjectScopeReviewDecisionTemplates(built.decisionTemplates), built.decisionTemplateNdjson);
for (const field of queueContract.required) assert.ok(Object.hasOwn(entry, field), `Missing queue field: ${field}`);
for (const field of decisionContract.required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing decision field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const deterministic = buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport({
  dispositionRecords: structuredClone(dispositionRecords), evidencePackets: structuredClone(evidencePackets), policy: structuredClone(policy), dispositionSnapshotContentHash, evidenceSnapshotContentHash: evidenceSnapshotHash
});
assert.deepEqual(deterministic, built);

const tamperedEvidence = structuredClone(evidencePackets);
tamperedEvidence[0].candidateSourcePages[0].sourceText += ' changed';
tamperedEvidence[0] = rehashPacket(tamperedEvidence[0]);
assert.equal(buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport({ dispositionRecords, evidencePackets: tamperedEvidence, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash: evidenceSnapshotHash }).audit.publishable, false);

const selectedVariant = structuredClone(dispositionRecords);
selectedVariant[0].reviewCandidateVariantIndex = 1;
selectedVariant[0] = rehashDisposition(selectedVariant[0]);
assert.equal(buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport({ dispositionRecords: selectedVariant, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash: evidenceSnapshotHash }).audit.publishable, false);

assert.equal(buildMultiVariantBindingCanonicalSubjectScopeReviewQueueExport({ dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash: '9'.repeat(64) }).audit.publishable, false);

const specific = structuredClone(policy);
specific.overrides = { 'candidate:canonical': 'review' };
assert.equal(compileMultiVariantBindingCanonicalSubjectScopeReviewQueueExportPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileMultiVariantBindingCanonicalSubjectScopeReviewQueueExportPolicy(automatic).valid, false);

const decidedRecords = structuredClone(built.records);
decidedRecords[0].reviewDecision = policy.allowedDecisions[0];
let audit = auditMultiVariantBindingCanonicalSubjectScopeReviewQueueExport(decidedRecords, {
  dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash: evidenceSnapshotHash,
  decisionTemplates: built.decisionTemplates, reviewMarkdown: renderMultiVariantBindingCanonicalSubjectScopeReviewQueueMarkdown(decidedRecords), decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('queue_export_created_review_binding_semantic_or_optimizer_promotion'));

const decidedTemplates = structuredClone(built.decisionTemplates);
decidedTemplates[0].decision = policy.allowedDecisions[0];
audit = auditMultiVariantBindingCanonicalSubjectScopeReviewQueueExport(built.records, {
  dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash: evidenceSnapshotHash,
  decisionTemplates: decidedTemplates, reviewMarkdown: built.reviewMarkdown, decisionTemplateNdjson: serializeMultiVariantBindingCanonicalSubjectScopeReviewDecisionTemplates(decidedTemplates)
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('queue_export_created_review_binding_semantic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
audit = auditMultiVariantBindingCanonicalSubjectScopeReviewQueueExport(accountScoped, {
  dispositionRecords, evidencePackets, policy, dispositionSnapshotContentHash, evidenceSnapshotContentHash: evidenceSnapshotHash,
  decisionTemplates: built.decisionTemplates, reviewMarkdown: renderMultiVariantBindingCanonicalSubjectScopeReviewQueueMarkdown(accountScoped), decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Multi-variant canonical-subject scope review queue export checks passed.');
