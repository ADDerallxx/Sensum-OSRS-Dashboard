import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditMultiVariantBindingReviewAndAdditionalEvidenceQueueExport,
  buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport,
  compileMultiVariantBindingReviewAndAdditionalEvidenceQueueExportPolicy,
  renderMultiVariantBindingAdditionalEvidenceQueueMarkdown,
  renderMultiVariantBindingReviewQueueMarkdown,
  serializeMultiVariantBindingReviewDecisionTemplates
} from '../transforms/multi-variant-binding-review-and-additional-evidence-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-binding-review-and-additional-evidence-queue-export-v1.json', 'utf8'));
const reviewContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-review-queue-entry-v1.json', 'utf8'));
const decisionContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-review-decision-template-v1.json', 'utf8'));
const additionalContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-additional-evidence-work-queue-entry-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-binding-review-and-additional-evidence-queue-export-audit-v1.json', 'utf8'));

function source(sourceKey, pageId, revision, title, text) {
  return {
    sourceKey,
    contexts: [],
    sourcePageIdentity: { sourcePageId: pageId, resolvedTitle: title, sourceRevision: revision, sourceTimestamp: '2026-01-01T00:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`, sourceContentHash: hash(text), sourceContentBytes: Buffer.byteLength(text, 'utf8') },
    exactRevisionSourceText: text,
    integrityChecks: { exactRevisionMatched: true },
    captureComplete: true,
    deficiencies: [],
    semanticVerdict: null,
    state: 'complete_exact_revision_source_capture_non_verdict'
  };
}

function packet({ key, subject, parent, root, parentOccurrence, ready }) {
  const base = {
    contract: 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-packet.v1',
    packetKey: `packet:${key}`,
    sourceWorkItemKey: `work:${key}`,
    sourceDispositionKey: `upstream:${key}`,
    structuralCandidateKey: `candidate:${key}`,
    candidateRole: ready ? 'item_delivery_target_candidate' : 'message_delivery_recipient_candidate',
    subjectEvidence: {
      sourceKey: subject.sourceKey,
      sourcePageIdentity: subject.sourcePageIdentity,
      sourcePageEntityTypes: [ready ? 'item_page' : 'npc_page'],
      rootInfobox: { template: ready ? 'Infobox Item' : 'Infobox NPC', lineStart: 1, lineEnd: 5, exactSourceText: root, exactSourceTextContentHash: hash(root) },
      numberedVariantIndices: [1, 2],
      numberedVariantInventory: [
        { variantIndex: 1, fields: [{ parameterName: ready ? 'name1' : 'version1', parameterBase: ready ? 'name' : 'version', variantIndex: 1, value: ready ? 'Bronze thing' : 'Normal', identityBearing: true }], identityFields: [] },
        { variantIndex: 2, fields: [{ parameterName: ready ? 'name2' : 'version2', parameterBase: ready ? 'name' : 'version', variantIndex: 2, value: ready ? 'Bronze thing(p)' : 'Quest', identityBearing: true }], identityFields: [] }
      ],
      unnumberedIdentityFields: ready ? [] : [{ parameterName: 'name', parameterBase: 'name', value: 'Priest' }]
    },
    parentOccurrenceEvidence: { sourceKey: parent.sourceKey, sourcePageIdentity: parent.sourcePageIdentity, exactSourceText: parentOccurrence, exactSourceTextContentHash: hash(parentOccurrence), sourceLocator: { lineStart: ready ? 1 : 2, lineEnd: ready ? 1 : 2 }, locatedSourceText: parentOccurrence, parsedLinks: [], subjectPageLinks: [{ displayText: ready ? 'Bronze thing' : 'Priest' }] },
    bindingEvidence: ready ? {
      state: 'unique_exact_parent_display_to_numbered_name_match_review_pending', numberedNameFields: [{ parameterName: 'name1', value: 'Bronze thing', variantIndex: 1 }, { parameterName: 'name2', value: 'Bronze thing(p)', variantIndex: 2 }], parentSubjectLinkDisplayValues: ['Bronze thing'], matchingVariantIndices: [1], sharedUnnumberedNameFields: [], sharedUnnumberedNameMatchesParentDisplay: false, uniqueExactNumberedNameMatch: true, reviewReadyForVariantBinding: true, bindingReviewDecision: null, boundVariantIndex: null
    } : {
      state: 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked', numberedNameFields: [], parentSubjectLinkDisplayValues: ['Priest'], matchingVariantIndices: [], sharedUnnumberedNameFields: [{ parameterName: 'name', parameterBase: 'name', value: 'Priest' }], sharedUnnumberedNameMatchesParentDisplay: true, uniqueExactNumberedNameMatch: false, reviewReadyForVariantBinding: false, bindingReviewDecision: null, boundVariantIndex: null
    },
    integrityChecks: { sourceAligned: true },
    captureComplete: true,
    variantBindingReviewComplete: false,
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    state: 'revision_pinned_parent_occurrence_variant_binding_evidence_captured_review_pending'
  };
  return { ...base, packetContentHash: hash(base) };
}

function disposition(packet, ready) {
  return {
    dispositionKey: `${packet.packetKey}|binding-evidence-disposition`,
    packetKey: packet.packetKey,
    sourceWorkItemKey: packet.sourceWorkItemKey,
    sourceDispositionKey: packet.sourceDispositionKey,
    structuralCandidateKey: packet.structuralCandidateKey,
    candidateRole: packet.candidateRole,
    evidenceIntegrity: { checks: { packetRevalidated: true }, complete: true },
    sufficiencyDisposition: {
      routeKey: ready ? policy.reviewReadyRouteKey : policy.additionalEvidenceRouteKey,
      state: ready ? 'review_ready_unique_exact_numbered_name_match_no_verdict' : 'blocked_parent_occurrence_variant_binding_evidence_not_sufficient',
      sourceBindingEvidenceState: packet.bindingEvidence.state,
      matchingVariantIndices: ready ? [1] : [],
      reviewCandidateVariantIndex: ready ? 1 : null,
      reviewReady: ready,
      requiredAdditionalEvidenceChannels: ready ? [] : ['candidate_scoped_parent_occurrence_context', 'source_authored_numbered_variant_identity_alignment', 'explicit_human_binding_review'],
      bindingReviewDecision: null,
      boundVariantIndex: null
    },
    candidateMemberIdentityVerdict: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    repeatabilityVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    canonicalGameEntityIdentity: null,
    memberUniverseComplete: false,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    blockers: ready ? [] : ['shared_unnumbered_name_does_not_discriminate_numbered_variant', 'no_unique_numbered_variant_match'],
    state: ready ? 'review_ready_for_explicit_source_bound_variant_binding_no_verdict' : 'blocked_additional_variant_disambiguation_evidence_required'
  };
}

function inputRecord() {
  const itemRoot = '{{Infobox Item\n|name1=Bronze thing\n|name2=Bronze thing(p)\n|id1=1\n|id2=2\n}}';
  const npcRoot = '{{Infobox NPC\n|version1=Normal\n|version2=Quest\n|name=Priest\n|id1=3\n|id2=4\n}}';
  const parentText = '{{plink|Bronze thing}}\n[[Priest page|Priest]]';
  const itemSource = source('subject:item', 101, '201', 'Bronze thing', `${itemRoot}\nBody`);
  const npcSource = source('subject:npc', 102, '202', 'Priest page', `${npcRoot}\nBody`);
  const parentSource = source('parent:1', 301, '401', 'Parent page', parentText);
  const readyPacket = packet({ key: 'ready', subject: itemSource, parent: parentSource, root: itemRoot, parentOccurrence: '{{plink|Bronze thing}}', ready: true });
  const blockedPacket = packet({ key: 'blocked', subject: npcSource, parent: parentSource, root: npcRoot, parentOccurrence: '[[Priest page|Priest]]', ready: false });
  const dispositions = [disposition(readyPacket, true), disposition(blockedPacket, false)];
  const base = {
    contract: policy.inputContract,
    memberCandidateKey: 'member:fixture',
    exactRevisionSources: [itemSource, npcSource, parentSource],
    variantBindingEvidencePackets: [readyPacket, blockedPacket],
    variantBindingEvidenceDispositions: dispositions,
    variantBindingEvidenceDispositionSummary: { dispositionCount: 2, reviewReadyDispositionCount: 1, additionalEvidenceDispositionCount: 1, bindingDecisionCount: 0, boundVariantCount: 0, optimizerEligibleCount: 0, memberUniverseComplete: false, automaticVerificationApplied: false },
    variantBindingEvidenceDispositionReview: { bindingReviewDecision: null, boundVariantIndex: null, candidateMemberIdentityVerdict: null, memberUniverseComplete: false, evidenceWorkComplete: false, automaticVerificationApplied: false },
    accountIndependent: true,
    optimizerEligible: false,
    blockers: ['multi_variant_binding_review_decisions_pending'],
    state: policy.inputState
  };
  return { ...base, contentHash: hash(base) };
}

const compiled = compileMultiVariantBindingReviewAndAdditionalEvidenceQueueExportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.routeKeysValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const input = inputRecord();
const built = buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport({ dispositionRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.queueExportComplete, true);
assert.equal(built.audit.variantBindingReviewComplete, false);
assert.equal(built.audit.sourceIntegrityCoverage.completeSourceCount, 3);
assert.equal(built.audit.packetAndDispositionIntegrityCoverage.revalidatedPacketCount, 2);
assert.equal(built.audit.packetAndDispositionIntegrityCoverage.revalidatedDispositionCount, 2);
assert.equal(built.audit.queuePartitionCoverage.reviewQueueEntryCount, 1);
assert.equal(built.audit.queuePartitionCoverage.additionalEvidenceQueueEntryCount, 1);
assert.equal(built.audit.queuePartitionCoverage.crossQueueKeys.length, 0);
assert.equal(built.audit.queuePartitionCoverage.blankDecisionTemplateCount, 1);
assert.equal(built.audit.queuePartitionCoverage.blankAdditionalEvidenceWorkCount, 1);
assert.equal(built.reviewRecords[0].variantBindingReviewEvidence.reviewCandidateVariantIndex, 1);
assert.equal(built.reviewRecords[0].variantBindingReviewEvidence.boundVariantIndex, null);
assert.equal(built.reviewRecords[0].boundVariantIndex, null);
assert.equal(built.reviewRecords[0].optimizerEligible, false);
assert.equal(built.decisionTemplates[0].decision, null);
assert.equal(built.additionalEvidenceRecords[0].reviewCandidateVariantIndex, null);
assert.equal(built.additionalEvidenceRecords[0].boundVariantIndex, null);
assert.match(built.reviewMarkdown, /proposed variant 1/);
assert.match(built.additionalEvidenceMarkdown, /not review-ready/);
assert.match(built.additionalEvidenceMarkdown, /shared_unnumbered_name/);
assert.equal(renderMultiVariantBindingReviewQueueMarkdown(built.reviewRecords), built.reviewMarkdown);
assert.equal(renderMultiVariantBindingAdditionalEvidenceQueueMarkdown(built.additionalEvidenceRecords), built.additionalEvidenceMarkdown);
assert.equal(serializeMultiVariantBindingReviewDecisionTemplates(built.decisionTemplates), built.decisionTemplateNdjson);
for (const field of reviewContract.required) assert.ok(Object.hasOwn(built.reviewRecords[0], field), `Missing review queue field: ${field}`);
for (const field of decisionContract.required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing decision template field: ${field}`);
for (const field of additionalContract.required) assert.ok(Object.hasOwn(built.additionalEvidenceRecords[0], field), `Missing additional evidence field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const deterministic = buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport({ dispositionRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministic, built);

const inheritedWithoutTopLevelOptimizerFlag = structuredClone(input);
delete inheritedWithoutTopLevelOptimizerFlag.optimizerEligible;
const inheritedBase = Object.fromEntries(Object.entries(inheritedWithoutTopLevelOptimizerFlag).filter(([key]) => key !== 'contentHash'));
inheritedWithoutTopLevelOptimizerFlag.contentHash = hash(inheritedBase);
assert.equal(buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport({ dispositionRecords: [inheritedWithoutTopLevelOptimizerFlag], policy }).audit.publishable, true);

const promotedInput = structuredClone(input);
promotedInput.optimizerEligible = true;
const promotedInputBase = Object.fromEntries(Object.entries(promotedInput).filter(([key]) => key !== 'contentHash'));
promotedInput.contentHash = hash(promotedInputBase);
assert.equal(buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport({ dispositionRecords: [promotedInput], policy }).audit.publishable, false);

const specific = structuredClone(policy);
specific.overrides = { 'candidate:ready': 'review' };
assert.equal(compileMultiVariantBindingReviewAndAdditionalEvidenceQueueExportPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileMultiVariantBindingReviewAndAdditionalEvidenceQueueExportPolicy(automatic).valid, false);

let changed = structuredClone(input);
changed.contentHash = '0'.repeat(64);
let failed = buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport({ dispositionRecords: [changed], policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('input_disposition_record_set_not_exactly_eligible_unique_and_hash_valid'));

changed = structuredClone(input);
changed.exactRevisionSources[0].exactRevisionSourceText += ' changed';
failed = buildMultiVariantBindingReviewAndAdditionalEvidenceQueueExport({ dispositionRecords: [changed], policy });
assert.equal(failed.audit.publishable, false);

const decided = structuredClone(built.decisionTemplates);
decided[0].decision = policy.allowedDecisions[0];
let audit = auditMultiVariantBindingReviewAndAdditionalEvidenceQueueExport(built.reviewRecords, { dispositionRecords: [input], policy, additionalEvidenceRecords: built.additionalEvidenceRecords, decisionTemplates: decided, reviewMarkdown: built.reviewMarkdown, additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: serializeMultiVariantBindingReviewDecisionTemplates(decided) });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('queue_export_created_review_evidence_or_unsupported_semantic_promotion'));

const crossed = structuredClone(built.additionalEvidenceRecords);
crossed.push({ ...structuredClone(crossed[0]), sourceDispositionKey: built.reviewRecords[0].sourceDispositionKey });
audit = auditMultiVariantBindingReviewAndAdditionalEvidenceQueueExport(built.reviewRecords, { dispositionRecords: [input], policy, additionalEvidenceRecords: crossed, decisionTemplates: built.decisionTemplates, reviewMarkdown: built.reviewMarkdown, additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: built.decisionTemplateNdjson });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('review_and_additional_evidence_queue_partition_not_exact_disjoint_and_complete'));

const accountScoped = structuredClone(built.reviewRecords);
accountScoped[0].currentBaseLevel = 34;
audit = auditMultiVariantBindingReviewAndAdditionalEvidenceQueueExport(accountScoped, { dispositionRecords: [input], policy, additionalEvidenceRecords: built.additionalEvidenceRecords, decisionTemplates: built.decisionTemplates, reviewMarkdown: built.reviewMarkdown, additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: built.decisionTemplateNdjson });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Multi-variant binding review and additional-evidence queue export checks passed.');
