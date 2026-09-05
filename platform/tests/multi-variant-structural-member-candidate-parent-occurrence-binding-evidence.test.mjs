import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence,
  buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence,
  compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidencePolicy,
  discoverMultiVariantStructuralMemberCandidateParentOccurrenceBindingExactRevisionRequests
} from '../ingestion/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/multi-variant-structural-member-candidate-parent-occurrence-binding-evidence-audit-v1.json', 'utf8'));

function source(sourceKey, pageId, revision, title, text) {
  return {
    sourceKey,
    sourcePageIdentity: {
      sourcePageId: pageId,
      resolvedTitle: title,
      sourceRevision: revision,
      sourceTimestamp: '2026-01-01T00:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`,
      sourceContentHash: hash(text),
      sourceContentBytes: Buffer.byteLength(text, 'utf8')
    },
    exactRevisionSourceText: text
  };
}

function workItem(prefix, subject, candidateRole, infoboxTemplate, names, indices) {
  const candidateKey = `candidate:${prefix}`;
  return {
    item: {
      workItemKey: `work:${prefix}`,
      routeKey: policy.routeKey,
      workKind: 'exact_parent_occurrence_to_numbered_source_variant_binding_evidence',
      structuralCandidateKey: candidateKey,
      candidateRole,
      sourceDispositionKeys: [`disposition:${prefix}`],
      sourceEvidenceKeys: [subject.sourceKey, 'parent:1'],
      requiredChannels: ['exact_parent_occurrence_scope', 'numbered_source_variant_inventory', 'parent_occurrence_to_variant_mapping', 'variant_binding_review'],
      identityAndVariantScopeReviewReadiness: {
        sourceEvidenceKey: subject.sourceKey,
        sourceIntegrity: { complete: true },
        sourcePageIdentity: subject.sourcePageIdentity,
        sourcePageEntityTypes: [infoboxTemplate === 'Infobox Item' ? 'item_page' : 'npc_page'],
        identityBearingSourcePageTypes: [infoboxTemplate === 'Infobox Item' ? 'item_page' : 'npc_page'],
        supplementarySourcePageTypes: [],
        identityBearingRootTemplates: [{ template: infoboxTemplate, line: 2, numberedVariantIndices: indices, parameterNames: [] }],
        infoboxNameFields: names,
        numberedVariantIndices: indices,
        multiVariantSeries: true,
        structuralParentRelationshipState: 'supported_source_structural_relationship_not_parent_membership_verdict',
        reviewReady: false,
        blockers: ['multiple_numbered_entity_variants_require_exact_parent_variant_binding']
      },
      reviewReady: false,
      reviewDecision: null,
      newEvidenceKeys: [],
      candidateMemberIdentityVerdict: null,
      sourcePageEntityTypeVerdict: null,
      structuralParentRelationshipVerdict: null,
      weightedTaskEntryMembershipVerdict: null,
      mappingVerdict: null,
      inventoryCompletenessVerdict: null,
      canonicalGameEntityIdentity: null,
      memberUniverseComplete: false,
      evidenceWorkComplete: false,
      automaticVerificationApplied: false,
      workState: 'blocked_pending_exact_parent_variant_binding_evidence'
    },
    candidateKey
  };
}

function inputRecord({ ambiguousItem = false } = {}) {
  const itemNames = ambiguousItem
    ? [{ name: 'name1', value: 'Bronze thing' }, { name: 'name2', value: 'Bronze thing' }]
    : [{ name: 'name1', value: 'Bronze thing' }, { name: 'name2', value: 'Bronze thing(p)' }];
  const itemText = `Lead.\n{{Infobox Item\n|name1 = ${itemNames[0].value}\n|name2 = ${itemNames[1].value}\n|version1 = Normal\n|version2 = Poisoned\n|id1 = 1\n|id2 = 2\n}}\nBody.`;
  const npcText = 'Lead.\n{{Infobox NPC\n|version1 = Before quest\n|version2 = After quest\n|name = Priest\n|id1 = 3\n|id2 = 4\n}}\nBody.';
  const parentText = 'Header.\n{{plink|Bronze thing}}\n*[[Priest page|Priest]] at [[Somewhere]].';
  const itemSource = source('item:1', 101, '201', 'Bronze thing', itemText);
  const npcSource = source('npc:1', 102, '202', 'Priest page', npcText);
  const parentSource = source('parent:1', 301, '401', 'Parent page', parentText);
  const itemWork = workItem('item', itemSource, 'item_delivery_target_candidate', 'Infobox Item', itemNames, [1, 2]);
  const npcWork = workItem('npc', npcSource, 'message_delivery_recipient_candidate', 'Infobox NPC', [{ name: 'name', value: 'Priest' }], [1, 2]);
  const candidate = (work, occurrence, line, column) => ({
    structuralCandidateKey: work.candidateKey,
    structuralParentRelationship: {
      supported: true,
      parentMembershipVerdict: null,
      weightedTaskEntryMembershipVerdict: null,
      evidence: {
        sourceCandidateEvidence: {
          sourcePageId: parentSource.sourcePageIdentity.sourcePageId,
          sourceRevision: parentSource.sourcePageIdentity.sourceRevision,
          sourceContentHash: parentSource.sourcePageIdentity.sourceContentHash,
          exactSourceText: occurrence,
          exactSourceTextContentHash: hash(occurrence),
          sourceLocator: { lineStart: line, lineEnd: line, ...(column ? { columnStart: column, columnEnd: column + occurrence.length - 1 } : {}) }
        }
      }
    }
  });
  const base = {
    contract: policy.inputContract,
    memberCandidateKey: 'member:fixture',
    structuralMemberCandidateSemanticGapEvidenceSources: [itemSource, npcSource, parentSource],
    structuralMemberCandidateIdentityDispositions: [
      candidate(itemWork, '{{plink|Bronze thing}}', 2, 1),
      candidate(npcWork, '*[[Priest page|Priest]] at [[Somewhere]].', 3)
    ],
    structuralMemberCandidateReviewReadyIdentityAndRemainingGapWorkRouting: {
      routeState: 'review_ready_identities_and_remaining_semantic_gaps_routed_all_verdicts_closed',
      multiVariantIdentityWorkItems: [itemWork.item, npcWork.item],
      multiVariantIdentityWorkItemCount: 2,
      identityReviewComplete: false,
      memberUniverseComplete: false,
      evidenceWorkComplete: false,
      automaticVerificationApplied: false
    },
    memberExpansionReview: { state: 'unreviewed' },
    mechanicsReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['multi_variant_identity_work_pending'],
    state: policy.inputState
  };
  return { ...base, contentHash: hash(base) };
}

function revisionBatches(record) {
  const requests = discoverMultiVariantStructuralMemberCandidateParentOccurrenceBindingExactRevisionRequests([record], policy);
  const byRevision = new Map(record.structuralMemberCandidateSemanticGapEvidenceSources.map(item => [item.sourcePageIdentity.sourceRevision, item]));
  return [{
    requestedRevisions: requests.map(request => request.sourceRevision),
    response: {
      query: {
        pages: requests.map(request => {
          const item = byRevision.get(request.sourceRevision);
          return {
            pageid: item.sourcePageIdentity.sourcePageId,
            ns: 0,
            title: item.sourcePageIdentity.resolvedTitle,
            revisions: [{ revid: Number(item.sourcePageIdentity.sourceRevision), timestamp: item.sourcePageIdentity.sourceTimestamp, slots: { main: { content: item.exactRevisionSourceText } } }]
          };
        })
      }
    }
  }];
}

const compiled = compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidencePolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.parameterBasesValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.invalidSourceCapture, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const input = inputRecord();
const batches = revisionBatches(input);
const requests = discoverMultiVariantStructuralMemberCandidateParentOccurrenceBindingExactRevisionRequests([input], policy);
assert.equal(requests.length, 3);
const built = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence({ routingRecords: [input], revisionBatches: batches, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidenceCaptureComplete, true);
assert.equal(built.audit.variantBindingReviewComplete, false);
assert.equal(built.audit.revisionRequestCoverage.distinctPinnedRevisionCount, 3);
assert.equal(built.audit.sourceCoverage.completeExactRevisionSourceCount, 3);
assert.equal(built.audit.packetCoverage.evidencePacketCount, 2);
assert.equal(built.audit.bindingEvidenceCoverage.uniqueExactNumberedNameMatchCount, 1);
assert.equal(built.audit.bindingEvidenceCoverage.reviewReadyBindingEvidenceCount, 1);
assert.equal(built.audit.bindingEvidenceCoverage.sharedUnnumberedNameAmbiguityCount, 1);
assert.equal(built.audit.bindingEvidenceCoverage.bindingDecisionCount, 0);
assert.equal(built.records.length, 1);
const packets = built.records[0].variantBindingEvidencePackets;
assert.equal(packets[0].bindingEvidence.state, 'unique_exact_parent_display_to_numbered_name_match_review_pending');
assert.deepEqual(packets[0].bindingEvidence.matchingVariantIndices, [1]);
assert.equal(packets[0].bindingEvidence.boundVariantIndex, null);
assert.equal(packets[1].bindingEvidence.state, 'shared_unnumbered_name_across_variants_parent_occurrence_not_discriminating_review_blocked');
assert.equal(packets[1].bindingEvidence.reviewReadyForVariantBinding, false);
assert.deepEqual(packets[1].bindingEvidence.matchingVariantIndices, []);
assert.equal(packets[1].subjectEvidence.numberedVariantInventory.length, 2);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing evidence record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing evidence audit field ${field}`);

const deterministic = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence({ routingRecords: [structuredClone(input)], revisionBatches: structuredClone(batches), policy: structuredClone(policy) });
assert.deepEqual(deterministic, built);

const ambiguousInput = inputRecord({ ambiguousItem: true });
const ambiguous = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence({ routingRecords: [ambiguousInput], revisionBatches: revisionBatches(ambiguousInput), policy });
assert.equal(ambiguous.audit.publishable, true);
assert.equal(ambiguous.audit.bindingEvidenceCoverage.ambiguousMultipleMatchCount, 1);
assert.equal(ambiguous.records[0].variantBindingEvidencePackets[0].bindingEvidence.reviewReadyForVariantBinding, false);

let changedBatches = structuredClone(batches);
changedBatches[0].response.query.pages[0].revisions[0].slots.main.content += ' changed';
let failed = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence({ routingRecords: [input], revisionBatches: changedBatches, policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_exact_revision_sources_failed_revalidation'));

changedBatches = structuredClone(batches);
changedBatches[0].requestedRevisions.pop();
failed = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence({ routingRecords: [input], revisionBatches: changedBatches, policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('exact_revision_request_set_incomplete_or_mismatched'));

const staleInput = structuredClone(input);
staleInput.contentHash = '0'.repeat(64);
failed = buildMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence({ routingRecords: [staleInput], revisionBatches: revisionBatches(staleInput), policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_input_routing_record_hashes_failed_revalidation'));

const specific = structuredClone(policy);
specific.overrides = { 'candidate:item': 1 };
assert.equal(compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidencePolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidencePolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].variantBindingEvidencePackets[0].bindingEvidence.boundVariantIndex = 1;
promoted[0].variantBindingEvidencePackets[0].bindingEvidence.bindingReviewDecision = 'confirmed';
let audit = auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence(promoted, { routingRecords: [input], revisionBatches: batches, policy });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('binding_evidence_capture_created_unsupported_decision_or_semantic_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
audit = auditMultiVariantStructuralMemberCandidateParentOccurrenceBindingEvidence(accountScoped, { routingRecords: [input], revisionBatches: batches, policy });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Multi-variant structural member candidate parent-occurrence binding evidence checks passed.');
