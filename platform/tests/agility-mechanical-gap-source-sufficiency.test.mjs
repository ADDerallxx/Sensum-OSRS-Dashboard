import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  auditAgilityMechanicalGapSourceSufficiency,
  buildAgilityMechanicalGapSourceSufficiency
} from '../ingestion/agility-mechanical-gap-source-sufficiency-lib.mjs';

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(stable(value))).digest('hex');
const policy = JSON.parse(await fs.readFile(new URL('../policies/agility-mechanical-gap-source-sufficiency-v1.json', import.meta.url), 'utf8'));
const candidates = policy.candidates.map((candidate, index) => ({
  candidateKey: candidate.candidateKey,
  name: `Mechanical candidate ${index + 1}`,
  status: 'mechanical_model_gap',
  blockers: [...candidate.expectedBlockers]
}));
const reportBase = {
  contract: policy.inputAuditContract,
  targetBaseAgility: policy.targetBaseAgility,
  mechanicalModelGaps: candidates.length,
  phaseExitSatisfied: false,
  details: candidates
};
const report = { ...reportBase, contentHash: hash(reportBase) };
const page = (source, content = `Pinned source for ${source.title}.`) => ({
  pageid: Number(source.revision),
  title: source.title,
  revisions: [{ revid: Number(source.revision), timestamp: '2026-09-06T00:00:00Z', slots: { main: { content } } }]
});
const exactPages = policy.sources.map(source => page(source));

const built = buildAgilityMechanicalGapSourceSufficiency({ coverageReport: report, exactRevisionPages: exactPages, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.sourceChannelAuditComplete, true);
assert.equal(built.audit.sourceSufficiencyDispositionStable, true);
assert.equal(built.audit.candidateCoverage.outputRecordCount, 3);
assert.equal(built.audit.sourceCoverage.declaredDistinctSourceCount, policy.sources.length);
assert.equal(built.audit.sourceCoverage.exactRevisionRetrievedCount, policy.sources.length);
assert.equal(built.audit.evidenceDomainCoverage.blockerCount, 4);
assert.equal(built.audit.evidenceDomainCoverage.mappedDomainCount, 4);
assert.deepEqual(built.audit.blockerPreservation, {
  preserved: true,
  blockersClosed: 0,
  semanticFactsCreated: 0,
  optimizerEligibleCount: 0,
  automaticVerificationCount: 0,
  accountStateFindingCount: 0,
  completeWikiUniverseClaimCount: 0
});
assert.ok(built.records.every(record => record.disposition === 'blocked_no_mechanics_matched_evidence_in_declared_revision_bound_channels'));

const missingSource = buildAgilityMechanicalGapSourceSufficiency({ coverageReport: report, exactRevisionPages: exactPages.slice(1), policy, contentHash: hash });
assert.equal(missingSource.audit.publishable, false);
assert.ok(missingSource.audit.blockers.includes('one_or_more_declared_exact_revisions_unavailable_or_identity_mismatched'));

const wrongTitlePages = structuredClone(exactPages);
wrongTitlePages[0].title = 'Wrong source identity';
assert.equal(buildAgilityMechanicalGapSourceSufficiency({ coverageReport: report, exactRevisionPages: wrongTitlePages, policy, contentHash: hash }).audit.publishable, false);

const tamperedReport = structuredClone(report);
tamperedReport.details[0].blockers.push('invented_gap');
const tampered = buildAgilityMechanicalGapSourceSufficiency({ coverageReport: tamperedReport, exactRevisionPages: exactPages, policy, contentHash: hash });
assert.equal(tampered.audit.publishable, false);
assert.ok(tampered.audit.blockers.includes('input_coverage_audit_content_hash_invalid'));
assert.ok(tampered.audit.blockers.includes('mechanical_gap_blocker_set_mismatch'));

const injectedContent = new Map([
  ['werewolf-skullball', 'For the optimal route, the typical completion time is 1:50–2:00.'],
  ['p2p-fishing-training', 'The AFK catch-and-drop cycle is 20 ticks, including time spent dropping fish.'],
  ['edgeville-monkeybars', 'The motionless monkeybars round trip takes 12 ticks. The previous upper bound of 13,000 XP/h was corrected to 13,200 XP/h.']
]);
const injectedPages = policy.sources.map(source => page(source, injectedContent.get(source.sourceKey) || `Pinned source for ${source.title}.`));
const signalled = buildAgilityMechanicalGapSourceSufficiency({ coverageReport: report, exactRevisionPages: injectedPages, policy, contentHash: hash });
assert.equal(signalled.audit.publishable, true);
assert.equal(signalled.audit.sourceSufficiencyDispositionStable, false);
assert.equal(signalled.audit.evidenceDomainCoverage.resolutionSignalCount, 4);
assert.equal(signalled.audit.evidenceDomainCoverage.manualReauditCandidateCount, 3);
assert.ok(signalled.records.every(record => record.manualReauditRequired));
assert.ok(signalled.records.every(record => record.blockersClosed === 0 && record.semanticFactsCreated === 0 && record.optimizerEligible === false));

const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
const promotionAudit = auditAgilityMechanicalGapSourceSufficiency(promoted, { coverageReport: report, exactRevisionPages: exactPages, policy, contentHash: hash });
assert.equal(promotionAudit.publishable, false);
assert.ok(promotionAudit.blockers.includes('unsupported_fact_resolution_or_optimizer_promotion_detected'));

const accountScoped = structuredClone(built.records);
accountScoped[0].accountState = { level: 34 };
const accountAudit = auditAgilityMechanicalGapSourceSufficiency(accountScoped, { coverageReport: report, exactRevisionPages: exactPages, policy, contentHash: hash });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_source_sufficiency_audit'));

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildAgilityMechanicalGapSourceSufficiency({ coverageReport: report, exactRevisionPages: exactPages, policy: automaticPolicy, contentHash: hash }).audit.publishable, false);

const deterministic = buildAgilityMechanicalGapSourceSufficiency({ coverageReport: structuredClone(report), exactRevisionPages: structuredClone(exactPages), policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministic, built);
console.log('Agility mechanical-gap source-sufficiency checks passed.');
