import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { auditAgilityGapWikiDiscovery, buildAgilityGapWikiDiscovery } from '../ingestion/agility-mechanical-gap-wiki-discovery-lib.mjs';

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(stable(value))).digest('hex');
const policy = JSON.parse(await fs.readFile(new URL('../policies/agility-target-condition-gap-wiki-discovery-v1.json', import.meta.url), 'utf8'));
const candidates = policy.candidates.map((candidate, index) => ({ candidateKey: candidate.candidateKey, name: `Target candidate ${index + 1}`, status: policy.inputGapStatus, blockers: [...candidate.expectedBlockers] }));
const coverageBase = { contract: policy.coverageAuditContract, targetBaseAgility: policy.targetBaseAgility, targetConditionGaps: 5, details: candidates };
const coverageReport = { ...coverageBase, contentHash: hash(coverageBase) };
const sufficiencyBase = {
  contract: policy.sourceSufficiencyAuditContract,
  inputAudit: { contentHash: coverageReport.contentHash },
  sourceSufficiencyDispositionStable: true,
  evidenceDomainCoverage: { resolutionSignalCount: 0 },
  blockerPreservation: { blockersClosed: 0, semanticFactsCreated: 0 }
};
const sourceSufficiencyReport = { ...sufficiencyBase, contentHash: hash(sufficiencyBase) };
const emptyResponses = policy.queries.map(query => ({ queryKey: query.queryKey, searchText: query.searchText, namespaces: [...policy.searchNamespaces], maxResults: policy.searchResultLimitPerQuery, reportedTotalHits: 0, pages: [], paginationComplete: true, truncated: false }));
const inputs = { coverageReport, sourceSufficiencyReport, searchResponses: emptyResponses, revisionPages: [], policy, contentHash: hash };
const built = buildAgilityGapWikiDiscovery(inputs);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.queryBoundedDiscoveryComplete, true);
assert.equal(built.audit.sourceDiscoveryDispositionStable, true);
assert.equal(built.audit.candidateCoverage.inputGapStatus, 'target_condition_gap');
assert.equal(built.audit.candidateCoverage.inputTargetConditionGapCount, 5);
assert.equal(built.audit.candidateCoverage.outputRecordCount, 5);
assert.equal(built.audit.queryCoverage.declaredQueryCount, 27);
assert.equal(built.audit.evidenceDomainCoverage.blockerCount, 17);
assert.equal(built.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 0);
assert.ok(built.records.every(record => record.disposition === 'blocked_no_candidate_matched_evidence_in_declared_bounded_queries'));

const signalPages = new Map([
  ['al-tightrope-chance-exact', { pageId: 201, title: 'Al Kharid Rooftop Course', content: 'At level 34 Agility, the Tightrope success chance is 75%.' }],
  ['brimhaven-detached-success-exact', { pageId: 202, title: 'Floor spikes (Brimhaven Agility Arena)', content: '{{Skilling success chart|low=10|high=20}}' }],
  ['al-failed-xp', { pageId: 203, title: 'Rooftop Agility Courses', content: 'An Al Kharid Rooftop Course failed obstacle grants 5 experience.' }],
  ['al-recovery-exact', { pageId: 204, title: 'Agility', content: 'An Al Kharid Rooftop Course failure returns the player to the start after 6 ticks.' }],
  ['al-rate-level34', { pageId: 205, title: 'Agility training', content: 'At Al Kharid Rooftop Course and level 34 Agility, the route gives 12,000 experience per hour.' }],
  ['brimhaven-detached-equipment', { pageId: 206, title: 'Brimhaven Agility Arena', content: 'The 36,000 experience rate assumes wearing Karamja gloves.' }],
  ['shayzien-failure-identity', { pageId: 207, title: 'Shayzien Agility Course', content: 'The Shayzien Agility Course Ladder can fail.' }],
  ['shayzien-rate-alignment', { pageId: 208, title: 'Shayzien Agility Course', content: 'Shayzien Agility Course was increased from 8,750 to 10,000 experience per hour.' }]
]);
const signalledResponses = emptyResponses.map(response => {
  const page = signalPages.get(response.queryKey);
  return page ? { ...response, reportedTotalHits: 1, pages: [{ pageId: page.pageId, title: page.title }] } : response;
});
const revisionPages = [...signalPages.values()].map(page => ({ pageid: page.pageId, title: page.title, revisions: [{ revid: page.pageId + 1000, timestamp: '2026-09-06T00:00:00Z', slots: { main: { content: page.content } } }] }));
const signalledInputs = { ...inputs, searchResponses: signalledResponses, revisionPages };
const signalled = buildAgilityGapWikiDiscovery(signalledInputs);
assert.equal(signalled.audit.publishable, true);
assert.equal(signalled.audit.sourceDiscoveryDispositionStable, false);
assert.equal(signalled.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 8);
assert.equal(signalled.audit.evidenceDomainCoverage.manualReauditCandidateCount, 3);
assert.equal(signalled.audit.revisionCoverage.allResultRevisionsResolved, true);
assert.ok(signalled.records.every(record => record.blockersClosed === 0 && record.semanticFactsCreated === 0 && record.optimizerEligible === false));

const unrelatedPages = new Map([
  ['al-failed-xp', { pageId: 301, title: 'Agility', content: 'A failed Werewolf course obstacle grants 5 experience.' }],
  ['brimhaven-detached-success-exact', { pageId: 302, title: 'Spinning blades (Brimhaven Agility Arena)', content: '{{Skilling success chart|low=10|high=20}}' }],
  ['shayzien-failed-xp', { pageId: 303, title: 'Agility', content: 'A failed Werewolf course obstacle grants 5 experience.\n! Fail experience' }]
]);
const unrelatedResponses = emptyResponses.map(response => {
  const page = unrelatedPages.get(response.queryKey);
  return page ? { ...response, reportedTotalHits: 1, pages: [{ pageId: page.pageId, title: page.title }] } : response;
});
const unrelatedRevisions = [...unrelatedPages.values()].map(page => ({ pageid: page.pageId, title: page.title, revisions: [{ revid: page.pageId + 1000, timestamp: '2026-09-06T00:00:00Z', slots: { main: { content: page.content } } }] }));
const unrelated = buildAgilityGapWikiDiscovery({ ...inputs, searchResponses: unrelatedResponses, revisionPages: unrelatedRevisions });
assert.equal(unrelated.audit.evidenceDomainCoverage.potentialEvidenceSignalCount, 0);

const missingRevision = buildAgilityGapWikiDiscovery({ ...signalledInputs, revisionPages: revisionPages.slice(1) });
assert.equal(missingRevision.audit.publishable, false);
assert.ok(missingRevision.audit.blockers.includes('search_result_revision_set_mismatch'));

const truncatedResponses = structuredClone(emptyResponses);
truncatedResponses[0].reportedTotalHits = 51;
truncatedResponses[0].truncated = true;
truncatedResponses[0].paginationComplete = false;
assert.ok(buildAgilityGapWikiDiscovery({ ...inputs, searchResponses: truncatedResponses }).audit.blockers.includes('one_or_more_queries_incomplete_or_exceeded_bound'));

const wrongQueryResponses = structuredClone(emptyResponses);
wrongQueryResponses[0].searchText = 'changed query';
assert.ok(buildAgilityGapWikiDiscovery({ ...inputs, searchResponses: wrongQueryResponses }).audit.blockers.includes('one_or_more_query_definitions_mismatch'));

const tamperedCoverage = structuredClone(coverageReport);
tamperedCoverage.details[0].blockers.push('invented_gap');
const tampered = buildAgilityGapWikiDiscovery({ ...inputs, coverageReport: tamperedCoverage });
assert.equal(tampered.audit.publishable, false);
assert.ok(tampered.audit.blockers.includes('coverage_audit_content_hash_invalid'));
assert.ok(tampered.audit.blockers.includes('target_condition_gap_blocker_set_mismatch'));

const tamperedSufficiency = structuredClone(sourceSufficiencyReport);
tamperedSufficiency.sourceSufficiencyDispositionStable = false;
const staleSourceAudit = buildAgilityGapWikiDiscovery({ ...inputs, sourceSufficiencyReport: tamperedSufficiency });
assert.equal(staleSourceAudit.audit.publishable, false);
assert.ok(staleSourceAudit.audit.blockers.includes('source_sufficiency_audit_content_hash_invalid'));
assert.ok(staleSourceAudit.audit.blockers.includes('source_sufficiency_input_not_stably_unresolved'));

const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
const promotionAudit = auditAgilityGapWikiDiscovery(promoted, inputs);
assert.equal(promotionAudit.publishable, false);
assert.ok(promotionAudit.blockers.includes('unsupported_fact_resolution_or_optimizer_promotion_detected'));

const accountScoped = structuredClone(built.records);
accountScoped[0].accountSnapshot = { level: 34 };
const accountAudit = auditAgilityGapWikiDiscovery(accountScoped, inputs);
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_source_discovery'));

const deterministic = buildAgilityGapWikiDiscovery({ coverageReport: structuredClone(coverageReport), sourceSufficiencyReport: structuredClone(sourceSufficiencyReport), searchResponses: structuredClone(emptyResponses), revisionPages: [], policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministic, built);
console.log('Agility target-condition-gap Wiki discovery checks passed.');
