import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import { expectedAgilityTargetConditionGapDiscoveryReviewBlankDecision } from '../transforms/agility-target-condition-gap-discovery-review-decision-import-lib.mjs';
import {
  auditAgilityTargetConditionGapDiscoveryReviewDecisionGuidance,
  buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance,
  compileAgilityTargetConditionGapDiscoveryReviewDecisionGuidancePolicy
} from '../transforms/agility-target-condition-gap-discovery-review-decision-guidance-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/agility-target-condition-gap-discovery-review-decision-guidance-v1.json');
const packetPolicy = readJson('platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json');
const decisionPolicy = readJson('platform/policies/agility-target-condition-gap-discovery-review-decision-import-v1.json');
const applicationPolicy = readJson('platform/policies/agility-target-condition-gap-discovery-review-decision-application-v1.json');
const recordContract = readJson('platform/contracts/agility-target-condition-gap-discovery-review-decision-guidance-v1.json');
const auditContract = readJson('platform/contracts/agility-target-condition-gap-discovery-review-decision-guidance-audit-v1.json');

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
    reviewScope: {
      decisionAppliesOnlyToNamedBlocker: `blocker-${ordinal}`,
      confirmationRequiresSeparateGuardedDecisionImportAndApplication: true,
      confirmationDoesNotProve: ['verified_best_is_not_authorized'],
      otherOpenBlockersRemain: [`related-blocker-${ordinal}`]
    },
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

function fixture(count = 2) {
  const packetRecords = Array.from({ length: count }, (_, index) => packetRecord(index + 1));
  const packetRaw = `${packetRecords.map(row => json(row)).join('\n')}\n`;
  const createdAt = '2026-09-06T10:05:45.036Z';
  const packetManifest = {
    contract: decisionPolicy.inputManifestContract,
    domain: decisionPolicy.inputPacketDomain,
    createdAt,
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
  const packetReviewMarkdownRaw = '# Synthetic exact-revision review packet\n';
  const artifactBase = {
    contract: decisionPolicy.artifactManifestContract,
    packetCount: packetRecords.length,
    reviewMarkdown: { file: 'review-packet.md', contentHash: hash(packetReviewMarkdownRaw), bytes: Buffer.byteLength(packetReviewMarkdownRaw, 'utf8') },
    decisionTemplate: { file: 'decision-template.ndjson', recordCount: blankTemplates.length, contentHash: hash(blankTemplateRaw), bytes: Buffer.byteLength(blankTemplateRaw, 'utf8') },
    packetContentHashes: packetRecords.map(row => row.packetContentHash),
    decisionsRecorded: 0
  };
  const packetArtifactManifest = { ...artifactBase, contentHash: hash(artifactBase) };
  const packetArtifactManifestRaw = `${JSON.stringify(packetArtifactManifest, null, 2)}\n`;
  return {
    packetRecords,
    packetRaw,
    packetManifest,
    packetArtifactManifest,
    packetArtifactManifestRaw,
    packetReviewMarkdownRaw,
    blankTemplates,
    blankTemplateRaw,
    packetSnapshot: { directory: 'packet', contentHash: packetManifest.contentHash, createdAt, records: packetRecords.length, explicit: true },
    policy,
    packetPolicy,
    decisionPolicy,
    applicationPolicy,
    contentHash: hash
  };
}

test('guidance policy is generic, exact-policy-bound, and forbids automatic verification', () => {
  const compiled = compileAgilityTargetConditionGapDiscoveryReviewDecisionGuidancePolicy(policy, packetPolicy, decisionPolicy, applicationPolicy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidBindings, []);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  assert.equal(compiled.hashesMatch, true);
  const specific = structuredClone(policy);
  specific.candidateOverrides = { shayzien: 'confirm' };
  assert.equal(compileAgilityTargetConditionGapDiscoveryReviewDecisionGuidancePolicy(specific, packetPolicy, decisionPolicy, applicationPolicy).valid, false);
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileAgilityTargetConditionGapDiscoveryReviewDecisionGuidancePolicy(automatic, packetPolicy, decisionPolicy, applicationPolicy).valid, false);
});

test('materializes one neutral evidence-bound guidance record per packet', () => {
  const input = fixture(2);
  const built = buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(input);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records.length, 2);
  assert.equal(built.audit.guidanceCoverage.everyDecisionOptionUnselected, true);
  assert.equal(built.audit.bindingCoverage.exactRevisionLineBindings, 2);
  assert.equal(built.audit.semanticPreservationCoverage.selectedDecisionCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.recommendedDecisionCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.decisionRecordedCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.semanticApplicationCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.blockersClosed, 0);
  assert.equal(built.audit.semanticPreservationCoverage.gamePerformanceFactsCreated, 0);
  assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
  for (const record of built.records) {
    for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing guidance field ${field}`);
    assert.equal(record.decisionOptions.length, 3);
    assert.ok(record.decisionOptions.every(option => option.selected === false && option.recommended === false));
    assert.deepEqual(record.requiredEvidenceKeys, [record.sourceEvidence.evidenceKey]);
    assert.equal(record.selectedDecision, null);
    assert.equal(record.recommendedDecision, null);
  }
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('decision consequences mirror the guarded application boundary', () => {
  const record = buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(fixture(1)).records[0];
  const [confirm, reject, additional] = record.decisionOptions;
  assert.equal(confirm.decision, 'confirm_source_resolves_named_blocker_only');
  assert.equal(confirm.namedBlockerWouldCloseAfterSeparateApplication, true);
  assert.equal(confirm.expectedNamedBlockersClosedAfterSeparateApplication, 1);
  assert.equal(reject.decision, 'reject_source_as_insufficient_or_condition_mismatched');
  assert.equal(reject.namedBlockerWouldCloseAfterSeparateApplication, false);
  assert.equal(reject.expectedNamedBlockersClosedAfterSeparateApplication, 0);
  assert.equal(additional.decision, 'needs_additional_revision_pinned_evidence');
  assert.equal(additional.additionalEvidenceRequired, true);
  assert.equal(additional.expectedNamedBlockersClosedAfterSeparateApplication, 0);
  assert.ok(record.decisionOptions.every(option => option.createsExpectedRate === false
    && option.createsFailureMechanics === false
    && option.promotesOptimizerEligibility === false
    && option.authorizesVerifiedBest === false));
});

test('guidance preserves the blank decision template byte for byte and is deterministic', () => {
  const input = fixture(2);
  const first = buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(input);
  const second = buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(fixture(2));
  assert.deepEqual(second, first);
  assert.equal(first.artifacts.decisionTemplateRaw, input.blankTemplateRaw);
  assert.equal(first.artifacts.artifactManifest.blankDecisionTemplate.contentHash, hash(input.blankTemplateRaw));
  assert.equal(first.artifacts.artifactManifest.blankDecisionTemplate.copiedByteForByte, true);
  assert.equal(first.artifacts.artifactManifest.decisionsSelected, 0);
  assert.equal(first.artifacts.artifactManifest.decisionsRecommended, 0);
  assert.equal(first.artifacts.artifactManifest.semanticApplications, 0);
});

test('implicit, tampered, incomplete, and account-scoped packet inputs reject atomically', () => {
  const implicit = fixture(1);
  implicit.packetSnapshot.explicit = false;
  assert.equal(buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(implicit).records.length, 0);
  const tampered = fixture(1);
  tampered.packetRecords[0].namedBlocker = 'changed-after-hashing';
  assert.equal(buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(tampered).audit.publishable, false);
  const changedTemplate = fixture(1);
  changedTemplate.blankTemplates[0].packetContentHash = '0'.repeat(64);
  changedTemplate.blankTemplateRaw = `${changedTemplate.blankTemplates.map(row => json(row)).join('\n')}\n`;
  assert.equal(buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(changedTemplate).audit.publishable, false);
  const accountScoped = fixture(1);
  accountScoped.packetRecords[0].currentBaseLevel = 34;
  const failed = buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(accountScoped);
  assert.equal(failed.audit.publishable, false);
  assert.ok(failed.audit.accountStateFindings.length > 0);
  assert.equal(failed.records.length, 0);
});

test('independent audit rejects selected recommendations, promotions, and artifact drift', () => {
  const input = fixture(1);
  const valid = buildAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(input);
  const changed = structuredClone(valid.records);
  changed[0].decisionOptions[0].selected = true;
  changed[0].selectedDecision = changed[0].decisionOptions[0].decision;
  changed[0].expectedRateCreated = true;
  changed[0].optimizerEligible = true;
  changed[0].recordContentHash = hash(Object.fromEntries(Object.entries(changed[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))));
  changed[0].contentHash = hash(Object.fromEntries(Object.entries(changed[0]).filter(([key]) => key !== 'contentHash')));
  const artifacts = { ...valid.artifacts, guidanceMarkdown: `${valid.artifacts.guidanceMarkdown}\ntampered\n` };
  const audited = auditAgilityTargetConditionGapDiscoveryReviewDecisionGuidance(changed, { ...input, artifacts });
  assert.equal(audited.publishable, false);
  assert.equal(audited.guidanceCoverage.everyDecisionOptionUnselected, false);
  assert.equal(audited.semanticPreservationCoverage.unsupportedPromotions.length, 1);
  assert.ok(audited.artifactCoverage.artifactMismatches.includes('guidanceMarkdown'));
  assert.ok(audited.blockers.includes('guidance_selected_recommended_recorded_applied_or_promoted_a_decision'));
});

test('CLI refuses implicit input and writes deterministic synthetic guidance only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-agility-guidance-cli-'));
  try {
    const refusalRoot = path.join(root, 'refusal');
    fs.mkdirSync(refusalRoot);
    let command = spawnSync(process.execPath, ['platform/transforms/materialize-agility-target-condition-gap-discovery-review-decision-guidance.mjs', `--root=${refusalRoot}`], { encoding: 'utf8' });
    assert.equal(command.status, 2);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(refusalRoot), []);

    const input = fixture(1);
    const packetDirectory = path.join(root, 'packet');
    fs.mkdirSync(packetDirectory);
    fs.writeFileSync(path.join(packetDirectory, `${decisionPolicy.inputPacketDomain}.ndjson`), input.packetRaw);
    fs.writeFileSync(path.join(packetDirectory, 'manifest.json'), `${JSON.stringify(input.packetManifest, null, 2)}\n`);
    fs.writeFileSync(path.join(packetDirectory, 'artifact-manifest.json'), input.packetArtifactManifestRaw);
    fs.writeFileSync(path.join(packetDirectory, 'review-packet.md'), input.packetReviewMarkdownRaw);
    fs.writeFileSync(path.join(packetDirectory, 'decision-template.ndjson'), input.blankTemplateRaw);
    const run = name => {
      const outputRoot = path.join(root, name);
      fs.mkdirSync(outputRoot);
      const result = spawnSync(process.execPath, [
        'platform/transforms/materialize-agility-target-condition-gap-discovery-review-decision-guidance.mjs',
        `--packet-snapshot=${packetDirectory}`,
        `--root=${outputRoot}`
      ], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.accepted, true);
      assert.equal(parsed.coverage.guidanceCoverage.guidanceRecordCount, 1);
      assert.equal(parsed.coverage.semanticPreservationCoverage.selectedDecisionCount, 0);
      assert.equal(parsed.coverage.semanticPreservationCoverage.optimizerEligibleCount, 0);
      const directory = path.join(outputRoot, parsed.outputSnapshot.directory);
      assert.equal(fs.readFileSync(path.join(directory, 'decision-template.ndjson'), 'utf8'), input.blankTemplateRaw);
      return {
        contentHash: parsed.outputSnapshot.contentHash,
        artifactManifest: fs.readFileSync(path.join(directory, 'artifact-manifest.json'), 'utf8'),
        guidance: fs.readFileSync(path.join(directory, 'decision-guidance.json'), 'utf8')
      };
    };
    assert.deepEqual(run('first'), run('second'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Agility target-condition discovery review-decision guidance checks passed.');
