import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  auditAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation,
  buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation,
  compileAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluationPolicy
} from '../transforms/agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-lib.mjs';

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

const policy = JSON.parse(fs.readFileSync(new URL('../policies/agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-v1.json', import.meta.url), 'utf8'));
const registryPolicy = JSON.parse(fs.readFileSync(new URL('../policies/agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-v1.json', import.meta.url), 'utf8'));
const eventContract = JSON.parse(fs.readFileSync(new URL('../contracts/agility-colossal-wyrm-termite-reward-rate-source-change-event-v1.json', import.meta.url), 'utf8'));
const auditContract = JSON.parse(fs.readFileSync(new URL('../contracts/agility-colossal-wyrm-termite-reward-rate-source-change-evaluation-audit-v1.json', import.meta.url), 'utf8'));
assert.equal(hash(registryPolicy), policy.inputPolicyContentHash);

const queryCounts = [7, 10, 7, 7, 8, 8];
const sourceCounts = [51, 60, 60, 55, 64, 63];
const sourceOffsets = [0, 11, 5, 16, 7, 8];
const signalCounts = [3, 5, 7, 3, 5, 7];

function aggregateFingerprints(record) {
  const queryDefinitionFingerprint = hash(record.queryMonitors.map(monitor => ({ monitorKey: monitor.monitorKey, fingerprint: monitor.queryDefinitionFingerprint })));
  const queryResultFingerprint = hash(record.queryMonitors.map(monitor => ({ monitorKey: monitor.monitorKey, fingerprint: monitor.queryResultFingerprint })));
  const sourceRevisionContentFingerprint = hash(record.sourceMonitors.map(monitor => ({ monitorKey: monitor.monitorKey, fingerprint: monitor.sourceRevisionContentFingerprint })));
  const signalFingerprint = hash(record.signalMonitors.map(monitor => ({ monitorKey: monitor.monitorKey, fingerprint: monitor.signalFingerprint })));
  const sufficiencyDispositionFingerprint = hash({
    evidenceObjective: record.evidenceObjective,
    requiredEvidenceShape: record.requiredEvidenceShape,
    sufficiencyDisposition: record.sufficiencyDisposition,
    manualSemanticReviewRequired: record.manualSemanticReviewRequired,
    nextEvidenceWork: [...record.nextEvidenceWork]
  });
  return {
    queryDefinitionFingerprint,
    queryResultFingerprint,
    sourceRevisionContentFingerprint,
    signalFingerprint,
    sufficiencyDispositionFingerprint,
    evidenceFingerprint: hash({
      queryDefinitionFingerprint, queryResultFingerprint, sourceRevisionContentFingerprint,
      signalFingerprint, sufficiencyDispositionFingerprint
    })
  };
}

function registryRecord(index) {
  const blocker = `fixture_open_reward_blocker_${index}`;
  const evidenceObjective = `fixture_evidence_objective_${index % 3}`;
  const queryMonitors = Array.from({ length: queryCounts[index] }, (_, queryIndex) => {
    const channelKey = ['article', 'source_code', 'update', 'talk'][queryIndex % 4];
    const queryKey = `${channelKey}-fixture-${index}-${queryIndex}`;
    const definition = { queryKey, channelKey, searchText: `fixture ${index} ${queryIndex}`, maxResults: 50, namespaces: [queryIndex % 4] };
    const result = { queryKey, reportedTotalHits: 1, fetchedResultCount: 1, resultPageIds: [1000 + queryIndex], resultSetHash: hash([1000 + queryIndex]), paginationComplete: true, truncated: false };
    return { monitorKey: `${channelKey}|${queryKey}`, definition, result, queryDefinitionFingerprint: hash(definition), queryResultFingerprint: hash(result) };
  }).sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
  const sourceMonitors = Array.from({ length: sourceCounts[index] }, (_, sourceIndexWithinRecord) => {
    const sourceIndex = (sourceOffsets[index] + sourceIndexWithinRecord) % 71;
    const source = {
      pageId: 2000 + sourceIndex,
      namespaceId: 0,
      title: `Fixture source ${sourceIndex}`,
      sourceRevision: String(15300000 + sourceIndex),
      sourceTimestamp: '2026-09-06T00:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/Fixture_source_${sourceIndex}`,
      contentHash: hash(`fixture source ${sourceIndex}`),
      contentBytes: 1000 + sourceIndex,
      matchedChannelKeys: ['article'],
      matchedQueryKeys: [queryMonitors[sourceIndexWithinRecord % queryMonitors.length].definition.queryKey],
      exactSearchIdentityResolved: true,
      excludedFromEvidence: false
    };
    return { monitorKey: `${source.pageId}|${source.sourceRevision}`, source, sourceRevisionContentFingerprint: hash(source) };
  }).sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
  const signalMonitors = Array.from({ length: signalCounts[index] }, (_, signalIndex) => {
    const source = sourceMonitors[signalIndex].source;
    const assessment = {
      signalKind: 'course_duration_or_lap_context',
      semanticDisposition: 'current_condition_context',
      authorityDisposition: 'current_article_subject_to_required_shape_review',
      requiredShapeKind: false,
      acceptedCurrentAuthority: true,
      resolutionCandidate: false,
      disposition: 'corroborating_context_not_resolution',
      source: { ...source, line: signalIndex + 1, excerpt: `fixture signal ${index}-${signalIndex}`, sourceChannel: 'article', authorityClass: 'current_article' }
    };
    const signalFingerprint = hash(assessment);
    return { monitorKey: signalFingerprint, assessment, signalFingerprint };
  }).sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
  const nextEvidenceWork = ['collect_revision_pinned_fixture_evidence', 'monitor_all_discovered_source_revisions', 'rerun_the_same_policy_bound_queries_on_relevant_source_change'];
  const base = {
    contract: policy.inputRecordContract,
    monitorKey: hash({ blocker, evidenceObjective }),
    field: index % 2 ? 'bone_shards' : 'termites',
    route: index < 2 ? 'basic_route' : 'advanced_route',
    blocker,
    evidenceObjective,
    requiredEvidenceShape: 'A current, revision-pinned, condition-correct fixture fact.',
    sufficiencyDisposition: 'blocked_required_evidence_shape_not_found_in_declared_bounded_discovery',
    manualSemanticReviewRequired: false,
    existingBlockerStatus: 'open',
    inputLineage: {
      discovery: { auditContentHash: hash('discovery audit'), snapshotDirectory: 'discovery', snapshotContentHash: hash('discovery snapshot') },
      sufficiency: { auditContentHash: hash('sufficiency audit'), snapshotDirectory: 'sufficiency', snapshotContentHash: hash('sufficiency snapshot') }
    },
    queryMonitors,
    sourceMonitors,
    signalMonitors,
    fingerprints: null,
    monitoringState: 'baseline_registered_no_change',
    changeDetected: false,
    changeEvents: [],
    nextEvidenceWork,
    existingBlockerPreserved: true,
    mechanicallyResolved: false,
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligible: false,
    verifiedBestAuthorized: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false
  };
  base.fingerprints = aggregateFingerprints(base);
  return withHashes(base);
}

function registryAudit(records) {
  const queryBindings = records.reduce((sum, record) => sum + record.queryMonitors.length, 0);
  const sourceBindings = records.reduce((sum, record) => sum + record.sourceMonitors.length, 0);
  const distinctSources = new Set(records.flatMap(record => record.sourceMonitors.map(source => source.monitorKey))).size;
  const signalBindings = records.reduce((sum, record) => sum + record.signalMonitors.length, 0);
  return {
    contract: policy.inputAuditContract,
    policyValidation: { valid: true },
    inputLineage: { valid: true },
    registryCoverage: {
      blockerMonitorCount: records.length,
      queryBindingCount: queryBindings,
      sourceBindingOccurrenceCount: sourceBindings,
      distinctSourceRevisionCount: distinctSources,
      signalBindingCount: signalBindings,
      blockerSetExact: true,
      everySignalSourceBoundToDiscoveredRevision: true,
      everyDiscoveredSourceOccurrenceMonitored: true,
      expectedCountsMatch: true
    },
    fingerprintCoverage: { allFingerprintsValid: true, evidenceDimensionsSeparated: true },
    routingSafety: { baselineChangeCount: 0, targetedBlockerRoutingSupported: true, artifactProvenanceExcludedFromEvidenceFingerprints: true, structuralDriftFailsClosed: true },
    authorityBoundary: { openBlockers: records.length, mechanicallyResolvedBlockers: 0, blockersClosed: 0, semanticFactsCreated: 0, optimizerEligibleRecords: 0, verifiedBestAuthorizations: 0, automaticVerifications: 0, accountStateFindingCount: 0, completeWikiUniverseClaims: 0 },
    recordsMatchExpected: true,
    recordHashesValid: true,
    registryComplete: true,
    mechanicalCompletenessProven: false,
    completeWikiUniverse: false,
    absoluteBestGate: 'blocked_colossal_wyrm_reward_mechanics_not_authoritative',
    publishable: true,
    blockers: []
  };
}

function registrySnapshot(label, createdAt, records) {
  const raw = `${records.map(record => json(record)).join('\n')}\n`;
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
    inputs: {},
    outputSnapshot: { directory: label, contentHash: manifest.contentHash, records: records.length }
  };
  return { report: { ...reportBase, contentHash: hash(reportBase) }, manifest, raw, snapshotDirectory: label };
}

function fixture() {
  const records = Array.from({ length: 6 }, (_, index) => registryRecord(index));
  return {
    baseline: registrySnapshot('baseline-registry', '2026-09-06T00:00:00.000Z', records),
    current: registrySnapshot('current-registry', '2026-09-06T01:00:00.000Z', structuredClone(records)),
    policy: structuredClone(policy),
    registryPolicy: structuredClone(registryPolicy),
    contentHash: hash
  };
}

function recomputeRecord(record) {
  for (const monitor of record.queryMonitors) {
    monitor.queryDefinitionFingerprint = hash(monitor.definition);
    monitor.queryResultFingerprint = hash(monitor.result);
  }
  for (const monitor of record.sourceMonitors) {
    monitor.monitorKey = `${monitor.source.pageId}|${monitor.source.sourceRevision}`;
    monitor.sourceRevisionContentFingerprint = hash(monitor.source);
  }
  for (const monitor of record.signalMonitors) {
    monitor.signalFingerprint = hash(monitor.assessment);
    monitor.monitorKey = monitor.signalFingerprint;
  }
  record.queryMonitors.sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
  record.sourceMonitors.sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
  record.signalMonitors.sort((left, right) => left.monitorKey.localeCompare(right.monitorKey));
  record.fingerprints = aggregateFingerprints(record);
  return withHashes(record);
}

function refreshSnapshot(input, records) {
  const replacement = registrySnapshot(input.snapshotDirectory, input.manifest.createdAt, records);
  Object.assign(input, replacement);
}

const compiled = compileAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluationPolicy(policy, registryPolicy, hash);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.forbiddenSelectors, []);

const unchanged = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(fixture());
assert.equal(unchanged.audit.publishable, true);
assert.equal(unchanged.audit.changeEvaluationComplete, true);
assert.equal(unchanged.records.length, 0);
assert.equal(unchanged.audit.changeCoverage.changeDetected, false);
assert.equal(unchanged.audit.changeCoverage.changeEventCount, 0);
assert.equal(unchanged.audit.populationContinuity.monitorKeySetsMatch, true);
assert.equal(unchanged.audit.routingCoverage.unchangedEvaluationPublishedAsEmptyEventSet, true);
for (const field of auditContract.required) assert.ok(Object.hasOwn(unchanged.audit, field), `missing audit field ${field}`);

const changedInput = fixture();
const changedRecords = changedInput.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
changedRecords[0].queryMonitors[0].result.reportedTotalHits += 1;
changedRecords[0].queryMonitors[0].result.resultSetHash = hash(['changed']);
changedRecords[0].sourceMonitors[0].source.contentHash = hash('changed source content');
changedRecords[0].signalMonitors[0].assessment.source.excerpt = 'Changed source signal context.';
changedRecords[0].sufficiencyDisposition = 'blocked_potential_resolution_evidence_requires_manual_semantic_review';
changedRecords[0].manualSemanticReviewRequired = true;
changedRecords[0] = recomputeRecord(changedRecords[0]);
refreshSnapshot(changedInput.current, changedRecords);
const changed = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(changedInput);
assert.equal(changed.audit.publishable, true);
assert.equal(changed.records.length, 1);
assert.deepEqual(changed.records[0].changedDimensions, ['query_result_set', 'source_revision_or_content', 'classified_signal', 'sufficiency_disposition']);
assert.equal(changed.records[0].changeRoute, registryPolicy.changeRoute);
assert.equal(changed.records[0].changeIsNotAGameFact, true);
assert.equal(changed.records[0].requiresDiscoveryAndSufficiencyRerun, true);
assert.equal(changed.records[0].existingBlockerStatus, 'open');
assert.equal(changed.records[0].semanticFactsCreated, 0);
for (const field of eventContract.required) assert.ok(Object.hasOwn(changed.records[0], field), `missing event field ${field}`);

const provenanceInput = fixture();
const provenanceRecords = provenanceInput.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
provenanceRecords[1].inputLineage.sufficiency.auditContentHash = hash('new report artifact, same evidence');
provenanceRecords[1] = withHashes(provenanceRecords[1]);
refreshSnapshot(provenanceInput.current, provenanceRecords);
const provenanceOnly = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(provenanceInput);
assert.equal(provenanceOnly.audit.publishable, true);
assert.equal(provenanceOnly.records.length, 0);
assert.equal(provenanceOnly.audit.changeCoverage.provenanceOnlyChangeCount, 1);

const olderCurrent = fixture();
olderCurrent.current.manifest.createdAt = '2025-01-01T00:00:00.000Z';
const older = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(olderCurrent);
assert.equal(older.audit.publishable, false);
assert.ok(older.audit.blockers.includes('current_registry_predates_or_lacks_valid_baseline_time'));

const populationInput = fixture();
const fewerRecords = populationInput.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse).slice(1);
refreshSnapshot(populationInput.current, fewerRecords);
const population = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(populationInput);
assert.equal(population.audit.publishable, false);
assert.ok(population.audit.blockers.includes('registry_monitor_population_changed_fail_closed'));

const tamperedInput = fixture();
const tamperedRecords = tamperedInput.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
tamperedRecords[0].sourceMonitors[0].source.contentHash = hash('tampered without nested fingerprint');
tamperedRecords[0] = withHashes(tamperedRecords[0]);
refreshSnapshot(tamperedInput.current, tamperedRecords);
const tampered = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(tamperedInput);
assert.equal(tampered.audit.publishable, false);
assert.equal(tampered.audit.inputIntegrity.current.checks.recordAndNestedHashesValid, false);

const promoted = structuredClone(changed.records);
promoted[0].optimizerEligible = true;
promoted[0].semanticFactsCreated = 1;
promoted[0] = withHashes(promoted[0]);
const promotionAudit = auditAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(promoted, changedInput);
assert.equal(promotionAudit.publishable, false);
assert.ok(promotionAudit.blockers.includes('change_evaluation_created_fact_mechanic_optimizer_account_or_authority_state'));

const accountInput = fixture();
const accountRecords = accountInput.current.raw.trimEnd().split(/\r?\n/).map(JSON.parse);
accountRecords[0].accountState = { username: 'forbidden' };
accountRecords[0] = withHashes(accountRecords[0]);
refreshSnapshot(accountInput.current, accountRecords);
const account = buildAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluation(accountInput);
assert.equal(account.audit.publishable, false);
assert.equal(account.audit.inputIntegrity.current.checks.noAccountState, false);

for (const mutation of [
  value => { value.blockers = ['special-case']; },
  value => { value.rules.automaticVerificationAllowed = true; },
  value => { value.expectedBlockerMonitorCount = 5; }
]) {
  const altered = structuredClone(policy);
  mutation(altered);
  assert.equal(compileAgilityColossalWyrmTermiteRewardRateSourceChangeEvaluationPolicy(altered, registryPolicy, hash).valid, false);
}

function writeRegistryInput(root, label, input) {
  const directory = path.join(root, input.snapshotDirectory);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify(input.manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, `${input.manifest.domain}.ndjson`), input.raw);
  const reportFile = path.join(root, `${label}-report.json`);
  fs.writeFileSync(reportFile, `${JSON.stringify(input.report, null, 2)}\n`);
  return { directory, reportFile };
}

const command = 'platform/transforms/evaluate-agility-colossal-wyrm-termite-reward-rate-source-changes.mjs';
const missing = spawnSync(process.execPath, [command], { cwd: process.cwd(), encoding: 'utf8' });
assert.notEqual(missing.status, 0);
assert.match(`${missing.stdout}${missing.stderr}`, /--baseline-report/);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-wyrm-change-eval-'));
try {
  const input = fixture();
  const baseline = writeRegistryInput(temporary, 'baseline', input.baseline);
  const current = writeRegistryInput(temporary, 'current', input.current);
  const args = [
    command,
    `--root=${path.join(temporary, 'output')}`,
    `--baseline-report=${baseline.reportFile}`,
    `--baseline-snapshot=${baseline.directory}`,
    `--current-report=${current.reportFile}`,
    `--current-snapshot=${current.directory}`
  ];
  const first = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
  const second = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const firstOutput = JSON.parse(first.stdout);
  const secondOutput = JSON.parse(second.stdout);
  assert.equal(firstOutput.outputSnapshot.records, 0);
  assert.equal(firstOutput.outputSnapshot.contentHash, secondOutput.outputSnapshot.contentHash);
  assert.equal(firstOutput.audit.changeCoverage.changeEventCount, 0);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('Colossal Wyrm termite and reward-rate source change evaluation checks passed.');
