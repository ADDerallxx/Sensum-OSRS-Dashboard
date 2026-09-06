import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import { buildAgilityTargetConditionGapSourceChannelCoverageSynthesis } from '../transforms/agility-target-condition-gap-source-channel-coverage-synthesis-lib.mjs';
import {
  auditAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry,
  buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry,
  compileAgilityTargetConditionGapSourceChannelChangeMonitoringRegistryPolicy,
  detectAgilityTargetConditionGapSourceChannelChanges
} from '../transforms/agility-target-condition-gap-source-channel-change-monitoring-registry-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/agility-target-condition-gap-source-channel-change-monitoring-registry-v1.json');
const synthesisPolicy = readJson('platform/policies/agility-target-condition-gap-source-channel-coverage-synthesis-v1.json');
const basePolicy = readJson('platform/policies/agility-target-condition-gap-wiki-discovery-v1.json');
const recordContract = readJson('platform/contracts/agility-target-condition-gap-source-channel-change-monitoring-registry-v1.json');
const auditContract = readJson('platform/contracts/agility-target-condition-gap-source-channel-change-monitoring-registry-audit-v1.json');
const coverageHash = '7'.repeat(64);
const sufficiencyHash = '6'.repeat(64);

function upstreamRecord(channel, candidate, withSignal = false) {
  const candidateQueries = basePolicy.queries.filter(query => query.candidateKey === candidate.candidateKey);
  const signalQueryKey = 'shayzien-rate-alignment';
  const searchQueries = candidateQueries.map(query => {
    const signalled = withSignal && query.queryKey === signalQueryKey;
    return {
      queryKey: query.queryKey,
      blocker: query.blocker,
      diagnosticKind: query.diagnosticKind,
      searchText: query.searchText,
      namespaces: structuredClone(channel.namespaces),
      maxResults: 50,
      reportedTotalHits: signalled ? 1 : 0,
      fetchedResultCount: signalled ? 1 : 0,
      resultPageIds: signalled ? [9001] : [],
      resultSetHash: hash(signalled ? [9001] : []),
      paginationComplete: true,
      truncated: false
    };
  });
  const evidenceDomains = candidate.expectedBlockers.map(blocker => {
    const queries = candidateQueries.filter(query => query.blocker === blocker);
    const signalled = withSignal && queries.some(query => query.queryKey === signalQueryKey);
    return {
      blocker,
      diagnosticKinds: [...new Set(queries.map(query => query.diagnosticKind))].sort(),
      queryKeys: queries.map(query => query.queryKey).sort(),
      potentialEvidenceSignals: signalled ? [{
        signalKind: 'shayzien_rate_alignment',
        pageId: 9001,
        title: 'Shayzien Agility Course',
        sourceRevision: '15168110',
        sourceUrl: 'https://oldschool.runescape.wiki/w/Shayzien_Agility_Course',
        line: 100,
        excerpt: 'The rate was increased from 8,750 to 10,000 experience per hour.',
        queryKeys: [signalQueryKey]
      }] : [],
      disposition: signalled ? 'potential_condition_evidence_requires_manual_reaudit' : 'unresolved_not_found_in_declared_bounded_search'
    };
  });
  const base = {
    contract: channel.recordContract,
    candidateKey: candidate.candidateKey,
    candidateName: `Candidate ${candidate.candidateKey}`,
    targetBaseAgility: 34,
    coverageAuditContentHash: coverageHash,
    sourceSufficiencyAuditContentHash: sufficiencyHash,
    searchQueries,
    discoveredPages: withSignal ? [{
      pageId: 9001,
      title: 'Shayzien Agility Course',
      sourceRevision: '15168110',
      sourceTimestamp: '2026-01-01T00:00:00Z',
      sourceUrl: 'https://oldschool.runescape.wiki/w/Shayzien_Agility_Course',
      contentHash: '5'.repeat(64),
      contentBytes: 6000,
      exactSearchIdentityResolved: true,
      matchedQueryKeys: [signalQueryKey]
    }] : [],
    evidenceDomains,
    existingBlockers: [...candidate.expectedBlockers].sort(),
    manualReauditRequired: evidenceDomains.some(domain => domain.potentialEvidenceSignals.length),
    disposition: evidenceDomains.some(domain => domain.potentialEvidenceSignals.length) ? 'blocked_pending_manual_semantic_reaudit' : 'blocked_no_condition_matched_evidence',
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false
  };
  if (channel.channelKey === 'historical_update_archive_search') Object.assign(base, {
    sourceTemporalClass: 'historical_update_archive',
    currentStateAuthority: false,
    historicalSignalsRequireCurrentHeadReconciliation: true,
    historicalSignalCount: 0,
    currentHeadReconciliationRequiredCount: 0,
    currentFactApplications: 0
  });
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function finalizeChannel(channel, records, index) {
  const rawRecords = `${records.map(json).join('\n')}\n`;
  const snapshotDirectory = `synthetic-source-${index}`;
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1',
    domain: channel.manifestDomain,
    createdAt: '2026-09-06T00:00:00.000Z',
    records: records.length,
    contentHash: hash(rawRecords),
    source: { kind: 'synthetic_test_fixture' }
  };
  const signalCount = records.reduce((sum, record) => sum + record.evidenceDomains.reduce((inner, domain) => inner + domain.potentialEvidenceSignals.length, 0), 0);
  const reportBase = {
    contract: channel.reportContract,
    publishable: true,
    policy: { id: channel.policyId, contentHash: channel.policyContentHash },
    queryCoverage: { declaredQueryCount: 27, responseCount: 27, querySetMatches: true, queryDefinitionsMatch: true, queriesCompleteWithinBound: true },
    evidenceDomainCoverage: { blockerCount: 17, potentialEvidenceSignalCount: signalCount, manualReauditCandidateCount: signalCount ? 1 : 0, unresolvedDomainCount: 17 - signalCount },
    blockerPreservation: { preserved: true, blockersClosed: 0, semanticFactsCreated: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, accountStateFindingCount: 0, completeWikiUniverseClaimCount: 0 },
    outputSnapshot: { directory: snapshotDirectory, contentHash: manifest.contentHash }
  };
  return { report: { ...reportBase, contentHash: hash(reportBase) }, manifest, rawRecords, snapshotDirectory };
}

function fixture() {
  const sourceInputs = {};
  synthesisPolicy.inputChannels.forEach((channel, index) => {
    const records = basePolicy.candidates.map(candidate => upstreamRecord(channel, candidate,
      channel.channelKey === 'current_article_search' && candidate.candidateKey.includes('Shayzien')));
    sourceInputs[channel.channelKey] = finalizeChannel(channel, records, index);
  });
  const synthesis = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis({ inputs: sourceInputs, policy: synthesisPolicy, basePolicy, contentHash: hash });
  assert.equal(synthesis.audit.publishable, true);
  const synthesisRaw = `${synthesis.records.map(json).join('\n')}\n`;
  const synthesisManifest = {
    contract: 'sensum.ingestion-manifest.v1',
    domain: synthesisPolicy.outputDomain,
    createdAt: '2026-09-06T01:00:00.000Z',
    records: synthesis.records.length,
    contentHash: hash(synthesisRaw),
    source: {
      policy: { id: synthesisPolicy.policy, contentHash: hash(synthesisPolicy) },
      basePolicy: { id: basePolicy.policy, contentHash: hash(basePolicy) },
      inputs: Object.entries(sourceInputs).map(([channelKey, source]) => ({
        channelKey,
        reportContentHash: source.report.contentHash,
        snapshotDirectory: source.snapshotDirectory,
        snapshotContentHash: source.manifest.contentHash
      })),
      audit: synthesis.audit
    }
  };
  const reportBase = {
    ...synthesis.audit,
    generatedAt: '2026-09-06T01:00:00.000Z',
    policy: { id: synthesisPolicy.policy, contentHash: hash(synthesisPolicy) },
    basePolicy: { id: basePolicy.policy, contentHash: hash(basePolicy) },
    inputs: Object.entries(sourceInputs).map(([channelKey, source]) => ({
      channelKey,
      reportContentHash: source.report.contentHash,
      snapshotDirectory: source.snapshotDirectory,
      snapshotContentHash: source.manifest.contentHash
    })),
    outputSnapshot: { directory: 'synthetic-synthesis', contentHash: synthesisManifest.contentHash }
  };
  return {
    synthesisReport: { ...reportBase, contentHash: hash(reportBase) },
    synthesisManifest,
    synthesisRaw,
    synthesisSnapshotDirectory: 'synthetic-synthesis',
    sourceInputs,
    synthesisPolicy: structuredClone(synthesisPolicy),
    basePolicy: structuredClone(basePolicy),
    policy: structuredClone(policy),
    contentHash: hash
  };
}

function rehashSynthesis(input, records) {
  input.synthesisRaw = `${records.map(json).join('\n')}\n`;
  input.synthesisManifest.contentHash = hash(input.synthesisRaw);
  input.synthesisManifest.records = records.length;
  input.synthesisReport.outputSnapshot.contentHash = input.synthesisManifest.contentHash;
  input.synthesisReport.contentHash = hash({ ...input.synthesisReport, contentHash: undefined });
}

test('policy is generic, three-channel, targeted, historical-safe, and fail closed', () => {
  const compiled = compileAgilityTargetConditionGapSourceChannelChangeMonitoringRegistryPolicy(policy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(Object.keys(policy.channelChangeRoutes).sort(), ['current_article_search', 'current_source_code_search', 'historical_update_archive_search']);
  assert.equal(new Set(Object.values(policy.channelChangeRoutes)).size, 3);
  assert.equal(policy.rules.artifactHashChangesWithoutDomainEvidenceChangesDoNotTriggerEvidenceWork, true);
  assert.equal(policy.rules.onlyChangedDomainChannelPairsMayRouteTargetedEvidenceWork, true);
  assert.equal(policy.rules.historicalChangesRequireCurrentHeadReconciliationBeforeReview, true);
  assert.equal(policy.rules.monitorChangesAreRoutingSignalsAndNeverVerifiedFacts, true);
  assert.equal(policy.rules.automaticVerificationAllowed, false);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
});

test('materializes complete blocker, channel, query, source, and fingerprint coverage', () => {
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(fixture());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.registryComplete, true);
  assert.equal(built.records.length, 17);
  assert.equal(new Set(built.records.map(record => record.candidateKey)).size, 5);
  assert.equal(built.audit.registryCoverage.channelMonitorCount, 51);
  assert.equal(built.audit.registryCoverage.queryBindingCount, 81);
  assert.equal(built.audit.registryCoverage.sourceBindingCount, 1);
  assert.equal(built.audit.registryCoverage.distinctSourceRevisionCount, 1);
  assert.equal(built.audit.registryCoverage.everyDomainHasAllChannels, true);
  assert.equal(built.audit.fingerprintCoverage.evidenceFingerprintCount, 51);
  assert.equal(built.audit.fingerprintCoverage.allFingerprintsValid, true);
  for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `missing audit field ${field}`);
});

test('baseline registry reports no change and preserves every authority gate', () => {
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(fixture());
  assert.equal(built.audit.routingSafety.baselineChangeCount, 0);
  assert.equal(built.audit.routingSafety.targetedDomainChannelRoutingSupported, true);
  assert.ok(built.records.every(record => record.changeDetected === false && record.changeEvents.length === 0));
  assert.ok(built.records.every(record => record.existingBlockerStatus === 'open' && record.blockersClosed === 0));
  assert.ok(built.records.every(record => record.semanticFactsCreated === 0 && record.optimizerEligible === false));
  assert.ok(built.records.every(record => record.verifiedBestAuthorized === false && record.automaticVerificationApplied === false));
  assert.equal(built.audit.blockerPreservation.accountStateFindingCount, 0);
  assert.equal(built.audit.conditionOrMechanicsCoverageComplete, false);
  assert.equal(built.audit.completeWikiUniverse, false);
  assert.equal(built.audit.absoluteBestGate, 'blocked_incomplete_level_34_coverage');
});

test('one query-result change reopens only its exact blocker and source channel', () => {
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(fixture());
  const current = structuredClone(built.records);
  const target = current[0];
  const channel = target.channelMonitors.find(entry => entry.channelKey === 'current_article_search');
  channel.queryResultFingerprint = 'a'.repeat(64);
  channel.evidenceFingerprint = hash({ changed: true });
  const detected = detectAgilityTargetConditionGapSourceChannelChanges(built.records, current, policy);
  assert.equal(detected.events.length, 1);
  assert.equal(detected.affectedMonitorCount, 1);
  assert.equal(detected.affectedDomainChannelCount, 1);
  assert.equal(detected.events[0].monitorKey, target.monitorKey);
  assert.equal(detected.events[0].channelKey, 'current_article_search');
  assert.deepEqual(detected.events[0].changedDimensions, ['query_result_set']);
  assert.equal(detected.events[0].route, policy.channelChangeRoutes.current_article_search);
  assert.equal(detected.events[0].blockerRemainsOpen, true);
  assert.equal(detected.semanticFactsCreated, 0);
  assert.equal(detected.blockersClosed, 0);
});

test('artifact-only churn does not reopen evidence work', () => {
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(fixture());
  const current = structuredClone(built.records);
  current[0].channelMonitors[0].artifactProvenance.reportContentHash = 'b'.repeat(64);
  current[0].channelMonitors[0].artifactProvenance.snapshotContentHash = 'c'.repeat(64);
  const detected = detectAgilityTargetConditionGapSourceChannelChanges(built.records, current, policy);
  assert.equal(detected.events.length, 0);
  assert.equal(detected.provenanceOnlyChangeCount, 1);
  assert.equal(detected.affectedMonitorCount, 0);
});

test('source revision and signal changes are independently classified', () => {
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(fixture());
  const current = structuredClone(built.records);
  const review = current.find(record => record.channelMonitors.some(channel => channel.signalBindings.length));
  const channel = review.channelMonitors.find(entry => entry.channelKey === 'current_article_search');
  channel.sourceRevisionFingerprint = 'c'.repeat(64);
  channel.signalFingerprint = 'd'.repeat(64);
  channel.evidenceFingerprint = 'e'.repeat(64);
  const detected = detectAgilityTargetConditionGapSourceChannelChanges(built.records, current, policy);
  assert.equal(detected.events.length, 1);
  assert.deepEqual(detected.events[0].changedDimensions, ['source_revision_or_content', 'condition_matched_signal']);
  assert.equal(detected.events[0].route, policy.channelChangeRoutes.current_article_search);
  assert.equal(detected.events[0].semanticFactCreated, false);
});

test('historical-channel changes require current-head reconciliation', () => {
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(fixture());
  const current = structuredClone(built.records);
  const channel = current[0].channelMonitors.find(entry => entry.channelKey === 'historical_update_archive_search');
  assert.equal(channel.currentHeadReconciliationRequiredBeforeReview, true);
  channel.queryResultFingerprint = 'f'.repeat(64);
  channel.evidenceFingerprint = '1'.repeat(64);
  const detected = detectAgilityTargetConditionGapSourceChannelChanges(built.records, current, policy);
  assert.equal(detected.events.length, 1);
  assert.equal(detected.events[0].channelKey, 'historical_update_archive_search');
  assert.equal(detected.events[0].route, policy.channelChangeRoutes.historical_update_archive_search);
  assert.equal(detected.events[0].blockerRemainsOpen, true);
});

test('registry structure drift fails closed instead of guessing an affected channel', () => {
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(fixture());
  const current = structuredClone(built.records).slice(1);
  const detected = detectAgilityTargetConditionGapSourceChannelChanges(built.records, current, policy);
  assert.equal(detected.events.length, 1);
  assert.equal(detected.events[0].channelKey, null);
  assert.deepEqual(detected.events[0].changedDimensions, ['registry_structure']);
  assert.equal(detected.events[0].route, policy.structuralChangeRoute);
  assert.equal(detected.events[0].semanticFactCreated, false);
});

test('tampered synthesis payload cannot create a registry even when rehashed', () => {
  const input = fixture();
  const records = input.synthesisRaw.trim().split(/\r?\n/).map(JSON.parse);
  records[0].candidateName = 'Tampered candidate';
  const base = Object.fromEntries(Object.entries(records[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)));
  records[0] = { ...base, recordContentHash: hash(base) };
  records[0].contentHash = hash(Object.fromEntries(Object.entries(records[0]).filter(([key]) => key !== 'contentHash')));
  rehashSynthesis(input, records);
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(input);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.inputIntegrity.checks.synthesisRebuildMatchesRawRecords, false);
  assert.ok(built.audit.blockers.includes('input_integrity_failed:synthesisRebuildMatchesRawRecords'));
});

test('upstream drift cannot pass by altering only synthesis provenance', () => {
  const input = fixture();
  input.sourceInputs.current_source_code_search.report.contentHash = '0'.repeat(64);
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(input);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.inputIntegrity.checks.selectedUpstreamInputsRevalidate, false);
});

test('account state or authority promotion invalidates an otherwise reconstructed registry', () => {
  const input = fixture();
  const built = buildAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(input);
  const records = structuredClone(built.records);
  records[0].accountState = { username: 'forbidden' };
  records[0].optimizerEligible = true;
  const base = Object.fromEntries(Object.entries(records[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)));
  records[0] = { ...base, recordContentHash: hash(base) };
  records[0].contentHash = hash(Object.fromEntries(Object.entries(records[0]).filter(([key]) => key !== 'contentHash')));
  const audit = auditAgilityTargetConditionGapSourceChannelChangeMonitoringRegistry(records, input);
  assert.equal(audit.publishable, false);
  assert.equal(audit.blockerPreservation.accountStateFindingCount, 2);
  assert.equal(audit.blockerPreservation.optimizerEligibleCount, 1);
  assert.ok(audit.blockers.includes('registry_changed_fact_optimizer_account_or_authority_state'));
});

test('policy cannot smuggle candidate-specific or blocker-specific exceptions', () => {
  for (const mutation of [
    value => { value.candidateKeys = ['special-case']; },
    value => { value.routes = { blocker: 'silently-close' }; },
    value => { value.rules.automaticVerificationAllowed = true; }
  ]) {
    const altered = structuredClone(policy);
    mutation(altered);
    assert.equal(compileAgilityTargetConditionGapSourceChannelChangeMonitoringRegistryPolicy(altered).valid, false);
  }
});

function writeFixture(root, input) {
  const synthesisDir = path.join(root, input.synthesisSnapshotDirectory);
  fs.mkdirSync(synthesisDir, { recursive: true });
  fs.writeFileSync(path.join(synthesisDir, 'manifest.json'), `${JSON.stringify(input.synthesisManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(synthesisDir, `${input.synthesisManifest.domain}.ndjson`), input.synthesisRaw);
  const synthesisReport = path.join(root, 'synthesis-report.json');
  fs.writeFileSync(synthesisReport, `${JSON.stringify(input.synthesisReport, null, 2)}\n`);
  const bindings = { synthesisReport, synthesisDir };
  for (const [channelKey, source] of Object.entries(input.sourceInputs)) {
    const sourceDir = path.join(root, source.snapshotDirectory);
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'manifest.json'), `${JSON.stringify(source.manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(sourceDir, `${source.manifest.domain}.ndjson`), source.rawRecords);
    const reportFile = path.join(root, `${source.snapshotDirectory}-report.json`);
    fs.writeFileSync(reportFile, `${JSON.stringify(source.report, null, 2)}\n`);
    bindings[channelKey] = { sourceDir, reportFile };
  }
  return bindings;
}

test('CLI requires explicit inputs and reproduces the same registry payload twice', () => {
  const command = 'platform/transforms/materialize-agility-target-condition-gap-source-channel-change-monitoring-registry.mjs';
  const missing = spawnSync(process.execPath, [command], { cwd: process.cwd(), encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(`${missing.stdout}${missing.stderr}`, /Provide --synthesis-report/);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-change-registry-'));
  try {
    const bindings = writeFixture(temp, fixture());
    const outputRoot = path.join(temp, 'output');
    const args = [
      command, `--root=${outputRoot}`,
      `--synthesis-report=${bindings.synthesisReport}`, `--synthesis-snapshot=${bindings.synthesisDir}`,
      `--article-report=${bindings.current_article_search.reportFile}`, `--article-snapshot=${bindings.current_article_search.sourceDir}`,
      `--source-code-report=${bindings.current_source_code_search.reportFile}`, `--source-code-snapshot=${bindings.current_source_code_search.sourceDir}`,
      `--update-report=${bindings.historical_update_archive_search.reportFile}`, `--update-snapshot=${bindings.historical_update_archive_search.sourceDir}`
    ];
    const first = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    const second = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const firstJson = JSON.parse(first.stdout);
    const secondJson = JSON.parse(second.stdout);
    assert.equal(firstJson.audit.publishable, true);
    assert.equal(secondJson.audit.publishable, true);
    assert.equal(firstJson.outputSnapshot.contentHash, secondJson.outputSnapshot.contentHash);
    assert.equal(firstJson.audit.registryCoverage.blockerMonitorCount, 17);
    assert.equal(firstJson.audit.registryCoverage.queryBindingCount, 81);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
