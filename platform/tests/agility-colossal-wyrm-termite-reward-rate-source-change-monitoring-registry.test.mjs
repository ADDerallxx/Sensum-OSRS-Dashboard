import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  auditAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry,
  buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry,
  compileAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistryPolicy,
  detectAgilityColossalWyrmTermiteRewardRateSourceChanges
} from '../transforms/agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-lib.mjs';
import { buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition } from '../transforms/agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-lib.mjs';

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
const recordsHash = records => hash(`${records.map(record => json(record)).join('\n')}\n`);

const policy = JSON.parse(await fs.readFile(new URL('../policies/agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-v1.json', import.meta.url), 'utf8'));
const discoveryPolicy = JSON.parse(await fs.readFile(new URL('../policies/agility-colossal-wyrm-termite-reward-rate-source-discovery-v1.json', import.meta.url), 'utf8'));
const sufficiencyPolicy = JSON.parse(await fs.readFile(new URL('../policies/agility-colossal-wyrm-termite-reward-rate-source-sufficiency-disposition-v1.json', import.meta.url), 'utf8'));
const recordContract = JSON.parse(await fs.readFile(new URL('../contracts/agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-v1.json', import.meta.url), 'utf8'));
const auditContract = JSON.parse(await fs.readFile(new URL('../contracts/agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry-audit-v1.json', import.meta.url), 'utf8'));
assert.equal(hash(discoveryPolicy), policy.discoveryPolicyContentHash);
assert.equal(hash(sufficiencyPolicy), policy.sufficiencyPolicyContentHash);

const queryCounts = [7, 10, 7, 7, 8, 8];
const pageCounts = [51, 60, 60, 55, 64, 63];
const pageOffsets = [0, 11, 5, 16, 7, 8];
const signalKinds = [
  ['explicit_unknown_spawn_rate', 'official_relative_reward_adjustment', 'official_relative_reward_adjustment'],
  ['experimental_per_completion_average', 'current_scoop_range', 'course_duration_or_lap_context', 'official_relative_reward_adjustment', 'official_relative_reward_adjustment'],
  ['hourly_reward_claim', 'course_duration_or_lap_context', 'course_duration_or_lap_context', 'course_duration_or_lap_context', 'experimental_per_completion_average', 'official_relative_reward_adjustment', 'official_relative_reward_adjustment'],
  ['explicit_unknown_spawn_rate', 'official_relative_reward_adjustment', 'official_relative_reward_adjustment'],
  ['experimental_per_completion_average', 'current_scoop_range', 'course_duration_or_lap_context', 'official_relative_reward_adjustment', 'official_relative_reward_adjustment'],
  ['hourly_reward_claim', 'course_duration_or_lap_context', 'course_duration_or_lap_context', 'course_duration_or_lap_context', 'experimental_per_completion_average', 'official_relative_reward_adjustment', 'official_relative_reward_adjustment']
];

function authorityFor(kind) {
  if (kind === 'official_relative_reward_adjustment') return ['update', 'historical_update_archive'];
  if (kind === 'experimental_per_completion_average') return ['talk', 'experimental_discussion'];
  return ['article', 'current_article'];
}

function discoveryRecords() {
  return discoveryPolicy.domains.map((domain, domainIndex) => {
    const queries = Array.from({ length: queryCounts[domainIndex] }, (_, index) => {
      const channelKey = ['article', 'source_code', 'update', 'talk'][index % 4];
      const queryKey = `${channelKey}-fixture-${domainIndex}-${index}`;
      const resultPageIds = [1000 + ((pageOffsets[domainIndex] + index) % 71)];
      return {
        blocker: domain.blocker,
        channelKey,
        queryKey,
        searchText: `fixture search ${domainIndex} ${index}`,
        maxResults: 50,
        namespaces: channelKey === 'article' ? [0] : channelKey === 'update' ? [112] : channelKey === 'talk' ? [1] : [10, 116, 828],
        reportedTotalHits: resultPageIds.length,
        fetchedResultCount: resultPageIds.length,
        resultPageIds,
        resultSetHash: hash(resultPageIds),
        paginationComplete: true,
        truncated: false
      };
    });
    const pages = Array.from({ length: pageCounts[domainIndex] }, (_, index) => {
      const sourceIndex = (pageOffsets[domainIndex] + index) % 71;
      const query = queries[index % queries.length];
      return {
        pageId: 1000 + sourceIndex,
        namespaceId: query.namespaces[0],
        title: `Fixture source ${sourceIndex}`,
        sourceRevision: String(15300000 + sourceIndex),
        sourceTimestamp: '2026-09-06T00:00:00Z',
        sourceUrl: `https://oldschool.runescape.wiki/w/Fixture_source_${sourceIndex}`,
        contentHash: hash(`fixture source ${sourceIndex}`),
        contentBytes: 100 + sourceIndex,
        matchedChannelKeys: [query.channelKey],
        matchedQueryKeys: [query.queryKey],
        exactSearchIdentityResolved: true,
        excludedFromEvidence: query.channelKey === 'talk'
      };
    });
    const potentialEvidenceSignals = signalKinds[domainIndex].map((signalKind, index) => {
      const [sourceChannel, authorityClass] = authorityFor(signalKind);
      const page = pages[index];
      return {
        signalKind,
        pageId: page.pageId,
        title: page.title,
        sourceRevision: page.sourceRevision,
        sourceTimestamp: page.sourceTimestamp,
        sourceUrl: page.sourceUrl,
        line: index + 1,
        excerpt: `Fixture ${signalKind} evidence ${domainIndex}-${index}.`,
        sourceChannel,
        authorityClass,
        mechanicalAuthority: false,
        requiresManualSemanticReview: true
      };
    });
    return withHashes({
      contract: policy.discoveryRecordContract,
      field: domain.field,
      route: domain.route,
      blocker: domain.blocker,
      inputAuditContentHash: hash('fixture prior audit'),
      inputSnapshot: { directory: 'fixture-prior', contentHash: hash('fixture prior snapshot'), records: 4 },
      searchQueries: queries,
      discoveredPages: pages,
      potentialEvidenceSignals,
      disposition: 'blocked_pending_manual_semantic_reaudit',
      searchAbsenceScope: 'declared_bounded_queries_only',
      existingBlockerPreserved: true,
      mechanicallyResolved: false,
      blockersClosed: 0,
      semanticFactsCreated: 0,
      optimizerEligible: false,
      verifiedBestAuthorized: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      completeWikiUniverseClaimed: false
    });
  });
}

function inputs(records = discoveryRecords(), suffix = 'a') {
  const discoverySnapshotDirectory = `fixture-discovery-${suffix}`;
  const discoveryManifest = {
    contract: policy.inputManifestContract,
    domain: policy.discoveryDomain,
    createdAt: '2026-09-06T00:00:00Z',
    records: records.length,
    contentHash: recordsHash(records),
    snapshotDirectory: discoverySnapshotDirectory,
    source: { policy: { id: discoveryPolicy.policy, contentHash: hash(discoveryPolicy) } }
  };
  const signalCount = records.reduce((sum, record) => sum + record.potentialEvidenceSignals.length, 0);
  const discoveryAuditBase = {
    contract: policy.discoveryAuditContract,
    publishable: true,
    queryBoundedDiscoveryComplete: true,
    policy: { id: discoveryPolicy.policy, contentHash: hash(discoveryPolicy) },
    outputSnapshot: { directory: discoverySnapshotDirectory, contentHash: discoveryManifest.contentHash, records: records.length },
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
  const sufficiencyBuilt = buildAgilityColossalWyrmTermiteRewardRateSourceSufficiencyDisposition({
    discoveryAudit, discoveryManifest, discoveryRecords: records, inputPolicy: discoveryPolicy,
    policy: sufficiencyPolicy, contentHash: hash
  });
  assert.equal(sufficiencyBuilt.audit.publishable, true);
  const sufficiencySnapshotDirectory = `fixture-sufficiency-${suffix}`;
  const sufficiencyManifest = {
    contract: policy.inputManifestContract,
    domain: policy.sufficiencyDomain,
    createdAt: '2026-09-06T00:01:00Z',
    records: sufficiencyBuilt.records.length,
    contentHash: recordsHash(sufficiencyBuilt.records),
    snapshotDirectory: sufficiencySnapshotDirectory,
    source: {
      input: {
        audit: { contentHash: discoveryAudit.contentHash },
        snapshot: { directory: discoverySnapshotDirectory, contentHash: discoveryManifest.contentHash, records: records.length }
      },
      policy: { id: sufficiencyPolicy.policy, contentHash: hash(sufficiencyPolicy) },
      audit: sufficiencyBuilt.audit
    }
  };
  const sufficiencyAuditBase = {
    ...sufficiencyBuilt.audit,
    generatedAt: '2026-09-06T00:01:00Z',
    policy: { id: sufficiencyPolicy.policy, contentHash: hash(sufficiencyPolicy) },
    input: {
      audit: { contentHash: discoveryAudit.contentHash },
      snapshot: { directory: discoverySnapshotDirectory, contentHash: discoveryManifest.contentHash, records: records.length }
    },
    outputSnapshot: { directory: sufficiencySnapshotDirectory, contentHash: sufficiencyManifest.contentHash, records: sufficiencyBuilt.records.length }
  };
  const sufficiencyAudit = { ...sufficiencyAuditBase, contentHash: hash(sufficiencyAuditBase) };
  return {
    discoveryAudit, discoveryManifest, discoveryRecords: records, discoveryPolicy,
    sufficiencyAudit, sufficiencyManifest, sufficiencyRecords: sufficiencyBuilt.records,
    sufficiencyPolicy, policy, contentHash: hash
  };
}

const baseInputs = inputs();
const compiled = compileAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistryPolicy(policy, discoveryPolicy, sufficiencyPolicy, hash);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.forbiddenSelectors, []);

const built = buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(baseInputs);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.registryComplete, true);
assert.equal(built.records.length, 6);
assert.equal(built.audit.registryCoverage.queryBindingCount, 47);
assert.equal(built.audit.registryCoverage.sourceBindingOccurrenceCount, 353);
assert.equal(built.audit.registryCoverage.distinctSourceRevisionCount, 71);
assert.equal(built.audit.registryCoverage.signalBindingCount, 30);
assert.equal(built.audit.registryCoverage.everySignalSourceBoundToDiscoveredRevision, true);
assert.equal(built.audit.routingSafety.baselineChangeCount, 0);
assert.equal(built.audit.authorityBoundary.openBlockers, 6);
assert.equal(built.audit.authorityBoundary.semanticFactsCreated, 0);
assert.equal(built.audit.authorityBoundary.optimizerEligibleRecords, 0);
assert.ok(built.records.every(record => record.sourceMonitors.every(source => source.source.sourceRevision && source.source.contentHash)));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `missing audit field ${field}`);

const unchanged = detectAgilityColossalWyrmTermiteRewardRateSourceChanges(built.records, structuredClone(built.records), policy, hash);
assert.equal(unchanged.events.length, 0);
assert.equal(unchanged.semanticFactsCreated, 0);

const changedQueryRecords = structuredClone(baseInputs.discoveryRecords);
changedQueryRecords[0].searchQueries[0].reportedTotalHits += 1;
changedQueryRecords[0].searchQueries[0].resultPageIds.push(999999);
changedQueryRecords[0].searchQueries[0].fetchedResultCount += 1;
changedQueryRecords[0].searchQueries[0].resultSetHash = hash(changedQueryRecords[0].searchQueries[0].resultPageIds);
changedQueryRecords[0] = withHashes(changedQueryRecords[0]);
const changedQuery = buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(inputs(changedQueryRecords, 'query-change'));
assert.equal(changedQuery.audit.publishable, true);
const queryEvents = detectAgilityColossalWyrmTermiteRewardRateSourceChanges(built.records, changedQuery.records, policy, hash);
assert.equal(queryEvents.events.length, 1);
assert.deepEqual(queryEvents.events[0].changedDimensions, ['query_result_set']);
assert.equal(queryEvents.events[0].route, policy.changeRoute);
assert.equal(queryEvents.events[0].blockerRemainsOpen, true);

const changedSourceRecords = structuredClone(baseInputs.discoveryRecords);
const changedPageId = changedSourceRecords[1].discoveredPages[10].pageId;
const expectedSourceAffectedDomains = changedSourceRecords.filter(record => record.discoveredPages.some(page => page.pageId === changedPageId)).length;
for (let index = 0; index < changedSourceRecords.length; index += 1) {
  let changed = false;
  for (const page of changedSourceRecords[index].discoveredPages) {
    if (page.pageId !== changedPageId) continue;
    page.sourceRevision = '15999999';
    page.contentHash = hash('changed source body');
    changed = true;
  }
  if (changed) changedSourceRecords[index] = withHashes(changedSourceRecords[index]);
}
const changedSource = buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(inputs(changedSourceRecords, 'source-change'));
assert.equal(changedSource.audit.publishable, true, JSON.stringify(changedSource.audit, null, 2));
const sourceEvents = detectAgilityColossalWyrmTermiteRewardRateSourceChanges(built.records, changedSource.records, policy, hash);
assert.equal(sourceEvents.events.length, expectedSourceAffectedDomains);
assert.ok(sourceEvents.events.every(event => json(event.changedDimensions) === json(['source_revision_or_content'])));

const changedSignalRecords = structuredClone(baseInputs.discoveryRecords);
changedSignalRecords[2].potentialEvidenceSignals[0].excerpt = 'Changed, still non-authoritative fixture claim.';
changedSignalRecords[2] = withHashes(changedSignalRecords[2]);
const changedSignal = buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(inputs(changedSignalRecords, 'signal-change'));
assert.equal(changedSignal.audit.publishable, true);
const signalEvents = detectAgilityColossalWyrmTermiteRewardRateSourceChanges(built.records, changedSignal.records, policy, hash);
assert.equal(signalEvents.events.length, 1);
assert.deepEqual(signalEvents.events[0].changedDimensions, ['classified_signal']);
assert.equal(signalEvents.events[0].semanticFactCreated, false);

const provenanceOnly = structuredClone(built.records);
provenanceOnly[0].inputLineage.sufficiency.auditContentHash = hash('new artifact, identical evidence');
provenanceOnly[0] = withHashes(provenanceOnly[0]);
const provenanceResult = detectAgilityColossalWyrmTermiteRewardRateSourceChanges(built.records, provenanceOnly, policy, hash);
assert.equal(provenanceResult.events.length, 0);
assert.equal(provenanceResult.provenanceOnlyChangeCount, 1);

const structural = detectAgilityColossalWyrmTermiteRewardRateSourceChanges(built.records, built.records.slice(1), policy, hash);
assert.equal(structural.events.length, 1);
assert.deepEqual(structural.events[0].changedDimensions, ['registry_structure']);
assert.equal(structural.events[0].route, policy.structuralChangeRoute);

const nestedTamper = structuredClone(built.records);
nestedTamper[0].queryMonitors[0].result.reportedTotalHits += 1;
nestedTamper[0] = withHashes(nestedTamper[0]);
const tamperDetection = detectAgilityColossalWyrmTermiteRewardRateSourceChanges(built.records, nestedTamper, policy, hash);
assert.equal(tamperDetection.events[0].reason, 'registry_record_integrity_failed');

const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
promoted[0] = withHashes(promoted[0]);
const promotionAudit = auditAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(promoted, baseInputs);
assert.equal(promotionAudit.publishable, false);
assert.ok(promotionAudit.blockers.includes('registry_created_unsupported_fact_mechanic_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].accountState = { username: 'forbidden' };
accountScoped[0] = withHashes(accountScoped[0]);
const accountAudit = auditAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(accountScoped, baseInputs);
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_state_baked_into_source_change_monitoring_registry'));

const staleInputs = { ...baseInputs, sufficiencyAudit: structuredClone(baseInputs.sufficiencyAudit) };
staleInputs.sufficiencyAudit.input.snapshot.contentHash = hash('wrong snapshot');
const stale = buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(staleInputs);
assert.equal(stale.audit.publishable, false);
assert.ok(stale.audit.blockers.includes('source_change_monitoring_input_lineage_invalid'));

const deterministic = buildAgilityColossalWyrmTermiteRewardRateSourceChangeMonitoringRegistry(inputs(structuredClone(baseInputs.discoveryRecords)));
assert.deepEqual(deterministic, built);

const cli = 'platform/transforms/materialize-agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry.mjs';
const missing = spawnSync(process.execPath, [cli], { cwd: process.cwd(), encoding: 'utf8' });
assert.notEqual(missing.status, 0);
assert.match(`${missing.stdout}${missing.stderr}`, /--discovery-audit/);
const cliSource = await fs.readFile(new URL('../transforms/materialize-agility-colossal-wyrm-termite-reward-rate-source-change-monitoring-registry.mjs', import.meta.url), 'utf8');
for (const name of ['discovery-audit', 'discovery-snapshot', 'sufficiency-audit', 'sufficiency-snapshot']) assert.match(cliSource, new RegExp(`'${name}'`));

console.log('Colossal Wyrm termite and reward-rate source change monitoring registry checks passed.');
