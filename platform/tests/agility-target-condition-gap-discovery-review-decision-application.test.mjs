import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  buildAgilityTargetConditionGapDiscoveryReviewDecisionImport,
  expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision
} from '../transforms/agility-target-condition-gap-discovery-review-decision-import-lib.mjs';
import {
  auditAgilityTargetConditionGapDiscoveryReviewDecisionApplications,
  buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications,
  compileAgilityTargetConditionGapDiscoveryReviewDecisionApplicationPolicy
} from '../transforms/agility-target-condition-gap-discovery-review-decision-application-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/agility-target-condition-gap-discovery-review-decision-application-v1.json');
const decisionPolicy = readJson('platform/policies/agility-target-condition-gap-discovery-review-decision-import-v1.json');
const packetPolicy = readJson('platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json');
const recordContract = readJson('platform/contracts/agility-target-condition-gap-discovery-review-decision-application-v1.json');
const auditContract = readJson('platform/contracts/agility-target-condition-gap-discovery-review-decision-application-audit-v1.json');
const packetCreatedAt = '2026-09-06T10:05:45.036Z';
const decisionCreatedAt = '2026-09-06T11:05:45.036Z';

function packetRecord(ordinal = 1) {
  const exactLine = '* The [[experience]] per hour gained at the basic course has been increased from 8,750 to 10,000.';
  const evidenceKey = `wiki-pageid:${317072 + ordinal}|revision:${15168109 + ordinal}|line:100`;
  const base = {
    contract: decisionPolicy.inputPacketContract,
    reviewPacketKey: `candidate-${ordinal}|blocker-${ordinal}|signal|${evidenceKey}|manual-review-packet`,
    sourceDiscoverySnapshot: { domain: 'agility-target-condition-gap-wiki-discovery', createdAt: '2026-09-06T09:50:52.344Z', contentHash: hash(`discovery-${ordinal}`) },
    sourceDiscoveryRecordContentHash: hash(`record-${ordinal}`),
    candidateKey: `candidate-${ordinal}`,
    candidateName: `Course ${ordinal}`,
    targetBaseAgility: 34,
    namedBlocker: `blocker-${ordinal}`,
    relatedOpenBlockers: [`related-blocker-${ordinal}`],
    queryBindings: [{ queryKey: `query-${ordinal}`, blocker: `blocker-${ordinal}`, diagnosticKind: 'rate_alignment', searchText: 'query', resultSetHash: hash([317072 + ordinal]), resultContainsSourcePage: true }],
    sourceEvidence: {
      evidenceKey,
      signalKind: 'rate_alignment',
      sourcePageId: 317072 + ordinal,
      sourceTitle: `Course ${ordinal}`,
      sourceRevision: String(15168109 + ordinal),
      sourceTimestamp: '2026-04-07T04:48:43Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Course_${ordinal}`,
      exactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${15168109 + ordinal}`,
      sourceContentHash: hash(exactLine),
      sourceContentBytes: Buffer.byteLength(exactLine, 'utf8'),
      sourceLine: 100,
      exactSourceLine: exactLine,
      normalizedExcerpt: exactLine,
      matchedDomainQueryKeys: [`query-${ordinal}`],
      integrityChecks: { exactRevisionReturned: true },
      exactRevisionLineRevalidated: true
    },
    reviewQuestion: 'Does the exact line resolve only this blocker?',
    reviewScope: { decisionAppliesOnlyToNamedBlocker: `blocker-${ordinal}`, confirmationRequiresSeparateGuardedDecisionImportAndApplication: true, confirmationDoesNotProve: ['verified_best_is_not_authorized'], otherOpenBlockersRemain: [`related-blocker-${ordinal}`] },
    allowedDecisions: structuredClone(decisionPolicy.allowedDecisions),
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

function completedSubmission(template, decision) {
  const base = {
    ...template,
    decision,
    selectedEvidenceKeys: structuredClone(template.availableEvidenceKeys),
    reviewer: 'Human Reviewer',
    reviewedAt: '2026-09-06T11:00:00.000Z',
    reviewNotes: 'Reviewed the exact revision, exact source line, named blocker, and every explicit non-claim.'
  };
  return { ...base, contentHash: hash(Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'contentHash'))) };
}

function fixture(decisions = ['confirm_source_resolves_named_blocker_only']) {
  const packetRecords = decisions.map((_, index) => packetRecord(index + 1));
  const packetRaw = `${packetRecords.map(row => json(row)).join('\n')}\n`;
  const packetManifest = {
    contract: decisionPolicy.inputManifestContract,
    domain: decisionPolicy.inputPacketDomain,
    createdAt: packetCreatedAt,
    records: packetRecords.length,
    contentHash: hash(packetRaw),
    source: {
      policy: { id: packetPolicy.policy, contentHash: hash(packetPolicy) },
      audit: {
        contract: decisionPolicy.inputPacketAuditContract,
        semanticPreservationCoverage: { decisionCount: 0, selectedEvidenceCount: 0, blockersClosed: 0, semanticFactsCreated: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, completeWikiUniverseClaimCount: 0 },
        reviewPacketMaterializationComplete: true,
        humanReviewComplete: false,
        completeWikiUniverse: false,
        publishable: true
      }
    }
  };
  const blankTemplates = packetRecords.map(row => expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision(row, decisionPolicy));
  const blankTemplateRaw = `${blankTemplates.map(row => json(row)).join('\n')}\n`;
  const reviewMarkdownRaw = '# Synthetic review packet\n';
  const artifactBase = {
    contract: decisionPolicy.artifactManifestContract,
    packetCount: packetRecords.length,
    reviewMarkdown: { file: 'review-packet.md', contentHash: hash(reviewMarkdownRaw), bytes: Buffer.byteLength(reviewMarkdownRaw, 'utf8') },
    decisionTemplate: { file: 'decision-template.ndjson', recordCount: blankTemplates.length, contentHash: hash(blankTemplateRaw), bytes: Buffer.byteLength(blankTemplateRaw, 'utf8') },
    packetContentHashes: packetRecords.map(row => row.packetContentHash),
    decisionsRecorded: 0
  };
  const artifactManifest = { ...artifactBase, contentHash: hash(artifactBase) };
  const artifactManifestRaw = `${JSON.stringify(artifactManifest, null, 2)}\n`;
  const submissions = blankTemplates.map((template, index) => completedSubmission(template, decisions[index]));
  const imported = buildAgilityTargetConditionGapDiscoveryReviewDecisionImport({
    packetRecords, packetRaw, packetManifest, artifactManifest, artifactManifestRaw, reviewMarkdownRaw,
    blankTemplates, blankTemplateRaw, submissions, policy: decisionPolicy, packetPolicy, contentHash: hash
  });
  assert.equal(imported.audit.publishable, true);
  const decisionRecords = imported.records;
  const decisionRaw = `${decisionRecords.map(row => json(row)).join('\n')}\n`;
  const decisionManifest = {
    contract: policy.inputManifestContract,
    domain: policy.inputDecisionDomain,
    createdAt: decisionCreatedAt,
    records: decisionRecords.length,
    contentHash: hash(decisionRaw),
    source: {
      policy: { id: decisionPolicy.policy, contentHash: hash(decisionPolicy) },
      packetPolicy: { id: packetPolicy.policy, contentHash: hash(packetPolicy) },
      inputSnapshot: { directory: 'packet', domain: packetManifest.domain, createdAt: packetCreatedAt, records: packetRecords.length, contentHash: packetManifest.contentHash },
      templateSnapshot: { file: 'decision-template.ndjson', rows: blankTemplates.length, contentHash: hash(blankTemplateRaw) },
      submission: { file: 'completed-decisions.ndjson', rows: submissions.length, contentHash: hash(`${submissions.map(row => json(row)).join('\n')}\n`) },
      audit: imported.audit
    }
  };
  return {
    packetRecords, packetRaw, packetManifest, artifactManifest, artifactManifestRaw, reviewMarkdownRaw,
    blankTemplates, blankTemplateRaw,
    packetSnapshot: { directory: 'packet', contentHash: packetManifest.contentHash, createdAt: packetCreatedAt, records: packetRecords.length, explicit: true },
    decisionRecords, decisionRaw, decisionManifest,
    decisionSnapshot: { directory: 'decisions', contentHash: decisionManifest.contentHash, createdAt: decisionCreatedAt, records: decisionRecords.length, explicit: true },
    policy, decisionPolicy, packetPolicy, contentHash: hash
  };
}

test('application policy is generic, exact-policy-bound, and fail closed', () => {
  const compiled = compileAgilityTargetConditionGapDiscoveryReviewDecisionApplicationPolicy(policy, decisionPolicy, packetPolicy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidBindings, []);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy);
  specific.candidateOverrides = { example: 'close' };
  assert.equal(compileAgilityTargetConditionGapDiscoveryReviewDecisionApplicationPolicy(specific, decisionPolicy, packetPolicy).valid, false);
});

test('confirmation closes exactly one named blocker without creating rates, mechanics, or eligibility', () => {
  const result = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications(fixture());
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assert.equal(record.appliedDecision, 'confirm_source_resolves_named_blocker_only');
  assert.equal(record.namedBlockerResolutionApplied, true);
  assert.equal(record.namedBlockerClosed, true);
  assert.equal(record.blockersClosed, 1);
  assert.equal(record.gamePerformanceFactsCreated, 0);
  assert.equal(record.expectedRateCreated, false);
  assert.equal(record.failureMechanicsCreated, false);
  assert.equal(record.optimizerEligible, false);
  assert.equal(record.completeWikiUniverseClaimed, false);
  assert.ok(record.remainingBlockers.includes('related-blocker-1'));
  for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing application field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(result.audit, field), `Missing audit field ${field}`);
});

test('rejection and additional-evidence decisions keep their named blockers open', () => {
  const result = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications(fixture([
    'reject_source_as_insufficient_or_condition_mismatched',
    'needs_additional_revision_pinned_evidence'
  ]));
  assert.equal(result.audit.publishable, true);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].namedBlockerClosed, false);
  assert.equal(result.records[0].blockersClosed, 0);
  assert.ok(result.records[0].remainingBlockers.includes('blocker-1'));
  assert.equal(result.records[1].additionalEvidenceRequired, true);
  assert.equal(result.records[1].namedBlockerClosed, false);
  assert.ok(result.records[1].remainingBlockers.includes('blocker-2'));
  assert.equal(result.audit.applicationCoverage.sourceSignalRejectionCount, 1);
  assert.equal(result.audit.applicationCoverage.additionalEvidenceBlockedCount, 1);
});

test('identical explicit snapshots reproduce identical applications', () => {
  const bundle = fixture([
    'confirm_source_resolves_named_blocker_only',
    'reject_source_as_insufficient_or_condition_mismatched',
    'needs_additional_revision_pinned_evidence'
  ]);
  const first = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications(bundle);
  const clone = structuredClone(Object.fromEntries(Object.entries(bundle).filter(([key]) => key !== 'contentHash')));
  const second = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications({ ...clone, contentHash: hash });
  assert.deepEqual(second, first);
});

test('implicit, stale, partial, tampered, mismatched, and account-scoped inputs reject atomically', () => {
  const bundle = fixture(['confirm_source_resolves_named_blocker_only', 'reject_source_as_insufficient_or_condition_mismatched']);
  let failed = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications({ ...bundle, packetSnapshot: { ...bundle.packetSnapshot, explicit: false } });
  assert.equal(failed.audit.publishable, false);
  assert.equal(failed.records.length, 0);
  failed = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications({ ...bundle, decisionSnapshot: { ...bundle.decisionSnapshot, explicit: false } });
  assert.equal(failed.audit.publishable, false);
  const oldManifest = structuredClone(bundle.decisionManifest);
  oldManifest.createdAt = '2026-09-06T09:00:00.000Z';
  failed = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications({ ...bundle, decisionManifest: oldManifest, decisionSnapshot: { ...bundle.decisionSnapshot, createdAt: oldManifest.createdAt } });
  assert.equal(failed.audit.publishable, false);
  failed = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications({ ...bundle, decisionRecords: bundle.decisionRecords.slice(0, 1) });
  assert.equal(failed.audit.publishable, false);
  const tampered = structuredClone(bundle.decisionRecords);
  tampered[0].reviewNotes = 'Changed after the guarded import.';
  failed = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications({ ...bundle, decisionRecords: tampered });
  assert.equal(failed.audit.publishable, false);
  const accountScoped = structuredClone(bundle.decisionRecords);
  accountScoped[0].currentBaseLevel = 34;
  failed = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications({ ...bundle, decisionRecords: accountScoped });
  assert.equal(failed.audit.publishable, false);
  assert.ok(failed.audit.accountStateFindings.length > 0);
});

test('independent audit rejects changed conclusions and downstream promotion', () => {
  const bundle = fixture();
  const valid = buildAgilityTargetConditionGapDiscoveryReviewDecisionApplications(bundle);
  const changed = structuredClone(valid.records);
  changed[0].namedBlockerClosed = false;
  changed[0].blockersClosed = 0;
  changed[0].expectedRateCreated = true;
  changed[0].optimizerEligible = true;
  changed[0].recordContentHash = hash(Object.fromEntries(Object.entries(changed[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))));
  changed[0].contentHash = hash(Object.fromEntries(Object.entries(changed[0]).filter(([key]) => key !== 'contentHash')));
  const audit = auditAgilityTargetConditionGapDiscoveryReviewDecisionApplications(changed, bundle);
  assert.equal(audit.publishable, false);
  assert.ok(audit.bindingCoverage.applicationRecordsExactlyMatchValidatedDecisions === false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
});

test('CLI refuses implicit and absent decision snapshots with zero output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-agility-application-refusal-'));
  try {
    let command = spawnSync(process.execPath, ['platform/transforms/apply-agility-target-condition-gap-discovery-review-decisions.mjs', `--root=${root}`], { encoding: 'utf8' });
    assert.equal(command.status, 2);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    command = spawnSync(process.execPath, [
      'platform/transforms/apply-agility-target-condition-gap-discovery-review-decisions.mjs',
      `--packet-snapshot=${path.join(root, 'packet')}`,
      `--decision-snapshot=${path.join(root, 'missing-decisions')}`,
      `--root=${root}`
    ], { encoding: 'utf8' });
    assert.equal(command.status, 2);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CLI materializes identical synthetic applications and keeps broader gates closed', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-agility-application-cli-'));
  try {
    const bundle = fixture(['confirm_source_resolves_named_blocker_only', 'needs_additional_revision_pinned_evidence']);
    const packetDirectory = path.join(fixtureRoot, 'packet');
    const decisionDirectory = path.join(fixtureRoot, 'decisions');
    fs.mkdirSync(packetDirectory);
    fs.mkdirSync(decisionDirectory);
    fs.writeFileSync(path.join(packetDirectory, `${policy.inputPacketDomain}.ndjson`), bundle.packetRaw);
    fs.writeFileSync(path.join(packetDirectory, 'manifest.json'), `${JSON.stringify(bundle.packetManifest, null, 2)}\n`);
    fs.writeFileSync(path.join(packetDirectory, 'artifact-manifest.json'), bundle.artifactManifestRaw);
    fs.writeFileSync(path.join(packetDirectory, 'review-packet.md'), bundle.reviewMarkdownRaw);
    fs.writeFileSync(path.join(packetDirectory, 'decision-template.ndjson'), bundle.blankTemplateRaw);
    fs.writeFileSync(path.join(decisionDirectory, `${policy.inputDecisionDomain}.ndjson`), bundle.decisionRaw);
    fs.writeFileSync(path.join(decisionDirectory, 'manifest.json'), `${JSON.stringify(bundle.decisionManifest, null, 2)}\n`);
    const run = suffix => {
      const outputRoot = path.join(fixtureRoot, suffix);
      fs.mkdirSync(outputRoot);
      const command = spawnSync(process.execPath, [
        'platform/transforms/apply-agility-target-condition-gap-discovery-review-decisions.mjs',
        `--packet-snapshot=${packetDirectory}`,
        `--decision-snapshot=${decisionDirectory}`,
        `--root=${outputRoot}`
      ], { encoding: 'utf8' });
      assert.equal(command.status, 0, command.stderr || command.stdout);
      const result = JSON.parse(command.stdout);
      assert.equal(result.accepted, true);
      assert.equal(result.coverage.applicationCoverage.applicationRecordCount, 2);
      assert.equal(result.coverage.semanticPreservationCoverage.gamePerformanceFactsCreated, 0);
      assert.equal(result.coverage.semanticPreservationCoverage.optimizerEligibleCount, 0);
      const raw = fs.readFileSync(path.join(outputRoot, result.outputSnapshot.directory, `${policy.outputDomain}.ndjson`), 'utf8');
      return { raw, contentHash: result.outputSnapshot.contentHash };
    };
    const first = run('output-one');
    const second = run('output-two');
    assert.deepEqual(second, first);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

console.log('Agility target-condition discovery review-decision application checks passed.');
