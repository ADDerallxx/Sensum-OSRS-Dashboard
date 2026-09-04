import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityCandidateEvidenceWorkRoutes,
  buildActivityCandidateEvidenceWorkRoutes,
  compileActivityCandidateEvidenceWorkRoutingPolicy
} from '../transforms/activity-candidate-evidence-work-routing-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-evidence-work-routing-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-evidence-work-routing-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-candidate-evidence-work-routing-audit-v1.json', 'utf8'));
const dispositionRecord = ({
  key = '1',
  disposition = 'minigame_subject',
  state = 'source_supported',
  conflicts = []
} = {}) => ({
  contract: 'sensum.activity-candidate-subject-disposition.v1',
  candidateKey: `osrs-wiki-pageid:${key}`,
  sourcePageId: Number(key),
  resolvedTitle: `Example ${key}`,
  skillKeys: ['agility'],
  statementKeys: [`agility:${key}`],
  sourceRevision: '100',
  sourceTimestamp: '2026-09-04T00:00:00Z',
  sourceUrl: `https://example.test/${key}`,
  sourceContentHash: `source-${key}`,
  sourceSignatureContexts: [{ targetKey: `wiki-title:${key}` }],
  dispositionSignals: [{ signalKind: 'infobox_type_parameter', signalKey: 'type', disposition: disposition || conflicts[0], sourceLocator: { lineStart: 2, lineEnd: 2 } }],
  subjectDisposition: { state, disposition, conflictingDispositions: conflicts },
  repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
  memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
  canonicalGameEntityIdentity: null,
  canonicalActivityIdentity: null,
  optimizerEligible: false,
  accountIndependent: true,
  blockers: ['canonical_activity_identity_not_established'],
  contentHash: `disposition-${key}`
});

assert.deepEqual(compileActivityCandidateEvidenceWorkRoutingPolicy(policy).pageSpecificPolicyPaths, []);

const inputs = [
  dispositionRecord(),
  dispositionRecord({ key: '2', disposition: 'reference_collection_subject' }),
  dispositionRecord({ key: '3', disposition: null, state: 'blocked_conflicting_source_declarations', conflicts: ['activity_subject', 'minigame_subject'] })
];
const built = buildActivityCandidateEvidenceWorkRoutes({ dispositionRecords: inputs, policy });
for (const record of built.records) {
  for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
}
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.routingCoverageComplete, true);
assert.equal(built.audit.evidenceWorkComplete, false);
assert.equal(built.audit.routingCoverage.routedCount, 3);
assert.equal(built.audit.routingCoverage.queuedCount, 2);
assert.equal(built.audit.routingCoverage.blockedRouteCount, 1);
assert.equal(built.audit.routingCoverage.sourceConflictCount, 1);
assert.equal(built.records[0].routingDecision.routeKey, 'minigame_session_and_mode_review');
assert.equal(built.records[1].routingDecision.routeKey, 'collection_member_expansion_review');
assert.equal(built.records[2].routingDecision.routeKey, 'source_declaration_conflict_review');
assert.equal(built.records[2].routingDecision.routeState, 'blocked_source_conflict');
assert.equal(built.records[0].sourceDispositionContentHash, 'disposition-1');
assert.equal(built.records[0].canonicalActivityIdentity, null);
assert.equal(built.records[0].repeatabilityReview.state, 'unreviewed');
assert.equal(built.records[0].memberExpansionReview.state, 'unreviewed');
assert.equal(built.records[0].optimizerEligible, false);

const unknownDispositionInput = dispositionRecord({ key: '4', disposition: 'unknown_subject' });
const unknownDisposition = buildActivityCandidateEvidenceWorkRoutes({ dispositionRecords: [unknownDispositionInput], policy });
assert.equal(unknownDisposition.audit.publishable, false);
assert.deepEqual(unknownDisposition.audit.policyCoverage.unmappedSubjectDispositions, ['unknown_subject']);
assert.equal(unknownDisposition.records[0].routingDecision.routeState, 'unrouted');

const unknownStateInput = dispositionRecord({ key: '5', disposition: null, state: 'blocked_future_state' });
const unknownState = buildActivityCandidateEvidenceWorkRoutes({ dispositionRecords: [unknownStateInput], policy });
assert.equal(unknownState.audit.publishable, false);
assert.deepEqual(unknownState.audit.policyCoverage.unmappedSourceStates, ['blocked_future_state']);

const pageSpecificPolicy = structuredClone(policy);
pageSpecificPolicy.overrides = { 'osrs-wiki-pageid:1': 'minigame_session_and_mode_review' };
const forbiddenPolicy = buildActivityCandidateEvidenceWorkRoutes({ dispositionRecords: [inputs[0]], policy: pageSpecificPolicy });
assert.equal(forbiddenPolicy.audit.publishable, false);
assert.ok(forbiddenPolicy.audit.blockers.includes('page_specific_or_override_evidence_work_routing_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].sourceRevision = '999';
const altered = auditActivityCandidateEvidenceWorkRoutes(alteredRecords, { dispositionRecords: inputs, policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_input_identity_revision_hash_signal_or_context_values_changed'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityCandidateEvidenceWorkRoutes(promotedRecords, { dispositionRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_canonical_repeatability_member_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].accountState = { level: 34 };
const accountInjected = auditActivityCandidateEvidenceWorkRoutes(accountRecords, { dispositionRecords: inputs, policy });
assert.equal(accountInjected.publishable, false);
assert.ok(accountInjected.blockers.includes('account_query_state_baked_into_evidence_work_routes'));

console.log('Generic activity-candidate evidence-work routing checks passed.');
