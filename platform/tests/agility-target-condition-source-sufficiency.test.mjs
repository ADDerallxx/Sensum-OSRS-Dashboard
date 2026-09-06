import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  auditAgilityTargetConditionSourceSufficiency,
  buildAgilityTargetConditionSourceSufficiency
} from '../ingestion/agility-target-condition-source-sufficiency-lib.mjs';

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(stable(value))).digest('hex');
const policy = JSON.parse(await fs.readFile(new URL('../policies/agility-target-condition-source-sufficiency-v1.json', import.meta.url), 'utf8'));
const targetCandidates = policy.candidates.map((candidate, index) => ({
  candidateKey: candidate.candidateKey,
  name: `Candidate ${index + 1}`,
  status: 'target_condition_gap',
  blockers: [...candidate.expectedBlockers]
}));
const reportBase = {
  contract: policy.inputAuditContract,
  targetBaseAgility: policy.targetBaseAgility,
  blockingCandidates: targetCandidates.length,
  phaseExitSatisfied: false,
  details: targetCandidates
};
const report = { ...reportBase, contentHash: hash(reportBase) };
const page = (source, content = `Pinned source for ${source.title}.`) => ({
  pageid: Number(source.revision),
  title: source.title,
  revisions: [{ revid: Number(source.revision), timestamp: '2026-09-06T00:00:00Z', slots: { main: { content } } }]
});
const exactPages = policy.sources.map(source => page(source));

const built = buildAgilityTargetConditionSourceSufficiency({ coverageReport: report, exactRevisionPages: exactPages, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.sourceChannelAuditComplete, true);
assert.equal(built.audit.sourceSufficiencyDispositionStable, true);
assert.equal(built.audit.candidateCoverage.outputRecordCount, 5);
assert.equal(built.audit.sourceCoverage.declaredDistinctSourceCount, policy.sources.length);
assert.equal(built.audit.sourceCoverage.exactRevisionRetrievedCount, policy.sources.length);
assert.equal(built.audit.evidenceDomainCoverage.blockerCount, targetCandidates.reduce((sum, candidate) => sum + candidate.blockers.length, 0));
assert.equal(built.audit.evidenceDomainCoverage.mappedDomainCount, built.audit.evidenceDomainCoverage.blockerCount);
assert.deepEqual(built.audit.blockerPreservation, {
  preserved: true,
  blockersClosed: 0,
  semanticFactsCreated: 0,
  optimizerEligibleCount: 0,
  automaticVerificationCount: 0,
  accountStateFindingCount: 0,
  completeWikiUniverseClaimCount: 0
});
assert.ok(built.records.every(record => record.disposition === 'blocked_no_condition_matched_evidence_in_declared_revision_bound_channels'));

const missingSource = buildAgilityTargetConditionSourceSufficiency({ coverageReport: report, exactRevisionPages: exactPages.slice(1), policy, contentHash: hash });
assert.equal(missingSource.audit.publishable, false);
assert.ok(missingSource.audit.blockers.includes('one_or_more_declared_exact_revisions_unavailable_or_identity_mismatched'));

const wrongTitlePages = structuredClone(exactPages);
wrongTitlePages[0].title = 'Wrong source identity';
const wrongTitle = buildAgilityTargetConditionSourceSufficiency({ coverageReport: report, exactRevisionPages: wrongTitlePages, policy, contentHash: hash });
assert.equal(wrongTitle.audit.publishable, false);

const tamperedReport = structuredClone(report);
tamperedReport.details[0].blockers.push('invented_gap');
const tampered = buildAgilityTargetConditionSourceSufficiency({ coverageReport: tamperedReport, exactRevisionPages: exactPages, policy, contentHash: hash });
assert.equal(tampered.audit.publishable, false);
assert.ok(tampered.audit.blockers.includes('input_coverage_audit_content_hash_invalid'));
assert.ok(tampered.audit.blockers.includes('target_condition_blocker_set_mismatch'));

const injectedPages = policy.sources.map(source => source.sourceKey === 'al-kharid-tightrope'
  ? page(source, 'At level 34 Agility, the success chance is 75%.')
  : page(source));
const signalled = buildAgilityTargetConditionSourceSufficiency({ coverageReport: report, exactRevisionPages: injectedPages, policy, contentHash: hash });
assert.equal(signalled.audit.publishable, true);
assert.equal(signalled.audit.sourceSufficiencyDispositionStable, false);
assert.equal(signalled.audit.evidenceDomainCoverage.manualReauditCandidateCount, 1);
assert.equal(signalled.records[0].manualReauditRequired, true);
assert.equal(signalled.records[0].blockersClosed, 0);
assert.equal(signalled.records[0].semanticFactsCreated, 0);
assert.equal(signalled.records[0].optimizerEligible, false);

const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
const promotionAudit = auditAgilityTargetConditionSourceSufficiency(promoted, { coverageReport: report, exactRevisionPages: exactPages, policy, contentHash: hash });
assert.equal(promotionAudit.publishable, false);
assert.ok(promotionAudit.blockers.includes('unsupported_fact_resolution_or_optimizer_promotion_detected'));

const accountScoped = structuredClone(built.records);
accountScoped[0].accountState = { level: 34 };
const accountAudit = auditAgilityTargetConditionSourceSufficiency(accountScoped, { coverageReport: report, exactRevisionPages: exactPages, policy, contentHash: hash });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_source_sufficiency_audit'));

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildAgilityTargetConditionSourceSufficiency({ coverageReport: report, exactRevisionPages: exactPages, policy: automaticPolicy, contentHash: hash }).audit.publishable, false);

const deterministic = buildAgilityTargetConditionSourceSufficiency({ coverageReport: structuredClone(report), exactRevisionPages: structuredClone(exactPages), policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministic, built);
console.log('Agility target-condition source-sufficiency checks passed.');
