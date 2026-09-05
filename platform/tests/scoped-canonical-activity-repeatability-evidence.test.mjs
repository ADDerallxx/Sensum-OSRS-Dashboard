import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditScopedCanonicalActivityRepeatabilityEvidence,
  buildScopedCanonicalActivityRepeatabilityEvidence,
  compileScopedCanonicalActivityRepeatabilityEvidencePolicy,
  discoverScopedCanonicalActivityRepeatabilityExactRevisionRequests
} from '../ingestion/scoped-canonical-activity-repeatability-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/scoped-canonical-activity-repeatability-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/scoped-canonical-activity-repeatability-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/scoped-canonical-activity-repeatability-evidence-audit-v1.json', 'utf8'));
const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`;

const sourceText = `{{Infobox Activity
|name = Test activity
}}
An NPC can assign various tasks.
There are 59 tasks in total that can be assigned. {{CiteNews|url=https://example.test/source}}
The NPC will only give tasks that match the player's current level.
<!-- The same task can be assigned again. daily reset -->
<nowiki>This activity can be repeated.</nowiki>`;

function lineInventory(content) {
  return content.split(/\r?\n/).map((rawText, index) => ({
    ordinal: index + 1,
    sourceLocator: { lineStart: index + 1, lineEnd: index + 1 },
    rawText,
    rawTextContentHash: hash(rawText)
  }));
}

function routingRecord({ key = '1', label = 'Test activity', content = sourceText } = {}) {
  const sourceRevision = `20${key}`;
  const sourcePageId = 100 + Number(key);
  const sourcePageIdentity = {
    sourcePageId,
    resolvedTitle: label,
    sourceRevision,
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: wikiUrl(label),
    sourceContentHash: hash(content)
  };
  const scopeVerdict = 'source_supported_composite_assigned_task_activity_scope';
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivitySubjectBinding: { canonicalActivityKey: `activity:${key}`, sourcePageIdentity, accountIndependent: true },
    canonicalActivitySubjectDeclarationReview: { repeatabilityVerdict: null },
    canonicalActivityScopeEvidence: { canonicalActivityScopeVerdict: null, repeatabilityVerdict: null },
    canonicalActivityScopeEvidenceSources: [{
      sourcePageIdentity,
      exactRevisionSourceText: content,
      structuralInventory: { sourceLines: lineInventory(content) },
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    }],
    canonicalActivityScopeDisposition: {
      state: 'source_supported_composite_assigned_task_activity_scope',
      canonicalActivityScopeVerdict: scopeVerdict,
      scopeClass: 'composite_assigned_task_activity',
      memberInventoryComplete: false,
      repeatabilityVerdict: null
    },
    canonicalActivityScopeReview: {
      state: 'reviewed_source_supported_composite_assigned_task_activity_scope',
      canonicalActivityScopeVerdict: scopeVerdict,
      repeatabilityVerdict: null
    },
    canonicalActivityRepeatabilityEvidenceWorkRouting: {
      policyRuleKind: 'audited_source_supported_scoped_canonical_activity_state',
      sourceState: 'canonical_activity_scope_disposed_composite_assigned_tasks_repeatability_unresolved',
      sourceScopeVerdict: scopeVerdict,
      routeKey: policy.inputRouteKey,
      routeState: policy.inputRouteState,
      requiredEvidenceDomains: policy.requiredEvidenceDomains,
      parentAndMemberRepeatabilitySeparated: true
    },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['routed_scoped_canonical_activity_repeatability_evidence_work_not_completed'],
    state: policy.inputState,
    contentHash: `routing-${key}`
  };
}

function fetchedPage(record, { content = sourceText, pageId, title, revision, timestamp } = {}) {
  const identity = record.canonicalActivitySubjectBinding.sourcePageIdentity;
  return {
    pageid: pageId ?? identity.sourcePageId,
    title: title ?? identity.resolvedTitle,
    revisions: [{
      revid: revision ?? Number(identity.sourceRevision),
      timestamp: timestamp ?? identity.sourceTimestamp,
      slots: { main: { content } }
    }]
  };
}

const input = routingRecord();
const fetched = [fetchedPage(input)];
const requests = discoverScopedCanonicalActivityRepeatabilityExactRevisionRequests([input], policy);
assert.equal(requests.length, 1);
assert.equal(requests[0].sourceRevision, '201');

const built = buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.repeatabilityEvidencePacketCoverageComplete, true);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.revisionCoverage.exactRevisionFetchSetMatch, true);
assert.equal(built.audit.captureCoverage.completePacketCount, 1);
assert.equal(built.audit.captureCoverage.completeEvidenceDomainSetCount, 1);
assert.equal(built.audit.captureCoverage.completeCaptureChannelSetCount, 1);
assert.equal(built.audit.candidateObservationCoverage.parentActivityCandidateCount, 2);
assert.equal(built.audit.candidateObservationCoverage.memberTaskCandidateCount, 0);
assert.equal(built.audit.candidateObservationCoverage.cooldownResetLimitCandidateCount, 0);
assert.equal(built.audit.candidateObservationCoverage.finiteExhaustionLockoutCandidateCount, 0);
assert.equal(built.audit.candidateObservationCoverage.availabilityEligibilityCandidateCount, 1);
assert.equal(built.audit.candidateObservationCoverage.independentSourceReferenceCandidateCount, 1);
assert.equal(built.audit.candidateObservationCoverage.recurrenceStructureNotProofCount, 2);
assert.equal(built.audit.candidateObservationCoverage.repeatabilityVerdictCount, 0);
const output = built.records[0];
assert.equal(output.canonicalActivityRepeatabilityEvidence.evidenceState, 'complete_revision_pinned_scoped_canonical_activity_repeatability_evidence_packet');
assert.equal(output.canonicalActivityRepeatabilityEvidence.requiredEvidenceDomainCount, 6);
assert.equal(output.canonicalActivityRepeatabilityEvidence.capturedEvidenceDomainCount, 6);
assert.equal(output.canonicalActivityRepeatabilityEvidence.resolvedEvidenceDomainCount, 0);
assert.equal(output.canonicalActivityRepeatabilityEvidenceReview.repeatabilityVerdict, null);
assert.equal(output.canonicalActivityRepeatabilityEvidenceSources[0].exactRevisionSourceText, sourceText);
assert.ok(output.canonicalActivityRepeatabilityEvidenceSources[0].domainEvidence.every(domain => domain.resolutionState === 'unresolved_pending_semantic_disposition_and_possible_independent_evidence'));
assert.deepEqual(output.canonicalActivityScopeDisposition, input.canonicalActivityScopeDisposition);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const zeroText = '{{Infobox Activity\n|name = Quiet activity\n}}\nNo relevant statement appears.';
const zeroInput = routingRecord({ key: '2', label: 'Quiet activity', content: zeroText });
const zero = buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [zeroInput], fetchedPages: [fetchedPage(zeroInput, { content: zeroText })], policy, contentHash: hash });
assert.equal(zero.audit.repeatabilityEvidencePacketCoverageComplete, true);
assert.equal(zero.audit.candidateObservationCoverage.zeroSignalPacketCount, 1);
assert.equal(zero.records[0].canonicalActivityRepeatabilityEvidence.repeatabilityVerdict, null);

const wrongPage = buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [input], fetchedPages: [fetchedPage(input, { pageId: 999 })], policy, contentHash: hash });
assert.equal(wrongPage.audit.publishable, true);
assert.equal(wrongPage.audit.repeatabilityEvidencePacketCoverageComplete, false);
assert.ok(wrongPage.audit.blockers.includes('one_or_more_revision_pinned_scoped_activity_repeatability_sources_incomplete'));

const missingFetch = buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [input], fetchedPages: [], policy, contentHash: hash });
assert.equal(missingFetch.audit.publishable, false);
assert.ok(missingFetch.audit.blockers.includes('exact_scoped_activity_revision_fetch_set_mismatch'));

const stalePrior = routingRecord({ key: '3' });
stalePrior.canonicalActivityScopeEvidenceSources[0].exactRevisionSourceText = 'stale';
const staleBuilt = buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [stalePrior], fetchedPages: [fetchedPage(stalePrior, { revision: 203 })], policy, contentHash: hash });
assert.equal(staleBuilt.audit.repeatabilityEvidencePacketCoverageComplete, false);

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'member:1': 'repeatable' };
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [input], fetchedPages: fetched, policy: specificPolicy, contentHash: hash }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [input], fetchedPages: fetched, policy: automaticPolicy, contentHash: hash }).audit.publishable, false);

const altered = structuredClone(built.records);
altered[0].canonicalActivityRepeatabilityEvidenceSources[0].sourceLocatedSignals = [];
const alteredAudit = auditScopedCanonicalActivityRepeatabilityEvidence(altered, { routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(alteredAudit.publishable, false);
assert.ok(alteredAudit.blockers.includes('one_or_more_repeatability_evidence_packets_or_signals_do_not_match_exact_revision_sources'));

const promoted = structuredClone(built.records);
promoted[0].canonicalActivityRepeatabilityEvidenceReview.parentActivityRepeatabilityVerdict = 'repeatable';
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditScopedCanonicalActivityRepeatabilityEvidence(promoted, { routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('repeatability_evidence_created_unsupported_parent_member_scope_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditScopedCanonicalActivityRepeatabilityEvidence(accountScoped, { routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_scoped_activity_repeatability_evidence'));

const deterministicA = buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
const deterministicB = buildScopedCanonicalActivityRepeatabilityEvidence({ routingRecords: [structuredClone(input)], fetchedPages: structuredClone(fetched), policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileScopedCanonicalActivityRepeatabilityEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.duplicateDefinitionKeys, []);
assert.deepEqual(compiled.invalidDefinitionKeys, []);
assert.deepEqual(compiled.requiredDomainsMissingDefinitions, []);

console.log('Revision-pinned scoped canonical-activity repeatability evidence checks passed.');
