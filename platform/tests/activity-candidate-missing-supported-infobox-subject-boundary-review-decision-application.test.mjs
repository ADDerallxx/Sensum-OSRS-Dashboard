import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications,
  buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications,
  compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplicationPolicy
} from '../transforms/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-lib.mjs';
import {
  buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport,
  expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision
} from '../transforms/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-v1.json');
const decisionPolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-v1.json');
const queuePolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-v1.json');
const routingPolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json');
const oneHopPolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json');
const recursivePolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json');
const recordContract = readJson('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-record-v1.json');
const auditContract = readJson('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-application-audit-v1.json');
const queueCreatedAt = '2026-09-06T08:00:00.000Z';
const decisionCreatedAt = '2026-09-06T09:05:00.000Z';

function queueRecord(ordinal = 1) {
  const candidateKey = `osrs-wiki-pageid:${9000 + ordinal}`;
  const sourceContentHash = hash(`source-${ordinal}`);
  const sourcePageIdentity = {
    resolvedTitle: `Synthetic review subject ${ordinal}`,
    sourceContentBytes: 1000 + ordinal,
    sourceContentHash,
    sourcePageId: 9000 + ordinal,
    sourceRevision: String(15000000 + ordinal),
    sourceTimestamp: '2026-09-06T07:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Synthetic_${ordinal}`
  };
  const sourceBindings = {
    routingSnapshotContentHash: hash(`routing-snapshot-${ordinal}`),
    routingRecordContentHash: hash(`routing-record-${ordinal}`),
    routingOuterContentHash: hash(`routing-outer-${ordinal}`),
    oneHopSnapshotContentHash: hash(`one-hop-snapshot-${ordinal}`),
    oneHopRecordContentHash: hash(`one-hop-record-${ordinal}`),
    oneHopOuterContentHash: hash(`one-hop-outer-${ordinal}`),
    recursiveSnapshotContentHash: hash(`recursive-snapshot-${ordinal}`),
    recursiveRecordContentHash: hash(`recursive-record-${ordinal}`),
    recursiveOuterContentHash: hash(`recursive-outer-${ordinal}`),
    candidateSourceContentHash: sourceContentHash
  };
  const structuralSourceEvidence = { evidenceKey: `${candidateKey}|structural-source-evidence`, retainedStructuralEvidence: {} };
  const rootInvocationEvidence = [{ evidenceKey: `${candidateKey}|root-invocation:1` }];
  const recursiveGraphEvidence = {
    completeRenderedOutputAttribution: false,
    coverage: {}, entryPoints: [],
    nodes: [{ evidenceKey: `${candidateKey}|node:1` }],
    edges: [{ evidenceKey: `${candidateKey}|edge:1` }],
    cycles: [{ evidenceKey: `${candidateKey}|cycle:1` }],
    wrappers: [{ evidenceKey: `${candidateKey}|wrapper:1` }],
    dynamicBoundaries: [{ evidenceKey: `${candidateKey}|dynamic:1` }]
  };
  const evidenceFingerprint = hash({ candidateKey, sourcePageIdentity, sourceBindings, structuralSourceEvidence, rootInvocationEvidence, recursiveGraphEvidence });
  const structural = structuralSourceEvidence.evidenceKey;
  const root = rootInvocationEvidence[0].evidenceKey;
  const dynamic = recursiveGraphEvidence.dynamicBoundaries[0].evidenceKey;
  const base = {
    contract: decisionPolicy.queueContract,
    queueEntryKey: `${candidateKey}|subject-boundary-review`,
    queueOrdinal: ordinal,
    candidateKey,
    sourcePageIdentity,
    sourceBindings,
    evidenceFingerprint,
    structuralSourceEvidence,
    rootInvocationEvidence,
    recursiveGraphEvidence,
    reviewObligations: [
      { obligationKey: 'source_subject_boundary', question: 'Subject?', required: true, evidenceKeys: [structural, root, dynamic] },
      { obligationKey: 'atomic_composite_or_reference_collection', question: 'Atomic?', required: true, evidenceKeys: [structural, root, dynamic] },
      { obligationKey: 'member_expansion_scope', question: 'Members?', required: true, evidenceKeys: [structural, root] },
      { obligationKey: 'dynamic_and_rendered_attribution_limit', question: 'Dynamic?', required: true, evidenceKeys: [dynamic] }
    ],
    allowedSubjectDispositions: structuredClone(decisionPolicy.allowedSubjectDispositions),
    decisionTemplate: {
      subjectDisposition: null, compositeOrContainerVerdict: null, memberExpansionRequired: null,
      additionalEvidenceRequired: null, rejectionReason: null, selectedEvidenceKeys: [], reviewer: null, reviewedAt: null, notes: null
    },
    humanDecisionRecorded: false,
    subjectDisposition: null,
    compositeOrContainerVerdict: null,
    memberExpansionRequired: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    explicitNonClaims: [], blockers: [],
    state: decisionPolicy.queueState
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function completedSubmission(queue, queueHash, disposition = 'confirm_single_activity_subject') {
  const template = expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(queue, queueHash, decisionPolicy);
  const combinations = {
    confirm_single_activity_subject: [false, false, false, null],
    confirm_composite_or_container_subject: [true, true, false, null],
    confirm_reference_collection_subject: [true, true, false, null],
    reject_as_activity_subject: [false, false, false, 'The revision-pinned source does not describe an activity subject.'],
    needs_additional_evidence: [null, null, true, null]
  };
  const [compositeOrContainerVerdict, memberExpansionRequired, additionalEvidenceRequired, rejectionReason] = combinations[disposition];
  return {
    ...template,
    subjectDisposition: disposition,
    compositeOrContainerVerdict,
    memberExpansionRequired,
    additionalEvidenceRequired,
    rejectionReason,
    selectedEvidenceKeys: [queue.structuralSourceEvidence.evidenceKey, queue.recursiveGraphEvidence.dynamicBoundaries[0].evidenceKey],
    reviewer: 'Human Reviewer',
    reviewedAt: '2026-09-06T09:00:00.000Z',
    notes: 'Reviewed the exact source revision, structural evidence, dependency graph, and unresolved dynamic boundary.'
  };
}

function fixture(dispositions = ['confirm_single_activity_subject']) {
  const queueRecords = dispositions.map((_, index) => queueRecord(index + 1));
  const queueRaw = `${queueRecords.map(row => json(row)).join('\n')}\n`;
  const queueHash = hash(queueRaw);
  const blankTemplates = queueRecords.map(row =>
    expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(row, queueHash, decisionPolicy));
  const blankTemplateRaw = `${blankTemplates.map(row => json(row)).join('\n')}\n`;
  const queueManifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: queuePolicy.outputDomain, createdAt: queueCreatedAt,
    records: queueRecords.length, contentHash: queueHash,
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
  const queueArtifactManifest = {
    contract: 'sensum.content-addressed-artifact-manifest.v1',
    artifacts: [{ file: 'decision-template.ndjson', kind: 'blank_source_bound_subject_boundary_decision_templates', contentHash: hash(blankTemplateRaw), bytes: Buffer.byteLength(blankTemplateRaw, 'utf8') }]
  };
  const submissions = queueRecords.map((row, index) => completedSubmission(row, queueHash, dispositions[index]));
  const imported = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport({
    queueRecords, blankTemplates, submissions, policy: decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy,
    queueSnapshotContentHash: queueHash, queueSnapshotCreatedAt: queueCreatedAt
  });
  assert.equal(imported.audit.publishable, true);
  const decisionRecords = imported.records.map(record => ({ ...record, contentHash: hash(record) }));
  const decisionRaw = `${decisionRecords.map(row => json(row)).join('\n')}\n`;
  const decisionManifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: policy.inputDecisionDomain, createdAt: decisionCreatedAt,
    records: decisionRecords.length, contentHash: hash(decisionRaw),
    source: {
      policy: { id: decisionPolicy.policy, contentHash: hash(decisionPolicy) },
      queuePolicy: { id: queuePolicy.policy, contentHash: hash(queuePolicy) },
      inputSnapshot: { directory: 'queue', contentHash: queueHash, createdAt: queueCreatedAt, records: queueRecords.length },
      templateSnapshot: { file: 'decision-template.ndjson', contentHash: hash(blankTemplateRaw), rows: blankTemplates.length },
      submission: { file: 'completed-decisions.ndjson', contentHash: hash(`${submissions.map(row => json(row)).join('\n')}\n`), rows: submissions.length },
      audit: imported.audit
    }
  };
  return {
    queueRecords, queueRaw, queueManifest, queueArtifactManifest, blankTemplates, blankTemplateRaw,
    queueSnapshot: { directory: 'queue', contentHash: queueHash, createdAt: queueCreatedAt, explicit: true },
    decisionRecords, decisionRaw, decisionManifest,
    decisionSnapshot: { directory: 'decisions', contentHash: decisionManifest.contentHash, createdAt: decisionCreatedAt, explicit: true }
  };
}

function build(bundle, overrides = {}) {
  return buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications({
    ...bundle, policy, decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash: hash, ...overrides
  });
}

test('application policy is generic, exact-policy-bound, and cannot automatically verify', () => {
  const compiled = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplicationPolicy(
    policy, decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, hash
  );
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy); specific.titleOverrides = { Example: 'accept' };
  assert.equal(compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplicationPolicy(
    specific, decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, hash
  ).valid, false);
  const automatic = structuredClone(policy); automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplicationPolicy(
    automatic, decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, hash
  ).valid, false);
});

test('applies only the five reviewed subject-boundary fields and keeps every downstream gate closed', () => {
  const bundle = fixture(['confirm_single_activity_subject']);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.applicationBatchComplete, true);
  assert.equal(result.audit.subjectBoundaryReviewComplete, true);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assert.equal(record.appliedSubjectDisposition, 'confirm_single_activity_subject');
  assert.equal(record.appliedCompositeOrContainerVerdict, false);
  assert.equal(record.memberExpansionRequired, false);
  assert.equal(record.additionalEvidenceRequired, false);
  assert.equal(record.rejectionReason, null);
  assert.equal(record.canonicalGameEntityIdentity, null);
  assert.equal(record.canonicalActivityIdentity, null);
  assert.equal(record.repeatabilityClassification, null);
  assert.deepEqual(record.memberIdentities, []);
  assert.equal(record.requirementsVariantsXpTimingAndMechanicsComplete, false);
  assert.equal(record.completeActivityUniverse, false);
  assert.equal(record.optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing application field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('preserves composite expansion, candidate-scoped rejection, and additional-evidence outcomes without promotion', () => {
  const bundle = fixture(['confirm_composite_or_container_subject', 'reject_as_activity_subject', 'needs_additional_evidence']);
  const result = build(bundle);
  assert.equal(result.audit.publishable, true);
  assert.equal(result.audit.subjectBoundaryReviewComplete, false);
  assert.equal(result.records[0].memberExpansionRequired, true);
  assert.equal(result.records[0].memberExpansionApplied, false);
  assert.equal(result.records[1].authoritativeCandidateExclusionApplied, true);
  assert.match(result.records[1].rejectionReason, /does not describe/);
  assert.equal(result.records[2].additionalEvidenceRequired, true);
  assert.equal(result.audit.applicationCoverage.memberExpansionRequiredCount, 1);
  assert.equal(result.audit.applicationCoverage.candidateScopedRejectionCount, 1);
  assert.equal(result.audit.applicationCoverage.additionalEvidenceBlockedCount, 1);
});

test('identical explicit snapshots reproduce identical records and audit', () => {
  const bundle = fixture(['confirm_single_activity_subject', 'confirm_reference_collection_subject']);
  const first = build(bundle);
  const second = build(structuredClone(bundle));
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.audit), hash(second.audit));
});

test('implicit selection, manifest drift, record drift, queue mismatch, partial decisions, and account state fail closed', () => {
  const bundle = fixture(['confirm_single_activity_subject', 'reject_as_activity_subject']);
  assert.equal(build(bundle, { decisionSnapshot: { ...bundle.decisionSnapshot, explicit: false } }).audit.publishable, false);
  const changedManifest = structuredClone(bundle.decisionManifest); changedManifest.source.inputSnapshot.contentHash = hash('other queue');
  assert.equal(build(bundle, { decisionManifest: changedManifest }).audit.publishable, false);
  const changedDecisions = structuredClone(bundle.decisionRecords); changedDecisions[0].notes = 'Changed after import';
  assert.equal(build(bundle, { decisionRecords: changedDecisions }).audit.publishable, false);
  const changedQueue = structuredClone(bundle.queueRecords); changedQueue[0].sourcePageIdentity.resolvedTitle = 'Changed';
  assert.equal(build(bundle, { queueRecords: changedQueue }).audit.publishable, false);
  assert.equal(build(bundle, { decisionRecords: bundle.decisionRecords.slice(0, 1) }).audit.publishable, false);
  const accountDecision = structuredClone(bundle.decisionRecords); accountDecision[0].currentBaseLevel = 34;
  const accountResult = build(bundle, { decisionRecords: accountDecision });
  assert.equal(accountResult.audit.publishable, false);
  assert.ok(accountResult.audit.accountStateFindings.length > 0);
});

test('independent audit rejects changed narrow conclusions or forbidden downstream promotion', () => {
  const bundle = fixture(['confirm_single_activity_subject']);
  const result = build(bundle);
  const changed = structuredClone(result.records);
  changed[0].appliedSubjectDisposition = 'reject_as_activity_subject';
  changed[0].canonicalActivityIdentity = { invented: true };
  changed[0].memberIdentities = ['invented-member'];
  changed[0].optimizerEligible = true;
  changed[0].recordContentHash = hash(Object.fromEntries(Object.entries(changed[0]).filter(([key]) => key !== 'recordContentHash')));
  const audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionApplications(changed, {
    ...bundle, policy, decisionPolicy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash: hash
  });
  assert.equal(audit.publishable, false);
  assert.equal(audit.applicationCoverage.recordMismatches.length, 1);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI refuses implicit or nonexistent decision snapshots and writes no output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-subject-boundary-application-refusal-'));
  try {
    let command = spawnSync(process.execPath, [
      'platform/transforms/apply-activity-candidate-missing-supported-infobox-subject-boundary-review-decisions.mjs', `--root=${root}`
    ], { encoding: 'utf8' });
    assert.equal(command.status, 2);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    command = spawnSync(process.execPath, [
      'platform/transforms/apply-activity-candidate-missing-supported-infobox-subject-boundary-review-decisions.mjs',
      `--root=${root}`, `--queue-snapshot=${path.join(root, 'queue')}`, `--decision-snapshot=${path.join(root, 'missing-decisions')}`
    ], { encoding: 'utf8' });
    assert.equal(command.status, 2);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CLI materializes identical valid synthetic batches and preserves all closed gates', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-subject-boundary-application-cli-'));
  try {
    const bundle = fixture(['confirm_single_activity_subject', 'reject_as_activity_subject']);
    const queueDirectory = path.join(fixtureRoot, 'queue');
    const decisionDirectory = path.join(fixtureRoot, 'decisions');
    fs.mkdirSync(queueDirectory);
    fs.mkdirSync(decisionDirectory);
    fs.writeFileSync(path.join(queueDirectory, `${queuePolicy.outputDomain}.ndjson`), bundle.queueRaw);
    fs.writeFileSync(path.join(queueDirectory, 'manifest.json'), `${JSON.stringify(bundle.queueManifest, null, 2)}\n`);
    fs.writeFileSync(path.join(queueDirectory, 'artifact-manifest.json'), `${JSON.stringify(bundle.queueArtifactManifest, null, 2)}\n`);
    fs.writeFileSync(path.join(queueDirectory, 'decision-template.ndjson'), bundle.blankTemplateRaw);
    fs.writeFileSync(path.join(decisionDirectory, `${policy.inputDecisionDomain}.ndjson`), bundle.decisionRaw);
    fs.writeFileSync(path.join(decisionDirectory, 'manifest.json'), `${JSON.stringify(bundle.decisionManifest, null, 2)}\n`);
    const run = suffix => {
      const outputRoot = path.join(fixtureRoot, suffix);
      fs.mkdirSync(outputRoot);
      const command = spawnSync(process.execPath, [
        'platform/transforms/apply-activity-candidate-missing-supported-infobox-subject-boundary-review-decisions.mjs',
        `--root=${outputRoot}`, `--queue-snapshot=${queueDirectory}`, `--decision-snapshot=${decisionDirectory}`
      ], { encoding: 'utf8' });
      assert.equal(command.status, 0, command.stderr || command.stdout);
      const result = JSON.parse(command.stdout);
      assert.equal(result.accepted, true);
      assert.equal(result.coverage.applicationRecordCount, 2);
      assert.equal(result.coverage.subjectBoundaryReviewComplete, true);
      const raw = fs.readFileSync(path.join(outputRoot, result.outputSnapshot.directory, `${policy.outputDomain}.ndjson`), 'utf8');
      const rows = raw.trim().split(/\r?\n/).map(JSON.parse);
      assert.equal(rows.length, 2);
      assert.equal(rows.every(row => row.optimizerEligible === false && row.canonicalActivityIdentity === null), true);
      return { contentHash: result.outputSnapshot.contentHash, raw };
    };
    const first = run('output-one');
    const second = run('output-two');
    assert.deepEqual(second, first);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

console.log('Activity candidate missing supported-infobox subject-boundary review decision application checks passed.');
