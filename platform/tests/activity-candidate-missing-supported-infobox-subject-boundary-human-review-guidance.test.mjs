import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance,
  buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance,
  compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidancePolicy
} from '../transforms/activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-lib.mjs';
import { expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision } from '../transforms/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-v1.json');
const queuePolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-v1.json');
const decisionPolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-v1.json');
const routingPolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json');
const oneHopPolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json');
const recursivePolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json');
const guidanceContract = readJson('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-v1.json');
const auditContract = readJson('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance-audit-v1.json');
const createdAt = '2026-09-06T08:00:00.000Z';

function queueRecord(ordinal = 1) {
  const candidateKey = `osrs-wiki-pageid:${9100 + ordinal}`;
  const sourceContentHash = hash(`guidance-source-${ordinal}`);
  const sourcePageIdentity = {
    resolvedTitle: `Synthetic guidance subject ${ordinal}`,
    sourceContentBytes: 1200 + ordinal,
    sourceContentHash,
    sourcePageId: 9100 + ordinal,
    sourceRevision: String(15100000 + ordinal),
    sourceTimestamp: '2026-09-06T07:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Guidance_${ordinal}`
  };
  const sourceBindings = {
    routingSnapshotContentHash: hash(`routing-snapshot-${ordinal}`), routingRecordContentHash: hash(`routing-record-${ordinal}`), routingOuterContentHash: hash(`routing-outer-${ordinal}`),
    oneHopSnapshotContentHash: hash(`one-hop-snapshot-${ordinal}`), oneHopRecordContentHash: hash(`one-hop-record-${ordinal}`), oneHopOuterContentHash: hash(`one-hop-outer-${ordinal}`),
    recursiveSnapshotContentHash: hash(`recursive-snapshot-${ordinal}`), recursiveRecordContentHash: hash(`recursive-record-${ordinal}`), recursiveOuterContentHash: hash(`recursive-outer-${ordinal}`),
    candidateSourceContentHash: sourceContentHash
  };
  const structuralSourceEvidence = { evidenceKey: `${candidateKey}|structural-source-evidence`, retainedStructuralEvidence: {} };
  const rootInvocationEvidence = [{ evidenceKey: `${candidateKey}|root-invocation:1` }, { evidenceKey: `${candidateKey}|root-invocation:2` }];
  const recursiveGraphEvidence = {
    completeRenderedOutputAttribution: false, coverage: {}, entryPoints: [],
    nodes: [{ evidenceKey: `${candidateKey}|node:1` }], edges: [{ evidenceKey: `${candidateKey}|edge:1` }],
    cycles: [], wrappers: [{ evidenceKey: `${candidateKey}|wrapper:1` }],
    dynamicBoundaries: [{ evidenceKey: `${candidateKey}|dynamic:1` }, { evidenceKey: `${candidateKey}|dynamic:2` }]
  };
  const evidenceFingerprint = hash({ candidateKey, sourcePageIdentity, sourceBindings, structuralSourceEvidence, rootInvocationEvidence, recursiveGraphEvidence });
  const structural = structuralSourceEvidence.evidenceKey;
  const roots = rootInvocationEvidence.map(row => row.evidenceKey);
  const dynamics = recursiveGraphEvidence.dynamicBoundaries.map(row => row.evidenceKey);
  const all = [structural, ...roots, recursiveGraphEvidence.nodes[0].evidenceKey, recursiveGraphEvidence.edges[0].evidenceKey, recursiveGraphEvidence.wrappers[0].evidenceKey, ...dynamics];
  const base = {
    contract: queuePolicy.queueContract,
    queueEntryKey: `${candidateKey}|subject-boundary-review`, queueOrdinal: ordinal, candidateKey,
    sourcePageIdentity, sourceBindings, evidenceFingerprint, structuralSourceEvidence, rootInvocationEvidence, recursiveGraphEvidence,
    reviewObligations: [
      { obligationKey: 'source_subject_boundary', question: 'What subject?', required: true, evidenceKeys: all },
      { obligationKey: 'atomic_composite_or_reference_collection', question: 'What boundary?', required: true, evidenceKeys: all },
      { obligationKey: 'member_expansion_scope', question: 'Which member scope?', required: true, evidenceKeys: [structural, ...roots] },
      { obligationKey: 'dynamic_and_rendered_attribution_limit', question: 'What dynamic limit?', required: true, evidenceKeys: dynamics }
    ],
    allowedSubjectDispositions: structuredClone(queuePolicy.allowedSubjectDispositions),
    decisionTemplate: { subjectDisposition: null, compositeOrContainerVerdict: null, memberExpansionRequired: null, additionalEvidenceRequired: null, rejectionReason: null, selectedEvidenceKeys: [], reviewer: null, reviewedAt: null, notes: null },
    humanDecisionRecorded: false, subjectDisposition: null, compositeOrContainerVerdict: null, memberExpansionRequired: null,
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    requirementsVariantsXpTimingAndMechanicsComplete: false, optimizerEligible: false, automaticVerificationApplied: false,
    accountIndependent: true, explicitNonClaims: [], blockers: [], state: queuePolicy.queueState
  };
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function fixture() {
  const queueRecords = [queueRecord(1), queueRecord(2)];
  const queueRaw = `${queueRecords.map(json).join('\n')}\n`;
  const queueContentHash = hash(queueRaw);
  const blankTemplates = queueRecords.map(row => expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(row, queueContentHash, decisionPolicy));
  const blankTemplateRaw = `${blankTemplates.map(json).join('\n')}\n`;
  const queueManifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: policy.inputDomain, createdAt,
    records: queueRecords.length, contentHash: queueContentHash,
    source: {
      policy: { id: queuePolicy.policy, contentHash: hash(queuePolicy) },
      audit: {
        contract: queuePolicy.auditContract, queueExportComplete: true, subjectBoundaryReviewComplete: false,
        completeActivityUniverse: false,
        semanticPreservationCoverage: { humanDecisionRecordedCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0 },
        publishable: true
      }
    }
  };
  const artifactManifest = {
    contract: 'sensum.content-addressed-artifact-manifest.v1',
    artifacts: [{ file: 'decision-template.ndjson', kind: 'blank_source_bound_subject_boundary_decision_templates', contentHash: hash(blankTemplateRaw), bytes: Buffer.byteLength(blankTemplateRaw, 'utf8') }]
  };
  return {
    queueRecords, queueRaw, queueManifest, artifactManifest, blankTemplates, blankTemplateRaw,
    queueSnapshot: { directory: 'synthetic', contentHash: queueContentHash, createdAt, explicit: true },
    policy: structuredClone(policy),
    queuePolicy: structuredClone(queuePolicy),
    decisionPolicy: structuredClone(decisionPolicy),
    routingPolicy: structuredClone(routingPolicy),
    oneHopPolicy: structuredClone(oneHopPolicy),
    recursivePolicy: structuredClone(recursivePolicy)
  };
}

test('guidance policy exactly binds the queue and guarded importer policies', () => {
  const compiled = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidancePolicy(policy, queuePolicy, decisionPolicy, routingPolicy, oneHopPolicy, recursivePolicy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy);
  specific.exceptions = { 'osrs-wiki-pageid:9101': 'single' };
  assert.equal(compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidancePolicy(specific, queuePolicy, decisionPolicy, routingPolicy, oneHopPolicy, recursivePolicy).valid, false);
});

test('materializes one exact, still-blank guidance record per queue entry', () => {
  const input = fixture();
  const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(input);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.guidanceMaterializationComplete, true);
  assert.equal(built.audit.humanReviewComplete, false);
  assert.equal(built.records.length, 2);
  assert.equal(built.audit.guidanceCoverage.exactCandidateRevisionBindingCount, 2);
  assert.equal(built.audit.guidanceCoverage.reviewObligationCount, 8);
  assert.equal(built.audit.guidanceCoverage.dispositionCoherencePathCount, 10);
  assert.equal(built.audit.guidanceCoverage.selectedDispositionPathCount, 0);
  for (const record of built.records) {
    for (const field of guidanceContract.required) assert.ok(Object.hasOwn(record, field), `Missing guidance field ${field}`);
    assert.equal(record.humanDecisionSelected, false);
    assert.equal(record.optimizerEligible, false);
  }
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('proves a deterministic exact minimum evidence set cover without selecting it', () => {
  const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(fixture());
  for (const record of built.records) {
    assert.equal(record.minimumEvidenceSelection.exactMinimumKeyCount, 2);
    assert.equal(record.minimumEvidenceSelection.selected, false);
    assert.deepEqual(new Set(record.minimumEvidenceSelection.coveredReviewObligationKeys), new Set([
      'source_subject_boundary', 'atomic_composite_or_reference_collection', 'member_expansion_scope', 'dynamic_and_rendered_attribution_limit'
    ]));
    assert.equal(record.minimumEvidenceSelection.coverageByKey.some(row => row.coveredReviewObligationKeys.includes('member_expansion_scope')), true);
    assert.equal(record.minimumEvidenceSelection.coverageByKey.some(row => row.coveredReviewObligationKeys.includes('dynamic_and_rendered_attribution_limit')), true);
  }
});

test('reproduces the blank template bytes exactly and all artifacts deterministically', () => {
  const input = fixture();
  const first = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(input);
  const second = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(structuredClone(input));
  assert.deepEqual(second, first);
  assert.equal(first.artifacts.decisionTemplateNdjson, input.blankTemplateRaw);
  assert.equal(first.audit.artifactCoverage.blankTemplateByteHashMatches, true);
  assert.equal(first.audit.artifactCoverage.artifactCount, 4);
});

test('queue, policy, manifest, template, and account-state drift fail closed', () => {
  const reject = mutator => {
    const input = fixture();
    mutator(input);
    const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(input);
    assert.equal(built.audit.publishable, false);
    assert.equal(built.records.length, 0);
    return built;
  };
  let failed = reject(input => { input.queueManifest.contentHash = '0'.repeat(64); });
  assert.equal(failed.audit.inputCoverage.checks.manifestContractDomainCountAndRawHashMatch, false);
  failed = reject(input => { input.blankTemplates[0].sourceRevision = '999'; input.blankTemplateRaw = `${input.blankTemplates.map(json).join('\n')}\n`; });
  assert.equal(failed.audit.inputCoverage.checks.blankTemplatesExactlyRevalidate, false);
  failed = reject(input => { input.queueRecords[0].sourceBindings.routingRecordContentHash = '0'.repeat(64); });
  assert.equal(failed.audit.inputCoverage.checks.importerPolicyAndQueueRecordsRevalidate, false);
  failed = reject(input => { input.policy.overrides = { anything: true }; });
  assert.equal(failed.audit.policyCoverage.valid, false);
  failed = reject(input => { input.blankTemplates[0].currentLevel = 34; input.blankTemplateRaw = `${input.blankTemplates.map(json).join('\n')}\n`; });
  assert.ok(failed.audit.blockers.includes('queue_or_blank_template_input_revalidation_failed'));
});

test('independent audit rejects a selected path, semantic promotion, or artifact drift', () => {
  const input = fixture();
  const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(input);
  const changed = structuredClone(built.records);
  changed[0].dispositionCoherenceMatrix[0].selected = true;
  changed[0].recordContentHash = hash(Object.fromEntries(Object.entries(changed[0]).filter(([key]) => key !== 'recordContentHash' && key !== 'contentHash')));
  let audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(changed, {
    input, compiled: built.audit.policyCoverage, inputCoverage: { ...built.audit.inputCoverage, complete: true, importerDryRunAudit: { bindingCoverage: { exactImmutableBindingCount: 2 } } },
    expectedRecords: built.records, artifacts: built.artifacts
  });
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('guidance_record_coverage_or_integrity_failed'));

  const promoted = structuredClone(built.records);
  promoted[0].optimizerEligible = true;
  audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(promoted, {
    input, compiled: built.audit.policyCoverage, inputCoverage: { ...built.audit.inputCoverage, complete: true, importerDryRunAudit: { bindingCoverage: { exactImmutableBindingCount: 2 } } },
    expectedRecords: built.records, artifacts: built.artifacts
  });
  assert.ok(audit.blockers.includes('guidance_selected_or_applied_an_unsupported_decision_or_semantic_state'));

  const artifacts = structuredClone(built.artifacts);
  artifacts.decisionTemplateNdjson += '\n';
  audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryHumanReviewGuidance(built.records, {
    input, compiled: built.audit.policyCoverage, inputCoverage: { ...built.audit.inputCoverage, complete: true, importerDryRunAudit: { bindingCoverage: { exactImmutableBindingCount: 2 } } },
    expectedRecords: built.records, artifacts
  });
  assert.ok(audit.blockers.includes('guidance_artifact_coverage_or_byte_equivalence_failed'));
});

test('CLI refuses implicit inputs without writing output', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-subject-boundary-guidance-'));
  const cli = spawnSync(process.execPath, ['platform/transforms/materialize-activity-candidate-missing-supported-infobox-subject-boundary-human-review-guidance.mjs', `--root=${temporaryRoot}`], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

console.log('Activity candidate missing supported-infobox subject-boundary human-review guidance checks passed.');
