import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  auditAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition,
  buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition
} from '../transforms/agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-lib.mjs';

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const json = value => JSON.stringify(stable(value));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : json(value)).digest('hex');
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const withHashes = value => {
  const base = without(value, ['recordContentHash', 'contentHash']);
  const recordContentHash = hash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
};
const policy = JSON.parse(await fs.readFile(new URL('../policies/agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-v1.json', import.meta.url), 'utf8'));
const inputPolicy = JSON.parse(await fs.readFile(new URL('../policies/agility-colossal-wyrm-termite-reward-rate-source-discovery-v1.json', import.meta.url), 'utf8'));
assert.equal(hash(inputPolicy), policy.inputPolicyContentHash);
const cliSource = await fs.readFile(new URL('../transforms/materialize-agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition.mjs', import.meta.url), 'utf8');
assert.match(cliSource, /--discovery-audit=<report\.json>/);
assert.match(cliSource, /--discovery-snapshot=<directory>/);

const signal = (signalKind, authorityClass, pageId, title = 'Source page') => ({
  signalKind,
  pageId,
  title,
  sourceRevision: String(15000000 + pageId),
  sourceTimestamp: '2026-09-06T00:00:00Z',
  sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`,
  line: pageId,
  excerpt: `Evidence line for ${signalKind}.`,
  sourceChannel: authorityClass === 'current_article' ? 'article'
    : authorityClass === 'historical_update_archive' ? 'update'
      : authorityClass === 'experimental_discussion' ? 'talk' : 'source_code',
  authorityClass,
  mechanicalAuthority: false,
  requiresManualSemanticReview: true
});

const signalsByBlocker = new Map([
  [inputPolicy.domains[0].blocker, [signal('explicit_unknown_spawn_rate', 'current_article', 1)]],
  [inputPolicy.domains[1].blocker, [signal('experimental_per_completion_average', 'experimental_discussion', 2), signal('current_scoop_range', 'current_article', 3)]],
  [inputPolicy.domains[2].blocker, [signal('hourly_reward_claim', 'current_article', 4), signal('course_duration_or_lap_context', 'current_article', 5)]],
  [inputPolicy.domains[3].blocker, [signal('explicit_unknown_spawn_rate', 'current_article', 6)]],
  [inputPolicy.domains[4].blocker, [signal('experimental_per_completion_average', 'experimental_discussion', 7), signal('current_scoop_range', 'current_article', 8), signal('official_relative_reward_adjustment', 'historical_update_archive', 9)]],
  [inputPolicy.domains[5].blocker, [signal('hourly_reward_claim', 'current_article', 10), signal('official_relative_reward_adjustment', 'historical_update_archive', 11)]]
]);
const baseRecords = inputPolicy.domains.map(domain => withHashes({
  contract: policy.inputRecordContract,
  field: domain.field,
  route: domain.route,
  blocker: domain.blocker,
  potentialEvidenceSignals: signalsByBlocker.get(domain.blocker),
  existingBlockerPreserved: true,
  mechanicallyResolved: false,
  blockersClosed: 0,
  semanticFactsCreated: 0,
  optimizerEligible: false,
  verifiedBestAuthorized: false,
  automaticVerificationApplied: false,
  accountIndependent: true,
  completeWikiUniverseClaimed: false
}));

function fixture(records = baseRecords) {
  const snapshotDirectory = 'fixture-discovery-snapshot';
  const discoveryManifest = {
    contract: 'sensum.ingestion-manifest.v1',
    domain: policy.inputSnapshotDomain,
    records: records.length,
    contentHash: hash(`${records.map(record => json(record)).join('\n')}\n`),
    snapshotDirectory,
    source: { policy: { id: policy.inputPolicy, contentHash: policy.inputPolicyContentHash } }
  };
  const signalCount = records.reduce((sum, record) => sum + record.potentialEvidenceSignals.length, 0);
  const discoveryAuditBase = {
    contract: policy.inputAuditContract,
    publishable: true,
    queryBoundedDiscoveryComplete: true,
    policy: { id: policy.inputPolicy, contentHash: policy.inputPolicyContentHash },
    outputSnapshot: { directory: snapshotDirectory, contentHash: discoveryManifest.contentHash, records: discoveryManifest.records },
    signalCoverage: { totalSignals: signalCount },
    authorityBoundary: {
      mechanicallyResolvedBlockers: 0,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligibleRecords: 0,
      verifiedBestAuthorizations: 0,
      automaticVerifications: 0
    }
  };
  const discoveryAudit = { ...discoveryAuditBase, contentHash: hash(discoveryAuditBase) };
  return { discoveryAudit, discoveryManifest, discoveryRecords: records, inputPolicy, policy, contentHash: hash };
}

const inputs = fixture();
const built = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(inputs);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.sourceSufficiencyDispositionComplete, true);
assert.equal(built.audit.sourceSufficiencyDispositionStable, true);
assert.equal(built.audit.blockerCoverage.everyBlockerMappedOnce, true);
assert.equal(built.audit.signalClassification.inputSignalCount, 11);
assert.equal(built.audit.signalClassification.assessmentCount, 11);
assert.equal(built.audit.signalClassification.resolutionCandidateCount, 0);
assert.equal(built.audit.sufficiencyCoverage.recordCount, 6);
assert.equal(built.audit.sufficiencyCoverage.explicitBlockerConfirmationDomains, 2);
assert.equal(built.audit.sufficiencyCoverage.requiredShapeNotFoundDomains, 4);
assert.equal(built.audit.sufficiencyCoverage.manualReviewDomains, 0);
assert.equal(built.audit.authorityBoundary.mechanicallyResolvedBlockers, 0);
assert.ok(built.records.every(record => record.existingBlockerPreserved && record.nextEvidenceWork.length >= 3));
assert.ok(built.records.flatMap(record => record.signalAssessments)
  .filter(assessment => assessment.source.authorityClass === 'experimental_discussion')
  .every(assessment => !assessment.resolutionCandidate && assessment.disposition === 'experimental_context_not_mechanical_authority'));
assert.ok(built.records.flatMap(record => record.signalAssessments)
  .filter(assessment => assessment.source.authorityClass === 'historical_update_archive')
  .every(assessment => !assessment.resolutionCandidate && assessment.disposition === 'historical_context_not_current_state_authority'));

const candidateRecords = structuredClone(baseRecords);
candidateRecords[0].potentialEvidenceSignals = [signal('potential_exact_spawn_rate', 'current_article', 12, 'Renamed current source')];
candidateRecords[0] = withHashes(candidateRecords[0]);
const candidate = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(fixture(candidateRecords));
assert.equal(candidate.audit.publishable, true);
assert.equal(candidate.audit.sourceSufficiencyDispositionStable, false);
assert.equal(candidate.audit.signalClassification.resolutionCandidateCount, 1);
assert.equal(candidate.audit.sufficiencyCoverage.manualReviewDomains, 1);
assert.equal(candidate.audit.authorityBoundary.mechanicallyResolvedBlockers, 0);
assert.equal(candidate.records[0].sufficiencyDisposition, 'blocked_potential_resolution_evidence_requires_manual_semantic_review');

const talkCandidateRecords = structuredClone(baseRecords);
talkCandidateRecords[0].potentialEvidenceSignals = [signal('potential_exact_spawn_rate', 'experimental_discussion', 13)];
talkCandidateRecords[0] = withHashes(talkCandidateRecords[0]);
const talkCandidate = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(fixture(talkCandidateRecords));
assert.equal(talkCandidate.audit.publishable, true);
assert.equal(talkCandidate.audit.signalClassification.resolutionCandidateCount, 0);
assert.equal(talkCandidate.audit.sourceSufficiencyDispositionStable, true);

const badMappingPolicy = structuredClone(policy);
badMappingPolicy.blockerRules.push(structuredClone(badMappingPolicy.blockerRules[0]));
const badMapping = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition({ ...inputs, policy: badMappingPolicy });
assert.equal(badMapping.audit.publishable, false);
assert.ok(badMapping.audit.blockers.includes('source_sufficiency_disposition_policy_invalid'));
assert.ok(badMapping.audit.blockers.includes('one_or_more_blockers_unmapped_or_ambiguously_mapped'));

const tamperedAudit = structuredClone(inputs.discoveryAudit);
tamperedAudit.signalCoverage.totalSignals += 1;
const staleInput = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition({ ...inputs, discoveryAudit: tamperedAudit });
assert.equal(staleInput.audit.publishable, false);
assert.ok(staleInput.audit.blockers.includes('source_discovery_input_lineage_invalid'));

const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
const promotionAudit = auditAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(promoted, inputs);
assert.equal(promotionAudit.publishable, false);
assert.ok(promotionAudit.blockers.includes('source_sufficiency_disposition_created_unsupported_fact_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].accountState = { level: 34 };
const accountAudit = auditAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(accountScoped, inputs);
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_source_sufficiency_disposition'));

const deterministic = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition(fixture(structuredClone(baseRecords)));
assert.deepEqual(deterministic, built);
console.log('Colossal Wyrm termite and reward-rate source-sufficiency disposition checks passed.');

