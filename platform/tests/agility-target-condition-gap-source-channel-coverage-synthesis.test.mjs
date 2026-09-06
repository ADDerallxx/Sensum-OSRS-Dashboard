import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hash, json } from '../ingestion/lib.mjs';
import {
  auditAgilityTargetConditionGapSourceChannelCoverageSynthesis,
  buildAgilityTargetConditionGapSourceChannelCoverageSynthesis
} from '../transforms/agility-target-condition-gap-source-channel-coverage-synthesis-lib.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = readJson('platform/policies/agility-target-condition-gap-source-channel-coverage-synthesis-v1.json');
const basePolicy = readJson('platform/policies/agility-target-condition-gap-wiki-discovery-v1.json');
const recordContract = readJson('platform/contracts/agility-target-condition-gap-source-channel-coverage-synthesis-v1.json');
const auditContract = readJson('platform/contracts/agility-target-condition-gap-source-channel-coverage-synthesis-audit-v1.json');
const coverageHash = '7'.repeat(64);
const sufficiencyHash = '6'.repeat(64);

function upstreamRecord(channel, candidate, withCurrentSignal = false) {
  const queries = basePolicy.queries.filter(query => query.candidateKey === candidate.candidateKey);
  const signalQueryKey = 'shayzien-rate-alignment';
  const searchQueries = queries.map(query => {
    const signalled = withCurrentSignal && query.queryKey === signalQueryKey;
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
    const domainQueries = queries.filter(query => query.blocker === blocker);
    const signalled = withCurrentSignal && domainQueries.some(query => query.queryKey === signalQueryKey);
    return {
      blocker,
      diagnosticKinds: [...new Set(domainQueries.map(query => query.diagnosticKind))].sort(),
      queryKeys: domainQueries.map(query => query.queryKey).sort(),
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
    discoveredPages: withCurrentSignal ? [{ pageId: 9001, title: 'Shayzien Agility Course', sourceRevision: '15168110', matchedQueryKeys: [signalQueryKey] }] : [],
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
  if (channel.channelKey === 'historical_update_archive_search') {
    Object.assign(base, {
      sourceTemporalClass: 'historical_update_archive',
      currentStateAuthority: false,
      historicalSignalsRequireCurrentHeadReconciliation: true,
      historicalSignalCount: 0,
      currentHeadReconciliationRequiredCount: 0,
      currentFactApplications: 0
    });
  }
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function finalizeChannel(channel, records, index) {
  const rawRecords = `${records.map(json).join('\n')}\n`;
  const snapshotDirectory = `synthetic-channel-${index}`;
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
    queryCoverage: {
      declaredQueryCount: 27,
      responseCount: 27,
      querySetMatches: true,
      queryDefinitionsMatch: true,
      queriesCompleteWithinBound: true,
      totalSearchResultOccurrences: signalCount
    },
    evidenceDomainCoverage: {
      blockerCount: 17,
      potentialEvidenceSignalCount: signalCount,
      manualReauditCandidateCount: signalCount ? 1 : 0,
      unresolvedDomainCount: 17 - signalCount
    },
    blockerPreservation: {
      preserved: true,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligibleCount: 0,
      automaticVerificationCount: 0,
      accountStateFindingCount: 0,
      completeWikiUniverseClaimCount: 0
    },
    outputSnapshot: { directory: snapshotDirectory, contentHash: manifest.contentHash }
  };
  const report = { ...reportBase, contentHash: hash(reportBase) };
  return { report, manifest, rawRecords, snapshotDirectory };
}

function fixture() {
  const inputs = {};
  policy.inputChannels.forEach((channel, index) => {
    const records = basePolicy.candidates.map(candidate => upstreamRecord(
      channel,
      candidate,
      channel.channelKey === 'current_article_search' && candidate.candidateKey.includes('Shayzien')
    ));
    inputs[channel.channelKey] = finalizeChannel(channel, records, index);
  });
  return { inputs, policy: structuredClone(policy), basePolicy: structuredClone(basePolicy), contentHash: hash };
}

function parsedRecords(input) {
  return input.rawRecords.trim().split(/\r?\n/).map(JSON.parse);
}

function rehashInput(input, records) {
  for (let index = 0; index < records.length; index += 1) {
    const base = Object.fromEntries(Object.entries(records[index]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)));
    const withRecordHash = { ...base, recordContentHash: hash(base) };
    records[index] = { ...withRecordHash, contentHash: hash(withRecordHash) };
  }
  input.rawRecords = `${records.map(json).join('\n')}\n`;
  input.manifest.contentHash = hash(input.rawRecords);
  input.manifest.records = records.length;
  input.report.outputSnapshot.contentHash = input.manifest.contentHash;
  input.report.evidenceDomainCoverage.blockerCount = records.reduce((sum, record) => sum + record.evidenceDomains.length, 0);
  input.report.evidenceDomainCoverage.potentialEvidenceSignalCount = records.reduce((sum, record) => sum + record.evidenceDomains.reduce((inner, domain) => inner + domain.potentialEvidenceSignals.length, 0), 0);
  input.report.contentHash = hash({ ...input.report, contentHash: undefined });
}

test('policy binds exactly three source channels and forbids absence or authority overclaims', () => {
  assert.deepEqual(policy.inputChannels.map(channel => channel.channelKey), [
    'current_article_search',
    'current_source_code_search',
    'historical_update_archive_search'
  ]);
  assert.deepEqual(policy.inputChannels.map(channel => channel.namespaces), [[0], [10, 116, 828], [112]]);
  assert.equal(policy.rules.boundedSearchSilenceCannotProveWikiOrGameFactAbsence, true);
  assert.equal(policy.rules.baseDiscoveryPolicyHashAndScopeMustValidate, true);
  assert.equal(policy.rules.historicalSignalsRequireCurrentHeadReconciliation, true);
  assert.equal(policy.rules.signalsCannotCloseBlockersOrCreateFacts, true);
  assert.equal(policy.rules.optimizerEligibilityAndVerifiedBestAreForbidden, true);
  assert.equal(policy.rules.automaticVerificationAllowed, false);
});

test('synthesizes one complete three-channel record for every blocker', () => {
  const built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(fixture());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.sourceChannelSynthesisComplete, true);
  assert.equal(built.records.length, 17);
  assert.equal(new Set(built.records.map(record => record.candidateKey)).size, 5);
  assert.equal(built.audit.queryCoverage.totalBoundedQueryExecutions, 81);
  assert.equal(built.audit.queryCoverage.queryDefinitionsMatchAcrossChannels, true);
  assert.equal(built.audit.candidateCoverage.candidateSetsMatchAcrossChannels, true);
  assert.equal(built.audit.candidateCoverage.blockerSetsMatchAcrossChannels, true);
  assert.equal(built.audit.candidateCoverage.candidateSetsMatchBoundBasePolicy, true);
  assert.equal(built.audit.candidateCoverage.blockerSetsMatchBoundBasePolicy, true);
  assert.equal(built.audit.queryCoverage.queryDefinitionsMatchBoundBasePolicy, true);
  assert.equal(built.audit.candidateCoverage.everyBlockerHasExactlyOneDomainPerChannel, true);
  assert.ok(built.records.every(record => record.channels.length === 3 && record.channels.every(channel => channel.searchComplete)));
  for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing synthesis field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing synthesis audit field ${field}`);
});

test('separates the current review signal from sixteen no-signal evidence routes', () => {
  const built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(fixture());
  assert.equal(built.audit.evidenceDomainCoverage.currentSignalCount, 1);
  assert.equal(built.audit.evidenceDomainCoverage.historicalSignalCount, 0);
  assert.equal(built.audit.evidenceDomainCoverage.manualReviewDomainCount, 1);
  assert.equal(built.audit.evidenceDomainCoverage.noConditionMatchedSignalDomainCount, 16);
  assert.equal(built.audit.routeCoverage.currentSignalReviewRoutes, 1);
  assert.equal(built.audit.routeCoverage.historicalReconciliationRoutes, 0);
  assert.equal(built.audit.routeCoverage.monitoringAndAdditionalEvidenceRoutes, 16);
  const review = built.records.find(record => record.currentSignals.length);
  assert.equal(review.blocker, 'supporting_rate_matches_superseded_pre_update_value');
  assert.equal(review.nextAction, policy.routes.currentSignal);
  assert.equal(review.currentSignals[0].sourceRevision, '15168110');
  assert.equal(review.currentSignals[0].line, 100);
  assert.equal(review.currentSignals[0].currentStateAuthority, false);
  assert.equal(review.currentSignals[0].manualSemanticReviewRequired, true);
  assert.ok(built.records.filter(record => !record.currentSignals.length).every(record => record.nextAction === policy.routes.noSignal));
});

test('a historical-only signal requires current-head reconciliation and never gains authority', () => {
  const input = fixture();
  const update = input.inputs.historical_update_archive_search;
  const records = parsedRecords(update);
  const target = records.find(record => record.candidateKey === 'guide:rooftop:al-kharid');
  const domain = target.evidenceDomains.find(entry => entry.blocker === 'tightrope_1_success_probability_at_base_level_34_not_published');
  domain.potentialEvidenceSignals.push({
    signalKind: 'target_numeric_probability',
    pageId: 77,
    title: 'Update:Historical course change',
    sourceRevision: '14000000',
    sourceUrl: 'https://oldschool.runescape.wiki/w/Update:Historical_course_change',
    line: 12,
    excerpt: 'Historical candidate wording.',
    queryKeys: ['al-tightrope-chance-exact'],
    sourceTemporalClass: 'historical_update_archive',
    temporalDisposition: 'historical_signal_requires_current_head_reconciliation',
    currentStateAuthority: false,
    currentHeadReconciliationRequired: true,
    mayApplyCurrentFact: false
  });
  target.historicalSignalCount = 1;
  target.currentHeadReconciliationRequiredCount = 1;
  rehashInput(update, records);
  const built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(input);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.evidenceDomainCoverage.historicalSignalCount, 1);
  assert.equal(built.audit.routeCoverage.historicalReconciliationRoutes, 1);
  const result = built.records.find(record => record.candidateKey === target.candidateKey && record.blocker === domain.blocker);
  assert.equal(result.nextAction, policy.routes.historicalSignalOnly);
  assert.equal(result.historicalSignals[0].currentHeadReconciliationRequired, true);
  assert.equal(result.historicalSignals[0].currentStateAuthority, false);
  assert.equal(result.blockersClosed, 0);
  assert.equal(result.semanticFactsCreated, 0);
});

test('missing or tampered reports and snapshots fail closed without synthesis records', () => {
  const missing = fixture();
  delete missing.inputs.current_source_code_search;
  let built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(missing);
  assert.equal(built.audit.publishable, false);
  assert.deepEqual(built.records, []);
  assert.ok(built.audit.blockers.includes('input_channel_invalid:current_source_code_search'));

  const reportDrift = fixture();
  reportDrift.inputs.current_article_search.report.queryCoverage.responseCount = 26;
  built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(reportDrift);
  assert.equal(built.audit.publishable, false);
  assert.deepEqual(built.records, []);

  const payloadDrift = fixture();
  payloadDrift.inputs.current_article_search.rawRecords += '{}\n';
  built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(payloadDrift);
  assert.equal(built.audit.publishable, false);
  assert.deepEqual(built.records, []);
});

test('cross-channel candidate, blocker, and query-definition drift fail closed', () => {
  const blockerDrift = fixture();
  let records = parsedRecords(blockerDrift.inputs.current_source_code_search);
  records[0].evidenceDomains.pop();
  rehashInput(blockerDrift.inputs.current_source_code_search, records);
  let built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(blockerDrift);
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('input_channel_invalid:current_source_code_search'));
  assert.ok(built.audit.blockers.includes('blocker_sets_do_not_match_across_channels'));

  const queryDrift = fixture();
  records = parsedRecords(queryDrift.inputs.current_source_code_search);
  records[0].searchQueries[0].searchText = 'changed query';
  rehashInput(queryDrift.inputs.current_source_code_search, records);
  built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(queryDrift);
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('query_definitions_do_not_match_across_channels'));
});

test('three mutually consistent but base-policy-divergent inputs still fail closed', () => {
  const input = fixture();
  for (const channelInput of Object.values(input.inputs)) {
    const records = parsedRecords(channelInput);
    records[0].searchQueries[0].searchText = 'same tampered query in every channel';
    rehashInput(channelInput, records);
  }
  const built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(input);
  assert.equal(built.audit.publishable, false);
  assert.deepEqual(built.records, []);
  assert.equal(built.audit.queryCoverage.queryDefinitionsMatchAcrossChannels, true);
  assert.equal(built.audit.queryCoverage.queryDefinitionsMatchBoundBasePolicy, false);
  assert.ok(built.audit.blockers.includes('query_definitions_do_not_match_bound_base_policy'));
});

test('base-policy hash drift rejects the entire synthesis', () => {
  const input = fixture();
  input.basePolicy.queries[0].searchText = 'changed base policy';
  const built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(input);
  assert.equal(built.audit.publishable, false);
  assert.deepEqual(built.records, []);
  assert.equal(built.audit.candidateCoverage.basePolicyBindingValid, false);
  assert.ok(built.audit.invalidPolicyRules.includes('baseDiscoveryPolicyBinding'));
});

test('historical input without temporal gates is rejected atomically', () => {
  const input = fixture();
  const update = input.inputs.historical_update_archive_search;
  const records = parsedRecords(update);
  records[0].evidenceDomains[0].potentialEvidenceSignals.push({ signalKind: 'target_numeric_probability', sourceRevision: '1' });
  rehashInput(update, records);
  const built = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(input);
  assert.equal(built.audit.publishable, false);
  assert.deepEqual(built.records, []);
  const channel = built.audit.inputChannelCoverage.find(entry => entry.channelKey === 'historical_update_archive_search');
  assert.ok(channel.failures.includes('historical_input_missing_temporal_non_authority_gate'));
});

test('independent audit rejects blocker closure, optimizer authority, and account state', () => {
  const input = fixture();
  const valid = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(input);
  const changed = structuredClone(valid.records);
  changed[0].existingBlockerStatus = 'closed';
  changed[0].blockersClosed = 1;
  changed[0].semanticFactsCreated = 1;
  changed[0].optimizerEligible = true;
  changed[0].verifiedBestAuthorized = true;
  changed[0].currentBaseLevel = 34;
  const base = Object.fromEntries(Object.entries(changed[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key)));
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  changed[0] = { ...withRecordHash, contentHash: hash(withRecordHash) };
  const audit = auditAgilityTargetConditionGapSourceChannelCoverageSynthesis(changed, input);
  assert.equal(audit.publishable, false);
  assert.equal(audit.blockerPreservation.blockersClosed, 1);
  assert.equal(audit.blockerPreservation.semanticFactsCreated, 1);
  assert.equal(audit.blockerPreservation.optimizerEligibleCount, 1);
  assert.equal(audit.blockerPreservation.verifiedBestAuthorizationCount, 1);
  assert.ok(audit.blockerPreservation.accountStateFindingCount > 0);
  assert.ok(audit.blockers.includes('synthesis_changed_blocker_fact_or_optimizer_state'));
  assert.ok(audit.blockers.includes('account_state_present_in_account_independent_synthesis'));
});

test('identical explicit inputs reproduce identical records and audit', () => {
  const first = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(fixture());
  const second = buildAgilityTargetConditionGapSourceChannelCoverageSynthesis(fixture());
  assert.deepEqual(second, first);
});

test('CLI refuses implicit source reports and snapshots without writing output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-source-channel-synthesis-refusal-'));
  try {
    const command = spawnSync(process.execPath, [
      'platform/transforms/synthesize-agility-target-condition-gap-source-channel-coverage.mjs',
      `--root=${root}`
    ], { encoding: 'utf8' });
    assert.notEqual(command.status, 0);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Agility target-condition source-channel coverage synthesis checks passed.');
