import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hash } from '../ingestion/lib.mjs';
import {
  auditWeightedParentTaskEntryMembershipEvidenceDispositions,
  buildWeightedParentTaskEntryMembershipEvidenceDispositions,
  compileWeightedParentTaskEntryMembershipEvidenceDispositionPolicy
} from '../transforms/weighted-parent-task-entry-membership-evidence-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/weighted-parent-task-entry-membership-evidence-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-evidence-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/weighted-parent-task-entry-membership-evidence-disposition-audit-v1.json', 'utf8'));

const source = key => ({
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
  roles: [key === 'parent' ? 'parent_inventory_source' : 'candidate_subject_source'],
  checks: { pageIdMatches: true, revisionMatches: true, contentHashMatches: true },
  complete: true
});

const observation = (channel, observations = [], extra = {}) => ({ channel, captureState: `captured_${channel}`, observations, semanticVerdict: null, ...extra });
function packet(key, { candidateWeight = 0, corroboration = 0, aliases = 0 } = {}) {
  const sourceEvidenceKeys = ['source:subject', 'source:parent'];
  const channels = [
    observation('exact_revision_source_revalidation', sourceEvidenceKeys.map(sourceKey => ({ sourceKey, complete: true, checks: { exact: true } })), { captureState: 'all_referenced_exact_revisions_revalidated' }),
    observation('exact_parent_occurrence_binding', [{ integrity: { complete: true, checks: { exact: true } }, occurrence: { exactSourceText: `candidate ${key}` } }], { captureState: 'exact_parent_occurrence_revalidated' }),
    observation('candidate_scoped_same_line_weight_statement', Array.from({ length: candidateWeight }, (_, index) => ({ observationKey: `weight:${key}:${index}` }))),
    observation('parent_global_weight_statement', [{ observationKey: 'global-weight' }], { distributionObservations: [{ observationKey: 'global-distribution' }] }),
    observation('candidate_subject_corroboration', Array.from({ length: corroboration }, (_, index) => ({ observationKey: `corroboration:${key}:${index}` }))),
    observation('duplicate_alias_and_variant_signals', Array.from({ length: aliases }, (_, index) => ({ observationKey: `alias:${key}:${index}` }))),
    observation('weighted_membership_verdict_separation', [], { weightedTaskEntryMembershipVerdict: null, automaticReviewForbidden: true })
  ];
  const base = {
    packetKey: `packet:${key}`,
    workItemKey: `work:${key}`,
    structuralCandidateKey: `candidate:${key}`,
    candidateRole: 'test_candidate_role',
    sourceDispositionKeys: [`source-disposition:${key}`],
    sourceEvidenceKeys,
    requiredChannels: [...policy.requiredInputChannels],
    channelObservations: channels,
    captureComplete: true,
    weightedMembershipSemanticEvidenceComplete: false,
    weightedTaskEntryMembershipVerdict: null,
    candidateMemberIdentityVerdict: null,
    mappingVerdict: null,
    inventoryCompletenessVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: ['weighted_parent_task_entry_membership_verdict_not_recorded'],
    state: 'revision_pinned_weighted_parent_task_entry_membership_evidence_captured_review_pending'
  };
  return { ...base, recordContentHash: hash(base) };
}

function sealRecord(record) {
  const { contentHash: ignored, ...withoutHash } = record;
  return { ...withoutHash, contentHash: hash(withoutHash) };
}

function evidenceRecord() {
  return sealRecord({
    contract: policy.inputContract,
    sourceRoutingRecordContentHash: hash('routing-record'),
    weightedParentTaskEntryMembershipEvidenceSources: [source('subject'), source('parent')],
    weightedParentTaskEntryMembershipEvidencePackets: [
      packet('variant-priority', { candidateWeight: 1, corroboration: 1, aliases: 2 }),
      packet('candidate-weight', { candidateWeight: 1 }),
      packet('corroborated', { corroboration: 1 }),
      packet('silent')
    ],
    weightedParentTaskEntryMembershipEvidenceReview: {
      state: 'unreviewed_source_bound_weighted_membership_evidence',
      reviewedPacketKeys: [], reviewer: null, reviewedAt: null, reviewNotes: null
    },
    weightedTaskEntryMembershipVerdict: null,
    memberUniverseComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: ['weighted_parent_task_entry_membership_not_proven'],
    state: policy.inputState
  });
}

const compiled = compileWeightedParentTaskEntryMembershipEvidenceDispositionPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.invalidChannels, []);
assert.deepEqual(compiled.invalidRoutes, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const input = evidenceRecord();
const built = buildWeightedParentTaskEntryMembershipEvidenceDispositions({ evidenceRecords: [input], policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionCoverageComplete, true);
assert.equal(built.audit.weightedMembershipReviewComplete, false);
assert.equal(built.audit.inputCoverage.inputRecordHashFailures.length, 0);
assert.equal(built.audit.sourceIntegrityCoverage.failedSourceCount, 0);
assert.equal(built.audit.packetIntegrityCoverage.failedPacketCount, 0);
assert.equal(built.audit.dispositionCoverage.dispositionCount, 4);
assert.deepEqual(built.audit.routeCoverage, {
  numbered_alias_or_variant_scope_evidence_required: 1,
  candidate_scoped_weight_review_ready: 1,
  candidate_subject_corroboration_review_ready: 1,
  additional_candidate_membership_evidence_required: 1
});
assert.equal(built.records.length, 1);
const dispositions = built.records[0].weightedParentTaskEntryMembershipEvidenceDispositions;
assert.equal(dispositions.find(item => item.packetKey === 'packet:variant-priority').route, 'numbered_alias_or_variant_scope_evidence_required');
assert.equal(dispositions.find(item => item.packetKey === 'packet:candidate-weight').route, 'candidate_scoped_weight_review_ready');
assert.equal(dispositions.find(item => item.packetKey === 'packet:corroborated').route, 'candidate_subject_corroboration_review_ready');
assert.equal(dispositions.find(item => item.packetKey === 'packet:silent').route, 'additional_candidate_membership_evidence_required');
for (const item of dispositions) {
  assert.equal(item.weightedTaskEntryMembershipVerdict, null);
  assert.equal(item.memberUniverseComplete, false);
  assert.equal(item.optimizerEligible, false);
  assert.equal(item.channelEvidenceBindings.length, policy.requiredInputChannels.length);
}
for (const field of recordContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing output field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field: ${field}`);

const deterministic = buildWeightedParentTaskEntryMembershipEvidenceDispositions({
  evidenceRecords: structuredClone([input]), policy: structuredClone(policy), contentHash: hash
});
assert.deepEqual(deterministic, built);

let bad = structuredClone(input);
bad.weightedParentTaskEntryMembershipEvidenceSources[0].checks.pageIdMatches = false;
bad = sealRecord(bad);
let failed = buildWeightedParentTaskEntryMembershipEvidenceDispositions({ evidenceRecords: [bad], policy, contentHash: hash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.sourceIntegrityCoverage.failedSourceCount, 1);

bad = structuredClone(input);
bad.weightedParentTaskEntryMembershipEvidencePackets[0].channelObservations[0].observations[0].checks.exact = false;
bad = sealRecord(bad);
failed = buildWeightedParentTaskEntryMembershipEvidenceDispositions({ evidenceRecords: [bad], policy, contentHash: hash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.packetIntegrityCoverage.failedPacketCount, 1);

bad = structuredClone(input);
bad.contentHash = 'stale';
failed = buildWeightedParentTaskEntryMembershipEvidenceDispositions({ evidenceRecords: [bad], policy, contentHash: hash });
assert.equal(failed.audit.publishable, false);
assert.equal(failed.audit.inputCoverage.inputRecordHashFailures.length, 1);

const specific = structuredClone(policy);
specific.overrides = { 'candidate:test': 'review_ready' };
assert.equal(compileWeightedParentTaskEntryMembershipEvidenceDispositionPolicy(specific).valid, false);
const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileWeightedParentTaskEntryMembershipEvidenceDispositionPolicy(automatic).valid, false);

const promoted = structuredClone(built.records);
promoted[0].weightedTaskEntryMembershipVerdict = 'member';
promoted[0].weightedParentTaskEntryMembershipEvidenceDispositions[0].weightedTaskEntryMembershipVerdict = 'member';
promoted[0].optimizerEligible = true;
let audit = auditWeightedParentTaskEntryMembershipEvidenceDispositions(promoted, { evidenceRecords: [input], policy, contentHash: hash });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('evidence_disposition_created_unsupported_review_or_semantic_promotion'));

const rerouted = structuredClone(built.records);
rerouted[0].weightedParentTaskEntryMembershipEvidenceDispositions[0].route = 'candidate_scoped_weight_review_ready';
audit = auditWeightedParentTaskEntryMembershipEvidenceDispositions(rerouted, { evidenceRecords: [input], policy, contentHash: hash });
assert.equal(audit.publishable, false);
assert.equal(audit.dispositionCoverage.routePriorityViolations.length, 1);

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
audit = auditWeightedParentTaskEntryMembershipEvidenceDispositions(accountScoped, { evidenceRecords: [input], policy, contentHash: hash });
assert.equal(audit.publishable, false);
assert.ok(audit.blockers.includes('current_account_state_present'));

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-weighted-disposition-'));
try {
  const directory = path.join(temporaryRoot, '2026-01-01T00-00-00-000Z');
  fs.mkdirSync(directory, { recursive: true });
  let invalidInput = structuredClone(input);
  invalidInput.weightedParentTaskEntryMembershipEvidenceSources[0].checks.pageIdMatches = false;
  invalidInput = sealRecord(invalidInput);
  const raw = `${JSON.stringify(invalidInput)}\n`;
  fs.writeFileSync(path.join(directory, 'weighted-parent-task-entry-membership-evidence.ndjson'), raw);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
    domain: 'weighted-parent-task-entry-membership-evidence',
    records: 1,
    contentHash: hash(raw),
    source: { audit: {
      evidencePacketCaptureComplete: true,
      weightedMembershipReviewComplete: false,
      completeActivityUniverse: false,
      publishable: true,
      packetCoverage: { evidencePacketCount: 4, completeEvidencePacketCount: 4 }
    } }
  }));
  const cli = spawnSync(process.execPath, [
    'platform/transforms/build-weighted-parent-task-entry-membership-evidence-dispositions.mjs',
    `--root=${temporaryRoot}`
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(cli.status, 2);
  const response = JSON.parse(cli.stdout);
  assert.equal(response.accepted, false);
  assert.equal(response.outputWritten, false);
  const outputFiles = fs.readdirSync(temporaryRoot, { recursive: true })
    .filter(file => String(file).endsWith('weighted-parent-task-entry-membership-evidence-disposition.ndjson'));
  assert.deepEqual(outputFiles, []);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('Generic weighted parent-task entry membership evidence disposition checks passed.');
