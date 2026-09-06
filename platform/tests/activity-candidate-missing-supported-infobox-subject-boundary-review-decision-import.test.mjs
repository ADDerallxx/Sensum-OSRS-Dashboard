import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport,
  buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport,
  compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy,
  expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision
} from '../transforms/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-v1.json');
const queuePolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-v1.json');
const routingPolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json');
const oneHopPolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json');
const recursivePolicy = readJson('platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json');
const recordContract = readJson('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-v1.json');
const auditContract = readJson('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-import-audit-v1.json');
const queueSnapshotContentHash = '8'.repeat(64);
const queueSnapshotCreatedAt = '2026-09-06T08:00:00.000Z';

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
    contract: policy.queueContract,
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
    allowedSubjectDispositions: structuredClone(policy.allowedSubjectDispositions),
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
    state: policy.queueState
  };
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function decision(queue, disposition = 'confirm_single_activity_subject', snapshotContentHash = queueSnapshotContentHash) {
  const template = expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(queue, snapshotContentHash, policy);
  const combinations = {
    confirm_single_activity_subject: [false, false, false, null],
    confirm_composite_or_container_subject: [true, true, false, null],
    confirm_reference_collection_subject: [true, true, false, null],
    reject_as_activity_subject: [false, false, false, 'The revision-pinned source describes no activity subject.'],
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
    notes: 'Reviewed the exact revision, structural evidence, dependency graph, and unresolved dynamic boundary.'
  };
}

function build(queueRecords, submissions, blankTemplates = queueRecords.map(row => expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(row, queueSnapshotContentHash, policy))) {
  return buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport({
    queueRecords, blankTemplates, submissions, policy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy,
    queueSnapshotContentHash, queueSnapshotCreatedAt
  });
}

test('policy is generic, source-bound, and fail closed', () => {
  const compiled = compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy(policy, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy);
  specific.overrides = { 'osrs-wiki-pageid:9001': 'accept' };
  assert.equal(compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImportPolicy(specific, queuePolicy, routingPolicy, oneHopPolicy, recursivePolicy).valid, false);
});

test('records a complete exact-bound batch without applying semantics', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const built = build(queues, queues.map(row => decision(row)));
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.reviewDecisionRecordingComplete, true);
  assert.equal(built.audit.subjectBoundaryReviewComplete, false);
  assert.equal(built.records.length, 2);
  assert.equal(built.audit.bindingCoverage.exactEvidenceObligationCoverageCount, 2);
  for (const record of built.records) {
    for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing decision field ${field}`);
    assert.equal(record.semanticApplicationApplied, false);
    assert.equal(record.optimizerEligible, false);
    assert.equal(record.completeActivityUniverse, false);
  }
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('all allowed dispositions have explicit coherent field combinations', () => {
  for (const disposition of policy.allowedSubjectDispositions) {
    const queue = queueRecord(1);
    const built = build([queue], [decision(queue, disposition)]);
    assert.equal(built.audit.publishable, true, disposition);
  }
  const queue = queueRecord(1);
  const incoherent = decision(queue, 'confirm_composite_or_container_subject');
  incoherent.memberExpansionRequired = false;
  const failed = build([queue], [incoherent]);
  assert.equal(failed.audit.publishable, false);
  assert.equal(failed.records.length, 0);
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.dispositionFieldsCoherent, false);
});

test('blank, partial, duplicate, unknown, stale, unbound, and automated rows reject the entire batch', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const templates = queues.map(row => expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(row, queueSnapshotContentHash, policy));
  let failed = build(queues, templates, templates);
  assert.equal(failed.audit.publishable, false);
  assert.equal(failed.records.length, 0);
  assert.equal(failed.audit.submissionCoverage.completedDecisionCount, 0);

  const reject = mutator => {
    const submissions = queues.map(row => decision(row));
    mutator(submissions);
    const result = build(queues, submissions, templates);
    assert.equal(result.audit.publishable, false);
    assert.equal(result.records.length, 0);
    return result;
  };
  failed = reject(rows => { rows[0].reviewer = null; });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewerPresent, false);
  failed = reject(rows => { rows[0].reviewer = 'Codex'; });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewerNotObviouslyAutomatic, false);
  failed = reject(rows => { rows[0].reviewedAt = '2026-09-06T06:00:00.000Z'; });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewedAtNotBeforeQueueOrEvidence, false);
  failed = reject(rows => { rows[0].selectedEvidenceKeys = ['invented-evidence']; });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.evidenceKeysPresentUniqueAndBound, false);
  failed = reject(rows => { rows[0].sourceRevision = '999'; });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].bindingChecks.immutableBindingsMatch, false);
  failed = reject(rows => { rows[1] = structuredClone(rows[0]); });
  assert.ok(failed.audit.blockers.includes('decision_submission_does_not_cover_exact_queue'));
  failed = build(queues, [decision(queues[0])], templates);
  assert.ok(failed.audit.blockers.includes('decision_submission_does_not_cover_exact_queue'));
});

test('queue, blank-template, account-state, and semantic-promotion drift fail closed', () => {
  const queue = queueRecord(1);
  const template = expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(queue, queueSnapshotContentHash, policy);
  let altered = structuredClone(queue);
  altered.sourceBindings.routingRecordContentHash = '0'.repeat(64);
  let failed = build([altered], [decision(queue)], [template]);
  assert.equal(failed.audit.publishable, false);
  assert.ok(failed.audit.blockers.includes('one_or_more_queue_records_failed_integrity_revalidation'));

  const alteredTemplate = structuredClone(template);
  alteredTemplate.sourceRevision = '999';
  failed = build([queue], [decision(queue)], [alteredTemplate]);
  assert.ok(failed.audit.blockers.includes('blank_template_snapshot_does_not_exactly_match_queue'));

  const accountDecision = decision(queue);
  accountDecision.currentLevel = 34;
  failed = build([queue], [accountDecision], [template]);
  assert.ok(failed.audit.blockers.includes('current_account_state_present'));

  const valid = build([queue], [decision(queue)], [template]);
  const promoted = structuredClone(valid.records);
  promoted[0].optimizerEligible = true;
  const audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport(promoted, {
    queueRecords: [queue], blankTemplates: [template], submissions: [decision(queue)], policy,
    compiled: valid.audit.policyCoverage, queueAssessments: [{ complete: true }], submissionAssessments: [{ complete: true, bindingChecks: {}, contentChecks: {} }],
    queueSnapshotContentHash, queueSnapshotCreatedAt
  });
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('decision_import_created_unsupported_semantic_or_optimizer_promotion'));

  const rewritten = structuredClone(valid.records);
  rewritten[0].reviewer = 'Different Human';
  rewritten[0].recordContentHash = hash(Object.fromEntries(Object.entries(rewritten[0]).filter(([key]) => key !== 'recordContentHash' && key !== 'contentHash')));
  const rewrittenAudit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewDecisionImport(rewritten, {
    queueRecords: [queue], blankTemplates: [template], submissions: [decision(queue)], policy,
    compiled: valid.audit.policyCoverage, queueAssessments: [{ complete: true }], submissionAssessments: [{ complete: true, bindingChecks: {}, contentChecks: {} }],
    queueSnapshotContentHash, queueSnapshotCreatedAt
  });
  assert.equal(rewrittenAudit.publishable, false);
  assert.ok(rewrittenAudit.blockers.includes('decision_records_do_not_exactly_reproduce_validated_submissions'));
});

test('output is deterministic and CLI refuses implicit inputs without writing output', () => {
  const queues = [queueRecord(1), queueRecord(2)];
  const submissions = queues.map(row => decision(row));
  const first = build(queues, submissions);
  const second = build(structuredClone(queues), structuredClone(submissions));
  assert.deepEqual(second, first);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-subject-boundary-import-'));
  const cli = spawnSync(process.execPath, ['platform/transforms/import-activity-candidate-missing-supported-infobox-subject-boundary-review-decisions.mjs', `--root=${temporaryRoot}`], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('CLI materializes identical outputs twice for a complete synthetic review batch', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-subject-boundary-cli-fixture-'));
  const queueDirectory = path.join(fixtureRoot, 'queue');
  fs.mkdirSync(queueDirectory, { recursive: true });
  const queues = [queueRecord(1), queueRecord(2)];
  const queueRaw = `${queues.map(row => json(row)).join('\n')}\n`;
  const queueContentHash = hash(queueRaw);
  const templates = queues.map(row => expectedActivityCandidateMissingSupportedInfoboxSubjectBoundaryBlankDecision(row, queueContentHash, policy));
  const templateRaw = `${templates.map(row => json(row)).join('\n')}\n`;
  const decisions = queues.map(row => decision(row, 'confirm_single_activity_subject', queueContentHash));
  const decisionRaw = `${decisions.map(row => json(row)).join('\n')}\n`;
  fs.writeFileSync(path.join(queueDirectory, `${queuePolicy.outputDomain}.ndjson`), queueRaw);
  fs.writeFileSync(path.join(queueDirectory, 'decision-template.ndjson'), templateRaw);
  fs.writeFileSync(path.join(queueDirectory, 'completed-decisions.ndjson'), decisionRaw);
  fs.writeFileSync(path.join(queueDirectory, 'artifact-manifest.json'), `${JSON.stringify({
    contract: 'sensum.content-addressed-artifact-manifest.v1',
    artifacts: [{ file: 'decision-template.ndjson', kind: 'blank_source_bound_subject_boundary_decision_templates', contentHash: hash(templateRaw), bytes: Buffer.byteLength(templateRaw, 'utf8') }]
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(queueDirectory, 'manifest.json'), `${JSON.stringify({
    contract: 'sensum.ingestion-manifest.v1', domain: queuePolicy.outputDomain, createdAt: queueSnapshotCreatedAt,
    records: queues.length, contentHash: queueContentHash,
    source: {
      policy: { id: queuePolicy.policy, contentHash: hash(queuePolicy) },
      audit: {
        contract: queuePolicy.auditContract, queueExportComplete: true, subjectBoundaryReviewComplete: false,
        completeActivityUniverse: false,
        semanticPreservationCoverage: { humanDecisionRecordedCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0 },
        publishable: true
      }
    }
  }, null, 2)}\n`);

  const run = suffix => {
    const outputRoot = path.join(fixtureRoot, suffix);
    fs.mkdirSync(outputRoot);
    const cli = spawnSync(process.execPath, [
      'platform/transforms/import-activity-candidate-missing-supported-infobox-subject-boundary-review-decisions.mjs',
      `--queue=${queueDirectory}`, `--templates=${path.join(queueDirectory, 'decision-template.ndjson')}`,
      `--decisions=${path.join(queueDirectory, 'completed-decisions.ndjson')}`, `--root=${outputRoot}`
    ], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    const snapshotDirectory = fs.readdirSync(outputRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.endsWith('-audits'))
      .map(entry => path.join(outputRoot, entry.name))
      .find(directory => readJson(path.join(directory, 'manifest.json')).domain === 'activity-candidate-missing-supported-infobox-subject-boundary-review-decisions');
    const raw = fs.readFileSync(path.join(snapshotDirectory, 'activity-candidate-missing-supported-infobox-subject-boundary-review-decisions.ndjson'), 'utf8');
    return { raw, contentHash: hash(raw), records: raw.trim().split(/\r?\n/).length };
  };
  const first = run('first');
  const second = run('second');
  assert.equal(first.records, 2);
  assert.deepEqual(second, first);
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

console.log('Activity candidate missing supported-infobox subject-boundary review decision import checks passed.');
