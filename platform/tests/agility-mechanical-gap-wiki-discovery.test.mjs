import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  auditAgilityMechanicalGapWikiDiscovery,
  buildAgilityMechanicalGapWikiDiscovery
} from '../ingestion/agility-mechanical-gap-wiki-discovery-lib.mjs';

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(stable(value))).digest('hex');
const policy = JSON.parse(await fs.readFile(new URL('../policies/agility-mechanical-gap-wiki-discovery-v1.json', import.meta.url), 'utf8'));
const collectorSource = await fs.readFile(new URL('../ingestion/agility-gap-wiki-discovery-runner.mjs', import.meta.url), 'utf8');
assert.match(collectorSource, /pageids:\s*batch\.join\('\|'\)/);
assert.doesNotMatch(collectorSource, /rvlimit/);
const candidates = policy.candidates.map((candidate, index) => ({
  candidateKey: candidate.candidateKey,
  name: `Mechanical candidate ${index + 1}`,
  status: 'mechanical_model_gap',
  blockers: [...candidate.expectedBlockers]
}));
const coverageBase = { contract: policy.coverageAuditContract, targetBaseAgility: policy.targetBaseAgility, mechanicalModelGaps: 3, details: candidates };
const coverageReport = { ...coverageBase, contentHash: hash(coverageBase) };
const sufficiencyBase = {
  contract: policy.sourceSufficiencyAuditContract,
  inputAudit: { contentHash: coverageReport.contentHash },
  sourceSufficiencyDispositionStable: true,
  evidenceDomainCoverage: { resolutionSignalCount: 0 },
  blockerPreservation: { blockersClosed: 0, semanticFactsCreated: 0 }
};
const sourceSufficiencyReport = { ...sufficiencyBase, contentHash: hash(sufficiencyBase) };
const emptyResponses = policy.queries.map(query => ({
  queryKey: query.queryKey,
  searchText: query.searchText,
  namespaces: [...policy.searchNamespaces],
  maxResults: policy.searchResultLimitPerQuery,
  reportedTotalHits: 0,
  pages: [],
  paginationComplete: true,
  truncated: false
}));
const inputs = { coverageReport, sourceSufficiencyReport, searchResponses: emptyResponses, revisionPages: [], policy, contentHash: hash };
const built = buildAgilityMechanicalGapWikiDiscovery(inputs);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.queryBoundedDiscoveryComplete, true);
assert.equal(built.audit.sourceDiscoveryDispositionStable, true);
assert.equal(built.audit.candidateCoverage.outputRecordCount, 3);
assert.equal(built.audit.queryCoverage.declaredQueryCount, policy.queries.length);
assert.equal(built.audit.queryCoverage.queriesCompleteWithinBound, true);
assert.equal(built.audit.revisionCoverage.distinctSearchResultPageCount, 0);
assert.equal(built.audit.evidenceDomainCoverage.blockerCount, 4);
assert.equal(built.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 0);
assert.ok(built.records.every(record => record.disposition === 'blocked_no_candidate_matched_evidence_in_declared_bounded_queries'));

const signalPages = new Map([
  ['skullball-peak-anchor', { pageId: 101, title: 'Werewolf Skullball', content: 'At Werewolf Skullball, the typical optimal-route completion time is 1:50–2:00.' }],
  ['barbarian-afk-ticks', { pageId: 102, title: 'Pay-to-play Fishing training', content: 'Barbarian Fishing has an AFK catch-and-drop cycle of 20 ticks, including dropping fish.' }],
  ['edgeville-monkeybars-ticks', { pageId: 103, title: 'Monkeybars (Edgeville Dungeon)', content: 'The Edgeville Dungeon monkeybars motionless round trip takes 12 ticks.' }],
  ['edgeville-rate-conflict', { pageId: 104, title: 'Agility training', content: 'For Edgeville Dungeon monkeybars, the previous 13,000 XP/h upper bound was corrected to 13,200 XP/h.' }]
]);
const signalledResponses = emptyResponses.map(response => {
  const page = signalPages.get(response.queryKey);
  return page ? { ...response, reportedTotalHits: 1, pages: [{ pageId: page.pageId, title: page.title }] } : response;
});
const revisionPages = [...signalPages.values()].map(page => ({
  pageid: page.pageId,
  title: page.title,
  revisions: [{ revid: page.pageId + 1000, timestamp: '2026-09-06T00:00:00Z', slots: { main: { content: page.content } } }]
}));
const signalledInputs = { ...inputs, searchResponses: signalledResponses, revisionPages };
const signalled = buildAgilityMechanicalGapWikiDiscovery(signalledInputs);
assert.equal(signalled.audit.publishable, true);
assert.equal(signalled.audit.sourceDiscoveryDispositionStable, false);
assert.equal(signalled.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 4);
assert.equal(signalled.audit.evidenceDomainCoverage.manualReauditCandidateCount, 3);
assert.equal(signalled.audit.revisionCoverage.allResultRevisionsResolved, true);
assert.ok(signalled.records.every(record => record.manualReauditRequired));
assert.ok(signalled.records.every(record => record.blockersClosed === 0 && record.semanticFactsCreated === 0 && record.optimizerEligible === false));

const missingRevision = buildAgilityMechanicalGapWikiDiscovery({ ...signalledInputs, revisionPages: revisionPages.slice(1) });
assert.equal(missingRevision.audit.publishable, false);
assert.ok(missingRevision.audit.blockers.includes('search_result_revision_set_mismatch'));

const truncatedResponses = structuredClone(emptyResponses);
truncatedResponses[0].reportedTotalHits = 51;
truncatedResponses[0].truncated = true;
truncatedResponses[0].paginationComplete = false;
const truncated = buildAgilityMechanicalGapWikiDiscovery({ ...inputs, searchResponses: truncatedResponses });
assert.equal(truncated.audit.publishable, false);
assert.ok(truncated.audit.blockers.includes('one_or_more_queries_incomplete_or_exceeded_bound'));

const wrongQueryResponses = structuredClone(emptyResponses);
wrongQueryResponses[0].searchText = 'changed query';
assert.ok(buildAgilityMechanicalGapWikiDiscovery({ ...inputs, searchResponses: wrongQueryResponses }).audit.blockers.includes('one_or_more_query_definitions_mismatch'));

const tamperedCoverage = structuredClone(coverageReport);
tamperedCoverage.details[0].blockers.push('invented_gap');
const tampered = buildAgilityMechanicalGapWikiDiscovery({ ...inputs, coverageReport: tamperedCoverage });
assert.equal(tampered.audit.publishable, false);
assert.ok(tampered.audit.blockers.includes('coverage_audit_content_hash_invalid'));
assert.ok(tampered.audit.blockers.includes('mechanical_gap_blocker_set_mismatch'));

const tamperedSufficiency = structuredClone(sourceSufficiencyReport);
tamperedSufficiency.sourceSufficiencyDispositionStable = false;
const staleSourceAudit = buildAgilityMechanicalGapWikiDiscovery({ ...inputs, sourceSufficiencyReport: tamperedSufficiency });
assert.equal(staleSourceAudit.audit.publishable, false);
assert.ok(staleSourceAudit.audit.blockers.includes('source_sufficiency_audit_content_hash_invalid'));
assert.ok(staleSourceAudit.audit.blockers.includes('source_sufficiency_input_not_stably_unresolved'));

const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
const promotionAudit = auditAgilityMechanicalGapWikiDiscovery(promoted, inputs);
assert.equal(promotionAudit.publishable, false);
assert.ok(promotionAudit.blockers.includes('unsupported_fact_resolution_or_optimizer_promotion_detected'));

const accountScoped = structuredClone(built.records);
accountScoped[0].accountState = { level: 34 };
const accountAudit = auditAgilityMechanicalGapWikiDiscovery(accountScoped, inputs);
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_source_discovery'));

const deterministic = buildAgilityMechanicalGapWikiDiscovery({
  coverageReport: structuredClone(coverageReport),
  sourceSufficiencyReport: structuredClone(sourceSufficiencyReport),
  searchResponses: structuredClone(emptyResponses),
  revisionPages: [],
  policy: structuredClone(policy),
  contentHash: hash
});
assert.deepEqual(deterministic, built);
console.log('Agility mechanical-gap Wiki discovery checks passed.');
