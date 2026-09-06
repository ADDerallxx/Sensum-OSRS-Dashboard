import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditAgilityTargetConditionGapUpdateArchiveSourceDiscovery,
  buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery,
  compileAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy,
  resolveAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy
} from '../ingestion/agility-target-condition-gap-update-archive-source-discovery-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/agility-target-condition-gap-update-archive-source-discovery-v1.json');
const basePolicy = readJson('platform/policies/agility-target-condition-gap-wiki-discovery-v1.json');
const recordContract = readJson('platform/contracts/agility-target-condition-gap-update-archive-source-discovery-v1.json');
const auditContract = readJson('platform/contracts/agility-target-condition-gap-update-archive-source-discovery-audit-v1.json');
const namespaceRegistry = {
  query: {
    namespaces: {
      0: { id: 0, name: '', content: true },
      112: { id: 112, name: 'Update', canonical: 'Update' }
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
  const resolved = resolveAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy(fixturePolicy, fixtureBasePolicy);
  const searchResponses = resolved.queries.map(query => ({
    queryKey: query.queryKey,
    searchText: query.searchText,
    namespaces: [112],
    maxResults: fixturePolicy.searchResultLimitPerQuery,
    reportedTotalHits: 0,
    pages: [],
    paginationComplete: true,
    truncated: false
  }));
  return {
    coverageReport,
    sourceSufficiencyReport,
    searchResponses,
    revisionPages: [],
    namespaceRegistry: structuredClone(namespaceRegistry),
    policy: fixturePolicy,
    basePolicy: fixtureBasePolicy,
    contentHash: hash
  };
}

function addShayzienChangeSignal(input, namespaceId = 112) {
  const response = input.searchResponses.find(row => row.queryKey === 'shayzien-rate-alignment');
  response.reportedTotalHits = 1;
  response.pages = [{ pageId: 7001, title: namespaceId === 112 ? 'Update:Shayzien course changes' : 'Shayzien course changes', namespaceId }];
  input.revisionPages = [{
    pageid: 7001,
    ns: namespaceId,
    title: namespaceId === 112 ? 'Update:Shayzien course changes' : 'Shayzien course changes',
    revisions: [{ revid: 15100000, timestamp: '2026-08-01T00:00:00Z', slots: { main: { content: 'The Shayzien Agility Course rate was increased from 8,750 to 10,000 experience per hour.' } } }]
  }];
}

test('policy binds the exact base policy and live Update namespace', () => {
  const compiled = compileAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy(policy, basePolicy, namespaceRegistry);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidBindings, []);
  assert.deepEqual(compiled.invalidRules, []);
  assert.equal(compiled.basePolicyBindingValid, true);
  assert.equal(compiled.channelExact, true);
  assert.equal(compiled.namespaceRegistryExact, true);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  assert.deepEqual(policy.searchNamespaces, [112]);
  assert.equal(policy.sourceTemporalClass, 'historical_update_archive');
});

test('inherits the complete candidate, blocker, query, and diagnostic scope', () => {
  const resolved = resolveAgilityTargetConditionGapUpdateArchiveSourceDiscoveryPolicy(policy, basePolicy);
  assert.equal(resolved.policy, policy.policy);
  assert.equal(resolved.recordContract, policy.recordContract);
  assert.equal(resolved.auditContract, policy.auditContract);
  assert.deepEqual(resolved.searchNamespaces, [112]);
  assert.deepEqual(resolved.candidates, basePolicy.candidates);
  assert.deepEqual(resolved.queries, basePolicy.queries);
  assert.equal(resolved.candidates.length, 5);
  assert.equal(resolved.queries.length, 27);
});

test('empty bounded archive results preserve all blockers and temporal non-authority', () => {
  const built = buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(fixture());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.queryBoundedDiscoveryComplete, true);
  assert.equal(built.audit.sourceDiscoveryDispositionStable, true);
  assert.equal(built.records.length, 5);
  assert.equal(built.audit.queryCoverage.declaredQueryCount, 27);
  assert.equal(built.audit.evidenceDomainCoverage.blockerCount, 17);
  assert.equal(built.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 0);
  assert.equal(built.audit.updateArchiveCoverage.onlyUpdateNamespaceDeclared, true);
  assert.equal(built.audit.updateArchiveCoverage.currentNamespaceRegistryMatches, true);
  assert.equal(built.audit.temporalAuthorityCoverage.currentStateAuthoritySignalCount, 0);
  assert.equal(built.audit.temporalAuthorityCoverage.currentFactApplicationCount, 0);
  assert.ok(built.records.every(record => record.sourceTemporalClass === 'historical_update_archive'
    && record.currentStateAuthority === false
    && record.currentFactApplications === 0
    && record.blockersClosed === 0
    && record.optimizerEligible === false));
  for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing update archive record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing update archive audit field ${field}`);
});

test('explicit old-to-new Update language remains historical and cannot apply a current fact', () => {
  const input = fixture();
  addShayzienChangeSignal(input);
  const built = buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(input);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.sourceDiscoveryDispositionStable, false);
  assert.equal(built.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 1);
  assert.equal(built.audit.evidenceDomainCoverage.manualReauditCandidateCount, 1);
  assert.equal(built.audit.temporalAuthorityCoverage.historicalSignalCount, 1);
  assert.equal(built.audit.temporalAuthorityCoverage.currentStateAuthoritySignalCount, 0);
  assert.equal(built.audit.temporalAuthorityCoverage.currentHeadReconciliationRequiredCount, 1);
  assert.equal(built.audit.temporalAuthorityCoverage.currentFactApplicationCount, 0);
  const shayzien = built.records.find(row => row.candidateKey.includes('Shayzien'));
  const signal = shayzien.evidenceDomains.flatMap(domain => domain.potentialEvidenceSignals)[0];
  assert.equal(signal.sourceTemporalClass, 'historical_update_archive');
  assert.equal(signal.temporalDisposition, 'historical_signal_requires_current_head_reconciliation');
  assert.equal(signal.currentStateAuthority, false);
  assert.equal(signal.currentHeadReconciliationRequired, true);
  assert.equal(signal.mayApplyCurrentFact, false);
  assert.equal(shayzien.currentFactApplications, 0);
  assert.equal(shayzien.blockersClosed, 0);
});

test('wrong registry, base policy, or returned namespace rejects atomically', () => {
  const wrongRegistry = fixture();
  wrongRegistry.namespaceRegistry.query.namespaces[112].canonical = 'Wrong';
  let built = buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(wrongRegistry);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.policyCoverage.namespaceRegistryExact, false);

  const wrongBase = fixture();
  wrongBase.basePolicy.queries[0].searchText = 'tampered';
  built = buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(wrongBase);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.audit.policyCoverage.basePolicyBindingValid, false);

  const wrongNamespace = fixture();
  addShayzienChangeSignal(wrongNamespace, 0);
  built = buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(wrongNamespace);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.updateArchiveCoverage.returnedSearchPagesUseUpdateNamespace, false);
  assert.ok(built.audit.blockers.includes('one_or_more_search_or_revision_pages_outside_verified_update_namespace'));
});

test('independent audit rejects stripped temporal gates, account state, and promotion', () => {
  const input = fixture();
  addShayzienChangeSignal(input);
  const valid = buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(input);
  const changed = structuredClone(valid.records);
  const shayzien = changed.find(row => row.candidateKey.includes('Shayzien'));
  const signal = shayzien.evidenceDomains.flatMap(domain => domain.potentialEvidenceSignals)[0];
  signal.currentStateAuthority = true;
  signal.currentHeadReconciliationRequired = false;
  shayzien.currentStateAuthority = true;
  shayzien.currentFactApplications = 1;
  shayzien.optimizerEligible = true;
  shayzien.currentBaseLevel = 34;
  const audit = auditAgilityTargetConditionGapUpdateArchiveSourceDiscovery(changed, input);
  assert.equal(audit.publishable, false);
  assert.equal(audit.temporalAuthorityCoverage.currentStateAuthoritySignalCount, 1);
  assert.equal(audit.temporalAuthorityCoverage.currentFactApplicationCount, 1);
  assert.ok(audit.accountStateFindings.length > 0);
  assert.ok(audit.blockers.includes('historical_signal_missing_current_state_non_authority_or_reconciliation_gate'));
  assert.ok(audit.blockers.includes('historical_update_discovery_created_unsupported_fact_or_optimizer_promotion'));
});

test('identical archive inputs reproduce identical records and audits', () => {
  const firstInput = fixture();
  const secondInput = fixture();
  addShayzienChangeSignal(firstInput);
  addShayzienChangeSignal(secondInput);
  assert.deepEqual(
    buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(secondInput),
    buildAgilityTargetConditionGapUpdateArchiveSourceDiscovery(firstInput)
  );
});

test('CLI refuses missing explicit audit inputs without creating output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-agility-update-archive-refusal-'));
  try {
    const command = spawnSync(process.execPath, [
      'platform/ingestion/ingest-wiki-agility-target-condition-gap-update-archive-source-discovery.mjs',
      `--root=${root}`
    ], { encoding: 'utf8' });
    assert.notEqual(command.status, 0);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Agility target-condition Update-archive source-discovery checks passed.');
