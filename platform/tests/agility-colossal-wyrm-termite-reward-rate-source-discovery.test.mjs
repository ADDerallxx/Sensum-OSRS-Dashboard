import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  auditAgilityColossalWyrmTermiteRewardRateSourceDiscovery,
  buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery
} from '../ingestion/agility-colossal-wyrm-termite-reward-rate-source-discovery-lib.mjs';

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const json = value => JSON.stringify(stable(value));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : json(value)).digest('hex');
const withHashes = base => {
  const recordContentHash = hash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
};
const policy = JSON.parse(await fs.readFile(new URL('../policies/agility-colossal-wyrm-termite-reward-rate-source-discovery-v1.json', import.meta.url), 'utf8'));
const collectorSource = await fs.readFile(new URL('../ingestion/ingest-wiki-agility-colossal-wyrm-termite-reward-rate-source-discovery.mjs', import.meta.url), 'utf8');
assert.match(collectorSource, /srnamespace:\s*channel\.namespaces\.join\('\|'\)/);
assert.match(collectorSource, /rvprop:\s*'ids\|timestamp\|content'/);
assert.doesNotMatch(collectorSource, /snippet/);

const domainsByField = new Map();
for (const domain of policy.domains) domainsByField.set(domain.field, [...(domainsByField.get(domain.field) || []), domain]);
const fieldRecords = [...domainsByField.entries()].map(([field, domains]) => withHashes({
  contract: policy.inputRecordContract,
  field,
  remainingBlockersByRoute: {
    basic_route: domains.filter(domain => domain.route === 'basic_route').map(domain => domain.blocker),
    advanced_route: domains.filter(domain => domain.route === 'advanced_route').map(domain => domain.blocker)
  },
  accountIndependent: true,
  optimizerEligible: false
}));
const snapshotDirectory = 'fixture-field-snapshot';
const fieldManifest = {
  contract: 'sensum.ingestion-manifest.v1',
  domain: policy.inputSnapshotDomain,
  records: fieldRecords.length,
  contentHash: hash(`${fieldRecords.map(record => json(record)).join('\n')}\n`),
  snapshotDirectory
};
const fieldAuditBase = {
  contract: policy.inputAuditContract,
  publishable: true,
  outputSnapshot: { directory: snapshotDirectory, contentHash: fieldManifest.contentHash, records: fieldManifest.records }
};
const fieldAudit = { ...fieldAuditBase, contentHash: hash(fieldAuditBase) };
const namespaceRegistry = {
  query: { namespaces: {
    0: { id: 0, name: '', canonical: '' },
    1: { id: 1, name: 'Talk', canonical: 'Talk' },
    10: { id: 10, name: 'Template', canonical: 'Template' },
    112: { id: 112, name: 'Update', canonical: 'Update' },
    116: { id: 116, name: 'Calculator', canonical: 'Calculator' },
    828: { id: 828, name: 'Module', canonical: 'Module' }
  } }
};
const channels = new Map(policy.channels.map(channel => [channel.channelKey, channel]));
const emptyResponses = policy.queries.map(query => ({
  queryKey: query.queryKey,
  channelKey: query.channelKey,
  searchText: query.searchText,
  namespaces: [...channels.get(query.channelKey).namespaces],
  maxResults: policy.searchResultLimitPerQuery,
  reportedTotalHits: 0,
  pages: [],
  paginationComplete: true,
  truncated: false
}));
const inputs = { fieldAudit, fieldManifest, fieldRecords, namespaceRegistry, searchResponses: emptyResponses, revisionPages: [], policy, contentHash: hash };
const empty = buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery(inputs);
assert.equal(empty.audit.publishable, true);
assert.equal(empty.audit.queryBoundedDiscoveryComplete, true);
assert.equal(empty.audit.sourceDiscoveryDispositionStable, true);
assert.equal(empty.audit.inputLineage.valid, true);
assert.equal(empty.audit.namespaceRegistry.exact, true);
assert.equal(empty.audit.blockerCoverage.exact, true);
assert.equal(empty.audit.blockerCoverage.output.length, 6);
assert.equal(empty.audit.queryCoverage.declaredQueryCount, 16);
assert.equal(empty.audit.signalCoverage.totalSignals, 0);
assert.equal(empty.audit.authorityBoundary.mechanicallyResolvedBlockers, 0);
assert.ok(empty.records.every(record => record.existingBlockerPreserved && !record.mechanicallyResolved));

const pagesByChannel = {
  article: {
    pageId: 101, namespaceId: 0, title: 'Colossal Wyrm Agility Course',
    content: [
      'The exact spawn rate is currently unknown.',
      'Players expect to receive 3.9<ref>These values are experimental and based on data gathered in the [[Talk:Colossal Wyrm Agility Course#Advanced course reward rates|article discussion section]].</ref> [[termites]] per completion on average, and 6.9 bone shards per completion on average.',
      'Basic portions yield 11-14 termites while advanced-only portions yield 17-20 termites; there is an 80% chance to scoop up 22–38 blessed bone shards.',
      'Players can accumulate around 234 termites and 414 bone shards per hour; a less intense estimate of 35 laps per hour could provide 195 termites and 345 bone shards.',
      'The advanced course takes roughly 90 seconds to complete each lap.'
    ].join('\n')
  },
  update: {
    pageId: 102, namespaceId: 112, title: 'Update:Summer Sweep Up - Agility & Chambers of Xeric Changes',
    content: 'Increased XP, Bone shards and Termites to match so that it is roughly the same XP/hr and termites/hr but fewer inputs/hr.'
  },
  talk: {
    pageId: 103, namespaceId: 1, title: 'Talk:Colossal Wyrm Agility Course',
    content: 'Experimental discussion: 3.9 termites per completion on average and 6.9 bone shards per completion on average.'
  },
  source_code: {
    pageId: 104, namespaceId: 10, title: 'Template:Colossal Wyrm Agility Course',
    content: 'Colossal Wyrm Agility Course has a 25% termite spawn chance every 4 laps.'
  }
};
const signalledResponses = emptyResponses.map(response => {
  const page = pagesByChannel[response.channelKey];
  return { ...response, reportedTotalHits: 1, pages: [{ pageId: page.pageId, title: page.title, namespaceId: page.namespaceId }] };
});
const revisionPages = Object.values(pagesByChannel).map(page => ({
  pageid: page.pageId,
  ns: page.namespaceId,
  title: page.title,
  revisions: [{ revid: page.pageId + 1000, timestamp: '2026-09-06T00:00:00Z', slots: { main: { content: page.content } } }]
}));
const signalledInputs = { ...inputs, searchResponses: signalledResponses, revisionPages };
const signalled = buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery(signalledInputs);
assert.equal(signalled.audit.publishable, true);
assert.equal(signalled.audit.sourceDiscoveryDispositionStable, false);
assert.ok(signalled.audit.signalCoverage.totalSignals > 0);
assert.ok(signalled.audit.signalCoverage.experimentalDiscussionSignals > 0);
assert.ok(signalled.audit.signalCoverage.sourceCodeSignals > 0);
assert.equal(signalled.audit.authorityBoundary.mechanicallyResolvedBlockers, 0);
assert.equal(signalled.audit.authorityBoundary.blockersClosed, 0);
assert.equal(signalled.audit.authorityBoundary.semanticFactsCreated, 0);
assert.ok(signalled.records.flatMap(record => record.potentialEvidenceSignals)
  .filter(signal => signal.authorityClass === 'experimental_discussion')
  .every(signal => signal.mechanicalAuthority === false && signal.requiresManualSemanticReview === true));

const missingRevision = buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery({ ...signalledInputs, revisionPages: revisionPages.slice(1) });
assert.equal(missingRevision.audit.publishable, false);
assert.ok(missingRevision.audit.blockers.includes('search_result_revision_set_mismatch'));

const truncatedResponses = structuredClone(emptyResponses);
truncatedResponses[0].reportedTotalHits = 51;
truncatedResponses[0].paginationComplete = false;
truncatedResponses[0].truncated = true;
const truncated = buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery({ ...inputs, searchResponses: truncatedResponses });
assert.equal(truncated.audit.publishable, false);
assert.ok(truncated.audit.blockers.includes('one_or_more_queries_incomplete_or_exceeded_bound'));

const wrongNamespace = structuredClone(emptyResponses);
wrongNamespace[0].namespaces = [1];
assert.ok(buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery({ ...inputs, searchResponses: wrongNamespace }).audit.blockers
  .includes('one_or_more_query_definitions_or_channels_mismatch'));

const staleRegistry = structuredClone(namespaceRegistry);
staleRegistry.query.namespaces[112].canonical = 'Old update namespace';
assert.ok(buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery({ ...inputs, namespaceRegistry: staleRegistry }).audit.blockers
  .includes('current_wiki_namespace_registry_does_not_match_declared_channels'));

const tamperedAudit = structuredClone(fieldAudit);
tamperedAudit.publishable = false;
const staleInput = buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery({ ...inputs, fieldAudit: tamperedAudit });
assert.equal(staleInput.audit.publishable, false);
assert.ok(staleInput.audit.blockers.includes('field_reconciliation_input_lineage_invalid'));

const promoted = structuredClone(empty.records);
promoted[0].optimizerEligible = true;
const promotionAudit = auditAgilityColossalWyrmTermiteRewardRateSourceDiscovery(promoted, inputs);
assert.equal(promotionAudit.publishable, false);
assert.ok(promotionAudit.blockers.includes('source_discovery_created_unsupported_fact_or_optimizer_promotion'));

const accountScoped = structuredClone(empty.records);
accountScoped[0].accountState = { level: 34 };
const accountAudit = auditAgilityColossalWyrmTermiteRewardRateSourceDiscovery(accountScoped, inputs);
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_source_discovery'));

const deterministic = buildAgilityColossalWyrmTermiteRewardRateSourceDiscovery({
  fieldAudit: structuredClone(fieldAudit),
  fieldManifest: structuredClone(fieldManifest),
  fieldRecords: structuredClone(fieldRecords),
  namespaceRegistry: structuredClone(namespaceRegistry),
  searchResponses: structuredClone(emptyResponses),
  revisionPages: [],
  policy: structuredClone(policy),
  contentHash: hash
});
assert.deepEqual(deterministic, empty);
console.log('Colossal Wyrm termite and reward-rate source discovery checks passed.');
