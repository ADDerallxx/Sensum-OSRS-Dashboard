import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditAgilityTargetConditionGapSourceChannelChangeEvaluation,
  buildAgilityTargetConditionGapSourceChannelChangeEvaluation,
  compileAgilityTargetConditionGapSourceChannelChangeEvaluationPolicy
} from '../transforms/agility-target-condition-gap-source-channel-change-evaluation-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/agility-target-condition-gap-source-channel-change-evaluation-v1.json');
const registryPolicy = readJson('platform/policies/agility-target-condition-gap-source-channel-change-monitoring-registry-v1.json');
const eventContract = readJson('platform/contracts/agility-target-condition-gap-source-channel-change-event-v1.json');
const auditContract = readJson('platform/contracts/agility-target-condition-gap-source-channel-change-evaluation-audit-v1.json');
const channels = ['current_article_search', 'current_source_code_search', 'historical_update_archive_search'];

function channelMonitor(channelKey, blocker, queryCount, ordinal) {
  const queryDefinitions = Array.from({ length: queryCount }, (_, index) => ({
    queryKey: `query-${ordinal}-${index}`,
    blocker,
    diagnosticKind: 'synthetic_diagnostic',
    searchText: `synthetic search ${ordinal} ${index}`,
    maxResults: 50,
    namespaces: channelKey === 'current_article_search' ? [0] : channelKey === 'current_source_code_search' ? [10, 116, 828] : [112]
  }));
  const queryResults = queryDefinitions.map(query => ({
    queryKey: query.queryKey,
    reportedTotalHits: 0,
    fetchedResultCount: 0,
    resultPageIds: [],
    resultSetHash: hash([]),
    paginationComplete: true,
    truncated: false
  }));
  const sourceBindings = [];
  const signalBindings = [];
  const queryDefinitionFingerprint = hash(queryDefinitions);
  const queryResultFingerprint = hash(queryResults);
  const sourceRevisionFingerprint = hash(sourceBindings);
  const signalFingerprint = hash(signalBindings);
  return {
    channelKey,
    temporalClass: channelKey === 'historical_update_archive_search' ? 'historical_update_archive' : 'current_revision_search',
    artifactProvenance: { reportContract: `synthetic.${channelKey}.audit.v1`, reportContentHash: hash(`${channelKey}-report`), snapshotDirectory: `${channelKey}-snapshot`, snapshotContentHash: hash(`${channelKey}-snapshot`) },
    queryDefinitions,
    queryResults,
    sourceBindings,
    signalBindings,
    queryDefinitionFingerprint,
    queryResultFingerprint,
    sourceRevisionFingerprint,
    signalFingerprint,
    evidenceFingerprint: hash({ queryDefinitionFingerprint, queryResultFingerprint, sourceRevisionFingerprint, signalFingerprint }),
    changeRoute: registryPolicy.channelChangeRoutes[channelKey],
    currentHeadReconciliationRequiredBeforeReview: channelKey === 'historical_update_archive_search',
    blockerRemainsOpen: true
  };
}

function registryRecord(ordinal) {
  const blocker = `synthetic_open_blocker_${ordinal}`;
  const queryCount = ordinal < 10 ? 2 : 1;
  const base = {
    contract: policy.inputRecordContract,
    monitorKey: `candidate-${ordinal}|${blocker}`,
    candidateKey: `candidate-${ordinal}`,
    candidateName: `Candidate ${ordinal}`,
    targetBaseAgility: 34,
    blocker,
    existingBlockerStatus: 'open',
    baselineNextAction: 'continue_revision_monitoring_and_seek_additional_authoritative_evidence',
    synthesisBinding: { recordContentHash: hash(`synthesis-${ordinal}`), coverageAuditContentHash: '7'.repeat(64), sourceSufficiencyAuditContentHash: '6'.repeat(64) },
    channelMonitors: channels.map(channelKey => channelMonitor(channelKey, blocker, queryCount, ordinal)).sort((a, b) => a.channelKey.localeCompare(b.channelKey)),
    monitoringState: 'baseline_registered_no_change_observed',
    changeDetected: false,
    changeEvents: [],
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligible: false,
    verifiedBestAuthorized: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false
  };
  const recordContentHash = hash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function registryAudit(records) {
  return {
    contract: policy.inputAuditContract,
    registryCoverage: {
      blockerMonitorCount: records.length,
      channelMonitorCount: records.reduce((sum, record) => sum + record.channelMonitors.length, 0),
      queryBindingCount: records.reduce((sum, record) => sum + record.channelMonitors.reduce((inner, channel) => inner + channel.queryDefinitions.length, 0), 0)
    },
    blockerPreservation: {
      allBlockersRemainOpen: true,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligibleCount: 0,
      verifiedBestAuthorizationCount: 0,
      automaticVerificationCount: 0,
      accountStateFindingCount: 0,
      completeWikiUniverseClaimCount: 0
    },
    registryComplete: true,
    publishable: true
  };
}

function registrySnapshot(label, createdAt, records = Array.from({ length: 17 }, (_, index) => registryRecord(index))) {
  const raw = `${records.map(json).join('\n')}\n`;
  const audit = registryAudit(records);
  const manifest = {
    contract: policy.inputManifestContract,
    domain: policy.inputDomain,
    createdAt,
    records: records.length,
    contentHash: hash(raw),
    source: { policy: { id: registryPolicy.policy, contentHash: hash(registryPolicy) }, audit }
  };
  const reportBase = {
    ...audit,
    generatedAt: createdAt,
    policy: { id: registryPolicy.policy, contentHash: hash(registryPolicy) },
    inputSynthesis: {},
    upstreamInputs: [],
    outputSnapshot: { directory: label, contentHash: manifest.contentHash }
  };
  return { report: { ...reportBase, contentHash: hash(reportBase) }, manifest, raw, snapshotDirectory: label };
}

function fixture() {
  return {
    baseline: registrySnapshot('baseline-registry', '2026-09-06T00:00:00.000Z'),
    current: registrySnapshot('current-registry', '2026-09-06T01:00:00.000Z'),
    policy: structuredClone(policy),
    registryPolicy: structuredClone(registryPolicy),
    contentHash: hash
  };
}

function rehashRecord(record) {
  const base = Object.fromEntries(Object.entries(record).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)));
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function refreshInput(input, records) {
  input.raw = `${records.map(json).join('\n')}\n`;
  input.manifest.records = records.length;
  input.manifest.contentHash = hash(input.raw);
  input.manifest.source.audit = registryAudit(records);
  Object.assign(input.report, registryAudit(records));
  input.report.outputSnapshot.contentHash = input.manifest.contentHash;
  input.report.contentHash = hash({ ...input.report, contentHash: undefined });
}

function mutateChannel(input, recordIndex, channelKey, mutation) {
  const records = input.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
  const channel = records[recordIndex].channelMonitors.find(value => value.channelKey === channelKey);
  mutation(channel);
  channel.queryDefinitionFingerprint = hash(channel.queryDefinitions);
  channel.queryResultFingerprint = hash(channel.queryResults);
  channel.sourceRevisionFingerprint = hash(channel.sourceBindings);
  channel.signalFingerprint = hash(channel.signalBindings);
  channel.evidenceFingerprint = hash({
    queryDefinitionFingerprint: channel.queryDefinitionFingerprint,
    queryResultFingerprint: channel.queryResultFingerprint,
    sourceRevisionFingerprint: channel.sourceRevisionFingerprint,
    signalFingerprint: channel.signalFingerprint
  });
  records[recordIndex] = rehashRecord(records[recordIndex]);
  refreshInput(input, records);
}

test('policy requires two explicit validated registries and preserves all authority gates', () => {
  const compiled = compileAgilityTargetConditionGapSourceChannelChangeEvaluationPolicy(policy);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidBindings, []);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  assert.equal(policy.rules.onlyFingerprintChangesCreateChangeEvents, true);
  assert.equal(policy.rules.artifactProvenanceOnlyChangesDoNotCreateChangeEvents, true);
  assert.equal(policy.rules.historicalEventsRequireCurrentHeadReconciliationBeforeReview, true);
  assert.equal(policy.rules.changeEventsOnlyRequeueEvidenceWorkAndNeverApplySemantics, true);
  assert.equal(policy.rules.automaticVerificationAllowed, false);
});

test('unchanged registries produce a valid durable empty event set', () => {
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(fixture());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.changeEvaluationComplete, true);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.changeCoverage.changeDetected, false);
  assert.equal(built.audit.changeCoverage.changeEventCount, 0);
  assert.equal(built.audit.changeCoverage.provenanceOnlyChangeCount, 0);
  assert.equal(built.audit.routingCoverage.unchangedEvaluationPublishedAsEmptyEventSet, true);
  assert.equal(built.audit.populationContinuity.baselineMonitorCount, 17);
  assert.equal(built.audit.populationContinuity.currentMonitorCount, 17);
  assert.equal(built.audit.populationContinuity.monitorKeySetsMatch, true);
  assert.equal(built.audit.temporalOrdering.currentNotBeforeBaseline, true);
});

test('one result-set change emits one exactly bound event', () => {
  const input = fixture();
  mutateChannel(input.current, 0, 'current_article_search', channel => {
    channel.queryResults[0].reportedTotalHits = 1;
    channel.queryResults[0].fetchedResultCount = 1;
    channel.queryResults[0].resultPageIds = [100];
    channel.queryResults[0].resultSetHash = hash([100]);
  });
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records.length, 1);
  const event = built.records[0];
  assert.equal(event.monitorKey, 'candidate-0|synthetic_open_blocker_0');
  assert.equal(event.channelKey, 'current_article_search');
  assert.deepEqual(event.changedDimensions, ['query_result_set']);
  assert.equal(event.route, registryPolicy.channelChangeRoutes.current_article_search);
  assert.equal(event.evidenceWorkRequeued, true);
  assert.equal(event.changeIsNotAGameFact, true);
  assert.notEqual(event.baselineBinding.queryResultFingerprint, event.currentBinding.queryResultFingerprint);
  assert.equal(event.baselineBinding.queryDefinitionFingerprint, event.currentBinding.queryDefinitionFingerprint);
  for (const field of eventContract.required) assert.ok(Object.hasOwn(event, field), `missing event field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `missing audit field ${field}`);
});

test('query, revision/content, and signal dimensions remain independently detectable', () => {
  const input = fixture();
  mutateChannel(input.current, 1, 'current_source_code_search', channel => {
    channel.queryDefinitions[0].searchText = 'revised exact search';
    channel.sourceBindings.push({ pageId: 44, title: 'Template:Example', sourceRevision: '123', sourceTimestamp: '2026-09-06T00:30:00Z', sourceUrl: 'https://oldschool.runescape.wiki/w/Template:Example', contentHash: 'a'.repeat(64), contentBytes: 100, matchedQueryKeys: [channel.queryDefinitions[0].queryKey] });
    channel.signalBindings.push({ signalKind: 'candidate', sourceRevision: '123' });
  });
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.records.length, 1);
  assert.deepEqual(built.records[0].changedDimensions, ['query_definition', 'source_revision_or_content', 'condition_matched_signal']);
  assert.equal(built.records[0].channelKey, 'current_source_code_search');
  assert.equal(built.audit.changeCoverage.dimensionCounts.query_definition, 1);
  assert.equal(built.audit.changeCoverage.dimensionCounts.source_revision_or_content, 1);
  assert.equal(built.audit.changeCoverage.dimensionCounts.condition_matched_signal, 1);
});

test('artifact-only registry provenance change creates no event', () => {
  const input = fixture();
  mutateChannel(input.current, 2, 'current_article_search', channel => {
    channel.artifactProvenance.reportContentHash = 'b'.repeat(64);
    channel.artifactProvenance.snapshotContentHash = 'c'.repeat(64);
  });
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.changeCoverage.provenanceOnlyChangeCount, 1);
  assert.equal(built.audit.routingCoverage.unchangedEvaluationPublishedAsEmptyEventSet, true);
});

test('historical change event cannot bypass current-head reconciliation', () => {
  const input = fixture();
  mutateChannel(input.current, 3, 'historical_update_archive_search', channel => {
    channel.queryResults[0].reportedTotalHits = 1;
    channel.queryResults[0].fetchedResultCount = 1;
    channel.queryResults[0].resultPageIds = [112];
    channel.queryResults[0].resultSetHash = hash([112]);
  });
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.records.length, 1);
  assert.equal(built.records[0].channelKey, 'historical_update_archive_search');
  assert.equal(built.records[0].currentHeadReconciliationRequiredBeforeReview, true);
  assert.equal(built.records[0].route, registryPolicy.channelChangeRoutes.historical_update_archive_search);
  assert.equal(built.audit.routingCoverage.historicalRoutesRequireCurrentHeadReconciliation, true);
});

test('multiple independent changes emit one event per changed domain-channel pair', () => {
  const input = fixture();
  mutateChannel(input.current, 0, 'current_article_search', channel => { channel.queryResults[0].resultSetHash = hash(['a']); });
  mutateChannel(input.current, 0, 'current_source_code_search', channel => { channel.queryResults[0].resultSetHash = hash(['b']); });
  mutateChannel(input.current, 4, 'current_article_search', channel => { channel.queryResults[0].resultSetHash = hash(['c']); });
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.records.length, 3);
  assert.equal(built.audit.changeCoverage.affectedMonitorCount, 2);
  assert.equal(built.audit.changeCoverage.affectedDomainChannelCount, 3);
  assert.equal(new Set(built.records.map(record => `${record.monitorKey}|${record.channelKey}`)).size, 3);
});

test('current registry cannot predate its baseline', () => {
  const input = fixture();
  input.current.manifest.createdAt = '2025-01-01T00:00:00.000Z';
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.temporalOrdering.currentNotBeforeBaseline, false);
  assert.ok(built.audit.blockers.includes('current_registry_predates_or_lacks_valid_baseline_time'));
});

test('monitor population drift fails closed instead of emitting guessed events', () => {
  const input = fixture();
  const records = input.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
  records[0].monitorKey = 'replacement-monitor';
  records[0] = rehashRecord(records[0]);
  refreshInput(input.current, records);
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.records.length, 0);
  assert.equal(built.audit.populationContinuity.monitorKeySetsMatch, false);
  assert.ok(built.audit.blockers.includes('registry_monitor_or_channel_population_changed_fail_closed'));
});

test('tampered registry raw payload fails even when its manifest hash is updated', () => {
  const input = fixture();
  const records = input.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
  records[0].candidateName = 'Tampered without record rehash';
  refreshInput(input.current, records);
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.audit.inputIntegrity.current.checks.recordHashesValid, false);
  assert.ok(built.audit.blockers.includes('current_registry_integrity_failed:recordHashesValid'));
});

test('internally inconsistent fingerprints fail closed', () => {
  const input = fixture();
  const records = input.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
  records[0].channelMonitors[0].queryResultFingerprint = 'f'.repeat(64);
  records[0] = rehashRecord(records[0]);
  refreshInput(input.current, records);
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.audit.inputIntegrity.current.checks.channelFingerprintsValid, false);
});

test('account state in an input registry is rejected', () => {
  const input = fixture();
  const records = input.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
  records[0].accountState = { username: 'forbidden' };
  records[0] = rehashRecord(records[0]);
  refreshInput(input.current, records);
  input.current.report.blockerPreservation.accountStateFindingCount = 1;
  input.current.manifest.source.audit.blockerPreservation.accountStateFindingCount = 1;
  input.current.report.contentHash = hash({ ...input.current.report, contentHash: undefined });
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.audit.inputIntegrity.current.checks.reportSafetyGatesRemainClosed, false);
});

test('policy cannot carry candidate, blocker, or automatic-approval exceptions', () => {
  for (const mutation of [
    value => { value.candidateKeys = ['special-case']; },
    value => { value.blockers = ['silently-close']; },
    value => { value.rules.automaticVerificationAllowed = true; }
  ]) {
    const altered = structuredClone(policy);
    mutation(altered);
    assert.equal(compileAgilityTargetConditionGapSourceChannelChangeEvaluationPolicy(altered).valid, false);
  }
});

test('mutated output events cannot promote facts or optimizer state', () => {
  const input = fixture();
  mutateChannel(input.current, 0, 'current_article_search', channel => { channel.queryResults[0].resultSetHash = hash(['changed']); });
  const built = buildAgilityTargetConditionGapSourceChannelChangeEvaluation(input);
  const records = structuredClone(built.records);
  records[0].semanticFactsCreated = 1;
  records[0].optimizerEligible = true;
  records[0] = rehashRecord(records[0]);
  const audit = auditAgilityTargetConditionGapSourceChannelChangeEvaluation(records, input);
  assert.equal(audit.publishable, false);
  assert.equal(audit.blockerPreservation.semanticFactsCreated, 1);
  assert.equal(audit.blockerPreservation.optimizerEligibleCount, 1);
  assert.ok(audit.blockers.includes('change_evaluation_created_semantic_optimizer_account_or_authority_state'));
});

function writeRegistryInput(root, label, input) {
  const directory = path.join(root, input.snapshotDirectory);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify(input.manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, `${input.manifest.domain}.ndjson`), input.raw);
  const reportFile = path.join(root, `${label}-report.json`);
  fs.writeFileSync(reportFile, `${JSON.stringify(input.report, null, 2)}\n`);
  return { directory, reportFile };
}

test('CLI rejects missing inputs and deterministically materializes unchanged and changed evaluations', () => {
  const command = 'platform/transforms/evaluate-agility-target-condition-gap-source-channel-changes.mjs';
  const missing = spawnSync(process.execPath, [command], { cwd: process.cwd(), encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(`${missing.stdout}${missing.stderr}`, /Provide --baseline-report/);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-change-eval-'));
  try {
    const input = fixture();
    const baseline = writeRegistryInput(temp, 'baseline', input.baseline);
    const current = writeRegistryInput(temp, 'current', input.current);
    const root = path.join(temp, 'unchanged-output');
    const args = [command, `--root=${root}`, `--baseline-report=${baseline.reportFile}`, `--baseline-snapshot=${baseline.directory}`, `--current-report=${current.reportFile}`, `--current-snapshot=${current.directory}`];
    const first = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    const second = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const firstJson = JSON.parse(first.stdout);
    const secondJson = JSON.parse(second.stdout);
    assert.equal(firstJson.outputSnapshot.records, 0);
    assert.equal(firstJson.outputSnapshot.contentHash, secondJson.outputSnapshot.contentHash);
    assert.equal(firstJson.audit.changeCoverage.changeDetected, false);

    mutateChannel(input.current, 0, 'current_article_search', channel => { channel.queryResults[0].resultSetHash = hash(['new-result']); });
    const changedCurrent = writeRegistryInput(temp, 'changed-current', input.current);
    const changedArgs = [command, `--root=${path.join(temp, 'changed-output')}`, `--baseline-report=${baseline.reportFile}`, `--baseline-snapshot=${baseline.directory}`, `--current-report=${changedCurrent.reportFile}`, `--current-snapshot=${changedCurrent.directory}`];
    const changed = spawnSync(process.execPath, changedArgs, { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(changed.status, 0, changed.stderr || changed.stdout);
    const changedJson = JSON.parse(changed.stdout);
    assert.equal(changedJson.outputSnapshot.records, 1);
    assert.equal(changedJson.audit.changeCoverage.changeEventCount, 1);
    assert.equal(changedJson.audit.blockerPreservation.semanticFactsCreated, 0);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
