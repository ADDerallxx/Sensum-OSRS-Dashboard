import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditStructuralMemberCandidateIdentityReviewQueueExport,
  buildStructuralMemberCandidateIdentityReviewQueueExport,
  compileStructuralMemberCandidateIdentityReviewQueueExportPolicy,
  renderStructuralMemberCandidateIdentityReviewQueueMarkdown,
  serializeStructuralMemberCandidateIdentityDecisionTemplates
} from '../transforms/structural-member-candidate-identity-review-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/structural-member-candidate-identity-review-queue-export-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/structural-member-candidate-identity-review-queue-entry-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/structural-member-candidate-identity-review-queue-export-audit-v1.json', 'utf8'));

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
    exactRevisionSourceText: text,
    integrityChecks: { revisionMatches: true, titleMatches: true, hashMatches: true },
    captureComplete: true,
    semanticVerdict: null,
    state: 'complete_exact_revision_source_capture_non_verdict'
  };
}

function packet(prefix = '1') {
  const subjectText = `{{Infobox Item\n|name = Subject ${prefix}\n|id = ${prefix}\n}}`;
  const parentOccurrence = `{{plink|Subject ${prefix}}}`;
  const subjectIdentity = {
    sourcePageId: 100 + Number(prefix),
    resolvedTitle: `Subject ${prefix}`,
    sourceRevision: String(200 + Number(prefix)),
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Subject_${prefix}`,
    sourceContentHash: hash(subjectText),
    sourceContentBytes: Buffer.byteLength(subjectText, 'utf8')
  };
  const parentText = `Lead.\n${parentOccurrence}\nEnd.`;
  const parentIdentity = {
    sourcePageId: 300 + Number(prefix),
    resolvedTitle: `Parent ${prefix}`,
    sourceRevision: String(400 + Number(prefix)),
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Parent_${prefix}`,
    sourceContentHash: hash(parentText),
    sourceContentBytes: Buffer.byteLength(parentText, 'utf8')
  };
  const base = {
    contract: 'sensum.structural-member-candidate-identity-review-packet.v1',
    reviewPacketKey: `review-packet:${prefix}`,
    sourceWorkItemKey: `work:${prefix}`,
    sourceDispositionKey: `disposition:${prefix}`,
    structuralCandidateKey: `candidate:${prefix}`,
    candidateRole: 'item_delivery_target_candidate',
    subjectEvidence: {
      sourceKey: `subject:${prefix}`,
      sourcePageIdentity: subjectIdentity,
      sourcePageEntityTypes: ['item_page'],
      identityBearingSourcePageTypes: ['item_page'],
      supplementarySourcePageTypes: [],
      rootInfobox: {
        template: 'Infobox Item',
        lineStart: 1,
        lineEnd: 4,
        exactSourceText: subjectText,
        exactSourceTextContentHash: hash(subjectText),
        parameterNames: ['name', 'id'],
        sourceAuthoredNameFields: [{ name: 'name', value: `Subject ${prefix}` }]
      },
      sourceIntegrity: { checks: { hashMatches: true, bytesMatch: true }, complete: true }
    },
    parentOccurrenceEvidence: {
      sourceKey: `parent:${prefix}`,
      sourcePageIdentity: parentIdentity,
      exactSourceText: parentOccurrence,
      exactSourceTextContentHash: hash(parentOccurrence),
      sourceLocator: { lineStart: 2, lineEnd: 2, columnStart: 1, columnEnd: parentOccurrence.length },
      locatedSourceText: parentOccurrence,
      structuralRelationshipClass: 'source_lists_subject_as_item_delivery_target',
      roleTypeCoherenceState: 'supported_required_source_page_type_present',
      integrity: { checks: { parentHashMatches: true, occurrenceMatches: true }, complete: true }
    },
    reviewScope: {
      decisionScope: 'exact_candidate_to_revision_pinned_source_page_subject_identity_and_single_infobox_variant',
      confirmationDoesNotProve: ['weighted_parent_membership', 'repeatability', 'requirements', 'xp', 'timing', 'mechanics', 'declared_total_mapping', 'member_universe_completeness', 'optimizer_eligibility'],
      sourceRevisions: [subjectIdentity.sourceRevision, parentIdentity.sourceRevision].sort()
    },
    allowedDecisions: [...policy.allowedDecisions],
    integrityChecks: { subjectComplete: true, parentComplete: true, candidateMatch: true },
    packetMaterializationComplete: true,
    eligibleForSourceBoundReview: true,
    decision: null,
    reviewer: null,
    reviewedAt: null,
    decisionSourceRevisions: [],
    reviewNotes: null,
    candidateMemberIdentityVerdict: null,
    canonicalGameEntityIdentity: null,
    parentMembershipVerdict: null,
    weightedTaskEntryMembershipVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    automaticVerificationApplied: false,
    state: policy.outputState
  };
  return {
    packet: { ...base, packetContentHash: hash(base) },
    sources: [
      source(`subject:${prefix}`, subjectIdentity.sourcePageId, subjectIdentity.sourceRevision, subjectIdentity.resolvedTitle, subjectText),
      source(`parent:${prefix}`, parentIdentity.sourcePageId, parentIdentity.sourceRevision, parentIdentity.resolvedTitle, parentText)
    ]
  };
}

function inputRecord(packetCount = 1) {
  const bundles = Array.from({ length: packetCount }, (_, index) => packet(String(index + 1)));
  const packets = bundles.map(bundle => bundle.packet);
  const base = {
    contract: policy.inputContract,
    memberCandidateKey: 'member:fixture',
    structuralMemberCandidateSemanticGapEvidenceSources: bundles.flatMap(bundle => bundle.sources),
    structuralMemberCandidateIdentityReviewPackets: packets,
    structuralMemberCandidateIdentityReviewPacketMaterialization: {
      state: 'source_bound_identity_review_packets_materialized_decisions_pending',
      reviewPacketCount: packets.length,
      reviewPacketMaterializationComplete: true,
      identityReviewComplete: false,
      decisionCount: 0,
      candidateMemberIdentityVerdictCount: 0,
      canonicalGameEntityIdentityCount: 0,
      memberUniverseComplete: false,
      evidenceWorkComplete: false,
      automaticVerificationApplied: false
    },
    memberExpansionReview: { state: 'unreviewed' },
    mechanicsReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['source_bound_candidate_identity_review_packets_materialized_decisions_pending'],
    state: policy.inputState
  };
  return { ...base, contentHash: hash(base) };
}

const compiled = compileStructuralMemberCandidateIdentityReviewQueueExportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const input = inputRecord();
const built = buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.reviewQueueExportComplete, true);
assert.equal(built.audit.identityReviewComplete, false);
assert.equal(built.audit.inputCoverage.inputReviewPacketCount, 1);
assert.equal(built.audit.sourceIntegrityCoverage.completeSourceCount, 2);
assert.equal(built.audit.packetIntegrityCoverage.completePacketCount, 1);
assert.equal(built.audit.queueCoverage.fingerprintBoundEntryCount, 1);
assert.equal(built.audit.queueCoverage.blankDecisionTemplateCount, 1);
assert.equal(built.audit.artifactCoverage.markdownEntryCount, 1);
assert.equal(built.audit.semanticPreservationCoverage.decisionCount, 0);
assert.equal(built.records.length, 1);
assert.equal(built.decisionTemplates.length, 1);
assert.match(built.markdown, /Subject 1/);
assert.match(built.markdown, /oldid=201/);
assert.match(built.markdown, /does \*\*not\*\* prove weighted parent membership/);
assert.equal(built.records[0].candidateDisplayName, 'Subject 1');
assert.equal(built.records[0].queueOrdinal, 1);
assert.equal(built.records[0].decisionTemplate.decision, null);
assert.equal(built.records[0].evidenceFingerprint, built.decisionTemplates[0].evidenceFingerprint);
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing queue field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const multiple = buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords: [inputRecord(2)], policy });
assert.equal(multiple.audit.publishable, true);
assert.deepEqual(multiple.records.map(record => record.queueOrdinal), [1, 2]);
assert.deepEqual(multiple.records.map(record => record.reviewPacketKey), ['review-packet:1', 'review-packet:2']);
assert.equal((multiple.markdown.match(/<details>/g) || []).length, 2);

const deterministic = buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministic, built);
assert.equal(renderStructuralMemberCandidateIdentityReviewQueueMarkdown(built.records), built.markdown);
assert.equal(serializeStructuralMemberCandidateIdentityDecisionTemplates(built.decisionTemplates), built.decisionTemplateNdjson);

const specific = structuredClone(policy);
specific.overrides = { 'candidate:1': 'confirm' };
assert.equal(compileStructuralMemberCandidateIdentityReviewQueueExportPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileStructuralMemberCandidateIdentityReviewQueueExportPolicy(automatic).valid, false);

let changed = structuredClone(input);
changed.contentHash = '0'.repeat(64);
let failed = buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords: [changed], policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_input_packet_record_hashes_failed_revalidation'));

changed = structuredClone(input);
changed.structuralMemberCandidateSemanticGapEvidenceSources[0].exactRevisionSourceText += ' changed';
failed = buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords: [changed], policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_retained_exact_revision_sources_failed_revalidation'));

changed = structuredClone(input);
changed.structuralMemberCandidateIdentityReviewPackets[0].subjectEvidence.rootInfobox.exactSourceText += ' changed';
failed = buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords: [changed], policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('one_or_more_source_bound_review_packets_failed_revalidation'));

changed = structuredClone(input);
changed.structuralMemberCandidateIdentityReviewPackets.push(structuredClone(changed.structuralMemberCandidateIdentityReviewPackets[0]));
failed = buildStructuralMemberCandidateIdentityReviewQueueExport({ packetRecords: [changed], policy });
assert.equal(failed.audit.publishable, false);
assert.ok(failed.audit.blockers.includes('input_review_packet_set_not_exactly_eligible_and_unique'));

const tamperedRecords = structuredClone(built.records);
tamperedRecords[0].evidenceFingerprint = 'f'.repeat(64);
let audit = auditStructuralMemberCandidateIdentityReviewQueueExport(tamperedRecords, {
  packetRecords: [input],
  policy,
  decisionTemplates: built.decisionTemplates,
  markdown: built.markdown,
  decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('one_or_more_queue_entries_do_not_match_generic_export_policy'));

const decidedTemplates = structuredClone(built.decisionTemplates);
decidedTemplates[0].decision = policy.allowedDecisions[0];
audit = auditStructuralMemberCandidateIdentityReviewQueueExport(built.records, {
  packetRecords: [input],
  policy,
  decisionTemplates: decidedTemplates,
  markdown: built.markdown,
  decisionTemplateNdjson: serializeStructuralMemberCandidateIdentityDecisionTemplates(decidedTemplates)
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('queue_export_created_review_state_or_unsupported_semantic_promotion'));

const reversed = [...multiple.records].reverse();
audit = auditStructuralMemberCandidateIdentityReviewQueueExport(reversed, {
  packetRecords: [inputRecord(2)],
  policy,
  decisionTemplates: multiple.decisionTemplates,
  markdown: multiple.markdown,
  decisionTemplateNdjson: multiple.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('review_queue_does_not_preserve_source_packet_order'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
audit = auditStructuralMemberCandidateIdentityReviewQueueExport(accountScoped, {
  packetRecords: [input],
  policy,
  decisionTemplates: built.decisionTemplates,
  markdown: built.markdown,
  decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

console.log('Structural member candidate identity review queue export checks passed.');
