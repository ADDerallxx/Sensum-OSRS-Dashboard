import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hash } from '../ingestion/lib.mjs';
import {
  auditWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport,
  buildWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport,
  compileWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportPolicy,
  renderWeightedMembershipAdditionalEvidenceQueueMarkdown,
  renderWeightedMembershipReviewQueueMarkdown,
  renderWeightedMembershipVariantEvidenceQueueMarkdown,
  serializeWeightedMembershipReviewDecisionTemplates
} from '../transforms/weighted-parent-task-entry-membership-review-and-evidence-work-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-review-and-evidence-work-queue-export-v1.json', 'utf8'));
const contracts = [
  'platform/contracts/weighted-parent-task-entry-membership-review-queue-entry-v1.json',
  'platform/contracts/weighted-parent-task-entry-membership-review-decision-template-v1.json',
  'platform/contracts/weighted-parent-task-entry-membership-variant-scope-evidence-work-queue-entry-v1.json',
  'platform/contracts/weighted-parent-task-entry-membership-additional-evidence-work-queue-entry-v1.json',
  'platform/contracts/weighted-parent-task-entry-membership-review-and-evidence-work-queue-export-audit-v1.json'
].map(file => JSON.parse(fs.readFileSync(file, 'utf8')));

const source = (key, role) => ({
  sourceKey: `source:${key}`,
  sourcePageIdentity: {
    sourcePageId: key === 'parent' ? 100 : 101,
    resolvedTitle: key === 'parent' ? 'Test Master tasks' : 'Test subject',
    sourceRevision: key === 'parent' ? '500' : '501',
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/${key}`,
    sourceContentHash: hash(`source text ${key}`),
    sourceContentBytes: Buffer.byteLength(`source text ${key}`, 'utf8')
  },
  roles: [role], checks: { exactRevision: true }, complete: true
});

const observation = (channel, observations = [], extra = {}) => ({ channel, captureState: `captured_${channel}`, observations, semanticVerdict: null, ...extra });
function packet(key, { candidateWeight = 0, corroboration = 0, aliases = 0 } = {}) {
  const sourceEvidenceKeys = ['source:subject', 'source:parent'];
  const channels = [
    observation('exact_revision_source_revalidation', sourceEvidenceKeys.map(sourceKey => ({ sourceKey, complete: true, checks: { exact: true } }))),
    observation('exact_parent_occurrence_binding', [{ occurrence: { exactSourceText: `[[${key}]]`, exactSourceTextContentHash: hash(`[[${key}]]`) }, integrity: { complete: true, checks: { exact: true }, exactSourceLine: `* [[${key}]]` } }]),
    observation('candidate_scoped_same_line_weight_statement', Array.from({ length: candidateWeight }, (_, index) => ({ exactSourceLine: `candidate weight ${index}`, sourceLocator: { lineStart: 1 } }))),
    observation('parent_global_weight_statement', [{ exactSourceLine: 'Each task has the same chance.', sourceLocator: { lineStart: 2 } }], { distributionObservations: [{ exactSourceLine: 'These make up approximately 80% of all tasks.', sourceLocator: { lineStart: 3 } }] }),
    observation('candidate_subject_corroboration', Array.from({ length: corroboration }, (_, index) => ({ exactSourceLine: `Candidate is a Test Master task ${index}.`, sourceLocator: { lineStart: 4 } }))),
    observation('duplicate_alias_and_variant_signals', Array.from({ length: aliases }, (_, index) => ({ exactSourceText: `|version${index + 1} = Form ${index + 1}`, variantIndex: index + 1, sourceLocator: { lineStart: 5 + index } }))),
    observation('weighted_membership_verdict_separation', [], { weightedTaskEntryMembershipVerdict: null, automaticReviewForbidden: true })
  ];
  const base = {
    packetKey: `packet:${key}`, workItemKey: `work:${key}`, structuralCandidateKey: `candidate:${key}`,
    candidateRole: 'test_candidate_role', sourceDispositionKeys: [`upstream:${key}`], sourceEvidenceKeys,
    requiredChannels: channels.map(item => item.channel), channelObservations: channels,
    captureComplete: true, weightedMembershipSemanticEvidenceComplete: false,
    weightedTaskEntryMembershipVerdict: null, candidateMemberIdentityVerdict: null, mappingVerdict: null,
    inventoryCompletenessVerdict: null, memberUniverseComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true, blockers: [],
    state: 'revision_pinned_weighted_parent_task_entry_membership_evidence_captured_review_pending'
  };
  return { ...base, recordContentHash: hash(base) };
}

function route(packetRecord) {
  const count = name => packetRecord.channelObservations.find(item => item.channel === name).observations.length;
  if (count('duplicate_alias_and_variant_signals')) return 'numbered_alias_or_variant_scope_evidence_required';
  if (count('candidate_scoped_same_line_weight_statement')) return 'candidate_scoped_weight_review_ready';
  if (count('candidate_subject_corroboration')) return 'candidate_subject_corroboration_review_ready';
  return 'additional_candidate_membership_evidence_required';
}

function disposition(packetRecord) {
  const count = name => packetRecord.channelObservations.find(item => item.channel === name).observations.length;
  const result = route(packetRecord);
  return {
    dispositionKey: `${packetRecord.packetKey}|evidence-disposition`, packetKey: packetRecord.packetKey,
    packetRecordContentHash: packetRecord.recordContentHash, workItemKey: packetRecord.workItemKey,
    structuralCandidateKey: packetRecord.structuralCandidateKey, candidateRole: packetRecord.candidateRole,
    sourceDispositionKeys: packetRecord.sourceDispositionKeys, sourceEvidenceKeys: packetRecord.sourceEvidenceKeys,
    channelEvidenceBindings: packetRecord.channelObservations.map(item => ({ channel: item.channel, contentHash: hash(item) })),
    evidenceCounts: {
      candidateScopedWeightStatementCount: count('candidate_scoped_same_line_weight_statement'),
      parentGlobalWeightStatementCount: count('parent_global_weight_statement'),
      parentDistributionStatementCount: packetRecord.channelObservations.find(item => item.channel === 'parent_global_weight_statement').distributionObservations.length,
      candidateSubjectCorroborationCount: count('candidate_subject_corroboration'),
      numberedAliasOrVariantSignalCount: count('duplicate_alias_and_variant_signals')
    },
    route: result,
    reviewReady: policy.reviewRoutes.includes(result),
    weightedTaskEntryMembershipVerdict: null, candidateMemberIdentityVerdict: null, mappingVerdict: null,
    inventoryCompletenessVerdict: null, memberUniverseComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true, blockers: [],
    state: policy.reviewRoutes.includes(result) ? 'weighted_membership_evidence_review_ready_no_verdict' : 'weighted_membership_evidence_gap_routed_no_verdict'
  };
}

function inputRecord() {
  const packets = [
    packet('variant', { aliases: 2, candidateWeight: 1 }),
    packet('candidate-weight', { candidateWeight: 1 }),
    packet('corroborated', { corroboration: 1 }),
    packet('silent')
  ];
  const dispositions = packets.map(disposition);
  const routeCounts = Object.fromEntries([
    'numbered_alias_or_variant_scope_evidence_required', 'candidate_scoped_weight_review_ready',
    'candidate_subject_corroboration_review_ready', 'additional_candidate_membership_evidence_required'
  ].map(value => [value, dispositions.filter(item => item.route === value).length]));
  const base = {
    contract: policy.inputContract,
    sourceRoutingRecordContentHash: hash('routing-record'),
    sourceWeightedParentTaskEntryMembershipEvidenceContentHash: hash('evidence-record'),
    weightedParentTaskEntryMembershipEvidenceSources: [source('subject', 'candidate_subject_source'), source('parent', 'parent_inventory_source')],
    weightedParentTaskEntryMembershipEvidencePackets: packets,
    weightedParentTaskEntryMembershipEvidenceDispositions: dispositions,
    weightedParentTaskEntryMembershipEvidenceDisposition: {
      dispositionCount: dispositions.length, routeCounts, weightedTaskEntryMembershipVerdictCount: 0,
      candidateMemberIdentityVerdictCount: 0, mappingVerdictCount: 0, inventoryCompletenessVerdictCount: 0,
      memberUniverseComplete: false, optimizerEligibleCount: 0, automaticVerificationApplied: false
    },
    weightedParentTaskEntryMembershipEvidenceDispositionReview: {
      reviewedDispositionKeys: [], reviewer: null, reviewedAt: null, reviewNotes: null,
      weightedTaskEntryMembershipVerdict: null, automaticVerificationApplied: false
    },
    weightedTaskEntryMembershipVerdict: null, memberUniverseComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true, blockers: [], state: policy.inputState
  };
  return { ...base, contentHash: hash(base) };
}

function reseal(record) {
  const base = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'contentHash'));
  return { ...base, contentHash: hash(base) };
}

const compiled = compileWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportPolicy(policy);
assert.equal(compiled.valid, true);
assert.equal(compiled.contractValid, true);
assert.equal(compiled.routesValid, true);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const input = inputRecord();
const built = buildWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport({ dispositionRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.queueExportComplete, true);
assert.equal(built.audit.weightedMembershipReviewComplete, false);
assert.equal(built.audit.queuePartitionCoverage.reviewQueueEntryCount, 2);
assert.equal(built.audit.queuePartitionCoverage.blankDecisionTemplateCount, 2);
assert.equal(built.audit.queuePartitionCoverage.variantScopeEvidenceQueueEntryCount, 1);
assert.equal(built.audit.queuePartitionCoverage.additionalMembershipEvidenceQueueEntryCount, 1);
assert.equal(built.audit.queuePartitionCoverage.totalQueueEntryCount, 4);
assert.deepEqual(built.audit.queuePartitionCoverage.crossQueueKeys, []);
assert.equal(built.decisionTemplates.every(item => item.decision === null && item.reviewer === null && item.reviewedAt === null && item.reviewNotes === null), true);
assert.equal(built.variantEvidenceRecords[0].reviewCandidateVariantIndex, null);
assert.equal(built.additionalEvidenceRecords[0].sourceSilenceIsNotNegativeEvidence, true);
assert.match(built.reviewMarkdown, /Decision: \*\*blank\*\*/);
assert.match(built.variantEvidenceMarkdown, /No numbered name, version, alias, or variant index has been selected/);
assert.match(built.additionalEvidenceMarkdown, /Source silence is not a negative fact/);
assert.equal(renderWeightedMembershipReviewQueueMarkdown(built.reviewRecords), built.reviewMarkdown);
assert.equal(renderWeightedMembershipVariantEvidenceQueueMarkdown(built.variantEvidenceRecords), built.variantEvidenceMarkdown);
assert.equal(renderWeightedMembershipAdditionalEvidenceQueueMarkdown(built.additionalEvidenceRecords), built.additionalEvidenceMarkdown);
assert.equal(serializeWeightedMembershipReviewDecisionTemplates(built.decisionTemplates), built.decisionTemplateNdjson);
for (const field of contracts[0].required) assert.ok(Object.hasOwn(built.reviewRecords[0], field), `Missing review field: ${field}`);
for (const field of contracts[1].required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing decision field: ${field}`);
for (const field of contracts[2].required) assert.ok(Object.hasOwn(built.variantEvidenceRecords[0], field), `Missing variant field: ${field}`);
for (const field of contracts[3].required) assert.ok(Object.hasOwn(built.additionalEvidenceRecords[0], field), `Missing additional evidence field: ${field}`);
for (const field of contracts[4].required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const deterministic = buildWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport({ dispositionRecords: structuredClone([input]), policy: structuredClone(policy) });
assert.deepEqual(deterministic, built);

for (const changed of [
  { mutate: record => { record.contentHash = 'stale'; } },
  { mutate: record => { record.weightedParentTaskEntryMembershipEvidenceSources[0].checks.exactRevision = false; return reseal(record); } },
  { mutate: record => { record.weightedParentTaskEntryMembershipEvidencePackets[0].recordContentHash = 'stale'; return reseal(record); } },
  { mutate: record => { record.weightedParentTaskEntryMembershipEvidenceDispositions[0].channelEvidenceBindings[0].contentHash = 'stale'; return reseal(record); } }
]) {
  let bad = structuredClone(input);
  bad = changed.mutate(bad) || bad;
  assert.equal(buildWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport({ dispositionRecords: [bad], policy }).audit.publishable, false);
}

const specific = structuredClone(policy);
specific.overrides = { 'candidate:test': 'review' };
assert.equal(compileWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExportPolicy(automatic).valid, false);

const decided = structuredClone(built.decisionTemplates);
decided[0].decision = policy.allowedDecisions[0];
let audit = auditWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport(built.reviewRecords, {
  dispositionRecords: [input], policy, variantEvidenceRecords: built.variantEvidenceRecords,
  additionalEvidenceRecords: built.additionalEvidenceRecords, decisionTemplates: decided,
  reviewMarkdown: built.reviewMarkdown, variantEvidenceMarkdown: built.variantEvidenceMarkdown,
  additionalEvidenceMarkdown: built.additionalEvidenceMarkdown,
  decisionTemplateNdjson: serializeWeightedMembershipReviewDecisionTemplates(decided)
});
assert.equal(audit.publishable, false);

const crossed = structuredClone(built.additionalEvidenceRecords);
crossed.push({ ...structuredClone(crossed[0]), sourceDispositionKey: built.reviewRecords[0].sourceDispositionKey });
audit = auditWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport(built.reviewRecords, {
  dispositionRecords: [input], policy, variantEvidenceRecords: built.variantEvidenceRecords,
  additionalEvidenceRecords: crossed, decisionTemplates: built.decisionTemplates,
  reviewMarkdown: built.reviewMarkdown, variantEvidenceMarkdown: built.variantEvidenceMarkdown,
  additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('three_queue_partition_not_exact_disjoint_and_complete'));

const selectedVariant = structuredClone(built.variantEvidenceRecords);
selectedVariant[0].reviewCandidateVariantIndex = 1;
audit = auditWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport(built.reviewRecords, {
  dispositionRecords: [input], policy, variantEvidenceRecords: selectedVariant,
  additionalEvidenceRecords: built.additionalEvidenceRecords, decisionTemplates: built.decisionTemplates,
  reviewMarkdown: built.reviewMarkdown, variantEvidenceMarkdown: built.variantEvidenceMarkdown,
  additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);

const accountScoped = structuredClone(built.reviewRecords);
accountScoped[0].currentBaseLevel = 34;
audit = auditWeightedParentTaskEntryMembershipReviewAndEvidenceWorkQueueExport(accountScoped, {
  dispositionRecords: [input], policy, variantEvidenceRecords: built.variantEvidenceRecords,
  additionalEvidenceRecords: built.additionalEvidenceRecords, decisionTemplates: built.decisionTemplates,
  reviewMarkdown: built.reviewMarkdown, variantEvidenceMarkdown: built.variantEvidenceMarkdown,
  additionalEvidenceMarkdown: built.additionalEvidenceMarkdown, decisionTemplateNdjson: built.decisionTemplateNdjson
});
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-weighted-queue-export-'));
try {
  const directory = path.join(temporaryRoot, '2026-01-01T00-00-00-000Z');
  fs.mkdirSync(directory, { recursive: true });
  let invalidInput = structuredClone(input);
  invalidInput.weightedParentTaskEntryMembershipEvidenceSources[0].checks.exactRevision = false;
  invalidInput = reseal(invalidInput);
  const raw = `${JSON.stringify(invalidInput)}\n`;
  fs.writeFileSync(path.join(directory, 'weighted-parent-task-entry-membership-evidence-disposition.ndjson'), raw);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
    domain: 'weighted-parent-task-entry-membership-evidence-disposition', records: 1, contentHash: hash(raw),
    source: { audit: { dispositionCoverageComplete: true, weightedMembershipReviewComplete: false,
      completeActivityUniverse: false, publishable: true,
      dispositionCoverage: { dispositionCount: 4, missingDispositionPacketKeys: [], unexpectedDispositionPacketKeys: [] } } }
  }));
  const cli = spawnSync(process.execPath, [
    'platform/transforms/export-weighted-parent-task-entry-membership-review-and-evidence-work-queues.mjs',
    `--root=${temporaryRoot}`
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(cli.status, 2);
  const response = JSON.parse(cli.stdout);
  assert.equal(response.accepted, false);
  assert.equal(response.outputWritten, false);
  const outputs = fs.readdirSync(temporaryRoot, { recursive: true }).filter(file => /membership-(?:review|variant-scope|additional-evidence).*\.ndjson$/.test(String(file)));
  assert.deepEqual(outputs, []);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('Weighted parent-task membership review and evidence-work queue export checks passed.');
