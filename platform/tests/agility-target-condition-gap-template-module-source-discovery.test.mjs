import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditAgilityTargetConditionGapTemplateModuleSourceDiscovery,
  buildAgilityTargetConditionGapTemplateModuleSourceDiscovery,
  compileAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy,
  resolveAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy
} from '../ingestion/agility-target-condition-gap-template-module-source-discovery-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/agility-target-condition-gap-template-module-source-discovery-v1.json');
const basePolicy = readJson('platform/policies/agility-target-condition-gap-wiki-discovery-v1.json');
const recordContract = readJson('platform/contracts/agility-target-condition-gap-template-module-source-discovery-v1.json');
const auditContract = readJson('platform/contracts/agility-target-condition-gap-template-module-source-discovery-audit-v1.json');
const namespaceRegistry = {
  query: {
    namespaces: {
      0: { id: 0, name: '', content: true },
      10: { id: 10, name: 'Template', canonical: 'Template' },
      116: { id: 116, name: 'Calculator', canonical: 'Calculator' },
      828: { id: 828, name: 'Module', canonical: 'Module' }
    }
  }
};

function fixture() {
  const fixturePolicy = structuredClone(policy);
  const fixtureBasePolicy = structuredClone(basePolicy);
  const candidates = fixtureBasePolicy.candidates.map((candidate, index) => ({
    candidateKey: candidate.candidateKey,
    name: `Target candidate ${index + 1}`,
    status: fixtureBasePolicy.inputGapStatus,
    blockers: structuredClone(candidate.expectedBlockers)
  }));
  const coverageBase = {
    contract: fixtureBasePolicy.coverageAuditContract,
    targetBaseAgility: fixtureBasePolicy.targetBaseAgility,
    targetConditionGaps: candidates.length,
    details: candidates
  };
  const coverageReport = { ...coverageBase, contentHash: hash(coverageBase) };
  const sufficiencyBase = {
    contract: fixtureBasePolicy.sourceSufficiencyAuditContract,
    inputAudit: { contentHash: coverageReport.contentHash },
    sourceSufficiencyDispositionStable: true,
    evidenceDomainCoverage: { resolutionSignalCount: 0 },
    blockerPreservation: { blockersClosed: 0, semanticFactsCreated: 0 }
  };
  const sourceSufficiencyReport = { ...sufficiencyBase, contentHash: hash(sufficiencyBase) };
  const resolved = resolveAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy(fixturePolicy, fixtureBasePolicy);
  const searchResponses = resolved.queries.map(query => ({
    queryKey: query.queryKey,
    searchText: query.searchText,
    namespaces: structuredClone(fixturePolicy.searchNamespaces),
    maxResults: fixturePolicy.searchResultLimitPerQuery,
    reportedTotalHits: 0,
    pages: [],
    paginationComplete: true,
    truncated: false
  }));
  return { coverageReport, sourceSufficiencyReport, searchResponses, revisionPages: [], namespaceRegistry: structuredClone(namespaceRegistry), policy: fixturePolicy, basePolicy: fixtureBasePolicy, contentHash: hash };
}

test('policy binds the exact base policy and current non-article namespace registry', () => {
  const compiled = compileAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy(policy, basePolicy, namespaceRegistry);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidBindings, []);
  assert.deepEqual(compiled.invalidRules, []);
  assert.equal(compiled.basePolicyBindingValid, true);
  assert.equal(compiled.channelsExact, true);
  assert.equal(compiled.namespaceRegistryExact, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  assert.deepEqual(policy.searchNamespaces, [10, 116, 828]);
  assert.equal(policy.searchNamespaces.includes(0), false);
});

test('resolves all five target candidates and 27 queries without modifying the base policy', () => {
  const before = structuredClone(basePolicy);
  const resolved = resolveAgilityTargetConditionGapTemplateModuleSourceDiscoveryPolicy(policy, basePolicy);
  assert.equal(resolved.policy, policy.policy);
  assert.equal(resolved.recordContract, policy.recordContract);
  assert.equal(resolved.auditContract, policy.auditContract);
  assert.deepEqual(resolved.searchNamespaces, [10, 116, 828]);
  assert.deepEqual(resolved.candidates, basePolicy.candidates);
  assert.deepEqual(resolved.queries, basePolicy.queries);
  assert.equal(resolved.candidates.length, 5);
  assert.equal(resolved.queries.length, 27);
  assert.deepEqual(basePolicy, before);
});

test('empty bounded source-channel results preserve every blocker and non-claim', () => {
  const built = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(fixture());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.queryBoundedDiscoveryComplete, true);
  assert.equal(built.audit.sourceDiscoveryDispositionStable, true);
  assert.equal(built.records.length, 5);
  assert.equal(built.audit.queryCoverage.declaredQueryCount, 27);
  assert.equal(built.audit.evidenceDomainCoverage.blockerCount, 17);
  assert.equal(built.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 0);
  assert.equal(built.audit.sourceChannelCoverage.articleNamespaceExcluded, true);
  assert.equal(built.audit.sourceChannelCoverage.currentNamespaceRegistryMatches, true);
  assert.equal(built.audit.sourceChannelCoverage.returnedSearchPageCount, 0);
  assert.ok(built.records.every(record => record.blockersClosed === 0
    && record.semanticFactsCreated === 0
    && record.optimizerEligible === false
    && record.automaticVerificationApplied === false
    && record.completeWikiUniverseClaimed === false));
  for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing source-channel record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing source-channel audit field ${field}`);
});

test('a source-code match creates only a manual reaudit signal', () => {
  const input = fixture();
  const response = input.searchResponses.find(row => row.queryKey === 'shayzien-rate-alignment');
  response.reportedTotalHits = 1;
  response.pages = [{ pageId: 9001, title: 'Template:Shayzien test data', namespaceId: 10 }];
  input.revisionPages = [{
    pageid: 9001,
    ns: 10,
    title: 'Template:Shayzien test data',
    revisions: [{ revid: 12345678, timestamp: '2026-09-06T00:00:00Z', slots: { main: { content: 'Shayzien Agility Course increased from 8,750 to 10,000 experience per hour.' } } }]
  }];
  const built = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(input);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.sourceDiscoveryDispositionStable, false);
  assert.equal(built.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 1);
  assert.equal(built.audit.evidenceDomainCoverage.manualReauditCandidateCount, 1);
  assert.equal(built.audit.blockerPreservation.blockersClosed, 0);
  assert.equal(built.audit.blockerPreservation.semanticFactsCreated, 0);
  assert.equal(built.audit.blockerPreservation.optimizerEligibleCount, 0);
  assert.deepEqual(built.audit.sourceChannelCoverage.returnedNamespaceCounts, { Template: 1, Calculator: 0, Module: 0 });
  assert.equal(built.records.find(row => row.candidateKey.includes('Shayzien')).manualReauditRequired, true);
});

test('sandbox source code remains discoverable but cannot become an evidence signal', () => {
  const input = fixture();
  const response = input.searchResponses.find(row => row.queryKey === 'shayzien-rate-alignment');
  response.reportedTotalHits = 1;
  response.pages = [{ pageId: 9002, title: 'Module:Sandbox/User:Example/Agility', namespaceId: 828 }];
  input.revisionPages = [{
    pageid: 9002,
    ns: 828,
    title: 'Module:Sandbox/User:Example/Agility',
    revisions: [{ revid: 12345679, timestamp: '2026-09-06T00:00:00Z', slots: { main: { content: 'Shayzien Agility Course increased from 8,750 to 10,000 experience per hour.' } } }]
  }];
  const built = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(input);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 0);
  assert.equal(built.audit.sourceChannelCoverage.excludedWorkspacePageCount, 1);
  assert.deepEqual(built.audit.sourceChannelCoverage.excludedWorkspacePageTitles, ['Module:Sandbox/User:Example/Agility']);
  assert.equal(built.records.find(row => row.candidateKey.includes('Shayzien')).manualReauditRequired, false);
});

test('wrong namespace registry, base hash, or returned namespace fails closed', () => {
  const wrongRegistry = fixture();
  wrongRegistry.namespaceRegistry.query.namespaces[116].canonical = 'Wrong';
  let built = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(wrongRegistry);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.policyCoverage.namespaceRegistryExact, false);

  const wrongBase = fixture();
  wrongBase.basePolicy.queries[0].searchText = 'tampered';
  built = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(wrongBase);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.audit.policyCoverage.basePolicyBindingValid, false);

  const wrongPage = fixture();
  const response = wrongPage.searchResponses[0];
  response.reportedTotalHits = 1;
  response.pages = [{ pageId: 42, title: 'Article namespace page', namespaceId: 0 }];
  wrongPage.revisionPages = [{ pageid: 42, ns: 0, title: 'Article namespace page', revisions: [{ revid: 100, timestamp: '2026-09-06T00:00:00Z', slots: { main: { content: 'No evidence.' } } }] }];
  built = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(wrongPage);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.sourceChannelCoverage.returnedSearchPagesUseDeclaredNamespaces, false);
  assert.ok(built.audit.blockers.includes('one_or_more_search_or_revision_pages_outside_verified_source_channels'));
});

test('independent audit rejects account state and downstream promotion', () => {
  const input = fixture();
  const valid = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(input);
  const changed = structuredClone(valid.records);
  changed[0].currentBaseLevel = 34;
  changed[0].optimizerEligible = true;
  const audit = auditAgilityTargetConditionGapTemplateModuleSourceDiscovery(changed, input);
  assert.equal(audit.publishable, false);
  assert.ok(audit.accountStateFindings.length > 0);
  assert.ok(audit.blockers.includes('account_query_state_baked_into_source_channel_discovery'));
  assert.ok(audit.blockers.includes('unsupported_fact_resolution_or_optimizer_promotion_detected'));
});

test('identical source-channel inputs reproduce identical records and audits', () => {
  const first = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(fixture());
  const second = buildAgilityTargetConditionGapTemplateModuleSourceDiscovery(fixture());
  assert.deepEqual(second, first);
});

test('CLI refuses missing explicit audit inputs without creating output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-agility-source-channel-refusal-'));
  try {
    const command = spawnSync(process.execPath, [
      'platform/ingestion/ingest-wiki-agility-target-condition-gap-template-module-source-discovery.mjs',
      `--root=${root}`
    ], { encoding: 'utf8' });
    assert.notEqual(command.status, 0);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Agility target-condition template/module source-discovery checks passed.');
