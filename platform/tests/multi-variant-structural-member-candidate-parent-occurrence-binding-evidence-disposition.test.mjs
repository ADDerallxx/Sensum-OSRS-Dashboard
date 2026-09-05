import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions,
  buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions,
  compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionPolicy
} from '../transforms/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-disposition-audit-v1.json', 'utf8'));

function source(sourceKey, pageId, revision, title, text) {
  return {
    sourceKey,
    contexts: [],
    sourcePageIdentity: {
      sourcePageId: pageId,
      resolvedTitle: title,
      sourceRevision: revision,
      sourceTimestamp: '2026-01-01T00:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`,
      sourceContentHash: hash(text),
      sourceContentBytes: Buffer.byteLength(text, 'utf8')
    },
    exactRevisionSourceText: text,
    integrityChecks: { exactRevisionMatched: true },
    captureComplete: true,
    deficiencies: [],
    semanticVerdict: null,
    state: 'complete_exact_revision_source_capture_non_verdict'
  };
}

function packet({ key, subject, parent, exactParent, root, unique }) {
  const base = {
    contract: 'sensum.multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-packet.v1',
    packetKey: `packet:${key}`,
    sourceWorkItemKey: `work:${key}`,
    sourceDispositionKey: `source-disposition:${key}`,
    structuralCandidateKey: `candidate:${key}`,
    candidateRole: unique ? 'item_delivery_target_candidate' : 'message_delivery_recipient_candidate',
    subjectEvidence: {
      sourceKey: subject.sourceKey,
      sourcePageIdentity: subject.sourcePageIdentity,
      sourcePageEntityTypes: [unique ? 'item_page' : 'npc_page'],
      rootInfobox: { template: unique ? 'Infobox Item' : 'Infobox NPC', lineStart: 1, lineEnd: 5, exactSourceText: root, exactSourceTextContentHash: hash(root) },
      numberedVariantIndices: [1, 2],
      numberedVariantInventory: [
        { variantIndex: 1, fields: [{ parameterName: unique ? 'name1' : 'version1', parameterBase: unique ? 'name' : 'version', variantIndex: 1, value: unique ? 'Bronze thing' : 'Normal', identityBearing: true }], identityFields: [] },
        { variantIndex: 2, fields: [{ parameterName: unique ? 'name2' : 'version2', parameterBase: unique ? 'name' : 'version', variantIndex: 2, value: unique ? 'Bronze thing(p)' : 'Quest', identityBearing: true }], identityFields: [] }
      ],
      unnumberedIdentityFields: unique ? [] : [{ parameterName: 'name', parameterBase: 'name', value: 'Priest' }]
    },
    parentOccurrenceEvidence: {
      sourceKey: parent.sourceKey,
      sourcePageIdentity: parent.sourcePageIdentity,
      exactSourceText: exactParent,
      exactSourceTextContentHash: hash(exactParent),
      sourceLocator: { lineStart: unique ? 1 : 2, lineEnd: unique ? 1 : 2 },
      locatedSourceText: exactParent,
      parsedLinks: [],
      subjectPageLinks: [{ displayText: unique ? 'Bronze thing' : 'Priest', target: unique ? 'Bronze thing' : 'Priest page' }]
    },
    bindingEvidence: unique ? {
      state: 'unique_exact_parent_display_to_numbered_name_match_review_pending',
      numberedNameFields: [{ variantIndex: 1, value: 'Bronze thing' }, { variantIndex: 2, value: 'Bronze thing(p)' }],
      parentSubjectLinkDisplayValues: ['Bronze thing'],
      matchingVariantIndices: [1],
      sharedUnnumberedNameFields: [],
      sharedUnnumberedNameMatchesParentDisplay: false,
      uniqueExactNumberedNameMatch: true,
      reviewReadyForVariantBinding: true,
      bindingReviewDecision: null,
      boundVariantIndex: null,
      confirmationWouldNotProve: []
    } : {
      state: 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked',
      numberedNameFields: [],
      parentSubjectLinkDisplayValues: ['Priest'],
      matchingVariantIndices: [],
      sharedUnnumberedNameFields: [{ parameterName: 'name', parameterBase: 'name', value: 'Priest' }],
      sharedUnnumberedNameMatchesParentDisplay: true,
      uniqueExactNumberedNameMatch: false,
      reviewReadyForVariantBinding: false,
      bindingReviewDecision: null,
      boundVariantIndex: null,
      confirmationWouldNotProve: []
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

function evidenceRecord() {
  const itemRoot = '{{Infobox Item\n|name1=Bronze thing\n|name2=Bronze thing(p)\n|id1=1\n|id2=2\n}}';
  const npcRoot = '{{Infobox NPC\n|version1=Normal\n|version2=Quest\n|name=Priest\n|id1=3\n|id2=4\n}}';
  const parentText = '{{plink|Bronze thing}}\n[[Priest page|Priest]]';
  const item = source('subject:item', 101, '201', 'Bronze thing', `${itemRoot}\nBody`);
  const npc = source('subject:npc', 102, '202', 'Priest page', `${npcRoot}\nBody`);
  const parent = source('parent:1', 301, '401', 'Parent page', parentText);
  const packets = [
    packet({ key: 'unique', subject: item, parent, exactParent: '{{plink|Bronze thing}}', root: itemRoot, unique: true }),
    packet({ key: 'shared', subject: npc, parent, exactParent: '[[Priest page|Priest]]', root: npcRoot, unique: false })
  ];
  const base = {
    contract: policy.inputContract,
    memberCandidateKey: 'member:fixture',
    sourceRoutingRecordContentHash: 'routing-hash',
    exactRevisionSources: [item, npc, parent],
    variantBindingEvidencePackets: packets,
    variantBindingEvidenceSummary: {
      sourceCount: 3,
      completeSourceCount: 3,
      routedWorkItemCount: 2,
      evidencePacketCount: 2,
      completeCapturePacketCount: 2,
      uniqueNumberedNameMatchCount: 1,
      reviewReadyBindingEvidenceCount: 1,
      sharedUnnumberedNameAmbiguityCount: 1,
      otherUnresolvedBindingEvidenceCount: 0,
      evidenceCaptureComplete: true,
      variantBindingReviewComplete: false,
      bindingDecisionCount: 0,
      boundVariantCount: 0,
      automaticVerificationApplied: false
    },
    accountIndependent: true,
    optimizerEligible: false,
    blockers: ['multi_variant_parent_occurrence_binding_evidence_captured_reviews_pending'],
    state: policy.inputState
  };
  return { ...base, contentHash: hash(base) };
}

const compiled = compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.routeKeysValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const input = evidenceRecord();
const built = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions({ evidenceRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionCoverageComplete, true);
assert.equal(built.audit.variantBindingReviewComplete, false);
assert.equal(built.audit.sourceEvidenceIntegrityCoverage.exactRevisionSourceCount, 3);
assert.equal(built.audit.sourceEvidenceIntegrityCoverage.revalidatedSourceCount, 3);
assert.equal(built.audit.packetDispositionCoverage.evidencePacketCount, 2);
assert.equal(built.audit.packetDispositionCoverage.dispositionCount, 2);
assert.equal(built.audit.sufficiencyDispositionCoverage.reviewReadyCount, 1);
assert.equal(built.audit.sufficiencyDispositionCoverage.additionalEvidenceRequiredCount, 1);
assert.equal(built.audit.sufficiencyDispositionCoverage.sharedUnnumberedNameBlockedCount, 1);
assert.equal(built.records.length, 1);

const output = built.records[0];
const ready = output.variantBindingEvidenceDispositions[0];
const blocked = output.variantBindingEvidenceDispositions[1];
assert.equal(ready.sufficiencyDisposition.routeKey, policy.reviewReadyRouteKey);
assert.equal(ready.sufficiencyDisposition.reviewReady, true);
assert.equal(ready.sufficiencyDisposition.reviewCandidateVariantIndex, 1);
assert.equal(ready.sufficiencyDisposition.bindingReviewDecision, null);
assert.equal(ready.sufficiencyDisposition.boundVariantIndex, null);
assert.equal(blocked.sufficiencyDisposition.routeKey, policy.additionalEvidenceRouteKey);
assert.equal(blocked.sufficiencyDisposition.reviewReady, false);
assert.equal(blocked.sufficiencyDisposition.reviewCandidateVariantIndex, null);
assert.ok(blocked.blockers.includes('shared_unnumbered_name_does_not_discriminate_numbered_variant'));
assert.equal(output.variantBindingEvidenceDispositionSummary.bindingDecisionCount, 0);
assert.equal(output.variantBindingEvidenceDispositionSummary.optimizerEligibleCount, 0);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const deterministic = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions({ evidenceRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministic, built);

const tamperedSource = structuredClone(input);
tamperedSource.exactRevisionSources[0].exactRevisionSourceText += ' changed';
assert.equal(buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions({ evidenceRecords: [tamperedSource], policy }).audit.publishable, false);

const tamperedPacket = structuredClone(input);
tamperedPacket.variantBindingEvidencePackets[0].bindingEvidence.matchingVariantIndices = [2];
assert.equal(buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions({ evidenceRecords: [tamperedPacket], policy }).audit.publishable, false);

const specific = structuredClone(policy);
specific.overrides = { 'candidate:unique': 'ready' };
assert.equal(compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionPolicy(specific).valid, false);

const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositionPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].variantBindingEvidenceDispositions[0].sufficiencyDisposition.bindingReviewDecision = 'confirmed';
promoted[0].variantBindingEvidenceDispositions[0].sufficiencyDisposition.boundVariantIndex = 1;
promoted[0].optimizerEligible = true;
const promotedAudit = auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions(promoted, { evidenceRecords: [input], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('binding_evidence_disposition_created_unsupported_decision_or_semantic_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidenceDispositions(accountScoped, { evidenceRecords: [input], policy }).publishable, false);

console.log('Multi-variant parent-occurrence binding evidence disposition checks passed.');
