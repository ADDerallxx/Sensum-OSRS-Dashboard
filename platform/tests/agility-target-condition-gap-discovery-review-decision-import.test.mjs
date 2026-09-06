import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditAgilityTargetConditionGapDiscoveryReviewDecisionImport,
  buildAgilityTargetConditionGapDiscoveryReviewDecisionImport,
  compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy,
  expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision
} from '../transforms/agility-target-condition-gap-discovery-review-decision-import-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/agility-target-condition-gap-discovery-review-decision-import-v1.json');
const packetPolicy = readJson('platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json');
const recordContract = readJson('platform/contracts/agility-target-condition-gap-discovery-review-decision-v1.json');
const auditContract = readJson('platform/contracts/agility-target-condition-gap-discovery-review-decision-import-audit-v1.json');

function packetRecord(ordinal = 1) {
  const sourceText = '* The [[experience]] per hour gained at the basic course has been increased from 8,750 to 10,000.';
  const evidenceKey = `wiki-pageid:${317072 + ordinal}|revision:${15168109 + ordinal}|line:100`;
  const base = {
    contract: policy.inputPacketContract,
    reviewPacketKey: `synthetic-candidate-${ordinal}|synthetic-blocker|synthetic-signal|${evidenceKey}|manual-review-packet`,
    sourceDiscoverySnapshot: { domain: 'agility-target-condition-gap-wiki-discovery', createdAt: '2026-09-06T09:50:52.344Z', contentHash: hash(`discovery-${ordinal}`) },
    sourceDiscoveryRecordContentHash: hash(`discovery-record-${ordinal}`),
    candidateKey: `synthetic-candidate-${ordinal}`,
    candidateName: `Synthetic course ${ordinal}`,
    targetBaseAgility: 34,
    namedBlocker: `synthetic-blocker-${ordinal}`,
    relatedOpenBlockers: ['another_blocker_remains_open'],
    queryBindings: [{ queryKey: `query-${ordinal}`, blocker: `synthetic-blocker-${ordinal}`, diagnosticKind: 'rate_alignment', searchText: 'synthetic query', resultSetHash: hash([317072 + ordinal]), resultContainsSourcePage: true }],
    sourceEvidence: {
      evidenceKey,
      signalKind: 'rate_alignment',
      sourcePageId: 317072 + ordinal,
      sourceTitle: `Synthetic course ${ordinal}`,
      sourceRevision: String(15168109 + ordinal),
      sourceTimestamp: '2026-04-07T04:48:43Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Synthetic_${ordinal}`,
      exactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${15168109 + ordinal}`,
      sourceContentHash: hash(sourceText),
      sourceContentBytes: Buffer.byteLength(sourceText, 'utf8'),
      sourceLine: 100,
      exactSourceLine: sourceText,
      normalizedExcerpt: sourceText,
      matchedDomainQueryKeys: [`query-${ordinal}`],
      integrityChecks: { exactRevisionReturned: true },
      exactRevisionLineRevalidated: true
    },
    reviewQuestion: 'Does this exact revision and source line resolve only the named blocker?',
    reviewScope: { decisionAppliesOnlyToNamedBlocker: `synthetic-blocker-${ordinal}`, confirmationRequiresSeparateGuardedDecisionImportAndApplication: true, confirmationDoesNotProve: ['verified_best_is_not_authorized'], otherOpenBlockersRemain: ['another_blocker_remains_open'] },
    allowedDecisions: structuredClone(policy.allowedDecisions),
    decision: null,
    selectedEvidenceKeys: [],
    reviewer: null,
    reviewedAt: null,
    reviewNotes: null,
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false,
    packetMaterializationComplete: true,
    state: 'pending_explicit_human_semantic_review_no_decision'
  };
  const withPacketHash = { ...base, packetContentHash: hash(base) };
  return { ...withPacketHash, contentHash: hash(withPacketHash) };
}

function fixture(count = 2) {
  const packetRecords = Array.from({ length: count }, (_, index) => packetRecord(index + 1));
  const packetRaw = `${packetRecords.map(row => json(row)).join('\n')}\n`;
  const packetManifest = {
    contract: policy.inputManifestContract,
    domain: policy.inputPacketDomain,
    createdAt: '2026-09-06T10:05:45.036Z',
    records: packetRecords.length,
    contentHash: hash(packetRaw),
    source: {
      policy: { id: packetPolicy.policy, contentHash: hash(packetPolicy) },
      audit: {
        contract: policy.inputPacketAuditContract,
        semanticPreservationCoverage: { decisionCount: 0, selectedEvidenceCount: 0, blockersClosed: 0, semanticFactsCreated: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, completeWikiUniverseClaimCount: 0 },
        reviewPacketMaterializationComplete: true,
        humanReviewComplete: false,
        completeWikiUniverse: false,
        publishable: true
      }
    }
  };
  const blankTemplates = packetRecords.map(row => expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision(row, policy));
  const blankTemplateRaw = `${blankTemplates.map(row => json(row)).join('\n')}\n`;
  const reviewMarkdownRaw = '# Synthetic exact-revision review packet\n';
  const artifactBase = {
    contract: policy.artifactManifestContract,
    packetCount: packetRecords.length,
    reviewMarkdown: { file: 'review-packet.md', contentHash: hash(reviewMarkdownRaw), bytes: Buffer.byteLength(reviewMarkdownRaw, 'utf8') },
    decisionTemplate: { file: 'decision-template.ndjson', recordCount: blankTemplates.length, contentHash: hash(blankTemplateRaw), bytes: Buffer.byteLength(blankTemplateRaw, 'utf8') },
    packetContentHashes: packetRecords.map(row => row.packetContentHash),
    decisionsRecorded: 0
  };
  const artifactManifest = { ...artifactBase, contentHash: hash(artifactBase) };
  const artifactManifestRaw = `${JSON.stringify(artifactManifest, null, 2)}\n`;
  return { packetRecords, packetRaw, packetManifest, blankTemplates, blankTemplateRaw, reviewMarkdownRaw, artifactManifest, artifactManifestRaw, policy, packetPolicy };
}

function decision(template, value = policy.allowedDecisions[0], reviewer = 'Human Reviewer') {
  const base = {
    ...template,
    decision: value,
    selectedEvidenceKeys: structuredClone(template.availableEvidenceKeys),
    reviewer,
    reviewedAt: '2026-09-06T11:00:00.000Z',
    reviewNotes: 'Reviewed the exact revision, exact source line, named blocker scope, and explicit non-claims.'
  };
  return { ...base, contentHash: hash(Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'contentHash'))) };
}

function build(input, submissions = input.blankTemplates.map(row => decision(row))) {
  return buildAgilityTargetConditionGapDiscoveryReviewDecisionImport({ ...input, submissions, contentHash: hash });
}

test('policy is generic, packet-bound, and forbids automatic verification', () => {
  const compiled = compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy(policy, packetPolicy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidBindings, []);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const named = structuredClone(policy);
  named.overrides = { 'synthetic-candidate-1': 'confirm' };
  assert.equal(compileAgilityTargetConditionGapDiscoveryReviewDecisionImportPolicy(named, packetPolicy).valid, false);
});

test('records every allowed human decision without applying it', () => {
  for (const allowed of policy.allowedDecisions) {
    const input = fixture(1);
    const built = build(input, [decision(input.blankTemplates[0], allowed)]);
    assert.equal(built.audit.publishable, true, allowed);
    assert.equal(built.audit.reviewDecisionRecordingComplete, true);
    assert.equal(built.audit.humanReviewComplete, true);
    assert.equal(built.audit.semanticApplicationComplete, false);
    assert.equal(built.records.length, 1);
    const record = built.records[0];
    for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing decision field ${field}`);
    assert.equal(record.decision, allowed);
    assert.equal(record.semanticApplicationApplied, false);
    assert.equal(record.blockersClosed, 0);
    assert.equal(record.semanticFactsCreated, 0);
    assert.equal(record.optimizerEligible, false);
    assert.equal(record.automaticVerificationApplied, false);
    assert.equal(record.completeWikiUniverseClaimed, false);
    for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
  }
});

test('blank, partial, duplicate, unknown, stale, automated, and uncited batches reject atomically', () => {
  const input = fixture(2);
  let failed = build(input, structuredClone(input.blankTemplates));
  assert.equal(failed.audit.publishable, false);
  assert.equal(failed.records.length, 0);
  assert.equal(failed.audit.submissionCoverage.blankDecisionCount, 2);

  const reject = mutator => {
    const submissions = input.blankTemplates.map(row => decision(row));
    mutator(submissions);
    const result = build(input, submissions);
    assert.equal(result.audit.publishable, false);
    assert.equal(result.records.length, 0);
    return result;
  };
  failed = reject(rows => { rows[0].reviewer = null; rows[0].contentHash = hash(Object.fromEntries(Object.entries(rows[0]).filter(([key]) => key !== 'contentHash'))); });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewerPresent, false);
  failed = reject(rows => { rows[0].reviewer = 'Codex'; rows[0].contentHash = hash(Object.fromEntries(Object.entries(rows[0]).filter(([key]) => key !== 'contentHash'))); });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewerNotObviouslyAutomatic, false);
  failed = reject(rows => { rows[0].reviewedAt = '2026-09-06T09:00:00.000Z'; rows[0].contentHash = hash(Object.fromEntries(Object.entries(rows[0]).filter(([key]) => key !== 'contentHash'))); });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.reviewedAtNotBeforePacketOrEvidence, false);
  failed = reject(rows => { rows[0].selectedEvidenceKeys = []; rows[0].contentHash = hash(Object.fromEntries(Object.entries(rows[0]).filter(([key]) => key !== 'contentHash'))); });
  assert.equal(failed.audit.submissionCoverage.invalidSubmissionRows[0].contentChecks.selectedEvidenceExact, false);
  failed = reject(rows => { rows[1] = structuredClone(rows[0]); });
  assert.ok(failed.audit.blockers.includes('decision_submission_does_not_cover_exact_packet_set'));
  failed = build(input, [decision(input.blankTemplates[0])]);
  assert.ok(failed.audit.blockers.includes('decision_submission_does_not_cover_exact_packet_set'));
  const unknown = decision(input.blankTemplates[0]);
  unknown.reviewPacketKey = 'unknown-packet';
  unknown.contentHash = hash(Object.fromEntries(Object.entries(unknown).filter(([key]) => key !== 'contentHash')));
  failed = build(input, [unknown, decision(input.blankTemplates[1])]);
  assert.deepEqual(failed.audit.submissionCoverage.unknownReviewPacketKeys, ['unknown-packet']);
});

test('tampered packets, templates, hashes, account state, and promotion fields fail closed', () => {
  let input = fixture(1);
  input.packetRecords[0].namedBlocker = 'tampered';
  assert.equal(build(input).audit.publishable, false);

  input = fixture(1);
  input.blankTemplates[0].packetContentHash = '0'.repeat(64);
  input.blankTemplateRaw = `${input.blankTemplates.map(row => json(row)).join('\n')}\n`;
  assert.equal(build(input).audit.publishable, false);

  input = fixture(1);
  const invalidHash = decision(input.blankTemplates[0]);
  invalidHash.reviewNotes = 'Changed after hashing with sufficient length.';
  assert.equal(build(input, [invalidHash]).audit.publishable, false);

  input = fixture(1);
  const accountScoped = decision(input.blankTemplates[0]);
  accountScoped.currentBaseLevel = 34;
  accountScoped.contentHash = hash(Object.fromEntries(Object.entries(accountScoped).filter(([key]) => key !== 'contentHash')));
  const accountFailure = build(input, [accountScoped]);
  assert.equal(accountFailure.audit.publishable, false);
  assert.ok(accountFailure.audit.blockers.includes('account_state_or_promotion_fields_present_in_submission'));

  const valid = build(fixture(1));
  const promoted = structuredClone(valid.records);
  promoted[0].optimizerEligible = true;
  promoted[0].recordContentHash = hash(Object.fromEntries(Object.entries(promoted[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))));
  promoted[0].contentHash = hash(Object.fromEntries(Object.entries(promoted[0]).filter(([key]) => key !== 'contentHash')));
  const audited = auditAgilityTargetConditionGapDiscoveryReviewDecisionImport(promoted, {
    ...fixture(1),
    submissions: fixture(1).blankTemplates.map(row => decision(row)),
    input: { complete: true, checks: {}, packetAssessments: [{ complete: true }] },
    submissionAssessments: [{ complete: true, blank: false, invalid: false }],
    contentHash: hash
  });
  assert.equal(audited.publishable, false);
  assert.ok(audited.blockers.includes('decision_import_created_unsupported_semantic_or_optimizer_promotion'));
});

test('output is deterministic and CLI refuses implicit inputs without writing output', () => {
  const first = build(fixture(2));
  const second = build(fixture(2));
  assert.deepEqual(second, first);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-agility-decision-import-no-input-'));
  const cli = spawnSync(process.execPath, ['platform/transforms/import-agility-target-condition-gap-discovery-review-decisions.mjs', `--root=${temporaryRoot}`], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('CLI writes identical synthetic decisions and rejects the untouched blank template with zero output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-agility-decision-import-cli-'));
  const packetDirectory = path.join(root, 'packet');
  fs.mkdirSync(packetDirectory);
  const input = fixture(1);
  fs.writeFileSync(path.join(packetDirectory, `${policy.inputPacketDomain}.ndjson`), input.packetRaw);
  fs.writeFileSync(path.join(packetDirectory, 'manifest.json'), `${JSON.stringify(input.packetManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(packetDirectory, 'artifact-manifest.json'), input.artifactManifestRaw);
  fs.writeFileSync(path.join(packetDirectory, 'review-packet.md'), input.reviewMarkdownRaw);
  fs.writeFileSync(path.join(packetDirectory, 'decision-template.ndjson'), input.blankTemplateRaw);
  const completedRaw = `${input.blankTemplates.map(row => json(decision(row))).join('\n')}\n`;
  fs.writeFileSync(path.join(packetDirectory, 'completed-decisions.ndjson'), completedRaw);

  const run = (outputName, decisionName) => {
    const outputRoot = path.join(root, outputName);
    fs.mkdirSync(outputRoot);
    const cli = spawnSync(process.execPath, [
      'platform/transforms/import-agility-target-condition-gap-discovery-review-decisions.mjs',
      `--packet-snapshot=${packetDirectory}`,
      `--templates=${path.join(packetDirectory, 'decision-template.ndjson')}`,
      `--decisions=${path.join(packetDirectory, decisionName)}`,
      `--root=${outputRoot}`
    ], { encoding: 'utf8' });
    return { cli, outputRoot };
  };
  const first = run('first', 'completed-decisions.ndjson');
  assert.equal(first.cli.status, 0, first.cli.stderr || first.cli.stdout);
  const second = run('second', 'completed-decisions.ndjson');
  assert.equal(second.cli.status, 0, second.cli.stderr || second.cli.stdout);
  const findRaw = outputRoot => {
    const directory = fs.readdirSync(outputRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.endsWith('-audits'))
      .map(entry => path.join(outputRoot, entry.name))[0];
    return fs.readFileSync(path.join(directory, `${policy.outputDomain}.ndjson`), 'utf8');
  };
  assert.equal(findRaw(first.outputRoot), findRaw(second.outputRoot));

  const rejected = run('rejected', 'decision-template.ndjson');
  assert.equal(rejected.cli.status, 2, rejected.cli.stderr || rejected.cli.stdout);
  assert.deepEqual(fs.readdirSync(rejected.outputRoot), []);
  fs.rmSync(root, { recursive: true, force: true });
});

console.log('Agility target-condition discovery review-decision import checks passed.');
