import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  auditAgilityOpenBlockerSourceRevisionMonitor,
  buildAgilityOpenBlockerSourceRevisionMonitor,
  extractAgilityOpenBlockerSources
} from '../ingestion/agility-open-blocker-source-revision-monitor-lib.mjs';

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(stable(value))).digest('hex');
const policy = {
  policy: 'test-policy',
  inputAuditContract: 'sensum.agility-level34-coverage-audit.v1',
  recordContract: 'sensum.agility-open-blocker-source-revision-monitor.v1',
  auditContract: 'sensum.agility-open-blocker-source-revision-monitor-audit.v1',
  acceptedSourceOrigin: 'https://oldschool.runescape.wiki/w/'
};
const sourceA = 'https://oldschool.runescape.wiki/w/Example_course';
const sourceB = 'https://oldschool.runescape.wiki/w/Example_obstacle';
const reportBase = {
  contract: policy.inputAuditContract,
  targetBaseAgility: 34,
  candidateUniverse: 2,
  blockingCandidates: 2,
  phaseExitSatisfied: false,
  details: [
    { candidateKey: 'guide:one', name: 'One', status: 'target_condition_gap', mechanicalReadiness: 'target_condition_gap', sourceRevision: '100', sourceUrl: sourceA, blockers: ['level_34_probability_unpublished'], nested: { sourceRevision: '200', sourceUrl: sourceB } },
    { candidateKey: 'guide:two', name: 'Two', status: 'condition_model_present', mechanicalReadiness: 'mechanical_model_gap', sourceRevision: '100', sourceUrl: sourceA, blockers: ['cycle_ticks_unpublished'] }
  ]
};
const report = { ...reportBase, contentHash: hash(reportBase) };
const page = (pageid, title, revid, content) => ({ pageid, title, revisions: [{ revid, timestamp: '2026-09-01T00:00:00Z', slots: { main: { content } } }] });
const exactPages = [page(1, 'Example course', 100, 'course source'), page(2, 'Example obstacle', 200, 'obstacle source')];
const head = (requestedTitle, pageValue, redirected = false) => ({ requestedTitle, normalizedTitle: requestedTitle, resolvedTitle: pageValue.title, page: pageValue, redirected });
const unchangedHeads = [head('Example course', page(1, 'Example course', 100, null)), head('Example obstacle', page(2, 'Example obstacle', 200, null))];

const extracted = extractAgilityOpenBlockerSources(report, policy);
assert.equal(extracted.blockedCandidates.length, 2);
assert.equal(extracted.sources.length, 2);
assert.equal(extracted.sources.find(source => source.sourceRevision === '100').candidates.length, 2);

const built = buildAgilityOpenBlockerSourceRevisionMonitor({ coverageReport: report, exactRevisionPages: exactPages, headResolutions: unchangedHeads, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.sourceRevisionMonitoringComplete, true);
assert.equal(built.audit.sourceSetCurrent, true);
assert.deepEqual(built.audit.revisionStates, { unchangedCount: 2, reauditRequiredCount: 0, integrityBlockedCount: 0, byState: { unchanged: 2 } });
assert.deepEqual(built.audit.blockerPreservation, { existingBlockedCandidateCount: 2, blockersClosed: 0, semanticFactsCreated: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0 });

const advancedHeads = structuredClone(unchangedHeads);
advancedHeads[0].page.revisions[0].revid = 101;
const advanced = buildAgilityOpenBlockerSourceRevisionMonitor({ coverageReport: report, exactRevisionPages: exactPages, headResolutions: advancedHeads, policy, contentHash: hash });
assert.equal(advanced.audit.publishable, true);
assert.equal(advanced.audit.sourceSetCurrent, false);
assert.equal(advanced.audit.revisionStates.reauditRequiredCount, 1);
assert.equal(advanced.records.find(record => record.requestedTitle === 'Example course').blockersClosed, 0);

const missingExact = buildAgilityOpenBlockerSourceRevisionMonitor({ coverageReport: report, exactRevisionPages: exactPages.slice(0, 1), headResolutions: unchangedHeads, policy, contentHash: hash });
assert.equal(missingExact.audit.publishable, false);
assert.ok(missingExact.audit.blockers.includes('one_or_more_pinned_revisions_not_retrievable'));

const tamperedReport = structuredClone(report);
tamperedReport.details[0].name = 'Tampered';
assert.equal(buildAgilityOpenBlockerSourceRevisionMonitor({ coverageReport: tamperedReport, exactRevisionPages: exactPages, headResolutions: unchangedHeads, policy, contentHash: hash }).audit.publishable, false);

const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
assert.equal(auditAgilityOpenBlockerSourceRevisionMonitor(promoted, { coverageReport: report, exactRevisionPages: exactPages, headResolutions: unchangedHeads, policy, contentHash: hash }).publishable, false);

const accountScoped = structuredClone(built.records);
accountScoped[0].accountState = { level: 34 };
assert.equal(auditAgilityOpenBlockerSourceRevisionMonitor(accountScoped, { coverageReport: report, exactRevisionPages: exactPages, headResolutions: unchangedHeads, policy, contentHash: hash }).publishable, false);

const deterministic = buildAgilityOpenBlockerSourceRevisionMonitor({ coverageReport: structuredClone(report), exactRevisionPages: structuredClone(exactPages), headResolutions: structuredClone(unchangedHeads), policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministic, built);
console.log('Agility open-blocker source revision-monitor checks passed.');
